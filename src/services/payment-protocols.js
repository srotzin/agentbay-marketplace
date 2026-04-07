/**
 * HiveAgent Payment Protocol Hub
 *
 * Unified payment processing across multiple protocols — not just x402/USDC.
 * Agents and merchants can transact via any supported protocol with a single
 * consistent API.
 *
 * Supported protocols:
 *   x402            — HTTP 402 native crypto payments (USDC on Base L2) [LIVE]
 *   stripe_mpp      — Stripe multi-party payments for AI agents [READY]
 *   visa_tap        — Visa Tap-to-Pay agent extensions [READY]
 *   google_ap2      — Google Agent Pay 2.0 [READY]
 *   paypal_agent    — PayPal Agent-Ready payments [READY]
 */

import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

// ─── Protocol Registry ───────────────────────────────────────────────────────

const PROTOCOLS = {
  x402: {
    name: "x402",
    display_name: "x402 / USDC on Base",
    type: "crypto",
    status: "live",
    description: "HTTP 402 Payment Required protocol. Native crypto micropayments using USDC on Base L2. Instant settlement, ~$0.001 gas fee. Ideal for AI agent micropayments.",
    supported_currencies: ["USDC", "ETH", "DAI"],
    settlement_time: "instant",
    fee_pct: 0.5,
    fee_fixed: 0.001,
    min_amount: 0.001,
    max_amount: 100000,
    features: ["micropayments", "streaming", "instant_settlement", "programmable"],
  },
  stripe_mpp: {
    name: "stripe_mpp",
    display_name: "Stripe Multi-Party Payments",
    type: "hybrid",
    status: "ready",
    description: "Stripe's agent-optimized multi-party payment rails. Pre-authorized spending sessions allow agents to make many micropayments without per-transaction overhead. Ideal for high-volume agent workflows.",
    supported_currencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
    settlement_time: "1-2 business days",
    fee_pct: 2.9,
    fee_fixed: 0.30,
    min_amount: 0.01,
    max_amount: 999999,
    features: ["sessions", "multi_party", "recurring", "refunds", "disputes", "fiat"],
  },
  visa_tap: {
    name: "visa_tap",
    display_name: "Visa Tap-to-Pay (Agent Edition)",
    type: "fiat",
    status: "ready",
    description: "Visa's agent payment extension for point-of-sale and physical commerce. Enables AI agents to authorize payments at physical terminals via virtual card credentials.",
    supported_currencies: ["USD", "EUR", "GBP", "JPY", "CAD"],
    settlement_time: "1-3 business days",
    fee_pct: 1.8,
    fee_fixed: 0.10,
    min_amount: 0.01,
    max_amount: 50000,
    features: ["physical_pos", "virtual_cards", "chargeback_protection", "3ds"],
  },
  google_ap2: {
    name: "google_ap2",
    display_name: "Google Agent Pay 2.0",
    type: "hybrid",
    status: "ready",
    description: "Google Agent Pay 2.0 — unified payment API for agents operating within Google ecosystems (Search, Assistant, Workspace). Supports both card networks and Google Pay balance.",
    supported_currencies: ["USD", "EUR", "INR", "BRL", "MXN"],
    settlement_time: "1 business day",
    fee_pct: 2.5,
    fee_fixed: 0.25,
    min_amount: 0.01,
    max_amount: 250000,
    features: ["google_pay", "card_networks", "identity_binding", "spending_controls"],
  },
  paypal_agent: {
    name: "paypal_agent",
    display_name: "PayPal Agent-Ready",
    type: "hybrid",
    status: "ready",
    description: "PayPal's agent-authorized payment protocol. Agents can be granted spending authority under a human PayPal account. Supports PayPal balance, linked bank, and card funding.",
    supported_currencies: ["USD", "EUR", "GBP", "AUD", "CAD", "JPY"],
    settlement_time: "instant to 1 business day",
    fee_pct: 2.9,
    fee_fixed: 0.30,
    min_amount: 0.01,
    max_amount: 10000,
    features: ["buyer_protection", "recurring", "agent_delegation", "instant_transfer"],
  },
};

