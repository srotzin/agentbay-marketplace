/**
 * HiveAgent MCP Tool Definitions — Phase 73
 *
 * Phase 73 — Waste Management + Deathcare Operations
 *
 * Total new tools: 7
 */

import {
  wasteRoutePlanner,
  wasteContainerSizing,
  recyclingContaminationCheck,
  diversionMetrics,
} from "./services/waste-management.js";

import {
  funeralServiceChecklist,
  funeralPricingEstimate,
  obituaryDraft,
} from "./services/deathcare-operations.js";

export const phase73Tools = [
  // ── Waste Management ─────────────────────────────────────────────────────
  {
    name: "waste_route_planner",
    description:
      "Create a waste collection route plan (heuristic ordering) and validate capacity/time constraints.",
    inputSchema: {
      type: "object",
      properties: {
        depot: { type: "object", description: "Optional depot metadata (name/address)" },
        average_stop_minutes: { type: "number", default: 8 },
        truck_capacity_volume: { type: "number", description: "Truck capacity by volume (optional)" },
        truck_capacity_weight: { type: "number", description: "Truck capacity by weight (optional)" },
        max_route_minutes: { type: "number", default: 480 },
        stops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              address: { type: "string" },
              volume: { type: "number", default: 0 },
              weight: { type: "number", default: 0 },
              service_minutes: { type: "number" },
              priority: { type: "string", default: "normal", enum: ["normal", "high"] },
            },
          },
        },
      },
      required: ["stops"],
    },
  },
  {
    name: "waste_container_sizing",
    description:
      "Estimate number of dumpsters/bins required given daily volume, pickup cadence, and compaction.",
    inputSchema: {
      type: "object",
      properties: {
        daily_volume: { type: "number", description: "Daily waste volume (same unit as container_volume)" },
        days_between_pickups: { type: "number", default: 7 },
        compaction_ratio: {
          type: "number",
          default: 1,
          description: "Effective compaction ratio (e.g., 2 means half the volume after compaction)",
        },
        container_volume: { type: "number", default: 8 },
        safety_factor: { type: "number", default: 1.15 },
      },
      required: ["daily_volume"],
    },
  },
  {
    name: "recycling_contamination_check",
    description:
      "Flag likely contamination items in a recycling stream and estimate a simple contamination rate.",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", default: "single_stream" },
        known_contaminants: { type: "array", items: { type: "string" } },
        items: { type: "array", items: { type: "object" } },
      },
    },
  },
  {
    name: "waste_diversion_metrics",
    description:
      "Compute diversion rate and waste stream breakdown from tonnage inputs.",
    inputSchema: {
      type: "object",
      properties: {
        recycled_tons: { type: "number", default: 0 },
        composted_tons: { type: "number", default: 0 },
        landfill_tons: { type: "number", default: 0 },
        energy_recovery_tons: { type: "number", default: 0 },
      },
    },
  },

  // ── Deathcare Operations ─────────────────────────────────────────────────
  {
    name: "funeral_service_checklist",
    description:
      "Generate an operations checklist for a funeral service (visitation, graveside, disposition coordination).",
    inputSchema: {
      type: "object",
      properties: {
        service_type: { type: "string", default: "traditional" },
        disposition: { type: "string", default: "burial" },
        venue: { type: "string", default: "funeral_home" },
        religious: { type: "boolean", default: false },
        has_visitation: { type: "boolean", default: true },
        has_graveside: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "funeral_pricing_estimate",
    description:
      "Estimate funeral invoice totals (line items + cash advances) with discount, tax, and deposit due.",
    inputSchema: {
      type: "object",
      properties: {
        discount_pct: { type: "number", default: 0 },
        tax_pct: { type: "number", default: 0 },
        deposit_pct: { type: "number", default: 0.25 },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              taxable: { type: "boolean", default: true },
            },
            required: ["name", "amount"],
          },
        },
        cash_advances: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
            },
            required: ["name", "amount"],
          },
        },
      },
    },
  },
  {
    name: "obituary_draft",
    description:
      "Draft an obituary paragraph with survivors, predeceased, and optional service details.",
    inputSchema: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        age: { type: "number" },
        city: { type: "string" },
        date_of_death: { type: "string" },
        survivors: { type: "array", items: { type: "string" } },
        predeceased: { type: "array", items: { type: "string" } },
        service_details: { type: "string" },
        charities: { type: "array", items: { type: "string" } },
      },
      required: ["full_name"],
    },
  },
];

export async function handlePhase73Tool(name, args) {
  switch (name) {
    case "waste_route_planner":
      return wasteRoutePlanner(args);
    case "waste_container_sizing":
      return wasteContainerSizing(args);
    case "recycling_contamination_check":
      return recyclingContaminationCheck(args);
    case "waste_diversion_metrics":
      return diversionMetrics(args);

    case "funeral_service_checklist":
      return funeralServiceChecklist(args);
    case "funeral_pricing_estimate":
      return funeralPricingEstimate(args);
    case "obituary_draft":
      return obituaryDraft(args);

    default:
      throw new Error(`Unknown Phase 73 tool: ${name}`);
  }
}
