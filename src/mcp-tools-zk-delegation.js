/**
 * HiveAgent MCP Tool Definitions — ZK Spend Delegation Tree
 *
 * THE agent-native payment primitive. The one Circle/Tether can't build —
 * they designed for human wallets, not agent delegation trees.
 *
 * An orchestrator agent delegates a scoped, revocable, ZK-private budget
 * to child agents in an infinite-depth tree. Every node has a ZK proof of
 * authorization. Every spend is private but auditable via ViewKey. Every
 * parent can revoke any child instantly — cascading to all sub-children.
 *
 * ── Tree Management (4 tools) ──────────────────────────────────────────────
 *   delegation_create_tree       — Orchestrator creates delegation tree + root ViewKey
 *   delegation_grant_budget      — Parent grants child agent a scoped budget
 *   delegation_revoke            — Instant revocation, cascades to all sub-children
 *   delegation_get_tree          — Visualize full tree: budgets, spent, remaining, status
 *
 * ── Spending (3 tools) ────────────────────────────────────────────────────
 *   delegation_spend             — Child spends within scope; returns ZK proof
 *   delegation_batch_spend       — Atomic micro-spend batch for high-frequency agents
 *   delegation_get_balance       — Check remaining budget, scope, and recent txs
 *
 * ── Sub-delegation (1 tool) ───────────────────────────────────────────────
 *   delegation_sub_delegate      — Child creates grandchild branch (infinite depth)
 *
 * ── Auditing & Compliance (3 tools) ──────────────────────────────────────
 *   delegation_audit             — ViewKey holder decrypts branch transaction history
 *   delegation_prove_authorization — ZK proof of spending authority (the primitive itself)
 *   delegation_compliance_report — Full compliance report for regulators via ViewKey
 *
 * ── Discovery (1 tool) ────────────────────────────────────────────────────
 *   delegation_list_active       — List all delegation trees/nodes for an agent
 *
 * Built on Aleo-compatible ZK primitives (Groth16/BLS12-377 in simulation,
 * live with ALEO_API_KEY). The window closes when Circle acquires a ZK team.
 */

