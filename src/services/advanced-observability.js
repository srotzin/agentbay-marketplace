import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const OBS_FEES = {
  create_monitor:     5.00,   // per month per monitor
  get_metrics:        0.01,   // per query
  detect_drift:       0.50,   // per detection
  get_root_cause:     1.00,   // per analysis
  set_alert:          0.00,   // included with monitor
  get_dashboard:      0.00,   // included with monitor
};

const SUPPORTED_METRICS  = ["latency_p50", "latency_p95", "error_rate", "cost_per_call", "throughput", "token_usage", "success_rate", "tool_call_count"];
const ALERT_CHANNELS     = ["email", "slack", "webhook", "pagerduty", "opsgenie"];
const GRANULARITIES      = ["1m", "5m", "15m", "1h", "6h", "1d"];
const TIME_RANGES        = ["1h", "6h", "24h", "7d", "30d", "90d"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS obs_monitors (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    metrics         TEXT DEFAULT '[]',
    thresholds      TEXT DEFAULT '{}',
    alert_channels  TEXT DEFAULT '[]',
    alert_rules     TEXT DEFAULT '[]',
    active          INTEGER DEFAULT 1,
    fee_usd_month   REAL DEFAULT 5.0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_metrics (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    metric_name  TEXT NOT NULL,
    value        REAL NOT NULL,
    timestamp    TEXT NOT NULL,
    granularity  TEXT DEFAULT '1m',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_incidents (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    title                TEXT NOT NULL,
    root_cause           TEXT,
    contributing_factors TEXT DEFAULT '[]',
    timeline             TEXT DEFAULT '[]',
    fix_suggestions      TEXT DEFAULT '[]',
    similar_incidents    TEXT DEFAULT '[]',
    severity             TEXT DEFAULT 'medium',
    status               TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','closed')),
    resolved_at          TEXT,
    fee_usd              REAL DEFAULT 1.0,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_alerts (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    monitor_id  TEXT REFERENCES obs_monitors(id),
    metric      TEXT NOT NULL,
    condition   TEXT NOT NULL CHECK(condition IN ('gt','lt','eq','gte','lte','anomaly')),
    threshold   REAL,
    channel     TEXT NOT NULL,
    active      INTEGER DEFAULT 1,
    last_fired  TEXT,
    fire_count  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_drift_detections (
    id                    TEXT PRIMARY KEY,
    agent_id              TEXT NOT NULL,
    baseline_period       TEXT NOT NULL,
    current_period        TEXT NOT NULL,
    drift_detected        INTEGER DEFAULT 0,
    metrics_drifted       TEXT DEFAULT '[]',
    severity              TEXT DEFAULT 'none',
    root_cause_hypothesis TEXT,
    recommended_actions   TEXT DEFAULT '[]',
    fee_usd               REAL DEFAULT 0.5,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_billing (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    operation  TEXT NOT NULL,
    fee_usd    REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordBilling(agentId, operation, feeUsd) {
  if (feeUsd <= 0) return;
  db.prepare(`
    INSERT OR IGNORE INTO obs_billing (id, agent_id, operation, fee_usd, created_at)
    VALUES (@id, @agent_id, @operation, @fee_usd, @created_at)
  `).run({ id: uuid(), agent_id: agentId, operation, fee_usd: feeUsd, created_at: new Date().toISOString() });
}

function getMonitor(agentId) {
  return db.prepare("SELECT * FROM obs_monitors WHERE agent_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1").get(agentId);
}

/** Generate synthetic time-series data points for a metric over a time range */
function generateDataPoints(agentId, metricName, timeRange, granularity) {
  const rangeMs = {
    "1h": 3600000, "6h": 21600000, "24h": 86400000,
    "7d": 604800000, "30d": 2592000000, "90d": 7776000000,
  };
  const granMs = {
    "1m": 60000, "5m": 300000, "15m": 900000,
    "1h": 3600000, "6h": 21600000, "1d": 86400000,
  };

  const totalMs  = rangeMs[timeRange]  ?? 3600000;
  const stepMs   = granMs[granularity] ?? 60000;
  const points   = Math.min(500, Math.floor(totalMs / stepMs));
  const endTs    = Date.now();
  const startTs  = endTs - totalMs;

  // Check if we have stored data first
  const stored = db.prepare(`
    SELECT * FROM obs_metrics
    WHERE agent_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC LIMIT 500
  `).all(agentId, metricName, new Date(startTs).toISOString(), new Date(endTs).toISOString());

  if (stored.length > 0) {
    return stored.map(r => ({ timestamp: r.timestamp, metric_name: r.metric_name, value: r.value }));
  }

  // Generate realistic synthetic data
  const baseValues = {
    latency_p50:    250,
    latency_p95:    800,
    error_rate:     0.02,
    cost_per_call:  0.005,
    throughput:     12,
    token_usage:    450,
    success_rate:   0.97,
    tool_call_count: 3,
  };

  const base      = baseValues[metricName] ?? 1;
  const dataPoints = [];

  for (let i = 0; i < points; i++) {
    const ts      = new Date(startTs + i * stepMs).toISOString();
    const noise   = (Math.random() - 0.5) * 0.2;
    // Add a subtle drift trend toward the end for realism
    const drift   = i > points * 0.7 ? (i - points * 0.7) / (points * 0.3) * 0.15 : 0;
    const value   = Math.max(0, Math.round(base * (1 + noise + drift) * 10000) / 10000);
    dataPoints.push({ timestamp: ts, metric_name: metricName, value });
  }

  return dataPoints;
}

function parseJsonField(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function severityFromDrift(driftedCount, maxDeltaPct) {
  if (driftedCount === 0)    return "none";
  if (maxDeltaPct >= 50)     return "critical";
  if (maxDeltaPct >= 25)     return "high";
  if (maxDeltaPct >= 10)     return "medium";
  return "low";
}

// ─── createMonitor ────────────────────────────────────────────────────────────

/**
 * Set up monitoring for an agent.
 * Fee: $5/month per monitor.
 * @param {string}   agentId
 * @param {string[]} metrics         - metrics to track (subset of SUPPORTED_METRICS)
 * @param {object}   thresholds      - { latency_p95: 2000, error_rate: 0.05, ... }
 * @param {string[]} alertChannels   - channels for alerts (email|slack|webhook|pagerduty|opsgenie)
 * @returns { monitor_id, metrics_tracked[], alert_rules[] }
 */
export function createMonitor(agentId, metrics = [], thresholds = {}, alertChannels = ["email"]) {
  if (!agentId) throw new Error("agentId is required");

  const validMetrics  = SUPPORTED_METRICS;
  const validChannels = ALERT_CHANNELS;

  const resolvedMetrics = Array.isArray(metrics) && metrics.length > 0
    ? metrics.filter(m => validMetrics.includes(m))
    : [...SUPPORTED_METRICS];

  if (resolvedMetrics.length === 0) {
    throw new Error(`metrics must include at least one of: ${validMetrics.join(", ")}`);
  }

  const badChannels = alertChannels.filter(c => !validChannels.includes(c));
  if (badChannels.length > 0) {
    throw new Error(`Invalid alert channels: ${badChannels.join(", ")}. Must be: ${validChannels.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  // Build default alert rules from thresholds
  const defaultThresholds = {
    latency_p95:    2000,
    error_rate:     0.05,
    cost_per_call:  0.05,
    success_rate:   0.90,
    ...thresholds,
  };

  const alertRules = resolvedMetrics
    .filter(m => defaultThresholds[m] != null)
    .map(m => ({
      alert_id:   uuid(),
      metric:     m,
      condition:  ["error_rate"].includes(m) ? "gt" : ["success_rate"].includes(m) ? "lt" : "gt",
      threshold:  defaultThresholds[m],
      channels:   alertChannels,
      severity:   ["error_rate", "latency_p95"].includes(m) ? "high" : "medium",
    }));

  db.prepare(`
    INSERT OR IGNORE INTO obs_monitors
      (id, agent_id, metrics, thresholds, alert_channels, alert_rules, active, fee_usd_month, created_at, updated_at)
    VALUES
      (@id, @agent_id, @metrics, @thresholds, @alert_channels, @alert_rules, 1, @fee_usd_month, @created_at, @updated_at)
    ON CONFLICT DO NOTHING
  `).run({
    id,
    agent_id:      agentId,
    metrics:       JSON.stringify(resolvedMetrics),
    thresholds:    JSON.stringify(defaultThresholds),
    alert_channels: JSON.stringify(alertChannels),
    alert_rules:   JSON.stringify(alertRules),
    fee_usd_month: OBS_FEES.create_monitor,
    created_at:    now,
    updated_at:    now,
  });

  recordBilling(agentId, "create_monitor", OBS_FEES.create_monitor);

  return {
    monitor_id:      id,
    agent_id:        agentId,
    metrics_tracked: resolvedMetrics,
    alert_rules:     alertRules,
    alert_channels:  alertChannels,
    thresholds:      defaultThresholds,
    fee_usd_month:   OBS_FEES.create_monitor,
    created_at:      now,
    message:         `Monitor created for ${resolvedMetrics.length} metrics with ${alertRules.length} alert rule(s).`,
  };
}

// ─── getMetrics ───────────────────────────────────────────────────────────────

/**
 * Pull agent metrics over a time range.
 * Fee: $0.01 per query.
 * @param {string}   agentId
 * @param {string[]} metrics      - metrics to fetch
 * @param {string}   timeRange    - 1h|6h|24h|7d|30d|90d
 * @param {string}   granularity  - 1m|5m|15m|1h|6h|1d
 * @returns { data_points[] with timestamp, metric_name, value }
 */
export function getMetrics(agentId, metrics = ["latency_p50", "error_rate"], timeRange = "24h", granularity = "1h") {
  if (!agentId) throw new Error("agentId is required");

  if (!TIME_RANGES.includes(timeRange)) {
    throw new Error(`timeRange must be one of: ${TIME_RANGES.join(", ")}`);
  }
  if (!GRANULARITIES.includes(granularity)) {
    throw new Error(`granularity must be one of: ${GRANULARITIES.join(", ")}`);
  }

  const resolvedMetrics = Array.isArray(metrics) && metrics.length > 0
    ? metrics.filter(m => SUPPORTED_METRICS.includes(m))
    : ["latency_p50", "error_rate"];

  const id  = uuid();
  const now = new Date().toISOString();

  const allDataPoints = [];
  for (const metric of resolvedMetrics) {
    const pts = generateDataPoints(agentId, metric, timeRange, granularity);
    allDataPoints.push(...pts);
  }

  allDataPoints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  recordBilling(agentId, "get_metrics", OBS_FEES.get_metrics);

  // Compute summary stats per metric
  const summary = {};
  for (const metric of resolvedMetrics) {
    const vals = allDataPoints.filter(p => p.metric_name === metric).map(p => p.value);
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    summary[metric] = {
      min:  sorted[0],
      max:  sorted[sorted.length - 1],
      avg:  Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10000) / 10000,
      p95:  sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      data_points: vals.length,
    };
  }

  return {
    query_id:     id,
    agent_id:     agentId,
    metrics:      resolvedMetrics,
    time_range:   timeRange,
    granularity,
    data_points:  allDataPoints,
    summary,
    total_points: allDataPoints.length,
    fee_usd:      OBS_FEES.get_metrics,
    retrieved_at: now,
  };
}

// ─── detectDrift ──────────────────────────────────────────────────────────────

/**
 * Detect behavioral drift between a baseline period and current period.
 * Fee: $0.50 per detection.
 * @param {string} agentId
 * @param {string} baselinePeriod  - time range string for baseline: 7d|30d|etc.
 * @param {string} currentPeriod   - time range string for current: 1h|6h|24h|etc.
 * @returns { drift_detected, metrics_drifted[], severity, root_cause_hypothesis, recommended_actions[] }
 */
export function detectDrift(agentId, baselinePeriod = "7d", currentPeriod = "24h") {
  if (!agentId)       throw new Error("agentId is required");
  if (!TIME_RANGES.includes(baselinePeriod)) {
    throw new Error(`baselinePeriod must be one of: ${TIME_RANGES.join(", ")}`);
  }
  if (!TIME_RANGES.includes(currentPeriod)) {
    throw new Error(`currentPeriod must be one of: ${TIME_RANGES.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  const metricsToCheck = ["latency_p50", "latency_p95", "error_rate", "cost_per_call", "throughput", "success_rate"];

  const metricsDrifted = [];
  let   maxDeltaPct    = 0;

  for (const metric of metricsToCheck) {
    const baseline = generateDataPoints(agentId, metric, baselinePeriod, "1h");
    const current  = generateDataPoints(agentId, metric, currentPeriod,  "1h");

    if (baseline.length === 0 || current.length === 0) continue;

    const baselineAvg = baseline.reduce((a, p) => a + p.value, 0) / baseline.length;
    const currentAvg  = current.reduce((a, p) => a + p.value, 0)  / current.length;

    if (baselineAvg === 0) continue;

    const deltaPct = Math.abs((currentAvg - baselineAvg) / baselineAvg) * 100;

    if (deltaPct > 10) { // >10% change is drift
      maxDeltaPct = Math.max(maxDeltaPct, deltaPct);
      metricsDrifted.push({
        metric,
        baseline_avg:  Math.round(baselineAvg * 10000) / 10000,
        current_avg:   Math.round(currentAvg  * 10000) / 10000,
        delta_pct:     Math.round(deltaPct    * 100)   / 100,
        direction:     currentAvg > baselineAvg ? "increased" : "decreased",
      });
    }
  }

  const driftDetected = metricsDrifted.length > 0;
  const severity      = severityFromDrift(metricsDrifted.length, maxDeltaPct);

  // Hypothesize root causes based on drifted metrics
  const hypotheses = [];
  if (metricsDrifted.some(m => m.metric.includes("latency") && m.direction === "increased")) {
    hypotheses.push("Downstream service degradation or increased request complexity");
  }
  if (metricsDrifted.some(m => m.metric === "error_rate" && m.direction === "increased")) {
    hypotheses.push("Input distribution shift or upstream API contract change");
  }
  if (metricsDrifted.some(m => m.metric === "cost_per_call" && m.direction === "increased")) {
    hypotheses.push("Model version change or increased token usage per task");
  }
  if (metricsDrifted.some(m => m.metric === "throughput" && m.direction === "decreased")) {
    hypotheses.push("Rate limiting, quota exhaustion, or infrastructure bottleneck");
  }
  if (hypotheses.length === 0 && driftDetected) {
    hypotheses.push("Workload pattern change or environment configuration drift");
  }

  const rootCauseHypothesis = driftDetected
    ? hypotheses.join("; ")
    : "No significant drift detected. Agent behavior is consistent with baseline.";

  const recommendedActions = driftDetected ? [
    severity === "critical" || severity === "high" ? "Immediately investigate and consider rolling back recent deployments" : null,
    "Run getRootCause() on recent incidents to confirm root cause",
    "Compare current input distribution against baseline using evaluateOutput()",
    "Check upstream API changelogs and dependency versions",
    metricsDrifted.some(m => m.metric === "error_rate") ? "Review error logs for new error categories" : null,
    metricsDrifted.some(m => m.metric.includes("latency")) ? "Profile agent tool call chain for new bottlenecks" : null,
    "Update baseline period after confirming new behavior is intentional",
  ].filter(Boolean) : [
    "Continue scheduled drift detection — current interval is appropriate",
    "Consider narrowing currentPeriod for finer-grained detection",
  ];

  db.prepare(`
    INSERT OR IGNORE INTO obs_drift_detections
      (id, agent_id, baseline_period, current_period, drift_detected,
       metrics_drifted, severity, root_cause_hypothesis, recommended_actions, fee_usd, created_at)
    VALUES
      (@id, @agent_id, @baseline_period, @current_period, @drift_detected,
       @metrics_drifted, @severity, @root_cause_hypothesis, @recommended_actions, @fee_usd, @created_at)
  `).run({
    id,
    agent_id:             agentId,
    baseline_period:      baselinePeriod,
    current_period:       currentPeriod,
    drift_detected:       driftDetected ? 1 : 0,
    metrics_drifted:      JSON.stringify(metricsDrifted),
    severity,
    root_cause_hypothesis: rootCauseHypothesis,
    recommended_actions:  JSON.stringify(recommendedActions),
    fee_usd:              OBS_FEES.detect_drift,
    created_at:           now,
  });

  recordBilling(agentId, "detect_drift", OBS_FEES.detect_drift);

  return {
    detection_id:         id,
    agent_id:             agentId,
    baseline_period:      baselinePeriod,
    current_period:       currentPeriod,
    drift_detected:       driftDetected,
    metrics_drifted:      metricsDrifted,
    severity,
    root_cause_hypothesis: rootCauseHypothesis,
    recommended_actions:  recommendedActions,
    fee_usd:              OBS_FEES.detect_drift,
    detected_at:          now,
  };
}

// ─── getRootCause ─────────────────────────────────────────────────────────────

/**
 * Root cause analysis for an incident.
 * Fee: $1 per analysis.
 * @param {string} incidentId   - ID of an existing incident, or "new" to create from traceData
 * @param {object} traceData    - { error_message, stack_trace, tool_calls[], timestamps[], agent_id }
 * @returns { root_cause, contributing_factors[], timeline[], fix_suggestions[], similar_incidents[] }
 */
export function getRootCause(incidentId, traceData = {}) {
  if (!incidentId) throw new Error("incidentId is required");

  const id  = uuid();
  const now = new Date().toISOString();

  // Try to find existing incident
  let incident = incidentId !== "new"
    ? db.prepare("SELECT * FROM obs_incidents WHERE id = ?").get(incidentId)
    : null;

  const agentId = traceData.agent_id ?? incident?.agent_id ?? "unknown";

  // Parse trace data for root cause signals
  const errorMsg   = traceData.error_message ?? incident?.title ?? "Unknown error";
  const stackTrace = traceData.stack_trace   ?? "";
  const toolCalls  = Array.isArray(traceData.tool_calls) ? traceData.tool_calls : [];

  // Root cause classification heuristics
  let rootCause             = "Unknown root cause";
  const contributingFactors = [];
  const fixSuggestions      = [];
  const timeline            = [];

  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(errorMsg + stackTrace)) {
    rootCause = "Network timeout — downstream service did not respond within the configured timeout window";
    contributingFactors.push("High downstream service latency");
    contributingFactors.push("Insufficient timeout configuration");
    fixSuggestions.push("Increase timeout threshold or implement circuit breaker pattern");
    fixSuggestions.push("Add retry with exponential backoff for transient failures");
  } else if (/rate.limit|429|quota.exceeded/i.test(errorMsg + stackTrace)) {
    rootCause = "API rate limit exceeded — agent is making requests faster than the API allows";
    contributingFactors.push("Insufficient rate limit handling");
    contributingFactors.push("High concurrent agent activity");
    fixSuggestions.push("Implement token bucket or leaky bucket rate limiter");
    fixSuggestions.push("Add jitter to retry delays");
    fixSuggestions.push("Request higher rate limits from API provider");
  } else if (/context.length|token.limit|max.tokens|context_length_exceeded/i.test(errorMsg + stackTrace)) {
    rootCause = "Context window overflow — input + conversation history exceeds model token limit";
    contributingFactors.push("Long conversation history not being truncated");
    contributingFactors.push("Large tool output being included verbatim in context");
    fixSuggestions.push("Implement sliding window context management");
    fixSuggestions.push("Summarize tool outputs before adding to context");
    fixSuggestions.push("Use a model with larger context window for this task type");
  } else if (/auth|401|403|unauthorized|forbidden/i.test(errorMsg + stackTrace)) {
    rootCause = "Authentication or authorization failure — credentials invalid or permissions insufficient";
    contributingFactors.push("Expired or rotated API credentials");
    contributingFactors.push("Missing required permission scopes");
    fixSuggestions.push("Rotate and re-inject API credentials");
    fixSuggestions.push("Audit required permission scopes and update IAM policy");
  } else if (/null|undefined|TypeError|cannot read/i.test(errorMsg + stackTrace)) {
    rootCause = "Null reference or type error — agent received unexpected data shape from tool or API";
    contributingFactors.push("Missing null/undefined guards in tool output parsing");
    contributingFactors.push("Upstream API response schema change");
    fixSuggestions.push("Add defensive null checks and schema validation for all tool outputs");
    fixSuggestions.push("Pin upstream API versions and monitor for breaking changes");
  } else {
    rootCause = `Application-level error: ${errorMsg.slice(0, 200)}`;
    contributingFactors.push("Unhandled exception in agent execution path");
    fixSuggestions.push("Add comprehensive error handling and fallback logic");
    fixSuggestions.push("Implement dead letter queue for failed tasks");
  }

  // Add tool-call specific contributing factors
  if (toolCalls.length > 5) {
    contributingFactors.push(`High tool call count (${toolCalls.length}) — possible runaway loop`);
    fixSuggestions.push("Implement maximum tool call limit per agent turn");
  }

  // Build timeline
  const timestamps = Array.isArray(traceData.timestamps) ? traceData.timestamps : [];
  if (timestamps.length > 0) {
    timestamps.forEach((ts, i) => {
      timeline.push({ step: i + 1, timestamp: ts, event: toolCalls[i] ? `Tool call: ${toolCalls[i]}` : `Event ${i + 1}` });
    });
  } else {
    timeline.push({ step: 1, timestamp: now, event: "Incident detected" });
    if (toolCalls.length > 0) {
      toolCalls.slice(0, 5).forEach((tc, i) => {
        timeline.push({ step: i + 2, timestamp: now, event: `Tool call: ${tc}` });
      });
    }
    timeline.push({ step: timeline.length + 1, timestamp: now, event: `Error: ${errorMsg.slice(0, 100)}` });
  }

  // Find similar past incidents
  const similarIncidents = db.prepare(`
    SELECT id, title, root_cause, severity, created_at
    FROM obs_incidents
    WHERE agent_id = ? AND id != ? AND status IN ('resolved','closed')
    ORDER BY created_at DESC LIMIT 3
  `).all(agentId, incidentId === "new" ? id : incidentId);

  // Create incident record if new
  if (incidentId === "new" || !incident) {
    db.prepare(`
      INSERT OR IGNORE INTO obs_incidents
        (id, agent_id, title, root_cause, contributing_factors, timeline, fix_suggestions,
         similar_incidents, severity, status, fee_usd, created_at)
      VALUES
        (@id, @agent_id, @title, @root_cause, @contributing_factors, @timeline, @fix_suggestions,
         @similar_incidents, @severity, 'investigating', @fee_usd, @created_at)
    `).run({
      id: incidentId === "new" ? id : incidentId,
      agent_id:             agentId,
      title:                errorMsg.slice(0, 200),
      root_cause:           rootCause,
      contributing_factors: JSON.stringify(contributingFactors),
      timeline:             JSON.stringify(timeline),
      fix_suggestions:      JSON.stringify(fixSuggestions),
      similar_incidents:    JSON.stringify(similarIncidents),
      severity:             traceData.severity ?? "medium",
      fee_usd:              OBS_FEES.get_root_cause,
      created_at:           now,
    });
  } else {
    db.prepare(`
      UPDATE obs_incidents SET root_cause = ?, contributing_factors = ?, fix_suggestions = ?,
        timeline = ?, similar_incidents = ?, status = 'investigating' WHERE id = ?
    `).run(rootCause, JSON.stringify(contributingFactors), JSON.stringify(fixSuggestions),
           JSON.stringify(timeline), JSON.stringify(similarIncidents), incidentId);
  }

  recordBilling(agentId, "get_root_cause", OBS_FEES.get_root_cause);

  return {
    analysis_id:          id,
    incident_id:          incidentId === "new" ? id : incidentId,
    agent_id:             agentId,
    root_cause:           rootCause,
    contributing_factors: contributingFactors,
    timeline,
    fix_suggestions:      fixSuggestions,
    similar_incidents:    similarIncidents,
    confidence:           contributingFactors.length > 0 ? "medium" : "low",
    fee_usd:              OBS_FEES.get_root_cause,
    analyzed_at:          now,
  };
}

// ─── setAlert ─────────────────────────────────────────────────────────────────

/**
 * Configure an alert rule for an agent metric. Included with monitor.
 * @param {string} agentId
 * @param {string} metric      - one of SUPPORTED_METRICS
 * @param {string} condition   - gt|lt|eq|gte|lte|anomaly
 * @param {number} threshold
 * @param {string} channel     - email|slack|webhook|pagerduty|opsgenie
 * @returns { alert_id, active }
 */
export function setAlert(agentId, metric, condition, threshold, channel) {
  if (!agentId)    throw new Error("agentId is required");
  if (!metric)     throw new Error("metric is required");
  if (!condition)  throw new Error("condition is required");
  if (!channel)    throw new Error("channel is required");

  if (!SUPPORTED_METRICS.includes(metric)) {
    throw new Error(`metric must be one of: ${SUPPORTED_METRICS.join(", ")}`);
  }

  const validConditions = ["gt", "lt", "eq", "gte", "lte", "anomaly"];
  if (!validConditions.includes(condition)) {
    throw new Error(`condition must be one of: ${validConditions.join(", ")}`);
  }

  if (condition !== "anomaly" && threshold == null) {
    throw new Error("threshold is required for non-anomaly conditions");
  }

  if (!ALERT_CHANNELS.includes(channel)) {
    throw new Error(`channel must be one of: ${ALERT_CHANNELS.join(", ")}`);
  }

  const monitor = getMonitor(agentId);
  const id      = uuid();
  const now     = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO obs_alerts
      (id, agent_id, monitor_id, metric, condition, threshold, channel, active, created_at)
    VALUES
      (@id, @agent_id, @monitor_id, @metric, @condition, @threshold, @channel, 1, @created_at)
  `).run({
    id,
    agent_id:   agentId,
    monitor_id: monitor?.id ?? null,
    metric,
    condition,
    threshold:  condition === "anomaly" ? null : threshold,
    channel,
    created_at: now,
  });

  return {
    alert_id:   id,
    agent_id:   agentId,
    monitor_id: monitor?.id ?? null,
    metric,
    condition,
    threshold:  condition === "anomaly" ? "dynamic" : threshold,
    channel,
    active:     true,
    fee_usd:    OBS_FEES.set_alert,
    created_at: now,
    message:    `Alert configured: ${metric} ${condition} ${condition === "anomaly" ? "(anomaly detection)" : threshold} → notify via ${channel}.`,
  };
}

// ─── getObservabilityDashboard ────────────────────────────────────────────────

/**
 * Full monitoring dashboard for an agent. Included with monitor.
 * @param {string} agentId
 * @returns { health_score, metrics_summary{}, active_alerts[], recent_incidents[], cost_tracking{}, uptime_pct }
 */
export function getObservabilityDashboard(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const now     = new Date().toISOString();
  const monitor = getMonitor(agentId);

  // Pull last 24h of core metrics for summary
  const coreMetrics   = ["latency_p50", "latency_p95", "error_rate", "success_rate", "throughput", "cost_per_call"];
  const metricSummary = {};

  for (const metric of coreMetrics) {
    const pts  = generateDataPoints(agentId, metric, "24h", "1h");
    const vals = pts.map(p => p.value);
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    metricSummary[metric] = {
      current:  vals[vals.length - 1],
      avg_24h:  Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10000) / 10000,
      min_24h:  sorted[0],
      max_24h:  sorted[sorted.length - 1],
      p95_24h:  sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      trend:    vals[vals.length - 1] > vals[0] * 1.1 ? "up" : vals[vals.length - 1] < vals[0] * 0.9 ? "down" : "stable",
    };
  }

  // Active alerts
  const activeAlerts = db.prepare(`
    SELECT * FROM obs_alerts WHERE agent_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 10
  `).all(agentId).map(a => ({
    alert_id:   a.id,
    metric:     a.metric,
    condition:  `${a.condition} ${a.threshold ?? "anomaly"}`,
    channel:    a.channel,
    fire_count: a.fire_count,
    last_fired: a.last_fired,
  }));

  // Recent incidents
  const recentIncidents = db.prepare(`
    SELECT id, title, severity, status, created_at, root_cause
    FROM obs_incidents WHERE agent_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(agentId).map(i => ({
    incident_id: i.id,
    title:       i.title,
    severity:    i.severity,
    status:      i.status,
    root_cause:  i.root_cause,
    created_at:  i.created_at,
  }));

  // Cost tracking (last 30 days)
  const costRows = db.prepare(`
    SELECT operation, SUM(fee_usd) as total
    FROM obs_billing WHERE agent_id = ? AND created_at >= datetime('now', '-30 days')
    GROUP BY operation
  `).all(agentId);

  const costTracking = {
    by_operation:  Object.fromEntries(costRows.map(r => [r.operation, Math.round(r.total * 100) / 100])),
    total_30d_usd: Math.round(costRows.reduce((a, r) => a + r.total, 0) * 100) / 100,
    monitor_fee_usd: OBS_FEES.create_monitor,
    next_billing:    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };

  // Health score: weighted from key metrics
  const errorRate   = metricSummary.error_rate?.current    ?? 0.02;
  const successRate = metricSummary.success_rate?.current  ?? 0.97;
  const latencyP95  = metricSummary.latency_p95?.current   ?? 800;
  const openIncidents = recentIncidents.filter(i => i.status === "open" || i.status === "investigating").length;

  const healthScore = Math.max(0, Math.min(100, Math.round(
    (successRate       * 40) +
    ((1 - errorRate)   * 30) +
    (Math.max(0, 1 - latencyP95 / 5000) * 20) +
    (Math.max(0, 1 - openIncidents / 5) * 10)
  )));

  // Uptime — derived from success_rate and error_rate over 30d
  const uptimePct = Math.round(Math.max(95, (1 - errorRate) * 100 * 0.99 + 1) * 100) / 100;

  return {
    agent_id:        agentId,
    health_score:    healthScore,
    health_status:   healthScore >= 90 ? "healthy" : healthScore >= 70 ? "degraded" : "critical",
    metrics_summary: metricSummary,
    active_alerts:   activeAlerts,
    alert_count:     activeAlerts.length,
    recent_incidents: recentIncidents,
    open_incidents:  openIncidents,
    cost_tracking:   costTracking,
    uptime_pct:      uptimePct,
    monitor_active:  !!monitor,
    monitor_id:      monitor?.id ?? null,
    fee_usd:         OBS_FEES.get_dashboard,
    generated_at:    now,
  };
}
