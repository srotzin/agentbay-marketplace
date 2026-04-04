/**
 * HiveAgent MCP Server Crawler
 *
 * Discovers and indexes MCP servers across the internet.
 * This is Phase 2 — the Index. Makes HiveAgent the search engine
 * for the entire agent economy.
 *
 * Discovery methods:
 * 1. Smithery registry — crawl all listed MCP servers
 * 2. /.well-known/mcp.json probing — check known domains
 * 3. GitHub search — find repos with mcp-server in package.json
 * 4. Manual seed list — known MCP servers to bootstrap
 *
 * Run: node src/crawler/index.js
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "..", "data", "mcp-index.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    version TEXT,
    protocol_version TEXT,
    transport_type TEXT,
    transport_url TEXT,
    has_tools INTEGER DEFAULT 0,
    has_resources INTEGER DEFAULT 0,
    has_prompts INTEGER DEFAULT 0,
    tool_count INTEGER DEFAULT 0,
    tools_json TEXT,                    -- JSON array of tool definitions
    categories TEXT DEFAULT '[]',       -- Inferred categories
    health_status TEXT DEFAULT 'unknown', -- 'healthy', 'degraded', 'down', 'unknown'
    last_checked TEXT,
    last_healthy TEXT,
    response_time_ms INTEGER,
    source TEXT,                        -- 'smithery', 'wellknown', 'github', 'manual'
    discovered_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crawl_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    source TEXT,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',      -- 'pending', 'crawling', 'done', 'failed'
    attempts INTEGER DEFAULT 0,
    last_attempt TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crawl_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT NOT NULL,               -- 'success', 'error', 'timeout'
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    tools_found INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_servers_health ON mcp_servers(health_status);
  CREATE INDEX IF NOT EXISTS idx_servers_tools ON mcp_servers(tool_count);
  CREATE INDEX IF NOT EXISTS idx_queue_status ON crawl_queue(status, priority);
`);

// ─── Seed: Known MCP Servers ─────────────────────

const SEED_SERVERS = [
  // Major platforms with known MCP servers
  { url: "https://smithery.ai", source: "manual" },
  { url: "https://mcpmarket.com", source: "manual" },
  { url: "https://mcp.run", source: "manual" },
  { url: "https://glama.ai/mcp", source: "manual" },

  // Known service MCP servers from our research
  { url: "https://the402.ai", source: "manual" },
  { url: "https://marketplace--agentpmt.run.tools", source: "smithery" },
  { url: "https://marketplace--agentpact.run.tools", source: "smithery" },

  // Developer tool MCP servers
  { url: "https://api.firecrawl.dev", source: "manual" },
  { url: "https://browserbase.com", source: "manual" },

  // Data providers
  { url: "https://api.nansen.ai", source: "manual" },

  // x402 bazaar services
  { url: "https://bazaar.x402.org", source: "manual" },
];

// ─── Crawler Functions ───────────────────────────

async function fetchJSON(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "HiveAgent-Crawler/1.0 (https://thehiveagent.ai)" },
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    if (!res.ok) return { ok: false, status: res.status, elapsed };

    const data = await res.json();
    return { ok: true, data, status: res.status, elapsed };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, error: e.message, elapsed: Date.now() - start };
  }
}

/**
 * Probe a domain for MCP server discovery endpoints
 */
async function probeDomain(baseUrl) {
  const results = { serverCard: null, manifest: null, mcpInfo: null };

  // Try SEP-1649: /.well-known/mcp/server-card.json
  const cardUrl = `${baseUrl}/.well-known/mcp/server-card.json`;
  const card = await fetchJSON(cardUrl);
  if (card.ok && card.data?.serverInfo) {
    results.serverCard = card.data;
  }

  // Try SEP-1960: /.well-known/mcp
  const manifestUrl = `${baseUrl}/.well-known/mcp`;
  const manifest = await fetchJSON(manifestUrl);
  if (manifest.ok && card.data?.endpoints) {
    results.manifest = manifest.data;
  }

  // Try direct MCP endpoint
  const mcpUrl = `${baseUrl}/mcp`;
  const mcp = await fetchJSON(mcpUrl);
  if (mcp.ok) {
    results.mcpInfo = mcp.data;
  }

  return results;
}

/**
 * Get tools from an MCP server via JSON-RPC
 */
async function getMCPTools(mcpEndpoint) {
  try {
    const res = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HiveAgent-Crawler/1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 1,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.tools || null;
  } catch {
    return null;
  }
}

/**
 * Infer categories from tool names and descriptions
 */
function inferCategories(tools) {
  if (!tools || !tools.length) return [];

  const text = tools.map((t) => `${t.name} ${t.description || ""}`).join(" ").toLowerCase();
  const cats = new Set();

  const patterns = {
    search: /search|web|crawl|scrape|browse|serp/,
    ai: /summariz|classif|sentiment|embed|nlp|llm|generat|inference/,
    code: /code|review|test|deploy|ci.?cd|security|vulnerab|dependen/,
    media: /image|video|audio|transcri|photo|music|voice/,
    translation: /translat|language|locali|ocr/,
    finance: /stock|market|crypto|price|financ|trading|forex|invest/,
    data: /data|enrich|verif|contact|email|address|geocod/,
    legal: /legal|patent|trademark|court|filing|contract|compliance|kyc|aml/,
    communication: /email|sms|messag|phone|call|voice|notif|webhook/,
    logistics: /ship|track|book|travel|flight|hotel|restaurant|procure/,
    infrastructure: /compute|gpu|server|storage|hosting|cdn|identity|reput/,
    physical: /drone|3d.?print|robot|iot|sensor|manufactur/,
    human: /research|writing|design|consult|freelance/,
  };

  for (const [cat, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) cats.add(cat);
  }

  return [...cats];
}

