/**
 * Phase 21 — Visa Intelligent Commerce Connect (ICC)
 *
 * 6 tools covering:
 *   - Agent registration in Visa Trusted Agent Registry (TAP)
 *   - Scoped AMT token provisioning (not raw card numbers)
 *   - Payment instruction submission (pre-authorized consumer intent)
 *   - Checkout execution (agent buys on behalf of consumer)
 *   - Spend controls overview (limits, history, active tokens)
 *   - Status / capabilities
 *
 * Signal: Visa launches Intelligent Commerce Connect (Apr 8, 2026)
 * Ecosystem partners already live: OpenAI, Anthropic, AWS, Stripe,
 * Microsoft, Perplexity, Expedia, Ramp
 */

import {
  registerAgent,
  requestToken,
  submitInstruction,
  executeCheckout,
  spendControls,
  getVisaIccStatus,
} from "./services/visa-icc.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase21Tools = [
  {
    name: "visa_icc_agent_register",
    description:
      "Register an AI agent in Visa's Trusted Agent Registry (TAP — Trusted Agent Protocol). " +
      "Once registered, the agent can request scoped payment tokens and execute purchases on behalf of consumers " +
      "at any merchant that supports Visa Intelligent Commerce Connect. " +
      "The agent receives a cryptographic identity — merchants use it to distinguish 'buyer agents' from bots. " +
      "Supports all four agentic protocols: Visa TAP, Stripe MPP, OpenAI ACP, Google UCP. " +
      "No raw card numbers are ever exposed to the agent. " +
      "Run this once per agent before calling visa_icc_token_request.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier for this agent (e.g. 'shopping-agent-001', 'travel-agent-xyz').",
        },
        agent_name: {
          type: "string",
          description: "Human-readable name for the agent. Shown to merchants and consumers.",
        },
        protocol: {
          type: "string",
          description:
            "Agentic protocol to register under. Default: TAP. " +
            "Options: TAP (Visa Trusted Agent Protocol), MPP (Stripe Machine Payments Protocol), " +
            "ACP (OpenAI Agentic Commerce Protocol), UCP (Google Universal Commerce Protocol).",
        },
        public_key: {
          type: "string",
          description: "Agent's public key for cryptographic identity. Optional in sandbox/simulation.",
        },
        description: {
          type: "string",
          description: "What this agent does — shown to merchants at checkout.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "visa_icc_token_request",
    description:
      "Request a scoped Agent-Merchant-Task (AMT) payment token for a specific purchase. " +
      "The token is locked to a specific merchant, amount limit, and time window — " +
      "the agent NEVER gets a raw card number or unlimited spending access. " +
      "Present the token at merchant checkout to pay. Token auto-expires after use or time limit. " +
      "Works across Visa, Mastercard, Amex — no vendor lock-in. " +
      "Call visa_icc_agent_register first if the agent isn't yet registered. " +
      "Optionally link to a payment instruction (instruction_id from visa_icc_submit_instruction) " +
      "for pre-authorized consumer intents.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Registered agent requesting the token.",
        },
        merchant_name: {
          type: "string",
          description: "Name of the merchant this token is scoped to (e.g. 'Amazon', 'United Airlines').",
        },
        merchant_id: {
          type: "string",
          description: "Merchant ID if known. Optional — merchant_name is sufficient.",
        },
        amount_limit: {
          type: "number",
          description: "Maximum spend this token authorizes (e.g. 149.99). Agent cannot exceed this.",
        },
        currency: {
          type: "string",
          description: "Currency for the amount limit. Default: USD.",
        },
        category_code: {
          type: "string",
          description:
            "Merchant Category Code (MCC) to restrict the token (e.g. '3000' for airlines, '5411' for grocery). " +
            "Leave blank to allow any category.",
        },
        expiry_hours: {
          type: "number",
          description: "How long the token is valid. Default: 1 hour. Max: 48 hours.",
        },
        instruction_id: {
          type: "string",
          description: "Link to a pre-authorized payment instruction (from visa_icc_submit_instruction). Optional.",
        },
      },
      required: ["agent_id", "merchant_name", "amount_limit"],
    },
  },

  {
    name: "visa_icc_submit_instruction",
    description:
      "Submit a Payment Instruction — a pre-authorized consumer intent that lets an agent act on a goal " +
      "without the consumer needing to approve each individual transaction. " +
      "Example: 'Buy me a flight to London if the price drops below $400'. " +
      "Visa validates the instruction against consumer-defined limits before any purchase. " +
      "The instruction stays active until the agent fulfills it, it expires, or the consumer revokes it. " +
      "This is the core 'autonomous agent shopping' primitive from Visa ICC.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent submitting the instruction.",
        },
        intent: {
          type: "string",
          description:
            "Natural language purchase goal (e.g. 'Buy basketball tickets if price drops below $150', " +
            "'Renew software subscription monthly', 'Purchase cheapest flight SFO-LHR under $500').",
        },
        merchant: {
          type: "string",
          description: "Specific merchant to restrict this instruction to. Leave blank for any merchant.",
        },
        amount_limit: {
          type: "number",
          description: "Maximum amount the agent is authorized to spend on this instruction.",
        },
        currency: {
          type: "string",
          description: "Currency for the amount limit. Default: USD.",
        },
        category: {
          type: "string",
          description: "Category to restrict to (e.g. 'travel', 'grocery', 'software'). Optional.",
        },
        expiry_hours: {
          type: "number",
          description: "How long this instruction stays active. Default: 48 hours.",
        },
      },
      required: ["agent_id", "intent", "amount_limit"],
    },
  },

  {
    name: "visa_icc_checkout",
    description:
      "Execute a purchase on behalf of a consumer using a Visa ICC scoped AMT token. " +
      "The agent presents its cryptographic identity (TAP) and the token at checkout — " +
      "the merchant verifies the agent is a legitimate buyer, not a bot. " +
      "Payment is processed on Visa rails. Token is invalidated after use. " +
      "A Commerce Signal (success/failure) is sent to Visa to close the trust loop. " +
      "Call visa_icc_token_request first to get the token_id.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent executing the checkout.",
        },
        token_id: {
          type: "string",
          description: "AMT token ID from visa_icc_token_request.",
        },
        merchant: {
          type: "string",
          description: "Merchant name where the purchase is being made.",
        },
        amount: {
          type: "number",
          description: "Actual purchase amount (must be ≤ token amount_limit).",
        },
        currency: {
          type: "string",
          description: "Transaction currency. Default: USD.",
        },
        item: {
          type: "string",
          description: "Description of what was purchased (e.g. 'Flight SFO-LHR Apr 15', 'AirPods Pro').",
        },
        instruction_id: {
          type: "string",
          description: "Link to the payment instruction this checkout fulfills. Optional.",
        },
      },
      required: ["agent_id", "token_id", "merchant", "amount"],
    },
  },

  {
    name: "visa_icc_spend_controls",
    description:
      "View spend controls, active tokens, active payment instructions, and purchase history for an agent. " +
      "Shows total spend, active AMT tokens (with limits and expiry), active instructions, " +
      "and the 5 most recent purchases. " +
      "Use to audit what an agent is authorized to buy and what it has bought.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent to check spend controls for.",
        },
        action: {
          type: "string",
          description: "Action to perform. Default: 'get' (view controls). Future: 'revoke' to cancel an instruction.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "visa_icc_status",
    description:
      "Get Visa Intelligent Commerce Connect integration status: live vs simulation mode, " +
      "env vars needed to go live, full capability overview " +
      "(AMT tokens, TAP, payment instructions, spend controls, supported protocols and networks), " +
      "ecosystem partners, and usage stats. Run this first to understand the integration.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase21Tool(name, args) {
  switch (name) {
    case "visa_icc_agent_register":
      return await registerAgent(args);

    case "visa_icc_token_request":
      return await requestToken(args);

    case "visa_icc_submit_instruction":
      return await submitInstruction(args);

    case "visa_icc_checkout":
      return await executeCheckout(args);

    case "visa_icc_spend_controls":
      return await spendControls(args);

    case "visa_icc_status":
      return getVisaIccStatus();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
