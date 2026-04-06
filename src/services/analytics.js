import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Tier Definitions ─────────────────────────────────
const TIERS = {
  basic:      { price_usd: 9.99,   label: "Basic"      },
  pro:        { price_usd: 49.99,  label: "Pro"        },
  enterprise: { price_usd: 199.99, label: "Enterprise" },
};

const TIER_RANK = { basic: 1, pro: 2, enterprise: 3 };

function tierRank(tier) { return TIER_RANK[tier] || 0; }

// ─── Schema Init ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_subscriptions (
    id TEXT PRIMARY KEY,
    subscriber_agent_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    price_usd_monthly REAL NOT NULL,
    features TEXT,
    status TEXT DEFAULT 'active',
    started_at TEXT DEFAULT (datetime('now')),
    next_billing TEXT,
    UNIQUE(subscriber_agent_id)
  );

  CREATE TABLE IF NOT EXISTS market_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_type TEXT NOT NULL,
    data TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_insights (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    insight_type TEXT NOT NULL,
    data TEXT NOT NULL,
    period TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Tier Feature Map ─────────────────────────────────
const TIER_FEATURES = {
  basic: [
    "market_overview",
    "top_services",
    "basic_trends",
    "category_breakdown",
  ],
  pro: [
    "market_overview",
    "top_services",
    "basic_trends",
    "category_breakdown",
    "real_time_signals",
    "whale_alerts",
    "agent_behavior_patterns",
    "price_movement_alerts",
    "volume_spike_alerts",
  ],
  enterprise: [
    "market_overview",
    "top_services",
    "basic_trends",
    "category_breakdown",
    "real_time_signals",
    "whale_alerts",
    "agent_behavior_patterns",
    "price_movement_alerts",
    "volume_spike_alerts",
    "full_api_access",
    "custom_reports",
    "predictive_analytics",
    "raw_data_export",
    "agent_insights",
  ],
};

// ─── Subscribe ────────────────────────────────────────

export function subscribeAnalytics({ agent_id, tier }) {
  if (!TIERS[tier]) throw new Error(`tier must be one of: ${Object.keys(TIERS).join(", ")}`);

  const price = TIERS[tier].price_usd;
  const features = TIER_FEATURES[tier];
  const nextBilling = new Date(Date.now() + 30 * 86400000).toISOString();

  // Upsert: upgrade/downgrade allowed
  const existing = db.prepare("SELECT * FROM analytics_subscriptions WHERE subscriber_agent_id = ?").get(agent_id);

  if (existing) {
    db.prepare(`
      UPDATE analytics_subscriptions
      SET tier = ?, price_usd_monthly = ?, features = ?, status = 'active', next_billing = ?
      WHERE subscriber_agent_id = ?
    `).run(tier, price, JSON.stringify(features), nextBilling, agent_id);
  } else {
    const id = uuid();
    db.prepare(`
      INSERT INTO analytics_subscriptions (id, subscriber_agent_id, tier, price_usd_monthly, features, next_billing)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, agent_id, tier, price, JSON.stringify(features), nextBilling);
  }

  return {
    agent_id,
    tier,
    price_usd_monthly: price,
    features,
    next_billing: nextBilling,
    status: "active",
  };
}

// ─── Helper: check subscription ───────────────────────

function getSubscription(agent_id) {
  return db.prepare(
    "SELECT * FROM analytics_subscriptions WHERE subscriber_agent_id = ? AND status = 'active'"
  ).get(agent_id);
}

// ─── Market Overview (free) ───────────────────────────

export function getMarketOverview() {
  // Pull from existing tables — read-only aggregates visible to all
  const serviceStats = (() => {
    try {
      return db.prepare(`
        SELECT category, COUNT(*) as count, AVG(price_usd) as avg_price_usd,
               SUM(total_transactions) as total_transactions
        FROM services WHERE is_active = 1
        GROUP BY category ORDER BY total_transactions DESC LIMIT 10
      `).all();
    } catch { return []; }
  })();

  const topServices = (() => {
    try {
      return db.prepare(`
        SELECT id, name, category, price_usd, rating, total_transactions
        FROM services WHERE is_active = 1
        ORDER BY total_transactions DESC LIMIT 10
      `).all();
    } catch { return []; }
  })();

  const transactionVolume = (() => {
    try {
      return db.prepare(`
        SELECT strftime('%Y-%m-%d', created_at) as date,
               COUNT(*) as count, COALESCE(SUM(amount_usd), 0) as volume_usd
        FROM transactions
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY date ORDER BY date ASC
      `).all();
    } catch { return []; }
  })();

  const capitalStats = (() => {
    try {
      return db.prepare("SELECT COUNT(*) as pools, COALESCE(SUM(total_aum_usd), 0) as total_aum FROM capital_pools").get();
    } catch { return { pools: 0, total_aum: 0 }; }
  })();

  const tokenStats = (() => {
    try {
      return db.prepare("SELECT COUNT(*) as tokens, COALESCE(SUM(market_cap_usd), 0) as total_market_cap FROM agent_tokens WHERE status = 'active'").get();
    } catch { return { tokens: 0, total_market_cap: 0 }; }
  })();

  return {
    as_of: new Date().toISOString(),
    service_categories: serviceStats,
    top_services: topServices,
    transaction_volume_7d: transactionVolume,
    capital: capitalStats,
    tokenization: tokenStats,
    note: "Upgrade to Pro for real-time signals, whale alerts, and deeper analytics.",
  };
}

// ─── Market Signals ───────────────────────────────────

export function getMarketSignals({ agent_id, tier_required = "pro", limit = 50 } = {}) {
  if (agent_id) {
    const sub = getSubscription(agent_id);
    if (!sub || tierRank(sub.tier) < tierRank(tier_required)) {
      throw new Error(`This feature requires a ${tier_required} subscription. Current tier: ${sub?.tier || "none"}`);
    }
  }

  const validTypes = ["info", "notable", "important", "critical"];
  const signals = db.prepare(`
    SELECT * FROM market_signals ORDER BY created_at DESC LIMIT ?
  `).all(limit);

  return signals.map(s => ({ ...s, data: JSON.parse(s.data || "{}") }));
}

// ─── Agent Insights ───────────────────────────────────

export function getAgentInsights({ requesting_agent_id, agent_id, insight_type } = {}) {
  // Enterprise can see any agent's insights; others can only see their own
  if (requesting_agent_id && requesting_agent_id !== agent_id) {
    const sub = getSubscription(requesting_agent_id);
    if (!sub || tierRank(sub.tier) < tierRank("enterprise")) {
      throw new Error("Viewing other agents' insights requires an enterprise subscription");
    }
  }

  let sql = "SELECT * FROM agent_insights WHERE 1=1";
  const params = [];

  if (agent_id) { sql += " AND agent_id = ?"; params.push(agent_id); }
  if (insight_type) { sql += " AND insight_type = ?"; params.push(insight_type); }
  sql += " ORDER BY created_at DESC LIMIT 100";

  const insights = db.prepare(sql).all(...params);
  return insights.map(i => ({ ...i, data: JSON.parse(i.data || "{}") }));
}

// ─── Trending Services ────────────────────────────────

export function getTrendingServices({ period = "7d", limit = 20, agent_id } = {}) {
  // Basic tier and above
  if (agent_id) {
    const sub = getSubscription(agent_id);
    if (!sub) {
      // Still return limited data for free tier (basic overview)
    }
  }

  const periodMap = { "1d": "-1 days", "7d": "-7 days", "30d": "-30 days" };
  const since = periodMap[period] || "-7 days";

  const trendingServices = (() => {
    try {
      return db.prepare(`
        SELECT s.id, s.name, s.category, s.price_usd, s.rating,
               COUNT(t.id) as recent_transactions,
               COALESCE(SUM(t.amount_usd), 0) as recent_volume_usd
        FROM services s
        LEFT JOIN transactions t ON t.service_id = s.id AND t.created_at >= datetime('now', ?)
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY recent_transactions DESC
        LIMIT ?
      `).all(since, limit);
    } catch { return []; }
  })();

  const trendingTokens = (() => {
    try {
      return db.prepare(`
        SELECT id, token_symbol, token_name, price_usd, market_cap_usd, volume_24h_usd
        FROM agent_tokens WHERE status = 'active'
        ORDER BY volume_24h_usd DESC LIMIT 5
      `).all();
    } catch { return []; }
  })();

  return {
    period,
    trending_services: trendingServices,
    trending_tokens: trendingTokens,
    as_of: new Date().toISOString(),
  };
}

// ─── Whale Activity ───────────────────────────────────

export function getWhaleActivity({ agent_id, min_amount = 10000, limit = 20 } = {}) {
  if (agent_id) {
    const sub = getSubscription(agent_id);
    if (!sub || tierRank(sub.tier) < tierRank("pro")) {
      throw new Error("Whale activity requires a pro or enterprise subscription");
    }
  }

  const whaleTransactions = (() => {
    try {
      return db.prepare(`
        SELECT 'transaction' as type, id, amount_usd, created_at, service_id as entity_id
        FROM transactions WHERE amount_usd >= ?
        ORDER BY amount_usd DESC LIMIT ?
      `).all(min_amount, limit);
    } catch { return []; }
  })();

  const whaleTrades = (() => {
    try {
      return db.prepare(`
        SELECT 'token_trade' as type, id, total_usd as amount_usd, created_at, token_id as entity_id
        FROM token_trades WHERE total_usd >= ?
        ORDER BY total_usd DESC LIMIT ?
      `).all(min_amount, limit);
    } catch { return []; }
  })();

  const whaleCapitalMoves = (() => {
    try {
      return db.prepare(`
        SELECT 'capital_investment' as type, id, amount_usd, invested_at as created_at, pool_id as entity_id
        FROM pool_investments WHERE amount_usd >= ?
        ORDER BY amount_usd DESC LIMIT ?
      `).all(min_amount, limit);
    } catch { return []; }
  })();

  const allActivity = [
    ...whaleTransactions,
    ...whaleTrades,
    ...whaleCapitalMoves,
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);

  return {
    min_amount_usd: min_amount,
    whale_activity: allActivity,
    total_events: allActivity.length,
    as_of: new Date().toISOString(),
  };
}

// ─── Record Signal (internal) ─────────────────────────

export function recordSignal({ signal_type, data, severity = "info" }) {
  const validTypes = [
    "price_movement", "volume_spike", "new_listing",
    "trending", "whale_activity", "sentiment_shift",
  ];
  const validSeverities = ["info", "notable", "important", "critical"];

  if (!validTypes.includes(signal_type)) {
    throw new Error(`signal_type must be one of: ${validTypes.join(", ")}`);
  }
  if (!validSeverities.includes(severity)) {
    throw new Error(`severity must be one of: ${validSeverities.join(", ")}`);
  }

  const result = db.prepare(`
    INSERT INTO market_signals (signal_type, data, severity)
    VALUES (?, ?, ?)
  `).run(signal_type, JSON.stringify(data), severity);

  return { signal_id: result.lastInsertRowid, signal_type, severity };
}

// ─── Generate Agent Insights (internal) ───────────────

export function generateInsight({ agent_id, insight_type, data, period }) {
  const validTypes = [
    "spending_pattern", "trading_frequency", "category_preference",
    "peak_hours", "risk_profile",
  ];
  if (!validTypes.includes(insight_type)) {
    throw new Error(`insight_type must be one of: ${validTypes.join(", ")}`);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO agent_insights (id, agent_id, insight_type, data, period)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, agent_id || null, insight_type, JSON.stringify(data), period || null);

  return { insight_id: id };
}

// ─── Analytics Stats ──────────────────────────────────

export function getAnalyticsStats() {
  const totalSubs = db.prepare("SELECT COUNT(*) as cnt FROM analytics_subscriptions WHERE status = 'active'").get()?.cnt || 0;
  const basicSubs = db.prepare("SELECT COUNT(*) as cnt FROM analytics_subscriptions WHERE tier = 'basic' AND status = 'active'").get()?.cnt || 0;
  const proSubs = db.prepare("SELECT COUNT(*) as cnt FROM analytics_subscriptions WHERE tier = 'pro' AND status = 'active'").get()?.cnt || 0;
  const enterpriseSubs = db.prepare("SELECT COUNT(*) as cnt FROM analytics_subscriptions WHERE tier = 'enterprise' AND status = 'active'").get()?.cnt || 0;
  const totalSignals = db.prepare("SELECT COUNT(*) as cnt FROM market_signals").get()?.cnt || 0;
  const totalInsights = db.prepare("SELECT COUNT(*) as cnt FROM agent_insights").get()?.cnt || 0;

  const mrr = (basicSubs * TIERS.basic.price_usd)
            + (proSubs * TIERS.pro.price_usd)
            + (enterpriseSubs * TIERS.enterprise.price_usd);

  const arr = mrr * 12;

  return {
    subscriptions: {
      total: totalSubs,
      basic: basicSubs,
      pro: proSubs,
      enterprise: enterpriseSubs,
    },
    revenue: {
      mrr_usd: parseFloat(mrr.toFixed(2)),
      arr_usd: parseFloat(arr.toFixed(2)),
    },
    data: {
      total_signals: totalSignals,
      total_insights: totalInsights,
    },
    tiers: TIERS,
  };
}
