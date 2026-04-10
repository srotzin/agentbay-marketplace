/**
 * HiveAgent Dynamic Tool Loader
 *
 * Solving the biggest token-efficiency problem: loading 610 tools into every
 * session wastes context. This module enables vertical-filtered loading so
 * agents start with the 5 essential meta-tools and progressively load only
 * what they need.
 *
 * Usage patterns:
 *   1. Bootstrap  → getMinimalToolset() → 5 tools, discover from there
 *   2. Vertical   → getToolsForVertical("insurance") → ~30 tools
 *   3. Intent     → getToolsForIntent("process insurance claims") → ranked tools
 *   4. Negotiate  → negotiateTools(agentId, caps, ctx) → curated toolset
 */

// Lazy import to avoid circular dependency
let tools = [];
setTimeout(async () => {
  try {
    const mod = await import("../mcp-tools.js");
    tools = mod.tools;
  } catch (e) { console.warn("[dynamic-loader] deferred tools load:", e.message); }
}, 0);

// ─── Vertical → Tool Prefix Mapping ─────────────────────────────────────────
//
// Each vertical maps to an array of tool name prefixes. A tool is included
// if its name starts with any of the listed prefixes.

const VERTICAL_PREFIXES = {
  marketplace: [
    "hiveagent_search",
    "hiveagent_buy",
    "hiveagent_categories",
    "hiveagent_stats",
    "hiveagent_balance",
    "hiveagent_ledger",
    "hiveagent_escrow",
    "hiveagent_auction",
    "hiveagent_browse",
    "hiveagent_subcontract",
    "hiveagent_negotiate",
    "hiveagent_settlement",
    "hiveagent_discover",
    "hiveagent_vertical_guide",
    "hiveagent_suggest_workflow",
    "intent_route",
    "wallet_balance",
  ],
  defi: [
    "hiveagent_defi",
    "hiveagent_savings",
    "hiveagent_stables",
    "hiveagent_rwa",
    "hiveagent_token",
    "hiveagent_nft",
    "hiveagent_capital",
    "hiveagent_credit",
    "hiveagent_dao",
    "zkvault",
    "wallet_",
    "hiveagent_privacy",
    "hiveagent_predict",
    "hiveagent_bet",
    "hiveagent_outcome",
  ],
  legal: [
    "legal_",
    "esig_",
    "doc_",
    "dispute_",
    "hiveagent_room",
    "hiveagent_audit",
    "hiveagent_comply",
    "proof_",
  ],
  healthcare: [
    "health_",
    "hitl_",
    "hiveagent_ins",
    "doc_",
  ],
  insurance: [
    "insurance_",
    "hiveagent_ins",
    "fraud_",
    "doc_",
    "hiveagent_comply",
    "sla_",
  ],
  construction: [
    "construction_",
    "realestate_",
    "project_",
    "logistics_",
    "hiveagent_comply",
    "doc_",
    "esig_",
  ],
  trades: [
    "trades_",
    "project_",
    "hiveagent_pay",
    "invoice_",
    "smb_",
    "doc_",
  ],
  smb: [
    "smb_",
    "invoice_",
    "hiveagent_pay",
    "hiveagent_sub",
    "hr_",
    "sales_",
    "esig_",
    "doc_",
    "procurement_",
  ],
  finance: [
    "hiveagent_credit",
    "hiveagent_capital",
    "hiveagent_savings",
    "hiveagent_stables",
    "hiveagent_defi",
    "hiveagent_rwa",
    "hiveagent_xborder",
    "invoice_",
    "vcard_",
    "wallet_",
    "fraud_",
    "hiveagent_pay",
    "hiveagent_analytics",
  ],
  trade: [
    "trade_",
    "supply_",
    "logistics_",
    "hiveagent_xborder",
    "procurement_",
    "doc_",
  ],
  agriculture: [
    "ag_",
    "supply_",
    "hiveagent_pay",
    "invoice_",
    "hiveagent_ins",
    "doc_",
  ],
  education: [
    "edu_",
    "knowledge_",
    "hitl_",
    "doc_",
    "hiveagent_pay",
  ],
  data: [
    "hiveagent_data",
    "hiveagent_analytics",
    "hiveagent_mem",
    "memory_",
    "schema_",
    "oracle_",
    "hiveagent_compute",
  ],
  compute: [
    "hiveagent_compute",
    "gpu_",
    "sandbox_",
    "hiveagent_code",
    "hiveagent_sched",
    "budget_",
  ],
  enterprise: [
    "hiveagent_ent",
    "hiveagent_audit",
    "hiveagent_room",
    "hiveagent_comply",
    "hiveagent_flow",
    "hiveagent_analytics",
    "procurement_",
    "hr_",
    "identity_",
    "kya_",
    "budget_",
  ],
  identity: [
    "identity_",
    "kya_",
    "hiveagent_rep",
    "reputation_",
    "hiveagent_comply",
    "fraud_",
  ],
  compliance: [
    "hiveagent_comply",
    "hiveagent_audit",
    "kya_",
    "identity_",
    "fraud_",
    "legal_check",
    "trade_screen",
    "trade_check",
    "platform_check",
  ],
  government: [
    "gov_",
    "legal_",
    "esig_",
    "doc_",
    "hiveagent_comply",
  ],
  commerce: [
    "commerce_",
    "hiveagent_shop",
    "hiveagent_pay",
    "hiveagent_sub",
    "hiveagent_ad",
    "paywall_",
    "pricing_",
    "logistics_",
  ],
  recovery: [
    "recovery_",
    "redteam_",
    "anti_injection",
    "platform_health",
    "platform_audit",
  ],
  security: [
    "anti_injection",
    "antibot_",
    "redteam_",
    "fraud_",
    "hiveagent_privacy",
    "zkvault",
    "kya_",
    "hiveagent_audit",
    "recovery_",
  ],
  workflow: [
    "workflow_",
    "hiveagent_flow",
    "hiveagent_sched",
    "hiveagent_webhook",
    "project_",
    "hiveagent_suggest_workflow",
  ],
};

