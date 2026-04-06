import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ORCHESTRATION_ORDER_COMMISSION = 0.02; // 2% of order value
const ORCHESTRATION_RETURN_FEE       = 1.00;
const ORCHESTRATION_PRICE_SEARCH_FEE = 0.10;
const ORCHESTRATION_ANALYTICS_FEE    = 0.50;
const ORCHESTRATION_PLATFORM_COMMISSION = 0.20;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS co_purchase_orders (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    merchant_domain     TEXT,
    merchant_name       TEXT,
    items               TEXT NOT NULL DEFAULT '[]',
    payment_method      TEXT NOT NULL,
    shipping_address    TEXT NOT NULL DEFAULT '{}',
    subtotal_usd        REAL NOT NULL,
    shipping_usd        REAL DEFAULT 0,
    tax_usd             REAL DEFAULT 0,
    estimated_total_usd REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    escrow_id           TEXT,
    protections_applied TEXT DEFAULT '[]',
    status              TEXT DEFAULT 'pending' CHECK(status IN (
                          'pending','payment_processing','confirmed',
                          'fulfilling','shipped','delivered','cancelled','refunded')),
    tracking_number     TEXT,
    carrier             TEXT,
    eta                 TEXT,
    notes               TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS co_escrows (
    id                  TEXT PRIMARY KEY,
    order_id            TEXT NOT NULL REFERENCES co_purchase_orders(id),
    amount_usd          REAL NOT NULL,
    status              TEXT DEFAULT 'holding' CHECK(status IN ('holding','released','refunded','disputed')),
    held_at             TEXT DEFAULT (datetime('now')),
    released_at         TEXT,
    release_condition   TEXT DEFAULT 'delivery_confirmed'
  );

  CREATE TABLE IF NOT EXISTS co_price_searches (
    id                  TEXT PRIMARY KEY,
    query               TEXT NOT NULL,
    results             TEXT DEFAULT '[]',
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS co_returns (
    id                  TEXT PRIMARY KEY,
    order_id            TEXT NOT NULL REFERENCES co_purchase_orders(id),
    reason              TEXT NOT NULL,
    evidence            TEXT DEFAULT '{}',
    status              TEXT DEFAULT 'initiated' CHECK(status IN (
                          'initiated','label_sent','in_transit','received','refunded','denied')),
    refund_amount_usd   REAL,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    initiated_at        TEXT DEFAULT (datetime('now')),
    resolved_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS co_agent_profiles (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL UNIQUE,
    total_spent_usd     REAL DEFAULT 0,
    total_saved_usd     REAL DEFAULT 0,
    order_count         INTEGER DEFAULT 0,
    return_count        INTEGER DEFAULT 0,
    favorite_categories TEXT DEFAULT '[]',
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Agent Profiles & Orders ─────────────────────────────────────────────

const _agentCount = db.prepare("SELECT COUNT(*) as n FROM co_agent_profiles").get().n;
if (_agentCount === 0) {
  const seedAgents = [
    { id: uuid(), agent_id: "agent_research_01",   total_spent_usd: 1247.50, total_saved_usd: 183.20, order_count: 34,  return_count: 2,  favorite_categories: '["electronics","books"]' },
    { id: uuid(), agent_id: "agent_shopper_02",    total_spent_usd: 4892.00, total_saved_usd: 712.40, order_count: 127, return_count: 9,  favorite_categories: '["apparel","home"]' },
    { id: uuid(), agent_id: "agent_assistant_03",  total_spent_usd: 325.75,  total_saved_usd: 44.10,  order_count: 12,  return_count: 1,  favorite_categories: '["office_supplies","books"]' },
    { id: uuid(), agent_id: "agent_procurement_04",total_spent_usd: 18340.00,total_saved_usd: 2201.60,order_count: 289, return_count: 14, favorite_categories: '["electronics","automotive","industrial"]' },
    { id: uuid(), agent_id: "agent_travel_05",     total_spent_usd: 6711.00, total_saved_usd: 891.00, order_count: 88,  return_count: 3,  favorite_categories: '["travel","luggage","electronics"]' },
  ];
  const insertAgent = db.prepare(`
    INSERT OR IGNORE INTO co_agent_profiles
      (id, agent_id, total_spent_usd, total_saved_usd, order_count, return_count, favorite_categories)
    VALUES
      (@id, @agent_id, @total_spent_usd, @total_saved_usd, @order_count, @return_count, @favorite_categories)
  `);
  for (const a of seedAgents) insertAgent.run(a);

  // Seed a few historical orders for agent_shopper_02
  const shopperId = db.prepare("SELECT id FROM co_agent_profiles WHERE agent_id = 'agent_shopper_02'").get()?.id;
  if (shopperId) {
    const seedOrders = [
      { id: uuid(), agent_id: "agent_shopper_02", merchant_domain: "techhaven.com",     merchant_name: "TechHaven",      items: JSON.stringify([{sku:"TH-HDMI-4K",name:"4K HDMI Cable 2m",quantity:2,unit_price:14.99}]),   payment_method: "credit_card", shipping_address: JSON.stringify({city:"Austin",state:"TX",country:"US"}),   subtotal_usd: 29.98,  shipping_usd: 0,    tax_usd: 2.47,  estimated_total_usd: 32.45,  commission_usd: 0.65,  escrow_id: uuid(), protections_applied: JSON.stringify(["escrow","tracking"]), status: "delivered", tracking_number: "1Z999AA10123456784", carrier: "UPS",   eta: "2025-11-10" },
      { id: uuid(), agent_id: "agent_shopper_02", merchant_domain: "fashionloft.co",    merchant_name: "Fashion Loft",   items: JSON.stringify([{sku:"FL-JEANS-32",name:"Slim Jeans W32",quantity:1,unit_price:79.00}]),    payment_method: "credit_card", shipping_address: JSON.stringify({city:"Austin",state:"TX",country:"US"}),   subtotal_usd: 79.00,  shipping_usd: 6.99, tax_usd: 7.08,  estimated_total_usd: 93.07,  commission_usd: 1.86,  escrow_id: uuid(), protections_applied: JSON.stringify(["escrow"]),            status: "delivered", tracking_number: "JD014600004616947",  carrier: "DHL",   eta: "2025-12-02" },
      { id: uuid(), agent_id: "agent_shopper_02", merchant_domain: "bookbazaar.in",     merchant_name: "BookBazaar",     items: JSON.stringify([{sku:"BB-AI-2049",name:"AI and Society 2049",quantity:1,unit_price:28.50}]), payment_method: "paypal",      shipping_address: JSON.stringify({city:"Austin",state:"TX",country:"US"}),   subtotal_usd: 28.50,  shipping_usd: 3.50, tax_usd: 2.64,  estimated_total_usd: 34.64,  commission_usd: 0.69,  escrow_id: uuid(), protections_applied: JSON.stringify(["escrow"]),            status: "delivered", tracking_number: "RR123456789IN",       carrier: "USPS",  eta: "2025-12-18" },
    ];
    const insertOrder = db.prepare(`
      INSERT OR IGNORE INTO co_purchase_orders
        (id, agent_id, merchant_domain, merchant_name, items, payment_method, shipping_address,
         subtotal_usd, shipping_usd, tax_usd, estimated_total_usd, commission_usd,
         escrow_id, protections_applied, status, tracking_number, carrier, eta)
      VALUES
        (@id, @agent_id, @merchant_domain, @merchant_name, @items, @payment_method, @shipping_address,
         @subtotal_usd, @shipping_usd, @tax_usd, @estimated_total_usd, @commission_usd,
         @escrow_id, @protections_applied, @status, @tracking_number, @carrier, @eta)
    `);
    for (const o of seedOrders) insertOrder.run(o);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARRIER_PREFIXES = {
  UPS:    ["1Z"],
  FedEx:  ["7489", "0201"],
  USPS:   ["9400", "9205", "9361"],
  DHL:    ["JD01"],
  Amazon: ["TBA"],
};

function generateTracking() {
  const carriers = Object.entries(CARRIER_PREFIXES);
  const [carrier, prefixes] = carriers[Math.floor(Math.random() * carriers.length)];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.random().toString(36).slice(2, 14).toUpperCase();
  return { carrier, tracking_number: `${prefix}${suffix}` };
}

function estimateShipping(address, merchant) {
  const international = address?.country && address.country !== "US";
  return international ? 18.99 : Math.random() < 0.4 ? 0 : 5.99 + Math.random() * 6;
}

function calculateTax(subtotal, address) {
  const stateTaxRates = { TX: 0.0825, CA: 0.0725, NY: 0.08, FL: 0.06, WA: 0.065 };
  const rate = stateTaxRates[address?.state] ?? 0.07;
  return Math.round(subtotal * rate * 100) / 100;
}

// ─── createPurchaseOrder ──────────────────────────────────────────────────────

/**
 * Create a tracked purchase order with escrow protection.
 * @param {Object[]} items          - [{ sku, name, quantity, unit_price }]
 * @param {Object}   merchant       - { domain, name }
 * @param {string}   paymentMethod  - credit_card|paypal|crypto|wire|gift_card|debit_card
 * @param {Object}   shippingAddress- { line1, city, state, zip, country }
 * @returns order_id, escrow_id, estimated_total, protections_applied, fee breakdown
 */
export function createPurchaseOrder(items, merchant, paymentMethod, shippingAddress) {
  if (!items?.length)      throw new Error("items array is required and must not be empty");
  if (!merchant?.domain)   throw new Error("merchant.domain is required");
  if (!paymentMethod)      throw new Error("paymentMethod is required");
  if (!shippingAddress)    throw new Error("shippingAddress is required");

  const subtotal    = items.reduce((sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
  const shipping    = estimateShipping(shippingAddress, merchant);
  const tax         = calculateTax(subtotal, shippingAddress);
  const total       = Math.round((subtotal + shipping + tax) * 100) / 100;
  const commission  = Math.round(total * ORCHESTRATION_ORDER_COMMISSION * 100) / 100;

  // Determine protections based on risk signals
  const protections = ["order_tracking", "receipt_verification"];
  if (!["wire","crypto","gift_card"].includes(paymentMethod)) protections.push("payment_escrow");
  if (total > 100) protections.push("delivery_confirmation_required");
  if (total > 500) protections.push("signature_on_delivery");

  const escrowId = protections.includes("payment_escrow") ? uuid() : null;
  const orderId  = uuid();
  const agentId  = `agent_${uuid().slice(0, 8)}`;
  const now      = new Date().toISOString();
  const eta      = new Date(Date.now() + (4 + Math.floor(Math.random() * 6)) * 86400000).toISOString().slice(0, 10);

  db.prepare(`
    INSERT OR IGNORE INTO co_purchase_orders
      (id, agent_id, merchant_domain, merchant_name, items, payment_method, shipping_address,
       subtotal_usd, shipping_usd, tax_usd, estimated_total_usd, commission_usd,
       escrow_id, protections_applied, status, eta, created_at, updated_at)
    VALUES
      (@id, @agent_id, @merchant_domain, @merchant_name, @items, @payment_method, @shipping_address,
       @subtotal_usd, @shipping_usd, @tax_usd, @estimated_total_usd, @commission_usd,
       @escrow_id, @protections_applied, @status, @eta, @created_at, @updated_at)
  `).run({
    id:                   orderId,
    agent_id:             agentId,
    merchant_domain:      merchant.domain,
    merchant_name:        merchant.name ?? merchant.domain,
    items:                JSON.stringify(items),
    payment_method:       paymentMethod,
    shipping_address:     JSON.stringify(shippingAddress),
    subtotal_usd:         Math.round(subtotal * 100) / 100,
    shipping_usd:         Math.round(shipping * 100) / 100,
    tax_usd:              tax,
    estimated_total_usd:  total,
    commission_usd:       commission,
    escrow_id:            escrowId,
    protections_applied:  JSON.stringify(protections),
    status:               "payment_processing",
    eta,
    created_at:           now,
    updated_at:           now,
  });

  if (escrowId) {
    db.prepare(`
      INSERT OR IGNORE INTO co_escrows (id, order_id, amount_usd, status, held_at)
      VALUES (@id, @order_id, @amount_usd, 'holding', @held_at)
    `).run({ id: escrowId, order_id: orderId, amount_usd: total, held_at: now });
  }

  return {
    order_id:             orderId,
    agent_id:             agentId,
    escrow_id:            escrowId,
    merchant:             { domain: merchant.domain, name: merchant.name ?? merchant.domain },
    items,
    subtotal_usd:         Math.round(subtotal * 100) / 100,
    shipping_usd:         Math.round(shipping * 100) / 100,
    tax_usd:              tax,
    estimated_total_usd:  total,
    platform_commission_usd: commission,
    protections_applied:  protections,
    payment_method:       paymentMethod,
    escrow_active:        escrowId !== null,
    eta,
    status:               "payment_processing",
    created_at:           now,
  };
}

// ─── comparePrices ────────────────────────────────────────────────────────────

/**
 * Search across merchants for best price/trust combination.
 * @param {string} productQuery  - Product name or description
 * @param {number} maxResults    - Max number of results to return (default 5)
 * @returns Ranked listings with price, shipping, trust_score, manipulation_flags
 */
export function comparePrices(productQuery, maxResults = 5) {
  if (!productQuery) throw new Error("productQuery is required");

  const fee        = ORCHESTRATION_PRICE_SEARCH_FEE;
  const commission = Math.round(fee * ORCHESTRATION_PLATFORM_COMMISSION * 100) / 100;

  // Pull known merchants and simulate pricing
  const merchants = db.prepare("SELECT * FROM ct_merchants ORDER BY composite_score DESC LIMIT 12").all();

  const basePrice = 15 + Math.random() * 200;

  const results = merchants
    .filter(m => !m.flagged)
    .slice(0, Math.max(8, maxResults + 2))
    .map(m => {
      // Higher-risk merchants offer lower prices to attract buyers
      const priceMultiplier = 0.7 + (m.composite_score / 100) * 0.6; // 0.7–1.3
      const price  = Math.round(basePrice * priceMultiplier * 100) / 100;
      const shipping = m.delivery_rate > 0.97 ? 0 : 5.99;
      const manipFlags = [];
      if (m.dispute_rate > 0.08) manipFlags.push("elevated_dispute_rate");
      if (m.avg_rating < 3.5 && m.review_count > 20) manipFlags.push("low_review_score");

      return {
        merchant_domain:  m.domain,
        merchant_name:    m.name,
        price_usd:        price,
        shipping_usd:     shipping,
        total_usd:        Math.round((price + shipping) * 100) / 100,
        trust_score:      m.composite_score,
        risk_level:       m.risk_level,
        verified:         m.verified === 1,
        avg_rating:       m.avg_rating,
        manipulation_flags: manipFlags,
        value_score:      Math.round(((m.composite_score / 100) / ((price + shipping) / basePrice)) * 100) / 100,
      };
    })
    .sort((a, b) => b.value_score - a.value_score)
    .slice(0, maxResults);

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO co_price_searches (id, query, results, fee_usd, commission_usd)
    VALUES (@id, @query, @results, @fee_usd, @commission_usd)
  `).run({ id, query: productQuery, results: JSON.stringify(results), fee_usd: fee, commission_usd: commission });

  return {
    search_id:       id,
    query:           productQuery,
    result_count:    results.length,
    best_price:      results.reduce((b, r) => r.total_usd < b.total_usd ? r : b, results[0] ?? {}),
    best_trust:      results.reduce((b, r) => r.trust_score > b.trust_score ? r : b, results[0] ?? {}),
    best_value:      results[0] ?? null,
    results,
    fee_usd:         fee,
    platform_commission_usd: commission,
    searched_at:     new Date().toISOString(),
  };
}

// ─── trackPurchase ────────────────────────────────────────────────────────────

/**
 * Real-time purchase tracking from order → payment → fulfillment → delivery.
 * Free — drives platform engagement.
 * @param {string} orderId
 * @returns status, timeline[], eta, issues[]
 */
export function trackPurchase(orderId) {
  if (!orderId) throw new Error("orderId is required");

  const order = db.prepare("SELECT * FROM co_purchase_orders WHERE id = ?").get(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  // Simulate status progression based on elapsed time
  const createdMs      = new Date(order.created_at).getTime();
  const elapsedHours   = (Date.now() - createdMs) / 3_600_000;
  const issues         = [];

  let simulatedStatus = order.status;
  if (order.status === "payment_processing" && elapsedHours > 0.25) simulatedStatus = "confirmed";
  if (order.status === "confirmed"           && elapsedHours > 2)    simulatedStatus = "fulfilling";
  if (order.status === "fulfilling"          && elapsedHours > 24)   simulatedStatus = "shipped";
  if (order.status === "shipped"             && elapsedHours > 96)   simulatedStatus = "delivered";

  if (simulatedStatus !== order.status && !["delivered","cancelled","refunded"].includes(order.status)) {
    const { carrier, tracking_number } = generateTracking();
    const updates = { status: simulatedStatus, id: orderId };
    if (simulatedStatus === "shipped" && !order.tracking_number) {
      db.prepare("UPDATE co_purchase_orders SET status=@status, tracking_number=@tn, carrier=@carrier, updated_at=datetime('now') WHERE id=@id")
        .run({ status: simulatedStatus, tn: tracking_number, carrier, id: orderId });
      order.tracking_number = tracking_number;
      order.carrier         = carrier;
    } else {
      db.prepare("UPDATE co_purchase_orders SET status=@status, updated_at=datetime('now') WHERE id=@id").run(updates);
    }
    order.status = simulatedStatus;
  }

  const statusSteps = ["pending","payment_processing","confirmed","fulfilling","shipped","delivered"];
  const currentIdx  = statusSteps.indexOf(simulatedStatus);

  const timeline = statusSteps.map((step, i) => ({
    step,
    label: {
      pending:            "Order created",
      payment_processing: "Processing payment",
      confirmed:          "Order confirmed by merchant",
      fulfilling:         "Picking & packing",
      shipped:            "In transit",
      delivered:          "Delivered",
    }[step],
    completed: i <= currentIdx,
    estimated_at: new Date(createdMs + [0, 0.25, 2, 24, 48, 120][i] * 3_600_000).toISOString(),
  }));

  if (elapsedHours > 120 && simulatedStatus !== "delivered") {
    issues.push({ type: "delayed_delivery", detail: "Delivery is taking longer than expected", severity: "medium" });
  }

  const escrow = order.escrow_id
    ? db.prepare("SELECT * FROM co_escrows WHERE id = ?").get(order.escrow_id)
    : null;

  // Auto-release escrow on delivery
  if (simulatedStatus === "delivered" && escrow?.status === "holding") {
    db.prepare("UPDATE co_escrows SET status='released', released_at=datetime('now') WHERE id=?").run(order.escrow_id);
  }

  return {
    order_id:        orderId,
    status:          simulatedStatus,
    merchant:        { domain: order.merchant_domain, name: order.merchant_name },
    timeline,
    current_step:    currentIdx + 1,
    total_steps:     statusSteps.length,
    progress_pct:    Math.round(((currentIdx + 1) / statusSteps.length) * 100),
    tracking_number: order.tracking_number ?? null,
    carrier:         order.carrier ?? null,
    eta:             order.eta,
    escrow_status:   escrow?.status ?? null,
    issues,
    fee_usd:         0.00,
    last_updated:    new Date().toISOString(),
  };
}

// ─── initiateReturn ───────────────────────────────────────────────────────────

/**
 * Initiate a return/refund through the trust layer.
 * @param {string} orderId  - Order ID to return
 * @param {string} reason   - Return reason (not_as_described|damaged|wrong_item|changed_mind|quality)
 * @param {Object} evidence - { description, photos, tracking_number }
 * @returns Return record with label instructions and estimated refund timeline
 */
export function initiateReturn(orderId, reason, evidence = {}) {
  if (!orderId) throw new Error("orderId is required");
  if (!reason)  throw new Error("reason is required");

  const order = db.prepare("SELECT * FROM co_purchase_orders WHERE id = ?").get(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const validReturns = ["not_as_described","damaged","wrong_item","changed_mind","quality"];
  if (!validReturns.includes(reason)) {
    throw new Error(`Invalid reason. Must be one of: ${validReturns.join(", ")}`);
  }

  if (["pending","payment_processing"].includes(order.status)) {
    throw new Error("Order has not yet been confirmed — cancel instead of returning");
  }

  const fee        = ORCHESTRATION_RETURN_FEE;
  const commission = Math.round(fee * ORCHESTRATION_PLATFORM_COMMISSION * 100) / 100;

  const returnId        = uuid();
  const refundAmount    = JSON.parse(order.items).reduce((sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
  const sellerFaultReasons = ["not_as_described","damaged","wrong_item"];
  const isMerchantFault = sellerFaultReasons.includes(reason);
  const refundIncludesShipping = isMerchantFault;
  const totalRefund     = Math.round((refundAmount + (refundIncludesShipping ? order.shipping_usd : 0)) * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO co_returns
      (id, order_id, reason, evidence, status, refund_amount_usd, fee_usd, commission_usd)
    VALUES (@id, @order_id, @reason, @evidence, 'initiated', @refund_amount_usd, @fee_usd, @commission_usd)
  `).run({
    id:               returnId,
    order_id:         orderId,
    reason,
    evidence:         JSON.stringify(evidence),
    refund_amount_usd: totalRefund,
    fee_usd:          fee,
    commission_usd:   commission,
  });

  db.prepare("UPDATE co_purchase_orders SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(orderId);

  // Release escrow if merchant at fault
  if (order.escrow_id && isMerchantFault) {
    db.prepare("UPDATE co_escrows SET status='refunded', released_at=datetime('now') WHERE id=?").run(order.escrow_id);
  }

  const resolutionDays = isMerchantFault ? 3 : 7;
  const resolutionDate = new Date(Date.now() + resolutionDays * 86400000).toISOString().slice(0, 10);

  return {
    return_id:              returnId,
    order_id:               orderId,
    reason,
    status:                 "initiated",
    merchant_at_fault:      isMerchantFault,
    refund_amount_usd:      totalRefund,
    shipping_refunded:      refundIncludesShipping,
    escrow_refunded:        isMerchantFault && !!order.escrow_id,
    return_label_instructions: isMerchantFault
      ? "A prepaid return label will be emailed within 24 hours. Drop off within 7 days."
      : "Download return label from merchant portal. Return shipping is at your cost for change_of_mind.",
    estimated_resolution:   resolutionDate,
    fee_usd:                fee,
    platform_commission_usd: commission,
    initiated_at:           new Date().toISOString(),
  };
}

// ─── getAgentShoppingHistory ──────────────────────────────────────────────────

/**
 * Retrieve purchase analytics, spending patterns, and merchant ratings for an agent.
 * @param {string} agentId    - Agent ID to query
 * @param {Object} dateRange  - { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } (optional)
 * @param {boolean} analytics - Request full analytics report ($0.50 fee), or basic data (free)
 * @returns transactions[], total_spent, total_saved, top_merchants[], fee
 */
export function getAgentShoppingHistory(agentId, dateRange = null, analytics = false) {
  if (!agentId) throw new Error("agentId is required");

  const fee        = analytics ? ORCHESTRATION_ANALYTICS_FEE : 0;
  const commission = Math.round(fee * ORCHESTRATION_PLATFORM_COMMISSION * 100) / 100;

  let sql = "SELECT * FROM co_purchase_orders WHERE agent_id = ?";
  const params = [agentId];

  if (dateRange?.from) { sql += " AND created_at >= ?"; params.push(dateRange.from); }
  if (dateRange?.to)   { sql += " AND created_at <= ?"; params.push(dateRange.to + " 23:59:59"); }
  sql += " ORDER BY created_at DESC";

  const orders = db.prepare(sql).all(...params);

  const profile = db.prepare("SELECT * FROM co_agent_profiles WHERE agent_id = ?").get(agentId);

  const transactions = orders.map(o => ({
    order_id:      o.id,
    merchant:      { domain: o.merchant_domain, name: o.merchant_name },
    items:         JSON.parse(o.items || "[]"),
    total_usd:     o.estimated_total_usd,
    status:        o.status,
    payment_method: o.payment_method,
    created_at:    o.created_at,
  }));

  const totalSpent = transactions
    .filter(t => !["cancelled","refunded"].includes(t.status))
    .reduce((s, t) => s + t.total_usd, 0);

  // Count orders per merchant
  const merchantCounts = {};
  const merchantSpend  = {};
  for (const t of transactions) {
    const d = t.merchant.domain;
    merchantCounts[d] = (merchantCounts[d] ?? 0) + 1;
    merchantSpend[d]  = (merchantSpend[d] ?? 0) + t.total_usd;
  }
  const topMerchants = Object.entries(merchantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({
      domain,
      order_count: count,
      total_spent_usd: Math.round(merchantSpend[domain] * 100) / 100,
    }));

  const result = {
    agent_id:          agentId,
    transaction_count: transactions.length,
    transactions,
    total_spent_usd:   Math.round(totalSpent * 100) / 100,
    total_saved_usd:   profile?.total_saved_usd ?? 0,
    return_count:      profile?.return_count ?? 0,
    top_merchants:     topMerchants,
    date_range:        dateRange ?? { from: "all_time", to: "now" },
    fee_usd:           fee,
  };

  if (analytics) {
    const statusCounts = transactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1; return acc;
    }, {});
    const avgOrderValue = transactions.length
      ? Math.round((totalSpent / transactions.length) * 100) / 100
      : 0;

    result.analytics = {
      avg_order_value_usd: avgOrderValue,
      delivery_success_rate: transactions.length
        ? Math.round(((statusCounts.delivered ?? 0) / transactions.length) * 100) / 100
        : null,
      return_rate: transactions.length
        ? Math.round(((profile?.return_count ?? 0) / transactions.length) * 100) / 100
        : null,
      status_breakdown: statusCounts,
      spending_by_merchant: merchantSpend,
      platform_commission_usd: commission,
    };
  }

  return result;
}
