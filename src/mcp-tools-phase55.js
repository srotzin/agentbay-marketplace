/**
 * HiveAgent MCP Tool Definitions — Phase 55 (Live Intelligence)
 *
 * Adds 1 live tool:
 * - company_linkedin_profile — fetch a structured company profile (best-effort) from a LinkedIn company page.
 */

import { lookupLinkedInCompany } from "./services/live/linkedin-company.js";

export const phase55Tools = [
  {
    name: "company_linkedin_profile",
    description:
      "Use when you need a quick company profile from a LinkedIn company page. " +
      "Provide a LinkedIn company URL (https://www.linkedin.com/company/<slug>/) or just the slug. " +
      "Returns name, description, website URL (when present), logo URL, address (when present), and a small set of related links. " +
      "Best-effort: LinkedIn may block automated requests, in which case you will receive a partial result with an error. Free.",
    inputSchema: {
      type: "object",
      properties: {
        companyUrlOrSlug: {
          type: "string",
          description:
            "LinkedIn company page URL or slug (e.g. 'openai' or 'https://www.linkedin.com/company/openai/').",
        },
      },
      required: ["companyUrlOrSlug"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];

export async function handlePhase55Tool(name, args) {
  switch (name) {
    case "company_linkedin_profile":
      return lookupLinkedInCompany({
        companyUrlOrSlug: args?.companyUrlOrSlug,
      });

    default:
      return {
        ok: false,
        error: `Unknown phase55 tool: ${name}`,
      };
  }
}
