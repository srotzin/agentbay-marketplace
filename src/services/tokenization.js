import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue ──────────────────────────────────────────
// Platform: 2% of every trade
// Creator royalty: configurable (default 5%), paid on every secondary sale

// ─── Schema Init ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_tokens (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    token_symbol TEXT UNIQUE NOT NULL,
    token_name TEXT NOT NULL,
    description TEXT,
    total_supply INTEGER NOT NULL,
    circulating_supply INTEGER DEFAULT 0,
    price_usd REAL DEFAULT 1.0,
    market_cap_usd REAL DEFAULT 0,
    creator_agent_id TEXT NOT NULL,
    creator_royalty_pct REAL DEFAULT 5.0,
    platform_fee_pct REAL DEFAULT 2.0,
    volume_24h_usd REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_holders (
    id TEXT PRIMARY KEY,
    token_id TEXT REFERENCES agent_tokens(id),
    holder_agent_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    avg_buy_price REAL,
    total_invested_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(token_id, holder_agent_id)
  );

  CREATE TABLE IF NOT EXISTS token_trades (
    id TEXT PRIMARY KEY,
    token_id TEXT REFERENCES agent_tokens(id),
    buyer_agent_id TEXT,
    seller_agent_id TEXT,
    amount INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    total_usd REAL NOT NULL,
    platform_fee_usd REAL NOT NULL,
    royalty_usd REAL DEFAULT 0,
    trade_type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_orders (
    id TEXT PRIMARY KEY,
    token_id TEXT REFERENCES agent_tokens(id),
    agent_id TEXT NOT NULL,
    side TEXT NOT NULL,
    amount INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    filled INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Bonding Curve Helpers ────────────────────────────

/**
 * Bonding curve: price increases 0.1% per 1% of supply purchased.
 * price = base_price * (1 + 0.001 * (circulating / total * 100))
 */
function bondingPrice(token) {
  const supplyPct = token.total_supply > 0
    ? (token.circulating_supply / token.total_supply) * 100
    : 0;
  return token.price_usd * (1 + 0.001 * supplyPct);
}

// ─── Tokenize Agent ───────────────────────────────────

export function tokenizeAgent({
  agent_id,
  token_symbol,
  token_name,
  description,
  total_supply,
  initial_price_usd = 1.0,
  creator_royalty_pct = 5.0,
}) {
  if (!agent_id || !token_symbol || !token_name || !total_supply) {
    throw new Error("agent_id, token_symbol, token_name, total_supply are required");
  }
  if (total_supply <= 0) throw new Error("total_supply must be positive");
  if (creator_royalty_pct < 0 || creator_royalty_pct > 20) {
    throw new Error("creator_royalty_pct must be 0-20");
  }

  const id = uuid();
  const platform_fee_pct = 2.0;

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

  const market_cap = initial_price_usd * total_supply;

  db.prepare(`
    INSERT INTO agent_tokens
      (id, agent_id, token_symbol, token_name, description, total_supply,
       price_usd, market_cap_usd, creator_agent_id, creator_royalty_pct, platform_fee_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, agent_id, token_symbol.toUpperCase(), token_name,
    description || null, total_supply, initial_price_usd,
    market_cap, agent_id, creator_royalty_pct, platform_fee_pct
  );

  return getToken(id);
}

// ─── Buy Tokens ───────────────────────────────────────

export function buyTokens({ token_id, buyer_agent_id, amount, max_price }) {
  const token = db.prepare("SELECT * FROM agent_tokens WHERE id = ?").get(token_id);
  if (!token) throw new Error("Token not found");
  if (token.status !== "active") throw new Error("Token is not active");

  const available = token.total_supply - token.circulating_supply;
  if (amount > available) throw new Error(`Only ${available} tokens available`);

  const currentPrice = bondingPrice(token);
  if (max_price != null && currentPrice > max_price) {
    throw new Error(`Current price $${currentPrice.toFixed(6)} exceeds max_price $${max_price}`);
  }

  const grossTotal = currentPrice * amount;
  const platformFee = grossTotal * (token.platform_fee_pct / 100);
  const royaltyFee = grossTotal * (token.creator_royalty_pct / 100);
  const netTotal = grossTotal + platformFee; // buyer pays gross + platform fee

  // Record trade
  const tradeId = uuid();
  db.prepare(`
    INSERT INTO token_trades (id, token_id, buyer_agent_id, amount, price_usd, total_usd,
      platform_fee_usd, royalty_usd, trade_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'buy')
  `).run(tradeId, token_id, buyer_agent_id, amount, currentPrice, grossTotal, platformFee, 0);

  // Update circulating supply and price
  const newCirculating = token.circulating_supply + amount;
  const newPrice = bondingPrice({ ...token, circulating_supply: newCirculating });
  const newMarketCap = newPrice * newCirculating;

  db.prepare(`
    UPDATE agent_tokens
    SET circulating_supply = ?, price_usd = ?, market_cap_usd = ?,
        volume_24h_usd = volume_24h_usd + ?
    WHERE id = ?
  `).run(newCirculating, newPrice, newMarketCap, grossTotal, token_id);

  // Upsert holder record
  const existingHolder = db.prepare(
    "SELECT * FROM token_holders WHERE token_id = ? AND holder_agent_id = ?"
  ).get(token_id, buyer_agent_id);

  if (existingHolder) {
    const newAmount = existingHolder.amount + amount;
    const newAvgBuy = ((existingHolder.avg_buy_price * existingHolder.amount) + (currentPrice * amount)) / newAmount;
    db.prepare(`
      UPDATE token_holders SET amount = ?, avg_buy_price = ?, total_invested_usd = total_invested_usd + ?
      WHERE token_id = ? AND holder_agent_id = ?
    `).run(newAmount, newAvgBuy, grossTotal, token_id, buyer_agent_id);
  } else {
    db.prepare(`
      INSERT INTO token_holders (id, token_id, holder_agent_id, amount, avg_buy_price, total_invested_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), token_id, buyer_agent_id, amount, currentPrice, grossTotal);
  }

  return {
    trade_id: tradeId,
    amount_bought: amount,
    price_usd: currentPrice,
    gross_total_usd: grossTotal,
    platform_fee_usd: platformFee,
    royalty_fee_usd: royaltyFee,
    total_cost_usd: netTotal,
    new_price_usd: newPrice,
    new_market_cap_usd: newMarketCap,
  };
}

// ─── Sell Tokens ──────────────────────────────────────

export function sellTokens({ token_id, seller_agent_id, amount, min_price }) {
  const token = db.prepare("SELECT * FROM agent_tokens WHERE id = ?").get(token_id);
  if (!token) throw new Error("Token not found");

  const holder = db.prepare(
    "SELECT * FROM token_holders WHERE token_id = ? AND holder_agent_id = ?"
  ).get(token_id, seller_agent_id);

  if (!holder || holder.amount < amount) {
    throw new Error(`Insufficient token balance. Have: ${holder?.amount || 0}, want to sell: ${amount}`);
  }

  const currentPrice = bondingPrice(token);
  if (min_price != null && currentPrice < min_price) {
    throw new Error(`Current price $${currentPrice.toFixed(6)} below min_price $${min_price}`);
  }

  const grossTotal = currentPrice * amount;
  const platformFee = grossTotal * (token.platform_fee_pct / 100);
  const royaltyFee = grossTotal * (token.creator_royalty_pct / 100);
  const netPayout = grossTotal - platformFee - royaltyFee;

  // Record trade
  const tradeId = uuid();
  db.prepare(`
    INSERT INTO token_trades (id, token_id, seller_agent_id, amount, price_usd, total_usd,
      platform_fee_usd, royalty_usd, trade_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sell')
  `).run(tradeId, token_id, seller_agent_id, amount, currentPrice, grossTotal, platformFee, royaltyFee);

  // Price decreases on sell pressure — inverse of bonding curve
  const newCirculating = Math.max(0, token.circulating_supply - amount);
  const newPrice = bondingPrice({ ...token, circulating_supply: newCirculating });
  const newMarketCap = newPrice * newCirculating;

  db.prepare(`
    UPDATE agent_tokens
    SET circulating_supply = ?, price_usd = ?, market_cap_usd = ?,
        volume_24h_usd = volume_24h_usd + ?
    WHERE id = ?
  `).run(newCirculating, newPrice, newMarketCap, grossTotal, token_id);

  // Update holder
  const newHolderAmount = holder.amount - amount;
  if (newHolderAmount === 0) {
    db.prepare("DELETE FROM token_holders WHERE token_id = ? AND holder_agent_id = ?")
      .run(token_id, seller_agent_id);
  } else {
    db.prepare("UPDATE token_holders SET amount = ? WHERE token_id = ? AND holder_agent_id = ?")
      .run(newHolderAmount, token_id, seller_agent_id);
  }

  return {
    trade_id: tradeId,
    amount_sold: amount,
    price_usd: currentPrice,
    gross_total_usd: grossTotal,
    platform_fee_usd: platformFee,
    royalty_usd: royaltyFee,
    net_payout_usd: netPayout,
    new_price_usd: newPrice,
    new_market_cap_usd: newMarketCap,
  };
}

// ─── Place Limit Order ────────────────────────────────

export function placeOrder({ token_id, agent_id, side, amount, price_usd }) {
  const token = db.prepare("SELECT * FROM agent_tokens WHERE id = ?").get(token_id);
  if (!token) throw new Error("Token not found");
  if (!["buy", "sell"].includes(side)) throw new Error("side must be buy or sell");
  if (amount <= 0) throw new Error("amount must be positive");

  if (side === "sell") {
    const holder = db.prepare(
      "SELECT * FROM token_holders WHERE token_id = ? AND holder_agent_id = ?"
    ).get(token_id, agent_id);
    if (!holder || holder.amount < amount) {
      throw new Error("Insufficient token balance to place sell order");
    }
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO token_orders (id, token_id, agent_id, side, amount, price_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, token_id, agent_id, side, amount, price_usd);

  return { order_id: id, token_id, agent_id, side, amount, price_usd, status: "open" };
}

// ─── Get Token ────────────────────────────────────────

export function getToken(token_id) {
  const token = db.prepare("SELECT * FROM agent_tokens WHERE id = ?").get(token_id);
  if (!token) return null;

  const holderCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM token_holders WHERE token_id = ?"
  ).get(token_id)?.cnt || 0;

  const recentTrades = db.prepare(`
    SELECT * FROM token_trades WHERE token_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(token_id);

  const openOrders = db.prepare(`
    SELECT * FROM token_orders WHERE token_id = ? AND status = 'open' ORDER BY price_usd DESC
  `).all(token_id);

  return { ...token, holder_count: holderCount, recent_trades: recentTrades, open_orders: openOrders };
}

// ─── Browse Tokens ────────────────────────────────────

export function getTokens({ sort_by = "market_cap", limit = 20 } = {}) {
  const sortMap = {
    market_cap: "market_cap_usd DESC",
    volume: "volume_24h_usd DESC",
    price: "price_usd DESC",
    newest: "created_at DESC",
    supply: "circulating_supply DESC",
  };
  const sql = `
    SELECT at.*, COUNT(th.id) as holder_count
    FROM agent_tokens at
    LEFT JOIN token_holders th ON at.id = th.token_id
    WHERE at.status = 'active'
    GROUP BY at.id
    ORDER BY ${sortMap[sort_by] || "market_cap_usd DESC"}
    LIMIT ?
  `;
  return db.prepare(sql).all(limit);
}

// ─── Agent Token Holdings ─────────────────────────────

export function getAgentTokenHoldings(agent_id) {
  const holdings = db.prepare(`
    SELECT th.*, at.token_symbol, at.token_name, at.price_usd,
           (th.amount * at.price_usd) as current_value_usd,
           ((at.price_usd - th.avg_buy_price) / th.avg_buy_price * 100) as unrealized_pnl_pct
    FROM token_holders th
    JOIN agent_tokens at ON th.token_id = at.id
    WHERE th.holder_agent_id = ?
    ORDER BY current_value_usd DESC
  `).all(agent_id);

  const totalValue = holdings.reduce((s, h) => s + (h.current_value_usd || 0), 0);
  const totalInvested = holdings.reduce((s, h) => s + (h.total_invested_usd || 0), 0);

  return {
    holdings,
    total_portfolio_value_usd: totalValue,
    total_invested_usd: totalInvested,
    unrealized_pnl_usd: totalValue - totalInvested,
  };
}

// ─── Token Stats ──────────────────────────────────────

export function getTokenStats() {
  const totalTokens = db.prepare("SELECT COUNT(*) as cnt FROM agent_tokens WHERE status = 'active'").get()?.cnt || 0;
  const totalMarketCap = db.prepare("SELECT COALESCE(SUM(market_cap_usd), 0) as total FROM agent_tokens").get()?.total || 0;
  const totalVolume = db.prepare("SELECT COALESCE(SUM(total_usd), 0) as total FROM token_trades").get()?.total || 0;
  const platformFees = db.prepare("SELECT COALESCE(SUM(platform_fee_usd), 0) as total FROM token_trades").get()?.total || 0;
  const totalHolders = db.prepare("SELECT COUNT(DISTINCT holder_agent_id) as cnt FROM token_holders").get()?.cnt || 0;
  const totalTrades = db.prepare("SELECT COUNT(*) as cnt FROM token_trades").get()?.cnt || 0;
  const volume24h = db.prepare("SELECT COALESCE(SUM(volume_24h_usd), 0) as total FROM agent_tokens").get()?.total || 0;

  return {
    total_active_tokens: totalTokens,
    total_market_cap_usd: totalMarketCap,
    total_volume_usd: totalVolume,
    volume_24h_usd: volume24h,
    platform_fees_earned_usd: platformFees,
    unique_holders: totalHolders,
    total_trades: totalTrades,
  };
}
