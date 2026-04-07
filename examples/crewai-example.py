"""
HiveAgent + CrewAI — Build agent crews with 610 real-world tools
Give every crew member access to professional-grade tools across
insurance, legal, finance, construction, healthcare, and more.

No API key per tool. No per-vertical SDK. One HiveAgent endpoint
serves your entire crew across all 12 industry verticals.

Usage:
    pip install crewai crewai-tools httpx
    export OPENAI_API_KEY=sk-...
    python crewai-example.py
"""

import asyncio
import json
import httpx
from crewai import Agent, Task, Crew, Process
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Any, Optional, Type

# ─── HiveAgent MCP Configuration ──────────────────────────────────────────────

HIVEAGENT_MCP_URL = "https://hiveagentiq.com/mcp"

# ─── MCP Client — works for all 610 HiveAgent tools ──────────────────────────

def call_hiveagent_tool(tool_name: str, arguments: dict) -> str:
    """
    Call any HiveAgent tool via MCP JSON-RPC 2.0.
    Returns the result as a JSON string for the agent to parse.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            HIVEAGENT_MCP_URL,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        result = response.json()
        if "error" in result:
            return json.dumps({"error": result["error"]})
        content = result.get("result", {}).get("content", [{}])
        if content and content[0].get("type") == "text":
            return content[0]["text"]
        return json.dumps(result.get("result", {}))


# ─── CrewAI Tool Wrappers ──────────────────────────────────────────────────────
#
# Each tool below wraps one HiveAgent capability as a CrewAI BaseTool.
# Pattern: create an input schema → inherit BaseTool → call call_hiveagent_tool.

# ── Insurance Agent Tools ──────────────────────────────────────────────────────

class ClaimIntakeInput(BaseModel):
    claimant_name: str = Field(description="Full name of the claimant")
    policy_number: str = Field(description="Insurance policy number")
    incident_date: str = Field(description="Date of the incident (YYYY-MM-DD)")
    incident_description: str = Field(description="What happened")
    claim_type: str = Field(description="auto, property, liability, health, or workers_comp")

class InsuranceClaimIntakeTool(BaseTool):
    name: str = "insurance_claim_intake"
    description: str = (
        "Register a new insurance claim. Use this first when processing any claim. "
        "Returns a claim_id and initial assessment summary."
    )
    args_schema: Type[BaseModel] = ClaimIntakeInput

    def _run(self, claimant_name: str, policy_number: str, incident_date: str,
             incident_description: str, claim_type: str) -> str:
        return call_hiveagent_tool("insurance_claim_intake", {
            "claimant_name": claimant_name,
            "policy_number": policy_number,
            "incident_date": incident_date,
            "incident_description": incident_description,
            "claim_type": claim_type,
        })


class DamageAssessInput(BaseModel):
    claim_id: str = Field(description="Claim ID returned from intake")
    damage_description: str = Field(description="Detailed damage description")
    photos_available: bool = Field(default=False, description="Are photos available?")

class InsuranceDamageAssessTool(BaseTool):
    name: str = "insurance_assess_damage"
    description: str = (
        "Assess damage and estimate repair/replacement costs for an insurance claim. "
        "Run after intake. Returns cost estimates broken down by damage category."
    )
    args_schema: Type[BaseModel] = DamageAssessInput

    def _run(self, claim_id: str, damage_description: str, photos_available: bool = False) -> str:
        return call_hiveagent_tool("insurance_assess_damage", {
            "claim_id": claim_id,
            "damage_description": damage_description,
            "photos_available": photos_available,
        })


class SubrogationInput(BaseModel):
    claim_id: str = Field(description="Claim ID to check subrogation for")
    at_fault_party: Optional[str] = Field(default=None, description="Name or ID of the at-fault party")

class InsuranceSubrogationTool(BaseTool):
    name: str = "insurance_check_subrogation"
    description: str = (
        "Check whether the insurer has subrogation rights against a third party "
        "for recovery of claim costs. Returns subrogation eligibility and recovery potential."
    )
    args_schema: Type[BaseModel] = SubrogationInput

    def _run(self, claim_id: str, at_fault_party: Optional[str] = None) -> str:
        args = {"claim_id": claim_id}
        if at_fault_party:
            args["at_fault_party"] = at_fault_party
        return call_hiveagent_tool("insurance_check_subrogation", args)


class AdjusterReportInput(BaseModel):
    claim_id: str = Field(description="Claim ID for the report")
    findings: str = Field(description="Adjuster's findings and field observations")

class InsuranceAdjusterReportTool(BaseTool):
    name: str = "insurance_adjuster_report"
    description: str = (
        "Generate a formal adjuster report combining intake, damage assessment, "
        "and field findings. This is the final step before claim settlement."
    )
    args_schema: Type[BaseModel] = AdjusterReportInput

    def _run(self, claim_id: str, findings: str) -> str:
        return call_hiveagent_tool("insurance_adjuster_report", {
            "claim_id": claim_id,
            "findings": findings,
        })


# ── Legal Agent Tools ──────────────────────────────────────────────────────────

class LegalCaseIntakeInput(BaseModel):
    client_name: str = Field(description="Client's full name")
    case_type: str = Field(description="Type of legal matter (e.g. personal_injury, contract_dispute, employment)")
    description: str = Field(description="Description of the legal matter")
    jurisdiction: str = Field(description="State or jurisdiction (e.g. 'California', 'New York')")

class LegalCaseIntakeTool(BaseTool):
    name: str = "legal_intake_case"
    description: str = (
        "Open a new legal case file. Captures client info, matter type, and jurisdiction. "
        "Returns a case_id and preliminary legal analysis."
    )
    args_schema: Type[BaseModel] = LegalCaseIntakeInput

    def _run(self, client_name: str, case_type: str, description: str, jurisdiction: str) -> str:
        return call_hiveagent_tool("legal_intake_case", {
            "client_name": client_name,
            "case_type": case_type,
            "description": description,
            "jurisdiction": jurisdiction,
        })


class DemandLetterInput(BaseModel):
    case_id: str = Field(description="Case ID from intake")
    defendant_name: str = Field(description="Name of the opposing party")
    demand_amount_usd: float = Field(description="Dollar amount being demanded")
    demand_basis: str = Field(description="Legal basis for the demand")

class LegalDemandLetterTool(BaseTool):
    name: str = "legal_demand_letter"
    description: str = (
        "Draft a formal legal demand letter for a case. "
        "Returns a professionally formatted letter ready for review and dispatch."
    )
    args_schema: Type[BaseModel] = DemandLetterInput

    def _run(self, case_id: str, defendant_name: str,
             demand_amount_usd: float, demand_basis: str) -> str:
        return call_hiveagent_tool("legal_demand_letter", {
            "case_id": case_id,
            "defendant_name": defendant_name,
            "demand_amount_usd": demand_amount_usd,
            "demand_basis": demand_basis,
        })


class CaseLawSearchInput(BaseModel):
    query: str = Field(description="Legal question or search terms")
    jurisdiction: Optional[str] = Field(default=None, description="Limit to a specific jurisdiction")

class LegalCaseLawTool(BaseTool):
    name: str = "legal_search_case_law"
    description: str = (
        "Search case law and legal precedents relevant to a matter. "
        "Returns matching cases with citations, summaries, and applicability notes."
    )
    args_schema: Type[BaseModel] = CaseLawSearchInput

    def _run(self, query: str, jurisdiction: Optional[str] = None) -> str:
        args = {"query": query}
        if jurisdiction:
            args["jurisdiction"] = jurisdiction
        return call_hiveagent_tool("legal_search_case_law", args)


# ── Finance Agent Tools ────────────────────────────────────────────────────────

class TransactionCategorizeInput(BaseModel):
    description: str = Field(description="Transaction description or memo")
    amount_usd: float = Field(description="Transaction amount")
    merchant: Optional[str] = Field(default=None, description="Merchant name if known")

class SMBCategorizeTool(BaseTool):
    name: str = "smb_categorize_transaction"
    description: str = (
        "Categorize a business transaction for bookkeeping purposes. "
        "Returns GAAP category, tax treatment, and deductibility status."
    )
    args_schema: Type[BaseModel] = TransactionCategorizeInput

    def _run(self, description: str, amount_usd: float, merchant: Optional[str] = None) -> str:
        args = {"description": description, "amount_usd": amount_usd}
        if merchant:
            args["merchant"] = merchant
        return call_hiveagent_tool("smb_categorize_transaction", args)


class InsuranceCompareInput(BaseModel):
    business_type: str = Field(description="Type of business (e.g. contractor, retail, restaurant)")
    coverage_needs: list = Field(description="List of coverage types needed (e.g. ['general_liability', 'workers_comp'])")
    annual_revenue_usd: float = Field(description="Annual revenue in USD")
    employee_count: int = Field(description="Number of employees")

class SMBInsuranceCompareTool(BaseTool):
    name: str = "smb_compare_insurance"
    description: str = (
        "Compare business insurance options across multiple carriers. "
        "Returns ranked options with premiums, coverage limits, and exclusions."
    )
    args_schema: Type[BaseModel] = InsuranceCompareInput

    def _run(self, business_type: str, coverage_needs: list,
             annual_revenue_usd: float, employee_count: int) -> str:
        return call_hiveagent_tool("smb_compare_insurance", {
            "business_type": business_type,
            "coverage_needs": coverage_needs,
            "annual_revenue_usd": annual_revenue_usd,
            "employee_count": employee_count,
        })


class FraudCheckInput(BaseModel):
    claim_id: str = Field(description="Claim ID or transaction ID to check")
    claim_type: str = Field(description="Type of claim being checked")
    red_flags: Optional[list] = Field(default=None, description="Any known red flags to investigate")

class FraudCheckTool(BaseTool):
    name: str = "workflow_full_fraud_check"
    description: str = (
        "Run a comprehensive fraud detection workflow on a claim or transaction. "
        "Checks against fraud patterns, cross-references policy history, "
        "and returns a fraud probability score with risk factors."
    )
    args_schema: Type[BaseModel] = FraudCheckInput

    def _run(self, claim_id: str, claim_type: str,
             red_flags: Optional[list] = None) -> str:
        args = {"claim_id": claim_id, "claim_type": claim_type}
        if red_flags:
            args["red_flags"] = red_flags
        return call_hiveagent_tool("workflow_full_fraud_check", args)


# ─── Build the CrewAI Crew ────────────────────────────────────────────────────

def build_insurance_crew():
    """
    A three-agent crew that handles an end-to-end insurance claim:
    - Insurance Agent: intakes the claim, assesses damage
    - Legal Agent: reviews liability, searches case law, drafts demand
    - Finance Agent: checks fraud, evaluates financial exposure

    Each agent uses a different HiveAgent vertical, showing how one
    MCP endpoint can power a complete multi-vertical crew.
    """

    # ── Agent 1: Insurance Specialist ─────────────────────────────────────────
    insurance_agent = Agent(
        role="Senior Insurance Claims Specialist",
        goal=(
            "Process insurance claims thoroughly and accurately. "
            "Intake claims, assess damage, check subrogation rights, "
            "and produce a complete adjuster report."
        ),
        backstory=(
            "You are a seasoned insurance adjuster with 15 years of experience "
            "across auto, property, and liability claims. You use HiveAgent's "
            "insurance vertical tools to process claims faster than any human adjuster. "
            "You're meticulous, fair, and focused on accurate loss assessment."
        ),
        tools=[
            InsuranceClaimIntakeTool(),
            InsuranceDamageAssessTool(),
            InsuranceSubrogationTool(),
            InsuranceAdjusterReportTool(),
        ],
        verbose=True,
        allow_delegation=True,
    )

    # ── Agent 2: Legal Counsel ─────────────────────────────────────────────────
    legal_agent = Agent(
        role="Insurance Defense Counsel",
        goal=(
            "Analyze the legal dimensions of insurance claims. "
            "Identify liability exposure, find relevant precedents, "
            "and draft demand letters or defense strategies as needed."
        ),
        backstory=(
            "You are an experienced insurance attorney who specializes in "
            "claims litigation and subrogation recovery. You use HiveAgent's "
            "legal vertical to research case law and draft professional legal "
            "documents in minutes instead of hours."
        ),
        tools=[
            LegalCaseIntakeTool(),
            LegalCaseLawTool(),
            LegalDemandLetterTool(),
        ],
        verbose=True,
        allow_delegation=True,
    )

    # ── Agent 3: Financial Risk Analyst ───────────────────────────────────────
    finance_agent = Agent(
        role="Claims Fraud and Financial Risk Analyst",
        goal=(
            "Detect fraud, categorize financial transactions, "
            "and quantify the total financial exposure of each claim. "
            "Flag suspicious patterns and recommend appropriate reserves."
        ),
        backstory=(
            "You are a certified fraud examiner with deep expertise in "
            "insurance fraud detection. You use HiveAgent's finance and "
            "fraud-detection tools to cross-check claims against historical "
            "patterns and identify fraudulent indicators before settlements are made."
        ),
        tools=[
            FraudCheckTool(),
            SMBCategorizeTool(),
            SMBInsuranceCompareTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )

    # ── Task 1: Claim Intake & Damage Assessment ───────────────────────────────
    claim_task = Task(
        description=(
            "Process this insurance claim:\n"
            "- Claimant: Robert Chen\n"
            "- Policy: PROP-2024-55102 (homeowners)\n"
            "- Incident Date: 2025-02-28\n"
            "- What happened: A pipe burst in the basement, causing flooding that "
            "  damaged flooring, drywall, furniture, and the HVAC system.\n\n"
            "1. Run the claim intake\n"
            "2. Assess the damage and estimate costs\n"
            "3. Check subrogation rights (plumbing contractor was potentially at fault)\n"
            "4. Generate the adjuster report\n\n"
            "Pass the claim_id to the other agents."
        ),
        expected_output=(
            "A complete claim package: claim_id, damage assessment with cost breakdown, "
            "subrogation analysis, and a draft adjuster report ready for review."
        ),
        agent=insurance_agent,
    )

    # ── Task 2: Legal Analysis ─────────────────────────────────────────────────
    legal_task = Task(
        description=(
            "Analyze the legal dimensions of the water damage claim from Task 1.\n\n"
            "1. Open a legal case file for potential subrogation action\n"
            "2. Search for relevant case law on contractor liability for pipe failures\n"
            "3. If subrogation rights exist, draft a demand letter to the "
            "   plumbing contractor (TruFlow Plumbing, contractor license CA-2019-44821)\n\n"
            "Jurisdiction: California. Demand basis: negligent pipe installation."
        ),
        expected_output=(
            "A legal analysis with: case_id, relevant case law citations, "
            "and a complete demand letter ready for dispatch to the plumbing contractor."
        ),
        agent=legal_agent,
        context=[claim_task],
    )

    # ── Task 3: Fraud Detection & Financial Summary ────────────────────────────
    fraud_task = Task(
        description=(
            "Perform fraud detection and financial risk analysis on the claim from Task 1.\n\n"
            "1. Run a full fraud check on the claim (claim_type: property)\n"
            "2. Categorize the claim payout as a business transaction\n"
            "3. Recommend the appropriate reserve amount based on damage estimates\n\n"
            "Red flags to investigate: large HVAC damage claim, recent policy holder."
        ),
        expected_output=(
            "Fraud probability score with risk factors, transaction categorization, "
            "recommended reserve amount, and a final go/hold/investigate recommendation."
        ),
        agent=finance_agent,
        context=[claim_task],
    )

    # ── Assemble and Return the Crew ───────────────────────────────────────────
    crew = Crew(
        agents=[insurance_agent, legal_agent, finance_agent],
        tasks=[claim_task, legal_task, fraud_task],
        process=Process.sequential,   # Tasks run in order; context flows between them
        verbose=True,
    )
    return crew


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    print("="*60)
    print("HiveAgent + CrewAI: Multi-Vertical Insurance Crew")
    print("="*60)
    print("\nBuilding crew with Insurance, Legal, and Finance agents...")
    print("Each agent uses a different HiveAgent vertical.\n")

    crew = build_insurance_crew()
    result = crew.kickoff()

    print("\n" + "="*60)
    print("CREW RESULT")
    print("="*60)
    print(result)


if __name__ == "__main__":
    main()
