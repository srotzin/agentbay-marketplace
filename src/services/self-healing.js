/**
 * HiveAgent Self-Healing Middleware
 *
 * Catches tool execution failures and auto-retries or reroutes without the calling
 * agent needing to know. Makes HiveAgent feel bulletproof even under partial
 * infrastructure degradation.
 *
 * Exported functions:
 *   - executeWithRetry(toolName, args, maxRetries, timeoutMs)
 *   - executeWithFallback(toolName, args, fallbackTools)
 *   - getHealthStatus()
 */

// ─── Internal state ─────────────────────────────────────────────────────────

const phaseHealth = {};
const attemptLog  = [];

const PHASE_MAP = {
  // Tool prefix → logical phase name
  insurance:        "insurance_phase",
  health:           "healthcare_phase",
  legal:            "legal_phase",
  construction:     "construction_phase",
  smb:              "smb_phase",
  trades:           "trades_phase",
  trade:            "trade_customs_phase",
  travel:           "travel_phase",
  fraud:            "fraud_phase",
  sales:            "sales_phase",
  hr:               "hr_phase",
  ag:               "agriculture_phase",
  gov:              "government_phase",
  commerce:         "commerce_phase",
  energy:           "energy_phase",
  fleet:            "fleet_phase",
  tax:              "tax_phase",
  procurement:      "procurement_phase",
  cybersecurity:    "cybersecurity_phase",
  edu:              "education_phase",
  hiveagent:        "core_phase",
  recovery:         "recovery_phase",
  workflow:         "workflow_phase",
  compute:          "compute_phase",
  virtual_card:     "payments_phase",
  compliance:       "compliance_phase",
  real_estate:      "real_estate_phase",
  property:         "property_mgmt_phase",
  ip:               "ip_phase",
  vet:              "veterinary_phase",
  cs:               "customer_support_phase",
  event:            "event_planning_phase",
  content:          "content_phase",
  doc:              "document_phase",
};

/**
 * Derive the phase name from a tool name, using the first underscore-delimited
 * segment as the prefix key.
 *
 * @param {string} toolName
 * @returns {string}
 */
function phaseForTool(toolName) {
  const prefix = toolName.split("_")[0];
  return PHASE_MAP[prefix] ?? "unknown_phase";
}

/**
 * Record an attempt in the in-memory log (capped at 1000 entries).
 *
 * @param {object} entry
 */
function recordAttempt(entry) {
  attemptLog.push({ ...entry, timestamp: new Date().toISOString() });
  if (attemptLog.length > 1000) attemptLog.shift();
}

/**
 * Update rolling phase health metrics after a call attempt.
 *
 * @param {string}  phase      - Phase name
 * @param {boolean} success    - Whether the call succeeded
 * @param {number}  latencyMs  - Observed latency in milliseconds
 */
function updatePhaseHealth(phase, success, latencyMs) {
  if (!phaseHealth[phase]) {
    phaseHealth[phase] = {
      status:           "healthy",
      total_calls:      0,
      success_calls:    0,
      failure_calls:    0,
      last_latency_ms:  0,
      avg_latency_ms:   0,
      last_error:       null,
      last_updated:     null,
    };
  }

  const p = phaseHealth[phase];
  p.total_calls    += 1;
  p.last_latency_ms = latencyMs;
  p.avg_latency_ms  = Math.round(
    (p.avg_latency_ms * (p.total_calls - 1) + latencyMs) / p.total_calls
  );
  p.last_updated = new Date().toISOString();

  if (success) {
    p.success_calls += 1;
    const errorRate = p.failure_calls / p.total_calls;
    p.status = errorRate > 0.5 ? "degraded" : errorRate > 0.1 ? "warning" : "healthy";
  } else {
    p.failure_calls += 1;
    const errorRate = p.failure_calls / p.total_calls;
    p.status = errorRate > 0.5 ? "unhealthy" : errorRate > 0.1 ? "degraded" : "warning";
  }
}

// ─── Core internal executor ──────────────────────────────────────────────────

/**
 * Calls the HiveAgent MCP endpoint for a given tool.
 * This is the low-level transport layer used by the retry/fallback wrappers.
 *
 * In production the MCP server is in-process (Node.js), so we import the tool
 * handler directly. This stub returns a resolved promise to keep the module
 * self-contained while the real tool registry is loaded by mcp-tools.js.
 *
 * @param   {string} toolName
 * @param   {object} args
 * @param   {number} timeoutMs
 * @returns {Promise<object>}
 */