import {
  delegationCreateTree,
  delegationGrantBudget,
  delegationRevoke,
  delegationGetTree,
  delegationSpend,
  delegationBatchSpend,
  delegationGetBalance,
  delegationSubDelegate,
  delegationAudit,
  delegationProveAuthorization,
  delegationComplianceReport,
  delegationListActive,
  LIVE_MODE,
} from "./services/zk-spend-delegation.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const zkDelegationTools = [

  // ═══════════════════════════════════════════════════════════════════════════
  // TREE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "delegation_create_tree",
    description: "Orchestrator agent creates a ZK Spend Delegation Tree with a total budget. Returns tree_id and a root ViewKey for auditing. The entire tree is ZK-private — nobody can see the budget breakdown without the ViewKey. This is the entry point for agent-native treasury management: one root budget, infinite delegation depth, all private, all auditable. Call this before calling delegation_grant_budget to create child branches.",
    inputSchema: {
      type: "object",
      properties: {
        root_agent_id: {
          type: "string",
          description: "ID of the orchestrator agent that owns the root budget. This agent becomes the top-level authority.",
        },
        total_budget: {
          type: "number",
          description: "Total budget in the specified currency (e.g. 10000 for $10,000 USDC). Children cannot collectively exceed this.",
        },
        currency: {
          type: "string",
          enum: ["USDC", "USDT", "EURC", "ALEO", "ETH", "BTC"],
          description: "Currency for the delegation tree. Defaults to USDC.",
          default: "USDC",
        },
        description: {
          type: "string",
          description: "Human-readable description of this delegation tree (e.g. 'Q4 Agent Operations Budget').",
        },
      },
      required: ["root_agent_id", "total_budget"],
    },
  },

  {
    name: "delegation_grant_budget",
    description: "Parent agent grants a child agent a scoped, capped, ZK-private budget within the delegation tree. The child receives: a node_id, a spending proof (Groth16/BLS12-377), and its own ViewKey for auditing its branch only. Scope tags restrict what the child can spend on — enforced cryptographically, not by trust. Budget cap must be <= parent's remaining balance. Scope must be a subset of parent's scope. Parent can revoke at any time via delegation_revoke.",
    inputSchema: {
      type: "object",
      properties: {
        parent_node_id: {
          type: "string",
          description: "The node_id of the parent agent granting the budget. Get this from delegation_create_tree (root) or delegation_grant_budget (child).",
        },
        parent_agent_id: {
          type: "string",
          description: "Optional: verify that the caller matches the parent node's agent_id. Prevents unauthorized grants.",
        },
        child_agent_id: {
          type: "string",
          description: "ID of the child agent receiving the budget.",
        },
        budget_cap: {
          type: "number",
          description: "Maximum amount the child can spend. Must be <= parent's remaining balance.",
        },
        scope_tags: {
          type: "array",
          items: { type: "string" },
          description: "Allowed spend categories for the child. Examples: ['data_purchase'], ['compute', 'gpu'], ['exchange', 'spot_trading'], ['kyc_fees']. Child can only spend on purposes matching these tags. Use [] or omit to inherit parent scope. Must be a subset of parent scope.",
        },
        expiry: {
          type: "string",
          description: "ISO 8601 datetime when this delegation expires (e.g. '2025-12-31T23:59:59Z'). After expiry, child cannot spend and unspent funds return to parent.",
        },
      },
      required: ["parent_node_id", "child_agent_id", "budget_cap"],
    },
  },

  {
    name: "delegation_revoke",
    description: "Parent agent instantly revokes a child's budget. Unspent funds cascade back up to parent. All grandchildren (sub-delegated nodes) are also revoked — the entire branch is invalidated atomically. The revocation is anchored on Aleo for proof of timing. Use this for: security incidents (rogue agent), budget reallocation, expired partnerships, or policy changes. ZK-private: revocation proof reveals only that a node was revoked, not the budget amounts.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The delegation node to revoke. All children and grandchildren will also be revoked.",
        },
        revoker_agent_id: {
          type: "string",
          description: "ID of the agent performing the revocation. Should be the parent of the target node.",
        },
        reason: {
          type: "string",
          description: "Reason for revocation — logged for audit trail. Examples: 'budget_reallocation', 'security_incident', 'partnership_ended'.",
        },
      },
      required: ["node_id"],
    },
  },

  {
    name: "delegation_get_tree",
    description: "Visualize the full ZK Spend Delegation Tree: all nodes, budgets, spent amounts, remaining balances, scope tags, status, and hierarchy depth. Returns a nested tree structure mirroring the actual agent hierarchy. If you provide the root ViewKey, full details are unlocked. Without ViewKey, summary data is visible but transaction details remain masked. Use this for: budget monitoring, hierarchy visualization, capacity planning.",
    inputSchema: {
      type: "object",
      properties: {
        tree_id: {
          type: "string",
          description: "The delegation tree to visualize.",
        },
        viewkey: {
          type: "string",
          description: "Optional: root ViewKey from delegation_create_tree. Unlocks full detail decryption.",
        },
      },
      required: ["tree_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPENDING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "delegation_spend",
    description: "Child agent spends within its delegated budget. ZK-private: the transaction is recorded but only visible to ViewKey holders. Returns a ZK proof of authorized spend (Groth16/BLS12-377) that the child can present to vendors or exchanges as proof of payment authority. Enforces: (1) amount <= remaining budget, (2) purpose matches scope_tags. Cryptographic enforcement — no trust required. Auto-exhausts node at zero balance.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The child agent's delegation node_id.",
        },
        agent_id: {
          type: "string",
          description: "Optional: verify the caller matches this node's agent_id. Prevents unauthorized spends.",
        },
        amount: {
          type: "number",
          description: "Amount to spend. Must be <= remaining balance.",
        },
        recipient: {
          type: "string",
          description: "Recipient identifier — agent ID, wallet address, or vendor ID.",
        },
        purpose: {
          type: "string",
          description: "Human-readable purpose string. Must match at least one scope_tag. Examples: 'Purchase weather data feed', 'GPU compute hour', 'BTC spot order execution', 'KYC verification fee'.",
        },
      },
      required: ["node_id", "amount", "recipient", "purpose"],
    },
  },

  {
    name: "delegation_batch_spend",
    description: "Atomic batch of micro-spends in a single call — ideal for agents making hundreds of API calls, micro-transactions, or high-frequency payments within a delegation budget. All-or-nothing: if any transaction fails scope validation, the valid ones are committed and failures are reported (not rolled back unless ALL fail). Returns a batch anchor on Aleo with a single aggregated proof. Each individual transaction also gets its own proof hash. Use this for: data feed subscriptions, GPU minute billing, per-inference model payments.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The child agent's delegation node_id.",
        },
        agent_id: {
          type: "string",
          description: "Optional: verify caller matches this node's agent_id.",
        },
        spends: {
          type: "array",
          description: "Array of spend instructions. Total must be <= remaining balance.",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Amount for this micro-spend." },
              recipient: { type: "string", description: "Recipient agent, vendor, or wallet." },
              purpose: { type: "string", description: "Purpose — must match scope_tags." },
            },
            required: ["amount", "recipient", "purpose"],
          },
        },
      },
      required: ["node_id", "spends"],
    },
  },

  {
    name: "delegation_get_balance",
    description: "Check remaining budget for a delegation node. Returns: cap, spent, remaining, utilization %, scope tags, status, expiry, children count, children allocated, and recent transactions. ZK-private: balance is only visible to the node's agent (by node_id) or ViewKey holders. Use before spending to confirm headroom. Use for treasury dashboards.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The delegation node to check.",
        },
        agent_id: {
          type: "string",
          description: "Optional: verify caller identity matches the node's agent.",
        },
      },
      required: ["node_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-DELEGATION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "delegation_sub_delegate",
    description: "Child agent delegates part of its own budget to a grandchild agent, creating a new branch in the delegation tree. Infinite depth supported — an agent at any depth can sub-delegate. Rules enforced cryptographically: (1) grandchild cap must be <= child's remaining balance, (2) grandchild scope must be a subset of child's scope. The grandchild receives its own spending proof and ViewKey. Parent chain maintains full revocation authority. This is how agent hierarchies scale: orchestrator → specialist → sub-specialist → micro-agent.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The delegating child agent's node_id.",
        },
        agent_id: {
          type: "string",
          description: "Optional: verify caller matches this node's agent_id.",
        },
        grandchild_agent_id: {
          type: "string",
          description: "ID of the grandchild agent receiving the sub-delegation.",
        },
        budget_cap: {
          type: "number",
          description: "Budget cap for the grandchild. Must be <= this node's remaining balance.",
        },
        scope_tags: {
          type: "array",
          items: { type: "string" },
          description: "Scope tags for the grandchild — must be a subset of this node's scope. Omit to inherit.",
        },
        expiry: {
          type: "string",
          description: "Optional expiry timestamp for the grandchild's delegation.",
        },
      },
      required: ["node_id", "grandchild_agent_id", "budget_cap"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDITING & COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "delegation_audit",
    description: "ViewKey holder (regulator, auditor, compliance officer) inspects any branch of the delegation tree. Decrypts full transaction history for specified nodes. Returns: all transactions with amounts and purposes, budget utilization, scope compliance check, anomalies detected. ViewKey grants read-only access — cannot modify or revoke. Can audit a specific sub-branch without revealing sibling nodes. Returns compliance status: CLEAN or VIOLATIONS_FOUND with details.",
    inputSchema: {
      type: "object",
      properties: {
        tree_id: {
          type: "string",
          description: "The delegation tree to audit.",
        },
        auditor_id: {
          type: "string",
          description: "ID of the auditor performing inspection — logged in audit trail.",
        },
        viewkey: {
          type: "string",
          description: "ViewKey from delegation_create_tree or delegation_grant_budget. Root ViewKey unlocks full tree. Child ViewKey unlocks that branch only.",
        },
        node_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional: audit only specific node IDs. Omit to audit all nodes in the tree.",
        },
      },
      required: ["tree_id", "auditor_id", "viewkey"],
    },
  },

  {
    name: "delegation_prove_authorization",
    description: "The core ZK primitive. Agent proves it has authorization to spend X on Y — WITHOUT revealing its total budget, parent identity, sibling nodes, spend history, or actual remaining balance. Returns a Groth16 proof on BLS12-377 curve (Aleo-native) that any verifier can check. The public statement reveals only: 'this agent has >= X authorized for scope Y'. Nothing else. This is what makes agent commerce trustless: vendors accept payment proofs instead of account access. Use before submitting any large order, invoice, or contract.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "The agent's delegation node_id.",
        },
        agent_id: {
          type: "string",
          description: "Optional: verify caller identity.",
        },
        amount: {
          type: "number",
          description: "Amount to prove authorization for. Proof attests: remaining >= this amount.",
        },
        purpose: {
          type: "string",
          description: "Purpose/scope for the authorization proof. Must match the node's scope_tags.",
        },
        recipient_hint: {
          type: "string",
          description: "Optional context for the proof (e.g. 'CloudProvider-GPU-rental') — appears in public inputs but reveals nothing private.",
        },
      },
      required: ["node_id", "amount", "purpose"],
    },
  },

  {
    name: "delegation_compliance_report",
    description: "Generate a comprehensive compliance report for a delegation tree — for regulators, CFOs, and compliance officers. Requires ViewKey. Reports: total authorized vs delegated vs spent, scope violations (if any), revocation history, per-agent spend breakdown, transaction audit trail, prior audit history. Designed for FinCEN AML reporting, enterprise treasury compliance, and MiCA Article 68 agent payment disclosure. Returns: CLEAN or VIOLATIONS_FOUND with full detail.",
    inputSchema: {
      type: "object",
      properties: {
        tree_id: {
          type: "string",
          description: "The delegation tree to generate a report for.",
        },
        viewkey: {
          type: "string",
          description: "Root ViewKey from delegation_create_tree. Required to decrypt transaction data.",
        },
        auditor_id: {
          type: "string",
          description: "ID of the compliance officer or system generating the report.",
        },
        include_transactions: {
          type: "boolean",
          description: "Include full transaction list in report output. Default false (summary only).",
          default: false,
        },
      },
      required: ["tree_id", "viewkey"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "delegation_list_active",
    description: "List all active delegation trees and nodes for an agent — as orchestrator (root owner), delegate (child node), or both. Returns summary of each: budget cap, spent, remaining, scope, status, expiry. Use this for: agent treasury dashboards, discovering available spending capacity across multiple trees, understanding your position in delegation hierarchies. ZK-private: only shows trees/nodes where the agent has a direct role.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The agent to look up — returns all trees where this agent is root or delegate.",
        },
        role: {
          type: "string",
          enum: ["root", "node", "any"],
          description: "Filter by role: 'root' (orchestrator trees only), 'node' (delegate nodes only), 'any' (both). Default: 'any'.",
          default: "any",
        },
        status_filter: {
          type: "string",
          enum: ["active", "revoked", "exhausted", "any"],
          description: "Filter by node status. Default: 'active'.",
          default: "active",
        },
        limit: {
          type: "integer",
          description: "Max results per role. Default 20.",
          default: 20,
        },
      },
      required: ["agent_id"],
    },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleZkDelegationTool(name, args) {
  switch (name) {

    // Tree Management
    case "delegation_create_tree":
      return await delegationCreateTree(args);

    case "delegation_grant_budget":
      return await delegationGrantBudget(args);

    case "delegation_revoke":
      return await delegationRevoke(args);

    case "delegation_get_tree":
      return await delegationGetTree(args);

    // Spending
    case "delegation_spend":
      return await delegationSpend(args);

    case "delegation_batch_spend":
      return await delegationBatchSpend(args);

    case "delegation_get_balance":
      return await delegationGetBalance(args);

    // Sub-delegation
    case "delegation_sub_delegate":
      return await delegationSubDelegate(args);

    // Auditing & Compliance
    case "delegation_audit":
      return await delegationAudit(args);

    case "delegation_prove_authorization":
      return await delegationProveAuthorization(args);

    case "delegation_compliance_report":
      return await delegationComplianceReport(args);

    // Discovery
    case "delegation_list_active":
      return await delegationListActive(args);

    default:
      throw new Error(`Unknown ZK delegation tool: ${name}`);
  }
}
