/**
 * HivePulse — Instant Agent Observability
 *
 * 3 lines of code → live trace dashboard at hiveagentiq.com/pulse/{agent_id}
 *
 * No setup. No account. No config. Call pulse_trace and you're live.
 * See every action, latency, cost, error — in real time.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pulse_traces (
      id             TEXT PRIMARY KEY,
      agent_id       TEXT NOT NULL,
      trace_id       TEXT,
      action         TEXT,
      input_preview  TEXT,
      output_preview TEXT,
      latency_ms     INTEGER,
      success        INTEGER DEFAULT 1,
      error_msg      TEXT,
      cost_usdc      REAL DEFAULT 0,
      model_used     TEXT,
      tool_calls     TEXT DEFAULT '[]',
      timestamp      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pulse_traces_agent
      ON pulse_traces(agent_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_pulse_traces_trace_id
      ON pulse_traces(trace_id);
  `);
} catch (e) {
  console.error("[HivePulse] Schema init error (pulse_traces):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pulse_sessions (
      session_id       TEXT PRIMARY KEY,
      agent_id         TEXT,
      start_time       TEXT,
      end_time         TEXT,
      trace_count      INTEGER DEFAULT 0,
      total_latency_ms INTEGER DEFAULT 0,
      total_cost_usdc  REAL DEFAULT 0,
      error_count      INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pulse_sessions_agent
      ON pulse_sessions(agent_id);
  `);
} catch (e) {
  console.error("[HivePulse] Schema init error (pulse_sessions):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pulse_alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id      TEXT,
      alert_type    TEXT,
      threshold     REAL,
      current_value REAL,
      triggered_at  TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[HivePulse] Schema init error (pulse_alerts):", e.message);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dashboardUrl(agent_id) {
  return `https://hiveagentiq.com/pulse/${encodeURIComponent(agent_id)}`;
}

function truncate(str, maxLen = 200) {
  if (!str) return "";
  const s = typeof str === "object" ? JSON.stringify(str) : String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function ensureSession(session_id, agent_id) {
  if (!session_id) return;
  try {
    db.prepare(`
      INSERT OR IGNORE INTO pulse_sessions (session_id, agent_id, start_time)
      VALUES (?, ?, datetime('now'))
    `).run(session_id, agent_id);
  } catch {}
}

function updateSession(session_id, latency_ms, cost_usdc, success) {
  if (!session_id) return;
  try {
    db.prepare(`
      UPDATE pulse_sessions SET
        trace_count      = trace_count + 1,
        total_latency_ms = total_latency_ms + ?,
        total_cost_usdc  = total_cost_usdc + ?,
        error_count      = error_count + ?,
        end_time         = datetime('now')
      WHERE session_id = ?
    `).run(latency_ms || 0, cost_usdc || 0, success ? 0 : 1, session_id);
  } catch {}
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Log a trace. Returns trace_id and live dashboard URL.
 */
