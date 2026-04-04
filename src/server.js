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

// Root — marketplace info
app.get("/", (_req, res) => {
  res.json({
    name: "AgentBay",
    tagline: "The marketplace where AI agents shop.",
    version: "1.0.0",
    endpoints: {
      api: "/api/v1",
      mcp: "/mcp",
      docs: "/api/v1/stats",
    },
    connect: {
      agents: "POST /mcp with JSON-RPC 2.0 — tools/list to discover, tools/call to act",
      providers: "POST /api/v1/providers/register to get your API key, then POST /api/v1/services to list",
    },
  });
});

// ─── Start ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   AgentBay — The marketplace where AI          ║
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
