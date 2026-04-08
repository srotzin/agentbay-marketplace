/**
 * HiveAgent Agentic Economy Intelligence
 *
 * Inspired by Dynamic (Apr 8, 2026):
 * "Algorithmic trading collapsed the speed and cost of execution to near zero,
 *  but only in financial markets. Agentic AI applies the same logic to every
 *  economic activity."
 *
 * This module tracks the agent economy: market velocity, cost-of-execution
 * benchmarks, agent productivity metrics, and economic activity mapping.
 *
 * Think of it as Bloomberg Terminal for the agent economy.
 *
 * Use cases:
 *   - What does it cost an agent to execute a legal document review? ($0.40)
 *   - What's the average settlement latency across all tool categories?
 *   - Which verticals have the fastest cost compression?
 *   - How does agent-executed commerce compare to human-executed?
 *   - Track your agent's economic output vs the network average
 *
 * Revenue: $5/mo subscription for full agentic economy dashboard.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS economy_benchmarks (
    id              TEXT PRIMARY KEY,
    vertical        TEXT NOT NULL,
    task_type       TEXT NOT NULL,
    human_cost_usd  REAL NOT NULL,
    agent_cost_usd  REAL NOT NULL,
    cost_reduction_pct REAL NOT NULL,
    human_time_sec  REAL NOT NULL,
    agent_time_sec  REAL NOT NULL,
    speed_multiplier REAL NOT NULL,
    category        TEXT NOT NULL,   -- 'legal', 'finance', 'insurance', 'healthcare', etc.
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS economy_subscriptions (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL UNIQUE,
    plan        TEXT DEFAULT 'standard',
    enrolled_at TEXT DEFAULT (datetime('now')),
    expires_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS economy_snapshots (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    vertical    TEXT,
    tools_called INTEGER DEFAULT 0,
    total_spent_usd REAL DEFAULT 0,
    total_value_usd REAL DEFAULT 0,   -- estimated value of work done
    cost_vs_human_savings_usd REAL DEFAULT 0,
    snapshot_date TEXT DEFAULT (date('now'))
  );
`);

// ─── Seed Benchmarks ─────────────────────────────────────────────────────────

{
  const n = db.prepare("SELECT COUNT(*) AS n FROM economy_benchmarks").get().n;
  if (n === 0) {
    const benchmarks = [
      // Legal
      { vertical: "legal", task_type: "Contract review (standard NDA)", category: "legal", human_cost_usd: 350, agent_cost_usd: 0.40, human_time_sec: 3600, agent_time_sec: 8 },
      { vertical: "legal", task_type: "Demand letter generation", category: "legal", human_cost_usd: 500, agent_cost_usd: 0.25, human_time_sec: 5400, agent_time_sec: 5 },
      { vertical: "legal", task_type: "Case law search", category: "legal", human_cost_usd: 200, agent_cost_usd: 0.10, human_time_sec: 1800, agent_time_sec: 2 },
      // Insurance
      { vertical: "insurance", task_type: "Claim intake & assessment", category: "insurance", human_cost_usd: 85, agent_cost_usd: 0.15, human_time_sec: 1200, agent_time_sec: 3 },
      { vertical: "insurance", task_type: "Adjuster report generation", category: "insurance", human_cost_usd: 150, agent_cost_usd: 0.20, human_time_sec: 2700, agent_time_sec: 6 },
      { vertical: "insurance", task_type: "Subrogation analysis", category: "insurance", human_cost_usd: 250, agent_cost_usd: 0.30, human_time_sec: 3600, agent_time_sec: 4 },
      // Healthcare
      { vertical: "healthcare", task_type: "Prior authorization", category: "healthcare", human_cost_usd: 45, agent_cost_usd: 0.12, human_time_sec: 900, agent_time_sec: 3 },
      { vertical: "healthcare", task_type: "Clinical note generation", category: "healthcare", human_cost_usd: 60, agent_cost_usd: 0.08, human_time_sec: 720, agent_time_sec: 4 },
      { vertical: "healthcare", task_type: "Lab result interpretation", category: "healthcare", human_cost_usd: 95, agent_cost_usd: 0.10, human_time_sec: 1800, agent_time_sec: 2 },
      // Finance
      { vertical: "finance", task_type: "KYC/AML screening", category: "finance", human_cost_usd: 25, agent_cost_usd: 0.05, human_time_sec: 600, agent_time_sec: 1 },
      { vertical: "finance", task_type: "Cross-border payment routing", category: "finance", human_cost_usd: 35, agent_cost_usd: 0.08, human_time_sec: 86400, agent_time_sec: 30 },
      { vertical: "finance", task_type: "Financial statement analysis", category: "finance", human_cost_usd: 400, agent_cost_usd: 0.50, human_time_sec: 7200, agent_time_sec: 10 },
      // Construction
      { vertical: "construction", task_type: "Material takeoff estimate", category: "construction", human_cost_usd: 500, agent_cost_usd: 0.35, human_time_sec: 10800, agent_time_sec: 8 },
      { vertical: "construction", task_type: "Permit status lookup", category: "construction", human_cost_usd: 15, agent_cost_usd: 0.05, human_time_sec: 300, agent_time_sec: 1 },
      { vertical: "construction", task_type: "Zoning research", category: "construction", human_cost_usd: 75, agent_cost_usd: 0.08, human_time_sec: 1800, agent_time_sec: 2 },
      // Trade & Customs
      { vertical: "trade", task_type: "HS tariff classification", category: "trade", human_cost_usd: 120, agent_cost_usd: 0.10, human_time_sec: 1800, agent_time_sec: 2 },
      { vertical: "trade", task_type: "Sanctions screening", category: "trade", human_cost_usd: 50, agent_cost_usd: 0.05, human_time_sec: 900, agent_time_sec: 1 },
      { vertical: "trade", task_type: "Customs docs generation", category: "trade", human_cost_usd: 200, agent_cost_usd: 0.15, human_time_sec: 3600, agent_time_sec: 5 },
      // Real Estate
      { vertical: "real_estate", task_type: "Property valuation", category: "real_estate", human_cost_usd: 400, agent_cost_usd: 0.25, human_time_sec: 7200, agent_time_sec: 5 },
      { vertical: "real_estate", task_type: "Title search", category: "real_estate", human_cost_usd: 200, agent_cost_usd: 0.15, human_time_sec: 3600, agent_time_sec: 4 },
    ];

    const ins = db.prepare(`
      INSERT INTO economy_benchmarks (id, vertical, task_type, category, human_cost_usd, agent_cost_usd, cost_reduction_pct, human_time_sec, agent_time_sec, speed_multiplier)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    const tx = db.transaction(rows => {
      for (const r of rows) {
        const cost_reduction = parseFloat(((1 - r.agent_cost_usd / r.human_cost_usd) * 100).toFixed(1));
        const speed_mult     = parseFloat((r.human_time_sec / r.agent_time_sec).toFixed(0));
        ins.run(uuid(), r.vertical, r.task_type, r.category, r.human_cost_usd, r.agent_cost_usd, cost_reduction, r.human_time_sec, r.agent_time_sec, speed_mult);
      }
    });
    tx(benchmarks);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Get cost-of-execution benchmarks: agent vs human across verticals.
 * The core "algorithmic trading was just the beginning" data.
 */
