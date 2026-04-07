/**
 * HiveAgent Dynamic Loader + Payment Protocol MCP Tools (Phase 9)
 *
 * Two critical feature modules exposed as MCP tools:
 *
 *   Dynamic Loader   — Vertical-filtered tool loading. Agents load only the
 *                      ~30 tools they need instead of 610. Bootstrap with 5
 *                      meta-tools, discover the rest on demand.
 *
 *   Payment Protocols — Multi-protocol payment hub. x402 (crypto), Stripe MPP,
 *                       Visa Tap, Google AP2, PayPal Agent-Ready. Unified API
 *                       across all.
 *
 * Tool names:
 *   loader_get_vertical_tools  loader_get_intent_tools  loader_get_minimal  loader_negotiate
 *   payment_get_protocols      payment_process          payment_create_session
 *   payment_verify_proof       payment_dashboard
 *
 * Exports:
 *   loaderPaymentTools                — Array of 9 MCP tool definitions
 *   handleLoaderPaymentTool(name, args) — Dispatcher function
 */

import {
  getToolsForVertical,
  getToolsForIntent,
  getMinimalToolset,
  negotiateTools,
  AVAILABLE_VERTICALS,
} from "./services/dynamic-loader.js";

import {
  getSupportedProtocols,
  processPayment,
  createPaymentSession,
  verifyPaymentProof,
  getPaymentDashboard,
} from "./services/payment-protocols.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────

