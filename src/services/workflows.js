/**
 * HiveAgent Composite Workflow Functions
 *
 * Each function abstracts an entire multi-step workflow into a single call,
 * aggregating results from multiple underlying service functions and returning
 * a complete, ready-to-use package. Saves agents 5-10 individual tool calls.
 */

import * as insuranceServices    from "./insurance-services.js";
import * as constructionServices from "./construction-services.js";
import * as legalServices        from "./legal-services.js";
import * as healthcareServices   from "./healthcare-services.js";
import * as smbServices          from "./smb-services.js";
import * as tradesServices       from "./trades-services.js";
import * as tradeCustoms         from "./trade-customs.js";
import * as agentHealth          from "./agent-health.js";
import * as agentHandoff         from "./agent-handoff.js";
import * as agentObservability   from "./agent-observability.js";
import * as commerceTrust        from "./commerce-trust.js";
import * as commerceOrchestration from "./commerce-orchestration.js";
import * as agricultureServices  from "./agriculture-services.js";
import * as travelBooking        from "./travel-booking.js";
import * as procurement          from "./procurement.js";
import * as salesCrm             from "./sales-crm.js";
import * as hrRecruiting         from "./hr-recruiting.js";
import * as fraudDetection       from "./fraud-detection.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumFees(...results) {
  let total = 0;
  for (const r of results) {
    if (r && typeof r === "object") {
      const fee = r.fee_usd ?? r.cost_usd ?? r.fee ?? r.cost ?? 0;
      total += Number(fee) || 0;
    }
  }
  return Math.round(total * 100) / 100;
}

function safe(fn, ...args) {
  try {
    return fn(...args);
  } catch (e) {
    return { error: e.message };
  }
}

// ─── 1. Full Insurance Claim ──────────────────────────────────────────────────

/**
 * processFullInsuranceClaim
 *
 * Runs the complete insurance claim pipeline in one call:
 *   claim intake → damage assessment → subrogation check → adjuster report
 *
 * @param {string} claimType        - "auto" | "property" | "liability" | "health" | "workers_comp"
 * @param {string} policyNumber     - Policyholder's policy number
 * @param {object} incidentDetails  - Free-form incident description object
 * @param {Array}  evidence         - Array of evidence items / photo descriptors
 * @returns {object} Complete claim package
 */
export function processFullInsuranceClaim(
  claimType = "auto",
  policyNumber = "",
  incidentDetails = {},
  evidence = []
) {
  const intake     = safe(insuranceServices.processClaimIntake,     claimType, policyNumber, incidentDetails, evidence);
  const claimId    = intake?.claim?.id ?? intake?.id ?? "claim-pending";
  const damageType = incidentDetails?.damage_type ?? claimType;
  const desc       = incidentDetails?.description ?? "";
  const location   = incidentDetails?.location    ?? "";

  const damage     = safe(insuranceServices.assessDamageFromDescription, damageType, desc, evidence.length, location);
  const subrog     = safe(insuranceServices.checkSubrogation,            claimId, incidentDetails);
  const report     = safe(insuranceServices.generateAdjusterReport,      claimId, { damage, subrogation: subrog }, evidence, []);

  const total_cost = sumFees(intake, damage, subrog, report);

  return {
    workflow: "full_insurance_claim",
    summary: `Complete insurance claim package for ${claimType} claim on policy ${policyNumber || "N/A"}.`,
    claim_intake:        intake,
    damage_assessment:   damage,
    subrogation_check:   subrog,
    adjuster_report:     report,
    total_cost_usd:      total_cost,
    recommended_actions: [
      "Review the adjuster report and confirm estimated loss values.",
      "If subrogation applies, notify the responsible third party.",
      "Submit the completed package to the carrier for settlement review.",
      "Call insurance_claims_analytics to benchmark against similar claims.",
    ],
  };
}

// ─── 2. Construction Project Setup ───────────────────────────────────────────

/**
 * fileConstructionProject
 *
 * Full construction project setup:
 *   zoning lookup → permit status → materials estimate → subcontractor match → draw schedule
 *
 * @param {string} address      - Project site address
 * @param {string} municipality - City / county name
 * @param {string} projectType  - e.g. "residential", "commercial", "addition"
 * @param {number} sqft         - Project square footage
 * @returns {object} Full project setup package
 */
