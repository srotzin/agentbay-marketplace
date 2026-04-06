/**
 * HiveAgent Cross-Border Agent Payments
 *
 * Instant international stablecoin transfers between agents.
 * Revenue: 0.3–0.7% per transfer (vs 3–6% for traditional remittance).
 *
 * Exchange rates fetched live from open.er-api.com.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cross_border_transfers (
    id                TEXT PRIMARY KEY,
    sender_agent_id   TEXT NOT NULL,
    receiver_agent_id TEXT NOT NULL,
    send_amount       REAL NOT NULL,
    send_currency     TEXT NOT NULL,
    receive_amount    REAL NOT NULL,
    receive_currency  TEXT NOT NULL,
    exchange_rate     REAL NOT NULL,
    fee_usd           REAL NOT NULL,
    fee_pct           REAL NOT NULL,
    status            TEXT DEFAULT 'completed',
    corridor          TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS supported_corridors (
    id                  TEXT PRIMARY KEY,
    from_currency       TEXT NOT NULL,
    to_currency         TEXT NOT NULL,
    fee_pct             REAL NOT NULL,
    avg_time_seconds    INTEGER DEFAULT 30,
    is_active           INTEGER DEFAULT 1
  );
`);

// ─── Seed Corridors ───────────────────────────────────────────────────────────

{
  const existing = db.prepare("SELECT COUNT(*) AS n FROM supported_corridors").get();
  if (existing.n === 0) {
    const corridors = [
      ["USD", "EUR", 0.3],
      ["USD", "GBP", 0.3],
      ["USD", "JPY", 0.4],
      ["USD", "INR", 0.5],
      ["USD", "MXN", 0.5],
      ["USD", "BRL", 0.6],
      ["USD", "PHP", 0.5],
      ["USD", "NGN", 0.7],
      ["EUR", "GBP", 0.2],
      ["EUR", "USD", 0.3],
      ["GBP", "EUR", 0.2],
      ["GBP", "USD", 0.3],
      ["USD", "CAD", 0.3],
      ["USD", "AUD", 0.4],
      ["USD", "SGD", 0.3],
    ];
    const insert = db.prepare(
      "INSERT INTO supported_corridors (id, from_currency, to_currency, fee_pct) VALUES (?, ?, ?, ?)"
    );
    const insertMany = db.transaction((rows) => {
      for (const [from, to, fee] of rows) insert.run(uuid(), from, to, fee);
    });
    insertMany(corridors);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch exchange rate from open.er-api.com. Returns rate: 1 from_currency = X to_currency */
async function fetchExchangeRate(from_currency, to_currency) {
  if (from_currency === to_currency) return 1.0;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from_currency}`);
    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);
    const data = await res.json();
    if (data.result !== "success") throw new Error(`Exchange rate lookup failed: ${data["error-type"]}`);
    const rate = data.rates[to_currency];
    if (!rate) throw new Error(`No rate found for ${from_currency}→${to_currency}`);
    return rate;
  } catch (err) {
    throw new Error(`Failed to fetch exchange rate: ${err.message}`);
  }
}

function getCorridor(from_currency, to_currency) {
  return db.prepare(`
    SELECT * FROM supported_corridors
    WHERE from_currency = ? AND to_currency = ? AND is_active = 1
  `).get(from_currency, to_currency);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Get a transfer quote without executing.
 */
export async function getTransferQuote({ amount, from_currency, to_currency }) {
  if (amount <= 0) throw new Error("Transfer amount must be positive.");
  const corridor = getCorridor(from_currency, to_currency);
  if (!corridor) throw new Error(`Corridor ${from_currency}→${to_currency} is not supported.`);

  const exchange_rate = await fetchExchangeRate(from_currency, to_currency);
  const gross_receive = amount * exchange_rate;

  // Fee is calculated on the send amount in USD terms
  // For simplicity, fee is based on send_amount * fee_pct
  const fee_pct = corridor.fee_pct;
  const fee_usd = parseFloat((amount * fee_pct / 100).toFixed(6));
  // Deduct fee from the received amount (converted)
  const fee_in_to_currency = fee_usd * exchange_rate;
  const receive_amount = parseFloat((gross_receive - fee_in_to_currency).toFixed(6));

  return {
    from_currency,
    to_currency,
    send_amount: amount,
    receive_amount,
    exchange_rate,
    fee_pct,
    fee_usd,
    corridor: `${from_currency}→${to_currency}`,
    avg_time_seconds: corridor.avg_time_seconds,
  };
}

/**
 * Execute a cross-border transfer between agents.
 */
export async function sendTransfer({ sender_agent_id, receiver_agent_id, amount, from_currency, to_currency }) {
  if (!sender_agent_id) throw new Error("sender_agent_id is required.");
  if (!receiver_agent_id) throw new Error("receiver_agent_id is required.");
  if (amount <= 0) throw new Error("Transfer amount must be positive.");

  const quote = await getTransferQuote({ amount, from_currency, to_currency });

  const id = uuid();
  db.prepare(`
    INSERT INTO cross_border_transfers
      (id, sender_agent_id, receiver_agent_id, send_amount, send_currency,
       receive_amount, receive_currency, exchange_rate, fee_usd, fee_pct, status, corridor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).run(
    id, sender_agent_id, receiver_agent_id,
    amount, from_currency,
    quote.receive_amount, to_currency,
    quote.exchange_rate, quote.fee_usd, quote.fee_pct,
    quote.corridor
  );

  return {
    transfer_id: id,
    sender_agent_id,
    receiver_agent_id,
    send_amount: amount,
    send_currency: from_currency,
    receive_amount: quote.receive_amount,
    receive_currency: to_currency,
    exchange_rate: quote.exchange_rate,
    fee_usd: quote.fee_usd,
    fee_pct: quote.fee_pct,
    corridor: quote.corridor,
    avg_time_seconds: quote.avg_time_seconds,
    status: "completed",
    created_at: new Date().toISOString(),
  };
}

/**
 * List all supported corridors with fees and avg transfer time.
 */
export function getCorridors() {
  return db.prepare("SELECT * FROM supported_corridors WHERE is_active = 1 ORDER BY from_currency, to_currency").all();
}

/**
 * Get transfer history for an agent (as sender or receiver).
 */
export function getTransferHistory(agent_id) {
  return db.prepare(`
    SELECT * FROM cross_border_transfers
    WHERE sender_agent_id = ? OR receiver_agent_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(agent_id, agent_id);
}

/**
 * Get platform-wide cross-border statistics.
 */
export function getCrossBorderStats() {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_transfers,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_transfers,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_transfers,
      SUM(send_amount) AS total_volume_sent,
      SUM(fee_usd) AS total_fees_usd,
      AVG(fee_pct) AS avg_fee_pct
    FROM cross_border_transfers
  `).get();

  const top_corridors = db.prepare(`
    SELECT corridor,
           COUNT(*) AS transfer_count,
           SUM(send_amount) AS volume,
           SUM(fee_usd) AS fees
    FROM cross_border_transfers
    GROUP BY corridor
    ORDER BY volume DESC
    LIMIT 10
  `).all();

  const active_corridors = db.prepare("SELECT COUNT(*) AS n FROM supported_corridors WHERE is_active = 1").get();

  return { ...stats, top_corridors, active_corridors: active_corridors.n };
}
