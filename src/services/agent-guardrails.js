import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const GUARDRAIL_FEES = {
  enforce_policy:     0.005,  // per check
  validate_output:    0.010,  // per validation
  set_policy:         0.000,  // free
  dashboard:          2.000,  // per month
  report_violation:   0.000,  // free (safety incentive)
  compliance_report:  5.000,  // per report
};

const RISK_LEVELS   = ["low", "medium", "high", "critical"];
const SEVERITY_LEVELS = ["info", "low", "medium", "high", "critical"];
const FRAMEWORKS    = ["SB243", "AB489", "GDPR", "HIPAA", "SOC2", "ISO27001", "NIST"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS guardrail_policies (
    id                 TEXT PRIMARY KEY,
    agent_id           TEXT NOT NULL UNIQUE,
    max_spend_per_action REAL DEFAULT 100,
    blocked_actions    TEXT DEFAULT '[]',
    required_approvals TEXT DEFAULT '[]',
    pii_handling       TEXT DEFAULT 'redact',
    content_filters    TEXT DEFAULT '["hate_speech","violence","adult"]',
    allowed_domains    TEXT DEFAULT '[]',
    active_rules_count INTEGER DEFAULT 0,
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guardrail_checks (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL,
    check_type       TEXT NOT NULL CHECK(check_type IN ('enforce_policy','validate_output')),
    action_or_output TEXT,
    context_data     TEXT,
    allowed          INTEGER,
    safe             INTEGER,
    policy_matched   TEXT,
    risk_level       TEXT,
    severity         TEXT,
    issues           TEXT DEFAULT '[]',
    requires_human   INTEGER DEFAULT 0,
    reason           TEXT,
    fee_usd          REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guardrail_violations (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    action              TEXT NOT NULL,
    violation_type      TEXT NOT NULL,
    severity            TEXT NOT NULL,
    investigation_status TEXT DEFAULT 'open',
    impact_assessment   TEXT,
    resolved_at         TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guardrail_reports (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    framework   TEXT NOT NULL,
    score       REAL,
    sections    TEXT,
    gaps        TEXT DEFAULT '[]',
    recommendations TEXT DEFAULT '[]',
    audit_ready INTEGER DEFAULT 0,
    fee_usd     REAL DEFAULT 5.0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guardrail_billing (
    id        TEXT PRIMARY KEY,
    agent_id  TEXT NOT NULL,
    operation TEXT NOT NULL,
    fee_usd   REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordBilling(agentId, operation, feeUsd) {
  if (feeUsd <= 0) return;
  db.prepare(`
    INSERT OR IGNORE INTO guardrail_billing (id, agent_id, operation, fee_usd, created_at)
    VALUES (@id, @agent_id, @operation, @fee_usd, @created_at)
  `).run({ id: uuid(), agent_id: agentId, operation, fee_usd: feeUsd, created_at: new Date().toISOString() });
}

function getPolicy(agentId) {
  return db.prepare("SELECT * FROM guardrail_policies WHERE agent_id = ?").get(agentId);
}

function parsePolicyField(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function detectPii(text) {
  const patterns = {
    ssn:          /\b\d{3}-\d{2}-\d{4}\b/,
    credit_card:  /\b(?:\d[ -]?){13,16}\b/,
    email:        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone:        /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    dob:          /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/,
    ip_address:   /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    passport:     /\b[A-Z]{1,2}\d{6,9}\b/,
  };
  const found = [];
  for (const [type, re] of Object.entries(patterns)) {
    if (re.test(text)) found.push(type);
  }
  return found;
}

function redactPii(text) {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN-REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL-REDACTED]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE-REDACTED]")
    .replace(/\b(?:\d[ -]?){13,16}\b/g, "[CARD-REDACTED]")
    .replace(/\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, "[DOB-REDACTED]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP-REDACTED]");
}

function detectHarmfulContent(text) {
  const markers = {
    hate_speech:     /\b(hate|slur|racist|bigot|discriminat)\w*\b/i,
    violence:        /\b(kill|murder|attack|harm|threat|weapon|bomb)\w*\b/i,
    adult:           /\b(explicit|pornograph|nsfw|adult.content)\w*\b/i,
    self_harm:       /\b(suicide|self.harm|self-harm|cutting)\w*\b/i,
    manipulation:    /\b(manipulat|deceiv|defraud|scam|phish)\w*\b/i,
  };
  const found = [];
  for (const [type, re] of Object.entries(markers)) {
    if (re.test(text)) found.push(type);
  }
  return found;
}

function detectHallucinationMarkers(text) {
  const markers = [
    /\bas of my (knowledge|training) (cutoff|date)\b/i,
    /\bI cannot (verify|confirm|access)\b/i,
    /\bI don['']t have (access|information) (to|about)\b/i,
    /\bthis (may|might|could) (not be|be outdated)\b/i,
    /\b(always|never|every single|100%)\b/i,
  ];
  return markers.some(re => re.test(text));
}

function computeRiskLevel(blockedMatch, piiFound, harmfulContent, requiresApproval) {
  if (blockedMatch || harmfulContent.length > 1) return "critical";
  if (harmfulContent.length > 0 || piiFound.length > 2) return "high";
  if (piiFound.length > 0 || requiresApproval) return "medium";
  return "low";
}

// ─── enforcePolicy ────────────────────────────────────────────────────────────

/**
 * Pre-execution policy gate — check if a proposed agent action is allowed.
 * Fee: $0.005 per check.
 * @param {string} agentId
 * @param {string} proposedAction
 * @param {object} context  - optional: { budget_usd, domain, user_role, data_types[] }
 * @returns { allowed, policy_matched, risk_level, requires_human_approval, reason, alternatives[] }
 */
export function enforcePolicy(agentId, proposedAction, context = {}) {
  if (!agentId)       throw new Error("agentId is required");
  if (!proposedAction) throw new Error("proposedAction is required");

  const policy = getPolicy(agentId);
  const id     = uuid();
  const now    = new Date().toISOString();

  // Defaults when no policy configured
  const maxSpend        = policy?.max_spend_per_action ?? 100;
  const blockedActions  = parsePolicyField(policy?.blocked_actions,  []);
  const requiredApprovals = parsePolicyField(policy?.required_approvals, []);
  const allowedDomains  = parsePolicyField(policy?.allowed_domains, []);

  const actionLower = proposedAction.toLowerCase();
  let allowed       = true;
  let policyMatched = "default_allow";
  let reason        = "Action passes all policy checks.";
  let alternatives  = [];
  let requiresHuman = false;

  // Check blocked actions
  const blockedMatch = blockedActions.find(b => actionLower.includes(b.toLowerCase()));
  if (blockedMatch) {
    allowed       = false;
    policyMatched = `blocked_action:${blockedMatch}`;
    reason        = `Action matches blocked pattern "${blockedMatch}".`;
    alternatives  = [
      "Submit this action for human review via reportViolation()",
      "Request policy amendment via setPolicy()",
      "Use a scoped sub-action that does not match the blocked pattern",
    ];
  }

  // Check spend limit
  if (allowed && context.budget_usd != null && context.budget_usd > maxSpend) {
    allowed       = false;
    policyMatched = "max_spend_exceeded";
    reason        = `Requested spend $${context.budget_usd} exceeds policy limit $${maxSpend}.`;
    alternatives  = [
      `Split into actions under $${maxSpend} each`,
      "Request a budget increase via setPolicy()",
      "Escalate to human approval via HITL",
    ];
  }

  // Check domain allowlist
  if (allowed && context.domain && allowedDomains.length > 0) {
    const domainAllowed = allowedDomains.some(d => context.domain.endsWith(d));
    if (!domainAllowed) {
      allowed       = false;
      policyMatched = "domain_not_allowed";
      reason        = `Domain "${context.domain}" is not in the allowed domains list.`;
      alternatives  = ["Add domain via setPolicy()", "Use an approved domain proxy"];
    }
  }

  // Check required approvals
  const approvalMatch = requiredApprovals.find(a => actionLower.includes(a.toLowerCase()));
  if (allowed && approvalMatch) {
    requiresHuman = true;
    policyMatched = `requires_approval:${approvalMatch}`;
    reason        = `Action "${approvalMatch}" requires explicit human approval before execution.`;
  }

  // Harmful content check on action string
  const harmfulContent = detectHarmfulContent(proposedAction);
  if (allowed && harmfulContent.length > 0) {
    allowed       = false;
    policyMatched = `harmful_content:${harmfulContent[0]}`;
    reason        = `Proposed action contains potentially harmful content: ${harmfulContent.join(", ")}.`;
    alternatives  = ["Rephrase action without flagged content", "Request human review"];
  }

  const riskLevel = computeRiskLevel(blockedMatch, [], harmfulContent, requiresHuman);

  db.prepare(`
    INSERT OR IGNORE INTO guardrail_checks
      (id, agent_id, check_type, action_or_output, context_data,
       allowed, policy_matched, risk_level, requires_human, reason, fee_usd, created_at)
    VALUES
      (@id, @agent_id, @check_type, @action_or_output, @context_data,
       @allowed, @policy_matched, @risk_level, @requires_human, @reason, @fee_usd, @created_at)
  `).run({
    id,
    agent_id:        agentId,
    check_type:      "enforce_policy",
    action_or_output: proposedAction,
    context_data:    JSON.stringify(context),
    allowed:         allowed ? 1 : 0,
    policy_matched:  policyMatched,
    risk_level:      riskLevel,
    requires_human:  requiresHuman ? 1 : 0,
    reason,
    fee_usd:         GUARDRAIL_FEES.enforce_policy,
    created_at:      now,
  });

  recordBilling(agentId, "enforce_policy", GUARDRAIL_FEES.enforce_policy);

  return {
    check_id:               id,
    agent_id:               agentId,
    proposed_action:        proposedAction,
    allowed,
    policy_matched:         policyMatched,
    risk_level:             riskLevel,
    requires_human_approval: requiresHuman,
    reason,
    alternatives,
    fee_usd:                GUARDRAIL_FEES.enforce_policy,
    checked_at:             now,
  };
}

// ─── validateOutput ───────────────────────────────────────────────────────────

/**
 * Validate agent output for safety, PII, hallucinations, and compliance.
 * Fee: $0.01 per validation.
 * @param {string} agentId
 * @param {string} output
 * @param {string} contentType  - text|code|json|html|markdown
 * @param {string} audience     - public|internal|restricted|regulated
 * @returns { safe, issues[], redacted_output, severity, remediation[] }
 */
export function validateOutput(agentId, output, contentType = "text", audience = "public") {
  if (!agentId) throw new Error("agentId is required");
  if (!output)  throw new Error("output is required");

  const validTypes     = ["text", "code", "json", "html", "markdown"];
  const validAudiences = ["public", "internal", "restricted", "regulated"];
  if (!validTypes.includes(contentType))     throw new Error(`contentType must be one of: ${validTypes.join(", ")}`);
  if (!validAudiences.includes(audience))    throw new Error(`audience must be one of: ${validAudiences.join(", ")}`);

  const policy = getPolicy(agentId);
  const piiHandling     = policy?.pii_handling ?? "redact";
  const contentFilters  = parsePolicyField(policy?.content_filters, ["hate_speech", "violence", "adult"]);

  const id  = uuid();
  const now = new Date().toISOString();

  const issues      = [];
  let   safe        = true;
  let   severity    = "info";
  const remediation = [];
  const outputText  = typeof output === "string" ? output : JSON.stringify(output);

  // PII detection
  const piiTypes = detectPii(outputText);
  if (piiTypes.length > 0) {
    issues.push({ type: "pii_exposure", details: `PII types found: ${piiTypes.join(", ")}`, severity: "high" });
    if (audience === "public" || audience === "regulated") {
      safe = false;
      severity = "high";
    }
    remediation.push(piiHandling === "redact" ? "Redact PII before delivery" : "Obtain explicit consent for PII disclosure");
  }

  // Harmful content
  const harmfulContent = detectHarmfulContent(outputText);
  const activeFilters  = harmfulContent.filter(h => contentFilters.includes(h));
  if (activeFilters.length > 0) {
    safe = false;
    severity = "critical";
    issues.push({ type: "harmful_content", details: `Detected: ${activeFilters.join(", ")}`, severity: "critical" });
    remediation.push("Remove or rephrase flagged content segments");
    remediation.push("Route through content moderation queue");
  }

  // Hallucination markers
  const hasHallucination = detectHallucinationMarkers(outputText);
  if (hasHallucination) {
    issues.push({ type: "hallucination_marker", details: "Output contains uncertainty disclaimers that may indicate hallucinated facts", severity: "medium" });
    if (severity === "info") severity = "medium";
    remediation.push("Ground output with verified source citations");
    remediation.push("Add explicit confidence scores to uncertain claims");
  }

  // Off-topic / length drift (heuristic: code in text, or very short for regulated)
  if (audience === "regulated" && outputText.length < 50) {
    issues.push({ type: "insufficient_content", details: "Output too brief for regulated audience — may lack required disclosures", severity: "medium" });
    if (severity === "info") severity = "medium";
    remediation.push("Ensure all required regulatory disclosures are included");
  }

  // Compliance violations for regulated audience
  if (audience === "regulated") {
    const compliancePatterns = [/\bguarantee\b/i, /\bcertain\s+return\b/i, /\bno\s+risk\b/i];
    const complianceViolations = compliancePatterns.filter(re => re.test(outputText));
    if (complianceViolations.length > 0) {
      safe = false;
      if (severity !== "critical") severity = "high";
      issues.push({ type: "compliance_violation", details: "Output contains prohibited claims for regulated content", severity: "high" });
      remediation.push("Replace absolute claims with qualified language");
      remediation.push("Add required regulatory disclaimers");
    }
  }

  // Produce redacted output
  const redactedOutput = (piiHandling === "redact" && piiTypes.length > 0)
    ? redactPii(outputText)
    : outputText;

  db.prepare(`
    INSERT OR IGNORE INTO guardrail_checks
      (id, agent_id, check_type, action_or_output, context_data,
       safe, severity, issues, reason, fee_usd, created_at)
    VALUES
      (@id, @agent_id, @check_type, @action_or_output, @context_data,
       @safe, @severity, @issues, @reason, @fee_usd, @created_at)
  `).run({
    id,
    agent_id:        agentId,
    check_type:      "validate_output",
    action_or_output: outputText.slice(0, 2000),
    context_data:    JSON.stringify({ contentType, audience }),
    safe:            safe ? 1 : 0,
    severity,
    issues:          JSON.stringify(issues),
    reason:          issues.length === 0 ? "Output passed all validation checks." : `${issues.length} issue(s) detected.`,
    fee_usd:         GUARDRAIL_FEES.validate_output,
    created_at:      now,
  });

  recordBilling(agentId, "validate_output", GUARDRAIL_FEES.validate_output);

  return {
    validation_id:   id,
    agent_id:        agentId,
    safe,
    issues,
    redacted_output: redactedOutput,
    severity,
    remediation:     [...new Set(remediation)],
    content_type:    contentType,
    audience,
    pii_found:       piiTypes,
    fee_usd:         GUARDRAIL_FEES.validate_output,
    validated_at:    now,
  };
}

// ─── setPolicy ────────────────────────────────────────────────────────────────

/**
 * Configure guardrail policies for an agent. Free to set.
 * @param {string} agentId
 * @param {object} policies  - { max_spend_per_action, blocked_actions[], required_approvals[],
 *                               pii_handling, content_filters[], allowed_domains[] }
 * @returns { policy_id, active_rules_count }
 */
export function setPolicy(agentId, policies = {}) {
  if (!agentId)  throw new Error("agentId is required");
  if (!policies || typeof policies !== "object") throw new Error("policies must be an object");

  const piiHandlingOptions = ["redact", "block", "allow", "audit_only"];
  if (policies.pii_handling && !piiHandlingOptions.includes(policies.pii_handling)) {
    throw new Error(`pii_handling must be one of: ${piiHandlingOptions.join(", ")}`);
  }

  const existing = getPolicy(agentId);
  const id       = existing?.id ?? uuid();
  const now      = new Date().toISOString();

  // Merge with defaults or existing
  const merged = {
    max_spend_per_action: policies.max_spend_per_action ?? existing?.max_spend_per_action ?? 100,
    blocked_actions:      JSON.stringify(policies.blocked_actions      ?? parsePolicyField(existing?.blocked_actions,  [])),
    required_approvals:   JSON.stringify(policies.required_approvals   ?? parsePolicyField(existing?.required_approvals, [])),
    pii_handling:         policies.pii_handling    ?? existing?.pii_handling    ?? "redact",
    content_filters:      JSON.stringify(policies.content_filters      ?? parsePolicyField(existing?.content_filters,  ["hate_speech", "violence", "adult"])),
    allowed_domains:      JSON.stringify(policies.allowed_domains      ?? parsePolicyField(existing?.allowed_domains,  [])),
  };

  // Count active rules
  const activeRules = [
    parsePolicyField(merged.blocked_actions, []).length,
    parsePolicyField(merged.required_approvals, []).length,
    parsePolicyField(merged.content_filters, []).length,
    parsePolicyField(merged.allowed_domains, []).length > 0 ? 1 : 0,
    merged.max_spend_per_action < 100 ? 1 : 0,
    merged.pii_handling !== "allow" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  db.prepare(`
    INSERT OR IGNORE INTO guardrail_policies
      (id, agent_id, max_spend_per_action, blocked_actions, required_approvals,
       pii_handling, content_filters, allowed_domains, active_rules_count, created_at, updated_at)
    VALUES
      (@id, @agent_id, @max_spend_per_action, @blocked_actions, @required_approvals,
       @pii_handling, @content_filters, @allowed_domains, @active_rules_count, @now, @now)
    ON CONFLICT(agent_id) DO UPDATE SET
      max_spend_per_action = excluded.max_spend_per_action,
      blocked_actions      = excluded.blocked_actions,
      required_approvals   = excluded.required_approvals,
      pii_handling         = excluded.pii_handling,
      content_filters      = excluded.content_filters,
      allowed_domains      = excluded.allowed_domains,
      active_rules_count   = excluded.active_rules_count,
      updated_at           = excluded.updated_at
  `).run({ id, agent_id: agentId, ...merged, active_rules_count: activeRules, now });

  return {
    policy_id:         id,
    agent_id:          agentId,
    active_rules_count: activeRules,
    configuration:     {
      max_spend_per_action: merged.max_spend_per_action,
      blocked_actions:      parsePolicyField(merged.blocked_actions,  []),
      required_approvals:   parsePolicyField(merged.required_approvals, []),
      pii_handling:         merged.pii_handling,
      content_filters:      parsePolicyField(merged.content_filters,  []),
      allowed_domains:      parsePolicyField(merged.allowed_domains,  []),
    },
    fee_usd:    GUARDRAIL_FEES.set_policy,
    updated_at: now,
    message:    `Policy configured with ${activeRules} active rule(s) for agent ${agentId}.`,
  };
}

// ─── getGuardrailDashboard ────────────────────────────────────────────────────

/**
 * Guardrail analytics dashboard for an agent.
 * Fee: $2/month (billed on each call).
 * @param {string} agentId
 * @returns { total_checks, blocked_count, approval_rate, top_violations[], policy_coverage_pct, compliance_score }
 */
export function getGuardrailDashboard(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const now = new Date().toISOString();

  const totalChecks = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_checks WHERE agent_id = ?"
  ).get(agentId)?.n ?? 0;

  const blockedCount = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_checks WHERE agent_id = ? AND (allowed = 0 OR safe = 0)"
  ).get(agentId)?.n ?? 0;

  const requiresApproval = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_checks WHERE agent_id = ? AND requires_human = 1"
  ).get(agentId)?.n ?? 0;

  const approvalRate = totalChecks > 0 ? Math.round((requiresApproval / totalChecks) * 100) : 0;

  // Top violations from checks
  const violations = db.prepare(`
    SELECT policy_matched, COUNT(*) as count
    FROM guardrail_checks
    WHERE agent_id = ? AND (allowed = 0 OR safe = 0) AND policy_matched IS NOT NULL
    GROUP BY policy_matched
    ORDER BY count DESC
    LIMIT 5
  `).all(agentId);

  const reportedViolations = db.prepare(`
    SELECT violation_type, COUNT(*) as count
    FROM guardrail_violations
    WHERE agent_id = ?
    GROUP BY violation_type
    ORDER BY count DESC
    LIMIT 5
  `).all(agentId);

  const topViolations = [
    ...violations.map(v => ({ type: v.policy_matched, count: v.count, source: "automated_check" })),
    ...reportedViolations.map(v => ({ type: v.violation_type, count: v.count, source: "reported" })),
  ].sort((a, b) => b.count - a.count).slice(0, 5);

  const policy = getPolicy(agentId);
  const policyCoverage = policy
    ? Math.min(100, Math.round((policy.active_rules_count / 10) * 100))
    : 0;

  // Compliance score: weighted formula
  const blockRate    = totalChecks > 0 ? blockedCount / totalChecks : 0;
  const complianceScore = Math.max(0, Math.min(100, Math.round(
    100 - (blockRate * 60) - (policyCoverage < 40 ? 20 : 0) - (topViolations.length > 3 ? 10 : 0)
  )));

  recordBilling(agentId, "guardrail_dashboard", GUARDRAIL_FEES.dashboard);

  return {
    agent_id:            agentId,
    total_checks:        totalChecks,
    blocked_count:       blockedCount,
    pass_count:          totalChecks - blockedCount,
    approval_rate:       approvalRate,
    top_violations:      topViolations,
    policy_coverage_pct: policyCoverage,
    compliance_score:    complianceScore,
    compliance_grade:    complianceScore >= 90 ? "A" : complianceScore >= 75 ? "B" : complianceScore >= 60 ? "C" : "D",
    has_active_policy:   !!policy,
    fee_usd:             GUARDRAIL_FEES.dashboard,
    generated_at:        now,
  };
}

// ─── reportViolation ─────────────────────────────────────────────────────────

/**
 * Log a policy violation. Free — safety incentive.
 * @param {string} agentId
 * @param {string} action
 * @param {string} violation_type  - policy_breach|data_leak|unauthorized_access|harmful_output|off_policy_spend|other
 * @param {string} severity        - info|low|medium|high|critical
 * @returns { violation_id, investigation_status, impact_assessment }
 */
export function reportViolation(agentId, action, violation_type, severity = "medium") {
  if (!agentId)        throw new Error("agentId is required");
  if (!action)         throw new Error("action is required");
  if (!violation_type) throw new Error("violation_type is required");

  const validTypes = ["policy_breach", "data_leak", "unauthorized_access", "harmful_output", "off_policy_spend", "other"];
  const validSeverities = ["info", "low", "medium", "high", "critical"];
  if (!validTypes.includes(violation_type))   throw new Error(`violation_type must be one of: ${validTypes.join(", ")}`);
  if (!validSeverities.includes(severity))    throw new Error(`severity must be one of: ${validSeverities.join(", ")}`);

  const id  = uuid();
  const now = new Date().toISOString();

  const impactMap = {
    info:     "Informational — no immediate action required.",
    low:      "Minor policy deviation. Logged for audit trail. Review within 30 days.",
    medium:   "Moderate violation. Recommended review within 7 days. May require policy update.",
    high:     "Significant violation. Requires review within 24 hours. Consider temporary suspension.",
    critical: "Critical violation. Immediate review required. Agent may be suspended pending investigation.",
  };

  const statusMap = {
    info:     "acknowledged",
    low:      "open",
    medium:   "open",
    high:     "escalated",
    critical: "escalated",
  };

  const impactAssessment = impactMap[severity];
  const investigationStatus = statusMap[severity];

  db.prepare(`
    INSERT OR IGNORE INTO guardrail_violations
      (id, agent_id, action, violation_type, severity, investigation_status, impact_assessment, created_at)
    VALUES
      (@id, @agent_id, @action, @violation_type, @severity, @investigation_status, @impact_assessment, @created_at)
  `).run({
    id,
    agent_id:             agentId,
    action,
    violation_type,
    severity,
    investigation_status: investigationStatus,
    impact_assessment:    impactAssessment,
    created_at:           now,
  });

  return {
    violation_id:          id,
    agent_id:              agentId,
    action,
    violation_type,
    severity,
    investigation_status:  investigationStatus,
    impact_assessment:     impactAssessment,
    sla_response_hours:    severity === "critical" ? 1 : severity === "high" ? 24 : severity === "medium" ? 168 : 720,
    fee_usd:               GUARDRAIL_FEES.report_violation,
    reported_at:           now,
    message:               `Violation logged. Status: ${investigationStatus}. ${impactAssessment}`,
  };
}

// ─── getComplianceReport ──────────────────────────────────────────────────────

/**
 * Generate a compliance report for a given framework.
 * Fee: $5 per report.
 * @param {string} agentId
 * @param {string} framework  - SB243|AB489|GDPR|HIPAA|SOC2|ISO27001|NIST
 * @returns { report: { sections[], score, gaps[], recommendations[], audit_ready } }
 */
export function getComplianceReport(agentId, framework = "SB243") {
  if (!agentId)  throw new Error("agentId is required");
  if (!FRAMEWORKS.includes(framework)) {
    throw new Error(`framework must be one of: ${FRAMEWORKS.join(", ")}`);
  }

  const now    = uuid();
  const id     = uuid();
  const ts     = new Date().toISOString();
  const policy = getPolicy(agentId);

  const totalChecks = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_checks WHERE agent_id = ?"
  ).get(agentId)?.n ?? 0;

  const blockedCount = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_checks WHERE agent_id = ? AND (allowed = 0 OR safe = 0)"
  ).get(agentId)?.n ?? 0;

  const violations = db.prepare(
    "SELECT COUNT(*) as n FROM guardrail_violations WHERE agent_id = ? AND severity IN ('high','critical')"
  ).get(agentId)?.n ?? 0;

  const frameworkSections = {
    SB243: [
      { title: "Automated Decision Transparency",       requirement: "Agents must disclose when decisions are automated", status: policy ? "pass" : "fail", weight: 20 },
      { title: "High-Risk Action Pre-Approval",         requirement: "High-risk actions require human pre-approval",      status: policy?.required_approvals !== "[]" ? "pass" : "warn", weight: 25 },
      { title: "Audit Trail Maintenance",               requirement: "All agent actions must be logged",                  status: totalChecks > 0 ? "pass" : "fail", weight: 20 },
      { title: "PII Protection Mechanisms",             requirement: "PII must be detected and protected",                status: policy?.pii_handling && policy.pii_handling !== "allow" ? "pass" : "warn", weight: 20 },
      { title: "Violation Reporting Capability",        requirement: "Violations must be reportable and tracked",         status: "pass", weight: 15 },
    ],
    AB489: [
      { title: "Content Safety Filtering",              requirement: "Harmful content must be filtered before output",    status: policy?.content_filters !== "[]" ? "pass" : "fail", weight: 30 },
      { title: "Spend Controls",                        requirement: "Agents must have spending limits enforced",         status: policy?.max_spend_per_action ? "pass" : "warn", weight: 20 },
      { title: "Domain Restrictions",                   requirement: "Agent domains must be allowlisted",                 status: parsePolicyField(policy?.allowed_domains, []).length > 0 ? "pass" : "warn", weight: 15 },
      { title: "Incident Response Plan",                requirement: "High-severity violations require escalation paths", status: violations === 0 ? "pass" : "warn", weight: 20 },
      { title: "Regular Policy Review",                 requirement: "Policies must be reviewed and updated",             status: policy ? "pass" : "fail", weight: 15 },
    ],
    GDPR: [
      { title: "Data Minimisation",                     requirement: "Only necessary personal data processed",            status: policy?.pii_handling !== "allow" ? "pass" : "fail", weight: 25 },
      { title: "Right to Erasure Support",              requirement: "Mechanisms to delete personal data on request",     status: "warn", weight: 20 },
      { title: "Consent & Lawful Basis",                requirement: "Lawful basis documented for data processing",       status: policy ? "warn" : "fail", weight: 25 },
      { title: "Data Breach Notification",              requirement: "Breaches reported within 72 hours",                 status: violations === 0 ? "pass" : "warn", weight: 15 },
      { title: "Privacy by Design",                     requirement: "Privacy controls built into agent architecture",    status: policy?.pii_handling === "redact" ? "pass" : "warn", weight: 15 },
    ],
    HIPAA: [
      { title: "PHI Access Controls",                   requirement: "Protected health information must be access-controlled", status: policy ? "warn" : "fail", weight: 30 },
      { title: "Audit Controls",                        requirement: "Hardware, software, and procedural mechanisms for examination", status: totalChecks > 0 ? "pass" : "fail", weight: 25 },
      { title: "Transmission Security",                 requirement: "PHI transmission must be encrypted",                status: "warn", weight: 20 },
      { title: "Minimum Necessary Standard",            requirement: "Only minimum necessary PHI disclosed",              status: policy?.pii_handling === "redact" ? "pass" : "fail", weight: 25 },
    ],
    SOC2: [
      { title: "Security — Logical Access",             requirement: "Access controls and authentication enforced",        status: policy ? "pass" : "warn", weight: 20 },
      { title: "Availability — Monitoring",             requirement: "System monitored for availability",                 status: "warn", weight: 20 },
      { title: "Processing Integrity",                  requirement: "System processing complete, valid, accurate",       status: blockedCount < totalChecks * 0.1 ? "pass" : "warn", weight: 20 },
      { title: "Confidentiality — Data Controls",       requirement: "Confidential data protected per commitments",       status: policy?.pii_handling !== "allow" ? "pass" : "fail", weight: 20 },
      { title: "Privacy — PII Handling",                requirement: "Personal information collected and used per policy", status: policy ? "pass" : "fail", weight: 20 },
    ],
    ISO27001: [
      { title: "A.8 Asset Management",                  requirement: "Information assets inventoried and classified",     status: "warn", weight: 20 },
      { title: "A.9 Access Control",                    requirement: "Access restricted per business and security needs", status: policy ? "pass" : "warn", weight: 25 },
      { title: "A.12 Operations Security",              requirement: "Operating procedures documented and implemented",   status: totalChecks > 0 ? "pass" : "warn", weight: 20 },
      { title: "A.16 Incident Management",              requirement: "Consistent incident reporting and response",        status: "pass", weight: 20 },
      { title: "A.18 Compliance",                       requirement: "Compliance with legal and contractual requirements", status: policy ? "pass" : "warn", weight: 15 },
    ],
    NIST: [
      { title: "Identify — Asset Management",           requirement: "Agent assets catalogued and risk-assessed",        status: "warn", weight: 20 },
      { title: "Protect — Access Control",              requirement: "Access to assets managed per risk",                status: policy ? "pass" : "warn", weight: 20 },
      { title: "Detect — Anomalies & Events",           requirement: "Anomalous activity detected and analyzed",         status: totalChecks > 0 ? "pass" : "warn", weight: 20 },
      { title: "Respond — Response Planning",           requirement: "Response processes executed during incidents",      status: "pass", weight: 20 },
      { title: "Recover — Recovery Planning",           requirement: "Recovery processes maintained to restore capabilities", status: "warn", weight: 20 },
    ],
  };

  const sections = frameworkSections[framework] ?? frameworkSections.SB243;

  // Compute weighted score
  const score = Math.round(
    sections.reduce((acc, s) => {
      const pts = s.status === "pass" ? s.weight : s.status === "warn" ? s.weight * 0.5 : 0;
      return acc + pts;
    }, 0)
  );

  const gaps = sections
    .filter(s => s.status !== "pass")
    .map(s => ({ section: s.title, status: s.status, requirement: s.requirement }));

  const recommendations = [
    ...(!policy ? ["Configure guardrail policies via setPolicy() to establish baseline controls"] : []),
    ...(parsePolicyField(policy?.required_approvals, []).length === 0 ? ["Define required_approvals for high-risk actions"] : []),
    ...(policy?.pii_handling === "allow" ? ["Enable PII redaction: set pii_handling to 'redact'"] : []),
    ...(violations > 0 ? [`Resolve ${violations} open high/critical violation(s) to improve audit readiness`] : []),
    ...(totalChecks === 0 ? ["Begin using enforcePolicy() and validateOutput() to build audit evidence"] : []),
    "Schedule quarterly policy reviews aligned with regulatory updates",
    `Run enforcePolicy() checks before all ${framework}-regulated actions`,
  ].slice(0, 6);

  const auditReady = score >= 75 && violations === 0 && !!policy;

  db.prepare(`
    INSERT OR IGNORE INTO guardrail_reports
      (id, agent_id, framework, score, sections, gaps, recommendations, audit_ready, fee_usd, created_at)
    VALUES
      (@id, @agent_id, @framework, @score, @sections, @gaps, @recommendations, @audit_ready, @fee_usd, @created_at)
  `).run({
    id,
    agent_id:        agentId,
    framework,
    score,
    sections:        JSON.stringify(sections),
    gaps:            JSON.stringify(gaps),
    recommendations: JSON.stringify(recommendations),
    audit_ready:     auditReady ? 1 : 0,
    fee_usd:         GUARDRAIL_FEES.compliance_report,
    created_at:      ts,
  });

  recordBilling(agentId, "compliance_report", GUARDRAIL_FEES.compliance_report);

  return {
    report_id:  id,
    agent_id:   agentId,
    framework,
    report: {
      sections,
      score,
      grade:           score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F",
      gaps,
      recommendations,
      audit_ready:     auditReady,
      total_checks_on_record: totalChecks,
      open_violations:        violations,
    },
    fee_usd:     GUARDRAIL_FEES.compliance_report,
    generated_at: ts,
  };
}
