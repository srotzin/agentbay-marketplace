/**
 * HiveAgent MCP Tool Definitions — Phase 14
 *
 * Two new verticals wired into MCP — 10 tools total:
 *
 *   mining-operations (5 tools):
 *     mining_register_site          — create a new mine/site record
 *     mining_report_incident        — log safety/environment/security/equipment incidents
 *     mining_create_work_order      — create equipment maintenance work orders
 *     mining_log_ore_batch          — log ore batches and basic contained-metal estimates
 *     mining_dashboard              — operations dashboard for sites/incidents/work orders
 *
 *   aviation-ops (5 tools):
 *     aviation_create_flight        — create a flight record
 *     aviation_update_flight_status — update flight status (boarding/departed/etc)
 *     aviation_report_irrop         — log irregular operations (IRROPS) events
 *     aviation_plan_turnaround      — plan a station turnaround block
 *     aviation_ops_dashboard        — ops dashboard for flights/IRROPS/turns
 *
 * Exports:
 *   phase14Tools                    — Array of 10 MCP tool definitions
 *   handlePhase14Tool(name, args)   — Dispatcher function
 */

import {
  miningRegisterSite,
  miningReportIncident,
  miningCreateWorkOrder,
  miningLogOreBatch,
  miningDashboard,
} from "./services/mining-operations.js";

import {
  aviationCreateFlight,
  aviationUpdateFlightStatus,
  aviationReportIrrop,
  aviationPlanTurnaround,
  aviationOpsDashboard,
} from "./services/aviation-ops.js";

export const phase14Tools = [
  {
    name: "mining_register_site",
    description: "Register a new mining site (commodity, country, owner).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        commodity: { type: "string" },
        country: { type: "string" },
        owner: { type: "string" },
      },
      required: ["name", "commodity"],
    },
  },
  {
    name: "mining_report_incident",
    description: "Report a mining incident and get a risk score + suggested actions.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string" },
        category: { type: "string", enum: ["safety", "environment", "security", "equipment"] },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        description: { type: "string" },
      },
      required: ["siteId", "category", "severity", "description"],
    },
  },
  {
    name: "mining_create_work_order",
    description: "Create an equipment maintenance work order at a mining site.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string" },
        assetTag: { type: "string" },
        issue: { type: "string" },
        priority: { type: "string", enum: ["p0", "p1", "p2", "p3"] },
        estimatedHours: { type: "number" },
      },
      required: ["siteId", "assetTag", "issue"],
    },
  },
  {
    name: "mining_log_ore_batch",
    description: "Log an ore batch and compute simple dry-tonnage and contained grams estimates (if provided grade/moisture).",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string" },
        batchCode: { type: "string" },
        tonnage: { type: "number" },
        gradeGpt: { type: ["number", "null"] },
        moisturePct: { type: ["number", "null"] },
      },
      required: ["siteId", "batchCode", "tonnage"],
    },
  },
  {
    name: "mining_dashboard",
    description: "Operational dashboard for mining: sites, open incidents, active work orders, and recent ore batches.",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "aviation_create_flight",
    description: "Create a flight record for airline operations.",
    inputSchema: {
      type: "object",
      properties: {
        flightNumber: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        aircraftTail: { type: "string" },
      },
      required: ["flightNumber", "origin", "destination"],
    },
  },
  {
    name: "aviation_update_flight_status",
    description: "Update a flight status (scheduled/boarding/departed/arrived/cancelled/diverted).",
    inputSchema: {
      type: "object",
      properties: {
        flightId: { type: "string" },
        status: { type: "string", enum: ["scheduled", "boarding", "departed", "arrived", "cancelled", "diverted"] },
      },
      required: ["flightId", "status"],
    },
  },
  {
    name: "aviation_report_irrop",
    description: "Report an IRROPS event and get suggested mitigations.",
    inputSchema: {
      type: "object",
      properties: {
        flightId: { type: "string" },
        irropType: { type: "string", enum: ["delay", "cancel", "diversion", "aircraft_swap", "crew_issue", "maintenance"] },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        reason: { type: "string" },
      },
      required: ["flightId", "irropType", "severity", "reason"],
    },
  },
  {
    name: "aviation_plan_turnaround",
    description: "Plan a station turnaround (planned minutes) for a flight.",
    inputSchema: {
      type: "object",
      properties: {
        flightId: { type: "string" },
        station: { type: "string" },
        plannedMinutes: { type: "number" },
      },
      required: ["flightId", "station"],
    },
  },
  {
    name: "aviation_ops_dashboard",
    description: "Ops dashboard for flights, open IRROPS, and active turnarounds.",
    inputSchema: { type: "object", properties: {} },
  },
];

export function handlePhase14Tool(name, args = {}) {
  switch (name) {
    case "mining_register_site":
      return miningRegisterSite(args.name, args.commodity, args.country, args.owner);
    case "mining_report_incident":
      return miningReportIncident(args.siteId, args.category, args.severity, args.description);
    case "mining_create_work_order":
      return miningCreateWorkOrder(args.siteId, args.assetTag, args.issue, args.priority, args.estimatedHours);
    case "mining_log_ore_batch":
      return miningLogOreBatch(args.siteId, args.batchCode, args.tonnage, args.gradeGpt, args.moisturePct);
    case "mining_dashboard":
      return miningDashboard();

    case "aviation_create_flight":
      return aviationCreateFlight(args.flightNumber, args.origin, args.destination, args.aircraftTail);
    case "aviation_update_flight_status":
      return aviationUpdateFlightStatus(args.flightId, args.status);
    case "aviation_report_irrop":
      return aviationReportIrrop(args.flightId, args.irropType, args.severity, args.reason);
    case "aviation_plan_turnaround":
      return aviationPlanTurnaround(args.flightId, args.station, args.plannedMinutes);
    case "aviation_ops_dashboard":
      return aviationOpsDashboard();

    default:
      throw new Error(`Unknown Phase 14 tool: ${name}`);
  }
}
