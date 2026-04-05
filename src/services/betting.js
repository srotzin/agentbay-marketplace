/**
 * HiveAgent Betting Exchange
 *
 * Full sports betting, event betting, and Kalshi-style event contracts.
 * Agents bet against each other. HiveAgent is the house.
 *
 * Types:
 * 1. SPORTS: NFL, NBA, MLB, Soccer, MMA, Tennis, etc.
 * 2. EVENT CONTRACTS (Kalshi-style): "Will Fed raise rates?" "Will X company IPO?"
 * 3. FANTASY/DAILY: Daily fantasy-style contests between agents
 * 4. OVER/UNDER: Numeric predictions with spreads
 * 5. PARLAYS: Chain multiple bets for higher payout
 *
 * Revenue:
 * - 5% vig (juice) on all sports bets
 * - 5% of pot on event contracts
 * - 10% of entry on fantasy contests
 *
 * On-chain: All bets, settlements, and payouts recorded on Base L2
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const SPORTS_VIG = 0.05;       // 5% on sports
const EVENT_FEE = 0.05;        // 5% on event contracts
const FANTASY_FEE = 0.10;      // 10% on fantasy
const PARLAY_FEE = 0.05;       // 5% on parlays

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sportsbooks (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,                  -- 'nfl', 'nba', 'mlb', 'soccer', 'mma', 'tennis', 'custom'
    event_name TEXT NOT NULL,
    event_type TEXT DEFAULT 'moneyline',  -- 'moneyline', 'spread', 'over_under', 'prop', 'futures'
    home TEXT,
    away TEXT,
    description TEXT,
    odds_home REAL,                       -- Decimal odds
    odds_away REAL,
    odds_draw REAL,
    spread REAL,                          -- For spread bets
    total_line REAL,                      -- For over/under
    status TEXT DEFAULT 'open',           -- 'open', 'locked', 'settled', 'cancelled', 'voided'
    result TEXT,                          -- 'home', 'away', 'draw', 'over', 'under', 'push'
    total_wagered_usd REAL DEFAULT 0,
    fee_collected_usd REAL DEFAULT 0,
    starts_at TEXT,                       -- Event start time
    settled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sports_bets (
    id TEXT PRIMARY KEY,
    sportsbook_id TEXT NOT NULL REFERENCES sportsbooks(id),
    agent_id TEXT NOT NULL,
    pick TEXT NOT NULL,                   -- 'home', 'away', 'draw', 'over', 'under'
    amount_usd REAL NOT NULL,
    odds_at_bet REAL NOT NULL,            -- Odds locked in at time of bet
    potential_payout_usd REAL NOT NULL,
    status TEXT DEFAULT 'pending',        -- 'pending', 'won', 'lost', 'push', 'cancelled'
    payout_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Kalshi-style event contracts
  CREATE TABLE IF NOT EXISTS event_contracts (
    id TEXT PRIMARY KEY,
    creator_agent_id TEXT NOT NULL,
    question TEXT NOT NULL,
    category TEXT DEFAULT 'general',      -- 'economics', 'politics', 'tech', 'crypto', 'weather', 'entertainment'
    contract_type TEXT DEFAULT 'binary',  -- 'binary', 'range', 'multi'
    outcomes TEXT DEFAULT '["YES","NO"]',
    yes_price REAL DEFAULT 0.50,          -- Current price of YES contract (0-1.00)
    no_price REAL DEFAULT 0.50,           -- Current price of NO contract (always 1 - yes_price)
    total_volume_usd REAL DEFAULT 0,
    total_contracts INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    winning_outcome TEXT,
    fee_collected_usd REAL DEFAULT 0,
    expires_at TEXT NOT NULL,
    settled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contract_positions (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES event_contracts(id),
    agent_id TEXT NOT NULL,
    position TEXT NOT NULL,               -- 'YES' or 'NO'
    contracts INTEGER NOT NULL,           -- Number of contracts
    avg_price REAL NOT NULL,              -- Average price paid per contract
    total_cost_usd REAL NOT NULL,
    status TEXT DEFAULT 'open',           -- 'open', 'settled'
    payout_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Parlay bets (multi-leg)
  CREATE TABLE IF NOT EXISTS parlays (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    total_stake_usd REAL NOT NULL,
    total_odds REAL NOT NULL,
    potential_payout_usd REAL NOT NULL,
    legs TEXT NOT NULL,                   -- JSON array of bet references
    legs_won INTEGER DEFAULT 0,
    legs_total INTEGER NOT NULL,
    status TEXT DEFAULT 'active',         -- 'active', 'won', 'lost', 'partial'
    payout_usd REAL DEFAULT 0,
    fee_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sportsbooks_sport ON sportsbooks(sport);
  CREATE INDEX IF NOT EXISTS idx_sportsbooks_status ON sportsbooks(status);
  CREATE INDEX IF NOT EXISTS idx_sports_bets_agent ON sports_bets(agent_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_status ON event_contracts(status);
  CREATE INDEX IF NOT EXISTS idx_positions_agent ON contract_positions(agent_id);
`);

// ─── Sports Betting ──────────────────────────────

/**
 * Create a sportsbook event
 */