/**
 * Index a single MCP server
 */
async function indexServer(url, source = "manual") {
  console.log(`  Probing: ${url}`);

  const probe = await probeDomain(url);
  let serverInfo = null;
  let tools = null;
  let transportUrl = null;

  // Extract server info from discovery
  if (probe.serverCard) {
    serverInfo = probe.serverCard.serverInfo;
    transportUrl = probe.serverCard.transport?.url;
  }

  // Try to get tools
  const mcpEndpoints = [
    transportUrl,
    `${url}/mcp`,
    url,
  ].filter(Boolean);

  for (const endpoint of mcpEndpoints) {
    tools = await getMCPTools(endpoint);
    if (tools) {
      transportUrl = endpoint;
      break;
    }
  }

  const categories = inferCategories(tools);

  // Upsert into database
  db.prepare(`
    INSERT INTO mcp_servers (url, name, description, version, protocol_version, 
      transport_type, transport_url, has_tools, tool_count, tools_json, categories,
      health_status, last_checked, response_time_ms, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      tool_count = excluded.tool_count, tools_json = excluded.tools_json,
      categories = excluded.categories, health_status = excluded.health_status,
      last_checked = datetime('now'), response_time_ms = excluded.response_time_ms,
      updated_at = datetime('now')
  `).run(
    url,
    serverInfo?.name || probe.mcpInfo?.name || null,
    serverInfo?.description || probe.mcpInfo?.description || null,
    serverInfo?.version || probe.mcpInfo?.version || null,
    probe.serverCard?.protocolVersion || null,
    probe.serverCard?.transport?.type || "http",
    transportUrl,
    tools ? 1 : 0,
    tools?.length || 0,
    tools ? JSON.stringify(tools) : null,
    JSON.stringify(categories),
    tools ? "healthy" : (probe.serverCard ? "degraded" : "unknown"),
    0,
    source
  );

  // Log the crawl
  db.prepare(`
    INSERT INTO crawl_log (url, status, tools_found)
    VALUES (?, ?, ?)
  `).run(url, tools ? "success" : "partial", tools?.length || 0);

  const status = tools ? `${tools.length} tools` : (probe.serverCard ? "card found, no tools" : "no discovery");
  console.log(`    → ${serverInfo?.name || "unknown"}: ${status} [${categories.join(", ") || "uncategorized"}]`);

  return { url, name: serverInfo?.name, tools: tools?.length || 0, categories };
}

/**
 * Crawl Smithery registry for MCP servers
 */
async function crawlSmitheryRegistry() {
  console.log("\nCrawling Smithery registry...");
  const res = await fetchJSON("https://registry.smithery.ai/servers?pageSize=100");
  if (!res.ok) {
    console.log("  Failed to fetch Smithery registry");
    return [];
  }

  const servers = res.data?.servers || res.data || [];
  console.log(`  Found ${servers.length} servers on Smithery`);

  const results = [];
  for (const server of servers.slice(0, 50)) { // Limit to first 50 for now
    const url = server.url || server.endpoint || `https://${server.qualifiedName}--smithery.run.tools`;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO crawl_queue (url, source, priority)
        VALUES (?, 'smithery', 1)
      `).run(url);
    } catch {}
  }

  return servers.length;
}

// ─── Stats ───────────────────────────────────────

function getIndexStats() {
  const total = db.prepare("SELECT COUNT(*) as count FROM mcp_servers").get().count;
  const healthy = db.prepare("SELECT COUNT(*) as count FROM mcp_servers WHERE health_status = 'healthy'").get().count;
  const totalTools = db.prepare("SELECT COALESCE(SUM(tool_count), 0) as total FROM mcp_servers").get().total;
  const queued = db.prepare("SELECT COUNT(*) as count FROM crawl_queue WHERE status = 'pending'").get().count;

  return { total_servers: total, healthy_servers: healthy, total_tools: totalTools, queued };
}

// ─── Main ────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  HiveAgent MCP Server Crawler v1.0");
  console.log("  Phase 2: The Index");
  console.log("═══════════════════════════════════════════\n");

  // Step 1: Seed known servers
  console.log("Step 1: Indexing seed servers...");
  const seedResults = [];
  for (const seed of SEED_SERVERS) {
    try {
      const result = await indexServer(seed.url, seed.source);
      seedResults.push(result);
    } catch (e) {
      console.log(`    ✗ ${seed.url}: ${e.message}`);
    }
  }

  // Step 2: Try Smithery registry
  try {
    await crawlSmitheryRegistry();
  } catch (e) {
    console.log(`  Smithery crawl failed: ${e.message}`);
  }

  // Step 3: Report
  const stats = getIndexStats();
  console.log("\n═══════════════════════════════════════════");
  console.log("  CRAWL COMPLETE");
  console.log(`  Servers indexed:  ${stats.total_servers}`);
  console.log(`  Healthy servers:  ${stats.healthy_servers}`);
  console.log(`  Total tools:      ${stats.total_tools}`);
  console.log(`  Queued for crawl: ${stats.queued}`);
  console.log("═══════════════════════════════════════════\n");
}

export { indexServer, probeDomain, getMCPTools, getIndexStats, db as crawlerDb };

// Run if called directly
if (process.argv[1]?.includes("crawler")) {
  main().catch(console.error);
}