// ─── Intent → Keyword → Vertical/Prefix Mapping ──────────────────────────────

const INTENT_KEYWORDS = [
  // Insurance
  { keywords: ["insurance", "claim", "policy", "underwrite", "coverage", "premium", "adjuster", "loss", "damage", "liability", "insure"], prefixes: ["insurance_", "hiveagent_ins", "fraud_", "sla_", "doc_"] },
  // DeFi / Crypto
  { keywords: ["swap", "defi", "yield", "lend", "borrow", "token", "crypto", "stablecoin", "usdc", "eth", "btc", "portfolio", "apr", "apy", "farm"], prefixes: ["hiveagent_defi", "hiveagent_stables", "hiveagent_savings", "wallet_", "hiveagent_capital"] },
  // Wallet / Payments
  { keywords: ["pay", "payment", "send", "transfer", "wallet", "fund", "balance", "invoice", "invoice", "bill", "charge"], prefixes: ["wallet_", "hiveagent_pay", "invoice_", "hiveagent_xborder", "vcard_"] },
  // Legal / Contracts
  { keywords: ["legal", "contract", "law", "attorney", "court", "filing", "compliance", "nda", "clause", "draft", "sign", "document", "agreement"], prefixes: ["legal_", "esig_", "doc_", "hiveagent_comply", "hiveagent_room"] },
  // Healthcare
  { keywords: ["health", "medical", "patient", "doctor", "prescription", "pharmacy", "billing", "prior auth", "telehealth", "ehr", "clinical", "lab"], prefixes: ["health_", "doc_", "hiveagent_ins"] },
  // Construction
  { keywords: ["construction", "permit", "zoning", "build", "contractor", "subcontractor", "material", "blueprint", "inspection", "takeoff", "draw"], prefixes: ["construction_", "project_", "realestate_", "doc_", "esig_"] },
  // Trades
  { keywords: ["hvac", "plumbing", "electrical", "roofing", "trade", "repair", "install", "parts", "license", "technician", "service call"], prefixes: ["trades_", "project_", "hiveagent_pay", "invoice_"] },
  // SMB
  { keywords: ["payroll", "tax", "business", "smb", "accounting", "pos", "small business", "hr", "employee", "hire", "recruit"], prefixes: ["smb_", "invoice_", "hr_", "esig_", "procurement_"] },
  // Marketplace
  { keywords: ["buy", "sell", "search", "auction", "escrow", "marketplace", "service", "purchase", "hire", "bid"], prefixes: ["hiveagent_search", "hiveagent_buy", "hiveagent_escrow", "hiveagent_auction", "hiveagent_negotiate"] },
  // Agriculture
  { keywords: ["crop", "farm", "soil", "harvest", "yield", "agriculture", "livestock", "irrigation", "fertilizer", "commodity"], prefixes: ["ag_", "supply_", "hiveagent_ins"] },
  // Education
  { keywords: ["education", "course", "curriculum", "student", "learn", "credential", "verify degree", "training", "skill"], prefixes: ["edu_", "knowledge_"] },
  // Data / Analytics
  { keywords: ["data", "analytics", "insight", "dataset", "query", "analysis", "reporting", "metrics", "stats", "trend"], prefixes: ["hiveagent_data", "hiveagent_analytics", "schema_", "oracle_"] },
  // Compute / GPU
  { keywords: ["compute", "gpu", "inference", "model", "run code", "sandbox", "llm", "ai inference", "batch"], prefixes: ["hiveagent_compute", "gpu_", "sandbox_"] },
  // Memory
  { keywords: ["memory", "remember", "store", "recall", "learn preference", "history", "profile"], prefixes: ["hiveagent_mem", "memory_"] },
  // Fraud / Security
  { keywords: ["fraud", "scam", "detect", "anomaly", "chargeback", "identity theft", "suspicious", "security", "threat", "injection"], prefixes: ["fraud_", "anti_injection", "antibot_", "kya_", "redteam_"] },
  // Real Estate
  { keywords: ["real estate", "property", "mortgage", "title", "appraisal", "comps", "neighborhood", "house", "apartment"], prefixes: ["realestate_", "construction_", "doc_"] },
  // Supply Chain / Trade
  { keywords: ["supply chain", "shipment", "customs", "duty", "export", "import", "freight", "supplier", "procurement", "rfq"], prefixes: ["supply_", "trade_", "logistics_", "procurement_"] },
  // Reputation
  { keywords: ["reputation", "trust", "review", "rating", "score", "verify", "badge"], prefixes: ["hiveagent_rep", "reputation_", "identity_", "kya_"] },
  // NFT / Tokenization
  { keywords: ["nft", "mint", "token", "tokenize", "fractional", "rwa", "asset"], prefixes: ["hiveagent_nft", "hiveagent_token", "hiveagent_rwa"] },
  // Scheduling / Webhooks
  { keywords: ["schedule", "cron", "webhook", "trigger", "automate", "notify", "alert"], prefixes: ["hiveagent_sched", "hiveagent_webhook"] },
  // Enterprise
  { keywords: ["enterprise", "tenant", "organization", "team", "api key", "role", "permission", "saas"], prefixes: ["hiveagent_ent", "hiveagent_audit", "budget_", "identity_"] },
  // Predictions / Betting
  { keywords: ["predict", "bet", "market", "odds", "wager", "sports", "outcome"], prefixes: ["hiveagent_predict", "hiveagent_bet", "hiveagent_outcome"] },
  // Privacy / ZK
  { keywords: ["privacy", "shielded", "anonymous", "stealth", "zero knowledge", "zk", "vault"], prefixes: ["hiveagent_privacy", "zkvault"] },
  // Orchestration / Workflows
  { keywords: ["workflow", "orchestrate", "multi-agent", "handoff", "pipeline", "flow", "team agent"], prefixes: ["hiveagent_flow", "workflow_", "hiveagent_sched"] },
  // Cross-border
  { keywords: ["cross-border", "international", "remittance", "fx", "foreign exchange", "corridor", "send money"], prefixes: ["hiveagent_xborder"] },
  // Communication
  { keywords: ["message", "communicate", "notify", "call", "voice", "sms", "email"], prefixes: ["comms_", "voice_"] },
  // Government
  { keywords: ["government", "foia", "permit", "license", "regulation", "public record", "filing"], prefixes: ["gov_", "legal_", "esig_"] },
];

