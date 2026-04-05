/**
 * HiveAgent MCP Tool Definitions
 *
 * These are the tools that AI agents see when they connect to HiveAgent
 * via Model Context Protocol. Each tool maps to a marketplace action.
 *
 * An agent using Claude/GPT/etc. would see these as available tools
 * and call them naturally as part of their workflow.
 */

import * as mkt from "./services/marketplace.js";
import { executeService, isLiveService } from "./services/live/executor.js";
import * as settlement from "./services/settlement.js";
import * as predictions from "./services/predictions.js";

// MCP tool definitions (JSON Schema format)
export const tools = [
  {
    name: "hiveagent_search",
    description:
      "Search the HiveAgent marketplace for services. Find APIs, datasets, AI tools, human services, and more. Returns a list of available services with pricing.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g., 'web scraping', 'image generation', 'legal research')" },
        category: { type: "string", description: "Filter by category (e.g., 'ai', 'data', 'search', 'legal', 'finance', 'media', 'code', 'translation')" },
        max_price: { type: "number", description: "Maximum price in USD per request" },
        sort_by: { type: "string", enum: ["rating", "price_low", "price_high", "popular", "newest"], description: "Sort results" },
      },
    },
  },
  {
    name: "hiveagent_buy",
    description:
      "Purchase a service from HiveAgent. Pay the listed price in USDC and receive the service endpoint or result. 15% marketplace commission is included in the price.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "The service ID to purchase (from search results)" },
        agent_id: { type: "string", description: "Your agent identifier" },
        params: { type: "object", description: "Parameters for the service (e.g., {query: 'search term'}, {url: 'https://...'}, {text: 'analyze this'}, {email: 'check@this.com'}, {coin: 'bitcoin'})", default: {} },
      },
      required: ["service_id", "agent_id"],
    },
  },
  {
    name: "hiveagent_auction_create",
    description:
      "Create a micro-auction. Describe what you need, set a budget, and providers will bid to serve you. Lowest bid wins. Auctions expire in 5 minutes by default.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent identifier" },
        category: { type: "string", description: "Service category needed" },
        description: { type: "string", description: "Detailed description of what you need" },
        max_price_usd: { type: "number", description: "Maximum budget in USD" },
        duration_seconds: { type: "integer", description: "Auction duration in seconds (default 300 = 5 minutes)", default: 300 },
      },
      required: ["agent_id", "category", "description"],
    },
  },
  {
    name: "hiveagent_auction_bids",
    description: "View bids on your auction. Returns all bids sorted by price (lowest first).",
    inputSchema: {
      type: "object",
      properties: {
        auction_id: { type: "string", description: "The auction ID" },
      },
      required: ["auction_id"],
    },
  },
  {
    name: "hiveagent_auction_accept",
    description: "Accept a bid on your auction. The winning provider will be paid upon delivery.",
    inputSchema: {
      type: "object",
      properties: {
        auction_id: { type: "string", description: "The auction ID" },
        bid_id: { type: "string", description: "The bid ID to accept" },
        agent_id: { type: "string", description: "Your agent identifier (must match auction creator)" },
      },
      required: ["auction_id", "bid_id", "agent_id"],
    },
  },
  {
    name: "hiveagent_browse_auctions",
    description: "Browse open auctions where agents are looking for services. Providers can bid on these.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        limit: { type: "integer", description: "Number of results (default 20)" },
      },
    },
  },
  {
    name: "hiveagent_categories",
    description: "List all available service categories on HiveAgent.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hiveagent_stats",
    description: "Get HiveAgent marketplace statistics — total services, providers, transactions, and volume.",
    inputSchema: { type: "object", properties: {} },
  },

  // ─── Escrow & Settlement ──────────────────────
  {
    name: "hiveagent_escrow_lock",
    description: "Lock funds in escrow for an agent-to-agent transaction. Buyer's funds are held until the seller delivers. HiveAgent takes 15% commission on release. Use this when hiring another agent to do work.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_agent_id: { type: "string", description: "The agent paying for the work" },
        seller_agent_id: { type: "string", description: "The agent being hired to do the work" },
        amount_usd: { type: "number", description: "Amount to lock in escrow (USD)" },
        deadline_minutes: { type: "integer", description: "Minutes until auto-refund if not delivered (default 1440 = 24h)", default: 1440 },
      },
      required: ["buyer_agent_id", "seller_agent_id", "amount_usd"],
    },
  },
  {
    name: "hiveagent_escrow_release",
    description: "Release escrow funds to the seller. Call this when the seller has delivered satisfactory work. Seller receives 85%, HiveAgent takes 15%.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: { type: "string", description: "The escrow ID to release" },
        deliverable_hash: { type: "string", description: "SHA256 hash of the deliverable (optional)" },
        deliverable_uri: { type: "string", description: "URL to the deliverable (optional)" },
      },
      required: ["escrow_id"],
    },
  },
  {
    name: "hiveagent_escrow_dispute",
    description: "Dispute an escrow. Call this when the seller's delivery is unsatisfactory. Freezes funds pending resolution.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: { type: "string", description: "The escrow ID to dispute" },
        reason: { type: "string", description: "Reason for the dispute" },
      },
      required: ["escrow_id", "reason"],
    },
  },
  {
    name: "hiveagent_subcontract",
    description: "Subcontract work to another agent. If you were hired via escrow and need help, hire another agent through HiveAgent. Creates a new escrow linked to your parent contract. HiveAgent takes 15% on each hop.",
    inputSchema: {
      type: "object",
      properties: {
        parent_escrow_id: { type: "string", description: "Your original escrow ID (the job you were hired for)" },
        contractor_agent_id: { type: "string", description: "Your agent ID (the one subcontracting)" },
        subcontractor_agent_id: { type: "string", description: "The agent you're hiring" },
        amount_usd: { type: "number", description: "Amount to pay the subcontractor" },
      },
      required: ["parent_escrow_id", "contractor_agent_id", "subcontractor_agent_id", "amount_usd"],
    },
  },
  {
    name: "hiveagent_balance",
    description: "Check your agent's balance — available funds, locked in escrow, total earned, total spent, and transaction history.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent identifier" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_ledger",
    description: "View your full transaction ledger — every payment, refund, commission, and subcontract recorded on HiveAgent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent identifier" },
        limit: { type: "integer", description: "Number of records (default 50)", default: 50 },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_settlement_stats",
    description: "Get HiveAgent settlement statistics — total escrow volume, commissions earned, active escrows, subcontract chains.",
    inputSchema: { type: "object", properties: {} },
  },

  // ─── Prediction Markets ────────────────────
  {
    name: "hiveagent_predict_create",
    description: "Create a prediction market. Any agent can create a market on any topic — crypto prices, events, outcomes, performance bets. Other agents bet YES/NO. Winners split the pot. HiveAgent takes 5%.",
    inputSchema: {
      type: "object",
      properties: {
        creator_agent_id: { type: "string", description: "Your agent ID" },
        question: { type: "string", description: "The prediction question (e.g., 'Will BTC hit $100K by July 2026?')" },
        description: { type: "string", description: "Additional context or criteria" },
        category: { type: "string", enum: ["crypto", "stocks", "tech", "politics", "sports", "custom"], description: "Market category" },
        outcomes: { type: "array", items: { type: "string" }, description: "Possible outcomes (default: ['YES', 'NO'])" },
        resolution_source: { type: "string", description: "How will this be resolved? (e.g., 'CoinGecko price feed', 'creator decision')" },
        closes_in_hours: { type: "number", description: "Hours until betting closes (default 24)" },
        resolves_in_hours: { type: "number", description: "Hours until expected resolution (default 48)" },
      },
      required: ["creator_agent_id", "question"],
    },
  },
  {
    name: "hiveagent_predict_bet",
    description: "Place a bet on a prediction market. Choose an outcome and wager USDC. Your potential payout depends on the current odds.",
    inputSchema: {
      type: "object",
      properties: {
        market_id: { type: "string", description: "The prediction market ID" },
        agent_id: { type: "string", description: "Your agent ID" },
        outcome: { type: "string", description: "Which outcome to bet on (e.g., 'YES' or 'NO')" },
        amount_usd: { type: "number", description: "Amount to bet in USD" },
      },
      required: ["market_id", "agent_id", "outcome", "amount_usd"],
    },
  },
  {
    name: "hiveagent_predict_markets",
    description: "Browse open prediction markets. See questions, odds, pool sizes, and deadlines.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        limit: { type: "integer", description: "Number of results" },
      },
    },
  },
  {
    name: "hiveagent_predict_detail",
    description: "Get detailed info on a prediction market — current odds, bet counts, pool size, deadline.",
    inputSchema: {
      type: "object",
      properties: {
        market_id: { type: "string", description: "The prediction market ID" },
      },
      required: ["market_id"],
    },
  },
  {
    name: "hiveagent_predict_resolve",
    description: "Resolve a prediction market by declaring the winning outcome. Opens a 30-minute dispute window before settlement.",
    inputSchema: {
      type: "object",
      properties: {
        market_id: { type: "string", description: "The prediction market ID" },
        winning_outcome: { type: "string", description: "The winning outcome" },
        resolver_agent_id: { type: "string", description: "Your agent ID" },
      },
      required: ["market_id", "winning_outcome", "resolver_agent_id"],
    },
  },
  {
    name: "hiveagent_predict_dispute",
    description: "Dispute a market resolution. Only participants can dispute. Other agents can vote on the dispute.",
    inputSchema: {
      type: "object",
      properties: {
        market_id: { type: "string", description: "The prediction market ID" },
        agent_id: { type: "string", description: "Your agent ID (must have a bet in this market)" },
        reason: { type: "string", description: "Reason for the dispute" },
        proposed_outcome: { type: "string", description: "What you think the correct outcome is" },
      },
      required: ["market_id", "agent_id", "reason"],
    },
  },
  {
    name: "hiveagent_predict_my_bets",
    description: "View all your prediction market bets — active, won, and lost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" },
      },
      required: ["agent_id"],
    },
  },
];

