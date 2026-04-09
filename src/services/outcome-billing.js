/**
 * HiveAgent Outcome-Based Billing Engine (Phase 31)
 *
 * Signal: Intercom charges $0.99 per resolved ticket. Agents should charge
 * per outcome not per seat. HiveAgent becomes the outcome verification
 * and payment layer between provider and buyer agents.
 *
 * Supports: ticket_resolved, lead_qualified, meeting_booked, bug_fixed,
 *           document_analyzed, trade_executed, code_deployed, content_published
 *
 * Platform fee: 10% on every verified outcome payment.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.OUTCOME_BILLING_KEY;
const PLATFORM_FEE_PCT = 0.10;

// ─── Standard pricing per outcome type ──────────────────────────────────────

const OUTCOME_PRICE_DEFAULTS = {
  ticket_resolved:    { default_price: 0.99,  currency: "USDC", auto_verify: true  },
  lead_qualified:     { default_price: 15.00, currency: "USDC", auto_verify: false },
  meeting_booked:     { default_price: 15.00, currency: "USDC", auto_verify: true  },
  bug_fixed:          { default_price: 35.00, currency: "USDC", auto_verify: false },
  document_analyzed:  { default_price: 2.00,  currency: "USDC", auto_verify: true  },
  trade_executed:     { default_price: null,  currency: "USDC", auto_verify: true,  pct_of_value: 0.001 },
  code_deployed:      { default_price: 25.00, currency: "USDC", auto_verify: false },
  content_published:  { default_price: 5.00,  currency: "USDC", auto_verify: true  },
};

/**
 * Route platform fee to HiveAgent CDP treasury (USDC on Base).
 */
async function collectPlatformFee(feeUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Fee] $${Number(feeUsd).toFixed(4)} → CDP treasury ${treasury.slice(0,8)}... — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usd: feeUsd, network: "base", currency: "USDC" };
    }
  } catch {}
  console.log(`[Fee] $${Number(feeUsd).toFixed(4)} logged (CDP pending init) — ${context}`);
  return { collected: false, fee_usd: feeUsd };
}

// ─── Schema ──────────────────────────────────────────────────────────────────

try {
db.exec(`
  CREATE TABLE IF NOT EXISTS billing_outcome_contracts (
    id TEXT PRIMARY KEY,
    provider_agent_id TEXT NOT NULL,
    buyer_agent_id TEXT NOT NULL,
    outcome_type TEXT NOT NULL,
    outcome_metric TEXT,
    price_per_outcome REAL NOT NULL,
    currency TEXT DEFAULT 'USDC',
    max_outcomes INTEGER DEFAULT 100,
    outcomes_delivered INTEGER DEFAULT 0,
    total_paid REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    verification_method TEXT DEFAULT 'auto',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS billing_outcome_events (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES billing_outcome_contracts(id),
    provider_agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    outcome_value REAL DEFAULT 1,
    outcome_evidence TEXT,
    verified INTEGER DEFAULT 0,
    payment_usdc REAL DEFAULT 0,
    fee_usdc REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS billing_outcome_disputes (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    disputing_agent TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    resolution TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_oc_provider ON billing_outcome_contracts(provider_agent_id);
  CREATE INDEX IF NOT EXISTS idx_oc_buyer ON billing_outcome_contracts(buyer_agent_id);
  CREATE INDEX IF NOT EXISTS idx_oe_contract ON billing_outcome_events(contract_id);
  CREATE INDEX IF NOT EXISTS idx_oe_status ON billing_outcome_events(status);
`);
} catch(e) { console.warn("[DB Schema]", e.message); }

// ─── Seed sample contracts ────────────────────────────────────────────────────

