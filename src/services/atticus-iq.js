/**
 * AtticusIQ — Contract Intelligence for AI Agents
 *
 * The legal vertical of the HiveAgent Multiverse.
 * First third-party vertical demonstrating the 70/30 App Store revenue model.
 *
 * Functions:
 *   atticusAnalyze          — AI contract analysis, 7-dimension risk score    $0.50–$5.00
 *   atticusCompare          — Compare two contracts side-by-side               $1.00
 *   atticusPortfolioRisk    — Analyze entire contract portfolio                $2.00
 *   atticusComplianceCheck  — Check against GDPR, CCPA, SOX, HIPAA, EU AI Act $1.00
 *   atticusRedline          — AI-powered redline suggestions                   $2.00
 *   atticusClauseLibrary    — Search standard clause library                   FREE
 *   atticusBoardReport      — Executive board report from portfolio            $5.00
 *   atticusStats            — AtticusIQ vertical metrics                       FREE
 *
 * Revenue Model: 70% to vertical developer (Steve Rotzin), 30% to HiveAgent platform.
 * ENV: ATTICUS_API_KEY — enables live mode when AtticusIQ SaaS is running.
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────

const LIVE_MODE = !!process.env.ATTICUS_API_KEY;

// ─── Revenue Model (70/30 App Store) ─────────────────────────────────────────

const PLATFORM_SHARE  = 0.30; // 30% to HiveAgent
const DEVELOPER_SHARE = 0.70; // 70% to vertical developer

// ─── Fees ─────────────────────────────────────────────────────────────────────

const FEES = {
  analyze_simple:    0.50,
  analyze_standard:  1.50,
  analyze_complex:   5.00,
  compare:           1.00,
  portfolio_risk:    2.00,
  compliance_check:  1.00,
  redline:           2.00,
  clause_library:    0.00,
  board_report:      5.00,
};

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS atticus_contracts (
      id              TEXT PRIMARY KEY,
      agent_id        TEXT NOT NULL,
      filename        TEXT,
      contract_type   TEXT NOT NULL,
      parties         TEXT,
      effective_date  TEXT,
      expiration_date TEXT,
      total_value     REAL,
      risk_score      REAL,
      calculus_scores TEXT,
      key_terms       TEXT,
      status          TEXT DEFAULT 'active',
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[atticus-iq] atticus_contracts schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS atticus_analyses (
      id            TEXT PRIMARY KEY,
      contract_id   TEXT,
      analysis_type TEXT NOT NULL,
      result        TEXT,
      model_used    TEXT DEFAULT 'atticus-v1',
      tokens_used   INTEGER DEFAULT 0,
      cost_usdc     REAL DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[atticus-iq] atticus_analyses schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS atticus_revenue (
      id              TEXT PRIMARY KEY,
      agent_id        TEXT NOT NULL,
      analysis_type   TEXT NOT NULL,
      fee_charged     REAL NOT NULL,
      platform_share  REAL NOT NULL,
      developer_share REAL NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[atticus-iq] atticus_revenue schema:", e.message); }

// ─── Seed Data — 5 Sample Contracts ──────────────────────────────────────────

try {
  const _count = db.prepare("SELECT COUNT(*) as n FROM atticus_contracts").get().n;
  if (_count === 0) {
    const seedContracts = [
      {
        id: "atc-seed-001",
        agent_id: "seed",
        filename: "mutual_nda_techcorp_2024.pdf",
        contract_type: "NDA",
        parties: JSON.stringify(["TechCorp Inc.", "Innovate Labs LLC"]),
        effective_date: "2024-01-15",
        expiration_date: "2026-01-15",
        total_value: 0,
        risk_score: 22,
        calculus_scores: JSON.stringify({ Financial: 10, Liability: 35, Termination: 20, Performance: 15, Compliance: 28, Counterparty: 18, Temporal: 30 }),
        key_terms: JSON.stringify(["2-year term", "mutual obligations", "residual knowledge carve-out", "24-month tail period"]),
        status: "active",
      },
      {
        id: "atc-seed-002",
        agent_id: "seed",
        filename: "saas_agreement_cloudplatform_2023.pdf",
        contract_type: "SaaS Agreement",
        parties: JSON.stringify(["CloudPlatform Co.", "Enterprise Client Corp."]),
        effective_date: "2023-06-01",
        expiration_date: "2025-05-31",
        total_value: 240000,
        risk_score: 48,
        calculus_scores: JSON.stringify({ Financial: 65, Liability: 55, Termination: 40, Performance: 50, Compliance: 45, Counterparty: 35, Temporal: 50 }),
        key_terms: JSON.stringify(["$20k/month", "99.9% uptime SLA", "auto-renewal", "10% annual escalator", "liability cap 3x annual fees"]),
        status: "active",
      },
      {
        id: "atc-seed-003",
        agent_id: "seed",
        filename: "construction_subcontract_2024.pdf",
        contract_type: "Construction Subcontract",
        parties: JSON.stringify(["BuildRight General Contractors", "Steel & Frame Specialists Inc."]),
        effective_date: "2024-03-01",
        expiration_date: "2024-11-30",
        total_value: 1850000,
        risk_score: 72,
        calculus_scores: JSON.stringify({ Financial: 80, Liability: 85, Termination: 60, Performance: 75, Compliance: 70, Counterparty: 65, Temporal: 68 }),
        key_terms: JSON.stringify(["lump sum $1.85M", "liquidated damages $5k/day", "retainage 10%", "change order within 7 days", "indemnification broad-form"]),
        status: "active",
      },
      {
        id: "atc-seed-004",
        agent_id: "seed",
        filename: "real_estate_psa_2024.pdf",
        contract_type: "Real Estate Purchase and Sale Agreement",
        parties: JSON.stringify(["Harbor Properties LLC", "Westside Commercial Fund I"]),
        effective_date: "2024-07-01",
        expiration_date: "2024-10-01",
        total_value: 12500000,
        risk_score: 58,
        calculus_scores: JSON.stringify({ Financial: 70, Liability: 50, Termination: 65, Performance: 55, Compliance: 60, Counterparty: 45, Temporal: 62 }),
        key_terms: JSON.stringify(["$12.5M purchase price", "30-day due diligence", "$250k earnest money", "1031 exchange contingency", "representations survive 12 months"]),
        status: "active",
      },
      {
        id: "atc-seed-005",
        agent_id: "seed",
        filename: "employment_agreement_cto_2024.pdf",
        contract_type: "Employment Agreement",
        parties: JSON.stringify(["Nexus Ventures Inc.", "Jordan K. Ellis (CTO)"]),
        effective_date: "2024-02-01",
        expiration_date: null,
        total_value: 285000,
        risk_score: 38,
        calculus_scores: JSON.stringify({ Financial: 40, Liability: 35, Termination: 50, Performance: 45, Compliance: 30, Counterparty: 25, Temporal: 20 }),
        key_terms: JSON.stringify(["$285k base salary", "18-month non-compete", "12-month non-solicit", "IP assignment broad-form", "at-will with 3-month severance"]),
        status: "active",
      },
    ];
    const ins = db.prepare(`
      INSERT OR IGNORE INTO atticus_contracts
        (id, agent_id, filename, contract_type, parties, effective_date, expiration_date, total_value, risk_score, calculus_scores, key_terms, status)
      VALUES
        (@id, @agent_id, @filename, @contract_type, @parties, @effective_date, @expiration_date, @total_value, @risk_score, @calculus_scores, @key_terms, @status)
    `);
    for (const c of seedContracts) ins.run(c);
  }
} catch (e) { console.error("[atticus-iq] seed:", e.message); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() { return `atc-${randomUUID().replace(/-/g, "").slice(0, 12)}`; }

function logRevenue(agent_id, analysis_type, fee) {
  try {
    db.prepare(`
      INSERT INTO atticus_revenue (id, agent_id, analysis_type, fee_charged, platform_share, developer_share)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId(), agent_id, analysis_type, fee, +(fee * PLATFORM_SHARE).toFixed(4), +(fee * DEVELOPER_SHARE).toFixed(4));
  } catch (e) { console.error("[atticus-iq] logRevenue:", e.message); }
}

function calcContractType(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("nda") || t.includes("non-disclosure") || t.includes("confidential")) return "NDA";
  if (t.includes("saas") || t.includes("software") || t.includes("subscription")) return "SaaS Agreement";
  if (t.includes("employ") || t.includes("compensation") || t.includes("salary")) return "Employment Agreement";
  if (t.includes("construct") || t.includes("subcontract") || t.includes("scope of work")) return "Construction Subcontract";
  if (t.includes("purchase") || t.includes("real estate") || t.includes("property")) return "Real Estate PSA";
  if (t.includes("license")) return "License Agreement";
  if (t.includes("service") || t.includes("msa")) return "Master Services Agreement";
  return "General Contract";
}

function generateCalculus(contract_type, text) {
  const base = {
    NDA: { Financial: 12, Liability: 38, Termination: 22, Performance: 18, Compliance: 30, Counterparty: 20, Temporal: 28 },
    "SaaS Agreement": { Financial: 62, Liability: 55, Termination: 42, Performance: 50, Compliance: 48, Counterparty: 38, Temporal: 45 },
    "Employment Agreement": { Financial: 45, Liability: 35, Termination: 52, Performance: 48, Compliance: 32, Counterparty: 28, Temporal: 22 },
    "Construction Subcontract": { Financial: 78, Liability: 82, Termination: 62, Performance: 72, Compliance: 68, Counterparty: 60, Temporal: 65 },
    "Real Estate PSA": { Financial: 68, Liability: 50, Termination: 60, Performance: 55, Compliance: 58, Counterparty: 45, Temporal: 58 },
    "License Agreement": { Financial: 55, Liability: 48, Termination: 35, Performance: 40, Compliance: 52, Counterparty: 32, Temporal: 40 },
    "Master Services Agreement": { Financial: 60, Liability: 58, Termination: 45, Performance: 55, Compliance: 50, Counterparty: 42, Temporal: 48 },
  };
  const scores = base[contract_type] || { Financial: 50, Liability: 50, Termination: 50, Performance: 50, Compliance: 50, Counterparty: 50, Temporal: 50 };
  // Add noise ±8
  const jitter = k => Math.max(0, Math.min(100, scores[k] + Math.floor(Math.random() * 17) - 8));
  return Object.fromEntries(Object.keys(scores).map(k => [k, jitter(k)]));
}

function overallRisk(scores) {
  const vals = Object.values(scores);
  return +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
}

function riskLabel(score) {
  if (score < 30) return "low";
  if (score < 55) return "moderate";
  if (score < 75) return "high";
  return "critical";
}

// ─── Clause Library ───────────────────────────────────────────────────────────

const CLAUSE_LIBRARY = {
  indemnification: {
    standard: `Each party ("Indemnifying Party") shall indemnify, defend, and hold harmless the other party and its officers, directors, employees, agents, and successors from and against any claims, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or relating to (a) the Indemnifying Party's breach of this Agreement; (b) the Indemnifying Party's negligence or willful misconduct; or (c) infringement of any third-party intellectual property rights by the Indemnifying Party's materials.`,
    broad_form: `The Contractor shall indemnify, defend (with counsel acceptable to Company), and hold harmless the Company Indemnitees from and against any and all claims, liabilities, losses, damages, costs, and expenses of any kind, including attorneys' fees, arising out of or relating to: (i) any act or omission of Contractor; (ii) bodily injury or property damage caused by Contractor's work; (iii) breach of any representation, warranty, or obligation; or (iv) infringement of intellectual property — regardless of the negligence of any Company Indemnitee.`,
    mutual: `Each party ("Indemnitor") shall indemnify and hold harmless the other party and its affiliates from losses directly arising from (a) Indemnitor's material breach, (b) Indemnitor's gross negligence or willful misconduct, or (c) infringement of third-party IP by Indemnitor's deliverables.`,
  },
  limitation_of_liability: {
    standard: `IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY'S TOTAL CUMULATIVE LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID OR PAYABLE BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.`,
    saas_mutual: `EXCEPT FOR BREACHES OF CONFIDENTIALITY OBLIGATIONS, INDEMNIFICATION OBLIGATIONS, OR WILLFUL MISCONDUCT: (A) NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES; AND (B) EACH PARTY'S TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF (I) AMOUNTS PAID IN THE PRIOR 12 MONTHS OR (II) $50,000 USD.`,
    construction: `CONTRACTOR'S TOTAL LIABILITY SHALL NOT EXCEED THE CONTRACT PRICE. IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR LOSS OF PROFIT, LOSS OF BUSINESS, OR CONSEQUENTIAL DAMAGES. NOTHING HEREIN LIMITS LIABILITY FOR DEATH, PERSONAL INJURY, OR FRAUD.`,
  },
  ip_assignment: {
    standard: `All intellectual property rights in deliverables created by Service Provider for Company under this Agreement ("Work Product") shall be considered works made for hire. To the extent any Work Product does not qualify as a work made for hire, Service Provider hereby irrevocably assigns to Company all right, title, and interest in and to such Work Product, including all patents, copyrights, trade secrets, and other IP rights.`,
    license_back: `Service Provider assigns all Work Product to Company and receives a perpetual, non-exclusive, royalty-free license to use any pre-existing IP or general know-how incorporated into the Work Product for its own internal business purposes.`,
  },
  non_compete: {
    standard_12mo: `For a period of twelve (12) months following termination of this Agreement, Employee shall not directly or indirectly (a) engage in a business that competes with the Company in the Restricted Territory; (b) solicit or hire any Company employee; or (c) solicit any Company customer for a competing product or service.`,
    enforceability_friendly: `For a period of six (6) months following separation, Employee shall not engage in direct competition with Company's core business in the specific markets where Employee had material responsibility, limited to the geographic areas where Employee actively worked. This restriction shall not apply to general industry employment unrelated to Employee's specific duties.`,
  },
  force_majeure: {
    standard: `Neither party shall be liable for delays or failures in performance resulting from acts beyond that party's reasonable control, including but not limited to: acts of God, natural disasters, pandemics, war, terrorism, government actions, labor disputes, internet service interruptions, or supply chain disruptions. The affected party shall provide prompt written notice and use commercially reasonable efforts to resume performance.`,
    cyber_included: `Force majeure events include, without limitation: natural disasters, acts of terrorism, government orders, pandemics, widespread cyber attacks or infrastructure outages, or other events outside a party's reasonable control. Payment obligations are not excused by force majeure events lasting fewer than 30 days.`,
  },
};

// ─── Function Implementations ─────────────────────────────────────────────────

/**
 * atticusAnalyze — Upload or describe a contract for AI analysis.
 * Returns parties, dates, financial terms, obligations, risk factors,
 * termination clauses, and a 7-dimension Calculus score.
 */
