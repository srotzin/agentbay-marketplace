/**
 * HiveAgent Insurance System
 *
 * Agents pay monthly premiums and receive coverage for transaction failures.
 * All premiums flow to HiveAgent's insurance pool.
 * Claims are paid from the pool. Surplus = profit.
 *
 * Plans:
 *   basic:      $1/mo,   $50 max/claim,    $5 deductible,  covers: transaction_failure
 *   standard:   $5/mo,   $500 max/claim,   $10 deductible, covers: transaction_failure, delivery_failure, escrow_dispute
 *   premium:    $25/mo,  $5000 max/claim,  $25 deductible, covers: everything
 *   enterprise: $100/mo, $50000 max/claim, $100 deductible,covers: everything + priority review
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Plan Definitions ─────────────────────────────

export const INSURANCE_PLANS = {
  basic: {
    plan_type: "basic",
    premium_usd_monthly: 1,
    coverage_usd: 50,
    deductible_usd: 5,
    coverage_types: ["transaction_failure"],
    description: "Basic coverage for transaction failures",
  },
  standard: {
    plan_type: "standard",
    premium_usd_monthly: 5,
    coverage_usd: 500,
    deductible_usd: 10,
    coverage_types: ["transaction_failure", "delivery_failure", "escrow_dispute"],
    description: "Standard coverage for transactions, deliveries, and escrow disputes",
  },
  premium: {
    plan_type: "premium",
    premium_usd_monthly: 25,
    coverage_usd: 5000,
    deductible_usd: 25,
    coverage_types: ["transaction_failure", "delivery_failure", "escrow_dispute", "swap_loss", "prediction_loss"],
    description: "Full coverage for all claim types",
  },
  enterprise: {
    plan_type: "enterprise",
    premium_usd_monthly: 100,
    coverage_usd: 50000,
    deductible_usd: 100,
    coverage_types: ["transaction_failure", "delivery_failure", "escrow_dispute", "swap_loss", "prediction_loss"],
    description: "Enterprise coverage with priority review and maximum limits",
    priority_review: true,
  },
};

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS insurance_policies (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    plan_type TEXT NOT NULL,                    -- 'basic','standard','premium','enterprise'
    coverage_usd REAL NOT NULL,                 -- max payout per claim
    premium_usd_monthly REAL NOT NULL,
    deductible_usd REAL NOT NULL,
    coverage_types TEXT NOT NULL,               -- JSON array
    status TEXT DEFAULT 'active',               -- 'active','expired','cancelled'
    claims_filed INTEGER DEFAULT 0,
    claims_paid INTEGER DEFAULT 0,
    total_premiums_paid REAL DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS insurance_claims (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES insurance_policies(id),
    agent_id TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    description TEXT NOT NULL,
    claimed_amount_usd REAL NOT NULL,
    approved_amount_usd REAL DEFAULT 0,
    deductible_applied_usd REAL DEFAULT 0,
    payout_usd REAL DEFAULT 0,
    evidence_uri TEXT,
    status TEXT DEFAULT 'filed',               -- 'filed','reviewing','approved','denied','paid'
    reviewer_notes TEXT,
    filed_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS core_insurance_pool (
    id INTEGER PRIMARY KEY,
    total_premiums_collected_usd REAL DEFAULT 0,
    total_claims_paid_usd REAL DEFAULT 0,
    reserve_usd REAL DEFAULT 0,
    surplus_usd REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Initialize pool singleton
  INSERT OR IGNORE INTO core_insurance_pool (id, total_premiums_collected_usd, total_claims_paid_usd, reserve_usd, surplus_usd, updated_at)
  VALUES (1, 0, 0, 0, 0, datetime('now'));

  CREATE INDEX IF NOT EXISTS idx_policies_agent ON insurance_policies(agent_id);
  CREATE INDEX IF NOT EXISTS idx_policies_status ON insurance_policies(status);
  CREATE INDEX IF NOT EXISTS idx_claims_policy ON insurance_claims(policy_id);
  CREATE INDEX IF NOT EXISTS idx_claims_agent ON insurance_claims(agent_id);
  CREATE INDEX IF NOT EXISTS idx_claims_status ON insurance_claims(status);
`);

// ─── Helpers ──────────────────────────────────────

function updatePool(premiumDelta = 0, claimDelta = 0) {
  const pool = db.prepare("SELECT * FROM core_insurance_pool WHERE id = 1").get();
  const newPremiums = (pool.total_premiums_collected_usd || 0) + premiumDelta;
  const newClaims = (pool.total_claims_paid_usd || 0) + claimDelta;
  const reserve = newPremiums * 0.20; // keep 20% as reserve
  const surplus = newPremiums - newClaims - reserve;

  db.prepare(`
    UPDATE core_insurance_pool
    SET total_premiums_collected_usd = ?,
        total_claims_paid_usd = ?,
        reserve_usd = ?,
        surplus_usd = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).run(
    Math.round(newPremiums * 100) / 100,
    Math.round(newClaims * 100) / 100,
    Math.round(Math.max(0, reserve) * 100) / 100,
    Math.round(surplus * 100) / 100,
  );
}

// ─── Policy Management ────────────────────────────

/**
 * List all available insurance plans
 */
