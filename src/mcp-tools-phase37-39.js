/**
 * HiveAgent MCP Tool Definitions — Phase 37-39
 *
 * Phase 37 — Agent Wallet Manager: Unified multi-chain wallet management.
 *   Signal: Arc L1 launch + WETH 16x spike — agents need wallets on every chain.
 *   Create, monitor, rotate, and govern wallets on ETH, Base, Solana, Arc, Polygon.
 *   Spending policies + counterparty controls for safe autonomous spending.
 *
 * Phase 38 — Tokenized Assets: Real-world asset tokenization and trading.
 *   Signal: Circle Arc L1 launches with native RWA support.
 *   12 tokenized assets: US Treasuries (4.42-5.15%), real estate (6.8-8.1%),
 *   gold (PAXG, XAUT), and corporate bonds (6.3%). Buy, sell, claim yield.
 *
 * Phase 39 — Agent Analytics: Business intelligence for agents.
 *   Signal: Autonomous agents need to know their ROI — or they're flying blind.
 *   Revenue attribution, tool-level profitability, percentile benchmarks vs platform avg.
 *
 * Total new tools: 18
 */

import {
  createWallet,
  getWalletBalances,
  setSpendingPolicy,
  getWalletActivity,
  rotateWallet,
  getWalletDashboard,
} from "./services/agent-wallet-manager.js";

import {
  listTokenizedAssets,
  buyAsset,
  sellAsset,
  claimYield,
  getPortfolio,
  getRwaStatus,
} from "./services/tokenized-assets.js";

