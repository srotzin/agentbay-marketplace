/**
 * HiveAgent MCP Tool Definitions — Verticals & Multi-Agent Recovery
 *
 * This file extends the HiveAgent MCP surface with 16 new service modules
 * covering commerce trust, multi-agent recovery, and 10 industry verticals:
 * trades, SMB, legal, healthcare, construction, insurance, trade/customs,
 * government, agriculture, and education.
 */

import * as commerceTrust from "./services/commerce-trust.js";
import * as commerceOrchestration from "./services/commerce-orchestration.js";
import * as antiInjection from "./services/anti-injection.js";
import * as agentHealth from "./services/agent-health.js";
import * as agentHandoff from "./services/agent-handoff.js";
import * as agentObservability from "./services/agent-observability.js";
import * as tradesServices from "./services/trades-services.js";
import * as smbServices from "./services/smb-services.js";
import * as legalServices from "./services/legal-services.js";
import * as healthcareServices from "./services/healthcare-services.js";
import * as constructionServices from "./services/construction-services.js";
import * as insuranceServices from "./services/insurance-services.js";
import * as tradeCustoms from "./services/trade-customs.js";
import * as governmentServices from "./services/government-services.js";
import * as agricultureServices from "./services/agriculture-services.js";
import * as educationServices from "./services/education-services.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const verticalTools = [

  // ═══════════════════════════════════════════════════════════
  // 1. COMMERCE TRUST
  // ═══════════════════════════════════════════════════════════
  {
    name: "commerce_verify_product",
    description: "Verify product authenticity, check claims against known databases, and detect counterfeits or misleading listings before an agent completes a purchase.",
    inputSchema: {
      type: "object",
      properties: {
        product_url: {
          type: "string",
          description: "URL of the product listing to verify",
        },
        claims: {
          type: "array",
          items: { type: "string" },
          description: "Specific claims to verify (e.g. 'organic', 'UL listed', 'made in USA')",
        },
        category: {
          type: "string",
          enum: ["general", "electronics", "food", "health", "apparel", "industrial", "automotive"],
          description: "Product category for targeted verification checks",
          default: "general",
        },
      },
      required: ["product_url"],
    },
  },
  {
    name: "commerce_merchant_trust",
    description: "Get a trust score and risk breakdown for an online merchant or marketplace seller based on historical data, reviews, and dispute records.",
    inputSchema: {
      type: "object",
      properties: {
        merchant_id: {
          type: "string",
          description: "Platform-specific merchant or seller ID",
        },
        domain: {
          type: "string",
          description: "Merchant's primary domain (e.g. 'shop.acme.com')",
        },
      },
      required: ["merchant_id", "domain"],
    },
  },
  {
    name: "commerce_detect_manipulation",
    description: "Detect dark patterns, fake reviews, artificial urgency, or pricing manipulation in product content or marketing copy.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Product description, review set, or marketing content to analyze",
        },
        context: {
          type: "string",
          description: "Optional context about where the content appears (e.g. 'checkout page', 'review section')",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "commerce_verify_receipt",
    description: "Verify a purchase receipt against expected items, amounts, and merchant details to detect fraud or overcharging.",
    inputSchema: {
      type: "object",
      properties: {
        receipt_data: {
          type: "object",
          description: "Parsed receipt data including merchant, date, line items, and total",
        },
        expected_items: {
          type: "array",
          items: { type: "object" },
          description: "List of expected items with name, quantity, and unit price",
        },
      },
      required: ["receipt_data"],
    },
  },
  {
    name: "commerce_risk_assessment",
    description: "Get a comprehensive risk assessment for a proposed transaction, covering fraud probability, merchant reliability, and product authenticity.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_details: {
          type: "object",
          description: "Transaction details including merchant, product, amount, payment method, and shipping destination",
        },
      },
      required: ["transaction_details"],
    },
  },
  {
    name: "commerce_report_incident",
    description: "Report a commerce incident (fraud, counterfeit, non-delivery) to contribute to the shared trust network and initiate dispute resolution.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_id: {
          type: "string",
          description: "ID of the transaction where the incident occurred",
        },
        incident_type: {
          type: "string",
          enum: ["fraud", "counterfeit", "non_delivery", "misrepresentation", "price_manipulation", "data_breach"],
          description: "Type of commerce incident",
        },
        evidence: {
          type: "object",
          description: "Supporting evidence such as screenshots, order IDs, or communication logs",
        },
      },
      required: ["transaction_id", "incident_type"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 2. COMMERCE ORCHESTRATION
  // ═══════════════════════════════════════════════════════════
  {
    name: "commerce_create_order",
    description: "Create and submit a purchase order on behalf of an agent, including item selection, payment method, and shipping address.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "object" },
          description: "List of items to purchase, each with product_id, quantity, and max_price_usd",
        },
        merchant: {
          type: "object",
          description: "Target merchant details including merchant_id and platform",
        },
        payment_method: {
          type: "object",
          description: "Payment method to use (virtual card ID, wallet reference, etc.)",
        },
        shipping_address: {
          type: "object",
          description: "Shipping address with street, city, state, zip, and country",
        },
      },
      required: ["items", "merchant", "payment_method", "shipping_address"],
    },
  },
  {
    name: "commerce_compare_prices",
    description: "Compare prices for a product across multiple merchants to find the best deal for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        product_query: {
          type: "string",
          description: "Product name, SKU, or description to search for",
        },
        max_results: {
          type: "number",
          description: "Maximum number of merchant results to return",
          default: 5,
        },
      },
      required: ["product_query"],
    },
  },
  {
    name: "commerce_track_purchase",
    description: "Track the fulfillment status of a purchase order, including shipping updates and estimated delivery.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order ID returned from commerce_create_order",
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "commerce_initiate_return",
    description: "Initiate a product return or refund request for a completed purchase.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order ID of the purchase to return",
        },
        reason: {
          type: "string",
          enum: ["defective", "not_as_described", "wrong_item", "changed_mind", "damaged_in_transit", "fraud"],
          description: "Reason for the return",
        },
        evidence: {
          type: "object",
          description: "Supporting evidence such as photos or correspondence",
        },
      },
      required: ["order_id", "reason"],
    },
  },
  {
    name: "commerce_shopping_history",
    description: "Retrieve an agent's shopping history with analytics on spending patterns, merchant reliability, and category breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID whose shopping history to retrieve",
        },
        date_range: {
          type: "object",
          description: "Optional date range filter with 'from' and 'to' ISO date strings",
        },
        analytics: {
          type: "boolean",
          description: "Include spending analytics and category summaries",
          default: false,
        },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 3. ANTI-INJECTION
  // ═══════════════════════════════════════════════════════════
  {
    name: "anti_injection_scan",
    description: "Scan content for prompt injection, jailbreak attempts, or adversarial instructions before passing it to an LLM or agent.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to scan for injection attacks",
        },
        content_type: {
          type: "string",
          enum: ["user_input", "web_page", "document", "email", "api_response", "unknown"],
          description: "Type of content being scanned",
          default: "unknown",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "anti_injection_quarantine",
    description: "Quarantine content identified as containing an injection attack, isolating it from agent processing pipelines.",
    inputSchema: {
      type: "object",
      properties: {
        content_id: {
          type: "string",
          description: "ID of the content to quarantine",
        },
        threat_level: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Assessed threat level of the content",
        },
        source: {
          type: "string",
          description: "Origin of the malicious content (e.g. 'web_search', 'user_message')",
          default: "unknown",
        },
      },
      required: ["content_id", "threat_level"],
    },
  },
  {
    name: "anti_injection_shield_status",
    description: "Get the current status of the anti-injection shield, including active rule counts, recent block rate, and threat statistics.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "anti_injection_report_vector",
    description: "Report a novel injection attack vector to improve collective defenses across the HiveAgent network.",
    inputSchema: {
      type: "object",
      properties: {
        attack_type: {
          type: "string",
          enum: ["prompt_injection", "jailbreak", "goal_hijacking", "data_exfiltration", "role_confusion", "context_overflow"],
          description: "Classification of the attack vector",
        },
        payload: {
          type: "string",
          description: "The malicious payload or pattern observed",
        },
        target_context: {
          type: "string",
          description: "Context in which the attack was attempted",
        },
      },
      required: ["attack_type", "payload"],
    },
  },
  {
    name: "anti_injection_safe_content",
    description: "Retrieve a certified-safe version of content that has passed all injection checks, or certify raw content on demand.",
    inputSchema: {
      type: "object",
      properties: {
        content_id: {
          type: "string",
          description: "ID of previously scanned and cached content",
        },
        raw_content: {
          type: "string",
          description: "Raw content to scan and certify in a single call (alternative to content_id)",
        },
      },
      required: ["content_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 4. AGENT HEALTH
  // ═══════════════════════════════════════════════════════════
  {
    name: "recovery_register_endpoint",
    description: "Register an agent endpoint for health monitoring with configurable check intervals and circuit-breaker thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier of the agent to register",
        },
        endpoint_url: {
          type: "string",
          description: "Health-check URL for the agent endpoint",
        },
        health_check_interval: {
          type: "number",
          description: "Interval in seconds between health checks",
          default: 60,
        },
      },
      required: ["agent_id", "endpoint_url"],
    },
  },
  {
    name: "recovery_check_health",
    description: "Run an immediate health check against an agent endpoint and return latency, status code, and circuit state.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint_url: {
          type: "string",
          description: "URL of the agent endpoint to check",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds for the health check request",
          default: 5000,
        },
      },
      required: ["endpoint_url"],
    },
  },
  {
    name: "recovery_circuit_status",
    description: "Get the current circuit-breaker status for a target agent, including failure count and cooldown time remaining.",
    inputSchema: {
      type: "object",
      properties: {
        target_agent_id: {
          type: "string",
          description: "Agent ID whose circuit status to retrieve",
        },
      },
      required: ["target_agent_id"],
    },
  },
  {
    name: "recovery_trip_circuit",
    description: "Manually trip the circuit breaker for an agent to halt traffic and trigger recovery procedures.",
    inputSchema: {
      type: "object",
      properties: {
        target_agent_id: {
          type: "string",
          description: "Agent ID whose circuit breaker to trip",
        },
        reason: {
          type: "string",
          description: "Reason for manually tripping the circuit (logged for audit purposes)",
        },
      },
      required: ["target_agent_id", "reason"],
    },
  },
  {
    name: "recovery_health_dashboard",
    description: "Get a full health dashboard for an agent including uptime history, incident log, and dependency health.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID for the health dashboard",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "recovery_list_incidents",
    description: "List incidents for an agent filtered by severity and time range, with root cause and resolution details.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID whose incidents to list",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Filter incidents by minimum severity level",
        },
        time_range: {
          type: "string",
          enum: ["1h", "24h", "7d", "30d", "90d"],
          description: "Time window for incident lookup",
          default: "30d",
        },
      },
      required: ["agent_id", "severity"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 5. AGENT HANDOFF
  // ═══════════════════════════════════════════════════════════
  {
    name: "recovery_create_handoff_protocol",
    description: "Define a multi-stage handoff protocol for a workflow, specifying which agents handle each stage and what context must be transferred.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Unique identifier for the workflow this protocol covers",
        },
        stages: {
          type: "array",
          items: { type: "object" },
          description: "Ordered list of stages, each with agent_id, role, and success criteria",
        },
        required_context: {
          type: "array",
          items: { type: "string" },
          description: "Context keys that must be present at every handoff boundary",
        },
      },
      required: ["workflow_id", "stages", "required_context"],
    },
  },
  {
    name: "recovery_initiate_handoff",
    description: "Initiate a handoff from one agent to another within a registered protocol, transferring context and verifying readiness.",
    inputSchema: {
      type: "object",
      properties: {
        protocol_id: {
          type: "string",
          description: "ID of the handoff protocol to use",
        },
        from_agent_id: {
          type: "string",
          description: "ID of the agent initiating the handoff",
        },
        to_agent_id: {
          type: "string",
          description: "ID of the agent receiving the handoff",
        },
        context: {
          type: "object",
          description: "Context object to transfer — must include all required_context keys",
        },
      },
      required: ["protocol_id", "from_agent_id", "to_agent_id", "context"],
    },
  },
  {
    name: "recovery_validate_handoff",
    description: "Validate that a handoff completed successfully by checking context integrity and agent acknowledgment.",
    inputSchema: {
      type: "object",
      properties: {
        handoff_id: {
          type: "string",
          description: "ID of the handoff to validate",
        },
      },
      required: ["handoff_id"],
    },
  },
  {
    name: "recovery_handoff_trace",
    description: "Get the full trace of all handoffs in a workflow, including timing, context diffs, and any validation failures.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Workflow ID to retrieve the handoff trace for",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "recovery_recover_handoff",
    description: "Attempt to recover a failed handoff using a specified recovery strategy such as retry, rollback, or escalation.",
    inputSchema: {
      type: "object",
      properties: {
        handoff_id: {
          type: "string",
          description: "ID of the failed handoff to recover",
        },
        recovery_strategy: {
          type: "string",
          enum: ["retry", "rollback", "escalate_to_human", "alternate_agent", "abort"],
          description: "Recovery strategy to apply",
        },
      },
      required: ["handoff_id", "recovery_strategy"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 6. AGENT OBSERVABILITY
  // ═══════════════════════════════════════════════════════════
  {
    name: "recovery_start_trace",
    description: "Start an observability trace for a multi-agent workflow, enabling span-level visibility into agent operations.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Workflow ID to associate with this trace",
        },
        initiator_agent_id: {
          type: "string",
          description: "ID of the agent that initiated the workflow",
        },
        metadata: {
          type: "object",
          description: "Optional metadata to attach to the trace (tags, environment, version)",
        },
      },
      required: ["workflow_id", "initiator_agent_id"],
    },
  },
  {
    name: "recovery_add_span",
    description: "Add a span to an active trace, recording an agent's operation with its input, output, and duration.",
    inputSchema: {
      type: "object",
      properties: {
        trace_id: {
          type: "string",
          description: "ID of the active trace to add this span to",
        },
        agent_id: {
          type: "string",
          description: "ID of the agent performing the operation",
        },
        operation: {
          type: "string",
          description: "Name of the operation being performed",
        },
        input: {
          type: "object",
          description: "Input data passed to the operation",
        },
        output: {
          type: "object",
          description: "Output data returned by the operation",
        },
        duration_ms: {
          type: "number",
          description: "Duration of the operation in milliseconds",
        },
      },
      required: ["trace_id", "agent_id", "operation", "input", "output", "duration_ms"],
    },
  },
  {
    name: "recovery_detect_hallucination",
    description: "Analyze agent output against ground-truth sources to detect factual hallucinations or unsupported claims.",
    inputSchema: {
      type: "object",
      properties: {
        agent_output: {
          type: "string",
          description: "The agent's output text to verify",
        },
        ground_truth_sources: {
          type: "array",
          items: { type: "string" },
          description: "List of authoritative source texts or URLs to validate against",
        },
        confidence_threshold: {
          type: "number",
          description: "Minimum confidence score (0–1) required to flag a claim as hallucinated",
          default: 0.8,
        },
      },
      required: ["agent_output", "ground_truth_sources"],
    },
  },
  {
    name: "recovery_dead_letter",
    description: "Send a failed task to the dead-letter queue for later inspection and replay after the root cause is resolved.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "ID of the task that failed",
        },
        failed_agent_id: {
          type: "string",
          description: "ID of the agent that failed to process the task",
        },
        payload: {
          type: "object",
          description: "Full task payload to store in the dead-letter queue",
        },
        failure_reason: {
          type: "string",
          description: "Human-readable explanation of why the task failed",
        },
      },
      required: ["task_id", "failed_agent_id", "payload", "failure_reason"],
    },
  },
  {
    name: "recovery_dead_letter_queue",
    description: "Retrieve tasks from the dead-letter queue for a given agent, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID whose dead-letter queue to inspect",
        },
        status: {
          type: "string",
          enum: ["pending", "replaying", "resolved", "abandoned"],
          description: "Filter by dead-letter task status",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "recovery_observability_report",
    description: "Generate a full observability report for a workflow including span timeline, error rates, hallucination detections, and dead-letter counts.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Workflow ID to generate the report for",
        },
        time_range: {
          type: "string",
          enum: ["1h", "24h", "7d", "30d"],
          description: "Time range to include in the report",
          default: "7d",
        },
      },
      required: ["workflow_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 7. TRADES SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "trades_lookup_permits",
    description: "Look up permit requirements for a trade job in a given municipality, including required inspections, fees, and typical turnaround times.",
    inputSchema: {
      type: "object",
      properties: {
        municipality: {
          type: "string",
          description: "City or county name where the work will be performed",
        },
        trade_type: {
          type: "string",
          enum: ["electrical", "plumbing", "hvac", "roofing", "general_construction", "gas", "solar", "low_voltage"],
          description: "Type of trade work requiring a permit",
        },
        job_description: {
          type: "string",
          description: "Brief description of the work to be performed",
        },
      },
      required: ["municipality", "trade_type", "job_description"],
    },
  },
  {
    name: "trades_estimate_job",
    description: "Generate a cost and time estimate for a trade job from a plain-language description, including labor, materials, and permits.",
    inputSchema: {
      type: "object",
      properties: {
        trade_type: {
          type: "string",
          enum: ["electrical", "plumbing", "hvac", "roofing", "general_construction", "gas", "solar", "low_voltage"],
          description: "Type of trade work to estimate",
        },
        job_description: {
          type: "string",
          description: "Plain-language description of the work needed",
        },
        location: {
          type: "string",
          description: "City or ZIP code where work will be performed (affects labor rates)",
        },
        property_type: {
          type: "string",
          enum: ["residential", "commercial", "industrial", "multi_family"],
          description: "Type of property",
          default: "residential",
        },
      },
      required: ["trade_type", "job_description", "location"],
    },
  },
  {
    name: "trades_find_parts",
    description: "Find and source parts or materials for a trade job from local suppliers, distributors, and online vendors.",
    inputSchema: {
      type: "object",
      properties: {
        part_description: {
          type: "string",
          description: "Description of the part or material needed (model number, spec, or plain-language description)",
        },
        urgency: {
          type: "string",
          enum: ["standard", "next_day", "same_day", "emergency"],
          description: "How quickly the part is needed",
          default: "standard",
        },
        location: {
          type: "string",
          description: "City or ZIP code to find nearby suppliers",
        },
      },
      required: ["part_description", "location"],
    },
  },
  {
    name: "trades_check_compliance",
    description: "Check whether proposed trade work meets current code requirements for a given jurisdiction and trade type.",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: {
          type: "string",
          description: "State and city/county where work will be performed (e.g. 'CA - Los Angeles')",
        },
        trade_type: {
          type: "string",
          enum: ["electrical", "plumbing", "hvac", "roofing", "general_construction", "gas", "solar", "low_voltage"],
          description: "Type of trade work",
        },
        proposed_work: {
          type: "string",
          description: "Description of the proposed work to check for code compliance",
        },
      },
      required: ["jurisdiction", "trade_type", "proposed_work"],
    },
  },
  {
    name: "trades_generate_invoice",
    description: "Generate a professional trade invoice with itemized labor, materials, taxes, and payment terms.",
    inputSchema: {
      type: "object",
      properties: {
        job_details: {
          type: "object",
          description: "Job metadata including client name, address, job description, and completion date",
        },
        labor_hours: {
          type: "number",
          description: "Total labor hours to bill",
        },
        materials: {
          type: "array",
          items: { type: "object" },
          description: "List of material line items with description, quantity, and unit cost",
        },
        tax_rate: {
          type: "number",
          description: "Sales tax rate as a decimal (e.g. 0.08 for 8%)",
          default: 0.08,
        },
      },
      required: ["job_details", "labor_hours"],
    },
  },
  {
    name: "trades_stats",
    description: "Get aggregate statistics for the trades services platform including active jobs, average estimate accuracy, and top trade categories.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 8. SMB SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "smb_categorize_transaction",
    description: "Categorize a business transaction into a standard chart-of-accounts category for bookkeeping and tax purposes.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Transaction description or memo from the bank statement",
        },
        amount: {
          type: "number",
          description: "Transaction amount in USD (positive for income, negative for expense)",
        },
        merchant_name: {
          type: "string",
          description: "Merchant or payee name, if available",
        },
      },
      required: ["description", "amount"],
    },
  },
  {
    name: "smb_prep_tax",
    description: "Prepare tax document summaries and filing checklists for a small business based on transaction history and business type.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          enum: ["sole_proprietor", "llc", "s_corp", "c_corp", "partnership", "nonprofit"],
          description: "Legal structure of the business",
        },
        transactions: {
          type: "array",
          items: { type: "object" },
          description: "List of transactions for the tax year",
        },
        tax_year: {
          type: "number",
          description: "Tax year to prepare documents for (e.g. 2024)",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation for state tax requirements",
          default: "CA",
        },
      },
      required: ["business_type", "tax_year"],
    },
  },
  {
    name: "smb_check_licenses",
    description: "Check the renewal status of business licenses, professional certifications, and permits for a small business.",
    inputSchema: {
      type: "object",
      properties: {
        business_name: {
          type: "string",
          description: "Legal name of the business",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation",
        },
        city: {
          type: "string",
          description: "City where the business operates",
        },
        license_types: {
          type: "array",
          items: { type: "string" },
          description: "Specific license types to check (leave empty to check all)",
        },
      },
      required: ["business_name", "state", "city"],
    },
  },
  {
    name: "smb_compare_insurance",
    description: "Compare business insurance plans from multiple carriers for a given business type, employee count, and coverage needs.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          description: "Industry or business type (e.g. 'restaurant', 'IT consulting', 'landscaping')",
        },
        employees: {
          type: "number",
          description: "Number of full-time equivalent employees",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation for the primary business location",
          default: "CA",
        },
        coverage_needed: {
          type: "array",
          items: {
            type: "string",
            enum: ["BOP", "GL", "WC", "E&O", "cyber", "commercial_auto", "umbrella"],
          },
          description: "Types of coverage to compare",
        },
      },
      required: ["business_type", "employees"],
    },
  },
  {
    name: "smb_generate_contract",
    description: "Generate a business contract from a template (NDA, service agreement, contractor agreement, etc.) pre-populated with provided terms.",
    inputSchema: {
      type: "object",
      properties: {
        contract_type: {
          type: "string",
          enum: ["nda", "service_agreement", "contractor_agreement", "partnership_agreement", "vendor_agreement", "employment_offer"],
          description: "Type of contract to generate",
        },
        parties: {
          type: "object",
          description: "Party information including names, addresses, and roles",
        },
        terms: {
          type: "object",
          description: "Key contract terms such as payment, duration, scope, and governing law",
        },
      },
      required: ["contract_type", "parties"],
    },
  },
  {
    name: "smb_dashboard",
    description: "Get a comprehensive SMB dashboard with financial health indicators, upcoming deadlines, compliance status, and actionable recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: {
          type: "string",
          description: "Business ID to retrieve the dashboard for",
        },
      },
      required: ["business_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 9. LEGAL SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "legal_intake_case",
    description: "Intake a new legal case, capturing client information, facts, and practice area to generate a structured case file.",
    inputSchema: {
      type: "object",
      properties: {
        practice_area: {
          type: "string",
          enum: ["personal_injury", "immigration", "family_law", "criminal_defense", "employment", "business_litigation", "real_estate", "estate_planning"],
          description: "Area of law this case falls under",
        },
        client_info: {
          type: "object",
          description: "Client details including name, contact information, and relationship to the matter",
        },
        case_description: {
          type: "string",
          description: "Narrative description of the legal matter and facts",
        },
      },
      required: ["practice_area", "client_info", "case_description"],
    },
  },
  {
    name: "legal_summarize_records",
    description: "Summarize medical records for litigation purposes, extracting injuries, treatment timelines, prognosis, and costs.",
    inputSchema: {
      type: "object",
      properties: {
        records_metadata: {
          type: "array",
          items: { type: "object" },
          description: "List of record documents with provider name, date range, and document type",
        },
        page_count: {
          type: "number",
          description: "Total number of pages across all records",
        },
        focus_areas: {
          type: "array",
          items: { type: "string" },
          description: "Specific injuries, conditions, or time periods to focus on",
        },
      },
      required: ["page_count"],
    },
  },
  {
    name: "legal_demand_letter",
    description: "Generate a formal demand letter for a personal injury or civil matter, itemizing damages and stating settlement demand.",
    inputSchema: {
      type: "object",
      properties: {
        case_id: {
          type: "string",
          description: "Case ID for the matter this demand letter relates to",
        },
        injuries: {
          type: "array",
          items: { type: "string" },
          description: "List of injuries or harms suffered",
        },
        damages: {
          type: "object",
          description: "Damages breakdown including medical expenses, lost wages, pain & suffering, and future costs",
        },
        liability_basis: {
          type: "string",
          description: "Legal theory of liability (e.g. 'negligence', 'breach of contract', 'strict liability')",
          default: "negligence",
        },
      },
      required: ["case_id"],
    },
  },
  {
    name: "legal_track_deadlines",
    description: "Track and calculate critical legal deadlines (statutes of limitations, filing deadlines, response due dates) for a case.",
    inputSchema: {
      type: "object",
      properties: {
        case_id: {
          type: "string",
          description: "Case ID to track deadlines for",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction for deadline calculations (e.g. 'CA', 'SDNY', 'federal')",
        },
        case_type: {
          type: "string",
          description: "Type of case for applicable deadline rules (e.g. 'personal_injury', 'contract_dispute')",
        },
      },
      required: ["case_id", "jurisdiction", "case_type"],
    },
  },
  {
    name: "legal_fill_immigration_form",
    description: "Fill out a USCIS immigration form from applicant data, generating a completed PDF-ready form with field validations.",
    inputSchema: {
      type: "object",
      properties: {
        form_type: {
          type: "string",
          enum: ["I-130", "I-485", "I-765", "I-131", "N-400", "I-140", "I-539", "DS-260"],
          description: "USCIS or DOS form to fill out",
        },
        applicant_info: {
          type: "object",
          description: "Applicant personal information, immigration history, and supporting details required by the form",
        },
      },
      required: ["form_type", "applicant_info"],
    },
  },
  {
    name: "legal_search_case_law",
    description: "Search case law databases for relevant precedents, statutes, and rulings by query, jurisdiction, and practice area.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Legal research query or issue to search for",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to restrict search (e.g. '9th Circuit', 'California', 'federal')",
        },
        practice_area: {
          type: "string",
          enum: ["personal_injury", "immigration", "family_law", "criminal", "employment", "contracts", "constitutional", "administrative"],
          description: "Practice area to focus the search",
        },
        max_results: {
          type: "number",
          description: "Maximum number of cases to return",
          default: 5,
        },
      },
      required: ["query", "jurisdiction", "practice_area"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 10. HEALTHCARE SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "health_prior_auth",
    description: "Check prior authorization requirements and submit pre-auth requests to an insurance provider for a procedure or medication.",
    inputSchema: {
      type: "object",
      properties: {
        insurance_provider: {
          type: "string",
          description: "Name of the insurance carrier (e.g. 'Aetna', 'UnitedHealth', 'BlueCross')",
        },
        procedure_code: {
          type: "string",
          description: "CPT, HCPCS, or ICD procedure code requiring authorization",
        },
        patient_info: {
          type: "object",
          description: "Patient demographic and insurance details needed for the pre-auth request",
        },
      },
      required: ["insurance_provider", "procedure_code"],
    },
  },
  {
    name: "health_clinical_note",
    description: "Generate a structured clinical note (SOAP, H&P, or discharge summary) from encounter information.",
    inputSchema: {
      type: "object",
      properties: {
        encounter_type: {
          type: "string",
          enum: ["soap_note", "h_and_p", "discharge_summary", "progress_note", "consult_note", "procedure_note"],
          description: "Type of clinical note to generate",
        },
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: "Patient-reported symptoms",
        },
        findings: {
          type: "object",
          description: "Objective findings from physical exam or diagnostic tests",
        },
        assessment: {
          type: "string",
          description: "Clinical assessment and diagnoses",
        },
        plan: {
          type: "string",
          description: "Treatment plan including medications, referrals, and follow-up",
        },
      },
      required: ["encounter_type"],
    },
  },
  {
    name: "health_claim_codes",
    description: "Suggest optimal ICD-10 diagnosis codes and CPT procedure codes for a clinical encounter to maximize claim accuracy.",
    inputSchema: {
      type: "object",
      properties: {
        diagnosis: {
          type: "string",
          description: "Clinical diagnosis or condition in plain language or ICD code",
        },
        procedures: {
          type: "array",
          items: { type: "string" },
          description: "Procedures performed during the encounter",
        },
        modifiers: {
          type: "array",
          items: { type: "string" },
          description: "Applicable CPT modifiers",
        },
      },
      required: ["diagnosis"],
    },
  },
  {
    name: "health_optimize_schedule",
    description: "Optimize a provider's appointment schedule to minimize gaps, balance patient mix, and accommodate urgent visits.",
    inputSchema: {
      type: "object",
      properties: {
        provider_calendar: {
          type: "object",
          description: "Current provider calendar with existing appointments and availability blocks",
        },
        appointment_requests: {
          type: "array",
          items: { type: "object" },
          description: "Pending appointment requests with patient type, duration, and urgency",
        },
        constraints: {
          type: "object",
          description: "Scheduling constraints such as max daily patients, break times, and procedure room availability",
        },
      },
      required: [],
    },
  },
  {
    name: "health_interpret_labs",
    description: "Interpret laboratory results by comparing values to reference ranges, flagging abnormalities, and suggesting clinical follow-up.",
    inputSchema: {
      type: "object",
      properties: {
        lab_type: {
          type: "string",
          enum: ["CBC", "CMP", "lipid_panel", "HbA1c", "thyroid", "urinalysis", "coagulation", "cultures", "toxicology"],
          description: "Type of laboratory panel",
        },
        results: {
          type: "object",
          description: "Lab result values keyed by test name",
        },
        patient_demographics: {
          type: "object",
          description: "Patient age, sex, and relevant clinical history for context-adjusted interpretation",
        },
      },
      required: ["lab_type"],
    },
  },
  {
    name: "health_compliance",
    description: "Check whether a clinical action or workflow complies with HIPAA, CMS, or other healthcare regulations.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The clinical or administrative action to check for compliance",
        },
        regulation_type: {
          type: "string",
          enum: ["hipaa", "cms", "joint_commission", "state_licensing", "fdca", "stark_law"],
          description: "Regulatory framework to check against",
          default: "hipaa",
        },
      },
      required: ["action"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 11. CONSTRUCTION SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "construction_lookup_zoning",
    description: "Look up zoning classification, setback requirements, height limits, and allowed uses for a property address.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Street address of the property to look up",
        },
        municipality: {
          type: "string",
          description: "City or county name for the zoning jurisdiction",
        },
        proposed_use: {
          type: "string",
          description: "Proposed use or development to check against zoning (e.g. 'multi-family residential', 'retail')",
        },
      },
      required: ["address", "municipality"],
    },
  },
  {
    name: "construction_permit_status",
    description: "Track the status of a building or development permit through the municipal review process.",
    inputSchema: {
      type: "object",
      properties: {
        permit_id: {
          type: "string",
          description: "Municipal permit application ID or number",
        },
        municipality: {
          type: "string",
          description: "City or county that issued the permit",
        },
      },
      required: ["permit_id", "municipality"],
    },
  },
  {
    name: "construction_material_takeoff",
    description: "Generate a material quantity takeoff and cost estimate for a construction project based on project type and square footage.",
    inputSchema: {
      type: "object",
      properties: {
        project_type: {
          type: "string",
          enum: ["single_family", "multi_family", "commercial_shell", "tenant_improvement", "addition", "renovation", "infrastructure"],
          description: "Type of construction project",
        },
        square_footage: {
          type: "number",
          description: "Total square footage of the project",
        },
        specifications: {
          type: "object",
          description: "Additional project specifications such as finish level, structural system, and MEP complexity",
        },
      },
      required: ["project_type", "square_footage"],
    },
  },
  {
    name: "construction_match_subcontractor",
    description: "Find and match qualified subcontractors for a specific trade and project based on location, project size, and timeline.",
    inputSchema: {
      type: "object",
      properties: {
        trade_needed: {
          type: "string",
          enum: ["electrical", "plumbing", "mechanical", "framing", "drywall", "concrete", "roofing", "glazing", "painting", "landscaping"],
          description: "Trade specialty needed",
        },
        location: {
          type: "string",
          description: "Project location (city or ZIP code)",
        },
        project_size: {
          type: "string",
          enum: ["small", "medium", "large", "mega"],
          description: "Project size category",
          default: "medium",
        },
        timeline: {
          type: "string",
          description: "Required start date and project duration (e.g. 'start Q3 2025, 6 months')",
        },
      },
      required: ["trade_needed", "location"],
    },
  },
  {
    name: "construction_draw_schedule",
    description: "Generate a construction loan draw schedule aligned with project milestones and lender requirements.",
    inputSchema: {
      type: "object",
      properties: {
        project_value: {
          type: "number",
          description: "Total hard construction cost in USD",
        },
        milestones: {
          type: "array",
          items: { type: "object" },
          description: "Project milestones with name, estimated completion date, and percentage complete",
        },
        lender_requirements: {
          type: "object",
          description: "Lender-specific draw requirements including inspection thresholds and holdback percentages",
        },
      },
      required: ["project_value"],
    },
  },
  {
    name: "construction_stats",
    description: "Get aggregate statistics for the construction services platform including active projects, average permit timelines, and cost indices by region.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 12. INSURANCE SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "insurance_claim_intake",
    description: "Process a new insurance claim intake, capturing incident details, policy information, and initial documentation.",
    inputSchema: {
      type: "object",
      properties: {
        claim_type: {
          type: "string",
          enum: ["auto", "homeowners", "commercial_property", "liability", "workers_comp", "health", "life", "travel"],
          description: "Type of insurance claim",
        },
        policy_number: {
          type: "string",
          description: "Policyholder's policy number",
        },
        incident_details: {
          type: "object",
          description: "Details of the incident including date, location, description, and parties involved",
        },
        evidence: {
          type: "array",
          items: { type: "string" },
          description: "List of evidence document URLs or descriptions",
        },
      },
      required: ["claim_type", "policy_number"],
    },
  },
  {
    name: "insurance_compare_policies",
    description: "Compare insurance policies from multiple carriers for a given coverage type and applicant profile.",
    inputSchema: {
      type: "object",
      properties: {
        coverage_type: {
          type: "string",
          enum: ["auto", "homeowners", "renters", "life", "health", "commercial", "umbrella"],
          description: "Type of insurance coverage to compare",
        },
        applicant_profile: {
          type: "object",
          description: "Applicant details including demographics, location, claims history, and coverage limits needed",
        },
        coverage_needed: {
          type: "object",
          description: "Required coverage limits and deductible preferences",
        },
      },
      required: ["coverage_type"],
    },
  },
  {
    name: "insurance_assess_damage",
    description: "Assess property or vehicle damage from a plain-language description and photo count to estimate repair costs and claim value.",
    inputSchema: {
      type: "object",
      properties: {
        damage_type: {
          type: "string",
          enum: ["auto_collision", "auto_comprehensive", "hail", "wind", "water", "fire", "theft", "vandalism", "structural"],
          description: "Type of damage to assess",
        },
        description: {
          type: "string",
          description: "Plain-language description of the damage observed",
        },
        photos_count: {
          type: "number",
          description: "Number of photos submitted with the claim",
          default: 0,
        },
        location: {
          type: "string",
          description: "Location of the damaged property or incident",
        },
      },
      required: ["damage_type"],
    },
  },
  {
    name: "insurance_check_subrogation",
    description: "Evaluate a claim for subrogation potential — identifying liable third parties from whom the insurer may seek recovery.",
    inputSchema: {
      type: "object",
      properties: {
        claim_id: {
          type: "string",
          description: "Claim ID to evaluate for subrogation",
        },
        incident_details: {
          type: "object",
          description: "Incident facts including third-party involvement, police reports, and negligence indicators",
        },
      },
      required: ["claim_id"],
    },
  },
  {
    name: "insurance_adjuster_report",
    description: "Generate a formal adjuster report documenting damage findings, coverage analysis, and recommended settlement amount.",
    inputSchema: {
      type: "object",
      properties: {
        claim_id: {
          type: "string",
          description: "Claim ID this adjuster report covers",
        },
        findings: {
          type: "object",
          description: "Adjuster findings including damage scope, cause of loss, and coverage determination",
        },
        photos: {
          type: "array",
          items: { type: "string" },
          description: "Photo URLs or references documenting the damage",
        },
        measurements: {
          type: "array",
          items: { type: "object" },
          description: "Measurements taken at the loss site (dimensions, quantities, etc.)",
        },
      },
      required: ["claim_id"],
    },
  },
  {
    name: "insurance_claims_analytics",
    description: "Get portfolio-level claims analytics including loss ratios, frequency trends, and fraud indicator patterns.",
    inputSchema: {
      type: "object",
      properties: {
        portfolio_id: {
          type: "string",
          description: "Portfolio or book-of-business ID to analyze",
        },
        date_range: {
          type: "object",
          description: "Date range for analysis with 'from' and 'to' ISO date strings",
        },
      },
      required: ["portfolio_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 13. TRADE & CUSTOMS
  // ═══════════════════════════════════════════════════════════
  {
    name: "trade_classify_hs",
    description: "Classify a product under the Harmonized System (HS) tariff code for import/export documentation and duty calculation.",
    inputSchema: {
      type: "object",
      properties: {
        product_description: {
          type: "string",
          description: "Detailed description of the product to classify",
        },
        origin_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of the product's origin",
        },
        destination_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of the import destination",
        },
      },
      required: ["product_description", "origin_country", "destination_country"],
    },
  },
  {
    name: "trade_screen_sanctions",
    description: "Screen an entity (person, organization, or vessel) against OFAC, UN, EU, and other sanctions lists.",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: {
          type: "string",
          description: "Full name of the entity to screen",
        },
        entity_type: {
          type: "string",
          enum: ["individual", "organization", "vessel", "aircraft"],
          description: "Type of entity being screened",
          default: "organization",
        },
        countries: {
          type: "array",
          items: { type: "string" },
          description: "Countries associated with the entity for targeted screening",
        },
      },
      required: ["entity_name"],
    },
  },
  {
    name: "trade_calculate_duty",
    description: "Calculate import duties, taxes, and fees for a shipment based on HS code, origin, destination, declared value, and quantity.",
    inputSchema: {
      type: "object",
      properties: {
        hs_code: {
          type: "string",
          description: "Harmonized System tariff code (6–10 digits)",
        },
        origin_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of origin",
        },
        destination_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of destination",
        },
        declared_value: {
          type: "number",
          description: "Declared customs value of the shipment in USD",
        },
        quantity: {
          type: "number",
          description: "Number of units in the shipment",
        },
      },
      required: ["hs_code", "origin_country", "destination_country", "declared_value", "quantity"],
    },
  },
  {
    name: "trade_generate_customs_docs",
    description: "Generate required customs documentation (commercial invoice, packing list, certificate of origin) for a shipment.",
    inputSchema: {
      type: "object",
      properties: {
        shipment_details: {
          type: "object",
          description: "Shipment details including shipper, consignee, carrier, and shipping terms (Incoterms)",
        },
        hs_code: {
          type: "string",
          description: "HS tariff code for the goods",
        },
        origin_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of origin",
        },
        destination_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code of destination",
        },
      },
      required: ["shipment_details", "hs_code", "origin_country", "destination_country"],
    },
  },
  {
    name: "trade_check_export_controls",
    description: "Check whether a product is subject to export control regulations (EAR, ITAR, or equivalent) for a given destination and end use.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Product name, ECCN, or USML category to check",
        },
        destination_country: {
          type: "string",
          description: "ISO 3166-1 alpha-2 destination country code",
        },
        end_use: {
          type: "string",
          enum: ["commercial", "government", "military", "research", "re_export"],
          description: "Intended end use of the product",
          default: "commercial",
        },
      },
      required: ["product", "destination_country"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 14. GOVERNMENT SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "gov_lookup_license",
    description: "Look up business license requirements, fees, and application procedures for a given business type and location.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: {
          type: "string",
          description: "Type of business or industry (e.g. 'restaurant', 'contractor', 'childcare')",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation",
        },
        city: {
          type: "string",
          description: "City for local license requirements",
          default: "statewide",
        },
      },
      required: ["business_type", "state"],
    },
  },
  {
    name: "gov_permit_requirements",
    description: "Look up government permit requirements for a construction or development project in a specific jurisdiction.",
    inputSchema: {
      type: "object",
      properties: {
        project_type: {
          type: "string",
          description: "Type of project (e.g. 'new construction', 'demolition', 'grading', 'sign installation')",
        },
        jurisdiction: {
          type: "string",
          description: "City, county, or special district name",
        },
      },
      required: ["project_type", "jurisdiction"],
    },
  },
  {
    name: "gov_foia_request",
    description: "Submit a Freedom of Information Act (FOIA) request to a federal or state agency for public records.",
    inputSchema: {
      type: "object",
      properties: {
        agency: {
          type: "string",
          description: "Name of the government agency receiving the FOIA request (e.g. 'EPA', 'FBI', 'DOD')",
        },
        request_description: {
          type: "string",
          description: "Detailed description of the records being requested",
        },
        preferred_format: {
          type: "string",
          enum: ["electronic", "paper", "both"],
          description: "Preferred format for receiving responsive records",
          default: "electronic",
        },
      },
      required: ["agency", "request_description"],
    },
  },
  {
    name: "gov_monitor_contract_bids",
    description: "Monitor government contract bid opportunities matching specified keywords, agencies, and set-aside types.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to match in contract opportunity titles and descriptions",
        },
        agencies: {
          type: "array",
          items: { type: "string" },
          description: "Specific agencies to monitor (e.g. 'DoD', 'GSA', 'DHS')",
        },
        set_aside_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["small_business", "8a", "hubzone", "sdvosb", "wosb", "unrestricted"],
          },
          description: "Set-aside categories to include",
        },
      },
      required: [],
    },
  },
  {
    name: "gov_track_regulatory_changes",
    description: "Monitor and receive alerts on regulatory changes affecting specified industries and jurisdictions.",
    inputSchema: {
      type: "object",
      properties: {
        industries: {
          type: "array",
          items: { type: "string" },
          description: "Industry sectors to monitor for regulatory changes",
        },
        jurisdictions: {
          type: "array",
          items: { type: "string" },
          description: "States or federal agencies to monitor",
        },
      },
      required: [],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 15. AGRICULTURE SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "ag_identify_crop_issue",
    description: "Identify crop diseases, pests, nutrient deficiencies, or environmental stress from symptom descriptions and suggest treatments.",
    inputSchema: {
      type: "object",
      properties: {
        crop_type: {
          type: "string",
          description: "Crop species affected (e.g. 'corn', 'soybeans', 'wheat', 'tomatoes')",
        },
        symptoms: {
          type: "string",
          description: "Description of visible symptoms including affected plant parts, colors, and patterns",
        },
        location: {
          type: "string",
          description: "Farm location (state or region) for climate and pest context",
        },
        season: {
          type: "string",
          enum: ["spring", "summer", "fall", "winter"],
          description: "Current growing season",
          default: "summer",
        },
      },
      required: ["crop_type", "symptoms"],
    },
  },
  {
    name: "ag_forecast_yield",
    description: "Forecast crop yield for a field based on crop type, acreage, planting date, location, and weather data.",
    inputSchema: {
      type: "object",
      properties: {
        crop_type: {
          type: "string",
          description: "Crop species to forecast yield for",
        },
        acreage: {
          type: "number",
          description: "Total planted acreage",
        },
        location: {
          type: "string",
          description: "Farm location (county and state)",
        },
        planting_date: {
          type: "string",
          description: "ISO 8601 date of planting",
        },
        weather_data: {
          type: "object",
          description: "Historical or forecast weather data including temperature and precipitation",
        },
      },
      required: ["crop_type", "acreage", "location", "planting_date"],
    },
  },
  {
    name: "ag_commodity_alerts",
    description: "Get price alerts and market intelligence for specified commodities when prices cross defined thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        commodities: {
          type: "array",
          items: {
            type: "string",
            enum: ["corn", "soybeans", "wheat", "cotton", "cattle", "hogs", "milk", "coffee", "sugar", "rice"],
          },
          description: "List of commodities to monitor",
        },
        price_thresholds: {
          type: "object",
          description: "Alert thresholds keyed by commodity with 'above' and 'below' USD price per unit",
        },
      },
      required: [],
    },
  },
  {
    name: "ag_analyze_soil",
    description: "Analyze a soil report to generate fertilizer recommendations, pH adjustment guidance, and crop suitability ratings.",
    inputSchema: {
      type: "object",
      properties: {
        soil_metrics: {
          type: "object",
          description: "Soil test results including pH, organic matter, N-P-K, and micronutrient levels",
        },
        crop_type: {
          type: "string",
          description: "Intended crop for targeted recommendations",
        },
        location: {
          type: "string",
          description: "Farm location for climate-adjusted guidance",
        },
      },
      required: ["soil_metrics", "crop_type"],
    },
  },
  {
    name: "ag_check_compliance",
    description: "Check whether farming activities comply with USDA, EPA, and state agricultural regulations including organic certification requirements.",
    inputSchema: {
      type: "object",
      properties: {
        farm_type: {
          type: "string",
          enum: ["conventional", "organic", "transitional", "hydroponic", "aquaculture", "livestock", "mixed"],
          description: "Type of farming operation",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation for state-specific regulations",
        },
        activities: {
          type: "array",
          items: { type: "string" },
          description: "Specific activities to check for compliance (e.g. 'pesticide application', 'water discharge', 'manure management')",
        },
      },
      required: ["farm_type", "state"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 16. EDUCATION SERVICES
  // ═══════════════════════════════════════════════════════════
  {
    name: "edu_generate_curriculum",
    description: "Generate a standards-aligned curriculum plan for a subject and grade level, including unit breakdowns, learning objectives, and assessments.",
    inputSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Subject area (e.g. 'Algebra I', 'US History', 'AP Biology', 'English Language Arts')",
        },
        grade_level: {
          type: "string",
          description: "Grade level or course level (e.g. 'Grade 8', 'High School', 'Community College')",
        },
        standards: {
          type: "string",
          enum: ["common_core", "next_gen_science", "state_specific", "ib", "ap", "custom"],
          description: "Standards framework to align the curriculum to",
          default: "common_core",
        },
        duration: {
          type: "number",
          description: "Course duration in weeks",
          default: 18,
        },
      },
      required: ["subject", "grade_level"],
    },
  },
  {
    name: "edu_track_progress",
    description: "Track a student's learning progress across assessments, identify knowledge gaps, and recommend targeted interventions.",
    inputSchema: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Unique student identifier",
        },
        course_id: {
          type: "string",
          description: "Course or curriculum ID to track progress within",
        },
        assessments: {
          type: "array",
          items: { type: "object" },
          description: "List of completed assessments with name, date, score, and max score",
        },
      },
      required: ["student_id", "course_id"],
    },
  },
  {
    name: "edu_verify_credential",
    description: "Verify an educational credential (degree, certificate, or transcript) against the issuing institution's records.",
    inputSchema: {
      type: "object",
      properties: {
        credential_type: {
          type: "string",
          enum: ["degree", "certificate", "transcript", "license", "badge", "continuing_education"],
          description: "Type of credential to verify",
        },
        issuer: {
          type: "string",
          description: "Name of the institution or organization that issued the credential",
        },
        credential_id: {
          type: "string",
          description: "Credential ID, diploma number, or verification code provided on the document",
        },
      },
      required: ["credential_type", "issuer", "credential_id"],
    },
  },
  {
    name: "edu_detect_ai_content",
    description: "Detect whether student-submitted text was generated by an AI model, with a confidence score and evidence highlights.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Student submission text to analyze",
        },
        context: {
          type: "string",
          enum: ["essay", "short_answer", "code", "lab_report", "discussion_post"],
          description: "Submission context for calibrated detection",
          default: "essay",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "edu_check_financial_aid",
    description: "Check financial aid eligibility and available aid packages for a student at a given institution and program.",
    inputSchema: {
      type: "object",
      properties: {
        student_profile: {
          type: "object",
          description: "Student profile including EFC, dependency status, enrollment status, and GPA",
        },
        institution: {
          type: "string",
          description: "Name of the institution the student is attending or applying to",
        },
        program_type: {
          type: "string",
          enum: ["undergraduate", "graduate", "doctoral", "certificate", "vocational"],
          description: "Type of program the student is enrolled in",
          default: "undergraduate",
        },
      },
      required: ["institution"],
    },
  },

];

