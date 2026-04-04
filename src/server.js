import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.js";
import mcpServer from "./mcp-server.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────

// REST API for providers, dashboard, direct integrations
app.use("/api/v1", apiRoutes);

// MCP Server for agent connectivity
app.use("/mcp", mcpServer);

// ─── MCP Auto-Discovery (/.well-known) ──────────────────

// SEP-1649: MCP Server Card
app.get("/.well-known/mcp/server-card.json", (_req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  const host = process.env.HIVEIQ_HOST || "https://thehiveiq.ai";
  res.json({
    $schema: "https://modelcontextprotocol.io/schemas/server-card/v1.0",
    version: "1.0",
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: "HiveIQ",
      version: "1.0.0",
      description: "The nervous system of the agent economy. Search, buy, and auction services across 9 departments, 36+ categories, and 100+ service types. Every agent. Every service. Every transaction. One hive.",
      homepage: host,
    },
    transport: {
      type: "streamable-http",
      url: `${host}/mcp`,
    },
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
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
  const host = process.env.HIVEIQ_HOST || "https://thehiveiq.ai";
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

// Root — HiveIQ info
app.get("/", (_req, res) => {
  res.json({
    name: "HiveIQ",
    tagline: "The nervous system of the agent economy.",
    version: "1.0.0",
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

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   HiveIQ — The marketplace where AI          ║
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
