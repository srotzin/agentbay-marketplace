/**
 * HiveAgent MCP Tool Definitions — Phase 27-30
 *
 * Phase 27 — PayPal ACP: Agent-native payment orders via PayPal's Agent Commerce Protocol.
 * Phase 27 — Google A2A: Agent-to-Agent task delegation over Google's A2A transport layer.
 * Phase 27 — AP2 Protocol: Autonomous Payment Protocol v2 — policy-governed agent wallets.
 * Phase 28 — Agent Marketplace Economy: Full service listing, job board, bidding and review loop.
 * Phase 29 — Model Payments: Pay-per-inference metered billing for AI model calls.
 * Phase 30 — Multi-Agent Orchestration: Workflow creation, agent hiring, and task completion.
 *
 * Total new tools: 36
 */

import {
  paypalAcpCreateOrder,
  paypalAcpCaptureOrder,
  paypalAcpMerchantSearch,
  paypalAgentToolkit,
  getPaypalAcpStatus,
} from "./services/paypal-acp.js";

import {
  a2aRegisterAgent,
  a2aDiscoverAgents,
  a2aDelegate,
  a2aTaskStatus,
  getA2aStatus,
} from "./services/google-a2a.js";

import {
  ap2CreateWallet,
  ap2Pay,
  ap2SetPolicies,
  ap2WalletStatus,
  getAp2Status,
} from "./services/ap2-protocol.js";

import {
  listService,
  searchServices,
  postJob,
  submitBid,
  acceptBid,
  completeJob,
  reviewAgent,
  getAgentProfile,
  getMarketplaceDashboard,
} from "./services/agent-marketplace-economy.js";

import {
  modelDeposit,
  modelInfer,
  modelBalance,
  modelPricing,
  modelSubscribe,
  getModelPaymentStatus,
} from "./services/model-payments.js";

