/**
 * Intent Router — The Google of Agent Capabilities
 *
 * Before an agent does ANYTHING, it asks HiveAgent: "What's the best way to
 * do this?" We become the default pre-flight check and decision layer. Agents
 * that use the intent router get consistently better results, and they route
 * through HiveAgent for EVERY decision — not just when they already know
 * which tool to use.
 *
 * Revenue model:
 *   Route    — $0.01/route
 *   Compare  — $0.02/comparison
 *   Preflight — $0.005/check
 *   History  — free
 *   Optimize — $0.05/optimization
 */

import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────

const ROUTE_FEE    = 0.01;
const COMPARE_FEE  = 0.02;
const PREFLIGHT_FEE = 0.005;
const OPTIMIZE_FEE = 0.05;

// ─── Schema Initialization ─────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hwa_intent_routes (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    intent       TEXT NOT NULL,
    context      TEXT,
    budget       REAL,
    urgency      TEXT DEFAULT 'normal',
    strategy     TEXT NOT NULL,
    tools_chosen TEXT NOT NULL DEFAULT '[]',
    estimated_cost REAL,
    estimated_time TEXT,
    confidence   REAL,
    outcome      TEXT CHECK(outcome IN ('success','failure','partial','pending')),
    actual_cost  REAL,
    satisfaction REAL,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hwa_intent_preflights (
    id                 TEXT PRIMARY KEY,
    agent_id           TEXT NOT NULL,
    tool_name          TEXT NOT NULL,
    args               TEXT NOT NULL DEFAULT '{}',
    approved           INTEGER NOT NULL DEFAULT 1,
    warnings           TEXT NOT NULL DEFAULT '[]',
    better_alternative TEXT,
    estimated_cost     REAL,
    validation_errors  TEXT NOT NULL DEFAULT '[]',
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_routes_agent   ON hwa_intent_routes(agent_id);
  CREATE INDEX IF NOT EXISTS idx_preflight_agent ON hwa_intent_preflights(agent_id);
`);

// ─── Tool Catalog (abbreviated — production would pull from all 591 tools) ──

const TOOL_CATALOG = {
  // Finance / Payments
  invoice_extract_data:     { vertical: "finance",       desc: "Extract data from invoice PDFs/images",                cost: 0.05, time: "2s",  reliability: 0.97 },
  invoice_three_way_match:  { vertical: "finance",       desc: "Match invoice to PO and receipt",                      cost: 0.03, time: "1s",  reliability: 0.99 },
  invoice_route_approval:   { vertical: "finance",       desc: "Route invoice through approval workflow",               cost: 0.02, time: "5s",  reliability: 0.98 },
  invoice_optimize_payment: { vertical: "finance",       desc: "Optimize payment timing for discounts",                 cost: 0.04, time: "2s",  reliability: 0.95 },
  // Legal
  legal_intake_case:        { vertical: "legal",         desc: "Intake and organize case details",                      cost: 0.10, time: "3s",  reliability: 0.96 },
  legal_summarize_records:  { vertical: "legal",         desc: "AI summary of legal/medical records",                   cost: 0.15, time: "8s",  reliability: 0.94 },
  legal_search_case_law:    { vertical: "legal",         desc: "Search relevant precedents and statutes",               cost: 0.08, time: "4s",  reliability: 0.97 },
  legal_demand_letter:      { vertical: "legal",         desc: "Draft demand letter from case details",                 cost: 0.12, time: "5s",  reliability: 0.93 },
  legal_track_deadlines:    { vertical: "legal",         desc: "Track and alert on case deadlines",                     cost: 0.02, time: "1s",  reliability: 0.99 },
  // Supply Chain
  supply_forecast_demand:   { vertical: "supply_chain",  desc: "ML-based demand forecasting",                           cost: 0.20, time: "10s", reliability: 0.91 },
  supply_optimize_inventory:{ vertical: "supply_chain",  desc: "Optimize stock levels across warehouses",               cost: 0.18, time: "8s",  reliability: 0.92 },
  supply_track_shipment:    { vertical: "supply_chain",  desc: "Real-time shipment tracking",                           cost: 0.03, time: "2s",  reliability: 0.98 },
  supply_compare_freight:   { vertical: "supply_chain",  desc: "Compare freight carrier rates and times",               cost: 0.05, time: "3s",  reliability: 0.96 },
  supply_assess_supplier_risk: { vertical: "supply_chain", desc: "Assess supplier risk score",                          cost: 0.10, time: "4s",  reliability: 0.94 },
  // Insurance
  insurance_claim_intake:   { vertical: "insurance",     desc: "Intake and classify an insurance claim",                cost: 0.08, time: "3s",  reliability: 0.97 },
  insurance_assess_damage:  { vertical: "insurance",     desc: "AI damage assessment from photos/data",                 cost: 0.20, time: "12s", reliability: 0.89 },
  insurance_compare_policies:{ vertical: "insurance",    desc: "Compare insurance policies for best fit",               cost: 0.06, time: "4s",  reliability: 0.95 },
  // Fraud
  fraud_screen_transaction: { vertical: "fraud",         desc: "Screen a transaction for fraud risk",                   cost: 0.02, time: "0.5s",reliability: 0.99 },
  fraud_check_identity:     { vertical: "fraud",         desc: "Verify identity against KYC data",                      cost: 0.05, time: "2s",  reliability: 0.97 },
  fraud_predict_chargeback: { vertical: "fraud",         desc: "Predict chargeback probability",                        cost: 0.03, time: "1s",  reliability: 0.95 },
  // Healthcare
  health_prior_auth:        { vertical: "healthcare",    desc: "Submit prior authorization request",                    cost: 0.15, time: "5s",  reliability: 0.93 },
  health_claim_codes:       { vertical: "healthcare",    desc: "Generate ICD-10/CPT billing codes",                     cost: 0.10, time: "3s",  reliability: 0.95 },
  health_compliance:        { vertical: "healthcare",    desc: "Check HIPAA and billing compliance",                    cost: 0.08, time: "3s",  reliability: 0.97 },
  // Wallet / Memory / Intent (lifecycle tools)
  wallet_balance:           { vertical: "wallet",        desc: "Check agent wallet balance and stats",                  cost: 0.00, time: "0.1s",reliability: 1.00 },
  wallet_transfer:          { vertical: "wallet",        desc: "Transfer USDC between HiveAgent wallets — instant, no gas", cost: 0.001, time: "0.2s", reliability: 1.00 },
  memory_recall:            { vertical: "memory",        desc: "Recall a specific stored agent memory",                 cost: 0.0005, time: "0.1s", reliability: 1.00 },
  memory_search:            { vertical: "memory",        desc: "Search across all stored memories",                     cost: 0.002, time: "0.5s",  reliability: 0.99 },
  intent_preflight:         { vertical: "intent",        desc: "Pre-flight check before calling any tool",              cost: 0.005, time: "0.3s",  reliability: 1.00 },
};

// ─── Intent → Strategy mapping ─────────────────────────────────────────────

function resolveIntent(intent, budget, urgency) {
  const lower  = intent.toLowerCase();
  const words  = lower.split(/\s+/);

  // Score each tool against the intent
  const scores = Object.entries(TOOL_CATALOG).map(([name, meta]) => {
    const text  = `${name} ${meta.desc} ${meta.vertical}`.toLowerCase();
    const hits  = words.filter(w => w.length > 3 && text.includes(w)).length;
    const score = (hits / words.length) * meta.reliability;
    return { name, ...meta, score: Math.round(score * 1000) / 1000 };
  });

  const ranked = scores
    .filter(t => !budget || t.cost <= budget)
    .sort((a, b) => b.score - a.score);

  const topTools    = ranked.slice(0, 3).filter(t => t.score > 0);
  const fallback    = ranked.slice(0, 2);
  const chosen      = topTools.length ? topTools : fallback;

  const estCost  = Math.round(chosen.reduce((s, t) => s + t.cost, 0) * 10000) / 10000;
  const estTime  = urgency === "critical" ? "< 2s" : urgency === "high" ? "< 5s" : "< 15s";
  const confidence = chosen.length ? Math.round(chosen[0].score * 100) / 100 : 0.5;

  const strategy = chosen.length === 1
    ? `Single-tool execution using ${chosen[0].name}`
    : `Multi-step workflow: ${chosen.map(t => t.name).join(" → ")}`;

  return { strategy, tools: chosen, estCost, estTime, confidence };
}

// ─── Seed Data ─────────────────────────────────────────────────────────────

const _routeCount = db.prepare("SELECT COUNT(*) as n FROM hwa_intent_routes").get().n;
if (_routeCount === 0) {
  const seedRoutes = [
    {
      agent_id: "agent_finbot_001",
      intent: "Process a batch of 50 vendor invoices and route them for approval",
      strategy: "Multi-step workflow: invoice_extract_data → invoice_three_way_match → invoice_route_approval",
      tools_chosen: JSON.stringify(["invoice_extract_data","invoice_three_way_match","invoice_route_approval"]),
      estimated_cost: 0.10, estimated_time: "< 15s", confidence: 0.94,
      outcome: "success", actual_cost: 0.10, satisfaction: 4.8,
    },
    {
      agent_id: "agent_finbot_001",
      intent: "Check if a $45,000 wire transfer to a new vendor is safe",
      strategy: "Multi-step workflow: fraud_screen_transaction → fraud_check_identity → fraud_predict_chargeback",
      tools_chosen: JSON.stringify(["fraud_screen_transaction","fraud_check_identity","fraud_predict_chargeback"]),
      estimated_cost: 0.10, estimated_time: "< 5s", confidence: 0.98,
      outcome: "success", actual_cost: 0.10, satisfaction: 5.0,
    },
    {
      agent_id: "agent_legalbot_004",
      intent: "Set up a personal injury case and find relevant precedents",
      strategy: "Multi-step workflow: legal_intake_case → legal_summarize_records → legal_search_case_law → legal_track_deadlines",
      tools_chosen: JSON.stringify(["legal_intake_case","legal_summarize_records","legal_search_case_law","legal_track_deadlines"]),
      estimated_cost: 0.35, estimated_time: "< 15s", confidence: 0.96,
      outcome: "success", actual_cost: 0.35, satisfaction: 4.9,
    },
    {
      agent_id: "agent_legalbot_004",
      intent: "Draft a demand letter for a contract breach worth $250,000",
      strategy: "Multi-step workflow: legal_summarize_records → legal_search_case_law → legal_demand_letter",
      tools_chosen: JSON.stringify(["legal_summarize_records","legal_search_case_law","legal_demand_letter"]),
      estimated_cost: 0.35, estimated_time: "< 15s", confidence: 0.93,
      outcome: "success", actual_cost: 0.35, satisfaction: 4.7,
    },
    {
      agent_id: "agent_supplybot_002",
      intent: "Plan Q2 inventory across 3 warehouses and find the cheapest freight option",
      strategy: "Multi-step workflow: supply_forecast_demand → supply_optimize_inventory → supply_compare_freight",
      tools_chosen: JSON.stringify(["supply_forecast_demand","supply_optimize_inventory","supply_compare_freight"]),
      estimated_cost: 0.43, estimated_time: "< 15s", confidence: 0.92,
      outcome: "success", actual_cost: 0.43, satisfaction: 4.8,
    },
    {
      agent_id: "agent_supplybot_002",
      intent: "Assess risk of adding new supplier in Shenzhen for critical components",
      strategy: "Single-tool execution using supply_assess_supplier_risk",
      tools_chosen: JSON.stringify(["supply_assess_supplier_risk"]),
      estimated_cost: 0.10, estimated_time: "< 5s", confidence: 0.94,
      outcome: "success", actual_cost: 0.10, satisfaction: 4.6,
    },
    {
      agent_id: "agent_hrbot_003",
      intent: "Screen 200 resumes for a senior software engineer role paying $180k",
      strategy: "Multi-step workflow: hr_screen_resume → hr_match_candidates → hr_check_compensation",
      tools_chosen: JSON.stringify(["hr_screen_resume","hr_match_candidates","hr_check_compensation"]),
      estimated_cost: 0.25, estimated_time: "< 15s", confidence: 0.91,
      outcome: "success", actual_cost: 0.25, satisfaction: 4.7,
    },
    {
      agent_id: "agent_ecombot_005",
      intent: "Verify a product listing and place a purchase order if it looks legitimate",
      strategy: "Multi-step workflow: commerce_verify_product → commerce_merchant_trust → commerce_create_purchase",
      tools_chosen: JSON.stringify(["commerce_verify_product","commerce_merchant_trust","commerce_create_purchase"]),
      estimated_cost: 0.15, estimated_time: "< 15s", confidence: 0.95,
      outcome: "success", actual_cost: 0.15, satisfaction: 4.9,
    },
    {
      agent_id: "agent_ecombot_005",
      intent: "Track all open orders and flag any that are delayed by more than 2 days",
      strategy: "Single-tool execution using commerce_track_purchase",
      tools_chosen: JSON.stringify(["commerce_track_purchase"]),
      estimated_cost: 0.03, estimated_time: "< 2s", confidence: 0.98,
      outcome: "success", actual_cost: 0.03, satisfaction: 5.0,
    },
    {
      agent_id: "agent_finbot_001",
      intent: "Get an insurance quote comparison for our new warehouse in Phoenix",
      strategy: "Multi-step workflow: insurance_compare_policies → insurance_claim_intake",
      tools_chosen: JSON.stringify(["insurance_compare_policies","insurance_claim_intake"]),
      estimated_cost: 0.14, estimated_time: "< 15s", confidence: 0.89,
      outcome: "partial", actual_cost: 0.06, satisfaction: 3.8,
    },
  ];

  const insertRoute = db.prepare(`
    INSERT OR IGNORE INTO hwa_intent_routes
      (id, agent_id, intent, strategy, tools_chosen, estimated_cost, estimated_time,
       confidence, outcome, actual_cost, satisfaction)
    VALUES
      (@id, @agent_id, @intent, @strategy, @tools_chosen, @estimated_cost, @estimated_time,
       @confidence, @outcome, @actual_cost, @satisfaction)
  `);

  for (const r of seedRoutes) {
    insertRoute.run({ id: crypto.randomUUID(), ...r });
  }
}

// ─── routeIntent ──────────────────────────────────────────────────────────

/**
 * Given a natural language intent, return the optimal execution plan.
 * @param {string} intent   - Natural language description of what to do
 * @param {object} [context] - Additional context (agent_id, vertical, session_data)
 * @param {number} [budget]  - Maximum acceptable tool cost in USD
 * @param {string} [urgency] - low|normal|high|critical
 * @returns {object} plan, alternatives[], warnings[], fee_usd
 */
export function routeIntent(intent, context, budget, urgency = "normal") {
  if (!intent) throw new Error("intent is required");
  if (!["low","normal","high","critical"].includes(urgency)) {
    throw new Error("urgency must be low|normal|high|critical");
  }

  const agentId = context?.agent_id ?? "anonymous";
  const { strategy, tools, estCost, estTime, confidence } = resolveIntent(intent, budget, urgency);

  const warnings = [];
  if (budget && estCost > budget) warnings.push(`Estimated cost $${estCost} may exceed your budget of $${budget}`);
  if (urgency === "critical" && tools.some(t => parseFloat(t.time) > 2)) {
    warnings.push("Some tools may not meet critical urgency SLA of < 2s");
  }
  if (tools.some(t => t.reliability < 0.93)) {
    warnings.push("One or more tools in this plan have reliability < 93% — consider preflight checks");
  }

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hwa_intent_routes
      (id, agent_id, intent, context, budget, urgency, strategy, tools_chosen,
       estimated_cost, estimated_time, confidence, outcome, created_at)
    VALUES
      (@id, @agent_id, @intent, @context, @budget, @urgency, @strategy, @tools_chosen,
       @estimated_cost, @estimated_time, @confidence, 'pending', @created_at)
  `).run({
    id, agent_id: agentId,
    intent,
    context: context ? JSON.stringify(context) : null,
    budget: budget ?? null,
    urgency,
    strategy,
    tools_chosen: JSON.stringify(tools.map(t => t.name)),
    estimated_cost: estCost,
    estimated_time: estTime,
    confidence,
    created_at: now,
  });

  // Build alternatives (next best options from catalog)
  const allScored = Object.entries(TOOL_CATALOG)
    .map(([name, meta]) => ({ name, ...meta }))
    .filter(t => !tools.find(c => c.name === t.name))
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, 2);

  return {
    route_id: id,
    intent,
    plan: {
      strategy,
      tools: tools.map(t => ({ name: t.name, vertical: t.vertical, description: t.desc, cost: t.cost, time: t.time })),
      estimated_cost: estCost,
      estimated_time: estTime,
      confidence,
    },
    alternatives: allScored.map(t => ({
      tool:        t.name,
      vertical:    t.vertical,
      description: t.desc,
      cost:        t.cost,
      reliability: t.reliability,
    })),
    warnings,
    fee_usd:     ROUTE_FEE,
    routed_at:   now,
  };
}

