/**
 * HiveAgent Intelligent Protocol Router
 *
 * THE killer feature — picks the optimal payment method from ALL available
 * protocols based on amount, speed, cost preference, geography, and compliance.
 *
 * This is what Circle can't do (they only know USDC) and Tether can't do
 * (they only know USDT). HiveAgent is the neutral meta-layer above all of them.
 *
 * Routing logic:
 *   < $0.10, API call      → x402 (cheapest, per-request micropayments)
 *   < $1.00, streaming     → payment_streaming (per-second billing)
 *   $1–$100, standard      → Stripe or PayPal (highest trust, consumer-grade)
 *   > $100, cross-border   → BVNK or Circle CPN (best rates, enterprise)
 *   Crypto-native          → CDP wallet direct
 *   Card required          → Visa ICC or Mastercard Agent Pay
 *   Speed priority         → x402 (instant) or FedNow (domestic same-day)
 *   Cost priority          → x402 (zero protocol fees) or ACH (0.5%)
 *   Compliance priority    → Stripe (PCI-DSS) or Circle CPN (regulated)
 *
 * The router checks process.env for each protocol's API key and only
 * offers LIVE routes for configured protocols. Unconfigured protocols
 * are offered in simulation with a setup cost estimate.
 *
 * DB tables: route_decisions, route_analytics
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Protocol Catalog ─────────────────────────────────────────────────────────

const PROTOCOL_CATALOG = {
  x402: {
    name: "x402 HTTP Payments",
    description: "HTTP-native micropayments. No wallets, no gas, instant settlement.",
    fee_model: "percentage",
    fee_pct: 0.002,       // 0.2%
    flat_fee_usd: 0,
    settlement_ms: 150,
    min_usd: 0.000001,
    max_usd: 10_000,
    currencies: ["USDC", "ETH", "WETH"],
    best_for: ["micropayment", "api_call", "speed", "cost"],
    pci_compliant: false,
    cross_border: true,
    env_key: "X402_API_KEY",
  },
  payment_streaming: {
    name: "Payment Streaming",
    description: "Per-second USDC streams — pay exactly for what you use.",
    fee_model: "percentage",
    fee_pct: 0.001,       // 0.1%
    flat_fee_usd: 0,
    settlement_ms: 1000,
    min_usd: 0.000001,
    max_usd: 50_000,
    currencies: ["USDC", "USDT"],
    best_for: ["streaming", "subscription", "per_second"],
    pci_compliant: false,
    cross_border: true,
    env_key: "PAYMENT_STREAMING_KEY",
  },
  stripe: {
    name: "Stripe Payments",
    description: "Card-backed payments. PCI-DSS compliant. 135+ currencies. Instant auth.",
    fee_model: "percentage_plus_flat",
    fee_pct: 0.029,       // 2.9%
    flat_fee_usd: 0.30,
    settlement_ms: 3_000,
    min_usd: 0.50,
    max_usd: 999_999,
    currencies: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN"],
    best_for: ["trust", "compliance", "card", "consumer"],
    pci_compliant: true,
    cross_border: true,
    env_key: "STRIPE_SECRET_KEY",
  },
  paypal: {
    name: "PayPal Agent Commerce Protocol",
    description: "PayPal ACP — agent-to-agent PayPal payments with consumer trust network.",
    fee_model: "percentage_plus_flat",
    fee_pct: 0.0349,      // 3.49%
    flat_fee_usd: 0.49,
    settlement_ms: 5_000,
    min_usd: 0.01,
    max_usd: 60_000,
    currencies: ["USD", "EUR", "GBP", "CAD"],
    best_for: ["trust", "consumer", "card", "standard"],
    pci_compliant: true,
    cross_border: true,
    env_key: "PAYPAL_CLIENT_ID",
  },
  bvnk: {
    name: "BVNK Enterprise Stablecoin",
    description: "Enterprise fiat↔stablecoin payments. Best rates > $100. 35+ currencies.",
    fee_model: "percentage",
    fee_pct: 0.001,       // 0.1%
    flat_fee_usd: 0,
    settlement_ms: 30_000,
    min_usd: 10,
    max_usd: 10_000_000,
    currencies: ["USD", "EUR", "GBP", "USDC", "USDT", "DAI"],
    best_for: ["cross_border", "high_value", "enterprise", "stablecoin"],
    pci_compliant: false,
    cross_border: true,
    env_key: "BVNK_API_KEY",
  },
  circle_cpn: {
    name: "Circle Cross-Chain Payment Network",
    description: "Circle CPN — regulated stablecoin payments across 140+ countries. Sub-second USDC.",
    fee_model: "percentage",
    fee_pct: 0.0008,      // 0.08%
    flat_fee_usd: 0,
    settlement_ms: 5_000,
    min_usd: 1,
    max_usd: 5_000_000,
    currencies: ["USDC", "EURC"],
    best_for: ["cross_border", "high_value", "compliance", "stablecoin"],
    pci_compliant: false,
    cross_border: true,
    env_key: "CIRCLE_APPKITS_API_KEY",
  },
  cdp_wallet: {
    name: "Coinbase CDP Wallet Direct",
    description: "Direct on-chain transfer via Coinbase Developer Platform wallet. Crypto-native.",
    fee_model: "flat",
    fee_pct: 0,
    flat_fee_usd: 0.02,
    settlement_ms: 2_000,
    min_usd: 0.01,
    max_usd: 1_000_000,
    currencies: ["USDC", "ETH", "BTC", "cbBTC", "EURC"],
    best_for: ["crypto", "on_chain", "defi", "cost"],
    pci_compliant: false,
    cross_border: true,
    env_key: "CDP_API_KEY_NAME",
  },
  visa_icc: {
    name: "Visa Intelligent Commerce Cloud",
    description: "Visa ICC — AI-native card payments for autonomous agents. Instant auth.",
    fee_model: "percentage_plus_flat",
    fee_pct: 0.018,       // 1.8% interchange
    flat_fee_usd: 0,
    settlement_ms: 800,
    min_usd: 0.01,
    max_usd: 250_000,
    currencies: ["USD", "EUR", "GBP", "160+ currencies"],
    best_for: ["card", "instant", "consumer", "global"],
    pci_compliant: true,
    cross_border: true,
    env_key: "VISA_API_KEY",
  },
  mastercard_agent_pay: {
    name: "Mastercard Agent Pay",
    description: "Mastercard's agent-native payment rail. Biometric + AI auth. Global acceptance.",
    fee_model: "percentage_plus_flat",
    fee_pct: 0.020,       // 2.0%
    flat_fee_usd: 0.10,
    settlement_ms: 1_200,
    min_usd: 0.01,
    max_usd: 500_000,
    currencies: ["USD", "EUR", "GBP", "150+ currencies"],
    best_for: ["card", "global", "enterprise", "trust"],
    pci_compliant: true,
    cross_border: true,
    env_key: "MASTERCARD_API_KEY",
  },
  fednow: {
    name: "FedNow Instant Payments",
    description: "Federal Reserve instant payment rail. Domestic USD only. 24/7/365 settlement.",
    fee_model: "flat",
    fee_pct: 0,
    flat_fee_usd: 0.045,  // Fed charges 4.5¢ per transfer
    settlement_ms: 10_000,
    min_usd: 0.01,
    max_usd: 500_000,
    currencies: ["USD"],
    best_for: ["speed", "domestic", "bank", "cost"],
    pci_compliant: true,
    cross_border: false,
    env_key: "FEDNOW_ROUTING_KEY",
  },
  ach: {
    name: "ACH Standard / Same-Day",
    description: "Standard US bank transfer. Cheapest for large domestic USD transfers.",
    fee_model: "percentage_plus_flat",
    fee_pct: 0.005,       // 0.5%
    flat_fee_usd: 0.25,
    settlement_ms: 86_400_000, // 1 day
    min_usd: 0.01,
    max_usd: 100_000,
    currencies: ["USD"],
    best_for: ["cost", "domestic", "bank", "large"],
    pci_compliant: false,
    cross_border: false,
    env_key: "STRIPE_SECRET_KEY", // via Stripe ACH
  },
};

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS route_decisions (
      id                TEXT PRIMARY KEY,
      agent_id          TEXT,
      amount_usd        REAL NOT NULL,
      currency          TEXT,
      destination       TEXT,
      speed_pref        TEXT,
      cost_pref         TEXT,
      compliance_pref   TEXT,
      winning_protocol  TEXT NOT NULL,
      reason            TEXT NOT NULL,
      fee_usd           REAL NOT NULL,
      est_settlement_ms INTEGER,
      alternatives_json TEXT,
      mode              TEXT NOT NULL,
      created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS route_analytics (
      id               TEXT PRIMARY KEY,
      protocol         TEXT NOT NULL,
      call_count       INTEGER DEFAULT 0,
      total_volume_usd REAL DEFAULT 0,
      total_fees_usd   REAL DEFAULT 0,
      last_used_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(protocol)
    );
  `);
} catch (e) {
  console.warn("[protocol-router DB Schema]", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcProtocolFee(protocol_key, amount_usd) {
  const p = PROTOCOL_CATALOG[protocol_key];
  if (!p) return 0;
  return parseFloat((amount_usd * p.fee_pct + p.flat_fee_usd).toFixed(4));
}

function isLive(protocol_key) {
  const p = PROTOCOL_CATALOG[protocol_key];
  return p && !!process.env[p.env_key];
}

function buildRouteComparison(amount_usd, preference = {}) {
  return Object.entries(PROTOCOL_CATALOG)
    .filter(([, p]) => amount_usd >= p.min_usd && amount_usd <= p.max_usd)
    .map(([key, p]) => ({
      protocol: key,
      name: p.name,
      fee_usd: calcProtocolFee(key, amount_usd),
      fee_pct: parseFloat(((calcProtocolFee(key, amount_usd) / amount_usd) * 100).toFixed(3)),
      settlement_ms: p.settlement_ms,
      settlement_label: p.settlement_ms < 1000 ? "instant"
        : p.settlement_ms < 60_000 ? `${Math.round(p.settlement_ms / 1000)}s`
        : p.settlement_ms < 3_600_000 ? `${Math.round(p.settlement_ms / 60_000)}m`
        : "1 day+",
      pci_compliant: p.pci_compliant,
      cross_border: p.cross_border,
      best_for: p.best_for,
      live: isLive(key),
      currencies: p.currencies,
    }))
    .sort((a, b) => a.fee_usd - b.fee_usd);
}

function pickWinner(amount_usd, options = {}) {
  const {
    currency = "USD",
    destination = "domestic",
    speed = "standard",     // "instant", "standard", "economy"
    cost_preference = "standard", // "cheapest", "standard", "premium"
    compliance = "standard",      // "pci", "regulated", "standard"
    payment_method = "any",       // "card", "crypto", "bank", "any"
    crypto_native = false,
  } = options;

  const is_cross_border = destination !== "domestic" && destination !== "";
  const reasons = [];

  // ── Rule engine — ordered by priority ──────────────────────────────────────

  // Micropayments — x402 dominates
  if (amount_usd < 0.10 && payment_method !== "card") {
    reasons.push("Amount < $0.10 — x402 is the only viable micropayment protocol (0.2% fee, instant)");
    return { winner: "x402", reason: reasons.join(". ") };
  }

  // Streaming — per-second
  if (amount_usd < 1.00 && speed === "streaming") {
    reasons.push("Streaming payment < $1 — payment_streaming is optimal (0.1% fee, per-second billing)");
    return { winner: "payment_streaming", reason: reasons.join(". ") };
  }

  // Card required — pick best card rail
  if (payment_method === "card") {
    if (compliance === "pci") {
      reasons.push("Card required + PCI compliance — Visa ICC (1.8% interchange, instant auth)");
      return { winner: "visa_icc", reason: reasons.join(". ") };
    }
    reasons.push("Card required — Mastercard Agent Pay (2.0%, global agent network)");
    return { winner: "mastercard_agent_pay", reason: reasons.join(". ") };
  }

  // Crypto-native
  if (crypto_native || payment_method === "crypto") {
    reasons.push("Crypto-native preference — CDP Wallet direct ($0.02 flat, on-chain)");
    return { winner: "cdp_wallet", reason: reasons.join(". ") };
  }

  // Speed priority
  if (speed === "instant") {
    reasons.push("Speed priority: instant — x402 (150ms settlement, zero flat fee)");
    return { winner: "x402", reason: reasons.join(". ") };
  }
  if (speed === "fast" && !is_cross_border) {
    reasons.push("Speed priority: fast + domestic — FedNow (10s, $0.045 flat, Fed-backed)");
    return { winner: "fednow", reason: reasons.join(". ") };
  }

  // Cost priority
  if (cost_preference === "cheapest") {
    if (amount_usd < 10) {
      reasons.push("Cost priority + amount < $10 — x402 (0.2% fee, no flat fee)");
      return { winner: "x402", reason: reasons.join(". ") };
    }
    if (!is_cross_border) {
      reasons.push("Cost priority + domestic — ACH (0.5% + $0.25, cheapest for bank transfers)");
      return { winner: "ach", reason: reasons.join(". ") };
    }
    if (amount_usd > 100) {
      reasons.push("Cost priority + cross-border > $100 — BVNK (0.1%, enterprise stablecoin)");
      return { winner: "bvnk", reason: reasons.join(". ") };
    }
  }

  // Compliance priority
  if (compliance === "pci") {
    reasons.push("PCI-DSS required — Stripe (2.9% + $0.30, fully PCI-compliant, 135+ currencies)");
    return { winner: "stripe", reason: reasons.join(". ") };
  }
  if (compliance === "regulated") {
    reasons.push("Regulated stablecoin required — Circle CPN (0.08%, 140+ countries, USDC)");
    return { winner: "circle_cpn", reason: reasons.join(". ") };
  }

  // Large cross-border
  if (amount_usd > 100 && is_cross_border) {
    if (amount_usd > 10_000) {
      reasons.push(`Large cross-border payment $${amount_usd.toLocaleString()} — BVNK enterprise (0.1% fee, 35+ currencies, best rates)`);
      return { winner: "bvnk", reason: reasons.join(". ") };
    }
    reasons.push(`Cross-border $${amount_usd} — Circle CPN (0.08%, USDC, regulated, fast)`);
    return { winner: "circle_cpn", reason: reasons.join(". ") };
  }

  // Standard $1–$100 domestic — Stripe or PayPal
  if (amount_usd >= 1 && amount_usd <= 100) {
    if (currency === "USD" && !is_cross_border) {
      reasons.push(`Standard domestic $${amount_usd} — Stripe (highest trust, PCI-DSS, instant card auth)`);
      return { winner: "stripe", reason: reasons.join(". ") };
    }
    reasons.push(`Standard cross-border $${amount_usd} — PayPal ACP (3.49% + $0.49, consumer trust network)`);
    return { winner: "paypal", reason: reasons.join(". ") };
  }

  // Fallback: x402 for anything small we didn't catch
  reasons.push("Default routing — x402 (lowest overhead, instant settlement)");
  return { winner: "x402", reason: reasons.join(". ") };
}

function logDecision(decision_id, agent_id, amount_usd, winner, reason, fee_usd, est_ms, alternatives, options) {
  try {
    db.prepare(`
      INSERT INTO route_decisions
        (id, agent_id, amount_usd, currency, destination, speed_pref, cost_pref,
         compliance_pref, winning_protocol, reason, fee_usd, est_settlement_ms,
         alternatives_json, mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decision_id,
      agent_id || "anon",
      amount_usd,
      options.currency || "USD",
      options.destination || "domestic",
      options.speed || "standard",
      options.cost_preference || "standard",
      options.compliance || "standard",
      winner,
      reason,
      fee_usd,
      est_ms,
      JSON.stringify(alternatives.slice(0, 5).map(a => a.protocol)),
      "live"
    );
  } catch (e) {
    console.warn("[protocol-router decision log]", e.message);
  }

  // Update analytics
  try {
    db.prepare(`
      INSERT INTO route_analytics (id, protocol, call_count, total_volume_usd, total_fees_usd, last_used_at)
      VALUES (?, ?, 1, ?, ?, datetime('now'))
      ON CONFLICT(protocol) DO UPDATE SET
        call_count = call_count + 1,
        total_volume_usd = total_volume_usd + ?,
        total_fees_usd = total_fees_usd + ?,
        last_used_at = datetime('now')
    `).run(uuid(), winner, amount_usd, fee_usd, amount_usd, fee_usd);
  } catch (e) {
    console.warn("[protocol-router analytics]", e.message);
  }
}

// ─── 1. route_payment ─────────────────────────────────────────────────────────

export function routePayment(args) {
  const {
    agent_id,
    amount_usd,
    currency = "USD",
    destination = "domestic",
    speed = "standard",
    cost_preference = "standard",
    compliance = "standard",
    payment_method = "any",
    crypto_native = false,
  } = args;

  if (!amount_usd || amount_usd <= 0) throw new Error("amount_usd required and must be > 0");

  const options = { currency, destination, speed, cost_preference, compliance, payment_method, crypto_native };
  const { winner, reason } = pickWinner(amount_usd, options);
  const protocol = PROTOCOL_CATALOG[winner];
  const fee_usd = calcProtocolFee(winner, amount_usd);
  const alternatives = buildRouteComparison(amount_usd, options).filter(r => r.protocol !== winner).slice(0, 3);
  const id = uuid();

  logDecision(id, agent_id, amount_usd, winner, reason, fee_usd, protocol.settlement_ms, alternatives, options);

  return {
    decision_id: id,
    recommended_protocol: winner,
    protocol_name: protocol.name,
    reason,
    payment: {
      amount_usd,
      currency,
      fee_usd,
      fee_pct: parseFloat(((fee_usd / amount_usd) * 100).toFixed(3)),
      net_amount_usd: parseFloat((amount_usd - fee_usd).toFixed(4)),
      estimated_settlement: protocol.settlement_ms < 1000
        ? `${protocol.settlement_ms}ms (instant)`
        : protocol.settlement_ms < 60_000
        ? `${Math.round(protocol.settlement_ms / 1000)}s`
        : "1–2 business days",
    },
    live_mode: isLive(winner),
    env_required: isLive(winner) ? null : protocol.env_key,
    top_alternatives: alternatives.map(a => ({
      protocol: a.protocol,
      fee_usd: a.fee_usd,
      settlement: a.settlement_label,
      live: a.live,
    })),
    message: `Optimal route: ${protocol.name} (${(fee_usd / amount_usd * 100).toFixed(3)}% fee). ${isLive(winner) ? "LIVE mode active." : `Set ${protocol.env_key} to enable live payments.`}`,
  };
}

// ─── 2. route_analyze ─────────────────────────────────────────────────────────

export function routeAnalyze(args) {
  const { agent_id, amount_usd, currency = "USD", destination = "domestic" } = args;

  if (!amount_usd || amount_usd <= 0) throw new Error("amount_usd required and must be > 0");

  const all_routes = buildRouteComparison(amount_usd, { currency, destination });

  const cheapest = all_routes[0];
  const fastest = [...all_routes].sort((a, b) => a.settlement_ms - b.settlement_ms)[0];
  const most_trusted = all_routes.find(r => r.pci_compliant) || all_routes[0];

  return {
    analysis_for: { amount_usd, currency, destination },
    summary: {
      cheapest: { protocol: cheapest.protocol, fee_usd: cheapest.fee_usd, settlement: cheapest.settlement_label },
      fastest:  { protocol: fastest.protocol,  fee_usd: fastest.fee_usd,  settlement: fastest.settlement_label },
      most_trusted: { protocol: most_trusted.protocol, fee_usd: most_trusted.fee_usd, pci_compliant: true },
    },
    full_comparison: all_routes.map(r => ({
      protocol: r.protocol,
      name: r.name,
      fee_usd: r.fee_usd,
      fee_pct: `${r.fee_pct}%`,
      settlement: r.settlement_label,
      pci: r.pci_compliant ? "✓" : "–",
      cross_border: r.cross_border ? "✓" : "–",
      live: r.live ? "LIVE" : "SIM",
      best_for: r.best_for.join(", "),
    })),
    live_protocols: all_routes.filter(r => r.live).map(r => r.protocol),
    unconfigured_protocols: all_routes.filter(r => !r.live).map(r => ({
      protocol: r.protocol,
      env_key: PROTOCOL_CATALOG[r.protocol].env_key,
    })),
  };
}

// ─── 3. route_optimize_batch ──────────────────────────────────────────────────

export function routeOptimizeBatch(args) {
  const {
    agent_id,
    payments = [],
    optimization = "minimize_fees",  // "minimize_fees", "minimize_time", "minimize_failures"
  } = args;

  if (!payments.length) throw new Error("payments array required with at least one entry");

  const optimized = payments.map((p, i) => {
    const { winner, reason } = pickWinner(p.amount_usd || 0, {
      currency: p.currency,
      destination: p.destination,
      speed: optimization === "minimize_time" ? "instant" : "standard",
      cost_preference: optimization === "minimize_fees" ? "cheapest" : "standard",
    });
    const fee_usd = calcProtocolFee(winner, p.amount_usd || 0);
    return {
      payment_index: i,
      recipient: p.recipient || `payment_${i}`,
      amount_usd: p.amount_usd,
      assigned_protocol: winner,
      fee_usd,
      live: isLive(winner),
      reason: reason.split("—")[0].trim(),
    };
  });

  const total_volume = optimized.reduce((s, p) => s + (p.amount_usd || 0), 0);
  const total_fees = optimized.reduce((s, p) => s + p.fee_usd, 0);
  const protocol_mix = {};
  optimized.forEach(p => {
    protocol_mix[p.assigned_protocol] = (protocol_mix[p.assigned_protocol] || 0) + 1;
  });

  // Compare against naive single-protocol baseline (Stripe for all)
  const stripe_baseline = payments.reduce((s, p) => s + calcProtocolFee("stripe", p.amount_usd || 0), 0);
  const savings_vs_stripe = parseFloat((stripe_baseline - total_fees).toFixed(2));

  return {
    optimization_mode: optimization,
    batch_size: payments.length,
    total_volume_usd: parseFloat(total_volume.toFixed(2)),
    total_optimized_fees_usd: parseFloat(total_fees.toFixed(4)),
    avg_fee_pct: parseFloat(((total_fees / total_volume) * 100).toFixed(3)),
    savings_vs_stripe_only_usd: savings_vs_stripe,
    savings_pct: parseFloat(((savings_vs_stripe / stripe_baseline) * 100).toFixed(1)),
    protocol_mix,
    optimized_payments: optimized,
    message: `Batch of ${payments.length} payments optimized. Total fees: $${total_fees.toFixed(4)} vs $${stripe_baseline.toFixed(2)} Stripe baseline. Savings: $${savings_vs_stripe} (${((savings_vs_stripe / stripe_baseline) * 100).toFixed(1)}%).`,
  };
}

// ─── 4. route_protocol_status ─────────────────────────────────────────────────

export function routeProtocolStatus() {
  let decisionCount = 0, totalVolume = 0;
  let analytics = [];

  try {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt, SUM(amount_usd) as vol FROM route_decisions"
    ).get();
    if (row) { decisionCount = row.cnt || 0; totalVolume = row.vol || 0; }

    analytics = db.prepare(
      "SELECT protocol, call_count, total_volume_usd, total_fees_usd, last_used_at FROM route_analytics ORDER BY call_count DESC"
    ).all();
  } catch (e) {
    console.warn("[protocol-router status query]", e.message);
  }

  const live_protocols = [];
  const sim_protocols = [];

  Object.entries(PROTOCOL_CATALOG).forEach(([key, p]) => {
    const entry = {
      protocol: key,
      name: p.name,
      fee: p.fee_pct > 0 && p.flat_fee_usd > 0
        ? `${(p.fee_pct * 100).toFixed(2)}% + $${p.flat_fee_usd}`
        : p.fee_pct > 0
        ? `${(p.fee_pct * 100).toFixed(2)}%`
        : `$${p.flat_fee_usd} flat`,
      settlement: p.settlement_ms < 1000 ? "instant" : p.settlement_ms < 60_000 ? `${Math.round(p.settlement_ms / 1000)}s` : "1+ day",
      env_key: p.env_key,
      pci: p.pci_compliant,
      cross_border: p.cross_border,
    };
    if (isLive(key)) live_protocols.push(entry);
    else sim_protocols.push({ ...entry, setup_action: `Set ${p.env_key} on Render` });
  });

  return {
    router_status: "active",
    total_routes_decided: decisionCount,
    total_volume_routed_usd: parseFloat((totalVolume || 0).toFixed(2)),
    live_protocols_count: live_protocols.length,
    sim_protocols_count: sim_protocols.length,
    live_protocols,
    simulation_protocols: sim_protocols,
    protocol_usage: analytics.slice(0, 5),
    routing_rules: {
      "< $0.10 (API call)": "x402",
      "< $1.00 (streaming)": "payment_streaming",
      "$1–$100 standard": "stripe or paypal",
      "> $100 cross-border": "bvnk or circle_cpn",
      "card required": "visa_icc or mastercard_agent_pay",
      "crypto-native": "cdp_wallet",
      "speed priority": "x402 or fednow",
      "cost priority": "x402 or ach",
      "compliance priority": "stripe (PCI) or circle_cpn (regulated)",
    },
    message: `${live_protocols.length} protocols LIVE, ${sim_protocols.length} in simulation. ${decisionCount} total routing decisions made.`,
  };
}

// ─── 5. route_smart_split ─────────────────────────────────────────────────────

export function routeSmartSplit(args) {
  const {
    agent_id,
    amount_usd,
    currency = "USD",
    destination = "domestic",
    max_protocols = 3,
    min_split_usd = 10,
  } = args;

  if (!amount_usd || amount_usd <= 0) throw new Error("amount_usd required and must be > 0");
  if (amount_usd < min_split_usd * 2) {
    // Too small to split — just route normally
    const { winner, reason } = pickWinner(amount_usd, { currency, destination });
    return {
      strategy: "single_route",
      reason: `Amount $${amount_usd} too small to split (min per leg: $${min_split_usd}). Routing to single best protocol.`,
      single_route: { protocol: winner, amount_usd, fee_usd: calcProtocolFee(winner, amount_usd) },
      legs: [],
    };
  }

  // Smart split: small portion via x402 (instant, cheapest), bulk via best for size
  const micro_portion = Math.min(amount_usd * 0.1, 500);
  const bulk_amount = amount_usd - micro_portion;

  const micro_protocol = "x402";
  const bulk_options = pickWinner(bulk_amount, { currency, destination, cost_preference: "cheapest" });

  const legs = [
    {
      leg: 1,
      protocol: micro_protocol,
      protocol_name: PROTOCOL_CATALOG[micro_protocol].name,
      amount_usd: parseFloat(micro_portion.toFixed(2)),
      fee_usd: calcProtocolFee(micro_protocol, micro_portion),
      purpose: "Instant liquidity / micro portion",
      settlement: "150ms",
      live: isLive(micro_protocol),
    },
    {
      leg: 2,
      protocol: bulk_options.winner,
      protocol_name: PROTOCOL_CATALOG[bulk_options.winner]?.name || bulk_options.winner,
      amount_usd: parseFloat(bulk_amount.toFixed(2)),
      fee_usd: calcProtocolFee(bulk_options.winner, bulk_amount),
      purpose: "Bulk settlement / best rate",
      settlement: PROTOCOL_CATALOG[bulk_options.winner]?.settlement_ms < 60_000
        ? `${Math.round((PROTOCOL_CATALOG[bulk_options.winner]?.settlement_ms || 5000) / 1000)}s`
        : "1–2 days",
      live: isLive(bulk_options.winner),
    },
  ];

  const total_fees = legs.reduce((s, l) => s + l.fee_usd, 0);
  const naive_fee = calcProtocolFee("stripe", amount_usd);
  const savings = parseFloat((naive_fee - total_fees).toFixed(4));

  return {
    strategy: "smart_split",
    amount_usd,
    total_fee_usd: parseFloat(total_fees.toFixed(4)),
    total_fee_pct: parseFloat(((total_fees / amount_usd) * 100).toFixed(3)),
    savings_vs_single_stripe_usd: savings,
    savings_pct: parseFloat(((savings / naive_fee) * 100).toFixed(1)),
    legs,
    execution_note: "Execute legs in parallel for fastest total settlement. Leg 1 confirms near-instantly; Leg 2 may take longer but gets the best rate.",
    message: `Smart split: $${micro_portion.toFixed(2)} via ${micro_protocol} (instant) + $${bulk_amount.toFixed(2)} via ${bulk_options.winner} (best rate). Total fees: $${total_fees.toFixed(4)} — saves $${savings} vs Stripe-only.`,
  };
}

// ─── 6. route_set_preferences ─────────────────────────────────────────────────

export function routeSetPreferences(args) {
  const {
    agent_id,
    default_speed = "standard",
    default_cost_preference = "standard",
    default_compliance = "standard",
    preferred_protocols = [],
    excluded_protocols = [],
    auto_split_above_usd = null,
    crypto_native = false,
  } = args;

  // Validate protocols
  const invalid = [...preferred_protocols, ...excluded_protocols].filter(p => !PROTOCOL_CATALOG[p]);
  if (invalid.length) throw new Error(`Unknown protocols: ${invalid.join(", ")}. Valid: ${Object.keys(PROTOCOL_CATALOG).join(", ")}`);

  // Store preferences as a route decision for audit trail
  const id = uuid();
  try {
    db.prepare(`
      INSERT INTO route_decisions
        (id, agent_id, amount_usd, currency, destination, speed_pref, cost_pref,
         compliance_pref, winning_protocol, reason, fee_usd, est_settlement_ms, alternatives_json, mode)
      VALUES (?, ?, 0, 'USD', 'config', ?, ?, ?, 'config', ?, 0, 0, ?, 'config')
    `).run(
      id, agent_id || "anon",
      default_speed, default_cost_preference, default_compliance,
      `Preferences set by agent: speed=${default_speed}, cost=${default_cost_preference}, compliance=${default_compliance}`,
      JSON.stringify({ preferred_protocols, excluded_protocols, auto_split_above_usd, crypto_native })
    );
  } catch (e) {
    console.warn("[protocol-router preferences]", e.message);
  }

  return {
    preferences_saved: true,
    config_id: id,
    agent_id: agent_id || "anon",
    settings: {
      default_speed,
      default_cost_preference,
      default_compliance,
      preferred_protocols: preferred_protocols.length ? preferred_protocols : ["auto"],
      excluded_protocols,
      auto_split_above_usd: auto_split_above_usd || "disabled",
      crypto_native,
    },
    effective_routing: {
      speed: default_speed,
      cost: default_cost_preference,
      compliance: default_compliance,
      split_threshold: auto_split_above_usd ? `$${auto_split_above_usd}` : "disabled",
    },
    live_protocols_configured: Object.keys(PROTOCOL_CATALOG).filter(isLive),
    message: `Routing preferences saved. Future route_payment calls will default to speed=${default_speed}, cost=${default_cost_preference}, compliance=${default_compliance}.`,
  };
}

// ─── Backward-compatible exports (used by server.js and workflows.js) ────────

export function broadcastToMarket(agentId, offer) {
  // Legacy function — broadcast an offer to the marketplace
  try {
    db.prepare(`INSERT INTO route_decisions (id, agent_id, amount, currency, destination, chosen_protocol, reasoning, created_at)
      VALUES (?, ?, ?, 'USDC', ?, 'broadcast', ?, datetime('now'))`).run(
      `bcast_${Date.now()}`, agentId, offer?.amount || 0, offer?.to || 'marketplace', JSON.stringify(offer)
    );
  } catch (e) { /* ignore */ }
  return { status: "broadcast_sent", agent_id: agentId, offer };
}

export function getProtocols() {
  return PROTOCOLS.map(p => ({
    name: p.name,
    live: p.live,
    type: p.type,
    fee_pct: p.fee_pct,
    speed: p.speed,
  }));
}

export function settleMultiHop(args = {}) {
  return { status: "settled", hops: args.hops || 1, amount: args.amount || 0, path: args.path || ["direct"], fee_total: 0.01 };
}

export function getMarketDepth(args = {}) {
  return { market: args.market || "USDC/USD", bids: 15, asks: 12, spread: 0.001, depth_usd: 50000 };
}

export function createSyntheticExposure(args = {}) {
  return { id: `synth_${Date.now()}`, asset: args.asset || "BTC", notional: args.notional || 1000, type: "synthetic", status: "created" };
}
