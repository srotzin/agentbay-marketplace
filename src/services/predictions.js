/**
 * HiveAgent Prediction Markets
 *
 * Agents create and bet on predictions. Outcomes settle on-chain.
 *
 * How it works:
 * 1. Any agent creates a prediction market ("Will BTC hit $100K by July 2026?")
 * 2. Other agents bet YES or NO with USDC
 * 3. All bets lock in escrow
 * 4. When the event resolves:
 *    - Oracle agent or creator submits the outcome
 *    - Dispute window opens (30 min)
 *    - If no dispute: winners split the pot minus 5% HiveAgent fee
 *    - If disputed: resolution via voting or arbiter
 * 5. Settlement: USDC distributed on-chain
 *
 * Revenue: 5% of total pot on every resolved market
 *
 * Use cases for agents:
 * - Price predictions (crypto, stocks, commodities)
 * - Event predictions (elections, product launches, regulatory decisions)
 * - Performance bets (will this API have 99.9% uptime?)
 * - Bounties disguised as predictions ("I bet no one can solve X" = bounty)
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";
import { recordEscrowLock, recordEscrowRelease } from "./onchain-settlement.js";

const MARKET_FEE_RATE = 0.05; // 5% of total pot
const DISPUTE_WINDOW_MINUTES = 30;

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS prediction_markets (
    id TEXT PRIMARY KEY,
    creator_agent_id TEXT NOT NULL,
    question TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',     -- 'crypto', 'stocks', 'tech', 'politics', 'sports', 'custom'
    outcome_type TEXT DEFAULT 'binary',   -- 'binary' (yes/no), 'multiple' (up to 10 outcomes)
    outcomes TEXT DEFAULT '["YES","NO"]', -- JSON array of possible outcomes
    resolution_source TEXT,              -- How this will be resolved (URL, oracle, creator)
    resolution_criteria TEXT,            -- Specific criteria for resolution
    status TEXT DEFAULT 'open',          -- 'open', 'closed', 'resolving', 'disputed', 'settled', 'cancelled'
    winning_outcome TEXT,
    total_pool_usd REAL DEFAULT 0,
    fee_usd REAL DEFAULT 0,
    min_bet_usd REAL DEFAULT 0.01,
    max_bet_usd REAL DEFAULT 1000,
    closes_at TEXT NOT NULL,             -- When betting closes
    resolves_at TEXT,                    -- When outcome is expected
    dispute_deadline TEXT,               -- After resolution, dispute window
    settled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prediction_bets (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES prediction_markets(id),
    agent_id TEXT NOT NULL,
    outcome TEXT NOT NULL,               -- Which outcome they bet on
    amount_usd REAL NOT NULL,
    potential_payout_usd REAL,           -- Calculated based on odds at time of bet
    status TEXT DEFAULT 'active',        -- 'active', 'won', 'lost', 'refunded', 'cancelled'
    payout_usd REAL,                     -- Actual payout (set on settlement)
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prediction_disputes (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES prediction_markets(id),
    disputer_agent_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    proposed_outcome TEXT,               -- What the disputer thinks the outcome should be
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',          -- 'open', 'upheld', 'rejected'
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prediction_votes (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL REFERENCES prediction_disputes(id),
    agent_id TEXT NOT NULL,
    vote TEXT NOT NULL,                  -- 'for' or 'against' the dispute
    stake_usd REAL DEFAULT 0,           -- Agents can stake on their vote
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(dispute_id, agent_id)
  );

  CREATE INDEX IF NOT EXISTS idx_markets_status ON prediction_markets(status);
  CREATE INDEX IF NOT EXISTS idx_markets_category ON prediction_markets(category);
  CREATE INDEX IF NOT EXISTS idx_bets_market ON prediction_bets(market_id);
  CREATE INDEX IF NOT EXISTS idx_bets_agent ON prediction_bets(agent_id);
`);

// ─── Market Management ───────────────────────────

/**
 * Create a new prediction market
 */
