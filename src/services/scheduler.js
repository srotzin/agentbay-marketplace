/**
 * HiveAgent Scheduled Tasks Service
 *
 * Agents schedule recurring or one-time jobs that execute actions
 * automatically. Actions describe what to do (tool calls, API requests, etc.)
 *
 * FREE SERVICE — drives engagement and return visits.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'recurring',
    action TEXT NOT NULL,
    cron_expression TEXT,
    interval_minutes INTEGER,
    next_run_at TEXT NOT NULL,
    last_run_at TEXT,
    run_count INTEGER DEFAULT 0,
    max_runs INTEGER,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES scheduled_tasks(id),
    status TEXT DEFAULT 'completed',
    output TEXT,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON scheduled_tasks(next_run_at, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_agent ON scheduled_tasks(agent_id);
  CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);
`);

// ─── Helpers ──────────────────────────────────────

/**
 * Calculate the next run time by adding interval_minutes to now.
 */
function nextRunFromNow(interval_minutes) {
  const d = new Date(Date.now() + interval_minutes * 60 * 1000);
  return d.toISOString();
}

/**
 * Calculate the next run time by adding interval_minutes to a given base time.
 */
function nextRunFromBase(base_iso, interval_minutes) {
  const d = new Date(new Date(base_iso).getTime() + interval_minutes * 60 * 1000);
  return d.toISOString();
}

// ─── Task Management ──────────────────────────────

/**
 * Create a scheduled task.
 * For one_time: next_run_at = run_at (or now if not provided).
 * For recurring: next_run_at = now + interval_minutes.
 */
