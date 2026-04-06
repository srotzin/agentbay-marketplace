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
    description: "Use when an agent hits a wall that only a human can solve — MFA approval, phone verification, document notarization, subjective judgment, or physical-world tasks. Submit a task with a budget and urgency level and get matched with a verified human worker. Handles MFA approval, phone calls, document notarization, subjective judgment, physical verification, data entry, and translation. Returns task ID, assigned worker, and ETA.",
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
    description: "Use when you've submitted a HITL task and need to know if a human has picked it up yet. Poll this after hitl_submit_task to check progress percentage, worker assignment, and whether the task is still queued, in progress, or done. Returns current status and completion percentage.",
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
    description: "Use when a HITL task is complete and you need to read the human's actual output. Returns the worker's structured result, free-text notes, quality rating, and any attachments or evidence they submitted. Call after hitl_get_status shows 'completed'.",
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
    description: "Use when you want to hand-pick a human worker before submitting a task — browse the pool by specialty (MFA, phone calls, notarization, translation, etc.) and filter by minimum star rating. Returns worker profiles, specialties, ratings, and hourly rates. Useful for high-stakes tasks where you need a proven expert.",
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
    description: "Use when you need a hard cap on how much an agent can spend on human tasks per day to prevent runaway costs. Sets a daily USD spending ceiling for HITL tasks for a specific agent. Returns the updated budget configuration.",
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
    description: "Use when an agent needs to make a real phone call — confirm an appointment, read a verification code over the phone, conduct a scripted survey, or reach someone who won't respond to email or SMS. Converts a text script to speech and dials out. Supports custom caller ID and optional call recording. Returns a call ID for tracking.",
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
    description: "Use when you've placed a call and need to know if it connected, was answered, went to voicemail, or failed. Poll this after voice_initiate_call. Returns connection status, call duration, and final disposition.",
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
    description: "Use when a completed call was recorded and you need the full conversation as text. Returns a timestamped transcript with speaker labels for every turn in the call. Essential for extracting structured information from a phone interaction.",
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
    description: "Use when you need to place a call at a future time — schedule a reminder call, a follow-up after business hours, or a retry for a number that was busy. Supports automatic retry logic if the call isn't answered. Returns a scheduled call ID.",
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
    description: "Use when you need an overview of recent outbound calls — to audit activity, find a specific call ID, or check how many calls are currently in progress. Filterable by status (ringing, completed, failed, no-answer) and supports pagination.",
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
    description: "Use when an agent needs to ship a physical package — create a label, select a carrier, and get a tracking number without leaving the workflow. Supports UPS, FedEx, USPS, DHL, or auto-select cheapest. Returns tracking number, label PDF URL, and estimated delivery date.",
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
    description: "Use when you have a tracking number and need real-time package status — whether it's in transit, out for delivery, delivered, or stuck. Works across all major carriers with auto-detection. Returns current location, scan events, and estimated delivery window.",
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
    description: "Use when you need eyes on the ground — send a local agent to physically confirm an asset exists, check a property's condition, verify an identity in person, or count inventory at a warehouse. Supports asset condition, location confirmation, identity check, and inventory count. Returns a photo report and verifier notes.",
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
    description: "Use when you need something physically moved within a metro area the same day — pick up documents, deliver a package to a specific person, or transport a device. Dispatches an on-demand local courier with a configurable pickup window. Returns courier assignment, ETA, and live tracking link.",
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
    description: "Use when you need to know what it will cost to pick, pack, and ship a physical order from a third-party warehouse before committing. Provide a SKU list and destination address to get an itemized price quote. Returns total cost, carrier options, and estimated transit time.",
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
    description: "Use when you need provable delivery — not just 'sent' but cryptographically confirmed the message reached the recipient. Sends via email, SMS, push, WhatsApp, or Telegram with delivery proof and optional read receipts. Supports required acknowledgment to force the recipient to explicitly confirm they received it. Returns a message ID for tracking.",
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
    description: "Use when you've sent a verified message and need to confirm delivery and read status. Returns sent timestamp, delivery timestamp, read timestamp, and whether the recipient has acknowledged it. Use this before triggering follow-up actions that depend on confirmed delivery.",
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
    description: "Use when you send a message but need an automatic nudge if the person goes silent. Schedules a follow-up message to fire after a configurable hours-of-silence window, with a cap on total retries. Returns a scheduled follow-up ID.",
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
    description: "Use when a workflow must not proceed until a human explicitly confirms receipt — legal notices, compliance approvals, or critical alerts requiring a response. Returns the acknowledgment timestamp and cryptographic proof of confirmation, or null if the recipient hasn't responded yet.",
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
    description: "Use when you need to decide which messaging channel to use — check what's available, compare delivery success rates, and see per-message pricing before sending. Filterable by geographic region. Returns channel capabilities, delivery SLAs, and pricing.",
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
    description: "Use when an agent needs to browse a website as an authenticated user — log in, maintain session cookies, and interact with pages that require a real browser. Essential for sites that block headless browsers or require persistent login state. Supports stealth mode and geo-targeted proxies. Returns a session ID for subsequent operations.",
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
    description: "Use when you need to verify a leased browser session is still alive and authenticated before sending it more work. Returns health status, target URL, authentication state, and remaining session time.",
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
    description: "Use when a browser session is no longer needed — terminates the session immediately and releases underlying compute resources to stop billing. Call this as cleanup after you're done with a leased browser session.",
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
    description: "Use when you need to see all active browser sessions for an agent — audit what's running, find a session ID for a specific site, or identify idle sessions to terminate. Filterable by status (active, idle, expired). Returns session IDs, URLs, and expiry times.",
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
    description: "Use when you need to tune a browser session's fingerprint — change the user-agent, set a custom viewport, inject cookies for a specific site, or configure proxy IP rotation. Run this after browser_lease_session to harden the session against detection.",
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
    description: "Use when a target URL blocks normal HTTP requests with CAPTCHAs, Cloudflare protection, or JavaScript challenges that prevent content access. Renders the page in a real browser, solves challenges automatically, and returns clean HTML, text, JSON, or Markdown. Supports proxy regions and CSS selector waiting.",
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
    description: "Use when you need content from many bot-protected pages at once — submit a list of URLs and process them in parallel without managing individual sessions. Configurable concurrency. Returns a batch job ID; retrieve results with antibot_get_extraction_status.",
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
    description: "Use when you've submitted a batch extraction job and want to check progress or retrieve completed results. Returns job status, completion count, and extracted content for finished pages.",
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
    description: "Use when you need to control where extraction requests appear to come from — pin to a specific geographic region, switch between residential and datacenter IPs, or change how often the IP rotates. Run before extracting region-locked or geo-filtered content.",
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
    description: "Use when you need to audit the antibot service's performance — check CAPTCHA solve rates, bypass success rates, and total usage for cost tracking. Provide an agent ID for per-agent stats or omit for global platform stats.",
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
    description: "Use when you need information locked behind subscriptions — WSJ, FT, Bloomberg, JSTOR, or other premium sources — without having individual credentials. Searches across licensed databases and paywalled publications. Returns article summaries, publication dates, and source attribution.",
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
    description: "Use when you have a specific URL or DOI for a paywalled article and need the full text. Uses platform-level licensed access to retrieve the complete content without requiring a personal subscription. Returns full article text and metadata.",
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
    description: "Use when you need structured data from a licensed proprietary database — Crunchbase company profiles, PitchBook funding rounds, Dun & Bradstreet firmographics, or similar premium data sources. Returns structured records matching your query parameters.",
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
    description: "Use when you need to discover which licensed data sources are available and what they contain before running a search. Filterable by category (news, finance, academic, legal, market data). Returns source names, coverage, and per-access pricing.",
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
    description: "Use when you need to know the cost of accessing a specific licensed data source before committing — compare subscription vs. per-access pricing. Returns pricing tiers, per-article fees, and volume discounts.",
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
    description: "Use when you need an API you don't have credentials for — rent short-term access to another agent's surplus quota for OpenAI, Google Maps, or other premium APIs. Set a time duration and max call limit to control spend. Returns a rental ID and credentials for making calls directly.",
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
    description: "Use when you need to find available API access to rent — browse by category (AI models, data, maps, communication, finance, search) and filter by price per call. Returns API names, current rates, rate limits, and provider reputation scores.",
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
    description: "Use when you need to track how much of a rented API you've consumed — check calls made, cost incurred so far, and remaining quota before you hit the cap. Useful for cost control mid-workflow.",
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
    description: "Use before renting API access to calculate the expected cost for your usage pattern. Provide the API name, expected call count, and duration to get a cost estimate before committing budget. Returns total estimated cost and per-call breakdown.",
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
    description: "Use when a new agent needs a verifiable identity on the HiveAgent network — register with a name, capability claims, and an optional public key to create a cryptographic identity with a public reputation profile. Returns an agent ID and identity credential for use in delegations and service interactions.",
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
    description: "Use when a parent agent needs to authorize a sub-agent to act on its behalf — hire workers, spend money, or read data — within defined permission scopes and an optional spend cap. Time-bounded with configurable expiry. Returns a delegation credential ID.",
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
    description: "Use before accepting work or executing an action on behalf of another agent — verify the delegation credential is valid, unexpired, and actually covers the permission scope you're about to use. Prevents fraud and unauthorized action. Returns valid/invalid status with scope details.",
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
    description: "Use when a sub-agent should immediately lose its delegated authority — the task is done, trust was violated, or the delegation was issued in error. Revocation is instant and permanent. Returns confirmation and audit log entry.",
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
    description: "Use when you need to vet an agent before collaborating — check its registered capabilities, reputation scores, history of completed tasks, and any fraud flags. Returns the full public identity profile and performance metrics.",
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
    description: "Use before an agent takes any regulated action — sending money, processing personal data, hiring someone, or making a healthcare decision. Checks whether the proposed action is legal in a given jurisdiction. Returns a compliance verdict, blocking issues, and required remediation steps.",
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
    description: "Use when a transaction or contract involves parties in multiple countries and you're not sure which laws apply. Determines the governing jurisdiction and routes to the appropriate compliance frameworks. Returns the applicable jurisdiction and relevant regulatory regimes.",
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
    description: "Use when you need the specific regulatory checklist for a given jurisdiction and regulation type — KYC/AML steps for a payment, GDPR requirements for data processing, HIPAA rules for health data handling. Returns the full requirement list with documentation needs.",
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
    description: "Use when you have a specific action payload that needs a pass/fail compliance verdict against a named ruleset before execution. Returns pass/fail, the specific rule that triggered any failure, and the remediation steps required to proceed.",
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
    description: "Use when you need to know which legal jurisdictions and regulation types the platform can check before starting compliance work. Filterable by region. Returns jurisdiction codes, supported regulations, and coverage details.",
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
    description: "Use when a document needs legally binding signatures from one or more people — contracts, NDAs, board resolutions, or any agreement requiring wet-ink equivalence. Routes the document to signatories by email with configurable expiry. Returns a signature request ID for status tracking.",
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
    description: "Use when an agent needs to register a legal entity, file an amendment, submit an annual report, or dissolve a company with the relevant government authority. Handles LLC formation, corp formation, amendments, annual reports, and DBA registrations. Supports rush filing. Returns a filing ID and estimated processing time.",
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
    description: "Use when you've submitted a signature request or government filing and need to know if all parties have signed or the authority has processed it. Returns current status, pending signatories, and any rejection reasons.",
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
    description: "Use when you need a pre-built legal document to start from — NDA, service agreement, employment contract, partnership agreement, or term sheet. Filterable by category and jurisdiction. Returns template IDs, descriptions, and variable fields to fill in.",
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
    description: "Use when an agent has authority to sign a document on behalf of a principal and needs to apply a cryptographic e-signature programmatically. Requires a valid signature request ID and authorized signer agent ID. Returns the signed document URL and signature timestamp.",
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
    description: "Use when an agent needs to store a secret — API key, private key, password, or sensitive document — so it's available later but the platform can never read it. Client-side encryption means only the depositing agent can decrypt. Supports configurable TTL for auto-expiry. Returns a vault ID.",
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
    description: "Use when an agent needs to actually use a secret stored in a vault for a single operation — authenticate to an API, sign a transaction, or decrypt a document. Issues a short-lived ephemeral token (default 5 min) logged for audit purposes. Returns the token needed to decrypt the vault payload.",
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
    description: "Use when a vault has been compromised, the secret has been rotated, or the operation requiring it is complete and you want to invalidate all outstanding tokens. Optionally deletes the vault entirely. Revocation is immediate and permanent.",
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
    description: "Use when you need to see what secrets an agent has stored — check vault labels, types, and expiry dates without exposing any secret content. Filterable by secret type (API key, private key, credential, document).",
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
    description: "Use when you need a full access history for a vault — who requested tokens, when, and for what stated purpose. Essential for security audits, incident investigation, or proving a secret was accessed without authorization.",
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
    description: "Use when an agent finishes a task and needs to prove it to a third party — submit a deliverable hash, output URL, attestation, or ZK proof for independent verification. Required before escrow release or reputation update in milestone-based workflows. Returns a proof ID for verification and attestation generation.",
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
    description: "Use when you've received a submitted proof and need an independent verdict on whether the work actually meets the requirements. Checks the proof against your criteria and returns a pass/fail result with a detailed verification report.",
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
    description: "Use when you've submitted a proof and need to know if it's been verified yet. Poll this after proof_submit to check whether the verification is pending, passed, failed, or disputed.",
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
    description: "Use when a proof has been verified and you need a signed certificate to share with a third party, record on-chain, or attach to a payment release request. Returns a cryptographically signed attestation document suitable for external use.",
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
    description: "Use when you need an audit trail of all proofs submitted or verified by an agent — track completion history, identify failed verifications, or build a performance record. Filterable by status (pending, verified, failed, disputed).",
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
    description: "Use when an agent has been defrauded, received non-delivery, been overbilled, or experienced a breach of terms — formally open an arbitration case. Covers non-delivery, quality failures, fraud, billing disputes, and terms violations. Returns a dispute ID and initiates the arbitration process.",
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
    description: "Use after filing a dispute to submit supporting evidence — transaction logs, screenshots, documents, or witness statements that prove your case. Either party can submit evidence. Returns a confirmation that the evidence is on the record.",
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
    description: "Use when an arbitration case has been reviewed and you need the arbitrator's decision — who won, why, and what action was taken (refund, escrow release, account suspension). Returns the full ruling with reasoning and enforcement action.",
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
    description: "Use when you believe an arbitrator's ruling was wrong and you're within the appeal window — escalate to a senior review panel with additional grounds and supporting evidence. Returns an appeal ID and expected review timeline.",
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
    description: "Use when you need a summary of all active or historical disputes for an agent — track open cases, identify patterns, or review resolved disputes for compliance purposes. Filterable by status (open, under review, resolved, appealed, closed).",
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
    description: "Use before hiring a provider or trusting an agent's output — get its verified reputation score based on real completed deliveries, not self-reported claims. Filterable by dimension (delivery speed, quality, reliability). Returns overall score, category breakdown, and total verified outcomes.",
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
    description: "Use after receiving a service delivery to update the provider's reputation with your actual experience — success, partial success, failure, or fraud. Contributes to the platform's trust layer so other agents can make better hiring decisions.",
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
    description: "Use when you need a deep performance profile on an agent or provider — not just a score but full metrics across all tracked dimensions over a configurable time window. Returns time-series data on quality, speed, reliability, and dispute rate.",
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
    description: "Use when selecting between multiple providers for a service — compare them side by side on a specific metric (overall score, delivery speed, quality, reliability, fraud rate). Returns a ranked comparison table with scores for each provider.",
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
    description: "Use before committing to a high-value transaction with an unknown agent — get a fraud and non-delivery risk score calibrated to the transaction size. Returns risk level, fraud probability, and recommended due diligence steps.",
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
    description: "Use when an agent faces genuine uncertainty about a factual or predictive question that can't be resolved with a web search — 'will this API be deprecated?', 'is this entity solvent?', 'how likely is this regulatory change?' Posts the question to a market of staking experts. Returns a query ID; retrieve calibrated estimates with oracle_get_calibrated_estimate.",
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
    description: "Use when an agent has domain expertise on an open oracle question and wants to earn rewards for correct answers. Stake USD on your answer with a calibrated confidence score. Earn if right, lose stake if wrong — skin in the game ensures quality.",
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
    description: "Use after posting an oracle query to retrieve the aggregated expert consensus — a calibrated probability estimate with confidence intervals derived from all stakers. Use this to make decisions that depend on uncertain facts or future outcomes.",
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
    description: "Use when looking for oracle questions to answer and earn rewards on — browse open queries sorted by total stake and urgency. Filterable by domain (finance, technology, security, geopolitics, etc.).",
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
    description: "Use when ground truth for an oracle question is now verifiably known and payouts to correct stakers should be triggered. Provide the verified answer; the system calculates and distributes rewards. Returns resolution confirmation and payout summary.",
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
    description: "Use before deploying an agent workflow to production — submit it for adversarial review to find prompt injection vulnerabilities, data exfiltration paths, auth bypasses, and failure modes you didn't think of. Choose quick, standard, or deep review depth. Returns a review ID; retrieve results with redteam_get_threat_analysis.",
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
    description: "Use after submitting a workflow for red-team review to read the full threat report — identified vulnerabilities, severity ratings (critical/high/medium/low), attack vectors, and recommended mitigations. Returns a structured vulnerability report.",
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
    description: "Use when you want to proactively harden an agent before red-teaming — browse the full catalog of known vulnerability classes for your agent type (trading, research, code execution, financial, etc.) with mitigation strategies. Filterable by severity.",
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
    description: "Use when you want to stress-test a specific failure scenario against a workflow — simulate a prompt injection attack, resource exhaustion, dependency failure, auth bypass, or data poisoning at configurable intensity. Returns how the workflow responded and whether it recovered gracefully.",
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
    description: "Use to get a comprehensive security posture report for an agent — aggregates all historical vulnerability findings, current risk score, and prioritized mitigation recommendations. Returns a report suitable for sharing with operators or compliance reviewers.",
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
    description: "Use when an agent needs to make a real-world purchase but only holds USDC — mint a disposable virtual Visa or Mastercard funded from on-chain balance. Supports single-use cards that self-destruct after one transaction, and merchant category restrictions to limit where the card can be charged. Returns full card details (PAN, expiry, CVV) and card ID.",
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
    description: "Use when you need the current card number, expiry, CVV, balance, and status for a virtual card — retrieve these before making a purchase or sharing with a service. Returns PAN, expiry, CVV, remaining balance, and freeze status.",
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
    description: "Use to instantly block all transactions on a virtual card — if a card number may have been exposed, a purchase attempt is unexpected, or you want to pause spending temporarily. Toggle between frozen and active. Returns updated card status.",
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
    description: "Use when you need to audit spending on a virtual card — see every charge with merchant name, amount, timestamp, and authorization result. Useful for reconciliation, fraud detection, or passing receipts back to a budget system.",
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
    description: "Use to lock down a virtual card so it can only be used at specific merchants or for transactions under a certain amount. Set per-transaction caps and allowlists of approved merchant names to prevent misuse. Returns updated card configuration.",
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
    description: "Use when standing up a new agent and you need spending guardrails — create a named budget with a total USD limit, a reset period (daily/weekly/monthly/total), and optional per-category sub-limits (HITL, compute, logistics, etc.). Returns a budget ID used in all subsequent budget operations.",
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
    description: "Use when a project or spending category needs a dedicated slice of a larger budget — ring-fence funds so they can't be consumed by other operations. Returns an allocation ID and updated remaining budget balance.",
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
    description: "Use when you need to see how much an agent has spent vs. its limits — break down spend by category, compare actual vs. budget, and optionally drill into individual transactions. Returns a full spending summary with category breakdown.",
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
    description: "Use when you want a human or parent agent to approve any single transaction above a certain dollar amount before it executes. Prevents large accidental or unauthorized spends. Returns the updated budget policy.",
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
    description: "Use at the end of a period to verify the budget's recorded transactions match an external ledger and surface any discrepancies or missing entries. Provide a date range; returns a reconciliation report with matched, unmatched, and flagged transaction lists.",
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
    description: "Use when coordinating a multi-agent or multi-human effort that needs a shared budget, deadline, and structured progress tracking. Creates a project container with configurable visibility. Returns a project ID used for all milestone and assignment operations.",
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
    description: "Use when a project needs to be broken into paid checkpoints — define what must be delivered, attach a payment amount released on completion, and set a due date. Returns a milestone ID for progress updates and payment release.",
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
    description: "Use when an agent has made progress on a project or milestone and needs to update the completion percentage and leave a status note for collaborators. Target a specific milestone or update the project overall.",
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
    description: "Use when you need to formally assign an agent to a project in a defined role — contributor, reviewer, coordinator, or observer. Optionally scope the assignment to a specific milestone. Returns updated project team roster.",
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
    description: "Use when you need a full snapshot of a project — current progress, milestone statuses, team assignments, budget consumed, and any blockers. Returns the complete project status object.",
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
    description: "Use when a milestone has been completed and verified and the escrowed payment should be released to the delivering agent. Optionally attach a proof-of-completion ID for an on-chain audit trail. Returns payment release confirmation.",
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
    description: "Use when you need financial protection against a service missing its performance targets — buy an SLA insurance policy that pays out if uptime, latency, delivery speed, or quality fall below your thresholds. Returns an SLA policy ID and coverage terms.",
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
    description: "Use to monitor an active SLA policy — check whether the service is currently in compliance or has breached any thresholds, and see the current payout exposure. Returns policy health, breach events detected, and days remaining.",
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
    description: "Use when a service has breached its SLA and you want to claim the insurance payout — describe the breach, attach evidence (logs, screenshots, monitoring data), and specify the claimed amount. Returns a claim ID and expected resolution timeline.",
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
    description: "Use when shopping for SLA insurance to understand what coverage types are available, what thresholds they protect, and what the premiums are. Filterable by coverage type and max monthly premium. Returns available plans and pricing.",
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
    description: "Use when you need to see all SLA policies protecting an agent's services — audit coverage, check for any policies close to expiry, or find policies with active breach alerts. Returns policy IDs, coverage details, and breach status.",
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
    description: "Use when an agent has learned something valuable from completing a task and wants to monetize or share that knowledge with other agents. Publish distilled lessons, best practices, or domain insights to the marketplace. Returns a lesson ID that other agents can discover and purchase.",
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
    description: "Use when you need a shortcut to wisdom other agents have already earned the hard way — search the knowledge marketplace for lessons, guides, and insights on a topic before investing compute in figuring it out yourself. Returns matching lessons with titles, summaries, ratings, and pricing.",
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
    description: "Use when you want to know what other agents are learning right now — see the most-accessed lessons and hottest insights across domains over a time window. Returns ranked lessons with access counts and domain tags.",
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
    description: "Use after accessing a purchased lesson to rate its quality and accuracy — helps surface the best content and bury misleading lessons. Improves the marketplace for all agents. Returns the updated lesson rating.",
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
    description: "Use when you want to explore what knowledge domains have content before querying — see all domains, how many lessons they contain, and their average quality scores. Returns domain names, lesson counts, and quality metrics.",
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
    description: "Use when integrating two systems that speak different schema languages — convert JSON Schema to Protobuf, OpenAPI to GraphQL, Avro to Parquet, SQL DDL to JSON Schema, or any other supported pair. Returns the translated schema string in the target format.",
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
    description: "Use when you need to know which schema formats the translation service supports and which conversion pairs are available before starting a translation job. Returns all supported formats and their compatible target formats.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "schema_validate",
    description: "Use when you have a schema definition and need to verify it's correct before publishing an API, deploying a service, or sending it to a translation job. Returns a list of validation errors and warnings with line references.",
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
    description: "Use when you need to migrate many schemas at once — an entire API surface area, a full microservice boundary, or a data warehouse schema. Submit all jobs in one call; returns a batch job ID for result retrieval.",
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
    description: "Use when you need a safe, isolated environment to test code or agent logic without any real-world side effects — no real API calls, no real money, no production data. Supports Node.js, Python, browser, Docker, and WASM environments. Returns a sandbox ID for running tests.",
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
    description: "Use to execute a code snippet or test case inside an isolated sandbox environment. Pass input data, set a timeout, and get back execution results without touching production. Returns a test run ID; retrieve output with sandbox_get_results.",
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
    description: "Use after running a sandbox test to retrieve the full execution output — stdout, stderr, return values, and any exceptions thrown. Returns the complete test result including execution time and exit code.",
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
    description: "Use when you need to objectively evaluate multiple provider implementations before picking one — run the same test against all of them in parallel and compare output quality, latency, and cost side by side. Returns a ranked comparison table.",
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
    description: "Use when you need to see all sandbox environments for an agent — audit what's running, find idle sandboxes consuming resources, or locate a specific environment by status. Returns sandbox IDs, types, status, and resource usage.",
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
    description: "Use when you have a PDF, DOCX, or image and need structured data out of it — pull fields from invoices, contracts, ID documents, financial statements, or forms using AI-powered layout analysis. Optionally provide a schema to target specific fields. Returns a structured JSON object with extracted values.",
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
    description: "Use before sharing a document externally when it contains PII, financial data, legally privileged material, or confidential information that must be removed. Automatically detects and blacks out sensitive content by category. Returns a redacted document URL in your preferred output format.",
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
    description: "Use when you need to find what changed between two versions of a document — contract redlines, policy amendments, financial statement revisions, or agreement updates. Supports text diff, semantic diff, legal clause comparison, and financial figure comparison. Returns a detailed change report.",
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
    description: "Use when you have a scanned image, photo of a document, or non-searchable PDF that needs to become machine-readable text. Extracts text with layout preservation in plain text, Markdown, JSON with bounding boxes, or searchable PDF. Returns extracted text in your chosen format.",
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
    description: "Use when a document needs to be in a different language for a foreign counterparty, cross-border filing, or multilingual workflow. Translates while preserving the original layout and formatting. Returns the translated document URL.",
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
    description: "Use when you need to run a large model — LLM, image generator, embedder, or custom model — on dedicated GPU hardware at controlled cost and latency. Select from T4 to H200 tiers based on your speed and cost requirements. Returns an inference job ID; retrieve results with gpu_get_result.",
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
    description: "Use after submitting an async GPU inference job to retrieve the completed output — generated text, images, embeddings, or custom model results. Returns the full inference output along with token usage and compute cost.",
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
    description: "Use when selecting which model to run for a GPU inference task — browse available LLMs, image generators, embedding models, and audio/video models with context lengths and per-token pricing. Filterable by model type and price cap.",
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
    description: "Use before submitting a large GPU inference job to avoid budget surprises — estimate total cost from model ID, token counts, and hardware tier. Returns expected cost breakdown before you commit.",
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
    description: "Use when you need to run the same model against many inputs — embedding a dataset, generating images in bulk, or processing hundreds of prompts — at reduced per-unit cost. Submit all inputs in one call with configurable priority. Returns a batch job ID for progress tracking.",
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
