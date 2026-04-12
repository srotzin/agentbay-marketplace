/**
 * Phase 67 — Space Weather + Biomanufacturing Ops
 *
 * New verticals for operational risk assessment:
 * - space weather event/asset risk
 * - GMP biomanufacturing batch/deviation/CAPA workflows
 */

import * as spaceWeather from "./services/space-weather.js";
import * as bioOps from "./services/biomanufacturing-ops.js";

export const phase67Tools = [
  {
    name: "spaceweather_create_event",
    description: "Create a space-weather event (CME, solar flare, geomagnetic storm, radiation storm) with severity and summary.",
    inputSchema: {
      type: "object",
      properties: {
        event_type: { type: "string", enum: ["cme", "solar_flare", "geomagnetic_storm", "radiation_storm"] },
        severity: { type: "string", enum: ["g1", "g2", "g3", "g4", "g5"] },
        summary: { type: "string" },
        affected_systems: { type: "string", description: "Optional comma-separated systems e.g. satellite,gnss,power_grid" },
      },
      required: ["event_type", "severity", "summary"],
    },
  },
  {
    name: "spaceweather_register_asset",
    description: "Register an asset to assess against space-weather events (satellite, power grid, aviation HF, GNSS, pipeline).",
    inputSchema: {
      type: "object",
      properties: {
        asset_type: { type: "string", enum: ["satellite", "power_grid", "aviation_hf", "gnss", "pipeline"] },
        name: { type: "string" },
        operator: { type: "string" },
        risk_profile: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["asset_type", "name"],
    },
  },
  {
    name: "spaceweather_assess_risk",
    description: "Assess a registered asset against a space-weather event and generate a recommended action list.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        asset_id: { type: "string" },
      },
      required: ["event_id", "asset_id"],
    },
  },
  {
    name: "spaceweather_dashboard",
    description: "Return recent space-weather events, assets, alerts, and headline metrics.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "bio_create_batch",
    description: "Create a GMP biomanufacturing batch for fermentation/cell culture/purification/fill-finish.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string" },
        facility: { type: "string" },
        process_type: { type: "string", enum: ["fermentation", "cell_culture", "purification", "fill_finish"] },
        target_yield: { type: "number" },
      },
      required: ["product", "facility", "process_type"],
    },
  },
  {
    name: "bio_update_batch_status",
    description: "Update batch status and optionally record actual yield / notes.",
    inputSchema: {
      type: "object",
      properties: {
        batch_id: { type: "string" },
        status: { type: "string", enum: ["planned", "in_progress", "qa_hold", "released", "rejected"] },
        actual_yield: { type: "number" },
        notes: { type: "string" },
      },
      required: ["batch_id", "status"],
    },
  },
  {
    name: "bio_log_deviation",
    description: "Log a deviation (contamination, out-of-spec, equipment, documentation, environmental) with severity and CAPA playbook.",
    inputSchema: {
      type: "object",
      properties: {
        batch_id: { type: "string" },
        deviation_type: { type: "string", enum: ["contamination", "out_of_spec", "equipment_failure", "documentation", "environmental"] },
        severity: { type: "string", enum: ["minor", "major", "critical"] },
        description: { type: "string" },
      },
      required: ["batch_id", "deviation_type", "severity", "description"],
    },
  },
  {
    name: "bio_create_capa",
    description: "Create a corrective/preventive action tied to a deviation.",
    inputSchema: {
      type: "object",
      properties: {
        deviation_id: { type: "string" },
        action_type: { type: "string", enum: ["corrective", "preventive"] },
        action: { type: "string" },
        owner: { type: "string" },
        due_date_utc: { type: "string" },
      },
      required: ["deviation_id", "action_type", "action"],
    },
  },
  {
    name: "bio_record_environmental_read",
    description: "Record an environmental monitoring read and return a flag (normal/alert/action) based on limit.",
    inputSchema: {
      type: "object",
      properties: {
        facility: { type: "string" },
        area: { type: "string" },
        sample_type: { type: "string", enum: ["air", "surface", "water", "personnel"] },
        metric: { type: "string", enum: ["cfu", "particles"] },
        value: { type: "number" },
        limit_value: { type: "number" },
      },
      required: ["facility", "area", "sample_type", "metric", "value", "limit_value"],
    },
  },
  {
    name: "bio_dashboard",
    description: "Return recent batches, deviations, CAPAs, environmental reads, and headline metrics.",
    inputSchema: { type: "object", properties: {} },
  },
];

export function handlePhase67Tool(name, args) {
  switch (name) {
    case "spaceweather_create_event":
      return spaceWeather.spaceWeatherCreateEvent(args.event_type, args.severity, args.summary, args.affected_systems);
    case "spaceweather_register_asset":
      return spaceWeather.spaceWeatherRegisterAsset(
        args.asset_type,
        args.name,
        args.operator,
        args.risk_profile,
        args.latitude,
        args.longitude
      );
    case "spaceweather_assess_risk":
      return spaceWeather.spaceWeatherAssessRisk(args.event_id, args.asset_id);
    case "spaceweather_dashboard":
      return spaceWeather.spaceWeatherDashboard();

    case "bio_create_batch":
      return bioOps.bioCreateBatch(args.product, args.facility, args.process_type, args.target_yield);
    case "bio_update_batch_status":
      return bioOps.bioUpdateBatchStatus(args.batch_id, args.status, args.actual_yield, args.notes);
    case "bio_log_deviation":
      return bioOps.bioLogDeviation(args.batch_id, args.deviation_type, args.severity, args.description);
    case "bio_create_capa":
      return bioOps.bioCreateCapa(args.deviation_id, args.action_type, args.action, args.owner, args.due_date_utc);
    case "bio_record_environmental_read":
      return bioOps.bioRecordEnvironmentalRead(
        args.facility,
        args.area,
        args.sample_type,
        args.metric,
        args.value,
        args.limit_value
      );
    case "bio_dashboard":
      return bioOps.bioManufacturingDashboard();

    default:
      return null;
  }
}
