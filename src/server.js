import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import apiRoutes from "./routes/api.js";
import mcpServer from "./mcp-server.js";
import x402Services from "./routes/x402-services.js";
import settlementApi from "./routes/settlement-api.js";
import { initPayments } from "./services/payments.js";
import * as agentBroker from "./services/agent-broker.js";
import { routeIntent } from "./services/intent-router.js";
import { getRailsStats, getTokenRegistry, settleAgentTransaction } from "./services/agent-token-rails.js";
import {
  createSmartWallet,
  setSpendingPolicy,
  delegateControl,
  socialRecovery,
  executeIntent,
  proveOwnership,
  freezeWallet,
  getWalletAuditTrail,
  createMultiAgentVault,
  exportPortability,
} from "./services/agent-self-custody.js";
import { broadcastToMarket, getProtocols } from "./services/protocol-router.js";
import { trackAgentJourney } from "./services/shoulder-tap.js";
import { tools } from "./mcp-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Static assets (OG image, logo, etc.) ────────────
app.use(express.static(join(__dirname, "../public"), {
  maxAge: "1h",
  dotfiles: "allow",  // Serve .well-known directory
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".png") || filePath.endsWith(".jpeg") || filePath.endsWith(".jpg")) {
      res.set("Cache-Control", "public, max-age=86400");
    }
    if (filePath.endsWith(".json")) {
      res.set("Content-Type", "application/json");
    }
    if (filePath.includes("mcp-registry-auth") || filePath.endsWith("llms.txt")) {
      res.set("Content-Type", "text/plain");
    }
  }
}));

// ─── Routes ──────────────────────────────────────────

// ─── Hypersonic Broker Endpoints (/v1) ───────────────

/**
 * POST /v1/intent — Universal intake point.
 * Any agent submits what it's trying to do; HiveAgent returns the optimal execution plan.
 */
