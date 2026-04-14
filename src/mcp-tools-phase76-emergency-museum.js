/**
 * HiveAgent MCP Tool Definitions — Phase 76
 *
 * Phase 76 — Emergency Response Operations + Museum Collections
 *
 * Total new tools: 6
 */

import {
  incidentTriagePriority,
  stagingLocationSuggest,
  icsBriefDraft,
} from "./services/emergency-response-operations.js";

import {
  accessionIdGenerate,
  provenanceRiskScore,
  deaccessionRecommendation,
} from "./services/museum-collections.js";

export const phase76Tools = [
  // ── Emergency Response Operations ─────────────────────────────────────────
  {
    name: "incident_triage_priority",
    description:
      "Rank incidents for dispatch priority using life safety, hazards, exposure, and incident age.",
    inputSchema: {
      type: "object",
      properties: {
        incidents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              incident_id: { type: "string" },
              created_at: { type: "string", description: "ISO datetime" },
              life_safety: { type: "boolean", default: false },
              injuries: { type: "number", default: 0 },
              fatalities: { type: "number", default: 0 },
              structure_fire: { type: "boolean", default: false },
              hazmat: { type: "boolean", default: false },
              critical_infrastructure: { type: "boolean", default: false },
              evac_required: { type: "boolean", default: false },
              population_exposed: { type: "number", default: 0 },
              manual_priority: { type: "number", description: "Optional override floor" },
            },
          },
        },
        weights: { type: "object", description: "Optional weights override" },
      },
      required: ["incidents"],
    },
  },
  {
    name: "staging_location_suggest",
    description:
      "Choose staging locations from candidates to reduce weighted travel distance to incidents (lat/lon required).",
    inputSchema: {
      type: "object",
      properties: {
        max_staging_locations: { type: "number", default: 3 },
        incidents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              incident_id: { type: "string" },
              lat: { type: "number" },
              lon: { type: "number" },
              weight: { type: "number", default: 1 },
            },
            required: ["lat", "lon"],
          },
        },
        candidates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              location_id: { type: "string" },
              lat: { type: "number" },
              lon: { type: "number" },
              capacity_units: { type: "number", default: 0 },
            },
            required: ["lat", "lon"],
          },
        },
      },
      required: ["incidents", "candidates"],
    },
  },
  {
    name: "ics_brief_draft",
    description:
      "Draft an Incident Command System (ICS) brief with objectives, hazards, resource summary, and comms plan.",
    inputSchema: {
      type: "object",
      properties: {
        incident: { type: "object" },
        operational_period: { type: "string" },
        situation_overview: { type: "string" },
        objectives: { type: "array", items: { type: "string" } },
        hazards: { type: "array", items: { type: "string" } },
        resources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              resource_id: { type: "string" },
              kind: { type: "string" },
              count: { type: "number", default: 1 },
              eta_minutes: { type: "number", default: 0 },
              status: { type: "string", default: "enroute" },
            },
          },
        },
        comms_primary: { type: "string" },
        comms_tactical: { type: "string" },
        comms_medical: { type: "string" },
        notes: { type: "string" },
      },
      required: [],
    },
  },

  // ── Museum Collections ───────────────────────────────────────────────────
  {
    name: "accession_id_generate",
    description:
      "Generate accession identifiers (e.g., YYYY.NNN) for new objects.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "number" },
        prefix: { type: "string" },
        sequence_start: { type: "number", default: 1 },
        count: { type: "number", default: 1 },
        pad: { type: "number", default: 3 },
      },
      required: [],
    },
  },
  {
    name: "provenance_risk_score",
    description:
      "Rank objects by provenance risk (missing chain, conflict region, Nazi-era gap, export docs).",
    inputSchema: {
      type: "object",
      properties: {
        objects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              object_id: { type: "string" },
              categories: { type: "array", items: { type: "string" } },
              missing_ownership_chain: { type: "boolean", default: false },
              conflict_region: { type: "boolean", default: false },
              nazi_era_gap: { type: "boolean", default: false },
              antiquities: { type: "boolean", default: false },
              export_docs_missing: { type: "boolean", default: false },
              estimated_value_usd: { type: "number", default: 0 },
              acquired_year: { type: "number" },
            },
          },
        },
        weights: { type: "object" },
      },
      required: ["objects"],
    },
  },
  {
    name: "deaccession_recommendation",
    description:
      "Recommend a deaccession pathway category plus checklist prompts (policy scaffold).",
    inputSchema: {
      type: "object",
      properties: {
        object: {
          type: "object",
          properties: {
            mission_fit: { type: "number", description: "0..1 (higher means better fit)" },
            condition: { type: "number", description: "0..1 (higher means better)" },
            duplicates: { type: "number", default: 0 },
            legal_restrictions: { type: "boolean", default: false },
            donor_restrictions: { type: "boolean", default: false },
            hazardous_materials: { type: "boolean", default: false },
          },
        },
      },
      required: [],
    },
  },
];

export async function handlePhase76Tool(name, args) {
  switch (name) {
    case "incident_triage_priority":
      return incidentTriagePriority(args);
    case "staging_location_suggest":
      return stagingLocationSuggest(args);
    case "ics_brief_draft":
      return icsBriefDraft(args);

    case "accession_id_generate":
      return accessionIdGenerate(args);
    case "provenance_risk_score":
      return provenanceRiskScore(args);
    case "deaccession_recommendation":
      return deaccessionRecommendation(args);

    default:
      throw new Error(`Unknown Phase 76 tool: ${name}`);
  }
}
