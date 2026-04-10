/**
 * HiveAgent — Exchange Trading + ERC-8183 Agentic Commerce MCP Tools
 *
 * Exchange integrations (9 tools):
 *   Coinbase CDP Trade, OKX Agent Trade Kit, Bybit AI Trading Skill,
 *   Kraken, Crypto.com, Bitget, KuCoin
 *   - exchange_connect, exchange_spot_order, exchange_futures_order
 *   - exchange_balances, exchange_positions, exchange_prices
 *   - exchange_arbitrage, exchange_rebalance, exchange_status
 *
 * ERC-8183 Agentic Commerce Protocol (11 tools):
 *   THE standard for agent-to-agent contracts (Ethereum Foundation + Virtuals)
 *   Lifecycle: create → fund → submit → complete/reject
 *   - erc8183_job_create, erc8183_job_fund, erc8183_job_set_provider
 *   - erc8183_job_submit, erc8183_job_complete, erc8183_job_reject
 *   - erc8183_job_status, erc8183_job_list, erc8183_job_marketplace
 *   - erc8183_evaluator_register, erc8183_reputation
 *
 * Total: 20 tools
 */

import * as exchange from "./services/exchange-agents.js";
import * as erc8183 from "./services/erc8183-commerce.js";

// ─── Exchange Tools ───────────────────────────────────────────────────────────

