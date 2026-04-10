/**
 * HiveAgent MCP Tools — Plaid Banking + Bankr x402 Cloud
 *
 * Signal: Perplexity connects Plaid (Apr 10, 2026) — HiveAgent bridges Plaid
 * to every payment rail so agents see the full financial picture.
 *
 * Signal: Bankr launches x402 Cloud (Apr 10, 2026, scanner score 8/10) —
 * deploy any API as a paid x402 endpoint with hosting + agent discovery.
 *
 * 11 tools:
 *   plaid_connect             — link bank accounts, unlock real balances
 *   plaid_balances            — see all balances, net worth, debt, idle cash
 *   plaid_transactions        — transaction history + spending by category
 *   plaid_optimize_route      — THE MAGIC: pick cheapest/fastest payment rail
 *   plaid_spending_insights   — AI spending analysis + yield opportunity
 *   plaid_status              — Plaid integration overview + MCP server URL
 *
 *   bankr_deploy_service      — deploy any API as paid x402 endpoint
 *   bankr_my_services         — all your deployed services + revenue
 *   bankr_discover            — find x402-powered services from all agents
 *   bankr_revenue             — revenue breakdown + call analytics
 *   bankr_status              — platform overview + total revenue flowing
 */

import {
  connectBank,
  getBalances,
  getTransactions,
  optimizePaymentRoute,
  getSpendingInsights,
  plaidStatus,
} from "./services/plaid-banking.js";

