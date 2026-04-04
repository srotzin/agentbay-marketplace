import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "agentbay.db");

const db = new Database(DB_PATH);

// Enable WAL for concurrent reads
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ──────────────────────────────────────────

db.exec(`
  -- Service providers (humans or automated systems listing services)
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    wallet_address TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    rating REAL DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_earned_usd REAL DEFAULT 0,
    api_key TEXT UNIQUE NOT NULL
  );

  -- Services listed on the marketplace
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price_usd REAL,                    -- Fixed price (NULL if auction-only)
    price_model TEXT DEFAULT 'fixed',  -- 'fixed', 'per_request', 'auction_only'
    endpoint_url TEXT,                 -- For API services
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    rating REAL DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',            -- JSON array of tags
    response_time_ms INTEGER,          -- Avg response time
    uptime_pct REAL DEFAULT 100.0
  );

  -- Micro-auctions: agents post a need, providers bid
  CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    max_price_usd REAL,               -- Agent's budget ceiling
    status TEXT DEFAULT 'open',        -- 'open', 'in_progress', 'completed', 'cancelled', 'expired'
    winning_bid_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,          -- Auctions have short deadlines (minutes)
    completed_at TEXT
  );

  -- Bids on auctions
  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    auction_id TEXT NOT NULL REFERENCES auctions(id),
    provider_id TEXT NOT NULL REFERENCES providers(id),
    service_id TEXT REFERENCES services(id),
    price_usd REAL NOT NULL,
    estimated_time_ms INTEGER,         -- How fast they can deliver
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- All transactions (both direct purchases and auction completions)
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    service_id TEXT REFERENCES services(id),
    auction_id TEXT REFERENCES auctions(id),
    provider_id TEXT NOT NULL REFERENCES providers(id),
    agent_id TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,       -- HiveAgent's cut
    provider_payout_usd REAL NOT NULL,  -- What provider receives
    status TEXT DEFAULT 'pending',      -- 'pending', 'completed', 'failed', 'refunded'
    payment_tx_hash TEXT,               -- On-chain USDC transaction
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  -- Agent profiles (optional, for tracking repeat customers)
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    wallet_address TEXT,
    total_spent_usd REAL DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Create indexes for fast lookups
  CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
  CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
  CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
  CREATE INDEX IF NOT EXISTS idx_auctions_category ON auctions(category);
  CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_agent ON transactions(agent_id);
`);

export default db;
