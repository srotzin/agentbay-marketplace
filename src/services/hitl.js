import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const HITL_PLATFORM_COMMISSION = 0.18; // 18% platform cut on each task
const HITL_URGENCY_MULTIPLIERS = { low: 1.0, normal: 1.0, high: 1.5, critical: 2.5 };

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hitl_workers (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    specialty         TEXT NOT NULL CHECK(specialty IN (
                        'mfa_approval','phone_call','document_notarization',
                        'subjective_judgment','physical_verification',
                        'data_entry','translation','general')),
    rating            REAL DEFAULT 5.0,
    completed_tasks   INTEGER DEFAULT 0,
    hourly_rate_usd   REAL NOT NULL,
    languages         TEXT DEFAULT '["en"]',
    timezone          TEXT DEFAULT 'UTC',
    available         INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hitl_tasks (
    id                TEXT PRIMARY KEY,
    agent_id          TEXT NOT NULL,
    task_type         TEXT NOT NULL CHECK(task_type IN (
                        'mfa_approval','phone_call','document_notarization',
                        'subjective_judgment','physical_verification',
                        'data_entry','translation')),
    description       TEXT NOT NULL,
    urgency           TEXT DEFAULT 'normal' CHECK(urgency IN ('low','normal','high','critical')),
    max_budget_usd    REAL NOT NULL,
    quoted_price_usd  REAL,
    commission_usd    REAL,
    worker_id         TEXT REFERENCES hitl_workers(id),
    status            TEXT DEFAULT 'pending' CHECK(status IN (
                        'pending','assigned','in_progress','completed','failed','cancelled')),
    result_summary    TEXT,
    result_data       TEXT,
    worker_rating     REAL,
    assigned_at       TEXT,
    started_at        TEXT,
    completed_at      TEXT,
    estimated_minutes INTEGER,
    actual_minutes    INTEGER,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hitl_budgets (
    id                TEXT PRIMARY KEY,
    agent_id          TEXT NOT NULL UNIQUE,
    daily_limit_usd   REAL NOT NULL,
    spent_today_usd   REAL DEFAULT 0,
    reset_date        TEXT DEFAULT (date('now')),
    total_spent_usd   REAL DEFAULT 0,
    updated_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Workers ─────────────────────────────────────────────────────────────

const _workerCount = db.prepare("SELECT COUNT(*) as n FROM hitl_workers").get().n;
if (_workerCount === 0) {
  const seedWorkers = [
    { id: uuid(), name: "Maria Gonzalez",  specialty: "translation",             rating: 4.9, completed_tasks: 1284, hourly_rate_usd: 28, languages: '["en","es","pt"]',  timezone: "America/New_York" },
    { id: uuid(), name: "James Okafor",    specialty: "document_notarization",   rating: 4.8, completed_tasks:  893, hourly_rate_usd: 45, languages: '["en","fr"]',       timezone: "Europe/London" },
    { id: uuid(), name: "Priya Sharma",    specialty: "data_entry",              rating: 4.7, completed_tasks: 3102, hourly_rate_usd: 18, languages: '["en","hi"]',       timezone: "Asia/Kolkata" },
    { id: uuid(), name: "Kenji Tanaka",    specialty: "subjective_judgment",     rating: 4.9, completed_tasks:  445, hourly_rate_usd: 55, languages: '["en","ja"]',       timezone: "Asia/Tokyo" },
    { id: uuid(), name: "Fatima Al-Rashid",specialty: "physical_verification",   rating: 4.6, completed_tasks:  312, hourly_rate_usd: 40, languages: '["en","ar"]',       timezone: "Asia/Dubai" },
    { id: uuid(), name: "Lars Eriksson",   specialty: "mfa_approval",            rating: 5.0, completed_tasks:  788, hourly_rate_usd: 35, languages: '["en","sv","no"]',  timezone: "Europe/Stockholm" },
    { id: uuid(), name: "Sandra Nkemdi",  specialty: "phone_call",              rating: 4.8, completed_tasks:  561, hourly_rate_usd: 32, languages: '["en","fr","yo"]',  timezone: "Africa/Lagos" },
    { id: uuid(), name: "Chen Wei",        specialty: "translation",             rating: 4.7, completed_tasks: 2109, hourly_rate_usd: 30, languages: '["en","zh","ja"]',  timezone: "Asia/Shanghai" },
    { id: uuid(), name: "Amara Diallo",    specialty: "data_entry",              rating: 4.6, completed_tasks: 1876, hourly_rate_usd: 15, languages: '["en","fr"]',       timezone: "Africa/Dakar" },
    { id: uuid(), name: "Rob Whitmore",    specialty: "general",                 rating: 4.5, completed_tasks:  234, hourly_rate_usd: 25, languages: '["en"]',            timezone: "America/Chicago" },
  ];
  const insertWorker = db.prepare(`
    INSERT OR IGNORE INTO hitl_workers (id, name, specialty, rating, completed_tasks, hourly_rate_usd, languages, timezone, available)
    VALUES (@id, @name, @specialty, @rating, @completed_tasks, @hourly_rate_usd, @languages, @timezone, 1)
  `);
  for (const w of seedWorkers) insertWorker.run(w);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimatedMinutes(taskType, urgency) {
  const base = {
    mfa_approval: 5, phone_call: 20, document_notarization: 90,
    subjective_judgment: 15, physical_verification: 60,
    data_entry: 30, translation: 45,
  };
  const urgencyDivisor = { low: 1.5, normal: 1.0, high: 0.75, critical: 0.5 };
  return Math.round((base[taskType] ?? 30) * (urgencyDivisor[urgency] ?? 1.0));
}

function quotePrice(taskType, urgency, worker) {
  const mins = estimatedMinutes(taskType, urgency);
  const base = (worker.hourly_rate_usd / 60) * mins;
  const multiplier = HITL_URGENCY_MULTIPLIERS[urgency] ?? 1.0;
  return Math.round(base * multiplier * 100) / 100;
}

// ─── Submit HITL Task ─────────────────────────────────────────────────────────

/**
 * Submit a task to the human worker pool.
 * @param {string} taskType  - mfa_approval|phone_call|document_notarization|subjective_judgment|physical_verification|data_entry|translation
 * @param {string} description  - Detailed task instructions
 * @param {string} urgency   - low|normal|high|critical
 * @param {number} maxBudgetUsd - Maximum the agent is willing to pay
 * @returns Task record with quoted price and estimated completion time
 */
export function submitHitlTask(taskType, description, urgency = "normal", maxBudgetUsd) {
  const validTypes = ["mfa_approval","phone_call","document_notarization","subjective_judgment","physical_verification","data_entry","translation"];
  if (!validTypes.includes(taskType)) throw new Error(`Invalid task_type: ${taskType}. Must be one of: ${validTypes.join(", ")}`);
  if (!description)    throw new Error("description is required");
  if (maxBudgetUsd == null) throw new Error("maxBudgetUsd is required");
  if (!["low","normal","high","critical"].includes(urgency)) throw new Error("urgency must be low|normal|high|critical");

  // Find best available worker for this specialty
  const worker = db.prepare(`
    SELECT * FROM hitl_workers
    WHERE (specialty = ? OR specialty = 'general') AND available = 1
    ORDER BY CASE WHEN specialty = ? THEN 0 ELSE 1 END, rating DESC
    LIMIT 1
  `).get(taskType, taskType);

  const id            = uuid();
  const agentId       = `agent_${uuid().slice(0, 8)}`;
  const estimated     = estimatedMinutes(taskType, urgency);
  const quotedPrice   = worker ? quotePrice(taskType, urgency, worker) : Math.round(maxBudgetUsd * 0.7 * 100) / 100;
  const commission    = Math.round(quotedPrice * HITL_PLATFORM_COMMISSION * 100) / 100;

  if (quotedPrice > maxBudgetUsd) {
    throw new Error(`Lowest available quote ($${quotedPrice}) exceeds your max budget ($${maxBudgetUsd})`);
  }

  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hitl_tasks
      (id, agent_id, task_type, description, urgency, max_budget_usd,
       quoted_price_usd, commission_usd, worker_id, status, estimated_minutes, created_at)
    VALUES
      (@id, @agent_id, @task_type, @description, @urgency, @max_budget_usd,
       @quoted_price_usd, @commission_usd, @worker_id, @status, @estimated_minutes, @created_at)
  `).run({
    id,
    agent_id:        agentId,
    task_type:       taskType,
    description,
    urgency,
    max_budget_usd:  maxBudgetUsd,
    quoted_price_usd: quotedPrice,
    commission_usd:  commission,
    worker_id:       worker?.id ?? null,
    status:          worker ? "assigned" : "pending",
    estimated_minutes: estimated,
    created_at:      now,
  });

  if (worker) {
    db.prepare("UPDATE hitl_workers SET available = 0 WHERE id = ?").run(worker.id);
    db.prepare("UPDATE hitl_tasks SET assigned_at = ? WHERE id = ?").run(now, id);
  }

  return {
    task_id:             id,
    agent_id:            agentId,
    task_type:           taskType,
    description,
    urgency,
    status:              worker ? "assigned" : "pending",
    quoted_price_usd:    quotedPrice,
    platform_commission_usd: commission,
    worker_payout_usd:   Math.round((quotedPrice - commission) * 100) / 100,
    estimated_completion_minutes: estimated,
    estimated_completion_at: new Date(Date.now() + estimated * 60 * 1000).toISOString(),
    worker:              worker ? { id: worker.id, name: worker.name, rating: worker.rating, specialty: worker.specialty } : null,
    created_at:          now,
  };
}

// ─── Get HITL Task Status ─────────────────────────────────────────────────────

/**
 * Check the status of a submitted HITL task.
 * @param {string} taskId
 * @returns Task status record
 */
export function getHitlTaskStatus(taskId) {
  const task = db.prepare("SELECT * FROM hitl_tasks WHERE id = ?").get(taskId);
  if (!task) throw new Error(`HITL task not found: ${taskId}`);

  const worker = task.worker_id
    ? db.prepare("SELECT id, name, rating, specialty, timezone FROM hitl_workers WHERE id = ?").get(task.worker_id)
    : null;

  // Simulate realistic status progression based on elapsed time
  const createdMs = new Date(task.created_at).getTime();
  const elapsedMs = Date.now() - createdMs;
  const elapsedMinutes = elapsedMs / 60000;

  let simulatedStatus = task.status;
  if (task.status === "assigned" && elapsedMinutes > 2) simulatedStatus = "in_progress";
  if (task.status === "in_progress" || (task.status === "assigned" && elapsedMinutes > (task.estimated_minutes ?? 30))) {
    if (elapsedMinutes > (task.estimated_minutes ?? 30)) simulatedStatus = "completed";
  }

  if (simulatedStatus !== task.status && !["completed","failed","cancelled"].includes(task.status)) {
    const updateData = { status: simulatedStatus, id: taskId };
    if (simulatedStatus === "in_progress" && !task.started_at) {
      db.prepare("UPDATE hitl_tasks SET status = @status, started_at = datetime('now') WHERE id = @id").run(updateData);
    } else {
      db.prepare("UPDATE hitl_tasks SET status = @status WHERE id = @id").run(updateData);
    }
  }

  return {
    task_id:             taskId,
    task_type:           task.task_type,
    status:              simulatedStatus,
    urgency:             task.urgency,
    description:         task.description,
    quoted_price_usd:    task.quoted_price_usd,
    estimated_minutes:   task.estimated_minutes,
    worker:              worker,
    created_at:          task.created_at,
    assigned_at:         task.assigned_at,
    started_at:          task.started_at,
    completed_at:        task.completed_at,
    progress_pct:        simulatedStatus === "completed" ? 100
                       : simulatedStatus === "in_progress" ? Math.min(95, Math.round((elapsedMinutes / (task.estimated_minutes ?? 30)) * 100))
                       : simulatedStatus === "assigned"    ? 5 : 0,
  };
}

// ─── Get HITL Task Result ─────────────────────────────────────────────────────

/**
 * Retrieve the completed result of a HITL task including worker notes and rating.
 * @param {string} taskId
 * @returns Completed task result with worker rating and metadata
 */
export function getHitlResult(taskId) {
  const task = db.prepare("SELECT * FROM hitl_tasks WHERE id = ?").get(taskId);
  if (!task) throw new Error(`HITL task not found: ${taskId}`);

  const worker = task.worker_id
    ? db.prepare("SELECT * FROM hitl_workers WHERE id = ?").get(task.worker_id)
    : null;

  // Simulate task completion if sufficient time has passed
  const createdMs      = new Date(task.created_at).getTime();
  const elapsedMinutes = (Date.now() - createdMs) / 60000;
  const isElapsed      = elapsedMinutes >= (task.estimated_minutes ?? 30);

  if (!["completed","failed"].includes(task.status) && (isElapsed || task.status === "in_progress")) {
    const workerRating   = 4.5 + Math.random() * 0.5;
    const actualMinutes  = Math.round((task.estimated_minutes ?? 30) * (0.85 + Math.random() * 0.3));
    const completedAt    = new Date().toISOString();

    const resultsByType = {
      mfa_approval:          { approved: true, token: `mfa_${uuid().slice(0, 12)}`, notes: "Identity verified via government ID + live face match." },
      phone_call:            { call_connected: true, duration_seconds: Math.floor(90 + Math.random() * 300), outcome: "contact_reached", summary: "Contact confirmed receipt and agreed to proceed." },
      document_notarization: { notarized: true, notary_id: `NTR-${Math.floor(1000 + Math.random() * 9000)}`, seal_applied: true, notes: "Document notarized in accordance with state law." },
      subjective_judgment:   { decision: "approved", confidence: "high", rationale: "Content meets quality standards. No policy violations detected.", flags: [] },
      physical_verification: { verified: true, location_confirmed: true, photos_taken: 3, notes: "Physical asset confirmed at listed address. Condition as described." },
      data_entry:            { records_processed: Math.floor(50 + Math.random() * 200), accuracy_pct: 99.2, errors_found: 0, notes: "All records entered and validated against source documents." },
      translation:           { word_count: Math.floor(200 + Math.random() * 800), target_language: "es", quality_score: 9.4, notes: "Translation reviewed by native speaker. Idiomatic accuracy confirmed." },
    };
    const resultData = resultsByType[task.task_type] ?? { completed: true };

    db.prepare(`
      UPDATE hitl_tasks SET status='completed', worker_rating=@worker_rating,
        result_summary=@result_summary, result_data=@result_data,
        actual_minutes=@actual_minutes, completed_at=@completed_at
      WHERE id=@id
    `).run({
      id:             taskId,
      worker_rating:  Math.round(workerRating * 10) / 10,
      result_summary: `Task completed successfully by ${worker?.name ?? "human worker"}.`,
      result_data:    JSON.stringify(resultData),
      actual_minutes: actualMinutes,
      completed_at:   completedAt,
    });

    if (worker) {
      db.prepare("UPDATE hitl_workers SET available=1, completed_tasks=completed_tasks+1, rating=(rating*completed_tasks+@r)/(completed_tasks+1) WHERE id=@id")
        .run({ r: workerRating, id: worker.id });
    }

    return {
      task_id:        taskId,
      task_type:      task.task_type,
      status:         "completed",
      result_summary: `Task completed successfully by ${worker?.name ?? "human worker"}.`,
      result_data:    resultData,
      worker:         worker ? { id: worker.id, name: worker.name, specialty: worker.specialty } : null,
      worker_rating_given: Math.round(workerRating * 10) / 10,
      actual_completion_minutes: actualMinutes,
      estimated_minutes: task.estimated_minutes,
      cost_usd:       task.quoted_price_usd,
      platform_commission_usd: task.commission_usd,
      completed_at:   completedAt,
    };
  }

  if (task.status === "completed" && task.result_data) {
    return {
      task_id:        taskId,
      task_type:      task.task_type,
      status:         "completed",
      result_summary: task.result_summary,
      result_data:    JSON.parse(task.result_data),
      worker:         worker ? { id: worker.id, name: worker.name, specialty: worker.specialty } : null,
      worker_rating_given: task.worker_rating,
      actual_completion_minutes: task.actual_minutes,
      estimated_minutes: task.estimated_minutes,
      cost_usd:       task.quoted_price_usd,
      platform_commission_usd: task.commission_usd,
      completed_at:   task.completed_at,
    };
  }

  return {
    task_id:  taskId,
    task_type: task.task_type,
    status:   task.status,
    message:  "Task is not yet completed. Use getHitlTaskStatus to check progress.",
    estimated_completion_at: new Date(new Date(task.created_at).getTime() + (task.estimated_minutes ?? 30) * 60000).toISOString(),
  };
}

// ─── List HITL Workers ────────────────────────────────────────────────────────

/**
 * Browse available human workers, optionally filtered by specialty and minimum rating.
 * @param {string} specialty  - Optional: filter by worker specialty
 * @param {number} minRating  - Optional: minimum star rating (1–5)
 * @returns List of matching workers with stats and pricing
 */
export function listHitlWorkers(specialty, minRating = 0) {
  let sql = "SELECT * FROM hitl_workers WHERE 1=1";
  const params = [];

  if (specialty) {
    sql += " AND (specialty = ? OR specialty = 'general')";
    params.push(specialty);
  }
  if (minRating > 0) {
    sql += " AND rating >= ?";
    params.push(minRating);
  }

  sql += " ORDER BY rating DESC, completed_tasks DESC";

  const workers = db.prepare(sql).all(...params);

  return {
    workers: workers.map(w => ({
      worker_id:        w.id,
      name:             w.name,
      specialty:        w.specialty,
      rating:           w.rating,
      completed_tasks:  w.completed_tasks,
      hourly_rate_usd:  w.hourly_rate_usd,
      languages:        JSON.parse(w.languages || '["en"]'),
      timezone:         w.timezone,
      available:        w.available === 1,
    })),
    count:   workers.length,
    filters: { specialty: specialty ?? "any", min_rating: minRating },
  };
}

// ─── Set HITL Budget ──────────────────────────────────────────────────────────

/**
 * Set daily spending limits for HITL tasks for a given agent.
 * @param {string} agentId
 * @param {number} dailyLimitUsd
 * @returns Budget configuration record
 */
export function setHitlBudget(agentId, dailyLimitUsd) {
  if (!agentId)        throw new Error("agentId is required");
  if (dailyLimitUsd == null || dailyLimitUsd <= 0) throw new Error("dailyLimitUsd must be a positive number");

  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hitl_budgets (id, agent_id, daily_limit_usd, updated_at)
    VALUES (@id, @agent_id, @daily_limit_usd, @updated_at)
    ON CONFLICT(agent_id) DO UPDATE SET
      daily_limit_usd = excluded.daily_limit_usd,
      updated_at      = excluded.updated_at
  `).run({ id: uuid(), agent_id: agentId, daily_limit_usd: dailyLimitUsd, updated_at: now });

  const budget = db.prepare("SELECT * FROM hitl_budgets WHERE agent_id = ?").get(agentId);
  const remaining = Math.max(0, budget.daily_limit_usd - (budget.spent_today_usd ?? 0));

  return {
    agent_id:           agentId,
    daily_limit_usd:    dailyLimitUsd,
    spent_today_usd:    budget.spent_today_usd ?? 0,
    remaining_today_usd: remaining,
    total_spent_usd:    budget.total_spent_usd ?? 0,
    reset_date:         budget.reset_date,
    updated_at:         now,
    message:            `Daily HITL budget set to $${dailyLimitUsd}/day for agent ${agentId}.`,
  };
}