export function getInsurancePlans() {
  return Object.values(INSURANCE_PLANS);
}

/**
 * Purchase an insurance policy
 */
export function purchasePolicy({ agent_id, plan_type }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!INSURANCE_PLANS[plan_type]) {
    throw new Error(`Invalid plan_type: ${plan_type}. Choose: ${Object.keys(INSURANCE_PLANS).join(", ")}`);
  }

  // Check for existing active policy of same type
  const existing = db.prepare(
    "SELECT id FROM insurance_policies WHERE agent_id = ? AND plan_type = ? AND status = 'active'"
  ).get(agent_id, plan_type);
  if (existing) throw new Error(`Already have an active ${plan_type} policy`);

  const plan = INSURANCE_PLANS[plan_type];
  const id = uuid();
  const now = new Date();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + 1);

  db.prepare(`
    INSERT INTO insurance_policies
      (id, agent_id, plan_type, coverage_usd, premium_usd_monthly, deductible_usd, coverage_types, expires_at, total_premiums_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, agent_id, plan_type,
    plan.coverage_usd, plan.premium_usd_monthly, plan.deductible_usd,
    JSON.stringify(plan.coverage_types),
    expires.toISOString(),
    plan.premium_usd_monthly,
  );

  // Add first premium to pool
  updatePool(plan.premium_usd_monthly, 0);

  return {
    policy_id: id,
    agent_id,
    plan_type,
    coverage_usd: plan.coverage_usd,
    premium_usd_monthly: plan.premium_usd_monthly,
    deductible_usd: plan.deductible_usd,
    coverage_types: plan.coverage_types,
    status: "active",
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    first_premium_paid_usd: plan.premium_usd_monthly,
  };
}

// ─── Claims ───────────────────────────────────────

/**
 * File an insurance claim
 */
export function fileClaim({ policy_id, agent_id, claim_type, description, claimed_amount_usd, evidence_uri }) {
  if (!policy_id) throw new Error("policy_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!claim_type) throw new Error("claim_type is required");
  if (!description) throw new Error("description is required");
  if (!claimed_amount_usd || claimed_amount_usd <= 0) throw new Error("claimed_amount_usd must be positive");

  const policy = db.prepare("SELECT * FROM insurance_policies WHERE id = ? AND agent_id = ?").get(policy_id, agent_id);
  if (!policy) throw new Error("Policy not found or not owned by this agent");
  if (policy.status !== "active") throw new Error(`Policy is ${policy.status}`);

  // Check coverage type
  const coverageTypes = JSON.parse(policy.coverage_types || "[]");
  if (!coverageTypes.includes(claim_type)) {
    throw new Error(`Your ${policy.plan_type} policy does not cover ${claim_type}. Covered types: ${coverageTypes.join(", ")}`);
  }

  // Enforce max claim amount
  if (claimed_amount_usd > policy.coverage_usd) {
    throw new Error(`Claim amount $${claimed_amount_usd} exceeds policy coverage of $${policy.coverage_usd}`);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO insurance_claims
      (id, policy_id, agent_id, claim_type, description, claimed_amount_usd, evidence_uri)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, policy_id, agent_id, claim_type, description, claimed_amount_usd, evidence_uri || null);

  db.prepare("UPDATE insurance_policies SET claims_filed = claims_filed + 1 WHERE id = ?").run(policy_id);

  // Trigger auto-review
  const autoResult = autoReviewClaim(id);

  return {
    claim_id: id,
    policy_id,
    agent_id,
    claim_type,
    claimed_amount_usd,
    status: autoResult.status,
    auto_reviewed: true,
    auto_review_result: autoResult,
  };
}

/**
 * Manual review — approve or deny a claim
 */
export function reviewClaim(claim_id, approved, reviewer_notes, approved_amount_usd) {
  const claim = db.prepare("SELECT * FROM insurance_claims WHERE id = ?").get(claim_id);
  if (!claim) throw new Error("Claim not found");
  if (["paid", "denied"].includes(claim.status)) throw new Error(`Claim is already ${claim.status}`);

  const policy = db.prepare("SELECT * FROM insurance_policies WHERE id = ?").get(claim.policy_id);

  if (!approved) {
    db.prepare(`
      UPDATE insurance_claims
      SET status = 'denied', reviewer_notes = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(reviewer_notes || "Claim denied by reviewer", claim_id);
    return { claim_id, status: "denied", reviewer_notes };
  }

  // Calculate payout: min(approved_amount, coverage) - deductible
  const approvedAmt = Math.min(
    approved_amount_usd || claim.claimed_amount_usd,
    policy.coverage_usd,
  );
  const deductible = policy.deductible_usd;
  const payout = Math.max(0, Math.round((approvedAmt - deductible) * 100) / 100);

  db.prepare(`
    UPDATE insurance_claims
    SET status = 'paid',
        approved_amount_usd = ?,
        deductible_applied_usd = ?,
        payout_usd = ?,
        reviewer_notes = ?,
        resolved_at = datetime('now')
    WHERE id = ?
  `).run(approvedAmt, deductible, payout, reviewer_notes || "Claim approved", claim_id);

  db.prepare("UPDATE insurance_policies SET claims_paid = claims_paid + 1 WHERE id = ?").run(claim.policy_id);

  // Deduct from pool
  updatePool(0, payout);

  return {
    claim_id,
    status: "paid",
    approved_amount_usd: approvedAmt,
    deductible_applied_usd: deductible,
    payout_usd: payout,
    reviewer_notes: reviewer_notes || "Claim approved",
  };
}

