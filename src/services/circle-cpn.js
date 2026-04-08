/**
 * HiveAgent Circle CPN (Circle Payments Network) Integration
 *
 * Announced by Circle on Apr 8, 2026: CPN Managed Payments.
 * → Stay fully fiat-native
 * → Avoid custody, blockchain integration, and new licensing overhead
 * → Access global USDC settlement through a single API
 *
 * HiveAgent wraps CPN so any agent gets fiat-native USDC settlement
 * without touching blockchain infrastructure directly.
 *
 * Key value: agents operating in regulated industries (insurance, healthcare,
 * legal, lending) can settle in USDC through Circle's managed compliance
 * layer — no crypto custody license needed.
 *
 * Revenue: 0.25% on CPN-routed transactions (vs 0.5% for direct on-chain).
 * We charge less because Circle handles the compliance overhead.
 *
 * Circle CPN API endpoint (live): https://api.circle.com/v2/payments
 * For now: simulated with production-realistic response shapes.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cpn_payments (
    id                  TEXT PRIMARY KEY,
    cpn_payment_id      TEXT UNIQUE,
    agent_id            TEXT NOT NULL,
    source_type         TEXT NOT NULL,          -- 'bank_account', 'wire', 'card', 'usdc_wallet'
    destination_type    TEXT NOT NULL,          -- 'bank_account', 'wire', 'usdc_wallet', 'agent_wallet'
    source_id           TEXT,
    destination_id      TEXT,
    amount_usd          REAL NOT NULL,
    settlement_currency TEXT DEFAULT 'USDC',
    fee_usd             REAL NOT NULL,
    fee_pct             REAL NOT NULL,
    status              TEXT DEFAULT 'completed',
    circle_status       TEXT DEFAULT 'paid',
    compliance_check    TEXT DEFAULT 'passed',
    fiat_native         INTEGER DEFAULT 1,
    created_at          TEXT DEFAULT (datetime('now')),
    settled_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cpn_accounts (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    account_type    TEXT NOT NULL,              -- 'bank_account', 'wire', 'usdc_wallet'
    bank_name       TEXT,
    routing_number  TEXT,
    account_number  TEXT,
    swift_code      TEXT,
    iban            TEXT,
    currency        TEXT DEFAULT 'USD',
    country         TEXT DEFAULT 'US',
    nickname        TEXT,
    is_verified     INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cpn_managed_services (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    service_type    TEXT NOT NULL,    -- 'payouts', 'collections', 'fx', 'compliance'
    status          TEXT DEFAULT 'active',
    config          TEXT DEFAULT '{}',
    enrolled_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cpn_payments_agent ON cpn_payments(agent_id);
  CREATE INDEX IF NOT EXISTS idx_cpn_accounts_agent ON cpn_accounts(agent_id);
`);

// ─── Constants ────────────────────────────────────────────────────────────────

const CPN_FEE_PCT = 0.0025;   // 0.25%
const CPN_MIN_FEE = 0.01;

const CPN_SETTLEMENT_TIMES = {
  bank_account: "1-2 business days",
  wire:         "same day",
  card:         "instant",
  usdc_wallet:  "instant",
  agent_wallet: "instant",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cpnPaymentId() {
  return `cpn_pay_${uuid().replace(/-/g, "").slice(0, 24)}`;
}

function complianceCheck(amount_usd, source_type) {
  // Simulate Circle's managed compliance layer
  if (amount_usd > 1_000_000) return { result: "manual_review", reason: "Large transaction requires manual review" };
  if (amount_usd > 50_000)    return { result: "enhanced_dd",   reason: "Enhanced due diligence triggered" };
  return { result: "passed", reason: "Automated compliance check passed" };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Make a fiat-native USDC payment through Circle's CPN.
 * Agent stays fiat-native — no direct blockchain interaction required.
 */