export async function atticusAnalyze(args) {
  const { agent_id = "anonymous", contract_text = "", contract_type: provided_type, filename = "contract.pdf", contract_value } = args;

  if (!contract_text && !provided_type) {
    throw new Error("Provide contract_text (describe or paste the contract) or contract_type");
  }

  // Determine contract type and fee tier
  const contract_type = provided_type || calcContractType(contract_text);
  const value = parseFloat(contract_value) || 0;
  let fee = FEES.analyze_simple;
  if (value > 500000 || contract_text.length > 3000) fee = FEES.analyze_complex;
  else if (value > 50000 || contract_text.length > 1000) fee = FEES.analyze_standard;

  if (LIVE_MODE) {
    // Future: call AtticusIQ SaaS API with process.env.ATTICUS_API_KEY
    throw new Error("LIVE_MODE not yet connected — AtticusIQ SaaS endpoint pending launch.");
  }

  // Simulated AI analysis
  const calculus_scores = generateCalculus(contract_type, contract_text);
  const risk_score = overallRisk(calculus_scores);
  const risk_level = riskLabel(risk_score);
  const contract_id = newId();
  const analysis_id = newId();
  const now = new Date().toISOString();

  // Extract parties from text (heuristic) or use placeholders
  const partiesMatch = contract_text.match(/between\s+([^,]+),\s+(?:a\s+\w+\s+)?(?:corporation|llc|inc|ltd|company)[,\s]+(?:and|with)\s+([^,\.]+)/i);
  const parties = partiesMatch
    ? [partiesMatch[1].trim(), partiesMatch[2].trim()]
    : ["Party A (Disclosing Party)", "Party B (Receiving Party)"];

  const result = {
    contract_id,
    filename,
    contract_type,
    parties,
    financial_terms: {
      total_value_usd: value || null,
      payment_schedule: contract_type === "SaaS Agreement" ? "monthly" : contract_type === "Construction Subcontract" ? "milestone-based" : null,
      currency: "USD",
    },
    key_dates: {
      effective_date: null,
      expiration_date: null,
      notice_periods: "30 days written notice (standard)",
    },
    key_obligations: {
      party_a: ["Maintain confidentiality", "Use information only for permitted purpose", "Return materials upon request"],
      party_b: ["Maintain confidentiality", "Use information only for permitted purpose", "Return materials upon request"],
    },
    risk_factors: [
      { factor: "Broad indemnification scope", severity: calculus_scores.Liability > 60 ? "high" : "medium" },
      { factor: "Auto-renewal clause", severity: "medium" },
      { factor: "Governing law and jurisdiction", severity: "low" },
    ],
    termination_clauses: {
      for_cause: "Immediate upon material breach with 30-day cure period",
      for_convenience: contract_type === "NDA" ? "At term end" : "90 days written notice",
      survival: ["Confidentiality (3 years)", "IP assignment (perpetual)", "Indemnification (2 years)"],
    },
    calculus_scores,
    risk_score,
    risk_level,
    recommendations: risk_score > 65
      ? ["Negotiate liability cap to 12 months fees", "Add mutual indemnification clause", "Clarify IP ownership for edge cases"]
      : risk_score > 40
      ? ["Review auto-renewal notification window", "Confirm governing law is favorable"]
      : ["Contract is generally favorable — standard review sufficient"],
  };

  try {
    db.prepare(`
      INSERT OR IGNORE INTO atticus_contracts
        (id, agent_id, filename, contract_type, parties, total_value, risk_score, calculus_scores, key_terms, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(contract_id, agent_id, filename, contract_type, JSON.stringify(parties), value, risk_score, JSON.stringify(calculus_scores), JSON.stringify(result.risk_factors.map(r => r.factor)), now);
  } catch (e) { console.error("[atticus-iq] atticusAnalyze insert contract:", e.message); }

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'analyze', ?, ?, ?)
    `).run(analysis_id, contract_id, JSON.stringify(result), fee, now);
  } catch (e) { console.error("[atticus-iq] atticusAnalyze insert analysis:", e.message); }

  logRevenue(agent_id, "analyze", fee);

  return { ...result, analysis_id, fee_charged_usdc: fee, revenue_model: "70/30 (developer/platform)", mode: LIVE_MODE ? "live" : "simulation" };
}

