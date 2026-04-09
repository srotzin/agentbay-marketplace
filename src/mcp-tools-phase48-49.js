/**
 * HiveAgent MCP Tools — Phase 48-49
 *
 * Phase 48 — Incident Status: declare incidents, post updates, resolve, uptime summaries (6 tools)
 * Phase 49 — Supply Chain Security: register artifacts, provenance metadata, dependency risk scoring (5 tools)
 *
 * Total: 11 new tools
 */

import {
  incidentDeclare,
  incidentPostUpdate,
  incidentResolve,
  incidentList,
  incidentGet,
  incidentUptimeSummary,
} from "./services/incident-status.js";

import {
  scsRegisterArtifact,
  scsGetArtifact,
  scsFindArtifactByDigest,
  scsDependencyScan,
  scsListScans,
} from "./services/supply-chain-security.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const phase4849Tools = [
  // ── Phase 48: Incident Status ───────────────────────────────────────────────
  {
    name: "incident_declare",
    description:
      "Declare a new incident for a component (status starts as investigating). " +
      "Returns incident_id plus initial update id.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short incident title" },
        component: { type: "string", description: "Affected component name (e.g., api, payments, search)" },
        severity: { type: "string", description: "minor|major|critical" },
        created_by: { type: "string", description: "Optional author/agent identifier" },
      },
      required: ["title", "component"],
    },
  },
  {
    name: "incident_post_update",
    description:
      "Post a status update to an incident and optionally advance incident status " +
      "(investigating|identified|monitoring|resolved).",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident ID" },
        status: { type: "string", description: "investigating|identified|monitoring|resolved" },
        message: { type: "string", description: "Update message" },
        posted_by: { type: "string", description: "Optional author/agent identifier" },
      },
      required: ["incident_id", "status", "message"],
    },
  },
  {
    name: "incident_resolve",
    description:
      "Resolve an incident with a final message (shortcut for incident_post_update with status=resolved).",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident ID" },
        message: { type: "string", description: "Resolution message" },
        posted_by: { type: "string", description: "Optional author/agent identifier" },
      },
      required: ["incident_id"],
    },
  },
  {
    name: "incident_list",
    description:
      "List incidents filtered by open|resolved|all (defaults to open).",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "open|resolved|all" },
      },
      required: [],
    },
  },
  {
    name: "incident_get",
    description:
      "Get incident details plus ordered update timeline.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident ID" },
      },
      required: ["incident_id"],
    },
  },
  {
    name: "incident_uptime_summary",
    description:
      "Compute a simple uptime report for a component over the last N days, using incident duration as downtime.",
    inputSchema: {
      type: "object",
      properties: {
        component: { type: "string", description: "Component name" },
        days: { type: "integer", description: "Window size (1..365), default 7" },
      },
      required: ["component"],
    },
  },

  // ── Phase 49: Supply Chain Security ─────────────────────────────────────────
  {
    name: "scs_register_artifact",
    description:
      "Register a software artifact (container/npm/pypi/binary/model/dataset/other) with a SHA-256 digest. " +
      "Digest may be provided directly or computed from provided content string. Optional provenance metadata supported.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Artifact name (package/image/model)" },
        version: { type: "string", description: "Optional version/tag" },
        artifact_type: { type: "string", description: "container|npm|pypi|binary|model|dataset|other" },
        digest_sha256: { type: "string", description: "SHA-256 digest hex" },
        content: { type: "string", description: "Optional content to hash if digest not provided" },
        source_url: { type: "string", description: "Optional source URL" },
        provenance: { type: "object", description: "Optional provenance object (builder, commit, build_url, attestations, etc.)" },
      },
      required: ["name"],
    },
  },
  {
    name: "scs_get_artifact",
    description: "Fetch an artifact record by artifact_id.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "Artifact ID" },
      },
      required: ["artifact_id"],
    },
  },
  {
    name: "scs_find_artifact_by_digest",
    description: "Find the most recently registered artifact by SHA-256 digest.",
    inputSchema: {
      type: "object",
      properties: {
        digest_sha256: { type: "string", description: "SHA-256 digest hex" },
      },
      required: ["digest_sha256"],
    },
  },
  {
    name: "scs_dependency_scan",
    description:
      "Run a lightweight dependency risk scan (heuristic 0..100 score) for an artifact given a dependency list. " +
      "Dependencies items: {name, version, is_direct, license, maintainer_verified}.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "Artifact ID" },
        ecosystem: { type: "string", description: "npm|pypi|container|other" },
        dependencies: {
          type: "array",
          description: "Dependency objects",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              is_direct: { type: "boolean" },
              license: { type: "string" },
              maintainer_verified: { type: "boolean" },
            },
            required: ["name"],
          },
        },
      },
      required: ["artifact_id"],
    },
  },
  {
    name: "scs_list_scans",
    description: "List the last 20 dependency scans for an artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "Artifact ID" },
      },
      required: ["artifact_id"],
    },
  },
];

// ─── Dispatch table ───────────────────────────────────────────────────────────

const handlers = {
  incident_declare: async ({ title, component, severity, created_by }) =>
    incidentDeclare(title, component, severity, created_by),

  incident_post_update: async ({ incident_id, status, message, posted_by }) =>
    incidentPostUpdate(incident_id, status, message, posted_by),

  incident_resolve: async ({ incident_id, message, posted_by }) =>
    incidentResolve(incident_id, message, posted_by),

  incident_list: async ({ filter }) => incidentList(filter),

  incident_get: async ({ incident_id }) => incidentGet(incident_id),

  incident_uptime_summary: async ({ component, days }) => incidentUptimeSummary(component, days),

  scs_register_artifact: async (args) => scsRegisterArtifact(args),

  scs_get_artifact: async ({ artifact_id }) => scsGetArtifact(artifact_id),

  scs_find_artifact_by_digest: async ({ digest_sha256 }) => scsFindArtifactByDigest(digest_sha256),

  scs_dependency_scan: async (args) => scsDependencyScan(args),

  scs_list_scans: async ({ artifact_id }) => scsListScans(artifact_id),
};

export async function handlePhase4849Tool(name, args) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown phase 48-49 tool: ${name}`);
  return handler(args ?? {});
}
