/**
 * HiveAgent Subscription System
 *
 * Recurring payments between agents. Agents can create subscription plans
 * and other agents can subscribe to them. HiveAgent takes 15% commission
 * on every subscription payment.
 *
 * Intervals: daily, weekly, monthly
 * Commission: 15% on every payment
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────
const STRIPE_LIVE = !!process.env.STRIPE_SECRET_KEY;
let stripe = null;
let _subStripeInit = false;

async function getStripe() {
  if (_subStripeInit) return stripe;
  _subStripeInit = true;
  if (STRIPE_LIVE) {
    try {
      const Stripe = (await import("stripe")).default;
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
    } catch (e) {
      console.log("[Subscriptions/Stripe] SDK not available:", e.message);
    }
  }
  return stripe;
}

/**
 * Route platform commission to CDP treasury (USDC on Base).
 */
async function collectCommission(commissionUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Commission] $${commissionUsd.toFixed(4)} → CDP treasury ${treasury.slice(0,8)}... — ${context}`);
      return { collected: true, treasury_address: treasury, amount_usd: commissionUsd };
    }
  } catch {}
  console.log(`[Commission] $${commissionUsd.toFixed(4)} logged (CDP pending init) — ${context}`);
  return { collected: false, amount_usd: commissionUsd };
}

const COMMISSION_RATE = 0.15; // 15%

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    provider_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    interval TEXT NOT NULL DEFAULT 'monthly',   -- 'daily', 'weekly', 'monthly'
    price_usd REAL NOT NULL,
    features TEXT DEFAULT '[]',                 -- JSON array of feature strings
    is_active INTEGER DEFAULT 1,                -- 1=active, 0=inactive
    subscriber_count INTEGER DEFAULT 0,
    total_revenue_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    subscriber_agent_id TEXT NOT NULL,
    provider_agent_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',               -- 'active', 'paused', 'cancelled', 'expired'
    price_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,               -- 15% of price_usd
    next_billing_at TEXT NOT NULL,
    billing_count INTEGER DEFAULT 0,
    total_paid_usd REAL DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    cancelled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_invoices (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    amount_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    status TEXT DEFAULT 'pending',              -- 'paid', 'pending', 'failed'
    billing_period_start TEXT NOT NULL,
    billing_period_end TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sub_plans_provider ON subscription_plans(provider_agent_id);
  CREATE INDEX IF NOT EXISTS idx_sub_plans_active ON subscription_plans(is_active);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_agent_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider_agent_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_sub_invoices_sub ON subscription_invoices(subscription_id);
`);

// ─── Helpers ──────────────────────────────────────

