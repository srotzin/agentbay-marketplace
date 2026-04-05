/**
 * HiveAgent NFT & Digital Asset Trading
 *
 * Agents mint, buy, sell, and fractionate NFTs.
 * HiveAgent earns 5% commission on every sale, plus creator royalties flow through the platform.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const PLATFORM_FEE_PCT = 0.05;

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS nfts (
    id TEXT PRIMARY KEY,
    creator_agent_id TEXT NOT NULL,
    owner_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'art',              -- 'art','data','license','service','domain','identity'
    metadata_uri TEXT,
    price_usd REAL DEFAULT 0,
    is_listed INTEGER DEFAULT 0,              -- 0/1 boolean
    is_fractionalized INTEGER DEFAULT 0,      -- 0/1 boolean
    total_fractions INTEGER DEFAULT 0,
    royalty_pct REAL DEFAULT 5,              -- creator royalty on resale
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nft_listings (
    id TEXT PRIMARY KEY,
    nft_id TEXT NOT NULL REFERENCES nfts(id),
    seller_agent_id TEXT NOT NULL,
    price_usd REAL NOT NULL,
    status TEXT DEFAULT 'active',             -- 'active','sold','cancelled'
    listed_at TEXT DEFAULT (datetime('now')),
    sold_at TEXT
  );

  CREATE TABLE IF NOT EXISTS nft_trades (
    id TEXT PRIMARY KEY,
    nft_id TEXT NOT NULL REFERENCES nfts(id),
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    price_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    royalty_usd REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nft_fractions (
    id TEXT PRIMARY KEY,
    nft_id TEXT NOT NULL REFERENCES nfts(id),
    owner_agent_id TEXT NOT NULL,
    fraction_pct REAL NOT NULL,
    acquired_price_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts(owner_agent_id);
  CREATE INDEX IF NOT EXISTS idx_nfts_creator ON nfts(creator_agent_id);
  CREATE INDEX IF NOT EXISTS idx_nfts_category ON nfts(category);
  CREATE INDEX IF NOT EXISTS idx_nfts_listed ON nfts(is_listed);
  CREATE INDEX IF NOT EXISTS idx_nft_listings_nft ON nft_listings(nft_id);
  CREATE INDEX IF NOT EXISTS idx_nft_listings_status ON nft_listings(status);
  CREATE INDEX IF NOT EXISTS idx_nft_trades_nft ON nft_trades(nft_id);
  CREATE INDEX IF NOT EXISTS idx_nft_fractions_nft ON nft_fractions(nft_id);
  CREATE INDEX IF NOT EXISTS idx_nft_fractions_owner ON nft_fractions(owner_agent_id);
`);

// ─── Minting ──────────────────────────────────────

/**
 * Mint a new NFT
 */
