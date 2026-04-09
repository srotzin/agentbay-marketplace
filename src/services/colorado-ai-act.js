/**
 * Colorado AI Act Compliance Engine
 * Phase 58 — HiveAgent
 *
 * Signal: Colorado SB24-205 — the first US state AI law with real teeth.
 * Effective June 1, 2026. Any developer or deployer of a "high-risk AI system"
 * that makes consequential decisions about Colorado consumers in employment,
 * education, housing, credit, healthcare, or insurance must: publish a
 * disclosure, conduct an impact assessment, and give consumers the right to
 * appeal automated decisions. Penalties: up to $20,000 per violation.
 *
 * Who it covers:
 *   - AI "developers" — companies that create or substantially modify high-risk AI
 *   - AI "deployers" — companies that use high-risk AI in consumer-facing decisions
 *   - Any AI system that makes "consequential decisions" affecting Colorado consumers
 *
 * Consequential decisions are defined in statute as decisions with material
 * effect on access to: employment, education, financial/lending services,
 * essential government services, healthcare, housing, or insurance.
 *
 * Enforcement: Colorado AG + civil penalties up to $20,000/violation/day
 * Attorney General has authority to conduct audits and compel impact assessments.
 *
 * LIVE_MODE = false — documentation generation is local (no external API needed)
 */

import db from "../db.js";
import crypto from "crypto";

export const LIVE_MODE = false; // All generation is local — works day one

// ─── Consequential Decision Domains (SB24-205 §6-1-1702) ─────────────────────

