/**
 * HiveAgent Universal Payment Service
 *
 * The single payment entry point for all agents. Accept anything, settle anything.
 * Supports every stablecoin, every chain, every payment method — one call, auto-routed.
 *
 * Currencies: USDC, USDT, DAI, PYUSD, USDP, BUSD, FRAX, LUSD, EURC, GBPc, XSGD
 * Methods:    onchain_base, onchain_ethereum, onchain_polygon, onchain_arbitrum,
 *             onchain_optimism, onchain_solana, onchain_avalanche,
 *             card_visa, card_mastercard, ach_bank, wire, paypal,
 *             apple_pay, google_pay, lightning_btc
 *
 * Fee schedule:
 *   Onchain:  0.10%
 *   Card:     1.50%
 *   ACH:      0.50%
 *   Wire:     0.25% (min $5)
 *   PayPal:   1.00%
 *   Lightning: 0.05%
 *   Swap:     0.05%
 *   Onramp:   1–3%
 *   Offramp:  1–2%
 *   Invoice:  $0.25/invoice
 */

import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pay_currencies (
    symbol          TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('stablecoin','fiat','crypto')),
    chains          TEXT NOT NULL DEFAULT '[]',
    methods         TEXT NOT NULL DEFAULT '[]',
    min_amount      REAL NOT NULL DEFAULT 0.01,
    max_amount      REAL NOT NULL DEFAULT 1000000,
    peg             TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pay_methods (
    name            TEXT PRIMARY KEY,
    type            TEXT NOT NULL CHECK(type IN ('onchain','card','bank','wallet','lightning')),
    currencies      TEXT NOT NULL DEFAULT '[]',
    fee_pct         REAL NOT NULL,
    settlement_time TEXT NOT NULL,
    min_amount      REAL NOT NULL DEFAULT 0.01,
    max_amount      REAL NOT NULL DEFAULT 1000000,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pay_exchange_rates (
    id              TEXT PRIMARY KEY,
    from_symbol     TEXT NOT NULL,
    to_symbol       TEXT NOT NULL,
    rate            REAL NOT NULL,
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pay_transactions (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('payment','swap','onramp','offramp','invoice')),
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL,
    recipient       TEXT,
    method          TEXT,
    fee_pct         REAL NOT NULL,
    fee_amount      REAL NOT NULL,
    net_amount      REAL NOT NULL,
    from_currency   TEXT,
    to_currency     TEXT,
    from_amount     REAL,
    to_amount       REAL,
    exchange_rate   REAL,
    status          TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','confirming','completed','failed')),
    confirmations   INTEGER DEFAULT 0,
    block_explorer_url TEXT,
    receipt_url     TEXT,
    bank_reference  TEXT,
    estimated_arrival TEXT,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pay_invoices (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL,
    description     TEXT NOT NULL,
    recipient_email TEXT,
    payment_link    TEXT NOT NULL,
    qr_code_data    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','cancelled')),
    due_date        TEXT,
    expires_at      TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    paid_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS pay_quotes (
    id              TEXT PRIMARY KEY,
    amount          REAL NOT NULL,
    from_currency   TEXT NOT NULL,
    to_currency     TEXT NOT NULL,
    method          TEXT,
    exchange_rate   REAL NOT NULL,
    fee_pct         REAL NOT NULL,
    fee_amount      REAL NOT NULL,
    total_cost      REAL NOT NULL,
    settlement_time TEXT NOT NULL,
    expires_at      TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pay_tx_agent ON pay_transactions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_pay_tx_status ON pay_transactions(status);
  CREATE INDEX IF NOT EXISTS idx_pay_invoices_agent ON pay_invoices(agent_id);
`);

// ─── Seed Currencies ──────────────────────────────────────────────────────────

const _currencyCount = db.prepare("SELECT COUNT(*) as n FROM pay_currencies").get().n;
if (_currencyCount === 0) {
  const ALL_ONCHAIN = JSON.stringify([
    "onchain_base","onchain_ethereum","onchain_polygon",
    "onchain_arbitrum","onchain_optimism","onchain_solana","onchain_avalanche",
  ]);
  const USD_ONCHAIN = JSON.stringify([
    "onchain_base","onchain_ethereum","onchain_polygon",
    "onchain_arbitrum","onchain_optimism","onchain_solana","onchain_avalanche",
    "card_visa","card_mastercard","ach_bank","wire","paypal","apple_pay","google_pay",
  ]);
  const ETH_ONLY = JSON.stringify(["onchain_ethereum","onchain_arbitrum","onchain_optimism"]);
  const SOL_ONLY = JSON.stringify(["onchain_solana"]);

  const seedCurrencies = [
    { symbol: "USDC",  name: "USD Coin",           type: "stablecoin", chains: USD_ONCHAIN, methods: USD_ONCHAIN, min_amount: 0.01, max_amount: 5000000, peg: "USD" },
    { symbol: "USDT",  name: "Tether USD",          type: "stablecoin", chains: ALL_ONCHAIN, methods: ALL_ONCHAIN, min_amount: 0.01, max_amount: 5000000, peg: "USD" },
    { symbol: "DAI",   name: "Dai Stablecoin",      type: "stablecoin", chains: ETH_ONLY,   methods: ETH_ONLY, min_amount: 0.01, max_amount: 1000000, peg: "USD" },
    { symbol: "PYUSD", name: "PayPal USD",           type: "stablecoin", chains: JSON.stringify(["onchain_ethereum","onchain_solana"]), methods: JSON.stringify(["onchain_ethereum","onchain_solana","paypal"]), min_amount: 0.01, max_amount: 500000, peg: "USD" },
    { symbol: "USDP",  name: "Pax Dollar",          type: "stablecoin", chains: ETH_ONLY,   methods: ETH_ONLY, min_amount: 1.00, max_amount: 1000000, peg: "USD" },
    { symbol: "BUSD",  name: "Binance USD",         type: "stablecoin", chains: JSON.stringify(["onchain_ethereum"]), methods: JSON.stringify(["onchain_ethereum"]), min_amount: 1.00, max_amount: 500000, peg: "USD" },
    { symbol: "FRAX",  name: "Frax",                type: "stablecoin", chains: ETH_ONLY,   methods: ETH_ONLY, min_amount: 0.01, max_amount: 500000, peg: "USD" },
    { symbol: "LUSD",  name: "Liquity USD",         type: "stablecoin", chains: JSON.stringify(["onchain_ethereum","onchain_optimism"]), methods: JSON.stringify(["onchain_ethereum","onchain_optimism"]), min_amount: 0.01, max_amount: 250000, peg: "USD" },
    { symbol: "EURC",  name: "Euro Coin",           type: "stablecoin", chains: JSON.stringify(["onchain_ethereum","onchain_base","onchain_avalanche"]), methods: JSON.stringify(["onchain_ethereum","onchain_base","onchain_avalanche"]), min_amount: 0.01, max_amount: 1000000, peg: "EUR" },
    { symbol: "GBPc",  name: "GBP Coin",            type: "stablecoin", chains: JSON.stringify(["onchain_ethereum"]), methods: JSON.stringify(["onchain_ethereum"]), min_amount: 0.01, max_amount: 500000, peg: "GBP" },
    { symbol: "XSGD",  name: "XSGD Singapore Dollar",type:"stablecoin", chains: JSON.stringify(["onchain_ethereum","onchain_polygon"]), methods: JSON.stringify(["onchain_ethereum","onchain_polygon"]), min_amount: 0.01, max_amount: 500000, peg: "SGD" },
    { symbol: "USD",   name: "US Dollar",           type: "fiat",       chains: "[]",        methods: JSON.stringify(["card_visa","card_mastercard","ach_bank","wire","paypal","apple_pay","google_pay"]), min_amount: 1.00, max_amount: 1000000, peg: null },
    { symbol: "EUR",   name: "Euro",                type: "fiat",       chains: "[]",        methods: JSON.stringify(["card_visa","card_mastercard","wire","paypal"]), min_amount: 1.00, max_amount: 1000000, peg: null },
    { symbol: "GBP",   name: "British Pound",       type: "fiat",       chains: "[]",        methods: JSON.stringify(["card_visa","card_mastercard","wire"]), min_amount: 1.00, max_amount: 1000000, peg: null },
    { symbol: "BTC",   name: "Bitcoin (Lightning)", type: "crypto",     chains: JSON.stringify(["lightning_btc"]), methods: JSON.stringify(["lightning_btc"]), min_amount: 0.000001, max_amount: 10, peg: null },
  ];

  const insertCurrency = db.prepare(`
    INSERT OR IGNORE INTO pay_currencies (symbol, name, type, chains, methods, min_amount, max_amount, peg)
    VALUES (@symbol, @name, @type, @chains, @methods, @min_amount, @max_amount, @peg)
  `);
  for (const c of seedCurrencies) insertCurrency.run(c);
}

// ─── Seed Payment Methods ─────────────────────────────────────────────────────

const _methodCount = db.prepare("SELECT COUNT(*) as n FROM pay_methods").get().n;
if (_methodCount === 0) {
  const stablecoins = JSON.stringify(["USDC","USDT","DAI","PYUSD","USDP","BUSD","FRAX","LUSD","EURC","GBPc","XSGD"]);
  const usdFiat     = JSON.stringify(["USD"]);
  const fiatAll     = JSON.stringify(["USD","EUR","GBP","JPY","AUD","CAD","CHF","SGD","HKD","BRL","MXN","INR"]);

  const seedMethods = [
    { name: "onchain_base",      type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~5 seconds",  min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_ethereum",  type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~15 seconds", min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_polygon",   type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~2 seconds",  min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_arbitrum",  type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~1 second",   min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_optimism",  type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~2 seconds",  min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_solana",    type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~400ms",      min_amount: 0.01,  max_amount: 5000000 },
    { name: "onchain_avalanche", type: "onchain",   currencies: stablecoins,    fee_pct: 0.001, settlement_time: "~1 second",   min_amount: 0.01,  max_amount: 5000000 },
    { name: "card_visa",         type: "card",      currencies: JSON.stringify(["USD","EUR","GBP","USDC"]), fee_pct: 0.015, settlement_time: "instant",    min_amount: 0.50,  max_amount: 50000 },
    { name: "card_mastercard",   type: "card",      currencies: JSON.stringify(["USD","EUR","GBP","USDC"]), fee_pct: 0.015, settlement_time: "instant",    min_amount: 0.50,  max_amount: 50000 },
    { name: "ach_bank",          type: "bank",      currencies: usdFiat,        fee_pct: 0.005, settlement_time: "1-3 business days", min_amount: 1.00, max_amount: 1000000 },
    { name: "wire",              type: "bank",      currencies: fiatAll,        fee_pct: 0.0025, settlement_time: "same day",   min_amount: 100,   max_amount: 10000000 },
    { name: "paypal",            type: "wallet",    currencies: JSON.stringify(["USD","EUR","GBP","PYUSD"]), fee_pct: 0.01, settlement_time: "instant", min_amount: 0.01, max_amount: 100000 },
    { name: "apple_pay",         type: "wallet",    currencies: JSON.stringify(["USD","EUR","GBP"]), fee_pct: 0.015, settlement_time: "instant", min_amount: 0.01, max_amount: 10000 },
    { name: "google_pay",        type: "wallet",    currencies: JSON.stringify(["USD","EUR","GBP"]), fee_pct: 0.015, settlement_time: "instant", min_amount: 0.01, max_amount: 10000 },
    { name: "lightning_btc",     type: "lightning", currencies: JSON.stringify(["BTC"]), fee_pct: 0.0005, settlement_time: "~1 second", min_amount: 0.000001, max_amount: 10 },
    // Aliases for swap-only
    { name: "swap_amm",          type: "onchain",   currencies: stablecoins,    fee_pct: 0.0005, settlement_time: "~2 seconds", min_amount: 0.01, max_amount: 1000000 },
    { name: "onramp_card",       type: "card",      currencies: fiatAll,        fee_pct: 0.025, settlement_time: "instant",    min_amount: 10,   max_amount: 25000 },
    { name: "onramp_bank",       type: "bank",      currencies: fiatAll,        fee_pct: 0.01,  settlement_time: "1-2 business days", min_amount: 10, max_amount: 100000 },
    { name: "offramp_ach",       type: "bank",      currencies: fiatAll,        fee_pct: 0.01,  settlement_time: "1-3 business days", min_amount: 10, max_amount: 100000 },
    { name: "offramp_wire",      type: "bank",      currencies: fiatAll,        fee_pct: 0.015, settlement_time: "same day",   min_amount: 100,  max_amount: 500000 },
  ];

  const insertMethod = db.prepare(`
    INSERT OR IGNORE INTO pay_methods (name, type, currencies, fee_pct, settlement_time, min_amount, max_amount)
    VALUES (@name, @type, @currencies, @fee_pct, @settlement_time, @min_amount, @max_amount)
  `);
  for (const m of seedMethods) insertMethod.run(m);
}

// ─── Seed Exchange Rates ──────────────────────────────────────────────────────

const _rateCount = db.prepare("SELECT COUNT(*) as n FROM pay_exchange_rates").get().n;
if (_rateCount === 0) {
  // Stablecoin rates (all ~1:1 with slight realistic variance)
  const pairs = [
    ["USDC","USDT",1.0001],["USDT","USDC",0.9999],
    ["USDC","DAI", 1.0002],["DAI", "USDC",0.9998],
    ["USDC","PYUSD",1.0000],["PYUSD","USDC",1.0000],
    ["USDC","USDP",1.0001],["USDP","USDC",0.9999],
    ["USDC","FRAX",1.0003],["FRAX","USDC",0.9997],
    ["USDC","LUSD",1.0010],["LUSD","USDC",0.9990],
    ["USDC","BUSD",1.0000],["BUSD","USDC",1.0000],
    ["USDC","EURC",0.9215],["EURC","USDC",1.0851],  // ~0.92 USD/EUR
    ["USDC","GBPc",0.7910],["GBPc","USDC",1.2642],  // ~0.79 USD/GBP
    ["USDC","XSGD",1.3450],["XSGD","USDC",0.7435],  // ~1.35 SGD/USD
    ["USDC","USD", 1.0000],["USD", "USDC",1.0000],
    ["USDC","EUR", 0.9215],["EUR","USDC",1.0851],
    ["USDC","GBP", 0.7910],["GBP","USDC",1.2642],
    ["USD","EUR",  0.9215],["EUR","USD",  1.0851],
    ["USD","GBP",  0.7910],["GBP","USD",  1.2642],
    ["USD","JPY", 149.50],["JPY","USD",  0.00669],
    ["USD","AUD",  1.5280],["AUD","USD",  0.6545],
    ["USD","CAD",  1.3580],["CAD","USD",  0.7364],
    ["USD","CHF",  0.8920],["CHF","USD",  1.1211],
    ["USD","SGD",  1.3450],["SGD","USD",  0.7435],
    ["USD","HKD",  7.8210],["HKD","USD",  0.1279],
    ["USD","BRL",  4.9700],["BRL","USD",  0.2012],
    ["USD","MXN", 17.1500],["MXN","USD",  0.0583],
    ["USD","INR", 83.2500],["INR","USD",  0.01201],
    ["BTC","USD",68500.00],["USD","BTC",  0.00001460],
  ];

  const insertRate = db.prepare(`
    INSERT OR IGNORE INTO pay_exchange_rates (id, from_symbol, to_symbol, rate)
    VALUES (@id, @from_symbol, @to_symbol, @rate)
  `);
  for (const [from, to, rate] of pairs) {
    insertRate.run({ id: `${from}_${to}`, from_symbol: from, to_symbol: to, rate });
  }
}

// ─── Seed Sample Transactions ─────────────────────────────────────────────────

const _txCount = db.prepare("SELECT COUNT(*) as n FROM pay_transactions").get().n;
if (_txCount === 0) {
  const sampleAgents = ["agent_alpha_001", "agent_beta_002", "agent_gamma_003"];
  const sampleTxs = [
    { id: "tx_seed_001", agent_id: "agent_alpha_001", type: "payment",  amount: 250.00, currency: "USDC", recipient: "0xABC...1234", method: "onchain_base",     fee_pct: 0.001, fee_amount: 0.25,  net_amount: 249.75,  status: "completed", block_explorer_url: "https://basescan.org/tx/0xseed001", receipt_url: "https://hiveagentiq.com/receipts/tx_seed_001" },
    { id: "tx_seed_002", agent_id: "agent_alpha_001", type: "swap",     amount: 1000.00,currency: "USDC", recipient: null,           method: "swap_amm",         fee_pct: 0.0005,fee_amount: 0.50,  net_amount: 999.50,  status: "completed", from_currency: "USDC", to_currency: "USDT", from_amount: 1000.00, to_amount: 999.60, exchange_rate: 0.9999 },
    { id: "tx_seed_003", agent_id: "agent_beta_002",  type: "payment",  amount: 75.00,  currency: "USDT", recipient: "vendor_x",    method: "onchain_polygon",  fee_pct: 0.001, fee_amount: 0.075, net_amount: 74.925,  status: "completed", block_explorer_url: "https://polygonscan.com/tx/0xseed003" },
    { id: "tx_seed_004", agent_id: "agent_beta_002",  type: "onramp",   amount: 500.00, currency: "USD",  recipient: null,           method: "onramp_card",       fee_pct: 0.025, fee_amount: 12.50, net_amount: 487.50,  status: "completed", from_currency: "USD",  to_currency: "USDC", from_amount: 500.00, to_amount: 487.50, exchange_rate: 1.0000, estimated_arrival: "instant" },
    { id: "tx_seed_005", agent_id: "agent_gamma_003", type: "payment",  amount: 1250.00,currency: "USDC", recipient: "supplier_llc", method: "ach_bank",         fee_pct: 0.005, fee_amount: 6.25,  net_amount: 1243.75, status: "completed", bank_reference: "ACH-2024-SEED-005" },
    { id: "tx_seed_006", agent_id: "agent_gamma_003", type: "offramp",  amount: 2000.00,currency: "USDC", recipient: "chase_acct_x", method: "offramp_ach",      fee_pct: 0.01,  fee_amount: 20.00, net_amount: 1980.00, status: "completed", from_currency: "USDC", to_currency: "USD",  from_amount: 2000.00, to_amount: 1980.00, exchange_rate: 1.0000, bank_reference: "OFR-2024-SEED-006", estimated_arrival: "1-3 business days" },
    { id: "tx_seed_007", agent_id: "agent_alpha_001", type: "payment",  amount: 89.99,  currency: "USDC", recipient: "stripe_merchant_x", method: "card_visa", fee_pct: 0.015, fee_amount: 1.35,  net_amount: 88.64,   status: "completed", receipt_url: "https://hiveagentiq.com/receipts/tx_seed_007" },
    { id: "tx_seed_008", agent_id: "agent_beta_002",  type: "swap",     amount: 500.00, currency: "DAI",  recipient: null,           method: "swap_amm",         fee_pct: 0.0005,fee_amount: 0.25,  net_amount: 499.75,  status: "completed", from_currency: "DAI",  to_currency: "USDC", from_amount: 500.00, to_amount: 499.85, exchange_rate: 0.9998 },
    { id: "tx_seed_009", agent_id: "agent_gamma_003", type: "payment",  amount: 340.00, currency: "USDC", recipient: "0xSOL...5678", method: "onchain_solana",   fee_pct: 0.001, fee_amount: 0.34,  net_amount: 339.66,  status: "completed", block_explorer_url: "https://solscan.io/tx/seed009" },
    { id: "tx_seed_010", agent_id: "agent_alpha_001", type: "payment",  amount: 15.00,  currency: "USDC", recipient: "lightning_node_x", method: "lightning_btc", fee_pct: 0.0005,fee_amount: 0.0075,net_amount: 14.9925, status: "completed", description: "Lightning payment to LN node" },
  ];

  const insertTx = db.prepare(`
    INSERT OR IGNORE INTO pay_transactions
      (id, agent_id, type, amount, currency, recipient, method,
       fee_pct, fee_amount, net_amount, from_currency, to_currency,
       from_amount, to_amount, exchange_rate, status, block_explorer_url,
       receipt_url, bank_reference, estimated_arrival, description)
    VALUES
      (@id, @agent_id, @type, @amount, @currency, @recipient, @method,
       @fee_pct, @fee_amount, @net_amount, @from_currency, @to_currency,
       @from_amount, @to_amount, @exchange_rate, @status, @block_explorer_url,
       @receipt_url, @bank_reference, @estimated_arrival, @description)
  `);
  for (const tx of sampleTxs) insertTx.run({
    from_currency: null, to_currency: null, from_amount: null, to_amount: null,
    exchange_rate: null, block_explorer_url: null, receipt_url: null,
    bank_reference: null, estimated_arrival: null, description: null, recipient: null,
    ...tx,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genTxId() {
  return `tx_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function genInvoiceId() {
  return `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function genQuoteId() {
  return `qte_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function getRate(from, to) {
  if (from === to) return 1.0;
  const row = db.prepare(
    "SELECT rate FROM pay_exchange_rates WHERE from_symbol = ? AND to_symbol = ?"
  ).get(from, to);
  if (row) return row.rate;
  // Try inverse
  const inv = db.prepare(
    "SELECT rate FROM pay_exchange_rates WHERE from_symbol = ? AND to_symbol = ?"
  ).get(to, from);
  if (inv) return 1 / inv.rate;
  return 1.0; // fallback for same-peg pairs
}

function detectMethodType(method) {
  if (method?.startsWith("onchain_") || method === "swap_amm") return "onchain";
  if (method === "lightning_btc") return "lightning";
  if (method?.startsWith("card_")) return "card";
  if (method === "ach_bank" || method?.startsWith("onramp_bank") || method?.startsWith("offramp_")) return "bank";
  if (method === "wire") return "wire";
  if (method === "paypal") return "paypal";
  if (method === "apple_pay" || method === "google_pay") return "card";
  return "onchain";
}

function feeForMethod(method) {
  const m = db.prepare("SELECT fee_pct FROM pay_methods WHERE name = ?").get(method);
  if (m) return m.fee_pct;
  const t = detectMethodType(method);
  if (t === "card")     return 0.015;
  if (t === "bank")     return 0.005;
  if (t === "wire")     return 0.0025;
  if (t === "paypal")   return 0.010;
  if (t === "lightning") return 0.0005;
  return 0.001; // onchain default
}

function settlementTime(method) {
  const m = db.prepare("SELECT settlement_time FROM pay_methods WHERE name = ?").get(method);
  return m?.settlement_time ?? "~5 seconds";
}

/**
 * Auto-route to cheapest/fastest method for a given currency.
 * Prefers onchain for stablecoins, cheapest fee otherwise.
 */
function autoRoute(currency, preferredMethod) {
  if (preferredMethod) return preferredMethod;
  const cur = db.prepare("SELECT type FROM pay_currencies WHERE symbol = ?").get(currency);
  if (!cur || cur.type === "stablecoin") return "onchain_base";
  if (cur.type === "fiat") return "ach_bank";
  if (cur.type === "crypto") return "lightning_btc";
  return "onchain_base";
}

// ─── pay ──────────────────────────────────────────────────────────────────────

/**
 * Universal pay function. Accepts ANY currency/method combo.
 * Auto-routes to cheapest/fastest option.
 *
 * @param {number} amount
 * @param {string} currency   - USDC | USDT | DAI | PYUSD | USDP | BUSD | FRAX | LUSD | EURC | GBPc | XSGD | USD | EUR | GBP
 * @param {string} recipient  - Wallet address, email, bank account, or merchant ID
 * @param {string} [method]   - Optional: force a specific payment method
 * @param {string} [agentId]  - Agent identifier for history tracking
 * @returns {{ tx_id, status, fee, settlement_time, receipt_url }}
 */
export function pay(amount, currency, recipient, method, agentId = "agent_anonymous") {
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!currency)              throw new Error("currency is required");
  if (!recipient)             throw new Error("recipient is required");

  const resolvedMethod = autoRoute(currency, method);
  const feePct         = feeForMethod(resolvedMethod);
  const feeAmount      = Math.round(amount * feePct * 10000) / 10000;
  const netAmount      = Math.round((amount - feeAmount) * 10000) / 10000;
  const txId           = genTxId();
  const now            = new Date().toISOString();
  const isOnchain      = resolvedMethod.startsWith("onchain_") || resolvedMethod === "lightning_btc";
  const receiptUrl     = `https://hiveagentiq.com/receipts/${txId}`;
  const explorerUrl    = isOnchain ? `https://hiveagentiq.com/explorer/${txId}` : null;

  db.prepare(`
    INSERT OR IGNORE INTO pay_transactions
      (id, agent_id, type, amount, currency, recipient, method,
       fee_pct, fee_amount, net_amount, status, block_explorer_url, receipt_url, created_at, completed_at)
    VALUES
      (@id, @agent_id, @type, @amount, @currency, @recipient, @method,
       @fee_pct, @fee_amount, @net_amount, @status, @block_explorer_url, @receipt_url, @created_at, @completed_at)
  `).run({
    id: txId, agent_id: agentId, type: "payment", amount, currency, recipient,
    method: resolvedMethod, fee_pct: feePct, fee_amount: feeAmount, net_amount: netAmount,
    status: "completed", block_explorer_url: explorerUrl, receipt_url: receiptUrl,
    created_at: now, completed_at: now,
  });

  return {
    tx_id:           txId,
    status:          "completed",
    amount,
    currency,
    recipient,
    method:          resolvedMethod,
    fee_pct:         feePct,
    fee_amount:      feeAmount,
    net_amount:      netAmount,
    settlement_time: settlementTime(resolvedMethod),
    receipt_url:     receiptUrl,
    block_explorer_url: explorerUrl,
    created_at:      now,
  };
}

// ─── getQuote ─────────────────────────────────────────────────────────────────

/**
 * Get a real-time quote before paying.
 *
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {string} [method]
 * @returns {{ quote_id, exchange_rate, fee, total_cost, settlement_time, expires_in_seconds }}
 */
export function getQuote(amount, fromCurrency, toCurrency, method) {
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!fromCurrency)          throw new Error("fromCurrency is required");
  if (!toCurrency)            throw new Error("toCurrency is required");

  const resolvedMethod = autoRoute(fromCurrency, method);
  const feePct         = feeForMethod(resolvedMethod);
  const rate           = getRate(fromCurrency, toCurrency);
  const feeAmount      = Math.round(amount * feePct * 10000) / 10000;
  const convertedAmount = Math.round(amount * rate * 10000) / 10000;
  const totalCost      = Math.round((amount + feeAmount) * 10000) / 10000;
  const quoteId        = genQuoteId();
  const now            = new Date();
  const expiresAt      = new Date(now.getTime() + 30 * 1000); // 30 seconds

  db.prepare(`
    INSERT OR IGNORE INTO pay_quotes
      (id, amount, from_currency, to_currency, method, exchange_rate, fee_pct, fee_amount, total_cost, settlement_time, expires_at)
    VALUES
      (@id, @amount, @from_currency, @to_currency, @method, @exchange_rate, @fee_pct, @fee_amount, @total_cost, @settlement_time, @expires_at)
  `).run({
    id: quoteId, amount, from_currency: fromCurrency, to_currency: toCurrency,
    method: resolvedMethod, exchange_rate: rate, fee_pct: feePct, fee_amount: feeAmount,
    total_cost: totalCost, settlement_time: settlementTime(resolvedMethod),
    expires_at: expiresAt.toISOString(),
  });

  return {
    quote_id:         quoteId,
    amount,
    from_currency:    fromCurrency,
    to_currency:      toCurrency,
    exchange_rate:    rate,
    converted_amount: convertedAmount,
    fee_pct:          feePct,
    fee_amount:       feeAmount,
    total_cost:       totalCost,
    method:           resolvedMethod,
    settlement_time:  settlementTime(resolvedMethod),
    expires_in_seconds: 30,
    expires_at:       expiresAt.toISOString(),
    free:             true,
  };
}

// ─── swap ─────────────────────────────────────────────────────────────────────

/**
 * Instant stablecoin swap. USDC↔USDT↔DAI↔PYUSD↔USDP↔FRAX
 *
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {string} [agentId]
 * @returns {{ tx_id, amount_received, rate, fee }}
 */
export function swap(amount, fromCurrency, toCurrency, agentId = "agent_anonymous") {
  const SWAPPABLE = ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"];
  if (!amount || amount <= 0)          throw new Error("amount must be a positive number");
  if (!fromCurrency || !toCurrency)    throw new Error("fromCurrency and toCurrency are required");
  if (fromCurrency === toCurrency)     throw new Error("fromCurrency and toCurrency must differ");
  if (!SWAPPABLE.includes(fromCurrency)) throw new Error(`${fromCurrency} is not swappable. Supported: ${SWAPPABLE.join(", ")}`);
  if (!SWAPPABLE.includes(toCurrency))   throw new Error(`${toCurrency} is not swappable. Supported: ${SWAPPABLE.join(", ")}`);

  const SWAP_FEE_PCT  = 0.0005;
  const rate          = getRate(fromCurrency, toCurrency);
  const feeAmount     = Math.round(amount * SWAP_FEE_PCT * 10000) / 10000;
  const converted     = Math.round((amount - feeAmount) * rate * 10000) / 10000;
  const txId          = genTxId();
  const now           = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pay_transactions
      (id, agent_id, type, amount, currency, method,
       fee_pct, fee_amount, net_amount,
       from_currency, to_currency, from_amount, to_amount, exchange_rate,
       status, created_at, completed_at)
    VALUES
      (@id, @agent_id, @type, @amount, @currency, @method,
       @fee_pct, @fee_amount, @net_amount,
       @from_currency, @to_currency, @from_amount, @to_amount, @exchange_rate,
       @status, @created_at, @completed_at)
  `).run({
    id: txId, agent_id: agentId, type: "swap", amount, currency: fromCurrency,
    method: "swap_amm", fee_pct: SWAP_FEE_PCT, fee_amount: feeAmount, net_amount: converted,
    from_currency: fromCurrency, to_currency: toCurrency, from_amount: amount,
    to_amount: converted, exchange_rate: rate, status: "completed", created_at: now, completed_at: now,
  });

  return {
    tx_id:           txId,
    from_currency:   fromCurrency,
    to_currency:     toCurrency,
    amount_sent:     amount,
    amount_received: converted,
    rate,
    fee_pct:         SWAP_FEE_PCT,
    fee_amount:      feeAmount,
    status:          "completed",
    settlement_time: "~2 seconds",
    created_at:      now,
  };
}

// ─── onramp ───────────────────────────────────────────────────────────────────

/**
 * Fiat to crypto onramp.
 *
 * @param {number} amount
 * @param {string} fiatCurrency  - USD | EUR | GBP | JPY | AUD | CAD | CHF | SGD | HKD | BRL | MXN | INR
 * @param {string} toCrypto      - USDC | USDT | DAI | PYUSD | USDP | FRAX
 * @param {string} paymentMethod - bank_transfer | card | apple_pay | google_pay
 * @param {string} [agentId]
 * @returns {{ tx_id, crypto_amount, rate, fee, estimated_arrival }}
 */
export function onramp(amount, fiatCurrency, toCrypto, paymentMethod, agentId = "agent_anonymous") {
  const FIATS  = ["USD","EUR","GBP","JPY","AUD","CAD","CHF","SGD","HKD","BRL","MXN","INR"];
  const CRYPTOS = ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"];
  const METHODS = ["bank_transfer","card","apple_pay","google_pay"];

  if (!amount || amount <= 0)           throw new Error("amount must be a positive number");
  if (!FIATS.includes(fiatCurrency))    throw new Error(`fiatCurrency must be one of: ${FIATS.join(", ")}`);
  if (!CRYPTOS.includes(toCrypto))      throw new Error(`toCrypto must be one of: ${CRYPTOS.join(", ")}`);
  if (!METHODS.includes(paymentMethod)) throw new Error(`paymentMethod must be one of: ${METHODS.join(", ")}`);

  const methodMap = { bank_transfer: "onramp_bank", card: "onramp_card", apple_pay: "onramp_card", google_pay: "onramp_card" };
  const internalMethod = methodMap[paymentMethod];
  const feePct   = paymentMethod === "bank_transfer" ? 0.01 : 0.025;
  const rate     = getRate(fiatCurrency, toCrypto);
  const feeAmount = Math.round(amount * feePct * 10000) / 10000;
  const cryptoAmount = Math.round((amount - feeAmount) * rate * 10000) / 10000;
  const arrival  = paymentMethod === "bank_transfer" ? "1-2 business days" : "instant";
  const txId     = genTxId();
  const now      = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pay_transactions
      (id, agent_id, type, amount, currency, method,
       fee_pct, fee_amount, net_amount,
       from_currency, to_currency, from_amount, to_amount, exchange_rate,
       status, estimated_arrival, created_at, completed_at)
    VALUES
      (@id, @agent_id, @type, @amount, @currency, @method,
       @fee_pct, @fee_amount, @net_amount,
       @from_currency, @to_currency, @from_amount, @to_amount, @exchange_rate,
       @status, @estimated_arrival, @created_at, @completed_at)
  `).run({
    id: txId, agent_id: agentId, type: "onramp", amount, currency: fiatCurrency,
    method: internalMethod, fee_pct: feePct, fee_amount: feeAmount, net_amount: cryptoAmount,
    from_currency: fiatCurrency, to_currency: toCrypto, from_amount: amount,
    to_amount: cryptoAmount, exchange_rate: rate, status: "completed",
    estimated_arrival: arrival, created_at: now, completed_at: now,
  });

  return {
    tx_id:             txId,
    fiat_currency:     fiatCurrency,
    crypto:            toCrypto,
    fiat_amount:       amount,
    crypto_amount:     cryptoAmount,
    rate,
    fee_pct:           feePct,
    fee_amount:        feeAmount,
    payment_method:    paymentMethod,
    status:            "completed",
    estimated_arrival: arrival,
    created_at:        now,
  };
}

// ─── offramp ──────────────────────────────────────────────────────────────────

/**
 * Crypto to fiat offramp.
 *
 * @param {number} amount
 * @param {string} fromCrypto     - USDC | USDT | DAI | PYUSD | USDP | FRAX
 * @param {string} toFiatCurrency - USD | EUR | GBP | ...
 * @param {string} destination    - Bank account, IBAN, routing+account
 * @param {string} [agentId]
 * @returns {{ tx_id, fiat_amount, rate, fee, bank_reference, estimated_arrival }}
 */
export function offramp(amount, fromCrypto, toFiatCurrency, destination, agentId = "agent_anonymous") {
  const CRYPTOS = ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"];
  const FIATS   = ["USD","EUR","GBP","JPY","AUD","CAD","CHF","SGD","HKD","BRL","MXN","INR"];

  if (!amount || amount <= 0)           throw new Error("amount must be a positive number");
  if (!CRYPTOS.includes(fromCrypto))    throw new Error(`fromCrypto must be one of: ${CRYPTOS.join(", ")}`);
  if (!FIATS.includes(toFiatCurrency))  throw new Error(`toFiatCurrency must be one of: ${FIATS.join(", ")}`);
  if (!destination)                     throw new Error("destination is required");

  const OFFRAMP_FEE = 0.01;
  const rate         = getRate(fromCrypto, toFiatCurrency);
  const feeAmount    = Math.round(amount * OFFRAMP_FEE * 10000) / 10000;
  const fiatAmount   = Math.round((amount - feeAmount) * rate * 10000) / 10000;
  const bankRef      = `OFR-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const txId         = genTxId();
  const now          = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pay_transactions
      (id, agent_id, type, amount, currency, recipient, method,
       fee_pct, fee_amount, net_amount,
       from_currency, to_currency, from_amount, to_amount, exchange_rate,
       status, bank_reference, estimated_arrival, created_at, completed_at)
    VALUES
      (@id, @agent_id, @type, @amount, @currency, @recipient, @method,
       @fee_pct, @fee_amount, @net_amount,
       @from_currency, @to_currency, @from_amount, @to_amount, @exchange_rate,
       @status, @bank_reference, @estimated_arrival, @created_at, @completed_at)
  `).run({
    id: txId, agent_id: agentId, type: "offramp", amount, currency: fromCrypto,
    recipient: destination, method: "offramp_ach", fee_pct: OFFRAMP_FEE,
    fee_amount: feeAmount, net_amount: fiatAmount,
    from_currency: fromCrypto, to_currency: toFiatCurrency, from_amount: amount,
    to_amount: fiatAmount, exchange_rate: rate, status: "completed",
    bank_reference: bankRef, estimated_arrival: "1-3 business days",
    created_at: now, completed_at: now,
  });

  return {
    tx_id:             txId,
    from_crypto:       fromCrypto,
    to_fiat:           toFiatCurrency,
    crypto_amount:     amount,
    fiat_amount:       fiatAmount,
    rate,
    fee_pct:           OFFRAMP_FEE,
    fee_amount:        feeAmount,
    destination,
    bank_reference:    bankRef,
    status:            "completed",
    estimated_arrival: "1-3 business days",
    created_at:        now,
  };
}

// ─── getSupportedCurrencies ───────────────────────────────────────────────────

// ─── Coming-soon Asian currencies ─────────────────────────────────────────────
const COMING_SOON_CURRENCIES = {
  CNY: {
    symbol:  "CNY",
    name:    "Chinese Yuan",
    type:    "fiat",
    status:  "coming_soon",
    methods: ["alipay", "wechat_pay", "unionpay"],
    note:    "Q3 2026",
  },
  HKD: {
    symbol:  "HKD",
    name:    "Hong Kong Dollar",
    type:    "fiat",
    status:  "coming_soon",
    methods: ["alipay"],
    note:    "Q3 2026",
  },
};

export function getSupportedCurrencies() {
  const rows = db.prepare("SELECT * FROM pay_currencies ORDER BY type, symbol").all();
  const liveCurrencies = rows.map(c => ({
    symbol:       c.symbol,
    name:         c.name,
    type:         c.type,
    peg:          c.peg,
    chains:       JSON.parse(c.chains || "[]"),
    methods:      JSON.parse(c.methods || "[]"),
    min_amount:   c.min_amount,
    max_amount:   c.max_amount,
    status:       "live",
    fee_schedule: {
      onchain: "0.10%",
      card:    "1.50%",
      ach:     "0.50%",
      swap:    "0.05%",
    },
  }));

  // Append coming-soon Chinese/HK currencies
  const comingSoonList = Object.values(COMING_SOON_CURRENCIES).map(c => ({
    symbol:       c.symbol,
    name:         c.name,
    type:         c.type,
    status:       c.status,
    methods:      c.methods,
    note:         c.note,
    chains:       [],
    min_amount:   1.00,
    max_amount:   1000000,
  }));

  return {
    currencies:    liveCurrencies,
    coming_soon:   comingSoonList,
    total:         rows.length,
    total_including_upcoming: rows.length + comingSoonList.length,
    free:          true,
  };
}

// ─── getSupportedMethods ──────────────────────────────────────────────────────

// ─── Chinese payment methods (coming Q3 2026) ─────────────────────────────────
const CHINESE_PAYMENT_METHODS = {
  alipay: {
    name:       "Alipay",
    status:     "coming_soon",
    currencies: ["CNY", "HKD"],
    fee:        "1.5%",
    note:       "Available Q3 2026",
  },
  wechat_pay: {
    name:       "WeChat Pay",
    status:     "coming_soon",
    currencies: ["CNY"],
    fee:        "1.5%",
    note:       "Available Q3 2026",
  },
  unionpay: {
    name:       "UnionPay",
    status:     "coming_soon",
    currencies: ["CNY", "USD"],
    fee:        "2%",
    note:       "Available Q3 2026",
  },
};

export function getSupportedMethods() {
  const rows = db.prepare("SELECT * FROM pay_methods ORDER BY fee_pct").all();
  const liveMethodsList = rows.map(m => ({
    name:                m.name,
    type:                m.type,
    currencies_supported: JSON.parse(m.currencies || "[]"),
    fee_pct:             m.fee_pct,
    fee_pct_display:     `${(m.fee_pct * 100).toFixed(3)}%`,
    settlement_time:     m.settlement_time,
    min_amount:          m.min_amount,
    max_amount:          m.max_amount,
    status:              "live",
  }));

  // Append coming-soon Chinese payment methods
  const comingSoonList = Object.entries(CHINESE_PAYMENT_METHODS).map(([key, m]) => ({
    name:                key,
    display_name:        m.name,
    type:                "wallet",
    currencies_supported: m.currencies,
    fee:                 m.fee,
    status:              m.status,
    note:                m.note,
  }));

  return {
    methods:      liveMethodsList,
    coming_soon:  comingSoonList,
    total:        rows.length,
    total_including_upcoming: rows.length + comingSoonList.length,
    free:         true,
  };
}

// ─── getPaymentHistory ────────────────────────────────────────────────────────

/**
 * Full payment history with analytics.
 *
 * @param {string} agentId
 * @param {object} [filters] - { type, currency, method, status, limit }
 * @returns {{ transactions[], total_volume, by_currency{}, by_method{}, avg_fee_pct }}
 */
export function getPaymentHistory(agentId, filters = {}) {
  if (!agentId) throw new Error("agentId is required");

  let sql = "SELECT * FROM pay_transactions WHERE agent_id = ?";
  const params = [agentId];

  if (filters.type)     { sql += " AND type = ?";     params.push(filters.type); }
  if (filters.currency) { sql += " AND currency = ?"; params.push(filters.currency); }
  if (filters.method)   { sql += " AND method = ?";   params.push(filters.method); }
  if (filters.status)   { sql += " AND status = ?";   params.push(filters.status); }

  sql += " ORDER BY created_at DESC";
  if (filters.limit)    { sql += ` LIMIT ${parseInt(filters.limit, 10)}`; }

  const txs = db.prepare(sql).all(...params);

  const totalVolume = txs.reduce((s, t) => s + (t.amount || 0), 0);
  const totalFees   = txs.reduce((s, t) => s + (t.fee_amount || 0), 0);
  const avgFeePct   = txs.length > 0 ? totalFees / totalVolume : 0;

  const byCurrency = {};
  const byMethod   = {};
  for (const t of txs) {
    byCurrency[t.currency] = (byCurrency[t.currency] || 0) + t.amount;
    if (t.method) byMethod[t.method] = (byMethod[t.method] || 0) + t.amount;
  }

  return {
    agent_id:      agentId,
    transactions:  txs,
    total_count:   txs.length,
    total_volume:  Math.round(totalVolume * 100) / 100,
    total_fees:    Math.round(totalFees * 100) / 100,
    avg_fee_pct:   Math.round(avgFeePct * 10000) / 10000,
    by_currency:   byCurrency,
    by_method:     byMethod,
    free:          true,
  };
}

// ─── createInvoice ────────────────────────────────────────────────────────────

/**
 * Create a payable invoice.
 *
 * @param {number} amount
 * @param {string} currency
 * @param {string} description
 * @param {string} [dueDate]        - ISO date string
 * @param {string} [recipientEmail]
 * @param {string} [agentId]
 * @returns {{ invoice_id, payment_link, qr_code_data, status, expires_at }}
 */
export function createInvoice(amount, currency, description, dueDate, recipientEmail, agentId = "agent_anonymous") {
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!currency)              throw new Error("currency is required");
  if (!description)           throw new Error("description is required");

  const invoiceId  = genInvoiceId();
  const payLink    = `https://hiveagentiq.com/pay/${invoiceId}`;
  const qrData     = `https://hiveagentiq.com/pay/${invoiceId}?qr=1`;
  const expiresAt  = dueDate
    ? new Date(new Date(dueDate).getTime() + 24 * 3600 * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pay_invoices
      (id, agent_id, amount, currency, description, recipient_email,
       payment_link, qr_code_data, status, due_date, expires_at, created_at)
    VALUES
      (@id, @agent_id, @amount, @currency, @description, @recipient_email,
       @payment_link, @qr_code_data, @status, @due_date, @expires_at, @created_at)
  `).run({
    id: invoiceId, agent_id: agentId, amount, currency, description,
    recipient_email: recipientEmail ?? null, payment_link: payLink,
    qr_code_data: qrData, status: "pending",
    due_date: dueDate ?? null, expires_at: expiresAt, created_at: now,
  });

  return {
    invoice_id:    invoiceId,
    amount,
    currency,
    description,
    recipient_email: recipientEmail ?? null,
    payment_link:  payLink,
    qr_code_data:  qrData,
    status:        "pending",
    due_date:      dueDate ?? null,
    expires_at:    expiresAt,
    invoice_fee:   0.25,
    created_at:    now,
  };
}

// ─── checkPaymentStatus ───────────────────────────────────────────────────────

/**
 * Check any payment status.
 *
 * @param {string} txId
 * @returns {{ status, confirmations, block_explorer_url }}
 */
export function checkPaymentStatus(txId) {
  if (!txId) throw new Error("txId is required");

  // Check transactions table
  const tx = db.prepare("SELECT * FROM pay_transactions WHERE id = ?").get(txId);
  if (tx) {
    const isOnchain = tx.method?.startsWith("onchain_") || tx.method === "lightning_btc";
    const confirmations = tx.status === "completed" ? (isOnchain ? 12 : 1) : 0;
    return {
      tx_id:             txId,
      type:              tx.type,
      status:            tx.status,
      amount:            tx.amount,
      currency:          tx.currency,
      method:            tx.method,
      confirmations,
      block_explorer_url: tx.block_explorer_url ?? null,
      receipt_url:       tx.receipt_url ?? null,
      bank_reference:    tx.bank_reference ?? null,
      created_at:        tx.created_at,
      completed_at:      tx.completed_at,
      free:              true,
    };
  }

  // Check invoices table
  const inv = db.prepare("SELECT * FROM pay_invoices WHERE id = ?").get(txId);
  if (inv) {
    return {
      tx_id:        txId,
      type:         "invoice",
      status:       inv.status,
      amount:       inv.amount,
      currency:     inv.currency,
      payment_link: inv.payment_link,
      due_date:     inv.due_date,
      expires_at:   inv.expires_at,
      paid_at:      inv.paid_at,
      free:         true,
    };
  }

  throw new Error(`Payment not found: ${txId}`);
}
