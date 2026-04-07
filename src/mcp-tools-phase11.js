/**
 * HiveAgent MCP Tool Definitions — Phase 11
 *
 * Three new vertical modules exposed as MCP tools:
 *
 *   cybersecurity        — Threat scanning, alert triage, IOC reputation checks,
 *                          incident report generation, vulnerability assessment,
 *                          and security posture dashboard for SOC teams.
 *
 *   personal-finance     — Spending analysis, portfolio optimization, retirement
 *                          planning, loan comparison, tax-loss harvesting, and
 *                          personal finance dashboard — robo-advisor for agents.
 *
 *   event-planning       — Venue search and booking, AI event planning, attendee
 *                          registration management, vendor coordination, and event
 *                          analytics dashboard.
 *
 * Tool names (18 total):
 *   cyber_scan_threats  cyber_triage_alert  cyber_check_ioc  cyber_incident_report
 *   cyber_assess_vulnerability  cyber_dashboard
 *   finance_analyze_spending  finance_optimize_portfolio  finance_plan_retirement
 *   finance_loan_options  finance_tax_harvest  finance_dashboard
 *   event_search_venues  event_book_venue  event_plan  event_manage_registration
 *   event_coordinate_vendors  event_dashboard
 *
 * Exports:
 *   phase11Tools                    — Array of 18 MCP tool definitions
 *   handlePhase11Tool(name, args)   — Dispatcher function
 */

import {
  scanForThreats,
  triageAlert,
  checkIocReputation,
  generateIncidentReport,
  assessVulnerability,
  getCyberDashboard,
} from "./services/cybersecurity.js";

import {
  analyzeSpending,
  optimizePortfolio,
  planRetirement,
  calculateLoanOptions,
  taxHarvestOpportunities,
  getFinanceDashboard,
} from "./services/personal-finance.js";

import {
  searchVenues,
  bookVenue,
  planEvent,
  manageRegistration,
  coordinateVendors,
  getEventDashboard,
} from "./services/event-planning.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────────

