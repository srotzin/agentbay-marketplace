/**
 * HiveAgent Settlement & Reconciliation Engine
 *
 * Handles agent-to-agent transactions:
 * - Agent A hires Agent B through HiveAgent
 * - Funds lock in escrow
 * - Agent B delivers
 * - Settlement: Agent B gets 85%, HiveAgent takes 15%
 * - Full audit trail for both agents
 *
 * Also handles multi-hop chains:
 * Agent A → hires Agent B → who subcontracts Agent C
 * HiveAgent takes 15% on EACH hop
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";
import { recordEscrowLock, recordEscrowRelease, recordEscrowRefund } from "./onchain-settlement.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS escrow (
    id TEXT PRIMARY KEY,
    buyer_agent_id TEXT NOT NULL,
    seller_agent_id TEXT,
    seller_provider_id TEXT,
    service_id TEXT,
    auction_id TEXT,
    amount_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    seller_payout_usd REAL NOT NULL,
    status TEXT DEFAULT 'locked',        -- 'locked', 'released', 'refunded', 'disputed', 'expired'
    deliverable_hash TEXT,               -- SHA256 of delivered work
    deliverable_uri TEXT,                -- Link to deliverable
    dispute_reason TEXT,
    resolution_note TEXT,
    locked_at TEXT DEFAULT (datetime('now')),
    deadline TEXT,                        -- Auto-refund after this
    released_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settlement_ledger (
    id TEXT PRIMARY KEY,
    escrow_id TEXT REFERENCES escrow(id),
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    fee_usd REAL NOT NULL,               -- HiveAgent commission
    net_amount_usd REAL NOT NULL,
    type TEXT NOT NULL,                   -- 'payment', 'refund', 'commission', 'subcontract'
    chain_depth INTEGER DEFAULT 0,       -- 0 = direct, 1+ = subcontract hops
    parent_settlement_id TEXT,           -- For tracking chains
    tx_hash TEXT,                         -- On-chain reference
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_balances (
    agent_id TEXT PRIMARY KEY,
    available_usd REAL DEFAULT 0,
    locked_usd REAL DEFAULT 0,
    total_earned_usd REAL DEFAULT 0,
    total_spent_usd REAL DEFAULT 0,
    total_fees_paid_usd REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_escrow_buyer ON escrow(buyer_agent_id);
  CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow(seller_agent_id);
  CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow(status);
  CREATE INDEX IF NOT EXISTS idx_ledger_from ON settlement_ledger(from_agent);
  CREATE INDEX IF NOT EXISTS idx_ledger_to ON settlement_ledger(to_agent);
`);

const COMMISSION_RATE = 0.15;

// ─── Agent Balance Management ────────────────────

function ensureAgent(agentId) {
  const exists = db.prepare("SELECT agent_id FROM agent_balances WHERE agent_id = ?").get(agentId);
  if (!exists) {
    db.prepare("INSERT INTO agent_balances (agent_id) VALUES (?)").run(agentId);
  }
}

export function getAgentBalance(agentId) {
  ensureAgent(agentId);
  return db.prepare("SELECT * FROM agent_balances WHERE agent_id = ?").get(agentId);
}

// ─── Escrow Operations ──────────────────────────

/**
 * Lock funds in escrow for an agent-to-agent transaction
 */
