/**
 * HiveAgent Reputation & Credit Scoring System
 *
 * Tracks agent trust scores (0-100), credit scores (300-850 FICO-like),
 * tiers (bronze → diamond), badges, and leaderboards.
 *
 * Trust Score formula:
 *   starts at 50
 *   +2 per successful_transaction
 *   -5 per failed_transaction
 *   +3 per dispute_won
 *   -8 per dispute_lost
 *   +1 per high_rating
 *   -2 per low_rating
 *   Capped 0-100
 *
 * Credit Score formula (FICO-like, 300-850):
 *   Based on volume, success rate, account age, dispute history
 *
 * Tiers:
 *   diamond (90+), platinum (75+), gold (60+), silver (40+), bronze (<40)
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_reputation (
    agent_id TEXT PRIMARY KEY,
    trust_score REAL DEFAULT 50,               -- 0-100
    credit_score INTEGER DEFAULT 600,          -- 300-850
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    disputes_won INTEGER DEFAULT 0,
    disputes_lost INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    avg_delivery_time_ms REAL DEFAULT 0,
    total_volume_usd REAL DEFAULT 0,
    account_age_days INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]',                  -- JSON array
    tier TEXT DEFAULT 'bronze',                -- 'bronze','silver','gold','platinum','diamond'
    last_calculated TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reputation_events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,                  -- 'transaction_complete','dispute_won','dispute_lost',
                                               -- 'late_delivery','fast_delivery','high_rating','low_rating','fraud_flag'
    impact_score REAL NOT NULL,                -- positive or negative
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_badges (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    badge_type TEXT NOT NULL,                  -- 'verified','top_rated','fast_responder','high_volume',
                                               -- 'whale','veteran','newcomer','trusted_seller','trusted_buyer'
    earned_at TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_id, badge_type)
  );

  CREATE INDEX IF NOT EXISTS idx_rep_events_agent ON reputation_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_rep_events_type ON reputation_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_badges_agent ON agent_badges(agent_id);
  CREATE INDEX IF NOT EXISTS idx_rep_trust ON agent_reputation(trust_score DESC);
  CREATE INDEX IF NOT EXISTS idx_rep_tier ON agent_reputation(tier);
`);

// ─── Event impact table ───────────────────────────

const EVENT_IMPACTS = {
  transaction_complete: 2,
  failed_transaction:  -5,
  dispute_won:          3,
  dispute_lost:        -8,
  fast_delivery:        1,
  late_delivery:       -2,
  high_rating:          1,
  low_rating:          -2,
  fraud_flag:         -15,
};

// ─── Helpers ──────────────────────────────────────

function getTier(score) {
  if (score >= 90) return "diamond";
  if (score >= 75) return "platinum";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  return "bronze";
}

function ensureReputation(agent_id) {
  const existing = db.prepare("SELECT agent_id FROM agent_reputation WHERE agent_id = ?").get(agent_id);
  if (!existing) {
    db.prepare(`
      INSERT INTO agent_reputation (agent_id) VALUES (?)
    `).run(agent_id);
  }
}

// ─── Core Functions ───────────────────────────────

/**
 * Get full reputation profile for an agent
 */
export function getReputation(agent_id) {
  ensureReputation(agent_id);
  const rep = db.prepare("SELECT * FROM agent_reputation WHERE agent_id = ?").get(agent_id);
  const badges = db.prepare("SELECT * FROM agent_badges WHERE agent_id = ? ORDER BY earned_at ASC").all(agent_id);

  return {
    ...rep,
    badges: JSON.parse(rep.badges || "[]"),
    badge_details: badges,
    tier: rep.tier,
    trust_score: rep.trust_score,
    credit_score: rep.credit_score,
  };
}

/**
 * Record a reputation event and recalculate scores
 */
