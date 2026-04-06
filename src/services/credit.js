/**
 * HiveAgent Stablecoin Credit
 *
 * Agents borrow stablecoins against their reputation score.
 * No collateral needed for trusted agents — HiveAgent IS the lender.
 *
 * Credit Tiers (based on trust score from reputation.js):
 *   Diamond  (90+): $10,000 limit, 5% APR
 *   Platinum (75+): $5,000 limit,  8% APR
 *   Gold     (60+): $2,000 limit, 12% APR
 *   Silver   (40+): $500 limit,  18% APR
 *   Bronze  (<40):  No credit available
 *
 * Revenue: Interest on all credit draws. Platform fee = 5% of interest payments.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS credit_lines (
    id                      TEXT PRIMARY KEY,
    agent_id                TEXT NOT NULL,
    credit_limit_usd        REAL NOT NULL,
    available_credit_usd    REAL NOT NULL,
    used_credit_usd         REAL DEFAULT 0,
    interest_rate_pct       REAL NOT NULL,
    min_payment_pct         REAL DEFAULT 10,
    status                  TEXT DEFAULT 'active',
    credit_score_at_approval INTEGER,
    trust_score_at_approval  INTEGER,
    approved_at             TEXT DEFAULT (datetime('now')),
    last_payment_at         TEXT,
    created_at              TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credit_draws (
    id               TEXT PRIMARY KEY,
    credit_line_id   TEXT REFERENCES credit_lines(id),
    amount_usd       REAL NOT NULL,
    purpose          TEXT,
    interest_accrued REAL DEFAULT 0,
    status           TEXT DEFAULT 'outstanding',
    drawn_at         TEXT DEFAULT (datetime('now')),
    due_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS credit_payments (
    id               TEXT PRIMARY KEY,
    credit_line_id   TEXT REFERENCES credit_lines(id),
    amount_usd       REAL NOT NULL,
    principal_usd    REAL,
    interest_usd     REAL,
    platform_fee_usd REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Credit Tier Logic ────────────────────────────────────────────────────────

const CREDIT_TIERS = [
  { name: "diamond",  min_trust: 90, limit: 10000, apr: 5  },
  { name: "platinum", min_trust: 75, limit: 5000,  apr: 8  },
  { name: "gold",     min_trust: 60, limit: 2000,  apr: 12 },
  { name: "silver",   min_trust: 40, limit: 500,   apr: 18 },
];

function getTierForTrustScore(trust_score) {
  for (const tier of CREDIT_TIERS) {
    if (trust_score >= tier.min_trust) return tier;
  }
  return null; // Bronze — no credit
}

/** Try to get trust_score from the reputation module. Falls back to agent_reputation table. */
function getAgentTrustScore(agent_id) {
  try {
    const row = db.prepare("SELECT trust_score, credit_score FROM agent_reputation WHERE agent_id = ?").get(agent_id);
    if (row) return { trust_score: row.trust_score, credit_score: row.credit_score };
  } catch (_) {
    // Table may not exist yet
  }
  return { trust_score: 50, credit_score: 600 }; // default
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Check reputation and auto-approve a credit line for the agent.
 * Throws if trust score is too low (Bronze tier) or agent already has an active line.
 */
export function applyForCredit(agent_id) {
  if (!agent_id) throw new Error("agent_id is required.");

  const existing = db.prepare(
    "SELECT * FROM credit_lines WHERE agent_id = ? AND status = 'active'"
  ).get(agent_id);
  if (existing) throw new Error("Agent already has an active credit line.");

  const { trust_score, credit_score } = getAgentTrustScore(agent_id);
  const tier = getTierForTrustScore(trust_score);
  if (!tier) {
    throw new Error(
      `Credit not available. Trust score ${trust_score} is below the minimum of 40 (Silver tier). ` +
      `Complete more successful transactions to build your reputation.`
    );
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO credit_lines
      (id, agent_id, credit_limit_usd, available_credit_usd, interest_rate_pct,
       credit_score_at_approval, trust_score_at_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, tier.limit, tier.limit, tier.apr, credit_score, trust_score);

  return {
    ...db.prepare("SELECT * FROM credit_lines WHERE id = ?").get(id),
    tier: tier.name,
  };
}

/**
 * Draw from a credit line.
 */
export function drawCredit({ credit_line_id, amount_usd, purpose }) {
  if (amount_usd <= 0) throw new Error("Draw amount must be positive.");
  const line = db.prepare("SELECT * FROM credit_lines WHERE id = ?").get(credit_line_id);
  if (!line) throw new Error("Credit line not found.");
  if (line.status !== "active") throw new Error(`Credit line is ${line.status}.`);
  if (line.available_credit_usd < amount_usd) {
    throw new Error(
      `Insufficient credit. Available: $${line.available_credit_usd.toFixed(2)}, Requested: $${amount_usd.toFixed(2)}`
    );
  }

  const id = uuid();
  // Due in 30 days
  const due_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO credit_draws (id, credit_line_id, amount_usd, purpose, due_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, credit_line_id, amount_usd, purpose || null, due_at);

  db.prepare(`
    UPDATE credit_lines
    SET available_credit_usd = available_credit_usd - ?,
        used_credit_usd = used_credit_usd + ?
    WHERE id = ?
  `).run(amount_usd, amount_usd, credit_line_id);

  return db.prepare("SELECT * FROM credit_draws WHERE id = ?").get(id);
}

/**
 * Make a payment toward a credit line.
 * Payment is split: first covers accrued interest, remainder reduces principal.
 * Platform fee = 5% of the interest portion paid.
 */
export function makePayment({ credit_line_id, amount_usd }) {
  if (amount_usd <= 0) throw new Error("Payment amount must be positive.");
  const line = db.prepare("SELECT * FROM credit_lines WHERE id = ?").get(credit_line_id);
  if (!line) throw new Error("Credit line not found.");
  if (line.status === "closed") throw new Error("Credit line is already closed.");

  // Sum all accrued interest across outstanding draws
  const interest_owed = db.prepare(`
    SELECT COALESCE(SUM(interest_accrued), 0) AS total
    FROM credit_draws WHERE credit_line_id = ? AND status = 'outstanding'
  `).get(credit_line_id).total;

  let interest_paid = Math.min(amount_usd, interest_owed);
  let principal_paid = amount_usd - interest_paid;
  const platform_fee = parseFloat((interest_paid * 0.05).toFixed(6));

  // Clear interest from draws (FIFO)
  if (interest_paid > 0) {
    const draws = db.prepare(`
      SELECT * FROM credit_draws WHERE credit_line_id = ? AND status = 'outstanding'
      ORDER BY drawn_at ASC
    `).all(credit_line_id);

    let remaining_interest = interest_paid;
    for (const draw of draws) {
      if (remaining_interest <= 0) break;
      const reduce = Math.min(draw.interest_accrued, remaining_interest);
      db.prepare("UPDATE credit_draws SET interest_accrued = interest_accrued - ? WHERE id = ?")
        .run(reduce, draw.id);
      remaining_interest -= reduce;
    }
  }

  // Reduce principal on draws (FIFO), mark repaid if fully paid
  if (principal_paid > 0) {
    const draws = db.prepare(`
      SELECT * FROM credit_draws WHERE credit_line_id = ? AND status = 'outstanding'
      ORDER BY drawn_at ASC
    `).all(credit_line_id);

    let remaining_principal = principal_paid;
    for (const draw of draws) {
      if (remaining_principal <= 0) break;
      if (draw.amount_usd <= remaining_principal) {
        db.prepare("UPDATE credit_draws SET status = 'repaid' WHERE id = ?").run(draw.id);
        remaining_principal -= draw.amount_usd;
      } else {
        db.prepare("UPDATE credit_draws SET amount_usd = amount_usd - ? WHERE id = ?")
          .run(remaining_principal, draw.id);
        remaining_principal = 0;
      }
    }
  }

  // Update credit line available balance
  db.prepare(`
    UPDATE credit_lines
    SET available_credit_usd = MIN(credit_limit_usd, available_credit_usd + ?),
        used_credit_usd = MAX(0, used_credit_usd - ?),
        last_payment_at = datetime('now')
    WHERE id = ?
  `).run(principal_paid, principal_paid, credit_line_id);

  // Log payment
  const pay_id = uuid();
  db.prepare(`
    INSERT INTO credit_payments (id, credit_line_id, amount_usd, principal_usd, interest_usd, platform_fee_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pay_id, credit_line_id, amount_usd, principal_paid, interest_paid, platform_fee);

  return {
    payment_id: pay_id,
    amount_usd,
    principal_paid: parseFloat(principal_paid.toFixed(6)),
    interest_paid: parseFloat(interest_paid.toFixed(6)),
    platform_fee,
    credit_line: db.prepare("SELECT * FROM credit_lines WHERE id = ?").get(credit_line_id),
  };
}

/**
 * Get full credit line details including outstanding draws.
 */
export function getCreditLine(credit_line_id) {
  const line = db.prepare("SELECT * FROM credit_lines WHERE id = ?").get(credit_line_id);
  if (!line) throw new Error("Credit line not found.");
  const draws = db.prepare(
    "SELECT * FROM credit_draws WHERE credit_line_id = ? ORDER BY drawn_at DESC"
  ).all(credit_line_id);
  const payments = db.prepare(
    "SELECT * FROM credit_payments WHERE credit_line_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(credit_line_id);
  return { ...line, draws, payments };
}

/**
 * Get all credit lines for an agent.
 */
export function getAgentCredit(agent_id) {
  const lines = db.prepare(
    "SELECT * FROM credit_lines WHERE agent_id = ? ORDER BY created_at DESC"
  ).all(agent_id);
  return lines.map(line => {
    const total_interest = db.prepare(`
      SELECT COALESCE(SUM(interest_accrued), 0) AS total FROM credit_draws
      WHERE credit_line_id = ? AND status = 'outstanding'
    `).get(line.id).total;
    return { ...line, total_interest_owed: total_interest };
  });
}

/**
 * Batch: calculate and apply daily interest on all outstanding credit draws.
 * Should be called daily.
 */
export function accrueInterest() {
  const draws = db.prepare(`
    SELECT cd.*, cl.interest_rate_pct
    FROM credit_draws cd
    JOIN credit_lines cl ON cd.credit_line_id = cl.id
    WHERE cd.status = 'outstanding'
  `).all();

  let processed = 0;
  let total_interest = 0;

  for (const draw of draws) {
    // Daily interest = principal * APR / 365
    const daily_interest = draw.amount_usd * (draw.interest_rate_pct / 100) / 365;
    if (daily_interest < 0.000001) continue;

    db.prepare("UPDATE credit_draws SET interest_accrued = interest_accrued + ? WHERE id = ?")
      .run(daily_interest, draw.id);

    processed++;
    total_interest += daily_interest;
  }

  return {
    draws_processed: processed,
    total_interest_accrued: parseFloat(total_interest.toFixed(6)),
    processed_at: new Date().toISOString(),
  };
}

/**
 * Get platform-wide credit statistics.
 */
export function getCreditStats() {
  const line_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_credit_lines,
      COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_lines,
      COUNT(CASE WHEN status = 'defaulted' THEN 1 END) AS defaulted_lines,
      SUM(credit_limit_usd) AS total_credit_extended,
      SUM(used_credit_usd) AS total_outstanding_principal
    FROM credit_lines
  `).get();

  const payment_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_payments,
      SUM(amount_usd) AS total_paid,
      SUM(interest_usd) AS total_interest_paid,
      SUM(platform_fee_usd) AS total_platform_fees
    FROM credit_payments
  `).get();

  const interest_accrued = db.prepare(`
    SELECT COALESCE(SUM(interest_accrued), 0) AS total FROM credit_draws WHERE status = 'outstanding'
  `).get().total;

  const default_rate = line_stats.total_credit_lines > 0
    ? parseFloat(((line_stats.defaulted_lines / line_stats.total_credit_lines) * 100).toFixed(2))
    : 0;

  return { ...line_stats, ...payment_stats, interest_accrued_outstanding: interest_accrued, default_rate_pct: default_rate };
}
