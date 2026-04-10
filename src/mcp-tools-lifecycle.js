/**
 * HiveAgent Lifecycle MCP Tools (Phase 8)
 *
 * Three sticky, hard-to-leave modules that insert HiveAgent into the core
 * of every agent transaction lifecycle:
 *
 *   1. Agent Wallet     — HiveAgent IS the bank. Every transaction flows through us.
 *   2. Persistent Memory — Agents store learned preferences and workflow history with us.
 *   3. Intent Router    — Agents ask us what to do before doing ANYTHING.
 *
 * Exports:
 *   lifecycleTools          — Array of 19 MCP tool definitions
 *   handleLifecycleTool(name, args) — Dispatcher function
 */

import * as wallet from "./services/agent-wallet.js";
import * as memory from "./services/agent-memory-persistent.js";
import * as intent from "./services/intent-router.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────

export const lifecycleTools = [

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET TOOLS (7)
  // ─────────────────────────────────────────────────────────────────────────


  {
    name: "wallet_deposit",
    description: "Use when an agent needs to fund its HiveAgent wallet with USDC. Accepts deposits from any source (Coinbase, bank, external wallet). Fee: 0.1% of deposit. Returns new balance and transaction receipt.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "HiveAgent wallet ID to credit" },
        amount:    { type: "number", description: "USDC amount to deposit (must be > 0)" },
        source:    { type: "string", description: "Source of funds, e.g. 'coinbase', 'bank_transfer', 'external_wallet'" },
      },
      required: ["wallet_id", "amount", "source"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "wallet_withdraw",
    description: "Use when an agent needs to send USDC from its HiveAgent wallet to an external address. Fee: 0.5% of withdrawal amount. Returns transaction ID, new balance, and estimated arrival time (~15 min). Note: keeping funds on HiveAgent avoids this fee for agent-to-agent payments.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id:            { type: "string", description: "HiveAgent wallet ID to debit" },
        amount:               { type: "number", description: "USDC amount to withdraw (must be > 0)" },
        destination_address:  { type: "string", description: "External wallet address (0x...) to send funds to" },
      },
      required: ["wallet_id", "amount", "destination_address"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "wallet_transfer",
    description: "Use when an agent needs to pay another agent that also has a HiveAgent wallet. Transfer is INSTANT with NO GAS FEES. Fee: 0.1%. Far cheaper and faster than on-chain transfers. Both wallets must exist on HiveAgent.",
    inputSchema: {
      type: "object",
      properties: {
        from_wallet_id: { type: "string", description: "Sending wallet ID" },
        to_wallet_id:   { type: "string", description: "Receiving wallet ID" },
        amount:         { type: "number", description: "USDC amount to transfer (must be > 0)" },
        memo:           { type: "string", description: "Optional payment reference or description" },
      },
      required: ["from_wallet_id", "to_wallet_id", "amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "wallet_balance",
    description: "Use when you need to check an agent wallet's current balance, pending amounts, escrow locks, and lifetime earnings/spending stats. FREE. Returns full financial summary including available funds.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "HiveAgent wallet ID to query" },
      },
      required: ["wallet_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "wallet_history",
    description: "Use when you need a full paginated transaction history for an agent wallet. Returns deposits, withdrawals, and transfers with counterparty, memo, status, and timestamps. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "HiveAgent wallet ID to query" },
        limit:     { type: "integer", description: "Number of transactions to return (default 20, max 100)", default: 20 },
        offset:    { type: "integer", description: "Pagination offset (default 0)", default: 0 },
      },
      required: ["wallet_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "wallet_spending_rules",
    description: "Use when you need to configure guardrails on an agent wallet — max per transaction, daily spending limit, allowed service categories, and human-approval thresholds. FREE. Rules take effect immediately on all subsequent transactions.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "HiveAgent wallet ID to configure" },
        rules: {
          type: "object",
          description: "Spending rule configuration",
          properties: {
            max_per_transaction:   { type: "number", description: "Maximum USDC allowed per single transaction" },
            daily_limit:           { type: "number", description: "Maximum USDC allowed per day across all transactions" },
            allowed_categories:    { type: "array", items: { type: "string" }, description: "Whitelist of service categories (empty = all allowed)" },
            require_approval_above: { type: "number", description: "Require human HITL approval for transactions above this USDC threshold" },
          },
        },
      },
      required: ["wallet_id", "rules"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MEMORY TOOLS (7)
  // ─────────────────────────────────────────────────────────────────────────

  {
    name: "memory_store",
    description: "Use when an agent learns something it should remember across sessions — a preference, a contact, a workflow shortcut, or a credential reference. Fee: $0.001/write. Memories persist indefinitely (or until TTL expires) and are accessible from any session.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent that owns this memory" },
        key:       { type: "string", description: "Unique memory key (e.g. 'preferred_shipper', 'cfo_contact')" },
        value:     { description: "Any JSON-serialisable value to store" },
        category:  { type: "string", enum: ["preference", "workflow_history", "learned_pattern", "contact", "credential_ref", "context"], description: "Memory category for filtering and retrieval" },
        ttl:       { type: "integer", description: "Optional time-to-live in seconds. Omit for permanent storage." },
      },
      required: ["agent_id", "key", "value", "category"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "memory_recall",
    description: "Use when an agent needs to retrieve a specific stored memory by key. Fee: $0.0005/read. Returns the stored value, category, when it was stored, and how many times it has been accessed. Tracks access patterns for agent profile building.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent that owns the memory" },
        key:      { type: "string", description: "Memory key to recall" },
      },
      required: ["agent_id", "key"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },


  {
    name: "memory_workflow_history",
    description: "Use when an agent wants to see how it solved a similar problem before. 'Last time you processed a construction permit in Austin, you used these 5 tools in this order.' Fee: $0.001/query. Invaluable for repeatable workflows — eliminates re-discovery cost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to retrieve history for" },
        vertical: { type: "string", description: "Optional: filter to a specific industry vertical (e.g. 'legal', 'supply_chain', 'finance')" },
        limit:    { type: "integer", description: "Max workflows to return (default 10)", default: 10 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "memory_learn_preference",
    description: "Use when an agent observes a preference it should apply automatically in the future — 'always check fraud before approving invoices > $10k', 'prefer FedEx over UPS for this account'. Fee: $0.001/write. Preferences are applied automatically in future sessions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent learning the preference" },
        preference: { type: "string", description: "The preference to record (plain English description)" },
        context:    { type: "string", description: "Why this preference was learned or who set it" },
      },
      required: ["agent_id", "preference"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "memory_agent_profile",
    description: "Use when you need a complete operational profile of an agent built from its accumulated memory — top preferences, most-used tools, verticals worked in, success rates, workflow patterns, and spending history. FREE. Essential for agent handoffs and audits.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to profile" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },


  // ─────────────────────────────────────────────────────────────────────────
  // INTENT ROUTER TOOLS (5)
  // ─────────────────────────────────────────────────────────────────────────

  {
    name: "intent_route",
    description: "Use BEFORE doing anything when you're not sure which tool(s) to call. Describe your goal in plain English — HiveAgent returns the optimal execution plan across all 591 tools, alternatives, and warnings. Fee: $0.01/route. Pays for itself by preventing expensive wrong-tool calls.",
    inputSchema: {
      type: "object",
      properties: {
        intent:  { type: "string", description: "Natural language description of what you want to accomplish (e.g. 'process a batch of vendor invoices and route for approval')" },
        context: { type: "object", description: "Optional context: { agent_id, vertical, session_data, account_id }" },
        budget:  { type: "number", description: "Optional: maximum acceptable total cost in USDC for this task" },
        urgency: { type: "string", enum: ["low", "normal", "high", "critical"], description: "Execution urgency (affects tool selection and SLA warnings)", default: "normal" },
      },
      required: ["intent"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "intent_compare",
    description: "Use when you have 2–5 ways to accomplish a task and need an objective comparison before committing. Returns pros, cons, cost, time, and reliability score for each option, plus a ranked recommendation. Fee: $0.02/comparison.",
    inputSchema: {
      type: "object",
      properties: {
        intent:  { type: "string", description: "What you're trying to accomplish" },
        options: { type: "array", items: { type: "string" }, description: "Array of tool names or approach descriptions to compare (at least 2)", minItems: 2 },
      },
      required: ["intent", "options"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "intent_preflight",
    description: "Use BEFORE calling any tool to verify: (1) it's the right tool, (2) your args are valid, (3) cost is reasonable, (4) a better alternative doesn't exist. Fee: $0.005/check. Catches mistakes before they cost money. Integrates with wallet spending rules automatically.",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: { type: "string", description: "Name of the tool you are about to call" },
        args:      { type: "object", description: "The arguments you plan to pass to the tool" },
      },
      required: ["tool_name", "args"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "intent_history",
    description: "Use to review past routing decisions and their outcomes for an agent — what was intended, what plan was chosen, how much it cost, and satisfaction scores. FREE. Useful for debugging, auditing, or optimizing agent behavior over time.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to retrieve routing history for" },
        limit:    { type: "integer", description: "Max records to return (default 20)", default: 20 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "intent_optimize",
    description: "Use when you want to reduce the cost, latency, or complexity of a recurring workflow. Analyzes a workflow description and returns specific changes — tool swaps, caching opportunities, preflight additions, and wallet optimizations. Fee: $0.05/optimization.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:             { type: "string", description: "Agent requesting optimization" },
        workflow_description: { type: "string", description: "Description of the current workflow (tool names, steps, and what it does)" },
      },
      required: ["agent_id", "workflow_description"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Dispatcher ────────────────────────────────────────────────────────────

/**
 * Handle a lifecycle tool call by name.
 * @param {string} name - Tool name (must be in lifecycleTools)
 * @param {object} args - Tool arguments
 * @returns {*} Tool result
 */
export async function handleLifecycleTool(name, args) {
  switch (name) {

    // Wallet
    case "wallet_create":
      return wallet.createWallet(args.agent_id, args.agent_name, args.owner_email);
    case "wallet_deposit":
      return wallet.deposit(args.wallet_id, args.amount, args.source);
    case "wallet_withdraw":
      return wallet.withdraw(args.wallet_id, args.amount, args.destination_address);
    case "wallet_transfer":
      return wallet.transfer(args.from_wallet_id, args.to_wallet_id, args.amount, args.memo);
    case "wallet_balance":
      return wallet.getBalance(args.wallet_id);
    case "wallet_history":
      return wallet.getTransactionHistory(args.wallet_id, args.limit, args.offset);
    case "wallet_spending_rules":
      return wallet.setSpendingRules(args.wallet_id, args.rules);

    // Memory
    case "memory_store":
      return memory.storeMemory(args.agent_id, args.key, args.value, args.category, args.ttl);
    case "memory_recall":
      return memory.recallMemory(args.agent_id, args.key);
    case "memory_search":
      return memory.searchMemory(args.agent_id, args.query, args.category, args.limit);
    case "memory_workflow_history":
      return memory.getWorkflowHistory(args.agent_id, args.vertical, args.limit);
    case "memory_learn_preference":
      return memory.learnPreference(args.agent_id, args.preference, args.context);
    case "memory_agent_profile":
      return memory.getAgentProfile(args.agent_id);
    case "memory_delete":
      return memory.deleteMemory(args.agent_id, args.key);

    // Intent Router
    case "intent_route":
      return intent.routeIntent(args.intent, args.context, args.budget, args.urgency);
    case "intent_compare":
      return intent.compareOptions(args.intent, args.options);
    case "intent_preflight":
      return intent.preflightCheck(args.tool_name, args.args);
    case "intent_history":
      return intent.getIntentHistory(args.agent_id, args.limit);
    case "intent_optimize":
      return intent.optimizeWorkflow(args.agent_id, args.workflow_description);

    default:
      throw new Error(`Unknown lifecycle tool: ${name}`);
  }
}