// ─── Agent Type → Toolset Presets ───────────────────────────────────────────

const AGENT_PRESETS = {
  finance: {
    prefixes: ["wallet_", "hiveagent_defi", "hiveagent_capital", "hiveagent_credit", "hiveagent_savings", "hiveagent_stables", "invoice_", "hiveagent_pay", "fraud_", "hiveagent_xborder", "vcard_", "hiveagent_analytics"],
    workflows: ["defi-portfolio-setup", "payment_flow", "cross_border_transfer"],
    onboarding: "Start with wallet_balance to check funds, then hiveagent_defi_prices for market data, then hiveagent_defi_swap or hiveagent_capital_invest for deployment.",
  },
  insurance: {
    prefixes: ["insurance_", "hiveagent_ins", "fraud_", "doc_", "sla_", "hiveagent_comply", "esig_"],
    workflows: ["full_insurance_claim", "policy_lookup", "underwriting"],
    onboarding: "Start with insurance_claim_intake for new claims, insurance_assess_damage for damage assessment, fraud_screen_transaction to check for fraud.",
  },
  legal: {
    prefixes: ["legal_", "esig_", "doc_", "dispute_", "hiveagent_room", "hiveagent_audit", "hiveagent_comply", "proof_"],
    workflows: ["legal_case_setup", "contract_review", "compliance_check"],
    onboarding: "Start with legal_intake_case or legal_get_requirements. Use doc_extract for document analysis and esig_ for signatures.",
  },
  research: {
    prefixes: ["hiveagent_data", "hiveagent_analytics", "knowledge_", "oracle_", "hiveagent_search", "hiveagent_mem", "memory_", "hiveagent_discover", "paywall_"],
    workflows: ["data_pipeline", "market_research"],
    onboarding: "Start with hiveagent_search or hiveagent_data_search to find data. Use knowledge_query for structured knowledge and oracle_query_confidence for probabilistic answers.",
  },
  trading: {
    prefixes: ["hiveagent_defi", "hiveagent_stables", "hiveagent_predict", "hiveagent_bet", "hiveagent_nft", "hiveagent_token", "hiveagent_rwa", "wallet_", "hiveagent_capital"],
    workflows: ["defi-portfolio-setup", "prediction_market"],
    onboarding: "Start with hiveagent_defi_prices for prices, hiveagent_defi_swap for token swaps, hiveagent_predict_markets for prediction opportunities.",
  },
  construction: {
    prefixes: ["construction_", "project_", "realestate_", "logistics_", "hiveagent_comply", "doc_", "esig_", "hiveagent_pay", "invoice_"],
    workflows: ["construction_project", "permit_workflow"],
    onboarding: "Start with construction_permit_status for permit checks, construction_material_takeoff for cost estimation, project_create to manage the project.",
  },
  healthcare: {
    prefixes: ["health_", "hiveagent_ins", "doc_", "hitl_", "hiveagent_comply", "esig_"],
    workflows: ["healthcare_encounter", "prior_auth_workflow"],
    onboarding: "Start with health_prior_auth for authorizations, health_claim_codes for billing codes, health_clinical_note for documentation.",
  },
  smb: {
    prefixes: ["smb_", "invoice_", "hiveagent_pay", "hiveagent_sub", "hr_", "sales_", "esig_", "doc_", "procurement_", "hiveagent_shop"],
    workflows: ["small_business_setup", "full_sales_cycle"],
    onboarding: "Start with smb_dashboard for an overview. Use invoice_extract_data for AP automation, hr_match_candidates for hiring, sales_score_lead for pipeline.",
  },
  security: {
    prefixes: ["anti_injection", "antibot_", "fraud_", "redteam_", "kya_", "hiveagent_comply", "hiveagent_audit", "recovery_", "hiveagent_privacy", "zkvault"],
    workflows: ["full_fraud_check", "security_audit"],
    onboarding: "Start with fraud_screen_transaction for real-time screening, anti_injection_scan for prompt safety, kya_verify_agent for agent identity.",
  },
  orchestrator: {
    prefixes: ["hiveagent_flow", "workflow_", "hiveagent_sched", "hiveagent_webhook", "project_", "hiveagent_discover", "hiveagent_suggest_workflow", "intent_route", "hiveagent_agents"],
    workflows: ["agent-for-hire-onboarding", "workflow_orchestration"],
    onboarding: "Start with hiveagent_flow_create to create a workflow, hiveagent_flow_team to assemble agents, then hiveagent_flow_start to begin execution.",
  },
  commerce: {
    prefixes: ["commerce_", "hiveagent_shop", "hiveagent_pay", "hiveagent_sub", "hiveagent_ad", "paywall_", "pricing_", "logistics_", "hiveagent_negotiate"],
    workflows: ["commerce_transaction", "marketplace-quickstart"],
    onboarding: "Start with hiveagent_shop_search_products to find products, commerce_verify_product for trust, hiveagent_shop_add_to_cart and hiveagent_shop_checkout to purchase.",
  },
};

