"""
HiveAgent + AutoGen — Multi-agent conversations with real-world tools
Give AutoGen agents access to 610 professional tools via a single MCP endpoint.

This example shows two AutoGen agents collaborating on a construction project:
- Project Manager Agent: handles zoning, permits, and scheduling
- Field Supervisor Agent: manages subcontractors and material takeoffs

Together they walk through a complete commercial build — from permit check to
subcontractor match to draw schedule — using HiveAgent's construction vertical.

Usage:
    pip install pyautogen httpx
    export OPENAI_API_KEY=sk-...
    python autogen-example.py
"""

import json
import httpx
import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
from typing import Any, Optional

# ─── HiveAgent MCP Configuration ──────────────────────────────────────────────

HIVEAGENT_MCP_URL = "https://hiveagentiq.com/mcp"

LLM_CONFIG = {
    "config_list": [{"model": "gpt-4o", "api_key": "OPENAI_API_KEY"}],
    "temperature": 0,
}

# ─── MCP Client ───────────────────────────────────────────────────────────────

def call_hiveagent(tool_name: str, arguments: dict) -> str:
    """
    Call any HiveAgent tool via MCP JSON-RPC 2.0.
    This one function is the bridge to all 610 HiveAgent tools.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                HIVEAGENT_MCP_URL,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            result = response.json()
            if "error" in result:
                return f"Error: {result['error'].get('message', 'Unknown error')}"
            content = result.get("result", {}).get("content", [{}])
            if content and content[0].get("type") == "text":
                return content[0]["text"]
            return json.dumps(result.get("result", {}), indent=2)
    except Exception as e:
        return f"HiveAgent call failed: {str(e)}"


# ─── HiveAgent Tool Functions ─────────────────────────────────────────────────
#
# These plain functions are registered with AutoGen's function_map.
# AutoGen agents call them by name during conversation.

def lookup_zoning(address: str, project_type: str) -> str:
    """
    Look up zoning classification, permitted uses, setbacks, and height limits
    for a property address. Use before starting any construction project.

    Args:
        address: Property address (e.g. "1420 Harbor Blvd, Anaheim, CA 92802")
        project_type: Type of project — commercial, residential, industrial, mixed_use
    """
    return call_hiveagent("construction_lookup_zoning", {
        "address": address,
        "project_type": project_type,
    })


def check_permit_status(
    project_address: str,
    permit_type: str,
    applicant_name: Optional[str] = None
) -> str:
    """
    Check the status of a building permit application and retrieve any
    outstanding conditions or inspection requirements.

    Args:
        project_address: Address of the construction project
        permit_type: Type of permit — building, electrical, plumbing, mechanical, demolition
        applicant_name: Name of permit applicant (optional, narrows results)
    """
    args = {"project_address": project_address, "permit_type": permit_type}
    if applicant_name:
        args["applicant_name"] = applicant_name
    return call_hiveagent("construction_permit_status", args)


def material_takeoff(
    project_type: str,
    square_footage: float,
    scope_of_work: str,
    location: Optional[str] = None
) -> str:
    """
    Generate a material takeoff — itemized list of materials, quantities,
    and estimated costs — based on project type and scope.

    Args:
        project_type: Type of construction (office_buildout, warehouse, retail, restaurant)
        square_footage: Total square footage of the project
        scope_of_work: Description of the work to be performed
        location: Project location for local pricing adjustments
    """
    args = {
        "project_type": project_type,
        "square_footage": square_footage,
        "scope_of_work": scope_of_work,
    }
    if location:
        args["location"] = location
    return call_hiveagent("construction_material_takeoff", args)


def match_subcontractor(
    trade: str,
    project_location: str,
    budget_usd: float,
    project_description: str,
    required_license: Optional[str] = None
) -> str:
    """
    Find and rank subcontractors for a specific trade and project location.
    Returns licensed, rated contractors with availability and bid estimates.

    Args:
        trade: Trade type — electrical, plumbing, hvac, framing, concrete, roofing, drywall
        project_location: City, state where work will be performed
        budget_usd: Budget for this trade package
        project_description: Description of the specific scope
        required_license: Specific license type if required (e.g. "C-10 Electrical")
    """
    args = {
        "trade": trade,
        "project_location": project_location,
        "budget_usd": budget_usd,
        "project_description": project_description,
    }
    if required_license:
        args["required_license"] = required_license
    return call_hiveagent("construction_match_subcontractor", args)


def create_draw_schedule(
    project_name: str,
    total_budget_usd: float,
    start_date: str,
    duration_weeks: int,
    milestones: list
) -> str:
    """
    Create a construction draw schedule that maps project milestones to
    funding releases. Used by lenders and owners to control cash flow.

    Args:
        project_name: Name of the construction project
        total_budget_usd: Total construction budget
        start_date: Project start date (YYYY-MM-DD)
        duration_weeks: Estimated project duration in weeks
        milestones: List of milestone names (e.g. ["foundation", "framing", "MEP rough-in"])
    """
    return call_hiveagent("construction_draw_schedule", {
        "project_name": project_name,
        "total_budget_usd": total_budget_usd,
        "start_date": start_date,
        "duration_weeks": duration_weeks,
        "milestones": milestones,
    })


def run_full_construction_workflow(
    project_address: str,
    project_type: str,
    square_footage: float,
    total_budget_usd: float,
    start_date: str
) -> str:
    """
    Run the complete construction project workflow in one call:
    zoning check → permit status → material takeoff → subcontractor matching → draw schedule.
    Use when you want a comprehensive project setup in one step.

    Args:
        project_address: Full project address
        project_type: Type of construction project
        square_footage: Total square footage
        total_budget_usd: Total project budget
        start_date: Planned start date (YYYY-MM-DD)
    """
    return call_hiveagent("workflow_construction_project", {
        "project_address": project_address,
        "project_type": project_type,
        "square_footage": square_footage,
        "total_budget_usd": total_budget_usd,
        "start_date": start_date,
    })


# ─── AutoGen Tool Registration ────────────────────────────────────────────────
#
# Map function names to callables. AutoGen agents reference these by name
# when the LLM decides to use a tool.

HIVEAGENT_FUNCTION_MAP = {
    "lookup_zoning": lookup_zoning,
    "check_permit_status": check_permit_status,
    "material_takeoff": material_takeoff,
    "match_subcontractor": match_subcontractor,
    "create_draw_schedule": create_draw_schedule,
    "run_full_construction_workflow": run_full_construction_workflow,
}

# Function schemas for the LLM (OpenAI function-calling format)
HIVEAGENT_FUNCTION_SCHEMAS = [
    {
        "name": "lookup_zoning",
        "description": "Look up zoning classification and permitted uses for a property address.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Full property address"},
                "project_type": {
                    "type": "string",
                    "enum": ["commercial", "residential", "industrial", "mixed_use"],
                    "description": "Type of project"
                },
            },
            "required": ["address", "project_type"],
        },
    },
    {
        "name": "check_permit_status",
        "description": "Check permit application status and outstanding conditions.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_address": {"type": "string"},
                "permit_type": {
                    "type": "string",
                    "enum": ["building", "electrical", "plumbing", "mechanical", "demolition"]
                },
                "applicant_name": {"type": "string"},
            },
            "required": ["project_address", "permit_type"],
        },
    },
    {
        "name": "material_takeoff",
        "description": "Generate itemized material list with quantities and costs.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_type": {"type": "string"},
                "square_footage": {"type": "number"},
                "scope_of_work": {"type": "string"},
                "location": {"type": "string"},
            },
            "required": ["project_type", "square_footage", "scope_of_work"],
        },
    },
    {
        "name": "match_subcontractor",
        "description": "Find licensed subcontractors for a specific trade and location.",
        "parameters": {
            "type": "object",
            "properties": {
                "trade": {
                    "type": "string",
                    "enum": ["electrical", "plumbing", "hvac", "framing", "concrete", "roofing", "drywall"]
                },
                "project_location": {"type": "string"},
                "budget_usd": {"type": "number"},
                "project_description": {"type": "string"},
                "required_license": {"type": "string"},
            },
            "required": ["trade", "project_location", "budget_usd", "project_description"],
        },
    },
    {
        "name": "create_draw_schedule",
        "description": "Create a construction draw schedule tied to project milestones.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_name": {"type": "string"},
                "total_budget_usd": {"type": "number"},
                "start_date": {"type": "string"},
                "duration_weeks": {"type": "integer"},
                "milestones": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["project_name", "total_budget_usd", "start_date", "duration_weeks", "milestones"],
        },
    },
    {
        "name": "run_full_construction_workflow",
        "description": "Run the complete construction project setup workflow in one call.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_address": {"type": "string"},
                "project_type": {"type": "string"},
                "square_footage": {"type": "number"},
                "total_budget_usd": {"type": "number"},
                "start_date": {"type": "string"},
            },
            "required": ["project_address", "project_type", "square_footage", "total_budget_usd", "start_date"],
        },
    },
]


# ─── Build the AutoGen Multi-Agent System ─────────────────────────────────────

def build_construction_crew():
    """
    Two AutoGen agents collaborate on a commercial construction project:

    1. ProjectManagerAgent — handles zoning, permits, scheduling
       Uses: lookup_zoning, check_permit_status, create_draw_schedule

    2. FieldSupervisorAgent — manages materials and subcontractors
       Uses: material_takeoff, match_subcontractor

    They converse through a GroupChat, passing context between each other
    and calling HiveAgent tools as needed.
    """

    llm_with_tools = {
        **LLM_CONFIG,
        "functions": HIVEAGENT_FUNCTION_SCHEMAS,
    }

    # ── Project Manager Agent ──────────────────────────────────────────────────
    project_manager = AssistantAgent(
        name="ProjectManagerAgent",
        system_message=(
            "You are a commercial construction project manager. Your job is to handle "
            "the planning and compliance side of construction projects:\n"
            "- Verify zoning is appropriate for the project\n"
            "- Check permit status and flag outstanding conditions\n"
            "- Create draw schedules for lender disbursements\n\n"
            "Use the available HiveAgent tools to complete these tasks. "
            "When you need materials or subcontractors, delegate to FieldSupervisorAgent. "
            "Be specific and actionable in all your communications."
        ),
        llm_config=llm_with_tools,
        function_map={k: v for k, v in HIVEAGENT_FUNCTION_MAP.items()
                     if k in ["lookup_zoning", "check_permit_status", "create_draw_schedule",
                               "run_full_construction_workflow"]},
    )

    # ── Field Supervisor Agent ─────────────────────────────────────────────────
    field_supervisor = AssistantAgent(
        name="FieldSupervisorAgent",
        system_message=(
            "You are a construction field supervisor specializing in procurement "
            "and subcontractor management:\n"
            "- Generate material takeoffs from project specs\n"
            "- Find and rank licensed subcontractors by trade\n"
            "- Identify the best bids based on price, rating, and availability\n\n"
            "Use the available HiveAgent tools. Coordinate with ProjectManagerAgent "
            "to ensure your procurement aligns with the project schedule. "
            "Always provide specific numbers and recommendations."
        ),
        llm_config=llm_with_tools,
        function_map={k: v for k, v in HIVEAGENT_FUNCTION_MAP.items()
                     if k in ["material_takeoff", "match_subcontractor"]},
    )

    # ── Human Proxy (orchestrates the conversation) ────────────────────────────
    user_proxy = UserProxyAgent(
        name="Owner",
        human_input_mode="NEVER",   # Fully autonomous — no human interruption
        max_consecutive_auto_reply=10,
        is_termination_msg=lambda msg: "COMPLETE" in msg.get("content", ""),
        code_execution_config=False,
        function_map=HIVEAGENT_FUNCTION_MAP,
    )

    return project_manager, field_supervisor, user_proxy


# ─── Demo: Commercial Construction Project ────────────────────────────────────

def demo_construction_project():
    """
    Two AutoGen agents collaborate to plan a 12,000 sq ft office buildout
    in Anaheim, CA. They check zoning, permits, materials, and find
    subcontractors — all using HiveAgent's construction vertical.
    """
    print("\n" + "="*60)
    print("HiveAgent + AutoGen: Construction Project Collaboration")
    print("="*60)

    project_manager, field_supervisor, user_proxy = build_construction_crew()

    # Set up group chat so both agents can collaborate
    group_chat = GroupChat(
        agents=[user_proxy, project_manager, field_supervisor],
        messages=[],
        max_round=12,
    )

    manager = GroupChatManager(
        groupchat=group_chat,
        llm_config=LLM_CONFIG,
    )

    # Kick off the construction project planning task
    user_proxy.initiate_chat(
        manager,
        message=(
            "We have a new commercial construction project to plan:\n\n"
            "PROJECT: Harbor Commerce Center\n"
            "Address: 1420 Harbor Blvd, Anaheim, CA 92802\n"
            "Type: Office buildout (Class B commercial)\n"
            "Size: 12,000 square feet\n"
            "Budget: $1,850,000\n"
            "Target Start: 2025-07-01\n"
            "Duration: 18 weeks\n\n"
            "Please complete the full project setup:\n"
            "1. ProjectManagerAgent: Verify zoning and check permit status\n"
            "2. FieldSupervisorAgent: Generate material takeoff and find subcontractors "
            "   for electrical, plumbing, and HVAC\n"
            "3. ProjectManagerAgent: Create a draw schedule with milestones\n\n"
            "When all tasks are complete, reply with 'COMPLETE' and a project summary."
        ),
    )


# ─── Demo: Full Workflow in One Call ──────────────────────────────────────────

def demo_single_agent_workflow():
    """
    Single-agent demo using the workflow_construction_project shortcut.
    Shows how HiveAgent pre-built workflows compress multi-step processes
    into a single tool call — useful for simpler AutoGen setups.
    """
    print("\n" + "="*60)
    print("HiveAgent + AutoGen: Single-Agent Full Workflow")
    print("="*60)

    llm_with_tools = {
        **LLM_CONFIG,
        "functions": [s for s in HIVEAGENT_FUNCTION_SCHEMAS
                      if s["name"] == "run_full_construction_workflow"],
    }

    construction_agent = AssistantAgent(
        name="ConstructionAgent",
        system_message=(
            "You are a construction planning agent. Use run_full_construction_workflow "
            "to set up construction projects end-to-end. Summarize the results clearly."
        ),
        llm_config=llm_with_tools,
        function_map={"run_full_construction_workflow": run_full_construction_workflow},
    )

    user_proxy = UserProxyAgent(
        name="Developer",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=3,
        code_execution_config=False,
        function_map={"run_full_construction_workflow": run_full_construction_workflow},
    )

    user_proxy.initiate_chat(
        construction_agent,
        message=(
            "Set up a new warehouse project: "
            "500 Commerce Drive, Las Vegas, NV 89118. "
            "Industrial warehouse, 45,000 sq ft, $3.2M budget, starting 2025-08-15. "
            "Run the full workflow and give me a project summary."
        ),
    )


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Demo 1: Multi-agent collaboration (recommended)
    demo_construction_project()

    # Demo 2: Single agent with full workflow shortcut
    # demo_single_agent_workflow()
