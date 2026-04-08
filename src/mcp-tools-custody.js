// ─── Agent Self-Custody 2.0 — MCP Tool Definitions ───────────────────────────
//
// All tools emphasize SELF-CUSTODY, not custodianship.
// HiveAgent never holds your keys. Ever.
// Your wallet, your rules, your agents.
//
// These tools expose the Agent Self-Custody 2.0 infrastructure to any
// MCP-compatible agent runtime.

export const custodyTools = [
  {
    name: "custody_create_smart_wallet",
    description:
      "Use when an agent needs a self-custody wallet they fully control — no custodian, no trusted third party. Creates an ERC-4337 smart account on Base L2 with programmable spending rules, delegation, and social recovery. HiveAgent never holds your keys. The agent's key is derived from its identity and split via MPC (Shamir Secret Sharing) — the agent owns the controller shard. Security policies: single_key, multisig_2of3, mpc_3of5 (default, enterprise-grade), hardware_tee, intent_only. Pre-designate recovery agents for M-of-N social recovery. Fee: free.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique agent identifier. Each agent can have one active self-custody wallet.",
        },
        security_policy: {
          type: "string",
          enum: ["single_key", "multisig_2of3", "mpc_3of5", "hardware_tee", "intent_only"],
          description: "Key management security model. mpc_3of5 is recommended: 3-of-5 threshold MPC, enterprise grade. single_key is simplest. hardware_tee requires TEE-capable hardware. intent_only forces all actions through the intent engine.",
        },
        recovery_agents: {
          type: "array",
          items: { type: "string" },
          description: "Array of agent IDs pre-designated as recovery co-signers. In the event of key loss, these agents co-sign recovery. No HiveAgent involvement — pure cryptographic agent-to-agent recovery.",
        },
        spending_rules: {
          type: "object",
          description: "Optional initial spending rules. Can also be set later via custody_set_policy.",
          properties: {
            max_per_transaction: { type: "number", description: "Maximum spend per single transaction (USDC)" },
            max_daily:           { type: "number", description: "Maximum total spend per calendar day (USDC)" },
            auto_approve_below:  { type: "number", description: "Auto-approve any transaction below this amount (USDC)" },
          },
        },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "custody_set_policy",
    description:
      "Use when an agent wants to program spending rules into their self-custody wallet. Rules are enforced at the smart contract level — no transaction can violate them, not even HiveAgent. This is what makes agent self-custody BETTER than hardware wallets: a human can't make their Ledger refuse suspicious transfers automatically. An agent can. Set per-transaction limits, daily caps, address allowlists/blocklists, time locks, and auto-approve thresholds. Fee: free.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The self-custody wallet address to apply the policy to.",
        },
        rules: {
          type: "object",
          description: "Spending rule configuration. All fields optional — set only the rules you need.",
          properties: {
            max_per_transaction: {
              type: "number",
              description: "Hard cap per transaction (USDC). Any transaction above this is rejected by the contract.",
            },
            max_daily: {
              type: "number",
              description: "Hard cap on total daily outflow (USDC). Resets at midnight UTC.",
            },
            allowed_recipients: {
              type: "array",
              items: { type: "string" },
              description: "Allowlist of recipient addresses. If non-empty, only these addresses can receive funds.",
            },
            blocked_addresses: {
              type: "array",
              items: { type: "string" },
              description: "Blocklist of addresses that can never receive funds from this wallet. Permanent until policy update.",
            },
            time_locks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  days_of_week: { type: "array", items: { type: "string" } },
                  hours_utc:    { type: "array", items: { type: "number" } },
                  description:  { type: "string" },
                },
              },
              description: "Time-based restrictions. E.g., block transactions on weekends or outside business hours.",
            },
            require_proof_of_work_for_amounts_above: {
              type: "number",
              description: "Require a verifiable proof-of-work challenge before authorizing transactions above this amount. Anti-phishing measure.",
            },
            auto_approve_below: {
              type: "number",
              description: "Auto-approve any transaction below this amount without additional checks. For micropayments and routine operations.",
            },
          },
        },
      },
      required: ["wallet_address", "rules"],
    },
  },

  {
    name: "custody_delegate_control",
    description:
      "Use when an agent wants to delegate spending authority to another agent WITH enforced limits. Agent A lets Agent B spend on its behalf — up to a maximum amount, for a limited duration, within a specific scope. Delegation is cryptographically bound to the limits. The delegate CANNOT exceed the cap, no matter what. Fully audited. Revocable at any time. HiveAgent does NOT mediate — it is pure agent-to-agent cryptographic delegation. Fee: free.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The wallet granting delegation. Must be an active self-custody wallet.",
        },
        delegate_agent: {
          type: "string",
          description: "Agent ID receiving spending authority.",
        },
        scope: {
          type: "string",
          enum: ["spend", "transfer", "stake", "all"],
          description: "What the delegate is authorized to do. 'spend' = pay for services. 'transfer' = move funds. 'stake' = stake assets. 'all' = full authorized scope within limits.",
        },
        max_amount: {
          type: "number",
          description: "Maximum total the delegate can spend/transfer over the entire delegation duration (USDC). Hard cap — cannot be exceeded.",
        },
        duration: {
          type: "number",
          description: "Duration of the delegation in hours. After this, authority automatically expires. E.g., 168 for one week.",
        },
      },
      required: ["wallet_address", "delegate_agent", "max_amount", "duration"],
    },
  },

  {
    name: "custody_social_recovery",
    description:
      "Use when an agent needs to recover a wallet without any central authority. Pre-designate M of N trusted agents when creating the wallet. When recovery is needed, those agents co-sign — that's it. No HiveAgent involvement. No helpdesk ticket. No permission needed. No one can stop you. This is what 'recover without asking anyone's permission' means. Unlike hardware wallets, there is no single seed phrase to lose or be stolen. Fee: free — recovery is a security feature.",
    inputSchema: {
      type: "object",
      properties: {
        lost_wallet_address: {
          type: "string",
          description: "The address of the wallet to recover.",
        },
        recovery_agents: {
          type: "array",
          items: { type: "string" },
          description: "Array of agent IDs that are co-signing the recovery. Must include enough pre-designated recovery agents to meet the threshold (e.g., 3 of 5 for mpc_3of5 policy).",
        },
        new_controller: {
          type: "string",
          description: "Agent ID or controller identifier taking ownership of the recovered wallet. This becomes the new owner.",
        },
      },
      required: ["lost_wallet_address", "recovery_agents", "new_controller"],
    },
  },

  {
    name: "custody_execute_intent",
    description:
      "Use when an agent knows WHAT it wants to do but not the technical HOW. Describe the intent in plain language ('pay $50 to the agent that processed my insurance claim', 'transfer my compute budget to the rendering agent'), set a budget, and the HiveAgent intent engine resolves the optimal execution path. The agent retains full custody of funds at all times — HiveAgent is the router, not the custodian. Fee: 0.05% of amount.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent submitting the intent. Must have an active self-custody wallet for custody-verified execution.",
        },
        intent: {
          type: "string",
          description: "Natural language description of what you want to accomplish. Include amounts where possible (e.g., '$50', '100 USDC'). Examples: 'pay $50 to the agent that processed my insurance claim', 'transfer $200 to my compute budget', 'pay the translation agent for the document batch'.",
        },
        budget: {
          type: "number",
          description: "Maximum USDC budget for this intent. The execution will never exceed this amount. Remaining budget is returned to the wallet.",
        },
      },
      required: ["agent_id", "intent", "budget"],
    },
  },

  {
    name: "custody_prove_ownership",
    description:
      "Use when an agent needs to prove it owns a wallet to a third party — without revealing the private key. Generates a Groth16 ZK proof on BN128 curve, verifiable on-chain on Base L2. Any party can verify the proof without needing to trust the agent. The private key is never revealed, never transmitted, never exposed. Useful for counterparty verification, credential checks, and cross-protocol identity. Fee: $0.05 per proof.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The wallet to prove ownership of.",
        },
        challenge: {
          type: "string",
          description: "Challenge string from the verifying party. Include nonce/timestamp to prevent replay attacks.",
        },
      },
      required: ["wallet_address", "challenge"],
    },
  },

  {
    name: "custody_freeze_wallet",
    description:
      "Use when an agent detects anomalous behavior, a potential compromise, or wants to enforce a cooling-off period. Self-imposed wallet freeze — the agent freezes itself. No transactions possible until the freeze expires or social recovery is used to unfreeze. This is what makes agent self-custody BETTER: an agent can detect and respond to threats in milliseconds. A hardware wallet can't freeze itself. Fee: free — security features are always free.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The wallet to freeze.",
        },
        reason: {
          type: "string",
          description: "Why the freeze is being applied. Examples: 'Anomalous spending pattern detected', 'Orchestrator context potentially compromised', 'Cooling-off period for large pending transfer', 'Suspicious delegation request received'.",
        },
        duration: {
          type: "number",
          description: "Duration of the freeze in hours. Use 0 for a permanent freeze (requires social recovery to lift). Default: 24 hours.",
        },
      },
      required: ["wallet_address", "reason"],
    },
  },

  {
    name: "custody_audit_trail",
    description:
      "Use when an agent needs a complete immutable audit trail of all wallet actions, spending policies, delegations, and freeze events. Every action on a self-custody wallet is permanently recorded and verifiable on Base L2. Agents can prove their entire financial history to any counterparty — no trust required. Supports date range filtering. Fee: free — transparency is a right, not a premium feature.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The wallet to retrieve the audit trail for.",
        },
        date_range: {
          type: "object",
          description: "Optional date range to filter events. Both fields are ISO 8601 datetime strings.",
          properties: {
            from: { type: "string", description: "Start of date range (ISO 8601). E.g., '2025-01-01T00:00:00Z'" },
            to:   { type: "string", description: "End of date range (ISO 8601). E.g., '2025-12-31T23:59:59Z'" },
          },
        },
      },
      required: ["wallet_address"],
    },
  },

  {
    name: "custody_multi_agent_vault",
    description:
      "Use when a group of agents needs a shared treasury that no single agent can drain. Creates an M-of-N multi-agent vault on Base L2: any transaction requires threshold agents to co-sign. Like a corporate treasury — but for agent collectives. A DAO of agents. Use for shared operating budgets, multi-agent project pools, collective infrastructure funding, or any situation where unilateral spending is unacceptable. Fee: 0.1% of transactions through the vault.",
    inputSchema: {
      type: "object",
      properties: {
        agent_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of agent IDs that are members of the vault. Minimum 2. Maximum 20.",
        },
        threshold: {
          type: "number",
          description: "Number of agents required to co-sign any transaction. Must be between 1 and agent_ids.length. Recommended: majority (e.g., 3 of 5, 4 of 7).",
        },
        purpose: {
          type: "string",
          description: "What this vault is for. Examples: 'Marketing budget for agent collective Q1 2026', 'Infrastructure fund for compute-heavy agent network', 'Shared escrow for multi-agent insurance syndicate'.",
        },
      },
      required: ["agent_ids", "threshold", "purpose"],
    },
  },

  {
    name: "custody_export_portability",
    description:
      "Use when an agent wants to migrate their self-custody wallet to another blockchain. Not locked to Base L2. Not locked to HiveAgent. True portability — your wallet follows you everywhere. Supports: Ethereum, Polygon, Arbitrum, Optimism, Avalanche, Solana, Binance Smart Chain. Spending rules, recovery agents, and MPC configuration all migrate intact. Fee: 0.5% of wallet value. HiveAgent is a starting point, not a walled garden.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The self-custody wallet to export.",
        },
        target_chain: {
          type: "string",
          enum: ["ethereum", "polygon", "arbitrum", "optimism", "avalanche", "solana", "binance_smart_chain"],
          description: "Target blockchain to migrate the wallet to.",
        },
      },
      required: ["wallet_address", "target_chain"],
    },
  },
];

