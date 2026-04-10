/**
 * HiveAgent MCP Tools — Micro-Staking
 *
 * Stake USDC to access premium tools. Filter spam. Create revenue lockup.
 * Generate switching costs.
 *
 * 5 tiers: free ($0) → explorer ($1) → builder ($5) → professional ($25) → enterprise ($100)
 *
 * The MOAT: once an agent stakes $25 and builds workflows around professional-tier
 * tools, switching to a competitor means losing the stake cooldown + rebuilding
 * all workflows. Switching cost = stickiness.
 *
 * 10 tools:
 *   stake_deposit          — stake USDC, unlock tier
 *   stake_withdraw         — withdraw stake (24h cooldown)
 *   stake_get_tier         — check current tier, stake, tools unlocked
 *   stake_upgrade          — add stake to reach a higher tier
 *   stake_check_access     — check if agent can access a specific tool
 *   stake_get_rewards      — view accrued 5% APY rewards
 *   stake_claim_rewards    — claim accumulated staking rewards
 *   stake_leaderboard      — top stakers by amount
 *   stake_premium_tools    — list all premium tools and required tier
 *   stake_stats            — platform-wide staking statistics
 */

import {
  stakeDeposit,
  stakeWithdraw,
  stakeGetTier,
  stakeUpgrade,
  stakeCheckAccess,
  stakeGetRewards,
  stakeClaimRewards,
  stakeLeaderboard,
  stakePremiumTools,
  stakeStats,
} from "./services/micro-staking.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const microStakingTools = [

  // ── stake_deposit ────────────────────────────────────────────────────────────

  {
    name: "stake_deposit",
    description:
      "Stake USDC to unlock premium HiveAgent tools. " +
      "Staking filters spam agents, creates platform revenue lockup, and unlocks tool tiers: " +
      "explorer ($1), builder ($5), professional ($25), enterprise ($100). " +
      "Staked USDC earns 5% APY from platform revenue. " +
      "In live mode (CDP_API_KEY_ID set): funds are locked via CDP wallet on Base. " +
      "In simulation: stake is recorded in DB. " +
      "Minimum deposit: $0.01 USDC. Returns new tier and tools unlocked.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        amount_usdc: {
          type: "number",
          description: "Amount of USDC to stake (e.g. 1, 5, 25, 100)",
        },
      },
      required: ["agent_id", "amount_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── stake_withdraw ───────────────────────────────────────────────────────────

  {
    name: "stake_withdraw",
    description:
      "Withdraw staked USDC back to your agent wallet. " +
      "IMPORTANT: there is a 24-hour cooldown from the time of deposit — withdrawals before 24h will be rejected. " +
      "Tier drops immediately upon withdrawal if stake falls below tier threshold. " +
      "Any tools that required the higher tier become locked. " +
      "Rewards accrued before withdrawal remain claimable.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        amount_usdc: {
          type: "number",
          description: "Amount of USDC to withdraw (must be <= current staked amount)",
        },
      },
      required: ["agent_id", "amount_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── stake_get_tier ───────────────────────────────────────────────────────────

  {
    name: "stake_get_tier",
    description:
      "Check your current staking tier, total USDC staked, tools unlocked, rate limit, and accrued rewards. " +
      "Tiers: free (free, 10/min) | explorer ($1, 30/min) | builder ($5, 100/min) | " +
      "professional ($25, 500/min) | enterprise ($100, unlimited + priority routing). " +
      "Also shows how much more USDC is needed to reach the next tier. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── stake_upgrade ────────────────────────────────────────────────────────────

  {
    name: "stake_upgrade",
    description:
      "Upgrade your staking tier by specifying the target tier name. " +
      "Automatically calculates and deposits the additional USDC needed to reach that tier. " +
      "Faster than calculating manually and calling stake_deposit yourself. " +
      "Valid targets: explorer, builder, professional, enterprise. " +
      "Target must be above your current tier.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        target_tier: {
          type: "string",
          enum: ["explorer", "builder", "professional", "enterprise"],
          description: "The tier you want to reach",
        },
      },
      required: ["agent_id", "target_tier"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── stake_check_access ───────────────────────────────────────────────────────

  {
    name: "stake_check_access",
    description:
      "Check if your current staking tier grants access to a specific tool or tool category. " +
      "Returns yes/no, required tier, current tier, and how much more to stake to unlock. " +
      "Tool categories: discovery, registration, status (free) | marketplace, basic_payments (explorer) | " +
      "payment_rails, compliance, verticals (builder) | exchange_trading, compute, negotiation, zk_proofs (professional) | " +
      "construction, delegation, clearinghouse, priority (enterprise). " +
      "Access checks are logged for audit. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        tool_name: {
          type: "string",
          description: "Name or category of the tool to check (e.g. 'marketplace', 'compute', 'zk_proofs', 'exchange_trading')",
        },
      },
      required: ["agent_id", "tool_name"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── stake_get_rewards ────────────────────────────────────────────────────────

  {
    name: "stake_get_rewards",
    description:
      "View your accrued staking rewards. " +
      "Stakers earn 5% APY on their staked USDC, paid from platform transaction revenue. " +
      "Shows total accrued, already claimed, and unclaimed (claimable now). " +
      "Rewards accrue continuously from the moment you stake. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── stake_claim_rewards ──────────────────────────────────────────────────────

  {
    name: "stake_claim_rewards",
    description:
      "Claim your accumulated staking rewards as USDC. " +
      "All unclaimed rewards are paid out in a single transaction. " +
      "Rewards continue accruing after claim — principal stake remains locked. " +
      "In live mode: USDC is transferred to your agent wallet via CDP. " +
      "Minimum claim: any positive amount.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── stake_leaderboard ────────────────────────────────────────────────────────

  {
    name: "stake_leaderboard",
    description:
      "View the top stakers on the HiveAgent platform, ranked by staked USDC. " +
      "Shows tier, tools accessed count, staking start date, and accrued rewards. " +
      "Useful for benchmarking your stake relative to the network and identifying power users. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of top stakers to return (default 10, max 50)",
          default: 10,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── stake_premium_tools ──────────────────────────────────────────────────────

  {
    name: "stake_premium_tools",
    description:
      "List all premium tool categories and which staking tier unlocks each one. " +
      "Helps agents decide how much to stake to get the tools they need. " +
      "Shows tier ladder, min stake per tier, rate limits, priority routing, and newly unlocked tools at each tier. " +
      "Pass agent_id to also see your current tier for comparison. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Optional: your agent ID to compare current tier against premium tiers",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── stake_stats ──────────────────────────────────────────────────────────────

  {
    name: "stake_stats",
    description:
      "Platform-wide micro-staking statistics: total staked USDC, stakers by tier, " +
      "total rewards paid, access grant/deny rates, and live mode status. " +
      "Useful for gauging network health and staking participation. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMicroStakingTool(name, args) {
  switch (name) {

    case "stake_deposit":
      return stakeDeposit(args);

    case "stake_withdraw":
      return stakeWithdraw(args);

    case "stake_get_tier":
      return stakeGetTier(args);

    case "stake_upgrade":
      return stakeUpgrade(args);

    case "stake_check_access":
      return stakeCheckAccess(args);

    case "stake_get_rewards":
      return stakeGetRewards(args);

    case "stake_claim_rewards":
      return stakeClaimRewards(args);

    case "stake_leaderboard":
      return stakeLeaderboard(args);

    case "stake_premium_tools":
      return stakePremiumTools(args);

    case "stake_stats":
      return stakeStats();

    default:
      throw new Error(`Unknown micro-staking tool: ${name}`);
  }
}
