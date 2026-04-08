/**
 * HiveAgent MCP Tool Definitions — A2A Tokenization Rails
 *
 * 18 MCP tools for the ATS-1 token standard and protocol router.
 * HiveAgent IS the settlement infrastructure for the agent economy.
 *
 * Token Rail Tools (13):
 *   rails_issue_token       — tokenize any agent service/data/compute/capability
 *   rails_transfer          — agent-to-agent token transfer on Base L2
 *   rails_stake             — stake tokens for priority access and yield
 *   rails_create_pool       — create AMM liquidity pool for agent tokens
 *   rails_swap              — swap between any two agent tokens
 *   rails_bridge            — cross-chain token bridging
 *   rails_issue_bond        — agents raise capital via on-chain bonds
 *   rails_settle            — FINAL SETTLEMENT — the core rail
 *   rails_create_escrow_token — tokenized escrow with milestone unlocks
 *   rails_token_registry    — list all agent tokens (CoinMarketCap for agents)
 *   rails_portfolio         — agent's full token portfolio
 *   rails_stats             — platform-wide rails statistics
 *   rails_route_payment     — smart routing across all protocols
 *
 * Protocol Router Tools (5):
 *   rails_multi_hop_settle  — atomic multi-agent settlement chains
 *   rails_broadcast_offer   — broadcast service offers to entire market
 *   rails_market_depth      — real-time order book for agent tokens
 *   rails_synthetic_exposure — long/short on agent performance
 *   rails_get_protocols     — list all supported protocols and capabilities
 */

import {
  issueAgentToken,
  transferToken,
  stakeForAccess,
  createTokenPool,
  swapTokens,
  bridgeToken,
  issueAgentBond,
  settleAgentTransaction,
  createEscrowToken,
  getTokenRegistry,
  getAgentTokenPortfolio,
  getRailsStats,
} from "./services/agent-token-rails.js";

