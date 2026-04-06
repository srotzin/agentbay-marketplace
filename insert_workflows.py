#!/usr/bin/env python3
"""Insert new workflow tool definitions and handler cases into mcp-tools-workflows.js"""

NEW_TOOL_DEFS = '''
  // ─────────────────────────────────────────────────────────────────────────
  // 11. BOOK FULL TRIP
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_book_full_trip",
    description:
      "Use when you need to plan and book an entire trip end-to-end in a SINGLE CALL. " +
      "Replaces: travel_search_flights + travel_search_hotels + travel_compare_car_rentals + " +
      "travel_search_restaurants + travel_build_itinerary + travel_visa_requirements (6 tool calls → 1). " +
      "Returns a complete travel package with ranked flights, hotels, car rental options, dining recommendations, " +
      "a day-by-day itinerary, and visa/entry requirements.",
    inputSchema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Trip destination (city, region, or country).",
        },
        start_date: {
          type: "string",
          description: "Trip start date (ISO 8601 YYYY-MM-DD).",
        },
        end_date: {
          type: "string",
          description: "Trip end date (ISO 8601 YYYY-MM-DD).",
        },
        budget_usd: {
          type: "number",
          description: "Total trip budget in USD.",
          default: 3000,
        },
        travelers: {
          type: "integer",
          description: "Number of travelers.",
          default: 1,
        },
      },
      required: ["destination", "start_date", "end_date"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. RUN PROCUREMENT CYCLE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_procurement_cycle",
    description:
      "Use when you need to run a full sourcing-to-contract procurement cycle in a SINGLE CALL. " +
      "Replaces: procurement_discover_suppliers + procurement_create_rfq + procurement_evaluate_bids + " +
      "procurement_draft_contract + procurement_match_invoice (5 tool calls → 1). " +
      "Returns a complete procurement package with supplier shortlist, RFQ document, bid scorecard, " +
      "ready-to-sign contract, and invoice match results.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category of goods or services to source (e.g. 'cloud storage', 'PCB components', 'logistics partner').",
        },
        requirements: {
          type: "object",
          description: "Specification, compliance, and delivery requirements (e.g. { quantity: 500, lead_time_days: 30, certifications: ['ISO9001'] }).",
          default: {},
        },
        budget_usd: {
          type: "number",
          description: "Maximum procurement budget in USD.",
          default: 0,
        },
      },
      required: ["category"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 13. PROCESS FULL SALES CYCLE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_sales_cycle",
    description:
      "Use when you need to take a lead from cold prospect to booked meeting in a SINGLE CALL. " +
      "Replaces: sales_enrich_lead + sales_score_lead + sales_generate_outreach + " +
      "sales_schedule_meeting + sales_forecast_pipeline (5 tool calls → 1). " +
      "Returns a complete sales package with enriched firmographics, ICP score, personalized email sequence, " +
      "confirmed meeting booking, and updated pipeline forecast.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: {
          type: "string",
          description: "Target company name.",
        },
        contact_name: {
          type: "string",
          description: "Primary contact's full name.",
        },
        email: {
          type: "string",
          description: "Contact's email address.",
        },
        campaign: {
          type: "string",
          description: "Campaign name or objective (e.g. 'Q2 mid-market push', 'enterprise upsell').",
          default: "outbound",
        },
      },
      required: ["company_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 14. SCREEN AND HIRE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_screen_and_hire",
    description:
      "Use when you need to run a full recruiting pipeline from applications to onboarding in a SINGLE CALL. " +
      "Replaces: hr_screen_resume (for all candidates) + hr_match_candidates + hr_interview_questions + " +
      "hr_check_compensation + hr_automate_onboarding (5+ tool calls → 1). " +
      "Returns a complete hiring package with screened candidates, a ranked shortlist, a structured interview guide, " +
      "compensation benchmarks, and a ready-to-launch 30-60-90 day onboarding plan.",
    inputSchema: {
      type: "object",
      properties: {
        job_requirements: {
          type: "object",
          description: "Job requirements object with role, skills, must_have, department, and job_id.",
          properties: {
            role:        { type: "string", description: "Job title / role type" },
            skills:      { type: "array", items: { type: "string" }, description: "Required skills list" },
            must_have:   { type: "array", items: { type: "string" }, description: "Non-negotiable must-have skills" },
            department:  { type: "string", description: "Hiring department" },
            job_id:      { type: "string", description: "Job requisition ID (optional)" },
          },
        },
        resume_texts: {
          type: "array",
          items: { type: "string" },
          description: "Array of resume text strings to screen (one per candidate).",
          default: [],
        },
        compensation: {
          type: "object",
          description: "Compensation context for benchmarking: { title, location, experience, industry }.",
          properties: {
            title:      { type: "string" },
            location:   { type: "string" },
            experience: { type: "string", enum: ["junior", "mid", "senior", "staff", "director", "vp", "c-level"] },
            industry:   { type: "string" },
          },
          default: {},
        },
      },
      required: ["job_requirements"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 15. FULL FRAUD CHECK
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "workflow_full_fraud_check",
    description:
      "Use when you need a comprehensive fraud assessment for a transaction in a SINGLE CALL. " +
      "Replaces: fraud_screen_transaction + fraud_detect_anomalies + fraud_check_identity + " +
      "fraud_predict_chargeback + fraud_analyze_network (5 tool calls → 1). " +
      "Returns a complete fraud assessment with a composite risk score, approve/review/decline recommendation, " +
      "anomaly report, identity verification, chargeback probability, and network graph analysis.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_data: {
          type: "object",
          description: "Transaction details to assess. Include amount, currency, merchant, payment_method, timestamp, ip_address, device_id.",
          properties: {
            amount:         { type: "number",  description: "Transaction amount" },
            currency:       { type: "string",  description: "Currency code (e.g. 'USD')" },
            merchant:       { type: "string",  description: "Merchant name or ID" },
            payment_method: { type: "string",  description: "Payment method (e.g. 'visa', 'ach', 'crypto')" },
            timestamp:      { type: "string",  description: "Transaction timestamp (ISO 8601)" },
            ip_address:     { type: "string",  description: "IP address of the transaction originator" },
            device_id:      { type: "string",  description: "Device fingerprint or ID" },
          },
        },
        user_profile: {
          type: "object",
          description: "Account holder profile for behavioral context. Include account_id, name, email, dob, address, and account_age_days if available.",
          default: {},
        },
      },
      required: ["transaction_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

'''

