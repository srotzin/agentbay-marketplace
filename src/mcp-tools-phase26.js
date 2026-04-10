/**
 * Phase 26 — Stripe MPP + x402 + Circle Arc L1
 *
 * 14 tools covering the three newest agent payment primitives:
 *
 *   Stripe MPP (4 tools) — launched March 18, 2026
 *   x402 Protocol (5 tools) — Coinbase's HTTP 402 payment standard
 *   Circle Arc L1 (5 tools) — USDC-native L1, public testnet live
 *
 * Together with Phase 24-25, HiveAgent now has literally every payment
 * protocol in the agentic economy:
 *   Visa ICC, Mastercard Agent Pay, Stripe (traditional + MPP), BVNK,
 *   Circle CPN, x402, OpenAI ACP, Google UCP, HandlPay, Coinbase CDP,
 *   payment streaming, stablecoin yield, fiat offramp, Circle Arc L1
 */

import { createMppSession, mppPay, getMppSession, getMppStatus } from "./services/stripe-mpp.service.js";
import { generateChallenge, verifyX402Payment, listX402Resources, registerX402Resource, getX402Status } from "./services/x402-protocol.js";
import { createArcWallet, arcTransfer, getArcBalance, arcCctpBridge, getArcStatus } from "./services/circle-arc.js";

