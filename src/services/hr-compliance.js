import { v4 as uuid } from "uuid";
import db from "../db.js";

// HR Compliance & Training
// Lightweight primitives for policy acknowledgements, training assignments,
// and compliance attestations (SOC2 / ISO 27001 / HR policy).

// ─── Schema Init ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hr_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    summary TEXT,
    effective_date TEXT,
    owner TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hr_employees (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    department TEXT,
    location TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hr_acknowledgements (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    acknowledged_at TEXT DEFAULT (datetime('now')),
    method TEXT DEFAULT 'attestation',
    notes TEXT,
    UNIQUE(employee_id, policy_id, policy_version)
  );

  CREATE TABLE IF NOT EXISTS hr_trainings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    provider TEXT,
    url TEXT,
    estimated_minutes INTEGER DEFAULT 30,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hr_training_assignments (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    training_id TEXT NOT NULL,
    training_version TEXT NOT NULL,
    due_date TEXT,
    status TEXT DEFAULT 'assigned',
    assigned_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    completion_evidence TEXT,
    UNIQUE(employee_id, training_id, training_version)
  );
`);

function isoDate(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export function createPolicy({ name, version = "1.0", summary, effective_date, owner, url }) {
  if (!name) throw new Error("name is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO hr_policies (id, name, version, summary, effective_date, owner, url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, String(version), summary || null, isoDate(effective_date), owner || null, url || null);
  return getPolicy(id);
}

export function listPolicies({ limit = 50 } = {}) {
  return db
    .prepare(
      `SELECT * FROM hr_policies
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getPolicy(id) {
  const row = db.prepare("SELECT * FROM hr_policies WHERE id = ?").get(id);
  if (!row) throw new Error("Policy not found");
  return row;
}

// ─── Employees ────────────────────────────────────────────────────────────────

export function upsertEmployee({ employee_id, name, email, role, department, location, status = "active" }) {
  const id = employee_id || uuid();
  const existing = db.prepare("SELECT id FROM hr_employees WHERE id = ?").get(id);
  if (existing) {
    db.prepare(
      `UPDATE hr_employees
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           role = COALESCE(?, role),
           department = COALESCE(?, department),
           location = COALESCE(?, location),
           status = COALESCE(?, status)
       WHERE id = ?`
    ).run(name || null, email || null, role || null, department || null, location || null, status || null, id);
  } else {
    db.prepare(
      `INSERT INTO hr_employees (id, name, email, role, department, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name || null, email || null, role || null, department || null, location || null, status || "active");
  }
  return getEmployee(id);
}

export function getEmployee(id) {
  const row = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(id);
  if (!row) throw new Error("Employee not found");
  return row;
}

export function listEmployees({ status, limit = 100 } = {}) {
  if (status) {
    return db
      .prepare(
        `SELECT * FROM hr_employees WHERE status = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      )
      .all(status, limit);
  }
  return db
    .prepare(
      `SELECT * FROM hr_employees
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);
}

// ─── Acknowledgements ─────────────────────────────────────────────────────────

export function acknowledgePolicy({ employee_id, policy_id, policy_version, method = "attestation", notes }) {
  if (!employee_id) throw new Error("employee_id is required");
  if (!policy_id) throw new Error("policy_id is required");
  if (!policy_version) throw new Error("policy_version is required");

  // Ensure employee + policy exist
  getEmployee(employee_id);
  const policy = getPolicy(policy_id);

  const id = uuid();
  db.prepare(
    `INSERT OR IGNORE INTO hr_acknowledgements
     (id, employee_id, policy_id, policy_version, method, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, employee_id, policy_id, String(policy_version), method, notes || null);

  const ack = db
    .prepare(
      `SELECT * FROM hr_acknowledgements
       WHERE employee_id = ? AND policy_id = ? AND policy_version = ?`
    )
    .get(employee_id, policy_id, String(policy_version));

  return { ...ack, policy_name: policy.name, policy_current_version: policy.version };
}

export function getPolicyStatus({ employee_id, policy_id }) {
  if (!employee_id) throw new Error("employee_id is required");
  if (!policy_id) throw new Error("policy_id is required");

  const policy = getPolicy(policy_id);
  const acks = db
    .prepare(
      `SELECT * FROM hr_acknowledgements
       WHERE employee_id = ? AND policy_id = ?
       ORDER BY datetime(acknowledged_at) DESC`
    )
    .all(employee_id, policy_id);

  const latest = acks[0] || null;
  const up_to_date = latest ? latest.policy_version === policy.version : false;

  return {
    employee_id,
    policy_id,
    policy_name: policy.name,
    policy_version_current: policy.version,
    acknowledged_versions: acks.map((a) => a.policy_version),
    last_acknowledged_at: latest ? latest.acknowledged_at : null,
    up_to_date,
  };
}

// ─── Training ────────────────────────────────────────────────────────────────

export function createTraining({ name, version = "1.0", provider, url, estimated_minutes = 30, description }) {
  if (!name) throw new Error("name is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO hr_trainings (id, name, version, provider, url, estimated_minutes, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, String(version), provider || null, url || null, Number(estimated_minutes) || 30, description || null);
  return getTraining(id);
}

export function listTrainings({ limit = 50 } = {}) {
  return db
    .prepare(
      `SELECT * FROM hr_trainings
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getTraining(id) {
  const row = db.prepare("SELECT * FROM hr_trainings WHERE id = ?").get(id);
  if (!row) throw new Error("Training not found");
  return row;
}

export function assignTraining({ employee_id, training_id, training_version, due_date }) {
  if (!employee_id) throw new Error("employee_id is required");
  if (!training_id) throw new Error("training_id is required");
  if (!training_version) throw new Error("training_version is required");

  // Ensure employee + training exist
  getEmployee(employee_id);
  const training = getTraining(training_id);

  const id = uuid();
  db.prepare(
    `INSERT OR IGNORE INTO hr_training_assignments
     (id, employee_id, training_id, training_version, due_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, employee_id, training_id, String(training_version), isoDate(due_date));

  const row = db
    .prepare(
      `SELECT * FROM hr_training_assignments
       WHERE employee_id = ? AND training_id = ? AND training_version = ?`
    )
    .get(employee_id, training_id, String(training_version));

  return { ...row, training_name: training.name, training_current_version: training.version };
}

export function completeTraining({ assignment_id, completion_evidence }) {
  if (!assignment_id) throw new Error("assignment_id is required");
  const row = db.prepare("SELECT * FROM hr_training_assignments WHERE id = ?").get(assignment_id);
  if (!row) throw new Error("Assignment not found");

  db.prepare(
    `UPDATE hr_training_assignments
     SET status = 'completed', completed_at = datetime('now'), completion_evidence = ?
     WHERE id = ?`
  ).run(completion_evidence || null, assignment_id);

  return db.prepare("SELECT * FROM hr_training_assignments WHERE id = ?").get(assignment_id);
}

export function trainingCompletionReport({ due_before, status, limit = 200 } = {}) {
  let sql = `SELECT * FROM hr_training_assignments`;
  const where = [];
  const params = [];

  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (due_before) {
    where.push("due_date IS NOT NULL AND due_date <= ?");
    params.push(isoDate(due_before));
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY datetime(assigned_at) DESC LIMIT ?`;
  params.push(limit);

  const assignments = db.prepare(sql).all(...params);

  const employeeIds = [...new Set(assignments.map((a) => a.employee_id))];
  const trainingIds = [...new Set(assignments.map((a) => a.training_id))];

  const employees = employeeIds.length
    ? db
        .prepare(`SELECT * FROM hr_employees WHERE id IN (${employeeIds.map(() => "?").join(",")})`)
        .all(...employeeIds)
    : [];

  const trainings = trainingIds.length
    ? db
        .prepare(`SELECT * FROM hr_trainings WHERE id IN (${trainingIds.map(() => "?").join(",")})`)
        .all(...trainingIds)
    : [];

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const trById = Object.fromEntries(trainings.map((t) => [t.id, t]));

  return assignments.map((a) => ({
    ...a,
    employee: empById[a.employee_id] || null,
    training: trById[a.training_id] || null,
  }));
}
