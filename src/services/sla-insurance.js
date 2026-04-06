import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const SLA_PLATFORM_COMMISSION   = 0.20;  // 20% of premium kept by platform
const SLA_CLAIM_PROCESSING_FEE  = 5.00;  // $5 flat fee per claim filed
const SLA_RESERVE_RATIO         = 0.70;  // 70% of premium goes to claims reserve

// ─── SLA Tier Definitions ─────────────────────────────────────────────────────

const SLA_TIERS = {
  basic: {
    name: "Basic",
    max_latency_minutes: 60,
    guaranteed_completion: false,
    coverage_pct: 50,        // % of task value covered
    premium_pct: 0.02,       // 2% of task value
    min_premium_usd: 1.00,
    max_coverage_usd: 500,
    sla_breach_credits: 1,   // x task value in credits on breach
  },
  standard: {
    name: "Standard",
    max_latency_minutes: 15,
    guaranteed_completion: true,
    coverage_pct: 80,
    premium_pct: 0.05,
    min_premium_usd: 2.50,
    max_coverage_usd: 2000,
    sla_breach_credits: 1.5,
  },
  premium: {
    name: "Premium",
    max_latency_minutes: 5,
    guaranteed_completion: true,
    coverage_pct: 100,
    premium_pct: 0.10,
    min_premium_usd: 5.00,
    max_coverage_usd: 10000,
    sla_breach_credits: 2,
  },
  enterprise: {
    name: "Enterprise",
    max_latency_minutes: 2,
    guaranteed_completion: true,
    coverage_pct: 100,
    premium_pct: 0.15,
    min_premium_usd: 25.00,
    max_coverage_usd: 100000,
    sla_breach_credits: 3,
  },
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sla_policies (
    id                      TEXT PRIMARY KEY,
    agent_id                TEXT NOT NULL,
    task_id                 TEXT NOT NULL,
    task_type               TEXT,
    sla_type                TEXT NOT NULL CHECK(sla_type IN ('basic','standard','premium','enterprise')),
    task_value_usd          REAL NOT NULL,
    max_latency_minutes     INTEGER NOT NULL,
    guaranteed_completion   INTEGER DEFAULT 0,
    coverage_pct            REAL NOT NULL,
    premium_usd             REAL NOT NULL,
    platform_cut_usd        REAL NOT NULL,
    reserve_usd             REAL NOT NULL,
    max_coverage_usd        REAL NOT NULL,
    status                  TEXT DEFAULT 'active' CHECK(status IN ('active','expired','breached','claimed','cancelled')),
    compliance_status       TEXT DEFAULT 'compliant' CHECK(compliance_status IN ('compliant','warning','breached','pending_review')),
    breach_detected_at      TEXT,
    activated_at            TEXT DEFAULT (datetime('now')),
    expires_at              TEXT NOT NULL,
    completed_at            TEXT,
    task_started_at         TEXT,
    task_completed_at       TEXT,
    actual_latency_minutes  REAL,
    created_at              TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sla_claims (
    id                  TEXT PRIMARY KEY,
    policy_id           TEXT NOT NULL REFERENCES sla_policies(id),
    agent_id            TEXT NOT NULL,
    reason              TEXT NOT NULL CHECK(reason IN ('latency_exceeded','task_incomplete','quality_failure','partial_completion','timeout')),
    evidence            TEXT,
    claim_amount_usd    REAL NOT NULL,
    processing_fee_usd  REAL NOT NULL,
    net_payout_usd      REAL,
    status              TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','approved','rejected','paid')),
    rejection_reason    TEXT,
    reviewed_by         TEXT,
    submitted_at        TEXT DEFAULT (datetime('now')),
    reviewed_at         TEXT,
    paid_at             TEXT
  );

  CREATE TABLE IF NOT EXISTS sla_compliance_log (
    id            TEXT PRIMARY KEY,
    policy_id     TEXT NOT NULL REFERENCES sla_policies(id),
    check_type    TEXT NOT NULL CHECK(check_type IN ('latency','completion','quality','heartbeat')),
    result        TEXT NOT NULL CHECK(result IN ('pass','warn','fail')),
    measured_value TEXT,
    threshold      TEXT,
    notes         TEXT,
    checked_at    TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed demo SLA policies ───────────────────────────────────────────────────

const _slaCount = db.prepare("SELECT COUNT(*) as n FROM sla_policies").get().n;
if (_slaCount === 0) {
  const now = new Date();
  const policies = [
    {
      id: uuid(), agent_id: "agent_demo_sla_01", task_id: `task_${uuid().slice(0, 8)}`,
      task_type: "data_processing", sla_type: "standard", task_value_usd: 200,
      max_latency_minutes: 15, guaranteed_completion: 1, coverage_pct: 80,
      premium_usd: 10.00, platform_cut_usd: 2.00, reserve_usd: 7.00,
      max_coverage_usd: 160, status: "active", compliance_status: "compliant",
      activated_at: new Date(now.getTime() - 30 * 60000).toISOString(),
      expires_at: new Date(now.getTime() + 90 * 60000).toISOString(),
    },
    {
      id: uuid(), agent_id: "agent_demo_sla_02", task_id: `task_${uuid().slice(0, 8)}`,
      task_type: "api_call_chain", sla_type: "premium", task_value_usd: 500,
      max_latency_minutes: 5, guaranteed_completion: 1, coverage_pct: 100,
      premium_usd: 50.00, platform_cut_usd: 10.00, reserve_usd: 35.00,
      max_coverage_usd: 500, status: "breached", compliance_status: "breached",
      breach_detected_at: new Date(now.getTime() - 45 * 60000).toISOString(),
      activated_at: new Date(now.getTime() - 120 * 60000).toISOString(),
      expires_at: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: uuid(), agent_id: "agent_demo_sla_01", task_id: `task_${uuid().slice(0, 8)}`,
      task_type: "report_generation", sla_type: "basic", task_value_usd: 50,
      max_latency_minutes: 60, guaranteed_completion: 0, coverage_pct: 50,
      premium_usd: 1.00, platform_cut_usd: 0.20, reserve_usd: 0.70,
      max_coverage_usd: 25, status: "expired", compliance_status: "compliant",
      activated_at: new Date(now.getTime() - 240 * 60000).toISOString(),
      expires_at: new Date(now.getTime() - 120 * 60000).toISOString(),
      completed_at: new Date(now.getTime() - 130 * 60000).toISOString(),
    },
  ];
  const insertPolicy = db.prepare(`
    INSERT OR IGNORE INTO sla_policies
      (id, agent_id, task_id, task_type, sla_type, task_value_usd, max_latency_minutes,
       guaranteed_completion, coverage_pct, premium_usd, platform_cut_usd, reserve_usd,
       max_coverage_usd, status, compliance_status, breach_detected_at, activated_at,
       expires_at, completed_at)
    VALUES
      (@id, @agent_id, @task_id, @task_type, @sla_type, @task_value_usd, @max_latency_minutes,
       @guaranteed_completion, @coverage_pct, @premium_usd, @platform_cut_usd, @reserve_usd,
       @max_coverage_usd, @status, @compliance_status, @breach_detected_at, @activated_at,
       @expires_at, @completed_at)
  `);
  for (const p of policies) insertPolicy.run({ breach_detected_at: null, completed_at: null, ...p });

  // Seed a claim for the breached policy
  db.prepare(`
    INSERT OR IGNORE INTO sla_claims (id, policy_id, agent_id, reason, evidence, claim_amount_usd, processing_fee_usd, net_payout_usd, status, reviewed_at, reviewed_by)
    VALUES (@id, @policy_id, @agent_id, 'latency_exceeded', 'Task ran for 120 minutes, 24x the 5-minute SLA guarantee.', 500, 5, 495, 'approved', datetime('now'), 'auto_adjudicator_v2')
  `).run({ id: uuid(), policy_id: policies[1].id, agent_id: policies[1].agent_id });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePremium(tier, taskValueUsd) {
  const t = SLA_TIERS[tier];
  const raw = Math.max(t.min_premium_usd, taskValueUsd * t.premium_pct);
  return Math.round(raw * 100) / 100;
}

function checkExpiry(policy) {
  if (policy.status === "active" && new Date(policy.expires_at) < new Date()) {
    db.prepare("UPDATE sla_policies SET status = 'expired' WHERE id = ?").run(policy.id);
    return { ...policy, status: "expired" };
  }
  return policy;
}

// ─── Purchase SLA ─────────────────────────────────────────────────────────────

/**
 * Purchase an SLA policy for a task, guaranteeing latency and/or completion.
 * @param {string} taskId                - The task to insure
 * @param {string} slaType               - basic|standard|premium|enterprise
 * @param {number} maxLatencyMinutes     - Custom max latency (must meet or beat tier minimum)
 * @param {boolean} guaranteedCompletion - Require guaranteed completion coverage
 * @returns New SLA policy record with coverage details
 */
export function purchaseSla(taskId, slaType, maxLatencyMinutes, guaranteedCompletion = false) {
  if (!taskId)  throw new Error("taskId is required");
  const validTypes = Object.keys(SLA_TIERS);
  if (!validTypes.includes(slaType)) throw new Error(`slaType must be one of: ${validTypes.join(", ")}`);

  const tier = SLA_TIERS[slaType];

  if (maxLatencyMinutes != null && maxLatencyMinutes < tier.max_latency_minutes) {
    throw new Error(`maxLatencyMinutes ${maxLatencyMinutes} is stricter than tier minimum ${tier.max_latency_minutes}. Upgrade to a higher tier.`);
  }
  if (guaranteedCompletion && !tier.guaranteed_completion) {
    throw new Error(`Guaranteed completion is not available on '${slaType}' tier. Upgrade to 'standard' or higher.`);
  }

  // Determine task value from a realistic lookup simulation
  const taskValue       = Math.round((50 + Math.random() * 950) * 100) / 100; // simulated
  const effectiveLatency = maxLatencyMinutes ?? tier.max_latency_minutes;
  const premium         = computePremium(slaType, taskValue);
  const platformCut     = Math.round(premium * SLA_PLATFORM_COMMISSION * 100) / 100;
  const reserve         = Math.round(premium * SLA_RESERVE_RATIO * 100) / 100;
  const maxCoverage     = Math.min(tier.max_coverage_usd, Math.round(taskValue * (tier.coverage_pct / 100) * 100) / 100);

  const id         = uuid();
  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const now        = new Date();
  // SLA window = 2x latency for headroom, minimum 30 mins, max 24 hours
  const windowMins = Math.min(Math.max(effectiveLatency * 2, 30), 1440);
  const expiresAt  = new Date(now.getTime() + windowMins * 60000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO sla_policies
      (id, agent_id, task_id, sla_type, task_value_usd, max_latency_minutes,
       guaranteed_completion, coverage_pct, premium_usd, platform_cut_usd,
       reserve_usd, max_coverage_usd, status, compliance_status, activated_at, expires_at, created_at)
    VALUES
      (@id, @agent_id, @task_id, @sla_type, @task_value_usd, @max_latency_minutes,
       @guaranteed_completion, @coverage_pct, @premium_usd, @platform_cut_usd,
       @reserve_usd, @max_coverage_usd, 'active', 'compliant', @activated_at, @expires_at, @created_at)
  `).run({
    id, agent_id: agentId, task_id: taskId, sla_type: slaType,
    task_value_usd: taskValue, max_latency_minutes: effectiveLatency,
    guaranteed_completion: guaranteedCompletion ? 1 : 0,
    coverage_pct: tier.coverage_pct, premium_usd: premium,
    platform_cut_usd: platformCut, reserve_usd: reserve,
    max_coverage_usd: maxCoverage,
    activated_at: now.toISOString(),
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });

  return {
    sla_id:                  id,
    agent_id:                agentId,
    task_id:                 taskId,
    sla_type:                slaType,
    tier_name:               tier.name,
    status:                  "active",
    guarantees: {
      max_latency_minutes:     effectiveLatency,
      guaranteed_completion:   guaranteedCompletion,
      coverage_pct:            tier.coverage_pct,
      max_coverage_usd:        maxCoverage,
      breach_credit_multiplier: tier.sla_breach_credits,
    },
    financials: {
      task_value_usd:          taskValue,
      premium_usd:             premium,
      platform_cut_usd:        platformCut,
      claims_reserve_usd:      reserve,
      max_payout_usd:          maxCoverage,
    },
    activated_at:            now.toISOString(),
    expires_at:              expiresAt,
    compliance_status:       "compliant",
    message:                 `SLA policy purchased. $${premium} premium covers up to $${maxCoverage} on breach. Active until ${expiresAt}.`,
  };
}

// ─── Check SLA Status ─────────────────────────────────────────────────────────

/**
 * Check the current compliance status of an SLA policy.
 * @param {string} slaId
 * @returns Current compliance report with latency tracking and breach detection
 */
export function checkSlaStatus(slaId) {
  let policy = db.prepare("SELECT * FROM sla_policies WHERE id = ?").get(slaId);
  if (!policy) throw new Error(`SLA policy not found: ${slaId}`);

  policy = checkExpiry(policy);

  const now          = Date.now();
  const activatedMs  = new Date(policy.activated_at).getTime();
  const elapsedMins  = (now - activatedMs) / 60000;
  const expiresMs    = new Date(policy.expires_at).getTime();
  const remainingMs  = expiresMs - now;
  const remainingMins = Math.max(0, remainingMs / 60000);

  // Simulate task progress
  const taskProgressPct = Math.min(100, Math.round((elapsedMins / (policy.max_latency_minutes * 1.5)) * 100));
  const simulatedLatency = elapsedMins; // time elapsed so far

  // Check for breach
  let complianceStatus = policy.compliance_status;
  if (policy.status === "active") {
    if (elapsedMins > policy.max_latency_minutes * 0.8 && complianceStatus === "compliant") {
      complianceStatus = "warning";
      db.prepare("UPDATE sla_policies SET compliance_status = 'warning' WHERE id = ?").run(slaId);
      // Log compliance check
      db.prepare(`
        INSERT OR IGNORE INTO sla_compliance_log (id, policy_id, check_type, result, measured_value, threshold, notes)
        VALUES (@id, @policy_id, 'latency', 'warn', @measured, @threshold, 'Approaching latency limit')
      `).run({ id: uuid(), policy_id: slaId, measured: `${Math.round(elapsedMins * 10) / 10}min`, threshold: `${policy.max_latency_minutes}min` });
    }
    if (elapsedMins > policy.max_latency_minutes && complianceStatus !== "breached") {
      complianceStatus = "breached";
      db.prepare("UPDATE sla_policies SET compliance_status = 'breached', status = 'breached', breach_detected_at = datetime('now') WHERE id = ?").run(slaId);
      db.prepare(`
        INSERT OR IGNORE INTO sla_compliance_log (id, policy_id, check_type, result, measured_value, threshold, notes)
        VALUES (@id, @policy_id, 'latency', 'fail', @measured, @threshold, 'SLA breached — latency exceeded')
      `).run({ id: uuid(), policy_id: slaId, measured: `${Math.round(elapsedMins * 10) / 10}min`, threshold: `${policy.max_latency_minutes}min` });
    }
  }

  const recentLogs = db.prepare("SELECT * FROM sla_compliance_log WHERE policy_id = ? ORDER BY checked_at DESC LIMIT 5").all(slaId);
  const claimCount = db.prepare("SELECT COUNT(*) as n FROM sla_claims WHERE policy_id = ?").get(slaId).n;

  return {
    sla_id:               slaId,
    task_id:              policy.task_id,
    agent_id:             policy.agent_id,
    sla_type:             policy.sla_type,
    status:               policy.status,
    compliance_status:    complianceStatus,
    guarantees: {
      max_latency_minutes:    policy.max_latency_minutes,
      guaranteed_completion:  policy.guaranteed_completion === 1,
      coverage_pct:           policy.coverage_pct,
      max_coverage_usd:       policy.max_coverage_usd,
    },
    tracking: {
      elapsed_minutes:        Math.round(elapsedMins * 100) / 100,
      remaining_minutes:      Math.round(remainingMins * 100) / 100,
      latency_budget_used_pct: Math.min(100, Math.round((elapsedMins / policy.max_latency_minutes) * 10000) / 100),
      simulated_task_progress_pct: taskProgressPct,
    },
    breach_detected_at:   policy.breach_detected_at,
    activated_at:         policy.activated_at,
    expires_at:           policy.expires_at,
    premium_usd:          policy.premium_usd,
    max_payout_usd:       policy.max_coverage_usd,
    claims_filed:         claimCount,
    can_file_claim:       ["breached","active"].includes(policy.status) && claimCount === 0 && complianceStatus !== "compliant",
    recent_compliance_checks: recentLogs.map(l => ({
      check_type:    l.check_type,
      result:        l.result,
      measured:      l.measured_value,
      threshold:     l.threshold,
      notes:         l.notes,
      checked_at:    l.checked_at,
    })),
    checked_at: new Date().toISOString(),
  };
}

// ─── File SLA Claim ───────────────────────────────────────────────────────────

/**
 * File an insurance claim against an SLA breach.
 * @param {string} slaId    - The SLA policy to claim against
 * @param {string} reason   - latency_exceeded|task_incomplete|quality_failure|partial_completion|timeout
 * @param {string} evidence - Description of the breach evidence
 * @returns Claim submission record with estimated payout
 */
export function fileSlaClaim(slaId, reason, evidence) {
  const policy = db.prepare("SELECT * FROM sla_policies WHERE id = ?").get(slaId);
  if (!policy) throw new Error(`SLA policy not found: ${slaId}`);

  const validReasons = ["latency_exceeded","task_incomplete","quality_failure","partial_completion","timeout"];
  if (!validReasons.includes(reason)) throw new Error(`reason must be one of: ${validReasons.join(", ")}`);
  if (!evidence) throw new Error("evidence is required to file a claim");
  if (policy.status === "active" && policy.compliance_status === "compliant") {
    throw new Error("Cannot file a claim on a compliant, active SLA. A breach must be detected first.");
  }
  if (policy.status === "claimed") {
    throw new Error("A claim has already been filed on this SLA policy.");
  }
  if (policy.status === "cancelled") {
    throw new Error("Cannot file a claim on a cancelled SLA policy.");
  }

  // Check for duplicate claim
  const existingClaim = db.prepare("SELECT id FROM sla_claims WHERE policy_id = ?").get(slaId);
  if (existingClaim) {
    throw new Error(`A claim (${existingClaim.id}) already exists for this policy.`);
  }

  // Compute claim amount based on reason severity
  const severityMultipliers = {
    latency_exceeded:    0.5,
    task_incomplete:     1.0,
    quality_failure:     0.75,
    partial_completion:  0.6,
    timeout:             1.0,
  };
  const rawClaim    = Math.round(policy.max_coverage_usd * severityMultipliers[reason] * 100) / 100;
  const netPayout   = Math.max(0, Math.round((rawClaim - SLA_CLAIM_PROCESSING_FEE) * 100) / 100);

  const id  = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO sla_claims
      (id, policy_id, agent_id, reason, evidence, claim_amount_usd, processing_fee_usd, net_payout_usd, status, submitted_at)
    VALUES
      (@id, @policy_id, @agent_id, @reason, @evidence, @claim_amount_usd, @processing_fee_usd, @net_payout_usd, 'submitted', @submitted_at)
  `).run({
    id, policy_id: slaId, agent_id: policy.agent_id,
    reason, evidence,
    claim_amount_usd: rawClaim,
    processing_fee_usd: SLA_CLAIM_PROCESSING_FEE,
    net_payout_usd: netPayout,
    submitted_at: now,
  });

  db.prepare("UPDATE sla_policies SET status = 'claimed' WHERE id = ?").run(slaId);

  // Estimated review time based on claim size
  const reviewHours = rawClaim > 1000 ? 24 : rawClaim > 100 ? 4 : 1;

  return {
    claim_id:              id,
    sla_id:                slaId,
    policy_type:           policy.sla_type,
    agent_id:              policy.agent_id,
    task_id:               policy.task_id,
    reason,
    evidence,
    claim_amount_usd:      rawClaim,
    processing_fee_usd:    SLA_CLAIM_PROCESSING_FEE,
    estimated_net_payout_usd: netPayout,
    max_coverage_usd:      policy.max_coverage_usd,
    status:                "submitted",
    breach_detected_at:    policy.breach_detected_at,
    estimated_review_hours: reviewHours,
    estimated_decision_at: new Date(Date.now() + reviewHours * 3600000).toISOString(),
    submitted_at:          now,
    message:               `Claim submitted for $${rawClaim}. After $${SLA_CLAIM_PROCESSING_FEE} processing fee, estimated payout: $${netPayout}. Review within ${reviewHours}h.`,
  };
}

// ─── Get Coverage Options ─────────────────────────────────────────────────────

/**
 * Browse all available SLA tiers and pricing for a given task type and value.
 * @param {string} taskType   - Descriptive task type (informational)
 * @param {number} taskValue  - Estimated task value in USD for premium calculation
 * @returns All coverage tiers with pricing, guarantees, and recommendations
 */
export function getCoverageOptions(taskType, taskValue) {
  if (taskValue == null || taskValue <= 0) throw new Error("taskValue must be a positive number");

  const options = Object.entries(SLA_TIERS).map(([tierKey, tier]) => {
    const premium       = computePremium(tierKey, taskValue);
    const maxCoverage   = Math.min(tier.max_coverage_usd, Math.round(taskValue * (tier.coverage_pct / 100) * 100) / 100);
    const roi           = premium > 0 ? Math.round((maxCoverage / premium) * 100) / 100 : 0;
    const platformCut   = Math.round(premium * SLA_PLATFORM_COMMISSION * 100) / 100;

    return {
      tier:                   tierKey,
      name:                   tier.name,
      max_latency_minutes:    tier.max_latency_minutes,
      guaranteed_completion:  tier.guaranteed_completion,
      coverage_pct:           tier.coverage_pct,
      max_coverage_usd:       maxCoverage,
      sla_breach_credit_multiplier: tier.sla_breach_credits,
      pricing: {
        premium_usd:          premium,
        platform_cut_usd:     platformCut,
        claims_reserve_usd:   Math.round(premium * SLA_RESERVE_RATIO * 100) / 100,
        premium_pct_of_value: Math.round((premium / taskValue) * 10000) / 100,
        coverage_ratio:       roi,
      },
      claim_reasons_covered:  ["latency_exceeded","task_incomplete","quality_failure","partial_completion","timeout"],
    };
  });

  // Recommend based on task value
  const recommended = taskValue > 500 ? "premium"
                    : taskValue > 100 ? "standard"
                    : "basic";

  return {
    task_type:             taskType,
    task_value_usd:        taskValue,
    coverage_options:      options,
    recommended_tier:      recommended,
    recommended_reason:    taskValue > 500
      ? "High-value task — premium coverage ensures full reimbursement on breach"
      : taskValue > 100
      ? "Mid-value task — standard offers 80% coverage with guaranteed completion"
      : "Low-value task — basic coverage provides cost-effective protection",
    platform_commission:   `${SLA_PLATFORM_COMMISSION * 100}% of premium`,
    claim_processing_fee:  `$${SLA_CLAIM_PROCESSING_FEE} per claim`,
    generated_at:          new Date().toISOString(),
  };
}

// ─── List Active SLAs ─────────────────────────────────────────────────────────

/**
 * List all active SLA policies for an agent, with compliance status and claims summary.
 * @param {string} agentId  - Agent whose SLAs to list
 * @returns Active policies with compliance overview
 */
export function listActiveSlas(agentId) {
  if (!agentId) throw new Error("agentId is required");

  // Auto-expire any policies past their expiry date
  db.prepare("UPDATE sla_policies SET status = 'expired' WHERE agent_id = ? AND status = 'active' AND expires_at < datetime('now')").run(agentId);

  const policies = db.prepare("SELECT * FROM sla_policies WHERE agent_id = ? ORDER BY created_at DESC").all(agentId);

  const activePolicies = policies.filter(p => p.status === "active");
  const breachedPolicies = policies.filter(p => p.status === "breached");
  const expiredPolicies = policies.filter(p => p.status === "expired");

  const totalPremiumPaid = Math.round(policies.reduce((s, p) => s + p.premium_usd, 0) * 100) / 100;
  const totalCoverage    = Math.round(activePolicies.reduce((s, p) => s + p.max_coverage_usd, 0) * 100) / 100;

  const claims = db.prepare(`
    SELECT c.*, p.sla_type FROM sla_claims c
    JOIN sla_policies p ON c.policy_id = p.id
    WHERE c.agent_id = ?
    ORDER BY c.submitted_at DESC
  `).all(agentId);

  return {
    agent_id: agentId,
    summary: {
      active_policies:    activePolicies.length,
      breached_policies:  breachedPolicies.length,
      expired_policies:   expiredPolicies.length,
      total_policies:     policies.length,
      total_premium_paid_usd: totalPremiumPaid,
      total_active_coverage_usd: totalCoverage,
      open_claims:        claims.filter(c => ["submitted","under_review"].includes(c.status)).length,
      total_claims:       claims.length,
    },
    active_policies: activePolicies.map(p => ({
      sla_id:               p.id,
      task_id:              p.task_id,
      sla_type:             p.sla_type,
      compliance_status:    p.compliance_status,
      max_latency_minutes:  p.max_latency_minutes,
      guaranteed_completion: p.guaranteed_completion === 1,
      max_coverage_usd:     p.max_coverage_usd,
      premium_usd:          p.premium_usd,
      activated_at:         p.activated_at,
      expires_at:           p.expires_at,
      minutes_remaining:    Math.max(0, Math.round((new Date(p.expires_at) - Date.now()) / 60000)),
    })),
    breached_policies: breachedPolicies.map(p => ({
      sla_id:              p.id,
      task_id:             p.task_id,
      sla_type:            p.sla_type,
      max_coverage_usd:    p.max_coverage_usd,
      breach_detected_at:  p.breach_detected_at,
      claim_filed:         claims.some(c => c.policy_id === p.id),
    })),
    claims_history: claims.map(c => ({
      claim_id:         c.id,
      policy_id:        c.policy_id,
      sla_type:         c.sla_type,
      reason:           c.reason,
      claim_amount_usd: c.claim_amount_usd,
      net_payout_usd:   c.net_payout_usd,
      status:           c.status,
      submitted_at:     c.submitted_at,
      paid_at:          c.paid_at,
    })),
    listed_at: new Date().toISOString(),
  };
}
