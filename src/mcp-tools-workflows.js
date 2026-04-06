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

    default:
      throw new Error(`Unknown workflow tool: ${name}`);
  }
}
