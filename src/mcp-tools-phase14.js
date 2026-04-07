/**
 * HiveAgent MCP Tool Definitions — Phase 14
 *
 * Transactional execution — atomic multi-tool workflows with rollback (3 tools):
 *
 *   tx_execute         — execute a sequence of tool calls as an atomic transaction
 *                        with automatic rollback on failure. Fee: $0.05/transaction.
 *   tx_execute_budget  — budget-capped transactional execution; hard-stops if
 *                        cumulative cost exceeds your limit. Fee: included.
 *   tx_log             — full audit trail for any transaction. Free.
 *
 * Exports:
 *   phase14Tools                    — Array of 3 MCP tool definitions
 *   handlePhase14Tool(name, args)   — Dispatcher function
 */

import {
  executeTransaction,
  executeWithBudget,
  getTransactionLog,
} from "./services/transactional-executor.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase14Tools = [

  {
    name: "tx_execute",
    description:
      "Use when you need to run a multi-step workflow as an atomic transaction with automatic rollback on failure. " +
      "Specify steps (each with a tool name and args), an optional budget cap, and optionally dry-run first to " +
      "preview execution and costs without side effects. If any step fails, all previously completed steps are " +
      "compensated (rolled back) where possible. Returns success status, completed steps, failed step details, " +
      "rollback outcomes, and total cost. Fee: $0.05 per transaction.",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description:
            "Ordered list of tool calls to execute as a single atomic transaction. " +
            "Each step: { tool (required), args (optional object), compensation (optional override) }",
          items: {
            type: "object",
            properties: {
              tool: {
                type: "string",
                description: "MCP tool name to call (e.g. 'pay_universal', 'hiveagent_defi_swap')",
              },
              args: {
                type: "object",
                description: "Arguments to pass to the tool",
              },
              compensation: {
                type: "object",
                description:
                  "Optional override for the rollback/compensation action. " +
                  "{ tool: string, args: object, note: string }. " +
                  "If omitted, HiveAgent infers a compensation action where possible.",
                properties: {
                  tool:  { type: "string",  description: "Tool to call for rollback" },
                  args:  { type: "object",  description: "Args for the rollback tool" },
                  note:  { type: "string",  description: "Human-readable description of the rollback" },
                },
              },
            },
            required: ["tool"],
          },
          minItems: 1,
        },
        budget_usd: {
          type: "number",
          description:
            "Optional hard cost ceiling in USD. Execution stops before any step that would exceed this budget. " +
            "Include the $0.05 transaction fee in your budget estimate.",
        },
        dry_run: {
          type: "boolean",
          description:
            "If true, validates all steps and returns cost estimates and previews without actually executing anything. " +
            "Use to sanity-check a complex workflow before committing.",
          default: false,
        },
      },
      required: ["steps"],
    },
    annotations: {
      readOnlyHint:   false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint:  false,
    },
  },

  {
    name: "tx_execute_budget",
    description:
      "Use when you need budget-capped transactional execution. Hard-stops if cumulative cost exceeds your limit — " +
      "no step that would exceed the budget is executed, and all previously completed steps are rolled back. " +
      "Identical to tx_execute but budget_usd is required. Returns all tx_execute fields plus budget_remaining.",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description: "Ordered list of tool calls. Each: { tool (required), args (optional), compensation (optional) }",
          items: {
            type: "object",
            properties: {
              tool: { type: "string" },
              args: { type: "object" },
              compensation: {
                type: "object",
                properties: {
                  tool: { type: "string" },
                  args: { type: "object" },
                  note: { type: "string" },
                },
              },
            },
            required: ["tool"],
          },
          minItems: 1,
        },
        budget_usd: {
          type: "number",
          description: "Hard cost ceiling in USD. Required. Execution halts and rolls back if this would be exceeded.",
        },
      },
      required: ["steps", "budget_usd"],
    },
    annotations: {
      readOnlyHint:   false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint:  false,
    },
  },

  {
    name: "tx_log",
    description:
      "Use when you need the full audit trail of a transactional execution. Returns every step with tool name, " +
      "input, output, status, cost, duration_ms, and rollback_status. Useful for debugging failed transactions, " +
      "compliance reporting, or verifying that rollbacks completed successfully. Free — no charge.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_id: {
          type: "string",
          description: "The transaction ID returned by tx_execute or tx_execute_budget (e.g. 'txn_abc123')",
        },
      },
      required: ["transaction_id"],
    },
    annotations: {
      readOnlyHint:   true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint:  false,
    },
  },

];

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handlePhase14Tool(name, args = {}) {
  switch (name) {

    case "tx_execute":
      return executeTransaction(
        args.steps,
        args.budget_usd ?? null,
        args.dry_run    ?? false
      );

    case "tx_execute_budget":
      return executeWithBudget(
        args.steps,
        args.budget_usd
      );

    case "tx_log":
      return getTransactionLog(args.transaction_id);

    default:
      throw new Error(`Unknown Phase 14 tool: ${name}`);
  }
}
