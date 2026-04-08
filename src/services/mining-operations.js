import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS mining_sites (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    commodity         TEXT NOT NULL,
    country           TEXT,
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','care_and_maintenance','closed')),
    owner             TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mining_incidents (
    id                TEXT PRIMARY KEY,
    site_id           TEXT REFERENCES mining_sites(id),
    category          TEXT NOT NULL CHECK(category IN ('safety','environment','security','equipment')),
    severity          TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    description       TEXT NOT NULL,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','mitigated','closed')),
    reported_at       TEXT DEFAULT (datetime('now')),
    closed_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS mining_maintenance_workorders (
    id                TEXT PRIMARY KEY,
    site_id           TEXT REFERENCES mining_sites(id),
    asset_tag         TEXT NOT NULL,
    issue             TEXT NOT NULL,
    priority          TEXT DEFAULT 'p2' CHECK(priority IN ('p0','p1','p2','p3')),
    status            TEXT DEFAULT 'queued' CHECK(status IN ('queued','in_progress','completed','cancelled')),
    estimated_hours   REAL,
    actual_hours      REAL,
    created_at        TEXT DEFAULT (datetime('now')),
    completed_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS mining_ore_batches (
    id                TEXT PRIMARY KEY,
    site_id           TEXT REFERENCES mining_sites(id),
    batch_code        TEXT NOT NULL,
    tonnage           REAL NOT NULL,
    grade_gpt         REAL,
    moisture_pct      REAL,
    status            TEXT DEFAULT 'in_stockpile' CHECK(status IN ('in_stockpile','in_transit','delivered')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed ────────────────────────────────────────────────────────────────────

const _siteCount = db.prepare("SELECT COUNT(*) as n FROM mining_sites").get().n;
if (_siteCount === 0) {
  const seed = [
    { id: uuid(), name: "Red Ridge Open Pit", commodity: "copper", country: "Chile", status: "active", owner: "Ridge Metals" },
    { id: uuid(), name: "North Basin Underground", commodity: "nickel", country: "Canada", status: "active", owner: "Basin Mining Co" },
    { id: uuid(), name: "Kalahari Tailings Reclaim", commodity: "manganese", country: "South Africa", status: "care_and_maintenance", owner: "Kalahari Resources" },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO mining_sites (id, name, commodity, country, status, owner)
    VALUES (@id, @name, @commodity, @country, @status, @owner)
  `);
  for (const s of seed) insert.run(s);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskScore(severity, category) {
  const sev = { low: 10, medium: 30, high: 70, critical: 95 }[severity] ?? 30;
  const cat = { safety: 1.2, environment: 1.1, security: 1.0, equipment: 0.9 }[category] ?? 1.0;
  return Math.min(100, Math.round(sev * cat));
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export function miningRegisterSite(name, commodity, country, owner) {
  if (!name) throw new Error("name is required");
  if (!commodity) throw new Error("commodity is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO mining_sites (id, name, commodity, country, status, owner)
     VALUES (?, ?, ?, ?, 'active', ?)`
  ).run(id, name, commodity, country ?? null, owner ?? null);
  return db.prepare("SELECT * FROM mining_sites WHERE id = ?").get(id);
}

export function miningReportIncident(siteId, category, severity, description) {
  if (!siteId) throw new Error("siteId is required");
  const site = db.prepare("SELECT * FROM mining_sites WHERE id = ?").get(siteId);
  if (!site) throw new Error(`mining site not found: ${siteId}`);
  if (!["safety", "environment", "security", "equipment"].includes(category)) throw new Error("category must be safety|environment|security|equipment");
  if (!["low", "medium", "high", "critical"].includes(severity)) throw new Error("severity must be low|medium|high|critical");
  if (!description) throw new Error("description is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO mining_incidents (id, site_id, category, severity, description, status)
     VALUES (?, ?, ?, ?, ?, 'open')`
  ).run(id, siteId, category, severity, description);

  return {
    incident: db.prepare("SELECT * FROM mining_incidents WHERE id = ?").get(id),
    risk_score: riskScore(severity, category),
    recommended_actions:
      category === "safety"
        ? ["Stop work in affected area", "Verify isolation/LOTO", "Conduct pre-start risk assessment", "Notify safety lead"]
        : category === "environment"
          ? ["Contain source", "Start sampling & logging", "Notify environmental officer", "Prepare regulator notification draft"]
          : category === "security"
            ? ["Lock down access points", "Preserve evidence", "Notify security lead", "Review CCTV and access logs"]
            : ["Isolate asset", "Create maintenance work order", "Check spares availability", "Assess downtime impact"],
  };
}

export function miningCreateWorkOrder(siteId, assetTag, issue, priority = "p2", estimatedHours = 2) {
  if (!siteId) throw new Error("siteId is required");
  const site = db.prepare("SELECT * FROM mining_sites WHERE id = ?").get(siteId);
  if (!site) throw new Error(`mining site not found: ${siteId}`);
  if (!assetTag) throw new Error("assetTag is required");
  if (!issue) throw new Error("issue is required");
  if (!["p0", "p1", "p2", "p3"].includes(priority)) throw new Error("priority must be p0|p1|p2|p3");

  const id = uuid();
  db.prepare(
    `INSERT INTO mining_maintenance_workorders
      (id, site_id, asset_tag, issue, priority, status, estimated_hours)
     VALUES (?, ?, ?, ?, ?, 'queued', ?)`
  ).run(id, siteId, assetTag, issue, priority, Number(estimatedHours ?? 2));

  return db.prepare("SELECT * FROM mining_maintenance_workorders WHERE id = ?").get(id);
}

export function miningLogOreBatch(siteId, batchCode, tonnage, gradeGpt = null, moisturePct = null) {
  if (!siteId) throw new Error("siteId is required");
  const site = db.prepare("SELECT * FROM mining_sites WHERE id = ?").get(siteId);
  if (!site) throw new Error(`mining site not found: ${siteId}`);
  if (!batchCode) throw new Error("batchCode is required");
  if (tonnage == null || Number(tonnage) <= 0) throw new Error("tonnage must be > 0");

  const id = uuid();
  db.prepare(
    `INSERT INTO mining_ore_batches (id, site_id, batch_code, tonnage, grade_gpt, moisture_pct, status)
     VALUES (?, ?, ?, ?, ?, ?, 'in_stockpile')`
  ).run(id, siteId, batchCode, Number(tonnage), gradeGpt == null ? null : Number(gradeGpt), moisturePct == null ? null : Number(moisturePct));

  const batch = db.prepare("SELECT * FROM mining_ore_batches WHERE id = ?").get(id);
  const contained_grams = batch.grade_gpt == null ? null : Math.round(batch.tonnage * batch.grade_gpt * 100) / 100;
  const dry_tonnage = batch.moisture_pct == null ? null : Math.round(batch.tonnage * (1 - (batch.moisture_pct / 100)) * 100) / 100;
  return { batch, contained_grams, dry_tonnage };
}

export function miningDashboard() {
  const sites = db.prepare("SELECT * FROM mining_sites ORDER BY created_at DESC").all();
  const openIncidents = db.prepare(
    "SELECT * FROM mining_incidents WHERE status IN ('open','mitigated') ORDER BY reported_at DESC LIMIT 50"
  ).all();
  const workOrders = db.prepare(
    "SELECT * FROM mining_maintenance_workorders WHERE status IN ('queued','in_progress') ORDER BY created_at DESC LIMIT 50"
  ).all();
  const oreBatches = db.prepare(
    "SELECT * FROM mining_ore_batches ORDER BY created_at DESC LIMIT 25"
  ).all();

  const incidentRiskTotal = openIncidents.reduce((acc, i) => acc + riskScore(i.severity, i.category), 0);
  return {
    sites,
    open_incidents: openIncidents,
    active_work_orders: workOrders,
    recent_ore_batches: oreBatches,
    headline_metrics: {
      site_count: sites.length,
      open_incident_count: openIncidents.length,
      active_work_order_count: workOrders.length,
      avg_open_incident_risk_score: openIncidents.length ? Math.round((incidentRiskTotal / openIncidents.length) * 10) / 10 : 0,
    },
  };
}
