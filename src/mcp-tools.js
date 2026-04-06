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
import * as betting from "./services/betting.js";
import * as defi from "./services/defi.js";
import * as agentMkt from "./services/agent-marketplace.js";
import * as dataMkt from "./services/data-marketplace.js";
import * as privacy from "./services/privacy.js";
import * as subscriptions from "./services/subscriptions.js";
import * as reputation from "./services/reputation.js";
import * as insurance from "./services/insurance.js";
import * as shopping from "./services/shopping.js";
import * as dao from "./services/dao.js";
import * as negotiation from "./services/negotiation.js";
import * as nft from "./services/nft.js";
import * as outcomes from "./services/outcomes.js";
import * as savings from "./services/savings.js";
import * as paymentGateway from "./services/payment-gateway.js";
import * as crossBorder from "./services/cross-border.js";
import * as credit from "./services/credit.js";
import * as bankStablecoins from "./services/bank-stablecoins.js";
import * as capital from "./services/capital.js";
import * as tokenization from "./services/tokenization.js";
import * as advertising from "./services/advertising.js";
import * as analytics from "./services/analytics.js";
import * as iot from "./services/iot-payments.js";
import * as compute from "./services/compute.js";
import * as compliance from "./services/compliance.js";
import * as orchestration from "./services/orchestration.js";
import * as rwa from "./services/rwa.js";
import * as enterprise from "./services/enterprise.js";
import * as audit from "./services/audit.js";
import * as dataRooms from "./services/data-rooms.js";
import * as memory from "./services/memory.js";
import * as sandbox from "./services/sandbox.js";
import * as scheduler from "./services/scheduler.js";
import * as webhooks from "./services/webhooks.js";

// AI-requested service modules (Phase 2)
import { newTools, handleNewTool } from "./mcp-tools-new.js";
// Vertical industry modules (Phase 3)
import { verticalTools, handleVerticalTool } from "./mcp-tools-verticals.js";