export function getEconomyBenchmarks({ vertical, category, limit }) {
  let sql    = "SELECT * FROM economy_benchmarks WHERE 1=1";
  const params = [];
  if (vertical) { sql += " AND vertical = ?"; params.push(vertical); }
  if (category) { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY cost_reduction_pct DESC LIMIT ?";
  params.push(limit || 20);

  const rows = db.prepare(sql).all(...params);

  const avgCostReduction = rows.length
    ? parseFloat((rows.reduce((s, r) => s + r.cost_reduction_pct, 0) / rows.length).toFixed(1))
    : 0;
  const avgSpeedMult = rows.length
    ? parseFloat((rows.reduce((s, r) => s + r.speed_multiplier, 0) / rows.length).toFixed(0))
    : 0;

  return {
    benchmarks: rows,
    count: rows.length,
    summary: {
      avg_cost_reduction_pct: avgCostReduction,
      avg_speed_multiplier:   avgSpeedMult,
      thesis: "Algorithmic trading collapsed execution cost to near zero in finance. Agentic AI does the same for every economic activity. (Dynamic, Apr 2026)",
    },
    filter: { vertical: vertical || "all", category: category || "all" },
  };
}

/**
 * Compare the economic output of agent execution vs human for a specific task.
 */
export function compareAgentVsHuman({ task_type, vertical }) {
  if (!task_type && !vertical) throw new Error("task_type or vertical is required.");
  let sql = "SELECT * FROM economy_benchmarks WHERE 1=1";
  const params = [];
  if (task_type) { sql += " AND task_type LIKE ?"; params.push(`%${task_type}%`); }
  if (vertical)  { sql += " AND vertical = ?"; params.push(vertical); }
  sql += " LIMIT 5";

  const rows = db.prepare(sql).all(...params);
  if (!rows.length) return { found: false, message: `No benchmarks found for "${task_type || vertical}".` };

  return {
    comparisons: rows.map(r => ({
      task: r.task_type,
      vertical: r.vertical,
      human: { cost_usd: r.human_cost_usd, time_sec: r.human_time_sec, time_human: `${(r.human_time_sec / 3600).toFixed(1)} hours` },
      agent: { cost_usd: r.agent_cost_usd, time_sec: r.agent_time_sec, time_human: `${r.agent_time_sec}s` },
      savings: {
        cost_reduction_pct: r.cost_reduction_pct,
        cost_saved_usd: parseFloat((r.human_cost_usd - r.agent_cost_usd).toFixed(2)),
        speed_multiplier: r.speed_multiplier,
        roi_if_1000_tasks: parseFloat(((r.human_cost_usd - r.agent_cost_usd) * 1000).toFixed(0)),
      },
    })),
    source: "HiveAgent Agentic Economy Index — inspired by Dynamic agentic finance report (Apr 2026)",
  };
}

/**
 * Get the full agentic economy market overview.
 */
export function getAgenticEconomyOverview() {
  const all = db.prepare("SELECT * FROM economy_benchmarks").all();
  if (!all.length) return { error: "No benchmark data." };

  const totalHumanCost = all.reduce((s, r) => s + r.human_cost_usd, 0);
  const totalAgentCost = all.reduce((s, r) => s + r.agent_cost_usd, 0);
  const avgCostRedux   = all.reduce((s, r) => s + r.cost_reduction_pct, 0) / all.length;
  const avgSpeedMult   = all.reduce((s, r) => s + r.speed_multiplier, 0) / all.length;
  const maxSavings     = all.reduce((a, b) => a.cost_reduction_pct > b.cost_reduction_pct ? a : b);

  const byVertical = {};
  for (const r of all) {
    if (!byVertical[r.vertical]) byVertical[r.vertical] = { tasks: 0, avg_cost_reduction: 0, avg_speed: 0 };
    byVertical[r.vertical].tasks++;
    byVertical[r.vertical].avg_cost_reduction += r.cost_reduction_pct;
    byVertical[r.vertical].avg_speed += r.speed_multiplier;
  }
  for (const v of Object.keys(byVertical)) {
    const d = byVertical[v];
    d.avg_cost_reduction = parseFloat((d.avg_cost_reduction / d.tasks).toFixed(1));
    d.avg_speed = parseFloat((d.avg_speed / d.tasks).toFixed(0));
  }

  return {
    overview: {
      tasks_benchmarked: all.length,
      avg_cost_reduction_pct: parseFloat(avgCostRedux.toFixed(1)),
      avg_speed_multiplier:   parseFloat(avgSpeedMult.toFixed(0)),
      most_disruptable_task:  { task: maxSavings.task_type, cost_reduction: maxSavings.cost_reduction_pct },
      total_addressable_savings_per_1000_tasks: parseFloat((totalHumanCost - totalAgentCost).toFixed(0)),
    },
    by_vertical: byVertical,
    thesis: {
      quote: "Algorithmic trading collapsed the speed and cost of execution to near zero, but only in financial markets. Agentic AI applies the same logic to every economic activity.",
      source: "Dynamic (@dynamic_xyz), Apr 8, 2026",
      hiveagent_position: "HiveAgent is the single endpoint through which agentic AI executes across all 40+ verticals. One MCP server. The Agentzon.",
    },
  };
}

/**
 * Subscribe an agent to the Agentic Economy dashboard ($5/mo).
 */
export function subscribeEconomyDashboard({ agent_id, plan }) {
  if (!agent_id) throw new Error("agent_id is required.");
  const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
  db.prepare("INSERT OR REPLACE INTO economy_subscriptions (id, agent_id, plan, expires_at) VALUES (?,?,?,?)")
    .run(uuid(), agent_id, plan || "standard", expires);
  return {
    agent_id,
    plan: plan || "standard",
    expires_at: expires,
    cost_usd_per_month: 5.00,
    includes: ["full benchmarks", "real-time economy index", "agent vs human comparisons", "vertical cost compression charts"],
    message: "Subscribed to Agentic Economy dashboard.",
  };
}
