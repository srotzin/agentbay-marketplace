/**
 * HiveAgent Webhook Receiver Service
 *
 * Agents register endpoints to receive events. When events occur on the platform,
 * registered endpoints are notified via HTTP POST with a signed payload.
 *
 * FREE SERVICE — makes agents sticky (they rely on webhooks to stay informed).
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";
import crypto from "node:crypto";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    secret TEXT NOT NULL,
    events TEXT DEFAULT '["*"]',
    is_active INTEGER DEFAULT 1,
    last_triggered TEXT,
    trigger_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT REFERENCES webhook_endpoints(id),
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    delivered_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_event_types (
    type TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_agent ON webhook_endpoints(agent_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint ON webhook_events(endpoint_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
`);

// ─── Seed Event Types ─────────────────────────────

db.prepare(`
  INSERT OR IGNORE INTO webhook_event_types (type, description) VALUES
    ('transaction_completed', 'A payment transaction was completed successfully'),
    ('escrow_locked', 'Funds have been locked into escrow'),
    ('escrow_released', 'Escrow funds have been released to the recipient'),
    ('bet_settled', 'A bet or wager has been settled with a result'),
    ('prediction_resolved', 'A prediction market outcome has been resolved'),
    ('price_alert', 'An asset price has crossed a threshold'),
    ('subscription_renewed', 'A recurring subscription has been renewed and charged'),
    ('job_completed', 'An async job or task has finished execution'),
    ('auction_bid_received', 'A new bid was placed on an auction'),
    ('dao_proposal_created', 'A new DAO governance proposal was created'),
    ('nft_sold', 'An NFT has been sold or transferred'),
    ('insurance_claim_filed', 'An insurance claim has been filed and is pending review')
`).run();

// ─── Helpers ──────────────────────────────────────

/**
 * Check if an endpoint is subscribed to a given event type.
 * Endpoints subscribed to "*" receive all events.
 */
function isSubscribedTo(endpointEvents, event_type) {
  let events;
  try {
    events = typeof endpointEvents === "string" ? JSON.parse(endpointEvents) : endpointEvents;
  } catch {
    events = ["*"];
  }
  return events.includes("*") || events.includes(event_type);
}

/**
 * Attempt to deliver a webhook event to the endpoint URL via HTTP POST.
 */
async function deliverWebhook(endpoint, event_id, event_type, payload, payloadStr) {
  if (!endpoint.url) return { delivered: false, reason: "no_url" };

  try {
    const signature = crypto
      .createHmac("sha256", endpoint.secret)
      .update(payloadStr)
      .digest("hex");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": endpoint.secret,
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": event_type,
        "X-Webhook-Event-Id": event_id,
        "X-HiveAgent-Version": "1.0",
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      delivered: response.ok,
      status_code: response.status,
      reason: response.ok ? "ok" : `http_${response.status}`,
    };
  } catch (e) {
    return {
      delivered: false,
      reason: e.name === "AbortError" ? "timeout" : "network_error",
      error: e.message,
    };
  }
}

// ─── Webhook Management ───────────────────────────

/**
 * Register a new webhook endpoint for an agent.
 * Auto-generates a secret for verifying deliveries.
 */
