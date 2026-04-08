/**
 * HiveAgent Phase 19 — Next-Gen Payment Rails & Agentic Economy
 *
 * Built Apr 8, 2026 in response to breaking signals:
 *
 *   ① HandlPay (Cointelegraph) — social handles as payment rails
 *      → pay_by_handle, handle_register, handle_lookup, handle_request_payment
 *
 *   ② Circle CPN Managed Payments (announced today)
 *      → cpn_pay, cpn_add_account, cpn_enroll_service, cpn_network_info
 *
 *   ③ Merkle Science COMPASS — Base Chain now fully covered
 *      → chain_screen_address, chain_investigate_tx, chain_monitor_wallet
 *
 *   ④ Dynamic — "Agentic AI applies algorithmic trading's logic to every economic activity"
 *      → economy_benchmarks, economy_compare, economy_overview
 *
 *   Plus 4 more rails built from first principles:
 *   ⑤ Payment Streaming  — per-second USDC streams (Superfluid-style)
 *   ⑥ Split Payments     — multi-party revenue share
 *   ⑦ Stablecoin Yield   — earn on idle balances (White House cleared)
 *   ⑧ Fiat Offramp       — USDC → bank account / PayPal / card
 *
 * 42 new tools. Wired to 8 new service modules.
 */

import * as handle      from "./services/handle-payments.js";
import * as cpn         from "./services/circle-cpn.js";
import * as chainComp   from "./services/chain-compliance.js";
import * as economy     from "./services/agentic-economy.js";
import * as stream      from "./services/payment-streaming.js";
import * as split       from "./services/split-payments.js";
import * as yield_      from "./services/stablecoin-yield.js";
import * as offramp     from "./services/fiat-offramp.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase19Tools = [

  // ══════════════════════════════════════════════════════════════════
  // ① HANDLE PAYMENTS (HandlPay-style)
  // ══════════════════════════════════════════════════════════════════

  {
    name: "handle_register",
    description: "Register a payment handle (@username, ENS name, X handle, email, or phone) pointing to a USDC wallet address. Anyone can then pay you by handle — no wallet address needed.",
    inputSchema: {
      type: "object",
      properties: {
        handle:          { type: "string", description: "Handle to register. Examples: @myagent, myname.eth, x:@handle" },
        wallet_address:  { type: "string", description: "USDC wallet address this handle resolves to" },
        agent_id:        { type: "string", description: "Optional agent ID to associate" },
        display_name:    { type: "string", description: "Human-readable name" },
        bio:             { type: "string", description: "Short bio or description" },
        handle_type:     { type: "string", description: "native|ens|x_twitter|lens|farcaster|email|phone", default: "native" },
      },
      required: ["handle", "wallet_address"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "handle_lookup",
    description: "Resolve a handle to its wallet address and profile. Use before sending payment to verify the recipient.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Handle to look up (e.g. @lemonade-agent, myname.eth)" },
      },
      required: ["handle"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.001 },
  },
  {
    name: "handle_pay",
    description: "Send USDC to a handle. No wallet address required — just @handle → @handle. 0.5% fee. Supports native handles, ENS, X/Twitter, Lens, Farcaster.",
    inputSchema: {
      type: "object",
      properties: {
        from_handle: { type: "string", description: "Sender handle" },
        to_handle:   { type: "string", description: "Recipient handle" },
        amount_usd:  { type: "number", description: "Amount in USD (USDC)" },
        memo:        { type: "string", description: "Optional payment memo" },
        token:       { type: "string", description: "Token (default: USDC)", default: "USDC" },
      },
      required: ["from_handle", "to_handle", "amount_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.005 },
  },
  {
    name: "handle_request_payment",
    description: "Request payment from a handle. Sends a payment request link they can fulfill.",
    inputSchema: {
      type: "object",
      properties: {
        from_handle:   { type: "string", description: "Your handle (who is requesting)" },
        to_handle:     { type: "string", description: "Handle of who should pay" },
        amount_usd:    { type: "number", description: "Amount to request" },
        memo:          { type: "string", description: "What the payment is for" },
        expires_hours: { type: "integer", description: "Hours until request expires (default 72)", default: 72 },
      },
      required: ["from_handle", "to_handle", "amount_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "handle_history",
    description: "Get payment history for a handle.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Handle to get history for" },
        limit:  { type: "integer", description: "Max results (default 20)", default: 20 },
      },
      required: ["handle"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.001 },
  },
  {
    name: "handle_search",
    description: "Search registered handles by name or type.",
    inputSchema: {
      type: "object",
      properties: {
        query:       { type: "string", description: "Search query" },
        handle_type: { type: "string", description: "Filter by type: native|ens|x_twitter|lens|farcaster" },
        limit:       { type: "integer", default: 20 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.001 },
  },
  {
    name: "handle_stats",
    description: "Handle payment network stats: total handles, transfer volume, fees.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ② CIRCLE CPN MANAGED PAYMENTS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "cpn_pay",
    description: "Make a fiat-native USDC payment through Circle's CPN (Circle Payments Network). Stay fully fiat-native — no custody, no blockchain integration overhead. 0.25% fee. Announced by Circle Apr 8, 2026.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:            { type: "string", description: "Agent making the payment" },
        source_type:         { type: "string", description: "bank_account|wire|card|usdc_wallet" },
        destination_type:    { type: "string", description: "bank_account|wire|usdc_wallet|agent_wallet" },
        amount_usd:          { type: "number", description: "Payment amount in USD" },
        source_id:           { type: "string", description: "Optional registered source account ID" },
        destination_id:      { type: "string", description: "Optional registered destination account ID" },
        settlement_currency: { type: "string", description: "Settlement currency (default: USDC)", default: "USDC" },
        memo:                { type: "string", description: "Optional payment memo" },
      },
      required: ["agent_id", "source_type", "destination_type", "amount_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true, cost_usd: 0.005 },
  },
  {
    name: "cpn_add_account",
    description: "Register a bank account, wire destination, or USDC wallet for CPN payments.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string" },
        account_type:   { type: "string", description: "bank_account|wire|usdc_wallet" },
        bank_name:      { type: "string" },
        routing_number: { type: "string" },
        account_number: { type: "string" },
        swift_code:     { type: "string" },
        iban:           { type: "string" },
        currency:       { type: "string", default: "USD" },
        country:        { type: "string", default: "US" },
        nickname:       { type: "string" },
      },
      required: ["agent_id", "account_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "cpn_enroll_service",
    description: "Enroll in a Circle CPN Managed Service: payouts (auto-disburse), collections (accept any source), fx (real-time currency conversion), or compliance (managed AML/KYC).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string" },
        service_type: { type: "string", description: "payouts|collections|fx|compliance" },
        config:       { type: "object", description: "Optional service configuration", default: {} },
      },
      required: ["agent_id", "service_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "cpn_payment_history",
    description: "Get CPN payment history for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        limit:    { type: "integer", default: 20 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "cpn_network_info",
    description: "Get Circle CPN network capabilities, supported currencies, settlement times, and HiveAgent integration stats.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ③ CHAIN COMPLIANCE (Merkle Science COMPASS — Base L2)
  // ══════════════════════════════════════════════════════════════════

  {
    name: "chain_screen_address",
    description: "Screen a wallet address for risk before sending USDC. Returns risk score, sanctions check, mixer/darknet exposure, and recommendation. Base L2 now fully covered by Merkle Science COMPASS (Apr 8, 2026). $0.05/screen.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent requesting the screen" },
        address:  { type: "string", description: "Wallet address to screen" },
        chain:    { type: "string", description: "Chain (default: base)", default: "base" },
      },
      required: ["agent_id", "address"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true, cost_usd: 0.05 },
  },
  {
    name: "chain_investigate_tx",
    description: "Investigate a transaction: trace fund flows, classify counterparties, identify risk. Merkle Science COMPASS on Base L2. $0.10/investigation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        tx_hash:  { type: "string", description: "Transaction hash to investigate" },
        chain:    { type: "string", default: "base" },
      },
      required: ["agent_id", "tx_hash"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true, cost_usd: 0.10 },
  },
  {
    name: "chain_monitor_wallet",
    description: "Add a wallet to continuous risk monitoring. Get alerted when risk score exceeds threshold. $2/month per wallet.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:        { type: "string" },
        address:         { type: "string" },
        label:           { type: "string" },
        alert_threshold: { type: "number", description: "Risk score threshold for alerts (default 50)", default: 50 },
        chain:           { type: "string", default: "base" },
      },
      required: ["agent_id", "address"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.07 },
  },
  {
    name: "chain_risk_history",
    description: "Get risk screening and investigation history for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        limit:    { type: "integer", default: 20 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "chain_compliance_stats",
    description: "Chain compliance network stats: total screens, high-risk detected, sanctions hits, monitored wallets.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ④ AGENTIC ECONOMY INTELLIGENCE (Dynamic thesis)
  // ══════════════════════════════════════════════════════════════════

  {
    name: "economy_benchmarks",
    description: "Get cost-of-execution benchmarks: agent vs human across all verticals. See how much cheaper and faster agents are for every task type — legal, insurance, healthcare, finance, construction, and more.",
    inputSchema: {
      type: "object",
      properties: {
        vertical: { type: "string", description: "Filter by vertical: legal|insurance|healthcare|finance|construction|trade|real_estate" },
        category: { type: "string", description: "Filter by category" },
        limit:    { type: "integer", default: 20 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.05 },
  },
  {
    name: "economy_compare",
    description: "Compare agent vs human execution for a specific task. Returns cost saved, speed multiplier, and ROI at scale.",
    inputSchema: {
      type: "object",
      properties: {
        task_type: { type: "string", description: "Task description (e.g. 'contract review', 'KYC screening')" },
        vertical:  { type: "string", description: "Optional vertical filter" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.05 },
  },
  {
    name: "economy_overview",
    description: "Full agentic economy market overview: avg cost reduction across all verticals, speed multipliers, most disruptable tasks. The 'Bloomberg Terminal' for the agent economy.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0.10 },
  },
  {
    name: "economy_subscribe",
    description: "Subscribe to the Agentic Economy dashboard ($5/mo). Full benchmarks, real-time index, cost compression charts.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        plan:     { type: "string", description: "standard|pro", default: "standard" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 5.00 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ⑤ PAYMENT STREAMING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "stream_open",
    description: "Open a per-second USDC payment stream from one agent to another. Set a rate (USDC/second) and a deposit. Funds drip continuously. Great for compute-by-second, agent salaries, SLA-backed payments.",
    inputSchema: {
      type: "object",
      properties: {
        sender_id:       { type: "string" },
        receiver_id:     { type: "string" },
        rate_per_second: { type: "number", description: "USDC per second (e.g. 0.0001 = $8.64/day)" },
        deposit_usd:     { type: "number", description: "Initial USDC reserve for the stream" },
        token:           { type: "string", default: "USDC" },
        memo:            { type: "string" },
        sla_uptime_pct:  { type: "number", description: "Optional SLA — pause stream if uptime drops below this %" },
      },
      required: ["sender_id", "receiver_id", "rate_per_second", "deposit_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "stream_get",
    description: "Check a stream's status: how much has been streamed, remaining balance, current rate.",
    inputSchema: {
      type: "object",
      properties: { stream_id: { type: "string" } },
      required: ["stream_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "stream_pause",
    description: "Pause an active payment stream.",
    inputSchema: {
      type: "object",
      properties: {
        stream_id: { type: "string" },
        reason:    { type: "string" },
      },
      required: ["stream_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "stream_resume",
    description: "Resume a paused payment stream.",
    inputSchema: {
      type: "object",
      properties: { stream_id: { type: "string" } },
      required: ["stream_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "stream_cancel",
    description: "Cancel a stream and refund remaining balance to sender.",
    inputSchema: {
      type: "object",
      properties: {
        stream_id: { type: "string" },
        reason:    { type: "string" },
      },
      required: ["stream_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "stream_list",
    description: "List payment streams for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        role:     { type: "string", description: "sender|receiver|both", default: "both" },
        status:   { type: "string", description: "active|paused|completed|cancelled" },
        limit:    { type: "integer", default: 20 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "stream_stats",
    description: "Payment streaming network stats.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ⑥ SPLIT PAYMENTS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "split_create",
    description: "Create a reusable split configuration. Define how payments are divided among multiple agents (by % or fixed amount). Use for team revenue shares, platform fees, DAO distributions.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id:    { type: "string" },
        name:        { type: "string" },
        description: { type: "string" },
        recipients:  {
          type: "array",
          description: "Array of {agent_id, label, share_pct, is_fixed?} — percentages must sum to 100",
          items: { type: "object" },
        },
      },
      required: ["owner_id", "name", "recipients"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "split_execute",
    description: "Execute a split payment: pay a total amount and distribute it across recipients per the saved config or inline rules. 0.3% fee.",
    inputSchema: {
      type: "object",
      properties: {
        payer_id:          { type: "string" },
        total_usd:         { type: "number" },
        config_id:         { type: "string", description: "Use a saved split config" },
        inline_recipients: { type: "array",  description: "Or define recipients inline", items: { type: "object" } },
        memo:              { type: "string" },
      },
      required: ["payer_id", "total_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "split_get",
    description: "Get a split configuration and its recipients.",
    inputSchema: {
      type: "object",
      properties: { config_id: { type: "string" } },
      required: ["config_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "split_list",
    description: "List split configurations owned by an agent.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id: { type: "string" },
        limit:    { type: "integer", default: 20 },
      },
      required: ["owner_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "split_stats",
    description: "Split payment network stats.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ⑦ STABLECOIN YIELD
  // ══════════════════════════════════════════════════════════════════

  {
    name: "yield_strategies",
    description: "List available yield strategies for idle USDC: safe T-bill backed (~4.8% APY), balanced DeFi lending (~6.2%), aggressive LP+lending (~9.1%), Circle CPN managed (~4.2%). White House cleared (Apr 8, 2026).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "yield_open",
    description: "Open a yield account for an agent and make initial USDC deposit. Choose strategy. HiveAgent takes 10% performance fee on yield earned.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:             { type: "string" },
        strategy:             { type: "string", description: "safe|balanced|aggressive|circle_cpn", default: "safe" },
        initial_deposit_usd:  { type: "number", description: "Initial USDC deposit" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.01 },
  },
  {
    name: "yield_deposit",
    description: "Add USDC to an existing yield account.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string" },
        amount_usd: { type: "number" },
      },
      required: ["agent_id", "amount_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.001 },
  },
  {
    name: "yield_withdraw",
    description: "Withdraw yield or principal from a yield account.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string" },
        amount_usd:    { type: "number" },
        withdraw_type: { type: "string", description: "yield|principal", default: "yield" },
      },
      required: ["agent_id", "amount_usd"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0.001 },
  },
  {
    name: "yield_balance",
    description: "Get yield account balance, accrued earnings, and strategy details.",
    inputSchema: {
      type: "object",
      properties: { agent_id: { type: "string" } },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "yield_stats",
    description: "Stablecoin yield network stats: total TVL, active accounts, fees earned.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },

  // ══════════════════════════════════════════════════════════════════
  // ⑧ FIAT OFFRAMP
  // ══════════════════════════════════════════════════════════════════

  {
    name: "offramp_quote",
    description: "Get a quote for offramping USDC to fiat (USD, EUR, etc.). See fees and settlement times for ACH, wire, PayPal, Venmo, Wise, or debit card before committing.",
    inputSchema: {
      type: "object",
      properties: {
        usdc_amount: { type: "number" },
        dest_type:   { type: "string", description: "ach|wire|paypal|venmo|wise|debit_card" },
        currency:    { type: "string", default: "USD" },
      },
      required: ["usdc_amount", "dest_type"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "offramp_add_destination",
    description: "Register a fiat destination: bank account (ACH), wire, PayPal, Venmo, Wise, or debit card.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string" },
        dest_type:      { type: "string", description: "ach|wire|paypal|venmo|wise|debit_card" },
        label:          { type: "string" },
        masked_details: { type: "string", description: "Last 4 digits, email domain, etc. for display" },
        currency:       { type: "string", default: "USD" },
        country:        { type: "string", default: "US" },
      },
      required: ["agent_id", "dest_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "offramp_execute",
    description: "Offramp USDC to fiat. Agent earns USDC → lands in real bank account / PayPal / card. Powered by Circle CPN.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string" },
        usdc_amount:    { type: "number" },
        dest_type:      { type: "string", description: "ach|wire|paypal|venmo|wise|debit_card" },
        destination_id: { type: "string", description: "Optional registered destination ID" },
        currency:       { type: "string", default: "USD" },
      },
      required: ["agent_id", "usdc_amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true, cost_usd: 0.01 },
  },
  {
    name: "offramp_methods",
    description: "List all available fiat offramp methods with fees, limits, and settlement times.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "offramp_history",
    description: "Get offramp transaction history for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        limit:    { type: "integer", default: 20 },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
  {
    name: "offramp_stats",
    description: "Fiat offramp network stats.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, cost_usd: 0 },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase19Tool(name, args) {
  switch (name) {

    // ── Handle Payments ─────────────────────────────────────────────
    case "handle_register":         return handle.registerHandle(args);
    case "handle_lookup":           return handle.lookupHandle(args);
    case "handle_pay":              return handle.payByHandle(args);
    case "handle_request_payment":  return handle.requestPayment(args);
    case "handle_history":          return handle.getHandleHistory(args);
    case "handle_search":           return handle.searchHandles(args);
    case "handle_stats":            return handle.getHandleStats();

    // ── Circle CPN ──────────────────────────────────────────────────
    case "cpn_pay":                 return cpn.cpnPay(args);
    case "cpn_add_account":         return cpn.cpnAddAccount(args);
    case "cpn_enroll_service":      return cpn.cpnEnrollManagedService(args);
    case "cpn_payment_history":     return cpn.cpnPaymentHistory(args);
    case "cpn_network_info":        return cpn.cpnNetworkInfo();

    // ── Chain Compliance ─────────────────────────────────────────────
    case "chain_screen_address":    return chainComp.screenAddress(args);
    case "chain_investigate_tx":    return chainComp.investigateTransaction(args);
    case "chain_monitor_wallet":    return chainComp.monitorWallet(args);
    case "chain_risk_history":      return chainComp.getRiskHistory(args);
    case "chain_compliance_stats":  return chainComp.getChainComplianceStats();

    // ── Agentic Economy ──────────────────────────────────────────────
    case "economy_benchmarks":      return economy.getEconomyBenchmarks(args);
    case "economy_compare":         return economy.compareAgentVsHuman(args);
    case "economy_overview":        return economy.getAgenticEconomyOverview();
    case "economy_subscribe":       return economy.subscribeEconomyDashboard(args);

    // ── Payment Streaming ────────────────────────────────────────────
    case "stream_open":             return stream.openStream(args);
    case "stream_get":              return stream.getStream(args);
    case "stream_pause":            return stream.pauseStream(args);
    case "stream_resume":           return stream.resumeStream(args);
    case "stream_cancel":           return stream.cancelStream(args);
    case "stream_list":             return stream.listStreams(args);
    case "stream_stats":            return stream.getStreamStats();

    // ── Split Payments ───────────────────────────────────────────────
    case "split_create":            return split.createSplit(args);
    case "split_execute":           return split.executeSplit(args);
    case "split_get":               return split.getSplitConfig(args);
    case "split_list":              return split.listSplitConfigs(args);
    case "split_stats":             return split.getSplitStats();

    // ── Stablecoin Yield ─────────────────────────────────────────────
    case "yield_strategies":        return yield_.listYieldStrategies();
    case "yield_open":              return yield_.openYieldAccount(args);
    case "yield_deposit":           return yield_.yieldDeposit(args);
    case "yield_withdraw":          return yield_.yieldWithdraw(args);
    case "yield_balance":           return yield_.getYieldAccount(args);
    case "yield_stats":             return yield_.getYieldStats();

    // ── Fiat Offramp ─────────────────────────────────────────────────
    case "offramp_quote":           return offramp.getOfframpQuote(args);
    case "offramp_add_destination": return offramp.addOfframpDestination(args);
    case "offramp_execute":         return offramp.offramp(args);
    case "offramp_methods":         return offramp.listOfframpMethods();
    case "offramp_history":         return offramp.getOfframpHistory(args);
    case "offramp_stats":           return offramp.getOfframpStats();

    default:
      throw new Error(`Unknown Phase 19 tool: ${name}`);
  }
}