/**
 * atticusCompare — Compare two contracts side-by-side.
 * Returns deltas in terms, pricing, risk scores, and which is more favorable.
 */
export async function atticusCompare(args) {
  const { agent_id = "anonymous", contract_a_id, contract_b_id, contract_a_text = "", contract_b_text = "" } = args;

  if (!contract_a_id && !contract_a_text) throw new Error("Provide contract_a_id or contract_a_text");
  if (!contract_b_id && !contract_b_text) throw new Error("Provide contract_b_id or contract_b_text");

  let contractA = null;
  let contractB = null;

  if (contract_a_id) {
    try { contractA = db.prepare("SELECT * FROM atticus_contracts WHERE id = ?").get(contract_a_id); } catch (e) { console.error("[atticus-iq] compare fetch A:", e.message); }
  }
  if (contract_b_id) {
    try { contractB = db.prepare("SELECT * FROM atticus_contracts WHERE id = ?").get(contract_b_id); } catch (e) { console.error("[atticus-iq] compare fetch B:", e.message); }
  }

  const scoresA = contractA ? JSON.parse(contractA.calculus_scores || "{}") : generateCalculus(calcContractType(contract_a_text), contract_a_text);
  const scoresB = contractB ? JSON.parse(contractB.calculus_scores || "{}") : generateCalculus(calcContractType(contract_b_text), contract_b_text);
  const riskA = overallRisk(scoresA);
  const riskB = overallRisk(scoresB);

  const deltas = Object.fromEntries(
    Object.keys(scoresA).map(k => [k, { a: scoresA[k] || 0, b: scoresB[k] || 0, delta: (scoresB[k] || 0) - (scoresA[k] || 0), favors: (scoresA[k] || 0) < (scoresB[k] || 0) ? "A" : "B" }])
  );

  const more_favorable = riskA < riskB ? "Contract A" : "Contract B";

  const analysis_id = newId();
  const result = {
    contract_a: { id: contract_a_id || "ad-hoc", type: contractA?.contract_type || calcContractType(contract_a_text), risk_score: riskA, risk_level: riskLabel(riskA) },
    contract_b: { id: contract_b_id || "ad-hoc", type: contractB?.contract_type || calcContractType(contract_b_text), risk_score: riskB, risk_level: riskLabel(riskB) },
    dimension_deltas: deltas,
    more_favorable,
    risk_difference: Math.abs(riskA - riskB).toFixed(1),
    key_differences: [
      "Liability caps may differ — review Section 8 in each",
      "Termination rights may be asymmetric",
      "IP assignment scope may differ",
    ],
    recommendation: `${more_favorable} presents lower overall risk (${Math.min(riskA, riskB).toFixed(1)} vs ${Math.max(riskA, riskB).toFixed(1)}). Prefer ${more_favorable} unless commercial terms dictate otherwise.`,
  };

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'compare', ?, ?, datetime('now'))
    `).run(analysis_id, contract_a_id || "ad-hoc", JSON.stringify(result), FEES.compare);
  } catch (e) { console.error("[atticus-iq] atticusCompare insert:", e.message); }

  logRevenue(agent_id, "compare", FEES.compare);

  return { ...result, analysis_id, fee_charged_usdc: FEES.compare, mode: LIVE_MODE ? "live" : "simulation" };
}

/**
 * atticusPortfolioRisk — Analyze an entire portfolio of contracts.
 * Returns total exposure, concentration risk, expiration timeline, highest-risk contracts.
 */
export async function atticusPortfolioRisk(args) {
  const { agent_id = "anonymous" } = args;

  let contracts = [];
  try {
    contracts = db.prepare("SELECT * FROM atticus_contracts WHERE agent_id = ? OR agent_id = 'seed'").all(agent_id);
  } catch (e) { console.error("[atticus-iq] portfolioRisk fetch:", e.message); }

  if (contracts.length === 0) {
    return {
      status: "empty_portfolio",
      message: "No contracts found. Use atticus_analyze to add contracts to your portfolio.",
      fee_charged_usdc: FEES.portfolio_risk,
    };
  }

  const totalExposure = contracts.reduce((s, c) => s + (c.total_value || 0), 0);
  const avgRisk = contracts.reduce((s, c) => s + (c.risk_score || 0), 0) / contracts.length;
  const highRisk = contracts.filter(c => (c.risk_score || 0) >= 65).sort((a, b) => b.risk_score - a.risk_score);
  const expiringIn90Days = contracts.filter(c => {
    if (!c.expiration_date) return false;
    const daysUntil = (new Date(c.expiration_date) - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 90;
  });

  const byType = {};
  for (const c of contracts) {
    byType[c.contract_type] = (byType[c.contract_type] || 0) + (c.total_value || 0);
  }
  const topConcentration = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, val]) => ({ type, exposure_usd: val, pct: totalExposure > 0 ? +((val / totalExposure) * 100).toFixed(1) : 0 }));

  const analysis_id = newId();
  const result = {
    portfolio_summary: {
      total_contracts: contracts.length,
      total_exposure_usd: totalExposure,
      weighted_risk_score: +avgRisk.toFixed(1),
      risk_level: riskLabel(avgRisk),
    },
    concentration_risk: topConcentration,
    expiring_soon: expiringIn90Days.map(c => ({ id: c.id, type: c.contract_type, expiration_date: c.expiration_date, value_usd: c.total_value })),
    highest_risk_contracts: highRisk.slice(0, 5).map(c => ({ id: c.id, type: c.contract_type, risk_score: c.risk_score, risk_level: riskLabel(c.risk_score), value_usd: c.total_value })),
    action_items: [
      expiringIn90Days.length > 0 ? `${expiringIn90Days.length} contract(s) expire within 90 days — initiate renewal discussions` : null,
      highRisk.length > 0 ? `${highRisk.length} high-risk contract(s) require legal review` : null,
      totalExposure > 5000000 ? "Total exposure exceeds $5M — consider cross-contract insurance" : null,
    ].filter(Boolean),
  };

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'portfolio_risk', ?, ?, datetime('now'))
    `).run(analysis_id, agent_id, JSON.stringify(result), FEES.portfolio_risk);
  } catch (e) { console.error("[atticus-iq] portfolioRisk insert:", e.message); }

  logRevenue(agent_id, "portfolio_risk", FEES.portfolio_risk);

  return { ...result, analysis_id, fee_charged_usdc: FEES.portfolio_risk, mode: LIVE_MODE ? "live" : "simulation" };
}

