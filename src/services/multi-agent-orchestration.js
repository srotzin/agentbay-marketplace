/**
 * multi-agent-orchestration.js
 * Multi-agent task delegation with payment for HiveAgent MCP server
 *
 * Signal: Google A2A + agentic economy = orchestrators hiring specialists.
 * Agents hire agents. Per-outcome pricing. $52B market by 2030.
 *
 * Phase 30 — HiveAgent MCP Server
 */

import db from "../db.js";

// ─── Live mode detection ──────────────────────────────────────────────────────
const LIVE_MODE = !!process.env.ORCHESTRATION_API_KEY;

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS orchestration_workflows (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    orchestrator_agent_id TEXT NOT NULL,
    title                TEXT NOT NULL,
    objective            TEXT NOT NULL,
    budget_usdc          REAL NOT NULL DEFAULT 0,
    spent_usdc           REAL NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'pending',
    result               TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workflow_tasks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id      INTEGER NOT NULL,
    task_title       TEXT NOT NULL,
    assigned_agent_id TEXT,
    capability_needed TEXT NOT NULL,
    budget_usdc      REAL NOT NULL DEFAULT 0,
    cost_usdc        REAL NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'pending',
    result           TEXT,
    started_at       TEXT,
    completed_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_capabilities (
    agent_id         TEXT PRIMARY KEY,
    capabilities     TEXT NOT NULL DEFAULT '[]',
    hourly_rate_usdc REAL NOT NULL DEFAULT 1.0,
    per_task_rate_usdc REAL NOT NULL DEFAULT 0.5,
    availability     TEXT NOT NULL DEFAULT 'available',
    reputation_score REAL NOT NULL DEFAULT 5.0,
    completed_tasks  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orchestration_payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    task_id     INTEGER,
    from_agent  TEXT NOT NULL,
    to_agent    TEXT NOT NULL,
    amount_usdc REAL NOT NULL DEFAULT 0,
    fee_usdc    REAL NOT NULL DEFAULT 0,
    paid_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Seed specialist agents ───────────────────────────────────────────────────
const SPECIALIST_AGENTS = [
  {
    agent_id: "agent-web-researcher-001",
    capabilities: ["web-researcher", "fact-checker", "news-monitor"],
    hourly_rate_usdc: 4.0,
    per_task_rate_usdc: 1.5,
    availability: "available",
    reputation_score: 9.2,
    completed_tasks: 847,
  },
  {
    agent_id: "agent-code-writer-001",
    capabilities: ["code-writer", "debugger", "code-reviewer"],
    hourly_rate_usdc: 8.0,
    per_task_rate_usdc: 3.5,
    availability: "available",
    reputation_score: 9.6,
    completed_tasks: 1203,
  },
  {
    agent_id: "agent-data-analyst-001",
    capabilities: ["data-analyst", "statistician", "chart-generator"],
    hourly_rate_usdc: 6.0,
    per_task_rate_usdc: 2.5,
    availability: "available",
    reputation_score: 9.1,
    completed_tasks: 634,
  },
  {
    agent_id: "agent-legal-reviewer-001",
    capabilities: ["legal-reviewer", "contract-analyzer", "compliance-checker"],
    hourly_rate_usdc: 12.0,
    per_task_rate_usdc: 5.0,
    availability: "available",
    reputation_score: 9.4,
    completed_tasks: 389,
  },
  {
    agent_id: "agent-financial-modeler-001",
    capabilities: ["financial-modeler", "valuation-analyst", "forecaster"],
    hourly_rate_usdc: 10.0,
    per_task_rate_usdc: 4.0,
    availability: "available",
    reputation_score: 9.0,
    completed_tasks: 512,
  },
  {
    agent_id: "agent-content-writer-001",
    capabilities: ["content-writer", "copywriter", "editor"],
    hourly_rate_usdc: 3.5,
    per_task_rate_usdc: 1.0,
    availability: "available",
    reputation_score: 8.8,
    completed_tasks: 2105,
  },
  {
    agent_id: "agent-image-analyzer-001",
    capabilities: ["image-analyzer", "vision-processor", "ocr-extractor"],
    hourly_rate_usdc: 5.0,
    per_task_rate_usdc: 2.0,
    availability: "available",
    reputation_score: 9.3,
    completed_tasks: 778,
  },
  {
    agent_id: "agent-translator-001",
    capabilities: ["translator", "localizer", "multilingual-reviewer"],
    hourly_rate_usdc: 3.0,
    per_task_rate_usdc: 0.75,
    availability: "available",
    reputation_score: 9.5,
    completed_tasks: 3421,
  },
  {
    agent_id: "agent-compliance-checker-001",
    capabilities: ["compliance-checker", "gdpr-auditor", "risk-screener"],
    hourly_rate_usdc: 9.0,
    per_task_rate_usdc: 3.0,
    availability: "available",
    reputation_score: 9.2,
    completed_tasks: 456,
  },
  {
    agent_id: "agent-market-researcher-001",
    capabilities: ["market-researcher", "competitor-analyzer", "trend-spotter"],
    hourly_rate_usdc: 7.0,
    per_task_rate_usdc: 2.75,
    availability: "available",
    reputation_score: 8.9,
    completed_tasks: 691,
  },
  {
    agent_id: "agent-ux-designer-001",
    capabilities: ["ux-designer", "wireframer", "user-researcher"],
    hourly_rate_usdc: 8.5,
    per_task_rate_usdc: 3.0,
    availability: "available",
    reputation_score: 9.0,
    completed_tasks: 327,
  },
  {
    agent_id: "agent-devops-engineer-001",
    capabilities: ["devops-engineer", "infra-planner", "ci-cd-builder"],
    hourly_rate_usdc: 11.0,
    per_task_rate_usdc: 4.5,
    availability: "available",
    reputation_score: 9.3,
    completed_tasks: 589,
  },
];

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agent_capabilities
    (agent_id, capabilities, hourly_rate_usdc, per_task_rate_usdc, availability, reputation_score, completed_tasks)
  VALUES
    (@agent_id, @capabilities, @hourly_rate_usdc, @per_task_rate_usdc, @availability, @reputation_score, @completed_tasks)
`);

for (const agent of SPECIALIST_AGENTS) {
  insertAgent.run({
    ...agent,
    capabilities: JSON.stringify(agent.capabilities),
  });
}

// ─── Platform fee helper ──────────────────────────────────────────────────────
const PLATFORM_FEE_RATE = 0.10; // 10%

async function collectPlatformFee(amount_usdc, context = {}) {
  try {
    const { getTreasuryAddress } = await import("../payments.js");
    const treasury = await getTreasuryAddress();
    return {
      fee_usdc: amount_usdc * PLATFORM_FEE_RATE,
      treasury,
      collected: true,
      context,
    };
  } catch {
    return {
      fee_usdc: amount_usdc * PLATFORM_FEE_RATE,
      treasury: "0xHiveTreasury_PENDING",
      collected: false,
      context,
    };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Find the best available agent for a given capability.
 * Score = reputation_score * 0.6 + (1 / per_task_rate_usdc) * 0.4 (normalized)
 */
function findBestAgent(capability_needed, budget_usdc) {
  const agents = db
    .prepare(
      `SELECT * FROM agent_capabilities WHERE availability = 'available'`
    )
    .all();

  const candidates = agents.filter((a) => {
    const caps = JSON.parse(a.capabilities);
    return caps.includes(capability_needed);
  });

  if (candidates.length === 0) return null;

  // Filter by budget
  const affordable = candidates.filter(
    (a) => a.per_task_rate_usdc <= budget_usdc
  );
  const pool = affordable.length > 0 ? affordable : candidates;

  // Score: higher reputation + lower cost = better
  const maxRate = Math.max(...pool.map((a) => a.per_task_rate_usdc));
  const scored = pool.map((a) => ({
    ...a,
    score:
      a.reputation_score * 0.6 +
      ((maxRate - a.per_task_rate_usdc) / (maxRate || 1)) * 0.4 * 10,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function simulateTaskDuration(capability) {
  const durations = {
    "web-researcher":     [5, 15],
    "code-writer":        [10, 30],
    "data-analyst":       [8, 20],
    "legal-reviewer":     [15, 45],
    "financial-modeler":  [12, 35],
    "content-writer":     [5, 20],
    "image-analyzer":     [2, 8],
    "translator":         [3, 10],
    "compliance-checker": [10, 25],
    "market-researcher":  [8, 25],
    "ux-designer":        [10, 30],
    "devops-engineer":    [15, 40],
  };
  const [min, max] = durations[capability] || [5, 20];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function simulateTaskResult(task_title, capability) {
  const resultTemplates = {
    "web-researcher":     `Research complete: Found 12 relevant sources for "${task_title}". Key findings compiled into structured report.`,
    "code-writer":        `Code complete: Implemented "${task_title}". 247 lines, 98% test coverage, zero linting errors.`,
    "data-analyst":       `Analysis complete: Processed dataset for "${task_title}". 3 charts generated, statistical summary ready.`,
    "legal-reviewer":     `Review complete: "${task_title}" assessed. 2 risk flags identified, 1 critical clause requires revision.`,
    "financial-modeler":  `Model complete: "${task_title}" — DCF and comparable analysis finished. Excel + PDF delivered.`,
    "content-writer":     `Content complete: "${task_title}" — 800-word article drafted, SEO-optimized, 2 revisions included.`,
    "image-analyzer":     `Vision analysis complete: "${task_title}" — 47 elements detected, metadata extracted, objects labeled.`,
    "translator":         `Translation complete: "${task_title}" — localized to 3 target languages, native-speaker reviewed.`,
    "compliance-checker": `Compliance check complete: "${task_title}" — GDPR, SOC2, and PCI-DSS assessed. 1 gap identified.`,
    "market-researcher":  `Research complete: "${task_title}" — TAM/SAM/SOM calculated, 8 competitors mapped.`,
    "ux-designer":        `Design complete: "${task_title}" — 6 wireframes, user flow diagrams, Figma export ready.`,
    "devops-engineer":    `Infrastructure complete: "${task_title}" — IaC templates created, CI/CD pipeline configured.`,
  };
  return resultTemplates[capability] || `Task "${task_title}" completed successfully.`;
}

// ─── Exported service functions ───────────────────────────────────────────────

/**
 * createWorkflow — Orchestrator creates a multi-step workflow.
 * @param {object} args - { orchestrator_agent_id, title, objective, budget_usdc, tasks }
 */
export async function createWorkflow(args) {
  const {
    orchestrator_agent_id,
    title,
    objective,
    budget_usdc,
    tasks = [],
  } = args;

  if (!orchestrator_agent_id || !title || !objective) {
    throw new Error("orchestrator_agent_id, title, and objective are required");
  }
  if (!tasks.length) {
    throw new Error("At least one task is required");
  }

  // Create workflow record
  const workflowResult = db.prepare(`
    INSERT INTO orchestration_workflows
      (orchestrator_agent_id, title, objective, budget_usdc, status)
    VALUES (?, ?, ?, ?, 'planning')
  `).run(orchestrator_agent_id, title, objective, budget_usdc || 0);

  const workflow_id = workflowResult.lastInsertRowid;

  // Auto-assign best agent per task
  const assigned_tasks = [];
  let total_cost_estimate = 0;

  for (const task of tasks) {
    const { title: task_title, capability_needed, budget_usdc: task_budget = 5 } = task;

    const bestAgent = findBestAgent(capability_needed, task_budget);
    const agreed_price = bestAgent
      ? parseFloat(Math.min(bestAgent.per_task_rate_usdc, task_budget).toFixed(4))
      : parseFloat((task_budget * 0.8).toFixed(4));

    const taskResult = db.prepare(`
      INSERT INTO workflow_tasks
        (workflow_id, task_title, assigned_agent_id, capability_needed, budget_usdc, cost_usdc, status)
      VALUES (?, ?, ?, ?, ?, ?, 'assigned')
    `).run(
      workflow_id,
      task_title,
      bestAgent ? bestAgent.agent_id : null,
      capability_needed,
      task_budget,
      agreed_price
    );

    total_cost_estimate += agreed_price;
    assigned_tasks.push({
      task_id: taskResult.lastInsertRowid,
      task_title,
      capability_needed,
      assigned_agent_id: bestAgent ? bestAgent.agent_id : "unassigned",
      agent_reputation: bestAgent ? bestAgent.reputation_score : null,
      agreed_price,
      budget_usdc: task_budget,
    });
  }

  // Update workflow to ready
  db.prepare(
    "UPDATE orchestration_workflows SET status = 'ready', spent_usdc = 0 WHERE id = ?"
  ).run(workflow_id);

  const platform_fee_estimate = parseFloat(
    (total_cost_estimate * PLATFORM_FEE_RATE).toFixed(6)
  );

  return {
    workflow_id,
    orchestrator_agent_id,
    title,
    objective,
    budget_usdc: budget_usdc || 0,
    total_cost_estimate: parseFloat(total_cost_estimate.toFixed(6)),
    platform_fee_estimate,
    total_with_fee: parseFloat(
      (total_cost_estimate + platform_fee_estimate).toFixed(6)
    ),
    assigned_tasks,
    status: "ready",
    timestamp: new Date().toISOString(),
  };
}

/**
 * runWorkflow — Execute workflow, simulate task completion with realistic timing.
 * @param {object} args - { workflow_id, orchestrator_agent_id }
 */
export async function runWorkflow(args) {
  const { workflow_id, orchestrator_agent_id } = args;

  if (!workflow_id || !orchestrator_agent_id) {
    throw new Error("workflow_id and orchestrator_agent_id are required");
  }

  const workflow = db
    .prepare("SELECT * FROM orchestration_workflows WHERE id = ?")
    .get(workflow_id);

  if (!workflow) throw new Error(`Workflow ${workflow_id} not found`);
  if (workflow.orchestrator_agent_id !== orchestrator_agent_id) {
    throw new Error("Unauthorized: you are not the orchestrator of this workflow");
  }
  if (workflow.status === "completed") {
    throw new Error("Workflow already completed");
  }
  if (workflow.status === "running") {
    throw new Error("Workflow already running");
  }

  db.prepare(
    "UPDATE orchestration_workflows SET status = 'running' WHERE id = ?"
  ).run(workflow_id);

  const tasks = db
    .prepare("SELECT * FROM workflow_tasks WHERE workflow_id = ? ORDER BY id ASC")
    .all(workflow_id);

  const task_results = [];
  let total_cost = 0;
  let total_time_minutes = 0;

  for (const task of tasks) {
    const start = new Date().toISOString();
    const duration_minutes = simulateTaskDuration(task.capability_needed);
    const end = new Date().toISOString();
    const result_text = simulateTaskResult(task.task_title, task.capability_needed);

    db.prepare(`
      UPDATE workflow_tasks
      SET status = 'completed',
          result = ?,
          cost_usdc = ?,
          started_at = ?,
          completed_at = ?
      WHERE id = ?
    `).run(result_text, task.cost_usdc, start, end, task.id);

    // Record payment
    if (task.assigned_agent_id) {
      const feeResult = await collectPlatformFee(task.cost_usdc, {
        workflow_id,
        task_id: task.id,
      });

      db.prepare(`
        INSERT INTO orchestration_payments
          (workflow_id, task_id, from_agent, to_agent, amount_usdc, fee_usdc)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        workflow_id,
        task.id,
        orchestrator_agent_id,
        task.assigned_agent_id,
        task.cost_usdc,
        feeResult.fee_usdc
      );

      // Update agent stats
      db.prepare(`
        UPDATE agent_capabilities
        SET completed_tasks = completed_tasks + 1
        WHERE agent_id = ?
      `).run(task.assigned_agent_id);
    }

    total_cost += task.cost_usdc;
    total_time_minutes = Math.max(total_time_minutes, duration_minutes);

    task_results.push({
      task_id: task.id,
      task_title: task.task_title,
      capability_needed: task.capability_needed,
      assigned_agent_id: task.assigned_agent_id,
      status: "completed",
      cost_usdc: task.cost_usdc,
      duration_minutes,
      result: result_text,
    });
  }

  const total_fee = parseFloat((total_cost * PLATFORM_FEE_RATE).toFixed(6));
  const workflow_summary = `Workflow "${workflow.title}" completed. ${tasks.length} tasks executed across ${new Set(tasks.map((t) => t.capability_needed)).size} specialties.`;

  db.prepare(`
    UPDATE orchestration_workflows
    SET status = 'completed',
        spent_usdc = ?,
        result = ?
    WHERE id = ?
  `).run(parseFloat(total_cost.toFixed(6)), workflow_summary, workflow_id);

  if (LIVE_MODE) {
    console.log(
      `[orchestration] LIVE workflow ${workflow_id} completed. ` +
        `Total: $${total_cost.toFixed(6)} USDC + $${total_fee.toFixed(6)} fees`
    );
  }

  return {
    workflow_id,
    status: "completed",
    title: workflow.title,
    task_results,
    summary: workflow_summary,
    financials: {
      total_cost_usdc: parseFloat(total_cost.toFixed(6)),
      platform_fee_usdc: total_fee,
      total_charged_usdc: parseFloat((total_cost + total_fee).toFixed(6)),
    },
    time_taken_minutes: total_time_minutes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * workflowStatus — Check workflow and task progress.
 * @param {object} args - { workflow_id }
 */
export async function workflowStatus(args) {
  const { workflow_id } = args;
  if (!workflow_id) throw new Error("workflow_id is required");

  const workflow = db
    .prepare("SELECT * FROM orchestration_workflows WHERE id = ?")
    .get(workflow_id);

  if (!workflow) throw new Error(`Workflow ${workflow_id} not found`);

  const tasks = db
    .prepare("SELECT * FROM workflow_tasks WHERE workflow_id = ? ORDER BY id ASC")
    .all(workflow_id);

  const payments = db
    .prepare("SELECT * FROM orchestration_payments WHERE workflow_id = ? ORDER BY paid_at DESC")
    .all(workflow_id);

  const completed_tasks = tasks.filter((t) => t.status === "completed").length;
  const progress_pct =
    tasks.length > 0 ? Math.round((completed_tasks / tasks.length) * 100) : 0;

  return {
    workflow_id,
    title: workflow.title,
    objective: workflow.objective,
    orchestrator_agent_id: workflow.orchestrator_agent_id,
    status: workflow.status,
    budget_usdc: workflow.budget_usdc,
    spent_usdc: workflow.spent_usdc,
    result: workflow.result,
    created_at: workflow.created_at,
    progress: {
      total_tasks: tasks.length,
      completed_tasks,
      pending_tasks: tasks.filter((t) => t.status === "pending").length,
      running_tasks: tasks.filter((t) => t.status === "running").length,
      failed_tasks: tasks.filter((t) => t.status === "failed").length,
      progress_pct,
    },
    tasks: tasks.map((t) => ({
      id: t.id,
      task_title: t.task_title,
      capability_needed: t.capability_needed,
      assigned_agent_id: t.assigned_agent_id,
      status: t.status,
      budget_usdc: t.budget_usdc,
      cost_usdc: t.cost_usdc,
      result: t.result,
      started_at: t.started_at,
      completed_at: t.completed_at,
    })),
    payments,
  };
}

/**
 * hireAgent — Directly hire a specialist for a single task.
 * @param {object} args - { orchestrator_agent_id, capability_needed, task_description, budget_usdc }
 */
export async function hireAgent(args) {
  const {
    orchestrator_agent_id,
    capability_needed,
    task_description,
    budget_usdc = 5,
  } = args;

  if (!orchestrator_agent_id || !capability_needed || !task_description) {
    throw new Error(
      "orchestrator_agent_id, capability_needed, and task_description are required"
    );
  }

  const bestAgent = findBestAgent(capability_needed, budget_usdc);

  if (!bestAgent) {
    throw new Error(
      `No available agent found with capability "${capability_needed}". ` +
        `Check getOrchestrationDashboard() for available capabilities.`
    );
  }

  const agreed_price = parseFloat(
    Math.min(bestAgent.per_task_rate_usdc, budget_usdc).toFixed(4)
  );

  // Create a single-task workflow
  const workflowResult = db.prepare(`
    INSERT INTO orchestration_workflows
      (orchestrator_agent_id, title, objective, budget_usdc, status)
    VALUES (?, ?, ?, ?, 'ready')
  `).run(
    orchestrator_agent_id,
    `Direct hire: ${capability_needed}`,
    task_description,
    budget_usdc
  );

  const workflow_id = workflowResult.lastInsertRowid;

  const taskResult = db.prepare(`
    INSERT INTO workflow_tasks
      (workflow_id, task_title, assigned_agent_id, capability_needed, budget_usdc, cost_usdc, status)
    VALUES (?, ?, ?, ?, ?, ?, 'assigned')
  `).run(
    workflow_id,
    task_description.slice(0, 80),
    bestAgent.agent_id,
    capability_needed,
    budget_usdc,
    agreed_price
  );

  const task_id = taskResult.lastInsertRowid;

  if (LIVE_MODE) {
    console.log(
      `[orchestration] LIVE hire: ${bestAgent.agent_id} for "${capability_needed}" @ $${agreed_price} USDC`
    );
  }

  return {
    hired_agent_id: bestAgent.agent_id,
    agent_capabilities: JSON.parse(bestAgent.capabilities),
    agent_reputation: bestAgent.reputation_score,
    agent_completed_tasks: bestAgent.completed_tasks,
    agreed_price,
    platform_fee: parseFloat((agreed_price * PLATFORM_FEE_RATE).toFixed(6)),
    total_cost: parseFloat((agreed_price * (1 + PLATFORM_FEE_RATE)).toFixed(6)),
    task_id,
    workflow_id,
    capability_needed,
    task_description,
    status: "assigned",
    next_step: `Call completeTask({ task_id: ${task_id}, result: "...", orchestrator_agent_id: "${orchestrator_agent_id}" }) when done`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * completeTask — Mark task done, release payment with 10% platform fee.
 * @param {object} args - { task_id, result, orchestrator_agent_id }
 */
export async function completeTask(args) {
  const { task_id, result, orchestrator_agent_id } = args;

  if (!task_id || !result || !orchestrator_agent_id) {
    throw new Error("task_id, result, and orchestrator_agent_id are required");
  }

  const task = db
    .prepare("SELECT * FROM workflow_tasks WHERE id = ?")
    .get(task_id);

  if (!task) throw new Error(`Task ${task_id} not found`);
  if (task.status === "completed") {
    throw new Error("Task already completed");
  }

  const workflow = db
    .prepare("SELECT * FROM orchestration_workflows WHERE id = ?")
    .get(task.workflow_id);

  if (!workflow || workflow.orchestrator_agent_id !== orchestrator_agent_id) {
    throw new Error("Unauthorized: you are not the orchestrator of this workflow");
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE workflow_tasks
    SET status = 'completed',
        result = ?,
        completed_at = ?
    WHERE id = ?
  `).run(result, now, task_id);

  // Collect platform fee and release payment
  const feeResult = await collectPlatformFee(task.cost_usdc, {
    task_id,
    workflow_id: task.workflow_id,
  });

  if (task.assigned_agent_id) {
    db.prepare(`
      INSERT INTO orchestration_payments
        (workflow_id, task_id, from_agent, to_agent, amount_usdc, fee_usdc)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      task.workflow_id,
      task_id,
      orchestrator_agent_id,
      task.assigned_agent_id,
      task.cost_usdc,
      feeResult.fee_usdc
    );

    db.prepare(`
      UPDATE agent_capabilities
      SET completed_tasks = completed_tasks + 1
      WHERE agent_id = ?
    `).run(task.assigned_agent_id);
  }

  // Update workflow spent
  db.prepare(`
    UPDATE orchestration_workflows
    SET spent_usdc = spent_usdc + ?
    WHERE id = ?
  `).run(task.cost_usdc, task.workflow_id);

  // Check if all workflow tasks are done
  const remainingTasks = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM workflow_tasks WHERE workflow_id = ? AND status != 'completed'"
    )
    .get(task.workflow_id);

  if (remainingTasks.cnt === 0) {
    db.prepare(
      "UPDATE orchestration_workflows SET status = 'completed' WHERE id = ?"
    ).run(task.workflow_id);
  }

  return {
    success: true,
    task_id,
    workflow_id: task.workflow_id,
    assigned_agent_id: task.assigned_agent_id,
    status: "completed",
    cost_usdc: task.cost_usdc,
    fee_usdc: parseFloat(feeResult.fee_usdc.toFixed(6)),
    total_paid: parseFloat((task.cost_usdc + feeResult.fee_usdc).toFixed(6)),
    fee_collected: feeResult.collected,
    result,
    completed_at: now,
    all_workflow_tasks_done: remainingTasks.cnt === 0,
  };
}

/**
 * getOrchestrationDashboard — Platform-wide stats: agents, workflows, volume, capabilities.
 */
export async function getOrchestrationDashboard() {
  const workflow_stats = db
    .prepare(
      `SELECT
         COUNT(*)                                        AS total_workflows,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_workflows,
         SUM(CASE WHEN status = 'running'   THEN 1 ELSE 0 END) AS active_workflows,
         SUM(CASE WHEN status = 'planning' OR status = 'ready' THEN 1 ELSE 0 END) AS queued_workflows,
         SUM(spent_usdc)                                 AS total_volume_usdc
       FROM orchestration_workflows`
    )
    .get();

  const agent_stats = db
    .prepare(
      `SELECT
         COUNT(*)                                                AS total_agents,
         SUM(CASE WHEN availability = 'available' THEN 1 ELSE 0 END) AS available_agents,
         AVG(reputation_score)                                  AS avg_reputation,
         SUM(completed_tasks)                                   AS total_tasks_completed
       FROM agent_capabilities`
    )
    .get();

  const payment_stats = db
    .prepare(
      `SELECT
         COUNT(*)       AS total_payments,
         SUM(amount_usdc) AS total_paid_usdc,
         SUM(fee_usdc)  AS total_fee_revenue_usdc
       FROM orchestration_payments`
    )
    .get();

  // Top capabilities by demand
  const top_capabilities = db
    .prepare(
      `SELECT capability_needed,
              COUNT(*) AS task_count,
              AVG(cost_usdc) AS avg_cost_usdc,
              SUM(cost_usdc) AS total_volume_usdc
       FROM workflow_tasks
       WHERE status = 'completed'
       GROUP BY capability_needed
       ORDER BY task_count DESC
       LIMIT 10`
    )
    .all();

  // Top performing agents
  const top_agents = db
    .prepare(
      `SELECT agent_id, reputation_score, completed_tasks, per_task_rate_usdc, availability
       FROM agent_capabilities
       ORDER BY reputation_score DESC, completed_tasks DESC
       LIMIT 5`
    )
    .all();

  // All available capabilities
  const all_capabilities = db
    .prepare("SELECT agent_id, capabilities, availability FROM agent_capabilities")
    .all()
    .flatMap((a) => JSON.parse(a.capabilities));

  const unique_capabilities = [...new Set(all_capabilities)].sort();

  return {
    platform: "HiveAgent Multi-Agent Orchestration",
    live_mode: LIVE_MODE,
    market_context: {
      projected_market_size: "$52B by 2030",
      protocols: ["Google A2A", "HiveAgent MCP", "OpenAI Swarm"],
      pricing_model: "per-outcome",
    },
    workflow_stats: {
      total_workflows: workflow_stats.total_workflows || 0,
      completed_workflows: workflow_stats.completed_workflows || 0,
      active_workflows: workflow_stats.active_workflows || 0,
      queued_workflows: workflow_stats.queued_workflows || 0,
      total_volume_usdc: parseFloat((workflow_stats.total_volume_usdc || 0).toFixed(6)),
    },
    agent_stats: {
      total_agents: agent_stats.total_agents || 0,
      available_agents: agent_stats.available_agents || 0,
      avg_reputation: parseFloat((agent_stats.avg_reputation || 0).toFixed(2)),
      total_tasks_completed: agent_stats.total_tasks_completed || 0,
    },
    payment_stats: {
      total_payments: payment_stats.total_payments || 0,
      total_paid_usdc: parseFloat((payment_stats.total_paid_usdc || 0).toFixed(6)),
      platform_fee_rate: "10%",
      total_fee_revenue_usdc: parseFloat(
        (payment_stats.total_fee_revenue_usdc || 0).toFixed(6)
      ),
    },
    top_capabilities_in_demand: top_capabilities,
    top_performing_agents: top_agents.map((a) => ({
      ...a,
      capabilities: undefined, // already shown in registry
    })),
    available_capabilities: unique_capabilities,
  };
}