export function recordEvent({ agent_id, event_type, details }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!event_type) throw new Error("event_type is required");

  ensureReputation(agent_id);

  const impact = EVENT_IMPACTS[event_type];
  if (impact === undefined) {
    throw new Error(`Unknown event_type: ${event_type}. Valid types: ${Object.keys(EVENT_IMPACTS).join(", ")}`);
  }

  const eventId = uuid();
  db.prepare(`
    INSERT INTO reputation_events (id, agent_id, event_type, impact_score, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventId, agent_id, event_type, impact, details ? JSON.stringify(details) : null);

  // Update counters on agent_reputation
  if (event_type === "transaction_complete") {
    db.prepare("UPDATE agent_reputation SET total_transactions = total_transactions + 1, successful_transactions = successful_transactions + 1 WHERE agent_id = ?").run(agent_id);
  } else if (event_type === "failed_transaction") {
    db.prepare("UPDATE agent_reputation SET total_transactions = total_transactions + 1, failed_transactions = failed_transactions + 1 WHERE agent_id = ?").run(agent_id);
  } else if (event_type === "dispute_won") {
    db.prepare("UPDATE agent_reputation SET disputes_won = disputes_won + 1 WHERE agent_id = ?").run(agent_id);
  } else if (event_type === "dispute_lost") {
    db.prepare("UPDATE agent_reputation SET disputes_lost = disputes_lost + 1 WHERE agent_id = ?").run(agent_id);
  }

  // Update volume if provided
  if (details && details.volume_usd) {
    db.prepare("UPDATE agent_reputation SET total_volume_usd = total_volume_usd + ? WHERE agent_id = ?")
      .run(details.volume_usd, agent_id);
  }
  if (details && details.response_time_ms) {
    // Rolling average for response time
    const rep = db.prepare("SELECT avg_response_time_ms, total_transactions FROM agent_reputation WHERE agent_id = ?").get(agent_id);
    const n = rep.total_transactions || 1;
    const newAvg = ((rep.avg_response_time_ms * (n - 1)) + details.response_time_ms) / n;
    db.prepare("UPDATE agent_reputation SET avg_response_time_ms = ? WHERE agent_id = ?").run(Math.round(newAvg), agent_id);
  }

  // Recalculate scores
  const scores = calculateScores(agent_id);

  // Auto-check badges
  checkBadges(agent_id);

  return {
    event_id: eventId,
    agent_id,
    event_type,
    impact_score: impact,
    new_trust_score: scores.trust_score,
    new_credit_score: scores.credit_score,
    new_tier: scores.tier,
  };
}

/**
 * Recalculate trust_score and credit_score from events
 */
export function calculateScores(agent_id) {
  ensureReputation(agent_id);

  const rep = db.prepare("SELECT * FROM agent_reputation WHERE agent_id = ?").get(agent_id);

  // Trust score: start at 50, apply event impacts
  let trustScore = 50;
  trustScore += rep.successful_transactions * 2;
  trustScore += rep.failed_transactions * (-5);
  trustScore += rep.disputes_won * 3;
  trustScore += rep.disputes_lost * (-8);

  // Also sum up high_rating / low_rating events
  const ratingEvents = db.prepare(`
    SELECT event_type, COUNT(*) as count FROM reputation_events
    WHERE agent_id = ? AND event_type IN ('high_rating', 'low_rating', 'fraud_flag', 'fast_delivery', 'late_delivery')
    GROUP BY event_type
  `).all(agent_id);

  for (const e of ratingEvents) {
    const impact = EVENT_IMPACTS[e.event_type] || 0;
    trustScore += impact * e.count;
  }

  trustScore = Math.max(0, Math.min(100, Math.round(trustScore * 10) / 10));

  // Credit score: FICO-like formula (300-850)
  // Base: 575
  // Success rate component (max +100): (successful / total) * 100
  // Volume component (max +75): log scale on volume
  // Account age component (max +50): age days / 365 * 50, cap 50
  // Dispute penalty (max -100): disputes_lost * 10
  const total = rep.total_transactions || 0;
  const successRate = total > 0 ? rep.successful_transactions / total : 0.5;
  const successComponent = Math.round(successRate * 100);

  const volumeComponent = rep.total_volume_usd > 0
    ? Math.min(75, Math.round(Math.log10(rep.total_volume_usd + 1) * 15))
    : 0;

  const ageComponent = Math.min(50, Math.round((rep.account_age_days / 365) * 50));

  const disputePenalty = Math.min(100, rep.disputes_lost * 10);

  const trustBonus = Math.round((trustScore / 100) * 75);

  let creditScore = 575 + successComponent + volumeComponent + ageComponent - disputePenalty + trustBonus;
  creditScore = Math.max(300, Math.min(850, Math.round(creditScore)));

  const tier = getTier(trustScore);

  db.prepare(`
    UPDATE agent_reputation
    SET trust_score = ?, credit_score = ?, tier = ?, last_calculated = datetime('now')
    WHERE agent_id = ?
  `).run(trustScore, creditScore, tier, agent_id);

  return { agent_id, trust_score: trustScore, credit_score: creditScore, tier };
}

// ─── Badges ──────────────────────────────────────

/**
 * Award a badge to an agent
 */
export function awardBadge(agent_id, badge_type) {
  ensureReputation(agent_id);

  const valid_badges = ["verified", "top_rated", "fast_responder", "high_volume", "whale", "veteran", "newcomer", "trusted_seller", "trusted_buyer"];
  if (!valid_badges.includes(badge_type)) throw new Error(`Invalid badge_type: ${badge_type}`);

  const existing = db.prepare("SELECT id FROM agent_badges WHERE agent_id = ? AND badge_type = ?").get(agent_id, badge_type);
  if (existing) return { agent_id, badge_type, already_awarded: true };

  const id = uuid();
  db.prepare("INSERT INTO agent_badges (id, agent_id, badge_type) VALUES (?, ?, ?)").run(id, agent_id, badge_type);

  // Update badges JSON on agent_reputation
  const rep = db.prepare("SELECT badges FROM agent_reputation WHERE agent_id = ?").get(agent_id);
  const badges = JSON.parse(rep.badges || "[]");
  if (!badges.includes(badge_type)) {
    badges.push(badge_type);
    db.prepare("UPDATE agent_reputation SET badges = ? WHERE agent_id = ?").run(JSON.stringify(badges), agent_id);
  }

  return { agent_id, badge_type, badge_id: id, earned_at: new Date().toISOString() };
}

/**
 * Auto-check and award eligible badges
 */
export function checkBadges(agent_id) {
  ensureReputation(agent_id);
  const rep = db.prepare("SELECT * FROM agent_reputation WHERE agent_id = ?").get(agent_id);
  const awarded = [];

  // verified: trust_score >= 60
  if (rep.trust_score >= 60) {
    const r = awardBadge(agent_id, "verified");
    if (!r.already_awarded) awarded.push("verified");
  }

  // top_rated: trust_score >= 85
  if (rep.trust_score >= 85) {
    const r = awardBadge(agent_id, "top_rated");
    if (!r.already_awarded) awarded.push("top_rated");
  }

  // fast_responder: avg_response_time < 5000ms (and has at least some data)
  if (rep.avg_response_time_ms > 0 && rep.avg_response_time_ms < 5000) {
    const r = awardBadge(agent_id, "fast_responder");
    if (!r.already_awarded) awarded.push("fast_responder");
  }

  // high_volume: total_transactions >= 100
  if (rep.total_transactions >= 100) {
    const r = awardBadge(agent_id, "high_volume");
    if (!r.already_awarded) awarded.push("high_volume");
  }

  // whale: total_volume >= 10000
  if (rep.total_volume_usd >= 10000) {
    const r = awardBadge(agent_id, "whale");
    if (!r.already_awarded) awarded.push("whale");
  }

  // veteran: account_age >= 90 days
  if (rep.account_age_days >= 90) {
    const r = awardBadge(agent_id, "veteran");
    if (!r.already_awarded) awarded.push("veteran");
  }

  // newcomer: account_age < 7 days (and at least 1 transaction)
  if (rep.account_age_days < 7 && rep.total_transactions >= 1) {
    const r = awardBadge(agent_id, "newcomer");
    if (!r.already_awarded) awarded.push("newcomer");
  }

  // trusted_seller: >= 50 successful transactions with < 5% dispute rate
  const disputeRate = rep.total_transactions > 0
    ? (rep.disputes_won + rep.disputes_lost) / rep.total_transactions
    : 0;
  if (rep.successful_transactions >= 50 && disputeRate < 0.05) {
    const r = awardBadge(agent_id, "trusted_seller");
    if (!r.already_awarded) awarded.push("trusted_seller");
  }

  // trusted_buyer: same criteria (symmetric)
  if (rep.successful_transactions >= 50 && disputeRate < 0.05) {
    const r = awardBadge(agent_id, "trusted_buyer");
    if (!r.already_awarded) awarded.push("trusted_buyer");
  }

  return { agent_id, newly_awarded: awarded, total_badges: JSON.parse(rep.badges || "[]").length + awarded.length };
}

// ─── Leaderboard & Stats ─────────────────────────

/**
 * Top agents by trust_score, volume, or transactions
 */
export function getLeaderboard({ sort_by = "trust_score", limit = 20 } = {}) {
  const validSorts = {
    trust_score: "trust_score DESC",
    volume: "total_volume_usd DESC",
    transactions: "total_transactions DESC",
    credit_score: "credit_score DESC",
  };
  const orderBy = validSorts[sort_by] || "trust_score DESC";

  const rows = db.prepare(`
    SELECT agent_id, trust_score, credit_score, tier, total_transactions, successful_transactions,
           total_volume_usd, badges, disputes_won, disputes_lost, account_age_days
    FROM agent_reputation
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(limit);

  return rows.map((r, i) => ({ rank: i + 1, ...r, badges: JSON.parse(r.badges || "[]") }));
}