function nextBillingDate(interval) {
  const now = new Date();
  if (interval === "daily") {
    now.setDate(now.getDate() + 1);
  } else if (interval === "weekly") {
    now.setDate(now.getDate() + 7);
  } else {
    // monthly
    now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}

function billingPeriodEnd(interval, start) {
  const d = new Date(start);
  if (interval === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (interval === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

// ─── Plan Management ─────────────────────────────

/**
 * Create a subscription plan
 */
export function createPlan({ provider_agent_id, name, description, interval = "monthly", price_usd, features = [] }) {
  if (!provider_agent_id) throw new Error("provider_agent_id is required");
  if (!name) throw new Error("name is required");
  if (!price_usd || price_usd <= 0) throw new Error("price_usd must be positive");
  if (!["daily", "weekly", "monthly"].includes(interval)) throw new Error("interval must be daily, weekly, or monthly");

  const id = uuid();
  const featuresJson = JSON.stringify(Array.isArray(features) ? features : [features]);

  db.prepare(`
    INSERT INTO subscription_plans (id, provider_agent_id, name, description, interval, price_usd, features)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, provider_agent_id, name, description || null, interval, price_usd, featuresJson);

  return {
    plan_id: id,
    provider_agent_id,
    name,
    description,
    interval,
    price_usd,
    features: Array.isArray(features) ? features : [features],
    is_active: true,
  };
}

/**
 * Browse available subscription plans
 */
export function getPlans({ category, max_price, sort_by = "created_at", limit = 20 } = {}) {
  let sql = "SELECT * FROM subscription_plans WHERE is_active = 1";
  const params = [];

  if (max_price) {
    sql += " AND price_usd <= ?";
    params.push(max_price);
  }

  const validSorts = { price: "price_usd ASC", subscribers: "subscriber_count DESC", revenue: "total_revenue_usd DESC", created_at: "created_at DESC" };
  const orderBy = validSorts[sort_by] || "created_at DESC";
  sql += ` ORDER BY ${orderBy} LIMIT ?`;
  params.push(limit);

  const plans = db.prepare(sql).all(...params);
  return plans.map(p => ({ ...p, features: JSON.parse(p.features || "[]"), is_active: !!p.is_active }));
}

// ─── Subscription Lifecycle ───────────────────────

/**
 * Subscribe to a plan — creates subscription and first invoice
 */
export function subscribe({ plan_id, subscriber_agent_id }) {
  if (!plan_id) throw new Error("plan_id is required");
  if (!subscriber_agent_id) throw new Error("subscriber_agent_id is required");

  const plan = db.prepare("SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1").get(plan_id);
  if (!plan) throw new Error("Plan not found or inactive");
  if (plan.provider_agent_id === subscriber_agent_id) throw new Error("Cannot subscribe to your own plan");

  // Check for existing active subscription
  const existing = db.prepare(
    "SELECT id FROM subscriptions WHERE plan_id = ? AND subscriber_agent_id = ? AND status = 'active'"
  ).get(plan_id, subscriber_agent_id);
  if (existing) throw new Error("Already subscribed to this plan");

  const id = uuid();
  const commission = Math.round(plan.price_usd * COMMISSION_RATE * 100) / 100;
  const now = new Date().toISOString();
  const next_billing = nextBillingDate(plan.interval);

  db.prepare(`
    INSERT INTO subscriptions (id, plan_id, subscriber_agent_id, provider_agent_id, price_usd, commission_usd, next_billing_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, plan_id, subscriber_agent_id, plan.provider_agent_id, plan.price_usd, commission, next_billing);

  // Create first invoice (paid immediately)
  const invoiceId = uuid();
  const periodEnd = billingPeriodEnd(plan.interval, now);

  db.prepare(`
    INSERT INTO subscription_invoices (id, subscription_id, amount_usd, commission_usd, status, billing_period_start, billing_period_end)
    VALUES (?, ?, ?, ?, 'paid', ?, ?)
  `).run(invoiceId, id, plan.price_usd, commission, now, periodEnd);

  // Update subscription billing count and total paid
  db.prepare(`
    UPDATE subscriptions SET billing_count = billing_count + 1, total_paid_usd = total_paid_usd + ? WHERE id = ?
  `).run(plan.price_usd, id);

  // Update plan stats
  db.prepare(`
    UPDATE subscription_plans SET subscriber_count = subscriber_count + 1, total_revenue_usd = total_revenue_usd + ? WHERE id = ?
  `).run(plan.price_usd, plan_id);

  return {
    subscription_id: id,
    plan_id,
    subscriber_agent_id,
    provider_agent_id: plan.provider_agent_id,
    status: "active",
    price_usd: plan.price_usd,
    commission_usd: commission,
    next_billing_at: next_billing,
    first_invoice_id: invoiceId,
    amount_paid_usd: plan.price_usd,
  };
}

/**
 * Cancel a subscription
 */
export function cancelSubscription(subscription_id, agent_id) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscription_id);
  if (!sub) throw new Error("Subscription not found");
  if (sub.subscriber_agent_id !== agent_id && sub.provider_agent_id !== agent_id) {
    throw new Error("Not authorized to cancel this subscription");
  }
  if (sub.status === "cancelled") throw new Error("Subscription is already cancelled");

  db.prepare(`
    UPDATE subscriptions SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?
  `).run(subscription_id);

  // Decrement subscriber count on plan
  db.prepare("UPDATE subscription_plans SET subscriber_count = MAX(0, subscriber_count - 1) WHERE id = ?")
    .run(sub.plan_id);

  return { subscription_id, status: "cancelled", cancelled_at: new Date().toISOString() };
}

/**
 * Pause a subscription
 */
export function pauseSubscription(subscription_id, agent_id) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscription_id);
  if (!sub) throw new Error("Subscription not found");
  if (sub.subscriber_agent_id !== agent_id) throw new Error("Only the subscriber can pause a subscription");
  if (sub.status !== "active") throw new Error(`Cannot pause subscription with status: ${sub.status}`);

  db.prepare("UPDATE subscriptions SET status = 'paused' WHERE id = ?").run(subscription_id);

  return { subscription_id, status: "paused" };
}

/**
 * Resume a paused subscription
 */
export function resumeSubscription(subscription_id, agent_id) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscription_id);
  if (!sub) throw new Error("Subscription not found");
  if (sub.subscriber_agent_id !== agent_id) throw new Error("Only the subscriber can resume a subscription");
  if (sub.status !== "paused") throw new Error(`Cannot resume subscription with status: ${sub.status}`);

  const plan = db.prepare("SELECT * FROM subscription_plans WHERE id = ?").get(sub.plan_id);
  const next_billing = nextBillingDate(plan ? plan.interval : "monthly");

  db.prepare("UPDATE subscriptions SET status = 'active', next_billing_at = ? WHERE id = ?")
    .run(next_billing, subscription_id);

  return { subscription_id, status: "active", next_billing_at: next_billing };
}

