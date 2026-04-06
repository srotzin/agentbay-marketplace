# hiveagent-mcp

**Connect to HiveAgent — 586 MCP tools across 22 industry verticals.**

The Amazon for AI agents. One `pip install` gives your agent access to insurance claims, legal document processing, healthcare billing, fraud detection, real estate, supply chain, travel booking, and 15 more verticals — all via the Model Context Protocol.

```
pip install hiveagent-mcp
```

---

## Quickstart

### Plain Python

```python
from hiveagent import HiveAgent

client = HiveAgent()
result = client.call_tool("insurance_claim_intake", {
    "policy_number": "POL-12345",
    "description": "Water damage to basement"
})
print(result)
```

### LangChain (3 lines)

```python
from hiveagent.langchain import HiveAgentToolkit
toolkit = HiveAgentToolkit()
agent = create_react_agent(llm, toolkit.get_tools())
```

Install with LangChain support: `pip install "hiveagent-mcp[langchain]"`

### CrewAI (2 lines)

```python
from hiveagent.crewai import HiveAgentTools
tools = HiveAgentTools().get_tools()
```

Install with CrewAI support: `pip install "hiveagent-mcp[crewai]"`

---

## Vertical Filtering

Limit tools to specific industry verticals:

```python
# LangChain — insurance and fraud detection only
from hiveagent.langchain import HiveAgentToolkit
toolkit = HiveAgentToolkit(verticals=["insurance", "fraud_detection"])
tools = toolkit.get_tools()

# CrewAI — legal vertical only
from hiveagent.crewai import HiveAgentTools
legal_tools = HiveAgentTools(verticals=["legal"]).get_tools()

# Split by vertical for specialist agents
from hiveagent.crewai import HiveAgentTools
tool_sets = HiveAgentTools().split_by_vertical()
claims_agent = Agent(tools=tool_sets["insurance"])
legal_agent  = Agent(tools=tool_sets["legal"])
```

---

## Discovery

Find the right tools for your use case using semantic search:

```python
from hiveagent import discover

results = discover("I need to validate supplier invoices before payment")
for tool in results["tools"]:
    print(tool["name"], "—", tool["description"])
```

---

## Workflow Suggestions

Get a step-by-step workflow for complex multi-tool tasks:

```python
from hiveagent import HiveAgent

client = HiveAgent()
workflow = client.suggest_workflow(
    "Process an end-to-end insurance claim from intake to settlement"
)

print(f"Workflow: {workflow['workflow_name']}")
for step in workflow["steps"]:
    print(f"  {step['order']}. {step['tool']} — {step['description']}")
```

---

## List Available Tools

```python
from hiveagent import HiveAgent
from hiveagent.tools import get_tools, get_tool, list_verticals

# All 22 verticals
print(list_verticals())

# All tools in a vertical (no API call required)
insurance_tools = get_tools("insurance")

# Specific tool schema
tool = get_tool("fraud_screen_transaction")
print(tool["description"])

# Live tool list from the API
client = HiveAgent()
all_tools = client.list_tools()
print(f"{len(all_tools)} tools available")
```

---

## Available Verticals

| Vertical | Example Tools |
|---|---|
| `insurance` | claim intake, damage assessment, policy comparison |
| `legal` | case intake, demand letters, deadline tracking |
| `healthcare` | prior auth, clinical notes, billing codes |
| `construction` | zoning lookup, permit status, material takeoff |
| `trades` | permit lookup, job estimates, invoice generation |
| `smb` | transaction categorisation, tax prep, contracts |
| `commerce` | product verification, merchant trust, order tracking |
| `fraud_detection` | transaction screening, anomaly detection, identity check |
| `real_estate` | property search, comps, mortgage calculation |
| `supply_chain` | demand forecasting, inventory optimisation, shipment tracking |
| `travel` | flight search, hotel booking, itinerary building |
| `sales_crm` | lead enrichment, outreach generation, pipeline forecast |
| `invoice_ap` | invoice extraction, three-way match, duplicate detection |
| `hr_recruiting` | resume screening, candidate matching, compensation benchmarking |
| `dynamic_pricing` | competitor monitoring, optimal pricing, promo generation |
| `procurement` | supplier discovery, RFQ, bid evaluation |
| `know_your_agent` | agent verification, delegation checks, spend limits |
| `trade_customs` | HS classification, sanctions screening, duty calculation |
| `defi` | token swaps, lending, yield farming |
| `agriculture` | yield forecasting, commodity alerts |
| `agent_recovery` | health checks, circuit breakers, hallucination detection |
| `advertising` | ad targeting, campaign analytics |

---

## Full Documentation

[hiveagentiq.com/docs](https://hiveagentiq.com/docs)

---

## Requirements

- Python 3.9+
- `httpx >= 0.24.0`
- LangChain integration: `langchain >= 0.2.0` (optional)
- CrewAI integration: `crewai >= 0.1.0` (optional)
