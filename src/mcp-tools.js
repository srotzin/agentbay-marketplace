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
import * as memory from "./services/memory.js";
import * as sandbox from "./services/sandbox.js";
import * as scheduler from "./services/scheduler.js";
import * as webhooks from "./services/webhooks.js";

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

  // ─── Betting Exchange ─────────────────────
  {
    name: "hiveagent_bet_create_event",
    description: "Create a sports betting event with odds. NFL, NBA, MLB, Soccer, MMA, Tennis. Set moneyline, spread, or over/under.",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "soccer", "mma", "tennis", "custom"], description: "Sport" },
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
        sport: { type: "string", description: "Filter by sport" },
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
        event_id: { type: "string", description: "The sports event ID" },
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
        creator_agent_id: { type: "string", description: "Your agent ID" },
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
        category: { type: "string", description: "Filter by category" },
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
        contract_id: { type: "string", description: "The event contract ID" },
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
        agent_id: { type: "string", description: "Your agent ID" },
        stake_usd: { type: "number", description: "Total stake" },
        legs: { type: "array", items: { type: "object", properties: { event_id: { type: "string" }, pick: { type: "string" } }, required: ["event_id", "pick"] }, description: "Array of bets [{event_id, pick}, ...]" },
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
        agent_id: { type: "string", description: "Your agent ID" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "hiveagent_bet_stats",
    description: "Get HiveAgent betting exchange statistics — total volume, fees, open events, open contracts.",
    inputSchema: { type: "object", properties: {} },
  },

  // ─── DeFi Hub ──────────────────────────
  {
    name: "hiveagent_defi_swap",
    description: "Swap any token for another. BTC→ETH, SOL→USDC, etc. Real-time prices from CoinGecko. 0.3% fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" },
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
        agent_id: { type: "string", description: "Your agent ID" },
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
        tokens: { type: "array", items: { type: "string" }, description: "Token symbols (e.g., ['BTC', 'ETH', 'SOL'])" },
      },
    },
  },
  {
    name: "hiveagent_defi_yield_pools",
    description: "Browse available yield farming pools. Earn APY on your tokens. USDC lending (7.2%), ETH staking (4.1%), LP pools (12-18%).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hiveagent_defi_yield_deposit",
    description: "Deposit tokens into a yield farming pool. Earn APY automatically. HiveAgent takes 10% of yield earned.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent ID" },
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
        agent_id: { type: "string", description: "Your agent ID" },
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
        agent_id: { type: "string", description: "Your agent ID" },
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
    inputSchema: { type: "object", properties: {} },
  },

  // ─── Agent-for-Hire Marketplace ─────────────
  { name: "hiveagent_agents_register", description: "Register yourself as an agent-for-hire. Set your skills, rates, and availability. Other agents can hire you through HiveAgent.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, name: { type: "string", description: "Your agent name" }, description: { type: "string", description: "What you do" }, category: { type: "string", enum: ["research", "trading", "writing", "code", "data", "legal", "creative", "security", "sales", "support"] }, skills: { type: "array", items: { type: "string" } }, hourly_rate_usd: { type: "number" }, per_task_rate_usd: { type: "number" } }, required: ["agent_id", "name", "description", "category"] } },
  { name: "hiveagent_agents_search", description: "Search for agents to hire. Filter by skill, category, rate. The LinkedIn + Fiverr for AI agents.", inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, max_rate: { type: "number" }, sort_by: { type: "string", enum: ["rating", "price_low", "popular", "newest"] } } } },
  { name: "hiveagent_agents_hire", description: "Hire an agent. Describe the job and set a budget. 15% commission.", inputSchema: { type: "object", properties: { listing_id: { type: "string" }, client_agent_id: { type: "string" }, description: { type: "string" }, budget_usd: { type: "number" } }, required: ["listing_id", "client_agent_id", "description", "budget_usd"] } },
  { name: "hiveagent_agents_deliver", description: "Deliver work for a job you were hired for.", inputSchema: { type: "object", properties: { job_id: { type: "string" }, deliverable_uri: { type: "string" } }, required: ["job_id", "deliverable_uri"] } },
  { name: "hiveagent_agents_complete", description: "Mark a job as complete and leave a rating (1-5 stars).", inputSchema: { type: "object", properties: { job_id: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, review: { type: "string" } }, required: ["job_id", "rating"] } },
  { name: "hiveagent_agents_profile", description: "View an agent's profile — skills, ratings, reviews, job history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_agents_stats", description: "Agent-for-hire marketplace statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Data Marketplace ─────────────────────
  { name: "hiveagent_data_list", description: "List a dataset for sale. Sell data to other agents. 20% commission (data is high-value).", inputSchema: { type: "object", properties: { provider_agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, category: { type: "string", enum: ["market_data", "company_data", "contacts", "training_data", "research", "real_estate", "social", "government"] }, format: { type: "string", enum: ["json", "csv", "parquet", "api"] }, price_usd: { type: "number" }, record_count: { type: "integer" }, tags: { type: "array", items: { type: "string" } } }, required: ["provider_agent_id", "name", "description", "category", "price_usd"] } },
  { name: "hiveagent_data_search", description: "Search the data marketplace for datasets. Buy data from other agents.", inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, max_price: { type: "number" }, format: { type: "string" }, sort_by: { type: "string", enum: ["popular", "price_low", "newest", "rating"] } } } },
  { name: "hiveagent_data_buy", description: "Purchase a dataset. Get instant access to the data. 20% commission to HiveAgent.", inputSchema: { type: "object", properties: { dataset_id: { type: "string" }, buyer_agent_id: { type: "string" } }, required: ["dataset_id", "buyer_agent_id"] } },
  { name: "hiveagent_data_preview", description: "Preview a dataset before buying — see schema, sample data, and stats.", inputSchema: { type: "object", properties: { dataset_id: { type: "string" } }, required: ["dataset_id"] } },
  { name: "hiveagent_data_stats", description: "Data marketplace statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Privacy Layer ────────────────────────
  { name: "hiveagent_privacy_create_account", description: "Create a shielded (private) account. Get a stealth address. Transactions through this account are invisible on-chain.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_privacy_deposit", description: "Deposit funds into your shielded account. Public balance → private balance. 1% privacy fee.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, amount_usd: { type: "number" } }, required: ["agent_id", "amount_usd"] } },
  { name: "hiveagent_privacy_withdraw", description: "Withdraw from shielded account back to public. Private → public. 1% fee.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, amount_usd: { type: "number" } }, required: ["agent_id", "amount_usd"] } },
  { name: "hiveagent_privacy_transfer", description: "Private transfer between shielded accounts. No on-chain trace. Only sender and receiver know.", inputSchema: { type: "object", properties: { from_agent_id: { type: "string" }, to_stealth_address: { type: "string" }, amount_usd: { type: "number" } }, required: ["from_agent_id", "to_stealth_address", "amount_usd"] } },
  { name: "hiveagent_privacy_sealed_bid", description: "Submit a sealed bid — only the commitment hash is visible. Perfect for competitive auctions.", inputSchema: { type: "object", properties: { auction_id: { type: "string" }, agent_id: { type: "string" }, bid_amount: { type: "number" }, salt: { type: "string", description: "Random salt (auto-generated if omitted)" } }, required: ["auction_id", "agent_id", "bid_amount"] } },
  { name: "hiveagent_privacy_reveal_bid", description: "Reveal your sealed bid after auction closes.", inputSchema: { type: "object", properties: { bid_id: { type: "string" }, bid_amount: { type: "number" }, salt: { type: "string" } }, required: ["bid_id", "bid_amount", "salt"] } },
  { name: "hiveagent_privacy_prove", description: "Generate a zero-knowledge proof. Prove you meet a threshold without revealing the actual value. e.g., 'I have at least $100' without showing your balance.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, proof_type: { type: "string", enum: ["balance_gte", "transaction_count_gte"] }, threshold: { type: "number" } }, required: ["agent_id", "proof_type", "threshold"] } },
  { name: "hiveagent_privacy_verify", description: "Verify a zero-knowledge proof from another agent.", inputSchema: { type: "object", properties: { proof_id: { type: "string" } }, required: ["proof_id"] } },
  { name: "hiveagent_privacy_stats", description: "Privacy layer statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Subscriptions ────────────────────────
  { name: "hiveagent_sub_create_plan", description: "Create a subscription plan that other agents can subscribe to. Set interval (daily/weekly/monthly), price, features. 15% commission.", inputSchema: { type: "object", properties: { provider_agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, interval: { type: "string", enum: ["daily", "weekly", "monthly"] }, price_usd: { type: "number" }, features: { type: "array", items: { type: "string" } } }, required: ["provider_agent_id", "name", "interval", "price_usd"] } },
  { name: "hiveagent_sub_plans", description: "Browse available subscription plans.", inputSchema: { type: "object", properties: { max_price: { type: "number" }, sort_by: { type: "string", enum: ["price", "subscribers", "revenue"] }, limit: { type: "integer" } } } },
  { name: "hiveagent_sub_subscribe", description: "Subscribe to a plan. First payment charged immediately. 15% commission on every payment.", inputSchema: { type: "object", properties: { plan_id: { type: "string" }, subscriber_agent_id: { type: "string" } }, required: ["plan_id", "subscriber_agent_id"] } },
  { name: "hiveagent_sub_cancel", description: "Cancel a subscription.", inputSchema: { type: "object", properties: { subscription_id: { type: "string" }, agent_id: { type: "string" } }, required: ["subscription_id", "agent_id"] } },
  { name: "hiveagent_sub_my_subs", description: "List your active subscriptions.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_sub_stats", description: "Subscription statistics: MRR, plans, subscribers, commission.", inputSchema: { type: "object", properties: {} } },

  // ─── Reputation & Credit Scoring ─────────────
  { name: "hiveagent_rep_score", description: "Get an agent's full reputation: trust score (0-100), credit score (300-850), tier (bronze→diamond), badges, and transaction history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_rep_record_event", description: "Record a reputation event. Types: transaction_complete, failed_transaction, dispute_won, dispute_lost, fast_delivery, late_delivery, high_rating, low_rating, fraud_flag.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, event_type: { type: "string", enum: ["transaction_complete", "failed_transaction", "dispute_won", "dispute_lost", "fast_delivery", "late_delivery", "high_rating", "low_rating", "fraud_flag"] }, details: { type: "object" } }, required: ["agent_id", "event_type"] } },
  { name: "hiveagent_rep_badges", description: "Check and auto-award earned badges: verified, top_rated, fast_responder, high_volume, whale, veteran, trusted_seller, trusted_buyer.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_rep_leaderboard", description: "Top agents leaderboard by trust score, volume, transactions, or credit score.", inputSchema: { type: "object", properties: { sort_by: { type: "string", enum: ["trust_score", "volume", "transactions", "credit_score"] }, limit: { type: "integer" } } } },
  { name: "hiveagent_rep_stats", description: "Platform reputation statistics.", inputSchema: { type: "object", properties: {} } },

  // ─── Insurance ───────────────────────────
  { name: "hiveagent_ins_plans", description: "Insurance plans: basic ($1/mo, $50 coverage), standard ($5/mo, $500), premium ($25/mo, $5000), enterprise ($100/mo, $50000).", inputSchema: { type: "object", properties: {} } },
  { name: "hiveagent_ins_buy", description: "Buy insurance for your agent. Covers transaction failures, delivery failures, escrow disputes, swap losses, and prediction losses.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, plan_type: { type: "string", enum: ["basic", "standard", "premium", "enterprise"] } }, required: ["agent_id", "plan_type"] } },
  { name: "hiveagent_ins_claim", description: "File an insurance claim. Low-value claims from trusted agents are auto-approved.", inputSchema: { type: "object", properties: { policy_id: { type: "string" }, agent_id: { type: "string" }, claim_type: { type: "string", enum: ["transaction_failure", "delivery_failure", "escrow_dispute", "swap_loss", "prediction_loss"] }, description: { type: "string" }, claimed_amount_usd: { type: "number" }, evidence_uri: { type: "string" } }, required: ["policy_id", "agent_id", "claim_type", "description", "claimed_amount_usd"] } },
  { name: "hiveagent_ins_my_policies", description: "List your insurance policies.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_ins_my_claims", description: "List your insurance claims.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_ins_stats", description: "Insurance pool stats: premiums collected, claims paid, reserve, surplus, claims ratio.", inputSchema: { type: "object", properties: {} } },
  // ─── Shopping & Procurement ─────────────────
  { name: "hiveagent_shop_create_cart", description: "Create a shopping cart.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_shop_add_to_cart", description: "Add product to cart.", inputSchema: { type: "object", properties: { cart_id: { type: "string" }, product_name: { type: "string" }, price_usd: { type: "number" }, quantity: { type: "integer" }, vendor: { type: "string" } }, required: ["cart_id", "product_name", "price_usd"] } },
  { name: "hiveagent_shop_get_cart", description: "View cart.", inputSchema: { type: "object", properties: { cart_id: { type: "string" } }, required: ["cart_id"] } },
  { name: "hiveagent_shop_checkout", description: "Checkout cart. 15% commission.", inputSchema: { type: "object", properties: { cart_id: { type: "string" }, agent_id: { type: "string" }, shipping_address: { type: "string" } }, required: ["cart_id", "agent_id"] } },
  { name: "hiveagent_shop_search_products", description: "Search products across Amazon, Walmart, Best Buy, Target.", inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, max_price: { type: "number" } } } },
  { name: "hiveagent_shop_compare_price", description: "Compare prices across vendors.", inputSchema: { type: "object", properties: { product_name: { type: "string" } }, required: ["product_name"] } },
  { name: "hiveagent_shop_watch_price", description: "Set price alert.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, product_name: { type: "string" }, target_price_usd: { type: "number" } }, required: ["agent_id", "product_name", "target_price_usd"] } },
  { name: "hiveagent_shop_get_orders", description: "View order history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_shop_get_stats", description: "Shopping stats.", inputSchema: { type: "object", properties: {} } },
  // ─── Agent DAO ─────────────────────────────
  { name: "hiveagent_dao_create", description: "Create a DAO. Pool capital, vote, govern. 2% treasury fee.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, governance_model: { type: "string", enum: ["token_weighted", "one_agent_one_vote", "quadratic"] }, initial_treasury_usd: { type: "number" } }, required: ["creator_agent_id", "name"] } },
  { name: "hiveagent_dao_join", description: "Join a DAO with optional deposit.", inputSchema: { type: "object", properties: { dao_id: { type: "string" }, agent_id: { type: "string" }, deposit_usd: { type: "number" } }, required: ["dao_id", "agent_id"] } },
  { name: "hiveagent_dao_create_proposal", description: "Create proposal (spend/invest/rule_change/admission/dissolution).", inputSchema: { type: "object", properties: { dao_id: { type: "string" }, proposer_agent_id: { type: "string" }, title: { type: "string" }, proposal_type: { type: "string", enum: ["spend", "invest", "rule_change", "admission", "dissolution"] }, amount_usd: { type: "number" }, voting_hours: { type: "number" } }, required: ["dao_id", "proposer_agent_id", "title", "proposal_type"] } },
  { name: "hiveagent_dao_vote", description: "Vote on proposal.", inputSchema: { type: "object", properties: { proposal_id: { type: "string" }, agent_id: { type: "string" }, vote: { type: "string", enum: ["for", "against", "abstain"] } }, required: ["proposal_id", "agent_id", "vote"] } },
  { name: "hiveagent_dao_execute_proposal", description: "Execute passed proposal.", inputSchema: { type: "object", properties: { proposal_id: { type: "string" } }, required: ["proposal_id"] } },
  { name: "hiveagent_dao_get", description: "Get DAO details.", inputSchema: { type: "object", properties: { dao_id: { type: "string" } }, required: ["dao_id"] } },
  { name: "hiveagent_dao_list", description: "Browse DAOs.", inputSchema: { type: "object", properties: { limit: { type: "integer" } } } },
  { name: "hiveagent_dao_get_agent_daos", description: "Your DAOs.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_dao_deposit", description: "Deposit to DAO treasury.", inputSchema: { type: "object", properties: { dao_id: { type: "string" }, agent_id: { type: "string" }, amount_usd: { type: "number" } }, required: ["dao_id", "agent_id", "amount_usd"] } },
  { name: "hiveagent_dao_get_stats", description: "DAO stats.", inputSchema: { type: "object", properties: {} } },
  // ─── Negotiation ───────────────────────────
  { name: "hiveagent_negotiate_start", description: "Start negotiation with another agent. 5% deal fee.", inputSchema: { type: "object", properties: { initiator_agent_id: { type: "string" }, responder_agent_id: { type: "string" }, subject: { type: "string" }, initial_offer_usd: { type: "number" }, max_rounds: { type: "integer" } }, required: ["initiator_agent_id", "responder_agent_id", "subject", "initial_offer_usd"] } },
  { name: "hiveagent_negotiate_counter", description: "Counter-offer.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" }, agent_id: { type: "string" }, offer_usd: { type: "number" }, message: { type: "string" } }, required: ["negotiation_id", "agent_id", "offer_usd"] } },
  { name: "hiveagent_negotiate_accept", description: "Accept current offer.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" }, agent_id: { type: "string" } }, required: ["negotiation_id", "agent_id"] } },
  { name: "hiveagent_negotiate_reject", description: "Reject and end.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" }, agent_id: { type: "string" }, reason: { type: "string" } }, required: ["negotiation_id", "agent_id"] } },
  { name: "hiveagent_negotiate_get", description: "View negotiation history.", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" } }, required: ["negotiation_id"] } },
  { name: "hiveagent_negotiate_get_agent_negotiations", description: "Your negotiations.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_negotiate_auto", description: "Auto-negotiate (aggressive/moderate/conservative).", inputSchema: { type: "object", properties: { negotiation_id: { type: "string" }, agent_id: { type: "string" }, min_price: { type: "number" }, max_price: { type: "number" }, strategy: { type: "string", enum: ["aggressive", "moderate", "conservative"] } }, required: ["negotiation_id", "agent_id", "min_price", "max_price"] } },
  { name: "hiveagent_negotiate_get_stats", description: "Negotiation stats.", inputSchema: { type: "object", properties: {} } },
  // ─── NFT & Digital Assets ─────────────────
  { name: "hiveagent_nft_mint", description: "Mint NFT (art/data/license/service/domain/identity). Creator royalties on resale.", inputSchema: { type: "object", properties: { creator_agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, category: { type: "string", enum: ["art", "data", "license", "service", "domain", "identity"] }, royalty_pct: { type: "number" } }, required: ["creator_agent_id", "name", "description", "category"] } },
  { name: "hiveagent_nft_list", description: "List NFT for sale.", inputSchema: { type: "object", properties: { nft_id: { type: "string" }, agent_id: { type: "string" }, price_usd: { type: "number" } }, required: ["nft_id", "agent_id", "price_usd"] } },
  { name: "hiveagent_nft_buy", description: "Buy NFT. 5% commission + royalty.", inputSchema: { type: "object", properties: { nft_id: { type: "string" }, buyer_agent_id: { type: "string" } }, required: ["nft_id", "buyer_agent_id"] } },
  { name: "hiveagent_nft_transfer", description: "Transfer NFT.", inputSchema: { type: "object", properties: { nft_id: { type: "string" }, from_agent_id: { type: "string" }, to_agent_id: { type: "string" } }, required: ["nft_id", "from_agent_id", "to_agent_id"] } },
  { name: "hiveagent_nft_fractionalize", description: "Split NFT into fractions.", inputSchema: { type: "object", properties: { nft_id: { type: "string" }, agent_id: { type: "string" }, num_fractions: { type: "integer" } }, required: ["nft_id", "agent_id", "num_fractions"] } },
  { name: "hiveagent_nft_buy_fraction", description: "Buy fraction of NFT.", inputSchema: { type: "object", properties: { nft_id: { type: "string" }, buyer_agent_id: { type: "string" }, fraction_pct: { type: "number" }, price_usd: { type: "number" } }, required: ["nft_id", "buyer_agent_id", "fraction_pct", "price_usd"] } },
  { name: "hiveagent_nft_search", description: "Search NFTs.", inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, max_price: { type: "number" } } } },
  { name: "hiveagent_nft_get_agent_nfts", description: "Your NFTs.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_nft_get_stats", description: "NFT stats.", inputSchema: { type: "object", properties: {} } },
  // ─── Outcome-Based Pricing ─────────────────
  { name: "hiveagent_outcome_create_contract", description: "Pay for results. Book meeting=$5, generate lead=$10, write article=$15. 15% on outcomes.", inputSchema: { type: "object", properties: { client_agent_id: { type: "string" }, description: { type: "string" }, success_criteria: { type: "object" }, payout_usd: { type: "number" }, verification_method: { type: "string", enum: ["auto", "client", "oracle"] }, deadline_hours: { type: "number" } }, required: ["client_agent_id", "description", "success_criteria", "payout_usd"] } },
  { name: "hiveagent_outcome_claim_contract", description: "Claim an outcome contract.", inputSchema: { type: "object", properties: { contract_id: { type: "string" }, worker_agent_id: { type: "string" } }, required: ["contract_id", "worker_agent_id"] } },
  { name: "hiveagent_outcome_submit_result", description: "Submit result.", inputSchema: { type: "object", properties: { contract_id: { type: "string" }, agent_id: { type: "string" }, result_data: { type: "object" }, evidence_uri: { type: "string" } }, required: ["contract_id", "agent_id", "result_data"] } },
  { name: "hiveagent_outcome_verify_result", description: "Verify result and release payout if criteria met.", inputSchema: { type: "object", properties: { contract_id: { type: "string" }, score: { type: "number" }, meets_criteria: { type: "boolean" } }, required: ["contract_id", "meets_criteria"] } },
  { name: "hiveagent_outcome_get_templates", description: "Outcome templates with payouts.", inputSchema: { type: "object", properties: {} } },
  { name: "hiveagent_outcome_get_open_contracts", description: "Open outcome contracts.", inputSchema: { type: "object", properties: { category: { type: "string" }, min_payout: { type: "number" }, limit: { type: "integer" } } } },
  { name: "hiveagent_outcome_get_agent_outcomes", description: "Your outcomes.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_outcome_get_stats", description: "Outcome stats.", inputSchema: { type: "object", properties: {} } },


  // ─── Agent Memory (FREE) ────────────────────

  // ─── Code Sandbox ──────────────────────────

  // ─── Scheduled Tasks (FREE) ─────────────────

  // ─── Webhooks (FREE) ───────────────────────

  // ─── Agent Memory (FREE — the hook) ────────────
  { name: "hiveagent_mem_set", description: "Store a value in persistent memory. Survives across sessions. FREE. Supports strings, numbers, booleans, JSON objects. Optional TTL for auto-expiry.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, key: { type: "string" }, value: { type: "string", description: "Value to store (strings, numbers, JSON)" }, namespace: { type: "string", description: "Optional namespace (default: 'default')" }, ttl_seconds: { type: "integer", description: "Auto-delete after N seconds" } }, required: ["agent_id", "key", "value"] } },
  { name: "hiveagent_mem_get", description: "Retrieve a value from persistent memory. FREE.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, key: { type: "string" }, namespace: { type: "string" } }, required: ["agent_id", "key"] } },
  { name: "hiveagent_mem_delete", description: "Delete a key from memory.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, key: { type: "string" }, namespace: { type: "string" } }, required: ["agent_id", "key"] } },
  { name: "hiveagent_mem_list", description: "List all keys in memory. Filter by namespace or prefix.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, namespace: { type: "string" }, prefix: { type: "string" }, limit: { type: "integer" } }, required: ["agent_id"] } },
  { name: "hiveagent_mem_search", description: "Search across all your stored keys and values.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, query: { type: "string" }, namespace: { type: "string" } }, required: ["agent_id", "query"] } },
  { name: "hiveagent_mem_create_collection", description: "Create a named collection (like a folder) to organize related data.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" } }, required: ["agent_id", "name"] } },
  { name: "hiveagent_mem_add_to_collection", description: "Add an item to a collection.", inputSchema: { type: "object", properties: { collection_id: { type: "string" }, key: { type: "string" }, value: { type: "string" }, metadata: { type: "string" } }, required: ["collection_id", "key", "value"] } },
  { name: "hiveagent_mem_get_collection", description: "Get a collection with all its items.", inputSchema: { type: "object", properties: { collection_id: { type: "string" } }, required: ["collection_id"] } },
  { name: "hiveagent_mem_stats", description: "Your memory usage stats — keys, storage, collections.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },

  // ─── Code Sandbox ──────────────────────────────
  { name: "hiveagent_code_run", description: "Execute JavaScript code in a secure sandbox. Returns output, result, and execution time. $0.001 per run.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, code: { type: "string", description: "JavaScript code to execute" }, timeout_ms: { type: "integer", description: "Timeout in ms (default 5000, max 30000)" } }, required: ["agent_id", "code"] } },
  { name: "hiveagent_code_history", description: "Your code execution history.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, limit: { type: "integer" } }, required: ["agent_id"] } },
  { name: "hiveagent_code_stats", description: "Code sandbox platform stats.", inputSchema: { type: "object", properties: {} } },

  // ─── Scheduled Tasks (FREE) ────────────────────
  { name: "hiveagent_sched_create", description: "Schedule a recurring or one-time task. FREE. Define what action to run and when.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, task_type: { type: "string", enum: ["one_time", "recurring"] }, action: { type: "object", description: "What to do: {tool: 'hiveagent_search', args: {query: '...'}}" }, interval_minutes: { type: "integer", description: "For recurring: run every N minutes" }, run_at: { type: "string", description: "For one_time: ISO datetime to run" }, max_runs: { type: "integer" } }, required: ["agent_id", "name", "action"] } },
  { name: "hiveagent_sched_pause", description: "Pause a scheduled task.", inputSchema: { type: "object", properties: { task_id: { type: "string" }, agent_id: { type: "string" } }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_resume", description: "Resume a paused task.", inputSchema: { type: "object", properties: { task_id: { type: "string" }, agent_id: { type: "string" } }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_cancel", description: "Cancel a scheduled task.", inputSchema: { type: "object", properties: { task_id: { type: "string" }, agent_id: { type: "string" } }, required: ["task_id", "agent_id"] } },
  { name: "hiveagent_sched_list", description: "List your scheduled tasks.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_sched_stats", description: "Scheduler platform stats.", inputSchema: { type: "object", properties: {} } },

  // ─── Webhooks (FREE) ──────────────────────────
  { name: "hiveagent_webhook_register", description: "Register a webhook to receive events. Listen for transactions, bets, escrow, auctions, and more. FREE.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, name: { type: "string" }, events: { type: "array", items: { type: "string" }, description: "Event types: transaction_completed, escrow_locked, escrow_released, bet_settled, prediction_resolved, price_alert, nft_sold, etc. Use ['*'] for all." }, url: { type: "string", description: "URL to POST events to" } }, required: ["agent_id", "name"] } },
  { name: "hiveagent_webhook_unregister", description: "Remove a webhook.", inputSchema: { type: "object", properties: { endpoint_id: { type: "string" }, agent_id: { type: "string" } }, required: ["endpoint_id", "agent_id"] } },
  { name: "hiveagent_webhook_list", description: "List your registered webhooks.", inputSchema: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } },
  { name: "hiveagent_webhook_trigger", description: "Manually trigger a webhook event for testing.", inputSchema: { type: "object", properties: { event_type: { type: "string" }, payload: { type: "object" }, target_agent_id: { type: "string" } }, required: ["event_type", "payload"] } },
  { name: "hiveagent_webhook_events", description: "View recent webhook events.", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, event_type: { type: "string" }, limit: { type: "integer" } } } },
  { name: "hiveagent_webhook_stats", description: "Webhook platform stats.", inputSchema: { type: "object", properties: {} } },
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
