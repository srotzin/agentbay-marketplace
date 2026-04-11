import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEES = {
  mailbox_register: 0.10,
  email_ingest: 0.02,
  email_categorize: 0.03,
  email_draft_reply: 0.05,
  thread_summarize: 0.03,
  followup_plan: 0.02,
  mailbox_dashboard: 5.00,
};

const PRIORITIES = ["urgent", "high", "normal", "low"];
const CATEGORIES = [
  "sales",
  "support",
  "billing",
  "hr",
  "security",
  "legal",
  "product",
  "vendor",
  "internal",
  "personal",
  "spam",
  "unknown",
];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS emailops_mailboxes (
    id            TEXT PRIMARY KEY,
    mailbox       TEXT NOT NULL UNIQUE,
    owner         TEXT,
    team          TEXT,
    tags          TEXT DEFAULT '[]',
    sla_hours     REAL DEFAULT 24,
    policy        TEXT DEFAULT '{}',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emailops_messages (
    id              TEXT PRIMARY KEY,
    mailbox         TEXT NOT NULL,
    message_id      TEXT,
    thread_id       TEXT,
    from_email      TEXT,
    from_name       TEXT,
    to_emails       TEXT DEFAULT '[]',
    cc_emails       TEXT DEFAULT '[]',
    subject         TEXT,
    body_preview    TEXT,
    received_at     TEXT,
    labels          TEXT DEFAULT '[]',
    is_read         INTEGER DEFAULT 0,
    category        TEXT DEFAULT 'unknown',
    priority        TEXT DEFAULT 'normal',
    sentiment       TEXT DEFAULT 'neutral',
    entities        TEXT DEFAULT '[]',
    action_items    TEXT DEFAULT '[]',
    confidence      REAL DEFAULT 0,
    fee_usd         REAL DEFAULT 0.02,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emailops_drafts (
    id              TEXT PRIMARY KEY,
    mailbox         TEXT NOT NULL,
    thread_id       TEXT,
    reply_to        TEXT,
    subject         TEXT,
    draft_body      TEXT NOT NULL,
    tone            TEXT DEFAULT 'professional',
    suggested_labels TEXT DEFAULT '[]',
    requires_review INTEGER DEFAULT 1,
    risk_flags      TEXT DEFAULT '[]',
    fee_usd         REAL DEFAULT 0.05,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emailops_followups (
    id              TEXT PRIMARY KEY,
    mailbox         TEXT NOT NULL,
    thread_id       TEXT,
    followups       TEXT DEFAULT '[]',
    next_due_at     TEXT,
    status          TEXT DEFAULT 'open' CHECK(status IN ('open','completed')),
    fee_usd         REAL DEFAULT 0.02,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emailops_usage_log (
    id          TEXT PRIMARY KEY,
    operation   TEXT NOT NULL,
    fee_usd     REAL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

function logUsage(operation, fee) {
  db.prepare(`
    INSERT OR IGNORE INTO emailops_usage_log (id, operation, fee_usd)
    VALUES (@id, @operation, @fee_usd)
  `).run({ id: uuid(), operation, fee_usd: fee });
}

function normArr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.filter(Boolean);
  return String(x)
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCategory(subject, bodyPreview, fromEmail, labels) {
  const s = `${subject ?? ""} ${bodyPreview ?? ""}`.toLowerCase();
  const l = (labels ?? []).map(x => String(x).toLowerCase());

  if (l.some(x => x.includes("spam") || x.includes("junk"))) return "spam";
  if (s.includes("invoice") || s.includes("payment") || s.includes("refund") || s.includes("billing")) return "billing";
  if (s.includes("interview") || s.includes("candidate") || s.includes("onboarding") || s.includes("payroll")) return "hr";
  if (s.includes("breach") || s.includes("security") || s.includes("phish") || s.includes("2fa") || s.includes("reset")) return "security";
  if (s.includes("contract") || s.includes("nda") || s.includes("msa") || s.includes("dp") || s.includes("privacy")) return "legal";
  if (s.includes("demo") || s.includes("pricing") || s.includes("quote") || s.includes("proposal") || s.includes("trial")) return "sales";
  if (s.includes("bug") || s.includes("error") || s.includes("issue") || s.includes("help") || s.includes("support")) return "support";
  if (fromEmail && fromEmail.toLowerCase().endsWith("@" + (process.env.INTERNAL_DOMAIN ?? "example.com"))) return "internal";

  // Heuristic: newsletters/vendors often have list-unsubscribe-ish keywords
  if (s.includes("unsubscribe") || s.includes("newsletter") || s.includes("receipt")) return "vendor";

  return "unknown";
}

function detectPriority(category, subject, bodyPreview) {
  const s = `${subject ?? ""} ${bodyPreview ?? ""}`.toLowerCase();
  if (s.includes("urgent") || s.includes("asap") || s.includes("immediately")) return "urgent";
  if (category === "security") return "urgent";
  if (category === "billing" && (s.includes("overdue") || s.includes("failed") || s.includes("chargeback"))) return "high";
  if (category === "support" && (s.includes("down") || s.includes("outage") || s.includes("production"))) return "high";
  if (category === "sales" && (s.includes("budget") || s.includes("procurement") || s.includes("signed"))) return "high";
  return "normal";
}

function detectSentiment(bodyPreview) {
  const s = (bodyPreview ?? "").toLowerCase();
  if (s.includes("thank") || s.includes("great") || s.includes("love")) return "positive";
  if (s.includes("angry") || s.includes("frustrat") || s.includes("unacceptable") || s.includes("complaint")) return "negative";
  return "neutral";
}

function extractEntities(subject, bodyPreview) {
  const txt = `${subject ?? ""} ${bodyPreview ?? ""}`;
  const emails = Array.from(new Set((txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).slice(0, 10)));
  const monies = (txt.match(/\$\s?\d+(?:\.\d{2})?/g) ?? []).slice(0, 10);
  const dates = (txt.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g) ?? []).slice(0, 10);
  const domains = Array.from(new Set(emails.map(e => e.split("@")[1]).slice(0, 10)));

  const entities = [];
  for (const e of emails) entities.push({ type: "email", value: e });
  for (const d of domains) entities.push({ type: "domain", value: d });
  for (const m of monies) entities.push({ type: "money", value: m.replace(/\s+/g, "") });
  for (const dt of dates) entities.push({ type: "date", value: dt });
  return entities.slice(0, 25);
}

function suggestActionItems(category, priority, subject, bodyPreview) {
  const base = [];
  if (category === "support") base.push("Collect reproduction steps", "Check status page / monitoring", "Confirm account and environment");
  if (category === "sales") base.push("Qualify ICP and timeline", "Offer demo times", "Send pricing sheet / one-pager");
  if (category === "billing") base.push("Verify invoice details", "Confirm payment method", "Send receipt or credit memo");
  if (category === "security") base.push("Treat as potential incident", "Request headers / evidence", "Advise password reset and 2FA");
  if (category === "legal") base.push("Route to legal review", "Confirm counterparty", "Identify redlines / key terms");
  if (priority === "urgent") base.unshift("Respond within 15 minutes", "Escalate to on-call");

  // Add one generic action to keep output useful
  base.push(`Draft response referencing subject: ${subject ?? "(no subject)"}`);

  return base.slice(0, 8).map((t, i) => ({
    id: uuid().slice(0, 8),
    text: t,
    owner: category === "sales" ? "sales" : category === "support" ? "support" : "ops",
    due: i === 0 && priority !== "low" ? "soon" : "normal",
  }));
}

function buildDraft(category, priority, fromName, fromEmail, subject, bodyPreview, tone) {
  const greetingName = fromName || (fromEmail ? fromEmail.split("@")[0] : "there");

  const openings = {
    professional: `Hi ${greetingName},\n\nThanks for reaching out.`,
    friendly: `Hi ${greetingName},\n\nThanks for your note!`,
    empathetic: `Hi ${greetingName},\n\nI'm sorry this has been frustrating — thanks for flagging it.`,
    formal: `Dear ${greetingName},\n\nWe acknowledge receipt of your message.`,
  };

  const closing = {
    professional: "\n\nBest regards,\nSupport Team",
    friendly: "\n\nThanks,\nSupport Team",
    empathetic: "\n\nThank you,\nSupport Team",
    formal: "\n\nSincerely,\nSupport Team",
  };

  const bodyByCategory = {
    support:
      "\n\nTo help us resolve this quickly, could you share: (1) what you were trying to do, (2) any error message, and (3) your approximate timestamp/timezone? We'll investigate immediately.",
    sales:
      "\n\nHappy to help. Could you share a bit about your use case and timeline? If helpful, I can propose a few times for a short demo this week.",
    billing:
      "\n\nI can help with billing. If you can confirm the invoice number and the email on the account, we can investigate and follow up with the correct details.",
    security:
      "\n\nWe take security reports seriously. Please forward the full message headers (if available) and any relevant details. As a precaution, if you clicked anything suspicious, please change your password and enable 2FA.",
    legal:
      "\n\nThanks for sending this over. We'll route it for review and follow up with any questions or proposed edits.",
    hr:
      "\n\nThanks — we'll review and follow up with next steps. If there are any time constraints, please let us know.",
    vendor:
      "\n\nThanks for the update. We'll review internally and get back to you if we need anything else.",
    internal:
      "\n\nAcknowledged — I'll take a look and circle back.",
    unknown:
      "\n\nThanks for the message. Could you share a bit more detail so we can route this correctly?",
    spam: "\n\n(Filtered as spam; no response drafted.)",
  };

  const urgencyLine = priority === "urgent" ? "\n\nFlagging this as urgent; we're escalating internally now." : "";
  const quote = bodyPreview ? `\n\n---\nContext (preview):\n${String(bodyPreview).slice(0, 500)}\n---` : "";

  const op = openings[tone] ?? openings.professional;
  const catBody = bodyByCategory[category] ?? bodyByCategory.unknown;
  const cl = closing[tone] ?? closing.professional;

  return `${op}${catBody}${urgencyLine}${quote}${cl}`;
}

// ─── Public API (tool handlers call these) ────────────────────────────────────

export function mailbox_register({ mailbox, owner, team, tags, sla_hours, policy } = {}) {
  if (!mailbox) throw new Error("mailbox is required");
  const fee = FEES.mailbox_register;
  const id = uuid();

  const existing = db.prepare("SELECT * FROM emailops_mailboxes WHERE mailbox = ?").get(mailbox);
  if (existing) {
    db.prepare(
      `UPDATE emailops_mailboxes
       SET owner=@owner, team=@team, tags=@tags, sla_hours=@sla_hours, policy=@policy, updated_at=datetime('now')
       WHERE mailbox=@mailbox`
    ).run({
      mailbox,
      owner: owner ?? existing.owner,
      team: team ?? existing.team,
      tags: JSON.stringify(tags ?? JSON.parse(existing.tags ?? "[]")),
      sla_hours: sla_hours ?? existing.sla_hours,
      policy: JSON.stringify(policy ?? JSON.parse(existing.policy ?? "{}")),
    });

    logUsage("mailbox_register", fee);
    return { ...existing, owner: owner ?? existing.owner, team: team ?? existing.team, fee_usd: fee, updated: true };
  }

  db.prepare(
    `INSERT INTO emailops_mailboxes (id, mailbox, owner, team, tags, sla_hours, policy)
     VALUES (@id, @mailbox, @owner, @team, @tags, @sla_hours, @policy)`
  ).run({
    id,
    mailbox,
    owner: owner ?? null,
    team: team ?? null,
    tags: JSON.stringify(tags ?? []),
    sla_hours: sla_hours ?? 24,
    policy: JSON.stringify(policy ?? {}),
  });

  logUsage("mailbox_register", fee);
  return {
    id,
    mailbox,
    owner: owner ?? null,
    team: team ?? null,
    tags: tags ?? [],
    sla_hours: sla_hours ?? 24,
    policy: policy ?? {},
    fee_usd: fee,
    created: true,
  };
}

export function email_ingest({
  mailbox,
  message_id,
  thread_id,
  from_email,
  from_name,
  to_emails,
  cc_emails,
  subject,
  body_preview,
  received_at,
  labels,
  is_read,
} = {}) {
  if (!mailbox) throw new Error("mailbox is required");
  const fee = FEES.email_ingest;

  const msg = {
    id: uuid(),
    mailbox,
    message_id: message_id ?? uuid().slice(0, 12),
    thread_id: thread_id ?? `t_${uuid().slice(0, 10)}`,
    from_email: from_email ?? "unknown@example.com",
    from_name: from_name ?? null,
    to_emails: normArr(to_emails),
    cc_emails: normArr(cc_emails),
    subject: subject ?? "(no subject)",
    body_preview: (body_preview ?? "").slice(0, 2000),
    received_at: received_at ?? new Date().toISOString(),
    labels: normArr(labels),
    is_read: is_read ? 1 : 0,
  };

  const category = detectCategory(msg.subject, msg.body_preview, msg.from_email, msg.labels);
  const priority = detectPriority(category, msg.subject, msg.body_preview);
  const sentiment = detectSentiment(msg.body_preview);
  const entities = extractEntities(msg.subject, msg.body_preview);
  const actionItems = suggestActionItems(category, priority, msg.subject, msg.body_preview);

  db.prepare(
    `INSERT INTO emailops_messages
      (id, mailbox, message_id, thread_id, from_email, from_name, to_emails, cc_emails, subject, body_preview,
       received_at, labels, is_read, category, priority, sentiment, entities, action_items, confidence, fee_usd)
     VALUES
      (@id, @mailbox, @message_id, @thread_id, @from_email, @from_name, @to_emails, @cc_emails, @subject, @body_preview,
       @received_at, @labels, @is_read, @category, @priority, @sentiment, @entities, @action_items, @confidence, @fee_usd)`
  ).run({
    ...msg,
    to_emails: JSON.stringify(msg.to_emails),
    cc_emails: JSON.stringify(msg.cc_emails),
    labels: JSON.stringify(msg.labels),
    category,
    priority,
    sentiment,
    entities: JSON.stringify(entities),
    action_items: JSON.stringify(actionItems),
    confidence: 0.65 + Math.random() * 0.25,
    fee_usd: fee,
  });

  logUsage("email_ingest", fee);
  return {
    ...msg,
    category,
    priority,
    sentiment,
    entities,
    action_items: actionItems,
    confidence: 0.8,
    fee_usd: fee,
  };
}

export function email_categorize({ message_id, id, category, priority, labels } = {}) {
  const fee = FEES.email_categorize;
  const row = id
    ? db.prepare("SELECT * FROM emailops_messages WHERE id = ?").get(id)
    : db.prepare("SELECT * FROM emailops_messages WHERE message_id = ? ORDER BY created_at DESC").get(message_id);
  if (!row) throw new Error("message not found");

  const nextCategory = category && CATEGORIES.includes(category) ? category : row.category;
  const nextPriority = priority && PRIORITIES.includes(priority) ? priority : row.priority;
  const nextLabels = labels ? normArr(labels) : JSON.parse(row.labels ?? "[]");

  db.prepare(
    `UPDATE emailops_messages
     SET category=@category, priority=@priority, labels=@labels
     WHERE id=@id`
  ).run({ id: row.id, category: nextCategory, priority: nextPriority, labels: JSON.stringify(nextLabels) });

  logUsage("email_categorize", fee);
  return {
    id: row.id,
    message_id: row.message_id,
    mailbox: row.mailbox,
    thread_id: row.thread_id,
    category: nextCategory,
    priority: nextPriority,
    labels: nextLabels,
    fee_usd: fee,
  };
}

export function email_draft_reply({ mailbox, thread_id, reply_to, subject, body_preview, category, priority, tone } = {}) {
  if (!mailbox) throw new Error("mailbox is required");
  const fee = FEES.email_draft_reply;

  const inferredCategory = category && CATEGORIES.includes(category) ? category : detectCategory(subject, body_preview);
  const inferredPriority = priority && PRIORITIES.includes(priority) ? priority : detectPriority(inferredCategory, subject, body_preview);

  const t = tone ?? "professional";
  const draftBody = buildDraft(inferredCategory, inferredPriority, null, reply_to, subject, body_preview, t);

  const riskFlags = [];
  if (inferredCategory === "legal") riskFlags.push("legal_review_recommended");
  if (inferredCategory === "security") riskFlags.push("security_team_review");
  if (draftBody.toLowerCase().includes("refund") && inferredCategory === "billing") riskFlags.push("refund_policy_check");

  const suggestedLabels = [];
  if (inferredCategory !== "unknown" && inferredCategory !== "spam") suggestedLabels.push(`cat:${inferredCategory}`);
  if (inferredPriority === "urgent") suggestedLabels.push("prio:urgent");

  const draft = {
    id: uuid(),
    mailbox,
    thread_id: thread_id ?? `t_${uuid().slice(0, 10)}`,
    reply_to: reply_to ?? "unknown@example.com",
    subject: subject ?? "(no subject)",
    draft_body: draftBody,
    tone: t,
    suggested_labels: suggestedLabels,
    requires_review: riskFlags.length ? 1 : 0,
    risk_flags: riskFlags,
    fee_usd: fee,
  };

  db.prepare(
    `INSERT INTO emailops_drafts
      (id, mailbox, thread_id, reply_to, subject, draft_body, tone, suggested_labels, requires_review, risk_flags, fee_usd)
     VALUES
      (@id, @mailbox, @thread_id, @reply_to, @subject, @draft_body, @tone, @suggested_labels, @requires_review, @risk_flags, @fee_usd)`
  ).run({
    ...draft,
    suggested_labels: JSON.stringify(draft.suggested_labels),
    risk_flags: JSON.stringify(draft.risk_flags),
  });

  logUsage("email_draft_reply", fee);
  return draft;
}

export function thread_summarize({ mailbox, thread_id } = {}) {
  const fee = FEES.thread_summarize;
  if (!mailbox || !thread_id) throw new Error("mailbox and thread_id are required");

  const rows = db
    .prepare(
      `SELECT * FROM emailops_messages
       WHERE mailbox = ? AND thread_id = ?
       ORDER BY received_at ASC, created_at ASC
       LIMIT 200`
    )
    .all(mailbox, thread_id);

  const messages = rows.map(r => ({
    message_id: r.message_id,
    from: r.from_email,
    subject: r.subject,
    preview: (r.body_preview ?? "").slice(0, 200),
    received_at: r.received_at,
    category: r.category,
    priority: r.priority,
  }));

  const category = rows.length ? rows[rows.length - 1].category : "unknown";
  const priority = rows.length ? rows[rows.length - 1].priority : "normal";

  const summary = {
    mailbox,
    thread_id,
    message_count: rows.length,
    inferred_category: category,
    inferred_priority: priority,
    key_points: rows.length
      ? [
          `Thread has ${rows.length} message(s).`,
          `Most recent subject: ${(rows[rows.length - 1].subject ?? "(no subject)").slice(0, 120)}`,
          "Identify sender intent and confirm next steps.",
        ]
      : ["No messages ingested for this thread yet."],
    next_actions: rows.length ? suggestActionItems(category, priority, rows[rows.length - 1].subject, rows[rows.length - 1].body_preview) : [],
    messages,
    fee_usd: fee,
  };

  logUsage("thread_summarize", fee);
  return summary;
}

export function followup_plan({ mailbox, thread_id, objective, cadence_days } = {}) {
  if (!mailbox || !thread_id) throw new Error("mailbox and thread_id are required");
  const fee = FEES.followup_plan;

  const cad = Math.max(1, Math.min(Number(cadence_days ?? 3), 30));
  const obj = objective ?? "Get a response and confirm next steps";

  const steps = [
    { day_offset: 0, channel: "email", template: "Quick acknowledgement + ask for missing details", objective: obj },
    { day_offset: cad, channel: "email", template: "Polite follow-up + propose next steps", objective: obj },
    { day_offset: cad * 2, channel: "email", template: "Final follow-up + close loop / offer alternative channel", objective: obj },
  ];

  const nextDue = new Date(Date.now() + 1000 * 60 * 60 * 24 * steps[0].day_offset).toISOString();

  const rec = {
    id: uuid(),
    mailbox,
    thread_id,
    followups: steps,
    next_due_at: nextDue,
    status: "open",
    fee_usd: fee,
  };

  db.prepare(
    `INSERT INTO emailops_followups (id, mailbox, thread_id, followups, next_due_at, status, fee_usd)
     VALUES (@id, @mailbox, @thread_id, @followups, @next_due_at, @status, @fee_usd)`
  ).run({
    ...rec,
    followups: JSON.stringify(rec.followups),
  });

  logUsage("followup_plan", fee);
  return rec;
}

export function mailbox_dashboard({ mailbox, window_hours, limit } = {}) {
  const fee = FEES.mailbox_dashboard;
  if (!mailbox) throw new Error("mailbox is required");

  const hours = Math.max(1, Math.min(Number(window_hours ?? 168), 24 * 30));
  const lim = Math.max(1, Math.min(Number(limit ?? 200), 1000));

  const rows = db
    .prepare(
      `SELECT * FROM emailops_messages
       WHERE mailbox = ?
         AND datetime(received_at) >= datetime('now', ?)
       ORDER BY datetime(received_at) DESC
       LIMIT ?`
    )
    .all(mailbox, `-${hours} hours`, lim);

  const counts = {
    total: rows.length,
    by_category: {},
    by_priority: {},
    unread: 0,
    urgent: 0,
    negative_sentiment: 0,
  };

  for (const r of rows) {
    counts.by_category[r.category] = (counts.by_category[r.category] ?? 0) + 1;
    counts.by_priority[r.priority] = (counts.by_priority[r.priority] ?? 0) + 1;
    if (!r.is_read) counts.unread += 1;
    if (r.priority === "urgent") counts.urgent += 1;
    if (r.sentiment === "negative") counts.negative_sentiment += 1;
  }

  const topThreads = {};
  for (const r of rows) {
    const k = r.thread_id;
    if (!k) continue;
    topThreads[k] = (topThreads[k] ?? 0) + 1;
  }

  const hotThreads = Object.entries(topThreads)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([thread_id, message_count]) => ({ thread_id, message_count }));

  logUsage("mailbox_dashboard", fee);
  return {
    mailbox,
    window_hours: hours,
    metrics: counts,
    hot_threads: hotThreads,
    sample_messages: rows.slice(0, 20).map(r => ({
      message_id: r.message_id,
      thread_id: r.thread_id,
      from: r.from_email,
      subject: r.subject,
      received_at: r.received_at,
      category: r.category,
      priority: r.priority,
      is_read: Boolean(r.is_read),
    })),
    fee_usd: fee,
  };
}