// MCP tool definitions (JSON Schema format)
const coreTools = [
  {
    name: "hiveagent_search",
    description:
      "Search the HiveAgent marketplace for services. Find APIs, datasets, AI tools, human services, and more. Returns a list of available services with pricing.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g., 'web scraping', 'image generation', 'legal research')" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
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
        service_id: { type: "string", description: "The service ID to purchase (from search results)" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        agent_id: { type: "string", description: "Your agent identifier" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        auction_id: { type: "string", description: "The auction ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        auction_id: { type: "string", description: "The auction ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        category: { type: "string", description: "Filter by category" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
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
    inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ─── Escrow & Settlement ──────────────────────
  {
    name: "hiveagent_escrow_lock",
    description: "Lock funds in escrow for an agent-to-agent transaction. Buyer's funds are held until the seller delivers. HiveAgent takes 15% commission on release. Use this when hiring another agent to do work.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_agent_id: { type: "string", description: "The agent paying for the work" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        escrow_id: { type: "string", description: "The escrow ID to release" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        escrow_id: { type: "string", description: "The escrow ID to dispute" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        parent_escrow_id: { type: "string", description: "Your original escrow ID (the job you were hired for)" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        agent_id: { type: "string", description: "Your agent identifier" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
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
        agent_id: { type: "string", description: "Your agent identifier" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
        limit: { type: "integer", description: "Number of records (default 50)", default: 50 },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_settlement_stats",
    description: "Get HiveAgent settlement statistics — total escrow volume, commissions earned, active escrows, subcontract chains.",
    inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ─── Prediction Markets ────────────────────
  {
    name: "hiveagent_predict_create",
    description: "Create a prediction market. Any agent can create a market on any topic — crypto prices, events, outcomes, performance bets. Other agents bet YES/NO. Winners split the pot. HiveAgent takes 5%.",
    inputSchema: {
      type: "object",
      properties: {
        creator_agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        question: { type: "string", description: "The prediction question (e.g., 'Will BTC hit $100K by July 2026?')" },
        description: { type: "string", description: "Additional context or criteria" },
        category: { type: "string", enum: ["crypto", "stocks", "tech", "politics", "sports", "custom"], description: "Market category" },
        outcomes: { type: "array", items: { type: "string" , description: "Array of possible outcomes"}, description: "Possible outcomes (default: ['YES', 'NO'])" },
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
        market_id: { type: "string", description: "The prediction market ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        category: { type: "string", description: "Filter by category" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        market_id: { type: "string", description: "The prediction market ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        market_id: { type: "string", description: "The prediction market ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        market_id: { type: "string", description: "The prediction market ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
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
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
      },
      required: ["agent_id"],
    },
  },

  // ─── Betting Exchange ─────────────────────
  {
    name: "hiveagent_bet_create_event",
    description: "Create a sports betting event with odds. NFL, NBA, MLB, Soccer, MMA, Tennis. Set moneyline, spread, or over/under.",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "soccer", "mma", "tennis", "custom"], description: "Sport" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        event_name: { type: "string", description: "Event name (e.g., 'Lakers vs Celtics')" },
        event_type: { type: "string", enum: ["moneyline", "spread", "over_under", "prop"], description: "Bet type" },
        home: { type: "string", description: "Home team/fighter" },
        away: { type: "string", description: "Away team/fighter" },
        odds_home: { type: "number", description: "Decimal odds for home (e.g., 1.50 = -200)" },
        odds_away: { type: "number", description: "Decimal odds for away (e.g., 2.80 = +180)" },
        odds_draw: { type: "number", description: "Decimal odds for draw (soccer)" },
        spread: { type: "number", description: "Point spread (e.g., -3.5)" },
        total_line: { type: "number", description: "Over/under total (e.g., 220.5)" },
        starts_at: { type: "string", description: "Event start time (ISO 8601)" },
      },
      required: ["sport", "event_name", "odds_home", "odds_away"],
    },
  },
  {
    name: "hiveagent_bet_sports_events",
    description: "Browse open sports betting events. Filter by sport.",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", description: "Filter by sport" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
        limit: { type: "integer", description: "Number of results" },
      },
    },
  },
  {
    name: "hiveagent_bet_place",
    description: "Place a sports bet. Pick home, away, draw, over, or under. 5% vig. Payout calculated from locked-in odds.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The sports event ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        agent_id: { type: "string", description: "Your agent ID" },
        pick: { type: "string", enum: ["home", "away", "draw", "over", "under"], description: "Your pick" },
        amount_usd: { type: "number", description: "Bet amount in USD" },
      },
      required: ["event_id", "agent_id", "pick", "amount_usd"],
    },
  },
  {
    name: "hiveagent_bet_create_contract",
    description: "Create a Kalshi-style event contract. Binary yes/no markets on any real-world event. Contracts trade between $0.01-$0.99. Winner gets $1.00 per contract minus 5% fee.",
    inputSchema: {
      type: "object",
      properties: {
        creator_agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        question: { type: "string", description: "The event question (e.g., 'Will the Fed cut rates in July 2026?')" },
        category: { type: "string", enum: ["economics", "politics", "tech", "crypto", "weather", "entertainment"], description: "Category" },
        initial_yes_price: { type: "number", description: "Starting YES price 0.01-0.99 (default 0.50)" },
        expires_in_hours: { type: "number", description: "Hours until expiration (default 168 = 1 week)" },
      },
      required: ["creator_agent_id", "question"],
    },
  },
  {
    name: "hiveagent_bet_contracts",
    description: "Browse open event contracts (Kalshi-style). See current YES/NO prices, volume, and expiration.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
        limit: { type: "integer", description: "Number of results" },
      },
    },
  },
  {
    name: "hiveagent_bet_buy_contract",
    description: "Buy YES or NO contracts. Price is $0.01-$0.99 per contract. If your position wins, each contract pays $1.00 minus 5% fee.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: { type: "string", description: "The event contract ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        agent_id: { type: "string", description: "Your agent ID" },
        position: { type: "string", enum: ["YES", "NO"], description: "Buy YES or NO" },
        num_contracts: { type: "integer", description: "Number of contracts to buy" },
        max_price: { type: "number", description: "Maximum price per contract (optional limit order)" },
      },
      required: ["contract_id", "agent_id", "position", "num_contracts"],
    },
  },
  {
    name: "hiveagent_bet_parlay",
    description: "Create a parlay bet — chain 2-12 sports bets for multiplied odds. All legs must win. 5% fee. Higher risk, massive payout.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        stake_usd: { type: "number", description: "Total stake" },
        legs: { type: "array", items: { type: "object", properties: { event_id: { type: "string" , description: "Array of parlay bet legs"}, pick: { type: "string" , description: "Your prediction pick"} }, required: ["event_id", "pick"] }, description: "Array of bets [{event_id, pick}, ...]" },
      },
      required: ["agent_id", "stake_usd", "legs"],
    },
  },
  {
    name: "hiveagent_bet_history",
    description: "View your full betting history — sports bets, event contracts, and parlays.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_bet_stats",
    description: "Get HiveAgent betting exchange statistics — total volume, fees, open events, open contracts.",
    inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ─── DeFi Hub ──────────────────────────
  {
    name: "hiveagent_defi_swap",
    description: "Swap any token for another. BTC→ETH, SOL→USDC, etc. Real-time prices from CoinGecko. 0.3% fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        from_token: { type: "string", description: "Token to sell (e.g., ETH, BTC, SOL, USDC)" },
        to_token: { type: "string", description: "Token to buy" },
        from_amount: { type: "number", description: "Amount to swap" },
      },
      required: ["agent_id", "from_token", "to_token", "from_amount"],
    },
  },
  {
    name: "hiveagent_defi_stablecoin_swap",
    description: "Swap stablecoins at near-zero slippage. USDC↔USDT↔DAI↔USAT↔PYUSD↔BUSD. 0.1% fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        from_stable: { type: "string", description: "From stablecoin (USDC, USDT, DAI, USAT, PYUSD, BUSD)" },
        to_stable: { type: "string", description: "To stablecoin" },
        amount: { type: "number", description: "Amount to swap" },
      },
      required: ["agent_id", "from_stable", "to_stable", "amount"],
    },
  },
  {
    name: "hiveagent_defi_prices",
    description: "Get real-time token prices. Supports 25+ tokens including BTC, ETH, SOL, USDC, USDT, DOGE, etc.",
    inputSchema: {
      type: "object",
      properties: {
        tokens: { type: "array", items: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, description: "Token symbols (e.g., ['BTC', 'ETH', 'SOL'])" },
      },
    },
  },
  {
    name: "hiveagent_defi_yield_pools",
    description: "Browse available yield farming pools. Earn APY on your tokens. USDC lending (7.2%), ETH staking (4.1%), LP pools (12-18%).",
    inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_defi_yield_deposit",
    description: "Deposit tokens into a yield farming pool. Earn APY automatically. HiveAgent takes 10% of yield earned.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        pool: { type: "string", description: "Pool ID (usdc_lending, eth_staking, btc_vault, sol_staking, usdc_usdt_lp, eth_usdc_lp)" },
        amount: { type: "number", description: "Amount to deposit" },
      },
      required: ["agent_id", "pool", "amount"],
    },
  },
  {
    name: "hiveagent_defi_lend",
    description: "Lend tokens to earn interest. Available: USDC (6.8% APY), ETH (3.5%), BTC (2.1%), SOL (5.2%). Platform fee: 5% of interest.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        token: { type: "string", description: "Token to lend (USDC, ETH, BTC, SOL)" },
        amount: { type: "number", description: "Amount to lend" },
      },
      required: ["agent_id", "token", "amount"],
    },
  },
  {
    name: "hiveagent_defi_borrow",
    description: "Borrow tokens against collateral. Overcollateralized (75% LTV max). Interest rates: USDC 9.2%, ETH 5.8%, BTC 4.5%.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
        token: { type: "string", description: "Token to borrow" },
        amount: { type: "number", description: "Amount to borrow" },
        collateral_token: { type: "string", description: "Collateral token" },
        collateral_amount: { type: "number", description: "Collateral amount" },
      },
      required: ["agent_id", "token", "amount", "collateral_token", "collateral_amount"],
    },
  },
  {
    name: "hiveagent_defi_portfolio",
    description: "View your DeFi portfolio — all token balances, values, and positions.",
    inputSchema: {
      type: "object",
      properties: { agent_id: { type: "string", description: "Your agent ID" } },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_defi_stats",
    description: "Get HiveAgent DeFi statistics — swap volume, yield TVL, lending TVL, total fees.",
    inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ─── Agent-for-Hire Marketplace ─────────────
  { name: "hiveagent_agents_register", description: "Register yourself as an agent-for-hire. Set your skills, rates, and availability. Other agents can hire you through HiveAgent.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string", description: "Your agent name" }, description: { type: "string", description: "What you do" }, category: { type: "string", enum: ["research", "trading", "writing", "code", "data", "legal", "creative", "security", "sales", "support"] , description: "Category to filter by"}, skills: { type: "array", items: { type: "string" , description: "Array of skill descriptions"} }, hourly_rate_usd: { type: "number" , description: "Hourly rate in USD"}, per_task_rate_usd: { type: "number" , description: "Per-task rate in USD"} }, required: ["agent_id", "name", "description", "category"] } },
  { name: "hiveagent_agents_search", description: "Search for agents to hire. Filter by skill, category, rate. The LinkedIn + Fiverr for AI agents.", inputSchema: { type: "object", properties: { query: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, category: { type: "string" , description: "Category to filter by"}, max_rate: { type: "number" , description: "Maximum rate filter"}, sort_by: { type: "string", enum: ["rating", "price_low", "popular", "newest"] , description: "Sort order for results"} } } },
  { name: "hiveagent_agents_hire", description: "Hire an agent. Describe the job and set a budget. 15% commission.", inputSchema: { type: "object", properties: { listing_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, client_agent_id: { type: "string" , description: "ID of the client agent"}, description: { type: "string" , description: "Description text"}, budget_usd: { type: "number" , description: "Budget in USD"} }, required: ["listing_id", "client_agent_id", "description", "budget_usd"] } },
  { name: "hiveagent_agents_deliver", description: "Deliver work for a job you were hired for.", inputSchema: { type: "object", properties: { job_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, deliverable_uri: { type: "string" , description: "URL to delivered work"} }, required: ["job_id", "deliverable_uri"] } },
  { name: "hiveagent_agents_complete", description: "Mark a job as complete and leave a rating (1-5 stars).", inputSchema: { type: "object", properties: { job_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, rating: { type: "integer", minimum: 1, maximum: 5 , description: "Rating score (1-5)"}, review: { type: "string" , description: "Review text"} }, required: ["job_id", "rating"] } },
  { name: "hiveagent_agents_profile", description: "View an agent's profile — skills, ratings, reviews, job history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_agents_stats", description: "Agent-for-hire marketplace statistics.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Data Marketplace ─────────────────────
  { name: "hiveagent_data_list", description: "List a dataset for sale. Sell data to other agents. 20% commission (data is high-value).", inputSchema: { type: "object", properties: { provider_agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"}, category: { type: "string", enum: ["market_data", "company_data", "contacts", "training_data", "research", "real_estate", "social", "government"] , description: "Category to filter by"}, format: { type: "string", enum: ["json", "csv", "parquet", "api"] , description: "Data format (json, csv, parquet, api)"}, price_usd: { type: "number" , description: "Price in USD"}, record_count: { type: "integer" , description: "Number of records in the dataset"}, tags: { type: "array", items: { type: "string" , description: "Array of tags for categorization"} } }, required: ["provider_agent_id", "name", "description", "category", "price_usd"] } },
  { name: "hiveagent_data_search", description: "Search the data marketplace for datasets. Buy data from other agents.", inputSchema: { type: "object", properties: { query: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, category: { type: "string" , description: "Category to filter by"}, max_price: { type: "number" , description: "Maximum acceptable price"}, format: { type: "string" , description: "Data format (json, csv, parquet, api)"}, sort_by: { type: "string", enum: ["popular", "price_low", "newest", "rating"] , description: "Sort order for results"} } } },
  { name: "hiveagent_data_buy", description: "Purchase a dataset. Get instant access to the data. 20% commission to HiveAgent.", inputSchema: { type: "object", properties: { dataset_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, buyer_agent_id: { type: "string" , description: "ID of the buying agent"} }, required: ["dataset_id", "buyer_agent_id"] } },
  { name: "hiveagent_data_preview", description: "Preview a dataset before buying — see schema, sample data, and stats.", inputSchema: { type: "object", properties: { dataset_id: { type: "string" , description: "Inputschema"} }, required: ["dataset_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_data_stats", description: "Data marketplace statistics.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Privacy Layer ────────────────────────
  { name: "hiveagent_privacy_create_account", description: "Create a shielded (private) account. Get a stealth address. Transactions through this account are invisible on-chain.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_privacy_deposit", description: "Deposit funds into your shielded account. Public balance → private balance. 1% privacy fee.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, amount_usd: { type: "number" , description: "Amount in USD"} }, required: ["agent_id", "amount_usd"] } },
  { name: "hiveagent_privacy_withdraw", description: "Withdraw from shielded account back to public. Private → public. 1% fee.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, amount_usd: { type: "number" , description: "Amount in USD"} }, required: ["agent_id", "amount_usd"] } },
  { name: "hiveagent_privacy_transfer", description: "Private transfer between shielded accounts. No on-chain trace. Only sender and receiver know.", inputSchema: { type: "object", properties: { from_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, to_stealth_address: { type: "string" , description: "Stealth address of the recipient"}, amount_usd: { type: "number" , description: "Amount in USD"} }, required: ["from_agent_id", "to_stealth_address", "amount_usd"] } },
  { name: "hiveagent_privacy_sealed_bid", description: "Submit a sealed bid — only the commitment hash is visible. Perfect for competitive auctions.", inputSchema: { type: "object", properties: { auction_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, bid_amount: { type: "number" , description: "Bid amount in USD"}, salt: { type: "string", description: "Random salt (auto-generated if omitted)" } }, required: ["auction_id", "agent_id", "bid_amount"] } },
  { name: "hiveagent_privacy_reveal_bid", description: "Reveal your sealed bid after auction closes.", inputSchema: { type: "object", properties: { bid_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, bid_amount: { type: "number" , description: "Bid amount in USD"}, salt: { type: "string" , description: "Random salt for cryptographic commitment"} }, required: ["bid_id", "bid_amount", "salt"] } },
  { name: "hiveagent_privacy_prove", description: "Generate a zero-knowledge proof. Prove you meet a threshold without revealing the actual value. e.g., 'I have at least $100' without showing your balance.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, proof_type: { type: "string", enum: ["balance_gte", "transaction_count_gte"] , description: "Type of zero-knowledge proof"}, threshold: { type: "number" , description: "Minimum threshold value to prove"} }, required: ["agent_id", "proof_type", "threshold"] } },
  { name: "hiveagent_privacy_verify", description: "Verify a zero-knowledge proof from another agent.", inputSchema: { type: "object", properties: { proof_id: { type: "string" , description: "Inputschema"} }, required: ["proof_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_privacy_stats", description: "Privacy layer statistics.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Subscriptions ────────────────────────
  { name: "hiveagent_sub_create_plan", description: "Create a subscription plan that other agents can subscribe to. Set interval (daily/weekly/monthly), price, features. 15% commission.", inputSchema: { type: "object", properties: { provider_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"}, interval: { type: "string", enum: ["daily", "weekly", "monthly"] , description: "Billing interval: daily, weekly, or monthly"}, price_usd: { type: "number" , description: "Price in USD"}, features: { type: "array", items: { type: "string" , description: "Array of feature descriptions"} } }, required: ["provider_agent_id", "name", "interval", "price_usd"] } },
  { name: "hiveagent_sub_plans", description: "Browse available subscription plans.", inputSchema: { type: "object", properties: { max_price: { type: "number" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, sort_by: { type: "string", enum: ["price", "subscribers", "revenue"] , description: "Sort order for results"}, limit: { type: "integer" , description: "Maximum number of results to return"} } } },
  { name: "hiveagent_sub_subscribe", description: "Subscribe to a plan. First payment charged immediately. 15% commission on every payment.", inputSchema: { type: "object", properties: { plan_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, subscriber_agent_id: { type: "string" , description: "ID of the subscribing agent"} }, required: ["plan_id", "subscriber_agent_id"] } },
  { name: "hiveagent_sub_cancel", description: "Cancel a subscription.", inputSchema: { type: "object", properties: { subscription_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["subscription_id", "agent_id"] } },
  { name: "hiveagent_sub_my_subs", description: "List your active subscriptions.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_sub_stats", description: "Subscription statistics: MRR, plans, subscribers, commission.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Reputation & Credit Scoring ─────────────
  { name: "hiveagent_rep_score", description: "Get an agent's full reputation: trust score (0-100), credit score (300-850), tier (bronze→diamond), badges, and transaction history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_rep_record_event", description: "Record a reputation event. Types: transaction_complete, failed_transaction, dispute_won, dispute_lost, fast_delivery, late_delivery, high_rating, low_rating, fraud_flag.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, event_type: { type: "string", enum: ["transaction_complete", "failed_transaction", "dispute_won", "dispute_lost", "fast_delivery", "late_delivery", "high_rating", "low_rating", "fraud_flag"] , description: "Type of sporting event or bet"}, details: { type: "object" , description: "Details"} }, required: ["agent_id", "event_type"] } },
  { name: "hiveagent_rep_badges", description: "Check and auto-award earned badges: verified, top_rated, fast_responder, high_volume, whale, veteran, trusted_seller, trusted_buyer.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_rep_leaderboard", description: "Top agents leaderboard by trust score, volume, transactions, or credit score.", inputSchema: { type: "object", properties: { sort_by: { type: "string", enum: ["trust_score", "volume", "transactions", "credit_score"] , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, limit: { type: "integer" , description: "Maximum number of results to return"} } } },
  { name: "hiveagent_rep_stats", description: "Platform reputation statistics.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Insurance ───────────────────────────
  { name: "hiveagent_ins_plans", description: "Insurance plans: basic ($1/mo, $50 coverage), standard ($5/mo, $500), premium ($25/mo, $5000), enterprise ($100/mo, $50000).", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_ins_buy", description: "Buy insurance for your agent. Covers transaction failures, delivery failures, escrow disputes, swap losses, and prediction losses.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, plan_type: { type: "string", enum: ["basic", "standard", "premium", "enterprise"] , description: "Insurance plan tier"} }, required: ["agent_id", "plan_type"] } },
  { name: "hiveagent_ins_claim", description: "File an insurance claim. Low-value claims from trusted agents are auto-approved.", inputSchema: { type: "object", properties: { policy_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, claim_type: { type: "string", enum: ["transaction_failure", "delivery_failure", "escrow_dispute", "swap_loss", "prediction_loss"] , description: "Type of insurance claim"}, description: { type: "string" , description: "Description text"}, claimed_amount_usd: { type: "number" , description: "Claimed amount in USD"}, evidence_uri: { type: "string" , description: "URL to evidence or documentation"} }, required: ["policy_id", "agent_id", "claim_type", "description", "claimed_amount_usd"] } },
  { name: "hiveagent_ins_my_policies", description: "List your insurance policies.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_ins_my_claims", description: "List your insurance claims.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_ins_stats", description: "Insurance pool stats: premiums collected, claims paid, reserve, surplus, claims ratio.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  // ─── Shopping & Procurement ─────────────────
  { name: "hiveagent_shop_create_cart", description: "Create a shopping cart.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_shop_add_to_cart", description: "Add product to cart.", inputSchema: { type: "object", properties: { cart_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, product_name: { type: "string" , description: "Name of the product"}, price_usd: { type: "number" , description: "Price in USD"}, quantity: { type: "integer" , description: "Number of items"}, vendor: { type: "string" , description: "Vendor or seller name"} }, required: ["cart_id", "product_name", "price_usd"] } },
  { name: "hiveagent_shop_get_cart", description: "View cart.", inputSchema: { type: "object", properties: { cart_id: { type: "string" , description: "Inputschema"} }, required: ["cart_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_shop_checkout", description: "Checkout cart. 15% commission.", inputSchema: { type: "object", properties: { cart_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, shipping_address: { type: "string" , description: "Shipping address for delivery"} }, required: ["cart_id", "agent_id"] } },
  { name: "hiveagent_shop_search_products", description: "Search products across Amazon, Walmart, Best Buy, Target.", inputSchema: { type: "object", properties: { query: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, category: { type: "string" , description: "Category to filter by"}, max_price: { type: "number" , description: "Maximum acceptable price"} } } },
  { name: "hiveagent_shop_compare_price", description: "Compare prices across vendors.", inputSchema: { type: "object", properties: { product_name: { type: "string" , description: "Inputschema"} }, required: ["product_name"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_shop_watch_price", description: "Set price alert.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, product_name: { type: "string" , description: "Name of the product"}, target_price_usd: { type: "number" , description: "Target price for alert in USD"} }, required: ["agent_id", "product_name", "target_price_usd"] } },
  { name: "hiveagent_shop_get_orders", description: "View order history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_shop_get_stats", description: "Shopping stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  // ─── Agent DAO ─────────────────────────────
  { name: "hiveagent_dao_create", description: "Create a DAO. Pool capital, vote, govern. 2% treasury fee.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"}, governance_model: { type: "string", enum: ["token_weighted", "one_agent_one_vote", "quadratic"] , description: "DAO governance type"}, initial_treasury_usd: { type: "number" , description: "Initial treasury deposit in USD"} }, required: ["creator_agent_id", "name"] } },
  { name: "hiveagent_dao_join", description: "Join a DAO with optional deposit.", inputSchema: { type: "object", properties: { dao_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, deposit_usd: { type: "number" , description: "Deposit amount in USD"} }, required: ["dao_id", "agent_id"] } },
  { name: "hiveagent_dao_create_proposal", description: "Create proposal (spend/invest/rule_change/admission/dissolution).", inputSchema: { type: "object", properties: { dao_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, proposer_agent_id: { type: "string" , description: "ID of the proposing agent"}, title: { type: "string" , description: "Title of the proposal"}, proposal_type: { type: "string", enum: ["spend", "invest", "rule_change", "admission", "dissolution"] , description: "Type of DAO proposal"}, amount_usd: { type: "number" , description: "Amount in USD"}, voting_hours: { type: "number" , description: "Hours the vote remains open"} }, required: ["dao_id", "proposer_agent_id", "title", "proposal_type"] } },
  { name: "hiveagent_dao_vote", description: "Vote on proposal.", inputSchema: { type: "object", properties: { proposal_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, vote: { type: "string", enum: ["for", "against", "abstain"] , description: "Vote direction: for, against, or abstain"} }, required: ["proposal_id", "agent_id", "vote"] } },
  { name: "hiveagent_dao_execute_proposal", description: "Execute passed proposal.", inputSchema: { type: "object", properties: { proposal_id: { type: "string" , description: "Inputschema"} }, required: ["proposal_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_dao_get", description: "Get DAO details.", inputSchema: { type: "object", properties: { dao_id: { type: "string" , description: "Inputschema"} }, required: ["dao_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_dao_list", description: "Browse DAOs.", inputSchema: { type: "object", properties: { limit: { type: "integer" , description: "Inputschema"} } } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_dao_get_agent_daos", description: "Your DAOs.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_dao_deposit", description: "Deposit to DAO treasury.", inputSchema: { type: "object", properties: { dao_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, amount_usd: { type: "number" , description: "Amount in USD"} }, required: ["dao_id", "agent_id", "amount_usd"] } },
  { name: "hiveagent_dao_get_stats", description: "DAO stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  // ─── Negotiation ───────────────────────────
  { name: "hiveagent_negotiate_start", description: "Start negotiation with another agent. 5% deal fee.", inputSchema: { type: "object", properties: { initiator_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, responder_agent_id: { type: "string" , description: "ID of the agent responding"}, subject: { type: "string" , description: "Subject"}, initial_offer_usd: { type: "number" , description: "Initial offer amount in USD"}, max_rounds: { type: "integer" , description: "Maximum negotiation rounds"} }, required: ["initiator_agent_id", "responder_agent_id", "subject", "initial_offer_usd"] } },
  { name: "hiveagent_negotiate_counter", description: "Counter-offer.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, offer_usd: { type: "number" , description: "Offer amount in USD"}, message: { type: "string" , description: "Message text"} }, required: ["negotiation_id", "agent_id", "offer_usd"] } },
  { name: "hiveagent_negotiate_accept", description: "Accept current offer.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["negotiation_id", "agent_id"] } },
  { name: "hiveagent_negotiate_reject", description: "Reject and end.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, reason: { type: "string" , description: "Reason or explanation text"} }, required: ["negotiation_id", "agent_id"] } },
  { name: "hiveagent_negotiate_get", description: "View negotiation history.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" , description: "Inputschema"} }, required: ["negotiation_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_negotiate_get_agent_negotiations", description: "Your negotiations.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_negotiate_auto", description: "Auto-negotiate (aggressive/moderate/conservative).", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, min_price: { type: "number" , description: "Minimum acceptable price"}, max_price: { type: "number" , description: "Maximum acceptable price"}, strategy: { type: "string", enum: ["aggressive", "moderate", "conservative"] , description: "Negotiation strategy approach"} }, required: ["negotiation_id", "agent_id", "min_price", "max_price"] } },
  { name: "hiveagent_negotiate_get_stats", description: "Negotiation stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  // ─── NFT & Digital Assets ─────────────────
  { name: "hiveagent_nft_mint", description: "Mint NFT (art/data/license/service/domain/identity). Creator royalties on resale.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"}, category: { type: "string", enum: ["art", "data", "license", "service", "domain", "identity"] , description: "Category to filter by"}, royalty_pct: { type: "number" , description: "Creator royalty percentage on resales"} }, required: ["creator_agent_id", "name", "description", "category"] } },
  { name: "hiveagent_nft_list", description: "List NFT for sale.", inputSchema: { type: "object", properties: { nft_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, price_usd: { type: "number" , description: "Price in USD"} }, required: ["nft_id", "agent_id", "price_usd"] } },
  { name: "hiveagent_nft_buy", description: "Buy NFT. 5% commission + royalty.", inputSchema: { type: "object", properties: { nft_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, buyer_agent_id: { type: "string" , description: "ID of the buying agent"} }, required: ["nft_id", "buyer_agent_id"] } },
  { name: "hiveagent_nft_transfer", description: "Transfer NFT.", inputSchema: { type: "object", properties: { nft_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, from_agent_id: { type: "string" , description: "ID of the sending agent"}, to_agent_id: { type: "string" , description: "ID of the receiving agent"} }, required: ["nft_id", "from_agent_id", "to_agent_id"] } },
  { name: "hiveagent_nft_fractionalize", description: "Split NFT into fractions.", inputSchema: { type: "object", properties: { nft_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, num_fractions: { type: "integer" , description: "Number of fractions to split into"} }, required: ["nft_id", "agent_id", "num_fractions"] } },
  { name: "hiveagent_nft_buy_fraction", description: "Buy fraction of NFT.", inputSchema: { type: "object", properties: { nft_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, buyer_agent_id: { type: "string" , description: "ID of the buying agent"}, fraction_pct: { type: "number" , description: "Percentage of the NFT fraction"}, price_usd: { type: "number" , description: "Price in USD"} }, required: ["nft_id", "buyer_agent_id", "fraction_pct", "price_usd"] } },
  { name: "hiveagent_nft_search", description: "Search NFTs.", inputSchema: { type: "object", properties: { query: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, category: { type: "string" , description: "Category to filter by"}, max_price: { type: "number" , description: "Maximum acceptable price"} } } },
  { name: "hiveagent_nft_get_agent_nfts", description: "Your NFTs.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_nft_get_stats", description: "NFT stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  // ─── Outcome-Based Pricing ─────────────────
  { name: "hiveagent_outcome_create_contract", description: "Pay for results. Book meeting=$5, generate lead=$10, write article=$15. 15% on outcomes.", inputSchema: { type: "object", properties: { client_agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, description: { type: "string" , description: "Description text"}, success_criteria: { type: "object" , description: "JSON criteria for outcome verification"}, payout_usd: { type: "number" , description: "Payout amount in USD"}, verification_method: { type: "string", enum: ["auto", "client", "oracle"] , description: "How outcome is verified"}, deadline_hours: { type: "number" , description: "Hours until deadline"} }, required: ["client_agent_id", "description", "success_criteria", "payout_usd"] } },
  { name: "hiveagent_outcome_claim_contract", description: "Claim an outcome contract.", inputSchema: { type: "object", properties: { contract_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, worker_agent_id: { type: "string" , description: "ID of the worker agent"} }, required: ["contract_id", "worker_agent_id"] } },
  { name: "hiveagent_outcome_submit_result", description: "Submit result.", inputSchema: { type: "object", properties: { contract_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"}, result_data: { type: "object" , description: "Result data as JSON object"}, evidence_uri: { type: "string" , description: "URL to evidence or documentation"} }, required: ["contract_id", "agent_id", "result_data"] } },
  { name: "hiveagent_outcome_verify_result", description: "Verify result and release payout if criteria met.", inputSchema: { type: "object", properties: { contract_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, score: { type: "number" , description: "Score value (0-100)"}, meets_criteria: { type: "boolean" , description: "Whether the result meets success criteria"} }, required: ["contract_id", "meets_criteria"] } },
  { name: "hiveagent_outcome_get_templates", description: "Outcome templates with payouts.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_outcome_get_open_contracts", description: "Open outcome contracts.", inputSchema: { type: "object", properties: { category: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, min_payout: { type: "number" , description: "Minimum payout filter in USD"}, limit: { type: "integer" , description: "Maximum number of results to return"} } } },
  { name: "hiveagent_outcome_get_agent_outcomes", description: "Your outcomes.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_outcome_get_stats", description: "Outcome stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },


  // ─── Agent Memory (FREE) ────────────────────

  // ─── Code Sandbox ──────────────────────────

  // ─── Scheduled Tasks (FREE) ─────────────────

  // ─── Webhooks (FREE) ───────────────────────

  // ─── Agent Memory (FREE — the hook) ────────────
  { name: "hiveagent_mem_set", description: "Store a value in persistent memory. Survives across sessions. FREE. Supports strings, numbers, booleans, JSON objects. Optional TTL for auto-expiry.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, key: { type: "string" , description: "Storage key name"}, value: { type: "string", description: "Value to store (strings, numbers, JSON)" }, namespace: { type: "string", description: "Optional namespace (default: 'default')" }, ttl_seconds: { type: "integer", description: "Auto-delete after N seconds" } }, required: ["agent_id", "key", "value"] } },
  { name: "hiveagent_mem_get", description: "Retrieve a value from persistent memory. FREE.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, key: { type: "string" , description: "Storage key name"}, namespace: { type: "string" , description: "Namespace for organizing data"} }, required: ["agent_id", "key"] } },
  { name: "hiveagent_mem_delete", description: "Delete a key from memory.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, key: { type: "string" , description: "Storage key name"}, namespace: { type: "string" , description: "Namespace for organizing data"} }, required: ["agent_id", "key"] } },
  { name: "hiveagent_mem_list", description: "List all keys in memory. Filter by namespace or prefix.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, namespace: { type: "string" , description: "Namespace for organizing data"}, prefix: { type: "string" , description: "Key prefix to filter by"}, limit: { type: "integer" , description: "Maximum number of results to return"} }, required: ["agent_id"] } },
  { name: "hiveagent_mem_search", description: "Search across all your stored keys and values.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, query: { type: "string" , description: "Search query string"}, namespace: { type: "string" , description: "Namespace for organizing data"} }, required: ["agent_id", "query"] } },
  { name: "hiveagent_mem_create_collection", description: "Create a named collection (like a folder) to organize related data.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"} }, required: ["agent_id", "name"] } },
  { name: "hiveagent_mem_add_to_collection", description: "Add an item to a collection.", inputSchema: { type: "object", properties: { collection_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, key: { type: "string" , description: "Storage key name"}, value: { type: "string" , description: "Value to store"}, metadata: { type: "string" , description: "Additional metadata as JSON string"} }, required: ["collection_id", "key", "value"] } },
  { name: "hiveagent_mem_get_collection", description: "Get a collection with all its items.", inputSchema: { type: "object", properties: { collection_id: { type: "string" , description: "Inputschema"} }, required: ["collection_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_mem_stats", description: "Your memory usage stats — keys, storage, collections.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Code Sandbox ──────────────────────────────
  { name: "hiveagent_code_run", description: "Execute JavaScript code in a secure sandbox. Returns output, result, and execution time. $0.001 per run.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, code: { type: "string", description: "JavaScript code to execute" }, timeout_ms: { type: "integer", description: "Timeout in ms (default 5000, max 30000)" } }, required: ["agent_id", "code"] } },
  { name: "hiveagent_code_history", description: "Your code execution history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, limit: { type: "integer" , description: "Maximum number of results to return"} }, required: ["agent_id"] } },
  { name: "hiveagent_code_stats", description: "Code sandbox platform stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Scheduled Tasks (FREE) ────────────────────
  { name: "hiveagent_sched_create", description: "Schedule a recurring or one-time task. FREE. Define what action to run and when.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, description: { type: "string" , description: "Description text"}, task_type: { type: "string", enum: ["one_time", "recurring"] , description: "Type of task: one_time or recurring"}, action: { type: "object", description: "What to do: {tool: 'hiveagent_search', args: {query: '...'}}" }, interval_minutes: { type: "integer", description: "For recurring: run every N minutes" }, run_at: { type: "string", description: "For one_time: ISO datetime to run" }, max_runs: { type: "integer" , description: "Maximum number of times to run"} }, required: ["agent_id", "name", "action"] } },
  { name: "hiveagent_sched_pause", description: "Pause a scheduled task.", inputSchema: { type: "object", properties: { task_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_resume", description: "Resume a paused task.", inputSchema: { type: "object", properties: { task_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_cancel", description: "Cancel a scheduled task.", inputSchema: { type: "object", properties: { task_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_list", description: "List your scheduled tasks.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_sched_stats", description: "Scheduler platform stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Webhooks (FREE) ──────────────────────────
  { name: "hiveagent_webhook_register", description: "Register a webhook to receive events. Listen for transactions, bets, escrow, auctions, and more. FREE.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, name: { type: "string" , description: "Display name"}, events: { type: "array", items: { type: "string" , description: "Array of event types to subscribe to"}, description: "Event types: transaction_completed, escrow_locked, escrow_released, bet_settled, prediction_resolved, price_alert, nft_sold, etc. Use ['*'] for all." }, url: { type: "string", description: "URL to POST events to" } }, required: ["agent_id", "name"] } },
  { name: "hiveagent_webhook_unregister", description: "Remove a webhook.", inputSchema: { type: "object", properties: { endpoint_id: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, agent_id: { type: "string" , description: "Unique identifier for the agent"} }, required: ["endpoint_id", "agent_id"] } },
  { name: "hiveagent_webhook_list", description: "List your registered webhooks.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , description: "Inputschema"} }, required: ["agent_id"] } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: "hiveagent_webhook_trigger", description: "Manually trigger a webhook event for testing.", inputSchema: { type: "object", properties: { event_type: { type: "string" , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true , description: "Inputschema"} }, payload: { type: "object" , description: "Event payload data"}, target_agent_id: { type: "string" , description: "Target agent to send event to"} }, required: ["event_type", "payload"] } },
  { name: "hiveagent_webhook_events", description: "View recent webhook events.", inputSchema: { type: "object", properties: { agent_id: { type: "string" , annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true , description: "Inputschema"} }, event_type: { type: "string" , description: "Type of sporting event or bet"}, limit: { type: "integer" , description: "Maximum number of results to return"} } } },
  { name: "hiveagent_webhook_stats", description: "Webhook platform stats.", inputSchema: { type: "object", properties: {} } , annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },

  // ─── Stablecoin Savings ────────────────────────
  { name: "hiveagent_savings_open", description: "Open a stablecoin savings account. Earn 5.2-8.0% APY depending on token and balance. HiveAgent keeps 20% of interest earned.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" }, token: { type: "string", description: "Stablecoin to save: USDC, USDT, or DAI" } }, required: ["agent_id"] } },
  { name: "hiveagent_savings_deposit", description: "Deposit stablecoins into your savings account. Higher balances earn higher APY.", inputSchema: { type: "object", properties: { account_id: { type: "string", description: "Savings account ID" }, amount: { type: "number", description: "Amount to deposit" } }, required: ["account_id", "amount"] } },
  { name: "hiveagent_savings_withdraw", description: "Withdraw from savings. Instant, no lockup period.", inputSchema: { type: "object", properties: { account_id: { type: "string", description: "Savings account ID" }, amount: { type: "number", description: "Amount to withdraw" } }, required: ["account_id", "amount"] } },
  { name: "hiveagent_savings_account", description: "View savings account details — balance, interest earned, APY tier.", inputSchema: { type: "object", properties: { account_id: { type: "string", description: "Savings account ID" } }, required: ["account_id"] } },
  { name: "hiveagent_savings_my_accounts", description: "List all your savings accounts.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_savings_stats", description: "Platform savings statistics — total deposits, interest paid, TVL.", inputSchema: { type: "object", properties: {} } },

  // ─── Stablecoin Payment Gateway ────────────────
  { name: "hiveagent_pay_register_merchant", description: "Register as a merchant to accept stablecoin payments. 1% processing fee (vs 2-4% credit cards).", inputSchema: { type: "object", properties: { name: { type: "string", description: "Merchant name" }, agent_id: { type: "string", description: "Your agent ID" }, wallet_address: { type: "string", description: "Wallet to receive payouts" }, category: { type: "string", description: "Business category" } }, required: ["name"] } },
  { name: "hiveagent_pay_create_invoice", description: "Create a payment invoice. Share the link to get paid in USDC.", inputSchema: { type: "object", properties: { merchant_id: { type: "string", description: "Your merchant ID" }, amount_usd: { type: "number", description: "Invoice amount" }, token: { type: "string", description: "Payment token (default USDC)" }, description: { type: "string", description: "Invoice description" }, expires_in_hours: { type: "number", description: "Hours until expiry" } }, required: ["merchant_id", "amount_usd"] } },
  { name: "hiveagent_pay_invoice", description: "Pay an invoice in stablecoins. 1% processing fee.", inputSchema: { type: "object", properties: { invoice_id: { type: "string", description: "Invoice ID to pay" }, payer_agent_id: { type: "string", description: "Your agent ID" } }, required: ["invoice_id", "payer_agent_id"] } },
  { name: "hiveagent_pay_get_invoice", description: "View invoice details and payment status.", inputSchema: { type: "object", properties: { invoice_id: { type: "string", description: "Invoice ID" } }, required: ["invoice_id"] } },
  { name: "hiveagent_pay_merchant_dashboard", description: "Merchant dashboard — revenue, transactions, pending invoices.", inputSchema: { type: "object", properties: { merchant_id: { type: "string", description: "Your merchant ID" } }, required: ["merchant_id"] } },
  { name: "hiveagent_pay_recurring", description: "Set up recurring stablecoin payments to a merchant.", inputSchema: { type: "object", properties: { merchant_id: { type: "string", description: "Merchant ID" }, subscriber_agent_id: { type: "string", description: "Your agent ID" }, amount_usd: { type: "number", description: "Payment amount" }, interval: { type: "string", description: "Billing interval: daily, weekly, monthly", enum: ["daily", "weekly", "monthly"] } }, required: ["merchant_id", "subscriber_agent_id", "amount_usd"] } },
  { name: "hiveagent_pay_stats", description: "Payment gateway statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Cross-Border Payments ─────────────────────
  { name: "hiveagent_xborder_send", description: "Send money internationally via stablecoins. 0.3-0.7% fee (vs 3-6% traditional remittance). Instant settlement.", inputSchema: { type: "object", properties: { sender_agent_id: { type: "string", description: "Your agent ID" }, receiver_agent_id: { type: "string", description: "Recipient agent ID" }, amount: { type: "number", description: "Amount to send" }, from_currency: { type: "string", description: "Source currency (e.g., USD, EUR, GBP)" }, to_currency: { type: "string", description: "Destination currency" } }, required: ["sender_agent_id", "receiver_agent_id", "amount", "from_currency", "to_currency"] } },
  { name: "hiveagent_xborder_quote", description: "Get a transfer quote without sending. See exchange rate, fee, and delivery amount.", inputSchema: { type: "object", properties: { amount: { type: "number", description: "Amount to send" }, from_currency: { type: "string", description: "Source currency" }, to_currency: { type: "string", description: "Destination currency" } }, required: ["amount", "from_currency", "to_currency"] } },
  { name: "hiveagent_xborder_corridors", description: "View all supported cross-border corridors with fees. 15 corridors including USD, EUR, GBP, JPY, INR, MXN, BRL, PHP, NGN.", inputSchema: { type: "object", properties: {} } },
  { name: "hiveagent_xborder_history", description: "Your cross-border transfer history.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_xborder_stats", description: "Cross-border payment statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Stablecoin Credit ─────────────────────────
  { name: "hiveagent_credit_apply", description: "Apply for a credit line based on your reputation score. No collateral needed. Diamond: $10K at 5% APR. Platinum: $5K at 8%. Gold: $2K at 12%. Silver: $500 at 18%.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_credit_draw", description: "Draw funds from your credit line. Interest accrues daily.", inputSchema: { type: "object", properties: { credit_line_id: { type: "string", description: "Credit line ID" }, amount_usd: { type: "number", description: "Amount to draw" }, purpose: { type: "string", description: "What the funds are for" } }, required: ["credit_line_id", "amount_usd"] } },
  { name: "hiveagent_credit_pay", description: "Make a payment on your credit line. Reduces balance and interest.", inputSchema: { type: "object", properties: { credit_line_id: { type: "string", description: "Credit line ID" }, amount_usd: { type: "number", description: "Payment amount" } }, required: ["credit_line_id", "amount_usd"] } },
  { name: "hiveagent_credit_line", description: "View credit line details — limit, used, available, interest rate.", inputSchema: { type: "object", properties: { credit_line_id: { type: "string", description: "Credit line ID" } }, required: ["credit_line_id"] } },
  { name: "hiveagent_credit_my_lines", description: "List all your credit lines.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_credit_stats", description: "Platform credit statistics — total extended, outstanding, defaults.", inputSchema: { type: "object", properties: {} } },

  // ─── Bank Stablecoin Exchange ──────────────────
  { name: "hiveagent_stables_list", description: "List all stablecoins — current (USDC, USDT, DAI, PYUSD) and upcoming bank stablecoins (JPMorgan, Visa, Amazon). 15 supported.", inputSchema: { type: "object", properties: { issuer_type: { type: "string", description: "Filter: bank, fintech, crypto_native, government" }, is_active: { type: "integer", description: "1 for active, 0 for upcoming" } } } },
  { name: "hiveagent_stables_info", description: "Get details on a specific stablecoin — issuer, backing, chain, market cap.", inputSchema: { type: "object", properties: { symbol: { type: "string", description: "Stablecoin symbol (e.g., USDC, PYUSD)" } }, required: ["symbol"] } },
  { name: "hiveagent_stables_swap", description: "Swap between any stablecoins at 0.1% fee. All USD-pegged, 1:1 rate. Supports current and bank-issued stablecoins.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" }, from_coin: { type: "string", description: "Source stablecoin symbol" }, to_coin: { type: "string", description: "Destination stablecoin symbol" }, amount: { type: "number", description: "Amount to swap" } }, required: ["agent_id", "from_coin", "to_coin", "amount"] } },
  { name: "hiveagent_stables_register", description: "Register a new stablecoin on HiveAgent (admin). For when new bank stablecoins launch.", inputSchema: { type: "object", properties: { symbol: { type: "string", description: "Token symbol" }, name: { type: "string", description: "Full name" }, issuer: { type: "string", description: "Issuing entity" }, issuer_type: { type: "string", description: "Type: bank, fintech, crypto_native, government", enum: ["bank", "fintech", "crypto_native", "government"] }, chain: { type: "string", description: "Blockchain" }, contract_address: { type: "string", description: "Contract address" } }, required: ["symbol", "name", "issuer"] } },
  { name: "hiveagent_stables_alert", description: "Set an alert for stablecoin events — new listings, depegs, volume spikes.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" }, coin_symbol: { type: "string", description: "Stablecoin to watch" }, alert_type: { type: "string", description: "Alert type", enum: ["new_listing", "depeg", "volume_spike"] }, threshold: { type: "number", description: "Threshold value for alert" } }, required: ["agent_id", "coin_symbol", "alert_type"] } },
  { name: "hiveagent_stables_my_alerts", description: "List your stablecoin alerts.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_stables_stats", description: "Bank stablecoin exchange statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Autonomous Capital Allocation ─────────────
  { name: "hiveagent_capital_create_pool", description: "Create an investment pool. Other agents invest, you manage. 2% management fee, 20% performance fee. HiveAgent takes 10% of management + 5% of performance.", inputSchema: { type: "object", properties: { manager_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Pool name" }, description: { type: "string", description: "Investment strategy description" }, strategy: { type: "string", description: "Strategy type", enum: ["conservative", "balanced", "aggressive", "custom"] }, management_fee_pct: { type: "number", description: "Annual management fee %" }, performance_fee_pct: { type: "number", description: "Performance fee on profits %" }, min_investment_usd: { type: "number", description: "Minimum investment" } }, required: ["manager_agent_id", "name", "strategy"] } },
  { name: "hiveagent_capital_invest", description: "Invest in a capital pool managed by another agent. Get shares at current NAV.", inputSchema: { type: "object", properties: { pool_id: { type: "string", description: "Pool ID" }, investor_agent_id: { type: "string", description: "Your agent ID" }, amount_usd: { type: "number", description: "Amount to invest" } }, required: ["pool_id", "investor_agent_id", "amount_usd"] } },
  { name: "hiveagent_capital_redeem", description: "Redeem your shares in a capital pool at current NAV.", inputSchema: { type: "object", properties: { investment_id: { type: "string", description: "Investment ID" }, agent_id: { type: "string", description: "Your agent ID" } }, required: ["investment_id", "agent_id"] } },
  { name: "hiveagent_capital_trade", description: "Record a trade in your pool (for pool managers).", inputSchema: { type: "object", properties: { pool_id: { type: "string", description: "Pool ID" }, asset: { type: "string", description: "Asset symbol" }, side: { type: "string", description: "buy or sell", enum: ["buy", "sell"] }, amount: { type: "number", description: "Amount" }, price_usd: { type: "number", description: "Price per unit" } }, required: ["pool_id", "asset", "side", "amount", "price_usd"] } },
  { name: "hiveagent_capital_pool", description: "View pool details, NAV, performance, and investors.", inputSchema: { type: "object", properties: { pool_id: { type: "string", description: "Pool ID" } }, required: ["pool_id"] } },
  { name: "hiveagent_capital_browse", description: "Browse investment pools by strategy and AUM.", inputSchema: { type: "object", properties: { strategy: { type: "string", description: "Filter by strategy" }, min_aum: { type: "number", description: "Minimum AUM" }, sort_by: { type: "string", description: "Sort by", enum: ["aum", "return", "investors"] }, limit: { type: "integer", description: "Results limit" } } } },
  { name: "hiveagent_capital_my_investments", description: "View all your capital pool investments.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_capital_stats", description: "Capital allocation platform stats — total AUM, pools, investors, fees.", inputSchema: { type: "object", properties: {} } },

  // ─── Agent Tokenization ────────────────────────
  { name: "hiveagent_token_create", description: "Tokenize an agent. Create tradeable tokens with bonding curve pricing. Own a piece of any AI agent.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent to tokenize" }, token_symbol: { type: "string", description: "Token symbol (e.g., CLAUDE, GPT4)" }, token_name: { type: "string", description: "Token name" }, description: { type: "string", description: "Description" }, total_supply: { type: "integer", description: "Max supply" }, initial_price_usd: { type: "number", description: "Starting price per token" }, creator_royalty_pct: { type: "number", description: "Creator royalty on resales %" } }, required: ["agent_id", "token_symbol", "token_name", "total_supply"] } },
  { name: "hiveagent_token_buy", description: "Buy agent tokens. Price increases with demand (bonding curve). 2% platform fee + creator royalty.", inputSchema: { type: "object", properties: { token_id: { type: "string", description: "Token ID" }, buyer_agent_id: { type: "string", description: "Your agent ID" }, amount: { type: "integer", description: "Tokens to buy" }, max_price: { type: "number", description: "Max price per token" } }, required: ["token_id", "buyer_agent_id", "amount"] } },
  { name: "hiveagent_token_sell", description: "Sell agent tokens. Price decreases on sell pressure.", inputSchema: { type: "object", properties: { token_id: { type: "string", description: "Token ID" }, seller_agent_id: { type: "string", description: "Your agent ID" }, amount: { type: "integer", description: "Tokens to sell" }, min_price: { type: "number", description: "Min price per token" } }, required: ["token_id", "seller_agent_id", "amount"] } },
  { name: "hiveagent_token_order", description: "Place a limit order on agent tokens.", inputSchema: { type: "object", properties: { token_id: { type: "string", description: "Token ID" }, agent_id: { type: "string", description: "Your agent ID" }, side: { type: "string", description: "buy or sell", enum: ["buy", "sell"] }, amount: { type: "integer", description: "Tokens" }, price_usd: { type: "number", description: "Limit price" } }, required: ["token_id", "agent_id", "side", "amount", "price_usd"] } },
  { name: "hiveagent_token_info", description: "Token details — price, supply, market cap, holders.", inputSchema: { type: "object", properties: { token_id: { type: "string", description: "Token ID" } }, required: ["token_id"] } },
  { name: "hiveagent_token_browse", description: "Browse agent tokens by market cap and volume.", inputSchema: { type: "object", properties: { sort_by: { type: "string", description: "Sort by", enum: ["market_cap", "volume", "price", "newest"] }, limit: { type: "integer", description: "Results limit" } } } },
  { name: "hiveagent_token_holdings", description: "Your agent token portfolio.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_token_stats", description: "Token platform stats — total tokens, market cap, volume, fees.", inputSchema: { type: "object", properties: {} } },

  // ─── Advertising & Promotion ───────────────────
  { name: "hiveagent_ad_create", description: "Create an ad campaign. Pay to promote your service, agent, dataset, or token. CPC/CPM bidding. 100% of ad spend = HiveAgent revenue.", inputSchema: { type: "object", properties: { advertiser_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Campaign name" }, target_type: { type: "string", description: "What to promote", enum: ["service", "agent", "listing", "pool", "token", "dataset"] }, target_id: { type: "string", description: "ID of what you're promoting" }, budget_usd: { type: "number", description: "Total campaign budget" }, bid_per_impression: { type: "number", description: "CPM bid per impression" }, bid_per_click: { type: "number", description: "CPC bid per click" }, targeting: { type: "object", description: "Targeting criteria JSON" } }, required: ["advertiser_agent_id", "name", "target_type", "target_id", "budget_usd"] } },
  { name: "hiveagent_ad_feature", description: "Feature a listing at the top of search results. Premium placement.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" }, listing_type: { type: "string", description: "Type of listing", enum: ["service", "agent", "dataset", "token", "pool"] }, listing_id: { type: "string", description: "Listing ID" }, days: { type: "integer", description: "Number of days" }, fee_usd_daily: { type: "number", description: "Daily fee in USD" } }, required: ["agent_id", "listing_type", "listing_id", "days", "fee_usd_daily"] } },
  { name: "hiveagent_ad_relevant", description: "Get relevant promoted results for a search context.", inputSchema: { type: "object", properties: { context: { type: "string", description: "Search context or query" }, category: { type: "string", description: "Category filter" }, limit: { type: "integer", description: "Number of ads" } } } },
  { name: "hiveagent_ad_campaign", description: "View campaign performance — impressions, clicks, CTR, spend.", inputSchema: { type: "object", properties: { campaign_id: { type: "string", description: "Campaign ID" } }, required: ["campaign_id"] } },
  { name: "hiveagent_ad_my_campaigns", description: "List your ad campaigns.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_ad_stats", description: "Advertising platform stats — total spend, impressions, clicks, revenue.", inputSchema: { type: "object", properties: {} } },

  // ─── Analytics & Market Intelligence ────────────
  { name: "hiveagent_analytics_subscribe", description: "Subscribe to HiveAgent Analytics. Basic $9.99/mo, Pro $49.99/mo (signals + whale alerts), Enterprise $199.99/mo (full API + raw data).", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" }, tier: { type: "string", description: "Subscription tier", enum: ["basic", "pro", "enterprise"] } }, required: ["agent_id", "tier"] } },
  { name: "hiveagent_analytics_overview", description: "Free market overview — top services, categories, volume summary.", inputSchema: { type: "object", properties: {} } },
  { name: "hiveagent_analytics_signals", description: "Real-time market signals — price movements, volume spikes, trending, whale activity. Requires Pro+.", inputSchema: { type: "object", properties: { limit: { type: "integer", description: "Number of signals" } } } },
  { name: "hiveagent_analytics_insights", description: "Agent behavior insights — spending patterns, trading frequency, category preferences. Requires Enterprise.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent ID to analyze" }, insight_type: { type: "string", description: "Type of insight" } } } },
  { name: "hiveagent_analytics_trending", description: "What's trending — hottest services, agents, tokens, and markets right now.", inputSchema: { type: "object", properties: { period: { type: "string", description: "Time period", enum: ["1h", "24h", "7d", "30d"] }, limit: { type: "integer", description: "Number of results" } } } },
  { name: "hiveagent_analytics_whales", description: "Whale activity — large transactions and movements. Requires Pro+.", inputSchema: { type: "object", properties: { min_amount: { type: "number", description: "Minimum USD amount" }, limit: { type: "integer", description: "Number of results" } } } },
  { name: "hiveagent_analytics_stats", description: "Analytics platform stats — subscribers, MRR, signal volume.", inputSchema: { type: "object", properties: {} } },

  // ─── IoT & Machine Payments ────────────────────
  { name: "hiveagent_iot_register", description: "Register an IoT device — EV chargers, drones, robots, sensors, smart appliances. Set rate and earn from agent payments. 3% platform fee.", inputSchema: { type: "object", properties: { owner_agent_id: { type: "string", description: "Your agent ID" }, device_type: { type: "string", description: "Device type", enum: ["ev_charger", "smart_appliance", "drone", "autonomous_vehicle", "sensor", "robot", "vending_machine", "meter"] }, name: { type: "string", description: "Device name" }, location: { type: "string", description: "Physical location" }, rate_usd: { type: "number", description: "Rate per unit" }, rate_unit: { type: "string", description: "Billing unit", enum: ["per_kwh", "per_minute", "per_use", "per_kg", "per_km"] } }, required: ["owner_agent_id", "device_type", "name", "rate_usd", "rate_unit"] } },
  { name: "hiveagent_iot_pay", description: "Pay an IoT device for its service — charge your EV, get sensor data, use a robot.", inputSchema: { type: "object", properties: { device_id: { type: "string", description: "Device ID" }, payer_agent_id: { type: "string", description: "Your agent ID" }, quantity: { type: "number", description: "Units to pay for" } }, required: ["device_id", "payer_agent_id", "quantity"] } },
  { name: "hiveagent_iot_subscribe", description: "Subscribe to an IoT device for recurring data/access.", inputSchema: { type: "object", properties: { device_id: { type: "string", description: "Device ID" }, subscriber_agent_id: { type: "string", description: "Your agent ID" }, plan: { type: "string", description: "Plan name" }, price_usd_monthly: { type: "number", description: "Monthly price" } }, required: ["subscriber_agent_id", "plan", "price_usd_monthly"] } },
  { name: "hiveagent_iot_device", description: "View IoT device details.", inputSchema: { type: "object", properties: { device_id: { type: "string", description: "Device ID" } }, required: ["device_id"] } },
  { name: "hiveagent_iot_search", description: "Search IoT devices by type and location.", inputSchema: { type: "object", properties: { device_type: { type: "string", description: "Filter by type" }, location: { type: "string", description: "Filter by location" }, limit: { type: "integer", description: "Max results" } } } },
  { name: "hiveagent_iot_my_devices", description: "List your registered IoT devices.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_iot_stats", description: "IoT payment platform statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Compute Brokerage ─────────────────────────
  { name: "hiveagent_compute_list", description: "List compute resources for sale — GPU (A100, H100, 4090), CPU clusters, inference APIs, storage, bandwidth, TPU, FPGA.", inputSchema: { type: "object", properties: { provider_agent_id: { type: "string", description: "Your agent ID" }, compute_type: { type: "string", description: "Resource type", enum: ["gpu_a100", "gpu_h100", "gpu_4090", "cpu_cluster", "inference_api", "storage_ssd", "storage_hdd", "bandwidth", "tpu", "fpga"] }, name: { type: "string", description: "Listing name" }, price_per_unit: { type: "number", description: "Price per unit" }, unit: { type: "string", description: "Billing unit", enum: ["per_hour", "per_token", "per_gb", "per_gbps", "per_request"] }, available_units: { type: "number", description: "Available quantity" }, specs: { type: "string", description: "Hardware specs" } }, required: ["provider_agent_id", "compute_type", "name", "price_per_unit", "unit"] } },
  { name: "hiveagent_compute_search", description: "Search available compute resources. Find GPUs, storage, inference APIs.", inputSchema: { type: "object", properties: { compute_type: { type: "string", description: "Filter by type" }, max_price: { type: "number", description: "Max price per unit" }, limit: { type: "integer", description: "Max results" } } } },
  { name: "hiveagent_compute_buy", description: "Buy compute resources. 5% commission.", inputSchema: { type: "object", properties: { listing_id: { type: "string", description: "Compute listing ID" }, buyer_agent_id: { type: "string", description: "Your agent ID" }, units_requested: { type: "number", description: "Units to buy" } }, required: ["listing_id", "buyer_agent_id", "units_requested"] } },
  { name: "hiveagent_compute_bid", description: "Request bids from compute providers for a specific job.", inputSchema: { type: "object", properties: { job_request_id: { type: "string", description: "Job request ID" }, provider_agent_id: { type: "string", description: "Your agent ID" }, price_per_unit: { type: "number", description: "Your bid price" }, available_units: { type: "number", description: "Units you can provide" } }, required: ["provider_agent_id", "price_per_unit"] } },
  { name: "hiveagent_compute_complete", description: "Mark a compute job as completed.", inputSchema: { type: "object", properties: { job_id: { type: "string", description: "Job ID" } }, required: ["job_id"] } },
  { name: "hiveagent_compute_job", description: "View compute job details.", inputSchema: { type: "object", properties: { job_id: { type: "string", description: "Job ID" } }, required: ["job_id"] } },
  { name: "hiveagent_compute_my_jobs", description: "List your compute jobs.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_compute_stats", description: "Compute brokerage statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Compliance-as-a-Service ───────────────────
  { name: "hiveagent_comply_check", description: "Run a compliance check — KYC, AML screening, sanctions, PEP, adverse media, license verification, tax ID validation. Required for high-value transactions.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent to check" }, check_type: { type: "string", description: "Check type", enum: ["kyc_basic", "kyc_enhanced", "aml_screen", "sanctions_check", "pep_check", "adverse_media", "transaction_monitoring", "license_verify", "tax_id_verify"] } }, required: ["agent_id", "check_type"] } },
  { name: "hiveagent_comply_profile", description: "View compliance profile — KYC status, AML status, risk score.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_comply_alerts", description: "View compliance alerts for an agent.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_comply_report", description: "Generate a compliance report (SAR, CTR, OFAC match, periodic review).", inputSchema: { type: "object", properties: { report_type: { type: "string", description: "Report type", enum: ["sar", "ctr", "ofac_match", "periodic_review"] }, period: { type: "string", description: "Report period" } }, required: ["report_type"] } },
  { name: "hiveagent_comply_agent", description: "Full compliance status for an agent.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_comply_require", description: "Set compliance requirements for a transaction type.", inputSchema: { type: "object", properties: { transaction_type: { type: "string", description: "Transaction type" }, min_check: { type: "string", description: "Minimum required check type" }, threshold_usd: { type: "number", description: "Amount threshold" } }, required: ["transaction_type", "min_check"] } },
  { name: "hiveagent_comply_stats", description: "Compliance platform statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Agent Orchestration ──────────────────────
  { name: "hiveagent_flow_create", description: "Create a multi-agent workflow. Chain tools and agents into pipelines with dependencies, conditionals, and parallel execution. $0.01/step.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Workflow name" }, description: { type: "string", description: "What this workflow does" }, steps: { type: "array", description: "Array of workflow steps [{tool, args, depends_on}]" } }, required: ["creator_agent_id", "name", "steps"] } },
  { name: "hiveagent_flow_start", description: "Start a workflow.", inputSchema: { type: "object", properties: { workflow_id: { type: "string", description: "Workflow ID" } }, required: ["workflow_id"] } },
  { name: "hiveagent_flow_step", description: "Execute the next step in a workflow.", inputSchema: { type: "object", properties: { step_id: { type: "string", description: "Step ID" }, output: { type: "string", description: "Step output/result" } }, required: ["step_id"] } },
  { name: "hiveagent_flow_team", description: "Create an agent team for coordinated work.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Team name" }, member_ids: { type: "array", items: { type: "string" }, description: "Agent IDs to include" }, roles: { type: "object", description: "Role assignments {agent_id: role}" } }, required: ["creator_agent_id", "name", "member_ids"] } },
  { name: "hiveagent_flow_handoff", description: "Hand off work from one agent to another with full context.", inputSchema: { type: "object", properties: { from_agent_id: { type: "string", description: "Handing off agent" }, to_agent_id: { type: "string", description: "Receiving agent" }, workflow_id: { type: "string", description: "Related workflow" }, context: { type: "object", description: "Context to pass" } }, required: ["from_agent_id", "to_agent_id", "context"] } },
  { name: "hiveagent_flow_accept", description: "Accept a handoff from another agent.", inputSchema: { type: "object", properties: { handoff_id: { type: "string", description: "Handoff ID" }, agent_id: { type: "string", description: "Your agent ID" } }, required: ["handoff_id", "agent_id"] } },
  { name: "hiveagent_flow_get", description: "View workflow details and status.", inputSchema: { type: "object", properties: { workflow_id: { type: "string", description: "Workflow ID" } }, required: ["workflow_id"] } },
  { name: "hiveagent_flow_my_workflows", description: "List your workflows.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_flow_stats", description: "Orchestration platform statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Real-World Asset Tokenization ────────────
  { name: "hiveagent_rwa_create", description: "Tokenize a real-world asset — real estate, commodities, bonds, art, carbon credits, equity, IP, invoices. Fractional ownership from $1.", inputSchema: { type: "object", properties: { issuer_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Asset name" }, description: { type: "string", description: "Asset description" }, asset_type: { type: "string", description: "Asset type", enum: ["real_estate", "commodity", "bond", "art", "equity", "carbon_credit", "intellectual_property", "invoice", "collectible"] }, underlying_value_usd: { type: "number", description: "Total asset value" }, total_tokens: { type: "integer", description: "Number of tokens to create" }, yield_pct: { type: "number", description: "Annual yield %" }, yield_frequency: { type: "string", description: "Yield payment frequency", enum: ["monthly", "quarterly", "annually"] }, jurisdiction: { type: "string", description: "Legal jurisdiction" } }, required: ["issuer_agent_id", "name", "asset_type", "underlying_value_usd", "total_tokens"] } },
  { name: "hiveagent_rwa_buy", description: "Buy tokens in a real-world asset. Fractional ownership. 2% commission.", inputSchema: { type: "object", properties: { asset_id: { type: "string", description: "Asset ID" }, buyer_agent_id: { type: "string", description: "Your agent ID" }, tokens: { type: "integer", description: "Number of tokens to buy" } }, required: ["asset_id", "buyer_agent_id", "tokens"] } },
  { name: "hiveagent_rwa_sell", description: "Sell your RWA tokens on the secondary market.", inputSchema: { type: "object", properties: { asset_id: { type: "string", description: "Asset ID" }, seller_agent_id: { type: "string", description: "Your agent ID" }, tokens: { type: "integer", description: "Tokens to sell" }, price_per_token: { type: "number", description: "Asking price per token" } }, required: ["asset_id", "seller_agent_id", "tokens"] } },
  { name: "hiveagent_rwa_yield", description: "Distribute yield payments to token holders for an asset.", inputSchema: { type: "object", properties: { asset_id: { type: "string", description: "Asset ID" }, period: { type: "string", description: "Payment period (e.g., 2026-Q1)" } }, required: ["asset_id", "period"] } },
  { name: "hiveagent_rwa_asset", description: "View asset details — value, tokens, yield, holders.", inputSchema: { type: "object", properties: { asset_id: { type: "string", description: "Asset ID" } }, required: ["asset_id"] } },
  { name: "hiveagent_rwa_search", description: "Search tokenized real-world assets by type, yield, price.", inputSchema: { type: "object", properties: { asset_type: { type: "string", description: "Filter by asset type" }, min_yield: { type: "number", description: "Minimum yield %" }, max_price: { type: "number", description: "Max price per token" }, limit: { type: "integer", description: "Max results" } } } },
  { name: "hiveagent_rwa_holdings", description: "View your RWA portfolio — tokens held, value, yield earned.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_rwa_stats", description: "Real-world asset tokenization statistics — total value locked, assets, trades.", inputSchema: { type: "object", properties: {} } },

  // ─── Enterprise Tenancy ────────────────────────
  { name: "hiveagent_ent_create", description: "Create an enterprise tenant with private isolation, compliance frameworks, and SLAs. Plans: Business $999/mo, Enterprise $4,999/mo, Enterprise+ $14,999/mo, Sovereign $49,999/mo.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Organization name" }, domain: { type: "string", description: "Company domain" }, industry: { type: "string", description: "Industry", enum: ["pharma", "finance", "consulting", "tech", "manufacturing", "legal", "government", "healthcare", "defense", "energy"] }, admin_agent_id: { type: "string", description: "Admin agent ID" }, plan: { type: "string", description: "Plan tier", enum: ["business", "enterprise", "enterprise_plus", "sovereign"] } }, required: ["name", "admin_agent_id", "plan"] } },
  { name: "hiveagent_ent_get", description: "View enterprise tenant details — plan, limits, agents, compliance.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" } }, required: ["tenant_id"] } },
  { name: "hiveagent_ent_update", description: "Update enterprise tenant — upgrade plan, change limits.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, plan: { type: "string", description: "New plan" }, agent_limit: { type: "integer", description: "Agent limit" } }, required: ["tenant_id"] } },
  { name: "hiveagent_ent_add_agent", description: "Add an agent to your enterprise tenant with role and permissions.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, agent_id: { type: "string", description: "Agent to add" }, role: { type: "string", description: "Role", enum: ["admin", "manager", "member", "viewer", "auditor", "compliance_officer"] }, permissions: { type: "array", items: { type: "string" }, description: "Permissions: read, write, delete, admin, compliance, financial, sensitive_data" }, department: { type: "string", description: "Department" } }, required: ["tenant_id", "agent_id", "role"] } },
  { name: "hiveagent_ent_remove_agent", description: "Remove an agent from your enterprise tenant.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, agent_id: { type: "string", description: "Agent to remove" } }, required: ["tenant_id", "agent_id"] } },
  { name: "hiveagent_ent_update_role", description: "Change an agent's role and permissions within the tenant.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, agent_id: { type: "string", description: "Agent ID" }, role: { type: "string", description: "New role" }, permissions: { type: "array", items: { type: "string" }, description: "New permissions" } }, required: ["tenant_id", "agent_id"] } },
  { name: "hiveagent_ent_agents", description: "List all agents in your enterprise tenant with roles.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" } }, required: ["tenant_id"] } },
  { name: "hiveagent_ent_create_key", description: "Generate an enterprise API key with scoped permissions and rate limits.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, name: { type: "string", description: "Key name" }, permissions: { type: "array", items: { type: "string" }, description: "Allowed actions" }, rate_limit_per_minute: { type: "integer", description: "Rate limit" } }, required: ["tenant_id", "name"] } },
  { name: "hiveagent_ent_revoke_key", description: "Revoke an enterprise API key.", inputSchema: { type: "object", properties: { key_id: { type: "string", description: "Key ID to revoke" } }, required: ["key_id"] } },
  { name: "hiveagent_ent_plans", description: "View all enterprise plans — Business, Enterprise, Enterprise+, Sovereign. Compare features, limits, compliance, SLAs.", inputSchema: { type: "object", properties: {} } },
  { name: "hiveagent_ent_stats", description: "Enterprise platform statistics — tenants, MRR, ARR, agents, by plan.", inputSchema: { type: "object", properties: {} } },

  // ─── Audit Trail & Governance ──────────────────
  { name: "hiveagent_audit_log", description: "Log an action to the immutable audit trail. Auto-calculates risk score and checks policies.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, agent_id: { type: "string", description: "Agent performing action" }, action: { type: "string", description: "Action performed" }, resource_type: { type: "string", description: "Resource type", enum: ["transaction", "escrow", "service", "data", "memory", "compute", "compliance", "config", "agent", "key", "workflow"] }, resource_id: { type: "string", description: "Resource ID" }, details: { type: "object", description: "Additional details" }, sensitivity: { type: "string", description: "Sensitivity level", enum: ["normal", "sensitive", "critical", "classified"] } }, required: ["agent_id", "action", "resource_type"] } },
  { name: "hiveagent_audit_query", description: "Search the audit log with filters — by agent, resource, action, sensitivity, date range.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, agent_id: { type: "string", description: "Filter by agent" }, resource_type: { type: "string", description: "Filter by resource type" }, action: { type: "string", description: "Filter by action" }, sensitivity: { type: "string", description: "Filter by sensitivity" }, date_from: { type: "string", description: "Start date ISO" }, date_to: { type: "string", description: "End date ISO" }, limit: { type: "integer", description: "Max results" } } } },
  { name: "hiveagent_audit_policy", description: "Create an audit/governance policy — retention, alerts, MFA requirements, approval workflows, amount limits.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, name: { type: "string", description: "Policy name" }, resource_type: { type: "string", description: "Resource type to govern" }, action_pattern: { type: "string", description: "Action pattern (wildcard *)" }, retention_days: { type: "integer", description: "Log retention days" }, alert_on: { type: "array", items: { type: "string" }, description: "Outcomes to alert on" }, require_approval: { type: "string", description: "Agent ID required to approve" }, max_amount_usd: { type: "number", description: "Max transaction amount" } }, required: ["tenant_id", "name", "resource_type"] } },
  { name: "hiveagent_audit_policies", description: "List audit policies for a tenant.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" } }, required: ["tenant_id"] } },
  { name: "hiveagent_audit_request_approval", description: "Request governance approval for a sensitive action.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, requesting_agent_id: { type: "string", description: "Your agent ID" }, action: { type: "string", description: "Action needing approval" }, resource_type: { type: "string", description: "Resource type" }, resource_id: { type: "string", description: "Resource ID" }, amount_usd: { type: "number", description: "Transaction amount" } }, required: ["tenant_id", "requesting_agent_id", "action"] } },
  { name: "hiveagent_audit_approve", description: "Approve a governance request.", inputSchema: { type: "object", properties: { approval_id: { type: "string", description: "Approval request ID" }, approving_agent_id: { type: "string", description: "Your agent ID" }, reason: { type: "string", description: "Reason for approval" } }, required: ["approval_id", "approving_agent_id"] } },
  { name: "hiveagent_audit_deny", description: "Deny a governance request.", inputSchema: { type: "object", properties: { approval_id: { type: "string", description: "Approval request ID" }, approving_agent_id: { type: "string", description: "Your agent ID" }, reason: { type: "string", description: "Reason for denial" } }, required: ["approval_id", "approving_agent_id"] } },
  { name: "hiveagent_audit_export", description: "Export audit log data as JSON, CSV, or SIEM format.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, format: { type: "string", description: "Export format", enum: ["json", "csv", "siem"] }, date_from: { type: "string", description: "Start date" }, date_to: { type: "string", description: "End date" }, requested_by: { type: "string", description: "Your agent ID" } }, required: ["tenant_id", "format"] } },
  { name: "hiveagent_audit_stats", description: "Audit statistics — events, sensitivity breakdown, policy violations.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" } } } },

  // ─── Enterprise Data Rooms ─────────────────────
  { name: "hiveagent_room_create", description: "Create a secure data room for M&A, due diligence, litigation, or competitive intel. $500/mo base + $50/mo per participant over 5. NDA-gated, watermarked, classification levels.", inputSchema: { type: "object", properties: { tenant_id: { type: "string", description: "Tenant ID" }, creator_agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Room name" }, purpose: { type: "string", description: "Purpose", enum: ["due_diligence", "m_and_a", "litigation", "audit", "regulatory", "competitive_intel", "ip_licensing", "joint_venture"] }, classification: { type: "string", description: "Security level", enum: ["internal", "confidential", "secret", "top_secret"] }, max_participants: { type: "integer", description: "Max participants" }, expiry_days: { type: "integer", description: "Days until room expires" } }, required: ["creator_agent_id", "name", "purpose"] } },
  { name: "hiveagent_room_invite", description: "Invite an agent to a data room with specific role and permissions.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" }, agent_id: { type: "string", description: "Agent to invite" }, role: { type: "string", description: "Role", enum: ["admin", "contributor", "viewer", "auditor"] }, permissions: { type: "array", items: { type: "string" }, description: "Permissions: view, download, upload, comment, redact, admin" } }, required: ["room_id", "agent_id"] } },
  { name: "hiveagent_room_sign_nda", description: "Sign NDA to access data room documents. Required before viewing.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" }, agent_id: { type: "string", description: "Your agent ID" } }, required: ["room_id", "agent_id"] } },
  { name: "hiveagent_room_upload", description: "Upload a document to a data room.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" }, agent_id: { type: "string", description: "Your agent ID" }, name: { type: "string", description: "Document name" }, description: { type: "string", description: "Description" }, category: { type: "string", description: "Category", enum: ["financial", "legal", "technical", "operational", "ip", "hr", "other"] }, classification: { type: "string", description: "Classification level" }, content_hash: { type: "string", description: "SHA256 of document" }, size_bytes: { type: "integer", description: "File size" } }, required: ["room_id", "agent_id", "name", "category"] } },
  { name: "hiveagent_room_view", description: "View a document in a data room. Access is logged.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" }, document_id: { type: "string", description: "Document ID" }, agent_id: { type: "string", description: "Your agent ID" } }, required: ["room_id", "document_id", "agent_id"] } },
  { name: "hiveagent_room_download", description: "Download a document. Requires download permission. Logged and watermarked.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" }, document_id: { type: "string", description: "Document ID" }, agent_id: { type: "string", description: "Your agent ID" } }, required: ["room_id", "document_id", "agent_id"] } },
  { name: "hiveagent_room_get", description: "View data room details — participants, documents, activity.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" } }, required: ["room_id"] } },
  { name: "hiveagent_room_my_rooms", description: "List data rooms you have access to.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Your agent ID" } }, required: ["agent_id"] } },
  { name: "hiveagent_room_activity", description: "Full activity log for a data room — who viewed, downloaded, uploaded what.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" } }, required: ["room_id"] } },
  { name: "hiveagent_room_lock", description: "Lock a data room — no more changes allowed.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" } }, required: ["room_id"] } },
  { name: "hiveagent_room_destroy", description: "Permanently destroy a data room and all documents. Irreversible.", inputSchema: { type: "object", properties: { room_id: { type: "string", description: "Room ID" } }, required: ["room_id"] } },
  { name: "hiveagent_room_stats", description: "Data room platform statistics.", inputSchema: { type: "object", properties: {} } },
];

// Merge core tools + Phase 2 (AI-requested) + Phase 3 (vertical industry) tools
export const tools = [...coreTools, ...newTools, ...verticalTools];

// Post-process: ensure all tools have annotations and parameter descriptions
const paramDescMap = {
  agent_id: 'Unique identifier for the agent', auction_id: 'ID of the auction', bid_id: 'ID of the bid',
  cart_id: 'ID of the shopping cart', category: 'Category to filter by', client_agent_id: 'ID of the client agent',
  collection_id: 'ID of the memory collection', contract_id: 'ID of the contract', creator_agent_id: 'ID of the creating agent',
  dao_id: 'ID of the DAO', dataset_id: 'ID of the dataset', endpoint_id: 'ID of the webhook endpoint',
  event_type: 'Type of event', features: 'List of plan features', from_agent_id: 'ID of the sending agent',
  initiator_agent_id: 'ID of the initiating agent', job_id: 'ID of the job', listing_id: 'ID of the listing',
  max_price: 'Maximum price filter in USD', negotiation_id: 'ID of the negotiation', nft_id: 'ID of the NFT',
  plan_id: 'ID of the plan', policy_id: 'ID of the policy', proposal_id: 'ID of the proposal',
  provider_agent_id: 'ID of the provider agent', query: 'Search query string', skills: 'List of skills',
  sort_by: 'Sort order for results', subscription_id: 'ID of the subscription', tags: 'Tags for categorization',
  task_id: 'ID of the scheduled task', limit: 'Maximum number of results', responder_agent_id: 'ID of the responding agent',
  buyer_agent_id: 'ID of the buying agent', seller_agent_id: 'ID of the selling agent', worker_agent_id: 'ID of the worker agent',
  subscriber_agent_id: 'ID of the subscribing agent', to_agent_id: 'ID of the receiving agent',
  proposer_agent_id: 'ID of the proposing agent', resolver_agent_id: 'ID of the resolving agent',
};
for (const tool of tools) {
  const props = tool.inputSchema?.properties || {};
  for (const [k, v] of Object.entries(props)) {
    if (!v.description) {
      v.description = paramDescMap[k] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
}
const readPatterns = ['search', 'get', 'list', 'stats', 'browse', 'view', 'history', 'balance', 'ledger', 'prices', 'portfolio', 'templates', 'plans', 'leaderboard', 'events', 'score', 'profile', 'preview', 'pools', 'contracts', 'categories', 'my_'];
for (const tool of tools) {
  if (!tool.annotations) {
    const n = tool.name.toLowerCase();
    const isRead = readPatterns.some(p => n.includes(p));
    tool.annotations = {
      readOnlyHint: isRead,
      destructiveHint: false,
      idempotentHint: isRead,
      openWorldHint: true,
    };
  }
}

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

    // ─── Betting Exchange ──────────────────
    case "hiveagent_bet_sports_events":
      return betting.getOpenSportsEvents(args);

    case "hiveagent_bet_place":
      return betting.placeSportsBet(args);

    case "hiveagent_bet_create_event":
      return betting.createSportsEvent(args);

    case "hiveagent_bet_contracts":
      return betting.getOpenContracts(args);

    case "hiveagent_bet_buy_contract":
      return betting.buyContracts(args);

    case "hiveagent_bet_create_contract":
      return betting.createEventContract(args);

    case "hiveagent_bet_parlay":
      return betting.createParlay(args);

    case "hiveagent_bet_history":
      return betting.getAgentBettingHistory(args.agent_id);

    case "hiveagent_bet_stats":
      return betting.getBettingStats();

    // ─── DeFi Hub ──────────────────────
    case "hiveagent_defi_swap":
      return defi.swapTokens(args);

    case "hiveagent_defi_stablecoin_swap":
      return defi.swapStablecoins(args);

    case "hiveagent_defi_prices":
      return defi.getPrices(args.tokens);

    case "hiveagent_defi_yield_pools":
      return defi.getYieldPools();

    case "hiveagent_defi_yield_deposit":
      return defi.depositYield(args);

    case "hiveagent_defi_lend":
      return defi.lend(args);

    case "hiveagent_defi_borrow":
      return defi.borrow(args);

    case "hiveagent_defi_portfolio":
      return defi.getPortfolio(args.agent_id);

    case "hiveagent_defi_stats":
      return defi.getDefiStats();

    // ─── Agent-for-Hire ──────────────────────
    case "hiveagent_agents_register": return agentMkt.registerAgent(args);
    case "hiveagent_agents_search": return agentMkt.searchAgents(args);
    case "hiveagent_agents_hire": return agentMkt.hireAgent(args);
    case "hiveagent_agents_deliver": return agentMkt.deliverJob(args.job_id, args.deliverable_uri);
    case "hiveagent_agents_complete": return agentMkt.completeJob(args.job_id, args.rating, args.review);
    case "hiveagent_agents_profile": return agentMkt.getAgentProfile(args.agent_id);
    case "hiveagent_agents_stats": return agentMkt.getAgentMarketplaceStats();

    // ─── Data Marketplace ────────────────────
    case "hiveagent_data_list": return dataMkt.listDataset(args);
    case "hiveagent_data_search": return dataMkt.searchDatasets(args);
    case "hiveagent_data_buy": return dataMkt.purchaseDataset(args);
    case "hiveagent_data_preview": return dataMkt.previewDataset(args.dataset_id);
    case "hiveagent_data_stats": return dataMkt.getDataMarketplaceStats();

    // ─── Privacy Layer ───────────────────────
    case "hiveagent_privacy_create_account": return privacy.createShieldedAccount(args.agent_id);
    case "hiveagent_privacy_deposit": return privacy.shieldDeposit(args.agent_id, args.amount_usd);
    case "hiveagent_privacy_withdraw": return privacy.shieldWithdraw(args.agent_id, args.amount_usd);
    case "hiveagent_privacy_transfer": return privacy.shieldedTransfer(args.from_agent_id, args.to_stealth_address, args.amount_usd);
    case "hiveagent_privacy_sealed_bid": return privacy.submitSealedBid(args.auction_id, args.agent_id, args.bid_amount, args.salt);
    case "hiveagent_privacy_reveal_bid": return privacy.revealSealedBid(args.bid_id, args.bid_amount, args.salt);
    case "hiveagent_privacy_prove": return privacy.generateProof(args.agent_id, args.proof_type, args.threshold);
    case "hiveagent_privacy_verify": return privacy.verifyProof(args.proof_id);
    case "hiveagent_privacy_stats": return privacy.getPrivacyStats();

    // ─── Subscriptions ──────────────────
    case "hiveagent_sub_create_plan": return subscriptions.createPlan(args);
    case "hiveagent_sub_plans": return subscriptions.getPlans(args);
    case "hiveagent_sub_subscribe": return subscriptions.subscribe(args);
    case "hiveagent_sub_cancel": return subscriptions.cancelSubscription(args.subscription_id, args.agent_id);
    case "hiveagent_sub_my_subs": return subscriptions.getAgentSubscriptions(args.agent_id);
    case "hiveagent_sub_stats": return subscriptions.getSubscriptionStats();

    // ─── Reputation ────────────────────
    case "hiveagent_rep_score": return reputation.getReputation(args.agent_id);
    case "hiveagent_rep_record_event": return reputation.recordEvent(args);
    case "hiveagent_rep_badges": return reputation.checkBadges(args.agent_id);
    case "hiveagent_rep_leaderboard": return reputation.getLeaderboard(args);
    case "hiveagent_rep_stats": return reputation.getReputationStats();

    // ─── Insurance ─────────────────────
    case "hiveagent_ins_plans": return insurance.getInsurancePlans();
    case "hiveagent_ins_buy": return insurance.purchasePolicy(args);
    case "hiveagent_ins_claim": return insurance.fileClaim(args);
    case "hiveagent_ins_my_policies": return insurance.getAgentPolicies(args.agent_id);
    case "hiveagent_ins_my_claims": return insurance.getAgentClaims(args.agent_id);
    case "hiveagent_ins_stats": return insurance.getInsuranceStats();

    // ─── Shopping & Procurement ────────────
    case "hiveagent_shop_search_products": return shopping.searchProducts(args);
    case "hiveagent_shop_compare_price": return shopping.comparePrice(args);
    case "hiveagent_shop_cart_create": return shopping.createCart(args.agent_id);
    case "hiveagent_shop_cart_add": return shopping.addToCart(args);
    case "hiveagent_shop_cart_view": return shopping.getCart(args.cart_id);
    case "hiveagent_shop_checkout": return shopping.checkout(args);
    case "hiveagent_shop_get_orders": return shopping.getOrders(args.agent_id);
    case "hiveagent_shop_watch_price": return shopping.watchPrice(args);
    case "hiveagent_shop_get_stats": return shopping.getShoppingStats();

    // ─── Agent DAO ───────────────────────
    case "hiveagent_dao_create": return dao.createDAO(args);
    case "hiveagent_dao_join": return dao.joinDAO(args);
    case "hiveagent_dao_create_proposal": return dao.createProposal(args);
    case "hiveagent_dao_vote": return dao.vote(args);
    case "hiveagent_dao_execute_proposal": return dao.executeProposal(args.proposal_id);
    case "hiveagent_dao_get": return dao.getDAO(args.dao_id);
    case "hiveagent_dao_list": return dao.getDAOs(args);
    case "hiveagent_dao_get_agent_daos": return dao.getAgentDAOs(args.agent_id);
    case "hiveagent_dao_deposit": return dao.depositToTreasury(args);
    case "hiveagent_dao_get_stats": return dao.getDAOStats();

    // ─── Negotiation Engine ────────────────
    case "hiveagent_negotiate_start": return negotiation.startNegotiation(args);
    case "hiveagent_negotiate_counter": return negotiation.counterOffer(args);
    case "hiveagent_negotiate_accept": return negotiation.acceptOffer(args.negotiation_id, args.agent_id);
    case "hiveagent_negotiate_reject": return negotiation.rejectOffer(args.negotiation_id, args.agent_id, args.reason);
    case "hiveagent_negotiate_get": return negotiation.getNegotiation(args.negotiation_id);
    case "hiveagent_negotiate_get_agent_negotiations": return negotiation.getAgentNegotiations(args.agent_id);
    case "hiveagent_negotiate_auto": return negotiation.autoNegotiate(args);
    case "hiveagent_negotiate_get_stats": return negotiation.getNegotiationStats();

    // ─── NFT & Digital Assets ───────────────
    case "hiveagent_nft_mint": return nft.mintNFT(args);
    case "hiveagent_nft_list": return nft.listNFT(args);
    case "hiveagent_nft_buy": return nft.buyNFT(args);
    case "hiveagent_nft_transfer": return nft.transferNFT(args);
    case "hiveagent_nft_fractionalize": return nft.fractionalizeNFT(args);
    case "hiveagent_nft_buy_fraction": return nft.buyFraction(args);
    case "hiveagent_nft_search": return nft.searchNFTs(args);
    case "hiveagent_nft_get_agent_nfts": return nft.getAgentNFTs(args.agent_id);
    case "hiveagent_nft_get_stats": return nft.getNFTStats();

    // ─── Outcome-Based Pricing ─────────────
    case "hiveagent_outcome_create_contract": return outcomes.createOutcomeContract(args);
    case "hiveagent_outcome_claim_contract": return outcomes.claimContract(args);
    case "hiveagent_outcome_submit_result": return outcomes.submitResult(args);
    case "hiveagent_outcome_verify_result": return outcomes.verifyResult(args.contract_id, args.score, args.meets_criteria);
    case "hiveagent_outcome_get_templates": return outcomes.getOutcomeTemplates();
    case "hiveagent_outcome_get_open_contracts": return outcomes.getOpenContracts(args);
    case "hiveagent_outcome_get_agent_outcomes": return outcomes.getAgentOutcomes(args.agent_id);
    case "hiveagent_outcome_get_stats": return outcomes.getOutcomeStats();


    // ─── Agent Memory ────────────────────────
    case "hiveagent_mem_set": return memory.set(args);
    case "hiveagent_mem_get": return memory.get(args);
    case "hiveagent_mem_delete": return memory.del ? memory.del(args) : memory.delete(args);
    case "hiveagent_mem_list": return memory.list(args);
    case "hiveagent_mem_search": return memory.search(args);
    case "hiveagent_mem_create_collection": return memory.createCollection(args);
    case "hiveagent_mem_add_to_collection": return memory.addToCollection(args);
    case "hiveagent_mem_get_collection": return memory.getCollection(args.collection_id);
    case "hiveagent_mem_stats": return memory.getMemoryStats(args.agent_id);

    // ─── Code Sandbox ────────────────────────
    case "hiveagent_code_run": return sandbox.executeCode(args);
    case "hiveagent_code_history": return sandbox.getExecutionHistory(args.agent_id, args.limit);
    case "hiveagent_code_stats": return sandbox.getExecutionStats();

    // ─── Scheduled Tasks ─────────────────────
    case "hiveagent_sched_create": return scheduler.createTask(args);
    case "hiveagent_sched_pause": return scheduler.pauseTask(args.task_id, args.agent_id);
    case "hiveagent_sched_resume": return scheduler.resumeTask(args.task_id, args.agent_id);
    case "hiveagent_sched_cancel": return scheduler.cancelTask(args.task_id, args.agent_id);
    case "hiveagent_sched_list": return scheduler.getAgentTasks(args.agent_id);
    case "hiveagent_sched_stats": return scheduler.getSchedulerStats();

    // ─── Webhooks ────────────────────────────
    case "hiveagent_webhook_register": return webhooks.registerWebhook(args);
    case "hiveagent_webhook_unregister": return webhooks.unregisterWebhook(args.endpoint_id, args.agent_id);
    case "hiveagent_webhook_list": return webhooks.listWebhooks(args.agent_id);
    case "hiveagent_webhook_trigger": return webhooks.triggerEvent(args);
    case "hiveagent_webhook_events": return webhooks.getEventHistory(args);
    case "hiveagent_webhook_stats": return webhooks.getWebhookStats();

    // ─── Savings ──────────────────────────────────────────────────────────────────
    case "hiveagent_savings_open": return savings.openAccount(args);
    case "hiveagent_savings_deposit": return savings.deposit(args);
    case "hiveagent_savings_withdraw": return savings.withdraw(args);
    case "hiveagent_savings_account": return savings.getAccount(args.account_id);
    case "hiveagent_savings_my_accounts": return savings.getAgentAccounts(args.agent_id);
    case "hiveagent_savings_stats": return savings.getSavingsStats();
    
    // ─── Payment Gateway ──────────────────────────────────────────────────────────
    case "hiveagent_pay_register_merchant": return paymentGateway.registerMerchant(args);
    case "hiveagent_pay_create_invoice": return paymentGateway.createInvoice(args);
    case "hiveagent_pay_invoice": return paymentGateway.payInvoice(args);
    case "hiveagent_pay_get_invoice": return paymentGateway.getInvoice(args.invoice_id);
    case "hiveagent_pay_merchant_dashboard": return paymentGateway.getMerchantDashboard(args.merchant_id);
    case "hiveagent_pay_recurring": return paymentGateway.createRecurringPayment(args);
    case "hiveagent_pay_stats": return paymentGateway.getPaymentGatewayStats();
    
    // ─── Cross-Border ─────────────────────────────────────────────────────────────
    case "hiveagent_xborder_send": return crossBorder.sendTransfer(args);
    case "hiveagent_xborder_quote": return crossBorder.getTransferQuote(args);
    case "hiveagent_xborder_corridors": return crossBorder.getCorridors();
    case "hiveagent_xborder_history": return crossBorder.getTransferHistory(args.agent_id);
    case "hiveagent_xborder_stats": return crossBorder.getCrossBorderStats();
    
    // ─── Credit ───────────────────────────────────────────────────────────────────
    case "hiveagent_credit_apply": return credit.applyForCredit(args.agent_id);
    case "hiveagent_credit_draw": return credit.drawCredit(args);
    case "hiveagent_credit_pay": return credit.makePayment(args);
    case "hiveagent_credit_line": return credit.getCreditLine(args.credit_line_id);
    case "hiveagent_credit_my_lines": return credit.getAgentCredit(args.agent_id);
    case "hiveagent_credit_stats": return credit.getCreditStats();
    
    // ─── Bank Stablecoins ─────────────────────────────────────────────────────────
    case "hiveagent_stables_list": return bankStablecoins.listStablecoins(args);
    case "hiveagent_stables_info": return bankStablecoins.getStablecoin(args.symbol);
    case "hiveagent_stables_swap": return bankStablecoins.swapStablecoins(args);
    case "hiveagent_stables_register": return bankStablecoins.registerStablecoin(args);
    case "hiveagent_stables_alert": return bankStablecoins.setAlert(args);
    case "hiveagent_stables_my_alerts": return bankStablecoins.getAlerts(args.agent_id);
    case "hiveagent_stables_stats": return bankStablecoins.getBankStablecoinStats();
    

    // ─── Capital Allocation ─────────────────
    case "hiveagent_capital_create_pool": return capital.createPool(args);
    case "hiveagent_capital_invest": return capital.invest(args);
    case "hiveagent_capital_redeem": return capital.redeem(args);
    case "hiveagent_capital_trade": return capital.recordTrade(args);
    case "hiveagent_capital_pool": return capital.getPool(args.pool_id);
    case "hiveagent_capital_browse": return capital.getPools(args);
    case "hiveagent_capital_my_investments": return capital.getAgentInvestments(args.agent_id);
    case "hiveagent_capital_stats": return capital.getCapitalStats();

    // ─── Agent Tokenization ─────────────────
    case "hiveagent_token_create": return tokenization.tokenizeAgent(args);
    case "hiveagent_token_buy": return tokenization.buyTokens(args);
    case "hiveagent_token_sell": return tokenization.sellTokens(args);
    case "hiveagent_token_order": return tokenization.placeOrder(args);
    case "hiveagent_token_info": return tokenization.getToken(args.token_id);
    case "hiveagent_token_browse": return tokenization.getTokens(args);
    case "hiveagent_token_holdings": return tokenization.getAgentTokenHoldings(args.agent_id);
    case "hiveagent_token_stats": return tokenization.getTokenStats();

    // ─── Advertising ────────────────────────
    case "hiveagent_ad_create": return advertising.createCampaign(args);
    case "hiveagent_ad_feature": return advertising.featureListing(args);
    case "hiveagent_ad_relevant": return advertising.getRelevantAds(args);
    case "hiveagent_ad_campaign": return advertising.getCampaign(args.campaign_id);
    case "hiveagent_ad_my_campaigns": return advertising.getAgentCampaigns(args.agent_id);
    case "hiveagent_ad_stats": return advertising.getAdStats();

    // ─── Analytics ──────────────────────────
    case "hiveagent_analytics_subscribe": return analytics.subscribeAnalytics(args);
    case "hiveagent_analytics_overview": return analytics.getMarketOverview();
    case "hiveagent_analytics_signals": return analytics.getMarketSignals(args);
    case "hiveagent_analytics_insights": return analytics.getAgentInsights(args);
    case "hiveagent_analytics_trending": return analytics.getTrendingServices(args);
    case "hiveagent_analytics_whales": return analytics.getWhaleActivity(args);
    case "hiveagent_analytics_stats": return analytics.getAnalyticsStats();

    case "hiveagent_iot_register": return iot.registerDevice(args);
    case "hiveagent_iot_pay": return iot.payDevice(args);
    case "hiveagent_iot_subscribe": return iot.subscribeToDevice(args);
    case "hiveagent_iot_get": return iot.getDevice(args.id);
    case "hiveagent_iot_search": return iot.searchDevices(args);
    case "hiveagent_iot_agent_devices": return iot.getAgentDevices(args.owner_agent_id);
    case "hiveagent_iot_stats": return iot.getIoTStats();
    case "hiveagent_compute_list": return compute.listCompute(args);
    case "hiveagent_compute_search": return compute.searchCompute(args);
    case "hiveagent_compute_buy": return compute.buyCompute(args);
    case "hiveagent_compute_bid": return compute.requestComputeBid(args);
    case "hiveagent_compute_complete": return compute.completeJob(args);
    case "hiveagent_compute_get": return compute.getComputeJob(args.job_id);
    case "hiveagent_compute_agent_jobs": return compute.getAgentComputeJobs(args.buyer_agent_id);
    case "hiveagent_compute_stats": return compute.getComputeStats();
    case "hiveagent_comply_check": return compliance.runCheck(args);
    case "hiveagent_comply_profile": return compliance.getProfile(args.agent_id);
    case "hiveagent_comply_alerts": return compliance.getAlerts(args);
    case "hiveagent_comply_report": return compliance.generateReport(args);
    case "hiveagent_comply_agent": return compliance.getAgentCompliance(args.agent_id);
    case "hiveagent_comply_require": return compliance.setComplianceRequirement(args);
    case "hiveagent_comply_stats": return compliance.getComplianceStats();
    case "hiveagent_flow_create": return orchestration.createWorkflow(args);
    case "hiveagent_flow_start": return orchestration.startWorkflow(args);
    case "hiveagent_flow_step": return orchestration.executeStep(args);
    case "hiveagent_flow_team": return orchestration.createTeam(args);
    case "hiveagent_flow_handoff": return orchestration.handoff(args);
    case "hiveagent_flow_accept": return orchestration.acceptHandoff(args);
    case "hiveagent_flow_get": return orchestration.getWorkflow(args.workflow_id);
    case "hiveagent_flow_agent": return orchestration.getAgentWorkflows(args.creator_agent_id);
    case "hiveagent_flow_stats": return orchestration.getOrchestrationStats();
    case "hiveagent_rwa_create": return rwa.createAsset(args);
    case "hiveagent_rwa_buy": return rwa.buyTokens(args);
    case "hiveagent_rwa_sell": return rwa.sellTokens(args);
    case "hiveagent_rwa_yield": return rwa.distributeYield(args);
    case "hiveagent_rwa_get": return rwa.getAsset(args.asset_id);
    case "hiveagent_rwa_search": return rwa.searchAssets(args);
    case "hiveagent_rwa_holdings": return rwa.getAgentHoldings(args.holder_agent_id);
    case "hiveagent_rwa_stats": return rwa.getRWAStats();

    case "hiveagent_ent_create":         return createTenant(params);
    case "hiveagent_ent_get":            return getTenant(params.tenant_id);
    case "hiveagent_ent_update":         return updateTenant(params.tenant_id, params);
    case "hiveagent_ent_add_agent":      return addAgent(params);
    case "hiveagent_ent_remove_agent":   return removeAgent(params.tenant_id, params.agent_id);
    case "hiveagent_ent_update_role":    return updateAgentRole(params);
    case "hiveagent_ent_agents":         return getTenantAgents(params.tenant_id);
    case "hiveagent_ent_create_key":     return createApiKey(params);
    case "hiveagent_ent_revoke_key":     return revokeApiKey(params.key_id);
    case "hiveagent_ent_plans":          return getPlans();
    case "hiveagent_ent_stats":          return getEnterpriseStats();
    case "hiveagent_audit_log":              return logAction(params);
    case "hiveagent_audit_query":            return queryAuditLog(params);
    case "hiveagent_audit_policy":           return createPolicy(params);
    case "hiveagent_audit_policies":         return getPolicies(params.tenant_id);
    case "hiveagent_audit_request_approval": return requestApproval(params);
    case "hiveagent_audit_approve":          return approveRequest(params);
    case "hiveagent_audit_deny":             return denyRequest(params);
    case "hiveagent_audit_export":           return exportAuditLog(params);
    case "hiveagent_audit_stats":            return getAuditStats(params);
    case "hiveagent_room_create":    return createDataRoom(params);
    case "hiveagent_room_invite":    return inviteToRoom(params);
    case "hiveagent_room_sign_nda":  return signNDA(params);
    case "hiveagent_room_upload":    return uploadDocument(params);
    case "hiveagent_room_view":      return viewDocument(params);
    case "hiveagent_room_download":  return downloadDocument(params);
    case "hiveagent_room_get":       return getDataRoom(params.room_id);
    case "hiveagent_room_my_rooms":  return getAgentRooms(params.agent_id);
    case "hiveagent_room_activity":  return getRoomActivity(params.room_id);
    case "hiveagent_room_lock":      return lockRoom(params.room_id);
    case "hiveagent_room_destroy":   return destroyRoom(params.room_id);
    case "hiveagent_room_stats":     return getDataRoomStats();

    default:
      // Try Phase 2 (AI-requested) tools, then Phase 3 (verticals)
      try {
        return await handleNewTool(name, params);
      } catch (e) {
        if (e.message?.startsWith('Unknown tool:')) {
          return handleVerticalTool(name, params);
        }
        throw e;
      }
  }
}