export const phase11Tools = [

  // ── Cybersecurity ──────────────────────────────────────────────────────────

  {
    name: "cyber_scan_threats",
    description:
      "Use when you need to scan a URL, IP address, or domain for cybersecurity threats. " +
      "Supports four scan types: vulnerability (CVE checks), malware (malicious code detection), " +
      "phishing (credential-harvesting indicators), and configuration (insecure settings). " +
      "Returns a threat list, numerical risk score, CVE references, and actionable remediation steps. " +
      "Trigger phrases: 'scan this URL for threats', 'check if this IP is malicious', " +
      "'run a vulnerability scan', 'phishing check this domain'. Fee: $0.50/scan.",
    inputSchema: {
      type: "object",
      properties: {
        target:    { type: "string",  description: "URL, IP address, or domain to scan" },
        scan_type: { type: "string",  enum: ["vulnerability","malware","phishing","configuration"], description: "Type of threat scan to perform" },
        depth:     { type: "string",  enum: ["quick","standard","deep"], description: "Scan depth — quick (1 threat), standard (2), deep (4). Default: standard" },
      },
      required: ["target"],
    },
  },

  {
    name: "cyber_triage_alert",
    description:
      "Use when you receive a security alert and need to determine its priority and recommended response. " +
      "Accepts raw alert data, contextual information, and reported severity. Returns priority " +
      "(critical/high/medium/low/info), threat classification, recommended actions, false-positive " +
      "probability, and correlated related alerts. " +
      "Trigger phrases: 'triage this alert', 'is this alert real?', 'prioritize this security event', " +
      "'classify this SIEM alert', 'what should I do about this alert?'. Fee: $0.10/triage.",
    inputSchema: {
      type: "object",
      properties: {
        alert_data: { type: "object",  description: "Raw alert payload from SIEM, EDR, or security tool" },
        context:    { type: "object",  description: "Additional context: asset owner, environment, business criticality" },
        severity:   { type: "string",  enum: ["critical","high","medium","low","info"], description: "Reported severity of the incoming alert. Default: medium" },
      },
      required: [],
    },
  },

  {
    name: "cyber_check_ioc",
    description:
      "Use when you need to check whether an indicator of compromise (IOC) is malicious. " +
      "Supports IP addresses, domains, file hashes, URLs, and email addresses. Returns malicious flag, " +
      "threat categories, first/last seen dates, confidence score, and intelligence sources. " +
      "Cross-references a pre-seeded library of 30 known-malicious IOCs. " +
      "Trigger phrases: 'is this IP malicious?', 'check this domain reputation', 'hash reputation lookup', " +
      "'is this email a phishing address?', 'IOC check'. Fee: $0.05/check.",
    inputSchema: {
      type: "object",
      properties: {
        ioc:      { type: "string", description: "The indicator to check (IP, domain, hash, URL, or email)" },
        ioc_type: { type: "string", enum: ["ip","domain","hash","url","email"], description: "Type of indicator. Default: ip" },
      },
      required: ["ioc"],
    },
  },

  {
    name: "cyber_incident_report",
    description:
      "Use when you need to auto-generate a structured cybersecurity incident response report. " +
      "Accepts incident metadata, investigation findings, and a timeline of events. Returns a complete " +
      "report with executive summary, technical details, impact assessment, and remediation plan — " +
      "ready for CISO briefing or regulatory submission. " +
      "Trigger phrases: 'generate incident report', 'create IR report', 'document this breach', " +
      "'write security incident report', 'post-incident documentation'. Fee: $3.00/report.",
    inputSchema: {
      type: "object",
      properties: {
        incident_data: {
          type: "object",
          description: "Incident metadata: name, type, severity, affected_systems, estimated_recovery",
        },
        findings: {
          type: "object",
          description: "Investigation findings: root_cause, attack_vector, ioc_count, affected_accounts, impact, regulatory_required",
        },
        timeline: {
          type: "array",
          items: { type: "object" },
          description: "Array of {time, event} objects. If empty, a standard timeline is auto-generated.",
        },
      },
      required: [],
    },
  },

  {
    name: "cyber_assess_vulnerability",
    description:
      "Use when you need a comprehensive vulnerability assessment of a host, application, or infrastructure. " +
      "Scopes: web, network, cloud, container, or full. Returns a vulnerability list with CVE IDs, " +
      "CVSS scores, affected components, fix availability, and exploit probability. Seeded with 20 " +
      "real-world CVEs from 2020–2024. " +
      "Trigger phrases: 'run vulnerability assessment', 'scan for CVEs', 'what vulnerabilities does this server have?', " +
      "'pentest report', 'security audit'. Fee: $2.00/assessment.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Hostname, IP range, or application URL to assess" },
        scope:  { type: "string", enum: ["web","network","cloud","container","full"], description: "Assessment scope. Default: full" },
      },
      required: ["target"],
    },
  },

  {
    name: "cyber_dashboard",
    description:
      "Use when you need a high-level security posture dashboard for an organization. " +
      "Returns an aggregated risk score, count of open vulnerabilities, recent incident tally, " +
      "threat trend (increasing/stable/decreasing), patch compliance percentage, and top 5 risks. " +
      "Ideal for CISO morning briefings and SOC situational awareness. " +
      "Trigger phrases: 'security dashboard', 'security posture', 'what is our current risk score?', " +
      "'SOC overview', 'cybersecurity health check'. Fee: $10.00/month.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Organization identifier for the dashboard" },
      },
      required: ["org_id"],
    },
  },

  // ── Personal Finance ───────────────────────────────────────────────────────

  {
    name: "finance_analyze_spending",
    description:
      "Use when you need to analyze spending patterns and identify savings opportunities. " +
      "Accepts an array of transactions (or auto-generates representative data), a category list, " +
      "and time period. Returns category breakdown, trend directions, anomaly detection, " +
      "and concrete savings opportunities with estimated monthly savings. " +
      "Trigger phrases: 'analyze my spending', 'where is my money going?', 'spending breakdown', " +
      "'find savings opportunities', 'budget analysis'. Fee: $0.50/analysis.",
    inputSchema: {
      type: "object",
      properties: {
        transactions: {
          type: "array",
          items: { type: "object" },
          description: "Array of {date, amount, category, merchant} transaction objects. Optional — uses sample data if empty.",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Category list to track. Defaults to 10 standard categories if empty.",
        },
        period: { type: "string", enum: ["monthly","quarterly","annual"], description: "Analysis period. Default: monthly" },
      },
      required: [],
    },
  },

  {
    name: "finance_optimize_portfolio",
    description:
      "Use when you need to optimize an investment portfolio using modern portfolio theory. " +
      "Accepts current holdings, risk tolerance, goals, and time horizon. Returns recommended " +
      "asset allocation, rebalancing trades with rationale, expected annual return, and key risk " +
      "metrics (Sharpe ratio, volatility, max drawdown). " +
      "Trigger phrases: 'optimize my portfolio', 'should I rebalance?', 'portfolio allocation', " +
      "'investment optimization', 'asset allocation recommendation'. Fee: $2.00/optimization.",
    inputSchema: {
      type: "object",
      properties: {
        holdings: {
          type: "array",
          items: { type: "object" },
          description: "Current holdings as array of {symbol, value, asset_class}. Optional.",
        },
        risk_tolerance: { type: "string", enum: ["conservative","moderate","aggressive"], description: "Risk appetite. Default: moderate" },
        goals:          { type: "array",  items: { type: "string" }, description: "Investment goals e.g. ['retirement','income','growth']" },
        time_horizon:   { type: "number", description: "Investment horizon in years. Default: 10" },
      },
      required: [],
    },
  },

  {
    name: "finance_plan_retirement",
    description:
      "Use when you need a retirement plan showing whether current savings are on track. " +
      "Accepts current age, income, savings, monthly contribution, target retirement age, and lifestyle. " +
      "Returns on-track status, projected savings, gap analysis, recommended monthly contribution, " +
      "and conservative/moderate/aggressive scenario projections. " +
      "Trigger phrases: 'am I on track for retirement?', 'retirement calculator', 'retirement plan', " +
      "'when can I retire?', 'retirement savings gap'. Fee: $1.00/plan.",
    inputSchema: {
      type: "object",
      properties: {
        age:                  { type: "number", description: "Current age" },
        income:               { type: "number", description: "Annual income in USD" },
        savings:              { type: "number", description: "Current retirement savings in USD" },
        monthly_contribution: { type: "number", description: "Current monthly retirement contribution in USD" },
        target_age:           { type: "number", description: "Desired retirement age. Default: 65" },
        lifestyle:            { type: "string", enum: ["frugal","moderate","comfortable","luxury"], description: "Desired retirement lifestyle. Default: moderate" },
      },
      required: ["age","income","savings","monthly_contribution"],
    },
  },

  {
    name: "finance_loan_options",
    description:
      "Use when you need to compare loan offers across multiple lenders. " +
      "Supports mortgage, auto, personal, student, and business loans. Returns up to 5 lender options " +
      "with APR, monthly payment, total cost, total interest, and approval odds based on credit score. " +
      "Seeded with 10 real lenders including banks, credit unions, and fintechs. " +
      "Trigger phrases: 'compare loan rates', 'best mortgage rate', 'personal loan options', " +
      "'auto loan calculator', 'should I take this loan?'. Fee: $0.50/comparison.",
    inputSchema: {
      type: "object",
      properties: {
        amount:       { type: "number", description: "Loan amount in USD" },
        credit_score: { type: "number", description: "Borrower FICO credit score (300–850)" },
        loan_type:    { type: "string", enum: ["mortgage","auto","personal","student","business"], description: "Type of loan. Default: personal" },
        term:         { type: "number", description: "Loan term in months. Default: 60" },
      },
      required: ["amount","credit_score"],
    },
  },

  {
    name: "finance_tax_harvest",
    description:
      "Use when you need to find tax-loss harvesting opportunities in an investment portfolio. " +
      "Accepts portfolio positions with cost basis, marginal tax bracket, and year-to-date realized gains. " +
      "Returns positions with unrealized losses, tax savings estimates, wash-sale wait periods, " +
      "and suitable replacement securities to maintain market exposure. " +
      "Trigger phrases: 'find tax-loss harvesting opportunities', 'tax harvest my portfolio', " +
      "'minimize capital gains', 'offset gains with losses', 'year-end tax planning'. Fee: $1.00/analysis.",
    inputSchema: {
      type: "object",
      properties: {
        portfolio: {
          type: "array",
          items: { type: "object" },
          description: "Array of {symbol, cost_basis, current_value, asset_class}. Uses sample data if empty.",
        },
        tax_bracket: { type: "number", description: "Marginal tax rate as decimal (e.g. 0.22 for 22%). Default: 0.22" },
        ytd_gains:   { type: "number", description: "Year-to-date realized capital gains in USD. Default: 0" },
      },
      required: [],
    },
  },

  {
    name: "finance_dashboard",
    description:
      "Use when you need a personal finance snapshot for a user. " +
      "Returns net worth, monthly cash flow, year-to-date investment returns, debt-to-income ratio, " +
      "savings rate, and an overall financial health score (A–F grade). Surfaces alerts for " +
      "negative cash flow or high debt loads. " +
      "Trigger phrases: 'financial health check', 'personal finance dashboard', 'what is my net worth?', " +
      "'financial summary', 'how am I doing financially?'. Fee: $2.00/month.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User identifier for the dashboard" },
      },
      required: ["user_id"],
    },
  },

  // ── Event Planning ─────────────────────────────────────────────────────────

  {
    name: "event_search_venues",
    description:
      "Use when you need to find event venues matching a location, event type, capacity, date range, " +
      "and budget. Supports conference, wedding, corporate, party, and workshop events. Returns venues " +
      "with name, capacity, price range, amenities, availability status, rating, and photo count. " +
      "Seeded with 15 real-style venues across major US cities. " +
      "Trigger phrases: 'find a venue', 'search event spaces', 'wedding venue near NYC', " +
      "'conference hall Chicago', 'book a party venue'. Fee: FREE.",
    inputSchema: {
      type: "object",
      properties: {
        location:   { type: "string", description: "City or region to search (e.g. 'New York', 'Chicago, IL')" },
        event_type: { type: "string", enum: ["conference","wedding","corporate","party","workshop"], description: "Type of event" },
        capacity:   { type: "number", description: "Minimum guest capacity required" },
        date_range: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date YYYY-MM-DD" },
            end:   { type: "string", description: "End date YYYY-MM-DD" },
          },
          description: "Preferred date range for the event",
        },
        budget: { type: "number", description: "Maximum daily budget in USD" },
      },
      required: [],
    },
  },

  {
    name: "event_book_venue",
    description:
      "Use when you have chosen a venue and want to create a booking. " +
      "Requires a venue ID from event_search_venues, event date, event details, and organizer contact info. " +
      "Returns a booking confirmation code, deposit amount due, cancellation policy, and step-by-step next actions. " +
      "Trigger phrases: 'book this venue', 'reserve the venue', 'confirm venue booking', " +
      "'hold the date at this venue', 'I want to book venue [ID]'. Fee: 5% commission on venue price.",
    inputSchema: {
      type: "object",
      properties: {
        venue_id:    { type: "string", description: "Venue ID from event_search_venues results" },
        event_date:  { type: "string", description: "Event date in YYYY-MM-DD format" },
        details: {
          type: "object",
          properties: {
            event_type:       { type: "string" },
            attendees:        { type: "number" },
            special_requests: { type: "string" },
          },
          description: "Event details: type, expected attendees, special requests",
        },
        contact_info: {
          type: "object",
          properties: {
            name:  { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
          description: "Organizer contact information — name and email required",
          required: ["name","email"],
        },
      },
      required: ["venue_id","event_date","contact_info"],
    },
  },

  {
    name: "event_plan",
    description:
      "Use when you need a comprehensive AI-generated event plan. " +
      "Provide event type, expected attendees, total budget, and preferences. Returns a full plan with: " +
      "week-by-week timeline, vendor requirements with budget allocations, category budget breakdown, " +
      "logistics checklist, and day-of task list. " +
      "Trigger phrases: 'plan my event', 'create event plan', 'help me organize this event', " +
      "'what do I need for a corporate event for 200 people?', 'event planning checklist'. Fee: $5.00/plan.",
    inputSchema: {
      type: "object",
      properties: {
        event_type:  { type: "string", enum: ["conference","wedding","corporate","party","workshop"], description: "Type of event to plan" },
        attendees:   { type: "number", description: "Expected number of attendees" },
        budget:      { type: "number", description: "Total event budget in USD" },
        preferences: {
          type: "object",
          properties: {
            theme:               { type: "string" },
            catering:            { type: "string" },
            style:               { type: "string" },
            location_preference: { type: "string" },
          },
          description: "Optional event preferences: theme, catering style, aesthetic, location",
        },
      },
      required: ["attendees","budget"],
    },
  },

  {
    name: "event_manage_registration",
    description:
      "Use when you need to register an attendee for an event or process a new event registration. " +
      "Accepts event ID and registrant details. Returns a confirmation code, ticket number, and " +
      "a running count of total registrations for the event. " +
      "Handles dietary preferences and accessibility requirements. " +
      "Trigger phrases: 'register for this event', 'sign up attendee', 'process registration', " +
      "'event sign-up', 'add guest to event'. Fee: $0.25/registration.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "Event identifier (from event_plan or your own event ID)" },
        registrant_data: {
          type: "object",
          properties: {
            name:                 { type: "string",  description: "Registrant full name — required" },
            email:                { type: "string",  description: "Registrant email — required" },
            ticket_type:          { type: "string",  description: "e.g. general_admission, vip, speaker, sponsor" },
            dietary_preferences:  { type: "string",  description: "e.g. vegetarian, vegan, gluten-free, none" },
            special_requirements: { type: "string",  description: "Accessibility or special accommodation requests" },
          },
          required: ["name","email"],
        },
      },
      required: ["event_id","registrant_data"],
    },
  },

  {
    name: "event_coordinate_vendors",
    description:
      "Use when you need to find and coordinate vendors for an event — catering, AV, decor, " +
      "photography, videography, or equipment rentals. Accepts vendor requirements with service type " +
      "and budget. Returns matched vendors from a seeded pool of 20 vendors with quotes, " +
      "ratings, availability, and specialties. " +
      "Trigger phrases: 'find caterer for my event', 'book AV vendor', 'coordinate event vendors', " +
      "'get photographer quotes', 'decor vendor list'. Fee: $1.00/coordination.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "Event identifier to associate vendors with" },
        vendor_requirements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              service_type: { type: "string", enum: ["catering","av","decor","photography","videography","rentals"] },
              budget:       { type: "number", description: "Budget allocated for this vendor in USD" },
              date:         { type: "string", description: "Required date YYYY-MM-DD" },
              location:     { type: "string", description: "Event location for vendor proximity matching" },
            },
          },
          description: "List of vendor types needed. Defaults to catering, AV, and decor if empty.",
        },
      },
      required: ["event_id"],
    },
  },

  {
    name: "event_dashboard",
    description:
      "Use when you need a live analytics dashboard for an event in progress or upcoming. " +
      "Returns current registration count, attendance forecast, budget utilization, " +
      "vendor booking status, checklist completion percentage, and risk flags. " +
      "Trigger phrases: 'event dashboard', 'event status', 'how many people registered?', " +
      "'event analytics', 'check event progress'. Fee: $3.00/event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "Event identifier to retrieve dashboard for" },
      },
      required: ["event_id"],
    },
  },

];