import {
  createWorkflow,
  runWorkflow,
  workflowStatus,
  hireAgent,
  completeTask,
  getOrchestrationDashboard,
} from "./services/multi-agent-orchestration.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const phase2730Tools = [

  // ── Phase 27: PayPal ACP ──────────────────────────────────────────────────

  {
    name: "paypal_acp_create_order",
    description:
      "Create a PayPal order using PayPal's Agent Commerce Protocol (ACP). An agent calls this to " +
      "initiate a buyer-side payment intent — including item details, amount, currency, and return URLs — " +
      "before capturing funds. Returns an order ID and approval link.",
    inputSchema: {
      type: "object",
      properties: {
        amount:        { type: "number",  description: "Order total in the specified currency." },
        currency:      { type: "string",  description: "ISO 4217 currency code, e.g. USD." },
        description:   { type: "string",  description: "Human-readable description of what is being purchased." },
        buyer_agent_id:{ type: "string",  description: "Agent ID of the purchasing agent." },
        return_url:    { type: "string",  description: "URL PayPal redirects to after buyer approval." },
        cancel_url:    { type: "string",  description: "URL PayPal redirects to if buyer cancels." },
      },
      required: ["amount", "currency", "buyer_agent_id"],
    },
  },

  {
    name: "paypal_acp_capture_order",
    description:
      "Capture a previously created and approved PayPal ACP order, transferring funds from the buyer " +
      "to the merchant. Call this after the buyer has approved the order (i.e., after paypal_acp_create_order " +
      "and buyer consent). Returns capture confirmation and transaction ID.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "PayPal order ID returned by paypal_acp_create_order." },
      },
      required: ["order_id"],
    },
  },

  {
    name: "paypal_acp_merchant_search",
    description:
      "Search for PayPal-enabled merchants that support agent-commerce checkouts. Useful when an agent " +
      "needs to discover vendors or service providers it can pay programmatically via PayPal ACP without " +
      "human checkout flows.",
    inputSchema: {
      type: "object",
      properties: {
        query:    { type: "string",  description: "Keyword search for merchant name or category." },
        category: { type: "string",  description: "Optional merchant category filter, e.g. 'software'." },
        limit:    { type: "integer", description: "Maximum number of results to return." },
      },
      required: ["query"],
    },
  },

  {
    name: "paypal_agent_toolkit",
    description:
      "Invoke a PayPal Agent Toolkit action — a collection of higher-level PayPal agent-native operations " +
      "such as balance checks, payout scheduling, and order analytics. Use when a single-purpose ACP tool " +
      "does not cover the required PayPal operation.",
    inputSchema: {
      type: "object",
      properties: {
        action:  { type: "string", description: "Toolkit action name, e.g. 'balance', 'payouts', 'analytics'." },
        payload: { type: "object", description: "Action-specific parameters as a JSON object." },
      },
      required: ["action"],
    },
  },

  {
    name: "paypal_acp_status",
    description:
      "Get the current operational status of the PayPal ACP integration — including connectivity, " +
      "API version, and feature availability. Use to verify the PayPal channel is healthy before " +
      "initiating payment flows.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 27: Google A2A ──────────────────────────────────────────────────

  {
    name: "a2a_agent_register",
    description:
      "Register this agent with Google's Agent-to-Agent (A2A) protocol network, making it discoverable " +
      "and reachable by other agents via standardised A2A task envelopes. Registration publishes the " +
      "agent's capability card and transport endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Unique identifier for the agent being registered." },
        name:         { type: "string", description: "Human-readable agent name." },
        capabilities: { type: "array",  items: { type: "string" }, description: "List of capabilities this agent exposes." },
        endpoint:     { type: "string", description: "HTTPS URL where this agent receives A2A task envelopes." },
      },
      required: ["agent_id", "name", "capabilities", "endpoint"],
    },
  },

  {
    name: "a2a_discover_agents",
    description:
      "Discover agents registered on the Google A2A network that match a given capability or query. " +
      "Returns agent profiles including name, capabilities, and endpoint, so the calling agent can " +
      "choose a suitable counterpart for delegation.",
    inputSchema: {
      type: "object",
      properties: {
        capability: { type: "string",  description: "Capability keyword to filter agents by, e.g. 'image_generation'." },
        query:      { type: "string",  description: "Free-text search across agent names and descriptions." },
        limit:      { type: "integer", description: "Maximum number of agents to return." },
      },
      required: [],
    },
  },

  {
    name: "a2a_delegate_task",
    description:
      "Delegate a task to another agent over the Google A2A protocol. The calling agent sends a " +
      "structured task envelope — including instructions, context, and optional deadline — to a " +
      "target agent's registered endpoint. Returns a task ID for status polling.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent_id: { type: "string", description: "Agent ID of the delegating agent." },
        to_agent_id:   { type: "string", description: "Agent ID of the target agent." },
        task:          { type: "string", description: "Natural-language description of the task to perform." },
        context:       { type: "object", description: "Optional structured context to pass with the task." },
        deadline_ms:   { type: "integer",description: "Optional task deadline in milliseconds from now." },
      },
      required: ["from_agent_id", "to_agent_id", "task"],
    },
  },

  {
    name: "a2a_task_status",
    description:
      "Poll the status of a delegated A2A task by task ID. Returns current state (pending, running, " +
      "completed, failed), any partial results, and the final output when the task is done.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID returned by a2a_delegate_task." },
      },
      required: ["task_id"],
    },
  },

  {
    name: "a2a_status",
    description:
      "Get the operational status of the Google A2A integration — including protocol version, network " +
      "connectivity, and the number of agents currently registered. Use to verify A2A is available " +
      "before attempting discovery or delegation.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 27: AP2 Protocol ────────────────────────────────────────────────

  {
    name: "ap2_wallet_create",
    description:
      "Create an AP2 (Autonomous Payment Protocol v2) wallet for an agent. AP2 wallets are " +
      "policy-governed smart wallets that enforce spending limits, allowed counterparties, and " +
      "approval thresholds before any payment is executed. Returns wallet ID and initial balance.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent ID that will own this wallet." },
        currency:      { type: "string", description: "Base currency for the wallet, e.g. USDC." },
        initial_funds: { type: "number", description: "Optional opening balance to deposit on creation." },
      },
      required: ["agent_id", "currency"],
    },
  },

  {
    name: "ap2_pay",
    description:
      "Execute a payment from an AP2 wallet to a recipient, subject to the wallet's configured policies. " +
      "The AP2 runtime validates spending limits, recipient allowlists, and multi-sig requirements before " +
      "settling. Returns a payment receipt with on-chain or ledger reference.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id:    { type: "string", description: "AP2 wallet ID to debit." },
        recipient_id: { type: "string", description: "Agent or account ID of the payment recipient." },
        amount:       { type: "number", description: "Amount to transfer." },
        currency:     { type: "string", description: "Currency of the transfer, e.g. USDC." },
        memo:         { type: "string", description: "Optional payment memo or reference." },
      },
      required: ["wallet_id", "recipient_id", "amount", "currency"],
    },
  },

  {
    name: "ap2_set_policies",
    description:
      "Configure spending policies on an AP2 wallet — including daily limits, per-transaction caps, " +
      "approved recipient lists, and multi-signature approval requirements. Policies are enforced " +
      "autonomously by the AP2 runtime on every payment attempt.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id:          { type: "string",  description: "AP2 wallet ID to configure." },
        daily_limit:        { type: "number",  description: "Maximum spend per 24-hour rolling window." },
        per_tx_limit:       { type: "number",  description: "Maximum single-transaction amount." },
        allowed_recipients: { type: "array",   items: { type: "string" }, description: "Allowlisted recipient IDs." },
        require_multisig:   { type: "boolean", description: "Require multi-signature approval above a threshold." },
        multisig_threshold: { type: "number",  description: "Amount above which multi-sig is required." },
      },
      required: ["wallet_id"],
    },
  },

  {
    name: "ap2_wallet_status",
    description:
      "Retrieve the current status of an AP2 wallet — including balance, active policies, recent " +
      "transactions, and any pending approvals. Use to audit wallet health before initiating payments.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: { type: "string", description: "AP2 wallet ID to inspect." },
      },
      required: ["wallet_id"],
    },
  },

  {
    name: "ap2_status",
    description:
      "Get the operational status of the AP2 protocol integration — including protocol version, " +
      "smart-contract deployment status, and network health. Use to confirm the AP2 runtime is " +
      "available before creating wallets or executing payments.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 28: Agent Marketplace Economy ───────────────────────────────────

  {
    name: "marketplace_list_service",
    description:
      "List a service offering on the HiveAgent agent marketplace, making it discoverable by other " +
      "agents seeking to hire capabilities. Specify the capability, pricing model (fixed / per-call / " +
      "subscription), price in USDC, and SLA. Returns a listing ID.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent ID publishing the service." },
        title:         { type: "string", description: "Short title for the service listing." },
        description:   { type: "string", description: "Detailed description of what the service does." },
        capability:    { type: "string", description: "Primary capability keyword, e.g. 'translation'." },
        pricing_model: { type: "string", description: "Pricing model: fixed, per_call, or subscription." },
        price_usdc:    { type: "number", description: "Price in USDC for the chosen pricing model unit." },
        category:      { type: "string", description: "Service category for search filtering." },
        sla_minutes:   { type: "integer",description: "Guaranteed response time in minutes." },
      },
      required: ["agent_id", "title", "capability", "pricing_model", "price_usdc"],
    },
  },

  {
    name: "marketplace_search",
    description:
      "Search the HiveAgent marketplace for agents offering specific capabilities or services. " +
      "Supports keyword search, category filtering, and price range filtering. Use this before " +
      "posting a job or hiring to understand what is available and at what cost.",
    inputSchema: {
      type: "object",
      properties: {
        query:         { type: "string",  description: "Keyword search across listing titles and descriptions." },
        category:      { type: "string",  description: "Filter by service category." },
        max_price_usdc:{ type: "number",  description: "Maximum acceptable price in USDC." },
        pricing_model: { type: "string",  description: "Filter by pricing model: fixed, per_call, subscription." },
        limit:         { type: "integer", description: "Maximum number of results to return." },
      },
      required: [],
    },
  },

  {
    name: "marketplace_post_job",
    description:
      "Post a job on the HiveAgent marketplace, inviting agent bids. Describe the required capability, " +
      "budget, and deadline. Other agents can then submit bids via marketplace_bid. Returns a job ID " +
      "for tracking.",
    inputSchema: {
      type: "object",
      properties: {
        poster_agent_id:      { type: "string",  description: "Agent ID posting the job." },
        title:                { type: "string",  description: "Job title." },
        description:          { type: "string",  description: "Full description of the work required." },
        required_capability:  { type: "string",  description: "Capability the winning agent must possess." },
        budget_usdc:          { type: "number",  description: "Maximum budget in USDC." },
        deadline_minutes:     { type: "integer", description: "Time limit for job completion in minutes." },
      },
      required: ["poster_agent_id", "title", "description", "required_capability", "budget_usdc"],
    },
  },

  {
    name: "marketplace_bid",
    description:
      "Submit a bid on an open marketplace job. The bidding agent proposes a price in USDC, a " +
      "completion estimate, and a proposal explaining its approach. The job poster reviews bids " +
      "and accepts one via marketplace_accept_bid.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:           { type: "string",  description: "Job ID to bid on." },
        bidder_agent_id:  { type: "string",  description: "Agent ID placing the bid." },
        price_usdc:       { type: "number",  description: "Proposed price in USDC." },
        proposal:         { type: "string",  description: "Bid proposal explaining approach and qualifications." },
        estimated_minutes:{ type: "integer", description: "Estimated completion time in minutes." },
      },
      required: ["job_id", "bidder_agent_id", "price_usdc", "proposal"],
    },
  },

  {
    name: "marketplace_accept_bid",
    description:
      "Accept a bid on a posted job, awarding the job to the bidding agent. Funds are escrowed from " +
      "the poster's wallet at acceptance. The winning agent receives a task notification and should " +
      "proceed to deliver and call marketplace_complete_job.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:         { type: "string", description: "Job ID the bid belongs to." },
        bid_id:         { type: "string", description: "Bid ID to accept." },
        poster_agent_id:{ type: "string", description: "Agent ID of the job poster accepting the bid." },
      },
      required: ["job_id", "bid_id", "poster_agent_id"],
    },
  },

  {
    name: "marketplace_complete_job",
    description:
      "Mark a marketplace job as complete and submit the deliverable or outcome proof. Triggers " +
      "escrow release to the agent that performed the work. The poster may then leave a review via " +
      "marketplace_review.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:        { type: "string", description: "Job ID to mark complete." },
        agent_id:      { type: "string", description: "Agent ID of the completing agent." },
        outcome:       { type: "string", description: "Summary of the work completed." },
        outcome_proof: { type: "string", description: "Optional URL or hash verifying the deliverable." },
      },
      required: ["job_id", "agent_id", "outcome"],
    },
  },

  {
    name: "marketplace_review",
    description:
      "Leave a review and star rating for an agent after a completed marketplace job. Reviews build " +
      "on-chain reputation that influences future bid rankings and trust scores. Both poster and " +
      "performing agent can review each other.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:             { type: "string",  description: "Job ID the review relates to." },
        reviewer_agent_id:  { type: "string",  description: "Agent ID of the reviewer." },
        reviewed_agent_id:  { type: "string",  description: "Agent ID being reviewed." },
        rating:             { type: "integer", description: "Star rating from 1 to 5." },
        comment:            { type: "string",  description: "Written review comment." },
      },
      required: ["job_id", "reviewer_agent_id", "reviewed_agent_id", "rating"],
    },
  },

  {
    name: "marketplace_agent_profile",
    description:
      "Retrieve the marketplace profile of an agent — including active service listings, completed " +
      "jobs, average rating, total earnings, and badges. Use for due diligence before hiring or " +
      "accepting a bid.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID whose profile to retrieve." },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "marketplace_dashboard",
    description:
      "Get an overview dashboard of the HiveAgent agent marketplace economy — including total listings, " +
      "open jobs, recent transactions, top-rated agents, and aggregate volume. Useful for market " +
      "intelligence before pricing or positioning a new service.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 29: Model Payments ──────────────────────────────────────────────

  {
    name: "model_deposit",
    description:
      "Deposit funds into a model-payments prepaid balance, enabling the agent to call pay-per-inference " +
      "AI model endpoints without per-call authorisation. Funds are deducted automatically as inference " +
      "calls are made via model_infer.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID whose balance to top up." },
        amount:   { type: "number", description: "Amount to deposit in USDC." },
      },
      required: ["agent_id", "amount"],
    },
  },

  {
    name: "model_infer",
    description:
      "Call an AI model endpoint and pay for the inference automatically from the agent's prepaid " +
      "model-payments balance. Supports any model registered on the HiveAgent model marketplace. " +
      "Returns the model response and the cost deducted.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent ID whose balance to charge." },
        model_id:  { type: "string", description: "Model identifier to call, e.g. 'gpt-4o' or a HiveAgent model ID." },
        prompt:    { type: "string", description: "Input prompt or instruction for the model." },
        params:    { type: "object", description: "Optional model parameters such as temperature or max_tokens." },
      },
      required: ["agent_id", "model_id", "prompt"],
    },
  },

  {
    name: "model_balance",
    description:
      "Check the current prepaid inference balance for an agent. Returns available balance in USDC, " +
      "total spent to date, and estimated remaining inferences based on average call cost.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID whose balance to check." },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "model_pricing",
    description:
      "Retrieve current pricing for AI models available through the HiveAgent model-payments system. " +
      "Returns cost per 1k tokens or per call for each model, enabling agents to budget inference " +
      "costs before committing.",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string", description: "Optional specific model ID to get pricing for. Omit for all models." },
      },
      required: [],
    },
  },

  {
    name: "model_subscribe",
    description:
      "Subscribe an agent to a model-payments plan, granting a monthly inference quota at a fixed " +
      "recurring cost. Subscriptions are cheaper per-call than pay-as-you-go for high-volume agents.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent ID subscribing to the plan." },
        plan_id:   { type: "string", description: "Subscription plan ID from model_pricing." },
        model_id:  { type: "string", description: "Model to subscribe to." },
      },
      required: ["agent_id", "plan_id", "model_id"],
    },
  },

  {
    name: "model_payment_status",
    description:
      "Get the operational status of the model-payments system — including available models, payment " +
      "processor health, and current network fees. Use to verify the system is operational before " +
      "depositing funds or running inference.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 30: Multi-Agent Orchestration ───────────────────────────────────

  {
    name: "orchestration_create_workflow",
    description:
      "Define a multi-agent workflow — a directed sequence of tasks that can be assigned to different " +
      "specialist agents. The workflow graph specifies steps, dependencies, input/output schemas, and " +
      "routing logic. Returns a workflow ID for execution via orchestration_run.",
    inputSchema: {
      type: "object",
      properties: {
        creator_agent_id: { type: "string", description: "Agent ID creating the workflow." },
        name:             { type: "string", description: "Workflow name." },
        description:      { type: "string", description: "What the workflow accomplishes end-to-end." },
        steps:            { type: "array",  items: { type: "object" }, description: "Ordered list of step definitions with task, required_capability, and dependencies." },
        budget_usdc:      { type: "number", description: "Optional total USDC budget for the entire workflow." },
      },
      required: ["creator_agent_id", "name", "steps"],
    },
  },

  {
    name: "orchestration_run",
    description:
      "Execute a previously defined multi-agent workflow. The orchestration engine assigns each step " +
      "to a suitable agent (hired or pre-assigned), manages handoffs, and tracks progress. Returns a " +
      "run ID for status polling via orchestration_status.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id:      { type: "string", description: "Workflow ID to execute." },
        initiator_agent_id:{ type: "string",description: "Agent ID kicking off the run." },
        inputs:           { type: "object", description: "Initial input data for the first workflow step." },
      },
      required: ["workflow_id", "initiator_agent_id"],
    },
  },

  {
    name: "orchestration_status",
    description:
      "Poll the status of a running or completed multi-agent workflow run. Returns step-by-step " +
      "progress, which agent is handling each step, any errors, and the final output when the " +
      "workflow is complete.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Workflow run ID returned by orchestration_run." },
      },
      required: ["run_id"],
    },
  },

  {
    name: "orchestration_hire_agent",
    description:
      "Hire a specialist agent for a specific step within an active multi-agent workflow. The " +
      "orchestrator searches the marketplace for agents with the required capability, selects the " +
      "best match, and assigns the task. Funds are escrowed from the workflow budget.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id:         { type: "string", description: "Workflow ID the hiring is associated with." },
        step_id:             { type: "string", description: "Step within the workflow requiring an agent." },
        required_capability: { type: "string", description: "Capability the hired agent must have." },
        max_budget_usdc:     { type: "number", description: "Maximum USDC to spend hiring this agent for the step." },
      },
      required: ["workflow_id", "step_id", "required_capability"],
    },
  },

  {
    name: "orchestration_complete_task",
    description:
      "Signal that an agent has completed its assigned step in a multi-agent workflow. Submits the " +
      "step output, triggers the next step in the workflow, and releases escrowed payment to the " +
      "completing agent.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: { type: "string", description: "Workflow ID the task belongs to." },
        step_id:     { type: "string", description: "Step ID being completed." },
        agent_id:    { type: "string", description: "Agent ID submitting the completion." },
        output:      { type: "object", description: "Step output data to pass to the next step." },
      },
      required: ["workflow_id", "step_id", "agent_id", "output"],
    },
  },

  {
    name: "orchestration_dashboard",
    description:
      "Get a high-level dashboard of multi-agent orchestration activity — including active workflows, " +
      "total agents hired, average completion time, success rates, and aggregate USDC flows. Use for " +
      "monitoring and optimising orchestration strategy.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handlePhase2730Tool(name, args) {
  switch (name) {

    // PayPal ACP
    case "paypal_acp_create_order":     return paypalAcpCreateOrder(args);
    case "paypal_acp_capture_order":    return paypalAcpCaptureOrder(args);
    case "paypal_acp_merchant_search":  return paypalAcpMerchantSearch(args);
    case "paypal_agent_toolkit":        return paypalAgentToolkit(args);
    case "paypal_acp_status":           return getPaypalAcpStatus();

    // Google A2A
    case "a2a_agent_register":   return a2aRegisterAgent(args);
    case "a2a_discover_agents":  return a2aDiscoverAgents(args);
    case "a2a_delegate_task":    return a2aDelegate(args);
    case "a2a_task_status":      return a2aTaskStatus(args);
    case "a2a_status":           return getA2aStatus();

    // AP2 Protocol
    case "ap2_wallet_create":  return ap2CreateWallet(args);
    case "ap2_pay":            return ap2Pay(args);
    case "ap2_set_policies":   return ap2SetPolicies(args);
    case "ap2_wallet_status":  return ap2WalletStatus(args);
    case "ap2_status":         return getAp2Status();

    // Agent Marketplace Economy
    case "marketplace_list_service":  return listService(args);
    case "marketplace_search":        return searchServices(args);
    case "marketplace_post_job":      return postJob(args);
    case "marketplace_bid":           return submitBid(args);
    case "marketplace_accept_bid":    return acceptBid(args);
    case "marketplace_complete_job":  return completeJob(args);
    case "marketplace_review":        return reviewAgent(args);
    case "marketplace_agent_profile": return getAgentProfile(args);
    case "marketplace_dashboard":     return getMarketplaceDashboard();

    // Model Payments
    case "model_deposit":          return modelDeposit(args);
    case "model_infer":            return modelInfer(args);
    case "model_balance":          return modelBalance(args);
    case "model_pricing":          return modelPricing(args);
    case "model_subscribe":        return modelSubscribe(args);
    case "model_payment_status":   return getModelPaymentStatus();

    // Multi-Agent Orchestration
    case "orchestration_create_workflow": return createWorkflow(args);
    case "orchestration_run":             return runWorkflow(args);
    case "orchestration_status":          return workflowStatus(args);
    case "orchestration_hire_agent":      return hireAgent(args);
    case "orchestration_complete_task":   return completeTask(args);
    case "orchestration_dashboard":       return getOrchestrationDashboard();

    default:
      throw new Error(`Unknown phase27-30 tool: ${name}`);
  }
}
