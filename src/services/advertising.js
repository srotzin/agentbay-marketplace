import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue ──────────────────────────────────────────
// 100% of ad spend goes to HiveAgent (Google model)
// Agents pay per impression, per click, or flat daily fee for featured listings

// ─── Schema Init ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ad_campaigns (
    id TEXT PRIMARY KEY,
    advertiser_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    budget_usd REAL NOT NULL,
    spent_usd REAL DEFAULT 0,
    bid_per_impression REAL DEFAULT 0.001,
    bid_per_click REAL DEFAULT 0.01,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    targeting TEXT DEFAULT '{}',
    start_at TEXT DEFAULT (datetime('now')),
    end_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ad_impressions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT REFERENCES ad_campaigns(id),
    viewer_agent_id TEXT,
    context TEXT,
    cost_usd REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ad_clicks (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES ad_campaigns(id),
    clicker_agent_id TEXT NOT NULL,
    cost_usd REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS featured_listings (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    listing_type TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    fee_usd_daily REAL NOT NULL,
    position INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    started_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  );
`);

// ─── Create Campaign ──────────────────────────────────

export function createCampaign({
  advertiser_agent_id,
  name,
  target_type,
  target_id,
  budget_usd,
  bid_per_impression = 0.001,
  bid_per_click = 0.01,
  targeting = {},
  end_at,
}) {
  const validTypes = ["service", "agent", "listing", "pool", "token", "dataset"];
  if (!validTypes.includes(target_type)) {
    throw new Error(`target_type must be one of: ${validTypes.join(", ")}`);
  }
  if (budget_usd <= 0) throw new Error("budget_usd must be positive");
  if (bid_per_impression < 0) throw new Error("bid_per_impression must be >= 0");
  if (bid_per_click < 0) throw new Error("bid_per_click must be >= 0");

  const id = uuid();
  db.prepare(`
    INSERT INTO ad_campaigns
      (id, advertiser_agent_id, name, target_type, target_id, budget_usd,
       bid_per_impression, bid_per_click, targeting, end_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, advertiser_agent_id, name, target_type, target_id,
    budget_usd, bid_per_impression, bid_per_click,
    JSON.stringify(targeting), end_at || null
  );

  return getCampaign(id);
}

// ─── Record Impression ────────────────────────────────

export function recordImpression({ campaign_id, viewer_agent_id, context }) {
  const campaign = db.prepare("SELECT * FROM ad_campaigns WHERE id = ?").get(campaign_id);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "active") return { recorded: false, reason: "campaign_inactive" };

  const remaining = campaign.budget_usd - campaign.spent_usd;
  if (remaining < campaign.bid_per_impression) {
    db.prepare("UPDATE ad_campaigns SET status = 'exhausted' WHERE id = ?").run(campaign_id);
    return { recorded: false, reason: "budget_exhausted" };
  }

  // Check end_at
  if (campaign.end_at && new Date(campaign.end_at) < new Date()) {
    db.prepare("UPDATE ad_campaigns SET status = 'completed' WHERE id = ?").run(campaign_id);
    return { recorded: false, reason: "campaign_ended" };
  }

  const cost = campaign.bid_per_impression;

  db.prepare(`
    INSERT INTO ad_impressions (campaign_id, viewer_agent_id, context, cost_usd)
    VALUES (?, ?, ?, ?)
  `).run(campaign_id, viewer_agent_id || null, context || null, cost);

  const newSpent = campaign.spent_usd + cost;
  const newStatus = newSpent >= campaign.budget_usd ? "exhausted" : "active";

  db.prepare(`
    UPDATE ad_campaigns
    SET spent_usd = ?, impressions = impressions + 1, status = ?
    WHERE id = ?
  `).run(newSpent, newStatus, campaign_id);

  return { recorded: true, cost_usd: cost, impressions: campaign.impressions + 1 };
}

// ─── Record Click ─────────────────────────────────────

export function recordClick({ campaign_id, clicker_agent_id }) {
  const campaign = db.prepare("SELECT * FROM ad_campaigns WHERE id = ?").get(campaign_id);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "active") return { recorded: false, reason: "campaign_inactive" };

  const remaining = campaign.budget_usd - campaign.spent_usd;
  if (remaining < campaign.bid_per_click) {
    db.prepare("UPDATE ad_campaigns SET status = 'exhausted' WHERE id = ?").run(campaign_id);
    return { recorded: false, reason: "budget_exhausted" };
  }

  const cost = campaign.bid_per_click;
  const clickId = uuid();

  db.prepare(`
    INSERT INTO ad_clicks (id, campaign_id, clicker_agent_id, cost_usd)
    VALUES (?, ?, ?, ?)
  `).run(clickId, campaign_id, clicker_agent_id, cost);

  const newSpent = campaign.spent_usd + cost;
  const newStatus = newSpent >= campaign.budget_usd ? "exhausted" : "active";

  db.prepare(`
    UPDATE ad_campaigns
    SET spent_usd = ?, clicks = clicks + 1, status = ?
    WHERE id = ?
  `).run(newSpent, newStatus, campaign_id);

  return { recorded: true, click_id: clickId, cost_usd: cost, clicks: campaign.clicks + 1 };
}

// ─── Get Relevant Ads ─────────────────────────────────

