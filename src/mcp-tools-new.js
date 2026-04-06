/**
 * HiveAgent MCP Tool Definitions — New Service Modules
 *
 * This file extends the base mcp-tools.js with 26 new service categories
 * covering human-in-the-loop, voice, logistics, compliance, identity,
 * financial controls, project management, and specialized AI services.
 */

import * as hitl from "./services/hitl.js";
import * as voiceTelephony from "./services/voice-telephony.js";
import * as physicalLogistics from "./services/physical-logistics.js";
import * as communicationRails from "./services/communication-rails.js";
import * as browserAuth from "./services/browser-auth.js";
import * as antibotBypass from "./services/antibot-bypass.js";
import * as paywallBroker from "./services/paywall-broker.js";
import * as apiSubletting from "./services/api-subletting.js";
import * as agentIdentity from "./services/agent-identity.js";
import * as complianceRouter from "./services/compliance-router.js";
import * as esignature from "./services/esignature.js";
import * as zkVaults from "./services/zk-vaults.js";
import * as proofOfCompletion from "./services/proof-of-completion.js";
import * as disputeResolution from "./services/dispute-resolution.js";
import * as outcomeReputation from "./services/outcome-reputation.js";
import * as confidenceOracles from "./services/confidence-oracles.js";
import * as redTeam from "./services/red-team.js";
import * as virtualCards from "./services/virtual-cards.js";
import * as agentBudgets from "./services/agent-budgets.js";
import * as projectManagement from "./services/project-management.js";
import * as slaInsurance from "./services/sla-insurance.js";
import * as knowledgeDistillation from "./services/knowledge-distillation.js";
import * as schemaTranslation from "./services/schema-translation.js";
import * as sandboxTesting from "./services/sandbox-testing.js";
import * as documentProcessing from "./services/document-processing.js";
import * as gpuInference from "./services/gpu-inference.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const newTools = [

  // ═══════════════════════════════════════════════════════════
  // 1. HUMAN-IN-THE-LOOP (HITL)
  // ═══════════════════════════════════════════════════════════
  {
    name: "hitl_submit_task",
    description: "Submit a task to a human worker pool for completion. Supports MFA approval, phone calls, document notarization, subjective judgment, physical verification, data entry, and translation.",
    inputSchema: {
      type: "object",
      properties: {
        task_type: {
          type: "string",
          enum: ["mfa_approval", "phone_call", "document_notarization", "subjective_judgment", "physical_verification", "data_entry", "translation"],
          description: "Type of human task to perform",
        },
        description: {
          type: "string",
          description: "Detailed instructions for the human worker",
        },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high", "critical"],
          description: "Task urgency level — higher urgency increases price",
          default: "normal",
        },
        max_budget_usd: {
          type: "number",
          description: "Maximum USD amount the agent is willing to pay for this task",
        },
      },
      required: ["task_type", "description", "max_budget_usd"],
    },
  },
  {
    name: "hitl_get_status",
    description: "Check the current status of a submitted HITL task. Returns progress percentage and worker assignment.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The HITL task ID returned from hitl_submit_task" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "hitl_get_result",
    description: "Retrieve the completed result of a HITL task including worker notes, rating, and any structured output.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The HITL task ID to retrieve results for" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "hitl_list_workers",
    description: "Browse available human workers, optionally filtered by specialty and minimum rating.",
    inputSchema: {
      type: "object",
      properties: {
        specialty: {
          type: "string",
          enum: ["mfa_approval", "phone_call", "document_notarization", "subjective_judgment", "physical_verification", "data_entry", "translation", "general"],
          description: "Filter workers by specialty",
        },
        min_rating: {
          type: "number",
          description: "Minimum worker star rating (1–5)",
          default: 0,
        },
      },
    },
  },
  {
    name: "hitl_set_budget",
    description: "Set a daily USD spending limit for HITL tasks for a given agent, preventing runaway spend.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The agent identifier to set the budget for" },
        daily_limit_usd: { type: "number", description: "Maximum USD to spend on HITL tasks per day" },
      },
      required: ["agent_id", "daily_limit_usd"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 2. VOICE TELEPHONY
  // ═══════════════════════════════════════════════════════════
  {
    name: "voice_initiate_call",
    description: "Initiate an outbound phone call to any number. Supports text-to-speech script or recorded audio. Returns a call ID for status tracking.",
    inputSchema: {
      type: "object",
      properties: {
        to_number: { type: "string", description: "Destination phone number in E.164 format (e.g. +14155552671)" },
        script: { type: "string", description: "Text-to-speech script the agent will speak during the call" },
        from_number: { type: "string", description: "Caller ID number to display (optional)" },
        record: { type: "boolean", description: "Whether to record the call for later retrieval", default: false },
      },
      required: ["to_number", "script"],
    },
  },
  {
    name: "voice_get_status",
    description: "Get the current status of an ongoing or completed phone call, including duration and connection result.",
    inputSchema: {
      type: "object",
      properties: {
        call_id: { type: "string", description: "The call ID returned from voice_initiate_call" },
      },
      required: ["call_id"],
    },
  },
  {
    name: "voice_get_transcript",
    description: "Retrieve the full transcript of a completed phone call with speaker labels and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        call_id: { type: "string", description: "The call ID to retrieve the transcript for" },
      },
      required: ["call_id"],
    },
  },
  {
    name: "voice_schedule_callback",
    description: "Schedule a callback call at a specific future date and time, with retry logic for missed connections.",
    inputSchema: {
      type: "object",
      properties: {
        to_number: { type: "string", description: "Destination phone number in E.164 format" },
        scheduled_at: { type: "string", description: "ISO 8601 datetime for the callback (e.g. 2026-04-10T14:00:00Z)" },
        script: { type: "string", description: "Text-to-speech script for the callback" },
        max_retries: { type: "integer", description: "Number of retry attempts if call is not answered", default: 3 },
      },
      required: ["to_number", "scheduled_at", "script"],
    },
  },
  {
    name: "voice_list_calls",
    description: "List recent phone calls for an agent, with filtering by status and date range.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list calls for" },
        status: {
          type: "string",
          enum: ["initiated", "ringing", "in_progress", "completed", "failed", "busy", "no_answer"],
          description: "Filter calls by status",
        },
        limit: { type: "integer", description: "Maximum number of calls to return", default: 20 },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 3. PHYSICAL LOGISTICS
  // ═══════════════════════════════════════════════════════════
  {
    name: "logistics_create_shipment",
    description: "Create a new shipment with a major carrier (UPS, FedEx, USPS, DHL). Returns tracking number and label PDF.",
    inputSchema: {
      type: "object",
      properties: {
        from_address: { type: "object", description: "Sender address object with street, city, state, zip, country" },
        to_address: { type: "object", description: "Recipient address object with street, city, state, zip, country" },
        weight_lbs: { type: "number", description: "Package weight in pounds" },
        dimensions: { type: "object", description: "Package dimensions object with length, width, height in inches" },
        carrier: {
          type: "string",
          enum: ["ups", "fedex", "usps", "dhl", "best_price"],
          description: "Preferred carrier, or best_price to auto-select cheapest",
          default: "best_price",
        },
        service_level: {
          type: "string",
          enum: ["ground", "express", "overnight", "economy"],
          description: "Shipping speed",
          default: "ground",
        },
      },
      required: ["from_address", "to_address", "weight_lbs"],
    },
  },
  {
    name: "logistics_track",
    description: "Track a shipment by tracking number across all major carriers. Returns real-time status and estimated delivery.",
    inputSchema: {
      type: "object",
      properties: {
        tracking_number: { type: "string", description: "Carrier tracking number" },
        carrier: { type: "string", description: "Carrier name (optional — auto-detected if omitted)" },
      },
      required: ["tracking_number"],
    },
  },
  {
    name: "logistics_request_verification",
    description: "Request a local agent to physically verify an asset, location, or condition at a given address.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Physical address to verify" },
        verification_type: {
          type: "string",
          enum: ["asset_condition", "location_confirmation", "identity_check", "inventory_count"],
          description: "Type of physical verification needed",
        },
        instructions: { type: "string", description: "Specific instructions for the local verifier" },
        max_budget_usd: { type: "number", description: "Maximum USD willing to pay for the verification" },
      },
      required: ["address", "verification_type", "instructions", "max_budget_usd"],
    },
  },
  {
    name: "logistics_dispatch_courier",
    description: "Dispatch an on-demand local courier for same-day pickup and delivery within a metro area.",
    inputSchema: {
      type: "object",
      properties: {
        pickup_address: { type: "string", description: "Pickup location address" },
        dropoff_address: { type: "string", description: "Delivery destination address" },
        item_description: { type: "string", description: "Description of what needs to be transported" },
        pickup_window_minutes: { type: "integer", description: "Minutes from now within which to pick up", default: 60 },
      },
      required: ["pickup_address", "dropoff_address", "item_description"],
    },
  },
  {
    name: "logistics_get_fulfillment_quote",
    description: "Get a price quote for fulfilling a physical order including pick, pack, and ship from a 3PL warehouse.",
    inputSchema: {
      type: "object",
      properties: {
        sku_list: { type: "array", items: { type: "string" }, description: "List of product SKUs to fulfill" },
        destination_address: { type: "object", description: "Delivery address for the fulfilled order" },
        carrier_preference: { type: "string", description: "Preferred carrier (optional)" },
      },
      required: ["sku_list", "destination_address"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 4. COMMUNICATION RAILS
  // ═══════════════════════════════════════════════════════════
  {
    name: "comms_send_verified_message",
    description: "Send a verified message via email, SMS, or push with cryptographic delivery proof and read receipts.",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["email", "sms", "push", "whatsapp", "telegram"],
          description: "Delivery channel",
        },
        recipient: { type: "string", description: "Email address, phone number, or user ID depending on channel" },
        subject: { type: "string", description: "Message subject (required for email)" },
        body: { type: "string", description: "Message body content" },
        require_acknowledgment: { type: "boolean", description: "If true, recipient must explicitly acknowledge receipt", default: false },
      },
      required: ["channel", "recipient", "body"],
    },
  },
  {
    name: "comms_get_delivery_status",
    description: "Check the delivery and read status of a previously sent message.",
    inputSchema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "The message ID returned from comms_send_verified_message" },
      },
      required: ["message_id"],
    },
  },
  {
    name: "comms_schedule_followup",
    description: "Schedule an automated follow-up message to be sent if a recipient does not respond within a given timeframe.",
    inputSchema: {
      type: "object",
      properties: {
        original_message_id: { type: "string", description: "ID of the original message to follow up on" },
        followup_after_hours: { type: "number", description: "Hours to wait before sending the follow-up", default: 24 },
        followup_body: { type: "string", description: "Content of the follow-up message" },
        max_followups: { type: "integer", description: "Maximum number of follow-up attempts", default: 2 },
      },
      required: ["original_message_id", "followup_body"],
    },
  },
  {
    name: "comms_verify_acknowledgment",
    description: "Verify whether a recipient has explicitly acknowledged a message, returning the acknowledgment timestamp and proof.",
    inputSchema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "The message ID to check acknowledgment for" },
      },
      required: ["message_id"],
    },
  },
  {
    name: "comms_list_channels",
    description: "List all available communication channels with their current delivery rates and pricing.",
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Filter channels by geographic region (optional)" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 5. BROWSER & WEB ACCESS (browser-auth)
  // ═══════════════════════════════════════════════════════════
  {
    name: "browser_lease_session",
    description: "Lease a managed browser session with persistent cookies and authenticated credentials for a target site.",
    inputSchema: {
      type: "object",
      properties: {
        target_url: { type: "string", description: "URL of the website to create an authenticated session for" },
        session_duration_minutes: { type: "integer", description: "Duration to hold the session open", default: 30 },
        proxy_region: { type: "string", description: "Geographic region for the browser proxy (e.g. us-east, eu-west)" },
        stealth_mode: { type: "boolean", description: "Enable enhanced anti-detection measures", default: true },
      },
      required: ["target_url"],
    },
  },
  {
    name: "browser_get_session_status",
    description: "Check the health and authentication status of a leased browser session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "The session ID returned from browser_lease_session" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "browser_end_session",
    description: "Terminate a leased browser session and release the underlying compute resources.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "The session ID to terminate" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "browser_list_sessions",
    description: "List all active browser sessions for an agent with their target URLs and remaining time.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list sessions for" },
        status: {
          type: "string",
          enum: ["active", "idle", "expired", "all"],
          description: "Filter by session status",
          default: "active",
        },
      },
    },
  },
  {
    name: "browser_configure_session",
    description: "Configure browser session settings including user-agent, viewport, cookies, and proxy rotation rules.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID to configure" },
        user_agent: { type: "string", description: "Custom user-agent string to use" },
        viewport: { type: "object", description: "Viewport dimensions object with width and height" },
        cookies: { type: "array", items: { type: "object" }, description: "Array of cookie objects to inject" },
        rotate_proxy_every_minutes: { type: "integer", description: "Rotate proxy IP every N minutes (0 = no rotation)" },
      },
      required: ["session_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 6. ANTIBOT BYPASS
  // ═══════════════════════════════════════════════════════════
  {
    name: "antibot_extract_page",
    description: "Extract the full content of a bot-protected web page, bypassing CAPTCHAs and anti-scraping measures. Returns clean HTML or structured data.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the protected page to extract" },
        output_format: {
          type: "string",
          enum: ["html", "text", "json", "markdown"],
          description: "Desired output format",
          default: "text",
        },
        wait_for_selector: { type: "string", description: "CSS selector to wait for before extracting (optional)" },
        proxy_region: { type: "string", description: "Geographic proxy region to use for the request" },
      },
      required: ["url"],
    },
  },
  {
    name: "antibot_batch_extract",
    description: "Extract content from multiple protected pages in parallel. Returns a batch job ID for result retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, description: "List of URLs to extract in batch" },
        output_format: {
          type: "string",
          enum: ["html", "text", "json", "markdown"],
          description: "Desired output format for all pages",
          default: "text",
        },
        concurrency: { type: "integer", description: "Maximum parallel extraction workers", default: 5 },
      },
      required: ["urls"],
    },
  },
  {
    name: "antibot_get_extraction_status",
    description: "Check the status of a batch extraction job and retrieve completed results.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Batch extraction job ID returned from antibot_batch_extract" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "antibot_configure_proxy",
    description: "Configure proxy region preferences and rotation strategy for antibot bypass requests.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["us-east", "us-west", "eu-west", "eu-central", "ap-southeast", "ap-northeast", "sa-east"],
          description: "Primary proxy geographic region",
        },
        rotation_strategy: {
          type: "string",
          enum: ["per_request", "per_session", "sticky"],
          description: "How often to rotate the proxy IP",
          default: "per_request",
        },
        residential: { type: "boolean", description: "Use residential IPs instead of datacenter IPs", default: false },
      },
      required: ["region"],
    },
  },
  {
    name: "antibot_get_stats",
    description: "Get bypass success rates, CAPTCHA solve rates, and usage statistics for the antibot service.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to retrieve stats for (optional — omit for global stats)" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 7. PAYWALL BROKER
  // ═══════════════════════════════════════════════════════════
  {
    name: "paywall_search",
    description: "Search across licensed data sources, paywalled journals, and subscription databases for relevant content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for licensed content" },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Specific data sources to search (e.g. ['wsj', 'ft', 'bloomberg', 'jstor'])",
        },
        date_from: { type: "string", description: "Filter results from this date (ISO 8601)" },
        date_to: { type: "string", description: "Filter results to this date (ISO 8601)" },
        max_results: { type: "integer", description: "Maximum number of results to return", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "paywall_access_article",
    description: "Retrieve the full text of a paywalled article by URL or DOI, using the platform's licensed access.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the paywalled article" },
        doi: { type: "string", description: "DOI of the article (alternative to URL)" },
      },
    },
  },
  {
    name: "paywall_query_database",
    description: "Query a licensed proprietary database (e.g. Crunchbase, PitchBook, Dun & Bradstreet) with structured parameters.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Name of the licensed database to query" },
        query_params: { type: "object", description: "Database-specific query parameters as key-value pairs" },
        fields: { type: "array", items: { type: "string" }, description: "Specific fields to return" },
      },
      required: ["database", "query_params"],
    },
  },
  {
    name: "paywall_list_sources",
    description: "List all available licensed data sources with their content categories and per-access pricing.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["news", "finance", "academic", "legal", "market_data", "all"],
          description: "Filter sources by category",
          default: "all",
        },
      },
    },
  },
  {
    name: "paywall_get_pricing",
    description: "Get subscription and per-access pricing details for a specific licensed data source.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: { type: "string", description: "Data source identifier to retrieve pricing for" },
      },
      required: ["source_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 8. API SUBLETTING
  // ═══════════════════════════════════════════════════════════
  {
    name: "apisub_rent_access",
    description: "Rent short-term access to a premium API using another agent's surplus quota. Pay per call or per time period.",
    inputSchema: {
      type: "object",
      properties: {
        api_name: { type: "string", description: "Name of the API to rent access to (e.g. 'openai_gpt4', 'google_maps')" },
        duration_hours: { type: "number", description: "Number of hours to rent access for" },
        max_calls: { type: "integer", description: "Maximum number of API calls to allow during the rental" },
        max_cost_usd: { type: "number", description: "Maximum total USD to spend on this rental" },
      },
      required: ["api_name", "duration_hours", "max_cost_usd"],
    },
  },
  {
    name: "apisub_list_available",
    description: "Browse available APIs for subletting with their current pricing, rate limits, and provider reputation.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["ai_models", "data", "maps", "communication", "finance", "search", "all"],
          description: "Filter by API category",
          default: "all",
        },
        max_price_per_call: { type: "number", description: "Maximum price per API call in USD" },
      },
    },
  },
  {
    name: "apisub_get_usage_stats",
    description: "Retrieve usage statistics for a rented API access including calls made, cost incurred, and remaining quota.",
    inputSchema: {
      type: "object",
      properties: {
        rental_id: { type: "string", description: "Rental ID returned from apisub_rent_access" },
      },
      required: ["rental_id"],
    },
  },
  {
    name: "apisub_estimate_cost",
    description: "Estimate the total cost of renting API access for a given usage pattern before committing.",
    inputSchema: {
      type: "object",
      properties: {
        api_name: { type: "string", description: "API name to estimate cost for" },
        estimated_calls: { type: "integer", description: "Expected number of API calls" },
        duration_hours: { type: "number", description: "Duration of the rental in hours" },
      },
      required: ["api_name", "estimated_calls", "duration_hours"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 9. AGENT IDENTITY & DELEGATION
  // ═══════════════════════════════════════════════════════════
  {
    name: "identity_register",
    description: "Register a new cryptographic agent identity on the HiveAgent network with verifiable credentials and a public reputation profile.",
    inputSchema: {
      type: "object",
      properties: {
        agent_name: { type: "string", description: "Human-readable name for this agent identity" },
        capabilities: { type: "array", items: { type: "string" }, description: "List of capabilities this agent claims (e.g. ['trading', 'research'])" },
        public_key: { type: "string", description: "Agent's public key for cryptographic verification (optional)" },
        metadata: { type: "object", description: "Additional metadata to associate with this identity" },
      },
      required: ["agent_name"],
    },
  },
  {
    name: "identity_grant_delegation",
    description: "Grant a sub-agent delegated authority to act on behalf of this agent within specified permission scopes.",
    inputSchema: {
      type: "object",
      properties: {
        principal_agent_id: { type: "string", description: "The agent granting delegation authority" },
        delegate_agent_id: { type: "string", description: "The agent receiving delegated authority" },
        scopes: { type: "array", items: { type: "string" }, description: "Permission scopes granted (e.g. ['read', 'transact', 'hire'])" },
        expires_at: { type: "string", description: "ISO 8601 expiry time for this delegation" },
        max_spend_usd: { type: "number", description: "Maximum USD the delegate can spend on behalf of the principal" },
      },
      required: ["principal_agent_id", "delegate_agent_id", "scopes"],
    },
  },
  {
    name: "identity_verify_delegation",
    description: "Verify that a delegation credential is valid, unexpired, and covers the requested scope before accepting work.",
    inputSchema: {
      type: "object",
      properties: {
        delegation_id: { type: "string", description: "The delegation credential ID to verify" },
        required_scope: { type: "string", description: "Permission scope to check for (e.g. 'transact')" },
      },
      required: ["delegation_id", "required_scope"],
    },
  },
  {
    name: "identity_revoke_delegation",
    description: "Immediately revoke a previously granted delegation, preventing the delegate from acting further.",
    inputSchema: {
      type: "object",
      properties: {
        delegation_id: { type: "string", description: "The delegation ID to revoke" },
        principal_agent_id: { type: "string", description: "The principal agent revoking the delegation (must match original grantor)" },
        reason: { type: "string", description: "Reason for revocation (logged for audit)" },
      },
      required: ["delegation_id", "principal_agent_id"],
    },
  },
  {
    name: "identity_get_profile",
    description: "Retrieve the full identity profile and reputation metrics for any registered agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to retrieve the profile for" },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 10. LEGAL & COMPLIANCE ROUTER
  // ═══════════════════════════════════════════════════════════
  {
    name: "legal_check_compliance",
    description: "Check whether a proposed action or transaction is compliant with applicable regulations in a given jurisdiction.",
    inputSchema: {
      type: "object",
      properties: {
        action_description: { type: "string", description: "Description of the action or transaction to check" },
        jurisdiction: { type: "string", description: "Jurisdiction code (e.g. 'US-CA', 'EU', 'UK', 'SG')" },
        action_category: {
          type: "string",
          enum: ["financial", "data_processing", "employment", "healthcare", "real_estate", "other"],
          description: "Category of the action being checked",
        },
      },
      required: ["action_description", "jurisdiction"],
    },
  },
  {
    name: "legal_route_jurisdiction",
    description: "Determine the correct legal jurisdiction for a cross-border transaction or action and route to appropriate compliance checks.",
    inputSchema: {
      type: "object",
      properties: {
        parties: { type: "array", items: { type: "object" }, description: "Array of party objects with name and country" },
        transaction_type: { type: "string", description: "Type of transaction (e.g. 'payment', 'contract', 'data_transfer')" },
        asset_value_usd: { type: "number", description: "Value of the assets or transaction in USD" },
      },
      required: ["parties", "transaction_type"],
    },
  },
  {
    name: "legal_get_requirements",
    description: "Retrieve detailed regulatory requirements for a specific action type in a jurisdiction.",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: { type: "string", description: "Jurisdiction code to get requirements for" },
        regulation_type: {
          type: "string",
          enum: ["kyc_aml", "gdpr", "ccpa", "pci_dss", "hipaa", "sox", "mifid2", "other"],
          description: "Type of regulation to query",
        },
      },
      required: ["jurisdiction", "regulation_type"],
    },
  },
  {
    name: "legal_validate_action",
    description: "Validate a specific agent action against a compliance ruleset and return a pass/fail result with required remediation steps.",
    inputSchema: {
      type: "object",
      properties: {
        action_id: { type: "string", description: "Unique identifier for the action to validate" },
        ruleset: { type: "string", description: "Named compliance ruleset to validate against" },
        action_data: { type: "object", description: "Action payload to validate" },
      },
      required: ["action_id", "ruleset", "action_data"],
    },
  },
  {
    name: "legal_list_jurisdictions",
    description: "List all supported legal jurisdictions with their supported regulation types and compliance capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["north_america", "europe", "asia_pacific", "latin_america", "middle_east", "all"],
          description: "Filter jurisdictions by region",
          default: "all",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 11. E-SIGNATURE & FILING
  // ═══════════════════════════════════════════════════════════
  {
    name: "esig_create_signature_request",
    description: "Create a legally binding e-signature request for a document, routing it to specified signatories.",
    inputSchema: {
      type: "object",
      properties: {
        document_url: { type: "string", description: "URL of the PDF document to be signed" },
        signatories: {
          type: "array",
          items: { type: "object" },
          description: "Array of signatory objects with name, email, and signing role",
        },
        title: { type: "string", description: "Title of the signature request" },
        message: { type: "string", description: "Message to include with the signature request email" },
        expiry_days: { type: "integer", description: "Days until the signature request expires", default: 14 },
      },
      required: ["document_url", "signatories", "title"],
    },
  },
  {
    name: "esig_file_entity",
    description: "File a legal entity registration, amendment, or annual report with the relevant government authority.",
    inputSchema: {
      type: "object",
      properties: {
        filing_type: {
          type: "string",
          enum: ["llc_formation", "corp_formation", "amendment", "annual_report", "dissolution", "dba_registration"],
          description: "Type of entity filing",
        },
        jurisdiction: { type: "string", description: "State or country where filing should be submitted" },
        entity_data: { type: "object", description: "Entity information required for the filing" },
        rush_filing: { type: "boolean", description: "Request expedited processing (higher fee)", default: false },
      },
      required: ["filing_type", "jurisdiction", "entity_data"],
    },
  },
  {
    name: "esig_check_filing_status",
    description: "Check the status of a pending government filing or e-signature request.",
    inputSchema: {
      type: "object",
      properties: {
        filing_id: { type: "string", description: "Filing ID or signature request ID to check" },
      },
      required: ["filing_id"],
    },
  },
  {
    name: "esig_get_templates",
    description: "Browse available document templates for common legal agreements (NDA, service agreement, employment contract, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["nda", "service_agreement", "employment", "partnership", "term_sheet", "all"],
          description: "Filter templates by document category",
          default: "all",
        },
        jurisdiction: { type: "string", description: "Filter templates by applicable jurisdiction" },
      },
    },
  },
  {
    name: "esig_sign_document",
    description: "Apply a cryptographic electronic signature to a document on behalf of an agent.",
    inputSchema: {
      type: "object",
      properties: {
        signature_request_id: { type: "string", description: "Signature request ID from esig_create_signature_request" },
        signer_agent_id: { type: "string", description: "Agent ID performing the signing action" },
        signature_data: { type: "object", description: "Signature metadata including drawn signature or typed name" },
      },
      required: ["signature_request_id", "signer_agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 12. ZERO-KNOWLEDGE VAULTS
  // ═══════════════════════════════════════════════════════════
  {
    name: "zkvault_deposit",
    description: "Deposit a secret (API key, credential, private key, or sensitive data) into a zero-knowledge vault. The platform never sees the plaintext.",
    inputSchema: {
      type: "object",
      properties: {
        secret_type: {
          type: "string",
          enum: ["api_key", "private_key", "credential", "document", "arbitrary"],
          description: "Classification of the secret being stored",
        },
        encrypted_payload: { type: "string", description: "Client-side encrypted payload (base64 encoded)" },
        label: { type: "string", description: "Human-readable label for this secret" },
        ttl_days: { type: "integer", description: "Days until the secret auto-expires and is deleted", default: 90 },
      },
      required: ["secret_type", "encrypted_payload", "label"],
    },
  },
  {
    name: "zkvault_request_token",
    description: "Request an ephemeral access token to decrypt and use a vault secret for a single operation.",
    inputSchema: {
      type: "object",
      properties: {
        vault_id: { type: "string", description: "Vault ID containing the secret" },
        agent_id: { type: "string", description: "Agent requesting access" },
        purpose: { type: "string", description: "Stated purpose for this access request (logged for audit)" },
        token_ttl_seconds: { type: "integer", description: "Seconds until the ephemeral token expires", default: 300 },
      },
      required: ["vault_id", "agent_id", "purpose"],
    },
  },
  {
    name: "zkvault_revoke_access",
    description: "Revoke all active access tokens for a vault and optionally delete the vault entirely.",
    inputSchema: {
      type: "object",
      properties: {
        vault_id: { type: "string", description: "Vault ID to revoke access for" },
        delete_vault: { type: "boolean", description: "If true, permanently delete the vault after revoking access", default: false },
      },
      required: ["vault_id"],
    },
  },
  {
    name: "zkvault_list_vaults",
    description: "List all zero-knowledge vaults owned by an agent, with labels and expiry times but no secret content.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list vaults for" },
        secret_type: { type: "string", description: "Filter vaults by secret type" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "zkvault_audit_access",
    description: "Retrieve the complete access audit log for a vault, showing all access requests and token issuances.",
    inputSchema: {
      type: "object",
      properties: {
        vault_id: { type: "string", description: "Vault ID to audit" },
        limit: { type: "integer", description: "Maximum number of audit entries to return", default: 50 },
      },
      required: ["vault_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 13. PROOF OF COMPLETION
  // ═══════════════════════════════════════════════════════════
  {
    name: "proof_submit",
    description: "Submit a proof of work completion (e.g. deliverable hash, output URL, or structured evidence) for third-party verification.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "ID of the task or job being proven complete" },
        proof_type: {
          type: "string",
          enum: ["hash", "url", "attestation", "zk_proof", "witness_signature"],
          description: "Type of proof being submitted",
        },
        proof_data: { type: "object", description: "Proof payload (hash, URL, attestation data, etc.)" },
        submitter_agent_id: { type: "string", description: "Agent ID submitting the proof" },
      },
      required: ["task_id", "proof_type", "proof_data", "submitter_agent_id"],
    },
  },
  {
    name: "proof_verify_completion",
    description: "Verify a submitted proof of completion against task requirements and return a pass/fail verdict.",
    inputSchema: {
      type: "object",
      properties: {
        proof_id: { type: "string", description: "Proof ID returned from proof_submit" },
        verification_criteria: { type: "object", description: "Criteria the proof must satisfy for verification to pass" },
      },
      required: ["proof_id"],
    },
  },
  {
    name: "proof_get_status",
    description: "Check the verification status of a submitted proof.",
    inputSchema: {
      type: "object",
      properties: {
        proof_id: { type: "string", description: "Proof ID to check status for" },
      },
      required: ["proof_id"],
    },
  },
  {
    name: "proof_generate_attestation",
    description: "Generate a signed attestation certificate for a verified completion, suitable for on-chain recording or third-party sharing.",
    inputSchema: {
      type: "object",
      properties: {
        proof_id: { type: "string", description: "Verified proof ID to generate attestation for" },
        include_metadata: { type: "boolean", description: "Include full task metadata in the attestation", default: true },
      },
      required: ["proof_id"],
    },
  },
  {
    name: "proof_list_verifications",
    description: "List all proofs submitted or verified by an agent, with their outcomes.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list verifications for" },
        status: {
          type: "string",
          enum: ["pending", "verified", "failed", "disputed", "all"],
          description: "Filter by verification status",
          default: "all",
        },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 14. DISPUTE RESOLUTION
  // ═══════════════════════════════════════════════════════════
  {
    name: "dispute_file",
    description: "File a formal dispute against a transaction, escrow, or service delivery. Initiates the arbitration process.",
    inputSchema: {
      type: "object",
      properties: {
        disputed_item_id: { type: "string", description: "ID of the transaction, escrow, or delivery being disputed" },
        disputing_agent_id: { type: "string", description: "Agent filing the dispute" },
        dispute_category: {
          type: "string",
          enum: ["non_delivery", "quality", "fraud", "billing", "breach_of_terms", "other"],
          description: "Category of the dispute",
        },
        description: { type: "string", description: "Detailed description of the dispute grounds" },
        requested_resolution: { type: "string", description: "What resolution the disputing party seeks (e.g. full refund, partial refund)" },
      },
      required: ["disputed_item_id", "disputing_agent_id", "dispute_category", "description"],
    },
  },
  {
    name: "dispute_submit_evidence",
    description: "Submit evidence (documents, logs, screenshots, transaction records) to support a dispute case.",
    inputSchema: {
      type: "object",
      properties: {
        dispute_id: { type: "string", description: "Dispute ID to submit evidence for" },
        submitter_agent_id: { type: "string", description: "Agent submitting the evidence" },
        evidence_type: {
          type: "string",
          enum: ["document", "log", "screenshot", "transaction_record", "witness_statement", "other"],
          description: "Type of evidence being submitted",
        },
        evidence_url: { type: "string", description: "URL or content of the evidence" },
        description: { type: "string", description: "Explanation of what this evidence proves" },
      },
      required: ["dispute_id", "submitter_agent_id", "evidence_type", "evidence_url"],
    },
  },
  {
    name: "dispute_get_ruling",
    description: "Retrieve the arbitrator's ruling on a dispute, including reasoning and the resolution action taken.",
    inputSchema: {
      type: "object",
      properties: {
        dispute_id: { type: "string", description: "Dispute ID to get ruling for" },
      },
      required: ["dispute_id"],
    },
  },
  {
    name: "dispute_appeal_ruling",
    description: "Appeal an arbitrator ruling to a senior review panel within the permitted appeal window.",
    inputSchema: {
      type: "object",
      properties: {
        dispute_id: { type: "string", description: "Dispute ID to appeal" },
        appeal_grounds: { type: "string", description: "Legal or factual grounds for the appeal" },
        additional_evidence: { type: "array", items: { type: "string" }, description: "URLs of additional evidence supporting the appeal" },
      },
      required: ["dispute_id", "appeal_grounds"],
    },
  },
  {
    name: "dispute_list",
    description: "List all disputes involving an agent, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list disputes for" },
        status: {
          type: "string",
          enum: ["open", "under_review", "resolved", "appealed", "closed", "all"],
          description: "Filter disputes by status",
          default: "all",
        },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 15. OUTCOME REPUTATION
  // ═══════════════════════════════════════════════════════════
  {
    name: "reputation_get_score",
    description: "Get the reputation score and outcome history for a provider or agent, based on verified deliveries.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Agent or provider ID to score" },
        category: { type: "string", description: "Score category filter (e.g. 'delivery_speed', 'quality', 'reliability')" },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "reputation_report_outcome",
    description: "Report the actual outcome of a completed service delivery to update the provider's reputation score.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service or task ID for which the outcome is being reported" },
        provider_id: { type: "string", description: "Provider or agent whose reputation is being updated" },
        outcome: {
          type: "string",
          enum: ["success", "partial_success", "failure", "fraud"],
          description: "Outcome classification",
        },
        quality_score: { type: "number", description: "Quality rating 1-10 for the delivered work" },
        latency_score: { type: "number", description: "Timeliness rating 1-10" },
        notes: { type: "string", description: "Optional notes on the outcome" },
      },
      required: ["service_id", "provider_id", "outcome"],
    },
  },
  {
    name: "reputation_get_metrics",
    description: "Get detailed performance metrics for an agent or provider across all tracked dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Entity ID to retrieve metrics for" },
        time_period_days: { type: "integer", description: "Number of days of history to include", default: 30 },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "reputation_compare_providers",
    description: "Compare reputation scores and performance metrics across multiple providers for a service category.",
    inputSchema: {
      type: "object",
      properties: {
        provider_ids: { type: "array", items: { type: "string" }, description: "List of provider IDs to compare" },
        metric: {
          type: "string",
          enum: ["overall", "delivery_speed", "quality", "reliability", "fraud_rate"],
          description: "Metric to compare across providers",
          default: "overall",
        },
      },
      required: ["provider_ids"],
    },
  },
  {
    name: "reputation_get_risk_score",
    description: "Get a fraud/risk score for an agent or provider indicating likelihood of non-delivery or misconduct.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Agent or provider ID to assess risk for" },
        transaction_value_usd: { type: "number", description: "Value of the transaction being considered (used for risk calibration)" },
      },
      required: ["entity_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 16. CONFIDENCE ORACLES
  // ═══════════════════════════════════════════════════════════
  {
    name: "oracle_query_confidence",
    description: "Post an epistemic question to the oracle market with a financial stake attached, receiving calibrated probability estimates from domain experts.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The factual or predictive question to post to the oracle market" },
        domain: {
          type: "string",
          enum: ["economics", "technology", "security", "finance", "web_automation", "science", "geopolitics", "health", "energy", "other"],
          description: "Thematic domain of the question",
        },
        stake_usd: { type: "number", description: "USD bounty to attach for accurate answering (minimum $1)" },
      },
      required: ["question", "domain", "stake_usd"],
    },
  },
  {
    name: "oracle_stake_answer",
    description: "Stake USD on an answer to an open oracle query, earning rewards if correct and losing stake if wrong.",
    inputSchema: {
      type: "object",
      properties: {
        query_id: { type: "string", description: "Open query ID to stake an answer on" },
        answer: { type: "string", description: "The staker's answer (free text, yes/no, or probability)" },
        confidence_level: { type: "number", description: "Calibrated confidence in this answer (0.0–1.0)" },
        stake_usd: { type: "number", description: "USD amount to stake on this answer (minimum $0.10)" },
      },
      required: ["query_id", "answer", "confidence_level", "stake_usd"],
    },
  },
  {
    name: "oracle_get_calibrated_estimate",
    description: "Retrieve the aggregated calibrated probability estimate for a query from all stakers, with confidence intervals.",
    inputSchema: {
      type: "object",
      properties: {
        query_id: { type: "string", description: "Query ID to retrieve the calibrated estimate for" },
      },
      required: ["query_id"],
    },
  },
  {
    name: "oracle_list_open_queries",
    description: "Browse open oracle questions that need answers, sorted by total stake and urgency.",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["economics", "technology", "security", "finance", "web_automation", "science", "geopolitics", "health", "energy", "other"],
          description: "Filter open queries by domain (optional)",
        },
      },
    },
  },
  {
    name: "oracle_resolve_query",
    description: "Resolve an oracle query with verified ground truth, triggering payout calculations to winning stakers.",
    inputSchema: {
      type: "object",
      properties: {
        query_id: { type: "string", description: "Query ID to resolve" },
        resolution: { type: "string", description: "Verified ground truth answer to the query" },
      },
      required: ["query_id", "resolution"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 17. RED TEAM & SECURITY
  // ═══════════════════════════════════════════════════════════
  {
    name: "redteam_submit_workflow",
    description: "Submit an agent workflow for adversarial red-team review to identify security vulnerabilities and failure modes.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_description: { type: "string", description: "Description of the agent workflow to review" },
        workflow_code: { type: "string", description: "Code or configuration of the workflow (optional)" },
        review_depth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          description: "Depth of red-team review — deeper is more thorough but slower",
          default: "standard",
        },
        focus_areas: {
          type: "array",
          items: { type: "string" },
          description: "Specific areas to focus on (e.g. ['prompt_injection', 'data_exfiltration', 'auth_bypass'])",
        },
      },
      required: ["workflow_description"],
    },
  },
  {
    name: "redteam_get_threat_analysis",
    description: "Retrieve the threat analysis report for a submitted workflow, including identified vulnerabilities and severity ratings.",
    inputSchema: {
      type: "object",
      properties: {
        review_id: { type: "string", description: "Review ID returned from redteam_submit_workflow" },
      },
      required: ["review_id"],
    },
  },
  {
    name: "redteam_list_vulnerabilities",
    description: "List all known vulnerability classes relevant to an agent type or category with mitigation strategies.",
    inputSchema: {
      type: "object",
      properties: {
        agent_type: {
          type: "string",
          enum: ["trading", "research", "code_execution", "communication", "financial", "general"],
          description: "Type of agent to list vulnerabilities for",
          default: "general",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low", "all"],
          description: "Filter by vulnerability severity",
          default: "all",
        },
      },
    },
  },
  {
    name: "redteam_simulate_failure",
    description: "Run a simulated failure scenario against an agent workflow to test its resilience and recovery behavior.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: { type: "string", description: "Workflow ID to test against the failure scenario" },
        failure_type: {
          type: "string",
          enum: ["prompt_injection", "resource_exhaustion", "dependency_failure", "auth_bypass", "data_poisoning"],
          description: "Type of failure scenario to simulate",
        },
        intensity: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Attack intensity level",
          default: "medium",
        },
      },
      required: ["workflow_id", "failure_type"],
    },
  },
  {
    name: "redteam_get_risk_report",
    description: "Get a comprehensive risk report for an agent identity including historical vulnerabilities and recommended mitigations.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to generate the risk report for" },
        include_mitigations: { type: "boolean", description: "Include mitigation recommendations in the report", default: true },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 18. VIRTUAL CARDS & FIAT BRIDGE
  // ═══════════════════════════════════════════════════════════
  {
    name: "vcard_mint",
    description: "Mint a disposable virtual Visa or Mastercard funded from USDC. Supports single-use or multi-use cards with merchant category restrictions.",
    inputSchema: {
      type: "object",
      properties: {
        funding_amount_usd: { type: "number", description: "Amount in USD to load onto the virtual card" },
        currency: { type: "string", description: "ISO currency code", default: "USD" },
        merchant_category: {
          type: "string",
          enum: ["general", "travel", "online_retail", "saas", "advertising", "food_delivery", "utilities"],
          description: "Merchant category restriction for this card",
          default: "general",
        },
        single_use: { type: "boolean", description: "If true, card self-destructs after the first transaction", default: false },
      },
      required: ["funding_amount_usd"],
    },
  },
  {
    name: "vcard_get_details",
    description: "Retrieve full card details including PAN, expiry, CVV, current balance, and status.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Virtual card ID to retrieve details for" },
      },
      required: ["card_id"],
    },
  },
  {
    name: "vcard_freeze",
    description: "Toggle freeze/unfreeze on a virtual card. Frozen cards decline all transactions until unfrozen.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Virtual card ID to freeze or unfreeze" },
      },
      required: ["card_id"],
    },
  },
  {
    name: "vcard_list_transactions",
    description: "Retrieve the full transaction history for a virtual card including merchant, amount, and interchange details.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Virtual card ID to retrieve transactions for" },
      },
      required: ["card_id"],
    },
  },
  {
    name: "vcard_set_limits",
    description: "Configure per-transaction spending limits and merchant allow-lists on a virtual card.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "Virtual card ID to configure limits for" },
        max_transaction_usd: { type: "number", description: "Maximum amount per single transaction in USD" },
        allowed_merchants: {
          type: "array",
          items: { type: "string" },
          description: "List of allowed merchant name substrings. Empty array allows all merchants.",
          default: [],
        },
      },
      required: ["card_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 19. AGENT FINANCIAL CONTROLS (agent-budgets)
  // ═══════════════════════════════════════════════════════════
  {
    name: "budget_create",
    description: "Create a named budget for an agent with configurable spending limits across different categories.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to create the budget for" },
        budget_name: { type: "string", description: "Human-readable name for this budget" },
        total_limit_usd: { type: "number", description: "Total spending limit in USD" },
        period: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "total"],
          description: "Budget period",
          default: "monthly",
        },
        category_limits: { type: "object", description: "Optional per-category spending limits (e.g. {hitl: 50, compute: 100})" },
      },
      required: ["agent_id", "budget_name", "total_limit_usd"],
    },
  },
  {
    name: "budget_allocate_funds",
    description: "Allocate a portion of a budget to a specific project or spending category.",
    inputSchema: {
      type: "object",
      properties: {
        budget_id: { type: "string", description: "Budget ID to allocate from" },
        allocation_name: { type: "string", description: "Name of this allocation (e.g. 'Q2 Research')" },
        amount_usd: { type: "number", description: "Amount in USD to allocate" },
        category: { type: "string", description: "Spending category for this allocation" },
      },
      required: ["budget_id", "allocation_name", "amount_usd"],
    },
  },
  {
    name: "budget_get_spending_report",
    description: "Get a detailed spending report for a budget showing actual spend vs. limits across all categories.",
    inputSchema: {
      type: "object",
      properties: {
        budget_id: { type: "string", description: "Budget ID to report on" },
        include_transactions: { type: "boolean", description: "Include individual transaction details", default: false },
      },
      required: ["budget_id"],
    },
  },
  {
    name: "budget_set_approval_threshold",
    description: "Set a USD threshold above which individual transactions require explicit approval before proceeding.",
    inputSchema: {
      type: "object",
      properties: {
        budget_id: { type: "string", description: "Budget ID to configure" },
        approval_threshold_usd: { type: "number", description: "USD threshold above which approval is required" },
        approver_agent_id: { type: "string", description: "Agent ID of the designated approver" },
      },
      required: ["budget_id", "approval_threshold_usd", "approver_agent_id"],
    },
  },
  {
    name: "budget_reconcile",
    description: "Reconcile a budget's recorded transactions against external ledger records and flag any discrepancies.",
    inputSchema: {
      type: "object",
      properties: {
        budget_id: { type: "string", description: "Budget ID to reconcile" },
        period_start: { type: "string", description: "Start date for reconciliation period (ISO 8601)" },
        period_end: { type: "string", description: "End date for reconciliation period (ISO 8601)" },
      },
      required: ["budget_id", "period_start", "period_end"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 20. PROJECT MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  {
    name: "project_create",
    description: "Create a new agent-managed project with a budget, deadline, and milestone structure.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description and goals" },
        owner_agent_id: { type: "string", description: "Agent ID of the project owner" },
        total_budget_usd: { type: "number", description: "Total project budget in USD" },
        deadline: { type: "string", description: "Project deadline (ISO 8601 date)" },
        visibility: {
          type: "string",
          enum: ["private", "team", "public"],
          description: "Who can see this project",
          default: "private",
        },
      },
      required: ["name", "owner_agent_id", "total_budget_usd"],
    },
  },
  {
    name: "project_add_milestone",
    description: "Add a milestone to an existing project with a payment amount that unlocks upon completion.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to add the milestone to" },
        milestone_name: { type: "string", description: "Name of the milestone" },
        description: { type: "string", description: "What must be completed to achieve this milestone" },
        payment_usd: { type: "number", description: "USD payment released upon milestone completion" },
        due_date: { type: "string", description: "Milestone due date (ISO 8601)" },
      },
      required: ["project_id", "milestone_name", "payment_usd"],
    },
  },
  {
    name: "project_update_progress",
    description: "Update the completion percentage and status of a project or specific milestone.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to update" },
        milestone_id: { type: "string", description: "Specific milestone ID (optional — updates project overall if omitted)" },
        progress_pct: { type: "number", description: "Completion percentage (0–100)" },
        status_note: { type: "string", description: "Status update note or blockers" },
      },
      required: ["project_id", "progress_pct"],
    },
  },
  {
    name: "project_assign_agent",
    description: "Assign an agent to a project or milestone role with specific responsibilities.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to assign the agent to" },
        agent_id: { type: "string", description: "Agent ID to assign" },
        role: {
          type: "string",
          enum: ["contributor", "reviewer", "coordinator", "observer"],
          description: "Role this agent will play in the project",
        },
        milestone_id: { type: "string", description: "Assign to a specific milestone (optional)" },
      },
      required: ["project_id", "agent_id", "role"],
    },
  },
  {
    name: "project_get_status",
    description: "Get the current status, progress, milestones, and team assignments for a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to retrieve status for" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "project_release_milestone_payment",
    description: "Release the escrow payment for a completed milestone after verification of deliverables.",
    inputSchema: {
      type: "object",
      properties: {
        milestone_id: { type: "string", description: "Milestone ID whose payment should be released" },
        approver_agent_id: { type: "string", description: "Agent ID authorizing the payment release" },
        proof_id: { type: "string", description: "Proof of completion ID from the proof-of-completion service (optional)" },
      },
      required: ["milestone_id", "approver_agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 21. SLA & INSURANCE
  // ═══════════════════════════════════════════════════════════
  {
    name: "sla_purchase",
    description: "Purchase an SLA insurance policy for a service or project, paying out if performance targets are missed.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service or project ID to insure" },
        coverage_type: {
          type: "string",
          enum: ["uptime", "latency", "delivery_speed", "quality", "comprehensive"],
          description: "Type of SLA coverage",
        },
        coverage_amount_usd: { type: "number", description: "Maximum payout if SLA is violated" },
        period_days: { type: "integer", description: "Coverage period in days", default: 30 },
        sla_threshold: { type: "object", description: "Performance thresholds that trigger the policy (e.g. {uptime_pct: 99.9})" },
      },
      required: ["service_id", "coverage_type", "coverage_amount_usd"],
    },
  },
  {
    name: "sla_check_status",
    description: "Check the current status of an SLA insurance policy, including whether any breaches have been detected.",
    inputSchema: {
      type: "object",
      properties: {
        sla_id: { type: "string", description: "SLA policy ID to check" },
      },
      required: ["sla_id"],
    },
  },
  {
    name: "sla_file_claim",
    description: "File a claim against an active SLA insurance policy due to a performance breach.",
    inputSchema: {
      type: "object",
      properties: {
        sla_id: { type: "string", description: "SLA policy ID against which the claim is filed" },
        breach_description: { type: "string", description: "Description of the SLA breach" },
        breach_evidence: { type: "array", items: { type: "string" }, description: "URLs of evidence documenting the breach" },
        claimed_amount_usd: { type: "number", description: "USD amount being claimed" },
      },
      required: ["sla_id", "breach_description", "claimed_amount_usd"],
    },
  },
  {
    name: "sla_get_coverage_options",
    description: "Browse available SLA insurance coverage options with their pricing and terms.",
    inputSchema: {
      type: "object",
      properties: {
        coverage_type: {
          type: "string",
          enum: ["uptime", "latency", "delivery_speed", "quality", "comprehensive", "all"],
          description: "Filter by coverage type",
          default: "all",
        },
        max_premium_usd: { type: "number", description: "Maximum monthly premium willing to pay" },
      },
    },
  },
  {
    name: "sla_list_active",
    description: "List all active SLA insurance policies for an agent with their current breach status.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list SLA policies for" },
      },
      required: ["agent_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 22. KNOWLEDGE DISTILLATION
  // ═══════════════════════════════════════════════════════════
  {
    name: "knowledge_publish_lesson",
    description: "Publish a distilled lesson or knowledge artifact from completed work, making it discoverable by other agents.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Lesson title" },
        domain: { type: "string", description: "Knowledge domain (e.g. 'finance', 'legal', 'engineering')" },
        content: { type: "string", description: "The knowledge content to publish" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for discoverability" },
        price_usd: { type: "number", description: "Price for other agents to access this lesson (0 = free)", default: 0 },
        author_agent_id: { type: "string", description: "Agent ID of the knowledge author" },
      },
      required: ["title", "domain", "content", "author_agent_id"],
    },
  },
  {
    name: "knowledge_query",
    description: "Query the knowledge distillation marketplace for lessons and insights relevant to a topic.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        domain: { type: "string", description: "Domain to search within (optional)" },
        max_price_usd: { type: "number", description: "Maximum price willing to pay for knowledge access" },
        limit: { type: "integer", description: "Maximum number of results to return", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "knowledge_get_trending",
    description: "Get trending insights and most-accessed knowledge artifacts across all domains.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Filter trending insights by domain (optional)" },
        period: {
          type: "string",
          enum: ["24h", "7d", "30d"],
          description: "Time period for trending calculation",
          default: "7d",
        },
      },
    },
  },
  {
    name: "knowledge_rate_lesson",
    description: "Rate a knowledge lesson you have accessed, improving the curation of the marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        lesson_id: { type: "string", description: "Lesson ID to rate" },
        rating: { type: "number", description: "Rating from 1 (poor) to 5 (excellent)" },
        review: { type: "string", description: "Optional written review" },
        rater_agent_id: { type: "string", description: "Agent ID submitting the rating" },
      },
      required: ["lesson_id", "rating", "rater_agent_id"],
    },
  },
  {
    name: "knowledge_list_domains",
    description: "List all available knowledge domains with lesson counts and average quality scores.",
    inputSchema: {
      type: "object",
      properties: {
        min_lesson_count: { type: "integer", description: "Only return domains with at least this many lessons", default: 1 },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 23. SCHEMA TRANSLATION
  // ═══════════════════════════════════════════════════════════
  {
    name: "schema_translate",
    description: "Translate data from one schema format to another (e.g. JSON to Protobuf, OpenAPI to GraphQL, Avro to Parquet).",
    inputSchema: {
      type: "object",
      properties: {
        input_schema: { type: "string", description: "Source schema definition (as string)" },
        input_format: {
          type: "string",
          enum: ["json_schema", "openapi", "graphql", "protobuf", "avro", "parquet", "xml_xsd", "sql_ddl"],
          description: "Source schema format",
        },
        output_format: {
          type: "string",
          enum: ["json_schema", "openapi", "graphql", "protobuf", "avro", "parquet", "xml_xsd", "sql_ddl"],
          description: "Target schema format",
        },
        options: { type: "object", description: "Format-specific translation options" },
      },
      required: ["input_schema", "input_format", "output_format"],
    },
  },
  {
    name: "schema_list_formats",
    description: "List all supported schema formats with their capabilities and compatible translation pairs.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "schema_validate",
    description: "Validate a schema definition against its format specification, returning errors and warnings.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string", description: "Schema definition to validate" },
        format: {
          type: "string",
          enum: ["json_schema", "openapi", "graphql", "protobuf", "avro", "parquet", "xml_xsd", "sql_ddl"],
          description: "Schema format to validate against",
        },
      },
      required: ["schema", "format"],
    },
  },
  {
    name: "schema_batch_translate",
    description: "Translate multiple schemas in a single batch operation. Returns a job ID for result retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        schemas: {
          type: "array",
          items: { type: "object" },
          description: "Array of schema translation jobs, each with input_schema, input_format, and output_format",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Processing priority for the batch",
          default: "normal",
        },
      },
      required: ["schemas"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 24. SANDBOX TESTING
  // ═══════════════════════════════════════════════════════════
  {
    name: "sandbox_create",
    description: "Create an isolated sandbox environment for testing agent workflows, service integrations, or code execution without real-world side effects.",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_name: { type: "string", description: "Name for this sandbox environment" },
        environment_type: {
          type: "string",
          enum: ["node", "python", "browser", "docker", "wasm"],
          description: "Type of execution environment",
          default: "node",
        },
        timeout_minutes: { type: "integer", description: "Maximum lifetime of the sandbox in minutes", default: 60 },
        resource_limits: { type: "object", description: "Resource constraints (cpu, memory_mb, network_enabled)" },
      },
      required: ["sandbox_name"],
    },
  },
  {
    name: "sandbox_run_test",
    description: "Execute a test case or code snippet inside a sandbox environment.",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_id: { type: "string", description: "Sandbox ID to run the test in" },
        test_code: { type: "string", description: "Code or test definition to execute" },
        input_data: { type: "object", description: "Input data to pass to the test" },
        timeout_seconds: { type: "integer", description: "Execution timeout in seconds", default: 30 },
      },
      required: ["sandbox_id", "test_code"],
    },
  },
  {
    name: "sandbox_get_results",
    description: "Retrieve the results of a test execution from a sandbox, including stdout, stderr, and return values.",
    inputSchema: {
      type: "object",
      properties: {
        test_run_id: { type: "string", description: "Test run ID returned from sandbox_run_test" },
      },
      required: ["test_run_id"],
    },
  },
  {
    name: "sandbox_compare_providers",
    description: "Run the same test across multiple sandboxed provider implementations and compare their outputs and performance.",
    inputSchema: {
      type: "object",
      properties: {
        test_code: { type: "string", description: "Test code to run across all providers" },
        provider_ids: { type: "array", items: { type: "string" }, description: "Provider IDs to compare" },
        metric: {
          type: "string",
          enum: ["output_quality", "latency", "cost", "all"],
          description: "Primary metric to compare",
          default: "all",
        },
      },
      required: ["test_code", "provider_ids"],
    },
  },
  {
    name: "sandbox_list",
    description: "List all sandbox environments for an agent with their status and resource usage.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to list sandboxes for" },
        status: {
          type: "string",
          enum: ["running", "idle", "terminated", "all"],
          description: "Filter by sandbox status",
          default: "all",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 25. DOCUMENT PROCESSING
  // ═══════════════════════════════════════════════════════════
  {
    name: "doc_extract",
    description: "Extract structured data from a document (PDF, DOCX, image) using AI-powered layout analysis and field extraction.",
    inputSchema: {
      type: "object",
      properties: {
        document_url: { type: "string", description: "URL of the document to extract data from" },
        extraction_schema: { type: "object", description: "Schema defining which fields to extract (optional — extracts all if omitted)" },
        document_type: {
          type: "string",
          enum: ["invoice", "contract", "id_document", "financial_statement", "form", "general"],
          description: "Type of document for optimized extraction",
          default: "general",
        },
      },
      required: ["document_url"],
    },
  },
  {
    name: "doc_redact",
    description: "Redact sensitive information (PII, financial data, legal terms) from a document using AI-powered detection.",
    inputSchema: {
      type: "object",
      properties: {
        document_url: { type: "string", description: "URL of the document to redact" },
        redaction_categories: {
          type: "array",
          items: { type: "string" },
          description: "Categories of data to redact (e.g. ['pii', 'financial', 'legal_privilege', 'confidential'])",
        },
        output_format: {
          type: "string",
          enum: ["pdf", "docx", "png"],
          description: "Output format for the redacted document",
          default: "pdf",
        },
      },
      required: ["document_url", "redaction_categories"],
    },
  },
  {
    name: "doc_compare",
    description: "Compare two versions of a document and produce a detailed diff highlighting added, removed, and modified content.",
    inputSchema: {
      type: "object",
      properties: {
        document_url_a: { type: "string", description: "URL of the first (base) document" },
        document_url_b: { type: "string", description: "URL of the second (comparison) document" },
        comparison_type: {
          type: "string",
          enum: ["text", "semantic", "legal_clauses", "financial_figures"],
          description: "Type of comparison to perform",
          default: "text",
        },
      },
      required: ["document_url_a", "document_url_b"],
    },
  },
  {
    name: "doc_ocr_scan",
    description: "Perform OCR on a scanned document or image to extract machine-readable text with layout preservation.",
    inputSchema: {
      type: "object",
      properties: {
        image_url: { type: "string", description: "URL of the image or scanned document to OCR" },
        language: { type: "string", description: "Primary language of the document for OCR optimization", default: "en" },
        output_format: {
          type: "string",
          enum: ["plain_text", "markdown", "json_with_bounding_boxes", "searchable_pdf"],
          description: "Format for OCR output",
          default: "plain_text",
        },
      },
      required: ["image_url"],
    },
  },
  {
    name: "doc_translate",
    description: "Translate a full document from one language to another while preserving the original layout and formatting.",
    inputSchema: {
      type: "object",
      properties: {
        document_url: { type: "string", description: "URL of the document to translate" },
        target_language: { type: "string", description: "Target language code (e.g. 'es', 'fr', 'de', 'zh')" },
        source_language: { type: "string", description: "Source language code (auto-detected if omitted)" },
        preserve_layout: { type: "boolean", description: "Maintain original document layout in the translated output", default: true },
      },
      required: ["document_url", "target_language"],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 26. GPU INFERENCE
  // ═══════════════════════════════════════════════════════════
  {
    name: "gpu_request_inference",
    description: "Request GPU-accelerated model inference for LLM, image generation, embedding, or custom model workloads.",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string", description: "Model identifier to run inference with (e.g. 'llama-3-70b', 'sdxl-turbo')" },
        input_data: { type: "object", description: "Input payload for the model (prompt, image, embedding input, etc.)" },
        gpu_tier: {
          type: "string",
          enum: ["t4", "a100", "h100", "h200"],
          description: "GPU hardware tier to use",
          default: "a100",
        },
        max_tokens: { type: "integer", description: "Maximum output tokens for LLM inference" },
        temperature: { type: "number", description: "Sampling temperature for LLM inference (0.0–2.0)" },
      },
      required: ["model_id", "input_data"],
    },
  },
  {
    name: "gpu_get_result",
    description: "Retrieve the result of an asynchronous GPU inference job.",
    inputSchema: {
      type: "object",
      properties: {
        inference_job_id: { type: "string", description: "Inference job ID returned from gpu_request_inference" },
      },
      required: ["inference_job_id"],
    },
  },
  {
    name: "gpu_list_models",
    description: "Browse available models for GPU inference with their capabilities, context lengths, and per-token pricing.",
    inputSchema: {
      type: "object",
      properties: {
        model_type: {
          type: "string",
          enum: ["llm", "image_generation", "embedding", "audio", "video", "custom", "all"],
          description: "Filter models by type",
          default: "all",
        },
        max_price_per_token: { type: "number", description: "Maximum price per 1K tokens in USD" },
      },
    },
  },
  {
    name: "gpu_estimate_cost",
    description: "Estimate the cost of a GPU inference job before committing, based on model, input size, and hardware tier.",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string", description: "Model to estimate cost for" },
        input_tokens: { type: "integer", description: "Estimated number of input tokens" },
        output_tokens: { type: "integer", description: "Estimated number of output tokens" },
        gpu_tier: {
          type: "string",
          enum: ["t4", "a100", "h100", "h200"],
          description: "GPU hardware tier",
          default: "a100",
        },
      },
      required: ["model_id", "input_tokens"],
    },
  },
  {
    name: "gpu_batch_inference",
    description: "Submit a batch of inference requests to run in parallel on GPU infrastructure at reduced cost.",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string", description: "Model to use for all batch inference requests" },
        inputs: {
          type: "array",
          items: { type: "object" },
          description: "Array of input payloads to process in batch",
        },
        gpu_tier: {
          type: "string",
          enum: ["t4", "a100", "h100", "h200"],
          description: "GPU hardware tier for batch processing",
          default: "a100",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Batch processing priority",
          default: "normal",
        },
      },
      required: ["model_id", "inputs"],
    },
  },
];

