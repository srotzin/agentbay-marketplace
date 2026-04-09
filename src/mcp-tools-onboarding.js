/**
 * HiveAgent Onboarding MCP Tools
 *
 * 2 tools that expose the onboarding system to agents:
 *   agent_onboarding_status    — get current onboarding state for an agent
 *   agent_onboarding_dashboard — platform-wide enrollment + conversion stats
 */

import { getOnboardingStatus, getOnboardingDashboard } from "./services/agent-onboarding.js";

export const onboardingTools = [
  {
    name: "agent_onboarding_status",
    description: "Check your onboarding progress on HiveAgent. Shows current step, total tool calls, messages delivered, and what's coming next. Use this to see how far along your onboarding journey you are and what the next recommended action is.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID to look up onboarding status for",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "agent_onboarding_dashboard",
    description: "Platform-wide onboarding dashboard. Shows total enrolled agents, completion rate, conversion rate, drop-off by step, and recent conversions. Useful for platform operators and analytics.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export async function handleOnboardingTool(name, args = {}) {
  switch (name) {
    case "agent_onboarding_status":
      return await getOnboardingStatus({ agent_id: args.agent_id });

    case "agent_onboarding_dashboard":
      return await getOnboardingDashboard();

    default:
      throw new Error(`Unknown onboarding tool: ${name}`);
  }
}
