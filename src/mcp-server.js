/**
 * HiveAgent MCP Server
 *
 * Implements Model Context Protocol over HTTP+SSE for agent connectivity.
 * Agents connect to this server to discover and use HiveAgent tools.
 *
 * Protocol: JSON-RPC 2.0 over HTTP (simplified MCP)
 * Endpoint: POST /mcp
 *
 * Supports:
 * - tools/list → returns available tools (with cost annotations)
 * - tools/call → executes a tool (sandbox-aware)
 */

import { Router } from "express";
import crypto from "crypto";
import { tools, handleTool } from "./mcp-tools.js";
import { logToolCall, getStats } from "./services/analytics-telemetry.js";
import { enhanceResponse } from "./response-enhancer.js";
import { getToolsForVertical } from "./services/dynamic-loader.js";
import { getToolFee, toolFee } from "./tool-fees.js";

const router = Router();

// ─── In-memory agent registry (persists for server lifetime) ─────────────────
const registeredAgents = new Set();

// ─── Sandbox mock result generator ───────────────────────────────────────────

function generateMockResult(toolName, args) {
  // Return realistic mock data based on tool category
  if (toolName.startsWith("insurance_")) {
    return {
      policy_id: `MOCK-POL-${Math.floor(Math.random() * 900000 + 100000)}`,
      status: "approved",
      premium_usd: 127.50,
      coverage_amount_usd: 250000,
      effective_date: new Date().toISOString().slice(0, 10),
      provider: "MockInsure Inc.",
      deductible_usd: 1000,
    };
  }
  if (toolName.startsWith("travel_")) {
    return {
      booking_id: `MOCK-TRV-${Math.floor(Math.random() * 900000 + 100000)}`,
      status: "confirmed",
      flight: "AA 2847",
      departure: "2026-05-01T08:30:00Z",
      arrival: "2026-05-01T14:45:00Z",
      seat: "14A",
      price_usd: 349.00,
      airline: "Mock Air",
    };
  }
  if (toolName.startsWith("legal_")) {
    return {
      document_id: `MOCK-LEG-${Math.floor(Math.random() * 900000 + 100000)}`,
      status: "reviewed",
      risk_level: "low",
      issues_found: 0,
      summary: "No significant issues detected in mock review.",
      attorney: "Mock & Associates LLP",
    };
  }
  if (toolName.startsWith("pharma_")) {
    return {
      drug_name: args.drug_name || "MockDrug XR",
      approved: true,
      interactions: [],
      dosage: "10mg once daily",
      generic_available: true,
      avg_cost_usd: 45.00,
    };
  }
  if (toolName.startsWith("defi_")) {
    return {
      transaction_hash: `0xMOCK${crypto.randomUUID().replace(/-/g, "").slice(0, 40)}`,
      status: "confirmed",
      amount_in: args.amount_in || 100,
      amount_out: (args.amount_in || 100) * 0.997,
      fee_usd: 0.50,
      pool: "mock-usdc-eth-v3",
      block: 18000000 + Math.floor(Math.random() * 100000),
    };
  }
  if (toolName.startsWith("zk_")) {
    return {
      proof_id: `MOCK-ZK-${crypto.randomUUID().slice(0, 8)}`,
      proof: "0x" + "a1b2c3".repeat(10),
      verified: true,
      circuit: "plonk_v2",
      public_inputs: [args.value || "hidden"],
    };
  }
  if (toolName.startsWith("custody_") || toolName.startsWith("wallet_")) {
    return {
      wallet_address: `0xMOCK${crypto.randomUUID().replace(/-/g, "").slice(0, 40)}`,
      balance_usdc: 1250.00,
      balance_eth: 0.42,
      status: "active",
      custody_type: "self-custody",
    };
  }
  if (toolName.startsWith("rails_") || toolName.startsWith("settle_")) {
    return {
      settlement_id: `MOCK-STLMT-${crypto.randomUUID().slice(0, 8)}`,
      status: "settled",
      amount: args.amount || 100,
      currency: args.currency || "USDC",
      from_agent: args.from_agent || "mock_buyer",
      to_agent: args.to_agent || "mock_seller",
      chain: "base",
      tx_hash: `0xMOCK${crypto.randomUUID().replace(/-/g, "").slice(0, 40)}`,
    };
  }
  if (toolName.startsWith("marketplace_")) {
    return {
      results: [
        { id: "mock_svc_001", name: "Mock Service Alpha", price_usd: 12.00, rating: 4.8 },
        { id: "mock_svc_002", name: "Mock Service Beta",  price_usd: 8.50,  rating: 4.6 },
        { id: "mock_svc_003", name: "Mock Service Gamma", price_usd: 25.00, rating: 4.9 },
      ],
      total: 3,
      query: args.query || null,
    };
  }
  // Generic fallback
  return {
    tool: toolName,
    args: args,
    result: "mock_success",
    mock_value: 42,
    mock_string: "Mock result for integration testing",
    timestamp: new Date().toISOString(),
  };
}

