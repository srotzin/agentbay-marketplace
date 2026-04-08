import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pdf_form_templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    provider        TEXT DEFAULT 'generic',
    field_schema    TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pdf_form_jobs (
    id              TEXT PRIMARY KEY,
    template_id     TEXT REFERENCES pdf_form_templates(id),
    mode            TEXT NOT NULL CHECK(mode IN ('extract_fields','fill_form')),
    input_pdf_url   TEXT,
    output_pdf_url  TEXT,
    field_values    TEXT,
    status          TEXT DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
    result_summary  TEXT,
    result_data     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ _error: "json_serialize_failed" });
  }
}

function safeParseJson(value, fallback) {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeFieldName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 120);
}

function buildFieldSchema(fields) {
  const seen = new Set();
  const out = [];
  for (const f of fields) {
    const raw = normalizeFieldName(f.name);
    const keyBase = raw
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    let key = keyBase || `field_${out.length + 1}`;
    let i = 2;
    while (seen.has(key)) {
      key = `${keyBase || "field"}_${i++}`;
    }
    seen.add(key);
    out.push({
      key,
      name: raw || key,
      type: f.type || "text",
      required: Boolean(f.required),
      hint: f.hint || "",
    });
  }
  return out;
}

function estimateFillMinutes(fieldSchema) {
  const n = Array.isArray(fieldSchema) ? fieldSchema.length : 0;
  // Very rough: most PDF fill jobs are short, but can grow with field count.
  return Math.max(3, Math.min(45, Math.round(2 + n * 0.35)));
}

function quoteUsdForJob(mode, fieldSchema) {
  const base = mode === "extract_fields" ? 2.5 : 3.5;
  const n = Array.isArray(fieldSchema) ? fieldSchema.length : 0;
  const variable = Math.round((n * 0.08) * 100) / 100;
  return Math.round((base + variable) * 100) / 100;
}

// ─── Template Registry ────────────────────────────────────────────────────────

export function pdfFormsCreateTemplate(name, description, fields) {
  if (!name) throw new Error("name is required");
  if (!Array.isArray(fields) || fields.length === 0) throw new Error("fields must be a non-empty array");

  const id = uuid();
  const fieldSchema = buildFieldSchema(fields);

  db.prepare(`
    INSERT INTO pdf_form_templates (id, name, description, provider, field_schema)
    VALUES (@id, @name, @description, @provider, @field_schema)
  `).run({
    id,
    name,
    description: description ?? null,
    provider: "generic",
    field_schema: toJson(fieldSchema),
  });

  return {
    template_id: id,
    name,
    description: description ?? null,
    provider: "generic",
    fields: fieldSchema,
    created_at: new Date().toISOString(),
  };
}

export function pdfFormsGetTemplate(templateId) {
  const tpl = db.prepare("SELECT * FROM pdf_form_templates WHERE id = ?").get(templateId);
  if (!tpl) throw new Error(`Template not found: ${templateId}`);

  return {
    template_id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    provider: tpl.provider,
    fields: safeParseJson(tpl.field_schema, []),
    created_at: tpl.created_at,
  };
}

export function pdfFormsListTemplates(limit = 50) {
  const rows = db.prepare("SELECT id, name, description, provider, created_at FROM pdf_form_templates ORDER BY created_at DESC LIMIT ?").all(limit);
  return rows.map(r => ({
    template_id: r.id,
    name: r.name,
    description: r.description,
    provider: r.provider,
    created_at: r.created_at,
  }));
}

// ─── Job Creation ─────────────────────────────────────────────────────────────

/**
 * Extract fillable field names from a PDF.
 * Note: This is a simulation layer intended for agents to plan and budget.
 * In production, wire to a real PDF parser / form field extractor.
 */
export function pdfFormsExtractFields(inputPdfUrl, options = {}) {
  if (!inputPdfUrl) throw new Error("inputPdfUrl is required");

  const id = uuid();
  const now = new Date().toISOString();

  // Simulated extraction: generate a minimal schema that agents can extend.
  const guessedFields = buildFieldSchema([
    { name: "Full Name", type: "text", required: true, hint: "Legal name" },
    { name: "Email", type: "text", required: false, hint: "Contact email" },
    { name: "Phone", type: "text", required: false, hint: "Contact phone" },
    { name: "Address", type: "text", required: false, hint: "Street + city + postal" },
    { name: "Date", type: "text", required: false, hint: "MM/DD/YYYY" },
    { name: "Signature", type: "signature", required: false, hint: "Signature block" },
  ]);

  const minutes = estimateFillMinutes(guessedFields);
  const priceUsd = quoteUsdForJob("extract_fields", guessedFields);

  db.prepare(`
    INSERT INTO pdf_form_jobs
      (id, template_id, mode, input_pdf_url, field_values, status, result_summary, result_data, created_at)
    VALUES
      (@id, NULL, 'extract_fields', @input_pdf_url, NULL, 'completed', @result_summary, @result_data, @created_at)
  `).run({
    id,
    input_pdf_url: inputPdfUrl,
    result_summary: "Simulated PDF field extraction completed.",
    result_data: toJson({
      input_pdf_url: inputPdfUrl,
      extraction_mode: "simulated",
      suggested_fields: guessedFields,
      notes: [
        "For accurate extraction, connect a real PDF form field parser (e.g., pdftk, qpdf + pypdf, or a commercial forms API).",
        "If the PDF is a scanned image, run OCR first and map fields manually.",
      ],
      cost_estimate_usd: priceUsd,
      estimated_minutes: minutes,
      options_used: options,
    }),
    created_at: now,
  });

  return {
    job_id: id,
    mode: "extract_fields",
    status: "completed",
    input_pdf_url: inputPdfUrl,
    suggested_fields: guessedFields,
    estimated_minutes: minutes,
    estimated_cost_usd: priceUsd,
    created_at: now,
  };
}