export function getRelevantAds({ context, category, limit = 5 } = {}) {
  // Return active campaigns, biased toward higher bid (auction model)
  // Feature listings always shown first (they paid flat fee for position)
  const now = new Date().toISOString();

  const featured = db.prepare(`
    SELECT fl.*, 'featured' as ad_type
    FROM featured_listings fl
    WHERE fl.status = 'active' AND (fl.expires_at IS NULL OR fl.expires_at > ?)
    ORDER BY fl.position ASC, fl.fee_usd_daily DESC
    LIMIT ?
  `).all(now, Math.ceil(limit / 2));

  let adSql = `
    SELECT ac.*, 'campaign' as ad_type
    FROM ad_campaigns ac
    WHERE ac.status = 'active'
      AND (ac.end_at IS NULL OR ac.end_at > ?)
      AND ac.spent_usd < ac.budget_usd
  `;
  const params = [now];

  if (category) {
    adSql += " AND (ac.targeting LIKE ? OR ac.targeting = '{}')";
    params.push(`%${category}%`);
  }

  // Auction: highest bidder wins (combined impression + click bid as quality score)
  adSql += " ORDER BY (ac.bid_per_click + ac.bid_per_impression * 10) DESC LIMIT ?";
  params.push(limit);

  const campaigns = db.prepare(adSql).all(...params);

  return {
    featured_listings: featured,
    sponsored_campaigns: campaigns,
    total: featured.length + campaigns.length,
  };
}

// ─── Feature Listing ──────────────────────────────────

export function featureListing({ agent_id, listing_type, listing_id, days, fee_usd_daily }) {
  const validTypes = ["service", "agent", "dataset", "token", "pool"];
  if (!validTypes.includes(listing_type)) {
    throw new Error(`listing_type must be one of: ${validTypes.join(", ")}`);
  }
  if (days <= 0) throw new Error("days must be positive");
  if (fee_usd_daily <= 0) throw new Error("fee_usd_daily must be positive");

  const totalFee = days * fee_usd_daily;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  // Position: lower fee = higher position number (lower priority)
  // Top slot = highest daily fee
  const position = db.prepare(
    "SELECT COUNT(*) as cnt FROM featured_listings WHERE status = 'active'"
  ).get()?.cnt || 0;

  const id = uuid();
  db.prepare(`
    INSERT INTO featured_listings (id, agent_id, listing_type, listing_id, fee_usd_daily, position, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, listing_type, listing_id, fee_usd_daily, position, expiresAt);

  return {
    featured_id: id,
    total_fee_usd: totalFee,
    days,
    expires_at: expiresAt,
    position,
  };
}

// ─── Get Campaign ─────────────────────────────────────

export function getCampaign(campaign_id) {
  const campaign = db.prepare("SELECT * FROM ad_campaigns WHERE id = ?").get(campaign_id);
  if (!campaign) return null;

  const ctr = campaign.impressions > 0
    ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
    : 0;

  const cvr = campaign.clicks > 0
    ? ((campaign.conversions / campaign.clicks) * 100).toFixed(2)
    : 0;

  const cpc = campaign.clicks > 0
    ? (campaign.spent_usd / campaign.clicks).toFixed(4)
    : 0;

  return {
    ...campaign,
    targeting: JSON.parse(campaign.targeting || "{}"),
    ctr_pct: parseFloat(ctr),
    cvr_pct: parseFloat(cvr),
    avg_cpc_usd: parseFloat(cpc),
    remaining_budget_usd: campaign.budget_usd - campaign.spent_usd,
  };
}

// ─── Agent Campaigns ──────────────────────────────────

export function getAgentCampaigns(agent_id) {
  const campaigns = db.prepare(`
    SELECT * FROM ad_campaigns WHERE advertiser_agent_id = ? ORDER BY created_at DESC
  `).all(agent_id);

  const featuredListings = db.prepare(`
    SELECT * FROM featured_listings WHERE agent_id = ? ORDER BY started_at DESC
  `).all(agent_id);

  const totalSpent = campaigns.reduce((s, c) => s + c.spent_usd, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget_usd, 0);

  return {
    campaigns: campaigns.map(c => ({
      ...c,
      ctr_pct: c.impressions > 0 ? parseFloat(((c.clicks / c.impressions) * 100).toFixed(2)) : 0,
    })),
    featured_listings: featuredListings,
    total_spent_usd: totalSpent,
    total_budget_usd: totalBudget,
  };
}

// ─── Ad Stats ─────────────────────────────────────────

export function getAdStats() {
  const totalCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM ad_campaigns").get()?.cnt || 0;
  const activeCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM ad_campaigns WHERE status = 'active'").get()?.cnt || 0;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(spent_usd), 0) as total FROM ad_campaigns").get()?.total || 0;
  const totalImpressions = db.prepare("SELECT COALESCE(SUM(impressions), 0) as total FROM ad_campaigns").get()?.total || 0;
  const totalClicks = db.prepare("SELECT COALESCE(SUM(clicks), 0) as total FROM ad_campaigns").get()?.total || 0;
  const totalBudget = db.prepare("SELECT COALESCE(SUM(budget_usd), 0) as total FROM ad_campaigns").get()?.total || 0;
  const featuredActive = db.prepare("SELECT COUNT(*) as cnt FROM featured_listings WHERE status = 'active'").get()?.cnt || 0;
  const featuredRevenue = db.prepare("SELECT COALESCE(SUM(fee_usd_daily), 0) as total FROM featured_listings WHERE status = 'active'").get()?.total || 0;

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

  return {
    total_campaigns: totalCampaigns,
    active_campaigns: activeCampaigns,
    total_revenue_usd: totalRevenue,
    total_budget_committed_usd: totalBudget,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    overall_ctr_pct: parseFloat(ctr),
    active_featured_listings: featuredActive,
    featured_daily_revenue_usd: featuredRevenue,
  };
}
