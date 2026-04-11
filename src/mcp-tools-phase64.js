/**
 * HiveAgent MCP Tools — Phase 64
 *
 * New verticals:
 * - Public Safety Dispatch: incident intake, triage, unit dispatch, after-action reports
 * - Industrial Maintenance (CMMS-lite): assets, work orders, PM plans, downtime KPIs
 */

import * as ps from "./services/public-safety-dispatch.js";
import * as im from "./services/industrial-maintenance.js";

export const phase64Tools = [
  // ────────────────────────────────────────────────────────────────────────────
  // Public Safety Dispatch
  {
    name: "ps_unit_register",
    description: "Register or update a public safety unit (police/fire/ems) with availability and capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        unit_id: { type: "string", description: "Optional stable ID. If omitted, one is generated." },
        type: { type: "string", default: "police", description: "police/fire/ems/other" },
        callsign: { type: "string" },
        agency: { type: "string" },
        status: { type: "string", default: "available", description: "available/assigned/out_of_service" },
        location: { type: "string" },
        capabilities: { type: "array", items: { type: "string" }, default: [] },
        notes: { type: "string" },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ps_unit_list",
    description: "List registered units, optionally filtering by status and/or type.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        type: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ps_incident_create",
    description:
      "Create a new public safety incident report from caller intake (location + description required). Returns incident_id.",
    inputSchema: {
      type: "object",
      properties: {
        caller_name: { type: "string" },
        caller_phone: { type: "string" },
        location: { type: "string" },
        incident_type: { type: "string", default: "unknown" },
        description: { type: "string" },
        severity: { type: "string", default: "medium", description: "low/medium/high/critical" },
        priority: { type: "string", default: "P3", description: "P0 (highest) .. P4 (lowest)" },
        reported_at: { type: "string", description: "ISO date/datetime; defaults to now" },
        channel: { type: "string", default: "phone" },
        tags: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["location", "description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ps_incident_list",
    description: "List incidents with optional filters (status, type, full-text q, min_severity).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        incident_type: { type: "string" },
        q: { type: "string" },
        min_severity: { type: "string" },
        limit: { type: "integer", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ps_incident_update",
    description: "Update incident status/severity/priority/description/tags.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        status: { type: "string" },
        severity: { type: "string" },
        priority: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["incident_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "ps_dispatch_create",
    description:
      "Dispatch a unit to an incident (marks unit assigned). Returns dispatch record plus incident+unit snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        unit_id: { type: "string" },
        disposition: { type: "string", default: "dispatched" },
        eta_minutes: { type: "number" },
        notes: { type: "string" },
      },
      required: ["incident_id", "unit_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "ps_dispatch_list",
    description: "List dispatches (optionally filter by incident_id and/or unit_id).",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        unit_id: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ps_note_add",
    description: "Add an incident note (timeline entry) with author and text.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        author: { type: "string" },
        text: { type: "string" },
      },
      required: ["incident_id", "text"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ps_after_action_report",
    description: "Generate an after-action report for an incident (incident + dispatches + notes).",
    inputSchema: {
      type: "object",
      properties: { incident_id: { type: "string" } },
      required: ["incident_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Industrial Maintenance (CMMS-lite)
  {
    name: "im_asset_upsert",
    description: "Create or update an industrial asset (equipment/line/site). Returns asset record.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        name: { type: "string" },
        type: { type: "string", default: "equipment" },
        site: { type: "string" },
        line: { type: "string" },
        manufacturer: { type: "string" },
        model: { type: "string" },
        serial: { type: "string" },
        criticality: { type: "string", default: "medium" },
        tags: { type: "array", items: { type: "string" }, default: [] },
        metadata: { type: "object", default: {} },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "im_asset_list",
    description: "List assets (optionally filter by site and/or full-text q).",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string" },
        q: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "im_work_order_create",
    description: "Create a maintenance work order for an asset. Returns work_order_id.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", default: "P3" },
        requested_by: { type: "string" },
        assigned_to: { type: "string" },
        due_at: { type: "string" },
        tags: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["asset_id", "title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "im_work_order_list",
    description: "List work orders (optionally filter by status/asset_id/priority).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        asset_id: { type: "string" },
        priority: { type: "string" },
        limit: { type: "integer", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "im_work_order_update",
    description: "Update a work order (status, assigned_to, due_at, resolution_notes).",
    inputSchema: {
      type: "object",
      properties: {
        work_order_id: { type: "string" },
        status: { type: "string" },
        assigned_to: { type: "string" },
        due_at: { type: "string" },
        resolution_notes: { type: "string" },
      },
      required: ["work_order_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "im_pm_plan_create",
    description: "Create a preventive maintenance plan for an asset (interval_hours or interval_days).",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        name: { type: "string" },
        interval_hours: { type: "number" },
        interval_days: { type: "number" },
        checklist: { type: "array", items: { type: "string" }, default: [] },
        owner: { type: "string" },
      },
      required: ["asset_id", "name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "im_pm_plan_list",
    description: "List preventive maintenance plans (optionally filter by asset_id).",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "im_downtime_log",
    description: "Log downtime for an asset (minutes optional) with category (planned/unplanned) and cost.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        started_at: { type: "string" },
        ended_at: { type: "string" },
        minutes: { type: "number" },
        category: { type: "string", default: "unplanned" },
        reason: { type: "string" },
        cost_usd: { type: "number" },
      },
      required: ["asset_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "im_asset_kpis",
    description: "Compute basic asset KPIs (work orders counts, downtime minutes, MTTR estimate).",
    inputSchema: {
      type: "object",
      properties: { asset_id: { type: "string" } },
      required: ["asset_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export async function handlePhase64Tool(name, args) {
  switch (name) {
    // Public Safety Dispatch
    case "ps_unit_register":
      return ps.ps_unit_register(args);
    case "ps_unit_list":
      return ps.ps_unit_list(args);
    case "ps_incident_create":
      return ps.ps_incident_create(args);
    case "ps_incident_list":
      return ps.ps_incident_list(args);
    case "ps_incident_update":
      return ps.ps_incident_update(args);
    case "ps_dispatch_create":
      return ps.ps_dispatch_create(args);
    case "ps_dispatch_list":
      return ps.ps_dispatch_list(args);
    case "ps_note_add":
      return ps.ps_note_add(args);
    case "ps_after_action_report":
      return ps.ps_after_action_report(args);

    // Industrial Maintenance
    case "im_asset_upsert":
      return im.im_asset_upsert(args);
    case "im_asset_list":
      return im.im_asset_list(args);
    case "im_work_order_create":
      return im.im_work_order_create(args);
    case "im_work_order_list":
      return im.im_work_order_list(args);
    case "im_work_order_update":
      return im.im_work_order_update(args);
    case "im_pm_plan_create":
      return im.im_pm_plan_create(args);
    case "im_pm_plan_list":
      return im.im_pm_plan_list(args);
    case "im_downtime_log":
      return im.im_downtime_log(args);
    case "im_asset_kpis":
      return im.im_asset_kpis(args);

    default:
      return null;
  }
}