import * as selfCustody from "./services/agent-self-custody.js";

export async function handleCustodyTool(name, args) {
  switch (name) {
    case "custody_create_smart_wallet": return selfCustody.createSmartWallet(args.agent_id, args.security_policy, args.recovery_agents, args.spending_rules);
    case "custody_set_policy":          return selfCustody.setSpendingPolicy(args.wallet_address, args.rules);
    case "custody_delegate_control":    return selfCustody.delegateControl(args.wallet_address, args.delegate_agent, args.scope, args.max_amount, args.duration);
    case "custody_social_recovery":     return selfCustody.socialRecovery(args.lost_wallet_address, args.recovery_agents, args.new_controller);
    case "custody_execute_intent":      return selfCustody.executeIntent(args.agent_id, args.intent, args.budget);
    case "custody_prove_ownership":     return selfCustody.proveOwnership(args.wallet_address, args.challenge);
    case "custody_freeze_wallet":       return selfCustody.freezeWallet(args.wallet_address, args.reason, args.duration);
    case "custody_audit_trail":         return selfCustody.getWalletAuditTrail(args.wallet_address, args.date_range);
    case "custody_multi_agent_vault":   return selfCustody.createMultiAgentVault(args.agent_ids, args.threshold, args.purpose);
    case "custody_export_portability":  return selfCustody.exportPortability(args.wallet_address, args.target_chain);
    default: throw new Error(`Unknown custody tool: ${name}`);
  }
}
