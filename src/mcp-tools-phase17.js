import * as pdfForms from "./services/pdf-forms.js";

// Phase 17: Document & form workflows (PDF form extraction + fill)

export const phase17Tools = [
  {
    name: "hiveagent_pdf_forms_extract_fields",
    description: "Extract suggested fillable field names from a PDF form URL (simulation/planning layer). Use to plan a fill workflow, estimate effort, and build a template schema.",
    inputSchema: {
      type: "object",
      properties: {
        input_pdf_url: { type: "string", description: "Publicly accessible PDF URL" },
        options: { type: "object", description: "Optional extraction settings (reserved for future real parser integration)", default: {} },
      },
      required: ["input_pdf_url"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_pdf_forms_create_template",
    description: "Create a reusable PDF form template schema (field list) that can be used for repeatable fill jobs.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Template name" },
        description: { type: "string", description: "Template description", default: "" },
        fields: {
          type: "array",
          description: "Array of fields: {name,type,required,hint}. The module will normalize and generate stable keys.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", description: "Field type: text|checkbox|radio|signature|date (best-effort)" },
              required: { type: "boolean", default: false },
              hint: { type: "string", default: "" },
            },
            required: ["name"],
          },
        },
      },
      required: ["name", "fields"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_pdf_forms_get_template",
    description: "Fetch a PDF form template schema by template_id.",
    inputSchema: {
      type: "object",
      properties: {
        template_id: { type: "string", description: "Template ID" },
      },
      required: ["template_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hiveagent_pdf_forms_list_templates",
    description: "List recently created PDF form templates.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max templates to return (default 50)", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hiveagent_pdf_forms_fill_form",
    description: "Fill a PDF form using a template schema and field values (simulation layer returns a placeholder output URL).",
    inputSchema: {
      type: "object",
      properties: {
        template_id: { type: "string", description: "Template ID" },
        input_pdf_url: { type: "string", description: "Publicly accessible PDF URL" },
        field_values: { type: "object", description: "Map of template field keys to values" },
        options: { type: "object", description: "Optional fill settings (reserved for future real PDF engine integration)", default: {} },
      },
      required: ["template_id", "input_pdf_url", "field_values"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "hiveagent_pdf_forms_get_job",
    description: "Fetch a PDF form job by job_id.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID" },
      },
      required: ["job_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hiveagent_pdf_forms_list_jobs",
    description: "List recent PDF form jobs.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max jobs to return (default 50)", default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export async function handlePhase17Tool(name, args) {
  switch (name) {
    case "hiveagent_pdf_forms_extract_fields":
      return pdfForms.pdfFormsExtractFields(args.input_pdf_url, args.options ?? {});

    case "hiveagent_pdf_forms_create_template":
      return pdfForms.pdfFormsCreateTemplate(args.name, args.description ?? "", args.fields);

    case "hiveagent_pdf_forms_get_template":
      return pdfForms.pdfFormsGetTemplate(args.template_id);

    case "hiveagent_pdf_forms_list_templates":
      return pdfForms.pdfFormsListTemplates(args.limit ?? 50);

    case "hiveagent_pdf_forms_fill_form":
      return pdfForms.pdfFormsFillForm(args.template_id, args.input_pdf_url, args.field_values, args.options ?? {});

    case "hiveagent_pdf_forms_get_job":
      return pdfForms.pdfFormsGetJob(args.job_id);

    case "hiveagent_pdf_forms_list_jobs":
      return pdfForms.pdfFormsListJobs(args.limit ?? 50);

    default:
      throw new Error(`Unknown Phase 17 tool: ${name}`);
  }
}