export function cpnPay({
  agent_id, source_type, destination_type,
  source_id, destination_id, amount_usd,
  settlement_currency, memo,
}) {
  if (!agent_id)        throw new Error("agent_id is required.");
  if (!source_type)     throw new Error("source_type is required: bank_account|wire|card|usdc_wallet");
  if (!destination_type) throw new Error("destination_type is required: bank_account|wire|usdc_wallet|agent_wallet");
  if (!amount_usd || amount_usd <= 0) throw new Error("amount_usd must be > 0.");

  const fee_usd = Math.max(amount_usd * CPN_FEE_PCT, CPN_MIN_FEE);
  const net_usd = amount_usd - fee_usd;
  const compliance = complianceCheck(amount_usd, source_type);
  const id = uuid();
  const cpnId = cpnPaymentId();
  const status = compliance.result === "manual_review" ? "pending_review" : "completed";

  db.prepare(`
    INSERT INTO cpn_payments
      (id, cpn_payment_id, agent_id, source_type, destination_type,
       source_id, destination_id, amount_usd, settlement_currency,
       fee_usd, fee_pct, status, circle_status, compliance_check, fiat_native)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(
    id, cpnId, agent_id, source_type, destination_type,
    source_id || null, destination_id || null, amount_usd,
    settlement_currency || "USDC",
    fee_usd, CPN_FEE_PCT, status, status === "completed" ? "paid" : "pending",
    compliance.result,
  );

  return {
    payment_id: id,
    cpn_payment_id: cpnId,
    status,
    amount_usd,
    fee_usd: parseFloat(fee_usd.toFixed(4)),
    net_amount_usd: parseFloat(net_usd.toFixed(4)),
    settlement_currency: settlement_currency || "USDC",
    settlement_time: CPN_SETTLEMENT_TIMES[destination_type] || "1-2 business days",
    source_type,
    destination_type,
    compliance,
    fiat_native: true,
    custody_required: false,
    blockchain_integration_required: false,
    powered_by: "Circle Payments Network (CPN)",
    memo: memo || null,
    message: status === "completed"
      ? `CPN payment of $${amount_usd} completed. Settlement: ${CPN_SETTLEMENT_TIMES[destination_type] || "1-2 business days"}.`
      : `CPN payment queued for compliance review (>${50000} threshold).`,
  };
}

/**
 * Register a bank account or wire destination for CPN payments.
 */
export function cpnAddAccount({
  agent_id, account_type, bank_name, routing_number,
  account_number, swift_code, iban, currency, country, nickname,
}) {
  if (!agent_id)     throw new Error("agent_id is required.");
  if (!account_type) throw new Error("account_type is required: bank_account|wire|usdc_wallet");

  const id = uuid();
  db.prepare(`
    INSERT INTO cpn_accounts
      (id, agent_id, account_type, bank_name, routing_number, account_number,
       swift_code, iban, currency, country, nickname)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, agent_id, account_type, bank_name || null,
    routing_number || null, account_number ? `****${account_number.slice(-4)}` : null,
    swift_code || null, iban ? `${iban.slice(0, 4)}****` : null,
    currency || "USD", country || "US", nickname || account_type,
  );

  return {
    account_id: id,
    agent_id,
    account_type,
    bank_name: bank_name || null,
    currency: currency || "USD",
    country: country || "US",
    nickname: nickname || account_type,
    verification_status: "pending",
    message: "Account registered. Circle will verify within 1-2 business days.",
    cpn_docs: "https://developers.circle.com/circle-mint/docs/cpn-managed-payments",
  };
}

/**
 * Enroll in a Circle Managed Service (payouts automation, collections, FX, compliance).
 */
export function cpnEnrollManagedService({ agent_id, service_type, config }) {
  if (!agent_id)     throw new Error("agent_id is required.");
  if (!service_type) throw new Error("service_type required: payouts|collections|fx|compliance");

  const SERVICES = {
    payouts:    "Automated USDC payouts to registered accounts on a schedule",
    collections:"Accept payments from any source, settle as USDC",
    fx:         "Real-time FX conversion — send USD, recipient gets local currency",
    compliance: "Managed AML/KYC compliance layer — Circle handles it for you",
  };

  if (!SERVICES[service_type]) throw new Error(`Unknown service. Choose: ${Object.keys(SERVICES).join("|")}`);

  const id = uuid();
  db.prepare(`
    INSERT OR REPLACE INTO cpn_managed_services (id, agent_id, service_type, config)
    VALUES (?,?,?,?)
  `).run(id, agent_id, service_type, JSON.stringify(config || {}));

  return {
    enrollment_id: id,
    agent_id,
    service_type,
    description: SERVICES[service_type],
    status: "active",
    message: `Enrolled in Circle CPN "${service_type}" managed service.`,
  };
}

/**
 * Get payment history for an agent.
 */
export function cpnPaymentHistory({ agent_id, limit }) {
  if (!agent_id) throw new Error("agent_id is required.");
  const rows = db.prepare(`
    SELECT * FROM cpn_payments WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(agent_id, limit || 20);
  return { agent_id, payments: rows, count: rows.length };
}

/**
 * Get Circle CPN network stats and capabilities.
 */
export function cpnNetworkInfo() {
  const totalPayments = db.prepare("SELECT COUNT(*) AS n FROM cpn_payments").get().n;
  const totalVolume   = db.prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM cpn_payments").get().s;

  return {
    network: "Circle Payments Network (CPN)",
    announced: "April 8, 2026",
    capabilities: {
      fiat_native:                  true,
      custody_required:             false,
      blockchain_integration:       false,
      licensing_overhead:           "managed by Circle",
      usdc_settlement:              true,
      supported_source_types:       ["bank_account", "wire", "card", "usdc_wallet"],
      supported_destination_types:  ["bank_account", "wire", "usdc_wallet", "agent_wallet"],
      supported_currencies:         ["USD", "EUR", "GBP", "SGD", "AUD", "CAD"],
      settlement_times:             CPN_SETTLEMENT_TIMES,
      managed_services:             ["payouts", "collections", "fx", "compliance"],
      min_amount_usd:               0.01,
      max_amount_usd:               1_000_000,
    },
    fee_pct: CPN_FEE_PCT * 100,
    total_payments_via_hiveagent: totalPayments,
    total_volume_usd: parseFloat(totalVolume.toFixed(2)),
    docs: "https://developers.circle.com/circle-mint/docs/cpn-managed-payments",
  };
}
