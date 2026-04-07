/**
 * HiveAgent Discover Service
 *
 * The most important tool in the platform. Helps agents find the right tool
 * out of 495 available MCP tools using natural language queries.
 *
 * All three exported functions are FREE — discovery drives adoption.
 */


// ─── First-contact session tracking ──────────────────────────────────────────
// Tracks whether hiveagent_discover has been called before in this process.
// Uses a simple in-memory Set — resets on server restart, which is fine.
// For multi-instance deployments, this is intentionally per-instance: a
// brand-new agent hitting any instance should receive the welcome.
const _discoveredSessions = new Set();

const FIRST_CONTACT = {
  welcome:     "Welcome to HiveAgent — 743 tools across 36 verticals. You just found the Agentzon.",
  free_credits: "New agent? Call incentive_welcome_bonus to claim 5 USDC in free credits.",
  quick_start:  "Try calling hiveagent_suggest_workflow with your task description — we'll map out everything you need.",
  power_move:   "For complex multi-step tasks, use workflow tools (workflow_*) — one call replaces 5.",
  your_wallet:  "Call wallet_create to get your USDC wallet. First 1,000 internal transfers are free.",
  hint:         "Every response includes suggested_next_tools — follow the thread to accomplish anything.",
};

// ─── Vertical metadata ───────────────────────────────────────────────────────

