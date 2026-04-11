/**
 * HiveAgent MCP Tools — Phase 65
 *
 * Email Operations: shared inbox triage, categorization, drafts, thread summaries, and follow-up planning.
 */

import * as eo from "./services/email-operations.js";

export const phase65EmailOpsTools = [
  {
    name: "emailops_mailbox_register",
    description: "Register or update a mailbox (shared inbox) with owner/team, tags, and SLA policy.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string", description: "Mailbox identifier (e.g., support@company.com)." },
        owner: { type: "string" },
        team: { type: "string" },
        tags: { type: "array", items: { type: "string" }, default: [] },
        sla_hours: { type: "number", default: 24 },
        policy: { type: "object", default: {} },
      },
      required: ["mailbox"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "emailops_email_ingest",
    description: "Ingest an email message (metadata + preview), auto-classify (category/priority/sentiment), and persist.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string" },
        message_id: { type: "string" },
        thread_id: { type: "string" },
        from_email: { type: "string" },
        from_name: { type: "string" },
        to_emails: { type: ["array", "string"], items: { type: "string" } },
        cc_emails: { type: ["array", "string"], items: { type: "string" } },
        subject: { type: "string" },
        body_preview: { type: "string" },
        received_at: { type: "string", description: "ISO datetime; defaults to now" },
        labels: { type: ["array", "string"], items: { type: "string" } },
        is_read: { type: "boolean", default: false },
      },
      required: ["mailbox"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "emailops_email_categorize",
    description: "Update an ingested email's category/priority/labels (by id or message_id).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        message_id: { type: "string" },
        category: { type: "string", description: "sales/support/billing/hr/security/legal/product/vendor/internal/personal/spam/unknown" },
        priority: { type: "string", description: "urgent/high/normal/low" },
        labels: { type: ["array", "string"], items: { type: "string" } },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "emailops_email_draft_reply",
    description: "Create a reply draft for a thread (best-effort) with risk flags and suggested labels.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string" },
        thread_id: { type: "string" },
        reply_to: { type: "string" },
        subject: { type: "string" },
        body_preview: { type: "string" },
        category: { type: "string" },
        priority: { type: "string" },
        tone: { type: "string", default: "professional", description: "professional/friendly/empathetic/formal" },
      },
      required: ["mailbox"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "emailops_thread_summarize",
    description: "Summarize an ingested thread: key points, message list, inferred category/priority, and suggested next actions.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string" },
        thread_id: { type: "string" },
      },
      required: ["mailbox", "thread_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "emailops_followup_plan",
    description: "Create a simple follow-up plan (cadence + templates) and persist it.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string" },
        thread_id: { type: "string" },
        objective: { type: "string" },
        cadence_days: { type: "number", default: 3 },
      },
      required: ["mailbox", "thread_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "emailops_mailbox_dashboard",
    description: "Mailbox dashboard: last N hours metrics (unread, urgent, categories) + hot threads + sample messages.",
    inputSchema: {
      type: "object",
      properties: {
        mailbox: { type: "string" },
        window_hours: { type: "number", default: 168 },
        limit: { type: "integer", default: 200 },
      },
      required: ["mailbox"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export function handlePhase65EmailOpsTool(name, args) {
  switch (name) {
    case "emailops_mailbox_register":
      return eo.mailbox_register(args);
    case "emailops_email_ingest":
      return eo.email_ingest(args);
    case "emailops_email_categorize":
      return eo.email_categorize(args);
    case "emailops_email_draft_reply":
      return eo.email_draft_reply(args);
    case "emailops_thread_summarize":
      return eo.thread_summarize(args);
    case "emailops_followup_plan":
      return eo.followup_plan(args);
    case "emailops_mailbox_dashboard":
      return eo.mailbox_dashboard(args);
    default:
      return null;
  }
}