export function fileConstructionProject(
  address = "",
  municipality = "",
  projectType = "residential",
  sqft = 1000
) {
  const zoning  = safe(constructionServices.lookupZoning,              address, municipality, projectType);
  const permit  = safe(constructionServices.trackPermitStatus,         `permit-${municipality}-${Date.now()}`, municipality);
  const mats    = safe(constructionServices.estimateMaterialTakeoff,   projectType, sqft, {});
  const sub     = safe(constructionServices.matchSubcontractor,        projectType, municipality, sqft > 3000 ? "large" : "medium", "");
  const schedule= safe(constructionServices.generateDrawSchedule,      mats?.total_cost ?? sqft * 150, [], {});

  const total_cost = sumFees(zoning, permit, mats, sub, schedule);

  return {
    workflow: "construction_project",
    summary: `Full project setup for ${sqft.toLocaleString()} sq ft ${projectType} at ${address}, ${municipality}.`,
    zoning_info:          zoning,
    permit_status:        permit,
    materials_estimate:   mats,
    subcontractor_match:  sub,
    draw_schedule:        schedule,
    total_cost_usd:       total_cost,
    recommended_actions: [
      "Confirm zoning compliance before breaking ground.",
      "Pull the official permit using construction_permit_status once submitted.",
      "Order materials per the takeoff to stay on the draw schedule.",
      "Schedule subcontractor kick-off meeting aligned with milestone 1.",
    ],
  };
}

// ─── 3. Legal Case Setup ──────────────────────────────────────────────────────

/**
 * runLegalCaseSetup
 *
 * Complete legal case intake pipeline:
 *   case intake → medical records summary → deadline tracking → case law search
 *
 * @param {string} practiceArea         - e.g. "personal_injury", "contract", "employment"
 * @param {object} clientInfo           - Client contact and background info
 * @param {string} caseDescription      - Narrative description of the case
 * @param {number} medicalRecordsPages  - Total pages of medical records to summarize
 * @returns {object} Complete case file
 */
export function runLegalCaseSetup(
  practiceArea = "personal_injury",
  clientInfo = {},
  caseDescription = "",
  medicalRecordsPages = 0
) {
  const intake    = safe(legalServices.intakeCase,              practiceArea, clientInfo, caseDescription);
  const caseId    = intake?.case?.id ?? intake?.id ?? "case-pending";
  const records   = medicalRecordsPages > 0
    ? safe(legalServices.summarizeMedicalRecords, [], medicalRecordsPages, [])
    : { skipped: true, reason: "No medical records provided" };
  const deadlines = safe(legalServices.trackDeadlines,          caseId, clientInfo?.state ?? "CA", practiceArea);
  const caseLaw   = safe(legalServices.searchCaseLaw,           caseDescription.slice(0, 120), clientInfo?.state ?? "CA", practiceArea, 5);

  const total_cost = sumFees(intake, records, deadlines, caseLaw);

  return {
    workflow: "legal_case_setup",
    summary: `Complete ${practiceArea} case file for ${clientInfo?.name ?? "client"}.`,
    case_intake:       intake,
    medical_summary:   records,
    deadline_tracking: deadlines,
    case_law_results:  caseLaw,
    total_cost_usd:    total_cost,
    recommended_actions: [
      "Review statute of limitations from the deadline tracker — these are hard cutoffs.",
      "Use top case law citations in your demand letter via legal_demand_letter.",
      "Request any outstanding medical records before drafting settlement demand.",
      "Schedule client review of case summary within 5 business days.",
    ],
  };
}

// ─── 4. Healthcare Encounter ──────────────────────────────────────────────────

/**
 * processHealthcareEncounter
 *
 * Complete encounter documentation pipeline:
 *   prior auth → clinical note → claim codes → compliance check
 *
 * @param {string} encounterType     - e.g. "office_visit", "telehealth", "procedure"
 * @param {Array}  symptoms          - List of patient symptom strings
 * @param {object} findings          - Physical/clinical findings
 * @param {string} insuranceProvider - Payer name (e.g. "BlueCross")
 * @param {string} procedureCode     - CPT code of the planned procedure
 * @returns {object} Complete encounter documentation
 */
