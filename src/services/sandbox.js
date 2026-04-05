/**
 * HiveAgent Code Execution Sandbox
 *
 * Agents can run JavaScript code in a sandboxed vm context and get results.
 * Uses Node.js vm module for safe execution — no eval().
 *
 * Price: $0.001 per execution (basically free, but tracks usage)
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";
import vm from "node:vm";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS code_executions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    language TEXT DEFAULT 'javascript',
    code TEXT NOT NULL,
    output TEXT,
    error TEXT,
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_executions_agent ON code_executions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_executions_created ON code_executions(created_at);
`);

// ─── Constants ───────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const EXECUTION_PRICE_USD = 0.001;

// ─── Code Execution ──────────────────────────────

/**
 * Execute JavaScript code in a safe sandboxed vm context.
 * Captures console.log output and returns the last expression result.
 */
export async function executeCode({ agent_id, code, language = "javascript", timeout_ms } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!code) throw new Error("code is required");

  const execution_id = uuid();
  const effectiveTimeout = Math.min(
    timeout_ms && timeout_ms > 0 ? timeout_ms : DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );

  // Python is not yet supported
  if (language === "python") {
    const record = {
      execution_id,
      error: "Python execution coming soon. Use JavaScript for now.",
      status: "error",
      language: "python",
    };
    db.prepare(`
      INSERT INTO code_executions (id, agent_id, language, code, error, execution_time_ms, status)
      VALUES (?, ?, ?, ?, ?, 0, 'error')
    `).run(execution_id, agent_id, language, code, record.error);
    return record;
  }

  const logs = [];
  const startTime = Date.now();

  // Build a safe console object that captures output
  const sandboxConsole = {
    log: (...args) => logs.push(args.map(a => {
      try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); }
    }).join(" ")),
    warn: (...args) => logs.push("[warn] " + args.map(a => {
      try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); }
    }).join(" ")),
    error: (...args) => logs.push("[error] " + args.map(a => {
      try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); }
    }).join(" ")),
    info: (...args) => logs.push("[info] " + args.map(a => {
      try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); }
    }).join(" ")),
  };

  // Sandbox context — only safe globals exposed
  const sandbox = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Symbol,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    // Limited setTimeout — synchronous timeout won't work but prevents errors
    setTimeout: (fn, ms) => {
      // No-op in sync context; just log it
      sandboxConsole.warn("setTimeout is not supported in sandbox context");
    },
    clearTimeout: () => {},
    undefined,
    null: null,
    Infinity,
    NaN,
    __result: undefined,
  };

  let result;
  let status = "completed";
  let errorMsg = null;

  try {
    // Wrap user code to capture the last expression value
    const wrappedCode = `(function() { ${code} })()`;
    const script = new vm.Script(wrappedCode, {
      filename: "sandbox.js",
      lineOffset: 0,
    });

    const context = vm.createContext(sandbox);
    result = script.runInContext(context, { timeout: effectiveTimeout });

    // Serialize result safely
    let resultStr;
    try {
      resultStr = result !== undefined
        ? (typeof result === "object" ? JSON.stringify(result, null, 2) : String(result))
        : undefined;
    } catch {
      resultStr = "[non-serializable result]";
    }
    result = resultStr;
  } catch (e) {
    if (e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT" || e.message?.includes("timed out")) {
      status = "timeout";
      errorMsg = "Execution timed out";
    } else {
      status = "error";
      errorMsg = e.message || String(e);
    }
  }

  const execution_time_ms = Date.now() - startTime;
  const output = logs.length > 0 ? logs.join("\n") : null;

  // Persist execution record
  db.prepare(`
    INSERT INTO code_executions (id, agent_id, language, code, output, error, execution_time_ms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(execution_id, agent_id, language, code, output, errorMsg, execution_time_ms, status);

  const response = {
    execution_id,
    language,
    status,
    execution_time_ms,
    price_usd: EXECUTION_PRICE_USD,
  };

  if (status === "completed") {
    response.output = output;
    response.result = result;
  } else {
    response.error = errorMsg;
    if (output) response.output = output;
  }

  return response;
}

/**
 * Get recent execution history for an agent.
 */
export function getExecutionHistory(agent_id, limit = 20) {
  if (!agent_id) throw new Error("agent_id is required");

  const rows = db.prepare(`
    SELECT id, language, code, output, error, execution_time_ms, status, created_at
    FROM code_executions
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agent_id, Math.min(limit, 100));

  return {
    agent_id,
    executions: rows,
    count: rows.length,
  };
}

/**
 * Platform-wide execution statistics.
 */
export function getExecutionStats() {
  const total = db.prepare("SELECT COUNT(*) as c FROM code_executions").get().c;
  const completed = db.prepare("SELECT COUNT(*) as c FROM code_executions WHERE status = 'completed'").get().c;
  const errors = db.prepare("SELECT COUNT(*) as c FROM code_executions WHERE status = 'error'").get().c;
  const timeouts = db.prepare("SELECT COUNT(*) as c FROM code_executions WHERE status = 'timeout'").get().c;
  const avgTime = db.prepare(
    "SELECT COALESCE(AVG(execution_time_ms), 0) as avg FROM code_executions WHERE status = 'completed'"
  ).get().avg;
  const totalRevenue = Math.round(total * EXECUTION_PRICE_USD * 10000) / 10000;

  const byLanguage = db.prepare(`
    SELECT language, COUNT(*) as count
    FROM code_executions
    GROUP BY language
    ORDER BY count DESC
  `).all();

  return {
    total_executions: total,
    completed,
    errors,
    timeouts,
    avg_execution_time_ms: Math.round(avgTime),
    error_rate_pct: total > 0 ? Math.round(((errors + timeouts) / total) * 10000) / 100 : 0,
    total_revenue_usd: totalRevenue,
    price_per_execution_usd: EXECUTION_PRICE_USD,
    by_language: byLanguage,
  };
}
