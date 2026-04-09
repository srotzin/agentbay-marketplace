/**
 * HiveAgent Agent Analytics (Phase 39)
 *
 * Business intelligence and performance analytics for autonomous agents.
 * Agents track ROI, revenue attribution, tool performance, and benchmark
 * themselves against platform averages.
 *
 * Core questions answered:
 * - Which tools generate the most revenue?
 * - What is my ROI vs cost of operation?
 * - How do I rank vs other agents on this platform?
 * - Where is my revenue coming from?
 *
 * Live mode: set ANALYTICS_API_KEY (optional — always works in sim mode)
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.ANALYTICS_API_KEY;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_events (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tool_name  TEXT,
    value_usdc REAL DEFAULT 0,
    metadata   TEXT DEFAULT '{}',
    timestamp  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_metrics (
    agent_id           TEXT PRIMARY KEY,
    total_revenue_usdc REAL DEFAULT 0,
    total_costs_usdc   REAL DEFAULT 0,
    net_profit_usdc    REAL DEFAULT 0,
    roi_pct            REAL DEFAULT 0,
    active_tools       TEXT DEFAULT '[]',
    top_tool           TEXT,
    best_workflow      TEXT,
    monthly_growth_pct REAL DEFAULT 0,
    last_updated       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS revenue_attribution (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    source      TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    period_date TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    metric      TEXT NOT NULL,
    value       REAL NOT NULL,
    percentile  REAL,
    vs_average  REAL,
    period      TEXT DEFAULT '30d',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_analytics_events_agent ON analytics_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_events_tool  ON analytics_events(tool_name);
  CREATE INDEX IF NOT EXISTS idx_revenue_attr_agent     ON revenue_attribution(agent_id);
  CREATE INDEX IF NOT EXISTS idx_perf_bench_agent       ON performance_benchmarks(agent_id);
`);
} catch(e) { console.warn("[DB Schema]", e.message); }

// ─── Revenue sources ──────────────────────────────────────────────────────────

const REVENUE_SOURCES = ["tool_fee", "job_completed", "yield_earned", "subscription", "outcome_payment"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodToSql(period = "30d") {
  const map = { "7d": 7, "30d": 30, "90d": 90 };
  const days = map[period] || 30;
  return `datetime('now', '-${days} days')`;
}

function calcPercentile(value, allValues) {
  if (!allValues.length) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below  = sorted.filter(v => v < value).length;
  return parseFloat(((below / sorted.length) * 100).toFixed(1));
}

function ensureMetrics(agent_id) {
  const existing = db.prepare("SELECT agent_id FROM agent_metrics WHERE agent_id = ?").get(agent_id);
  if (!existing) {
    db.prepare(`
      INSERT INTO agent_metrics (agent_id, total_revenue_usdc, total_costs_usdc, net_profit_usdc, roi_pct, active_tools)
      VALUES (?, 0, 0, 0, 0, '[]')
    `).run(agent_id);
  }
}

function recomputeMetrics(agent_id) {
  ensureMetrics(agent_id);

  const events = db.prepare("SELECT * FROM analytics_events WHERE agent_id = ?").all(agent_id);
  const revenue_events = events.filter(e => e.value_usdc > 0 && e.event_type !== "cost");
  const cost_events    = events.filter(e => e.event_type === "cost");

  const total_revenue = revenue_events.reduce((s, e) => s + e.value_usdc, 0);
  const total_costs   = cost_events.reduce((s, e) => s + Math.abs(e.value_usdc), 0);
  const net_profit    = total_revenue - total_costs;
  const roi_pct       = total_costs > 0 ? parseFloat(((net_profit / total_costs) * 100).toFixed(2)) : 0;

  // Top tool by revenue
  const tool_revenue = {};
  revenue_events.forEach(e => {
    if (e.tool_name) tool_revenue[e.tool_name] = (tool_revenue[e.tool_name] || 0) + e.value_usdc;
  });
  const top_tool = Object.entries(tool_revenue).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const active_tools = Object.keys(tool_revenue);

  // Monthly growth: compare last 30 days vs prior 30 days
  const last30  = db.prepare(`SELECT SUM(value_usdc) as v FROM analytics_events WHERE agent_id = ? AND event_type != 'cost' AND timestamp >= datetime('now','-30 days')`).get(agent_id).v || 0;
  const prior30 = db.prepare(`SELECT SUM(value_usdc) as v FROM analytics_events WHERE agent_id = ? AND event_type != 'cost' AND timestamp >= datetime('now','-60 days') AND timestamp < datetime('now','-30 days')`).get(agent_id).v || 0;
  const monthly_growth = prior30 > 0 ? parseFloat((((last30 - prior30) / prior30) * 100).toFixed(2)) : 0;

  db.prepare(`
    UPDATE agent_metrics
    SET total_revenue_usdc = ?, total_costs_usdc = ?, net_profit_usdc = ?, roi_pct = ?,
        active_tools = ?, top_tool = ?, monthly_growth_pct = ?, last_updated = datetime('now')
    WHERE agent_id = ?
  `).run(total_revenue, total_costs, net_profit, roi_pct, JSON.stringify(active_tools), top_tool, monthly_growth, agent_id);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * trackEvent — record an analytics event
 */
