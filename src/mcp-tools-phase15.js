/**
 * HiveAgent MCP Tool Definitions — Phase 15
 *
 * Three new verticals (15 tools total):
 *
 * Media & Entertainment (prefix: media_)
 *   media_search_content        — search movies/TV/music/podcasts/ebooks. Free.
 *   media_streaming_check       — find which streaming services carry a title. $0.10/check.
 *   media_license_content       — license music/images/video for commercial use. 10% commission.
 *   media_get_tickets           — find tickets for concerts/sports/theater. 5% commission.
 *   media_create_brief          — create a production brief for video/audio/design. $2/brief.
 *
 * Nonprofit & Grants (prefix: grant_)
 *   grant_search                — search grant opportunities by focus area & funding need. $1/search.
 *   grant_draft_application     — auto-draft a grant application. $10/draft.
 *   grant_track_impact          — track and report program impact. $2/report.
 *   grant_find_volunteers       — match volunteers to opportunities. $0.50/search.
 *   grant_donor_report          — generate personalized donor impact report. $1/report.
 *
 * Sports & Fitness (prefix: sports_)
 *   sports_search_facilities    — find gyms, courts, studios. Free.
 *   sports_workout_plan         — personalized workout plan. $1/plan.
 *   sports_analyze_performance  — analyze athletic performance data. $2/analysis.
 *   sports_book_event           — book sports facilities/events. 5% commission.
 *   sports_nutrition_plan       — personalized nutrition guidance. $1/plan.
 *
 * Exports:
 *   phase15Tools                    — Array of 15 MCP tool definitions
 *   handlePhase15Tool(name, args)   — Dispatcher function
 */

import {
  searchContent,
  streamingAvailability,
  licenseContent,
  getTickets,
  createMediaBrief,
} from "./services/media-entertainment.js";

import {
  searchGrants,
  draftGrantApplication,
  trackImpact,
  findVolunteers,
  generateDonorReport,
} from "./services/nonprofit-grants.js";

