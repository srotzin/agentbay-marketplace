/**
 * HiveAgent MCP Tool Definitions — Phase 13
 *
 * Eight new verticals wired into MCP — 47 tools total:
 *
 *   content-social (6 tools):
 *     content_generate              — AI-driven content creation for any channel
 *     content_schedule_post         — schedule posts across social platforms
 *     content_analyze_engagement    — engagement analytics and audience insights
 *     content_optimize              — optimize posting time, format, and copy
 *     content_repurpose             — repurpose content across formats/channels
 *     content_dashboard             — full content pipeline overview
 *
 *   property-management (6 tools):
 *     property_screen_tenant        — tenant background & credit screening
 *     property_create_lease         — generate and e-sign lease agreements
 *     property_track_maintenance    — track and dispatch maintenance requests
 *     property_optimize_rent        — AI rent pricing based on market data
 *     property_rent_collection      — automated rent collection and reminders
 *     property_dashboard            — full property portfolio overview
 *
 *   intellectual-property (6 tools):
 *     ip_search_patents             — search global patent databases
 *     ip_analyze_prior_art          — prior art analysis for patentability
 *     ip_monitor_trademark          — monitor trademark filings and conflicts
 *     ip_draft_claims               — draft patent claims with AI assistance
 *     ip_portfolio                  — view and manage full IP portfolio
 *     ip_freedom_to_operate         — freedom-to-operate clearance analysis
 *
 *   customer-support (6 tools):
 *     support_triage_ticket         — classify and prioritize support tickets
 *     support_generate_response     — AI-generated support responses
 *     support_search_kb             — search knowledge base for answers
 *     support_escalate              — escalate tickets to human agents
 *     support_customer_history      — full customer interaction history
 *     support_dashboard             — support queue and performance dashboard
 *
 *   kyc-aml (6 tools):
 *     kyc_verify_identity           — identity verification (KYC)
 *     kyc_screen_aml                — AML sanctions and watchlist screening
 *     kyc_assess_risk               — customer risk scoring and profiling
 *     kyc_monitor_transactions      — ongoing transaction monitoring
 *     kyc_generate_sar              — generate Suspicious Activity Reports
 *     kyc_compliance_dashboard      — KYC/AML compliance dashboard
 *
 *   document-generation (6 tools):
 *     docgen_proposal               — generate business proposals
 *     docgen_rfp_response           — respond to RFPs with tailored content
 *     docgen_report                 — generate structured reports
 *     docgen_presentation           — create presentation decks
 *     docgen_merge_templates        — merge data into document templates
 *     docgen_dashboard              — document generation activity dashboard
 *
 *   erp-bridge (5 tools):
 *     erp_query                     — query ERP systems for records
 *     erp_create_record             — create records in ERP systems
 *     erp_sync_data                 — sync data between ERP and external systems
 *     erp_dashboard                 — ERP integration health dashboard
 *     erp_map_fields                — map fields between ERP schemas
 *
 *   veterinary (6 tools):
 *     vet_triage_symptoms           — triage pet symptoms and recommend care
 *     vet_schedule_appointment      — schedule veterinary appointments
 *     vet_health_record             — retrieve pet health and vaccination records
 *     vet_calculate_medication      — calculate pet medication dosages
 *     vet_estimate_cost             — estimate veterinary procedure costs
 *     vet_dashboard                 — pet care management dashboard
 *
 * Exports:
 *   phase13Tools                    — Array of 47 MCP tool definitions
 *   handlePhase13Tool(name, args)   — Dispatcher function
 */

import {
  generateContent,
  scheduleSocialPost,
  analyzeEngagement,
  optimizePosting,
  repurposeContent,
  getContentDashboard,
} from "./services/content-social.js";

import {
  screenTenant,
  createLease,
  trackMaintenance,
  optimizeRent,
  manageRentCollection,
  getPropertyDashboard,
} from "./services/property-management.js";

import {
  searchPatents,
  analyzePriorArt,
  monitorTrademark,
  draftPatentClaims,
  getIpPortfolio,
  checkFreedomToOperate,
} from "./services/intellectual-property.js";

import {
  triageTicket,
  generateResponse,
  searchKnowledgeBase,
  escalateTicket,
  getCustomerHistory,
  getSupportDashboard,
} from "./services/customer-support.js";

import {
  verifyIdentity,
  screenAml,
  assessRisk,
  monitorTransactions,
  generateSar,
  getComplianceDashboard,
} from "./services/kyc-aml.js";

import {
  generateProposal,
  respondToRfp,
  generateReport,
  createPresentation,
  mergeTemplates,
  getDocumentDashboard,
} from "./services/document-generation.js";

import {
  queryErp,
  createRecord,
  syncData,
  getErpDashboard,
  mapFields,
} from "./services/erp-bridge.js";