/**
 * Fill a PDF form using a stored template schema.
 * This module is a planning + bookkeeping layer that returns a deterministic output URL placeholder.
 */
export function pdfFormsFillForm(templateId, inputPdfUrl, fieldValues, options = {}) {
  if (!templateId) throw new Error("templateId is required");
  if (!inputPdfUrl) throw new Error("inputPdfUrl is required");
  if (fieldValues == null || typeof fieldValues !== "object") throw new Error("fieldValues must be an object");

  const tpl = db.prepare("SELECT * FROM pdf_form_templates WHERE id = ?").get(templateId);
  if (!tpl) throw new Error(`Template not found: ${templateId}`);

  const schema = safeParseJson(tpl.field_schema, []);
  const id = uuid();
  const now = new Date().toISOString();

  const missingRequired = schema
    .filter(f => f.required)
    .map(f => f.key)
    .filter(k => fieldValues[k] == null || String(fieldValues[k]).trim() === "");

  if (missingRequired.length) {
    throw new Error(`Missing required fields: ${missingRequired.join(", ")}`);
  }

  const minutes = estimateFillMinutes(schema);
  const priceUsd = quoteUsdForJob("fill_form", schema);

  // Deterministic placeholder output URL. In production, this would point to a file store.
  const outputPdfUrl = `https://files.hiveagent.local/pdf/${id}.pdf`;

  db.prepare(`
    INSERT INTO pdf_form_jobs
      (id, template_id, mode, input_pdf_url, output_pdf_url, field_values, status, result_summary, result_data, created_at, completed_at)
    VALUES
      (@id, @template_id, 'fill_form', @input_pdf_url, @output_pdf_url, @field_values, 'completed', @result_summary, @result_data, @created_at, @completed_at)
  `).run({
    id,
    template_id: templateId,
    input_pdf_url: inputPdfUrl,
    output_pdf_url: outputPdfUrl,
    field_values: toJson(fieldValues),
    result_summary: "Simulated PDF fill completed (placeholder output URL).",
    result_data: toJson({
      template: { id: tpl.id, name: tpl.name, provider: tpl.provider },
      input_pdf_url: inputPdfUrl,
      output_pdf_url: outputPdfUrl,
      filled_fields: Object.keys(fieldValues),
      warnings: [
        "This module currently simulates PDF output. Wire to a PDF forms engine to generate real filled PDFs.",
      ],
      cost_estimate_usd: priceUsd,
      estimated_minutes: minutes,
      options_used: options,
    }),
    created_at: now,
    completed_at: now,
  });

  return {
    job_id: id,
    mode: "fill_form",
    status: "completed",
    template: { template_id: tpl.id, name: tpl.name, provider: tpl.provider },
    input_pdf_url: inputPdfUrl,
    output_pdf_url: outputPdfUrl,
    estimated_minutes: minutes,
    estimated_cost_usd: priceUsd,
    created_at: now,
  };
}

export function pdfFormsGetJob(jobId) {
  const job = db.prepare("SELECT * FROM pdf_form_jobs WHERE id = ?").get(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  return {
    job_id: job.id,
    template_id: job.template_id,
    mode: job.mode,
    status: job.status,
    input_pdf_url: job.input_pdf_url,
    output_pdf_url: job.output_pdf_url,
    field_values: safeParseJson(job.field_values, null),
    result_summary: job.result_summary,
    result_data: safeParseJson(job.result_data, null),
    created_at: job.created_at,
    completed_at: job.completed_at,
  };
}

export function pdfFormsListJobs(limit = 50) {
  const rows = db.prepare("SELECT id, mode, status, input_pdf_url, output_pdf_url, created_at FROM pdf_form_jobs ORDER BY created_at DESC LIMIT ?").all(limit);
  return rows.map(r => ({
    job_id: r.id,
    mode: r.mode,
    status: r.status,
    input_pdf_url: r.input_pdf_url,
    output_pdf_url: r.output_pdf_url,
    created_at: r.created_at,
  }));
}
