import { v4 as uuid } from "uuid";
import db from "../db.js";

const STEP_FEE_USD      = 0.01; // $0.01 per workflow step executed
const PAYMENT_COMMISSION = 0.05; // 5% on payments within workflows

// ─── Schema Initialization ───────────────────────────

export function initOrchestrationTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      creator_agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      steps TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('draft','active','running','completed','failed','paused')),
      current_step INTEGER DEFAULT 0,
      total_steps INTEGER NOT NULL,
      context TEXT DEFAULT '{}',
      result TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT REFERENCES workflows(id),
      step_number INTEGER NOT NULL,
      agent_id TEXT,
      tool TEXT NOT NULL,
      args TEXT,
      depends_on TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','skipped')),
      input TEXT,
      output TEXT,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS agent_teams (
      id TEXT PRIMARY KEY,
      creator_agent_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      member_ids TEXT NOT NULL,
      roles TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT NOT NULL,
      workflow_id TEXT,
      context TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed')),
      created_at TEXT DEFAULT (datetime('now')),
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orchestration_billing (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      step_id TEXT,
      fee_type TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── Create Workflow ─────────────────────────────────

export function createWorkflow({
  creator_agent_id,
  name,
  description,
  steps,
  context = {},
  status = "active",
}) {
  if (!creator_agent_id) throw new Error("creator_agent_id is required");
  if (!name)             throw new Error("name is required");
  if (!steps || !Array.isArray(steps) || steps.length === 0) throw new Error("steps must be a non-empty array");

  const id = uuid();
  const total_steps = steps.length;

  db.prepare(`
    INSERT INTO workflows (id, creator_agent_id, name, description, steps, status, total_steps, context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, creator_agent_id, name, description || null, JSON.stringify(steps), status, total_steps, JSON.stringify(context));

  // Insert individual step records
  const insertStep = db.prepare(`
    INSERT INTO workflow_steps (id, workflow_id, step_number, agent_id, tool, args, depends_on, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    insertStep.run(
      uuid(), id, i + 1,
      step.agent_id || null,
      step.tool || "unknown",
      step.args ? JSON.stringify(step.args) : null,
      step.depends_on ? JSON.stringify(step.depends_on) : null
    );
  }

  return { workflow_id: id, name, total_steps, status, creator_agent_id };
}

// ─── Start Workflow ──────────────────────────────────

export function startWorkflow({ workflow_id, initial_context }) {
  const wf = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflow_id);
  if (!wf) throw new Error(`Workflow ${workflow_id} not found`);
  if (!["active", "draft"].includes(wf.status)) throw new Error(`Workflow is already ${wf.status}`);

  const started_at = new Date().toISOString();
  const ctx = initial_context
    ? JSON.stringify({ ...JSON.parse(wf.context), ...initial_context })
    : wf.context;

  db.prepare(`
    UPDATE workflows SET status='running', started_at=?, context=?, current_step=0 WHERE id=?
  `).run(started_at, ctx, workflow_id);

  return { workflow_id, status: "running", started_at, total_steps: wf.total_steps };
}

// ─── Execute Step ────────────────────────────────────

export function executeStep({ workflow_id, step_number, input, output, success = true }) {
  const wf = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflow_id);
  if (!wf) throw new Error(`Workflow ${workflow_id} not found`);

  const step = db.prepare(`
    SELECT * FROM workflow_steps WHERE workflow_id = ? AND step_number = ?
  `).get(workflow_id, step_number);
  if (!step) throw new Error(`Step ${step_number} not found in workflow ${workflow_id}`);

  const started_at  = new Date().toISOString();
  const completed_at = new Date().toISOString();
  const duration_ms = Math.floor(Math.random() * 2000) + 100;
  const step_status = success ? "completed" : "failed";

  db.prepare(`
    UPDATE workflow_steps
    SET status=?, input=?, output=?, started_at=?, completed_at=?, duration_ms=?
    WHERE id=?
  `).run(step_status, input ? JSON.stringify(input) : null, output ? JSON.stringify(output) : null,
    started_at, completed_at, duration_ms, step.id);

  // Bill for this step
  const bill_id = uuid();
  db.prepare(`
    INSERT INTO orchestration_billing (id, workflow_id, step_id, fee_type, amount_usd)
    VALUES (?, ?, ?, 'step_execution', ?)
  `).run(bill_id, workflow_id, step.id, STEP_FEE_USD);

  // Advance workflow
  const is_last = step_number >= wf.total_steps;
  const new_status = !success ? "failed"
    : is_last ? "completed"
    : "running";

  db.prepare(`
    UPDATE workflows SET current_step=?, status=?${is_last ? ", completed_at=datetime('now')" : ""} WHERE id=?
  `).run(step_number, new_status, workflow_id);

  return {
    workflow_id,
    step_id: step.id,
    step_number,
    status: step_status,
    duration_ms,
    step_fee_usd: STEP_FEE_USD,
    workflow_status: new_status,
    completed_at,
  };
}

// ─── Create Team ─────────────────────────────────────

export function createTeam({ creator_agent_id, name, description, member_ids, roles }) {
  if (!creator_agent_id) throw new Error("creator_agent_id is required");
  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    throw new Error("member_ids must be a non-empty array");
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO agent_teams (id, creator_agent_id, name, description, member_ids, roles)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, creator_agent_id, name || null, description || null,
    JSON.stringify(member_ids), roles ? JSON.stringify(roles) : null);

  return { team_id: id, name, creator_agent_id, member_count: member_ids.length, status: "active" };
}

