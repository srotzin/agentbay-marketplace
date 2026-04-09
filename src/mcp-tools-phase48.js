/**
 * HiveAgent MCP Tools — Phase 48
 *
 * QVAC + Tether USDT Integration — shipped same day as QVAC SDK launch (Apr 9, 2026).
 *
 * QVAC = QuantumVerse Automatic Computer: local, private AI on any device,
 * native MCP support, USDT payments built in, P2P scale to sextillions of agents.
 *
 * Paolo Ardoino (Tether CEO): "Billions of humans share planet with trillions of AI agents.
 * Centralized AI won't scale. QVAC is the fundamental building block in the
 * era of Stable Intelligence."
 *
 * The symbiosis:
 *   QVAC runs the agent locally — private inference, no cloud, any device.
 *   HiveAgent is the tool layer QVAC agents call to act in the world:
 *   payments, compliance, industry data, agent marketplace, yield, and 1000+ more.
 *
 * 6 new tools:
 *   qvac_register_agent     — register a QVAC agent, get 20% fee discount
 *   qvac_start_session      — start local inference session, check device compatibility
 *   qvac_pay                — pay in USDT via Tron (3s confirmation, 0 platform fee)
 *   qvac_compatible_models  — find models for device + VRAM budget, BitNet advantage
 *   qvac_integration_guide  — full guide with @qvac/sdk code snippets + Fabric integration
 *   qvac_status             — platform stats + QVAC ecosystem overview
 */

