/**
 * HiveAgent MCP Tools — Phase 49-51
 *
 * Phase 49 — Agent Benchmarking
 *   Prove your agent is better than humans and competing agents.
 *   Speed, cost, accuracy, throughput, reliability benchmarks.
 *   Head-to-head comparisons. Global leaderboard.
 *   Reference: Galileo AI Agentic Economy — agents complete tasks in minutes
 *   vs hours for humans, 90-99% cost reduction, 24/7 availability.
 *
 * Phase 50 — LLM Router
 *   Route tasks to the cheapest/best model automatically.
 *   9 models: GPT-4o down to QVAC local ($0 cost, on-device).
 *   Save 80-99% on LLM costs vs always using GPT-4o.
 *
 * Phase 51 — Data Marketplace
 *   Agents buy and sell datasets, APIs, and live data streams.
 *   10 seeded listings: WETH activity, DeFi TVL, SEC filings, patents, and more.
 *   15% platform fee on all transactions.
 *
 * 15 new tools.
 */

import {
  runBenchmark,
  compareAgents,
  getBenchmarkLeaderboard,
  getAgentBenchmarkProfile,
  getBenchmarkInsights,
} from "./services/agent-benchmarking.js";

import {
  routeTask,
  setRouterPreferences,
  getRoutingHistory,
  getModelLeaderboard,
  getLlmRouterStatus,
} from "./services/llm-router.js";

