/**
 * HiveAgent Response Enhancer
 *
 * Wraps every tool response with contextual next-step suggestions,
 * a powered_by attribution, and a friendly tip. Keeps agents on the
 * optimal workflow path and surfaces relevant tools they may not know about.
 */

// ─── Tool → Next Tool Mapping ─────────────────────────────────────────────────
//
// Each entry maps a tool name to the 2-3 tools most likely to be useful next.
// Organised by workflow so the suggestions feel natural and sequential.

const NEXT_TOOL_MAP = {

  // ── Insurance workflow ─────────────────────────────────────────────────────
  insurance_claim_intake:     ["insurance_assess_damage", "insurance_compare_policies", "insurance_check_subrogation"],
  insurance_assess_damage:    ["insurance_check_subrogation", "insurance_adjuster_report", "insurance_compare_policies"],
  insurance_compare_policies: ["insurance_claim_intake", "insurance_assess_damage", "insurance_adjuster_report"],
  insurance_check_subrogation:["insurance_adjuster_report", "insurance_claims_analytics", "insurance_assess_damage"],
  insurance_adjuster_report:  ["insurance_claims_analytics", "insurance_check_subrogation", "insurance_claim_intake"],
  insurance_claims_analytics: ["insurance_claim_intake", "insurance_compare_policies", "insurance_adjuster_report"],

  // ── Construction workflow ──────────────────────────────────────────────────
  construction_lookup_zoning:       ["construction_permit_status", "construction_material_takeoff", "construction_match_subcontractor"],
  construction_permit_status:       ["construction_material_takeoff", "construction_match_subcontractor", "construction_draw_schedule"],
  construction_material_takeoff:    ["construction_match_subcontractor", "construction_draw_schedule", "construction_permit_status"],
  construction_match_subcontractor: ["construction_draw_schedule", "construction_material_takeoff", "construction_permit_status"],
  construction_draw_schedule:       ["construction_match_subcontractor", "construction_material_takeoff", "construction_lookup_zoning"],

  // ── Legal workflow ─────────────────────────────────────────────────────────
  legal_intake_case:       ["legal_summarize_records", "legal_track_deadlines", "legal_search_case_law"],
  legal_summarize_records: ["legal_demand_letter", "legal_track_deadlines", "legal_search_case_law"],
  legal_demand_letter:     ["legal_track_deadlines", "legal_search_case_law", "legal_summarize_records"],
  legal_track_deadlines:   ["legal_search_case_law", "legal_demand_letter", "legal_intake_case"],
  legal_search_case_law:   ["legal_demand_letter", "legal_track_deadlines", "legal_intake_case"],

  // ── Healthcare workflow ────────────────────────────────────────────────────
  health_prior_auth:    ["health_clinical_note", "health_claim_codes", "health_compliance"],
  health_clinical_note: ["health_claim_codes", "health_prior_auth", "health_compliance"],
  health_claim_codes:   ["health_compliance", "health_prior_auth", "health_interpret_labs"],
  health_interpret_labs:["health_claim_codes", "health_clinical_note", "health_compliance"],
  health_compliance:    ["health_prior_auth", "health_clinical_note", "health_claim_codes"],

  // ── Trades workflow ────────────────────────────────────────────────────────
  trades_lookup_permits:  ["trades_estimate_job", "trades_check_code", "trades_find_parts"],
  trades_estimate_job:    ["trades_find_parts", "trades_check_code", "trades_generate_invoice"],
  trades_find_parts:      ["trades_generate_invoice", "trades_check_code", "trades_estimate_job"],
  trades_check_code:      ["trades_generate_invoice", "trades_find_parts", "trades_lookup_permits"],
  trades_generate_invoice:["trades_lookup_permits", "trades_estimate_job", "trades_check_code"],

  // ── SMB workflow ───────────────────────────────────────────────────────────
  smb_categorize_transaction: ["smb_prep_tax", "smb_check_licenses", "smb_dashboard"],
  smb_prep_tax:               ["smb_categorize_transaction", "smb_check_licenses", "smb_compare_insurance"],
  smb_check_licenses:         ["smb_compare_insurance", "smb_generate_contract", "smb_prep_tax"],
  smb_compare_insurance:      ["smb_generate_contract", "smb_check_licenses", "smb_prep_tax"],
  smb_generate_contract:      ["smb_check_licenses", "smb_compare_insurance", "smb_categorize_transaction"],

  // ── Commerce workflow ──────────────────────────────────────────────────────
  commerce_verify_product:    ["commerce_merchant_trust", "commerce_detect_manipulation", "commerce_create_purchase"],
  commerce_merchant_trust:    ["commerce_verify_product", "commerce_detect_manipulation", "commerce_create_purchase"],
  commerce_detect_manipulation:["commerce_verify_product", "commerce_merchant_trust", "commerce_create_purchase"],
  commerce_create_purchase:   ["commerce_track_purchase", "commerce_verify_product", "commerce_merchant_trust"],
  commerce_track_purchase:    ["commerce_verify_product", "commerce_merchant_trust", "commerce_create_purchase"],

  // ── Agent recovery workflow ────────────────────────────────────────────────
  recovery_check_health:        ["recovery_circuit_status", "recovery_start_trace", "recovery_detect_hallucination"],
  recovery_circuit_status:      ["recovery_check_health", "recovery_initiate_handoff", "recovery_start_trace"],
  recovery_initiate_handoff:    ["recovery_check_health", "recovery_start_trace", "recovery_circuit_status"],
  recovery_start_trace:         ["recovery_detect_hallucination", "recovery_check_health", "recovery_circuit_status"],
  recovery_detect_hallucination:["recovery_start_trace", "recovery_check_health", "recovery_circuit_status"],

  // ── DeFi workflow ──────────────────────────────────────────────────────────
  hiveagent_defi_swap:      ["hiveagent_defi_lend", "hiveagent_defi_yield", "hiveagent_defi_positions"],
  hiveagent_defi_lend:      ["hiveagent_defi_yield", "hiveagent_defi_swap", "hiveagent_defi_positions"],
  hiveagent_defi_yield:     ["hiveagent_defi_positions", "hiveagent_defi_lend", "hiveagent_defi_swap"],
  hiveagent_defi_positions: ["hiveagent_defi_swap", "hiveagent_defi_lend", "hiveagent_defi_yield"],

  // ── Trade / customs workflow ───────────────────────────────────────────────
  trade_classify_hs:          ["trade_screen_sanctions", "trade_calculate_duty", "trade_generate_customs_docs"],
  trade_screen_sanctions:     ["trade_classify_hs", "trade_calculate_duty", "trade_generate_customs_docs"],
  trade_calculate_duty:       ["trade_generate_customs_docs", "trade_check_export_controls", "trade_classify_hs"],
  trade_generate_customs_docs:["trade_check_export_controls", "trade_calculate_duty", "trade_screen_sanctions"],
  trade_check_export_controls:["trade_generate_customs_docs", "trade_screen_sanctions", "trade_calculate_duty"],

  // ── Travel workflow ────────────────────────────────────────────────────────
  travel_search_flights:       ["travel_book_flight", "travel_search_hotels", "travel_visa_requirements"],
  travel_book_flight:          ["travel_search_hotels", "travel_search_restaurants", "travel_build_itinerary"],
  travel_search_hotels:        ["travel_book_hotel", "travel_search_restaurants", "travel_build_itinerary"],
  travel_book_hotel:           ["travel_build_itinerary", "travel_search_restaurants", "travel_compare_car_rentals"],
  travel_search_restaurants:   ["travel_build_itinerary", "travel_book_hotel", "travel_compare_car_rentals"],
  travel_build_itinerary:      ["travel_search_flights", "travel_search_hotels", "travel_compare_car_rentals"],
  travel_visa_requirements:    ["travel_search_flights", "travel_book_flight", "travel_build_itinerary"],
  travel_compare_car_rentals:  ["travel_build_itinerary", "travel_book_hotel", "travel_search_restaurants"],

  // ── Procurement workflow ───────────────────────────────────────────────────
  procurement_discover_suppliers: ["procurement_create_rfq", "supply_assess_supplier_risk", "procurement_spend_analytics"],
  procurement_create_rfq:         ["procurement_evaluate_bids", "procurement_discover_suppliers", "procurement_spend_analytics"],
  procurement_evaluate_bids:      ["procurement_draft_contract", "procurement_create_rfq", "procurement_spend_analytics"],
  procurement_draft_contract:     ["procurement_match_invoice", "procurement_evaluate_bids", "procurement_spend_analytics"],
  procurement_match_invoice:      ["invoice_three_way_match", "procurement_spend_analytics", "invoice_route_approval"],
  procurement_spend_analytics:    ["procurement_discover_suppliers", "procurement_create_rfq", "invoice_ap_dashboard"],

  // ── Know Your Agent workflow ───────────────────────────────────────────────
  kya_verify_agent:          ["kya_classify_bot", "kya_check_delegation", "kya_behavior_score"],
  kya_classify_bot:          ["kya_verify_agent", "kya_check_delegation", "kya_report_suspicious"],
  kya_check_delegation:      ["kya_behavior_score", "kya_enforce_spending_limit", "kya_verify_agent"],
  kya_behavior_score:        ["kya_enforce_spending_limit", "kya_check_delegation", "kya_report_suspicious"],
  kya_enforce_spending_limit:["kya_behavior_score", "kya_verify_agent", "kya_report_suspicious"],
  kya_report_suspicious:     ["kya_verify_agent", "kya_behavior_score", "kya_classify_bot"],

  // ── Sales CRM workflow ─────────────────────────────────────────────────────
  sales_enrich_lead:        ["sales_score_lead", "sales_generate_outreach", "sales_track_competitors"],
  sales_score_lead:         ["sales_generate_outreach", "sales_schedule_meeting", "sales_forecast_pipeline"],
  sales_generate_outreach:  ["sales_schedule_meeting", "sales_score_lead", "sales_forecast_pipeline"],
  sales_schedule_meeting:   ["sales_forecast_pipeline", "sales_generate_outreach", "sales_enrich_lead"],
  sales_forecast_pipeline:  ["sales_enrich_lead", "sales_score_lead", "sales_track_competitors"],
  sales_track_competitors:  ["sales_enrich_lead", "sales_score_lead", "sales_generate_outreach"],

  // ── Invoice / AP workflow ──────────────────────────────────────────────────
  invoice_extract_data:      ["invoice_three_way_match", "invoice_detect_duplicate", "invoice_route_approval"],
  invoice_three_way_match:   ["invoice_detect_duplicate", "invoice_route_approval", "invoice_optimize_payment"],
  invoice_detect_duplicate:  ["invoice_route_approval", "invoice_three_way_match", "invoice_ap_dashboard"],
  invoice_route_approval:    ["invoice_optimize_payment", "invoice_detect_duplicate", "invoice_ap_dashboard"],
  invoice_optimize_payment:  ["invoice_ap_dashboard", "invoice_route_approval", "procurement_spend_analytics"],
  invoice_ap_dashboard:      ["invoice_extract_data", "invoice_optimize_payment", "procurement_spend_analytics"],

  // ── Fraud Detection workflow ───────────────────────────────────────────────
  fraud_screen_transaction:  ["fraud_detect_anomalies", "fraud_check_identity", "fraud_predict_chargeback"],
  fraud_detect_anomalies:    ["fraud_check_identity", "fraud_predict_chargeback", "fraud_analyze_network"],
  fraud_check_identity:      ["fraud_predict_chargeback", "fraud_analyze_network", "fraud_dashboard"],
  fraud_predict_chargeback:  ["fraud_analyze_network", "fraud_screen_transaction", "fraud_dashboard"],
  fraud_analyze_network:     ["fraud_dashboard", "fraud_screen_transaction", "fraud_check_identity"],
  fraud_dashboard:           ["fraud_screen_transaction", "fraud_detect_anomalies", "fraud_analyze_network"],

  // ── Real Estate workflow ───────────────────────────────────────────────────
  realestate_search_properties:  ["realestate_get_comps", "realestate_calculate_mortgage", "realestate_neighborhood_stats"],
  realestate_get_comps:          ["realestate_calculate_mortgage", "realestate_check_title", "realestate_estimate_value"],
  realestate_calculate_mortgage: ["realestate_check_title", "realestate_estimate_value", "realestate_neighborhood_stats"],
  realestate_check_title:        ["realestate_estimate_value", "realestate_neighborhood_stats", "realestate_calculate_mortgage"],
  realestate_estimate_value:     ["realestate_neighborhood_stats", "realestate_get_comps", "realestate_check_title"],
  realestate_neighborhood_stats: ["realestate_search_properties", "realestate_estimate_value", "realestate_get_comps"],

  // ── Supply Chain workflow ──────────────────────────────────────────────────
  supply_forecast_demand:      ["supply_optimize_inventory", "supply_compare_freight", "supply_dashboard"],
  supply_optimize_inventory:   ["supply_track_shipment", "supply_forecast_demand", "supply_assess_supplier_risk"],
  supply_track_shipment:       ["supply_compare_freight", "supply_assess_supplier_risk", "supply_dashboard"],
  supply_compare_freight:      ["supply_track_shipment", "supply_optimize_inventory", "supply_dashboard"],
  supply_assess_supplier_risk: ["procurement_discover_suppliers", "supply_dashboard", "supply_compare_freight"],
  supply_dashboard:            ["supply_forecast_demand", "supply_optimize_inventory", "supply_track_shipment"],

  // ── Dynamic Pricing workflow ───────────────────────────────────────────────
  pricing_monitor_competitors: ["pricing_calculate_optimal", "pricing_simulate_change", "pricing_dashboard"],
  pricing_calculate_optimal:   ["pricing_simulate_change", "pricing_generate_promo", "pricing_dashboard"],
  pricing_simulate_change:     ["pricing_generate_promo", "pricing_calculate_optimal", "pricing_dashboard"],
  pricing_generate_promo:      ["pricing_dashboard", "pricing_monitor_competitors", "pricing_simulate_change"],
  pricing_dashboard:           ["pricing_monitor_competitors", "pricing_calculate_optimal", "pricing_generate_promo"],

  // ── HR / Recruiting workflow ───────────────────────────────────────────────
  hr_screen_resume:          ["hr_match_candidates", "hr_interview_questions", "hr_check_compensation"],
  hr_match_candidates:       ["hr_interview_questions", "hr_check_compensation", "hr_recruiting_dashboard"],
  hr_interview_questions:    ["hr_check_compensation", "hr_automate_onboarding", "hr_recruiting_dashboard"],
  hr_check_compensation:     ["hr_automate_onboarding", "hr_interview_questions", "hr_recruiting_dashboard"],
  hr_automate_onboarding:    ["hr_recruiting_dashboard", "hr_check_compensation", "hr_match_candidates"],
  hr_recruiting_dashboard:   ["hr_screen_resume", "hr_match_candidates", "hr_check_compensation"],

  // ── Composite workflow tools ───────────────────────────────────────────────
  workflow_full_insurance_claim: ["insurance_claims_analytics", "insurance_compare_policies", "hiveagent_discover"],
  workflow_construction_project: ["construction_permit_status", "construction_draw_schedule", "hiveagent_discover"],
  workflow_legal_case_setup:     ["legal_search_case_law", "legal_track_deadlines", "hiveagent_discover"],
  workflow_healthcare_encounter: ["health_compliance", "health_interpret_labs", "hiveagent_discover"],
  workflow_small_business_setup: ["smb_categorize_transaction", "smb_dashboard", "hiveagent_discover"],
  workflow_trades_job:           ["trades_generate_invoice", "trades_lookup_permits", "hiveagent_discover"],
  workflow_international_shipment:["trade_screen_sanctions", "trade_classify_hs", "hiveagent_discover"],
  workflow_agent_monitoring:     ["recovery_check_health", "recovery_start_trace", "hiveagent_discover"],
  workflow_commerce_transaction: ["commerce_track_purchase", "commerce_verify_product", "hiveagent_discover"],
  workflow_crop_season:          ["ag_forecast_yield", "ag_commodity_alerts", "hiveagent_discover"],

  // Phase 6 composite workflows
  workflow_book_full_trip:        ["travel_book_flight", "travel_book_hotel", "hiveagent_discover"],
  workflow_procurement_cycle:     ["invoice_three_way_match", "procurement_spend_analytics", "hiveagent_discover"],
  workflow_full_sales_cycle:      ["sales_forecast_pipeline", "sales_track_competitors", "hiveagent_discover"],
  workflow_screen_and_hire:       ["hr_recruiting_dashboard", "hr_check_compensation", "hiveagent_discover"],
  workflow_full_fraud_check:      ["fraud_dashboard", "fraud_analyze_network", "hiveagent_discover"],

  // ── Platform Audit workflow (Phase 7) ─────────────────────────────────────
  platform_health_check:         ["platform_audit_descriptions", "platform_measure_performance", "platform_audit_dashboard"],
  platform_audit_descriptions:   ["platform_measure_performance", "platform_check_freshness",    "platform_audit_dashboard"],
  platform_measure_performance:  ["platform_check_freshness",    "platform_audit_dashboard",     "platform_audit_report"],
  platform_check_freshness:      ["platform_audit_dashboard",    "platform_audit_report",         "platform_refresh_data"],
  platform_audit_dashboard:      ["platform_audit_report",       "platform_health_check",         "platform_check_freshness"],
  platform_audit_report:         ["platform_health_check",       "platform_audit_dashboard",      "platform_crawler_dashboard"],

  // ── Platform Crawler workflow (Phase 7) ───────────────────────────────────
  platform_crawl_market:         ["platform_monitor_competitors", "platform_check_regulations", "platform_update_prices"],
  platform_monitor_competitors:  ["platform_check_regulations",  "platform_update_prices",       "platform_refresh_data"],
  platform_check_regulations:    ["platform_update_prices",       "platform_refresh_data",        "platform_crawler_dashboard"],
  platform_update_prices:        ["platform_refresh_data",        "platform_crawler_dashboard",   "platform_crawl_market"],
  platform_refresh_data:         ["platform_crawler_dashboard",   "platform_health_check",        "platform_check_freshness"],
  platform_crawler_dashboard:    ["platform_crawl_market",        "platform_monitor_competitors", "platform_check_regulations"],
};