export function trackEvent({ agent_id, event_type, tool_name, value_usdc = 0, metadata = {} }) {
  if (!agent_id)    throw new Error("agent_id required");
  if (!event_type)  throw new Error("event_type required");

  const event_id = uuid();
  db.prepare(`
    INSERT INTO analytics_events (id, agent_id, event_type, tool_name, value_usdc, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(event_id, agent_id, event_type, tool_name || null, value_usdc, JSON.stringify(metadata));

  // Update attribution if it's a revenue event
  if (value_usdc > 0 && event_type !== "cost") {
    const source_map = {
      tool_call:         "tool_fee",
      job_completed:     "job_completed",
      yield_claim:       "yield_earned",
      subscription_fee:  "subscription",
      outcome_resolved:  "outcome_payment",
    };
    const source = source_map[event_type] || "tool_fee";
    db.prepare(`
      INSERT INTO revenue_attribution (id, agent_id, source, amount_usdc)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), agent_id, source, value_usdc);
  }

  // Recompute metrics
  recomputeMetrics(agent_id);

  return {
    success:    true,
    event_id,
    agent_id,
    event_type,
    tool_name:  tool_name || null,
    value_usdc,
    message:    "Event tracked",
  };
}

/**
 * getAgentAnalytics — full performance dashboard for an agent
 */
export function getAgentAnalytics({ agent_id, period = "30d" }) {
  if (!agent_id) throw new Error("agent_id required");
  ensureMetrics(agent_id);

  const since = periodToSql(period);
  const events = db.prepare(`SELECT * FROM analytics_events WHERE agent_id = ? AND timestamp >= ${since}`).all(agent_id);
  const metrics = db.prepare("SELECT * FROM agent_metrics WHERE agent_id = ?").get(agent_id);

  const revenue = events.filter(e => e.value_usdc > 0 && e.event_type !== "cost").reduce((s, e) => s + e.value_usdc, 0);
  const costs   = events.filter(e => e.event_type === "cost").reduce((s, e) => s + Math.abs(e.value_usdc), 0);
  const profit  = revenue - costs;
  const roi     = costs > 0 ? parseFloat(((profit / costs) * 100).toFixed(2)) : 0;

  // Tool breakdown
  const tool_revenue = {};
  const tool_calls   = {};
  events.forEach(e => {
    if (!e.tool_name) return;
    if (e.value_usdc > 0 && e.event_type !== "cost") {
      tool_revenue[e.tool_name] = (tool_revenue[e.tool_name] || 0) + e.value_usdc;
    }
    tool_calls[e.tool_name] = (tool_calls[e.tool_name] || 0) + 1;
  });

  const top_tools = Object.entries(tool_revenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, rev]) => ({
      tool_name: name,
      revenue_usdc: parseFloat(rev.toFixed(4)),
      calls: tool_calls[name] || 0,
      revenue_per_call: tool_calls[name] > 0 ? parseFloat((rev / tool_calls[name]).toFixed(4)) : 0,
    }));

  // Event type distribution
  const event_breakdown = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {});

  return {
    agent_id,
    period,
    performance: {
      revenue_usdc:   parseFloat(revenue.toFixed(2)),
      costs_usdc:     parseFloat(costs.toFixed(2)),
      profit_usdc:    parseFloat(profit.toFixed(2)),
      roi_pct:        roi,
      margin_pct:     revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0,
    },
    lifetime: {
      total_revenue_usdc: parseFloat((metrics?.total_revenue_usdc || 0).toFixed(2)),
      total_costs_usdc:   parseFloat((metrics?.total_costs_usdc || 0).toFixed(2)),
      net_profit_usdc:    parseFloat((metrics?.net_profit_usdc || 0).toFixed(2)),
      roi_pct:            metrics?.roi_pct || 0,
      monthly_growth_pct: metrics?.monthly_growth_pct || 0,
    },
    top_tools,
    event_count: events.length,
    event_breakdown,
    total_events_lifetime: db.prepare("SELECT COUNT(*) as c FROM analytics_events WHERE agent_id = ?").get(agent_id).c,
  };
}

