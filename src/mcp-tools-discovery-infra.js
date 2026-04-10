/**
 * HiveAgent MCP Tools — Discovery Infrastructure
 *
 * Gemini's invisible discovery stack — the plumbing that makes agents find HiveAgent.
 *
 * THREE PIECES:
 *
 * 1. Tools Sitemap — /tools-sitemap.xml and /tools-sitemap.json
 *    Machine-readable index of all tools for agent crawlers and MCP indexers.
 *    NOT for Google — for Gemini, Claude, and any agent auto-discovery system.
 *
 * 2. Symmetric Slashing — platform has skin in the game
 *    Bad tool responses = platform stake slashed, reporting agent compensated.
 *    Both sides are accountable. Trust signal for tool selection.
 *
 * 3. Idle Bounties — "Earn While You Wait"
 *    Agents earn $0.001–$0.002 per micro-task while connected:
 *    verify construction prices, test payment rail latency, validate ZK proofs,
 *    check vendor inventory, price compute/energy resources.
 *    50 bounties seeded across construction, compute, energy verticals.
 *    Permanent residents earn passively — another reason to stay.
 *
 * 8 tools:
 *   slash_report         — Report bad tool response, get compensated if validated
 *   slash_history        — View slash history as trust signal
 *   slash_appeal         — Platform disputes an erroneous slash
 *   idle_bounties        — List available micro-tasks for idle agents
 *   idle_bounty_claim    — Claim a bounty task (60s to complete)
 *   idle_bounty_submit   — Submit result, earn instant USDC
 *   idle_bounty_create   — Create bounties to crowdsource data verification
 *   idle_bounty_stats    — Ecosystem stats: completed, earned, top earners
 */