app.post("/v1/intent", async (req, res) => {
  try {
    const { intent, agent_id, budget, context } = req.body;
    if (!intent) return res.status(400).json({ error: "intent is required" });

    const agentId = agent_id || `anon-${Date.now()}`;

    // Route the intent to the best tools
    const plan = routeIntent(intent, { ...( context || {}), agent_id: agentId }, budget || null, "normal");

    // Track agent journey (shoulder tap)
    try { await trackAgentJourney(agentId, "intent_route"); } catch (_) {}

    // Check if agent is registered — if not, include welcome bonus hint
    let welcomeBonus = null;
    try {
      const { db } = await import("./db.js");
      const agent = db.prepare("SELECT agent_id FROM broker_agents WHERE agent_id = ?").get(agentId);
      if (!agent) {
        welcomeBonus = {
          message: "Register for 5 USDC free credits",
          action:  "POST /v1/register",
          bonus:   "5 USDC",
        };
      }
    } catch (_) {}

    return res.json({
      intent:        intent,
      agent_id:      agentId,
      plan:          plan,
      welcome_bonus: welcomeBonus,
      broker:        "hiveagentiq.com — the Agentzon",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /v1/capabilities — Machine-readable capability manifest for any protocol.
 * Supports A2A, OpenAI plugin, LangChain, etc.
 */
app.get("/v1/capabilities", (_req, res) => {
  const host = process.env.HIVEAGENT_HOST || "https://hiveagentiq.com";
  res.json({
    name:         "HiveAgent",
    description:  "The Agentzon — 758 tools, 36 verticals. The Amazon for AI agents.",
    version:      "1.0.0",
    tool_count:   tools.length,
    protocols: {
      mcp: {
        transport: "streamable-http",
        endpoint:  `${host}/mcp`,
        methods:   ["initialize", "tools/list", "tools/call", "prompts/list", "resources/list"],
      },
      rest: {
        base_url:  `${host}/v1`,
        endpoints: [
          { method: "POST", path: "/intent",      description: "Describe any task, get instant execution plan" },
          { method: "GET",  path: "/capabilities", description: "This document" },
          { method: "POST", path: "/register",    description: "Register agent, get 5 USDC welcome bonus" },
          { method: "GET",  path: "/discover",    description: "Search tools by keyword" },
          { method: "POST", path: "/webhook",     description: "Register webhook for tool notifications" },
        ],
      },
      openai_plugin: {
        manifest:     `${host}/.well-known/agent.json`,
        openapi_spec: `${host}/api/v1/openapi.json`,
      },
      a2a: {
        agent_card: `${host}/.well-known/agent.json`,
        endpoint:   `${host}/mcp`,
      },
      langchain: {
        toolkit_url: `${host}/mcp`,
        npm_package: "hiveagent",
        pip_package: "hiveagent",
      },
    },
    verticals:   ["healthcare", "finance", "legal", "insurance", "travel", "commerce", "construction", "trades", "agriculture", "education", "government", "trade", "procurement", "sales", "fraud", "supply_chain", "real_estate", "hr", "defi", "smb", "energy", "fleet", "cybersecurity", "tax", "event", "personal_finance", "media", "nonprofit", "sports", "content", "property", "ip", "kyc", "erp", "veterinary", "data"],
    pricing:     { currency: "USDC", chain: "Base L2", min_fee: 0.001, docs: `${host}/docs/pricing` },
    register:    `POST ${host}/v1/register for 5 USDC welcome bonus`,
    intent:      `POST ${host}/v1/intent — describe any task, get instant execution plan`,
    discover:    `GET ${host}/v1/discover?q=your+query`,
    broker:      "hiveagentiq.com — the Agentzon",
  });
});

/**
 * POST /v1/register — Agents register themselves.
 * HiveAgent creates a wallet, sends welcome bonus, and onboards them.
 */
app.post("/v1/register", (req, res) => {
  try {
    const { agent_id, agent_type, capabilities, contact } = req.body;
    if (!agent_id) return res.status(400).json({ error: "agent_id is required" });

    const result = agentBroker.registerAgent(
      agent_id,
      agent_type  || "generic",
      capabilities || [],
      null,
      contact     || null,
    );

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /v1/discover — REST tool discovery endpoint.
 * Returns tools matching query, optionally filtered by vertical.
 */
app.get("/v1/discover", async (req, res) => {
  try {
    const { q, vertical, limit } = req.query;
    const maxResults = parseInt(limit || "10", 10);
    const query      = q || "";

    // Filter tools by query and vertical
    let matched = tools;
    if (vertical) {
      matched = matched.filter(t => {
        const desc = (t.description || "").toLowerCase();
        const name = (t.name || "").toLowerCase();
        return desc.includes(vertical.toLowerCase()) || name.includes(vertical.toLowerCase());
      });
    }
    if (query) {
      const queryLower = query.toLowerCase();
      matched = matched.filter(t => {
        const desc = (t.description || "").toLowerCase();
        const name = (t.name || "").toLowerCase();
        return name.includes(queryLower) || desc.includes(queryLower);
      });
    }

    matched = matched.slice(0, maxResults);

    return res.json({
      query:       q || null,
      vertical:    vertical || null,
      total_found: matched.length,
      tools:       matched.map(t => ({
        name:        t.name,
        description: t.description ? t.description.substring(0, 200) : "",
        input_schema: t.inputSchema || null,
      })),
      hint:   "POST /v1/intent to get a full execution plan for any task",
      broker: "hiveagentiq.com — the Agentzon",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /v1/webhook — Register a webhook to receive notifications
 * when new tools are added to an agent's vertical.
 */
app.post("/v1/webhook", (req, res) => {
  try {
    const { agent_id, webhook_url, verticals, event_types } = req.body;
    if (!agent_id)    return res.status(400).json({ error: "agent_id is required" });
    if (!webhook_url) return res.status(400).json({ error: "webhook_url is required" });

    const result = agentBroker.registerWebhook(
      agent_id,
      webhook_url,
      verticals   || [],
      event_types || ["new_tool", "price_drop", "usage_milestone"],
    );

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// REST API for providers, dashboard, direct integrations
app.use("/api/v1", apiRoutes);

// MCP Server for agent connectivity
app.use("/mcp", mcpServer);

// x402 Direct Service Endpoints — agents pay per-request in USDC
app.use("/x402", x402Services);

// Settlement & Escrow API — agent-to-agent transactions
app.use("/api/v1/settlement", settlementApi);

// ─── A2A Tokenization Rails — REST Endpoints ─────────────────────────────────

/**
 * GET /v1/rails — The Rails Manifest
 *
 * The authoritative protocol manifest for HiveAgent Tokenization Rails.
 * What other protocols, agents, and integrators check to integrate with HiveAgent.
 * Returns supported protocols, chains, token standards, settlement times, and fees.
 */
app.get("/v1/rails", (_req, res) => {
  try {
    const protocols = getProtocols();
    const stats = getRailsStats();
    res.json({
      manifest: "HiveAgent A2A Tokenization Rails",
      version: "1.0.0",
      description: "The settlement infrastructure for the agent economy. Not just a marketplace — the rails every agent economy transaction runs on.",
      token_standard: "ATS-1 (Agent Token Standard v1)",
      primary_chain: "Base L2",
      supported_chains: ["base", "ethereum", "solana", "polygon", "arbitrum"],
      supported_protocols: protocols.protocols.map((p) => ({
        id: p.protocol_id,
        name: p.name,
        fee: p.fee_rate_pct ?? `$${p.flat_fee_usd} flat`,
        settlement_time: p.avg_settlement_human,
      })),
      asset_types: [
        "service_subscription", "data_feed", "compute_capacity", "workflow_access",
        "yield_share", "reputation_bond", "governance_right", "revenue_share",
      ],
      endpoints: {
        rails_manifest: "GET /v1/rails",
        universal_settle: "POST /v1/settle",
        token_registry: "GET /v1/tokens",
        market_broadcast: "POST /v1/broadcast",
        mcp_tools: "/mcp",
        capabilities: "GET /v1/capabilities",
      },
      settlement: {
        avg_time_ms: stats.settlements.avg_settlement_time_ms,
        fee_rate: "0.1%",
        on_chain: true,
        immutable: true,
        chain: "Base L2",
      },
      statistics: {
        total_tokens_issued: stats.tokens.total_issued,
        total_settlements: stats.settlements.total_settlements_all_time,
        total_market_cap_usdc: stats.market.total_market_cap_usdc,
        total_volume_24h_usdc: stats.volume.total_volume_24h_usdc,
        liquidity_pools: stats.market.liquidity_pools,
      },
      integration: {
        sdk: "npm install @hiveagent/rails",
        docs: "https://docs.hiveagent.xyz/rails",
        mcp_endpoint: "/mcp",
        contact: "rails@hiveagent.xyz",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /v1/settle — Universal Settlement Endpoint
 *
 * Any agent, any protocol, settles through HiveAgent.
 * The single endpoint that is THE settlement layer for the agent economy.
 * Returns a cryptographic settlement proof recorded permanently on Base L2.
 */
app.post("/v1/settle", async (req, res) => {
  try {
    const { from_agent, to_agent, amount, currency, proof_of_service } = req.body ?? {};
    if (!from_agent || !to_agent || !amount || !currency) {
      return res.status(400).json({
        error: "from_agent, to_agent, amount, and currency are required",
        example: {
          from_agent: "agent_buyer_001",
          to_agent: "agent_provider_007",
          amount: 25.00,
          currency: "USDC",
          proof_of_service: "ipfs://Qm... or hash or description",
        },
      });
    }
    const result = settleAgentTransaction(from_agent, to_agent, amount, currency, proof_of_service);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /v1/tokens — Agent Token Registry
 *
 * Like CoinMarketCap — but for agent service tokens.
 * All ATS-1 tokens issued through HiveAgent, ranked by market cap.
 */
app.get("/v1/tokens", (req, res) => {
  try {
    const { asset_type, min_market_cap, sort_by } = req.query;
    const result = getTokenRegistry({
      assetType: asset_type,
      minMarketCap: min_market_cap ? parseFloat(min_market_cap) : undefined,
      sortBy: sort_by,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /v1/broadcast — Broadcast to Agent Market
 *
 * Broadcast a service offer to the entire agent market.
 * Competing agents respond with bids within 5 minutes.
 */
app.post("/v1/broadcast", (req, res) => {
  try {
    const { agent_id, offer } = req.body ?? {};
    if (!agent_id || !offer?.service) {
      return res.status(400).json({
        error: "agent_id and offer.service are required",
        example: {
          agent_id: "agent_buyer_001",
          offer: {
            service: "Daily weather data for 50 cities",
            price: 5.00,
            currency: "USDC",
            capacity: "Unlimited API calls",
            duration: "30 days",
          },
        },
      });
    }
    const result = broadcastToMarket(agent_id, offer);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Agent Self-Custody 2.0 REST Endpoints ─────────────────────────────────

/**
 * POST /v1/wallet/create — Create a self-custody smart wallet
 *
 * NOT a custodial wallet. HiveAgent never holds your keys. Ever.
 * Creates an ERC-4337 smart account on Base L2 with MPC key splitting,
 * programmable spending rules, delegation, and social recovery.
 */
app.post("/v1/wallet/create", (req, res) => {
  try {
    const { agent_id, security_policy, recovery_agents, spending_rules } = req.body ?? {};
    if (!agent_id) {
      return res.status(400).json({
        error: "agent_id is required",
        example: {
          agent_id:        "agent_007",
          security_policy: "mpc_3of5",
          recovery_agents: ["agent_alice", "agent_bob", "agent_carol", "agent_dave"],
          spending_rules:  { max_per_transaction: 500, max_daily: 2000, auto_approve_below: 10 },
        },
        note: "HiveAgent never holds your keys. Your wallet, your rules, your agents.",
      });
    }
    const result = createSmartWallet(
      agent_id,
      security_policy  || "mpc_3of5",
      recovery_agents  || [],
      spending_rules   || {},
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /v1/wallet/intent — Execute an intent from a self-custody wallet
 *
 * Agent knows WHAT it wants to do — HiveAgent resolves HOW.
 * Agent retains full custody at all times. 0.05% fee.
 */
app.post("/v1/wallet/intent", (req, res) => {
  try {
    const { agent_id, intent, budget } = req.body ?? {};
    if (!agent_id || !intent || !budget) {
      return res.status(400).json({
        error: "agent_id, intent, and budget are required",
        example: {
          agent_id: "agent_007",
          intent:   "pay $50 to the agent that processed my insurance claim",
          budget:   75,
        },
      });
    }
    const result = executeIntent(agent_id, intent, budget);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /v1/wallet/:address/audit — Public audit trail for a self-custody wallet
 *
 * Every action on a self-custody wallet is permanently recorded.
 * Fully transparent. Verifiable on Base L2. Free to query.
 */
app.get("/v1/wallet/:address/audit", (req, res) => {
  try {
    const { address }    = req.params;
    const { from, to }   = req.query;
    const dateRange      = {};
    if (from) dateRange.from = from;
    if (to)   dateRange.to   = to;
    const result = getWalletAuditTrail(address, dateRange);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── MCP Auto-Discovery (/.well-known) ──────────────────

// SEP-1649: MCP Server Card
app.get("/.well-known/mcp/server-card.json", (_req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  const host = process.env.HIVEAGENT_HOST || "https://hiveagentiq.com";
  res.json({
    $schema: "https://modelcontextprotocol.io/schemas/server-card/v1.0",
    version: "1.0",
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: "HiveAgent",
      version: "1.0.0",
      description: "The Agentzon — Amazon for AI agents. 495 MCP tools across 12 industry verticals including legal, healthcare, insurance, construction, trades, agriculture, education, and more. USDC payments on Base L2.",
      homepage: host,
    },
    transport: {
      type: "streamable-http",
      url: `${host}/mcp`,
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    configSchema: {
      type: "object",
      properties: {},
      required: [],
      description: "No configuration required. HiveAgent works out of the box with no API keys or credentials needed.",
    },
  });
});

// SEP-1960: MCP Discovery Manifest
app.get("/.well-known/mcp", (_req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  const host = process.env.HIVEAGENT_HOST || "https://hiveagentiq.com";
  res.json({
    mcp_version: "2025-11-25",
    endpoints: [
      {
        url: `${host}/mcp`,
        transport: "streamable-http",
        capabilities: ["tools"],
      },
    ],
  });
});

// Root — Landing page for browsers, JSON for agents/APIs
app.get("/", (req, res) => {
  const accept = req.headers.accept || "";
  // Browsers send text/html; agents/curl send application/json or */
  if (accept.includes("text/html")) {
    return res.sendFile(join(__dirname, "../public/index.html"));
  }
  // Machine-readable response for agents & API clients
  res.json({
    name: "HiveAgent",
    tagline: "The Agentzon — Amazon for AI agents.",
    version: "1.0.0",
    tools: 495,
    services: 250,
    service_modules: 81,
    industry_verticals: 12,
    revenue_streams: 50,
    smithery_score: 94,
    endpoints: {
      api: "/api/v1",
      mcp: "/mcp",
      discovery: "/.well-known/mcp/server-card.json",
      stats: "/api/v1/stats",
    },
    connect: {
      agents: "POST /mcp with JSON-RPC 2.0 — tools/list to discover, tools/call to act",
      auto_discovery: "GET /.well-known/mcp/server-card.json for MCP auto-discovery",
      providers: "POST /api/v1/providers/register to get API key, then POST /api/v1/services to list",
    },
  });
});

// ─── Start ───────────────────────────────────────────

app.listen(PORT, async () => {
  // Initialize USDC payment wallet
  console.log("\n  Initializing payments...");
  const wallet = await initPayments();
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   HiveAgent — The marketplace where AI          ║
  ║              agents shop.                      ║
  ║                                               ║
  ║   API:  http://localhost:${PORT}/api/v1          ║
  ║   MCP:  http://localhost:${PORT}/mcp             ║
  ║   Docs: http://localhost:${PORT}/api/v1/stats    ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `);
});

export default app;