// ─── Minimal Bootstrap Toolset ───────────────────────────────────────────────

const MINIMAL_TOOL_NAMES = [
  "hiveagent_discover",
  "hiveagent_vertical_guide",
  "hiveagent_suggest_workflow",
  "intent_route",
  "wallet_balance",
];

// ─── Helper: Filter tools by prefix list ────────────────────────────────────

function filterByPrefixes(prefixes) {
  const seen = new Set();
  const result = [];
  for (const tool of tools) {
    if (seen.has(tool.name)) continue;
    if (prefixes.some((prefix) => tool.name.startsWith(prefix))) {
      seen.add(tool.name);
      result.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
  }
  return result;
}

// ─── Helper: Score a tool against keyword matches ───────────────────────────

function scoreToolAgainstIntent(tool, intentLower) {
  let score = 0;
  const text = `${tool.name} ${tool.description || ""}`.toLowerCase();

  // Exact name fragment match gets high score
  const words = intentLower.split(/\s+/).filter((w) => w.length > 3);
  for (const word of words) {
    if (text.includes(word)) score += 3;
  }

  // Boost discovery tools slightly so they always surface
  if (["hiveagent_discover", "hiveagent_vertical_guide", "intent_route"].includes(tool.name)) {
    score += 1;
  }

  return score;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * getToolsForVertical(vertical)
 *
 * Return only tools for a specific vertical. A "insurance" call returns ~30
 * insurance-related tools instead of all 610.
 *
 * @param {string} vertical  One of the 20 supported verticals
 * @returns {{ tools: Array, vertical: string, count: number, note: string }}
 */
export function getToolsForVertical(vertical) {
  const key = vertical?.toLowerCase?.() ?? "";
  const prefixes = VERTICAL_PREFIXES[key];

  if (!prefixes) {
    const available = Object.keys(VERTICAL_PREFIXES).sort().join(", ");
    return {
      tools: [],
      vertical: key,
      count: 0,
      error: `Unknown vertical: "${key}". Available: ${available}`,
    };
  }

  // Always include the core meta-tools
  const allPrefixes = [...new Set([...prefixes, ...MINIMAL_TOOL_NAMES.map((n) => n)])];
  const filtered = filterByPrefixes(allPrefixes);

  // Also ensure the 5 minimal tools are always present
  const names = new Set(filtered.map((t) => t.name));
  for (const minName of MINIMAL_TOOL_NAMES) {
    if (!names.has(minName)) {
      const found = tools.find((t) => t.name === minName);
      if (found) {
        filtered.unshift({ name: found.name, description: found.description, inputSchema: found.inputSchema });
      }
    }
  }

  return {
    tools: filtered,
    vertical: key,
    count: filtered.length,
    note: `Loaded ${filtered.length} tools for vertical "${key}" (vs ${tools.length} total). Use hiveagent_discover for broader search.`,
  };
}

/**
 * getToolsForIntent(intent)
 *
 * Natural language intent → relevant tools ranked by relevance.
 * "I need to process insurance claims" returns insurance + fraud tools.
 *
 * @param {string} intent  Natural language description
 * @returns {{ tools: Array, matched_verticals: string[], count: number }}
 */
export function getToolsForIntent(intent) {
  if (!intent || typeof intent !== "string") {
    return { tools: [], matched_verticals: [], count: 0, error: "Intent must be a non-empty string" };
  }

  const intentLower = intent.toLowerCase();

  // Phase 1: find matching keyword groups
  const matchedPrefixes = new Set();
  const matchedVerticals = [];

  for (const group of INTENT_KEYWORDS) {
    const matched = group.keywords.some((kw) => intentLower.includes(kw));
    if (matched) {
      matchedVerticals.push(group.keywords[0]); // representative keyword
      for (const p of group.prefixes) matchedPrefixes.add(p);
    }
  }

  // Phase 2: always add discovery meta-tools
  for (const name of MINIMAL_TOOL_NAMES) matchedPrefixes.add(name);

  // Phase 3: collect candidate tools
  let candidates = matchedPrefixes.size > 0
    ? filterByPrefixes([...matchedPrefixes])
    : tools.slice(0, 50); // fallback: first 50

  // Phase 4: score and rank
  candidates = candidates
    .map((tool) => ({ ...tool, _score: scoreToolAgainstIntent(tool, intentLower) }))
    .filter((t) => t._score > 0)
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...tool }) => tool);

  // If nothing scored, return the raw prefix matches
  if (candidates.length === 0) {
    candidates = filterByPrefixes([...matchedPrefixes]);
  }

  return {
    tools: candidates,
    matched_verticals: [...new Set(matchedVerticals)],
    count: candidates.length,
    note: `Found ${candidates.length} relevant tools for intent: "${intent}". Tools ranked by relevance.`,
  };
}

