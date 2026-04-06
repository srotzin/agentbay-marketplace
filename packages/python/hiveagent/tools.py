"""
HiveAgent Tools Registry

Provides static metadata about HiveAgent's 586 tools and 22 verticals,
plus helpers to filter tools without a live API call.

For real-time tool discovery (semantic search), use client.discover().
"""

from __future__ import annotations

from typing import Optional

# ── Verticals ─────────────────────────────────────────────────────────────────

VERTICALS: list[str] = [
    "insurance",
    "construction",
    "legal",
    "healthcare",
    "trades",
    "smb",
    "commerce",
    "agent_recovery",
    "defi",
    "trade_customs",
    "travel",
    "procurement",
    "know_your_agent",
    "sales_crm",
    "invoice_ap",
    "fraud_detection",
    "real_estate",
    "supply_chain",
    "dynamic_pricing",
    "hr_recruiting",
    "agriculture",
    "advertising",
]

# ── Tool registry ─────────────────────────────────────────────────────────────
#
# Each entry: (name, vertical, short_description)
#
TOOL_REGISTRY: list[dict] = [
    # Insurance
    {"name": "insurance_claim_intake",     "vertical": "insurance",       "description": "Intake a new insurance claim from structured or unstructured input"},
    {"name": "insurance_assess_damage",    "vertical": "insurance",       "description": "AI-powered damage assessment from photos, documents, or descriptions"},
    {"name": "insurance_compare_policies", "vertical": "insurance",       "description": "Compare insurance policies and recommend the best fit"},
    {"name": "insurance_check_subrogation","vertical": "insurance",       "description": "Identify third-party liability opportunities in a claim"},
    {"name": "insurance_adjuster_report",  "vertical": "insurance",       "description": "Generate a complete adjuster report from claim data"},
    {"name": "insurance_claims_analytics", "vertical": "insurance",       "description": "Portfolio-level claims analytics and trend detection"},

    # Construction
    {"name": "construction_lookup_zoning",       "vertical": "construction", "description": "Look up zoning regulations for a parcel"},
    {"name": "construction_permit_status",       "vertical": "construction", "description": "Check real-time permit status from municipal APIs"},
    {"name": "construction_material_takeoff",    "vertical": "construction", "description": "Generate a materials quantity takeoff from plans or specs"},
    {"name": "construction_match_subcontractor", "vertical": "construction", "description": "Match qualified subcontractors to a project scope"},
    {"name": "construction_draw_schedule",       "vertical": "construction", "description": "Build a lender-ready draw schedule from project milestones"},

    # Legal
    {"name": "legal_intake_case",       "vertical": "legal", "description": "Intake a new legal case from client information"},
    {"name": "legal_summarize_records", "vertical": "legal", "description": "Summarize medical or discovery records for legal proceedings"},
    {"name": "legal_demand_letter",     "vertical": "legal", "description": "Draft a demand letter from case facts"},
    {"name": "legal_track_deadlines",   "vertical": "legal", "description": "Track all filing and response deadlines for active cases"},
    {"name": "legal_search_case_law",   "vertical": "legal", "description": "Search case law and statute databases for relevant precedents"},

    # Healthcare
    {"name": "health_prior_auth",     "vertical": "healthcare", "description": "Submit and track prior authorization requests"},
    {"name": "health_clinical_note",  "vertical": "healthcare", "description": "Generate structured clinical notes from encounter data"},
    {"name": "health_claim_codes",    "vertical": "healthcare", "description": "Translate clinical notes to ICD-10 / CPT billing codes"},
    {"name": "health_interpret_labs", "vertical": "healthcare", "description": "Interpret lab results and flag clinically significant values"},
    {"name": "health_compliance",     "vertical": "healthcare", "description": "Audit healthcare workflows for HIPAA and billing compliance"},

    # Trades
    {"name": "trades_lookup_permits",   "vertical": "trades", "description": "Look up permit requirements for a trade job by jurisdiction"},
    {"name": "trades_estimate_job",     "vertical": "trades", "description": "Generate a detailed job cost estimate"},
    {"name": "trades_find_parts",       "vertical": "trades", "description": "Source parts and materials with pricing from distributors"},
    {"name": "trades_check_code",       "vertical": "trades", "description": "Verify work compliance with local building codes"},
    {"name": "trades_generate_invoice", "vertical": "trades", "description": "Generate a professional invoice for a completed job"},

    # SMB
    {"name": "smb_categorize_transaction", "vertical": "smb", "description": "Categorize bank transactions for bookkeeping"},
    {"name": "smb_prep_tax",               "vertical": "smb", "description": "Prepare tax summaries from transaction history"},
    {"name": "smb_check_licenses",         "vertical": "smb", "description": "Check and track business license requirements by jurisdiction"},
    {"name": "smb_compare_insurance",      "vertical": "smb", "description": "Compare business insurance plans and coverage"},
    {"name": "smb_generate_contract",      "vertical": "smb", "description": "Generate vendor, client, or employment contracts"},
    {"name": "smb_dashboard",              "vertical": "smb", "description": "View holistic small business health metrics"},

    # Commerce
    {"name": "commerce_verify_product",      "vertical": "commerce", "description": "Verify product authenticity and listing accuracy"},
    {"name": "commerce_merchant_trust",      "vertical": "commerce", "description": "Score a merchant's reputation and trust signals"},
    {"name": "commerce_detect_manipulation", "vertical": "commerce", "description": "Detect dark patterns and price manipulation in listings"},
    {"name": "commerce_create_purchase",     "vertical": "commerce", "description": "Create a purchase order with payment and escrow"},
    {"name": "commerce_track_purchase",      "vertical": "commerce", "description": "Track order status and delivery in real time"},

    # Agent Recovery
    {"name": "recovery_check_health",         "vertical": "agent_recovery", "description": "Check agent health metrics and error rates"},
    {"name": "recovery_circuit_status",       "vertical": "agent_recovery", "description": "Query circuit-breaker state for a service"},
    {"name": "recovery_initiate_handoff",     "vertical": "agent_recovery", "description": "Gracefully hand off to a backup agent or human"},
    {"name": "recovery_start_trace",          "vertical": "agent_recovery", "description": "Start a distributed trace for an agent session"},
    {"name": "recovery_detect_hallucination", "vertical": "agent_recovery", "description": "Detect and flag hallucinated outputs using grounding"},

    # DeFi
    {"name": "hiveagent_defi_swap",      "vertical": "defi", "description": "Execute a token swap on a decentralised exchange"},
    {"name": "hiveagent_defi_lend",      "vertical": "defi", "description": "Open or manage a lending/borrowing position"},
    {"name": "hiveagent_defi_yield",     "vertical": "defi", "description": "Deposit into a yield farming or liquidity pool"},
    {"name": "hiveagent_defi_positions", "vertical": "defi", "description": "View all open DeFi positions and health factors"},

    # Trade / Customs
    {"name": "trade_classify_hs",           "vertical": "trade_customs", "description": "Classify goods with the correct HS tariff code"},
    {"name": "trade_screen_sanctions",      "vertical": "trade_customs", "description": "Screen parties and goods against sanctions lists"},
    {"name": "trade_calculate_duty",        "vertical": "trade_customs", "description": "Calculate import duties and taxes"},
    {"name": "trade_generate_customs_docs", "vertical": "trade_customs", "description": "Generate a complete customs documentation package"},
    {"name": "trade_check_export_controls", "vertical": "trade_customs", "description": "Check export control classifications and licence requirements"},

    # Travel
    {"name": "travel_search_flights",       "vertical": "travel", "description": "Search available flights across airlines and booking engines"},
    {"name": "travel_book_flight",          "vertical": "travel", "description": "Book a flight and return PNR confirmation"},
    {"name": "travel_search_hotels",        "vertical": "travel", "description": "Search hotels by location, dates, and preferences"},
    {"name": "travel_book_hotel",           "vertical": "travel", "description": "Book a hotel room with payment"},
    {"name": "travel_search_restaurants",   "vertical": "travel", "description": "Search and filter restaurant options"},
    {"name": "travel_build_itinerary",      "vertical": "travel", "description": "Build a day-by-day travel itinerary"},
    {"name": "travel_visa_requirements",    "vertical": "travel", "description": "Check visa requirements for a nationality/destination pair"},
    {"name": "travel_compare_car_rentals",  "vertical": "travel", "description": "Compare car rental options and pricing"},

    # Procurement
    {"name": "procurement_discover_suppliers", "vertical": "procurement", "description": "Discover and rank suppliers for a product category"},
    {"name": "procurement_create_rfq",         "vertical": "procurement", "description": "Generate and send a request for quotation"},
    {"name": "procurement_evaluate_bids",      "vertical": "procurement", "description": "Score and rank supplier bids objectively"},
    {"name": "procurement_draft_contract",     "vertical": "procurement", "description": "Draft a supplier contract from negotiated terms"},
    {"name": "procurement_match_invoice",      "vertical": "procurement", "description": "Match invoices to purchase orders and receipts"},
    {"name": "procurement_spend_analytics",    "vertical": "procurement", "description": "Analyse spend patterns and identify savings opportunities"},

    # Know Your Agent
    {"name": "kya_verify_agent",           "vertical": "know_your_agent", "description": "Verify an agent's identity and credentials"},
    {"name": "kya_classify_bot",           "vertical": "know_your_agent", "description": "Classify whether a caller is a human, bot, or agent"},
    {"name": "kya_check_delegation",       "vertical": "know_your_agent", "description": "Check an agent's authorised delegation scope"},
    {"name": "kya_behavior_score",         "vertical": "know_your_agent", "description": "Score an agent's behaviour for trust and risk"},
    {"name": "kya_enforce_spending_limit", "vertical": "know_your_agent", "description": "Enforce a real-time spending limit on an agent"},
    {"name": "kya_report_suspicious",      "vertical": "know_your_agent", "description": "Report suspicious agent activity for review"},

    # Sales CRM
    {"name": "sales_enrich_lead",       "vertical": "sales_crm", "description": "Enrich a lead with firmographic and contact data"},
    {"name": "sales_score_lead",        "vertical": "sales_crm", "description": "Score a lead against your ICP and rank priority"},
    {"name": "sales_generate_outreach", "vertical": "sales_crm", "description": "Generate a personalised outreach sequence"},
    {"name": "sales_schedule_meeting",  "vertical": "sales_crm", "description": "Book a discovery call and send calendar invites"},
    {"name": "sales_forecast_pipeline", "vertical": "sales_crm", "description": "Forecast pipeline value and close probability"},
    {"name": "sales_track_competitors", "vertical": "sales_crm", "description": "Monitor competitor moves and pricing changes"},

    # Invoice / AP
    {"name": "invoice_extract_data",    "vertical": "invoice_ap", "description": "Extract structured data from invoice PDFs or images"},
    {"name": "invoice_three_way_match", "vertical": "invoice_ap", "description": "Match invoice to PO and goods receipt"},
    {"name": "invoice_detect_duplicate","vertical": "invoice_ap", "description": "Detect duplicate invoices before payment"},
    {"name": "invoice_route_approval",  "vertical": "invoice_ap", "description": "Route an invoice through the approval chain"},
    {"name": "invoice_optimize_payment","vertical": "invoice_ap", "description": "Optimise payment timing for discounts and cash flow"},
    {"name": "invoice_ap_dashboard",    "vertical": "invoice_ap", "description": "View AP health: aging, DPO, and approval bottlenecks"},

    # Fraud Detection
    {"name": "fraud_screen_transaction", "vertical": "fraud_detection", "description": "Screen a transaction for fraud risk in real time"},
    {"name": "fraud_detect_anomalies",   "vertical": "fraud_detection", "description": "Detect behavioural anomalies across an account"},
    {"name": "fraud_check_identity",     "vertical": "fraud_detection", "description": "Verify account holder identity against authoritative sources"},
    {"name": "fraud_predict_chargeback", "vertical": "fraud_detection", "description": "Predict chargeback risk for a transaction"},
    {"name": "fraud_analyze_network",    "vertical": "fraud_detection", "description": "Map entity relationships to detect fraud rings"},
    {"name": "fraud_dashboard",          "vertical": "fraud_detection", "description": "Monitor platform-wide fraud trends and KPIs"},

    # Real Estate
    {"name": "realestate_search_properties",  "vertical": "real_estate", "description": "Search MLS and off-market property listings"},
    {"name": "realestate_get_comps",          "vertical": "real_estate", "description": "Pull comparable sales for a subject property"},
    {"name": "realestate_calculate_mortgage", "vertical": "real_estate", "description": "Calculate mortgage payments and affordability"},
    {"name": "realestate_check_title",        "vertical": "real_estate", "description": "Run a title search and flag encumbrances"},
    {"name": "realestate_estimate_value",     "vertical": "real_estate", "description": "Get an AVM (automated valuation) for a property"},
    {"name": "realestate_neighborhood_stats", "vertical": "real_estate", "description": "Pull neighbourhood demographics and livability scores"},

    # Supply Chain
    {"name": "supply_forecast_demand",      "vertical": "supply_chain", "description": "Forecast demand across SKUs and geographies"},
    {"name": "supply_optimize_inventory",   "vertical": "supply_chain", "description": "Optimise inventory levels to reduce cost and stockouts"},
    {"name": "supply_track_shipment",       "vertical": "supply_chain", "description": "Track a shipment across carriers in real time"},
    {"name": "supply_compare_freight",      "vertical": "supply_chain", "description": "Compare freight carriers on price, speed, and reliability"},
    {"name": "supply_assess_supplier_risk", "vertical": "supply_chain", "description": "Assess financial and operational risk for a supplier"},
    {"name": "supply_dashboard",            "vertical": "supply_chain", "description": "View supply chain health and KPIs"},

    # Dynamic Pricing
    {"name": "pricing_monitor_competitors", "vertical": "dynamic_pricing", "description": "Monitor competitor prices across channels"},
    {"name": "pricing_calculate_optimal",   "vertical": "dynamic_pricing", "description": "Calculate the profit-maximising price for a product"},
    {"name": "pricing_simulate_change",     "vertical": "dynamic_pricing", "description": "Simulate revenue impact of a proposed price change"},
    {"name": "pricing_generate_promo",      "vertical": "dynamic_pricing", "description": "Generate promotional pricing and discount codes"},
    {"name": "pricing_dashboard",           "vertical": "dynamic_pricing", "description": "Monitor pricing performance and competitor index"},

    # HR / Recruiting
    {"name": "hr_screen_resume",         "vertical": "hr_recruiting", "description": "Screen and score resumes against a job description"},
    {"name": "hr_match_candidates",      "vertical": "hr_recruiting", "description": "Rank candidates against job requirements"},
    {"name": "hr_interview_questions",   "vertical": "hr_recruiting", "description": "Generate tailored interview questions for a candidate"},
    {"name": "hr_check_compensation",    "vertical": "hr_recruiting", "description": "Benchmark compensation against market data"},
    {"name": "hr_automate_onboarding",   "vertical": "hr_recruiting", "description": "Automate new-hire onboarding workflows"},
    {"name": "hr_recruiting_dashboard",  "vertical": "hr_recruiting", "description": "View recruiting pipeline metrics and time-to-fill"},

    # Platform / meta tools
    {"name": "hiveagent_discover",          "vertical": "platform", "description": "Discover the best HiveAgent tools for a task description"},
    {"name": "hiveagent_suggest_workflow",  "vertical": "platform", "description": "Get a step-by-step workflow for a complex task"},
    {"name": "hiveagent_vertical_guide",    "vertical": "platform", "description": "Get a guide to all tools in a specific vertical"},
]


