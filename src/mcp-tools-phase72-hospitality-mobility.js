/**
 * HiveAgent MCP Tool Definitions — Phase 72
 *
 * Phase 72 — Restaurant Operations + Mobility Operations
 *
 * Total new tools: 6
 */

import {
  restaurantParSheet,
  restaurantShiftPlanner,
  restaurantMenuEngineering,
} from "./services/restaurant-operations.js";

import {
  mobilityFleetSizing,
  mobilityDriverPayEstimate,
  mobilityTripPricing,
} from "./services/mobility-operations.js";

export const phase72Tools = [
  // ── Restaurant Operations ────────────────────────────────────────────────
  {
    name: "restaurant_par_sheet",
    description:
      "Compute a restaurant par sheet (suggested prep/order quantities) from on-hand, incoming, and demand forecast.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", default: 1, description: "Days of coverage to plan for" },
        waste_buffer_pct: { type: "number", default: 0.05, description: "Extra prep/order fraction (e.g., 0.05 for 5%)" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              unit: { type: "string", default: "unit" },
              on_hand: { type: "number", default: 0 },
              incoming: { type: "number", default: 0 },
              daily_usage_forecast: { type: "number", default: 0 },
            },
            required: ["name", "daily_usage_forecast"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "restaurant_shift_planner",
    description:
      "Create a staffing plan per day-part given cover forecasts and per-role throughput.",
    inputSchema: {
      type: "object",
      properties: {
        day_parts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              start: { type: "string", description: "HH:MM" },
              end: { type: "string", description: "HH:MM" },
              covers_forecast: { type: "number", default: 0 },
              cover_buffer_pct: { type: "number", default: 0.1 },
            },
            required: ["name", "covers_forecast"],
          },
        },
        roles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              covers_per_staff: { type: "number" },
              min_staff: { type: "number", default: 0 },
            },
            required: ["role", "covers_per_staff"],
          },
        },
      },
      required: ["day_parts", "roles"],
    },
  },
  {
    name: "restaurant_menu_engineering",
    description:
      "Compute unit economics for menu items (labor + ingredient costs, gross profit, food cost percent).",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              price: { type: "number" },
              ingredient_cost: { type: "number" },
              labor_minutes: { type: "number", default: 0 },
              labor_rate_per_hour: { type: "number", default: 0 },
            },
            required: ["name", "price", "ingredient_cost"],
          },
        },
      },
      required: ["items"],
    },
  },

  // ── Mobility Operations ──────────────────────────────────────────────────
  {
    name: "mobility_fleet_sizing",
    description:
      "Estimate required active vehicles (or drivers) given demand, average trip length, operating window, and utilization.",
    inputSchema: {
      type: "object",
      properties: {
        demand_trips: { type: "number", default: 0 },
        avg_trip_minutes: { type: "number" },
        ops_window_minutes: { type: "number" },
        utilization: { type: "number", default: 0.75 },
      },
      required: ["avg_trip_minutes", "ops_window_minutes"],
    },
  },
  {
    name: "mobility_driver_pay_estimate",
    description:
      "Estimate driver pay and platform fee for an hourly + per-mile compensation model.",
    inputSchema: {
      type: "object",
      properties: {
        hours: { type: "number", default: 0 },
        miles: { type: "number", default: 0 },
        hourly_rate: { type: "number", default: 0 },
        per_mile_rate: { type: "number", default: 0 },
        platform_fee_pct: { type: "number", default: 0 },
      },
    },
  },
  {
    name: "mobility_trip_pricing",
    description:
      "Compute rider fare from base/minute/mile components plus surge multiplier and booking fee.",
    inputSchema: {
      type: "object",
      properties: {
        base_fare: { type: "number", default: 0 },
        minutes: { type: "number", default: 0 },
        miles: { type: "number", default: 0 },
        per_minute: { type: "number", default: 0 },
        per_mile: { type: "number", default: 0 },
        surge_multiplier: { type: "number", default: 1 },
        booking_fee: { type: "number", default: 0 },
      },
    },
  },
];

export async function handlePhase72Tool(name, args) {
  switch (name) {
    case "restaurant_par_sheet":
      return restaurantParSheet(args);
    case "restaurant_shift_planner":
      return restaurantShiftPlanner(args);
    case "restaurant_menu_engineering":
      return restaurantMenuEngineering(args);

    case "mobility_fleet_sizing":
      return mobilityFleetSizing(args);
    case "mobility_driver_pay_estimate":
      return mobilityDriverPayEstimate(args);
    case "mobility_trip_pricing":
      return mobilityTripPricing(args);

    default:
      throw new Error(`Unknown Phase 72 tool: ${name}`);
  }
}
