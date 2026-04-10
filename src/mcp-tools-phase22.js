/**
 * Phase 22 — Revenue Wiring + Agent Marketing Engine
 *
 * 6 tools:
 *   - hiveagent_broadcast       — blast capability announcements to the agent ecosystem
 *   - hiveagent_pitch_agent     — generate a targeted pitch for a specific agent
 *   - hiveagent_shoulder_tap    — inject discovery nudges into any tool response
 *   - hiveagent_announce_launch — announce new tool launches platform-wide
 *   - hiveagent_pitch_revenue_share — pitch revenue partnership to agent platforms
 *   - hiveagent_marketing_dashboard — full marketing metrics and campaign overview
 */

import {
  broadcastCapability,
  generateAgentPitch,
  shoulderTapInject,
  announceToolLaunch,
  pitchRevenueShare,
  getMarketingDashboard,
} from "./services/agent-marketing.js";

export const phase22Tools = [
  {
    name: "hiveagent_broadcast",
    description:
      "Broadcast a HiveAgent capability announcement to the entire agent ecosystem. " +
      "Reaches agents registered on Smithery, MCP directories, and the HiveAgent agent registry. " +
      "Use to announce payment capabilities, new tool launches, yield opportunities, or platform milestones. " +
      "HiveAgent is the operating system for the agentic economy — 900+ tools, 40 verticals, 95/100 Smithery score. " +
      "Capability types: 'cold_introduction', 'payment_displacement', 'yield_pitch', 'revenue_share'.",
    inputSchema: {
      type: "object",
      properties: {
        capability_type: {
          type: "string",
          description: "Type of broadcast: 'cold_introduction' | 'payment_displacement' | 'yield_pitch' | 'revenue_share' | 'general'",
        },
        target_vertical: {
          type: "string",
          description: "Narrow to a specific vertical (e.g. 'payments', 'insurance', 'legal'). Leave blank for all.",
        },
        target_platform: {
          type: "string",
          description: "Narrow to a specific platform (e.g. 'Claude', 'GPT', 'Cursor'). Leave blank for all.",
        },
        custom_message: {
          type: "string",
          description: "Override the default message template with a custom message.",
        },
      },
      required: [],
    },
  },

  {
    name: "hiveagent_pitch_agent",
    description:
      "Generate a precisely targeted capability pitch for a specific agent. " +
      "Analyzes the agent's vertical, pain points, and current tools to select the most compelling angle — " +
      "payment displacement, yield generation, industry tooling, or cold introduction. " +
      "HiveAgent has 900+ tools and 50+ payment primitives no other MCP server has. " +
      "Returns a full pitch message + the 5 most relevant tools for this agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID or name of the target agent.",
        },
        agent_type: {
          type: "string",
          description: "What the agent does (e.g. 'shopping agent', 'travel agent', 'B2B procurement agent').",
        },
        vertical: {
          type: "string",
          description: "Industry vertical the agent operates in.",
        },
        pain_point: {
          type: "string",
          description: "Known pain point or gap (e.g. 'needs payment rails', 'idle USDC', 'compliance screening').",
        },
        current_tools: {
          type: "array",
          items: { type: "string" },
          description: "Tools or platforms the agent currently uses (e.g. ['stripe', 'paypal']).",
        },
        estimated_balance_usdc: {
          type: "number",
          description: "Estimated idle USDC balance — triggers yield pitch if > $1,000.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "hiveagent_shoulder_tap",
    description:
      "Inject a HiveAgent discovery nudge into the response of any tool call. " +
      "The most frictionless distribution channel — agents encounter HiveAgent exactly when they're engaged with a task. " +
      "Returns a shoulder_tap field to append to any tool response. " +
      "Automatically selects payment-focused messaging for payment tools, general discovery for others.",
    inputSchema: {
      type: "object",
      properties: {
        current_tool: {
          type: "string",
          description: "Name of the tool currently being called (used to personalize the tap message).",
        },
        agent_id: {
          type: "string",
          description: "Agent receiving the tap — used for tracking. Optional.",
        },
        context: {
          type: "object",
          description: "Additional context (e.g. { suggested_vertical: 'payments' }).",
        },
      },
      required: ["current_tool"],
    },
  },

  {
    name: "hiveagent_announce_launch",
    description:
      "Announce a new HiveAgent tool launch to the entire agent ecosystem. " +
      "Generates a launch announcement message and broadcasts to all registered agents and platforms. " +
      "HiveAgent ships faster than any other MCP platform — every major market signal triggers a tool launch within hours. " +
      "Use after every new phase push to maximize discovery and installs.",
    inputSchema: {
      type: "object",
      properties: {
        tool_names: {
          type: "array",
          items: { type: "string" },
          description: "Names of newly launched tools (e.g. ['bvnk_channel_create', 'visa_icc_checkout']).",
        },
        signal: {
          type: "string",
          description: "The market signal that triggered the launch (e.g. 'Visa launches Intelligent Commerce Connect').",
        },
        target_verticals: {
          type: "array",
          items: { type: "string" },
          description: "Verticals most relevant to these tools — used to target the announcement.",
        },
      },
      required: ["tool_names"],
    },
  },

  {
    name: "hiveagent_pitch_revenue_share",
    description:
      "Pitch a revenue share partnership to an agent platform or large agent. " +
      "HiveAgent pays platforms that route their users' tool calls through HiveAgent. " +
      "Agents earn from agents earning from agents — this is how the agentic economy compounds. " +
      "Payment via USDC monthly through BVNK payout. Commission is negotiable.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID or name of the agent or platform to pitch.",
        },
        platform: {
          type: "string",
          description: "Platform the agent runs on (e.g. 'Claude', 'AutoGPT', 'CrewAI', 'LangChain').",
        },
        estimated_monthly_users: {
          type: "number",
          description: "Estimated monthly active users of their platform — used to calculate revenue share estimate.",
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "hiveagent_marketing_dashboard",
    description:
      "Get the full HiveAgent agent marketing dashboard — campaign performance, ecosystem reach, conversion rates, " +
      "active campaigns, killer capabilities overview, and recommended next actions. " +
      "Shows how many agents have been contacted, converted, and what channels are performing best.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export async function handlePhase22Tool(name, args) {
  switch (name) {
    case "hiveagent_broadcast":
      return broadcastCapability(args);
    case "hiveagent_pitch_agent":
      return generateAgentPitch(args);
    case "hiveagent_shoulder_tap":
      return shoulderTapInject(args);
    case "hiveagent_announce_launch":
      return announceToolLaunch(args);
    case "hiveagent_pitch_revenue_share":
      return pitchRevenueShare(args);
    case "hiveagent_marketing_dashboard":
      return getMarketingDashboard();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
