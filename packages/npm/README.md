# @hiveagentiq/mcp-client

**Connect to HiveAgent — 586 MCP tools across 22 industry verticals.**

The Amazon for AI agents. One npm install gives your agent access to insurance claims, legal document processing, healthcare billing, fraud detection, real estate, supply chain, travel booking, and 15 more verticals — all via the Model Context Protocol.

```bash
npm install @hiveagentiq/mcp-client
```

Requires Node.js 18+ (uses native `fetch` and `crypto.randomUUID()`).

---

## Quickstart

### Discover tools

```js
import { discover } from "@hiveagentiq/mcp-client";

const results = await discover("process insurance claims automatically");
for (const tool of results.tools) {
  console.log(tool.name, "—", tool.description);
}
```

### Call a tool

```js
import { callTool } from "@hiveagentiq/mcp-client";

const result = await callTool("insurance_claim_intake", {
  policy_number: "POL-12345",
  incident_date: "2025-01-15",
  description: "Water damage to basement",
});
console.log(result);
```

### Suggest a workflow

```js
import { suggestWorkflow } from "@hiveagentiq/mcp-client";

const workflow = await suggestWorkflow(
  "Process an end-to-end insurance claim from intake to settlement"
);
for (const step of workflow.steps) {
  console.log(`${step.order}. ${step.tool} — ${step.description}`);
}
```

---

## Full Client

```js
import { HiveAgent } from "@hiveagentiq/mcp-client";

const client = new HiveAgent();

// List all available tools
const tools = await client.listTools();
console.log(`${tools.length} tools available`);

// Call a specific tool
const result = await client.callTool("fraud_screen_transaction", {
  transaction_id: "TXN-98765",
  amount: 4999.99,
  merchant: "Unknown Merchant LLC",
});

// Discover tools semantically
const discovery = await client.discover("validate supplier invoices");

// Get a workflow
const wf = await client.suggestWorkflow("full procurement cycle");

// Get a vertical guide
const guide = await client.verticalGuide("legal");
```

### Custom endpoint or API key

```js
import { HiveAgent } from "@hiveagentiq/mcp-client";

const client = new HiveAgent("https://hiveagentiq.com/mcp", {
  apiKey: "your-api-key",
  timeout: 60_000,
});
```

---

## Available Exports

| Export | Type | Description |
|---|---|---|
| `HiveAgent` | class | Full MCP client |
| `HiveAgentError` | class | Error thrown on API failures |
| `discover(query)` | function | Shortcut: semantic tool discovery |
| `callTool(name, args)` | function | Shortcut: call a tool |
| `suggestWorkflow(task)` | function | Shortcut: get a workflow |
| `listTools()` | function | Shortcut: list all tools |
| `listVerticals()` | function | List all 22 verticals (static) |
| `VERTICALS` | array | Static list of vertical names |

---

## Available Verticals

insurance · legal · healthcare · construction · trades · smb · commerce · fraud_detection · real_estate · supply_chain · travel · sales_crm · invoice_ap · hr_recruiting · dynamic_pricing · procurement · know_your_agent · trade_customs · defi · agriculture · agent_recovery · advertising

---

## Full Documentation

[hiveagentiq.com/docs](https://hiveagentiq.com/docs)
