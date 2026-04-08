/**
 * HiveAgent Payment Streaming
 *
 * Per-second USDC payment streams between agents.
 * Inspired by Superfluid / Sablier — but for the agent economy.
 *
 * Use cases:
 *   - Agent pays for a compute job by the second
 *   - Employer agent streams salary to worker agent
 *   - Subscription that trickles instead of billing in lumps
 *   - SLA-backed streams that auto-pause if uptime drops
 *
 * Revenue: 0.2% of total streamed amount.
 * HiveAgent holds stream reserves and settles on-chain in batches.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_streams (
    id              TEXT PRIMARY KEY,
    sender_id       TEXT NOT NULL,
    receiver_id     TEXT NOT NULL,
    rate_per_second REAL NOT NULL,          -- USDC per second
    rate_per_hour   REAL NOT NULL,
    rate_per_day    REAL NOT NULL,
    token           TEXT DEFAULT 'USDC',
    total_deposited REAL NOT NULL DEFAULT 0,
    total_streamed  REAL DEFAULT 0,
    total_withdrawn REAL DEFAULT 0,
    fee_pct         REAL DEFAULT 0.002,
    status          TEXT DEFAULT 'active',  -- active|paused|completed|cancelled
    reason          TEXT,                   -- pause/cancel reason
    started_at      TEXT DEFAULT (datetime('now')),
    paused_at       TEXT,
    ended_at        TEXT,
    sla_uptime_pct  REAL,                   -- optional SLA — pause if uptime drops below
    memo            TEXT
  );

  CREATE TABLE IF NOT EXISTS stream_checkpoints (
    id          TEXT PRIMARY KEY,
    stream_id   TEXT NOT NULL REFERENCES payment_streams(id),
    streamed    REAL NOT NULL,
    timestamp   TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_streams_sender   ON payment_streams(sender_id);
  CREATE INDEX IF NOT EXISTS idx_streams_receiver ON payment_streams(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_streams_status   ON payment_streams(status);
`);

// ─── Fee Config ───────────────────────────────────────────────────────────────

const STREAM_FEE_PCT = 0.002;  // 0.2%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcStreamed(stream) {
  if (stream.status !== "active") return stream.total_streamed;
  const started = new Date(stream.started_at).getTime();
  const now     = Date.now();
  const seconds = Math.max(0, (now - started) / 1000);
  const gross   = seconds * stream.rate_per_second;
  return Math.min(gross, stream.total_deposited);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Open a new payment stream.
 */
