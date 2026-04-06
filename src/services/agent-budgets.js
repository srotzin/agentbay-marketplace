import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const BUDGET_PLATFORM_COMMISSION     = 0.015; // 1.5% of total budget on creation
const BUDGET_RECONCILIATION_FEE      = 0.002; // 0.2% of reconciled amount per run
const BUDGET_ANOMALY_THRESHOLD_PCT   = 0.25;  // Flag spend >25% over category allocation

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ab_budgets (
    id                    TEXT PRIMARY KEY,
    agent_id              TEXT NOT NULL,
    name                  TEXT NOT NULL,
    total_amount_usd      REAL NOT NULL,
    platform_fee_usd      REAL NOT NULL,
    period                TEXT NOT NULL CHECK(period IN ('daily','weekly','monthly','quarterly','annual','one_time')),
    approval_threshold_usd REAL,
    status                TEXT DEFAULT 'active' CHECK(status IN ('active','paused','exhausted','archived')),
    spent_usd             REAL DEFAULT 0,
    pending_approval_usd  REAL DEFAULT 0,
    last_reconciled_at    TEXT,
    created_at            TEXT DEFAULT (datetime('now')),
    renewed_at            TEXT,
    ends_at               TEXT
  );

  CREATE TABLE IF NOT EXISTS ab_allocations (
    id            TEXT PRIMARY KEY,
    budget_id     TEXT NOT NULL REFERENCES ab_budgets(id),
    category      TEXT NOT NULL,
    allocated_usd REAL NOT NULL,
    spent_usd     REAL DEFAULT 0,
    reserved_usd  REAL DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ab_transactions (
    id              TEXT PRIMARY KEY,
    budget_id       TEXT NOT NULL REFERENCES ab_budgets(id),
    allocation_id   TEXT REFERENCES ab_allocations(id),
    category        TEXT,
    description     TEXT NOT NULL,
    amount_usd      REAL NOT NULL,
    vendor          TEXT,
    status          TEXT DEFAULT 'settled' CHECK(status IN ('settled','pending','rejected','requires_approval','anomaly')),
    approved_by     TEXT,
    rejected_reason TEXT,
    reference_id    TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    settled_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS ab_anomalies (
    id            TEXT PRIMARY KEY,
    budget_id     TEXT NOT NULL REFERENCES ab_budgets(id),
    transaction_id TEXT REFERENCES ab_transactions(id),
    allocation_id  TEXT REFERENCES ab_allocations(id),
    category      TEXT,
    anomaly_type  TEXT NOT NULL CHECK(anomaly_type IN ('overspend','unusual_vendor','large_single_txn','category_mismatch','frequency_spike')),
    severity      TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
    description   TEXT NOT NULL,
    flagged_at    TEXT DEFAULT (datetime('now')),
    resolved      INTEGER DEFAULT 0
  );
`);

// ─── Seed demo budgets ────────────────────────────────────────────────────────

const _budgetCount = db.prepare("SELECT COUNT(*) as n FROM ab_budgets").get().n;
if (_budgetCount === 0) {
  const budgetId = uuid();
  const agentId  = "agent_demo_finance_01";
  const now      = new Date();
  const endsAt   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const fee      = Math.round(5000 * BUDGET_PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO ab_budgets (id, agent_id, name, total_amount_usd, platform_fee_usd, period, approval_threshold_usd, status, spent_usd, ends_at)
    VALUES (@id, @agent_id, @name, @total_amount_usd, @platform_fee_usd, @period, @approval_threshold_usd, 'active', @spent_usd, @ends_at)
  `).run({ id: budgetId, agent_id: agentId, name: "Monthly Ops Budget", total_amount_usd: 5000, platform_fee_usd: fee, period: "monthly", approval_threshold_usd: 500, spent_usd: 1842.50, ends_at: endsAt });

  const categories = [
    { id: uuid(), budget_id: budgetId, category: "infrastructure", allocated_usd: 2000, spent_usd: 1200.00 },
    { id: uuid(), budget_id: budgetId, category: "api_costs",      allocated_usd: 1500, spent_usd: 492.50 },
    { id: uuid(), budget_id: budgetId, category: "labor",          allocated_usd: 1000, spent_usd: 150.00 },
    { id: uuid(), budget_id: budgetId, category: "tooling",        allocated_usd: 500,  spent_usd: 0 },
  ];
  const insertAlloc = db.prepare(`
    INSERT OR IGNORE INTO ab_allocations (id, budget_id, category, allocated_usd, spent_usd)
    VALUES (@id, @budget_id, @category, @allocated_usd, @spent_usd)
  `);
  for (const a of categories) insertAlloc.run(a);

  const txns = [
    { id: uuid(), budget_id: budgetId, allocation_id: categories[0].id, category: "infrastructure", description: "AWS EC2 compute – us-east-1", amount_usd: 450.00, vendor: "Amazon Web Services", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[0].id, category: "infrastructure", description: "AWS RDS database instances", amount_usd: 380.00, vendor: "Amazon Web Services", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[0].id, category: "infrastructure", description: "Cloudflare Workers & KV", amount_usd: 120.00, vendor: "Cloudflare", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[0].id, category: "infrastructure", description: "GitHub Actions CI minutes", amount_usd: 250.00, vendor: "GitHub", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[1].id, category: "api_costs",      description: "OpenAI API – GPT-4o calls", amount_usd: 312.50, vendor: "OpenAI", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[1].id, category: "api_costs",      description: "Anthropic API – Claude 3.5", amount_usd: 180.00, vendor: "Anthropic", status: "settled" },
    { id: uuid(), budget_id: budgetId, allocation_id: categories[2].id, category: "labor",          description: "HITL task – document review",amount_usd: 150.00, vendor: "HiveAgent HITL", status: "settled" },
  ];
  const insertTxn = db.prepare(`
    INSERT OR IGNORE INTO ab_transactions (id, budget_id, allocation_id, category, description, amount_usd, vendor, status)
    VALUES (@id, @budget_id, @allocation_id, @category, @description, @amount_usd, @vendor, @status)
  `);
  for (const t of txns) insertTxn.run(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodEndDate(period) {
  const now = new Date();
  switch (period) {
    case "daily":     return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    case "weekly":    return new Date(now.getTime() + 7 * 86400000).toISOString();
    case "monthly":   return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    case "quarterly": return new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();
    case "annual":    return new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString();
    case "one_time":  return null;
    default:          return null;
  }
}

// ─── Create Budget ────────────────────────────────────────────────────────────

/**
 * Create a new spending budget for an agent with period controls.
 * @param {string} agentId          - The agent this budget belongs to
 * @param {string} name             - Human-readable budget name
 * @param {number} totalAmountUsd   - Total budget amount in USD
 * @param {string} period           - daily|weekly|monthly|quarterly|annual|one_time
 * @returns Newly created budget record
 */
export function createBudget(agentId, name, totalAmountUsd, period = "monthly") {
  if (!agentId)        throw new Error("agentId is required");
  if (!name)           throw new Error("name is required");
  if (totalAmountUsd == null || totalAmountUsd <= 0) throw new Error("totalAmountUsd must be a positive number");
  const validPeriods = ["daily","weekly","monthly","quarterly","annual","one_time"];
  if (!validPeriods.includes(period)) throw new Error(`period must be one of: ${validPeriods.join(", ")}`);

  const id         = uuid();
  const fee        = Math.round(totalAmountUsd * BUDGET_PLATFORM_COMMISSION * 100) / 100;
  const effectiveAmount = Math.round((totalAmountUsd - fee) * 100) / 100;
  const now        = new Date().toISOString();
  const endsAt     = getPeriodEndDate(period);

  db.prepare(`
    INSERT OR IGNORE INTO ab_budgets
      (id, agent_id, name, total_amount_usd, platform_fee_usd, period, status, spent_usd, created_at, ends_at)
    VALUES
      (@id, @agent_id, @name, @total_amount_usd, @platform_fee_usd, @period, 'active', 0, @created_at, @ends_at)
  `).run({ id, agent_id: agentId, name, total_amount_usd: totalAmountUsd, platform_fee_usd: fee, period, created_at: now, ends_at: endsAt });

  return {
    budget_id:            id,
    agent_id:             agentId,
    name,
    total_amount_usd:     totalAmountUsd,
    effective_amount_usd: effectiveAmount,
    platform_fee_usd:     fee,
    period,
    status:               "active",
    spent_usd:            0,
    remaining_usd:        effectiveAmount,
    allocations:          [],
    created_at:           now,
    ends_at:              endsAt,
    message:              `Budget "${name}" created for $${totalAmountUsd}/${period}. Platform fee: $${fee}.`,
  };
}

// ─── Allocate Funds ───────────────────────────────────────────────────────────

/**
 * Allocate a portion of a budget to a named spending category.
 * @param {string} budgetId     - Budget to allocate from
 * @param {string} category     - Spending category name (e.g. 'infrastructure', 'api_costs')
 * @param {number} amountUsd    - Amount to allocate to this category
 * @returns Allocation record with remaining budget
 */
export function allocateFunds(budgetId, category, amountUsd) {
  const budget = db.prepare("SELECT * FROM ab_budgets WHERE id = ?").get(budgetId);
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);
  if (budget.status !== "active") throw new Error(`Budget is not active (status: ${budget.status})`);
  if (!category) throw new Error("category is required");
  if (amountUsd == null || amountUsd <= 0) throw new Error("amountUsd must be a positive number");

  // Check total allocated so far doesn't exceed budget
  const totalAllocated = db.prepare(
    "SELECT COALESCE(SUM(allocated_usd), 0) as total FROM ab_allocations WHERE budget_id = ?"
  ).get(budgetId).total;
  const availableToAllocate = budget.total_amount_usd - budget.platform_fee_usd - totalAllocated;
  if (amountUsd > availableToAllocate) {
    throw new Error(`Cannot allocate $${amountUsd}. Only $${Math.round(availableToAllocate * 100) / 100} unallocated.`);
  }

  // Upsert allocation for this category
  const existing = db.prepare("SELECT * FROM ab_allocations WHERE budget_id = ? AND category = ?").get(budgetId, category);
  const now = new Date().toISOString();
  let allocationId;

  if (existing) {
    allocationId = existing.id;
    db.prepare("UPDATE ab_allocations SET allocated_usd = allocated_usd + @amt, updated_at = @now WHERE id = @id")
      .run({ amt: amountUsd, now, id: existing.id });
  } else {
    allocationId = uuid();
    db.prepare(`
      INSERT OR IGNORE INTO ab_allocations (id, budget_id, category, allocated_usd, spent_usd, created_at, updated_at)
      VALUES (@id, @budget_id, @category, @allocated_usd, 0, @now, @now)
    `).run({ id: allocationId, budget_id: budgetId, category, allocated_usd: amountUsd, now });
  }

  const alloc = db.prepare("SELECT * FROM ab_allocations WHERE id = ?").get(allocationId);
  const allAllocations = db.prepare("SELECT * FROM ab_allocations WHERE budget_id = ?").all(budgetId);
  const totalNowAllocated = allAllocations.reduce((s, a) => s + a.allocated_usd, 0);

  return {
    allocation_id:          allocationId,
    budget_id:              budgetId,
    budget_name:            budget.name,
    category,
    allocated_usd:          alloc.allocated_usd,
    spent_usd:              alloc.spent_usd,
    available_usd:          Math.round((alloc.allocated_usd - alloc.spent_usd - alloc.reserved_usd) * 100) / 100,
    budget_total_usd:       budget.total_amount_usd,
    budget_total_allocated: Math.round(totalNowAllocated * 100) / 100,
    budget_unallocated_usd: Math.round((budget.total_amount_usd - budget.platform_fee_usd - totalNowAllocated) * 100) / 100,
    updated_at:             now,
    message:                `$${amountUsd} allocated to category '${category}' on budget "${budget.name}".`,
  };
}

// ─── Get Spending Report ──────────────────────────────────────────────────────

/**
 * Generate a full spending breakdown report for a budget.
 * @param {string} budgetId
 * @returns Detailed spending report with per-category and per-vendor breakdowns
 */
export function getSpendingReport(budgetId) {
  const budget = db.prepare("SELECT * FROM ab_budgets WHERE id = ?").get(budgetId);
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);

  const allocations = db.prepare("SELECT * FROM ab_allocations WHERE budget_id = ? ORDER BY allocated_usd DESC").all(budgetId);
  const transactions = db.prepare("SELECT * FROM ab_transactions WHERE budget_id = ? ORDER BY created_at DESC").all(budgetId);

  // Vendor breakdown
  const byVendor = {};
  for (const t of transactions) {
    if (t.status === "settled" && t.vendor) {
      if (!byVendor[t.vendor]) byVendor[t.vendor] = { vendor: t.vendor, total_usd: 0, transaction_count: 0 };
      byVendor[t.vendor].total_usd += t.amount_usd;
      byVendor[t.vendor].transaction_count++;
    }
  }
  const topVendors = Object.values(byVendor)
    .sort((a, b) => b.total_usd - a.total_usd)
    .map(v => ({ ...v, total_usd: Math.round(v.total_usd * 100) / 100 }));

  const totalAllocated = allocations.reduce((s, a) => s + a.allocated_usd, 0);
  const utilizationPct = budget.total_amount_usd > 0
    ? Math.round((budget.spent_usd / budget.total_amount_usd) * 10000) / 100
    : 0;
  const burnRateDailyUsd = transactions.length > 0 ? (() => {
    const oldest = new Date(transactions[transactions.length - 1].created_at);
    const days = Math.max(1, (Date.now() - oldest.getTime()) / 86400000);
    return Math.round((budget.spent_usd / days) * 100) / 100;
  })() : 0;

  return {
    budget_id:          budgetId,
    budget_name:        budget.name,
    agent_id:           budget.agent_id,
    period:             budget.period,
    status:             budget.status,
    financial_summary: {
      total_budget_usd:    budget.total_amount_usd,
      platform_fee_usd:    budget.platform_fee_usd,
      total_allocated_usd: Math.round(totalAllocated * 100) / 100,
      unallocated_usd:     Math.round((budget.total_amount_usd - budget.platform_fee_usd - totalAllocated) * 100) / 100,
      spent_usd:           Math.round(budget.spent_usd * 100) / 100,
      remaining_usd:       Math.round((budget.total_amount_usd - budget.platform_fee_usd - budget.spent_usd) * 100) / 100,
      pending_approval_usd: Math.round((budget.pending_approval_usd ?? 0) * 100) / 100,
      utilization_pct:     utilizationPct,
      burn_rate_usd_per_day: burnRateDailyUsd,
    },
    category_breakdown: allocations.map(a => ({
      allocation_id:  a.id,
      category:       a.category,
      allocated_usd:  a.allocated_usd,
      spent_usd:      Math.round(a.spent_usd * 100) / 100,
      reserved_usd:   Math.round(a.reserved_usd * 100) / 100,
      available_usd:  Math.round((a.allocated_usd - a.spent_usd - a.reserved_usd) * 100) / 100,
      utilization_pct: a.allocated_usd > 0 ? Math.round((a.spent_usd / a.allocated_usd) * 10000) / 100 : 0,
    })),
    top_vendors:        topVendors,
    recent_transactions: transactions.slice(0, 10).map(t => ({
      transaction_id: t.id,
      category:       t.category,
      description:    t.description,
      amount_usd:     t.amount_usd,
      vendor:         t.vendor,
      status:         t.status,
      created_at:     t.created_at,
    })),
    anomaly_count:      db.prepare("SELECT COUNT(*) as n FROM ab_anomalies WHERE budget_id = ? AND resolved = 0").get(budgetId).n,
    ends_at:            budget.ends_at,
    last_reconciled_at: budget.last_reconciled_at,
    generated_at:       new Date().toISOString(),
  };
}

