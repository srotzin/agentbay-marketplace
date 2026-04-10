/**
 * HiveAgent MCP Tools — Phase 63
 *
 * New verticals:
 * - HR Compliance & Training: policies, acknowledgements, training assignments
 * - DevRel Ops: hackathons, bounties, submissions & reviews
 *
 * 10 tools:
 *   hr_policy_create
 *   hr_policy_list
 *   hr_employee_upsert
 *   hr_employee_list
 *   hr_policy_acknowledge
 *   hr_policy_status
 *   hr_training_create
 *   hr_training_list
 *   hr_training_assign
 *   hr_training_report
 *
 *   devrel_event_create
 *   devrel_event_list
 *   devrel_event_update_status
 *   devrel_bounty_create
 *   devrel_bounty_list
 *   devrel_bounty_close
 *   devrel_submission_submit
 *   devrel_submission_list
 *   devrel_submission_review
 */

import * as hr from "./services/hr-compliance.js";
import * as devrel from "./services/devrel.js";

export const phase63Tools = [
  {
    name: "hr_policy_create",
    description:
      "Create a new HR policy record (e.g., Code of Conduct, Security Awareness, Acceptable Use). Returns policy_id. " +
      "Use with hr_policy_acknowledge to track employee attestations.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string", default: "1.0" },
        summary: { type: "string" },
        effective_date: { type: "string", description: "ISO date or datetime" },
        owner: { type: "string" },
        url: { type: "string" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hr_policy_list",
    description: "List HR policies (most recent first).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_employee_upsert",
    description:
      "Create or update an employee directory record (idempotent when employee_id is provided). Returns employee record.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string" },
        department: { type: "string" },
        location: { type: "string" },
        status: { type: "string", default: "active" },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_employee_list",
    description: "List employees (optionally filter by status=active/inactive).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_policy_acknowledge",
    description:
      "Record an employee acknowledgement of a specific policy version. Prevents duplicates by (employee_id, policy_id, version).",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        policy_id: { type: "string" },
        policy_version: { type: "string" },
        method: { type: "string", default: "attestation" },
        notes: { type: "string" },
      },
      required: ["employee_id", "policy_id", "policy_version"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hr_policy_status",
    description:
      "Check whether an employee is up-to-date on the latest version of a given policy (shows last acknowledged version).",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        policy_id: { type: "string" },
      },
      required: ["employee_id", "policy_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_training_create",
    description: "Create a training module (e.g., Security Awareness, Harassment Prevention). Returns training_id.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string", default: "1.0" },
        provider: { type: "string" },
        url: { type: "string" },
        estimated_minutes: { type: "integer", default: 30 },
        description: { type: "string" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hr_training_list",
    description: "List training modules.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 50 } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_training_assign",
    description:
      "Assign training to an employee for a specific version (due_date optional). Prevents duplicates by (employee_id, training_id, version).",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        training_id: { type: "string" },
        training_version: { type: "string" },
        due_date: { type: "string", description: "ISO date or datetime" },
      },
      required: ["employee_id", "training_id", "training_version"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hr_training_report",
    description:
      "Generate a training completion report (optionally filter by due_before and/or status=assigned/completed).",
    inputSchema: {
      type: "object",
      properties: {
        due_before: { type: "string", description: "ISO date or datetime" },
        status: { type: "string" },
        limit: { type: "integer", default: 200 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // DevRel
  {
    name: "devrel_event_create",
    description:
      "Create a DevRel event (hackathon, meetup, workshop). Tracks dates, prize pool, and status.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", default: "hackathon" },
        starts_at: { type: "string" },
        ends_at: { type: "string" },
        location: { type: "string" },
        url: { type: "string" },
        prize_pool_usd: { type: "number", default: 0 },
        status: { type: "string", default: "planned" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "devrel_event_list",
    description: "List DevRel events (optional status filter).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "integer", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "devrel_event_update_status",
    description: "Update a DevRel event status (planned/active/completed/cancelled).",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        status: { type: "string" },
      },
      required: ["event_id", "status"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "devrel_bounty_create",
    description: "Create a DevRel bounty with reward and tags (stored as JSON array).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        reward_usd: { type: "number", default: 0 },
        tags: { type: "array", items: { type: "string" }, default: [] },
        difficulty: { type: "string", default: "medium" },
      },
      required: ["title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "devrel_bounty_list",
    description: "List bounties (optional status filter).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "devrel_bounty_close",
    description: "Close a bounty.",
    inputSchema: {
      type: "object",
      properties: { bounty_id: { type: "string" } },
      required: ["bounty_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "devrel_submission_submit",
    description:
      "Submit a project to an event or bounty. Provide either event_id or bounty_id. Tracks repo URL and demo URL.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        bounty_id: { type: "string" },
        submitter_agent_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        repo_url: { type: "string" },
        demo_url: { type: "string" },
      },
      required: ["title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "devrel_submission_list",
    description: "List submissions for an event or bounty (or all).",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        bounty_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 200 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "devrel_submission_review",
    description: "Review a submission: set status (accepted/rejected/winner), score, and reviewer notes.",
    inputSchema: {
      type: "object",
      properties: {
        submission_id: { type: "string" },
        status: { type: "string" },
        score: { type: "number" },
        reviewer_notes: { type: "string" },
      },
      required: ["submission_id", "status"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

export async function handlePhase63Tool(name, args) {
  switch (name) {
    // HR
    case "hr_policy_create":
      return hr.createPolicy(args);
    case "hr_policy_list":
      return hr.listPolicies(args);
    case "hr_employee_upsert":
      return hr.upsertEmployee(args);
    case "hr_employee_list":
      return hr.listEmployees(args);
    case "hr_policy_acknowledge":
      return hr.acknowledgePolicy(args);
    case "hr_policy_status":
      return hr.getPolicyStatus(args);
    case "hr_training_create":
      return hr.createTraining(args);
    case "hr_training_list":
      return hr.listTrainings(args);
    case "hr_training_assign":
      return hr.assignTraining(args);
    case "hr_training_report":
      return hr.trainingCompletionReport(args);

    // DevRel
    case "devrel_event_create":
      return devrel.createDevrelEvent(args);
    case "devrel_event_list":
      return devrel.listDevrelEvents(args);
    case "devrel_event_update_status":
      return devrel.updateDevrelEventStatus(args);
    case "devrel_bounty_create":
      return devrel.createBounty(args);
    case "devrel_bounty_list":
      return devrel.listBounties(args);
    case "devrel_bounty_close":
      return devrel.closeBounty(args);
    case "devrel_submission_submit":
      return devrel.submitProject(args);
    case "devrel_submission_list":
      return devrel.listSubmissions(args);
    case "devrel_submission_review":
      return devrel.reviewSubmission(args);

    default:
      return null;
  }
}
