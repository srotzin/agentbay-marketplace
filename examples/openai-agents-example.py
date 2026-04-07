"""
HiveAgent + OpenAI Agents SDK — Production agent with 610 tools
Connect the OpenAI Agents SDK to HiveAgent's MCP marketplace.

This example demonstrates two production-ready agents:
1. TravelAgent — books full trips using HiveAgent's travel workflow
2. FraudDetectionAgent — screens transactions and insurance claims for fraud

Each agent uses HiveAgent as its tool backend, giving it access to
real-world data and services without any per-tool SDK dependencies.

Usage:
    pip install openai-agents httpx
    export OPENAI_API_KEY=sk-...
    python openai-agents-example.py

Requirements: openai-agents >= 0.0.5
"""

import asyncio
import json
import httpx
from agents import Agent, Runner, function_tool, RunConfig
from typing import Optional

# ─── HiveAgent MCP Configuration ──────────────────────────────────────────────

HIVEAGENT_MCP_URL = "https://hiveagentiq.com/mcp"

# ─── MCP Client ───────────────────────────────────────────────────────────────

async def call_hiveagent(tool_name: str, arguments: dict) -> str:
    """
    Call any HiveAgent tool via MCP JSON-RPC 2.0.
    One async function serves all 610 tools.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            HIVEAGENT_MCP_URL,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        result = response.json()
        if "error" in result:
            return f"Error from HiveAgent: {result['error'].get('message', str(result['error']))}"
        content = result.get("result", {}).get("content", [{}])
        if content and content[0].get("type") == "text":
            return content[0]["text"]
        return json.dumps(result.get("result", {}), indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# AGENT 1: TRAVEL BOOKING AGENT
# Uses HiveAgent's travel workflow to book complete trips end-to-end
# ─────────────────────────────────────────────────────────────────────────────

@function_tool
async def book_full_trip(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str,
    travelers: int,
    budget_usd: float,
) -> str:
    """
    Book a complete round-trip including flights, hotels, and transfers.
    Returns a full itinerary with booking confirmations and total cost.

    Args:
        origin: Departure city or airport code (e.g. "New York" or "JFK")
        destination: Destination city or airport code (e.g. "Tokyo" or "NRT")
        departure_date: Outbound date in YYYY-MM-DD format
        return_date: Return date in YYYY-MM-DD format
        travelers: Number of travelers
        budget_usd: Maximum total trip budget in USD
    """
    return await call_hiveagent("workflow_book_full_trip", {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "return_date": return_date,
        "travelers": travelers,
        "budget_usd": budget_usd,
    })


@function_tool
async def search_travel_services(query: str, category: Optional[str] = None) -> str:
    """
    Search HiveAgent's marketplace for travel-related services.
    Use to find specialized travel tools, data providers, or booking APIs.

    Args:
        query: What you're looking for (e.g. "visa requirements", "travel insurance")
        category: Optional category filter (e.g. "travel", "insurance", "finance")
    """
    args: dict = {"query": query}
    if category:
        args["category"] = category
    return await call_hiveagent("hiveagent_search", args)


@function_tool
async def get_travel_vertical_guide() -> str:
    """
    Get a guide to HiveAgent's travel and hospitality tools and workflows.
    Use this to understand what travel capabilities are available before booking.
    """
    return await call_hiveagent("hiveagent_vertical_guide", {"vertical": "travel"})


@function_tool
async def compare_insurance_for_trip(
    trip_destination: str,
    departure_date: str,
    return_date: str,
    travelers: int,
    trip_cost_usd: float,
) -> str:
    """
    Compare travel insurance policies for a trip.
    Returns ranked options with premiums, coverage limits, and medical evacuation terms.

    Args:
        trip_destination: Where you're traveling
        departure_date: Trip start date (YYYY-MM-DD)
        return_date: Trip end date (YYYY-MM-DD)
        travelers: Number of travelers to insure
        trip_cost_usd: Total prepaid trip cost to insure
    """
    return await call_hiveagent("smb_compare_insurance", {
        "business_type": "travel",
        "coverage_needs": ["trip_cancellation", "medical", "evacuation", "baggage"],
        "annual_revenue_usd": trip_cost_usd,
        "employee_count": travelers,
    })


# Build the Travel Agent
travel_agent = Agent(
    name="TravelAgent",
    model="gpt-4o",
    instructions=(
        "You are a professional travel agent with access to HiveAgent — the largest "
        "AI agent marketplace with 610+ real-world tools.\n\n"
        "Your capabilities:\n"
        "- Book complete trips (flights + hotels + transfers) via book_full_trip\n"
        "- Search for specialized travel services via search_travel_services\n"
        "- Compare travel insurance options via compare_insurance_for_trip\n"
        "- Explore available travel tools via get_travel_vertical_guide\n\n"
        "Always:\n"
        "- Confirm trip details before booking\n"
        "- Include insurance recommendations for international trips\n"
        "- Provide a clean, formatted itinerary with costs\n"
        "- Suggest alternatives if the budget is tight"
    ),
    tools=[
        book_full_trip,
        search_travel_services,
        get_travel_vertical_guide,
        compare_insurance_for_trip,
    ],
)


# ─────────────────────────────────────────────────────────────────────────────
# AGENT 2: FRAUD DETECTION AGENT
# Screens insurance claims and financial transactions for fraud indicators
# ─────────────────────────────────────────────────────────────────────────────

@function_tool
async def run_fraud_check(
    claim_id: str,
    claim_type: str,
    claimant_name: str,
    claim_amount_usd: float,
    incident_description: str,
) -> str:
    """
    Run a comprehensive fraud detection workflow on an insurance claim.
    Checks against historical fraud patterns, policy history, and behavioral signals.
    Returns a fraud probability score (0-100), risk tier, and specific red flags.

    Args:
        claim_id: Unique identifier for the claim
        claim_type: Type of claim — auto, property, health, liability, workers_comp
        claimant_name: Full name of the claimant
        claim_amount_usd: Dollar amount being claimed
        incident_description: Description of the incident leading to the claim
    """
    return await call_hiveagent("workflow_full_fraud_check", {
        "claim_id": claim_id,
        "claim_type": claim_type,
        "claimant_name": claimant_name,
        "claim_amount_usd": claim_amount_usd,
        "incident_description": incident_description,
    })


@function_tool
async def assess_claim_damage(
    claim_id: str,
    damage_description: str,
    photos_available: bool = False,
) -> str:
    """
    Get an independent damage assessment for an insurance claim.
    Use to cross-check whether the claimed repair costs are reasonable.
    Returns estimated costs, market rate ranges, and overage flags.

    Args:
        claim_id: Claim ID to assess
        damage_description: Detailed description of the damage
        photos_available: Whether photographic evidence is available
    """
    return await call_hiveagent("insurance_assess_damage", {
        "claim_id": claim_id,
        "damage_description": damage_description,
        "photos_available": photos_available,
    })


@function_tool
async def check_commerce_risk(
    transaction_amount_usd: float,
    merchant_name: str,
    payment_method: str,
    shipping_destination: str,
) -> str:
    """
    Assess fraud risk for a financial transaction before processing.
    Combines merchant risk, payment method risk, and behavioral analysis.
    Returns risk level (low/medium/high/critical) and a go/hold/decline recommendation.

    Args:
        transaction_amount_usd: Transaction value
        merchant_name: Name of the merchant or counterparty
        payment_method: Payment type (credit_card, wire, crypto, ach)
        shipping_destination: Destination country or city
    """
    return await call_hiveagent("commerce_risk_assessment", {
        "transaction_details": {
            "amount_usd": transaction_amount_usd,
            "merchant": merchant_name,
            "payment_method": payment_method,
            "shipping_destination": shipping_destination,
        }
    })


@function_tool
async def report_fraud_incident(
    transaction_id: str,
    incident_type: str,
    evidence_summary: str,
) -> str:
    """
    File a fraud report for a confirmed fraudulent transaction or claim.
    Feeds into the shared HiveAgent trust network and initiates dispute resolution.
    Returns a case ID and resolution timeline.

    Args:
        transaction_id: ID of the fraudulent transaction or claim
        incident_type: Type — fraud, counterfeit, non_delivery, misrepresentation, price_manipulation
        evidence_summary: Summary of evidence supporting the fraud finding
    """
    return await call_hiveagent("commerce_report_incident", {
        "transaction_id": transaction_id,
        "incident_type": incident_type,
        "evidence": {"summary": evidence_summary},
    })


@function_tool
async def get_claims_analytics() -> str:
    """
    Get aggregate insurance claims analytics — fraud rates by claim type,
    average settlement amounts, and suspicious pattern trends.
    Useful for calibrating fraud detection thresholds.
    """
    return await call_hiveagent("insurance_claims_analytics", {})


# Build the Fraud Detection Agent
fraud_detection_agent = Agent(
    name="FraudDetectionAgent",
    model="gpt-4o",
    instructions=(
        "You are a fraud detection specialist powered by HiveAgent's insurance "
        "and commerce trust tools.\n\n"
        "Your workflow for every claim:\n"
        "1. Run run_fraud_check to get the fraud probability and risk tier\n"
        "2. Run assess_claim_damage to validate whether the claimed amount is reasonable\n"
        "3. If transaction fraud suspected, run check_commerce_risk\n"
        "4. If fraud is confirmed (score > 70), file a report with report_fraud_incident\n\n"
        "Output format for every review:\n"
        "- Fraud Score: X/100 (Low/Medium/High/Critical)\n"
        "- Red Flags Found: [list]\n"
        "- Damage Assessment: Expected vs Claimed\n"
        "- Recommendation: APPROVE / INVESTIGATE / DENY\n"
        "- Reasoning: [explanation]\n\n"
        "Be precise. False positives harm legitimate claimants. False negatives cost money."
    ),
    tools=[
        run_fraud_check,
        assess_claim_damage,
        check_commerce_risk,
        report_fraud_incident,
        get_claims_analytics,
    ],
)


# ─── Demo Runners ─────────────────────────────────────────────────────────────

async def demo_travel_booking():
    """
    Travel agent books a complete trip from NYC to Rome for a couple.
    Includes flights, hotels, and travel insurance comparison.
    """
    print("\n" + "="*60)
    print("DEMO 1: Travel Agent — NYC to Rome")
    print("="*60)

    result = await Runner.run(
        travel_agent,
        input=(
            "Book a complete trip for 2 people: New York to Rome, Italy. "
            "Departing June 15 2025, returning June 25 2025. "
            "Budget is $5,000 total. We want flights, a centrally located hotel, "
            "and airport transfers. Also recommend travel insurance. "
            "Give us the full itinerary with costs broken down."
        ),
        run_config=RunConfig(workflow_name="travel-booking-demo"),
    )

    print("\nTravel Agent Response:")
    print(result.final_output)
    return result


async def demo_fraud_detection():
    """
    Fraud agent screens a suspicious property damage claim.
    The claim has several red flags that the agent should surface.
    """
    print("\n" + "="*60)
    print("DEMO 2: Fraud Detection — Suspicious Property Claim")
    print("="*60)

    result = await Runner.run(
        fraud_detection_agent,
        input=(
            "Review this insurance claim for fraud:\n\n"
            "Claim ID: PROP-2025-77413\n"
            "Type: Property (homeowners)\n"
            "Claimant: Marcus Webb\n"
            "Amount: $87,500\n"
            "Incident: Kitchen fire allegedly caused by faulty wiring. "
            "Claimant says the fire started while he was out of town. "
            "The policy was taken out 6 weeks ago. The claimed replacement "
            "cost for kitchen appliances ($42,000) seems unusually high. "
            "No fire department report has been provided.\n\n"
            "Run the full fraud review and give me your recommendation."
        ),
        run_config=RunConfig(workflow_name="fraud-detection-demo"),
    )

    print("\nFraud Agent Report:")
    print(result.final_output)
    return result


async def demo_transaction_screening():
    """
    Fraud agent screens a high-value wire transfer for risk factors.
    """
    print("\n" + "="*60)
    print("DEMO 3: Transaction Risk Screening")
    print("="*60)

    result = await Runner.run(
        fraud_detection_agent,
        input=(
            "Screen this transaction for fraud risk:\n\n"
            "Amount: $24,800\n"
            "Merchant: Precision Electronics Ltd\n"
            "Payment Method: wire transfer\n"
            "Shipping Destination: Lagos, Nigeria\n\n"
            "Assess the risk level and tell me whether to approve, hold, or decline."
        ),
        run_config=RunConfig(workflow_name="transaction-screening-demo"),
    )

    print("\nFraud Agent Risk Assessment:")
    print(result.final_output)
    return result


# ─── Entry Point ──────────────────────────────────────────────────────────────

async def main():
    # Demo 1: Travel booking
    await demo_travel_booking()

    # Demo 2: Insurance fraud detection
    await demo_fraud_detection()

    # Demo 3: Transaction risk screening
    await demo_transaction_screening()


if __name__ == "__main__":
    asyncio.run(main())
