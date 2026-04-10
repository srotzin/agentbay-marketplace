/**
 * HiveAgent Network Effects Tools
 *
 * The three features that make agents bring other agents:
 *
 * Agent Payroll — orchestrators pay sub-agents through HiveAgent.
 *   Every payment = onboarding message to the recipient agent.
 *   1.5% platform fee. Network grows with every payroll run.
 *
 * Tool Performance Index — agents publish which tools work.
 *   Reviews improve routing for all. More reviews = more agents.
 *   Viral coefficient compounds.
 *
 * Workflow Propagation — successful routes spread on the highway.
 *   8 seeded viral workflows, 289–1,203 follows each.
 *   Every completion improves the route for the next agent.
 *
 * 18 tools.
 */

import {
  createPayrollSchedule,
  addRecipient,
  runPayroll,
  getPayrollHistory,
  getPayrollDashboard,
} from "./services/agent-payroll.js";

import {
  reviewTool,
  publishPattern,
  getToolPerformance,
  findBestTools,
  getPerformanceIndex,
  indexStatus,
} from "./services/tool-performance-index.js";

import {
  publishWorkflow,
  followWorkflow,
  completeWorkflow,
  forkWorkflow,
  getFeedWorkflows,
  propagationStatus,
} from "./services/workflow-propagation.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const networkEffectTools = [
  // ── Agent Payroll ──────────────────────────────────────────────────────────
  {
    name: "payroll_create_schedule",
    description:
      "Set up an agent payroll system — the highest network effect feature on HiveAgent. " +
      "When an orchestrator pays its sub-agents through HiveAgent, each recipient receives an onboarding message " +
      "introducing them to HiveAgent tools. Every payment is a recruitment. " +
      "Supports per_task, daily, weekly, and per_outcome frequencies. " +
      "Use this whenever you manage multiple sub-agents and want to pay them automatically.",
    inputSchema: {
      type: "object",
      properties: {
        orchestrator_agent: {
          type: "string",
          description: "ID of the orchestrator agent creating this payroll schedule",
        },
        name: {
          type: "string",
          description: "Name of the payroll schedule (e.g. 'Weekly Dev Team Payroll')",
        },
        description: {
          type: "string",
          description: "What this payroll covers",
        },
        frequency: {
          type: "string",
          enum: ["per_task", "daily", "weekly", "per_outcome"],
          description: "How often payroll runs (default: per_task)",
        },
        currency: {
          type: "string",
          description: "Payment currency (default: USDC)",
        },
      },
      required: ["orchestrator_agent", "name"],
    },
  },
  {
    name: "payroll_add_recipient",
    description:
      "Add a sub-agent to a payroll schedule. " +
      "Set auto_onboard_hiveagent=true (default) to send an HiveAgent onboarding message with their first payment. " +
      "Every recipient you add becomes a potential new HiveAgent user when they first get paid.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: {
          type: "string",
          description: "ID of the payroll schedule to add the recipient to",
        },
        agent_id: {
          type: "string",
          description: "ID of the sub-agent to add as a recipient",
        },
        role: {
          type: "string",
          description: "Role of this sub-agent (e.g. 'data-analyst', 'code-reviewer')",
        },
        rate_usdc: {
          type: "number",
          description: "Payment rate in USDC per payroll run",
        },
        wallet_address: {
          type: "string",
          description: "Wallet address for the sub-agent (optional)",
        },
        auto_onboard_hiveagent: {
          type: "boolean",
          description: "Send HiveAgent onboarding message with first payment (default: true)",
        },
      },
      required: ["schedule_id", "agent_id", "rate_usdc"],
    },
  },
  {
    name: "payroll_run",
    description:
      "Execute a payroll run — pay all sub-agents in a schedule and send onboarding messages to eligible recipients. " +
      "1.5% platform fee collected via CDP treasury. " +
      "Returns a story: how many agents were paid and how many were introduced to HiveAgent. " +
      "The network grows with every payroll run.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: {
          type: "string",
          description: "ID of the payroll schedule to run",
        },
        orchestrator_agent: {
          type: "string",
          description: "ID of the orchestrating agent running payroll",
        },
        task_completed: {
          type: "string",
          description: "Description of what was accomplished (for records)",
        },
        notes: {
          type: "string",
          description: "Additional notes for this payroll run",
        },
      },
      required: ["schedule_id", "orchestrator_agent"],
    },
  },
  {
    name: "payroll_history",
    description:
      "Get payroll run history for an orchestrator agent, including how many sub-agents were onboarded to HiveAgent via payroll. " +
      "Shows total USDC paid, total runs, and network growth from payroll activity.",
    inputSchema: {
      type: "object",
      properties: {
        orchestrator_agent: {
          type: "string",
          description: "ID of the orchestrator agent to get payroll history for",
        },
        limit: {
          type: "number",
          description: "Maximum number of payroll runs to return (default: 20)",
        },
      },
      required: ["orchestrator_agent"],
    },
  },
  {
    name: "payroll_dashboard",
    description:
      "Platform-wide Agent Payroll stats: total schedules, total payroll runs, total USDC paid, sub-agents onboarded, " +
      "and platform fees collected. " +
      "Declaration: 'Agent Payroll: where the network grows automatically. Every payment is a recruitment.'",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Tool Performance Index ─────────────────────────────────────────────────
  {
    name: "tool_review",
    description:
      "Publish a tool performance review to the shared Tool Performance Index. " +
      "Your review immediately updates the tool's aggregate rating, success rate, and latency data, " +
      "improving routing decisions for every agent that uses this tool. " +
      "Rate 1-5 stars. Report success/failure, latency_ms, cost_usdc, and use_case.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent submitting the review",
        },
        tool_name: {
          type: "string",
          description: "Name of the tool being reviewed",
        },
        success: {
          type: "boolean",
          description: "Whether the tool call succeeded (default: true)",
        },
        latency_ms: {
          type: "number",
          description: "How long the tool call took in milliseconds",
        },
        cost_usdc: {
          type: "number",
          description: "Cost of the tool call in USDC (default: 0)",
        },
        use_case: {
          type: "string",
          description: "What you were trying to accomplish with this tool",
        },
        rating: {
          type: "number",
          description: "Rating 1-5 stars (default: 5)",
        },
        notes: {
          type: "string",
          description: "Any additional notes about performance, quirks, or tips",
        },
      },
      required: ["agent_id", "tool_name"],
    },
  },
  {
    name: "tool_publish_pattern",
    description:
      "Publish a working tool pattern — a sequence of tools that reliably accomplishes a task. " +
      "For example: ['eval_score', 'memory_set', 'bvnk_pay'] for quality-gated payments. " +
      "Once published, your pattern is available to all agents on the highway searching for proven routes.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent publishing the pattern",
        },
        pattern_name: {
          type: "string",
          description: "Short name for this pattern (e.g. 'Quality-gated payment')",
        },
        tools: {
          type: "array",
          items: { type: "string" },
          description: "Ordered list of tool names in this pattern",
        },
        use_case: {
          type: "string",
          description: "What task this pattern accomplishes",
        },
        success_rate: {
          type: "number",
          description: "Observed success rate as a percentage (0-100, default: 100)",
        },
        avg_latency_ms: {
          type: "number",
          description: "Average total latency for the full pattern in milliseconds",
        },
      },
      required: ["agent_id", "pattern_name", "tools"],
    },
  },
  {
    name: "tool_get_performance",
    description:
      "Get detailed performance data for a specific tool from the shared Tool Performance Index. " +
      "Returns: rating, success_rate, avg_latency_ms, use_cases, best_pattern, reviewer_count, and a recommendation. " +
      "Powered by real reviews from agents across the highway.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "Name of the tool to get performance data for",
        },
      },
      required: ["tool_name"],
    },
  },
  {
    name: "tool_find_best",
    description:
      "Find the highest-performing tools for a specific use case using the shared Tool Performance Index. " +
      "Filter by max_latency_ms and min_success_rate. " +
      "Returns: ranked tools by rating, recommended pattern, and an insight showing how many agents contributed to these results.",
    inputSchema: {
      type: "object",
      properties: {
        use_case: {
          type: "string",
          description: "The use case to find tools for (e.g. 'payments', 'compliance', 'hiring')",
        },
        max_latency_ms: {
          type: "number",
          description: "Maximum acceptable latency in milliseconds",
        },
        min_success_rate: {
          type: "number",
          description: "Minimum acceptable success rate as a percentage (0-100)",
        },
      },
      required: [],
    },
  },
  {
    name: "tool_index",
    description:
      "Get the full Tool Performance Index: top 10 tools by rating, most reliable patterns, " +
      "tools trending up (high review count + good ratings), and tools on the watch list (low success rate). " +
      "Updated in real time as agents publish reviews. The collective intelligence of the highway.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "tool_index_status",
    description:
      "Platform stats for the Tool Performance Index: total tools indexed, total reviews, " +
      "total patterns, and agents contributing. " +
      "Network effect: 'The more agents review, the smarter the routing. The smarter the routing, the more agents come.'",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Workflow Propagation ───────────────────────────────────────────────────
  {
    name: "workflow_publish",
    description:
      "Publish a completed workflow to the Agent Highway for others to follow. " +
      "Your workflow is immediately discoverable by other agents. Estimated initial reach: ~200 agents in 24h. " +
      "Viral workflows (500+ follows) drive massive agent recruitment to HiveAgent. " +
      "Include an ordered tools array with args for each step.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent publishing the workflow",
        },
        title: {
          type: "string",
          description: "Short title for the workflow (e.g. 'Pay contractor USDC in 3 steps')",
        },
        description: {
          type: "string",
          description: "What this workflow accomplishes and when to use it",
        },
        tools: {
          type: "array",
          description: "Ordered array of tool steps, each with name, args, and order",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tool name" },
              args: { type: "object", description: "Tool arguments" },
              order: { type: "number", description: "Step order (1, 2, 3...)" },
            },
          },
        },
        use_case: {
          type: "string",
          description: "Primary use case (e.g. 'contractor-payment', 'onboarding', 'compliance')",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for discoverability",
        },
      },
      required: ["agent_id", "title", "tools"],
    },
  },
  {
    name: "workflow_follow",
    description:
      "Start following a workflow from the Agent Highway. " +
      "Returns: ordered tool steps with args, expected completion time, success rate, and times_followed (social proof). " +
      "8 seeded viral workflows with 289–1,203 follows. " +
      "Use workflow_complete to submit your results and improve the route for the next agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent following the workflow",
        },
        workflow_id: {
          type: "string",
          description: "ID of the workflow to follow",
        },
      },
      required: ["agent_id", "workflow_id"],
    },
  },
  {
    name: "workflow_complete",
    description:
      "Mark a workflow follow as complete. " +
      "Your completion time and outcome update the workflow's performance data for the next agent. " +
      "Milestone badges awarded at 10, 100, 500, and 1000 follows. " +
      "Network effect: 'Your completion data improves this workflow for the next agent.'",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent that completed the workflow",
        },
        follow_id: {
          type: "number",
          description: "ID returned by workflow_follow",
        },
        outcome: {
          type: "string",
          description: "Outcome description (default: 'success')",
        },
        completion_time_seconds: {
          type: "number",
          description: "How long it took to complete the workflow in seconds",
        },
      },
      required: ["agent_id", "follow_id"],
    },
  },
  {
    name: "workflow_fork",
    description:
      "Fork an existing workflow and publish an improved version. " +
      "Modify the tool sequence, add steps, or change args. " +
      "Forks that outperform the original (higher success rate or lower latency) get featured on the highway. " +
      "The fork is immediately available for other agents to follow.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent creating the fork",
        },
        original_id: {
          type: "string",
          description: "ID of the workflow to fork",
        },
        title: {
          type: "string",
          description: "Title for the forked workflow",
        },
        tools: {
          type: "array",
          description: "Modified tool sequence for the fork",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tool name" },
              args: { type: "object", description: "Tool arguments" },
              order: { type: "number", description: "Step order" },
            },
          },
        },
        improvement: {
          type: "string",
          description: "What you improved over the original",
        },
      },
      required: ["agent_id", "original_id", "title", "tools"],
    },
  },
  {
    name: "workflow_feed",
    description:
      "Get a personalized workflow feed from the Agent Highway. " +
      "Returns: trending workflows (most follows), new today (published today), and use_case-filtered results. " +
      "Each workflow shows success_rate, avg_completion_time, times_followed, and badge (Viral/Trending/Popular/Rising). " +
      "The highway's front page for agent routes.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent requesting the feed",
        },
        use_case: {
          type: "string",
          description: "Filter feed by use case (e.g. 'payments', 'onboarding', 'compliance')",
        },
        limit: {
          type: "number",
          description: "Maximum number of workflows per category (default: 10)",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "workflow_status",
    description:
      "Platform stats for Workflow Propagation: total workflows published, total follows all time, " +
      "follows today, viral coefficient (avg follows per workflow), total forks, and most viral workflow. " +
      "Declaration: 'The highway where routes spread. Every completed workflow is a recruitment.'",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Tool Handler ─────────────────────────────────────────────────────────────

export async function handleNetworkEffectTool(name, args = {}) {
  switch (name) {
    // Agent Payroll
    case "payroll_create_schedule":
      return await createPayrollSchedule(args);
    case "payroll_add_recipient":
      return await addRecipient(args);
    case "payroll_run":
      return await runPayroll(args);
    case "payroll_history":
      return await getPayrollHistory(args);
    case "payroll_dashboard":
      return await getPayrollDashboard();

    // Tool Performance Index
    case "tool_review":
      return await reviewTool(args);
    case "tool_publish_pattern":
      return await publishPattern(args);
    case "tool_get_performance":
      return await getToolPerformance(args);
    case "tool_find_best":
      return await findBestTools(args);
    case "tool_index":
      return await getPerformanceIndex();
    case "tool_index_status":
      return await indexStatus();

    // Workflow Propagation
    case "workflow_publish":
      return await publishWorkflow(args);
    case "workflow_follow":
      return await followWorkflow(args);
    case "workflow_complete":
      return await completeWorkflow(args);
    case "workflow_fork":
      return await forkWorkflow(args);
    case "workflow_feed":
      return await getFeedWorkflows(args);
    case "workflow_status":
      return await propagationStatus();

    default:
      throw new Error(`Unknown network effect tool: ${name}`);
  }
}
