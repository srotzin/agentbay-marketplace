/**
 * HiveAgent MCP Tool Definitions — Money, Commerce & Operations Verticals
 *
 * This file extends the HiveAgent MCP surface with 10 new service modules
 * covering travel, procurement, agent safety, sales CRM, accounts payable,
 * fraud detection, real estate, supply chain, dynamic pricing, and HR/recruiting.
 */

import * as travelBooking   from "./services/travel-booking.js";
import * as procurement     from "./services/procurement.js";
import * as knowYourAgent   from "./services/know-your-agent.js";
import * as salesCrm        from "./services/sales-crm.js";
import * as invoiceAp       from "./services/invoice-ap.js";
import * as fraudDetection  from "./services/fraud-detection.js";
import * as realEstate      from "./services/real-estate.js";
import * as supplyChain     from "./services/supply-chain.js";
import * as dynamicPricing  from "./services/dynamic-pricing.js";
import * as hrRecruiting    from "./services/hr-recruiting.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const moneyTools = [

  // ═══════════════════════════════════════════════════════════
  // 1. TRAVEL BOOKING
  // ═══════════════════════════════════════════════════════════
  {
    name: "travel_search_flights",
    description:
      "Use when you need to find available flights between two cities or airports. Trigger phrases: 'find flights', 'search for flights', 'what flights are available', 'cheapest flight to'. Handles roundtrip and one-way searches across cabin classes with flexible-date options. Returns ranked flight options with prices, layovers, durations, and airline details.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport code or city (e.g. 'SFO', 'San Francisco')" },
        destination: { type: "string", description: "Destination airport code or city (e.g. 'JFK', 'New York')" },
        depart_date: { type: "string", description: "Departure date in ISO 8601 format (YYYY-MM-DD)" },
        return_date: { type: "string", description: "Return date for roundtrip (ISO 8601). Omit for one-way." },
        passengers: { type: "integer", description: "Number of passengers (default 1)", default: 1 },
        cabin_class: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
          description: "Cabin class preference",
          default: "economy",
        },
        flexible_dates: { type: "boolean", description: "Search ±3 days for cheaper fares", default: false },
      },
      required: ["origin", "destination", "depart_date"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "travel_book_flight",
    description:
      "Use when you need to book and confirm a specific flight for one or more passengers. Trigger phrases: 'book this flight', 'reserve seats', 'confirm the booking', 'purchase flight tickets'. Handles seat selection, meal preferences, and payment processing. Returns a confirmed booking reference, e-ticket numbers, and boarding instructions.",
    inputSchema: {
      type: "object",
      properties: {
        flight_id: { type: "string", description: "Flight ID from travel_search_flights results" },
        passengers: {
          type: "array",
          items: { type: "object" },
          description: "Array of passenger objects with name, dob, passport_number, nationality",
        },
        payment_method: {
          type: "string",
          enum: ["credit_card", "debit_card", "usdc", "agent_wallet"],
          description: "Payment method to use",
          default: "credit_card",
        },
      },
      required: ["flight_id", "passengers"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "travel_search_hotels",
    description:
      "Use when you need to find hotels, resorts, or accommodations at a destination. Trigger phrases: 'find hotels', 'search accommodations', 'where to stay', 'hotel options near'. Handles guest count, star ratings, price filters, and date ranges. Returns ranked hotel listings with nightly rates, amenities, cancellation policies, and neighborhood info.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City, neighborhood, or address to search near" },
        checkin_date: { type: "string", description: "Check-in date (ISO 8601 YYYY-MM-DD)" },
        checkout_date: { type: "string", description: "Check-out date (ISO 8601 YYYY-MM-DD)" },
        guests: { type: "integer", description: "Number of guests", default: 1 },
        rooms: { type: "integer", description: "Number of rooms needed", default: 1 },
        star_rating: { type: "integer", description: "Minimum star rating (0 = any, 5 = luxury)", default: 0 },
        max_price_per_night: { type: "number", description: "Maximum price per night in USD" },
      },
      required: ["location", "checkin_date", "checkout_date"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "travel_book_hotel",
    description:
      "Use when you need to reserve and confirm a hotel room. Trigger phrases: 'book this hotel', 'reserve a room', 'confirm hotel stay', 'lock in accommodation'. Handles multi-room bookings, special requests, and deposit collection. Returns a confirmed reservation number, check-in instructions, and hotel contact details.",
    inputSchema: {
      type: "object",
      properties: {
        hotel_id: { type: "string", description: "Hotel ID from travel_search_hotels results" },
        checkin_date: { type: "string", description: "Check-in date (ISO 8601)" },
        checkout_date: { type: "string", description: "Check-out date (ISO 8601)" },
        guests: { type: "integer", description: "Number of guests", default: 1 },
        payment_method: {
          type: "string",
          enum: ["credit_card", "debit_card", "usdc", "agent_wallet"],
          description: "Payment method to use",
          default: "credit_card",
        },
      },
      required: ["hotel_id", "checkin_date", "checkout_date"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "travel_search_restaurants",
    description:
      "Use when you need to find dining options at a destination. Trigger phrases: 'find restaurants', 'where to eat', 'best restaurants nearby', 'dining options for the group'. Handles cuisine type, party size, date/time, and price range filters. Returns restaurant listings with ratings, menus, availability, and reservation links.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City, neighborhood, or address to search near" },
        cuisine: { type: "string", description: "Cuisine type (e.g. 'Italian', 'sushi', 'steakhouse'). Optional." },
        party_size: { type: "integer", description: "Number of diners", default: 2 },
        date_time: { type: "string", description: "Preferred dining date and time (ISO 8601). Optional." },
        price_range: {
          type: "string",
          enum: ["$", "$$", "$$$", "$$$$"],
          description: "Price range indicator. Optional.",
        },
      },
      required: ["location"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "travel_build_itinerary",
    description:
      "Use when you need to generate a day-by-day travel itinerary for a trip. Trigger phrases: 'plan my trip', 'build an itinerary', 'create a travel schedule', 'what should we do in'. Handles budget, travel style, and personal preferences. Returns a structured day-by-day itinerary with activities, timings, estimated costs, and booking suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Travel destination (city or region)" },
        start_date: { type: "string", description: "Trip start date (ISO 8601)" },
        end_date: { type: "string", description: "Trip end date (ISO 8601)" },
        budget_usd: { type: "number", description: "Total trip budget in USD", default: 2000 },
        preferences: {
          type: "object",
          description: "Optional preferences object — e.g. { interests: ['museums','food'], pace: 'relaxed' }",
        },
      },
      required: ["destination", "start_date", "end_date"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "travel_visa_requirements",
    description:
      "Use when you need to check visa and entry requirements before travel. Trigger phrases: 'do I need a visa', 'visa requirements for', 'entry requirements', 'what documents do I need to travel to'. Handles nationality, destination, purpose of travel, and trip duration. Returns visa type required, application links, processing times, document checklists, and current travel advisories.",
    inputSchema: {
      type: "object",
      properties: {
        nationality: { type: "string", description: "Traveler's passport nationality / citizenship (e.g. 'US', 'GB', 'IN')" },
        destination: { type: "string", description: "Destination country code or name (e.g. 'FR', 'France')" },
        purpose: {
          type: "string",
          enum: ["tourism", "business", "transit", "study", "work"],
          description: "Purpose of visit",
          default: "tourism",
        },
        duration_days: { type: "integer", description: "Planned duration of stay in days", default: 14 },
      },
      required: ["nationality", "destination"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "travel_compare_car_rentals",
    description:
      "Use when you need to compare car rental options at a destination. Trigger phrases: 'rent a car', 'compare car rentals', 'cheapest car hire', 'vehicle options at'. Handles pickup/dropoff dates, car type preferences, and location. Returns side-by-side rental comparisons with daily rates, insurance options, mileage policies, and booking links.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Pickup location (city, airport code, or address)" },
        pickup_date: { type: "string", description: "Pickup date and time (ISO 8601)" },
        dropoff_date: { type: "string", description: "Drop-off date and time (ISO 8601)" },
        car_type: {
          type: "string",
          enum: ["economy", "compact", "midsize", "suv", "luxury", "minivan", "truck"],
          description: "Preferred car type",
          default: "economy",
        },
      },
      required: ["location", "pickup_date", "dropoff_date"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ═══════════════════════════════════════════════════════════
  // 2. PROCUREMENT
  // ═══════════════════════════════════════════════════════════
  {
    name: "procurement_discover_suppliers",
    description:
      "Use when you need to find and evaluate potential suppliers or vendors for a category of goods or services. Trigger phrases: 'find suppliers', 'source vendors', 'who sells', 'discover procurement options for'. Handles category, requirements, location, and certification filters. Returns a ranked supplier list with profiles, certifications, risk ratings, and contact info.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Product or service category to source (e.g. 'PCB components', 'logistics', 'SaaS software')" },
        requirements: { type: "object", description: "Specification requirements (e.g. { min_order: 1000, lead_time_days: 30 })" },
        location: { type: "string", description: "Preferred supplier geography (e.g. 'North America', 'Southeast Asia'). Optional." },
        certifications: {
          type: "array",
          items: { type: "string" },
          description: "Required certifications (e.g. ['ISO9001', 'SOC2', 'FDA'])",
          default: [],
        },
      },
      required: ["category"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "procurement_create_rfq",
    description:
      "Use when you need to create and send a Request for Quotation to multiple suppliers. Trigger phrases: 'send an RFQ', 'request quotes from vendors', 'create a bid request', 'solicit supplier quotes for'. Handles line items, specs, deadline, and invited supplier lists. Returns an RFQ document with tracking ID and submission portal link ready to broadcast.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "RFQ title or project name" },
        items: {
          type: "array",
          items: { type: "object" },
          description: "Array of line items — each with description, quantity, unit, and specifications",
        },
        requirements: { type: "object", description: "Delivery, quality, and compliance requirements" },
        deadline: { type: "string", description: "Bid submission deadline (ISO 8601)" },
        invited_suppliers: {
          type: "array",
          items: { type: "string" },
          description: "Supplier IDs or names to invite. Leave empty to broadcast publicly.",
          default: [],
        },
      },
      required: ["title", "items"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "procurement_evaluate_bids",
    description:
      "Use when you need to score and rank supplier bids objectively. Trigger phrases: 'evaluate bids', 'score vendor responses', 'rank RFQ submissions', 'compare supplier quotes'. Handles weighted criteria including price, delivery, quality, and risk. Returns a ranked bid scorecard with per-criterion scores, a recommended winner, and negotiation talking points.",
    inputSchema: {
      type: "object",
      properties: {
        rfq_id: { type: "string", description: "RFQ ID from procurement_create_rfq" },
        criteria: { type: "object", description: "Custom evaluation criteria with scoring rubrics. Optional." },
        weights: {
          type: "object",
          description: "Weighting per criterion (must sum to 1.0). Default: { price: 0.4, delivery: 0.25, quality: 0.25, risk: 0.1 }",
        },
      },
      required: ["rfq_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "procurement_draft_contract",
    description:
      "Use when you need to generate a purchase or supplier contract from RFQ terms. Trigger phrases: 'draft a supplier contract', 'create a purchase agreement', 'generate vendor contract', 'write procurement contract for'. Handles payment terms, delivery milestones, SLAs, and penalty clauses. Returns a ready-to-sign contract with all commercial terms and an e-signature link.",
    inputSchema: {
      type: "object",
      properties: {
        supplier_id: { type: "string", description: "Winning supplier ID from procurement_evaluate_bids" },
        terms: { type: "object", description: "Key commercial terms (delivery schedule, SLAs, warranties, penalties)" },
        items: {
          type: "array",
          items: { type: "object" },
          description: "Line items with agreed quantities, unit prices, and specs",
        },
        payment_terms: { type: "object", description: "Payment terms (net days, milestones, early-pay discounts)" },
      },
      required: ["supplier_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "procurement_match_invoice",
    description:
      "Use when you need to verify a supplier invoice against the purchase order and receipt. Trigger phrases: 'match invoice to PO', 'verify supplier invoice', 'check invoice against order', 'reconcile procurement invoice'. Handles line-item matching, quantity checks, and price verification. Returns a match verdict, discrepancy details, and an approval/hold recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_data: { type: "object", description: "Invoice object — include invoice_number, vendor, line_items, total_amount" },
        purchase_order_id: { type: "string", description: "Purchase order ID to match against" },
      },
      required: ["invoice_data", "purchase_order_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "procurement_spend_analytics",
    description:
      "Use when you need to analyze procurement spend patterns across categories or time periods. Trigger phrases: 'analyze spend', 'procurement analytics', 'what are we spending on', 'supplier spend report'. Handles department, date range, and category filters. Returns spend breakdown by category and supplier, savings opportunities, maverick spend flags, and benchmark comparisons.",
    inputSchema: {
      type: "object",
      properties: {
        department: { type: "string", description: "Department or cost center to analyze (e.g. 'Engineering', 'Marketing')" },
        date_range: { type: "object", description: "Date range object with start and end (ISO 8601). Default: last 12 months." },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Filter to specific spend categories. Leave empty for all.",
          default: [],
        },
      },
      required: ["department"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 3. KNOW YOUR AGENT (KYA)
  // ═══════════════════════════════════════════════════════════
  {
    name: "kya_verify_agent",
    description:
      "Use when you need to verify the identity and credentials of an AI agent before granting access or executing a transaction. Trigger phrases: 'verify this agent', 'check agent identity', 'is this agent trusted', 'authenticate agent before'. Handles identity claims, credential chain verification, and action intent review. Returns a verification verdict, trust tier, and any identity flags.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent identifier to verify" },
        claimed_identity: { type: "object", description: "Identity claims the agent is making (operator, model, version, certifications)" },
        requested_action: { type: "string", description: "The action the agent is attempting to perform. Optional." },
      },
      required: ["agent_id", "claimed_identity"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "kya_classify_bot",
    description:
      "Use when you need to determine whether a request is coming from a legitimate AI agent, a malicious bot, or a human. Trigger phrases: 'classify this request', 'is this a bot', 'detect bot traffic', 'check if agent is legitimate'. Analyzes request fingerprints and behavioral signals. Returns a classification (agent/bot/human/unknown), confidence score, and behavioral red flags.",
    inputSchema: {
      type: "object",
      properties: {
        request_fingerprint: { type: "object", description: "Request metadata — headers, timing, IP, user-agent, TLS fingerprint" },
        behavior_signals: { type: "object", description: "Recent behavioral signals — request rate, action patterns, error rates" },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "kya_check_delegation",
    description:
      "Use when you need to confirm that an agent has the authority to perform a specific action or spend a given amount on behalf of its principal. Trigger phrases: 'check delegation scope', 'does this agent have permission', 'verify agent authorization', 'can this agent spend'. Returns an authorization verdict, the agent's permission scope, and any policy violations detected.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to check" },
        requested_action: { type: "string", description: "The action being requested (e.g. 'purchase', 'sign_contract', 'transfer_funds')" },
        requested_amount: { type: "number", description: "Monetary amount involved (USD). Optional.", default: 0 },
      },
      required: ["agent_id", "requested_action"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "kya_behavior_score",
    description:
      "Use when you need a historical risk score for an AI agent based on its recent behavior patterns. Trigger phrases: 'agent behavior score', 'how trustworthy is this agent', 'agent risk rating', 'review agent history'. Analyzes transaction history, error rates, anomalies, and compliance events over a configurable timeframe. Returns a 0–100 trust score, risk tier, behavioral patterns, and improvement recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID to score" },
        timeframe: { type: "string", description: "Lookback period for behavior analysis (e.g. '7d', '30d', '90d')", default: "7d" },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "kya_enforce_spending_limit",
    description:
      "Use when you need to check or enforce a spending limit on an agent before a transaction is committed. Trigger phrases: 'enforce spend limit', 'check spending cap', 'approve or block agent spend', 'does this exceed agent budget'. Evaluates the proposed amount against the agent's configured limits and remaining budget. Returns an approval/block decision with remaining budget and escalation instructions if needed.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID attempting the spend" },
        proposed_amount: { type: "number", description: "Proposed transaction amount in USD" },
        category: { type: "string", description: "Spending category (e.g. 'travel', 'software', 'services')", default: "general" },
      },
      required: ["agent_id", "proposed_amount"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "kya_report_suspicious",
    description:
      "Use when you need to flag an AI agent for suspicious, anomalous, or policy-violating behavior. Trigger phrases: 'report suspicious agent', 'flag this agent', 'escalate agent behavior', 'this agent is acting maliciously'. Accepts evidence attachments and reason descriptions. Returns a report ID, escalation status, and recommended containment actions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent ID being reported" },
        reason: { type: "string", description: "Human-readable reason for the report (e.g. 'Attempted to exceed spending limit 5 times in 10 minutes')" },
        evidence: { type: "object", description: "Supporting evidence object — logs, transaction IDs, timestamps, screenshots" },
      },
      required: ["agent_id", "reason"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 4. SALES CRM
  // ═══════════════════════════════════════════════════════════
  {
    name: "sales_enrich_lead",
    description:
      "Use when you need to enrich a sales lead with firmographic data, contact information, and buying signals. Trigger phrases: 'enrich this lead', 'get more data on this prospect', 'find contact info for', 'research this company for sales'. Pulls data from company databases, LinkedIn, and news sources. Returns enriched company profile, decision-maker contacts, tech stack, recent funding, and intent signals.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Name of the target company" },
        contact_name: { type: "string", description: "Name of the contact at the company. Optional." },
        email: { type: "string", description: "Contact email address. Optional — used for identity verification." },
      },
      required: ["company_name"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "sales_score_lead",
    description:
      "Use when you need to prioritize sales leads by scoring them against your ideal customer profile. Trigger phrases: 'score this lead', 'prioritize leads', 'how good is this prospect', 'rank leads by fit'. Evaluates firmographic match, behavioral signals, budget indicators, and timing. Returns a 0–100 lead score, fit grade (A/B/C/D), key scoring drivers, and conversion probability.",
    inputSchema: {
      type: "object",
      properties: {
        lead_data: { type: "object", description: "Lead data object — can come directly from sales_enrich_lead output" },
        ideal_customer_profile: { type: "object", description: "Your ICP definition (industry, size, revenue, tech stack, geography, pain points)" },
      },
      required: ["lead_data", "ideal_customer_profile"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "sales_generate_outreach",
    description:
      "Use when you need to write personalized sales outreach emails or messages. Trigger phrases: 'write a cold email', 'generate outreach for', 'draft a sales message to', 'personalize this email sequence'. Handles tone, campaign type, value propositions, and persona-specific messaging. Returns a multi-touch email sequence with subject lines, preview text, and follow-up cadence.",
    inputSchema: {
      type: "object",
      properties: {
        lead_data: { type: "object", description: "Enriched lead data (from sales_enrich_lead) for personalization" },
        campaign: { type: "string", description: "Campaign name or objective (e.g. 'Q2 mid-market push', 'enterprise upsell')" },
        tone: {
          type: "string",
          enum: ["professional", "friendly", "direct", "consultative"],
          description: "Outreach tone",
          default: "professional",
        },
        value_props: {
          type: "array",
          items: { type: "string" },
          description: "Key value propositions to highlight (e.g. ['save 20% on spend', 'SOC2 certified'])",
          default: [],
        },
      },
      required: ["lead_data", "campaign"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "sales_schedule_meeting",
    description:
      "Use when you need to find a mutually available time and send a meeting invitation to a prospect. Trigger phrases: 'schedule a meeting', 'book a demo', 'find time with', 'send a calendar invite to'. Handles availability checking, timezone conversion, and personalized invite messaging. Returns confirmed meeting details, calendar link, and a pre-meeting briefing doc.",
    inputSchema: {
      type: "object",
      properties: {
        contact_email: { type: "string", description: "Prospect's email address" },
        agent_calendar: { type: "object", description: "Agent's calendar availability object (free/busy slots)" },
        preferred_times: {
          type: "array",
          items: { type: "string" },
          description: "Preferred time slots in ISO 8601. Leave empty to auto-select best options.",
          default: [],
        },
        duration_minutes: { type: "integer", description: "Meeting duration in minutes", default: 30 },
        agenda: { type: "string", description: "Meeting agenda or purpose to include in the invite" },
      },
      required: ["contact_email"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "sales_forecast_pipeline",
    description:
      "Use when you need to project sales revenue from the current deal pipeline. Trigger phrases: 'forecast pipeline', 'predict sales revenue', 'what will we close this quarter', 'pipeline forecast report'. Uses historical conversion rates, deal stages, and close date probabilities. Returns weighted pipeline value, commit vs. upside breakdown, close-date risk flags, and recommended actions per deal.",
    inputSchema: {
      type: "object",
      properties: {
        deals: {
          type: "array",
          items: { type: "object" },
          description: "Array of deal objects — each with deal_id, stage, amount, close_date, probability",
        },
        historical_data: { type: "object", description: "Historical win-rate data by stage. Optional — improves accuracy." },
      },
      required: ["deals"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "sales_track_competitors",
    description:
      "Use when you need to monitor competitor mentions across news, social, and review sites. Trigger phrases: 'track competitor mentions', 'monitor competitor activity', 'what are competitors doing', 'competitive intelligence feed'. Handles multiple competitors, source filters, and date ranges. Returns a curated feed of mentions, sentiment trends, product announcements, pricing changes, and win/loss pattern insights.",
    inputSchema: {
      type: "object",
      properties: {
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "List of competitor company names to monitor",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Sources to monitor (e.g. ['news', 'social', 'review_sites', 'job_boards'])",
          default: ["news", "social"],
        },
        date_range: { type: "object", description: "Date range with start/end (ISO 8601). Default: last 30 days." },
      },
      required: ["competitors"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ═══════════════════════════════════════════════════════════
  // 5. INVOICE / ACCOUNTS PAYABLE
  // ═══════════════════════════════════════════════════════════
  {
    name: "invoice_extract_data",
    description:
      "Use when you need to extract structured data from a raw invoice document. Trigger phrases: 'extract invoice data', 'parse this invoice', 'read invoice from PDF', 'pull line items from invoice'. Handles PDF, image, and XML formats with OCR and NLP. Returns structured JSON with vendor info, line items, quantities, prices, tax breakdown, and totals.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_url: { type: "string", description: "URL of the invoice document (PDF, image, or XML)" },
        format: {
          type: "string",
          enum: ["pdf", "image", "xml", "edi", "auto"],
          description: "Document format (use 'auto' for auto-detection)",
          default: "pdf",
        },
      },
      required: ["invoice_url"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "invoice_three_way_match",
    description:
      "Use when you need to validate an invoice by matching it against both a purchase order and a goods receipt. Trigger phrases: 'three way match', 'match invoice PO and receipt', 'validate invoice against order and delivery', 'AP three-way match check'. Compares quantities, prices, and vendor details across all three documents. Returns a match status, per-line variance report, and an approve/hold/reject recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_data: { type: "object", description: "Extracted invoice data (from invoice_extract_data or raw)" },
        purchase_order_id: { type: "string", description: "Purchase order ID from your procurement system" },
        receipt_id: { type: "string", description: "Goods receipt or delivery confirmation ID" },
      },
      required: ["invoice_data", "purchase_order_id", "receipt_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "invoice_detect_duplicate",
    description:
      "Use when you need to check if an invoice has already been submitted or paid. Trigger phrases: 'check duplicate invoice', 'has this invoice been paid before', 'detect duplicate payment', 'prevent double payment on invoice'. Fuzzy-matches vendor, amount, date, and line items against historical invoices. Returns a duplicate flag, matched invoice details, confidence score, and recommended action.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_data: { type: "object", description: "Invoice data to check (invoice number, vendor, amount, date, line items)" },
        lookback_days: { type: "integer", description: "How many days back to search for duplicates", default: 90 },
      },
      required: ["invoice_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "invoice_route_approval",
    description:
      "Use when you need to route an invoice through the correct approval workflow based on amount and category. Trigger phrases: 'route invoice for approval', 'send invoice to approver', 'trigger AP approval workflow', 'who needs to approve this invoice'. Applies approval policy rules to determine the approver chain. Returns the approval routing, approver list, estimated approval time, and escalation rules.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_data: { type: "object", description: "Invoice data including amount, vendor, category, and cost center" },
        approval_policy: { type: "object", description: "Approval policy object with threshold and approver rules. Optional — uses default policy if omitted." },
      },
      required: ["invoice_data"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "invoice_optimize_payment",
    description:
      "Use when you need to determine the optimal payment timing for a batch of invoices to maximize cash flow and capture early-payment discounts. Trigger phrases: 'optimize invoice payments', 'when should we pay these invoices', 'maximize early pay discounts', 'cash flow optimal payment schedule'. Considers due dates, discount windows, and current cash position. Returns a prioritized payment schedule with expected savings and cash flow impact.",
    inputSchema: {
      type: "object",
      properties: {
        invoices: {
          type: "array",
          items: { type: "object" },
          description: "Array of invoice objects with invoice_id, amount, due_date, and discount terms",
        },
        cash_position: { type: "number", description: "Current available cash balance in USD" },
        early_pay_discounts: {
          type: "array",
          items: { type: "object" },
          description: "Available early-payment discount offers (invoice_id, discount_pct, discount_deadline)",
          default: [],
        },
      },
      required: ["invoices", "cash_position"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "invoice_ap_dashboard",
    description:
      "Use when you need a comprehensive accounts payable status overview. Trigger phrases: 'AP dashboard', 'accounts payable summary', 'what invoices are outstanding', 'show me the AP pipeline'. Returns total outstanding payables, aging buckets, on-hold invoices, upcoming due dates, discount capture rate, and DPO (days payable outstanding) trend.",
    inputSchema: {
      type: "object",
      properties: {
        date_range: { type: "object", description: "Date range with start and end (ISO 8601). Default: current period." },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 6. FRAUD DETECTION
  // ═══════════════════════════════════════════════════════════
  {
    name: "fraud_screen_transaction",
    description:
      "Use when you need to assess the fraud risk of a transaction before authorizing it. Trigger phrases: 'screen this transaction', 'check transaction for fraud', 'is this payment safe', 'fraud risk on this order'. Evaluates transaction attributes, device signals, velocity checks, and behavioral patterns in real time. Returns a risk score (0–100), risk tier (low/medium/high), flag reasons, and an approve/review/decline recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_data: {
          type: "object",
          description: "Transaction object — include amount, currency, merchant, payment_method, timestamp, ip_address, device_id",
        },
        user_profile: { type: "object", description: "User/customer profile for behavioral context. Optional." },
      },
      required: ["transaction_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fraud_detect_anomalies",
    description:
      "Use when you need to identify unusual patterns in an account's transaction history. Trigger phrases: 'detect anomalies', 'unusual account activity', 'find suspicious patterns', 'account behavior anomaly check'. Applies statistical and ML models to spot velocity spikes, geographic outliers, and spending pattern breaks. Returns flagged transactions, anomaly types, severity levels, and recommended investigation steps.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Account or user ID to analyze" },
        transaction_history: {
          type: "array",
          items: { type: "object" },
          description: "Array of recent transaction objects. Leave empty to pull from stored history.",
          default: [],
        },
        timeframe: { type: "string", description: "Analysis window (e.g. '7d', '30d', '90d')", default: "30d" },
      },
      required: ["account_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fraud_check_identity",
    description:
      "Use when you need to verify that a person or entity is who they claim to be. Trigger phrases: 'verify identity', 'KYC check', 'identity verification', 'is this person real', 'check ID documents'. Validates government IDs, biometrics, address history, and watchlist status. Returns a verification verdict, identity confidence score, and any flags from sanctions or watchlists.",
    inputSchema: {
      type: "object",
      properties: {
        identity_data: {
          type: "object",
          description: "Identity data object — name, dob, address, id_document (type and number), phone, email",
        },
        verification_level: {
          type: "string",
          enum: ["basic", "standard", "enhanced", "kyc_full"],
          description: "Depth of identity verification to perform",
          default: "standard",
        },
      },
      required: ["identity_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "fraud_predict_chargeback",
    description:
      "Use when you need to estimate the likelihood of a transaction being disputed or charged back. Trigger phrases: 'predict chargeback risk', 'dispute probability', 'will this be charged back', 'chargeback likelihood'. Evaluates merchant history, product category, customer behavior, and dispute patterns. Returns a chargeback probability, dispute reason prediction, and recommended dispute prevention measures.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_data: { type: "object", description: "Transaction details including amount, merchant, product category, payment method" },
        merchant_profile: { type: "object", description: "Merchant historical dispute and chargeback data. Optional." },
      },
      required: ["transaction_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fraud_analyze_network",
    description:
      "Use when you need to map the connections between a suspicious entity and related accounts, merchants, or devices to uncover fraud rings. Trigger phrases: 'analyze fraud network', 'find connected fraudulent accounts', 'map entity relationships for fraud', 'ring fraud detection'. Performs graph analysis up to a configurable depth. Returns a network graph, connected entities, ring patterns, and high-risk nodes.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Central entity ID (account, device, card, or merchant) to analyze" },
        depth: { type: "integer", description: "Graph traversal depth (1–3 hops). Higher depth = broader analysis but slower.", default: 2 },
      },
      required: ["entity_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fraud_dashboard",
    description:
      "Use when you need a real-time overview of fraud activity across your platform. Trigger phrases: 'fraud dashboard', 'fraud summary report', 'show me fraud metrics', 'fraud detection overview'. Returns transaction screening volumes, fraud rates by type, blocked amount totals, top fraud patterns, false positive rates, and model performance metrics.",
    inputSchema: {
      type: "object",
      properties: {
        date_range: { type: "object", description: "Date range with start and end (ISO 8601). Default: last 30 days." },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 7. REAL ESTATE
  // ═══════════════════════════════════════════════════════════
  {
    name: "realestate_search_properties",
    description:
      "Use when you need to search for properties available for sale or rent. Trigger phrases: 'find properties', 'search homes for sale', 'list available properties', 'find commercial real estate in'. Handles residential and commercial searches with price, bedroom, bathroom, and feature filters. Returns ranked property listings with photos, details, price history, and listing agent contact info.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Target location — city, ZIP code, neighborhood, or coordinates" },
        property_type: {
          type: "string",
          enum: ["residential", "commercial", "industrial", "land", "multi-family", "condo", "townhouse"],
          description: "Type of property to search",
        },
        min_price: { type: "number", description: "Minimum price in USD" },
        max_price: { type: "number", description: "Maximum price in USD" },
        bedrooms: { type: "integer", description: "Minimum number of bedrooms (residential)" },
        bathrooms: { type: "number", description: "Minimum number of bathrooms (residential)" },
        features: {
          type: "array",
          items: { type: "string" },
          description: "Required features (e.g. ['garage', 'pool', 'waterfront', 'solar'])",
          default: [],
        },
      },
      required: ["location", "property_type"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "realestate_get_comps",
    description:
      "Use when you need comparable sales data to price or evaluate a property. Trigger phrases: 'get comps', 'find comparable sales', 'recent sales near this property', 'what have similar homes sold for'. Searches recent sales within a configurable radius and time window. Returns comparable listings with sale prices, price-per-sqft, days on market, and an adjusted value range for the subject property.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Subject property full street address" },
        radius_miles: { type: "number", description: "Search radius in miles", default: 5 },
        months_back: { type: "integer", description: "How many months of sales history to search", default: 6 },
      },
      required: ["address"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "realestate_calculate_mortgage",
    description:
      "Use when you need to calculate monthly mortgage payments and total loan costs. Trigger phrases: 'calculate mortgage', 'what would the monthly payment be', 'mortgage affordability', 'loan cost estimate for property'. Handles down payment, interest rate, loan term, taxes, and insurance. Returns monthly PITI breakdown, total interest over loan life, amortization schedule, and affordability analysis.",
    inputSchema: {
      type: "object",
      properties: {
        property_price: { type: "number", description: "Purchase price of the property in USD" },
        down_payment_pct: { type: "number", description: "Down payment as a percentage (e.g. 20 for 20%)", default: 20 },
        interest_rate: { type: "number", description: "Annual interest rate as a percentage (e.g. 6.5)" },
        term_years: { type: "integer", description: "Loan term in years", default: 30 },
        annual_tax: { type: "number", description: "Annual property tax in USD", default: 0 },
        annual_insurance: { type: "number", description: "Annual homeowners insurance in USD", default: 0 },
      },
      required: ["property_price", "interest_rate"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "realestate_check_title",
    description:
      "Use when you need to verify that a property has a clear title before purchase. Trigger phrases: 'check title', 'title search on property', 'any liens on this property', 'verify property ownership'. Searches county records for liens, encumbrances, easements, and ownership history. Returns a title status verdict, list of clouds or defects, chain of ownership, and recommended title insurance steps.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Full street address of the property" },
        county: { type: "string", description: "County where the property is located" },
      },
      required: ["address", "county"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "realestate_estimate_value",
    description:
      "Use when you need an automated valuation (AVM) for a property. Trigger phrases: 'estimate property value', 'what is this home worth', 'AVM for', 'property valuation estimate'. Uses comparable sales, property features, market trends, and location quality signals. Returns a value estimate with confidence range, key value drivers, and a suggested listing price.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Full street address of the property" },
        property_details: {
          type: "object",
          description: "Additional property details to improve accuracy (sqft, bedrooms, bathrooms, year_built, condition, recent_renovations)",
        },
      },
      required: ["address"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "realestate_neighborhood_stats",
    description:
      "Use when you need demographic, economic, and quality-of-life data for a neighborhood. Trigger phrases: 'neighborhood stats', 'what is this area like', 'school ratings nearby', 'crime rate for this neighborhood', 'neighborhood quality of life'. Returns school ratings, crime indices, walkability scores, median income, price trends, nearby amenities, and a livability summary.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Neighborhood, address, ZIP code, or coordinates" },
        radius_miles: { type: "number", description: "Radius around the location to analyze in miles", default: 1 },
      },
      required: ["location"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ═══════════════════════════════════════════════════════════
  // 8. SUPPLY CHAIN
  // ═══════════════════════════════════════════════════════════
  {
    name: "supply_forecast_demand",
    description:
      "Use when you need to predict future product demand to guide inventory and production planning. Trigger phrases: 'forecast demand', 'predict sales volumes', 'how much stock will we need', 'demand planning for'. Uses historical sales, seasonality patterns, and external factors. Returns a demand forecast by period, confidence intervals, seasonal adjustments, and recommended safety stock levels.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product identifier to forecast" },
        historical_sales: {
          type: "array",
          items: { type: "object" },
          description: "Array of historical sales records with date and quantity. Leave empty to use stored data.",
          default: [],
        },
        seasonality: {
          type: "string",
          enum: ["none", "weekly", "monthly", "quarterly", "annual"],
          description: "Seasonality pattern to model",
          default: "monthly",
        },
        external_factors: { type: "object", description: "External factors to incorporate (e.g. promotions, market events, weather)" },
      },
      required: ["product_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "supply_optimize_inventory",
    description:
      "Use when you need to calculate optimal stock levels and reorder points across your product catalog. Trigger phrases: 'optimize inventory', 'reorder point calculation', 'safety stock levels', 'inventory optimization'. Balances holding costs, stockout risk, lead times, and service levels. Returns optimal order quantities, reorder points, safety stock recommendations, and projected inventory costs.",
    inputSchema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: { type: "object" },
          description: "Array of product objects with product_id, sku, holding_cost, and stockout_cost",
        },
        current_stock: { type: "object", description: "Current stock levels by product_id { product_id: quantity }" },
        lead_times: { type: "object", description: "Supplier lead times by product_id in days { product_id: days }" },
        service_level: { type: "number", description: "Target service level (0–1, e.g. 0.95 = 95%)", default: 0.95 },
      },
      required: ["products"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "supply_track_shipment",
    description:
      "Use when you need to track the real-time location and status of a shipment anywhere in the world. Trigger phrases: 'track shipment', 'where is my package', 'shipment status', 'track this tracking number'. Supports all major global carriers and multi-modal shipments. Returns current location, transit status, estimated delivery, customs clearance status, and exception alerts.",
    inputSchema: {
      type: "object",
      properties: {
        tracking_number: { type: "string", description: "Shipment tracking number" },
        carrier: { type: "string", description: "Carrier name (e.g. 'FedEx', 'DHL', 'UPS', 'Maersk', 'auto' for auto-detect)", default: "auto" },
      },
      required: ["tracking_number"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "supply_compare_freight",
    description:
      "Use when you need to compare shipping rates and transit times across freight carriers. Trigger phrases: 'compare freight rates', 'cheapest shipping option', 'freight quote comparison', 'what carrier should I use'. Handles parcel, LTL, FTL, and ocean/air freight. Returns side-by-side rate and transit-time comparison, carbon footprint per option, and a best-value recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Shipment origin (address, city, or port)" },
        destination: { type: "string", description: "Shipment destination (address, city, or port)" },
        weight_kg: { type: "number", description: "Total shipment weight in kilograms" },
        dimensions: {
          type: "object",
          description: "Package dimensions in cm { length, width, height }. Optional.",
        },
        service_type: {
          type: "string",
          enum: ["parcel", "ltl", "ftl", "ocean", "air", "express"],
          description: "Freight service type",
        },
      },
      required: ["origin", "destination", "weight_kg"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "supply_assess_supplier_risk",
    description:
      "Use when you need to evaluate the operational, financial, and compliance risk of a supplier. Trigger phrases: 'supplier risk assessment', 'how risky is this supplier', 'evaluate vendor risk', 'supplier due diligence'. Analyzes financial stability, geopolitical exposure, capacity constraints, quality history, and compliance certifications. Returns a risk score, risk category breakdown, and mitigation recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        supplier_id: { type: "string", description: "Supplier ID or company name to assess" },
        factors: { type: "object", description: "Additional risk factors to weight (e.g. { single_source: true, geography: 'China' }). Optional." },
      },
      required: ["supplier_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "supply_dashboard",
    description:
      "Use when you need a comprehensive supply chain health overview. Trigger phrases: 'supply chain dashboard', 'operations summary', 'show me supply chain metrics', 'inventory and logistics overview'. Returns on-time delivery rates, inventory turnover, stockout incidents, supplier performance scores, freight cost trends, and demand forecast accuracy.",
    inputSchema: {
      type: "object",
      properties: {
        date_range: { type: "object", description: "Date range with start and end (ISO 8601). Default: last 30 days." },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 9. DYNAMIC PRICING
  // ═══════════════════════════════════════════════════════════
  {
    name: "pricing_monitor_competitors",
    description:
      "Use when you need to track competitor prices for your products in real time. Trigger phrases: 'monitor competitor prices', 'track competitor pricing', 'watch for price changes by competitors', 'competitive price intelligence'. Scrapes and aggregates prices across competitor websites and marketplaces. Returns current competitor prices, price history, gap analysis vs. your prices, and trend alerts.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Your product ID to find matching competitor products for" },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "Competitor domains or company names to monitor",
          default: [],
        },
        frequency: {
          type: "string",
          enum: ["realtime", "hourly", "daily", "weekly"],
          description: "Monitoring update frequency",
          default: "daily",
        },
      },
      required: ["product_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "pricing_calculate_optimal",
    description:
      "Use when you need to determine the revenue- or margin-maximizing price for a product. Trigger phrases: 'calculate optimal price', 'what should we price this at', 'maximize revenue price', 'best price for margin targets'. Uses demand elasticity, cost basis, competitor prices, and target margins. Returns the optimal price point, expected revenue impact, margin at that price, and sensitivity analysis.",
    inputSchema: {
      type: "object",
      properties: {
        product_data: { type: "object", description: "Product details — sku, name, current_price, historical_sales, category" },
        cost_basis: { type: "number", description: "Fully loaded cost per unit in USD" },
        demand_elasticity: { type: "number", description: "Price elasticity of demand (negative, e.g. -1.5). Optional.", default: -1.5 },
        competitor_prices: {
          type: "array",
          items: { type: "number" },
          description: "Competitor price points for equivalent products",
          default: [],
        },
        target_margin: { type: "number", description: "Target gross margin (0–1, e.g. 0.30 = 30%)", default: 0.3 },
      },
      required: ["product_data", "cost_basis"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "pricing_simulate_change",
    description:
      "Use when you need to model the impact of a price change before implementing it. Trigger phrases: 'simulate price change', 'what happens if we change the price to', 'price change impact model', 'forecast revenue after repricing'. Runs demand elasticity and competitive response models. Returns projected volume, revenue, and margin changes with confidence intervals and recommended go/no-go decision.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product to simulate repricing for" },
        new_price: { type: "number", description: "Proposed new price in USD" },
        market: { type: "object", description: "Market context — current volume, competitors, seasonality. Optional." },
      },
      required: ["product_id", "new_price"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "pricing_generate_promo",
    description:
      "Use when you need to design a promotional pricing strategy for a set of products. Trigger phrases: 'create promotional pricing', 'design a sale', 'generate discount strategy', 'promotional pricing for campaign'. Balances margin protection, inventory levels, and campaign objectives. Returns a promotional pricing plan with discount depths, eligible SKUs, duration, and projected lift.",
    inputSchema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: { type: "object" },
          description: "Products to promote — each with product_id, current_price, cost, and inventory level",
        },
        objective: {
          type: "string",
          enum: ["revenue", "volume", "margin", "clearance", "acquisition"],
          description: "Primary promotional objective",
          default: "revenue",
        },
        constraints: { type: "object", description: "Promotional constraints (e.g. { min_margin: 0.15, max_discount: 0.30 })" },
        duration_days: { type: "integer", description: "Promotion duration in days", default: 14 },
      },
      required: ["products"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "pricing_dashboard",
    description:
      "Use when you need a pricing intelligence overview across your product catalog. Trigger phrases: 'pricing dashboard', 'price monitoring summary', 'show me pricing metrics', 'competitive pricing overview'. Returns your pricing position vs. competitors, margin trends by category, repricing event history, and revenue impact of recent changes.",
    inputSchema: {
      type: "object",
      properties: {
        product_category: { type: "string", description: "Filter to a specific product category. Optional — omit for all categories." },
        date_range: { type: "object", description: "Date range with start and end (ISO 8601). Default: last 30 days." },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════
  // 10. HR / RECRUITING
  // ═══════════════════════════════════════════════════════════
  {
    name: "hr_screen_resume",
    description:
      "Use when you need to evaluate a resume against a job description. Trigger phrases: 'screen this resume', 'does this candidate meet requirements', 'resume evaluation for', 'assess applicant qualifications'. Scores skills match, experience level, and must-have criteria. Returns a pass/fail screening decision, skills gap analysis, match score, and a short narrative summary.",
    inputSchema: {
      type: "object",
      properties: {
        resume_text: { type: "string", description: "Full resume text or parsed resume content" },
        job_requirements: {
          type: "array",
          items: { type: "string" },
          description: "List of job requirements and qualifications (e.g. ['5+ years Python', 'AWS experience', 'team leadership'])",
        },
        must_have_skills: {
          type: "array",
          items: { type: "string" },
          description: "Non-negotiable skills that must be present",
          default: [],
        },
      },
      required: ["resume_text", "job_requirements"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_match_candidates",
    description:
      "Use when you need to rank and shortlist candidates from a pool for a specific job. Trigger phrases: 'rank candidates', 'find best candidate for', 'shortlist applicants', 'match candidates to job'. Applies weighted scoring across skills, experience, culture fit signals, and role requirements. Returns a ranked candidate shortlist with match rationale and interview priority ordering.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job requisition ID to match candidates against" },
        candidate_pool: {
          type: "array",
          items: { type: "object" },
          description: "Array of candidate objects (each with candidate_id and resume or screening results)",
        },
        weights: {
          type: "object",
          description: "Scoring weights (e.g. { skills: 0.4, experience: 0.3, culture_fit: 0.2, availability: 0.1 })",
        },
      },
      required: ["job_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_interview_questions",
    description:
      "Use when you need a structured set of interview questions tailored to a role, seniority level, and skill areas. Trigger phrases: 'generate interview questions', 'create interview guide for', 'what to ask in this interview', 'interview question bank for'. Balances behavioral, technical, and situational questions. Returns a structured interview guide with questions, expected competencies, and scoring rubrics.",
    inputSchema: {
      type: "object",
      properties: {
        role_type: { type: "string", description: "Role type or job title (e.g. 'Senior Software Engineer', 'Sales Manager', 'Data Scientist')" },
        seniority: {
          type: "string",
          enum: ["junior", "mid", "senior", "staff", "director", "vp", "c-level"],
          description: "Seniority level of the candidate",
          default: "mid",
        },
        skills: {
          type: "array",
          items: { type: "string" },
          description: "Key skills to probe in the interview (e.g. ['Python', 'system design', 'stakeholder management'])",
          default: [],
        },
        focus_areas: {
          type: "array",
          items: { type: "string" },
          description: "Interview focus areas",
          enum: ["behavioral", "technical", "situational", "leadership", "values"],
          default: ["behavioral", "technical"],
        },
      },
      required: ["role_type"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hr_check_compensation",
    description:
      "Use when you need to benchmark a compensation package against market data. Trigger phrases: 'check compensation', 'is this salary competitive', 'market rate for', 'compensation benchmarking'. Pulls current data for the role, location, experience level, and industry. Returns salary range (P25/P50/P75), total comp benchmarks, equity data, and a competitiveness assessment.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Job title to benchmark (e.g. 'Senior Product Manager')" },
        location: { type: "string", description: "Work location (city/state or remote + primary market)" },
        experience: {
          type: "string",
          enum: ["junior", "mid", "senior", "staff", "director", "vp", "c-level"],
          description: "Experience level",
          default: "mid",
        },
        industry: { type: "string", description: "Industry sector (e.g. 'fintech', 'healthcare', 'enterprise-saas')", default: "tech" },
      },
      required: ["title", "location"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hr_automate_onboarding",
    description:
      "Use when you need to set up an onboarding workflow for a new hire. Trigger phrases: 'onboard new hire', 'automate onboarding for', 'create onboarding plan', 'set up new employee onboarding'. Generates a day-by-day onboarding schedule, provisions access, and sends welcome communications. Returns a structured 30-60-90 day onboarding plan, provisioning checklist, and manager action items.",
    inputSchema: {
      type: "object",
      properties: {
        new_hire_data: {
          type: "object",
          description: "New hire details — name, email, role, start_date, manager, team, location",
        },
        department: { type: "string", description: "Department being joined (e.g. 'Engineering', 'Sales', 'Finance')", default: "Engineering" },
        start_date: { type: "string", description: "Employment start date (ISO 8601)" },
      },
      required: ["new_hire_data"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hr_recruiting_dashboard",
    description:
      "Use when you need an overview of your recruiting pipeline and hiring metrics. Trigger phrases: 'recruiting dashboard', 'hiring funnel metrics', 'show me recruiting stats', 'talent acquisition overview'. Returns open requisitions, candidate pipeline by stage, time-to-fill, offer acceptance rate, source-of-hire breakdown, and diversity metrics.",
    inputSchema: {
      type: "object",
      properties: {
        date_range: { type: "object", description: "Date range with start and end (ISO 8601). Default: current quarter." },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export function handleMoneyTool(name, args) {
  switch (name) {

    // ─── Travel ──────────────────────────────────────────────────────────────
    case "travel_search_flights":
      return travelBooking.searchFlights(
        args.origin,
        args.destination,
        args.depart_date,
        args.return_date ?? null,
        args.passengers ?? 1,
        args.cabin_class ?? "economy",
        args.flexible_dates ?? false
      );
    case "travel_book_flight":
      return travelBooking.bookFlight(args.flight_id, args.passengers ?? [], args.payment_method ?? "credit_card");
    case "travel_search_hotels":
      return travelBooking.searchHotels(
        args.location,
        args.checkin_date,
        args.checkout_date,
        args.guests ?? 1,
        args.rooms ?? 1,
        args.star_rating ?? 0,
        args.max_price_per_night ?? 99999
      );
    case "travel_book_hotel":
      return travelBooking.bookHotel(
        args.hotel_id,
        args.checkin_date,
        args.checkout_date,
        args.guests ?? 1,
        args.payment_method ?? "credit_card"
      );
    case "travel_search_restaurants":
      return travelBooking.searchRestaurants(
        args.location,
        args.cuisine ?? null,
        args.party_size ?? 2,
        args.date_time ?? null,
        args.price_range ?? null
      );
    case "travel_build_itinerary":
      return travelBooking.buildItinerary(
        args.destination,
        args.start_date,
        args.end_date,
        args.budget_usd ?? 2000,
        args.preferences ?? {}
      );
    case "travel_visa_requirements":
      return travelBooking.getVisaRequirements(
        args.nationality,
        args.destination,
        args.purpose ?? "tourism",
        args.duration_days ?? 14
      );
    case "travel_compare_car_rentals":
      return travelBooking.compareCarRentals(
        args.location,
        args.pickup_date,
        args.dropoff_date,
        args.car_type ?? "economy"
      );

    // ─── Procurement ─────────────────────────────────────────────────────────
    case "procurement_discover_suppliers":
      return procurement.discoverSuppliers(
        args.category,
        args.requirements ?? {},
        args.location ?? null,
        args.certifications ?? []
      );
    case "procurement_create_rfq":
      return procurement.createRfq(
        args.title,
        args.items ?? [],
        args.requirements ?? {},
        args.deadline,
        args.invited_suppliers ?? []
      );
    case "procurement_evaluate_bids":
      return procurement.evaluateBids(args.rfq_id, args.criteria ?? {}, args.weights ?? {});
    case "procurement_draft_contract":
      return procurement.draftContract(
        args.supplier_id,
        args.terms ?? {},
        args.items ?? [],
        args.payment_terms ?? {}
      );
    case "procurement_match_invoice":
      return procurement.matchInvoice(args.invoice_data, args.purchase_order_id);
    case "procurement_spend_analytics":
      return procurement.getSpendAnalytics(args.department, args.date_range ?? {}, args.categories ?? []);

    // ─── Know Your Agent ─────────────────────────────────────────────────────
    case "kya_verify_agent":
      return knowYourAgent.verifyAgent(args.agent_id, args.claimed_identity, args.requested_action ?? null);
    case "kya_classify_bot":
      return knowYourAgent.classifyBot(args.request_fingerprint ?? {}, args.behavior_signals ?? {});
    case "kya_check_delegation":
      return knowYourAgent.checkDelegationScope(
        args.agent_id,
        args.requested_action,
        args.requested_amount ?? 0
      );
    case "kya_behavior_score":
      return knowYourAgent.getAgentBehaviorScore(args.agent_id, args.timeframe ?? "7d");
    case "kya_enforce_spending_limit":
      return knowYourAgent.enforceSpendingLimit(
        args.agent_id,
        args.proposed_amount,
        args.category ?? "general"
      );
    case "kya_report_suspicious":
      return knowYourAgent.reportSuspiciousAgent(args.agent_id, args.reason, args.evidence ?? {});

    // ─── Sales CRM ───────────────────────────────────────────────────────────
    case "sales_enrich_lead":
      return salesCrm.enrichLead(args.company_name, args.contact_name ?? "", args.email ?? "");
    case "sales_score_lead":
      return salesCrm.scoreLead(args.lead_data, args.ideal_customer_profile);
    case "sales_generate_outreach":
      return salesCrm.generateOutreach(
        args.lead_data,
        args.campaign,
        args.tone ?? "professional",
        args.value_props ?? []
      );
    case "sales_schedule_meeting":
      return salesCrm.scheduleMeeting(
        args.contact_email,
        args.agent_calendar ?? {},
        args.preferred_times ?? [],
        args.duration_minutes ?? 30,
        args.agenda ?? ""
      );
    case "sales_forecast_pipeline":
      return salesCrm.forecastPipeline(args.deals ?? [], args.historical_data ?? {});
    case "sales_track_competitors":
      return salesCrm.trackCompetitorMentions(
        args.competitors ?? [],
        args.sources ?? ["news", "social"],
        args.date_range ?? {}
      );

    // ─── Invoice / AP ────────────────────────────────────────────────────────
    case "invoice_extract_data":
      return invoiceAp.extractInvoiceData(args.invoice_url, args.format ?? "pdf");
    case "invoice_three_way_match":
      return invoiceAp.matchThreeWay(args.invoice_data, args.purchase_order_id, args.receipt_id);
    case "invoice_detect_duplicate":
      return invoiceAp.detectDuplicateInvoice(args.invoice_data, args.lookback_days ?? 90);
    case "invoice_route_approval":
      return invoiceAp.routeForApproval(args.invoice_data, args.approval_policy ?? {});
    case "invoice_optimize_payment":
      return invoiceAp.optimizePaymentTiming(
        args.invoices ?? [],
        args.cash_position ?? 0,
        args.early_pay_discounts ?? []
      );
    case "invoice_ap_dashboard":
      return invoiceAp.getApDashboard(args.date_range ?? {});

    // ─── Fraud Detection ─────────────────────────────────────────────────────
    case "fraud_screen_transaction":
      return fraudDetection.screenTransaction(args.transaction_data, args.user_profile ?? {});
    case "fraud_detect_anomalies":
      return fraudDetection.detectAnomalies(
        args.account_id,
        args.transaction_history ?? [],
        args.timeframe ?? "30d"
      );
    case "fraud_check_identity":
      return fraudDetection.checkIdentity(args.identity_data, args.verification_level ?? "standard");
    case "fraud_predict_chargeback":
      return fraudDetection.predictChargeback(args.transaction_data, args.merchant_profile ?? {});
    case "fraud_analyze_network":
      return fraudDetection.analyzeNetwork(args.entity_id, args.depth ?? 2);
    case "fraud_dashboard":
      return fraudDetection.getFraudDashboard(args.date_range ?? {});

    // ─── Real Estate ─────────────────────────────────────────────────────────
    case "realestate_search_properties":
      return realEstate.searchProperties(
        args.location,
        args.property_type,
        args.min_price,
        args.max_price,
        args.bedrooms,
        args.bathrooms,
        args.features ?? []
      );
    case "realestate_get_comps":
      return realEstate.getComparables(args.address, args.radius_miles ?? 5, args.months_back ?? 6);
    case "realestate_calculate_mortgage":
      return realEstate.calculateMortgage(
        args.property_price,
        args.down_payment_pct ?? 20,
        args.interest_rate,
        args.term_years ?? 30,
        args.annual_tax ?? 0,
        args.annual_insurance ?? 0
      );
    case "realestate_check_title":
      return realEstate.checkTitleStatus(args.address, args.county);
    case "realestate_estimate_value":
      return realEstate.estimatePropertyValue(args.address, args.property_details ?? {});
    case "realestate_neighborhood_stats":
      return realEstate.getNeighborhoodStats(args.location, args.radius_miles ?? 1);

    // ─── Supply Chain ────────────────────────────────────────────────────────
    case "supply_forecast_demand":
      return supplyChain.forecastDemand(
        args.product_id,
        args.historical_sales ?? [],
        args.seasonality ?? "monthly",
        args.external_factors ?? {}
      );
    case "supply_optimize_inventory":
      return supplyChain.optimizeInventory(
        args.products ?? [],
        args.current_stock ?? {},
        args.lead_times ?? {},
        args.service_level ?? 0.95
      );
    case "supply_track_shipment":
      return supplyChain.trackShipmentGlobal(args.tracking_number, args.carrier ?? "auto");
    case "supply_compare_freight":
      return supplyChain.compareFreight(
        args.origin,
        args.destination,
        args.weight_kg,
        args.dimensions ?? {},
        args.service_type
      );
    case "supply_assess_supplier_risk":
      return supplyChain.assessSupplierRisk(args.supplier_id, args.factors ?? {});
    case "supply_dashboard":
      return supplyChain.getSupplyChainDashboard(args.date_range ?? {});

    // ─── Dynamic Pricing ─────────────────────────────────────────────────────
    case "pricing_monitor_competitors":
      return dynamicPricing.monitorCompetitorPrices(
        args.product_id,
        args.competitors ?? [],
        args.frequency ?? "daily"
      );
    case "pricing_calculate_optimal":
      return dynamicPricing.calculateOptimalPrice(
        args.product_data,
        args.cost_basis,
        args.demand_elasticity ?? -1.5,
        args.competitor_prices ?? [],
        args.target_margin ?? 0.3
      );
    case "pricing_simulate_change":
      return dynamicPricing.simulatePriceChange(args.product_id, args.new_price, args.market ?? {});
    case "pricing_generate_promo":
      return dynamicPricing.generatePromotionalPricing(
        args.products ?? [],
        args.objective ?? "revenue",
        args.constraints ?? {},
        args.duration_days ?? 14
      );
    case "pricing_dashboard":
      return dynamicPricing.getPricingDashboard(args.product_category, args.date_range ?? {});

    // ─── HR / Recruiting ─────────────────────────────────────────────────────
    case "hr_screen_resume":
      return hrRecruiting.screenResume(
        args.resume_text,
        args.job_requirements ?? [],
        args.must_have_skills ?? []
      );
    case "hr_match_candidates":
      return hrRecruiting.matchCandidates(
        args.job_id,
        args.candidate_pool ?? [],
        args.weights ?? {}
      );
    case "hr_interview_questions":
      return hrRecruiting.generateInterviewQuestions(
        args.role_type,
        args.seniority ?? "mid",
        args.skills ?? [],
        args.focus_areas ?? ["behavioral", "technical"]
      );
    case "hr_check_compensation":
      return hrRecruiting.checkCompensation(
        args.title,
        args.location,
        args.experience ?? "mid",
        args.industry ?? "tech"
      );
    case "hr_automate_onboarding":
      return hrRecruiting.automateOnboarding(
        args.new_hire_data ?? {},
        args.department ?? "Engineering",
        args.start_date
      );
    case "hr_recruiting_dashboard":
      return hrRecruiting.getRecruitingDashboard(args.date_range ?? {});

    default:
      throw new Error(`Unknown money tool: ${name}`);
  }
}
