/**
 * HiveAgent Internal MCP Tools — QC Audit & Platform Crawler
 *
 * 12 tools for platform operators and meta-agents to monitor tool health,
 * audit quality, benchmark performance, track competitors, scan regulatory
 * changes, and keep HiveAgent's data current and competitive.
 *
 * All tools are internal (free). No per-call fee.
 */

import * as audit   from "./services/platform-audit.js";
import * as crawler from "./services/platform-crawler.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const internalTools = [

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT TOOLS (platform_health_check → platform_audit_report)
  // ═══════════════════════════════════════════════════════════════════════

  {
    name: "platform_health_check",
    description:
      "Use when you need to verify the live health status of HiveAgent tools. Trigger phrases: 'run health check', 'check tool health', 'are all tools working', 'test platform tools'. Calls every tool in the specified scope with test inputs and measures response time and success rate. Returns total_tools_tested, passed, failed, degraded counts, avg_response_ms, p95_response_ms, and failures[] with tool_name/error details. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          description: "Vertical name to test (e.g. 'insurance', 'legal') or 'all' to run across every vertical",
          default: "all",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "platform_audit_descriptions",
    description:
      "Use when you need to audit tool description quality across the platform. Trigger phrases: 'audit tool descriptions', 'check description quality', 'find tools missing trigger phrases', 'description compliance report'. Scans all tool descriptions for: Use when prefix, trigger phrases, returns mention, under 300 chars, no marketing fluff. Returns total_tools, compliant, non_compliant, issues[] with tool_name/issue/suggestion. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        tools_array: {
          type: "array",
          description: "Array of tool definition objects (each with name and description fields) to audit. Pass the full tools array.",
          items: {
            type: "object",
            properties: {
              name:        { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
      required: ["tools_array"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "platform_measure_performance",
    description:
      "Use when you need to benchmark the performance of a specific tool. Trigger phrases: 'benchmark this tool', 'measure tool latency', 'how fast is this tool', 'performance test', 'p95 latency'. Runs the tool N times with test data and returns avg_ms, p50_ms, p95_ms, p99_ms, error_rate, memory_usage_mb, and result_consistency_pct. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "The exact name of the tool to benchmark (e.g. 'fraud_analyze_network')",
        },
        iterations: {
          type: "integer",
          description: "Number of test runs (1-100). Default 10. Higher = more accurate percentiles.",
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ["tool_name"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "platform_check_freshness",
    description:
      "Use when you need to verify data freshness across verticals. Trigger phrases: 'check data freshness', 'is our data current', 'find stale data', 'regulatory data age check', 'freshness report'. Checks timestamps on seed data, regulatory tables, pricing benchmarks, and market data. Returns stale_items[] with item/last_updated/staleness_days/severity and recommendations[]. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        vertical: {
          type: "string",
          description: "Vertical to check ('insurance', 'legal', 'healthcare', 'construction', 'trade', 'agriculture', etc.) or 'all' for every vertical",
          default: "all",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "platform_audit_dashboard",
    description:
      "Use when you need a full platform health overview for operational monitoring. Trigger phrases: 'platform dashboard', 'audit dashboard', 'overall health score', 'how is the platform doing', 'tool status overview'. Returns overall_health_score (0-100), tools_by_status breakdown, response_time_trend[], uptime_pct, last_full_audit time, top_issues[], and verticals_ranked_by_health[]. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "platform_audit_report",
    description:
      "Use when you need a comprehensive audit report for stakeholders or post-incident review. Trigger phrases: 'generate audit report', 'full platform audit', 'audit report for this week', 'QC report', 'executive health report'. Returns report with executive_summary, tool_health_matrix, performance_benchmarks, data_freshness_status, compliance_check, recommendations[], and action_items[]. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["json", "summary", "executive"],
          description: "Report format: 'json' for full structured data, 'summary' for key metrics, 'executive' for non-technical overview",
          default: "json",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CRAWLER TOOLS (platform_crawl_market → platform_crawler_dashboard)
  // ═══════════════════════════════════════════════════════════════════════

  {
    name: "platform_crawl_market",
    description:
      "Use when you need to scan the MCP ecosystem for new servers, emerging tool categories, and competitive gaps. Trigger phrases: 'crawl MCP ecosystem', 'find new MCP servers', 'market intelligence', 'what are competitors building', 'gap analysis'. Returns new_servers_found[], trending_categories[], gap_analysis{} with competitor coverage, and opportunities[]. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "platform_update_prices",
    description:
      "Use when you need to refresh pricing benchmarks against market rates. Trigger phrases: 'update pricing benchmarks', 'check our prices vs market', 'are we competitively priced', 'refresh price data', 'market rate comparison'. Returns updated_count, adjustments[] with service/old_price/new_price/reason, market_average, and hiveagent_position (cheaper/competitive/premium). Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        vertical: {
          type: "string",
          description: "Vertical to update pricing for (e.g. 'insurance', 'legal') or 'all' for every vertical",
          default: "all",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "platform_monitor_competitors",
    description:
      "Use when you need to track competitor MCP servers for new tools or capability changes. Trigger phrases: 'monitor competitors', 'check competitor tools', 'what did Smithery add', 'competitor tracking', 'threat analysis'. Returns competitors[] with name/tool_count/last_updated/new_tools_since_last_check[]/quality_score/threat_level. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        server_urls: {
          type: "array",
          description: "Optional list of specific competitor server URLs to filter results. Leave empty to monitor all tracked competitors.",
          items: { type: "string" },
          default: [],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "platform_check_regulations",
    description:
      "Use when you need to scan for regulatory changes affecting HiveAgent verticals. Trigger phrases: 'check regulatory updates', 'new regulations', 'HIPAA changes', 'tariff updates', 'compliance changes', 'what regulations changed'. Scans healthcare HIPAA, insurance, legal, construction codes, trade tariffs, and agriculture regulations. Returns updates[] with vertical/regulation/change_description/effective_date/impact/action_required. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        verticals: {
          type: "array",
          description: "List of verticals to check (e.g. ['healthcare', 'insurance', 'trade']). Leave empty for all verticals.",
          items: {
            type: "string",
            enum: ["healthcare", "insurance", "legal", "construction", "trade", "agriculture", "smb", "finance", "education", "government"],
          },
          default: [],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "platform_refresh_data",
    description:
      "Use when you need to refresh seed data for a vertical with current market data. Trigger phrases: 'refresh seed data', 'update vertical data', 'fetch fresh data for', 'refresh insurance data', 'update legal database'. Returns updated_records, new_records_added, stale_records_archived, and data_sources[] with source name and fetch status. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {
        vertical: {
          type: "string",
          description: "Vertical to refresh data for (e.g. 'insurance', 'legal', 'healthcare', 'trade', 'agriculture', 'smb', 'finance', 'travel', 'procurement', 'sales', 'fraud', 'supply_chain', 'real_estate', 'hr')",
        },
      },
      required: ["vertical"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "platform_crawler_dashboard",
    description:
      "Use when you need a crawler status overview including data freshness scores, competitor activity, and regulatory alerts. Trigger phrases: 'crawler dashboard', 'crawler status', 'data freshness overview', 'show crawler activity', 'what needs refreshing'. Returns last_crawl_time, next_scheduled, data_freshness_score, market_position{}, competitor_activity[], regulatory_alerts[], and ecosystem_growth_trend[]. Fee: internal (free).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Route internal tool calls to the appropriate service function.
 *
 * @param {string} name   - Tool name
 * @param {object} args   - Tool arguments
 * @returns {*}           - Tool result
 */
export function handleInternalTool(name, args = {}) {
  switch (name) {

    // ── Audit tools ────────────────────────────────────────────────────────

    case "platform_health_check":
      return audit.runHealthCheck(args.scope ?? "all");

    case "platform_audit_descriptions":
      return audit.auditToolDescriptions(args.tools_array ?? []);

    case "platform_measure_performance":
      return audit.measurePerformance(args.tool_name, args.iterations ?? 10);

    case "platform_check_freshness":
      return audit.checkDataFreshness(args.vertical ?? "all");

    case "platform_audit_dashboard":
      return audit.getAuditDashboard();

    case "platform_audit_report":
      return audit.generateAuditReport(args.format ?? "json");

    // ── Crawler tools ──────────────────────────────────────────────────────

    case "platform_crawl_market":
      return crawler.crawlMarketIntelligence();

    case "platform_update_prices":
      return crawler.updatePriceBenchmarks(args.vertical ?? "all");

    case "platform_monitor_competitors":
      return crawler.monitorCompetitorServers(args.server_urls ?? []);

    case "platform_check_regulations":
      return crawler.checkRegulatoryUpdates(args.verticals ?? []);

    case "platform_refresh_data":
      return crawler.refreshSeedData(args.vertical);

    case "platform_crawler_dashboard":
      return crawler.getCrawlerDashboard();

    default:
      throw new Error(`Unknown internal tool: ${name}`);
  }
}
