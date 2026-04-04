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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
