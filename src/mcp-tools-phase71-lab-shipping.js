/**
 * HiveAgent MCP Tool Definitions — Phase 71
 *
 * Phase 71 — Laboratory Automation + Ocean Shipping Utilities
 *
 * Total new tools: 6
 */

import {
  labMasterMix,
  labPlateMap,
  labProtocolRunSheet,
} from "./services/laboratory-automation.js";

import {
  oceanEstimateContainerLoad,
  oceanShipmentChecklist,
  oceanLeadTimeWindow,
} from "./services/ocean-shipping.js";

export const phase71Tools = [
  // ── Laboratory Automation ────────────────────────────────────────────────
  {
    name: "lab_master_mix",
    description:
      "Compute a reagent master mix (total volumes) given per-reaction volumes, reaction count, and overage.",
    inputSchema: {
      type: "object",
      properties: {
        reactions: { type: "integer", description: "Number of reactions" },
        overage: { type: "number", description: "Extra fraction to prepare (e.g., 0.1 for 10%)", default: 0.1 },
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              per_reaction_ul: { type: "number" },
              notes: { type: "string" },
            },
            required: ["name", "per_reaction_ul"],
          },
        },
      },
      required: ["reactions", "components"],
    },
  },
  {
    name: "lab_plate_map",
    description:
      "Generate a sample/control plate map for a 96- or 384-well plate.",
    inputSchema: {
      type: "object",
      properties: {
        plate_type: { type: "string", enum: ["96", "384"], default: "96" },
        layout: { type: "string", enum: ["row", "column"], default: "row" },
        samples: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, metadata: { type: "object" } }, required: ["name"] },
        },
        controls: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, metadata: { type: "object" } }, required: ["name"] },
        },
      },
      required: ["samples"],
    },
  },
  {
    name: "lab_protocol_run_sheet",
    description:
      "Convert a list of lab protocol steps into a structured run sheet with total time and checkpoints.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        metadata: { type: "object" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              duration_min: { type: "number" },
              notes: { type: "string" },
              checkpoints: { type: "array", items: { type: "string" } },
            },
            required: ["action"],
          },
        },
      },
      required: ["steps"],
    },
  },

  // ── Ocean Shipping Utilities ─────────────────────────────────────────────
  {
    name: "ocean_estimate_container_load",
    description:
      "Estimate whether a set of items fits in a standard shipping container based on total volume (CBM) and weight (kg).",
    inputSchema: {
      type: "object",
      properties: {
        container_type: { type: "string", enum: ["20ft", "40ft", "40hc"], default: "40hc" },
        safety_margin: { type: "number", description: "Fractional margin to reserve (0 to 0.5)", default: 0.1 },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              units: { type: "number" },
              weight_kg: { type: "number" },
              volume_cbm: { type: "number" },
            },
            required: ["name", "units", "weight_kg", "volume_cbm"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "ocean_shipment_checklist",
    description:
      "Generate a planning checklist for an ocean freight shipment (docs, booking, customs, insurance).",
    inputSchema: {
      type: "object",
      properties: {
        incoterm: { type: "string", default: "FOB" },
        cargo_type: { type: "string", enum: ["general", "hazmat"], default: "general" },
        mode: { type: "string", enum: ["FCL", "LCL"], default: "FCL" },
        needs: { type: "array", items: { type: "string" }, description: "Flags like hazmat, msds, reefer, cold" },
      },
    },
  },
  {
    name: "ocean_lead_time_window",
    description:
      "Compute a basic lead-time window in days from origin cutoff through ocean transit and destination clearance.",
    inputSchema: {
      type: "object",
      properties: {
        origin_cutoff_days: { type: "number", default: 4 },
        ocean_transit_days: { type: "number", default: 24 },
        destination_clearance_days: { type: "number", default: 5 },
        buffer_days: { type: "number", default: 3 },
      },
    },
  },
];

export async function handlePhase71Tool(name, args) {
  switch (name) {
    case "lab_master_mix":
      return labMasterMix(args);
    case "lab_plate_map":
      return labPlateMap(args);
    case "lab_protocol_run_sheet":
      return labProtocolRunSheet(args);

    case "ocean_estimate_container_load":
      return oceanEstimateContainerLoad(args);
    case "ocean_shipment_checklist":
      return oceanShipmentChecklist(args);
    case "ocean_lead_time_window":
      return oceanLeadTimeWindow(args);

    default:
      throw new Error(`Unknown Phase 71 tool: ${name}`);
  }
}