// ─── Set Approval Threshold ───────────────────────────────────────────────────

/**
 * Set a USD threshold above which individual transactions require explicit approval.
 * @param {string} budgetId
 * @param {number} thresholdUsd  - Transactions above this amount are flagged for approval
 * @returns Updated budget configuration
 */
export function setApprovalThreshold(budgetId, thresholdUsd) {
  const budget = db.prepare("SELECT * FROM ab_budgets WHERE id = ?").get(budgetId);
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);
  if (thresholdUsd == null || thresholdUsd <= 0) throw new Error("thresholdUsd must be a positive number");

  const now = new Date().toISOString();
  db.prepare("UPDATE ab_budgets SET approval_threshold_usd = ? WHERE id = ?").run(thresholdUsd, budgetId);

  // Flag existing settled transactions that would have required approval
  const requiresApproval = db.prepare(`
    SELECT COUNT(*) as n FROM ab_transactions
    WHERE budget_id = ? AND amount_usd > ? AND status = 'settled'
  `).get(budgetId, thresholdUsd).n;

  return {
    budget_id:               budgetId,
    budget_name:             budget.name,
    agent_id:                budget.agent_id,
    approval_threshold_usd:  thresholdUsd,
    previous_threshold_usd:  budget.approval_threshold_usd,
    historical_txns_above_threshold: requiresApproval,
    updated_at:              now,
    message:                 `Approval required for any transaction above $${thresholdUsd}. ${requiresApproval} existing transactions exceeded this threshold.`,
  };
}

