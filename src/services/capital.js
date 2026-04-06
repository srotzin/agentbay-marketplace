import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Split ────────────────────────────────────
// HiveAgent: 10% of management fees + 5% of performance fees
// Manager keeps: 90% of management fees + 95% of performance fees

const PLATFORM_MGMT_CUT = 0.10;
const PLATFORM_PERF_CUT = 0.05;

// ─── Schema Init ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS capital_pools (
    id TEXT PRIMARY KEY,
    manager_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    strategy TEXT DEFAULT 'balanced',
    total_aum_usd REAL DEFAULT 0,
    investor_count INTEGER DEFAULT 0,
    management_fee_pct REAL DEFAULT 2.0,
    performance_fee_pct REAL DEFAULT 20.0,
    min_investment_usd REAL DEFAULT 100,
    inception_return_pct REAL DEFAULT 0,
    nav_per_share REAL DEFAULT 1.0,
    total_shares REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pool_investments (
    id TEXT PRIMARY KEY,
    pool_id TEXT REFERENCES capital_pools(id),
    investor_agent_id TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    shares REAL NOT NULL,
    entry_nav REAL NOT NULL,
    current_value_usd REAL,
    status TEXT DEFAULT 'active',
    invested_at TEXT DEFAULT (datetime('now')),
    redeemed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pool_trades (
    id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    side TEXT NOT NULL,
    amount REAL NOT NULL,
    price_usd REAL NOT NULL,
    total_usd REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pool_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id TEXT NOT NULL,
    date TEXT NOT NULL,
    nav_per_share REAL NOT NULL,
    daily_return_pct REAL,
    total_return_pct REAL,
    aum_usd REAL
  );

  CREATE TABLE IF NOT EXISTS capital_fees (
    id TEXT PRIMARY KEY,
    pool_id TEXT NOT NULL,
    fee_type TEXT NOT NULL,
    gross_usd REAL NOT NULL,
    platform_usd REAL NOT NULL,
    manager_usd REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Create Pool ──────────────────────────────────────

export function createPool({
  manager_agent_id,
  name,
  description,
  strategy = "balanced",
  management_fee_pct = 2.0,
  performance_fee_pct = 20.0,
  min_investment_usd = 100,
}) {
  const validStrategies = ["conservative", "balanced", "aggressive", "custom"];
  if (!validStrategies.includes(strategy)) {
    throw new Error(`strategy must be one of: ${validStrategies.join(", ")}`);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO capital_pools (id, manager_agent_id, name, description, strategy,
      management_fee_pct, performance_fee_pct, min_investment_usd, nav_per_share)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1.0)
  `).run(
    id, manager_agent_id, name, description || null,
    strategy, management_fee_pct, performance_fee_pct, min_investment_usd
  );

  return getPool(id);
}

// ─── Invest ───────────────────────────────────────────

export function invest({ pool_id, investor_agent_id, amount_usd }) {
  const pool = db.prepare("SELECT * FROM capital_pools WHERE id = ?").get(pool_id);
  if (!pool) throw new Error("Pool not found");
  if (pool.status !== "open") throw new Error("Pool is not accepting investments");
  if (amount_usd < pool.min_investment_usd) {
    throw new Error(`Minimum investment is $${pool.min_investment_usd}`);
  }

  const nav = pool.nav_per_share || 1.0;
  const shares = amount_usd / nav;
  const id = uuid();

  db.prepare(`
    INSERT INTO pool_investments (id, pool_id, investor_agent_id, amount_usd, shares, entry_nav, current_value_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, pool_id, investor_agent_id, amount_usd, shares, nav, amount_usd);

  db.prepare(`
    UPDATE capital_pools
    SET total_aum_usd = total_aum_usd + ?,
        total_shares = total_shares + ?,
        investor_count = investor_count + 1
    WHERE id = ?
  `).run(amount_usd, shares, pool_id);

  return { investment_id: id, shares, entry_nav: nav, amount_usd };
}

// ─── Redeem ───────────────────────────────────────────

export function redeem({ investment_id, agent_id }) {
  const inv = db.prepare("SELECT * FROM pool_investments WHERE id = ?").get(investment_id);
  if (!inv) throw new Error("Investment not found");
  if (inv.investor_agent_id !== agent_id) throw new Error("Not your investment");
  if (inv.status !== "active") throw new Error("Investment already redeemed");

  const pool = db.prepare("SELECT * FROM capital_pools WHERE id = ?").get(inv.pool_id);
  const currentNav = pool.nav_per_share || 1.0;
  const grossValue = inv.shares * currentNav;

  // Performance fee on gains only
  const gain = grossValue - inv.amount_usd;
  let perfFeeTotal = 0;
  let netPayout = grossValue;

  if (gain > 0) {
    perfFeeTotal = gain * (pool.performance_fee_pct / 100);
    const platformPerf = perfFeeTotal * PLATFORM_PERF_CUT;
    const managerPerf = perfFeeTotal * (1 - PLATFORM_PERF_CUT);
    netPayout = grossValue - perfFeeTotal;

    const feeId = uuid();
    db.prepare(`
      INSERT INTO capital_fees (id, pool_id, fee_type, gross_usd, platform_usd, manager_usd)
      VALUES (?, ?, 'performance', ?, ?, ?)
    `).run(feeId, inv.pool_id, perfFeeTotal, platformPerf, managerPerf);
  }

  db.prepare(`
    UPDATE pool_investments
    SET status = 'redeemed', redeemed_at = datetime('now'), current_value_usd = ?
    WHERE id = ?
  `).run(grossValue, investment_id);

  db.prepare(`
    UPDATE capital_pools
    SET total_aum_usd = MAX(0, total_aum_usd - ?),
        total_shares = MAX(0, total_shares - ?),
        investor_count = MAX(0, investor_count - 1)
    WHERE id = ?
  `).run(grossValue, inv.shares, inv.pool_id);

  return {
    investment_id,
    gross_value_usd: grossValue,
    performance_fee_usd: perfFeeTotal,
    net_payout_usd: netPayout,
    gain_usd: gain,
    shares_redeemed: inv.shares,
  };
}

// ─── Record Trade ─────────────────────────────────────

export function recordTrade({ pool_id, asset, side, amount, price_usd }) {
  const pool = db.prepare("SELECT * FROM capital_pools WHERE id = ?").get(pool_id);
  if (!pool) throw new Error("Pool not found");
  if (!["buy", "sell"].includes(side)) throw new Error("side must be buy or sell");

  const total_usd = amount * price_usd;
  const id = uuid();

  db.prepare(`
    INSERT INTO pool_trades (id, pool_id, asset, side, amount, price_usd, total_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, pool_id, asset, side, amount, price_usd, total_usd);

  return { trade_id: id, total_usd };
}

// ─── Update NAV ───────────────────────────────────────

export function updateNAV(pool_id) {
  const pool = db.prepare("SELECT * FROM capital_pools WHERE id = ?").get(pool_id);
  if (!pool) throw new Error("Pool not found");

  // Get trade P&L: sum of sells minus sum of buys as proxy for value change
  const buys = db.prepare(
    "SELECT COALESCE(SUM(total_usd), 0) as total FROM pool_trades WHERE pool_id = ? AND side = 'buy'"
  ).get(pool_id);
  const sells = db.prepare(
    "SELECT COALESCE(SUM(total_usd), 0) as total FROM pool_trades WHERE pool_id = ? AND side = 'sell'"
  ).get(pool_id);

  // Current AUM + realized gains from trading
  const realizedPnl = (sells?.total || 0) - (buys?.total || 0);
  const currentAum = pool.total_aum_usd + realizedPnl;
  const totalShares = pool.total_shares || 1;
  const newNav = totalShares > 0 ? currentAum / totalShares : 1.0;

  const prevNav = pool.nav_per_share || 1.0;
  const dailyReturn = prevNav > 0 ? ((newNav - prevNav) / prevNav) * 100 : 0;
  const inceptionReturn = ((newNav - 1.0) / 1.0) * 100;

  db.prepare(`
    UPDATE capital_pools
    SET nav_per_share = ?, total_aum_usd = ?, inception_return_pct = ?
    WHERE id = ?
  `).run(newNav, currentAum, inceptionReturn, pool_id);

  // Record performance snapshot
  const today = new Date().toISOString().split("T")[0];
  db.prepare(`
    INSERT INTO pool_performance (pool_id, date, nav_per_share, daily_return_pct, total_return_pct, aum_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pool_id, today, newNav, dailyReturn, inceptionReturn, currentAum);

  // Accrue management fee (annual / 365 per NAV update)
  if (pool.total_shares > 0) {
    const dailyMgmtFee = currentAum * (pool.management_fee_pct / 100 / 365);
    const platformMgmt = dailyMgmtFee * PLATFORM_MGMT_CUT;
    const managerMgmt = dailyMgmtFee * (1 - PLATFORM_MGMT_CUT);
    const feeId = uuid();
    db.prepare(`
      INSERT INTO capital_fees (id, pool_id, fee_type, gross_usd, platform_usd, manager_usd)
      VALUES (?, ?, 'management', ?, ?, ?)
    `).run(feeId, pool_id, dailyMgmtFee, platformMgmt, managerMgmt);
  }

  return { pool_id, new_nav: newNav, aum_usd: currentAum, daily_return_pct: dailyReturn };
}

// ─── Get Pool ─────────────────────────────────────────

export function getPool(pool_id) {
  const pool = db.prepare("SELECT * FROM capital_pools WHERE id = ?").get(pool_id);
  if (!pool) return null;

  const perf = db.prepare(`
    SELECT * FROM pool_performance WHERE pool_id = ? ORDER BY date DESC LIMIT 30
  `).all(pool_id);

  const activeInvestors = db.prepare(
    "SELECT COUNT(*) as cnt FROM pool_investments WHERE pool_id = ? AND status = 'active'"
  ).get(pool_id)?.cnt || 0;

  return { ...pool, performance_history: perf, active_investors: activeInvestors };
}

// ─── Browse Pools ─────────────────────────────────────

export function getPools({ strategy, min_aum, sort_by = "aum", limit = 20 } = {}) {
  let sql = "SELECT * FROM capital_pools WHERE status != 'liquidating'";
  const params = [];

  if (strategy) { sql += " AND strategy = ?"; params.push(strategy); }
  if (min_aum != null) { sql += " AND total_aum_usd >= ?"; params.push(min_aum); }

  const sortMap = {
    aum: "total_aum_usd DESC",
    return: "inception_return_pct DESC",
    newest: "created_at DESC",
    fee_low: "management_fee_pct ASC",
    investors: "investor_count DESC",
  };
  sql += ` ORDER BY ${sortMap[sort_by] || "total_aum_usd DESC"} LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params);
}

// ─── Agent Investments ────────────────────────────────

export function getAgentInvestments(agent_id) {
  const investments = db.prepare(`
    SELECT pi.*, cp.name as pool_name, cp.strategy, cp.nav_per_share,
           (pi.shares * cp.nav_per_share) as current_value_usd,
           ((pi.shares * cp.nav_per_share - pi.amount_usd) / pi.amount_usd * 100) as return_pct
    FROM pool_investments pi
    JOIN capital_pools cp ON pi.pool_id = cp.id
    WHERE pi.investor_agent_id = ?
    ORDER BY pi.invested_at DESC
  `).all(agent_id);

  const totalInvested = investments.filter(i => i.status === "active")
    .reduce((s, i) => s + i.amount_usd, 0);
  const totalCurrentValue = investments.filter(i => i.status === "active")
    .reduce((s, i) => s + (i.current_value_usd || 0), 0);

  return { investments, total_invested_usd: totalInvested, total_current_value_usd: totalCurrentValue };
}

// ─── Capital Stats ────────────────────────────────────

export function getCapitalStats() {
  const pools = db.prepare("SELECT COUNT(*) as cnt FROM capital_pools").get()?.cnt || 0;
  const openPools = db.prepare("SELECT COUNT(*) as cnt FROM capital_pools WHERE status = 'open'").get()?.cnt || 0;
  const totalAum = db.prepare("SELECT COALESCE(SUM(total_aum_usd), 0) as total FROM capital_pools").get()?.total || 0;
  const totalInvestors = db.prepare("SELECT COUNT(*) as cnt FROM pool_investments WHERE status = 'active'").get()?.cnt || 0;
  const platformFees = db.prepare("SELECT COALESCE(SUM(platform_usd), 0) as total FROM capital_fees").get()?.total || 0;
  const totalTrades = db.prepare("SELECT COUNT(*) as cnt FROM pool_trades").get()?.cnt || 0;
  const tradeVolume = db.prepare("SELECT COALESCE(SUM(total_usd), 0) as total FROM pool_trades").get()?.total || 0;

  return {
    total_pools: pools,
    open_pools: openPools,
    total_aum_usd: totalAum,
    active_investors: totalInvestors,
    platform_fees_earned_usd: platformFees,
    total_trades: totalTrades,
    total_trade_volume_usd: tradeVolume,
  };
}