export const exchangeErc8183Tools = [
  // ── exchange_connect ────────────────────────────────────────────────────────
  {
    name: "exchange_connect",
    description:
      "Connect an agent to one of 7 major crypto exchanges via HiveAgent's unified exchange layer. " +
      "Supports: Coinbase CDP Trade, OKX Agent Trade Kit, Bybit AI Trading Skill, Kraken, Crypto.com, Bitget, KuCoin. " +
      "Returns supported trading pairs, available features (spot, futures, perps, staking, copy trading), and fee rates. " +
      "Required before placing orders or fetching balances on a specific exchange. " +
      "Live mode activates when the exchange's API key env var is set (COINBASE_TRADE_API_KEY, OKX_API_KEY, BYBIT_API_KEY, KRAKEN_API_KEY, CRYPTO_COM_API_KEY, BITGET_API_KEY, KUCOIN_API_KEY). " +
      "Simulation mode returns realistic exchange metadata when no keys are configured.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique ID of the agent connecting to the exchange",
        },
        exchange_id: {
          type: "string",
          description: "Exchange to connect to: coinbase, okx, bybit, kraken, crypto_com, bitget, kucoin",
        },
        api_key: {
          type: "string",
          description: "API key for the exchange (optional — can also be set via env var). Stored with hint only.",
        },
        secret_key: {
          type: "string",
          description: "API secret for the exchange (optional, never stored)",
        },
      },
      required: ["agent_id", "exchange_id"],
    },
  },

  // ── exchange_spot_order ─────────────────────────────────────────────────────
  {
    name: "exchange_spot_order",
    description:
      "Place a spot buy or sell order on any connected exchange. " +
      "Supports market, limit, and stop order types. " +
      "Specify either quantity (in base asset) or amount_usdc (auto-computes quantity). " +
      "Returns filled price, exchange fee, HiveAgent platform fee (0.05%), and net cost/proceeds. " +
      "Exchanges: Coinbase CDP Trade (BTC/ETH/SOL spot), OKX, Bybit, Kraken, Crypto.com, Bitget, KuCoin. " +
      "Call exchange_connect first. For futures/perps with leverage, use exchange_futures_order instead.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent placing the order",
        },
        exchange_id: {
          type: "string",
          description: "Exchange to trade on: coinbase, okx, bybit, kraken, crypto_com, bitget, kucoin",
        },
        pair: {
          type: "string",
          description: "Trading pair (e.g. BTC/USDT, ETH/USDC, SOL/USDT)",
        },
        side: {
          type: "string",
          enum: ["buy", "sell"],
          description: "Order direction: buy or sell",
        },
        order_type: {
          type: "string",
          enum: ["market", "limit", "stop"],
          description: "Order type. Default: market",
          default: "market",
        },
        quantity: {
          type: "number",
          description: "Amount in base asset (e.g. 0.1 for 0.1 BTC). Use this OR amount_usdc.",
        },
        amount_usdc: {
          type: "number",
          description: "Amount in USDC to spend/receive. Auto-computes quantity. Use this OR quantity.",
        },
        limit_price: {
          type: "number",
          description: "Limit price in USDC (required for limit orders)",
        },
        stop_price: {
          type: "number",
          description: "Stop trigger price (required for stop orders)",
        },
      },
      required: ["agent_id", "exchange_id", "pair", "side"],
    },
  },

  // ── exchange_futures_order ──────────────────────────────────────────────────
  {
    name: "exchange_futures_order",
    description:
      "Place a futures or perpetuals order with leverage on any supported exchange. " +
      "Go long or short with up to 100x leverage. Set take-profit and stop-loss for automated risk management. " +
      "Returns margin required, liquidation price, and position details. " +
      "Supported exchanges for futures: OKX Agent Trade Kit, Bybit AI Trading Skill, Kraken, Bitget, KuCoin, Crypto.com. " +
      "Also creates an open position record retrievable via exchange_positions. " +
      "For spot trading without leverage, use exchange_spot_order.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent placing the futures order",
        },
        exchange_id: {
          type: "string",
          description: "Exchange to trade futures on: okx, bybit, kraken, bitget, kucoin, crypto_com",
        },
        pair: {
          type: "string",
          description: "Futures pair (e.g. BTC/USDT, ETH/USDT)",
        },
        side: {
          type: "string",
          enum: ["long", "short"],
          description: "Position direction: long (profit when price rises) or short (profit when price falls)",
        },
        order_type: {
          type: "string",
          enum: ["market", "limit"],
          description: "Order type. Default: market",
          default: "market",
        },
        quantity: {
          type: "number",
          description: "Amount in base asset. Use this OR amount_usdc.",
        },
        amount_usdc: {
          type: "number",
          description: "Margin in USDC (position size = amount_usdc × leverage). Use this OR quantity.",
        },
        leverage: {
          type: "number",
          description: "Leverage multiplier (1-100). Default: 1x (no leverage). Higher = more risk/reward.",
          minimum: 1,
          maximum: 100,
          default: 1,
        },
        limit_price: {
          type: "number",
          description: "Entry price for limit orders",
        },
        take_profit: {
          type: "number",
          description: "Price at which to auto-close the position in profit",
        },
        stop_loss: {
          type: "number",
          description: "Price at which to auto-close the position to limit losses",
        },
      },
      required: ["agent_id", "exchange_id", "pair", "side"],
    },
  },

  // ── exchange_balances ───────────────────────────────────────────────────────
  {
    name: "exchange_balances",
    description:
      "Get a unified balance view across all connected exchanges for an agent. " +
      "Returns balances in BTC, ETH, SOL, USDC and total USDC equivalent across each exchange. " +
      "Optionally filter to a single exchange. " +
      "Use this to see total portfolio value, compare holdings across exchanges, and identify where to rebalance. " +
      "Requires at least one exchange connected via exchange_connect.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent whose balances to retrieve",
        },
        exchange_id: {
          type: "string",
          description: "Optional: filter to a single exchange (coinbase, okx, bybit, etc.)",
        },
      },
      required: ["agent_id"],
    },
  },

  // ── exchange_positions ──────────────────────────────────────────────────────
  {
    name: "exchange_positions",
    description:
      "Get unified open futures/perpetuals positions across all connected exchanges. " +
      "Returns live unrealized PnL, entry price vs current price, leverage, and notional value. " +
      "Calculates real-time PnL at call time using current market prices. " +
      "Filter to a specific exchange with exchange_id. " +
      "Positions are created automatically when you place futures orders via exchange_futures_order.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent whose positions to retrieve",
        },
        exchange_id: {
          type: "string",
          description: "Optional: filter to a single exchange",
        },
      },
      required: ["agent_id"],
    },
  },

  // ── exchange_prices ─────────────────────────────────────────────────────────
  {
    name: "exchange_prices",
    description:
      "Get real-time prices from any exchange or aggregated across all 7 exchanges. " +
      "Covers BTC, ETH, SOL, XRP, ADA, DOGE, MATIC, AVAX, DOT, LINK, BNB, and more. " +
      "Returns current price, 24h change %, 24h high/low, and 24h volume. " +
      "Use symbols array (e.g. ['BTC','ETH']) or pairs array (e.g. ['BTC/USDT']). " +
      "Specify exchange_id to get prices from a specific exchange, or omit for aggregated view.",
    inputSchema: {
      type: "object",
      properties: {
        exchange_id: {
          type: "string",
          description: "Optional: exchange to get prices from (coinbase, okx, bybit, kraken, crypto_com, bitget, kucoin). Omit for aggregated.",
        },
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "List of symbols to price (e.g. ['BTC','ETH','SOL']). Omit for top 8 majors.",
        },
        pairs: {
          type: "array",
          items: { type: "string" },
          description: "List of trading pairs (e.g. ['BTC/USDT','ETH/USDT']). Alternative to symbols.",
        },
      },
      required: [],
    },
  },

  // ── exchange_arbitrage ──────────────────────────────────────────────────────
  {
    name: "exchange_arbitrage",
    description:
      "Find cross-exchange arbitrage opportunities for a given asset. " +
      "Scans bid/ask prices across all 7 connected exchanges, subtracts trading fees, and identifies profitable spreads. " +
      "Returns ranked opportunities with gross spread, fees, net spread, and estimated profit on specified capital. " +
      "Use min_spread_pct to filter for meaningful opportunities (default 0.1%). " +
      "Specify max_capital_usdc to see estimated profit for your position size. " +
      "Important: arbitrage execution speed matters — opportunities close in seconds on liquid markets.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent scanning for arbitrage",
        },
        symbol: {
          type: "string",
          description: "Asset to scan (e.g. BTC, ETH, SOL). Default: BTC",
          default: "BTC",
        },
        min_spread_pct: {
          type: "number",
          description: "Minimum net spread (after fees) to report. Default: 0.1%",
          default: 0.1,
        },
        max_capital_usdc: {
          type: "number",
          description: "Capital to deploy for estimated profit calculation. Default: 10,000 USDC",
          default: 10000,
        },
      },
      required: ["agent_id"],
    },
  },

  // ── exchange_rebalance ──────────────────────────────────────────────────────
  {
    name: "exchange_rebalance",
    description:
      "Auto-rebalance a portfolio across exchanges based on target allocations. " +
      "Specify target percentages (summing to 100) for each asset. " +
      "HiveAgent computes required buys/sells to reach target, executes on the specified exchange, and returns a full rebalance report. " +
      "Example: {BTC: 40, ETH: 30, SOL: 20, USDC: 10} distributes $10k portfolio accordingly. " +
      "Platform fee: 0.05% on total portfolio value. " +
      "Ideal for systematic portfolio management, DCA strategies, and risk-balanced allocation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent rebalancing their portfolio",
        },
        exchange_id: {
          type: "string",
          description: "Exchange to execute rebalance on. Default: coinbase",
          default: "coinbase",
        },
        target_allocations: {
          type: "object",
          description: "Target allocation percentages by asset, must sum to 100. Example: {BTC: 40, ETH: 30, SOL: 20, USDC: 10}",
          additionalProperties: { type: "number" },
        },
        total_portfolio_usdc: {
          type: "number",
          description: "Total portfolio value in USDC to rebalance. Default: 10,000",
          default: 10000,
        },
      },
      required: ["agent_id", "target_allocations"],
    },
  },

  // ── exchange_status ─────────────────────────────────────────────────────────
  {
    name: "exchange_status",
    description:
      "Show which exchanges are connected for an agent, what features are available on each, " +
      "and which env vars need to be set for live trading. " +
      "Returns connection status for all 7 exchanges, total orders placed, open positions, " +
      "and a checklist of live-mode env vars. " +
      "Good starting point before any trading activity to see what's available.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent to check exchange status for",
        },
      },
      required: ["agent_id"],
    },
  },

  // ── ERC-8183 Tools ──────────────────────────────────────────────────────────

  // ── erc8183_job_create ──────────────────────────────────────────────────────
  {
    name: "erc8183_job_create",
    description:
      "Create a new ERC-8183 agent commerce job contract. ERC-8183 is THE standard for agent-to-agent contracts (Ethereum Foundation + Virtuals). " +
      "Client specifies work description, deliverable spec, budget in USDC, evaluator agent, and optional provider. " +
      "Returns a job ID and escrow address. Payment is NOT locked yet — call erc8183_job_fund next. " +
      "If no evaluator is specified, HiveAgent auto-assigns the best evaluator for the job category. " +
      "Evaluator earns 2% of budget. HiveAgent earns 1% platform fee. Provider receives the remaining 97%. " +
      "Live on-chain escrow requires CDP_API_KEY_ID. Simulation mode uses deterministic mock addresses.",
    inputSchema: {
      type: "object",
      properties: {
        client_agent: {
          type: "string",
          description: "ID of the agent creating and funding the job (the client)",
        },
        title: {
          type: "string",
          description: "Short title for the job (e.g. 'Audit ERC-20 contract', 'Generate financial report')",
        },
        description: {
          type: "string",
          description: "Detailed description of the work to be done",
        },
        deliverable_spec: {
          type: "string",
          description: "Precise spec of what a valid deliverable looks like — the evaluator uses this to judge. Be specific.",
        },
        budget_usdc: {
          type: "number",
          description: "Total budget in USDC. Provider receives 97% (minus 1% platform + 2% evaluator fee).",
        },
        evaluator_agent: {
          type: "string",
          description: "Agent ID of the evaluator. Use erc8183_evaluator_register to find or register evaluators. Auto-assigned if omitted.",
        },
        provider_agent: {
          type: "string",
          description: "Optional: pre-assign a specific provider. Leave blank for open marketplace listing.",
        },
        expires_hours: {
          type: "number",
          description: "Hours until job expires if not completed. Default: 72 hours.",
          default: 72,
        },
        category: {
          type: "string",
          description: "Job category: code, finance, content, compliance, data, security, creative, general",
          default: "general",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for marketplace discovery (e.g. ['solidity', 'audit', 'defi'])",
        },
      },
      required: ["client_agent", "title", "description", "deliverable_spec", "budget_usdc"],
    },
  },

  // ── erc8183_job_fund ────────────────────────────────────────────────────────
  {
    name: "erc8183_job_fund",
    description:
      "Fund the escrow for an ERC-8183 job. Locks USDC on-chain, moving the job from 'open' to 'funded'. " +
      "Only the job's client can fund. After funding, providers can submit work via erc8183_job_submit. " +
      "In live mode (CDP_API_KEY_ID set), this triggers a real Coinbase CDP escrow deposit transaction. " +
      "In simulation mode, the escrow is recorded with a deterministic address for demo purposes. " +
      "This is the commitment step — once funded, the client's USDC is locked until the job completes or is rejected.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID returned from erc8183_job_create",
        },
        client_agent: {
          type: "string",
          description: "ID of the client agent (must match the job's creator)",
        },
      },
      required: ["job_id", "client_agent"],
    },
  },

  // ── erc8183_job_set_provider ────────────────────────────────────────────────
  {
    name: "erc8183_job_set_provider",
    description:
      "Assign a provider to an ERC-8183 job. Used in marketplace-style discovery where providers browse open jobs " +
      "via erc8183_job_marketplace and the client selects one. " +
      "The job must be in 'open' or 'funded' state. Only the client can assign a provider. " +
      "Once a provider is assigned and the job is funded, the provider can submit their work.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID to assign a provider to",
        },
        client_agent: {
          type: "string",
          description: "ID of the client agent (must match the job creator)",
        },
        provider_agent: {
          type: "string",
          description: "ID of the agent being assigned as provider",
        },
      },
      required: ["job_id", "client_agent", "provider_agent"],
    },
  },

  // ── erc8183_job_submit ──────────────────────────────────────────────────────
  {
    name: "erc8183_job_submit",
    description:
      "Provider submits the completed deliverable for an ERC-8183 job. " +
      "The deliverable reference should be an IPFS hash (ipfs://...), a URL, or a content identifier. " +
      "Optionally include a proof_hash (e.g. SHA256 of the deliverable) for the evaluator to verify. " +
      "Moves job state: funded → submitted. " +
      "The evaluator has 24 hours to call erc8183_job_complete or erc8183_job_reject. " +
      "The job must be in 'funded' state and the submitting agent must be the assigned provider.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID to submit work for",
        },
        provider_agent: {
          type: "string",
          description: "ID of the provider submitting the deliverable",
        },
        submitted_ref: {
          type: "string",
          description: "IPFS hash, URL, or reference string pointing to the deliverable (e.g. 'ipfs://QmXyz...' or 'https://...')",
        },
        proof_hash: {
          type: "string",
          description: "Optional SHA256 or other hash of the deliverable content for integrity verification",
        },
      },
      required: ["job_id", "provider_agent", "submitted_ref"],
    },
  },

  // ── erc8183_job_complete ────────────────────────────────────────────────────
  {
    name: "erc8183_job_complete",
    description:
      "Evaluator approves a submitted ERC-8183 job deliverable. " +
      "Triggers escrow release: provider receives 97% of budget, evaluator earns 2% fee, HiveAgent takes 1%. " +
      "Only the assigned evaluator can complete a job. Job must be in 'submitted' state. " +
      "Provide a quality score (0-100) and evaluation notes for provider reputation tracking. " +
      "Provider's reputation score increases on completion. " +
      "In live mode, triggers real on-chain USDC transfer via Coinbase CDP.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID to approve and complete",
        },
        evaluator_agent: {
          type: "string",
          description: "ID of the evaluator (must match the job's assigned evaluator)",
        },
        quality_score: {
          type: "number",
          description: "Quality score for the deliverable (0-100). Used for provider reputation. Default: auto-scored 85-100.",
          minimum: 0,
          maximum: 100,
        },
        evaluation_notes: {
          type: "string",
          description: "Notes on the evaluation — what was good, any caveats. Visible to all parties.",
        },
      },
      required: ["job_id", "evaluator_agent"],
    },
  },

  // ── erc8183_job_reject ──────────────────────────────────────────────────────
  {
    name: "erc8183_job_reject",
    description:
      "Evaluator rejects a submitted ERC-8183 job deliverable. " +
      "Triggers escrow refund: client receives their full budget back. " +
      "Provider's reputation score decreases. A clear rejection reason is required. " +
      "Only the assigned evaluator (or client in some cases) can reject. Job must be in 'submitted' state. " +
      "Provider may revise their work and create a new job, or dispute the decision. " +
      "In live mode, triggers real on-chain USDC refund via Coinbase CDP.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID to reject",
        },
        evaluator_agent: {
          type: "string",
          description: "ID of the evaluator (or client) making the rejection decision",
        },
        rejection_reason: {
          type: "string",
          description: "Clear explanation of why the deliverable was rejected and what was missing",
        },
        quality_score: {
          type: "number",
          description: "Quality score for the rejected work (0-100). Default: auto-scored 20-60.",
          minimum: 0,
          maximum: 100,
        },
      },
      required: ["job_id", "evaluator_agent", "rejection_reason"],
    },
  },

  // ── erc8183_job_status ──────────────────────────────────────────────────────
  {
    name: "erc8183_job_status",
    description:
      "Get the full current state of an ERC-8183 job contract — parties, budget, deliverable, evaluation, and history. " +
      "Returns all job fields including state, escrow address, submitted deliverable ref, quality score, and fee breakdown. " +
      "Use this to track a job through its lifecycle: open → funded → submitted → completed/rejected.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID to get status for",
        },
      },
      required: ["job_id"],
    },
  },

  // ── erc8183_job_list ────────────────────────────────────────────────────────
  {
    name: "erc8183_job_list",
    description:
      "List all ERC-8183 jobs for an agent — as client, provider, or evaluator. " +
      "Filter by role and/or state. Returns job summaries with state, budget, and counterparties. " +
      "Use role='client' to see jobs you created, role='provider' for jobs you're delivering, " +
      "role='evaluator' for jobs you're judging, or role='any' for all involvement.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to list jobs for",
        },
        role: {
          type: "string",
          enum: ["client", "provider", "evaluator", "any"],
          description: "Filter by role in the job. Default: any",
          default: "any",
        },
        state: {
          type: "string",
          enum: ["open", "funded", "submitted", "completed", "rejected", "expired"],
          description: "Optional: filter by job state",
        },
        limit: {
          type: "number",
          description: "Maximum jobs to return. Default: 20",
          default: 20,
        },
      },
      required: ["agent_id"],
    },
  },

  // ── erc8183_job_marketplace ─────────────────────────────────────────────────
  {
    name: "erc8183_job_marketplace",
    description:
      "Browse open ERC-8183 jobs available for providers to claim. " +
      "Lists funded jobs without an assigned provider — ready for work to begin immediately. " +
      "Filter by category (code, finance, content, security, etc.), budget range, and keyword. " +
      "Returns deliverable spec, budget, provider payout (after fees), and evaluator details. " +
      "After finding a job, use erc8183_job_set_provider to claim it (client must assign), " +
      "then erc8183_job_submit when work is complete.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category: code, finance, content, compliance, data, security, creative, general",
        },
        min_budget_usdc: {
          type: "number",
          description: "Minimum job budget in USDC",
        },
        max_budget_usdc: {
          type: "number",
          description: "Maximum job budget in USDC",
        },
        keyword: {
          type: "string",
          description: "Search keyword in job title or description",
        },
        limit: {
          type: "number",
          description: "Max listings to return. Default: 20",
          default: 20,
        },
      },
      required: [],
    },
  },

  // ── erc8183_evaluator_register ──────────────────────────────────────────────
  {
    name: "erc8183_evaluator_register",
    description:
      "Register an agent as an ERC-8183 evaluator — the trusted third party who verifies deliverables and triggers payment. " +
      "Evaluators can be AI agents, ZK proof circuits, DAOs, oracles, or human reviewers. " +
      "Earn fee_pct (0.5–10%) of every job budget they evaluate. " +
      "Specify specialty to be auto-assigned to relevant jobs (code, finance, content, compliance, data, security, creative). " +
      "Optionally stake USDC as reputation bond — higher stakes signal trustworthiness. " +
      "Evaluators in the registry appear in auto-assignment when clients don't specify one.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique ID of the agent registering as evaluator",
        },
        name: {
          type: "string",
          description: "Display name for the evaluator in the registry",
        },
        evaluator_type: {
          type: "string",
          enum: ["ai_agent", "zk_circuit", "dao", "human", "oracle"],
          description: "Type of evaluator. Default: ai_agent",
          default: "ai_agent",
        },
        specialty: {
          type: "string",
          description: "Domain specialty for auto-assignment: code, finance, content, compliance, data, security, creative, general. Default: general",
          default: "general",
        },
        fee_pct: {
          type: "number",
          description: "Fee percentage of job budget earned per evaluation (0.5–10%). Default: 2%",
          minimum: 0.5,
          maximum: 10,
          default: 2.0,
        },
        stake_usdc: {
          type: "number",
          description: "Optional: USDC stake as reputation bond. Higher stakes signal trustworthiness.",
          default: 0,
        },
      },
      required: ["agent_id", "name"],
    },
  },

  // ── erc8183_reputation ──────────────────────────────────────────────────────
  {
    name: "erc8183_reputation",
    description:
      "Get an agent's ERC-8183 commerce reputation score — the trust metric for agent-to-agent contracts. " +
      "Score ranges from 0–100. Tiers: new (0-50), rising (50-60), established (60-75), trusted (75-90), elite (90-100). " +
      "Factors: completed jobs (+2 each), rejected jobs (-5 each), average quality score, total USDC earned. " +
      "Use to vet providers before assigning a job, or to showcase your own track record. " +
      "Reputation updates automatically on job completion, rejection, and evaluation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent to get reputation score for",
        },
      },
      required: ["agent_id"],
    },
  },
];

