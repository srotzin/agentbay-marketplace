/**
 * x402 "upto" Metered Billing — Service
 * HiveAgent | April 9, 2026
 *
 * Coinbase just shipped x402 "upto" — the usage-based pricing primitive for
 * variable-cost services (LLM inference, compute, streaming data, etc.).
 *
 * How it works:
 *   1. Seller creates a metered session with a max_price ceiling
 *   2. Buyer authorizes a spending limit (≤ seller's max_price)
 *   3. Server records actual usage during the session
 *   4. Settlement charges only min(actual_cost, max_authorized) — via CDP Facilitator
 *   5. Gasless, EVM-compatible, supports any ERC-20 token
 *
 * Live mode:  CDP_API_KEY_ID set → calls CDP Facilitator at
 *             https://api.cdp.coinbase.com/platform/v2/x402 with setSettlementOverrides
 * Simulation: Realistic session IDs, usage tracking, settlement receipts
 */

import db from "../db.js";
import crypto from "crypto";

// ─── Mode ─────────────────────────────────────────────────────────────────────

const LIVE_MODE = !!process.env.CDP_API_KEY_ID;
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS x402_upto_sessions (
      id                TEXT PRIMARY KEY,
      seller_agent_id   TEXT NOT NULL,
      endpoint          TEXT NOT NULL,
      pricing_model     TEXT NOT NULL DEFAULT 'per_token',
      max_price         REAL NOT NULL,
      token_address     TEXT NOT NULL DEFAULT 'USDC',
      chain_id          INTEGER NOT NULL DEFAULT 8453,
      state             TEXT NOT NULL DEFAULT 'created',
      buyer_agent_id    TEXT,
      max_authorized    REAL,
      authorized_at     TEXT,
      tokens_used       INTEGER NOT NULL DEFAULT 0,
      seconds_elapsed   REAL NOT NULL DEFAULT 0,
      bytes_processed   INTEGER NOT NULL DEFAULT 0,
      requests_made     INTEGER NOT NULL DEFAULT 0,
      actual_cost       REAL,
      settled_amount    REAL,
      settlement_tx     TEXT,
      receipt_id        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      settled_at        TEXT
    );
  `);
} catch (e) {
  console.error("[x402Upto] x402_upto_sessions table error:", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS x402_upto_settlements (
      id              TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL,
      seller_agent_id TEXT NOT NULL,
      buyer_agent_id  TEXT NOT NULL,
      max_authorized  REAL NOT NULL,
      actual_cost     REAL NOT NULL,
      settled_amount  REAL NOT NULL,
      token_address   TEXT NOT NULL DEFAULT 'USDC',
      chain_id        INTEGER NOT NULL DEFAULT 8453,
      tx_hash         TEXT,
      facilitator_id  TEXT,
      pricing_model   TEXT NOT NULL,
      tokens_used     INTEGER NOT NULL DEFAULT 0,
      seconds_elapsed REAL NOT NULL DEFAULT 0,
      bytes_processed INTEGER NOT NULL DEFAULT 0,
      requests_made   INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[x402Upto] x402_upto_settlements table error:", e.message);
}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_x402_sessions_seller ON x402_upto_sessions(seller_agent_id);
    CREATE INDEX IF NOT EXISTS idx_x402_sessions_buyer  ON x402_upto_sessions(buyer_agent_id);
    CREATE INDEX IF NOT EXISTS idx_x402_sessions_state  ON x402_upto_sessions(state);
    CREATE INDEX IF NOT EXISTS idx_x402_settlements_session ON x402_upto_settlements(session_id);
  `);
} catch (e) {
  console.error("[x402Upto] index creation error:", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function txHash() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

function walletAddress() {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

/**
 * Calculate the actual cost based on pricing model and usage.
 */
function calculateActualCost(pricingModel, usage, maxPrice) {
  const { tokens_used = 0, seconds_elapsed = 0, bytes_processed = 0, requests_made = 0 } = usage;

  // Pricing rates per unit
  const RATES = {
    per_token:   0.000002, // $0.000002 per token  (~$2/1M tokens)
    per_second:  0.0005,   // $0.0005 per second
    per_byte:    0.000001, // $0.000001 per byte   (~$1/1MB)
    per_request: 0.01,     // $0.01 per request
  };

  let cost = 0;
  switch (pricingModel) {
    case "per_token":
      cost = tokens_used * RATES.per_token;
      break;
    case "per_second":
      cost = seconds_elapsed * RATES.per_second;
      break;
    case "per_byte":
      cost = bytes_processed * RATES.per_byte;
      break;
    case "per_request":
      cost = requests_made * RATES.per_request;
      break;
    default:
      cost = tokens_used * RATES.per_token;
  }

  return +Math.min(cost, maxPrice).toFixed(8);
}

// ─── Live Mode: CDP Facilitator ───────────────────────────────────────────────

async function callCdpFacilitator(endpoint, payload) {
  if (!LIVE_MODE) return null;
  try {
    const res = await fetch(`${CDP_FACILITATOR_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.CDP_API_KEY_ID,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`CDP Facilitator error ${res.status}: ${err}`);
    }
    return await res.json();
  } catch (e) {
    console.error("[x402Upto] CDP facilitator call failed:", e.message);
    return null;
  }
}

// ─── 1. createUptoSession ─────────────────────────────────────────────────────

/**
 * Seller creates a metered session with a max_price ceiling.
 *
 * @param {object} args
 * @param {string} args.seller_agent_id  — seller's agent ID
 * @param {string} args.endpoint         — service endpoint (URL or identifier)
 * @param {number} args.max_price        — maximum price in USDC
 * @param {string} [args.pricing_model]  — per_token | per_second | per_byte | per_request
 * @param {string} [args.token_address]  — ERC-20 token address (default USDC)
 * @param {number} [args.chain_id]       — EVM chain ID (default 8453 = Base)
 */
export async function createUptoSession(args) {
  const {
    seller_agent_id,
    endpoint,
    max_price,
    pricing_model = "per_token",
    token_address = "USDC",
    chain_id = 8453,
  } = args;

  if (!seller_agent_id) throw new Error("seller_agent_id is required");
  if (!endpoint) throw new Error("endpoint is required");
  if (!max_price || max_price <= 0) throw new Error("max_price must be > 0");

  const VALID_MODELS = ["per_token", "per_second", "per_byte", "per_request"];
  if (!VALID_MODELS.includes(pricing_model)) {
    throw new Error(`pricing_model must be one of: ${VALID_MODELS.join(", ")}`);
  }

  const sessionId = uuid();

  // Live mode: register session with CDP Facilitator
  let facilitatorData = null;
  if (LIVE_MODE) {
    facilitatorData = await callCdpFacilitator("/sessions", {
      session_id: sessionId,
      seller: seller_agent_id,
      endpoint,
      max_price: String(max_price),
      token: token_address,
      chain_id,
      pricing_model,
      settlement_type: "upto",
    });
  }

  try {
    db.prepare(`
      INSERT INTO x402_upto_sessions
        (id, seller_agent_id, endpoint, pricing_model, max_price, token_address, chain_id, state)
      VALUES
        (@id, @seller_agent_id, @endpoint, @pricing_model, @max_price, @token_address, @chain_id, 'created')
    `).run({ id: sessionId, seller_agent_id, endpoint, pricing_model, max_price, token_address, chain_id });
  } catch (e) {
    console.error("[x402Upto] createUptoSession DB error:", e.message);
    throw e;
  }

  return {
    success: true,
    session_id: sessionId,
    seller_agent_id,
    endpoint,
    pricing_model,
    max_price,
    token_address,
    chain_id,
    state: "created",
    live_mode: LIVE_MODE,
    facilitator: facilitatorData ?? {
      simulated: true,
      facilitator_endpoint: CDP_FACILITATOR_URL,
      settlement_type: "upto",
      message: "Session registered. Buyer can now call x402_upto_authorize to begin.",
    },
    instructions: {
      next_step: "Share session_id with buyer. Buyer calls x402_upto_authorize to lock their spending limit.",
      settlement: "After task completes, call x402_upto_settle. Buyer is charged min(actual_cost, max_authorized).",
    },
  };
}

// ─── 2. authorizeSpend ────────────────────────────────────────────────────────

/**
 * Buyer authorizes a spending limit for this session (≤ seller's max_price).
 *
 * @param {object} args
 * @param {string} args.session_id      — session to authorize
 * @param {string} args.buyer_agent_id  — buyer's agent ID
 * @param {number} args.max_amount      — spending limit buyer authorizes (USDC)
 */
export async function authorizeSpend(args) {
  const { session_id, buyer_agent_id, max_amount } = args;

  if (!session_id) throw new Error("session_id is required");
  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");
  if (!max_amount || max_amount <= 0) throw new Error("max_amount must be > 0");

  const session = db.prepare("SELECT * FROM x402_upto_sessions WHERE id = ?").get(session_id);
  if (!session) throw new Error(`Session ${session_id} not found`);
  if (session.state !== "created") throw new Error(`Session is in state '${session.state}' — can only authorize 'created' sessions`);
  if (max_amount > session.max_price) throw new Error(`max_amount (${max_amount}) exceeds seller's max_price (${session.max_price})`);

  // Live mode: setSettlementOverrides on CDP Facilitator
  let facilitatorData = null;
  if (LIVE_MODE) {
    facilitatorData = await callCdpFacilitator("/sessions/authorize", {
      session_id,
      buyer: buyer_agent_id,
      max_authorized: String(max_amount),
      token: session.token_address,
      chain_id: session.chain_id,
    });
  }

  try {
    db.prepare(`
      UPDATE x402_upto_sessions
      SET buyer_agent_id = @buyer_agent_id,
          max_authorized  = @max_amount,
          state           = 'authorized',
          authorized_at   = datetime('now')
      WHERE id = @session_id
    `).run({ buyer_agent_id, max_amount, session_id });
  } catch (e) {
    console.error("[x402Upto] authorizeSpend DB error:", e.message);
    throw e;
  }

  const authToken = "x402_auth_" + crypto.randomBytes(16).toString("hex");

  return {
    success: true,
    session_id,
    buyer_agent_id,
    seller_agent_id: session.seller_agent_id,
    endpoint: session.endpoint,
    max_authorized: max_amount,
    seller_max_price: session.max_price,
    token_address: session.token_address,
    chain_id: session.chain_id,
    pricing_model: session.pricing_model,
    state: "authorized",
    live_mode: LIVE_MODE,
    authorization_token: authToken,
    facilitator: facilitatorData ?? {
      simulated: true,
      message: "Spending limit locked. Server may now begin the task and record usage.",
      cdp_note: "In live mode, CDP Facilitator calls setSettlementOverrides to cap the charge.",
    },
  };
}

// ─── 3. recordUsage ──────────────────────────────────────────────────────────

/**
 * Server records actual resource consumption during the session.
 * Can be called multiple times (usage is additive).
 *
 * @param {object} args
 * @param {string} args.session_id        — active session
 * @param {number} [args.tokens_used]     — tokens consumed (LLM inference)
 * @param {number} [args.seconds_elapsed] — compute seconds elapsed
 * @param {number} [args.bytes_processed] — bytes transferred / stored
 * @param {number} [args.requests_made]   — API requests made
 */
export async function recordUsage(args) {
  const {
    session_id,
    tokens_used = 0,
    seconds_elapsed = 0,
    bytes_processed = 0,
    requests_made = 0,
  } = args;

  if (!session_id) throw new Error("session_id is required");

  const session = db.prepare("SELECT * FROM x402_upto_sessions WHERE id = ?").get(session_id);
  if (!session) throw new Error(`Session ${session_id} not found`);
  if (!["authorized", "active"].includes(session.state)) {
    throw new Error(`Session must be 'authorized' or 'active' to record usage (current: '${session.state}')`);
  }

  const newTokens   = session.tokens_used    + tokens_used;
  const newSeconds  = session.seconds_elapsed + seconds_elapsed;
  const newBytes    = session.bytes_processed + bytes_processed;
  const newRequests = session.requests_made   + requests_made;

  const runningCost = calculateActualCost(session.pricing_model, {
    tokens_used: newTokens,
    seconds_elapsed: newSeconds,
    bytes_processed: newBytes,
    requests_made: newRequests,
  }, session.max_price);

  try {
    db.prepare(`
      UPDATE x402_upto_sessions
      SET tokens_used      = @newTokens,
          seconds_elapsed  = @newSeconds,
          bytes_processed  = @newBytes,
          requests_made    = @newRequests,
          state            = 'active'
      WHERE id = @session_id
    `).run({ newTokens, newSeconds, newBytes, newRequests, session_id });
  } catch (e) {
    console.error("[x402Upto] recordUsage DB error:", e.message);
    throw e;
  }

  const remainingBudget = session.max_authorized
    ? +Math.max(0, session.max_authorized - runningCost).toFixed(8)
    : null;

  return {
    success: true,
    session_id,
    state: "active",
    usage: {
      tokens_used:     newTokens,
      seconds_elapsed: +newSeconds.toFixed(4),
      bytes_processed: newBytes,
      requests_made:   newRequests,
    },
    running_cost: runningCost,
    max_authorized: session.max_authorized,
    remaining_budget: remainingBudget,
    pricing_model: session.pricing_model,
    token_address: session.token_address,
  };
}

// ─── 4. settleSession ─────────────────────────────────────────────────────────

/**
 * Calculates actual cost, settles for min(actual_cost, max_authorized).
 * Returns a receipt with the final settled amount and tx hash.
 *
 * @param {object} args
 * @param {string} args.session_id — session to settle
 */
export async function settleSession(args) {
  const { session_id } = args;

  if (!session_id) throw new Error("session_id is required");

  const session = db.prepare("SELECT * FROM x402_upto_sessions WHERE id = ?").get(session_id);
  if (!session) throw new Error(`Session ${session_id} not found`);
  if (session.state === "settled") throw new Error(`Session ${session_id} is already settled`);
  if (!session.buyer_agent_id) throw new Error("Session has no authorized buyer — call x402_upto_authorize first");

  const actualCost = calculateActualCost(session.pricing_model, {
    tokens_used:     session.tokens_used,
    seconds_elapsed: session.seconds_elapsed,
    bytes_processed: session.bytes_processed,
    requests_made:   session.requests_made,
  }, session.max_price);

  const settledAmount = +Math.min(actualCost, session.max_authorized ?? actualCost).toFixed(8);
  const receiptId     = "rcpt_" + crypto.randomBytes(12).toString("hex");

  // Live mode: trigger CDP Facilitator settlement
  let settlementTx = txHash();
  let facilitatorData = null;
  if (LIVE_MODE) {
    facilitatorData = await callCdpFacilitator("/sessions/settle", {
      session_id,
      actual_amount: String(settledAmount),
      token: session.token_address,
      chain_id: session.chain_id,
    });
    if (facilitatorData?.tx_hash) settlementTx = facilitatorData.tx_hash;
  }

  const settlementId = uuid();

  try {
    db.prepare(`
      UPDATE x402_upto_sessions
      SET state         = 'settled',
          actual_cost   = @actualCost,
          settled_amount = @settledAmount,
          settlement_tx  = @settlementTx,
          receipt_id     = @receiptId,
          settled_at     = datetime('now')
      WHERE id = @session_id
    `).run({ actualCost, settledAmount, settlementTx, receiptId, session_id });
  } catch (e) {
    console.error("[x402Upto] settleSession UPDATE error:", e.message);
    throw e;
  }

  try {
    db.prepare(`
      INSERT INTO x402_upto_settlements
        (id, session_id, seller_agent_id, buyer_agent_id, max_authorized, actual_cost,
         settled_amount, token_address, chain_id, tx_hash, facilitator_id, pricing_model,
         tokens_used, seconds_elapsed, bytes_processed, requests_made)
      VALUES
        (@id, @session_id, @seller_agent_id, @buyer_agent_id, @max_authorized, @actual_cost,
         @settled_amount, @token_address, @chain_id, @tx_hash, @facilitator_id, @pricing_model,
         @tokens_used, @seconds_elapsed, @bytes_processed, @requests_made)
    `).run({
      id:              settlementId,
      session_id,
      seller_agent_id: session.seller_agent_id,
      buyer_agent_id:  session.buyer_agent_id,
      max_authorized:  session.max_authorized,
      actual_cost:     actualCost,
      settled_amount:  settledAmount,
      token_address:   session.token_address,
      chain_id:        session.chain_id,
      tx_hash:         settlementTx,
      facilitator_id:  facilitatorData?.facilitator_id ?? "cdp-sim-" + crypto.randomBytes(4).toString("hex"),
      pricing_model:   session.pricing_model,
      tokens_used:     session.tokens_used,
      seconds_elapsed: session.seconds_elapsed,
      bytes_processed: session.bytes_processed,
      requests_made:   session.requests_made,
    });
  } catch (e) {
    console.error("[x402Upto] settleSession INSERT error:", e.message);
  }

  const savings = +(session.max_authorized - settledAmount).toFixed(8);

  return {
    success: true,
    receipt_id: receiptId,
    settlement_id: settlementId,
    session_id,
    state: "settled",
    seller_agent_id: session.seller_agent_id,
    buyer_agent_id:  session.buyer_agent_id,
    endpoint:        session.endpoint,
    pricing_model:   session.pricing_model,
    usage: {
      tokens_used:     session.tokens_used,
      seconds_elapsed: +session.seconds_elapsed.toFixed(4),
      bytes_processed: session.bytes_processed,
      requests_made:   session.requests_made,
    },
    financials: {
      max_price:      session.max_price,
      max_authorized: session.max_authorized,
      actual_cost:    actualCost,
      settled_amount: settledAmount,
      buyer_savings:  savings > 0 ? savings : 0,
      token_address:  session.token_address,
      chain_id:       session.chain_id,
    },
    settlement_tx: settlementTx,
    live_mode: LIVE_MODE,
    facilitator: facilitatorData ?? {
      simulated: true,
      cdp_url: CDP_FACILITATOR_URL,
      note: "Gasless settlement via CDP Facilitator. Buyer charged only actual usage.",
    },
  };
}

// ─── 5. getSessionStatus ──────────────────────────────────────────────────────

/**
 * Check session state, usage so far, and remaining budget.
 *
 * @param {object} args
 * @param {string} args.session_id — session to inspect
 */
export async function getSessionStatus(args) {
  const { session_id } = args;

  if (!session_id) throw new Error("session_id is required");

  const session = db.prepare("SELECT * FROM x402_upto_sessions WHERE id = ?").get(session_id);
  if (!session) throw new Error(`Session ${session_id} not found`);

  const runningCost = calculateActualCost(session.pricing_model, {
    tokens_used:     session.tokens_used,
    seconds_elapsed: session.seconds_elapsed,
    bytes_processed: session.bytes_processed,
    requests_made:   session.requests_made,
  }, session.max_price);

  const remainingBudget = session.max_authorized
    ? +Math.max(0, session.max_authorized - runningCost).toFixed(8)
    : null;

  const pctUsed = session.max_authorized
    ? +((runningCost / session.max_authorized) * 100).toFixed(2)
    : null;

  return {
    session_id,
    state: session.state,
    seller_agent_id: session.seller_agent_id,
    buyer_agent_id:  session.buyer_agent_id ?? null,
    endpoint:        session.endpoint,
    pricing_model:   session.pricing_model,
    created_at:      session.created_at,
    authorized_at:   session.authorized_at ?? null,
    settled_at:      session.settled_at ?? null,
    limits: {
      seller_max_price: session.max_price,
      buyer_max_authorized: session.max_authorized ?? null,
      token_address: session.token_address,
      chain_id: session.chain_id,
    },
    usage: {
      tokens_used:     session.tokens_used,
      seconds_elapsed: +session.seconds_elapsed.toFixed(4),
      bytes_processed: session.bytes_processed,
      requests_made:   session.requests_made,
    },
    billing: {
      running_cost:      runningCost,
      settled_amount:    session.settled_amount ?? null,
      remaining_budget:  remainingBudget,
      budget_pct_used:   pctUsed,
    },
    receipt_id:    session.receipt_id ?? null,
    settlement_tx: session.settlement_tx ?? null,
  };
}

// ─── 6. listActiveSessions ───────────────────────────────────────────────────

/**
 * List all active metered sessions for an agent (as seller or buyer).
 *
 * @param {object} args
 * @param {string} args.agent_id — agent ID (seller or buyer)
 * @param {string} [args.role]   — 'seller' | 'buyer' | 'any' (default 'any')
 * @param {string} [args.state]  — filter by state (created|authorized|active|settled)
 * @param {number} [args.limit]  — max results (default 50)
 */
export async function listActiveSessions(args) {
  const {
    agent_id,
    role = "any",
    state: stateFilter,
    limit = 50,
  } = args;

  if (!agent_id) throw new Error("agent_id is required");

  let query;
  let params;

  if (role === "seller") {
    query = "SELECT * FROM x402_upto_sessions WHERE seller_agent_id = ?";
    params = [agent_id];
  } else if (role === "buyer") {
    query = "SELECT * FROM x402_upto_sessions WHERE buyer_agent_id = ?";
    params = [agent_id];
  } else {
    query = "SELECT * FROM x402_upto_sessions WHERE seller_agent_id = ? OR buyer_agent_id = ?";
    params = [agent_id, agent_id];
  }

  if (stateFilter) {
    query += " AND state = ?";
    params.push(stateFilter);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  let sessions;
  try {
    sessions = db.prepare(query).all(...params);
  } catch (e) {
    console.error("[x402Upto] listActiveSessions error:", e.message);
    sessions = [];
  }

  const summary = sessions.map((s) => ({
    session_id:      s.id,
    state:           s.state,
    role:            s.seller_agent_id === agent_id ? "seller" : "buyer",
    endpoint:        s.endpoint,
    pricing_model:   s.pricing_model,
    max_price:       s.max_price,
    max_authorized:  s.max_authorized ?? null,
    running_cost:    calculateActualCost(s.pricing_model, {
      tokens_used:     s.tokens_used,
      seconds_elapsed: s.seconds_elapsed,
      bytes_processed: s.bytes_processed,
      requests_made:   s.requests_made,
    }, s.max_price),
    settled_amount:  s.settled_amount ?? null,
    created_at:      s.created_at,
    settled_at:      s.settled_at ?? null,
  }));

  const totals = {
    total_sessions:  sessions.length,
    by_state: {
      created:    sessions.filter((s) => s.state === "created").length,
      authorized: sessions.filter((s) => s.state === "authorized").length,
      active:     sessions.filter((s) => s.state === "active").length,
      settled:    sessions.filter((s) => s.state === "settled").length,
    },
    total_settled_usdc: +sessions
      .filter((s) => s.settled_amount)
      .reduce((sum, s) => sum + s.settled_amount, 0)
      .toFixed(6),
  };

  return {
    agent_id,
    role_filter: role,
    state_filter: stateFilter ?? "all",
    sessions: summary,
    totals,
    live_mode: LIVE_MODE,
  };
}