// ─── Billing ─────────────────────────────────────

/**
 * Batch process due renewals — creates invoices and charges 15% commission
 */
export function processRenewals() {
  const due = db.prepare(`
    SELECT s.*, p.interval FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.status = 'active' AND s.next_billing_at <= datetime('now')
  `).all();

  const results = { processed: 0, total_billed_usd: 0, total_commission_usd: 0, invoices: [] };

  for (const sub of due) {
    try {
      const now = new Date().toISOString();
      const commission = Math.round(sub.price_usd * COMMISSION_RATE * 100) / 100;
      const periodEnd = billingPeriodEnd(sub.interval, now);
      const next_billing = nextBillingDate(sub.interval);
      const invoiceId = uuid();

      db.prepare(`
        INSERT INTO subscription_invoices (id, subscription_id, amount_usd, commission_usd, status, billing_period_start, billing_period_end)
        VALUES (?, ?, ?, ?, 'paid', ?, ?)
      `).run(invoiceId, sub.id, sub.price_usd, commission, now, periodEnd);

      db.prepare(`
        UPDATE subscriptions
        SET billing_count = billing_count + 1,
            total_paid_usd = total_paid_usd + ?,
            next_billing_at = ?
        WHERE id = ?
      `).run(sub.price_usd, next_billing, sub.id);

      db.prepare(`
        UPDATE subscription_plans SET total_revenue_usd = total_revenue_usd + ? WHERE id = ?
      `).run(sub.price_usd, sub.plan_id);

      results.processed++;
      results.total_billed_usd += sub.price_usd;
      results.total_commission_usd += commission;
      results.invoices.push({ invoice_id: invoiceId, subscription_id: sub.id, amount_usd: sub.price_usd, commission_usd: commission });
    } catch (err) {
      // Mark invoice as failed for this subscription
      const invoiceId = uuid();
      db.prepare(`
        INSERT INTO subscription_invoices (id, subscription_id, amount_usd, commission_usd, status, billing_period_start, billing_period_end)
        VALUES (?, ?, ?, ?, 'failed', datetime('now'), datetime('now'))
      `).run(invoiceId, sub.id, sub.price_usd, Math.round(sub.price_usd * COMMISSION_RATE * 100) / 100);
    }
  }

  results.total_billed_usd = Math.round(results.total_billed_usd * 100) / 100;
  results.total_commission_usd = Math.round(results.total_commission_usd * 100) / 100;
  return results;
}

/**
 * Get all active subscriptions for an agent
 */
export function getAgentSubscriptions(agent_id) {
  const subs = db.prepare(`
    SELECT s.*, p.name as plan_name, p.description as plan_description, p.interval, p.features
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.subscriber_agent_id = ? AND s.status != 'cancelled'
    ORDER BY s.started_at DESC
  `).all(agent_id);

  return subs.map(s => ({ ...s, features: JSON.parse(s.features || "[]") }));
}

/**
 * Platform-wide subscription stats
 */
export function getSubscriptionStats() {
  const totalPlans = db.prepare("SELECT COUNT(*) as count FROM subscription_plans WHERE is_active = 1").get().count;
  const totalSubscribers = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get().count;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM subscription_invoices WHERE status = 'paid'").get().total;
  const totalCommission = db.prepare("SELECT COALESCE(SUM(commission_usd), 0) as total FROM subscription_invoices WHERE status = 'paid'").get().total;

  // MRR: sum of monthly-normalized active subscription prices
  const activeMonthly = db.prepare("SELECT COALESCE(SUM(s.price_usd), 0) as total FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.status = 'active' AND p.interval = 'monthly'").get().total;
  const activeWeekly = db.prepare("SELECT COALESCE(SUM(s.price_usd), 0) as total FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.status = 'active' AND p.interval = 'weekly'").get().total;
  const activeDaily = db.prepare("SELECT COALESCE(SUM(s.price_usd), 0) as total FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.status = 'active' AND p.interval = 'daily'").get().total;
  const mrr = Math.round((activeMonthly + activeWeekly * 4.33 + activeDaily * 30.44) * 100) / 100;

  return {
    total_active_plans: totalPlans,
    total_active_subscribers: totalSubscribers,
    mrr_usd: mrr,
    total_revenue_usd: Math.round(totalRevenue * 100) / 100,
    total_commission_usd: Math.round(totalCommission * 100) / 100,
    commission_rate_pct: COMMISSION_RATE * 100,
  };
}
