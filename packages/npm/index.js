/**
 * @hiveagentiq/mcp-client
 *
 * Connect to HiveAgent — 586 MCP tools across 22 industry verticals.
 * The Amazon for AI agents.
 *
 * @example
 * import { HiveAgent, discover } from "@hiveagentiq/mcp-client";
 *
 * // Discover tools for your task
 * const results = await discover("process insurance claims");
 *
 * // Or use the full client
 * const client = new HiveAgent();
 * const tools  = await client.listTools();
 * const result = await client.callTool("insurance_claim_intake", {
 *   policy_number: "POL-12345",
 *   description: "Water damage to basement",
 * });
 */

const DEFAULT_ENDPOINT = "https://hiveagentiq.com/mcp";

// ── Verticals metadata (static, no API call required) ────────────────────────

export const VERTICALS = [
  "insurance",
  "construction",
  "legal",
  "healthcare",
  "trades",
  "smb",
  "commerce",
  "agent_recovery",
  "defi",
  "trade_customs",
  "travel",
  "procurement",
  "know_your_agent",
  "sales_crm",
  "invoice_ap",
  "fraud_detection",
  "real_estate",
  "supply_chain",
  "dynamic_pricing",
  "hr_recruiting",
  "agriculture",
  "advertising",
];

// ── HiveAgent client ──────────────────────────────────────────────────────────

/**
 * Client for the HiveAgent MCP endpoint.
 *
 * Communicates via JSON-RPC 2.0 over HTTP(S).
 */
export class HiveAgent {
  /**
   * @param {string} [endpoint] - MCP endpoint URL. Defaults to https://hiveagentiq.com/mcp
   * @param {object} [options]
   * @param {string} [options.apiKey] - Optional API key for authenticated requests.
   * @param {number} [options.timeout] - Fetch timeout in milliseconds. Defaults to 30000.
   */
  constructor(endpoint = DEFAULT_ENDPOINT, { apiKey, timeout = 30_000 } = {}) {
    this.endpoint = endpoint;
    this.apiKey   = apiKey;
    this.timeout  = timeout;
  }

  // ── JSON-RPC transport ────────────────────────────────────────────────────