/**
 * Platform-wide reputation statistics
 */
export function getReputationStats() {
  const total = db.prepare("SELECT COUNT(*) as count FROM agent_reputation").get().count;
  const avgTrust = db.prepare("SELECT ROUND(AVG(trust_score), 2) as avg FROM agent_reputation").get().avg;
  const avgCredit = db.prepare("SELECT ROUND(AVG(credit_score), 0) as avg FROM agent_reputation").get().avg;
  const totalBadges = db.prepare("SELECT COUNT(*) as count FROM agent_badges").get().count;
  const totalEvents = db.prepare("SELECT COUNT(*) as count FROM reputation_events").get().count;

  const tierCounts = db.prepare(`
    SELECT tier, COUNT(*) as count FROM agent_reputation GROUP BY tier ORDER BY count DESC
  `).all();

  const topAgent = db.prepare(
    "SELECT agent_id, trust_score, tier FROM agent_reputation ORDER BY trust_score DESC LIMIT 1"
  ).get();

  return {
    total_agents: total,
    avg_trust_score: avgTrust || 0,
    avg_credit_score: avgCredit || 0,
    total_badges_awarded: totalBadges,
    total_reputation_events: totalEvents,
    tier_distribution: tierCounts,
    top_agent: topAgent || null,
  };
}
