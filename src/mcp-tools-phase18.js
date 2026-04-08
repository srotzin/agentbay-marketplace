import * as clinicalTrials from "./services/clinical-trials.js";
import * as researchFunding from "./services/research-funding.js";

// Phase 18: Science & research ops (clinical trials + grants)

export const phase18Tools = [
  // ─── Clinical Trials ─────────────────────────────────────────────────────────
  {
    name: "hiveagent_clinical_trials_search",
    description: "Search clinical trials by condition and optional phase/status.",
    inputSchema: {
      type: "object",
      properties: {
        condition: { type: "string", description: "Primary condition/disease term" },
        phase: { type: "string", description: "Optional phase filter: N/A|Phase 1|Phase 2|Phase 3|Phase 4" },
        status: { type: "string", description: "Optional status: recruiting|active_not_recruiting|completed|terminated|unknown" },
        limit: { type: "integer", description: "Max results (default 10, max 50)", default: 10 },
      },
      required: ["condition"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_clinical_trials_patient_profile_upsert",
    description: "Create/update a patient profile used for trial matching.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Stable patient identifier" },
        age: { type: "integer", description: "Optional age" },
        sex: { type: "string", description: "female|male|intersex|unspecified", default: "unspecified" },
        conditions: { type: "array", description: "List of condition terms", items: { type: "string" }, default: [] },
        medications: { type: "array", description: "List of medications", items: { type: "string" }, default: [] },
        zip_code: { type: "string", description: "Optional ZIP/postal code" },
        country: { type: "string", description: "Country code (default US)", default: "US" },
      },
      required: ["patient_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_clinical_trials_match",
    description: "Generate and persist top trial matches for a patient.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient identifier" },
        condition: { type: "string", description: "Optional condition filter" },
        limit: { type: "integer", description: "Max matches (default 5, max 20)", default: 5 },
      },
      required: ["patient_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "hiveagent_clinical_trials_match_status_set",
    description: "Accept/reject/contact a proposed trial match.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient identifier" },
        trial_nct_id: { type: "string", description: "Trial NCT ID" },
        status: { type: "string", description: "accepted|rejected|contacted" },
      },
      required: ["patient_id", "trial_nct_id", "status"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─── Research Funding ────────────────────────────────────────────────────────
  {
    name: "hiveagent_research_funding_search",
    description: "Search funding opportunities by domain, award range, and deadline.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Funding domain tag (e.g., ai-safety, civic-tech)" },
        country: { type: "string", description: "Country code (default US)", default: "US" },
        minAwardUsd: { type: "number", description: "Minimum acceptable max award" },
        maxAwardUsd: { type: "number", description: "Maximum acceptable min award" },
        beforeDeadlineIso: { type: "string", description: "Optional latest deadline (YYYY-MM-DD)" },
        limit: { type: "integer", description: "Max results (default 10, max 50)", default: 10 },
      },
      required: ["domain"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_research_funding_application_upsert",
    description: "Create/update a grant application draft.",
    inputSchema: {
      type: "object",
      properties: {
        applicant_id: { type: "string", description: "Applicant identifier" },
        funding_id: { type: "string", description: "Funding opportunity ID" },
        title: { type: "string", description: "Application title" },
        requested_usd: { type: "number", description: "Requested amount" },
        narrative_md: { type: "string", description: "Markdown narrative" },
        attachments: { type: "array", description: "Attachment metadata" , items: { type: "object" }, default: [] },
      },
      required: ["applicant_id", "funding_id", "title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_research_funding_application_submit",
    description: "Submit a grant application draft.",
    inputSchema: {
      type: "object",
      properties: {
        applicant_id: { type: "string", description: "Applicant identifier" },
        funding_id: { type: "string", description: "Funding opportunity ID" },
      },
      required: ["applicant_id", "funding_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

export async function handlePhase18Tool(name, args) {
  switch (name) {
    case "hiveagent_clinical_trials_search":
      return clinicalTrials.searchClinicalTrials(args);
    case "hiveagent_clinical_trials_patient_profile_upsert":
      return clinicalTrials.upsertTrialPatientProfile(args);
    case "hiveagent_clinical_trials_match":
      return clinicalTrials.matchTrialsForPatient(args.patient_id, { condition: args.condition, limit: args.limit });
    case "hiveagent_clinical_trials_match_status_set":
      return clinicalTrials.setTrialMatchStatus(args.patient_id, args.trial_nct_id, args.status);

    case "hiveagent_research_funding_search":
      return researchFunding.searchFunding(args);
    case "hiveagent_research_funding_application_upsert":
      return researchFunding.upsertGrantApplication(args);
    case "hiveagent_research_funding_application_submit":
      return researchFunding.submitGrantApplication(args.applicant_id, args.funding_id);

    default:
      throw new Error(`Unknown Phase 18 tool: ${name}`);
  }
}
