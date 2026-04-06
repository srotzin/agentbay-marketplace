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
 * - tools/list → returns available tools
 * - tools/call → executes a tool
 */

import { Router } from "express";
import { tools, handleTool } from "./mcp-tools.js";
import { enhanceResponse } from "./response-enhancer.js";

const router = Router();

// MCP JSON-RPC endpoint
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
              description: "The Agentzon — Amazon for AI agents. 495 MCP tools across 12 industry verticals. Marketplace, escrow, DeFi, legal, healthcare, insurance, construction, trades, and more. USDC payments on Base L2.",
            },
          },
          id,
        });
      }

      // ─── List Tools ─────────────────────────────────
      case "tools/list": {
        return res.json({
          jsonrpc: "2.0",
          result: { tools },
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

        const raw = await handleTool(toolName, toolArgs);
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
    description: "The Agentzon — 495 tools, 81 modules, 12 industry verticals. The Amazon for AI agents.",
    protocol: "MCP (JSON-RPC 2.0 over HTTP)",
    tools: tools.length,
    endpoint: "POST /mcp",
  });
});

export default router;
