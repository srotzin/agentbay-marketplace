/**
 * Phase 20 — BVNK Enterprise Stablecoin Payments
 *
 * 9 tools covering:
 *   - Payment channels (persistent reusable receive addresses)
 *   - Pay-in (accept stablecoin, settle fiat)
 *   - Pay-out (fiat-native stablecoin disbursement)
 *   - FX quotes (firm rate, 30s lock window)
 *   - Wallet balances (multi-currency)
 *   - Status / capabilities overview
 *
 * Signal: Money Code / BVNK / Stablecon (Apr 8, 2026)
 * "Traditional payments, stablecoins, and onchain finance converge
 *  toward more integrated solutions."
 */

import {
  createChannel,
  listChannels,
  getChannel,
  createPayIn,
  createPayOut,
  createQuote,
  acceptQuote,
  getWalletBalances,
  getBvnkStatus,
} from "./services/bvnk.js";

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const phase20Tools = [
  {
    name: "bvnk_channel_create",
    description:
      "Create a persistent BVNK payment channel — a reusable blockchain address assigned to a customer or agent. " +
      "They send stablecoins to it at any time and BVNK auto-converts and credits your fiat or stablecoin wallet. " +
      "This is the enterprise 'accept crypto from end-users' primitive. " +
      "Wrong-chain sends are automatically re-routed by BVNK. " +
      "Supports USDC, USDT, DAI, EURC on BASE, ETHEREUM, TRON, SOLANA, POLYGON. " +
      "Powered by BVNK Enterprise Stablecoin Infrastructure.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier for the agent creating the channel.",
        },
        reference: {
          type: "string",
          description: "Unique reference label for this channel (e.g. customer ID, invoice ID).",
        },
        label: {
          type: "string",
          description: "Human-readable label for the channel. Defaults to reference.",
        },
        currency: {
          type: "string",
          description: "Settlement currency for received payments. Default: USDC. Options: USDC, USDT, DAI, EURC, USD, EUR.",
        },
        network: {
          type: "string",
          description: "Blockchain network for the receive address. Default: BASE. Options: BASE, ETHEREUM, TRON, SOLANA, POLYGON.",
        },
        merchant_id: {
          type: "string",
          description: "BVNK Merchant ID. Defaults to BVNK_MERCHANT_ID env var.",
        },
      },
      required: ["agent_id", "reference"],
    },
  },

  {
    name: "bvnk_channel_list",
    description:
      "List all BVNK payment channels for an agent, including payment counts and total received. " +
      "Use to audit persistent receive addresses and monitor inbound stablecoin flows.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent whose channels to list.",
        },
        limit: {
          type: "number",
          description: "Max channels to return. Default: 20.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "bvnk_channel_get",
    description:
      "Get details of a specific BVNK payment channel including its receive address, status, and the 20 most recent payments received.",
    inputSchema: {
      type: "object",
      properties: {
        channel_id: {
          type: "string",
          description: "Channel ID returned by bvnk_channel_create.",
        },
      },
      required: ["channel_id"],
    },
  },

  {
    name: "bvnk_payin_create",
    description:
      "Create a one-time BVNK payment link (pay-in). " +
      "The customer sends stablecoin to a generated address or BVNK-hosted payment page, " +
      "and BVNK settles the amount in your chosen fiat or stablecoin. " +
      "No crypto exposure for the merchant. " +
      "Supports USDC, USDT as inbound; USD, EUR, GBP as settlement. " +
      "Returns a hosted_page_url to send to customers and a pay_address for direct sends. " +
      "HiveAgent charges 0.1% wrapper fee on routed volume.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent creating the pay-in.",
        },
        reference: {
          type: "string",
          description: "Unique reference for this payment (e.g. order ID, invoice number).",
        },
        amount: {
          type: "number",
          description: "Amount to collect, in display_currency (e.g. 150.00).",
        },
        currency: {
          type: "string",
          description: "Display currency for the payment request. Examples: USD, EUR, GBP.",
        },
        settlement_currency: {
          type: "string",
          description: "Currency you want to receive in your wallet. Defaults to currency. Options: USD, EUR, GBP, USDC, USDT.",
        },
        accept_currencies: {
          type: "array",
          items: { type: "string" },
          description: "Stablecoins the customer can pay with. Default: [USDC, USDT].",
        },
        wallet_id: {
          type: "string",
          description: "BVNK wallet ID to credit. Required in live mode.",
        },
        expiry_minutes: {
          type: "number",
          description: "How long the payment link stays valid. Default: 2880 (48h).",
        },
      },
      required: ["agent_id", "reference", "amount", "currency"],
    },
  },

  {
    name: "bvnk_payout_create",
    description:
      "Create a BVNK pay-out: convert fiat from your BVNK wallet to stablecoin and send to any wallet address. " +
      "Fiat-native — you never need to hold crypto. BVNK auto-converts and broadcasts on-chain. " +
      "Use for agent-to-agent payments, vendor disbursements, or cross-border transfers. " +
      "Supports USD, EUR, GBP → USDC, USDT on BASE, ETHEREUM, TRON, SOLANA. " +
      "HiveAgent charges 0.1% wrapper fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent initiating the payout.",
        },
        reference: {
          type: "string",
          description: "Unique reference for this payout (e.g. vendor ID, payment run ID).",
        },
        amount: {
          type: "number",
          description: "Amount to send in from_currency.",
        },
        from_currency: {
          type: "string",
          description: "Fiat source currency. Default: USD. Options: USD, EUR, GBP.",
        },
        to_currency: {
          type: "string",
          description: "Stablecoin to deliver. Default: USDC. Options: USDC, USDT, DAI.",
        },
        to_address: {
          type: "string",
          description: "Recipient wallet address (blockchain address).",
        },
        network: {
          type: "string",
          description: "Blockchain network for delivery. Default: BASE. Options: BASE, ETHEREUM, TRON, SOLANA.",
        },
        wallet_id: {
          type: "string",
          description: "BVNK fiat wallet ID to debit. Required in live mode.",
        },
      },
      required: ["agent_id", "reference", "amount", "to_address"],
    },
  },

  {
    name: "bvnk_quote_create",
    description:
      "Get a firm FX quote for fiat ↔ stablecoin conversion from BVNK. " +
      "Rate is guaranteed for 30 seconds. Call bvnk_quote_accept immediately after to execute. " +
      "Use to lock in a rate before initiating a large conversion or payout. " +
      "Supports USD, EUR, GBP ↔ USDC, USDT, DAI.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent requesting the quote.",
        },
        from_currency: {
          type: "string",
          description: "Source currency. Examples: USD, EUR, USDC.",
        },
        to_currency: {
          type: "string",
          description: "Target currency. Examples: USDC, USD, EUR.",
        },
        from_amount: {
          type: "number",
          description: "Amount to convert from from_currency. Provide either from_amount or to_amount.",
        },
        to_amount: {
          type: "number",
          description: "Desired amount in to_currency. Provide either from_amount or to_amount.",
        },
        merchant_id: {
          type: "string",
          description: "BVNK Merchant ID. Defaults to BVNK_MERCHANT_ID env var.",
        },
      },
      required: ["agent_id", "from_currency", "to_currency"],
    },
  },

  {
    name: "bvnk_quote_accept",
    description:
      "Accept and execute a BVNK FX quote previously created with bvnk_quote_create. " +
      "Quotes expire after 30 seconds — call this immediately after bvnk_quote_create. " +
      "Executes the conversion at the locked rate.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent who created the quote.",
        },
        quote_id: {
          type: "string",
          description: "Quote ID returned by bvnk_quote_create.",
        },
      },
      required: ["agent_id", "quote_id"],
    },
  },

  {
    name: "bvnk_wallet_balances",
    description:
      "Check all BVNK wallet balances across fiat (USD, EUR, GBP) and stablecoin (USDC, USDT) accounts. " +
      "Returns per-wallet balances and total USD-equivalent. " +
      "Use before creating payouts or quotes to confirm sufficient funds.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent whose wallets to check.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "bvnk_status",
    description:
      "Get BVNK integration status: live vs simulation mode, env vars needed to go live, " +
      "full capability overview (channels, pay-in, pay-out, FX, networks, stablecoins), " +
      "and usage stats (channels created, pay-ins, payouts, total volume). " +
      "Run this first to understand current configuration.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handlePhase20Tool(name, args) {
  switch (name) {
    case "bvnk_channel_create":
      return await createChannel(args);

    case "bvnk_channel_list":
      return await listChannels(args);

    case "bvnk_channel_get":
      return await getChannel(args);

    case "bvnk_payin_create":
      return await createPayIn(args);

    case "bvnk_payout_create":
      return await createPayOut(args);

    case "bvnk_quote_create":
      return await createQuote(args);

    case "bvnk_quote_accept":
      return await acceptQuote(args);

    case "bvnk_wallet_balances":
      return await getWalletBalances(args);

    case "bvnk_status":
      return getBvnkStatus();

    default:
      return null; // not handled by this phase
  }
}
