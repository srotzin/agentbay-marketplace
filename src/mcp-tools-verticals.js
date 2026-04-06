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
    description: "Use when you need to verify a product before an agent completes a purchase — checks authenticity, validates label claims (organic, UL listed, made in USA), and flags counterfeits or misleading listings. Works across electronics, food, health, apparel, industrial, and automotive categories. Returns a verification verdict, flagged claims, and a confidence score.",
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
    description: "Use when you need to know whether an online merchant or marketplace seller can be trusted before placing an order — evaluates dispute history, review authenticity, chargeback rates, and platform standing. Returns a 0–100 trust score, risk tier, red-flag breakdown, and a buy/caution/avoid recommendation.",
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
    description: "Use when you need to check product listings, review sections, or checkout pages for dark patterns, fake reviews, artificial urgency, hidden fees, or deceptive pricing. Catches manufactured scarcity, astroturfed ratings, drip pricing, and misleading comparisons. Returns flagged patterns, severity ratings, and cleaned content.",
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
    description: "Use when you need to confirm that a purchase receipt matches what was ordered — compares line items, unit prices, merchant details, and totals against expected values to catch overcharges, unauthorized items, or billing fraud. Returns a match verdict, any discrepancy details, and a corrected expected total.",
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
    description: "Use when you need a full risk picture before authorizing a transaction — combines fraud probability, merchant reliability, product authenticity, payment method risk, and shipping destination flags into a single composite score. Returns an overall risk level (low/medium/high/critical), contributing factors, and a go/hold/decline recommendation.",
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
    description: "Use when you need to report a commerce problem — fraud, counterfeit product, non-delivery, price manipulation, or data breach — so it feeds into the shared trust network and initiates dispute resolution. Returns a case ID, estimated resolution timeline, and next steps for the affected transaction.",
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
    description: "Use when you need an agent to place a purchase order on behalf of a user — specify items, quantities, price caps, payment method, and shipping destination. Handles item selection, checkout, and payment submission across supported merchants. Returns an order confirmation ID, itemized receipt, and estimated delivery date.",
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
    description: "Use when you need to find the best price for a product before buying — searches across multiple merchants and marketplaces simultaneously for a given product name, SKU, or description. Returns a ranked list of offers with merchant name, price, availability, shipping cost, and trust score.",
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
    description: "Use when you need to check where an order is and when it will arrive — tracks fulfillment status, carrier updates, and delivery estimates for any order placed through commerce_create_order. Returns current status, tracking number, carrier link, and estimated delivery window.",
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
    description: "Use when you need to return a product or request a refund — handles return authorization for defective items, wrong shipments, damaged-in-transit goods, or changed-mind returns. Returns a return authorization number, prepaid label (if applicable), and expected refund timeline.",
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
    description: "Use when you need a record of an agent's past purchases or want to analyze spending — retrieves full order history with optional analytics on category breakdowns, top merchants, average order value, and return rate. Returns a chronological order list plus optional analytics summary.",
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
    description: "Use when you need to check untrusted content before passing it to an LLM or agent pipeline — detects prompt injection, jailbreak patterns, goal hijacking, role confusion, and adversarial instructions in user input, web pages, documents, emails, or API responses. Returns a threat verdict, detected patterns, and a sanitized content snippet.",
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
    description: "Use when you need to isolate malicious content that has been identified as a prompt injection or jailbreak attempt — removes it from active agent processing pipelines and logs it for security review. Returns a quarantine confirmation, threat level, and case ID for the isolated content.",
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
    description: "Use when you need to know the current health and effectiveness of the anti-injection shield — returns active rule count, recent block rate, top threat categories detected, and last rule-set update timestamp. Useful for monitoring pipeline security posture in real time.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "anti_injection_report_vector",
    description: "Use when you have discovered a novel prompt injection or jailbreak pattern that should be added to collective defenses — contributes the attack type, payload, and context to the HiveAgent threat-sharing network. Returns a submission ID and estimated time to rule propagation across the network.",
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
    description: "Use when you need a certified-safe version of content that has already been scanned, or when you want to scan-and-certify raw content in a single call before feeding it into an agent. Returns the sanitized content, a pass/fail certificate, and a content hash for audit purposes.",
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
    description: "Use when you need to enroll an agent endpoint into continuous health monitoring — configures check interval, circuit-breaker failure thresholds, and alerting. Returns a registration confirmation, assigned monitor ID, and the schedule of upcoming health checks.",
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
    description: "Use when you need an immediate, on-demand health check of an agent endpoint — pings the endpoint and measures response latency, HTTP status, and circuit state right now rather than waiting for the next scheduled check. Returns latency in ms, HTTP status, circuit state (closed/open/half-open), and a pass/fail verdict.",
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
    description: "Use when you need to know whether an agent's circuit breaker is open or closed before calling it — returns current circuit state, consecutive failure count, last failure timestamp, and cooldown time remaining before automatic retry is allowed.",
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
    description: "Use when you need to manually stop traffic to an agent — opens its circuit breaker immediately to prevent further calls and triggers recovery procedures. Useful for maintenance windows or confirmed failures. Returns confirmation of circuit state change and the audit log entry.",
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
    description: "Use when you need a comprehensive health overview for an agent — shows uptime history, SLA compliance, active incidents, dependency health tree, and a timeline of recent failures and recoveries. Returns a dashboard object suitable for display or automated decision-making.",
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
    description: "Use when you need to review an agent's incident history — lists failures, outages, and degradations filtered by severity level and time window, with root cause analysis and resolution details for each event. Returns a paginated incident list with timestamps, severity, duration, and resolution notes.",
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
    description: "Use when you need to define how a multi-stage workflow passes control between agents — specifies which agent handles each stage, required context keys that must be carried across every boundary, and success criteria for each transition. Returns a protocol ID and a validated stage map.",
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
    description: "Use when you need to transfer control from one agent to another within a registered handoff protocol — packages the current context, verifies all required keys are present, and signals the receiving agent that it is now responsible. Returns a handoff ID, transfer confirmation, and receiving-agent acknowledgment status.",
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
    description: "Use when you need to confirm that a handoff actually succeeded — checks context integrity, verifies the receiving agent acknowledged responsibility, and flags any missing or corrupted context keys. Returns a pass/fail result with a detailed diff of expected vs. received context.",
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
    description: "Use when you need a full audit trail of how a workflow moved between agents — returns a chronological trace of every handoff event including timing, agent IDs, context diffs, and any validation failures or retries that occurred.",
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
    description: "Use when a handoff has failed and you need to get the workflow back on track — applies a recovery strategy (retry, rollback, escalate to human, switch to alternate agent, or abort) to the failed handoff. Returns the outcome of the recovery attempt and the new workflow state.",
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
    description: "Use when you need to start end-to-end observability for a multi-agent workflow — opens a trace that all subsequent agents can attach spans to for full pipeline visibility. Returns a trace ID that must be passed to recovery_add_span for each downstream operation.",
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
    description: "Use when you need to record a single agent operation as part of an active trace — captures the agent ID, operation name, input, output, and duration so the full execution timeline can be reconstructed. Returns a span ID and the updated trace breadcrumb.",
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
    description: "Use when you need to verify that an agent's output is factually grounded — compares the agent's claims against provided authoritative source texts or URLs and flags statements that appear unsupported or fabricated. Returns a hallucination score, flagged claims with confidence levels, and grounding excerpts from the sources.",
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
    description: "Use when a task has failed and you need to safely park it for later inspection and replay — stores the full task payload, failure reason, and originating agent in the dead-letter queue without losing any data. Returns a dead-letter entry ID and an estimated replay-ready timestamp.",
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
    description: "Use when you need to inspect or manage tasks that have failed processing — retrieves the dead-letter queue for a given agent, optionally filtered by status (pending, replaying, resolved, abandoned). Returns a list of dead-letter entries with task payloads, failure reasons, and retry history.",
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
    description: "Use when you need a complete picture of how a multi-agent workflow performed — generates a full observability report covering span timelines, per-agent error rates, hallucination detections, dead-letter counts, and latency percentiles for a given time range. Returns a structured report object suitable for dashboards or post-mortems.",
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
    description: "Use when you need to know what permits are required before starting a trade job — looks up permit requirements, required inspections, application fees, and typical approval turnaround times for electrical, plumbing, HVAC, roofing, gas, solar, or low-voltage work in any US municipality. Returns a permit checklist, fee schedule, and submission instructions.",
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
    description: "Use when you need a cost and time estimate for a trade job — takes a plain-language description and produces an itemized breakdown of labor hours, material costs, permit fees, and total project cost for electrical, plumbing, HVAC, roofing, gas, solar, or general construction work. Adjusts rates by city and property type (residential, commercial, industrial).",
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
    description: "Use when you need to source a part or material for a trade job — searches local suppliers, wholesale distributors, and online vendors by description, model number, or spec, with urgency options from standard to same-day emergency. Returns a ranked list of suppliers with price, availability, distance, and lead time.",
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
    description: "Use when you need to confirm that proposed trade work meets current building and safety codes before starting — checks electrical (NEC), plumbing (UPC/IPC), HVAC (IMC), and other trade codes for the specific jurisdiction. Returns a compliance verdict, relevant code citations, and any required modifications to bring the work into compliance.",
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
    description: "Use when you need to create a professional invoice for a completed trade job — builds an itemized bill with labor hours, materials, taxes, and payment terms formatted for client delivery. Returns a ready-to-send invoice document with line items, totals, and payment instructions.",
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
    description: "Use when you need platform-level metrics for the trades services system — returns active job counts, average estimate accuracy, top trade categories by volume, regional demand trends, and permit approval rate benchmarks. Useful for operational dashboards and capacity planning.",
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
    description: "Use when you need to classify a bank transaction for bookkeeping or tax purposes — maps a transaction description and amount to the correct chart-of-accounts category (COGS, office supplies, utilities, payroll, etc.) following standard accounting practice. Returns the category name, account code, tax treatment, and confidence score.",
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
    description: "Use when you need to prepare for small-business tax filing — analyzes transaction history to generate income summaries, deduction lists, and filing checklists tailored to the business type (sole prop, LLC, S-corp, partnership). Returns a tax prep summary, estimated liability, key deductions to capture, and a deadline calendar.",
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
    description: "Use when you need to know if a small business's licenses, certifications, or permits are current — checks renewal deadlines, identifies expired or expiring-soon credentials, and provides renewal instructions. Returns a status table showing license name, expiration date, renewal fee, and required action for each credential.",
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
    description: "Use when you need to find the right business insurance policy — compares plans from multiple carriers for a given business type, employee count, revenue, and coverage needs (general liability, BOP, E&O, workers comp, cyber). Returns a side-by-side comparison of premiums, coverage limits, deductibles, and carrier ratings.",
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
    description: "Use when you need a legally sound business contract quickly — generates NDAs, service agreements, independent contractor agreements, vendor contracts, or client proposals pre-populated with the provided terms. Returns a complete contract draft in plain language, ready for attorney review or direct signature.",
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
    description: "Use when you need a health check on a small business at a glance — compiles financial health indicators (cash flow, receivables aging, burn rate), upcoming tax and license deadlines, compliance status, and prioritized action items into a single dashboard. Returns a structured snapshot with alerts and ranked recommendations.",
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
    description: "Use when you need to open a new legal case file — captures client information, facts of the matter, key dates, and practice area (personal injury, employment, family law, immigration, contract dispute) to generate a structured case file with a matter summary and initial task list. Returns a case ID, matter summary, and recommended next steps.",
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
    description: "Use when you need to distill a stack of medical records for litigation — extracts injuries, diagnosis codes, treatment timelines, provider notes, prognosis, and total cost of care into a concise litigation-ready summary. Returns a structured medical summary with a treatment chronology, injury severity assessment, and economic damages total.",
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
    description: "Use when you need to draft a formal demand letter for a personal injury, property damage, breach of contract, or civil dispute — itemizes all damages (medical, lost wages, pain and suffering, property), states the settlement demand, and sets a response deadline. Returns a professionally formatted demand letter ready for attorney review and signature.",
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
    description: "Use when you need to know the critical dates for a case — calculates statutes of limitations, response deadlines, filing cutoffs, and discovery milestones based on jurisdiction, case type, and incident date. Returns a deadline calendar with dates, rules cited, and risk flags for any approaching or already-missed deadlines.",
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
    description: "Use when you need to complete a USCIS immigration form — takes applicant data and auto-populates the correct fields for I-130, I-485, I-765, I-131, N-400, or other USCIS forms with field-level validation. Returns a completed, PDF-ready form with a validation report flagging any missing or inconsistent fields.",
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
    description: "Use when you need to find relevant legal precedents, statutes, or rulings to support a matter — searches case law databases by legal question, jurisdiction, court level, and practice area (tort, employment, immigration, criminal, family, IP). Returns matching cases with citation, holding summary, relevance score, and a brief explaining how each supports the argument.",
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
    description: "Use when you need to check if a procedure or medication requires prior authorization from a payer, or to submit a pre-auth request — covers medical and surgical procedures, specialty drugs, imaging, DME, and behavioral health services. Returns the auth requirement status, required documentation checklist, expected turnaround, and auth reference number upon submission.",
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
    description: "Use when you need to document a patient encounter — generates a structured SOAP note, H&P, progress note, or discharge summary from encounter information including chief complaint, history, exam findings, assessment, and plan. Returns a complete, formatted clinical note ready for EHR entry with appropriate medical terminology.",
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
    description: "Use when you need to select the most accurate and reimbursable ICD-10 diagnosis codes and CPT procedure codes for a clinical encounter — analyzes the encounter description and suggests the optimal code set to maximize claim accuracy and reduce denial risk. Returns a ranked list of recommended codes with specificity guidance and common denial flags.",
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
    description: "Use when you need to improve a provider's daily or weekly appointment schedule — identifies gaps, balances new vs. follow-up patient mix, accommodates urgent-care slots, and aligns visit types with provider availability. Returns an optimized schedule with recommended adjustments, projected revenue impact, and no-show risk flags by appointment.",
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
    description: "Use when you need to make sense of laboratory results — compares each value against age- and sex-adjusted reference ranges, flags critical and borderline abnormalities, and suggests appropriate clinical follow-up for CBC, CMP, lipid panel, thyroid, HbA1c, urinalysis, and other common panels. Returns a flagged results table with clinical significance notes and suggested next steps.",
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
    description: "Use when you need to confirm that a clinical workflow, documentation practice, or patient interaction complies with HIPAA, CMS conditions of participation, OIG requirements, or state-specific regulations — covers billing compliance, patient privacy, informed consent, and telehealth rules. Returns a compliance verdict, citation of the relevant rule, and remediation guidance for any violations found.",
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
    description: "Use when you need to check what can be built on a property — looks up zoning classification, allowed uses, setback requirements, height limits, lot coverage maximums, and parking minimums for any US property address. Returns the zone code, full list of permitted and prohibited uses, dimensional standards, and overlay district notes.",
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
    description: "Use when you need to know where a building or development permit stands in the review process — tracks the application through plan check, agency reviews, corrections, approvals, and issuance. Returns current status, completed and pending review stages, outstanding corrections, reviewer comments, and estimated approval date.",
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
    description: "Use when you need a quantity takeoff and cost estimate for a construction project — generates a bill of materials with quantities, unit costs, and total pricing for the project type and square footage. Covers new construction, additions, tenant improvements, and renovations for residential, commercial, and industrial projects. Returns a line-item material list with quantities, unit prices, and a total cost summary.",
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
    description: "Use when you need to find qualified subcontractors for a construction project — matches licensed and insured subs for specific trades (framing, MEP, concrete, roofing, finishes) based on project location, size, scope, and start date. Returns a shortlist of matched subcontractors with license status, insurance verification, past project history, and availability.",
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
    description: "Use when you need a construction loan draw schedule — generates milestone-aligned disbursement tranches that satisfy lender requirements for residential or commercial construction loans. Returns a draw schedule with milestone descriptions, percentage of completion benchmarks, draw amounts, and documentation required for each draw request.",
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
    description: "Use when you need aggregate performance metrics for the construction services platform — returns active project counts, regional cost indices, average permit approval timelines by municipality, subcontractor availability by trade, and material price trends. Useful for project planning, bid benchmarking, and market analysis.",
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
    description: "Use when you need to file, submit, or start an insurance claim — handles intake for auto, property, liability, health, and workers' comp claims by capturing incident details, policy information, and initial documentation. Assigns an adjuster, generates a required document checklist, sets severity triage, and returns a claim ID, status, adjuster assignment, and next steps.",
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
    description: "Use when you need to shop or compare insurance policies — queries multiple carriers for auto, homeowners, renters, commercial property, general liability, or life insurance and returns a side-by-side comparison of premiums, deductibles, coverage limits, exclusions, and AM Best carrier ratings for the given applicant profile.",
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
    description: "Use when you need to estimate damage and claim value for a property or vehicle loss — analyzes a plain-language description of the damage, photo count, and loss type (fire, flood, wind, collision, theft) to produce a repair cost estimate and recommended claim settlement range. Returns an itemized damage assessment with estimated repair costs, depreciation, ACV, and RCV values.",
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
    description: "Use when you need to evaluate whether a paid claim has recovery potential from a liable third party — analyzes the incident facts, responsible parties, applicable law, and policy language to determine subrogation viability. Returns a subrogation assessment with identified third parties, estimated recovery potential, recommended action, and statute of limitations deadline.",
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
    description: "Use when you need to produce a formal adjuster report for a claim file — documents damage findings, coverage analysis, applicable exclusions, and a recommended settlement amount in the standard format required for claim closure and litigation defense. Returns a complete adjuster report ready for file attachment and supervisor review.",
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
    description: "Use when you need portfolio-level insights on claims performance — analyzes loss ratios, claim frequency trends, severity distributions, emerging fraud patterns, and reserve adequacy across a book of business. Returns analytics dashboards with trend charts, anomaly flags, peer benchmarks, and recommended reserve adjustments.",
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
    description: "Use when you need to classify a product under the Harmonized System (HS) tariff code for import/export paperwork, duty calculation, or compliance — provide a product description and the tool returns the recommended 6-digit HS code, chapter heading, duty rate, and common classification notes or ambiguities to resolve.",
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
    description: "Use when you need to check whether a person, company, or vessel is on a restricted or sanctioned party list before doing business with them — screens against OFAC SDN, BIS Entity List, UN, EU, and other major sanctions and export-control lists. Returns a clear/hit/review result with the specific list entry, basis for designation, and recommended compliance action.",
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
    description: "Use when you need to know the landed cost for an international shipment — calculates import duties, tariffs, VAT/GST, customs processing fees, and MPF for a given HS code, country of origin, destination country, declared value, and quantity. Returns a full landed-cost breakdown with applicable rate citations and total payable at import.",
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
    description: "Use when you need the paperwork to clear a shipment through customs — generates a commercial invoice, packing list, shipper's export declaration, or certificate of origin pre-filled with the shipment details. Returns completed, print-ready documents with all fields required by the destination customs authority.",
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
    description: "Use when you need to confirm whether a product can be legally exported to a specific country or end user — checks EAR jurisdiction, ECCN classification, ITAR applicability, and country/end-use restrictions for the given product, destination, and stated end use. Returns a compliance verdict, applicable control reasons, required license or license exception, and red-flag end-use warnings.",
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
    description: "Use when you need to know what business licenses are required to operate a specific type of business in a given city or state — looks up license types, application requirements, fees, processing times, and renewal schedules for retail, food service, contracting, professional, and other business categories. Returns a complete license requirement list with application links and fee schedule.",
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
    description: "Use when you need to understand the government approvals required before starting a construction or development project — identifies required building, grading, environmental, and zoning permits for the project type and jurisdiction, including which agencies must sign off. Returns a permit roadmap with required approvals, sequencing, estimated fees, and typical review timelines.",
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
    description: "Use when you need to request government records under the Freedom of Information Act — drafts and submits a FOIA or state-equivalent public records request to the appropriate federal or state agency for the records sought. Returns a submission confirmation, assigned request tracking number, statutory response deadline, and status monitoring link.",
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
    description: "Use when you need to find government contracting opportunities — monitors SAM.gov and state procurement portals for contract solicitations matching specified keywords, NAICS codes, agency names, and set-aside types (small business, 8(a), HUBZone, SDVOSB). Returns a list of matching opportunities with solicitation numbers, due dates, estimated values, and agency contacts.",
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
    description: "Use when you need to stay current on regulatory changes that could affect a business — monitors the Federal Register, agency websites, and state regulatory databases for new rules, proposed rulemakings, and guidance documents relevant to specified industries and jurisdictions. Returns a digest of recent and upcoming changes with effective dates, compliance deadlines, and plain-language summaries.",
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
    description: "Use when you need to diagnose what is wrong with a crop — analyzes symptom descriptions (yellowing, lesions, wilting, defoliation, unusual growths) to identify diseases, pests, nutrient deficiencies, or environmental stress for field crops, vegetables, orchard fruits, and row crops. Returns a probable cause, confidence level, affected crop stage, and recommended treatment or intervention options.",
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
    description: "Use when you need to project how much a field will produce at harvest — combines crop type, planted acreage, planting date, location, soil type, and current or historical weather data to generate a yield forecast. Returns a yield range (low/mid/high) in bushels or tons per acre, key risk factors, and comparison to county or regional averages.",
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
    description: "Use when you need to monitor commodity prices and get notified when market conditions hit target thresholds — sets up price alerts for corn, soybeans, wheat, cotton, cattle, hogs, or other commodities at specified price levels. Returns current cash and futures prices, basis, recent trend direction, and alert configuration confirmation.",
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
    description: "Use when you need fertilizer and amendment recommendations based on a soil test report — analyzes pH, macro- and micronutrient levels, organic matter, and CEC to generate application rate recommendations for lime, nitrogen, phosphorus, potassium, and micronutrients, along with crop suitability ratings for the field. Returns an amendment plan with product recommendations, application timing, and expected yield response.",
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
    description: "Use when you need to confirm that farming operations are compliant with applicable regulations — checks USDA farm program requirements, EPA pesticide and nutrient management rules, OSHA agricultural safety standards, and state-specific regulations including organic certification (NOP) and water quality rules. Returns a compliance status by regulation category with any violations flagged and corrective action guidance.",
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
    description: "Use when you need a complete, standards-aligned curriculum plan for a course or unit — specify the subject, grade level, state standards (Common Core, NGSS, or state-specific), and available instructional weeks to get a full plan with unit breakdowns, learning objectives, suggested activities, and formative and summative assessments. Returns a structured curriculum map ready for classroom use or administrator review.",
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
    description: "Use when you need to monitor a student's learning trajectory and identify where they need support — analyzes assessment results, assignment completion, and skill mastery data to pinpoint knowledge gaps, calculate growth metrics, and recommend targeted interventions or enrichment. Returns a progress report with mastery percentages by standard, trend direction, and a prioritized intervention plan.",
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
    description: "Use when you need to confirm that a degree, certificate, diploma, or transcript is legitimate — verifies the credential against the issuing institution's official records and flags any discrepancies in degree type, graduation date, honors, or field of study. Returns a verification verdict, verified credential details, and an official confirmation reference number.",
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
    description: "Use when you need to determine whether a student submission was written by an AI — analyzes the text for linguistic patterns, perplexity, burstiness, and stylistic markers associated with AI-generated content. Returns an AI-likelihood score (0–100%), confidence classification, highlighted suspect passages, and a human-vs-AI evidence summary suitable for academic integrity review.",
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
    description: "Use when you need to determine what financial aid a student qualifies for — evaluates EFC/SAI, enrollment status, program type, and institution to identify eligible federal grants (Pell, SEOG), subsidized and unsubsidized loans, work-study, and institutional aid packages. Returns an estimated aid package breakdown by type, award amounts, disbursement schedule, and any FAFSA or verification steps still needed.",
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
