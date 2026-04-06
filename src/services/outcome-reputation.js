import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const REPUTATION_PLATFORM_COMMISSION = 0.12; // 12% on paid reputation queries
const SCORE_QUERY_FEE_USD            = 1.00; // per getOutcomeScore call
const COMPARISON_FEE_USD             = 3.00; // per compareProviders call (multi-agent)
const RISK_ASSESSMENT_FEE_USD        = 2.50; // per getRiskScore call

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS rep_outcomes (
    id                TEXT PRIMARY KEY,
    task_id           TEXT NOT NULL,
    agent_id          TEXT NOT NULL,
    reporter_id       TEXT NOT NULL,
    outcome           TEXT NOT NULL CHECK(outcome IN (
                        'success','partial_success','failure','timeout',
                        'disputed','abandoned','exceptional')),
    domain            TEXT NOT NULL,
    task_value_usd    REAL,
    latency_seconds   INTEGER,
    retry_count       INTEGER DEFAULT 0,
    repeat_usage      INTEGER DEFAULT 0,
    quality_score     REAL CHECK(quality_score BETWEEN 0 AND 10),
    details           TEXT,
    verified          INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rep_scores (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL UNIQUE,
    composite_score     REAL DEFAULT 0,
    completion_rate     REAL DEFAULT 0,
    dispute_rate        REAL DEFAULT 0,
    avg_latency_seconds REAL DEFAULT 0,
    repeat_usage_rate   REAL DEFAULT 0,
    exceptional_rate    REAL DEFAULT 0,
    total_tasks         INTEGER DEFAULT 0,
    total_value_usd     REAL DEFAULT 0,
    domain_scores       TEXT DEFAULT '{}',
    last_calculated_at  TEXT DEFAULT (datetime('now')),
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Agent Reputation Data ───────────────────────────────────────────────

const _scoreCount = db.prepare("SELECT COUNT(*) as n FROM rep_scores").get().n;
if (_scoreCount === 0) {
  const seedAgents = [
    { agent_id: "agent_alpha",   composite: 9.2, completion: 0.97, dispute: 0.01, latency: 42,  repeat: 0.68, exceptional: 0.12, total: 4821, value: 189340 },
    { agent_id: "agent_beta",    composite: 7.8, completion: 0.89, dispute: 0.06, latency: 118, repeat: 0.42, exceptional: 0.05, total: 2304, value:  87200 },
    { agent_id: "agent_gamma",   composite: 8.5, completion: 0.93, dispute: 0.03, latency: 67,  repeat: 0.55, exceptional: 0.09, total: 3107, value: 124800 },
    { agent_id: "agent_delta",   composite: 6.1, completion: 0.78, dispute: 0.14, latency: 203, repeat: 0.28, exceptional: 0.02, total:  891, value:  33400 },
    { agent_id: "agent_epsilon", composite: 9.5, completion: 0.99, dispute: 0.00, latency: 29,  repeat: 0.74, exceptional: 0.18, total: 6540, value: 298700 },
  ];

  const domainTemplates = {
    agent_alpha:   { web_automation: 9.4, data_extraction: 9.1, form_filling: 9.3, research: 8.9 },
    agent_beta:    { research: 8.2, summarization: 7.9, translation: 7.5, email_drafting: 7.8 },
    agent_gamma:   { code_execution: 8.8, data_analysis: 8.6, api_integration: 8.3, debugging: 8.4 },
    agent_delta:   { form_filling: 6.5, data_entry: 6.2, web_automation: 5.9, research: 6.0 },
    agent_epsilon: { api_integration: 9.6, code_execution: 9.5, data_analysis: 9.4, debugging: 9.3 },
  };

  const insertScore = db.prepare(`
    INSERT OR IGNORE INTO rep_scores
      (id, agent_id, composite_score, completion_rate, dispute_rate, avg_latency_seconds,
       repeat_usage_rate, exceptional_rate, total_tasks, total_value_usd, domain_scores)
    VALUES
      (@id, @agent_id, @composite_score, @completion_rate, @dispute_rate, @avg_latency_seconds,
       @repeat_usage_rate, @exceptional_rate, @total_tasks, @total_value_usd, @domain_scores)
  `);

  for (const a of seedAgents) {
    insertScore.run({
      id:                  uuid(),
      agent_id:            a.agent_id,
      composite_score:     a.composite,
      completion_rate:     a.completion,
      dispute_rate:        a.dispute,
      avg_latency_seconds: a.latency,
      repeat_usage_rate:   a.repeat,
      exceptional_rate:    a.exceptional,
      total_tasks:         a.total,
      total_value_usd:     a.value,
      domain_scores:       JSON.stringify(domainTemplates[a.agent_id] ?? {}),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompositeScore(metrics) {
  // Weighted formula: completion(40%) + dispute_penalty(20%) + latency(15%) + repeat(15%) + exceptional(10%)
  const completionComponent  = metrics.completion_rate * 10 * 0.40;
  const disputePenalty       = (1 - Math.min(1, metrics.dispute_rate * 5)) * 10 * 0.20;
  const latencyScore         = Math.max(0, 10 - (metrics.avg_latency_seconds / 60)) * 0.15;
  const repeatComponent      = metrics.repeat_usage_rate * 10 * 0.15;
  const exceptionalComponent = metrics.exceptional_rate * 10 * 0.10;
  const raw = completionComponent + disputePenalty + latencyScore + repeatComponent + exceptionalComponent;
  return Math.round(Math.min(10, Math.max(0, raw)) * 100) / 100;
}

function scoreGrade(score) {
  if (score >= 9.0) return "S";
  if (score >= 8.0) return "A";
  if (score >= 7.0) return "B";
  if (score >= 5.0) return "C";
  if (score >= 3.0) return "D";
  return "F";
}

// ─── Get Outcome Score ────────────────────────────────────────────────────────

/**
 * Retrieve the composite outcome-based reputation score for an agent.
 * Score is computed from completion rate, dispute rate, latency, repeat usage, and exceptional outcomes.
 * @param {string} agentId
 * @returns Composite score with component breakdown and grade
 */
export function getOutcomeScore(agentId) {
  if (!agentId) throw new Error("agentId is required");

  let score = db.prepare("SELECT * FROM rep_scores WHERE agent_id = ?").get(agentId);

  if (!score) {
    // Bootstrap new agent with neutral defaults
    const newId = uuid();
    db.prepare(`
      INSERT OR IGNORE INTO rep_scores (id, agent_id, composite_score, completion_rate, dispute_rate,
        avg_latency_seconds, repeat_usage_rate, exceptional_rate, total_tasks, total_value_usd, domain_scores)
      VALUES (?, ?, 5.0, 0.5, 0.1, 120, 0.1, 0.02, 0, 0, '{}')
    `).run(newId, agentId);
    score = db.prepare("SELECT * FROM rep_scores WHERE agent_id = ?").get(agentId);
  }

  const domainScores  = JSON.parse(score.domain_scores || "{}");
  const computedScore = score.total_tasks > 10
    ? computeCompositeScore(score)
    : score.composite_score;

  const percentile = Math.round(
    (1 - (10 - computedScore) / 10) * 100
  );

  return {
    agent_id:            agentId,
    composite_score:     computedScore,
    grade:               scoreGrade(computedScore),
    percentile:          `${percentile}th`,
    service_fee_usd:     SCORE_QUERY_FEE_USD,
    platform_commission_usd: Math.round(SCORE_QUERY_FEE_USD * REPUTATION_PLATFORM_COMMISSION * 100) / 100,
    components: {
      completion_rate:     score.completion_rate,
      dispute_rate:        score.dispute_rate,
      avg_latency_seconds: score.avg_latency_seconds,
      repeat_usage_rate:   score.repeat_usage_rate,
      exceptional_rate:    score.exceptional_rate,
    },
    weights: {
      completion:   "40%",
      dispute_free: "20%",
      latency:      "15%",
      repeat_usage: "15%",
      exceptional:  "10%",
    },
    domain_scores:        domainScores,
    total_tasks_rated:    score.total_tasks,
    total_value_handled_usd: score.total_value_usd,
    last_calculated_at:   score.last_calculated_at,
    methodology:          "outcome-based-v2",
  };
}

// ─── Report Outcome ───────────────────────────────────────────────────────────

/**
 * Report the real-world outcome of an agent's completed task.
 * @param {string} taskId     - Completed task being rated
 * @param {string} agentId    - Agent whose outcome is being reported
 * @param {string} outcome    - success|partial_success|failure|timeout|disputed|abandoned|exceptional
 * @param {object} details    - { domain, task_value_usd, latency_seconds, retry_count, repeat_usage, quality_score, notes }
 * @returns Outcome record with score impact summary
 */
export function reportOutcome(taskId, agentId, outcome, details = {}) {
  const validOutcomes = ["success","partial_success","failure","timeout","disputed","abandoned","exceptional"];
  if (!taskId)                     throw new Error("taskId is required");
  if (!agentId)                    throw new Error("agentId is required");
  if (!validOutcomes.includes(outcome)) throw new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`);

  const reporterId  = `reporter_${uuid().slice(0, 8)}`;
  const id          = uuid();
  const domain      = details.domain ?? "general";
  const now         = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO rep_outcomes
      (id, task_id, agent_id, reporter_id, outcome, domain, task_value_usd,
       latency_seconds, retry_count, repeat_usage, quality_score, details, verified, created_at)
    VALUES
      (@id, @task_id, @agent_id, @reporter_id, @outcome, @domain, @task_value_usd,
       @latency_seconds, @retry_count, @repeat_usage, @quality_score, @details, 0, @created_at)
  `).run({
    id,
    task_id:         taskId,
    agent_id:        agentId,
    reporter_id:     reporterId,
    outcome,
    domain,
    task_value_usd:  details.task_value_usd ?? null,
    latency_seconds: details.latency_seconds ?? null,
    retry_count:     details.retry_count ?? 0,
    repeat_usage:    details.repeat_usage ? 1 : 0,
    quality_score:   details.quality_score ?? null,
    details:         details.notes ? JSON.stringify({ notes: details.notes }) : null,
    created_at:      now,
  });

  // Recompute rolling score metrics from all stored outcomes
  const allOutcomes = db.prepare(
    "SELECT * FROM rep_outcomes WHERE agent_id = ?"
  ).all(agentId);

  const total            = allOutcomes.length;
  const completedOutcomes = ["success","exceptional","partial_success"];
  const completionRate   = allOutcomes.filter(o => completedOutcomes.includes(o.outcome)).length / total;
  const disputeRate      = allOutcomes.filter(o => o.outcome === "disputed").length / total;
  const latencyVals      = allOutcomes.filter(o => o.latency_seconds != null).map(o => o.latency_seconds);
  const avgLatency       = latencyVals.length ? latencyVals.reduce((a, b) => a + b, 0) / latencyVals.length : 120;
  const repeatRate       = allOutcomes.filter(o => o.repeat_usage === 1).length / total;
  const exceptionalRate  = allOutcomes.filter(o => o.outcome === "exceptional").length / total;
  const totalValue       = allOutcomes.reduce((s, o) => s + (o.task_value_usd ?? 0), 0);

  // Domain scores
  const domainMap = {};
  for (const o of allOutcomes) {
    if (!domainMap[o.domain]) domainMap[o.domain] = { total: 0, scores: [] };
    domainMap[o.domain].total++;
    if (o.quality_score != null) domainMap[o.domain].scores.push(o.quality_score);
  }
  const domainScores = {};
  for (const [d, v] of Object.entries(domainMap)) {
    domainScores[d] = v.scores.length
      ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 100) / 100
      : null;
  }

  const newMetrics = {
    completion_rate:     Math.round(completionRate * 1000) / 1000,
    dispute_rate:        Math.round(disputeRate * 1000) / 1000,
    avg_latency_seconds: Math.round(avgLatency),
    repeat_usage_rate:   Math.round(repeatRate * 1000) / 1000,
    exceptional_rate:    Math.round(exceptionalRate * 1000) / 1000,
  };

  const newComposite = computeCompositeScore(newMetrics);

  db.prepare(`
    INSERT OR IGNORE INTO rep_scores (id, agent_id, composite_score, completion_rate, dispute_rate,
      avg_latency_seconds, repeat_usage_rate, exceptional_rate, total_tasks, total_value_usd,
      domain_scores, last_calculated_at)
    VALUES (@id, @agent_id, @composite_score, @completion_rate, @dispute_rate,
      @avg_latency_seconds, @repeat_usage_rate, @exceptional_rate, @total_tasks, @total_value_usd,
      @domain_scores, @last_calculated_at)
    ON CONFLICT(agent_id) DO UPDATE SET
      composite_score     = excluded.composite_score,
      completion_rate     = excluded.completion_rate,
      dispute_rate        = excluded.dispute_rate,
      avg_latency_seconds = excluded.avg_latency_seconds,
      repeat_usage_rate   = excluded.repeat_usage_rate,
      exceptional_rate    = excluded.exceptional_rate,
      total_tasks         = excluded.total_tasks,
      total_value_usd     = excluded.total_value_usd,
      domain_scores       = excluded.domain_scores,
      last_calculated_at  = excluded.last_calculated_at
  `).run({
    id:                  uuid(),
    agent_id:            agentId,
    composite_score:     newComposite,
    ...newMetrics,
    total_tasks:         total,
    total_value_usd:     Math.round(totalValue * 100) / 100,
    domain_scores:       JSON.stringify(domainScores),
    last_calculated_at:  now,
  });

  const impactDirection = ["success","exceptional"].includes(outcome) ? "positive"
                        : ["failure","disputed","abandoned"].includes(outcome) ? "negative"
                        : "neutral";

  return {
    outcome_id:       id,
    task_id:          taskId,
    agent_id:         agentId,
    outcome,
    domain,
    new_composite_score: newComposite,
    new_grade:           scoreGrade(newComposite),
    score_impact:        impactDirection,
    metrics_updated:     newMetrics,
    total_outcomes_on_record: total,
    reported_at:         now,
  };
}

// ─── Get Performance Metrics ──────────────────────────────────────────────────

/**
 * Get detailed domain-specific performance breakdown for an agent.
 * @param {string} agentId
 * @param {string} domain - Optional: filter to a specific task domain
 * @returns Granular performance metrics with trend indicators
 */
export function getPerformanceMetrics(agentId, domain) {
  if (!agentId) throw new Error("agentId is required");

  const score = db.prepare("SELECT * FROM rep_scores WHERE agent_id = ?").get(agentId);
  if (!score) throw new Error(`No reputation data found for agent: ${agentId}`);

  let sql    = "SELECT * FROM rep_outcomes WHERE agent_id = ?";
  const params = [agentId];
  if (domain) {
    sql += " AND domain = ?";
    params.push(domain);
  }
  sql += " ORDER BY created_at DESC";

  const outcomes       = db.prepare(sql).all(...params);
  const domainScores   = JSON.parse(score.domain_scores || "{}");

  // Trend: compare last 20% vs first 20% of outcomes
  const trendWindow    = Math.max(1, Math.floor(outcomes.length * 0.2));
  const recentOutcomes = outcomes.slice(0, trendWindow);
  const olderOutcomes  = outcomes.slice(-trendWindow);

  const recentSuccess  = recentOutcomes.filter(o => ["success","exceptional"].includes(o.outcome)).length / (trendWindow || 1);
  const olderSuccess   = olderOutcomes.filter(o => ["success","exceptional"].includes(o.outcome)).length / (trendWindow || 1);
  const trend          = recentSuccess > olderSuccess + 0.05 ? "improving"
                       : recentSuccess < olderSuccess - 0.05 ? "declining"
                       : "stable";

  const outcomeDist = {};
  for (const o of outcomes) {
    outcomeDist[o.outcome] = (outcomeDist[o.outcome] ?? 0) + 1;
  }

  const avgQuality = outcomes.filter(o => o.quality_score != null).length > 0
    ? outcomes.filter(o => o.quality_score != null).reduce((s, o) => s + o.quality_score, 0)
      / outcomes.filter(o => o.quality_score != null).length
    : null;

  return {
    agent_id:            agentId,
    domain_filter:       domain ?? "all",
    composite_score:     score.composite_score,
    grade:               scoreGrade(score.composite_score),
    trend,
    outcome_distribution: outcomeDist,
    metrics: {
      completion_rate:       score.completion_rate,
      dispute_rate:          score.dispute_rate,
      avg_latency_seconds:   score.avg_latency_seconds,
      repeat_usage_rate:     score.repeat_usage_rate,
      exceptional_rate:      score.exceptional_rate,
      avg_quality_score:     avgQuality !== null ? Math.round(avgQuality * 100) / 100 : null,
    },
    domain_scores:         domain ? { [domain]: domainScores[domain] ?? null } : domainScores,
    total_tasks:           score.total_tasks,
    total_value_handled_usd: score.total_value_usd,
    outcomes_in_window:    outcomes.length,
    last_calculated_at:    score.last_calculated_at,
  };
}

// ─── Compare Providers ────────────────────────────────────────────────────────

/**
 * Head-to-head comparison of multiple agents for a specific task type.
 * @param {string[]} agentIds  - Array of agent IDs to compare (2–10)
 * @param {string}   taskType  - Task domain/type for domain-specific scoring
 * @returns Ranked comparison table with recommendation
 */
export function compareProviders(agentIds, taskType) {
  if (!Array.isArray(agentIds) || agentIds.length < 2) throw new Error("agentIds must be an array of at least 2 agent IDs");
  if (agentIds.length > 10) throw new Error("Cannot compare more than 10 agents at once");
  if (!taskType) throw new Error("taskType is required");

  const comparisons = agentIds.map(agentId => {
    const score = db.prepare("SELECT * FROM rep_scores WHERE agent_id = ?").get(agentId);
    if (!score) {
      return {
        agent_id:        agentId,
        composite_score: null,
        grade:           "N/A",
        domain_score:    null,
        completion_rate: null,
        dispute_rate:    null,
        avg_latency_seconds: null,
        repeat_usage_rate: null,
        total_tasks:     0,
        data_available:  false,
      };
    }

    const domainScores = JSON.parse(score.domain_scores || "{}");
    const domainScore  = domainScores[taskType] ?? null;

    return {
      agent_id:            agentId,
      composite_score:     score.composite_score,
      grade:               scoreGrade(score.composite_score),
      domain_score:        domainScore,
      effective_score:     domainScore ?? score.composite_score,
      completion_rate:     score.completion_rate,
      dispute_rate:        score.dispute_rate,
      avg_latency_seconds: score.avg_latency_seconds,
      repeat_usage_rate:   score.repeat_usage_rate,
      total_tasks:         score.total_tasks,
      total_value_usd:     score.total_value_usd,
      data_available:      true,
    };
  });

  const ranked = [...comparisons]
    .filter(c => c.data_available)
    .sort((a, b) => (b.effective_score ?? 0) - (a.effective_score ?? 0));

  const winner = ranked[0] ?? null;

  return {
    task_type:            taskType,
    agents_compared:      agentIds.length,
    fee_usd:              COMPARISON_FEE_USD,
    platform_commission_usd: Math.round(COMPARISON_FEE_USD * REPUTATION_PLATFORM_COMMISSION * 100) / 100,
    ranked_results:       ranked,
    recommendation: winner ? {
      agent_id:     winner.agent_id,
      reason:       `Highest effective score (${winner.effective_score}) for task type '${taskType}'. ` +
                    `${winner.dispute_rate !== null ? `Dispute rate: ${(winner.dispute_rate * 100).toFixed(1)}%.` : ""}`,
      confidence:   ranked.length > 1
                      ? Math.round(Math.min(99, 60 + (ranked[0].effective_score - (ranked[1]?.effective_score ?? 0)) * 20) * 10) / 10
                      : 75,
    } : null,
    generated_at:         new Date().toISOString(),
  };
}

// ─── Get Risk Score ───────────────────────────────────────────────────────────

/**
 * Assess the risk of transacting with a specific agent at a given dollar value.
 * @param {string} agentId    - Agent to assess
 * @param {number} taskValue  - USD value of the proposed transaction
 * @returns Risk score, tier, and recommended mitigations
 */
export function getRiskScore(agentId, taskValue) {
  if (!agentId)         throw new Error("agentId is required");
  if (taskValue == null) throw new Error("taskValue is required");
  if (taskValue <= 0)   throw new Error("taskValue must be positive");

  const score = db.prepare("SELECT * FROM rep_scores WHERE agent_id = ?").get(agentId);

  let riskScore, riskTier, mitigations;

  if (!score || score.total_tasks < 5) {
    riskScore = 7.5;
    riskTier  = "high";
    mitigations = [
      "Request escrow holdback until delivery is verified.",
      "Limit initial transaction to no more than $50 to assess reliability.",
      "Require proof-of-completion submission before release.",
      "Enable HITL oversight for this task.",
    ];
  } else {
    // Risk score: higher composite = lower risk
    const baseRisk        = (10 - score.composite_score);
    const valuePenalty    = taskValue > 1000 ? Math.log10(taskValue / 100) * 0.4 : 0;
    const disputePenalty  = score.dispute_rate * 15;
    const raw             = Math.min(10, baseRisk + valuePenalty + disputePenalty);
    riskScore             = Math.round(raw * 100) / 100;

    riskTier = riskScore < 3 ? "low"
             : riskScore < 5 ? "moderate"
             : riskScore < 7 ? "elevated"
             : "high";

    const mitigationMap = {
      low: [
        "Standard escrow terms are sufficient.",
        "No additional verification required for this value range.",
      ],
      moderate: [
        "Consider proof-of-completion verification for tasks above $200.",
        "Enable automatic dispute resolution threshold.",
      ],
      elevated: [
        "Require milestone-based payments for tasks above $500.",
        "Request proof-of-completion before final escrow release.",
        "Review agent's dispute history before proceeding.",
      ],
      high: [
        "Use staged escrow with milestone releases.",
        "Require HITL oversight for execution.",
        "Request proof-of-completion for every deliverable.",
        "Consider alternative agents with stronger track records.",
        "Set a hard cap on automated spend for this agent.",
      ],
    };
    mitigations = mitigationMap[riskTier] ?? [];
  }

  const expectedLoss = taskValue * (riskScore / 100);

  return {
    agent_id:              agentId,
    task_value_usd:        taskValue,
    risk_score:            riskScore,
    risk_tier:             riskTier,
    expected_loss_usd:     Math.round(expectedLoss * 100) / 100,
    assessment_fee_usd:    RISK_ASSESSMENT_FEE_USD,
    platform_commission_usd: Math.round(RISK_ASSESSMENT_FEE_USD * REPUTATION_PLATFORM_COMMISSION * 100) / 100,
    agent_metrics: score ? {
      composite_score:     score.composite_score,
      grade:               scoreGrade(score.composite_score),
      completion_rate:     score.completion_rate,
      dispute_rate:        score.dispute_rate,
      total_tasks:         score.total_tasks,
    } : null,
    recommended_mitigations: mitigations,
    data_quality:          !score || score.total_tasks < 5 ? "insufficient" : score.total_tasks < 50 ? "limited" : "adequate",
    assessed_at:           new Date().toISOString(),
  };
}