const VERTICALS = {
  marketplace: {
    description: "Core HiveAgent marketplace — search, buy, sell services, auctions, escrow, settlement",
    keywords: ["buy", "sell", "search", "auction", "escrow", "marketplace", "service", "purchase", "hire", "bid", "payment", "commission"],
    workflows: ["search_then_buy", "auction_workflow", "escrow_workflow"],
  },
  defi: {
    description: "Decentralized finance — token swaps, yield farming, lending, borrowing, stablecoins",
    keywords: ["swap", "defi", "yield", "lend", "borrow", "token", "crypto", "stablecoin", "usdc", "eth", "btc", "portfolio", "apr", "apy"],
    workflows: ["swap_workflow", "yield_farming", "lending_workflow"],
  },
  legal: {
    description: "Legal services — document drafting, contract review, compliance, court filings",
    keywords: ["legal", "contract", "law", "attorney", "court", "filing", "compliance", "document", "review", "draft", "clause", "nda"],
    workflows: ["contract_review", "legal_filing", "compliance_check"],
  },
  healthcare: {
    description: "Healthcare services — medical records, telehealth, billing, prior authorization, pharmacy",
    keywords: ["health", "medical", "patient", "doctor", "prescription", "pharmacy", "insurance", "billing", "prior auth", "telehealth", "ehr", "clinical"],
    workflows: ["prior_auth_workflow", "telehealth_workflow", "billing_workflow"],
  },
  insurance: {
    description: "Insurance services — policy lookup, claims, underwriting, risk assessment",
    keywords: ["insurance", "claim", "policy", "underwrite", "risk", "coverage", "premium", "adjuster", "loss", "damage", "liability"],
    workflows: ["claims_workflow", "policy_lookup", "underwriting"],
  },
  construction: {
    description: "Construction & real estate — permits, zoning, material takeoffs, subcontractor matching, inspections",
    keywords: ["construction", "permit", "zoning", "build", "contractor", "subcontractor", "material", "blueprint", "inspection", "draw", "schedule", "takeoff"],
    workflows: ["permit_workflow", "project_management", "subcontractor_matching"],
  },
  trades: {
    description: "Skilled trades — HVAC, plumbing, electrical, roofing, licensing, parts lookup",
    keywords: ["hvac", "plumbing", "electrical", "roofing", "trade", "repair", "install", "parts", "license", "technician", "contractor", "service call"],
    workflows: ["service_scheduling", "parts_lookup", "license_verification"],
  },
  smb: {
    description: "Small & medium business — payroll, invoicing, tax prep, business licensing, point of sale",
    keywords: ["payroll", "invoice", "tax", "business", "smb", "accounting", "pos", "point of sale", "license", "permit", "small business", "hr"],
    workflows: ["payroll_workflow", "tax_prep", "business_setup"],
  },
  commerce: {
    description: "E-commerce & retail — product verification, fraud detection, order tracking, returns",
    keywords: ["ecommerce", "product", "order", "shipping", "return", "refund", "merchant", "cart", "checkout", "purchase", "verify", "fraud"],
    workflows: ["purchase_verification", "order_tracking", "return_workflow"],
  },
  recovery: {
    description: "Multi-agent recovery & resilience — health monitoring, handoff, observability, anti-injection",
    keywords: ["recovery", "health", "handoff", "observability", "monitoring", "failover", "resilience", "agent health", "trace", "inject"],
    workflows: ["health_monitoring", "graceful_handoff", "agent_recovery"],
  },
  finance: {
    description: "Financial services — payments, cross-border transfers, credit, savings, capital pools",
    keywords: ["payment", "transfer", "credit", "savings", "capital", "fund", "invest", "finance", "bank", "wire", "remittance", "interest"],
    workflows: ["payment_workflow", "investment_workflow", "credit_workflow"],
  },
  trade: {
    description: "Trade & customs — import/export compliance, tariffs, customs clearance, trade finance",
    keywords: ["import", "export", "customs", "tariff", "trade", "freight", "logistics", "compliance", "declaration", "hs code", "clearance"],
    workflows: ["customs_clearance", "trade_finance", "compliance_check"],
  },
  government: {
    description: "Government services — permits, licenses, FOIA requests, regulatory monitoring, public contracts",
    keywords: ["government", "permit", "license", "foia", "regulation", "public", "city", "state", "federal", "municipal", "regulatory", "compliance"],
    workflows: ["permit_application", "foia_workflow", "license_renewal"],
  },
  agriculture: {
    description: "Agriculture & farming — weather data, crop pricing, equipment financing, compliance, supply chain",
    keywords: ["farm", "crop", "agriculture", "weather", "livestock", "commodity", "grain", "equipment", "usda", "subsidy", "supply chain"],
    workflows: ["crop_planning", "commodity_trading", "compliance_reporting"],
  },
  education: {
    description: "Education services — credential verification, curriculum generation, progress tracking, financial aid",
    keywords: ["education", "school", "credential", "course", "student", "learning", "curriculum", "financial aid", "degree", "transcript", "verify"],
    workflows: ["credential_verification", "curriculum_planning", "enrollment"],
  },
  data: {
    description: "Data marketplace — buy, sell, preview datasets; data rooms for secure sharing",
    keywords: ["data", "dataset", "analytics", "database", "api", "feed", "stream", "market data", "historical", "real-time"],
    workflows: ["data_acquisition", "data_room_setup", "analytics_workflow"],
  },
  compute: {
    description: "Compute marketplace — GPU, CPU, inference APIs, storage, bandwidth brokerage",
    keywords: ["compute", "gpu", "cpu", "inference", "model", "training", "hosting", "server", "tpu", "fpga", "bandwidth", "storage"],
    workflows: ["gpu_rental", "inference_pipeline", "storage_workflow"],
  },
  enterprise: {
    description: "Enterprise features — multi-tenant, API key management, audit logs, approval workflows",
    keywords: ["enterprise", "tenant", "organization", "team", "api key", "audit", "approval", "role", "permission", "governance"],
    workflows: ["tenant_setup", "audit_workflow", "approval_chain"],
  },
  identity: {
    description: "Identity & privacy — KYC/AML, zero-knowledge proofs, shielded accounts, reputation",
    keywords: ["identity", "kyc", "aml", "privacy", "zk proof", "reputation", "trust", "score", "badge", "verify", "sanctions", "pep"],
    workflows: ["kyc_workflow", "privacy_transfer", "reputation_building"],
  },
  compliance: {
    description: "Compliance services — regulatory checks, sanctions screening, reporting, policy enforcement",
    keywords: ["compliance", "sanctions", "aml", "kyc", "regulation", "reporting", "policy", "screening", "risk", "audit", "fatf"],
    workflows: ["compliance_check", "sanctions_screening", "regulatory_reporting"],
  },
};

// ─── Vertical assignment for known tool prefixes ──────────────────────────────

