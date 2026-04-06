import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const PM_PLATFORM_COMMISSION        = 0.08;  // 8% of total project budget on creation
const PM_MILESTONE_RELEASE_FEE      = 0.02;  // 2% per milestone payment release (escrow)
const PM_AGENT_ASSIGNMENT_FEE_USD   = 0.50;  // $0.50 flat fee per agent assignment

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pm_projects (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','cancelled','failed')),
    owner_agent_id      TEXT,
    total_budget_usd    REAL NOT NULL,
    platform_fee_usd    REAL NOT NULL,
    escrowed_usd        REAL NOT NULL,
    released_usd        REAL DEFAULT 0,
    milestone_count     INTEGER DEFAULT 0,
    completed_milestones INTEGER DEFAULT 0,
    progress_pct        REAL DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now')),
    started_at          TEXT,
    completed_at        TEXT,
    deadline            TEXT
  );

  CREATE TABLE IF NOT EXISTS pm_milestones (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES pm_projects(id),
    name            TEXT NOT NULL,
    description     TEXT,
    criteria        TEXT NOT NULL,
    payment_usd     REAL NOT NULL,
    release_fee_usd REAL NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','under_review','completed','failed','skipped')),
    assigned_agent_id TEXT,
    progress_pct    REAL DEFAULT 0,
    notes           TEXT,
    sequence_order  INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    started_at      TEXT,
    completed_at    TEXT,
    payment_released_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pm_agent_assignments (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES pm_projects(id),
    milestone_id TEXT NOT NULL REFERENCES pm_milestones(id),
    agent_id     TEXT NOT NULL,
    role         TEXT DEFAULT 'executor',
    assignment_fee_usd REAL NOT NULL,
    status       TEXT DEFAULT 'active' CHECK(status IN ('active','completed','removed')),
    assigned_at  TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pm_progress_logs (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES pm_projects(id),
    milestone_id TEXT REFERENCES pm_milestones(id),
    agent_id     TEXT,
    progress_pct REAL NOT NULL,
    notes        TEXT,
    logged_at    TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed demo project ────────────────────────────────────────────────────────

const _projectCount = db.prepare("SELECT COUNT(*) as n FROM pm_projects").get().n;
if (_projectCount === 0) {
  const projectId    = uuid();
  const budget       = 12000;
  const platformFee  = Math.round(budget * PM_PLATFORM_COMMISSION * 100) / 100;
  const escrowed     = Math.round((budget - platformFee) * 100) / 100;
  const deadline     = new Date(Date.now() + 60 * 86400000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pm_projects (id, name, description, status, owner_agent_id, total_budget_usd, platform_fee_usd, escrowed_usd, released_usd, milestone_count, completed_milestones, progress_pct, deadline)
    VALUES (@id, @name, @description, 'active', @owner_agent_id, @total_budget_usd, @platform_fee_usd, @escrowed_usd, 0, 4, 1, 25, @deadline)
  `).run({ id: projectId, name: "E-commerce Platform v2", description: "Full-stack rebuild of merchant portal with AI-powered recommendations", owner_agent_id: "agent_owner_demo", total_budget_usd: budget, platform_fee_usd: platformFee, escrowed_usd: escrowed, deadline });

  const milestones = [
    { id: uuid(), project_id: projectId, name: "Requirements & Architecture", criteria: "Approved PRD and system architecture diagram signed off by stakeholder", payment_usd: 2000, release_fee_usd: Math.round(2000 * PM_MILESTONE_RELEASE_FEE * 100) / 100, status: "completed", progress_pct: 100, sequence_order: 1, notes: "Architecture finalized using microservices pattern on AWS." },
    { id: uuid(), project_id: projectId, name: "Backend API Development",     criteria: "REST API with 95% test coverage, staging deployed, load-tested to 1000 RPS", payment_usd: 4000, release_fee_usd: Math.round(4000 * PM_MILESTONE_RELEASE_FEE * 100) / 100, status: "in_progress", progress_pct: 65, sequence_order: 2, notes: "Auth endpoints complete. Product catalog API in progress." },
    { id: uuid(), project_id: projectId, name: "Frontend & UI",               criteria: "Responsive React SPA, Lighthouse score ≥ 90, cross-browser tested", payment_usd: 3000, release_fee_usd: Math.round(3000 * PM_MILESTONE_RELEASE_FEE * 100) / 100, status: "pending", progress_pct: 0, sequence_order: 3, notes: null },
    { id: uuid(), project_id: projectId, name: "AI Recommendations Engine",   criteria: "Model trained on synthetic data, A/B test harness ready, <200ms p99 latency", payment_usd: 2000, release_fee_usd: Math.round(2000 * PM_MILESTONE_RELEASE_FEE * 100) / 100, status: "pending", progress_pct: 0, sequence_order: 4, notes: null },
  ];
  const insertMs = db.prepare(`
    INSERT OR IGNORE INTO pm_milestones (id, project_id, name, criteria, payment_usd, release_fee_usd, status, progress_pct, sequence_order, notes, started_at, completed_at)
    VALUES (@id, @project_id, @name, @criteria, @payment_usd, @release_fee_usd, @status, @progress_pct, @sequence_order, @notes, @started_at, @completed_at)
  `);
  for (const [i, m] of milestones.entries()) {
    insertMs.run({
      ...m,
      started_at:   i === 0 ? new Date(Date.now() - 30 * 86400000).toISOString() : i === 1 ? new Date(Date.now() - 10 * 86400000).toISOString() : null,
      completed_at: i === 0 ? new Date(Date.now() - 14 * 86400000).toISOString() : null,
    });
  }

  // Released payment for milestone 0
  db.prepare("UPDATE pm_projects SET released_usd = ? WHERE id = ?").run(milestones[0].payment_usd, projectId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recomputeProjectProgress(projectId) {
  const milestones = db.prepare("SELECT * FROM pm_milestones WHERE project_id = ?").all(projectId);
  if (milestones.length === 0) return;
  const avgProgress = milestones.reduce((s, m) => s + m.progress_pct, 0) / milestones.length;
  const completedCount = milestones.filter(m => m.status === "completed").length;
  db.prepare("UPDATE pm_projects SET progress_pct = @pct, completed_milestones = @cnt WHERE id = @id")
    .run({ pct: Math.round(avgProgress * 100) / 100, cnt: completedCount, id: projectId });
}

// ─── Create Project ───────────────────────────────────────────────────────────

/**
 * Create a new multi-milestone agent project with budget escrow.
 * @param {string} name             - Project name
 * @param {string} description      - Project description
 * @param {Array}  milestones       - Array of {name, criteria, paymentUsd} milestone definitions
 * @param {number} totalBudgetUsd   - Total project budget (covers all milestones + platform fee)
 * @returns Newly created project with milestone breakdown
 */
export function createProject(name, description, milestones = [], totalBudgetUsd) {
  if (!name) throw new Error("name is required");
  if (totalBudgetUsd == null || totalBudgetUsd <= 0) throw new Error("totalBudgetUsd must be a positive number");
  if (!Array.isArray(milestones)) throw new Error("milestones must be an array");

  const platformFee = Math.round(totalBudgetUsd * PM_PLATFORM_COMMISSION * 100) / 100;
  const escrowed    = Math.round((totalBudgetUsd - platformFee) * 100) / 100;

  if (milestones.length > 0) {
    const milestoneTotal = milestones.reduce((s, m) => s + (m.paymentUsd ?? 0), 0);
    if (milestoneTotal > escrowed) {
      throw new Error(`Milestone payments ($${milestoneTotal}) exceed available escrowed amount ($${escrowed}) after platform fee.`);
    }
  }

  const id        = uuid();
  const agentId   = `agent_${uuid().slice(0, 8)}`;
  const now       = new Date().toISOString();
  const deadline  = milestones.length > 0 ? new Date(Date.now() + 90 * 86400000).toISOString() : null;

  db.prepare(`
    INSERT OR IGNORE INTO pm_projects
      (id, name, description, status, owner_agent_id, total_budget_usd,
       platform_fee_usd, escrowed_usd, released_usd, milestone_count,
       completed_milestones, progress_pct, created_at, deadline)
    VALUES
      (@id, @name, @description, 'active', @owner_agent_id, @total_budget_usd,
       @platform_fee_usd, @escrowed_usd, 0, @milestone_count,
       0, 0, @created_at, @deadline)
  `).run({
    id, name, description, owner_agent_id: agentId,
    total_budget_usd: totalBudgetUsd, platform_fee_usd: platformFee,
    escrowed_usd: escrowed, milestone_count: milestones.length,
    created_at: now, deadline,
  });

  const createdMilestones = [];
  for (const [i, ms] of milestones.entries()) {
    const msId        = uuid();
    const releaseFee  = Math.round((ms.paymentUsd ?? 0) * PM_MILESTONE_RELEASE_FEE * 100) / 100;
    db.prepare(`
      INSERT OR IGNORE INTO pm_milestones
        (id, project_id, name, description, criteria, payment_usd, release_fee_usd,
         status, progress_pct, sequence_order, created_at)
      VALUES
        (@id, @project_id, @name, @description, @criteria, @payment_usd, @release_fee_usd,
         'pending', 0, @sequence_order, @created_at)
    `).run({
      id: msId, project_id: id,
      name: ms.name ?? `Milestone ${i + 1}`,
      description: ms.description ?? null,
      criteria: ms.criteria ?? "Completion criteria to be defined",
      payment_usd: ms.paymentUsd ?? 0,
      release_fee_usd: releaseFee,
      sequence_order: i + 1,
      created_at: now,
    });
    createdMilestones.push({ milestone_id: msId, name: ms.name, payment_usd: ms.paymentUsd, release_fee_usd: releaseFee, status: "pending" });
  }

  return {
    project_id:          id,
    name,
    description,
    status:              "active",
    owner_agent_id:      agentId,
    total_budget_usd:    totalBudgetUsd,
    platform_fee_usd:    platformFee,
    escrowed_usd:        escrowed,
    milestone_count:     milestones.length,
    milestones:          createdMilestones,
    progress_pct:        0,
    deadline,
    created_at:          now,
    message:             `Project "${name}" created with $${totalBudgetUsd} budget. Platform fee: $${platformFee}. $${escrowed} in escrow.`,
  };
}

// ─── Add Milestone ────────────────────────────────────────────────────────────

/**
 * Add a new milestone with payment to an existing project.
 * @param {string} projectId    - Target project
 * @param {string} name         - Milestone name
 * @param {string} criteria     - Completion criteria (definition of done)
 * @param {number} paymentUsd   - Payment released to agent upon milestone completion
 * @returns Newly created milestone
 */
export function addMilestone(projectId, name, criteria, paymentUsd) {
  const project = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (["completed","cancelled","failed"].includes(project.status)) {
    throw new Error(`Cannot add milestone to project with status '${project.status}'`);
  }
  if (!name)     throw new Error("name is required");
  if (!criteria) throw new Error("criteria is required");
  if (paymentUsd == null || paymentUsd < 0) throw new Error("paymentUsd must be a non-negative number");

  const releasedAndPending = db.prepare(`
    SELECT COALESCE(SUM(payment_usd), 0) as total FROM pm_milestones WHERE project_id = ? AND status != 'failed'
  `).get(projectId).total;
  const available = project.escrowed_usd - releasedAndPending;
  if (paymentUsd > available) {
    throw new Error(`Payment $${paymentUsd} exceeds available escrowed funds ($${Math.round(available * 100) / 100}).`);
  }

  const id          = uuid();
  const releaseFee  = Math.round(paymentUsd * PM_MILESTONE_RELEASE_FEE * 100) / 100;
  const maxOrder    = db.prepare("SELECT COALESCE(MAX(sequence_order), 0) as m FROM pm_milestones WHERE project_id = ?").get(projectId).m;
  const now         = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pm_milestones
      (id, project_id, name, criteria, payment_usd, release_fee_usd, status, progress_pct, sequence_order, created_at)
    VALUES
      (@id, @project_id, @name, @criteria, @payment_usd, @release_fee_usd, 'pending', 0, @sequence_order, @created_at)
  `).run({ id, project_id: projectId, name, criteria, payment_usd: paymentUsd, release_fee_usd: releaseFee, sequence_order: maxOrder + 1, created_at: now });

  db.prepare("UPDATE pm_projects SET milestone_count = milestone_count + 1 WHERE id = ?").run(projectId);

  return {
    milestone_id:     id,
    project_id:       projectId,
    project_name:     project.name,
    name,
    criteria,
    payment_usd:      paymentUsd,
    release_fee_usd:  releaseFee,
    agent_payout_usd: Math.round((paymentUsd - releaseFee) * 100) / 100,
    status:           "pending",
    sequence_order:   maxOrder + 1,
    escrowed_remaining_usd: Math.round((available - paymentUsd) * 100) / 100,
    created_at:       now,
    message:          `Milestone "${name}" added. $${paymentUsd} in escrow will be released on completion.`,
  };
}

// ─── Update Progress ──────────────────────────────────────────────────────────

/**
 * Update the progress of a specific milestone and log a progress entry.
 * @param {string} projectId    - Project ID
 * @param {string} milestoneId  - Milestone ID
 * @param {number} progressPct  - Progress percentage (0–100)
 * @param {string} notes        - Optional progress notes
 * @returns Updated milestone and project progress
 */
export function updateProgress(projectId, milestoneId, progressPct, notes = null) {
  const project   = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);
  const milestone = db.prepare("SELECT * FROM pm_milestones WHERE id = ? AND project_id = ?").get(milestoneId, projectId);
  if (!project)   throw new Error(`Project not found: ${projectId}`);
  if (!milestone) throw new Error(`Milestone not found: ${milestoneId} in project ${projectId}`);
  if (progressPct == null || progressPct < 0 || progressPct > 100) throw new Error("progressPct must be between 0 and 100");
  if (milestone.status === "completed") throw new Error("Cannot update progress on a completed milestone");

  const now           = new Date().toISOString();
  const newStatus     = progressPct === 100 ? "under_review"
                      : progressPct > 0     ? "in_progress"
                      : "pending";
  const startedAt     = milestone.started_at ?? (progressPct > 0 ? now : null);

  db.prepare(`
    UPDATE pm_milestones
    SET progress_pct = @pct, status = @status, notes = @notes, started_at = @started_at
    WHERE id = @id
  `).run({ pct: progressPct, status: newStatus, notes, started_at: startedAt, id: milestoneId });

  // Log progress entry
  db.prepare(`
    INSERT OR IGNORE INTO pm_progress_logs (id, project_id, milestone_id, progress_pct, notes, logged_at)
    VALUES (@id, @project_id, @milestone_id, @pct, @notes, @logged_at)
  `).run({ id: uuid(), project_id: projectId, milestone_id: milestoneId, pct: progressPct, notes, logged_at: now });

  recomputeProjectProgress(projectId);
  const updatedProject = db.prepare("SELECT progress_pct, completed_milestones FROM pm_projects WHERE id = ?").get(projectId);

  return {
    project_id:             projectId,
    milestone_id:           milestoneId,
    milestone_name:         milestone.name,
    previous_progress_pct:  milestone.progress_pct,
    new_progress_pct:       progressPct,
    milestone_status:       newStatus,
    notes,
    project_overall_pct:    updatedProject.progress_pct,
    project_completed_milestones: updatedProject.completed_milestones,
    updated_at:             now,
    message:                progressPct === 100
      ? `Milestone "${milestone.name}" at 100% — now under review. Call releaseMilestonePayment to release escrow.`
      : `Progress updated to ${progressPct}% for milestone "${milestone.name}".`,
  };
}

// ─── Assign Agent ─────────────────────────────────────────────────────────────

/**
 * Assign a specialist agent to a specific project milestone.
 * @param {string} projectId    - Project ID
 * @param {string} milestoneId  - Milestone ID
 * @param {string} agentId      - Agent ID to assign
 * @returns Assignment record
 */
export function assignAgent(projectId, milestoneId, agentId) {
  const project   = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);
  const milestone = db.prepare("SELECT * FROM pm_milestones WHERE id = ? AND project_id = ?").get(milestoneId, projectId);
  if (!project)   throw new Error(`Project not found: ${projectId}`);
  if (!milestone) throw new Error(`Milestone not found: ${milestoneId} in project ${projectId}`);
  if (!agentId)   throw new Error("agentId is required");
  if (milestone.status === "completed") throw new Error("Cannot assign agent to a completed milestone");

  // Remove existing active assignment if any
  db.prepare("UPDATE pm_agent_assignments SET status = 'removed', completed_at = datetime('now') WHERE milestone_id = ? AND status = 'active'").run(milestoneId);

  const now          = new Date().toISOString();
  const assignmentId = uuid();

  db.prepare(`
    INSERT OR IGNORE INTO pm_agent_assignments (id, project_id, milestone_id, agent_id, role, assignment_fee_usd, status, assigned_at)
    VALUES (@id, @project_id, @milestone_id, @agent_id, 'executor', @fee, 'active', @assigned_at)
  `).run({ id: assignmentId, project_id: projectId, milestone_id: milestoneId, agent_id: agentId, fee: PM_AGENT_ASSIGNMENT_FEE_USD, assigned_at: now });

  // Update milestone's assigned agent
  db.prepare("UPDATE pm_milestones SET assigned_agent_id = ?, status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END, started_at = COALESCE(started_at, ?) WHERE id = ?")
    .run(agentId, now, milestoneId);

  return {
    assignment_id:       assignmentId,
    project_id:          projectId,
    project_name:        project.name,
    milestone_id:        milestoneId,
    milestone_name:      milestone.name,
    agent_id:            agentId,
    role:                "executor",
    assignment_fee_usd:  PM_AGENT_ASSIGNMENT_FEE_USD,
    milestone_payment_usd: milestone.payment_usd,
    milestone_status:    milestone.status === "pending" ? "in_progress" : milestone.status,
    assigned_at:         now,
    message:             `Agent ${agentId} assigned to milestone "${milestone.name}". Assignment fee: $${PM_AGENT_ASSIGNMENT_FEE_USD}.`,
  };
}

// ─── Get Project Status ───────────────────────────────────────────────────────

/**
 * Get the full project dashboard including all milestones, assignments, budget, and timeline.
 * @param {string} projectId
 * @returns Comprehensive project status dashboard
 */
export function getProjectStatus(projectId) {
  const project = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const milestones   = db.prepare("SELECT * FROM pm_milestones WHERE project_id = ? ORDER BY sequence_order").all(projectId);
  const assignments  = db.prepare("SELECT * FROM pm_agent_assignments WHERE project_id = ? ORDER BY assigned_at DESC").all(projectId);
  const recentLogs   = db.prepare("SELECT * FROM pm_progress_logs WHERE project_id = ? ORDER BY logged_at DESC LIMIT 10").all(projectId);

  const totalEscrowed    = milestones.reduce((s, m) => s + m.payment_usd, 0);
  const totalReleased    = milestones.filter(m => m.status === "completed").reduce((s, m) => s + m.payment_usd, 0);
  const totalPlatformEscrowFees = milestones.filter(m => m.status === "completed").reduce((s, m) => s + m.release_fee_usd, 0);
  const daysUntilDeadline = project.deadline
    ? Math.round((new Date(project.deadline) - Date.now()) / 86400000)
    : null;

  return {
    project_id:     projectId,
    name:           project.name,
    description:    project.description,
    status:         project.status,
    owner_agent_id: project.owner_agent_id,
    financial: {
      total_budget_usd:          project.total_budget_usd,
      platform_fee_usd:          project.platform_fee_usd,
      escrowed_usd:              project.escrowed_usd,
      released_usd:              Math.round(totalReleased * 100) / 100,
      remaining_escrowed_usd:    Math.round((project.escrowed_usd - totalReleased) * 100) / 100,
      platform_escrow_fees_usd:  Math.round(totalPlatformEscrowFees * 100) / 100,
    },
    progress: {
      overall_pct:             project.progress_pct,
      milestones_total:        project.milestone_count,
      milestones_completed:    project.completed_milestones,
      milestones_in_progress:  milestones.filter(m => m.status === "in_progress").length,
      milestones_pending:      milestones.filter(m => m.status === "pending").length,
    },
    timeline: {
      created_at:          project.created_at,
      started_at:          project.started_at,
      deadline:            project.deadline,
      days_until_deadline: daysUntilDeadline,
      completed_at:        project.completed_at,
      on_track:            daysUntilDeadline != null ? daysUntilDeadline > 0 && project.progress_pct >= (100 - (daysUntilDeadline / 90) * 100) : null,
    },
    milestones: milestones.map(m => ({
      milestone_id:       m.id,
      name:               m.name,
      criteria:           m.criteria,
      status:             m.status,
      progress_pct:       m.progress_pct,
      payment_usd:        m.payment_usd,
      release_fee_usd:    m.release_fee_usd,
      agent_payout_usd:   Math.round((m.payment_usd - m.release_fee_usd) * 100) / 100,
      assigned_agent_id:  m.assigned_agent_id,
      sequence_order:     m.sequence_order,
      notes:              m.notes,
      started_at:         m.started_at,
      completed_at:       m.completed_at,
      payment_released_at: m.payment_released_at,
    })),
    active_assignments: assignments.filter(a => a.status === "active").map(a => ({
      assignment_id: a.id,
      agent_id:      a.agent_id,
      milestone_id:  a.milestone_id,
      role:          a.role,
      assigned_at:   a.assigned_at,
    })),
    recent_activity: recentLogs.map(l => ({
      milestone_id: l.milestone_id,
      progress_pct: l.progress_pct,
      notes:        l.notes,
      logged_at:    l.logged_at,
    })),
    generated_at: new Date().toISOString(),
  };
}

// ─── Release Milestone Payment ────────────────────────────────────────────────

/**
 * Release the escrowed payment for a completed milestone to the assigned agent.
 * @param {string} projectId    - Project ID
 * @param {string} milestoneId  - Milestone ID to release payment for
 * @returns Payment release receipt
 */
export function releaseMilestonePayment(projectId, milestoneId) {
  const project   = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);
  const milestone = db.prepare("SELECT * FROM pm_milestones WHERE id = ? AND project_id = ?").get(milestoneId, projectId);
  if (!project)   throw new Error(`Project not found: ${projectId}`);
  if (!milestone) throw new Error(`Milestone not found: ${milestoneId} in project ${projectId}`);
  if (milestone.status === "completed" && milestone.payment_released_at) {
    throw new Error(`Payment already released for milestone "${milestone.name}" on ${milestone.payment_released_at}`);
  }
  if (!["under_review","in_progress","completed"].includes(milestone.status) && milestone.progress_pct < 100) {
    throw new Error(`Milestone "${milestone.name}" is not ready for payment. Progress: ${milestone.progress_pct}%. Move to under_review or 100% first.`);
  }

  const now             = new Date().toISOString();
  const agentPayout     = Math.round((milestone.payment_usd - milestone.release_fee_usd) * 100) / 100;

  db.prepare(`
    UPDATE pm_milestones
    SET status = 'completed', payment_released_at = @now, completed_at = COALESCE(completed_at, @now), progress_pct = 100
    WHERE id = @id
  `).run({ now, id: milestoneId });

  db.prepare("UPDATE pm_agent_assignments SET status = 'completed', completed_at = ? WHERE milestone_id = ? AND status = 'active'").run(now, milestoneId);
  db.prepare("UPDATE pm_projects SET released_usd = released_usd + ? WHERE id = ?").run(milestone.payment_usd, projectId);

  recomputeProjectProgress(projectId);
  const updatedProject = db.prepare("SELECT * FROM pm_projects WHERE id = ?").get(projectId);

  // Auto-complete project if all milestones done
  const pendingMilestones = db.prepare("SELECT COUNT(*) as n FROM pm_milestones WHERE project_id = ? AND status NOT IN ('completed','skipped','failed')").get(projectId).n;
  if (pendingMilestones === 0) {
    db.prepare("UPDATE pm_projects SET status = 'completed', completed_at = ? WHERE id = ?").run(now, projectId);
  }

  return {
    release_id:           uuid(),
    project_id:           projectId,
    project_name:         project.name,
    milestone_id:         milestoneId,
    milestone_name:       milestone.name,
    assigned_agent_id:    milestone.assigned_agent_id,
    gross_payment_usd:    milestone.payment_usd,
    platform_release_fee_usd: milestone.release_fee_usd,
    agent_net_payout_usd: agentPayout,
    milestone_status:     "completed",
    project_progress_pct: updatedProject.progress_pct,
    total_released_usd:   Math.round((project.released_usd + milestone.payment_usd) * 100) / 100,
    escrowed_remaining_usd: Math.round((project.escrowed_usd - project.released_usd - milestone.payment_usd) * 100) / 100,
    project_completed:    pendingMilestones === 0,
    released_at:          now,
    message:              `$${agentPayout} released to agent ${milestone.assigned_agent_id ?? "unassigned"} for milestone "${milestone.name}". Platform fee: $${milestone.release_fee_usd}.`,
  };
}
