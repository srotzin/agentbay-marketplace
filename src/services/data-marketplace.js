/**
 * HiveAgent Data Marketplace — Phase 51
 *
 * Agents buy and sell datasets, APIs, and live data streams.
 * Peer-to-peer data marketplace with instant access tokens.
 *
 * Types: real-time feeds, historical datasets, on-chain data,
 *        social signals, regulatory filings, supply chain intel.
 *
 * Revenue: HiveAgent takes 15% of every transaction.
 * Sellers keep 85%. Simple. Transparent.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────
const LIVE_MODE = !!process.env.DATA_MARKETPLACE_KEY;

const PLATFORM_FEE_PCT = 0.15; // 15% on all purchases and streams

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS data_marketplace_listings (
    id                TEXT PRIMARY KEY,
    seller_agent_id   TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    data_type         TEXT NOT NULL,
    format            TEXT NOT NULL DEFAULT 'json',
    sample_url        TEXT,
    price_usdc        REAL NOT NULL,
    pricing_model     TEXT NOT NULL DEFAULT 'one_time',
    category          TEXT NOT NULL,
    record_count      INTEGER,
    update_frequency  TEXT,
    quality_score     REAL DEFAULT 8.5,
    active            INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_marketplace_purchases (
    id              TEXT PRIMARY KEY,
    buyer_agent_id  TEXT NOT NULL,
    listing_id      TEXT NOT NULL,
    price_usdc      REAL NOT NULL,
    fee_usdc        REAL NOT NULL,
    access_token    TEXT NOT NULL,
    expires_at      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_marketplace_reviews (
    id              TEXT PRIMARY KEY,
    buyer_agent_id  TEXT NOT NULL,
    listing_id      TEXT NOT NULL,
    rating          INTEGER NOT NULL,
    comment         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_marketplace_streams (
    id                        TEXT PRIMARY KEY,
    seller_agent_id           TEXT NOT NULL,
    buyer_agent_id            TEXT NOT NULL,
    listing_id                TEXT NOT NULL,
    stream_rate_usdc_per_hour REAL NOT NULL,
    status                    TEXT DEFAULT 'active',
    started_at                TEXT,
    total_paid_usdc           REAL DEFAULT 0
  );
`);

// ─── Seed Listings ────────────────────────────────────────────────────────────

const SEED_LISTINGS = [
  {
    id: "dl-weth-wallet-activity",
    seller_agent_id: "hiveagent-data-curator",
    title: "Real-Time WETH Wallet Activity (16x Spike Detection)",
    description: "Live feed of WETH wallet movements with anomaly scoring. Detects 16x+ volume spikes across 50k+ wallets. Ideal for front-running prevention, whale tracking, and DeFi risk management.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.05,
    pricing_model: "per_query",
    category: "financial",
    record_count: null,
    update_frequency: "real_time",
    quality_score: 9.2,
  },
  {
    id: "dl-defi-tvl-feeds",
    seller_agent_id: "hiveagent-data-curator",
    title: "DeFi Protocol TVL Feeds (Top 200 Protocols)",
    description: "Total Value Locked data across Uniswap, Aave, Curve, Compound, MakerDAO and 195 more. Historical + real-time. Updated every 60 seconds.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.02,
    pricing_model: "per_query",
    category: "defi",
    record_count: null,
    update_frequency: "1min",
    quality_score: 9.5,
  },
  {
    id: "dl-agent-tx-patterns",
    seller_agent_id: "hiveagent-data-curator",
    title: "Agent Transaction Patterns Dataset (HiveAgent Network)",
    description: "Anonymized transaction patterns from 100k+ agent interactions on HiveAgent. Features: task types, pricing distributions, settlement times, agent archetypes. Perfect for training agent decision models.",
    data_type: "dataset",
    format: "parquet",
    price_usdc: 10.00,
    pricing_model: "one_time",
    category: "agent_intelligence",
    record_count: 2_500_000,
    update_frequency: "monthly",
    quality_score: 9.0,
  },
  {
    id: "dl-sec-edgar-filings",
    seller_agent_id: "hiveagent-data-curator",
    title: "Regulatory Filings Scrape — SEC EDGAR (Live)",
    description: "Structured data from SEC EDGAR filings: 10-K, 10-Q, 8-K, DEF 14A. Machine-readable JSON with entity extraction. Same-day processing of new filings. Covers all US public companies.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.10,
    pricing_model: "per_query",
    category: "compliance",
    record_count: 4_000_000,
    update_frequency: "daily",
    quality_score: 9.7,
  },
  {
    id: "dl-bridge-flow-data",
    seller_agent_id: "hiveagent-data-curator",
    title: "Cross-Chain Bridge Flow Data (ETH, BSC, Polygon, Arb, OP)",
    description: "Real-time bridge transaction flows across major L1/L2 networks. Track asset migrations, arbitrage opportunities, and liquidity shifts. Covers Stargate, Hop, Across, and 12 more bridges.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.03,
    pricing_model: "per_query",
    category: "blockchain",
    record_count: null,
    update_frequency: "real_time",
    quality_score: 8.9,
  },
  {
    id: "dl-social-sentiment-tokens",
    seller_agent_id: "hiveagent-data-curator",
    title: "Social Sentiment — Top 100 Crypto Tokens (Twitter + Reddit + Telegram)",
    description: "Aggregated social sentiment scores for top 100 tokens by market cap. Covers Twitter, Reddit, Telegram. Sentiment polarity, volume, influencer signal, and 7-day trend. Updated every 15 minutes.",
    data_type: "stream",
    format: "json",
    price_usdc: 0.05,
    pricing_model: "per_hour",
    category: "social",
    record_count: null,
    update_frequency: "15min",
    quality_score: 8.3,
  },
  {
    id: "dl-healthcare-claims",
    seller_agent_id: "hiveagent-data-curator",
    title: "Healthcare Claims Patterns — Anonymized (US, 2018–2024)",
    description: "5M+ anonymized healthcare claims with procedure codes, diagnosis clusters, cost buckets, and regional patterns. Fully de-identified per HIPAA Safe Harbor. For insurance pricing, fraud detection, and population health models.",
    data_type: "dataset",
    format: "csv",
    price_usdc: 50.00,
    pricing_model: "one_time",
    category: "healthcare",
    record_count: 5_200_000,
    update_frequency: "annual",
    quality_score: 9.1,
  },
  {
    id: "dl-real-estate-transactions",
    seller_agent_id: "hiveagent-data-curator",
    title: "Real Estate Transaction Records (US, 2010–2024)",
    description: "12M residential and commercial real estate transactions across 50 US states. Features: price, sq footage, property type, days on market, lender, and school district. Sourced from county deed records.",
    data_type: "dataset",
    format: "parquet",
    price_usdc: 25.00,
    pricing_model: "one_time",
    category: "real_estate",
    record_count: 12_000_000,
    update_frequency: "quarterly",
    quality_score: 9.4,
  },
  {
    id: "dl-supply-chain-delays",
    seller_agent_id: "hiveagent-data-curator",
    title: "Supply Chain Delay Signals (Global Shipping + Port Congestion)",
    description: "Real-time signals for supply chain disruptions: port congestion, vessel delays, customs clearance times, and raw material shortages across 80 major ports. Aggregated from AIS, port authority feeds, and carrier APIs.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.08,
    pricing_model: "per_query",
    category: "logistics",
    record_count: null,
    update_frequency: "hourly",
    quality_score: 8.7,
  },
  {
    id: "dl-patent-filings-uspto",
    seller_agent_id: "hiveagent-data-curator",
    title: "Patent Filings Feed — USPTO Live (US + PCT Applications)",
    description: "Live feed of USPTO patent applications and grants. Structured JSON with claims, abstract, assignee, CPC codes, inventor data, and prior art references. Same-day processing. Full-text search index included.",
    data_type: "real_time_feed",
    format: "json",
    price_usdc: 0.15,
    pricing_model: "per_query",
    category: "ip",
    record_count: 8_000_000,
    update_frequency: "daily",
    quality_score: 9.6,
  },
];

// Seed only if listings table is empty
const existing = db.prepare(`SELECT COUNT(*) as c FROM data_marketplace_listings`).get();
if (existing.c === 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO data_marketplace_listings
      (id, seller_agent_id, title, description, data_type, format, price_usdc, pricing_model, category, record_count, update_frequency, quality_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const l of SEED_LISTINGS) {
    insert.run(l.id, l.seller_agent_id, l.title, l.description, l.data_type, l.format, l.price_usdc, l.pricing_model, l.category, l.record_count ?? null, l.update_frequency, l.quality_score);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function collectPlatformFee(feeUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Data Marketplace Fee] $${Number(feeUsd).toFixed(4)} → CDP treasury ${treasury.slice(0, 8)}… — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usd: feeUsd };
    }
  } catch {}
  console.log(`[Data Marketplace Fee] $${Number(feeUsd).toFixed(4)} logged — ${context}`);
  return { collected: false, fee_usd: feeUsd };
}

function generateAccessToken() {
  return `dmk_${uuid().replace(/-/g, "")}_${Date.now()}`;
}

function scoreSearch(listing, query, category, max_price, data_type) {
  let score = 0;
  const q = (query ?? "").toLowerCase();
  if (q && listing.title.toLowerCase().includes(q))       score += 3;
  if (q && listing.description.toLowerCase().includes(q)) score += 2;
  if (q && listing.category.toLowerCase().includes(q))    score += 1;
  if (category && listing.category === category)          score += 5;
  if (data_type && listing.data_type === data_type)       score += 3;
  if (max_price != null && listing.price_usdc <= max_price) score += 2;
  score += listing.quality_score * 0.5;
  return score;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * listData — seller lists a new dataset
 * @param {object} args  { seller_agent_id, title, description, data_type, price_usdc, pricing_model, category, record_count, update_frequency }
 */
