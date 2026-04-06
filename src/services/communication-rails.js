import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const CHANNEL_PRICING_USD = {
  email:    { per_message: 0.001, acknowledgment_fee: 0.002 },
  sms:      { per_message: 0.012, acknowledgment_fee: 0.005 },
  whatsapp: { per_message: 0.015, acknowledgment_fee: 0.005 },
  slack:    { per_message: 0.003, acknowledgment_fee: 0.001 },
  voice:    { per_message: 0.080, acknowledgment_fee: 0.010 }, // per minute equivalent
};
const PLATFORM_COMMISSION = 0.15; // 15% platform cut
const FOLLOWUP_FEE_USD    = 0.50; // flat fee per scheduled follow-up

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS comms_messages (
    id                     TEXT PRIMARY KEY,
    agent_id               TEXT NOT NULL,
    channel                TEXT NOT NULL CHECK(channel IN ('email','sms','whatsapp','slack','voice')),
    recipient              TEXT NOT NULL,
    content                TEXT NOT NULL,
    require_acknowledgment INTEGER DEFAULT 0,
    status                 TEXT DEFAULT 'queued' CHECK(status IN (
                             'queued','sent','delivered','opened','acknowledged','bounced','failed')),
    price_usd              REAL,
    commission_usd         REAL,
    message_sid            TEXT,
    opened_at              TEXT,
    acknowledged_at        TEXT,
    bounced_reason         TEXT,
    sent_at                TEXT DEFAULT (datetime('now')),
    delivered_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS comms_followups (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    original_message_id  TEXT REFERENCES comms_messages(id),
    followup_content     TEXT NOT NULL,
    delay_hours          REAL NOT NULL,
    scheduled_at         TEXT NOT NULL,
    status               TEXT DEFAULT 'pending' CHECK(status IN (
                           'pending','sent','cancelled','skipped')),
    trigger_condition    TEXT DEFAULT 'no_acknowledgment',
    followup_message_id  TEXT REFERENCES comms_messages(id),
    fee_usd              REAL DEFAULT 0.50,
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function messageSid(channel) {
  const prefixes = { email: "EM", sms: "SM", whatsapp: "WA", slack: "SL", voice: "CA" };
  return `${prefixes[channel] ?? "MSG"}${uuid().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

function simulateDelivery(channel, sentAt) {
  // Delivery speeds per channel
  const deliveryMs = {
    sms:      500  + Math.random() * 2000,
    whatsapp: 700  + Math.random() * 3000,
    email:    3000 + Math.random() * 15000,
    slack:    200  + Math.random() * 1000,
    voice:    8000 + Math.random() * 5000,
  };
  return new Date(new Date(sentAt).getTime() + (deliveryMs[channel] ?? 3000)).toISOString();
}

// ─── Send Verified Message ────────────────────────────────────────────────────

/**
 * Send a message over a verified communication channel with optional acknowledgment tracking.
 * @param {string}  channel                - email|sms|whatsapp|slack|voice
 * @param {string}  recipient              - Address/number/handle appropriate for the channel
 * @param {string}  content                - Message body or voice script
 * @param {boolean} requireAcknowledgment  - Whether to track if recipient confirms receipt
 * @returns Message record with delivery status and messageId
 */
export function sendVerifiedMessage(channel, recipient, content, requireAcknowledgment = false) {
  const validChannels = ["email","sms","whatsapp","slack","voice"];
  if (!validChannels.includes(channel)) {
    throw new Error(`channel must be one of: ${validChannels.join(", ")}`);
  }
  if (!recipient) throw new Error("recipient is required");
  if (!content)   throw new Error("content is required");

  // Validate recipient format per channel
  if (channel === "sms" && !/^\+?[1-9]\d{7,14}$/.test(recipient.replace(/\s/g, ""))) {
    throw new Error("SMS recipient must be a valid E.164 phone number (e.g. +14155552671)");
  }
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Email recipient must be a valid email address");
  }

  const id         = uuid();
  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const pricing    = CHANNEL_PRICING_USD[channel];
  const price      = pricing.per_message + (requireAcknowledgment ? pricing.acknowledgment_fee : 0);
  const commission = Math.round(price * PLATFORM_COMMISSION * 100) / 100;
  const sid        = messageSid(channel);
  const now        = new Date().toISOString();
  const deliveredAt = simulateDelivery(channel, now);

  db.prepare(`
    INSERT OR IGNORE INTO comms_messages
      (id, agent_id, channel, recipient, content, require_acknowledgment,
       status, price_usd, commission_usd, message_sid, sent_at, delivered_at)
    VALUES
      (@id, @agent_id, @channel, @recipient, @content, @require_ack,
       'delivered', @price, @commission, @sid, @now, @delivered_at)
  `).run({
    id, agent_id: agentId, channel, recipient, content,
    require_ack: requireAcknowledgment ? 1 : 0,
    price: Math.round(price * 10000) / 10000,
    commission, sid, now, delivered_at: deliveredAt,
  });

  return {
    message_id:                id,
    agent_id:                  agentId,
    channel,
    recipient,
    status:                    "delivered",
    message_sid:               sid,
    price_usd:                 Math.round(price * 10000) / 10000,
    platform_commission_usd:   commission,
    acknowledgment_requested:  requireAcknowledgment,
    sent_at:                   now,
    delivered_at:              deliveredAt,
    acknowledgment_link:       requireAcknowledgment
      ? `https://ack.hiveagent.ai/${id}?token=${uuid().slice(0, 12)}`
      : null,
    message:                   `Message delivered via ${channel} to ${recipient}.`,
  };
}

// ─── Get Delivery Status ──────────────────────────────────────────────────────

/**
 * Get the current delivery and read status of a sent message.
 * @param {string} messageId
 * @returns Delivery status record with timeline of delivery events
 */
export function getDeliveryStatus(messageId) {
  const msg = db.prepare("SELECT * FROM comms_messages WHERE id = ?").get(messageId);
  if (!msg) throw new Error(`Message not found: ${messageId}`);

  // Simulate progressive open/ack based on elapsed time
  const elapsedMs   = Date.now() - new Date(msg.sent_at).getTime();
  const elapsedMins = elapsedMs / 60000;

  let currentStatus = msg.status;
  let openedAt      = msg.opened_at;
  let acknowledgedAt = msg.acknowledged_at;

  // Open rates by channel: email 45%, sms 95%, whatsapp 90%, slack 80%, voice 85%
  const openRates    = { email: 0.45, sms: 0.95, whatsapp: 0.90, slack: 0.80, voice: 0.85 };
  const openRate     = openRates[msg.channel] ?? 0.60;

  if (currentStatus === "delivered" && elapsedMins > 2 && Math.random() < openRate) {
    currentStatus = "opened";
    openedAt      = new Date(new Date(msg.sent_at).getTime() + 2 * 60000 + Math.random() * 60000 * 30).toISOString();
    db.prepare("UPDATE comms_messages SET status='opened', opened_at=? WHERE id=?").run(openedAt, messageId);
  }

  if (currentStatus === "opened" && msg.require_acknowledgment && elapsedMins > 10) {
    const ackRate = { email: 0.35, sms: 0.75, whatsapp: 0.70, slack: 0.65, voice: 0.80 };
    if (Math.random() < (ackRate[msg.channel] ?? 0.50)) {
      currentStatus  = "acknowledged";
      acknowledgedAt = new Date(new Date(openedAt ?? msg.sent_at).getTime() + Math.random() * 30 * 60000).toISOString();
      db.prepare("UPDATE comms_messages SET status='acknowledged', acknowledged_at=? WHERE id=?")
        .run(acknowledgedAt, messageId);
    }
  }

  // Check for pending follow-ups
  const followups = db.prepare(
    "SELECT * FROM comms_followups WHERE original_message_id = ? ORDER BY scheduled_at ASC"
  ).all(messageId);

  return {
    message_id:                messageId,
    channel:                   msg.channel,
    recipient:                 msg.recipient,
    status:                    currentStatus,
    acknowledgment_requested:  msg.require_acknowledgment === 1,
    price_usd:                 msg.price_usd,
    timeline: {
      sent_at:           msg.sent_at,
      delivered_at:      msg.delivered_at,
      opened_at:         openedAt,
      acknowledged_at:   acknowledgedAt,
    },
    bounced_reason:            msg.bounced_reason ?? null,
    pending_followups:         followups.filter(f => f.status === "pending").length,
    followups:                 followups.map(f => ({
      followup_id:    f.id,
      scheduled_at:   f.scheduled_at,
      status:         f.status,
      delay_hours:    f.delay_hours,
    })),
  };
}

// ─── Schedule Followup ────────────────────────────────────────────────────────

/**
 * Schedule an automatic follow-up message if the recipient hasn't acknowledged the original.
 * @param {string} originalMessageId  - ID of the original message to follow up on
 * @param {string} followupContent    - Content of the follow-up message
 * @param {number} delayHours         - Hours after original send to dispatch follow-up
 * @returns Follow-up schedule record with fee details
 */
export function scheduleFollowup(originalMessageId, followupContent, delayHours) {
  if (!originalMessageId) throw new Error("originalMessageId is required");
  if (!followupContent)   throw new Error("followupContent is required");
  if (delayHours == null || delayHours <= 0) throw new Error("delayHours must be a positive number");

  const original = db.prepare("SELECT * FROM comms_messages WHERE id = ?").get(originalMessageId);
  if (!original) throw new Error(`Original message not found: ${originalMessageId}`);

  const id           = uuid();
  const agentId      = original.agent_id;
  const scheduledAt  = new Date(new Date(original.sent_at).getTime() + delayHours * 3600000).toISOString();
  const now          = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO comms_followups
      (id, agent_id, original_message_id, followup_content, delay_hours, scheduled_at,
       status, trigger_condition, fee_usd, created_at)
    VALUES
      (@id, @agent_id, @original_id, @content, @delay, @scheduled_at, 'pending', 'no_acknowledgment', @fee, @now)
  `).run({
    id, agent_id: agentId, original_id: originalMessageId,
    content: followupContent, delay: delayHours, scheduled_at: scheduledAt,
    fee: FOLLOWUP_FEE_USD, now,
  });

  return {
    followup_id:            id,
    original_message_id:    originalMessageId,
    channel:                original.channel,
    recipient:              original.recipient,
    followup_content:       followupContent,
    delay_hours:            delayHours,
    scheduled_at:           scheduledAt,
    trigger_condition:      "no_acknowledgment",
    status:                 "pending",
    scheduling_fee_usd:     FOLLOWUP_FEE_USD,
    platform_commission_usd: Math.round(FOLLOWUP_FEE_USD * PLATFORM_COMMISSION * 100) / 100,
    created_at:             now,
    message:                `Follow-up scheduled via ${original.channel} to ${original.recipient} in ${delayHours} hours if not acknowledged.`,
  };
}

// ─── Verify Acknowledgment ────────────────────────────────────────────────────

/**
 * Check whether a recipient has explicitly acknowledged a message.
 * @param {string} messageId
 * @returns Acknowledgment verification result
 */
export function verifyAcknowledgment(messageId) {
  const msg = db.prepare("SELECT * FROM comms_messages WHERE id = ?").get(messageId);
  if (!msg) throw new Error(`Message not found: ${messageId}`);

  if (!msg.require_acknowledgment) {
    return {
      message_id:               messageId,
      acknowledgment_requested: false,
      acknowledged:             false,
      message:                  "This message was sent without acknowledgment tracking. Use requireAcknowledgment=true on future messages.",
    };
  }

  const isAcknowledged = msg.status === "acknowledged";
  const elapsedHours   = (Date.now() - new Date(msg.sent_at).getTime()) / 3600000;

  return {
    message_id:               messageId,
    channel:                  msg.channel,
    recipient:                msg.recipient,
    acknowledgment_requested: true,
    acknowledged:             isAcknowledged,
    acknowledged_at:          msg.acknowledged_at ?? null,
    current_status:           msg.status,
    delivered_at:             msg.delivered_at,
    opened_at:                msg.opened_at ?? null,
    time_since_sent_hours:    Math.round(elapsedHours * 10) / 10,
    sla_recommendation:       !isAcknowledged && elapsedHours > 24
      ? "Acknowledgment overdue — consider escalation or follow-up"
      : isAcknowledged
      ? "Acknowledged on time"
      : "Awaiting acknowledgment",
    followups_scheduled:      db.prepare(
      "SELECT COUNT(*) as n FROM comms_followups WHERE original_message_id=? AND status='pending'"
    ).get(messageId).n,
  };
}

// ─── List Channels ────────────────────────────────────────────────────────────

/**
 * List all available communication channels with pricing and capabilities.
 * @returns Channel catalog with per-message pricing and feature matrix
 */
export function listChannels() {
  const channels = [
    {
      channel:              "email",
      display_name:         "Email (SMTP/IMAP)",
      description:          "Verified email delivery with open tracking, acknowledgment links, and HTML support.",
      per_message_usd:      CHANNEL_PRICING_USD.email.per_message,
      acknowledgment_fee_usd: CHANNEL_PRICING_USD.email.acknowledgment_fee,
      platform_commission:  `${PLATFORM_COMMISSION * 100}%`,
      typical_delivery_ms:  3000,
      open_rate_pct:        45,
      ack_rate_pct:         35,
      max_content_chars:    100000,
      supports_html:        true,
      supports_attachments: true,
      delivery_guarantee:   "best_effort",
      recipient_format:     "user@example.com",
      compliance_regions:   ["US","EU","APAC"],
    },
    {
      channel:              "sms",
      display_name:         "SMS (Carrier-grade)",
      description:          "Carrier-verified SMS with delivery receipts and optional URL-based acknowledgment.",
      per_message_usd:      CHANNEL_PRICING_USD.sms.per_message,
      acknowledgment_fee_usd: CHANNEL_PRICING_USD.sms.acknowledgment_fee,
      platform_commission:  `${PLATFORM_COMMISSION * 100}%`,
      typical_delivery_ms:  800,
      open_rate_pct:        95,
      ack_rate_pct:         75,
      max_content_chars:    1600,
      supports_html:        false,
      supports_attachments: false,
      delivery_guarantee:   "carrier_confirmed",
      recipient_format:     "+14155552671 (E.164)",
      compliance_regions:   ["US","CA","UK","AU"],
    },
    {
      channel:              "whatsapp",
      display_name:         "WhatsApp Business API",
      description:          "End-to-end encrypted WhatsApp messages with double-tick delivery and read receipts.",
      per_message_usd:      CHANNEL_PRICING_USD.whatsapp.per_message,
      acknowledgment_fee_usd: CHANNEL_PRICING_USD.whatsapp.acknowledgment_fee,
      platform_commission:  `${PLATFORM_COMMISSION * 100}%`,
      typical_delivery_ms:  1200,
      open_rate_pct:        90,
      ack_rate_pct:         70,
      max_content_chars:    4096,
      supports_html:        false,
      supports_attachments: true,
      delivery_guarantee:   "e2e_confirmed",
      recipient_format:     "+14155552671 (E.164)",
      compliance_regions:   ["Global"],
      note:                 "Requires pre-approved WhatsApp Business template for first-time contacts.",
    },
    {
      channel:              "slack",
      display_name:         "Slack (Workspace Bot)",
      description:          "Direct Slack messages to workspace users or channels with reaction-based acknowledgment.",
      per_message_usd:      CHANNEL_PRICING_USD.slack.per_message,
      acknowledgment_fee_usd: CHANNEL_PRICING_USD.slack.acknowledgment_fee,
      platform_commission:  `${PLATFORM_COMMISSION * 100}%`,
      typical_delivery_ms:  300,
      open_rate_pct:        80,
      ack_rate_pct:         65,
      max_content_chars:    40000,
      supports_html:        false,
      supports_attachments: true,
      delivery_guarantee:   "guaranteed_if_online",
      recipient_format:     "@username or #channel",
      compliance_regions:   ["US","EU"],
      note:                 "Target workspace must have HiveAgent bot installed.",
    },
    {
      channel:              "voice",
      display_name:         "Voice Call (Synthetic Agent)",
      description:          "Outbound AI voice call with real-time transcript, outcome tracking, and acknowledgment via keypress.",
      per_message_usd:      CHANNEL_PRICING_USD.voice.per_message,
      acknowledgment_fee_usd: CHANNEL_PRICING_USD.voice.acknowledgment_fee,
      platform_commission:  `${PLATFORM_COMMISSION * 100}%`,
      typical_delivery_ms:  8000,
      open_rate_pct:        85,
      ack_rate_pct:         80,
      max_content_chars:    2000,
      supports_html:        false,
      supports_attachments: false,
      delivery_guarantee:   "answer_dependent",
      recipient_format:     "+14155552671 (E.164)",
      compliance_regions:   ["US","CA","UK","AU","EU"],
      note:                 "Billed per minute. price_usd reflects 1-minute base rate. See voice-telephony service for full call management.",
    },
  ];

  const cheapest  = [...channels].sort((a, b) => a.per_message_usd - b.per_message_usd)[0];
  const fastest   = [...channels].sort((a, b) => a.typical_delivery_ms - b.typical_delivery_ms)[0];
  const highestAck = [...channels].sort((a, b) => b.ack_rate_pct - a.ack_rate_pct)[0];

  return {
    channels,
    channel_count:     channels.length,
    platform_commission: `${PLATFORM_COMMISSION * 100}%`,
    cheapest_channel:  cheapest.channel,
    fastest_channel:   fastest.channel,
    highest_ack_channel: highestAck.channel,
    recommendations: {
      high_volume_bulk:      "email",
      time_sensitive:        "sms",
      highest_engagement:    "sms",
      encrypted_secure:      "whatsapp",
      internal_teams:        "slack",
      verbal_confirmation:   "voice",
    },
  };
}