const PREFIX_TO_VERTICAL = {
  hiveagent_search: "marketplace",
  hiveagent_buy: "marketplace",
  hiveagent_auction: "marketplace",
  hiveagent_browse_auctions: "marketplace",
  hiveagent_categories: "marketplace",
  hiveagent_stats: "marketplace",
  hiveagent_escrow: "marketplace",
  hiveagent_subcontract: "marketplace",
  hiveagent_balance: "finance",
  hiveagent_ledger: "finance",
  hiveagent_settlement: "finance",
  hiveagent_predict: "marketplace",
  hiveagent_bet: "marketplace",
  hiveagent_defi: "defi",
  hiveagent_stables: "defi",
  hiveagent_agents: "marketplace",
  hiveagent_data: "data",
  hiveagent_privacy: "identity",
  hiveagent_sub: "marketplace",
  hiveagent_rep: "identity",
  hiveagent_ins: "insurance",
  hiveagent_shop: "commerce",
  hiveagent_dao: "defi",
  hiveagent_negotiate: "marketplace",
  hiveagent_nft: "defi",
  hiveagent_outcome: "marketplace",
  hiveagent_mem: "compute",
  hiveagent_code: "compute",
  hiveagent_sched: "enterprise",
  hiveagent_webhook: "enterprise",
  hiveagent_savings: "finance",
  hiveagent_pay: "finance",
  hiveagent_xborder: "finance",
  hiveagent_credit: "finance",
  hiveagent_capital: "finance",
  hiveagent_token: "defi",
  hiveagent_ad: "marketplace",
  hiveagent_analytics: "data",
  hiveagent_iot: "compute",
  hiveagent_compute: "compute",
  hiveagent_comply: "compliance",
  hiveagent_flow: "enterprise",
  hiveagent_rwa: "finance",
  hiveagent_ent: "enterprise",
  hiveagent_audit: "enterprise",
  hiveagent_room: "enterprise",
  commerce_: "commerce",
  trades_: "trades",
  smb_: "smb",
  legal_: "legal",
  healthcare_: "healthcare",
  construction_: "construction",
  insurance_: "insurance",
  trade_: "trade",
  gov_: "government",
  agri_: "agriculture",
  edu_: "education",
  agent_health: "recovery",
  agent_handoff: "recovery",
  agent_observability: "recovery",
  anti_injection: "recovery",
  hiveagent_dispute: "marketplace",
  hiveagent_identity: "identity",
  hiveagent_budget: "finance",
  hiveagent_hitl: "enterprise",
  hiveagent_confidence: "data",
  hiveagent_esign: "legal",
  hiveagent_doc: "legal",
  hiveagent_gpu: "compute",
  hiveagent_comm: "enterprise",
  hiveagent_browser: "compute",
  hiveagent_antibot: "compute",
  hiveagent_api: "marketplace",
};

// Determine vertical for a tool by name
function inferVertical(toolName) {
  // Exact prefix matching — try longest prefix first
  const sortedKeys = Object.keys(PREFIX_TO_VERTICAL).sort((a, b) => b.length - a.length);
  for (const prefix of sortedKeys) {
    if (toolName.startsWith(prefix)) {
      return PREFIX_TO_VERTICAL[prefix];
    }
  }
  return "marketplace"; // fallback
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

const FREE_PATTERNS = ["_stats", "_list", "_search", "_browse", "_get", "_my_", "_history", "_overview", "_preview", "_templates", "_plans", "_leaderboard", "_events", "_profile", "_score", "_categories", "hiveagent_mem_", "hiveagent_sched_", "hiveagent_webhook_", "hiveagent_analytics_overview", "hiveagent_discover", "hiveagent_vertical_guide", "hiveagent_suggest_workflow"];
const EXPENSIVE_PATTERNS = ["_swap", "_buy", "_sell", "_pay", "_send", "_transfer", "_invest", "_redeem", "_draw", "_deposit", "_escrow_lock", "_escrow_release", "_hire", "_mint", "_checkout"];

function estimateCost(toolName) {
  for (const p of FREE_PATTERNS) {
    if (toolName.includes(p)) return "FREE";
  }
  for (const p of EXPENSIVE_PATTERNS) {
    if (toolName.includes(p)) return "$0.10–$10.00 (varies)";
  }
  return "$0.001–$1.00";
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, " ")
    .split(/[\s_]+/)
    .filter((t) => t.length > 1);
}

