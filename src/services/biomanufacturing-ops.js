import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS bio_batches (
    id               TEXT PRIMARY KEY,
    product          TEXT NOT NULL,
    facility         TEXT NOT NULL,
    process_type     TEXT NOT NULL CHECK(process_type IN ('fermentation','cell_culture','purification','fill_finish')),
    status           TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','qa_hold','released','rejected')),
    target_yield     REAL,
    actual_yield     REAL,
    start_time_utc   TEXT DEFAULT (datetime('now')),
    end_time_utc     TEXT,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bio_deviations (
    id              TEXT PRIMARY KEY,
    batch_id        TEXT REFERENCES bio_batches(id),
    deviation_type  TEXT NOT NULL CHECK(deviation_type IN ('contamination','out_of_spec','equipment_failure','documentation','environmental')),
    severity        TEXT NOT NULL CHECK(severity IN ('minor','major','critical')),
    description     TEXT NOT NULL,
    status          TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','capa','closed')),
    created_at      TEXT DEFAULT (datetime('now')),
    closed_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS bio_capas (
    id              TEXT PRIMARY KEY,
    deviation_id    TEXT REFERENCES bio_deviations(id),
    action_type     TEXT NOT NULL CHECK(action_type IN ('corrective','preventive')),
    owner           TEXT,
    due_date_utc    TEXT,
    status          TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','verified','closed')),
    action          TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bio_environmental_reads (
    id              TEXT PRIMARY KEY,
    facility        TEXT NOT NULL,
    area            TEXT NOT NULL,
    sample_type     TEXT NOT NULL CHECK(sample_type IN ('air','surface','water','personnel')),
    metric          TEXT NOT NULL CHECK(metric IN ('cfu','particles')),
    value           REAL NOT NULL,
    limit_value     REAL NOT NULL,
    sampled_at_utc  TEXT DEFAULT (datetime('now')),
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed ────────────────────────────────────────────────────────────────────

const _batchCount = db.prepare("SELECT COUNT(*) as n FROM bio_batches").get().n;
if (_batchCount === 0) {
  const seedBatches = [
    {
      id: uuid(),
      product: "mRNA vaccine bulk",
      facility: "Plant A",
      process_type: "fermentation",
      status: "in_progress",
      target_yield: 120.0,
      actual_yield: null,
      notes: "Monitor dissolved oxygen and pH drift.",
    },
    {
      id: uuid(),
      product: "Monoclonal antibody",
      facility: "Plant B",
      process_type: "cell_culture",
      status: "qa_hold",
      target_yield: 80.0,
      actual_yield: 72.5,
      notes: "Hold pending endotoxin retest.",
    },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO bio_batches (id, product, facility, process_type, status, target_yield, actual_yield, notes)
    VALUES (@id, @product, @facility, @process_type, @status, @target_yield, @actual_yield, @notes)
  `);
  for (const b of seedBatches) insert.run(b);

  const deviation = {
    id: uuid(),
    batch_id: seedBatches[1].id,
    deviation_type: "out_of_spec",
    severity: "major",
    description: "Endotoxin above alert limit at post-purification sample.",
    status: "investigating",
  };
  db.prepare(
    `INSERT OR IGNORE INTO bio_deviations (id, batch_id, deviation_type, severity, description, status)
     VALUES (@id, @batch_id, @deviation_type, @severity, @description, @status)`
  ).run(deviation);

  const seedReads = [
    { id: uuid(), facility: "Plant A", area: "Fermenter Bay", sample_type: "air", metric: "particles", value: 3200, limit_value: 5000 },
    { id: uuid(), facility: "Plant B", area: "Grade C Corridor", sample_type: "surface", metric: "cfu", value: 6, limit_value: 10 },
  ];
  const insertRead = db.prepare(`
    INSERT OR IGNORE INTO bio_environmental_reads (id, facility, area, sample_type, metric, value, limit_value)
    VALUES (@id, @facility, @area, @sample_type, @metric, @value, @limit_value)
  `);
  for (const r of seedReads) insertRead.run(r);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deviationScore(severity) {
  return { minor: 25, major: 65, critical: 95 }[severity] ?? 25;
}

function capaPlaybook(deviationType) {
  switch (deviationType) {
    case "contamination":
      return ["Quarantine materials", "Perform root-cause (5-Whys)", "Review cleaning validation", "Increase environmental sampling"];
    case "out_of_spec":
      return ["Confirm lab method suitability", "Review sampling chain-of-custody", "Check equipment calibration", "Assess impact to batch disposition"];
    case "equipment_failure":
      return ["Open maintenance work order", "Assess spare parts", "Review PM schedule", "Add alarm/interlock"];
    case "documentation":
      return ["Re-train operators", "Update SOP", "Add eBR guardrails", "Audit batch records"];
    default:
      return ["Review environmental controls", "Increase monitoring cadence", "Audit gowning and line clearance"];
  }
}

function envFlag(read) {
  if (!read) return "unknown";
  if (Number(read.value) > Number(read.limit_value)) return "action";
  if (Number(read.value) >= Number(read.limit_value) * 0.8) return "alert";
  return "normal";
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export function bioCreateBatch(product, facility, processType, targetYield) {
  if (!product) throw new Error("product is required");
  if (!facility) throw new Error("facility is required");
  if (!["fermentation", "cell_culture", "purification", "fill_finish"].includes(processType)) {
    throw new Error("processType must be fermentation|cell_culture|purification|fill_finish");
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO bio_batches (id, product, facility, process_type, status, target_yield)
     VALUES (?, ?, ?, ?, 'planned', ?)`
  ).run(id, product, facility, processType, targetYield ?? null);
  return db.prepare("SELECT * FROM bio_batches WHERE id = ?").get(id);
}

export function bioUpdateBatchStatus(batchId, status, actualYield, notes) {
  if (!batchId) throw new Error("batchId is required");
  if (!["planned", "in_progress", "qa_hold", "released", "rejected"].includes(status)) {
    throw new Error("status must be planned|in_progress|qa_hold|released|rejected");
  }
  const batch = db.prepare("SELECT * FROM bio_batches WHERE id = ?").get(batchId);
  if (!batch) throw new Error(`batch not found: ${batchId}`);
  db.prepare("UPDATE bio_batches SET status = ?, actual_yield = COALESCE(?, actual_yield), notes = COALESCE(?, notes) WHERE id = ?").run(
    status,
    actualYield ?? null,
    notes ?? null,
    batchId
  );
  return db.prepare("SELECT * FROM bio_batches WHERE id = ?").get(batchId);
}

export function bioLogDeviation(batchId, deviationType, severity, description) {
  if (!batchId) throw new Error("batchId is required");
  const batch = db.prepare("SELECT * FROM bio_batches WHERE id = ?").get(batchId);
  if (!batch) throw new Error(`batch not found: ${batchId}`);
  if (!["contamination", "out_of_spec", "equipment_failure", "documentation", "environmental"].includes(deviationType)) {
    throw new Error("deviationType must be contamination|out_of_spec|equipment_failure|documentation|environmental");
  }
  if (!["minor", "major", "critical"].includes(severity)) throw new Error("severity must be minor|major|critical");
  if (!description) throw new Error("description is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO bio_deviations (id, batch_id, deviation_type, severity, description, status)
     VALUES (?, ?, ?, ?, ?, 'open')`
  ).run(id, batchId, deviationType, severity, description);

  return {
    deviation: db.prepare("SELECT * FROM bio_deviations WHERE id = ?").get(id),
    deviation_score: deviationScore(severity),
    capa_playbook: capaPlaybook(deviationType),
  };
}

export function bioCreateCapa(deviationId, actionType, action, owner, dueDateUtc) {
  if (!deviationId) throw new Error("deviationId is required");
  const dev = db.prepare("SELECT * FROM bio_deviations WHERE id = ?").get(deviationId);
  if (!dev) throw new Error(`deviation not found: ${deviationId}`);
  if (!["corrective", "preventive"].includes(actionType)) throw new Error("actionType must be corrective|preventive");
  if (!action) throw new Error("action is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO bio_capas (id, deviation_id, action_type, owner, due_date_utc, status, action)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, deviationId, actionType, owner ?? null, dueDateUtc ?? null, action);

  return db.prepare("SELECT * FROM bio_capas WHERE id = ?").get(id);
}

export function bioRecordEnvironmentalRead(facility, area, sampleType, metric, value, limitValue) {
  if (!facility) throw new Error("facility is required");
  if (!area) throw new Error("area is required");
  if (!["air", "surface", "water", "personnel"].includes(sampleType)) throw new Error("sampleType must be air|surface|water|personnel");
  if (!["cfu", "particles"].includes(metric)) throw new Error("metric must be cfu|particles");
  if (value === undefined || value === null) throw new Error("value is required");
  if (limitValue === undefined || limitValue === null) throw new Error("limitValue is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO bio_environmental_reads (id, facility, area, sample_type, metric, value, limit_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, facility, area, sampleType, metric, Number(value), Number(limitValue));

  const rec = db.prepare("SELECT * FROM bio_environmental_reads WHERE id = ?").get(id);
  return { ...rec, flag: envFlag(rec) };
}

export function bioManufacturingDashboard() {
  const batches = db.prepare("SELECT * FROM bio_batches ORDER BY created_at DESC LIMIT 50").all();
  const deviations = db.prepare("SELECT * FROM bio_deviations WHERE status != 'closed' ORDER BY created_at DESC LIMIT 50").all();
  const capas = db.prepare("SELECT * FROM bio_capas WHERE status != 'closed' ORDER BY created_at DESC LIMIT 50").all();
  const reads = db.prepare("SELECT * FROM bio_environmental_reads ORDER BY sampled_at_utc DESC LIMIT 100").all();

  const openCritical = deviations.filter((d) => d.severity === "critical" && d.status !== "closed").length;
  const envAction = reads.filter((r) => Number(r.value) > Number(r.limit_value)).length;

  return {
    batches,
    deviations,
    capas,
    environmental_reads: reads.map((r) => ({ ...r, flag: envFlag(r) })),
    headline_metrics: {
      batch_count: batches.length,
      open_deviation_count: deviations.length,
      open_critical_deviations: openCritical,
      open_capa_count: capas.length,
      environmental_action_exceedances: envAction,
    },
  };
}
