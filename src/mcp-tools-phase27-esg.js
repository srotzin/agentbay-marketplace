/**
 * Phase 27 (ESG & Sustainability Ops)
 *
 * Tools covering:
 *  - Carbon accounting estimation & inventory building
 *  - Supplier ESG risk scoring, questionnaires, and prioritization
 */

import {
  carbonEstimateEmissions,
  carbonBuildInventory,
  carbonGenerateDisclosure,
  carbonGetDefaultFactors,
} from "./services/carbon-accounting.js";

import {
  esgScoreSupplier,
  esgPrioritizeSuppliers,
  esgGenerateQuestionnaire,
  esgGetDefaultWeights,
} from "./services/supply-chain-esg.js";

export const phase27EsgTools = [
  {
    name: "carbon_estimate_emissions",
    description:
      "Estimate emissions (kgCO2e, tCO2e) for a single activity line item (electricity, fuel, flights, shipping). " +
      "Uses embedded default emission factors unless overridden."
    ,
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Activity category (e.g. electricity, diesel, flight_passenger_km)." },
        quantity: { type: "number", description: "Activity quantity in the specified unit." },
        unit: { type: "string", description: "Unit for the activity quantity (optional)." },
        factor_kgco2e_per_unit: { type: "number", description: "Override emission factor for this category." },
        factors: { type: "object", description: "Optional full factor map overriding defaults." },
      },
      required: ["category", "quantity"],
    },
  },
  {
    name: "carbon_build_inventory",
    description:
      "Build a lightweight carbon inventory from multiple activity line items (returns totals and per-line emissions).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent building the inventory." },
        org_name: { type: "string", description: "Organization name." },
        period_start: { type: "string", description: "Reporting period start (ISO date)." },
        period_end: { type: "string", description: "Reporting period end (ISO date)." },
        items: {
          type: "array",
          description: "Activity line items.",
          items: { type: "object" },
        },
      },
      required: ["agent_id", "org_name", "period_start", "period_end"],
    },
  },
  {
    name: "carbon_generate_disclosure",
    description:
      "Generate a basic disclosure artifact (JSON) from an inventory for internal reporting or draft compliance packs.",
    inputSchema: {
      type: "object",
      properties: {
        inventory: { type: "object", description: "Inventory from carbon_build_inventory." },
        framework: { type: "string", description: "Disclosure framework label (default: GHG Protocol)." },
        assurance: { type: "string", description: "Assurance level (default: none)." },
      },
      required: ["inventory"],
    },
  },
  {
    name: "carbon_get_default_factors",
    description: "Return the embedded default emission factors used by carbon tools (override for compliance use).",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "esg_score_supplier",
    description:
      "Score a supplier on ESG dimensions (labor, environment, governance, data privacy, human rights) and return a risk score.",
    inputSchema: {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Supplier legal name." },
        country_code: { type: "string", description: "ISO country code (optional)." },
        sector: { type: "string", description: "Supplier sector (optional)." },
        answers: { type: "object", description: "Dimension scores 0..1 where 1 is best." },
        weights: { type: "object", description: "Override weights (must roughly sum to 1)." },
      },
      required: ["supplier_name"],
    },
  },
  {
    name: "esg_prioritize_suppliers",
    description:
      "Prioritize suppliers for ESG outreach (sort by risk desc, then spend desc) and return top N.",
    inputSchema: {
      type: "object",
      properties: {
        suppliers: { type: "array", description: "Supplier objects accepted by esg_score_supplier.", items: { type: "object" } },
        top_n: { type: "number", description: "How many suppliers to return (default 10)." },
      },
    },
  },
  {
    name: "esg_generate_questionnaire",
    description:
      "Generate an ESG supplier questionnaire (questions grouped by focus areas).",
    inputSchema: {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Supplier name." },
        focus_areas: { type: "array", items: { type: "string" }, description: "Areas to include." },
      },
      required: ["supplier_name"],
    },
  },
  {
    name: "esg_get_default_weights",
    description: "Return default ESG scoring weights.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handlePhase27EsgTool(name, args) {
  switch (name) {
    case "carbon_estimate_emissions":
      return carbonEstimateEmissions(args);
    case "carbon_build_inventory":
      return carbonBuildInventory(args);
    case "carbon_generate_disclosure":
      return carbonGenerateDisclosure(args);
    case "carbon_get_default_factors":
      return carbonGetDefaultFactors();

    case "esg_score_supplier":
      return esgScoreSupplier(args);
    case "esg_prioritize_suppliers":
      return esgPrioritizeSuppliers(args);
    case "esg_generate_questionnaire":
      return esgGenerateQuestionnaire(args);
    case "esg_get_default_weights":
      return esgGetDefaultWeights();

    default:
      return null;
  }
}
