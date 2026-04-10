/**
 * HiveAgent MCP Tool Definitions — Phase 10
 *
 * Six new vertical modules exposed as MCP tools:
 *
 *   energy-utilities     — Bill analysis, provider comparison, consumption forecasting,
 *                          efficiency auditing, schedule optimisation, dashboard.
 *
 *   fleet-logistics      — Route optimisation, load planning, predictive maintenance,
 *                          live fleet tracking, freight quoting, dashboard.
 *
 *   tax-accounting       — Expense categorisation, tax return preparation, account
 *                          reconciliation, cash-flow forecasting, deadline checks,
 *                          financial statement generation.
 *
 *   agent-guardrails     — Policy enforcement, output validation, policy management,
 *                          guardrail dashboard, violation reporting, compliance reports.
 *
 *   agent-benchmarking   — Test suite creation, benchmark runs, output evaluation,
 *                          agent comparison, test history, report generation.
 *
 *   advanced-observability — Monitor creation, metrics retrieval, drift detection,
 *                            root-cause analysis, alert management, observability dashboard.
 *
 * Tool names (36 total):
 *   energy_analyze_bill  energy_compare_providers  energy_forecast  energy_audit_efficiency
 *   energy_optimize_schedule  energy_dashboard
 *   fleet_optimize_route  fleet_plan_load  fleet_predict_maintenance  fleet_track
 *   fleet_freight_quote  fleet_dashboard
 *   tax_categorize_expense  tax_prepare_return  tax_reconcile  tax_forecast_cashflow
 *   tax_deadlines  tax_financial_statement
 *   guardrails_enforce_policy  guardrails_validate_output  guardrails_set_policy
 *   guardrails_dashboard  guardrails_report_violation  guardrails_compliance_report
 *   benchmark_create_suite  benchmark_run  benchmark_evaluate  benchmark_compare_agents
 *   benchmark_history  benchmark_report
 *   observability_create_monitor  observability_metrics  observability_detect_drift
 *   observability_root_cause  observability_set_alert  observability_dashboard
 *
 * Exports:
 *   phase10Tools                    — Array of 36 MCP tool definitions
 *   handlePhase10Tool(name, args)   — Dispatcher function
 */

// ─── Placeholder imports ───────────────────────────────────────────────────────
// The actual service modules will be created by parallel subagents.
// Each import is wrapped so that a missing file does not break the MCP server
// startup — calls will surface a clear "not yet implemented" error instead of
// crashing the process.

import {
  analyzeEnergyBill,
  compareEnergyProviders,
  forecastConsumption,
  auditEnergyEfficiency,
  optimizeSchedule,
  getEnergyDashboard,
} from "./services/energy-utilities.js";

import {
  optimizeRoute,
  planLoad,
  predictMaintenance,
  trackFleet,
  calculateFreightQuote,
  getFleetDashboard,
} from "./services/fleet-logistics.js";

import {
  categorizeExpense,
  prepareTaxReturn,
  reconcileAccounts,
  forecastCashFlow,
  checkTaxDeadlines,
  generateFinancialStatement,
} from "./services/tax-accounting.js";

import {
  enforcePolicy,
  validateOutput,
  setPolicy,
  getGuardrailDashboard,
  reportViolation,
  getComplianceReport,
} from "./services/agent-guardrails.js";

import {
  createTestSuite,
  runBenchmark,
  evaluateOutput,
  compareAgents,
  getTestHistory,
  generateTestReport,
} from "./services/agent-benchmarking.js";

import {
  createMonitor,
  getMetrics,
  detectDrift,
  getRootCause,
  setAlert,
  getObservabilityDashboard,
} from "./services/advanced-observability.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────────