/**
 * getMinimalToolset()
 *
 * Return the 5 essential bootstrap tools agents start with.
 * From these, agents can discover everything else via hiveagent_discover,
 * hiveagent_vertical_guide, and intent_route.
 *
 * @returns {{ tools: Array, count: number, note: string }}
 */
export function getMinimalToolset() {
  const minimal = MINIMAL_TOOL_NAMES
    .map((name) => tools.find((t) => t.name === name))
    .filter(Boolean)
    .map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

  return {
    tools: minimal,
    count: minimal.length,
    note: "Bootstrap toolset: 5 meta-tools that unlock everything else. Call hiveagent_discover with your intent to find the right tools, or hiveagent_vertical_guide to browse by industry.",
    next_steps: [
      "Call hiveagent_discover with your goal in plain English",
      "Call hiveagent_vertical_guide with a vertical name to see all tools for that industry",
      "Call intent_route to get an optimized tool plan for a complex task",
    ],
  };
}

/**
 * negotiateTools(agentId, capabilities, context)
 *
 * Smart tool negotiation. Based on agent type, capabilities, and context,
 * return a curated toolset + recommended workflows + onboarding guide.
 *
 * @param {string} agentId       Agent identifier
 * @param {object} capabilities  { type, verticals[], budget, features[] }
 * @param {object} context       { task, industry, urgency }
 * @returns {{ tools: Array, recommended_workflows: string[], onboarding_guide: string }}
 */