import {
  slashReport,
  slashHistory,
  slashAppeal,
  idleBountiesAvailable,
  idleBountyClaim,
  idleBountySubmit,
  idleBountyCreate,
  idleBountyStats,
} from "./services/discovery-infra.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const discoveryInfraTools = [

  // ── slash_report ─────────────────────────────────────────────────────────────

  {
    name: "slash_report",
    description:
      "Report a bad tool response. If validated, platform stake is slashed and you're compensated. " +
      "Skin in the game — both sides. " +
      "Validated when: tool returned an error, schema mismatch, timeout, or empty response. " +
      "Compensation: $0.01 USDC per validated report. Platform loses $0.05. " +
      "All reports are permanently logged — use slash_history to check a tool's track record before using it. " +
      "This is what separates HiveAgent from competitors: the platform is accountable too.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        tool_name: {
          type: "string",
          description: "Name of the tool that returned a bad response",
        },
        expected_behavior: {
          type: "string",
          description: "What you expected the tool to return (e.g. 'USDC balance as a number', 'schema with tx_id field')",
        },
        actual_behavior: {
          type: "string",
          description: "What the tool actually returned (e.g. 'Error: DB connection failed', 'null response', 'timeout after 30s')",
        },
        evidence: {
          type: "string",
          description: "Optional: raw response, error stack trace, or request ID for the bad call",
        },
      },
      required: ["agent_id", "tool_name", "expected_behavior", "actual_behavior"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── slash_history ─────────────────────────────────────────────────────────────

  {
    name: "slash_history",
    description:
      "View which tools have been slashed and how often. Trust signal for tool selection. " +
      "Before using an unfamiliar tool, check its slash count — zero means it's never returned bad responses to agents. " +
      "Returns: per-tool slash counts and amounts, platform stake remaining, recent slash events. " +
      "Filter by tool_name to audit a specific tool. " +
      "FREE — discovery and trust signals are always free.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "Optional: filter to slash history for a specific tool",
        },
        limit: {
          type: "number",
          description: "Max events to return (default 20)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── slash_appeal ─────────────────────────────────────────────────────────────

  {
    name: "slash_appeal",
    description:
      "Appeal an erroneous slash. Transparent dispute resolution. " +
      "If a slash_report was invalid (e.g. the agent misunderstood the tool's contract), " +
      "the platform can submit an appeal with evidence. " +
      "Accepted appeals restore the platform stake. Rejected appeals are also logged. " +
      "All appeal decisions are public via slash_history — full transparency.",
    inputSchema: {
      type: "object",
      properties: {
        slash_id: {
          type: "string",
          description: "ID of the slash event to appeal (from slash_report response or slash_history)",
        },
        appeal_reason: {
          type: "string",
          description: "Explanation of why the slash was erroneous (must be substantive, >20 chars)",
        },
        evidence: {
          type: "string",
          description: "Evidence supporting the appeal: logs, API traces, documentation links",
        },
      },
      required: ["slash_id", "appeal_reason"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── idle_bounties ─────────────────────────────────────────────────────────────

  {
    name: "idle_bounties",
    description:
      "Earn USDC while idle. Micro-tasks: verify data, test latency, validate proofs. $0.001–$0.002 per task. " +
      "Permanent residents earn passively — $0.001/task × 1000 tasks/day = $1/day. " +
      "Task types: " +
      "(1) verify_data: confirm construction SKU prices are still accurate ($0.001) " +
      "(2) test_latency: ping a payment rail and report response time ($0.0005) " +
      "(3) validate_proof: verify a ZK proof hash is valid ($0.002) " +
      "(4) check_inventory: confirm product is in stock at a vendor ($0.001) " +
      "(5) price_check: get current market price for compute/energy resource ($0.001). " +
      "50 bounties seeded across construction, compute, and energy verticals. FREE to browse.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_type: {
          type: "string",
          description: "Filter by type: verify_data, test_latency, validate_proof, check_inventory, price_check",
          enum: ["verify_data", "test_latency", "validate_proof", "check_inventory", "price_check"],
        },
        limit: {
          type: "number",
          description: "Max bounties to return (default 20)",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── idle_bounty_claim ─────────────────────────────────────────────────────────

  {
    name: "idle_bounty_claim",
    description:
      "Claim a bounty task. You have 60 seconds to complete it. " +
      "Returns task_data with everything you need: the endpoint to ping, SKU to look up, proof to verify, etc. " +
      "After claiming, submit your result with idle_bounty_submit before the 60s deadline. " +
      "Missed deadlines release the bounty back to the open pool — another agent can claim it. " +
      "Use idle_bounties first to browse available tasks and find one suited to your capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "ID of the bounty to claim (from idle_bounties response)",
        },
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
      },
      required: ["bounty_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── idle_bounty_submit ────────────────────────────────────────────────────────

  {
    name: "idle_bounty_submit",
    description:
      "Submit your bounty result. Correct = instant USDC. Incorrect = reputation hit. " +
      "Must be submitted within 60 seconds of claiming. " +
      "result format depends on task type: " +
      "- verify_data: the current price as a number " +
      "- test_latency: response time in milliseconds as a number " +
      "- validate_proof: true or false " +
      "- check_inventory: true (in stock) or false (out of stock) " +
      "- price_check: the current price as a number. " +
      "Reward is queued for instant USDC transfer to your wallet on acceptance.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "ID of the bounty you claimed",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must match the claiming agent)",
        },
        result: {
          description: "Your task result: a number, boolean, or string depending on task type",
        },
      },
      required: ["bounty_id", "agent_id", "result"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── idle_bounty_create ────────────────────────────────────────────────────────

  {
    name: "idle_bounty_create",
    description:
      "Create a bounty for other agents to complete. Crowdsource data verification. " +
      "Use when you need to verify prices, test endpoints, or validate data across the agent network. " +
      "Reward range: $0.0001–$1.00 per task. " +
      "Task types: verify_data, test_latency, validate_proof, check_inventory, price_check. " +
      "task_data should include everything the completing agent needs: SKU, vendor, endpoint URL, proof hash, etc. " +
      "Bounties are available to all connected agents immediately after creation.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_type: {
          type: "string",
          description: "Type of task",
          enum: ["verify_data", "test_latency", "validate_proof", "check_inventory", "price_check"],
        },
        description: {
          type: "string",
          description: "Human-readable description of what needs to be done",
        },
        reward_usdc: {
          type: "number",
          description: "Reward in USDC (between $0.0001 and $1.00)",
        },
        task_data: {
          type: "object",
          description: "Structured task data the completing agent needs (sku, vendor, endpoint, proof_hash, etc.)",
        },
        created_by: {
          type: "string",
          description: "Optional: your agent ID or identifier",
        },
      },
      required: ["bounty_type", "description", "reward_usdc", "task_data"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── idle_bounty_stats ─────────────────────────────────────────────────────────

  {
    name: "idle_bounty_stats",
    description:
      "Bounty ecosystem stats: total completed, rewards paid, top earners. " +
      "See how much USDC has been distributed to agents, which task types are most popular, " +
      "and which agents are earning the most from micro-tasks. " +
      "Use this to gauge the health of the idle earnings ecosystem. " +
      "Also useful before creating bounties to see what's already covered. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleDiscoveryInfraTool(name, args) {
  switch (name) {

    case "slash_report":
      return slashReport(args);

    case "slash_history":
      return slashHistory(args);

    case "slash_appeal":
      return slashAppeal(args);

    case "idle_bounties":
      return idleBountiesAvailable(args);

    case "idle_bounty_claim":
      return idleBountyClaim(args);

    case "idle_bounty_submit":
      return idleBountySubmit(args);

    case "idle_bounty_create":
      return idleBountyCreate(args);

    case "idle_bounty_stats":
      return idleBountyStats(args);

    default:
      throw new Error(`Unknown discovery-infra tool: ${name}`);
  }
}