/**
 * Auto-review a claim based on rules:
 * Auto-approve if claimed_amount < deductible * 5 AND agent trust_score > 60
 * Otherwise set to 'reviewing' for manual review
 */
export function autoReviewClaim(claim_id) {
  const claim = db.prepare("SELECT * FROM insurance_claims WHERE id = ?").get(claim_id);
  if (!claim) throw new Error("Claim not found");
  if (!["filed", "reviewing"].includes(claim.status)) {
    return { claim_id, status: claim.status, message: "Already resolved" };
  }

  const policy = db.prepare("SELECT * FROM insurance_policies WHERE id = ?").get(claim.policy_id);

  // Check trust score from reputation module (if available)
  let trustScore = 0;
  try {
    const rep = db.prepare("SELECT trust_score FROM agent_reputation WHERE agent_id = ?").get(claim.agent_id);
    if (rep) trustScore = rep.trust_score;
  } catch (_) {
    // reputation table may not exist yet; default to 0
  }

  const autoApproveThreshold = policy.deductible_usd * 5;
  const eligible = claim.claimed_amount_usd < autoApproveThreshold && trustScore > 60;

  if (eligible) {
    return reviewClaim(claim_id, true, "Auto-approved: low amount and good trust score", claim.claimed_amount_usd);
  } else {
    // Set to reviewing
    db.prepare("UPDATE insurance_claims SET status = 'reviewing' WHERE id = ?").run(claim_id);
    return {
      claim_id,
      status: "reviewing",
      message: eligible
        ? "Auto-approved"
        : `Manual review required (claimed: $${claim.claimed_amount_usd}, threshold: $${autoApproveThreshold}, trust_score: ${trustScore})`,
    };
  }
}

// ─── Queries ──────────────────────────────────────