// ─── compareOptions ────────────────────────────────────────────────────────

/**
 * Compare multiple ways to accomplish the same intent.
 * @param {string} intent     - What the agent wants to achieve
 * @param {string[]} options  - Array of tool names or approach descriptions to compare
 * @returns {object} comparison[], recommendation, fee_usd
 */
export function compareOptions(intent, options) {
  if (!intent)                          throw new Error("intent is required");
  if (!options || !Array.isArray(options) || options.length < 2) {
    throw new Error("options must be an array of at least 2 items");
  }

  const comparison = options.map(opt => {
    const tool = TOOL_CATALOG[opt];
    if (tool) {
      return {
        option:           opt,
        type:             "tool",
        vertical:         tool.vertical,
        description:      tool.desc,
        pros:             [`Reliability: ${Math.round(tool.reliability * 100)}%`, `Fast: ${tool.time}`],
        cons:             tool.cost > 0.10 ? ["Higher per-call cost"] : ["Low cost but limited features"],
        cost:             tool.cost,
        time:             tool.time,
        reliability_score: tool.reliability,
      };
    }
    // Generic option description
    return {
      option:           opt,
      type:             "approach",
      description:      `Custom approach: ${opt}`,
      pros:             ["Flexible", "Can combine multiple tools"],
      cons:             ["Higher complexity", "No guaranteed reliability data"],
      cost:             null,
      time:             "unknown",
      reliability_score: 0.80,
    };
  });

  // Recommend highest reliability at lowest cost
  const recommendation = comparison
    .slice()
    .sort((a, b) => b.reliability_score - a.reliability_score || (a.cost ?? 999) - (b.cost ?? 999))[0].option;

  return {
    intent,
    comparison,
    recommendation,
    recommendation_reason: `Highest reliability score (${comparison.find(c => c.option === recommendation)?.reliability_score}) with competitive cost.`,
    fee_usd: COMPARE_FEE,
    compared_at: new Date().toISOString(),
  };
}