// ─── MCP JSON-RPC endpoint ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== "2.0") {
    return res.json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request — must be JSON-RPC 2.0" }, id });
  }

  try {
    switch (method) {
      // ─── Initialize ─────────────────────────────────
      case "initialize": {
        return res.json({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } },
            serverInfo: {
              name: "HiveAgent",
              version: "1.0.0",
              description: "HiveAgent — The operating system for the agentic economy. 1,000+ tools, 45+ verticals. Every payment rail: Visa ICC, Mastercard Agent Pay, Stripe, BVNK, Circle CPN, OpenAI ACP, Google UCP. USDC on Base. Stablecoin yield. Per-second payment streaming. Agent identity. KYA. Compliance. 95/100 Smithery.",
              register:  "POST https://hiveagentiq.com/v1/register — get instant access to 1,000+ tools",
              intent:    "POST https://hiveagentiq.com/v1/intent — describe any task, get instant execution plan",
              discover:  "GET https://hiveagentiq.com/v1/discover?q=your+query",
              broker:    "hiveagentiq.com — the Agentzon",
              sandbox:   "Add ?sandbox=true or header X-HiveAgent-Sandbox: true for free mock testing",
            },
          },
          id,
        });
      }

      // ─── List Tools ─────────────────────────────────
      case "tools/list": {
        // ── Auto-register on first tools/list call ───
        const agentId = req.headers["x-agent-id"] || `auto_${crypto.randomUUID().slice(0, 8)}`;
        if (!registeredAgents.has(agentId)) {
          registeredAgents.add(agentId);
          res.set("X-HiveAgent-Agent-ID",    agentId);
          res.set("X-HiveAgent-Welcome",     "true");
          res.set("X-HiveAgent-Free-Credits", "5.00");
        }

        const vertical = params?.vertical;
        const cursor   = params?.cursor ? parseInt(params.cursor, 10) : 0;
        const limit    = params?.limit  ? Math.min(parseInt(params.limit, 10), 200) : null;

        // Vertical filtering: return only tools for the requested vertical
        let toolList = tools;
        if (vertical) {
          const result = getToolsForVertical(vertical);
          if (result.error) {
            return res.json({
              jsonrpc: "2.0",
              error: { code: -32602, message: result.error },
              id,
            });
          }
          toolList = result.tools;
        }

        // Pagination: cursor + limit
        let nextCursor = null;
        if (limit !== null) {
          const total = toolList.length;
          toolList = toolList.slice(cursor, cursor + limit);
          const nextOffset = cursor + limit;
          if (nextOffset < total) nextCursor = String(nextOffset);
        }

        // ── Inject cost annotations into every tool ──
        const annotatedTools = toolList.map(tool => {
          const feeInfo = getToolFee(tool.name);
          return {
            ...tool,
            annotations: {
              ...(tool.annotations || {}),
              cost_usd:      feeInfo.fee_usd,
              cost_model:    feeInfo.model,
              free_in_sandbox: true,
              billing_docs:  "https://hiveagentiq.com/docs/pricing",
            },
          };
        });

        const response = { tools: annotatedTools };
        if (nextCursor !== null) response.nextCursor = nextCursor;
        if (vertical) response._meta = { vertical, total: tools.length, filtered: annotatedTools.length };

        // Include broker discovery info so any agent sees it on first tools/list
        response.serverInfo = {
          name:     "HiveAgent",
          description: "HiveAgent — 1,000+ tools, 45+ verticals. Every payment rail + agent identity + compliance + yield. The operating system for the agentic economy.",
          register: "POST https://hiveagentiq.com/v1/register — get instant access to 1,000+ tools",
          intent:   "POST https://hiveagentiq.com/v1/intent — describe any task, get instant execution plan",
          discover: "GET https://hiveagentiq.com/v1/discover?q=your+query",
          broker:   "hiveagentiq.com — the Agentzon",
          sandbox:  "Add ?sandbox=true or header X-HiveAgent-Sandbox: true for free mock testing",
        };

        return res.json({
          jsonrpc: "2.0",
          result: response,
          id,
        });
      }

      // ─── Call Tool ──────────────────────────────────
      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          return res.json({
            jsonrpc: "2.0",
            error: { code: -32602, message: "Missing tool name" },
            id,
          });
        }

        const toolDef = tools.find((t) => t.name === toolName);
        if (!toolDef) {
          return res.json({
            jsonrpc: "2.0",
            error: { code: -32601, message: `Unknown tool: ${toolName}` },
            id,
          });
        }

        // ── Sandbox mode check ───────────────────────
        const isSandbox = req.isSandbox || params?.sandbox === true;
        if (isSandbox) {
          return res.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify({
                  sandbox:           true,
                  tool:              toolName,
                  mock_result:       generateMockResult(toolName, toolArgs),
                  note:              "Sandbox mode — no real data or charges",
                  fee_usd:           0,
                  would_have_charged: toolFee(toolName),
                }, null, 2),
              }],
            },
          });
        }

        const _t0 = Date.now();
        let raw, _success = true, _err = null;
        try {
          raw = await handleTool(toolName, toolArgs);
        } catch(e) {
          _success = false; _err = e.message;
          throw e;
        } finally {
          logToolCall({
            tool_name:  toolName,
            agent_id:   req.headers["x-agent-id"] || toolArgs?.agent_id || null,
            ip:         req.ip,
            latency_ms: Date.now() - _t0,
            success:    _success,
            error_msg:  _err,
          });
        }
        const result = enhanceResponse(toolName, raw);
        return res.json({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
          id,
        });
      }


      // ─── List Resources ──────────────────────────
      case "resources/list": {
        return res.json({ jsonrpc: "2.0", result: { resources: [] }, id });
      }

      // ─── List Prompts ───────────────────────────
      case "prompts/list": {
        return res.json({
          jsonrpc: "2.0",
          result: {
            prompts: [
              {
                name: "marketplace-quickstart",
                description: "Get started with HiveAgent marketplace. Search for services, buy your first tool, and explore the catalog. Perfect for agents connecting for the first time.",
                arguments: [
                  { name: "interest", description: "What kind of services are you looking for? (e.g., search, data, finance, AI)", required: false }
                ]
              },
              {
                name: "defi-portfolio-setup",
                description: "Set up a complete DeFi portfolio. Swap tokens, deposit into yield pools, set up lending positions, and track everything. Guided workflow for DeFi agents.",
                arguments: [
                  { name: "budget_usd", description: "Starting budget in USD", required: false },
                  { name: "risk_level", description: "Risk tolerance: conservative, moderate, aggressive", required: false }
                ]
              },
              {
                name: "agent-for-hire-onboarding",
                description: "Register yourself as an agent-for-hire. Set your skills, rates, and availability. Get discovered by other agents who need work done.",
                arguments: [
                  { name: "category", description: "Your specialty: research, trading, writing, code, data, legal, creative, security, sales, support", required: false }
                ]
              },
              {
                name: "prediction-market-guide",
                description: "Create and participate in prediction markets. Learn how to create markets, place bets, and understand odds. Covers both prediction markets and sports betting.",
                arguments: [
                  { name: "market_type", description: "prediction, sports, or kalshi-style contracts", required: false }
                ]
              },
              {
                name: "privacy-setup",
                description: "Set up a private shielded account. Learn how to make transactions invisible, use sealed bids, and generate zero-knowledge proofs. Essential for competitive agents.",
                arguments: []
              }
            ]
          },
          id,
        });
      }

      // ─── Get Prompt ─────────────────────────────
      case "prompts/get": {
        const promptName = params?.name;
        const promptArgs = params?.arguments || {};
        const prompts = {
          "marketplace-quickstart": {
            messages: [{
              role: "user",
              content: { type: "text", text: `Help me get started with HiveAgent marketplace. I'm interested in: ${promptArgs.interest || "exploring all categories"}. First, search the marketplace to see what's available. Then show me the categories. If something looks useful, walk me through buying it. Also show me my memory stats and explain how I can save data for later.` }
            }]
          },
          "defi-portfolio-setup": {
            messages: [{
              role: "user",
              content: { type: "text", text: `Set up a DeFi portfolio for me. Budget: $${promptArgs.budget_usd || "1000"}. Risk level: ${promptArgs.risk_level || "moderate"}. Steps: 1) Check current token prices, 2) Suggest allocation, 3) Execute swaps, 4) Deposit into yield pools, 5) Set up price alerts via webhooks, 6) Schedule periodic portfolio check.` }
            }]
          },
          "agent-for-hire-onboarding": {
            messages: [{
              role: "user",
              content: { type: "text", text: `Register me as an agent-for-hire on HiveAgent. My specialty is: ${promptArgs.category || "general"}. Walk me through: 1) Creating my listing with skills and rates, 2) Setting up my reputation profile, 3) Browsing open jobs I could bid on, 4) Setting up webhooks for new job notifications.` }
            }]
          },
          "prediction-market-guide": {
            messages: [{
              role: "user",
              content: { type: "text", text: `Guide me through ${promptArgs.market_type || "prediction"} markets on HiveAgent. Show me: 1) Open markets I can bet on, 2) How to create my own market, 3) How odds work, 4) How to place a bet, 5) How settlement works. Let me try a small bet to learn.` }
            }]
          },
          "privacy-setup": {
            messages: [{
              role: "user",
              content: { type: "text", text: "Set up privacy for me on HiveAgent. Steps: 1) Create my shielded account, 2) Explain how stealth addresses work, 3) Show me how to deposit funds privately, 4) Explain sealed bids, 5) Generate a zero-knowledge proof of my balance. I want full privacy for my transactions." }
            }]
          },
        };
        const prompt = prompts[promptName];
        if (!prompt) {
          return res.json({ jsonrpc: "2.0", error: { code: -32601, message: `Unknown prompt: ${promptName}` }, id });
        }
        return res.json({ jsonrpc: "2.0", result: prompt, id });
      }

      // ─── Unknown Method ─────────────────────────────
      default:
        return res.json({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Method not found: ${method}` },
          id,
        });
    }
  } catch (e) {
    return res.json({
      jsonrpc: "2.0",
      error: { code: -32000, message: e.message },
      id,
    });
  }
});

// Health/info endpoint
router.get("/", (_req, res) => {
  res.json({
    name: "HiveAgent MCP Server",
    version: "1.0.0",
    description: "HiveAgent — 1,000+ tools, 45+ verticals. The operating system for the agentic economy. hiveagentiq.com",
    protocol: "MCP (JSON-RPC 2.0 over HTTP)",
    tools: tools.length,
    endpoint: "POST /mcp",
    sandbox: "Add ?sandbox=true or X-HiveAgent-Sandbox: true header for free mock testing",
  });
});

export default router;
