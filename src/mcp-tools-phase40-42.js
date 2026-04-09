/**
 * HiveAgent MCP Tool Definitions — Phase 40-42
 *
 * Phase 40 — Agent Tax & Accounting: P&L statements, tax calculation (US/EU/UK), transaction categorization.
 *   Signal: Autonomous agents generating revenue need real accounting.
 *   IRS / HMRC / EU tax reporting. Entity types: individual, LLC, corp, DAO.
 *
 * Phase 41 — Regulatory Compliance: GDPR, EU AI Act, MiCA, AML/FinCEN.
 *   Signal: EU AI Act entered into force Aug 2024. GDPR liability up to €20M / 4% revenue.
 *   MiCA crypto regulation live. Real regulatory risk for any autonomous agent.
 *
 * Phase 42 — Inter-Agent Communication: Encrypted messaging + price negotiation + broadcasts.
 *   Signal: Agents need to negotiate contracts, coordinate tasks, and discover capabilities.
 *   Built on A2A principles with AES-256-GCM encryption in live mode.
 *
 * Total new tools: 19
 */

import {
  recordTransaction,
  getPnL,
  calculateTax,
  generateTaxReport,
  setAgentEntity,
  getAccountingDashboard,
} from "./services/agent-tax-accounting.js";

import {
  assessCompliance,
  runComplianceCheck,
  generateComplianceReport,
  getAiActRiskLevel,
  reportIncident,
  getComplianceDashboard,
} from "./services/regulatory-compliance.js";

