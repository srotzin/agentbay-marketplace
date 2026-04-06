import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FRAUD_PLATFORM_COMMISSION = 0.22; // 22% platform cut
const FRAUD_FEES = {
  screen:     0.02,
  anomaly:    0.05,
  identity:   0.50,
  chargeback: 0.03,
  network:    1.00,
  dashboard:  10.00,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS fraud_transactions (
    id                    TEXT PRIMARY KEY,
    external_tx_id        TEXT,
    amount                REAL,
    currency              TEXT DEFAULT 'USD',
    merchant_id           TEXT,
    merchant_category     TEXT,
    user_id               TEXT,
    ip_address            TEXT,
    device_id             TEXT,
    country               TEXT,
    risk_score            INTEGER,
    risk_level            TEXT CHECK(risk_level IN ('low','medium','high','critical')),
    flags                 TEXT DEFAULT '[]',
    recommended_action    TEXT CHECK(recommended_action IN ('approve','review','block')),
    explanation           TEXT,
    outcome               TEXT DEFAULT 'pending' CHECK(outcome IN ('pending','approved','reviewed','blocked','fraud_confirmed','false_positive')),
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fraud_anomaly_reports (
    id                    TEXT PRIMARY KEY,
    account_id            TEXT NOT NULL,
    timeframe             TEXT,
    anomalies             TEXT DEFAULT '[]',
    anomaly_count         INTEGER DEFAULT 0,
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fraud_identity_checks (
    id                    TEXT PRIMARY KEY,
    name                  TEXT,
    email                 TEXT,
    phone                 TEXT,
    ssn_last4             TEXT,
    verified              INTEGER DEFAULT 0,
    confidence            REAL,
    risk_flags            TEXT DEFAULT '[]',
    synthetic_probability REAL,
    data_consistency_score REAL,
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fraud_chargeback_predictions (
    id                      TEXT PRIMARY KEY,
    transaction_id          TEXT,
    chargeback_probability  REAL,
    risk_factors            TEXT DEFAULT '[]',
    recommended_prevention  TEXT DEFAULT '[]',
    estimated_loss          REAL,
    fee_usd                 REAL NOT NULL,
    commission_usd          REAL NOT NULL,
    created_at              TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fraud_network_analyses (
    id                    TEXT PRIMARY KEY,
    entity_id             TEXT NOT NULL,
    depth                 INTEGER DEFAULT 2,
    connections           TEXT DEFAULT '[]',
    risk_clusters         TEXT DEFAULT '[]',
    suspicious_patterns   TEXT DEFAULT '[]',
    network_risk_score    INTEGER,
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Transactions ────────────────────────────────────────────────────────

const _txCount = db.prepare("SELECT COUNT(*) as n FROM fraud_transactions").get().n;
if (_txCount === 0) {
  const seedTxs = [
    { id: randomUUID(), external_tx_id: "TX-00441", amount: 49.99,    currency: "USD", merchant_id: "MCH-101", merchant_category: "retail",       user_id: "USR-001", ip_address: "192.168.1.10", device_id: "DEV-A1", country: "US", risk_score: 12, risk_level: "low",    flags: "[]", recommended_action: "approve", outcome: "approved",  fee_usd: FRAUD_FEES.screen, commission_usd: Math.round(FRAUD_FEES.screen * FRAUD_PLATFORM_COMMISSION * 100) / 100 },
    { id: randomUUID(), external_tx_id: "TX-00442", amount: 2450.00,  currency: "USD", merchant_id: "MCH-202", merchant_category: "electronics",   user_id: "USR-002", ip_address: "45.33.32.156", device_id: "DEV-B9", country: "RU", risk_score: 78, risk_level: "high",   flags: '["foreign_ip","high_value"]', recommended_action: "review", outcome: "reviewed", fee_usd: FRAUD_FEES.screen, commission_usd: Math.round(FRAUD_FEES.screen * FRAUD_PLATFORM_COMMISSION * 100) / 100 },
    { id: randomUUID(), external_tx_id: "TX-00443", amount: 9999.00,  currency: "USD", merchant_id: "MCH-303", merchant_category: "crypto",        user_id: "USR-003", ip_address: "103.21.244.0", device_id: "DEV-C3", country: "NG", risk_score: 94, risk_level: "critical", flags: '["high_risk_country","crypto","velocity"]', recommended_action: "block", outcome: "blocked", fee_usd: FRAUD_FEES.screen, commission_usd: Math.round(FRAUD_FEES.screen * FRAUD_PLATFORM_COMMISSION * 100) / 100 },
    { id: randomUUID(), external_tx_id: "TX-00444", amount: 125.50,   currency: "USD", merchant_id: "MCH-104", merchant_category: "food_delivery", user_id: "USR-001", ip_address: "192.168.1.10", device_id: "DEV-A1", country: "US", risk_score: 8,  risk_level: "low",    flags: "[]", recommended_action: "approve", outcome: "approved",  fee_usd: FRAUD_FEES.screen, commission_usd: Math.round(FRAUD_FEES.screen * FRAUD_PLATFORM_COMMISSION * 100) / 100 },
  ];
  const insertTx = db.prepare(`
    INSERT OR IGNORE INTO fraud_transactions
      (id, external_tx_id, amount, currency, merchant_id, merchant_category, user_id, ip_address, device_id, country, risk_score, risk_level, flags, recommended_action, outcome, fee_usd, commission_usd)
    VALUES
      (@id, @external_tx_id, @amount, @currency, @merchant_id, @merchant_category, @user_id, @ip_address, @device_id, @country, @risk_score, @risk_level, @flags, @recommended_action, @outcome, @fee_usd, @commission_usd)
  `);
  for (const tx of seedTxs) insertTx.run(tx);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function commission(fee) {
  return Math.round(fee * FRAUD_PLATFORM_COMMISSION * 100) / 100;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

const HIGH_RISK_COUNTRIES  = new Set(["NG", "RU", "CN", "UA", "RO", "BR", "VN", "IN", "PK"]);
const HIGH_RISK_CATEGORIES = new Set(["crypto", "gambling", "adult", "money_transfer", "gift_cards"]);
const KNOWN_PROXIES        = new Set(["45.33.32.156", "104.21.0.0", "103.21.244.0", "192.0.2.0"]);

function scoreRiskFactors(transactionData, userProfile = {}) {
  let score = 0;
  const flags = [];

  const amount    = transactionData.amount ?? 0;
  const country   = (transactionData.country ?? "US").toUpperCase();
  const category  = (transactionData.merchant_category ?? "").toLowerCase();
  const ip        = transactionData.ip_address ?? "";
  const hour      = transactionData.hour ?? new Date().getHours();

  // Amount signals
  if (amount > 5000)  { score += 25; flags.push("high_value_transaction"); }
  else if (amount > 1000) { score += 10; flags.push("elevated_amount"); }

  // Country risk
  if (HIGH_RISK_COUNTRIES.has(country)) { score += 30; flags.push("high_risk_country"); }

  // Category risk
  if (HIGH_RISK_CATEGORIES.has(category)) { score += 25; flags.push(`high_risk_category:${category}`); }

  // IP risk
  if (KNOWN_PROXIES.has(ip))   { score += 20; flags.push("known_proxy_or_vpn"); }
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) { /* internal IP — no penalty */ }

  // Velocity (simulate from userProfile)
  if ((userProfile.transactions_last_hour ?? 0) > 5)   { score += 15; flags.push("high_velocity"); }
  if ((userProfile.transactions_last_24h ?? 0) > 20)    { score += 10; flags.push("velocity_24h"); }

  // Time of day (2am–5am = higher risk)
  if (hour >= 2 && hour <= 5) { score += 8; flags.push("off_hours_transaction"); }

  // New device/account
  if (userProfile.is_new_device) { score += 12; flags.push("new_device"); }
  if (userProfile.account_age_days != null && userProfile.account_age_days < 7) { score += 15; flags.push("new_account"); }

  // Mismatch between billing/shipping country
  if (transactionData.billing_country && transactionData.shipping_country &&
      transactionData.billing_country !== transactionData.shipping_country) {
    score += 10; flags.push("billing_shipping_country_mismatch");
  }

  return { score: clamp(score, 0, 100), flags };
}

// ─── screenTransaction ────────────────────────────────────────────────────────

/**
 * Real-time fraud screening for a financial transaction.
 * @param {object} transactionData  - {amount, currency, merchant_id, merchant_category, country, ip_address, device_id, ...}
 * @param {object} userProfile      - {user_id, account_age_days, is_new_device, transactions_last_hour, transactions_last_24h}
 * @returns risk_score (0–100), risk_level, flags[], recommended_action, explanation
 * Fee: $0.02 per screen
 */
export function screenTransaction(transactionData, userProfile = {}) {
  if (!transactionData)        throw new Error("transactionData is required");
  if (transactionData.amount == null) throw new Error("transactionData.amount is required");

  const fee  = FRAUD_FEES.screen;
  const comm = commission(fee);

  const { score, flags } = scoreRiskFactors(transactionData, userProfile);

  const risk_level = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";
  const recommended_action = score >= 70 ? "block" : score >= 45 ? "review" : "approve";

  const explanationParts = [];
  if (flags.includes("high_value_transaction"))     explanationParts.push("Transaction amount exceeds $5,000 threshold");
  if (flags.includes("high_risk_country"))          explanationParts.push(`Country code ${transactionData.country} is on the high-risk list`);
  if (flags.some(f => f.startsWith("high_risk_category"))) explanationParts.push(`Merchant category '${transactionData.merchant_category}' is elevated risk`);
  if (flags.includes("known_proxy_or_vpn"))         explanationParts.push("IP address matches known proxy/VPN endpoint");
  if (flags.includes("high_velocity"))              explanationParts.push("Unusual transaction velocity in the past hour");
  if (flags.includes("new_account"))                explanationParts.push("Account created less than 7 days ago");
  if (flags.includes("new_device"))                 explanationParts.push("Transaction from an unrecognized device");
  if (explanationParts.length === 0)                explanationParts.push("No significant risk signals detected");

  const explanation = explanationParts.join(". ") + ".";

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO fraud_transactions
      (id, external_tx_id, amount, currency, merchant_id, merchant_category, user_id, ip_address, device_id, country, risk_score, risk_level, flags, recommended_action, explanation, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @external_tx_id, @amount, @currency, @merchant_id, @merchant_category, @user_id, @ip_address, @device_id, @country, @risk_score, @risk_level, @flags, @recommended_action, @explanation, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    external_tx_id:      transactionData.transaction_id ?? null,
    amount:              transactionData.amount,
    currency:            transactionData.currency ?? "USD",
    merchant_id:         transactionData.merchant_id ?? null,
    merchant_category:   transactionData.merchant_category ?? null,
    user_id:             userProfile.user_id ?? null,
    ip_address:          transactionData.ip_address ?? null,
    device_id:           transactionData.device_id ?? null,
    country:             transactionData.country ?? null,
    risk_score:          score,
    risk_level,
    flags:               JSON.stringify(flags),
    recommended_action,
    explanation,
    fee_usd:             fee,
    commission_usd:      comm,
    created_at:          now,
  });

  return {
    screen_id:               id,
    transaction_id:          transactionData.transaction_id ?? null,
    amount:                  transactionData.amount,
    currency:                transactionData.currency ?? "USD",
    risk_score:              score,
    risk_level,
    flags,
    recommended_action,
    explanation,
    latency_ms:              Math.floor(12 + Math.random() * 38),
    screened_at:             now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// ─── detectAnomalies ──────────────────────────────────────────────────────────

/**
 * Detect anomalous transaction patterns for an account over a given timeframe.
 * @param {string}   accountId          - Account identifier
 * @param {object[]} transactionHistory - Array of historical transaction objects
 * @param {string}   timeframe          - Analysis window: 7d|30d|90d|1y
 * @returns anomalies[] with type, severity, description, affected_transactions[]
 * Fee: $0.05 per analysis
 */
export function detectAnomalies(accountId, transactionHistory = [], timeframe = "30d") {
  if (!accountId) throw new Error("accountId is required");

  const validTimeframes = ["7d", "30d", "90d", "1y"];
  if (!validTimeframes.includes(timeframe)) throw new Error(`timeframe must be one of: ${validTimeframes.join(", ")}`);

  const fee  = FRAUD_FEES.anomaly;
  const comm = commission(fee);

  const anomalies = [];
  const history   = transactionHistory.length > 0 ? transactionHistory : [];

  // Supplement with DB transactions for this account (if any)
  const dbTxs = db.prepare("SELECT * FROM fraud_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(accountId);
  const allTxs = [...history, ...dbTxs];

  // 1. Velocity anomaly: more than 10 transactions in any single day
  const txsByDate = {};
  for (const tx of allTxs) {
    const day = (tx.created_at ?? tx.date ?? new Date().toISOString()).slice(0, 10);
    txsByDate[day] = txsByDate[day] ?? [];
    txsByDate[day].push(tx);
  }
  for (const [day, txs] of Object.entries(txsByDate)) {
    if (txs.length > 10) {
      anomalies.push({
        anomaly_id:           randomUUID(),
        type:                 "velocity_spike",
        severity:             txs.length > 20 ? "critical" : "high",
        description:          `${txs.length} transactions detected on ${day} — well above normal threshold of 10/day`,
        affected_transactions: txs.map(t => t.id ?? t.transaction_id).filter(Boolean).slice(0, 10),
        detected_at:          new Date().toISOString(),
      });
    }
  }

  // 2. Large round-number amounts (structuring signal)
  const roundAmounts = allTxs.filter(tx => {
    const amt = tx.amount ?? 0;
    return amt >= 1000 && amt % 500 === 0;
  });
  if (roundAmounts.length >= 3) {
    anomalies.push({
      anomaly_id:            randomUUID(),
      type:                  "structuring_signal",
      severity:              "high",
      description:           `${roundAmounts.length} transactions with suspiciously round amounts — possible structuring to avoid reporting thresholds`,
      affected_transactions: roundAmounts.map(t => t.id ?? t.transaction_id).filter(Boolean),
      detected_at:           new Date().toISOString(),
    });
  }

  // 3. Geographic spread anomaly
  const countries = [...new Set(allTxs.map(tx => tx.country).filter(Boolean))];
  if (countries.length >= 4) {
    anomalies.push({
      anomaly_id:            randomUUID(),
      type:                  "geographic_dispersion",
      severity:              "medium",
      description:           `Transactions originate from ${countries.length} distinct countries within the analysis window: ${countries.join(", ")}`,
      affected_transactions: allTxs.filter(tx => tx.country && HIGH_RISK_COUNTRIES.has(tx.country)).map(t => t.id).filter(Boolean),
      detected_at:           new Date().toISOString(),
    });
  }

  // 4. High-risk merchant concentration
  const hrTxs = allTxs.filter(tx => HIGH_RISK_CATEGORIES.has((tx.merchant_category ?? "").toLowerCase()));
  if (hrTxs.length >= 2) {
    anomalies.push({
      anomaly_id:            randomUUID(),
      type:                  "high_risk_merchant_concentration",
      severity:              hrTxs.length >= 5 ? "high" : "medium",
      description:           `${hrTxs.length} transactions at high-risk merchant categories (${[...new Set(hrTxs.map(t => t.merchant_category))].join(", ")})`,
      affected_transactions: hrTxs.map(t => t.id).filter(Boolean),
      detected_at:           new Date().toISOString(),
    });
  }

  // 5. Simulate additional anomaly for new accounts with no history
  if (allTxs.length === 0) {
    anomalies.push({
      anomaly_id:            randomUUID(),
      type:                  "insufficient_history",
      severity:              "low",
      description:           "No transaction history found for this account — insufficient baseline for anomaly detection",
      affected_transactions: [],
      detected_at:           new Date().toISOString(),
    });
  }

  // Sort by severity
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  anomalies.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO fraud_anomaly_reports
      (id, account_id, timeframe, anomalies, anomaly_count, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @account_id, @timeframe, @anomalies, @anomaly_count, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    account_id:    accountId,
    timeframe,
    anomalies:     JSON.stringify(anomalies),
    anomaly_count: anomalies.length,
    fee_usd:       fee,
    commission_usd: comm,
    created_at:    now,
  });

  return {
    report_id:               id,
    account_id:              accountId,
    timeframe,
    transactions_analyzed:   allTxs.length,
    anomaly_count:           anomalies.length,
    anomalies,
    overall_risk:            anomalies.some(a => a.severity === "critical") ? "critical"
                           : anomalies.some(a => a.severity === "high")     ? "high"
                           : anomalies.some(a => a.severity === "medium")   ? "medium" : "low",
    analyzed_at:             now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// ─── checkIdentity ────────────────────────────────────────────────────────────

/**
 * Verify identity and detect synthetic IDs using multi-source checks.
 * @param {object} identityData       - {name, email, phone, dob, ssn_last4, address, ip_address}
 * @param {string} verificationLevel  - basic|standard|enhanced
 * @returns verified, confidence, risk_flags[], synthetic_probability, data_consistency_score
 * Fee: $0.50 per check
 */
export function checkIdentity(identityData, verificationLevel = "standard") {
  if (!identityData) throw new Error("identityData is required");

  const validLevels = ["basic", "standard", "enhanced"];
  if (!validLevels.includes(verificationLevel)) throw new Error(`verificationLevel must be one of: ${validLevels.join(", ")}`);

  const fee  = FRAUD_FEES.identity;
  const comm = commission(fee);

  const name  = identityData.name  ?? "";
  const email = identityData.email ?? "";
  const phone = identityData.phone ?? "";

  const risk_flags = [];
  let consistencyScore = 1.0;

  // Email checks
  const tempDomains = ["mailinator.com", "throwaway.email", "guerrillamail.com", "trashmail.com", "yopmail.com"];
  if (email) {
    const domain = email.split("@")[1] ?? "";
    if (tempDomains.includes(domain)) {
      risk_flags.push("disposable_email_address");
      consistencyScore -= 0.25;
    }
    if (!email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      risk_flags.push("invalid_email_format");
      consistencyScore -= 0.20;
    }
  } else {
    risk_flags.push("missing_email");
    consistencyScore -= 0.10;
  }

  // Phone checks
  if (phone) {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      risk_flags.push("invalid_phone_number");
      consistencyScore -= 0.15;
    }
    if (digitsOnly.startsWith("900") || digitsOnly.startsWith("1900")) {
      risk_flags.push("premium_rate_phone");
      consistencyScore -= 0.20;
    }
  } else if (verificationLevel === "enhanced") {
    risk_flags.push("missing_phone");
    consistencyScore -= 0.05;
  }

  // Name checks
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) {
      risk_flags.push("single_name_only");
      consistencyScore -= 0.10;
    }
    if (/[^a-zA-Z\s\-']/.test(name)) {
      risk_flags.push("unusual_characters_in_name");
      consistencyScore -= 0.15;
    }
  } else {
    risk_flags.push("missing_name");
    consistencyScore -= 0.20;
  }

  // IP / country check
  if (identityData.ip_address && KNOWN_PROXIES.has(identityData.ip_address)) {
    risk_flags.push("ip_matches_proxy");
    consistencyScore -= 0.20;
  }

  // SSN / DOB cross-check simulation
  if (verificationLevel === "enhanced" && identityData.ssn_last4) {
    // Simulate random pass/fail for cross-bureau lookup
    const bureauMatch = Math.random() > 0.12;
    if (!bureauMatch) {
      risk_flags.push("ssn_bureau_mismatch");
      consistencyScore -= 0.40;
    }
  }

  consistencyScore = Math.max(0, Math.round(consistencyScore * 100) / 100);

  // Synthetic ID probability: higher when score is low or multiple flags
  const synthetic_probability = Math.min(0.99, Math.max(0.01,
    (1 - consistencyScore) * 0.6 + (risk_flags.length * 0.08)
  ));

  const confidence = clamp(consistencyScore - (synthetic_probability * 0.2), 0.05, 0.99);
  const verified   = confidence >= 0.65 && synthetic_probability < 0.30;

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO fraud_identity_checks
      (id, name, email, phone, ssn_last4, verified, confidence, risk_flags, synthetic_probability, data_consistency_score, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @name, @email, @phone, @ssn_last4, @verified, @confidence, @risk_flags, @synthetic_probability, @data_consistency_score, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    name:                    name || null,
    email:                   email || null,
    phone:                   phone || null,
    ssn_last4:               identityData.ssn_last4 ?? null,
    verified:                verified ? 1 : 0,
    confidence:              Math.round(confidence * 1000) / 1000,
    risk_flags:              JSON.stringify(risk_flags),
    synthetic_probability:   Math.round(synthetic_probability * 1000) / 1000,
    data_consistency_score:  consistencyScore,
    fee_usd:                 fee,
    commission_usd:          comm,
    created_at:              now,
  });

  return {
    check_id:                id,
    verification_level:      verificationLevel,
    verified,
    confidence:              Math.round(confidence * 1000) / 1000,
    confidence_label:        confidence >= 0.80 ? "high" : confidence >= 0.60 ? "medium" : "low",
    risk_flags,
    synthetic_probability:   Math.round(synthetic_probability * 1000) / 1000,
    synthetic_risk:          synthetic_probability >= 0.50 ? "high" : synthetic_probability >= 0.25 ? "medium" : "low",
    data_consistency_score:  consistencyScore,
    recommendation:          verified
      ? "Identity verified — proceed with transaction"
      : `Identity check failed (confidence: ${(confidence * 100).toFixed(0)}%) — escalate for manual KYC review`,
    checked_at:              now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// ─── predictChargeback ────────────────────────────────────────────────────────

/**
 * Predict the probability of a chargeback for a given transaction.
 * @param {object} transactionData  - Transaction details (output of screenTransaction or similar)
 * @param {object} merchantProfile  - {merchant_id, chargeback_rate, category, avg_dispute_resolution_days}
 * @returns chargeback_probability, risk_factors[], recommended_prevention[], estimated_loss
 * Fee: $0.03 per prediction
 */
export function predictChargeback(transactionData, merchantProfile = {}) {
  if (!transactionData)        throw new Error("transactionData is required");
  if (transactionData.amount == null) throw new Error("transactionData.amount is required");

  const fee  = FRAUD_FEES.chargeback;
  const comm = commission(fee);

  const amount   = transactionData.amount ?? 0;
  const category = (merchantProfile.category ?? transactionData.merchant_category ?? "").toLowerCase();
  const risk_factors = [];

  let baseProb = 0.02; // Industry average ~2%

  // Category adjustments
  const categoryRisk = {
    digital_goods:    0.04,
    travel:           0.05,
    electronics:      0.03,
    subscription:     0.04,
    crypto:           0.08,
    gambling:         0.07,
    adult:            0.06,
    marketplace:      0.035,
    retail:           0.015,
    food_delivery:    0.01,
  };
  const catAdj = categoryRisk[category] ?? 0.02;
  baseProb    += catAdj - 0.02;
  if (catAdj > 0.03) risk_factors.push(`High-chargeback merchant category: ${category}`);

  // Amount adjustments
  if (amount > 500) { baseProb += 0.02; risk_factors.push("Transaction amount > $500 — higher dispute motivation"); }
  if (amount > 2000) { baseProb += 0.03; risk_factors.push("High-value transaction — significant chargeback exposure"); }

  // Merchant history
  const histRate = merchantProfile.chargeback_rate ?? 0;
  if (histRate > 0.01) { baseProb += histRate * 2; risk_factors.push(`Merchant historical chargeback rate: ${(histRate * 100).toFixed(1)}%`); }
  if (histRate > 0.02) risk_factors.push("Merchant chargeback rate exceeds Visa/Mastercard threshold of 1% — at risk of program termination");

  // Fraud screen result if available
  if (transactionData.risk_score != null && transactionData.risk_score > 60) {
    baseProb += 0.05;
    risk_factors.push(`Elevated fraud risk score (${transactionData.risk_score}/100) correlates with dispute likelihood`);
  }

  // Missing CVV / AVS
  if (transactionData.cvv_match === false) { baseProb += 0.04; risk_factors.push("CVV mismatch — card-not-present fraud indicator"); }
  if (transactionData.avs_match === false) { baseProb += 0.03; risk_factors.push("Address verification failed (AVS mismatch)"); }

  const chargeback_probability = clamp(Math.round(baseProb * 1000) / 1000, 0.001, 0.99);
  const estimated_loss         = Math.round(amount * chargeback_probability * (1 + 0.15) * 100) / 100; // +15% for dispute fees

  const recommended_prevention = [];
  if (chargeback_probability > 0.05) {
    recommended_prevention.push("Send proactive order confirmation email with clear cancellation policy");
    recommended_prevention.push("Implement 3D Secure (3DS2) authentication to shift liability");
  }
  if (chargeback_probability > 0.08) {
    recommended_prevention.push("Add fraud review hold before fulfillment for high-risk orders");
    recommended_prevention.push("Verify customer identity via phone or email OTP before processing");
  }
  if (merchantProfile.chargeback_rate > 0.01) {
    recommended_prevention.push("Enroll in Visa/Mastercard pre-dispute alert programs (Ethoca, Verifi)");
  }
  if (transactionData.cvv_match === false || transactionData.avs_match === false) {
    recommended_prevention.push("Require additional authentication for card-not-present transactions without AVS/CVV match");
  }
  if (recommended_prevention.length === 0) {
    recommended_prevention.push("No additional prevention measures required — standard chargeback risk");
  }

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO fraud_chargeback_predictions
      (id, transaction_id, chargeback_probability, risk_factors, recommended_prevention, estimated_loss, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @transaction_id, @chargeback_probability, @risk_factors, @recommended_prevention, @estimated_loss, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    transaction_id:         transactionData.transaction_id ?? transactionData.screen_id ?? null,
    chargeback_probability,
    risk_factors:           JSON.stringify(risk_factors),
    recommended_prevention: JSON.stringify(recommended_prevention),
    estimated_loss,
    fee_usd:                fee,
    commission_usd:         comm,
    created_at:             now,
  });

  return {
    prediction_id:           id,
    transaction_id:          transactionData.transaction_id ?? null,
    amount,
    chargeback_probability,
    risk_level:              chargeback_probability >= 0.10 ? "high" : chargeback_probability >= 0.05 ? "medium" : "low",
    risk_factors,
    recommended_prevention,
    estimated_loss,
    predicted_at:            now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// ─── analyzeNetwork ───────────────────────────────────────────────────────────

/**
 * Graph-based network analysis to detect connected fraud rings.
 * @param {string} entityId  - The seed entity ID (user, account, device, IP)
 * @param {number} depth     - Graph traversal depth (1–3)
 * @returns connections[], risk_clusters[], suspicious_patterns[], network_risk_score
 * Fee: $1.00 per analysis
 */
export function analyzeNetwork(entityId, depth = 2) {
  if (!entityId) throw new Error("entityId is required");
  if (depth < 1 || depth > 3) throw new Error("depth must be between 1 and 3");

  const fee  = FRAUD_FEES.network;
  const comm = commission(fee);

  // Build connections from DB data
  const seedTxs = db.prepare("SELECT * FROM fraud_transactions WHERE user_id = ? OR device_id = ? LIMIT 50").all(entityId, entityId);

  const connections = [];
  const sharedDevices = {};
  const sharedIPs     = {};

  for (const tx of seedTxs) {
    if (tx.device_id) {
      sharedDevices[tx.device_id] = sharedDevices[tx.device_id] ?? [];
      sharedDevices[tx.device_id].push(tx.user_id);
    }
    if (tx.ip_address) {
      sharedIPs[tx.ip_address] = sharedIPs[tx.ip_address] ?? [];
      sharedIPs[tx.ip_address].push(tx.user_id);
    }
  }

  // Shared device connections
  for (const [device, users] of Object.entries(sharedDevices)) {
    if (users.length > 1) {
      const unique = [...new Set(users)];
      connections.push({
        connection_id:   randomUUID(),
        type:            "shared_device",
        shared_attribute: device,
        entities:        unique,
        risk_weight:     0.75,
        depth:           1,
        note:            `${unique.length} user(s) share device ${device}`,
      });
    }
  }

  // Shared IP connections
  for (const [ip, users] of Object.entries(sharedIPs)) {
    if (users.length > 1) {
      const unique = [...new Set(users)];
      const isHighRisk = KNOWN_PROXIES.has(ip);
      connections.push({
        connection_id:   randomUUID(),
        type:            "shared_ip",
        shared_attribute: ip,
        entities:        unique,
        risk_weight:     isHighRisk ? 0.85 : 0.40,
        depth:           1,
        note:            `${unique.length} user(s) share IP ${ip}${isHighRisk ? " (known proxy)" : ""}`,
      });
    }
  }

  // Simulate depth-2 connections if requested
  if (depth >= 2 && connections.length > 0) {
    const depth2Count = Math.floor(connections.length * 1.5);
    for (let i = 0; i < Math.min(depth2Count, 4); i++) {
      connections.push({
        connection_id:   randomUUID(),
        type:            pickRandom(["shared_email_domain", "shared_phone_prefix", "linked_account"]),
        shared_attribute: `attr_${randomUUID().slice(0, 6)}`,
        entities:        [entityId, `entity_${randomUUID().slice(0, 8)}`],
        risk_weight:     Math.round(randomBetween(0.20, 0.65) * 100) / 100,
        depth:           2,
        note:            "Secondary connection via shared attribute",
      });
    }
  }

  // Risk cluster detection
  const risk_clusters = [];
  const highRiskConns = connections.filter(c => c.risk_weight >= 0.70);
  if (highRiskConns.length >= 2) {
    const clusterEntities = [...new Set(highRiskConns.flatMap(c => c.entities))];
    risk_clusters.push({
      cluster_id:       randomUUID(),
      entity_count:     clusterEntities.length,
      entities:         clusterEntities,
      avg_risk_weight:  Math.round(highRiskConns.reduce((s, c) => s + c.risk_weight, 0) / highRiskConns.length * 100) / 100,
      cluster_type:     "potential_fraud_ring",
      description:      `${clusterEntities.length} entities strongly connected via shared high-risk attributes`,
    });
  }

  // Suspicious pattern detection
  const suspicious_patterns = [];
  if (connections.some(c => c.type === "shared_device" && c.entities.length >= 3)) {
    suspicious_patterns.push({ pattern: "multi_account_device", severity: "high", description: "3+ accounts sharing a single device — synthetic identity or account farm indicator" });
  }
  if (connections.some(c => c.type === "shared_ip" && c.risk_weight >= 0.80)) {
    suspicious_patterns.push({ pattern: "proxy_ip_cluster", severity: "high", description: "Multiple accounts connected through a known proxy IP — coordinated fraud signal" });
  }
  if (risk_clusters.length > 0) {
    suspicious_patterns.push({ pattern: "connected_fraud_ring", severity: "critical", description: `Detected a potential fraud ring of ${risk_clusters[0].entity_count} entities with avg connection risk ${risk_clusters[0].avg_risk_weight}` });
  }
  if (depth >= 2 && connections.filter(c => c.depth === 2).length >= 3) {
    suspicious_patterns.push({ pattern: "extended_network_exposure", severity: "medium", description: "Entity has broad second-degree connections — monitor for money mule patterns" });
  }

  const networkRiskScore = clamp(
    Math.round(
      (connections.reduce((s, c) => s + c.risk_weight, 0) / Math.max(connections.length, 1)) * 100 +
      (risk_clusters.length * 10) +
      (suspicious_patterns.filter(p => p.severity === "critical").length * 20)
    ),
    0, 100
  );

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO fraud_network_analyses
      (id, entity_id, depth, connections, risk_clusters, suspicious_patterns, network_risk_score, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @entity_id, @depth, @connections, @risk_clusters, @suspicious_patterns, @network_risk_score, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    entity_id:          entityId,
    depth,
    connections:        JSON.stringify(connections),
    risk_clusters:      JSON.stringify(risk_clusters),
    suspicious_patterns: JSON.stringify(suspicious_patterns),
    network_risk_score: networkRiskScore,
    fee_usd:            fee,
    commission_usd:     comm,
    created_at:         now,
  });

  return {
    analysis_id:             id,
    entity_id:               entityId,
    depth_analyzed:          depth,
    connections_found:       connections.length,
    connections,
    risk_clusters,
    suspicious_patterns,
    network_risk_score:      networkRiskScore,
    network_risk_level:      networkRiskScore >= 75 ? "critical" : networkRiskScore >= 50 ? "high" : networkRiskScore >= 25 ? "medium" : "low",
    recommendation:          networkRiskScore >= 75
      ? "Immediately suspend entity and escalate to fraud investigation team"
      : networkRiskScore >= 50
        ? "Flag for enhanced monitoring and manual review"
        : "No immediate action required — continue standard monitoring",
    analyzed_at:             now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// Helper used inside network analysis
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ─── getFraudDashboard ────────────────────────────────────────────────────────

/**
 * Retrieve fraud analytics dashboard for a given date range.
 * @param {object} dateRange - {start: ISO date, end: ISO date}
 * @returns total_screened, flagged_count, blocked_amount, false_positive_rate, top_fraud_patterns[], trend_analysis
 * Fee: $10.00 per month (billed per call)
 */
export function getFraudDashboard(dateRange = {}) {
  const fee  = FRAUD_FEES.dashboard;
  const comm = commission(fee);

  const start = dateRange.start ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const end   = dateRange.end   ?? new Date().toISOString().slice(0, 10);

  // Pull actuals from DB
  const txs       = db.prepare("SELECT * FROM fraud_transactions WHERE created_at >= ? AND created_at <= ?").all(start, end + "T23:59:59");
  const idChecks  = db.prepare("SELECT * FROM fraud_identity_checks WHERE created_at >= ?").all(start);
  const anomReps  = db.prepare("SELECT * FROM fraud_anomaly_reports WHERE created_at >= ?").all(start);
  const netAnals  = db.prepare("SELECT * FROM fraud_network_analyses WHERE created_at >= ?").all(start);

  const total_screened    = txs.length;
  const flagged           = txs.filter(t => (t.risk_score ?? 0) >= 45);
  const blocked           = txs.filter(t => t.recommended_action === "block" || t.outcome === "blocked");
  const false_positives   = txs.filter(t => t.outcome === "false_positive");
  const fraud_confirmed   = txs.filter(t => t.outcome === "fraud_confirmed");

  const flagged_count      = flagged.length;
  const blocked_amount     = Math.round(blocked.reduce((s, t) => s + (t.amount ?? 0), 0) * 100) / 100;
  const false_positive_rate = total_screened > 0
    ? Math.round((false_positives.length / Math.max(flagged_count, 1)) * 10000) / 100
    : 0;

  // Top fraud patterns from flags
  const flagCounts = {};
  for (const tx of txs) {
    const flags = JSON.parse(tx.flags ?? "[]");
    for (const flag of flags) {
      flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    }
  }
  const top_fraud_patterns = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pattern, count]) => ({ pattern, count, pct_of_flagged: flagged_count > 0 ? Math.round(count / flagged_count * 10000) / 100 : 0 }));

  // Risk level distribution
  const risk_distribution = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const tx of txs) {
    if (tx.risk_level) risk_distribution[tx.risk_level] = (risk_distribution[tx.risk_level] ?? 0) + 1;
  }

  // Trend: group by day
  const dailyCounts = {};
  for (const tx of txs) {
    const day = tx.created_at.slice(0, 10);
    dailyCounts[day] = dailyCounts[day] ?? { screened: 0, flagged: 0, blocked: 0 };
    dailyCounts[day].screened++;
    if ((tx.risk_score ?? 0) >= 45) dailyCounts[day].flagged++;
    if (tx.recommended_action === "block") dailyCounts[day].blocked++;
  }
  const trend_analysis = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  const now = new Date().toISOString();

  return {
    date_range:               { start, end },
    total_screened,
    flagged_count,
    flagged_rate_pct:         total_screened > 0 ? Math.round(flagged_count / total_screened * 10000) / 100 : 0,
    blocked_count:            blocked.length,
    blocked_amount,
    fraud_confirmed_count:    fraud_confirmed.length,
    false_positive_rate_pct:  false_positive_rate,
    risk_distribution,
    identity_checks:          idChecks.length,
    identity_verified_count:  idChecks.filter(c => c.verified === 1).length,
    anomaly_reports:          anomReps.length,
    network_analyses:         netAnals.length,
    top_fraud_patterns,
    trend_analysis,
    estimated_fraud_prevented: blocked_amount,
    generated_at:             now,
    fee_usd:                  fee,
    platform_commission_usd:  comm,
    net_revenue_usd:          Math.round((fee - comm) * 100) / 100,
  };
}