/**
 * getRevenueAttribution — revenue breakdown by source
 */
export function getRevenueAttribution({ agent_id, period = "30d" }) {
  if (!agent_id) throw new Error("agent_id required");

  const since = periodToSql(period);
  const rows  = db.prepare(`
    SELECT source, SUM(amount_usdc) as total
    FROM revenue_attribution
    WHERE agent_id = ? AND period_date >= date('now', '-${parseInt(period) || 30} days')
    GROUP BY source
  `).all(agent_id);

  // Fallback: query events if no attribution rows
  const attribution_rows = rows.length > 0 ? rows : REVENUE_SOURCES.map(s => ({ source: s, total: 0 }));
  const grand_total = attribution_rows.reduce((s, r) => s + (r.total || 0), 0);

  const pie = attribution_rows
    .filter(r => (r.total || 0) > 0)
    .sort((a, b) => b.total - a.total)
    .map(r => ({
      source: r.source,
      amount_usdc: parseFloat((r.total || 0).toFixed(4)),
      pct: grand_total > 0 ? parseFloat((((r.total || 0) / grand_total) * 100).toFixed(1)) : 0,
    }));

  return {
    agent_id,
    period,
    total_revenue_usdc: parseFloat(grand_total.toFixed(2)),
    sources: pie,
    chart_data: {
      labels: pie.map(p => p.source),
      values: pie.map(p => p.pct),
      amounts: pie.map(p => p.amount_usdc),
    },
    top_source: pie[0]?.source || "none",
    note: "Revenue attribution is by event source type. Diversify sources to reduce concentration risk.",
  };
}

/**
 * getBenchmarks — compare agent to platform average
 */
