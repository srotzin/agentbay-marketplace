/**
 * HiveAgent MCP Tool Definitions — Phase 70
 *
 * Phase 70 — Smart Home Automation + Sports Odds Utilities
 *
 * Total new tools: 6
 */

import {
  homeSuggestAutomations,
  homeGenerateRoutineSpec,
  homeSafetyCheck,
} from "./services/smart-home-automation.js";

import {
  oddsConvert,
  oddsParlay,
  oddsBetSlipCheck,
} from "./services/sports-betting-odds.js";

export const phase70Tools = [
  // ── Smart Home Automation ────────────────────────────────────────────────
  {
    name: "home_suggest_automations",
    description:
      "Suggest common smart-home automations based on an inventory of devices and a goal (energy, security, convenience).",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Optimization goal (e.g., energy, security, convenience)" },
        constraints: { type: "array", items: { type: "string" }, description: "Constraints (e.g., privacy, no-cloud)" },
        devices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              room: { type: "string" },
              type: { type: "string" },
              capabilities: { type: "array", items: { type: "string" } },
              protocols: { type: "array", items: { type: "string" } },
            },
            required: ["name"],
          },
        },
      },
      required: ["devices"],
    },
  },
  {
    name: "home_generate_routine_spec",
    description:
      "Generate a portable routine spec (trigger + actions) that you can map onto Home Assistant, Alexa, or Google Home.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        trigger: { type: "object", description: "Trigger object (e.g., {type: 'time_of_day', at: '22:00'})" },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              device: { type: "string" },
              action: { type: "string" },
              value: {},
              delay_seconds: { type: "number" },
            },
            required: ["device", "action"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "home_safety_check",
    description:
      "Check a routine spec for common safety issues (e.g., unlock actions, utility shutoffs) and return recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        routine: { type: "object", description: "Routine spec from home_generate_routine_spec" },
      },
      required: ["routine"],
    },
  },

  // ── Sports Odds Utilities ────────────────────────────────────────────────
  {
    name: "odds_convert",
    description:
      "Convert between American and decimal odds and compute implied probability.",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["american", "decimal"], default: "american" },
        value: { description: "Odds value (e.g., -110 or 1.91)" },
      },
      required: ["value"],
    },
  },
  {
    name: "odds_parlay",
    description:
      "Compute parlay odds and implied probability for a set of legs (assumes independence).",
    inputSchema: {
      type: "object",
      properties: {
        legs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              format: { type: "string", enum: ["american", "decimal"], default: "american" },
              value: {},
            },
            required: ["value"],
          },
        },
      },
      required: ["legs"],
    },
  },
  {
    name: "odds_betslip_check",
    description:
      "Sanity-check a bet slip: stake + odds => potential payout, profit, and implied probability.",
    inputSchema: {
      type: "object",
      properties: {
        stake: { type: "number" },
        format: { type: "string", enum: ["american", "decimal"], default: "american" },
        odds: {},
      },
      required: ["stake", "odds"],
    },
  },
];

export async function handlePhase70Tool(name, args) {
  switch (name) {
    case "home_suggest_automations":
      return homeSuggestAutomations(args);
    case "home_generate_routine_spec":
      return homeGenerateRoutineSpec(args);
    case "home_safety_check":
      return homeSafetyCheck(args);

    case "odds_convert":
      return oddsConvert(args);
    case "odds_parlay":
      return oddsParlay(args);
    case "odds_betslip_check":
      return oddsBetSlipCheck(args);

    default:
      throw new Error(`Unknown Phase 70 tool: ${name}`);
  }
}
