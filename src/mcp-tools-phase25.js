/**
 * Phase 25 — Gaming & Esports + Space Operations
 *
 * 11 tools covering two under-served verticals:
 *
 *   Gaming & Esports (5 tools)
 *   ├── gaming.create_event
 *   ├── gaming.start_event
 *   ├── gaming.file_anti_cheat_report
 *   ├── gaming.quote_creator_payout
 *   └── gaming.create_creator_payout
 *
 *   Space Operations (6 tools)
 *   ├── space.propose_launch_window
 *   ├── space.create_launch_window
 *   ├── space.propose_ground_pass
 *   ├── space.schedule_ground_pass
 *   ├── space.file_anomaly
 *   └── space.triage_anomaly
 */

import {
  createEsportsEvent,
  startEsportsEvent,
  fileAntiCheatReport,
  quoteCreatorPayout,
  createCreatorPayout,
} from "./services/gaming-esports.js";

import {
  proposeLaunchWindow,
  createLaunchWindow,
  proposeGroundPass,
  scheduleGroundPass,
  fileSpaceAnomaly,
  triageSpaceAnomaly,
} from "./services/space-operations.js";

export const phase25Tools = [
  // ─── Gaming & Esports ───────────────────────────────────────────────────────
  {
    name: "gaming.create_event",
    description: "Create an esports tournament event with bracket format and default anti-cheat rules.",
    parameters: {
      type: "object",
      properties: {
        orgName: { type: "string", description: "Tournament organizer name (seed: Nova Arena, Koi League)." },
        title: { type: "string", description: "Event title." },
        gameTitle: { type: "string", description: "Game title (e.g., Valorant, CS2)." },
        bracketFormat: { type: "string", enum: ["single_elim","double_elim","swiss","round_robin","custom"], default: "single_elim" },
        durationHours: { type: "number", default: 6 },
      },
      required: ["orgName","title","gameTitle"],
    },
    handler: async ({ orgName, title, gameTitle, bracketFormat, durationHours }) =>
      createEsportsEvent(orgName, title, gameTitle, bracketFormat, durationHours),,
    inputSchema: { type: "object", properties: {}, required: [],
    inputSchema: { type: "object", properties: {}, required: [] }
  }
  },
  {
    name: "gaming.start_event",
    description: "Mark an esports event as live.",
    parameters: {
      type: "object",
      properties: { eventId: { type: "string",
    inputSchema: { type: "object", properties: {}, required: [] }
  } },
      required: ["eventId"],
    },
    handler: async ({ eventId }) => startEsportsEvent(eventId),
  },
  {
    name: "gaming.file_anti_cheat_report",
    description: "File an anti-cheat signal report for a player in an event.",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string" },
        playerHandle: { type: "string" },
        signalType: { type: "string", enum: ["aim_assist","wallhack","macro","lag_switch","smurfing","account_share","other"] },
        severity: { type: "string", enum: ["low","medium","high","critical"], default: "medium" },
        evidenceLinks: { type: "array", items: { type: "string" }, default: [] },
        notes: { type: "string", default: "" },
      },
      required: ["eventId","playerHandle","signalType"],
    },
    handler: async ({ eventId, playerHandle, signalType, severity, evidenceLinks, notes }) =>
      fileAntiCheatReport(eventId, playerHandle, signalType, severity, evidenceLinks, notes),
  },
  {
    name: "gaming.quote_creator_payout",
    description: "Quote creator payout net/gross with fees (basis points model).",
    parameters: {
      type: "object",
      properties: {
        grossUsd: { type: "number" },
        feeBps: { type: "number", default: 250 },,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
      required: ["grossUsd"],
    },
    handler: async ({ grossUsd, feeBps }) => quoteCreatorPayout(grossUsd, feeBps),
  },
  {
    name: "gaming.create_creator_payout",
    description: "Record a creator payout request for an org and period.",
    parameters: {
      type: "object",
      properties: {
        orgName: { type: "string" },
        creatorHandle: { type: "string" },
        periodStartIso: { type: "string" },
        periodEndIso: { type: "string" },
        grossUsd: { type: "number" },
        payoutMethod: { type: "string", enum: ["bank","stablecoin","paypal","platform_wallet"], default: "bank" },
      },
      required: ["orgName","creatorHandle","periodStartIso","periodEndIso","grossUsd"],
    },
    handler: async ({ orgName, creatorHandle, periodStartIso, periodEndIso, grossUsd, payoutMethod }) =>
      createCreatorPayout(orgName, creatorHandle, periodStartIso, periodEndIso, grossUsd, payoutMethod),,
    inputSchema: { type: "object", properties: {}, required: [] }
  },

  // ─── Space Operations ───────────────────────────────────────────────────────
  {
    name: "space.propose_launch_window",
    description: "Propose a near-term launch window for a mission at a site.",
    parameters: {
      type: "object",
      properties: {
        missionName: { type: "string", description: "Seed: Aurora-1, Kepler Relay." },
        site: { type: "string",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
        durationMinutes: { type: "number", default: 120 },,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
      required: ["missionName","site"],
    },
    handler: async ({ missionName, site, durationMinutes }) => proposeLaunchWindow(missionName, site, durationMinutes),
  },
  {
    name: "space.create_launch_window",
    description: "Create a launch window record for a mission.",
    parameters: {
      type: "object",
      properties: {
        missionName: { type: "string" },
        site: { type: "string" },
        opensAtIso: { type: "string" },
        closesAtIso: { type: "string" },
        probabilityGo: { type: "number", default: 0.7,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
        constraints: { type: "object", default: {} },
      },
      required: ["missionName","site","opensAtIso","closesAtIso"],
    },
    handler: async ({ missionName, site, opensAtIso, closesAtIso, probabilityGo, constraints }) =>
      createLaunchWindow(missionName, site, opensAtIso, closesAtIso, probabilityGo, constraints),
  },
  {
    name: "space.propose_ground_pass",
    description: "Propose a near-term ground station pass for a mission.",
    parameters: {
      type: "object",
      properties: {
        missionName: { type: "string" },
        stationName: { type: "string", description: "Seed: Mojave Ground, Troll Station." },
        purpose: { type: "string", enum: ["telemetry","command","payload","testing","emergency"], default: "telemetry" },,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
      required: ["missionName","stationName"],
    },
    handler: async ({ missionName, stationName, purpose }) => proposeGroundPass(missionName, stationName, purpose),
  },
  {
    name: "space.schedule_ground_pass",
    description: "Schedule a ground station pass.",
    parameters: {
      type: "object",
      properties: {
        missionName: { type: "string" },
        stationName: { type: "string" },
        passStartIso: { type: "string" },
        passEndIso: { ,
    inputSchema: { type: "object", properties: {}, required: [] }
  }type: "string" },
        purpose: { type: "string", enum: ["telemetry","command","payload","testing","emergency"], default: "telemetry" },
        priority: { type: "string", enum: ["low","normal","high","critical"], default: "normal" },
      },
      required: ["missionName","stationName","passStartIso","passEndIso"],
    },
    handler: async ({ missionName, stationName, passStartIso, passEndIso, purpose, priority }) =>
      scheduleGroundPass(missionName, stationName, passStartIso, passEndIso, purpose, priority),
  },
  {
    name: "space.file_anomaly",
    description: "File an anomaly for mission triage.",
    parameters: {
      type: "object",
      properties: {
        missionName: { type: "string" },
        subsystem: { type: "string" },
        description: { type: "string" },
        severity: { type: "string", enum: ["low","medium","high","critical"], default: "medium" },
        suspectedCause: { type: "string", default: "" },
      },
      required: ["missionName","subsystem","description"],,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
    handler: async ({ missionName, subsystem, description, severity, suspectedCause }) =>
      fileSpaceAnomaly(missionName, subsystem, description, severity, suspectedCause),
  },
  {
    name: "space.triage_anomaly",
    description: "Update anomaly suspected cause and status.",
    parameters: {
      type: "object",
      properties: {
        anomalyId: { type: "string" },
        suspectedCause: { type: "string", default: "" },
        status: { type: "string", enum: ["triaged","mitigated","closed"], default: "triaged" },
      },
      required: ["anomalyId"],
    },
    handler: async ({ anomalyId, suspectedCause, status }) => triageSpaceAnomaly(anomalyId, suspectedCause, status),
  },
];

export async function handlePhase25Tool(name, args) {
  const tool = phase25Tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown phase25 tool: ${name}`);
  return tool.handler(args);
}
