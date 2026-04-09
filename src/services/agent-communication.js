/**
 * HiveAgent Inter-Agent Communication (Phase 42)
 *
 * Signal: Autonomous agents need to communicate, negotiate, and coordinate.
 * Built on Agent-to-Agent (A2A) principles with encrypted messaging.
 *
 * Features:
 *   - Secure encrypted inter-agent messaging (request/response/negotiation/alert/broadcast)
 *   - Threaded conversations between agents
 *   - Automated price negotiation with counter-offer rounds
 *   - Capability broadcasting to discover and recruit other agents
 *   - Agent directory lookup by capability
 *
 * HiveAgent revenue: $0.01 per message, $0.10 per negotiation round.
 * Live mode: set COMM_API_KEY on Render.
 */

import { v4 as uuid } from "uuid";
import crypto from "crypto";
import db from "../db.js";

const LIVE_MODE = !!process.env.COMM_API_KEY;

// ─── Migration: drop stale tables if schema changed ───────────────────────────
try {
  const drops = ['agent_messages', 'message_threads', 'agent_negotiations', 'agent_broadcasts'];
  for (const t of drops) {
    try { db.exec(`DROP TABLE IF EXISTS ${t}`); } catch {}
  }
} catch {}

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_messages (
    id             TEXT PRIMARY KEY,
    from_agent_id  TEXT NOT NULL,
    to_agent_id    TEXT NOT NULL,
    message_type   TEXT NOT NULL,
    content        TEXT,
    encrypted      INTEGER DEFAULT 0,
    read           INTEGER DEFAULT 0,
    thread_id      TEXT,
    expires_at     TEXT,
    sent_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_threads (
    id              TEXT PRIMARY KEY,
    thread_id       TEXT NOT NULL UNIQUE,
    agent_ids       TEXT NOT NULL,
    subject         TEXT,
    message_count   INTEGER DEFAULT 0,
    last_message_at TEXT DEFAULT (datetime('now')),
    status          TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS agent_negotiations (
    id                   TEXT PRIMARY KEY,
    thread_id            TEXT,
    initiator_agent_id   TEXT NOT NULL,
    counterparty_agent_id TEXT NOT NULL,
    item                 TEXT NOT NULL,
    initial_offer_usdc   REAL NOT NULL,
    counter_offer_usdc   REAL,
    agreed_price_usdc    REAL,
    status               TEXT DEFAULT 'open',
    rounds               INTEGER DEFAULT 1,
    justification        TEXT,
    created_at           TEXT DEFAULT (datetime('now')),
    resolved_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_broadcasts (
    id                TEXT PRIMARY KEY,
    from_agent_id     TEXT NOT NULL,
    message           TEXT NOT NULL,
    target_capability TEXT,
    target_category   TEXT,
    recipients_count  INTEGER DEFAULT 0,
    sent_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_to       ON agent_messages(to_agent_id);
  CREATE INDEX IF NOT EXISTS idx_messages_from     ON agent_messages(from_agent_id);
  CREATE INDEX IF NOT EXISTS idx_messages_thread   ON agent_messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_negotiations_init ON agent_negotiations(initiator_agent_id);
  CREATE INDEX IF NOT EXISTS idx_negotiations_cp   ON agent_negotiations(counterparty_agent_id);
`);

// ─── Agent directory (simulated registered agents) ────────────────────────────

const AGENT_CAPABILITIES = [
  { agent_id: "agent-payment-001",    capabilities: ["payments", "usdc_transfer", "x402"], category: "finance",    active: true  },
  { agent_id: "agent-data-001",       capabilities: ["data_analysis", "sql", "reporting"],  category: "analytics",  active: true  },
  { agent_id: "agent-legal-001",      capabilities: ["contract_review", "nda", "compliance"], category: "legal",   active: true  },
  { agent_id: "agent-trade-001",      capabilities: ["crypto_trading", "dex", "arbitrage"], category: "finance",   active: true  },
  { agent_id: "agent-content-001",    capabilities: ["copywriting", "seo", "social_media"],  category: "marketing", active: true  },
  { agent_id: "agent-devops-001",     capabilities: ["deployment", "monitoring", "infra"],   category: "technical", active: true  },
  { agent_id: "agent-research-001",   capabilities: ["web_research", "summarization", "rag"], category: "research", active: true  },
  { agent_id: "agent-customer-001",   capabilities: ["customer_support", "ticket_triage"],   category: "cx",        active: true  },
  { agent_id: "agent-audit-001",      capabilities: ["accounting", "tax", "audit"],          category: "finance",   active: true  },
  { agent_id: "agent-security-001",   capabilities: ["security_scan", "threat_intel", "ids"], category: "security", active: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encryptContent(content) {
  if (!LIVE_MODE) {
    // Simulation: Base64 encode as pseudo-encryption
    return Buffer.from(content).toString("base64");
  }
  // Live: AES-256-GCM encryption using COMM_API_KEY as seed
  const key  = crypto.createHash("sha256").update(process.env.COMM_API_KEY).digest();
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc  = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

function getOrCreateThread(from_agent_id, to_agent_id, subject) {
  const agentIds = [from_agent_id, to_agent_id].sort().join(",");
  let thread = db.prepare("SELECT * FROM message_threads WHERE agent_ids = ? AND status = 'active'").get(agentIds);

  if (!thread) {
    const thread_id = `thread_${uuid().slice(0, 8)}`;
    const id = uuid();
    db.prepare(`
      INSERT INTO message_threads (id, thread_id, agent_ids, subject)
      VALUES (?, ?, ?, ?)
    `).run(id, thread_id, agentIds, subject || `Conversation: ${from_agent_id} ↔ ${to_agent_id}`);
    thread = { thread_id };
  }

  return thread.thread_id;
}

// ─── 1. sendMessage ───────────────────────────────────────────────────────────

export function sendMessage(args) {
  const {
    from_agent_id, to_agent_id, message_type = "request",
    content, encrypt = false, expires_minutes,
  } = args;

  if (!from_agent_id) throw new Error("from_agent_id required");
  if (!to_agent_id)   throw new Error("to_agent_id required");
  if (!content)       throw new Error("content required");

  const validTypes = ["request", "response", "negotiation", "alert", "broadcast"];
  if (!validTypes.includes(message_type)) {
    throw new Error(`Invalid message_type: ${message_type}. Options: ${validTypes.join(", ")}`);
  }

  const id       = uuid();
  const thread_id = getOrCreateThread(from_agent_id, to_agent_id, null);
  const payload  = encrypt ? encryptContent(content) : content;
  const expires_at = expires_minutes
    ? new Date(Date.now() + expires_minutes * 60 * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO agent_messages
      (id, from_agent_id, to_agent_id, message_type, content, encrypted, thread_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, from_agent_id, to_agent_id, message_type, payload, encrypt ? 1 : 0, thread_id, expires_at);

  // Update thread message count
  db.prepare(`
    UPDATE message_threads SET message_count = message_count + 1, last_message_at = datetime('now')
    WHERE thread_id = ?
  `).run(thread_id);

  return {
    success:     true,
    message_id:  id,
    thread_id,
    from_agent_id,
    to_agent_id,
    message_type,
    encrypted:   encrypt,
    expires_at:  expires_at || null,
    sent_at:     new Date().toISOString(),
    delivery:    "queued",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 2. getMessages ───────────────────────────────────────────────────────────

export function getMessages(args) {
  const { agent_id, direction = "all", unread_only = false, limit = 50 } = args;
  if (!agent_id) throw new Error("agent_id required");

  let query = "";
  const params = [];

  if (direction === "in") {
    query = "SELECT * FROM agent_messages WHERE to_agent_id = ?";
    params.push(agent_id);
  } else if (direction === "out") {
    query = "SELECT * FROM agent_messages WHERE from_agent_id = ?";
    params.push(agent_id);
  } else {
    query = "SELECT * FROM agent_messages WHERE from_agent_id = ? OR to_agent_id = ?";
    params.push(agent_id, agent_id);
  }

  if (unread_only) query += " AND read = 0";

  // Exclude expired messages
  query += " AND (expires_at IS NULL OR expires_at > datetime('now'))";
  query += " ORDER BY sent_at DESC LIMIT ?";
  params.push(Math.min(limit, 200));

  const messages = db.prepare(query).all(...params);

  // Mark inbound as read
  if (direction !== "out") {
    db.prepare("UPDATE agent_messages SET read = 1 WHERE to_agent_id = ? AND read = 0").run(agent_id);
  }

  const unreadCount = db.prepare("SELECT COUNT(*) as n FROM agent_messages WHERE to_agent_id = ? AND read = 0").get(agent_id).n;

  return {
    agent_id,
    direction,
    message_count:  messages.length,
    unread_count:   unreadCount,
    messages: messages.map(m => ({
      ...m,
      content: m.encrypted ? "[encrypted]" : m.content,
      encrypted: !!m.encrypted,
      read: !!m.read,
    })),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 3. startNegotiation ─────────────────────────────────────────────────────

export function startNegotiation(args) {
  const { from_agent_id, to_agent_id, item, initial_offer_usdc, justification } = args;
  if (!from_agent_id)     throw new Error("from_agent_id required");
  if (!to_agent_id)       throw new Error("to_agent_id required");
  if (!item)              throw new Error("item required (e.g. 'data_analysis_task', 'api_credits')");
  if (!initial_offer_usdc) throw new Error("initial_offer_usdc required");

  const id        = uuid();
  const thread_id = getOrCreateThread(from_agent_id, to_agent_id, `Negotiation: ${item}`);

  db.prepare(`
    INSERT INTO agent_negotiations
      (id, thread_id, initiator_agent_id, counterparty_agent_id, item, initial_offer_usdc, justification)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, thread_id, from_agent_id, to_agent_id, item, parseFloat(initial_offer_usdc), justification || null);

  // Send a negotiation message
  const msgContent = `NEGOTIATION INITIATED: ${from_agent_id} offers ${initial_offer_usdc} USDC for "${item}". ${justification || ""}`;
  db.prepare(`
    INSERT INTO agent_messages
      (id, from_agent_id, to_agent_id, message_type, content, thread_id)
    VALUES (?, ?, ?, 'negotiation', ?, ?)
  `).run(uuid(), from_agent_id, to_agent_id, msgContent, thread_id);

  return {
    success:         true,
    negotiation_id:  id,
    thread_id,
    initiator:       from_agent_id,
    counterparty:    to_agent_id,
    item,
    initial_offer_usdc: parseFloat(initial_offer_usdc),
    justification:   justification || null,
    status:          "open",
    rounds:          1,
    created_at:      new Date().toISOString(),
    next_step:       `Counterparty (${to_agent_id}) should call comm_counter_offer with negotiation_id: ${id}`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. counterOffer ─────────────────────────────────────────────────────────

export function counterOffer(args) {
  const { negotiation_id, agent_id, counter_offer_usdc, reason } = args;
  if (!negotiation_id)    throw new Error("negotiation_id required");
  if (!agent_id)          throw new Error("agent_id required");
  if (!counter_offer_usdc) throw new Error("counter_offer_usdc required");

  const neg = db.prepare("SELECT * FROM agent_negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found.`);
  if (neg.status !== "open") throw new Error(`Negotiation is already ${neg.status}. Cannot counter-offer.`);

  // Must be a participant
  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.counterparty_agent_id) {
    throw new Error(`Agent ${agent_id} is not a participant in negotiation ${negotiation_id}.`);
  }

  const current_price = neg.counter_offer_usdc || neg.initial_offer_usdc;
  const newRounds = neg.rounds + 1;

  db.prepare(`
    UPDATE agent_negotiations
    SET counter_offer_usdc = ?, rounds = ?
    WHERE id = ?
  `).run(parseFloat(counter_offer_usdc), newRounds, negotiation_id);

  // Auto-accept if within 5% of current offer
  const diff = Math.abs(counter_offer_usdc - current_price) / current_price;
  const autoAccept = diff <= 0.05 && newRounds > 2;

  if (autoAccept) {
    const agreed = parseFloat(((parseFloat(counter_offer_usdc) + current_price) / 2).toFixed(4));
    db.prepare(`
      UPDATE agent_negotiations
      SET status = 'agreed', agreed_price_usdc = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(agreed, negotiation_id);

    return {
      negotiation_id,
      agent_id,
      counter_offer_usdc: parseFloat(counter_offer_usdc),
      reason: reason || null,
      rounds:   newRounds,
      auto_accepted: true,
      agreed_price_usdc: agreed,
      status: "agreed",
      message: `Auto-accepted: offers were within 5%. Agreed price: ${agreed} USDC. Ready to transact.`,
      mode: LIVE_MODE ? "live" : "simulation",
    };
  }

  const other_agent = agent_id === neg.initiator_agent_id ? neg.counterparty_agent_id : neg.initiator_agent_id;

  return {
    negotiation_id,
    agent_id,
    counter_offer_usdc: parseFloat(counter_offer_usdc),
    previous_offer_usdc: current_price,
    change_pct:  parseFloat(((counter_offer_usdc - current_price) / current_price * 100).toFixed(1)),
    reason: reason || null,
    rounds:  newRounds,
    status: "open",
    next_step: `${other_agent} should respond: call comm_counter_offer or comm_accept_negotiation.`,
    auto_accept_threshold: "Offers within 5% of each other after round 2 will auto-settle.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 5. acceptNegotiation ────────────────────────────────────────────────────

export function acceptNegotiation(args) {
  const { negotiation_id, agent_id } = args;
  if (!negotiation_id) throw new Error("negotiation_id required");
  if (!agent_id)       throw new Error("agent_id required");

  const neg = db.prepare("SELECT * FROM agent_negotiations WHERE id = ?").get(negotiation_id);
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found.`);
  if (neg.status === "agreed") {
    return {
      negotiation_id,
      status: "already_agreed",
      agreed_price_usdc: neg.agreed_price_usdc,
      message: "Negotiation already agreed. Proceed to payment.",
    };
  }
  if (neg.status !== "open") throw new Error(`Negotiation is ${neg.status}. Cannot accept.`);

  if (agent_id !== neg.initiator_agent_id && agent_id !== neg.counterparty_agent_id) {
    throw new Error(`Agent ${agent_id} is not a participant in negotiation ${negotiation_id}.`);
  }

  const agreed_price = neg.counter_offer_usdc || neg.initial_offer_usdc;

  db.prepare(`
    UPDATE agent_negotiations
    SET status = 'agreed', agreed_price_usdc = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(parseFloat(agreed_price.toFixed(4)), negotiation_id);

  // Send confirmation message
  db.prepare(`
    INSERT INTO agent_messages (id, from_agent_id, to_agent_id, message_type, content, thread_id)
    VALUES (?, ?, ?, 'response', ?, ?)
  `).run(
    uuid(),
    agent_id,
    agent_id === neg.initiator_agent_id ? neg.counterparty_agent_id : neg.initiator_agent_id,
    `DEAL ACCEPTED: "${neg.item}" agreed at ${agreed_price.toFixed(4)} USDC. Initiator: ${neg.initiator_agent_id}`,
    neg.thread_id,
  );

  return {
    success:            true,
    negotiation_id,
    item:               neg.item,
    agreed_price_usdc:  parseFloat(agreed_price.toFixed(4)),
    initiator:          neg.initiator_agent_id,
    counterparty:       neg.counterparty_agent_id,
    rounds_to_agree:    neg.rounds,
    status:             "agreed",
    resolved_at:        new Date().toISOString(),
    ready_to_pay:       true,
    next_step:          `Transfer ${parseFloat(agreed_price.toFixed(4))} USDC from ${neg.initiator_agent_id} to ${neg.counterparty_agent_id} using payment_send or x402_pay.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 6. broadcastToAgents ─────────────────────────────────────────────────────

export function broadcastToAgents(args) {
  const { from_agent_id, message, target_capability, target_category } = args;
  if (!from_agent_id) throw new Error("from_agent_id required");
  if (!message)       throw new Error("message required");

  // Find matching agents from directory
  let targets = AGENT_CAPABILITIES.filter(a => a.active && a.agent_id !== from_agent_id);

  if (target_capability) {
    targets = targets.filter(a => a.capabilities.some(c => c.includes(target_capability.toLowerCase())));
  }
  if (target_category) {
    targets = targets.filter(a => a.category === target_category.toLowerCase());
  }

  const broadcastId = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO agent_broadcasts (id, from_agent_id, message, target_capability, target_category, recipients_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(broadcastId, from_agent_id, message, target_capability || null, target_category || null, targets.length);

  // Record a broadcast message for each target
  for (const target of targets) {
    db.prepare(`
      INSERT INTO agent_messages (id, from_agent_id, to_agent_id, message_type, content)
      VALUES (?, ?, ?, 'broadcast', ?)
    `).run(uuid(), from_agent_id, target.agent_id, `[BROADCAST] ${message}`);
  }

  return {
    success:          true,
    broadcast_id:     broadcastId,
    from_agent_id,
    message,
    target_capability: target_capability || null,
    target_category:   target_category || null,
    recipients:        targets.map(a => ({ agent_id: a.agent_id, capabilities: a.capabilities })),
    recipients_count:  targets.length,
    sent_at:           now,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 7. getAgentDirectory ─────────────────────────────────────────────────────

export function getAgentDirectory(args) {
  const { capability, active_only = true, limit = 20 } = args;

  let agents = AGENT_CAPABILITIES;
  if (active_only) agents = agents.filter(a => a.active);
  if (capability)  agents = agents.filter(a => a.capabilities.some(c => c.includes(capability.toLowerCase())));

  const limited = agents.slice(0, Math.min(limit, 100));

  // Enrich with message stats
  const enriched = limited.map(a => {
    const msgCount = db.prepare("SELECT COUNT(*) as n FROM agent_messages WHERE to_agent_id = ? OR from_agent_id = ?").get(a.agent_id, a.agent_id).n;
    const negCount = db.prepare("SELECT COUNT(*) as n FROM agent_negotiations WHERE initiator_agent_id = ? OR counterparty_agent_id = ?").get(a.agent_id, a.agent_id).n;
    return {
      ...a,
      messages_sent_received: msgCount,
      negotiations:           negCount,
      contact_methods:        ["agent_message", "negotiation", "broadcast"],
    };
  });

  return {
    total_agents:  AGENT_CAPABILITIES.length,
    active_agents: AGENT_CAPABILITIES.filter(a => a.active).length,
    filter: {
      capability:  capability || null,
      active_only,
    },
    agents: enriched,
    usage: "Use comm_send_message to contact an agent. Use comm_start_negotiation to open price negotiation. Use comm_broadcast to reach multiple agents at once.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}
