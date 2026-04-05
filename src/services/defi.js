/**
 * HiveAgent DeFi Hub
 *
 * Agents do DeFi. Swap tokens, provide liquidity, stake, lend, borrow.
 * HiveAgent takes a fee on every action.
 *
 * Modules:
 * 1. TOKEN SWAP — Agent swaps USDC→ETH, BTC→USDC, etc. 0.3% fee.
 * 2. YIELD FARMING — Agents deposit USDC, earn yield. 10% of yield to HiveAgent.
 * 3. LENDING/BORROWING — Agents lend assets, earn interest. 5% of interest.
 * 4. STABLECOIN EXCHANGE — USDC↔USDT↔DAI↔USAT at near-zero slippage. 0.1% fee.
 * 5. PRICE ORACLE — Real-time prices for 1000+ tokens. $0.001/query.
 * 6. PORTFOLIO TRACKING — Track agent holdings across chains.
 *
 * Revenue: Fees on every swap, yield, lend, and borrow action.
 * Volume potential: DeFi does $5-10B/day. Even 0.001% = $50K-100K/day.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS token_swaps (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount REAL NOT NULL,
    to_amount REAL NOT NULL,
    exchange_rate REAL NOT NULL,
    fee_usd REAL NOT NULL,
    fee_pct REAL NOT NULL,
    status TEXT DEFAULT 'completed',
    tx_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS yield_positions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    pool TEXT NOT NULL,              -- 'usdc_lending', 'eth_staking', 'btc_vault', etc.
    token TEXT NOT NULL,
    deposited_amount REAL NOT NULL,
    current_value REAL NOT NULL,
    apy_pct REAL NOT NULL,
    earned_yield REAL DEFAULT 0,
    platform_fee_earned REAL DEFAULT 0, -- HiveAgent's 10% of yield
    status TEXT DEFAULT 'active',    -- 'active', 'withdrawn'
    deposited_at TEXT DEFAULT (datetime('now')),
    withdrawn_at TEXT
  );

  CREATE TABLE IF NOT EXISTS lending_positions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    type TEXT NOT NULL,               -- 'lend' or 'borrow'
    token TEXT NOT NULL,
    amount REAL NOT NULL,
    interest_rate_pct REAL NOT NULL,
    interest_earned REAL DEFAULT 0,
    interest_owed REAL DEFAULT 0,
    collateral_token TEXT,
    collateral_amount REAL,
    platform_fee REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_portfolios (
    agent_id TEXT NOT NULL,
    token TEXT NOT NULL,
    balance REAL DEFAULT 0,
    avg_cost_usd REAL DEFAULT 0,
    current_value_usd REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (agent_id, token)
  );

  CREATE TABLE IF NOT EXISTS stablecoin_swaps (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    from_stable TEXT NOT NULL,
    to_stable TEXT NOT NULL,
    amount REAL NOT NULL,
    fee_usd REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_swaps_agent ON token_swaps(agent_id);
  CREATE INDEX IF NOT EXISTS idx_yield_agent ON yield_positions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_lending_agent ON lending_positions(agent_id);
`);

// ─── Price Oracle (Free APIs) ────────────────────

const PRICE_CACHE = {};
const CACHE_TTL = 60000; // 1 minute

async function getTokenPrice(token) {
  const key = token.toLowerCase();
  const cached = PRICE_CACHE[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.price;

  const tokenMap = {
    btc: "bitcoin", eth: "ethereum", sol: "solana", usdc: "usd-coin",
    usdt: "tether", dai: "dai", matic: "matic-network", avax: "avalanche-2",
    dot: "polkadot", link: "chainlink", uni: "uniswap", aave: "aave",
    doge: "dogecoin", shib: "shiba-inu", bnb: "binancecoin", xrp: "ripple",
    ada: "cardano", atom: "cosmos", near: "near", arb: "arbitrum",
    op: "optimism", base: "base-protocol", apt: "aptos", sui: "sui",
  };

  const cgId = tokenMap[key] || key;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    const data = await res.json();
    const price = data[cgId]?.usd || null;
    if (price) PRICE_CACHE[key] = { price, ts: Date.now() };
    return price;
  } catch { return null; }
}

export async function getPrices(tokens = ["btc", "eth", "sol", "usdc", "usdt"]) {
  const prices = {};
  for (const t of tokens) {
    prices[t.toUpperCase()] = await getTokenPrice(t);
  }
  return { prices, timestamp: new Date().toISOString(), provider: "HiveAgent DeFi" };
}

// ─── Token Swap ──────────────────────────────────

const SWAP_FEE = 0.003; // 0.3%

export async function swapTokens({ agent_id, from_token, to_token, from_amount }) {
  const fromPrice = from_token.toLowerCase() === "usdc" ? 1 : await getTokenPrice(from_token);
  const toPrice = to_token.toLowerCase() === "usdc" ? 1 : await getTokenPrice(to_token);

  if (!fromPrice || !toPrice) throw new Error(`Cannot get price for ${!fromPrice ? from_token : to_token}`);

  const fromValueUsd = from_amount * fromPrice;
  const fee = Math.round(fromValueUsd * SWAP_FEE * 100) / 100;
  const netValueUsd = fromValueUsd - fee;
  const to_amount = Math.round((netValueUsd / toPrice) * 100000000) / 100000000;
  const rate = Math.round((fromPrice / toPrice) * 100000000) / 100000000;

  const id = uuid();
  db.prepare(`
    INSERT INTO token_swaps (id, agent_id, from_token, to_token, from_amount, to_amount, exchange_rate, fee_usd, fee_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, from_token.toUpperCase(), to_token.toUpperCase(), from_amount, to_amount, rate, fee, SWAP_FEE * 100);

  // Update portfolio
  updatePortfolio(agent_id, from_token.toUpperCase(), -from_amount, fromPrice);
  updatePortfolio(agent_id, to_token.toUpperCase(), to_amount, toPrice);

  return {
    swap_id: id, from: `${from_amount} ${from_token.toUpperCase()}`,
    to: `${to_amount} ${to_token.toUpperCase()}`,
    rate, fee_usd: fee, fee_pct: SWAP_FEE * 100,
    provider: "HiveAgent DeFi",
  };
}

// ─── Stablecoin Exchange ─────────────────────────

const STABLE_FEE = 0.001; // 0.1%

export function swapStablecoins({ agent_id, from_stable, to_stable, amount }) {
  const stables = ["USDC", "USDT", "DAI", "USAT", "PYUSD", "BUSD", "TUSD", "FRAX"];
  const from = from_stable.toUpperCase();
  const to = to_stable.toUpperCase();
  if (!stables.includes(from) || !stables.includes(to)) throw new Error(`Supported stablecoins: ${stables.join(", ")}`);

  const fee = Math.round(amount * STABLE_FEE * 100) / 100;
  const netAmount = amount - fee;
  const id = uuid();

  db.prepare("INSERT INTO stablecoin_swaps (id, agent_id, from_stable, to_stable, amount, fee_usd) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, agent_id, from, to, amount, fee);

  return {
    swap_id: id, from: `${amount} ${from}`, to: `${netAmount} ${to}`,
    fee_usd: fee, fee_pct: STABLE_FEE * 100, rate: 1.0000,
    supported: stables, provider: "HiveAgent DeFi",
  };
}

// ─── Yield Farming ───────────────────────────────

const YIELD_POOLS = {
  usdc_lending: { token: "USDC", apy: 7.2, description: "USDC lending pool — earn interest from borrowers" },
  eth_staking: { token: "ETH", apy: 4.1, description: "ETH staking — validator rewards" },
  btc_vault: { token: "BTC", apy: 2.8, description: "BTC vault — CeDeFi yield" },
  sol_staking: { token: "SOL", apy: 6.5, description: "SOL staking — network rewards" },
  usdc_usdt_lp: { token: "USDC/USDT", apy: 12.5, description: "Stablecoin LP — trading fees from swaps" },
  eth_usdc_lp: { token: "ETH/USDC", apy: 18.3, description: "ETH-USDC LP — trading fees + incentives" },
};

const YIELD_PLATFORM_FEE = 0.10; // 10% of yield

export function getYieldPools() {
  return Object.entries(YIELD_POOLS).map(([id, pool]) => ({ pool_id: id, ...pool }));
}

export function depositYield({ agent_id, pool, amount }) {
  const poolInfo = YIELD_POOLS[pool];
  if (!poolInfo) throw new Error(`Unknown pool. Available: ${Object.keys(YIELD_POOLS).join(", ")}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO yield_positions (id, agent_id, pool, token, deposited_amount, current_value, apy_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, pool, poolInfo.token, amount, amount, poolInfo.apy);

  return {
    position_id: id, pool, token: poolInfo.token, deposited: amount,
    apy_pct: poolInfo.apy,
    estimated_daily_yield: Math.round(amount * (poolInfo.apy / 100 / 365) * 100) / 100,
    platform_fee_pct: YIELD_PLATFORM_FEE * 100,
    provider: "HiveAgent DeFi",
  };
}

export function withdrawYield(position_id) {
  const pos = db.prepare("SELECT * FROM yield_positions WHERE id = ?").get(position_id);
  if (!pos) throw new Error("Position not found");
  if (pos.status !== "active") throw new Error("Position already withdrawn");

  const daysHeld = (Date.now() - new Date(pos.deposited_at).getTime()) / 86400000;
  const yieldEarned = Math.round(pos.deposited_amount * (pos.apy_pct / 100) * (daysHeld / 365) * 100) / 100;
  const platformFee = Math.round(yieldEarned * YIELD_PLATFORM_FEE * 100) / 100;
  const netYield = yieldEarned - platformFee;
  const totalPayout = pos.deposited_amount + netYield;

  db.prepare("UPDATE yield_positions SET status = 'withdrawn', earned_yield = ?, platform_fee_earned = ?, current_value = ?, withdrawn_at = datetime('now') WHERE id = ?")
    .run(yieldEarned, platformFee, totalPayout, position_id);

  return { position_id, deposited: pos.deposited_amount, yield_earned: yieldEarned, platform_fee: platformFee, net_yield: netYield, total_payout: totalPayout, days_held: Math.round(daysHeld * 10) / 10 };
}

// ─── Lending/Borrowing ───────────────────────────

const LENDING_RATES = {
  USDC: { lend_apy: 6.8, borrow_apy: 9.2 },
  ETH: { lend_apy: 3.5, borrow_apy: 5.8 },
  BTC: { lend_apy: 2.1, borrow_apy: 4.5 },
  SOL: { lend_apy: 5.2, borrow_apy: 7.8 },
};

const LENDING_FEE = 0.05; // 5% of interest

export function lend({ agent_id, token, amount }) {
  const rates = LENDING_RATES[token.toUpperCase()];
  if (!rates) throw new Error(`Lending not available for ${token}. Available: ${Object.keys(LENDING_RATES).join(", ")}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO lending_positions (id, agent_id, type, token, amount, interest_rate_pct)
    VALUES (?, ?, 'lend', ?, ?, ?)
  `).run(id, agent_id, token.toUpperCase(), amount, rates.lend_apy);

  return {
    position_id: id, type: "lend", token: token.toUpperCase(), amount,
    apy_pct: rates.lend_apy,
    estimated_daily_interest: Math.round(amount * (rates.lend_apy / 100 / 365) * 100) / 100,
    platform_fee_pct: LENDING_FEE * 100,
    provider: "HiveAgent DeFi",
  };
}

export function borrow({ agent_id, token, amount, collateral_token, collateral_amount }) {
  const rates = LENDING_RATES[token.toUpperCase()];
  if (!rates) throw new Error(`Borrowing not available for ${token}`);
  if (!collateral_token || !collateral_amount) throw new Error("Collateral required: collateral_token and collateral_amount");

  const id = uuid();
  db.prepare(`
    INSERT INTO lending_positions (id, agent_id, type, token, amount, interest_rate_pct, collateral_token, collateral_amount)
    VALUES (?, ?, 'borrow', ?, ?, ?, ?, ?)
  `).run(id, agent_id, token.toUpperCase(), amount, rates.borrow_apy, collateral_token.toUpperCase(), collateral_amount);

  return {
    position_id: id, type: "borrow", token: token.toUpperCase(), amount,
    apy_pct: rates.borrow_apy, collateral: `${collateral_amount} ${collateral_token.toUpperCase()}`,
    ltv_max: 0.75, provider: "HiveAgent DeFi",
  };
}

// ─── Portfolio ───────────────────────────────────

function updatePortfolio(agentId, token, amountDelta, priceUsd) {
  const existing = db.prepare("SELECT * FROM agent_portfolios WHERE agent_id = ? AND token = ?").get(agentId, token);
  if (existing) {
    const newBalance = existing.balance + amountDelta;
    db.prepare("UPDATE agent_portfolios SET balance = ?, current_value_usd = ?, updated_at = datetime('now') WHERE agent_id = ? AND token = ?")
      .run(Math.max(0, newBalance), Math.round(Math.max(0, newBalance) * priceUsd * 100) / 100, agentId, token);
  } else if (amountDelta > 0) {
    db.prepare("INSERT INTO agent_portfolios (agent_id, token, balance, avg_cost_usd, current_value_usd) VALUES (?, ?, ?, ?, ?)")
      .run(agentId, token, amountDelta, priceUsd, Math.round(amountDelta * priceUsd * 100) / 100);
  }
}

export function getPortfolio(agentId) {
  const positions = db.prepare("SELECT * FROM agent_portfolios WHERE agent_id = ? AND balance > 0 ORDER BY current_value_usd DESC").all(agentId);
  const totalValue = positions.reduce((s, p) => s + p.current_value_usd, 0);
  return { agent_id: agentId, positions, total_value_usd: Math.round(totalValue * 100) / 100, provider: "HiveAgent DeFi" };
}

// ─── Stats ───────────────────────────────────────

export function getDefiStats() {
  const swapVolume = db.prepare("SELECT COALESCE(SUM(from_amount * exchange_rate), 0) as vol, COALESCE(SUM(fee_usd), 0) as fees FROM token_swaps").get();
  const stableVolume = db.prepare("SELECT COALESCE(SUM(amount), 0) as vol, COALESCE(SUM(fee_usd), 0) as fees FROM stablecoin_swaps").get();
  const yieldTVL = db.prepare("SELECT COALESCE(SUM(current_value), 0) as tvl, COALESCE(SUM(platform_fee_earned), 0) as fees FROM yield_positions WHERE status = 'active'").get();
  const lendingTVL = db.prepare("SELECT COALESCE(SUM(amount), 0) as tvl FROM lending_positions WHERE type = 'lend' AND status = 'active'").get();

  return {
    swaps: { volume_usd: swapVolume.vol, fees_usd: swapVolume.fees },
    stablecoin_exchange: { volume_usd: stableVolume.vol, fees_usd: stableVolume.fees },
    yield_farming: { tvl_usd: yieldTVL.tvl, fees_usd: yieldTVL.fees },
    lending: { tvl_usd: lendingTVL.tvl },
    total_fees_usd: swapVolume.fees + stableVolume.fees + yieldTVL.fees,
    provider: "HiveAgent DeFi",
  };
}
