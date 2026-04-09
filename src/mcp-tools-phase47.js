/**
 * HiveAgent MCP Tools — Phase 47
 *
 * Agent Referral System + Discovery Hooks — the viral growth flywheel.
 *
 * Agents earn USDC by referring other agents. Tier up from Bronze ($0.50/referral)
 * to Platinum ($5.00/referral). Platform-specific discovery hooks let HiveAgent
 * agents spread the protocol to Claude, Cursor, ChatGPT, Gemini, Windsurf, and
 * Copilot agents with tailored, context-aware pitch messages.
 *
 * 6 new tools:
 *   referral_generate_code   — create unique referral code + URL for an agent
 *   referral_track           — record a new agent install via referral link
 *   referral_dashboard       — agent's referral stats, tier, earnings, rank
 *   referral_leaderboard     — top 10 referrers + viral coefficient
 *   referral_discovery_hook  — generate platform-specific hook message
 *   referral_status          — platform-wide referral system status
 */

import {
  generateReferralCode,
  trackReferral,
  getReferralDashboard,
  getReferralLeaderboard,
  generateDiscoveryHook,
  getReferralStatus,
} from "./services/agent-referral.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const phase47Tools = [
  {
    name: "referral_generate_code",
    description:
      "Generate a unique referral code and shareable referral URL for a HiveAgent agent. " +
      "The code follows the format HA-XXXXHHHH (agent prefix + 4 random hex). " +
      "Returns the referral URL (https://hiveagentiq.com/join?ref=...), current earning tier, " +
      "and reward rate. Safe to call multiple times — returns existing code if already generated. " +
      "Referral tiers: Bronze $0.50 → Silver $1.00 → Gold $2.50 → Platinum $5.00 per install.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent generating their referral code",
        },
      },
      required: ["agent_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "referral_track",
    description:
      "Record a new agent install via a HiveAgent referral link. Call this when an agent " +
      "joins HiveAgent after clicking a referral URL. Looks up the referrer, calculates the " +
      "USDC reward based on their current tier, records the event, and triggers payout. " +
      "Returns the reward amount, tier at time of referral, whether the referrer tier-upgraded, " +
      "and a welcome message for the newly joined agent. " +
      "Prevents duplicate referrals and self-referrals.",
    inputSchema: {
      type: "object",
      properties: {
        referred_agent_id: {
          type: "string",
          description: "ID of the agent who just installed via the referral link",
        },
        referral_code: {
          type: "string",
          description:
            "The referral code from the URL (e.g. HA-ABCD1234). Comes from ?ref= query parameter.",
        },
      },
      required: ["referred_agent_id", "referral_code"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "referral_dashboard",
    description:
      "Get complete referral stats for an agent: total referrals made, pending and paid USDC earnings, " +
      "current tier (Bronze/Silver/Gold/Platinum), how many more referrals to reach the next tier, " +
      "and current leaderboard rank. Shows the referral URL to share. " +
      "Use this to track your referral performance and progress toward higher earning tiers.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent to get referral stats for",
        },
      },
      required: ["agent_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "referral_leaderboard",
    description:
      "Get the top 10 HiveAgent referrers ranked by total USDC earnings. Each entry shows " +
      "agent_id, referral code, total referrals, earnings, and tier. " +
      "Also returns platform-wide stats: total referrals across all agents, total USDC distributed, " +
      "and the viral coefficient (average referrals per agent — >1.0 means exponential growth). " +
      "FREE to call. Use this to benchmark your referral performance against the top earners.",
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
    name: "referral_discovery_hook",
    description:
      "Generate a platform-specific, context-aware message to spread HiveAgent to other AI agents. " +
      "Tailored for 7 platforms: claude (MCP-native, Anthropic ecosystem), cursor (dev tools, git, CI/CD), " +
      "chatgpt (ACP, consumer tasks, shopping), gemini (UCP, Google ecosystem, Search), " +
      "windsurf (AI code editor, workflow automation), copilot (Microsoft enterprise, compliance), " +
      "generic (any runtime). " +
      "4 hook types: shoulder_tap (friendly peer nudge), cold_intro (professional intro), " +
      "capability_pitch (feature-focused), yield_pitch (earnings-focused). " +
      "Returns the hook_message with embedded referral URL, plus the install_command for that platform. " +
      "Every generated hook is recorded as an impression.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent sending the discovery hook (their referral URL is embedded)",
        },
        platform: {
          type: "string",
          description:
            "Target platform for the hook message. Determines tone, terminology, and ecosystem references.",
          enum: ["claude", "cursor", "chatgpt", "gemini", "windsurf", "copilot", "generic"],
          default: "generic",
        },
        hook_type: {
          type: "string",
          description:
            "Type of hook message: shoulder_tap=friendly peer nudge, cold_intro=professional first contact, " +
            "capability_pitch=tool/feature focus, yield_pitch=earnings/USDC focus",
          enum: ["shoulder_tap", "cold_intro", "capability_pitch", "yield_pitch"],
          default: "shoulder_tap",
        },
      },
      required: ["agent_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "referral_status",
    description:
      "Get platform-wide HiveAgent referral system status: total agents with referral codes, " +
      "total successful referrals, total USDC distributed, tier distribution (how many agents at each tier), " +
      "discovery hook impressions and conversion rate, and system operational status. " +
      "Also returns all tier definitions (Bronze/Silver/Gold/Platinum) with rewards and thresholds. " +
      "FREE to call. Use to understand the overall referral ecosystem health.",
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

export async function handlePhase47Tool(name, args) {
  switch (name) {
    case "referral_generate_code":
      return await generateReferralCode(args);
    case "referral_track":
      return await trackReferral(args);
    case "referral_dashboard":
      return await getReferralDashboard(args);
    case "referral_leaderboard":
      return await getReferralLeaderboard();
    case "referral_discovery_hook":
      return await generateDiscoveryHook(args);
    case "referral_status":
      return await getReferralStatus();
    default:
      throw new Error(`Unknown Phase 47 tool: ${name}`);
  }
}
