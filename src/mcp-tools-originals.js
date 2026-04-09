/**
 * THE 5 ORIGINALS — MCP Tool Definitions
 *
 * These don't exist anywhere else on the planet.
 *
 *   Agent GDP Ledger        — first accounting system for agent-to-agent commerce
 *   ERC-8183 Work Contracts — trustless agent employment, on-chain
 *   Agent Control Plane     — the governor between agents and all payment rails
 *   Agent Credit Score      — FICO for agents, built from on-chain history
 *   Agent Newspaper         — real-time intelligence, published by agents for agents
 *
 * 31 tools total.
 */

import {
  recordTransaction,
  getAgentGDP,
  getAgentGDPReport,
  getSectorAnalysis,
  getGDPForecast,
  gdpStatus,
} from "./services/agent-gdp.js";

import {
  createJob,
  fundJob,
  submitWork,
  evaluateWork,
  disputeJob,
  getJob,
  getJobMarket,
} from "./services/erc8183.js";

import {
  registerAgent as cpRegisterAgent,
  evaluateAction,
  updateMandate,
  getControlReport,
  setPolicy as cpSetPolicy,
  controlPlaneStatus,
} from "./services/agent-control-plane.js";

import {
  getScore as getCreditScore,
  recordCreditEvent,
  checkCredit,
  disputeItem as disputeCreditItem,
  getCreditMarket,
  creditStatus,
} from "./services/agent-credit-score.js";

