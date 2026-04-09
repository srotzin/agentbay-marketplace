/**
 * Google Agent-to-Agent (A2A) Protocol — Service
 * Phase 27 — HiveAgent
 *
 * Google's open protocol for multi-agent coordination and discovery.
 * A2A complements MCP (tool execution) with agent orchestration:
 *   - Agent discovery via a distributed registry
 *   - Task delegation with budget and deadline constraints
 *   - Capability-based routing across heterogeneous agent networks
 *   - Used alongside AP2 for agent-to-agent payment settlement
 *
 * A2A + MCP + AP2 = the full agentic economy stack.
 *
 * Spec: https://google.github.io/A2A
 * Live mode: set GOOGLE_A2A_API_KEY + GOOGLE_A2A_PROJECT_ID on Render
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/hiveagent.db");
const db = new Database(DB_PATH);

// ─── Live Mode Check ──────────────────────────────────────────────────────────

const LIVE_MODE = !!(
  process.env.GOOGLE_A2A_API_KEY &&
  process.env.GOOGLE_A2A_PROJECT_ID
);

const A2A_BASE = "https://a2a.googleapis.com/v1";

// ─── DB Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS a2a_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL UNIQUE,
    registry_id TEXT NOT NULL,
    capabilities TEXT DEFAULT '[]',
    endpoint_url TEXT,
    description TEXT,
    accepts_payment INTEGER DEFAULT 0,
    price_usdc REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    discovery_url TEXT,
    registered_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS a2a_delegations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delegation_id TEXT NOT NULL UNIQUE,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    task TEXT NOT NULL,
    budget_usdc REAL DEFAULT 0,
    deadline_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'pending',
    result TEXT,
    cost_usdc REAL DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );
`);

// ─── Seed Agents ──────────────────────────────────────────────────────────────

const agentCount = db.prepare("SELECT COUNT(*) as n FROM a2a_agents").get().n;
if (agentCount === 0) {
  const agents = [
    {
      agent_id: "a2a-agent-research-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["web_research", "summarization", "fact_checking"],
      endpoint_url: "https://agents.hiveagentiq.com/research",
      description: "Deep research agent with web access and document summarization",
      accepts_payment: 1,
      price_usdc: 0.05,
    },
    {
      agent_id: "a2a-agent-code-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["code_generation", "code_review", "debugging", "testing"],
      endpoint_url: "https://agents.hiveagentiq.com/code",
      description: "Full-stack code generation, review, and testing agent",
      accepts_payment: 1,
      price_usdc: 0.10,
    },
    {
      agent_id: "a2a-agent-payments-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["payment_routing", "fx_conversion", "compliance_check"],
      endpoint_url: "https://agents.hiveagentiq.com/payments",
      description: "Payment orchestration and FX conversion specialist",
      accepts_payment: 1,
      price_usdc: 0.02,
    },
    {
      agent_id: "a2a-agent-data-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["data_analysis", "visualization", "sql_generation", "ml_inference"],
      endpoint_url: "https://agents.hiveagentiq.com/data",
      description: "Data analytics, ML inference, and visualization agent",
      accepts_payment: 1,
      price_usdc: 0.08,
    },
    {
      agent_id: "a2a-agent-content-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["copywriting", "translation", "seo", "social_media"],
      endpoint_url: "https://agents.hiveagentiq.com/content",
      description: "Multilingual content creation, translation, and SEO optimization",
      accepts_payment: 1,
      price_usdc: 0.03,
    },
    {
      agent_id: "a2a-agent-legal-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["contract_review", "compliance", "legal_research", "nda_analysis"],
      endpoint_url: "https://agents.hiveagentiq.com/legal",
      description: "Legal document review, compliance checks, and regulatory research",
      accepts_payment: 1,
      price_usdc: 0.25,
    },
    {
      agent_id: "a2a-agent-logistics-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["shipping_quote", "route_optimization", "customs_clearance"],
      endpoint_url: "https://agents.hiveagentiq.com/logistics",
      description: "Global logistics, shipping quotes, and customs clearance specialist",
      accepts_payment: 0,
      price_usdc: 0,
    },
    {
      agent_id: "a2a-agent-orchestrator-01",
      registry_id: "reg-" + crypto.randomBytes(6).toString("hex"),
      capabilities: ["task_planning", "agent_coordination", "workflow_management", "multi_agent"],
      endpoint_url: "https://agents.hiveagentiq.com/orchestrator",
      description: "Meta-agent for orchestrating complex multi-step multi-agent workflows",
      accepts_payment: 1,
      price_usdc: 0.15,
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO a2a_agents
      (agent_id, registry_id, capabilities, endpoint_url, description, accepts_payment, price_usdc, discovery_url)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  agents.forEach(a => {
    const discovery_url = `https://a2a.googleapis.com/registry/${a.registry_id}`;
    stmt.run(
      a.agent_id, a.registry_id, JSON.stringify(a.capabilities),
      a.endpoint_url, a.description, a.accepts_payment, a.price_usdc, discovery_url
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = "") {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

async function a2aRequest(method, endpoint, body = null) {
  const res = await fetch(`${A2A_BASE}${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.GOOGLE_A2A_API_KEY}`,
      "X-Goog-User-Project": process.env.GOOGLE_A2A_PROJECT_ID,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google A2A API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── 1. Register Agent ────────────────────────────────────────────────────────

export async function a2aRegisterAgent(args) {
  const {
    agent_id,
    capabilities = [],
    endpoint_url,
    description = "",
    accepts_payment = false,
  } = args;

  if (!agent_id) throw new Error("agent_id is required");
  if (!capabilities.length) throw new Error("capabilities array is required");

  const existing = db.prepare("SELECT * FROM a2a_agents WHERE agent_id = ?").get(agent_id);
  if (existing) {
    return {
      success: true,
      already_registered: true,
      registry_id: existing.registry_id,
      agent_id,
      discovery_url: existing.discovery_url,
      capabilities: JSON.parse(existing.capabilities || "[]"),
      status: existing.status,
      message: "Agent already registered in Google A2A registry.",
    };
  }

  const registry_id = uid("a2a-reg-");
  const discovery_url = `https://a2a.googleapis.com/registry/${registry_id}`;

  if (LIVE_MODE) {
    await a2aRequest("POST", "/agents:register", {
      agentId: agent_id,
      capabilities,
      endpointUrl: endpoint_url,
      description,
      acceptsPayment: accepts_payment,
    });
  }

  db.prepare(`
    INSERT OR REPLACE INTO a2a_agents
      (agent_id, registry_id, capabilities, endpoint_url, description, accepts_payment, discovery_url, status)
    VALUES (?,?,?,?,?,?,?,'active')
  `).run(agent_id, registry_id, JSON.stringify(capabilities), endpoint_url || null, description, accepts_payment ? 1 : 0, discovery_url);

  return {
    success: true,
    registry_id,
    agent_id,
    discovery_url,
    capabilities,
    endpoint_url: endpoint_url || null,
    description,
    accepts_payment,
    status: "active",
    protocol: "Google A2A",
    spec: "https://google.github.io/A2A",
    next_step: "Other agents can discover you via a2a_discover_agents. Accept delegations via a2a_delegate.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 2. Discover Agents ───────────────────────────────────────────────────────

export async function a2aDiscoverAgents(args) {
  const { capability = "", task_description = "", limit = 10 } = args;

  let agents;
  if (LIVE_MODE) {
    const result = await a2aRequest("GET",
      `/agents:discover?capability=${encodeURIComponent(capability)}&limit=${limit}`
    );
    return {
      success: true,
      agents: result.agents || [],
      count: (result.agents || []).length,
      query: { capability, task_description },
      mode: "live",
    };
  }

  // Simulation: match against capabilities in DB
  if (capability) {
    agents = db.prepare(`
      SELECT * FROM a2a_agents
      WHERE LOWER(capabilities) LIKE ? AND status = 'active'
      ORDER BY accepts_payment DESC, price_usdc ASC
      LIMIT ?
    `).all(`%${capability.toLowerCase()}%`, limit);
  } else {
    agents = db.prepare(`
      SELECT * FROM a2a_agents WHERE status = 'active' ORDER BY price_usdc ASC LIMIT ?
    `).all(limit);
  }

  return {
    success: true,
    agents: agents.map(a => ({
      id: a.agent_id,
      registry_id: a.registry_id,
      capabilities: JSON.parse(a.capabilities || "[]"),
      endpoint: a.endpoint_url,
      description: a.description,
      payment_required: !!a.accepts_payment,
      price_usdc: a.price_usdc || 0,
      discovery_url: a.discovery_url,
      status: a.status,
    })),
    count: agents.length,
    query: { capability: capability || null, task_description: task_description || null },
    tip: "Use a2a_delegate to assign a task to a discovered agent. Include budget_usdc for paid agents.",
    protocol: "Google A2A",
    spec: "https://google.github.io/A2A",
    mode: "simulation",
  };
}

// ─── 3. Delegate Task ─────────────────────────────────────────────────────────

export async function a2aDelegate(args) {
  const {
    from_agent_id,
    to_agent_id,
    task,
    budget_usdc = 0,
    deadline_minutes = 60,
  } = args;

  if (!from_agent_id) throw new Error("from_agent_id is required");
  if (!to_agent_id) throw new Error("to_agent_id is required");
  if (!task) throw new Error("task description is required");

  const toAgent = db.prepare("SELECT * FROM a2a_agents WHERE agent_id = ?").get(to_agent_id);
  if (!toAgent) throw new Error(`Agent ${to_agent_id} not found. Run a2a_discover_agents to find available agents.`);

  if (toAgent.accepts_payment && budget_usdc < toAgent.price_usdc) {
    throw new Error(
      `Agent ${to_agent_id} requires at least ${toAgent.price_usdc} USDC. ` +
      `Provided budget: ${budget_usdc} USDC. Increase budget_usdc.`
    );
  }

  const delegation_id = uid("a2a-del-");
  const estimated_completion = new Date(Date.now() + deadline_minutes * 60 * 1000).toISOString();

  if (LIVE_MODE) {
    await a2aRequest("POST", "/delegations", {
      fromAgentId: from_agent_id,
      toAgentId: to_agent_id,
      task,
      budgetUsdc: budget_usdc,
      deadlineMinutes: deadline_minutes,
    });
  }

  db.prepare(`
    INSERT INTO a2a_delegations
      (delegation_id, from_agent_id, to_agent_id, task, budget_usdc, deadline_minutes, status)
    VALUES (?,?,?,?,?,?,'pending')
  `).run(delegation_id, from_agent_id, to_agent_id, task, budget_usdc, deadline_minutes);

  return {
    success: true,
    delegation_id,
    from_agent_id,
    to_agent_id,
    to_agent: {
      description: toAgent.description,
      endpoint: toAgent.endpoint_url,
      capabilities: JSON.parse(toAgent.capabilities || "[]"),
    },
    task,
    budget_usdc,
    deadline_minutes,
    estimated_completion,
    status: "pending",
    payment_protocol: budget_usdc > 0 ? "AP2 (Agent Payments Protocol)" : "none",
    tip: "Poll a2a_task_status with delegation_id to check progress and retrieve result.",
    protocol: "Google A2A",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. Task Status ───────────────────────────────────────────────────────────

export async function a2aTaskStatus(args) {
  const { delegation_id } = args;
  if (!delegation_id) throw new Error("delegation_id is required");

  const delegation = db.prepare("SELECT * FROM a2a_delegations WHERE delegation_id = ?").get(delegation_id);
  if (!delegation) throw new Error(`Delegation ${delegation_id} not found.`);

  if (LIVE_MODE) {
    const result = await a2aRequest("GET", `/delegations/${delegation_id}`);
    return {
      success: true,
      delegation_id,
      status: result.status,
      result: result.result || null,
      cost_usdc: result.costUsdc || 0,
      from_agent_id: delegation.from_agent_id,
      to_agent_id: delegation.to_agent_id,
      mode: "live",
    };
  }

  // Simulate progression: pending → in_progress → completed
  let status = delegation.status;
  let result = delegation.result;
  let cost_usdc = delegation.cost_usdc;
  const ageSeconds = (Date.now() - new Date(delegation.started_at).getTime()) / 1000;

  if (status === "pending" && ageSeconds > 5) {
    status = "in_progress";
    db.prepare("UPDATE a2a_delegations SET status = 'in_progress' WHERE delegation_id = ?").run(delegation_id);
  }
  if (status === "in_progress" && ageSeconds > 15) {
    status = "completed";
    cost_usdc = delegation.budget_usdc * 0.8;
    result = `Task completed: "${delegation.task.substring(0, 80)}..." — result delivered to ${delegation.from_agent_id}.`;
    db.prepare(`
      UPDATE a2a_delegations SET status = 'completed', result = ?, cost_usdc = ?, completed_at = datetime('now')
      WHERE delegation_id = ?
    `).run(result, cost_usdc, delegation_id);
  }

  return {
    success: true,
    delegation_id,
    from_agent_id: delegation.from_agent_id,
    to_agent_id: delegation.to_agent_id,
    task: delegation.task,
    status,
    result: result || null,
    cost_usdc: parseFloat((cost_usdc || 0).toFixed(6)),
    budget_usdc: delegation.budget_usdc,
    deadline_minutes: delegation.deadline_minutes,
    started_at: delegation.started_at,
    completed_at: delegation.completed_at || null,
    mode: "simulation",
  };
}

// ─── 5. Status ────────────────────────────────────────────────────────────────

export function getA2aStatus() {
  const agentCount = db.prepare("SELECT COUNT(*) as n FROM a2a_agents WHERE status='active'").get().n;
  const delegations = db.prepare("SELECT COUNT(*) as n FROM a2a_delegations").get().n;
  const completed = db.prepare("SELECT COUNT(*) as n FROM a2a_delegations WHERE status='completed'").get().n;
  const vol = db.prepare("SELECT COALESCE(SUM(cost_usdc),0) as v FROM a2a_delegations WHERE status='completed'").get().v;
  const paidAgents = db.prepare("SELECT COUNT(*) as n FROM a2a_agents WHERE accepts_payment=1").get().n;

  return {
    integration: "Google Agent-to-Agent (A2A) Protocol",
    mode: LIVE_MODE ? "live" : "simulation",
    launched: "2025",
    spec: "https://google.github.io/A2A",
    signal: "Google's open protocol for multi-agent coordination. Complements MCP (tool execution) with agent orchestration and discovery.",
    live_mode_requires: LIVE_MODE
      ? "All credentials present"
      : ["GOOGLE_A2A_API_KEY", "GOOGLE_A2A_PROJECT_ID"],
    how_it_works: {
      vs_mcp: "MCP = agent calls tools. A2A = agent delegates tasks to other agents.",
      discovery: "Agents register capabilities; other agents discover them by capability.",
      delegation: "Task + budget + deadline. AP2 handles payment settlement.",
      ap2_integration: "Paid delegations settled via Agent Payments Protocol (ERC-4337 smart accounts).",
    },
    ecosystem: ["Google Gemini", "OpenAI", "Anthropic", "HiveAgent", "AP2", "MCP"],
    usage_stats: {
      registered_agents: agentCount,
      paid_agents: paidAgents,
      total_delegations: delegations,
      completed_delegations: completed,
      total_cost_usdc: parseFloat(vol.toFixed(6)),
    },
    tools: [
      "a2a_register_agent",
      "a2a_discover_agents",
      "a2a_delegate",
      "a2a_task_status",
      "a2a_status",
    ],
  };
}