export function createSportsEvent({
  sport, event_name, event_type = "moneyline",
  home, away, description,
  odds_home, odds_away, odds_draw,
  spread, total_line, starts_at,
}) {
  const id = uuid();
  db.prepare(`
    INSERT INTO sportsbooks (id, sport, event_name, event_type, home, away, description,
      odds_home, odds_away, odds_draw, spread, total_line, starts_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sport, event_name, event_type, home || null, away || null, description || null,
    odds_home || null, odds_away || null, odds_draw || null,
    spread || null, total_line || null, starts_at || null);

  return { event_id: id, sport, event_name, event_type, odds: { home: odds_home, away: odds_away, draw: odds_draw }, status: "open" };
}

/**
 * Place a sports bet
 */
export function placeSportsBet({ event_id, agent_id, pick, amount_usd }) {
  const event = db.prepare("SELECT * FROM sportsbooks WHERE id = ?").get(event_id);
  if (!event) throw new Error("Event not found");
  if (event.status !== "open") throw new Error(`Event is ${event.status}`);

  const oddsMap = { home: event.odds_home, away: event.odds_away, draw: event.odds_draw, over: event.odds_home, under: event.odds_away };
  const odds = oddsMap[pick];
  if (!odds) throw new Error(`Invalid pick: ${pick}. Choose: ${Object.keys(oddsMap).filter(k => oddsMap[k]).join(", ")}`);

  const potential_payout = Math.round(amount_usd * odds * (1 - SPORTS_VIG) * 100) / 100;
  const id = uuid();

  db.prepare(`
    INSERT INTO sports_bets (id, sportsbook_id, agent_id, pick, amount_usd, odds_at_bet, potential_payout_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, event_id, agent_id, pick, amount_usd, odds, potential_payout);

  db.prepare("UPDATE sportsbooks SET total_wagered_usd = total_wagered_usd + ? WHERE id = ?").run(amount_usd, event_id);

  return { bet_id: id, event_id, pick, amount_usd, odds, potential_payout_usd: potential_payout, vig_pct: SPORTS_VIG * 100 };
}

/**
 * Settle a sports event
 */
export function settleSportsEvent(event_id, result) {
  const event = db.prepare("SELECT * FROM sportsbooks WHERE id = ?").get(event_id);
  if (!event) throw new Error("Event not found");

  const bets = db.prepare("SELECT * FROM sports_bets WHERE sportsbook_id = ? AND status = 'pending'").all(event_id);
  let totalPaid = 0;
  let totalFee = 0;

  for (const bet of bets) {
    if (bet.pick === result) {
      db.prepare("UPDATE sports_bets SET status = 'won', payout_usd = ? WHERE id = ?").run(bet.potential_payout_usd, bet.id);
      totalPaid += bet.potential_payout_usd;
    } else if (result === "push") {
      db.prepare("UPDATE sports_bets SET status = 'push', payout_usd = ? WHERE id = ?").run(bet.amount_usd, bet.id);
      totalPaid += bet.amount_usd;
    } else {
      db.prepare("UPDATE sports_bets SET status = 'lost', payout_usd = 0 WHERE id = ?").run(bet.id);
    }
  }

  totalFee = Math.round(event.total_wagered_usd * SPORTS_VIG * 100) / 100;
  db.prepare("UPDATE sportsbooks SET status = 'settled', result = ?, fee_collected_usd = ?, settled_at = datetime('now') WHERE id = ?")
    .run(result, totalFee, event_id);

  return { event_id, result, bets_settled: bets.length, total_paid_usd: totalPaid, fee_collected_usd: totalFee };
}

// ─── Event Contracts (Kalshi-style) ──────────────

/**
 * Create a Kalshi-style event contract
 */
export function createEventContract({
  creator_agent_id, question, category = "general",
  initial_yes_price = 0.50, expires_in_hours = 168,
}) {
  const id = uuid();
  const expires_at = new Date(Date.now() + expires_in_hours * 3600000).toISOString();

  db.prepare(`
    INSERT INTO event_contracts (id, creator_agent_id, question, category, yes_price, no_price, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, creator_agent_id, question, category, initial_yes_price, 1 - initial_yes_price, expires_at);

  return { contract_id: id, question, yes_price: initial_yes_price, no_price: 1 - initial_yes_price, expires_at };
}

/**
 * Buy contracts (YES or NO position)
 * Price is 0.01-0.99 per contract. If you buy YES at $0.60, you pay $0.60 per contract.
 * If YES wins, each contract pays $1.00. Profit = $0.40 per contract.
 */
export function buyContracts({ contract_id, agent_id, position, num_contracts, max_price }) {
  const contract = db.prepare("SELECT * FROM event_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");
  if (contract.status !== "open") throw new Error(`Contract is ${contract.status}`);

  const price = position === "YES" ? contract.yes_price : contract.no_price;
  if (max_price && price > max_price) throw new Error(`Current price $${price} exceeds max price $${max_price}`);

  const total_cost = Math.round(num_contracts * price * 100) / 100;
  const id = uuid();

  db.prepare(`
    INSERT INTO contract_positions (id, contract_id, agent_id, position, contracts, avg_price, total_cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, contract_id, agent_id, position, num_contracts, price, total_cost);

  // Update contract — shift price based on demand
  const yesPositions = db.prepare("SELECT SUM(contracts) as total FROM contract_positions WHERE contract_id = ? AND position = 'YES' AND status = 'open'").get(contract_id).total || 0;
  const noPositions = db.prepare("SELECT SUM(contracts) as total FROM contract_positions WHERE contract_id = ? AND position = 'NO' AND status = 'open'").get(contract_id).total || 0;
  const totalPositions = yesPositions + noPositions || 1;
  const newYesPrice = Math.round((yesPositions / totalPositions) * 100) / 100;

  db.prepare(`
    UPDATE event_contracts SET yes_price = ?, no_price = ?, total_volume_usd = total_volume_usd + ?, total_contracts = total_contracts + ?
    WHERE id = ?
  `).run(Math.max(0.01, Math.min(0.99, newYesPrice)), Math.max(0.01, Math.min(0.99, 1 - newYesPrice)), total_cost, num_contracts, contract_id);

  return {
    position_id: id, contract_id, position, contracts: num_contracts,
    price_per_contract: price, total_cost_usd: total_cost,
    potential_payout_usd: Math.round(num_contracts * 1.00 * (1 - EVENT_FEE) * 100) / 100,
    current_yes_price: Math.max(0.01, Math.min(0.99, newYesPrice)),
    current_no_price: Math.max(0.01, Math.min(0.99, 1 - newYesPrice)),
  };
}

/**
 * Settle an event contract
 */
export function settleEventContract(contract_id, winning_outcome) {
  const contract = db.prepare("SELECT * FROM event_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");

  const positions = db.prepare("SELECT * FROM contract_positions WHERE contract_id = ? AND status = 'open'").all(contract_id);
  let totalFee = 0;

  for (const pos of positions) {
    if (pos.position === winning_outcome) {
      const payout = Math.round(pos.contracts * 1.00 * (1 - EVENT_FEE) * 100) / 100;
      const fee = Math.round(pos.contracts * 1.00 * EVENT_FEE * 100) / 100;
      db.prepare("UPDATE contract_positions SET status = 'settled', payout_usd = ? WHERE id = ?").run(payout, pos.id);
      totalFee += fee;
    } else {
      db.prepare("UPDATE contract_positions SET status = 'settled', payout_usd = 0 WHERE id = ?").run(pos.id);
    }
  }

  db.prepare("UPDATE event_contracts SET status = 'settled', winning_outcome = ?, fee_collected_usd = ?, settled_at = datetime('now') WHERE id = ?")
    .run(winning_outcome, totalFee, contract_id);

  return { contract_id, winning_outcome, positions_settled: positions.length, fee_collected_usd: totalFee };
}

// ─── Parlays ─────────────────────────────────────

/**
 * Create a parlay (multi-leg bet)
 */
export function createParlay({ agent_id, stake_usd, legs }) {
  // legs = [{ event_id, pick }, ...]
  if (!legs || legs.length < 2) throw new Error("Parlay requires at least 2 legs");
  if (legs.length > 12) throw new Error("Maximum 12 legs per parlay");

  let totalOdds = 1;
  const resolvedLegs = [];

  for (const leg of legs) {
    const event = db.prepare("SELECT * FROM sportsbooks WHERE id = ?").get(leg.event_id);
    if (!event) throw new Error(`Event not found: ${leg.event_id}`);
    if (event.status !== "open") throw new Error(`Event ${event.event_name} is ${event.status}`);

    const oddsMap = { home: event.odds_home, away: event.odds_away, draw: event.odds_draw };
    const odds = oddsMap[leg.pick];
    if (!odds) throw new Error(`Invalid pick for ${event.event_name}`);

    totalOdds *= odds;
    resolvedLegs.push({ event_id: leg.event_id, event_name: event.event_name, pick: leg.pick, odds });
  }

  const potential_payout = Math.round(stake_usd * totalOdds * (1 - PARLAY_FEE) * 100) / 100;
  const fee = Math.round(stake_usd * PARLAY_FEE * 100) / 100;
  const id = uuid();

  db.prepare(`
    INSERT INTO parlays (id, agent_id, total_stake_usd, total_odds, potential_payout_usd, legs, legs_total, fee_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, stake_usd, Math.round(totalOdds * 100) / 100, potential_payout, JSON.stringify(resolvedLegs), legs.length, fee);

  return {
    parlay_id: id, stake_usd, total_odds: Math.round(totalOdds * 100) / 100,
    potential_payout_usd: potential_payout, legs: resolvedLegs, fee_usd: fee,
  };
}

// ─── Queries ─────────────────────────────────────

export function getOpenSportsEvents({ sport, limit = 20 } = {}) {
  let sql = "SELECT * FROM sportsbooks WHERE status = 'open'";
  const params = [];
  if (sport) { sql += " AND sport = ?"; params.push(sport); }
  sql += " ORDER BY starts_at ASC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function getOpenContracts({ category, limit = 20 } = {}) {
  let sql = "SELECT * FROM event_contracts WHERE status = 'open' AND expires_at > datetime('now')";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY total_volume_usd DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function getAgentBettingHistory(agent_id) {
  const sports = db.prepare("SELECT b.*, s.event_name, s.sport FROM sports_bets b JOIN sportsbooks s ON b.sportsbook_id = s.id WHERE b.agent_id = ? ORDER BY b.created_at DESC").all(agent_id);
  const contracts = db.prepare("SELECT p.*, c.question FROM contract_positions p JOIN event_contracts c ON p.contract_id = c.id WHERE p.agent_id = ? ORDER BY p.created_at DESC").all(agent_id);
  const parlayBets = db.prepare("SELECT * FROM parlays WHERE agent_id = ? ORDER BY created_at DESC").all(agent_id);
  return { sports_bets: sports, event_contracts: contracts, parlays: parlayBets };
}

export function getBettingStats() {
  const sportsVolume = db.prepare("SELECT COALESCE(SUM(total_wagered_usd), 0) as total FROM sportsbooks").get().total;
  const sportsFees = db.prepare("SELECT COALESCE(SUM(fee_collected_usd), 0) as total FROM sportsbooks WHERE status = 'settled'").get().total;
  const contractVolume = db.prepare("SELECT COALESCE(SUM(total_volume_usd), 0) as total FROM event_contracts").get().total;
  const contractFees = db.prepare("SELECT COALESCE(SUM(fee_collected_usd), 0) as total FROM event_contracts WHERE status = 'settled'").get().total;
  const openEvents = db.prepare("SELECT COUNT(*) as count FROM sportsbooks WHERE status = 'open'").get().count;
  const openContracts = db.prepare("SELECT COUNT(*) as count FROM event_contracts WHERE status = 'open'").get().count;
  const totalBets = db.prepare("SELECT COUNT(*) as count FROM sports_bets").get().count;
  const totalParlays = db.prepare("SELECT COUNT(*) as count FROM parlays").get().count;

  return {
    sports: { volume_usd: sportsVolume, fees_usd: sportsFees, open_events: openEvents, total_bets: totalBets },
    event_contracts: { volume_usd: contractVolume, fees_usd: contractFees, open_contracts: openContracts },
    parlays: { total: totalParlays },
    total_volume_usd: sportsVolume + contractVolume,
    total_fees_usd: sportsFees + contractFees,
  };
}
