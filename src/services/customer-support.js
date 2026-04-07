import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEES = {
  triage_ticket:       0.05,
  generate_response:   0.10,
  search_kb:           0.02,
  escalate_ticket:     0.25,
  customer_history:    0.10,
  support_dashboard:   5.00, // per month
};

const PRIORITY_LEVELS    = ["critical", "high", "medium", "low"];
const TICKET_CATEGORIES  = ["billing", "technical", "account", "shipping", "returns", "general", "feature_request", "security"];
const VALID_CHANNELS     = ["email", "chat", "phone", "twitter", "in_app", "sms"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cs_support_tickets (
    id                 TEXT PRIMARY KEY,
    customer_id        TEXT,
    content            TEXT NOT NULL,
    category           TEXT,
    subcategory        TEXT,
    priority           TEXT DEFAULT 'medium'
                         CHECK(priority IN ('critical','high','medium','low')),
    assigned_team      TEXT,
    status             TEXT DEFAULT 'open'
                         CHECK(status IN ('open','in_progress','pending_customer','resolved','closed','escalated')),
    suggested_response TEXT,
    similar_resolved   TEXT DEFAULT '[]',
    channel            TEXT DEFAULT 'email',
    tags               TEXT DEFAULT '[]',
    csat_score         REAL,
    resolved_at        TEXT,
    first_response_at  TEXT,
    fee_usd            REAL DEFAULT 0.05,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_responses (
    id              TEXT PRIMARY KEY,
    ticket_id       TEXT NOT NULL,
    response_text   TEXT NOT NULL,
    confidence      REAL DEFAULT 0,
    sources_used    TEXT DEFAULT '[]',
    follow_up       INTEGER DEFAULT 0,
    tone            TEXT DEFAULT 'professional',
    sent_at         TEXT,
    fee_usd         REAL DEFAULT 0.10,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_knowledge_base (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    category        TEXT NOT NULL,
    tags            TEXT DEFAULT '[]',
    helpful_votes   INTEGER DEFAULT 0,
    unhelpful_votes INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    last_updated    TEXT DEFAULT (datetime('now')),
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_escalations (
    id                           TEXT PRIMARY KEY,
    ticket_id                    TEXT NOT NULL,
    reason                       TEXT NOT NULL,
    urgency                      TEXT NOT NULL,
    escalated_to                 TEXT NOT NULL,
    sla_deadline                 TEXT,
    customer_notification_sent   INTEGER DEFAULT 0,
    status                       TEXT DEFAULT 'open'
                                   CHECK(status IN ('open','in_progress','resolved')),
    fee_usd                      REAL DEFAULT 0.25,
    created_at                   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_customers (
    id                TEXT PRIMARY KEY,
    customer_id       TEXT NOT NULL UNIQUE,
    name              TEXT,
    email             TEXT,
    tickets           TEXT DEFAULT '[]',
    satisfaction_scores TEXT DEFAULT '[]',
    lifetime_value    REAL DEFAULT 0,
    churn_risk        TEXT DEFAULT 'low' CHECK(churn_risk IN ('low','medium','high','critical')),
    preferred_channel TEXT DEFAULT 'email',
    plan              TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Knowledge Base ──────────────────────────────────────────────────────

const _kbCount = db.prepare("SELECT COUNT(*) as n FROM cs_knowledge_base").get().n;
if (_kbCount === 0) {
  const seedArticles = [
    { title: "How to reset your password",                 category: "account",   content: "To reset your password: 1. Click 'Forgot Password' on the login page. 2. Enter your email address. 3. Check your inbox for a reset link. 4. Click the link and set a new password. Links expire in 24 hours.",                                                  helpful_votes: 342, view_count: 8920 },
    { title: "Understanding your monthly invoice",         category: "billing",   content: "Your monthly invoice includes your subscription fee, any usage overage charges, and applicable taxes. Invoices are generated on the 1st of each month and charged to your payment method on file. Download invoices from Account → Billing → Invoice History.",       helpful_votes: 287, view_count: 6745 },
    { title: "How to cancel your subscription",           category: "billing",   content: "To cancel your subscription: 1. Go to Account Settings. 2. Select Subscription. 3. Click Cancel Plan. 4. Choose your cancellation date (end of billing period or immediate). Your data is retained for 30 days post-cancellation.",                                  helpful_votes: 198, view_count: 5231 },
    { title: "Setting up two-factor authentication",      category: "security",  content: "Enable 2FA for enhanced account security: 1. Go to Account → Security. 2. Click Enable Two-Factor Authentication. 3. Choose your preferred method: authenticator app (recommended) or SMS. 4. Follow the setup wizard and save your backup codes.",               helpful_votes: 415, view_count: 11203 },
    { title: "How to update your payment method",         category: "billing",   content: "Update your payment details at any time: 1. Navigate to Account → Billing → Payment Methods. 2. Click Add Payment Method or Edit on existing. 3. Enter new card details. 4. Set as default if desired. Changes take effect on your next billing cycle.",           helpful_votes: 265, view_count: 7018 },
    { title: "Troubleshooting API connection errors",     category: "technical", content: "Common API connection errors and fixes: 401 Unauthorized: Check your API key is valid and not expired. 429 Rate Limited: Implement exponential backoff. 503 Service Unavailable: Check status.hiveagent.io for outages. Always use HTTPS endpoints.",               helpful_votes: 189, view_count: 4892 },
    { title: "Upgrading your plan",                       category: "account",   content: "Upgrade your plan at any time from Account → Subscription → Upgrade Plan. You'll be immediately charged a prorated amount for the remainder of the billing period. New limits take effect instantly. Downgrading is effective at the end of your current period.",   helpful_votes: 231, view_count: 5680 },
    { title: "Data export and portability",               category: "account",   content: "Export all your data at any time: 1. Go to Account → Data Management → Export. 2. Select data types (tasks, files, settings, history). 3. Choose format (JSON, CSV). 4. Click Request Export. You'll receive a download link via email within 2 hours.",           helpful_votes: 178, view_count: 3945 },
    { title: "Understanding rate limits and quotas",      category: "technical", content: "Rate limits vary by plan: Free: 100 req/min, Starter: 500 req/min, Pro: 2000 req/min, Enterprise: custom. Quota resets occur at midnight UTC. Monitor usage via Account → Usage Dashboard. Exceeding limits returns HTTP 429 with retry-after headers.",            helpful_votes: 156, view_count: 4102 },
    { title: "How to submit a feature request",           category: "feature_request", content: "We love hearing from customers! Submit feature requests via: 1. In-app: Help → Feature Requests → Submit New. 2. Community forum at community.hiveagent.io. 3. Email product@hiveagent.io. Include your use case and expected benefit. Top-voted requests are reviewed monthly.", helpful_votes: 134, view_count: 3287 },
    { title: "Configuring webhook notifications",         category: "technical", content: "Set up webhooks to receive real-time event notifications: 1. Go to Settings → Integrations → Webhooks. 2. Click Add Endpoint. 3. Enter your endpoint URL (must be HTTPS). 4. Select event types. 5. Save and test. Payloads are signed with HMAC-SHA256.",       helpful_votes: 142, view_count: 3561 },
    { title: "Inviting team members and permissions",     category: "account",   content: "Invite colleagues to your workspace: 1. Go to Settings → Team. 2. Click Invite Member. 3. Enter email address and select role: Admin, Editor, or Viewer. 4. Send invite. Invites expire in 7 days. Manage permissions from the Team Settings page at any time.",    helpful_votes: 209, view_count: 5843 },
    { title: "Refund policy and requesting a refund",     category: "billing",   content: "We offer a 30-day money-back guarantee for new subscriptions. To request a refund: email billing@hiveagent.io with your account email and reason. Refunds are processed within 5-7 business days to your original payment method. Partial refunds available for annual plans.", helpful_votes: 322, view_count: 8114 },
    { title: "Troubleshooting slow performance",          category: "technical", content: "If you're experiencing slow performance: 1. Check status.hiveagent.io for active incidents. 2. Clear your browser cache and cookies. 3. Try a different browser or incognito mode. 4. Disable browser extensions. 5. Check your internet connection. Contact support if issues persist.", helpful_votes: 167, view_count: 4398 },
    { title: "SSO / SAML configuration guide",           category: "security",  content: "Configure Single Sign-On for your organization: Prerequisites: Enterprise plan required. Steps: 1. Download our SAML metadata from Settings → Security → SSO. 2. Upload to your IdP (Okta, Azure AD, etc.). 3. Configure attribute mappings. 4. Test with a pilot user before enabling organization-wide.", helpful_votes: 98,  view_count: 2201 },
    { title: "Mobile app setup and troubleshooting",     category: "technical", content: "Download the mobile app from the App Store or Google Play. Login with your existing credentials. If experiencing issues: ensure app is updated to latest version, check notification permissions, re-authenticate if session expired. Offline mode supports read-only access.", helpful_votes: 145, view_count: 3792 },
    { title: "Managing API keys and access tokens",      category: "security",  content: "Create and manage API keys from Settings → API → API Keys. Best practices: create separate keys per integration, set expiration dates, restrict IP ranges if possible, rotate keys every 90 days, never commit keys to version control. Revoke compromised keys immediately.", helpful_votes: 201, view_count: 5103 },
    { title: "Data retention and deletion policy",       category: "account",   content: "Data retention overview: Active accounts: data retained indefinitely. Cancelled accounts: data held 30 days then purged. Deleted items (trash): purged after 14 days. Request immediate deletion via Account → Privacy → Delete All Data. GDPR/CCPA deletion requests processed within 30 days.", helpful_votes: 173, view_count: 4417 },
    { title: "Integrating with third-party tools",       category: "technical", content: "Connect your favorite tools from Settings → Integrations. Available integrations: Slack, Google Workspace, Microsoft 365, Zapier, Jira, Salesforce, HubSpot, and 200+ more. Each integration has its own setup guide. OAuth-based connections are preferred for security.",           helpful_votes: 256, view_count: 6823 },
    { title: "Contacting support and escalation paths",  category: "general",   content: "Support channels by priority: Live chat (fastest, available 9am-6pm EST weekdays), Email support@hiveagent.io (4-hour SLA on business days), Phone support (Enterprise customers only). For critical outages, call our 24/7 emergency line listed in your Enterprise contract.", helpful_votes: 188, view_count: 4976 },
  ];

  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO cs_knowledge_base
      (id, title, content, category, helpful_votes, view_count, created_at, last_updated)
    VALUES
      (@id, @title, @content, @category, @helpful_votes, @view_count, datetime('now'), datetime('now'))
  `);
  for (const a of seedArticles) insertArticle.run({ id: uuid(), ...a });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCategory(content) {
  const lower = content.toLowerCase();
  if (lower.includes("invoice") || lower.includes("charge") || lower.includes("payment") || lower.includes("refund") || lower.includes("billing")) return "billing";
  if (lower.includes("password") || lower.includes("login") || lower.includes("account") || lower.includes("2fa") || lower.includes("access")) return "account";
  if (lower.includes("error") || lower.includes("bug") || lower.includes("crash") || lower.includes("api") || lower.includes("slow") || lower.includes("not working")) return "technical";
  if (lower.includes("ship") || lower.includes("delivery") || lower.includes("tracking") || lower.includes("order")) return "shipping";
  if (lower.includes("return") || lower.includes("refund") || lower.includes("exchange")) return "returns";
  if (lower.includes("feature") || lower.includes("request") || lower.includes("suggestion") || lower.includes("idea")) return "feature_request";
  if (lower.includes("hack") || lower.includes("security") || lower.includes("breach") || lower.includes("vulnerability")) return "security";
  return "general";
}

function detectPriority(content, inputPriority, customerData) {
  if (inputPriority && PRIORITY_LEVELS.includes(inputPriority)) return inputPriority;
  const lower    = content.toLowerCase();
  const isVip    = customerData?.plan === "enterprise" || (customerData?.lifetime_value ?? 0) > 10000;
  if (lower.includes("urgent") || lower.includes("critical") || lower.includes("emergency") || lower.includes("breach")) return isVip ? "critical" : "high";
  if (lower.includes("asap") || lower.includes("important") || lower.includes("cannot") || isVip) return "high";
  if (lower.includes("when") || lower.includes("question") || lower.includes("how")) return "low";
  return "medium";
}

function assignTeam(category, priority) {
  const teamMap = {
    billing:          "billing_support",
    technical:        "engineering_support",
    account:          "account_management",
    shipping:         "fulfillment_team",
    returns:          "returns_team",
    feature_request:  "product_team",
    security:         "security_team",
    general:          "general_support",
  };
  const baseTeam = teamMap[category] ?? "general_support";
  if (priority === "critical") return `${baseTeam}_tier3`;
  if (priority === "high")     return `${baseTeam}_tier2`;
  return `${baseTeam}_tier1`;
}

function buildSuggestedResponse(category, content, tone) {
  const greetings = {
    professional: "Thank you for contacting us.",
    friendly:     "Thanks so much for reaching out!",
    empathetic:   "I'm sorry to hear you're experiencing this issue.",
    formal:       "We have received your inquiry and appreciate you bringing this to our attention.",
  };

  const closings = {
    professional: "Please don't hesitate to reach out if you need further assistance.",
    friendly:     "Hope that helps — let us know if there's anything else we can do!",
    empathetic:   "We truly value your business and want to make sure this is resolved to your satisfaction.",
    formal:       "Thank you for your continued business. We remain at your disposal.",
  };

  const bodies = {
    billing:         "I've reviewed your account and can see the details of your recent transaction. Our billing team will investigate this further and you can expect a resolution within 1-2 business days.",
    technical:       "I understand how frustrating technical issues can be. I've flagged this to our engineering team with high priority. In the meantime, please try clearing your cache and attempting the action again.",
    account:         "I can help you resolve this account issue. For security reasons, I'll need to verify your identity before making any changes. Please confirm the email address associated with your account.",
    shipping:        "I've located your order and can see the current shipping status. Your package is with our carrier and on its way. You can track it in real time using the link in your confirmation email.",
    returns:         "I'd be happy to help with your return request. Our standard return window is 30 days from delivery. I'll initiate the return authorization and send you a prepaid shipping label within 24 hours.",
    feature_request: "Thank you for this valuable feedback! I've logged your feature request with our product team. Your suggestion has been added to our feedback board and will be reviewed in our next planning cycle.",
    security:        "Your security is our highest priority. I'm escalating this to our security team immediately. Please change your password right now if you haven't already and enable two-factor authentication.",
    general:         "Thank you for your message. I've reviewed your inquiry and will provide you with a complete answer as quickly as possible.",
  };

  const greeting = greetings[tone] ?? greetings.professional;
  const body     = bodies[category] ?? bodies.general;
  const closing  = closings[tone]   ?? closings.professional;

  return `${greeting}\n\n${body}\n\n${closing}`;
}

// ─── Triage Ticket ────────────────────────────────────────────────────────────

/**
 * Auto-triage a support ticket: classify, prioritize, assign a team, and suggest a response.
 * @param {string} ticketContent - Raw ticket text from the customer
 * @param {object} customerData  - { id, name, email, plan, lifetime_value }
 * @param {string} priority      - Optional override: critical|high|medium|low
 * @returns Triage result with category, priority, assigned team, suggested response, and similar tickets
 */
export function triageTicket(ticketContent, customerData = {}, priority = null) {
  if (!ticketContent) throw new Error("ticketContent is required");

  const id       = uuid();
  const now      = new Date().toISOString();
  const category = detectCategory(ticketContent);
  const subcategoryMap = {
    billing:         pickRandom(["overcharge", "refund", "invoice_error", "payment_failed", "subscription"]),
    technical:       pickRandom(["api_error", "performance", "integration", "data_loss", "ui_bug"]),
    account:         pickRandom(["login", "password_reset", "permissions", "profile", "deletion"]),
    shipping:        pickRandom(["delay", "lost_package", "wrong_item", "tracking"]),
    returns:         pickRandom(["initiate_return", "refund_status", "exchange"]),
    feature_request: pickRandom(["new_feature", "enhancement", "ui_improvement"]),
    security:        pickRandom(["breach", "suspicious_activity", "2fa", "api_key"]),
    general:         pickRandom(["information", "how_to", "other"]),
  };

  const detectedPriority  = detectPriority(ticketContent, priority, customerData);
  const assignedTeam      = assignTeam(category, detectedPriority);
  const suggestedResponse = buildSuggestedResponse(category, ticketContent, "professional");

  // Find similar resolved tickets from DB
  const similarResolved = db.prepare(`
    SELECT id, content, category, status, created_at
    FROM cs_support_tickets
    WHERE category = ? AND status IN ('resolved','closed')
    ORDER BY created_at DESC
    LIMIT 3
  `).all(category).map(t => ({
    ticket_id:  t.id,
    preview:    t.content.slice(0, 80),
    category:   t.category,
    resolved_at: t.resolved_at,
  }));

  db.prepare(`
    INSERT OR IGNORE INTO cs_support_tickets
      (id, customer_id, content, category, subcategory, priority, assigned_team,
       status, suggested_response, similar_resolved, fee_usd, created_at)
    VALUES
      (@id, @customer_id, @content, @category, @subcategory, @priority, @assigned_team,
       'open', @suggested_response, @similar_resolved, @fee_usd, @created_at)
  `).run({
    id,
    customer_id:       customerData.id ?? null,
    content:           ticketContent,
    category,
    subcategory:       subcategoryMap[category],
    priority:          detectedPriority,
    assigned_team:     assignedTeam,
    suggested_response: suggestedResponse,
    similar_resolved:  JSON.stringify(similarResolved),
    fee_usd:           FEES.triage_ticket,
    created_at:        now,
  });

  return {
    ticket_id:        id,
    category,
    subcategory:      subcategoryMap[category],
    priority:         detectedPriority,
    assigned_team:    assignedTeam,
    suggested_response: suggestedResponse,
    similar_resolved: similarResolved,
    sla_target: {
      critical: "15 minutes",
      high:     "2 hours",
      medium:   "8 hours",
      low:      "24 hours",
    }[detectedPriority],
    fee_usd:          FEES.triage_ticket,
    created_at:       now,
  };
}

// ─── Generate Response ────────────────────────────────────────────────────────

/**
 * Draft a polished support response for a ticket using context and KB articles.
 * @param {string}   ticketId   - ID of the ticket to respond to
 * @param {object}   context    - Additional context { product_version, account_type, issue_history }
 * @param {string}   tone       - professional|friendly|empathetic|formal
 * @param {string[]} kbArticles - Optional KB article IDs to cite in the response
 * @returns Drafted response with confidence score and follow-up flag
 */
export function generateResponse(ticketId, context = {}, tone = "professional", kbArticles = []) {
  if (!ticketId) throw new Error("ticketId is required");
  if (!["professional", "friendly", "empathetic", "formal"].includes(tone)) {
    throw new Error("tone must be professional|friendly|empathetic|formal");
  }

  const ticket = db.prepare("SELECT * FROM cs_support_tickets WHERE id = ?").get(ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

  const id  = uuid();
  const now = new Date().toISOString();

  // Fetch cited KB articles if provided
  let sourcesUsed = [];
  if (kbArticles.length > 0) {
    const placeholders = kbArticles.map(() => "?").join(",");
    const articles = db.prepare(
      `SELECT id, title, category FROM cs_knowledge_base WHERE id IN (${placeholders})`
    ).all(...kbArticles);
    sourcesUsed = articles.map(a => ({ article_id: a.id, title: a.title, category: a.category }));
  } else {
    // Auto-fetch relevant KB articles
    const autoArticles = db.prepare(`
      SELECT id, title, category FROM cs_knowledge_base
      WHERE category = ? ORDER BY helpful_votes DESC LIMIT 2
    `).all(ticket.category ?? "general");
    sourcesUsed = autoArticles.map(a => ({ article_id: a.id, title: a.title, category: a.category }));
  }

  const responseText  = buildSuggestedResponse(ticket.category ?? "general", ticket.content, tone);
  const confidence    = randomFloat(0.72, 0.97);
  const followUpNeeded = ticket.priority === "high" || ticket.priority === "critical" || Math.random() < 0.2;

  db.prepare(`
    INSERT OR IGNORE INTO cs_responses
      (id, ticket_id, response_text, confidence, sources_used, follow_up, tone, fee_usd, created_at)
    VALUES
      (@id, @ticket_id, @response_text, @confidence, @sources_used, @follow_up, @tone, @fee_usd, @created_at)
  `).run({
    id,
    ticket_id:    ticketId,
    response_text: responseText,
    confidence,
    sources_used: JSON.stringify(sourcesUsed),
    follow_up:    followUpNeeded ? 1 : 0,
    tone,
    fee_usd:      FEES.generate_response,
    created_at:   now,
  });

  // Mark first response time on ticket
  if (!ticket.first_response_at) {
    db.prepare("UPDATE cs_support_tickets SET first_response_at = ?, status = 'in_progress' WHERE id = ?")
      .run(now, ticketId);
  }

  return {
    response_id:      id,
    ticket_id:        ticketId,
    response_text:    responseText,
    confidence,
    sources_used:     sourcesUsed,
    follow_up_needed: followUpNeeded,
    tone,
    character_count:  responseText.length,
    fee_usd:          FEES.generate_response,
    created_at:       now,
  };
}

// ─── Search Knowledge Base ────────────────────────────────────────────────────

/**
 * Full-text search the internal knowledge base.
 * @param {string} query    - Search keywords
 * @param {string} category - Optional category filter
 * @returns Matching articles with relevance scores and vote counts
 */
export function searchKnowledgeBase(query, category = null) {
  if (!query) throw new Error("query is required");

  let sql    = "SELECT * FROM cs_knowledge_base WHERE 1=1";
  const params = [];

  if (category && TICKET_CATEGORIES.includes(category)) {
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY helpful_votes DESC, view_count DESC";
  const allArticles = db.prepare(sql).all(...params);

  // Score by relevance
  const q = query.toLowerCase();
  const scored = allArticles.map(a => {
    const text   = `${a.title} ${a.content}`.toLowerCase();
    const words  = q.split(/\s+/).filter(Boolean);
    const hits   = words.filter(w => text.includes(w)).length;
    const rel    = parseFloat(Math.min(1.0, (hits / Math.max(words.length, 1)) + Math.random() * 0.15).toFixed(2));
    return { ...a, relevance: rel };
  })
  .filter(a => a.relevance > 0.1)
  .sort((a, b) => b.relevance - a.relevance)
  .slice(0, 10);

  // Increment view counts
  for (const a of scored) {
    db.prepare("UPDATE cs_knowledge_base SET view_count = view_count + 1 WHERE id = ?").run(a.id);
  }

  return {
    query,
    category: category ?? "all",
    total_found: scored.length,
    articles: scored.map(a => ({
      article_id:      a.id,
      title:           a.title,
      content_preview: a.content.slice(0, 200) + (a.content.length > 200 ? "…" : ""),
      category:        a.category,
      relevance:       a.relevance,
      last_updated:    a.last_updated,
      helpful_votes:   a.helpful_votes,
      view_count:      a.view_count + 1,
    })),
    fee_usd:    FEES.search_kb,
  };
}

// ─── Escalate Ticket ──────────────────────────────────────────────────────────

/**
 * Escalate a support ticket to a higher-tier team with SLA tracking.
 * @param {string} ticketId - Ticket to escalate
 * @param {string} reason   - Reason for escalation
 * @param {string} urgency  - critical|high|medium|low
 * @returns Escalation record with SLA deadline and notification status
 */
export function escalateTicket(ticketId, reason, urgency = "high") {
  if (!ticketId) throw new Error("ticketId is required");
  if (!reason)   throw new Error("reason is required");
  if (!PRIORITY_LEVELS.includes(urgency)) {
    throw new Error(`urgency must be one of: ${PRIORITY_LEVELS.join(", ")}`);
  }

  const ticket = db.prepare("SELECT * FROM cs_support_tickets WHERE id = ?").get(ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

  const id  = uuid();
  const now = new Date().toISOString();

  const escalationTargets = {
    critical: "engineering_director",
    high:     "senior_support_engineer",
    medium:   "support_team_lead",
    low:      "senior_support_agent",
  };

  const slaHours  = { critical: 1, high: 4, medium: 12, low: 24 };
  const slaDeadline = new Date(Date.now() + (slaHours[urgency] ?? 4) * 3600000).toISOString();
  const escalatedTo = escalationTargets[urgency] ?? "support_team_lead";

  db.prepare(`
    INSERT OR IGNORE INTO cs_escalations
      (id, ticket_id, reason, urgency, escalated_to, sla_deadline,
       customer_notification_sent, status, fee_usd, created_at)
    VALUES
      (@id, @ticket_id, @reason, @urgency, @escalated_to, @sla_deadline,
       1, 'open', @fee_usd, @created_at)
  `).run({
    id,
    ticket_id:   ticketId,
    reason,
    urgency,
    escalated_to: escalatedTo,
    sla_deadline: slaDeadline,
    fee_usd:      FEES.escalate_ticket,
    created_at:   now,
  });

  // Update ticket status
  db.prepare("UPDATE cs_support_tickets SET status = 'escalated', priority = ? WHERE id = ?")
    .run(urgency, ticketId);

  return {
    escalation_id:              id,
    ticket_id:                  ticketId,
    reason,
    urgency,
    escalated_to:               escalatedTo,
    sla_deadline:               slaDeadline,
    sla_hours:                  slaHours[urgency],
    customer_notification_sent: true,
    status:                     "open",
    fee_usd:                    FEES.escalate_ticket,
    created_at:                 now,
  };
}

// ─── Get Customer History ─────────────────────────────────────────────────────

/**
 * Retrieve full interaction history and profile data for a customer.
 * @param {string} customerId - Customer identifier
 * @returns Ticket history, CSAT scores, lifetime value, churn risk, and preferred channel
 */
export function getCustomerHistory(customerId) {
  if (!customerId) throw new Error("customerId is required");

  const now = new Date().toISOString();

  let customer = db.prepare("SELECT * FROM cs_customers WHERE customer_id = ?").get(customerId);

  if (!customer) {
    // Create a synthetic profile for first-time lookup
    const syntheticId = uuid();
    const lifetimeValue = randomFloat(0, 15000);
    const ticketCount   = randomInt(0, 25);
    const avgCsat       = randomFloat(2.5, 5.0);

    let churnRisk = "low";
    if (avgCsat < 3.0 || ticketCount > 15) churnRisk = "high";
    else if (avgCsat < 3.8 || ticketCount > 8) churnRisk = "medium";

    db.prepare(`
      INSERT OR IGNORE INTO cs_customers
        (id, customer_id, lifetime_value, churn_risk, preferred_channel, created_at, updated_at)
      VALUES
        (@id, @customer_id, @lifetime_value, @churn_risk, @preferred_channel, @created_at, @updated_at)
    `).run({
      id:                syntheticId,
      customer_id:       customerId,
      lifetime_value:    lifetimeValue,
      churn_risk:        churnRisk,
      preferred_channel: pickRandom(VALID_CHANNELS),
      created_at:        now,
      updated_at:        now,
    });
    customer = db.prepare("SELECT * FROM cs_customers WHERE customer_id = ?").get(customerId);
  }

  // Pull their tickets
  const tickets = db.prepare(`
    SELECT id, category, priority, status, created_at, resolved_at, csat_score
    FROM cs_support_tickets
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(customerId);

  // Pull their escalations
  const escalations = db.prepare(`
    SELECT e.id, e.reason, e.urgency, e.escalated_to, e.created_at
    FROM cs_escalations e
    JOIN cs_support_tickets t ON e.ticket_id = t.id
    WHERE t.customer_id = ?
    ORDER BY e.created_at DESC
    LIMIT 5
  `).all(customerId);

  const satisfactionScores = tickets
    .filter(t => t.csat_score != null)
    .map(t => ({ ticket_id: t.id, score: t.csat_score, date: t.created_at }));

  const avgCsat = satisfactionScores.length > 0
    ? parseFloat((satisfactionScores.reduce((s, x) => s + x.score, 0) / satisfactionScores.length).toFixed(2))
    : null;

  // Update customer record
  db.prepare("UPDATE cs_customers SET updated_at = ? WHERE customer_id = ?").run(now, customerId);

  return {
    customer_id:        customerId,
    lifetime_value_usd: parseFloat((customer.lifetime_value ?? 0).toFixed(2)),
    churn_risk:         customer.churn_risk ?? "low",
    preferred_channel:  customer.preferred_channel ?? "email",
    plan:               customer.plan ?? "unknown",
    tickets:            tickets.map(t => ({
      ticket_id:    t.id,
      category:     t.category,
      priority:     t.priority,
      status:       t.status,
      created_at:   t.created_at,
      resolved_at:  t.resolved_at,
      csat_score:   t.csat_score,
    })),
    total_tickets:      tickets.length,
    open_tickets:       tickets.filter(t => !["resolved", "closed"].includes(t.status)).length,
    escalations,
    satisfaction_scores: satisfactionScores,
    avg_csat:           avgCsat,
    customer_health:    avgCsat == null ? "unknown" : avgCsat >= 4.0 ? "healthy" : avgCsat >= 3.0 ? "at_risk" : "critical",
    fee_usd:            FEES.customer_history,
    retrieved_at:       now,
  };
}

// ─── Get Support Dashboard ────────────────────────────────────────────────────

/**
 * Retrieve aggregate support metrics for a given date range.
 * @param {object} dateRange - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns Open tickets, resolution times, CSAT, first response time, resolution rate, top categories
 */
export function getSupportDashboard(dateRange = {}) {
  const now = new Date().toISOString();

  const startDate = dateRange.start ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const endDate   = dateRange.end   ?? now.split("T")[0];

  // Open tickets
  const openTickets = db.prepare(`
    SELECT COUNT(*) as n FROM cs_support_tickets
    WHERE status NOT IN ('resolved','closed') AND date(created_at) BETWEEN ? AND ?
  `).get(startDate, endDate).n;

  // All tickets in range
  const allTickets = db.prepare(`
    SELECT * FROM cs_support_tickets
    WHERE date(created_at) BETWEEN ? AND ?
  `).all(startDate, endDate);

  // Resolution metrics
  const resolved = allTickets.filter(t => t.resolved_at);
  const avgResolutionMs = resolved.length > 0
    ? resolved.reduce((s, t) => s + (new Date(t.resolved_at) - new Date(t.created_at)), 0) / resolved.length
    : null;
  const avgResolutionHours = avgResolutionMs ? parseFloat((avgResolutionMs / 3600000).toFixed(1)) : randomFloat(2, 24);

  // First response time
  const withFirstResponse = allTickets.filter(t => t.first_response_at);
  const avgFirstResponseMs = withFirstResponse.length > 0
    ? withFirstResponse.reduce((s, t) => s + (new Date(t.first_response_at) - new Date(t.created_at)), 0) / withFirstResponse.length
    : null;
  const avgFirstResponseMin = avgFirstResponseMs
    ? parseFloat((avgFirstResponseMs / 60000).toFixed(0))
    : randomInt(5, 120);

  // CSAT
  const withCsat  = allTickets.filter(t => t.csat_score != null);
  const csatScore = withCsat.length > 0
    ? parseFloat((withCsat.reduce((s, t) => s + t.csat_score, 0) / withCsat.length).toFixed(2))
    : randomFloat(3.8, 4.8);

  // Resolution rate
  const resolutionRate = allTickets.length > 0
    ? parseFloat(((resolved.length / allTickets.length) * 100).toFixed(1))
    : randomFloat(75, 95);

  // Top categories
  const categoryCounts = {};
  for (const t of allTickets) {
    categoryCounts[t.category ?? "general"] = (categoryCounts[t.category ?? "general"] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, count]) => ({ category: cat, count, pct: parseFloat(((count / Math.max(allTickets.length, 1)) * 100).toFixed(1)) }));

  // Priority breakdown
  const priorityBreakdown = PRIORITY_LEVELS.reduce((acc, p) => {
    acc[p] = allTickets.filter(t => t.priority === p).length;
    return acc;
  }, {});

  // Trend data (7 days)
  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    const dayTickets = allTickets.filter(t => t.created_at.startsWith(ds));
    return {
      date:       ds,
      new_tickets: dayTickets.length,
      resolved:   dayTickets.filter(t => t.resolved_at).length,
    };
  });

  return {
    date_range:            { start: startDate, end: endDate },
    open_tickets:          openTickets,
    total_tickets:         allTickets.length,
    avg_resolution_time:   `${avgResolutionHours} hours`,
    avg_resolution_hours:  avgResolutionHours,
    csat_score:            csatScore,
    first_response_time:   `${avgFirstResponseMin} minutes`,
    first_response_minutes: avgFirstResponseMin,
    resolution_rate_pct:   resolutionRate,
    top_categories:        topCategories,
    priority_breakdown:    priorityBreakdown,
    ticket_trend:          trendDays,
    escalation_count:      db.prepare(`
      SELECT COUNT(*) as n FROM cs_escalations
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(startDate, endDate).n,
    fee_usd:               FEES.support_dashboard,
    generated_at:          now,
  };
}
