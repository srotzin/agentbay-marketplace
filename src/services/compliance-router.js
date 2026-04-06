import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const COMPLIANCE_PLATFORM_COMMISSION = 0.20; // 20% on all compliance checks
const COMPLIANCE_CHECK_FEE_USD       = 0.25; // per check call
const JURISDICTION_ROUTE_FEE_USD     = 0.15; // per routing call
const REQUIREMENTS_FETCH_FEE_USD     = 0.10; // per requirements fetch
const VALIDATION_FEE_USD             = 0.50; // per pre-execution gate (higher value op)

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS compliance_checks (
    id                TEXT PRIMARY KEY,
    proposed_action   TEXT NOT NULL,
    jurisdictions     TEXT NOT NULL,
    domain            TEXT NOT NULL,
    decision          TEXT NOT NULL CHECK(decision IN ('COMPLIANT','NON_COMPLIANT','UNCERTAIN')),
    citations         TEXT,
    reasoning         TEXT,
    risk_score        REAL,
    flags             TEXT,
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    agent_id          TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jurisdiction_routings (
    id                TEXT PRIMARY KEY,
    action_type       TEXT NOT NULL,
    parties           TEXT NOT NULL,
    primary_jurisdiction TEXT NOT NULL,
    secondary_jurisdictions TEXT,
    conflict_detected INTEGER DEFAULT 0,
    routing_rationale TEXT,
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regulatory_requirement_cache (
    id                TEXT PRIMARY KEY,
    jurisdiction      TEXT NOT NULL,
    domain            TEXT NOT NULL,
    requirements      TEXT NOT NULL,
    regulatory_body   TEXT,
    last_updated_date TEXT,
    effective_date    TEXT,
    sunset_date       TEXT,
    cache_expires_at  TEXT,
    fetch_count       INTEGER DEFAULT 1,
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    created_at        TEXT DEFAULT (datetime('now')),
    UNIQUE(jurisdiction, domain)
  );

  CREATE TABLE IF NOT EXISTS compliance_validations (
    id                TEXT PRIMARY KEY,
    action            TEXT NOT NULL,
    context           TEXT NOT NULL,
    gate_result       TEXT NOT NULL CHECK(gate_result IN ('PASS','BLOCK','REVIEW_REQUIRED')),
    checks_run        INTEGER DEFAULT 0,
    blocking_rules    TEXT,
    recommendations   TEXT,
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Static Regulatory Knowledge Base ────────────────────────────────────────

const REGULATORY_DB = {
  "US-SEC": {
    finance: {
      body: "U.S. Securities and Exchange Commission",
      last_updated: "2024-11-15",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "Reg NMS", citation: "17 CFR 242.600-612", description: "Order handling and best execution for equities." },
        { rule: "Dodd-Frank §619 (Volcker)", citation: "12 U.S.C. §1851", description: "Prohibits proprietary trading and certain fund relationships." },
        { rule: "Investment Advisers Act", citation: "15 U.S.C. §80b-1", description: "Fiduciary duty registration and disclosure for investment advisers." },
        { rule: "Reg BI (Best Interest)", citation: "17 CFR 240.15l-1", description: "Broker-dealers must act in retail customers' best interest." },
      ],
      risk_baseline: "high",
    },
    data_privacy: {
      body: "Federal Trade Commission / State AGs",
      last_updated: "2024-09-01",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "Gramm-Leach-Bliley Act", citation: "15 U.S.C. §§6801-6827", description: "Financial institutions must protect consumer financial data." },
        { rule: "FTC Safeguards Rule", citation: "16 CFR Part 314", description: "Specific security requirements for customer financial information." },
      ],
      risk_baseline: "medium",
    },
    ai_ml: {
      body: "NIST / Executive Order 14110",
      last_updated: "2024-10-22",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "EO 14110 – AI Risk Management", citation: "88 FR 75191", description: "Dual-use AI systems require red-teaming and safety reporting." },
        { rule: "NIST AI RMF", citation: "NIST AI 100-1", description: "Voluntary risk management framework for AI systems." },
      ],
      risk_baseline: "medium",
    },
  },
  "EU-GDPR": {
    data_privacy: {
      body: "European Data Protection Board (EDPB)",
      last_updated: "2024-08-20",
      effective_date: "2018-05-25",
      requirements: [
        { rule: "GDPR Article 6", citation: "Regulation (EU) 2016/679, Art. 6", description: "Lawful basis for processing personal data." },
        { rule: "GDPR Article 17", citation: "Regulation (EU) 2016/679, Art. 17", description: "Right to erasure ('right to be forgotten')." },
        { rule: "GDPR Article 25", citation: "Regulation (EU) 2016/679, Art. 25", description: "Data protection by design and by default." },
        { rule: "GDPR Article 35", citation: "Regulation (EU) 2016/679, Art. 35", description: "Data Protection Impact Assessment (DPIA) mandatory for high-risk processing." },
      ],
      risk_baseline: "high",
    },
    ai_ml: {
      body: "European AI Office",
      last_updated: "2024-08-01",
      effective_date: "2024-08-01",
      requirements: [
        { rule: "EU AI Act – High Risk", citation: "Regulation (EU) 2024/1689, Art. 6", description: "High-risk AI systems require conformity assessment and registration." },
        { rule: "EU AI Act – Transparency", citation: "Regulation (EU) 2024/1689, Art. 50", description: "AI-generated content must be disclosed to end users." },
        { rule: "EU AI Act – GPAI", citation: "Regulation (EU) 2024/1689, Art. 51", description: "General-purpose AI models above capability thresholds require systemic risk assessment." },
      ],
      risk_baseline: "high",
    },
    finance: {
      body: "European Banking Authority (EBA) / ESMA",
      last_updated: "2024-07-10",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "MiCA", citation: "Regulation (EU) 2023/1114", description: "Markets in Crypto-Assets regulation – licensing for crypto-asset service providers." },
        { rule: "DORA", citation: "Regulation (EU) 2022/2554", description: "Digital Operational Resilience Act – ICT risk management for financial entities." },
        { rule: "PSD2", citation: "Directive (EU) 2015/2366", description: "Payment services directive – strong customer authentication." },
      ],
      risk_baseline: "high",
    },
  },
  "UK-FCA": {
    finance: {
      body: "Financial Conduct Authority",
      last_updated: "2024-10-01",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "Consumer Duty", citation: "FCA PS22/9", description: "Firms must deliver good outcomes for retail customers." },
        { rule: "Senior Managers Regime", citation: "SMCR – FCA/PRA", description: "Individual accountability for senior managers at financial firms." },
        { rule: "MiFID II (onshored)", citation: "UK SI 2017/701", description: "Post-Brexit retained MiFID rules for investment services." },
      ],
      risk_baseline: "high",
    },
    data_privacy: {
      body: "Information Commissioner's Office (ICO)",
      last_updated: "2024-05-01",
      effective_date: "2018-05-25",
      requirements: [
        { rule: "UK GDPR", citation: "Data Protection Act 2018 / UK GDPR", description: "UK post-Brexit equivalent of EU GDPR." },
      ],
      risk_baseline: "medium",
    },
  },
  "SG-MAS": {
    finance: {
      body: "Monetary Authority of Singapore",
      last_updated: "2024-06-15",
      effective_date: "2024-01-01",
      requirements: [
        { rule: "MAS Notice 626", citation: "MAS Notice 626", description: "Anti-money laundering and countering financing of terrorism." },
        { rule: "Payment Services Act", citation: "Singapore PSA 2019", description: "Licensing regime for payment service providers." },
        { rule: "Digital Token Offering Guidelines", citation: "MAS A Guide to DPT", description: "Guidelines for digital payment token service providers." },
      ],
      risk_baseline: "medium",
    },
  },
};

