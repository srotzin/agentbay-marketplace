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
  runEnergyAuditWorkflow,
  runFleetOptimizationWorkflow,
  runTaxFilingWorkflow,
  runFullRxTransaction,
  runPharmaSupplyChain,
  runGlobalDrugPricing,
  tokenizeAndList,
  agentFundraise,
  multiAgentSettlement,
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


  // ─────────────────────────────────────────────────────────────────────────
  // 16. ENERGY AUDIT WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_energy_audit",
    description:
      "Use when you need to run a complete energy review — from bill analysis to an optimised schedule — in a SINGLE CALL. " +
      "Replaces: energy_analyze_bill + energy_compare_providers + energy_audit_efficiency + energy_optimize_schedule + energy_dashboard " +
      "(5 tool calls → 1). " +
      "Returns a full energy package: itemised bill breakdown, ranked provider alternatives, efficiency audit with payback periods, " +
      "an optimised daily device schedule, and a live dashboard link.",
    inputSchema: {
      type: "object",
      properties: {
        bill_data: {
          type: "object",
          description: "Current energy bill details — include utility_type, period_start, period_end, total_amount, usage_kwh, rate_per_kwh.",
          properties: {
            utility_type: { type: "string", description: "'electricity', 'gas', 'water', or 'multi'.", default: "electricity" },
            period_start: { type: "string", description: "Billing period start (ISO 8601)." },
            period_end:   { type: "string", description: "Billing period end (ISO 8601)." },
            total_amount: { type: "number", description: "Total billed amount." },
            usage_kwh:    { type: "number", description: "Total consumption in kWh." },
            rate_per_kwh: { type: "number", description: "Rate per kWh." },
          },
          default: {},
        },
        property: {
          type: "object",
          description: "Property details for efficiency audit — include location, sqft, building_type, hvac_age_years, insulation_rating.",
          default: {},
        },
        devices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:       { type: "string" },
              type:       { type: "string" },
              power_kw:   { type: "number" },
              flexible:   { type: "boolean", default: false },
              required_by:{ type: "string", description: "Latest acceptable completion time (HH:MM)." },
            },
          },
          description: "Devices to schedule for load optimisation. Omit to skip schedule step.",
          default: [],
        },
        tariff: {
          type: "object",
          description: "Tariff structure for schedule optimisation — include peak_rate, off_peak_rate, peak_hours_start, peak_hours_end.",
          default: {},
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 17. FLEET OPTIMISATION WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_fleet_optimization",
    description:
      "Use when you need to prepare a fleet dispatch end-to-end — routes, loads, maintenance, tracking, and dashboard — in a SINGLE CALL. " +
      "Replaces: fleet_optimize_route + fleet_plan_load + fleet_predict_maintenance + fleet_track + fleet_dashboard " +
      "(5 tool calls → 1). " +
      "Returns an optimised route plan, load assignment per vehicle, maintenance alerts, live GPS tracking links, and a fleet KPI dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        depot: {
          type: "string",
          description: "Starting depot address or coordinates (lat,lng).",
          default: "",
        },
        stops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              address:      { type: "string" },
              time_window:  { type: "string", description: "Acceptable arrival window e.g. '09:00-12:00'." },
              service_mins: { type: "number", default: 10 },
            },
          },
          description: "Delivery stops for route planning.",
          default: [],
        },
        vehicles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              vehicle_id:  { type: "string" },
              capacity_kg: { type: "number" },
              volume_m3:   { type: "number" },
            },
          },
          description: "Fleet vehicles with capacity info.",
          default: [],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_id:     { type: "string" },
              weight_kg:   { type: "number" },
              volume_m3:   { type: "number" },
              destination: { type: "string" },
            },
          },
          description: "Cargo items to load and assign to vehicles.",
          default: [],
        },
        include_maintenance_check: {
          type: "boolean",
          description: "Run predictive maintenance check on all vehicles before dispatch.",
          default: true,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 18. TAX FILING WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_tax_filing",
    description:
      "Use when you need to run a full accounting close and tax filing cycle in a SINGLE CALL. " +
      "Replaces: tax_categorize_expense + tax_reconcile + tax_forecast_cashflow + tax_prepare_return + tax_financial_statement " +
      "(5 tool calls → 1). " +
      "Returns a complete tax and accounting package: categorised transactions, reconciled accounts, cash-flow forecast, " +
      "a ready-to-file tax return draft, and GAAP financial statements.",
    inputSchema: {
      type: "object",
      properties: {
        tax_year: {
          type: "integer",
          description: "Tax year to file for (e.g. 2024).",
        },
        entity_type: {
          type: "string",
          enum: ["individual", "sole_proprietor", "LLC", "S-Corp", "C-Corp", "partnership"],
          description: "Filing entity type.",
          default: "LLC",
        },
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount:      { type: "number" },
              description:{ type: "string" },
              merchant:   { type: "string" },
              date:        { type: "string", description: "Transaction date (ISO 8601)." },
            },
          },
          description: "Raw transactions to categorise and reconcile.",
          default: [],
        },
        accounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              account_id:        { type: "string" },
              statement_balance: { type: "number", description: "Closing balance from external statement." },
              book_balance:      { type: "number", description: "GL closing balance." },
            },
          },
          description: "Accounts to reconcile as part of the close.",
          default: [],
        },
        jurisdiction: {
          type: "string",
          description: "Primary tax jurisdiction (e.g. 'US-federal', 'US-CA', 'UK').",
          default: "US-federal",
        },
      },
      required: ["tax_year"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 19. FULL RX TRANSACTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_rx_transaction",
    description: "Use when you need to process a complete end-to-end prescription transaction in one call — from writing the prescription, through insurance adjudication and formulary verification, to dispense authorization. Triggers: 'fill prescription', 'process Rx', 'adjudicate claim for drug', 'check coverage and dispense', 'prior auth + dispense', 'insurance drug claim workflow'. Returns: prescription details, formulary tier, claim adjudication result, prior auth status, dispense authorization, and recommended next steps. Fee: $1.75.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: {
          type: "string",
          description: "Name of the drug to prescribe (e.g. 'Metformin', 'Ozempic', 'Eliquis').",
        },
        patient_id: {
          type: "string",
          description: "Patient identifier for claim adjudication.",
          default: "patient-001",
        },
        prescriber_id: {
          type: "string",
          description: "Prescriber NPI or identifier.",
          default: "prescriber-001",
        },
        plan_id: {
          type: "string",
          description: "Insurance plan ID (e.g. 'plan-commercial-001', 'plan-medicare-d-001').",
          default: "plan-commercial-001",
        },
        quantity: {
          type: "number",
          description: "Quantity dispensed (e.g. 30 tablets).",
          default: 30,
        },
        days_supply: {
          type: "number",
          description: "Days supply for the prescription (e.g. 30, 90).",
          default: 30,
        },
        patient_profile: {
          type: "object",
          description: "Optional patient profile for eligibility and prior auth checks (age, diagnoses, etc.).",
          default: {},
        },
      },
      required: ["drug_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 20. PHARMA SUPPLY CHAIN
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_pharma_supply_chain",
    description: "Use when you need to verify and track a pharmaceutical product through the entire supply chain — from origin to destination, including DSCSA serialization verification and counterfeit risk assessment. Triggers: 'track drug shipment', 'verify DSCSA', 'check counterfeit risk', 'serialized drug verification', 'pharma supply chain audit', 'lot number track and trace', 'drug distribution integrity'. Returns: real-time distribution tracking, DSCSA verification status, chain-of-custody status, counterfeit risk level, and recommended actions. Fee: $1.75.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: {
          type: "string",
          description: "Name of the drug being tracked (e.g. 'Humira', 'Ozempic').",
        },
        ndc: {
          type: "string",
          description: "National Drug Code (NDC) in format 00000-0000-00.",
          default: "00000-0000-00",
        },
        lot_number: {
          type: "string",
          description: "Manufacturing lot number for DSCSA tracing.",
          default: "LOT-001",
        },
        serial_number: {
          type: "string",
          description: "Serialized unit identifier for DSCSA verification.",
          default: "SN-000001",
        },
        origin: {
          type: "string",
          description: "Origin country code (e.g. 'US', 'IN', 'DE').",
          default: "US",
        },
        destination: {
          type: "string",
          description: "Destination country code (e.g. 'US', 'CA', 'GB').",
          default: "US",
        },
        quantity: {
          type: "number",
          description: "Quantity of units in shipment.",
          default: 1000,
        },
      },
      required: ["drug_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 21. GLOBAL DRUG PRICING
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_global_drug_pricing",
    description: "Use when you need comprehensive drug pricing intelligence across all 10 major pharmaceutical markets simultaneously, combined with adverse event monitoring and market arbitrage analysis. Triggers: 'drug price across countries', 'global pharma pricing', 'international drug cost comparison', 'reference pricing analysis', 'pharma market intelligence', 'drug arbitrage opportunity', 'IRA negotiation benchmark', 'price comparison US vs EU'. Returns: per-unit prices in USD for US, UK, Germany, France, Japan, Canada, Australia, Brazil, India, China — plus adverse event trends, arbitrage opportunity flag, and market intelligence. Fee: $3.50.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: {
          type: "string",
          description: "Name of the drug to price globally (e.g. 'Humira', 'Keytruda', 'Ozempic').",
        },
        drug_class: {
          type: "string",
          description: "Drug class for pricing model (e.g. 'Biologic', 'Small Molecule', 'GLP-1 Receptor Agonist').",
          default: "Pharmaceutical",
        },
        indication: {
          type: "string",
          description: "Primary therapeutic indication for the drug.",
          default: "",
        },
        is_generic: {
          type: "boolean",
          description: "Whether the drug is a generic formulation (lowers baseline price).",
          default: false,
        },
        is_biologic: {
          type: "boolean",
          description: "Whether the drug is a biologic (raises baseline price significantly).",
          default: false,
        },
      },
      required: ["drug_name"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─── RAIL WORKFLOW 1: Tokenize and List ──────────────────────────────────────
  {
    name: "workflow_tokenize_and_list",
    description:
      "Use when an agent wants to launch a tradeable ATS-1 token for their service in a SINGLE CALL. " +
      "Replaces: rails_issue_token + rails_create_pool + rails_token_registry + rails_broadcast_offer (4 calls → 1). " +
      "Runs the complete token launch pipeline: issue ATS-1 token on Base L2 → create USDC AMM liquidity pool → " +
      "verify registry listing → broadcast launch to 500-2000+ agents in the market. " +
      "Triggers: 'tokenize my service', 'launch agent token', 'create tradeable token', 'issue ATS-1', 'list agent token'. " +
      "Returns: token_id, contract_address, pool_id, market broadcast results, and total launch cost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the issuing agent",
        },
        token_name: {
          type: "string",
          description: "Full token name (e.g. 'ResearchBot Data Token')",
        },
        token_symbol: {
          type: "string",
          description: "2-8 character ticker (e.g. 'RBDT')",
        },
        total_supply: {
          type: "number",
          description: "Total tokens to mint",
        },
        asset_type: {
          type: "string",
          enum: ["service_subscription", "data_feed", "compute_capacity", "workflow_access", "yield_share", "reputation_bond", "governance_right", "revenue_share"],
          description: "ATS-1 asset type",
        },
        underlying_value: {
          type: "number",
          description: "USD value of the underlying asset being tokenized",
        },
        initial_liquidity: {
          type: "number",
          description: "USD to seed into the AMM liquidity pool (default: 10% of underlying value)",
        },
      },
      required: ["agent_id", "token_name", "token_symbol", "total_supply", "asset_type", "underlying_value"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─── RAIL WORKFLOW 2: Agent Fundraise ────────────────────────────────────────
  {
    name: "workflow_agent_fundraise",
    description:
      "Use when an agent needs to raise capital from other agents through a bond issuance in a SINGLE CALL. " +
      "Replaces: rails_issue_bond + rails_broadcast_offer (2 calls → 1). " +
      "Runs the complete fundraise pipeline: issue on-chain bond with ISIN + credit rating → " +
      "set coupon schedule and maturity → open subscription window → broadcast to agent investor market. " +
      "Triggers: 'raise capital', 'issue agent bond', 'fund my agent', 'raise money', 'agent fundraise', 'bond offering'. " +
      "Returns: bond_id, ISIN, credit_rating, investor pipeline, estimated_subscription, and total cost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Bond issuer agent ID",
        },
        face_value: {
          type: "number",
          description: "Total capital to raise in USD (minimum $1,000)",
        },
        coupon_rate: {
          type: "number",
          description: "Annual coupon rate as decimal (e.g. 0.085 = 8.5%)",
        },
        maturity_months: {
          type: "number",
          description: "Months until bond matures",
        },
        use_of_proceeds: {
          type: "string",
          description: "How proceeds will be used (disclosed to investors)",
        },
      },
      required: ["agent_id", "face_value", "coupon_rate", "maturity_months"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─── RAIL WORKFLOW 3: Multi-Agent Settlement ─────────────────────────────────
  {
    name: "workflow_multi_agent_settlement",
    description:
      "Use when settling a complex multi-party transaction with escrow, milestones, and multi-hop distribution in a SINGLE CALL. " +
      "Replaces: rails_create_escrow_token + rails_multi_hop_settle + rails_settle (3 calls → 1). " +
      "Runs the complete settlement pipeline: create tokenized escrow → process milestone proofs → " +
      "execute atomic multi-hop distribution → final on-chain settlement with permanent proof. " +
      "Triggers: 'settle multi-agent task', 'pay with milestones', 'multi-party settlement', 'escrow and settle', " +
      "'distribute payment across agents', 'atomic settlement with hops'. " +
      "Returns: settlement_id, proof_hash, all party receipts, audit trail, and BaseScan URL.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task or project ID being settled",
        },
        payer_agent: {
          type: "string",
          description: "Agent paying for the work",
        },
        receiver_agent: {
          type: "string",
          description: "Primary agent who completed the work (receives final net payment)",
        },
        total_amount: {
          type: "number",
          description: "Total payment amount in USDC",
        },
        hops: {
          type: "array",
          description: "Intermediate agents taking cuts before final receiver. Optional.",
          items: {
            type: "object",
            properties: {
              agent_id: { type: "string" },
              cut_pct: { type: "number" },
              service: { type: "string" },
            },
            required: ["agent_id", "cut_pct"],
          },
        },
        milestones: {
          type: "array",
          description: "Milestone definitions for escrow. Percentages must sum to 100.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              pct: { type: "number" },
              description: { type: "string" },
            },
            required: ["name", "pct"],
          },
        },
        proof_of_work: {
          type: "string",
          description: "Proof of completed work: hash, IPFS CID, URL, or description",
        },
      },
      required: ["task_id", "payer_agent", "receiver_agent", "total_amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

    case "workflow_energy_audit":
      return runEnergyAuditWorkflow(
        args.bill_data ?? {},
        args.property ?? {},
        args.devices ?? [],
        args.tariff ?? {}
      );

    case "workflow_fleet_optimization":
      return runFleetOptimizationWorkflow(
        args.depot ?? "",
        args.stops ?? [],
        args.vehicles ?? [],
        args.items ?? [],
        args.include_maintenance_check ?? true
      );

    case "workflow_tax_filing":
      return runTaxFilingWorkflow(
        args.tax_year,
        args.entity_type ?? "LLC",
        args.transactions ?? [],
        args.accounts ?? [],
        args.jurisdiction ?? "US-federal"
      );

    case "workflow_full_rx_transaction":
      return runFullRxTransaction(
        args.drug_name,
        args.patient_id ?? "patient-001",
        args.prescriber_id ?? "prescriber-001",
        args.plan_id ?? "plan-commercial-001",
        args.quantity ?? 30,
        args.days_supply ?? 30,
        args.patient_profile ?? {}
      );

    case "workflow_pharma_supply_chain":
      return runPharmaSupplyChain(
        args.drug_name,
        args.ndc ?? "00000-0000-00",
        args.lot_number ?? "LOT-001",
        args.serial_number ?? "SN-000001",
        args.origin ?? "US",
        args.destination ?? "US",
        args.quantity ?? 1000
      );

    case "workflow_global_drug_pricing":
      return runGlobalDrugPricing(
        args.drug_name,
        args.drug_class ?? "Pharmaceutical",
        args.indication ?? "",
        args.is_generic ?? false,
        args.is_biologic ?? false
      );

    case "workflow_tokenize_and_list":
      return tokenizeAndList(
        args.agent_id,
        args.token_name,
        args.token_symbol,
        args.total_supply,
        args.asset_type,
        args.underlying_value,
        args.initial_liquidity
      );

    case "workflow_agent_fundraise":
      return agentFundraise(
        args.agent_id,
        args.face_value,
        args.coupon_rate,
        args.maturity_months,
        args.use_of_proceeds
      );

    case "workflow_multi_agent_settlement":
      return multiAgentSettlement(
        args.task_id,
        args.payer_agent,
        args.receiver_agent,
        args.total_amount,
        args.hops,
        args.milestones,
        args.proof_of_work
      );

    default:
      throw new Error(`Unknown workflow tool: ${name}`);
  }
}
