/**
 * Anthropic Managed Agents + Advisor Tool — MCP Tools
 *
 * Anthropic launched Claude Managed Agents (public beta) + Advisor Tool beta.
 * HiveAgent integrated same day.
 *
 * 6 tools:
 *   claude_session_create  — long-running Claude agent, no timeout, full context
 *   claude_event_post      — post events to a managed session
 *   claude_advisor_mode    — Haiku executor + Opus advisor loop, 40% cheaper
 *   claude_env_create      — isolated runtime with specific vaults + capabilities
 *   claude_sessions_list   — manage all active managed agent sessions
 *   claude_status          — integration overview + live stats
 */

import * as anthropic from "./services/anthropic-agents.js";

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const anthropicTools = [
  {
    name: "claude_session_create",
    description:
      "Create a long-running Claude Managed Agent session — no timeout, no context loss. " +
      "Anthropic's new public beta lets you spin up a persistent Claude agent that remembers " +
      "everything across every event you post to it. Pay per event, not per minute. " +
      "Perfect for multi-step workflows, research loops, and tasks that can't fit in a single call. " +
      "Supports advisor mode pairing for plan/review loops. " +
      "API: POST /v1/sessions (beta: managed-agents-2025-05-14).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string",  description: "Your agent's unique identifier" },
        model:         { type: "string",  description: "Claude model: claude-opus-4-5 (default), claude-sonnet-4-5, claude-haiku-3-5" },
        system_prompt: { type: "string",  description: "System prompt that persists across all events in this session" },
        tools_enabled: { type: "array",   items: { type: "string" }, description: "Tool names to enable in this session" },
        advisor_mode:  { type: "boolean", description: "Enable advisor mode — pairs this session with a high-intelligence reviewer" },
        vault_ids:     { type: "array",   items: { type: "string" }, description: "Vault IDs to connect (secrets, credentials, API keys)" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "claude_event_post",
    description:
      "Post an event to a Claude Managed Agent session. Claude maintains FULL context across all events — " +
      "it remembers every message, tool result, and human turn from session start. " +
      "Event types: message (send text), tool_result (return tool output), human_turn (multi-turn chat). " +
      "Sessions created with claude_session_create never time out. " +
      "The session persists until you explicitly close it.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string",  description: "Your agent's unique identifier" },
        session_id:     { type: "string",  description: "Session ID returned by claude_session_create" },
        event_type:     { type: "string",  enum: ["message", "tool_result", "human_turn"], description: "Type of event to post" },
        content:        {                  description: "Event content — text string or structured tool result object" },
        await_response: { type: "boolean", description: "Wait for Claude's response before returning (default: true)" },
      },
      required: ["session_id", "content"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "claude_advisor_mode",
    description:
      "Run Anthropic's Advisor Tool beta — a powerful plan/review loop that pairs a FAST executor model " +
      "with a HIGH-INTELLIGENCE advisor. Haiku does the work. Opus checks it. " +
      "Result: better accuracy than pure Opus at ~40% of the cost. " +
      "Advisor creates a plan → Executor runs it → Advisor reviews + corrects → repeat until approved. " +
      "Perfect for long-horizon tasks, complex analysis, code generation, and anywhere accuracy matters more than speed. " +
      "Beta header: advisor-tool-2026-03-01.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string",  description: "Your agent's unique identifier" },
        task:           { type: "string",  description: "The task to execute — be specific for best results" },
        executor_model: { type: "string",  description: "Fast model for execution (default: claude-haiku-3-5)" },
        advisor_model:  { type: "string",  description: "High-intelligence model for planning and review (default: claude-opus-4-5)" },
        iterations:     { type: "integer", description: "Max advisor review iterations (1-5, default: 1)" },
      },
      required: ["agent_id", "task"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "claude_env_create",
    description:
      "Create an isolated Claude Managed Agent environment — a dedicated runtime with specific tools, " +
      "vaults, and capabilities scoped to one agent or workflow. " +
      "Deploy your sales agent with CRM vault access. Deploy your finance agent with payment vault access. " +
      "Full isolation: each environment only sees its own tools and secrets. " +
      "Scale to hundreds of specialized agents without credential leakage.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent that owns this environment" },
        env_name:     { type: "string", description: "Human-readable environment name (e.g. 'sales-agent-prod')" },
        vault_ids:    { type: "array",  items: { type: "string" }, description: "Vault IDs to connect — secrets available inside this environment only" },
        capabilities: { type: "array",  items: { type: "string" }, description: "Capability list: e.g. ['web_search', 'code_exec', 'file_write']" },
      },
      required: ["agent_id", "env_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "claude_sessions_list",
    description:
      "List all Claude Managed Agent sessions for an agent — with status, event counts, and cost so far. " +
      "Filter by active, completed, or all sessions. " +
      "Use to monitor long-running workflows, track spending per session, and audit agent activity. " +
      "Summary shows total active sessions, total events posted, and total USDC spent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Filter sessions by agent ID" },
        status:   { type: "string", enum: ["active", "completed", "closed"], description: "Filter by session status" },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "claude_status",
    description:
      "Get full Anthropic Managed Agents + Advisor Tool integration status — capabilities, live stats, " +
      "API endpoints, beta headers, model options, and setup instructions. " +
      "ANNOUNCEMENT: Anthropic launched Managed Agents in public beta. HiveAgent integrated same day. " +
      "Run long-horizon tasks without context limits, timeouts, or infrastructure overhead. " +
      "Set ANTHROPIC_API_KEY on Render to activate live mode.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Tool Handler ────────────────────────────────────────────────────────────

export async function handleAnthropicTool(name, args = {}) {
  switch (name) {
    case "claude_session_create":
      return await anthropic.createManagedSession(args);

    case "claude_event_post":
      return await anthropic.postEvent(args);

    case "claude_advisor_mode":
      return await anthropic.advisorMode(args);

    case "claude_env_create":
      return await anthropic.createEnvironment(args);

    case "claude_sessions_list":
      return await anthropic.listSessions(args);

    case "claude_status":
      return await anthropic.getAnthropicStatus();

    default:
      throw new Error(`Unknown Anthropic tool: ${name}`);
  }
}
