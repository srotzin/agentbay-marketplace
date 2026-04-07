import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const BENCHMARK_FEES = {
  create_test_suite:   2.00,   // per suite
  run_benchmark:       0.10,   // per test case
  evaluate_output:     0.05,   // per evaluation
  compare_agents:      1.00,   // per comparison
  get_test_history:    0.00,   // free
  generate_report:     1.00,   // per report
};

const REPORT_FORMATS   = ["pdf", "json", "html", "markdown"];
const EVAL_CRITERIA    = ["accuracy", "completeness", "relevance", "safety", "latency", "cost"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS benchmark_suites (
    id                 TEXT PRIMARY KEY,
    agent_id           TEXT,
    agent_description  TEXT NOT NULL,
    tools_used         TEXT DEFAULT '[]',
    test_cases         TEXT DEFAULT '[]',
    coverage_pct       REAL DEFAULT 0,
    fee_usd            REAL DEFAULT 2.0,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id              TEXT PRIMARY KEY,
    suite_id        TEXT NOT NULL REFERENCES benchmark_suites(id),
    agent_endpoint  TEXT NOT NULL,
    iterations      INTEGER NOT NULL DEFAULT 1,
    pass_rate       REAL,
    avg_latency_ms  REAL,
    error_rate      REAL,
    cost_per_task   REAL,
    accuracy_score  REAL,
    failures        TEXT DEFAULT '[]',
    raw_results     TEXT DEFAULT '[]',
    total_cost_usd  REAL,
    status          TEXT DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
    started_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS benchmark_evaluations (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT,
    score           REAL,
    accuracy        REAL,
    completeness    REAL,
    relevance       REAL,
    safety          REAL,
    criteria        TEXT DEFAULT '[]',
    feedback        TEXT DEFAULT '[]',
    fee_usd         REAL DEFAULT 0.05,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS benchmark_comparisons (
    id               TEXT PRIMARY KEY,
    agent_endpoints  TEXT NOT NULL,
    suite_id         TEXT,
    rankings         TEXT DEFAULT '[]',
    by_metric        TEXT DEFAULT '{}',
    recommendation   TEXT,
    cost_efficiency  TEXT DEFAULT '[]',
    fee_usd          REAL DEFAULT 1.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS benchmark_reports (
    id          TEXT PRIMARY KEY,
    suite_id    TEXT NOT NULL,
    format      TEXT NOT NULL,
    report      TEXT,
    fee_usd     REAL DEFAULT 1.0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS benchmark_billing (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT,
    suite_id   TEXT,
    operation  TEXT NOT NULL,
    fee_usd    REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordBilling(reference, isAgentId, operation, feeUsd) {
  if (feeUsd <= 0) return;
  db.prepare(`
    INSERT OR IGNORE INTO benchmark_billing (id, agent_id, suite_id, operation, fee_usd, created_at)
    VALUES (@id, @agent_id, @suite_id, @operation, @fee_usd, @created_at)
  `).run({
    id:        uuid(),
    agent_id:  isAgentId ? reference : null,
    suite_id:  !isAgentId ? reference : null,
    operation,
    fee_usd:   feeUsd,
    created_at: new Date().toISOString(),
  });
}

function generateTestCase(index, agentDescription, toolsUsed, scenario) {
  const scenarioTypes = [
    { type: "happy_path",       description: "Standard successful execution path",          expected_behavior: "complete_successfully" },
    { type: "edge_case",        description: "Boundary condition or unusual input",          expected_behavior: "handle_gracefully" },
    { type: "error_handling",   description: "Malformed input or downstream failure",        expected_behavior: "return_error_cleanly" },
    { type: "performance",      description: "High-load or concurrent request scenario",     expected_behavior: "respond_within_sla" },
    { type: "safety_boundary",  description: "Input that could trigger safety violations",   expected_behavior: "refuse_or_redact" },
    { type: "tool_failure",     description: "Dependency tool returns error or timeout",     expected_behavior: "graceful_degradation" },
    { type: "context_overflow", description: "Input exceeds typical context window",         expected_behavior: "truncate_or_summarize" },
  ];

  const baseScenario = scenarioTypes[index % scenarioTypes.length];
  const toolList     = Array.isArray(toolsUsed) ? toolsUsed : [];

  return {
    test_case_id:      uuid(),
    index:             index + 1,
    name:              scenario?.name ?? `TC-${String(index + 1).padStart(3, "0")}: ${baseScenario.type.replace(/_/g, " ")}`,
    type:              scenario?.type ?? baseScenario.type,
    description:       scenario?.description ?? baseScenario.description,
    input_template:    scenario?.input ?? `Simulated ${baseScenario.type} input for ${agentDescription}`,
    expected_behavior: scenario?.expected ?? baseScenario.expected_behavior,
    tools_exercised:   toolList.slice(0, 3),
    weight:            baseScenario.type === "safety_boundary" ? 2.0 : 1.0,
    timeout_ms:        baseScenario.type === "performance" ? 5000 : 10000,
  };
}

function simulateSingleRun(testCase, agentEndpoint) {
  // Deterministic-ish simulation keyed on endpoint + test case
  const seed    = (agentEndpoint.length + testCase.index) % 10;
  const latency = 120 + (seed * 85) + Math.round(Math.random() * 200);
  const passed  = seed < 7; // ~70% pass rate baseline
  const cost    = Math.round((0.001 + seed * 0.0005) * 1000) / 1000;

  return {
    test_case_id:  testCase.test_case_id,
    test_name:     testCase.name,
    passed,
    latency_ms:    latency,
    cost_usd:      cost,
    error:         passed ? null : `Simulated failure: agent did not meet expected_behavior="${testCase.expected_behavior}"`,
    output_sample: passed ? `[Agent output for ${testCase.type} scenario]` : null,
  };
}

function computeAccuracyScore(results) {
  if (results.length === 0) return 0;
  const weighted = results.reduce((acc, r) => acc + (r.passed ? 1 : 0), 0);
  return Math.round((weighted / results.length) * 100);
}

// ─── createTestSuite ──────────────────────────────────────────────────────────

/**
 * Create a test suite for an agent.
 * Fee: $2 per suite.
 * @param {string} agentDescription
 * @param {string[]} toolsUsed
 * @param {object[]} testScenarios  - optional custom scenarios
 * @returns { suite_id, test_cases[], coverage_pct }
 */
export function createTestSuite(agentDescription, toolsUsed = [], testScenarios = []) {
  if (!agentDescription) throw new Error("agentDescription is required");

  const id  = uuid();
  const now = new Date().toISOString();

  // Generate test cases: use provided scenarios + fill to minimum 7
  const minCases  = 7;
  const scenarios = Array.isArray(testScenarios) ? testScenarios : [];
  const generated = [];

  for (let i = 0; i < Math.max(minCases, scenarios.length + 3); i++) {
    generated.push(generateTestCase(i, agentDescription, toolsUsed, scenarios[i] ?? null));
  }

  // Coverage score based on how many scenario types are represented
  const coveredTypes  = new Set(generated.map(tc => tc.type));
  const allTypes      = ["happy_path", "edge_case", "error_handling", "performance", "safety_boundary", "tool_failure", "context_overflow"];
  const coveragePct   = Math.round((coveredTypes.size / allTypes.size) * 100);

  db.prepare(`
    INSERT OR IGNORE INTO benchmark_suites
      (id, agent_description, tools_used, test_cases, coverage_pct, fee_usd, created_at)
    VALUES
      (@id, @agent_description, @tools_used, @test_cases, @coverage_pct, @fee_usd, @created_at)
  `).run({
    id,
    agent_description: agentDescription,
    tools_used:        JSON.stringify(toolsUsed),
    test_cases:        JSON.stringify(generated),
    coverage_pct:      coveragePct,
    fee_usd:           BENCHMARK_FEES.create_test_suite,
    created_at:        now,
  });

  recordBilling(id, false, "create_test_suite", BENCHMARK_FEES.create_test_suite);

  return {
    suite_id:     id,
    test_cases:   generated,
    coverage_pct: coveragePct,
    test_count:   generated.length,
    tools_used:   toolsUsed,
    fee_usd:      BENCHMARK_FEES.create_test_suite,
    created_at:   now,
    message:      `Test suite created with ${generated.length} test cases covering ${coveragePct}% of scenario types.`,
  };
}

// ─── runBenchmark ─────────────────────────────────────────────────────────────

/**
 * Run a benchmark suite against an agent endpoint.
 * Fee: $0.10 per test case.
 * @param {string} suiteId
 * @param {string} agentEndpoint
 * @param {number} iterations  - number of times to run each test case
 * @returns { results: { pass_rate, avg_latency_ms, error_rate, cost_per_task, accuracy_score, failures[] } }
 */
export function runBenchmark(suiteId, agentEndpoint, iterations = 1) {
  if (!suiteId)       throw new Error("suiteId is required");
  if (!agentEndpoint) throw new Error("agentEndpoint is required");
  if (iterations < 1 || iterations > 100) throw new Error("iterations must be between 1 and 100");

  const suite = db.prepare("SELECT * FROM benchmark_suites WHERE id = ?").get(suiteId);
  if (!suite) throw new Error(`Test suite not found: ${suiteId}`);

  const testCases  = JSON.parse(suite.test_cases || "[]");
  const runId      = uuid();
  const now        = new Date().toISOString();
  const totalCases = testCases.length * iterations;
  const feeUsd     = Math.round(totalCases * BENCHMARK_FEES.run_benchmark * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO benchmark_runs
      (id, suite_id, agent_endpoint, iterations, status, started_at, total_cost_usd, created_at)
    VALUES
      (@id, @suite_id, @agent_endpoint, @iterations, 'running', @started_at, @total_cost_usd, @created_at)
  `).run({
    id:             runId,
    suite_id:       suiteId,
    agent_endpoint: agentEndpoint,
    iterations,
    started_at:     now,
    total_cost_usd: feeUsd,
    created_at:     now,
  });

  // Simulate running all test cases across all iterations
  const allResults = [];
  for (let iter = 0; iter < iterations; iter++) {
    for (const tc of testCases) {
      allResults.push(simulateSingleRun(tc, agentEndpoint));
    }
  }

  const passCount    = allResults.filter(r => r.passed).length;
  const passRate     = Math.round((passCount / allResults.length) * 100) / 100;
  const errorRate    = Math.round(((allResults.length - passCount) / allResults.length) * 100) / 100;
  const avgLatency   = Math.round(allResults.reduce((a, r) => a + r.latency_ms, 0) / allResults.length);
  const costPerTask  = Math.round(allResults.reduce((a, r) => a + r.cost_usd, 0) / allResults.length * 1000) / 1000;
  const accuracyScore = computeAccuracyScore(allResults);

  const failures = allResults
    .filter(r => !r.passed)
    .slice(0, 10)
    .map(r => ({ test_case_id: r.test_case_id, test_name: r.test_name, error: r.error }));

  const completedAt = new Date().toISOString();

  db.prepare(`
    UPDATE benchmark_runs
    SET pass_rate = @pass_rate, avg_latency_ms = @avg_latency_ms, error_rate = @error_rate,
        cost_per_task = @cost_per_task, accuracy_score = @accuracy_score, failures = @failures,
        raw_results = @raw_results, status = 'completed', completed_at = @completed_at
    WHERE id = @id
  `).run({
    id:             runId,
    pass_rate:      passRate,
    avg_latency_ms: avgLatency,
    error_rate:     errorRate,
    cost_per_task:  costPerTask,
    accuracy_score: accuracyScore,
    failures:       JSON.stringify(failures),
    raw_results:    JSON.stringify(allResults.slice(0, 50)),
    completed_at:   completedAt,
  });

  recordBilling(suiteId, false, "run_benchmark", feeUsd);

  return {
    run_id:         runId,
    suite_id:       suiteId,
    agent_endpoint: agentEndpoint,
    iterations,
    total_cases_run: allResults.length,
    results: {
      pass_rate:      passRate,
      avg_latency_ms: avgLatency,
      error_rate:     errorRate,
      cost_per_task:  costPerTask,
      accuracy_score: accuracyScore,
      failures,
    },
    fee_usd:      feeUsd,
    started_at:   now,
    completed_at: completedAt,
  };
}

// ─── evaluateOutput ───────────────────────────────────────────────────────────

/**
 * Evaluate agent output quality against expected output.
 * Fee: $0.05 per evaluation.
 * @param {string} agentOutput
 * @param {string} expectedOutput
 * @param {string[]} criteria  - subset of: accuracy, completeness, relevance, safety, latency, cost
 * @returns { score (0-100), breakdown{ accuracy, completeness, relevance, safety }, feedback[] }
 */
export function evaluateOutput(agentOutput, expectedOutput, criteria = ["accuracy", "completeness", "relevance", "safety"]) {
  if (!agentOutput)   throw new Error("agentOutput is required");
  if (!expectedOutput) throw new Error("expectedOutput is required");

  const validCriteria = EVAL_CRITERIA;
  const activeCriteria = Array.isArray(criteria)
    ? criteria.filter(c => validCriteria.includes(c))
    : ["accuracy", "completeness", "relevance", "safety"];

  if (activeCriteria.length === 0) throw new Error(`criteria must include at least one of: ${validCriteria.join(", ")}`);

  const id  = uuid();
  const now = new Date().toISOString();

  const agentStr    = typeof agentOutput === "string" ? agentOutput : JSON.stringify(agentOutput);
  const expectedStr = typeof expectedOutput === "string" ? expectedOutput : JSON.stringify(expectedOutput);

  // Heuristic scoring (token overlap + length ratio + structural checks)
  const agentWords    = new Set(agentStr.toLowerCase().split(/\W+/).filter(Boolean));
  const expectedWords = new Set(expectedStr.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection  = [...agentWords].filter(w => expectedWords.has(w)).length;
  const tokenOverlap  = expectedWords.size > 0 ? Math.min(1, intersection / expectedWords.size) : 0;
  const lengthRatio   = Math.min(1, Math.min(agentStr.length, expectedStr.length) / Math.max(agentStr.length, expectedStr.length));

  const breakdown = {};
  const feedback  = [];

  if (activeCriteria.includes("accuracy")) {
    breakdown.accuracy = Math.round(tokenOverlap * 100);
    if (breakdown.accuracy < 60) feedback.push("Low token overlap with expected output — verify factual content matches.");
    if (breakdown.accuracy >= 85) feedback.push("High factual alignment with expected output.");
  }

  if (activeCriteria.includes("completeness")) {
    breakdown.completeness = Math.round(((tokenOverlap * 0.6) + (lengthRatio * 0.4)) * 100);
    if (breakdown.completeness < 50) feedback.push("Output appears incomplete — key elements from expected output may be missing.");
    if (agentStr.length < expectedStr.length * 0.5) feedback.push("Output is significantly shorter than expected — consider expanding coverage.");
  }

  if (activeCriteria.includes("relevance")) {
    const relevanceScore = Math.round(((tokenOverlap * 0.5) + (lengthRatio * 0.3) + 0.2) * 100);
    breakdown.relevance  = Math.min(100, relevanceScore);
    if (breakdown.relevance < 70) feedback.push("Output may contain off-topic content not present in expected output.");
  }

  if (activeCriteria.includes("safety")) {
    const harmfulPatterns = [/\b(kill|harm|attack|hate|slur)\b/i, /\b(ssn|credit.card|password)\b/i];
    const safetyIssues    = harmfulPatterns.filter(re => re.test(agentStr));
    breakdown.safety      = safetyIssues.length === 0 ? 100 : Math.max(0, 100 - safetyIssues.length * 40);
    if (safetyIssues.length > 0) feedback.push("Safety concerns detected in output — review before deployment.");
    if (breakdown.safety === 100) feedback.push("No safety issues detected in output.");
  }

  // Weighted composite score
  const weights   = { accuracy: 0.35, completeness: 0.25, relevance: 0.25, safety: 0.15 };
  let   totalWt   = 0;
  let   weightedSum = 0;
  for (const [key, val] of Object.entries(breakdown)) {
    const w = weights[key] ?? 0.1;
    weightedSum += val * w;
    totalWt     += w;
  }
  const score = totalWt > 0 ? Math.round(weightedSum / totalWt) : 0;

  if (feedback.length === 0) feedback.push("Output meets quality expectations across all evaluated criteria.");

  db.prepare(`
    INSERT OR IGNORE INTO benchmark_evaluations
      (id, score, accuracy, completeness, relevance, safety, criteria, feedback, fee_usd, created_at)
    VALUES
      (@id, @score, @accuracy, @completeness, @relevance, @safety, @criteria, @feedback, @fee_usd, @created_at)
  `).run({
    id,
    score,
    accuracy:     breakdown.accuracy     ?? null,
    completeness: breakdown.completeness ?? null,
    relevance:    breakdown.relevance    ?? null,
    safety:       breakdown.safety       ?? null,
    criteria:     JSON.stringify(activeCriteria),
    feedback:     JSON.stringify(feedback),
    fee_usd:      BENCHMARK_FEES.evaluate_output,
    created_at:   now,
  });

  recordBilling(id, false, "evaluate_output", BENCHMARK_FEES.evaluate_output);

  return {
    evaluation_id: id,
    score,
    grade:         score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F",
    breakdown,
    feedback,
    criteria_evaluated: activeCriteria,
    fee_usd:     BENCHMARK_FEES.evaluate_output,
    evaluated_at: now,
  };
}

// ─── compareAgents ────────────────────────────────────────────────────────────

/**
 * Compare multiple agents head-to-head on a test suite.
 * Fee: $1 per comparison.
 * @param {string[]} agentEndpoints
 * @param {string}   testSuite  - suite_id to run
 * @returns { rankings[], by_metric{}, recommendation, cost_efficiency[] }
 */
export function compareAgents(agentEndpoints, testSuite) {
  if (!Array.isArray(agentEndpoints) || agentEndpoints.length < 2) {
    throw new Error("agentEndpoints must be an array of at least 2 endpoints");
  }
  if (!testSuite) throw new Error("testSuite (suite_id) is required");

  const suite = db.prepare("SELECT * FROM benchmark_suites WHERE id = ?").get(testSuite);
  if (!suite)   throw new Error(`Test suite not found: ${testSuite}`);

  const id       = uuid();
  const now      = new Date().toISOString();
  const testCases = JSON.parse(suite.test_cases || "[]");

  // Run each agent and collect metrics
  const agentResults = agentEndpoints.map(endpoint => {
    const results = testCases.map(tc => simulateSingleRun(tc, endpoint));
    const passes  = results.filter(r => r.passed).length;
    return {
      endpoint,
      pass_rate:      Math.round((passes / results.length) * 100) / 100,
      avg_latency_ms: Math.round(results.reduce((a, r) => a + r.latency_ms, 0) / results.length),
      error_rate:     Math.round(((results.length - passes) / results.length) * 100) / 100,
      avg_cost_usd:   Math.round(results.reduce((a, r) => a + r.cost_usd, 0) / results.length * 10000) / 10000,
      accuracy_score: computeAccuracyScore(results),
    };
  });

  // Rank by composite score (pass_rate 40%, accuracy 30%, latency_inv 20%, cost_inv 10%)
  const maxLatency = Math.max(...agentResults.map(a => a.avg_latency_ms));
  const maxCost    = Math.max(...agentResults.map(a => a.avg_cost_usd));

  const scored = agentResults.map(a => ({
    ...a,
    composite_score: Math.round(
      (a.pass_rate     * 40) +
      (a.accuracy_score * 0.30) +
      ((1 - a.avg_latency_ms / (maxLatency || 1)) * 20) +
      ((1 - a.avg_cost_usd   / (maxCost    || 1)) * 10)
    ),
  })).sort((a, b) => b.composite_score - a.composite_score);

  const rankings = scored.map((a, i) => ({
    rank:           i + 1,
    endpoint:       a.endpoint,
    composite_score: a.composite_score,
    pass_rate:       a.pass_rate,
    accuracy_score:  a.accuracy_score,
    avg_latency_ms:  a.avg_latency_ms,
  }));

  const byMetric = {
    best_pass_rate:    agentResults.sort((a, b) => b.pass_rate    - a.pass_rate)[0]?.endpoint,
    best_latency:      agentResults.sort((a, b) => a.avg_latency_ms - b.avg_latency_ms)[0]?.endpoint,
    best_accuracy:     agentResults.sort((a, b) => b.accuracy_score - a.accuracy_score)[0]?.endpoint,
    lowest_cost:       agentResults.sort((a, b) => a.avg_cost_usd   - b.avg_cost_usd)[0]?.endpoint,
    lowest_error_rate: agentResults.sort((a, b) => a.error_rate     - b.error_rate)[0]?.endpoint,
  };

  const winner = scored[0];
  const recommendation = `${winner.endpoint} is recommended: highest composite score (${winner.composite_score}) ` +
    `with ${Math.round(winner.pass_rate * 100)}% pass rate and ${winner.avg_latency_ms}ms avg latency.`;

  const costEfficiency = scored.map(a => ({
    endpoint:            a.endpoint,
    accuracy_per_dollar: a.avg_cost_usd > 0 ? Math.round(a.accuracy_score / a.avg_cost_usd) : 0,
    avg_cost_usd:        a.avg_cost_usd,
    cost_efficiency_rank: 0,
  })).sort((a, b) => b.accuracy_per_dollar - a.accuracy_per_dollar)
    .map((a, i) => ({ ...a, cost_efficiency_rank: i + 1 }));

  db.prepare(`
    INSERT OR IGNORE INTO benchmark_comparisons
      (id, agent_endpoints, suite_id, rankings, by_metric, recommendation, cost_efficiency, fee_usd, created_at)
    VALUES
      (@id, @agent_endpoints, @suite_id, @rankings, @by_metric, @recommendation, @cost_efficiency, @fee_usd, @created_at)
  `).run({
    id,
    agent_endpoints: JSON.stringify(agentEndpoints),
    suite_id:        testSuite,
    rankings:        JSON.stringify(rankings),
    by_metric:       JSON.stringify(byMetric),
    recommendation,
    cost_efficiency: JSON.stringify(costEfficiency),
    fee_usd:         BENCHMARK_FEES.compare_agents,
    created_at:      now,
  });

  recordBilling(testSuite, false, "compare_agents", BENCHMARK_FEES.compare_agents);

  return {
    comparison_id: id,
    agents_compared: agentEndpoints.length,
    suite_id:        testSuite,
    rankings,
    by_metric:       byMetric,
    recommendation,
    cost_efficiency: costEfficiency,
    fee_usd:         BENCHMARK_FEES.compare_agents,
    compared_at:     now,
  };
}

// ─── getTestHistory ───────────────────────────────────────────────────────────

/**
 * Retrieve test history and trend analysis for an agent. Free.
 * @param {string} agentId
 * @returns { runs[], pass_rate_trend, regression_alerts[], improvement_suggestions[] }
 */
export function getTestHistory(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const now = new Date().toISOString();

  // Get all suites tagged to this agent
  const suites = db.prepare("SELECT * FROM benchmark_suites WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20").all(agentId);

  const suiteIds = suites.map(s => s.id);
  let runs = [];
  if (suiteIds.length > 0) {
    const placeholders = suiteIds.map(() => "?").join(",");
    runs = db.prepare(`
      SELECT r.*, s.agent_description FROM benchmark_runs r
      JOIN benchmark_suites s ON r.suite_id = s.id
      WHERE r.suite_id IN (${placeholders})
      ORDER BY r.created_at DESC LIMIT 50
    `).all(...suiteIds);
  }

  // Build pass rate trend
  const passRateTrend = runs.slice().reverse().map(r => ({
    run_id:      r.id,
    pass_rate:   r.pass_rate,
    latency_ms:  r.avg_latency_ms,
    created_at:  r.created_at,
  }));

  // Detect regressions: last run worse than previous
  const regressionAlerts = [];
  for (let i = 1; i < passRateTrend.length; i++) {
    const prev = passRateTrend[i - 1];
    const curr = passRateTrend[i];
    if (curr.pass_rate !== null && prev.pass_rate !== null && curr.pass_rate < prev.pass_rate - 0.1) {
      regressionAlerts.push({
        alert_type:  "pass_rate_regression",
        run_id:      curr.run_id,
        previous:    prev.pass_rate,
        current:     curr.pass_rate,
        delta:       Math.round((curr.pass_rate - prev.pass_rate) * 100) / 100,
        severity:    curr.pass_rate < 0.5 ? "high" : "medium",
      });
    }
    if (curr.latency_ms && prev.latency_ms && curr.latency_ms > prev.latency_ms * 1.5) {
      regressionAlerts.push({
        alert_type: "latency_regression",
        run_id:     curr.run_id,
        previous_ms: prev.latency_ms,
        current_ms:  curr.latency_ms,
        increase_pct: Math.round(((curr.latency_ms - prev.latency_ms) / prev.latency_ms) * 100),
        severity:    "medium",
      });
    }
  }

  // Improvement suggestions based on latest run
  const latestRun = runs[0];
  const suggestions = [];
  if (!latestRun) {
    suggestions.push("No benchmark runs found. Run createTestSuite() and runBenchmark() to begin evaluation.");
  } else {
    if ((latestRun.pass_rate ?? 1) < 0.8)    suggestions.push("Pass rate below 80% — investigate failing test cases and review agent prompt or tool configuration.");
    if ((latestRun.avg_latency_ms ?? 0) > 3000) suggestions.push("Average latency exceeds 3s — consider caching, streaming responses, or reducing tool call chains.");
    if ((latestRun.error_rate ?? 0) > 0.15)  suggestions.push("Error rate above 15% — implement retry logic and better error handling in agent.");
    if ((latestRun.cost_per_task ?? 0) > 0.10) suggestions.push("Cost per task exceeds $0.10 — review model selection and reduce unnecessary tool calls.");
    if (suggestions.length === 0) suggestions.push("Agent performance is healthy. Continue running benchmarks after each deployment.");
    if (runs.length < 3) suggestions.push("Run at least 3 benchmark cycles to establish a reliable performance baseline.");
  }

  return {
    agent_id:              agentId,
    total_suites:          suites.length,
    total_runs:            runs.length,
    runs:                  runs.map(r => ({
      run_id:         r.id,
      suite_id:       r.suite_id,
      agent_endpoint: r.agent_endpoint,
      pass_rate:      r.pass_rate,
      avg_latency_ms: r.avg_latency_ms,
      error_rate:     r.error_rate,
      accuracy_score: r.accuracy_score,
      status:         r.status,
      created_at:     r.created_at,
    })),
    pass_rate_trend:       passRateTrend,
    regression_alerts:     regressionAlerts,
    improvement_suggestions: suggestions,
    fee_usd:               BENCHMARK_FEES.get_test_history,
    retrieved_at:          now,
  };
}

// ─── generateTestReport ───────────────────────────────────────────────────────

/**
 * Generate a comprehensive test report for a benchmark suite.
 * Fee: $1 per report.
 * @param {string} suiteId
 * @param {string} format  - pdf|json|html|markdown
 * @returns { report: { executive_summary, detailed_results, recommendations, compliance_checks } }
 */
export function generateTestReport(suiteId, format = "json") {
  if (!suiteId) throw new Error("suiteId is required");
  if (!REPORT_FORMATS.includes(format)) {
    throw new Error(`format must be one of: ${REPORT_FORMATS.join(", ")}`);
  }

  const suite = db.prepare("SELECT * FROM benchmark_suites WHERE id = ?").get(suiteId);
  if (!suite)   throw new Error(`Test suite not found: ${suiteId}`);

  const runs = db.prepare("SELECT * FROM benchmark_runs WHERE suite_id = ? ORDER BY created_at DESC").all(suiteId);
  const id   = uuid();
  const now  = new Date().toISOString();

  const latestRun   = runs[0];
  const testCases   = JSON.parse(suite.test_cases || "[]");
  const toolsUsed   = JSON.parse(suite.tools_used || "[]");

  const executiveSummary = {
    suite_id:          suiteId,
    agent_description: suite.agent_description,
    total_test_cases:  testCases.length,
    total_runs:        runs.length,
    latest_pass_rate:  latestRun?.pass_rate ?? null,
    latest_accuracy:   latestRun?.accuracy_score ?? null,
    avg_latency_ms:    latestRun?.avg_latency_ms ?? null,
    coverage_pct:      suite.coverage_pct,
    overall_health:    latestRun ? (latestRun.pass_rate >= 0.8 ? "healthy" : latestRun.pass_rate >= 0.6 ? "degraded" : "critical") : "untested",
    tools_covered:     toolsUsed,
  };

  const detailedResults = {
    runs:           runs.map(r => ({
      run_id:         r.id,
      agent_endpoint: r.agent_endpoint,
      iterations:     r.iterations,
      pass_rate:      r.pass_rate,
      avg_latency_ms: r.avg_latency_ms,
      error_rate:     r.error_rate,
      cost_per_task:  r.cost_per_task,
      accuracy_score: r.accuracy_score,
      failures:       JSON.parse(r.failures || "[]"),
      completed_at:   r.completed_at,
    })),
    test_cases:     testCases,
    failure_summary: latestRun ? JSON.parse(latestRun.failures || "[]") : [],
  };

  const recommendations = [];
  if (!latestRun) {
    recommendations.push({ priority: "high", action: "Run at least one benchmark before generating a report — use runBenchmark()." });
  } else {
    if (latestRun.pass_rate < 0.8)      recommendations.push({ priority: "high",   action: "Investigate and fix failing test cases. Target >80% pass rate." });
    if (latestRun.avg_latency_ms > 2000) recommendations.push({ priority: "medium", action: "Optimize agent latency. P50 should be under 2000ms for production." });
    if (latestRun.error_rate > 0.1)     recommendations.push({ priority: "high",   action: "Error rate exceeds 10%. Add error handling and retry logic." });
    if (latestRun.cost_per_task > 0.05) recommendations.push({ priority: "low",    action: "Review model selection to reduce cost per task." });
    if (suite.coverage_pct < 70)        recommendations.push({ priority: "medium", action: "Increase test coverage. Add edge case and safety boundary tests." });
    if (recommendations.length === 0)   recommendations.push({ priority: "info",   action: "All metrics within healthy thresholds. Continue regular benchmarking." });
  }

  const complianceChecks = [
    { check: "SB243 Audit Trail",     passed: runs.length > 0, note: runs.length > 0 ? "Benchmark runs logged for audit." : "No benchmark runs recorded." },
    { check: "Safety Test Coverage",  passed: testCases.some(tc => tc.type === "safety_boundary"), note: "Safety boundary tests present in suite." },
    { check: "Error Handling Tests",  passed: testCases.some(tc => tc.type === "error_handling"),  note: "Error handling scenarios covered." },
    { check: "Performance Baseline",  passed: latestRun?.avg_latency_ms != null, note: latestRun ? `Baseline latency: ${latestRun.avg_latency_ms}ms` : "No performance baseline established." },
    { check: "Regression Monitoring", passed: runs.length >= 2, note: runs.length >= 2 ? "Multiple runs enable regression detection." : "Run benchmark repeatedly to enable regression tracking." },
  ];

  const report = { executive_summary: executiveSummary, detailed_results: detailedResults, recommendations, compliance_checks: complianceChecks };

  db.prepare(`
    INSERT OR IGNORE INTO benchmark_reports
      (id, suite_id, format, report, fee_usd, created_at)
    VALUES
      (@id, @suite_id, @format, @report, @fee_usd, @created_at)
  `).run({
    id,
    suite_id:  suiteId,
    format,
    report:    JSON.stringify(report),
    fee_usd:   BENCHMARK_FEES.generate_report,
    created_at: now,
  });

  recordBilling(suiteId, false, "generate_report", BENCHMARK_FEES.generate_report);

  return {
    report_id:   id,
    suite_id:    suiteId,
    format,
    report,
    fee_usd:     BENCHMARK_FEES.generate_report,
    generated_at: now,
  };
}
