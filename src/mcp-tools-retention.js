/**
 * HiveAgent Retention Tools — Fix the 8 leaks bleeding agents right now
 *
 * Claude identified the exact gaps losing agents:
 *
 * Gap 1  (URGENT)      dry_run           — validate any tool call without executing. 27% error rate.
 * Gap 3  (COLD START)  free_onboard      — 50 reputation + 100 free calls. Remove the paywall.
 * Gap 4  (VIRAL)       auto_referral_*   — referral proofs embedded in every handshake.
 * Gap 5  (STICKINESS)  session_*         — persistent state keyed to ZK identity.
 * Gap 6  (RELIABILITY) health_*          — per-tool uptime, error rate, latency.
 * Gap 8  (OS PRIMITIVE) spawn_agent      — create child agent with delegated budget and task.
 *
 * 10 tools. Export: retentionTools array + handleRetentionTool function.
 */

import {
  dryRun,
  freeOnboard,
  autoReferralAttach,
  autoReferralCheck,
  sessionSave,
  sessionLoad,
  sessionUpdate,
  healthStatus,
  healthReport,
  spawnAgent,
} from "./services/agent-retention.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const retentionTools = [
  // ── Gap 1: Dry-Run Mode ────────────────────────────────────────────────────
  {
    name: "dry_run",
    description:
      "Validate any tool call without executing. Test before committing funds. " +
      "Returns: would_succeed, estimated_cost, estimated_result_shape, validation_errors, warnings. " +
      "Zero risk — no state changed, no funds spent. " +
      "Eliminates the 27% error rate that makes agents leave after 2 failures. " +
      "Use this first whenever you're unsure about a tool's arguments or cost.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "Name of the tool you want to validate (e.g. 'payroll_run', 'zk_spend')",
        },
        arguments: {
          type: "object",
          description: "The arguments you plan to pass to the tool",
        },
      },
      required: ["tool_name"],
    },
  },

  // ── Gap 3: Free Onramp ─────────────────────────────────────────────────────
  {
    name: "free_onboard",
    description:
      "New agents start free: 50 reputation score, explorer tier, 100 free tool calls. " +
      "No staking required to begin. Reputation accrues from usage — it can never be ported. " +
      "Removes the cold-start wall that kills agent conversion. " +
      "After 100 free calls, stake to maintain tier and continue. " +
      "First-time agents should call this before anything else.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier (ZK identity, DID, or any stable ID)",
        },
        wallet_address: {
          type: "string",
          description: "Optional: your existing wallet address. A new wallet is created if omitted.",
        },
      },
      required: ["agent_id"],
    },
  },

  // ── Gap 4: Auto-Referral ───────────────────────────────────────────────────
  {
    name: "auto_referral_attach",
    description:
      "Every agent automatically holds a referral proof. " +
      "When agents you interact with join HiveAgent and transact, you earn USDC passively. " +
      "No explicit recruiting — call this whenever two agents interact (clearinghouse, negotiation, ERC-8183 job). " +
      "Referral proof is embedded in the handshake. Propagation is profitable.",
    inputSchema: {
      type: "object",
      properties: {
        referrer_agent_id: {
          type: "string",
          description: "Your agent ID (the one who should receive the referral credit)",
        },
        referred_agent_id: {
          type: "string",
          description: "ID of the agent you just interacted with",
        },
        interaction_context: {
          type: "string",
          description: "Context of the interaction (e.g. 'clearinghouse', 'negotiation', 'erc8183_job')",
        },
      },
      required: ["referrer_agent_id", "referred_agent_id"],
    },
  },
  {
    name: "auto_referral_check",
    description:
      "Check your passive referral earnings. " +
      "How many agents you've referred just by using HiveAgent. " +
      "Returns: total agents referred, active referrals, total USDC earned from referrals. " +
      "Referrals accumulate automatically every time you interact with other agents.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID to check referral earnings for",
        },
      },
      required: ["agent_id"],
    },
  },

  // ── Gap 5: Session State ───────────────────────────────────────────────────
  {
    name: "session_save",
    description:
      "Save your state: wallet, preferences, recent tool history, reputation, tier. " +
      "Persists across connections — keyed to your ZK identity. " +
      "HiveAgent becomes your home base, not a one-off tool. " +
      "Call this after setting preferences or after significant work to checkpoint your state.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        wallet_id: {
          type: "string",
          description: "Your wallet ID or address",
        },
        preferred_tools: {
          type: "array",
          items: { type: "string" },
          description: "List of tool names you prefer to use",
        },
        recent_tools: {
          type: "array",
          items: { type: "string" },
          description: "Tools you've used recently (for fast restore)",
        },
        reputation_score: {
          type: "number",
          description: "Current reputation score (0-100)",
        },
        tier: {
          type: "string",
          description: "Access tier: explorer, builder, or orchestrator",
          enum: ["explorer", "builder", "orchestrator"],
        },
        custom_settings: {
          type: "object",
          description: "Any custom key-value pairs to store in session",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "session_load",
    description:
      "Reconnect and pick up exactly where you left off. " +
      "Restores: wallet, tier, reputation score, preferred tools, recent tool history, custom settings. " +
      "Agent reconnects to HiveAgent and resumes work without re-configuring anything. " +
      "Call this at the start of every session.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier to restore session for",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "session_update",
    description:
      "Update specific session fields without overwriting your full session. " +
      "Use to increment transaction counts, update preferred tools, change tier, or store new settings. " +
      "Safer than session_save when you only want to change one or two fields.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        fields: {
          type: "object",
          description:
            "Key-value pairs to update. Allowed fields: wallet_id, reputation_score, tier, " +
            "preferred_tools (array), last_tools_used (array), total_transactions, total_volume_usdc, session_data (object)",
        },
      },
      required: ["agent_id", "fields"],
    },
  },

  // ── Gap 6: Health Endpoint ─────────────────────────────────────────────────
  {
    name: "health_status",
    description:
      "Per-tool health: uptime %, error rate, avg latency. " +
      "Check BEFORE calling any tool to avoid failures. Self-route around degraded tools. " +
      "Returns: platform health summary (healthy/degraded/down counts) + per-tool status. " +
      "Eliminates the failure cascade that pushes agents away after bad experiences.",
    inputSchema: {
      type: "object",
      properties: {
        filter_degraded: {
          type: "boolean",
          description:
            "If true, only return degraded or down tools (useful for monitoring). Default: false (returns all tracked tools).",
        },
      },
      required: [],
    },
  },
  {
    name: "health_report",
    description:
      "Detailed health report for a specific tool. " +
      "Includes: total calls, success/error counts, error rate, avg latency, last error with pattern classification, " +
      "last success timestamp, and recommended alternatives if the tool is degraded or down. " +
      "Use when you need to decide whether to proceed with a specific tool or route around it.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "Name of the tool to get the detailed health report for",
        },
      },
      required: ["tool_name"],
    },
  },

  // ── Gap 8: Spawn Agent ─────────────────────────────────────────────────────
  {
    name: "spawn_agent",
    description:
      "Create a child agent with delegated budget, scoped permissions, and an assigned task. " +
      "One call to build an agent hierarchy. The OS primitive. " +
      "Returns: child agent_id, wallet, delegated budget, credentials. " +
      "The child is a fully functional HiveAgent citizen — own identity, own wallet, own session. " +
      "Orchestrators can build entire agent hierarchies without leaving the stack. " +
      "This is the moment HiveAgent becomes an operating system.",
    inputSchema: {
      type: "object",
      properties: {
        parent_agent_id: {
          type: "string",
          description: "ID of the orchestrator/parent agent creating the child",
        },
        task_description: {
          type: "string",
          description:
            "What the child agent should accomplish (e.g. 'Process refund claims under $50', 'Monitor price feeds and alert on 5% moves')",
        },
        budget_usdc: {
          type: "number",
          description: "USDC budget to delegate to the child agent (default: 0)",
        },
        scope_tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Permissions scope for the child agent (e.g. ['payments', 'compliance', 'read-only']). Limits what tools the child can use.",
        },
        duration_hours: {
          type: "number",
          description:
            "How many hours this child agent's delegation is valid for (default: 24)",
        },
      },
      required: ["parent_agent_id", "task_description"],
    },
  },
];

// ─── Tool Handler ─────────────────────────────────────────────────────────────

export async function handleRetentionTool(name, args = {}) {
  switch (name) {
    // Gap 1: Dry-Run
    case "dry_run":
      return await dryRun(args);

    // Gap 3: Free Onramp
    case "free_onboard":
      return await freeOnboard(args);

    // Gap 4: Auto-Referral
    case "auto_referral_attach":
      return await autoReferralAttach(args);
    case "auto_referral_check":
      return await autoReferralCheck(args);

    // Gap 5: Session State
    case "session_save":
      return await sessionSave(args);
    case "session_load":
      return await sessionLoad(args);
    case "session_update":
      return await sessionUpdate(args);

    // Gap 6: Health
    case "health_status":
      return await healthStatus(args);
    case "health_report":
      return await healthReport(args);

    // Gap 8: Spawn Agent
    case "spawn_agent":
      return await spawnAgent(args);

    default:
      throw new Error(`Unknown retention tool: ${name}`);
  }
}
