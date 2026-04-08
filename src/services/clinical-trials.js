import { v4 as uuid } from "uuid";
import db from "../db.js";

// Clinical trials discovery + enrollment coordination.
// Patterned after services/hitl.js: schema init + seed + exported functions.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS clinical_trials (
    id              TEXT PRIMARY KEY,
    nct_id           TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    condition        TEXT NOT NULL,
    phase            TEXT NOT NULL CHECK(phase IN ('N/A','Phase 1','Phase 2','Phase 3','Phase 4')),
    status           TEXT NOT NULL CHECK(status IN ('recruiting','active_not_recruiting','completed','terminated','unknown')),
    locations_json   TEXT NOT NULL,
    sponsor          TEXT,
    source_url       TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trial_patient_profiles (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL UNIQUE,
    age             INTEGER,
    sex             TEXT CHECK(sex IN ('female','male','intersex','unspecified')),
    conditions_json TEXT DEFAULT '[]',
    medications_json TEXT DEFAULT '[]',
    zip_code        TEXT,
    country         TEXT DEFAULT 'US',
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trial_matches (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    trial_nct_id    TEXT NOT NULL,
    match_score     REAL NOT NULL,
    rationale       TEXT,
    status          TEXT DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','rejected','contacted')),
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(patient_id, trial_nct_id)
  );
`);

// ─── Seed Trials ──────────────────────────────────────────────────────────────

const _trialCount = db.prepare("SELECT COUNT(*) as n FROM clinical_trials").get().n;
if (_trialCount === 0) {
  const seedTrials = [
    {
      id: uuid(),
      nct_id: "NCT00000000",
      title: "Example Trial: Novel Therapy for Condition X",
      condition: "Condition X",
      phase: "Phase 2",
      status: "recruiting",
      locations_json: JSON.stringify([
        { city: "Boston", region: "MA", country: "US" },
        { city: "Chicago", region: "IL", country: "US" },
      ]),
      sponsor: "Example Sponsor",
      source_url: "https://clinicaltrials.gov/",
    },
    {
      id: uuid(),
      nct_id: "NCT11111111",
      title: "Example Trial: Observational Study for Biomarkers",
      condition: "Condition Y",
      phase: "N/A",
      status: "active_not_recruiting",
      locations_json: JSON.stringify([{ city: "San Diego", region: "CA", country: "US" }]),
      sponsor: "Example Academic Center",
      source_url: "https://clinicaltrials.gov/",
    },
  ];

  const insertTrial = db.prepare(`
    INSERT OR IGNORE INTO clinical_trials
      (id, nct_id, title, condition, phase, status, locations_json, sponsor, source_url)
    VALUES
      (@id, @nct_id, @title, @condition, @phase, @status, @locations_json, @sponsor, @source_url)
  `);

  for (const t of seedTrials) insertTrial.run(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhase(phase) {
  const allowed = ["N/A", "Phase 1", "Phase 2", "Phase 3", "Phase 4"];
  if (!phase) return "N/A";
  const candidate = phase.trim();
  return allowed.includes(candidate) ? candidate : "N/A";
}

function statusRank(status) {
  return {
    recruiting: 0,
    active_not_recruiting: 1,
    completed: 2,
    terminated: 3,
    unknown: 4,
  }[status] ?? 4;
}

function computeMatchScore(patient, trial) {
  // Lightweight heuristic: match by condition and give small weight for proximity by country.
  let score = 0.2;
  const conds = JSON.parse(patient.conditions_json || "[]");
  if (conds.some((c) => String(c).toLowerCase() === String(trial.condition).toLowerCase())) score += 0.6;
  const locations = JSON.parse(trial.locations_json || "[]");
  if (locations.some((l) => (l.country || "US") === (patient.country || "US"))) score += 0.2;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

// ─── Upsert Patient Profile ───────────────────────────────────────────────────

/**
 * Create or update a patient profile used for trial matching.
 * @param {object} profile
 * @returns {object} stored profile
 */
export function upsertTrialPatientProfile(profile) {
  if (!profile?.patient_id) throw new Error("patient_id is required");

  const record = {
    id: uuid(),
    patient_id: profile.patient_id,
    age: profile.age ?? null,
    sex: profile.sex ?? "unspecified",
    conditions_json: JSON.stringify(profile.conditions ?? []),
    medications_json: JSON.stringify(profile.medications ?? []),
    zip_code: profile.zip_code ?? null,
    country: profile.country ?? "US",
  };

  db.prepare(`
    INSERT INTO trial_patient_profiles
      (id, patient_id, age, sex, conditions_json, medications_json, zip_code, country)
    VALUES
      (@id, @patient_id, @age, @sex, @conditions_json, @medications_json, @zip_code, @country)
    ON CONFLICT(patient_id) DO UPDATE SET
      age = excluded.age,
      sex = excluded.sex,
      conditions_json = excluded.conditions_json,
      medications_json = excluded.medications_json,
      zip_code = excluded.zip_code,
      country = excluded.country
  `).run(record);

  return db.prepare("SELECT * FROM trial_patient_profiles WHERE patient_id = ?").get(profile.patient_id);
}

// ─── Search Trials ────────────────────────────────────────────────────────────

/**
 * Search trials by condition and optional phase/status.
 */
export function searchClinicalTrials({ condition, phase, status, limit = 10 } = {}) {
  if (!condition) throw new Error("condition is required");

  const normalizedPhase = normalizePhase(phase);

  let query = "SELECT * FROM clinical_trials WHERE lower(condition) = lower(?)";
  const params = [condition];

  if (phase) {
    query += " AND phase = ?";
    params.push(normalizedPhase);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " LIMIT ?";
  params.push(Math.max(1, Math.min(50, Number(limit) || 10)));

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    locations: JSON.parse(r.locations_json || "[]"),
  }));
}

// ─── Match Trials for a Patient ───────────────────────────────────────────────

/**
 * Generate and persist top trial matches for a patient.
 */
export function matchTrialsForPatient(patientId, { condition, limit = 5 } = {}) {
  if (!patientId) throw new Error("patientId is required");

  const patient = db.prepare("SELECT * FROM trial_patient_profiles WHERE patient_id = ?").get(patientId);
  if (!patient) throw new Error(`patient profile not found: ${patientId}`);

  const trials = condition
    ? db.prepare("SELECT * FROM clinical_trials WHERE lower(condition) = lower(?)").all(condition)
    : db.prepare("SELECT * FROM clinical_trials").all();

  const scored = trials
    .map((t) => ({ trial: t, score: computeMatchScore(patient, t) }))
    .sort((a, b) => a.score === b.score ? statusRank(a.trial.status) - statusRank(b.trial.status) : b.score - a.score)
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 5)));

  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO trial_matches
      (id, patient_id, trial_nct_id, match_score, rationale, status)
    VALUES
      (@id, @patient_id, @trial_nct_id, @match_score, @rationale, @status)
  `);

  for (const s of scored) {
    insertMatch.run({
      id: uuid(),
      patient_id: patientId,
      trial_nct_id: s.trial.nct_id,
      match_score: s.score,
      rationale: s.score >= 0.8 ? "Strong condition match" : s.score >= 0.5 ? "Possible condition match" : "Weak match",
      status: "proposed",
    });
  }

  return db.prepare(
    "SELECT * FROM trial_matches WHERE patient_id = ? ORDER BY match_score DESC LIMIT ?"
  ).all(patientId, Math.max(1, Math.min(20, Number(limit) || 5)));
}

// ─── Accept/Reject a Match ───────────────────────────────────────────────────

export function setTrialMatchStatus(patientId, trialNctId, status) {
  if (!patientId) throw new Error("patientId is required");
  if (!trialNctId) throw new Error("trialNctId is required");
  if (!["accepted","rejected","contacted"].includes(status)) {
    throw new Error("status must be accepted|rejected|contacted");
  }

  const updated = db.prepare(
    "UPDATE trial_matches SET status = ? WHERE patient_id = ? AND trial_nct_id = ?"
  ).run(status, patientId, trialNctId).changes;

  if (!updated) throw new Error("match not found");

  return db.prepare(
    "SELECT * FROM trial_matches WHERE patient_id = ? AND trial_nct_id = ?"
  ).get(patientId, trialNctId);
}