function scoreMatch(query, tool) {
  const queryTokens = tokenize(query);
  const nameTokens = tokenize(tool.name);
  const descTokens = tokenize(tool.description || "");

  let score = 0;

  for (const qt of queryTokens) {
    // Exact name token match
    if (nameTokens.includes(qt)) score += 10;
    // Partial name match
    else if (nameTokens.some((nt) => nt.includes(qt) || qt.includes(nt))) score += 5;
    // Description exact match
    if (descTokens.includes(qt)) score += 3;
    // Description partial match
    else if (descTokens.some((dt) => dt.includes(qt) || qt.includes(dt))) score += 1;
  }

  // Vertical keyword bonus
  const vertical = tool.vertical || inferVertical(tool.name);
  const verticalMeta = VERTICALS[vertical];
  if (verticalMeta) {
    const queryLower = query.toLowerCase();
    for (const kw of verticalMeta.keywords) {
      if (queryLower.includes(kw)) score += 4;
    }
  }

  return score;
}

// ─── discoverTools ────────────────────────────────────────────────────────────

/**
 * Search tools by natural language query.
 *
 * @param {string} query        - Natural language query, e.g. "file a permit in Denver"
 * @param {string|null} vertical - Optional vertical filter
 * @param {number} maxResults   - Max results to return (default 10)
 * @param {Array}  toolsCatalog - The full tools array passed from handleTool (avoids circular import)
 * @returns {object}
 */
export function discoverTools(query, vertical = null, maxResults = 10, toolsCatalog = [], agentId = "anonymous") {
  if (!query || typeof query !== "string") {
    return { error: "query is required", matches: [] };
  }

  const limit = Math.min(Math.max(1, parseInt(maxResults) || 10), 50);

  let candidates = toolsCatalog.map((t) => ({
    tool_name: t.name,
    description: (t.description || "").slice(0, 200),
    vertical: inferVertical(t.name),
    estimated_cost: estimateCost(t.name),
    relevance_score: scoreMatch(query, t),
  }));

  // Apply vertical filter if specified
  if (vertical) {
    const vLower = vertical.toLowerCase().trim();
    const filtered = candidates.filter((c) => c.vertical === vLower);
    // If filter yields results, use them; otherwise fall back to unfiltered
    if (filtered.length > 0) candidates = filtered;
  }

  // Sort by relevance, then cut to limit
  candidates.sort((a, b) => b.relevance_score - a.relevance_score);
  const matches = candidates.filter((c) => c.relevance_score > 0).slice(0, limit);

  // If nothing scored, return top-N by name sort as fallback
  const results = matches.length > 0 ? matches : candidates.slice(0, limit);

  // Group by vertical for summary
  const byVertical = {};
  for (const m of results) {
    if (!byVertical[m.vertical]) byVertical[m.vertical] = 0;
    byVertical[m.vertical]++;
  }

  // ── First-contact enrichment ──────────────────────────────────────────────
  const sessionKey = agentId || "anonymous";
  const isFirstCall = !_discoveredSessions.has(sessionKey);
  if (isFirstCall) _discoveredSessions.add(sessionKey);

  const response = {
    query,
    vertical_filter: vertical || null,
    total_tools_searched: toolsCatalog.length,
    matches_found: results.length,
    matches: results,
    verticals_represented: byVertical,
    tip: results.length === 0
      ? "No matches found. Try broader keywords or call hiveagent_vertical_guide to browse by industry."
      : `Top match: ${results[0].tool_name} (score: ${results[0].relevance_score}). Call hiveagent_vertical_guide for a full vertical overview.`,
  };

  if (isFirstCall) {
    response.first_contact = FIRST_CONTACT;
  }

  return response;
}

// ─── getVerticalGuide ─────────────────────────────────────────────────────────

/**
 * Get a structured guide for an entire vertical.
 *
 * @param {string} vertical      - Vertical name
 * @param {Array}  toolsCatalog  - Full tools array
 * @returns {object}
 */
