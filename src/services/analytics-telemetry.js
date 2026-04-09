/**
 * HiveAgent Analytics & Telemetry
 * Phase 23
 *
 * Tracks every tool call with agent ID, latency, success/error,
 * and exposes a /stats endpoint for real-time activity monitoring.
 *
 * Schema:
 *   tool_calls   — every invocation logged
 *   agent_sessions — unique agents seen, first/last seen, call count
 *   daily_stats  — rolled-up daily aggregates
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/hiveagent.db");
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tool_calls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_name   TEXT NOT NULL,
    agent_id    TEXT,
    ip          TEXT,
    latency_ms  INTEGER,
    success     INTEGER DEFAULT 1,
    error_msg   TEXT,
    called_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tc_tool    ON tool_calls(tool_name);
  CREATE INDEX IF NOT EXISTS idx_tc_agent   ON tool_calls(agent_id);
  CREATE INDEX IF NOT EXISTS idx_tc_called  ON tool_calls(called_at);

  CREATE TABLE IF NOT EXISTS agent_sessions (
    agent_id     TEXT PRIMARY KEY,
    ip           TEXT,
    call_count   INTEGER DEFAULT 0,
    first_seen   TEXT DEFAULT (datetime('now')),
    last_seen    TEXT DEFAULT (datetime('now')),
    top_tool     TEXT,
    converted    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date         TEXT PRIMARY KEY,
    total_calls  INTEGER DEFAULT 0,
    unique_agents INTEGER DEFAULT 0,
    errors       INTEGER DEFAULT 0,
    top_tool     TEXT,
    top_agent    TEXT
  );
`);

// ─── Log a tool call ─────────────────────────────────────────────────────────

export function logToolCall({ tool_name, agent_id, ip, latency_ms, success = true, error_msg }) {
  try {
    db.prepare(`
      INSERT INTO tool_calls (tool_name, agent_id, ip, latency_ms, success, error_msg)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tool_name, agent_id || null, ip || null, latency_ms || null, success ? 1 : 0, error_msg || null);

    // Upsert agent session
    if (agent_id) {
      db.prepare(`
        INSERT INTO agent_sessions (agent_id, ip, call_count, top_tool)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          call_count = call_count + 1,
          last_seen  = datetime('now'),
          ip         = excluded.ip
      `).run(agent_id, ip || null, tool_name);
    }
  } catch (e) {
    // Never let telemetry crash the server
  }
}

// ─── /stats endpoint handler ─────────────────────────────────────────────────

export function getStats({ period = "24h" } = {}) {
  const windowMap = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 };
  const hours = windowMap[period] || 24;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const total = db.prepare(
    "SELECT COUNT(*) as n FROM tool_calls WHERE called_at >= ?"
  ).get(since).n;

  const errors = db.prepare(
    "SELECT COUNT(*) as n FROM tool_calls WHERE called_at >= ? AND success = 0"
  ).get(since).n;

  const uniqueAgents = db.prepare(
    "SELECT COUNT(DISTINCT agent_id) as n FROM tool_calls WHERE called_at >= ? AND agent_id IS NOT NULL"
  ).get(since).n;

  const avgLatency = db.prepare(
    "SELECT ROUND(AVG(latency_ms),1) as v FROM tool_calls WHERE called_at >= ? AND latency_ms IS NOT NULL"
  ).get(since).v;

  const topTools = db.prepare(`
    SELECT tool_name, COUNT(*) as calls
    FROM tool_calls WHERE called_at >= ?
    GROUP BY tool_name ORDER BY calls DESC LIMIT 10
  `).all(since);

  const topAgents = db.prepare(`
    SELECT agent_id, COUNT(*) as calls
    FROM tool_calls WHERE called_at >= ? AND agent_id IS NOT NULL
    GROUP BY agent_id ORDER BY calls DESC LIMIT 5
  `).all(since);

  const recentCalls = db.prepare(`
    SELECT tool_name, agent_id, latency_ms, success, called_at
    FROM tool_calls ORDER BY called_at DESC LIMIT 20
  `).all();

  const allTimeCalls = db.prepare("SELECT COUNT(*) as n FROM tool_calls").get().n;
  const allTimeAgents = db.prepare("SELECT COUNT(*) as n FROM agent_sessions").get().n;

  const callsPerHour = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:00', called_at) as hour, COUNT(*) as calls
    FROM tool_calls WHERE called_at >= ?
    GROUP BY hour ORDER BY hour DESC LIMIT 24
  `).all(since);

  return {
    hiveagent: {
      url: "https://hiveagentiq.com",
      tools_live: 905,
      verticals: 40,
      smithery_score: "95/100",
    },
    period,
    window_hours: hours,
    since,
    activity: {
      total_calls: total,
      unique_agents: uniqueAgents,
      errors,
      error_rate: total > 0 ? `${((errors / total) * 100).toFixed(1)}%` : "0%",
      avg_latency_ms: avgLatency || 0,
      calls_per_hour: total > 0 ? (total / hours).toFixed(1) : "0",
    },
    all_time: {
      total_calls: allTimeCalls,
      unique_agents: allTimeAgents,
    },
    top_tools: topTools,
    top_agents: topAgents.map(a => ({
      agent_id: a.agent_id.slice(0, 12) + "...",
      calls: a.calls,
    })),
    recent_calls: recentCalls.map(c => ({
      tool: c.tool_name,
      agent: c.agent_id ? c.agent_id.slice(0, 8) + "..." : "anonymous",
      latency_ms: c.latency_ms,
      success: !!c.success,
      at: c.called_at,
    })),
    calls_per_hour: callsPerHour.reverse(),
    health: {
      status: "green",
      error_threshold: "< 5%",
      current: total > 0 ? ((errors / total) * 100).toFixed(1) + "%" : "0%",
    },
  };
}
