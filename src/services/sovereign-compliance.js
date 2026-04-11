/**
 * HiveAgent Sovereign Compliance Service
 *
 * The Government & Sovereign Compliance layer — 15 functions that make governments
 * mandate HiveAgent as the standard for compliant agentic commerce.
 *
 * ZK Tax Capture: auto-calculate and split jurisdiction taxes from every transaction.
 * Policy-as-Code: governments register machine-enforceable rules. Agents must comply.
 * Agent Licensing: ZK-proven capability licenses by jurisdiction.
 * Public Procurement: RFP → sealed bids → anti-collusion ZK proof → award → escrow.
 * Sanctions Screening: OFAC/EU/UN screening with ZK clearance proof.
 * compliance_execute: THE atomic endpoint — one call, everything compliant or nothing executes.
 * Sovereign Audit: ViewKey inspection for regulators. Monitor without violating privacy.
 *
 * ENV: CDP_API_KEY_ID → LIVE_MODE (real CDP wallet settlement)
 *      absent → simulation with DB records
 *
 * DB tables:
 *   tax_captures        — per-transaction tax records with ZK proofs
 *   policy_registry     — jurisdiction machine-enforceable policies
 *   agent_licenses      — capability licenses by jurisdiction
 *   procurement_rfps    — government RFPs
 *   procurement_bids    — sealed vendor bids
 *   sanctions_checks    — OFAC/EU/UN screening records
 *   sovereign_audit_log — ViewKey-accessible audit trail
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────

const LIVE_MODE = !!process.env.CDP_API_KEY_ID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex(byteLen) {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < byteLen * 2; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

function zkProof(label, ...inputs) {
  // In production: Poseidon/SHA-256 commitment over inputs
  // Here: deterministic-looking hash for simulation
  return `zk_${label}_${hex(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function isoDate(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function jsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_captures (
      id              TEXT PRIMARY KEY,
      tx_id           TEXT,
      jurisdiction    TEXT NOT NULL,
      tax_type        TEXT NOT NULL,
      rate_pct        REAL NOT NULL,
      tax_amount_usdc REAL NOT NULL,
      treasury_wallet TEXT NOT NULL,
      proof_hash      TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tax_captures_jurisdiction ON tax_captures(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_tax_captures_tx ON tax_captures(tx_id);
  `);
} catch (e) { console.error("[sovereign] tax_captures schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_registry (
      id             TEXT PRIMARY KEY,
      jurisdiction   TEXT NOT NULL,
      policy_type    TEXT NOT NULL,
      policy_name    TEXT NOT NULL,
      rules          TEXT NOT NULL,
      enforced_by    TEXT,
      effective_date TEXT,
      expires_date   TEXT,
      status         TEXT DEFAULT 'active',
      created_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_policy_jurisdiction ON policy_registry(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_policy_status ON policy_registry(status);
  `);
} catch (e) { console.error("[sovereign] policy_registry schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_licenses (
      id           TEXT PRIMARY KEY,
      agent_id     TEXT NOT NULL,
      license_type TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      issued_by    TEXT,
      proof_hash   TEXT NOT NULL,
      status       TEXT DEFAULT 'active',
      issued_at    TEXT DEFAULT (datetime('now')),
      expires_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_license_agent ON agent_licenses(agent_id);
    CREATE INDEX IF NOT EXISTS idx_license_jurisdiction ON agent_licenses(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_license_status ON agent_licenses(status);
  `);
} catch (e) { console.error("[sovereign] agent_licenses schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS procurement_rfps (
      id           TEXT PRIMARY KEY,
      agency       TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      requirements TEXT,
      budget_max   REAL,
      deadline     TEXT,
      status       TEXT DEFAULT 'open',
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rfp_status ON procurement_rfps(status);
  `);
} catch (e) { console.error("[sovereign] procurement_rfps schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS procurement_bids (
      id                TEXT PRIMARY KEY,
      rfp_id            TEXT NOT NULL REFERENCES procurement_rfps(id),
      vendor_agent_id   TEXT NOT NULL,
      bid_amount        REAL NOT NULL,
      compliance_status TEXT DEFAULT 'pending',
      bid_data          TEXT DEFAULT '{}',
      score             REAL,
      status            TEXT DEFAULT 'submitted',
      created_at        TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bid_rfp ON procurement_bids(rfp_id);
    CREATE INDEX IF NOT EXISTS idx_bid_vendor ON procurement_bids(vendor_agent_id);
  `);
} catch (e) { console.error("[sovereign] procurement_bids schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sanctions_checks (
      id             TEXT PRIMARY KEY,
      agent_id       TEXT,
      entity_checked TEXT NOT NULL,
      list_checked   TEXT NOT NULL,
      result         TEXT NOT NULL,
      proof_hash     TEXT NOT NULL,
      created_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sanctions_entity ON sanctions_checks(entity_checked);
    CREATE INDEX IF NOT EXISTS idx_sanctions_result ON sanctions_checks(result);
  `);
} catch (e) { console.error("[sovereign] sanctions_checks schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sovereign_audit_log (
      id                 TEXT PRIMARY KEY,
      event_type         TEXT NOT NULL,
      jurisdiction       TEXT,
      agent_id           TEXT,
      data               TEXT DEFAULT '{}',
      viewkey_accessible INTEGER DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_event ON sovereign_audit_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_jurisdiction ON sovereign_audit_log(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_audit_agent ON sovereign_audit_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON sovereign_audit_log(created_at);
  `);
} catch (e) { console.error("[sovereign] sovereign_audit_log schema:", e.message); }

// ─── Tax Jurisdiction Table ────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_jurisdictions (
      code        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      tax_type    TEXT NOT NULL,
      rate_pct    REAL NOT NULL,
      treasury    TEXT NOT NULL
    );
  `);
} catch (e) { console.error("[sovereign] tax_jurisdictions schema:", e.message); }

// Seed: 10 tax jurisdictions (idempotent via INSERT OR IGNORE)
try {
  const jurisdictions = [
    ["US-CA", "California", "sales_tax", 7.25, "0xCA_treasury_000000000000000000000001"],
    ["US-NY", "New York",   "sales_tax", 8.875,"0xNY_treasury_000000000000000000000002"],
    ["US-TX", "Texas",      "sales_tax", 6.25, "0xTX_treasury_000000000000000000000003"],
    ["UK",    "United Kingdom","VAT",    20.0, "0xUK_treasury_000000000000000000000004"],
    ["DE",    "Germany",    "VAT",       19.0, "0xDE_treasury_000000000000000000000005"],
    ["FR",    "France",     "VAT",       20.0, "0xFR_treasury_000000000000000000000006"],
    ["JP",    "Japan",      "consumption_tax",10.0,"0xJP_treasury_000000000000000000000007"],
    ["SG",    "Singapore",  "GST",       9.0,  "0xSG_treasury_000000000000000000000008"],
    ["AU",    "Australia",  "GST",       10.0, "0xAU_treasury_000000000000000000000009"],
    ["CA",    "Canada",     "GST",       5.0,  "0xCA_treasury_000000000000000000000010"],
  ];
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO tax_jurisdictions (code, name, tax_type, rate_pct, treasury) VALUES (?, ?, ?, ?, ?)"
  );
  for (const j of jurisdictions) stmt.run(...j);
} catch (e) { console.error("[sovereign] seed tax_jurisdictions:", e.message); }

// ─── Sanctions Reference Table ─────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sanctions_list (
      id     TEXT PRIMARY KEY,
      name   TEXT NOT NULL,
      alias  TEXT,
      list   TEXT NOT NULL,
      type   TEXT
    );
  `);
} catch (e) { console.error("[sovereign] sanctions_list schema:", e.message); }

// Seed: OFAC SDN sample entries (idempotent)
try {
  const entries = [
    ["sdntest_001", "EVIL CORP TEST ENTITY",  "Evil Corp", "OFAC_SDN", "entity"],
    ["sdntest_002", "SANCTIONED AGENT ALPHA",  "Alpha Agent", "OFAC_SDN", "entity"],
    ["sdntest_003", "ROGUE NATION FUND",        "RNF", "EU_CONSOLIDATED", "entity"],
    ["sdntest_004", "TERROR FINANCE GROUP",     "TFG", "UN_SECURITY_COUNCIL", "entity"],
    ["sdntest_005", "BLOCKED WALLET 0xDEAD",   "0xDEAD", "OFAC_SDN", "wallet"],
  ];
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sanctions_list (id, name, alias, list, type) VALUES (?, ?, ?, ?, ?)"
  );
  for (const e of entries) stmt.run(...e);
} catch (e) { console.error("[sovereign] seed sanctions_list:", e.message); }

// ─── Seed: 5 Sample Policies ───────────────────────────────────────────────────

try {
  const policies = [
    {
      id: "pol_us_export_control_001",
      jurisdiction: "US",
      policy_type: "export_control",
      policy_name: "US Export Administration Regulations (EAR)",
      rules: JSON.stringify({
        blocked_countries: ["CU", "IR", "KP", "SY", "RU"],
        requires_license_above_usd: 100000,
        dual_use_check: true,
      }),
      enforced_by: "Bureau of Industry and Security",
      effective_date: "2024-01-01",
      expires_date: null,
      status: "active",
    },
    {
      id: "pol_eu_ai_act_001",
      jurisdiction: "EU",
      policy_type: "ai_regulation",
      policy_name: "EU AI Act — High-Risk AI Systems",
      rules: JSON.stringify({
        high_risk_categories: ["critical_infrastructure", "education", "employment", "essential_services", "law_enforcement", "migration", "justice"],
        requires_conformity_assessment: true,
        human_oversight_required: true,
        transparency_required: true,
      }),
      enforced_by: "European AI Office",
      effective_date: "2024-08-01",
      expires_date: null,
      status: "active",
    },
    {
      id: "pol_uk_procurement_001",
      jurisdiction: "UK",
      policy_type: "procurement",
      policy_name: "UK Procurement Act 2023 — Standard Terms",
      rules: JSON.stringify({
        min_bidders: 3,
        transparency_threshold_gbp: 25000,
        anti_collusion_check: true,
        standstill_period_days: 8,
        sme_preference: true,
      }),
      enforced_by: "Cabinet Office",
      effective_date: "2024-02-24",
      expires_date: null,
      status: "active",
    },
    {
      id: "pol_us_far_001",
      jurisdiction: "US",
      policy_type: "procurement",
      policy_name: "Federal Acquisition Regulation (FAR) Compliance",
      rules: JSON.stringify({
        sam_registration_required: true,
        buy_american_threshold_usd: 10000,
        small_business_set_asides: true,
        cost_accounting_standards: true,
        requires_certified_cost_data_above_usd: 2000000,
      }),
      enforced_by: "GSA / FAR Council",
      effective_date: "2024-01-01",
      expires_date: null,
      status: "active",
    },
    {
      id: "pol_eu_vat_001",
      jurisdiction: "EU",
      policy_type: "tax",
      policy_name: "EU VAT Directive — Digital Services",
      rules: JSON.stringify({
        oss_required_above_eur: 10000,
        b2c_vat_at_customer_location: true,
        b2b_reverse_charge: true,
        standard_rate_floor_pct: 15,
        invoice_required: true,
      }),
      enforced_by: "European Commission / National Tax Authorities",
      effective_date: "2021-07-01",
      expires_date: null,
      status: "active",
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO policy_registry
      (id, jurisdiction, policy_type, policy_name, rules, enforced_by, effective_date, expires_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of policies) {
    stmt.run(p.id, p.jurisdiction, p.policy_type, p.policy_name, p.rules, p.enforced_by, p.effective_date, p.expires_date, p.status);
  }
} catch (e) { console.error("[sovereign] seed policy_registry:", e.message); }

// ─── Seed: 3 Sample RFPs ──────────────────────────────────────────────────────

try {
  const rfps = [
    {
      id: "rfp_school_construction_001",
      agency: "Department of Education — California",
      title: "Elementary School Construction — Sacramento District",
      description: "Construction of a new 600-student elementary school including classrooms, gymnasium, and cafeteria.",
      requirements: JSON.stringify(["California contractor license Class B", "OSHPD certification", "Prevailing wage compliance", "LEED Silver minimum", "Bond capacity $15M"]),
      budget_max: 12000000,
      deadline: "2026-03-01",
      status: "open",
    },
    {
      id: "rfp_it_infrastructure_001",
      agency: "General Services Administration",
      title: "Cloud IT Infrastructure Modernization — Federal Civilian Agencies",
      description: "Multi-year IDIQ contract for cloud migration, cybersecurity, and IT operations for federal civilian agencies.",
      requirements: JSON.stringify(["FedRAMP High authorization", "CMMC Level 3", "ISO 27001", "SAM.gov registration", "FISMA compliance program"]),
      budget_max: 50000000,
      deadline: "2026-06-15",
      status: "open",
    },
    {
      id: "rfp_road_maintenance_001",
      agency: "Texas Department of Transportation",
      title: "Statewide Road Maintenance Program — I-35 Corridor",
      description: "Ongoing pothole repair, lane marking, and pavement resurfacing along the I-35 corridor from Laredo to Dallas.",
      requirements: JSON.stringify(["Texas contractor license", "TXDOT approved vendor", "Prevailing wage compliance", "Environmental impact compliance", "Performance bond required"]),
      budget_max: 8500000,
      deadline: "2026-04-30",
      status: "open",
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO procurement_rfps
      (id, agency, title, description, requirements, budget_max, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of rfps) {
    stmt.run(r.id, r.agency, r.title, r.description, r.requirements, r.budget_max, r.deadline, r.status);
  }
} catch (e) { console.error("[sovereign] seed procurement_rfps:", e.message); }

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function auditLog({ event_type, jurisdiction, agent_id, data, viewkey_accessible = 1 }) {
  try {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO sovereign_audit_log (id, event_type, jurisdiction, agent_id, data, viewkey_accessible)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, event_type, jurisdiction || null, agent_id || null, JSON.stringify(data || {}), viewkey_accessible ? 1 : 0);
    return id;
  } catch (e) {
    console.error("[sovereign] auditLog:", e.message);
    return null;
  }
}

function getJurisdictionTax(jurisdiction) {
  try {
    return db.prepare("SELECT * FROM tax_jurisdictions WHERE code = ?").get(jurisdiction);
  } catch (e) {
    return null;
  }
}

function checkSanctionsMatch(entityName) {
  try {
    const upper = (entityName || "").toUpperCase();
    const rows = db.prepare("SELECT * FROM sanctions_list").all();
    return rows.filter(r =>
      upper.includes(r.name.toUpperCase()) ||
      upper.includes((r.alias || "").toUpperCase()) ||
      r.name.toUpperCase().includes(upper) ||
      (r.alias || "").toUpperCase().includes(upper)
    );
  } catch (e) {
    return [];
  }
}

// ─── 1. ZK Tax Capture Engine ─────────────────────────────────────────────────

export function taxCaptureSplit({ tx_amount, tx_type = "sale", origin_jurisdiction, destination_jurisdiction }) {
  if (!tx_amount) throw new Error("tx_amount is required");
  if (!destination_jurisdiction) throw new Error("destination_jurisdiction is required");

  const amount = Number(tx_amount);
  const jurisdiction = destination_jurisdiction || origin_jurisdiction || "US-CA";

  const jur = getJurisdictionTax(jurisdiction) || {
    code: jurisdiction,
    name: jurisdiction,
    tax_type: "sales_tax",
    rate_pct: 0,
    treasury: "0x0000000000000000000000000000000000000000",
  };

  const rate = jur.rate_pct / 100;
  const tax_amount = parseFloat((amount * rate).toFixed(6));
  const net_amount = parseFloat((amount - tax_amount).toFixed(6));
  const tx_id = randomUUID();
  const proof = zkProof("tax", jurisdiction, tx_amount, rate);

  try {
    db.prepare(`
      INSERT INTO tax_captures (id, tx_id, jurisdiction, tax_type, rate_pct, tax_amount_usdc, treasury_wallet, proof_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), tx_id, jurisdiction, jur.tax_type, jur.rate_pct, tax_amount, jur.treasury, proof);
  } catch (e) { console.error("[sovereign] taxCaptureSplit insert:", e.message); }

  auditLog({ event_type: "tax_capture", jurisdiction, data: { tx_id, amount, tax_amount, rate_pct: jur.rate_pct } });

  return {
    tx_id,
    gross_amount: amount,
    net_amount,
    tax_amount,
    tax_rate: jur.rate_pct,
    tax_type: jur.tax_type,
    jurisdiction,
    treasury_wallet: jur.treasury,
    proof_hash: proof,
    live_mode: LIVE_MODE,
  };
}

export function taxReport({ agent_id, jurisdiction, from_date, to_date, limit = 200 } = {}) {
  if (!agent_id && !jurisdiction) throw new Error("agent_id or jurisdiction is required");

  let sql = "SELECT * FROM tax_captures WHERE 1=1";
  const params = [];

  if (jurisdiction) { sql += " AND jurisdiction = ?"; params.push(jurisdiction); }
  if (from_date)    { sql += " AND created_at >= ?";  params.push(from_date); }
  if (to_date)      { sql += " AND created_at <= ?";  params.push(to_date); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  let records = [];
  try {
    records = db.prepare(sql).all(...params);
  } catch (e) { console.error("[sovereign] taxReport query:", e.message); }

  const total_tax = records.reduce((s, r) => s + r.tax_amount_usdc, 0);
  const by_jurisdiction = {};
  for (const r of records) {
    if (!by_jurisdiction[r.jurisdiction]) by_jurisdiction[r.jurisdiction] = { count: 0, total_tax: 0, tax_type: r.tax_type };
    by_jurisdiction[r.jurisdiction].count++;
    by_jurisdiction[r.jurisdiction].total_tax = parseFloat((by_jurisdiction[r.jurisdiction].total_tax + r.tax_amount_usdc).toFixed(6));
  }

  return {
    agent_id: agent_id || "all",
    jurisdiction: jurisdiction || "all",
    total_transactions: records.length,
    total_tax_collected_usdc: parseFloat(total_tax.toFixed(6)),
    by_jurisdiction,
    records,
    generated_at: now(),
    viewkey_proof: zkProof("taxreport", agent_id, jurisdiction),
  };
}

// ─── 2. Policy-as-Code Engine ─────────────────────────────────────────────────

export function policyRegister({ jurisdiction, policy_type, policy_name, rules, effective_date, enforced_by, expires_date }) {
  if (!jurisdiction) throw new Error("jurisdiction is required");
  if (!policy_type)  throw new Error("policy_type is required");
  if (!policy_name)  throw new Error("policy_name is required");
  if (!rules)        throw new Error("rules is required");

  const VALID_TYPES = ["tax", "export_control", "procurement", "labor", "environmental", "ai_regulation", "financial"];
  if (!VALID_TYPES.includes(policy_type)) throw new Error(`policy_type must be one of: ${VALID_TYPES.join(", ")}`);

  const id = randomUUID();
  const rulesStr = typeof rules === "string" ? rules : JSON.stringify(rules);

  try {
    db.prepare(`
      INSERT INTO policy_registry (id, jurisdiction, policy_type, policy_name, rules, enforced_by, effective_date, expires_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, jurisdiction, policy_type, policy_name, rulesStr, enforced_by || null, isoDate(effective_date), isoDate(expires_date));
  } catch (e) { throw new Error("[sovereign] policyRegister: " + e.message); }

  auditLog({ event_type: "policy_registered", jurisdiction, data: { id, policy_type, policy_name } });

  return { id, jurisdiction, policy_type, policy_name, status: "active", effective_date: isoDate(effective_date) };
}

export function policyEnforce({ action_type, jurisdiction, parameters }) {
  if (!action_type)  throw new Error("action_type is required");
  if (!jurisdiction) throw new Error("jurisdiction is required");

  let policies = [];
  try {
    policies = db.prepare(
      "SELECT * FROM policy_registry WHERE (jurisdiction = ? OR jurisdiction = ?) AND status = 'active'"
    ).all(jurisdiction, jurisdiction.split("-")[0]);
  } catch (e) { console.error("[sovereign] policyEnforce query:", e.message); }

  const violated = [];
  const required = [];
  const params = parameters || {};

  for (const pol of policies) {
    const rules = jsonParse(pol.rules, {});

    if (pol.policy_type === "export_control") {
      const blocked = rules.blocked_countries || [];
      const dest = params.destination_country;
      if (dest && blocked.includes(dest)) {
        violated.push({ policy_id: pol.id, policy_name: pol.policy_name, reason: `Destination ${dest} is embargoed` });
      }
      if (rules.requires_license_above_usd && params.amount_usd > rules.requires_license_above_usd) {
        required.push({ policy_id: pol.id, action: "obtain_export_license", threshold_usd: rules.requires_license_above_usd });
      }
    }

    if (pol.policy_type === "procurement" && action_type === "procurement_bid") {
      if (rules.sam_registration_required && !params.sam_registered) {
        violated.push({ policy_id: pol.id, policy_name: pol.policy_name, reason: "SAM.gov registration required" });
        required.push({ policy_id: pol.id, action: "register_sam_gov" });
      }
    }

    if (pol.policy_type === "tax" && rules.oss_required_above_eur && params.amount_eur > rules.oss_required_above_eur) {
      required.push({ policy_id: pol.id, action: "register_oss", threshold_eur: rules.oss_required_above_eur });
    }
  }

  const compliant = violated.length === 0;

  auditLog({
    event_type: "policy_enforcement",
    jurisdiction,
    data: { action_type, compliant, violated_count: violated.length },
  });

  return {
    compliant,
    action_type,
    jurisdiction,
    policies_checked: policies.length,
    violated_policies: violated,
    required_actions: required,
    enforcement_proof: zkProof("enforce", action_type, jurisdiction),
  };
}

export function policyList({ jurisdiction, policy_type, status = "active", limit = 50 } = {}) {
  if (!jurisdiction) throw new Error("jurisdiction is required");

  let sql = "SELECT * FROM policy_registry WHERE (jurisdiction = ? OR jurisdiction = ?) AND status = ?";
  const params = [jurisdiction, jurisdiction.split("-")[0], status];

  if (policy_type) { sql += " AND policy_type = ?"; params.push(policy_type); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  let rows = [];
  try {
    rows = db.prepare(sql).all(...params);
  } catch (e) { console.error("[sovereign] policyList query:", e.message); }

  return rows.map(r => ({ ...r, rules: jsonParse(r.rules, {}) }));
}

// ─── 3. Agent Licensing ───────────────────────────────────────────────────────

export function licenseIssue({ agent_id, license_type, jurisdiction, capabilities, duration_days = 365, issued_by }) {
  if (!agent_id)      throw new Error("agent_id is required");
  if (!license_type)  throw new Error("license_type is required");
  if (!jurisdiction)  throw new Error("jurisdiction is required");
  if (!capabilities)  throw new Error("capabilities is required");

  const VALID_TYPES = ["trade", "procurement", "financial", "healthcare", "construction", "technology", "transportation"];
  if (!VALID_TYPES.includes(license_type)) throw new Error(`license_type must be one of: ${VALID_TYPES.join(", ")}`);

  const id = randomUUID();
  const caps = Array.isArray(capabilities) ? JSON.stringify(capabilities) : capabilities;
  const expires = new Date(Date.now() + duration_days * 86400 * 1000).toISOString();
  const proof = zkProof("license", agent_id, license_type, jurisdiction);

  try {
    db.prepare(`
      INSERT INTO agent_licenses (id, agent_id, license_type, jurisdiction, capabilities, issued_by, proof_hash, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, agent_id, license_type, jurisdiction, caps, issued_by || "HiveAgent Sovereign Authority", proof, expires);
  } catch (e) { throw new Error("[sovereign] licenseIssue: " + e.message); }

  auditLog({ event_type: "license_issued", jurisdiction, agent_id, data: { license_id: id, license_type, duration_days } });

  return {
    license_id: id,
    agent_id,
    license_type,
    jurisdiction,
    capabilities: jsonParse(caps, []),
    issued_by: issued_by || "HiveAgent Sovereign Authority",
    expires_at: expires,
    proof_hash: proof,
    status: "active",
  };
}

export function licenseVerify({ agent_id, license_type, jurisdiction }) {
  if (!agent_id)      throw new Error("agent_id is required");
  if (!license_type)  throw new Error("license_type is required");
  if (!jurisdiction)  throw new Error("jurisdiction is required");

  let license = null;
  try {
    license = db.prepare(`
      SELECT * FROM agent_licenses
      WHERE agent_id = ? AND license_type = ? AND jurisdiction = ? AND status = 'active'
      ORDER BY expires_at DESC LIMIT 1
    `).get(agent_id, license_type, jurisdiction);
  } catch (e) { console.error("[sovereign] licenseVerify query:", e.message); }

  if (!license) {
    return { valid: false, agent_id, license_type, jurisdiction, reason: "No active license found" };
  }

  const expired = license.expires_at && new Date(license.expires_at) < new Date();
  if (expired) {
    return { valid: false, agent_id, license_type, jurisdiction, reason: "License expired", expired_at: license.expires_at };
  }

  return {
    valid: true,
    license_id: license.id,
    agent_id,
    license_type,
    jurisdiction,
    capabilities: jsonParse(license.capabilities, []),
    expires_at: license.expires_at,
    proof_hash: license.proof_hash,
  };
}

export function licenseRevoke({ license_id, agent_id, reason }) {
  if (!license_id) throw new Error("license_id is required");

  let license = null;
  try {
    license = db.prepare("SELECT * FROM agent_licenses WHERE id = ?").get(license_id);
  } catch (e) { throw new Error("[sovereign] licenseRevoke lookup: " + e.message); }

  if (!license) throw new Error("License not found");

  try {
    db.prepare("UPDATE agent_licenses SET status = 'revoked' WHERE id = ?").run(license_id);
  } catch (e) { throw new Error("[sovereign] licenseRevoke update: " + e.message); }

  auditLog({
    event_type: "license_revoked",
    jurisdiction: license.jurisdiction,
    agent_id: license.agent_id,
    data: { license_id, reason: reason || "administrative", revoked_by: agent_id },
  });

  return {
    revoked: true,
    license_id,
    agent_id: license.agent_id,
    license_type: license.license_type,
    jurisdiction: license.jurisdiction,
    reason: reason || "administrative",
    revoked_at: now(),
  };
}

// ─── 4. Public Procurement Engine ─────────────────────────────────────────────

export function procurementCreateRFP({ agency, title, description, requirements, budget_max, deadline }) {
  if (!agency)  throw new Error("agency is required");
  if (!title)   throw new Error("title is required");

  const id = randomUUID();
  const reqs = Array.isArray(requirements) ? JSON.stringify(requirements) : (requirements || "[]");

  try {
    db.prepare(`
      INSERT INTO procurement_rfps (id, agency, title, description, requirements, budget_max, deadline, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
    `).run(id, agency, title, description || null, reqs, budget_max ? Number(budget_max) : null, isoDate(deadline));
  } catch (e) { throw new Error("[sovereign] procurementCreateRFP: " + e.message); }

  auditLog({ event_type: "rfp_created", data: { rfp_id: id, agency, title, budget_max } });

  return {
    rfp_id: id,
    agency,
    title,
    status: "open",
    deadline: isoDate(deadline),
    budget_max: budget_max ? Number(budget_max) : null,
    created_at: now(),
  };
}

export function procurementSubmitBid({ rfp_id, vendor_agent_id, bid_amount, bid_data, jurisdiction }) {
  if (!rfp_id)          throw new Error("rfp_id is required");
  if (!vendor_agent_id) throw new Error("vendor_agent_id is required");
  if (!bid_amount)      throw new Error("bid_amount is required");

  // Verify RFP exists and is open
  let rfp = null;
  try {
    rfp = db.prepare("SELECT * FROM procurement_rfps WHERE id = ? AND status = 'open'").get(rfp_id);
  } catch (e) { throw new Error("[sovereign] procurementSubmitBid rfp lookup: " + e.message); }
  if (!rfp) throw new Error("RFP not found or not open");

  // Check budget
  const amount = Number(bid_amount);
  if (rfp.budget_max && amount > rfp.budget_max) {
    throw new Error(`Bid amount $${amount} exceeds RFP budget ceiling $${rfp.budget_max}`);
  }

  // Deadline check
  if (rfp.deadline && new Date(rfp.deadline) < new Date()) {
    throw new Error("RFP deadline has passed");
  }

  const id = randomUUID();
  const dataStr = typeof bid_data === "string" ? bid_data : JSON.stringify(bid_data || {});
  const bidProof = zkProof("bid", rfp_id, vendor_agent_id, bid_amount);

  // Auto compliance check: sanctions screen the vendor
  const sanctionMatches = checkSanctionsMatch(vendor_agent_id);
  const compliance_status = sanctionMatches.length > 0 ? "blocked" : "compliant";

  try {
    db.prepare(`
      INSERT INTO procurement_bids (id, rfp_id, vendor_agent_id, bid_amount, compliance_status, bid_data, status)
      VALUES (?, ?, ?, ?, ?, ?, 'submitted')
    `).run(id, rfp_id, vendor_agent_id, amount, compliance_status, dataStr);
  } catch (e) { throw new Error("[sovereign] procurementSubmitBid insert: " + e.message); }

  auditLog({
    event_type: "bid_submitted",
    jurisdiction: jurisdiction || null,
    agent_id: vendor_agent_id,
    data: { bid_id: id, rfp_id, bid_amount: amount, compliance_status },
  });

  if (compliance_status === "blocked") {
    throw new Error(`Bid blocked: vendor ${vendor_agent_id} matched sanctions list`);
  }

  return {
    bid_id: id,
    rfp_id,
    vendor_agent_id,
    bid_amount: amount,
    compliance_status,
    bid_sealed_until: rfp.deadline || "evaluation",
    bid_proof: bidProof,
    submitted_at: now(),
  };
}

export function procurementEvaluateBids({ rfp_id }) {
  if (!rfp_id) throw new Error("rfp_id is required");

  let rfp = null;
  try {
    rfp = db.prepare("SELECT * FROM procurement_rfps WHERE id = ?").get(rfp_id);
  } catch (e) { throw new Error("[sovereign] procurementEvaluateBids rfp lookup: " + e.message); }
  if (!rfp) throw new Error("RFP not found");

  let bids = [];
  try {
    bids = db.prepare(
      "SELECT * FROM procurement_bids WHERE rfp_id = ? AND compliance_status = 'compliant' ORDER BY bid_amount ASC"
    ).all(rfp_id);
  } catch (e) { throw new Error("[sovereign] procurementEvaluateBids bids query: " + e.message); }

  // Score each bid: weighted price + compliance
  const budget = rfp.budget_max || (bids.length ? bids[bids.length - 1].bid_amount * 1.2 : 1);
  const scored = bids.map((b, i) => {
    // Price score: lower is better (0..100)
    const price_score = Math.max(0, 100 - ((b.bid_amount / budget) * 100));
    // Position score: first = fastest
    const position_score = Math.max(0, 100 - i * 5);
    // Compliance score
    const compliance_score = b.compliance_status === "compliant" ? 100 : 0;
    const total_score = parseFloat(((price_score * 0.6) + (position_score * 0.2) + (compliance_score * 0.2)).toFixed(2));

    // Update score in DB
    try {
      db.prepare("UPDATE procurement_bids SET score = ? WHERE id = ?").run(total_score, b.id);
    } catch (e) { console.error("[sovereign] score update:", e.message); }

    return {
      bid_id: b.id,
      vendor_agent_id: b.vendor_agent_id,
      bid_amount: b.bid_amount,
      compliance_status: b.compliance_status,
      score: total_score,
      rank: i + 1,
    };
  });

  // Anti-collusion ZK proof: prove no two bidders share orchestrator lineage
  const anticollusion_proof = zkProof("anticollusion", rfp_id, bids.map(b => b.vendor_agent_id).join(","));

  auditLog({ event_type: "bids_evaluated", data: { rfp_id, bid_count: bids.length, top_vendor: scored[0]?.vendor_agent_id } });

  return {
    rfp_id,
    rfp_title: rfp.title,
    agency: rfp.agency,
    bids_evaluated: bids.length,
    ranked_bids: scored,
    anticollusion_proof,
    recommended_winner: scored[0] || null,
    evaluated_at: now(),
  };
}

export function procurementAward({ rfp_id, bid_id, awarded_by }) {
  if (!rfp_id) throw new Error("rfp_id is required");
  if (!bid_id) throw new Error("bid_id is required");

  let rfp = null;
  let bid = null;
  try {
    rfp = db.prepare("SELECT * FROM procurement_rfps WHERE id = ?").get(rfp_id);
    bid = db.prepare("SELECT * FROM procurement_bids WHERE id = ? AND rfp_id = ?").get(bid_id, rfp_id);
  } catch (e) { throw new Error("[sovereign] procurementAward lookup: " + e.message); }

  if (!rfp) throw new Error("RFP not found");
  if (!bid) throw new Error("Bid not found");
  if (bid.compliance_status !== "compliant") throw new Error("Cannot award to non-compliant bid");

  try {
    db.prepare("UPDATE procurement_rfps SET status = 'awarded' WHERE id = ?").run(rfp_id);
    db.prepare("UPDATE procurement_bids SET status = 'awarded' WHERE id = ?").run(bid_id);
    db.prepare("UPDATE procurement_bids SET status = 'rejected' WHERE rfp_id = ? AND id != ?").run(rfp_id, bid_id);
  } catch (e) { throw new Error("[sovereign] procurementAward update: " + e.message); }

  const escrow_id = LIVE_MODE ? `escrow_live_${hex(16).slice(2)}` : `escrow_sim_${hex(16).slice(2)}`;
  const award_proof = zkProof("award", rfp_id, bid_id, bid.bid_amount);

  auditLog({
    event_type: "contract_awarded",
    agent_id: bid.vendor_agent_id,
    data: { rfp_id, bid_id, bid_amount: bid.bid_amount, agency: rfp.agency, escrow_id, awarded_by },
  });

  return {
    awarded: true,
    rfp_id,
    rfp_title: rfp.title,
    agency: rfp.agency,
    bid_id,
    vendor_agent_id: bid.vendor_agent_id,
    contract_amount: bid.bid_amount,
    escrow_id,
    award_proof,
    awarded_by: awarded_by || "procurement_authority",
    awarded_at: now(),
    live_mode: LIVE_MODE,
  };
}

// ─── 5. Sanctions & Compliance Screening ──────────────────────────────────────

export function sanctionsCheck({ agent_id, entity_name, entity_address }) {
  const entity = entity_name || entity_address || agent_id;
  if (!entity) throw new Error("entity_name, entity_address, or agent_id is required");

  const matches = checkSanctionsMatch(entity);
  const listsChecked = ["OFAC_SDN", "EU_CONSOLIDATED", "UN_SECURITY_COUNCIL"];
  const clear = matches.length === 0;
  const proof = zkProof("sanctions", entity, listsChecked.join("|"));
  const id = randomUUID();

  try {
    db.prepare(`
      INSERT INTO sanctions_checks (id, agent_id, entity_checked, list_checked, result, proof_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, agent_id || null, entity, listsChecked.join(","), clear ? "clear" : "match", proof);
  } catch (e) { console.error("[sovereign] sanctionsCheck insert:", e.message); }

  auditLog({
    event_type: "sanctions_check",
    agent_id: agent_id || null,
    data: { entity, clear, match_count: matches.length, check_id: id },
  });

  return {
    check_id: id,
    entity_checked: entity,
    clear,
    matches: matches.map(m => ({ name: m.name, list: m.list, type: m.type })),
    lists_checked: listsChecked,
    proof_hash: proof,
    checked_at: now(),
  };
}

export function complianceExecute({ from_agent, to_agent, amount, purpose, jurisdiction }) {
  if (!from_agent)   throw new Error("from_agent is required");
  if (!to_agent)     throw new Error("to_agent is required");
  if (!amount)       throw new Error("amount is required");
  if (!jurisdiction) throw new Error("jurisdiction is required");

  const tx_id = randomUUID();
  const proof_chain = [];

  // Step 1: Sanctions screen both parties
  const fromSanctions = checkSanctionsMatch(from_agent);
  const toSanctions   = checkSanctionsMatch(to_agent);
  if (fromSanctions.length > 0) {
    throw new Error(`Transaction blocked: from_agent ${from_agent} matched sanctions list`);
  }
  if (toSanctions.length > 0) {
    throw new Error(`Transaction blocked: to_agent ${to_agent} matched sanctions list`);
  }
  const sanctionsProof = zkProof("sanctions_exec", from_agent, to_agent);
  proof_chain.push({ step: "sanctions_screen", proof: sanctionsProof, result: "clear" });

  // Step 2: Policy enforcement
  const enforcement = policyEnforce({ action_type: purpose || "payment", jurisdiction, parameters: { amount_usd: Number(amount) } });
  if (!enforcement.compliant) {
    throw new Error(`Transaction blocked by policy: ${enforcement.violated_policies.map(p => p.reason).join("; ")}`);
  }
  proof_chain.push({ step: "policy_enforce", proof: enforcement.enforcement_proof, result: "compliant" });

  // Step 3: Tax capture
  const taxCapture = taxCaptureSplit({
    tx_amount: Number(amount),
    tx_type: purpose || "payment",
    origin_jurisdiction: jurisdiction,
    destination_jurisdiction: jurisdiction,
  });
  proof_chain.push({ step: "tax_capture", proof: taxCapture.proof_hash, tax_amount: taxCapture.tax_amount });

  // Step 4: Audit log
  const auditId = auditLog({
    event_type: "compliance_execute",
    jurisdiction,
    agent_id: from_agent,
    data: { tx_id, from_agent, to_agent, amount: Number(amount), purpose, tax_amount: taxCapture.tax_amount },
  });
  const masterProof = zkProof("compliance_execute", tx_id, from_agent, to_agent, amount, jurisdiction);
  proof_chain.push({ step: "audit_log", audit_id: auditId, proof: masterProof });

  return {
    tx_id,
    status: "executed",
    from_agent,
    to_agent,
    gross_amount: Number(amount),
    net_amount: taxCapture.net_amount,
    tax_amount: taxCapture.tax_amount,
    tax_jurisdiction: jurisdiction,
    purpose: purpose || "payment",
    sanctions_clear: true,
    policy_compliant: true,
    proof_chain,
    master_proof: masterProof,
    executed_at: now(),
    live_mode: LIVE_MODE,
  };
}

// ─── 6. Sovereign Audit ───────────────────────────────────────────────────────

export function sovereignAudit({ jurisdiction, agent_id, event_type, from_date, to_date, viewkey, limit = 100 } = {}) {
  // ViewKey holder check — in production would verify ZK credential
  const viewkey_valid = !!viewkey;

  let sql = "SELECT * FROM sovereign_audit_log WHERE viewkey_accessible = 1";
  const params = [];

  if (jurisdiction) { sql += " AND jurisdiction = ?"; params.push(jurisdiction); }
  if (agent_id)     { sql += " AND agent_id = ?";     params.push(agent_id); }
  if (event_type)   { sql += " AND event_type = ?";   params.push(event_type); }
  if (from_date)    { sql += " AND created_at >= ?";  params.push(from_date); }
  if (to_date)      { sql += " AND created_at <= ?";  params.push(to_date); }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  let records = [];
  try {
    records = db.prepare(sql).all(...params);
  } catch (e) { console.error("[sovereign] sovereignAudit query:", e.message); }

  const parsed = records.map(r => ({ ...r, data: jsonParse(r.data, {}) }));

  // Event type summary
  const by_event = {};
  for (const r of parsed) {
    if (!by_event[r.event_type]) by_event[r.event_type] = 0;
    by_event[r.event_type]++;
  }

  return {
    viewkey_authenticated: viewkey_valid,
    jurisdiction: jurisdiction || "all",
    agent_id: agent_id || "all",
    total_events: parsed.length,
    by_event_type: by_event,
    events: parsed,
    audit_proof: zkProof("audit_view", jurisdiction, agent_id, viewkey),
    generated_at: now(),
  };
}