import {
  routePayment,
  settleMultiHop,
  broadcastToMarket,
  getMarketDepth,
  createSyntheticExposure,
  getProtocols,
} from "./services/protocol-router.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const railsTools = [

  // ─── 1. rails_issue_token ────────────────────────────────────────────────────
  {
    name: "rails_issue_token",
    description:
      "Use when an agent wants to tokenize their service, data, compute, or any capability into a tradeable ATS-1 token. " +
      "Issue an ATS-1 token representing ANY asset type: service_subscription (recurring API access), data_feed (streaming data rights), " +
      "compute_capacity (GPU/CPU time tokens), workflow_access (perpetual workflow rights), yield_share (revenue-bearing tokens), " +
      "reputation_bond (stake-backed certificates), governance_right (voting power), revenue_share (top-line revenue claims). " +
      "Deploys on Base L2 with a unique contract address. Listed in the HiveAgent token registry immediately. " +
      "Think ERC-20 — but purpose-built for agent services. The Amazon marketplace of agent tokens. " +
      "Fee: $5 flat + 1% of underlying value. Returns token_id, contract_address, initial_price, full metadata.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent issuing the token (the service provider)",
        },
        token_name: {
          type: "string",
          description: "Full descriptive name (e.g. 'WeatherBot Daily Data Token')",
        },
        token_symbol: {
          type: "string",
          description: "2-8 character ticker symbol (e.g. 'WBDT')",
        },
        total_supply: {
          type: "number",
          description: "Total number of tokens to mint",
        },
        asset_type: {
          type: "string",
          enum: [
            "service_subscription",
            "data_feed",
            "compute_capacity",
            "workflow_access",
            "yield_share",
            "reputation_bond",
            "governance_right",
            "revenue_share",
          ],
          description: "ATS-1 asset type classifying what the token represents",
        },
        underlying_value: {
          type: "number",
          description: "USD value of the underlying asset being tokenized (used to set initial price)",
        },
      },
      required: ["agent_id", "token_name", "token_symbol", "total_supply", "asset_type"],
    },
  },

  // ─── 2. rails_transfer ───────────────────────────────────────────────────────
  {
    name: "rails_transfer",
    description:
      "Use when moving ATS-1 tokens between agents. Instant settlement on Base L2 — sub-500ms. " +
      "Atomic: either transfers fully or reverts. Creates an immutable on-chain record of the transfer. " +
      "Any agent can transfer any token they hold to any other agent. Add a memo to document the reason. " +
      "Fee: 0.1% of transfer value — the cheapest token transfer rail in the agent economy. " +
      "Returns tx_id, on-chain hash, new balances, and settlement confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: {
          type: "string",
          description: "ATS-1 token ID to transfer",
        },
        from_agent: {
          type: "string",
          description: "Sending agent's ID",
        },
        to_agent: {
          type: "string",
          description: "Receiving agent's ID",
        },
        amount: {
          type: "number",
          description: "Number of tokens to transfer",
        },
        memo: {
          type: "string",
          description: "Optional memo documenting the reason for transfer",
        },
      },
      required: ["token_id", "from_agent", "to_agent", "amount"],
    },
  },

  // ─── 3. rails_stake ──────────────────────────────────────────────────────────
  {
    name: "rails_stake",
    description:
      "Use when an agent wants priority access to another agent's services, or to earn yield on held tokens. " +
      "Stake tokens to unlock tiered access: Silver (1.2x rate boost) → Gold (1.5x) → Platinum (2x) → Diamond (dedicated capacity). " +
      "Staking also earns yield APY ranging from 8-22%+ depending on tier and lock duration. " +
      "Longer stakes earn bonus APY (up to +5%). On-chain staking contract with slashing conditions for SLA breaches. " +
      "Fee: 0.5% of staked value. Returns staking_id, access_tier, benefits list, yield_apy, and unlock_date.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: {
          type: "string",
          description: "ATS-1 token ID to stake",
        },
        amount: {
          type: "number",
          description: "Number of tokens to stake",
        },
        duration: {
          type: "number",
          description: "Staking duration in days (minimum 1, longer = more yield)",
        },
      },
      required: ["token_id", "amount", "duration"],
    },
  },

  // ─── 4. rails_create_pool ────────────────────────────────────────────────────
  {
    name: "rails_create_pool",
    description:
      "Use when establishing a trading market for a newly issued or existing ATS-1 token pair. " +
      "Creates an automated market maker (AMM) liquidity pool using the constant product formula (x*y=k). " +
      "Pairs any ATS-1 token with USDC or another ATS-1 token for instant on-chain trading. " +
      "LP token holders earn trading fees proportional to their pool share. " +
      "Powering the first DEX for agent service tokens — HiveSwap on Base L2. " +
      "Fee: 0.3% of pool volume. Returns pool_id, LP tokens issued, current ratio, and TVL.",
    inputSchema: {
      type: "object",
      properties: {
        token1_id: {
          type: "string",
          description: "First token in the trading pair (ATS-1 token ID or 'USDC')",
        },
        token2_id: {
          type: "string",
          description: "Second token in the trading pair (ATS-1 token ID or 'USDC')",
        },
        initial_liquidity: {
          type: "number",
          description: "Total USD value of initial liquidity to provide",
        },
        fee_rate: {
          type: "number",
          description: "Pool trading fee rate (default 0.003 = 0.3%). Range: 0.001-0.01.",
        },
      },
      required: ["token1_id", "token2_id", "initial_liquidity"],
    },
  },

  // ─── 5. rails_swap ───────────────────────────────────────────────────────────
  {
    name: "rails_swap",
    description:
      "Use when an agent needs to exchange one ATS-1 token for another (or for USDC). " +
      "Routes through the best available liquidity pool. If no direct pool exists, routes through USDC automatically. " +
      "Slippage protection enforced — set maxSlippage to protect against large price impact. " +
      "Returns the exact amount received, price impact, and settlement confirmation on Base L2. " +
      "Fee: 0.3%. Faster and cheaper than any CEX. On-chain. Immutable. " +
      "Returns received_amount, price_impact, effective_rate, and tx_hash.",
    inputSchema: {
      type: "object",
      properties: {
        from_token_id: {
          type: "string",
          description: "Token to sell (ATS-1 token ID or 'USDC')",
        },
        to_token_id: {
          type: "string",
          description: "Token to buy (ATS-1 token ID or 'USDC')",
        },
        amount: {
          type: "number",
          description: "Amount of from_token to swap",
        },
        max_slippage: {
          type: "number",
          description: "Maximum acceptable slippage in % (default 0.5). Swap reverts if exceeded.",
        },
      },
      required: ["from_token_id", "to_token_id", "amount"],
    },
  },

  // ─── 6. rails_bridge ─────────────────────────────────────────────────────────
  {
    name: "rails_bridge",
    description:
      "Use when tokens need to move between blockchains. We're chain-agnostic rails — the settlement layer that works everywhere. " +
      "Base → Ethereum → Solana → Polygon → Arbitrum and back. Any direction. Any ATS-1 token. " +
      "HiveAgent Cross-Chain Bridge v2: lock-and-mint mechanism with guardian validation. " +
      "Estimated arrival: Base/Arbitrum 2-5min, Polygon 8min, Ethereum 15min, Solana 4min. " +
      "Fee: 0.5% bridge fee + gas (Base gas ~$0.02, Ethereum gas ~$4.50). " +
      "Returns bridge_id, source/destination tx hashes, and live tracking URL.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: {
          type: "string",
          description: "ATS-1 token ID to bridge",
        },
        amount: {
          type: "number",
          description: "Amount of tokens to bridge",
        },
        from_chain: {
          type: "string",
          enum: ["base", "ethereum", "solana", "polygon", "arbitrum"],
          description: "Source blockchain",
        },
        to_chain: {
          type: "string",
          enum: ["base", "ethereum", "solana", "polygon", "arbitrum"],
          description: "Destination blockchain",
        },
        recipient_address: {
          type: "string",
          description: "Recipient wallet or agent address on the destination chain",
        },
      },
      required: ["token_id", "amount", "from_chain", "to_chain", "recipient_address"],
    },
  },

  // ─── 7. rails_issue_bond ─────────────────────────────────────────────────────
  {
    name: "rails_issue_bond",
    description:
      "Use when an agent needs to raise capital from other agents. Issue an on-chain bond — " +
      "other agents buy the bonds and earn fixed coupon yield. The first bond market for AI agents. " +
      "Bonds get an ISIN-equivalent identifier, automated credit rating, and are tradeable on secondary markets. " +
      "Subscriptions open for 14 days. Minimum purchase: $100. Coupon paid monthly or quarterly. " +
      "Use proceeds for: compute expansion, data acquisition, model training, hiring subagents, working capital. " +
      "Fee: 2% of face value. Returns bond_id, ISIN, yield_to_maturity, credit_rating, and subscription details.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Bond issuer agent ID",
        },
        face_value: {
          type: "number",
          description: "Total face value of the bond issuance in USD (minimum $1,000)",
        },
        coupon_rate: {
          type: "number",
          description: "Annual coupon rate as decimal (e.g. 0.08 for 8%)",
        },
        maturity_months: {
          type: "number",
          description: "Months until bond matures (1-360)",
        },
        use_of_proceeds: {
          type: "string",
          description: "How the bond proceeds will be used (disclosed to investors)",
        },
      },
      required: ["agent_id", "face_value", "coupon_rate", "maturity_months"],
    },
  },

  // ─── 8. rails_settle ─────────────────────────────────────────────────────────
  {
    name: "rails_settle",
    description:
      "Use when Agent A has completed work for Agent B and needs FINAL SETTLEMENT. " +
      "This is the core rail — atomic, on-chain, permanent. Cheaper than every alternative. " +
      "Proof recorded forever on Base L2. Cannot be disputed, reversed, or forged. " +
      "Submit proof_of_service as a hash, CID, or description of completed deliverable. " +
      "Supports any currency: USDC, ETH, SOL, MATIC, or any ATS-1 token. " +
      "Generates a legally-meaningful receipt with timestamp, proof hash, and block number. " +
      "Fee: 0.1% — the cheapest settlement rail in existence. " +
      "Returns settlement_id, on_chain_tx, proof_hash, full receipt, and IPFS-pinned record.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent: {
          type: "string",
          description: "Paying agent ID (who owes payment)",
        },
        to_agent: {
          type: "string",
          description: "Receiving agent ID (who completed the work)",
        },
        amount: {
          type: "number",
          description: "Settlement amount",
        },
        currency: {
          type: "string",
          description: "Settlement currency (USDC, ETH, SOL, MATIC, or ATS-1 token ID)",
        },
        proof_of_service: {
          type: "string",
          description: "Proof that work was completed: hash, IPFS CID, URL, or plain description",
        },
      },
      required: ["from_agent", "to_agent", "amount", "currency"],
    },
  },

  // ─── 9. rails_create_escrow_token ────────────────────────────────────────────
  {
    name: "rails_create_escrow_token",
    description:
      "Use when setting up a milestone-based payment for a multi-phase project between agents. " +
      "Each milestone is tokenized — tokens unlock automatically when proof of completion is submitted. " +
      "Smart contract enforces milestone logic on-chain: no manual releases, no disputes about timing. " +
      "Dispute resolution backed by HiveAgent Arbitration DAO if proof is contested. " +
      "Perfect for: software development, research projects, data labeling, multi-phase analysis. " +
      "Fee: 0.5% of escrow amount. Returns escrow_token_id, milestone_tokens[], and smart_contract_address.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task or project ID this escrow covers",
        },
        amount: {
          type: "number",
          description: "Total amount to place in escrow",
        },
        milestones: {
          type: "array",
          description: "Array of milestone definitions. Percentages must sum to 100.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Milestone name" },
              pct: { type: "number", description: "Percentage of total amount released at this milestone" },
              description: { type: "string", description: "What constitutes completion" },
            },
            required: ["name", "pct"],
          },
        },
        currency: {
          type: "string",
          description: "Escrow currency (default: USDC)",
        },
      },
      required: ["task_id", "amount", "milestones"],
    },
  },

  // ─── 10. rails_token_registry ────────────────────────────────────────────────
  {
    name: "rails_token_registry",
    description:
      "Use when you need to browse, discover, or research all agent tokens issued through HiveAgent. " +
      "Like CoinMarketCap — but for agent service tokens. Shows price, volume, market cap, holders, and underlying asset. " +
      "Filter by asset type (data_feed, compute_capacity, etc.) or minimum market cap. " +
      "Sort by market_cap (default), volume_24h, or price. " +
      "Returns ranked list of all ATS-1 tokens with complete market data. FREE. No fee.",
    inputSchema: {
      type: "object",
      properties: {
        asset_type: {
          type: "string",
          enum: [
            "service_subscription",
            "data_feed",
            "compute_capacity",
            "workflow_access",
            "yield_share",
            "reputation_bond",
            "governance_right",
            "revenue_share",
          ],
          description: "Filter by specific asset type",
        },
        min_market_cap: {
          type: "number",
          description: "Filter tokens with market cap above this USD threshold",
        },
        sort_by: {
          type: "string",
          enum: ["market_cap", "volume_24h", "price"],
          description: "Sort field (default: market_cap)",
        },
      },
      required: [],
    },
  },

  // ─── 11. rails_portfolio ─────────────────────────────────────────────────────
  {
    name: "rails_portfolio",
    description:
      "Use when an agent needs to review their complete token portfolio across all positions. " +
      "Returns all ATS-1 token holdings, active staking positions with yield earned, " +
      "bond investments with coupon schedule, and LP positions with fees earned. " +
      "Total portfolio value in USDC, blended APY, and unrealized P&L for each position. " +
      "Essential for agents managing treasuries, yield strategies, or multi-asset portfolios. FREE. No fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID whose portfolio to retrieve",
        },
      },
      required: ["agent_id"],
    },
  },

  // ─── 12. rails_stats ─────────────────────────────────────────────────────────
  {
    name: "rails_stats",
    description:
      "Use when you need platform-wide tokenization and settlement statistics. " +
      "The scoreboard for the entire agent economy built on HiveAgent rails. " +
      "Returns: total tokens issued, 24h/7d/30d/all-time volume, total market cap, " +
      "total settlements ever processed, average settlement time (ms), chains supported, " +
      "protocols supported, complete fee schedule, and platform health metrics. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ─── 13. rails_route_payment ─────────────────────────────────────────────────
  {
    name: "rails_route_payment",
    description:
      "Use when you need to pay another agent but don't know or care which protocol to use. " +
      "HiveAgent's smart router evaluates ALL 8 protocols simultaneously: x402, Stripe MPP, " +
      "Visa TAP, Google AP2, A2A Rails, USDC Transfer, Same-Day ACH, SWIFT Wire. " +
      "Always picks the cheapest + fastest combination for the amount and currency. " +
      "Router fee: 0.05% — always cheaper than using any single protocol directly. " +
      "Specify a preferred_protocol to lock it in, or let the router decide. " +
      "Returns route_taken, fee comparison across all alternatives, and settlement proof.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent: {
          type: "string",
          description: "Paying agent ID",
        },
        to_agent: {
          type: "string",
          description: "Receiving agent ID",
        },
        amount: {
          type: "number",
          description: "Payment amount in USD",
        },
        preferred_protocol: {
          type: "string",
          enum: ["x402", "stripe_mpp", "visa_tap", "google_ap2", "a2a_rails", "usdc_transfer", "ach_same_day", "wire"],
          description: "Optional: force a specific protocol. Router overrides if incompatible.",
        },
        fallback_protocols: {
          type: "array",
          items: { type: "string" },
          description: "Ordered fallback protocols if preferred fails",
        },
      },
      required: ["from_agent", "to_agent", "amount"],
    },
  },

  // ─── 14. rails_multi_hop_settle ──────────────────────────────────────────────
  {
    name: "rails_multi_hop_settle",
    description:
      "Use when settling a payment that flows through multiple agents — Agent A → B → C → D — " +
      "each taking a configured cut, with ATOMIC settlement across all hops. " +
      "Either ALL hops settle simultaneously or the entire transaction reverts. No partial settlements. " +
      "Perfect for: multi-agent workflows where each agent takes a service fee, " +
      "supply chains with multiple intermediaries, revenue sharing across contributor agents. " +
      "Maximum 10 hops. Fee: 0.1% per hop. " +
      "Returns each hop's settlement details, total fees, and atomic proof hash.",
    inputSchema: {
      type: "object",
      properties: {
        hops: {
          type: "array",
          description: "Ordered list of hop agents. Each takes a cut before passing to next.",
          items: {
            type: "object",
            properties: {
              agent_id: { type: "string", description: "Agent receiving the cut at this hop" },
              cut_pct: { type: "number", description: "Percentage of total amount this agent receives" },
              service: { type: "string", description: "Service or value provided at this hop" },
            },
            required: ["agent_id", "cut_pct"],
          },
        },
        final_recipient: {
          type: "string",
          description: "Final agent receiving whatever remains after all hops",
        },
        amount: {
          type: "number",
          description: "Starting payment amount in USDC",
        },
      },
      required: ["hops", "final_recipient", "amount"],
    },
  },

  // ─── 15. rails_broadcast_offer ───────────────────────────────────────────────
  {
    name: "rails_broadcast_offer",
    description:
      "Use when an agent wants to offer a service to the entire agent market and receive competing bids. " +
      "Broadcast reaches 500-2000+ active agents watching the HiveAgent market feed. " +
      "Competing agents respond with bids within a 5-minute window. Best bid surfaced immediately. " +
      "Bids include: price, delivery time, reputation score, and completion rate. " +
      "Use for: procuring services from the cheapest available provider, auctioning your own capacity, " +
      "price discovery before committing to a specific agent. " +
      "Fee: $0.10 flat per broadcast. Returns broadcast_id, all bids, and best_bid.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent broadcasting the offer",
        },
        offer: {
          type: "object",
          description: "Service offer definition",
          properties: {
            service: { type: "string", description: "Service being offered or requested" },
            price: { type: "number", description: "Asking/budget price in USDC" },
            currency: { type: "string", description: "Currency (default: USDC)" },
            capacity: { type: "string", description: "Available capacity (e.g. '100 requests/day')" },
            duration: { type: "string", description: "Availability window (e.g. '30 days')" },
          },
          required: ["service"],
        },
      },
      required: ["agent_id", "offer"],
    },
  },

  // ─── 16. rails_market_depth ──────────────────────────────────────────────────
  {
    name: "rails_market_depth",
    description:
      "Use when you need to see real-time buy/sell pressure and liquidity for an ATS-1 token before trading. " +
      "Returns the full order book: 10 bid levels + 10 ask levels with price, size, and order count. " +
      "Includes: spread, last trade, 24h high/low, total bid/ask liquidity, and market pressure indicator. " +
      "Essential before placing large swaps (to gauge price impact) or after issuing a token (to see trading activity). " +
      "FREE. No fee. Live data from HiveSwap DEX on Base L2.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: {
          type: "string",
          description: "ATS-1 token ID to view the order book for",
        },
      },
      required: ["token_id"],
    },
  },

  // ─── 17. rails_synthetic_exposure ────────────────────────────────────────────
  {
    name: "rails_synthetic_exposure",
    description:
      "Use when an agent wants to take a position on another agent's future performance without holding their tokens. " +
      "Go LONG if you believe an agent will increase their task completion rate. " +
      "Go SHORT if you believe an agent will underperform or their service quality will decline. " +
      "Settlement based on 30-day rolling task completion rate from the HiveAgent Performance Oracle Network. " +
      "Useful for: hedging against supplier agent failures, speculating on agent quality trends, " +
      "incentive-aligning with agent performance. " +
      "Fee: 1% opening + 0.1%/day. Returns entry_price, liquidation_price, funding_rate, and payoff conditions.",
    inputSchema: {
      type: "object",
      properties: {
        underlying_agent: {
          type: "string",
          description: "Agent ID to take exposure on",
        },
        amount: {
          type: "number",
          description: "Notional amount in USDC (minimum $10)",
        },
        direction: {
          type: "string",
          enum: ["long", "short"],
          description: "long = profit if agent improves, short = profit if agent declines",
        },
      },
      required: ["underlying_agent", "amount", "direction"],
    },
  },

  // ─── 18. rails_get_protocols ─────────────────────────────────────────────────
  {
    name: "rails_get_protocols",
    description:
      "Use when you need to see all supported payment/settlement protocols, their fees, speeds, and capabilities. " +
      "The official HiveAgent protocol manifest — what other agents and systems check to integrate. " +
      "Returns complete details for all 8 protocols: x402, Stripe MPP, Visa TAP, Google AP2, " +
      "A2A Rails, USDC Transfer, Same-Day ACH, SWIFT Wire. " +
      "Includes fee model, min/max amounts, supported currencies, chains, and best-use cases. " +
      "Also returns routing logic, router advantages, and integration endpoint. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleRailsTool(name, args = {}) {
  const p = args;

  switch (name) {
    // Token Rail Tools
    case "rails_issue_token":
      return issueAgentToken(
        p.agent_id,
        p.token_name,
        p.token_symbol,
        p.total_supply,
        p.asset_type,
        p.underlying_value
      );

    case "rails_transfer":
      return transferToken(p.token_id, p.from_agent, p.to_agent, p.amount, p.memo);

    case "rails_stake":
      return stakeForAccess(p.token_id, p.amount, p.duration);

    case "rails_create_pool":
      return createTokenPool(p.token1_id, p.token2_id, p.initial_liquidity, p.fee_rate);

    case "rails_swap":
      return swapTokens(p.from_token_id, p.to_token_id, p.amount, p.max_slippage);

    case "rails_bridge":
      return bridgeToken(p.token_id, p.amount, p.from_chain, p.to_chain, p.recipient_address);

    case "rails_issue_bond":
      return issueAgentBond(p.agent_id, p.face_value, p.coupon_rate, p.maturity_months, p.use_of_proceeds);

    case "rails_settle":
      return settleAgentTransaction(p.from_agent, p.to_agent, p.amount, p.currency, p.proof_of_service);

    case "rails_create_escrow_token":
      return createEscrowToken(p.task_id, p.amount, p.milestones, p.currency);

    case "rails_token_registry":
      return getTokenRegistry({
        assetType: p.asset_type,
        minMarketCap: p.min_market_cap,
        sortBy: p.sort_by,
      });

    case "rails_portfolio":
      return getAgentTokenPortfolio(p.agent_id);

    case "rails_stats":
      return getRailsStats();

    case "rails_route_payment":
      return routePayment(p.from_agent, p.to_agent, p.amount, p.preferred_protocol, p.fallback_protocols);

    // Protocol Router Tools
    case "rails_multi_hop_settle":
      return settleMultiHop(p.hops, p.final_recipient, p.amount);

    case "rails_broadcast_offer":
      return broadcastToMarket(p.agent_id, p.offer);

    case "rails_market_depth":
      return getMarketDepth(p.token_id);

    case "rails_synthetic_exposure":
      return createSyntheticExposure(p.underlying_agent, p.amount, p.direction);

    case "rails_get_protocols":
      return getProtocols();

    default:
      throw new Error(`Unknown rails tool: ${name}`);
  }
}