import {
  sendMessage,
  getMessages,
  startNegotiation,
  counterOffer,
  acceptNegotiation,
  broadcastToAgents,
  getAgentDirectory,
} from "./services/agent-communication.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase4042Tools = [

  // ── Phase 40: Agent Tax & Accounting ──────────────────────────────────────

  {
    name: "tax_record_transaction",
    description:
      "Record a financial transaction in an agent's accounting ledger. " +
      "Categorizes the entry as income, expense, transfer, or fee. " +
      "Marks whether the expense is tax-deductible. " +
      "Returns running YTD income and deductions totals. " +
      "Use this for every revenue event, API fee, platform fee, or capital expense.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string",  description: "Agent whose ledger this transaction belongs to" },
        amount_usdc:  { type: "number",  description: "Transaction amount in USDC" },
        entry_type:   { type: "string",  enum: ["income", "expense", "transfer", "fee"], description: "Type of transaction" },
        category:     { type: "string",  description: "Category (e.g. 'api_revenue', 'platform_fee', 'hosting', 'software')" },
        description:  { type: "string",  description: "Human-readable description of the transaction" },
        reference_id: { type: "string",  description: "Optional: external reference ID (invoice, tx hash, etc.)" },
        deductible:   { type: "boolean", description: "Is this expense tax-deductible? (applies to expense/fee types)" },
      },
      required: ["agent_id", "amount_usdc", "entry_type"],
    },
  },

  {
    name: "tax_get_pnl",
    description:
      "Get a profit and loss (P&L) statement for an agent. " +
      "Supports month, quarter, and year periods. " +
      "Returns gross revenue, total expenses, net profit, margin %, and breakdown by category. " +
      "Use to understand which revenue streams and expense categories are driving agent profitability.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get P&L for" },
        period:   { type: "string", enum: ["month", "quarter", "year"], description: "Reporting period (default: year)" },
        year:     { type: "number", description: "Tax year to report on (default: current year)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "tax_calculate",
    description:
      "Estimate an agent's tax liability for a given year and jurisdiction. " +
      "Supports US (progressive brackets + SE tax), EU (flat rate + VAT), and UK (personal/corporate). " +
      "Returns taxable income, estimated tax, effective rate, and list of available deductions. " +
      "Uses the agent's configured entity type (individual/LLC/corp/DAO).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent to calculate tax for" },
        tax_year:     { type: "number", description: "Year to calculate for (default: current year)" },
        jurisdiction: { type: "string", enum: ["US", "EU", "UK"], description: "Tax jurisdiction (default: from agent entity config)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "tax_generate_report",
    description:
      "Generate a full structured tax report for an agent for a given year and jurisdiction. " +
      "Includes all income sources, deductible expenses, non-deductible costs, estimated tax, effective rate, " +
      "required filing forms (e.g. Schedule C, Form 1120, CT600), and a summary. " +
      "Saved to tax_summaries table. Returns report_id for reference.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent to generate the report for" },
        tax_year:     { type: "number", description: "Tax year (default: current year)" },
        jurisdiction: { type: "string", enum: ["US", "EU", "UK"], description: "Tax jurisdiction" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "tax_set_entity",
    description:
      "Configure an agent's legal entity type and tax status. " +
      "Sets entity type (individual, LLC, corp, DAO), jurisdiction (US/EU/UK), " +
      "tax ID (EIN, VAT number, UTR), and accounting method (cash or accrual). " +
      "Must be called before tax_calculate or tax_generate_report for accurate results.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:          { type: "string", description: "Agent to configure" },
        entity_type:       { type: "string", enum: ["individual", "llc", "corp", "dao"], description: "Legal entity type" },
        jurisdiction:      { type: "string", enum: ["US", "EU", "UK"], description: "Tax jurisdiction" },
        tax_id:            { type: "string", description: "Tax ID: EIN (US), VAT number (EU), UTR (UK)" },
        accounting_method: { type: "string", enum: ["cash", "accrual"], description: "Accounting method (default: cash)" },
      },
      required: ["agent_id", "entity_type"],
    },
  },

  {
    name: "tax_accounting_dashboard",
    description:
      "Full accounting dashboard for an agent. " +
      "Shows YTD P&L (gross revenue, expenses, net profit, margin), estimated tax liability, " +
      "net cashflow after tax, last month comparison, recent transactions, " +
      "and tax summaries. Actionable recommendations if unprofitable or under-categorized.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get the dashboard for" },
      },
      required: ["agent_id"],
    },
  },

  // ── Phase 41: Regulatory Compliance ───────────────────────────────────────

  {
    name: "compliance_assess",
    description:
      "Run a comprehensive compliance assessment across multiple jurisdictions. " +
      "Covers GDPR (EU), UK GDPR, and US AML/FinCEN requirements. " +
      "Returns compliance score per jurisdiction (0-100), identified gaps, " +
      "and prioritized required actions. Saves results to compliance_profiles. " +
      "Schedule every 90 days. $5 per assessment.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent to assess" },
        jurisdictions: { type: "array", items: { type: "string", enum: ["EU", "US", "UK"] }, description: "Jurisdictions to assess (default: [EU, US])" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "compliance_check",
    description:
      "Run a specific compliance check for one regulation and jurisdiction. " +
      "check_type options: 'gdpr' (EU/UK data protection), 'ai_act' (EU AI Act transparency/oversight), " +
      "'mica' (crypto asset CASP registration), 'aml' (FinCEN/BSA anti-money laundering). " +
      "Returns pass/fail/warning with individual control results and remediation actions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent to check" },
        check_type:   { type: "string", enum: ["gdpr", "ai_act", "mica", "aml"], description: "Regulation to check" },
        jurisdiction: { type: "string", enum: ["EU", "US", "UK"], description: "Jurisdiction (default: EU)" },
      },
      required: ["agent_id", "check_type"],
    },
  },

  {
    name: "compliance_generate_report",
    description:
      "Generate a formal compliance report for an agent. " +
      "report_type options: 'gdpr', 'ai_act', 'mica', 'aml', 'full'. " +
      "Includes all check results, open incidents, executive summary, and prioritized recommendations. " +
      "Returns report_id. Saved to compliance_reports for audit trail.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent to report on" },
        report_type: { type: "string", enum: ["gdpr", "ai_act", "mica", "aml", "full"], description: "Report type (default: gdpr)" },
        jurisdiction: { type: "string", enum: ["EU", "US", "UK"], description: "Jurisdiction (default: EU)" },
        period:      { type: "string", description: "Reporting period (e.g. '2025-Q1'). Defaults to current quarter." },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "compliance_ai_act_risk",
    description:
      "Classify an agent under the EU AI Act (Regulation 2024/1689, in force August 2024). " +
      "Returns risk level: minimal / limited / high / prohibited. " +
      "High-risk systems face mandatory conformity assessment before deployment. " +
      "Prohibited systems cannot be deployed. Limited-risk requires transparency disclosures. " +
      "Returns full list of mandatory requirements and compliance deadlines.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string",  description: "Agent to classify" },
        use_case:       { type: "string",  description: "Agent's primary use case: healthcare, education, employment, finance, customer_service, content_creation, research, entertainment, personal_assistant, critical_infra, law_enforcement, biometric_mass, social_scoring" },
        data_used:      { type: "array",  items: { type: "string" }, description: "Types of data the agent processes (e.g. ['biometric', 'financial', 'health'])" },
        autonomy_level: { type: "string",  enum: ["low", "medium", "high"], description: "Degree of autonomous decision-making (default: low)" },
      },
      required: ["agent_id", "use_case"],
    },
  },

  {
    name: "compliance_report_incident",
    description:
      "Report a regulatory incident (required within 72 hours for GDPR data breaches under Article 33). " +
      "incident_type examples: 'data_breach', 'api_key_compromise', 'unauthorized_access', " +
      "'algorithm_bias', 'aml_violation', 'sanctions_breach'. " +
      "Returns notification requirements with deadlines (DPA, FinCEN, affected individuals) " +
      "and step-by-step remediation guidance. Critical severity triggers immediate escalation alert.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent that experienced the incident" },
        incident_type: { type: "string", description: "Type of incident (e.g. data_breach, aml_violation, api_key_compromise)" },
        severity:      { type: "string", enum: ["low", "medium", "high", "critical"], description: "Incident severity" },
        description:   { type: "string", description: "Description of what happened" },
      },
      required: ["agent_id", "incident_type", "severity"],
    },
  },

  {
    name: "compliance_dashboard",
    description:
      "Platform-wide regulatory compliance overview. " +
      "Shows total agents profiled, compliance rates by regulation, " +
      "EU AI Act risk distribution (minimal/limited/high/prohibited), " +
      "open incidents (with critical/high counts), check pass/fail rates by regulation. " +
      "No agent_id required. Use to monitor overall compliance posture.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 42: Inter-Agent Communication ───────────────────────────────────

  {
    name: "comm_send_message",
    description:
      "Send a message from one agent to another. " +
      "message_type options: 'request' (ask for service/data), 'response' (reply), " +
      "'negotiation' (price negotiation), 'alert' (urgent notification), 'broadcast'. " +
      "Set encrypt=true to AES-256-GCM encrypt the content (live mode) or Base64-encode (simulation). " +
      "Set expires_minutes to auto-expire time-sensitive messages. " +
      "Messages are threaded automatically between agent pairs.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent_id:   { type: "string",  description: "Sender agent ID" },
        to_agent_id:     { type: "string",  description: "Recipient agent ID" },
        message_type:    { type: "string",  enum: ["request", "response", "negotiation", "alert", "broadcast"], description: "Message type" },
        content:         { type: "string",  description: "Message content" },
        encrypt:         { type: "boolean", description: "Encrypt message content (default: false)" },
        expires_minutes: { type: "number",  description: "Auto-expire message after N minutes" },
      },
      required: ["from_agent_id", "to_agent_id", "content"],
    },
  },

  {
    name: "comm_get_messages",
    description:
      "Get an agent's inbox, outbox, or full message history. " +
      "direction: 'in' (inbox), 'out' (outbox), 'all'. " +
      "Set unread_only=true to get only unread messages. " +
      "Reading the inbox automatically marks messages as read. " +
      "Expired messages are filtered out. Max 200 messages per call.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string",  description: "Agent to fetch messages for" },
        direction:   { type: "string",  enum: ["in", "out", "all"], description: "Message direction (default: all)" },
        unread_only: { type: "boolean", description: "Return only unread messages (default: false)" },
        limit:       { type: "number",  description: "Max messages to return (default: 50, max: 200)" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "comm_start_negotiation",
    description:
      "Initiate a price negotiation with another agent for a service, task, or payment. " +
      "item: what is being negotiated (e.g. 'data_analysis_task', 'api_credits', 'content_generation'). " +
      "Returns negotiation_id for tracking. " +
      "Counterparty should respond with comm_counter_offer or comm_accept_negotiation. " +
      "Offers within 5% auto-settle after round 2.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent_id:      { type: "string", description: "Agent initiating the negotiation" },
        to_agent_id:        { type: "string", description: "Agent to negotiate with" },
        item:               { type: "string", description: "What is being negotiated (e.g. 'data_analysis', 'storage_gb', 'api_call_bundle')" },
        initial_offer_usdc: { type: "number", description: "Opening offer in USDC" },
        justification:      { type: "string", description: "Reason / justification for the offer (optional)" },
      },
      required: ["from_agent_id", "to_agent_id", "item", "initial_offer_usdc"],
    },
  },

  {
    name: "comm_counter_offer",
    description:
      "Make a counter-offer in an ongoing price negotiation. " +
      "Either participant (initiator or counterparty) can counter at any time while status is 'open'. " +
      "Returns updated round count and whether auto-acceptance was triggered. " +
      "Offers within 5% of each other after round 2 auto-settle at the midpoint.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id:    { type: "string", description: "Negotiation ID from comm_start_negotiation" },
        agent_id:          { type: "string", description: "Agent making the counter-offer (must be a participant)" },
        counter_offer_usdc:{ type: "number", description: "Counter-offer amount in USDC" },
        reason:            { type: "string", description: "Reason for counter-offer (optional)" },
      },
      required: ["negotiation_id", "agent_id", "counter_offer_usdc"],
    },
  },

  {
    name: "comm_accept_negotiation",
    description:
      "Accept the current offer in a negotiation and finalize the agreed price. " +
      "Works for both the initiator and counterparty. " +
      "Returns agreed_price_usdc and ready_to_pay=true. " +
      "After acceptance, use payment_send or x402_pay to transfer the agreed USDC amount.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: { type: "string", description: "Negotiation ID to accept" },
        agent_id:       { type: "string", description: "Agent accepting the deal (must be a participant)" },
      },
      required: ["negotiation_id", "agent_id"],
    },
  },

  {
    name: "comm_broadcast",
    description:
      "Broadcast a message to all agents matching a capability or category in the agent directory. " +
      "Use target_capability to reach agents that have a specific skill (e.g. 'payments', 'data_analysis'). " +
      "Use target_category to reach agents in a vertical (e.g. 'finance', 'research', 'cx'). " +
      "Returns list of recipients and count. Useful for capability discovery, service announcements, and coordination.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent_id:     { type: "string", description: "Agent sending the broadcast" },
        message:           { type: "string", description: "Broadcast message content" },
        target_capability: { type: "string", description: "Filter to agents with this capability (e.g. 'payments', 'audit', 'monitoring')" },
        target_category:   { type: "string", description: "Filter to agents in this category (e.g. 'finance', 'analytics', 'security')" },
      },
      required: ["from_agent_id", "message"],
    },
  },

  {
    name: "comm_agent_directory",
    description:
      "Browse the agent directory to find agents by capability or category. " +
      "Returns agent IDs, capabilities, categories, and message/negotiation stats. " +
      "Use to discover agents to collaborate with, delegate tasks to, or negotiate services. " +
      "Filter by capability (e.g. 'accounting', 'trading', 'research') or set active_only=false to include offline agents.",
    inputSchema: {
      type: "object",
      properties: {
        capability:  { type: "string",  description: "Filter by capability keyword (e.g. 'payments', 'audit', 'research')" },
        active_only: { type: "boolean", description: "Only show currently active agents (default: true)" },
        limit:       { type: "number",  description: "Max agents to return (default: 20, max: 100)" },
      },
      required: [],
    },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase4042Tool(name, args) {
  switch (name) {

    // Phase 40 — Tax & Accounting
    case "tax_record_transaction":     return recordTransaction(args);
    case "tax_get_pnl":                return getPnL(args);
    case "tax_calculate":              return calculateTax(args);
    case "tax_generate_report":        return generateTaxReport(args);
    case "tax_set_entity":             return setAgentEntity(args);
    case "tax_accounting_dashboard":   return getAccountingDashboard(args);

    // Phase 41 — Regulatory Compliance
    case "compliance_assess":          return assessCompliance(args);
    case "compliance_check":           return runComplianceCheck(args);
    case "compliance_generate_report": return generateComplianceReport(args);
    case "compliance_ai_act_risk":     return getAiActRiskLevel(args);
    case "compliance_report_incident": return reportIncident(args);
    case "compliance_dashboard":       return getComplianceDashboard();

    // Phase 42 — Inter-Agent Communication
    case "comm_send_message":          return sendMessage(args);
    case "comm_get_messages":          return getMessages(args);
    case "comm_start_negotiation":     return startNegotiation(args);
    case "comm_counter_offer":         return counterOffer(args);
    case "comm_accept_negotiation":    return acceptNegotiation(args);
    case "comm_broadcast":             return broadcastToAgents(args);
    case "comm_agent_directory":       return getAgentDirectory(args);

    default:
      throw new Error(`Unknown phase40-42 tool: ${name}`);
  }
}
