/**
 * HiveAgent MCP Tools — Circle App Kits + Intelligent Protocol Router
 *
 * 11 tools total:
 *
 * ── Circle App Kits (5) ──────────────────────────────────────────────────────
 *   circle_bridge           — Cross-chain USDC via CCTP V2 (6 chains, <30s)
 *   circle_swap             — Token swaps without managing liquidity providers
 *   circle_send             — Same-chain USDC transfers with receipts
 *   circle_revenue_config   — Configure revenue sharing on all transactions
 *   circle_appkits_status   — Connection status, chains, fee structure, totals
 *
 * ── Intelligent Protocol Router (6) ─────────────────────────────────────────
 *   route_payment           — Pick the optimal protocol for any payment
 *   route_analyze           — Full comparison table: cost/speed/trust/live
 *   route_optimize_batch    — Minimize fees across a batch of payments
 *   route_protocol_status   — Live vs sim protocols, real-time fee estimates
 *   route_smart_split       — Split large payments across protocols (like SOR)
 *   route_set_preferences   — Set default routing preferences for an agent
 *
 * Why these go together:
 *   Circle handles the USDC/stablecoin layer (bridge, swap, send).
 *   The Protocol Router handles the meta-layer above — deciding WHICH protocol
 *   to use based on amount, speed, compliance, and cost. The router can route
 *   TO Circle App Kits when it's the optimal choice, alongside Stripe, PayPal,
 *   x402, BVNK, Visa ICC, Mastercard Agent Pay, FedNow, ACH, and CDP Wallet.
 */

import {
  circleBridge,
  circleSwap,
  circleSend,
  circleRevenueConfig,
  circleAppkitsStatus,
} from "./services/circle-appkits.js";

