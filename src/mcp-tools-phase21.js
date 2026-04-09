// Phase 21: Patient Intake + Manufacturing QA

import * as intake from "./services/patient-intake.js";
import * as qa from "./services/manufacturing-qa.js";

export const phase21Tools = [
  {
    name: "hiveagent_intake_create_form",
    description: "Create a structured patient intake form schema for an organization.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organization ID" },
        name: { type: "string", description: "Form name" },
        schema: { type: "object", description: "Lightweight schema: {required:[...], fields:{field:{type:string|number|boolean|object}}}" },
      },
      required: ["org_id", "name", "schema"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_intake_list_forms",
    description: "List all intake forms for an organization.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organization ID" },
      },
      required: ["org_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hiveagent_intake_submit",
    description: "Submit an intake payload (optionally validated against a stored form schema). Returns validation errors + pricing quote.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organization ID" },
        form_id: { type: "string", description: "Optional form ID" },
        payload: { type: "object", description: "Intake payload" },
        patient_ref: { type: "string", description: "Optional external patient reference" },
      },
      required: ["org_id", "payload"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_intake_eligibility_check",
    description: "Record a mock eligibility check for a submission (placeholder for payer integrations).",
    inputSchema: {
      type: "object",
      properties: {
        submission_id: { type: "string", description: "Intake submission ID" },
        payer: { type: "string", description: "Payer name" },
        policy_number: { type: "string", description: "Optional policy number" },
        service_code: { type: "string", description: "Optional service/procedure code" },
      },
      required: ["submission_id", "payer"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_intake_build_prior_auth_packet",
    description: "Generate a prior authorization packet from an intake submission (requires clinical/admin review before sending).",
    inputSchema: {
      type: "object",
      properties: {
        submission_id: { type: "string", description: "Intake submission ID" },
        options: { type: "object", description: "Options (e.g., {notes: '...'} )", default: {} },
      },
      required: ["submission_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "hiveagent_qa_create_lot",
    description: "Create a QA lot / batch record for incoming materials or finished goods.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organization ID" },
        sku: { type: "string", description: "SKU or part number" },
        supplier: { type: "string", description: "Optional supplier" },
        received_at: { type: "string", description: "Optional ISO timestamp" },
      },
      required: ["org_id", "sku"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_qa_update_lot_status",
    description: "Update a QA lot status: open|accepted|rejected|quarantined.",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        status: { type: "string", enum: ["open","accepted","rejected","quarantined"], description: "New status" },
      },
      required: ["lot_id", "status"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_qa_create_inspection",
    description: "Create an inspection record for a lot: incoming|in_process|final|audit.",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        inspection_type: { type: "string", enum: ["incoming","in_process","final","audit"], description: "Inspection type" },
        checklist: { type: "object", description: "Checklist object" },
      },
      required: ["lot_id", "inspection_type", "checklist"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_qa_record_findings",
    description: "Record inspection findings and return pass/fail plus pricing quote.",
    inputSchema: {
      type: "object",
      properties: {
        inspection_id: { type: "string", description: "Inspection ID" },
        findings: { type: "object", description: "Findings object (optionally {items:[{failed:true}], severity})" },
      },
      required: ["inspection_id", "findings"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_qa_create_defect",
    description: "Create a defect linked to a lot (and optionally an inspection).",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        inspection_id: { type: "string", description: "Optional inspection ID" },
        title: { type: "string", description: "Defect title" },
        description: { type: "string", description: "Optional details" },
        severity: { type: "string", enum: ["low","medium","high","critical"], description: "Severity" },
      },
      required: ["lot_id", "title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_qa_create_capa",
    description: "Create a CAPA record (root cause + corrective/preventive actions) for a defect.",
    inputSchema: {
      type: "object",
      properties: {
        defect_id: { type: "string", description: "Defect ID" },
        fields: { type: "object", description: "Fields: root_cause, corrective_action, preventive_action, owner, due_date" },
      },
      required: ["defect_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

export function handlePhase21Tool(name, args) {
  switch (name) {
    case "hiveagent_intake_create_form":
      return intake.createIntakeForm(args.org_id, args.name, args.schema);
    case "hiveagent_intake_list_forms":
      return intake.listIntakeForms(args.org_id);
    case "hiveagent_intake_submit":
      return intake.submitIntake(args.org_id, args.form_id ?? null, args.payload, args.patient_ref ?? null);
    case "hiveagent_intake_eligibility_check":
      return intake.runEligibilityCheck(args.submission_id, args.payer, args.policy_number ?? null, args.service_code ?? null);
    case "hiveagent_intake_build_prior_auth_packet":
      return intake.buildPriorAuthPacket(args.submission_id, args.options ?? {});

    case "hiveagent_qa_create_lot":
      return qa.createQaLot(args.org_id, args.sku, args.supplier ?? null, args.received_at ?? null);
    case "hiveagent_qa_update_lot_status":
      return qa.updateQaLotStatus(args.lot_id, args.status);
    case "hiveagent_qa_create_inspection":
      return qa.createInspection(args.lot_id, args.inspection_type, args.checklist);
    case "hiveagent_qa_record_findings":
      return qa.recordInspectionFindings(args.inspection_id, args.findings);
    case "hiveagent_qa_create_defect":
      return qa.createDefect(args.lot_id, args.inspection_id ?? null, args.title, args.description ?? null, args.severity ?? "medium");
    case "hiveagent_qa_create_capa":
      return qa.createCapa(args.defect_id, args.fields ?? {});

    default:
      throw new Error(`Unknown Phase 21 tool: ${name}`);
  }
}
