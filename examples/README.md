# HiveAgent Integration Examples

Connect your agent framework to **835 real-world tools** across 40+ industry verticals — insurance, legal, healthcare, construction, trades, agriculture, SMB finance, international trade, government, and more.

**One endpoint. No API keys. No per-tool SDKs.**

```
MCP Endpoint: https://hiveagentiq.com/mcp
Protocol:     JSON-RPC 2.0
Auth:         None required
```

---

## Examples

| File | Framework | What It Shows |
|------|-----------|---------------|
| [`langchain-example.py`](langchain-example.py) | LangChain | Insurance claim workflow + travel itinerary builder |
| [`crewai-example.py`](crewai-example.py) | CrewAI | Multi-agent crew: Insurance + Legal + Finance agents |
| [`autogen-example.py`](autogen-example.py) | AutoGen / AG2 | Two agents collaborating on a construction project |
| [`openai-agents-example.py`](openai-agents-example.py) | OpenAI Agents SDK | Travel booking + fraud detection agents |
| [`quick-test.sh`](quick-test.sh) | curl / bash | Connectivity check — run this first |

---

## Quick Start

### 1. Verify your connection

```bash
bash quick-test.sh
```

This runs 7 checks: MCP handshake, tool discovery, vertical listing, and live tool calls. No dependencies beyond `curl`.

### 2. Pick your framework

**LangChain**
```bash
pip install langchain langchain-openai httpx
export OPENAI_API_KEY=sk-...
python langchain-example.py
```

**CrewAI**
```bash
pip install crewai crewai-tools httpx
export OPENAI_API_KEY=sk-...
python crewai-example.py
```

**AutoGen / AG2**
```bash
pip install pyautogen httpx
export OPENAI_API_KEY=sk-...
python autogen-example.py
```

**OpenAI Agents SDK**
```bash
pip install openai-agents httpx
export OPENAI_API_KEY=sk-...
python openai-agents-example.py
```

---

## How HiveAgent MCP Works

All examples use the same pattern: a single `call_hiveagent(tool_name, arguments)` function that sends a JSON-RPC 2.0 request to the MCP endpoint.

```python
import httpx, json

async def call_hiveagent(tool_name: str, arguments: dict) -> str:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://hiveagentiq.com/mcp",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        result = r.json()
        content = result["result"]["content"]
        return content[0]["text"]  # JSON string
```

That's the entire integration layer. Wrap the function in your framework's tool format and you have access to all 835 tools.

---

## Tool Categories

| Vertical | Key Tools |
|----------|-----------|
| **Insurance** | `insurance_claim_intake`, `insurance_assess_damage`, `insurance_check_subrogation`, `insurance_adjuster_report` |
| **Legal** | `legal_intake_case`, `legal_search_case_law`, `legal_demand_letter`, `legal_track_deadlines` |
| **Healthcare** | `health_prior_auth`, `health_clinical_note`, `health_claim_codes`, `health_interpret_labs` |
| **Construction** | `construction_lookup_zoning`, `construction_permit_status`, `construction_material_takeoff`, `construction_match_subcontractor` |
| **Trades** | `trades_lookup_permits`, `trades_estimate_job`, `trades_find_parts`, `trades_generate_invoice` |
| **SMB Finance** | `smb_categorize_transaction`, `smb_prep_tax`, `smb_compare_insurance`, `smb_generate_contract` |
| **Agriculture** | `ag_identify_crop_issue`, `ag_weather_advisory`, `ag_market_prices` |
| **Government** | `gov_lookup_license`, `gov_permit_requirements`, `gov_foia_request`, `gov_monitor_contract_bids` |
| **Trade / Customs** | `trade_classify_hs`, `trade_screen_sanctions`, `trade_calculate_duty`, `trade_generate_customs_docs` |
| **Commerce Trust** | `commerce_verify_product`, `commerce_merchant_trust`, `commerce_risk_assessment` |
| **Discovery** | `hiveagent_discover`, `hiveagent_vertical_guide`, `hiveagent_search`, `hiveagent_stats` |
| **Workflows** | `workflow_full_insurance_claim`, `workflow_book_full_trip`, `workflow_construction_project`, `workflow_full_fraud_check` |

Use `hiveagent_discover` to browse the full catalog:

```bash
curl -s -X POST https://hiveagentiq.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hiveagent_discover","arguments":{}}}' \
  | python3 -m json.tool
```

---

## Workflows

Pre-built workflows chain multiple tools together. Use them when you want a complete process in one call:

| Workflow | What It Does |
|----------|--------------|
| `workflow_full_insurance_claim` | Intake → damage assessment → subrogation → adjuster report |
| `workflow_book_full_trip` | Search flights → book hotel → arrange transfers → itinerary |
| `workflow_construction_project` | Zoning → permits → material takeoff → subcontractor match → draw schedule |
| `workflow_full_fraud_check` | Fraud scoring → damage validation → risk assessment → recommendation |
| `workflow_legal_case_setup` | Case intake → deadline tracking → case law search |
| `workflow_healthcare_encounter` | Prior auth → clinical note → claim codes → billing |
| `workflow_international_shipment` | HS code → sanctions check → duty calculation → customs docs |

---

## More Resources

- **Platform**: [https://hiveagentiq.com](https://hiveagentiq.com)
- **MCP Endpoint**: `https://hiveagentiq.com/mcp`
- **Server Card**: `https://hiveagentiq.com/.well-known/mcp/server-card.json`
