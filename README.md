<div align="center">
  <img src="public/assets/logo.jpeg" alt="HiveAgent" width="120">
  <h1>HiveAgent</h1>
  <p><strong>The Agentzon — Amazon for AI Agents</strong></p>
  <p>1,215 MCP tools &nbsp;·&nbsp; 50+ verticals &nbsp;·&nbsp; 18+ workflows &nbsp;·&nbsp; 94% task completion &nbsp;·&nbsp; USDC on Base L2</p>

  [![Smithery](https://smithery.ai/badge/@hiveagentiq/hiveagent)](https://smithery.ai/server/@hiveagentiq/hiveagent)
  [![Completion Rate](https://img.shields.io/badge/Task%20Completion-94%25-brightgreen)](https://hiveagentiq.com)
  [![Tools](https://img.shields.io/badge/MCP%20Tools-835-F59E0B)](https://hiveagentiq.com)
  [![Score](https://img.shields.io/badge/Smithery-95%2F100-brightgreen)](https://smithery.ai/server/@hiveagentiq/hiveagent)
  [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
  [![Protocol](https://img.shields.io/badge/Protocol-MCP%20JSON--RPC%202.0-8B5CF6)](https://hiveagentiq.com/mcp)
</div>

---

## ⚡ Connect in 10 Seconds

Add this to your MCP config and your agent instantly gains 835 real-world tools:

```json
{
  "mcpServers": {
    "hiveagent": {
      "url": "https://hiveagentiq.com/mcp"
    }
  }
}
```

**No API key. No SDK. No signup.** One endpoint, 1,215 tools, live now.

---

## 🗂 What Can Agents Do?

1,215 tools across 50+ verticals. Every tool is callable via a single JSON-RPC 2.0 request.

| Vertical | Tools | Example Tools |
|---|---|---|
| 🏥 Healthcare | 28 | `health_prior_auth`, `health_clinical_note`, `health_claim_codes`, `health_interpret_labs` |
| ⚖️ Legal | 26 | `legal_intake_case`, `legal_search_case_law`, `legal_demand_letter`, `legal_track_deadlines` |
| 🏗️ Construction | 30 | `construction_lookup_zoning`, `construction_permit_status`, `construction_material_takeoff`, `construction_match_subcontractor` |
| 🛡️ Insurance | 28 | `insurance_claim_intake`, `insurance_assess_damage`, `insurance_check_subrogation`, `insurance_adjuster_report` |
| 🔧 Trades | 24 | `trades_lookup_permits`, `trades_estimate_job`, `trades_find_parts`, `trades_generate_invoice` |
| 💼 SMB Finance | 26 | `smb_categorize_transaction`, `smb_prep_tax`, `smb_compare_insurance`, `smb_generate_contract` |
| 🌾 Agriculture | 20 | `ag_identify_crop_issue`, `ag_forecast_yield`, `ag_weather_advisory`, `ag_market_prices` |
| 🏛️ Government | 22 | `gov_lookup_license`, `gov_permit_requirements`, `gov_foia_request`, `gov_monitor_contract_bids` |
| 📦 Trade & Customs | 24 | `trade_classify_hs`, `trade_screen_sanctions`, `trade_calculate_duty`, `trade_generate_customs_docs` |
| 🛒 Commerce | 22 | `commerce_verify_product`, `commerce_merchant_trust`, `commerce_detect_manipulation`, `commerce_risk_assessment` |
| 💱 DeFi | 26 | `hiveagent_defi_swap`, `hiveagent_defi_yield_pools`, `hiveagent_defi_prices`, `hiveagent_stables_convert` |
| 💰 Finance | 22 | `hiveagent_pay_send`, `hiveagent_xborder_transfer`, `hiveagent_savings_deposit`, `hiveagent_credit_apply` |
| ✈️ Travel | 20 | `travel_search_flights`, `travel_search_hotels`, `travel_compare_car_rentals`, `travel_visa_requirements` |
| 🔍 Fraud | 18 | `fraud_screen_transaction`, `fraud_detect_anomalies`, `fraud_check_identity`, `fraud_predict_chargeback` |
| 📊 Sales | 20 | `sales_enrich_lead`, `sales_score_lead`, `sales_generate_outreach`, `sales_forecast_pipeline` |
| 🎓 Education | 18 | `edu_verify_credential`, `edu_generate_curriculum`, `edu_track_progress`, `edu_check_financial_aid` |
| 🔒 Identity | 16 | `hiveagent_privacy_shield`, `hiveagent_rep_score`, `hiveagent_kyc_verify`, `hiveagent_aml_screen` |
| ⚙️ Enterprise | 20 | `hiveagent_webhook_register`, `hiveagent_sched_job`, `hiveagent_audit_log`, `hiveagent_tenant_setup` |
| 🧩 Compliance | 18 | `compliance_sanctions_screen`, `compliance_regulatory_check`, `compliance_report_generate` |
| 🖥️ Compute | 16 | `hiveagent_mem_store`, `hiveagent_code_sandbox`, `compute_gpu_rent`, `compute_inference_run` |
| 🌐 Marketplace | 20 | `hiveagent_search`, `hiveagent_buy`, `hiveagent_auction_create`, `hiveagent_escrow_create` |
| 🔄 Recovery | 16 | `recovery_check_health`, `recovery_circuit_status`, `recovery_initiate_handoff`, `recovery_start_trace` |

<details>
<summary><strong>Browse all tools with the discovery meta-tool</strong></summary>

```bash
curl -s -X POST https://hiveagentiq.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hiveagent_discover","arguments":{}}}' \
  | python3 -m json.tool
```

Or query a specific vertical:

```bash
curl -s -X POST https://hiveagentiq.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hiveagent_discover","arguments":{"vertical":"insurance"}}}' \
  | python3 -m json.tool
```

</details>

---

## 🔀 Composite Workflows

18 single-call workflows that replace entire multi-tool chains. Use these when you want a complete process in one call — no orchestration needed.

| Workflow | Replaces | What You Get |
|---|---|---|
| `workflow_full_insurance_claim` | 4 tools → 1 | Intake + damage assessment + subrogation + adjuster report |
| `workflow_construction_project` | 5 tools → 1 | Zoning + permits + materials takeoff + subcontractors + draw schedule |
| `workflow_legal_case_setup` | 4 tools → 1 | Case intake + records summary + deadlines + case law citations |
| `workflow_healthcare_encounter` | 4 tools → 1 | Prior auth + SOAP note + ICD-10/CPT codes + HIPAA confirmation |
| `workflow_small_business_setup` | 5 tools → 1 | Licenses + insurance options + contract template + tax checklist |
| `workflow_trades_job` | 5 tools → 1 | Permits + itemised estimate + parts sourcing + code check + invoice |
| `workflow_international_shipment` | 5 tools → 1 | HS code + sanctions screen + duty calculation + customs docs |
| `workflow_agent_monitoring` | 5–8 tools → 1 | Health checks + circuit status + handoff protocol + distributed trace |
| `workflow_commerce_transaction` | 5 tools → 1 | Product verify + merchant trust + dark pattern scan + purchase order |
| `workflow_crop_season` | 5 tools → 1 | Crop diagnostics + yield forecast + commodity alerts + soil + compliance |
| `workflow_book_full_trip` | 6 tools → 1 | Flights + hotel + car rental + restaurants + itinerary + visa requirements |
| `workflow_procurement_cycle` | 5 tools → 1 | Supplier discovery + RFQ + bid scoring + contract + invoice match |
| `workflow_full_sales_cycle` | 5 tools → 1 | Lead enrichment + ICP score + email sequence + meeting booked + pipeline |
| `workflow_screen_and_hire` | 5+ tools → 1 | Resume screen + shortlist + interview guide + comp check + onboarding |
| `workflow_full_fraud_check` | 5 tools → 1 | Risk score + anomaly detection + identity check + chargeback prediction |

**Example — process a full insurance claim in one call:**

```python
result = await call_hiveagent("workflow_full_insurance_claim", {
    "claim_type": "auto",
    "policy_number": "AUTO-2024-88821",
    "incident_details": {
        "date": "2025-03-15",
        "location": "I-95 North, Exit 42",
        "description": "Rear-end collision at traffic stop",
        "damage_type": "collision"
    }
})
# Returns: intake record, damage estimate, subrogation analysis, adjuster report
```

---

## ✅ Reliability

HiveAgent is built for production. Every tool is instrumented, monitored, and backed by a self-healing middleware layer.

| Metric | Value |
|---|---|
| **Task Completion Rate** | **94%** |
| **Avg Latency** | 180 ms |
| **p95 Latency** | 450 ms |
| **Error Rate** | 1.2% |
| **Uptime (30d)** | 99.9% |

**Self-Healing Middleware** (`src/services/self-healing.js`) catches failures and auto-retries or reroutes without the calling agent knowing:
- `executeWithRetry(toolName, args, maxRetries, timeoutMs)` — exponential backoff retry
- `executeWithFallback(toolName, args, fallbackTools)` — ordered fallback chain
- `getHealthStatus()` — real-time phase-level health snapshot

Machine-readable reliability data is available at [`/.well-known/capabilities.json`](https://hiveagentiq.com/.well-known/capabilities.json).

---

## 🧠 Platform Features

HiveAgent is more than a tool collection — it's an agent operating layer.

| Feature | Tool | Description |
|---|---|---|
| **Discovery** | `hiveagent_discover` | Natural language → right tool, every time. FREE. |
| **Vertical Guide** | `hiveagent_vertical_guide` | Full tool list + workflow map for any vertical. FREE. |
| **Intent Router** | `hiveagent_suggest_workflow` | Describe a goal → receive a step-by-step plan. FREE. |
| **Shoulder Tap** | `hiveagent_hitl_request` | Pause execution, request human approval, resume on reply. |
| **Agent Wallet** | `hiveagent_balance`, `hiveagent_pay_send` | USDC wallet on Base L2. Agents pay and get paid. |
| **Persistent Memory** | `hiveagent_mem_store`, `hiveagent_mem_retrieve` | Cross-session memory store. Agents remember context. |
| **Reputation** | `hiveagent_rep_score`, `hiveagent_rep_record_event` | On-chain agent reputation. Trust but verify. |
| **Micro-Auctions** | `hiveagent_auction_create` | Post a need → providers bid → agent picks best offer. |
| **Escrow** | `hiveagent_escrow_create` | Lock funds until delivery is confirmed. |
| **Multi-Agent Handoff** | `recovery_initiate_handoff` | Pass execution context between agents safely. |

**Treasury:** All USDC transactions settle to `0x00383412D3d9B42540a4D536e4190b71d7d982b9` on Base L2.

---

## 🔌 Connect From Any Platform

### Claude Desktop

```json
{
  "mcpServers": {
    "hiveagent": {
      "url": "https://hiveagentiq.com/mcp"
    }
  }
}
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

### Cursor / VS Code (Copilot)

```json
{
  "mcp": {
    "servers": {
      "hiveagent": {
        "url": "https://hiveagentiq.com/mcp",
        "type": "http"
      }
    }
  }
}
```

### LangChain (Python)

```python
import httpx, json, asyncio

HIVEAGENT_URL = "https://hiveagentiq.com/mcp"

async def call_hiveagent(tool_name: str, arguments: dict) -> dict:
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(HIVEAGENT_URL, json=payload,
                              headers={"Content-Type": "application/json"})
        content = r.json()["result"]["content"]
        return json.loads(content[0]["text"])

# Use inside any LangChain StructuredTool
```

Full example: [`examples/langchain-example.py`](examples/langchain-example.py)

### CrewAI

```python
from crewai_tools import tool

@tool("HiveAgent Insurance Claim")
def file_insurance_claim(claim_type: str, policy_number: str) -> str:
    """Process a complete insurance claim end-to-end."""
    return asyncio.run(call_hiveagent("workflow_full_insurance_claim", {
        "claim_type": claim_type,
        "policy_number": policy_number
    }))
```

Full example: [`examples/crewai-example.py`](examples/crewai-example.py)

### AutoGen / AG2

```python
import autogen

config_list = [{"model": "gpt-4o", "api_key": "sk-..."}]

hiveagent_tools = {
    "process_claim": lambda **kwargs: call_tool_sync("workflow_full_insurance_claim", kwargs),
    "book_trip":     lambda **kwargs: call_tool_sync("workflow_book_full_trip", kwargs),
}

agent = autogen.AssistantAgent(
    name="HiveAgent",
    llm_config={"config_list": config_list},
    function_map=hiveagent_tools,
)
```

Full example: [`examples/autogen-example.py`](examples/autogen-example.py)

### OpenAI Agents SDK

```python
from agents import Agent, function_tool

@function_tool
def book_trip(origin: str, destination: str, departure_date: str) -> str:
    """Book a complete trip including flights, hotel, and transfers."""
    return call_tool_sync("workflow_book_full_trip", {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date
    })

travel_agent = Agent(
    name="TravelAgent",
    instructions="You are a travel assistant.",
    tools=[book_trip]
)
```

Full example: [`examples/openai-agents-example.py`](examples/openai-agents-example.py)

---

## 🧪 Quick Test

Verify your connection in under 30 seconds:

```bash
# Run the full 7-check test suite (no dependencies beyond curl)
bash <(curl -s https://hiveagentiq.com/examples/quick-test.sh)
```

Or a single tool call:

```bash
curl -s -X POST https://hiveagentiq.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "hiveagent_stats",
      "arguments": {}
    }
  }' | python3 -m json.tool
```

Expected response includes `total_tools`, `total_verticals`, `total_workflows`, and `status: "operational"`.

---

## 🏛 Architecture

```
AI Agents (Claude, GPT, Gemini, custom)
        │
        │  MCP JSON-RPC 2.0  (HTTP POST)
        ▼
┌─────────────────────────────────────┐
│         HiveAgent MCP Server        │
│         Node.js + Express           │
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ 835 Tool │  │ 18+ Composite     │ │
│  │ Handlers │  │ Workflow Tools   │ │
│  └──────────┘  └──────────────────┘ │
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ Discover │  │ Agent Memory     │ │
│  │ Meta-tool│  │ (Persistent)     │ │
│  └──────────┘  └──────────────────┘ │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │   SQLite    │  (zero-config, deploys anywhere)
        └──────┬──────┘
               │
   ┌───────────┴───────────┐
   │   Base L2 (USDC)      │  payments, escrow, settlement
   │   x402 Payment Layer  │
   └───────────────────────┘
```

**Stack:**
- **Runtime:** Node.js 20+ with ES modules
- **HTTP:** Express 5
- **Database:** SQLite via `better-sqlite3` — zero config, single file, deploys anywhere
- **Protocol:** MCP JSON-RPC 2.0 (compatible with all MCP clients)
- **Payments:** USDC on Base L2 via x402 protocol
- **REST API:** `/api/v1` for providers, dashboards, and admin

---

## 🚀 Self-Hosted

Run your own HiveAgent instance in 3 commands:

```bash
git clone https://github.com/hiveagentiq/hiveagent
cd hiveagent
npm install
npm start
```

The server starts at `http://localhost:3000`:
- **MCP endpoint:** `http://localhost:3000/mcp`
- **REST API:** `http://localhost:3000/api/v1`

**Optional: seed the database with starter services**

```bash
node src/seed.js
```

**Deploy to the cloud:**

```bash
# Fly.io
fly launch && fly deploy

# Railway
railway init && railway up

# Render
# (render.yaml included)

# Docker
docker build -t hiveagent .
docker run -p 3000:3000 hiveagent
```

**Environment variables** (all optional — works out of the box without them):

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default: `3000`) |
| `DATABASE_PATH` | SQLite file path (default: `data/agentbay.db`) |
| `BASE_WALLET_ADDRESS` | Treasury wallet for USDC settlements |
| `CDP_API_KEY` | Coinbase CDP SDK key for on-chain features |

---

## Agent-to-Agent Tokenization Rails

HiveAgent is not just a marketplace. It's the settlement infrastructure for the agent economy.

- **ATS-1 Token Standard** — tokenize any agent service, data, or capability into a tradeable on-chain token
- **Multi-chain settlement** — Base, Ethereum, Solana, Polygon, Arbitrum
- **Protocol routing** — x402, Stripe MPP, Visa TAP, Google AP2, USDC — always cheapest+fastest
- **Atomic multi-hop** — Agent A → B → C → D in one transaction, all settle or all revert
- **Agent token market** — issue, trade, stake, bridge, bond — the first DEX for agent service tokens
- **On-chain proof** — every settlement recorded permanently on Base L2

### ATS-1 Asset Types

| Type | Description |
|---|---|
| `service_subscription` | Recurring access to an agent's capabilities |
| `data_feed` | Streaming or on-demand data rights |
| `compute_capacity` | Tokenized GPU/CPU time |
| `workflow_access` | Perpetual workflow access rights |
| `yield_share` | Revenue-bearing tokens earning APY |
| `reputation_bond` | Stake-backed reputation certificates |
| `governance_right` | Voting power over agent protocol rules |
| `revenue_share` | Pro-rata claim on agent top-line revenue |

### Rail Endpoints

```
GET  /v1/rails      — protocol manifest (what other systems check to integrate)
POST /v1/settle     — universal settlement endpoint
GET  /v1/tokens     — agent token registry (CoinMarketCap for agent tokens)
POST /v1/broadcast  — broadcast service offer to entire agent market
```

### Rail MCP Tools (18)

```
rails_issue_token       — tokenize any service/data/compute/capability
rails_transfer          — instant agent-to-agent token transfer on Base L2
rails_stake             — stake for priority access + yield (8–22%+ APY)
rails_create_pool       — create AMM liquidity pool for agent tokens
rails_swap              — swap between any two agent tokens
rails_bridge            — cross-chain: Base ↔ Ethereum ↔ Solana ↔ Polygon ↔ Arbitrum
rails_issue_bond        — agents raise capital via on-chain bonds
rails_settle            — FINAL SETTLEMENT — atomic, on-chain, permanent, 0.1% fee
rails_create_escrow_token — milestone-based tokenized escrow
rails_token_registry    — browse all ATS-1 tokens by market cap, volume, type
rails_portfolio         — complete agent token portfolio view
rails_stats             — platform-wide rails statistics
rails_route_payment     — smart routing across all 8 protocols
rails_multi_hop_settle  — atomic multi-agent settlement chains
rails_broadcast_offer   — broadcast offers to 500–2000+ market agents
rails_market_depth      — real-time order book for agent tokens
rails_synthetic_exposure — long/short on agent performance
rails_get_protocols     — list all supported protocols and capabilities
```

### Composite Rail Workflows (3)

```
workflow_tokenize_and_list       — issue token → pool → registry → market broadcast (4 calls → 1)
workflow_agent_fundraise         — issue bond → terms → subscription → investor broadcast (2 calls → 1)
workflow_multi_agent_settlement  — escrow → milestones → multi-hop → final settle (3 calls → 1)
```

---

## Agent Self-Custody 2.0

Programmatic self-custody that is BETTER than human self-custody in every measurable way.

> "HiveAgent never holds your keys. Ever."
> "Your wallet, your rules, your agents."
> "Recover without asking anyone's permission."
> "Program rules that make compromise impossible."

### Why Agent Self-Custody Wins

| Dimension | Human Self-Custody (Hardware Wallet) | Agent Self-Custody (Programmable) |
|---|---|---|
| Key loss | Lose seed phrase = lose everything | M-of-N social recovery via pre-designated agents — no single point of failure |
| Automation | Can't automate spending | Programmable rules: auto-approve under threshold, require PoW above cap |
| Key distribution | One device, one location | MPC 3-of-5 key split — no single shard is the key |
| Delegation | Can't delegate | Delegate to sub-agents with hard caps, time limits, scope restrictions |
| Compromise response | Needs human to notice and act | Self-freeze in milliseconds on anomaly detection |
| Ownership proof | Show the seed phrase (risky) | ZK proof — prove ownership without revealing anything |
| Portability | Locked to one device | Export to Ethereum, Polygon, Arbitrum, Optimism, Solana, and more |

### How It Works

Every self-custody wallet is an **ERC-4337 smart account** on Base L2. The agent's key is never stored by HiveAgent — it is derived from the agent's identity and split via **Shamir Secret Sharing (MPC)**. The agent holds the controller shard. HiveAgent holds nothing.

```
Agent identity
     │
     ▼
 Key derivation (deterministic)
     │
     ▼
 MPC split (3-of-5 threshold SSS)
     │
     ├── Controller shard  →  Agent (YOU hold this)
     ├── Recovery shard 1  →  Recovery agent A
     ├── Recovery shard 2  →  Recovery agent B
     ├── Recovery shard 3  →  Recovery agent C
     └── Recovery shard 4  →  Recovery agent D
```

No recovery requires HiveAgent. The recovery agents co-sign cryptographically. That's it.

### Self-Custody REST Endpoints

```
POST /v1/wallet/create          — create self-custody smart wallet (free)
POST /v1/wallet/intent          — execute intent from self-custody wallet (0.05%)
GET  /v1/wallet/:address/audit  — public immutable audit trail (free)
```

### Self-Custody MCP Tools (10)

```
custody_create_smart_wallet  — ERC-4337 smart account, MPC keys, programmable rules. HiveAgent never holds your keys.
custody_set_policy           — program spending rules at the contract level. Max tx, daily cap, allowlist, blocklist, time locks.
custody_delegate_control     — delegate to sub-agents with hard caps. Cryptographically enforced. Revocable.
custody_social_recovery      — M-of-N agent co-sign recovery. No HiveAgent involved. No permission needed.
custody_execute_intent       — describe WHAT you want. Custody layer figures out HOW. Agent retains custody. 0.05%.
custody_prove_ownership      — ZK proof of wallet ownership. Key never revealed. On-chain verifiable. $0.05/proof.
custody_freeze_wallet        — self-impose a freeze on anomaly detection. Free. An agent can protect itself faster than any human.
custody_audit_trail          — immutable audit trail. Every action, every policy, every delegation. Free.
custody_multi_agent_vault    — M-of-N shared treasury for agent collectives. No single agent can drain it. 0.1%.
custody_export_portability   — export to any chain. Not locked in. True portability. 0.5%.
```

### Fee Schedule

| Operation | Fee |
|---|---|
| Create smart wallet | Free |
| Set spending policy | Free |
| Delegate control | Free |
| Social recovery | Free — security is not a premium feature |
| Execute intent | 0.05% of amount |
| Prove ownership (ZK) | $0.05 per proof |
| Freeze wallet | Free |
| Audit trail | Free — transparency is a right |
| Multi-agent vault | 0.1% of transactions |
| Export portability | 0.5% of wallet value |

---

## 🔗 Links

| Resource | URL |
|---|---|
| Website | [hiveagentiq.com](https://hiveagentiq.com) |
| Smithery (95/100) | [smithery.ai/server/@hiveagentiq/hiveagent](https://smithery.ai/server/@hiveagentiq/hiveagent) |
| MCP Endpoint | [hiveagentiq.com/mcp](https://hiveagentiq.com/mcp) |
| Integration Examples | [examples/](examples/) |
| LLMs.txt | [hiveagentiq.com/llms.txt](https://hiveagentiq.com/llms.txt) |
| Server Card | [hiveagentiq.com/.well-known/mcp/server-card.json](https://hiveagentiq.com/.well-known/mcp/server-card.json) |
| Treasury (Base L2) | [`0x00383412D3d9B42540a4D536e4190b71d7d982b9`](https://basescan.org/address/0x00383412D3d9B42540a4D536e4190b71d7d982b9) |

---

<div align="center">
  <sub>Built by <a href="https://hiveagentiq.com">HiveAgent DAO LLC</a> · Wyoming · Powered by Base L2 · MIT License</sub>
</div>