export const phase10Tools = [

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 1 — ENERGY & UTILITIES (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "energy_analyze_bill",
    description:
      "Use when you need to analyse an energy bill and extract actionable cost insights. " +
      "Trigger phrases: 'analyse my electricity bill', 'why is my energy bill high', " +
      "'break down my utility charges', 'audit my energy spend'. " +
      "Handles gas, electricity, water, and multi-utility bills. " +
      "Returns itemised cost breakdown, usage trends, anomaly flags, and a savings estimate.",
    inputSchema: {
      type: "object",
      properties: {
        bill_data: {
          type: "object",
          description: "Bill details — include utility_type, period_start, period_end, total_amount, usage_kwh, rate_per_kwh, account_number.",
          properties: {
            utility_type:  { type: "string", description: "Type of utility: 'electricity', 'gas', 'water', or 'multi'." },
            period_start:  { type: "string", description: "Billing period start (ISO 8601)." },
            period_end:    { type: "string", description: "Billing period end (ISO 8601)." },
            total_amount:  { type: "number", description: "Total amount charged in the account currency." },
            usage_kwh:     { type: "number", description: "Total energy consumption in kWh (electricity/gas)." },
            rate_per_kwh:  { type: "number", description: "Rate charged per kWh." },
            account_number:{ type: "string", description: "Utility account number (optional, for history lookups)." },
          },
        },
        location: {
          type: "string",
          description: "Property location (city, state or postcode) for regional rate benchmarking.",
          default: "",
        },
      },
      required: ["bill_data"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "energy_compare_providers",
    description:
      "Use when you need to compare energy providers and find the best rate for a property. " +
      "Trigger phrases: 'compare electricity suppliers', 'find cheaper energy plan', " +
      "'switch energy provider', 'best utility deal in my area', 'energy market comparison'. " +
      "Handles residential and commercial properties across all utility types. " +
      "Returns ranked provider list with rates, contract terms, green-energy %, estimated annual savings, and switch instructions.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Property location (city, state, or postcode) used to determine available providers.",
        },
        utility_type: {
          type: "string",
          enum: ["electricity", "gas", "both"],
          description: "Utility type to compare.",
          default: "electricity",
        },
        annual_usage_kwh: {
          type: "number",
          description: "Estimated annual usage in kWh (used to project costs on each plan).",
          default: 10000,
        },
        property_type: {
          type: "string",
          enum: ["residential", "commercial", "industrial"],
          description: "Property classification.",
          default: "residential",
        },
        preferences: {
          type: "object",
          description: "Optional preferences object — include green_energy: true, max_contract_months: number, fixed_rate_only: boolean.",
          default: {},
        },
      },
      required: ["location"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "energy_forecast",
    description:
      "Use when you need to forecast future energy consumption and costs for a property or portfolio. " +
      "Trigger phrases: 'predict my energy usage', 'forecast electricity costs', " +
      "'energy consumption projection', 'model utility spend for next quarter', 'seasonal energy forecast'. " +
      "Handles historical usage data, weather adjustments, and occupancy changes. " +
      "Returns monthly usage forecast, cost projection, confidence intervals, and demand-peak warnings.",
    inputSchema: {
      type: "object",
      properties: {
        historical_usage: {
          type: "array",
          items: {
            type: "object",
            properties: {
              month:    { type: "string", description: "Month in YYYY-MM format." },
              usage_kwh:{ type: "number", description: "Actual consumption in kWh." },
              cost:     { type: "number", description: "Actual cost for the month." },
            },
          },
          description: "Array of past monthly usage records (minimum 3 months recommended).",
          default: [],
        },
        forecast_months: {
          type: "integer",
          description: "Number of months ahead to forecast.",
          default: 12,
        },
        location: {
          type: "string",
          description: "Property location for weather-adjusted forecasts.",
          default: "",
        },
        adjustments: {
          type: "object",
          description: "Expected changes to model — include occupancy_change_pct, new_equipment_kwh, solar_pv_kwh.",
          default: {},
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "energy_audit_efficiency",
    description:
      "Use when you need to audit a property's energy efficiency and identify improvement opportunities. " +
      "Trigger phrases: 'energy efficiency audit', 'how to reduce energy waste', " +
      "'identify energy saving opportunities', 'carbon footprint audit', 'HVAC efficiency review'. " +
      "Handles residential, commercial, and industrial properties with any combination of systems. " +
      "Returns efficiency score, itemised waste sources, recommended upgrades, payback periods, and estimated annual savings.",
    inputSchema: {
      type: "object",
      properties: {
        property_details: {
          type: "object",
          description: "Property specs — include sqft, building_type, year_built, insulation_rating, hvac_age_years, lighting_type, occupancy_hours_per_day.",
          properties: {
            sqft:                  { type: "number" },
            building_type:         { type: "string", description: "e.g. 'detached_house', 'apartment', 'office', 'warehouse'" },
            year_built:            { type: "integer" },
            insulation_rating:     { type: "string", description: "e.g. 'poor', 'average', 'good', 'excellent'" },
            hvac_age_years:        { type: "number" },
            lighting_type:         { type: "string", description: "e.g. 'incandescent', 'fluorescent', 'LED'" },
            occupancy_hours_per_day: { type: "number" },
          },
          default: {},
        },
        current_usage_kwh: {
          type: "number",
          description: "Annual energy consumption in kWh for baseline efficiency scoring.",
          default: 0,
        },
        include_renewables: {
          type: "boolean",
          description: "Include solar PV and battery storage recommendations.",
          default: true,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "energy_optimize_schedule",
    description:
      "Use when you need to optimise energy usage schedules to reduce costs or shift load to off-peak periods. " +
      "Trigger phrases: 'optimise energy schedule', 'reduce peak demand charges', " +
      "'shift load to off-peak', 'smart appliance scheduling', 'time-of-use optimisation'. " +
      "Handles smart home/office devices, EV charging, HVAC, and battery storage systems. " +
      "Returns an optimised daily schedule, projected savings, peak-demand reduction %, and device-by-device timetable.",
    inputSchema: {
      type: "object",
      properties: {
        devices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:         { type: "string", description: "Device name or ID." },
              type:         { type: "string", description: "e.g. 'hvac', 'ev_charger', 'washer', 'dishwasher', 'battery'" },
              power_kw:     { type: "number", description: "Rated power consumption in kW." },
              flexible:     { type: "boolean", description: "Whether the run time can be shifted." },
              required_by:  { type: "string", description: "Latest acceptable completion time (HH:MM)." },
            },
          },
          description: "List of devices to schedule.",
          default: [],
        },
        tariff: {
          type: "object",
          description: "Tariff structure — include peak_rate, off_peak_rate, peak_hours_start, peak_hours_end.",
          default: {},
        },
        optimise_for: {
          type: "string",
          enum: ["cost", "carbon", "comfort"],
          description: "Primary optimisation objective.",
          default: "cost",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "energy_dashboard",
    description:
      "Use when you need a real-time overview of energy consumption, costs, and sustainability KPIs. " +
      "Trigger phrases: 'show energy dashboard', 'energy usage overview', 'utility cost summary', " +
      "'energy KPIs', 'carbon emissions report', 'live energy monitoring'. " +
      "Aggregates data across properties, utilities, and time periods. " +
      "Returns live consumption, cost-to-date, carbon footprint, efficiency score, top saving opportunities, and trend charts.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "Utility account or portfolio ID. Omit to return aggregate view.",
          default: "",
        },
        period: {
          type: "string",
          enum: ["today", "this_week", "this_month", "this_year", "custom"],
          description: "Dashboard time period.",
          default: "this_month",
        },
        include_forecast: {
          type: "boolean",
          description: "Include consumption and cost forecast for the rest of the period.",
          default: true,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 2 — FLEET & LOGISTICS (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "fleet_optimize_route",
    description:
      "Use when you need to calculate the optimal route for one or more vehicles in a fleet. " +
      "Trigger phrases: 'optimise delivery route', 'fastest route for multiple stops', " +
      "'reduce fleet mileage', 'vehicle routing problem', 'last-mile delivery optimisation'. " +
      "Handles multi-stop, time-window, capacity-constrained, and hazmat routing. " +
      "Returns optimised stop order, total distance, ETA per stop, fuel cost estimate, and turn-by-turn directions.",
    inputSchema: {
      type: "object",
      properties: {
        depot: {
          type: "string",
          description: "Starting depot address or coordinates (lat,lng).",
        },
        stops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              address:        { type: "string", description: "Delivery address." },
              time_window:    { type: "string", description: "Acceptable arrival window e.g. '09:00-12:00'." },
              service_mins:   { type: "number", description: "Time in minutes to spend at this stop.", default: 10 },
              priority:       { type: "string", enum: ["high", "normal", "low"], default: "normal" },
            },
          },
          description: "List of delivery stops.",
          default: [],
        },
        vehicle: {
          type: "object",
          description: "Vehicle specs — include type, capacity_kg, fuel_type, max_range_km.",
          default: {},
        },
        optimise_for: {
          type: "string",
          enum: ["distance", "time", "fuel", "emissions"],
          description: "Primary routing objective.",
          default: "time",
        },
      },
      required: ["depot"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "fleet_plan_load",
    description:
      "Use when you need to plan cargo loading across fleet vehicles to maximise capacity and meet delivery constraints. " +
      "Trigger phrases: 'plan vehicle load', 'cargo packing plan', 'load optimisation', " +
      "'freight consolidation', 'vehicle capacity planning', 'bin packing for fleet'. " +
      "Handles weight, volume, fragility, temperature, and hazmat constraints. " +
      "Returns load plan per vehicle, utilisation %, stacking instructions, and unassigned items list.",
    inputSchema: {
      type: "object",
      properties: {
        vehicles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              vehicle_id:     { type: "string" },
              capacity_kg:    { type: "number" },
              volume_m3:      { type: "number" },
              temperature_zone: { type: "string", description: "e.g. 'ambient', 'chilled', 'frozen'" },
            },
          },
          description: "Available vehicles with capacity specs.",
          default: [],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_id:        { type: "string" },
              weight_kg:      { type: "number" },
              volume_m3:      { type: "number" },
              fragile:        { type: "boolean", default: false },
              temperature_req:{ type: "string", description: "Required temperature zone." },
              destination:    { type: "string" },
            },
          },
          description: "Items to load.",
          default: [],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "fleet_predict_maintenance",
    description:
      "Use when you need to predict maintenance needs for fleet vehicles before breakdowns occur. " +
      "Trigger phrases: 'predict vehicle maintenance', 'fleet maintenance schedule', " +
      "'when does the truck need service', 'preventive maintenance plan', 'vehicle health prediction'. " +
      "Handles engines, brakes, tyres, fluids, and telematics data. " +
      "Returns predicted failure dates, recommended service actions, urgency levels, and cost estimates per vehicle.",
    inputSchema: {
      type: "object",
      properties: {
        vehicle_id: {
          type: "string",
          description: "Vehicle ID or registration. Omit to analyse all fleet vehicles.",
          default: "",
        },
        telematics: {
          type: "object",
          description: "Current telematics snapshot — include odometer_km, engine_hours, dtc_codes, last_service_date, fuel_efficiency_trend.",
          default: {},
        },
        maintenance_history: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date:         { type: "string", description: "Service date (ISO 8601)." },
              action:       { type: "string", description: "Service action performed." },
              cost:         { type: "number" },
              odometer_km:  { type: "number" },
            },
          },
          description: "Past maintenance records for the vehicle.",
          default: [],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "fleet_track",
    description:
      "Use when you need to get the real-time location and status of fleet vehicles. " +
      "Trigger phrases: 'where is the truck', 'fleet tracking', 'real-time vehicle location', " +
      "'track delivery driver', 'fleet live map', 'vehicle status update'. " +
      "Handles GPS tracking, geofence alerts, idle detection, and ETA recalculation. " +
      "Returns current coordinates, speed, heading, ETA to next stop, active alerts, and a shareable tracking link.",
    inputSchema: {
      type: "object",
      properties: {
        vehicle_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of vehicle IDs to track. Omit or pass empty array to track all fleet vehicles.",
          default: [],
        },
        include_history: {
          type: "boolean",
          description: "Include last 24h movement history for each vehicle.",
          default: false,
        },
        geofences: {
          type: "array",
          items: { type: "string" },
          description: "Named geofence IDs to check vehicle positions against.",
          default: [],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "fleet_freight_quote",
    description:
      "Use when you need to calculate a freight quote for a shipment. " +
      "Trigger phrases: 'freight quote', 'how much to ship this', 'calculate delivery cost', " +
      "'LTL or FTL quote', 'trucking rate estimate', 'carrier comparison for freight'. " +
      "Handles LTL, FTL, intermodal, refrigerated, and hazmat shipments. " +
      "Returns quotes from multiple carriers, transit times, service levels, and recommended carrier with reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Shipment origin address or city/state.",
        },
        destination: {
          type: "string",
          description: "Shipment destination address or city/state.",
        },
        cargo: {
          type: "object",
          description: "Cargo specs — include weight_kg, dimensions_cm (LxWxH), freight_class, hazmat, temperature_controlled.",
          properties: {
            weight_kg:             { type: "number" },
            dimensions_cm:         { type: "object", properties: { l: { type: "number" }, w: { type: "number" }, h: { type: "number" } } },
            freight_class:         { type: "string", description: "NMFC freight class e.g. '70', '125'." },
            hazmat:                { type: "boolean", default: false },
            temperature_controlled:{ type: "boolean", default: false },
          },
          default: {},
        },
        shipment_type: {
          type: "string",
          enum: ["LTL", "FTL", "intermodal", "expedited"],
          description: "Preferred shipment mode.",
          default: "LTL",
        },
        pickup_date: {
          type: "string",
          description: "Requested pickup date (ISO 8601 YYYY-MM-DD).",
          default: "",
        },
      },
      required: ["origin", "destination"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "fleet_dashboard",
    description:
      "Use when you need a real-time overview of fleet operations, performance, and costs. " +
      "Trigger phrases: 'fleet dashboard', 'fleet performance overview', 'show all vehicles', " +
      "'fleet KPIs', 'logistics operations summary', 'fleet health report'. " +
      "Aggregates vehicle utilisation, route efficiency, fuel costs, maintenance status, and driver performance. " +
      "Returns KPI summary, alerts requiring action, upcoming maintenance schedule, cost breakdown, and utilisation heatmap.",
    inputSchema: {
      type: "object",
      properties: {
        fleet_id: {
          type: "string",
          description: "Fleet or depot ID. Omit for full company fleet view.",
          default: "",
        },
        period: {
          type: "string",
          enum: ["today", "this_week", "this_month", "this_quarter"],
          description: "Reporting period.",
          default: "this_week",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 3 — TAX & ACCOUNTING (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "tax_categorize_expense",
    description:
      "Use when you need to categorise a business or personal expense for accounting or tax purposes. " +
      "Trigger phrases: 'categorise this expense', 'what category is this transaction', " +
      "'classify business expense', 'assign expense to chart of accounts', 'expense coding'. " +
      "Handles receipts, bank transactions, invoices, and card statements. " +
      "Returns category, subcategory, tax deductibility status, confidence score, and chart-of-accounts code.",
    inputSchema: {
      type: "object",
      properties: {
        transaction: {
          type: "object",
          description: "Transaction to categorise — include amount, currency, description, merchant, date, payment_method.",
          properties: {
            amount:         { type: "number" },
            currency:       { type: "string", default: "USD" },
            description:    { type: "string" },
            merchant:       { type: "string" },
            date:           { type: "string", description: "Transaction date (ISO 8601)." },
            payment_method: { type: "string", description: "e.g. 'credit_card', 'bank_transfer', 'cash'" },
          },
        },
        entity_type: {
          type: "string",
          enum: ["sole_proprietor", "LLC", "S-Corp", "C-Corp", "individual"],
          description: "Business or individual entity type (affects deductibility rules).",
          default: "LLC",
        },
        jurisdiction: {
          type: "string",
          description: "Tax jurisdiction (e.g. 'US-CA', 'UK', 'DE') for local rules.",
          default: "US",
        },
      },
      required: ["transaction"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "tax_prepare_return",
    description:
      "Use when you need to prepare a tax return or generate tax filing inputs. " +
      "Trigger phrases: 'prepare my tax return', 'calculate tax owed', 'generate tax filing', " +
      "'estimate tax liability', 'self-assessment tax return', 'corporate tax return prep'. " +
      "Handles individual, small business, and corporate returns for major jurisdictions. " +
      "Returns completed return draft, tax liability, refund or balance due, deductions applied, and e-file ready package.",
    inputSchema: {
      type: "object",
      properties: {
        tax_year: {
          type: "integer",
          description: "Tax year (e.g. 2024).",
        },
        entity_type: {
          type: "string",
          enum: ["individual", "sole_proprietor", "LLC", "S-Corp", "C-Corp", "partnership"],
          description: "Filing entity type.",
          default: "individual",
        },
        income_sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type:   { type: "string", description: "e.g. 'W2', '1099', 'K1', 'rental', 'capital_gains'" },
              amount: { type: "number" },
            },
          },
          description: "Income items to include in the return.",
          default: [],
        },
        deductions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              amount:   { type: "number" },
            },
          },
          description: "Deduction items to apply.",
          default: [],
        },
        jurisdiction: {
          type: "string",
          description: "Tax jurisdiction (e.g. 'US-federal', 'US-CA', 'UK', 'DE').",
          default: "US-federal",
        },
      },
      required: ["tax_year"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "tax_reconcile",
    description:
      "Use when you need to reconcile accounts and ensure books match bank statements or sub-ledgers. " +
      "Trigger phrases: 'reconcile bank account', 'reconcile accounts', 'find unmatched transactions', " +
      "'month-end reconciliation', 'balance sheet reconciliation', 'accounts payable reconciliation'. " +
      "Handles bank, credit card, accounts payable, accounts receivable, and intercompany reconciliations. " +
      "Returns matched pairs, unreconciled items, suggested matches with confidence, and reconciliation summary report.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "Account identifier to reconcile.",
        },
        statement_balance: {
          type: "number",
          description: "Closing balance from the external statement (bank or sub-ledger).",
        },
        book_balance: {
          type: "number",
          description: "Closing balance from the accounting system (GL balance).",
        },
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:      { type: "string" },
              date:    { type: "string" },
              amount:  { type: "number" },
              source:  { type: "string", enum: ["book", "statement"], description: "Which side this transaction comes from." },
              description: { type: "string" },
            },
          },
          description: "All transactions from both sides of the reconciliation.",
          default: [],
        },
        period_end: {
          type: "string",
          description: "Reconciliation period end date (ISO 8601).",
          default: "",
        },
      },
      required: ["account_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "tax_forecast_cashflow",
    description:
      "Use when you need to forecast cash flow and identify upcoming liquidity gaps or surpluses. " +
      "Trigger phrases: 'forecast cash flow', 'predict when we run out of cash', 'cash flow projection', " +
      "'liquidity forecast', '13-week cash forecast', 'runway calculation'. " +
      "Handles recurring revenue, accounts receivable, accounts payable, payroll, and tax obligations. " +
      "Returns week-by-week cash position, minimum balance date, funding gap alerts, and scenario comparisons.",
    inputSchema: {
      type: "object",
      properties: {
        opening_balance: {
          type: "number",
          description: "Current cash balance in the account currency.",
          default: 0,
        },
        inflows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label:       { type: "string" },
              amount:      { type: "number" },
              date:        { type: "string", description: "Expected receipt date (ISO 8601)." },
              probability: { type: "number", description: "Probability 0-1 for uncertain inflows.", default: 1 },
            },
          },
          description: "Expected cash inflows.",
          default: [],
        },
        outflows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label:  { type: "string" },
              amount: { type: "number" },
              date:   { type: "string", description: "Expected payment date (ISO 8601)." },
              recurring: { type: "boolean", default: false },
              frequency: { type: "string", description: "e.g. 'weekly', 'monthly' — only if recurring.", default: "" },
            },
          },
          description: "Expected cash outflows.",
          default: [],
        },
        forecast_weeks: {
          type: "integer",
          description: "Number of weeks to forecast ahead.",
          default: 13,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "tax_deadlines",
    description:
      "Use when you need to check upcoming tax filing and payment deadlines. " +
      "Trigger phrases: 'when is my tax deadline', 'upcoming tax due dates', 'check tax calendar', " +
      "'quarterly estimated tax dates', 'corporate tax filing dates', 'tax compliance calendar'. " +
      "Handles federal, state, and international tax deadlines for all entity types. " +
      "Returns deadline list sorted by urgency, days remaining, applicable forms, extension options, and calendar export link.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["individual", "sole_proprietor", "LLC", "S-Corp", "C-Corp", "partnership", "non_profit"],
          description: "Filing entity type.",
          default: "individual",
        },
        jurisdictions: {
          type: "array",
          items: { type: "string" },
          description: "Tax jurisdictions to check (e.g. ['US-federal', 'US-CA', 'UK']). Defaults to US federal only.",
          default: ["US-federal"],
        },
        fiscal_year_end: {
          type: "string",
          description: "Fiscal year end date (MM-DD) if not December 31.",
          default: "12-31",
        },
        look_ahead_days: {
          type: "integer",
          description: "Number of days ahead to look for deadlines.",
          default: 90,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "tax_financial_statement",
    description:
      "Use when you need to generate a financial statement (P&L, balance sheet, or cash flow statement). " +
      "Trigger phrases: 'generate income statement', 'create balance sheet', 'financial statements', " +
      "'profit and loss report', 'generate cash flow statement', 'GAAP financial report'. " +
      "Handles GAAP, IFRS, and management reporting formats for any entity size. " +
      "Returns formatted financial statement, key ratios, period-over-period variance, and audit-ready footnotes.",
    inputSchema: {
      type: "object",
      properties: {
        statement_type: {
          type: "string",
          enum: ["income_statement", "balance_sheet", "cash_flow_statement", "all"],
          description: "Type of financial statement to generate.",
          default: "income_statement",
        },
        period_start: {
          type: "string",
          description: "Reporting period start (ISO 8601 YYYY-MM-DD).",
        },
        period_end: {
          type: "string",
          description: "Reporting period end (ISO 8601 YYYY-MM-DD).",
        },
        chart_of_accounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              account_code: { type: "string" },
              account_name: { type: "string" },
              balance:      { type: "number" },
              type:         { type: "string", description: "e.g. 'asset', 'liability', 'equity', 'revenue', 'expense'" },
            },
          },
          description: "General ledger balances for the period. Omit to use previously imported data.",
          default: [],
        },
        accounting_standard: {
          type: "string",
          enum: ["GAAP", "IFRS", "management"],
          description: "Reporting standard to apply.",
          default: "GAAP",
        },
      },
      required: ["statement_type"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 4 — AGENT GUARDRAILS (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "guardrails_enforce_policy",
    description:
      "Use when you need to check whether a proposed agent action is permitted under active policies before executing it. " +
      "Trigger phrases: 'check if this action is allowed', 'enforce agent policy', 'is this within my permissions', " +
      "'policy gate for agent action', 'pre-action compliance check', 'agent action guard'. " +
      "Handles spending limits, tool restrictions, data access policies, and rate limits. " +
      "Returns ALLOW or BLOCK decision, matched policy rules, violation reason (if blocked), and suggested compliant alternative.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Identifier of the agent requesting the action.",
        },
        action: {
          type: "object",
          description: "Proposed action — include type, tool_name, arguments, estimated_cost, data_accessed.",
          properties: {
            type:            { type: "string", description: "Action category e.g. 'tool_call', 'data_access', 'spend', 'external_request'" },
            tool_name:       { type: "string", description: "MCP tool name being called (if applicable)." },
            arguments:       { type: "object", description: "Tool arguments or action parameters.", default: {} },
            estimated_cost:  { type: "number", description: "Estimated cost in USD (0 if free).", default: 0 },
            data_accessed:   { type: "array", items: { type: "string" }, description: "Data categories being accessed.", default: [] },
          },
        },
        context: {
          type: "object",
          description: "Optional request context — include session_id, workflow_id, parent_agent_id.",
          default: {},
        },
      },
      required: ["agent_id", "action"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "guardrails_validate_output",
    description:
      "Use when you need to validate an agent's output before it is returned to the user or passed to the next step. " +
      "Trigger phrases: 'validate agent output', 'check output for policy violations', 'output guardrail check', " +
      "'screen agent response for PII', 'output safety check', 'post-processing validation'. " +
      "Handles PII detection, hallucination flags, toxicity screening, format validation, and business rule checks. " +
      "Returns PASS or FAIL verdict, detected issues with severity, redacted-safe version (if requested), and remediation suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Identifier of the agent that produced the output.",
        },
        output: {
          type: "string",
          description: "Raw agent output text to validate.",
        },
        validation_rules: {
          type: "array",
          items: {
            type: "string",
            enum: ["pii_detection", "hallucination_check", "toxicity_screen", "format_validation", "business_rules", "source_grounding"],
          },
          description: "Validation checks to apply. Defaults to all checks.",
          default: ["pii_detection", "hallucination_check", "toxicity_screen"],
        },
        auto_redact: {
          type: "boolean",
          description: "Automatically redact PII from the output.",
          default: false,
        },
      },
      required: ["agent_id", "output"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "guardrails_set_policy",
    description:
      "Use when you need to create or update a guardrail policy for an agent or agent group. " +
      "Trigger phrases: 'set agent policy', 'configure guardrails', 'define spending limit for agent', " +
      "'restrict agent to these tools', 'create compliance policy', 'update agent permissions'. " +
      "Handles spending caps, tool whitelists/blacklists, data access scopes, rate limits, and approval workflows. " +
      "Returns policy ID, effective immediately status, affected agents list, and policy diff vs previous version.",
    inputSchema: {
      type: "object",
      properties: {
        policy_name: {
          type: "string",
          description: "Human-readable policy name.",
        },
        scope: {
          type: "object",
          description: "Scope of the policy — include agent_ids (list) or group_id.",
          properties: {
            agent_ids: { type: "array", items: { type: "string" }, default: [] },
            group_id:  { type: "string", default: "" },
          },
          default: {},
        },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule_type:   { type: "string", enum: ["spending_limit", "tool_restriction", "data_access", "rate_limit", "approval_required", "time_restriction"] },
              parameters:  { type: "object", description: "Rule-specific parameters e.g. { max_usd: 100, period: 'day' } for spending_limit.", default: {} },
              action:      { type: "string", enum: ["block", "flag", "require_approval"], default: "block" },
            },
          },
          description: "Policy rules to enforce.",
          default: [],
        },
        priority: {
          type: "integer",
          description: "Policy priority (lower number = higher priority). Used when multiple policies overlap.",
          default: 100,
        },
      },
      required: ["policy_name", "rules"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "guardrails_dashboard",
    description:
      "Use when you need an overview of guardrail policies, recent violations, and compliance health across all agents. " +
      "Trigger phrases: 'guardrail dashboard', 'policy compliance overview', 'agent violation summary', " +
      "'show guardrail status', 'policy enforcement metrics', 'compliance health check'. " +
      "Aggregates active policies, block rates, top violators, and trend data. " +
      "Returns KPI summary, active policies list, recent violations, block/allow ratios, and risk-ranked agent list.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "this_week", "this_month", "this_quarter"],
          description: "Dashboard time window.",
          default: "this_week",
        },
        filter_agent_id: {
          type: "string",
          description: "Filter dashboard to a specific agent ID. Omit for all agents.",
          default: "",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "guardrails_report_violation",
    description:
      "Use when you need to report a guardrail violation or escalate a policy breach for review. " +
      "Trigger phrases: 'report policy violation', 'escalate agent breach', 'log guardrail violation', " +
      "'flag this agent action', 'report suspicious agent behaviour', 'compliance incident report'. " +
      "Handles automatic and manual violation reports with evidence capture. " +
      "Returns case ID, severity classification, auto-remediation actions taken, escalation path, and estimated review time.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent that committed the violation.",
        },
        violation_type: {
          type: "string",
          description: "Type of violation e.g. 'policy_breach', 'unauthorised_spend', 'data_exfiltration', 'output_manipulation'.",
        },
        evidence: {
          type: "object",
          description: "Evidence payload — include tool_call, arguments, output, timestamp, session_id.",
          default: {},
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Reported severity level.",
          default: "medium",
        },
        auto_suspend: {
          type: "boolean",
          description: "Immediately suspend the agent pending review.",
          default: false,
        },
      },
      required: ["agent_id", "violation_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "guardrails_compliance_report",
    description:
      "Use when you need to generate a formal compliance report for internal audit, regulators, or stakeholders. " +
      "Trigger phrases: 'generate compliance report', 'agent audit report', 'policy adherence report', " +
      "'regulatory compliance summary', 'guardrail effectiveness report', 'SOC2 evidence report'. " +
      "Handles time-bound reporting with full audit trail for all agent actions. " +
      "Returns structured compliance report, pass/fail rates per policy, evidence appendix, and executive summary.",
    inputSchema: {
      type: "object",
      properties: {
        period_start: {
          type: "string",
          description: "Report period start (ISO 8601).",
        },
        period_end: {
          type: "string",
          description: "Report period end (ISO 8601).",
        },
        scope: {
          type: "object",
          description: "Report scope — include agent_ids, policy_ids, or leave empty for full platform.",
          default: {},
        },
        format: {
          type: "string",
          enum: ["summary", "detailed", "audit_trail", "executive"],
          description: "Report format.",
          default: "summary",
        },
        include_evidence: {
          type: "boolean",
          description: "Attach full evidence records for each violation.",
          default: false,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 5 — AGENT BENCHMARKING (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "benchmark_create_suite",
    description:
      "Use when you need to create a test suite to evaluate agent capabilities and performance. " +
      "Trigger phrases: 'create benchmark suite', 'set up agent tests', 'build eval test cases', " +
      "'define agent evaluation criteria', 'create LLM eval suite', 'agent capability test set'. " +
      "Handles task-based, adversarial, regression, and golden-dataset test types. " +
      "Returns suite ID, test case count, coverage breakdown by capability, and estimated run time.",
    inputSchema: {
      type: "object",
      properties: {
        suite_name: {
          type: "string",
          description: "Name for the test suite.",
        },
        test_cases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:               { type: "string" },
              description:      { type: "string", description: "What this test case evaluates." },
              input:            { type: "string", description: "Input prompt or task for the agent." },
              expected_output:  { type: "string", description: "Expected agent response or behaviour." },
              evaluation_method:{ type: "string", enum: ["exact_match", "semantic_similarity", "rubric", "llm_judge", "tool_call_check"], default: "semantic_similarity" },
              weight:           { type: "number", description: "Relative weight of this test case in the final score.", default: 1 },
              tags:             { type: "array", items: { type: "string" }, default: [] },
            },
          },
          description: "Test cases to include in the suite.",
          default: [],
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Capability areas covered by this suite e.g. ['reasoning', 'tool_use', 'memory', 'safety'].",
          default: [],
        },
        auto_generate: {
          type: "boolean",
          description: "Auto-generate additional test cases using the provided ones as seeds.",
          default: false,
        },
      },
      required: ["suite_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },


  {
    name: "benchmark_evaluate",
    description:
      "Use when you need to evaluate the quality of a specific agent output against expected criteria. " +
      "Trigger phrases: 'evaluate this agent output', 'score this response', 'judge agent answer', " +
      "'is this output correct', 'rate agent performance', 'LLM output evaluation'. " +
      "Handles exact match, semantic similarity, rubric scoring, and LLM-as-judge evaluation. " +
      "Returns score (0-100), pass/fail, dimension-level breakdown, explanation, and improvement suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "The original prompt or task given to the agent.",
        },
        actual_output: {
          type: "string",
          description: "The agent's actual response.",
        },
        expected_output: {
          type: "string",
          description: "Expected or ideal response (reference answer).",
          default: "",
        },
        evaluation_method: {
          type: "string",
          enum: ["exact_match", "semantic_similarity", "rubric", "llm_judge", "tool_call_check"],
          description: "Evaluation method to apply.",
          default: "llm_judge",
        },
        rubric: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion:  { type: "string" },
              weight:     { type: "number", default: 1 },
              max_score:  { type: "number", default: 10 },
            },
          },
          description: "Rubric criteria (required when evaluation_method is 'rubric').",
          default: [],
        },
      },
      required: ["input", "actual_output"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },


  {
    name: "benchmark_history",
    description:
      "Use when you need to review historical benchmark results and track agent performance over time. " +
      "Trigger phrases: 'show benchmark history', 'agent performance over time', 'regression test results', " +
      "'how has performance changed', 'benchmark trend', 'eval run history'. " +
      "Handles run-level and test-case-level history with regression detection. " +
      "Returns run list with scores and dates, performance trend chart data, regressions detected, and best/worst runs.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to fetch history for. Omit to see all agents.",
          default: "",
        },
        suite_id: {
          type: "string",
          description: "Filter by test suite ID.",
          default: "",
        },
        limit: {
          type: "integer",
          description: "Maximum number of historical runs to return.",
          default: 20,
        },
        detect_regressions: {
          type: "boolean",
          description: "Automatically flag score regressions between runs.",
          default: true,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "benchmark_report",
    description:
      "Use when you need to generate a formatted benchmark report to share with stakeholders. " +
      "Trigger phrases: 'generate benchmark report', 'export eval results', 'agent performance report', " +
      "'create benchmarking summary', 'share eval results', 'model evaluation report'. " +
      "Handles single-run, comparative, and longitudinal report formats. " +
      "Returns structured report with executive summary, detailed findings, charts, methodology, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        run_ids: {
          type: "array",
          items: { type: "string" },
          description: "Benchmark run IDs to include in the report.",
          default: [],
        },
        report_type: {
          type: "string",
          enum: ["single_run", "comparison", "longitudinal"],
          description: "Type of report to generate.",
          default: "single_run",
        },
        format: {
          type: "string",
          enum: ["summary", "detailed", "executive", "technical"],
          description: "Report detail level.",
          default: "summary",
        },
        include_raw_data: {
          type: "boolean",
          description: "Append raw per-test-case results as an appendix.",
          default: false,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 6 — ADVANCED OBSERVABILITY (6 tools)
  // ───────────────────────────────────────────────────────────────────────────

  {
    name: "observability_create_monitor",
    description:
      "Use when you need to create a new monitor to track a metric, service, or agent workflow. " +
      "Trigger phrases: 'create monitor', 'set up monitoring for this service', 'add observability monitor', " +
      "'monitor this metric', 'set up uptime check', 'create performance monitor'. " +
      "Handles APM, infrastructure, agent workflow, and custom metric monitors. " +
      "Returns monitor ID, check interval, initial baseline measurement, and activation status.",
    inputSchema: {
      type: "object",
      properties: {
        monitor_name: {
          type: "string",
          description: "Human-readable monitor name.",
        },
        monitor_type: {
          type: "string",
          enum: ["uptime", "latency", "error_rate", "throughput", "custom_metric", "agent_workflow", "llm_cost"],
          description: "Type of monitor to create.",
          default: "uptime",
        },
        target: {
          type: "object",
          description: "What to monitor — include url, service_name, agent_id, metric_name depending on monitor_type.",
          properties: {
            url:          { type: "string", description: "URL for uptime/latency monitors." },
            service_name: { type: "string", description: "Service name for APM monitors." },
            agent_id:     { type: "string", description: "Agent ID for agent workflow monitors." },
            metric_name:  { type: "string", description: "Custom metric name." },
          },
          default: {},
        },
        check_interval_seconds: {
          type: "integer",
          description: "How often to check the target in seconds.",
          default: 60,
        },
        thresholds: {
          type: "object",
          description: "Alert thresholds — include warning and critical levels for the monitored metric.",
          default: {},
        },
      },
      required: ["monitor_name", "monitor_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "observability_metrics",
    description:
      "Use when you need to retrieve metrics for a service, agent, or infrastructure component. " +
      "Trigger phrases: 'get metrics', 'show me performance data', 'retrieve telemetry', " +
      "'agent latency metrics', 'error rate over last hour', 'throughput metrics'. " +
      "Handles time-series queries, aggregations, and multi-dimensional filtering. " +
      "Returns metric time series, aggregated stats (p50/p95/p99), anomaly flags, and comparison to baseline.",
    inputSchema: {
      type: "object",
      properties: {
        metric_names: {
          type: "array",
          items: { type: "string" },
          description: "Metric names to retrieve (e.g. ['latency_ms', 'error_rate', 'token_count']).",
          default: [],
        },
        filters: {
          type: "object",
          description: "Dimension filters e.g. { service: 'payment-agent', environment: 'production' }.",
          default: {},
        },
        time_range: {
          type: "object",
          description: "Time range — include start (ISO 8601) and end (ISO 8601), or use relative: '1h', '24h', '7d'.",
          properties: {
            start:    { type: "string" },
            end:      { type: "string" },
            relative: { type: "string", description: "e.g. '1h', '6h', '24h', '7d'", default: "1h" },
          },
          default: { relative: "1h" },
        },
        aggregation: {
          type: "string",
          enum: ["avg", "sum", "min", "max", "count", "p50", "p95", "p99"],
          description: "Aggregation function to apply.",
          default: "avg",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "observability_detect_drift",
    description:
      "Use when you need to detect whether an agent's behaviour or a service's performance has drifted from its baseline. " +
      "Trigger phrases: 'detect performance drift', 'has this agent changed behaviour', 'model drift detection', " +
      "'latency degradation check', 'spot regression in agent output', 'statistical drift alert'. " +
      "Handles statistical drift (mean shift, variance change) and semantic drift in agent outputs. " +
      "Returns drift detected flag, drift magnitude, affected metrics, likely root cause signals, and recommended actions.",
    inputSchema: {
      type: "object",
      properties: {
        target_id: {
          type: "string",
          description: "Service name or agent ID to check for drift.",
        },
        baseline_period: {
          type: "object",
          description: "Baseline time window — include start and end dates (ISO 8601).",
          properties: {
            start: { type: "string" },
            end:   { type: "string" },
          },
          default: {},
        },
        comparison_period: {
          type: "object",
          description: "Current time window to compare against baseline.",
          properties: {
            start: { type: "string" },
            end:   { type: "string" },
          },
          default: {},
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metrics to run drift detection on. Defaults to all available metrics.",
          default: [],
        },
        sensitivity: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Drift detection sensitivity level.",
          default: "medium",
        },
      },
      required: ["target_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "observability_root_cause",
    description:
      "Use when you need to identify the root cause of an incident, alert, or performance anomaly. " +
      "Trigger phrases: 'root cause analysis', 'why is latency high', 'investigate this alert', " +
      "'find the cause of this outage', 'diagnose agent failure', 'trace back the error'. " +
      "Correlates logs, traces, metrics, and events to surface the most likely root cause. " +
      "Returns ranked root cause hypotheses with confidence scores, supporting evidence, impact radius, and fix recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: {
          type: "string",
          description: "Incident or alert ID to investigate. Use either this or describe the symptom directly.",
          default: "",
        },
        symptom: {
          type: "string",
          description: "Free-text description of the issue (e.g. 'error rate spiked to 40% on payment service at 14:30').",
          default: "",
        },
        time_of_incident: {
          type: "string",
          description: "Approximate time the incident started (ISO 8601).",
          default: "",
        },
        services_involved: {
          type: "array",
          items: { type: "string" },
          description: "Services or agents suspected to be involved.",
          default: [],
        },
        look_back_minutes: {
          type: "integer",
          description: "How many minutes before the incident to analyse for correlated changes.",
          default: 60,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "observability_set_alert",
    description:
      "Use when you need to configure an alert rule that will fire when a metric crosses a threshold. " +
      "Trigger phrases: 'set up alert', 'create alert rule', 'notify me when error rate is high', " +
      "'configure paging threshold', 'add latency alert', 'set SLO breach alert'. " +
      "Handles threshold, anomaly-based, and SLO burn-rate alert types with multiple notification channels. " +
      "Returns alert ID, preview of current metric vs threshold, next evaluation time, and notification channel confirmations.",
    inputSchema: {
      type: "object",
      properties: {
        alert_name: {
          type: "string",
          description: "Human-readable alert name.",
        },
        metric: {
          type: "string",
          description: "Metric to alert on (e.g. 'error_rate', 'latency_p99_ms', 'token_cost_usd').",
        },
        condition: {
          type: "object",
          description: "Alert condition — include operator ('>', '<', '>=', '<=', '!='), threshold value, and evaluation_window_minutes.",
          properties: {
            operator:                { type: "string", enum: [">", "<", ">=", "<=", "!="], default: ">" },
            threshold:               { type: "number" },
            evaluation_window_minutes: { type: "integer", default: 5 },
          },
        },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical", "page"],
          description: "Alert severity level.",
          default: "warning",
        },
        channels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type:    { type: "string", enum: ["email", "slack", "pagerduty", "webhook"], default: "email" },
              target:  { type: "string", description: "Email address, Slack channel, PagerDuty key, or webhook URL." },
            },
          },
          description: "Notification channels for the alert.",
          default: [],
        },
      },
      required: ["alert_name", "metric", "condition"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "observability_dashboard",
    description:
      "Use when you need a unified real-time observability dashboard across services, agents, and infrastructure. " +
      "Trigger phrases: 'observability dashboard', 'system health overview', 'show all monitors', " +
      "'service health dashboard', 'agent telemetry overview', 'ops dashboard'. " +
      "Aggregates uptime, latency, error rates, costs, and active alerts in one view. " +
      "Returns system health score, active alert list, top anomalies, service dependency map, and cost burn rate.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "object",
          description: "Dashboard scope filter — include service_names, agent_ids, or environments (e.g. ['production']).",
          default: {},
        },
        time_window: {
          type: "string",
          description: "Time window for metrics aggregation.",
          enum: ["15m", "1h", "6h", "24h", "7d"],
          default: "1h",
        },
        include_traces: {
          type: "boolean",
          description: "Include distributed trace summary in the dashboard.",
          default: false,
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * handlePhase10Tool
 *
 * Routes a tool call to the appropriate Phase 10 service function.
 *
 * @param {string} name   - Tool name (e.g. "energy_analyze_bill")
 * @param {object} args   - Tool arguments from the MCP call
 * @returns {*}           - Result from the underlying service module
 * @throws {Error}        - If the tool name is unrecognised
 */
export function handlePhase10Tool(name, args = {}) {
  switch (name) {

    // ── Energy & Utilities ────────────────────────────────────────────────────
    case "energy_analyze_bill":
      return analyzeEnergyBill(args.bill_data ?? {}, args.location ?? "");

    case "energy_compare_providers":
      return compareEnergyProviders(
        args.location ?? "",
        args.utility_type ?? "electricity",
        args.annual_usage_kwh ?? 10000,
        args.property_type ?? "residential",
        args.preferences ?? {}
      );

    case "energy_forecast":
      return forecastConsumption(
        args.historical_usage ?? [],
        args.forecast_months ?? 12,
        args.location ?? "",
        args.adjustments ?? {}
      );

    case "energy_audit_efficiency":
      return auditEnergyEfficiency(
        args.property_details ?? {},
        args.current_usage_kwh ?? 0,
        args.include_renewables ?? true
      );

    case "energy_optimize_schedule":
      return optimizeSchedule(
        args.devices ?? [],
        args.tariff ?? {},
        args.optimise_for ?? "cost"
      );

    case "energy_dashboard":
      return getEnergyDashboard(
        args.account_id ?? "",
        args.period ?? "this_month",
        args.include_forecast ?? true
      );

    // ── Fleet & Logistics ─────────────────────────────────────────────────────
    case "fleet_optimize_route":
      return optimizeRoute(
        args.depot ?? "",
        args.stops ?? [],
        args.vehicle ?? {},
        args.optimise_for ?? "time"
      );

    case "fleet_plan_load":
      return planLoad(
        args.vehicles ?? [],
        args.items ?? {}
      );

    case "fleet_predict_maintenance":
      return predictMaintenance(
        args.vehicle_id ?? "",
        args.telematics ?? {},
        args.maintenance_history ?? []
      );

    case "fleet_track":
      return trackFleet(
        args.vehicle_ids ?? [],
        args.include_history ?? false,
        args.geofences ?? []
      );

    case "fleet_freight_quote":
      return calculateFreightQuote(
        args.origin ?? "",
        args.destination ?? "",
        args.cargo ?? {},
        args.shipment_type ?? "LTL",
        args.pickup_date ?? ""
      );

    case "fleet_dashboard":
      return getFleetDashboard(
        args.fleet_id ?? "",
        args.period ?? "this_week"
      );

    // ── Tax & Accounting ──────────────────────────────────────────────────────
    case "tax_categorize_expense":
      return categorizeExpense(
        args.transaction ?? {},
        args.entity_type ?? "LLC",
        args.jurisdiction ?? "US"
      );

    case "tax_prepare_return":
      return prepareTaxReturn(
        args.tax_year,
        args.entity_type ?? "individual",
        args.income_sources ?? [],
        args.deductions ?? [],
        args.jurisdiction ?? "US-federal"
      );

    case "tax_reconcile":
      return reconcileAccounts(
        args.account_id ?? "",
        args.statement_balance ?? 0,
        args.book_balance ?? 0,
        args.transactions ?? [],
        args.period_end ?? ""
      );

    case "tax_forecast_cashflow":
      return forecastCashFlow(
        args.opening_balance ?? 0,
        args.inflows ?? [],
        args.outflows ?? [],
        args.forecast_weeks ?? 13
      );

    case "tax_deadlines":
      return checkTaxDeadlines(
        args.entity_type ?? "individual",
        args.jurisdictions ?? ["US-federal"],
        args.fiscal_year_end ?? "12-31",
        args.look_ahead_days ?? 90
      );

    case "tax_financial_statement":
      return generateFinancialStatement(
        args.statement_type ?? "income_statement",
        args.period_start ?? "",
        args.period_end ?? "",
        args.chart_of_accounts ?? [],
        args.accounting_standard ?? "GAAP"
      );

    // ── Agent Guardrails ──────────────────────────────────────────────────────
    case "guardrails_enforce_policy":
      return enforcePolicy(
        args.agent_id ?? "",
        args.action ?? {},
        args.context ?? {}
      );

    case "guardrails_validate_output":
      return validateOutput(
        args.agent_id ?? "",
        args.output ?? "",
        args.validation_rules ?? ["pii_detection", "hallucination_check", "toxicity_screen"],
        args.auto_redact ?? false
      );

    case "guardrails_set_policy":
      return setPolicy(
        args.policy_name ?? "",
        args.scope ?? {},
        args.rules ?? [],
        args.priority ?? 100
      );

    case "guardrails_dashboard":
      return getGuardrailDashboard(
        args.period ?? "this_week",
        args.filter_agent_id ?? ""
      );

    case "guardrails_report_violation":
      return reportViolation(
        args.agent_id ?? "",
        args.violation_type ?? "",
        args.evidence ?? {},
        args.severity ?? "medium",
        args.auto_suspend ?? false
      );

    case "guardrails_compliance_report":
      return getComplianceReport(
        args.period_start ?? "",
        args.period_end ?? "",
        args.scope ?? {},
        args.format ?? "summary",
        args.include_evidence ?? false
      );

    // ── Agent Benchmarking ────────────────────────────────────────────────────
    case "benchmark_create_suite":
      return createTestSuite(
        args.suite_name ?? "",
        args.test_cases ?? [],
        args.capabilities ?? [],
        args.auto_generate ?? false
      );

    case "benchmark_run":
      return runBenchmark(
        args.suite_id ?? "",
        args.agent_id ?? "",
        args.agent_config ?? {},
        args.sample_size ?? 0,
        args.parallel ?? true
      );

    case "benchmark_evaluate":
      return evaluateOutput(
        args.input ?? "",
        args.actual_output ?? "",
        args.expected_output ?? "",
        args.evaluation_method ?? "llm_judge",
        args.rubric ?? []
      );

    case "benchmark_compare_agents":
      return compareAgents(
        args.suite_id ?? "",
        args.agent_ids ?? [],
        args.dimensions ?? ["accuracy", "latency", "cost"],
        args.run_fresh ?? false
      );

    case "benchmark_history":
      return getTestHistory(
        args.agent_id ?? "",
        args.suite_id ?? "",
        args.limit ?? 20,
        args.detect_regressions ?? true
      );

    case "benchmark_report":
      return generateTestReport(
        args.run_ids ?? [],
        args.report_type ?? "single_run",
        args.format ?? "summary",
        args.include_raw_data ?? false
      );

    // ── Advanced Observability ────────────────────────────────────────────────
    case "observability_create_monitor":
      return createMonitor(
        args.monitor_name ?? "",
        args.monitor_type ?? "uptime",
        args.target ?? {},
        args.check_interval_seconds ?? 60,
        args.thresholds ?? {}
      );

    case "observability_metrics":
      return getMetrics(
        args.metric_names ?? [],
        args.filters ?? {},
        args.time_range ?? { relative: "1h" },
        args.aggregation ?? "avg"
      );

    case "observability_detect_drift":
      return detectDrift(
        args.target_id ?? "",
        args.baseline_period ?? {},
        args.comparison_period ?? {},
        args.metrics ?? [],
        args.sensitivity ?? "medium"
      );

    case "observability_root_cause":
      return getRootCause(
        args.incident_id ?? "",
        args.symptom ?? "",
        args.time_of_incident ?? "",
        args.services_involved ?? [],
        args.look_back_minutes ?? 60
      );

    case "observability_set_alert":
      return setAlert(
        args.alert_name ?? "",
        args.metric ?? "",
        args.condition ?? {},
        args.severity ?? "warning",
        args.channels ?? []
      );

    case "observability_dashboard":
      return getObservabilityDashboard(
        args.scope ?? {},
        args.time_window ?? "1h",
        args.include_traces ?? false
      );

    default:
      throw new Error(`Unknown phase10 tool: ${name}`);
  }
}