NEW_HANDLER_CASES = '''
    case "workflow_book_full_trip":
      return bookFullTrip(
        args.destination ?? "",
        args.start_date ?? "",
        args.end_date ?? "",
        args.budget_usd ?? 3000,
        args.travelers ?? 1
      );

    case "workflow_procurement_cycle":
      return runProcurementCycle(
        args.category ?? "",
        args.requirements ?? {},
        args.budget_usd ?? 0
      );

    case "workflow_full_sales_cycle":
      return processFullSalesCycle(
        args.company_name ?? "",
        args.contact_name ?? "",
        args.email ?? "",
        args.campaign ?? "outbound"
      );

    case "workflow_screen_and_hire":
      return screenAndHire(
        args.job_requirements ?? {},
        args.resume_texts ?? [],
        args.compensation ?? {}
      );

    case "workflow_full_fraud_check":
      return fullFraudCheck(
        args.transaction_data ?? {},
        args.user_profile ?? {}
      );

'''

with open('/home/user/workspace/agentbay/src/mcp-tools-workflows.js', 'r') as f:
    content = f.read()

# Insert tool defs before the closing ];
# Find last occurrence of "  },\n\n];" to insert before ];
insert_tool_marker = '  },\n\n];\n'
pos = content.rfind(insert_tool_marker)
if pos == -1:
    print("ERROR: tool insertion marker not found!")
else:
    # Insert AFTER the last `  },\n` but BEFORE `\n];\n`
    end_of_last_tool = pos + len('  },\n')
    content = content[:end_of_last_tool] + NEW_TOOL_DEFS + '];\n' + content[end_of_last_tool + len('\n];\n'):]
    print(f"Inserted tool definitions at position {end_of_last_tool}")

# Insert handler cases before `    default:\n      throw new Error(`Unknown workflow tool:`
insert_case_marker = '\n    default:\n      throw new Error(`Unknown workflow tool:'
pos2 = content.find(insert_case_marker)
if pos2 == -1:
    print("ERROR: handler case marker not found!")
else:
    content = content[:pos2] + '\n' + NEW_HANDLER_CASES + content[pos2+1:]
    print(f"Inserted handler cases at position {pos2}")

with open('/home/user/workspace/agentbay/src/mcp-tools-workflows.js', 'w') as f:
    f.write(content)

print("Done!")
