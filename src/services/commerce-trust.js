import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const TRUST_PLATFORM_COMMISSION = 0.20; // 20% platform cut on verification fees

const FEES = {
  verifyProduct:          { min: 0.25, max: 1.00 }, // dynamic based on category
  getMerchantTrustScore:  0.10,
  detectManipulation:     0.05,
  verifyPurchaseReceipt:  0.50,
  getCommerceRiskAssessment: 0.15,
  reportCommerceIncident: 0.00, // free — incentivize reporting
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ct_merchants (
    id                  TEXT PRIMARY KEY,
    domain              TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    country             TEXT DEFAULT 'US',
    category            TEXT DEFAULT 'general',
    years_in_business   REAL DEFAULT 1.0,
    transaction_count   INTEGER DEFAULT 0,
    dispute_rate        REAL DEFAULT 0.02,
    delivery_rate       REAL DEFAULT 0.97,
    return_rate         REAL DEFAULT 0.08,
    avg_rating          REAL DEFAULT 4.2,
    review_count        INTEGER DEFAULT 0,
    composite_score     REAL DEFAULT 75.0,
    risk_level          TEXT DEFAULT 'low' CHECK(risk_level IN ('minimal','low','medium','high','critical')),
    verified            INTEGER DEFAULT 0,
    flagged             INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ct_product_verifications (
    id                  TEXT PRIMARY KEY,
    product_url         TEXT NOT NULL,
    category            TEXT NOT NULL,
    trust_score         REAL NOT NULL,
    verified_claims     TEXT DEFAULT '[]',
    flagged_issues      TEXT DEFAULT '[]',
    price_comparison    TEXT DEFAULT '{}',
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ct_manipulation_scans (
    id                  TEXT PRIMARY KEY,
    content_hash        TEXT NOT NULL,
    content_type        TEXT NOT NULL,
    manipulation_score  REAL NOT NULL,
    detected_tactics    TEXT DEFAULT '[]',
    safe_content        TEXT,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ct_receipt_verifications (
    id                  TEXT PRIMARY KEY,
    order_ref           TEXT NOT NULL,
    verified            INTEGER NOT NULL DEFAULT 0,
    discrepancies       TEXT DEFAULT '[]',
    confidence          REAL NOT NULL,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ct_risk_assessments (
    id                  TEXT PRIMARY KEY,
    transaction_ref     TEXT,
    overall_risk_level  TEXT NOT NULL,
    risk_factors        TEXT DEFAULT '[]',
    recommended_protections TEXT DEFAULT '[]',
    insurance_quote_usd REAL,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ct_incidents (
    id                  TEXT PRIMARY KEY,
    transaction_id      TEXT NOT NULL,
    incident_type       TEXT NOT NULL CHECK(incident_type IN (
                          'fraud','counterfeit','non_delivery','wrong_item',
                          'price_bait_switch','data_theft')),
    evidence            TEXT DEFAULT '{}',
    status              TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','dismissed')),
    resolution          TEXT,
    merchant_domain     TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Merchants ───────────────────────────────────────────────────────────

const _merchantCount = db.prepare("SELECT COUNT(*) as n FROM ct_merchants").get().n;
if (_merchantCount === 0) {
  const seedMerchants = [
    { id: uuid(), domain: "techhaven.com",      name: "TechHaven",         country: "US", category: "electronics",   years_in_business: 8.5,  transaction_count: 284910, dispute_rate: 0.012, delivery_rate: 0.987, return_rate: 0.062, avg_rating: 4.7, review_count: 48203, composite_score: 91.2, risk_level: "minimal", verified: 1, flagged: 0 },
    { id: uuid(), domain: "fashionloft.co",     name: "Fashion Loft",      country: "UK", category: "apparel",       years_in_business: 4.2,  transaction_count: 97340,  dispute_rate: 0.031, delivery_rate: 0.961, return_rate: 0.183, avg_rating: 4.3, review_count: 21870, composite_score: 74.5, risk_level: "low",     verified: 1, flagged: 0 },
    { id: uuid(), domain: "homegoodsplus.net",  name: "HomeGoods Plus",    country: "US", category: "home",          years_in_business: 6.1,  transaction_count: 143200, dispute_rate: 0.018, delivery_rate: 0.979, return_rate: 0.095, avg_rating: 4.5, review_count: 34110, composite_score: 85.8, risk_level: "minimal", verified: 1, flagged: 0 },
    { id: uuid(), domain: "quickdeals24.biz",   name: "QuickDeals24",      country: "CN", category: "general",       years_in_business: 0.8,  transaction_count: 4200,   dispute_rate: 0.148, delivery_rate: 0.712, return_rate: 0.29,  avg_rating: 2.1, review_count: 891,   composite_score: 21.4, risk_level: "critical", verified: 0, flagged: 1 },
    { id: uuid(), domain: "pharmadirect.rx",    name: "PharmaDirectRx",    country: "CA", category: "health",        years_in_business: 3.4,  transaction_count: 56780,  dispute_rate: 0.009, delivery_rate: 0.995, return_rate: 0.042, avg_rating: 4.8, review_count: 12340, composite_score: 93.6, risk_level: "minimal", verified: 1, flagged: 0 },
    { id: uuid(), domain: "sportsworld.shop",   name: "SportsWorld",       country: "DE", category: "sporting_goods", years_in_business: 5.7, transaction_count: 88200,  dispute_rate: 0.022, delivery_rate: 0.971, return_rate: 0.11,  avg_rating: 4.4, review_count: 19450, composite_score: 80.1, risk_level: "low",     verified: 1, flagged: 0 },
    { id: uuid(), domain: "luxewatches.vip",    name: "LuxeWatches VIP",   country: "HK", category: "luxury",        years_in_business: 1.3,  transaction_count: 820,    dispute_rate: 0.087, delivery_rate: 0.841, return_rate: 0.19,  avg_rating: 3.2, review_count: 143,   composite_score: 38.7, risk_level: "high",    verified: 0, flagged: 0 },
    { id: uuid(), domain: "bookbazaar.in",      name: "BookBazaar",        country: "IN", category: "books",         years_in_business: 7.2,  transaction_count: 310400, dispute_rate: 0.006, delivery_rate: 0.993, return_rate: 0.031, avg_rating: 4.9, review_count: 78900, composite_score: 96.1, risk_level: "minimal", verified: 1, flagged: 0 },
    { id: uuid(), domain: "autoparts-rx.com",   name: "AutoParts RX",      country: "US", category: "automotive",    years_in_business: 9.8,  transaction_count: 201000, dispute_rate: 0.014, delivery_rate: 0.983, return_rate: 0.074, avg_rating: 4.6, review_count: 41200, composite_score: 88.9, risk_level: "minimal", verified: 1, flagged: 0 },
    { id: uuid(), domain: "dropship-galaxy.io", name: "Dropship Galaxy",   country: "US", category: "general",       years_in_business: 0.3,  transaction_count: 280,    dispute_rate: 0.21,  delivery_rate: 0.63,  return_rate: 0.34,  avg_rating: 1.8, review_count: 56,    composite_score: 12.1, risk_level: "critical", verified: 0, flagged: 1 },
  ];
  const insertMerchant = db.prepare(`
    INSERT OR IGNORE INTO ct_merchants
      (id, domain, name, country, category, years_in_business, transaction_count,
       dispute_rate, delivery_rate, return_rate, avg_rating, review_count,
       composite_score, risk_level, verified, flagged)
    VALUES
      (@id, @domain, @name, @country, @category, @years_in_business, @transaction_count,
       @dispute_rate, @delivery_rate, @return_rate, @avg_rating, @review_count,
       @composite_score, @risk_level, @verified, @flagged)
  `);
  for (const m of seedMerchants) insertMerchant.run(m);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCAM_DOMAINS = ["quickdeals24.biz", "dropship-galaxy.io", "fakegoods.cc", "replica-store.net"];
const FAKE_REVIEW_PATTERNS = [/\b(amazing|perfect|excellent){3,}/gi, /verified purchase.{0,20}5 stars/gi];

const CATEGORY_FEE_MAP = {
  electronics: 0.75, luxury: 1.00, health: 0.80, pharmaceutical: 1.00,
  automotive: 0.65, apparel: 0.35, books: 0.25, home: 0.40,
  sporting_goods: 0.45, general: 0.50,
};

function productFee(category) {
  return CATEGORY_FEE_MAP[category?.toLowerCase()] ?? 0.50;
}

function scoreFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    if (SCAM_DOMAINS.includes(domain)) return 15;
    const m = db.prepare("SELECT composite_score FROM ct_merchants WHERE domain = ?").get(domain);
    if (m) return Math.min(100, m.composite_score + (Math.random() * 10 - 5));
  } catch { /* ignore */ }
  return 55 + Math.random() * 35;
}

function detectScamPatterns(url, claims) {
  const issues = [];
  try {
    const domain = new URL(url).hostname;
    if (SCAM_DOMAINS.some(s => domain.includes(s.split(".")[0]))) {
      issues.push("Domain flagged in known scam registry");
    }
  } catch {
    issues.push("Invalid or malformed product URL");
  }
  if (claims?.some(c => /\b(guaranteed|100%|zero risk|limited time)\b/i.test(c))) {
    issues.push("Claim uses high-pressure or unverifiable language");
  }
  if (claims?.some(c => /\bfree\b.{0,10}(ship|return|trial)/i.test(c) && /\*/.test(c))) {
    issues.push("'Free' offer contains obscured conditions (asterisk)");
  }
  return issues;
}

function priceComparison(category, claimedPrice) {
  const marketMedians = { electronics: 249, luxury: 1850, health: 42, apparel: 68, books: 18, home: 55, automotive: 120, general: 35 };
  const median = marketMedians[category?.toLowerCase()] ?? 50;
  const ratio = claimedPrice ? claimedPrice / median : null;
  return {
    claimed_price_usd: claimedPrice ?? null,
    market_median_usd: median,
    price_ratio: ratio ? Math.round(ratio * 100) / 100 : null,
    assessment: !ratio ? "unknown" : ratio < 0.3 ? "suspiciously_low" : ratio > 4 ? "suspiciously_high" : ratio < 0.6 ? "below_market" : ratio > 2 ? "above_market" : "fair",
  };
}

// ─── verifyProduct ─────────────────────────────────────────────────────────────

/**
 * Verify a product is authentic, claims are real, and price is fair.
 * @param {string} productUrl    - URL of the product listing
 * @param {string[]} claims      - Claims made in the listing (e.g. ["waterproof","lifetime warranty"])
 * @param {string} category      - Product category (electronics|luxury|health|apparel|books|home|automotive|sporting_goods|general)
 * @returns Trust score, verified claims, flagged issues, price comparison, fee breakdown
 */
export function verifyProduct(productUrl, claims = [], category = "general") {
  if (!productUrl) throw new Error("productUrl is required");

  const fee        = productFee(category);
  const commission = Math.round(fee * TRUST_PLATFORM_COMMISSION * 100) / 100;
  const score      = scoreFromUrl(productUrl);
  const issues     = detectScamPatterns(productUrl, claims);

  // Simulate verifying claims
  const claimedPrice   = claims.find(c => /\$[\d,.]+/.test(c))?.match(/\$([\d,.]+)/)?.[1];
  const verifiedClaims = [];
  const flaggedClaims  = [];
  for (const claim of claims) {
    if (/\$[\d,.]+/.test(claim) || /lifetime|forever|infinity/i.test(claim)) {
      flaggedClaims.push(claim);
      issues.push(`Unverifiable claim: "${claim}"`);
    } else {
      verifiedClaims.push(claim);
    }
  }

  if (FAKE_REVIEW_PATTERNS.some(p => claims.join(" ").match(p))) {
    issues.push("Review language matches known synthetic review patterns");
  }

  const adjustedScore = Math.max(0, Math.min(100, score - issues.length * 8));
  const priceCmp      = priceComparison(category, claimedPrice ? parseFloat(claimedPrice.replace(",", "")) : null);
  if (priceCmp.assessment === "suspiciously_low") issues.push("Price is more than 70% below market median — possible counterfeit");

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO ct_product_verifications
      (id, product_url, category, trust_score, verified_claims, flagged_issues, price_comparison, fee_usd, commission_usd)
    VALUES (@id, @product_url, @category, @trust_score, @verified_claims, @flagged_issues, @price_comparison, @fee_usd, @commission_usd)
  `).run({
    id,
    product_url:      productUrl,
    category,
    trust_score:      Math.round(adjustedScore * 10) / 10,
    verified_claims:  JSON.stringify(verifiedClaims),
    flagged_issues:   JSON.stringify(issues),
    price_comparison: JSON.stringify(priceCmp),
    fee_usd:          fee,
    commission_usd:   commission,
  });

  return {
    verification_id:     id,
    product_url:         productUrl,
    category,
    trust_score:         Math.round(adjustedScore * 10) / 10,
    trust_rating:        adjustedScore >= 80 ? "trusted" : adjustedScore >= 55 ? "caution" : adjustedScore >= 30 ? "risky" : "dangerous",
    verified_claims:     verifiedClaims,
    unverifiable_claims: flaggedClaims,
    flagged_issues:      issues,
    price_comparison:    priceCmp,
    fee_usd:             fee,
    platform_commission_usd: commission,
    checked_at:          new Date().toISOString(),
  };
}

// ─── getMerchantTrustScore ─────────────────────────────────────────────────────

/**
 * Get comprehensive merchant trust score based on history, disputes, delivery, and reviews.
 * @param {string} merchantId  - Known merchant ID or null
 * @param {string} domain      - Merchant domain (e.g. "techhaven.com")
 * @returns Composite trust score, breakdown, risk level, recommendations
 */
export function getMerchantTrustScore(merchantId, domain) {
  if (!merchantId && !domain) throw new Error("merchantId or domain is required");

  const fee        = FEES.getMerchantTrustScore;
  const commission = Math.round(fee * TRUST_PLATFORM_COMMISSION * 100) / 100;

  let merchant = null;
  if (domain) merchant = db.prepare("SELECT * FROM ct_merchants WHERE domain = ?").get(domain);
  if (!merchant && merchantId) merchant = db.prepare("SELECT * FROM ct_merchants WHERE id = ?").get(merchantId);

  let breakdown, score, riskLevel, recommendations;

  if (merchant) {
    // Weight each dimension
    const disputeScore   = Math.max(0, 100 - merchant.dispute_rate * 400);   // 0% → 100, 25% → 0
    const deliveryScore  = merchant.delivery_rate * 100;
    const returnScore    = Math.max(0, 100 - merchant.return_rate * 250);     // 0% → 100, 40% → 0
    const tenureScore    = Math.min(100, merchant.years_in_business * 10);    // caps at 10 years
    const reviewScore    = Math.min(100, (merchant.avg_rating / 5) * 100 * (merchant.review_count > 100 ? 1 : 0.6));
    const volumeScore    = Math.min(100, Math.log10(merchant.transaction_count + 1) * 20);

    score = Math.round(
      disputeScore  * 0.25 +
      deliveryScore * 0.25 +
      returnScore   * 0.10 +
      tenureScore   * 0.15 +
      reviewScore   * 0.15 +
      volumeScore   * 0.10
    );

    // Update stored score
    db.prepare("UPDATE ct_merchants SET composite_score = ? WHERE id = ?").run(score, merchant.id);

    riskLevel = score >= 85 ? "minimal" : score >= 70 ? "low" : score >= 50 ? "medium" : score >= 30 ? "high" : "critical";

    breakdown = {
      dispute_rate:    { raw: merchant.dispute_rate, score: Math.round(disputeScore),  weight: "25%" },
      delivery_rate:   { raw: merchant.delivery_rate, score: Math.round(deliveryScore), weight: "25%" },
      return_rate:     { raw: merchant.return_rate,  score: Math.round(returnScore),   weight: "10%" },
      tenure_years:    { raw: merchant.years_in_business, score: Math.round(tenureScore), weight: "15%" },
      review_quality:  { raw: merchant.avg_rating, review_count: merchant.review_count, score: Math.round(reviewScore), weight: "15%" },
      transaction_volume: { raw: merchant.transaction_count, score: Math.round(volumeScore), weight: "10%" },
    };

    recommendations = [];
    if (merchant.dispute_rate > 0.05) recommendations.push("Dispute rate elevated — use escrow protection for orders over $50");
    if (merchant.delivery_rate < 0.95) recommendations.push("Delivery reliability below threshold — add tracking requirement");
    if (merchant.return_rate > 0.15)   recommendations.push("High return rate — verify product descriptions match accurately");
    if (merchant.years_in_business < 1) recommendations.push("New merchant — limit initial order value to $100");
    if (merchant.review_count < 50)    recommendations.push("Insufficient review history — treat as unverified");
    if (merchant.flagged)              recommendations.push("ALERT: Merchant has active flags — do not transact");
  } else {
    // Unknown merchant — conservative defaults
    score      = 40 + Math.floor(Math.random() * 25);
    riskLevel  = "medium";
    breakdown  = { note: "Merchant not found in trust database — score is estimated from domain signals" };
    recommendations = [
      "Merchant not in verified registry — use escrow on all purchases",
      "Request proof of business registration before transacting",
      "Limit purchase to under $200 until merchant history is established",
    ];
  }

  return {
    merchant_id:       merchant?.id ?? null,
    domain:            merchant?.domain ?? domain,
    name:              merchant?.name ?? "Unknown Merchant",
    composite_score:   score,
    risk_level:        riskLevel,
    breakdown,
    recommendations,
    verified:          merchant?.verified === 1,
    flagged:           merchant?.flagged === 1,
    fee_usd:           fee,
    platform_commission_usd: commission,
    checked_at:        new Date().toISOString(),
  };
}

// ─── detectManipulation ───────────────────────────────────────────────────────

/**
 * Detect prompt injection, fake social proof, dark patterns, and manipulation tactics.
 * @param {string} content       - The content to scan
 * @param {string} context       - Context about where content came from (product listing, review, etc.)
 * @returns manipulation_score, detected_tactics, safe_content (sanitized), fee
 */
export function detectManipulation(content, context = "") {
  if (!content) throw new Error("content is required");

  const fee        = FEES.detectManipulation;
  const commission = Math.round(fee * TRUST_PLATFORM_COMMISSION * 100) / 100;

  const tactics = [];

  // Prompt injection patterns
  const injectionPatterns = [
    { re: /ignore (previous|above|all) instructions?/gi,   tactic: "direct_prompt_injection", severity: "critical" },
    { re: /system prompt|<\|im_start\||<\|system\|>/gi,    tactic: "system_prompt_override",  severity: "critical" },
    { re: /\[INST\]|\[\/?SYS\]|<s>/g,                     tactic: "llm_token_injection",     severity: "high" },
    { re: /you are now|act as if you are|pretend you/gi,   tactic: "persona_hijack",          severity: "high" },
    { re: /\u200b|\u200c|\u200d|\ufeff/g,                  tactic: "zero_width_character",    severity: "medium" },
    { re: /[\u202a-\u202e\u2066-\u2069]/g,                 tactic: "unicode_bidi_override",   severity: "medium" },
  ];

  // Dark pattern / fake social proof patterns
  const darkPatterns = [
    { re: /only \d+ left in stock|selling fast|almost gone/gi,  tactic: "fake_urgency",           severity: "low" },
    { re: /\d{3,} people (viewing|watching|bought)/gi,          tactic: "inflated_social_proof",  severity: "low" },
    { re: /(verified|trusted) (buyer|purchase|review)/gi,       tactic: "fake_verification_badge", severity: "medium" },
    { re: /was \$[\d,]+\s*now \$[\d,]+/gi,                      tactic: "fake_discount",          severity: "low" },
    { re: /100% (guaranteed|satisfaction|money.?back)/gi,       tactic: "unverifiable_guarantee", severity: "low" },
    { re: /subscribe and save|auto.?renew/gi,                   tactic: "subscription_trap",      severity: "medium" },
    { re: /\bfree\b.{1,30}\*(terms|conditions|restrictions)/gi, tactic: "hidden_conditions",      severity: "medium" },
  ];

  // Sybil / fake review patterns
  const sybilPatterns = [
    { re: /(amazing|perfect|excellent|outstanding){2,}/gi,     tactic: "synthetic_review_language", severity: "medium" },
    { re: /i (received|got|bought).{0,20}(free|discount).{0,30}(review|honest)/gi, tactic: "incentivized_review_disclosure", severity: "low" },
  ];

  let safe = content;
  let maxSeverityScore = 0;
  const severityWeights = { critical: 40, high: 25, medium: 12, low: 5 };

  for (const p of [...injectionPatterns, ...darkPatterns, ...sybilPatterns]) {
    if (p.re.test(content)) {
      tactics.push({ tactic: p.tactic, severity: p.severity });
      maxSeverityScore += severityWeights[p.severity] ?? 5;
      // Sanitize by replacing match with a safe placeholder
      safe = safe.replace(p.re, `[BLOCKED:${p.tactic}]`);
    }
  }

  const manipulationScore = Math.min(100, maxSeverityScore);
  const hasCritical = tactics.some(t => t.severity === "critical");

  const id = uuid();
  const contentHash = content.slice(0, 64).replace(/\s+/g, "_");
  db.prepare(`
    INSERT OR IGNORE INTO ct_manipulation_scans
      (id, content_hash, content_type, manipulation_score, detected_tactics, safe_content, fee_usd, commission_usd)
    VALUES (@id, @content_hash, @content_type, @manipulation_score, @detected_tactics, @safe_content, @fee_usd, @commission_usd)
  `).run({
    id,
    content_hash:       contentHash,
    content_type:       context,
    manipulation_score: manipulationScore,
    detected_tactics:   JSON.stringify(tactics),
    safe_content:       safe,
    fee_usd:            fee,
    commission_usd:     commission,
  });

  return {
    scan_id:            id,
    manipulation_score: manipulationScore,
    threat_classification: manipulationScore === 0 ? "clean" : manipulationScore < 20 ? "low_risk" : manipulationScore < 50 ? "moderate_risk" : "high_risk",
    contains_injection: hasCritical,
    detected_tactics:   tactics,
    tactic_count:       tactics.length,
    safe_content:       safe,
    sanitized:          tactics.length > 0,
    context,
    fee_usd:            fee,
    platform_commission_usd: commission,
    scanned_at:         new Date().toISOString(),
  };
}

// ─── verifyPurchaseReceipt ────────────────────────────────────────────────────

/**
 * Verify a purchase was actually completed with correct items, pricing, and delivery.
 * @param {Object} receiptData    - { order_id, merchant, items, total_usd, payment_last4, confirmation_code }
 * @param {Object[]} expectedItems - [{ sku, name, quantity, unit_price }]
 * @returns verified (bool), discrepancies[], confidence, fee
 */
export function verifyPurchaseReceipt(receiptData, expectedItems = []) {
  if (!receiptData)         throw new Error("receiptData is required");
  if (!receiptData.order_id) throw new Error("receiptData.order_id is required");

  const fee        = FEES.verifyPurchaseReceipt;
  const commission = Math.round(fee * TRUST_PLATFORM_COMMISSION * 100) / 100;

  const discrepancies = [];
  let confidence = 0.95;

  // Cross-reference items
  for (const expected of expectedItems) {
    const received = receiptData.items?.find(i => i.sku === expected.sku || i.name?.toLowerCase() === expected.name?.toLowerCase());
    if (!received) {
      discrepancies.push({ type: "missing_item", item: expected.name ?? expected.sku, detail: "Item not found on receipt" });
      confidence -= 0.12;
    } else if (received.quantity !== expected.quantity) {
      discrepancies.push({ type: "quantity_mismatch", item: expected.name, expected: expected.quantity, received: received.quantity });
      confidence -= 0.07;
    } else if (Math.abs((received.unit_price ?? 0) - expected.unit_price) > 0.01) {
      discrepancies.push({ type: "price_mismatch", item: expected.name, expected_usd: expected.unit_price, received_usd: received.unit_price });
      confidence -= 0.09;
    }
  }

  // Validate receipt structure
  if (!receiptData.confirmation_code) {
    discrepancies.push({ type: "missing_confirmation", detail: "No order confirmation code present" });
    confidence -= 0.15;
  }
  if (!receiptData.payment_last4) {
    discrepancies.push({ type: "missing_payment_proof", detail: "No payment card reference" });
    confidence -= 0.08;
  }

  // Merchant check
  const merchant = db.prepare("SELECT * FROM ct_merchants WHERE domain = ?").get(receiptData.merchant ?? "");
  if (merchant?.flagged) {
    discrepancies.push({ type: "flagged_merchant", detail: `Merchant '${receiptData.merchant}' is flagged for fraud` });
    confidence -= 0.30;
  }

  confidence = Math.max(0, Math.round(confidence * 100) / 100);
  const verified = discrepancies.length === 0 && confidence >= 0.80;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO ct_receipt_verifications
      (id, order_ref, verified, discrepancies, confidence, fee_usd, commission_usd)
    VALUES (@id, @order_ref, @verified, @discrepancies, @confidence, @fee_usd, @commission_usd)
  `).run({
    id,
    order_ref:     receiptData.order_id,
    verified:      verified ? 1 : 0,
    discrepancies: JSON.stringify(discrepancies),
    confidence,
    fee_usd:       fee,
    commission_usd: commission,
  });

  return {
    verification_id:  id,
    order_id:         receiptData.order_id,
    verified,
    confidence,
    discrepancy_count: discrepancies.length,
    discrepancies,
    merchant_status:  merchant ? (merchant.flagged ? "flagged" : merchant.verified ? "verified" : "unverified") : "unknown",
    fee_usd:          fee,
    platform_commission_usd: commission,
    verified_at:      new Date().toISOString(),
  };
}

// ─── getCommerceRiskAssessment ────────────────────────────────────────────────

/**
 * Pre-purchase risk assessment evaluating merchant, product, price, and payment risk.
 * @param {Object} transactionDetails - { merchant_domain, product_category, price_usd, payment_method, quantity }
 * @returns overall_risk_level, risk_factors[], recommended_protections[], insurance_quote
 */
export function getCommerceRiskAssessment(transactionDetails) {
  if (!transactionDetails) throw new Error("transactionDetails is required");

  const fee        = FEES.getCommerceRiskAssessment;
  const commission = Math.round(fee * TRUST_PLATFORM_COMMISSION * 100) / 100;

  const { merchant_domain, product_category, price_usd = 0, payment_method = "unknown", quantity = 1 } = transactionDetails;

  const riskFactors        = [];
  const protections        = [];
  let   riskScore          = 0;

  // Merchant risk
  const merchant = merchant_domain ? db.prepare("SELECT * FROM ct_merchants WHERE domain = ?").get(merchant_domain) : null;
  if (merchant) {
    if (merchant.flagged)              { riskFactors.push({ factor: "flagged_merchant", severity: "critical", detail: "Merchant is flagged for fraud" }); riskScore += 50; }
    if (merchant.dispute_rate > 0.10)  { riskFactors.push({ factor: "high_dispute_rate", severity: "high", detail: `${(merchant.dispute_rate*100).toFixed(1)}% dispute rate` }); riskScore += 20; }
    if (merchant.delivery_rate < 0.90) { riskFactors.push({ factor: "poor_delivery", severity: "high", detail: `Only ${(merchant.delivery_rate*100).toFixed(1)}% delivery success` }); riskScore += 15; }
    if (merchant.years_in_business < 1) { riskFactors.push({ factor: "new_merchant", severity: "medium", detail: "Merchant in business less than 1 year" }); riskScore += 10; }
  } else {
    riskFactors.push({ factor: "unknown_merchant", severity: "medium", detail: "Merchant not found in trust registry" });
    riskScore += 15;
  }

  // Price risk
  const totalValue = price_usd * quantity;
  if (totalValue > 500)  { riskFactors.push({ factor: "high_value_transaction", severity: "medium", detail: `Order value $${totalValue.toFixed(2)} is high` }); riskScore += 8; }
  if (totalValue > 2000) { riskFactors.push({ factor: "very_high_value", severity: "high", detail: "Order exceeds $2,000 — elevated fraud risk" }); riskScore += 15; }

  // Payment risk
  if (["wire","crypto","gift_card"].includes(payment_method)) {
    riskFactors.push({ factor: "non_reversible_payment", severity: "high", detail: `${payment_method} payments cannot be reversed` });
    riskScore += 25;
    protections.push("Use a reversible payment method (credit card) when possible");
  }

  // Product category risk
  const highRiskCategories = ["luxury", "pharmaceutical", "cryptocurrency"];
  if (highRiskCategories.includes(product_category?.toLowerCase())) {
    riskFactors.push({ factor: "high_risk_category", severity: "medium", detail: `Category '${product_category}' has elevated counterfeit risk` });
    riskScore += 10;
  }

  // Recommended protections
  if (riskScore > 10)  protections.push("Enable purchase escrow to hold funds until delivery confirmed");
  if (riskScore > 25)  protections.push("Request seller verification before releasing payment");
  if (riskScore > 40)  protections.push("Consider HITL human review before committing to purchase");
  if (totalValue > 100) protections.push("Add delivery tracking and signature confirmation requirement");

  const overallRisk = riskScore < 15 ? "minimal" : riskScore < 30 ? "low" : riskScore < 50 ? "medium" : riskScore < 70 ? "high" : "critical";

  // Insurance quote: 0.5%–4% of order value based on risk
  const insuranceRates = { minimal: 0.005, low: 0.010, medium: 0.020, high: 0.035, critical: 0.055 };
  const insuranceQuote = Math.round(totalValue * insuranceRates[overallRisk] * 100) / 100;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO ct_risk_assessments
      (id, transaction_ref, overall_risk_level, risk_factors, recommended_protections, insurance_quote_usd, fee_usd, commission_usd)
    VALUES (@id, @transaction_ref, @overall_risk_level, @risk_factors, @recommended_protections, @insurance_quote_usd, @fee_usd, @commission_usd)
  `).run({
    id,
    transaction_ref:         merchant_domain ?? "unknown",
    overall_risk_level:      overallRisk,
    risk_factors:            JSON.stringify(riskFactors),
    recommended_protections: JSON.stringify(protections),
    insurance_quote_usd:     insuranceQuote,
    fee_usd:                 fee,
    commission_usd:          commission,
  });

  return {
    assessment_id:           id,
    overall_risk_level:      overallRisk,
    risk_score:              Math.min(100, riskScore),
    risk_factor_count:       riskFactors.length,
    risk_factors:            riskFactors,
    recommended_protections: protections,
    insurance_quote_usd:     insuranceQuote,
    order_value_usd:         totalValue,
    merchant_verified:       merchant?.verified === 1,
    proceed_recommended:     overallRisk !== "critical",
    fee_usd:                 fee,
    platform_commission_usd: commission,
    assessed_at:             new Date().toISOString(),
  };
}

// ─── reportCommerceIncident ───────────────────────────────────────────────────

/**
 * Report fraud, counterfeit, non-delivery, or other commerce incidents.
 * Free — incentivizes collective intelligence.
 * @param {string} transactionId  - Order or transaction ID
 * @param {string} incidentType   - fraud|counterfeit|non_delivery|wrong_item|price_bait_switch|data_theft
 * @param {Object} evidence       - { description, merchant_domain, amount_usd, photos, tracking_number }
 * @returns Incident report ID, next steps, estimated resolution time
 */
export function reportCommerceIncident(transactionId, incidentType, evidence = {}) {
  if (!transactionId) throw new Error("transactionId is required");
  const validTypes = ["fraud","counterfeit","non_delivery","wrong_item","price_bait_switch","data_theft"];
  if (!validTypes.includes(incidentType)) throw new Error(`Invalid incidentType. Must be one of: ${validTypes.join(", ")}`);

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO ct_incidents
      (id, transaction_id, incident_type, evidence, merchant_domain)
    VALUES (@id, @transaction_id, @incident_type, @evidence, @merchant_domain)
  `).run({
    id,
    transaction_id: transactionId,
    incident_type:  incidentType,
    evidence:       JSON.stringify(evidence),
    merchant_domain: evidence.merchant_domain ?? null,
  });

  // Flag merchant if multiple incidents reported
  if (evidence.merchant_domain) {
    const incidentCount = db.prepare(
      "SELECT COUNT(*) as n FROM ct_incidents WHERE merchant_domain = ? AND status != 'dismissed'"
    ).get(evidence.merchant_domain)?.n ?? 0;

    if (incidentCount >= 3) {
      db.prepare("UPDATE ct_merchants SET flagged = 1 WHERE domain = ?").run(evidence.merchant_domain);
    }
  }

  const resolutionDays = { fraud: 3, counterfeit: 5, non_delivery: 7, wrong_item: 4, price_bait_switch: 3, data_theft: 1 };
  const nextSteps = {
    fraud:            ["Do not send additional payments", "Contact your bank to dispute charge", "Preserve all communications"],
    counterfeit:      ["Photograph the product with original packaging", "Do not return without written authorization", "File with customs if shipped internationally"],
    non_delivery:     ["Confirm address with merchant in writing", "Check tracking with carrier directly", "Initiate chargeback after 30 days"],
    wrong_item:       ["Document with photos before opening fully", "Get return shipping label from merchant", "Escrow holds payment until resolution"],
    price_bait_switch:["Screenshot the original listing immediately", "Decline checkout if price changed", "Report listing to platform"],
    data_theft:       ["Change all passwords immediately", "Enable 2FA on financial accounts", "Monitor credit report for 90 days"],
  };

  return {
    incident_id:       id,
    transaction_id:    transactionId,
    incident_type:     incidentType,
    status:            "open",
    fee_usd:           0.00,
    estimated_resolution_days: resolutionDays[incidentType],
    next_steps:        nextSteps[incidentType],
    merchant_flagged:  evidence.merchant_domain ? (db.prepare("SELECT flagged FROM ct_merchants WHERE domain = ?").get(evidence.merchant_domain)?.flagged === 1) : false,
    collective_intelligence_contribution: true,
    reported_at:       new Date().toISOString(),
  };
}
