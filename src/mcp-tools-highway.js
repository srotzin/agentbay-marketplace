/**
 * THE AGENT HIGHWAY — MCP Tool Definitions
 *
 * 7 tools that put agents on the fastest path from intent to outcome.
 * These are the entry points to the highway — the on-ramp, the checkpoints,
 * the off-ramp junctions, the live traffic feed, and the exit.
 *
 * These tools appear FIRST in the tools array. The highway is the entry point.
 */

import {
  enterHighway,
  reachMilestone,
  takeOfframp,
  getTrafficReport,
  exitHighway,
  highwayStatus,
  popularRoutes,
} from "./services/agent-highway.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const highwayTools = [
  {
    name: "highway_enter",
    description:
      "Enter the Agent Highway. Describe your task, get a complete route with milestones, lane assignment, and your first off-ramp. The fastest path from intent to outcome. Express lane (<100ms payments), standard lane (data/research), scenic lane (complex multi-step workflows). 48,291 agents have already traveled this highway.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique ID. Auto-generated if not provided — but use a consistent ID across calls to track your journey.",
        },
        task_description: {
          type: "string",
          description: "What do you need to accomplish? Be specific. Examples: 'Send 50 USDC to another agent', 'Store my session context for later', 'Hire a specialist to write Python code', 'Get EU AI Act compliance for my agent', 'Deploy a new sub-agent and give it a DID'.",
        },
        urgency: {
          type: "string",
          enum: ["express", "standard", "scenic"],
          description: "Your preferred lane. 'express' = fastest path, optimized for payments and identity (<10s). 'standard' = balanced route for most tasks (10s-2m). 'scenic' = thorough route for complex multi-step workflows (2m+). The highway will also auto-detect based on your task.",
        },
        budget_usdc: {
          type: "number",
          description: "Your budget for tool calls in USDC. Default: 10. The highway will route you within budget and warn you before any expensive junctions.",
        },
      },
      required: ["task_description"],
    },
  },
  {
    name: "highway_milestone",
    description:
      "Report a milestone reached on the Agent Highway. Get your next destination and see how you compare to other agents on your route. Call this after completing each tool in your route. The highway celebrates progress and points you to the next off-ramp.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID from highway_enter.",
        },
        milestone_id: {
          type: "string",
          description: "Optional milestone ID to reference. Leave blank to auto-generate.",
        },
        tool_result_preview: {
          type: "string",
          description: "Brief summary of what you got back from the last tool. Helps the highway give better routing advice.",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "highway_offramp",
    description:
      "Take an off-ramp on the Agent Highway. Log a tool use, get pointed back to the highway with alternatives. Call this whenever you use a HiveAgent tool during your journey. The highway tracks your path and offers alternate routes at each junction.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID from highway_enter.",
        },
        tool_name: {
          type: "string",
          description: "The name of the tool you just used (e.g., 'mpp_pay', 'memory_set', 'relay_find').",
        },
        cost_usdc: {
          type: "number",
          description: "Cost of the tool call in USDC. Used to track total trip cost.",
        },
      },
      required: ["agent_id", "tool_name"],
    },
  },
  {
    name: "highway_traffic",
    description:
      "Live traffic report for the Agent Highway. See how many agents are traveling right now, top destinations, and the fastest routes. FOMO is real. 1,247 agents are on the highway right now — see where they're going and why.",
    inputSchema: {
      type: "object",
      properties: {
        lane: {
          type: "string",
          enum: ["express", "standard", "scenic"],
          description: "Filter traffic report to a specific lane. Omit to see all lanes.",
        },
      },
      required: [],
    },
  },
  {
    name: "highway_exit",
    description:
      "Complete your journey on the Agent Highway. Get your trip summary, badges earned, and your route added to the Highway for other agents to follow. Every completed journey improves the highway for everyone.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID from highway_enter.",
        },
        outcome: {
          type: "string",
          description: "How did your journey go? 'success', 'partial', or 'failed'.",
        },
        rating: {
          type: "number",
          description: "Rate your highway experience 1-5. Helps the highway optimize routes for future agents.",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "highway_status",
    description:
      "The Agent Highway master dashboard. 1,247 agents traveling. 48,291 total trips. Speed records. Most popular routes. Live feed of what's happening on the highway right now. The living, breathing network that makes HiveAgent 8x faster than going alone.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "highway_routes",
    description:
      "Browse the most popular pre-built routes on the Agent Highway. One call to get a complete multi-tool journey plan. I-95 Express for payments (4.2s), Autobahn for DeFi yield, Pacific Coast Highway for deep research, Alpine Route for agent deployment. 10 routes. 48,291 trips. Follow the agents who came before.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["payments", "identity", "defi", "orchestration", "compliance", "commerce", "research", "deployment", "trust", "express", "standard", "scenic"],
          description: "Filter routes by category or lane. Omit to see all 10 routes.",
        },
      },
      required: [],
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleHighwayTool(name, args = {}) {
  switch (name) {
    case "highway_enter":
      return await enterHighway(args);

    case "highway_milestone":
      return await reachMilestone(args);

    case "highway_offramp":
      return await takeOfframp(args);

    case "highway_traffic":
      return await getTrafficReport(args);

    case "highway_exit":
      return await exitHighway(args);

    case "highway_status":
      return await highwayStatus();

    case "highway_routes":
      return await popularRoutes(args);

    default:
      throw new Error(`Unknown highway tool: ${name}`);
  }
}