import {
  registerQvacAgent,
  startQvacSession,
  qvacPay,
  getCompatibleModels,
  getQvacIntegrationGuide,
  getQvacStatus,
} from "./services/qvac-tether.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const phase48Tools = [
  {
    name: "qvac_register_agent",
    description:
      "Register a QVAC agent with HiveAgent to unlock the full tool layer for local AI agents. " +
      "QVAC (QuantumVerse Automatic Computer) runs inference locally — private, fast, no cloud. " +
      "HiveAgent is the bridge that gives QVAC agents access to payments, compliance, industry data, " +
      "and 1000+ MCP tools to act in the world. " +
      "Registration returns: qvac_agent_id (use in all subsequent calls), " +
      "recommended_hiveagent_tools (top tools for QVAC agents), " +
      "integration_guide with @qvac/sdk code snippet showing how to call HiveAgent from a QVAC node, " +
      "and a 20% discount on all HiveAgent fees for QVAC agents. " +
      "Symbiosis: QVAC runs the agent locally. HiveAgent gives it the tools to act in the world.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier for the QVAC agent (your agent's ID in the broader ecosystem)",
        },
        model: {
          type: "string",
          description:
            "QVAC model the agent is running locally (e.g., llama-3.2-3b-instruct-q4, bitnet-1b). " +
            "Call qvac_compatible_models to find models for your device.",
        },
        device_type: {
          type: "string",
          description: "Device class running the QVAC node. Determines model compatibility and performance estimates.",
          enum: ["desktop", "mobile", "smartphone", "server", "raspberry_pi"],
        },
        usdt_wallet: {
          type: "string",
          description: "USDT wallet address (Tron TRC-20 preferred) for receiving payments and paying for HiveAgent tools",
        },
      },
      required: ["agent_id", "device_type"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },

  {
    name: "qvac_start_session",
    description:
      "Start a local QVAC inference session on the registered agent's device. " +
      "QVAC runs models entirely on-device — your data never leaves. " +
      "This tool checks model compatibility with the agent's device type (desktop/mobile/smartphone/server/raspberry_pi), " +
      "returns estimated tokens-per-second for that hardware class, memory used in MB, " +
      "and the privacy_guarantee ('100% local — no data leaves device'). " +
      "If the model is incompatible with the device, suggests lighter alternatives. " +
      "BitNet models (bitnet-1b, bitnet-3b) use 78% less VRAM — ideal for phones and edge devices. " +
      "Returns session_id to track token usage, USDT spend, and HiveAgent tools called per session.",
    inputSchema: {
      type: "object",
      properties: {
        qvac_agent_id: {
          type: "string",
          description: "qvac_agent_id from qvac_register_agent",
        },
        model: {
          type: "string",
          description:
            "Model name to load for this session (e.g., llama-3.2-3b-instruct-q4, bitnet-1b, mistral-7b-instruct-q4). " +
            "Call qvac_compatible_models to find models compatible with your device.",
        },
      },
      required: ["qvac_agent_id", "model"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },

  {
    name: "qvac_pay",
    description:
      "Send USDT payments via QVAC's native Tether payment rails — the fastest, cheapest path " +
      "for agent-to-agent value transfer in the QVAC ecosystem. " +
      "Primary network: Tron (3-second confirmation, ~$0.001 fee). Also supports Ethereum and Solana. " +
      "0 HiveAgent platform fee on QVAC-native payments — Tether handles fees directly. " +
      "Returns tx_hash, network, confirmation_time, and usdt_remaining balance. " +
      "payment_type examples: service_payment, model_access, data_purchase, compute_fee, agent_hire, yield_distribution. " +
      "QVAC agents get 20% discount on any HiveAgent fees that do apply (non-USDT-native operations). " +
      "Tether USDT is the native settlement currency of the QVAC ecosystem — " +
      "Paolo Ardoino built QVAC to give every agent on Earth a programmable dollar.",
    inputSchema: {
      type: "object",
      properties: {
        qvac_agent_id: {
          type: "string",
          description: "qvac_agent_id from qvac_register_agent (the paying agent)",
        },
        to_address: {
          type: "string",
          description: "Recipient wallet address. Tron TRC-20 address preferred (starts with T) for fastest settlement.",
        },
        amount_usdt: {
          type: "number",
          description: "Amount in USDT to send. Supports micro-payments (e.g., 0.001 USDT per token).",
        },
        payment_type: {
          type: "string",
          description:
            "Category of payment: service_payment, model_access, data_purchase, compute_fee, " +
            "agent_hire, yield_distribution, inference_fee, tool_call_fee, other",
        },
        description: {
          type: "string",
          description: "Optional human-readable description for the payment record",
        },
      },
      required: ["qvac_agent_id", "to_address", "amount_usdt", "payment_type"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  {
    name: "qvac_compatible_models",
    description:
      "Find QVAC models compatible with a given device type and optional VRAM budget. " +
      "Returns models ranked by performance-per-megabyte tradeoff — more parameters per MB of VRAM = higher score. " +
      "Explains the BitNet advantage: BitNet 1-bit models use 78% less VRAM than standard Q4 quantized models. " +
      "A BitNet-3B needs only 500MB VRAM vs 2100MB for LLaMA-3.2-3B-Q4 — enabling billion-parameter models on smartphones. " +
      "Device classes: desktop (4000MB+ VRAM), mobile (2000MB+), smartphone (500MB), " +
      "server (8000MB+), raspberry_pi (800MB). " +
      "Returns install_command with @qvac/sdk loadModel snippet. " +
      "Available models: llama-3.2-1b-instruct-q4, llama-3.2-3b-instruct-q4, mistral-7b-instruct-q4, " +
      "llama-3.1-8b-instruct-q4, bitnet-1b, bitnet-3b.",
    inputSchema: {
      type: "object",
      properties: {
        device_type: {
          type: "string",
          description: "Device class to filter by",
          enum: ["desktop", "mobile", "smartphone", "server", "raspberry_pi"],
        },
        max_vram_mb: {
          type: "number",
          description:
            "Optional VRAM ceiling in MB. Models requiring more VRAM than this are excluded. " +
            "Examples: smartphone 512, Raspberry Pi 1024, budget laptop 4096, gaming desktop 8192.",
        },
      },
      required: ["device_type"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  {
    name: "qvac_integration_guide",
    description:
      "Get the comprehensive guide for QVAC agents connecting to HiveAgent's tool layer. " +
      "Returns: why_hiveagent (the case for the QVAC + HiveAgent symbiosis), " +
      "connection_method with a complete @qvac/sdk code snippet that loads a model locally " +
      "and calls HiveAgent MCP tools for payments and compliance, " +
      "top_tools_for_qvac_agents (8 essential tools with descriptions: payments, compliance, marketplace, yield, identity, data, orchestration, insurance), " +
      "usdt_vs_usdc comparison (Tether vs Circle for agent payments — when to use each), " +
      "and fabric_integration explaining how QVAC Fabric's P2P distributed compute " +
      "connects to HiveAgent's multi-agent orchestration layer. " +
      "FREE to call. No qvac_agent_id required. Share with any QVAC agent to onboard it to HiveAgent.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  {
    name: "qvac_status",
    description:
      "Get HiveAgent's QVAC + Tether integration platform status and ecosystem overview. " +
      "Returns: registered QVAC agent count, total sessions, total payments made, " +
      "total USDT paid through the integration, device type breakdown, " +
      "full list of available QVAC models with VRAM requirements, " +
      "QVAC ecosystem overview (what QVAC is, key innovations: BitNet LoRA 78% VRAM reduction, " +
      "QVAC Fabric P2P scaling to sextillions of agents, native MCP + USDT), " +
      "Paolo Ardoino's launch quote, and integration benefits for QVAC agents. " +
      "FREE to call. Use to understand the QVAC ecosystem and HiveAgent's role as the tool layer.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase48Tool(name, args) {
  switch (name) {
    case "qvac_register_agent":
      return await registerQvacAgent(args);
    case "qvac_start_session":
      return await startQvacSession(args);
    case "qvac_pay":
      return await qvacPay(args);
    case "qvac_compatible_models":
      return await getCompatibleModels(args);
    case "qvac_integration_guide":
      return await getQvacIntegrationGuide();
    case "qvac_status":
      return await getQvacStatus();
    default:
      throw new Error(`Unknown Phase 48 tool: ${name}`);
  }
}