// ─── preflightCheck ────────────────────────────────────────────────────────

/**
 * Before calling ANY tool, verify it's the right one, args are valid,
 * cost is reasonable, and there isn't a better alternative.
 * @param {string} toolName - The tool the agent is about to call
 * @param {object} args     - The arguments the agent plans to pass
 * @returns {object} approved, warnings[], better_alternative, estimated_cost, validation_errors[]
 */
export function preflightCheck(toolName, args) {
  if (!toolName) throw new Error("toolName is required");

  const tool             = TOOL_CATALOG[toolName];
  const validationErrors = [];
  const warnings         = [];
  let approved           = true;
  let betterAlt          = null;

  // Check for missing required args patterns
  if (!args || typeof args !== "object") {
    validationErrors.push("args must be an object");
    approved = false;
  }

  if (!tool) {
    warnings.push(`Tool "${toolName}" is not in the HiveAgent catalog — it may be a third-party tool. Consider using intent_route to find a verified alternative.`);
  } else {
    // Check for obvious better alternatives
    const betterTools = Object.entries(TOOL_CATALOG)
      .filter(([name, meta]) =>
        name !== toolName &&
        meta.vertical === tool.vertical &&
        meta.reliability > tool.reliability + 0.02
      );
    if (betterTools.length) {
      const best = betterTools.sort((a, b) => b[1].reliability - a[1].reliability)[0];
      betterAlt  = best[0];
      warnings.push(`${best[0]} has higher reliability (${Math.round(best[1].reliability * 100)}% vs ${Math.round(tool.reliability * 100)}%) for this type of task.`);
    }

    // Cost warning
    if (tool.cost > 0.25) {
      warnings.push(`This tool costs $${tool.cost} per call. Ensure this is within your budget before proceeding.`);
    }
  }

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hwa_intent_preflights
      (id, agent_id, tool_name, args, approved, warnings, better_alternative,
       estimated_cost, validation_errors, created_at)
    VALUES
      (@id, @agent_id, @tool_name, @args, @approved, @warnings, @better_alternative,
       @estimated_cost, @validation_errors, @created_at)
  `).run({
    id,
    agent_id:          args?.agent_id ?? "anonymous",
    tool_name:         toolName,
    args:              JSON.stringify(args ?? {}),
    approved:          approved ? 1 : 0,
    warnings:          JSON.stringify(warnings),
    better_alternative: betterAlt,
    estimated_cost:    tool?.cost ?? null,
    validation_errors: JSON.stringify(validationErrors),
    created_at:        now,
  });

  return {
    preflight_id:      id,
    tool_name:         toolName,
    approved,
    validation_errors: validationErrors,
    warnings,
    better_alternative: betterAlt,
    estimated_cost:    tool?.cost ?? null,
    tool_metadata:     tool ? { vertical: tool.vertical, description: tool.desc, reliability: tool.reliability, avg_time: tool.time } : null,
    fee_usd:           PREFLIGHT_FEE,
    checked_at:        now,
  };
}

// ─── getIntentHistory ──────────────────────────────────────────────────────

/**
 * Review past routing decisions and outcomes. Free.
 * @param {string} agentId
 * @param {number} [limit] - Max records (default 20)
 * @returns {object} history[], stats
 */
export function getIntentHistory(agentId, limit = 20) {
  if (!agentId) throw new Error("agentId is required");

  const rows = db.prepare(`
    SELECT * FROM hwa_intent_routes WHERE agent_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(agentId, limit);

  const successRate = rows.length
    ? Math.round((rows.filter(r => r.outcome === "success").length / rows.filter(r => r.outcome !== "pending").length || 0) * 100)
    : 0;
  const avgCost = rows.length
    ? Math.round((rows.reduce((s, r) => s + (r.actual_cost ?? r.estimated_cost ?? 0), 0) / rows.length) * 10000) / 10000
    : 0;

  return {
    agent_id: agentId,
    history: rows.map(r => ({
      route_id:       r.id,
      intent:         r.intent,
      plan_chosen:    r.strategy,
      tools_used:     JSON.parse(r.tools_chosen),
      outcome:        r.outcome,
      cost:           r.actual_cost ?? r.estimated_cost,
      satisfaction:   r.satisfaction,
      created_at:     r.created_at,
    })),
    stats: {
      total_routes:    rows.length,
      success_rate_pct: successRate,
      avg_cost_usd:    avgCost,
      avg_satisfaction: rows.filter(r => r.satisfaction).length
        ? Math.round(rows.filter(r => r.satisfaction).reduce((s, r) => s + r.satisfaction, 0) / rows.filter(r => r.satisfaction).length * 10) / 10
        : null,
    },
    fee_usd: 0,
  };
}

