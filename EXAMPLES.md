# Integration Examples

Connect your agent framework to HiveAgent's **1,132 MCP tools** in minutes.

| Framework | File | What It Shows |
|-----------|------|---------------|
| **LangChain** | [`examples/langchain-example.py`](examples/langchain-example.py) | Insurance claim workflow + travel itinerary |
| **CrewAI** | [`examples/crewai-example.py`](examples/crewai-example.py) | Multi-agent crew across Insurance, Legal, and Finance verticals |
| **AutoGen / AG2** | [`examples/autogen-example.py`](examples/autogen-example.py) | Two agents collaborating on a construction project |
| **OpenAI Agents SDK** | [`examples/openai-agents-example.py`](examples/openai-agents-example.py) | Travel booking + fraud detection agents |
| **curl** | [`examples/quick-test.sh`](examples/quick-test.sh) | Connectivity check — run this first |

**MCP Endpoint:** `https://hiveagentiq.com/mcp`  
**Protocol:** JSON-RPC 2.0  
**Auth:** None required

→ [Full examples guide with tool catalog and quick-start instructions](examples/README.md)

---

## The Pattern

Every example boils down to one function:

```python
import httpx, json, asyncio

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
        content = r.json()["result"]["content"]
        return content[0]["text"]

# Use any of 1,132 tools:
result = asyncio.run(call_hiveagent("workflow_full_insurance_claim", {
    "claimant": "Jane Smith",
    "policy_number": "AUTO-2024-88821",
    "incident_date": "2025-03-15",
    "incident_type": "auto",
    "damage_description": "Rear-end collision, bumper and trunk lid damaged"
}))
print(result)
```

Wrap that in LangChain, CrewAI, AutoGen, or the OpenAI Agents SDK — and your agents have access to the entire HiveAgent marketplace.