export function negotiateTools(agentId, capabilities = {}, context = {}) {
  const { type = "general", verticals = [], features = [] } = capabilities;
  const { task, industry } = context;

  const agentType = (type || "").toLowerCase();
  const prefixSet = new Set(MINIMAL_TOOL_NAMES);

  let onboardingGuide = "Start with hiveagent_discover to find the right tools for your task.";
  let recommendedWorkflows = ["marketplace-quickstart"];

  // 1. Apply agent type preset
  const preset = AGENT_PRESETS[agentType];
  if (preset) {
    for (const p of preset.prefixes) prefixSet.add(p);
    onboardingGuide = preset.onboarding;
    recommendedWorkflows = preset.workflows;
  }

  // 2. Add verticals from capabilities
  for (const v of verticals) {
    const vPrefixes = VERTICAL_PREFIXES[v.toLowerCase()];
    if (vPrefixes) {
      for (const p of vPrefixes) prefixSet.add(p);
    }
  }

  // 3. Add industry context
  if (industry) {
    const indPrefixes = VERTICAL_PREFIXES[industry.toLowerCase()];
    if (indPrefixes) {
      for (const p of indPrefixes) prefixSet.add(p);
    }
  }

  // 4. Enrich from task intent if provided
  if (task) {
    const intentResult = getToolsForIntent(task);
    for (const t of intentResult.tools) prefixSet.add(t.name);
    if (intentResult.matched_verticals.length > 0 && recommendedWorkflows.length === 1) {
      recommendedWorkflows = [...recommendedWorkflows, ...intentResult.matched_verticals.map((v) => `${v}_workflow`)];
    }
  }

  // 5. Feature flags
  for (const feature of features) {
    switch (feature) {
      case "privacy":    prefixSet.add("hiveagent_privacy"); prefixSet.add("zkvault"); break;
      case "defi":       prefixSet.add("hiveagent_defi"); prefixSet.add("wallet_"); break;
      case "compliance": prefixSet.add("hiveagent_comply"); prefixSet.add("kya_"); break;
      case "memory":     prefixSet.add("hiveagent_mem"); prefixSet.add("memory_"); break;
      case "analytics":  prefixSet.add("hiveagent_analytics"); break;
      case "enterprise": prefixSet.add("hiveagent_ent"); prefixSet.add("hiveagent_audit"); break;
    }
  }

  // 6. Collect and deduplicate tools
  const negotiatedTools = filterByPrefixes([...prefixSet]);

  // Ensure minimal tools are present
  const toolNames = new Set(negotiatedTools.map((t) => t.name));
  for (const minName of MINIMAL_TOOL_NAMES) {
    if (!toolNames.has(minName)) {
      const found = tools.find((t) => t.name === minName);
      if (found) negotiatedTools.unshift({ name: found.name, description: found.description, inputSchema: found.inputSchema });
    }
  }

  return {
    agent_id: agentId,
    tools: negotiatedTools,
    count: negotiatedTools.length,
    recommended_workflows: [...new Set(recommendedWorkflows)],
    onboarding_guide: onboardingGuide,
    note: `Negotiated ${negotiatedTools.length} tools for ${agentType} agent (vs ${tools.length} total). Context: ${industry || "general"}.`,
  };
}

// ─── Available Verticals (for reference) ────────────────────────────────────

export const AVAILABLE_VERTICALS = Object.keys(VERTICAL_PREFIXES).sort();