const CONSEQUENTIAL_DOMAINS = {
  employment: {
    label: "Employment",
    examples: ["hiring", "promotion", "termination", "performance review", "compensation", "scheduling"],
    risk_weight: 10,
    disclosure_language: "employment or workforce decisions",
  },
  education: {
    label: "Education",
    examples: ["admissions", "financial aid", "academic assessment", "enrollment", "graduation requirements"],
    risk_weight: 9,
    disclosure_language: "educational program decisions",
  },
  housing: {
    label: "Housing",
    examples: ["rental applications", "mortgage qualification", "eviction risk scoring", "tenant screening"],
    risk_weight: 10,
    disclosure_language: "housing or rental decisions",
  },
  credit: {
    label: "Credit / Financial Services",
    examples: ["credit scoring", "loan approval", "interest rate determination", "credit limit setting", "debt collection"],
    risk_weight: 10,
    disclosure_language: "credit or financial services decisions",
  },
  healthcare: {
    label: "Healthcare",
    examples: ["clinical decision support", "treatment recommendations", "insurance coverage", "mental health assessment"],
    risk_weight: 10,
    disclosure_language: "healthcare or medical decisions",
  },
  insurance: {
    label: "Insurance",
    examples: ["policy pricing", "claims adjudication", "coverage eligibility", "risk scoring", "underwriting"],
    risk_weight: 9,
    disclosure_language: "insurance coverage or pricing decisions",
  },
};

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS colorado_assessments (
      id                   TEXT PRIMARY KEY,
      agent_id             TEXT NOT NULL,
      use_case             TEXT NOT NULL,
      affects_consumers    INTEGER DEFAULT 1,
      consequential_domains TEXT DEFAULT '[]',
      high_risk            INTEGER DEFAULT 0,
      risk_score           INTEGER DEFAULT 0,
      impact_assessment_id TEXT,
      status               TEXT DEFAULT 'pending',
      created_at           TEXT DEFAULT (datetime('now')),
      reviewed_at          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_co_assess_agent ON colorado_assessments(agent_id);
  `);
} catch (e) {
  console.error("[CO-AI-Act] Schema init error (colorado_assessments):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS colorado_disclosures (
      id                 TEXT PRIMARY KEY,
      agent_id           TEXT NOT NULL,
      use_case           TEXT NOT NULL,
      organization       TEXT NOT NULL,
      disclosure_text    TEXT NOT NULL,
      placement          TEXT DEFAULT 'before_consumer_interaction',
      published          INTEGER DEFAULT 0,
      published_at       TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_co_disc_agent ON colorado_disclosures(agent_id);
  `);
} catch (e) {
  console.error("[CO-AI-Act] Schema init error (colorado_disclosures):", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = "") {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

function daysUntilEnforcement() {
  const enforcement = new Date("2026-06-01T00:00:00Z");
  const now = new Date();
  const diff = enforcement - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function classifyColoradoRisk(affects_consumers, consequential_decisions_about = []) {
  if (!affects_consumers) return { high_risk: false, risk_score: 0, matched_domains: [] };

  const matched = consequential_decisions_about.filter(d => CONSEQUENTIAL_DOMAINS[d]);
  const risk_score = matched.reduce((acc, d) => acc + (CONSEQUENTIAL_DOMAINS[d]?.risk_weight || 5), 0);

  return {
    high_risk: matched.length > 0,
    risk_score,
    matched_domains: matched,
  };
}

function buildRequiredDisclosures(high_risk, matched_domains) {
  if (!high_risk) return [];
  const base = [
    "Prominent consumer notice before AI system interaction",
    "Description of the types of consequential decisions the system makes",
    "Contact information for the deployer or developer",
    "Instructions for consumers to request human review",
    "Information about the right to appeal adverse decisions",
    "Data sources and types used by the AI system",
  ];

  const domainSpecific = matched_domains.flatMap(d => {
    const info = CONSEQUENTIAL_DOMAINS[d];
    return info ? [`Domain-specific notice for ${info.label}: disclosure of ${info.disclosure_language}`] : [];
  });

  return [...base, ...domainSpecific];
}

function buildConsumerRights(high_risk) {
  if (!high_risk) return "Standard consumer rights apply. Colorado AI Act does not impose additional requirements for non-high-risk systems.";
  return [
    "Right to notice that an AI system was used in a consequential decision",
    "Right to request a plain-language explanation of how the AI system influenced the decision",
    "Right to appeal an adverse decision made by or with substantial assistance from an AI system",
    "Right to request human review of the AI-assisted decision",
    "Right to correct inaccurate personal information used by the AI system",
    "Right to opt out of profiling used for consequential decisions (certain contexts)",
  ].join("\n");
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

try {
  const n = db.prepare("SELECT COUNT(*) as n FROM colorado_assessments").get().n;
  if (n === 0) {
    const seeds = [
      {
        id: uid("co-assess-"),
        agent_id: "agent_hire_ai_001",
        use_case: "Automated resume screening and candidate ranking for enterprise hiring",
        affects_consumers: 1,
        consequential_domains: JSON.stringify(["employment"]),
        high_risk: 1,
        risk_score: 10,
        status: "impact_assessment_required",
      },
      {
        id: uid("co-assess-"),
        agent_id: "agent_lendingbot_002",
        use_case: "Real-time credit risk scoring for personal loan applications under $50,000",
        affects_consumers: 1,
        consequential_domains: JSON.stringify(["credit", "housing"]),
        high_risk: 1,
        risk_score: 20,
        status: "disclosed",
      },
      {
        id: uid("co-assess-"),
        agent_id: "agent_insure_003",
        use_case: "Auto insurance premium calculation using telematics and driving behavior data",
        affects_consumers: 1,
        consequential_domains: JSON.stringify(["insurance"]),
        high_risk: 1,
        risk_score: 9,
        status: "compliant",
      },
      {
        id: uid("co-assess-"),
        agent_id: "agent_internal_analytics_004",
        use_case: "Internal business KPI dashboard — no consumer-facing decisions",
        affects_consumers: 0,
        consequential_domains: JSON.stringify([]),
        high_risk: 0,
        risk_score: 0,
        status: "not_applicable",
      },
    ];

    const ins = db.prepare(`
      INSERT INTO colorado_assessments
        (id, agent_id, use_case, affects_consumers, consequential_domains, high_risk, risk_score, status)
      VALUES
        (@id, @agent_id, @use_case, @affects_consumers, @consequential_domains, @high_risk, @risk_score, @status)
    `);
    const tx = db.transaction(() => seeds.forEach(s => ins.run(s)));
    tx();
  }
} catch (e) {
  console.error("[CO-AI-Act] Seed error:", e.message);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * coloradoAssess — Classify an AI system under Colorado SB24-205
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.use_case
 * @param {boolean} args.affects_consumers
 * @param {string[]} args.consequential_decisions_about  — e.g. ["employment","credit"]
 */
export async function coloradoAssess(args) {
  const {
    agent_id,
    use_case,
    affects_consumers = true,
    consequential_decisions_about = [],
  } = args;

  const { high_risk, risk_score, matched_domains } = classifyColoradoRisk(
    affects_consumers,
    consequential_decisions_about
  );

  const required_disclosures = buildRequiredDisclosures(high_risk, matched_domains);
  const impact_assessment_required = high_risk;
  const consumer_rights_summary = buildConsumerRights(high_risk);
  const days = daysUntilEnforcement();

  const assessment_id = uid("co-assess-");

  try {
    db.prepare(`
      INSERT OR REPLACE INTO colorado_assessments
        (id, agent_id, use_case, affects_consumers, consequential_domains, high_risk, risk_score, status)
      VALUES
        (@id, @agent_id, @use_case, @affects_consumers, @consequential_domains, @high_risk, @risk_score, @status)
    `).run({
      id: assessment_id,
      agent_id,
      use_case,
      affects_consumers: affects_consumers ? 1 : 0,
      consequential_domains: JSON.stringify(matched_domains),
      high_risk: high_risk ? 1 : 0,
      risk_score,
      status: high_risk ? "impact_assessment_required" : "not_applicable",
    });
  } catch (e) {
    console.error("[CO-AI-Act] coloradoAssess write error:", e.message);
  }

  return {
    assessment_id,
    agent_id,
    use_case,
    high_risk,
    risk_score,
    consequential_domains: matched_domains.map(d => ({
      domain: d,
      label: CONSEQUENTIAL_DOMAINS[d].label,
      examples: CONSEQUENTIAL_DOMAINS[d].examples,
    })),
    required_disclosures,
    impact_assessment_required,
    consumer_rights_summary,
    enforcement_date: "June 1, 2026",
    statute: "Colorado SB24-205",
    penalty: "up to $20,000 per violation per day",
    developer_obligations: high_risk ? [
      "Publish public use policy describing the high-risk AI system",
      "Notify all deployers of their legal obligations",
      "Make available documentation to enable deployer compliance",
      "Conduct algorithmic impact assessment before deployment",
      "Implement bias testing across protected classes",
    ] : [],
    deployer_obligations: high_risk ? [
      "Provide consumer disclosure before any AI-assisted consequential decision",
      "Implement a process for consumers to appeal adverse decisions",
      "Enable consumers to request human review",
      "Maintain documentation of AI system use in consequential decisions",
      "Report to Colorado AG upon request",
    ] : [],
    _urgency: days > 0
      ? `${days} days until June 1, 2026 enforcement. ${high_risk ? "This system is HIGH RISK — act now." : "No action required for non-high-risk systems."}`
      : "Colorado AI Act is NOW IN EFFECT. Immediate compliance required.",
  };
}

/**
 * generateDisclosure — Generate the consumer-facing disclosure notice Colorado requires
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.use_case
 * @param {string} args.organization
 */
export async function generateDisclosure(args) {
  const { agent_id, use_case, organization } = args;

  const disclosure_id = uid("co-disc-");
  const today = new Date().toISOString().split("T")[0];

  const disclosure_text = `NOTICE OF AUTOMATED DECISION-MAKING

${organization.toUpperCase()}

Pursuant to Colorado Senate Bill 24-205 (Artificial Intelligence) — Effective June 1, 2026

You are interacting with an artificial intelligence system operated by ${organization}.

WHAT THIS AI DOES
This AI system assists in making decisions related to: ${use_case}. These decisions may have a material effect on your access to services, employment, housing, credit, healthcare, or insurance.

YOUR RIGHTS UNDER COLORADO LAW
As a Colorado consumer, you have the following rights:

1. RIGHT TO EXPLANATION — You may request a plain-language explanation of how this AI system influenced any decision affecting you, including the key factors considered.

2. RIGHT TO APPEAL — If this system contributed to an adverse decision, you have the right to appeal that decision. To initiate an appeal, contact us at the address below.

3. RIGHT TO HUMAN REVIEW — You may request that a qualified human review any AI-assisted decision. We will accommodate such requests within 10 business days.

4. RIGHT TO CORRECT YOUR DATA — If inaccurate personal information was used in a decision, you may request correction. Corrected information will be considered in any appeal.

5. RIGHT TO OPT OUT — In certain contexts, you may opt out of decisions based solely on automated processing.

HOW THIS AI SYSTEM WORKS
This AI system uses data you provide, along with other lawfully obtained data, to produce recommendations or decisions. The system has been evaluated for accuracy and potential bias. We are committed to fair and non-discriminatory use of AI.

DATA USED IN DECISIONS
The AI system may use: information you provide directly, publicly available information, third-party data sources, and behavioral or usage data, as applicable to your specific interaction.

CONTACT US
To exercise your rights, submit an appeal, or ask questions about our AI system, contact:
  ${organization}
  AI Compliance Officer
  [compliance@${organization.toLowerCase().replace(/\s+/g, "")}.com]
  Colorado AI Act Compliance Hotline: [phone number]

This disclosure is provided pursuant to Colorado SB24-205. Last updated: ${today}.

Disclosure generated by HiveAgent Colorado AI Act Compliance Engine.`;

  try {
    db.prepare(`
      INSERT INTO colorado_disclosures
        (id, agent_id, use_case, organization, disclosure_text, placement)
      VALUES
        (@id, @agent_id, @use_case, @organization, @disclosure_text, @placement)
    `).run({
      id: disclosure_id,
      agent_id,
      use_case,
      organization,
      disclosure_text,
      placement: "before_consumer_interaction",
    });
  } catch (e) {
    console.error("[CO-AI-Act] generateDisclosure write error:", e.message);
  }

  return {
    disclosure_id,
    agent_id,
    organization,
    disclosure_text,
    required_placement: "must appear before consumer interaction",
    format_requirements: [
      "Must be clear and conspicuous",
      "Must use plain language (no legal jargon)",
      "Must be accessible to individuals with disabilities (WCAG 2.1 AA)",
      "Must be available in languages spoken by the consumer where feasible",
      "Must be provided before the AI system is used for a consequential decision",
    ],
    delivery_channels: [
      "Website disclosure page (linked from homepage)",
      "In-app notification before AI-assisted process begins",
      "Email notice at the start of any consequential AI-assisted process",
      "Physical notice where services are delivered in person",
    ],
    statute_reference: "Colorado SB24-205, Section 6-1-1703",
    _note: "Required for any high-risk AI system deployed in Colorado. Non-compliance: up to $20,000 per violation. This disclosure is ready to publish — customize the contact details and post before June 1, 2026.",
  };
}

/**
 * coloradoImpactAssessment — Generate a full algorithmic impact assessment document
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.use_case
 * @param {string[]} args.data_sources
 * @param {string} args.training_data_description
 */
export async function coloradoImpactAssessment(args) {
  const {
    agent_id,
    use_case,
    data_sources = [],
    training_data_description = "Not provided",
  } = args;

  const assessment_id = uid("co-impact-");
  const today = new Date().toISOString().split("T")[0];

  const assessment_document = `ALGORITHMIC IMPACT ASSESSMENT
Colorado SB24-205 — High-Risk Artificial Intelligence System

Assessment ID: ${assessment_id}
Agent ID: ${agent_id}
Date Prepared: ${today}
Prepared By: HiveAgent Colorado AI Act Compliance Engine
Statute: Colorado Senate Bill 24-205, Section 6-1-1705
Classification: HIGH-RISK AI SYSTEM

═══════════════════════════════════════════════════════
SECTION 1: EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════

This Algorithmic Impact Assessment (AIA) has been prepared pursuant to Colorado SB24-205, which requires developers and deployers of high-risk artificial intelligence systems to conduct and document a comprehensive impact assessment prior to deployment, and at least annually thereafter.

AI System: ${use_case}
Assessment Scope: Consumer-facing consequential decision-making in Colorado
Assessment Period: Annual review required from deployment date

The assessment concludes that this AI system qualifies as HIGH-RISK under Colorado SB24-205 and requires: (1) consumer disclosure, (2) appeals process implementation, (3) human review capability, (4) bias testing documentation, and (5) ongoing monitoring.

═══════════════════════════════════════════════════════
SECTION 2: AI SYSTEM DESCRIPTION
═══════════════════════════════════════════════════════

2.1 Purpose and Functionality
The AI system is designed to perform the following function:
  ${use_case}

2.2 Decision Types
This system makes or substantially contributes to decisions that have material effects on consumers' access to services. These are "consequential decisions" as defined in §6-1-1702(3) of the Colorado Revised Statutes.

2.3 Interaction with Consumers
The system interacts with consumers either directly or by producing outputs used by human decision-makers. Consumer data is processed to produce recommendations, scores, rankings, or classifications.

2.4 Technical Architecture
  - System Type: AI-assisted automated decision-making
  - Human Oversight: [Developer to specify oversight mechanisms]
  - Decision Output: Recommendation / Score / Classification / Approval/Denial

═══════════════════════════════════════════════════════
SECTION 3: DATA GOVERNANCE
═══════════════════════════════════════════════════════

3.1 Data Sources Used
${data_sources.length > 0 ? data_sources.map((s, i) => `  ${i + 1}. ${s}`).join("\n") : "  [Developer must enumerate all data sources]"}

3.2 Training Data Description
  ${training_data_description}

3.3 Data Quality Assessment
  - Completeness: [Developer to assess % complete records]
  - Recency: [Developer to specify data vintage]
  - Geographic coverage: [Developer to confirm Colorado consumer coverage]
  - Protected class representation: [Developer to document demographic representation]

3.4 Data Minimization
The system collects and uses only the minimum data necessary to perform the stated function. Data not relevant to the consequential decision is excluded from model inputs.

3.5 Retention and Deletion
  - Consumer data used in decisions is retained for [X] years for audit purposes
  - Deletion requests processed within 45 days (Colorado Privacy Act compliance)

═══════════════════════════════════════════════════════
SECTION 4: BIAS AND FAIRNESS ASSESSMENT
═══════════════════════════════════════════════════════

4.1 Protected Characteristics Reviewed
  ☐ Race and color
  ☐ Sex and gender identity
  ☐ Sexual orientation
  ☐ Disability status
  ☐ National origin and ancestry
  ☐ Age (40+)
  ☐ Religion
  ☐ Marital status
  ☐ Pregnancy status
  ☐ Veteran status

4.2 Bias Testing Methodology
  - Statistical parity testing across protected classes
  - Disparate impact analysis (four-fifths rule where applicable)
  - Individual fairness assessment for similar inputs
  - Counterfactual analysis for sensitive attribute removal

4.3 Known Bias Risks
  - Historical data may encode past discriminatory decisions
  - Proxy variables may correlate with protected characteristics
  - Data collection may underrepresent certain demographic groups
  - Model outputs may vary in accuracy across subgroups

4.4 Bias Mitigation Measures
  [See Section 6 — Risk Mitigation Measures]

4.5 Ongoing Monitoring
  - Monthly bias audits during first year of deployment
  - Quarterly audits thereafter
  - Immediate review triggered by disparate impact threshold breach (>20% gap)

═══════════════════════════════════════════════════════
SECTION 5: CONSUMER IMPACT ANALYSIS
═══════════════════════════════════════════════════════

5.1 Beneficial Impacts
  - Faster decision-making reducing consumer wait times
  - Consistent application of decision criteria across all consumers
  - Reduced human error in routine decision components
  - 24/7 availability for consumer applications

5.2 Potential Adverse Impacts
  - Risk of systematic bias if training data reflects historical inequities
  - Reduced human judgment in nuanced or edge-case situations
  - Potential for error where AI system lacks context
  - Consumer confusion about AI-assisted nature of decisions

5.3 Vulnerable Population Considerations
  - Elderly consumers may have less familiarity with AI-assisted processes
  - Consumers with disabilities may require alternative disclosure formats
  - Non-English speakers may not fully understand AI disclosure notices
  - Consumers in rural Colorado may have limited access to human review alternatives

5.4 Geographic Impact
  Assessment covers all Colorado consumers. No geographic exclusions apply.

═══════════════════════════════════════════════════════
SECTION 6: RISK MITIGATION MEASURES
═══════════════════════════════════════════════════════

6.1 Technical Controls
  [ ] Bias testing completed before deployment using representative Colorado data
  [ ] Model accuracy benchmarks established and documented
  [ ] Explainability layer implemented (e.g., SHAP, LIME, or rule-based explanations)
  [ ] Input validation to reject invalid or discriminatory data inputs
  [ ] Confidence thresholds routing low-confidence decisions to human review
  [ ] Model version control and rollback capability

6.2 Process Controls
  [ ] Consumer disclosure published and accessible
  [ ] Appeals process documented and staffed
  [ ] Human review team trained on AI system outputs and limitations
  [ ] Escalation protocol for contested decisions
  [ ] Regular third-party audit schedule established

6.3 Governance Controls
  [ ] AI Ethics officer or committee designated
  [ ] Board-level AI risk oversight established
  [ ] Incident response plan for AI system failures
  [ ] Vendor management procedures for third-party AI components
  [ ] Staff training on Colorado AI Act obligations

═══════════════════════════════════════════════════════
SECTION 7: CONSUMER RIGHTS IMPLEMENTATION
═══════════════════════════════════════════════════════

7.1 Right to Explanation
  Status: [ ] Implemented / [ ] In Progress / [ ] Planned
  Implementation: [Describe how consumers receive plain-language explanations]
  Timeline: Must be available at deployment (June 1, 2026)

7.2 Right to Appeal
  Status: [ ] Implemented / [ ] In Progress / [ ] Planned
  Process: [Describe the appeals workflow]
  Target response time: 10 business days
  Escalation path: [Describe escalation if initial appeal denied]

7.3 Right to Human Review
  Status: [ ] Implemented / [ ] In Progress / [ ] Planned
  Process: [Describe how human review is requested and conducted]
  Availability: Business hours / 24-hour request intake

7.4 Right to Data Correction
  Status: [ ] Implemented / [ ] In Progress / [ ] Planned
  Process: [Describe data correction request and re-evaluation workflow]

═══════════════════════════════════════════════════════
SECTION 8: COMPLIANCE CERTIFICATION
═══════════════════════════════════════════════════════

By completing this assessment, the organization certifies that:

  (a) This AI system has been evaluated for risk under Colorado SB24-205
  (b) Required consumer disclosures are or will be in place before June 1, 2026
  (c) Consumer appeals and human review processes are or will be operational
  (d) Bias testing has been or will be completed before deployment
  (e) This assessment will be updated at least annually and upon material changes

Prepared By: ___________________________
Title: ___________________________
Organization: ___________________________
Date: ${today}
Assessment ID: ${assessment_id}

This document was generated by HiveAgent Colorado AI Act Compliance Engine.
Store this assessment for a minimum of 5 years. Provide to Colorado AG upon request.`;

  const risk_mitigation_measures = [
    "Pre-deployment bias testing across all six protected domain categories (employment, education, housing, credit, healthcare, insurance)",
    "Statistical parity and disparate impact testing using representative Colorado consumer data",
    "SHAP or LIME explainability layer for plain-language consumer explanations",
    "Confidence threshold routing: decisions below 70% confidence routed to mandatory human review",
    "Monthly automated bias monitoring reports with 20% disparity threshold alerts",
    "Consumer disclosure published on homepage and displayed before each AI-assisted process",
    "10-business-day appeals SLA with dedicated human review team",
    "Annual third-party algorithmic audit by a qualified AI auditor",
    "Staff training on Colorado AI Act rights and obligations (minimum 4 hours annually)",
    "Incident response plan covering AI errors, bias discoveries, and AG audit requests",
  ];

  return {
    assessment_id,
    agent_id,
    use_case,
    assessment_document,
    risk_mitigation_measures,
    bias_testing_required: true,
    bias_testing_checklist: [
      "Statistical parity across race and ethnicity",
      "Disparate impact analysis by sex/gender",
      "Accuracy parity across age groups (18-39, 40-59, 60+)",
      "Performance parity across disability status",
      "Geographic equity across Colorado counties",
      "Socioeconomic proxy variable analysis",
    ],
    compliance_checklist: [
      "Consumer disclosure published: [ ]",
      "Appeals process operational: [ ]",
      "Human review team trained: [ ]",
      "Bias testing completed: [ ]",
      "Impact assessment filed: [ ]",
      "AG notification protocol ready: [ ]",
    ],
    annual_review_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
    statute_reference: "Colorado SB24-205, Section 6-1-1705",
    _pages: 8,
    _note: "This impact assessment satisfies the Colorado SB24-205 documentation requirement. Complete all [ ] checkboxes before June 1, 2026. Retain for 5 years. Provide to Colorado AG upon request.",
  };
}

/**
 * coloradoStatus — Overview of Colorado AI Act and HiveAgent's compliance tools
 */
export async function coloradoStatus() {
  const days = daysUntilEnforcement();

  let assessmentStats = { total: 0, high_risk: 0, compliant: 0 };
  try {
    assessmentStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(high_risk) as high_risk,
        SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant
      FROM colorado_assessments
    `).get() || assessmentStats;
  } catch (e) {
    console.error("[CO-AI-Act] coloradoStatus query error:", e.message);
  }

  return {
    statute: "Colorado SB24-205 — Artificial Intelligence",
    jurisdiction: "State of Colorado, United States",
    enforcement_date: "June 1, 2026",
    days_until_enforcement: days,
    status: days > 0 ? "upcoming" : "in_effect",

    what_it_covers: [
      "High-risk AI systems making consequential decisions about Colorado consumers",
      "Decisions in: employment, education, housing, credit, healthcare, insurance",
      "Any AI developer or deployer with Colorado consumers in scope",
      "AI systems that substantially contribute to final decisions (not just minor aids)",
    ],

    who_it_affects: {
      developers: "Companies that create or substantially modify high-risk AI systems",
      deployers: "Companies that use high-risk AI systems in consumer-facing decisions",
      exempt: [
        "AI systems with de minimis effect on consumer decisions",
        "AI systems used for internal business operations (no consumer decisions)",
        "AI systems for national security purposes",
        "Regulated financial institutions with equivalent federal oversight (partial exemption)",
      ],
    },

    key_obligations: [
      "Publish consumer disclosure notice before any AI-assisted consequential decision",
      "Conduct and document algorithmic impact assessment annually",
      "Implement consumer appeals process with 10-day response SLA",
      "Enable human review upon consumer request",
      "Allow consumers to correct inaccurate data used in AI decisions",
      "Notify Colorado AG of high-risk AI system deployment",
    ],

    penalties: {
      per_violation: "$20,000",
      per_day: "Violations can accrue daily for ongoing non-compliance",
      enforcement_body: "Colorado Attorney General",
      audit_authority: "AG may compel production of impact assessments and documentation",
      private_right_of_action: false,
      note: "No private right of action — only AG can enforce (as of June 2026)",
    },

    hiveagent_tools: [
      "coloradoAssess — Classify your AI system in 30 seconds",
      "generateDisclosure — Ready-to-publish consumer notice",
      "coloradoImpactAssessment — 8-page impact assessment document",
      "coloradoStatus — Stay current on requirements and timeline",
    ],

    assessed_agents: assessmentStats.total,
    high_risk_agents: assessmentStats.high_risk,
    compliant_agents: assessmentStats.compliant,

    comparison_to_eu_ai_act: "Colorado SB24-205 is narrower than the EU AI Act but more immediate for US-based companies. No exemption for 'limited-risk' systems — if you touch consequential decisions in Colorado, you're in scope.",

    _hook: "First US state AI law with real teeth. June 1. $20,000 per violation per day. Are you ready?",
  };
}