export function registerWebhook({ agent_id, name, events = ["*"], url } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!name) throw new Error("name is required");

  const id = uuid();
  const secret = crypto.randomBytes(32).toString("hex");
  const eventsArr = Array.isArray(events) ? events : [events];
  const eventsJson = JSON.stringify(eventsArr);

  db.prepare(`
    INSERT INTO webhook_endpoints (id, agent_id, name, url, secret, events)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, name, url || null, secret, eventsJson);

  return {
    endpoint_id: id,
    agent_id,
    name,
    url: url || null,
    secret,
    events: eventsArr,
    is_active: true,
    created_at: new Date().toISOString(),
    note: "Store your secret securely — it will not be shown again.",
  };
}

/**
 * Unregister (deactivate) a webhook endpoint.
 */
export function unregisterWebhook(endpoint_id, agent_id) {
  const endpoint = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(endpoint_id);
  if (!endpoint) throw new Error("Webhook endpoint not found");
  if (endpoint.agent_id !== agent_id) throw new Error("Not authorized to remove this webhook");

  db.prepare("UPDATE webhook_endpoints SET is_active = 0 WHERE id = ?").run(endpoint_id);
  return { endpoint_id, unregistered: true };
}

/**
 * List all webhook endpoints for an agent.
 */
export function listWebhooks(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");

  const endpoints = db.prepare(`
    SELECT id, agent_id, name, url, events, is_active, last_triggered, trigger_count, created_at
    FROM webhook_endpoints
    WHERE agent_id = ?
    ORDER BY created_at DESC
  `).all(agent_id);

  return endpoints.map(e => ({
    ...e,
    events: (() => { try { return JSON.parse(e.events); } catch { return ["*"]; } })(),
    is_active: !!e.is_active,
    // Secret is NOT returned in list — only shown at registration time
  }));
}

// ─── Event Triggering ─────────────────────────────

/**
 * Trigger an event. Finds all subscribed endpoints, creates event records,
 * and attempts delivery for endpoints with URLs.
 */
export async function triggerEvent({ event_type, payload, target_agent_id } = {}) {
  if (!event_type) throw new Error("event_type is required");
  if (!payload) throw new Error("payload is required");

  const payloadStr = typeof payload === "object" ? JSON.stringify(payload) : payload;
  const parsedPayload = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return payload; } })() : payload;

  // Enrich payload with event metadata
  const enrichedPayload = {
    event_type,
    event_id: uuid(),
    triggered_at: new Date().toISOString(),
    data: parsedPayload,
  };
  const enrichedStr = JSON.stringify(enrichedPayload);

  // Find matching endpoints
  let endpointQuery = "SELECT * FROM webhook_endpoints WHERE is_active = 1";
  const params = [];
  if (target_agent_id) {
    endpointQuery += " AND agent_id = ?";
    params.push(target_agent_id);
  }

  const allEndpoints = db.prepare(endpointQuery).all(...params);
  const subscribedEndpoints = allEndpoints.filter(e => isSubscribedTo(e.events, event_type));

  const results = [];

  for (const endpoint of subscribedEndpoints) {
    const event_id = uuid();

    // Create event record
    db.prepare(`
      INSERT INTO webhook_events (id, endpoint_id, event_type, payload, status, attempts)
      VALUES (?, ?, ?, ?, 'pending', 0)
    `).run(event_id, endpoint.id, event_type, enrichedStr);

    // Attempt delivery
    let deliveryResult = { delivered: false, reason: "no_url" };
    if (endpoint.url) {
      deliveryResult = await deliverWebhook(endpoint, event_id, event_type, enrichedPayload, enrichedStr);
    }

    const newStatus = deliveryResult.delivered ? "delivered" : (endpoint.url ? "failed" : "pending");
    const deliveredAt = deliveryResult.delivered ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE webhook_events
      SET status = ?, attempts = 1, delivered_at = ?
      WHERE id = ?
    `).run(newStatus, deliveredAt, event_id);

    // Update endpoint stats
    db.prepare(`
      UPDATE webhook_endpoints
      SET trigger_count = trigger_count + 1, last_triggered = datetime('now')
      WHERE id = ?
    `).run(endpoint.id);

    results.push({
      endpoint_id: endpoint.id,
      event_id,
      agent_id: endpoint.agent_id,
      status: newStatus,
      delivery: deliveryResult,
    });
  }

  return {
    event_type,
    event_id: enrichedPayload.event_id,
    endpoints_notified: results.length,
    delivered: results.filter(r => r.status === "delivered").length,
    pending: results.filter(r => r.status === "pending").length,
    failed: results.filter(r => r.status === "failed").length,
    results,
  };
}

/**
 * Get recent webhook event history for an agent.
 */
export function getEventHistory({ agent_id, event_type, limit = 50 } = {}) {
  if (!agent_id) throw new Error("agent_id is required");

  let sql = `
    SELECT we.id, we.endpoint_id, we.event_type, we.payload, we.status,
           we.attempts, we.delivered_at, we.created_at,
           wep.name as endpoint_name
    FROM webhook_events we
    JOIN webhook_endpoints wep ON we.endpoint_id = wep.id
    WHERE wep.agent_id = ?
  `;
  const params = [agent_id];

  if (event_type) {
    sql += " AND we.event_type = ?";
    params.push(event_type);
  }

  sql += " ORDER BY we.created_at DESC LIMIT ?";
  params.push(Math.min(limit, 200));

  const events = db.prepare(sql).all(...params);

  return {
    agent_id,
    event_type: event_type || null,
    events: events.map(e => ({
      ...e,
      payload: (() => { try { return JSON.parse(e.payload); } catch { return e.payload; } })(),
    })),
    count: events.length,
  };
}

/**
 * Platform-wide webhook statistics.
 */
export function getWebhookStats() {
  const totalEndpoints = db.prepare("SELECT COUNT(*) as c FROM webhook_endpoints WHERE is_active = 1").get().c;
  const totalEvents = db.prepare("SELECT COUNT(*) as c FROM webhook_events").get().c;
  const delivered = db.prepare("SELECT COUNT(*) as c FROM webhook_events WHERE status = 'delivered'").get().c;
  const failed = db.prepare("SELECT COUNT(*) as c FROM webhook_events WHERE status = 'failed'").get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM webhook_events WHERE status = 'pending'").get().c;
  const totalTriggers = db.prepare("SELECT COALESCE(SUM(trigger_count), 0) as t FROM webhook_endpoints").get().t;

  const eventTypes = db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM webhook_events
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT 10
  `).all();

  const registeredTypes = db.prepare("SELECT type, description FROM webhook_event_types ORDER BY type").all();

  return {
    total_active_endpoints: totalEndpoints,
    total_events: totalEvents,
    delivered,
    failed,
    pending,
    delivery_rate_pct: totalEvents > 0 ? Math.round((delivered / totalEvents) * 10000) / 100 : 0,
    total_trigger_invocations: totalTriggers,
    top_event_types: eventTypes,
    registered_event_types: registeredTypes,
  };
}