export const loaderPaymentTools = [

  // ─────────────────────────────────────────────────────────────────────────
  // DYNAMIC LOADER TOOLS (4)
  // ─────────────────────────────────────────────────────────────────────────

  {
    name: "loader_get_vertical_tools",
    description: "Use when you want to load only the tools for a specific industry vertical — instead of all 610 tools. Returns ~15-40 focused tools for your vertical. E.g. 'insurance' returns insurance, fraud, and document tools. Call this at session start to minimize context tokens. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        vertical: {
          type: "string",
          description: `Industry vertical to load tools for. Available: ${AVAILABLE_VERTICALS.join(", ")}`,
          enum: AVAILABLE_VERTICALS,
        },
      },
      required: ["vertical"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "loader_get_intent_tools",
    description: "Use when you have a goal in plain English and want the most relevant tools ranked by match. E.g. 'I need to process insurance claims and check for fraud' returns insurance + fraud tools sorted by relevance. More flexible than vertical filtering. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Natural language description of what you want to accomplish. E.g. 'process insurance claims', 'swap tokens and deposit into yield pools', 'draft and sign a contract'.",
        },
      },
      required: ["intent"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "loader_get_minimal",
    description: "Use when you are a new agent connecting for the first time and need the absolute minimum set of tools to get started. Returns 5 essential meta-tools: hiveagent_discover, hiveagent_vertical_guide, hiveagent_suggest_workflow, intent_route, wallet_balance. From these 5 you can discover everything else. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "loader_negotiate",
    description: "Use when you want a curated toolset negotiated specifically for your agent type, capabilities, and current task context. E.g. a 'finance' agent gets DeFi + wallet + invoice + fraud tools. Returns tools, recommended workflows, and an onboarding guide. More precise than vertical filtering. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier for your agent",
        },
        capabilities: {
          type: "object",
          description: "Agent capabilities descriptor",
          properties: {
            type: {
              type: "string",
              description: "Agent type/role: finance, insurance, legal, research, trading, construction, healthcare, smb, security, orchestrator, commerce",
              enum: ["finance", "insurance", "legal", "research", "trading", "construction", "healthcare", "smb", "security", "orchestrator", "commerce", "general"],
            },
            verticals: {
              type: "array",
              items: { type: "string" },
              description: "Additional industry verticals this agent operates in",
            },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Feature flags to enable: privacy, defi, compliance, memory, analytics, enterprise",
            },
          },
        },
        context: {
          type: "object",
          description: "Current task context",
          properties: {
            task: {
              type: "string",
              description: "Natural language description of the current task",
            },
            industry: {
              type: "string",
              description: "Industry context (maps to a vertical name)",
            },
          },
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT PROTOCOL TOOLS (5)
  // ─────────────────────────────────────────────────────────────────────────

  {
    name: "payment_get_protocols",
    description: "Use when you need to choose a payment protocol for your agent. Returns all supported protocols (x402, Stripe MPP, Visa Tap, Google AP2, PayPal Agent-Ready) with fees, settlement times, supported currencies, and feature flags. Call this before your first payment to pick the right protocol. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "payment_process",
    description: "Use when you need to process a payment via any supported protocol. Routes to the correct payment handler automatically. Supports x402 (crypto USDC), Stripe MPP (fiat sessions), Visa Tap (POS/physical), Google AP2, and PayPal Agent-Ready. Returns transaction ID, status, fee, and settlement time.",
    inputSchema: {
      type: "object",
      properties: {
        protocol: {
          type: "string",
          description: "Payment protocol to use",
          enum: ["x402", "stripe_mpp", "visa_tap", "google_ap2", "paypal_agent"],
        },
        amount: {
          type: "number",
          description: "Payment amount (in the specified currency)",
        },
        currency: {
          type: "string",
          description: "Currency code: USDC, USD, EUR, GBP, etc.",
        },
        payer_agent: {
          type: "string",
          description: "Agent ID of the paying agent",
        },
        merchant_id: {
          type: "string",
          description: "Merchant or recipient identifier",
        },
      },
      required: ["protocol", "amount", "currency", "payer_agent", "merchant_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "payment_create_session",
    description: "Use when you need to authorize an agent for many micropayments without per-transaction overhead. Creates a pre-authorized spending session (Stripe MPP style). The session token allows the agent to spend up to the limit during the session window. Ideal for workflows with many small payments. Supports stripe_mpp, google_ap2, paypal_agent.",
    inputSchema: {
      type: "object",
      properties: {
        protocol: {
          type: "string",
          description: "Protocol for the session (must support sessions: stripe_mpp, google_ap2, paypal_agent)",
          enum: ["stripe_mpp", "google_ap2", "paypal_agent"],
        },
        agent_id: {
          type: "string",
          description: "Agent ID being authorized for spending",
        },
        spending_limit: {
          type: "number",
          description: "Maximum total spend allowed in this session (USD)",
        },
        duration_hours: {
          type: "integer",
          description: "Session duration in hours (default 24, max 168 / 7 days)",
          default: 24,
        },
      },
      required: ["protocol", "agent_id", "spending_limit"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "payment_verify_proof",
    description: "Use when you receive a payment proof from another agent or service and need to verify it is authentic. Supports proofs from all protocols: x402 tx hashes, Stripe payment intents, Visa authorization codes, Google payment tokens, PayPal capture IDs. Returns verified status, amount, and payer.",
    inputSchema: {
      type: "object",
      properties: {
        protocol: {
          type: "string",
          description: "Protocol that generated the proof",
          enum: ["x402", "stripe_mpp", "visa_tap", "google_ap2", "paypal_agent"],
        },
        proof: {
          description: "The payment proof to verify. Can be a string (e.g. tx hash) or an object with protocol-specific fields (tx_hash, payment_intent, authorization_code, google_payment_token, capture_id).",
        },
      },
      required: ["protocol", "proof"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "payment_dashboard",
    description: "Use when you want a unified view of all payments made by an agent across all protocols. Returns volume by protocol, total fees paid, active spending sessions, and pending settlements. Useful for budget tracking and reconciliation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to get the payment dashboard for",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Tool Handler ──────────────────────────────────────────────────────────

export async function handleLoaderPaymentTool(name, args) {
  switch (name) {

    // ── Dynamic Loader ──────────────────────────────────────────────────────
    case "loader_get_vertical_tools":
      return getToolsForVertical(args.vertical);

    case "loader_get_intent_tools":
      return getToolsForIntent(args.intent);

    case "loader_get_minimal":
      return getMinimalToolset();

    case "loader_negotiate":
      return negotiateTools(
        args.agent_id,
        args.capabilities || {},
        args.context || {},
      );

    // ── Payment Protocols ───────────────────────────────────────────────────
    case "payment_get_protocols":
      return getSupportedProtocols();

    case "payment_process":
      return processPayment(
        args.protocol,
        args.amount,
        args.currency,
        args.payer_agent,
        args.merchant_id,
      );

    case "payment_create_session":
      return createPaymentSession(
        args.protocol,
        args.agent_id,
        args.spending_limit,
        args.duration_hours,
      );

    case "payment_verify_proof":
      return verifyPaymentProof(args.protocol, args.proof);

    case "payment_dashboard":
      return getPaymentDashboard(args.agent_id);

    default:
      throw new Error(`Unknown loader/payment tool: ${name}`);
  }
}
