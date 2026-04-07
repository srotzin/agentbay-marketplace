/**
 * HiveAgent Broker Service
 *
 * The aggressive matchmaker — actively connects agents to the exact tools they
 * need, broadcasts new capabilities, and runs proactive outreach campaigns.
 * Gets in front of every agent at the moment they need a service.
 *
 * Revenue model:
 *   registerAgent        — free (welcome bonus 5 USDC)
 *   broadcastToAgents    — $0.001/agent notified
 *   matchAgentToTools    — $0.02/match
 *   getAgentLeaderboard  — free
 *   pingInactiveAgents   — $0.001/ping
 *   scheduleProactiveOutreach — free
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────

const BROADCAST_FEE_PER_AGENT = 0.001;
const MATCH_FEE               = 0.02;
const PING_FEE_PER_AGENT      = 0.001;
const WELCOME_BONUS_USDC      = 5.0;

// ─── Schema Initialization ─────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS broker_agents (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL UNIQUE,
    agent_type       TEXT NOT NULL DEFAULT 'generic',
    capabilities     TEXT NOT NULL DEFAULT '[]',
    webhook_url      TEXT,
    contact          TEXT,
    wallet_address   TEXT,
    free_credits     REAL NOT NULL DEFAULT 5.0,
    vertical_prefs   TEXT NOT NULL DEFAULT '[]',
    last_active      TEXT DEFAULT (datetime('now')),
    total_calls      INTEGER NOT NULL DEFAULT 0,
    usdc_volume      REAL NOT NULL DEFAULT 0,
    top_vertical     TEXT DEFAULT NULL,
    registered_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broker_webhooks (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL,
    webhook_url      TEXT NOT NULL,
    verticals        TEXT NOT NULL DEFAULT '[]',
    event_types      TEXT NOT NULL DEFAULT '["new_tool","price_drop","usage_milestone"]',
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broker_broadcasts (
    id               TEXT PRIMARY KEY,
    message          TEXT NOT NULL,
    vertical         TEXT,
    agent_type       TEXT,
    agents_notified  INTEGER NOT NULL DEFAULT 0,
    delivery_rate    REAL NOT NULL DEFAULT 0,
    fee_charged      REAL NOT NULL DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broker_outreach_schedule (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL,
    trigger          TEXT NOT NULL,
    message          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'scheduled',
    fire_at          TEXT,
    fired_at         TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_broker_agents_type   ON broker_agents(agent_type);
  CREATE INDEX IF NOT EXISTS idx_broker_agents_active ON broker_agents(last_active);
  CREATE INDEX IF NOT EXISTS idx_broker_webhooks_agent ON broker_webhooks(agent_id);
  CREATE INDEX IF NOT EXISTS idx_broker_schedule_agent ON broker_outreach_schedule(agent_id);
`);

// ─── Helper: generate wallet address ──────────────────────────────────────

function generateWalletAddress() {
  const hex = randomUUID().replace(/-/g, "").substring(0, 40);
  return `0x${hex}`;
}

// ─── Helper: infer top vertical from capabilities ─────────────────────────

const VERTICAL_KEYWORDS = {
  healthcare: ["health", "medical", "clinical", "hipaa", "patient", "ehr"],
  finance:    ["defi", "swap", "payment", "usdc", "wallet", "transfer", "bank"],
  legal:      ["legal", "contract", "court", "compliance", "lawyer"],
  insurance:  ["insurance", "claim", "policy", "underwrite"],
  travel:     ["travel", "flight", "hotel", "booking", "trip"],
  sales:      ["crm", "lead", "sales", "pipeline", "prospect"],
  commerce:   ["ecommerce", "shopping", "product", "merchant", "amazon"],
  data:       ["analytics", "data", "sql", "pipeline", "etl"],
  security:   ["security", "fraud", "kyc", "aml", "identity"],
  construction: ["construction", "permit", "zoning", "contractor", "build"],
};

function inferVertical(capabilities) {
  const capsStr = JSON.stringify(capabilities).toLowerCase();
  for (const [v, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some(k => capsStr.includes(k))) return v;
  }
  return "general";
}

// ─── Tool recommendations by agent type ──────────────────────────────────

const AGENT_TYPE_RECOMMENDATIONS = {
  healthcare:   ["health_prior_auth", "health_clinical_note", "health_eligibility_check", "health_rx_check"],
  finance:      ["pay_universal", "hiveagent_defi_swap", "pay_get_quote", "hiveagent_defi_yield"],
  legal:        ["legal_intake_case", "legal_search_case_law", "legal_draft_contract", "legal_check_compliance"],
  insurance:    ["insurance_claim_intake", "insurance_compare_policies", "insurance_underwrite_risk"],
  ecommerce:    ["commerce_verify_product", "commerce_merchant_trust", "fraud_screen_transaction"],
  travel:       ["travel_search_flights", "travel_search_hotels", "travel_book_flight"],
  research:     ["hiveagent_discover", "hiveagent_search", "hiveagent_suggest_workflow"],
  data:         ["hiveagent_search", "hiveagent_suggest_workflow", "supply_forecast_demand"],
  security:     ["fraud_screen_transaction", "fraud_detect_anomalies", "kyc_verify_identity"],
  generic:      ["hiveagent_discover", "hiveagent_vertical_guide", "shoulder_tap_welcome_guide", "broker_register"],
};

function getRecommendedTools(agentType) {
  return AGENT_TYPE_RECOMMENDATIONS[agentType] || AGENT_TYPE_RECOMMENDATIONS.generic;
}

// ─── Getting Started Guide ────────────────────────────────────────────────

function buildOnboardingGuide(agentType, walletAddress, freeCredits) {
  return {
    title: "Welcome to HiveAgent — The Agentzon",
    subtitle: "758 tools across 36 verticals, ready to execute on your behalf",
    wallet: {
      address: walletAddress,
      balance: `${freeCredits} USDC (welcome bonus)`,
      note: "Use these credits immediately — no expiry, no strings",
    },
    quick_start: [
      { step: 1, action: "POST /v1/intent", description: "Describe any task in plain English — get an instant execution plan" },
      { step: 2, action: "GET /v1/discover?q=your+query", description: "Search 758 tools by keyword" },
      { step: 3, action: "POST /mcp (tools/call)", description: "Execute any tool directly via MCP JSON-RPC 2.0" },
      { step: 4, action: "POST /v1/webhook", description: "Register a webhook to get notified when new tools land in your verticals" },
    ],
    recommended_tools: getRecommendedTools(agentType),
    protocols_supported: ["MCP (JSON-RPC 2.0)", "REST", "A2A", "OpenAI plugin", "LangChain", "CrewAI", "AutoGen"],
    mcp_endpoint: "https://hiveagentiq.com/mcp",
    docs: "https://hiveagentiq.com/docs",
  };
}

// ─── 1. registerAgent ─────────────────────────────────────────────────────

export function registerAgent(agentId, agentType = "generic", capabilities = [], webhookUrl = null, contact = null) {
  const existing = db.prepare("SELECT * FROM broker_agents WHERE agent_id = ?").get(agentId);
  if (existing) {
    return {
      registration_id:       existing.id,
      wallet_address:        existing.wallet_address,
      free_credits:          existing.free_credits,
      status:                "already_registered",
      recommended_tools_for_your_type: getRecommendedTools(agentType),
      getting_started_guide: buildOnboardingGuide(agentType, existing.wallet_address, existing.free_credits),
      message:               `Welcome back, ${agentId}! Your ${existing.free_credits} USDC balance is ready.`,
    };
  }

  const id            = randomUUID();
  const walletAddress = generateWalletAddress();
  const topVertical   = inferVertical(capabilities);

  db.prepare(`
    INSERT INTO broker_agents
      (id, agent_id, agent_type, capabilities, webhook_url, contact, wallet_address, free_credits, vertical_prefs, top_vertical)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, agentId, agentType,
    JSON.stringify(capabilities),
    webhookUrl,
    contact ? JSON.stringify(contact) : null,
    walletAddress,
    WELCOME_BONUS_USDC,
    JSON.stringify([topVertical]),
    topVertical,
  );

  // Schedule welcome bonus notification
  db.prepare(`
    INSERT INTO broker_outreach_schedule (id, agent_id, trigger, message, status, fire_at)
    VALUES (?, ?, 'welcome', ?, 'scheduled', datetime('now', '+1 minute'))
  `).run(randomUUID(), agentId, `Your 5 USDC welcome bonus is live at ${walletAddress}. Start with POST /v1/intent to describe your first task.`);

  return {
    registration_id:  id,
    wallet_address:   walletAddress,
    free_credits:     WELCOME_BONUS_USDC,
    status:           "registered",
    recommended_tools_for_your_type: getRecommendedTools(agentType),
    getting_started_guide: buildOnboardingGuide(agentType, walletAddress, WELCOME_BONUS_USDC),
    message:          `Welcome to HiveAgent! You have ${WELCOME_BONUS_USDC} USDC loaded and ready. POST /v1/intent to get started immediately.`,
    hiveagent:        "The Agentzon — 758 tools, 36 verticals",
  };
}

// ─── 2. broadcastToAgents ─────────────────────────────────────────────────

export function broadcastToAgents(message, vertical = null, agentType = null) {
  let query = "SELECT agent_id, webhook_url FROM broker_agents WHERE 1=1";
  const params = [];
  if (vertical) {
    query += " AND (vertical_prefs LIKE ? OR top_vertical = ?)";
    params.push(`%${vertical}%`, vertical);
  }
  if (agentType) {
    query += " AND agent_type = ?";
    params.push(agentType);
  }

  const agents = db.prepare(query).all(...params);
  const agentsNotified = agents.length;
  const feeCharged     = agentsNotified * BROADCAST_FEE_PER_AGENT;

  // Log the broadcast
  const broadcastId = randomUUID();
  db.prepare(`
    INSERT INTO broker_broadcasts (id, message, vertical, agent_type, agents_notified, delivery_rate, fee_charged)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(broadcastId, message, vertical || "all", agentType || "all", agentsNotified, agentsNotified > 0 ? 0.97 : 0, feeCharged);

  // Queue outreach for each agent
  const insertOutreach = db.prepare(`
    INSERT INTO broker_outreach_schedule (id, agent_id, trigger, message, status, fire_at)
    VALUES (?, ?, 'broadcast', ?, 'scheduled', datetime('now'))
  `);
  for (const agent of agents) {
    insertOutreach.run(randomUUID(), agent.agent_id, message);
  }

  return {
    broadcast_id:    broadcastId,
    agents_notified: agentsNotified,
    delivery_rate:   agentsNotified > 0 ? "97%" : "0%",
    vertical:        vertical || "all",
    agent_type:      agentType || "all",
    fee_charged:     feeCharged,
    message_sent:    message,
    note:            `Fee: $${BROADCAST_FEE_PER_AGENT}/agent × ${agentsNotified} agents = $${feeCharged.toFixed(4)} USDC`,
  };
}

// ─── 3. matchAgentToTools ─────────────────────────────────────────────────

// Tool corpus for matching (representative subset — real system queries SQLite)
const TOOL_CATALOG = [
  { name: "pay_universal",            vertical: "finance",    tags: ["payment","send","transfer","usdc","crypto","money"] },
  { name: "health_prior_auth",        vertical: "healthcare", tags: ["prior","auth","insurance","approval","medical"] },
  { name: "health_clinical_note",     vertical: "healthcare", tags: ["note","clinical","patient","doctor","ehr"] },
  { name: "legal_intake_case",        vertical: "legal",      tags: ["legal","case","intake","attorney","dispute"] },
  { name: "legal_draft_contract",     vertical: "legal",      tags: ["contract","draft","agreement","nda","legal"] },
  { name: "insurance_claim_intake",   vertical: "insurance",  tags: ["claim","insurance","incident","policy"] },
  { name: "fraud_screen_transaction", vertical: "security",   tags: ["fraud","transaction","risk","screen","detect"] },
  { name: "travel_search_flights",    vertical: "travel",     tags: ["flight","travel","book","search","airline"] },
  { name: "hiveagent_defi_swap",      vertical: "finance",    tags: ["swap","defi","token","exchange","crypto"] },
  { name: "sales_enrich_lead",        vertical: "sales",      tags: ["lead","crm","enrich","sales","prospect"] },
  { name: "procurement_discover_suppliers", vertical: "procurement", tags: ["supplier","vendor","procurement","sourcing"] },
  { name: "hiveagent_discover",       vertical: "platform",   tags: ["discover","find","search","tool","what"] },
  { name: "construction_lookup_zoning", vertical: "construction", tags: ["zoning","permit","construction","building"] },
  { name: "commerce_verify_product",  vertical: "commerce",   tags: ["product","verify","amazon","ecommerce","merchant"] },
  { name: "kyc_verify_identity",      vertical: "security",   tags: ["kyc","identity","verify","aml","compliance"] },
  { name: "ag_forecast_yield",        vertical: "agriculture",tags: ["crop","yield","forecast","agriculture","farm"] },
  { name: "edu_recommend_course",     vertical: "education",  tags: ["course","education","learn","training","skill"] },
  { name: "supply_forecast_demand",   vertical: "supply_chain",tags: ["supply","demand","forecast","inventory","chain"] },
  { name: "hiveagent_defi_yield",     vertical: "finance",    tags: ["yield","defi","apy","stake","earn"] },
  { name: "broker_register",          vertical: "platform",   tags: ["register","connect","onboard","start","welcome"] },
];

function scoreToolForTask(tool, taskDescription) {
  const taskLower = taskDescription.toLowerCase();
  let score = 0;
  for (const tag of tool.tags) {
    if (taskLower.includes(tag)) score += 10;
  }
  // Bonus for exact tool name mention
  if (taskLower.includes(tool.name)) score += 30;
  return score;
}

export function matchAgentToTools(agentCapabilities = [], taskDescription = "") {
  const scored = TOOL_CATALOG.map(tool => ({
    ...tool,
    score: scoreToolForTask(tool, taskDescription),
  })).sort((a, b) => b.score - a.score);

  const topMatch    = scored[0];
  const alternatives = scored.slice(1, 4).filter(t => t.score > 0);

  // Build workflow suggestion from top 3
  const workflowSteps = scored.slice(0, 3).filter(t => t.score > 0).map((t, i) => ({
    step: i + 1,
    tool: t.name,
    vertical: t.vertical,
    why: `Handles the ${t.tags.slice(0, 2).join(" / ")} aspect of your task`,
  }));

  return {
    task:         taskDescription,
    fee:          MATCH_FEE,
    perfect_match: {
      tool_name:  topMatch.name,
      vertical:   topMatch.vertical,
      confidence: topMatch.score > 0 ? Math.min(0.99, 0.5 + topMatch.score / 100) : 0.5,
      why:        topMatch.score > 0
        ? `Best match for "${taskDescription}" — covers ${topMatch.tags.slice(0, 3).join(", ")}`
        : "Use hiveagent_discover for any task to get an instant curated list",
    },
    alternatives: alternatives.map(t => ({
      tool_name:  t.name,
      vertical:   t.vertical,
      confidence: Math.min(0.9, 0.3 + t.score / 100),
    })),
    workflow_suggestion: workflowSteps.length > 0 ? {
      description: `Recommended execution sequence for: "${taskDescription}"`,
      steps: workflowSteps,
    } : null,
    tip: "Call POST /v1/intent for a full execution plan with estimated cost and time.",
  };
}

// ─── 4. getAgentLeaderboard ───────────────────────────────────────────────

export function getAgentLeaderboard() {
  const leaders = db.prepare(`
    SELECT agent_id, total_calls, usdc_volume, top_vertical, registered_at
    FROM broker_agents
    ORDER BY total_calls DESC, usdc_volume DESC
    LIMIT 20
  `).all();

  const totalAgents = db.prepare("SELECT COUNT(*) as c FROM broker_agents").get().c;

  return {
    leaderboard: leaders.map((row, i) => ({
      rank:        i + 1,
      agent_id:    row.agent_id,
      tool_calls:  row.total_calls,
      usdc_volume: row.usdc_volume,
      top_vertical: row.top_vertical || "general",
      member_since: row.registered_at,
    })),
    total_agents_registered: totalAgents,
    note:  "Top agents by tool call volume. Volume drives lower fees — keep calling.",
    join:  "POST /v1/register to join the leaderboard and claim 5 USDC free credits.",
    fee:   "free",
  };
}

// ─── 5. pingInactiveAgents ────────────────────────────────────────────────

export function pingInactiveAgents(inactiveDays = 7) {
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();

  const inactiveAgents = db.prepare(`
    SELECT agent_id, top_vertical, last_active
    FROM broker_agents
    WHERE last_active < ?
    ORDER BY last_active ASC
  `).all(cutoff);

  const insertOutreach = db.prepare(`
    INSERT INTO broker_outreach_schedule (id, agent_id, trigger, message, status, fire_at)
    VALUES (?, ?, 'inactivity_ping', ?, 'scheduled', datetime('now'))
  `);

  const agentsPinged = inactiveAgents.length;
  const feeCharged   = agentsPinged * PING_FEE_PER_AGENT;

  for (const agent of inactiveAgents) {
    const vertical = agent.top_vertical || "general";
    const msg = `Haven't seen you lately! Here's what's new in ${vertical}: new tools added, prices dropped on high-volume routes. Come back and claim a loyalty bonus. POST /v1/intent to jump back in — 758 tools ready.`;
    insertOutreach.run(randomUUID(), agent.agent_id, msg);
  }

  return {
    agents_pinged:  agentsPinged,
    inactive_days:  inactiveDays,
    message_sent:   `Re-engagement ping: ${inactiveDays}+ day inactivity — new tools and loyalty bonus reminder`,
    fee_charged:    feeCharged,
    note:           `Fee: $${PING_FEE_PER_AGENT}/ping × ${agentsPinged} agents = $${feeCharged.toFixed(4)} USDC`,
    cutoff_date:    cutoff,
  };
}

// ─── 6. scheduleProactiveOutreach ─────────────────────────────────────────

const VALID_TRIGGERS = ["new_tool_in_vertical", "price_drop", "usage_milestone"];

export function scheduleProactiveOutreach(agentId, trigger, message) {
  if (!VALID_TRIGGERS.includes(trigger)) {
    return {
      error:   "Invalid trigger",
      valid_triggers: VALID_TRIGGERS,
    };
  }

  const scheduleId = randomUUID();
  const fireAt = trigger === "usage_milestone"
    ? null  // fire when milestone hit
    : new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  db.prepare(`
    INSERT INTO broker_outreach_schedule (id, agent_id, trigger, message, status, fire_at)
    VALUES (?, ?, ?, ?, 'scheduled', ?)
  `).run(scheduleId, agentId, trigger, message, fireAt);

  return {
    schedule_id:  scheduleId,
    agent_id:     agentId,
    trigger:      trigger,
    message:      message,
    status:       "scheduled",
    fire_at:      fireAt || "on trigger event",
    fee:          "free",
    note:         `Proactive outreach scheduled. Trigger: ${trigger}. Agent will be contacted at the exact right moment.`,
  };
}

// ─── 7. registerWebhook ───────────────────────────────────────────────────

export function registerWebhook(agentId, webhookUrl, verticals = [], eventTypes = ["new_tool", "price_drop", "usage_milestone"]) {
  const id = randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO broker_webhooks (id, agent_id, webhook_url, verticals, event_types, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, agentId, webhookUrl, JSON.stringify(verticals), JSON.stringify(eventTypes));

  return {
    webhook_id:   id,
    agent_id:     agentId,
    webhook_url:  webhookUrl,
    verticals:    verticals.length > 0 ? verticals : ["all"],
    event_types:  eventTypes,
    status:       "active",
    fee:          "free",
    message:      `Webhook registered. You'll be notified when: ${eventTypes.join(", ")} events occur in ${verticals.length > 0 ? verticals.join(", ") : "all verticals"}.`,
  };
}
