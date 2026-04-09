import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Pricing / Revenue Configuration ───────────────────────────────────────────

const QA_PLATFORM_COMMISSION = 0.10; // 10% platform cut
const SEVERITY_MULTIPLIERS = { low: 1.0, medium: 1.35, high: 1.8, critical: 2.4 };

// ─── Schema Initialization ────────────────────────────────────────────────────

// Models factory QA workflows: incoming inspection, defect triage, CAPA tickets.

// NOTE: Intentionally minimal + auditable. External integrations (MES/ERP/QMS)
// should be wired by live services; this module focuses on canonical records.

db.exec(`
  CREATE TABLE IF NOT EXISTS qa_lots (
    id                TEXT PRIMARY KEY,
    org_id             TEXT NOT NULL,
    sku               TEXT NOT NULL,
    supplier          TEXT,
    received_at       TEXT,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','accepted','rejected','quarantined')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS qa_inspections (
    id                TEXT PRIMARY KEY,
    lot_id            TEXT REFERENCES qa_lots(id),
    inspection_type   TEXT NOT NULL CHECK(inspection_type IN (
                        'incoming','in_process','final','audit')),
    checklist_json    TEXT NOT NULL,
    findings_json     TEXT,
    status            TEXT DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','needs_review')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS qa_defects (
    id                TEXT PRIMARY KEY,
    lot_id            TEXT REFERENCES qa_lots(id),
    inspection_id     TEXT REFERENCES qa_inspections(id),
    title             TEXT NOT NULL,
    description       TEXT,
    severity          TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','triaged','in_remediation','verified','closed')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS qa_capa (
    id                TEXT PRIMARY KEY,
    defect_id         TEXT REFERENCES qa_defects(id),
    root_cause        TEXT,
    corrective_action TEXT,
    preventive_action TEXT,
    owner             TEXT,
    due_date          TEXT,
    status            TEXT DEFAULT 'draft' CHECK(status IN ('draft','active','completed','overdue')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function quoteQaCostUsd(severity = "medium", inspectionType = "incoming") {
  const baseByType = { incoming: 9.0, in_process: 7.0, final: 12.0, audit: 20.0 };
  const base = baseByType[inspectionType] ?? 9.0;
  const multiplier = SEVERITY_MULTIPLIERS[severity] ?? 1.0;
  const price = Math.round(base * multiplier * 100) / 100;
  const commission = Math.round(price * QA_PLATFORM_COMMISSION * 100) / 100;
  return { quoted_price_usd: price, commission_usd: commission };
}

function ensureJsonObject(obj, label) {
  if (!obj || typeof obj !== "object") throw new Error(`${label} must be an object`);
}

// ─── API: Lots ────────────────────────────────────────────────────────────────

export function createQaLot(orgId, sku, supplier = null, receivedAt = null) {
  if (!orgId) throw new Error("orgId is required");
  if (!sku) throw new Error("sku is required");

  const id = uuid();
  db.prepare(`
    INSERT INTO qa_lots (id, org_id, sku, supplier, received_at, status)
    VALUES (@id, @org_id, @sku, @supplier, @received_at, 'open')
  `).run({ id, org_id: orgId, sku, supplier, received_at: receivedAt ?? new Date().toISOString() });

  return { lot_id: id, org_id: orgId, sku, supplier, status: "open" };
}

export function updateQaLotStatus(lotId, status) {
  if (!lotId) throw new Error("lotId is required");
  if (!["open","accepted","rejected","quarantined"].includes(status)) throw new Error("invalid status");
  const lot = db.prepare("SELECT * FROM qa_lots WHERE id = ?").get(lotId);
  if (!lot) throw new Error(`lot not found: ${lotId}`);
  db.prepare("UPDATE qa_lots SET status = ? WHERE id = ?").run(status, lotId);
  return { lot_id: lotId, previous_status: lot.status, status };
}

// ─── API: Inspections ─────────────────────────────────────────────────────────

export function createInspection(lotId, inspectionType, checklist) {
  if (!lotId) throw new Error("lotId is required");
  if (!["incoming","in_process","final","audit"].includes(inspectionType)) throw new Error("invalid inspectionType");
  ensureJsonObject(checklist, "checklist");

  const lot = db.prepare("SELECT * FROM qa_lots WHERE id = ?").get(lotId);
  if (!lot) throw new Error(`lot not found: ${lotId}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO qa_inspections (id, lot_id, inspection_type, checklist_json, status)
    VALUES (@id, @lot_id, @inspection_type, @checklist_json, 'pending')
  `).run({ id, lot_id: lotId, inspection_type: inspectionType, checklist_json: JSON.stringify(checklist) });

  return { inspection_id: id, lot_id: lotId, inspection_type: inspectionType, status: "pending" };
}

export function recordInspectionFindings(inspectionId, findings) {
  if (!inspectionId) throw new Error("inspectionId is required");
  ensureJsonObject(findings, "findings");

  const insp = db.prepare("SELECT * FROM qa_inspections WHERE id = ?").get(inspectionId);
  if (!insp) throw new Error(`inspection not found: ${inspectionId}`);

  // Minimal heuristic: if any finding has failed=true, mark failed.
  const items = Array.isArray(findings?.items) ? findings.items : [];
  const hasFail = items.some((i) => i?.failed === true);
  const status = hasFail ? "failed" : "passed";

  db.prepare("UPDATE qa_inspections SET findings_json = ?, status = ? WHERE id = ?").run(JSON.stringify(findings), status, inspectionId);

  const pricing = quoteQaCostUsd(findings?.severity ?? "medium", insp.inspection_type);

  return { inspection_id: inspectionId, status, ...pricing };
}

// ─── API: Defects + CAPA ──────────────────────────────────────────────────────

export function createDefect(lotId, inspectionId, title, description = null, severity = "medium") {
  if (!lotId) throw new Error("lotId is required");
  if (!title) throw new Error("title is required");
  if (!["low","medium","high","critical"].includes(severity)) throw new Error("invalid severity");

  const lot = db.prepare("SELECT * FROM qa_lots WHERE id = ?").get(lotId);
  if (!lot) throw new Error(`lot not found: ${lotId}`);

  if (inspectionId) {
    const insp = db.prepare("SELECT * FROM qa_inspections WHERE id = ?").get(inspectionId);
    if (!insp) throw new Error(`inspection not found: ${inspectionId}`);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO qa_defects (id, lot_id, inspection_id, title, description, severity, status)
    VALUES (@id, @lot_id, @inspection_id, @title, @description, @severity, 'open')
  `).run({ id, lot_id: lotId, inspection_id: inspectionId ?? null, title, description, severity });

  const pricing = quoteQaCostUsd(severity, "incoming");

  return { defect_id: id, lot_id: lotId, inspection_id: inspectionId ?? null, severity, status: "open", ...pricing };
}

export function createCapa(defectId, fields = {}) {
  if (!defectId) throw new Error("defectId is required");
  ensureJsonObject(fields, "fields");

  const defect = db.prepare("SELECT * FROM qa_defects WHERE id = ?").get(defectId);
  if (!defect) throw new Error(`defect not found: ${defectId}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO qa_capa (id, defect_id, root_cause, corrective_action, preventive_action, owner, due_date, status)
    VALUES (@id, @defect_id, @root_cause, @corrective_action, @preventive_action, @owner, @due_date, 'draft')
  `).run({
    id,
    defect_id: defectId,
    root_cause: fields.root_cause ?? null,
    corrective_action: fields.corrective_action ?? null,
    preventive_action: fields.preventive_action ?? null,
    owner: fields.owner ?? null,
    due_date: fields.due_date ?? null,
  });

  return { capa_id: id, defect_id: defectId, status: "draft" };
}