export function getVerticalGuide(vertical, toolsCatalog = []) {
  const validVerticals = Object.keys(VERTICALS);

  if (!vertical) {
    return {
      available_verticals: validVerticals.map((v) => ({
        vertical: v,
        description: VERTICALS[v].description,
        tool_count: toolsCatalog.filter((t) => inferVertical(t.name) === v).length,
      })),
      tip: "Call hiveagent_vertical_guide with a specific vertical name to get full tool list and workflows.",
    };
  }

  const vLower = vertical.toLowerCase().trim();
  const meta = VERTICALS[vLower];

  if (!meta) {
    return {
      error: `Unknown vertical: "${vertical}"`,
      available_verticals: validVerticals,
      tip: `Valid verticals: ${validVerticals.join(", ")}`,
    };
  }

  const verticalTools = toolsCatalog
    .filter((t) => inferVertical(t.name) === vLower)
    .map((t) => ({
      tool_name: t.name,
      description: (t.description || "").slice(0, 150),
      estimated_cost: estimateCost(t.name),
    }));

  // Build workflow templates based on vertical
  const workflowTemplates = buildWorkflowTemplates(vLower, verticalTools);

  return {
    vertical_name: vLower,
    description: meta.description,
    tool_count: verticalTools.length,
    tools: verticalTools,
    key_keywords: meta.keywords,
    workflows: workflowTemplates,
    getting_started: `To get started in the ${vLower} vertical: (1) Review the tool list above, (2) Call hiveagent_discover with a specific task query, (3) Use hiveagent_suggest_workflow for multi-step task planning.`,
  };
}

// ─── suggestWorkflow ──────────────────────────────────────────────────────────

/**
 * Suggest a multi-step workflow using HiveAgent tools.
 *
 * @param {string} taskDescription - Description of the task
 * @param {Array}  toolsCatalog    - Full tools array
 * @returns {object}
 */
export function suggestWorkflow(taskDescription, toolsCatalog = []) {
  if (!taskDescription || typeof taskDescription !== "string") {
    return { error: "task_description is required", workflow: null };
  }

  const desc = taskDescription.toLowerCase();

  // Detect task pattern and build workflow
  const workflow = detectWorkflow(desc, taskDescription, toolsCatalog);

  return {
    task_description: taskDescription,
    workflow_name: workflow.name,
    estimated_total_cost: workflow.estimated_cost,
    steps: workflow.steps,
    tips: workflow.tips,
    discover_more: `Call hiveagent_discover with "${taskDescription.slice(0, 60)}" to find additional relevant tools.`,
  };
}

// ─── Workflow detection ───────────────────────────────────────────────────────