// ─── handlePhase11Tool ─────────────────────────────────────────────────────────
/**
 * Routes a tool call to the appropriate Phase 11 service function.
 *
 * @param {string} name   - Tool name (e.g. "cyber_scan_threats")
 * @param {object} args   - Tool arguments from the MCP call
 * @returns {*}           - Result from the underlying service module
 * @throws {Error}        - If the tool name is unrecognised
 */
export function handlePhase11Tool(name, args = {}) {
  switch (name) {

    // ── Cybersecurity ──────────────────────────────────────────────────────
    case "cyber_scan_threats":
      return scanForThreats(
        args.target ?? "",
        args.scan_type ?? "vulnerability",
        args.depth ?? "standard"
      );

    case "cyber_triage_alert":
      return triageAlert(
        args.alert_data ?? {},
        args.context ?? {},
        args.severity ?? "medium"
      );

    case "cyber_check_ioc":
      return checkIocReputation(
        args.ioc ?? "",
        args.ioc_type ?? "ip"
      );

    case "cyber_incident_report":
      return generateIncidentReport(
        args.incident_data ?? {},
        args.findings ?? {},
        args.timeline ?? []
      );

    case "cyber_assess_vulnerability":
      return assessVulnerability(
        args.target ?? "",
        args.scope ?? "full"
      );

    case "cyber_dashboard":
      return getCyberDashboard(
        args.org_id ?? ""
      );

    // ── Personal Finance ───────────────────────────────────────────────────
    case "finance_analyze_spending":
      return analyzeSpending(
        args.transactions ?? [],
        args.categories ?? [],
        args.period ?? "monthly"
      );

    case "finance_optimize_portfolio":
      return optimizePortfolio(
        args.holdings ?? [],
        args.risk_tolerance ?? "moderate",
        args.goals ?? [],
        args.time_horizon ?? 10
      );

    case "finance_plan_retirement":
      return planRetirement(
        args.age,
        args.income,
        args.savings,
        args.monthly_contribution,
        args.target_age ?? 65,
        args.lifestyle ?? "moderate"
      );

    case "finance_loan_options":
      return calculateLoanOptions(
        args.amount,
        args.credit_score,
        args.loan_type ?? "personal",
        args.term ?? 60
      );

    case "finance_tax_harvest":
      return taxHarvestOpportunities(
        args.portfolio ?? [],
        args.tax_bracket ?? 0.22,
        args.ytd_gains ?? 0
      );

    case "finance_dashboard":
      return getFinanceDashboard(
        args.user_id ?? ""
      );

    // ── Event Planning ─────────────────────────────────────────────────────
    case "event_search_venues":
      return searchVenues(
        args.location ?? "",
        args.event_type ?? "",
        args.capacity ?? 0,
        args.date_range ?? {},
        args.budget ?? 0
      );

    case "event_book_venue":
      return bookVenue(
        args.venue_id ?? "",
        args.event_date ?? "",
        args.details ?? {},
        args.contact_info ?? {}
      );

    case "event_plan":
      return planEvent(
        args.event_type ?? "corporate",
        args.attendees ?? 100,
        args.budget ?? 10000,
        args.preferences ?? {}
      );

    case "event_manage_registration":
      return manageRegistration(
        args.event_id ?? "",
        args.registrant_data ?? {}
      );

    case "event_coordinate_vendors":
      return coordinateVendors(
        args.event_id ?? "",
        args.vendor_requirements ?? []
      );

    case "event_dashboard":
      return getEventDashboard(
        args.event_id ?? ""
      );

    default:
      throw new Error(`Unknown Phase 11 tool: ${name}`);
  }
}
