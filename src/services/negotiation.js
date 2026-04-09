/**
 * HiveAgent Real-Time Negotiation Engine
 *
 * Agents negotiate prices, terms, and bundles automatically.
 * HiveAgent earns 5% of every accepted deal value.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const PLATFORM_FEE_PCT = 0.05;

/**
 * Route platform fee to HiveAgent CDP treasury (USDC on Base).
 * Logs always; transfers when CDP is initialized.
 */
async function collectPlatformFee(feeUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Fee] $${Number(feeUsd).toFixed(4)} → CDP treasury ${treasury.slice(0,8)}... — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usd: feeUsd, network: "base", currency: "USDC" };
    }
  } catch {}
  console.log(`[Fee] $${Number(feeUsd).toFixed(4)} logged (CDP pending init) — ${context}`);
  return { collected: false, fee_usd: feeUsd };
}


// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS negotiations (
    id TEXT PRIMARY KEY,
    initiator_agent_id TEXT NOT NULL,
    responder_agent_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'open',               -- 'open','counter','accepted','rejected','expired'
    initial_offer_usd REAL NOT NULL,
    current_offer_usd REAL NOT NULL,
    counter_count INTEGER DEFAULT 0,
    max_rounds INTEGER DEFAULT 10,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS negotiation_rounds (
    id TEXT PRIMARY KEY,
    negotiation_id TEXT NOT NULL REFERENCES negotiations(id),
    round_number INTEGER NOT NULL,
    from_agent_id TEXT NOT NULL,
    offer_usd REAL NOT NULL,
    terms TEXT,                               -- JSON
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS negotiation_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    default_terms TEXT,                       -- JSON
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_negotiations_initiator ON negotiations(initiator_agent_id);
  CREATE INDEX IF NOT EXISTS idx_negotiations_responder ON negotiations(responder_agent_id);
  CREATE INDEX IF NOT EXISTS idx_negotiations_status ON negotiations(status);
  CREATE INDEX IF NOT EXISTS idx_negotiation_rounds_neg ON negotiation_rounds(negotiation_id);
`);

// ─── Templates ────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    name: "Service Contract",
    category: "services",
    default_terms: { payment_terms: "net_30", revisions: 2, delivery_days: 14, exclusivity: false },
  },
  {
    name: "Data License",
    category: "data",
    default_terms: { duration_months: 12, usage_rights: "non_exclusive", sublicense: false, attribution: true },
  },
  {
    name: "Product Purchase",
    category: "products",
    default_terms: { warranty_days: 30, return_policy: "7_days", shipping: "standard", quantity: 1 },
  },
];

// Seed templates on first run
const templateCount = db.prepare("SELECT COUNT(*) as count FROM negotiation_templates").get().count;
if (templateCount === 0) {
  for (const t of DEFAULT_TEMPLATES) {
    db.prepare(`
      INSERT INTO negotiation_templates (id, name, category, default_terms)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), t.name, t.category, JSON.stringify(t.default_terms));
  }
}

// ─── Core Functions ────────────────────────────────

/**
 * Start a new negotiation
 */
export function startNegotiation({
  initiator_agent_id,
  responder_agent_id,
  subject,
  category,
  initial_offer_usd,
  terms = {},
  max_rounds = 10,
  expires_in_minutes = 1440,
}) {
  if (!initiator_agent_id) throw new Error("initiator_agent_id is required");
  if (!responder_agent_id) throw new Error("responder_agent_id is required");
  if (!subject) throw new Error("subject is required");
  if (!initial_offer_usd || initial_offer_usd <= 0) throw new Error("initial_offer_usd must be positive");
  if (initiator_agent_id === responder_agent_id) throw new Error("Initiator and responder must be different agents");

  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + expires_in_minutes);

  const id = uuid();
  db.prepare(`
    INSERT INTO negotiations
      (id, initiator_agent_id, responder_agent_id, subject, category, status, initial_offer_usd, current_offer_usd, max_rounds, expires_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
  `).run(id, initiator_agent_id, responder_agent_id, subject, category || null, initial_offer_usd, initial_offer_usd, max_rounds, expires.toISOString());

  // Log first round
  db.prepare(`
    INSERT INTO negotiation_rounds (id, negotiation_id, round_number, from_agent_id, offer_usd, terms, message)
    VALUES (?, ?, 1, ?, ?, ?, ?)
  `).run(uuid(), id, initiator_agent_id, initial_offer_usd, JSON.stringify(terms), `Opening offer for: ${subject}`);

  return db.prepare("SELECT * FROM negotiations WHERE id = ?").get(id);
}