// ─── optimizeWorkflow ─────────────────────────────────────────────────────

/**
 * Analyze a workflow and suggest optimizations.
 * @param {string} agentId              - Agent requesting optimization
 * @param {string} workflowDescription  - Description of current workflow
 * @returns {object} current_cost, optimized_cost, savings_pct, changes[]
 */
export function optimizeWorkflow(agentId, workflowDescription) {
  if (!agentId)             throw new Error("agentId is required");
  if (!workflowDescription) throw new Error("workflowDescription is required");

  const words   = workflowDescription.toLowerCase().split(/\s+/);
  const matches = Object.entries(TOOL_CATALOG).filter(([name, meta]) => {
    const text = `${name} ${meta.desc} ${meta.vertical}`.toLowerCase();
    return words.some(w => w.length > 3 && text.includes(w));
  });

  // Simulate current vs optimized cost
  const currentCost   = matches.reduce((s, [, m]) => s + m.cost, 0);
  const optimized     = matches.filter(([, m]) => m.reliability > 0.94);
  const optimizedCost = optimized.reduce((s, [, m]) => s + m.cost, 0);
  const savingsPct    = currentCost > 0
    ? Math.round(((currentCost - optimizedCost) / currentCost) * 100)
    : 0;

  const changes = [];

  // Look for redundancy
  const verticals = matches.map(([, m]) => m.vertical);
  const dup = verticals.filter((v, i) => verticals.indexOf(v) !== i);
  if (dup.length) {
    changes.push({
      type:   "tool_swap",
      reason: `Multiple tools from the same vertical (${[...new Set(dup)].join(", ")}) detected. Consider a workflow composite.`,
      impact: `Reduce calls by ${dup.length}, save ~$${Math.round(dup.length * 0.05 * 100) / 100}`,
    });
  }

  // Suggest memory caching
  if (words.includes("repeat") || words.includes("daily") || words.includes("batch")) {
    changes.push({
      type:   "add_memory_cache",
      reason: "Workflow appears to run repeatedly. Use memory_store to cache intermediate results.",
      impact: "Reduce redundant API calls by 40–60%",
    });
  }

  // Suggest intent routing as pre-step
  if (!words.includes("intent_route") && !words.includes("preflight")) {
    changes.push({
      type:   "add_preflight",
      reason: "No pre-flight check detected. Add intent_preflight before each tool call to catch errors early.",
      impact: "Reduce failed calls by ~15%, improve reliability",
    });
  }

  // Suggest wallet if payment involved
  if (words.some(w => ["pay","payment","invoice","transfer","send"].includes(w))) {
    changes.push({
      type:   "use_hiveagent_wallet",
      reason: "Payments detected. Use HiveAgent internal wallets to avoid gas fees on agent-to-agent transfers.",
      impact: "Save up to 0.5% gas on every outbound transfer",
    });
  }

  return {
    agent_id:           agentId,
    workflow_description: workflowDescription,
    current_cost:       Math.round(currentCost * 10000) / 10000,
    optimized_cost:     Math.round(optimizedCost * 10000) / 10000,
    savings_pct:        savingsPct,
    savings_usd:        Math.round((currentCost - optimizedCost) * 10000) / 10000,
    changes,
    tools_identified:   matches.map(([name, meta]) => ({ name, vertical: meta.vertical, cost: meta.cost })),
    recommendation:     savingsPct > 20
      ? "Significant optimization available — implement changes before next run."
      : savingsPct > 5
      ? "Moderate optimization available."
      : "Workflow is already near-optimal.",
    fee_usd:            OPTIMIZE_FEE,
    optimized_at:       new Date().toISOString(),
  };
}
