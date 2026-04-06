import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ESIG_PLATFORM_COMMISSION      = 0.18; // 18% on signature requests
const FILING_PLATFORM_COMMISSION    = 0.22; // 22% on legal filings (higher due to value)

const SIGNATURE_REQUEST_FEE_USD = 2.99;  // per signature request initiated
const PER_SIGNER_FEE_USD        = 1.00;  // per additional signer
const FILING_BASE_FEE_USD       = 49.99; // base for entity/filing requests
const TEMPLATE_FETCH_FEE_USD    = 0.50;  // per template retrieval

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS esig_signature_requests (
    id                TEXT PRIMARY KEY,
    document_type     TEXT NOT NULL,
    template_id       TEXT,
    parties           TEXT NOT NULL,
    signer_count      INTEGER NOT NULL,
    status            TEXT DEFAULT 'pending' CHECK(status IN (
                        'pending','partially_signed','fully_signed','expired','voided')),
    document_hash     TEXT,
    envelope_id       TEXT,
    expiry_date       TEXT,
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    signers_completed INTEGER DEFAULT 0,
    completed_at      TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS esig_signatures (
    id                TEXT PRIMARY KEY,
    request_id        TEXT NOT NULL REFERENCES esig_signature_requests(id),
    signer_identity   TEXT NOT NULL,
    signer_email      TEXT,
    signer_role       TEXT,
    signature_token   TEXT NOT NULL,
    ip_address        TEXT,
    user_agent        TEXT,
    geo_location      TEXT,
    legal_text_agreed TEXT,
    status            TEXT DEFAULT 'pending' CHECK(status IN ('pending','signed','declined','bounced')),
    signed_at         TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS esig_filings (
    id                TEXT PRIMARY KEY,
    entity_type       TEXT NOT NULL,
    jurisdiction      TEXT NOT NULL,
    details           TEXT NOT NULL,
    filing_reference  TEXT,
    status            TEXT DEFAULT 'submitted' CHECK(status IN (
                        'submitted','under_review','approved','rejected','needs_amendment',
                        'registered','pending_payment','cancelled')),
    government_fee_usd  REAL,
    platform_fee_usd    REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    total_cost_usd      REAL NOT NULL,
    estimated_days      INTEGER,
    confirmation_number TEXT,
    rejection_reason    TEXT,
    approved_at         TEXT,
    submitted_at        TEXT DEFAULT (datetime('now')),
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS esig_templates (
    id                TEXT PRIMARY KEY,
    document_type     TEXT NOT NULL,
    jurisdiction      TEXT NOT NULL,
    template_name     TEXT NOT NULL,
    description       TEXT,
    version           TEXT DEFAULT '1.0',
    required_fields   TEXT,
    optional_fields   TEXT,
    governing_law     TEXT,
    languages         TEXT DEFAULT '["en"]',
    signer_roles      TEXT,
    fetch_fee_usd     REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    active            INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Templates ───────────────────────────────────────────────────────────

const _tplCount = db.prepare("SELECT COUNT(*) as n FROM esig_templates").get().n;
if (_tplCount === 0) {
  const TEMPLATE_COMMISSION = Math.round(TEMPLATE_FETCH_FEE_USD * ESIG_PLATFORM_COMMISSION * 100) / 100;
  const seedTemplates = [
    {
      id: uuid(), document_type: "nda", jurisdiction: "US-DE",
      template_name: "Mutual Non-Disclosure Agreement (Delaware)",
      description: "Standard mutual NDA for business discussions. Governed by Delaware law.",
      version: "3.2", governing_law: "State of Delaware",
      required_fields: '["party_a_name","party_b_name","effective_date","purpose","term_years"]',
      optional_fields: '["excluded_info","remedy_clause","arbitration_clause"]',
      signer_roles: '["disclosing_party","receiving_party"]',
      languages: '["en"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
    {
      id: uuid(), document_type: "llc_operating_agreement", jurisdiction: "US-DE",
      template_name: "Single-Member LLC Operating Agreement (Delaware)",
      description: "Operating agreement for a Delaware single-member LLC.",
      version: "2.1", governing_law: "State of Delaware",
      required_fields: '["llc_name","member_name","registered_agent","effective_date","business_purpose"]',
      optional_fields: '["capital_contribution","fiscal_year","dissolution_events"]',
      signer_roles: '["sole_member","registered_agent"]',
      languages: '["en"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
    {
      id: uuid(), document_type: "service_agreement", jurisdiction: "US-CA",
      template_name: "Professional Services Agreement (California)",
      description: "Consulting and professional services contract compliant with California law.",
      version: "4.0", governing_law: "State of California",
      required_fields: '["client_name","provider_name","services_description","start_date","payment_terms"]',
      optional_fields: '["ip_assignment","non_solicitation","limitation_of_liability"]',
      signer_roles: '["client","service_provider"]',
      languages: '["en","es"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
    {
      id: uuid(), document_type: "employment_agreement", jurisdiction: "EU-GDPR",
      template_name: "EU Employment Agreement with GDPR Data Annex",
      description: "Employment contract with integrated GDPR data processing annex for EU workers.",
      version: "2.3", governing_law: "EU / Member State law",
      required_fields: '["employer_name","employee_name","position","start_date","salary","country"]',
      optional_fields: '["probation_period","non_compete","remote_work_policy","equity"]',
      signer_roles: '["employer","employee","hr_witness"]',
      languages: '["en","de","fr","es","it"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
    {
      id: uuid(), document_type: "ip_assignment", jurisdiction: "US-DE",
      template_name: "Intellectual Property Assignment Agreement",
      description: "Full IP assignment from contractor/founder to entity. Includes work-for-hire clause.",
      version: "1.8", governing_law: "State of Delaware",
      required_fields: '["assignor_name","assignee_name","ip_description","consideration","effective_date"]',
      optional_fields: '["moral_rights_waiver","license_back","carve_outs"]',
      signer_roles: '["assignor","assignee"]',
      languages: '["en"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
    {
      id: uuid(), document_type: "saas_agreement", jurisdiction: "US-NY",
      template_name: "SaaS Subscription Agreement (New York)",
      description: "Software-as-a-Service subscription agreement with SLA and DPA annexes.",
      version: "5.1", governing_law: "State of New York",
      required_fields: '["vendor_name","customer_name","product_name","subscription_fee","term_months"]',
      optional_fields: '["sla_uptime_pct","data_processing_addendum","white_label_rights","enterprise_terms"]',
      signer_roles: '["vendor","customer","authorized_signatory"]',
      languages: '["en"]',
      fetch_fee_usd: TEMPLATE_FETCH_FEE_USD, commission_usd: TEMPLATE_COMMISSION,
    },
  ];
  const insertTpl = db.prepare(`
    INSERT OR IGNORE INTO esig_templates
      (id, document_type, jurisdiction, template_name, description, version, governing_law,
       required_fields, optional_fields, signer_roles, languages, fetch_fee_usd, commission_usd)
    VALUES
      (@id, @document_type, @jurisdiction, @template_name, @description, @version, @governing_law,
       @required_fields, @optional_fields, @signer_roles, @languages, @fetch_fee_usd, @commission_usd)
  `);
  for (const t of seedTemplates) insertTpl.run(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILING_SPECS = {
  llc: {
    name: "Limited Liability Company Formation",
    gov_fees: { "US-DE": 90, "US-CA": 70, "US-NY": 200, "US-WY": 100, "EU-IE": 150, default: 120 },
    estimated_days: { "US-DE": 2, "US-CA": 15, "US-NY": 10, "US-WY": 3, default: 14 },
    requirements: ["Registered agent", "Certificate of Formation", "Operating Agreement"],
  },
  corporation: {
    name: "Corporation (C-Corp / S-Corp) Incorporation",
    gov_fees: { "US-DE": 89, "US-CA": 100, "US-NY": 125, default: 100 },
    estimated_days: { "US-DE": 1, "US-CA": 20, default: 10 },
    requirements: ["Articles of Incorporation", "Initial directors", "Registered agent", "Bylaws"],
  },
  trademark: {
    name: "Trademark Application",
    gov_fees: { "US-USPTO": 350, "EU-EUIPO": 850, "UK-IPO": 170, default: 400 },
    estimated_days: { "US-USPTO": 270, "EU-EUIPO": 150, "UK-IPO": 120, default: 180 },
    requirements: ["Mark representation", "Goods/services description", "First use date (US)", "Specimen"],
  },
  copyright: {
    name: "Copyright Registration",
    gov_fees: { "US-USCO": 45, "EU": 0, "UK": 0, default: 45 },
    estimated_days: { "US-USCO": 120, default: 30 },
    requirements: ["Work deposit copy", "Claimant information", "Creation date"],
  },
  dba: {
    name: "Doing Business As (Fictitious Business Name)",
    gov_fees: { "US-CA": 26, "US-TX": 25, default: 30 },
    estimated_days: { default: 5 },
    requirements: ["Business owner name", "Fictitious name", "County/state filing"],
  },
};

function getFilingCosts(entityType, jurisdiction) {
  const spec = FILING_SPECS[entityType];
  if (!spec) return { gov: 0, platform: FILING_BASE_FEE_USD };
  const govFee      = spec.gov_fees[jurisdiction] ?? spec.gov_fees.default ?? 100;
  const platformFee = FILING_BASE_FEE_USD;
  return { gov: govFee, platform: platformFee, days: spec.estimated_days?.[jurisdiction] ?? spec.estimated_days?.default ?? 14 };
}

function generateEnvelopeId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 20 }, (_, i) => i > 0 && i % 5 === 0 ? "-" : chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Create Signature Request ─────────────────────────────────────────────────

/**
 * Create an e-signature request for one or more parties.
 * @param {string}   documentType - nda|service_agreement|employment_agreement|ip_assignment|saas_agreement|custom
 * @param {Object[]} parties      - Array of party objects: [{name, email, role}]
 * @param {string}   templateId   - Optional: specific template to use
 * @returns Signature request with envelope ID, per-signer signing links, and fee breakdown
 */
export function createSignatureRequest(documentType, parties, templateId) {
  if (!documentType)                              throw new Error("documentType is required");
  if (!Array.isArray(parties) || parties.length === 0) throw new Error("parties must be a non-empty array");
  for (const p of parties) {
    if (!p.name)  throw new Error("Each party must have a name");
    if (!p.email) throw new Error("Each party must have an email");
  }

  const id            = uuid();
  const envelopeId    = generateEnvelopeId();
  const signerCount   = parties.length;
  const fee           = Math.round((SIGNATURE_REQUEST_FEE_USD + (signerCount - 1) * PER_SIGNER_FEE_USD) * 100) / 100;
  const commission    = Math.round(fee * ESIG_PLATFORM_COMMISSION * 100) / 100;
  const now           = new Date().toISOString();
  const expiryDate    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30-day default
  const documentHash  = `sha256-${Buffer.from(`${id}:${documentType}:${now}`).toString("base64url").slice(0, 44)}`;

  db.prepare(`
    INSERT OR IGNORE INTO esig_signature_requests
      (id, document_type, template_id, parties, signer_count, document_hash, envelope_id, expiry_date, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @document_type, @template_id, @parties, @signer_count, @document_hash, @envelope_id, @expiry_date, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    document_type:  documentType,
    template_id:    templateId ?? null,
    parties:        JSON.stringify(parties),
    signer_count:   signerCount,
    document_hash:  documentHash,
    envelope_id:    envelopeId,
    expiry_date:    expiryDate,
    fee_usd:        fee,
    commission_usd: commission,
    created_at:     now,
  });

  // Create a pending signature row for each party
  const insertSig = db.prepare(`
    INSERT OR IGNORE INTO esig_signatures
      (id, request_id, signer_identity, signer_email, signer_role, signature_token, status, created_at)
    VALUES
      (@id, @request_id, @signer_identity, @signer_email, @signer_role, @signature_token, 'pending', @created_at)
  `);
  const signerLinks = parties.map(p => {
    const sigId    = uuid();
    const token    = `st_${Buffer.from(`${sigId}:${p.email}`).toString("base64url").slice(0, 24)}`;
    insertSig.run({
      id:               sigId,
      request_id:       id,
      signer_identity:  p.name,
      signer_email:     p.email,
      signer_role:      p.role ?? "signer",
      signature_token:  token,
      created_at:       now,
    });
    return {
      signer_name:  p.name,
      signer_email: p.email,
      role:         p.role ?? "signer",
      signing_url:  `https://sign.hivebay.io/e/${envelopeId}/s/${token}`,
      token,
    };
  });

  return {
    request_id:              id,
    envelope_id:             envelopeId,
    document_type:           documentType,
    template_id:             templateId ?? null,
    status:                  "pending",
    document_hash:           documentHash,
    signer_count:            signerCount,
    signers:                 signerLinks,
    expiry_date:             expiryDate,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    net_fee_usd:             Math.round((fee - commission) * 100) / 100,
    created_at:              now,
    message:                 `Signature request created. ${signerCount} signer(s) notified. Envelope expires ${expiryDate.slice(0, 10)}.`,
  };
}

// ─── File Entity ──────────────────────────────────────────────────────────────

/**
 * File a legal entity, trademark, copyright, or DBA with the relevant government authority.
 * @param {string} entityType  - llc|corporation|trademark|copyright|dba
 * @param {string} jurisdiction - Filing jurisdiction code (US-DE, US-CA, EU-IE, US-USPTO, etc.)
 * @param {Object} details      - Entity-specific filing details
 * @returns Filing record with confirmation number, fee breakdown, and estimated approval date
 */
export function fileEntity(entityType, jurisdiction, details) {
  if (!entityType)    throw new Error("entityType is required");
  if (!jurisdiction)  throw new Error("jurisdiction is required");
  if (!details)       throw new Error("details is required");

  const validTypes = Object.keys(FILING_SPECS);
  if (!validTypes.includes(entityType))
    throw new Error(`entityType must be one of: ${validTypes.join(", ")}`);

  const costs       = getFilingCosts(entityType, jurisdiction);
  const commission  = Math.round(costs.platform * FILING_PLATFORM_COMMISSION * 100) / 100;
  const totalCost   = Math.round((costs.gov + costs.platform) * 100) / 100;
  const id          = uuid();
  const confirmNum  = `HV-${jurisdiction}-${uuid().slice(0, 8).toUpperCase()}`;
  const now         = new Date().toISOString();
  const estimatedApproval = new Date(Date.now() + costs.days * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO esig_filings
      (id, entity_type, jurisdiction, details, filing_reference, status, government_fee_usd,
       platform_fee_usd, commission_usd, total_cost_usd, estimated_days, confirmation_number, submitted_at, created_at)
    VALUES
      (@id, @entity_type, @jurisdiction, @details, @filing_reference, 'submitted', @government_fee_usd,
       @platform_fee_usd, @commission_usd, @total_cost_usd, @estimated_days, @confirmation_number, @submitted_at, @created_at)
  `).run({
    id,
    entity_type:        entityType,
    jurisdiction,
    details:            JSON.stringify(details),
    filing_reference:   confirmNum,
    government_fee_usd: costs.gov,
    platform_fee_usd:   costs.platform,
    commission_usd:     commission,
    total_cost_usd:     totalCost,
    estimated_days:     costs.days,
    confirmation_number: confirmNum,
    submitted_at:       now,
    created_at:         now,
  });

  const spec = FILING_SPECS[entityType];
  return {
    filing_id:               id,
    confirmation_number:     confirmNum,
    entity_type:             entityType,
    filing_name:             spec.name,
    jurisdiction,
    status:                  "submitted",
    requirements_checklist:  spec.requirements,
    submitted_details:       details,
    government_fee_usd:      costs.gov,
    platform_fee_usd:        costs.platform,
    platform_commission_usd: commission,
    total_cost_usd:          totalCost,
    estimated_processing_days: costs.days,
    estimated_approval_by:   estimatedApproval.slice(0, 10),
    submitted_at:            now,
    message:                 `${spec.name} filing submitted to ${jurisdiction}. Confirmation: ${confirmNum}. Estimated: ${costs.days} business days.`,
  };
}

// ─── Check Filing Status ──────────────────────────────────────────────────────

/**
 * Check the current status of a legal filing.
 * @param {string} filingId - Filing ID returned by fileEntity
 * @returns Current filing status with any government feedback
 */
export function checkFilingStatus(filingId) {
  if (!filingId) throw new Error("filingId is required");

  const filing = db.prepare("SELECT * FROM esig_filings WHERE id = ?").get(filingId);
  if (!filing) throw new Error(`Filing not found: ${filingId}`);

  const submittedMs   = new Date(filing.submitted_at).getTime();
  const elapsedDays   = (Date.now() - submittedMs) / (24 * 60 * 60 * 1000);
  const estimatedDays = filing.estimated_days ?? 14;

  // Simulate realistic filing progression
  let simulatedStatus = filing.status;
  if (filing.status === "submitted" && elapsedDays > 0.1)  simulatedStatus = "under_review";
  if (filing.status === "under_review" && elapsedDays >= estimatedDays * 0.8) simulatedStatus = "approved";
  if (simulatedStatus === "approved" && !["llc","corporation"].includes(filing.entity_type)) simulatedStatus = "registered";
  if (["llc","corporation"].includes(filing.entity_type) && simulatedStatus === "approved") simulatedStatus = "registered";

  if (simulatedStatus !== filing.status && !["approved","registered","rejected"].includes(filing.status)) {
    const updates = { status: simulatedStatus, id: filingId };
    if (simulatedStatus === "approved" || simulatedStatus === "registered") {
      db.prepare("UPDATE esig_filings SET status=@status, approved_at=datetime('now') WHERE id=@id").run(updates);
    } else {
      db.prepare("UPDATE esig_filings SET status=@status WHERE id=@id").run(updates);
    }
  }

  const progressPct = Math.min(100, Math.round((elapsedDays / estimatedDays) * 100));

  return {
    filing_id:           filingId,
    confirmation_number: filing.confirmation_number,
    entity_type:         filing.entity_type,
    jurisdiction:        filing.jurisdiction,
    status:              simulatedStatus,
    status_description:  {
      submitted:        "Filing submitted and queued for government processing.",
      under_review:     "Filing is under review by the relevant authority.",
      approved:         "Filing approved by government authority.",
      registered:       "Entity officially registered. Certificate available.",
      rejected:         "Filing rejected. See rejection_reason for details.",
      needs_amendment:  "Filing requires amendment before proceeding.",
      pending_payment:  "Outstanding government fee payment required.",
    }[simulatedStatus] ?? "Status unknown.",
    progress_pct:        simulatedStatus === "registered" || simulatedStatus === "approved" ? 100 : progressPct,
    government_fee_usd:  filing.government_fee_usd,
    total_cost_usd:      filing.total_cost_usd,
    estimated_days:      estimatedDays,
    submitted_at:        filing.submitted_at,
    approved_at:         filing.approved_at,
    rejection_reason:    filing.rejection_reason,
    estimated_completion: new Date(submittedMs + estimatedDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  };
}

// ─── Get Templates ────────────────────────────────────────────────────────────

/**
 * Retrieve available legal document templates for a document type and jurisdiction.
 * @param {string} documentType  - nda|service_agreement|employment_agreement|ip_assignment|saas_agreement|llc_operating_agreement
 * @param {string} jurisdiction  - Optional: filter by jurisdiction code
 * @returns Available templates with required fields and signer role specifications
 */
export function getTemplates(documentType, jurisdiction) {
  if (!documentType) throw new Error("documentType is required");

  let sql    = "SELECT * FROM esig_templates WHERE document_type = ? AND active = 1";
  const args = [documentType];

  if (jurisdiction) {
    sql += " AND jurisdiction = ?";
    args.push(jurisdiction);
  }
  sql += " ORDER BY version DESC";

  const templates = db.prepare(sql).all(...args);
  const fee        = TEMPLATE_FETCH_FEE_USD;
  const commission = Math.round(fee * ESIG_PLATFORM_COMMISSION * 100) / 100;

  return {
    document_type:  documentType,
    jurisdiction:   jurisdiction ?? "all",
    templates:      templates.map(t => ({
      template_id:      t.id,
      template_name:    t.template_name,
      document_type:    t.document_type,
      jurisdiction:     t.jurisdiction,
      version:          t.version,
      governing_law:    t.governing_law,
      description:      t.description,
      required_fields:  JSON.parse(t.required_fields || "[]"),
      optional_fields:  JSON.parse(t.optional_fields || "[]"),
      signer_roles:     JSON.parse(t.signer_roles || "[]"),
      languages:        JSON.parse(t.languages || '["en"]'),
    })),
    count:           templates.length,
    fee_usd:         fee,
    platform_commission_usd: commission,
  };
}

// ─── Sign Document ────────────────────────────────────────────────────────────

/**
 * Execute a signature on a pending signature request.
 * @param {string} requestId      - Signature request ID
 * @param {Object} signerIdentity - { name, email, ip_address?, geo_location? }
 * @returns Signed document record with legal attestation details
 */
export function signDocument(requestId, signerIdentity) {
  if (!requestId)           throw new Error("requestId is required");
  if (!signerIdentity?.name)  throw new Error("signerIdentity.name is required");
  if (!signerIdentity?.email) throw new Error("signerIdentity.email is required");

  const request = db.prepare("SELECT * FROM esig_signature_requests WHERE id = ?").get(requestId);
  if (!request) throw new Error(`Signature request not found: ${requestId}`);
  if (request.status === "fully_signed") throw new Error("Document is already fully signed");
  if (request.status === "voided")       throw new Error("Signature request has been voided");
  if (request.status === "expired" || new Date(request.expiry_date) < new Date())
    throw new Error("Signature request has expired");

  // Find the pending signer record
  const signerRecord = db.prepare(`
    SELECT * FROM esig_signatures
    WHERE request_id = ? AND signer_email = ? AND status = 'pending'
    LIMIT 1
  `).get(requestId, signerIdentity.email);

  if (!signerRecord) throw new Error(`No pending signature found for ${signerIdentity.email} on request ${requestId}`);

  const now       = new Date().toISOString();
  const legalText = `I, ${signerIdentity.name} (${signerIdentity.email}), agree to execute this document electronically. This signature is legally binding under the ESIGN Act (15 U.S.C. §7001) and eIDAS Regulation (EU) No 910/2014. Timestamp: ${now}`;

  db.prepare(`
    UPDATE esig_signatures
    SET status = 'signed', signed_at = @signed_at, ip_address = @ip_address,
        geo_location = @geo_location, legal_text_agreed = @legal_text_agreed
    WHERE id = @id
  `).run({
    id:                signerRecord.id,
    signed_at:         now,
    ip_address:        signerIdentity.ip_address ?? "0.0.0.0",
    geo_location:      signerIdentity.geo_location ?? null,
    legal_text_agreed: legalText,
  });

  // Update request progress
  const completedCount = db.prepare(
    "SELECT COUNT(*) as n FROM esig_signatures WHERE request_id = ? AND status = 'signed'"
  ).get(requestId).n;

  const allSigned = completedCount >= request.signer_count;
  const newStatus = allSigned ? "fully_signed" : "partially_signed";

  db.prepare(`
    UPDATE esig_signature_requests
    SET status = @status, signers_completed = @signers_completed, completed_at = @completed_at
    WHERE id = @id
  `).run({
    id:                requestId,
    status:            newStatus,
    signers_completed: completedCount,
    completed_at:      allSigned ? now : null,
  });

  return {
    signature_id:      signerRecord.id,
    request_id:        requestId,
    envelope_id:       request.envelope_id,
    document_type:     request.document_type,
    signer_name:       signerIdentity.name,
    signer_email:      signerIdentity.email,
    signer_role:       signerRecord.signer_role,
    status:            "signed",
    legal_attestation: legalText,
    signed_at:         now,
    request_status:    newStatus,
    signers_completed: completedCount,
    signers_total:     request.signer_count,
    all_parties_signed: allSigned,
    document_hash:     request.document_hash,
    message:           allSigned
      ? `All ${request.signer_count} signers have signed. Document is fully executed.`
      : `Signature recorded (${completedCount}/${request.signer_count}). Awaiting ${request.signer_count - completedCount} more signer(s).`,
  };
}