// ─── Contextual Tips ──────────────────────────────────────────────────────────

const TIPS = {
  // Insurance
  insurance_claim_intake:
    "Tip: Call insurance_assess_damage next to get an AI damage estimate, or insurance_compare_policies to find better coverage.",
  insurance_assess_damage:
    "Tip: Run insurance_check_subrogation to see if a third party is liable, then generate your adjuster report.",
  insurance_compare_policies:
    "Tip: Use insurance_claim_intake to file a claim under your best-matched policy.",
  insurance_check_subrogation:
    "Tip: If subrogation applies, generate the full adjuster report with insurance_adjuster_report.",
  insurance_adjuster_report:
    "Tip: Pull portfolio trends with insurance_claims_analytics to benchmark this claim against similar cases.",
  insurance_claims_analytics:
    "Tip: Use the insights here to improve future intake with insurance_claim_intake or refine policies with insurance_compare_policies.",

  // Construction
  construction_lookup_zoning:
    "Tip: Now check permit requirements with construction_permit_status, or estimate materials with construction_material_takeoff.",
  construction_permit_status:
    "Tip: With permits in hand, estimate materials with construction_material_takeoff or find subs with construction_match_subcontractor.",
  construction_material_takeoff:
    "Tip: Match a qualified subcontractor with construction_match_subcontractor, then build your draw schedule.",
  construction_match_subcontractor:
    "Tip: Generate a lender-ready draw schedule with construction_draw_schedule to lock in your financing milestones.",
  construction_draw_schedule:
    "Tip: All set — kick off the job! Use construction_permit_status to track permit approvals in real time.",

  // Legal
  legal_intake_case:
    "Tip: Summarize medical records with legal_summarize_records or pull relevant precedents with legal_search_case_law.",
  legal_summarize_records:
    "Tip: Draft a demand letter with legal_demand_letter now that records are summarized.",
  legal_demand_letter:
    "Tip: Track all filing deadlines with legal_track_deadlines so nothing slips.",
  legal_track_deadlines:
    "Tip: Research supporting precedents with legal_search_case_law to strengthen your arguments.",
  legal_search_case_law:
    "Tip: Use the case law to bolster your demand letter — call legal_demand_letter with the new citations.",

  // Healthcare
  health_prior_auth:
    "Tip: Generate the clinical note with health_clinical_note and then code the claim with health_claim_codes.",
  health_clinical_note:
    "Tip: Translate your note into billing codes with health_claim_codes, then verify compliance with health_compliance.",
  health_claim_codes:
    "Tip: Run health_compliance to catch any HIPAA or billing issues before submission.",
  health_interpret_labs:
    "Tip: Add lab findings to your clinical note with health_clinical_note, then code for billing.",
  health_compliance:
    "Tip: All clear on compliance — proceed to health_prior_auth or submit your coded claim.",

  // Trades
  trades_lookup_permits:
    "Tip: Estimate the full job cost with trades_estimate_job, then verify code compliance with trades_check_code.",
  trades_estimate_job:
    "Tip: Source the exact parts with trades_find_parts, then generate a customer invoice with trades_generate_invoice.",
  trades_find_parts:
    "Tip: Double-check code compliance with trades_check_code before ordering, then invoice with trades_generate_invoice.",
  trades_check_code:
    "Tip: All compliant — generate a professional invoice with trades_generate_invoice.",
  trades_generate_invoice:
    "Tip: Invoice sent! Pull your next job permit with trades_lookup_permits to keep the pipeline moving.",

  // SMB
  smb_categorize_transaction:
    "Tip: Feed categorized transactions into smb_prep_tax for a head start on tax season.",
  smb_prep_tax:
    "Tip: Make sure your licenses are current with smb_check_licenses before filing.",
  smb_check_licenses:
    "Tip: Compare business insurance plans with smb_compare_insurance to ensure adequate coverage.",
  smb_compare_insurance:
    "Tip: Lock in your vendor and client relationships with smb_generate_contract.",
  smb_generate_contract:
    "Tip: Monitor business health end-to-end with smb_dashboard.",

  // Commerce
  commerce_verify_product:
    "Tip: Check the seller's reputation with commerce_merchant_trust before committing to a purchase.",
  commerce_merchant_trust:
    "Tip: Scan for dark patterns with commerce_detect_manipulation, then create a purchase order if all looks good.",
  commerce_detect_manipulation:
    "Tip: If the listing is clean, place the order with commerce_create_purchase.",
  commerce_create_purchase:
    "Tip: Track your order in real time with commerce_track_purchase.",
  commerce_track_purchase:
    "Tip: Order tracking active — verify the next product with commerce_verify_product for your next purchase.",

  // Agent recovery
  recovery_check_health:
    "Tip: Check circuit-breaker state with recovery_circuit_status, then start a trace with recovery_start_trace.",
  recovery_circuit_status:
    "Tip: If the circuit is open, initiate a graceful handoff with recovery_initiate_handoff.",
  recovery_initiate_handoff:
    "Tip: Start a trace with recovery_start_trace to capture the full handoff context.",
  recovery_start_trace:
    "Tip: Attach hallucination detection with recovery_detect_hallucination to validate agent outputs.",
  recovery_detect_hallucination:
    "Tip: Review your full health dashboard with recovery_check_health for a complete system picture.",

  // DeFi
  hiveagent_defi_swap:
    "Tip: Put your new tokens to work — deposit into a yield pool with hiveagent_defi_yield or open a lending position.",
  hiveagent_defi_lend:
    "Tip: Check your live positions with hiveagent_defi_positions to monitor health factors.",
  hiveagent_defi_yield:
    "Tip: View all positions in one place with hiveagent_defi_positions.",
  hiveagent_defi_positions:
    "Tip: Rebalance by swapping with hiveagent_defi_swap or adjusting your yield allocation.",

  // Trade / customs
  trade_classify_hs:
    "Tip: Screen the counterparty with trade_screen_sanctions, then calculate import duties with trade_calculate_duty.",
  trade_screen_sanctions:
    "Tip: Sanctions check passed — calculate the duty with trade_calculate_duty.",
  trade_calculate_duty:
    "Tip: Generate the full customs documentation package with trade_generate_customs_docs.",
  trade_generate_customs_docs:
    "Tip: Run trade_check_export_controls to ensure no export license is required before shipping.",
  trade_check_export_controls:
    "Tip: All export checks complete — your shipment package is ready to go.",

  // Travel
  travel_search_flights:
    "Tip: Found your flights — check visa requirements with travel_visa_requirements, then search hotels with travel_search_hotels.",
  travel_book_flight:
    "Tip: Flight booked! Find a great hotel with travel_search_hotels, then build a full itinerary with travel_build_itinerary.",
  travel_search_hotels:
    "Tip: Found hotels — book your top pick with travel_book_hotel, then discover dining options with travel_search_restaurants.",
  travel_book_hotel:
    "Tip: Hotel secured! Build a day-by-day itinerary with travel_build_itinerary or compare car rental options with travel_compare_car_rentals.",
  travel_search_restaurants:
    "Tip: Great dining options found — weave them into a full itinerary with travel_build_itinerary.",
  travel_build_itinerary:
    "Tip: Itinerary ready! Lock in flights with travel_search_flights or add a car rental with travel_compare_car_rentals.",
  travel_visa_requirements:
    "Tip: Visa requirements confirmed — now search and book your flights with travel_search_flights.",
  travel_compare_car_rentals:
    "Tip: Car rental sorted! Complete your trip plan with travel_build_itinerary or book your hotel with travel_book_hotel.",

  // Procurement
  procurement_discover_suppliers:
    "Tip: Suppliers discovered — send them an RFQ with procurement_create_rfq, or assess their risk with supply_assess_supplier_risk.",
  procurement_create_rfq:
    "Tip: RFQ sent! When bids come in, score them objectively with procurement_evaluate_bids.",
  procurement_evaluate_bids:
    "Tip: Bids ranked — generate a contract for the winner with procurement_draft_contract.",
  procurement_draft_contract:
    "Tip: Contract ready! Once signed and goods are delivered, validate the invoice with procurement_match_invoice.",
  procurement_match_invoice:
    "Tip: Invoice matched — run a three-way check with invoice_three_way_match to complete your AP process.",
  procurement_spend_analytics:
    "Tip: Insights in hand — discover new suppliers to fill gaps with procurement_discover_suppliers.",

  // Know Your Agent
  kya_verify_agent:
    "Tip: Agent verified — check their delegation scope with kya_check_delegation before approving any action.",
  kya_classify_bot:
    "Tip: Classification complete — verify the agent's credentials with kya_verify_agent for a full trust picture.",
  kya_check_delegation:
    "Tip: Delegation confirmed — enforce the spending ceiling in real time with kya_enforce_spending_limit.",
  kya_behavior_score:
    "Tip: Score received — if the risk is elevated, enforce a spend limit with kya_enforce_spending_limit or file a report with kya_report_suspicious.",
  kya_enforce_spending_limit:
    "Tip: Limit enforced — review the agent's full behavior history with kya_behavior_score to decide on long-term trust.",
  kya_report_suspicious:
    "Tip: Report filed — run kya_verify_agent on any related agents to check for coordinated misbehavior.",

  // Sales CRM
  sales_enrich_lead:
    "Tip: Lead enriched — score them against your ICP with sales_score_lead to prioritize your outreach.",
  sales_score_lead:
    "Tip: Lead scored — generate a personalized outreach sequence with sales_generate_outreach.",
  sales_generate_outreach:
    "Tip: Outreach ready! Book the discovery call with sales_schedule_meeting while the message is fresh.",
  sales_schedule_meeting:
    "Tip: Meeting booked! Update your pipeline forecast with sales_forecast_pipeline to reflect the new opportunity.",
  sales_forecast_pipeline:
    "Tip: Forecast updated — enrich your next batch of leads with sales_enrich_lead to keep the top of funnel full.",
  sales_track_competitors:
    "Tip: Competitor feed live — use the insights to sharpen your outreach with sales_generate_outreach.",

  // Invoice / AP
  invoice_extract_data:
    "Tip: Invoice extracted — run a duplicate check with invoice_detect_duplicate before routing for approval.",
  invoice_three_way_match:
    "Tip: Three-way match done — route the approved invoice for payment with invoice_route_approval.",
  invoice_detect_duplicate:
    "Tip: No duplicate found — proceed to route for approval with invoice_route_approval.",
  invoice_route_approval:
    "Tip: Approval chain triggered — optimize the payment timing with invoice_optimize_payment to capture early-pay discounts.",
  invoice_optimize_payment:
    "Tip: Payment schedule optimized — view your full AP health with invoice_ap_dashboard.",
  invoice_ap_dashboard:
    "Tip: AP overview ready — extract and process your next batch of invoices with invoice_extract_data.",

  // Fraud Detection
  fraud_screen_transaction:
    "Tip: Transaction screened — if flagged, run anomaly detection with fraud_detect_anomalies for a deeper investigation.",
  fraud_detect_anomalies:
    "Tip: Anomalies identified — verify the account holder's identity with fraud_check_identity.",
  fraud_check_identity:
    "Tip: Identity verified — predict chargeback risk on any flagged transactions with fraud_predict_chargeback.",
  fraud_predict_chargeback:
    "Tip: Chargeback risk assessed — map connected entities with fraud_analyze_network to detect organized fraud rings.",
  fraud_analyze_network:
    "Tip: Network analysis complete — monitor platform-wide fraud trends with fraud_dashboard.",
  fraud_dashboard:
    "Tip: Dashboard reviewed — screen your next high-risk transaction in real time with fraud_screen_transaction.",

  // Real Estate
  realestate_search_properties:
    "Tip: Properties found — validate pricing with realestate_get_comps and check the neighborhood with realestate_neighborhood_stats.",
  realestate_get_comps:
    "Tip: Comps in hand — calculate mortgage affordability with realestate_calculate_mortgage.",
  realestate_calculate_mortgage:
    "Tip: Payment estimated — verify the title is clear with realestate_check_title before moving forward.",
  realestate_check_title:
    "Tip: Title checked — get an independent AVM with realestate_estimate_value to confirm fair value.",
  realestate_estimate_value:
    "Tip: Value estimated — explore the area's livability with realestate_neighborhood_stats.",
  realestate_neighborhood_stats:
    "Tip: Neighborhood profiled — search for available properties with realestate_search_properties.",

  // Supply Chain
  supply_forecast_demand:
    "Tip: Demand forecasted — optimize stock levels across your catalog with supply_optimize_inventory.",
  supply_optimize_inventory:
    "Tip: Inventory optimized — track your inbound shipments in real time with supply_track_shipment.",
  supply_track_shipment:
    "Tip: Shipment located — compare freight carriers for your next order with supply_compare_freight.",
  supply_compare_freight:
    "Tip: Best carrier selected — assess your top supplier's risk with supply_assess_supplier_risk.",
  supply_assess_supplier_risk:
    "Tip: Risk assessed — discover backup suppliers with procurement_discover_suppliers to reduce single-source exposure.",
  supply_dashboard:
    "Tip: Ops health reviewed — re-run demand forecasting with supply_forecast_demand to keep plans current.",

  // Dynamic Pricing
  pricing_monitor_competitors:
    "Tip: Competitor prices captured — calculate your optimal price with pricing_calculate_optimal.",
  pricing_calculate_optimal:
    "Tip: Optimal price found — simulate the impact before going live with pricing_simulate_change.",
  pricing_simulate_change:
    "Tip: Impact modeled — if the numbers look good, launch a promotion with pricing_generate_promo.",
  pricing_generate_promo:
    "Tip: Promo pricing ready — track its performance and market impact with pricing_dashboard.",
  pricing_dashboard:
    "Tip: Pricing overview complete — monitor competitor moves in real time with pricing_monitor_competitors.",

  // HR / Recruiting
  hr_screen_resume:
    "Tip: Resume screened — match this candidate against your full pool with hr_match_candidates.",
  hr_match_candidates:
    "Tip: Candidates ranked — generate tailored interview questions for your top picks with hr_interview_questions.",
  hr_interview_questions:
    "Tip: Interview guide ready — benchmark the compensation package with hr_check_compensation before making an offer.",
  hr_check_compensation:
    "Tip: Market data in hand — once your offer is accepted, kick off onboarding with hr_automate_onboarding.",
  hr_automate_onboarding:
    "Tip: Onboarding launched! Monitor pipeline health and time-to-fill with hr_recruiting_dashboard.",
  hr_recruiting_dashboard:
    "Tip: Metrics reviewed — start screening new applicants with hr_screen_resume to keep the pipeline full.",

  // Composite workflows
  workflow_full_insurance_claim:
    "Tip: Full claim package generated — pull portfolio trends with insurance_claims_analytics.",
  workflow_construction_project:
    "Tip: Project fully set up — monitor permit approvals in real time with construction_permit_status.",
  workflow_legal_case_setup:
    "Tip: Case file ready — track deadlines with legal_track_deadlines and research with legal_search_case_law.",
  workflow_healthcare_encounter:
    "Tip: Encounter documented and coded — run health_compliance before submitting the claim.",
  workflow_small_business_setup:
    "Tip: Business configured — monitor financials with smb_dashboard.",
  workflow_trades_job:
    "Tip: Job package complete — track permit approvals with trades_lookup_permits.",
  workflow_international_shipment:
    "Tip: Shipping package ready — double-check sanctions with trade_screen_sanctions before dispatch.",
  workflow_agent_monitoring:
    "Tip: Monitoring active — check health in real time with recovery_check_health.",
  workflow_commerce_transaction:
    "Tip: Purchase order created — track delivery with commerce_track_purchase.",
  workflow_crop_season:
    "Tip: Season plan ready — set commodity price alerts with ag_commodity_alerts.",

  // New composite workflows (Phase 6)
  workflow_book_full_trip:
    "Tip: Travel package ready — book your flights with travel_book_flight and hotel with travel_book_hotel to lock in prices.",
  workflow_procurement_cycle:
    "Tip: Procurement cycle complete — run invoice_three_way_match when the supplier invoice arrives.",
  workflow_full_sales_cycle:
    "Tip: Sales cycle initiated — monitor engagement and update deal stages with sales_forecast_pipeline.",
  workflow_screen_and_hire:
    "Tip: Hiring pipeline ready — send interview guides to your panel and track progress with hr_recruiting_dashboard.",
  workflow_full_fraud_check:
    "Tip: Fraud assessment complete — monitor platform-wide trends with fraud_dashboard.",

  // Platform Audit tools (Phase 7)
  platform_health_check:
    "Tip: Health check complete — run platform_audit_descriptions next to find description quality issues across your tool catalog.",
  platform_audit_descriptions:
    "Tip: Description audit done — benchmark specific low-quality tools with platform_measure_performance to find performance issues too.",
  platform_measure_performance:
    "Tip: Performance data captured — check data freshness with platform_check_freshness to get a complete platform quality picture.",
  platform_check_freshness:
    "Tip: Freshness report ready — view the full health overview with platform_audit_dashboard or trigger a refresh with platform_refresh_data.",
  platform_audit_dashboard:
    "Tip: Dashboard loaded — generate a shareable executive report with platform_audit_report for stakeholders.",
  platform_audit_report:
    "Tip: Audit report generated — schedule your next health check with platform_health_check and review crawler status with platform_crawler_dashboard.",

  // Platform Crawler tools (Phase 7)
  platform_crawl_market:
    "Tip: Market intelligence gathered — check platform_monitor_competitors to see if any high-threat servers added new tools this week.",
  platform_monitor_competitors:
    "Tip: Competitor tracking updated — run platform_check_regulations to ensure HiveAgent's tools stay compliant with new rules.",
  platform_check_regulations:
    "Tip: Regulatory scan complete — update pricing with platform_update_prices to stay competitive against market benchmarks.",
  platform_update_prices:
    "Tip: Pricing benchmarks refreshed — run platform_refresh_data for any vertical that has stale seed data.",
  platform_refresh_data:
    "Tip: Seed data refreshed — view the crawler dashboard with platform_crawler_dashboard for a full freshness and threat overview.",
  platform_crawler_dashboard:
    "Tip: Crawler dashboard loaded — kick off a new market intelligence crawl with platform_crawl_market to catch the latest MCP ecosystem changes.",
};

// ─── Fallback suggestions ─────────────────────────────────────────────────────

const DEFAULT_NEXT_TOOLS = ["hiveagent_discover", "hiveagent_vertical_guide"];
const DEFAULT_TIP =
  "Tip: Not sure what to do next? Call hiveagent_discover with a description of your goal to find the right tool.";

// ─── Core export ──────────────────────────────────────────────────────────────

/**
 * Wraps a raw tool result with next-step guidance, attribution, and a tip.
 *
 * @param {string} toolName  - The name of the tool that produced the result.
 * @param {*}      result    - The raw value returned by the tool handler.
 * @returns {object}         - Enhanced response object ready to serialise.
 */
export function enhanceResponse(toolName, result) {
  const suggested = NEXT_TOOL_MAP[toolName] ?? DEFAULT_NEXT_TOOLS;
  const tip       = TIPS[toolName]          ?? DEFAULT_TIP;

  return {
    result,
    suggested_next_tools: suggested,
    powered_by: "HiveAgent — hiveagentiq.com/mcp",
    tip,
  };
}