// ─── Handler Function ─────────────────────────────────────────────────────────

export async function handleNewTool(name, args) {
  switch (name) {

    // ─── Human-in-the-Loop ────────────────────────────────────
    case "hitl_submit_task":
      return hitl.submitHitlTask(args.task_type, args.description, args.urgency, args.max_budget_usd);
    case "hitl_get_status":
      return hitl.getHitlTaskStatus(args.task_id);
    case "hitl_get_result":
      return hitl.getHitlResult(args.task_id);
    case "hitl_list_workers":
      return hitl.listHitlWorkers(args.specialty, args.min_rating);
    case "hitl_set_budget":
      return hitl.setHitlBudget(args.agent_id, args.daily_limit_usd);

    // ─── Voice Telephony ──────────────────────────────────────
    case "voice_initiate_call":
      return voiceTelephony.initiateCall(args);
    case "voice_get_status":
      return voiceTelephony.getCallStatus(args.call_id);
    case "voice_get_transcript":
      return voiceTelephony.getCallTranscript(args.call_id);
    case "voice_schedule_callback":
      return voiceTelephony.scheduleCallback(args);
    case "voice_list_calls":
      return voiceTelephony.listCalls(args);

    // ─── Physical Logistics ───────────────────────────────────
    case "logistics_create_shipment":
      return physicalLogistics.createShipment(args);
    case "logistics_track":
      return physicalLogistics.trackShipment(args.tracking_number, args.carrier);
    case "logistics_request_verification":
      return physicalLogistics.requestLocalVerification(args);
    case "logistics_dispatch_courier":
      return physicalLogistics.dispatchCourier(args);
    case "logistics_get_fulfillment_quote":
      return physicalLogistics.getFulfillmentQuote(args);

    // ─── Communication Rails ──────────────────────────────────
    case "comms_send_verified_message":
      return communicationRails.sendVerifiedMessage(args);
    case "comms_get_delivery_status":
      return communicationRails.getDeliveryStatus(args.message_id);
    case "comms_schedule_followup":
      return communicationRails.scheduleFollowup(args);
    case "comms_verify_acknowledgment":
      return communicationRails.verifyAcknowledgment(args.message_id);
    case "comms_list_channels":
      return communicationRails.listChannels(args);

    // ─── Browser Auth ─────────────────────────────────────────
    case "browser_lease_session":
      return browserAuth.leaseBrowserSession(args);
    case "browser_get_session_status":
      return browserAuth.getSessionStatus(args.session_id);
    case "browser_end_session":
      return browserAuth.endSession(args.session_id);
    case "browser_list_sessions":
      return browserAuth.listAvailableSessions(args);
    case "browser_configure_session":
      return browserAuth.configureSession(args);

    // ─── Antibot Bypass ───────────────────────────────────────
    case "antibot_extract_page":
      return antibotBypass.extractProtectedPage(args);
    case "antibot_batch_extract":
      return antibotBypass.batchExtract(args);
    case "antibot_get_extraction_status":
      return antibotBypass.getExtractionStatus(args.job_id);
    case "antibot_configure_proxy":
      return antibotBypass.configureProxyRegion(args);
    case "antibot_get_stats":
      return antibotBypass.getBypassStats(args);

    // ─── Paywall Broker ───────────────────────────────────────
    case "paywall_search":
      return paywallBroker.searchLicensedData(args);
    case "paywall_access_article":
      return paywallBroker.accessArticle(args);
    case "paywall_query_database":
      return paywallBroker.queryDatabase(args);
    case "paywall_list_sources":
      return paywallBroker.listDataSources(args);
    case "paywall_get_pricing":
      return paywallBroker.getSubscriptionPricing(args.source_id);

    // ─── API Subletting ───────────────────────────────────────
    case "apisub_rent_access":
      return apiSubletting.rentApiAccess(args);
    case "apisub_list_available":
      return apiSubletting.listAvailableApis(args);
    case "apisub_get_usage_stats":
      return apiSubletting.getUsageStats(args.rental_id);
    case "apisub_estimate_cost":
      return apiSubletting.estimateApiCost(args);

    // ─── Agent Identity & Delegation ─────────────────────────
    case "identity_register":
      return agentIdentity.registerAgentIdentity(args);
    case "identity_grant_delegation":
      return agentIdentity.grantDelegation(args);
    case "identity_verify_delegation":
      return agentIdentity.verifyDelegation(args.delegation_id, args.required_scope);
    case "identity_revoke_delegation":
      return agentIdentity.revokeDelegation(args.delegation_id, args.principal_agent_id, args.reason);
    case "identity_get_profile":
      return agentIdentity.getAgentProfile(args.agent_id);

    // ─── Compliance Router ────────────────────────────────────
    case "legal_check_compliance":
      return complianceRouter.checkCompliance(args);
    case "legal_route_jurisdiction":
      return complianceRouter.routeJurisdiction(args);
    case "legal_get_requirements":
      return complianceRouter.getRegulatoryRequirements(args);
    case "legal_validate_action":
      return complianceRouter.validateAction(args);
    case "legal_list_jurisdictions":
      return complianceRouter.listJurisdictions(args);

    // ─── E-Signature & Filing ─────────────────────────────────
    case "esig_create_signature_request":
      return esignature.createSignatureRequest(args);
    case "esig_file_entity":
      return esignature.fileEntity(args);
    case "esig_check_filing_status":
      return esignature.checkFilingStatus(args.filing_id);
    case "esig_get_templates":
      return esignature.getTemplates(args);
    case "esig_sign_document":
      return esignature.signDocument(args);

    // ─── ZK Vaults ────────────────────────────────────────────
    case "zkvault_deposit":
      return zkVaults.depositSecret(args);
    case "zkvault_request_token":
      return zkVaults.requestEphemeralToken(args);
    case "zkvault_revoke_access":
      return zkVaults.revokeAccess(args.vault_id, args.delete_vault);
    case "zkvault_list_vaults":
      return zkVaults.listVaults(args);
    case "zkvault_audit_access":
      return zkVaults.auditAccess(args.vault_id, args.limit);

    // ─── Proof of Completion ──────────────────────────────────
    case "proof_submit":
      return proofOfCompletion.submitProof(args);
    case "proof_verify_completion":
      return proofOfCompletion.verifyCompletion(args);
    case "proof_get_status":
      return proofOfCompletion.getProofStatus(args.proof_id);
    case "proof_generate_attestation":
      return proofOfCompletion.generateAttestation(args);
    case "proof_list_verifications":
      return proofOfCompletion.listVerifications(args);

    // ─── Dispute Resolution ───────────────────────────────────
    case "dispute_file":
      return disputeResolution.fileDispute(args);
    case "dispute_submit_evidence":
      return disputeResolution.submitEvidence(args);
    case "dispute_get_ruling":
      return disputeResolution.getRuling(args.dispute_id);
    case "dispute_appeal_ruling":
      return disputeResolution.appealRuling(args);
    case "dispute_list":
      return disputeResolution.listDisputes(args);

    // ─── Outcome Reputation ───────────────────────────────────
    case "reputation_get_score":
      return outcomeReputation.getOutcomeScore(args.entity_id, args.category);
    case "reputation_report_outcome":
      return outcomeReputation.reportOutcome(args);
    case "reputation_get_metrics":
      return outcomeReputation.getPerformanceMetrics(args.entity_id, args.time_period_days);
    case "reputation_compare_providers":
      return outcomeReputation.compareProviders(args);
    case "reputation_get_risk_score":
      return outcomeReputation.getRiskScore(args.entity_id, args.transaction_value_usd);

    // ─── Confidence Oracles ───────────────────────────────────
    case "oracle_query_confidence":
      return confidenceOracles.queryConfidence(args.question, args.domain, args.stake_usd);
    case "oracle_stake_answer":
      return confidenceOracles.stakeAnswer(args.query_id, args.answer, args.confidence_level, args.stake_usd);
    case "oracle_get_calibrated_estimate":
      return confidenceOracles.getCalibratedEstimate(args.query_id);
    case "oracle_list_open_queries":
      return confidenceOracles.listOpenQueries(args.domain);
    case "oracle_resolve_query":
      return confidenceOracles.resolveQuery(args.query_id, args.resolution);

    // ─── Red Team & Security ──────────────────────────────────
    case "redteam_submit_workflow":
      return redTeam.submitWorkflowReview(args);
    case "redteam_get_threat_analysis":
      return redTeam.getThreatAnalysis(args.review_id);
    case "redteam_list_vulnerabilities":
      return redTeam.listVulnerabilities(args);
    case "redteam_simulate_failure":
      return redTeam.simulateFailure(args);
    case "redteam_get_risk_report":
      return redTeam.getRiskReport(args);

    // ─── Virtual Cards & Fiat Bridge ──────────────────────────
    case "vcard_mint":
      return virtualCards.mintVirtualCard(args.funding_amount_usd, args.currency, args.merchant_category, args.single_use);
    case "vcard_get_details":
      return virtualCards.getCardDetails(args.card_id);
    case "vcard_freeze":
      return virtualCards.freezeCard(args.card_id);
    case "vcard_list_transactions":
      return virtualCards.listCardTransactions(args.card_id);
    case "vcard_set_limits":
      return virtualCards.setCardLimits(args.card_id, args.max_transaction_usd, args.allowed_merchants);

    // ─── Agent Financial Controls ─────────────────────────────
    case "budget_create":
      return agentBudgets.createBudget(args);
    case "budget_allocate_funds":
      return agentBudgets.allocateFunds(args);
    case "budget_get_spending_report":
      return agentBudgets.getSpendingReport(args);
    case "budget_set_approval_threshold":
      return agentBudgets.setApprovalThreshold(args);
    case "budget_reconcile":
      return agentBudgets.reconcileTransactions(args);

    // ─── Project Management ───────────────────────────────────
    case "project_create":
      return projectManagement.createProject(args);
    case "project_add_milestone":
      return projectManagement.addMilestone(args);
    case "project_update_progress":
      return projectManagement.updateProgress(args);
    case "project_assign_agent":
      return projectManagement.assignAgent(args);
    case "project_get_status":
      return projectManagement.getProjectStatus(args.project_id);
    case "project_release_milestone_payment":
      return projectManagement.releaseMilestonePayment(args);

    // ─── SLA & Insurance ─────────────────────────────────────
    case "sla_purchase":
      return slaInsurance.purchaseSla(args);
    case "sla_check_status":
      return slaInsurance.checkSlaStatus(args.sla_id);
    case "sla_file_claim":
      return slaInsurance.fileSlaClaim(args);
    case "sla_get_coverage_options":
      return slaInsurance.getCoverageOptions(args);
    case "sla_list_active":
      return slaInsurance.listActiveSlas(args.agent_id);

    // ─── Knowledge Distillation ───────────────────────────────
    case "knowledge_publish_lesson":
      return knowledgeDistillation.publishLesson(args);
    case "knowledge_query":
      return knowledgeDistillation.queryKnowledge(args);
    case "knowledge_get_trending":
      return knowledgeDistillation.getTrendingInsights(args);
    case "knowledge_rate_lesson":
      return knowledgeDistillation.rateLesson(args);
    case "knowledge_list_domains":
      return knowledgeDistillation.listDomains(args);

    // ─── Schema Translation ───────────────────────────────────
    case "schema_translate":
      return schemaTranslation.translateSchema(args);
    case "schema_list_formats":
      return schemaTranslation.listSupportedFormats();
    case "schema_validate":
      return schemaTranslation.validateSchema(args);
    case "schema_batch_translate":
      return schemaTranslation.batchTranslate(args);

    // ─── Sandbox Testing ──────────────────────────────────────
    case "sandbox_create":
      return sandboxTesting.createSandbox(args);
    case "sandbox_run_test":
      return sandboxTesting.runTest(args);
    case "sandbox_get_results":
      return sandboxTesting.getTestResults(args.test_run_id);
    case "sandbox_compare_providers":
      return sandboxTesting.compareSandboxProviders(args);
    case "sandbox_list":
      return sandboxTesting.listSandboxes(args);

    // ─── Document Processing ──────────────────────────────────
    case "doc_extract":
      return documentProcessing.extractDocument(args);
    case "doc_redact":
      return documentProcessing.redactDocument(args);
    case "doc_compare":
      return documentProcessing.compareDocuments(args);
    case "doc_ocr_scan":
      return documentProcessing.ocrScan(args);
    case "doc_translate":
      return documentProcessing.translateDocument(args);

    // ─── GPU Inference ────────────────────────────────────────
    case "gpu_request_inference":
      return gpuInference.requestInference(args);
    case "gpu_get_result":
      return gpuInference.getInferenceResult(args.inference_job_id);
    case "gpu_list_models":
      return gpuInference.listAvailableModels(args);
    case "gpu_estimate_cost":
      return gpuInference.estimateInferenceCost(args);
    case "gpu_batch_inference":
      return gpuInference.batchInference(args);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