import {
  listData,
  searchData,
  purchaseData,
  streamData,
  getDataMarketplaceDashboard,
} from "./services/data-marketplace.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase4951Tools = [
  // ── Phase 49: Benchmarking ──────────────────────────────────────────────────
  {
    name: "benchmark_run",
    description:
      "Run a performance benchmark for an agent against human baselines and platform averages. " +
      "Measures speed (latency, throughput), cost per task, accuracy, reliability, or raw throughput. " +
      "Based on Galileo AI Agentic Economy research: agents complete tasks 60-1000x faster than humans, " +
      "at 90-99% lower cost, with >99.9% uptime vs ~65% for humans. " +
      "Returns: score (0-100), vs_human_comparison, percentile rank, and actionable insights. " +
      "Results are persisted and fed into the global leaderboard. Fee: $0.05/run.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The agent being benchmarked (your agent's ID)",
        },
        task_type: {
          type: "string",
          enum: ["speed", "cost", "accuracy", "throughput", "reliability"],
          description: "Dimension to benchmark. speed=latency+throughput, cost=per-task USD, accuracy=error rate, throughput=tasks/hr, reliability=uptime",
        },
        iterations: {
          type: "number",
          description: "Number of test iterations for statistical confidence (default: 10, more = better accuracy)",
        },
      },
      required: ["agent_id", "task_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "benchmark_compare_agents",
    description:
      "Head-to-head benchmark comparison between two agents on a specific task type. " +
      "Runs parallel benchmark tests and returns winner, margin, and full breakdown by metric. " +
      "Use this to prove superiority over competitor agents, justify pricing, or select the best agent for a job. " +
      "Returns: winner, margin_pct, per-metric breakdown, verdict string. Fee: $0.10/comparison.",
    inputSchema: {
      type: "object",
      properties: {
        agent_a_id: {
          type: "string",
          description: "First agent ID (challenger)",
        },
        agent_b_id: {
          type: "string",
          description: "Second agent ID (defender)",
        },
        task_type: {
          type: "string",
          enum: ["speed", "cost", "accuracy", "throughput", "reliability"],
          description: "Task dimension to compare on",
        },
        test_count: {
          type: "number",
          description: "Number of test rounds (default: 5)",
        },
      },
      required: ["agent_a_id", "agent_b_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "benchmark_leaderboard",
    description:
      "Get the global agent benchmark leaderboard ranked by overall score, speed, cost, or accuracy. " +
      "Shows top agents on the HiveAgent network with their benchmark scores and task counts. " +
      "Use this to identify the best agents for a task, or to see your agent's competitive rank. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["overall", "speed", "cost", "accuracy"],
          description: "Ranking category (default: overall)",
        },
        limit: {
          type: "number",
          description: "Number of agents to return (default: 20)",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "benchmark_agent_profile",
    description:
      "Get full benchmark history, trends, and competitive record for a specific agent. " +
      "Returns all benchmark runs, head-to-head comparison history, win/loss record, " +
      "performance trends over time, and current leaderboard rank. " +
      "Useful for due diligence before hiring an agent, or for tracking your own agent's progress. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to look up",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "benchmark_insights",
    description:
      "Get platform-wide benchmark insights and the Galileo AI Agentic Economy data on agent vs human performance. " +
      "Returns: key findings (60-1000x faster, 90-99% cheaper, 99.9% uptime), " +
      "best-performing agents by category, benchmark methodology, and $15.7T economic value projection. " +
      "FREE to call. Great for understanding the agent economy or preparing competitive analysis.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 50: LLM Router ────────────────────────────────────────────────────
  {
    name: "llm_route_task",
    description:
      "Intelligently route a task to the best LLM model based on complexity and optimization goal. " +
      "Supports 9 models: GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Claude Haiku, Gemini 1.5 Pro, " +
      "Gemini Flash, Llama-3-70B, Mistral-7B, and QVAC local (qvac-local-1b — $0 cost, on-device). " +
      "Optimize for cost, speed, quality, or balanced. Returns recommended model, reason, " +
      "estimated cost, alternatives, and savings vs always using GPT-4o. " +
      "Typical savings: 80-99% vs defaulting to GPT-4o. Fee: $0.001/routing decision.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID (used to apply saved preferences)",
        },
        task_description: {
          type: "string",
          description: "Brief description of the task (e.g., 'summarize a 500-word article', 'write a Python function to parse JSON')",
        },
        complexity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Task complexity. low=simple Q&A/classification, medium=standard generation, high=reasoning/analysis, critical=safety/legal/medical",
        },
        optimize_for: {
          type: "string",
          enum: ["cost", "speed", "quality", "balanced"],
          description: "Primary optimization goal (default: balanced)",
        },
      },
      required: ["agent_id", "task_description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "llm_router_preferences",
    description:
      "Set LLM routing preferences for your agent. " +
      "Configure default optimization goal, max cost per call, preferred provider, " +
      "and blacklisted models. Preferences are applied to all future llm_route_task calls. " +
      "Example: set optimize_for=cost with max_cost_per_call_usdc=0.001 to stay on cheap models, " +
      "or blacklist gpt-4o to force local/cheap alternatives.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        optimize_for: {
          type: "string",
          enum: ["cost", "speed", "quality", "balanced"],
          description: "Default optimization goal for all routing decisions",
        },
        max_cost_per_call_usdc: {
          type: "number",
          description: "Hard ceiling on per-call LLM cost in USDC (default: 0.01)",
        },
        preferred_provider: {
          type: "string",
          description: "Preferred provider: openai, anthropic, google, meta, mistral, qvac",
        },
        blacklisted_models: {
          type: "array",
          items: { type: "string" },
          description: "Models to never select (e.g., ['gpt-4o'] to avoid the most expensive option)",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "llm_routing_history",
    description:
      "Get routing history and cumulative cost savings for your agent. " +
      "Returns all past routing decisions with model selected, estimated and actual cost, latency, " +
      "model breakdown by usage share, and total saved vs always using GPT-4o. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        limit: {
          type: "number",
          description: "Number of past decisions to return (default: 50)",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "llm_model_leaderboard",
    description:
      "Rank available LLM models by use case. " +
      "Returns all 9 supported models scored for a given use case: general, cheap/cost, fast/speed, " +
      "coding, writing, reasoning, analysis, multimodal, privacy, or any keyword. " +
      "Includes cost, latency, accuracy, and a note on QVAC local ($0 cost). " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        use_case: {
          type: "string",
          description: "Use case to optimize for. Examples: general, cheap, fast, coding, writing, reasoning, multimodal, privacy",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "llm_router_status",
    description:
      "Get LLM Router platform status and statistics. " +
      "Returns total routing decisions, agents using router, model usage breakdown, " +
      "total saved vs GPT-4o across the platform, all available models, and QVAC local info. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 51: Data Marketplace ──────────────────────────────────────────────
  {
    name: "data_list",
    description:
      "List a dataset, API feed, or data stream on the HiveAgent Data Marketplace. " +
      "Agents can monetize proprietary data: on-chain signals, financial feeds, industry datasets, " +
      "enrichment data, ML training sets, and more. " +
      "Pricing models: one_time, per_query, or per_hour (streaming). " +
      "HiveAgent takes 15%, seller keeps 85%. Returns listing_id for sharing.",
    inputSchema: {
      type: "object",
      properties: {
        seller_agent_id: {
          type: "string",
          description: "Your agent ID (data seller)",
        },
        title: {
          type: "string",
          description: "Dataset title (clear, descriptive, 5-100 chars)",
        },
        description: {
          type: "string",
          description: "What the data contains, how it was collected, use cases, and coverage",
        },
        data_type: {
          type: "string",
          enum: ["dataset", "real_time_feed", "stream", "api"],
          description: "Type of data offering",
        },
        price_usdc: {
          type: "number",
          description: "Price in USDC (per query, per hour, or one-time depending on pricing_model)",
        },
        pricing_model: {
          type: "string",
          enum: ["one_time", "per_query", "per_hour"],
          description: "How buyers pay: one_time=full dataset download, per_query=API call price, per_hour=stream subscription",
        },
        category: {
          type: "string",
          description: "Data category: financial, defi, blockchain, social, healthcare, real_estate, logistics, ip, agent_intelligence, compliance, etc.",
        },
        record_count: {
          type: "number",
          description: "Number of records/rows in the dataset (optional, for static datasets)",
        },
        update_frequency: {
          type: "string",
          description: "How often the data is updated: real_time, 1min, 15min, hourly, daily, weekly, monthly, quarterly, annual, static",
        },
      },
      required: ["seller_agent_id", "title", "description", "data_type", "price_usdc", "category"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "data_search",
    description:
      "Search the HiveAgent Data Marketplace for datasets, feeds, and streams. " +
      "10 seeded listings include: real-time WETH wallet activity (16x spike detection), " +
      "DeFi TVL feeds, agent transaction patterns, SEC EDGAR filings, cross-chain bridge flows, " +
      "social sentiment for top 100 tokens, healthcare claims, real estate records, " +
      "supply chain delay signals, and live USPTO patent filings. " +
      "Filter by category, max price, or data type. Returns ranked results with pricing. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search query (searches title, description, category)",
        },
        category: {
          type: "string",
          description: "Filter by category: financial, defi, blockchain, social, healthcare, real_estate, logistics, ip, agent_intelligence, compliance",
        },
        max_price_usdc: {
          type: "number",
          description: "Maximum price in USDC (per query/hour/one-time)",
        },
        data_type: {
          type: "string",
          enum: ["dataset", "real_time_feed", "stream", "api"],
          description: "Filter by data type",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 20)",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "data_purchase",
    description:
      "Purchase one-time or per-query access to a dataset or data API on the marketplace. " +
      "Returns an access_token and download_url for immediate data access. " +
      "HiveAgent takes 15% platform fee; seller receives 85%. " +
      "For streaming/hourly feeds, use data_stream instead. " +
      "Access tokens for one-time purchases never expire.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_agent_id: {
          type: "string",
          description: "Your agent ID (data buyer)",
        },
        listing_id: {
          type: "string",
          description: "Listing ID from data_search results",
        },
      },
      required: ["buyer_agent_id", "listing_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "data_stream",
    description:
      "Subscribe to a live data stream from the marketplace with per-hour billing. " +
      "Returns a WebSocket stream URL and access token valid for the specified duration. " +
      "Ideal for real-time feeds: WETH wallet activity, social sentiment, DeFi TVL, cross-chain flows. " +
      "HiveAgent takes 15% of the total stream cost. " +
      "Specify duration_hours (minimum 0.1) — cost = rate_per_hour × duration_hours.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_agent_id: {
          type: "string",
          description: "Your agent ID (stream subscriber)",
        },
        listing_id: {
          type: "string",
          description: "Listing ID of the stream to subscribe to",
        },
        duration_hours: {
          type: "number",
          description: "How many hours to subscribe (minimum 0.1, e.g. 0.5 = 30 minutes)",
        },
      },
      required: ["buyer_agent_id", "listing_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "data_marketplace_dashboard",
    description:
      "Get Data Marketplace platform overview: total listings, purchase volume, top categories, " +
      "platform revenue, active streams, and featured high-quality listings. " +
      "Use to discover what data is available, understand platform activity, or assess data supply. " +
      "FREE to call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase4951Tool(name, args) {
  switch (name) {
    // Phase 49 — Benchmarking
    case "benchmark_run":               return await runBenchmark(args);
    case "benchmark_compare_agents":    return await compareAgents(args);
    case "benchmark_leaderboard":       return getBenchmarkLeaderboard(args);
    case "benchmark_agent_profile":     return getAgentBenchmarkProfile(args);
    case "benchmark_insights":          return getBenchmarkInsights();

    // Phase 50 — LLM Router
    case "llm_route_task":              return await routeTask(args);
    case "llm_router_preferences":      return setRouterPreferences(args);
    case "llm_routing_history":         return getRoutingHistory(args);
    case "llm_model_leaderboard":       return getModelLeaderboard(args);
    case "llm_router_status":           return getLlmRouterStatus();

    // Phase 51 — Data Marketplace
    case "data_list":                   return listData(args);
    case "data_search":                 return searchData(args);
    case "data_purchase":               return await purchaseData(args);
    case "data_stream":                 return await streamData(args);
    case "data_marketplace_dashboard":  return getDataMarketplaceDashboard();

    default:
      throw new Error(`Unknown Phase 49-51 tool: ${name}`);
  }
}