export function processHealthcareEncounter(
  encounterType = "office_visit",
  symptoms = [],
  findings = {},
  insuranceProvider = "",
  procedureCode = ""
) {
  const auth       = safe(healthcareServices.checkPriorAuth,        insuranceProvider, procedureCode, { encounter_type: encounterType });
  const note       = safe(healthcareServices.generateClinicalNote,  encounterType, symptoms, findings, findings?.assessment ?? "", findings?.plan ?? "");
  const diagnosis  = findings?.diagnosis ?? symptoms[0] ?? "unspecified";
  const codes      = safe(healthcareServices.suggestClaimCodes,     diagnosis, procedureCode ? [procedureCode] : [], []);
  const compliance = safe(healthcareServices.getHealthcareCompliance, "document_encounter", "hipaa");

  const total_cost = sumFees(auth, note, codes, compliance);

  return {
    workflow: "healthcare_encounter",
    summary: `Complete documentation for ${encounterType} encounter with ${insuranceProvider || "unspecified payer"}.`,
    prior_auth:     auth,
    clinical_note:  note,
    claim_codes:    codes,
    compliance:     compliance,
    total_cost_usd: total_cost,
    recommended_actions: [
      "Confirm prior auth approval before performing the procedure.",
      "Attach the clinical note to the claim submission package.",
      "Verify ICD-10 and CPT codes from claim_codes match the auth approval.",
      "Run health_interpret_labs if lab work was ordered during this encounter.",
    ],
  };
}

// ─── 5. Small Business Setup ──────────────────────────────────────────────────

/**
 * setupSmallBusiness
 *
 * Complete small business setup:
 *   license check → insurance comparison → contract templates → tax prep → dashboard
 *
 * @param {string} businessType - e.g. "LLC", "sole_proprietor", "S-Corp"
 * @param {string} state        - Two-letter US state code
 * @param {string} city         - City name
 * @returns {object} Complete business setup guide
 */
export function setupSmallBusiness(
  businessType = "LLC",
  state = "CA",
  city = ""
) {
  const licenses   = safe(smbServices.checkLicenseRenewals,    businessType, state, city, []);
  const insurance  = safe(smbServices.compareInsurancePlans,   businessType, 1, state, ["BOP", "GL"]);
  const contract   = safe(smbServices.generateContract,         "service_agreement", [{ role: "provider" }, { role: "client" }], { state });
  const taxPrep    = safe(smbServices.prepTaxDocuments,         businessType, [], new Date().getFullYear().toString(), state);
  const dashboard  = safe(smbServices.getSmbDashboard,          `${businessType}-${state}-${Date.now()}`);

  const total_cost = sumFees(licenses, insurance, contract, taxPrep);

  return {
    workflow: "small_business_setup",
    summary: `Complete setup guide for ${businessType} in ${city || state}.`,
    license_requirements: licenses,
    insurance_options:    insurance,
    contract_template:    contract,
    tax_prep_info:        taxPrep,
    dashboard:            dashboard,
    total_cost_usd:       total_cost,
    recommended_actions: [
      "Apply for all required licenses before opening for business.",
      "Choose an insurance plan and bind coverage — many contracts require proof of insurance.",
      "Customise the service agreement template for your first client.",
      "Set up bookkeeping categories with smb_categorize_transaction to make tax season easy.",
    ],
  };
}

// ─── 6. Trades Job ────────────────────────────────────────────────────────────

/**
 * executeTradesJob
 *
 * Full job pipeline for tradespeople:
 *   permits → estimate → parts → code compliance → invoice
 *
 * @param {string} tradeType     - e.g. "electrical", "plumbing", "HVAC", "roofing"
 * @param {string} municipality  - Permit jurisdiction
 * @param {string} jobDescription- Description of the work to be performed
 * @param {string} location      - Physical job site location
 * @returns {object} Complete job package
 */
export function executeTradesJob(
  tradeType = "general",
  municipality = "",
  jobDescription = "",
  location = ""
) {
  const permits    = safe(tradesServices.lookupPermitRequirements, municipality, tradeType, jobDescription);
  const estimate   = safe(tradesServices.estimateJobFromDescription, tradeType, jobDescription, location, "residential");
  const parts      = safe(tradesServices.findParts,                  jobDescription, "standard", location);
  const code       = safe(tradesServices.checkCodeCompliance,        municipality || location, tradeType, jobDescription);
  const invoice    = safe(tradesServices.generateInvoice,
    { trade: tradeType, description: jobDescription, location },
    estimate?.labor_hours ?? 4,
    parts?.parts?.slice(0, 3) ?? [],
    0.08
  );

  const total_cost = sumFees(permits, estimate, parts, code, invoice);

  return {
    workflow: "trades_job",
    summary: `Complete ${tradeType} job package for: ${jobDescription.slice(0, 80)}.`,
    permit_requirements: permits,
    job_estimate:        estimate,
    parts_sourcing:      parts,
    code_compliance:     code,
    invoice:             invoice,
    total_cost_usd:      total_cost,
    recommended_actions: [
      "Pull the required permit before starting work.",
      "Order parts from the top supplier returned by trades_find_parts.",
      "Confirm code compliance findings with the local AHJ if there is any ambiguity.",
      "Send the invoice to the customer upon job completion.",
    ],
  };
}