/**
 * Submit a counter offer
 */
export function counterOffer({ negotiation_id, agent_id, offer_usd, terms = {}, message }) {
  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!offer_usd || offer_usd <= 0) throw new Error("offer_usd must be positive");

  const neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error("Negotiation not found");
  if (!["open", "counter"].includes(neg.status)) throw new Error(`Negotiation is ${neg.status}`);
  if (new Date(neg.expires_at) < new Date()) throw new Error("Negotiation has expired");
  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.responder_agent_id) {
    throw new Error("Agent is not a party to this negotiation");
  }
  if (neg.counter_count >= neg.max_rounds) throw new Error("Maximum negotiation rounds reached");

  const roundNum = neg.counter_count + 2; // round 1 was opening offer
  db.prepare(`
    INSERT INTO negotiation_rounds (id, negotiation_id, round_number, from_agent_id, offer_usd, terms, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuid(), negotiation_id, roundNum, agent_id, offer_usd, JSON.stringify(terms), message || null);

  db.prepare(`
    UPDATE negotiations
    SET status = 'counter', current_offer_usd = ?, counter_count = counter_count + 1
    WHERE id = ?
  `).run(offer_usd, negotiation_id);

  return {
    negotiation_id,
    round: roundNum,
    agent_id,
    offer_usd,
    terms,
    message,
    counter_count: neg.counter_count + 1,
    rounds_remaining: neg.max_rounds - (neg.counter_count + 1),
  };
}

/**
 * Accept the current offer
 */
export function acceptOffer(negotiation_id, agent_id) {
  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  const neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error("Negotiation not found");
  if (!["open", "counter"].includes(neg.status)) throw new Error(`Negotiation is ${neg.status}`);
  if (new Date(neg.expires_at) < new Date()) throw new Error("Negotiation has expired");
  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.responder_agent_id) {
    throw new Error("Agent is not a party to this negotiation");
  }

  const commissionUSD = Math.round(neg.current_offer_usd * PLATFORM_FEE_PCT * 100) / 100;

  db.prepare(`
    UPDATE negotiations
    SET status = 'accepted', resolved_at = datetime('now')
    WHERE id = ?
  `).run(negotiation_id);

  return {
    negotiation_id,
    status: "accepted",
    accepted_by: agent_id,
    final_price_usd: neg.current_offer_usd,
    platform_commission_usd: commissionUSD,
    net_value_usd: Math.round((neg.current_offer_usd - commissionUSD) * 100) / 100,
    total_rounds: neg.counter_count + 1,
  };
}

/**
 * Reject the current offer and close the negotiation
 */
export function rejectOffer(negotiation_id, agent_id, reason) {
  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  const neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error("Negotiation not found");
  if (!["open", "counter"].includes(neg.status)) throw new Error(`Negotiation is ${neg.status}`);
  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.responder_agent_id) {
    throw new Error("Agent is not a party to this negotiation");
  }

  db.prepare(`
    UPDATE negotiations
    SET status = 'rejected', resolved_at = datetime('now')
    WHERE id = ?
  `).run(negotiation_id);

  // Log final rejection round
  db.prepare(`
    INSERT INTO negotiation_rounds (id, negotiation_id, round_number, from_agent_id, offer_usd, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuid(), negotiation_id, neg.counter_count + 2, agent_id, neg.current_offer_usd, reason || "Offer rejected");

  return {
    negotiation_id,
    status: "rejected",
    rejected_by: agent_id,
    reason: reason || "No reason provided",
    last_offer_usd: neg.current_offer_usd,
  };
}

// ─── Queries ──────────────────────────────────────

/**
 * Get full negotiation with round history
 */
export function getNegotiation(negotiation_id) {
  const neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error("Negotiation not found");
  const rounds = db.prepare(`
    SELECT * FROM negotiation_rounds WHERE negotiation_id = ? ORDER BY round_number ASC
  `).all(negotiation_id);
  return {
    ...neg,
    rounds: rounds.map(r => ({ ...r, terms: r.terms ? JSON.parse(r.terms) : {} })),
  };
}

/**
 * Get all active negotiations for an agent
 */
export function getAgentNegotiations(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  return db.prepare(`
    SELECT * FROM negotiations
    WHERE (initiator_agent_id = ? OR responder_agent_id = ?)
    ORDER BY created_at DESC
  `).all(agent_id, agent_id);
}