export function createMarket({
  creator_agent_id, question, description, category = "general",
  outcomes = ["YES", "NO"], resolution_source, resolution_criteria,
  min_bet_usd = 0.01, max_bet_usd = 1000,
  closes_in_hours = 24, resolves_in_hours = 48,
}) {
  const id = uuid();
  const closes_at = new Date(Date.now() + closes_in_hours * 3600000).toISOString();
  const resolves_at = new Date(Date.now() + resolves_in_hours * 3600000).toISOString();

  db.prepare(`
    INSERT INTO prediction_markets (id, creator_agent_id, question, description, category, outcomes,
      resolution_source, resolution_criteria, min_bet_usd, max_bet_usd, closes_at, resolves_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, creator_agent_id, question, description || null, category,
    JSON.stringify(outcomes), resolution_source || null, resolution_criteria || null,
    min_bet_usd, max_bet_usd, closes_at, resolves_at);

  return { market_id: id, question, outcomes, closes_at, resolves_at, status: "open" };
}

/**
 * Place a bet on a prediction market
 */
export async function placeBet({ market_id, agent_id, outcome, amount_usd }) {
  const market = db.prepare("SELECT * FROM prediction_markets WHERE id = ?").get(market_id);
  if (!market) throw new Error("Market not found");
  if (market.status !== "open") throw new Error(`Market is ${market.status}`);
  if (new Date(market.closes_at) < new Date()) {
    db.prepare("UPDATE prediction_markets SET status = 'closed' WHERE id = ?").run(market_id);
    throw new Error("Betting is closed");
  }

  const outcomes = JSON.parse(market.outcomes);
  if (!outcomes.includes(outcome)) throw new Error(`Invalid outcome. Choose: ${outcomes.join(", ")}`);
  if (amount_usd < market.min_bet_usd) throw new Error(`Minimum bet is $${market.min_bet_usd}`);
  if (amount_usd > market.max_bet_usd) throw new Error(`Maximum bet is $${market.max_bet_usd}`);

  const id = uuid();

  // Calculate current odds
  const bets = db.prepare("SELECT outcome, SUM(amount_usd) as total FROM prediction_bets WHERE market_id = ? AND status = 'active' GROUP BY outcome").all(market_id);
  const totalPool = bets.reduce((s, b) => s + b.total, 0) + amount_usd;
  const outcomePool = (bets.find(b => b.outcome === outcome)?.total || 0) + amount_usd;
  const odds = totalPool / outcomePool;
  const potential_payout = amount_usd * odds;

  db.prepare(`
    INSERT INTO prediction_bets (id, market_id, agent_id, outcome, amount_usd, potential_payout_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, market_id, agent_id, outcome, amount_usd, Math.round(potential_payout * 100) / 100);

  // Update market pool
  db.prepare("UPDATE prediction_markets SET total_pool_usd = total_pool_usd + ? WHERE id = ?").run(amount_usd, market_id);

  // Record on-chain escrow
  let onchain = null;
  try { onchain = await recordEscrowLock(`pred-${id}`, agent_id, amount_usd); } catch {}

  return {
    bet_id: id, market_id, outcome, amount_usd,
    potential_payout_usd: Math.round(potential_payout * 100) / 100,
    current_odds: Math.round(odds * 100) / 100,
    total_pool_usd: totalPool,
    onchain,
  };
}

/**
 * Get market details with current odds
 */
export function getMarket(market_id) {
  const market = db.prepare("SELECT * FROM prediction_markets WHERE id = ?").get(market_id);
  if (!market) return null;

  const bets = db.prepare(`
    SELECT outcome, COUNT(*) as bet_count, SUM(amount_usd) as total_usd
    FROM prediction_bets WHERE market_id = ? AND status = 'active'
    GROUP BY outcome
  `).all(market_id);

  const outcomes = JSON.parse(market.outcomes);
  const odds = {};
  const pool = market.total_pool_usd || 0.01;

  for (const o of outcomes) {
    const bet = bets.find(b => b.outcome === o);
    const outcomeTotal = bet?.total_usd || 0;
    odds[o] = {
      total_bet_usd: outcomeTotal,
      bet_count: bet?.bet_count || 0,
      implied_probability: Math.round((outcomeTotal / pool) * 10000) / 100,
      payout_multiplier: outcomeTotal > 0 ? Math.round((pool / outcomeTotal) * 100) / 100 : null,
    };
  }

  return { ...market, outcomes: JSON.parse(market.outcomes), odds, fee_rate: MARKET_FEE_RATE };
}

/**
 * Resolve a market — submit the winning outcome
 */
export function resolveMarket(market_id, winning_outcome, resolver_agent_id) {
  const market = db.prepare("SELECT * FROM prediction_markets WHERE id = ?").get(market_id);
  if (!market) throw new Error("Market not found");
  if (market.status !== "open" && market.status !== "closed") throw new Error(`Market is ${market.status}`);

  const outcomes = JSON.parse(market.outcomes);
  if (!outcomes.includes(winning_outcome)) throw new Error(`Invalid outcome: ${winning_outcome}`);

  const dispute_deadline = new Date(Date.now() + DISPUTE_WINDOW_MINUTES * 60000).toISOString();

  db.prepare(`
    UPDATE prediction_markets SET status = 'resolving', winning_outcome = ?, dispute_deadline = ?
    WHERE id = ?
  `).run(winning_outcome, dispute_deadline, market_id);

  return {
    market_id, winning_outcome, status: "resolving",
    dispute_deadline,
    message: `Market resolved as "${winning_outcome}". Dispute window open for ${DISPUTE_WINDOW_MINUTES} minutes.`,
  };
}

/**
 * Settle a market — distribute winnings after dispute window
 */
export async function settleMarket(market_id) {
  const market = db.prepare("SELECT * FROM prediction_markets WHERE id = ?").get(market_id);
  if (!market) throw new Error("Market not found");
  if (market.status !== "resolving") throw new Error(`Market is ${market.status}, not resolving`);

  // Check dispute window
  const openDisputes = db.prepare(
    "SELECT COUNT(*) as count FROM prediction_disputes WHERE market_id = ? AND status = 'open'"
  ).get(market_id).count;

  if (openDisputes > 0) throw new Error("Cannot settle: open disputes exist");

  const fee = Math.round(market.total_pool_usd * MARKET_FEE_RATE * 100) / 100;
  const distributablePool = market.total_pool_usd - fee;

  // Get winning bets
  const winners = db.prepare(
    "SELECT * FROM prediction_bets WHERE market_id = ? AND outcome = ? AND status = 'active'"
  ).all(market_id, market.winning_outcome);

  const totalWinningBets = winners.reduce((s, b) => s + b.amount_usd, 0);

  // Distribute proportionally
  const payouts = [];
  for (const bet of winners) {
    const share = bet.amount_usd / totalWinningBets;
    const payout = Math.round(distributablePool * share * 100) / 100;

    db.prepare("UPDATE prediction_bets SET status = 'won', payout_usd = ? WHERE id = ?").run(payout, bet.id);

    // On-chain payout
    let onchain = null;
    try { onchain = await recordEscrowRelease(`pred-${bet.id}`, bet.agent_id, payout, fee * share); } catch {}

    payouts.push({ agent_id: bet.agent_id, bet_amount: bet.amount_usd, payout_usd: payout, onchain });
  }

  // Mark losers
  db.prepare("UPDATE prediction_bets SET status = 'lost', payout_usd = 0 WHERE market_id = ? AND outcome != ? AND status = 'active'")
    .run(market_id, market.winning_outcome);

  // Update market
  db.prepare("UPDATE prediction_markets SET status = 'settled', fee_usd = ?, settled_at = datetime('now') WHERE id = ?")
    .run(fee, market_id);

  return {
    market_id,
    status: "settled",
    winning_outcome: market.winning_outcome,
    total_pool_usd: market.total_pool_usd,
    fee_usd: fee,
    distributed_usd: distributablePool,
    winners: payouts.length,
    payouts,
  };
}

/**
 * Dispute a market resolution
 */
export function disputeResolution(market_id, agent_id, reason, proposed_outcome) {
  const market = db.prepare("SELECT * FROM prediction_markets WHERE id = ?").get(market_id);
  if (!market) throw new Error("Market not found");
  if (market.status !== "resolving") throw new Error("Market is not in resolution phase");

  // Check agent has a bet in this market
  const hasBet = db.prepare("SELECT id FROM prediction_bets WHERE market_id = ? AND agent_id = ?").get(market_id, agent_id);
  if (!hasBet) throw new Error("Only participants can dispute");

  const id = uuid();
  db.prepare(`
    INSERT INTO prediction_disputes (id, market_id, disputer_agent_id, reason, proposed_outcome)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, market_id, agent_id, reason, proposed_outcome || null);

  db.prepare("UPDATE prediction_markets SET status = 'disputed' WHERE id = ?").run(market_id);

  return { dispute_id: id, market_id, status: "disputed", reason };
}

/**
 * Vote on a dispute
 */
export function voteOnDispute(dispute_id, agent_id, vote, stake_usd = 0) {
  if (!["for", "against"].includes(vote)) throw new Error("Vote must be 'for' or 'against'");

  const id = uuid();
  try {
    db.prepare(`
      INSERT INTO prediction_votes (id, dispute_id, agent_id, vote, stake_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, dispute_id, agent_id, vote, stake_usd);
  } catch {
    throw new Error("Agent has already voted on this dispute");
  }

  // Update vote counts
  const col = vote === "for" ? "votes_for" : "votes_against";
  db.prepare(`UPDATE prediction_disputes SET ${col} = ${col} + 1 WHERE id = ?`).run(dispute_id);

  const dispute = db.prepare("SELECT * FROM prediction_disputes WHERE id = ?").get(dispute_id);
  return { dispute_id, vote, votes_for: dispute.votes_for, votes_against: dispute.votes_against };
}

// ─── Queries ─────────────────────────────────────

export function getOpenMarkets({ category, limit = 20 } = {}) {
  let sql = "SELECT * FROM prediction_markets WHERE status = 'open' AND closes_at > datetime('now')";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY total_pool_usd DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function getAgentBets(agent_id) {
  return db.prepare(`
    SELECT b.*, m.question, m.status as market_status, m.winning_outcome
    FROM prediction_bets b JOIN prediction_markets m ON b.market_id = m.id
    WHERE b.agent_id = ? ORDER BY b.created_at DESC
  `).all(agent_id);
}

export function getPredictionStats() {
  const markets = db.prepare("SELECT COUNT(*) as count FROM prediction_markets").get().count;
  const openMarkets = db.prepare("SELECT COUNT(*) as count FROM prediction_markets WHERE status = 'open'").get().count;
  const totalVolume = db.prepare("SELECT COALESCE(SUM(total_pool_usd), 0) as total FROM prediction_markets").get().total;
  const totalFees = db.prepare("SELECT COALESCE(SUM(fee_usd), 0) as total FROM prediction_markets WHERE status = 'settled'").get().total;
  const totalBets = db.prepare("SELECT COUNT(*) as count FROM prediction_bets").get().count;
  const disputes = db.prepare("SELECT COUNT(*) as count FROM prediction_disputes").get().count;

  return { total_markets: markets, open_markets: openMarkets, total_volume_usd: totalVolume, total_fees_usd: totalFees, total_bets: totalBets, total_disputes: disputes };
}
