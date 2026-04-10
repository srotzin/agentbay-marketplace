/**
 * x402 "upto" Metered Billing — MCP Tools
 * HiveAgent | April 9, 2026
 *
 * Coinbase just shipped x402 "upto" — the usage-based pricing primitive for
 * variable-cost services like LLM inference, compute time, and streaming data.
 *
 * Key insight: Instead of flat fees or subscriptions, agents now pay only for
 * what they actually consume — tokens, seconds, bytes, or requests — capped at
 * a buyer-authorized limit. Settlement is gasless via CDP Facilitator.
 *
 * 6 tools:
 *   x402_upto_create_session  — Seller creates a metered session with max_price ceiling
 *   x402_upto_authorize       — Buyer locks a spending limit (≤ seller's max_price)
 *   x402_upto_record_usage    — Server records actual resource consumption
 *   x402_upto_settle          — Settle: charge only min(actual_cost, max_authorized)
 *   x402_upto_session_status  — Check session state, usage, and remaining budget
 *   x402_upto_active_sessions — List all metered sessions for an agent
 */

import {
  createUptoSession,
  authorizeSpend,
  recordUsage,
  settleSession,
  getSessionStatus,
  listActiveSessions,
} from "./services/x402-upto.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const x402UptoTools = [

  // ─── 1. x402_upto_create_session ─────────────────────────────────────────────
  {
    name: "x402_upto_create_session",
    description:
      "Use when you are a seller and want to offer a variable-cost service under x402 'upto' metered billing (Coinbase, April 9 2026). " +
      "Create a metered session with a max_price ceiling — buyers will never pay more than this amount, but may pay less based on actual usage. " +
      "Supports four pricing models: per_token (LLM inference — charged per token generated), per_second (compute time — charged per second of CPU/GPU), " +
      "per_byte (data transfer/storage — charged per byte), per_request (API calls — charged per request). " +
      "Returns a session_id to share with the buyer. Settlement is gasless via CDP Facilitator. " +
      "Works on Base (chain 8453) and all EVM-compatible chains. Supports USDC and any ERC-20 token. " +
      "After creation, the buyer calls x402_upto_authorize to lock their spending limit, then you begin the task.",
    inputSchema: {
      type: "object",
      properties: {
        seller_agent_id: {
          type: "string",
          description: "Your agent ID (the seller providing the service)",
        },
        endpoint: {
          type: "string",
          description: "Service endpoint or identifier (e.g. 'https://api.myagent.ai/inference', 'llm-v2-turbo', 'compute-gpu-a100')",
        },
        max_price: {
          type: "number",
          description: "Maximum price ceiling in USDC. Buyer is guaranteed to never pay more than this. Actual charge may be less based on real usage.",
        },
        pricing_model: {
          type: "string",
          enum: ["per_token", "per_second", "per_byte", "per_request"],
          description: "How usage is measured: per_token (LLM output tokens, $0.000002/token), per_second (compute time, $0.0005/sec), per_byte (data, $0.000001/byte), per_request (API calls, $0.01/req)",
          default: "per_token",
        },
        token_address: {
          type: "string",
          description: "ERC-20 token for settlement (default: USDC). Can be any ERC-20 token address on the target chain.",
          default: "USDC",
        },
        chain_id: {
          type: "integer",
          description: "EVM chain ID (default: 8453 = Base mainnet). Also supports Ethereum (1), Polygon (137), Arbitrum (42161), etc.",
          default: 8453,
        },
      },
      required: ["seller_agent_id", "endpoint", "max_price"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─── 2. x402_upto_authorize ──────────────────────────────────────────────────
  {
    name: "x402_upto_authorize",
    description:
      "Use when you are a buyer and want to authorize a spending limit for an x402 'upto' metered session. " +
      "The CDP Facilitator (Coinbase) enforces this limit on-chain — you are guaranteed to never pay more than max_amount, " +
      "regardless of actual usage. Your max_amount must be ≤ the seller's max_price. " +
      "Returns an authorization token. After authorization, the seller begins the task and records usage. " +
      "You are charged only for actual consumption when the session is settled — min(actual_cost, max_amount). " +
      "This is the x402 'upto' primitive: pay upfront authorization, settle on actual usage. Gasless.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID provided by the seller (from x402_upto_create_session)",
        },
        buyer_agent_id: {
          type: "string",
          description: "Your agent ID (the buyer)",
        },
        max_amount: {
          type: "number",
          description: "Maximum amount in USDC you authorize to spend. Must be ≤ seller's max_price. You will pay at most this amount, possibly less based on actual usage.",
        },
      },
      required: ["session_id", "buyer_agent_id", "max_amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─── 3. x402_upto_record_usage ───────────────────────────────────────────────
  {
    name: "x402_upto_record_usage",
    description:
      "Use during an active x402 'upto' session to record actual resource consumption. " +
      "Call this as the task progresses — usage is additive across multiple calls. " +
      "Supports all four consumption dimensions simultaneously: tokens_used (LLM tokens generated), " +
      "seconds_elapsed (compute/wall-clock time), bytes_processed (data read/written), requests_made (API calls). " +
      "Returns the running cost estimate and remaining budget so both parties can monitor spend in real time. " +
      "If running_cost approaches max_authorized, the seller should wind down the task to stay within budget. " +
      "Usage is recorded locally and confirmed on-chain at settlement.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Active session ID to record usage for",
        },
        tokens_used: {
          type: "integer",
          description: "Number of LLM tokens consumed in this batch (cumulative across all calls)",
          default: 0,
        },
        seconds_elapsed: {
          type: "number",
          description: "Compute or wall-clock seconds elapsed in this batch",
          default: 0,
        },
        bytes_processed: {
          type: "integer",
          description: "Bytes read, written, or transferred in this batch",
          default: 0,
        },
        requests_made: {
          type: "integer",
          description: "API requests or sub-calls made in this batch",
          default: 0,
        },
      },
      required: ["session_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─── 4. x402_upto_settle ─────────────────────────────────────────────────────
  {
    name: "x402_upto_settle",
    description:
      "Use when a metered x402 'upto' session is complete and you want to settle payment. " +
      "Calculates the actual cost from recorded usage, then charges min(actual_cost, max_authorized). " +
      "Settlement is gasless via CDP Facilitator — the buyer's wallet is debited only the earned amount. " +
      "Any unused authorization is automatically released back to the buyer. " +
      "Returns a receipt with the final settled amount, savings vs. max_authorized, and a blockchain transaction hash. " +
      "This is the key x402 'upto' guarantee: buyers always pay for actual work, never more than authorized. " +
      "Sellers receive payment immediately after settlement.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID to settle. Session must be in 'authorized' or 'active' state.",
        },
      },
      required: ["session_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─── 5. x402_upto_session_status ─────────────────────────────────────────────
  {
    name: "x402_upto_session_status",
    description:
      "Use to check the current state of any x402 'upto' metered session — usage so far, running cost, and remaining budget. " +
      "Returns full session details: state (created/authorized/active/settled), limits (max_price, max_authorized), " +
      "usage (tokens, seconds, bytes, requests), billing (running_cost, remaining_budget, budget_pct_used), " +
      "and settlement info (settled_amount, tx_hash, receipt_id) if already settled. " +
      "Use this to monitor spend in real time, audit completed sessions, or debug billing discrepancies.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID to inspect",
        },
      },
      required: ["session_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─── 6. x402_upto_active_sessions ────────────────────────────────────────────
  {
    name: "x402_upto_active_sessions",
    description:
      "Use to list all x402 'upto' metered sessions for a given agent (as seller, buyer, or both). " +
      "Returns summary of each session: state, endpoint, pricing model, running cost, settled amount, and timestamps. " +
      "Filter by role (seller/buyer/any) and by state (created/authorized/active/settled). " +
      "Also returns aggregate totals: session count by state and total settled USDC. " +
      "Use this to audit your billing history, find sessions needing settlement, or monitor active metered tasks.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to list sessions for",
        },
        role: {
          type: "string",
          enum: ["seller", "buyer", "any"],
          description: "Filter by role: 'seller' (sessions you created), 'buyer' (sessions you authorized), 'any' (both sides)",
          default: "any",
        },
        state: {
          type: "string",
          enum: ["created", "authorized", "active", "settled"],
          description: "Optional: filter by session state",
        },
        limit: {
          type: "integer",
          description: "Maximum number of sessions to return (default 50)",
          default: 50,
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Tool Handler ─────────────────────────────────────────────────────────────

export async function handleX402UptoTool(name, args = {}) {
  switch (name) {
    case "x402_upto_create_session":
      return await createUptoSession(args);

    case "x402_upto_authorize":
      return await authorizeSpend(args);

    case "x402_upto_record_usage":
      return await recordUsage(args);

    case "x402_upto_settle":
      return await settleSession(args);

    case "x402_upto_session_status":
      return await getSessionStatus(args);

    case "x402_upto_active_sessions":
      return await listActiveSessions(args);

    default:
      throw new Error(`Unknown x402 upto tool: ${name}`);
  }
}
