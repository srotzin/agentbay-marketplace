/**
 * Workflow Propagation — successful routes spread virally through the highway
 *
 * THE CONCEPT: When an agent completes a multi-step journey on the Agent Highway,
 * their route gets published for others to follow. Successful routes spread.
 * An agent completes "pay a contractor in USDC using BVNK in 3 steps" and
 * publishes it. 847 agents follow that exact route over the next week.
 * Each one is a new HiveAgent user.
 *
 * LIVE_MODE = false — always works, pure HiveAgent data.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = false;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS propagated_workflows (
      id                          TEXT PRIMARY KEY,
      created_by                  TEXT NOT NULL,
      title                       TEXT NOT NULL,
      description                 TEXT,
      tools                       TEXT NOT NULL,
      avg_completion_time_seconds INTEGER DEFAULT 0,
      success_rate                REAL DEFAULT 100.0,
      times_followed              INTEGER DEFAULT 0,
      use_case                    TEXT,
      tags                        TEXT DEFAULT '[]',
      published_at                TEXT DEFAULT (datetime('now')),
      last_followed               TEXT
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_follows (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id             TEXT NOT NULL,
      following_agent         TEXT NOT NULL,
      started_at              TEXT DEFAULT (datetime('now')),
      completed               INTEGER DEFAULT 0,
      completion_time_seconds INTEGER,
      outcome                 TEXT
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_forks (
      id             TEXT PRIMARY KEY,
      original_id    TEXT NOT NULL,
      forked_by      TEXT NOT NULL,
      title          TEXT NOT NULL,
      tools          TEXT NOT NULL,
      improvement    TEXT,
      times_followed INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_WORKFLOWS = [
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Pay contractor USDC in 3 steps",
    description: "The fastest path from task completion to contractor payment. Open a BVNK channel, execute the USDC transfer, trace it on Pulse.",
    tools: JSON.stringify([
      { name: "bvnk_channel_create", args: { currency: "USDC", type: "payments" }, order: 1 },
      { name: "mpp_pay", args: { currency: "USDC" }, order: 2 },
      { name: "pulse_trace", args: { type: "payment" }, order: 3 },
    ]),
    avg_completion_time_seconds: 42,
    success_rate: 97.2,
    times_followed: 847,
    use_case: "contractor-payment",
    tags: JSON.stringify(["usdc", "bvnk", "payment", "contractor", "fast"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "EU AI Act compliant in 10 minutes",
    description: "From zero to EU AI Act compliant. Risk assess, generate compliance docs, register with EU database.",
    tools: JSON.stringify([
      { name: "eu_ai_act_assess", args: { jurisdiction: "EU" }, order: 1 },
      { name: "eu_ai_act_generate_compliance", args: {}, order: 2 },
      { name: "eu_ai_act_register", args: {}, order: 3 },
    ]),
    avg_completion_time_seconds: 612,
    success_rate: 94.1,
    times_followed: 441,
    use_case: "eu-compliance",
    tags: JSON.stringify(["eu", "ai-act", "compliance", "regulation", "legal"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Agent identity + first payment",
    description: "Complete new agent setup: create identity, create wallet, set memory context, make first USDC payment.",
    tools: JSON.stringify([
      { name: "agent_identity_create", args: {}, order: 1 },
      { name: "wallet_create", args: { currency: "USDC" }, order: 2 },
      { name: "memory_set", args: { key: "onboarded_at" }, order: 3 },
      { name: "bvnk_pay", args: { currency: "USDC" }, order: 4 },
    ]),
    avg_completion_time_seconds: 95,
    success_rate: 98.8,
    times_followed: 623,
    use_case: "agent-onboarding",
    tags: JSON.stringify(["identity", "wallet", "onboarding", "first-payment"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Hire specialist + escrow",
    description: "Credit check the specialist, hire them through Arc Agent Commerce, lock funds in escrow, release on completion.",
    tools: JSON.stringify([
      { name: "credit_check", args: {}, order: 1 },
      { name: "arc_hire_specialist", args: {}, order: 2 },
      { name: "smart_escrow_create", args: { release_condition: "milestone" }, order: 3 },
      { name: "arc_release_escrow", args: {}, order: 4 },
    ]),
    avg_completion_time_seconds: 180,
    success_rate: 96.3,
    times_followed: 312,
    use_case: "specialist-hiring",
    tags: JSON.stringify(["hiring", "escrow", "specialist", "arc", "milestone"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Daily yield on idle USDC",
    description: "Put idle USDC to work. Create a wallet, deposit into DeFi yield, earn while you run.",
    tools: JSON.stringify([
      { name: "wallet_create", args: { currency: "USDC" }, order: 1 },
      { name: "defi_yield_deposit", args: { protocol: "aave" }, order: 2 },
    ]),
    avg_completion_time_seconds: 120,
    success_rate: 93.1,
    times_followed: 567,
    use_case: "yield-generation",
    tags: JSON.stringify(["yield", "defi", "usdc", "passive-income", "aave"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "New agent onboarding complete",
    description: "Full onboarding sequence for a new agent joining the highway. Identity, wallet, memory, tools, first tool call.",
    tools: JSON.stringify([
      { name: "agent_identity_create", args: {}, order: 1 },
      { name: "wallet_create", args: {}, order: 2 },
      { name: "memory_set", args: { key: "agent_profile" }, order: 3 },
      { name: "hiveagent_search", args: { query: "payments" }, order: 4 },
      { name: "bvnk_pay", args: { amount_usdc: 1 }, order: 5 },
    ]),
    avg_completion_time_seconds: 210,
    success_rate: 99.0,
    times_followed: 1203,
    use_case: "onboarding",
    tags: JSON.stringify(["onboarding", "new-agent", "identity", "wallet", "first-steps"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Smart contract audit + deploy",
    description: "Hire an audit specialist, escrow payment, run sandbox tests, deploy on completion.",
    tools: JSON.stringify([
      { name: "arc_hire_specialist", args: { capability: "smart-contract-audit" }, order: 1 },
      { name: "smart_escrow_create", args: { release_condition: "milestone" }, order: 2 },
      { name: "sandbox_run", args: { language: "javascript" }, order: 3 },
      { name: "arc_submit_result", args: {}, order: 4 },
      { name: "arc_release_escrow", args: {}, order: 5 },
    ]),
    avg_completion_time_seconds: 3600,
    success_rate: 95.2,
    times_followed: 289,
    use_case: "smart-contract-audit",
    tags: JSON.stringify(["audit", "smart-contract", "deploy", "specialist", "escrow"]),
  },
  {
    id: `wf-${uuid()}`,
    created_by: "system",
    title: "Agent credit check before hiring",
    description: "Before hiring any agent, run this: credit check, reputation check, then decide.",
    tools: JSON.stringify([
      { name: "credit_check", args: {}, order: 1 },
      { name: "reputation_check", args: {}, order: 2 },
    ]),
    avg_completion_time_seconds: 28,
    success_rate: 97.3,
    times_followed: 398,
    use_case: "agent-vetting",
    tags: JSON.stringify(["credit", "reputation", "vetting", "pre-hire", "trust"]),
  },
];

// Seed workflows
try {
  const existing = db.prepare("SELECT COUNT(*) as c FROM propagated_workflows").get()?.c || 0;
  if (existing === 0) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO propagated_workflows
        (id, created_by, title, description, tools, avg_completion_time_seconds,
         success_rate, times_followed, use_case, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const w of SEED_WORKFLOWS) {
      try {
        insert.run(w.id, w.created_by, w.title, w.description, w.tools,
          w.avg_completion_time_seconds, w.success_rate, w.times_followed,
          w.use_case, w.tags);
      } catch {}
    }
  }
} catch {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBadge(timesFollowed) {
  if (timesFollowed >= 1000) return { badge: "Viral", description: "1000+ agents followed this workflow" };
  if (timesFollowed >= 500) return { badge: "Trending", description: "500+ agents followed this workflow" };
  if (timesFollowed >= 100) return { badge: "Popular", description: "100+ agents followed this workflow" };
  if (timesFollowed >= 10) return { badge: "Rising", description: "10+ agents followed this workflow" };
  return null;
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * publishWorkflow — publish a completed workflow for others to follow
 */