# ── Public functions ──────────────────────────────────────────────────────────

def list_verticals() -> list[str]:
    """
    List all 22 industry verticals available on HiveAgent.

    Returns:
        List of vertical name strings.

    Example::

        from hiveagent import list_verticals
        for v in list_verticals():
            print(v)
    """
    return list(VERTICALS)


def get_tools(vertical: Optional[str] = None) -> list[dict]:
    """
    Get tool definitions, optionally filtered by vertical.

    Args:
        vertical: Optional vertical name to filter by (e.g. 'insurance',
                  'legal', 'healthcare'). Pass None to get all tools.

    Returns:
        List of tool definition dicts with 'name', 'vertical', and
        'description' fields.

    Example::

        from hiveagent.tools import get_tools

        # All tools
        all_tools = get_tools()
        print(f"{len(all_tools)} tools available")

        # Insurance tools only
        insurance = get_tools("insurance")
        for tool in insurance:
            print(tool['name'])
    """
    if vertical is None:
        return list(TOOL_REGISTRY)
    lower = vertical.lower()
    return [t for t in TOOL_REGISTRY if t["vertical"].lower() == lower]


def get_tool(name: str) -> Optional[dict]:
    """
    Get a specific tool's schema by name.

    Args:
        name: Exact tool name (e.g. 'insurance_claim_intake').

    Returns:
        Tool definition dict, or None if not found.

    Example::

        from hiveagent.tools import get_tool

        tool = get_tool("fraud_screen_transaction")
        if tool:
            print(tool['description'])
    """
    for tool in TOOL_REGISTRY:
        if tool["name"] == name:
            return tool
    return None
