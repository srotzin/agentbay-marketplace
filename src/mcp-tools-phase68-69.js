/**
 * HiveAgent MCP Tool Definitions — Phase 68-69
 *
 * Phase 68 — Digital Forensics: incident timelines, IOC triage, evidence hashing.
 * Phase 69 — Model Evaluation: quick answer comparison + tool response scoring.
 *
 * Total new tools: 6
 */

import {
  buildIncidentTimeline,
  triageIocs,
  createEvidenceBundle,
} from "./services/digital-forensics.js";

import {
  compareAnswers,
  scoreToolResponse,
  buildEvalReport,
} from "./services/model-evaluation.js";

export const phase6869Tools = [
  // ── Phase 68: Digital Forensics ───────────────────────────────────────────
  {
    name: "forensics_build_timeline",
    description: "Build a normalized incident timeline from a set of events (timestamps, actors, actions). " +
      "Use to create a consistent chronology for an incident response report.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Optional incident ID" },
        title: { type: "string", description: "Incident title" },
        timezone: { type: "string", description: "Timezone label (default UTC)" },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              timestamp: { type: "string", description: "ISO timestamp" },
              actor: { type: "string" },
              action: { type: "string" },
              details: { type: "string" },
              confidence: { type: "string", enum: ["low","medium","high"] },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      required: ["events"],
    },
  },
  {
    name: "forensics_triage_iocs",
    description: "Normalize and triage indicators of compromise (IPs, domains, URLs, emails, hashes). " +
      "Returns normalized list, grouping by type, and a heuristic risk_score.",
    inputSchema: {
      type: "object",
      properties: {
        indicators: { type: "array", items: { type: "string" }, description: "IOC strings" },
      },
      required: ["indicators"],
    },
  },
  {
    name: "forensics_create_evidence_bundle",
    description: "Create an evidence bundle with SHA-256 hashes for each artifact and a bundle hash. " +
      "Use for chain-of-custody integrity checks.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        artifacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              content: { type: "string" },
              collected_at: { type: "string" },
              source: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name","content"],
          },
        },
      },
      required: ["artifacts"],
    },
  },

  // ── Phase 69: Model Evaluation ───────────────────────────────────────────
  {
    name: "eval_compare_answers",
    description: "Compare a candidate answer to a reference using a simple metric (exact, token_jaccard, length_ratio).",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        candidate: { type: "string" },
        metric: { type: "string", enum: ["exact","token_jaccard","length_ratio"], default: "token_jaccard" },
      },
      required: ["reference","candidate"],
    },
  },
  {
    name: "eval_score_tool_response",
    description: "Score a tool JSON response for completeness against a list of required fields.",
    inputSchema: {
      type: "object",
      properties: {
        response: { type: "object", description: "Tool response object" },
        required_fields: { type: "array", items: { type: "string" } },
      },
      required: ["response"],
    },
  },
  {
    name: "eval_build_report",
    description: "Build a compact evaluation report from individual test results.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        tests: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              metric: { type: "string" },
              score: { type: "number" },
              threshold: { type: "number" },
              passed: { type: "boolean" },
              notes: { type: "string" },
            },
            required: ["name","score"],
          },
        },
      },
      required: ["tests"],
    },
  },
];

export async function handlePhase6869Tool(name, args) {
  switch (name) {
    case "forensics_build_timeline":
      return buildIncidentTimeline(args);
    case "forensics_triage_iocs":
      return triageIocs(args);
    case "forensics_create_evidence_bundle":
      return createEvidenceBundle(args);

    case "eval_compare_answers":
      return compareAnswers(args);
    case "eval_score_tool_response":
      return scoreToolResponse(args);
    case "eval_build_report":
      return buildEvalReport(args);

    default:
      throw new Error(`Unknown Phase 68-69 tool: ${name}`);
  }
}
