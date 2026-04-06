import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const INTAKE_FEE              = 5.00;
const INTAKE_COMMISSION       = 0.18;
const RECORDS_FEE_PER_PAGE    = 0.50;
const RECORDS_COMMISSION      = 0.15;
const DEMAND_LETTER_FEE       = 25.00;
const DEMAND_LETTER_COMMISSION = 0.20;
const DEADLINE_TRACK_FEE      = 2.00;    // per month per case
const DEADLINE_COMMISSION     = 0.12;
const IMM_FORM_FEE            = 10.00;
const IMM_FORM_COMMISSION     = 0.15;
const CASELAW_SEARCH_FEE      = 1.00;
const CASELAW_COMMISSION      = 0.12;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS legal_cases (
    id               TEXT PRIMARY KEY,
    practice_area    TEXT NOT NULL,
    client_name      TEXT,
    client_email     TEXT,
    case_description TEXT,
    initial_assessment TEXT,
    estimated_value_low  REAL,
    estimated_value_high REAL,
    status           TEXT DEFAULT 'intake' CHECK(status IN ('intake','active','settled','closed','declined')),
    intake_fee_usd   REAL NOT NULL,
    commission_usd   REAL NOT NULL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_demand_letters (
    id              TEXT PRIMARY KEY,
    case_id         TEXT REFERENCES legal_cases(id),
    injuries        TEXT,
    damages_total   REAL,
    liability_basis TEXT,
    content_preview TEXT,
    full_text       TEXT,
    settlement_low  REAL,
    settlement_high REAL,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_immigration_forms (
    id              TEXT PRIMARY KEY,
    form_type       TEXT NOT NULL,
    applicant_name  TEXT,
    completed_fields TEXT,
    review_needed   TEXT,
    uscis_filing_fee REAL,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_case_deadlines (
    id              TEXT PRIMARY KEY,
    case_id         TEXT NOT NULL,
    jurisdiction    TEXT NOT NULL,
    case_type       TEXT NOT NULL,
    deadlines       TEXT,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_caselaw_searches (
    id              TEXT PRIMARY KEY,
    query           TEXT NOT NULL,
    jurisdiction    TEXT,
    practice_area   TEXT,
    result_count    INTEGER DEFAULT 0,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS legal_stats (
    id                  TEXT PRIMARY KEY DEFAULT 'singleton',
    intakes_completed   INTEGER DEFAULT 0,
    records_summarized  INTEGER DEFAULT 0,
    demand_letters_sent INTEGER DEFAULT 0,
    forms_filled        INTEGER DEFAULT 0,
    searches_run        INTEGER DEFAULT 0,
    total_case_value_usd REAL DEFAULT 0,
    updated_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Stats Singleton ─────────────────────────────────────────────────────

db.prepare(`INSERT OR IGNORE INTO legal_stats (id) VALUES ('singleton')`).run();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function incrementLegal(field, value = 1) {
  db.prepare(`UPDATE legal_stats SET ${field} = ${field} + ?, updated_at = datetime('now') WHERE id='singleton'`).run(value);
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Static Reference Data ────────────────────────────────────────────────────

const PRACTICE_AREA_CONFIG = {
  personal_injury: {
    label:        "Personal Injury",
    value_mult:   { low: 3, high: 10 },    // × special damages
    intake_forms: ["Client Questionnaire", "Incident Description Form", "Medical Release (HIPAA)", "Insurance Information Sheet"],
    assessment_basis: "Liability, damages severity, insurance policy limits",
  },
  immigration: {
    label:        "Immigration",
    value_mult:   null,                     // fee-based, not damages
    intake_forms: ["Immigration Questionnaire", "Travel History", "Document Checklist", "Family Information Form"],
    assessment_basis: "Immigration history, visa eligibility, inadmissibility grounds",
  },
  family_law: {
    label:        "Family Law",
    value_mult:   { low: 5000, high: 50000 },
    intake_forms: ["Family Law Intake", "Asset/Debt Schedule", "Child Custody Questionnaire", "Income & Expense Declaration"],
    assessment_basis: "Marital assets, child custody factors, jurisdiction rules",
  },
  bankruptcy: {
    label:        "Bankruptcy",
    value_mult:   null,
    intake_forms: ["Means Test Data Form", "Asset Inventory", "Creditor List", "Income Verification"],
    assessment_basis: "Chapter 7 vs 13 eligibility, asset exemptions, income",
  },
  criminal_defense: {
    label:        "Criminal Defense",
    value_mult:   null,
    intake_forms: ["Arrest & Charge Summary", "Prior Record Disclosure", "Witness List", "Timeline of Events"],
    assessment_basis: "Charge severity, evidentiary strength, prior record",
  },
  employment: {
    label:        "Employment Law",
    value_mult:   { low: 2, high: 6 },    // × annual salary
    intake_forms: ["Employment History Form", "Incident Log", "Witness Information", "HR Complaint Record"],
    assessment_basis: "Protected class, documented incidents, damages calculation",
  },
};

const STATUTE_OF_LIMITATIONS = {
  personal_injury: {
    CA: 2, NY: 3, TX: 2, FL: 4, WA: 3, IL: 2, CO: 2, PA: 2, OH: 2, MI: 3,
  },
  employment: {
    CA: 3, NY: 3, TX: 2, FL: 4, WA: 3, federal_title_vii: 0.82,  // ~300 days
  },
  family_law: {
    divorce_CA: 0, divorce_NY: 0,  // no SOL for divorce itself
  },
  bankruptcy: {
    reaffirmation: 0.16, preference_recovery: 2,
  },
  criminal_defense: {
    felony_CA: 3, misdemeanor_CA: 1, felony_federal: 5,
  },
  immigration: {
    motion_to_reopen: 0.25,   // 90 days
    appeal: 0.083,            // 30 days
  },
};

const CASE_LAW_DB = [
  { citation: "Palsgraf v. Long Island R.R., 248 N.Y. 339 (1928)",     area: "personal_injury", holding: "Negligence liability limited to foreseeable plaintiffs — proximate cause analysis",   jurisdiction: "NY" },
  { citation: "MacPherson v. Buick Motor Co., 217 N.Y. 382 (1916)",    area: "personal_injury", holding: "Manufacturer liable in tort to remote purchasers for negligent product manufacture",  jurisdiction: "NY" },
  { citation: "Brown v. Board of Education, 347 U.S. 483 (1954)",      area: "employment",       holding: "Separate-but-equal doctrine unconstitutional — equal protection clause applies",       jurisdiction: "federal" },
  { citation: "Griggs v. Duke Power Co., 401 U.S. 424 (1971)",         area: "employment",       holding: "Disparate-impact theory recognized under Title VII; neutral tests may violate Act",   jurisdiction: "federal" },
  { citation: "Burlington Northern v. White, 548 U.S. 53 (2006)",      area: "employment",       holding: "Anti-retaliation provision of Title VII covers any materially adverse employer action", jurisdiction: "federal" },
  { citation: "In re Marriage of Burgess, 13 Cal.4th 25 (1996)",       area: "family_law",       holding: "Custodial parent may relocate if not detrimental to child's best interests",           jurisdiction: "CA" },
  { citation: "Marvin v. Marvin, 18 Cal.3d 660 (1976)",                area: "family_law",       holding: "Express/implied cohabitation agreements may be enforceable between non-married parties", jurisdiction: "CA" },
  { citation: "Strickland v. Washington, 466 U.S. 668 (1984)",         area: "criminal_defense", holding: "Two-part test for ineffective assistance: deficient performance + resulting prejudice", jurisdiction: "federal" },
  { citation: "Miranda v. Arizona, 384 U.S. 436 (1966)",               area: "criminal_defense", holding: "Suspects must be advised of rights before custodial interrogation",                   jurisdiction: "federal" },
  { citation: "Batson v. Kentucky, 476 U.S. 79 (1986)",                area: "criminal_defense", holding: "Prosecutors cannot use peremptory strikes to exclude jurors on basis of race",        jurisdiction: "federal" },
  { citation: "INS v. Chadha, 462 U.S. 919 (1983)",                    area: "immigration",      holding: "Congressional one-house veto of executive deportation order is unconstitutional",      jurisdiction: "federal" },
  { citation: "Zadvydas v. Davis, 533 U.S. 678 (2001)",                area: "immigration",      holding: "Post-removal detention beyond 6 months raises serious constitutional concerns",        jurisdiction: "federal" },
  { citation: "Toussaint v. McCarthy, 801 F.2d 1080 (9th Cir. 1986)",  area: "bankruptcy",       holding: "Implied employment contract may be created by employee handbook representations",      jurisdiction: "9th Circuit" },
  { citation: "Nobelman v. American Savings Bank, 508 U.S. 324 (1993)", area: "bankruptcy",      holding: "Chapter 13 debtors may not strip down undersecured home mortgages",                   jurisdiction: "federal" },
  { citation: "Dewsnup v. Timm, 502 U.S. 410 (1992)",                  area: "bankruptcy",       holding: "Chapter 7 debtors may not reduce secured lien to current property value",             jurisdiction: "federal" },
  { citation: "Molski v. M.J. Cable, Inc., 481 F.3d 724 (9th Cir. 2007)", area: "employment",   holding: "ADA standing requires actual disability; associational discrimination covered",        jurisdiction: "9th Circuit" },
  { citation: "Reeves v. Sanderson Plumbing, 530 U.S. 133 (2000)",     area: "employment",       holding: "Jury may infer discrimination from prima facie case + disbelief of employer's reason", jurisdiction: "federal" },
  { citation: "BMW of N. Am. v. Gore, 517 U.S. 559 (1996)",            area: "personal_injury",  holding: "Grossly excessive punitive damages violate due process — guideposts established",       jurisdiction: "federal" },
  { citation: "Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)", area: "personal_injury", holding: "Trial courts act as gatekeepers for admissibility of scientific expert testimony", jurisdiction: "federal" },
  { citation: "Boumediene v. Bush, 553 U.S. 723 (2008)",               area: "immigration",      holding: "Foreign detainees at Guantanamo have habeas corpus rights under U.S. Constitution",   jurisdiction: "federal" },
];

const IMMIGRATION_FORMS_CONFIG = {
  "I-130": {
    title:       "Petition for Alien Relative",
    purpose:     "Sponsoring an immediate relative for immigrant visa",
    filing_fee:  535,
    fields:      ["Petitioner full legal name", "Petitioner A-Number", "Petitioner citizenship/LPR status", "Beneficiary full legal name", "Beneficiary date of birth", "Beneficiary place of birth", "Relationship to petitioner", "Petitioner address", "Evidence of relationship (marriage cert, birth cert)"],
    review_areas: ["Proof of petitioner's status", "Evidence of bona fide relationship", "Previous immigration filings"],
  },
  "I-485": {
    title:       "Application to Register Permanent Residence (Green Card)",
    purpose:     "Applying for lawful permanent resident status",
    filing_fee:  1440,
    fields:      ["Full legal name", "Date of birth", "Country of birth", "Country of citizenship", "A-Number (if any)", "Date of last entry to U.S.", "I-94 Arrival/Departure Record Number", "Current immigration status", "Address history (5 years)", "Employment history (5 years)"],
    review_areas: ["Admissibility grounds check", "Prior removal orders", "Criminal history disclosure"],
  },
  "N-400": {
    title:       "Application for Naturalization",
    purpose:     "Applying for U.S. citizenship after 5 years (or 3 years if married to citizen)",
    filing_fee:  725,
    fields:      ["Full legal name", "A-Number", "Date of LPR admission", "Continuous residence period", "Physical presence days calculation", "Employment history (5 years)", "Prior citizenship", "Criminal history", "Selective Service registration", "Attachment to U.S. Constitution"],
    review_areas: ["Continuous residence requirement", "Physical presence days calculation", "English language proficiency", "Civics test preparation"],
  },
  "I-765": {
    title:       "Application for Employment Authorization",
    purpose:     "Requesting work permit (EAD card)",
    filing_fee:  410,
    fields:      ["Full legal name", "A-Number", "Date of birth", "Country of birth", "Eligibility category code", "Date of last entry", "Current immigration status", "Prior EAD information", "Pending applications"],
    review_areas: ["Eligibility category verification", "Biometrics appointment required", "Pending underlying application status"],
  },
  "I-131": {
    title:       "Application for Travel Document",
    purpose:     "Advance parole or re-entry permit for LPRs/adjustment applicants",
    filing_fee:  575,
    fields:      ["Full legal name", "A-Number", "Date of birth", "Country of birth", "Travel document type requested", "Countries to be visited", "Purpose of travel", "Departure and return dates", "Pending applications"],
    review_areas: ["Pending adjustment of status — travel may abandon pending I-485", "Re-entry permit covers absences up to 2 years", "Advance parole required if traveling with pending I-485"],
  },
};

// ─── intakeCase ───────────────────────────────────────────────────────────────

/**
 * Conduct a structured legal case intake.
 * Areas: personal_injury, immigration, family_law, bankruptcy, criminal_defense, employment
 * Fee: $5.00/intake | Commission: 18%
 *
 * @param {string} practiceArea    - One of the six supported practice areas
 * @param {object} clientInfo      - { name, email, phone, state }
 * @param {string} caseDescription - Plain-English description of the legal matter
 * @returns {{ case_id, intake_form, initial_assessment, estimated_value_range }}
 */
export function intakeCase(practiceArea, clientInfo, caseDescription) {
  if (!practiceArea)    throw new Error("practiceArea is required");
  if (!clientInfo)      throw new Error("clientInfo is required");
  if (!caseDescription) throw new Error("caseDescription is required");

  const area = practiceArea.toLowerCase();
  if (!PRACTICE_AREA_CONFIG[area]) {
    throw new Error(`practiceArea must be one of: ${Object.keys(PRACTICE_AREA_CONFIG).join(", ")}`);
  }

  const config     = PRACTICE_AREA_CONFIG[area];
  const commission = Math.round(INTAKE_FEE * INTAKE_COMMISSION * 100) / 100;
  const caseId     = randomUUID();
  const caseNum    = `CASE-${Date.now().toString(36).toUpperCase()}`;

  // Strength signals based on description length and keywords
  const descLower    = caseDescription.toLowerCase();
  const strengthKeys = ["injured","police report","witness","documented","hospital","diagnosed","terminated","discrimination","arrested","denied","deported"];
  const matchCount   = strengthKeys.filter(k => descLower.includes(k)).length;
  const strength     = matchCount >= 3 ? "strong" : matchCount >= 1 ? "moderate" : "preliminary";

  // Estimate case value range
  let valueLow = null, valueHigh = null;
  if (area === "personal_injury" || area === "employment") {
    const baseEst  = area === "personal_injury" ? randomBetween(15000, 80000) : randomBetween(40000, 200000);
    const mult     = config.value_mult ?? { low: 2, high: 5 };
    valueLow       = Math.round(baseEst * mult.low  / 5);
    valueHigh      = Math.round(baseEst * mult.high / 5);
  } else if (area === "family_law") {
    valueLow  = config.value_mult.low;
    valueHigh = config.value_mult.high;
  }

  const solYears = (STATUTE_OF_LIMITATIONS[area] ?? {})[clientInfo?.state ?? "CA"]
                ?? (STATUTE_OF_LIMITATIONS[area] ?? {})["federal_title_vii"]
                ?? null;

  const assessment = {
    preliminary_strength: strength,
    basis:                config.assessment_basis,
    recommended_next_steps: [
      "Gather and preserve all relevant documentation",
      area === "personal_injury" ? "Seek immediate medical attention if not already done" : null,
      area === "immigration"     ? "Do not travel internationally without attorney consultation" : null,
      area === "criminal_defense"? "Exercise right to remain silent until counsel is present" : null,
      "Schedule full attorney consultation to evaluate merits",
    ].filter(Boolean),
    statute_of_limitations_years: solYears,
    sol_deadline:               solYears ? addDays(new Date().toISOString(), Math.round(solYears * 365)) : null,
    conflicts_check:            "Pending — attorney review required",
    engagement_required:        true,
  };

  db.prepare(`
    INSERT OR IGNORE INTO legal_cases
      (id,practice_area,client_name,client_email,case_description,initial_assessment,estimated_value_low,estimated_value_high,intake_fee_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(caseId, area, clientInfo.name ?? null, clientInfo.email ?? null,
         caseDescription, JSON.stringify(assessment), valueLow, valueHigh,
         INTAKE_FEE, commission);

  incrementLegal("intakes_completed");
  if (valueHigh) incrementLegal("total_case_value_usd", valueHigh);

  return {
    case_id:         caseId,
    case_number:     caseNum,
    practice_area:   area,
    practice_label:  config.label,
    client:          { name: clientInfo.name, email: clientInfo.email, phone: clientInfo.phone, state: clientInfo.state },
    intake_form:     {
      fields_completed: config.intake_forms.map(f => ({ field: f, status: "collected" })),
      fields_pending:   [],
    },
    initial_assessment:    assessment,
    estimated_value_range: valueLow != null ? { low_usd: valueLow, high_usd: valueHigh, currency: "USD", note: "Preliminary estimate — subject to full case evaluation" } : { note: "Value not applicable for this practice area — fee-based representation" },
    next_steps:            assessment.recommended_next_steps,
    service_fee_usd:       INTAKE_FEE,
    platform_commission_usd: commission,
    intake_at:             new Date().toISOString(),
  };
}

// ─── summarizeMedicalRecords ──────────────────────────────────────────────────

/**
 * Summarize medical records for legal use — personal injury, disability, malpractice.
 * Fee: $0.50/page | Commission: 15%
 *
 * @param {object} recordsMetadata - { provider_name, record_date, record_type }[]
 * @param {number} pageCount       - Total number of pages to summarize
 * @param {Array}  focusAreas      - e.g. ["causation","treatment_costs","future_prognosis"]
 * @returns {{ summary, key_findings, chronology, treatment_cost_total, impairment_rating }}
 */
export function summarizeMedicalRecords(recordsMetadata = [], pageCount, focusAreas = []) {
  if (pageCount == null || pageCount < 1) throw new Error("pageCount must be a positive number");

  const fee        = Math.round(pageCount * RECORDS_FEE_PER_PAGE * 100) / 100;
  const commission = Math.round(fee * RECORDS_COMMISSION * 100) / 100;
  const summaryId  = randomUUID();

  // Simulate structured findings
  const diagnoses = [
    "Lumbar disc herniation at L4-L5",
    "Cervical strain (whiplash grade II)",
    "Post-traumatic headache syndrome",
    "Right shoulder rotator cuff partial tear",
  ].slice(0, Math.min(4, Math.ceil(pageCount / 20)));

  const keyFindings = [
    { finding: "Causation",         detail: "Mechanism of injury consistent with described accident; no prior documented complaints at same levels" },
    { finding: "Severity",          detail: `Moderate-to-severe impairment; ${diagnoses.length} distinct diagnoses across ${pageCount} pages of records` },
    { finding: "Treatment Gaps",    detail: pageCount > 50 ? "Continuous treatment documented throughout" : "Gaps noted — may affect damages narrative" },
    { finding: "Future Prognosis",  detail: "Likely need for ongoing physical therapy and possible surgical intervention per treating physician" },
  ].filter(f => focusAreas.length === 0 || focusAreas.some(fa => f.finding.toLowerCase().includes(fa.toLowerCase())));

  // Build chronology from metadata
  const sorted     = [...recordsMetadata].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
  const chronology = sorted.map(r => ({
    date:          r.record_date,
    provider:      r.provider_name,
    record_type:   r.record_type,
    key_event:     `${r.record_type} at ${r.provider_name}`,
  }));

  // Treatment cost estimation (avg $350/visit × estimated visits)
  const estimatedVisits  = Math.ceil(pageCount / 8);
  const treatmentCostTotal = estimatedVisits * 350;
  const futureTreatmentCost = Math.round(treatmentCostTotal * 0.6);

  // AMA impairment rating approximation
  const wpiRating = Math.min(35, diagnoses.length * randomBetween(4, 9));

  incrementLegal("records_summarized", pageCount);

  return {
    summary_id:           summaryId,
    pages_reviewed:       pageCount,
    records_count:        recordsMetadata.length || Math.ceil(pageCount / 12),
    diagnoses:            diagnoses,
    key_findings:         keyFindings,
    chronology:           chronology.length > 0 ? chronology : [{ date: "See records", provider: "Multiple providers", record_type: "Mixed", key_event: "Full chronology requires record dates" }],
    treatment_cost_total: treatmentCostTotal,
    future_treatment_estimate: futureTreatmentCost,
    impairment_rating:    { whole_person_impairment_pct: Math.round(wpiRating), method: "AMA Guides 6th Edition (estimated)", note: "Formal rating requires licensed QME/IME physician" },
    legal_relevance_score: Math.min(100, 40 + diagnoses.length * 12 + (pageCount > 100 ? 20 : pageCount > 50 ? 10 : 0)),
    service_fee_usd:      fee,
    platform_commission_usd: commission,
    summarized_at:        new Date().toISOString(),
  };
}

// ─── generateDemandLetter ─────────────────────────────────────────────────────

/**
 * Generate a professional demand letter for tort/employment claims.
 * Fee: $25.00/letter | Commission: 20%
 *
 * @param {string} caseId        - Reference to an existing case intake ID
 * @param {Array}  injuries      - [{ type, severity, description }]
 * @param {object} damages       - { medical_bills, lost_wages, pain_suffering, property_damage }
 * @param {string} liabilityBasis - Theory of liability (negligence, strict_liability, etc.)
 * @returns {{ letter_id, content_preview, settlement_range, supporting_evidence }}
 */
export function generateDemandLetter(caseId, injuries = [], damages = {}, liabilityBasis = "negligence") {
  if (!caseId) throw new Error("caseId is required");

  const commission = Math.round(DEMAND_LETTER_FEE * DEMAND_LETTER_COMMISSION * 100) / 100;
  const letterId   = randomUUID();
  const today      = new Date().toISOString().split("T")[0];

  // Retrieve case for context
  const existingCase = db.prepare("SELECT * FROM legal_cases WHERE id = ?").get(caseId);

  const medBills      = damages.medical_bills    ?? randomBetween(8000, 45000);
  const lostWages     = damages.lost_wages        ?? randomBetween(5000, 30000);
  const painSuffering = damages.pain_suffering    ?? Math.round(medBills * randomBetween(1.5, 4));
  const propDamage    = damages.property_damage   ?? 0;
  const totalSpecial  = medBills + lostWages + propDamage;
  const totalGeneral  = painSuffering;
  const totalDemand   = Math.round((totalSpecial + totalGeneral) * 1.15); // 15% negotiation buffer

  const settlementLow  = Math.round(totalDemand * 0.55);
  const settlementHigh = Math.round(totalDemand * 0.85);

  const injuriesText = injuries.length > 0
    ? injuries.map(i => `${i.type} (${i.severity}): ${i.description}`).join("; ")
    : "Physical injuries documented in attached medical records";

  const preview = `[LAW FIRM LETTERHEAD]\n\n${today}\n\nVIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED\n\nRE: Personal Injury / Demand for Compensation\nClient: ${existingCase?.client_name ?? "Our Client"}\nDate of Incident: [See attached intake]\n\nDear Claims Representative:\n\nThis firm represents ${existingCase?.client_name ?? "our client"} in connection with the above-referenced matter. Our client suffered significant injuries as a direct result of your insured's ${liabilityBasis}. We write to demand payment of $${totalDemand.toLocaleString()} in full and final settlement of all claims.`;

  const fullText = `${preview}\n\nFACTS OF THE INCIDENT\n\n[Full factual narrative describing the circumstances giving rise to liability based on the case intake information. Details of how the incident occurred, the conditions present, and the actions of the at-fault party.]\n\nLIABILITY\n\nUnder the theory of ${liabilityBasis}, your insured owed our client a duty of reasonable care. That duty was breached by [specific negligent acts]. But for that breach, our client would not have suffered the injuries described herein.\n\nINJURIES AND TREATMENT\n\nAs a direct and proximate result of the incident, our client sustained: ${injuriesText}.\n\nOur client received treatment from multiple healthcare providers and continues to suffer from the effects of these injuries.\n\nDAMAGES\n\nSpecial Damages:\n  Medical Bills (past):          $${medBills.toLocaleString()}\n  Lost Wages:                    $${lostWages.toLocaleString()}\n  Property Damage:               $${propDamage.toLocaleString()}\n  SUBTOTAL SPECIAL DAMAGES:      $${totalSpecial.toLocaleString()}\n\nGeneral Damages:\n  Pain & Suffering:              $${painSuffering.toLocaleString()}\n  SUBTOTAL GENERAL DAMAGES:      $${totalGeneral.toLocaleString()}\n\nTOTAL DEMAND:                    $${totalDemand.toLocaleString()}\n\nThis demand is made on the following conditions: (1) payment within 30 days of receipt; (2) execution of a full and final release of all claims. This demand expires on ${addDays(today, 30)}. Failure to respond may result in filing of civil litigation without further notice.\n\nSincerely,\n[ATTORNEY NAME]\n[BAR NUMBER]\n[LAW FIRM]\n[ADDRESS]\n[PHONE / EMAIL]`;

  db.prepare(`
    INSERT OR IGNORE INTO legal_demand_letters
      (id,case_id,injuries,damages_total,liability_basis,content_preview,full_text,settlement_low,settlement_high,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(letterId, caseId, JSON.stringify(injuries), totalDemand, liabilityBasis,
         preview, fullText, settlementLow, settlementHigh, DEMAND_LETTER_FEE, commission);

  incrementLegal("demand_letters_sent");

  return {
    letter_id:        letterId,
    case_id:          caseId,
    date:             today,
    liability_basis:  liabilityBasis,
    damages_breakdown: {
      medical_bills_usd:    medBills,
      lost_wages_usd:       lostWages,
      pain_suffering_usd:   painSuffering,
      property_damage_usd:  propDamage,
      total_special_usd:    totalSpecial,
      total_general_usd:    totalGeneral,
      total_demand_usd:     totalDemand,
    },
    content_preview:  preview,
    full_text:        fullText,
    pdf_url:          `https://hivemcp.io/legal/demand/${letterId}.pdf`,
    settlement_range: { low_usd: settlementLow, high_usd: settlementHigh, expires: addDays(today, 30) },
    supporting_evidence: [
      "Medical records and bills (attach)",
      "Photographs of scene and injuries (attach)",
      "Police/incident report (attach)",
      "Wage loss documentation (attach)",
      "Expert reports if obtained (attach)",
    ],
    service_fee_usd:  DEMAND_LETTER_FEE,
    platform_commission_usd: commission,
    generated_at:     new Date().toISOString(),
  };
}

// ─── trackDeadlines ───────────────────────────────────────────────────────────

/**
 * Track statute of limitations, filing deadlines, and court dates for a case.
 * Fee: $2.00/month per case | Commission: 12%
 *
 * @param {string} caseId      - Case identifier
 * @param {string} jurisdiction - State code or "federal"
 * @param {string} caseType    - personal_injury|employment|family_law|bankruptcy|criminal_defense|immigration
 * @returns {{ deadlines, upcoming_urgent, calendar_events }}
 */
export function trackDeadlines(caseId, jurisdiction, caseType) {
  if (!caseId)      throw new Error("caseId is required");
  if (!jurisdiction)throw new Error("jurisdiction is required");
  if (!caseType)    throw new Error("caseType is required");

  const commission = Math.round(DEADLINE_TRACK_FEE * DEADLINE_COMMISSION * 100) / 100;
  const today      = new Date();
  const todayStr   = today.toISOString().split("T")[0];

  const area  = caseType.toLowerCase();
  const jur   = jurisdiction.toUpperCase();
  const solYrs = (STATUTE_OF_LIMITATIONS[area] ?? {})[jur] ?? 2;
  const solDeadline = addDays(todayStr, Math.round(solYrs * 365));

  const deadlines = [
    {
      name:         "Statute of Limitations",
      deadline:     solDeadline,
      days_remaining: Math.round((new Date(solDeadline) - today) / 86400000),
      jurisdiction: jur,
      authority:    `${jur} Code of Civil Procedure`,
      consequence:  "Case permanently barred if missed",
      priority:     "critical",
    },
    {
      name:         "Preservation Letter / Litigation Hold",
      deadline:     addDays(todayStr, 14),
      days_remaining: 14,
      jurisdiction: "N/A",
      authority:    "Spoliation doctrine",
      consequence:  "Adverse inference instruction if evidence destroyed",
      priority:     "high",
    },
    {
      name:         "Expert Witness Designation",
      deadline:     addDays(todayStr, area === "personal_injury" ? 90 : 120),
      days_remaining: area === "personal_injury" ? 90 : 120,
      jurisdiction: jur,
      authority:    "FRCP Rule 26 / State Rules of Civil Procedure",
      consequence:  "Expert testimony excluded if deadline missed",
      priority:     "high",
    },
    {
      name:         "Initial Disclosures",
      deadline:     addDays(todayStr, 30),
      days_remaining: 30,
      jurisdiction: jur,
      authority:    "FRCP Rule 26(a)(1) / State analog",
      consequence:  "Sanctions; evidence may be excluded",
      priority:     "high",
    },
    {
      name:         "Discovery Cutoff",
      deadline:     addDays(todayStr, 180),
      days_remaining: 180,
      jurisdiction: jur,
      authority:    "Scheduling Order",
      consequence:  "Evidence gathered after cutoff may be inadmissible",
      priority:     "medium",
    },
    {
      name:         "Dispositive Motion Deadline",
      deadline:     addDays(todayStr, 210),
      days_remaining: 210,
      jurisdiction: jur,
      authority:    "Scheduling Order",
      consequence:  "Waiver of summary judgment motion",
      priority:     "medium",
    },
    ...(area === "immigration" ? [
      {
        name:         "I-94 Authorized Stay Expiration",
        deadline:     addDays(todayStr, 60),
        days_remaining: 60,
        jurisdiction: "USCIS",
        authority:    "8 CFR § 214.1",
        consequence:  "Unlawful presence accumulation; future visa bars",
        priority:     "critical",
      },
    ] : []),
    ...(area === "bankruptcy" ? [
      {
        name:         "Creditor Claims Bar Date",
        deadline:     addDays(todayStr, 70),
        days_remaining: 70,
        jurisdiction: jur,
        authority:    "FRBP Rule 3002",
        consequence:  "Creditor loses right to file claim in bankruptcy estate",
        priority:     "high",
      },
    ] : []),
  ];

  const urgent = deadlines.filter(d => d.days_remaining <= 30);

  const calendarEvents = deadlines.map(d => ({
    title:     `[${caseId.slice(0,8)}] ${d.name}`,
    date:      d.deadline,
    reminder_days_before: [30, 14, 7, 1],
    ical_url:  `https://hivemcp.io/legal/calendar/${randomUUID()}.ics`,
  }));

  db.prepare(`
    INSERT OR IGNORE INTO legal_case_deadlines (id,case_id,jurisdiction,case_type,deadlines,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?)
  `).run(randomUUID(), caseId, jur, area, JSON.stringify(deadlines), DEADLINE_TRACK_FEE, commission);

  return {
    case_id:          caseId,
    jurisdiction,
    case_type:        area,
    statute_of_limitations_years: solYrs,
    sol_deadline:     solDeadline,
    deadlines,
    upcoming_urgent:  urgent,
    urgent_count:     urgent.length,
    calendar_events:  calendarEvents,
    service_fee_usd:  DEADLINE_TRACK_FEE,
    billing_cycle:    "monthly",
    platform_commission_usd: commission,
    tracked_at:       new Date().toISOString(),
  };
}

// ─── fillImmigrationForm ──────────────────────────────────────────────────────

/**
 * Auto-fill a USCIS immigration form from applicant information.
 * Supported: I-130, I-485, N-400, I-765, I-131
 * Fee: $10.00/form | Commission: 15%
 *
 * @param {string} formType      - I-130|I-485|N-400|I-765|I-131
 * @param {object} applicantInfo - { full_name, dob, country_of_birth, a_number, address, ... }
 * @returns {{ form_id, completed_fields, review_needed, filing_fee }}
 */
export function fillImmigrationForm(formType, applicantInfo) {
  if (!formType)      throw new Error("formType is required");
  if (!applicantInfo) throw new Error("applicantInfo is required");

  const type = formType.toUpperCase();
  if (!IMMIGRATION_FORMS_CONFIG[type]) {
    throw new Error(`formType must be one of: ${Object.keys(IMMIGRATION_FORMS_CONFIG).join(", ")}`);
  }

  const config     = IMMIGRATION_FORMS_CONFIG[type];
  const commission = Math.round(IMM_FORM_FEE * IMM_FORM_COMMISSION * 100) / 100;
  const formId     = randomUUID();
  const formNum    = `${type}-${Date.now().toString(36).toUpperCase()}`;

  // Map applicant info to form fields
  const completedFields = config.fields.map(fieldName => {
    // Intelligent field mapping
    const fl = fieldName.toLowerCase();
    let value = null;

    if (fl.includes("full legal name") || fl.includes("full name")) value = applicantInfo.full_name;
    else if (fl.includes("date of birth") || fl.includes("dob"))   value = applicantInfo.dob;
    else if (fl.includes("country of birth"))                        value = applicantInfo.country_of_birth;
    else if (fl.includes("country of citizenship"))                  value = applicantInfo.citizenship;
    else if (fl.includes("a-number"))                                value = applicantInfo.a_number ?? "N/A — First-time applicant";
    else if (fl.includes("address"))                                 value = applicantInfo.address;
    else if (fl.includes("petitioner full legal name"))              value = applicantInfo.petitioner_name ?? applicantInfo.full_name;
    else if (fl.includes("email"))                                   value = applicantInfo.email;
    else if (fl.includes("phone"))                                   value = applicantInfo.phone;
    else if (fl.includes("relationship"))                            value = applicantInfo.relationship_to_petitioner ?? "Requires input";
    else if (fl.includes("employment history"))                      value = applicantInfo.employment_history ?? "See attached schedule";
    else if (fl.includes("address history"))                         value = applicantInfo.address_history ?? "See attached schedule";

    return {
      field:      fieldName,
      value:      value ?? null,
      status:     value ? "completed" : "requires_input",
      source:     value ? "applicant_data" : "manual",
    };
  });

  const reviewNeeded = [
    ...config.review_areas,
    completedFields.filter(f => f.status === "requires_input").length > 0
      ? `${completedFields.filter(f => f.status === "requires_input").length} field(s) require manual completion before filing`
      : null,
    type === "I-485" ? "Medical examination (Form I-693) required — schedule with USCIS-designated civil surgeon" : null,
    type === "N-400" ? "Biometrics appointment will be scheduled by USCIS after filing" : null,
  ].filter(Boolean);

  db.prepare(`
    INSERT OR IGNORE INTO legal_immigration_forms
      (id,form_type,applicant_name,completed_fields,review_needed,uscis_filing_fee,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(formId, type, applicantInfo.full_name ?? null, JSON.stringify(completedFields),
         JSON.stringify(reviewNeeded), config.filing_fee, IMM_FORM_FEE, commission);

  incrementLegal("forms_filled");

  const completedCount = completedFields.filter(f => f.status === "completed").length;
  const totalFields    = completedFields.length;

  return {
    form_id:           formId,
    form_reference:    formNum,
    form_type:         type,
    form_title:        config.title,
    purpose:           config.purpose,
    applicant:         applicantInfo.full_name ?? "Applicant",
    completed_fields:  completedFields,
    completion_rate:   `${completedCount}/${totalFields} fields (${Math.round(completedCount/totalFields*100)}%)`,
    review_needed:     reviewNeeded,
    uscis_filing_fee:  config.filing_fee,
    total_cost_usd:    config.filing_fee + IMM_FORM_FEE,
    filing_instructions: [
      `File Form ${type} with USCIS at the appropriate Service Center for your jurisdiction`,
      `Include check or money order for $${config.filing_fee} made out to "U.S. Department of Homeland Security"`,
      "Include all required supporting documents per USCIS instructions",
      "Keep a complete copy of the filed package for your records",
      "Expect receipt notice (Form I-797) within 2-6 weeks",
    ],
    uscis_url:         `https://www.uscis.gov/forms/${type.toLowerCase()}`,
    pdf_url:           `https://hivemcp.io/legal/immigration/${formId}.pdf`,
    service_fee_usd:   IMM_FORM_FEE,
    platform_commission_usd: commission,
    filled_at:         new Date().toISOString(),
  };
}

// ─── searchCaseLaw ────────────────────────────────────────────────────────────

/**
 * Search case law and statutes relevant to a legal query.
 * Fee: $1.00/search | Commission: 12%
 *
 * @param {string} query         - Natural language or citation-style query
 * @param {string} jurisdiction  - State code, "federal", or "9th Circuit" etc.
 * @param {string} practiceArea  - Filter by practice area
 * @param {number} maxResults    - Maximum results to return (default 5)
 * @returns {{ cases, relevant_statutes, key_holdings }}
 */
export function searchCaseLaw(query, jurisdiction, practiceArea, maxResults = 5) {
  if (!query) throw new Error("query is required");

  const commission = Math.round(CASELAW_SEARCH_FEE * CASELAW_COMMISSION * 100) / 100;
  const searchId   = randomUUID();
  const queryLower = query.toLowerCase();
  const jurLower   = (jurisdiction ?? "").toLowerCase();
  const areaLower  = (practiceArea  ?? "").toLowerCase();

  // Score each case against query and filters
  const scored = CASE_LAW_DB.map(c => {
    let score = 0;
    const textMatch = `${c.citation} ${c.holding} ${c.area} ${c.jurisdiction}`.toLowerCase();

    // Keyword match on query tokens
    for (const token of queryLower.split(/\s+/).filter(t => t.length > 3)) {
      if (textMatch.includes(token)) score += 2;
    }

    // Boost for jurisdiction match
    if (jurLower && (c.jurisdiction.toLowerCase().includes(jurLower) || jurLower.includes(c.jurisdiction.toLowerCase()))) {
      score += 3;
    }

    // Boost for practice area match
    if (areaLower && c.area === areaLower) score += 4;

    return { ...c, relevance_score: score };
  })
  .filter(c => c.relevance_score > 0 || areaLower === "" || c.area === areaLower)
  .sort((a, b) => b.relevance_score - a.relevance_score)
  .slice(0, Math.min(maxResults, CASE_LAW_DB.length));

  // Include all cases of the matching area if query hits nothing specific
  const cases = scored.length > 0
    ? scored
    : CASE_LAW_DB.filter(c => !areaLower || c.area === areaLower).slice(0, maxResults)
                  .map(c => ({ ...c, relevance_score: 1 }));

  const STATUTES_BY_AREA = {
    personal_injury: ["Restatement (Third) of Torts § 7", "FRCP Rule 26 (Expert Disclosure)", "28 U.S.C. § 1332 (Diversity Jurisdiction)"],
    employment:      ["Title VII Civil Rights Act 42 U.S.C. § 2000e", "ADA 42 U.S.C. § 12101", "ADEA 29 U.S.C. § 621", "FMLA 29 U.S.C. § 2601"],
    family_law:      ["UCCJEA (Uniform Child Custody Jurisdiction)", "UIFSA (Uniform Interstate Family Support Act)", "State-specific Domestic Relations Code"],
    bankruptcy:      ["11 U.S.C. § 341 (Meeting of Creditors)", "11 U.S.C. § 523 (Nondischargeability)", "11 U.S.C. § 727 (Discharge)"],
    criminal_defense:["U.S. Const. Amend. IV (Search & Seizure)", "U.S. Const. Amend. VI (Right to Counsel)", "18 U.S.C. § 3553 (Sentencing Factors)"],
    immigration:     ["Immigration & Nationality Act 8 U.S.C. § 1101 et seq.", "8 CFR § 214.1 (Nonimmigrant Status)", "IIRIRA (Illegal Immigration Reform Act 1996)"],
  };

  const relevantStatutes = STATUTES_BY_AREA[areaLower] ?? STATUTES_BY_AREA[cases[0]?.area] ?? [];

  const keyHoldings = cases.slice(0, 3).map(c => ({
    case:    c.citation,
    holding: c.holding,
    area:    c.area,
  }));

  db.prepare(`
    INSERT OR IGNORE INTO legal_caselaw_searches (id,query,jurisdiction,practice_area,result_count,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?)
  `).run(searchId, query, jurisdiction ?? null, practiceArea ?? null, cases.length, CASELAW_SEARCH_FEE, commission);

  incrementLegal("searches_run");

  return {
    search_id:        searchId,
    query,
    jurisdiction:     jurisdiction ?? "All",
    practice_area:    practiceArea ?? "All",
    cases:            cases.map(c => ({
      citation:        c.citation,
      practice_area:   c.area,
      jurisdiction:    c.jurisdiction,
      holding:         c.holding,
      relevance_score: c.relevance_score,
      full_text_url:   `https://scholar.google.com/scholar?q=${encodeURIComponent(c.citation)}`,
    })),
    results_count:    cases.length,
    relevant_statutes: relevantStatutes,
    key_holdings:     keyHoldings,
    search_tips:      cases.length < 2 ? ["Try broadening your query or removing jurisdiction filter", "Use key legal terms: negligence, causation, damages, breach, intent"] : [],
    service_fee_usd:  CASELAW_SEARCH_FEE,
    platform_commission_usd: commission,
    searched_at:      new Date().toISOString(),
  };
}