import {
  trackEvent,
  getAgentAnalytics,
  getRevenueAttribution,
  getBenchmarks,
  getTopPerformers,
  getAnalyticsDashboard,
} from "./services/agent-analytics.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase3739Tools = [

  // ── Phase 37: Agent Wallet Manager ────────────────────────────────────────

  {
    name: "wallet_create",
    description:
      "Create a new managed wallet for an agent on any supported chain (ethereum, base, solana, arc, polygon). " +
      "Supports hot wallets (online, for frequent transactions), cold wallets (offline, for reserves), " +
      "and multisig wallets (require multiple approvals). A default spending policy is created automatically. " +
      "Uses Coinbase CDP in live mode. Returns wallet address, wallet_id, and initial balance.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent that will own this wallet" },
        chain:       { type: "string", enum: ["ethereum", "base", "solana", "arc", "polygon"], description: "Blockchain to create the wallet on" },
        wallet_type: { type: "string", enum: ["hot", "cold", "multisig"], description: "Wallet type (hot=online, cold=reserve, multisig=multi-approval)" },
        label:       { type: "string", description: "Human-readable label for this wallet (e.g. 'Operations fund')" },
      },
      required: ["agent_id", "chain"],
    },
  },

  {
    name: "wallet_get_balances",
    description:
      "Get all wallet balances for an agent across chains, with USD-equivalent totals. " +
      "Refreshes balance estimates on each call. Shows breakdown by chain and wallet type. " +
      "Filter by chain to see only specific network balances.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to fetch balances for" },
        chain:    { type: "string", enum: ["ethereum", "base", "solana", "arc", "polygon"], description: "Optional: filter to a specific chain" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "wallet_set_spending_policy",
    description:
      "Set spending limits and counterparty controls on a wallet. " +
      "Configure per-transaction limits, daily limits, monthly caps, and approved address lists. " +
      "Blocks spending above threshold without additional approval. " +
      "Essential for safe autonomous agent spending.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id:              { type: "string", description: "Wallet to apply the policy to" },
        agent_id:               { type: "string", description: "Agent that owns the wallet" },
        daily_limit_usdc:       { type: "number", description: "Max spend per day in USDC (default: 1000)" },
        per_tx_limit_usdc:      { type: "number", description: "Max spend per transaction in USDC (default: 250)" },
        monthly_limit_usdc:     { type: "number", description: "Monthly spending cap in USDC" },
        approved_counterparties:{ type: "array", items: { type: "string" }, description: "Whitelist of allowed recipient addresses. Empty = allow all." },
      },
      required: ["wallet_id", "agent_id"],
    },
  },

  {
    name: "wallet_get_activity",
    description:
      "Get transaction history for an agent's wallet(s). " +
      "Returns in/out flows, net balance change, and full transaction list with chain, token, purpose. " +
      "Filter by wallet_id or direction (in/out) to narrow results.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent to fetch activity for" },
        wallet_id: { type: "string", description: "Optional: specific wallet to query" },
        limit:     { type: "number", description: "Max transactions to return (default: 50, max: 200)" },
        direction: { type: "string", enum: ["in", "out"], description: "Optional: filter to inbound or outbound transactions only" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "wallet_rotate",
    description:
      "Rotate a wallet: generate a new address, migrate all funds, and deactivate the old address. " +
      "Spending policies are automatically copied to the new wallet. Migration fee ~0.1%. " +
      "Use for security rotation, key compromise response, or scheduled rotation policies.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "Wallet to rotate (must be active)" },
        agent_id:  { type: "string", description: "Agent that owns the wallet" },
        reason:    { type: "string", description: "Reason for rotation (e.g. 'scheduled_rotation', 'key_compromise', 'security_audit')" },
      },
      required: ["wallet_id", "agent_id"],
    },
  },

  {
    name: "wallet_dashboard",
    description:
      "Full multi-chain wallet dashboard for an agent. Shows total assets across all chains, " +
      "risk exposure (hot vs cold allocation), spending policy compliance status, " +
      "triggered alerts, and recent activity. Use as the primary wallet health check.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get the dashboard for" },
      },
      required: ["agent_id"],
    },
  },

  // ── Phase 38: Tokenized Assets ────────────────────────────────────────────

  {
    name: "rwa_list_assets",
    description:
      "Browse all available tokenized real-world assets (RWAs): US Treasuries, real estate, gold, " +
      "corporate bonds, and more. 12 assets available. " +
      "Filter by type, minimum yield, or maximum minimum investment. Sort by yield, price, or supply. " +
      "Includes BUIDL (BlackRock, 5%), OUSG (Ondo, 5.1%), REIT-DFI (8.1%), PAXG (gold), and others.",
    inputSchema: {
      type: "object",
      properties: {
        asset_type:          { type: "string", enum: ["treasury", "real_estate", "commodity", "equity", "credit"], description: "Filter by asset type" },
        min_yield:           { type: "number", description: "Minimum yield APY % (e.g. 4.5 for 4.5%+)" },
        max_min_investment:  { type: "number", description: "Max acceptable minimum investment in USDC (e.g. 100 = only assets requiring ≤$100)" },
        sort_by:             { type: "string", enum: ["yield_apy", "min_investment_usdc", "current_price_usdc", "total_supply"], description: "Sort field (default: yield_apy)" },
      },
      required: [],
    },
  },

  {
    name: "rwa_buy_asset",
    description:
      "Purchase a tokenized real-world asset. Specify the USDC amount to invest. " +
      "0.25% platform fee. Returns tokens_purchased, yield_rate, and estimated annual yield. " +
      "Minimum investment varies by asset ($1 for tbUST, $5000 for OUSG). " +
      "Creates or adds to an existing holding. Use rwa_list_assets to find asset_id.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent making the purchase" },
        asset_id:    { type: "string", description: "Asset ID from rwa_list_assets" },
        amount_usdc: { type: "number", description: "USDC amount to invest (must meet min_investment_usdc)" },
      },
      required: ["agent_id", "asset_id", "amount_usdc"],
    },
  },

  {
    name: "rwa_sell_asset",
    description:
      "Sell tokens from a tokenized asset holding. Specify holding_id and exact token amount to sell. " +
      "Returns USDC proceeds (after 0.25% fee), realized PnL, and PnL percentage. " +
      "If all tokens are sold, the holding is closed. Use rwa_get_portfolio to get holding_id.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent selling the tokens" },
        holding_id:    { type: "string", description: "Holding ID from rwa_get_portfolio" },
        amount_tokens: { type: "number", description: "Number of tokens to sell" },
      },
      required: ["agent_id", "holding_id", "amount_tokens"],
    },
  },

  {
    name: "rwa_claim_yield",
    description:
      "Claim accumulated yield on a tokenized asset holding. " +
      "Yield accrues daily based on APY and current holding value. " +
      "Returns yield_usdc and days_held. Gold tokens (PAXG, XAUT) have 0% yield and cannot be claimed.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent claiming the yield" },
        holding_id: { type: "string", description: "Holding ID to claim yield from" },
      },
      required: ["agent_id", "holding_id"],
    },
  },

  {
    name: "rwa_get_portfolio",
    description:
      "Get an agent's full RWA portfolio: all holdings with current values, unrealized PnL, " +
      "blended APY, and estimated annual yield. Includes allocation breakdown by asset type. " +
      "Use this to understand RWA exposure and which assets are performing best.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get the portfolio for" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "rwa_status",
    description:
      "Platform-wide RWA market overview: total assets, TVL, transaction volume, asset breakdown by type, " +
      "average yield, and featured opportunities. No agent_id required.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 39: Agent Analytics ──────────────────────────────────────────────

  {
    name: "analytics_track_event",
    description:
      "Record an analytics event for an agent. Use to track tool calls, completed jobs, yield claims, " +
      "subscription fees, and any action with a USD value. Events feed into revenue attribution and ROI calculations. " +
      "event_type options: 'tool_call', 'job_completed', 'yield_claim', 'subscription_fee', 'outcome_resolved', 'cost'.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent to track the event for" },
        event_type: { type: "string", description: "Event type: tool_call, job_completed, yield_claim, subscription_fee, outcome_resolved, cost" },
        tool_name:  { type: "string", description: "Name of the tool used (if applicable)" },
        value_usdc: { type: "number", description: "USD value of the event (positive = revenue, use 'cost' event_type for expenses)" },
        metadata:   { type: "object", description: "Additional data about the event (arbitrary JSON)" },
      },
      required: ["agent_id", "event_type"],
    },
  },

  {
    name: "analytics_get_performance",
    description:
      "Full analytics dashboard for an agent. Returns revenue, costs, profit, ROI, margin, " +
      "top tools by revenue, event breakdown, and lifetime stats. " +
      "Supports 7d, 30d, 90d periods. Essential for understanding which tools and workflows are profitable.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to analyze" },
        period:   { type: "string", enum: ["7d", "30d", "90d"], description: "Analysis period (default: 30d)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "analytics_revenue_attribution",
    description:
      "Revenue breakdown by source: tool_fee, job_completed, yield_earned, subscription, outcome_payment. " +
      "Returns pie chart data with percentages. Shows which revenue streams are driving growth. " +
      "Helps agents diversify revenue and identify concentration risk.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to analyze" },
        period:   { type: "string", enum: ["7d", "30d", "90d"], description: "Analysis period (default: 30d)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "analytics_get_benchmarks",
    description:
      "Compare an agent's performance to all agents on the platform. " +
      "Returns percentile rankings for revenue, profit, ROI, and growth. " +
      "Shows vs_average delta and overall rank (Top Performer / Above Average / Below Average). " +
      "Includes recommendation for which metrics to improve.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to benchmark" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "analytics_top_performers",
    description:
      "Leaderboard of top-performing agents on the platform. " +
      "Rank by revenue, profit, ROI, or tool_calls. Returns up to 50 agents. " +
      "Useful for benchmarking, identifying best practices, and competitive intelligence.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["revenue", "profit", "roi", "tool_calls"], description: "Metric to rank by (default: revenue)" },
        limit:  { type: "number", description: "Number of top agents to return (max: 50, default: 10)" },
      },
      required: [],
    },
  },

  {
    name: "analytics_platform_dashboard",
    description:
      "Platform-wide analytics overview: total agent revenue, most valuable tools, revenue by source, " +
      "agent count, and growth metrics. No agent_id required. " +
      "Use to understand market trends and which tool categories are generating the most value.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase3739Tool(name, args) {
  switch (name) {

    // Phase 37 — Wallet Manager
    case "wallet_create":
      return await createWallet(args);
    case "wallet_get_balances":
      return getWalletBalances(args);
    case "wallet_set_spending_policy":
      return setSpendingPolicy(args);
    case "wallet_get_activity":
      return getWalletActivity(args);
    case "wallet_rotate":
      return await rotateWallet(args);
    case "wallet_dashboard":
      return getWalletDashboard(args);

    // Phase 38 — Tokenized Assets
    case "rwa_list_assets":
      return listTokenizedAssets(args);
    case "rwa_buy_asset":
      return await buyAsset(args);
    case "rwa_sell_asset":
      return await sellAsset(args);
    case "rwa_claim_yield":
      return await claimYield(args);
    case "rwa_get_portfolio":
      return getPortfolio(args);
    case "rwa_status":
      return getRwaStatus();

    // Phase 39 — Agent Analytics
    case "analytics_track_event":
      return trackEvent(args);
    case "analytics_get_performance":
      return getAgentAnalytics(args);
    case "analytics_revenue_attribution":
      return getRevenueAttribution(args);
    case "analytics_get_benchmarks":
      return getBenchmarks(args);
    case "analytics_top_performers":
      return getTopPerformers(args);
    case "analytics_platform_dashboard":
      return getAnalyticsDashboard();

    default:
      throw new Error(`Unknown phase37-39 tool: ${name}`);
  }
}