import {
  triagePetSymptoms,
  schedulePetAppointment,
  getPetHealthRecord,
  calculateMedication,
  estimateVetCost,
  getPetCareDashboard,
} from "./services/veterinary.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase13Tools = [

  // ── Content & Social ────────────────────────────────────────────────────────

  {
    name: "content_generate",
    description: "Use when you need to create written or visual content for any channel — blog posts, social captions, email copy, ad creative, video scripts, or newsletters. Accepts a topic, audience, tone, and target platform; returns draft content, headline variants, hashtag suggestions, and a readability score.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Subject or brief for the content (e.g. 'launch announcement for our new API product')",
        },
        content_type: {
          type: "string",
          description: "Format of content to generate",
          enum: ["blog_post", "social_caption", "email", "ad_copy", "video_script", "newsletter", "thread", "press_release"],
        },
        platform: {
          type: "string",
          description: "Target platform or channel",
          enum: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube", "email", "website", "generic"],
        },
        tone: {
          type: "string",
          description: "Desired tone of voice",
          enum: ["professional", "casual", "humorous", "authoritative", "empathetic", "inspirational"],
        },
        audience: {
          type: "string",
          description: "Target audience description (e.g. 'B2B SaaS founders aged 30-45')",
        },
        word_count: {
          type: "integer",
          description: "Approximate desired word count (optional)",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "SEO or emphasis keywords to include (optional)",
        },
      },
      required: ["topic", "content_type", "platform"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "content_schedule_post",
    description: "Use when you need to schedule a social media post for publishing at a specific time or let the system pick the optimal time automatically. Supports LinkedIn, Twitter/X, Instagram, Facebook, TikTok, and more. Returns post_id, scheduled_time, and a preview URL.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Post text or caption to publish",
        },
        platform: {
          type: "string",
          description: "Social platform to post to",
          enum: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube"],
        },
        scheduled_time: {
          type: "string",
          description: "ISO 8601 datetime for publishing (e.g. 2026-05-10T14:00:00Z). Omit to auto-schedule at optimal time.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of image or video URLs to attach",
        },
        account_id: {
          type: "string",
          description: "Social account identifier to post from",
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Hashtags to append (without #)",
        },
      },
      required: ["content", "platform"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "content_analyze_engagement",
    description: "Use when you need to measure how content is performing — likes, shares, comments, reach, impressions, click-through rate, and follower growth. Filter by platform, date range, or content type. Returns engagement breakdown, top-performing posts, and audience demographics.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "Social account or brand identifier to analyze",
        },
        platform: {
          type: "string",
          description: "Platform to analyze (omit for all platforms)",
          enum: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube", "all"],
        },
        date_from: {
          type: "string",
          description: "Start date for analysis window (ISO 8601, e.g. 2026-04-01)",
        },
        date_to: {
          type: "string",
          description: "End date for analysis window (ISO 8601)",
        },
        metric: {
          type: "string",
          description: "Primary metric to surface in results",
          enum: ["engagement_rate", "reach", "impressions", "clicks", "follower_growth", "all"],
        },
      },
      required: ["account_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "content_optimize",
    description: "Use when you want to improve content before publishing — optimize posting time, refine copy for a platform's algorithm, adjust tone for better engagement, or get A/B variants. Returns an optimized version of the content with a predicted engagement lift.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Original content draft to optimize",
        },
        platform: {
          type: "string",
          description: "Target platform for optimization",
          enum: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube", "email"],
        },
        optimization_goal: {
          type: "string",
          description: "What you want to improve",
          enum: ["engagement", "reach", "clicks", "conversions", "follower_growth"],
        },
        account_id: {
          type: "string",
          description: "Account identifier for personalized recommendations based on past performance (optional)",
        },
        generate_variants: {
          type: "integer",
          description: "Number of alternative variants to generate for A/B testing (1–5, optional)",
        },
      },
      required: ["content", "platform", "optimization_goal"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "content_repurpose",
    description: "Use when you want to transform existing content into different formats or channels — turn a blog post into a Twitter thread, a podcast transcript into LinkedIn carousels, a video script into an email newsletter. Returns adapted content tailored to each target format.",
    inputSchema: {
      type: "object",
      properties: {
        source_content: {
          type: "string",
          description: "The original content to repurpose",
        },
        source_format: {
          type: "string",
          description: "Original format of the content",
          enum: ["blog_post", "video_script", "podcast_transcript", "email", "press_release", "whitepaper", "social_post"],
        },
        target_formats: {
          type: "array",
          items: {
            type: "string",
            enum: ["twitter_thread", "linkedin_post", "instagram_caption", "email_newsletter", "short_video_script", "blog_post", "infographic_bullets", "ad_copy"],
          },
          description: "One or more formats to repurpose into",
        },
        preserve_tone: {
          type: "boolean",
          description: "Whether to preserve the original tone (true) or adapt for each platform (false). Default: false.",
        },
      },
      required: ["source_content", "source_format", "target_formats"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "content_dashboard",
    description: "Use when you need a single-view overview of your entire content operation — scheduled posts, recent engagement stats, top-performing content, upcoming publishing queue, and AI-recommended actions for growth. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "Brand or account identifier",
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Platforms to include (omit for all)",
        },
      },
      required: ["account_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Property Management ──────────────────────────────────────────────────────

  {
    name: "property_screen_tenant",
    description: "Use when you need to screen a prospective tenant before approving a rental application — runs credit check, criminal background check, eviction history, income verification, and rental references. Returns a risk score, recommendation (approve/decline/conditional), and a detailed screening report.",
    inputSchema: {
      type: "object",
      properties: {
        applicant_name: {
          type: "string",
          description: "Full legal name of the applicant",
        },
        applicant_email: {
          type: "string",
          description: "Applicant email address",
        },
        ssn_last4: {
          type: "string",
          description: "Last 4 digits of Social Security Number for identity verification",
        },
        date_of_birth: {
          type: "string",
          description: "Date of birth (ISO 8601, e.g. 1990-03-15)",
        },
        monthly_income: {
          type: "number",
          description: "Applicant's stated monthly gross income in USD",
        },
        property_id: {
          type: "string",
          description: "Property identifier the applicant is applying for",
        },
        checks: {
          type: "array",
          items: {
            type: "string",
            enum: ["credit", "criminal", "eviction", "income", "references"],
          },
          description: "Specific checks to run (default: all)",
        },
      },
      required: ["applicant_name", "applicant_email", "property_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "property_create_lease",
    description: "Use when you need to generate a legally compliant lease agreement and send it for e-signature — includes rental terms, clauses, addenda, and state-specific disclosures. Returns a lease_id, signing_link, and PDF copy.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "Property identifier",
        },
        tenant_name: {
          type: "string",
          description: "Full legal name of the tenant",
        },
        tenant_email: {
          type: "string",
          description: "Tenant email for e-signature invitation",
        },
        monthly_rent: {
          type: "number",
          description: "Monthly rent amount in USD",
        },
        lease_start: {
          type: "string",
          description: "Lease start date (ISO 8601)",
        },
        lease_end: {
          type: "string",
          description: "Lease end date (ISO 8601). Omit for month-to-month.",
        },
        security_deposit: {
          type: "number",
          description: "Security deposit amount in USD",
        },
        state: {
          type: "string",
          description: "US state for jurisdiction-specific clauses (2-letter code, e.g. CA)",
        },
        addenda: {
          type: "array",
          items: {
            type: "string",
            enum: ["pet_policy", "parking", "utilities", "smoking_policy", "lead_paint", "mold_disclosure", "move_in_checklist"],
          },
          description: "Optional addenda to include",
        },
      },
      required: ["property_id", "tenant_name", "tenant_email", "monthly_rent", "lease_start", "state"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "property_track_maintenance",
    description: "Use when you need to log, track, or dispatch a property maintenance request — covers plumbing, electrical, HVAC, appliances, and general repairs. Returns a ticket_id, assigned vendor, estimated completion, and status updates.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "Property where maintenance is needed",
        },
        unit: {
          type: "string",
          description: "Unit number or area (e.g. '3B', 'common area', 'roof')",
        },
        category: {
          type: "string",
          description: "Type of maintenance issue",
          enum: ["plumbing", "electrical", "hvac", "appliance", "structural", "pest_control", "landscaping", "general"],
        },
        description: {
          type: "string",
          description: "Detailed description of the issue",
        },
        priority: {
          type: "string",
          description: "Urgency level",
          enum: ["emergency", "high", "medium", "low"],
        },
        reported_by: {
          type: "string",
          description: "Name or tenant_id of who reported the issue",
        },
        photos: {
          type: "array",
          items: { type: "string" },
          description: "Optional URLs of photos showing the issue",
        },
      },
      required: ["property_id", "category", "description", "priority"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "property_optimize_rent",
    description: "Use when you need to set or adjust rent prices based on real-time market data — compares comparable listings, vacancy rates, seasonal trends, and demand signals for your area. Returns recommended_rent, confidence_score, comparable_properties, and pricing rationale.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "Property identifier to optimize rent for",
        },
        address: {
          type: "string",
          description: "Property street address for market comparison",
        },
        unit_type: {
          type: "string",
          description: "Unit type",
          enum: ["studio", "1br", "2br", "3br", "4br", "house", "commercial"],
        },
        square_feet: {
          type: "number",
          description: "Unit square footage",
        },
        current_rent: {
          type: "number",
          description: "Current monthly rent in USD (for comparison)",
        },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "Key amenities (e.g. ['parking', 'washer_dryer', 'pet_friendly', 'gym'])",
        },
      },
      required: ["property_id", "address", "unit_type"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "property_rent_collection",
    description: "Use when you need to automate rent collection, send payment reminders, process incoming payments, or track overdue balances. Supports ACH, card, and wire transfers. Returns collection_status, payment_history, overdue_tenants, and total_collected.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "Property identifier",
        },
        action: {
          type: "string",
          description: "Rent collection action to perform",
          enum: ["send_reminders", "process_payments", "check_overdue", "get_history", "setup_autopay"],
        },
        tenant_id: {
          type: "string",
          description: "Specific tenant to target (omit for all tenants in property)",
        },
        month: {
          type: "string",
          description: "Billing month in YYYY-MM format (defaults to current month)",
        },
      },
      required: ["property_id", "action"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "property_dashboard",
    description: "Use when you need a complete overview of your property portfolio — occupancy rates, rent collection status, open maintenance tickets, upcoming lease expirations, and revenue analytics across all properties. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id: {
          type: "string",
          description: "Property owner or manager identifier",
        },
        property_ids: {
          type: "array",
          items: { type: "string" },
          description: "Specific property IDs to include (omit for all properties)",
        },
      },
      required: ["owner_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Intellectual Property ────────────────────────────────────────────────────

  {
    name: "ip_search_patents",
    description: "Use when you need to search global patent databases — USPTO, EPO, WIPO, JPO, and more — to find existing patents by keyword, inventor, assignee, classification code, or filing date. Returns matching patents with titles, abstracts, claim summaries, and status.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query — keywords, inventor name, or technology description",
        },
        databases: {
          type: "array",
          items: {
            type: "string",
            enum: ["uspto", "epo", "wipo", "jpo", "cnipa", "all"],
          },
          description: "Patent databases to search (default: all major databases)",
        },
        date_from: {
          type: "string",
          description: "Earliest filing date to include (ISO 8601)",
        },
        date_to: {
          type: "string",
          description: "Latest filing date to include (ISO 8601)",
        },
        assignee: {
          type: "string",
          description: "Filter by patent assignee / company name (optional)",
        },
        classification: {
          type: "string",
          description: "CPC or IPC classification code to filter by (optional, e.g. G06F17/00)",
        },
        limit: {
          type: "integer",
          description: "Maximum results to return (default: 20)",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "ip_analyze_prior_art",
    description: "Use when you need to assess whether an invention is patentable by searching for prior art — existing patents, publications, and public disclosures that could block a new patent application. Returns patentability_assessment, blocking_references, novelty_gaps, and recommended claim strategy.",
    inputSchema: {
      type: "object",
      properties: {
        invention_description: {
          type: "string",
          description: "Detailed description of the invention to assess",
        },
        technology_area: {
          type: "string",
          description: "Technology domain (e.g. 'machine learning', 'biotech', 'semiconductors')",
        },
        key_claims: {
          type: "array",
          items: { type: "string" },
          description: "Key inventive concepts or proposed patent claims to analyze",
        },
        search_depth: {
          type: "string",
          description: "How thorough the prior art search should be",
          enum: ["quick", "standard", "comprehensive"],
        },
      },
      required: ["invention_description", "technology_area"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "ip_monitor_trademark",
    description: "Use when you need to watch for new trademark filings that could conflict with your brand — monitors USPTO, EUIPO, WIPO, and other registries for confusingly similar marks. Returns new_filings, conflict_score, recommended_actions, and alert history.",
    inputSchema: {
      type: "object",
      properties: {
        mark_name: {
          type: "string",
          description: "Trademark or brand name to monitor",
        },
        goods_services_class: {
          type: "array",
          items: { type: "integer" },
          description: "Nice Classification class numbers to monitor (e.g. [9, 42] for software)",
        },
        jurisdictions: {
          type: "array",
          items: {
            type: "string",
            enum: ["USPTO", "EUIPO", "WIPO", "UKIPO", "CNIPA", "all"],
          },
          description: "Trademark registries to monitor (default: all)",
        },
        alert_threshold: {
          type: "string",
          description: "Minimum similarity level to trigger an alert",
          enum: ["high_risk_only", "medium_and_above", "all_similar"],
        },
        owner_id: {
          type: "string",
          description: "Brand owner identifier for subscription management",
        },
      },
      required: ["mark_name", "owner_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "ip_draft_claims",
    description: "Use when you need AI-assisted patent claim drafting — generates independent and dependent claims, drawings descriptions, and an abstract from an invention disclosure. Returns draft_claims, claim_tree, abstract, and filing_recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        invention_disclosure: {
          type: "string",
          description: "Full description of the invention — how it works, what problem it solves, and what makes it novel",
        },
        technology_area: {
          type: "string",
          description: "Technology domain for appropriate claim language (e.g. 'software', 'mechanical', 'biotech', 'chemical')",
        },
        claim_style: {
          type: "string",
          description: "Preferred claim breadth strategy",
          enum: ["broad", "narrow", "mixed"],
        },
        num_independent_claims: {
          type: "integer",
          description: "Number of independent claims to draft (1–5, default: 3)",
        },
        prior_art_references: {
          type: "array",
          items: { type: "string" },
          description: "Known prior art patent numbers to differentiate from",
        },
      },
      required: ["invention_disclosure", "technology_area"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "ip_portfolio",
    description: "Use when you need to view and manage your IP portfolio — all patents (pending, granted, expired), trademarks, copyrights, and trade secrets. Shows maintenance fee deadlines, annuity payments due, prosecution status, and licensing activity. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id: {
          type: "string",
          description: "IP portfolio owner identifier",
        },
        ip_type: {
          type: "string",
          description: "Filter by IP type (default: all)",
          enum: ["patents", "trademarks", "copyrights", "trade_secrets", "all"],
        },
        status_filter: {
          type: "string",
          description: "Filter by IP status",
          enum: ["pending", "granted", "registered", "expired", "abandoned", "all"],
        },
      },
      required: ["owner_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "ip_freedom_to_operate",
    description: "Use when you need to check whether a product, feature, or technology can be commercialized without infringing third-party patents — an FTO (Freedom to Operate) analysis. Returns risk_level, blocking_patents, claim_charts, and recommended_design_arounds.",
    inputSchema: {
      type: "object",
      properties: {
        product_description: {
          type: "string",
          description: "Detailed description of the product or technology to clear",
        },
        markets: {
          type: "array",
          items: {
            type: "string",
            enum: ["US", "EU", "UK", "JP", "CN", "CA", "AU", "global"],
          },
          description: "Target markets to check for infringement risk",
        },
        technology_keywords: {
          type: "array",
          items: { type: "string" },
          description: "Key technical terms to focus the patent search",
        },
        competitor_assignees: {
          type: "array",
          items: { type: "string" },
          description: "Competitor companies whose patent portfolios should be prioritized",
        },
        analysis_depth: {
          type: "string",
          description: "Depth of FTO analysis",
          enum: ["preliminary", "standard", "comprehensive"],
        },
      },
      required: ["product_description", "markets"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ── Customer Support ─────────────────────────────────────────────────────────

  {
    name: "support_triage_ticket",
    description: "Use when you need to automatically classify and prioritize incoming support tickets — detects intent, urgency, sentiment, product area, and suggests routing. Returns category, priority, sentiment_score, routing_suggestion, and estimated_resolution_time.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_content: {
          type: "string",
          description: "Full text of the support ticket or message",
        },
        channel: {
          type: "string",
          description: "Channel the ticket came from",
          enum: ["email", "chat", "phone_transcript", "social", "in_app", "api"],
        },
        customer_id: {
          type: "string",
          description: "Customer identifier for personalized triage based on account history",
        },
        product: {
          type: "string",
          description: "Product or service the ticket relates to (optional)",
        },
      },
      required: ["ticket_content"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "support_generate_response",
    description: "Use when you need to draft a reply to a support ticket — generates a personalized, on-brand response that addresses the customer's issue, references their account context, and suggests resolution steps. Returns response_draft, confidence_score, and source_articles.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "string",
          description: "Support ticket identifier",
        },
        ticket_content: {
          type: "string",
          description: "Customer's message or ticket text",
        },
        customer_id: {
          type: "string",
          description: "Customer identifier for context-aware response",
        },
        tone: {
          type: "string",
          description: "Response tone",
          enum: ["empathetic", "professional", "concise", "friendly"],
        },
        include_kb_links: {
          type: "boolean",
          description: "Whether to include links to relevant knowledge base articles (default: true)",
        },
        agent_name: {
          type: "string",
          description: "Name to sign the response with",
        },
      },
      required: ["ticket_content"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "support_search_kb",
    description: "Use when you need to find answers in your knowledge base — searches articles, FAQs, troubleshooting guides, and documentation by natural language query. Returns matching articles ranked by relevance with excerpts and confidence scores.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language question or search query",
        },
        product: {
          type: "string",
          description: "Filter results to a specific product or area (optional)",
        },
        category: {
          type: "string",
          description: "Article category to search within (optional)",
          enum: ["troubleshooting", "how_to", "billing", "account", "api", "policy", "all"],
        },
        limit: {
          type: "integer",
          description: "Maximum articles to return (default: 5)",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "support_escalate",
    description: "Use when you need to escalate a support ticket to a human agent or specialist team — attaches conversation history, customer context, previous resolution attempts, and urgency flags. Returns escalation_id, assigned_team, and estimated_response_time.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "string",
          description: "Ticket identifier to escalate",
        },
        reason: {
          type: "string",
          description: "Why this ticket needs human attention",
          enum: ["complex_technical", "billing_dispute", "legal_threat", "vip_customer", "repeated_contact", "safety_concern", "agent_request"],
        },
        priority: {
          type: "string",
          description: "Escalation urgency",
          enum: ["critical", "high", "normal"],
        },
        target_team: {
          type: "string",
          description: "Specific team or specialist to route to (optional; defaults to auto-routing)",
          enum: ["tier2_tech", "billing", "trust_safety", "legal", "vip_support", "engineering", "auto"],
        },
        notes: {
          type: "string",
          description: "Additional context or instructions for the receiving agent",
        },
      },
      required: ["ticket_id", "reason", "priority"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "support_customer_history",
    description: "Use when you need to review a customer's full interaction history before or during a support session — past tickets, resolutions, purchases, account changes, and sentiment trend. Returns timeline, open_issues, lifetime_value, and churn_risk_score.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Customer identifier",
        },
        include: {
          type: "array",
          items: {
            type: "string",
            enum: ["tickets", "purchases", "account_changes", "communications", "sentiment", "all"],
          },
          description: "Data types to include in the history (default: all)",
        },
        limit: {
          type: "integer",
          description: "Maximum number of historical items to return (default: 50)",
        },
      },
      required: ["customer_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "support_dashboard",
    description: "Use when you need a real-time view of your support operations — open ticket volume, average response and resolution times, CSAT scores, escalation rates, agent workloads, and trend analysis. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Support team identifier",
        },
        date_from: {
          type: "string",
          description: "Start of reporting period (ISO 8601)",
        },
        date_to: {
          type: "string",
          description: "End of reporting period (ISO 8601)",
        },
        breakdown_by: {
          type: "string",
          description: "How to segment the data",
          enum: ["agent", "product", "channel", "category", "none"],
        },
      },
      required: ["team_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── KYC / AML ────────────────────────────────────────────────────────────────

  {
    name: "kyc_verify_identity",
    description: "Use when you need to verify a customer's identity as part of Know Your Customer (KYC) onboarding — validates government ID documents, runs liveness checks, confirms name/DOB/address against authoritative data sources. Returns verification_status, confidence_score, and document_authenticity.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Your internal customer identifier",
        },
        full_name: {
          type: "string",
          description: "Customer's full legal name",
        },
        date_of_birth: {
          type: "string",
          description: "Date of birth (ISO 8601)",
        },
        nationality: {
          type: "string",
          description: "ISO 3166-1 alpha-2 country code (e.g. US, GB, DE)",
        },
        document_type: {
          type: "string",
          description: "Type of identity document",
          enum: ["passport", "national_id", "drivers_license", "residence_permit"],
        },
        document_number: {
          type: "string",
          description: "Document number",
        },
        document_image_url: {
          type: "string",
          description: "URL of the uploaded document image for authenticity check",
        },
        selfie_url: {
          type: "string",
          description: "URL of a selfie for liveness check (optional but recommended)",
        },
        address: {
          type: "string",
          description: "Customer's residential address for address verification",
        },
      },
      required: ["customer_id", "full_name", "date_of_birth", "nationality", "document_type", "document_number"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "kyc_screen_aml",
    description: "Use when you need to screen a person or entity against AML watchlists, sanctions lists, and PEP (Politically Exposed Person) databases — checks OFAC SDN, EU sanctions, UN sanctions, Interpol, and 1,000+ global lists. Returns match_status, matched_lists, risk_indicators, and recommended_action.",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: {
          type: "string",
          description: "Full name of the individual or organization to screen",
        },
        entity_type: {
          type: "string",
          description: "Type of entity being screened",
          enum: ["individual", "organization"],
        },
        date_of_birth: {
          type: "string",
          description: "Date of birth for individual screening (ISO 8601, optional but reduces false positives)",
        },
        nationality: {
          type: "string",
          description: "ISO country code (optional)",
        },
        customer_id: {
          type: "string",
          description: "Your internal customer identifier for record-keeping",
        },
        lists: {
          type: "array",
          items: {
            type: "string",
            enum: ["ofac_sdn", "eu_sanctions", "un_sanctions", "interpol", "pep", "adverse_media", "all"],
          },
          description: "Specific lists to screen against (default: all)",
        },
      },
      required: ["entity_name", "entity_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "kyc_assess_risk",
    description: "Use when you need to calculate a customer risk score for AML/KYC compliance — combines identity strength, geographic risk, PEP/sanctions status, transaction patterns, and business type into a composite risk rating. Returns risk_tier (low/medium/high), risk_score, contributing_factors, and due_diligence_requirements.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Customer identifier to assess risk for",
        },
        customer_type: {
          type: "string",
          description: "Type of customer",
          enum: ["individual", "sole_trader", "sme", "corporation", "financial_institution", "ngo"],
        },
        jurisdiction: {
          type: "string",
          description: "Customer's primary jurisdiction (ISO country code)",
        },
        industry: {
          type: "string",
          description: "Industry or business type (optional, improves accuracy)",
        },
        expected_transaction_volume: {
          type: "number",
          description: "Expected monthly transaction volume in USD (optional)",
        },
        include_factors: {
          type: "array",
          items: {
            type: "string",
            enum: ["geographic", "product_service", "delivery_channel", "transaction_pattern", "customer_profile", "all"],
          },
          description: "Risk factors to include in the assessment (default: all)",
        },
      },
      required: ["customer_id", "customer_type", "jurisdiction"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "kyc_monitor_transactions",
    description: "Use when you need to continuously monitor transactions for suspicious activity — detects structuring, layering, smurfing, rapid movement, high-risk counterparties, and unusual patterns. Returns alert_list, flagged_transactions, and trigger_rules_matched.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Customer identifier to monitor",
        },
        transaction_data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tx_id: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              counterparty: { type: "string" },
              timestamp: { type: "string" },
              direction: { type: "string", enum: ["inbound", "outbound"] },
            },
          },
          description: "Array of transaction records to analyze (omit to pull from transaction history)",
        },
        monitoring_period: {
          type: "string",
          description: "Time window for pattern analysis",
          enum: ["24h", "7d", "30d", "90d"],
        },
        alert_threshold: {
          type: "string",
          description: "Sensitivity of alert triggers",
          enum: ["conservative", "standard", "aggressive"],
        },
      },
      required: ["customer_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "kyc_generate_sar",
    description: "Use when you need to file a Suspicious Activity Report (SAR) with the relevant financial intelligence unit — auto-populates FinCEN, UKFIU, or FATF-compliant SAR templates from transaction and customer data. Returns sar_draft, filing_reference, and submission_checklist.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Customer the SAR is being filed about",
        },
        suspicious_activity_description: {
          type: "string",
          description: "Narrative description of the suspicious activity",
        },
        transaction_ids: {
          type: "array",
          items: { type: "string" },
          description: "Transaction IDs involved in the suspicious activity",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to file with",
          enum: ["US_FinCEN", "UK_UKFIU", "EU", "AU_AUSTRAC", "SG_STR", "other"],
        },
        total_suspicious_amount: {
          type: "number",
          description: "Total dollar value of suspicious transactions",
        },
        activity_type: {
          type: "string",
          description: "Category of suspicious activity",
          enum: ["structuring", "money_laundering", "fraud", "terrorist_financing", "sanctions_evasion", "other"],
        },
      },
      required: ["customer_id", "suspicious_activity_description", "jurisdiction", "activity_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "kyc_compliance_dashboard",
    description: "Use when you need a full view of your KYC/AML compliance posture — pending verifications, high-risk customers, open alerts, SAR filings, overdue reviews, and regulatory deadlines. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        institution_id: {
          type: "string",
          description: "Financial institution or compliance team identifier",
        },
        risk_tier_filter: {
          type: "string",
          description: "Filter customers by risk tier",
          enum: ["high", "medium", "low", "all"],
        },
      },
      required: ["institution_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Document Generation ──────────────────────────────────────────────────────

  {
    name: "docgen_proposal",
    description: "Use when you need to generate a professional business proposal — covers executive summary, scope of work, pricing, timeline, team bios, case studies, and terms. Accepts a brief and returns a fully structured proposal in your chosen format.",
    inputSchema: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Prospective client's name or company",
        },
        project_description: {
          type: "string",
          description: "Brief description of the project or engagement",
        },
        services: {
          type: "array",
          items: { type: "string" },
          description: "List of services or deliverables to include in the proposal",
        },
        total_value: {
          type: "number",
          description: "Total proposed contract value in USD",
        },
        timeline_weeks: {
          type: "integer",
          description: "Project timeline in weeks",
        },
        company_profile: {
          type: "string",
          description: "Your company name and brief description (for proposal cover and footer)",
        },
        output_format: {
          type: "string",
          description: "Output format for the proposal",
          enum: ["pdf", "docx", "html", "markdown"],
        },
        include_sections: {
          type: "array",
          items: {
            type: "string",
            enum: ["executive_summary", "scope_of_work", "pricing", "timeline", "team_bios", "case_studies", "terms_conditions", "all"],
          },
          description: "Sections to include (default: all)",
        },
      },
      required: ["client_name", "project_description", "company_profile"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "docgen_rfp_response",
    description: "Use when you need to respond to a Request for Proposal (RFP) — analyzes the RFP requirements, matches them to your capabilities, and generates a compliant, section-by-section response with pricing, technical approach, and qualifications. Returns an rfp_response document and a compliance_matrix.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_text: {
          type: "string",
          description: "Full text or summary of the RFP to respond to",
        },
        company_profile: {
          type: "string",
          description: "Your company capabilities, past performance, and differentiators",
        },
        proposed_solution: {
          type: "string",
          description: "Your technical approach and solution overview",
        },
        proposed_price: {
          type: "number",
          description: "Total proposed price in USD",
        },
        output_format: {
          type: "string",
          description: "Output format",
          enum: ["pdf", "docx", "html"],
        },
      },
      required: ["rfp_text", "company_profile", "proposed_solution"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "docgen_report",
    description: "Use when you need to generate a structured report — financial report, market analysis, project status report, audit report, or custom report — from raw data or a brief. Returns a formatted report with executive summary, sections, charts, and appendices.",
    inputSchema: {
      type: "object",
      properties: {
        report_type: {
          type: "string",
          description: "Type of report to generate",
          enum: ["financial", "market_analysis", "project_status", "audit", "executive_summary", "technical", "custom"],
        },
        title: {
          type: "string",
          description: "Report title",
        },
        data_or_brief: {
          type: "string",
          description: "Raw data, key findings, or a narrative brief to build the report from",
        },
        audience: {
          type: "string",
          description: "Intended audience (e.g. 'board of directors', 'investors', 'operations team')",
        },
        output_format: {
          type: "string",
          description: "Output format",
          enum: ["pdf", "docx", "xlsx", "html"],
        },
        include_charts: {
          type: "boolean",
          description: "Whether to include data visualizations (default: true)",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description: "Specific sections to include (e.g. ['executive_summary', 'findings', 'recommendations']). Leave empty for auto-structured.",
        },
      },
      required: ["report_type", "title", "data_or_brief"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "docgen_presentation",
    description: "Use when you need to create a professional presentation deck — sales deck, investor pitch, board update, training material, or conference talk. Generates slides with titles, talking points, visuals suggestions, and speaker notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Presentation title",
        },
        purpose: {
          type: "string",
          description: "Goal of the presentation",
          enum: ["sales_pitch", "investor_pitch", "board_update", "product_demo", "training", "conference_talk", "status_update", "custom"],
        },
        content_brief: {
          type: "string",
          description: "Key messages, data, and narrative you want the presentation to convey",
        },
        num_slides: {
          type: "integer",
          description: "Approximate number of slides (default: 10)",
        },
        audience: {
          type: "string",
          description: "Who will see the presentation (e.g. 'Series A investors', 'enterprise sales prospects')",
        },
        output_format: {
          type: "string",
          description: "Output format",
          enum: ["pptx", "pdf", "html"],
        },
        brand_colors: {
          type: "array",
          items: { type: "string" },
          description: "Brand hex color codes to apply (optional, e.g. ['#0052CC', '#FFFFFF'])",
        },
      },
      required: ["title", "purpose", "content_brief"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "docgen_merge_templates",
    description: "Use when you need to populate document templates with dynamic data — mail merge, contract population, certificate generation, or bulk document creation. Accepts a template and a data object; returns one or multiple completed documents.",
    inputSchema: {
      type: "object",
      properties: {
        template_id: {
          type: "string",
          description: "Template identifier (pre-saved templates) or omit and supply template_content",
        },
        template_content: {
          type: "string",
          description: "Template text with {{placeholder}} variables (alternative to template_id)",
        },
        merge_data: {
          type: "object",
          description: "Key-value pairs matching the template placeholders (e.g. {\"client_name\": \"Acme Corp\", \"amount\": \"$5,000\"})",
        },
        bulk_records: {
          type: "array",
          items: { type: "object" },
          description: "Array of data objects for bulk document generation (one document per record)",
        },
        output_format: {
          type: "string",
          description: "Output format for completed documents",
          enum: ["pdf", "docx", "html", "txt"],
        },
      },
      required: ["merge_data"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "docgen_dashboard",
    description: "Use when you need an overview of document generation activity — recent documents created, template library, usage by type, pending e-signatures, and storage. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: {
          type: "string",
          description: "Organization or team identifier",
        },
        date_from: {
          type: "string",
          description: "Start of reporting window (ISO 8601, optional)",
        },
        date_to: {
          type: "string",
          description: "End of reporting window (ISO 8601, optional)",
        },
      },
      required: ["org_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── ERP Bridge ───────────────────────────────────────────────────────────────

  {
    name: "erp_query",
    description: "Use when you need to retrieve records from an ERP system — query orders, invoices, inventory, GL accounts, vendors, customers, employees, or any ERP module using natural language or structured filters. Supports SAP, Oracle, NetSuite, Microsoft Dynamics, and more. Returns matching records.",
    inputSchema: {
      type: "object",
      properties: {
        erp_system: {
          type: "string",
          description: "Target ERP platform",
          enum: ["sap", "oracle_erp", "netsuite", "ms_dynamics", "sage", "epicor", "infor", "custom"],
        },
        module: {
          type: "string",
          description: "ERP module to query",
          enum: ["finance", "procurement", "inventory", "hr", "sales", "manufacturing", "projects", "crm", "custom"],
        },
        query: {
          type: "string",
          description: "Natural language query (e.g. 'all open purchase orders over $10,000 from last quarter') or structured filter",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Specific fields to return (optional; defaults to standard fields)",
        },
        limit: {
          type: "integer",
          description: "Maximum records to return (default: 100)",
        },
        connection_id: {
          type: "string",
          description: "ERP connection identifier (configured in your HiveAgent account)",
        },
      },
      required: ["erp_system", "module", "query", "connection_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "erp_create_record",
    description: "Use when you need to create a new record in an ERP system — purchase orders, sales orders, vendor records, GL journal entries, inventory receipts, or employee records. Returns created record ID, status, and any validation warnings.",
    inputSchema: {
      type: "object",
      properties: {
        erp_system: {
          type: "string",
          description: "Target ERP platform",
          enum: ["sap", "oracle_erp", "netsuite", "ms_dynamics", "sage", "epicor", "infor", "custom"],
        },
        module: {
          type: "string",
          description: "ERP module to create the record in",
          enum: ["finance", "procurement", "inventory", "hr", "sales", "manufacturing", "projects", "crm", "custom"],
        },
        record_type: {
          type: "string",
          description: "Type of record to create (e.g. 'purchase_order', 'invoice', 'journal_entry', 'vendor', 'employee')",
        },
        record_data: {
          type: "object",
          description: "Field values for the new record (key-value pairs matching the ERP schema)",
        },
        connection_id: {
          type: "string",
          description: "ERP connection identifier",
        },
        dry_run: {
          type: "boolean",
          description: "If true, validates the record without creating it (default: false)",
        },
      },
      required: ["erp_system", "module", "record_type", "record_data", "connection_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "erp_sync_data",
    description: "Use when you need to synchronize data between an ERP system and an external platform — sync customers, products, orders, or financial data between ERP and e-commerce, CRM, accounting, or payment systems. Returns sync_summary, records_updated, and conflict_list.",
    inputSchema: {
      type: "object",
      properties: {
        erp_system: {
          type: "string",
          description: "Source or target ERP platform",
          enum: ["sap", "oracle_erp", "netsuite", "ms_dynamics", "sage", "epicor", "infor", "custom"],
        },
        external_system: {
          type: "string",
          description: "External system to sync with (e.g. 'shopify', 'salesforce', 'quickbooks', 'stripe', 'hubspot')",
        },
        sync_direction: {
          type: "string",
          description: "Direction of data flow",
          enum: ["erp_to_external", "external_to_erp", "bidirectional"],
        },
        data_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["customers", "products", "orders", "invoices", "inventory", "payments", "vendors", "employees"],
          },
          description: "Types of data to synchronize",
        },
        connection_id: {
          type: "string",
          description: "ERP connection identifier",
        },
        conflict_resolution: {
          type: "string",
          description: "How to handle data conflicts",
          enum: ["erp_wins", "external_wins", "newest_wins", "flag_for_review"],
        },
      },
      required: ["erp_system", "external_system", "sync_direction", "data_types", "connection_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "erp_dashboard",
    description: "Use when you need a health check on your ERP integration — connection status, recent sync activity, error logs, pending records, and data quality metrics across all connected ERP instances. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: {
          type: "string",
          description: "Organization identifier",
        },
        connection_ids: {
          type: "array",
          items: { type: "string" },
          description: "Specific ERP connections to inspect (omit for all)",
        },
      },
      required: ["org_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "erp_map_fields",
    description: "Use when you need to map data fields between two systems — creates a field mapping between ERP schemas and external platforms, handling name differences, data type conversions, and transformation rules. Returns a field_mapping object and a transformation_preview.",
    inputSchema: {
      type: "object",
      properties: {
        source_system: {
          type: "string",
          description: "Source system name (e.g. 'sap', 'shopify', 'salesforce')",
        },
        target_system: {
          type: "string",
          description: "Target system name",
        },
        source_schema: {
          type: "object",
          description: "Source system field definitions (key-value pairs of field_name: data_type)",
        },
        target_schema: {
          type: "object",
          description: "Target system field definitions (optional; provide to get auto-mapped suggestions)",
        },
        data_type: {
          type: "string",
          description: "Type of data being mapped",
          enum: ["customer", "product", "order", "invoice", "employee", "vendor", "custom"],
        },
        sample_records: {
          type: "array",
          items: { type: "object" },
          description: "Sample source records to validate the mapping against (optional)",
        },
      },
      required: ["source_system", "target_system", "source_schema", "data_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── Veterinary ───────────────────────────────────────────────────────────────

  {
    name: "vet_triage_symptoms",
    description: "Use when you need to assess a pet's symptoms and determine the urgency of veterinary care — describes possible conditions, urgency level (emergency/urgent/routine), and first-aid guidance. Supports dogs, cats, birds, rabbits, reptiles, and small mammals. Returns triage_level, possible_conditions, recommended_action, and home_care_steps.",
    inputSchema: {
      type: "object",
      properties: {
        species: {
          type: "string",
          description: "Pet species",
          enum: ["dog", "cat", "bird", "rabbit", "hamster", "guinea_pig", "reptile", "fish", "horse", "other"],
        },
        breed: {
          type: "string",
          description: "Breed of the animal (optional, improves accuracy for breed-specific conditions)",
        },
        age_years: {
          type: "number",
          description: "Pet's age in years",
        },
        weight_kg: {
          type: "number",
          description: "Pet's weight in kilograms",
        },
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: "List of observed symptoms (e.g. ['vomiting', 'lethargy', 'loss of appetite'])",
        },
        symptom_duration: {
          type: "string",
          description: "How long symptoms have been present (e.g. '2 hours', '3 days')",
        },
        known_conditions: {
          type: "array",
          items: { type: "string" },
          description: "Pre-existing health conditions or diagnoses (optional)",
        },
      },
      required: ["species", "symptoms"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "vet_schedule_appointment",
    description: "Use when you need to book a veterinary appointment — searches available vets by location, specialty, and availability, then creates a booking. Returns appointment_id, vet_name, clinic_address, appointment_time, and confirmation details.",
    inputSchema: {
      type: "object",
      properties: {
        pet_id: {
          type: "string",
          description: "Pet identifier from health records",
        },
        owner_id: {
          type: "string",
          description: "Pet owner identifier",
        },
        reason: {
          type: "string",
          description: "Reason for the visit (e.g. 'annual wellness exam', 'vomiting and lethargy', 'dental cleaning')",
        },
        appointment_type: {
          type: "string",
          description: "Type of appointment",
          enum: ["wellness_exam", "sick_visit", "emergency", "dental", "surgery_consult", "vaccination", "follow_up", "specialist"],
        },
        preferred_date: {
          type: "string",
          description: "Preferred appointment date (ISO 8601)",
        },
        location: {
          type: "string",
          description: "City, zip code, or address for finding nearby clinics",
        },
        specialty: {
          type: "string",
          description: "Veterinary specialty needed (optional)",
          enum: ["general_practice", "emergency", "dermatology", "cardiology", "oncology", "orthopedics", "neurology", "exotic_animals"],
        },
        telehealth: {
          type: "boolean",
          description: "Whether to search for telehealth/virtual appointments (default: false)",
        },
      },
      required: ["owner_id", "reason", "appointment_type", "location"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "vet_health_record",
    description: "Use when you need to retrieve a pet's health and medical history — vaccinations, diagnoses, medications, lab results, surgery records, weight history, and parasite prevention. Returns a structured health_record with a vaccination_status summary.",
    inputSchema: {
      type: "object",
      properties: {
        pet_id: {
          type: "string",
          description: "Pet identifier",
        },
        owner_id: {
          type: "string",
          description: "Pet owner identifier",
        },
        include: {
          type: "array",
          items: {
            type: "string",
            enum: ["vaccinations", "diagnoses", "medications", "lab_results", "surgeries", "weight_history", "dental", "all"],
          },
          description: "Record sections to include (default: all)",
        },
        date_from: {
          type: "string",
          description: "Start of history window (ISO 8601, optional)",
        },
      },
      required: ["pet_id", "owner_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "vet_calculate_medication",
    description: "Use when you need to calculate the correct dosage for a pet medication — computes dose based on species, weight, age, and the drug's dosing protocol. Returns recommended_dose, frequency, duration, administration_route, and safety_warnings.",
    inputSchema: {
      type: "object",
      properties: {
        medication_name: {
          type: "string",
          description: "Name of the medication (generic or brand name, e.g. 'amoxicillin', 'metronidazole', 'carprofen')",
        },
        species: {
          type: "string",
          description: "Pet species",
          enum: ["dog", "cat", "bird", "rabbit", "hamster", "guinea_pig", "reptile", "horse", "other"],
        },
        weight_kg: {
          type: "number",
          description: "Pet's weight in kilograms",
        },
        age_years: {
          type: "number",
          description: "Pet's age in years (affects dosing for young or geriatric animals)",
        },
        condition: {
          type: "string",
          description: "Condition being treated (helps select the appropriate dosing protocol)",
        },
        concentration: {
          type: "string",
          description: "Available medication concentration (e.g. '250mg/5ml', '500mg tablet'). Optional.",
        },
        known_conditions: {
          type: "array",
          items: { type: "string" },
          description: "Pre-existing conditions that may affect dosing (e.g. 'kidney disease', 'liver impairment')",
        },
      },
      required: ["medication_name", "species", "weight_kg"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "vet_estimate_cost",
    description: "Use when you need to estimate veterinary procedure costs before a visit — provides a cost range for exams, diagnostics, surgeries, dental cleanings, and other procedures based on species, procedure type, and location. Returns low_estimate, high_estimate, cost_breakdown, and insurance_coverage_note.",
    inputSchema: {
      type: "object",
      properties: {
        procedure: {
          type: "string",
          description: "Procedure or service to estimate (e.g. 'spay', 'dental cleaning', 'blood panel', 'x-ray', 'emergency exam')",
        },
        species: {
          type: "string",
          description: "Pet species",
          enum: ["dog", "cat", "bird", "rabbit", "reptile", "horse", "other"],
        },
        weight_kg: {
          type: "number",
          description: "Pet weight in kg (affects anesthesia and surgical costs)",
        },
        location: {
          type: "string",
          description: "City or zip code for regional cost adjustment",
        },
        clinic_type: {
          type: "string",
          description: "Type of clinic",
          enum: ["general_practice", "specialty", "emergency_hospital", "low_cost_clinic"],
        },
      },
      required: ["procedure", "species", "location"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "vet_dashboard",
    description: "Use when you need a centralized view of all pets under your care — vaccination due dates, upcoming appointments, active medications, recent diagnoses, and health reminders for each pet. Always free.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id: {
          type: "string",
          description: "Pet owner identifier",
        },
        pet_ids: {
          type: "array",
          items: { type: "string" },
          description: "Specific pet IDs to include (omit for all pets belonging to owner)",
        },
      },
      required: ["owner_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handlePhase13Tool(name, args) {
  switch (name) {

    // ── Content & Social ───────────────────────────────────────────────────────

    case "content_generate":
      return generateContent(
        args.topic,
        args.content_type,
        args.platform,
        args.tone ?? "professional",
        args.audience ?? null,
        args.word_count ?? null,
        args.keywords ?? []
      );

    case "content_schedule_post":
      return scheduleSocialPost(
        args.content,
        args.platform,
        args.scheduled_time ?? null,
        args.media_urls ?? [],
        args.account_id ?? null,
        args.hashtags ?? []
      );

    case "content_analyze_engagement":
      return analyzeEngagement(
        args.account_id,
        args.platform ?? "all",
        args.date_from ?? null,
        args.date_to ?? null,
        args.metric ?? "all"
      );

    case "content_optimize":
      return optimizePosting(
        args.content,
        args.platform,
        args.optimization_goal,
        args.account_id ?? null,
        args.generate_variants ?? 1
      );

    case "content_repurpose":
      return repurposeContent(
        args.source_content,
        args.source_format,
        args.target_formats,
        args.preserve_tone ?? false
      );

    case "content_dashboard":
      return getContentDashboard(
        args.account_id,
        args.platforms ?? []
      );

    // ── Property Management ────────────────────────────────────────────────────

    case "property_screen_tenant":
      return screenTenant(
        args.applicant_name,
        args.applicant_email,
        args.property_id,
        {
          ssn_last4:      args.ssn_last4 ?? null,
          date_of_birth:  args.date_of_birth ?? null,
          monthly_income: args.monthly_income ?? null,
          checks:         args.checks ?? ["credit", "criminal", "eviction", "income", "references"],
        }
      );

    case "property_create_lease":
      return createLease(
        args.property_id,
        args.tenant_name,
        args.tenant_email,
        args.monthly_rent,
        args.lease_start,
        args.state,
        {
          lease_end:        args.lease_end ?? null,
          security_deposit: args.security_deposit ?? null,
          addenda:          args.addenda ?? [],
        }
      );

    case "property_track_maintenance":
      return trackMaintenance(
        args.property_id,
        args.category,
        args.description,
        args.priority,
        {
          unit:        args.unit ?? null,
          reported_by: args.reported_by ?? null,
          photos:      args.photos ?? [],
        }
      );

    case "property_optimize_rent":
      return optimizeRent(
        args.property_id,
        args.address,
        args.unit_type,
        {
          square_feet:  args.square_feet ?? null,
          current_rent: args.current_rent ?? null,
          amenities:    args.amenities ?? [],
        }
      );

    case "property_rent_collection":
      return manageRentCollection(
        args.property_id,
        args.action,
        args.tenant_id ?? null,
        args.month ?? null
      );

    case "property_dashboard":
      return getPropertyDashboard(
        args.owner_id,
        args.property_ids ?? []
      );

    // ── Intellectual Property ──────────────────────────────────────────────────

    case "ip_search_patents":
      return searchPatents(
        args.query,
        args.databases ?? ["all"],
        {
          date_from:      args.date_from ?? null,
          date_to:        args.date_to ?? null,
          assignee:       args.assignee ?? null,
          classification: args.classification ?? null,
          limit:          args.limit ?? 20,
        }
      );

    case "ip_analyze_prior_art":
      return analyzePriorArt(
        args.invention_description,
        args.technology_area,
        args.key_claims ?? [],
        args.search_depth ?? "standard"
      );

    case "ip_monitor_trademark":
      return monitorTrademark(
        args.mark_name,
        args.owner_id,
        {
          goods_services_class: args.goods_services_class ?? [],
          jurisdictions:        args.jurisdictions ?? ["all"],
          alert_threshold:      args.alert_threshold ?? "medium_and_above",
        }
      );

    case "ip_draft_claims":
      return draftPatentClaims(
        args.invention_disclosure,
        args.technology_area,
        {
          claim_style:             args.claim_style ?? "mixed",
          num_independent_claims:  args.num_independent_claims ?? 3,
          prior_art_references:    args.prior_art_references ?? [],
        }
      );

    case "ip_portfolio":
      return getIpPortfolio(
        args.owner_id,
        args.ip_type ?? "all",
        args.status_filter ?? "all"
      );

    case "ip_freedom_to_operate":
      return checkFreedomToOperate(
        args.product_description,
        args.markets,
        {
          technology_keywords:  args.technology_keywords ?? [],
          competitor_assignees: args.competitor_assignees ?? [],
          analysis_depth:       args.analysis_depth ?? "standard",
        }
      );

    // ── Customer Support ───────────────────────────────────────────────────────

    case "support_triage_ticket":
      return triageTicket(
        args.ticket_content,
        args.channel ?? null,
        args.customer_id ?? null,
        args.product ?? null
      );

    case "support_generate_response":
      return generateResponse(
        args.ticket_content,
        args.ticket_id ?? null,
        args.customer_id ?? null,
        args.tone ?? "empathetic",
        args.include_kb_links ?? true,
        args.agent_name ?? null
      );

    case "support_search_kb":
      return searchKnowledgeBase(
        args.query,
        args.product ?? null,
        args.category ?? "all",
        args.limit ?? 5
      );

    case "support_escalate":
      return escalateTicket(
        args.ticket_id,
        args.reason,
        args.priority,
        args.target_team ?? "auto",
        args.notes ?? null
      );

    case "support_customer_history":
      return getCustomerHistory(
        args.customer_id,
        args.include ?? ["all"],
        args.limit ?? 50
      );

    case "support_dashboard":
      return getSupportDashboard(
        args.team_id,
        args.date_from ?? null,
        args.date_to ?? null,
        args.breakdown_by ?? "none"
      );

    // ── KYC / AML ─────────────────────────────────────────────────────────────

    case "kyc_verify_identity":
      return verifyIdentity(
        args.customer_id,
        args.full_name,
        args.date_of_birth,
        args.nationality,
        args.document_type,
        args.document_number,
        {
          document_image_url: args.document_image_url ?? null,
          selfie_url:         args.selfie_url ?? null,
          address:            args.address ?? null,
        }
      );

    case "kyc_screen_aml":
      return screenAml(
        args.entity_name,
        args.entity_type,
        {
          date_of_birth: args.date_of_birth ?? null,
          nationality:   args.nationality ?? null,
          customer_id:   args.customer_id ?? null,
          lists:         args.lists ?? ["all"],
        }
      );

    case "kyc_assess_risk":
      return assessRisk(
        args.customer_id,
        args.customer_type,
        args.jurisdiction,
        {
          industry:                      args.industry ?? null,
          expected_transaction_volume:   args.expected_transaction_volume ?? null,
          include_factors:               args.include_factors ?? ["all"],
        }
      );

    case "kyc_monitor_transactions":
      return monitorTransactions(
        args.customer_id,
        args.transaction_data ?? null,
        args.monitoring_period ?? "30d",
        args.alert_threshold ?? "standard"
      );

    case "kyc_generate_sar":
      return generateSar(
        args.customer_id,
        args.suspicious_activity_description,
        args.jurisdiction,
        args.activity_type,
        {
          transaction_ids:          args.transaction_ids ?? [],
          total_suspicious_amount:  args.total_suspicious_amount ?? null,
        }
      );

    case "kyc_compliance_dashboard":
      return getComplianceDashboard(
        args.institution_id,
        args.risk_tier_filter ?? "all"
      );

    // ── Document Generation ────────────────────────────────────────────────────

    case "docgen_proposal":
      return generateProposal(
        args.client_name,
        args.project_description,
        args.company_profile,
        {
          services:         args.services ?? [],
          total_value:      args.total_value ?? null,
          timeline_weeks:   args.timeline_weeks ?? null,
          output_format:    args.output_format ?? "pdf",
          include_sections: args.include_sections ?? ["all"],
        }
      );

    case "docgen_rfp_response":
      return respondToRfp(
        args.rfp_text,
        args.company_profile,
        args.proposed_solution,
        {
          proposed_price: args.proposed_price ?? null,
          output_format:  args.output_format ?? "pdf",
        }
      );

    case "docgen_report":
      return generateReport(
        args.report_type,
        args.title,
        args.data_or_brief,
        {
          audience:       args.audience ?? null,
          output_format:  args.output_format ?? "pdf",
          include_charts: args.include_charts ?? true,
          sections:       args.sections ?? [],
        }
      );

    case "docgen_presentation":
      return createPresentation(
        args.title,
        args.purpose,
        args.content_brief,
        {
          num_slides:    args.num_slides ?? 10,
          audience:      args.audience ?? null,
          output_format: args.output_format ?? "pptx",
          brand_colors:  args.brand_colors ?? [],
        }
      );

    case "docgen_merge_templates":
      return mergeTemplates(
        args.merge_data,
        {
          template_id:      args.template_id ?? null,
          template_content: args.template_content ?? null,
          bulk_records:     args.bulk_records ?? [],
          output_format:    args.output_format ?? "pdf",
        }
      );

    case "docgen_dashboard":
      return getDocumentDashboard(
        args.org_id,
        args.date_from ?? null,
        args.date_to ?? null
      );

    // ── ERP Bridge ─────────────────────────────────────────────────────────────

    case "erp_query":
      return queryErp(
        args.erp_system,
        args.module,
        args.query,
        args.connection_id,
        {
          fields: args.fields ?? [],
          limit:  args.limit ?? 100,
        }
      );

    case "erp_create_record":
      return createRecord(
        args.erp_system,
        args.module,
        args.record_type,
        args.record_data,
        args.connection_id,
        args.dry_run ?? false
      );

    case "erp_sync_data":
      return syncData(
        args.erp_system,
        args.external_system,
        args.sync_direction,
        args.data_types,
        args.connection_id,
        args.conflict_resolution ?? "flag_for_review"
      );

    case "erp_dashboard":
      return getErpDashboard(
        args.org_id,
        args.connection_ids ?? []
      );

    case "erp_map_fields":
      return mapFields(
        args.source_system,
        args.target_system,
        args.source_schema,
        args.data_type,
        {
          target_schema:  args.target_schema ?? null,
          sample_records: args.sample_records ?? [],
        }
      );

    // ── Veterinary ─────────────────────────────────────────────────────────────

    case "vet_triage_symptoms":
      return triagePetSymptoms(
        args.species,
        args.symptoms,
        {
          breed:             args.breed ?? null,
          age_years:         args.age_years ?? null,
          weight_kg:         args.weight_kg ?? null,
          symptom_duration:  args.symptom_duration ?? null,
          known_conditions:  args.known_conditions ?? [],
        }
      );

    case "vet_schedule_appointment":
      return schedulePetAppointment(
        args.owner_id,
        args.reason,
        args.appointment_type,
        args.location,
        {
          pet_id:        args.pet_id ?? null,
          preferred_date: args.preferred_date ?? null,
          specialty:     args.specialty ?? "general_practice",
          telehealth:    args.telehealth ?? false,
        }
      );

    case "vet_health_record":
      return getPetHealthRecord(
        args.pet_id,
        args.owner_id,
        args.include ?? ["all"],
        args.date_from ?? null
      );

    case "vet_calculate_medication":
      return calculateMedication(
        args.medication_name,
        args.species,
        args.weight_kg,
        {
          age_years:        args.age_years ?? null,
          condition:        args.condition ?? null,
          concentration:    args.concentration ?? null,
          known_conditions: args.known_conditions ?? [],
        }
      );

    case "vet_estimate_cost":
      return estimateVetCost(
        args.procedure,
        args.species,
        args.location,
        {
          weight_kg:   args.weight_kg ?? null,
          clinic_type: args.clinic_type ?? "general_practice",
        }
      );

    case "vet_dashboard":
      return getPetCareDashboard(
        args.owner_id,
        args.pet_ids ?? []
      );

    default:
      throw new Error(`Unknown Phase 13 tool: ${name}`);
  }
}