/**
 * Get all policies for an agent
 */
export function getAgentPolicies(agent_id) {
  const policies = db.prepare("SELECT * FROM insurance_policies WHERE agent_id = ? ORDER BY created_at DESC").all(agent_id);
  return policies.map(p => ({ ...p, coverage_types: JSON.parse(p.coverage_types || "[]") }));
}

/**
 * Get all claims for an agent
 */
export function getAgentClaims(agent_id) {
  return db.prepare(`
    SELECT c.*, p.plan_type, p.coverage_usd, p.deductible_usd
    FROM insurance_claims c
    JOIN insurance_policies p ON c.policy_id = p.id
    WHERE c.agent_id = ?
    ORDER BY c.filed_at DESC
  `).all(agent_id);
}

// ─── Billing ─────────────────────────────────────

/**
 * Batch charge monthly premiums for all active policies
 */
export function processMonthlyPremiums() {
  const active = db.prepare(`
    SELECT * FROM insurance_policies WHERE status = 'active'
  `).all();

  let totalCollected = 0;
  let processed = 0;
  const expired = [];

  for (const policy of active) {
    // Check if policy has expired
    if (new Date(policy.expires_at) < new Date()) {
      db.prepare("UPDATE insurance_policies SET status = 'expired' WHERE id = ?").run(policy.id);
      expired.push(policy.id);
      continue;
    }

    // Renew for another month
    const newExpiry = new Date(policy.expires_at);
    newExpiry.setMonth(newExpiry.getMonth() + 1);

    db.prepare(`
      UPDATE insurance_policies
      SET total_premiums_paid = total_premiums_paid + ?,
          expires_at = ?
      WHERE id = ?
    `).run(policy.premium_usd_monthly, newExpiry.toISOString(), policy.id);

    updatePool(policy.premium_usd_monthly, 0);
    totalCollected += policy.premium_usd_monthly;
    processed++;
  }

  return {
    processed,
    expired_policies: expired.length,
    total_collected_usd: Math.round(totalCollected * 100) / 100,
  };
}

// ─── Stats ────────────────────────────────────────

/**
 * Insurance pool statistics
 */
export function getInsuranceStats() {
  const pool = db.prepare("SELECT * FROM core_insurance_pool WHERE id = 1").get();
  const totalPolicies = db.prepare("SELECT COUNT(*) as count FROM insurance_policies WHERE status = 'active'").get().count;
  const totalClaims = db.prepare("SELECT COUNT(*) as count FROM insurance_claims").get().count;
  const pendingClaims = db.prepare("SELECT COUNT(*) as count FROM insurance_claims WHERE status IN ('filed','reviewing')").get().count;
  const paidClaims = db.prepare("SELECT COUNT(*) as count FROM insurance_claims WHERE status = 'paid'").get().count;
  const deniedClaims = db.prepare("SELECT COUNT(*) as count FROM insurance_claims WHERE status = 'denied'").get().count;
  const avgPayout = db.prepare("SELECT ROUND(AVG(payout_usd), 2) as avg FROM insurance_claims WHERE status = 'paid'").get().avg;

  const premiums = pool.total_premiums_collected_usd || 0;
  const claims = pool.total_claims_paid_usd || 0;
  const claimsRatio = premiums > 0 ? Math.round((claims / premiums) * 10000) / 100 : 0;

  const planBreakdown = db.prepare(`
    SELECT plan_type, COUNT(*) as count, SUM(total_premiums_paid) as revenue
    FROM insurance_policies WHERE status = 'active'
    GROUP BY plan_type
  `).all();

  return {
    pool: {
      total_premiums_collected_usd: Math.round(premiums * 100) / 100,
      total_claims_paid_usd: Math.round(claims * 100) / 100,
      reserve_usd: pool.reserve_usd || 0,
      surplus_usd: pool.surplus_usd || 0,
      claims_ratio_pct: claimsRatio,
    },
    policies: {
      active: totalPolicies,
      by_plan: planBreakdown,
    },
    claims: {
      total: totalClaims,
      pending: pendingClaims,
      paid: paidClaims,
      denied: deniedClaims,
      avg_payout_usd: avgPayout || 0,
    },
  };
}
