import { v4 as uuid } from "uuid";
import db from "../db.js";

/**
 * Incident Status Service
 *
 * A lightweight incident/status-page style backend for agents to:
 * - declare incidents
 * - post updates
 * - resolve incidents
 * - generate an uptime summary
 */

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    severity          TEXT NOT NULL CHECK(severity IN ('minor','major','critical')),
    status            TEXT NOT NULL CHECK(status IN ('investigating','identified','monitoring','resolved')),
    component         TEXT NOT NULL,
    started_at        TEXT NOT NULL,
    resolved_at       TEXT,
    created_by        TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incident_updates (
    id           TEXT PRIMARY KEY,
    incident_id  TEXT NOT NULL REFERENCES incidents(id),
    status       TEXT NOT NULL CHECK(status IN ('investigating','identified','monitoring','resolved')),
    message      TEXT NOT NULL,
    posted_by    TEXT,
    posted_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
  CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id);
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function normalizeSeverity(severity) {
  const s = (severity ?? "").toLowerCase();
  if (!["minor", "major", "critical"].includes(s)) {
    throw new Error("severity must be one of: minor|major|critical");
  }
  return s;
}

function normalizeStatus(status) {
  const s = (status ?? "").toLowerCase();
  if (!["investigating", "identified", "monitoring", "resolved"].includes(s)) {
    throw new Error("status must be one of: investigating|identified|monitoring|resolved");
  }
  return s;
}

function validateComponent(component) {
  if (!component || typeof component !== "string") throw new Error("component is required");
  if (component.length > 80) throw new Error("component too long (max 80 chars)");
  return component;
}

function incidentToPublic(incident) {
  return {
    incident_id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    component: incident.component,
    started_at: incident.started_at,
    resolved_at: incident.resolved_at,
    created_by: incident.created_by,
    created_at: incident.created_at,
  };
}

// ─── Create incident ─────────────────────────────────────────────────────────-

/**
 * Declare a new incident.
 * @param {string} title
 * @param {string} component
 * @param {'minor'|'major'|'critical'} severity
 * @param {string} createdBy
 */
export function incidentDeclare(title, component, severity = "minor", createdBy = null) {
  if (!title || typeof title !== "string") throw new Error("title is required");

  const id = uuid();
  const sev = normalizeSeverity(severity);
  const comp = validateComponent(component);
  const startedAt = nowIso();
  const status = "investigating";

  db.prepare(`
    INSERT INTO incidents (id, title, severity, status, component, started_at, resolved_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(id, title, sev, status, comp, startedAt, createdBy);

  // initial update
  const updateId = uuid();
  db.prepare(`
    INSERT INTO incident_updates (id, incident_id, status, message, posted_by, posted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(updateId, id, status, `Incident declared: ${title}`, createdBy, startedAt);

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  return {
    ...incidentToPublic(incident),
    initial_update_id: updateId,
  };
}

// ─── Post update ─────────────────────────────────────────────────────────────-

/**
 * Post a status update to an incident.
 * @param {string} incidentId
 * @param {'investigating'|'identified'|'monitoring'|'resolved'} status
 * @param {string} message
 * @param {string} postedBy
 */
export function incidentPostUpdate(incidentId, status, message, postedBy = null) {
  if (!incidentId) throw new Error("incidentId is required");
  if (!message || typeof message !== "string") throw new Error("message is required");

  const newStatus = normalizeStatus(status);
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId);
  if (!incident) throw new Error(`incident not found: ${incidentId}`);
  if (incident.status === "resolved") throw new Error("cannot update a resolved incident");

  const postedAt = nowIso();
  const updateId = uuid();

  db.prepare(`
    INSERT INTO incident_updates (id, incident_id, status, message, posted_by, posted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(updateId, incidentId, newStatus, message, postedBy, postedAt);

  db.prepare("UPDATE incidents SET status = ? WHERE id = ?").run(newStatus, incidentId);

  if (newStatus === "resolved") {
    db.prepare("UPDATE incidents SET resolved_at = ? WHERE id = ?").run(postedAt, incidentId);
  }

  const updated = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId);
  return {
    update_id: updateId,
    incident: incidentToPublic(updated),
  };
}

// ─── Resolve incident (shortcut) ─────────────────────────────────────────────-

/**
 * Resolve an incident with a final message.
 */
export function incidentResolve(incidentId, message = "Incident resolved", postedBy = null) {
  return incidentPostUpdate(incidentId, "resolved", message, postedBy);
}

// ─── List incidents ─────────────────────────────────────────────────────────-

/**
 * List incidents filtered by status.
 * @param {'open'|'resolved'|'all'} filter
 */
export function incidentList(filter = "open") {
  const f = (filter ?? "open").toLowerCase();
  if (!["open", "resolved", "all"].includes(f)) throw new Error("filter must be open|resolved|all");

  let rows;
  if (f === "open") {
    rows = db.prepare("SELECT * FROM incidents WHERE status != 'resolved' ORDER BY started_at DESC LIMIT 50").all();
  } else if (f === "resolved") {
    rows = db.prepare("SELECT * FROM incidents WHERE status = 'resolved' ORDER BY resolved_at DESC LIMIT 50").all();
  } else {
    rows = db.prepare("SELECT * FROM incidents ORDER BY started_at DESC LIMIT 100").all();
  }

  return rows.map(incidentToPublic);
}

// ─── Incident details ────────────────────────────────────────────────────────

export function incidentGet(incidentId) {
  if (!incidentId) throw new Error("incidentId is required");
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId);
  if (!incident) throw new Error(`incident not found: ${incidentId}`);

  const updates = db
    .prepare(
      "SELECT id, status, message, posted_by, posted_at FROM incident_updates WHERE incident_id = ? ORDER BY posted_at ASC"
    )
    .all(incidentId);

  return {
    incident: incidentToPublic(incident),
    updates,
  };
}

// ─── Uptime summary ─────────────────────────────────────────────────────────-

/**
 * Compute a simple uptime report for a component over the last N days.
 * Notes:
 * - Uses incident duration as downtime.
 * - For open incidents, counts downtime up to now.
 */
export function incidentUptimeSummary(component, days = 7) {
  const comp = validateComponent(component);
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0 || d > 365) throw new Error("days must be between 1 and 365");

  const now = Date.now();
  const windowStart = now - d * 24 * 60 * 60 * 1000;

  const incidents = db
    .prepare(
      "SELECT * FROM incidents WHERE component = ? AND started_at >= datetime(?, 'unixepoch') ORDER BY started_at ASC"
    )
    .all(comp, Math.floor(windowStart / 1000));

  let downtimeMs = 0;

  for (const inc of incidents) {
    const startMs = new Date(inc.started_at).getTime();
    const endMs = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;

    const clampedStart = Math.max(startMs, windowStart);
    const clampedEnd = Math.min(endMs, now);

    if (clampedEnd > clampedStart) downtimeMs += clampedEnd - clampedStart;
  }

  const totalMs = d * 24 * 60 * 60 * 1000;
  const uptimePct = Math.max(0, Math.min(100, (1 - downtimeMs / totalMs) * 100));

  return {
    component: comp,
    window_days: d,
    incidents_count: incidents.length,
    downtime_minutes: Math.round(downtimeMs / 60000),
    uptime_percent: Math.round(uptimePct * 1000) / 1000,
    generated_at: nowIso(),
  };
}