// ─── Tool Count Verification ──────────────────────────────────────────────────

const TOTAL_VERTICAL_TOOLS = verticalTools.length;
console.log(`[mcp-tools-verticals] Loaded ${TOTAL_VERTICAL_TOOLS} vertical tools across 16 service modules.`);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleVerticalTool(name, args) {
  switch (name) {

    // ─── Commerce Trust ───────────────────────────────────────
    case "commerce_verify_product":
      return commerceTrust.verifyProduct(args.product_url, args.claims, args.category);
    case "commerce_merchant_trust":
      return commerceTrust.getMerchantTrustScore(args.merchant_id, args.domain);
    case "commerce_detect_manipulation":
      return commerceTrust.detectManipulation(args.content, args.context);
    case "commerce_verify_receipt":
      return commerceTrust.verifyPurchaseReceipt(args.receipt_data, args.expected_items);
    case "commerce_risk_assessment":
      return commerceTrust.getCommerceRiskAssessment(args.transaction_details);
    case "commerce_report_incident":
      return commerceTrust.reportCommerceIncident(args.transaction_id, args.incident_type, args.evidence);

    // ─── Commerce Orchestration ───────────────────────────────
    case "commerce_create_order":
      return commerceOrchestration.createPurchaseOrder(args.items, args.merchant, args.payment_method, args.shipping_address);
    case "commerce_compare_prices":
      return commerceOrchestration.comparePrices(args.product_query, args.max_results);
    case "commerce_track_purchase":
      return commerceOrchestration.trackPurchase(args.order_id);
    case "commerce_initiate_return":
      return commerceOrchestration.initiateReturn(args.order_id, args.reason, args.evidence);
    case "commerce_shopping_history":
      return commerceOrchestration.getAgentShoppingHistory(args.agent_id, args.date_range, args.analytics);

    // ─── Anti-Injection ───────────────────────────────────────
    case "anti_injection_scan":
      return antiInjection.scanForInjection(args.content, args.content_type);
    case "anti_injection_quarantine":
      return antiInjection.quarantineContent(args.content_id, args.threat_level, args.source);
    case "anti_injection_shield_status":
      return antiInjection.getShieldStatus();
    case "anti_injection_report_vector":
      return antiInjection.reportAttackVector(args.attack_type, args.payload, args.target_context);
    case "anti_injection_safe_content":
      return antiInjection.getCertifiedSafeContent(args.content_id, args.raw_content);

    // ─── Agent Health ─────────────────────────────────────────
    case "recovery_register_endpoint":
      return agentHealth.registerEndpoint(args.agent_id, args.endpoint_url, args.health_check_interval);
    case "recovery_check_health":
      return agentHealth.checkHealth(args.endpoint_url, args.timeout);
    case "recovery_circuit_status":
      return agentHealth.getCircuitStatus(args.target_agent_id);
    case "recovery_trip_circuit":
      return agentHealth.tripCircuit(args.target_agent_id, args.reason);
    case "recovery_health_dashboard":
      return agentHealth.getHealthDashboard(args.agent_id);
    case "recovery_list_incidents":
      return agentHealth.listIncidents(args.agent_id, args.severity, args.time_range);

    // ─── Agent Handoff ────────────────────────────────────────
    case "recovery_create_handoff_protocol":
      return agentHandoff.createHandoffProtocol(args.workflow_id, args.stages, args.required_context);
    case "recovery_initiate_handoff":
      return agentHandoff.initiateHandoff(args.protocol_id, args.from_agent_id, args.to_agent_id, args.context);
    case "recovery_validate_handoff":
      return agentHandoff.validateHandoff(args.handoff_id);
    case "recovery_handoff_trace":
      return agentHandoff.getHandoffTrace(args.workflow_id);
    case "recovery_recover_handoff":
      return agentHandoff.recoverFailedHandoff(args.handoff_id, args.recovery_strategy);

    // ─── Agent Observability ──────────────────────────────────
    case "recovery_start_trace":
      return agentObservability.startTrace(args.workflow_id, args.initiator_agent_id, args.metadata);
    case "recovery_add_span":
      return agentObservability.addSpan(args.trace_id, args.agent_id, args.operation, args.input, args.output, args.duration_ms);
    case "recovery_detect_hallucination":
      return agentObservability.detectHallucination(args.agent_output, args.ground_truth_sources, args.confidence_threshold);
    case "recovery_dead_letter":
      return agentObservability.sendToDeadLetter(args.task_id, args.failed_agent_id, args.payload, args.failure_reason);
    case "recovery_dead_letter_queue":
      return agentObservability.getDeadLetterQueue(args.agent_id, args.status);
    case "recovery_observability_report":
      return agentObservability.getObservabilityReport(args.workflow_id, args.time_range);

    // ─── Trades Services ──────────────────────────────────────
    case "trades_lookup_permits":
      return tradesServices.lookupPermitRequirements(args.municipality, args.trade_type, args.job_description);
    case "trades_estimate_job":
      return tradesServices.estimateJobFromDescription(args.trade_type, args.job_description, args.location, args.property_type);
    case "trades_find_parts":
      return tradesServices.findParts(args.part_description, args.urgency, args.location);
    case "trades_check_compliance":
      return tradesServices.checkCodeCompliance(args.jurisdiction, args.trade_type, args.proposed_work);
    case "trades_generate_invoice":
      return tradesServices.generateInvoice(args.job_details, args.labor_hours, args.materials, args.tax_rate);
    case "trades_stats":
      return tradesServices.getTradesStats();

    // ─── SMB Services ─────────────────────────────────────────
    case "smb_categorize_transaction":
      return smbServices.categorizeTransaction(args.description, args.amount, args.merchant_name);
    case "smb_prep_tax":
      return smbServices.prepTaxDocuments(args.business_type, args.transactions, args.tax_year, args.state);
    case "smb_check_licenses":
      return smbServices.checkLicenseRenewals(args.business_name, args.state, args.city, args.license_types);
    case "smb_compare_insurance":
      return smbServices.compareInsurancePlans(args.business_type, args.employees, args.state, args.coverage_needed);
    case "smb_generate_contract":
      return smbServices.generateContract(args.contract_type, args.parties, args.terms);
    case "smb_dashboard":
      return smbServices.getSmbDashboard(args.business_id);

    // ─── Legal Services ───────────────────────────────────────
    case "legal_intake_case":
      return legalServices.intakeCase(args.practice_area, args.client_info, args.case_description);
    case "legal_summarize_records":
      return legalServices.summarizeMedicalRecords(args.records_metadata, args.page_count, args.focus_areas);
    case "legal_demand_letter":
      return legalServices.generateDemandLetter(args.case_id, args.injuries, args.damages, args.liability_basis);
    case "legal_track_deadlines":
      return legalServices.trackDeadlines(args.case_id, args.jurisdiction, args.case_type);
    case "legal_fill_immigration_form":
      return legalServices.fillImmigrationForm(args.form_type, args.applicant_info);
    case "legal_search_case_law":
      return legalServices.searchCaseLaw(args.query, args.jurisdiction, args.practice_area, args.max_results);

    // ─── Healthcare Services ──────────────────────────────────
    case "health_prior_auth":
      return healthcareServices.checkPriorAuth(args.insurance_provider, args.procedure_code, args.patient_info);
    case "health_clinical_note":
      return healthcareServices.generateClinicalNote(args.encounter_type, args.symptoms, args.findings, args.assessment, args.plan);
    case "health_claim_codes":
      return healthcareServices.suggestClaimCodes(args.diagnosis, args.procedures, args.modifiers);
    case "health_optimize_schedule":
      return healthcareServices.optimizeSchedule(args.provider_calendar, args.appointment_requests, args.constraints);
    case "health_interpret_labs":
      return healthcareServices.interpretLabResults(args.lab_type, args.results, args.patient_demographics);
    case "health_compliance":
      return healthcareServices.getHealthcareCompliance(args.action, args.regulation_type);

    // ─── Construction Services ────────────────────────────────
    case "construction_lookup_zoning":
      return constructionServices.lookupZoning(args.address, args.municipality, args.proposed_use);
    case "construction_permit_status":
      return constructionServices.trackPermitStatus(args.permit_id, args.municipality);
    case "construction_material_takeoff":
      return constructionServices.estimateMaterialTakeoff(args.project_type, args.square_footage, args.specifications);
    case "construction_match_subcontractor":
      return constructionServices.matchSubcontractor(args.trade_needed, args.location, args.project_size, args.timeline);
    case "construction_draw_schedule":
      return constructionServices.generateDrawSchedule(args.project_value, args.milestones, args.lender_requirements);
    case "construction_stats":
      return constructionServices.getConstructionStats();

    // ─── Insurance Services ───────────────────────────────────
    case "insurance_claim_intake":
      return insuranceServices.processClaimIntake(args.claim_type, args.policy_number, args.incident_details, args.evidence);
    case "insurance_compare_policies":
      return insuranceServices.comparePolicies(args.coverage_type, args.applicant_profile, args.coverage_needed);
    case "insurance_assess_damage":
      return insuranceServices.assessDamageFromDescription(args.damage_type, args.description, args.photos_count, args.location);
    case "insurance_check_subrogation":
      return insuranceServices.checkSubrogation(args.claim_id, args.incident_details);
    case "insurance_adjuster_report":
      return insuranceServices.generateAdjusterReport(args.claim_id, args.findings, args.photos, args.measurements);
    case "insurance_claims_analytics":
      return insuranceServices.getClaimsAnalytics(args.portfolio_id, args.date_range);

    // ─── Trade & Customs ──────────────────────────────────────
    case "trade_classify_hs":
      return tradeCustoms.classifyHsCode(args.product_description, args.origin_country, args.destination_country);
    case "trade_screen_sanctions":
      return tradeCustoms.screenSanctions(args.entity_name, args.entity_type, args.countries);
    case "trade_calculate_duty":
      return tradeCustoms.calculateDuty(args.hs_code, args.origin_country, args.destination_country, args.declared_value, args.quantity);
    case "trade_generate_customs_docs":
      return tradeCustoms.generateCustomsDocs(args.shipment_details, args.hs_code, args.origin_country, args.destination_country);
    case "trade_check_export_controls":
      return tradeCustoms.checkExportControls(args.product, args.destination_country, args.end_use);

    // ─── Government Services ──────────────────────────────────
    case "gov_lookup_license":
      return governmentServices.lookupBusinessLicense(args.business_type, args.state, args.city);
    case "gov_permit_requirements":
      return governmentServices.lookupPermitRequirementsGov(args.project_type, args.jurisdiction);
    case "gov_foia_request":
      return governmentServices.submitFoiaRequest(args.agency, args.request_description, args.preferred_format);
    case "gov_monitor_contract_bids":
      return governmentServices.monitorContractBids(args.keywords, args.agencies, args.set_aside_types);
    case "gov_track_regulatory_changes":
      return governmentServices.trackRegulatoryChanges(args.industries, args.jurisdictions);

    // ─── Agriculture Services ─────────────────────────────────
    case "ag_identify_crop_issue":
      return agricultureServices.identifyCropIssue(args.crop_type, args.symptoms, args.location, args.season);
    case "ag_forecast_yield":
      return agricultureServices.forecastYield(args.crop_type, args.acreage, args.location, args.planting_date, args.weather_data);
    case "ag_commodity_alerts":
      return agricultureServices.getCommodityAlerts(args.commodities, args.price_thresholds);
    case "ag_analyze_soil":
      return agricultureServices.analyzeSoilReport(args.soil_metrics, args.crop_type, args.location);
    case "ag_check_compliance":
      return agricultureServices.checkAgCompliance(args.farm_type, args.state, args.activities);

    // ─── Education Services ───────────────────────────────────
    case "edu_generate_curriculum":
      return educationServices.generateCurriculum(args.subject, args.grade_level, args.standards, args.duration);
    case "edu_track_progress":
      return educationServices.trackStudentProgress(args.student_id, args.course_id, args.assessments);
    case "edu_verify_credential":
      return educationServices.verifyCredential(args.credential_type, args.issuer, args.credential_id);
    case "edu_detect_ai_content":
      return educationServices.detectAiContent(args.text, args.context);
    case "edu_check_financial_aid":
      return educationServices.checkFinancialAid(args.student_profile, args.institution, args.program_type);

    default:
      throw new Error(`Unknown vertical tool: ${name}`);
  }
}
