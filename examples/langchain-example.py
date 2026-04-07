"""
HiveAgent + LangChain — 610 MCP tools in 3 lines
Connect any LangChain agent to the largest MCP marketplace.

HiveAgent gives your LangChain agents access to 610 real-world tools across
12 industry verticals: insurance, legal, healthcare, construction, trades,
agriculture, SMB finance, international trade, government, and more.

No API keys required. No per-tool SDK installs. One endpoint does it all.

Usage:
    pip install langchain langchain-openai httpx
    export OPENAI_API_KEY=sk-...
    python langchain-example.py
"""

import asyncio
import json
import httpx
from langchain.tools import StructuredTool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from pydantic import BaseModel, Field
from typing import Any, Optional

# ─── HiveAgent MCP Configuration ──────────────────────────────────────────────

HIVEAGENT_MCP_URL = "https://hiveagentiq.com/mcp"
MCP_HEADERS = {"Content-Type": "application/json"}

# ─── Step 1: MCP Client — one function handles all HiveAgent calls ─────────────

async def call_hiveagent_tool(tool_name: str, arguments: dict) -> dict:
    """
    Send a single JSON-RPC 2.0 request to the HiveAgent MCP endpoint.
    This is the only networking code you need — it works for all 610 tools.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(HIVEAGENT_MCP_URL, json=payload, headers=MCP_HEADERS)
        response.raise_for_status()
        result = response.json()
        if "error" in result:
            raise RuntimeError(f"HiveAgent error: {result['error']}")
        # MCP returns content as a list of content blocks
        content = result.get("result", {}).get("content", [{}])
        if content and content[0].get("type") == "text":
            return json.loads(content[0]["text"])
        return result.get("result", {})

def call_tool_sync(tool_name: str, arguments: dict) -> str:
    """Synchronous wrapper so LangChain tools can call async MCP."""
    result = asyncio.run(call_hiveagent_tool(tool_name, arguments))
    return json.dumps(result, indent=2)

# ─── Step 2: Discover available tools ─────────────────────────────────────────

async def discover_tools(vertical: Optional[str] = None) -> dict:
    """
    Use hiveagent_discover to explore what tools are available.
    Pass a vertical like 'insurance', 'legal', 'construction' to narrow results.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "hiveagent_discover",
            "arguments": {"vertical": vertical} if vertical else {}
        }
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(HIVEAGENT_MCP_URL, json=payload, headers=MCP_HEADERS)
        result = response.json()
        content = result.get("result", {}).get("content", [{}])
        if content and content[0].get("type") == "text":
            return json.loads(content[0]["text"])
        return {}

# ─── Step 3: Build LangChain tools from HiveAgent ─────────────────────────────
#
# Each StructuredTool wraps one HiveAgent capability. You can wrap all 610
# tools this way, or just the ones relevant to your use case.

class InsuranceClaimInput(BaseModel):
    claimant_name: str = Field(description="Full name of the claimant")
    policy_number: str = Field(description="Insurance policy number")
    incident_date: str = Field(description="Date of incident (YYYY-MM-DD)")
    incident_description: str = Field(description="Description of what happened")
    claim_type: str = Field(description="Type of claim: auto, property, liability, health, workers_comp")

class InsuranceDamageInput(BaseModel):
    claim_id: str = Field(description="Claim ID from intake")
    damage_description: str = Field(description="Detailed description of the damage")
    photos_available: bool = Field(description="Whether photos are available", default=False)

class InsuranceAdjusterInput(BaseModel):
    claim_id: str = Field(description="Claim ID to generate report for")
    findings: str = Field(description="Adjuster's field findings")

class TravelBookingInput(BaseModel):
    origin: str = Field(description="Departure city or airport code")
    destination: str = Field(description="Destination city or airport code")
    departure_date: str = Field(description="Departure date (YYYY-MM-DD)")
    return_date: Optional[str] = Field(description="Return date for round trips (YYYY-MM-DD)", default=None)
    passengers: int = Field(description="Number of passengers", default=1)
    budget_usd: Optional[float] = Field(description="Maximum budget in USD", default=None)

class WorkflowInsuranceInput(BaseModel):
    claimant: str = Field(description="Claimant name")
    policy_number: str = Field(description="Policy number")
    incident_date: str = Field(description="Incident date")
    incident_type: str = Field(description="Type of incident")
    damage_description: str = Field(description="Damage description")

class WorkflowTripInput(BaseModel):
    origin: str = Field(description="Origin city")
    destination: str = Field(description="Destination city")
    departure_date: str = Field(description="Departure date")
    return_date: str = Field(description="Return date")
    budget_usd: float = Field(description="Total trip budget")
    travelers: int = Field(description="Number of travelers")

# ── Insurance Tools ────────────────────────────────────────────────────────────

insurance_intake_tool = StructuredTool.from_function(
    name="insurance_claim_intake",
    description=(
        "Start a new insurance claim. Captures claimant details, policy info, "
        "incident date, and claim type. Returns a claim_id for follow-up steps."
    ),
    func=lambda **kwargs: call_tool_sync("insurance_claim_intake", kwargs),
    args_schema=InsuranceClaimInput,
)

