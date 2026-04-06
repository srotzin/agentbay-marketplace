import { v4 as uuid } from "uuid";
import db from "../db.js";

const TRADE_COMMISSION_RATE = 0.02;  // 2% on every RWA trade
const YIELD_COMMISSION_RATE = 0.05;  // 5% of yield distributions

// ─── Schema Initialization ───────────────────────────

export function initRWATables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rwa_assets (
      id TEXT PRIMARY KEY,
      issuer_agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('real_estate','commodity','bond','art','equity','carbon_credit','intellectual_property','invoice','collectible')),
      underlying_value_usd REAL NOT NULL,
      total_tokens INTEGER NOT NULL,
      tokens_available INTEGER NOT NULL,
      price_per_token REAL NOT NULL,
      min_investment_usd REAL DEFAULT 1.0,
      yield_pct REAL,
      yield_frequency TEXT CHECK(yield_frequency IN ('monthly','quarterly','annually')),
      legal_entity TEXT,
      jurisdiction TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('draft','active','sold_out','delisted')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rwa_holdings (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES rwa_assets(id),
      holder_agent_id TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      invested_usd REAL NOT NULL,
      yield_earned_usd REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rwa_trades (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      seller_agent_id TEXT,
      buyer_agent_id TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      price_per_token REAL NOT NULL,
      total_usd REAL NOT NULL,
      commission_usd REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rwa_yield_payments (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      holder_agent_id TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      period TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  _seedAssets();
}

function _seedAssets() {
  const count = db.prepare("SELECT COUNT(*) as n FROM rwa_assets").get()?.n ?? 0;
  if (count > 0) return;

  const SYSTEM_ISSUER = "hiveagent_system";
  const assets = [
    {
      name: "Manhattan Office Building",
      description: "Class A commercial real estate in Midtown Manhattan, fully leased to Fortune 500 tenants.",
      asset_type: "real_estate",
      underlying_value_usd: 50_000_000,
      total_tokens: 50000,
      price_per_token: 1000,
      yield_pct: 6.2,
      yield_frequency: "quarterly",
      jurisdiction: "US",
      legal_entity: "NYC Office REIT LLC",
    },
    {
      name: "Gold Bullion Fund",
      description: "Physically-backed gold bullion stored in Zurich vaults. LBMA-certified bars.",
      asset_type: "commodity",
      underlying_value_usd: 10_000_000,
      total_tokens: 100000,
      price_per_token: 100,
      yield_pct: 0,
      yield_frequency: null,
      jurisdiction: "CH",
      legal_entity: "Swiss Gold Trust AG",
    },
    {
      name: "US Treasury Bond Pool",
      description: "Diversified pool of US Treasury bonds with 2-5 year maturities.",
      asset_type: "bond",
      underlying_value_usd: 25_000_000,
      total_tokens: 250000,
      price_per_token: 100,
      yield_pct: 4.8,
      yield_frequency: "monthly",
      jurisdiction: "US",
      legal_entity: "TreasuryPool SPV LLC",
    },
    {
      name: "Blue-chip Art Collection",
      description: "Curated collection of works by Basquiat, Koons, and Hirst. Stored at Freeport Geneva.",
      asset_type: "art",
      underlying_value_usd: 5_000_000,
      total_tokens: 50000,
      price_per_token: 100,
      yield_pct: 0,
      yield_frequency: null,
      jurisdiction: "CH",
      legal_entity: "Art Collection SPV Ltd",
    },
    {
      name: "Solar Farm Revenue Share",
      description: "Revenue-sharing tokens from a 50MW utility-scale solar farm in Texas.",
      asset_type: "real_estate",
      underlying_value_usd: 15_000_000,
      total_tokens: 150000,
      price_per_token: 100,
      yield_pct: 8.5,
      yield_frequency: "monthly",
      jurisdiction: "US",
      legal_entity: "SolarYield Energy LLC",
    },
    {
      name: "Carbon Credit Bundle",
      description: "Verified carbon credits (VCS standard) from reforestation projects in Brazil.",
      asset_type: "carbon_credit",
      underlying_value_usd: 2_000_000,
      total_tokens: 200000,
      price_per_token: 10,
      yield_pct: 0,
      yield_frequency: null,
      jurisdiction: "BR",
      legal_entity: "GreenCarbon Trust",
    },
    {
      name: "Tech Startup Equity",
      description: "Pre-Series B equity stake in a YC-backed AI infrastructure company.",
      asset_type: "equity",
      underlying_value_usd: 3_000_000,
      total_tokens: 30000,
      price_per_token: 100,
      yield_pct: 0,
      yield_frequency: null,
      jurisdiction: "US",
      legal_entity: "TechEquity SPV LLC",
    },
    {
      name: "Invoice Factoring Pool",
      description: "Diversified pool of short-term trade invoices from investment-grade corporates.",
      asset_type: "invoice",
      underlying_value_usd: 5_000_000,
      total_tokens: 50000,
      price_per_token: 100,
      yield_pct: 12,
      yield_frequency: "monthly",
      jurisdiction: "US",
      legal_entity: "InvoicePool Finance LLC",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO rwa_assets
      (id, issuer_agent_id, name, description, asset_type, underlying_value_usd, total_tokens,
       tokens_available, price_per_token, min_investment_usd, yield_pct, yield_frequency,
       legal_entity, jurisdiction, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  for (const a of assets) {
    insert.run(
      uuid(), SYSTEM_ISSUER, a.name, a.description, a.asset_type,
      a.underlying_value_usd, a.total_tokens, a.total_tokens, a.price_per_token,
      a.price_per_token, a.yield_pct ?? null, a.yield_frequency ?? null,
      a.legal_entity ?? null, a.jurisdiction ?? null
    );
  }
}

// ─── Create Asset ────────────────────────────────────

export function createAsset({
  issuer_agent_id,
  name,
  description,
  asset_type,
  underlying_value_usd,
  total_tokens,
  price_per_token,
  min_investment_usd = 1.0,
  yield_pct,
  yield_frequency,
  legal_entity,
  jurisdiction,
  status = "active",
}) {
  if (!issuer_agent_id) throw new Error("issuer_agent_id is required");
  if (!name)            throw new Error("name is required");
  if (!asset_type)      throw new Error("asset_type is required");
  if (underlying_value_usd == null) throw new Error("underlying_value_usd is required");
  if (!total_tokens)    throw new Error("total_tokens is required");
  if (price_per_token == null) throw new Error("price_per_token is required");

  const id = uuid();
  db.prepare(`
    INSERT INTO rwa_assets
      (id, issuer_agent_id, name, description, asset_type, underlying_value_usd, total_tokens,
       tokens_available, price_per_token, min_investment_usd, yield_pct, yield_frequency,
       legal_entity, jurisdiction, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, issuer_agent_id, name, description || null, asset_type,
    underlying_value_usd, total_tokens, total_tokens, price_per_token,
    min_investment_usd, yield_pct ?? null, yield_frequency ?? null,
    legal_entity || null, jurisdiction || null, status
  );

  return { asset_id: id, name, asset_type, total_tokens, price_per_token, status };
}

// ─── Buy Tokens ──────────────────────────────────────

export function buyTokens({ asset_id, buyer_agent_id, tokens }) {
  const asset = db.prepare("SELECT * FROM rwa_assets WHERE id = ?").get(asset_id);
  if (!asset) throw new Error(`Asset ${asset_id} not found`);
  if (asset.status !== "active") throw new Error(`Asset is ${asset.status}`);
  if (asset.tokens_available < tokens) {
    throw new Error(`Only ${asset.tokens_available} tokens available, requested ${tokens}`);
  }

  const total_usd   = asset.price_per_token * tokens;
  const commission  = Math.round(total_usd * TRADE_COMMISSION_RATE * 1e6) / 1e6;

  if (total_usd < asset.min_investment_usd) {
    throw new Error(`Minimum investment is $${asset.min_investment_usd}, order total is $${total_usd}`);
  }

  const trade_id = uuid();
  db.prepare(`
    INSERT INTO rwa_trades (id, asset_id, seller_agent_id, buyer_agent_id, tokens, price_per_token, total_usd, commission_usd)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(trade_id, asset_id, buyer_agent_id, tokens, asset.price_per_token, total_usd, commission);

  // Update or create holding
  const existing = db.prepare("SELECT * FROM rwa_holdings WHERE asset_id = ? AND holder_agent_id = ?").get(asset_id, buyer_agent_id);
  if (existing) {
    db.prepare("UPDATE rwa_holdings SET tokens=tokens+?, invested_usd=invested_usd+? WHERE id=?")
      .run(tokens, total_usd, existing.id);
  } else {
    db.prepare(`
      INSERT INTO rwa_holdings (id, asset_id, holder_agent_id, tokens, invested_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), asset_id, buyer_agent_id, tokens, total_usd);
  }

  // Update asset availability
  const new_available = asset.tokens_available - tokens;
  const new_status    = new_available <= 0 ? "sold_out" : "active";
  db.prepare("UPDATE rwa_assets SET tokens_available=?, status=? WHERE id=?").run(new_available, new_status, asset_id);

  return {
    trade_id,
    asset_id,
    asset_name: asset.name,
    buyer_agent_id,
    tokens_purchased: tokens,
    price_per_token: asset.price_per_token,
    total_usd: Math.round(total_usd * 100) / 100,
    commission_usd: commission,
    net_cost_usd: Math.round((total_usd + commission) * 100) / 100,
    tokens_remaining: new_available,
  };
}

// ─── Sell Tokens ─────────────────────────────────────

export function sellTokens({ asset_id, seller_agent_id, buyer_agent_id, tokens, price_per_token }) {
  const holding = db.prepare("SELECT * FROM rwa_holdings WHERE asset_id = ? AND holder_agent_id = ?")
    .get(asset_id, seller_agent_id);
  if (!holding) throw new Error(`${seller_agent_id} holds no tokens in asset ${asset_id}`);
  if (holding.tokens < tokens) throw new Error(`Agent only holds ${holding.tokens} tokens, cannot sell ${tokens}`);

  const asset       = db.prepare("SELECT * FROM rwa_assets WHERE id = ?").get(asset_id);
  const ppt         = price_per_token ?? asset?.price_per_token ?? 0;
  const total_usd   = ppt * tokens;
  const commission  = Math.round(total_usd * TRADE_COMMISSION_RATE * 1e6) / 1e6;
  const trade_id    = uuid();

  db.prepare(`
    INSERT INTO rwa_trades (id, asset_id, seller_agent_id, buyer_agent_id, tokens, price_per_token, total_usd, commission_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trade_id, asset_id, seller_agent_id, buyer_agent_id, tokens, ppt, total_usd, commission);

  // Update seller holding
  const new_tokens = holding.tokens - tokens;
  if (new_tokens === 0) {
    db.prepare("DELETE FROM rwa_holdings WHERE id=?").run(holding.id);
  } else {
    db.prepare("UPDATE rwa_holdings SET tokens=?, invested_usd=invested_usd-? WHERE id=?")
      .run(new_tokens, (holding.invested_usd / holding.tokens) * tokens, holding.id);
  }

  // Update buyer holding
  const buyer_holding = db.prepare("SELECT * FROM rwa_holdings WHERE asset_id=? AND holder_agent_id=?")
    .get(asset_id, buyer_agent_id);
  if (buyer_holding) {
    db.prepare("UPDATE rwa_holdings SET tokens=tokens+?, invested_usd=invested_usd+? WHERE id=?")
      .run(tokens, total_usd, buyer_holding.id);
  } else {
    db.prepare("INSERT INTO rwa_holdings (id, asset_id, holder_agent_id, tokens, invested_usd) VALUES (?,?,?,?,?)")
      .run(uuid(), asset_id, buyer_agent_id, tokens, total_usd);
  }

  // If sold_out, restore availability on secondary market
  if (asset?.status === "sold_out") {
    db.prepare("UPDATE rwa_assets SET tokens_available=tokens_available+?, status='active' WHERE id=?")
      .run(0, asset_id); // secondary trades don't change primary availability
  }

  return {
    trade_id,
    asset_id,
    seller_agent_id,
    buyer_agent_id,
    tokens_sold: tokens,
    price_per_token: ppt,
    total_usd: Math.round(total_usd * 100) / 100,
    commission_usd: commission,
    net_proceeds_usd: Math.round((total_usd - commission) * 100) / 100,
  };
}

// ─── Distribute Yield ────────────────────────────────

export function distributeYield({ asset_id, period }) {
  const asset = db.prepare("SELECT * FROM rwa_assets WHERE id = ?").get(asset_id);
  if (!asset) throw new Error(`Asset ${asset_id} not found`);
  if (!asset.yield_pct || asset.yield_pct === 0) throw new Error(`Asset ${asset.name} has no yield`);

  const holders = db.prepare("SELECT * FROM rwa_holdings WHERE asset_id = ?").all(asset_id);
  if (holders.length === 0) return { asset_id, distributions: [], total_distributed_usd: 0 };

  // Calculate period yield
  const freq_divisor = asset.yield_frequency === "monthly" ? 12
    : asset.yield_frequency === "quarterly" ? 4
    : 1;
  const period_yield_rate = (asset.yield_pct / 100) / freq_divisor;

  const distributions = [];
  let total_distributed = 0;

  const insertYield = db.prepare(`
    INSERT INTO rwa_yield_payments (id, asset_id, holder_agent_id, amount_usd, period)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const holding of holders) {
    const gross_yield = Math.round(holding.invested_usd * period_yield_rate * 100) / 100;
    const commission  = Math.round(gross_yield * YIELD_COMMISSION_RATE * 1e6) / 1e6;
    const net_yield   = Math.round((gross_yield - commission) * 1e6) / 1e6;

    insertYield.run(uuid(), asset_id, holding.holder_agent_id, net_yield, period || null);
    db.prepare("UPDATE rwa_holdings SET yield_earned_usd=yield_earned_usd+? WHERE id=?")
      .run(net_yield, holding.id);

    distributions.push({
      holder_agent_id: holding.holder_agent_id,
      tokens: holding.tokens,
      gross_yield_usd: gross_yield,
      commission_usd: commission,
      net_yield_usd: net_yield,
    });
    total_distributed += net_yield;
  }

  return {
    asset_id,
    asset_name: asset.name,
    period,
    period_yield_rate: `${(period_yield_rate * 100).toFixed(4)}%`,
    total_holders: holders.length,
    total_distributed_usd: Math.round(total_distributed * 100) / 100,
    distributions,
  };
}

// ─── Get Asset ───────────────────────────────────────

export function getAsset(asset_id) {
  const asset = db.prepare("SELECT * FROM rwa_assets WHERE id = ?").get(asset_id);
  if (!asset) throw new Error(`Asset ${asset_id} not found`);
  const holders       = db.prepare("SELECT COUNT(*) as n FROM rwa_holdings WHERE asset_id=?").get(asset_id).n;
  const recent_trades = db.prepare("SELECT * FROM rwa_trades WHERE asset_id=? ORDER BY created_at DESC LIMIT 10").all(asset_id);
  const total_volume  = db.prepare("SELECT COALESCE(SUM(total_usd),0) as s FROM rwa_trades WHERE asset_id=?").get(asset_id).s;
  return {
    ...asset,
    holder_count: holders,
    tokens_sold: asset.total_tokens - asset.tokens_available,
    pct_sold: Math.round(((asset.total_tokens - asset.tokens_available) / asset.total_tokens) * 10000) / 100,
    total_volume_usd: Math.round(total_volume * 100) / 100,
    recent_trades,
  };
}

// ─── Search Assets ───────────────────────────────────

export function searchAssets({ asset_type, max_price_per_token, min_yield, jurisdiction, status = "active", sort_by = "volume", limit = 20, offset = 0 }) {
  let sql = "SELECT * FROM rwa_assets WHERE 1=1";
  const params = [];

  if (status)              { sql += " AND status = ?"; params.push(status); }
  if (asset_type)          { sql += " AND asset_type = ?"; params.push(asset_type); }
  if (max_price_per_token != null) { sql += " AND price_per_token <= ?"; params.push(max_price_per_token); }
  if (min_yield != null)   { sql += " AND yield_pct >= ?"; params.push(min_yield); }
  if (jurisdiction)        { sql += " AND jurisdiction = ?"; params.push(jurisdiction); }

  const sortMap = {
    volume:     "underlying_value_usd DESC",
    yield:      "yield_pct DESC",
    price:      "price_per_token ASC",
    newest:     "created_at DESC",
    popularity: "(total_tokens - tokens_available) DESC",
  };
  sql += ` ORDER BY ${sortMap[sort_by] || "underlying_value_usd DESC"} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const assets = db.prepare(sql).all(...params);
  return { assets, count: assets.length, limit, offset };
}

// ─── Agent Holdings ──────────────────────────────────

export function getAgentHoldings(holder_agent_id) {
  const holdings = db.prepare("SELECT h.*, a.name as asset_name, a.asset_type, a.price_per_token as current_price, a.yield_pct, a.yield_frequency FROM rwa_holdings h JOIN rwa_assets a ON h.asset_id=a.id WHERE h.holder_agent_id=?").all(holder_agent_id);
  const trades   = db.prepare("SELECT * FROM rwa_trades WHERE buyer_agent_id=? OR seller_agent_id=? ORDER BY created_at DESC LIMIT 20").all(holder_agent_id, holder_agent_id);
  const yield_earned = db.prepare("SELECT COALESCE(SUM(amount_usd),0) as s FROM rwa_yield_payments WHERE holder_agent_id=?").get(holder_agent_id).s;

  const portfolio_value = holdings.reduce((sum, h) => sum + h.tokens * h.current_price, 0);
  const total_invested  = holdings.reduce((sum, h) => sum + h.invested_usd, 0);

  return {
    holdings,
    recent_trades: trades,
    portfolio_value_usd: Math.round(portfolio_value * 100) / 100,
    total_invested_usd:  Math.round(total_invested * 100) / 100,
    total_yield_earned_usd: Math.round(yield_earned * 100) / 100,
    unrealized_pnl_usd: Math.round((portfolio_value - total_invested) * 100) / 100,
  };
}

// ─── RWA Stats ───────────────────────────────────────

export function getRWAStats() {
  const total_assets    = db.prepare("SELECT COUNT(*) as n FROM rwa_assets WHERE status='active'").get().n;
  const total_value     = db.prepare("SELECT COALESCE(SUM(underlying_value_usd),0) as s FROM rwa_assets WHERE status='active'").get().s;
  const total_trades    = db.prepare("SELECT COUNT(*) as n FROM rwa_trades").get().n;
  const total_volume    = db.prepare("SELECT COALESCE(SUM(total_usd),0) as s FROM rwa_trades").get().s;
  const total_commission = db.prepare("SELECT COALESCE(SUM(commission_usd),0) as s FROM rwa_trades").get().s;
  const total_holders   = db.prepare("SELECT COUNT(DISTINCT holder_agent_id) as n FROM rwa_holdings").get().n;
  const total_yield     = db.prepare("SELECT COALESCE(SUM(amount_usd),0) as s FROM rwa_yield_payments").get().s;

  const by_type = db.prepare(`
    SELECT asset_type, COUNT(*) as count, COALESCE(SUM(underlying_value_usd),0) as total_value
    FROM rwa_assets GROUP BY asset_type ORDER BY total_value DESC
  `).all();

  return {
    active_assets: total_assets,
    total_assets_value_usd: Math.round(total_value / 1e6 * 100) / 100 + "M",
    total_trades,
    total_volume_usd: Math.round(total_volume * 100) / 100,
    total_commission_usd: Math.round(total_commission * 100) / 100,
    unique_holders: total_holders,
    total_yield_paid_usd: Math.round(total_yield * 100) / 100,
    trade_commission_rate: `${TRADE_COMMISSION_RATE * 100}%`,
    yield_commission_rate: `${YIELD_COMMISSION_RATE * 100}%`,
    assets_by_type: by_type,
  };
}