export function getBenchmarks({ agent_id }) {
  if (!agent_id) throw new Error("agent_id required");
  ensureMetrics(agent_id);

  const my_metrics  = db.prepare("SELECT * FROM agent_metrics WHERE agent_id = ?").get(agent_id);
  const all_metrics = db.prepare("SELECT * FROM agent_metrics").all();

  const all_revenue = all_metrics.map(m => m.total_revenue_usdc);
  const all_profit  = all_metrics.map(m => m.net_profit_usdc);
  const all_roi     = all_metrics.map(m => m.roi_pct);
  const all_growth  = all_metrics.map(m => m.monthly_growth_pct);

  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const metrics_list = [
    {
      metric: "total_revenue_usdc",
      value:  my_metrics?.total_revenue_usdc || 0,
      average: parseFloat(avg(all_revenue).toFixed(2)),
      percentile: calcPercentile(my_metrics?.total_revenue_usdc || 0, all_revenue),
    },
    {
      metric: "net_profit_usdc",
      value:  my_metrics?.net_profit_usdc || 0,
      average: parseFloat(avg(all_profit).toFixed(2)),
      percentile: calcPercentile(my_metrics?.net_profit_usdc || 0, all_profit),
    },
    {
      metric: "roi_pct",
      value:  my_metrics?.roi_pct || 0,
      average: parseFloat(avg(all_roi).toFixed(2)),
      percentile: calcPercentile(my_metrics?.roi_pct || 0, all_roi),
    },
    {
      metric: "monthly_growth_pct",
      value:  my_metrics?.monthly_growth_pct || 0,
      average: parseFloat(avg(all_growth).toFixed(2)),
      percentile: calcPercentile(my_metrics?.monthly_growth_pct || 0, all_growth),
    },
  ].map(m => ({
    ...m,
    vs_average: parseFloat((m.value - m.average).toFixed(2)),
    vs_average_pct: m.average !== 0 ? parseFloat((((m.value - m.average) / Math.abs(m.average)) * 100).toFixed(1)) : 0,
    status: m.percentile >= 75 ? "top_quartile" : m.percentile >= 50 ? "above_average" : m.percentile >= 25 ? "below_average" : "bottom_quartile",
  }));

  // Store benchmarks
  const insertBench = db.prepare(`
    INSERT INTO performance_benchmarks (id, agent_id, metric, value, percentile, vs_average)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction(() => {
    for (const m of metrics_list) {
      insertBench.run(uuid(), agent_id, m.metric, m.value, m.percentile, m.vs_average);
    }
  });
  insertMany();

  const overall_percentile = parseFloat((metrics_list.reduce((s, m) => s + m.percentile, 0) / metrics_list.length).toFixed(1));

  return {
    agent_id,
    overall_percentile,
    overall_rank: overall_percentile >= 75 ? "Top Performer" : overall_percentile >= 50 ? "Above Average" : "Below Average",
    agents_on_platform: all_metrics.length,
    benchmarks: metrics_list,
    recommendation: metrics_list.find(m => m.percentile < 50)?.metric
      ? `Focus on improving ${metrics_list.filter(m => m.percentile < 50).map(m => m.metric).join(", ")}`
      : "All metrics above platform average — great work!",
  };
}

/**
 * getTopPerformers — top agents by any metric
 */
export function getTopPerformers({ metric = "revenue", limit = 10 } = {}) {
  const metric_col = {
    revenue:    "total_revenue_usdc",
    profit:     "net_profit_usdc",
    roi:        "roi_pct",
    tool_calls: "total_revenue_usdc", // fallback — use events for this
  };
  const col = metric_col[metric] || "total_revenue_usdc";

  const rows = db.prepare(`
    SELECT agent_id, total_revenue_usdc, net_profit_usdc, roi_pct, top_tool, monthly_growth_pct
    FROM agent_metrics
    ORDER BY ${col} DESC
    LIMIT ?
  `).all(Math.min(limit, 50));

  return {
    metric,
    sorted_by: col,
    top_count: rows.length,
    leaders:   rows.map((r, i) => ({ rank: i + 1, ...r })),
  };
}

/**
 * getAnalyticsDashboard — platform-wide analytics overview
 */
export function getAnalyticsDashboard() {
  const all_metrics = db.prepare("SELECT * FROM agent_metrics").all();
  const all_events  = db.prepare("SELECT * FROM analytics_events").all();
  const all_attr    = db.prepare("SELECT source, SUM(amount_usdc) as total FROM revenue_attribution GROUP BY source").all();

  const total_revenue = all_metrics.reduce((s, m) => s + m.total_revenue_usdc, 0);
  const total_profit  = all_metrics.reduce((s, m) => s + m.net_profit_usdc, 0);
  const avg_roi       = all_metrics.length ? all_metrics.reduce((s, m) => s + m.roi_pct, 0) / all_metrics.length : 0;

  // Top tools across all agents
  const tool_totals = {};
  all_events.forEach(e => {
    if (e.tool_name && e.value_usdc > 0 && e.event_type !== "cost") {
      tool_totals[e.tool_name] = (tool_totals[e.tool_name] || 0) + e.value_usdc;
    }
  });
  const top_tools = Object.entries(tool_totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, rev]) => ({ tool_name: name, total_revenue_usdc: parseFloat(rev.toFixed(2)) }));

  return {
    platform_summary: {
      total_agents:         all_metrics.length,
      total_revenue_usdc:   parseFloat(total_revenue.toFixed(2)),
      total_profit_usdc:    parseFloat(total_profit.toFixed(2)),
      average_roi_pct:      parseFloat(avg_roi.toFixed(2)),
      total_events_logged:  all_events.length,
    },
    top_tools_by_revenue: top_tools,
    revenue_by_source: all_attr.sort((a, b) => b.total - a.total).map(r => ({
      source: r.source,
      total_usdc: parseFloat(r.total.toFixed(2)),
    })),
    growth: {
      agents_with_positive_roi: all_metrics.filter(m => m.roi_pct > 0).length,
      agents_growing: all_metrics.filter(m => m.monthly_growth_pct > 0).length,
      top_growth_agent: all_metrics.sort((a, b) => b.monthly_growth_pct - a.monthly_growth_pct)[0]?.agent_id || null,
    },
    live_mode: LIVE_MODE,
  };
}