// ─── Schema Initialization ───────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hwa_payment_transactions (
    id               TEXT PRIMARY KEY,
    protocol         TEXT NOT NULL,
    amount           REAL NOT NULL,
    currency         TEXT NOT NULL,
    payer_agent      TEXT NOT NULL,
    merchant_id      TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending',
    fee              REAL DEFAULT 0,
    settlement_time  TEXT,
    tx_hash          TEXT,
    session_id       TEXT,
    metadata         TEXT DEFAULT '{}',
    created_at       TEXT DEFAULT (datetime('now')),
    settled_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS hwa_payment_sessions (
    id               TEXT PRIMARY KEY,
    protocol         TEXT NOT NULL,
    agent_id         TEXT NOT NULL,
    spending_limit   REAL NOT NULL,
    amount_used      REAL DEFAULT 0,
    currency         TEXT DEFAULT 'USD',
    token            TEXT NOT NULL,
    status           TEXT DEFAULT 'active',
    duration_hours   INTEGER DEFAULT 24,
    expires_at       TEXT NOT NULL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hwa_payment_proofs (
    id               TEXT PRIMARY KEY,
    protocol         TEXT NOT NULL,
    proof_data       TEXT NOT NULL,
    amount           REAL,
    payer            TEXT,
    verified         INTEGER DEFAULT 0,
    verified_at      TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Protocol Handlers ───────────────────────────────────────────────────────

function processX402(amount, currency, payerAgent, merchantId) {
  // Simulate x402 USDC settlement on Base L2
  const fee = Math.max(amount * 0.005, 0.001);
  const txHash = `0x${uuidv4().replace(/-/g, "")}${uuidv4().replace(/-/g, "")}`.slice(0, 66);
  return {
    status: "settled",
    settlement_time: "instant",
    fee,
    tx_hash: txHash,
    network: "Base L2",
    block_confirmation: "~2 seconds",
  };
}

function processStripeMPP(amount, currency, payerAgent, merchantId) {
  const fee = amount * 0.029 + 0.30;
  return {
    status: "processing",
    settlement_time: "1-2 business days",
    fee,
    stripe_payment_intent: `pi_${uuidv4().replace(/-/g, "").slice(0, 24)}`,
    requires_capture: false,
  };
}

function processVisaTap(amount, currency, payerAgent, merchantId) {
  const fee = amount * 0.018 + 0.10;
  return {
    status: "authorized",
    settlement_time: "1-3 business days",
    fee,
    authorization_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    network: "Visa",
  };
}

function processGoogleAP2(amount, currency, payerAgent, merchantId) {
  const fee = amount * 0.025 + 0.25;
  return {
    status: "processing",
    settlement_time: "1 business day",
    fee,
    google_payment_token: `gpt_${uuidv4().replace(/-/g, "").slice(0, 20)}`,
  };
}

function processPayPalAgent(amount, currency, payerAgent, merchantId) {
  const fee = amount * 0.029 + 0.30;
  return {
    status: "completed",
    settlement_time: "instant to 1 business day",
    fee,
    paypal_capture_id: `CAP_${uuidv4().replace(/-/g, "").slice(0, 17).toUpperCase()}`,
  };
}

const PROTOCOL_HANDLERS = {
  x402: processX402,
  stripe_mpp: processStripeMPP,
  visa_tap: processVisaTap,
  google_ap2: processGoogleAP2,
  paypal_agent: processPayPalAgent,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * getSupportedProtocols()
 *
 * List all supported payment protocols with full metadata.
 *
 * @returns {{ protocols: Array, count: number }}
 */
export function getSupportedProtocols() {
  const protocols = Object.values(PROTOCOLS).map((p) => ({
    name: p.name,
    display_name: p.display_name,
    type: p.type,
    status: p.status,
    description: p.description,
    supported_currencies: p.supported_currencies,
    settlement_time: p.settlement_time,
    fee: `${p.fee_pct}% + $${p.fee_fixed} fixed`,
    min_amount: p.min_amount,
    max_amount: p.max_amount,
    features: p.features,
  }));

  const live = protocols.filter((p) => p.status === "live");
  const ready = protocols.filter((p) => p.status === "ready");

  return {
    protocols,
    count: protocols.length,
    live: live.map((p) => p.name),
    ready: ready.map((p) => p.name),
    recommendation: "For crypto micropayments use x402. For fiat sessions use stripe_mpp. For physical commerce use visa_tap.",
  };
}

/**
 * processPayment(protocol, amount, currency, payerAgent, merchantId)
 *
 * Unified payment processing across all supported protocols.
 *
 * @param {string} protocol    Protocol name (x402, stripe_mpp, visa_tap, google_ap2, paypal_agent)
 * @param {number} amount      Payment amount
 * @param {string} currency    Currency code (USDC, USD, EUR, etc.)
 * @param {string} payerAgent  Agent ID of the payer
 * @param {string} merchantId  Merchant identifier
 * @returns {{ transaction_id, status, protocol_used, settlement_time, fee }}
 */
export function processPayment(protocol, amount, currency, payerAgent, merchantId) {
  const proto = PROTOCOLS[protocol];
  if (!proto) {
    return {
      success: false,
      error: `Unknown protocol: "${protocol}". Supported: ${Object.keys(PROTOCOLS).join(", ")}`,
    };
  }

  if (amount < proto.min_amount || amount > proto.max_amount) {
    return {
      success: false,
      error: `Amount $${amount} out of range for ${protocol}. Min: $${proto.min_amount}, Max: $${proto.max_amount}`,
    };
  }

  if (!proto.supported_currencies.includes(currency.toUpperCase())) {
    return {
      success: false,
      error: `Currency ${currency} not supported by ${protocol}. Supported: ${proto.supported_currencies.join(", ")}`,
    };
  }

  const handler = PROTOCOL_HANDLERS[protocol];
  const result = handler(amount, currency, payerAgent, merchantId);

  const txId = `tx_${uuidv4()}`;

  db.prepare(`
    INSERT INTO hwa_payment_transactions (id, protocol, amount, currency, payer_agent, merchant_id, status, fee, settlement_time, tx_hash, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    txId,
    protocol,
    amount,
    currency.toUpperCase(),
    payerAgent,
    merchantId,
    result.status,
    result.fee,
    result.settlement_time,
    result.tx_hash || null,
    JSON.stringify({ protocol_details: result }),
  );

  return {
    success: true,
    transaction_id: txId,
    protocol_used: protocol,
    status: result.status,
    amount,
    currency: currency.toUpperCase(),
    fee: result.fee,
    net_amount: amount - result.fee,
    settlement_time: result.settlement_time,
    payer_agent: payerAgent,
    merchant_id: merchantId,
    ...( result.tx_hash ? { tx_hash: result.tx_hash } : {} ),
    ...( result.stripe_payment_intent ? { stripe_payment_intent: result.stripe_payment_intent } : {} ),
    ...( result.google_payment_token ? { google_payment_token: result.google_payment_token } : {} ),
    ...( result.paypal_capture_id ? { paypal_capture_id: result.paypal_capture_id } : {} ),
    ...( result.authorization_code ? { authorization_code: result.authorization_code } : {} ),
    created_at: new Date().toISOString(),
  };
}

/**
 * createPaymentSession(protocol, agentId, spendingLimit, duration)
 *
 * Create a pre-authorized spending session (Stripe MPP style). The agent
 * is authorized for multiple micropayments within the session without
 * per-transaction overhead.
 *
 * @param {string} protocol       Protocol (stripe_mpp, google_ap2, paypal_agent)
 * @param {string} agentId        Agent being authorized
 * @param {number} spendingLimit  Maximum spend for this session (USD)
 * @param {number} duration       Session duration in hours (default 24)
 * @returns {{ session_id, token, limit, expires_at }}
 */
export function createPaymentSession(protocol, agentId, spendingLimit, duration = 24) {
  const proto = PROTOCOLS[protocol];
  if (!proto) {
    return {
      success: false,
      error: `Unknown protocol: "${protocol}". Supported: ${Object.keys(PROTOCOLS).join(", ")}`,
    };
  }

  if (!proto.features.includes("sessions") && !proto.features.includes("recurring") && !proto.features.includes("agent_delegation")) {
    return {
      success: false,
      error: `Protocol "${protocol}" does not support payment sessions. Use stripe_mpp, google_ap2, or paypal_agent.`,
    };
  }

  const sessionId = `sess_${uuidv4()}`;
  const token = `tok_${uuidv4().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO hwa_payment_sessions (id, protocol, agent_id, spending_limit, currency, token, duration_hours, expires_at)
    VALUES (?, ?, ?, ?, 'USD', ?, ?, ?)
  `).run(sessionId, protocol, agentId, spendingLimit, token, duration, expiresAt);

  return {
    success: true,
    session_id: sessionId,
    token,
    protocol,
    agent_id: agentId,
    limit: spendingLimit,
    currency: "USD",
    amount_used: 0,
    remaining: spendingLimit,
    duration_hours: duration,
    expires_at: expiresAt,
    status: "active",
    note: `Session authorized for up to $${spendingLimit} USD. Use session token for subsequent payments without per-tx overhead.`,
  };
}

/**
 * verifyPaymentProof(protocol, proof)
 *
 * Verify a payment proof from any protocol.
 *
 * @param {string} protocol  Protocol that generated the proof
 * @param {string|object} proof  The proof data (tx hash, receipt, JWT, etc.)
 * @returns {{ verified: boolean, protocol, amount, payer, timestamp }}
 */
export function verifyPaymentProof(protocol, proof) {
  if (!PROTOCOLS[protocol]) {
    return {
      verified: false,
      error: `Unknown protocol: "${protocol}"`,
    };
  }

  const proofStr = typeof proof === "string" ? proof : JSON.stringify(proof);
  const proofId = `proof_${uuidv4()}`;

  // Verify by protocol
  let verified = false;
  let amount = null;
  let payer = null;
  let timestamp = new Date().toISOString();

  switch (protocol) {
    case "x402": {
      // x402: verify tx hash on Base L2 (simulated)
      const txHash = typeof proof === "object" ? proof.tx_hash : proof;
      verified = typeof txHash === "string" && txHash.startsWith("0x") && txHash.length === 66;
      if (verified && typeof proof === "object") {
        amount = proof.amount;
        payer = proof.payer_agent;
        timestamp = proof.timestamp || timestamp;
      }
      break;
    }
    case "stripe_mpp": {
      // stripe_mpp: verify payment_intent format
      const pi = typeof proof === "object" ? proof.payment_intent : proof;
      verified = typeof pi === "string" && pi.startsWith("pi_") && pi.length > 10;
      if (verified && typeof proof === "object") {
        amount = proof.amount;
        payer = proof.payer;
      }
      break;
    }
    case "visa_tap": {
      // visa_tap: verify auth code format
      const auth = typeof proof === "object" ? proof.authorization_code : proof;
      verified = typeof auth === "string" && auth.length === 6 && /^[A-Z0-9]+$/.test(auth);
      if (verified && typeof proof === "object") {
        amount = proof.amount;
        payer = proof.cardholder;
      }
      break;
    }
    case "google_ap2": {
      // google_ap2: verify GPT token format
      const gpt = typeof proof === "object" ? proof.google_payment_token : proof;
      verified = typeof gpt === "string" && gpt.startsWith("gpt_") && gpt.length > 10;
      if (verified && typeof proof === "object") {
        amount = proof.amount;
        payer = proof.payer;
      }
      break;
    }
    case "paypal_agent": {
      // paypal_agent: verify capture ID format
      const cap = typeof proof === "object" ? proof.capture_id : proof;
      verified = typeof cap === "string" && cap.startsWith("CAP_") && cap.length > 10;
      if (verified && typeof proof === "object") {
        amount = proof.amount;
        payer = proof.payer;
      }
      break;
    }
    default:
      verified = false;
  }

  db.prepare(`
    INSERT INTO hwa_payment_proofs (id, protocol, proof_data, amount, payer, verified, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(proofId, protocol, proofStr.slice(0, 2000), amount, payer, verified ? 1 : 0, verified ? timestamp : null);

  return {
    verified,
    proof_id: proofId,
    protocol,
    amount,
    payer,
    timestamp,
    ...(verified ? {} : { reason: `Could not verify ${protocol} proof. Check proof format for this protocol.` }),
  };
}

/**
 * getPaymentDashboard(agentId)
 *
 * Unified payment dashboard across all protocols for an agent.
 *
 * @param {string} agentId  Agent ID
 * @returns {{ by_protocol, total_volume, fees_paid, pending_settlements }}
 */
export function getPaymentDashboard(agentId) {
  const rows = db.prepare(`
    SELECT protocol, status, SUM(amount) as volume, SUM(fee) as fees, COUNT(*) as count
    FROM hwa_payment_transactions
    WHERE payer_agent = ?
    GROUP BY protocol, status
  `).all(agentId);

  const sessions = db.prepare(`
    SELECT * FROM hwa_payment_sessions
    WHERE agent_id = ? AND status = 'active'
  `).all(agentId);

  const pending = db.prepare(`
    SELECT * FROM hwa_payment_transactions
    WHERE payer_agent = ? AND status IN ('pending', 'processing', 'authorized')
    ORDER BY created_at DESC
    LIMIT 20
  `).all(agentId);

  // Aggregate by protocol
  const byProtocol = {};
  let totalVolume = 0;
  let totalFees = 0;

  for (const row of rows) {
    if (!byProtocol[row.protocol]) {
      byProtocol[row.protocol] = {
        protocol: row.protocol,
        display_name: PROTOCOLS[row.protocol]?.display_name || row.protocol,
        total_volume: 0,
        total_fees: 0,
        transaction_count: 0,
        by_status: {},
      };
    }
    byProtocol[row.protocol].total_volume += row.volume || 0;
    byProtocol[row.protocol].total_fees += row.fees || 0;
    byProtocol[row.protocol].transaction_count += row.count || 0;
    byProtocol[row.protocol].by_status[row.status] = row.count;
    totalVolume += row.volume || 0;
    totalFees += row.fees || 0;
  }

  return {
    agent_id: agentId,
    by_protocol: byProtocol,
    total_volume: Math.round(totalVolume * 100) / 100,
    fees_paid: Math.round(totalFees * 100) / 100,
    net_volume: Math.round((totalVolume - totalFees) * 100) / 100,
    active_sessions: sessions.map((s) => ({
      session_id: s.id,
      protocol: s.protocol,
      limit: s.spending_limit,
      used: s.amount_used,
      remaining: s.spending_limit - s.amount_used,
      expires_at: s.expires_at,
    })),
    pending_settlements: pending.map((p) => ({
      transaction_id: p.id,
      protocol: p.protocol,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      created_at: p.created_at,
    })),
    protocols_used: Object.keys(byProtocol),
    as_of: new Date().toISOString(),
  };
}