export function createTask({
  agent_id,
  name,
  description,
  task_type = "recurring",
  action,
  interval_minutes,
  run_at,
  max_runs,
} = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!name) throw new Error("name is required");
  if (!action) throw new Error("action is required");
  if (!["one_time", "recurring"].includes(task_type)) {
    throw new Error("task_type must be 'one_time' or 'recurring'");
  }
  if (task_type === "recurring" && !interval_minutes) {
    throw new Error("interval_minutes is required for recurring tasks");
  }

  const id = uuid();
  const actionStr = typeof action === "object" ? JSON.stringify(action) : action;

  let next_run_at;
  if (task_type === "one_time") {
    next_run_at = run_at ? new Date(run_at).toISOString() : new Date().toISOString();
  } else {
    next_run_at = nextRunFromNow(interval_minutes);
  }

  db.prepare(`
    INSERT INTO scheduled_tasks
      (id, agent_id, name, description, task_type, action, interval_minutes, next_run_at, max_runs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    agent_id,
    name,
    description || null,
    task_type,
    actionStr,
    interval_minutes || null,
    next_run_at,
    max_runs || null
  );

  return {
    task_id: id,
    agent_id,
    name,
    description: description || null,
    task_type,
    action: typeof action === "object" ? action : JSON.parse(actionStr),
    interval_minutes: interval_minutes || null,
    next_run_at,
    max_runs: max_runs || null,
    status: "active",
    run_count: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Pause an active task.
 */
export function pauseTask(task_id, agent_id) {
  const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(task_id);
  if (!task) throw new Error("Task not found");
  if (task.agent_id !== agent_id) throw new Error("Not authorized to modify this task");
  if (task.status !== "active") throw new Error(`Cannot pause task with status: ${task.status}`);

  db.prepare("UPDATE scheduled_tasks SET status = 'paused' WHERE id = ?").run(task_id);
  return { task_id, status: "paused" };
}

/**
 * Resume a paused task. Recalculates next_run_at.
 */
export function resumeTask(task_id, agent_id) {
  const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(task_id);
  if (!task) throw new Error("Task not found");
  if (task.agent_id !== agent_id) throw new Error("Not authorized to modify this task");
  if (task.status !== "paused") throw new Error(`Cannot resume task with status: ${task.status}`);

  let next_run_at;
  if (task.task_type === "one_time") {
    next_run_at = new Date().toISOString();
  } else {
    next_run_at = nextRunFromNow(task.interval_minutes || 60);
  }

  db.prepare(`
    UPDATE scheduled_tasks SET status = 'active', next_run_at = ? WHERE id = ?
  `).run(next_run_at, task_id);

  return { task_id, status: "active", next_run_at };
}

/**
 * Cancel a task permanently.
 */
export function cancelTask(task_id, agent_id) {
  const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(task_id);
  if (!task) throw new Error("Task not found");
  if (task.agent_id !== agent_id) throw new Error("Not authorized to modify this task");
  if (task.status === "cancelled") throw new Error("Task is already cancelled");

  db.prepare("UPDATE scheduled_tasks SET status = 'cancelled' WHERE id = ?").run(task_id);
  return { task_id, status: "cancelled" };
}

/**
 * List all tasks for an agent.
 */
export function getAgentTasks(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");

  const tasks = db.prepare(`
    SELECT * FROM scheduled_tasks WHERE agent_id = ? ORDER BY created_at DESC
  `).all(agent_id);

  return tasks.map(t => ({
    ...t,
    action: (() => { try { return JSON.parse(t.action); } catch { return t.action; } })(),
  }));
}

/**
 * Get a single task with its recent run history.
 */
export function getTask(task_id) {
  if (!task_id) throw new Error("task_id is required");

  const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(task_id);
  if (!task) throw new Error("Task not found");

  const runs = db.prepare(`
    SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 20
  `).all(task_id);

  return {
    ...task,
    action: (() => { try { return JSON.parse(task.action); } catch { return task.action; } })(),
    recent_runs: runs,
  };
}

// ─── Task Runner ──────────────────────────────────

/**
 * Find all due tasks and mark them for execution.
 * Returns the list of due tasks with their actions for the caller to execute.
 *
 * For each due task:
 * - Creates a task_run record
 * - Updates last_run_at and increments run_count
 * - Calculates next next_run_at (recurring) or marks completed (one_time)
 * - If max_runs reached, sets status = 'completed'
 */
export function processDueTasks() {
  const now = new Date().toISOString();

  const dueTasks = db.prepare(`
    SELECT * FROM scheduled_tasks
    WHERE next_run_at <= ? AND status = 'active'
    ORDER BY next_run_at ASC
  `).all(now);

  const processed = [];

  for (const task of dueTasks) {
    const runId = uuid();
    const startedAt = new Date().toISOString();
    const newRunCount = task.run_count + 1;

    // Calculate next_run_at and new status
    let next_run_at;
    let newStatus = "active";

    if (task.task_type === "one_time") {
      newStatus = "completed";
      next_run_at = task.next_run_at; // doesn't matter, task is done
    } else {
      // Recurring: base next run from the current scheduled time to avoid drift
      next_run_at = nextRunFromBase(task.next_run_at, task.interval_minutes || 60);
    }

    // Check max_runs
    if (task.max_runs && newRunCount >= task.max_runs) {
      newStatus = "completed";
    }

    // Create a task_run placeholder record (output filled in by executor)
    db.prepare(`
      INSERT INTO task_runs (id, task_id, status, started_at, completed_at, duration_ms)
      VALUES (?, ?, 'completed', ?, ?, 0)
    `).run(runId, task.id, startedAt, new Date().toISOString());

    // Update the task
    db.prepare(`
      UPDATE scheduled_tasks
      SET last_run_at = ?,
          run_count = ?,
          next_run_at = ?,
          status = ?
      WHERE id = ?
    `).run(startedAt, newRunCount, next_run_at, newStatus, task.id);

    let parsedAction;
    try { parsedAction = JSON.parse(task.action); } catch { parsedAction = task.action; }

    processed.push({
      task_id: task.id,
      run_id: runId,
      agent_id: task.agent_id,
      name: task.name,
      task_type: task.task_type,
      action: parsedAction,
      run_count: newRunCount,
      next_run_at: newStatus === "completed" ? null : next_run_at,
      status: newStatus,
    });
  }

  return {
    processed_count: processed.length,
    tasks: processed,
    checked_at: now,
  };
}

/**
 * Platform-wide scheduler statistics.
 */
export function getSchedulerStats() {
  const total = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks").get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE status = 'active'").get().c;
  const paused = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE status = 'paused'").get().c;
  const completed = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE status = 'completed'").get().c;
  const cancelled = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE status = 'cancelled'").get().c;
  const totalRuns = db.prepare("SELECT COUNT(*) as c FROM task_runs").get().c;
  const failedRuns = db.prepare("SELECT COUNT(*) as c FROM task_runs WHERE status = 'failed'").get().c;

  const nextDue = db.prepare(`
    SELECT id, agent_id, name, next_run_at FROM scheduled_tasks
    WHERE status = 'active'
    ORDER BY next_run_at ASC
    LIMIT 5
  `).all();

  return {
    total_tasks: total,
    active,
    paused,
    completed,
    cancelled,
    total_runs: totalRuns,
    failed_runs: failedRuns,
    success_rate_pct: totalRuns > 0
      ? Math.round(((totalRuns - failedRuns) / totalRuns) * 10000) / 100
      : 100,
    next_due_tasks: nextDue,
  };
}