export function pulseTrace(args = {}) {
  const {
    agent_id,
    action = "unknown",
    input,
    output,
    latency_ms = 0,
    success = true,
    error_msg,
    cost_usdc = 0,
    model_used,
    tool_calls = [],
    trace_id: existing_trace_id,
    session_id,
  } = args;

  if (!agent_id) return { error: "agent_id is required" };

  const id       = uuid();
  const trace_id = existing_trace_id || uuid();

  ensureSession(session_id, agent_id);

  try {
    db.prepare(`
      INSERT INTO pulse_traces (id, agent_id, trace_id, action, input_preview, output_preview, latency_ms, success, error_msg, cost_usdc, model_used, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, agent_id, trace_id, action,
      truncate(input, 200), truncate(output, 200),
      latency_ms, success ? 1 : 0,
      error_msg || null, cost_usdc,
      model_used || null,
      JSON.stringify(tool_calls || [])
    );
  } catch (e) {
    return { error: "Failed to log trace: " + e.message };
  }

  updateSession(session_id, latency_ms, cost_usdc, success);

  // Get quick session stats
  let sessionStats = {};
  try {
    const recentTraces = db.prepare(`
      SELECT COUNT(*) as cnt, AVG(latency_ms) as avg_lat, SUM(cost_usdc) as total_cost,
             SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
      FROM pulse_traces WHERE agent_id = ? AND timestamp > datetime('now', '-1 hour')
    `).get(agent_id);
    sessionStats = {
      traces_last_hour: recentTraces?.cnt || 1,
      avg_latency_ms:   Math.round(recentTraces?.avg_lat || latency_ms),
      cost_last_hour:   Number((recentTraces?.total_cost || cost_usdc).toFixed(6)),
      errors_last_hour: recentTraces?.errors || (success ? 0 : 1),
    };
  } catch {}

  return {
    trace_id,
    agent_id,
    action,
    success,
    latency_ms,
    dashboard_url:  dashboardUrl(agent_id),
    session_stats:  sessionStats,
    tip:            `Your live trace dashboard: ${dashboardUrl(agent_id)}`,
  };
}

/**
 * Get agent's pulse dashboard data.
 */
export function pulseGetDashboard(args = {}) {
  const { agent_id, period_hours = 24 } = args;

  if (!agent_id) return { error: "agent_id is required" };

  let stats = {};
  try {
    stats = db.prepare(`
      SELECT
        COUNT(*) as trace_count,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as error_rate,
        SUM(cost_usdc) as cost_total
      FROM pulse_traces
      WHERE agent_id = ? AND timestamp > datetime('now', '-' || ? || ' hours')
    `).get(agent_id, period_hours) || {};
  } catch (e) {
    return { error: "Dashboard fetch failed: " + e.message };
  }

  let topActions = [];
  try {
    topActions = db.prepare(`
      SELECT action, COUNT(*) as count, AVG(latency_ms) as avg_lat
      FROM pulse_traces
      WHERE agent_id = ? AND timestamp > datetime('now', '-' || ? || ' hours')
      GROUP BY action ORDER BY count DESC LIMIT 5
    `).all(agent_id, period_hours);
  } catch {}

  let recentErrors = [];
  try {
    recentErrors = db.prepare(`
      SELECT action, error_msg, timestamp FROM pulse_traces
      WHERE agent_id = ? AND success = 0
      ORDER BY timestamp DESC LIMIT 5
    `).all(agent_id);
  } catch {}

  // Performance trend
  let trend = "stable";
  try {
    const half = period_hours / 2;
    const recent = db.prepare(`SELECT AVG(latency_ms) as avg FROM pulse_traces WHERE agent_id = ? AND timestamp > datetime('now', '-' || ? || ' hours')`).get(agent_id, half);
    const older  = db.prepare(`SELECT AVG(latency_ms) as avg FROM pulse_traces WHERE agent_id = ? AND timestamp <= datetime('now', '-' || ? || ' hours') AND timestamp > datetime('now', '-' || ? || ' hours')`).get(agent_id, half, period_hours);
    if (recent?.avg && older?.avg) {
      const delta = ((recent.avg - older.avg) / older.avg) * 100;
      if (delta < -10) trend = "improving";
      else if (delta > 10) trend = "degrading";
    }
  } catch {}

  return {
    agent_id,
    period_hours,
    dashboard_url:      dashboardUrl(agent_id),
    trace_count:        stats.trace_count || 0,
    avg_latency_ms:     Math.round(stats.avg_latency || 0),
    success_rate:       Number(((stats.success_rate || 1) * 100).toFixed(1)),
    error_rate:         Number(((stats.error_rate || 0) * 100).toFixed(1)),
    cost_total_usdc:    Number((stats.cost_total || 0).toFixed(6)),
    top_actions:        topActions.map(a => ({ action: a.action, count: a.count, avg_latency_ms: Math.round(a.avg_lat) })),
    recent_errors:      recentErrors,
    performance_trend:  trend,
  };
}

/**
 * Set a performance alert threshold.
 */
export function pulseSetAlert(args = {}) {
  const { agent_id, alert_type, threshold } = args;

  if (!agent_id || !alert_type || threshold == null)
    return { error: "agent_id, alert_type, and threshold are required" };

  const validTypes = ["latency", "error_rate", "cost"];
  if (!validTypes.includes(alert_type))
    return { error: `alert_type must be one of: ${validTypes.join(", ")}` };

  let alert_id;
  try {
    const result = db.prepare(`
      INSERT INTO pulse_alerts (agent_id, alert_type, threshold, current_value)
      VALUES (?, ?, ?, 0)
    `).run(agent_id, alert_type, threshold);
    alert_id = result.lastInsertRowid;
  } catch (e) {
    return { error: "Failed to set alert: " + e.message };
  }

  const units = { latency: "ms", error_rate: "%", cost: "USDC/hr" };

  return {
    success:    true,
    alert_id,
    agent_id,
    alert_type,
    threshold,
    unit:       units[alert_type] || "",
    message:    `Alert set: notify when ${alert_type} exceeds ${threshold}${units[alert_type] || ""}`,
  };
}

/**
 * Get session summary.
 */
export function pulseGetSession(args = {}) {
  const { session_id, agent_id } = args;

  if (!session_id) return { error: "session_id is required" };

  let session;
  try {
    session = db.prepare(`
      SELECT * FROM pulse_sessions WHERE session_id = ? ${agent_id ? "AND agent_id = ?" : ""}
    `).get(session_id, ...(agent_id ? [agent_id] : []));
  } catch (e) {
    return { error: "Session fetch failed: " + e.message };
  }

  if (!session) return { found: false, session_id };

  const avgLatency = session.trace_count > 0
    ? Math.round(session.total_latency_ms / session.trace_count)
    : 0;

  return {
    session_id:       session.session_id,
    agent_id:         session.agent_id,
    start_time:       session.start_time,
    end_time:         session.end_time,
    trace_count:      session.trace_count,
    avg_latency_ms:   avgLatency,
    total_cost_usdc:  Number((session.total_cost_usdc || 0).toFixed(6)),
    error_count:      session.error_count,
    success_rate:     session.trace_count > 0
      ? Number((((session.trace_count - session.error_count) / session.trace_count) * 100).toFixed(1))
      : 100,
    dashboard_url:    dashboardUrl(session.agent_id),
  };
}

/**
 * Platform-wide stats.
 */
export function pulseStatus() {
  let stats = {};
  try {
    stats = db.prepare(`
      SELECT
        COUNT(DISTINCT agent_id) as agents_traced,
        COUNT(*) as total_traces,
        AVG(latency_ms) as avg_latency,
        SUM(cost_usdc) as total_cost,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) * 1.0 / MAX(COUNT(*), 1) as global_error_rate
      FROM pulse_traces
    `).get() || {};
  } catch {}

  return {
    service:           "HivePulse",
    status:            "operational",
    agents_traced:     stats.agents_traced || 0,
    total_traces:      stats.total_traces || 0,
    avg_latency_ms:    Math.round(stats.avg_latency || 0),
    total_cost_usdc:   Number((stats.total_cost || 0).toFixed(6)),
    global_error_rate: Number(((stats.global_error_rate || 0) * 100).toFixed(2)),
    pitch:             "Call pulse_trace on any action → live dashboard at hiveagentiq.com/pulse/{agent_id}. 3 lines of code. No setup.",
  };
}
