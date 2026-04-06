/**
 * HiveAgent Stablecoin Payment Gateway
 *
 * Agents pay merchants and we process the transaction.
 * Revenue: 1% processing fee on every payment (vs 2-4% credit cards).
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    agent_id            TEXT,
    wallet_address      TEXT,
    category            TEXT,
    fee_pct             REAL DEFAULT 1.0,
    total_received_usd  REAL DEFAULT 0,
    transaction_count   INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_invoices (
    id                TEXT PRIMARY KEY,
    merchant_id       TEXT REFERENCES merchants(id),
    payer_agent_id    TEXT,
    amount_usd        REAL NOT NULL,
    token             TEXT DEFAULT 'USDC',
    description       TEXT,
    status            TEXT DEFAULT 'pending',
    processing_fee_usd REAL,
    merchant_payout_usd REAL,
    payment_link      TEXT,
    expires_at        TEXT,
    paid_at           TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_subscriptions (
    id                   TEXT PRIMARY KEY,
    merchant_id          TEXT REFERENCES merchants(id),
    subscriber_agent_id  TEXT NOT NULL,
    amount_usd           REAL NOT NULL,
    interval             TEXT DEFAULT 'monthly',
    status               TEXT DEFAULT 'active',
    next_charge_at       TEXT,
    total_charged        REAL DEFAULT 0,
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intervalToNextDate(interval, from = new Date()) {
  const d = new Date(from);
  switch (interval) {
    case "daily":   d.setDate(d.getDate() + 1); break;
    case "weekly":  d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    default: throw new Error(`Unknown interval: ${interval}. Use daily/weekly/monthly.`);
  }
  return d.toISOString();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Register a new merchant.
 */
export function registerMerchant({ name, agent_id, wallet_address, category }) {
  if (!name) throw new Error("Merchant name is required.");
  const id = uuid();
  db.prepare(`
    INSERT INTO merchants (id, name, agent_id, wallet_address, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, agent_id || null, wallet_address || null, category || null);
  return db.prepare("SELECT * FROM merchants WHERE id = ?").get(id);
}

/**
 * Create a payment invoice with a payment link.
 */
export function createInvoice({ merchant_id, amount_usd, token = "USDC", description, expires_in_hours = 24 }) {
  if (amount_usd <= 0) throw new Error("Invoice amount must be positive.");
  const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(merchant_id);
  if (!merchant) throw new Error("Merchant not found.");

  const id = uuid();
  const fee_pct = merchant.fee_pct;
  const processing_fee_usd = parseFloat((amount_usd * fee_pct / 100).toFixed(6));
  const merchant_payout_usd = parseFloat((amount_usd - processing_fee_usd).toFixed(6));
  const payment_link = `https://pay.hiveagent.io/invoice/${id}`;
  const expires_at = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO payment_invoices
      (id, merchant_id, amount_usd, token, description, processing_fee_usd, merchant_payout_usd, payment_link, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, merchant_id, amount_usd, token, description || null, processing_fee_usd, merchant_payout_usd, payment_link, expires_at);

  return db.prepare("SELECT * FROM payment_invoices WHERE id = ?").get(id);
}

/**
 * Pay an invoice. Applies 1% processing fee.
 */
export function payInvoice({ invoice_id, payer_agent_id }) {
  const invoice = db.prepare("SELECT * FROM payment_invoices WHERE id = ?").get(invoice_id);
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "pending") throw new Error(`Invoice is already ${invoice.status}.`);

  // Check expiry
  if (new Date(invoice.expires_at) < new Date()) {
    db.prepare("UPDATE payment_invoices SET status = 'expired' WHERE id = ?").run(invoice_id);
    throw new Error("Invoice has expired.");
  }

  const paid_at = new Date().toISOString();

  db.prepare(`
    UPDATE payment_invoices
    SET status = 'paid', payer_agent_id = ?, paid_at = ?
    WHERE id = ?
  `).run(payer_agent_id, paid_at, invoice_id);

  // Update merchant totals
  db.prepare(`
    UPDATE merchants
    SET total_received_usd = total_received_usd + ?,
        transaction_count = transaction_count + 1
    WHERE id = ?
  `).run(invoice.merchant_payout_usd, invoice.merchant_id);

  return db.prepare("SELECT * FROM payment_invoices WHERE id = ?").get(invoice_id);
}

/**
 * Get invoice details.
 */
export function getInvoice(invoice_id) {
  const invoice = db.prepare("SELECT * FROM payment_invoices WHERE id = ?").get(invoice_id);
  if (!invoice) throw new Error("Invoice not found.");
  return invoice;
}

