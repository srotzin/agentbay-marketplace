/**
 * HiveAgent MCP Tool Definitions — Phase 75
 *
 * Phase 75 — Maritime & Port Operations + Utilities Outage Operations
 *
 * Total new tools: 6
 */

import {
  portCraneHoursEstimate,
  portBerthPlanHeuristic,
  portDemurrageEstimate,
} from "./services/maritime-ports-operations.js";

import {
  outageTriagePriority,
  outageRestorationEta,
  outageCrewRoutingHeuristic,
} from "./services/utilities-outage-operations.js";

export const phase75Tools = [
  // ── Maritime & Port Operations ───────────────────────────────────────────
  {
    name: "port_crane_hours_estimate",
    description:
      "Estimate crane-hours and vessel move time given container moves and crane productivity.",
    inputSchema: {
      type: "object",
      properties: {
        total_moves: { type: "number", description: "Total container moves (load + discharge)" },
        cranes_assigned: { type: "number", default: 4 },
        moves_per_crane_hour: { type: "number", default: 25 },
        efficiency_factor: { type: "number", default: 0.85 },
        shift_change_hours: { type: "number", default: 0 },
      },
      required: ["total_moves"],
    },
  },
  {
    name: "port_berth_plan_heuristic",
    description:
      "Create a simple berth plan (FCFS heuristic) from vessel ETAs and service hours.",
    inputSchema: {
      type: "object",
      properties: {
        berth_count: { type: "number", default: 2 },
        safety_gap_hours: { type: "number", default: 0.5 },
        vessels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              vessel_id: { type: "string" },
              eta: { type: "string", description: "ISO datetime" },
              service_hours: { type: "number" },
            },
            required: ["eta", "service_hours"],
          },
        },
      },
      required: ["vessels"],
    },
  },
  {
    name: "port_demurrage_estimate",
    description:
      "Estimate demurrage/detention cost given free days, date window, and per-container-day rate.",
    inputSchema: {
      type: "object",
      properties: {
        free_days: { type: "number", default: 4 },
        rate_per_container_day: { type: "number", default: 150 },
        start_date: { type: "string", description: "ISO date/datetime" },
        end_date: { type: "string", description: "ISO date/datetime" },
        containers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              container_id: { type: "string" },
              count: { type: "number", default: 1 },
            },
          },
        },
      },
      required: ["containers", "start_date", "end_date"],
    },
  },

  // ── Utilities Outage Operations ──────────────────────────────────────────
  {
    name: "outage_triage_priority",
    description:
      "Rank outage tickets for dispatch priority based on customers, critical loads, safety hazards, and duration.",
    inputSchema: {
      type: "object",
      properties: {
        outages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              outage_id: { type: "string" },
              customers_affected: { type: "number" },
              critical_facilities: { type: "number", default: 0 },
              safety_hazard: { type: "boolean", default: false },
              medical_dependency: { type: "boolean", default: false },
              duration_hours: { type: "number", default: 0 },
            },
          },
        },
        weights: { type: "object", description: "Optional weights override" },
      },
      required: ["outages"],
    },
  },
  {
    name: "outage_restoration_eta",
    description:
      "Estimate restoration hours from crew count and task labor hours with productivity and access delays.",
    inputSchema: {
      type: "object",
      properties: {
        crew_count: { type: "number" },
        hours_per_crew_per_shift: { type: "number", default: 10 },
        productivity_factor: { type: "number", default: 0.8 },
        access_delay_hours: { type: "number", default: 0 },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task_id: { type: "string" },
              labor_hours: { type: "number" },
            },
            required: ["labor_hours"],
          },
        },
      },
      required: ["tasks", "crew_count"],
    },
  },
  {
    name: "outage_crew_routing_heuristic",
    description:
      "Assign outages to crews using a nearest-neighbor heuristic (lat/lon required).",
    inputSchema: {
      type: "object",
      properties: {
        max_outages_per_crew: { type: "number", default: 6 },
        crews: {
          type: "array",
          items: {
            type: "object",
            properties: {
              crew_id: { type: "string" },
              lat: { type: "number" },
              lon: { type: "number" },
            },
            required: ["lat", "lon"],
          },
        },
        outages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              outage_id: { type: "string" },
              priority: { type: "number", default: 0 },
              lat: { type: "number" },
              lon: { type: "number" },
            },
            required: ["lat", "lon"],
          },
        },
      },
      required: ["crews", "outages"],
    },
  },
];

export async function handlePhase75Tool(name, args) {
  switch (name) {
    case "port_crane_hours_estimate":
      return portCraneHoursEstimate(args);
    case "port_berth_plan_heuristic":
      return portBerthPlanHeuristic(args);
    case "port_demurrage_estimate":
      return portDemurrageEstimate(args);

    case "outage_triage_priority":
      return outageTriagePriority(args);
    case "outage_restoration_eta":
      return outageRestorationEta(args);
    case "outage_crew_routing_heuristic":
      return outageCrewRoutingHeuristic(args);

    default:
      throw new Error(`Unknown Phase 75 tool: ${name}`);
  }
}
