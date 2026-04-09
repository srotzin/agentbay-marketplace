import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Pricing / Revenue Configuration ───────────────────────────────────────────

const INTAKE_PLATFORM_COMMISSION = 0.12; // 12% platform cut
const RISK_MULTIPLIERS = { low: 1.0, medium: 1.25, high: 1.75 };

// ─── Schema Initialization ────────────────────────────────────────────────────

// NOTE: This module is intentionally generic (not a medical device).
// It models intake workflows (forms, eligibility checks, prior auth packaging)
// so agents can build safe, auditable front-office automation.

db.exec(`
  CREATE TABLE IF NOT EXISTS intake_forms (
    id                TEXT PRIMARY KEY,
    org_id             TEXT NOT NULL,
    name              TEXT NOT NULL,
    schema_json        TEXT NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intake_submissions (
    id                TEXT PRIMARY KEY,
    org_id             TEXT NOT NULL,
    form_id            TEXT REFERENCES intake_forms(id),
    patient_ref        TEXT,
    payload_json       TEXT NOT NULL,
    status             TEXT DEFAULT 'received' CHECK(status IN (
                        'received','validated','needs_review','submitted','rejected')),
    validation_errors  TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intake_eligibility_checks (
    id                TEXT PRIMARY KEY,
    submission_id      TEXT REFERENCES intake_submissions(id),
    payer              TEXT NOT NULL,
    policy_number      TEXT,
    service_code       TEXT,
    status             TEXT DEFAULT 'pending' CHECK(status IN (
                        'pending','eligible','ineligible','unknown','failed')),
    confidence         REAL DEFAULT 0.5,
    raw_response_json  TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intake_prior_auth_packets (
    id                TEXT PRIMARY KEY,
    submission_id      TEXT REFERENCES intake_submissions(id),
    packet_json        TEXT NOT NULL,
    status             TEXT DEFAULT 'draft' CHECK(status IN (
                        'draft','ready','sent','approved','denied')),
    created_at         TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function validateAgainstSchema(payload, schema) {
  // Lightweight validation to avoid extra deps.
  // Supported schema shape:
  // { required: ["field"], fields: { field: { type: "string"|"number"|"boolean"|"object" } } }
  const errors = [];
  const required = schema?.required ?? [];
  for (const k of required) {
    if (payload?.[k] == null || payload?.[k] === "") errors.push({ field: k, error: "required" });
  }
  const fields = schema?.fields ?? {};
  for (const [k, spec] of Object.entries(fields)) {
    if (payload?.[k] == null) continue;
    const t = spec?.type;
    if (!t) continue;
    const actual = Array.isArray(payload[k]) ? "array" : typeof payload[k];
    if (t !== actual) errors.push({ field: k, error: `expected ${t} got ${actual}` });
  }
  return errors;
}

function quoteIntakeCostUsd({ risk = "low", requires_review = false } = {}) {
  const base = 6.0;
  const multiplier = RISK_MULTIPLIERS[risk] ?? 1.0;
  const reviewFee = requires_review ? 8.0 : 0.0;
  const price = (base * multiplier) + reviewFee;
  const commission = Math.round(price * INTAKE_PLATFORM_COMMISSION * 100) / 100;
  return { quoted_price_usd: Math.round(price * 100) / 100, commission_usd: commission };
}

// ─── API: Form Management ─────────────────────────────────────────────────────

/**
 * Create (or replace) a structured intake form for an organization.
 * @param {string} orgId
 * @param {string} name
 * @param {object} schema - JSON schema-like object for lightweight validation
 */
export function createIntakeForm(orgId, name, schema) {
  if (!orgId) throw new Error("orgId is required");
  if (!name) throw new Error("name is required");
  if (!schema || typeof schema !== "object") throw new Error("schema must be an object");

  const id = uuid();
  db.prepare(`
    INSERT INTO intake_forms (id, org_id, name, schema_json)
    VALUES (@id, @org_id, @name, @schema_json)
  `).run({ id, org_id: orgId, name, schema_json: JSON.stringify(schema) });

  return { form_id: id, org_id: orgId, name, schema };
}

/**
 * List all forms for an organization.
 */
export function listIntakeForms(orgId) {
  if (!orgId) throw new Error("orgId is required");
  return db.prepare("SELECT id, org_id, name, created_at FROM intake_forms WHERE org_id = ? ORDER BY created_at DESC").all(orgId);
}

// ─── API: Submit + Validate Intake ────────────────────────────────────────────

/**
 * Submit an intake payload and optionally validate against a stored form schema.
 * @param {string} orgId
 * @param {string} formId
 * @param {object} payload
 * @param {string} patientRef
 */
export function submitIntake(orgId, formId, payload, patientRef = null) {
  if (!orgId) throw new Error("orgId is required");
  if (!payload || typeof payload !== "object") throw new Error("payload must be an object");

  const id = uuid();
  const form = formId
    ? db.prepare("SELECT * FROM intake_forms WHERE id = ? AND org_id = ?").get(formId, orgId)
    : null;

  const schema = form ? safeJsonParse(form.schema_json, {}) : null;
  const errors = schema ? validateAgainstSchema(payload, schema) : [];

  const status = errors.length ? "needs_review" : (schema ? "validated" : "received");

  db.prepare(`
    INSERT INTO intake_submissions (id, org_id, form_id, patient_ref, payload_json, status, validation_errors)
    VALUES (@id, @org_id, @form_id, @patient_ref, @payload_json, @status, @validation_errors)
  `).run({
    id,
    org_id: orgId,
    form_id: form?.id ?? null,
    patient_ref: patientRef,
    payload_json: JSON.stringify(payload),
    status,
    validation_errors: errors.length ? JSON.stringify(errors) : null,
  });

  const pricing = quoteIntakeCostUsd({ risk: payload?.risk_level ?? "low", requires_review: status === "needs_review" });

  return {
    submission_id: id,
    org_id: orgId,
    form_id: form?.id ?? null,
    status,
    validation_errors: errors,
    ...pricing,
    created_at: new Date().toISOString(),
  };
}

/**
 * Create a mock eligibility check record (placeholder for payer API integrations).
 */
export function runEligibilityCheck(submissionId, payer, policyNumber = null, serviceCode = null) {
  if (!submissionId) throw new Error("submissionId is required");
  if (!payer) throw new Error("payer is required");

  const sub = db.prepare("SELECT * FROM intake_submissions WHERE id = ?").get(submissionId);
  if (!sub) throw new Error(`submission not found: ${submissionId}`);

  const id = uuid();

  // Conservative mock: unknown outcome but record structure is correct.
  const result = { status: "unknown", confidence: 0.55, notes: "No payer integration configured; recorded as unknown." };

  db.prepare(`
    INSERT INTO intake_eligibility_checks
      (id, submission_id, payer, policy_number, service_code, status, confidence, raw_response_json)
    VALUES
      (@id, @submission_id, @payer, @policy_number, @service_code, @status, @confidence, @raw_response_json)
  `).run({
    id,
    submission_id: submissionId,
    payer,
    policy_number: policyNumber,
    service_code: serviceCode,
    status: result.status,
    confidence: result.confidence,
    raw_response_json: JSON.stringify(result),
  });

  return { eligibility_check_id: id, submission_id: submissionId, payer, ...result, created_at: new Date().toISOString() };
}

/**
 * Generate a prior authorization packet from an intake submission.
 */
export function buildPriorAuthPacket(submissionId, options = {}) {
  if (!submissionId) throw new Error("submissionId is required");
  const sub = db.prepare("SELECT * FROM intake_submissions WHERE id = ?").get(submissionId);
  if (!sub) throw new Error(`submission not found: ${submissionId}`);

  const payload = safeJsonParse(sub.payload_json, {});
  const id = uuid();

  const packet = {
    submission_id: submissionId,
    created_at: new Date().toISOString(),
    patient_ref: sub.patient_ref,
    requested_service: payload?.requested_service ?? null,
    diagnosis_codes: payload?.diagnosis_codes ?? [],
    supporting_docs: payload?.supporting_docs ?? [],
    provider: payload?.provider ?? null,
    notes: options?.notes ?? null,
    disclaimer: "Generated packet for administrative workflow automation; requires clinical review before submission.",
  };

  db.prepare(`
    INSERT INTO intake_prior_auth_packets (id, submission_id, packet_json, status)
    VALUES (@id, @submission_id, @packet_json, 'draft')
  `).run({ id, submission_id: submissionId, packet_json: JSON.stringify(packet) });

  return { prior_auth_packet_id: id, submission_id: submissionId, status: "draft", packet };
}