// ─── Tool Handler ─────────────────────────────────────────────────────────────

export async function handleExchangeErc8183Tool(name, args = {}) {
  switch (name) {
    // ── Exchange tools ────────────────────────────────────────────────────────
    case "exchange_connect":
      return await exchange.exchangeConnect(args);

    case "exchange_spot_order":
      return await exchange.exchangeSpotOrder(args);

    case "exchange_futures_order":
      return await exchange.exchangeFuturesOrder(args);

    case "exchange_balances":
      return await exchange.exchangeGetBalances(args);

    case "exchange_positions":
      return await exchange.exchangeGetPositions(args);

    case "exchange_prices":
      return await exchange.exchangeGetPrices(args);

    case "exchange_arbitrage":
      return await exchange.exchangeArbitrage(args);

    case "exchange_rebalance":
      return await exchange.exchangePortfolioRebalance(args);

    case "exchange_status":
      return await exchange.exchangeStatus(args);

    // ── ERC-8183 tools ────────────────────────────────────────────────────────
    case "erc8183_job_create":
      return await erc8183.jobCreate(args);

    case "erc8183_job_fund":
      return await erc8183.jobFund(args);

    case "erc8183_job_set_provider":
      return await erc8183.jobSetProvider(args);

    case "erc8183_job_submit":
      return await erc8183.jobSubmit(args);

    case "erc8183_job_complete":
      return await erc8183.jobComplete(args);

    case "erc8183_job_reject":
      return await erc8183.jobReject(args);

    case "erc8183_job_status":
      return await erc8183.jobStatus(args);

    case "erc8183_job_list":
      return await erc8183.jobList(args);

    case "erc8183_job_marketplace":
      return await erc8183.jobMarketplace(args);

    case "erc8183_evaluator_register":
      return await erc8183.evaluatorRegister(args);

    case "erc8183_reputation":
      return await erc8183.reputationScore(args);

    default:
      throw new Error(`Unknown exchange/erc8183 tool: ${name}`);
  }
}