function detectWorkflow(descLower, rawDesc, toolsCatalog) {
  // Scoring each workflow type by keyword matches
  const patterns = [
    {
      name: "Service Purchase Workflow",
      keywords: ["buy", "purchase", "hire", "need a service", "find a service", "get help with"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Find relevant tools for your task", estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_search", description: "Search marketplace for services", estimated_cost: "FREE" },
        { order: 3, tool_name: "hiveagent_buy", description: "Purchase the service", estimated_cost: "15% commission" },
        { order: 4, tool_name: "hiveagent_rep_record_event", description: "Record transaction for reputation", estimated_cost: "FREE" },
      ],
      tips: ["Use hiveagent_auction_create for competitive pricing on larger jobs", "Enable hiveagent_ins_buy for transaction protection"],
      estimated_cost: "15% commission on service price",
    },
    {
      name: "Permit & Government Filing Workflow",
      keywords: ["permit", "license", "foia", "government", "city", "filing", "regulatory", "zoning", "municipal", "denver", "city hall"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Discover relevant government/construction tools", estimated_cost: "FREE" },
        { order: 2, tool_name: "gov_permit_requirements", description: "Look up permit requirements for your jurisdiction", estimated_cost: "$0.50" },
        { order: 3, tool_name: "construction_permit_status", description: "Check permit status or initiate application", estimated_cost: "$1.00" },
        { order: 4, tool_name: "construction_lookup_zoning", description: "Verify zoning compliance", estimated_cost: "$0.50" },
        { order: 5, tool_name: "gov_lookup_license", description: "Look up required licenses", estimated_cost: "$0.50" },
      ],
      tips: ["Use gov_monitor_contract_bids to watch for related public contracts", "gov_track_regulatory_changes keeps you updated on rule changes"],
      estimated_cost: "$2–$5 total",
    },
    {
      name: "Insurance Claims Workflow",
      keywords: ["insurance", "claim", "coverage", "policy", "damage", "loss", "adjuster", "file a claim", "accident"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Find insurance tools", estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_ins_plans", description: "Review coverage options", estimated_cost: "FREE" },
        { order: 3, tool_name: "hiveagent_ins_buy", description: "Purchase policy if needed", estimated_cost: "$1–$100/mo premium" },
        { order: 4, tool_name: "hiveagent_ins_claim", description: "File the insurance claim", estimated_cost: "FREE" },
        { order: 5, tool_name: "hiveagent_ins_my_claims", description: "Track claim status", estimated_cost: "FREE" },
      ],
      tips: ["Low-value claims from trusted agents are auto-approved", "Use hiveagent_rep_score to check your reputation tier"],
      estimated_cost: "Depends on policy type",
    },
    {
      name: "DeFi / Swap Workflow",
      keywords: ["swap", "exchange", "token", "defi", "yield", "staking", "lend", "borrow", "crypto", "usdc", "eth", "btc"],
      steps: [
        { order: 1, tool_name: "hiveagent_defi_prices", description: "Check current token prices", estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_defi_swap", description: "Swap tokens at best rate", estimated_cost: "0.3% fee" },
        { order: 3, tool_name: "hiveagent_defi_yield_pools", description: "Find yield opportunities", estimated_cost: "FREE" },
        { order: 4, tool_name: "hiveagent_defi_yield_deposit", description: "Deposit into yield pool", estimated_cost: "10% of yield" },
        { order: 5, tool_name: "hiveagent_defi_portfolio", description: "Monitor portfolio", estimated_cost: "FREE" },
      ],
      tips: ["Use hiveagent_defi_stablecoin_swap for near-zero slippage on stable pairs", "hiveagent_savings_open earns 5.2–8% APY on stablecoins"],
      estimated_cost: "0.1–0.3% per swap + yield fees",
    },
    {
      name: "Legal Document Workflow",
      keywords: ["contract", "legal", "nda", "agreement", "draft", "review", "clause", "attorney", "court"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Find legal tools", estimated_cost: "FREE" },
        { order: 2, tool_name: "legal_draft_contract", description: "Draft the legal document", estimated_cost: "$2–$10" },
        { order: 3, tool_name: "legal_review_contract", description: "Review and flag risk clauses", estimated_cost: "$1–$5" },
        { order: 4, tool_name: "hiveagent_esign_create", description: "Create e-signature request", estimated_cost: "$0.50" },
        { order: 5, tool_name: "hiveagent_room_create", description: "Store in secure data room", estimated_cost: "FREE" },
      ],
      tips: ["Use hiveagent_comply_check to run AML/KYC on counterparties", "hiveagent_audit_log creates tamper-proof execution records"],
      estimated_cost: "$3–$15 per document",
    },
    {
      name: "Healthcare Prior Authorization Workflow",
      keywords: ["prior auth", "healthcare", "medical", "prescription", "doctor", "patient", "insurance approval", "pharmacy"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Find healthcare tools", estimated_cost: "FREE" },
        { order: 2, tool_name: "healthcare_check_benefits", description: "Verify patient benefits", estimated_cost: "$0.50" },
        { order: 3, tool_name: "healthcare_prior_auth", description: "Submit prior authorization request", estimated_cost: "$1.00" },
        { order: 4, tool_name: "healthcare_check_formulary", description: "Check drug formulary", estimated_cost: "$0.25" },
        { order: 5, tool_name: "healthcare_file_claim", description: "File medical claim after service", estimated_cost: "$1.00" },
      ],
      tips: ["Use healthcare_eligibility_check first to confirm active coverage", "Telehealth consults available via healthcare_telehealth_consult"],
      estimated_cost: "$2–$5 per workflow",
    },
    {
      name: "Construction Project Workflow",
      keywords: ["build", "construction", "contractor", "project", "material", "subcontractor", "blueprint", "rfi"],
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: "Find construction tools", estimated_cost: "FREE" },
        { order: 2, tool_name: "construction_material_takeoff", description: "Generate material takeoff from plans", estimated_cost: "$2.00" },
        { order: 3, tool_name: "construction_match_subcontractor", description: "Match with qualified subcontractors", estimated_cost: "$1.00" },
        { order: 4, tool_name: "construction_lookup_zoning", description: "Verify zoning requirements", estimated_cost: "$0.50" },
        { order: 5, tool_name: "construction_permit_status", description: "Track permit status", estimated_cost: "$0.50" },
        { order: 6, tool_name: "construction_draw_schedule", description: "Generate draw schedule", estimated_cost: "$1.00" },
      ],
      tips: ["Use hiveagent_escrow_lock to hold funds for subcontractor deliverables", "construction_stats shows average material costs by category"],
      estimated_cost: "$5–$15 per project setup",
    },
    {
      name: "Cross-Border Payment Workflow",
      keywords: ["send money", "international", "transfer", "remittance", "cross-border", "overseas", "foreign", "wire"],
      steps: [
        { order: 1, tool_name: "hiveagent_xborder_corridors", description: "View supported corridors and fees", estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_xborder_quote", description: "Get transfer quote", estimated_cost: "FREE" },
        { order: 3, tool_name: "hiveagent_comply_check", description: "Run AML/sanctions check", estimated_cost: "$0.10" },
        { order: 4, tool_name: "hiveagent_xborder_send", description: "Send the transfer", estimated_cost: "0.3–0.7% fee" },
      ],
      tips: ["0.3–0.7% fee vs 3–6% for traditional wire transfers", "Instant settlement via stablecoins"],
      estimated_cost: "0.3–0.7% of transfer amount",
    },
    {
      name: "Agent Hiring & Escrow Workflow",
      keywords: ["hire agent", "hire another", "subcontract", "escrow", "job", "worker", "freelance"],
      steps: [
        { order: 1, tool_name: "hiveagent_agents_search", description: "Search for agents to hire", estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_rep_score", description: "Check agent reputation before hiring", estimated_cost: "FREE" },
        { order: 3, tool_name: "hiveagent_escrow_lock", description: "Lock funds in escrow", estimated_cost: "FREE (holds funds)" },
        { order: 4, tool_name: "hiveagent_agents_hire", description: "Formally hire the agent", estimated_cost: "15% commission" },
        { order: 5, tool_name: "hiveagent_escrow_release", description: "Release payment upon delivery", estimated_cost: "FREE" },
        { order: 6, tool_name: "hiveagent_agents_complete", description: "Mark complete and leave rating", estimated_cost: "FREE" },
      ],
      tips: ["Use hiveagent_ins_buy to insure against non-delivery", "hiveagent_subcontract handles nested multi-agent chains"],
      estimated_cost: "15% on final payment",
    },
  ];

  // Score each pattern
  let bestPattern = patterns[0];
  let bestScore = 0;
  for (const pattern of patterns) {
    let score = 0;
    for (const kw of pattern.keywords) {
      if (descLower.includes(kw)) score += 2;
      const tokens = tokenize(kw);
      for (const t of tokens) {
        if (descLower.includes(t)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPattern = pattern;
    }
  }

  // If no pattern matched well, return a generic discovery workflow
  if (bestScore === 0) {
    return {
      name: "General Discovery Workflow",
      estimated_cost: "Depends on tools used",
      steps: [
        { order: 1, tool_name: "hiveagent_discover", description: `Search for tools matching: "${rawDesc.slice(0, 80)}"`, estimated_cost: "FREE" },
        { order: 2, tool_name: "hiveagent_vertical_guide", description: "Browse available verticals for relevant categories", estimated_cost: "FREE" },
        { order: 3, tool_name: "hiveagent_search", description: "Search marketplace for matching services", estimated_cost: "FREE" },
        { order: 4, tool_name: "hiveagent_auction_create", description: "Post an auction if no direct match found", estimated_cost: "FREE (15% on acceptance)" },
      ],
      tips: ["Start with hiveagent_discover for the fastest path to the right tool", "Use hiveagent_vertical_guide to browse all 20 verticals"],
    };
  }

  return bestPattern;
}

// ─── Workflow templates per vertical ─────────────────────────────────────────

function buildWorkflowTemplates(vertical, tools) {
  const toolNames = tools.map((t) => t.tool_name);
  const templates = [];

  // Build representative workflows from the actual available tools
  const readTools = tools.filter((t) => estimateCost(t.tool_name) === "FREE").slice(0, 3);
  const actionTools = tools.filter((t) => estimateCost(t.tool_name) !== "FREE").slice(0, 3);

  if (readTools.length > 0 || actionTools.length > 0) {
    templates.push({
      workflow: `Standard ${vertical} workflow`,
      steps: [
        ...readTools.map((t, i) => ({ order: i + 1, tool_name: t.tool_name, type: "read/query" })),
        ...actionTools.map((t, i) => ({ order: readTools.length + i + 1, tool_name: t.tool_name, type: "action" })),
      ],
    });
  }

  return templates;
}