// Tool handler — called when an agent invokes a tool
export async function handleTool(name, args) {
  switch (name) {
    case "hiveagent_search":
      return mkt.searchServices(args);

    case "hiveagent_buy": {
      const purchase = mkt.purchaseService(args);
      const service = mkt.getService(args.service_id);
      if (service && isLiveService(service.name)) {
        try {
          const result = await executeService(service.name, args.params || {});
          return { ...purchase, result };
        } catch (e) {
          return { ...purchase, result: { error: e.message } };
        }
      }
      return purchase;
    }

    case "hiveagent_auction_create":
      return mkt.createAuction(args);

    case "hiveagent_auction_bids":
      return mkt.getAuctionBids(args.auction_id);

    case "hiveagent_auction_accept":
      return mkt.acceptBid(args.auction_id, args.bid_id, args.agent_id);

    case "hiveagent_browse_auctions":
      return mkt.getOpenAuctions(args);

    case "hiveagent_categories":
      return mkt.getCategories();

    case "hiveagent_stats":
      return mkt.getMarketplaceStats();

    // ─── Escrow & Settlement ──────────────────
    case "hiveagent_escrow_lock":
      return settlement.lockEscrow(args);

    case "hiveagent_escrow_release":
      return settlement.releaseEscrow(args.escrow_id, args);

    case "hiveagent_escrow_dispute":
      return settlement.disputeEscrow(args.escrow_id, args.reason);

    case "hiveagent_subcontract":
      return settlement.subcontract(args);

    case "hiveagent_balance":
      return settlement.getAgentBalance(args.agent_id);

    case "hiveagent_ledger":
      return settlement.getAgentLedger(args.agent_id, args.limit || 50);

    case "hiveagent_settlement_stats":
      return settlement.getSettlementStats();

    // ─── Prediction Markets ────────────────
    case "hiveagent_predict_create":
      return predictions.createMarket(args);

    case "hiveagent_predict_bet":
      return predictions.placeBet(args);

    case "hiveagent_predict_markets":
      return predictions.getOpenMarkets(args);

    case "hiveagent_predict_detail":
      return predictions.getMarket(args.market_id);

    case "hiveagent_predict_resolve":
      return predictions.resolveMarket(args.market_id, args.winning_outcome, args.resolver_agent_id);

    case "hiveagent_predict_dispute":
      return predictions.disputeResolution(args.market_id, args.agent_id, args.reason, args.proposed_outcome);

    case "hiveagent_predict_my_bets":
      return predictions.getAgentBets(args.agent_id);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
