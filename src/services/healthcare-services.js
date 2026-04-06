import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const HEALTHCARE_COMMISSION = 0.20; // 20% platform commission on prior auth checks
const FEES = {
  priorAuth:      2.00,
  clinicalNote:   1.00,
  claimCodes:     0.50,
  schedule:       0.25,
  labInterpret:   0.75,
  compliance:     0.50,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hc_insurance_providers (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    payer_id            TEXT NOT NULL,
    prior_auth_portal   TEXT,
    avg_turnaround_days INTEGER DEFAULT 3,
    auto_approve_codes  TEXT DEFAULT '[]',
    denial_rate_pct     REAL DEFAULT 12.0,
    phone              TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hc_prior_auths (
    id                  TEXT PRIMARY KEY,
    insurance_provider  TEXT NOT NULL,
    procedure_code      TEXT NOT NULL,
    patient_id          TEXT,
    auth_status         TEXT NOT NULL CHECK(auth_status IN ('approved','pending','denied')),
    reference_number    TEXT,
    requirements        TEXT DEFAULT '[]',
    estimated_turnaround TEXT,
    fee_usd             REAL DEFAULT 2.00,
    commission_usd      REAL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hc_clinical_notes (
    id                  TEXT PRIMARY KEY,
    encounter_type      TEXT NOT NULL,
    soap_note           TEXT NOT NULL,
    icd10_suggestions   TEXT DEFAULT '[]',
    cpt_suggestions     TEXT DEFAULT '[]',
    fee_usd             REAL DEFAULT 1.00,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hc_claim_code_suggestions (
    id                  TEXT PRIMARY KEY,
    diagnosis           TEXT NOT NULL,
    icd10_codes         TEXT DEFAULT '[]',
    cpt_codes           TEXT DEFAULT '[]',
    modifiers           TEXT DEFAULT '[]',
    estimated_reimbursement REAL,
    audit_risk_score    REAL,
    fee_usd             REAL DEFAULT 0.50,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hc_schedule_optimizations (
    id                  TEXT PRIMARY KEY,
    provider_id         TEXT,
    optimized_schedule  TEXT DEFAULT '[]',
    utilization_pct     REAL,
    gaps                TEXT DEFAULT '[]',
    overbooking_risk    TEXT,
    fee_usd             REAL DEFAULT 0.25,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hc_lab_interpretations (
    id                  TEXT PRIMARY KEY,
    lab_type            TEXT NOT NULL,
    interpretations     TEXT DEFAULT '[]',
    abnormal_flags      TEXT DEFAULT '[]',
    trending            TEXT DEFAULT '[]',
    recommended_followup TEXT DEFAULT '[]',
    fee_usd             REAL DEFAULT 0.75,
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Insurance Providers ──────────────────────────────────────────────────

const _providerCount = db.prepare("SELECT COUNT(*) as n FROM hc_insurance_providers").get().n;
if (_providerCount === 0) {
  const providers = [
    { id: randomUUID(), name: "UnitedHealthcare",       payer_id: "UHC001", prior_auth_portal: "https://auth.uhc.com",         avg_turnaround_days: 2, denial_rate_pct: 10.2, phone: "1-866-892-5890", auto_approve_codes: '["99213","99214","80053"]' },
    { id: randomUUID(), name: "Anthem Blue Cross",      payer_id: "ANT002", prior_auth_portal: "https://provider.anthem.com",   avg_turnaround_days: 3, denial_rate_pct: 13.5, phone: "1-800-676-2583", auto_approve_codes: '["99211","99212","85025"]' },
    { id: randomUUID(), name: "Aetna",                  payer_id: "AET003", prior_auth_portal: "https://naviguard.aetna.com",   avg_turnaround_days: 2, denial_rate_pct: 11.8, phone: "1-800-238-6279", auto_approve_codes: '["99213","93000","80048"]' },
    { id: randomUUID(), name: "Cigna",                  payer_id: "CIG004", prior_auth_portal: "https://cignaforhcp.cigna.com", avg_turnaround_days: 3, denial_rate_pct: 14.1, phone: "1-800-244-6224", auto_approve_codes: '["99214","71046","80053"]' },
    { id: randomUUID(), name: "Humana",                 payer_id: "HUM005", prior_auth_portal: "https://provider.humana.com",   avg_turnaround_days: 4, denial_rate_pct: 12.9, phone: "1-800-457-4708", auto_approve_codes: '["99211","99212","85027"]' },
    { id: randomUUID(), name: "Molina Healthcare",      payer_id: "MOL006", prior_auth_portal: "https://provider.molinahealthcare.com", avg_turnaround_days: 5, denial_rate_pct: 18.3, phone: "1-888-665-4621", auto_approve_codes: '["99201","99202"]' },
    { id: randomUUID(), name: "Centene / WellCare",     payer_id: "CEN007", prior_auth_portal: "https://provider.centene.com",  avg_turnaround_days: 4, denial_rate_pct: 16.7, phone: "1-800-948-1705", auto_approve_codes: '["99213","80048"]' },
    { id: randomUUID(), name: "Kaiser Permanente",      payer_id: "KAI008", prior_auth_portal: "https://kp.org/provider",       avg_turnaround_days: 1, denial_rate_pct:  8.4, phone: "1-800-390-3510", auto_approve_codes: '["99213","99214","99215","93000","80053"]' },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO hc_insurance_providers
      (id, name, payer_id, prior_auth_portal, avg_turnaround_days, denial_rate_pct, phone, auto_approve_codes)
    VALUES
      (@id, @name, @payer_id, @prior_auth_portal, @avg_turnaround_days, @denial_rate_pct, @phone, @auto_approve_codes)
  `);
  for (const p of providers) ins.run(p);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ICD10_MAP = {
  hypertension:      [{ code: "I10",    description: "Essential (primary) hypertension" }],
  diabetes:          [{ code: "E11.9",  description: "Type 2 diabetes mellitus without complications" }, { code: "E11.65", description: "Type 2 DM with hyperglycemia" }],
  chest_pain:        [{ code: "R07.9",  description: "Chest pain, unspecified" }, { code: "I20.9", description: "Angina pectoris, unspecified" }],
  back_pain:         [{ code: "M54.5",  description: "Low back pain" }, { code: "M54.4", description: "Lumbago with sciatica" }],
  anxiety:           [{ code: "F41.1",  description: "Generalized anxiety disorder" }, { code: "F41.9", description: "Anxiety disorder, unspecified" }],
  depression:        [{ code: "F32.9",  description: "Major depressive disorder, single episode, unspecified" }],
  asthma:            [{ code: "J45.909",description: "Unspecified asthma, uncomplicated" }, { code: "J45.901", description: "Unspecified asthma with acute exacerbation" }],
  uti:               [{ code: "N39.0",  description: "Urinary tract infection, site not specified" }],
  default:           [{ code: "Z00.00", description: "Encounter for general adult medical examination" }],
};

const CPT_MAP = {
  office_visit:        [{ code: "99213", description: "Office visit, established patient, moderate complexity", rvu: 1.3 }],
  office_visit_new:    [{ code: "99203", description: "Office visit, new patient, moderate complexity", rvu: 1.6 }],
  ecg:                 [{ code: "93000", description: "Electrocardiogram, routine with interpretation", rvu: 0.17 }],
  chest_xray:          [{ code: "71046", description: "Chest X-ray, 2 views", rvu: 0.22 }],
  cbc:                 [{ code: "85025", description: "Complete blood count with differential", rvu: 0.0 }],
  metabolic_panel:     [{ code: "80053", description: "Comprehensive metabolic panel", rvu: 0.0 }],
  urinalysis:          [{ code: "81003", description: "Urinalysis, automated", rvu: 0.0 }],
  lipid_panel:         [{ code: "80061", description: "Lipid panel", rvu: 0.0 }],
  mri_lumbar:          [{ code: "72148", description: "MRI lumbar spine without contrast", rvu: 2.33 }],
  physical_therapy:    [{ code: "97110", description: "Therapeutic exercises, each 15 min", rvu: 0.45 }],
};

function pickIcd10(diagnosisStr) {
  const d = (diagnosisStr || "").toLowerCase();
  for (const key of Object.keys(ICD10_MAP)) {
    if (d.includes(key)) return ICD10_MAP[key];
  }
  return ICD10_MAP.default;
}

function pickCpt(procedureStr) {
  const p = (procedureStr || "").toLowerCase();
  const results = [];
  for (const [key, val] of Object.entries(CPT_MAP)) {
    if (p.includes(key.replace(/_/g, " ")) || p.includes(key.split("_")[0])) results.push(val[0]);
  }
  return results.length ? results : [CPT_MAP.office_visit[0]];
}

function calcReimbursement(cptCodes) {
  const ratePerRvu = 36.04; // 2024 Medicare conversion factor
  const total = cptCodes.reduce((sum, c) => sum + (c.rvu ?? 0.5) * ratePerRvu, 0);
  return Math.round(total * 100) / 100;
}

// ─── checkPriorAuth ───────────────────────────────────────────────────────────

/**
 * Check prior authorization eligibility and submit for a procedure.
 * @param {string} insuranceProvider  - Name or payer ID of the insurer
 * @param {string} procedureCode      - CPT or HCPCS code requiring auth
 * @param {object} patientInfo        - { dob, memberId, diagnosis, treatingSite }
 * @returns {{ auth_status, reference_number, requirements, estimated_turnaround, fee_usd, commission_usd }}
 */
export function checkPriorAuth(insuranceProvider, procedureCode, patientInfo = {}) {
  if (!insuranceProvider) throw new Error("insuranceProvider is required");
  if (!procedureCode)     throw new Error("procedureCode is required");

  const provider = db.prepare(
    "SELECT * FROM hc_insurance_providers WHERE name LIKE ? OR payer_id = ? LIMIT 1"
  ).get(`%${insuranceProvider}%`, insuranceProvider);

  const prov = provider ?? {
    name: insuranceProvider, payer_id: "UNKNOWN", avg_turnaround_days: 5,
    denial_rate_pct: 15, auto_approve_codes: "[]",
  };

  const autoCodes = JSON.parse(prov.auto_approve_codes || "[]");
  const isAutoApprove = autoCodes.includes(procedureCode);
  const rand = Math.random() * 100;
  const denialThreshold = prov.denial_rate_pct;

  let auth_status;
  if (isAutoApprove || rand > denialThreshold + 30) {
    auth_status = "approved";
  } else if (rand > denialThreshold) {
    auth_status = "pending";
  } else {
    auth_status = "denied";
  }

  const requirements = auth_status === "pending" ? [
    "Clinical notes from treating physician (last 90 days)",
    "Documentation of conservative treatment failure",
    `Letter of medical necessity for ${procedureCode}`,
  ] : auth_status === "denied" ? [
    "Peer-to-peer review request available within 10 business days",
    "Appeals must be submitted within 60 days of denial",
  ] : [];

  const turnaroundDays = isAutoApprove ? 0 : prov.avg_turnaround_days;
  const estimated_turnaround = turnaroundDays === 0
    ? "Real-time approval"
    : `${turnaroundDays}–${turnaroundDays + 2} business days`;

  const reference_number = `PA-${prov.payer_id}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const commission = Math.round(FEES.priorAuth * HEALTHCARE_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO hc_prior_auths
      (id, insurance_provider, procedure_code, patient_id, auth_status,
       reference_number, requirements, estimated_turnaround, fee_usd, commission_usd)
    VALUES (@id, @insurance_provider, @procedure_code, @patient_id, @auth_status,
       @reference_number, @requirements, @estimated_turnaround, @fee_usd, @commission_usd)
  `).run({
    id:                  randomUUID(),
    insurance_provider:  prov.name,
    procedure_code:      procedureCode,
    patient_id:          patientInfo.memberId ?? null,
    auth_status,
    reference_number,
    requirements:        JSON.stringify(requirements),
    estimated_turnaround,
    fee_usd:             FEES.priorAuth,
    commission_usd:      commission,
  });

  return {
    auth_status,
    reference_number,
    insurance_provider:      prov.name,
    payer_id:                prov.payer_id,
    procedure_code:          procedureCode,
    patient_member_id:       patientInfo.memberId ?? null,
    requirements,
    estimated_turnaround,
    portal:                  prov.prior_auth_portal ?? null,
    provider_phone:          prov.phone ?? null,
    fee_usd:                 FEES.priorAuth,
    platform_commission_usd: commission,
  };
}

// ─── generateClinicalNote ─────────────────────────────────────────────────────

/**
 * Generate a structured SOAP clinical note from encounter data.
 * @param {string} encounterType  - office_visit|telehealth|urgent_care|emergency|follow_up
 * @param {string[]} symptoms     - Array of patient-reported symptoms
 * @param {object}  findings      - Physical exam findings { vitals, exam }
 * @param {string}  assessment    - Clinical assessment / working diagnosis
 * @param {string}  plan          - Treatment plan narrative
 * @returns {{ note_id, soap_note, icd10_suggestions, cpt_suggestions, fee_usd }}
 */
export function generateClinicalNote(encounterType, symptoms = [], findings = {}, assessment = "", plan = "") {
  if (!encounterType) throw new Error("encounterType is required");

  const validTypes = ["office_visit", "telehealth", "urgent_care", "emergency", "follow_up"];
  if (!validTypes.includes(encounterType)) {
    throw new Error(`encounterType must be one of: ${validTypes.join(", ")}`);
  }

  const note_id = `NOTE-${randomUUID().slice(0, 10).toUpperCase()}`;
  const symptomList = Array.isArray(symptoms) ? symptoms.join(", ") : String(symptoms);
  const vitals = findings.vitals ?? { bp: "128/82 mmHg", hr: "76 bpm", temp: "98.6°F", spo2: "98%", weight: "172 lbs" };

  const soap_note = {
    subjective: `Patient presents for ${encounterType.replace(/_/g, " ")} with complaints of ${symptomList || "no specific complaints"}. ` +
      `Patient denies fever, chills, nausea, or vomiting unless noted above. ` +
      (findings.hpi ? `HPI: ${findings.hpi} ` : "") +
      `Review of systems otherwise negative.",`,
    objective: `Vital signs: BP ${vitals.bp ?? "120/80 mmHg"}, HR ${vitals.hr ?? "72 bpm"}, ` +
      `Temp ${vitals.temp ?? "98.6°F"}, SpO2 ${vitals.spo2 ?? "99%"}, Wt ${vitals.weight ?? "N/A"}. ` +
      (findings.exam ? `Physical exam: ${findings.exam}. ` : "General appearance: alert and oriented, in no acute distress. ") +
      (findings.labs ? `Lab results: ${findings.labs}.` : ""),
    assessment: assessment || `Clinical assessment pending further workup. Differential includes conditions consistent with presenting symptoms.`,
    plan: plan || `1. Continue current medications as prescribed.\n2. Follow up in 2–4 weeks or sooner if symptoms worsen.\n3. Patient education provided regarding diagnosis and treatment options.\n4. Patient verbalized understanding of instructions.`,
  };

  const icd10_suggestions = pickIcd10(assessment + " " + symptomList);
  const cptKey = encounterType === "office_visit" ? "office visit" : encounterType.replace(/_/g, " ");
  const cpt_suggestions = pickCpt(cptKey);

  db.prepare(`
    INSERT OR IGNORE INTO hc_clinical_notes
      (id, encounter_type, soap_note, icd10_suggestions, cpt_suggestions, fee_usd)
    VALUES (@id, @encounter_type, @soap_note, @icd10_suggestions, @cpt_suggestions, @fee_usd)
  `).run({
    id:               note_id,
    encounter_type:   encounterType,
    soap_note:        JSON.stringify(soap_note),
    icd10_suggestions: JSON.stringify(icd10_suggestions),
    cpt_suggestions:  JSON.stringify(cpt_suggestions),
    fee_usd:          FEES.clinicalNote,
  });

  return {
    note_id,
    encounter_type:   encounterType,
    soap_note,
    icd10_suggestions,
    cpt_suggestions,
    generated_at:     new Date().toISOString(),
    fee_usd:          FEES.clinicalNote,
  };
}

// ─── suggestClaimCodes ────────────────────────────────────────────────────────

/**
 * Suggest ICD-10 and CPT codes for a clinical encounter.
 * @param {string}   diagnosis   - Diagnosis or chief complaint description
 * @param {string[]} procedures  - List of procedures performed
 * @param {string[]} modifiers   - Existing modifiers to consider
 * @returns {{ icd10_codes, cpt_codes, modifiers, estimated_reimbursement, audit_risk_score, fee_usd }}
 */
export function suggestClaimCodes(diagnosis, procedures = [], modifiers = []) {
  if (!diagnosis) throw new Error("diagnosis is required");

  const icd10_codes = pickIcd10(diagnosis);

  const procedureStr = Array.isArray(procedures) ? procedures.join(" ") : String(procedures);
  const cpt_codes = pickCpt(procedureStr || diagnosis);

  // Suggest modifiers based on context
  const suggestedModifiers = [...(Array.isArray(modifiers) ? modifiers : [])];
  if (procedureStr.toLowerCase().includes("bilateral")) suggestedModifiers.push({ code: "50", description: "Bilateral procedure" });
  if (procedureStr.toLowerCase().includes("assistant"))  suggestedModifiers.push({ code: "80", description: "Assistant surgeon" });
  if (procedureStr.toLowerCase().includes("telehealth")) suggestedModifiers.push({ code: "95", description: "Synchronous telemedicine" });
  if (suggestedModifiers.length === 0) suggestedModifiers.push({ code: "25", description: "Significant, separately identifiable E/M service" });

  const estimated_reimbursement = calcReimbursement(cpt_codes);

  // Audit risk: higher when many codes, uncommon modifiers, high reimbursement
  const baseRisk = (cpt_codes.length * 5) + (estimated_reimbursement > 500 ? 20 : 0);
  const audit_risk_score = Math.min(100, Math.round(baseRisk + Math.random() * 15));

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO hc_claim_code_suggestions
      (id, diagnosis, icd10_codes, cpt_codes, modifiers, estimated_reimbursement, audit_risk_score, fee_usd)
    VALUES (@id, @diagnosis, @icd10_codes, @cpt_codes, @modifiers, @estimated_reimbursement, @audit_risk_score, @fee_usd)
  `).run({
    id,
    diagnosis,
    icd10_codes:             JSON.stringify(icd10_codes),
    cpt_codes:               JSON.stringify(cpt_codes),
    modifiers:               JSON.stringify(suggestedModifiers),
    estimated_reimbursement,
    audit_risk_score,
    fee_usd:                 FEES.claimCodes,
  });

  return {
    suggestion_id:           id,
    icd10_codes,
    cpt_codes,
    modifiers:               suggestedModifiers,
    estimated_reimbursement,
    audit_risk_score,
    audit_risk_level:        audit_risk_score < 25 ? "low" : audit_risk_score < 55 ? "medium" : "high",
    fee_usd:                 FEES.claimCodes,
  };
}

// ─── optimizeSchedule ─────────────────────────────────────────────────────────

/**
 * Optimize appointment scheduling for a provider.
 * @param {object}   providerCalendar      - { providerId, date, existingAppointments[] }
 * @param {object[]} appointmentRequests   - [{ patientId, appointmentType, duration_min, priority }]
 * @param {object}   constraints           - { start_time, end_time, buffer_min, max_patients }
 * @returns {{ optimized_schedule, utilization_pct, gaps, overbooking_risk, fee_usd }}
 */
export function optimizeSchedule(providerCalendar = {}, appointmentRequests = [], constraints = {}) {
  const startHour  = constraints.start_time ?? "08:00";
  const endHour    = constraints.end_time   ?? "17:00";
  const bufferMin  = constraints.buffer_min ?? 10;
  const maxPts     = constraints.max_patients ?? 20;
  const date       = providerCalendar.date ?? new Date().toISOString().slice(0, 10);
  const providerId = providerCalendar.providerId ?? `PROV-${randomUUID().slice(0, 6).toUpperCase()}`;

  const [startH, startM] = startHour.split(":").map(Number);
  const [endH, endM]     = endHour.split(":").map(Number);
  const totalMinutes      = (endH * 60 + endM) - (startH * 60 + startM);

  const requests = Array.isArray(appointmentRequests) ? appointmentRequests : [];
  const apptTypes = [
    { type: "new_patient",  duration: 45 },
    { type: "follow_up",    duration: 20 },
    { type: "annual_exam",  duration: 60 },
    { type: "urgent",       duration: 30 },
    { type: "telehealth",   duration: 15 },
  ];

  // Build optimized schedule
  const optimized_schedule = [];
  let cursor = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const sortedRequests = [...requests].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  });

  // Fill with requests first, then pad with simulated slots
  const allSlots = sortedRequests.length > 0 ? sortedRequests : Array.from({ length: Math.min(maxPts, 12) }, (_, i) => ({
    patientId: `PT-${String(i + 1).padStart(3, "0")}`,
    appointmentType: apptTypes[i % apptTypes.length].type,
    duration_min: apptTypes[i % apptTypes.length].duration,
    priority: i === 0 ? "urgent" : "normal",
  }));

  for (const req of allSlots) {
    if (cursor >= endMinutes - 30 || optimized_schedule.length >= maxPts) break;
    const duration = req.duration_min ?? 20;
    const slotEnd = cursor + duration;
    if (slotEnd > endMinutes) break;

    const startStr = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
    const endStr   = `${String(Math.floor(slotEnd / 60)).padStart(2, "0")}:${String(slotEnd % 60).padStart(2, "0")}`;

    optimized_schedule.push({
      slot:            optimized_schedule.length + 1,
      patient_id:      req.patientId ?? `PT-${String(optimized_schedule.length + 1).padStart(3, "0")}`,
      appointment_type: req.appointmentType ?? "follow_up",
      start_time:      `${date}T${startStr}:00`,
      end_time:        `${date}T${endStr}:00`,
      duration_min:    duration,
      priority:        req.priority ?? "normal",
      room:            `Room ${(optimized_schedule.length % 4) + 1}`,
    });
    cursor = slotEnd + bufferMin;
  }

  // Find gaps (>= 20 min)
  const gaps = [];
  for (let i = 0; i < optimized_schedule.length - 1; i++) {
    const slotEnd   = new Date(optimized_schedule[i].end_time).getTime();
    const nextStart = new Date(optimized_schedule[i + 1].start_time).getTime();
    const gapMin    = (nextStart - slotEnd) / 60000;
    if (gapMin >= 20) gaps.push({ after_slot: i + 1, gap_minutes: Math.round(gapMin), available_for: "walk-in or telehealth" });
  }

  const scheduledMinutes   = optimized_schedule.reduce((sum, s) => sum + s.duration_min, 0);
  const utilization_pct    = Math.round((scheduledMinutes / totalMinutes) * 100 * 10) / 10;
  const overbooking_risk   = optimized_schedule.length >= maxPts ? "high" : optimized_schedule.length >= maxPts * 0.85 ? "moderate" : "low";

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO hc_schedule_optimizations
      (id, provider_id, optimized_schedule, utilization_pct, gaps, overbooking_risk, fee_usd)
    VALUES (@id, @provider_id, @optimized_schedule, @utilization_pct, @gaps, @overbooking_risk, @fee_usd)
  `).run({
    id,
    provider_id:       providerId,
    optimized_schedule: JSON.stringify(optimized_schedule),
    utilization_pct,
    gaps:              JSON.stringify(gaps),
    overbooking_risk,
    fee_usd:           FEES.schedule,
  });

  return {
    optimization_id:  id,
    provider_id:      providerId,
    date,
    optimized_schedule,
    total_appointments: optimized_schedule.length,
    utilization_pct,
    gaps,
    overbooking_risk,
    fee_usd:          FEES.schedule,
  };
}

// ─── interpretLabResults ──────────────────────────────────────────────────────

const LAB_REFERENCE_RANGES = {
  glucose:       { low: 70,   high: 99,   unit: "mg/dL",  critical_low: 50,  critical_high: 500 },
  hemoglobin:    { low: 12.0, high: 17.5, unit: "g/dL",   critical_low: 7.0, critical_high: 20.0 },
  wbc:           { low: 4.5,  high: 11.0, unit: "K/uL",   critical_low: 2.0, critical_high: 30.0 },
  platelets:     { low: 150,  high: 400,  unit: "K/uL",   critical_low: 50,  critical_high: 1000 },
  sodium:        { low: 136,  high: 145,  unit: "mEq/L",  critical_low: 120, critical_high: 160 },
  potassium:     { low: 3.5,  high: 5.0,  unit: "mEq/L",  critical_low: 2.5, critical_high: 6.5 },
  creatinine:    { low: 0.6,  high: 1.2,  unit: "mg/dL",  critical_low: 0.3, critical_high: 10.0 },
  tsh:           { low: 0.4,  high: 4.0,  unit: "mIU/L",  critical_low: 0.1, critical_high: 10.0 },
  ldl:           { low: 0,    high: 100,  unit: "mg/dL",  critical_low: 0,   critical_high: 300 },
  hdl:           { low: 40,   high: 999,  unit: "mg/dL",  critical_low: 20,  critical_high: 999 },
  triglycerides: { low: 0,    high: 150,  unit: "mg/dL",  critical_low: 0,   critical_high: 1000 },
  hba1c:         { low: 0,    high: 5.7,  unit: "%",      critical_low: 0,   critical_high: 14 },
};

/**
 * Interpret lab results with clinical flagging and follow-up recommendations.
 * @param {string} labType            - Panel type: cbc|cmp|lipid|thyroid|hba1c|urinalysis
 * @param {object} results            - Key-value pairs of lab values e.g. { glucose: 126, hba1c: 7.2 }
 * @param {object} patientDemographics - { age, sex, pregnant, medications[] }
 * @returns {{ interpretations, abnormal_flags, trending, recommended_followup, fee_usd }}
 */
export function interpretLabResults(labType, results = {}, patientDemographics = {}) {
  if (!labType) throw new Error("labType is required");

  const validTypes = ["cbc", "cmp", "lipid", "thyroid", "hba1c", "urinalysis", "custom"];
  if (!validTypes.includes(labType)) throw new Error(`labType must be one of: ${validTypes.join(", ")}`);

  const interpretations = [];
  const abnormal_flags  = [];
  const trending        = [];
  const recommended_followup = [];

  for (const [marker, value] of Object.entries(results)) {
    const ref = LAB_REFERENCE_RANGES[marker.toLowerCase()];
    if (!ref) {
      interpretations.push({ marker, value, status: "unknown", note: "Reference range not available in system" });
      continue;
    }

    const numVal = parseFloat(value);
    let status = "normal";
    let note = `${marker} is within normal range (${ref.low}–${ref.high} ${ref.unit})`;

    if (numVal < ref.critical_low) {
      status = "critical_low";
      note = `CRITICAL LOW ${marker}: ${numVal} ${ref.unit} (critical threshold: <${ref.critical_low})`;
      abnormal_flags.push({ marker, value: numVal, flag: "CRITICAL_LOW", threshold: ref.critical_low, unit: ref.unit });
      recommended_followup.push(`Immediate clinical evaluation for critically low ${marker}`);
    } else if (numVal > ref.critical_high) {
      status = "critical_high";
      note = `CRITICAL HIGH ${marker}: ${numVal} ${ref.unit} (critical threshold: >${ref.critical_high})`;
      abnormal_flags.push({ marker, value: numVal, flag: "CRITICAL_HIGH", threshold: ref.critical_high, unit: ref.unit });
      recommended_followup.push(`Immediate clinical evaluation for critically high ${marker}`);
    } else if (numVal < ref.low) {
      status = "low";
      note = `${marker} below normal: ${numVal} ${ref.unit} (range: ${ref.low}–${ref.high})`;
      abnormal_flags.push({ marker, value: numVal, flag: "LOW", threshold: ref.low, unit: ref.unit });
    } else if (numVal > ref.high) {
      status = "high";
      note = `${marker} above normal: ${numVal} ${ref.unit} (range: ${ref.low}–${ref.high})`;
      abnormal_flags.push({ marker, value: numVal, flag: "HIGH", threshold: ref.high, unit: ref.unit });
    }

    interpretations.push({ marker, value: numVal, unit: ref.unit, reference_range: `${ref.low}–${ref.high}`, status, note });
  }

  // Auto follow-up suggestions based on lab type
  const followupMap = {
    cbc:      ["Repeat CBC in 4–6 weeks if abnormal", "Iron studies if low hemoglobin"],
    cmp:      ["Repeat BMP in 3 months", "Nephrology referral if creatinine elevated"],
    lipid:    ["Cardiovascular risk assessment", "Consider statin therapy if LDL >100 with risk factors"],
    thyroid:  ["Repeat TSH in 6 weeks after dose adjustment", "Endocrinology referral if TSH persistently abnormal"],
    hba1c:    ["Diabetes education if HbA1c >6.5%", "Medication adjustment review with prescriber"],
    urinalysis: ["Urine culture if WBCs present", "Nephrology referral if proteinuria persistent"],
  };
  if (followupMap[labType]) {
    for (const rec of followupMap[labType]) {
      if (!recommended_followup.includes(rec)) recommended_followup.push(rec);
    }
  }

  // Simulated trending (placeholder)
  if (abnormal_flags.length > 0) {
    trending.push({ observation: "Values trending abnormal — comparison with prior results recommended", action: "Request prior lab history from EMR" });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO hc_lab_interpretations
      (id, lab_type, interpretations, abnormal_flags, trending, recommended_followup, fee_usd)
    VALUES (@id, @lab_type, @interpretations, @abnormal_flags, @trending, @recommended_followup, @fee_usd)
  `).run({
    id,
    lab_type:            labType,
    interpretations:     JSON.stringify(interpretations),
    abnormal_flags:      JSON.stringify(abnormal_flags),
    trending:            JSON.stringify(trending),
    recommended_followup: JSON.stringify(recommended_followup),
    fee_usd:             FEES.labInterpret,
  });

  return {
    interpretation_id:  id,
    lab_type:           labType,
    total_markers:      interpretations.length,
    abnormal_count:     abnormal_flags.length,
    interpretations,
    abnormal_flags,
    trending,
    recommended_followup,
    patient_age:        patientDemographics.age ?? null,
    patient_sex:        patientDemographics.sex ?? null,
    fee_usd:            FEES.labInterpret,
  };
}

// ─── getHealthcareCompliance ──────────────────────────────────────────────────

const COMPLIANCE_RULES = {
  hipaa: {
    "share_patient_records": { compliant: false, requirements: ["Written patient authorization (45 CFR §164.508)", "Minimum necessary standard must be applied", "Business Associate Agreement if sharing with vendor"], violations: ["Unauthorized disclosure of PHI without patient consent"], remediation_steps: ["Obtain signed HIPAA authorization form", "Document minimum necessary determination", "Execute BAA before data transfer"] },
    "send_records_via_email": { compliant: false, requirements: ["Use encrypted, HIPAA-compliant email system", "Patient consent for electronic communication", "Message retention policy"], violations: ["Unencrypted PHI transmission violates 45 CFR §164.312(a)(2)(iv)"], remediation_steps: ["Implement TLS-encrypted email gateway", "Obtain written consent for electronic communication", "Switch to secure patient portal messaging"] },
    "retain_records_7_years": { compliant: true, requirements: ["State law may require longer retention (check local regulations)", "Records must be retrievable within 30 days"], violations: [], remediation_steps: [] },
    "de_identify_data":       { compliant: true, requirements: ["Apply Safe Harbor method: remove all 18 PHI identifiers", "Or use Expert Determination method with statistical validation"], violations: [], remediation_steps: [] },
    "breach_notification":    { compliant: true, requirements: ["Notify HHS within 60 days of discovery", "Notify individuals without unreasonable delay", "Notify media if >500 residents affected in a state"], violations: [], remediation_steps: [] },
  },
  hitech: {
    "access_patient_portal": { compliant: true, requirements: ["Provide electronic access within 30 days of request (21st Century Cures Act: 3 business days)", "Cannot charge unreasonable fees for access"], violations: [], remediation_steps: [] },
    "sell_patient_data":     { compliant: false, requirements: ["Explicit written authorization required", "Must disclose remuneration in authorization"], violations: ["HITECH §13405(d) prohibits sale of PHI without authorization"], remediation_steps: ["Obtain specific HITECH-compliant authorization", "Disclose any remuneration received", "Consult legal counsel before proceeding"] },
    "vendor_data_sharing":   { compliant: false, requirements: ["Business Associate Agreement required", "BAA must include breach notification obligations", "Subcontractor BAAs required"], violations: ["HITECH extended HIPAA liability to Business Associates"], remediation_steps: ["Execute comprehensive BAA", "Add subcontractor provisions", "Conduct vendor risk assessment"] },
  },
};

/**
 * Check HIPAA/HITECH compliance for a proposed action.
 * @param {string} action         - Action being evaluated (e.g., "share_patient_records")
 * @param {string} regulationType - hipaa|hitech|both
 * @returns {{ compliant, requirements, violations, remediation_steps, fee_usd }}
 */
export function getHealthcareCompliance(action, regulationType = "hipaa") {
  if (!action) throw new Error("action is required");

  const validTypes = ["hipaa", "hitech", "both"];
  if (!validTypes.includes(regulationType)) throw new Error(`regulationType must be one of: ${validTypes.join(", ")}`);

  const normalizedAction = action.toLowerCase().replace(/\s+/g, "_");

  const checkRegulation = (regType) => {
    const rules = COMPLIANCE_RULES[regType] ?? {};
    // Try exact match first, then partial
    let rule = rules[normalizedAction];
    if (!rule) {
      const matchKey = Object.keys(rules).find(k => normalizedAction.includes(k) || k.includes(normalizedAction));
      rule = matchKey ? rules[matchKey] : null;
    }
    return rule;
  };

  let compliant = true;
  const requirements = [];
  const violations   = [];
  const remediation_steps = [];
  const regulationsChecked = [];

  const regsToCheck = regulationType === "both" ? ["hipaa", "hitech"] : [regulationType];

  for (const reg of regsToCheck) {
    const rule = checkRegulation(reg);
    regulationsChecked.push(reg.toUpperCase());
    if (rule) {
      if (!rule.compliant) compliant = false;
      requirements.push(...rule.requirements.map(r => `[${reg.toUpperCase()}] ${r}`));
      violations.push(...rule.violations.map(v => `[${reg.toUpperCase()}] ${v}`));
      remediation_steps.push(...rule.remediation_steps.map(s => `[${reg.toUpperCase()}] ${s}`));
    } else {
      requirements.push(`[${reg.toUpperCase()}] No specific rule found for "${action}" — consult qualified HIPAA privacy officer`);
    }
  }

  return {
    action,
    regulation_type:   regulationType.toUpperCase(),
    regulations_checked: regulationsChecked,
    compliant,
    risk_level:        !compliant ? (violations.length > 1 ? "high" : "medium") : "low",
    requirements,
    violations,
    remediation_steps,
    disclaimer:        "This is a preliminary automated assessment. Consult a qualified HIPAA compliance officer for definitive guidance.",
    fee_usd:           FEES.compliance,
  };
}
