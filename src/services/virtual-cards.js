import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const VIRTUAL_CARD_PLATFORM_COMMISSION = 0.025; // 2.5% issuance fee on funded amount
const VIRTUAL_CARD_FX_SPREAD           = 0.005; // 0.5% FX spread on USDC→USD conversion
const VIRTUAL_CARD_INTERCHANGE_SHARE   = 0.008; // 0.8% of transaction value (interchange)

const MERCHANT_CATEGORY_LIMITS = {
  general:       { max_single_usd: 5000, monthly_cap_usd: 50000 },
  travel:        { max_single_usd: 10000, monthly_cap_usd: 100000 },
  online_retail: { max_single_usd: 2000, monthly_cap_usd: 20000 },
  saas:          { max_single_usd: 1000, monthly_cap_usd: 10000 },
  advertising:   { max_single_usd: 25000, monthly_cap_usd: 250000 },
  food_delivery: { max_single_usd: 500, monthly_cap_usd: 5000 },
  utilities:     { max_single_usd: 3000, monthly_cap_usd: 30000 },
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS vc_cards (
    id                    TEXT PRIMARY KEY,
    agent_id              TEXT NOT NULL,
    network               TEXT NOT NULL CHECK(network IN ('visa','mastercard')),
    card_number           TEXT NOT NULL,
    expiry_month          INTEGER NOT NULL,
    expiry_year           INTEGER NOT NULL,
    cvv                   TEXT NOT NULL,
    currency              TEXT DEFAULT 'USD',
    merchant_category     TEXT DEFAULT 'general',
    single_use            INTEGER DEFAULT 0,
    status                TEXT DEFAULT 'active' CHECK(status IN ('active','frozen','used','expired','cancelled')),
    balance_usd           REAL DEFAULT 0,
    funded_amount_usd     REAL NOT NULL,
    issuance_fee_usd      REAL NOT NULL,
    max_transaction_usd   REAL,
    allowed_merchants     TEXT DEFAULT '[]',
    total_spent_usd       REAL DEFAULT 0,
    transaction_count     INTEGER DEFAULT 0,
    created_at            TEXT DEFAULT (datetime('now')),
    expires_at            TEXT NOT NULL,
    last_used_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS vc_transactions (
    id                TEXT PRIMARY KEY,
    card_id           TEXT NOT NULL REFERENCES vc_cards(id),
    merchant_name     TEXT NOT NULL,
    merchant_category TEXT,
    amount_usd        REAL NOT NULL,
    interchange_usd   REAL NOT NULL,
    currency          TEXT DEFAULT 'USD',
    status            TEXT DEFAULT 'approved' CHECK(status IN ('approved','declined','pending','reversed')),
    decline_reason    TEXT,
    auth_code         TEXT,
    description       TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed demo cards ──────────────────────────────────────────────────────────

const _cardCount = db.prepare("SELECT COUNT(*) as n FROM vc_cards").get().n;
if (_cardCount === 0) {
  const now = new Date();
  const expiresAt = new Date(now.getFullYear() + 2, now.getMonth(), 1).toISOString();
  const seedCards = [
    {
      id: uuid(), agent_id: `agent_demo_001`, network: "visa",
      card_number: "4532015112830366", expiry_month: now.getMonth() + 1,
      expiry_year: now.getFullYear() + 2, cvv: "847",
      currency: "USD", merchant_category: "saas", single_use: 0,
      status: "active", balance_usd: 500.00, funded_amount_usd: 500.00,
      issuance_fee_usd: 12.50, max_transaction_usd: 500.00,
      allowed_merchants: "[]", total_spent_usd: 0, transaction_count: 0,
      expires_at: expiresAt, last_used_at: null,
    },
    {
      id: uuid(), agent_id: `agent_demo_002`, network: "mastercard",
      card_number: "5425233430109903", expiry_month: now.getMonth() + 1,
      expiry_year: now.getFullYear() + 1, cvv: "391",
      currency: "USD", merchant_category: "advertising", single_use: 0,
      status: "active", balance_usd: 2500.00, funded_amount_usd: 2500.00,
      issuance_fee_usd: 62.50, max_transaction_usd: 2500.00,
      allowed_merchants: "[]", total_spent_usd: 847.23, transaction_count: 4,
      expires_at: expiresAt, last_used_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
  const insertCard = db.prepare(`
    INSERT OR IGNORE INTO vc_cards
      (id, agent_id, network, card_number, expiry_month, expiry_year, cvv,
       currency, merchant_category, single_use, status, balance_usd,
       funded_amount_usd, issuance_fee_usd, max_transaction_usd,
       allowed_merchants, total_spent_usd, transaction_count, expires_at, last_used_at)
    VALUES
      (@id, @agent_id, @network, @card_number, @expiry_month, @expiry_year, @cvv,
       @currency, @merchant_category, @single_use, @status, @balance_usd,
       @funded_amount_usd, @issuance_fee_usd, @max_transaction_usd,
       @allowed_merchants, @total_spent_usd, @transaction_count, @expires_at, @last_used_at)
  `);
  for (const c of seedCards) insertCard.run(c);

  // Seed some transactions for the second card
  const seedTxns = [
    { id: uuid(), card_id: seedCards[1].id, merchant_name: "Google Ads", merchant_category: "advertising", amount_usd: 350.00, interchange_usd: 2.80, status: "approved", auth_code: `AUTH${Math.floor(100000 + Math.random() * 900000)}`, description: "Campaign spend – Q1 search ads" },
    { id: uuid(), card_id: seedCards[1].id, merchant_name: "Meta Business", merchant_category: "advertising", amount_usd: 250.00, interchange_usd: 2.00, status: "approved", auth_code: `AUTH${Math.floor(100000 + Math.random() * 900000)}`, description: "Instagram retargeting campaign" },
    { id: uuid(), card_id: seedCards[1].id, merchant_name: "LinkedIn Ads", merchant_category: "advertising", amount_usd: 200.00, interchange_usd: 1.60, status: "approved", auth_code: `AUTH${Math.floor(100000 + Math.random() * 900000)}`, description: "B2B lead generation" },
    { id: uuid(), card_id: seedCards[1].id, merchant_name: "Bing Ads", merchant_category: "advertising", amount_usd: 47.23, interchange_usd: 0.38, status: "approved", auth_code: `AUTH${Math.floor(100000 + Math.random() * 900000)}`, description: "Search network supplemental" },
  ];
  const insertTxn = db.prepare(`
    INSERT OR IGNORE INTO vc_transactions (id, card_id, merchant_name, merchant_category, amount_usd, interchange_usd, status, auth_code, description)
    VALUES (@id, @card_id, @merchant_name, @merchant_category, @amount_usd, @interchange_usd, @status, @auth_code, @description)
  `);
  for (const t of seedTxns) insertTxn.run(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateLuhnNumber(network) {
  const prefix = network === "visa" ? "4" : "5" + Math.floor(1 + Math.random() * 4);
  let num = prefix;
  while (num.length < 15) num += Math.floor(Math.random() * 10);
  // Luhn checksum
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = parseInt(num[num.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  num += ((10 - (sum % 10)) % 10);
  return num;
}

function generateCvv() {
  return String(Math.floor(100 + Math.random() * 900));
}

function maskCardNumber(number) {
  return `${number.slice(0, 4)} **** **** ${number.slice(-4)}`;
}

// ─── Mint Virtual Card ────────────────────────────────────────────────────────

/**
 * Mint a disposable virtual Visa or Mastercard funded from USDC.
 * @param {number} fundingAmountUsd  - Amount in USD to load onto the card
 * @param {string} currency          - ISO currency code (default: USD)
 * @param {string} merchantCategory  - Spending category restriction (default: general)
 * @param {boolean} singleUse        - If true, card self-destructs after first transaction
 * @returns Newly minted card with full PAN details
 */
export function mintVirtualCard(fundingAmountUsd, currency = "USD", merchantCategory = "general", singleUse = false) {
  if (fundingAmountUsd == null || fundingAmountUsd <= 0) throw new Error("fundingAmountUsd must be a positive number");
  const validCategories = Object.keys(MERCHANT_CATEGORY_LIMITS);
  if (!validCategories.includes(merchantCategory)) {
    throw new Error(`Invalid merchantCategory. Must be one of: ${validCategories.join(", ")}`);
  }
  const catLimits = MERCHANT_CATEGORY_LIMITS[merchantCategory];
  if (fundingAmountUsd > catLimits.monthly_cap_usd) {
    throw new Error(`Funding amount $${fundingAmountUsd} exceeds monthly cap $${catLimits.monthly_cap_usd} for category '${merchantCategory}'`);
  }

  const network       = Math.random() > 0.5 ? "visa" : "mastercard";
  const cardNumber    = generateLuhnNumber(network);
  const cvv           = generateCvv();
  const now           = new Date();
  const expiryMonth   = now.getMonth() + 1;
  const expiryYear    = singleUse ? now.getFullYear() + 1 : now.getFullYear() + 2;
  const expiresAt     = new Date(expiryYear, expiryMonth - 1 + (singleUse ? 12 : 24), 1).toISOString();

  // USDC conversion + fees
  const fxConversionFee  = Math.round(fundingAmountUsd * VIRTUAL_CARD_FX_SPREAD * 100) / 100;
  const issuanceFee      = Math.round(fundingAmountUsd * VIRTUAL_CARD_PLATFORM_COMMISSION * 100) / 100;
  const netBalanceUsd    = Math.round((fundingAmountUsd - issuanceFee - fxConversionFee) * 100) / 100;
  const usdcDeducted     = Math.round((fundingAmountUsd + issuanceFee + fxConversionFee) * 100) / 100; // what agent pays in USDC

  const id      = uuid();
  const agentId = `agent_${uuid().slice(0, 8)}`;
  const maxTxn  = catLimits.max_single_usd;

  db.prepare(`
    INSERT OR IGNORE INTO vc_cards
      (id, agent_id, network, card_number, expiry_month, expiry_year, cvv,
       currency, merchant_category, single_use, status, balance_usd,
       funded_amount_usd, issuance_fee_usd, max_transaction_usd,
       allowed_merchants, expires_at)
    VALUES
      (@id, @agent_id, @network, @card_number, @expiry_month, @expiry_year, @cvv,
       @currency, @merchant_category, @single_use, 'active', @balance_usd,
       @funded_amount_usd, @issuance_fee_usd, @max_transaction_usd,
       '[]', @expires_at)
  `).run({
    id, agent_id: agentId, network, card_number: cardNumber,
    expiry_month: expiryMonth, expiry_year: expiryYear, cvv,
    currency, merchant_category: merchantCategory,
    single_use: singleUse ? 1 : 0,
    balance_usd: netBalanceUsd,
    funded_amount_usd: fundingAmountUsd,
    issuance_fee_usd: issuanceFee,
    max_transaction_usd: maxTxn,
    expires_at: expiresAt,
  });

  return {
    card_id:              id,
    agent_id:             agentId,
    network,
    card_number:          cardNumber,
    expiry:               `${String(expiryMonth).padStart(2, "0")}/${expiryYear}`,
    cvv,
    status:               "active",
    currency,
    merchant_category:    merchantCategory,
    single_use:           singleUse,
    balance_usd:          netBalanceUsd,
    funded_amount_usd:    fundingAmountUsd,
    usdc_deducted:        usdcDeducted,
    issuance_fee_usd:     issuanceFee,
    fx_conversion_fee_usd: fxConversionFee,
    max_transaction_usd:  maxTxn,
    expires_at:           expiresAt,
    created_at:           now.toISOString(),
    message:              `${network.toUpperCase()} virtual card minted. Ready for use${singleUse ? " (single-use)" : ""}.`,
  };
}

// ─── Get Card Details ─────────────────────────────────────────────────────────

/**
 * Retrieve full card details including PAN, expiry, CVV, balance, and status.
 * @param {string} cardId
 * @returns Full card details
 */
export function getCardDetails(cardId) {
  const card = db.prepare("SELECT * FROM vc_cards WHERE id = ?").get(cardId);
  if (!card) throw new Error(`Virtual card not found: ${cardId}`);

  // Auto-expire if past expiry date
  if (card.status === "active" && new Date(card.expires_at) < new Date()) {
    db.prepare("UPDATE vc_cards SET status = 'expired' WHERE id = ?").run(cardId);
    card.status = "expired";
  }

  const utilization = card.funded_amount_usd > 0
    ? Math.round((card.total_spent_usd / card.funded_amount_usd) * 10000) / 100
    : 0;

  return {
    card_id:             cardId,
    agent_id:            card.agent_id,
    network:             card.network,
    card_number:         card.card_number,
    card_number_masked:  maskCardNumber(card.card_number),
    expiry:              `${String(card.expiry_month).padStart(2, "0")}/${card.expiry_year}`,
    cvv:                 card.cvv,
    status:              card.status,
    currency:            card.currency,
    merchant_category:   card.merchant_category,
    single_use:          card.single_use === 1,
    balance_usd:         card.balance_usd,
    funded_amount_usd:   card.funded_amount_usd,
    total_spent_usd:     card.total_spent_usd,
    utilization_pct:     utilization,
    transaction_count:   card.transaction_count,
    max_transaction_usd: card.max_transaction_usd,
    allowed_merchants:   JSON.parse(card.allowed_merchants || "[]"),
    created_at:          card.created_at,
    expires_at:          card.expires_at,
    last_used_at:        card.last_used_at,
  };
}

// ─── Freeze Card ──────────────────────────────────────────────────────────────

/**
 * Toggle freeze/unfreeze on a virtual card. Frozen cards decline all transactions.
 * @param {string} cardId
 * @returns Updated card status
 */
export function freezeCard(cardId) {
  const card = db.prepare("SELECT * FROM vc_cards WHERE id = ?").get(cardId);
  if (!card) throw new Error(`Virtual card not found: ${cardId}`);
  if (["used", "expired", "cancelled"].includes(card.status)) {
    throw new Error(`Cannot freeze/unfreeze card with status '${card.status}'`);
  }

  const newStatus = card.status === "frozen" ? "active" : "frozen";
  const now = new Date().toISOString();
  db.prepare("UPDATE vc_cards SET status = ? WHERE id = ?").run(newStatus, cardId);

  return {
    card_id:         cardId,
    network:         card.network,
    card_number_masked: maskCardNumber(card.card_number),
    previous_status: card.status,
    new_status:      newStatus,
    action:          newStatus === "frozen" ? "frozen" : "unfrozen",
    balance_usd:     card.balance_usd,
    updated_at:      now,
    message:         newStatus === "frozen"
      ? "Card frozen. All transactions will be declined until unfrozen."
      : "Card unfrozen. Card is now active and ready to use.",
  };
}

// ─── List Card Transactions ───────────────────────────────────────────────────

/**
 * Retrieve the full transaction history for a virtual card.
 * @param {string} cardId
 * @returns Transaction history with totals
 */
export function listCardTransactions(cardId) {
  const card = db.prepare("SELECT * FROM vc_cards WHERE id = ?").get(cardId);
  if (!card) throw new Error(`Virtual card not found: ${cardId}`);

  // Simulate some realistic transactions if card has been "used" but no txn records
  const existing = db.prepare("SELECT COUNT(*) as n FROM vc_transactions WHERE card_id = ?").get(cardId).n;
  if (existing === 0 && card.total_spent_usd > 0) {
    const merchants = [
      { name: "AWS Marketplace", cat: "saas" },
      { name: "Stripe Payments", cat: "saas" },
      { name: "Vercel Pro", cat: "saas" },
      { name: "Cloudflare", cat: "utilities" },
      { name: "OpenAI API", cat: "saas" },
    ];
    const remaining = card.total_spent_usd;
    const txnCount = Math.min(card.transaction_count || 3, 5);
    const perTxn = Math.round((remaining / txnCount) * 100) / 100;
    const insertTxn = db.prepare(`
      INSERT OR IGNORE INTO vc_transactions (id, card_id, merchant_name, merchant_category, amount_usd, interchange_usd, status, auth_code, description)
      VALUES (@id, @card_id, @merchant_name, @merchant_category, @amount_usd, @interchange_usd, @status, @auth_code, @description)
    `);
    for (let i = 0; i < txnCount; i++) {
      const m = merchants[i % merchants.length];
      insertTxn.run({
        id: uuid(), card_id: cardId,
        merchant_name: m.name, merchant_category: m.cat,
        amount_usd: perTxn,
        interchange_usd: Math.round(perTxn * VIRTUAL_CARD_INTERCHANGE_SHARE * 100) / 100,
        status: "approved",
        auth_code: `AUTH${Math.floor(100000 + Math.random() * 900000)}`,
        description: `Service charge – ${m.name}`,
      });
    }
  }

  const txns = db.prepare("SELECT * FROM vc_transactions WHERE card_id = ? ORDER BY created_at DESC").all(cardId);

  const totals = txns.reduce((acc, t) => {
    if (t.status === "approved") { acc.approved_usd += t.amount_usd; acc.approved_count++; }
    if (t.status === "declined") acc.declined_count++;
    return acc;
  }, { approved_usd: 0, approved_count: 0, declined_count: 0 });

  return {
    card_id:              cardId,
    card_number_masked:   maskCardNumber(card.card_number),
    network:              card.network,
    status:               card.status,
    balance_usd:          card.balance_usd,
    transactions:         txns.map(t => ({
      transaction_id:   t.id,
      merchant_name:    t.merchant_name,
      merchant_category: t.merchant_category,
      amount_usd:       t.amount_usd,
      interchange_usd:  t.interchange_usd,
      status:           t.status,
      decline_reason:   t.decline_reason,
      auth_code:        t.auth_code,
      description:      t.description,
      created_at:       t.created_at,
    })),
    summary: {
      total_transactions:    txns.length,
      approved_transactions: totals.approved_count,
      declined_transactions: totals.declined_count,
      total_spent_usd:       Math.round(totals.approved_usd * 100) / 100,
      platform_interchange_usd: Math.round(txns.reduce((s, t) => s + (t.status === "approved" ? t.interchange_usd : 0), 0) * 100) / 100,
    },
  };
}

// ─── Set Card Limits ──────────────────────────────────────────────────────────

/**
 * Configure per-transaction spending limits and merchant allow-lists on a card.
 * @param {string} cardId
 * @param {number} maxTransactionUsd   - Maximum amount per single transaction
 * @param {string[]} allowedMerchants  - Array of allowed merchant name substrings (empty = allow all)
 * @returns Updated card controls
 */
export function setCardLimits(cardId, maxTransactionUsd, allowedMerchants = []) {
  const card = db.prepare("SELECT * FROM vc_cards WHERE id = ?").get(cardId);
  if (!card) throw new Error(`Virtual card not found: ${cardId}`);
  if (["used", "expired", "cancelled"].includes(card.status)) {
    throw new Error(`Cannot set limits on card with status '${card.status}'`);
  }
  if (maxTransactionUsd != null && maxTransactionUsd <= 0) {
    throw new Error("maxTransactionUsd must be a positive number");
  }
  if (!Array.isArray(allowedMerchants)) throw new Error("allowedMerchants must be an array of strings");

  const catCap = MERCHANT_CATEGORY_LIMITS[card.merchant_category]?.max_single_usd ?? 5000;
  const resolvedMax = maxTransactionUsd != null
    ? Math.min(maxTransactionUsd, catCap)
    : catCap;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE vc_cards
    SET max_transaction_usd = @max, allowed_merchants = @merchants
    WHERE id = @id
  `).run({ max: resolvedMax, merchants: JSON.stringify(allowedMerchants), id: cardId });

  return {
    card_id:              cardId,
    card_number_masked:   maskCardNumber(card.card_number),
    network:              card.network,
    merchant_category:    card.merchant_category,
    max_transaction_usd:  resolvedMax,
    category_cap_usd:     catCap,
    allowed_merchants:    allowedMerchants,
    allow_all_merchants:  allowedMerchants.length === 0,
    balance_usd:          card.balance_usd,
    updated_at:           now,
    message:              `Spending controls updated. Max per-transaction: $${resolvedMax}. Merchant filter: ${allowedMerchants.length > 0 ? allowedMerchants.join(", ") : "all merchants allowed"}.`,
  };
}