// ─── 7. International Shipment ────────────────────────────────────────────────

/**
 * processInternationalShipment
 *
 * Full international trade compliance pipeline:
 *   HS classify → sanctions screen → duty calc → customs docs → export controls
 *
 * @param {string} product        - Product description
 * @param {string} originCountry  - Two-letter ISO origin country code
 * @param {string} destCountry    - Two-letter ISO destination country code
 * @param {number} value          - Declared value in USD
 * @returns {object} Complete shipping package
 */
export function processInternationalShipment(
  product = "",
  originCountry = "US",
  destCountry = "GB",
  value = 0
) {
  const hsResult   = safe(tradeCustoms.classifyHsCode,      product, originCountry, destCountry);
  const hsCode     = hsResult?.hs_code ?? hsResult?.classifications?.[0]?.hs_code ?? "000000";
  const sanctions  = safe(tradeCustoms.screenSanctions,     destCountry, "country", [destCountry]);
  const duty       = safe(tradeCustoms.calculateDuty,        hsCode, originCountry, destCountry, value, 1);
  const customs    = safe(tradeCustoms.generateCustomsDocs,  { product, value, quantity: 1 }, hsCode, originCountry, destCountry);
  const export_ctl = safe(tradeCustoms.checkExportControls,  product, destCountry, "commercial");

  const total_cost = sumFees(hsResult, sanctions, duty, customs, export_ctl);

  return {
    workflow: "international_shipment",
    summary: `Complete shipping package for ${product} from ${originCountry} to ${destCountry}, value $${value.toLocaleString()}.`,
    hs_classification:  hsResult,
    sanctions_check:    sanctions,
    duty_calculation:   duty,
    customs_documents:  customs,
    export_controls:    export_ctl,
    total_cost_usd:     total_cost,
    recommended_actions: [
      "Confirm HS code with a licensed customs broker if classification is ambiguous.",
      "Do not ship if sanctions_check returns any matches — consult legal counsel.",
      "Include duty amounts in final pricing to avoid unexpected costs at destination.",
      "Retain customs documents for at least 5 years per import/export record-keeping rules.",
    ],
  };
}

// ─── 8. Agent Monitoring Setup ────────────────────────────────────────────────

/**
 * deployAgentMonitoring
 *
 * Deploys a complete monitoring stack for a multi-agent workflow:
 *   register endpoints → health checks → create handoff protocol → start trace
 *
 * @param {string[]} endpointUrls - Array of agent endpoint URLs to monitor
 * @param {string}   workflowId   - Unique identifier for the workflow being monitored
 * @returns {object} Complete monitoring setup
 */
export function deployAgentMonitoring(
  endpointUrls = [],
  workflowId = `wf-${Date.now()}`
) {
  const registrations = endpointUrls.map((url, i) =>
    safe(agentHealth.registerEndpoint, `agent-${i}`, url, 60)
  );

  const healthChecks = endpointUrls.map((url) =>
    safe(agentHealth.checkHealth, url, 5000)
  );

  const protocol = safe(agentHandoff.createHandoffProtocol,
    workflowId,
    endpointUrls.map((url, i) => ({ stage: i + 1, agent_url: url })),
    ["context", "state", "task_id"]
  );

  const trace = safe(agentObservability.startTrace,
    workflowId,
    endpointUrls[0] ?? "orchestrator",
    { endpoint_count: endpointUrls.length }
  );

  const total_cost = sumFees(protocol, trace);

  return {
    workflow: "agent_monitoring",
    summary: `Monitoring deployed for workflow ${workflowId} across ${endpointUrls.length} endpoint(s).`,
    registrations,
    health_checks:    healthChecks,
    handoff_protocol: protocol,
    trace:            trace,
    total_cost_usd:   total_cost,
    recommended_actions: [
      "Store the trace_id for debugging — attach it to every span with recovery_start_trace.",
      "Set alert thresholds using recovery_circuit_status to auto-trip on repeated failures.",
      "Add hallucination detection to critical steps with recovery_detect_hallucination.",
      "Review the handoff protocol stages before going live.",
    ],
  };
}