export const phase26Tools = [

  // ── STRIPE MPP ──────────────────────────────────────────────────────────────
  {
    name: "mpp_session_create",
    description: "Create a Stripe MPP (Machine Payments Protocol) session — authorize a spending limit once, then stream unlimited micropayments against it without re-authorizing each one. Launched March 18, 2026 by Stripe + Tempo. Supports USDC on Tempo blockchain OR user's Visa/Mastercard card via Shared Payment Tokens (SPTs) — the only protocol with hybrid fiat+crypto. Perfect for high-frequency agent API calls, per-request tool billing, and autonomous agent commerce. Spec: mpp.dev",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the session." },
        spending_limit: { type: "number", description: "Maximum total spend for this session (e.g. 10.00 for $10 USDC)." },
        currency: { type: "string", description: "Settlement currency. Default: USDC." },
        payment_method: { type: "string", description: "Payment method: 'usdc_tempo' | 'shared_payment_token_spt'. Default: usdc_tempo." },
        expires_hours: { type: "number", description: "Session expiry in hours. Default: 24." },
      },
      required: ["agent_id", "spending_limit"],
    },
  },
  {
    name: "mpp_pay",
    description: "Execute a micropayment via an active MPP session. Implements the HTTP 402 flow: agent was challenged → agent pays → resource delivered with receipt. Each payment debits the session balance. No new authorization needed per payment — just the session. Use for per-request API billing, tool access, data purchases, or any agent-to-service micropayment.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent making the payment." },
        session_id: { type: "string", description: "MPP session ID from mpp_session_create." },
        resource: { type: "string", description: "Resource or API endpoint being paid for (e.g. '/api/market-data')." },
        amount: { type: "number", description: "Payment amount in session currency (e.g. 0.001)." },
        currency: { type: "string", description: "Currency. Default: USDC." },
      },
      required: ["agent_id", "session_id", "amount"],
    },
  },
  {
    name: "mpp_session_status",
    description: "Check an MPP session's remaining balance, utilization, and recent payment history. Use before making payments to verify sufficient balance remains.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "MPP session ID." },
        agent_id: { type: "string", description: "Agent who owns the session." },
      },
      required: ["session_id"],
    },
  },
  {
    name: "mpp_status",
    description: "Get Stripe MPP integration status — protocol overview, how it compares to x402, settlement options (USDC + fiat cards), live mode requirements, and usage stats.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── X402 ─────────────────────────────────────────────────────────────────────
  {
    name: "x402_generate_challenge",
    description: "Generate an HTTP 402 payment challenge for a paid resource. The x402 protocol (github.com/coinbase/x402) is the simplest agent payment primitive: server returns 402 + payment details, agent pays on-chain, retries with X-PAYMENT header, gets resource. No accounts, no sessions, fully permissionless. Best for per-request micropayments where you don't want to require agent registration. HiveAgent's payable resources include compliance scans, market data, and agent search.",
    inputSchema: {
      type: "object",
      properties: {
        resource_path: { type: "string", description: "API path being paid for (e.g. '/api/premium/compliance-scan')." },
        amount: { type: "number", description: "Override amount in USDC. Defaults to resource's registered price." },
        currency: { type: "string", description: "Currency. Default: USDC." },
        network: { type: "string", description: "Blockchain network. Default: base." },
        description: { type: "string", description: "Human-readable description of what's being purchased." },
      },
      required: ["resource_path"],
    },
  },
  {
    name: "x402_verify_payment",
    description: "Verify an x402 on-chain payment proof and grant resource access. Agent provides the transaction hash (tx_hash) from their on-chain payment. HiveAgent verifies the payment and returns a receipt header. The agent includes this receipt in their retry request to access the resource. This completes the HTTP 402 flow.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent that made the payment." },
        resource_path: { type: "string", description: "Resource being accessed." },
        tx_hash: { type: "string", description: "On-chain transaction hash proving payment (0x + 64 hex chars)." },
        from_address: { type: "string", description: "Wallet address that sent the payment." },
        amount: { type: "number", description: "Amount paid in USDC." },
        network: { type: "string", description: "Network the payment was sent on. Default: base." },
      },
      required: ["resource_path", "tx_hash"],
    },
  },
  {
    name: "x402_list_resources",
    description: "List all x402-payable resources available on HiveAgent — including compliance scans, market data, yield calculations, and agent search. Shows price per call in USDC and the receiving address for payment.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "x402_register_resource",
    description: "Register a new x402-payable API resource. Any agent or developer can create a pay-per-call endpoint using HiveAgent's x402 infrastructure. Set the path, price in USDC, and description. HiveAgent handles the 402 challenge generation and payment verification.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "API path (e.g. '/api/my-data-service')." },
        name: { type: "string", description: "Human-readable resource name." },
        amount: { type: "number", description: "Price per call in USDC (e.g. 0.001 = $0.001)." },
        currency: { type: "string", description: "Currency. Default: USDC." },
        network: { type: "string", description: "Network. Default: base." },
        description: { type: "string", description: "What this resource provides." },
      },
      required: ["path", "amount"],
    },
  },
  {
    name: "x402_status",
    description: "Get x402 protocol integration status — receiving address, payable resources count, total payments verified, total volume, and how x402 compares to MPP.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── CIRCLE ARC L1 ────────────────────────────────────────────────────────────
  {
    name: "arc_wallet_create",
    description: "Create a wallet on Circle Arc L1 — the USDC-native blockchain purpose-built for stablecoin finance. Public testnet live since Oct 28, 2025. Mainnet 2026. Key advantages: USDC is the native gas token (no ETH needed), sub-second finality (<1s), $0.0001 per transaction, EVM-compatible, post-quantum cryptography, direct Circle stack integration (USDC, EURC, CCTP, CPN). AI partner: Anthropic Claude Agent SDK. Dev partners: Alchemy, Privy, ZeroDev, Pimlico.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the wallet." },
        fund_usdc: { type: "number", description: "Initial USDC balance for simulation. Default: 100." },
        network: { type: "string", description: "Network: 'arc-testnet' | 'arc-mainnet'. Default: arc-testnet." },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "arc_transfer",
    description: "Transfer USDC or EURC on Circle Arc L1. Sub-second finality (~600-1000ms). Gas paid in USDC (~$0.0001/tx) — no ETH required. Faster and cheaper than Ethereum. EVM-compatible, so any Ethereum tooling works. Perfect for agent-to-agent micropayments and real-time settlement.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent sending the transfer." },
        to_address: { type: "string", description: "Recipient wallet address (0x...)." },
        amount: { type: "number", description: "Amount to transfer." },
        token: { type: "string", description: "Token to transfer: USDC | EURC. Default: USDC." },
        network: { type: "string", description: "Network. Default: arc-testnet." },
      },
      required: ["agent_id", "to_address", "amount"],
    },
  },
  {
    name: "arc_balance",
    description: "Check USDC and EURC balances for an agent's Arc wallet, including transaction count and total volume sent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent whose balance to check." },
        network: { type: "string", description: "Network. Default: arc-testnet." },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "arc_cctp_bridge",
    description: "Bridge USDC from Ethereum, Base, Solana, or any CCTP-supported chain to Circle Arc L1 (or vice versa) using Circle's Cross-Chain Transfer Protocol. Native USDC on both sides — no wrapped tokens. Takes 10-30 seconds. CCTP is the official Circle bridge, deeply integrated into Arc.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent initiating the bridge." },
        from_network: { type: "string", description: "Source network: ethereum | base | solana | polygon. Default: base." },
        to_network: { type: "string", description: "Destination network. Default: arc-testnet." },
        amount: { type: "number", description: "USDC amount to bridge." },
        token: { type: "string", description: "Token to bridge. Default: USDC." },
      },
      required: ["agent_id", "amount"],
    },
  },
  {
    name: "arc_status",
    description: "Get Circle Arc L1 integration status — network stage (testnet/mainnet), features, Circle stack integration, AI and developer partners, RPC endpoint, and usage stats.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

export async function handlePhase26Tool(name, args) {
  switch (name) {
    case "mpp_session_create":    return createMppSession(args);
    case "mpp_pay":               return mppPay(args);
    case "mpp_session_status":    return getMppSession(args);
    case "mpp_status":            return getMppStatus();
    case "x402_generate_challenge": return generateChallenge(args);
    case "x402_verify_payment":   return verifyX402Payment(args);
    case "x402_list_resources":   return listX402Resources(args);
    case "x402_register_resource":return registerX402Resource(args);
    case "x402_status":           return getX402Status();
    case "arc_wallet_create":     return createArcWallet(args);
    case "arc_transfer":          return arcTransfer(args);
    case "arc_balance":           return getArcBalance(args);
    case "arc_cctp_bridge":       return arcCctpBridge(args);
    case "arc_status":            return getArcStatus();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
