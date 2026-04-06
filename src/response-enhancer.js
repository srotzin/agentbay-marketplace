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