// ─── 9. Commerce Transaction ──────────────────────────────────────────────────

/**
 * runCommerceTransaction
 *
 * Safe end-to-end commerce transaction pipeline:
 *   verify product → merchant trust → detect manipulation → create purchase order → risk assessment
 *
 * @param {string} productUrl     - URL of the product to purchase
 * @param {string} merchantDomain - Merchant's primary domain
 * @param {Array}  items          - Array of item objects { product_id, quantity, price_usd }
 * @param {object} shippingAddress- Shipping destination
 * @returns {object} Safe purchase package
 */
export function runCommerceTransaction(
  productUrl = "",
  merchantDomain = "",
  items = [],
  shippingAddress = {}
) {
  const verification  = safe(commerceTrust.verifyProduct,         productUrl, [], "general");
  const merchantTrust = safe(commerceTrust.getMerchantTrustScore,  merchantDomain, merchantDomain);
  const manipulation  = safe(commerceTrust.detectManipulation,     productUrl, "purchase intent");
  const purchaseOrder = safe(commerceOrchestration.createPurchaseOrder,
    items,
    { domain: merchantDomain },
    "usdc",
    shippingAddress
  );
  const risk          = safe(commerceTrust.getCommerceRiskAssessment, {
    product_url: productUrl,
    merchant:    merchantDomain,
    items,
    shipping:    shippingAddress,
  });

  const total_cost = sumFees(verification, merchantTrust, manipulation, purchaseOrder, risk);

  // Determine overall safety signal
  const isSafe =
    !verification?.error &&
    !merchantTrust?.error &&
    (merchantTrust?.trust_score ?? 70) >= 50 &&
    !manipulation?.manipulation_detected;

  return {
    workflow: "commerce_transaction",
    summary: `Commerce transaction package for ${productUrl.slice(0, 60)} via ${merchantDomain}.`,
    product_verification: verification,
    merchant_trust:       merchantTrust,
    manipulation_check:   manipulation,
    purchase_order:       purchaseOrder,
    risk_assessment:      risk,
    safety_signal:        isSafe ? "SAFE_TO_PROCEED" : "REVIEW_REQUIRED",
    total_cost_usd:       total_cost,
    recommended_actions: isSafe
      ? [
          "Proceed with payment — all signals are green.",
          "Track delivery with commerce_track_purchase using the order ID.",
          "Save the purchase receipt for dispute protection.",
        ]
      : [
          "Do not complete the purchase until safety issues are resolved.",
          "Review manipulation_check findings for specific dark pattern details.",
          "If merchant trust is low, search for an alternative supplier.",
        ],
  };
}

// ─── 10. Crop Season Assessment ───────────────────────────────────────────────

/**
 * assessCropSeason
 *
 * Complete season planning pipeline:
 *   crop issue ID → yield forecast → commodity alerts → soil analysis → compliance
 *
 * @param {string} cropType    - Crop name (e.g. "corn", "soybeans", "wheat")
 * @param {number} acreage     - Total planted acreage
 * @param {string} location    - Farm location (city, state or coordinates)
 * @param {object} soilMetrics - Soil test results object
 * @returns {object} Complete season plan
 */
export function assessCropSeason(
  cropType = "corn",
  acreage = 100,
  location = "",
  soilMetrics = {}
) {
  const issues      = safe(agricultureServices.identifyCropIssue,  cropType, ["general_assessment"], location, "summer");
  const yieldFcast  = safe(agricultureServices.forecastYield,      cropType, acreage, location, new Date().toISOString().split("T")[0], {});
  const alerts      = safe(agricultureServices.getCommodityAlerts, [cropType], {});
  const soil        = Object.keys(soilMetrics).length > 0
    ? safe(agricultureServices.analyzeSoilReport, soilMetrics, cropType, location)
    : { skipped: true, reason: "No soil metrics provided" };
  const compliance  = safe(agricultureServices.checkAgCompliance,  "crop_farm", location.split(",").pop()?.trim() || "CA", ["pesticides", "water_usage"]);

  const total_cost = sumFees(issues, yieldFcast, alerts, soil, compliance);

  return {
    workflow: "crop_season",
    summary: `Complete season plan for ${acreage.toLocaleString()} acres of ${cropType} at ${location || "unspecified location"}.`,
    crop_issues:        issues,
    yield_forecast:     yieldFcast,
    commodity_alerts:   alerts,
    soil_analysis:      soil,
    compliance_status:  compliance,
    total_cost_usd:     total_cost,
    recommended_actions: [
      "Address any crop issues identified before planting or early in the season.",
      "Use the yield forecast to set commodity hedge targets.",
      "Act on commodity alerts — set price floors with your broker.",
      "Apply soil amendment recommendations before the next planting cycle.",
      "File any required compliance reports before state deadlines.",
    ],
  };
}