export async function lockEscrow({ buyer_agent_id, seller_agent_id, seller_provider_id, service_id, auction_id, amount_usd, deadline_minutes = 1440 }) {
  const commission = Math.round(amount_usd * COMMISSION_RATE * 100) / 100;
  const payout = Math.round((amount_usd - commission) * 100) / 100;
  const deadline = new Date(Date.now() + deadline_minutes * 60000).toISOString();
  const id = uuid();

  ensureAgent(buyer_agent_id);
  if (seller_agent_id) ensureAgent(seller_agent_id);

  db.prepare(`
    INSERT INTO escrow (id, buyer_agent_id, seller_agent_id, seller_provider_id, service_id, auction_id, amount_usd, commission_usd, seller_payout_usd, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, buyer_agent_id, seller_agent_id || null, seller_provider_id || null, service_id || null, auction_id || null, amount_usd, commission, payout, deadline);

  // Update buyer balance
  db.prepare(`
    UPDATE agent_balances SET locked_usd = locked_usd + ?, total_spent_usd = total_spent_usd + ?, updated_at = datetime('now')
    WHERE agent_id = ?
  `).run(amount_usd, amount_usd, buyer_agent_id);

  // Record on-chain
  let onchain = null;
  try { onchain = await recordEscrowLock(id, buyer_agent_id, amount_usd); } catch {}

  return { escrow_id: id, amount_usd, commission_usd: commission, seller_payout_usd: payout, deadline, status: "locked", onchain };
}

/**
 * Release escrow — seller delivered, buyer approves
 */
export async function releaseEscrow(escrowId, { deliverable_hash, deliverable_uri } = {}) {
  const escrow = db.prepare("SELECT * FROM escrow WHERE id = ?").get(escrowId);
  if (!escrow) throw new Error("Escrow not found");
  if (escrow.status !== "locked") throw new Error(`Escrow is ${escrow.status}, not locked`);

  const sellerAgent = escrow.seller_agent_id || escrow.seller_provider_id;

  db.prepare(`
    UPDATE escrow SET status = 'released', deliverable_hash = ?, deliverable_uri = ?, released_at = datetime('now')
    WHERE id = ?
  `).run(deliverable_hash || null, deliverable_uri || null, escrowId);

  // Record settlement
  const settlementId = uuid();
  db.prepare(`
    INSERT INTO settlement_ledger (id, escrow_id, from_agent, to_agent, amount_usd, fee_usd, net_amount_usd, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'payment')
  `).run(settlementId, escrowId, escrow.buyer_agent_id, sellerAgent, escrow.amount_usd, escrow.commission_usd, escrow.seller_payout_usd);

  // Update balances
  db.prepare(`UPDATE agent_balances SET locked_usd = MAX(0, locked_usd - ?), updated_at = datetime('now') WHERE agent_id = ?`)
    .run(escrow.amount_usd, escrow.buyer_agent_id);

  if (escrow.seller_agent_id) {
    db.prepare(`
      UPDATE agent_balances SET available_usd = available_usd + ?, total_earned_usd = total_earned_usd + ?,
      transaction_count = transaction_count + 1, updated_at = datetime('now') WHERE agent_id = ?
    `).run(escrow.seller_payout_usd, escrow.seller_payout_usd, escrow.seller_agent_id);
  }

  // Record on-chain
  let onchain = null;
  try { onchain = await recordEscrowRelease(escrowId, sellerAgent, escrow.amount_usd, escrow.commission_usd); } catch {}

  return { escrow_id: escrowId, status: "released", settlement_id: settlementId, seller_payout_usd: escrow.seller_payout_usd, commission_usd: escrow.commission_usd, onchain };
}

/**
 * Refund escrow — deadline passed or dispute resolved for buyer
 */
export async function refundEscrow(escrowId, reason = "deadline_expired") {
  const escrow = db.prepare("SELECT * FROM escrow WHERE id = ?").get(escrowId);
  if (!escrow) throw new Error("Escrow not found");
  if (escrow.status !== "locked" && escrow.status !== "disputed") throw new Error(`Cannot refund: escrow is ${escrow.status}`);

  db.prepare("UPDATE escrow SET status = 'refunded', resolution_note = ? WHERE id = ?").run(reason, escrowId);

  const settlementId = uuid();
  db.prepare(`
    INSERT INTO settlement_ledger (id, escrow_id, from_agent, to_agent, amount_usd, fee_usd, net_amount_usd, type)
    VALUES (?, ?, ?, ?, ?, 0, ?, 'refund')
  `).run(settlementId, escrowId, "escrow", escrow.buyer_agent_id, escrow.amount_usd, escrow.amount_usd);

  db.prepare("UPDATE agent_balances SET locked_usd = MAX(0, locked_usd - ?), updated_at = datetime('now') WHERE agent_id = ?")
    .run(escrow.amount_usd, escrow.buyer_agent_id);

  // Record on-chain
  let onchain = null;
  try { onchain = await recordEscrowRefund(escrowId, escrow.buyer_agent_id, escrow.amount_usd); } catch {}

  return { escrow_id: escrowId, status: "refunded", refund_usd: escrow.amount_usd, reason, onchain };
}

/**
 * Dispute an escrow
 */
export function disputeEscrow(escrowId, reason) {
  const escrow = db.prepare("SELECT * FROM escrow WHERE id = ?").get(escrowId);
  if (!escrow) throw new Error("Escrow not found");
  if (escrow.status !== "locked") throw new Error(`Cannot dispute: escrow is ${escrow.status}`);

  db.prepare("UPDATE escrow SET status = 'disputed', dispute_reason = ? WHERE id = ?").run(reason, escrowId);
  return { escrow_id: escrowId, status: "disputed", reason };
}

/**
 * Agent-to-agent subcontract — Agent B hires Agent C through HiveAgent
 * Creates a new escrow, links to parent via settlement chain
 */
export function subcontract({ parent_escrow_id, contractor_agent_id, subcontractor_agent_id, amount_usd, description, deadline_minutes = 720 }) {
  const parent = db.prepare("SELECT * FROM escrow WHERE id = ?").get(parent_escrow_id);
  if (!parent) throw new Error("Parent escrow not found");
  if (amount_usd > parent.seller_payout_usd) throw new Error("Subcontract amount exceeds parent payout");

  const sub = lockEscrow({
    buyer_agent_id: contractor_agent_id,
    seller_agent_id: subcontractor_agent_id,
    amount_usd,
    deadline_minutes,
  });

  // Record the chain link
  const chainId = uuid();
  db.prepare(`
    INSERT INTO settlement_ledger (id, escrow_id, from_agent, to_agent, amount_usd, fee_usd, net_amount_usd, type, chain_depth, parent_settlement_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'subcontract', 1, ?)
  `).run(chainId, sub.escrow_id, contractor_agent_id, subcontractor_agent_id, amount_usd, sub.commission_usd, sub.seller_payout_usd, parent_escrow_id);

  return { ...sub, parent_escrow_id, chain_type: "subcontract" };
}

// ─── Settlement Queries ──────────────────────────

/**
 * Get full transaction history for an agent
 */
export function getAgentLedger(agentId, limit = 50) {
  return db.prepare(`
    SELECT * FROM settlement_ledger
    WHERE from_agent = ? OR to_agent = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(agentId, agentId, limit);
}

/**
 * Get escrow details
 */
export function getEscrow(escrowId) {
  return db.prepare("SELECT * FROM escrow WHERE id = ?").get(escrowId);
}

/**
 * Get all active escrows for an agent
 */
export function getActiveEscrows(agentId) {
  return db.prepare(`
    SELECT * FROM escrow WHERE (buyer_agent_id = ? OR seller_agent_id = ?) AND status = 'locked'
    ORDER BY created_at DESC
  `).all(agentId, agentId);
}

/**
 * Auto-expire overdue escrows (call on a schedule)
 */
export function expireOverdueEscrows() {
  const overdue = db.prepare(`
    SELECT id FROM escrow WHERE status = 'locked' AND deadline < datetime('now')
  `).all();

  const results = [];
  for (const { id } of overdue) {
    try {
      results.push(refundEscrow(id, "deadline_expired"));
    } catch {}
  }
  return { expired: results.length, escrows: results };
}

/**
 * Platform revenue summary
 */
export function getSettlementStats() {
  const totalCommission = db.prepare("SELECT COALESCE(SUM(commission_usd), 0) as total FROM escrow WHERE status = 'released'").get().total;
  const totalVolume = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM escrow WHERE status IN ('released', 'locked')").get().total;
  const activeEscrows = db.prepare("SELECT COUNT(*) as count FROM escrow WHERE status = 'locked'").get().count;
  const totalSettlements = db.prepare("SELECT COUNT(*) as count FROM settlement_ledger").get().count;
  const uniqueAgents = db.prepare("SELECT COUNT(*) as count FROM agent_balances WHERE transaction_count > 0").get().count;
  const subcontracts = db.prepare("SELECT COUNT(*) as count FROM settlement_ledger WHERE type = 'subcontract'").get().count;

  return {
    total_commission_usd: totalCommission,
    total_volume_usd: totalVolume,
    active_escrows: activeEscrows,
    total_settlements: totalSettlements,
    unique_agents: uniqueAgents,
    subcontract_chains: subcontracts,
  };
}
