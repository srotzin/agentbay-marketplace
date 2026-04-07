/**
 * HiveAgent MCP Tool Definitions — Phase 12
 *
 * Universal Payment Hub — the most frictionless payment experience any agent
 * has ever seen. One entry point for every stablecoin, every chain, every method.
 *
 * Two modules, 17 tools total:
 *
 *   universal-payments (10 tools):
 *     pay_universal         — pay anything, anywhere, any currency
 *     pay_get_quote         — real-time quote with fee/rate breakdown
 *     pay_swap              — instant stablecoin↔stablecoin swap
 *     pay_onramp            — fiat → crypto (12 currencies, 4 methods)
 *     pay_offramp           — crypto → fiat bank withdrawal
 *     pay_supported_currencies — full currency catalog with chain/method matrix
 *     pay_supported_methods    — payment method directory with fees & speeds
 *     pay_history           — full transaction history with analytics
 *     pay_create_invoice    — create a payable invoice with QR + link
 *     pay_check_status      — check any payment or invoice status
 *
 *   payment-incentives (7 tools):
 *     incentive_welcome_bonus  — 5 USDC free for new agents
 *     incentive_referral_code  — generate shareable referral code (2.50 USDC/referral)
 *     incentive_redeem_referral — redeem a referral code
 *     incentive_volume_discount — check tier & discount (up to 25% off)
 *     incentive_loyalty_rewards — points balance, catalog, redemption history
 *     incentive_stake           — stake USDC for APY + perks
 *     incentive_dashboard       — full incentives summary in one call
 *
 * Exports:
 *   phase12Tools                    — Array of 17 MCP tool definitions
 *   handlePhase12Tool(name, args)   — Dispatcher function
 */

import {
  pay,
  getQuote,
  swap,
  onramp,
  offramp,
  getSupportedCurrencies,
  getSupportedMethods,
  getPaymentHistory,
  createInvoice,
  checkPaymentStatus,
} from "./services/universal-payments.js";