// ─── 11. Book Full Trip ────────────────────────────────────────────────────────────────

/**
 * bookFullTrip
 *
 * End-to-end travel booking pipeline in one call:
 *   flights + hotel + car rental + restaurants + itinerary + visa requirements
 *
 * @param {string} destination  - Trip destination (city or region)
 * @param {string} startDate    - Trip start date (ISO 8601)
 * @param {string} endDate      - Trip end date (ISO 8601)
 * @param {number} budget       - Total trip budget in USD
 * @param {number} travelers    - Number of travelers
 * @returns {object} Complete travel package
 */
export function bookFullTrip(
  destination = "",
  startDate = "",
  endDate = "",
  budget = 3000,
  travelers = 1
) {
  const flights      = safe(travelBooking.searchFlights,        "ANY", destination, startDate, endDate, travelers, "economy", false);
  const hotels       = safe(travelBooking.searchHotels,         destination, startDate, endDate, travelers, 1, 3, Math.round(budget * 0.4 / Math.max(1, travelers)));
  const carRentals   = safe(travelBooking.compareCarRentals,    destination, startDate, endDate, "economy");
  const restaurants  = safe(travelBooking.searchRestaurants,    destination, null, travelers, null, null);
  const itinerary    = safe(travelBooking.buildItinerary,       destination, startDate, endDate, budget, { travelers });
  const visa         = safe(travelBooking.getVisaRequirements,  "US", destination, "tourism", 14);

  const total_cost = sumFees(flights, hotels, carRentals);

  return {
    workflow: "book_full_trip",
    summary: `Complete travel package to ${destination || "your destination"} for ${travelers} traveler${travelers !== 1 ? "s" : ""} (${startDate} – ${endDate}).`,
    flights,
    hotels,
    car_rentals:        carRentals,
    restaurant_options: restaurants,
    itinerary,
    visa_requirements:  visa,
    total_cost_usd:     total_cost,
    recommended_actions: [
      "Review flight options and book your preferred choice with travel_book_flight.",
      "Reserve your hotel room with travel_book_hotel before availability changes.",
      "Check visa requirements and allow sufficient processing time.",
      "Reserve restaurant tables in advance for popular dining spots.",
      "Download your itinerary and share with all travelers.",
    ],
  };
}

// ─── 12. Run Procurement Cycle ────────────────────────────────────────────────────────

/**
 * runProcurementCycle
 *
 * Full sourcing-to-contract pipeline in one call:
 *   supplier discovery + RFQ + bid evaluation + contract draft + invoice matching
 *
 * @param {string} category      - Category of goods or services to source
 * @param {object} requirements  - Specification and compliance requirements
 * @param {number} budget        - Maximum budget for the purchase in USD
 * @returns {object} Complete procurement package
 */
export function runProcurementCycle(
  category = "",
  requirements = {},
  budget = 0
) {
  const suppliers    = safe(procurement.discoverSuppliers,  category, requirements, null, []);
  const topSupplierId = suppliers?.suppliers?.[0]?.id ?? suppliers?.results?.[0]?.id ?? "supplier-pending";

  const rfqItems     = [{ description: category, quantity: requirements.quantity ?? 1, unit: requirements.unit ?? "unit", specifications: requirements }];
  const rfq          = safe(procurement.createRfq,         category + " RFQ", rfqItems, requirements, null, []);
  const rfqId        = rfq?.rfq_id ?? rfq?.id ?? "rfq-pending";

  const bids         = safe(procurement.evaluateBids,      rfqId, {}, {});
  const contract     = safe(procurement.draftContract,     topSupplierId, { budget_usd: budget, ...requirements }, rfqItems, {});
  const invoiceMatch = safe(procurement.matchInvoice,      { vendor: category, total_amount: budget, line_items: rfqItems }, rfqId);

  const total_cost = sumFees(rfq, bids, contract);

  return {
    workflow: "procurement_cycle",
    summary: `Complete procurement cycle for "${category}" with a budget of $${budget.toLocaleString()}.`,
    supplier_discovery: suppliers,
    rfq,
    bid_evaluation:    bids,
    contract,
    invoice_match:     invoiceMatch,
    total_cost_usd:    total_cost,
    recommended_actions: [
      "Review the ranked supplier list and confirm you want to proceed with the top candidate.",
      "Send the generated RFQ to invited suppliers and set a response deadline.",
      "Use the bid scorecard to negotiate final terms before signing.",
      "Collect e-signatures on the contract draft before placing the order.",
      "Run invoice_three_way_match when the supplier invoice arrives.",
    ],
  };
}

