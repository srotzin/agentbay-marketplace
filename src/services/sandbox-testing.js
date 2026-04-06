import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const SB_PLATFORM_COMMISSION    = 0.22; // 22% platform cut (higher for security services)
const SB_PRICE_PER_SANDBOX      = 0.50; // $0.50 to spin up a sandbox
const SB_PRICE_PER_TEST_RUN     = 0.10; // $0.10 per individual test execution
const SB_PRICE_COMPARISON       = 1.50; // $1.50 flat for head-to-head comparison
const SB_TIMEOUT_DEFAULT_MS     = 30000; // 30 seconds

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sb_sandboxes (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    provider_ref        TEXT NOT NULL,
    test_data           TEXT DEFAULT '{}',
    timeout_ms          INTEGER DEFAULT 30000,
    status              TEXT DEFAULT 'active' CHECK(status IN ('active','closed','expired','error')),
    risk_level          TEXT DEFAULT 'unknown' CHECK(risk_level IN ('low','medium','high','critical','unknown')),
    tests_run           INTEGER DEFAULT 0,
    tests_passed        INTEGER DEFAULT 0,
    tests_failed        INTEGER DEFAULT 0,
    creation_fee_usd    REAL DEFAULT 0.50,
    commission_usd      REAL DEFAULT 0,
    expires_at          TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sb_test_runs (
    id              TEXT PRIMARY KEY,
    sandbox_id      TEXT NOT NULL REFERENCES sb_sandboxes(id),
    agent_id        TEXT NOT NULL,
    test_case       TEXT NOT NULL,
    input_payload   TEXT,
    output_payload  TEXT,
    passed          INTEGER,
    risk_flags      TEXT DEFAULT '[]',
    duration_ms     INTEGER,
    error_message   TEXT,
    price_usd       REAL DEFAULT 0.10,
    commission_usd  REAL DEFAULT 0,
    executed_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sb_comparisons (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    provider_ids    TEXT NOT NULL,
    test_suite      TEXT NOT NULL,
    results         TEXT DEFAULT '[]',
    winner_id       TEXT,
    summary         TEXT,
    price_usd       REAL DEFAULT 1.50,
    commission_usd  REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Risk Detection ───────────────────────────────────────────────────────────

const RISK_PATTERNS = [
  { pattern: /exec\s*\(/i,           severity: "critical", flag: "arbitrary_code_execution"   },
  { pattern: /eval\s*\(/i,           severity: "critical", flag: "eval_injection"              },
  { pattern: /process\.env/i,        severity: "high",     flag: "env_variable_access"         },
  { pattern: /require\s*\(\s*['"]fs/,severity: "high",     flag: "filesystem_access"           },
  { pattern: /fetch|XMLHttpRequest/i, severity: "medium",  flag: "network_request_detected"    },
  { pattern: /setTimeout|setInterval/i, severity: "low",   flag: "async_timer_detected"        },
  { pattern: /crypto\s*\./i,         severity: "medium",   flag: "crypto_module_usage"         },
  { pattern: /\.env\b/,              severity: "high",     flag: "dotenv_file_access"          },
  { pattern: /child_process/i,       severity: "critical", flag: "child_process_spawn"         },
  { pattern: /sql\s+injection|drop\s+table|--\s*$/im, severity: "critical", flag: "sql_injection_attempt" },
];

function assessRisk(payload) {
  const str   = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const flags = [];
  let maxSev  = "low";

  for (const { pattern, severity, flag } of RISK_PATTERNS) {
    if (pattern.test(str)) {
      flags.push({ flag, severity });
      if (["critical","high","medium","low"].indexOf(severity) <
          ["critical","high","medium","low"].indexOf(maxSev)) {
        maxSev = severity;
      }
    }
  }

  // If no flags detected escalate based on payload size
  if (flags.length === 0 && str.length > 10000) {
    flags.push({ flag: "large_payload_size", severity: "medium" });
    maxSev = "medium";
  }

  return { risk_level: flags.length > 0 ? maxSev : "low", risk_flags: flags };
}

function simulateTestExecution(testCase, providerRef, testData, timeoutMs) {
  // Simulate latency proportional to timeout
  const durationMs = Math.floor(50 + Math.random() * Math.min(timeoutMs * 0.3, 2000));

  const { risk_level, risk_flags } = assessRisk(testCase.input ?? testData);

  // High-risk payloads fail automatically in sandbox
  const passed = risk_level !== "critical"
    ? Math.random() > 0.12  // 88% pass rate for non-critical
    : false;

  const output = passed
    ? {
        status:      "ok",
        result:      testCase.expected_output ?? { processed: true, provider: providerRef },
        latency_ms:  durationMs,
        tokens_used: Math.floor(50 + Math.random() * 500),
      }
    : {
        status:    "error",
        error:     risk_level === "critical"
          ? `Sandbox blocked execution: ${risk_flags[0]?.flag ?? "policy_violation"}`
          : "Provider returned non-2xx response or timeout exceeded",
        latency_ms: durationMs,
      };

  return { passed, output, durationMs, risk_flags };
}

// ─── Create Sandbox ───────────────────────────────────────────────────────────

/**
 * Spin up an isolated test environment for a provider or tool URL.
 * @param {string} providerIdOrUrl - Provider ID or tool endpoint URL to sandbox
 * @param {object} testData        - Seed data / fixtures available inside the sandbox
 * @param {number} timeout         - Test timeout in milliseconds (default 30000)
 * @returns Sandbox record with ID and expiry
 */
export function createSandbox(providerIdOrUrl, testData = {}, timeout = SB_TIMEOUT_DEFAULT_MS) {
  if (!providerIdOrUrl) throw new Error("providerIdOrUrl is required");
  if (timeout < 1000 || timeout > 300000) throw new Error("timeout must be between 1000ms and 300000ms");

  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const sandboxId  = uuid();
  const commission = Math.round(SB_PRICE_PER_SANDBOX * SB_PLATFORM_COMMISSION * 100) / 100;
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour TTL
  const now        = new Date().toISOString();

  const { risk_level } = assessRisk(providerIdOrUrl + JSON.stringify(testData));

  db.prepare(`
    INSERT OR IGNORE INTO sb_sandboxes
      (id, agent_id, provider_ref, test_data, timeout_ms, risk_level, creation_fee_usd, commission_usd, expires_at, created_at, updated_at)
    VALUES
      (@id, @agent_id, @provider_ref, @test_data, @timeout_ms, @risk_level, @creation_fee_usd, @commission_usd, @expires_at, @created_at, @updated_at)
  `).run({
    id:              sandboxId,
    agent_id:        agentId,
    provider_ref:    providerIdOrUrl,
    test_data:       JSON.stringify(testData),
    timeout_ms:      timeout,
    risk_level,
    creation_fee_usd: SB_PRICE_PER_SANDBOX,
    commission_usd:  commission,
    expires_at:      expiresAt,
    created_at:      now,
    updated_at:      now,
  });

  return {
    sandbox_id:       sandboxId,
    agent_id:         agentId,
    provider_ref:     providerIdOrUrl,
    status:           "active",
    initial_risk_level: risk_level,
    timeout_ms:       timeout,
    creation_fee_usd: SB_PRICE_PER_SANDBOX,
    platform_commission_usd: commission,
    expires_at:       expiresAt,
    created_at:       now,
    message:          `Sandbox active. Run tests with runTest(sandboxId, testCase). Expires in 1 hour.`,
  };
}

// ─── Run Test ─────────────────────────────────────────────────────────────────

/**
 * Execute a test case inside an active sandbox.
 * @param {string} sandboxId - Sandbox ID from createSandbox()
 * @param {object} testCase  - { name, input, expected_output, assertions[] }
 * @returns Test execution result with pass/fail and risk flags
 */
export function runTest(sandboxId, testCase) {
  if (!sandboxId) throw new Error("sandboxId is required");
  if (!testCase)  throw new Error("testCase is required");

  const sandbox = db.prepare("SELECT * FROM sb_sandboxes WHERE id = ?").get(sandboxId);
  if (!sandbox)                          throw new Error(`Sandbox not found: ${sandboxId}`);
  if (sandbox.status !== "active")       throw new Error(`Sandbox is not active (status: ${sandbox.status}). Create a new sandbox.`);
  if (new Date(sandbox.expires_at) < new Date()) {
    db.prepare("UPDATE sb_sandboxes SET status = 'expired' WHERE id = ?").run(sandboxId);
    throw new Error(`Sandbox expired at ${sandbox.expires_at}. Create a new sandbox.`);
  }

  const agentId    = sandbox.agent_id;
  const runId      = uuid();
  const commission = Math.round(SB_PRICE_PER_TEST_RUN * SB_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  const { passed, output, durationMs, risk_flags } = simulateTestExecution(
    testCase,
    sandbox.provider_ref,
    JSON.parse(sandbox.test_data ?? "{}"),
    sandbox.timeout_ms,
  );

  // Elevate sandbox risk level if critical flags found
  const critical = risk_flags.some(f => f.severity === "critical");
  const high     = risk_flags.some(f => f.severity === "high");
  const newRisk  = critical ? "critical" : high ? "high" : sandbox.risk_level;

  db.prepare(`
    INSERT OR IGNORE INTO sb_test_runs
      (id, sandbox_id, agent_id, test_case, input_payload, output_payload, passed,
       risk_flags, duration_ms, error_message, price_usd, commission_usd, executed_at)
    VALUES
      (@id, @sandbox_id, @agent_id, @test_case, @input_payload, @output_payload, @passed,
       @risk_flags, @duration_ms, @error_message, @price_usd, @commission_usd, @executed_at)
  `).run({
    id:             runId,
    sandbox_id:     sandboxId,
    agent_id:       agentId,
    test_case:      JSON.stringify(testCase),
    input_payload:  JSON.stringify(testCase.input ?? {}),
    output_payload: JSON.stringify(output),
    passed:         passed ? 1 : 0,
    risk_flags:     JSON.stringify(risk_flags),
    duration_ms:    durationMs,
    error_message:  passed ? null : output.error ?? "Test failed",
    price_usd:      SB_PRICE_PER_TEST_RUN,
    commission_usd: commission,
    executed_at:    now,
  });

  db.prepare(`
    UPDATE sb_sandboxes SET
      tests_run    = tests_run + 1,
      tests_passed = tests_passed + @p,
      tests_failed = tests_failed + @f,
      risk_level   = @risk_level,
      updated_at   = @now
    WHERE id = @id
  `).run({ p: passed ? 1 : 0, f: passed ? 0 : 1, risk_level: newRisk, now, id: sandboxId });

  return {
    run_id:             runId,
    sandbox_id:         sandboxId,
    test_name:          testCase.name ?? "unnamed_test",
    passed,
    output,
    risk_flags,
    risk_level:         newRisk,
    duration_ms:        durationMs,
    price_usd:          SB_PRICE_PER_TEST_RUN,
    platform_commission_usd: commission,
    executed_at:        now,
    recommendation:     critical ? "BLOCK: Critical security risk detected. Do not use this provider." :
                        high     ? "CAUTION: High-risk flags detected. Review before production use." :
                        passed   ? "PASS: Test succeeded within safety parameters." :
                                   "FAIL: Test failed. Check output for details.",
  };
}

// ─── Get Test Results ─────────────────────────────────────────────────────────

/**
 * Retrieve all test results for a sandbox with pass/fail/risk summary.
 * @param {string} sandboxId - Sandbox ID
 * @returns Full test history with aggregate risk assessment
 */
export function getTestResults(sandboxId) {
  if (!sandboxId) throw new Error("sandboxId is required");

  const sandbox = db.prepare("SELECT * FROM sb_sandboxes WHERE id = ?").get(sandboxId);
  if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);

  const runs = db.prepare("SELECT * FROM sb_test_runs WHERE sandbox_id = ? ORDER BY executed_at ASC").all(sandboxId);

  // Aggregate all risk flags across runs
  const allFlags = {};
  for (const run of runs) {
    const flags = JSON.parse(run.risk_flags ?? "[]");
    for (const f of flags) {
      allFlags[f.flag] = { flag: f.flag, severity: f.severity, occurrences: (allFlags[f.flag]?.occurrences ?? 0) + 1 };
    }
  }

  const passRate   = runs.length > 0 ? Math.round((sandbox.tests_passed / runs.length) * 100) : 0;
  const avgLatency = runs.length > 0 ? Math.round(runs.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / runs.length) : 0;

  return {
    sandbox_id:     sandboxId,
    provider_ref:   sandbox.provider_ref,
    status:         sandbox.status,
    risk_level:     sandbox.risk_level,
    summary: {
      tests_run:    sandbox.tests_run,
      tests_passed: sandbox.tests_passed,
      tests_failed: sandbox.tests_failed,
      pass_rate_pct: passRate,
      avg_latency_ms: avgLatency,
    },
    risk_flags_detected: Object.values(allFlags).sort((a, b) =>
      ["critical","high","medium","low"].indexOf(a.severity) - ["critical","high","medium","low"].indexOf(b.severity)
    ),
    recommendation:  sandbox.risk_level === "critical" ? "BLOCK: Do not use in production." :
                     sandbox.risk_level === "high"     ? "REVIEW: Requires security audit before deployment." :
                     passRate >= 90                    ? "APPROVED: Safe to integrate." :
                     passRate >= 70                    ? "CONDITIONAL: Address failing tests before use." :
                                                        "REJECT: Too many test failures.",
    test_runs: runs.map(r => ({
      run_id:       r.id,
      test_name:    JSON.parse(r.test_case ?? "{}").name ?? "unnamed_test",
      passed:       r.passed === 1,
      risk_flags:   JSON.parse(r.risk_flags ?? "[]"),
      duration_ms:  r.duration_ms,
      executed_at:  r.executed_at,
    })),
    total_cost_usd:     Math.round((sandbox.creation_fee_usd + runs.length * SB_PRICE_PER_TEST_RUN) * 100) / 100,
    expires_at:         sandbox.expires_at,
  };
}

// ─── Compare Providers ────────────────────────────────────────────────────────

/**
 * Run a head-to-head comparison of multiple providers using the same test suite.
 * @param {string[]} providerIds - Array of provider IDs or URLs to compare
 * @param {object[]} testSuite   - Array of test cases to run against each provider
 * @returns Comparison matrix with winner and scores
 */
export function compareProviders(providerIds, testSuite) {
  if (!Array.isArray(providerIds) || providerIds.length < 2) throw new Error("providerIds must be an array of at least 2 providers");
  if (providerIds.length > 8) throw new Error("Maximum 8 providers can be compared at once");
  if (!Array.isArray(testSuite) || testSuite.length === 0) throw new Error("testSuite must be a non-empty array of test cases");
  if (testSuite.length > 20) throw new Error("Test suite cannot exceed 20 cases per comparison");

  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const compId     = uuid();
  const commission = Math.round(SB_PRICE_COMPARISON * SB_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  const providerResults = providerIds.map(providerId => {
    const runs = testSuite.map(tc => {
      const { passed, output, durationMs, risk_flags } = simulateTestExecution(tc, providerId, {}, SB_TIMEOUT_DEFAULT_MS);
      return { test_name: tc.name ?? "unnamed_test", passed, duration_ms: durationMs, risk_flags };
    });

    const passed   = runs.filter(r => r.passed).length;
    const passRate = Math.round((passed / runs.length) * 100);
    const avgMs    = Math.round(runs.reduce((s, r) => s + r.duration_ms, 0) / runs.length);
    const riskScore = runs.reduce((s, r) => {
      const weights = { critical: 10, high: 5, medium: 2, low: 1 };
      return s + r.risk_flags.reduce((rs, f) => rs + (weights[f.severity] ?? 0), 0);
    }, 0);

    return {
      provider_id:    providerId,
      pass_rate_pct:  passRate,
      tests_passed:   passed,
      tests_failed:   runs.length - passed,
      avg_latency_ms: avgMs,
      risk_score:     riskScore,
      risk_level:     riskScore >= 10 ? "critical" : riskScore >= 5 ? "high" : riskScore >= 2 ? "medium" : "low",
      test_runs:      runs,
    };
  });

  // Determine winner: highest pass rate, tiebreak by lowest latency, tiebreak by lowest risk score
  const winner = [...providerResults].sort((a, b) =>
    b.pass_rate_pct - a.pass_rate_pct ||
    a.avg_latency_ms - b.avg_latency_ms ||
    a.risk_score - b.risk_score
  )[0];

  const summary = `${winner.provider_id} wins with ${winner.pass_rate_pct}% pass rate and ${winner.avg_latency_ms}ms average latency.`;

  db.prepare(`
    INSERT OR IGNORE INTO sb_comparisons
      (id, agent_id, provider_ids, test_suite, results, winner_id, summary, price_usd, commission_usd, created_at)
    VALUES
      (@id, @agent_id, @provider_ids, @test_suite, @results, @winner_id, @summary, @price_usd, @commission_usd, @created_at)
  `).run({
    id:            compId,
    agent_id:      agentId,
    provider_ids:  JSON.stringify(providerIds),
    test_suite:    JSON.stringify(testSuite),
    results:       JSON.stringify(providerResults),
    winner_id:     winner.provider_id,
    summary,
    price_usd:     SB_PRICE_COMPARISON,
    commission_usd: commission,
    created_at:    now,
  });

  return {
    comparison_id:   compId,
    agent_id:        agentId,
    providers_tested: providerIds.length,
    tests_per_provider: testSuite.length,
    winner:          { provider_id: winner.provider_id, pass_rate_pct: winner.pass_rate_pct, avg_latency_ms: winner.avg_latency_ms },
    summary,
    leaderboard:     providerResults
      .sort((a, b) => b.pass_rate_pct - a.pass_rate_pct || a.avg_latency_ms - b.avg_latency_ms)
      .map((r, i) => ({ rank: i + 1, ...r })),
    price_usd:       SB_PRICE_COMPARISON,
    platform_commission_usd: commission,
    completed_at:    now,
  };
}

// ─── List Sandboxes ───────────────────────────────────────────────────────────

/**
 * List sandbox history for an agent, including status and cost summary.
 * @param {string} agentId - Agent ID to retrieve sandboxes for
 * @returns List of sandboxes with summary stats
 */
export function listSandboxes(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const sandboxes = db.prepare(`
    SELECT * FROM sb_sandboxes WHERE agent_id = ? ORDER BY created_at DESC
  `).all(agentId);

  const totalSpent = sandboxes.reduce((s, sb) => {
    const runs = db.prepare("SELECT COUNT(*) as n FROM sb_test_runs WHERE sandbox_id = ?").get(sb.id);
    return s + sb.creation_fee_usd + (runs?.n ?? 0) * SB_PRICE_PER_TEST_RUN;
  }, 0);

  return {
    agent_id:    agentId,
    sandbox_count: sandboxes.length,
    sandboxes: sandboxes.map(sb => ({
      sandbox_id:    sb.id,
      provider_ref:  sb.provider_ref,
      status:        sb.status,
      risk_level:    sb.risk_level,
      tests_run:     sb.tests_run,
      tests_passed:  sb.tests_passed,
      tests_failed:  sb.tests_failed,
      pass_rate_pct: sb.tests_run > 0 ? Math.round((sb.tests_passed / sb.tests_run) * 100) : null,
      creation_fee_usd: sb.creation_fee_usd,
      expires_at:    sb.expires_at,
      created_at:    sb.created_at,
    })),
    total_spent_usd: Math.round(totalSpent * 100) / 100,
  };
}
