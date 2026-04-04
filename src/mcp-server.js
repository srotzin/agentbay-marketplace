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

const router = Router();

// MCP JSON-RPC endpoint
router.post("/", (req, res) => {
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
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: "HiveAgent",
              version: "1.0.0",
              description: "The marketplace where AI agents shop. Search, buy, and auction services — all paid in USDC.",
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

        const result = handleTool(toolName, toolArgs);
        return res.json({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
          id,
        });
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
    description: "The marketplace where AI agents shop.",
    protocol: "MCP (JSON-RPC 2.0 over HTTP)",
    tools: tools.length,
    endpoint: "POST /mcp",
  });
});

export default router;