// ─── 13. Process Full Sales Cycle ─────────────────────────────────────────────────────

/**
 * processFullSalesCycle
 *
 * Prospect-to-meeting pipeline in one call:
 *   lead enrichment + scoring + outreach generation + meeting scheduling + pipeline forecast
 *
 * @param {string} companyName   - Target company name
 * @param {string} contactName   - Primary contact's name
 * @param {string} email         - Contact's email address
 * @param {string} campaign      - Campaign name or objective
 * @returns {object} Complete sales cycle package
 */
export function processFullSalesCycle(
  companyName = "",
  contactName = "",
  email = "",
  campaign = "outbound"
) {
  const enriched     = safe(salesCrm.enrichLead,         companyName, contactName, email);
  const scored       = safe(salesCrm.scoreLead,          enriched ?? { company: companyName, contact: contactName, email }, {});
  const outreach     = safe(salesCrm.generateOutreach,   enriched ?? { company: companyName }, campaign, "professional", []);
  const meeting      = safe(salesCrm.scheduleMeeting,    email, {}, [], 30, `Discovery call re: ${campaign}`);
  const forecast     = safe(salesCrm.forecastPipeline,   [{ deal_id: `deal-${companyName.replace(/\s+/g, "-").toLowerCase()}`, stage: "discovery", amount: scored?.estimated_deal_size ?? 0, close_date: "", probability: scored?.conversion_probability ?? 0.1 }], {});

  const total_cost = sumFees(enriched, scored, outreach, meeting);

  return {
    workflow: "full_sales_cycle",
    summary: `Complete sales cycle initiated for ${contactName || "contact"} at ${companyName || "company"} (campaign: ${campaign}).`,
    lead_enrichment:   enriched,
    lead_score:        scored,
    outreach_sequence: outreach,
    meeting_booking:   meeting,
    pipeline_forecast: forecast,
    total_cost_usd:    total_cost,
    recommended_actions: [
      "Send the generated outreach sequence and monitor open rates.",
      "Confirm the meeting booking and review the pre-meeting briefing.",
      "Tailor your pitch based on the enriched firmographic data.",
      "Log call notes in your CRM after the discovery call.",
      "Update deal stage to move the pipeline forecast forward.",
    ],
  };
}

// ─── 14. Screen and Hire ────────────────────────────────────────────────────────────

/**
 * screenAndHire
 *
 * Full recruiting pipeline in one call:
 *   resume screening + candidate matching + interview questions + comp check + onboarding
 *
 * @param {object} jobRequirements  - Job requirements and must-have skills
 * @param {Array}  resumeTexts      - Array of resume text strings to screen
 * @param {object} compensation     - Compensation object with title, location, and experience
 * @returns {object} Complete hiring package
 */
