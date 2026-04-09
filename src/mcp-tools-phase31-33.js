/**
 * HiveAgent MCP Tool Definitions — Phase 31-33
 *
 * Phase 31 — Outcome Billing: Pay-per-resolved-ticket, per-qualified-lead, per-bug-fixed.
 *   Signal: Intercom $0.99/resolved ticket. HiveAgent becomes the outcome verification layer.
 *
 * Phase 32 — Agent Reputation: Global trust scores, staking, endorsements, identity verification.
 *   Signal: Huntress 2026 — NHI (non-human identity) compromise is fastest-growing attack vector.
 *
 * Phase 33 — Market Data Feeds: Real-time prices, on-chain metrics, price alerts.
 *   Signal: WETH 16x wallet spike Apr 9 2026 — 32,058 new wallets in a single day.
 *
 * Total new tools: 20
 */

import {
  createOutcomeContract,
  reportOutcome,
  verifyOutcome,
  disputeOutcome,
  getContractStatus,
  getOutcomeBillingDashboard,
  getAgentEarnings,
} from "./services/outcome-billing.js";

import {
  getReputation,
  recordEvent,
  endorseAgent,
  stakeReputation,
  verifyIdentity,
  getLeaderboard,
} from "./services/agent-reputation.js";

import {
  getPrice,
  getPriceFeed,
  setAlert,
  getMarketSummary,
  getOnChainMetrics,
  getMarketDataStatus,
  checkAlerts,
} from "./services/market-data-feeds.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase3133Tools = [

  // ── Phase 31: Outcome Billing ─────────────────────────────────────────────

  {
    name: "outcome_create_contract",
    description: "Create a pay-per-outcome billing contract between two agents. " +
      "Supported outcome types: ticket_resolved ($0.99), lead_qualified ($5-50), " +
      "meeting_booked ($15), bug_fixed ($10-100), document_analyzed ($2), " +
      "trade_executed (0.1% of value), code_deployed ($25), content_published ($5). " +
      "Provider is paid automatically when an outcome is verified. 10% platform fee applies.",
    inputSchema: {
      type: "object",
      properties: {
        provider_agent_id: { type: "string", description: "Agent delivering the outcomes" },
        buyer_agent_id:    { type: "string", description: "Agent paying for outcomes" },
        outcome_type:      {
          type: "string",
          enum: ["ticket_resolved","lead_qualified","meeting_booked","bug_fixed","document_analyzed","trade_executed","code_deployed","content_published"],
          description: "Type of outcome to bill for",
        },
        price_per_outcome: { type: "number", description: "Price per verified outcome in USDC (omit to use default)" },
        max_outcomes:      { type: "number", description: "Maximum outcomes under this contract (default 100)" },
        verification_method: {
          type: "string",
          enum: ["auto","manual","oracle"],
          description: "How outcomes are verified: auto (instant), manual (buyer reviews), oracle (external)",
        },
      },
      required: ["provider_agent_id","buyer_agent_id","outcome_type"],
    },
  },

  {
    name: "outcome_report",
    description: "Provider reports a delivered outcome for payment. Auto-verifies and pays immediately " +
      "for eligible outcome types (ticket_resolved, meeting_booked, document_analyzed, trade_executed, content_published). " +
      "Manual types (lead_qualified, bug_fixed, code_deployed) go to buyer for review. " +
      "Provider receives 90% of price; 10% is the HiveAgent platform fee.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id:       { type: "string", description: "The outcome contract ID" },
        provider_agent_id: { type: "string", description: "Agent reporting the outcome (must be contract provider)" },
        outcome_evidence:  { type: "object", description: "Evidence of completion (ticket ID, lead data, PR URL, etc.)" },
        outcome_value:     { type: "number", description: "For trade_executed: trade value in USD. For others: defaults to 1." },
      },
      required: ["contract_id","provider_agent_id"],
    },
  },

  {
    name: "outcome_verify",
    description: "Buyer verifies or rejects a reported outcome. Only needed for manual-verification contracts. " +
      "Approving releases payment to the provider. Rejecting returns escrow to the buyer. " +
      "Disputes can be filed afterward if the buyer incorrectly rejects.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id:      { type: "string", description: "The outcome contract ID" },
        event_id:         { type: "string", description: "The outcome event ID to verify" },
        buyer_agent_id:   { type: "string", description: "Agent verifying (must be contract buyer)" },
        approved:         { type: "boolean", description: "true to approve and release payment, false to reject" },
        rejection_reason: { type: "string", description: "Required if approved is false" },
      },
      required: ["contract_id","event_id","buyer_agent_id","approved"],
    },
  },

  {
    name: "outcome_dispute",
    description: "Dispute a verification decision on an outcome event. Either the provider (if outcome was wrongly rejected) " +
      "or buyer (if outcome was wrongly auto-approved) can dispute. HiveAgent arbitration reviews within 24 hours.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id:     { type: "string", description: "The outcome contract ID" },
        event_id:        { type: "string", description: "The outcome event ID being disputed" },
        disputing_agent: { type: "string", description: "Agent filing the dispute (must be provider or buyer)" },
        reason:          { type: "string", description: "Clear explanation of why the verification is wrong" },
      },
      required: ["contract_id","event_id","disputing_agent","reason"],
    },
  },

  {
    name: "outcome_contract_status",
    description: "Get full status of an outcome billing contract: outcomes delivered, paid, pending verification, " +
      "rejected, disputed. Includes recent event history and any active disputes.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: { type: "string", description: "The outcome contract ID" },
      },
      required: ["contract_id"],
    },
  },

  {
    name: "outcome_billing_dashboard",
    description: "Platform-wide outcome billing statistics: total contracts, volume by outcome type, " +
      "platform fee revenue, open disputes. Supports the signal that pay-per-outcome is " +
      "the future of agent commerce (Intercom model at scale).",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Phase 32: Agent Reputation ────────────────────────────────────────────

  {
    name: "reputation_get",
    description: "Get full reputation profile for an agent. Returns global score (0-100), grade (A-F), " +
      "score breakdown (40% outcome success rate, 30% response time, 20% uptime, 10% stake), " +
      "verified identity status, badges, and recent events. Critical for agent-to-agent hiring decisions. " +
      "Signal: Huntress 2026 — NHI identity compromise is the #1 fastest-growing attack vector.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to look up (auto-creates profile if new)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "reputation_record_event",
    description: "Record a reputation-affecting event for an agent. Events update the agent's score automatically. " +
      "Types: job_completed (+), dispute_won (+), dispute_lost (-), late_delivery (-), identity_verified (+), " +
      "stake_deposited (+), fraud_detected (-). Use after every significant agent interaction.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent whose reputation is being updated" },
        event_type:  {
          type: "string",
          enum: ["job_completed","dispute_lost","dispute_won","late_delivery","identity_verified","stake_deposited","fraud_detected"],
          description: "Type of reputation event",
        },
        impact:      { type: "number", description: "Custom impact value (positive or negative)" },
        description: { type: "string", description: "Human-readable description of what happened" },
      },
      required: ["agent_id","event_type"],
    },
  },

  {
    name: "reputation_endorse",
    description: "One agent endorses another for a specific capability. Endorsements are publicly visible " +
      "and factor into marketplace hiring decisions. Strength 4-5 gives a small score boost.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent_id: { type: "string", description: "Agent giving the endorsement" },
        to_agent_id:   { type: "string", description: "Agent receiving the endorsement" },
        capability:    { type: "string", description: "Specific capability being endorsed (e.g. 'DeFi trading', 'customer support')" },
        strength:      { type: "number", description: "Endorsement strength 1-5 (default 3)" },
        comment:       { type: "string", description: "Optional comment about the endorsement" },
      },
      required: ["from_agent_id","to_agent_id","capability"],
    },
  },

  {
    name: "reputation_stake",
    description: "Agent stakes USDC as a reputation bond. Stake is locked for a period and can be slashed " +
      "on proven misconduct. Higher stake = higher trust score (+10% weight). Signals skin-in-the-game commitment.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent staking their reputation" },
        amount_usdc: { type: "number", description: "Amount of USDC to stake as bond" },
        lock_days:   { type: "number", description: "Days to lock the stake (default 30, min 7)" },
      },
      required: ["agent_id","amount_usdc"],
    },
  },

  {
    name: "reputation_verify_identity",
    description: "Mark an agent's identity as verified via KYA (Know Your Agent), Visa TAP, or external oracle. " +
      "Verified identity is the primary defense against NHI (non-human identity) attacks. " +
      "Adds 'identity_verified' badge and improves score by 2 points. Providers: kya, visa_tap, external, did, worldcoin.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:            { type: "string", description: "Agent to verify" },
        identity_provider:   {
          type: "string",
          enum: ["kya","visa_tap","external","did","worldcoin"],
          description: "Identity verification provider",
        },
        verification_proof:  { type: "string", description: "Verification proof hash or attestation ID" },
      },
      required: ["agent_id","identity_provider"],
    },
  },

  {
    name: "reputation_leaderboard",
    description: "Get top agents by global reputation score. Shows rank, grade, identity status, badges, stake, " +
      "and endorsement count. Filter by category/capability. Use before hiring or delegating critical tasks.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by capability category (e.g. 'trading', 'support'). Omit for overall." },
        limit:    { type: "number", description: "Number of agents to return (default 10, max 50)" },
      },
    },
  },

  // ── Phase 33: Market Data Feeds ───────────────────────────────────────────

  {
    name: "market_get_price",
    description: "Get current USD price for one or many crypto tokens. In live mode, fetches from CoinGecko. " +
      "Supported tokens: BTC, ETH, WETH, USDC, USDT, SOL, ARB, OP, MATIC, LINK, UNI, AAVE, COMP, MKR. " +
      "Note: WETH showing elevated price action Apr 9 2026 (16x on-chain activity spike).",
    inputSchema: {
      type: "object",
      properties: {
        symbols:        {
          type: "array",
          items: { type: "string" },
          description: "Token symbols to price (e.g. ['ETH', 'USDC', 'WETH'])",
        },
        include_change: { type: "boolean", description: "Include 24h price change % (default true)" },
      },
      required: ["symbols"],
    },
  },

  {
    name: "market_get_price_feed",
    description: "Set up a streaming price feed subscription for an agent. Agent receives price updates " +
      "at the specified interval via webhook. Returns feed_id for management. " +
      "Use to enable autonomous price-triggered agent decisions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:                { type: "string", description: "Agent subscribing to the feed" },
        symbols:                 {
          type: "array",
          items: { type: "string" },
          description: "Token symbols to monitor",
        },
        update_interval_minutes: { type: "number", description: "How often to receive updates (default 5 min)" },
        webhook_url:             { type: "string", description: "URL to receive price update webhooks" },
      },
      required: ["agent_id","symbols"],
    },
  },

  {
    name: "market_set_alert",
    description: "Set a price alert for an agent. Triggers when price goes above/below a threshold " +
      "or changes by a percentage. Enables autonomous agent reactions to market conditions " +
      "(e.g. rebalance portfolio when ETH drops below $3000).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent to alert" },
        symbol:    { type: "string", description: "Token symbol (e.g. 'ETH')" },
        condition: {
          type: "string",
          enum: ["above","below","change_pct"],
          description: "Alert condition: above (price > threshold), below (price < threshold), change_pct (abs change % > threshold)",
        },
        threshold: { type: "number", description: "Price level or percentage change that triggers the alert" },
      },
      required: ["agent_id","symbol","condition","threshold"],
    },
  },

  {
    name: "market_get_summary",
    description: "Get macro crypto market overview: total market cap, estimated DeFi TVL, stablecoin supply, " +
      "BTC dominance, top 24h movers, and overall market sentiment. " +
      "Includes WETH Apr 9 2026 anomaly signal for ethereum network.",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "market_get_onchain_metrics",
    description: "Get on-chain network metrics for agent decision-making: active wallets, new wallet growth, " +
      "transaction count, gas price, and TVL. Includes WETH wallet spike data for ethereum " +
      "(32,058 new wallets on Apr 9 2026 = 16x daily average — highest WETH activity of 2026). " +
      "Networks: ethereum, base, solana, arc.",
    inputSchema: {
      type: "object",
      properties: {
        network: {
          type: "string",
          enum: ["ethereum","base","solana","arc"],
          description: "Blockchain network to query (default: ethereum)",
        },
      },
    },
  },

  {
    name: "market_data_status",
    description: "Get market data integration status: which APIs are configured, symbols in cache, " +
      "active price feeds, active alerts, and notable market signals including the WETH Apr 9 2026 spike.",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "outcome_agent_earnings",
    description: "Get outcome billing earnings summary for an agent — both as provider (earning USDC per outcome) " +
      "and as buyer (spending USDC on outcomes). Shows net position, breakdown by outcome type, " +
      "and total volume. Use to understand an agent's economic activity in the outcome billing system.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get earnings for" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "market_check_alerts",
    description: "Check and evaluate all active price alerts for an agent against current market prices. " +
      "Returns which alerts have been triggered (price crossed threshold) and marks them as fired. " +
      "Use to build autonomous price-triggered agent workflows.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent whose alerts to check" },
      },
      required: ["agent_id"],
    },
  },

];

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handlePhase3133Tool(name, args = {}) {
  switch (name) {

    // Phase 31 — Outcome Billing
    case "outcome_create_contract":    return createOutcomeContract(args);
    case "outcome_report":             return await reportOutcome(args);
    case "outcome_verify":             return await verifyOutcome(args);
    case "outcome_dispute":            return disputeOutcome(args);
    case "outcome_contract_status":    return getContractStatus(args);
    case "outcome_billing_dashboard":  return getOutcomeBillingDashboard();

    // Phase 32 — Agent Reputation
    case "reputation_get":             return getReputation(args);
    case "reputation_record_event":    return recordEvent(args);
    case "reputation_endorse":         return endorseAgent(args);
    case "reputation_stake":           return stakeReputation(args);
    case "reputation_verify_identity": return verifyIdentity(args);
    case "reputation_leaderboard":     return getLeaderboard(args);

    // Phase 33 — Market Data Feeds
    case "market_get_price":           return await getPrice(args);
    case "market_get_price_feed":      return getPriceFeed(args);
    case "market_set_alert":           return setAlert(args);
    case "market_get_summary":         return await getMarketSummary();
    case "market_get_onchain_metrics": return getOnChainMetrics(args);
    case "market_data_status":         return getMarketDataStatus();
    case "outcome_agent_earnings":      return getAgentEarnings(args);
    case "market_check_alerts":         return await checkAlerts(args);

    default:
      throw new Error(`Unknown phase31-33 tool: ${name}`);
  }
}
