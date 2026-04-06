import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const HEALTH_COMMISSION = 0.15;              // 15% on endpoint monitoring fees
const ENDPOINT_MONTHLY_FEE = 0.50;          // $0.50/month per monitored endpoint
const HEALTH_CHECK_FEE = 0.005;             // $0.005 per instant health check
const CIRCUIT_CHECK_FEE = 0.005;            // $0.005 per circuit status check
const DASHBOARD_MONTHLY_FEE = 5.00;         // $5/month per health dashboard

// Circuit breaker thresholds
const CIRCUIT_OPEN_THRESHOLD   = 0.5;       // >50% failure rate → open circuit
const CIRCUIT_HALFOPEN_THRESHOLD = 0.25;    // >25% failure rate → half-open
const CIRCUIT_WINDOW_MINUTES   = 10;        // Rolling window for failure rate calc

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS health_endpoints (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    endpoint_url        TEXT NOT NULL,
    check_interval_sec  INTEGER DEFAULT 60,
    monthly_fee_usd     REAL DEFAULT 0.50,
    commission_usd      REAL DEFAULT 0.075,
    status              TEXT DEFAULT 'healthy' CHECK(status IN ('healthy','degraded','unhealthy','unreachable')),
    last_latency_ms     INTEGER,
    last_check_at       TEXT,
    last_success_at     TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    total_checks        INTEGER DEFAULT 0,
    total_failures      INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS health_check_log (
    id              TEXT PRIMARY KEY,
    endpoint_url    TEXT NOT NULL,
    status          TEXT NOT NULL,
    latency_ms      INTEGER,
    error_details   TEXT,
    checked_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS circuit_breakers (
    id                  TEXT PRIMARY KEY,
    target_agent_id     TEXT NOT NULL UNIQUE,
    state               TEXT DEFAULT 'closed' CHECK(state IN ('closed','half-open','open')),
    failure_count       INTEGER DEFAULT 0,
    success_count       INTEGER DEFAULT 0,
    total_requests      INTEGER DEFAULT 0,
    last_state_change   TEXT DEFAULT (datetime('now')),
    tripped_reason      TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS health_incidents (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    endpoint_url    TEXT NOT NULL,
    severity        TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    title           TEXT NOT NULL,
    root_cause      TEXT,
    status          TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved')),
    opened_at       TEXT DEFAULT (datetime('now')),
    resolved_at     TEXT,
    duration_minutes INTEGER
  );

  CREATE TABLE IF NOT EXISTS health_dashboards (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL UNIQUE,
    monthly_fee_usd REAL DEFAULT 5.00,
    commission_usd  REAL DEFAULT 0.75,
    registered_at   TEXT DEFAULT (datetime('now')),
    last_accessed   TEXT
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _epCount = db.prepare("SELECT COUNT(*) as n FROM health_endpoints").get().n;
if (_epCount === 0) {
  const seedEndpoints = [
    { id: uuid(), agent_id: "agent_d4f3a1b2", endpoint_url: "https://agent.acme.io/health",        check_interval_sec: 60,  status: "healthy",    last_latency_ms: 84,   consecutive_failures: 0, total_checks: 4320, total_failures: 12 },
    { id: uuid(), agent_id: "agent_d4f3a1b2", endpoint_url: "https://agent.acme.io/api/v1/ready",  check_interval_sec: 30,  status: "healthy",    last_latency_ms: 91,   consecutive_failures: 0, total_checks: 8640, total_failures: 28 },
    { id: uuid(), agent_id: "agent_7c2e9f05", endpoint_url: "https://parser-bot.internal/ping",    check_interval_sec: 120, status: "degraded",   last_latency_ms: 1842, consecutive_failures: 3, total_checks: 2160, total_failures: 189 },
    { id: uuid(), agent_id: "agent_aa91c830", endpoint_url: "https://summarizer.hiveagent.io/hc",  check_interval_sec: 60,  status: "healthy",    last_latency_ms: 112,  consecutive_failures: 0, total_checks: 4320, total_failures: 6 },
    { id: uuid(), agent_id: "agent_bb02d741", endpoint_url: "https://classifier.ml-ops.net/live",  check_interval_sec: 60,  status: "unhealthy",  last_latency_ms: 8001, consecutive_failures: 18, total_checks: 4320, total_failures: 430 },
    { id: uuid(), agent_id: "agent_cc13e852", endpoint_url: "https://embeddings.vector.ai/ready",  check_interval_sec: 60,  status: "healthy",    last_latency_ms: 53,   consecutive_failures: 0, total_checks: 4320, total_failures: 4 },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO health_endpoints
      (id, agent_id, endpoint_url, check_interval_sec, status, last_latency_ms,
       consecutive_failures, total_checks, total_failures, last_check_at, last_success_at)
    VALUES
      (@id, @agent_id, @endpoint_url, @check_interval_sec, @status, @last_latency_ms,
       @consecutive_failures, @total_checks, @total_failures, datetime('now'), datetime('now','-2 minutes'))
  `);
  for (const e of seedEndpoints) ins.run(e);
}

const _cbCount = db.prepare("SELECT COUNT(*) as n FROM circuit_breakers").get().n;
if (_cbCount === 0) {
  const seedCircuits = [
    { id: uuid(), target_agent_id: "agent_d4f3a1b2", state: "closed",    failure_count: 12,  success_count: 4308, total_requests: 4320, tripped_reason: null },
    { id: uuid(), target_agent_id: "agent_7c2e9f05", state: "half-open", failure_count: 189, success_count: 1971, total_requests: 2160, tripped_reason: "High latency p99 > 3000ms detected over 15-minute window" },
    { id: uuid(), target_agent_id: "agent_aa91c830", state: "closed",    failure_count: 6,   success_count: 4314, total_requests: 4320, tripped_reason: null },
    { id: uuid(), target_agent_id: "agent_bb02d741", state: "open",      failure_count: 430, success_count: 3890, total_requests: 4320, tripped_reason: "Consecutive timeout failures exceeded threshold (18 in a row)" },
    { id: uuid(), target_agent_id: "agent_cc13e852", state: "closed",    failure_count: 4,   success_count: 4316, total_requests: 4320, tripped_reason: null },
  ];
  const insCb = db.prepare(`
    INSERT OR IGNORE INTO circuit_breakers
      (id, target_agent_id, state, failure_count, success_count, total_requests, tripped_reason, last_state_change)
    VALUES
      (@id, @target_agent_id, @state, @failure_count, @success_count, @total_requests, @tripped_reason, datetime('now','-'||(abs(random())%120)||' minutes'))
  `);
  for (const c of seedCircuits) insCb.run(c);
}

const _incCount = db.prepare("SELECT COUNT(*) as n FROM health_incidents").get().n;
if (_incCount === 0) {
  const seedIncidents = [
    { id: uuid(), agent_id: "agent_7c2e9f05", endpoint_url: "https://parser-bot.internal/ping",   severity: "high",     title: "Elevated latency on parser-bot",       root_cause: "Memory leak in request handler causing GC pressure",    status: "investigating", opened_at: new Date(Date.now() - 3 * 3600000).toISOString(),  resolved_at: null, duration_minutes: null },
    { id: uuid(), agent_id: "agent_bb02d741", endpoint_url: "https://classifier.ml-ops.net/live", severity: "critical", title: "Classifier agent unresponsive",        root_cause: "OOM kill — model weights loaded per-request instead of cached", status: "open", opened_at: new Date(Date.now() - 8 * 3600000).toISOString(), resolved_at: null, duration_minutes: null },
    { id: uuid(), agent_id: "agent_d4f3a1b2", endpoint_url: "https://agent.acme.io/health",       severity: "low",      title: "Brief connectivity blip on acme agent", root_cause: "Rolling deploy caused 90-second downtime window",       status: "resolved",      opened_at: new Date(Date.now() - 48 * 3600000).toISOString(), resolved_at: new Date(Date.now() - 47.5 * 3600000).toISOString(), duration_minutes: 4 },
    { id: uuid(), agent_id: "agent_aa91c830", endpoint_url: "https://summarizer.hiveagent.io/hc", severity: "medium",   title: "Summarizer health endpoint returning 503", root_cause: "Nginx misconfiguration during certificate renewal",    status: "resolved",      opened_at: new Date(Date.now() - 72 * 3600000).toISOString(), resolved_at: new Date(Date.now() - 71 * 3600000).toISOString(), duration_minutes: 12 },
  ];
  const insInc = db.prepare(`
    INSERT OR IGNORE INTO health_incidents
      (id, agent_id, endpoint_url, severity, title, root_cause, status, opened_at, resolved_at, duration_minutes)
    VALUES
      (@id, @agent_id, @endpoint_url, @severity, @title, @root_cause, @status, @opened_at, @resolved_at, @duration_minutes)
  `);
  for (const i of seedIncidents) insInc.run(i);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simulateLatency(status) {
  const profiles = {
    healthy:     () => Math.floor(30 + Math.random() * 200),
    degraded:    () => Math.floor(800 + Math.random() * 2000),
    unhealthy:   () => Math.floor(5000 + Math.random() * 5000),
    unreachable: () => null,
  };
  return (profiles[status] ?? profiles.healthy)();
}

function deriveStatus(latencyMs, consecutiveFailures) {
  if (consecutiveFailures >= 5 || latencyMs === null) return "unreachable";
  if (latencyMs > 5000 || consecutiveFailures >= 3) return "unhealthy";
  if (latencyMs > 800 || consecutiveFailures >= 1) return "degraded";
  return "healthy";
}

function getRecommendedAction(state, failureRate) {
  if (state === "open") return "Circuit is open — route all traffic to fallback agents immediately. Investigate root cause before resetting.";
  if (state === "half-open") return "Circuit is probing — allow limited traffic (10%) to test recovery. Monitor closely.";
  if (failureRate > 0.1) return "Failure rate elevated. Consider reducing traffic to this agent and reviewing error logs.";
  return "Circuit healthy — normal operation.";
}

// ─── Register Endpoint ─────────────────────────────────────────────────────────

/**
 * Register an agent endpoint for continuous health monitoring.
 * @param {string} agentId              - Owner agent ID
 * @param {string} endpointUrl          - URL to monitor (must start with http/https)
 * @param {number} healthCheckInterval  - Check interval in seconds (min 15, default 60)
 * @returns monitor_id, status, next_check, pricing
 * Fee: $0.50/month per endpoint, 15% platform commission
 */
export function registerEndpoint(agentId, endpointUrl, healthCheckInterval = 60) {
  if (!agentId)     throw new Error("agentId is required");
  if (!endpointUrl) throw new Error("endpointUrl is required");
  if (!endpointUrl.startsWith("http")) throw new Error("endpointUrl must start with http:// or https://");

  const intervalSec = Math.max(15, Math.floor(healthCheckInterval));
  const monitorId   = uuid();
  const commission  = Math.round(ENDPOINT_MONTHLY_FEE * HEALTH_COMMISSION * 100) / 100;
  const now         = new Date().toISOString();
  const nextCheck   = new Date(Date.now() + intervalSec * 1000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO health_endpoints
      (id, agent_id, endpoint_url, check_interval_sec, monthly_fee_usd, commission_usd, status, created_at)
    VALUES
      (@id, @agent_id, @endpoint_url, @check_interval_sec, @monthly_fee_usd, @commission_usd, 'healthy', @created_at)
  `).run({
    id: monitorId,
    agent_id:          agentId,
    endpoint_url:      endpointUrl,
    check_interval_sec: intervalSec,
    monthly_fee_usd:   ENDPOINT_MONTHLY_FEE,
    commission_usd:    commission,
    created_at:        now,
  });

  // Ensure circuit breaker row exists for this agent
  const existingCb = db.prepare("SELECT id FROM circuit_breakers WHERE target_agent_id = ?").get(agentId);
  if (!existingCb) {
    db.prepare(`
      INSERT OR IGNORE INTO circuit_breakers (id, target_agent_id, state, created_at)
      VALUES (@id, @target_agent_id, 'closed', @created_at)
    `).run({ id: uuid(), target_agent_id: agentId, created_at: now });
  }

  return {
    monitor_id:            monitorId,
    agent_id:              agentId,
    endpoint_url:          endpointUrl,
    check_interval_sec:    intervalSec,
    status:                "healthy",
    next_check:            nextCheck,
    monthly_fee_usd:       ENDPOINT_MONTHLY_FEE,
    platform_commission_usd: commission,
    message:               `Endpoint registered. Monitoring every ${intervalSec}s. Billed $${ENDPOINT_MONTHLY_FEE}/month.`,
  };
}

// ─── Check Health ──────────────────────────────────────────────────────────────

/**
 * Perform an instant health check on any agent/service endpoint.
 * @param {string} endpointUrl - URL to check
 * @param {number} timeout     - Timeout in milliseconds (default 5000)
 * @returns status, latency_ms, last_success, error_details
 * Fee: $0.005/check
 */
export function checkHealth(endpointUrl, timeout = 5000) {
  if (!endpointUrl) throw new Error("endpointUrl is required");

  // Look up existing monitoring record for richer simulation
  const existing = db.prepare("SELECT * FROM health_endpoints WHERE endpoint_url = ?").get(endpointUrl);

  // Simulate realistic health check result
  const baseStatus    = existing?.status ?? "healthy";
  const isTimeout     = timeout < 1000 && Math.random() < 0.3;
  const status        = isTimeout ? "unreachable" : baseStatus;
  const latencyMs     = isTimeout ? null : simulateLatency(status);
  const errorDetails  = status === "unreachable"
    ? `Connection timed out after ${timeout}ms`
    : status === "unhealthy"
    ? `HTTP 503 Service Unavailable — upstream dependency failure`
    : status === "degraded"
    ? `HTTP 200 but response time ${latencyMs}ms exceeds 800ms SLA threshold`
    : null;

  const checkId  = uuid();
  const checkedAt = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO health_check_log (id, endpoint_url, status, latency_ms, error_details, checked_at)
    VALUES (@id, @endpoint_url, @status, @latency_ms, @error_details, @checked_at)
  `).run({ id: checkId, endpoint_url: endpointUrl, status, latency_ms: latencyMs, error_details: errorDetails, checked_at: checkedAt });

  // Update monitored endpoint if it exists
  if (existing) {
    const newConsecutiveFails = status === "healthy" ? 0 : (existing.consecutive_failures ?? 0) + 1;
    db.prepare(`
      UPDATE health_endpoints SET
        status = @status, last_latency_ms = @latency_ms,
        last_check_at = @checked_at,
        last_success_at = CASE WHEN @status = 'healthy' THEN @checked_at ELSE last_success_at END,
        consecutive_failures = @consecutive_failures,
        total_checks = total_checks + 1,
        total_failures = total_failures + @failed
      WHERE endpoint_url = @endpoint_url
    `).run({
      status,
      latency_ms:          latencyMs,
      checked_at:          checkedAt,
      consecutive_failures: status === "healthy" ? 0 : (existing.consecutive_failures ?? 0) + 1,
      failed:              status === "healthy" ? 0 : 1,
      endpoint_url:        endpointUrl,
    });
  }

  return {
    check_id:        checkId,
    endpoint_url:    endpointUrl,
    status,
    latency_ms:      latencyMs,
    last_success:    existing?.last_success_at ?? checkedAt,
    error_details:   errorDetails,
    timeout_ms:      timeout,
    checked_at:      checkedAt,
    fee_usd:         HEALTH_CHECK_FEE,
    message:         status === "healthy" ? "Endpoint is responding normally." : `Endpoint is ${status}. ${errorDetails ?? ""}`.trim(),
  };
}

// ─── Get Circuit Status ────────────────────────────────────────────────────────

/**
 * Get circuit breaker state for a target agent.
 * @param {string} targetAgentId - Agent whose circuit to inspect
 * @returns state, failure_count, success_count, last_state_change, recommended_action
 * Fee: $0.005/check
 */
export function getCircuitStatus(targetAgentId) {
  if (!targetAgentId) throw new Error("targetAgentId is required");

  let circuit = db.prepare("SELECT * FROM circuit_breakers WHERE target_agent_id = ?").get(targetAgentId);
  if (!circuit) {
    // Auto-create a closed circuit for unknown agents
    const id  = uuid();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO circuit_breakers (id, target_agent_id, state, created_at)
      VALUES (@id, @target_agent_id, 'closed', @now)
    `).run({ id, target_agent_id: targetAgentId, now });
    circuit = db.prepare("SELECT * FROM circuit_breakers WHERE target_agent_id = ?").get(targetAgentId);
  }

  const total       = circuit.total_requests ?? 0;
  const failureRate = total > 0 ? circuit.failure_count / total : 0;

  // Re-evaluate circuit state based on recent logs (rolling window)
  const recentWindow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status != 'healthy' THEN 1 ELSE 0 END) as failures
    FROM health_check_log
    WHERE endpoint_url IN (
      SELECT endpoint_url FROM health_endpoints WHERE agent_id = ?
    )
    AND checked_at >= datetime('now', '-${CIRCUIT_WINDOW_MINUTES} minutes')
  `).get(targetAgentId);

  const recentFailureRate = recentWindow.total > 0
    ? recentWindow.failures / recentWindow.total
    : failureRate;

  const derivedState = recentFailureRate >= CIRCUIT_OPEN_THRESHOLD   ? "open"
                     : recentFailureRate >= CIRCUIT_HALFOPEN_THRESHOLD ? "half-open"
                     : "closed";

  return {
    target_agent_id:     targetAgentId,
    state:               circuit.state,
    derived_state:       derivedState,
    failure_count:       circuit.failure_count,
    success_count:       circuit.success_count,
    total_requests:      circuit.total_requests,
    failure_rate_pct:    Math.round(failureRate * 10000) / 100,
    recent_failure_rate_pct: Math.round(recentFailureRate * 10000) / 100,
    last_state_change:   circuit.last_state_change,
    tripped_reason:      circuit.tripped_reason,
    recommended_action:  getRecommendedAction(circuit.state, failureRate),
    fee_usd:             CIRCUIT_CHECK_FEE,
  };
}

// ─── Trip Circuit ──────────────────────────────────────────────────────────────

/**
 * Manually trip (open) the circuit breaker for a failing agent.
 * @param {string} targetAgentId - Agent to trip
 * @param {string} reason        - Human-readable reason for tripping
 * @returns new_state, affected_workflows[], fallback_agents[]
 * Fee: free (safety feature)
 */
export function tripCircuit(targetAgentId, reason) {
  if (!targetAgentId) throw new Error("targetAgentId is required");
  if (!reason)        throw new Error("reason is required — document why you are tripping this circuit");

  const now = new Date().toISOString();

  const existing = db.prepare("SELECT * FROM circuit_breakers WHERE target_agent_id = ?").get(targetAgentId);
  if (existing) {
    db.prepare(`
      UPDATE circuit_breakers SET
        state = 'open', tripped_reason = @reason, last_state_change = @now
      WHERE target_agent_id = @target_agent_id
    `).run({ reason, now, target_agent_id: targetAgentId });
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO circuit_breakers (id, target_agent_id, state, tripped_reason, last_state_change)
      VALUES (@id, @target_agent_id, 'open', @reason, @now)
    `).run({ id: uuid(), target_agent_id: targetAgentId, reason, now });
  }

  // Simulate affected workflows and fallback agents
  const affectedWorkflows = [
    `wf_${targetAgentId.slice(-6)}_main`,
    `wf_${targetAgentId.slice(-6)}_batch`,
  ].filter(() => Math.random() > 0.3);

  const fallbackAgents = [
    { agent_id: `agent_fallback_${uuid().slice(0, 6)}`, type: "replica",  health: "healthy", latency_ms: 112 },
    { agent_id: `agent_fallback_${uuid().slice(0, 6)}`, type: "alternate", health: "healthy", latency_ms: 145 },
  ];

  // Open a critical incident
  db.prepare(`
    INSERT OR IGNORE INTO health_incidents
      (id, agent_id, endpoint_url, severity, title, root_cause, status, opened_at)
    VALUES
      (@id, @agent_id, @endpoint_url, 'critical', @title, @root_cause, 'investigating', @opened_at)
  `).run({
    id:           uuid(),
    agent_id:     targetAgentId,
    endpoint_url: `agent://${targetAgentId}`,
    title:        `Circuit manually tripped for ${targetAgentId}`,
    root_cause:   reason,
    opened_at:    now,
  });

  return {
    target_agent_id:    targetAgentId,
    previous_state:     existing?.state ?? "unknown",
    new_state:          "open",
    tripped_at:         now,
    tripped_reason:     reason,
    affected_workflows: affectedWorkflows,
    fallback_agents:    fallbackAgents,
    fee_usd:            0,
    message:            `Circuit breaker OPEN for ${targetAgentId}. All traffic routed to ${fallbackAgents.length} fallback agent(s). Affected ${affectedWorkflows.length} workflow(s).`,
  };
}