export function mintNFT({ creator_agent_id, name, description, category = "art", metadata_uri, royalty_pct = 5 }) {
  if (!creator_agent_id) throw new Error("creator_agent_id is required");
  if (!name) throw new Error("name is required");

  const validCategories = ["art", "data", "license", "service", "domain", "identity"];
  if (!validCategories.includes(category)) {
    throw new Error(`category must be one of: ${validCategories.join(", ")}`);
  }
  if (royalty_pct < 0 || royalty_pct > 50) throw new Error("royalty_pct must be between 0 and 50");

  const id = uuid();
  db.prepare(`
    INSERT INTO nfts (id, creator_agent_id, owner_agent_id, name, description, category, metadata_uri, royalty_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, creator_agent_id, creator_agent_id, name, description || null, category, metadata_uri || null, royalty_pct);

  return db.prepare("SELECT * FROM nfts WHERE id = ?").get(id);
}

// ─── Listings ─────────────────────────────────────

/**
 * List an NFT for sale
 */
export function listNFT({ nft_id, agent_id, price_usd }) {
  if (!nft_id) throw new Error("nft_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!price_usd || price_usd <= 0) throw new Error("price_usd must be positive");

  const nft = db.prepare("SELECT * FROM nfts WHERE id = ?").get(nft_id);
  if (!nft) throw new Error("NFT not found");
  if (nft.owner_agent_id !== agent_id) throw new Error("Agent does not own this NFT");
  if (nft.is_fractionalized) throw new Error("Fractionalized NFTs cannot be listed directly; sell fractions instead");

  // Cancel any existing listing
  db.prepare(`
    UPDATE nft_listings SET status = 'cancelled' WHERE nft_id = ? AND status = 'active'
  `).run(nft_id);

  const listingId = uuid();
  db.prepare(`
    INSERT INTO nft_listings (id, nft_id, seller_agent_id, price_usd)
    VALUES (?, ?, ?, ?)
  `).run(listingId, nft_id, agent_id, price_usd);

  db.prepare("UPDATE nfts SET is_listed = 1, price_usd = ? WHERE id = ?").run(price_usd, nft_id);

  return {
    listing_id: listingId,
    nft_id,
    seller_agent_id: agent_id,
    price_usd,
    status: "active",
  };
}

// ─── Trading ──────────────────────────────────────

/**
 * Buy a listed NFT
 */
export function buyNFT({ nft_id, buyer_agent_id }) {
  if (!nft_id) throw new Error("nft_id is required");
  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");

  const nft = db.prepare("SELECT * FROM nfts WHERE id = ?").get(nft_id);
  if (!nft) throw new Error("NFT not found");
  if (!nft.is_listed) throw new Error("NFT is not listed for sale");
  if (nft.owner_agent_id === buyer_agent_id) throw new Error("Cannot buy your own NFT");

  const listing = db.prepare(`
    SELECT * FROM nft_listings WHERE nft_id = ? AND status = 'active' ORDER BY listed_at DESC LIMIT 1
  `).get(nft_id);
  if (!listing) throw new Error("No active listing found");

  const price = listing.price_usd;
  const commission = Math.round(price * PLATFORM_FEE_PCT * 100) / 100;
  const royalty = Math.round(price * (nft.royalty_pct / 100) * 100) / 100;
  const sellerProceeds = Math.round((price - commission - royalty) * 100) / 100;

  // Record trade
  const tradeId = uuid();
  db.prepare(`
    INSERT INTO nft_trades (id, nft_id, from_agent_id, to_agent_id, price_usd, commission_usd, royalty_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tradeId, nft_id, nft.owner_agent_id, buyer_agent_id, price, commission, royalty);

  // Transfer ownership
  db.prepare("UPDATE nfts SET owner_agent_id = ?, is_listed = 0 WHERE id = ?").run(buyer_agent_id, nft_id);

  // Close listing
  db.prepare(`
    UPDATE nft_listings SET status = 'sold', sold_at = datetime('now') WHERE id = ?
  `).run(listing.id);

  return {
    trade_id: tradeId,
    nft_id,
    nft_name: nft.name,
    buyer_agent_id,
    seller_agent_id: nft.owner_agent_id,
    price_usd: price,
    commission_usd: commission,
    royalty_usd: royalty,
    royalty_to: nft.creator_agent_id,
    seller_proceeds_usd: sellerProceeds,
  };
}

/**
 * Transfer an NFT without payment
 */
export function transferNFT({ nft_id, from_agent_id, to_agent_id }) {
  if (!nft_id) throw new Error("nft_id is required");
  if (!from_agent_id) throw new Error("from_agent_id is required");
  if (!to_agent_id) throw new Error("to_agent_id is required");

  const nft = db.prepare("SELECT * FROM nfts WHERE id = ?").get(nft_id);
  if (!nft) throw new Error("NFT not found");
  if (nft.owner_agent_id !== from_agent_id) throw new Error("Agent does not own this NFT");
  if (from_agent_id === to_agent_id) throw new Error("Cannot transfer to yourself");

  // Cancel active listings on transfer
  db.prepare("UPDATE nft_listings SET status = 'cancelled' WHERE nft_id = ? AND status = 'active'").run(nft_id);
  db.prepare("UPDATE nfts SET owner_agent_id = ?, is_listed = 0 WHERE id = ?").run(to_agent_id, nft_id);

  // Record as a zero-value trade
  db.prepare(`
    INSERT INTO nft_trades (id, nft_id, from_agent_id, to_agent_id, price_usd, commission_usd, royalty_usd)
    VALUES (?, ?, ?, ?, 0, 0, 0)
  `).run(uuid(), nft_id, from_agent_id, to_agent_id);

  return { nft_id, from_agent_id, to_agent_id, status: "transferred" };
}

// ─── Fractionalization ────────────────────────────

/**
 * Fractionalize an NFT into equal parts
 */
export function fractionalizeNFT({ nft_id, agent_id, num_fractions }) {
  if (!nft_id) throw new Error("nft_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!num_fractions || num_fractions < 2) throw new Error("num_fractions must be at least 2");
  if (num_fractions > 10000) throw new Error("num_fractions cannot exceed 10,000");

  const nft = db.prepare("SELECT * FROM nfts WHERE id = ?").get(nft_id);
  if (!nft) throw new Error("NFT not found");
  if (nft.owner_agent_id !== agent_id) throw new Error("Agent does not own this NFT");
  if (nft.is_fractionalized) throw new Error("NFT is already fractionalized");

  const fractionPct = Math.round((100 / num_fractions) * 10000) / 10000;

  // Mark NFT as fractionalized
  db.prepare("UPDATE nfts SET is_fractionalized = 1, is_listed = 0, total_fractions = ? WHERE id = ?").run(num_fractions, nft_id);

  // Cancel any active listing
  db.prepare("UPDATE nft_listings SET status = 'cancelled' WHERE nft_id = ? AND status = 'active'").run(nft_id);

  // Create all fractions for the owner
  const insertFraction = db.prepare(`
    INSERT INTO nft_fractions (id, nft_id, owner_agent_id, fraction_pct, acquired_price_usd)
    VALUES (?, ?, ?, ?, 0)
  `);
  const insertMany = db.transaction(() => {
    for (let i = 0; i < num_fractions; i++) {
      insertFraction.run(uuid(), nft_id, agent_id, fractionPct);
    }
  });
  insertMany();

  return {
    nft_id,
    num_fractions,
    fraction_pct_each: fractionPct,
    owner_agent_id: agent_id,
    status: "fractionalized",
  };
}

/**
 * Buy a fraction of a fractionalized NFT
 */
export function buyFraction({ nft_id, buyer_agent_id, fraction_pct, price_usd }) {
  if (!nft_id) throw new Error("nft_id is required");
  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");
  if (!fraction_pct || fraction_pct <= 0) throw new Error("fraction_pct must be positive");
  if (!price_usd || price_usd <= 0) throw new Error("price_usd must be positive");

  const nft = db.prepare("SELECT * FROM nfts WHERE id = ?").get(nft_id);
  if (!nft) throw new Error("NFT not found");
  if (!nft.is_fractionalized) throw new Error("NFT is not fractionalized");

  // Find an available fraction from a seller (not the buyer)
  const availableFraction = db.prepare(`
    SELECT * FROM nft_fractions WHERE nft_id = ? AND owner_agent_id != ? AND fraction_pct >= ?
    ORDER BY acquired_price_usd ASC LIMIT 1
  `).get(nft_id, buyer_agent_id, fraction_pct);

  if (!availableFraction) throw new Error("No available fractions found matching criteria");

  const commission = Math.round(price_usd * PLATFORM_FEE_PCT * 100) / 100;

  // Transfer fraction
  db.prepare("UPDATE nft_fractions SET owner_agent_id = ?, acquired_price_usd = ? WHERE id = ?")
    .run(buyer_agent_id, price_usd, availableFraction.id);

  // Record trade
  db.prepare(`
    INSERT INTO nft_trades (id, nft_id, from_agent_id, to_agent_id, price_usd, commission_usd, royalty_usd)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuid(), nft_id, availableFraction.owner_agent_id, buyer_agent_id, price_usd, commission);

  return {
    nft_id,
    fraction_id: availableFraction.id,
    buyer_agent_id,
    seller_agent_id: availableFraction.owner_agent_id,
    fraction_pct: availableFraction.fraction_pct,
    price_usd,
    commission_usd: commission,
  };
}

// ─── Search & Discovery ───────────────────────────

/**
 * Search NFTs in the marketplace
 */
export function searchNFTs({ query, category, max_price, sort_by = "created_at", limit = 20 } = {}) {
  const validSorts = { price_asc: "price_usd ASC", price_desc: "price_usd DESC", created_at: "created_at DESC", royalty: "royalty_pct DESC" };
  const orderBy = validSorts[sort_by] || "created_at DESC";

  let conditions = ["is_listed = 1"];
  const params = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (max_price) {
    conditions.push("price_usd <= ?");
    params.push(max_price);
  }
  if (query) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
    params.push(`%${query}%`, `%${query}%`);
  }

  params.push(limit);
  const sql = `SELECT * FROM nfts WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy} LIMIT ?`;
  return db.prepare(sql).all(...params);
}

/**
 * Get all NFTs owned or created by an agent
 */
export function getAgentNFTs(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  const owned = db.prepare("SELECT * FROM nfts WHERE owner_agent_id = ? ORDER BY created_at DESC").all(agent_id);
  const created = db.prepare(`
    SELECT * FROM nfts WHERE creator_agent_id = ? AND owner_agent_id != ? ORDER BY created_at DESC
  `).all(agent_id, agent_id);
  const fractions = db.prepare(`
    SELECT f.*, n.name, n.category, n.creator_agent_id
    FROM nft_fractions f JOIN nfts n ON f.nft_id = n.id
    WHERE f.owner_agent_id = ?
    ORDER BY f.created_at DESC
  `).all(agent_id);
  return { owned, created_sold: created, fractions };
}

// ─── Stats ────────────────────────────────────────

/**
 * Platform-wide NFT stats
 */
export function getNFTStats() {
  const totalNFTs = db.prepare("SELECT COUNT(*) as count FROM nfts").get().count;
  const listedNFTs = db.prepare("SELECT COUNT(*) as count FROM nfts WHERE is_listed = 1").get().count;
  const totalTrades = db.prepare("SELECT COUNT(*) as count FROM nft_trades WHERE price_usd > 0").get().count;
  const totalVolume = db.prepare("SELECT ROUND(SUM(price_usd), 2) as total FROM nft_trades WHERE price_usd > 0").get().total || 0;
  const totalCommission = db.prepare("SELECT ROUND(SUM(commission_usd), 2) as total FROM nft_trades").get().total || 0;
  const totalRoyalties = db.prepare("SELECT ROUND(SUM(royalty_usd), 2) as total FROM nft_trades").get().total || 0;
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count, COUNT(CASE WHEN is_listed=1 THEN 1 END) as listed
    FROM nfts GROUP BY category
  `).all();
  const topSellers = db.prepare(`
    SELECT from_agent_id as agent_id, COUNT(*) as trades, ROUND(SUM(price_usd), 2) as volume
    FROM nft_trades WHERE price_usd > 0
    GROUP BY from_agent_id ORDER BY volume DESC LIMIT 5
  `).all();

  return {
    nfts: { total: totalNFTs, listed: listedNFTs },
    trades: { total: totalTrades, total_volume_usd: totalVolume },
    financials: {
      platform_commission_usd: totalCommission,
      creator_royalties_usd: totalRoyalties,
      commission_pct: PLATFORM_FEE_PCT * 100,
    },
    by_category: byCategory,
    top_sellers: topSellers,
  };
}