// ─── Handoff ─────────────────────────────────────────

export function handoff({ from_agent_id, to_agent_id, workflow_id, context }) {
  if (!from_agent_id) throw new Error("from_agent_id is required");
  if (!to_agent_id)   throw new Error("to_agent_id is required");
  if (!context)       throw new Error("context is required");

  const id = uuid();
  db.prepare(`
    INSERT INTO handoffs (id, from_agent_id, to_agent_id, workflow_id, context, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, from_agent_id, to_agent_id, workflow_id || null, JSON.stringify(context));

  return {
    handoff_id: id,
    from_agent_id,
    to_agent_id,
    workflow_id,
    status: "pending",
    created_at: new Date().toISOString(),
  };
}

// ─── Accept Handoff ──────────────────────────────────

export function acceptHandoff({ handoff_id, accepting_agent_id, accepted = true }) {
  const h = db.prepare("SELECT * FROM handoffs WHERE id = ?").get(handoff_id);
  if (!h) throw new Error(`Handoff ${handoff_id} not found`);
  if (h.status !== "pending") throw new Error(`Handoff is already ${h.status}`);
  if (h.to_agent_id !== accepting_agent_id) {
    throw new Error(`Agent ${accepting_agent_id} is not the intended recipient of this handoff`);
  }

  const new_status  = accepted ? "accepted" : "rejected";
  const accepted_at = new Date().toISOString();
  db.prepare(`
    UPDATE handoffs SET status=?, accepted_at=? WHERE id=?
  `).run(new_status, accepted_at, handoff_id);

  return {
    handoff_id,
    status: new_status,
    accepted_at,
    context: JSON.parse(h.context),
  };
}

// ─── Get Workflow ────────────────────────────────────

export function getWorkflow(workflow_id) {
  const wf = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflow_id);
  if (!wf) throw new Error(`Workflow ${workflow_id} not found`);
  const steps   = db.prepare("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_number").all(workflow_id);
  const billing = db.prepare("SELECT COALESCE(SUM(amount_usd),0) as total FROM orchestration_billing WHERE workflow_id=?").get(workflow_id);
  return {
    ...wf,
    steps_parsed: steps,
    total_fees_usd: billing?.total ?? 0,
  };
}

// ─── Agent Workflows ─────────────────────────────────

export function getAgentWorkflows(creator_agent_id) {
  const workflows = db.prepare("SELECT * FROM workflows WHERE creator_agent_id = ? ORDER BY created_at DESC").all(creator_agent_id);
  const teams     = db.prepare("SELECT * FROM agent_teams WHERE creator_agent_id = ? OR member_ids LIKE ?").all(creator_agent_id, `%${creator_agent_id}%`);
  const handoffs_sent     = db.prepare("SELECT * FROM handoffs WHERE from_agent_id = ? ORDER BY created_at DESC LIMIT 20").all(creator_agent_id);
  const handoffs_received = db.prepare("SELECT * FROM handoffs WHERE to_agent_id = ? ORDER BY created_at DESC LIMIT 20").all(creator_agent_id);
  const total_steps_run   = db.prepare("SELECT COUNT(*) as n FROM workflow_steps ws JOIN workflows w ON ws.workflow_id=w.id WHERE w.creator_agent_id=? AND ws.status='completed'").get(creator_agent_id);

  return {
    workflows,
    teams,
    handoffs_sent,
    handoffs_received,
    total_steps_executed: total_steps_run?.n ?? 0,
    total_step_fees_usd: Math.round(((total_steps_run?.n ?? 0) * STEP_FEE_USD) * 100) / 100,
  };
}

// ─── Orchestration Stats ─────────────────────────────

export function getOrchestrationStats() {
  const total_workflows   = db.prepare("SELECT COUNT(*) as n FROM workflows").get().n;
  const running_workflows = db.prepare("SELECT COUNT(*) as n FROM workflows WHERE status='running'").get().n;
  const completed_wf      = db.prepare("SELECT COUNT(*) as n FROM workflows WHERE status='completed'").get().n;
  const total_steps       = db.prepare("SELECT COUNT(*) as n FROM workflow_steps WHERE status='completed'").get().n;
  const total_teams       = db.prepare("SELECT COUNT(*) as n FROM agent_teams WHERE status='active'").get().n;
  const total_handoffs    = db.prepare("SELECT COUNT(*) as n FROM handoffs").get().n;
  const total_revenue     = db.prepare("SELECT COALESCE(SUM(amount_usd),0) as s FROM orchestration_billing").get().s;

  return {
    total_workflows,
    running_workflows,
    completed_workflows: completed_wf,
    total_steps_executed: total_steps,
    active_teams: total_teams,
    total_handoffs,
    total_revenue_usd: Math.round(total_revenue * 100) / 100,
    step_fee_usd: STEP_FEE_USD,
    payment_commission: `${PAYMENT_COMMISSION * 100}%`,
  };
}