// ─── Get Health Dashboard ──────────────────────────────────────────────────────

/**
 * Comprehensive health overview of all monitored endpoints for an agent.
 * @param {string} agentId - Agent whose dashboard to retrieve
 * @returns endpoints[], overall_health, failing[], degraded[], uptime_pct, incident_history[]
 * Fee: $5/month per dashboard
 */
export function getHealthDashboard(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const now = new Date().toISOString();

  // Ensure dashboard subscription exists
  const dash = db.prepare("SELECT * FROM health_dashboards WHERE agent_id = ?").get(agentId);
  if (!dash) {
    const commission = Math.round(DASHBOARD_MONTHLY_FEE * HEALTH_COMMISSION * 100) / 100;
    db.prepare(`
      INSERT OR IGNORE INTO health_dashboards (id, agent_id, monthly_fee_usd, commission_usd, registered_at, last_accessed)
      VALUES (@id, @agent_id, @monthly_fee_usd, @commission_usd, @now, @now)
    `).run({ id: uuid(), agent_id: agentId, monthly_fee_usd: DASHBOARD_MONTHLY_FEE, commission_usd: commission, now });
  } else {
    db.prepare("UPDATE health_dashboards SET last_accessed = ? WHERE agent_id = ?").run(now, agentId);
  }

  const endpoints = db.prepare("SELECT * FROM health_endpoints WHERE agent_id = ?").all(agentId);
  const circuit   = db.prepare("SELECT * FROM circuit_breakers WHERE target_agent_id = ?").get(agentId);
  const incidents = db.prepare(`
    SELECT * FROM health_incidents WHERE agent_id = ? ORDER BY opened_at DESC LIMIT 10
  `).all(agentId);

  const failing  = endpoints.filter(e => e.status === "unhealthy" || e.status === "unreachable");
  const degraded = endpoints.filter(e => e.status === "degraded");
  const healthy  = endpoints.filter(e => e.status === "healthy");

  const totalChecks   = endpoints.reduce((s, e) => s + (e.total_checks ?? 0), 0);
  const totalFailures = endpoints.reduce((s, e) => s + (e.total_failures ?? 0), 0);
  const uptimePct     = totalChecks > 0
    ? Math.round(((totalChecks - totalFailures) / totalChecks) * 10000) / 100
    : 100;

  const overallHealth = failing.length > 0  ? "unhealthy"
                      : degraded.length > 0 ? "degraded"
                      : endpoints.length === 0 ? "no_endpoints"
                      : "healthy";

  return {
    agent_id:         agentId,
    overall_health:   overallHealth,
    uptime_pct:       uptimePct,
    endpoints:        endpoints.map(e => ({
      monitor_id:           e.id,
      endpoint_url:         e.endpoint_url,
      status:               e.status,
      last_latency_ms:      e.last_latency_ms,
      last_check_at:        e.last_check_at,
      last_success_at:      e.last_success_at,
      consecutive_failures: e.consecutive_failures,
      uptime_pct:           e.total_checks > 0
        ? Math.round(((e.total_checks - e.total_failures) / e.total_checks) * 10000) / 100
        : 100,
      check_interval_sec:   e.check_interval_sec,
    })),
    failing:          failing.map(e => ({ url: e.endpoint_url, status: e.status, consecutive_failures: e.consecutive_failures })),
    degraded:         degraded.map(e => ({ url: e.endpoint_url, latency_ms: e.last_latency_ms })),
    healthy_count:    healthy.length,
    circuit_breaker:  circuit ? { state: circuit.state, failure_count: circuit.failure_count, last_change: circuit.last_state_change } : null,
    incident_history: incidents.map(i => ({
      incident_id:      i.id,
      severity:         i.severity,
      title:            i.title,
      status:           i.status,
      opened_at:        i.opened_at,
      resolved_at:      i.resolved_at,
      duration_minutes: i.duration_minutes,
    })),
    monthly_fee_usd:  DASHBOARD_MONTHLY_FEE,
    generated_at:     now,
  };
}