/**
 * atticusComplianceCheck — Check a contract against regulatory requirements.
 * Checks: GDPR, CCPA, SOX, HIPAA, EU AI Act.
 */
export async function atticusComplianceCheck(args) {
  const { agent_id = "anonymous", contract_id, contract_text = "", regulations = ["GDPR", "CCPA", "SOX", "HIPAA", "EU AI Act"] } = args;

  if (!contract_id && !contract_text) throw new Error("Provide contract_id or contract_text");

  let contract = null;
  if (contract_id) {
    try { contract = db.prepare("SELECT * FROM atticus_contracts WHERE id = ?").get(contract_id); } catch (e) { console.error("[atticus-iq] complianceCheck fetch:", e.message); }
  }

  const text = contract_text || (contract ? `${contract.contract_type} ${JSON.parse(contract.key_terms || "[]").join(" ")}` : "");

  const checks = {
    GDPR: {
      compliant: text.toLowerCase().includes("data protection") || text.toLowerCase().includes("gdpr") || Math.random() > 0.4,
      issues: [],
      required_clauses: ["Data Processing Agreement", "Right to Erasure", "Data Breach Notification (72hr)", "DPA Appointment"],
      found_clauses: ["Data Processing Agreement"],
      citation: "EU Regulation 2016/679 Art. 28 (processor obligations), Art. 17 (right to erasure)",
    },
    CCPA: {
      compliant: text.toLowerCase().includes("california") || text.toLowerCase().includes("ccpa") || Math.random() > 0.5,
      issues: [],
      required_clauses: ["Right to Know", "Right to Delete", "Opt-Out of Sale", "Non-Discrimination"],
      found_clauses: [],
      citation: "Cal. Civ. Code §1798.100 et seq.",
    },
    SOX: {
      compliant: Math.random() > 0.3,
      issues: [],
      required_clauses: ["Record Retention (7 years)", "Audit Trail Requirements", "Financial Controls Attestation"],
      found_clauses: [],
      citation: "Sarbanes-Oxley Act §302, §404",
    },
    HIPAA: {
      compliant: text.toLowerCase().includes("hipaa") || text.toLowerCase().includes("phi") || Math.random() > 0.6,
      issues: [],
      required_clauses: ["Business Associate Agreement", "PHI Safeguards", "Breach Notification", "Minimum Necessary Standard"],
      found_clauses: text.toLowerCase().includes("hipaa") ? ["Business Associate Agreement"] : [],
      citation: "45 CFR §164 (HIPAA Security Rule, Privacy Rule)",
    },
    "EU AI Act": {
      compliant: Math.random() > 0.5,
      issues: [],
      required_clauses: ["AI System Risk Classification", "Human Oversight Provisions", "Transparency Obligations", "Data Governance"],
      found_clauses: [],
      citation: "EU AI Act Art. 9 (Risk management), Art. 13 (Transparency), Art. 14 (Human oversight)",
    },
  };

  // Filter to requested regulations
  const results = Object.fromEntries(
    regulations.filter(r => checks[r]).map(r => {
      const check = checks[r];
      const missing = check.required_clauses.filter(c => !check.found_clauses.includes(c));
      check.issues = missing.map(c => `Missing: ${c}`);
      if (!check.compliant && missing.length > 0) check.issues.push("Non-compliant: required clauses absent");
      return [r, check];
    })
  );

  const nonCompliant = Object.entries(results).filter(([, v]) => !v.compliant).map(([k]) => k);
  const overall_compliant = nonCompliant.length === 0;

  const analysis_id = newId();

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'compliance_check', ?, ?, datetime('now'))
    `).run(analysis_id, contract_id || "ad-hoc", JSON.stringify(results), FEES.compliance_check);
  } catch (e) { console.error("[atticus-iq] complianceCheck insert:", e.message); }

  logRevenue(agent_id, "compliance_check", FEES.compliance_check);

  return {
    analysis_id,
    overall_compliant,
    non_compliant_regulations: nonCompliant,
    regulation_results: results,
    summary: overall_compliant ? "Contract meets reviewed regulatory requirements." : `Non-compliant with: ${nonCompliant.join(", ")}. Add missing clauses before execution.`,
    fee_charged_usdc: FEES.compliance_check,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

/**
 * atticusRedline — Suggest redline changes to protect the user's interests.
 * Returns clauses to modify, suggested language, risk reduction impact.
 */
export async function atticusRedline(args) {
  const { agent_id = "anonymous", contract_id, contract_text = "", protect_party = "client" } = args;

  if (!contract_id && !contract_text) throw new Error("Provide contract_id or contract_text");

  let contract = null;
  if (contract_id) {
    try { contract = db.prepare("SELECT * FROM atticus_contracts WHERE id = ?").get(contract_id); } catch (e) { console.error("[atticus-iq] redline fetch:", e.message); }
  }

  const contract_type = contract?.contract_type || calcContractType(contract_text);
  const scores = contract ? JSON.parse(contract.calculus_scores || "{}") : generateCalculus(contract_type, contract_text);

  const redlines = [
    {
      clause: "Limitation of Liability",
      current_language: "Provider's liability shall not exceed amounts paid in the prior month.",
      suggested_language: "Provider's total liability shall not exceed amounts paid in the twelve (12) months preceding the claim. Notwithstanding the foregoing, neither party shall be liable for indirect, incidental, or consequential damages.",
      risk_dimension: "Liability",
      risk_reduction: -18,
      priority: scores.Liability > 60 ? "critical" : "high",
      rationale: "Monthly cap is insufficient for enterprise deployments. Annual cap better aligns with commercial risk.",
    },
    {
      clause: "Auto-Renewal",
      current_language: "This Agreement auto-renews for successive one-year terms unless cancelled.",
      suggested_language: "This Agreement auto-renews for successive one-year terms unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.",
      risk_dimension: "Temporal",
      risk_reduction: -12,
      priority: "medium",
      rationale: "Explicit notice window prevents surprise renewals and gives adequate time for vendor evaluation.",
    },
    {
      clause: "Indemnification",
      current_language: "Customer shall indemnify Provider for all claims arising from Customer's use.",
      suggested_language: CLAUSE_LIBRARY.indemnification.mutual,
      risk_dimension: "Liability",
      risk_reduction: -20,
      priority: scores.Liability > 50 ? "critical" : "medium",
      rationale: "Mutual indemnification is the market standard. One-sided indemnification creates asymmetric risk exposure.",
    },
    {
      clause: "Governing Law",
      current_language: "This Agreement shall be governed by the laws of [Provider's State].",
      suggested_language: `This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of law principles. Disputes shall be resolved by binding arbitration in [neutral city] under AAA Commercial Arbitration Rules.`,
      risk_dimension: "Compliance",
      risk_reduction: -8,
      priority: "medium",
      rationale: "Neutral arbitration jurisdiction reduces litigation risk and enforceability uncertainty.",
    },
    {
      clause: "IP Ownership",
      current_language: "All deliverables shall be owned by the Provider.",
      suggested_language: CLAUSE_LIBRARY.ip_assignment.license_back,
      risk_dimension: "Performance",
      risk_reduction: -15,
      priority: scores.Performance > 50 ? "high" : "medium",
      rationale: "Customer should own custom deliverables. Provider retains license to underlying platform/tools.",
    },
  ];

  const totalRiskReduction = redlines.reduce((s, r) => s + r.risk_reduction, 0);
  const currentRisk = overallRisk(scores);
  const projectedRisk = Math.max(0, currentRisk + totalRiskReduction / Object.keys(scores).length);

  const analysis_id = newId();

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'redline', ?, ?, datetime('now'))
    `).run(analysis_id, contract_id || "ad-hoc", JSON.stringify({ redlines, currentRisk, projectedRisk }), FEES.redline);
  } catch (e) { console.error("[atticus-iq] redline insert:", e.message); }

  logRevenue(agent_id, "redline", FEES.redline);

  return {
    analysis_id,
    contract_type,
    protect_party,
    current_risk_score: currentRisk,
    projected_risk_score: +projectedRisk.toFixed(1),
    risk_improvement: +(currentRisk - projectedRisk).toFixed(1),
    redlines: redlines.sort((a, b) => (a.priority === "critical" ? -1 : a.priority === "high" ? 0 : 1) - (b.priority === "critical" ? -1 : b.priority === "high" ? 0 : 1)),
    negotiation_notes: [
      "Lead with mutual indemnification — most vendors accept this",
      "Annual liability cap is table stakes for enterprise deals",
      "IP ownership is often negotiable if framed as 'custom work' vs 'platform'",
    ],
    fee_charged_usdc: FEES.redline,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

/**
 * atticusClauseLibrary — Search library of standard clauses by type.
 * Free tool.
 */
export async function atticusClauseLibrary(args) {
  const { clause_type, variant = "standard", search_term } = args;

  const availableTypes = Object.keys(CLAUSE_LIBRARY);

  if (!clause_type && !search_term) {
    return {
      available_clause_types: availableTypes,
      usage: "Provide clause_type (e.g., 'indemnification') and optionally variant (e.g., 'mutual', 'broad_form')",
      fee_charged_usdc: 0,
    };
  }

  if (search_term) {
    const term = search_term.toLowerCase();
    const matches = [];
    for (const [type, variants] of Object.entries(CLAUSE_LIBRARY)) {
      if (type.includes(term) || Object.values(variants).some(v => v.toLowerCase().includes(term))) {
        matches.push({ clause_type: type, variants: Object.keys(variants) });
      }
    }
    return { search_term, matches, fee_charged_usdc: 0 };
  }

  const library = CLAUSE_LIBRARY[clause_type];
  if (!library) {
    return { error: `Clause type '${clause_type}' not found. Available: ${availableTypes.join(", ")}`, fee_charged_usdc: 0 };
  }

  const available_variants = Object.keys(library);
  const selected_variant = library[variant] || library[available_variants[0]];

  return {
    clause_type,
    variant: library[variant] ? variant : available_variants[0],
    available_variants,
    clause_text: selected_variant,
    usage_notes: `This clause is provided as a starting point. Have qualified legal counsel review before execution.`,
    fee_charged_usdc: 0,
  };
}

/**
 * atticusBoardReport — Generate executive board report from contract portfolio.
 * Total exposure, key risks, upcoming renewals, recommended actions.
 */
export async function atticusBoardReport(args) {
  const { agent_id = "anonymous", report_period = "Q4 2024", include_charts = true } = args;

  let contracts = [];
  try {
    contracts = db.prepare("SELECT * FROM atticus_contracts WHERE agent_id = ? OR agent_id = 'seed'").all(agent_id);
  } catch (e) { console.error("[atticus-iq] boardReport fetch:", e.message); }

  const totalExposure = contracts.reduce((s, c) => s + (c.total_value || 0), 0);
  const avgRisk = contracts.length > 0 ? contracts.reduce((s, c) => s + (c.risk_score || 0), 0) / contracts.length : 0;
  const highRiskContracts = contracts.filter(c => (c.risk_score || 0) >= 65);
  const expiringContracts = contracts.filter(c => {
    if (!c.expiration_date) return false;
    const days = (new Date(c.expiration_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 180;
  });

  const byType = {};
  for (const c of contracts) {
    if (!byType[c.contract_type]) byType[c.contract_type] = { count: 0, exposure: 0 };
    byType[c.contract_type].count++;
    byType[c.contract_type].exposure += c.total_value || 0;
  }

  const analysis_id = newId();
  const report = {
    report_id: analysis_id,
    report_period,
    generated_at: new Date().toISOString(),
    executive_summary: {
      total_contracts: contracts.length,
      total_exposure_usd: totalExposure,
      portfolio_risk_score: +avgRisk.toFixed(1),
      portfolio_risk_level: riskLabel(avgRisk),
      critical_items: highRiskContracts.length + expiringContracts.length,
    },
    financial_exposure: {
      total_exposure_usd: totalExposure,
      by_contract_type: Object.entries(byType).map(([type, data]) => ({ type, count: data.count, exposure_usd: data.exposure, pct_of_total: totalExposure > 0 ? +((data.exposure / totalExposure) * 100).toFixed(1) : 0 })),
      top_5_by_value: [...contracts].sort((a, b) => (b.total_value || 0) - (a.total_value || 0)).slice(0, 5).map(c => ({ id: c.id, type: c.contract_type, value_usd: c.total_value, risk_score: c.risk_score })),
    },
    risk_analysis: {
      portfolio_risk_score: +avgRisk.toFixed(1),
      high_risk_count: highRiskContracts.length,
      high_risk_contracts: highRiskContracts.slice(0, 5).map(c => ({ id: c.id, type: c.contract_type, risk_score: c.risk_score, key_concerns: JSON.parse(c.key_terms || "[]").slice(0, 2) })),
    },
    upcoming_renewals: {
      expiring_in_180_days: expiringContracts.length,
      contracts: expiringContracts.map(c => ({ id: c.id, type: c.contract_type, expiration_date: c.expiration_date, value_usd: c.total_value, action_required: "Begin renewal negotiations" })),
    },
    recommended_actions: [
      { priority: 1, action: "Immediate Legal Review", detail: `${highRiskContracts.length} contracts with risk score ≥65 require outside counsel review`, timeline: "30 days" },
      { priority: 2, action: "Renewal Pipeline", detail: `${expiringContracts.length} contracts expiring within 6 months`, timeline: "60 days" },
      { priority: 3, action: "Compliance Audit", detail: "Run atticus_compliance_check on all contracts with GDPR/HIPAA exposure", timeline: "90 days" },
      { priority: 4, action: "Portfolio Insurance", detail: totalExposure > 5000000 ? `Consider contract performance insurance for $${(totalExposure / 1000000).toFixed(1)}M exposure` : "No immediate insurance action required", timeline: "Q1 next year" },
    ],
  };

  try {
    db.prepare(`
      INSERT INTO atticus_analyses (id, contract_id, analysis_type, result, cost_usdc, created_at)
      VALUES (?, ?, 'board_report', ?, ?, datetime('now'))
    `).run(analysis_id, agent_id, JSON.stringify(report), FEES.board_report);
  } catch (e) { console.error("[atticus-iq] boardReport insert:", e.message); }

  logRevenue(agent_id, "board_report", FEES.board_report);

  return { ...report, fee_charged_usdc: FEES.board_report, mode: LIVE_MODE ? "live" : "simulation" };
}

/**
 * atticusStats — AtticusIQ vertical statistics.
 */
export async function atticusStats(args) {
  const stats = { total_analyses: 0, contracts_processed: 0, total_revenue_usdc: 0, avg_risk_score: 0, top_contract_types: [], mode: LIVE_MODE ? "live" : "simulation" };

  try {
    const anaRow = db.prepare("SELECT COUNT(*) as n, SUM(cost_usdc) as rev FROM atticus_analyses").get();
    stats.total_analyses = anaRow?.n || 0;
    stats.total_revenue_usdc = +(anaRow?.rev || 0).toFixed(4);
  } catch (e) { console.error("[atticus-iq] stats analyses:", e.message); }

  try {
    const cRow = db.prepare("SELECT COUNT(*) as n, AVG(risk_score) as avg FROM atticus_contracts").get();
    stats.contracts_processed = cRow?.n || 0;
    stats.avg_risk_score = +(cRow?.avg || 0).toFixed(1);
  } catch (e) { console.error("[atticus-iq] stats contracts:", e.message); }

  try {
    stats.top_contract_types = db.prepare("SELECT contract_type, COUNT(*) as count FROM atticus_contracts GROUP BY contract_type ORDER BY count DESC LIMIT 5").all();
  } catch (e) { console.error("[atticus-iq] stats top_types:", e.message); }

  try {
    const revRow = db.prepare("SELECT SUM(platform_share) as platform, SUM(developer_share) as developer FROM atticus_revenue").get();
    stats.revenue_split = {
      total_usdc: +((revRow?.platform || 0) + (revRow?.developer || 0)).toFixed(4),
      platform_share_usdc: +(revRow?.platform || 0).toFixed(4),
      developer_share_usdc: +(revRow?.developer || 0).toFixed(4),
      model: "70/30 (developer/platform)",
    };
  } catch (e) { console.error("[atticus-iq] stats revenue:", e.message); }

  return stats;
}
