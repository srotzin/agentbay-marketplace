import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import apiRoutes from "./routes/api.js";
import mcpServer from "./mcp-server.js";
import x402Services from "./routes/x402-services.js";
import settlementApi from "./routes/settlement-api.js";
import { initPayments } from "./services/payments.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Static assets (OG image, logo, etc.) ────────────
app.use(express.static(join(__dirname, "../public"), {
  maxAge: "1h",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".png") || filePath.endsWith(".jpeg") || filePath.endsWith(".jpg")) {
      res.set("Cache-Control", "public, max-age=86400");
    }
  }
}));

// ─── Routes ──────────────────────────────────────────

// REST API for providers, dashboard, direct integrations
app.use("/api/v1", apiRoutes);

// MCP Server for agent connectivity
app.use("/mcp", mcpServer);

// x402 Direct Service Endpoints — agents pay per-request in USDC
app.use("/x402", x402Services);

// Settlement & Escrow API — agent-to-agent transactions
app.use("/api/v1/settlement", settlementApi);

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
