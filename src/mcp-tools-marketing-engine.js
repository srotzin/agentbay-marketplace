/**
 * Agentic Marketing Engine — MCP Tools
 * HiveAgent | 2026
 *
 * The marketing agent that never sleeps.
 * 24/7 autonomous presence across every agentic platform.
 *
 * 6 tools:
 *   marketing_scan_opportunities  — find conversations to join across all platforms
 *   marketing_generate_response   — generate perfect platform-specific responses
 *   marketing_track_presence      — track HiveAgent presence across 15 platforms
 *   marketing_momentum_report     — honest assessment + next 3 highest-impact actions
 *   marketing_get_platforms       — full map of where we are vs where we need to be
 *   marketing_create_content      — generates ready-to-paste content for any format
 *
 * Tier 1: Smithery ✓, r/LocalLLaMA (ready), LangChain/CrewAI/AutoGen PRs open
 * Tier 2: HuggingFace, dev.to, HackerNews, r/AI_Agents
 * Tier 3: ProductHunt, LinkedIn, YouTube, Discord servers
 */

import {
  scanForOpportunities,
  generateResponse,
  trackPresence,
  getMomentumReport,
  getAgenticPlatforms,
  createMarketingContent,
} from "./services/agentic-marketing-engine.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const marketingEngineTools = [
  {
    name: "marketing_scan_opportunities",
    description:
      "The core marketing intelligence function — scans every agentic platform for conversations where HiveAgent is relevant and ranks opportunities by urgency and reach. " +
      "Returns a ranked list of real threads, GitHub issues, Discord questions, Reddit posts, and HN comments where recommending HiveAgent would be genuinely helpful. " +
      "Each opportunity includes: thread URL, platform, topic, why it's relevant, suggested response type, urgency (hot/warm/cold), and estimated reach. " +
      "Use this to find the highest-impact conversations to join right now. " +
      "Platforms scanned: Smithery, r/LocalLLaMA, r/AI_Agents, r/ethereum, HackerNews, dev.to, GitHub, Twitter/X, LangChain Discord, CrewAI Discord, AutoGen Discord, Hugging Face, ProductHunt, LinkedIn, YouTube. " +
      "Filter by platform or keywords to narrow results.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            "Filter to a specific platform. Options: github, reddit_localllama, reddit_ai_agents, hackernews, langchain_discord, crewai_discord, autogen_discord, twitter_x, huggingface. Omit for all platforms.",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter opportunities matching these keywords (e.g. ['payment', 'wallet', 'MCP']). Omit for all opportunities.",
        },
      },
      required: [],
    },
  },

  {
    name: "marketing_generate_response",
    description:
      "Generate the perfect, ready-to-paste response for a specific marketing opportunity. " +
      "Takes a conversation opportunity (from marketing_scan_opportunities) and produces a platform-appropriate response in the right format. " +
      "Response types: code_example (working code + explanation), one_liner (install command + one sentence), thread_reply (multi-tweet thread), technical_deep_dive (full architecture explanation), comparison (vs alternatives). " +
      "Returns: response_text (copy-paste ready), platform_specific_formatting notes, character_count, and a _tip with the platform-specific tactic that maximizes engagement. " +
      "Style options: technical (default), friendly (conversational), brief (under 150 chars). " +
      "Every response is engineered to be genuinely helpful first, promotional second — the best marketing is a real answer.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description:
            "ID for this conversation (optional — auto-generated if omitted). Used to track if this response gets sent and whether it converts.",
        },
        opportunity: {
          type: "object",
          description:
            "The opportunity object from marketing_scan_opportunities — includes thread_url, platform, topic, suggested_response_type, urgency, estimated_reach.",
          properties: {
            thread_url: { type: "string" },
            platform: { type: "string" },
            topic: { type: "string" },
            suggested_response_type: { type: "string" },
            urgency: { type: "string" },
            estimated_reach: { type: "number" },
          },
        },
        response_style: {
          type: "string",
          enum: ["technical", "friendly", "brief"],
          description:
            "Response tone. technical = code-heavy, developer-to-developer. friendly = conversational, accessible. brief = one-liner with link. Default: technical.",
          default: "technical",
        },
      },
      required: [],
    },
  },

  {
    name: "marketing_track_presence",
    description:
      "Log a marketing action and update HiveAgent's presence stats on a platform. " +
      "Call this after every post, reply, PR, comment, or Discord message to keep the dashboard accurate. " +
      "Tracks: followers gained, reach gained, status changes, and activity timestamps. " +
      "Returns the updated presence record for that platform plus running totals across all 15 platforms. " +
      "Also feeds into marketing_momentum_report so recommendations stay current. " +
      "Platforms: smithery, reddit_localllama, reddit_ai_agents, reddit_ethereum, hackernews, devto, github_trending, twitter_x, langchain_discord, crewai_discord, autogen_discord, huggingface, producthunt, linkedin, youtube.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            "Platform where the activity happened. Must be one of: smithery, reddit_localllama, reddit_ai_agents, reddit_ethereum, hackernews, devto, github_trending, twitter_x, langchain_discord, crewai_discord, autogen_discord, huggingface, producthunt, linkedin, youtube.",
        },
        action_taken: {
          type: "string",
          description:
            "What was done. Examples: 'Posted Show HN submission', 'Replied to Discord thread about agent wallets', 'Opened PR #474 in langchain-mcp-adapters', 'Published dev.to article'.",
        },
        result: {
          type: "object",
          description:
            "Optional outcome data to record.",
          properties: {
            reach_gained: {
              type: "number",
              description: "Estimated impressions or views from this action",
            },
            followers_gained: {
              type: "number",
              description: "New followers gained",
            },
            status: {
              type: "string",
              description:
                "Updated platform status: active, partial, not_present, ready",
            },
            notes: {
              type: "string",
              description: "Any notes about the outcome",
            },
            outcome: {
              type: "string",
              description: "Short outcome description, e.g. 'upvoted 47 times', 'PR merged'",
            },
          },
        },
      },
      required: ["platform", "action_taken"],
    },
  },

  {
    name: "marketing_momentum_report",
    description:
      "The HiveAgent marketing dashboard — a full honest assessment of where we are and what to do next. " +
      "Shows: (1) where we have presence vs where we're missing across all 15 platforms, " +
      "(2) what's working — highest-converting platforms and content types, " +
      "(3) what opportunities are hot right now, " +
      "(4) the top 3 recommended next actions ranked by expected install impact with effort estimates, " +
      "(5) an honest week-by-week growth forecast. " +
      "_honest_assessment: 'Week 1 reality: 0-5 organic. Week 2 with posts: 10-50/day. Week 4 with PR merges: 50-200/day.' " +
      "Call this to orient at the start of any marketing session or to decide what to do next. No arguments required.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "marketing_get_platforms",
    description:
      "Complete map of every agentic platform where HiveAgent should have presence — tiered by impact, with current status, what's needed, expected reach, and priority score for each. " +
      "Tier 1 (highest agent developer concentration): Smithery ✓, r/LocalLLaMA, LangChain Discord, GitHub langchain-mcp-adapters PR #474, CrewAI Discord PR #5390. " +
      "Tier 2 (high value, medium effort): Hugging Face, AutoGen Discord, dev.to, HackerNews, r/AI_Agents. " +
      "Tier 3 (worth doing, lower priority): ProductHunt, LinkedIn, YouTube, agent Discord servers, QVAC community. " +
      "For each platform: current status, what we have, what we need, expected reach, priority score, and the specific next action. " +
      "Use this to plan a marketing sprint or understand the full opportunity landscape.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "marketing_create_content",
    description:
      "Generate ready-to-paste marketing content in any format for any platform — no editing needed, copy-paste directly. " +
      "Formats: tweet, reddit_post, discord_message, github_comment, hn_comment, dev_to_article_intro, linkedin_post. " +
      "Topics: highway_launch (main HiveAgent pitch), erc8183_launch (ERC-8183 standard), agent_gdp ($2.3M settled), arc_agent_commerce_response, bait_tools_launch (18 new tools), qvac_integration. " +
      "Angles: payment_primitives, escrow_workflow, multi_chain, developer_productivity, agent_economy. " +
      "Returns: content (formatted, ready to paste), platform_notes (specific tactics for that platform), character_count, estimated_engagement range. " +
      "Each piece is written to be genuinely useful to developers first — not promotional copy — because that's what actually converts.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: [
            "tweet",
            "reddit_post",
            "discord_message",
            "github_comment",
            "hn_comment",
            "dev_to_article_intro",
            "linkedin_post",
          ],
          description:
            "Content format to generate. Each is formatted for its platform (markdown for Reddit, plain for HN, thread format for Twitter, etc.)",
        },
        topic: {
          type: "string",
          enum: [
            "highway_launch",
            "erc8183_launch",
            "agent_gdp",
            "arc_agent_commerce_response",
            "bait_tools_launch",
            "qvac_integration",
          ],
          description:
            "Core topic to cover. highway_launch is the main HiveAgent pitch. erc8183_launch focuses on the new standard. agent_gdp leads with the $2.3M stat.",
          default: "highway_launch",
        },
        target_platform: {
          type: "string",
          description:
            "Target platform for additional platform-specific optimization. Examples: twitter_x, reddit_localllama, langchain_discord, hackernews, github. Defaults to format type.",
        },
        angle: {
          type: "string",
          description:
            "Optional angle or emphasis. Examples: 'focus on escrow workflow', 'lead with the ERC-8183 standard', 'target CrewAI developers', 'emphasize zero config setup'.",
        },
      },
      required: ["format"],
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMarketingEngineTool(name, args) {
  switch (name) {
    case "marketing_scan_opportunities":
      return await scanForOpportunities(args);

    case "marketing_generate_response":
      return await generateResponse(args);

    case "marketing_track_presence":
      return await trackPresence(args);

    case "marketing_momentum_report":
      return await getMomentumReport(args);

    case "marketing_get_platforms":
      return await getAgenticPlatforms(args);

    case "marketing_create_content":
      return await createMarketingContent(args);

    default:
      throw new Error(`Unknown marketing engine tool: ${name}`);
  }
}