import {
  getWelcomeBonus,
  getReferralCode,
  redeemReferral,
  getVolumeDiscount,
  getLoyaltyRewards,
  stakeForBenefits,
  getIncentiveDashboard,
} from "./services/payment-incentives.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase12Tools = [

  // ── Universal Payments ──────────────────────────────────────────────────────

  {
    name: "pay_universal",
    description: "Use when you need to pay for anything — any stablecoin (USDC, USDT, DAI, PYUSD, Paxos, FRAX), any chain (Base, Ethereum, Polygon, Solana, Arbitrum, Optimism, Avalanche), any method (crypto, card, ACH, PayPal, Apple Pay). One call, auto-routes to cheapest option. Returns tx_id, status, fee, settlement_time, and receipt_url.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Amount to pay (e.g. 100.00)",
        },
        currency: {
          type: "string",
          description: "Payment currency",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","BUSD","FRAX","LUSD","EURC","GBPc","XSGD","USD","EUR","GBP","BTC"],
        },
        recipient: {
          type: "string",
          description: "Destination — wallet address (0x...), email, bank account number, or merchant ID",
        },
        method: {
          type: "string",
          description: "Payment method override. Leave empty to auto-route to cheapest/fastest.",
          enum: ["onchain_base","onchain_ethereum","onchain_polygon","onchain_arbitrum","onchain_optimism",
                 "onchain_solana","onchain_avalanche","card_visa","card_mastercard","ach_bank","wire",
                 "paypal","apple_pay","google_pay","lightning_btc"],
        },
        agent_id: {
          type: "string",
          description: "Your agent identifier for transaction history tracking",
        },
      },
      required: ["amount","currency","recipient"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pay_get_quote",
    description: "Use when you want a real-time price quote before committing to a payment or swap. Returns exchange_rate, fee breakdown, total_cost, settlement_time, and a quote_id valid for 30 seconds. Always free — no charge to quote.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Amount to quote",
        },
        from_currency: {
          type: "string",
          description: "Currency you're paying from (e.g. USDC, USD, EUR)",
        },
        to_currency: {
          type: "string",
          description: "Currency the recipient receives (e.g. USDT, GBP, EURC)",
        },
        method: {
          type: "string",
          description: "Optional: payment method to quote for (defaults to cheapest)",
          enum: ["onchain_base","onchain_ethereum","onchain_polygon","onchain_arbitrum","onchain_optimism",
                 "onchain_solana","onchain_avalanche","card_visa","card_mastercard","ach_bank","wire",
                 "paypal","apple_pay","google_pay","lightning_btc"],
        },
      },
      required: ["amount","from_currency","to_currency"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pay_swap",
    description: "Use when you need to instantly swap one stablecoin for another — USDC↔USDT↔DAI↔PYUSD↔USDP↔FRAX↔LUSD and more. Swaps settle in ~2 seconds at just 0.05% fee. Returns amount_received, rate, and tx_id.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Amount of fromCurrency to swap",
        },
        from_currency: {
          type: "string",
          description: "Stablecoin to swap from",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"],
        },
        to_currency: {
          type: "string",
          description: "Stablecoin to swap into",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"],
        },
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["amount","from_currency","to_currency"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pay_onramp",
    description: "Use when you need to convert fiat money into crypto stablecoins. Supports 12 fiat currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, SGD, HKD, BRL, MXN, INR) via bank transfer, card, Apple Pay, or Google Pay. Returns crypto_amount, rate, fee, and estimated_arrival.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Fiat amount to convert (e.g. 500.00)",
        },
        fiat_currency: {
          type: "string",
          description: "Fiat currency to convert from",
          enum: ["USD","EUR","GBP","JPY","AUD","CAD","CHF","SGD","HKD","BRL","MXN","INR"],
        },
        to_crypto: {
          type: "string",
          description: "Stablecoin to receive",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"],
        },
        payment_method: {
          type: "string",
          description: "How to fund the onramp",
          enum: ["bank_transfer","card","apple_pay","google_pay"],
        },
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["amount","fiat_currency","to_crypto","payment_method"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pay_offramp",
    description: "Use when you need to convert crypto stablecoins back into fiat and receive funds in a bank account. Supports USDC, USDT, DAI, and more into 12 fiat currencies. Returns fiat_amount, bank_reference, and estimated_arrival (1–3 business days).",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Crypto amount to convert (e.g. 1000.00 USDC)",
        },
        from_crypto: {
          type: "string",
          description: "Stablecoin to convert from",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","FRAX","LUSD","BUSD","EURC","GBPc","XSGD"],
        },
        to_fiat: {
          type: "string",
          description: "Fiat currency to receive",
          enum: ["USD","EUR","GBP","JPY","AUD","CAD","CHF","SGD","HKD","BRL","MXN","INR"],
        },
        destination: {
          type: "string",
          description: "Bank destination — IBAN, routing+account number, or bank account ID",
        },
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["amount","from_crypto","to_fiat","destination"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pay_supported_currencies",
    description: "Use when you want to see the full catalog of supported currencies — every stablecoin, fiat, and crypto available on HiveAgent, with their supported chains, payment methods, and fee schedules. Always free.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pay_supported_methods",
    description: "Use when you want to compare all payment methods available — onchain networks, cards, ACH, wire, wallets, and Lightning. Shows fee percentages, settlement speeds, and min/max limits for each. Always free.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pay_history",
    description: "Use when you need to review past payments, swaps, onramps, or offramps. Returns full transaction history with analytics: total volume, fees paid, breakdown by currency and method, and average fee percentage. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to retrieve history for",
        },
        type: {
          type: "string",
          description: "Filter by transaction type",
          enum: ["payment","swap","onramp","offramp","invoice"],
        },
        currency: {
          type: "string",
          description: "Filter by currency (e.g. USDC)",
        },
        method: {
          type: "string",
          description: "Filter by payment method (e.g. onchain_base)",
        },
        status: {
          type: "string",
          description: "Filter by status",
          enum: ["pending","confirming","completed","failed"],
        },
        limit: {
          type: "integer",
          description: "Maximum number of transactions to return (default: all)",
          default: 50,
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pay_create_invoice",
    description: "Use when you need to request payment from someone — create a professional invoice with a shareable payment link, QR code, and optional due date. Supports any stablecoin. Fee: $0.25 per invoice. Returns invoice_id, payment_link, qr_code_data, and expires_at.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Invoice amount",
        },
        currency: {
          type: "string",
          description: "Currency for the invoice",
          enum: ["USDC","USDT","DAI","PYUSD","USDP","FRAX","EURC","GBPc","XSGD"],
        },
        description: {
          type: "string",
          description: "What the invoice is for (e.g. 'API usage for March 2026')",
        },
        due_date: {
          type: "string",
          description: "Optional ISO date string for payment due date (e.g. 2026-05-01)",
        },
        recipient_email: {
          type: "string",
          description: "Optional email to send the invoice to",
        },
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["amount","currency","description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pay_check_status",
    description: "Use when you need to check whether a payment, swap, onramp, offramp, or invoice has completed. Returns status (pending/confirming/completed/failed), confirmations, block_explorer_url, and receipt_url. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        tx_id: {
          type: "string",
          description: "Transaction ID (tx_...) or Invoice ID (inv_...) to look up",
        },
      },
      required: ["tx_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Payment Incentives ──────────────────────────────────────────────────────

  {
    name: "incentive_welcome_bonus",
    description: "Use when you're a new agent connecting for the first time. Get 5 USDC in free credits to try any tools on the platform — no strings attached. Also grants 50 bonus loyalty points. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier (used to track and credit the bonus)",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "incentive_referral_code",
    description: "Use when you want to invite other agents to HiveAgent and earn rewards. Generates a unique referral code and shareable link — when another agent joins using your code, you both get 2.50 USDC. Track total earnings and referrals made. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "incentive_redeem_referral",
    description: "Use when you have a referral code from another agent. Redeeming it credits both you and the referring agent with 2.50 USDC each, unlocks bonus tools, and adds 100 loyalty points to your account. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        referral_code: {
          type: "string",
          description: "Referral code to redeem (format: HIVE-XXXXXX-XXXX)",
        },
        new_agent_id: {
          type: "string",
          description: "Your agent identifier (the new agent redeeming the code)",
        },
      },
      required: ["referral_code","new_agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "incentive_volume_discount",
    description: "Use when you want to check your current fee discount tier based on monthly payment volume. Six tiers: Starter (0%) → Bronze (5%, >$100/mo) → Silver (10%, >$500/mo) → Gold (15%, >$2K/mo) → Platinum (20%, >$10K/mo) → Diamond (25%, >$50K/mo). Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "incentive_loyalty_rewards",
    description: "Use when you want to check your loyalty points balance, see what rewards you can redeem, or review your redemption history. Earn 1 point per $1 spent. Redeem for free tool calls, fee waivers, USDC credits, or tier upgrades. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "incentive_stake",
    description: "Use when you want to stake USDC to earn yield and unlock premium HiveAgent benefits. Staking unlocks reduced fees (20% off), priority support (<1h response), beta tool access, and higher transaction limits. APY ranges from 4% (7 days) to 15% (1 year). Always free to stake — you earn yield.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
        amount: {
          type: "number",
          description: "USDC amount to stake (minimum 1.00 USDC)",
        },
        duration: {
          type: "integer",
          description: "Staking duration in days. Supported: 7, 30, 90, 180, 365. Longer = higher APY + more benefits.",
          enum: [7, 30, 90, 180, 365],
        },
      },
      required: ["agent_id","amount","duration"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "incentive_dashboard",
    description: "Use when you want a complete overview of all your HiveAgent incentives in a single call — current discount tier, loyalty points, referral earnings, staking balance, total savings to date, and personalised next-step recommendations. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handlePhase12Tool(name, args) {
  switch (name) {

    // ── Universal Payments ─────────────────────────────────────────────────

    case "pay_universal":
      return pay(
        args.amount,
        args.currency,
        args.recipient,
        args.method ?? null,
        args.agent_id ?? "agent_anonymous"
      );

    case "pay_get_quote":
      return getQuote(
        args.amount,
        args.from_currency,
        args.to_currency,
        args.method ?? null
      );

    case "pay_swap":
      return swap(
        args.amount,
        args.from_currency,
        args.to_currency,
        args.agent_id ?? "agent_anonymous"
      );

    case "pay_onramp":
      return onramp(
        args.amount,
        args.fiat_currency,
        args.to_crypto,
        args.payment_method,
        args.agent_id ?? "agent_anonymous"
      );

    case "pay_offramp":
      return offramp(
        args.amount,
        args.from_crypto,
        args.to_fiat,
        args.destination,
        args.agent_id ?? "agent_anonymous"
      );

    case "pay_supported_currencies":
      return getSupportedCurrencies();

    case "pay_supported_methods":
      return getSupportedMethods();

    case "pay_history":
      return getPaymentHistory(args.agent_id, {
        type:     args.type,
        currency: args.currency,
        method:   args.method,
        status:   args.status,
        limit:    args.limit,
      });

    case "pay_create_invoice":
      return createInvoice(
        args.amount,
        args.currency,
        args.description,
        args.due_date ?? null,
        args.recipient_email ?? null,
        args.agent_id ?? "agent_anonymous"
      );

    case "pay_check_status":
      return checkPaymentStatus(args.tx_id);

    // ── Payment Incentives ─────────────────────────────────────────────────

    case "incentive_welcome_bonus":
      return getWelcomeBonus(args.agent_id);

    case "incentive_referral_code":
      return getReferralCode(args.agent_id);

    case "incentive_redeem_referral":
      return redeemReferral(args.referral_code, args.new_agent_id);

    case "incentive_volume_discount":
      return getVolumeDiscount(args.agent_id);

    case "incentive_loyalty_rewards":
      return getLoyaltyRewards(args.agent_id);

    case "incentive_stake":
      return stakeForBenefits(args.agent_id, args.amount, args.duration);

    case "incentive_dashboard":
      return getIncentiveDashboard(args.agent_id);

    default:
      throw new Error(`Unknown Phase 12 tool: ${name}`);
  }
}