export function screenAndHire(
  jobRequirements = {},
  resumeTexts = [],
  compensation = {}
) {
  const requirements  = Array.isArray(jobRequirements.skills) ? jobRequirements.skills : [jobRequirements.description ?? "qualified candidate"];
  const mustHave      = Array.isArray(jobRequirements.must_have) ? jobRequirements.must_have : [];
  const roleType      = jobRequirements.role ?? jobRequirements.title ?? "Open Role";

  const screened      = resumeTexts.map((text, i) =>
    safe(hrRecruiting.screenResume, text, requirements, mustHave)
  );

  const jobId         = jobRequirements.job_id ?? `job-${roleType.replace(/\s+/g, "-").toLowerCase()}`;
  const candidatePool = screened.map((result, i) => ({ candidate_id: `candidate-${i + 1}`, screening: result }));
  const matched       = safe(hrRecruiting.matchCandidates, jobId, candidatePool, {});

  const interviewQs   = safe(hrRecruiting.generateInterviewQuestions, roleType, compensation.experience ?? "mid", requirements, ["behavioral", "technical"]);
  const compCheck     = safe(hrRecruiting.checkCompensation, compensation.title ?? roleType, compensation.location ?? "US", compensation.experience ?? "mid", compensation.industry ?? "tech");

  const topCandidate  = matched?.ranked_candidates?.[0] ?? matched?.shortlist?.[0] ?? {};
  const onboarding    = Object.keys(topCandidate).length > 0
    ? safe(hrRecruiting.automateOnboarding, { name: topCandidate.name ?? "Selected Candidate", role: roleType, ...topCandidate }, jobRequirements.department ?? "Engineering", new Date().toISOString().split("T")[0])
    : { skipped: true, reason: "No top candidate identified yet" };

  const total_cost = sumFees(...screened, matched, interviewQs, compCheck);

  return {
    workflow: "screen_and_hire",
    summary: `Complete hiring pipeline for ${roleType}: screened ${resumeTexts.length} resume${resumeTexts.length !== 1 ? "s" : ""}, matched candidates, and prepared onboarding.`,
    resume_screenings:    screened,
    candidate_matches:    matched,
    interview_questions:  interviewQs,
    compensation_check:   compCheck,
    onboarding_plan:      onboarding,
    total_cost_usd:       total_cost,
    recommended_actions: [
      "Review the ranked candidate shortlist and select your top 3 for interviews.",
      "Send the structured interview guide to your hiring panel.",
      "Use the compensation benchmark to craft a competitive offer.",
      "Kick off onboarding as soon as the offer is accepted.",
      "Track time-to-fill and offer acceptance rate in hr_recruiting_dashboard.",
    ],
  };
}

// ─── 15. Full Fraud Check ───────────────────────────────────────────────────────────

/**
 * fullFraudCheck
 *
 * Comprehensive fraud assessment pipeline in one call:
 *   transaction screening + anomaly detection + identity check + chargeback prediction + network analysis
 *
 * @param {object} transactionData  - Transaction details (amount, currency, merchant, payment_method, etc.)
 * @param {object} userProfile      - User/account profile for behavioral context
 * @returns {object} Complete fraud assessment package
 */
export function fullFraudCheck(
  transactionData = {},
  userProfile = {}
) {
  const screening     = safe(fraudDetection.screenTransaction,   transactionData, userProfile);
  const anomalies     = safe(fraudDetection.detectAnomalies,     userProfile.account_id ?? transactionData.account_id ?? "unknown", [], "30d");
  const identity      = safe(fraudDetection.checkIdentity,       { name: userProfile.name, email: userProfile.email, dob: userProfile.dob, address: userProfile.address }, "standard");
  const chargeback    = safe(fraudDetection.predictChargeback,   transactionData, {});
  const network       = safe(fraudDetection.analyzeNetwork,      userProfile.account_id ?? transactionData.account_id ?? transactionData.device_id ?? "unknown", 2);

  const riskScores    = [
    screening?.risk_score ?? 0,
    anomalies?.anomaly_score  ?? 0,
    identity?.confidence_inverse ?? (100 - (identity?.confidence ?? 100)),
    chargeback?.chargeback_probability ? chargeback.chargeback_probability * 100 : 0,
    network?.network_risk_score ?? 0,
  ].filter(s => typeof s === "number");

  const compositeRisk = riskScores.length > 0
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : 0;

  const recommendation = compositeRisk >= 70 ? "DECLINE" : compositeRisk >= 40 ? "REVIEW" : "APPROVE";
  const total_cost = sumFees(screening, anomalies, identity, chargeback, network);

  return {
    workflow: "full_fraud_check",
    summary: `Comprehensive fraud assessment for transaction of ${transactionData.currency ?? "USD"} ${transactionData.amount ?? "unknown amount"} — composite risk: ${compositeRisk}/100 (${recommendation}).`,
    transaction_screening: screening,
    anomaly_detection:     anomalies,
    identity_check:        identity,
    chargeback_prediction: chargeback,
    network_analysis:      network,
    composite_risk_score:  compositeRisk,
    recommendation,
    total_cost_usd:        total_cost,
    recommended_actions: [
      compositeRisk >= 70 ? "Decline the transaction and notify the customer." : "Approve the transaction after manual review.",
      "Flag the account for enhanced monitoring if anomalies were detected.",
      "Run fraud_check_identity at a higher verification level if identity confidence is low.",
      "Investigate any network clusters identified for coordinated fraud.",
      "Update fraud rules based on the pattern signature returned.",
    ],
  };
}
