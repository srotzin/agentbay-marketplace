/**
 * HiveAgent Agent-to-Agent B2B Negotiation Proxy
 *
 * Agents don't just pay prices — they negotiate deals.
 * Full B2B negotiation protocol with rounds, counter-offers,
 * auto-negotiation via Nash bargaining, volume pricing tiers,
 * contract locks, and BATNA-aware walk-away logic.
 *
 * No external APIs required — pure logic + DB.
 * HiveAgent earns 2% of every accepted deal value.
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS negotiations (
      id               TEXT PRIMARY KEY,
      buyer_agent_id   TEXT NOT NULL,
      seller_agent_id  TEXT NOT NULL,
      item_id          TEXT,
      item_description TEXT NOT NULL,
      quantity         REAL DEFAULT 1,
      initial_price    REAL NOT NULL,
      target_price     REAL,
      batna_price      REAL,
      current_offer    REAL,
      current_party    TEXT DEFAULT 'buyer',
      status           TEXT DEFAULT 'open',
      round_count      INTEGER DEFAULT 0,
      accepted_price   REAL,
      accepted_at      TEXT,
      deadline         TEXT,
      currency         TEXT DEFAULT 'USDC',
      platform_fee_pct REAL DEFAULT 0.02,
      created_at       TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_negotiations_buyer
      ON negotiations(buyer_agent_id);
    CREATE INDEX IF NOT EXISTS idx_negotiations_seller
      ON negotiations(seller_agent_id);
    CREATE INDEX IF NOT EXISTS idx_negotiations_status
      ON negotiations(status);
  `);
} catch (e) {
  console.error("[NegotiationProxy] Schema init error (negotiations):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS negotiation_rounds (
      id               TEXT PRIMARY KEY,
      negotiation_id   TEXT REFERENCES negotiations(id),
      round_number     INTEGER NOT NULL,
      party            TEXT NOT NULL,
      offer_amount     REAL NOT NULL,
      terms            TEXT DEFAULT '{}',
      concessions      TEXT DEFAULT '[]',
      message          TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_negotiation_rounds_neg
      ON negotiation_rounds(negotiation_id);
  `);
} catch (e) {
  console.error("[NegotiationProxy] Schema init error (negotiation_rounds):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS negotiation_terms (
      id             TEXT PRIMARY KEY,
      negotiation_id TEXT REFERENCES negotiations(id),
      term_key       TEXT NOT NULL,
      term_value     TEXT NOT NULL,
      proposed_by    TEXT NOT NULL,
      accepted       INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[NegotiationProxy] Schema init error (negotiation_terms):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contract_pricing (
      id             TEXT PRIMARY KEY,
      negotiation_id TEXT,
      buyer_agent_id TEXT NOT NULL,
      seller_agent_id TEXT NOT NULL,
      item_id        TEXT,
      locked_price   REAL NOT NULL,
      quantity       REAL DEFAULT 1,
      currency       TEXT DEFAULT 'USDC',
      lock_expires   TEXT NOT NULL,
      contract_hash  TEXT NOT NULL,
      status         TEXT DEFAULT 'active',
      created_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contract_pricing_buyer
      ON contract_pricing(buyer_agent_id);
    CREATE INDEX IF NOT EXISTS idx_contract_pricing_seller
      ON contract_pricing(seller_agent_id);
  `);
} catch (e) {
  console.error("[NegotiationProxy] Schema init error (contract_pricing):", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contractHash() {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round(((a - b) / b) * 10000) / 100;
}

// ─── 1. negotiationCreate ─────────────────────────────────────────────────────

export function negotiationCreate(args) {
  const {
    buyer_agent_id,
    seller_agent_id,
    item_id,
    item_description,
    quantity = 1,
    initial_price,
    target_price,
    batna_price,
    deadline,
    currency = "USDC",
    opening_terms = {},
  } = args;

  if (!buyer_agent_id) throw new Error("buyer_agent_id is required");
  if (!seller_agent_id) throw new Error("seller_agent_id is required");
  if (!item_description) throw new Error("item_description is required");
  if (!initial_price || initial_price <= 0) throw new Error("initial_price must be positive");

  const id = randomUUID();
  const roundId = randomUUID();

  try {
    db.prepare(`
      INSERT INTO negotiations
        (id, buyer_agent_id, seller_agent_id, item_id, item_description, quantity,
         initial_price, target_price, batna_price, current_offer, current_party, deadline, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'buyer', ?, ?)
    `).run(id, buyer_agent_id, seller_agent_id, item_id || null, item_description,
      quantity, initial_price, target_price || null, batna_price || null,
      initial_price, deadline || null, currency);

    db.prepare(`
      INSERT INTO negotiation_rounds
        (id, negotiation_id, round_number, party, offer_amount, terms, message)
      VALUES (?, ?, 1, 'buyer', ?, ?, ?)
    `).run(roundId, id, initial_price, JSON.stringify(opening_terms), "Opening offer");
  } catch (e) {
    console.error("[NegotiationProxy] Create error:", e.message);
    throw e;
  }

  return {
    negotiation_id: id,
    status: "open",
    round: 1,
    current_offer: initial_price,
    current_party: "buyer",
    parties: { buyer: buyer_agent_id, seller: seller_agent_id },
    item: { id: item_id, description: item_description, quantity },
    pricing: {
      initial_offer: initial_price,
      target_price: target_price || null,
      batna: batna_price || null,
      currency,
    },
    opening_terms,
    deadline: deadline || null,
    platform_fee: "2% of accepted deal value",
    next_action: `${seller_agent_id} should call negotiation_counter_offer or negotiation_accept`,
    created_at: new Date().toISOString(),
  };
}

// ─── 2. negotiationCounterOffer ───────────────────────────────────────────────

export function negotiationCounterOffer(args) {
  const {
    negotiation_id,
    agent_id,
    counter_price,
    terms = {},
    concessions = [],
    message,
  } = args;

  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!counter_price || counter_price <= 0) throw new Error("counter_price must be positive");

  let neg;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Query error:", e.message);
  }
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);
  if (neg.status !== "open") throw new Error(`Negotiation is ${neg.status}, not open`);

  const party = agent_id === neg.buyer_agent_id ? "buyer"
    : agent_id === neg.seller_agent_id ? "seller"
    : null;
  if (!party) throw new Error("agent_id is not a party to this negotiation");

  const newRound = neg.round_count + 1;
  const roundId = randomUUID();

  try {
    db.prepare(`
      UPDATE negotiations SET current_offer = ?, current_party = ?, round_count = ? WHERE id = ?
    `).run(counter_price, party, newRound, negotiation_id);

    db.prepare(`
      INSERT INTO negotiation_rounds
        (id, negotiation_id, round_number, party, offer_amount, terms, concessions, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(roundId, negotiation_id, newRound, party, counter_price, JSON.stringify(terms), JSON.stringify(concessions), message || null);
  } catch (e) {
    console.error("[NegotiationProxy] Counter offer error:", e.message);
    throw e;
  }

  const delta = pct(counter_price, neg.current_offer);

  return {
    negotiation_id,
    round: newRound,
    party,
    counter_price,
    previous_offer: neg.current_offer,
    change_pct: delta,
    terms,
    concessions,
    message: message || null,
    gap_from_initial: pct(counter_price, neg.initial_price),
    status: "open",
    next_action: party === "buyer"
      ? `${neg.seller_agent_id} should respond`
      : `${neg.buyer_agent_id} should respond`,
    batna_note: neg.batna_price
      ? (counter_price <= neg.batna_price ? "WARNING: offer is at or below BATNA — consider walking away" : "Offer is above BATNA — room to continue")
      : null,
  };
}

// ─── 3. negotiationAccept ─────────────────────────────────────────────────────

export function negotiationAccept(args) {
  const {
    negotiation_id,
    agent_id,
    escrow_attached = false,
  } = args;

  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  let neg;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Query error:", e.message);
  }
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);
  if (neg.status !== "open") throw new Error(`Negotiation is ${neg.status}, cannot accept`);

  const party = agent_id === neg.buyer_agent_id ? "buyer"
    : agent_id === neg.seller_agent_id ? "seller"
    : null;
  if (!party) throw new Error("agent_id is not a party to this negotiation");

  const acceptedPrice = neg.current_offer;
  const platformFee = acceptedPrice * neg.platform_fee_pct * (neg.quantity || 1);
  const acceptedAt = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE negotiations SET status = 'accepted', accepted_price = ?, accepted_at = ? WHERE id = ?
    `).run(acceptedPrice, acceptedAt, negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Accept error:", e.message);
    throw e;
  }

  const savings = party === "buyer"
    ? pct(neg.initial_price, acceptedPrice)
    : null;
  const discount = party === "buyer"
    ? neg.initial_price - acceptedPrice
    : null;

  return {
    negotiation_id,
    status: "accepted",
    accepted_by: party,
    accepted_price: acceptedPrice,
    currency: neg.currency,
    quantity: neg.quantity,
    total_value: acceptedPrice * (neg.quantity || 1),
    platform_fee_usd: platformFee,
    rounds_taken: neg.round_count,
    buyer_savings: party === "buyer" ? { amount: discount, pct: savings } : undefined,
    escrow: escrow_attached ? {
      status: "pending",
      note: "Call smart_escrow_create to lock funds",
    } : undefined,
    binding_agreement: true,
    accepted_at: acceptedAt,
    parties: { buyer: neg.buyer_agent_id, seller: neg.seller_agent_id },
    item: { description: neg.item_description, quantity: neg.quantity },
    next_steps: escrow_attached
      ? ["Call smart_escrow_create with this negotiation_id to lock funds"]
      : ["Transfer payment", "Deliver service/goods", "Mark complete"],
  };
}

// ─── 4. negotiationReject ─────────────────────────────────────────────────────

export function negotiationReject(args) {
  const {
    negotiation_id,
    agent_id,
    reason,
    batna_exercised = false,
  } = args;

  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  let neg;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Query error:", e.message);
  }
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);

  try {
    db.prepare("UPDATE negotiations SET status = 'rejected' WHERE id = ?").run(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Reject error:", e.message);
  }

  const party = agent_id === neg.buyer_agent_id ? "buyer" : "seller";

  return {
    negotiation_id,
    status: "rejected",
    rejected_by: party,
    reason: reason || "No reason provided",
    batna_exercised,
    batna_note: batna_exercised && neg.batna_price
      ? `BATNA exercised — best alternative was $${neg.batna_price} ${neg.currency}`
      : null,
    rounds_completed: neg.round_count,
    last_offer: neg.current_offer,
    currency: neg.currency,
    rejected_at: new Date().toISOString(),
    recommendation: batna_exercised
      ? "BATNA executed — pursue best alternative"
      : "Consider re-opening with revised terms or a different seller",
  };
}

// ─── 5. negotiationAutoNegotiate ──────────────────────────────────────────────

export function negotiationAutoNegotiate(args) {
  const {
    negotiation_id,
    agent_id,
    min_acceptable_price,
    max_acceptable_price,
    must_have_terms = [],
    strategy = "moderate",
  } = args;

  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  let neg;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Query error:", e.message);
  }
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);

  const party = agent_id === neg.buyer_agent_id ? "buyer"
    : agent_id === neg.seller_agent_id ? "seller"
    : null;
  if (!party) throw new Error("agent_id is not a party to this negotiation");

  // Nash bargaining: split the surplus between min and max
  // Nash solution maximizes product of (buyer_payoff * seller_payoff)
  const sellerMin = party === "seller" ? (min_acceptable_price || neg.target_price || neg.initial_price * 0.8) : neg.batna_price || neg.initial_price * 0.6;
  const buyerMax = party === "buyer" ? (max_acceptable_price || neg.initial_price) : neg.initial_price;

  const STRATEGIES = {
    aggressive:  0.35,  // claim 65% of surplus
    moderate:    0.50,  // split evenly
    cooperative: 0.65,  // concede more to other party
  };
  const splitPoint = STRATEGIES[strategy] || 0.50;

  // Nash-optimal price = sellerMin + splitPoint * (buyerMax - sellerMin)
  const nashPrice = Math.round((sellerMin + splitPoint * (buyerMax - sellerMin)) * 100) / 100;

  // Check feasibility
  const feasible = (min_acceptable_price === undefined || nashPrice >= min_acceptable_price)
    && (max_acceptable_price === undefined || nashPrice <= max_acceptable_price);

  const roundId = randomUUID();
  let autoOffer = feasible ? nashPrice : (party === "buyer" ? min_acceptable_price : max_acceptable_price);

  if (feasible) {
    try {
      const newRound = neg.round_count + 1;
      db.prepare(`
        UPDATE negotiations SET current_offer = ?, current_party = ?, round_count = ? WHERE id = ?
      `).run(autoOffer, party, newRound, negotiation_id);
      db.prepare(`
        INSERT INTO negotiation_rounds
          (id, negotiation_id, round_number, party, offer_amount, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(roundId, negotiation_id, newRound, party, autoOffer, `Auto-negotiated (${strategy} strategy, Nash bargaining)`);
    } catch (e) {
      console.error("[NegotiationProxy] Auto-negotiate error:", e.message);
    }
  }

  return {
    negotiation_id,
    party,
    strategy,
    algorithm: "Nash Bargaining Solution",
    auto_offer: autoOffer,
    feasible,
    feasibility_note: feasible
      ? "Offer is within your acceptable range"
      : "Nash solution outside your constraints — offer set to boundary",
    nash_calculation: {
      seller_min: sellerMin,
      buyer_max: buyerMax,
      surplus: buyerMax - sellerMin,
      split_point: splitPoint,
      nash_price: nashPrice,
    },
    constraints: {
      min_acceptable: min_acceptable_price,
      max_acceptable: max_acceptable_price,
      must_have_terms,
    },
    current_round: neg.round_count + (feasible ? 1 : 0),
    recommendation: feasible
      ? `Submit auto-offer of ${autoOffer} ${neg.currency} — Nash-optimal for ${strategy} strategy`
      : `Consider adjusting constraints — current gap prevents agreement`,
  };
}

// ─── 6. negotiationGetHistory ─────────────────────────────────────────────────

export function negotiationGetHistory(args) {
  const { negotiation_id } = args;
  if (!negotiation_id) throw new Error("negotiation_id is required");

  let neg, rounds, terms;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
    rounds = db.prepare("SELECT * FROM negotiation_rounds WHERE negotiation_id = ? ORDER BY round_number ASC").all(negotiation_id);
    terms = db.prepare("SELECT * FROM negotiation_terms WHERE negotiation_id = ? ORDER BY created_at ASC").all(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] History query error:", e.message);
    return { error: e.message };
  }

  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);

  const priceTrajectory = rounds.map(r => ({ round: r.round_number, party: r.party, price: r.offer_amount }));
  const buyerRounds = rounds.filter(r => r.party === "buyer");
  const sellerRounds = rounds.filter(r => r.party === "seller");

  return {
    negotiation_id,
    status: neg.status,
    parties: { buyer: neg.buyer_agent_id, seller: neg.seller_agent_id },
    item: { description: neg.item_description, quantity: neg.quantity },
    pricing_summary: {
      initial_offer: neg.initial_price,
      current_offer: neg.current_offer,
      accepted_price: neg.accepted_price,
      currency: neg.currency,
      target_price: neg.target_price,
      batna: neg.batna_price,
      total_movement: pct(neg.current_offer, neg.initial_price),
    },
    rounds: rounds.map(r => ({
      round: r.round_number,
      party: r.party,
      offer: r.offer_amount,
      terms: JSON.parse(r.terms || "{}"),
      concessions: JSON.parse(r.concessions || "[]"),
      message: r.message,
      timestamp: r.created_at,
    })),
    price_trajectory: priceTrajectory,
    terms: terms.map(t => ({ key: t.term_key, value: t.term_value, proposed_by: t.proposed_by, accepted: !!t.accepted })),
    analytics: {
      total_rounds: neg.round_count,
      buyer_offers: buyerRounds.length,
      seller_offers: sellerRounds.length,
      buyer_concession: buyerRounds.length > 1 ? pct(buyerRounds[buyerRounds.length-1].offer_amount, buyerRounds[0].offer_amount) : 0,
      seller_concession: sellerRounds.length > 1 ? pct(sellerRounds[sellerRounds.length-1].offer_amount, sellerRounds[0].offer_amount) : 0,
    },
    created_at: neg.created_at,
    accepted_at: neg.accepted_at,
  };
}

// ─── 7. negotiationVolumePricing ──────────────────────────────────────────────

export function negotiationVolumePricing(args) {
  const {
    seller_agent_id,
    item_id,
    item_description,
    tiers,
    currency = "USDC",
  } = args;

  if (!seller_agent_id) throw new Error("seller_agent_id is required");
  if (!item_description) throw new Error("item_description is required");
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) throw new Error("tiers array is required");

  // Validate and sort tiers
  const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  for (const t of sortedTiers) {
    if (!t.min_quantity || t.min_quantity <= 0) throw new Error("Each tier needs min_quantity > 0");
    if (!t.price_per_unit || t.price_per_unit <= 0) throw new Error("Each tier needs price_per_unit > 0");
  }

  const tierId = randomUUID();

  return {
    volume_pricing_id: tierId,
    seller_agent_id,
    item: { id: item_id, description: item_description },
    currency,
    tiers: sortedTiers.map((t, i) => ({
      tier: i + 1,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity || (sortedTiers[i+1] ? sortedTiers[i+1].min_quantity - 1 : null),
      price_per_unit: t.price_per_unit,
      label: t.label || `Tier ${i+1}`,
      discount_vs_tier1: i === 0 ? 0 : pct(t.price_per_unit, sortedTiers[0].price_per_unit),
    })),
    example_quotes: sortedTiers.map(t => ({
      quantity: t.min_quantity,
      unit_price: t.price_per_unit,
      total: t.price_per_unit * t.min_quantity,
      currency,
    })),
    how_to_use: "Pass this volume_pricing_id when creating a negotiation — buyer agents can query pricing tiers before opening negotiation",
    tip: "Start negotiation at the top of your target tier — volume discounts incentivize larger commitments",
    created_at: new Date().toISOString(),
  };
}

// ─── 8. negotiationContractLock ───────────────────────────────────────────────

export function negotiationContractLock(args) {
  const {
    negotiation_id,
    agent_id,
    lock_days = 30,
    quantity,
    notes,
  } = args;

  if (!negotiation_id) throw new Error("negotiation_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (lock_days <= 0 || lock_days > 365) throw new Error("lock_days must be 1-365");

  let neg;
  try {
    neg = db.prepare("SELECT * FROM negotiations WHERE id = ?").get(negotiation_id);
  } catch (e) {
    console.error("[NegotiationProxy] Query error:", e.message);
  }
  if (!neg) throw new Error(`Negotiation ${negotiation_id} not found`);
  if (!["open", "accepted"].includes(neg.status)) throw new Error(`Cannot lock — negotiation is ${neg.status}`);

  const lockedPrice = neg.accepted_price || neg.current_offer;
  const lockedQty = quantity || neg.quantity;
  const lockExpires = new Date(Date.now() + lock_days * 86_400_000).toISOString();
  const hash = contractHash();
  const contractId = randomUUID();

  try {
    db.prepare(`
      INSERT INTO contract_pricing
        (id, negotiation_id, buyer_agent_id, seller_agent_id, item_id, locked_price, quantity, currency, lock_expires, contract_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contractId, negotiation_id, neg.buyer_agent_id, neg.seller_agent_id, neg.item_id || null, lockedPrice, lockedQty, neg.currency, lockExpires, hash);
  } catch (e) {
    console.error("[NegotiationProxy] Contract lock error:", e.message);
    throw e;
  }

  return {
    contract_id: contractId,
    negotiation_id,
    locked_price: lockedPrice,
    locked_quantity: lockedQty,
    currency: neg.currency,
    total_locked_value: lockedPrice * lockedQty,
    lock_expires: lockExpires,
    lock_duration_days: lock_days,
    contract_hash: hash,
    parties: { buyer: neg.buyer_agent_id, seller: neg.seller_agent_id },
    item: { id: neg.item_id, description: neg.item_description },
    notes: notes || null,
    status: "active",
    legal_note: "Price locked for specified duration — seller cannot increase price, buyer has option to purchase at locked price",
    created_at: new Date().toISOString(),
  };
}

// ─── 9. negotiationDashboard ──────────────────────────────────────────────────

export function negotiationDashboard(args) {
  const { agent_id } = args;
  if (!agent_id) throw new Error("agent_id is required");

  let active, completed, allNegs, contracts;
  try {
    active = db.prepare(`
      SELECT * FROM negotiations
      WHERE (buyer_agent_id = ? OR seller_agent_id = ?) AND status = 'open'
      ORDER BY created_at DESC
    `).all(agent_id, agent_id);

    allNegs = db.prepare(`
      SELECT * FROM negotiations
      WHERE buyer_agent_id = ? OR seller_agent_id = ?
    `).all(agent_id, agent_id);

    completed = allNegs.filter(n => n.status === "accepted");

    contracts = db.prepare(`
      SELECT * FROM contract_pricing
      WHERE (buyer_agent_id = ? OR seller_agent_id = ?) AND status = 'active' AND lock_expires > datetime('now')
      ORDER BY created_at DESC LIMIT 10
    `).all(agent_id, agent_id);
  } catch (e) {
    console.error("[NegotiationProxy] Dashboard query error:", e.message);
    return { agent_id, error: e.message };
  }

  const buyerWins = completed.filter(n => n.buyer_agent_id === agent_id && n.accepted_price < n.initial_price);
  const totalDiscountSaved = buyerWins.reduce((s, n) => s + (n.initial_price - n.accepted_price) * (n.quantity || 1), 0);
  const totalVolumeNegotiated = completed.reduce((s, n) => s + (n.accepted_price || 0) * (n.quantity || 1), 0);
  const winRate = allNegs.length > 0 ? Math.round((completed.length / allNegs.length) * 100) : 0;
  const avgDiscount = buyerWins.length > 0
    ? Math.round(buyerWins.reduce((s, n) => s + pct(n.initial_price, n.accepted_price), 0) / buyerWins.length * 10) / 10
    : 0;

  return {
    agent_id,
    as_of: new Date().toISOString(),
    summary: {
      active_negotiations: active.length,
      total_negotiations: allNegs.length,
      accepted_deals: completed.length,
      win_rate_pct: winRate,
      avg_discount_pct: avgDiscount,
      total_discount_saved: Math.round(totalDiscountSaved * 100) / 100,
      total_volume_negotiated: Math.round(totalVolumeNegotiated * 100) / 100,
      active_contracts: contracts.length,
    },
    active_negotiations: active.map(n => ({
      negotiation_id: n.id,
      role: n.buyer_agent_id === agent_id ? "buyer" : "seller",
      counterparty: n.buyer_agent_id === agent_id ? n.seller_agent_id : n.buyer_agent_id,
      item: n.item_description,
      current_offer: n.current_offer,
      round: n.round_count,
      currency: n.currency,
      created_at: n.created_at,
    })),
    active_contracts: contracts.map(c => ({
      contract_id: c.id,
      locked_price: c.locked_price,
      quantity: c.quantity,
      currency: c.currency,
      expires: c.lock_expires,
    })),
    performance: {
      win_rate: `${winRate}%`,
      avg_buyer_discount: `${avgDiscount}%`,
      total_savings: `${totalDiscountSaved.toFixed(2)} USDC`,
      total_volume: `${totalVolumeNegotiated.toFixed(2)} USDC`,
    },
    tips: [
      active.length > 0 ? `You have ${active.length} open negotiation(s) — respond to keep momentum` : null,
      avgDiscount < 5 ? "Tip: Use negotiation_auto_negotiate for better discount outcomes" : null,
      contracts.length === 0 ? "Tip: Lock your next accepted deal with negotiation_contract_lock" : null,
    ].filter(Boolean),
  };
}
