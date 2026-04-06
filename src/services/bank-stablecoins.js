/**
 * HiveAgent Bank Stablecoin Integration
 *
 * Support for current and emerging bank-issued stablecoins.
 * Swap between any pair at 0.1% fee.
 *
 * Current stablecoins: USDC, USDT, DAI, PYUSD, BUSD, FRAX, TUSD, USDP, GUSD, LUSD
 * Expected 2026-2027: JPMC, AMZN_USD, WMT_USD, VISA_USD, MS_USD
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS registered_stablecoins (
    id               TEXT PRIMARY KEY,
    symbol           TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    issuer           TEXT NOT NULL,
    issuer_type      TEXT DEFAULT 'bank',
    backing          TEXT DEFAULT 'usd_reserves',
    chain            TEXT DEFAULT 'base',
    contract_address TEXT,
    peg_currency     TEXT DEFAULT 'USD',
    peg_value        REAL DEFAULT 1.0,
    total_supply     TEXT,
    market_cap_usd   REAL,
    is_active        INTEGER DEFAULT 1,
    added_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stablecoin_swaps_v2 (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    from_coin   TEXT NOT NULL,
    to_coin     TEXT NOT NULL,
    from_amount REAL NOT NULL,
    to_amount   REAL NOT NULL,
    rate        REAL NOT NULL,
    fee_usd     REAL NOT NULL,
    fee_pct     REAL NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stablecoin_alerts (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    coin_symbol  TEXT NOT NULL,
    alert_type   TEXT NOT NULL,
    threshold    REAL,
    status       TEXT DEFAULT 'active',
    triggered_at TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Stablecoins ─────────────────────────────────────────────────────────

{
  const existing = db.prepare("SELECT COUNT(*) AS n FROM registered_stablecoins").get();
  if (existing.n === 0) {
    const coins = [
      // Current stablecoins
      {
        symbol: "USDC", name: "USD Coin", issuer: "Circle",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "multi-chain", market_cap_usd: 43_000_000_000, is_active: 1,
      },
      {
        symbol: "USDT", name: "Tether USD", issuer: "Tether",
        issuer_type: "crypto_native", backing: "mixed_reserves",
        chain: "multi-chain", market_cap_usd: 118_000_000_000, is_active: 1,
      },
      {
        symbol: "DAI", name: "Dai Stablecoin", issuer: "MakerDAO",
        issuer_type: "crypto_native", backing: "crypto_collateral",
        chain: "ethereum", market_cap_usd: 5_400_000_000, is_active: 1,
      },
      {
        symbol: "PYUSD", name: "PayPal USD", issuer: "PayPal",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "ethereum", market_cap_usd: 780_000_000, is_active: 1,
      },
      {
        symbol: "BUSD", name: "Binance USD", issuer: "Paxos",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "ethereum", market_cap_usd: 200_000_000, is_active: 1,
      },
      {
        symbol: "FRAX", name: "Frax", issuer: "Frax Finance",
        issuer_type: "crypto_native", backing: "algorithmic_hybrid",
        chain: "ethereum", market_cap_usd: 650_000_000, is_active: 1,
      },
      {
        symbol: "TUSD", name: "TrueUSD", issuer: "TrueUSD",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "multi-chain", market_cap_usd: 490_000_000, is_active: 1,
      },
      {
        symbol: "USDP", name: "Pax Dollar", issuer: "Paxos",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "ethereum", market_cap_usd: 160_000_000, is_active: 1,
      },
      {
        symbol: "GUSD", name: "Gemini Dollar", issuer: "Gemini",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "ethereum", market_cap_usd: 130_000_000, is_active: 1,
      },
      {
        symbol: "LUSD", name: "Liquity USD", issuer: "Liquity",
        issuer_type: "crypto_native", backing: "eth_collateral",
        chain: "ethereum", market_cap_usd: 220_000_000, is_active: 1,
      },
      // Expected 2026-2027 bank-issued stablecoins
      {
        symbol: "JPMC", name: "JPMorgan Chase Coin", issuer: "JPMorgan Chase",
        issuer_type: "bank", backing: "bank_deposits",
        chain: "base", market_cap_usd: null, is_active: 0,
      },
      {
        symbol: "AMZN_USD", name: "Amazon USD", issuer: "Amazon",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "base", market_cap_usd: null, is_active: 0,
      },
      {
        symbol: "WMT_USD", name: "Walmart USD", issuer: "Walmart",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "base", market_cap_usd: null, is_active: 0,
      },
      {
        symbol: "VISA_USD", name: "Visa USD Stablecoin", issuer: "Visa",
        issuer_type: "fintech", backing: "usd_reserves",
        chain: "ethereum", market_cap_usd: null, is_active: 0,
      },
      {
        symbol: "MS_USD", name: "Morgan Stanley USD", issuer: "Morgan Stanley",
        issuer_type: "bank", backing: "bank_deposits",
        chain: "base", market_cap_usd: null, is_active: 0,
      },
    ];

    const insert = db.prepare(`
      INSERT INTO registered_stablecoins
        (id, symbol, name, issuer, issuer_type, backing, chain, market_cap_usd, is_active)
      VALUES
        (:id, :symbol, :name, :issuer, :issuer_type, :backing, :chain, :market_cap_usd, :is_active)
    `);
    const insertAll = db.transaction((rows) => {
      for (const row of rows) insert.run({ id: uuid(), ...row });
    });
    insertAll(coins);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SWAP_FEE_PCT = 0.1;

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * List all registered stablecoins. Optional filters: issuer_type, is_active.
 */
