/**
 * HiveAgent Split Payments & Revenue Share
 *
 * Multi-party payment splits for agent teams and revenue sharing.
 *
 * Use cases:
 *   - Agent A earns $100, splits 60/30/10 with sub-agents B, C, and HiveAgent
 *   - Marketplace sale auto-routes: 85% seller, 15% platform
 *   - Team of agents completes a job, earnings split by contribution
 *   - Revenue share for referrals: referring agent gets 20% of all future earnings
 *   - DAO treasury distributions
 *
 * Revenue: 0.3% on total payment value split through this service.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS split_configs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    owner_id    TEXT NOT NULL,
    description TEXT,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS split_recipients (
    id          TEXT PRIMARY KEY,
    config_id   TEXT NOT NULL REFERENCES split_configs(id),
    agent_id    TEXT NOT NULL,
    label       TEXT,
    share_pct   REAL NOT NULL,
    min_usd     REAL DEFAULT 0,
    is_fixed    INTEGER DEFAULT 0,     -- if 1, share_pct is a fixed USD amount, not %
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS split_transactions (
    id          TEXT PRIMARY KEY,
    config_id   TEXT REFERENCES split_configs(id),
    payer_id    TEXT NOT NULL,
    total_usd   REAL NOT NULL,
    fee_usd     REAL NOT NULL,
    memo        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS split_disbursements (
    id              TEXT PRIMARY KEY,
    transaction_id  TEXT NOT NULL REFERENCES split_transactions(id),
    recipient_id    TEXT NOT NULL,
    label           TEXT,
    amount_usd      REAL NOT NULL,
    share_pct       REAL NOT NULL,
    status          TEXT DEFAULT 'completed',
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_split_cfg_owner ON split_configs(owner_id);
  CREATE INDEX IF NOT EXISTS idx_split_tx_payer  ON split_transactions(payer_id);
`);

const SPLIT_FEE_PCT = 0.003;  // 0.3%

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Create a reusable split configuration.
 */
export function createSplit({ owner_id, name, description, recipients }) {
  if (!owner_id) throw new Error("owner_id is required.");
  if (!name)     throw new Error("name is required.");
  if (!recipients || !recipients.length) throw new Error("recipients array is required.");

  const totalPct = recipients.reduce((s, r) => s + (r.is_fixed ? 0 : (r.share_pct || 0)), 0);
  if (Math.abs(totalPct - 100) > 0.01 && recipients.some(r => !r.is_fixed)) {
    throw new Error(`Percentage recipients must sum to 100. Got ${totalPct.toFixed(2)}.`);
  }

  const id = uuid();
  db.prepare("INSERT INTO split_configs (id, name, owner_id, description) VALUES (?,?,?,?)")
    .run(id, name, owner_id, description || null);

  const insRec = db.prepare(`
    INSERT INTO split_recipients (id, config_id, agent_id, label, share_pct, min_usd, is_fixed)
    VALUES (?,?,?,?,?,?,?)
  `);
  const tx = db.transaction(rows => {
    for (const r of rows) {
      insRec.run(uuid(), id, r.agent_id, r.label || r.agent_id, r.share_pct, r.min_usd || 0, r.is_fixed ? 1 : 0);
    }
  });
  tx(recipients);

  return {
    config_id: id,
    name,
    owner_id,
    recipients: recipients.map(r => ({ agent_id: r.agent_id, label: r.label, share_pct: r.share_pct })),
    message: `Split config "${name}" created with ${recipients.length} recipients.`,
  };
}

/**
 * Execute a split payment using a saved config or inline recipients.
 */
export function executeSplit({ config_id, payer_id, total_usd, memo, inline_recipients }) {
  if (!payer_id)   throw new Error("payer_id is required.");
  if (!total_usd || total_usd <= 0) throw new Error("total_usd must be > 0.");

  let recipients;
  if (config_id) {
    const cfg = db.prepare("SELECT * FROM split_configs WHERE id = ? AND is_active = 1").get(config_id);
    if (!cfg) throw new Error(`Split config ${config_id} not found.`);
    recipients = db.prepare("SELECT * FROM split_recipients WHERE config_id = ?").all(config_id);
  } else if (inline_recipients) {
    recipients = inline_recipients.map(r => ({ agent_id: r.agent_id, label: r.label || r.agent_id, share_pct: r.share_pct, min_usd: r.min_usd || 0, is_fixed: r.is_fixed ? 1 : 0 }));
  } else {
    throw new Error("Either config_id or inline_recipients is required.");
  }

  const fee_usd  = Math.max(total_usd * SPLIT_FEE_PCT, 0.001);
  const net_usd  = total_usd - fee_usd;
  const tx_id    = uuid();

  db.prepare("INSERT INTO split_transactions (id, config_id, payer_id, total_usd, fee_usd, memo) VALUES (?,?,?,?,?,?)")
    .run(tx_id, config_id || null, payer_id, total_usd, fee_usd, memo || null);

  const disbursements = [];
  for (const r of recipients) {
    const amount = r.is_fixed ? r.share_pct : (net_usd * r.share_pct / 100);
    const dId = uuid();
    db.prepare("INSERT INTO split_disbursements (id, transaction_id, recipient_id, label, amount_usd, share_pct) VALUES (?,?,?,?,?,?)")
      .run(dId, tx_id, r.agent_id, r.label || r.agent_id, amount, r.share_pct);
    disbursements.push({ agent_id: r.agent_id, label: r.label || r.agent_id, amount_usd: parseFloat(amount.toFixed(4)), share_pct: r.share_pct });
  }

  return {
    transaction_id: tx_id,
    payer_id,
    total_usd,
    fee_usd: parseFloat(fee_usd.toFixed(4)),
    net_distributed: parseFloat(net_usd.toFixed(4)),
    disbursements,
    recipient_count: disbursements.length,
    memo: memo || null,
    status: "completed",
    message: `$${total_usd} split among ${disbursements.length} recipients.`,
  };
}

/**
 * Get a split config with its recipients.
 */
export function getSplitConfig({ config_id }) {
  if (!config_id) throw new Error("config_id is required.");
  const cfg  = db.prepare("SELECT * FROM split_configs WHERE id = ?").get(config_id);
  if (!cfg) throw new Error(`Config ${config_id} not found.`);
  const recs = db.prepare("SELECT * FROM split_recipients WHERE config_id = ?").all(config_id);
  return { ...cfg, recipients: recs };
}

/**
 * List split configs for an agent.
 */
export function listSplitConfigs({ owner_id, limit }) {
  if (!owner_id) throw new Error("owner_id is required.");
  const rows = db.prepare("SELECT * FROM split_configs WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT ?")
    .all(owner_id, limit || 20);
  return { owner_id, configs: rows, count: rows.length };
}

/**
 * Stats
 */
export function getSplitStats() {
  const configs = db.prepare("SELECT COUNT(*) AS n FROM split_configs WHERE is_active=1").get().n;
  const txns    = db.prepare("SELECT COUNT(*) AS n FROM split_transactions").get().n;
  const volume  = db.prepare("SELECT COALESCE(SUM(total_usd),0) AS s FROM split_transactions").get().s;
  const fees    = db.prepare("SELECT COALESCE(SUM(fee_usd),0) AS s FROM split_transactions").get().s;
  return { active_configs: configs, total_transactions: txns, total_volume_usd: parseFloat(volume.toFixed(2)), total_fees_usd: parseFloat(fees.toFixed(4)), fee_pct: SPLIT_FEE_PCT * 100 };
}