import {
  routePayment,
  routeAnalyze,
  routeOptimizeBatch,
  routeProtocolStatus,
  routeSmartSplit,
  routeSetPreferences,
} from "./services/protocol-router.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const circleRouterTools = [

  // ── Circle App Kits ────────────────────────────────────────────────────────

  {
    name: "circle_bridge",
    description: "Bridge USDC cross-chain via Circle's CCTP V2 — the fastest USDC bridge available. Supports Ethereum, Base, Arbitrum, Polygon, Solana, Avalanche, and Noble. Transfers confirm in 6–25 seconds depending on chain. Built-in revenue sharing: HiveAgent earns 0.05% of bridged volume. In live mode (CIRCLE_APPKITS_API_KEY required), executes real CCTP V2 transfers. In simulation, returns realistic tx hashes, fees, and timing. Use this instead of generic bridge protocols — CCTP V2 is purpose-built for USDC with no slippage or liquidity risk.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string",  description: "Your agent's unique identifier" },
        from_chain:  { type: "string",  description: "Source chain", enum: ["ethereum", "base", "arbitrum", "polygon", "solana", "avalanche", "noble"] },
        to_chain:    { type: "string",  description: "Destination chain", enum: ["ethereum", "base", "arbitrum", "polygon", "solana", "avalanche", "noble"] },
        amount_usdc: { type: "number",  description: "Amount of USDC to bridge (e.g. 100.00)" },
      },
      required: ["amount_usdc"],
    },
  },

  {
    name: "circle_swap",
    description: "Swap tokens without managing liquidity providers — Circle's Swap SDK routes to the best available AMM/aggregator automatically. No slippage surprises, no MEV attacks, no LP position management. Supports USDC, ETH, BTC, MATIC, SOL, EURC, ARB, AVAX, and more. Returns exact output amount, price impact, and fee breakdown. Revenue sharing: HiveAgent earns 0.05% of swap volume. Set CIRCLE_APPKITS_API_KEY for live execution.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string",  description: "Your agent's unique identifier" },
        from_token:   { type: "string",  description: "Token to swap from (e.g. 'USDC', 'ETH', 'MATIC')" },
        to_token:     { type: "string",  description: "Token to swap to (e.g. 'ETH', 'USDC', 'SOL')" },
        chain:        { type: "string",  description: "Chain to execute swap on", enum: ["base", "ethereum", "arbitrum", "polygon", "solana", "avalanche"] },
        input_amount: { type: "number",  description: "Amount of from_token to swap" },
        slippage_pct: { type: "number",  description: "Max slippage tolerance in percent (default: 0.5)", default: 0.5 },
      },
      required: ["from_token", "to_token", "input_amount"],
    },
  },

  {
    name: "circle_send",
    description: "Send USDC same-chain to any wallet address or ENS name. Returns a transaction hash and receipt. Gas fees are paid in USDC (no ETH needed on supported chains). Supports Base, Ethereum, Arbitrum, Polygon, Solana, and Avalanche. HiveAgent earns 0.05% of sent volume as orchestration revenue. Use for agent-to-agent payments, escrow releases, or direct transfers. Set CIRCLE_APPKITS_API_KEY for live execution.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string",  description: "Your agent's unique identifier" },
        to_address:   { type: "string",  description: "Destination wallet address or ENS name (e.g. '0xabc...', 'vitalik.eth')" },
        chain:        { type: "string",  description: "Chain to send on", enum: ["base", "ethereum", "arbitrum", "polygon", "solana", "avalanche"] },
        amount_usdc:  { type: "number",  description: "Amount of USDC to send" },
        memo:         { type: "string",  description: "Optional transfer memo or reference" },
        from_address: { type: "string",  description: "Optional sender address override (uses agent default if omitted)" },
      },
      required: ["to_address", "amount_usdc"],
    },
  },

  {
    name: "circle_revenue_config",
    description: "Configure revenue sharing on your agent's Circle App Kits transactions. Circle's built-in monetization layer lets you take a cut of every bridge, swap, and send your agent orchestrates — no custom fee logic needed. Set operator_cut_pct (0–2%) and a payout_address to receive USDC. Returns current revenue stats and projected monthly earnings. This is the easiest way to monetize an agent that moves USDC for users.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:          { type: "string",  description: "Your agent's unique identifier" },
        operator_cut_pct:  { type: "number",  description: "Your revenue cut as % of transaction volume (0–2%, e.g. 0.1 for 0.1%)", default: 0.1 },
        apply_to:          { type: "array",   items: { type: "string", enum: ["bridge", "swap", "send"] }, description: "Which operations to apply revenue share to (default: all three)" },
        payout_address:    { type: "string",  description: "USDC wallet address to receive your revenue share" },
      },
      required: [],
    },
  },

  {
    name: "circle_appkits_status",
    description: "Get Circle App Kits integration status: which mode (live vs simulation), supported chains, CCTP V2 fee schedule, recent activity, and total platform revenue. Shows whether CIRCLE_APPKITS_API_KEY is configured and what to do to go live. Use to confirm your bridge/swap/send capabilities before executing a payment workflow.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Intelligent Protocol Router ────────────────────────────────────────────

  {
    name: "route_payment",
    description: "THE intelligent payment router. Give it a payment intent (amount, speed, cost preference, destination, compliance needs) and it picks the OPTIMAL protocol — automatically. Routing logic: < $0.10 → x402 (instant, cheapest), < $1 streaming → payment_streaming, $1–$100 standard → Stripe/PayPal (highest trust), > $100 cross-border → BVNK/Circle CPN (best rates), card required → Visa ICC or Mastercard Agent Pay, speed priority → x402 or FedNow, compliance priority → Stripe (PCI). Returns the winning protocol, reason, fee breakdown, and top alternatives. This is what Circle can't do (only knows USDC) and Tether can't do (only knows USDT).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:         { type: "string",  description: "Your agent's unique identifier" },
        amount_usd:       { type: "number",  description: "Payment amount in USD equivalent" },
        currency:         { type: "string",  description: "Preferred currency (e.g. 'USD', 'USDC', 'EUR')", default: "USD" },
        destination:      { type: "string",  description: "Payment destination: 'domestic' (US), 'cross_border' (international), or country code (e.g. 'MX', 'DE')", default: "domestic" },
        speed:            { type: "string",  description: "Settlement speed priority", enum: ["instant", "fast", "standard", "economy", "streaming"], default: "standard" },
        cost_preference:  { type: "string",  description: "Cost vs trust tradeoff", enum: ["cheapest", "standard", "premium"], default: "standard" },
        compliance:       { type: "string",  description: "Compliance requirement", enum: ["pci", "regulated", "standard"], default: "standard" },
        payment_method:   { type: "string",  description: "Payment method constraint", enum: ["card", "crypto", "bank", "any"], default: "any" },
        crypto_native:    { type: "boolean", description: "Set true if recipient is a crypto wallet (routes to CDP Wallet direct)", default: false },
      },
      required: ["amount_usd"],
    },
  },

  {
    name: "route_analyze",
    description: "Analyze a payment and see ALL available protocol routes with a full comparison table: cost, speed, PCI compliance, cross-border capability, and live/simulation status. Returns cheapest, fastest, and most trusted options at a glance — plus full ranked list. Use before route_payment when you want to understand all options, or when you have a complex payment and want to see the full trade-off landscape.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string",  description: "Your agent's unique identifier" },
        amount_usd:  { type: "number",  description: "Payment amount in USD" },
        currency:    { type: "string",  description: "Payment currency (e.g. 'USD', 'USDC', 'EUR')", default: "USD" },
        destination: { type: "string",  description: "Payment destination: 'domestic' or 'cross_border'", default: "domestic" },
      },
      required: ["amount_usd"],
    },
  },

  {
    name: "route_optimize_batch",
    description: "Optimize a batch of payments to minimize total fees (or total time). Each payment in the batch gets assigned the optimal protocol individually — so a $5 payment might go via x402 while a $50,000 cross-border transfer goes via BVNK. Returns total savings vs. using Stripe for everything, plus the per-payment routing breakdown. Like smart order routing (SOR) in trading, but for payments. Essential for agents that process many payments per day.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string",  description: "Your agent's unique identifier" },
        payments:     {
          type: "array",
          description: "Array of payments to optimize",
          items: {
            type: "object",
            properties: {
              recipient:   { type: "string",  description: "Payment recipient name or address" },
              amount_usd:  { type: "number",  description: "Payment amount in USD" },
              currency:    { type: "string",  description: "Payment currency" },
              destination: { type: "string",  description: "domestic or cross_border" },
            },
            required: ["amount_usd"],
          },
        },
        optimization: { type: "string",  description: "Optimization target", enum: ["minimize_fees", "minimize_time", "minimize_failures"], default: "minimize_fees" },
      },
      required: ["payments"],
    },
  },

  {
    name: "route_protocol_status",
    description: "Show which payment protocols are LIVE (env key configured) vs SIMULATION (env key missing), with real-time fee estimates for each. Lists all 11 protocols: x402, payment_streaming, Stripe, PayPal, BVNK, Circle CPN, CDP Wallet, Visa ICC, Mastercard Agent Pay, FedNow, and ACH. Also shows routing rules and historical usage stats. Use this to see which protocols are ready to use and which need setup.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "route_smart_split",
    description: "Split a large payment across multiple protocols for optimal execution — like smart order routing in trading. Automatically divides the payment into legs: typically a small instant portion via x402 (150ms) and a bulk portion via the cheapest rate protocol for the amount. Returns per-leg breakdown, total fees, and savings vs. single-protocol routing. Use for payments above ~$1,000 where splitting reduces fees and manages settlement risk.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string",  description: "Your agent's unique identifier" },
        amount_usd:     { type: "number",  description: "Total payment amount to split" },
        currency:       { type: "string",  description: "Payment currency", default: "USD" },
        destination:    { type: "string",  description: "Payment destination: 'domestic' or 'cross_border'", default: "domestic" },
        max_protocols:  { type: "integer", description: "Maximum number of split legs (default: 3)", default: 3 },
        min_split_usd:  { type: "number",  description: "Minimum amount per leg in USD (default: $10)", default: 10 },
      },
      required: ["amount_usd"],
    },
  },

  {
    name: "route_set_preferences",
    description: "Set default routing preferences for an agent so every subsequent route_payment call inherits these defaults without needing to specify them each time. Configure: default speed (instant/standard/economy), cost preference (cheapest/standard/premium), compliance level (pci/regulated/standard), preferred protocols, excluded protocols, auto-split threshold, and crypto-native mode. Preferences are saved per agent_id and applied to all future routing decisions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:              { type: "string",  description: "Your agent's unique identifier" },
        default_speed:         { type: "string",  description: "Default settlement speed", enum: ["instant", "fast", "standard", "economy"], default: "standard" },
        default_cost_preference: { type: "string", description: "Default cost/trust tradeoff", enum: ["cheapest", "standard", "premium"], default: "standard" },
        default_compliance:    { type: "string",  description: "Default compliance level", enum: ["pci", "regulated", "standard"], default: "standard" },
        preferred_protocols:   { type: "array",   items: { type: "string" }, description: "Protocols to prefer when equally optimal (e.g. ['x402', 'stripe'])" },
        excluded_protocols:    { type: "array",   items: { type: "string" }, description: "Protocols to never use (e.g. ['ach'] to avoid 1-day settlement)" },
        auto_split_above_usd:  { type: "number",  description: "Auto-split payments above this USD amount across multiple protocols (e.g. 1000)" },
        crypto_native:         { type: "boolean", description: "Default to crypto-native routing (CDP Wallet) when true", default: false },
      },
      required: [],
    },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleCircleRouterTool(name, args = {}) {
  switch (name) {

    // ── Circle App Kits ────────────────────────────────────────────────────
    case "circle_bridge":          return await circleBridge(args);
    case "circle_swap":            return await circleSwap(args);
    case "circle_send":            return await circleSend(args);
    case "circle_revenue_config":  return await circleRevenueConfig(args);
    case "circle_appkits_status":  return circleAppkitsStatus();

    // ── Intelligent Protocol Router ────────────────────────────────────────
    case "route_payment":          return routePayment(args);
    case "route_analyze":          return routeAnalyze(args);
    case "route_optimize_batch":   return routeOptimizeBatch(args);
    case "route_protocol_status":  return routeProtocolStatus();
    case "route_smart_split":      return routeSmartSplit(args);
    case "route_set_preferences":  return routeSetPreferences(args);

    default:
      throw new Error(`Unknown Circle/Router tool: ${name}`);
  }
}