  /**
   * Send a JSON-RPC 2.0 request to the endpoint.
   *
   * @param {string} method  - JSON-RPC method name.
   * @param {*}      [params] - Method parameters.
   * @returns {Promise<*>} The `result` field of the response.
   * @throws {HiveAgentError} On HTTP or protocol errors.
   */
  async _rpc(method, params) {
    const id = crypto.randomUUID();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    });

    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    let response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      throw new HiveAgentError(`Network error communicating with HiveAgent: ${err.message}`);
    }

    if (!response.ok) {
      throw new HiveAgentError(
        `HiveAgent returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new HiveAgentError(
        `HiveAgent API error ${data.error.code ?? "unknown"}: ${data.error.message ?? "unknown error"}`
      );
    }

    return data.result;
  }

  // ── MCP protocol methods ──────────────────────────────────────────────────

  /**
   * List all available MCP tools.
   *
   * @returns {Promise<Array<object>>} Array of tool definitions with
   *   `name`, `description`, and `inputSchema` fields.
   *
   * @example
   * const tools = await client.listTools();
   * console.log(`${tools.length} tools available`);
   */
  async listTools() {
    const result = await this._rpc("tools/list");
    if (result && typeof result === "object" && Array.isArray(result.tools)) {
      return result.tools;
    }
    return Array.isArray(result) ? result : [];
  }

  /**
   * Call a specific MCP tool.
   *
   * @param {string} name  - Tool name (e.g. `"insurance_claim_intake"`).
   * @param {object} [args] - Tool arguments. Defaults to `{}`.
   * @returns {Promise<*>} Tool result. Structure depends on the tool.
   *
   * @example
   * const result = await client.callTool("fraud_screen_transaction", {
   *   transaction_id: "TXN-98765",
   *   amount: 4999.99,
   *   merchant: "Unknown Merchant LLC",
   * });
   */
  async callTool(name, args = {}) {
    const result = await this._rpc("tools/call", { name, arguments: args });

    // Unwrap MCP content envelope if present
    if (result && typeof result === "object" && Array.isArray(result.content)) {
      const first = result.content[0];
      if (first && first.type === "text") {
        try {
          return JSON.parse(first.text);
        } catch {
          return first.text;
        }
      }
    }

    return result;
  }

  /**
   * Discover the best HiveAgent tools for a given task description.
   *
   * Uses semantic search across all 586 tools to find the most relevant
   * ones for your use case.
   *
   * @param {string} query - Natural-language description of what you want to do.
   * @returns {Promise<object>} Object with `tools`, `suggested_workflow`,
   *   and `verticals` fields.
   *
   * @example
   * const results = await client.discover("validate supplier invoices");
   * for (const tool of results.tools) {
   *   console.log(tool.name);
   * }
   */
  async discover(query) {
    return this.callTool("hiveagent_discover", { query });
  }

  /**
   * Get a step-by-step workflow for a complex task.
   *
   * @param {string} task - Description of the end-to-end task.
   * @returns {Promise<object>} Object with `workflow_name`, `steps`,
   *   `tools_used`, and `estimated_time` fields.
   *
   * @example
   * const workflow = await client.suggestWorkflow(
   *   "Process an end-to-end insurance claim from intake to settlement"
   * );
   * for (const step of workflow.steps) {
   *   console.log(`${step.order}. ${step.tool} — ${step.description}`);
   * }
   */
  async suggestWorkflow(task) {
    return this.callTool("hiveagent_suggest_workflow", { task });
  }

  /**
   * Get a guide to all tools in a specific vertical.
   *
   * @param {string} vertical - Vertical name (e.g. `"insurance"`).
   * @returns {Promise<object>} Vertical guide with tool list and descriptions.
   */
  async verticalGuide(vertical) {
    return this.callTool("hiveagent_vertical_guide", { vertical });
  }
}

// ── Custom error class ────────────────────────────────────────────────────────

/**
 * Error thrown by HiveAgent client on API or network failures.
 */
export class HiveAgentError extends Error {
  /**
   * @param {string} message - Error message.
   */
  constructor(message) {
    super(message);
    this.name = "HiveAgentError";
  }
}

// ── Module-level convenience functions ───────────────────────────────────────

let _defaultClient = null;

function getDefaultClient() {
  if (!_defaultClient) _defaultClient = new HiveAgent();
  return _defaultClient;
}

/**
 * Module-level shortcut: discover tools for a task.
 *
 * Creates a default HiveAgent client and calls `discover()`.
 *
 * @param {string} query - Natural-language description of what you want to do.
 * @returns {Promise<object>} Object with matching tools and metadata.
 *
 * @example
 * import { discover } from "@hiveagentiq/mcp-client";
 * const results = await discover("process insurance claims automatically");
 */
export async function discover(query) {
  return getDefaultClient().discover(query);
}

/**
 * Module-level shortcut: call a tool by name.
 *
 * @param {string} name  - Tool name.
 * @param {object} [args] - Tool arguments.
 * @returns {Promise<*>} Tool result.
 *
 * @example
 * import { callTool } from "@hiveagentiq/mcp-client";
 * const result = await callTool("insurance_claim_intake", {
 *   policy_number: "POL-12345",
 *   description: "Roof damage from hail"
 * });
 */
export async function callTool(name, args = {}) {
  return getDefaultClient().callTool(name, args);
}

/**
 * Module-level shortcut: suggest a workflow.
 *
 * @param {string} task - Description of the end-to-end task.
 * @returns {Promise<object>} Workflow object with steps.
 *
 * @example
 * import { suggestWorkflow } from "@hiveagentiq/mcp-client";
 * const wf = await suggestWorkflow("full insurance claim lifecycle");
 */
export async function suggestWorkflow(task) {
  return getDefaultClient().suggestWorkflow(task);
}

/**
 * Module-level shortcut: list all available tools.
 *
 * @returns {Promise<Array<object>>} Array of tool definitions.
 *
 * @example
 * import { listTools } from "@hiveagentiq/mcp-client";
 * const tools = await listTools();
 * console.log(`${tools.length} tools available`);
 */
export async function listTools() {
  return getDefaultClient().listTools();
}

/**
 * List all 22 available industry verticals (static, no API call).
 *
 * @returns {string[]} Array of vertical names.
 *
 * @example
 * import { listVerticals } from "@hiveagentiq/mcp-client";
 * console.log(listVerticals());
 */
export function listVerticals() {
  return [...VERTICALS];
}