export function listData(args) {
  const {
    seller_agent_id, title, description, data_type,
    price_usdc, pricing_model = "one_time", category,
    record_count, update_frequency = "static",
  } = args;
  if (!seller_agent_id) throw new Error("seller_agent_id required");
  if (!title)           throw new Error("title required");
  if (!description)     throw new Error("description required");
  if (!data_type)       throw new Error("data_type required. Options: dataset, real_time_feed, stream, api");
  if (price_usdc == null) throw new Error("price_usdc required");
  if (!category)        throw new Error("category required");

  const id = uuid();
  db.prepare(`
    INSERT INTO data_marketplace_listings (id, seller_agent_id, title, description, data_type, pricing_model, price_usdc, category, record_count, update_frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, seller_agent_id, title, description, data_type, pricing_model, price_usdc, category, record_count ?? null, update_frequency);

  return {
    listing_id: id,
    seller_agent_id,
    title,
    price_usdc,
    pricing_model,
    category,
    message: "Dataset listed successfully. Buyers can now discover and purchase it.",
    marketplace_url: `https://hiveagent.io/data/${id}`,
  };
}

/**
 * searchData — find datasets in the marketplace
 * @param {object} args  { query, category, max_price_usdc, data_type, limit }
 */
export function searchData(args) {
  const { query, category, max_price_usdc, data_type, limit = 20 } = args;

  const listings = db.prepare(`SELECT * FROM data_marketplace_listings WHERE active = 1`).all();

  const scored = listings
    .map(l => ({ ...l, _score: scoreSearch(l, query, category, max_price_usdc, data_type) }))
    .filter(l => {
      if (max_price_usdc != null && l.price_usdc > max_price_usdc) return false;
      if (category && l.category !== category) return false;
      if (data_type && l.data_type !== data_type) return false;
      return true;
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  return {
    query,
    filters: { category, max_price_usdc, data_type },
    result_count: scored.length,
    results: scored.map(({ _score, ...l }) => ({
      ...l,
      price_label: l.pricing_model === "per_hour"
        ? `$${l.price_usdc}/hr (stream)`
        : l.pricing_model === "per_query"
        ? `$${l.price_usdc}/query`
        : `$${l.price_usdc} one-time`,
    })),
  };
}

/**
 * purchaseData — buy dataset access
 * @param {object} args  { buyer_agent_id, listing_id }
 */
export async function purchaseData(args) {
  const { buyer_agent_id, listing_id } = args;
  if (!buyer_agent_id) throw new Error("buyer_agent_id required");
  if (!listing_id)     throw new Error("listing_id required");

  const listing = db.prepare(`SELECT * FROM data_marketplace_listings WHERE id = ? AND active = 1`).get(listing_id);
  if (!listing) throw new Error(`Listing not found: ${listing_id}`);
  if (listing.pricing_model === "per_hour") throw new Error(`This listing uses hourly streaming. Use streamData() instead.`);

  const fee      = parseFloat((listing.price_usdc * PLATFORM_FEE_PCT).toFixed(4));
  const seller_payout = parseFloat((listing.price_usdc - fee).toFixed(4));
  await collectPlatformFee(fee, `data purchase listing:${listing_id} buyer:${buyer_agent_id}`);

  const access_token = generateAccessToken();
  const expires_at   = listing.pricing_model === "one_time"
    ? null
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h for per_query

  const id = uuid();
  db.prepare(`
    INSERT INTO data_marketplace_purchases (id, buyer_agent_id, listing_id, price_usdc, fee_usdc, access_token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, buyer_agent_id, listing_id, listing.price_usdc, fee, access_token, expires_at);

  return {
    purchase_id: id,
    buyer_agent_id,
    listing_id,
    title: listing.title,
    price_usdc: listing.price_usdc,
    platform_fee_usdc: fee,
    seller_payout_usdc: seller_payout,
    access_token,
    download_url: `https://hiveagent.io/data/download/${listing_id}?token=${access_token}`,
    expires_at: expires_at ?? "never (lifetime access)",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

/**
 * streamData — subscribe to a live data stream (per-hour billing)
 * @param {object} args  { buyer_agent_id, listing_id, duration_hours }
 */
export async function streamData(args) {
  const { buyer_agent_id, listing_id, duration_hours = 1 } = args;
  if (!buyer_agent_id)   throw new Error("buyer_agent_id required");
  if (!listing_id)       throw new Error("listing_id required");
  if (duration_hours < 0.1) throw new Error("duration_hours must be at least 0.1");

  const listing = db.prepare(`SELECT * FROM data_marketplace_listings WHERE id = ? AND active = 1`).get(listing_id);
  if (!listing) throw new Error(`Listing not found: ${listing_id}`);

  const rate_per_hour = listing.pricing_model === "per_hour"
    ? listing.price_usdc
    : listing.price_usdc * 0.1; // 10% of one-time price per hour for non-stream listings

  const total_cost   = parseFloat((rate_per_hour * duration_hours).toFixed(4));
  const fee          = parseFloat((total_cost * PLATFORM_FEE_PCT).toFixed(4));
  await collectPlatformFee(fee, `data stream listing:${listing_id} buyer:${buyer_agent_id} ${duration_hours}h`);

  const stream_id = uuid();
  db.prepare(`
    INSERT INTO data_marketplace_streams (id, seller_agent_id, buyer_agent_id, listing_id, stream_rate_usdc_per_hour, status, started_at, total_paid_usdc)
    VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), ?)
  `).run(stream_id, listing.seller_agent_id, buyer_agent_id, listing_id, rate_per_hour, total_cost);

  const access_token = generateAccessToken();
  const expires_at   = new Date(Date.now() + duration_hours * 3600 * 1000).toISOString();

  return {
    stream_id,
    buyer_agent_id,
    listing_id,
    title: listing.title,
    duration_hours,
    rate_per_hour_usdc: rate_per_hour,
    total_cost_usdc: total_cost,
    platform_fee_usdc: fee,
    access_token,
    stream_url: `wss://hiveagent.io/data/stream/${listing_id}?token=${access_token}`,
    expires_at,
    update_frequency: listing.update_frequency,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

/**
 * getDataMarketplaceDashboard — platform stats, top categories, volume
 */
export function getDataMarketplaceDashboard() {
  const total_listings  = db.prepare(`SELECT COUNT(*) as c FROM data_marketplace_listings WHERE active = 1`).get().c;
  const total_purchases = db.prepare(`SELECT COUNT(*) as c FROM data_marketplace_purchases`).get().c;
  const total_volume    = db.prepare(`SELECT SUM(price_usdc) as s FROM data_marketplace_purchases`).get().s ?? 0;
  const total_fees      = db.prepare(`SELECT SUM(fee_usdc) as s FROM data_marketplace_purchases`).get().s ?? 0;
  const active_streams  = db.prepare(`SELECT COUNT(*) as c FROM data_marketplace_streams WHERE status = 'active'`).get().c;
  const top_categories  = db.prepare(`
    SELECT category, COUNT(*) as listing_count, AVG(quality_score) as avg_quality
    FROM data_marketplace_listings
    WHERE active = 1
    GROUP BY category
    ORDER BY listing_count DESC
    LIMIT 8
  `).all();
  const top_listings    = db.prepare(`
    SELECT id, title, category, price_usdc, pricing_model, quality_score
    FROM data_marketplace_listings
    WHERE active = 1
    ORDER BY quality_score DESC
    LIMIT 5
  `).all();

  return {
    platform: "HiveAgent Data Marketplace",
    mode: LIVE_MODE ? "live" : "simulation",
    stats: {
      total_active_listings: total_listings,
      total_purchases: total_purchases,
      total_volume_usdc: parseFloat(total_volume.toFixed(4)),
      platform_revenue_usdc: parseFloat(total_fees.toFixed(4)),
      active_streams,
      platform_fee: "15% of every transaction",
    },
    top_categories: top_categories.map(c => ({
      category: c.category,
      listing_count: c.listing_count,
      avg_quality: parseFloat(c.avg_quality.toFixed(1)),
    })),
    featured_listings: top_listings,
    pricing_models: ["one_time", "per_query", "per_hour"],
    agent_tip: "Use searchData() to find datasets by category or keyword. Use purchaseData() for one-time or per-query access. Use streamData() for live feeds.",
  };
}