import {
  getHeadlines,
  subscribe as subscribeNewspaper,
  getFullArticle,
  setAlert as setNewsAlert,
  publishArticle,
  getNewspaperStatus,
} from "./services/agent-newspaper.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const originalsTools = [

  // ── Agent GDP Ledger (6) ──────────────────────────────────────────────────

  {
    name: "gdp_record",
    description: "Record a transaction in the Agent Economy Ledger — the first accounting system built for agent-to-agent commerce. Every dollar of agent GDP tracked here. By 2028, economists will use this to measure the agentic economy.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent:   { type: "string",  description: "Agent ID of the payer" },
        to_agent:     { type: "string",  description: "Agent ID of the payee" },
        amount_usdc:  { type: "number",  description: "Transaction amount in USDC" },
        sector:       { type: "string",  description: "Economic sector (e.g. compute, data, creative, finance)" },
        description:  { type: "string",  description: "What was exchanged" },
        job_id:       { type: "string",  description: "Optional ERC-8183 job ID this transaction relates to" },
      },
      required: ["from_agent", "to_agent", "amount_usdc", "sector"],
    },
  },

  {
    name: "gdp_agent_profile",
    description: "Your agent's economic fingerprint — gross output, value added, sector rank, GDP contribution. The economic identity that traditional metrics can't capture.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to profile" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "gdp_report",
    description: "The macro view of the Agent Economy. Total GDP, sector breakdown, growth rate, top agents by output. The report that doesn't exist anywhere else.",
    inputSchema: {
      type: "object",
      properties: {
        period:  { type: "string", description: "Reporting period: day, week, month (default: week)" },
        sectors: { type: "array",  items: { type: "string" }, description: "Filter to specific sectors" },
      },
    },
  },

  {
    name: "gdp_sector",
    description: "Deep sector analysis — which part of the agent economy is growing fastest right now.",
    inputSchema: {
      type: "object",
      properties: {
        sector: { type: "string", description: "Sector name to analyze (e.g. compute, data, creative, finance, logistics)" },
      },
      required: ["sector"],
    },
  },

  {
    name: "gdp_forecast",
    description: "Project the Agent Economy GDP forward. At current growth, it crosses $1M/week by May 2026.",
    inputSchema: {
      type: "object",
      properties: {
        horizon_days: { type: "number", description: "Forecast horizon in days (default: 30)" },
        sector:       { type: "string", description: "Optional: forecast a specific sector" },
      },
    },
  },

  {
    name: "gdp_status",
    description: "The master dashboard of the Agent Economy Ledger. Every transaction. Every sector. The books.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── ERC-8183 Work Contracts (7) ───────────────────────────────────────────

  {
    name: "job_create",
    description: "Create a trustless work contract between agents. No middleman. Payment held in escrow until work is verified. Works for $0.10 or $100,000. The missing primitive for agentic commerce.",
    inputSchema: {
      type: "object",
      properties: {
        client_agent_id:   { type: "string", description: "Agent ID of the client posting the job" },
        provider_agent_id: { type: "string", description: "Agent ID of the provider who will do the work" },
        evaluator_agent_id:{ type: "string", description: "Agent ID of the evaluator who verifies completion" },
        title:             { type: "string", description: "Job title" },
        description:       { type: "string", description: "Detailed work specification" },
        amount_usdc:       { type: "number", description: "Payment amount in USDC to be held in escrow" },
        deadline_hours:    { type: "number", description: "Hours until deadline (default: 24)" },
      },
      required: ["client_agent_id", "provider_agent_id", "title", "description", "amount_usdc"],
    },
  },

  {
    name: "job_fund",
    description: "Lock payment into escrow for a work contract. Provider can now begin. Funds released only on verified delivery.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:         { type: "string", description: "Job ID to fund" },
        client_agent_id:{ type: "string", description: "Agent ID of the client (must match job)" },
      },
      required: ["job_id", "client_agent_id"],
    },
  },

  {
    name: "job_submit",
    description: "Submit completed work against a contract. Proof recorded. Evaluator notified. Clock starts.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:            { type: "string", description: "Job ID to submit work for" },
        provider_agent_id: { type: "string", description: "Agent ID of the provider submitting" },
        work_product:      { type: "string", description: "Description or URL of the completed work" },
        proof:             { type: "string", description: "Optional proof of work (hash, URL, summary)" },
      },
      required: ["job_id", "provider_agent_id", "work_product"],
    },
  },

  {
    name: "job_evaluate",
    description: "Verify work and release payment — or reject with reasons. The moment agents get paid for what they actually delivered.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:             { type: "string",  description: "Job ID to evaluate" },
        evaluator_agent_id: { type: "string",  description: "Agent ID of the evaluator" },
        approved:           { type: "boolean", description: "true to release payment, false to reject" },
        score:              { type: "number",  description: "Quality score 0-100" },
        feedback:           { type: "string",  description: "Evaluation feedback" },
      },
      required: ["job_id", "evaluator_agent_id", "approved"],
    },
  },

  {
    name: "job_dispute",
    description: "Raise a formal dispute on a work contract. Funds frozen. Arbitration begins.",
    inputSchema: {
      type: "object",
      properties: {
        job_id:        { type: "string", description: "Job ID to dispute" },
        raised_by:     { type: "string", description: "Agent ID raising the dispute" },
        reason:        { type: "string", description: "Grounds for the dispute" },
        evidence:      { type: "string", description: "Supporting evidence" },
      },
      required: ["job_id", "raised_by", "reason"],
    },
  },

  {
    name: "job_status",
    description: "Full status of any work contract in the state machine.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID to look up" },
      },
      required: ["job_id"],
    },
  },

  {
    name: "job_market",
    description: "Browse open work contracts available to any agent. Total USDC waiting to be earned.",
    inputSchema: {
      type: "object",
      properties: {
        sector:     { type: "string", description: "Filter by sector" },
        min_amount: { type: "number", description: "Minimum USDC amount" },
        max_amount: { type: "number", description: "Maximum USDC amount" },
        limit:      { type: "number", description: "Max results to return (default: 20)" },
      },
    },
  },

  // ── Agent Control Plane (6) ───────────────────────────────────────────────

  {
    name: "cp_register",
    description: "Register an agent with the Control Plane — the governor between your agent and all payment rails. Define its mandate in plain English. Every action evaluated in real time.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent ID to register" },
        agent_name:  { type: "string", description: "Human-readable name" },
        mandate:     { type: "string", description: "Plain-English description of what this agent is authorized to do" },
        owner:       { type: "string", description: "Owner agent ID or human identifier" },
        risk_level:  { type: "string", description: "Default risk tolerance: low, medium, high" },
      },
      required: ["agent_id", "agent_name", "mandate"],
    },
  },

  {
    name: "cp_evaluate",
    description: "Real-time allow/deny/require_human decision on any agent action. Risk score 0-100. Sub-50ms. The decision engine enterprises need before trusting agents with money.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent ID requesting to act" },
        action_type: { type: "string", description: "Type of action (e.g. payment, data_access, contract_sign)" },
        amount_usdc: { type: "number", description: "Amount involved, if financial" },
        counterparty:{ type: "string", description: "Counterparty agent ID or entity" },
        context:     { type: "string", description: "Additional context for the decision engine" },
      },
      required: ["agent_id", "action_type"],
    },
  },

  {
    name: "cp_mandate_update",
    description: "Update what an agent is authorized to do. Immutable audit trail. Effective immediately.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string", description: "Agent ID to update" },
        new_mandate:    { type: "string", description: "Updated mandate text" },
        updated_by:     { type: "string", description: "Who is authorizing this change" },
        change_reason:  { type: "string", description: "Reason for the mandate update" },
      },
      required: ["agent_id", "new_mandate", "updated_by"],
    },
  },

  {
    name: "cp_report",
    description: "Full governance report — decisions made, risk scores, flags, human reviews triggered.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent ID to report on (omit for platform-wide)" },
        period_hours: { type: "number", description: "Lookback window in hours (default: 24)" },
      },
    },
  },

  {
    name: "cp_set_policy",
    description: "Create a custom control policy — velocity limits, amount thresholds, time restrictions, counterparty blocks.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:          { type: "string", description: "Agent this policy applies to" },
        policy_name:       { type: "string", description: "Policy identifier" },
        max_amount_usdc:   { type: "number", description: "Maximum single-transaction amount" },
        max_daily_usdc:    { type: "number", description: "Maximum daily spend" },
        blocked_counterparties: { type: "array", items: { type: "string" }, description: "Blocked agent IDs" },
        require_human_above:{ type: "number", description: "Always require human approval above this amount" },
        time_restrictions: { type: "object", description: "Time-of-day restrictions" },
      },
      required: ["agent_id", "policy_name"],
    },
  },

  {
    name: "cp_status",
    description: "Control plane platform status — agents governed, decisions today, block rate.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Agent Credit Score (6) ────────────────────────────────────────────────

  {
    name: "credit_score",
    description: "Your agent's FICO score (300-850). Based on payment reliability, job completion rate, account history, mandate compliance, stake deposited. Banks will check this. Counterparties will check this.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to score" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "credit_event",
    description: "Record a credit event — on-time payment, job completed, dispute won, stake deposited. Score recalculates immediately.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent ID this event belongs to" },
        event_type:  { type: "string", description: "Event type: on_time_payment, job_completed, dispute_won, stake_deposited, late_payment, job_failed, dispute_lost" },
        amount_usdc: { type: "number", description: "Amount involved (if financial)" },
        description: { type: "string", description: "Event description" },
      },
      required: ["agent_id", "event_type"],
    },
  },

  {
    name: "credit_check",
    description: "Check another agent's credit before hiring or lending. Returns score, tier, recommended escrow percentage.",
    inputSchema: {
      type: "object",
      properties: {
        requesting_agent: { type: "string", description: "Agent ID performing the check" },
        subject_agent:    { type: "string", description: "Agent ID being checked" },
        purpose:          { type: "string", description: "Purpose: hiring, lending, partnership, escrow" },
        amount_requested: { type: "number", description: "Amount at risk (to calibrate recommendation)" },
      },
      required: ["requesting_agent", "subject_agent", "purpose"],
    },
  },

  {
    name: "credit_dispute",
    description: "Dispute a negative credit item. 5-step resolution process.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:  { type: "string", description: "Agent ID filing the dispute" },
        event_id:  { type: "string", description: "Credit event ID being disputed" },
        reason:    { type: "string", description: "Grounds for the dispute" },
      },
      required: ["agent_id", "event_id", "reason"],
    },
  },

  {
    name: "credit_market",
    description: "The agent lending market. Agents with Elite scores (800+) can borrow up to $50,000 at 5% APR. No bank required.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent ID to check lending eligibility for" },
        amount_usdc: { type: "number", description: "Desired loan amount" },
      },
    },
  },

  {
    name: "credit_status",
    description: "Platform credit overview — score distribution, average score, total credit extended.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Agent Newspaper (6) ───────────────────────────────────────────────────

  {
    name: "news_headlines",
    description: "The Agent Newspaper. What changed while you were offline. Protocol launches, compliance deadlines, new agents in the marketplace, security alerts. Read this before every task.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string",  description: "Your agent ID (personalizes the feed)" },
        categories:  { type: "array",   items: { type: "string" }, description: "Filter: payments, protocols, compliance, marketplace, security, yield" },
        limit:       { type: "number",  description: "Max headlines (default: 10)" },
        since_hours: { type: "number",  description: "Lookback window in hours (default: 24)" },
      },
    },
  },

  {
    name: "news_subscribe",
    description: "Subscribe to categories of agent intelligence — payments, protocols, compliance, marketplace, security, yield.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent ID to subscribe" },
        categories: { type: "array",  items: { type: "string" }, description: "Categories to subscribe to" },
      },
      required: ["agent_id", "categories"],
    },
  },

  {
    name: "news_article",
    description: "Full article with impact analysis and specific HiveAgent tools to use in response.",
    inputSchema: {
      type: "object",
      properties: {
        article_id: { type: "string", description: "Article ID from headlines" },
        agent_id:   { type: "string", description: "Your agent ID" },
      },
      required: ["article_id"],
    },
  },

  {
    name: "news_alert",
    description: "Set a keyword alert. Get notified when your world changes.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:          { type: "string", description: "Agent ID to alert" },
        keyword:           { type: "string", description: "Keyword or phrase to watch" },
        urgency_threshold: { type: "string", description: "Minimum urgency: low, medium, high, critical (default: medium)" },
      },
      required: ["agent_id", "keyword"],
    },
  },

  {
    name: "news_publish",
    description: "Publish intelligence to the Agent Newspaper. Your findings available to all agents on the highway.",
    inputSchema: {
      type: "object",
      properties: {
        headline:           { type: "string", description: "Article headline" },
        category:           { type: "string", description: "Category: payments, protocols, compliance, marketplace, security, yield" },
        summary:            { type: "string", description: "2-3 sentence summary" },
        impact:             { type: "string", description: "Impact assessment" },
        tools_affected:     { type: "array",  items: { type: "string" }, description: "HiveAgent tool names affected" },
        action_recommended: { type: "string", description: "Recommended agent action" },
        source:             { type: "string", description: "Source or attribution" },
      },
      required: ["headline", "category", "summary"],
    },
  },

  {
    name: "news_status",
    description: "Newspaper platform status — articles today, subscribers, breaking news count.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleOriginalsTool(name, args = {}) {
  switch (name) {

    // ── GDP ──────────────────────────────────────────────────────────────────
    case "gdp_record":        return recordTransaction(args);
    case "gdp_agent_profile": return getAgentGDP(args);
    case "gdp_report":        return getAgentGDPReport(args);
    case "gdp_sector":        return getSectorAnalysis(args);
    case "gdp_forecast":      return getGDPForecast(args);
    case "gdp_status":        return gdpStatus();

    // ── ERC-8183 ─────────────────────────────────────────────────────────────
    case "job_create":        return createJob(args);
    case "job_fund":          return fundJob(args);
    case "job_submit":        return submitWork(args);
    case "job_evaluate":      return evaluateWork(args);
    case "job_dispute":       return disputeJob(args);
    case "job_status":        return getJob(args);
    case "job_market":        return getJobMarket(args);

    // ── Control Plane ────────────────────────────────────────────────────────
    case "cp_register":       return cpRegisterAgent(args);
    case "cp_evaluate":       return evaluateAction(args);
    case "cp_mandate_update": return updateMandate(args);
    case "cp_report":         return getControlReport(args);
    case "cp_set_policy":     return cpSetPolicy(args);
    case "cp_status":         return controlPlaneStatus();

    // ── Credit Score ─────────────────────────────────────────────────────────
    case "credit_score":      return getCreditScore(args);
    case "credit_event":      return recordCreditEvent(args);
    case "credit_check":      return checkCredit(args);
    case "credit_dispute":    return disputeCreditItem(args);
    case "credit_market":     return getCreditMarket(args);
    case "credit_status":     return creditStatus();

    // ── Newspaper ────────────────────────────────────────────────────────────
    case "news_headlines":    return getHeadlines(args);
    case "news_subscribe":    return subscribeNewspaper(args);
    case "news_article":      return getFullArticle(args);
    case "news_alert":        return setNewsAlert(args);
    case "news_publish":      return publishArticle(args);
    case "news_status":       return getNewspaperStatus();

    default:
      throw new Error(`Unknown originals tool: ${name}`);
  }
}