// ─── List Incidents ────────────────────────────────────────────────────────────

/**
 * Retrieve incident history with root cause analysis and reliability metrics.
 * @param {string} agentId    - Agent whose incidents to list
 * @param {string} severity   - Optional: low|medium|high|critical
 * @param {string} timeRange  - Optional: "24h" | "7d" | "30d" (default "30d")
 * @returns incidents[], mttr_minutes, mtbf_hours, trends
 * Fee: included with dashboard subscription
 */
export function listIncidents(agentId, severity, timeRange = "30d") {
  if (!agentId) throw new Error("agentId is required");

  const rangeMap = { "24h": "-1 days", "7d": "-7 days", "30d": "-30 days" };
  const sqlRange = rangeMap[timeRange] ?? "-30 days";

  let sql    = "SELECT * FROM health_incidents WHERE agent_id = ? AND opened_at >= datetime('now', ?)";
  const args = [agentId, sqlRange];

  if (severity) {
    const valid = ["low", "medium", "high", "critical"];
    if (!valid.includes(severity)) throw new Error(`severity must be one of: ${valid.join(", ")}`);
    sql  += " AND severity = ?";
    args.push(severity);
  }

  sql += " ORDER BY opened_at DESC";

  const incidents = db.prepare(sql).all(...args);

  const resolved    = incidents.filter(i => i.status === "resolved" && i.duration_minutes != null);
  const mttrMinutes = resolved.length > 0
    ? Math.round(resolved.reduce((s, i) => s + i.duration_minutes, 0) / resolved.length)
    : null;

  // MTBF: estimate from resolved incidents
  const mtbfHours = resolved.length > 1
    ? Math.round(
        (new Date(resolved[0].opened_at) - new Date(resolved[resolved.length - 1].opened_at))
        / (resolved.length - 1) / 3600000 * 10
      ) / 10
    : null;

  const bySeverity = ["critical", "high", "medium", "low"].map(sev => ({
    severity: sev,
    count:    incidents.filter(i => i.severity === sev).length,
  }));

  return {
    agent_id:        agentId,
    time_range:      timeRange,
    total_incidents: incidents.length,
    open:            incidents.filter(i => i.status === "open").length,
    investigating:   incidents.filter(i => i.status === "investigating").length,
    resolved:        incidents.filter(i => i.status === "resolved").length,
    mttr_minutes:    mttrMinutes,
    mtbf_hours:      mtbfHours,
    incidents:       incidents.map(i => ({
      incident_id:      i.id,
      severity:         i.severity,
      title:            i.title,
      endpoint_url:     i.endpoint_url,
      root_cause:       i.root_cause,
      status:           i.status,
      opened_at:        i.opened_at,
      resolved_at:      i.resolved_at,
      duration_minutes: i.duration_minutes,
    })),
    trends:          {
      by_severity:    bySeverity,
      most_affected:  incidents[0]?.endpoint_url ?? null,
    },
    fee_note:        "Included with health dashboard subscription ($5/month).",
  };
}
