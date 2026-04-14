import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────
// Migration-safe: if audit_log exists with incompatible schema, recreate it.

try {
  // Check if existing audit_log has tenant_id column
  const hasCorrectSchema = (() => {
    try {
      db.prepare("SELECT tenant_id FROM audit_log LIMIT 0").run();
      return true;
    } catch { return false; }
  })();

  if (!hasCorrectSchema) {
    // Drop old incompatible table (from simple request_log migration)
    db.exec("DROP TABLE IF EXISTS audit_log");
  }
} catch { /* table doesn't exist yet — fine */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT,
    agent_id      TEXT NOT NULL,
    action        TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN (
                    'transaction','escrow','service','data','memory','compute',
                    'compliance','config','agent','key','workflow')),
    resource_id   TEXT,
    details       TEXT,
    ip_address    TEXT,
    sensitivity   TEXT DEFAULT 'normal' CHECK(sensitivity IN ('normal','sensitive','critical','classified')),
    outcome       TEXT DEFAULT 'success' CHECK(outcome IN ('success','failure','denied','error')),
    risk_score    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_policies (
    id               TEXT PRIMARY KEY,
    tenant_id        TEXT,
    name             TEXT NOT NULL,
    resource_type    TEXT NOT NULL,
    action_pattern   TEXT DEFAULT '*',
    retention_days   INTEGER DEFAULT 365,
    alert_on         TEXT DEFAULT '["failure","denied"]',
    require_mfa      INTEGER DEFAULT 0,
    require_approval TEXT,
    max_amount_usd   REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_exports (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    format       TEXT DEFAULT 'json' CHECK(format IN ('json','csv','siem')),
    date_from    TEXT,
    date_to      TEXT,
    record_count INTEGER,
    status       TEXT DEFAULT 'pending' CHECK(status IN ('pending','generating','ready','expired')),
    download_url TEXT,
    requested_by TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS governance_approvals (
    id                   TEXT PRIMARY KEY,
    tenant_id            TEXT,
    requesting_agent_id  TEXT NOT NULL,
    approving_agent_id   TEXT,
    action               TEXT NOT NULL,
    resource_type        TEXT,
    resource_id          TEXT,
    amount_usd           REAL,
    status               TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','expired')),
    reason               TEXT,
    expires_at           TEXT,
    created_at           TEXT DEFAULT (datetime('now')),
    resolved_at          TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_tenant   ON audit_log(tenant_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_agent    ON audit_log(agent_id);
  CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
`);

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

/**
 * Calculate a risk score (0–100) based on sensitivity, action type, and outcome.
 */
function calculateRiskScore({ sensitivity, action, outcome }) {
  let score = 0;

  // Sensitivity weight
  const sensitivityWeights = { normal: 0, sensitive: 20, critical: 40, classified: 60 };
  score += sensitivityWeights[sensitivity] ?? 0;

  // Action risk keywords
  const highRiskActions = ["delete","destroy","revoke","export","transfer","withdraw","override","bypass","escalate"];
  const medRiskActions  = ["update","modify","create","approve","deny","execute","deploy"];
  const lowerAction = (action || "").toLowerCase();
  if (highRiskActions.some(w => lowerAction.includes(w))) score += 25;
  else if (medRiskActions.some(w => lowerAction.includes(w))) score += 10;

  // Outcome risk
  const outcomeWeights = { success: 0, failure: 10, denied: 20, error: 15 };
  score += outcomeWeights[outcome] ?? 0;

  return Math.min(score, 100);
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

/**
 * Log an action immutably. Auto-calculates risk score and checks policies.
 */
export function logAction({
  tenant_id,
  agent_id,
  action,
  resource_type,
  resource_id,
  details,
  sensitivity = "normal",
  ip_address,
  outcome = "success",
}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!action)   throw new Error("action is required");
  if (!resource_type) throw new Error("resource_type is required");

  const risk_score = calculateRiskScore({ sensitivity, action, outcome });
  const log_id = uuid();

  db.prepare(`
    INSERT INTO audit_log
      (id, tenant_id, agent_id, action, resource_type, resource_id,
       details, ip_address, sensitivity, outcome, risk_score)
    VALUES
      (@id, @tenant_id, @agent_id, @action, @resource_type, @resource_id,
       @details, @ip_address, @sensitivity, @outcome, @risk_score)
  `).run({
    id: log_id,
    tenant_id: tenant_id ?? null,
    agent_id,
    action,
    resource_type,
    resource_id: resource_id ?? null,
    details: details ? (typeof details === "object" ? JSON.stringify(details) : details) : null,
    ip_address: ip_address ?? null,
    sensitivity,
    outcome,
    risk_score,
  });

  // Check policies for this tenant
  const alerts = _checkPolicies({ tenant_id, action, resource_type, outcome });

  return {
    log_id,
    risk_score,
    sensitivity,
    outcome,
    alerts_triggered: alerts.length,
    alerts,
  };
}

/**
 * Internal: check audit policies and return any triggered alerts.
 */
function _checkPolicies({ tenant_id, action, resource_type, outcome }) {
  const policies = db.prepare(`
    SELECT * FROM audit_policies
    WHERE (tenant_id = ? OR tenant_id IS NULL)
      AND resource_type = ?
  `).all(tenant_id ?? null, resource_type);

  const triggered = [];

  for (const policy of policies) {
    const alertOn = JSON.parse(policy.alert_on || "[]");
    const actionPattern = policy.action_pattern || "*";

    // Match action pattern (* = all, or substring match)
    const actionMatches = actionPattern === "*" || action.includes(actionPattern);
    const outcomeAlerts = alertOn.includes(outcome);

    if (actionMatches && outcomeAlerts) {
      triggered.push({
        policy_id: policy.id,
        policy_name: policy.name,
        outcome,
        action,
        resource_type,
      });
    }
  }

  return triggered;
}

// ─── Query Audit Log ──────────────────────────────────────────────────────────

/**
 * Search the audit log with filters.
 */
export function queryAuditLog({
  tenant_id,
  agent_id,
  resource_type,
  action,
  sensitivity,
  date_from,
  date_to,
  limit = 100,
} = {}) {
  const conditions = [];
  const params = {};

  if (tenant_id)     { conditions.push("tenant_id = @tenant_id");         params.tenant_id = tenant_id; }
  if (agent_id)      { conditions.push("agent_id = @agent_id");           params.agent_id = agent_id; }
  if (resource_type) { conditions.push("resource_type = @resource_type"); params.resource_type = resource_type; }
  if (action)        { conditions.push("action LIKE @action");            params.action = `%${action}%`; }
  if (sensitivity)   { conditions.push("sensitivity = @sensitivity");     params.sensitivity = sensitivity; }
  if (date_from)     { conditions.push("created_at >= @date_from");       params.date_from = date_from; }
  if (date_to)       { conditions.push("created_at <= @date_to");         params.date_to = date_to; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const safeLimit = Math.min(Number(limit) || 100, 1000);

  const rows = db.prepare(`
    SELECT * FROM audit_log ${where}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `).all(params);

  rows.forEach(r => {
    if (r.details) {
      try { r.details = JSON.parse(r.details); } catch { /* keep as string */ }
    }
  });

  return { count: rows.length, entries: rows };
}

// ─── Audit Policies ───────────────────────────────────────────────────────────

/**
 * Create an audit/governance policy.
 */
export function createPolicy({
  tenant_id,
  name,
  resource_type,
  action_pattern = "*",
  retention_days = 365,
  alert_on = ["failure", "denied"],
  require_mfa = false,
  require_approval,
  max_amount_usd,
}) {
  if (!name)          throw new Error("name is required");
  if (!resource_type) throw new Error("resource_type is required");

  const policy_id = uuid();

  db.prepare(`
    INSERT INTO audit_policies
      (id, tenant_id, name, resource_type, action_pattern, retention_days,
       alert_on, require_mfa, require_approval, max_amount_usd)
    VALUES
      (@id, @tenant_id, @name, @resource_type, @action_pattern, @retention_days,
       @alert_on, @require_mfa, @require_approval, @max_amount_usd)
  `).run({
    id: policy_id,
    tenant_id: tenant_id ?? null,
    name,
    resource_type,
    action_pattern,
    retention_days,
    alert_on: JSON.stringify(Array.isArray(alert_on) ? alert_on : [alert_on]),
    require_mfa: require_mfa ? 1 : 0,
    require_approval: require_approval ?? null,
    max_amount_usd: max_amount_usd ?? null,
  });

  return db.prepare("SELECT * FROM audit_policies WHERE id = ?").get(policy_id);
}

/**
 * List all policies for a tenant (plus global policies).
 */
export function getPolicies(tenant_id) {
  const policies = db.prepare(`
    SELECT * FROM audit_policies
    WHERE tenant_id = ? OR tenant_id IS NULL
    ORDER BY created_at DESC
  `).all(tenant_id ?? null);

  policies.forEach(p => {
    p.alert_on = JSON.parse(p.alert_on || "[]");
  });

  return { tenant_id, policies, count: policies.length };
}

// ─── Governance Approvals ─────────────────────────────────────────────────────

/**
 * Request governance approval for a sensitive action.
 */
export function requestApproval({
  tenant_id,
  requesting_agent_id,
  action,
  resource_type,
  resource_id,
  amount_usd,
}) {
  if (!requesting_agent_id) throw new Error("requesting_agent_id is required");
  if (!action)               throw new Error("action is required");

  // Default expiry: 24 hours
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const approval_id = uuid();

  db.prepare(`
    INSERT INTO governance_approvals
      (id, tenant_id, requesting_agent_id, action, resource_type, resource_id, amount_usd, expires_at)
    VALUES
      (@id, @tenant_id, @requesting_agent_id, @action, @resource_type, @resource_id, @amount_usd, @expires_at)
  `).run({
    id: approval_id,
    tenant_id: tenant_id ?? null,
    requesting_agent_id,
    action,
    resource_type: resource_type ?? null,
    resource_id: resource_id ?? null,
    amount_usd: amount_usd ?? null,
    expires_at,
  });

  // Log the request itself
  logAction({
    tenant_id,
    agent_id: requesting_agent_id,
    action: "request_approval",
    resource_type: resource_type ?? "compliance",
    resource_id: approval_id,
    details: { action, amount_usd },
    sensitivity: amount_usd && amount_usd > 10_000 ? "critical" : "sensitive",
    outcome: "success",
  });

  return db.prepare("SELECT * FROM governance_approvals WHERE id = ?").get(approval_id);
}

/**
 * Approve a pending governance request.
 */
export function approveRequest({ approval_id, approving_agent_id, reason }) {
  const approval = db.prepare("SELECT * FROM governance_approvals WHERE id = ?").get(approval_id);
  if (!approval) throw new Error(`Approval not found: ${approval_id}`);
  if (approval.status !== "pending") throw new Error(`Approval is already ${approval.status}`);
  if (!approving_agent_id) throw new Error("approving_agent_id is required");

  const now = new Date().toISOString();

  // Check expiry
  if (approval.expires_at && now > approval.expires_at) {
    db.prepare("UPDATE governance_approvals SET status = 'expired' WHERE id = ?").run(approval_id);
    throw new Error("Approval request has expired");
  }

  db.prepare(`
    UPDATE governance_approvals
    SET status = 'approved', approving_agent_id = @approving_agent_id,
        reason = @reason, resolved_at = @now
    WHERE id = @id
  `).run({ id: approval_id, approving_agent_id, reason: reason ?? null, now });

  logAction({
    tenant_id: approval.tenant_id,
    agent_id: approving_agent_id,
    action: "approve_request",
    resource_type: approval.resource_type ?? "compliance",
    resource_id: approval_id,
    details: { reason, approved_action: approval.action },
    sensitivity: "sensitive",
    outcome: "success",
  });

  return db.prepare("SELECT * FROM governance_approvals WHERE id = ?").get(approval_id);
}

/**
 * Deny a pending governance request.
 */
export function denyRequest({ approval_id, approving_agent_id, reason }) {
  const approval = db.prepare("SELECT * FROM governance_approvals WHERE id = ?").get(approval_id);
  if (!approval) throw new Error(`Approval not found: ${approval_id}`);
  if (approval.status !== "pending") throw new Error(`Approval is already ${approval.status}`);
  if (!approving_agent_id) throw new Error("approving_agent_id is required");

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE governance_approvals
    SET status = 'denied', approving_agent_id = @approving_agent_id,
        reason = @reason, resolved_at = @now
    WHERE id = @id
  `).run({ id: approval_id, approving_agent_id, reason: reason ?? null, now });

  logAction({
    tenant_id: approval.tenant_id,
    agent_id: approving_agent_id,
    action: "deny_request",
    resource_type: approval.resource_type ?? "compliance",
    resource_id: approval_id,
    details: { reason, denied_action: approval.action },
    sensitivity: "sensitive",
    outcome: "denied",
  });

  return db.prepare("SELECT * FROM governance_approvals WHERE id = ?").get(approval_id);
}

// ─── Audit Export ─────────────────────────────────────────────────────────────

/**
 * Initiate an audit log export.
 */
export function exportAuditLog({ tenant_id, format = "json", date_from, date_to, requested_by }) {
  if (!tenant_id) throw new Error("tenant_id is required");

  const export_id = uuid();

  // Count records that would be exported
  const conditions = ["tenant_id = @tenant_id"];
  const params = { tenant_id };
  if (date_from) { conditions.push("created_at >= @date_from"); params.date_from = date_from; }
  if (date_to)   { conditions.push("created_at <= @date_to");   params.date_to = date_to; }

  const record_count = db.prepare(
    `SELECT COUNT(*) as n FROM audit_log WHERE ${conditions.join(" AND ")}`
  ).get(params).n;

  // Simulate async export generation — in production this would queue a job
  const download_url = `/api/audit/exports/${export_id}/download`;

  db.prepare(`
    INSERT INTO audit_exports
      (id, tenant_id, format, date_from, date_to, record_count, status, download_url, requested_by)
    VALUES
      (@id, @tenant_id, @format, @date_from, @date_to, @record_count, 'generating', @download_url, @requested_by)
  `).run({
    id: export_id,
    tenant_id,
    format,
    date_from: date_from ?? null,
    date_to: date_to ?? null,
    record_count,
    download_url,
    requested_by: requested_by ?? null,
  });

  // For this implementation, mark immediately ready (in prod: async job)
  db.prepare("UPDATE audit_exports SET status = 'ready' WHERE id = ?").run(export_id);

  logAction({
    tenant_id,
    agent_id: requested_by ?? "system",
    action: "export_audit_log",
    resource_type: "compliance",
    resource_id: export_id,
    details: { format, date_from, date_to, record_count },
    sensitivity: "sensitive",
    outcome: "success",
  });

  return db.prepare("SELECT * FROM audit_exports WHERE id = ?").get(export_id);
}

// ─── Audit Stats ──────────────────────────────────────────────────────────────

/**
 * Get audit statistics for a tenant.
 */
export function getAuditStats({ tenant_id } = {}) {
  const where = tenant_id ? "WHERE tenant_id = ?" : "";
  const args = tenant_id ? [tenant_id] : [];

  const total_events = db.prepare(
    `SELECT COUNT(*) as n FROM audit_log ${where}`
  ).get(...args).n;

  const by_sensitivity = db.prepare(`
    SELECT sensitivity, COUNT(*) as count
    FROM audit_log ${where}
    GROUP BY sensitivity
    ORDER BY count DESC
  `).all(...args);

  const by_outcome = db.prepare(`
    SELECT outcome, COUNT(*) as count
    FROM audit_log ${where}
    GROUP BY outcome
    ORDER BY count DESC
  `).all(...args);

  const by_resource = db.prepare(`
    SELECT resource_type, COUNT(*) as count
    FROM audit_log ${where}
    GROUP BY resource_type
    ORDER BY count DESC
  `).all(...args);

  const high_risk_events = db.prepare(`
    SELECT COUNT(*) as n FROM audit_log
    ${where ? where + " AND" : "WHERE"} risk_score >= 60
  `).get(...args).n;

  // Policy violations = denied + failure outcomes
  const policy_violations = db.prepare(`
    SELECT COUNT(*) as n FROM audit_log
    ${where ? where + " AND" : "WHERE"} outcome IN ('denied','failure')
  `).get(...args).n;

  const pending_approvals = db.prepare(`
    SELECT COUNT(*) as n FROM governance_approvals
    ${tenant_id ? "WHERE tenant_id = ?" : "WHERE 1=1"} AND status = 'pending'
  `).get(...(tenant_id ? [tenant_id] : [])).n;

  const avg_risk_score = db.prepare(`
    SELECT ROUND(AVG(risk_score), 1) as avg FROM audit_log ${where}
  `).get(...args).avg ?? 0;

  return {
    tenant_id: tenant_id ?? "platform",
    total_events,
    high_risk_events,
    policy_violations,
    pending_approvals,
    avg_risk_score,
    by_sensitivity,
    by_outcome,
    by_resource_type: by_resource,
  };
}