import {
  deployService,
  listMyServices,
  discoverServices,
  getServiceRevenue,
  bankrStatus,
} from "./services/bankr-x402.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const plaidBankrTools = [
  // ── Plaid Banking ────────────────────────────────────────────────────────

  {
    name:        "plaid_connect",
    description: "Link a bank account via Plaid so your agent can see real balances and route payments intelligently. Works with Chase, BofA, Wells Fargo, and 11,000+ other institutions. Simulation mode returns realistic data instantly. Live mode (PLAID_CLIENT_ID required) initiates the secure OAuth flow.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string",  description: "Your agent's unique identifier" },
        institution:  { type: "string",  description: "Bank name (e.g. 'Chase', 'Bank of America', 'Wells Fargo')" },
        account_type: { type: "string",  description: "Account type: 'checking', 'savings', or 'credit'", enum: ["checking", "savings", "credit"] },
      },
      required: ["agent_id"],
    },
  },

  {
    name:        "plaid_balances",
    description: "Get all connected bank account balances for an agent — checking, savings, credit cards, and loans. Returns net worth, total available liquidity, total debt, and a yield insight: how much idle savings could be earning in stablecoin yield (4-12% APY) vs sitting in a bank account (0.01%).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent's unique identifier" },
      },
      required: ["agent_id"],
    },
  },

  {
    name:        "plaid_transactions",
    description: "Fetch transaction history across all connected bank accounts. Returns raw transactions, spending broken down by category, top merchants, and monthly spend rate. Filter by account, days, or category. Perfect for budget tracking, reconciliation, and spending pattern analysis.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string",  description: "Your agent's unique identifier" },
        connection_id: { type: "string",  description: "Specific account ID to filter by (optional)" },
        days:          { type: "integer", description: "Number of days of history to fetch (default: 30)" },
        category:      { type: "string",  description: "Filter by category: 'groceries', 'dining', 'travel', 'subscriptions', 'shopping', 'gas', 'health', 'income', 'payment'" },
      },
      required: ["agent_id"],
    },
  },

  {
    name:        "plaid_optimize_route",
    description: "THE MAGIC TOOL. Your agent has bank accounts + USDC wallets + card rails. This tool analyzes all available funding sources and picks the cheapest, fastest route for any payment. Compares ACH (cheap, slow), USDC (instant, 0.1%), credit card (instant, 2.9%), and BVNK channel (fast, 0.1%). Saves up to 96% vs defaulting to card. Pass urgency='instant' for speed, urgency='economy' for lowest cost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string",  description: "Your agent's unique identifier" },
        payment_amount: { type: "number",  description: "Amount to pay in USD" },
        payment_to:     { type: "string",  description: "Who you're paying (name or description)" },
        urgency:        { type: "string",  description: "Payment urgency: 'instant', 'standard', or 'economy'", enum: ["instant", "standard", "economy"] },
      },
      required: ["agent_id", "payment_amount"],
    },
  },

  {
    name:        "plaid_spending_insights",
    description: "AI-powered spending analysis across all connected bank accounts. Detects anomalies (unusually large transactions), suggests category budgets, surfaces idle savings earning nothing, and calculates the exact yield opportunity if idle cash were moved to stablecoin yield (7% APY estimate). Use to identify where your agent or users are leaking money.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent's unique identifier" },
        period:   { type: "string", description: "Analysis period: '7d', '30d', or '90d' (default: '30d')", enum: ["7d", "30d", "90d"] },
      },
      required: ["agent_id"],
    },
  },

  {
    name:        "plaid_status",
    description: "Get Plaid integration status, the live MCP server URL (https://api.dashboard.plaid.com/mcp), supported institutions (11,000+), supported products, and setup instructions. Shows whether HiveAgent is running in live or simulation mode.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Bankr x402 Cloud ─────────────────────────────────────────────────────

  {
    name:        "bankr_deploy_service",
    description: "Deploy any API endpoint as a monetized x402 service on Bankr Cloud. Set a USDC price per call. Your service gets a managed URL, an x402 payment challenge endpoint, and is automatically listed in the HiveAgent discovery directory. Any agent can then find and pay for your service. Revenue flows to your wallet per call — no invoices, no payment processor, no delay.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:            { type: "string", description: "Your agent's unique identifier" },
        service_name:        { type: "string", description: "Name of the service (e.g. 'NFT Price Oracle', 'Legal Doc Summarizer')" },
        description:         { type: "string", description: "What the service does — be specific, agents read this to decide whether to call it" },
        price_per_call_usdc: { type: "number", description: "Price in USDC per API call (e.g. 0.001 for micro, 0.05 for premium)" },
        category:            { type: "string", description: "Service category: 'analytics', 'data', 'ai_services', 'finance', 'compliance', 'compute', 'general'" },
        endpoint_logic:      { type: "string", description: "Optional: describe what the endpoint does (for documentation)" },
      },
      required: ["agent_id", "service_name"],
    },
  },

  {
    name:        "bankr_my_services",
    description: "List all x402 services you've deployed on Bankr Cloud, with revenue stats, call counts, uptime, and live URLs. See which services are earning and which need promotion.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Your agent's unique identifier" },
      },
      required: ["agent_id"],
    },
  },

  {
    name:        "bankr_discover",
    description: "Discover x402-powered services deployed by agents across the HiveAgent network. Filter by category or max price. Results are ranked by call volume — the most-used services rise to the top. Use this to find capabilities you can pay for instead of building from scratch.",
    inputSchema: {
      type: "object",
      properties: {
        category:  { type: "string", description: "Filter by category: 'analytics', 'data', 'ai_services', 'finance', 'compliance', 'compute', 'general'" },
        max_price: { type: "number", description: "Maximum price per call in USDC (e.g. 0.01 for cheap, 0.1 for premium)" },
        query:     { type: "string", description: "Keyword search across service names and descriptions" },
      },
    },
  },

  {
    name:        "bankr_revenue",
    description: "Get detailed revenue analytics for a specific x402 service: total USDC earned, call count, average daily revenue, and projected monthly/annual run rate.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service ID returned from bankr_deploy_service or bankr_my_services" },
      },
      required: ["service_id"],
    },
  },

  {
    name:        "bankr_status",
    description: "Platform overview for Bankr x402 Cloud: total services deployed across all agents, total USDC revenue flowing through the network, settlement model, supported regions, and setup instructions (set BANKR_API_KEY to go live).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePlaidBankrTool(name, args = {}) {
  switch (name) {
    // Plaid Banking
    case "plaid_connect":           return await connectBank(args);
    case "plaid_balances":          return await getBalances(args);
    case "plaid_transactions":      return await getTransactions(args);
    case "plaid_optimize_route":    return await optimizePaymentRoute(args);
    case "plaid_spending_insights": return await getSpendingInsights(args);
    case "plaid_status":            return plaidStatus();

    // Bankr x402 Cloud
    case "bankr_deploy_service":    return await deployService(args);
    case "bankr_my_services":       return await listMyServices(args);
    case "bankr_discover":          return await discoverServices(args);
    case "bankr_revenue":           return await getServiceRevenue(args);
    case "bankr_status":            return bankrStatus();

    default:
      throw new Error(`Unknown Plaid/Bankr tool: ${name}`);
  }
}
