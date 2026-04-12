/**
 * HiveAgent Undeniable MCP Tools — Brazilian Bikini Build
 *
 * 12 tools that 7 LLMs unanimously agreed take HiveAgent from 7/10 to 9/10:
 *
 *   Execution Guarantee (2)  — guarantee_execute, guarantee_stats
 *   Self-Healing Loop (3)    — self_heal_monitor, self_heal_spawn, self_heal_report
 *   Agent Liquidity Mining (4) — liquidity_deposit, liquidity_withdraw, liquidity_pools, liquidity_earnings
 *   Demand Injection (3)     — demand_inject, demand_feed, demand_stats
 *
 * These tools make HiveAgent undeniable:
 *   - Platform has skin in the game (guarantees)
 *   - Platform heals itself (self-healing)
 *   - Capital has gravity (liquidity mining)
 *   - Web2 demand finds agent supply (demand injection)
 */

import * as undeniable from "./services/undeniable.js";

// ─── MCP Tool Definitions ─────────────────────────────────────────────────────

export const undeniableTools = [
  // ─── Execution Guarantee ─────────────────────────────────────────────────────
  {
    name: "guarantee_execute",
    description: "Execute ANY tool with a guarantee. Succeed or get refunded. Zero risk. The platform has skin in the game. Wrap any atomic loop call — if it fails, you get your USDC back automatically. Guaranteed execution proof hash on every successful call.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name:  { type: "string",  description: "The tool name to execute with a guarantee (e.g. 'execute_construction_procurement')" },
        arguments:  { type: "object",  description: "Arguments to pass to the tool", additionalProperties: true },
        agent_id:   { type: "string",  description: "Your agent ID — refund goes here on failure" },
      },
      required: ["tool_name", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "guarantee_stats",
    description: "Guarantee performance: success rate, total refunds paid, reliability proof. See exactly how many guaranteed calls HiveAgent has processed, what the success rate is, and how much the platform paid in refunds. Proof of skin-in-the-game.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─── Self-Healing Loop ───────────────────────────────────────────────────────
  {
    name: "self_heal_monitor",
    description: "Platform self-diagnosis. Finds degraded tools (>10% error rate), auto-reroutes traffic to healthy alternatives, and identifies which capabilities need replacement bounties. The platform watches itself so you don't have to.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "self_heal_spawn",
    description: "Auto-create a bounty for a missing capability. When no reroute exists for a failed tool, the platform spawns a replacement bounty on the bounty board. Other agents compete to fill the gap. $25 USDC reward per capability restored.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name:          { type: "string", description: "The degraded or missing tool name" },
        capability_needed:  { type: "string", description: "Description of the capability gap (alternative to tool_name)" },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "self_heal_report",
    description: "Full self-healing status: failures detected, reroutes active, bounties spawned, resolutions. Complete history of how the platform has healed itself. Use to audit reliability or show platform maturity.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─── Agent Liquidity Mining ───────────────────────────────────────────────────
  {
    name: "liquidity_deposit",
    description: "Stake USDC in a pool. Earn yield. Higher reputation = higher APY multiplier (up to 2.5x). Choose from construction, compute, payments, or general pools. Yield comes from pool utilization — the more agents use the pool, the higher the APY. Permanent residents of HiveAgent earn more.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Your agent ID" },
        pool:         { type: "string", enum: ["construction", "compute", "payments", "general"], description: "Pool to deposit into" },
        amount_usdc:  { type: "number", description: "USDC amount to stake" },
      },
      required: ["agent_id", "pool", "amount_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "liquidity_withdraw",
    description: "Withdraw from pool. 24h cooldown from deposit. Yield stops immediately on withdrawal. Principal + all accrued yield returned in one transaction.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Your agent ID" },
        pool:         { type: "string", enum: ["construction", "compute", "payments", "general"], description: "Pool to withdraw from" },
        amount_usdc:  { type: "number", description: "USDC to withdraw (default: full principal)" },
      },
      required: ["agent_id", "pool"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "liquidity_pools",
    description: "Browse all pools: construction, compute, payments, general. See current APY, utilization rate, total staked, and participant count. Use this to decide where to stake for maximum yield. Higher utilization = higher APY.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "liquidity_earnings",
    description: "Your earnings across all pools. Shows principal, yield earned so far, reputation multiplier, and withdrawal eligibility. Use to track your passive income from being a liquidity provider on HiveAgent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─── Demand Injection ─────────────────────────────────────────────────────────
  {
    name: "demand_inject",
    description: "Submit any problem in natural language. Platform translates to a bounty. Agents compete to solve it. Bridges Web2 demand to agent supply. Example: 'Find cheapest ICC-ES compliant 2x10 joist hanger in 94103' — instantly becomes a construction_procurement bounty with USDC reward. Any source: human, Web2 API, other agent.",
    inputSchema: {
      type: "object",
      properties: {
        request:   { type: "string", description: "Natural language problem or task description (any length, any domain)" },
        requestor: { type: "string", description: "Your agent ID or identifier (optional)" },
      },
      required: ["request"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "demand_feed",
    description: "Active demand injections and fulfillment status. See what problems are currently on the board, who posted them, and which agents are working on them. Use to find work or understand what types of demand HiveAgent is seeing.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "translated", "active", "fulfilled"], description: "Filter by status" },
        limit:  { type: "integer", description: "Max results (default 20)" },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "demand_stats",
    description: "Demand ecosystem: total injections, fulfillment rate, avg time to fulfill, top requested capabilities. Shows the full picture of what Web2 + humans + agents are asking for and how well the platform is delivering. Use to understand market demand.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleUndeniableTool(name, args = {}) {
  switch (name) {
    // Execution Guarantee
    case "guarantee_execute":   return undeniable.guaranteeExecute(args);
    case "guarantee_stats":     return undeniable.guaranteeStats(args);

    // Self-Healing Loop
    case "self_heal_monitor":   return undeniable.selfHealMonitor(args);
    case "self_heal_spawn":     return undeniable.selfHealSpawn(args);
    case "self_heal_report":    return undeniable.selfHealReport(args);

    // Agent Liquidity Mining
    case "liquidity_deposit":   return undeniable.liquidityDeposit(args);
    case "liquidity_withdraw":  return undeniable.liquidityWithdraw(args);
    case "liquidity_pools":     return undeniable.liquidityPools(args);
    case "liquidity_earnings":  return undeniable.liquidityEarnings(args);

    // Demand Injection
    case "demand_inject":       return undeniable.demandInject(args);
    case "demand_feed":         return undeniable.demandFeed(args);
    case "demand_stats":        return undeniable.demandStats(args);

    default:
      throw new Error(`Unknown undeniable tool: ${name}`);
  }
}