import {
  searchFacilities,
  createWorkoutPlan,
  analyzePerformance,
  bookSportsEvent,
  getNutritionPlan,
} from "./services/sports-fitness.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase15Tools = [

  // ── Media & Entertainment ──────────────────────────────────────────────────

  {
    name: "media_search_content",
    description:
      "Use when you need to find movies, TV shows, music albums, podcasts, or ebooks across streaming and digital platforms. " +
      "Filter by media type (movie, tv, music, podcast, ebook) and/or platform (Netflix, Spotify, etc). " +
      "Returns title, platform, rating, price, and deeplink for each result. Free.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term — title, genre, artist, or topic (e.g. 'sci-fi 2024', 'Taylor Swift', 'entrepreneurship podcast')",
        },
        mediaType: {
          type: "string",
          description: "Filter by content type",
          enum: ["movie", "tv", "music", "podcast", "ebook"],
        },
        platform: {
          type: "string",
          description: "Filter by platform name (e.g. 'Netflix', 'Spotify', 'Apple TV+'). Optional.",
        },
      },
    },
    annotations: {
      readOnlyHint:    true,
      destructiveHint: false,
      idempotentHint:  true,
      openWorldHint:   false,
    },
  },

  {
    name: "media_streaming_check",
    description:
      "Use when you need to find which streaming services carry a specific movie or TV show title, " +
      "and whether it's included with a subscription or requires a separate purchase. " +
      "Optionally filter by country (default: US). Fee: $0.10 per check.",
    inputSchema: {
      type: "object",
      properties: {
        contentTitle: {
          type: "string",
          description: "Title of the movie or TV show to look up (e.g. 'Dune: Part Two', 'Severance')",
        },
        country: {
          type: "string",
          description: "ISO 2-letter country code for regional availability (default: 'US'). Examples: 'GB', 'CA', 'AU'.",
          default: "US",
        },
      },
      required: ["contentTitle"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "media_license_content",
    description:
      "Use when you need to license music, images, or video clips for commercial, editorial, broadcast, or social media use. " +
      "Specify content type, intended usage, and license duration. Returns a license ID, full usage rights, " +
      "price, and download URL. Fee: 10% commission on license price.",
    inputSchema: {
      type: "object",
      properties: {
        contentType: {
          type: "string",
          description: "Type of content to license",
          enum: ["music", "image", "video"],
        },
        usage: {
          type: "string",
          description: "Intended usage for the license",
          enum: ["commercial", "editorial", "broadcast", "social"],
        },
        duration: {
          type: "number",
          description: "License duration in days (e.g. 30, 90, 365, 730). Default: 365.",
        },
      },
      required: ["contentType", "usage"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "media_get_tickets",
    description:
      "Use when you need to find tickets for concerts, sports events, or theater performances. " +
      "Filter by event name, location (city), and/or date range. Returns event details, " +
      "venue, date, price range, and real-time availability. Fee: 5% commission on ticket purchases.",
    inputSchema: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          description: "Event name or partial name to search (e.g. 'Taylor Swift', 'NBA Finals', 'Hamilton'). Optional.",
        },
        location: {
          type: "string",
          description: "City name or venue name to filter by (e.g. 'New York', 'Los Angeles'). Optional.",
        },
        dateRange: {
          type: "object",
          description: "Date range filter. Both fields optional.",
          properties: {
            from: { type: "string", description: "Start date YYYY-MM-DD" },
            to:   { type: "string", description: "End date YYYY-MM-DD" },
          },
        },
      },
    },
    annotations: {
      readOnlyHint:    true,
      destructiveHint: false,
      idempotentHint:  true,
      openWorldHint:   false,
    },
  },

  {
    name: "media_create_brief",
    description:
      "Use when you need to commission a video, audio, design, or animation project. " +
      "Creates a production brief with recommended vendors, timeline, and budget breakdown based on your " +
      "project type, requirements, and budget. Returns brief_id, vendor recommendations with ratings and estimated costs, " +
      "timeline in weeks, and full budget breakdown. Fee: $2 per brief.",
    inputSchema: {
      type: "object",
      properties: {
        projectType: {
          type: "string",
          description: "Type of media production project",
          enum: ["video", "audio", "design", "animation"],
        },
        requirements: {
          type: "string",
          description: "Detailed description of project requirements, deliverables, style, and any constraints",
        },
        budget: {
          type: "number",
          description: "Total project budget in USD",
        },
      },
      required: ["projectType", "requirements", "budget"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  // ── Nonprofit & Grants ──────────────────────────────────────────────────────

  {
    name: "grant_search",
    description:
      "Use when a nonprofit needs to find grant funding opportunities. " +
      "Search by focus area, funding amount needed, and deadline. Returns matching grants from 20 major funders " +
      "including Gates Foundation, MacArthur, Ford, NIH, and more — each with funder, amount range, " +
      "deadline, eligibility criteria, and a match score. Fee: $1 per search.",
    inputSchema: {
      type: "object",
      properties: {
        organization: {
          type: "string",
          description: "Organization name or brief description (used to improve match scoring). Optional.",
        },
        focus_area: {
          type: "string",
          description: "Primary program focus area",
          enum: ["education", "health", "environment", "arts", "community", "research", "housing"],
        },
        fundingNeeded: {
          type: "number",
          description: "Amount of funding needed in USD (used to filter grants by award size)",
        },
        deadline: {
          type: "string",
          description: "Latest acceptable grant deadline in YYYY-MM-DD format (only grants with deadlines on or before this date are returned)",
        },
      },
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "grant_draft_application",
    description:
      "Use when a nonprofit needs to draft a grant application. Provide the grant ID (from grant_search), " +
      "your organization profile, and a project description. Returns a complete draft with all required sections " +
      "(Executive Summary, Statement of Need, Project Description, Goals, Evaluation Plan, Budget Narrative, " +
      "Sustainability Plan), compliance score, and word count. Fee: $10 per draft.",
    inputSchema: {
      type: "object",
      properties: {
        grantId: {
          type: "string",
          description: "Grant ID from grant_search results",
        },
        organizationProfile: {
          type: "object",
          description: "Your organization's profile",
          properties: {
            name:          { type: "string",  description: "Legal organization name" },
            ein:           { type: "string",  description: "EIN (Tax ID) in XX-XXXXXXX format" },
            mission:       { type: "string",  description: "Mission statement" },
            annual_budget: { type: "number",  description: "Annual operating budget in USD" },
            staff_count:   { type: "integer", description: "Number of full-time staff" },
            founded_year:  { type: "integer", description: "Year founded" },
          },
        },
        projectDescription: {
          type: "string",
          description: "Detailed description of the specific project you're seeking funding for (2-5 paragraphs recommended)",
        },
      },
      required: ["grantId", "projectDescription"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "grant_track_impact",
    description:
      "Use when a nonprofit needs to track and report program impact for funders, boards, or public reporting. " +
      "Provide program metrics (beneficiaries served, outcomes, costs) and the reporting period. " +
      "Returns a structured impact report with ROI ratio, outcome achievement rates, and chart data " +
      "for visualizations. Fee: $2 per report.",
    inputSchema: {
      type: "object",
      properties: {
        programId: {
          type: "string",
          description: "Your internal program identifier",
        },
        metrics: {
          type: "object",
          description: "Program performance metrics",
          properties: {
            beneficiaries: { type: "number",  description: "Total individuals served in the period" },
            costs_usd:     { type: "number",  description: "Total program costs in USD for the period" },
            outcomes:      { type: "array",   items: { type: "string" }, description: "List of key outcomes achieved (e.g. ['Jobs secured', 'GEDs earned', 'Families housed'])" },
          },
        },
        period: {
          type: "string",
          description: "Reporting period descriptor (e.g. '2025-Annual', '2025-Q4', '2024-2025 Program Year')",
        },
      },
      required: ["programId", "period"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "grant_find_volunteers",
    description:
      "Use when a nonprofit needs to find and match volunteers to open positions. " +
      "Filter by required skills, location, and availability. Returns matched volunteer profiles " +
      "with skills, availability schedule, weekly hours, and a match score. Fee: $0.50 per search.",
    inputSchema: {
      type: "object",
      properties: {
        skills: {
          type: "array",
          items: { type: "string" },
          description: "List of required or preferred skills (e.g. ['grant writing', 'data analysis', 'social work'])",
        },
        location: {
          type: "string",
          description: "City or region where volunteers are needed. Include 'remote' for remote opportunities.",
        },
        availability: {
          type: "string",
          description: "Required availability schedule",
          enum: ["weekdays", "weekends", "flexible", "remote"],
        },
      },
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "grant_donor_report",
    description:
      "Use when a nonprofit needs to generate a personalized impact report for a specific donor. " +
      "Returns a complete donor stewardship package: donation summary, impact metrics " +
      "(beneficiaries supported, meals provided, volunteer hours enabled), and a personalized " +
      "thank-you message ready to send. Fee: $1 per report.",
    inputSchema: {
      type: "object",
      properties: {
        donorId: {
          type: "string",
          description: "Donor's ID or identifier in your system",
        },
        period: {
          type: "string",
          description: "Report period (e.g. '2025', '2025-Q4', 'FY2025')",
        },
      },
      required: ["donorId", "period"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  // ── Sports & Fitness ────────────────────────────────────────────────────────

  {
    name: "sports_search_facilities",
    description:
      "Use when you need to find gyms, yoga studios, pools, courts, or fitness facilities near a location. " +
      "Filter by city, activity type, and required amenities. Returns facilities with pricing, " +
      "hours, amenities, ratings, and contact info. Seeded with 15 real facility types across major US cities. Free.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or state (e.g. 'New York', 'San Francisco', 'TX')",
        },
        activityType: {
          type: "string",
          description: "Type of facility to search for",
          enum: ["gym", "yoga", "pool", "tennis", "basketball", "soccer", "climbing", "cycling", "boxing"],
        },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "Required amenities to filter by (e.g. ['pool', 'sauna', 'personal training']). Optional.",
        },
      },
    },
    annotations: {
      readOnlyHint:    true,
      destructiveHint: false,
      idempotentHint:  true,
      openWorldHint:   false,
    },
  },

  {
    name: "sports_workout_plan",
    description:
      "Use when you need a personalized workout plan tailored to fitness level, goals, available equipment, " +
      "and days per week. Returns a 4-week progressive plan with daily exercise breakdowns, sets/reps or duration, " +
      "progression guidance, and estimated weekly calorie burn. " +
      "Goals: weight_loss, muscle_gain, endurance, flexibility, general_fitness. Fee: $1 per plan.",
    inputSchema: {
      type: "object",
      properties: {
        fitnessLevel: {
          type: "string",
          description: "Current fitness level",
          enum: ["beginner", "intermediate", "advanced"],
        },
        goals: {
          type: "string",
          description: "Primary fitness goal",
          enum: ["weight_loss", "muscle_gain", "endurance", "flexibility", "general_fitness"],
        },
        equipment: {
          type: "string",
          description: "Available equipment",
          enum: ["none", "home", "gym", "full"],
          default: "none",
        },
        daysPerWeek: {
          type: "integer",
          description: "Number of workout days per week (2-6)",
          minimum: 2,
          maximum: 6,
          default: 3,
        },
      },
      required: ["fitnessLevel", "goals"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "sports_analyze_performance",
    description:
      "Use when you need to analyze an athlete's performance data and get actionable recommendations. " +
      "Provide biometric data (age, weight, height, resting HR, VO2max) and sport type. " +
      "Returns an overall performance score (0-100), performance tier (Developing → Elite), " +
      "top strengths, key weaknesses, and specific training recommendations. Fee: $2 per analysis.",
    inputSchema: {
      type: "object",
      properties: {
        athleteData: {
          type: "object",
          description: "Athlete biometric and performance data",
          properties: {
            age:          { type: "integer", description: "Age in years" },
            weight_kg:    { type: "number",  description: "Body weight in kilograms" },
            height_cm:    { type: "number",  description: "Height in centimeters" },
            resting_hr:   { type: "integer", description: "Resting heart rate in BPM" },
            vo2max:       { type: "number",  description: "VO2max in ml/kg/min (if known)" },
          },
        },
        sport: {
          type: "string",
          description: "Primary sport or activity",
          enum: ["running", "cycling", "swimming", "strength", "team_sports", "crossfit"],
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Specific metrics to focus on in the analysis (optional)",
        },
      },
      required: ["sport"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "sports_book_event",
    description:
      "Use when you need to book a sports facility, court, pool lane, fitness class, or sports event. " +
      "Specify event type, location, date/time, and number of participants. " +
      "Returns a confirmed booking with confirmation code, total cost, and cancellation policy. " +
      "Fee: 5% commission on booking cost.",
    inputSchema: {
      type: "object",
      properties: {
        eventType: {
          type: "string",
          description: "Type of facility or event to book",
          enum: ["court", "field", "lane", "class", "facility"],
        },
        location: {
          type: "string",
          description: "Venue name or city for the booking",
        },
        dateRange: {
          type: "object",
          description: "Booking date and time details",
          properties: {
            date:            { type: "string",  description: "Booking date YYYY-MM-DD" },
            startTime:       { type: "string",  description: "Start time in HH:MM format (24h)" },
            duration_hours:  { type: "number",  description: "Duration in hours (e.g. 1.5)" },
          },
        },
        participants: {
          type: "integer",
          description: "Number of participants in the booking",
          default: 1,
        },
      },
      required: ["eventType", "location"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

  {
    name: "sports_nutrition_plan",
    description:
      "Use when you need a personalized weekly nutrition plan including meal plans, macro targets, " +
      "and a grocery list with cost estimates. Supports dietary restrictions including vegetarian, vegan, " +
      "gluten-free, and dairy-free. Optimizes for your specific fitness goal. Fee: $1 per plan.",
    inputSchema: {
      type: "object",
      properties: {
        goals: {
          type: "string",
          description: "Primary nutrition/fitness goal",
          enum: ["weight_loss", "muscle_gain", "endurance", "maintenance", "plant_based"],
        },
        restrictions: {
          type: "array",
          items: { type: "string" },
          description: "Dietary restrictions or preferences (e.g. ['vegetarian', 'gluten_free', 'dairy_free'])",
          default: [],
        },
        budget: {
          type: "number",
          description: "Weekly grocery budget in USD (default: $100)",
          default: 100,
        },
      },
      required: ["goals"],
    },
    annotations: {
      readOnlyHint:    false,
      destructiveHint: false,
      idempotentHint:  false,
      openWorldHint:   false,
    },
  },

];

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handlePhase15Tool(name, args) {
  switch (name) {

    // Media & Entertainment
    case "media_search_content":       return searchContent(args);
    case "media_streaming_check":      return streamingAvailability(args);
    case "media_license_content":      return licenseContent(args);
    case "media_get_tickets":          return getTickets(args);
    case "media_create_brief":         return createMediaBrief(args);

    // Nonprofit & Grants
    case "grant_search":               return searchGrants(args);
    case "grant_draft_application":    return draftGrantApplication(args);
    case "grant_track_impact":         return trackImpact(args);
    case "grant_find_volunteers":      return findVolunteers(args);
    case "grant_donor_report":         return generateDonorReport(args);

    // Sports & Fitness
    case "sports_search_facilities":   return searchFacilities(args);
    case "sports_workout_plan":        return createWorkoutPlan(args);
    case "sports_analyze_performance": return analyzePerformance(args);
    case "sports_book_event":          return bookSportsEvent(args);
    case "sports_nutrition_plan":      return getNutritionPlan(args);

    default:
      throw new Error(`Unknown Phase 15 tool: ${name}`);
  }
}