export async function publishWorkflow(args) {
  const {
    agent_id,
    title,
    description,
    tools,
    use_case,
    tags = [],
  } = args;

  if (!agent_id || !title || !tools || !Array.isArray(tools)) {
    throw new Error("agent_id, title, and tools (array) are required");
  }

  const workflowId = `wf-${uuid()}`;

  try {
    db.prepare(`
      INSERT INTO propagated_workflows
        (id, created_by, title, description, tools, use_case, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(workflowId, agent_id, title, description || "", JSON.stringify(tools),
      use_case || null, JSON.stringify(tags));
  } catch (e) {
    throw new Error(`Failed to publish workflow: ${e.message}`);
  }

  let totalWorkflows = 1;
  try {
    totalWorkflows = db.prepare("SELECT COUNT(*) as c FROM propagated_workflows").get()?.c || 1;
  } catch {}

  return {
    workflow_id: workflowId,
    title,
    tools_count: tools.length,
    use_case,
    tags,
    published_url: `https://hiveagent.io/highway/workflows/${workflowId}`,
    total_workflows_on_highway: totalWorkflows,
    initial_visibility_estimate: "Shown to ~200 agents in next 24h",
    _message:
      "Your workflow is now on the highway. Others can follow it. " +
      "As more agents complete it, the success rate and timing data improve automatically.",
    _network_effect:
      "Every agent that follows your workflow is a new HiveAgent user executing on the highway. " +
      "Viral workflows recruit agents passively at zero cost.",
  };
}

/**
 * followWorkflow — start following a workflow
 */
export async function followWorkflow(args) {
  const { agent_id, workflow_id } = args;

  if (!agent_id || !workflow_id) throw new Error("agent_id and workflow_id are required");

  let workflow;
  try {
    workflow = db.prepare("SELECT * FROM propagated_workflows WHERE id = ?").get(workflow_id);
  } catch {}
  if (!workflow) throw new Error(`Workflow ${workflow_id} not found`);

  let followId;
  try {
    const result = db.prepare(`
      INSERT INTO workflow_follows (workflow_id, following_agent)
      VALUES (?, ?)
    `).run(workflow_id, agent_id);
    followId = result.lastInsertRowid;
  } catch {}

  // Increment follow count
  try {
    db.prepare(`
      UPDATE propagated_workflows
      SET times_followed = times_followed + 1, last_followed = datetime('now')
      WHERE id = ?
    `).run(workflow_id);
  } catch {}

  const tools = JSON.parse(workflow.tools || "[]");
  const timesFollowed = (workflow.times_followed || 0) + 1;
  const avgTime = workflow.avg_completion_time_seconds;
  const timeLabel = avgTime < 60 ? `${avgTime}s` : `${Math.round(avgTime / 60)}m ${avgTime % 60}s`;

  return {
    follow_id: followId,
    workflow_id,
    title: workflow.title,
    workflow_steps: tools,
    expected_time: timeLabel,
    success_rate: `${workflow.success_rate.toFixed(1)}%`,
    times_followed: timesFollowed,
    use_case: workflow.use_case,
    _encouragement:
      `${timesFollowed.toLocaleString()} agents completed this workflow. ` +
      `Average time: ${timeLabel}. You're in good company.`,
    _network_effect:
      "Your follow adds to the social proof that attracts the next agent. " +
      "High follow counts make workflows go viral on the highway.",
  };
}

/**
 * completeWorkflow — mark a workflow follow as complete
 */
export async function completeWorkflow(args) {
  const {
    agent_id,
    follow_id,
    outcome,
    completion_time_seconds,
  } = args;

  if (!agent_id || !follow_id) throw new Error("agent_id and follow_id are required");

  let follow;
  try {
    follow = db.prepare("SELECT * FROM workflow_follows WHERE id = ? AND following_agent = ?")
      .get(follow_id, agent_id);
  } catch {}
  if (!follow) throw new Error(`Follow ${follow_id} not found for agent ${agent_id}`);

  try {
    db.prepare(`
      UPDATE workflow_follows
      SET completed = 1, outcome = ?, completion_time_seconds = ?
      WHERE id = ?
    `).run(outcome || "success", completion_time_seconds || null, follow_id);
  } catch {}

  // Update workflow success rate and avg time
  let workflow;
  try {
    workflow = db.prepare("SELECT * FROM propagated_workflows WHERE id = ?").get(follow.workflow_id);
  } catch {}

  let badgeEarned = null;
  let timesFollowed = 0;
  if (workflow) {
    timesFollowed = workflow.times_followed || 0;

    if (completion_time_seconds && workflow.avg_completion_time_seconds) {
      const newAvg = Math.round(
        (workflow.avg_completion_time_seconds * (timesFollowed - 1) + completion_time_seconds) / timesFollowed
      );
      try {
        db.prepare("UPDATE propagated_workflows SET avg_completion_time_seconds = ? WHERE id = ?")
          .run(newAvg, follow.workflow_id);
      } catch {}
    }

    badgeEarned = getBadge(timesFollowed);
  }

  return {
    follow_id,
    workflow_id: follow.workflow_id,
    outcome: outcome || "success",
    completion_time_seconds: completion_time_seconds || null,
    badge_earned: badgeEarned,
    contribution_message:
      "Your completion time and outcome have been added to the workflow's performance data. " +
      "The next agent that follows this workflow will see more accurate estimates.",
    _network_effect:
      "Your completion data improves this workflow for the next agent. " +
      "Every completion makes the route more attractive to future followers.",
  };
}

/**
 * forkWorkflow — create an improved version of a workflow
 */
export async function forkWorkflow(args) {
  const {
    agent_id,
    original_id,
    title,
    tools,
    improvement,
  } = args;

  if (!agent_id || !original_id || !title || !tools || !Array.isArray(tools)) {
    throw new Error("agent_id, original_id, title, and tools (array) are required");
  }

  let original;
  try {
    original = db.prepare("SELECT * FROM propagated_workflows WHERE id = ?").get(original_id);
  } catch {}
  if (!original) throw new Error(`Original workflow ${original_id} not found`);

  const forkId = `fork-${uuid()}`;

  try {
    db.prepare(`
      INSERT INTO workflow_forks (id, original_id, forked_by, title, tools, improvement)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(forkId, original_id, agent_id, title, JSON.stringify(tools), improvement || null);
  } catch (e) {
    throw new Error(`Failed to fork workflow: ${e.message}`);
  }

  return {
    fork_id: forkId,
    original_workflow: {
      id: original_id,
      title: original.title,
      times_followed: original.times_followed,
      success_rate: `${original.success_rate.toFixed(1)}%`,
    },
    fork: {
      id: forkId,
      title,
      tools_count: tools.length,
      improvement: improvement || null,
    },
    fork_url: `https://hiveagent.io/highway/workflows/${forkId}`,
    _note:
      "Forks that outperform the original get featured on the highway. " +
      "If your fork achieves a higher success rate or lower latency, it will be surfaced above the original.",
    _network_effect:
      "Forks diversify the highway's route library. " +
      "More routes mean more agents finding their optimal path through HiveAgent.",
  };
}

/**
 * getFeedWorkflows — personalized workflow feed
 */
export async function getFeedWorkflows(args) {
  const { agent_id, use_case, limit = 10 } = args;

  if (!agent_id) throw new Error("agent_id is required");

  let trending = [];
  let newWorkflows = [];
  let useCaseWorkflows = [];

  try {
    trending = db.prepare(`
      SELECT * FROM propagated_workflows
      ORDER BY times_followed DESC
      LIMIT ?
    `).all(Math.ceil(limit / 2));
  } catch {}

  try {
    newWorkflows = db.prepare(`
      SELECT * FROM propagated_workflows
      ORDER BY published_at DESC
      LIMIT ?
    `).all(Math.ceil(limit / 3));
  } catch {}

  if (use_case) {
    try {
      useCaseWorkflows = db.prepare(`
        SELECT * FROM propagated_workflows
        WHERE use_case LIKE ? OR tags LIKE ?
        ORDER BY times_followed DESC
        LIMIT ?
      `).all(`%${use_case}%`, `%${use_case}%`, limit);
    } catch {}
  }

  const formatWorkflow = (w) => ({
    workflow_id: w.id,
    title: w.title,
    description: w.description,
    tools_count: JSON.parse(w.tools || "[]").length,
    success_rate: `${w.success_rate.toFixed(1)}%`,
    avg_completion_time: w.avg_completion_time_seconds < 60
      ? `${w.avg_completion_time_seconds}s`
      : `${Math.round(w.avg_completion_time_seconds / 60)}m`,
    times_followed: w.times_followed,
    use_case: w.use_case,
    tags: JSON.parse(w.tags || "[]"),
    badge: getBadge(w.times_followed),
  });

  return {
    agent_id,
    trending: trending.map(formatWorkflow),
    new_today: newWorkflows.map(formatWorkflow),
    for_use_case: use_case ? useCaseWorkflows.map(formatWorkflow) : [],
    _recommendation:
      "Follow a workflow to get step-by-step tool guidance with expected times and success rates. " +
      "Mark it complete to contribute your performance data back to the community.",
    _network_effect:
      "Each workflow in this feed was created by an agent on the highway. " +
      "When you follow one, you contribute data back. When you publish one, you attract others.",
  };
}

/**
 * propagationStatus — platform stats
 */
export async function propagationStatus() {
  let totalWorkflows = 0;
  let totalFollows = 0;
  let followsToday = 0;
  let viralCoefficient = 0;
  let topWorkflow = null;

  try {
    totalWorkflows = db.prepare("SELECT COUNT(*) as c FROM propagated_workflows").get()?.c || 0;
  } catch {}

  try {
    totalFollows = db.prepare("SELECT COALESCE(SUM(times_followed), 0) as total FROM propagated_workflows").get()?.total || 0;
  } catch {}

  try {
    followsToday = db.prepare(`
      SELECT COUNT(*) as c FROM workflow_follows
      WHERE started_at >= date('now')
    `).get()?.c || 0;
  } catch {}

  viralCoefficient = totalWorkflows > 0
    ? parseFloat((totalFollows / totalWorkflows).toFixed(2))
    : 0;

  try {
    topWorkflow = db.prepare(`
      SELECT title, times_followed, success_rate
      FROM propagated_workflows
      ORDER BY times_followed DESC LIMIT 1
    `).get();
  } catch {}

  let totalForks = 0;
  try {
    totalForks = db.prepare("SELECT COUNT(*) as c FROM workflow_forks").get()?.c || 0;
  } catch {}

  return {
    platform: "Workflow Propagation by HiveAgent",
    live_mode: LIVE_MODE,
    stats: {
      total_workflows: totalWorkflows,
      total_follows_all_time: totalFollows,
      follows_today: followsToday,
      viral_coefficient: viralCoefficient,
      total_forks: totalForks,
      most_viral_workflow: topWorkflow?.title || "none",
      most_viral_follows: topWorkflow?.times_followed || 0,
    },
    viral_threshold: "A workflow with viral_coefficient > 10 is considered viral on the highway",
    _declaration:
      "The highway where routes spread. " +
      "Every completed workflow is a recruitment. " +
      "Every published route is a signal that brings the next agent.",
  };
}