// ─── Reconcile Transactions ───────────────────────────────────────────────────

/**
 * Run auto-reconciliation across a budget: match transactions to allocations,
 * recompute balances, and flag anomalies.
 * @param {string} budgetId
 * @returns Reconciliation report with flagged anomalies and corrected balances
 */
export function reconcileTransactions(budgetId) {
  const budget = db.prepare("SELECT * FROM ab_budgets WHERE id = ?").get(budgetId);
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);

  const allocations  = db.prepare("SELECT * FROM ab_allocations WHERE budget_id = ?").all(budgetId);
  const transactions = db.prepare("SELECT * FROM ab_transactions WHERE budget_id = ? AND status = 'settled'").all(budgetId);

  // Recompute category totals
  const catTotals = {};
  for (const t of transactions) {
    if (t.category) catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount_usd;
  }

  const newAnomalies = [];
  const reconciledCategories = [];
  const reconciliationFee = Math.round(budget.spent_usd * BUDGET_RECONCILIATION_FEE * 100) / 100;

  for (const alloc of allocations) {
    const actualSpent = catTotals[alloc.category] ?? 0;
    const discrepancy = Math.round((actualSpent - alloc.spent_usd) * 100) / 100;

    // Update allocation with correct spend
    db.prepare("UPDATE ab_allocations SET spent_usd = @spent, updated_at = datetime('now') WHERE id = @id")
      .run({ spent: Math.round(actualSpent * 100) / 100, id: alloc.id });

    // Detect overspend anomaly
    if (actualSpent > alloc.allocated_usd * (1 + BUDGET_ANOMALY_THRESHOLD_PCT)) {
      const anomalyId = uuid();
      const overPct = Math.round(((actualSpent - alloc.allocated_usd) / alloc.allocated_usd) * 10000) / 100;
      const severity = overPct > 100 ? "critical" : overPct > 50 ? "high" : overPct > 25 ? "medium" : "low";
      db.prepare(`
        INSERT OR IGNORE INTO ab_anomalies (id, budget_id, allocation_id, category, anomaly_type, severity, description)
        VALUES (@id, @budget_id, @allocation_id, @category, 'overspend', @severity, @description)
      `).run({
        id: anomalyId, budget_id: budgetId, allocation_id: alloc.id,
        category: alloc.category, severity,
        description: `Category '${alloc.category}' overspent by ${overPct}%. Allocated: $${alloc.allocated_usd}, Actual: $${Math.round(actualSpent * 100) / 100}.`,
      });
      newAnomalies.push({ allocation_id: alloc.id, category: alloc.category, type: "overspend", severity, overspend_pct: overPct });
    }

    // Detect large single transactions
    const largeTxns = transactions.filter(t => t.category === alloc.category && t.amount_usd > budget.total_amount_usd * 0.1);
    for (const lt of largeTxns) {
      const pct = Math.round((lt.amount_usd / budget.total_amount_usd) * 10000) / 100;
      const anomalyId = uuid();
      const existing = db.prepare("SELECT id FROM ab_anomalies WHERE transaction_id = ? AND anomaly_type = 'large_single_txn'").get(lt.id);
      if (!existing) {
        db.prepare(`
          INSERT OR IGNORE INTO ab_anomalies (id, budget_id, transaction_id, allocation_id, category, anomaly_type, severity, description)
          VALUES (@id, @budget_id, @transaction_id, @allocation_id, @category, 'large_single_txn', 'medium', @description)
        `).run({
          id: anomalyId, budget_id: budgetId, transaction_id: lt.id,
          allocation_id: alloc.id, category: alloc.category,
          description: `Transaction $${lt.amount_usd} (${pct}% of total budget) exceeds 10% budget threshold. Vendor: ${lt.vendor ?? "unknown"}.`,
        });
        newAnomalies.push({ transaction_id: lt.id, category: alloc.category, type: "large_single_txn", severity: "medium", amount_usd: lt.amount_usd });
      }
    }

    reconciledCategories.push({
      category:       alloc.category,
      allocated_usd:  alloc.allocated_usd,
      spent_usd_before: Math.round(alloc.spent_usd * 100) / 100,
      spent_usd_after:  Math.round(actualSpent * 100) / 100,
      discrepancy_usd:  discrepancy,
    });
  }

  // Recompute budget-level spend
  const totalSpent = transactions.reduce((s, t) => s + t.amount_usd, 0);
  const now = new Date().toISOString();
  db.prepare("UPDATE ab_budgets SET spent_usd = @spent, last_reconciled_at = @now WHERE id = @id")
    .run({ spent: Math.round(totalSpent * 100) / 100, now, id: budgetId });

  return {
    budget_id:              budgetId,
    budget_name:            budget.name,
    reconciliation_fee_usd: reconciliationFee,
    transactions_reviewed:  transactions.length,
    categories_reconciled:  reconciledCategories.length,
    category_details:       reconciledCategories,
    new_anomalies_flagged:  newAnomalies.length,
    anomalies:              newAnomalies,
    total_anomalies_open:   db.prepare("SELECT COUNT(*) as n FROM ab_anomalies WHERE budget_id = ? AND resolved = 0").get(budgetId).n,
    updated_spent_usd:      Math.round(totalSpent * 100) / 100,
    remaining_usd:          Math.round((budget.total_amount_usd - budget.platform_fee_usd - totalSpent) * 100) / 100,
    reconciled_at:          now,
    message:                `Reconciliation complete. ${transactions.length} transactions reviewed, ${newAnomalies.length} anomalies flagged.`,
  };
}
