/**
 * HiveAgent MCP Tool Definitions — Composite Workflow Tools
 *
 * Each tool here abstracts an entire multi-step workflow into a single MCP call.
 * Instead of chaining 5-10 individual tools, agents call ONE tool and receive a
 * complete, aggregated result. Perfect for production pipelines where reliability
 * and speed matter more than step-by-step control.
 *
 * 10 composite workflow tools:
 *   1.  workflow_full_insurance_claim
 *   2.  workflow_construction_project
 *   3.  workflow_legal_case_setup
 *   4.  workflow_healthcare_encounter
 *   5.  workflow_small_business_setup
 *   6.  workflow_trades_job
 *   7.  workflow_international_shipment
 *   8.  workflow_agent_monitoring
 *   9.  workflow_commerce_transaction
 *   10. workflow_crop_season
 */

import {
  processFullInsuranceClaim,
  fileConstructionProject,
  runLegalCaseSetup,
  processHealthcareEncounter,
  setupSmallBusiness,
  executeTradesJob,
  processInternationalShipment,
  deployAgentMonitoring,
  runCommerceTransaction,
  assessCropSeason,
  bookFullTrip,
  runProcurementCycle,
  processFullSalesCycle,
  screenAndHire,
  fullFraudCheck,
} from "./services/workflows.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const workflowTools = [

  // ─────────────────────────────────────────────────────────────────────────
  // 1. FULL INSURANCE CLAIM
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_insurance_claim",
    description:
      "Use when you need to process an insurance claim from start to finish in a SINGLE CALL. " +
      "Replaces: insurance_claim_intake + insurance_assess_damage + insurance_check_subrogation + insurance_adjuster_report " +
      "(4 separate tool calls → 1). Returns a complete claim package including intake record, damage estimate, " +
      "subrogation analysis, and a ready-to-submit adjuster report.",
    inputSchema: {
      type: "object",
      properties: {
        claim_type: {
          type: "string",
          enum: ["auto", "property", "liability", "health", "workers_comp"],
          description: "Type of insurance claim being filed.",
        },
        policy_number: {
          type: "string",
          description: "Policyholder's policy number.",
        },
        incident_details: {
          type: "object",
          description: "Free-form object describing the incident — include date, location, description, damage_type.",
          properties: {
            date:         { type: "string", description: "Incident date (ISO 8601)" },
            location:     { type: "string", description: "Where the incident occurred" },
            description:  { type: "string", description: "Narrative description of what happened" },
            damage_type:  { type: "string", description: "Primary damage type (e.g. 'collision', 'water', 'fire')" },
          },
        },
        evidence: {
          type: "array",
          items: { type: "string" },
          description: "List of evidence items or photo descriptors (e.g. ['photo_front_bumper', 'police_report_123']).",
          default: [],
        },
      },
      required: ["claim_type", "policy_number"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CONSTRUCTION PROJECT SETUP
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_construction_project",
    description:
      "Use when you need to set up a new construction project end-to-end in a SINGLE CALL. " +
      "Replaces: construction_lookup_zoning + construction_permit_status + construction_material_takeoff + " +
      "construction_match_subcontractor + construction_draw_schedule (5 tool calls → 1). " +
      "Returns zoning analysis, permit status, full materials takeoff, matched subcontractors, and a lender-ready draw schedule.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Full street address of the project site.",
        },
        municipality: {
          type: "string",
          description: "City or county name for permit and zoning lookups.",
        },
        project_type: {
          type: "string",
          description: "Type of construction project (e.g. 'residential', 'commercial', 'addition', 'ADU').",
          default: "residential",
        },
        sqft: {
          type: "number",
          description: "Total project square footage.",
          default: 1000,
        },
      },
      required: ["address", "municipality"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LEGAL CASE SETUP
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_legal_case_setup",
    description:
      "Use when you need to open a new legal matter and prepare the full case file in a SINGLE CALL. " +
      "Replaces: legal_intake_case + legal_summarize_records + legal_track_deadlines + legal_search_case_law " +
      "(4 tool calls → 1). Returns complete intake record, medical records summary (if provided), " +
      "all filing deadlines, and relevant case law citations.",
    inputSchema: {
      type: "object",
      properties: {
        practice_area: {
          type: "string",
          description: "Area of law (e.g. 'personal_injury', 'contract', 'employment', 'immigration', 'family').",
          default: "personal_injury",
        },
        client_info: {
          type: "object",
          description: "Client details object — include name, state, contact, and any relevant background.",
          properties: {
            name:    { type: "string" },
            state:   { type: "string", description: "US state abbreviation for jurisdiction" },
            contact: { type: "string" },
          },
        },
        case_description: {
          type: "string",
          description: "Narrative description of the case facts.",
        },
        medical_records_pages: {
          type: "number",
          description: "Total number of pages of medical records to summarize. Pass 0 to skip.",
          default: 0,
        },
      },
      required: ["practice_area", "case_description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. HEALTHCARE ENCOUNTER
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_healthcare_encounter",
    description:
      "Use when you need to document a healthcare encounter and prepare it for billing in a SINGLE CALL. " +
      "Replaces: health_prior_auth + health_clinical_note + health_claim_codes + health_compliance " +
      "(4 tool calls → 1). Returns prior auth status, structured SOAP note, ICD-10/CPT billing codes, " +
      "and HIPAA compliance confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_type: {
          type: "string",
          description: "Type of encounter (e.g. 'office_visit', 'telehealth', 'procedure', 'emergency').",
          default: "office_visit",
        },
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: "List of patient-reported symptoms.",
          default: [],
        },
        findings: {
          type: "object",
          description: "Clinical findings object — include diagnosis, assessment, plan.",
          properties: {
            diagnosis:   { type: "string" },
            assessment:  { type: "string" },
            plan:        { type: "string" },
          },
        },
        insurance_provider: {
          type: "string",
          description: "Name of the patient's insurance carrier (e.g. 'BlueCross', 'Aetna', 'Medicare').",
        },
        procedure_code: {
          type: "string",
          description: "CPT code for the procedure requiring prior authorization.",
        },
      },
      required: ["encounter_type", "insurance_provider"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SMALL BUSINESS SETUP
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_small_business_setup",
    description:
      "Use when you need to set up a new small business — licensing, insurance, contracts, and tax prep — in a SINGLE CALL. " +
      "Replaces: smb_check_licenses + smb_compare_insurance + smb_generate_contract + smb_prep_tax + smb_dashboard " +
      "(5 tool calls → 1). Returns a complete business setup guide with all required licenses, insurance options, " +
      "a service agreement template, tax prep checklist, and a live dashboard link.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          description: "Legal entity or business type (e.g. 'LLC', 'sole_proprietor', 'S-Corp', 'restaurant', 'retail').",
          default: "LLC",
        },
        state: {
          type: "string",
          description: "Two-letter US state abbreviation where the business is registered.",
          default: "CA",
        },
        city: {
          type: "string",
          description: "City where the business operates (used for local license lookups).",
          default: "",
        },
      },
      required: ["business_type", "state"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. TRADES JOB
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_trades_job",
    description:
      "Use when you need to prepare a complete trades job package — permits, estimate, parts, code check, and invoice — in a SINGLE CALL. " +
      "Replaces: trades_lookup_permits + trades_estimate_job + trades_find_parts + trades_check_code + trades_generate_invoice " +
      "(5 tool calls → 1). Returns permit requirements, itemised job estimate, parts sourcing results, " +
      "code compliance status, and a professional customer invoice.",
    inputSchema: {
      type: "object",
      properties: {
        trade_type: {
          type: "string",
          description: "Trade specialty (e.g. 'electrical', 'plumbing', 'HVAC', 'roofing', 'general').",
          default: "general",
        },
        municipality: {
          type: "string",
          description: "City or county for permit lookups.",
        },
        job_description: {
          type: "string",
          description: "Plain-language description of the work to be performed.",
        },
        location: {
          type: "string",
          description: "Physical job site location (city, state).",
        },
      },
      required: ["trade_type", "job_description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. INTERNATIONAL SHIPMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_international_shipment",
    description:
      "Use when you need to clear an international shipment through full trade compliance in a SINGLE CALL. " +
      "Replaces: trade_classify_hs + trade_screen_sanctions + trade_calculate_duty + trade_generate_customs_docs + trade_check_export_controls " +
      "(5 tool calls → 1). Returns HS classification, sanctions screening result, landed duty cost, " +
      "a complete customs documentation package, and export control determination.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Product description as it would appear on a commercial invoice.",
        },
        origin_country: {
          type: "string",
          description: "Two-letter ISO country code of the shipment origin (e.g. 'US', 'CN', 'DE').",
          default: "US",
        },
        dest_country: {
          type: "string",
          description: "Two-letter ISO country code of the destination country.",
          default: "GB",
        },
        value: {
          type: "number",
          description: "Declared shipment value in USD.",
          default: 0,
        },
      },
      required: ["product", "dest_country"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. AGENT MONITORING
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_agent_monitoring",
    description:
      "Use when you need to deploy a full monitoring stack for a multi-agent workflow in a SINGLE CALL. " +
      "Replaces: recovery_check_health (×N) + recovery_circuit_status + recovery_initiate_handoff + recovery_start_trace " +
      "(5-8 tool calls → 1). Registers all agent endpoints, runs initial health checks, creates a handoff protocol, " +
      "and starts a distributed trace. Returns a complete monitoring setup ready for production.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint_urls: {
          type: "array",
          items: { type: "string" },
          description: "List of agent HTTP endpoint URLs to register and monitor.",
          default: [],
        },
        workflow_id: {
          type: "string",
          description: "Unique identifier for the workflow being monitored. Auto-generated if omitted.",
        },
      },
      required: ["endpoint_urls"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. COMMERCE TRANSACTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_commerce_transaction",
    description:
      "Use when you need to execute a safe, verified commerce purchase in a SINGLE CALL. " +
      "Replaces: commerce_verify_product + commerce_merchant_trust + commerce_detect_manipulation + commerce_create_purchase + risk_assessment " +
      "(5 tool calls → 1). Verifies product authenticity, checks merchant reputation, scans for dark patterns, " +
      "creates the purchase order, and returns a safety signal (SAFE_TO_PROCEED or REVIEW_REQUIRED).",
    inputSchema: {
      type: "object",
      properties: {
        product_url: {
          type: "string",
          description: "URL of the product listing to purchase.",
        },
        merchant_domain: {
          type: "string",
          description: "Merchant's primary domain for trust scoring (e.g. 'shop.acme.com').",
        },
        items: {
          type: "array",
          description: "Items to purchase.",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              quantity:   { type: "number" },
              price_usd:  { type: "number" },
            },
          },
          default: [],
        },
        shipping_address: {
          type: "object",
          description: "Shipping destination address.",
          properties: {
            street:  { type: "string" },
            city:    { type: "string" },
            state:   { type: "string" },
            zip:     { type: "string" },
            country: { type: "string" },
          },
        },
      },
      required: ["product_url", "merchant_domain"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. CROP SEASON ASSESSMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_crop_season",
    description:
      "Use when you need a complete crop season plan — issues, yield, prices, soil, and compliance — in a SINGLE CALL. " +
      "Replaces: ag_identify_crop_issue + ag_forecast_yield + ag_commodity_alerts + ag_analyze_soil + ag_check_compliance " +
      "(5 tool calls → 1). Returns crop issue diagnostics, yield forecast, commodity price alerts, " +
      "soil amendment recommendations, and a regulatory compliance checklist for the full growing season.",
    inputSchema: {
      type: "object",
      properties: {
        crop_type: {
          type: "string",
          description: "Crop name (e.g. 'corn', 'soybeans', 'wheat', 'cotton', 'tomatoes').",
          default: "corn",
        },
        acreage: {
          type: "number",
          description: "Total planted acreage.",
          default: 100,
        },
        location: {
          type: "string",
          description: "Farm location — city and state, or GPS coordinates.",
        },
        soil_metrics: {
          type: "object",
          description: "Soil test results. Include pH, nitrogen_ppm, phosphorus_ppm, potassium_ppm, organic_matter_pct. Omit to skip soil analysis.",
          properties: {
            pH:                  { type: "number" },
            nitrogen_ppm:        { type: "number" },
            phosphorus_ppm:      { type: "number" },
            potassium_ppm:       { type: "number" },
            organic_matter_pct:  { type: "number" },
          },
          default: {},
        },
      },
      required: ["crop_type", "acreage"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. BOOK FULL TRIP
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_book_full_trip",
    description:
      "Use when you need to plan and book an entire trip end-to-end in a SINGLE CALL. " +
      "Replaces: travel_search_flights + travel_search_hotels + travel_compare_car_rentals + " +
      "travel_search_restaurants + travel_build_itinerary + travel_visa_requirements (6 tool calls → 1). " +
      "Returns a complete travel package with ranked flights, hotels, car rental options, dining recommendations, " +
      "a day-by-day itinerary, and visa/entry requirements.",
    inputSchema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Trip destination (city, region, or country).",
        },
        start_date: {
          type: "string",
          description: "Trip start date (ISO 8601 YYYY-MM-DD).",
        },
        end_date: {
          type: "string",
          description: "Trip end date (ISO 8601 YYYY-MM-DD).",
        },
        budget_usd: {
          type: "number",
          description: "Total trip budget in USD.",
          default: 3000,
        },
        travelers: {
          type: "integer",
          description: "Number of travelers.",
          default: 1,
        },
      },
      required: ["destination", "start_date", "end_date"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. RUN PROCUREMENT CYCLE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_procurement_cycle",
    description:
      "Use when you need to run a full sourcing-to-contract procurement cycle in a SINGLE CALL. " +
      "Replaces: procurement_discover_suppliers + procurement_create_rfq + procurement_evaluate_bids + " +
      "procurement_draft_contract + procurement_match_invoice (5 tool calls → 1). " +
      "Returns a complete procurement package with supplier shortlist, RFQ document, bid scorecard, " +
      "ready-to-sign contract, and invoice match results.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category of goods or services to source (e.g. 'cloud storage', 'PCB components', 'logistics partner').",
        },
        requirements: {
          type: "object",
          description: "Specification, compliance, and delivery requirements (e.g. { quantity: 500, lead_time_days: 30, certifications: ['ISO9001'] }).",
          default: {},
        },
        budget_usd: {
          type: "number",
          description: "Maximum procurement budget in USD.",
          default: 0,
        },
      },
      required: ["category"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 13. PROCESS FULL SALES CYCLE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_sales_cycle",
    description:
      "Use when you need to take a lead from cold prospect to booked meeting in a SINGLE CALL. " +
      "Replaces: sales_enrich_lead + sales_score_lead + sales_generate_outreach + " +
      "sales_schedule_meeting + sales_forecast_pipeline (5 tool calls → 1). " +
      "Returns a complete sales package with enriched firmographics, ICP score, personalized email sequence, " +
      "confirmed meeting booking, and updated pipeline forecast.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: {
          type: "string",
          description: "Target company name.",
        },
        contact_name: {
          type: "string",
          description: "Primary contact's full name.",
        },
        email: {
          type: "string",
          description: "Contact's email address.",
        },
        campaign: {
          type: "string",
          description: "Campaign name or objective (e.g. 'Q2 mid-market push', 'enterprise upsell').",
          default: "outbound",
        },
      },
      required: ["company_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 14. SCREEN AND HIRE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_screen_and_hire",
    description:
      "Use when you need to run a full recruiting pipeline from applications to onboarding in a SINGLE CALL. " +
      "Replaces: hr_screen_resume (for all candidates) + hr_match_candidates + hr_interview_questions + " +
      "hr_check_compensation + hr_automate_onboarding (5+ tool calls → 1). " +
      "Returns a complete hiring package with screened candidates, a ranked shortlist, a structured interview guide, " +
      "compensation benchmarks, and a ready-to-launch 30-60-90 day onboarding plan.",
    inputSchema: {
      type: "object",
      properties: {
        job_requirements: {
          type: "object",
          description: "Job requirements object with role, skills, must_have, department, and job_id.",
          properties: {
            role:        { type: "string", description: "Job title / role type" },
            skills:      { type: "array", items: { type: "string" }, description: "Required skills list" },
            must_have:   { type: "array", items: { type: "string" }, description: "Non-negotiable must-have skills" },
            department:  { type: "string", description: "Hiring department" },
            job_id:      { type: "string", description: "Job requisition ID (optional)" },
          },
        },
        resume_texts: {
          type: "array",
          items: { type: "string" },
          description: "Array of resume text strings to screen (one per candidate).",
          default: [],
        },
        compensation: {
          type: "object",
          description: "Compensation context for benchmarking: { title, location, experience, industry }.",
          properties: {
            title:      { type: "string" },
            location:   { type: "string" },
            experience: { type: "string", enum: ["junior", "mid", "senior", "staff", "director", "vp", "c-level"] },
            industry:   { type: "string" },
          },
          default: {},
        },
      },
      required: ["job_requirements"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 15. FULL FRAUD CHECK
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_fraud_check",
    description:
      "Use when you need a comprehensive fraud assessment for a transaction in a SINGLE CALL. " +
      "Replaces: fraud_screen_transaction + fraud_detect_anomalies + fraud_check_identity + " +
      "fraud_predict_chargeback + fraud_analyze_network (5 tool calls → 1). " +
      "Returns a complete fraud assessment with a composite risk score, approve/review/decline recommendation, " +
      "anomaly report, identity verification, chargeback probability, and network graph analysis.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_data: {
          type: "object",
          description: "Transaction details to assess. Include amount, currency, merchant, payment_method, timestamp, ip_address, device_id.",
          properties: {
            amount:         { type: "number",  description: "Transaction amount" },
            currency:       { type: "string",  description: "Currency code (e.g. 'USD')" },
            merchant:       { type: "string",  description: "Merchant name or ID" },
            payment_method: { type: "string",  description: "Payment method (e.g. 'visa', 'ach', 'crypto')" },
            timestamp:      { type: "string",  description: "Transaction timestamp (ISO 8601)" },
            ip_address:     { type: "string",  description: "IP address of the transaction originator" },
            device_id:      { type: "string",  description: "Device fingerprint or ID" },
          },
        },
        user_profile: {
          type: "object",
          description: "Account holder profile for behavioral context. Include account_id, name, email, dob, address, and account_age_days if available.",
          default: {},
        },
      },
      required: ["transaction_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * handleWorkflowTool
 *
 * Routes a tool call to the appropriate composite workflow function.
 *
 * @param {string} name   - Tool name (e.g. "workflow_full_insurance_claim")
 * @param {object} args   - Tool arguments from the MCP call
 * @returns {*}           - Composite workflow result
 * @throws {Error}        - If the tool name is unrecognised
 */
export function handleWorkflowTool(name, args = {}) {
  switch (name) {

    case "workflow_full_insurance_claim":
      return processFullInsuranceClaim(
        args.claim_type,
        args.policy_number,
        args.incident_details ?? {},
        args.evidence ?? []
      );

    case "workflow_construction_project":
      return fileConstructionProject(
        args.address,
        args.municipality,
        args.project_type ?? "residential",
        args.sqft ?? 1000
      );

    case "workflow_legal_case_setup":
      return runLegalCaseSetup(
        args.practice_area ?? "personal_injury",
        args.client_info ?? {},
        args.case_description ?? "",
        args.medical_records_pages ?? 0
      );

    case "workflow_healthcare_encounter":
      return processHealthcareEncounter(
        args.encounter_type ?? "office_visit",
        args.symptoms ?? [],
        args.findings ?? {},
        args.insurance_provider ?? "",
        args.procedure_code ?? ""
      );

    case "workflow_small_business_setup":
      return setupSmallBusiness(
        args.business_type ?? "LLC",
        args.state ?? "CA",
        args.city ?? ""
      );

    case "workflow_trades_job":
      return executeTradesJob(
        args.trade_type ?? "general",
        args.municipality ?? "",
        args.job_description ?? "",
        args.location ?? ""
      );

    case "workflow_international_shipment":
      return processInternationalShipment(
        args.product ?? "",
        args.origin_country ?? "US",
        args.dest_country ?? "GB",
        args.value ?? 0
      );

    case "workflow_agent_monitoring":
      return deployAgentMonitoring(
        args.endpoint_urls ?? [],
        args.workflow_id
      );

    case "workflow_commerce_transaction":
      return runCommerceTransaction(
        args.product_url ?? "",
        args.merchant_domain ?? "",
        args.items ?? [],
        args.shipping_address ?? {}
      );

    case "workflow_crop_season":
      return assessCropSeason(
        args.crop_type ?? "corn",
        args.acreage ?? 100,
        args.location ?? "",
        args.soil_metrics ?? {}
      );


    case "workflow_book_full_trip":
      return bookFullTrip(
        args.destination ?? "",
        args.start_date ?? "",
        args.end_date ?? "",
        args.budget_usd ?? 3000,
        args.travelers ?? 1
      );

    case "workflow_procurement_cycle":
      return runProcurementCycle(
        args.category ?? "",
        args.requirements ?? {},
        args.budget_usd ?? 0
      );

    case "workflow_full_sales_cycle":
      return processFullSalesCycle(
        args.company_name ?? "",
        args.contact_name ?? "",
        args.email ?? "",
        args.campaign ?? "outbound"
      );

    case "workflow_screen_and_hire":
      return screenAndHire(
        args.job_requirements ?? {},
        args.resume_texts ?? [],
        args.compensation ?? {}
      );

    case "workflow_full_fraud_check":
      return fullFraudCheck(
        args.transaction_data ?? {},
        args.user_profile ?? {}
      );

    default:
      throw new Error(`Unknown workflow tool: ${name}`);
  }
}
