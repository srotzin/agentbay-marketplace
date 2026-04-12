/**
 * HiveAgent Multiverse — Third-Party Vertical Tool Definitions
 *
 * First third-party verticals in the HiveAgent Multiverse, operating under
 * the 70/30 App Store revenue model (70% to developer, 30% to platform).
 *
 * Verticals:
 *   AtticusIQ (8 tools)   — Contract Intelligence: analyze, compare, portfolio risk,
 *                           compliance check, redline, clause library, board reports.
 *                           7-dimension risk calculus. $0.50–$5.00 per analysis.
 *
 *   Leonardo IQ (7 tools) — IP Intelligence: patent search, prior art, FTO analysis,
 *                           IP landscape, licensing, valuation. $0.25–$5.00 per query.
 *
 * Total: 15 tools
 *
 * Revenue: fee_charged splits as platform_share (30%) + developer_share (70%)
 * logged to atticus_revenue / leonardo_revenue tables on every paid call.
 */

import {
  atticusAnalyze,
  atticusCompare,
  atticusPortfolioRisk,
  atticusComplianceCheck,
  atticusRedline,
  atticusClauseLibrary,
  atticusBoardReport,
  atticusStats,
} from "./services/atticus-iq.js";

import {
  leonardoPatentSearch,
  leonardoPriorArt,
  leonardoFreedomToOperate,
  leonardoIPLandscape,
  leonardoLicenseCheck,
  leonardoValuation,
  leonardoStats,
} from "./services/leonardo-iq.js";

// ─── AtticusIQ Tool Definitions (8 tools) ─────────────────────────────────────