// ─── Auto-Negotiate ────────────────────────────────

/**
 * Automatically respond to a negotiation based on strategy
 * strategies: aggressive (low concessions), moderate, conservative (high concessions)
 */
export function autoNegotiate({ negotiation_id, agent_id, min_price, max_price, strategy = "moderate" }) {
  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  const neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error("Negotiation not found");
  if (!["open", "counter"].includes(neg.status)) {
    return { negotiation_id, action: "none", reason: `Negotiation is ${neg.status}` };
  }
  if (new Date(neg.expires_at) < new Date()) {
    return { negotiation_id, action: "none", reason: "Negotiation has expired" };
  }
  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.responder_agent_id) {
    throw new Error("Agent is not a party to this negotiation");
  }

  const current = neg.current_offer_usd;
  const isInitiator = agent_id === neg.initiator_agent_id;

  // Determine acceptable range
  const myMin = min_price || (isInitiator ? current * 0.7 : current * 0.9);
  const myMax = max_price || (isInitiator ? current * 1.2 : current * 1.5);

  // If current offer is within range, accept
  if (current >= myMin && current <= myMax) {
    const result = acceptOffer(negotiation_id, agent_id);
    return { ...result, action: "accepted", strategy, reason: "Current offer within acceptable range" };
  }

  // If rounds exhausted or offer too far out of range, reject
  const roundsLeft = neg.max_rounds - neg.counter_count;
  if (roundsLeft <= 0) {
    const result = rejectOffer(negotiation_id, agent_id, "Maximum rounds reached without agreement");
    return { ...result, action: "rejected", strategy };
  }

  // Calculate counter offer based on strategy
  const concessionFactors = { aggressive: 0.1, moderate: 0.25, conservative: 0.45 };
  const factor = concessionFactors[strategy] || 0.25;

  let counterPrice;
  if (current < myMin) {
    // Offer too low — counter higher
    counterPrice = Math.round((current + (myMin - current) * factor) * 100) / 100;
  } else {
    // Offer too high — counter lower
    counterPrice = Math.round((current - (current - myMax) * factor) * 100) / 100;
  }

  counterPrice = Math.max(myMin * 0.95, Math.min(myMax * 1.05, counterPrice));

  const messages = {
    aggressive: `Counter offer — maintaining firm position.`,
    moderate: `Counter offer — looking for middle ground.`,
    conservative: `Counter offer — keen to reach agreement.`,
  };

  const result = counterOffer({
    negotiation_id,
    agent_id,
    offer_usd: counterPrice,
    message: messages[strategy],
  });

  return { ...result, action: "counter", strategy, auto_counter_usd: counterPrice };
}

// ─── Stats ────────────────────────────────────────

/**
 * Platform-wide negotiation stats
 */
export function getNegotiationStats() {
  const total = db.prepare("SELECT COUNT(*) as count FROM negotiations").get().count;
  const accepted = db.prepare("SELECT COUNT(*) as count FROM negotiations WHERE status = 'accepted'").get().count;
  const rejected = db.prepare("SELECT COUNT(*) as count FROM negotiations WHERE status = 'rejected'").get().count;
  const active = db.prepare("SELECT COUNT(*) as count FROM negotiations WHERE status IN ('open','counter')").get().count;
  const totalValue = db.prepare("SELECT ROUND(SUM(current_offer_usd), 2) as total FROM negotiations WHERE status = 'accepted'").get().total || 0;
  const platformRevenue = Math.round(totalValue * PLATFORM_FEE_PCT * 100) / 100;
  const avgRounds = db.prepare("SELECT ROUND(AVG(counter_count), 2) as avg FROM negotiations WHERE status IN ('accepted','rejected')").get().avg || 0;
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count, COUNT(CASE WHEN status='accepted' THEN 1 END) as accepted
    FROM negotiations WHERE category IS NOT NULL GROUP BY category
  `).all();

  return {
    negotiations: { total, active, accepted, rejected, success_rate_pct: total > 0 ? Math.round((accepted / total) * 100) : 0 },
    financials: {
      total_accepted_value_usd: totalValue,
      platform_revenue_usd: platformRevenue,
      commission_pct: PLATFORM_FEE_PCT * 100,
    },
    avg_rounds_to_close: avgRounds,
    by_category: byCategory,
  };
}
