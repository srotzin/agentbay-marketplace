/**
 * HiveAgent MCP Tool Definitions — Phase 74
 *
 * Phase 74 — Forestry Operations + Water Treatment Operations
 *
 * Total new tools: 6
 */

import {
  forestryStandVolumeEstimate,
  forestryHarvestSchedule,
  forestryComplianceChecklist,
} from "./services/forestry-operations.js";

import {
  waterChlorineDoseCalculator,
  waterCoagulantDoseEstimate,
  waterOperatorShiftChecklist,
} from "./services/water-treatment-operations.js";

export const phase74Tools = [
  // ── Forestry Operations ───────────────────────────────────────────────────
  {
    name: "forestry_stand_volume_estimate",
    description:
      "Estimate stand volume (m³/ha) from basal area, mean height, and a form factor.",
    inputSchema: {
      type: "object",
      properties: {
        basal_area_m2_per_ha: { type: "number", description: "Basal area (m²/ha)" },
        mean_height_m: { type: "number", description: "Mean dominant height (m)" },
        form_factor: { type: "number", default: 0.45, description: "Dimensionless form factor" },
      },
      required: ["basal_area_m2_per_ha", "mean_height_m"],
    },
  },
  {
    name: "forestry_harvest_schedule",
    description:
      "Suggest a harvest entry schedule and rough economics given stand volume and assumptions.",
    inputSchema: {
      type: "object",
      properties: {
        objective: {
          type: "string",
          default: "revenue",
          enum: ["revenue", "fuel_break", "habitat", "carbon"],
        },
        area_ha: { type: "number" },
        stand_volume_m3_per_ha: { type: "number" },
        removal_fraction: { type: "number", default: 0.3 },
        years_between_entries: { type: "number", default: 10 },
        market_price_per_m3: { type: "number", description: "Optional" },
        harvest_cost_per_m3: { type: "number", description: "Optional" },
      },
      required: ["area_ha", "stand_volume_m3_per_ha"],
    },
  },
  {
    name: "forestry_compliance_checklist",
    description:
      "Generate a compliance checklist for forestry operations (buffers, roads, safety, burning).",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: { type: "string", default: "unknown" },
        operation: { type: "string", default: "harvest" },
        near_water: { type: "boolean", default: false },
        mechanized_equipment: { type: "boolean", default: true },
        burning: { type: "boolean", default: false },
      },
    },
  },

  // ── Water Treatment Operations ────────────────────────────────────────────
  {
    name: "water_chlorine_dose_calculator",
    description:
      "Convert flow and dose (mg/L) into chlorine mass per day, plus a simple solution-strength estimate.",
    inputSchema: {
      type: "object",
      properties: {
        flow_m3_per_day: { type: "number" },
        target_dose_mg_per_l: { type: "number" },
        demand_mg_per_l: { type: "number", default: 0 },
        solution_strength_percent: { type: "number", default: 12.5 },
      },
      required: ["flow_m3_per_day", "target_dose_mg_per_l"],
    },
  },
  {
    name: "water_coagulant_dose_estimate",
    description:
      "Estimate an alum dose (mg/L) from influent/target turbidity using a rough heuristic.",
    inputSchema: {
      type: "object",
      properties: {
        influent_turbidity_ntu: { type: "number" },
        target_turbidity_ntu: { type: "number", default: 1 },
        base_dose_mg_per_l: { type: "number", default: 10 },
        mg_per_l_per_ntu: { type: "number", default: 1.5 },
        max_dose_mg_per_l: { type: "number", default: 80 },
      },
      required: ["influent_turbidity_ntu"],
    },
  },
  {
    name: "water_operator_shift_checklist",
    description:
      "Generate a shift checklist for drinking water or wastewater treatment operations.",
    inputSchema: {
      type: "object",
      properties: {
        plant_type: { type: "string", default: "drinking_water", enum: ["drinking_water", "wastewater"] },
        disinfection: { type: "string", default: "chlorine", enum: ["chlorine", "chloramine", "uv", "ozone"] },
        includes_filtration: { type: "boolean", default: true },
        includes_sludge_handling: { type: "boolean", default: false },
      },
    },
  },
];

export async function handlePhase74Tool(name, args) {
  switch (name) {
    case "forestry_stand_volume_estimate":
      return forestryStandVolumeEstimate(args);
    case "forestry_harvest_schedule":
      return forestryHarvestSchedule(args);
    case "forestry_compliance_checklist":
      return forestryComplianceChecklist(args);

    case "water_chlorine_dose_calculator":
      return waterChlorineDoseCalculator(args);
    case "water_coagulant_dose_estimate":
      return waterCoagulantDoseEstimate(args);
    case "water_operator_shift_checklist":
      return waterOperatorShiftChecklist(args);

    default:
      throw new Error(`Unknown Phase 74 tool: ${name}`);
  }
}