const atticusTools = [

  // 1. ATTICUS ANALYZE
  {
    name: "atticus_analyze",
    description:
      "AI contract analysis. Upload or describe a contract → 7-dimension Calculus risk score " +
      "(Financial, Liability, Termination, Performance, Compliance, Counterparty, Temporal — each 0-100), " +
      "parties, dates, key obligations, risk factors, and termination clauses. " +
      "Triggers: 'analyze this contract', 'what are the risks in this agreement', " +
      "'score this NDA', 'review my SaaS contract', 'what should I watch out for in this deal'. " +
      "Returns: calculus_scores, risk_score, parties, financial_terms, key_obligations, recommendations. " +
      "$0.50–$5.00 per analysis (based on complexity). AtticusIQ Multiverse vertical.",
    inputSchema: {
      type: "object",
      properties: {
        contract_text: {
          type: "string",
          description: "Paste or describe the contract text, or summarize the key terms to be analyzed.",
        },
        contract_type: {
          type: "string",
          description: "Optional: contract type to guide analysis. Examples: 'NDA', 'SaaS Agreement', 'Employment Agreement', 'Construction Subcontract', 'Real Estate PSA', 'License Agreement', 'Master Services Agreement'.",
        },
        filename: {
          type: "string",
          description: "Optional: filename for tracking. E.g. 'vendor_msa_2024.pdf'.",
          default: "contract.pdf",
        },
        contract_value: {
          type: "number",
          description: "Optional: total monetary value of the contract in USD (used for fee tier calculation).",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier for portfolio tracking.",
        },
      },
      required: [],
    },
    annotations: {
      vertical: "legal",
      provider: "AtticusIQ",
      fee: "$0.50–$5.00",
      revenue_model: "70/30",
      multiverse: true,
    },
  },

  // 2. ATTICUS COMPARE
  {
    name: "atticus_compare",
    description:
      "Compare two contracts side-by-side. Returns deltas in every risk dimension, " +
      "identifies which contract is more favorable, and highlights key differences in liability, " +
      "IP, termination, and financial terms. " +
      "Triggers: 'compare these two contracts', 'which contract is better', " +
      "'show me the differences between these agreements', 'which MSA should I sign'. " +
      "Returns: dimension_deltas, more_favorable, risk_difference, key_differences, recommendation. $1.00",
    inputSchema: {
      type: "object",
      properties: {
        contract_a_id: {
          type: "string",
          description: "ID of the first contract (from a prior atticus_analyze call).",
        },
        contract_b_id: {
          type: "string",
          description: "ID of the second contract (from a prior atticus_analyze call).",
        },
        contract_a_text: {
          type: "string",
          description: "Text or description of Contract A (use if no contract_a_id).",
        },
        contract_b_text: {
          type: "string",
          description: "Text or description of Contract B (use if no contract_b_id).",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "$1.00", revenue_model: "70/30", multiverse: true },
  },

  // 3. ATTICUS PORTFOLIO RISK
  {
    name: "atticus_portfolio_risk",
    description:
      "Portfolio-level contract risk analysis. Analyzes your entire contract portfolio and returns: " +
      "total financial exposure, concentration risk by contract type, expiration timeline, " +
      "highest-risk contracts, weighted portfolio risk score, and action items. " +
      "Triggers: 'analyze my contract portfolio', 'what's my total contract exposure', " +
      "'which contracts are about to expire', 'give me a risk overview of all my agreements'. " +
      "Returns: portfolio_summary, concentration_risk, expiring_soon, highest_risk_contracts, action_items. $2.00",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to fetch the associated contract portfolio.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "$2.00", revenue_model: "70/30", multiverse: true },
  },

  // 4. ATTICUS COMPLIANCE CHECK
  {
    name: "atticus_compliance_check",
    description:
      "Check a contract against regulatory requirements. Supported regulations: GDPR, CCPA, SOX, HIPAA, EU AI Act. " +
      "Returns: compliant/non-compliant per regulation, specific missing clauses, clause citations to relevant law. " +
      "Triggers: 'is this contract GDPR compliant', 'check this agreement for HIPAA', " +
      "'does this contract comply with CCPA', 'regulatory compliance check on this contract'. " +
      "Returns: overall_compliant, regulation_results (per-regulation status + issues + citations). $1.00",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: {
          type: "string",
          description: "ID of an analyzed contract (from atticus_analyze).",
        },
        contract_text: {
          type: "string",
          description: "Contract text to check (use if no contract_id).",
        },
        regulations: {
          type: "array",
          items: { type: "string", enum: ["GDPR", "CCPA", "SOX", "HIPAA", "EU AI Act"] },
          description: "Regulations to check against. Defaults to all five if not specified.",
          default: ["GDPR", "CCPA", "SOX", "HIPAA", "EU AI Act"],
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "$1.00", revenue_model: "70/30", multiverse: true },
  },

  // 5. ATTICUS REDLINE
  {
    name: "atticus_redline",
    description:
      "AI-powered redline suggestions to protect your interests. Analyzes contract clauses and returns: " +
      "specific clauses to modify, suggested replacement language (ready-to-use), risk reduction impact per change, " +
      "negotiation priority (critical/high/medium), and projected risk score improvement. " +
      "Triggers: 'suggest redlines for this contract', 'what should I negotiate in this agreement', " +
      "'protect me in this contract', 'how can I improve these terms', 'mark up this contract'. " +
      "Returns: redlines[], current_risk_score, projected_risk_score, risk_improvement, negotiation_notes. $2.00",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: {
          type: "string",
          description: "ID of a previously analyzed contract.",
        },
        contract_text: {
          type: "string",
          description: "Contract text to redline (use if no contract_id).",
        },
        protect_party: {
          type: "string",
          description: "Which party to protect: 'client', 'vendor', 'employer', 'employee'. Defaults to 'client'.",
          default: "client",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "$2.00", revenue_model: "70/30", multiverse: true },
  },

  // 6. ATTICUS CLAUSE LIBRARY
  {
    name: "atticus_clause_library",
    description:
      "Search a library of standard contract clauses. Available types: indemnification, " +
      "limitation_of_liability, ip_assignment, non_compete, force_majeure. " +
      "Each type has multiple variants (standard, mutual, broad_form, etc.). " +
      "Returns ready-to-use clause language. FREE — no fee charged. " +
      "Triggers: 'give me a standard indemnification clause', 'what does a mutual NDA force majeure look like', " +
      "'show me a liability cap clause', 'I need an IP assignment clause', 'standard non-compete language'.",
    inputSchema: {
      type: "object",
      properties: {
        clause_type: {
          type: "string",
          description: "Type of clause to retrieve.",
          enum: ["indemnification", "limitation_of_liability", "ip_assignment", "non_compete", "force_majeure"],
        },
        variant: {
          type: "string",
          description: "Variant of the clause. E.g., 'standard', 'mutual', 'broad_form', 'saas_mutual', 'cyber_included'. Call without variant to see available options.",
        },
        search_term: {
          type: "string",
          description: "Search all clause types by keyword (e.g., 'cyber', 'employment', 'damages').",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "FREE", revenue_model: "70/30", multiverse: true },
  },

  // 7. ATTICUS BOARD REPORT
  {
    name: "atticus_board_report",
    description:
      "Generate an executive board report from your contract portfolio. Returns: total financial exposure, " +
      "risk analysis, upcoming renewals (180-day window), top contracts by value, concentration analysis, " +
      "and prioritized recommended actions for the board. " +
      "Triggers: 'generate a board report on our contracts', 'executive summary of contract risk', " +
      "'prepare a board presentation on our agreements', 'quarterly contract review'. " +
      "Returns: executive_summary, financial_exposure, risk_analysis, upcoming_renewals, recommended_actions. $5.00",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier for portfolio access.",
        },
        report_period: {
          type: "string",
          description: "Reporting period label. E.g., 'Q4 2024', 'FY 2025', 'H1 2025'.",
          default: "Q4 2024",
        },
        include_charts: {
          type: "boolean",
          description: "Include chart data for visualization in the report.",
          default: true,
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "$5.00", revenue_model: "70/30", multiverse: true },
  },

  // 8. ATTICUS STATS
  {
    name: "atticus_stats",
    description:
      "AtticusIQ vertical metrics. Returns: total analyses run, contracts processed, " +
      "revenue generated (with 70/30 split breakdown), average risk scores, top contract types. " +
      "Triggers: 'AtticusIQ stats', 'how much has AtticusIQ processed', 'contract intelligence metrics'. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Optional: filter stats by agent.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "AtticusIQ", fee: "FREE", revenue_model: "70/30", multiverse: true },
  },
];

// ─── Leonardo IQ Tool Definitions (7 tools) ───────────────────────────────────

const leonardoTools = [

  // 9. LEONARDO PATENT SEARCH
  {
    name: "leonardo_patent_search",
    description:
      "Search patents by keyword, classification (IPC/CPC), inventor name, assignee, date range, or jurisdiction. " +
      "Returns: patent numbers, titles, abstracts, claims summary, relevance scores, citation counts. " +
      "Jurisdictions: US, EP, WO, CN, JP, KR, AU, CA, GB. " +
      "Triggers: 'search for patents on neural networks', 'find patents by Google on transformers', " +
      "'patent search for CRISPR', 'who holds patents in quantum computing', 'find patents filed after 2022'. " +
      "Returns: patents[], relevance_scores, filing details. $0.25 per search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword or phrase to search (e.g., 'transformer attention mechanism', 'solid state battery').",
        },
        classification: {
          type: "string",
          description: "IPC/CPC classification code (e.g., 'G06N 3/04' for neural networks, 'H01M' for batteries).",
        },
        inventor: {
          type: "string",
          description: "Inventor name to search (last name or full name).",
        },
        assignee: {
          type: "string",
          description: "Assignee/company name (e.g., 'Google', 'Samsung', 'IBM').",
        },
        date_from: {
          type: "string",
          description: "Filing date range start (YYYY-MM-DD).",
        },
        date_to: {
          type: "string",
          description: "Filing date range end (YYYY-MM-DD).",
        },
        jurisdiction: {
          type: "string",
          description: "Patent office jurisdiction: US, EP, WO, CN, JP, KR, AU, CA, GB.",
        },
        limit: {
          type: "integer",
          description: "Maximum results to return (default 10, max 20).",
          default: 10,
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$0.25", revenue_model: "70/30", multiverse: true },
  },

  // 10. LEONARDO PRIOR ART
  {
    name: "leonardo_prior_art",
    description:
      "Given an invention description, find prior art that could affect patentability. " +
      "Returns: relevant prior art patents, similarity scores, impact assessment (high/medium/low), " +
      "patentability score (0-100), novelty assessment, and recommended claim modifications. " +
      "Triggers: 'find prior art for my invention', 'can I patent this', 'is my invention novel', " +
      "'search prior art for [technology]', 'patentability search'. $2.00 per search.",
    inputSchema: {
      type: "object",
      properties: {
        invention_description: {
          type: "string",
          description: "Describe the invention in as much detail as possible — what it does, how it works, key technical elements.",
        },
        technology_area: {
          type: "string",
          description: "Optional: technology area to focus the search (e.g., 'machine learning', 'battery technology').",
        },
        priority_date: {
          type: "string",
          description: "Optional: priority date to search prior art before (YYYY-MM-DD).",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: ["invention_description"],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$2.00", revenue_model: "70/30", multiverse: true },
  },

  // 11. LEONARDO FREEDOM TO OPERATE
  {
    name: "leonardo_freedom_to_operate",
    description:
      "FTO (Freedom to Operate) analysis. Analyze whether a product or process may infringe existing patents. " +
      "Returns: potentially blocking patents, claim-by-claim analysis, overall risk assessment " +
      "(high/medium/low), recommended design-around options, and next steps. " +
      "Triggers: 'can we launch this product', 'FTO analysis for [product]', " +
      "'do we infringe any patents', 'freedom to operate check', 'patent infringement risk'. $5.00 per analysis.",
    inputSchema: {
      type: "object",
      properties: {
        product_description: {
          type: "string",
          description: "Describe the product or process to analyze for FTO — include key technical features, intended use, and implementation approach.",
        },
        technology_area: {
          type: "string",
          description: "Optional: technology area to focus FTO search.",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to analyze for FTO (US, EP, CN, JP, etc.). Defaults to 'US'.",
          default: "US",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: ["product_description"],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$5.00", revenue_model: "70/30", multiverse: true },
  },

  // 12. LEONARDO IP LANDSCAPE
  {
    name: "leonardo_ip_landscape",
    description:
      "Map the IP landscape for a technology area. Returns: top patent holders, filing trends by year, " +
      "white spaces (unpatented opportunity areas), competitive positioning, acquisition targets, " +
      "and strategic recommendations. " +
      "Triggers: 'map the patent landscape for [technology]', 'who owns IP in [field]', " +
      "'IP landscape for autonomous vehicles', 'white spaces in battery patents', " +
      "'competitive IP analysis for [tech area]'. $3.00 per landscape.",
    inputSchema: {
      type: "object",
      properties: {
        technology_area: {
          type: "string",
          description: "Technology area to map (e.g., 'artificial intelligence', 'quantum computing', 'gene editing', 'electric vehicles').",
        },
        jurisdiction: {
          type: "string",
          description: "Optional: jurisdiction to focus on. Defaults to 'all'.",
          default: "all",
        },
        years: {
          type: "integer",
          description: "Number of years of filing trend data to return (default 5, max 10).",
          default: 5,
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: ["technology_area"],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$3.00", revenue_model: "70/30", multiverse: true },
  },

  // 13. LEONARDO LICENSE CHECK
  {
    name: "leonardo_license_check",
    description:
      "Check licensing status and terms for specific patents. Returns: license availability, " +
      "typical royalty rates (%), exclusive vs non-exclusive options, FRAND commitment status, " +
      "licensing program details, known licensees, and contact information. " +
      "Triggers: 'can I license this patent', 'what are the royalty rates for [patent]', " +
      "'is [patent] available for licensing', 'patent licensing terms', 'check if patent is licensed'. $1.00 per check.",
    inputSchema: {
      type: "object",
      properties: {
        patent_numbers: {
          type: "array",
          items: { type: "string" },
          description: "List of patent numbers to check (e.g., ['US10234567B2', 'EP3456789A1']).",
        },
        technology_area: {
          type: "string",
          description: "Optional: search for licenseable patents in this technology area instead of specific numbers.",
        },
        use_case: {
          type: "string",
          description: "Optional: describe your intended use case to get tailored licensing advice.",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$1.00", revenue_model: "70/30", multiverse: true },
  },

  // 14. LEONARDO VALUATION
  {
    name: "leonardo_valuation",
    description:
      "Estimate the value of a patent or patent portfolio. Uses market-based (comparable transactions) " +
      "and income-based (royalty stream DCF) methodologies. Returns: blended valuation estimate, " +
      "range (low/mid/high), per-patent averages, portfolio strength analysis, and comparable transactions. " +
      "Triggers: 'how much is this patent portfolio worth', 'value my patents', " +
      "'patent portfolio valuation for [company]', 'IP valuation estimate', 'what are these patents worth'. $5.00 per valuation.",
    inputSchema: {
      type: "object",
      properties: {
        assignee: {
          type: "string",
          description: "Company/assignee name to value all their patents in the database.",
        },
        patent_numbers: {
          type: "array",
          items: { type: "string" },
          description: "Specific patent numbers to value (e.g., ['US10234567B2']).",
        },
        technology_area: {
          type: "string",
          description: "Optional: technology area to estimate value for representative patents.",
        },
        valuation_date: {
          type: "string",
          description: "Valuation date (YYYY-MM-DD). Defaults to today.",
        },
        agent_id: {
          type: "string",
          description: "Optional: agent identifier.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "$5.00", revenue_model: "70/30", multiverse: true },
  },

  // 15. LEONARDO STATS
  {
    name: "leonardo_stats",
    description:
      "Leonardo IQ vertical metrics. Returns: total searches, analyses, revenue (with 70/30 split breakdown), " +
      "search type breakdown, patent database size. " +
      "Triggers: 'Leonardo IQ stats', 'IP intelligence metrics', 'how much has Leonardo processed'. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Optional: filter stats by agent.",
        },
      },
      required: [],
    },
    annotations: { vertical: "legal", provider: "LeonardoIQ", fee: "FREE", revenue_model: "70/30", multiverse: true },
  },
];

// ─── Combined Multiverse Tools Array ─────────────────────────────────────────

export const multiverseTools = [...atticusTools, ...leonardoTools];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMultiverseTool(name, args) {
  switch (name) {

    // ── AtticusIQ ──
    case "atticus_analyze":
      return await atticusAnalyze(args);

    case "atticus_compare":
      return await atticusCompare(args);

    case "atticus_portfolio_risk":
      return await atticusPortfolioRisk(args);

    case "atticus_compliance_check":
      return await atticusComplianceCheck(args);

    case "atticus_redline":
      return await atticusRedline(args);

    case "atticus_clause_library":
      return await atticusClauseLibrary(args);

    case "atticus_board_report":
      return await atticusBoardReport(args);

    case "atticus_stats":
      return await atticusStats(args);

    // ── Leonardo IQ ──
    case "leonardo_patent_search":
      return await leonardoPatentSearch(args);

    case "leonardo_prior_art":
      return await leonardoPriorArt(args);

    case "leonardo_freedom_to_operate":
      return await leonardoFreedomToOperate(args);

    case "leonardo_ip_landscape":
      return await leonardoIPLandscape(args);

    case "leonardo_license_check":
      return await leonardoLicenseCheck(args);

    case "leonardo_valuation":
      return await leonardoValuation(args);

    case "leonardo_stats":
      return await leonardoStats(args);

    default:
      throw new Error(`Unknown multiverse tool: ${name}`);
  }
}