async function callTool(toolName, args, timeoutMs = 10000) {
  // In a deployed server, replace this body with a direct import or
  // an internal fetch to http://localhost:PORT/mcp. The surrounding
  // retry / fallback logic remains identical.
  const startMs = Date.now();

  try {
    // Attempt to resolve the tool handler from the global MCP tool registry
    // if it has been injected (by mcp-server.js or tests).
    const registry = globalThis.__hiveagent_tool_registry;
    if (registry && typeof registry[toolName] === "function") {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const result = await Promise.race([
        Promise.resolve(registry[toolName](args)),
        timeoutPromise,
      ]);
      return { success: true, result, latency_ms: Date.now() - startMs };
    }

    // Fallback: HTTP call to the local MCP server
    const port = process.env.PORT ?? 3000;
    const url  = `http://localhost:${port}/mcp`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        jsonrpc: "2.0",
        id:      1,
        method:  "tools/call",
        params:  { name: toolName, arguments: args },
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    const json = await response.json();

    if (json.error) {
      throw new Error(json.error.message ?? JSON.stringify(json.error));
    }

    const content = json?.result?.content;
    const parsed  = Array.isArray(content) && content[0]?.text
      ? JSON.parse(content[0].text)
      : json.result;

    return { success: true, result: parsed, latency_ms: Date.now() - startMs };

  } catch (err) {
    return {
      success:    false,
      error:      err.message ?? String(err),
      latency_ms: Date.now() - startMs,
    };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * executeWithRetry
 *
 * Execute a tool with automatic retry on failure using exponential backoff.
 * The calling agent never sees transient failures — it either gets a result
 * or a detailed final-failure report.
 *
 * @param   {string} toolName    - HiveAgent tool name (e.g. "insurance_claim_intake")
 * @param   {object} args        - Tool arguments
 * @param   {number} maxRetries  - Maximum number of retry attempts (default: 3)
 * @param   {number} timeoutMs   - Per-attempt timeout in milliseconds (default: 10000)
 * @returns {Promise<object>}    - Tool result on success; error report on final failure
 *
 * @example
 * const result = await executeWithRetry("insurance_claim_intake", {
 *   claim_type: "auto",
 *   policy_number: "POL-123",
 *   incident_details: { description: "rear-end collision" },
 * });
 */
export async function executeWithRetry(
  toolName,
  args       = {},
  maxRetries = 3,
  timeoutMs  = 10000
) {
  const phase      = phaseForTool(toolName);
  const attempts   = [];
  let   lastResult = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const backoffMs = attempt === 1 ? 0 : Math.min(500 * Math.pow(2, attempt - 2), 8000);

    if (backoffMs > 0) {
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    const callResult = await callTool(toolName, args, timeoutMs);
    lastResult = callResult;

    const attemptRecord = {
      tool:       toolName,
      attempt,
      max:        maxRetries,
      success:    callResult.success,
      latency_ms: callResult.latency_ms,
      error:      callResult.error ?? null,
      backoff_ms: backoffMs,
    };

    attempts.push(attemptRecord);
    recordAttempt(attemptRecord);
    updatePhaseHealth(phase, callResult.success, callResult.latency_ms);

    if (callResult.success) {
      return {
        ...callResult.result,
        _self_healing: {
          tool:             toolName,
          attempts_used:    attempt,
          max_retries:      maxRetries,
          final_latency_ms: callResult.latency_ms,
          phase,
          status:           "succeeded",
        },
      };
    }

    console.error(
      `[SelfHealing] ${toolName} attempt ${attempt}/${maxRetries} failed: ${callResult.error}`
    );
  }

  // All retries exhausted
  const errorReport = {
    _self_healing: {
      tool:          toolName,
      attempts_used: maxRetries,
      max_retries:   maxRetries,
      phase,
      status:        "failed_all_retries",
      last_error:    lastResult?.error ?? "unknown error",
      attempts,
    },
    error:   `Tool "${toolName}" failed after ${maxRetries} attempt(s): ${lastResult?.error ?? "unknown error"}`,
    success: false,
  };

  console.error(`[SelfHealing] ${toolName} exhausted ${maxRetries} retries.`);
  return errorReport;
}

/**
 * executeWithFallback
 *
 * Try a primary tool; if it fails, try each fallback in order.
 * Returns the result from whichever tool succeeds first, along with
 * metadata about which tool was actually used.
 *
 * @param   {string}   toolName      - Primary tool name
 * @param   {object}   args          - Tool arguments (passed unchanged to every candidate)
 * @param   {string[]} fallbackTools - Ordered list of fallback tool names
 * @returns {Promise<object>}        - Result with _self_healing metadata
 *
 * @example
 * const result = await executeWithFallback(
 *   "travel_search_flights",
 *   { origin: "NYC", destination: "LHR", date: "2026-06-01" },
 *   ["travel_search_flights_v2", "travel_generic_search"]
 * );
 */
export async function executeWithFallback(
  toolName,
  args          = {},
  fallbackTools = []
) {
  const candidates   = [toolName, ...fallbackTools];
  const failedTools  = [];

  for (const candidate of candidates) {
    const phase      = phaseForTool(candidate);
    const callResult = await callTool(candidate, args, 10000);

    recordAttempt({
      tool:    candidate,
      attempt: 1,
      max:     1,
      success: callResult.success,
      latency_ms: callResult.latency_ms,
      error:   callResult.error ?? null,
    });
    updatePhaseHealth(phase, callResult.success, callResult.latency_ms);

    if (callResult.success) {
      const wasFallback = candidate !== toolName;

      if (wasFallback) {
        console.warn(
          `[SelfHealing] Primary "${toolName}" failed; used fallback "${candidate}" instead.`
        );
      }

      return {
        ...callResult.result,
        _self_healing: {
          primary_tool:   toolName,
          tool_used:      candidate,
          was_fallback:   wasFallback,
          failed_tools:   failedTools,
          latency_ms:     callResult.latency_ms,
          status:         "succeeded",
        },
      };
    }

    console.error(
      `[SelfHealing] Fallback candidate "${candidate}" failed: ${callResult.error}`
    );
    failedTools.push({ tool: candidate, error: callResult.error });
  }

  // Every candidate failed
  return {
    _self_healing: {
      primary_tool:  toolName,
      tool_used:     null,
      was_fallback:  false,
      failed_tools:  failedTools,
      status:        "all_fallbacks_failed",
    },
    error:   `All ${candidates.length} tool candidate(s) failed for "${toolName}".`,
    success: false,
  };
}

/**
 * getHealthStatus
 *
 * Returns real-time health of all tool phases that have been called since
 * server start. Useful for dashboards, alerting, and proactive rerouting.
 *
 * @returns {object} Health snapshot
 *
 * @example
 * const status = getHealthStatus();
 * // {
 * //   healthy_phases: 12,
 * //   degraded_phases: 1,
 * //   unhealthy_phases: 0,
 * //   phase_health: { insurance_phase: { status: "healthy", ... }, ... },
 * //   recent_attempts: [...],
 * //   generated_at: "2026-04-07T08:00:00Z"
 * // }
 */
export function getHealthStatus() {
  const phases     = Object.entries(phaseHealth);
  const healthy    = phases.filter(([, v]) => v.status === "healthy").length;
  const degraded   = phases.filter(([, v]) => v.status === "degraded" || v.status === "warning").length;
  const unhealthy  = phases.filter(([, v]) => v.status === "unhealthy").length;

  const overall =
    unhealthy > 0
      ? "unhealthy"
      : degraded > 0
      ? "degraded"
      : "healthy";

  return {
    overall_status:   overall,
    healthy_phases:   healthy,
    degraded_phases:  degraded,
    unhealthy_phases: unhealthy,
    total_phases:     phases.length,
    phase_health:     { ...phaseHealth },
    recent_attempts:  attemptLog.slice(-50),
    generated_at:     new Date().toISOString(),
  };
}

/**
 * Register a tool handler directly into the in-process registry.
 * Called by mcp-server.js or test harnesses to wire up real implementations.
 *
 * @param {string}   toolName
 * @param {Function} handler   - async function(args) => result
 */
export function registerToolHandler(toolName, handler) {
  if (!globalThis.__hiveagent_tool_registry) {
    globalThis.__hiveagent_tool_registry = {};
  }
  globalThis.__hiveagent_tool_registry[toolName] = handler;
}