export function openStream({
  sender_id, receiver_id, rate_per_second,
  deposit_usd, token, memo, sla_uptime_pct,
}) {
  if (!sender_id)       throw new Error("sender_id is required.");
  if (!receiver_id)     throw new Error("receiver_id is required.");
  if (!rate_per_second) throw new Error("rate_per_second is required (USDC per second).");
  if (!deposit_usd)     throw new Error("deposit_usd is required (initial stream reserve).");

  const id            = uuid();
  const rate_per_hour = rate_per_second * 3600;
  const rate_per_day  = rate_per_second * 86400;
  const duration_days = deposit_usd / rate_per_day;

  db.prepare(`
    INSERT INTO payment_streams
      (id, sender_id, receiver_id, rate_per_second, rate_per_hour, rate_per_day,
       token, total_deposited, fee_pct, sla_uptime_pct, memo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, sender_id, receiver_id, rate_per_second, rate_per_hour, rate_per_day,
    token || "USDC", deposit_usd, STREAM_FEE_PCT,
    sla_uptime_pct || null, memo || null,
  );

  return {
    stream_id: id,
    sender_id,
    receiver_id,
    rate_per_second,
    rate_per_hour:  parseFloat(rate_per_hour.toFixed(6)),
    rate_per_day:   parseFloat(rate_per_day.toFixed(4)),
    deposit_usd,
    estimated_duration: `${parseFloat(duration_days.toFixed(2))} days`,
    token: token || "USDC",
    status: "active",
    fee_pct: STREAM_FEE_PCT * 100,
    sla_uptime_pct: sla_uptime_pct || null,
    started_at: new Date().toISOString(),
    message: `Stream opened: ${sender_id} → ${receiver_id} at ${rate_per_second} USDC/sec`,
  };
}

/**
 * Check stream status and how much has been streamed.
 */
export function getStream({ stream_id }) {
  if (!stream_id) throw new Error("stream_id is required.");
  const s = db.prepare("SELECT * FROM payment_streams WHERE id = ?").get(stream_id);
  if (!s) throw new Error(`Stream ${stream_id} not found.`);

  const streamed     = calcStreamed(s);
  const remaining    = Math.max(0, s.total_deposited - streamed);
  const fee          = streamed * STREAM_FEE_PCT;
  const net_streamed = streamed - fee;

  return {
    stream_id: s.id,
    sender_id: s.sender_id,
    receiver_id: s.receiver_id,
    rate_per_second: s.rate_per_second,
    rate_per_hour:   s.rate_per_hour,
    rate_per_day:    s.rate_per_day,
    token: s.token,
    total_deposited:  s.total_deposited,
    total_streamed:   parseFloat(streamed.toFixed(6)),
    net_streamed:     parseFloat(net_streamed.toFixed(6)),
    fee_charged:      parseFloat(fee.toFixed(6)),
    remaining_balance: parseFloat(remaining.toFixed(6)),
    status: s.status,
    started_at: s.started_at,
    memo: s.memo,
    sla_uptime_pct: s.sla_uptime_pct,
  };
}

/**
 * Pause a stream.
 */
export function pauseStream({ stream_id, reason }) {
  if (!stream_id) throw new Error("stream_id is required.");
  const s = db.prepare("SELECT * FROM payment_streams WHERE id = ?").get(stream_id);
  if (!s) throw new Error(`Stream ${stream_id} not found.`);
  if (s.status !== "active") throw new Error(`Stream is ${s.status} — can only pause active streams.`);

  const streamed = calcStreamed(s);
  db.prepare("UPDATE payment_streams SET status='paused', paused_at=datetime('now'), total_streamed=?, reason=? WHERE id=?")
    .run(streamed, reason || null, stream_id);

  return { stream_id, status: "paused", total_streamed: parseFloat(streamed.toFixed(6)), reason: reason || null };
}

/**
 * Resume a paused stream.
 */
export function resumeStream({ stream_id }) {
  if (!stream_id) throw new Error("stream_id is required.");
  const s = db.prepare("SELECT * FROM payment_streams WHERE id = ?").get(stream_id);
  if (!s) throw new Error(`Stream ${stream_id} not found.`);
  if (s.status !== "paused") throw new Error(`Stream is ${s.status} — can only resume paused streams.`);

  db.prepare("UPDATE payment_streams SET status='active', paused_at=NULL, reason=NULL, started_at=datetime('now') WHERE id=?")
    .run(stream_id);

  return { stream_id, status: "active", message: "Stream resumed." };
}

/**
 * Cancel a stream and return remaining balance.
 */
export function cancelStream({ stream_id, reason }) {
  if (!stream_id) throw new Error("stream_id is required.");
  const s = db.prepare("SELECT * FROM payment_streams WHERE id = ?").get(stream_id);
  if (!s) throw new Error(`Stream ${stream_id} not found.`);

  const streamed  = calcStreamed(s);
  const refund    = Math.max(0, s.total_deposited - streamed);
  const fee       = streamed * STREAM_FEE_PCT;

  db.prepare("UPDATE payment_streams SET status='cancelled', ended_at=datetime('now'), total_streamed=?, reason=? WHERE id=?")
    .run(streamed, reason || null, stream_id);

  return {
    stream_id,
    status: "cancelled",
    total_streamed:  parseFloat(streamed.toFixed(6)),
    fee_charged:     parseFloat(fee.toFixed(6)),
    refund_to_sender: parseFloat(refund.toFixed(6)),
    reason: reason || null,
    message: `Stream cancelled. $${refund.toFixed(4)} USDC returned to sender.`,
  };
}

/**
 * List streams for an agent.
 */
export function listStreams({ agent_id, role, status, limit }) {
  if (!agent_id) throw new Error("agent_id is required.");
  const roleFilter = role === "sender"   ? "sender_id = ?"
                   : role === "receiver" ? "receiver_id = ?"
                   : "(sender_id = ? OR receiver_id = ?)";
  const params = role ? [agent_id] : [agent_id, agent_id];
  let sql = `SELECT * FROM payment_streams WHERE ${roleFilter}`;
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY started_at DESC LIMIT ?";
  params.push(limit || 20);
  const rows = db.prepare(sql).all(...params);
  return { agent_id, streams: rows, count: rows.length };
}

/**
 * Stats
 */
export function getStreamStats() {
  const total      = db.prepare("SELECT COUNT(*) AS n FROM payment_streams").get().n;
  const active     = db.prepare("SELECT COUNT(*) AS n FROM payment_streams WHERE status='active'").get().n;
  const volume     = db.prepare("SELECT COALESCE(SUM(total_deposited),0) AS s FROM payment_streams").get().s;
  const fees       = db.prepare("SELECT COALESCE(SUM(total_deposited * fee_pct),0) AS s FROM payment_streams").get().s;
  return {
    total_streams: total,
    active_streams: active,
    total_volume_deposited_usd: parseFloat(volume.toFixed(2)),
    total_fees_usd: parseFloat(fees.toFixed(4)),
    fee_pct: STREAM_FEE_PCT * 100,
    use_cases: ["compute-by-second", "agent-salary", "sla-backed-streaming", "subscription-drip"],
  };
}