/**
 * Get merchant dashboard: transactions, revenue, and pending invoices.
 */
export function getMerchantDashboard(merchant_id) {
  const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(merchant_id);
  if (!merchant) throw new Error("Merchant not found.");

  const invoices = db.prepare(
    "SELECT * FROM payment_invoices WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 100"
  ).all(merchant_id);

  const pending = invoices.filter(i => i.status === "pending");
  const paid = invoices.filter(i => i.status === "paid");

  const revenue_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_invoices,
      SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END) AS total_volume_usd,
      SUM(CASE WHEN status = 'paid' THEN processing_fee_usd ELSE 0 END) AS total_fees_usd,
      SUM(CASE WHEN status = 'paid' THEN merchant_payout_usd ELSE 0 END) AS total_payout_usd,
      SUM(CASE WHEN status = 'pending' THEN amount_usd ELSE 0 END) AS pending_volume_usd
    FROM payment_invoices WHERE merchant_id = ?
  `).get(merchant_id);

  const subscriptions = db.prepare(
    "SELECT * FROM payment_subscriptions WHERE merchant_id = ? ORDER BY created_at DESC"
  ).all(merchant_id);

  return {
    merchant,
    revenue_stats,
    pending_invoices: pending,
    recent_paid: paid.slice(0, 20),
    subscriptions,
  };
}

/**
 * Create a recurring payment / subscription.
 */
export function createRecurringPayment({ merchant_id, subscriber_agent_id, amount_usd, interval = "monthly" }) {
  if (amount_usd <= 0) throw new Error("Subscription amount must be positive.");
  const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(merchant_id);
  if (!merchant) throw new Error("Merchant not found.");

  const id = uuid();
  const next_charge_at = intervalToNextDate(interval);

  db.prepare(`
    INSERT INTO payment_subscriptions (id, merchant_id, subscriber_agent_id, amount_usd, interval, next_charge_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, merchant_id, subscriber_agent_id, amount_usd, interval, next_charge_at);

  return db.prepare("SELECT * FROM payment_subscriptions WHERE id = ?").get(id);
}

/**
 * Batch process all due recurring payments.
 * Creates and immediately pays invoices for subscriptions whose next_charge_at has passed.
 */
export function processRecurringPayments() {
  const now = new Date().toISOString();
  const due = db.prepare(`
    SELECT * FROM payment_subscriptions
    WHERE status = 'active' AND next_charge_at <= ?
  `).all(now);

  let processed = 0;
  let failed = 0;
  let total_charged = 0;
  const results = [];

  for (const sub of due) {
    try {
      // Create invoice
      const inv = createInvoice({
        merchant_id: sub.merchant_id,
        amount_usd: sub.amount_usd,
        description: `Recurring ${sub.interval} subscription`,
        expires_in_hours: 1,
      });

      // Pay it immediately
      const paid = payInvoice({ invoice_id: inv.id, payer_agent_id: sub.subscriber_agent_id });

      // Advance next charge date
      const next = intervalToNextDate(sub.interval);
      db.prepare(`
        UPDATE payment_subscriptions
        SET next_charge_at = ?, total_charged = total_charged + ?
        WHERE id = ?
      `).run(next, sub.amount_usd, sub.id);

      processed++;
      total_charged += sub.amount_usd;
      results.push({ subscription_id: sub.id, invoice_id: inv.id, status: "paid", amount: sub.amount_usd });
    } catch (err) {
      failed++;
      results.push({ subscription_id: sub.id, status: "failed", error: err.message });
    }
  }

  return { processed, failed, total_charged: parseFloat(total_charged.toFixed(2)), results };
}

/**
 * Get platform-wide payment gateway statistics.
 */
export function getPaymentGatewayStats() {
  const invoice_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_invoices,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_invoices,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_invoices,
      COUNT(CASE WHEN status = 'expired' THEN 1 END) AS expired_invoices,
      SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END) AS total_volume_usd,
      SUM(CASE WHEN status = 'paid' THEN processing_fee_usd ELSE 0 END) AS total_fees_usd
    FROM payment_invoices
  `).get();

  const merchant_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_merchants,
      SUM(total_received_usd) AS total_merchant_payouts,
      SUM(transaction_count) AS total_transactions
    FROM merchants
  `).get();

  const subscription_stats = db.prepare(`
    SELECT
      COUNT(*) AS total_subscriptions,
      COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_subscriptions,
      SUM(total_charged) AS total_subscription_charged
    FROM payment_subscriptions
  `).get();

  return { invoice_stats, merchant_stats, subscription_stats };
}