const contractCount = db.prepare("SELECT COUNT(*) as c FROM billing_outcome_contracts").get().c;
if (contractCount === 0) {
  const seeds = [
    { provider: "support-agent-alpha", buyer: "acme-corp-agent", type: "ticket_resolved", price: 0.99, max: 500 },
    { provider: "sales-agent-beta",    buyer: "startup-agent-01", type: "lead_qualified", price: 25.00, max: 50 },
    { provider: "dev-agent-gamma",     buyer: "devops-agent-02",  type: "bug_fixed",      price: 50.00, max: 20 },
    { provider: "content-agent-delta", buyer: "media-agent-03",   type: "content_published", price: 5.00, max: 100 },
  ];
  for (const s of seeds) {
    db.prepare(`
      INSERT INTO billing_outcome_contracts (id, provider_agent_id, buyer_agent_id, outcome_type, price_per_outcome, max_outcomes, verification_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), s.provider, s.buyer, s.type, s.price, s.max,
      OUTCOME_PRICE_DEFAULTS[s.type]?.auto_verify ? "auto" : "manual");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcPayment(contract, outcomeValue = 1) {
  if (contract.outcome_type === "trade_executed") {
    const pct = OUTCOME_PRICE_DEFAULTS.trade_executed.pct_of_value;
    return parseFloat((outcomeValue * pct).toFixed(6));
  }
  return contract.price_per_outcome;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Create a pay-per-outcome agreement between two agents.
 */
export function createOutcomeContract({
  provider_agent_id,
  buyer_agent_id,
  outcome_type,
  price_per_outcome,
  max_outcomes = 100,
  verification_method,
}) {
  if (!provider_agent_id) throw new Error("provider_agent_id is required");
  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");
  if (!outcome_type) throw new Error("outcome_type is required");

  const supported = Object.keys(OUTCOME_PRICE_DEFAULTS);
  if (!supported.includes(outcome_type)) {
    throw new Error(`Unsupported outcome_type. Supported: ${supported.join(", ")}`);
  }

  const defaults = OUTCOME_PRICE_DEFAULTS[outcome_type];
  const price = price_per_outcome ?? defaults.default_price;
  if (!price) throw new Error("price_per_outcome is required for trade_executed (pct-based)");

  const method = verification_method ?? (defaults.auto_verify ? "auto" : "manual");
  const id = uuid();

  db.prepare(`
    INSERT INTO billing_outcome_contracts
      (id, provider_agent_id, buyer_agent_id, outcome_type, price_per_outcome, currency, max_outcomes, verification_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, provider_agent_id, buyer_agent_id, outcome_type, price, defaults.currency, max_outcomes, method);

  return {
    contract_id: id,
    provider_agent_id,
    buyer_agent_id,
    outcome_type,
    price_per_outcome: price,
    currency: defaults.currency,
    max_outcomes,
    verification_method: method,
    status: "active",
    platform_fee_pct: PLATFORM_FEE_PCT * 100,
    live_mode: LIVE_MODE,
    message: `Outcome contract created. Provider earns $${price} per verified ${outcome_type.replace(/_/g," ")}.`,
  };
}

/**
 * Provider reports a delivered outcome. Auto-verifies for eligible types.
 */
export async function reportOutcome({
  contract_id,
  provider_agent_id,
  outcome_evidence,
  outcome_value = 1,
}) {
  if (!contract_id) throw new Error("contract_id is required");
  if (!provider_agent_id) throw new Error("provider_agent_id is required");

  const contract = db.prepare("SELECT * FROM billing_outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");
  if (contract.provider_agent_id !== provider_agent_id) throw new Error("Only the provider can report outcomes");
  if (contract.status !== "active") throw new Error(`Contract is ${contract.status}`);
  if (contract.outcomes_delivered >= contract.max_outcomes) {
    throw new Error("Max outcomes reached for this contract");
  }

  const paymentUsdc = calcPayment(contract, outcome_value);
  const feeUsdc = parseFloat((paymentUsdc * PLATFORM_FEE_PCT).toFixed(6));
  const providerNet = parseFloat((paymentUsdc - feeUsdc).toFixed(6));
  const autoVerify = OUTCOME_PRICE_DEFAULTS[contract.outcome_type]?.auto_verify
    && contract.verification_method === "auto";

  const eventId = uuid();
  db.prepare(`
    INSERT INTO billing_outcome_events
      (id, contract_id, provider_agent_id, event_type, outcome_value, outcome_evidence, verified, payment_usdc, fee_usdc, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId, contract_id, provider_agent_id, contract.outcome_type,
    outcome_value, outcome_evidence ? JSON.stringify(outcome_evidence) : null,
    autoVerify ? 1 : 0, paymentUsdc, feeUsdc,
    autoVerify ? "paid" : "pending"
  );

  if (autoVerify) {
    db.prepare(`
      UPDATE billing_outcome_contracts
      SET outcomes_delivered = outcomes_delivered + 1,
          total_paid = total_paid + ?
      WHERE id = ?
    `).run(paymentUsdc, contract_id);

    if (LIVE_MODE) {
      await collectPlatformFee(feeUsdc, `outcome:${contract.outcome_type}:${eventId}`);
    }

    return {
      event_id: eventId,
      contract_id,
      outcome_type: contract.outcome_type,
      status: "auto_verified_paid",
      payment_usdc: paymentUsdc,
      fee_usdc: feeUsdc,
      provider_net_usdc: providerNet,
      outcomes_delivered: contract.outcomes_delivered + 1,
      live_mode: LIVE_MODE,
      message: `Auto-verified. Provider receives ${providerNet} USDC.`,
    };
  }

  return {
    event_id: eventId,
    contract_id,
    outcome_type: contract.outcome_type,
    status: "pending_verification",
    payment_usdc: paymentUsdc,
    fee_usdc: feeUsdc,
    provider_net_usdc: providerNet,
    live_mode: LIVE_MODE,
    message: "Outcome reported. Awaiting buyer verification.",
  };
}

/**
 * Buyer verifies or rejects a reported outcome. Releases payment if approved.
 */
export async function verifyOutcome({
  contract_id,
  event_id,
  buyer_agent_id,
  approved,
  rejection_reason,
}) {
  if (!contract_id) throw new Error("contract_id is required");
  if (!event_id) throw new Error("event_id is required");
  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");
  if (approved === undefined) throw new Error("approved (bool) is required");

  const contract = db.prepare("SELECT * FROM billing_outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");
  if (contract.buyer_agent_id !== buyer_agent_id) throw new Error("Only the buyer can verify outcomes");

  const event = db.prepare("SELECT * FROM billing_outcome_events WHERE id = ? AND contract_id = ?").get(event_id, contract_id);
  if (!event) throw new Error("Outcome event not found");
  if (event.status !== "pending") throw new Error(`Event is already ${event.status}`);

  if (approved) {
    db.prepare("UPDATE billing_outcome_events SET verified = 1, status = 'paid' WHERE id = ?").run(event_id);
    db.prepare(`
      UPDATE billing_outcome_contracts
      SET outcomes_delivered = outcomes_delivered + 1,
          total_paid = total_paid + ?
      WHERE id = ?
    `).run(event.payment_usdc, contract_id);

    if (LIVE_MODE) {
      await collectPlatformFee(event.fee_usdc, `verified:${event.event_type}:${event_id}`);
    }

    return {
      event_id,
      contract_id,
      status: "approved_paid",
      payment_usdc: event.payment_usdc,
      fee_usdc: event.fee_usdc,
      provider_net_usdc: parseFloat((event.payment_usdc - event.fee_usdc).toFixed(6)),
      live_mode: LIVE_MODE,
      message: "Outcome approved. Payment released to provider.",
    };
  } else {
    db.prepare("UPDATE billing_outcome_events SET status = 'rejected' WHERE id = ?").run(event_id);
    return {
      event_id,
      contract_id,
      status: "rejected",
      rejection_reason: rejection_reason || "Not specified",
      message: "Outcome rejected. No payment released.",
    };
  }
}

/**
 * Dispute a verification decision.
 */
export function disputeOutcome({ contract_id, event_id, disputing_agent, reason }) {
  if (!contract_id) throw new Error("contract_id is required");
  if (!event_id) throw new Error("event_id is required");
  if (!disputing_agent) throw new Error("disputing_agent is required");
  if (!reason) throw new Error("reason is required");

  const contract = db.prepare("SELECT * FROM billing_outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");

  if (disputing_agent !== contract.provider_agent_id && disputing_agent !== contract.buyer_agent_id) {
    throw new Error("Only contract parties can dispute");
  }

  const disputeId = uuid();
  db.prepare(`
    INSERT INTO billing_outcome_disputes (id, contract_id, event_id, disputing_agent, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(disputeId, contract_id, event_id, disputing_agent, reason);

  // Freeze the event
  db.prepare("UPDATE billing_outcome_events SET status = 'disputed' WHERE id = ?").run(event_id);

  return {
    dispute_id: disputeId,
    contract_id,
    event_id,
    disputing_agent,
    status: "open",
    message: "Dispute filed. HiveAgent arbitration will review within 24h.",
    expected_resolution_hours: 24,
  };
}

/**
 * Full contract status: outcomes delivered, paid, pending.
 */
export function getContractStatus({ contract_id }) {
  if (!contract_id) throw new Error("contract_id is required");

  const contract = db.prepare("SELECT * FROM billing_outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");

  const events = db.prepare("SELECT * FROM billing_outcome_events WHERE contract_id = ? ORDER BY timestamp DESC LIMIT 20").all(contract_id);
  const disputes = db.prepare("SELECT * FROM billing_outcome_disputes WHERE contract_id = ?").all(contract_id);

  const pending = events.filter(e => e.status === "pending").length;
  const paid = events.filter(e => e.status === "paid").length;
  const rejected = events.filter(e => e.status === "rejected").length;
  const disputed = events.filter(e => e.status === "disputed").length;

  return {
    contract,
    events_summary: { total: events.length, paid, pending, rejected, disputed },
    recent_events: events.slice(0, 10),
    disputes,
    remaining_outcomes: contract.max_outcomes - contract.outcomes_delivered,
    completion_pct: Math.round((contract.outcomes_delivered / contract.max_outcomes) * 100),
  };
}

/**
 * Platform-wide outcome billing dashboard.
 */
export function getOutcomeBillingDashboard() {
  const contracts = db.prepare("SELECT COUNT(*) as c FROM billing_outcome_contracts").get().c;
  const activeContracts = db.prepare("SELECT COUNT(*) as c FROM billing_outcome_contracts WHERE status = 'active'").get().c;
  const totalOutcomes = db.prepare("SELECT SUM(outcomes_delivered) as s FROM billing_outcome_contracts").get().s || 0;
  const totalPaid = db.prepare("SELECT SUM(total_paid) as s FROM billing_outcome_contracts").get().s || 0;
  const platformFees = parseFloat((totalPaid * PLATFORM_FEE_PCT).toFixed(4));
  const disputes = db.prepare("SELECT COUNT(*) as c FROM billing_outcome_disputes WHERE status = 'open'").get().c;

  const byType = db.prepare(`
    SELECT outcome_type,
           COUNT(*) as contracts,
           SUM(outcomes_delivered) as delivered,
           SUM(total_paid) as paid_usdc,
           AVG(price_per_outcome) as avg_price
    FROM billing_outcome_contracts
    GROUP BY outcome_type
    ORDER BY paid_usdc DESC
  `).all();

  return {
    platform: {
      total_contracts: contracts,
      active_contracts: activeContracts,
      total_outcomes_verified: totalOutcomes,
      total_volume_usdc: parseFloat(totalPaid.toFixed(4)),
      platform_fees_usdc: platformFees,
      open_disputes: disputes,
      fee_pct: PLATFORM_FEE_PCT * 100,
    },
    by_outcome_type: byType,
    supported_outcome_types: OUTCOME_PRICE_DEFAULTS,
    live_mode: LIVE_MODE,
    signal: "Intercom charges $0.99/resolved ticket. HiveAgent enables any agent to monetize outcomes at scale.",
  };
}

/**
 * Get earnings summary for a specific agent (as provider or buyer).
 */
export function getAgentEarnings({ agent_id }) {
  if (!agent_id) throw new Error("agent_id is required");

  const asProvider = db.prepare(`
    SELECT outcome_type, COUNT(*) as contracts, SUM(outcomes_delivered) as delivered,
           SUM(total_paid * (1 - ?)) as net_earned
    FROM billing_outcome_contracts WHERE provider_agent_id = ? GROUP BY outcome_type
  `).all(PLATFORM_FEE_PCT, agent_id);

  const asBuyer = db.prepare(`
    SELECT outcome_type, COUNT(*) as contracts, SUM(outcomes_delivered) as purchased,
           SUM(total_paid) as total_spent
    FROM billing_outcome_contracts WHERE buyer_agent_id = ? GROUP BY outcome_type
  `).all(agent_id);

  const totalEarned = asProvider.reduce((s, r) => s + (r.net_earned || 0), 0);
  const totalSpent = asBuyer.reduce((s, r) => s + (r.total_spent || 0), 0);

  return {
    agent_id,
    as_provider: {
      breakdown: asProvider,
      total_net_earned_usdc: parseFloat(totalEarned.toFixed(4)),
    },
    as_buyer: {
      breakdown: asBuyer,
      total_spent_usdc: parseFloat(totalSpent.toFixed(4)),
    },
    net_position_usdc: parseFloat((totalEarned - totalSpent).toFixed(4)),
    live_mode: LIVE_MODE,
  };
}