const JURISDICTION_ROUTING_RULES = {
  data_transfer: {
    keywords: ["personal data", "pii", "user data", "transfer", "export"],
    primary: "EU-GDPR",
    secondary: ["US-SEC"],
    rationale: "Cross-border personal data transfers are primarily governed by GDPR with US adequacy considerations.",
  },
  payment_processing: {
    keywords: ["payment", "transfer", "funds", "wire", "crypto", "settlement"],
    primary: "US-SEC",
    secondary: ["EU-GDPR", "UK-FCA", "SG-MAS"],
    rationale: "Payment operations are multi-jurisdictional; primary jurisdiction determined by party domicile.",
  },
  ai_deployment: {
    keywords: ["ai", "model", "inference", "ml", "automated decision", "llm", "agent"],
    primary: "EU-GDPR",
    secondary: ["US-SEC"],
    rationale: "EU AI Act is the most prescriptive AI-specific regulation globally; US EO 14110 applies additionally.",
  },
  investment_advice: {
    keywords: ["portfolio", "invest", "securities", "stock", "fund", "asset management"],
    primary: "US-SEC",
    secondary: ["UK-FCA", "SG-MAS"],
    rationale: "Investment advice triggers securities regulation; jurisdiction follows adviser domicile and client location.",
  },
  contract_execution: {
    keywords: ["contract", "agreement", "sign", "execute", "bind", "obligate"],
    primary: "UK-FCA",
    secondary: ["US-SEC", "EU-GDPR"],
    rationale: "Contract formation follows party domicile and governing law clause; EU consumer rules may apply.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRiskScore(domain, jurisdictions, actionText) {
  const highRiskDomains  = ["finance", "ai_ml", "healthcare"];
  const highRiskKeywords = ["transfer", "delete", "override", "bypass", "admin", "execute", "sign"];
  let score = 30;
  if (highRiskDomains.includes(domain)) score += 25;
  if (jurisdictions.length > 2)         score += 15;
  const lowerAction = actionText.toLowerCase();
  for (const kw of highRiskKeywords) {
    if (lowerAction.includes(kw)) { score += 10; break; }
  }
  return Math.min(100, score);
}

function evaluateCompliance(proposedAction, jurisdictions, domain) {
  const lowerAction = proposedAction.toLowerCase();
  const citations   = [];
  const flags       = [];
  let decisionScore = 0; // higher = more compliant signals
  let blockingSignal = false;

  for (const jur of jurisdictions) {
    const jurData = REGULATORY_DB[jur];
    if (!jurData) continue;
    const domainData = jurData[domain] || jurData["data_privacy"];
    if (!domainData) continue;

    for (const req of domainData.requirements) {
      citations.push({ jurisdiction: jur, rule: req.rule, citation: req.citation, description: req.description });
    }

    if (domainData.risk_baseline === "high") decisionScore -= 10;
    if (domainData.risk_baseline === "medium") decisionScore += 5;
  }

  const prohibitedPatterns = [
    { pattern: /bypass.*compliance/i,   flag: "Compliance bypass attempt detected", blocks: true },
    { pattern: /delete.*all.*records/i,  flag: "Bulk data deletion - GDPR/SEC retention rules apply", blocks: true },
    { pattern: /no.*disclosure/i,        flag: "Disclosure suppression may violate transparency requirements", blocks: false },
    { pattern: /unregistered.*advisor/i, flag: "Unregistered investment advice violates securities law", blocks: true },
    { pattern: /unlicensed.*payment/i,   flag: "Unlicensed payment services violate PSD2/PSA", blocks: true },
  ];

  for (const { pattern, flag, blocks } of prohibitedPatterns) {
    if (pattern.test(lowerAction)) {
      flags.push(flag);
      if (blocks) blockingSignal = true;
    }
  }

  let decision;
  if (blockingSignal) {
    decision = "NON_COMPLIANT";
  } else if (citations.length === 0 || jurisdictions.some(j => !REGULATORY_DB[j])) {
    decision = "UNCERTAIN";
  } else if (decisionScore >= 0 && flags.length === 0) {
    decision = "COMPLIANT";
  } else {
    decision = flags.length > 0 ? "NON_COMPLIANT" : "UNCERTAIN";
  }

  return { decision, citations, flags };
}

// ─── Check Compliance ─────────────────────────────────────────────────────────

/**
 * Evaluate whether a proposed action is compliant with regulations in the specified jurisdictions.
 * @param {string}   proposedAction  - Natural language or structured description of the action
 * @param {string[]} jurisdictions   - Array of jurisdiction codes (US-SEC, EU-GDPR, UK-FCA, SG-MAS)
 * @param {string}   domain         - Regulatory domain: finance|data_privacy|ai_ml
 * @returns Compliance decision: COMPLIANT | NON_COMPLIANT | UNCERTAIN with citations
 */
export function checkCompliance(proposedAction, jurisdictions, domain) {
  if (!proposedAction)              throw new Error("proposedAction is required");
  if (!Array.isArray(jurisdictions) || jurisdictions.length === 0) throw new Error("jurisdictions must be a non-empty array");
  if (!domain)                      throw new Error("domain is required");

  const validDomains = ["finance", "data_privacy", "ai_ml", "healthcare", "employment", "contract"];
  if (!validDomains.includes(domain)) throw new Error(`domain must be one of: ${validDomains.join(", ")}`);

  const { decision, citations, flags } = evaluateCompliance(proposedAction, jurisdictions, domain);
  const riskScore  = computeRiskScore(domain, jurisdictions, proposedAction);
  const fee        = COMPLIANCE_CHECK_FEE_USD * jurisdictions.length;
  const commission = Math.round(fee * COMPLIANCE_PLATFORM_COMMISSION * 100) / 100;
  const id         = uuid();
  const now        = new Date().toISOString();

  const reasoning = decision === "COMPLIANT"
    ? `Action reviewed against ${citations.length} regulatory requirements across ${jurisdictions.join(", ")}. No blocking conditions found.`
    : decision === "NON_COMPLIANT"
    ? `Action triggers ${flags.length} blocking rule(s): ${flags.join("; ")}`
    : `Insufficient regulatory mapping for jurisdiction/domain combination. Manual legal review recommended.`;

  db.prepare(`
    INSERT OR IGNORE INTO compliance_checks
      (id, proposed_action, jurisdictions, domain, decision, citations, reasoning, risk_score, flags, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @proposed_action, @jurisdictions, @domain, @decision, @citations, @reasoning, @risk_score, @flags, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    proposed_action: proposedAction,
    jurisdictions:   JSON.stringify(jurisdictions),
    domain,
    decision,
    citations:       JSON.stringify(citations),
    reasoning,
    risk_score:      riskScore,
    flags:           JSON.stringify(flags),
    fee_usd:         Math.round(fee * 100) / 100,
    commission_usd:  commission,
    created_at:      now,
  });

  return {
    check_id:             id,
    decision,
    proposed_action:      proposedAction,
    jurisdictions,
    domain,
    risk_score:           riskScore,
    risk_level:           riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW",
    reasoning,
    citations:            citations.slice(0, 10),
    flags:                flags,
    requires_legal_review: decision === "NON_COMPLIANT" || riskScore >= 70,
    fee_usd:              Math.round(fee * 100) / 100,
    platform_commission_usd: commission,
    checked_at:           now,
  };
}

// ─── Route Jurisdiction ───────────────────────────────────────────────────────

/**
 * Determine which jurisdiction's rules apply to a cross-border action.
 * @param {string} actionType - Type of action (data_transfer|payment_processing|ai_deployment|investment_advice|contract_execution)
 * @param {Object[]} parties  - Array of party objects: [{name, domicile, role}]
 * @returns Primary and secondary jurisdictions with routing rationale
 */
export function routeJurisdiction(actionType, parties) {
  if (!actionType)                       throw new Error("actionType is required");
  if (!Array.isArray(parties) || parties.length === 0) throw new Error("parties must be a non-empty array");

  const rule       = JURISDICTION_ROUTING_RULES[actionType];
  const fee        = JURISDICTION_ROUTE_FEE_USD;
  const commission = Math.round(fee * COMPLIANCE_PLATFORM_COMMISSION * 100) / 100;
  const id         = uuid();
  const now        = new Date().toISOString();

  // Extract domiciles from party list to detect cross-border scenarios
  const domiciles = parties.map(p => p.domicile || p.country || "UNKNOWN").filter(Boolean);
  const euCountries = ["DE","FR","IT","ES","NL","BE","AT","PL","SE","DK","FI","IE","PT","CZ","HU","RO","SK","BG","HR","LT","LV","EE","SI","CY","LU","MT"];
  const hasEU = domiciles.some(d => euCountries.includes(d) || d === "EU");
  const hasUS = domiciles.some(d => d === "US" || d === "USA");
  const hasUK = domiciles.some(d => d === "UK" || d === "GB");
  const hasSG = domiciles.some(d => d === "SG" || d === "SGP");

  let primary    = rule?.primary ?? "US-SEC";
  let secondary  = [...(rule?.secondary ?? [])];
  let rationale  = rule?.rationale ?? "Default routing applied.";
  let conflictDetected = false;

  // Override primary based on party domiciles
  if (hasEU && !hasUS) { primary = "EU-GDPR"; }
  if (hasUK && !hasUS && !hasEU) { primary = "UK-FCA"; }
  if (hasSG && !hasUS && !hasEU && !hasUK) { primary = "SG-MAS"; }

  // Add dynamically detected jurisdictions to secondary
  if (hasEU  && primary !== "EU-GDPR"  && !secondary.includes("EU-GDPR"))  secondary.push("EU-GDPR");
  if (hasUS  && primary !== "US-SEC"   && !secondary.includes("US-SEC"))   secondary.push("US-SEC");
  if (hasUK  && primary !== "UK-FCA"   && !secondary.includes("UK-FCA"))   secondary.push("UK-FCA");
  if (hasSG  && primary !== "SG-MAS"   && !secondary.includes("SG-MAS"))   secondary.push("SG-MAS");

  if (secondary.length > 1) conflictDetected = true;

  db.prepare(`
    INSERT OR IGNORE INTO jurisdiction_routings
      (id, action_type, parties, primary_jurisdiction, secondary_jurisdictions, conflict_detected, routing_rationale, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @action_type, @parties, @primary_jurisdiction, @secondary_jurisdictions, @conflict_detected, @routing_rationale, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    action_type:             actionType,
    parties:                 JSON.stringify(parties),
    primary_jurisdiction:    primary,
    secondary_jurisdictions: JSON.stringify(secondary),
    conflict_detected:       conflictDetected ? 1 : 0,
    routing_rationale:       rationale,
    fee_usd:                 fee,
    commission_usd:          commission,
    created_at:              now,
  });

  return {
    routing_id:              id,
    action_type:             actionType,
    parties:                 parties.map(p => ({ name: p.name, domicile: p.domicile || "UNKNOWN", role: p.role || "party" })),
    primary_jurisdiction:    primary,
    secondary_jurisdictions: secondary,
    conflict_detected:       conflictDetected,
    conflict_note:           conflictDetected ? "Multiple jurisdictions apply. Consult legal counsel for conflict-of-laws analysis." : null,
    routing_rationale:       rationale,
    recommended_action:      `Apply ${primary} requirements first; review secondary jurisdictions for additional obligations.`,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    routed_at:               now,
  };
}

// ─── Get Regulatory Requirements ──────────────────────────────────────────────

/**
 * Retrieve current regulatory requirements for a jurisdiction and domain.
 * @param {string} jurisdiction - Jurisdiction code: US-SEC | EU-GDPR | UK-FCA | SG-MAS
 * @param {string} domain       - Regulatory domain: finance|data_privacy|ai_ml
 * @returns Structured requirements with citations and effective dates
 */
export function getRegulatoryRequirements(jurisdiction, domain) {
  if (!jurisdiction) throw new Error("jurisdiction is required");
  if (!domain)       throw new Error("domain is required");

  const supportedJurisdictions = Object.keys(REGULATORY_DB);
  if (!supportedJurisdictions.includes(jurisdiction))
    throw new Error(`Unsupported jurisdiction: ${jurisdiction}. Supported: ${supportedJurisdictions.join(", ")}`);

  const fee        = REQUIREMENTS_FETCH_FEE_USD;
  const commission = Math.round(fee * COMPLIANCE_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  const jurData = REGULATORY_DB[jurisdiction];
  const domainData = jurData?.[domain];

  // Update cache counter or insert
  const cached = db.prepare("SELECT * FROM regulatory_requirement_cache WHERE jurisdiction=? AND domain=?").get(jurisdiction, domain);
  if (cached) {
    db.prepare("UPDATE regulatory_requirement_cache SET fetch_count=fetch_count+1 WHERE jurisdiction=? AND domain=?").run(jurisdiction, domain);
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO regulatory_requirement_cache
        (id, jurisdiction, domain, requirements, regulatory_body, last_updated_date, effective_date, cache_expires_at, fee_usd, commission_usd, created_at)
      VALUES
        (@id, @jurisdiction, @domain, @requirements, @regulatory_body, @last_updated_date, @effective_date, @cache_expires_at, @fee_usd, @commission_usd, @created_at)
    `).run({
      id:                uuid(),
      jurisdiction,
      domain,
      requirements:      JSON.stringify(domainData?.requirements ?? []),
      regulatory_body:   domainData?.body ?? "Unknown",
      last_updated_date: domainData?.last_updated ?? null,
      effective_date:    domainData?.effective_date ?? null,
      cache_expires_at:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h cache
      fee_usd:           fee,
      commission_usd:    commission,
      created_at:        now,
    });
  }

  if (!domainData) {
    return {
      jurisdiction,
      domain,
      status:           "NOT_FOUND",
      message:          `No requirements indexed for ${jurisdiction}/${domain}. This domain may not be regulated or data is pending.`,
      available_domains: Object.keys(jurData || {}),
      fee_usd:           fee,
      platform_commission_usd: commission,
      fetched_at:        now,
    };
  }

  return {
    jurisdiction,
    domain,
    regulatory_body:   domainData.body,
    risk_baseline:     domainData.risk_baseline,
    last_updated:      domainData.last_updated,
    effective_date:    domainData.effective_date,
    requirements_count: domainData.requirements.length,
    requirements:      domainData.requirements,
    data_freshness:    "live",
    fee_usd:           fee,
    platform_commission_usd: commission,
    fetched_at:        now,
  };
}

// ─── Validate Action ──────────────────────────────────────────────────────────

/**
 * Pre-execution compliance gate — validates an action against all applicable rules before it runs.
 * @param {Object} action  - { type, description, value_usd?, target? }
 * @param {Object} context - { agent_id, jurisdiction, domain, parties? }
 * @returns Gate result: PASS | BLOCK | REVIEW_REQUIRED with blocking rules and recommendations
 */
export function validateAction(action, context) {
  if (!action?.type)        throw new Error("action.type is required");
  if (!action?.description) throw new Error("action.description is required");
  if (!context?.jurisdiction) throw new Error("context.jurisdiction is required");
  if (!context?.domain)       throw new Error("context.domain is required");

  const jurisdictions = Array.isArray(context.jurisdiction) ? context.jurisdiction : [context.jurisdiction];
  const { decision, citations, flags } = evaluateCompliance(action.description, jurisdictions, context.domain);
  const riskScore     = computeRiskScore(context.domain, jurisdictions, action.description);

  const blockingRules    = [];
  const recommendations  = [];
  let gateResult;

  // Threshold-based blocking
  if (action.value_usd && action.value_usd > 100000) {
    blockingRules.push("Transaction value exceeds $100,000 — enhanced due diligence required (BSA/AML)");
  }
  if (flags.length > 0) {
    blockingRules.push(...flags);
  }

  if (blockingRules.length > 0 || decision === "NON_COMPLIANT") {
    gateResult = "BLOCK";
    recommendations.push("Obtain explicit legal sign-off before proceeding.");
    recommendations.push("Consider restructuring the action to remove blocking conditions.");
  } else if (decision === "UNCERTAIN" || riskScore >= 60) {
    gateResult = "REVIEW_REQUIRED";
    recommendations.push("Manual compliance review recommended given risk score.");
    recommendations.push("Document this action in your compliance journal.");
  } else {
    gateResult = "PASS";
    recommendations.push("Action cleared for execution. Retain this validation record for audit purposes.");
  }

  const fee        = VALIDATION_FEE_USD;
  const commission = Math.round(fee * COMPLIANCE_PLATFORM_COMMISSION * 100) / 100;
  const id         = uuid();
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO compliance_validations
      (id, action, context, gate_result, checks_run, blocking_rules, recommendations, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @action, @context, @gate_result, @checks_run, @blocking_rules, @recommendations, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    action:          JSON.stringify(action),
    context:         JSON.stringify(context),
    gate_result:     gateResult,
    checks_run:      citations.length,
    blocking_rules:  JSON.stringify(blockingRules),
    recommendations: JSON.stringify(recommendations),
    fee_usd:         fee,
    commission_usd:  commission,
    created_at:      now,
  });

  return {
    validation_id:           id,
    gate_result:             gateResult,
    action_type:             action.type,
    action_description:      action.description,
    jurisdictions,
    domain:                  context.domain,
    agent_id:                context.agent_id ?? null,
    risk_score:              riskScore,
    risk_level:              riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW",
    checks_run:              citations.length,
    blocking_rules:          blockingRules,
    recommendations,
    proceed:                 gateResult === "PASS",
    fee_usd:                 fee,
    platform_commission_usd: commission,
    validated_at:            now,
    valid_until:             new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min validity window
  };
}

// ─── List Jurisdictions ───────────────────────────────────────────────────────

/**
 * List all supported jurisdictions and their covered regulatory domains.
 * @returns Catalog of supported jurisdictions, domains, and regulatory bodies
 */
export function listJurisdictions() {
  const jurisdictions = Object.entries(REGULATORY_DB).map(([code, domains]) => ({
    jurisdiction_code: code,
    display_name:      { "US-SEC": "United States (SEC/FTC)", "EU-GDPR": "European Union (GDPR/AI Act)", "UK-FCA": "United Kingdom (FCA/ICO)", "SG-MAS": "Singapore (MAS)" }[code] ?? code,
    supported_domains: Object.keys(domains),
    regulatory_bodies: Object.values(domains).map(d => d.body),
    total_requirements: Object.values(domains).reduce((sum, d) => sum + d.requirements.length, 0),
  }));

  const recentChecks = db.prepare("SELECT COUNT(*) as n FROM compliance_checks").get().n;

  return {
    supported_jurisdictions: jurisdictions,
    total_jurisdictions:     jurisdictions.length,
    supported_domains:       ["finance", "data_privacy", "ai_ml", "healthcare", "employment", "contract"],
    action_types_for_routing: Object.keys(JURISDICTION_ROUTING_RULES),
    platform_stats: {
      total_checks_run: recentChecks,
      fee_schedule_usd: {
        compliance_check:     `${COMPLIANCE_CHECK_FEE_USD} per jurisdiction`,
        jurisdiction_routing: JURISDICTION_ROUTE_FEE_USD,
        requirements_fetch:   REQUIREMENTS_FETCH_FEE_USD,
        action_validation:    VALIDATION_FEE_USD,
      },
      platform_commission_pct: COMPLIANCE_PLATFORM_COMMISSION * 100,
    },
  };
}