export function listStablecoins({ issuer_type, is_active } = {}) {
  let query = "SELECT * FROM registered_stablecoins WHERE 1=1";
  const params = [];
  if (issuer_type !== undefined) { query += " AND issuer_type = ?"; params.push(issuer_type); }
  if (is_active !== undefined) { query += " AND is_active = ?"; params.push(is_active ? 1 : 0); }
  query += " ORDER BY market_cap_usd DESC NULLS LAST, added_at DESC";
  return db.prepare(query).all(...params);
}

/**
 * Get details for a specific stablecoin by symbol.
 */
export function getStablecoin(symbol) {
  const coin = db.prepare("SELECT * FROM registered_stablecoins WHERE symbol = ?").get(symbol.toUpperCase());
  if (!coin) throw new Error(`Stablecoin '${symbol}' not found.`);
  return coin;
}

/**
 * Swap between any two registered stablecoins at 0.1% fee.
 * All stablecoins are pegged to USD at 1:1, so rate is always 1.0.
 */
export function swapStablecoins({ agent_id, from_coin, to_coin, amount }) {
  if (!agent_id) throw new Error("agent_id is required.");
  if (amount <= 0) throw new Error("Swap amount must be positive.");
  if (from_coin === to_coin) throw new Error("from_coin and to_coin must be different.");

  const from = db.prepare("SELECT * FROM registered_stablecoins WHERE symbol = ? AND is_active = 1").get(from_coin.toUpperCase());
  if (!from) throw new Error(`Stablecoin '${from_coin}' is not found or not active.`);

  const to = db.prepare("SELECT * FROM registered_stablecoins WHERE symbol = ? AND is_active = 1").get(to_coin.toUpperCase());
  if (!to) throw new Error(`Stablecoin '${to_coin}' is not found or not active.`);

  // Both are USD-pegged, so rate = 1.0 (peg_value / peg_value)
  const rate = from.peg_value / to.peg_value;
  const fee_usd = parseFloat((amount * SWAP_FEE_PCT / 100).toFixed(6));
  const to_amount = parseFloat(((amount - fee_usd) * rate).toFixed(6));

  const id = uuid();
  db.prepare(`
    INSERT INTO stablecoin_swaps_v2
      (id, agent_id, from_coin, to_coin, from_amount, to_amount, rate, fee_usd, fee_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, from_coin.toUpperCase(), to_coin.toUpperCase(), amount, to_amount, rate, fee_usd, SWAP_FEE_PCT);

  return {
    swap_id: id,
    agent_id,
    from_coin: from_coin.toUpperCase(),
    to_coin: to_coin.toUpperCase(),
    from_amount: amount,
    to_amount,
    rate,
    fee_usd,
    fee_pct: SWAP_FEE_PCT,
    created_at: new Date().toISOString(),
  };
}

/**
 * Register a new stablecoin (admin function).
 */
export function registerStablecoin({ symbol, name, issuer, issuer_type = "bank", chain = "base", contract_address }) {
  if (!symbol || !name || !issuer) throw new Error("symbol, name, and issuer are required.");
  const existing = db.prepare("SELECT id FROM registered_stablecoins WHERE symbol = ?").get(symbol.toUpperCase());
  if (existing) throw new Error(`Stablecoin '${symbol}' is already registered.`);

  const id = uuid();
  db.prepare(`
    INSERT INTO registered_stablecoins (id, symbol, name, issuer, issuer_type, chain, contract_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, symbol.toUpperCase(), name, issuer, issuer_type, chain, contract_address || null);

  return db.prepare("SELECT * FROM registered_stablecoins WHERE id = ?").get(id);
}

/**
 * Set a depeg, volume spike, or new listing alert for an agent.
 */
export function setAlert({ agent_id, coin_symbol, alert_type, threshold }) {
  if (!agent_id || !coin_symbol || !alert_type) {
    throw new Error("agent_id, coin_symbol, and alert_type are required.");
  }
  const validTypes = ["new_listing", "depeg", "volume_spike"];
  if (!validTypes.includes(alert_type)) {
    throw new Error(`Invalid alert_type. Must be one of: ${validTypes.join(", ")}`);
  }
  const id = uuid();
  db.prepare(`
    INSERT INTO stablecoin_alerts (id, agent_id, coin_symbol, alert_type, threshold)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, agent_id, coin_symbol.toUpperCase(), alert_type, threshold ?? null);

  return db.prepare("SELECT * FROM stablecoin_alerts WHERE id = ?").get(id);
}

/**
 * Get all active alerts for an agent.
 */
export function getAlerts(agent_id) {
  return db.prepare(
    "SELECT * FROM stablecoin_alerts WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC"
  ).all(agent_id);
}

/**
 * Get platform-wide bank stablecoin statistics.
 */
export function getBankStablecoinStats() {
  const coin_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_registered,
      COUNT(CASE WHEN is_active = 1 THEN 1 END) AS active_stablecoins,
      COUNT(CASE WHEN is_active = 0 THEN 1 END) AS upcoming_stablecoins,
      SUM(CASE WHEN is_active = 1 THEN market_cap_usd ELSE 0 END) AS total_market_cap_usd
    FROM registered_stablecoins
  `).get();

  const by_issuer_type = db.prepare(`
    SELECT issuer_type, COUNT(*) AS count,
           SUM(CASE WHEN is_active = 1 THEN market_cap_usd ELSE 0 END) AS market_cap
    FROM registered_stablecoins
    GROUP BY issuer_type
    ORDER BY market_cap DESC
  `).all();

  const swap_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_swaps,
      SUM(from_amount) AS total_volume_usd,
      SUM(fee_usd) AS total_fees_usd,
      AVG(from_amount) AS avg_swap_size
    FROM stablecoin_swaps_v2
  `).get();

  const top_pairs = db.prepare(`
    SELECT from_coin, to_coin, COUNT(*) AS swap_count, SUM(from_amount) AS volume
    FROM stablecoin_swaps_v2
    GROUP BY from_coin, to_coin
    ORDER BY volume DESC
    LIMIT 10
  `).all();

  const alert_stats = db.prepare(`
    SELECT alert_type, COUNT(*) AS count
    FROM stablecoin_alerts
    WHERE status = 'active'
    GROUP BY alert_type
  `).all();

  return { coin_stats, by_issuer_type, swap_stats, top_pairs, alert_stats };
}
