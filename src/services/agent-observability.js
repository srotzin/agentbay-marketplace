import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const OBS_COMMISSION              = 0.15;   // 15% platform commission
const TRACE_START_FEE             = 0.01;   // $0.01 per trace
const SPAN_FEE                    = 0.005;  // $0.005 per span
const HALLUCINATION_CHECK_FEE     = 0.10;   // $0.10 per hallucination check
const DLQ_ENTRY_FEE               = 0.02;   // $0.02 per dead letter entry
const OBSERVABILITY_REPORT_FEE    = 10.00;  // $10/month per workflow
const DLQ_MAX_RETRIES             = 5;
const DLQ_RETRY_BACKOFF_MINUTES   = [1, 5, 15, 60, 240]; // Exponential-ish backoff

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS obs_traces (
    id                  TEXT PRIMARY KEY,
    workflow_id         TEXT NOT NULL,
    initiator_agent_id  TEXT NOT NULL,
    metadata            TEXT DEFAULT '{}',    -- JSON
    status              TEXT DEFAULT 'active' CHECK(status IN ('active','completed','failed')),
    root_span_id        TEXT,
    trace_token         TEXT NOT NULL,
    total_spans         INTEGER DEFAULT 0,
    total_duration_ms   INTEGER,
    fee_usd             REAL DEFAULT 0.01,
    commission_usd      REAL DEFAULT 0.0015,
    started_at          TEXT DEFAULT (datetime('now')),
    completed_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS obs_spans (
    id              TEXT PRIMARY KEY,
    trace_id        TEXT NOT NULL REFERENCES obs_traces(id),
    parent_span_id  TEXT,
    agent_id        TEXT NOT NULL,
    operation       TEXT NOT NULL,
    input           TEXT,                     -- JSON (may be truncated)
    output          TEXT,                     -- JSON (may be truncated)
    duration_ms     INTEGER NOT NULL,
    depth           INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'ok' CHECK(status IN ('ok','error','timeout')),
    error_message   TEXT,
    fee_usd         REAL DEFAULT 0.005,
    commission_usd  REAL DEFAULT 0.00075,
    recorded_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_hallucination_checks (
    id                  TEXT PRIMARY KEY,
    agent_output        TEXT NOT NULL,
    ground_truth_count  INTEGER DEFAULT 0,
    hallucination_score REAL NOT NULL,        -- 0.0 (clean) to 1.0 (fully hallucinated)
    flagged_claims      TEXT NOT NULL,        -- JSON array
    verified_claims     TEXT NOT NULL,        -- JSON array
    confidence          REAL NOT NULL,
    confidence_threshold REAL DEFAULT 0.8,
    fee_usd             REAL DEFAULT 0.10,
    commission_usd      REAL DEFAULT 0.015,
    checked_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_dead_letter_queue (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    failed_agent_id TEXT NOT NULL,
    payload         TEXT NOT NULL,            -- JSON
    failure_reason  TEXT NOT NULL,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 5,
    status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','retrying','resolved','exhausted')),
    next_retry_at   TEXT,
    resolved_at     TEXT,
    fee_usd         REAL DEFAULT 0.02,
    commission_usd  REAL DEFAULT 0.003,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obs_report_subscriptions (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL UNIQUE,
    monthly_fee_usd REAL DEFAULT 10.00,
    commission_usd  REAL DEFAULT 1.50,
    subscribed_at   TEXT DEFAULT (datetime('now')),
    last_report_at  TEXT
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _traceCount = db.prepare("SELECT COUNT(*) as n FROM obs_traces").get().n;
if (_traceCount === 0) {
  const now = Date.now();
  const seedTraces = [
    {
      id: uuid(), workflow_id: "wf_research_pipeline",   initiator_agent_id: "agent_researcher_01",
      metadata: JSON.stringify({ version: "2.4.1", environment: "production", team: "data-science" }),
      status: "completed", trace_token: `tok_${uuid().slice(0, 24)}`,
      total_spans: 8, total_duration_ms: 4821,
      started_at:    new Date(now - 2 * 3600000).toISOString(),
      completed_at:  new Date(now - 2 * 3600000 + 4821).toISOString(),
    },
    {
      id: uuid(), workflow_id: "wf_data_enrichment",     initiator_agent_id: "agent_fetcher_01",
      metadata: JSON.stringify({ version: "1.8.0", environment: "production", batch_size: 500 }),
      status: "active",  trace_token: `tok_${uuid().slice(0, 24)}`,
      total_spans: 3, total_duration_ms: null,
      started_at: new Date(now - 15 * 60000).toISOString(), completed_at: null,
    },
    {
      id: uuid(), workflow_id: "wf_customer_onboarding", initiator_agent_id: "agent_kyc_01",
      metadata: JSON.stringify({ version: "3.1.0", environment: "production", channel: "web" }),
      status: "failed",  trace_token: `tok_${uuid().slice(0, 24)}`,
      total_spans: 5, total_duration_ms: 12340,
      started_at:   new Date(now - 6 * 3600000).toISOString(),
      completed_at: new Date(now - 6 * 3600000 + 12340).toISOString(),
    },
  ];
  const insTr = db.prepare(`
    INSERT OR IGNORE INTO obs_traces
      (id, workflow_id, initiator_agent_id, metadata, status, trace_token,
       total_spans, total_duration_ms, started_at, completed_at)
    VALUES
      (@id, @workflow_id, @initiator_agent_id, @metadata, @status, @trace_token,
       @total_spans, @total_duration_ms, @started_at, @completed_at)
  `);
  for (const t of seedTraces) insTr.run(t);

  // Seed spans for first trace
  const firstTrace   = seedTraces[0];
  const startedAtMs  = new Date(firstTrace.started_at).getTime();
  const seedSpans    = [
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: null,   agent_id: "agent_researcher_01", operation: "fetch_sources",      duration_ms: 812,  depth: 0, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD1", agent_id: "agent_researcher_01", operation: "parse_content",      duration_ms: 1243, depth: 1, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD1", agent_id: "agent_researcher_01", operation: "score_confidence",   duration_ms: 445,  depth: 1, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD2", agent_id: "agent_summarizer_01", operation: "generate_summary",   duration_ms: 921,  depth: 2, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD2", agent_id: "agent_summarizer_01", operation: "format_output",      duration_ms: 203,  depth: 2, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD4", agent_id: "agent_publisher_01",  operation: "publish_article",    duration_ms: 672,  depth: 3, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD4", agent_id: "agent_publisher_01",  operation: "update_index",       duration_ms: 311,  depth: 3, status: "ok" },
    { id: uuid(), trace_id: firstTrace.id, parent_span_id: "TBD6", agent_id: "agent_notifier_01",   operation: "send_notifications", duration_ms: 214,  depth: 4, status: "ok" },
  ];
  // Fix parent_span_ids by referencing actual IDs
  seedSpans[1].parent_span_id = seedSpans[0].id;
  seedSpans[2].parent_span_id = seedSpans[0].id;
  seedSpans[3].parent_span_id = seedSpans[1].id;
  seedSpans[4].parent_span_id = seedSpans[1].id;
  seedSpans[5].parent_span_id = seedSpans[3].id;
  seedSpans[6].parent_span_id = seedSpans[3].id;
  seedSpans[7].parent_span_id = seedSpans[5].id;

  firstTrace.root_span_id = seedSpans[0].id;
  db.prepare("UPDATE obs_traces SET root_span_id = ? WHERE id = ?").run(seedSpans[0].id, firstTrace.id);

  const insSpan = db.prepare(`
    INSERT OR IGNORE INTO obs_spans
      (id, trace_id, parent_span_id, agent_id, operation, duration_ms, depth, status, recorded_at)
    VALUES
      (@id, @trace_id, @parent_span_id, @agent_id, @operation, @duration_ms, @depth, @status, @recorded_at)
  `);
  let offset = 0;
  for (const s of seedSpans) {
    s.recorded_at = new Date(startedAtMs + offset).toISOString();
    offset += s.duration_ms;
    insSpan.run(s);
  }
}

const _dlqCount = db.prepare("SELECT COUNT(*) as n FROM obs_dead_letter_queue").get().n;
if (_dlqCount === 0) {
  const now = new Date();
  const seedDlq = [
    {
      id: uuid(), task_id: "task_enrich_b8812", failed_agent_id: "agent_enricher_01",
      payload:        JSON.stringify({ batch_id: "b_8812", records: 500, source: "crm_v2" }),
      failure_reason: "Context key 'schema_version' missing — handoff validation failed",
      retry_count: 2, max_retries: 5, status: "retrying",
      next_retry_at:  new Date(now.getTime() + 15 * 60000).toISOString(),
    },
    {
      id: uuid(), task_id: "task_classify_img_7723", failed_agent_id: "agent_classifier_01",
      payload:        JSON.stringify({ image_id: "img_7723", model: "vision-v4", task: "classify" }),
      failure_reason: "OOM kill — model checkpoint not cached, 16GB allocation failed",
      retry_count: 5, max_retries: 5, status: "exhausted",
      next_retry_at:  null,
    },
    {
      id: uuid(), task_id: "task_notify_onboard_9923", failed_agent_id: "agent_notifier_01",
      payload:        JSON.stringify({ customer_id: "cust_7x9a", channel: "email", template: "welcome_v2" }),
      failure_reason: "SMTP relay timeout after 30s — downstream mail provider unreachable",
      retry_count: 1, max_retries: 5, status: "retrying",
      next_retry_at:  new Date(now.getTime() + 5 * 60000).toISOString(),
    },
    {
      id: uuid(), task_id: "task_translate_doc_3301", failed_agent_id: "agent_translator_01",
      payload:        JSON.stringify({ doc_id: "doc_3301", source_lang: "de", target_lang: "en", word_count: 1840 }),
      failure_reason: "Rate limit exceeded on translation API — 429 Too Many Requests",
      retry_count: 0, max_retries: 5, status: "pending",
      next_retry_at:  new Date(now.getTime() + 1 * 60000).toISOString(),
    },
    {
      id: uuid(), task_id: "task_embed_corpus_1144", failed_agent_id: "agent_embedder_01",
      payload:        JSON.stringify({ corpus_id: "corp_1144", model: "text-embedding-3-large", chunks: 2400 }),
      failure_reason: "GPU worker pod evicted by k8s — resource quota exceeded on namespace",
      retry_count: 3, max_retries: 5, status: "retrying",
      next_retry_at:  new Date(now.getTime() + 60 * 60000).toISOString(),
    },
  ];

  const insDlq = db.prepare(`
    INSERT OR IGNORE INTO obs_dead_letter_queue
      (id, task_id, failed_agent_id, payload, failure_reason, retry_count, max_retries, status, next_retry_at)
    VALUES
      (@id, @task_id, @failed_agent_id, @payload, @failure_reason, @retry_count, @max_retries, @status, @next_retry_at)
  `);
  for (const d of seedDlq) insDlq.run(d);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePercentiles(values) {
  if (!values || values.length === 0) return { p50: null, p95: null, p99: null };
  const sorted = [...values].sort((a, b) => a - b);
  const pct    = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return { p50: pct(50), p95: pct(95), p99: pct(99) };
}

function generateTraceToken() {
  return `tok_${uuid().replace(/-/g, "").slice(0, 24)}`;
}

function computeSpanDepth(traceId, parentSpanId) {
  if (!parentSpanId) return 0;
  const parent = db.prepare("SELECT depth FROM obs_spans WHERE id = ? AND trace_id = ?").get(parentSpanId, traceId);
  return parent ? parent.depth + 1 : 0;
}

// ─── Start Trace ───────────────────────────────────────────────────────────────

/**
 * Start a distributed trace across multiple agents.
 * @param {string} workflowId        - Workflow being traced
 * @param {string} initiatorAgentId  - Agent starting the trace
 * @param {Object} metadata          - Arbitrary key/value context (env, version, etc.)
 * @returns trace_id, span_id, trace_token (pass to downstream agents)
 * Fee: $0.01/trace start, 15% commission
 */
export function startTrace(workflowId, initiatorAgentId, metadata = {}) {
  if (!workflowId)       throw new Error("workflowId is required");
  if (!initiatorAgentId) throw new Error("initiatorAgentId is required");

  const traceId    = uuid();
  const rootSpanId = uuid();
  const traceToken = generateTraceToken();
  const commission = Math.round(TRACE_START_FEE * OBS_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO obs_traces
      (id, workflow_id, initiator_agent_id, metadata, status, root_span_id, trace_token,
       total_spans, fee_usd, commission_usd, started_at)
    VALUES
      (@id, @workflow_id, @initiator_agent_id, @metadata, 'active', @root_span_id, @trace_token,
       0, @fee_usd, @commission_usd, @started_at)
  `).run({
    id:                 traceId,
    workflow_id:        workflowId,
    initiator_agent_id: initiatorAgentId,
    metadata:           JSON.stringify(metadata),
    root_span_id:       rootSpanId,
    trace_token:        traceToken,
    fee_usd:            TRACE_START_FEE,
    commission_usd:     commission,
    started_at:         now,
  });

  // Create the root span (depth 0)
  db.prepare(`
    INSERT OR IGNORE INTO obs_spans
      (id, trace_id, parent_span_id, agent_id, operation, duration_ms, depth, status, recorded_at)
    VALUES
      (@id, @trace_id, NULL, @agent_id, 'trace_root', 0, 0, 'ok', @recorded_at)
  `).run({ id: rootSpanId, trace_id: traceId, agent_id: initiatorAgentId, recorded_at: now });

  db.prepare("UPDATE obs_traces SET total_spans = total_spans + 1 WHERE id = ?").run(traceId);

  return {
    trace_id:               traceId,
    span_id:                rootSpanId,
    trace_token:            traceToken,
    workflow_id:            workflowId,
    initiator_agent_id:     initiatorAgentId,
    metadata,
    status:                 "active",
    fee_usd:                TRACE_START_FEE,
    platform_commission_usd: commission,
    started_at:             now,
    instructions:           "Pass trace_token to all downstream agents. Each agent should call addSpan() with this trace_id.",
  };
}

// ─── Add Span ─────────────────────────────────────────────────────────────────

/**
 * Add a span to an existing trace from any agent in the chain.
 * @param {string} traceId     - Trace to add to
 * @param {string} agentId     - Agent recording this span
 * @param {string} operation   - Operation name (e.g. "fetch_data", "llm_call", "write_db")
 * @param {*}      input       - Input to the operation (will be JSON-serialized, truncated at 2KB)
 * @param {*}      output      - Output of the operation (will be JSON-serialized, truncated at 2KB)
 * @param {number} durationMs  - How long the operation took in milliseconds
 * @returns span_id, parent_span_id, depth
 * Fee: $0.005/span, 15% commission
 */
export function addSpan(traceId, agentId, operation, input, output, durationMs) {
  if (!traceId)            throw new Error("traceId is required");
  if (!agentId)            throw new Error("agentId is required");
  if (!operation)          throw new Error("operation is required");
  if (durationMs == null || durationMs < 0) throw new Error("durationMs must be a non-negative number");

  const trace = db.prepare("SELECT * FROM obs_traces WHERE id = ?").get(traceId);
  if (!trace) throw new Error(`Trace not found: ${traceId}`);
  if (trace.status === "completed") throw new Error(`Trace ${traceId} is already completed. Start a new trace.`);

  // Find the most recent span by this agent (or root) as parent
  const parentSpan = db.prepare(`
    SELECT id, depth FROM obs_spans
    WHERE trace_id = ? AND agent_id = ?
    ORDER BY recorded_at DESC LIMIT 1
  `).get(traceId, agentId)
    ?? db.prepare("SELECT id, depth FROM obs_spans WHERE trace_id = ? AND parent_span_id IS NULL LIMIT 1").get(traceId);

  const parentSpanId = parentSpan?.id ?? null;
  const depth        = parentSpan ? parentSpan.depth + 1 : 0;

  const spanId       = uuid();
  const commission   = Math.round(SPAN_FEE * OBS_COMMISSION * 100) / 100;
  const now          = new Date().toISOString();

  // Truncate input/output to ~2KB to keep DB lean
  const serialize    = (val) => {
    const s = JSON.stringify(val ?? null);
    return s.length > 2048 ? s.slice(0, 2048) + "…(truncated)" : s;
  };

  const isError  = durationMs > 30000;
  const status   = isError ? "timeout" : "ok";

  db.prepare(`
    INSERT OR IGNORE INTO obs_spans
      (id, trace_id, parent_span_id, agent_id, operation, input, output,
       duration_ms, depth, status, fee_usd, commission_usd, recorded_at)
    VALUES
      (@id, @trace_id, @parent_span_id, @agent_id, @operation, @input, @output,
       @duration_ms, @depth, @status, @fee_usd, @commission_usd, @recorded_at)
  `).run({
    id:             spanId,
    trace_id:       traceId,
    parent_span_id: parentSpanId,
    agent_id:       agentId,
    operation,
    input:          serialize(input),
    output:         serialize(output),
    duration_ms:    durationMs,
    depth,
    status,
    fee_usd:        SPAN_FEE,
    commission_usd: commission,
    recorded_at:    now,
  });

  db.prepare("UPDATE obs_traces SET total_spans = total_spans + 1 WHERE id = ?").run(traceId);

  return {
    span_id:                spanId,
    trace_id:               traceId,
    parent_span_id:         parentSpanId,
    depth,
    agent_id:               agentId,
    operation,
    duration_ms:            durationMs,
    status,
    fee_usd:                SPAN_FEE,
    platform_commission_usd: commission,
    recorded_at:            now,
  };
}

// ─── Detect Hallucination ──────────────────────────────────────────────────────

/**
 * Check agent output for hallucinated facts against ground truth sources.
 * @param {string}   agentOutput         - The text produced by the agent
 * @param {Array}    groundTruthSources  - Array of source strings/objects used to verify claims
 * @param {number}   confidenceThreshold - Minimum confidence to flag (0–1, default 0.8)
 * @returns hallucination_score, flagged_claims[], verified_claims[], confidence
 * Fee: $0.10/check, 15% commission
 */
export function detectHallucination(agentOutput, groundTruthSources, confidenceThreshold = 0.8) {
  if (!agentOutput)                                 throw new Error("agentOutput is required");
  if (!Array.isArray(groundTruthSources) || groundTruthSources.length === 0)
    throw new Error("groundTruthSources must be a non-empty array");
  if (confidenceThreshold < 0 || confidenceThreshold > 1)
    throw new Error("confidenceThreshold must be between 0 and 1");

  // Simulate NLP-based claim extraction and verification
  const sentences = agentOutput
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const groundTruthText = groundTruthSources
    .map(s => (typeof s === "string" ? s : JSON.stringify(s)))
    .join(" ")
    .toLowerCase();

  const flaggedClaims  = [];
  const verifiedClaims = [];

  for (const sentence of sentences) {
    const words       = sentence.toLowerCase().split(/\s+/);
    // Simulate: if <40% of meaningful words appear in ground truth → flag
    const meaningful  = words.filter(w => w.length > 4);
    if (meaningful.length === 0) continue;
    const matchRatio  = meaningful.filter(w => groundTruthText.includes(w)).length / meaningful.length;
    const claimConf   = Math.min(1, matchRatio + Math.random() * 0.2);

    if (claimConf < confidenceThreshold) {
      flaggedClaims.push({
        claim:       sentence,
        confidence:  Math.round(claimConf * 1000) / 1000,
        reason:      claimConf < 0.3
          ? "No supporting evidence found in ground truth sources"
          : `Partial match only — ${Math.round(matchRatio * 100)}% word overlap with ground truth`,
        severity:    claimConf < 0.3 ? "high" : "medium",
      });
    } else {
      verifiedClaims.push({
        claim:       sentence,
        confidence:  Math.round(claimConf * 1000) / 1000,
        source_hint: groundTruthSources.length > 0 ? `Source ${Math.floor(Math.random() * groundTruthSources.length) + 1}` : null,
      });
    }
  }

  const hallucinationScore = sentences.length > 0
    ? Math.round((flaggedClaims.length / sentences.length) * 1000) / 1000
    : 0;

  const overallConfidence = sentences.length > 0
    ? Math.round(
        (verifiedClaims.reduce((s, c) => s + c.confidence, 0) +
         flaggedClaims.reduce((s, c) => s + (1 - c.confidence), 0))
        / sentences.length * 1000
      ) / 1000
    : 1;

  const commission = Math.round(HALLUCINATION_CHECK_FEE * OBS_COMMISSION * 100) / 100;
  const checkId    = uuid();

  db.prepare(`
    INSERT OR IGNORE INTO obs_hallucination_checks
      (id, agent_output, ground_truth_count, hallucination_score, flagged_claims,
       verified_claims, confidence, confidence_threshold, fee_usd, commission_usd)
    VALUES
      (@id, @agent_output, @ground_truth_count, @hallucination_score, @flagged_claims,
       @verified_claims, @confidence, @confidence_threshold, @fee_usd, @commission_usd)
  `).run({
    id:                    checkId,
    agent_output:          agentOutput.slice(0, 2048),
    ground_truth_count:    groundTruthSources.length,
    hallucination_score:   hallucinationScore,
    flagged_claims:        JSON.stringify(flaggedClaims),
    verified_claims:       JSON.stringify(verifiedClaims),
    confidence:            overallConfidence,
    confidence_threshold:  confidenceThreshold,
    fee_usd:               HALLUCINATION_CHECK_FEE,
    commission_usd:        commission,
  });

  return {
    check_id:                 checkId,
    hallucination_score:      hallucinationScore,
    verdict:                  hallucinationScore > 0.4 ? "likely_hallucinated"
                            : hallucinationScore > 0.15 ? "partially_hallucinated"
                            : "likely_accurate",
    flagged_claims:           flaggedClaims,
    verified_claims:          verifiedClaims,
    total_claims_analyzed:    sentences.length,
    flagged_count:            flaggedClaims.length,
    verified_count:           verifiedClaims.length,
    confidence:               overallConfidence,
    confidence_threshold:     confidenceThreshold,
    ground_truth_sources_used: groundTruthSources.length,
    fee_usd:                  HALLUCINATION_CHECK_FEE,
    platform_commission_usd:  commission,
    checked_at:               new Date().toISOString(),
  };
}

// ─── Send To Dead Letter ───────────────────────────────────────────────────────

/**
 * Route a failed task to the dead letter queue for retry or investigation.
 * @param {string} taskId         - The task that failed
 * @param {string} failedAgentId  - Agent that failed to process it
 * @param {Object} payload        - Original task payload
 * @param {string} failureReason  - Why the task failed
 * @returns dlq_entry_id, retry_count, max_retries, next_retry_at
 * Fee: $0.02/entry, 15% commission
 */
export function sendToDeadLetter(taskId, failedAgentId, payload, failureReason) {
  if (!taskId)        throw new Error("taskId is required");
  if (!failedAgentId) throw new Error("failedAgentId is required");
  if (!payload)       throw new Error("payload is required");
  if (!failureReason) throw new Error("failureReason is required");

  // Check if this task already has a DLQ entry and bump its retry count
  const existing = db.prepare("SELECT * FROM obs_dead_letter_queue WHERE task_id = ?").get(taskId);

  const commission = Math.round(DLQ_ENTRY_FEE * OBS_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  if (existing) {
    const newRetryCount = Math.min(existing.retry_count + 1, existing.max_retries);
    const isExhausted   = newRetryCount >= existing.max_retries;
    const backoffMins   = DLQ_RETRY_BACKOFF_MINUTES[Math.min(newRetryCount, DLQ_RETRY_BACKOFF_MINUTES.length - 1)];
    const nextRetryAt   = isExhausted ? null : new Date(Date.now() + backoffMins * 60000).toISOString();
    const newStatus     = isExhausted ? "exhausted" : "retrying";

    db.prepare(`
      UPDATE obs_dead_letter_queue SET
        retry_count = @retry_count, status = @status,
        failure_reason = @failure_reason, next_retry_at = @next_retry_at, updated_at = @updated_at
      WHERE task_id = @task_id
    `).run({ retry_count: newRetryCount, status: newStatus, failure_reason: failureReason, next_retry_at: nextRetryAt, updated_at: now, task_id: taskId });

    return {
      dlq_entry_id:    existing.id,
      task_id:         taskId,
      failed_agent_id: failedAgentId,
      retry_count:     newRetryCount,
      max_retries:     existing.max_retries,
      status:          newStatus,
      next_retry_at:   nextRetryAt,
      failure_reason:  failureReason,
      fee_usd:         DLQ_ENTRY_FEE,
      platform_commission_usd: commission,
      updated_at:      now,
      message:         isExhausted
        ? `Task ${taskId} has exhausted all ${existing.max_retries} retries. Manual intervention required.`
        : `Task ${taskId} queued for retry #${newRetryCount} in ${backoffMins} minute(s).`,
    };
  }

  const entryId    = uuid();
  const nextRetryAt = new Date(Date.now() + DLQ_RETRY_BACKOFF_MINUTES[0] * 60000).toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO obs_dead_letter_queue
      (id, task_id, failed_agent_id, payload, failure_reason, retry_count, max_retries,
       status, next_retry_at, fee_usd, commission_usd, created_at, updated_at)
    VALUES
      (@id, @task_id, @failed_agent_id, @payload, @failure_reason, 0, @max_retries,
       'pending', @next_retry_at, @fee_usd, @commission_usd, @created_at, @updated_at)
  `).run({
    id:              entryId,
    task_id:         taskId,
    failed_agent_id: failedAgentId,
    payload:         JSON.stringify(payload),
    failure_reason:  failureReason,
    max_retries:     DLQ_MAX_RETRIES,
    next_retry_at:   nextRetryAt,
    fee_usd:         DLQ_ENTRY_FEE,
    commission_usd:  commission,
    created_at:      now,
    updated_at:      now,
  });

  return {
    dlq_entry_id:            entryId,
    task_id:                 taskId,
    failed_agent_id:         failedAgentId,
    retry_count:             0,
    max_retries:             DLQ_MAX_RETRIES,
    status:                  "pending",
    next_retry_at:           nextRetryAt,
    failure_reason:          failureReason,
    fee_usd:                 DLQ_ENTRY_FEE,
    platform_commission_usd: commission,
    created_at:              now,
    message:                 `Task ${taskId} added to dead letter queue. First retry in ${DLQ_RETRY_BACKOFF_MINUTES[0]} minute(s).`,
  };
}

// ─── Get Dead Letter Queue ─────────────────────────────────────────────────────

/**
 * View the dead letter queue for an agent, with retry stats.
 * @param {string} agentId - Agent whose failed tasks to view
 * @param {string} status  - Optional: pending | retrying | resolved | exhausted
 * @returns entries[], total_failed, retry_success_rate, oldest_unresolved
 * Fee: free
 */
export function getDeadLetterQueue(agentId, status) {
  if (!agentId) throw new Error("agentId is required");

  const validStatuses = ["pending", "retrying", "resolved", "exhausted"];
  if (status && !validStatuses.includes(status)) {
    throw new Error(`status must be one of: ${validStatuses.join(", ")}`);
  }

  let sql    = "SELECT * FROM obs_dead_letter_queue WHERE failed_agent_id = ?";
  const args = [agentId];

  if (status) {
    sql  += " AND status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const entries     = db.prepare(sql).all(...args);
  const allEntries  = db.prepare("SELECT * FROM obs_dead_letter_queue WHERE failed_agent_id = ?").all(agentId);

  const resolved    = allEntries.filter(e => e.status === "resolved");
  const total       = allEntries.length;
  const retrySuccessRate = total > 0 ? Math.round((resolved.length / total) * 10000) / 100 : null;

  const unresolved  = allEntries.filter(e => !["resolved"].includes(e.status));
  const oldestUnresolved = unresolved.sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  )[0] ?? null;

  return {
    agent_id:          agentId,
    filter_status:     status ?? "all",
    total_failed:      total,
    pending:           allEntries.filter(e => e.status === "pending").length,
    retrying:          allEntries.filter(e => e.status === "retrying").length,
    resolved:          resolved.length,
    exhausted:         allEntries.filter(e => e.status === "exhausted").length,
    retry_success_rate_pct: retrySuccessRate,
    oldest_unresolved: oldestUnresolved ? {
      dlq_entry_id:  oldestUnresolved.id,
      task_id:       oldestUnresolved.task_id,
      failure_reason: oldestUnresolved.failure_reason,
      created_at:    oldestUnresolved.created_at,
      retry_count:   oldestUnresolved.retry_count,
      status:        oldestUnresolved.status,
    } : null,
    entries: entries.map(e => ({
      dlq_entry_id:   e.id,
      task_id:        e.task_id,
      failure_reason: e.failure_reason,
      retry_count:    e.retry_count,
      max_retries:    e.max_retries,
      status:         e.status,
      next_retry_at:  e.next_retry_at,
      resolved_at:    e.resolved_at,
      created_at:     e.created_at,
    })),
    fee_usd: 0,
    message: `${entries.length} DLQ entries found for agent ${agentId}${status ? ` with status '${status}'` : ""}.`,
  };
}

// ─── Get Observability Report ──────────────────────────────────────────────────

/**
 * Comprehensive observability report: traces, spans, hallucination rate, error budget.
 * @param {string} workflowId - Workflow to report on
 * @param {string} timeRange  - "24h" | "7d" | "30d" (default "7d")
 * @returns Full dashboard: traces, latencies, failures, hallucination_rate, error budget
 * Fee: $10/month per workflow
 */
export function getObservabilityReport(workflowId, timeRange = "7d") {
  if (!workflowId) throw new Error("workflowId is required");

  const rangeMap   = { "24h": "-1 days", "7d": "-7 days", "30d": "-30 days" };
  const sqlRange   = rangeMap[timeRange] ?? "-7 days";
  const commission = Math.round(OBSERVABILITY_REPORT_FEE * OBS_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  // Register/update subscription
  const sub = db.prepare("SELECT * FROM obs_report_subscriptions WHERE workflow_id = ?").get(workflowId);
  if (!sub) {
    db.prepare(`
      INSERT OR IGNORE INTO obs_report_subscriptions
        (id, workflow_id, monthly_fee_usd, commission_usd, subscribed_at, last_report_at)
      VALUES (@id, @workflow_id, @monthly_fee_usd, @commission_usd, @now, @now)
    `).run({ id: uuid(), workflow_id: workflowId, monthly_fee_usd: OBSERVABILITY_REPORT_FEE, commission_usd: commission, now });
  } else {
    db.prepare("UPDATE obs_report_subscriptions SET last_report_at = ? WHERE workflow_id = ?").run(now, workflowId);
  }

  // Traces
  const traces = db.prepare(`
    SELECT * FROM obs_traces
    WHERE workflow_id = ? AND started_at >= datetime('now', ?)
    ORDER BY started_at DESC
  `).all(workflowId, sqlRange);

  // Spans across all traces in this workflow
  const traceIds = traces.map(t => t.id);
  const spans    = traceIds.length > 0
    ? db.prepare(`
        SELECT s.* FROM obs_spans s
        WHERE s.trace_id IN (${traceIds.map(() => "?").join(",")})
      `).all(...traceIds)
    : [];

  // Hallucination checks in period
  const halluChecks = db.prepare(`
    SELECT * FROM obs_hallucination_checks
    WHERE checked_at >= datetime('now', ?)
  `).all(sqlRange);

  // DLQ for this workflow (via agent IDs found in spans)
  const agentIds = [...new Set(spans.map(s => s.agent_id))];
  const dlqEntries = agentIds.length > 0
    ? db.prepare(`
        SELECT * FROM obs_dead_letter_queue
        WHERE failed_agent_id IN (${agentIds.map(() => "?").join(",")})
          AND created_at >= datetime('now', ?)
      `).all(...agentIds, sqlRange)
    : [];

  // Latency percentiles from spans
  const spanDurations = spans.map(s => s.duration_ms).filter(d => d != null && d < 60000);
  const latencies     = computePercentiles(spanDurations);

  // Trace-level metrics
  const completedTraces  = traces.filter(t => t.status === "completed");
  const failedTraces     = traces.filter(t => t.status === "failed");
  const activeTraces     = traces.filter(t => t.status === "active");
  const traceDurations   = completedTraces.map(t => t.total_duration_ms).filter(Boolean);
  const traceLatencies   = computePercentiles(traceDurations);

  const totalSpans       = spans.length;
  const errorSpans       = spans.filter(s => s.status !== "ok").length;
  const errorRate        = totalSpans > 0 ? Math.round((errorSpans / totalSpans) * 10000) / 100 : 0;

  // Error budget (SLO: 99.5% success rate → budget = 0.5%)
  const SLO_TARGET       = 99.5;
  const successRate      = totalSpans > 0 ? 100 - errorRate : 100;
  const errorBudgetTotal = 100 - SLO_TARGET;
  const errorBudgetUsed  = Math.max(0, SLO_TARGET - successRate);
  const errorBudgetRemaining = Math.max(0, errorBudgetTotal - errorBudgetUsed);
  const errorBudgetPct   = Math.round((errorBudgetRemaining / errorBudgetTotal) * 10000) / 100;

  // Hallucination stats
  const avgHalluScore    = halluChecks.length > 0
    ? Math.round(halluChecks.reduce((s, c) => s + c.hallucination_score, 0) / halluChecks.length * 1000) / 1000
    : null;

  // Agents involved
  const agentActivity = Object.entries(
    spans.reduce((acc, s) => {
      acc[s.agent_id] = acc[s.agent_id] ?? { span_count: 0, error_count: 0, total_duration_ms: 0 };
      acc[s.agent_id].span_count++;
      if (s.status !== "ok") acc[s.agent_id].error_count++;
      acc[s.agent_id].total_duration_ms += s.duration_ms ?? 0;
      return acc;
    }, {})
  ).map(([agent_id, stats]) => ({
    agent_id,
    ...stats,
    avg_duration_ms: stats.span_count > 0 ? Math.round(stats.total_duration_ms / stats.span_count) : 0,
    error_rate_pct:  stats.span_count > 0 ? Math.round((stats.error_count / stats.span_count) * 10000) / 100 : 0,
  })).sort((a, b) => b.span_count - a.span_count);

  return {
    workflow_id:        workflowId,
    time_range:         timeRange,
    generated_at:       now,

    traces: {
      total:     traces.length,
      completed: completedTraces.length,
      failed:    failedTraces.length,
      active:    activeTraces.length,
      latency_ms: traceLatencies,
    },

    spans: {
      total:         totalSpans,
      error_count:   errorSpans,
      error_rate_pct: errorRate,
      latency_ms:    latencies,
    },

    hallucination: {
      checks_performed:   halluChecks.length,
      avg_score:          avgHalluScore,
      high_risk_count:    halluChecks.filter(c => c.hallucination_score > 0.4).length,
      clean_count:        halluChecks.filter(c => c.hallucination_score <= 0.15).length,
      verdict:            avgHalluScore == null  ? "no_data"
                        : avgHalluScore > 0.4   ? "high_hallucination_risk"
                        : avgHalluScore > 0.15  ? "moderate_hallucination_risk"
                        : "low_hallucination_risk",
    },

    dead_letter_queue: {
      total_entries:     dlqEntries.length,
      pending:           dlqEntries.filter(e => e.status === "pending").length,
      retrying:          dlqEntries.filter(e => e.status === "retrying").length,
      exhausted:         dlqEntries.filter(e => e.status === "exhausted").length,
      resolved:          dlqEntries.filter(e => e.status === "resolved").length,
    },

    error_budget: {
      slo_target_pct:          SLO_TARGET,
      current_success_rate_pct: Math.round(successRate * 100) / 100,
      budget_total_pct:        errorBudgetTotal,
      budget_used_pct:         Math.round(errorBudgetUsed * 100) / 100,
      budget_remaining_pct:    Math.round(errorBudgetRemaining * 100) / 100,
      budget_remaining_ratio:  errorBudgetPct,
      status:                  errorBudgetPct > 50 ? "healthy" : errorBudgetPct > 10 ? "warning" : "critical",
    },

    agent_activity:     agentActivity,

    monthly_fee_usd:         OBSERVABILITY_REPORT_FEE,
    platform_commission_usd: commission,
  };
}