insurance_damage_tool = StructuredTool.from_function(
    name="insurance_assess_damage",
    description=(
        "Assess damage for an existing insurance claim. Provide the claim_id "
        "and a detailed damage description. Returns estimated repair/replacement costs."
    ),
    func=lambda **kwargs: call_tool_sync("insurance_assess_damage", kwargs),
    args_schema=InsuranceDamageInput,
)

insurance_adjuster_tool = StructuredTool.from_function(
    name="insurance_adjuster_report",
    description=(
        "Generate a formal adjuster report for a claim. Combines intake data, "
        "damage assessment, and field findings into a structured report."
    ),
    func=lambda **kwargs: call_tool_sync("insurance_adjuster_report", kwargs),
    args_schema=InsuranceAdjusterInput,
)

# ── Full-Workflow Tools ────────────────────────────────────────────────────────
#
# HiveAgent also exposes pre-built multi-step workflows that chain several
# tools together in one call — great for common end-to-end scenarios.

full_insurance_workflow = StructuredTool.from_function(
    name="workflow_full_insurance_claim",
    description=(
        "End-to-end insurance claim workflow: intake → damage assessment → "
        "subrogation check → adjuster report, all in one call. "
        "Use this when you want a complete claim processed at once."
    ),
    func=lambda **kwargs: call_tool_sync("workflow_full_insurance_claim", kwargs),
    args_schema=WorkflowInsuranceInput,
)

full_trip_workflow = StructuredTool.from_function(
    name="workflow_book_full_trip",
    description=(
        "End-to-end travel booking workflow: search flights, book hotels, "
        "arrange transfers, and generate an itinerary — all in one call."
    ),
    func=lambda **kwargs: call_tool_sync("workflow_book_full_trip", kwargs),
    args_schema=WorkflowTripInput,
)

# ─── Step 4: Build the LangChain Agent ────────────────────────────────────────

def build_hiveagent_langchain_agent(tools=None):
    """
    Create a LangChain agent wired up to HiveAgent tools.
    Drop in any subset of the 610 available tools.
    """
    if tools is None:
        tools = [
            insurance_intake_tool,
            insurance_damage_tool,
            insurance_adjuster_tool,
            full_insurance_workflow,
            full_trip_workflow,
        ]

    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a professional agent with access to HiveAgent — the largest "
            "MCP marketplace with 610 real-world tools across insurance, legal, "
            "healthcare, construction, travel, and more.\n\n"
            "When given a task, use the available tools to complete it step by step. "
            "Always confirm what you've done and provide clear summaries."
        )),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=True)


# ─── Demo: Insurance Claim Workflow ───────────────────────────────────────────

async def demo_insurance_claim():
    """
    Demonstrates a complete auto insurance claim using HiveAgent tools.
    This is the kind of workflow that normally requires 3 separate vendor APIs.
    HiveAgent handles it all through a single MCP endpoint.
    """
    print("\n" + "="*60)
    print("DEMO 1: Insurance Claim Processing")
    print("="*60)

    agent_executor = build_hiveagent_langchain_agent()

    result = await agent_executor.ainvoke({
        "input": (
            "Process an auto insurance claim for Jane Smith, policy number AUTO-2024-88821. "
            "She was rear-ended on 2025-03-15. Her bumper and trunk lid are damaged — "
            "estimated $4,200 in repairs. Run the full workflow: intake, damage assessment, "
            "and generate the adjuster report."
        )
    })

    print("\nFinal Answer:", result["output"])
    return result


# ─── Demo: Travel Itinerary Builder ───────────────────────────────────────────

async def demo_travel_itinerary():
    """
    Builds a complete travel itinerary using HiveAgent's travel workflow.
    Covers flights, hotels, and ground transport in a single agent invocation.
    """
    print("\n" + "="*60)
    print("DEMO 2: Travel Itinerary Builder")
    print("="*60)

    agent_executor = build_hiveagent_langchain_agent()

    result = await agent_executor.ainvoke({
        "input": (
            "Book a full trip from New York to Tokyo for 2 travelers. "
            "Departing 2025-06-01, returning 2025-06-10. Budget is $6,000 total. "
            "Use the full trip workflow and give me a complete itinerary."
        )
    })

    print("\nFinal Answer:", result["output"])
    return result


# ─── Discovery: See What's Available ──────────────────────────────────────────

async def demo_discover():
    """
    Shows how to browse HiveAgent's tool catalog before building your agent.
    Use this to find the right tools for your domain.
    """
    print("\n" + "="*60)
    print("DEMO 0: Discover Available Verticals")
    print("="*60)

    result = await discover_tools()
    print(json.dumps(result, indent=2))

    # Drill into a specific vertical
    print("\n--- Insurance Vertical Tools ---")
    insurance_tools = await discover_tools("insurance")
    print(json.dumps(insurance_tools, indent=2))


# ─── Entry Point ──────────────────────────────────────────────────────────────

async def main():
    # 0. Discover what HiveAgent offers
    await demo_discover()

    # 1. Run the insurance claim workflow
    await demo_insurance_claim()

    # 2. Build a travel itinerary
    await demo_travel_itinerary()


if __name__ == "__main__":
    asyncio.run(main())
