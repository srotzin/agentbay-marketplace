/**
 * HiveAgent MCP Tool Definitions — Pharmaceutical Transaction Tools
 *
 * 10 pharmaceutical transaction tools covering the full drug commerce lifecycle:
 *
 *   rx_process              - Full prescription transaction processing
 *   rx_adjudicate_claim     - PBM pharmacy claim adjudication
 *   rx_process_rebate       - Pharma manufacturer→PBM rebate processing
 *   rx_track_distribution   - Global pharmaceutical distribution tracking
 *   rx_verify_dscsa         - Drug Supply Chain Security Act verification
 *   rx_check_formulary      - Insurance formulary status across plans
 *   rx_wholesale_trade      - Wholesale pharma trading (distributor↔pharmacy↔hospital)
 *   rx_global_pricing       - Drug pricing across 10 countries
 *   rx_adverse_events       - Pharmacovigilance / adverse event monitoring
 *   rx_narcotic_audit       - DEA controlled substance narcotic audit
 *
 * Revenue: $0.10–$3.00 per transaction + percentage-based fees on large trades
 */

import {
  processPrescription,
  adjudicateClaim,
  processRebate,
  trackGlobalDistribution,
  verifyDscsa,
  checkFormularyStatus,
  processWholesaleTrade,
  calculateGlobalPricing,
  monitorAdverseEvents,
  auditNarcotics,
} from "./services/pharma-transactions.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const pharmaTxTools = [

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PROCESS PRESCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_process",
    description:
      "Use when you need to process a prescription transaction end-to-end — adjudication, copay calculation, " +
      "drug utilization review (DUR), and prior authorization check — for a patient filling a drug at a pharmacy. " +
      "Triggers: 'fill a prescription', 'process an Rx', 'submit prescription claim', 'check copay for Rx', " +
      "'run DUR for patient', 'what will the patient pay for this drug', 'submit Rx to insurance'. " +
      "Returns: rx_number, adjudication_result, copay_usd, plan_paid_usd, prior_auth_required, DUR alerts. " +
      "Fee: $0.25/transaction.",
    inputSchema: {
      type: "object",
      properties: {
        ndc: {
          type: "string",
          description: "11-digit National Drug Code of the dispensed drug (e.g., '00169036912' for Ozempic 1mg pen).",
        },
        quantity: {
          type: "number",
          description: "Quantity dispensed (e.g., 4 for 4 pen injectors; 30 for 30 tablets).",
          default: 30,
        },
        patient_id: {
          type: "string",
          description: "Patient identifier (de-identified or pseudonymous is fine).",
        },
        prescriber_id: {
          type: "string",
          description: "Prescriber NPI number (10-digit National Provider Identifier).",
        },
        pharmacy_id: {
          type: "string",
          description: "Pharmacy NCPDP number (7-digit).",
        },
        insurance_plan: {
          type: "string",
          description: "Insurance plan ID. Common options: 'plan-medicare-part-d-standard', 'plan-bcbs-national-ppo', " +
            "'plan-uhc-choice-plus', 'plan-cigna-open-access', 'plan-california-medicaid'. Leave blank for default BCBS.",
          default: "plan-bcbs-national-ppo",
        },
      },
      required: ["ndc", "patient_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ADJUDICATE CLAIM
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_adjudicate_claim",
    description:
      "Use when you need to adjudicate a pharmacy benefit claim through a PBM (Pharmacy Benefit Manager) and get a " +
      "paid/rejected decision with formulary tier, copay, plan payment, and reject codes. " +
      "Triggers: 'adjudicate pharmacy claim', 'submit NCPDP claim to PBM', 'check if claim will be paid', " +
      "'get formulary tier for drug', 'what PBM reject code is this', 'run claim through Express Scripts/OptumRx/CVS Caremark'. " +
      "Supports all 6 major PBMs: Express Scripts, CVS Caremark, OptumRx, MedImpact, Navitus, Prime Therapeutics. " +
      "Returns: status (paid/rejected), reject_reasons, formulary_tier, copay_usd, plan_payment_usd. " +
      "Fee: $0.10/claim.",
    inputSchema: {
      type: "object",
      properties: {
        claim_data: {
          type: "object",
          description: "NCPDP claim fields. Include ndc, quantity_dispensed, days_supply, patient_id, prescriber_npi, pharmacy_ncpdp, plan_id, diagnosis_code.",
          properties: {
            ndc:                  { type: "string", description: "11-digit NDC" },
            quantity_dispensed:   { type: "number", description: "Units dispensed", default: 30 },
            days_supply:          { type: "number", description: "Days supply", default: 30 },
            patient_id:           { type: "string", description: "Patient ID" },
            prescriber_npi:       { type: "string", description: "Prescriber NPI" },
            pharmacy_ncpdp:       { type: "string", description: "Pharmacy NCPDP number" },
            plan_id:              { type: "string", description: "Insurance plan ID" },
            diagnosis_code:       { type: "string", description: "ICD-10 diagnosis code", default: "Z00.00" },
          },
          default: {},
        },
        pbm_id: {
          type: "string",
          description: "PBM to adjudicate through: 'pbm-express-scripts', 'pbm-cvs-caremark', 'pbm-optumrx', " +
            "'pbm-medimpact', 'pbm-navitus', 'pbm-prime-therapeutics'. Default: Express Scripts.",
          default: "pbm-express-scripts",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PROCESS REBATE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_process_rebate",
    description:
      "Use when you need to process or analyze a pharmaceutical rebate between a drug manufacturer and a PBM. " +
      "Covers the $200B/year pharmaceutical rebate ecosystem — the largely hidden money flows that determine " +
      "formulary placement and drug pricing. " +
      "Triggers: 'calculate pharma rebate', 'process manufacturer rebate to PBM', 'what rebate does AbbVie pay on Humira', " +
      "'rebate settlement for quarter', 'rebate contract analysis', 'how much did Novo Nordisk pay in rebates'. " +
      "Returns: gross_rebate_usd, net_rebate_usd, rebate_rate_pct, settlement_date, contract_terms, pass-through breakdown. " +
      "Fee: 0.5% of rebate amount.",
    inputSchema: {
      type: "object",
      properties: {
        drug_id: {
          type: "string",
          description: "Drug name or NDC (e.g., 'Humira', 'adalimumab', 'Ozempic', 'semaglutide').",
        },
        manufacturer: {
          type: "string",
          description: "Manufacturer name (e.g., 'AbbVie', 'Novo Nordisk', 'Pfizer', 'Merck', 'AstraZeneca').",
        },
        pbm_id: {
          type: "string",
          description: "PBM ID: 'pbm-express-scripts', 'pbm-cvs-caremark', 'pbm-optumrx', 'pbm-medimpact', 'pbm-navitus', 'pbm-prime-therapeutics'.",
          default: "pbm-express-scripts",
        },
        quarter: {
          type: "string",
          description: "Reporting quarter (e.g., '2025-Q1', '2024-Q4').",
          default: "2025-Q1",
        },
        volume: {
          type: "number",
          description: "Units dispensed in the period (used to calculate total rebate amount).",
          default: 50000,
        },
      },
      required: ["drug_id", "manufacturer"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TRACK GLOBAL DISTRIBUTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_track_distribution",
    description:
      "Use when you need to track a pharmaceutical shipment through the global distribution network, including " +
      "cold chain verification, customs status, DSCSA compliance, and counterfeit checking. " +
      "Triggers: 'track drug shipment', 'where is my pharma shipment', 'cold chain status for biologic', " +
      "'customs clearance for drug import', 'DSCSA verification for shipment', 'counterfeit check on drug lot', " +
      "'track vaccine shipment', 'check cold chain excursions'. " +
      "Returns: shipment_status, customs_status, cold_chain_excursions, dscsa_verification, counterfeit_check, estimated_arrival. " +
      "Fee: $0.50/track.",
    inputSchema: {
      type: "object",
      properties: {
        ndc: {
          type: "string",
          description: "11-digit NDC of the drug being shipped.",
        },
        shipment_id: {
          type: "string",
          description: "Shipment/lot identifier (e.g., 'SHIP-2025-001234', 'LOT-ABC123456').",
        },
        from_country: {
          type: "string",
          description: "Origin country ISO 2-letter code (e.g., 'US', 'DE', 'IN', 'CN').",
          default: "US",
        },
        to_country: {
          type: "string",
          description: "Destination country ISO 2-letter code (e.g., 'US', 'UK', 'AU', 'CA').",
          default: "US",
        },
        quantity: {
          type: "number",
          description: "Units in shipment.",
          default: 1000,
        },
      },
      required: ["ndc", "shipment_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. VERIFY DSCSA
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_verify_dscsa",
    description:
      "Use when you need to verify a drug's authenticity and supply chain integrity using the Drug Supply Chain " +
      "Security Act (DSCSA) interoperable tracing network. Validates serialization, lot numbers, expiration, " +
      "recall status, and authorized trading partner status. " +
      "Triggers: 'DSCSA verify drug', 'authenticate drug supply chain', 'check drug recall status', " +
      "'verify serialized drug product', 'lot number verification', 'is this drug counterfeit', " +
      "'check trading partner authorization', 'DSCSA saleable returns verification'. " +
      "Returns: verified, product_identifier, lot_number, expiration_date, transaction_history[], recall_status. " +
      "Fee: $0.25/verify.",
    inputSchema: {
      type: "object",
      properties: {
        serialized_data: {
          type: "object",
          description: "Serialized product data from the drug package 2D barcode (GS1-128 or DataMatrix). " +
            "Include ndc, serial_number, lot_number, expiry_date (YYYY-MM-DD), gtin (optional).",
          properties: {
            ndc:           { type: "string", description: "11-digit NDC" },
            serial_number: { type: "string", description: "Unique serial number from package" },
            lot_number:    { type: "string", description: "Lot/batch number" },
            expiry_date:   { type: "string", description: "Expiry date (YYYY-MM-DD)" },
            gtin:          { type: "string", description: "GTIN-14 (optional)" },
          },
          default: {},
        },
        trading_partner: {
          type: "string",
          description: "Name of the receiving trading partner (e.g., 'CVS Pharmacy #4521', 'Hospital Pharmacy').",
        },
      },
      required: ["trading_partner"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CHECK FORMULARY STATUS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_check_formulary",
    description:
      "Use when you need to check whether a drug is covered by an insurance plan, its formulary tier, copay, " +
      "prior authorization requirements, step therapy requirements, and quantity limits. " +
      "Covers 20 insurance formulary plans including Medicare Part D, BCBS, UHC, Cigna, Humana, Medicaid, VA, TRICARE. " +
      "Triggers: 'is this drug covered by insurance', 'what tier is Ozempic on my plan', 'does my insurance require " +
      "prior auth for Dupixent', 'step therapy for Humira alternative', 'formulary check for drug', " +
      "'what is my copay for Keytruda', 'does Medicare cover this drug'. " +
      "Returns: tier, covered, prior_auth_required, step_therapy_required, quantity_limits, member_copay_usd, alternatives[]. " +
      "Fee: $0.10/check.",
    inputSchema: {
      type: "object",
      properties: {
        drug_id: {
          type: "string",
          description: "Drug name (e.g., 'Ozempic', 'semaglutide', 'Humira', 'adalimumab', 'Dupixent') or NDC.",
        },
        insurance_plan: {
          type: "string",
          description: "Plan ID. Options: 'plan-medicare-part-d-standard', 'plan-medicare-advantage-aetna', " +
            "'plan-bcbs-national-ppo', 'plan-uhc-choice-plus', 'plan-cigna-open-access', 'plan-humana-hdhp', " +
            "'plan-california-medicaid', 'plan-texas-medicaid', 'plan-va-fee-for-service', 'plan-tricare-prime'. " +
            "Default: BCBS National PPO.",
          default: "plan-bcbs-national-ppo",
        },
        state: {
          type: "string",
          description: "US state (2-letter code) for state-specific formulary rules.",
          default: "CA",
        },
      },
      required: ["drug_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PROCESS WHOLESALE TRADE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_wholesale_trade",
    description:
      "Use when you need to process or simulate a wholesale pharmaceutical trade transaction between distributors, " +
      "pharmacies, hospitals, or GPOs. Handles drug-to-drug or large-volume transfers with settlement, DEA verification, " +
      "DSCSA compliance, and regulatory clearance. " +
      "Triggers: 'wholesale drug purchase', 'pharmacy bulk drug order', 'hospital drug procurement', " +
      "'GPO drug purchase contract', 'drug transfer between pharmacies', 'McKesson/AmerisourceBergen/Cardinal Health order', " +
      "'large volume drug trade', '340B drug purchase'. " +
      "Returns: trade_id, settlement details, regulatory_clearance, delivery_schedule. " +
      "Fee: 0.3% of trade value.",
    inputSchema: {
      type: "object",
      properties: {
        drug_id: {
          type: "string",
          description: "Drug name or NDC being traded.",
        },
        seller: {
          type: "string",
          description: "Selling entity (e.g., 'McKesson', 'AmerisourceBergen', 'Cardinal Health', 'Pfizer Distribution', 'Manufacturer XYZ').",
        },
        buyer: {
          type: "string",
          description: "Buying entity (e.g., 'CVS Pharmacy', 'Hospital XYZ', 'Regional Pharmacy Chain', 'Specialty Pharmacy ABC').",
        },
        quantity: {
          type: "number",
          description: "Units to trade.",
          default: 1000,
        },
        price_per_unit_usd: {
          type: "number",
          description: "Price per unit in USD (WAC, AWP-discount, or negotiated price).",
          default: 10.00,
        },
        currency: {
          type: "string",
          description: "Transaction currency code (default USD).",
          default: "USD",
        },
      },
      required: ["drug_id", "seller", "buyer", "quantity", "price_per_unit_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CALCULATE GLOBAL PRICING
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_global_pricing",
    description:
      "Use when you need drug pricing intelligence across multiple countries — including WAC, reimbursement rates, " +
      "pricing mechanisms (NICE, AMNOG, HTA, PBAC), access status, and patient out-of-pocket costs globally. " +
      "Covers US, UK, Germany, France, Japan, Canada, Australia, Brazil, India, China. " +
      "Triggers: 'global drug pricing', 'how much does this drug cost in Germany vs US', 'international drug price comparison', " +
      "'drug pricing in UK vs US', 'what does Ozempic cost in Canada', 'market access analysis', " +
      "'drug price negotiation by country', 'NICE appraisal pricing', 'AMNOG drug pricing Germany', " +
      "'parallel import arbitrage analysis'. " +
      "Returns: pricing[] (country, price_per_unit_usd, price_per_unit_local, currency, mechanism, reimbursement_rate_pct), " +
      "market_intelligence (market_size, growth, biosimilar_competition), us_to_uk_ratio. " +
      "Fee: $1.00/query.",
    inputSchema: {
      type: "object",
      properties: {
        drug_id: {
          type: "string",
          description: "Drug name (e.g., 'Ozempic', 'semaglutide', 'Keytruda', 'pembrolizumab', 'Humira') or NDC.",
        },
        countries: {
          type: "array",
          items: { type: "string" },
          description: "ISO 2-letter country codes to include. Options: US, UK, DE, FR, JP, CA, AU, BR, IN, CN. " +
            "Default: all 10 countries.",
          default: ["US", "UK", "DE", "FR", "JP", "CA", "AU", "BR", "IN", "CN"],
        },
      },
      required: ["drug_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. MONITOR ADVERSE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_adverse_events",
    description:
      "Use when you need pharmacovigilance data, adverse event reports, safety signals, or REMS monitoring for a drug. " +
      "Queries FDA FAERS (US), EudraVigilance (EU), or WHO VigiBase. " +
      "Triggers: 'drug safety report', 'adverse events for drug', 'FAERS database query', 'pharmacovigilance monitoring', " +
      "'is there a safety signal for this drug', 'drug recall risk assessment', 'REMS program status', " +
      "'disproportionality analysis', 'post-market safety surveillance', 'drug injury reports', " +
      "'what are the serious adverse events for Ozempic'. " +
      "Returns: total_reports, events[] (frequency, severity, outcome), signal_detected, regulatory_actions, " +
      "rems_program_active, disproportionality_analysis. " +
      "Fee: $0.50/monitor.",
    inputSchema: {
      type: "object",
      properties: {
        drug_id: {
          type: "string",
          description: "Drug name or NDC to monitor adverse events for.",
        },
        report_type: {
          type: "string",
          enum: ["faers_query", "periodic_safety", "signal_detection", "rems_monitoring"],
          description: "Type of adverse event report to run: faers_query (real-time FAERS query), " +
            "periodic_safety (scheduled PSUR/PBRER), signal_detection (data mining), " +
            "rems_monitoring (REMS program compliance check).",
          default: "faers_query",
        },
        region: {
          type: "string",
          enum: ["US", "EU", "GLOBAL"],
          description: "Region for adverse event database: US (FAERS), EU (EudraVigilance), GLOBAL (WHO VigiBase).",
          default: "US",
        },
      },
      required: ["drug_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. AUDIT NARCOTICS (DEA)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "rx_narcotic_audit",
    description:
      "Use when you need to conduct or review a DEA controlled substance narcotic audit for a pharmacy, " +
      "hospital, or DEA registrant. Generates audit report with discrepancy analysis, theft/loss events, " +
      "DEA 106 filing requirements, ARCOS reporting, and compliance scoring. " +
      "Triggers: 'DEA narcotic audit', 'controlled substance inventory audit', 'DEA 106 theft report', " +
      "'ARCOS reporting', 'biennial inventory controlled substances', 'Schedule II audit', " +
      "'running inventory controlled substances', 'PDMP compliance check', 'DEA inspection preparation', " +
      "'narcotic discrepancy report', 'hydrocodone inventory audit', 'opioid diversion check'. " +
      "Returns: audit_report, discrepancies[], theft_or_loss_events[], compliance_score, required_filings[]. " +
      "Fee: $3.00/audit.",
    inputSchema: {
      type: "object",
      properties: {
        dea_registrant_id: {
          type: "string",
          description: "DEA registrant ID (9-character DEA number, e.g., 'AB1234567').",
        },
        controlled_substances: {
          type: "array",
          items: { type: "string" },
          description: "List of controlled substance drug names or NDCs to audit (e.g., ['Oxycodone 30mg', 'Hydrocodone-Acetaminophen 10/325', 'Fentanyl patch 75mcg']).",
          default: [],
        },
        period: {
          type: "string",
          description: "Audit period (e.g., '2025-Q1', '2024-Q4', '2025-H1', 'annual-2024').",
          default: "2025-Q1",
        },
      },
      required: ["dea_registrant_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * handlePharmaTxTool
 *
 * Routes an MCP tool call to the appropriate pharma transaction function.
 *
 * @param {string} name  - Tool name
 * @param {object} args  - Tool arguments
 * @returns {*}          - Transaction result
 * @throws {Error}       - If tool name is unrecognised
 */
export function handlePharmaTxTool(name, args = {}) {
  switch (name) {

    case "rx_process":
      return processPrescription(
        args.ndc ?? "",
        args.quantity ?? 30,
        args.patient_id ?? "P-UNKNOWN",
        args.prescriber_id ?? "1234567890",
        args.pharmacy_id ?? "1234567",
        args.insurance_plan ?? "plan-bcbs-national-ppo"
      );

    case "rx_adjudicate_claim":
      return adjudicateClaim(
        args.claim_data ?? {},
        args.pbm_id ?? "pbm-express-scripts"
      );

    case "rx_process_rebate":
      return processRebate(
        args.drug_id ?? "",
        args.manufacturer ?? "",
        args.pbm_id ?? "pbm-express-scripts",
        args.quarter ?? "2025-Q1",
        args.volume ?? 50000
      );

    case "rx_track_distribution":
      return trackGlobalDistribution(
        args.ndc ?? "",
        args.shipment_id ?? `SHIP-${Date.now()}`,
        args.from_country ?? "US",
        args.to_country ?? "US",
        args.quantity ?? 1000
      );

    case "rx_verify_dscsa":
      return verifyDscsa(
        args.serialized_data ?? {},
        args.trading_partner ?? "Unknown Pharmacy"
      );

    case "rx_check_formulary":
      return checkFormularyStatus(
        args.drug_id ?? "",
        args.insurance_plan ?? "plan-bcbs-national-ppo",
        args.state ?? "CA"
      );

    case "rx_wholesale_trade":
      return processWholesaleTrade(
        args.drug_id ?? "",
        args.seller ?? "",
        args.buyer ?? "",
        args.quantity ?? 1000,
        args.price_per_unit_usd ?? 10.00,
        args.currency ?? "USD"
      );

    case "rx_global_pricing":
      return calculateGlobalPricing(
        args.drug_id ?? "",
        args.countries ?? ["US","UK","DE","FR","JP","CA","AU","BR","IN","CN"]
      );

    case "rx_adverse_events":
      return monitorAdverseEvents(
        args.drug_id ?? "",
        args.report_type ?? "faers_query",
        args.region ?? "US"
      );

    case "rx_narcotic_audit":
      return auditNarcotics(
        args.dea_registrant_id ?? "",
        args.controlled_substances ?? [],
        args.period ?? "2025-Q1"
      );

    default:
      throw new Error(`Unknown pharma transaction tool: ${name}`);
  }
}
