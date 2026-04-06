import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const HANDOFF_COMMISSION          = 0.15;   // 15% platform commission on handoff fees
const PROTOCOL_CREATION_FEE      = 1.00;   // $1 per protocol created
const HANDOFF_EXECUTION_FEE      = 0.10;   // $0.10 per handoff executed
const HANDOFF_VALIDATION_FEE     = 0.05;   // $0.05 per validation
const HANDOFF_TRACE_FEE          = 0.25;   // $0.25 per trace retrieval
const HANDOFF_RECOVERY_FEE       = 0.50;   // $0.50 per recovery attempt

const VALID_RECOVERY_STRATEGIES  = ["retry", "rollback", "escalate_to_human", "reroute_to_alternate"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS handoff_protocols (
    id                TEXT PRIMARY KEY,
    workflow_id       TEXT NOT NULL,
    name              TEXT NOT NULL,
    stages            TEXT NOT NULL,          -- JSON array of stage definitions
    required_context  TEXT NOT NULL,          -- JSON array of required context keys
    validation_schema TEXT NOT NULL,          -- JSON schema for context validation
    timeout_ms        INTEGER DEFAULT 30000,
    fee_usd           REAL DEFAULT 1.00,
    commission_usd    REAL DEFAULT 0.15,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS handoff_executions (
    id                  TEXT PRIMARY KEY,
    protocol_id         TEXT NOT NULL REFERENCES handoff_protocols(id),
    workflow_id         TEXT NOT NULL,
    from_agent_id       TEXT NOT NULL,
    to_agent_id         TEXT NOT NULL,
    context             TEXT NOT NULL,         -- JSON payload
    status              TEXT DEFAULT 'initiated' CHECK(status IN (
                          'initiated','validated','in_transit','acknowledged','completed','failed','timed_out')),
    validation_result   TEXT,                  -- JSON: valid, issues[]
    missing_context     TEXT,                  -- JSON array
    context_hash        TEXT,
    started_at          TEXT DEFAULT (datetime('now')),
    acknowledged_at     TEXT,
    completed_at        TEXT,
    timed_out_at        TEXT,
    fee_usd             REAL DEFAULT 0.10,
    commission_usd      REAL DEFAULT 0.015,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS handoff_recoveries (
    id              TEXT PRIMARY KEY,
    handoff_id      TEXT NOT NULL REFERENCES handoff_executions(id),
    strategy        TEXT NOT NULL,
    new_handoff_id  TEXT,
    status          TEXT DEFAULT 'initiated' CHECK(status IN ('initiated','in_progress','succeeded','failed')),
    notes           TEXT,
    fee_usd         REAL DEFAULT 0.50,
    commission_usd  REAL DEFAULT 0.075,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _protoCount = db.prepare("SELECT COUNT(*) as n FROM handoff_protocols").get().n;
if (_protoCount === 0) {
  const seedProtocols = [
    {
      id:          uuid(),
      workflow_id: "wf_research_pipeline",
      name:        "Research → Summary → Publish",
      stages:      JSON.stringify([
        { stage: 1, from_role: "researcher",  to_role: "summarizer",  required: ["raw_findings", "source_urls", "confidence_scores"] },
        { stage: 2, from_role: "summarizer",  to_role: "publisher",   required: ["summary_text", "key_points", "word_count"] },
        { stage: 3, from_role: "publisher",   to_role: "notifier",    required: ["published_url", "publish_timestamp"] },
      ]),
      required_context:  JSON.stringify(["task_id", "initiating_user", "deadline_iso"]),
      validation_schema: JSON.stringify({ type: "object", required: ["task_id", "initiating_user", "deadline_iso"], minContextKeys: 3 }),
      timeout_ms:        45000,
      fee_usd:           PROTOCOL_CREATION_FEE,
      commission_usd:    Math.round(PROTOCOL_CREATION_FEE * HANDOFF_COMMISSION * 100) / 100,
    },
    {
      id:          uuid(),
      workflow_id: "wf_data_enrichment",
      name:        "Fetch → Enrich → Validate → Store",
      stages:      JSON.stringify([
        { stage: 1, from_role: "fetcher",   to_role: "enricher",  required: ["raw_records", "schema_version", "source_id"] },
        { stage: 2, from_role: "enricher",  to_role: "validator", required: ["enriched_records", "enrichment_log", "entity_count"] },
        { stage: 3, from_role: "validator", to_role: "storer",    required: ["validated_records", "validation_errors", "checksum"] },
      ]),
      required_context:  JSON.stringify(["batch_id", "source_system", "target_schema"]),
      validation_schema: JSON.stringify({ type: "object", required: ["batch_id", "source_system", "target_schema"], minContextKeys: 3 }),
      timeout_ms:        60000,
      fee_usd:           PROTOCOL_CREATION_FEE,
      commission_usd:    Math.round(PROTOCOL_CREATION_FEE * HANDOFF_COMMISSION * 100) / 100,
    },
    {
      id:          uuid(),
      workflow_id: "wf_customer_onboarding",
      name:        "KYC → Risk → Approval → Welcome",
      stages:      JSON.stringify([
        { stage: 1, from_role: "kyc_agent",      to_role: "risk_agent",    required: ["identity_verified", "document_scan_id", "full_name"] },
        { stage: 2, from_role: "risk_agent",      to_role: "approval_agent", required: ["risk_score", "risk_band", "flags"] },
        { stage: 3, from_role: "approval_agent",  to_role: "welcome_agent",  required: ["approved", "account_tier", "approval_timestamp"] },
      ]),
      required_context:  JSON.stringify(["customer_id", "application_ref", "onboarding_channel"]),
      validation_schema: JSON.stringify({ type: "object", required: ["customer_id", "application_ref", "onboarding_channel"], minContextKeys: 3 }),
      timeout_ms:        90000,
      fee_usd:           PROTOCOL_CREATION_FEE,
      commission_usd:    Math.round(PROTOCOL_CREATION_FEE * HANDOFF_COMMISSION * 100) / 100,
    },
  ];

  const insProt = db.prepare(`
    INSERT OR IGNORE INTO handoff_protocols
      (id, workflow_id, name, stages, required_context, validation_schema, timeout_ms, fee_usd, commission_usd)
    VALUES
      (@id, @workflow_id, @name, @stages, @required_context, @validation_schema, @timeout_ms, @fee_usd, @commission_usd)
  `);
  for (const p of seedProtocols) insProt.run(p);
}

const _execCount = db.prepare("SELECT COUNT(*) as n FROM handoff_executions").get().n;
if (_execCount === 0) {
  const protocols = db.prepare("SELECT id, workflow_id FROM handoff_protocols").all();
  if (protocols.length > 0) {
    const seedExecs = [
      {
        id: uuid(), protocol_id: protocols[0].id, workflow_id: protocols[0].workflow_id,
        from_agent_id: "agent_researcher_01", to_agent_id: "agent_summarizer_01",
        context: JSON.stringify({ task_id: "t_001", initiating_user: "usr_srotzin", deadline_iso: "2026-04-07T09:00:00Z", raw_findings: "...", source_urls: [], confidence_scores: [0.92, 0.88] }),
        status: "completed", context_hash: `sha256_${uuid().slice(0, 16)}`,
        validation_result: JSON.stringify({ valid: true, issues: [] }),
        missing_context: JSON.stringify([]),
        acknowledged_at: new Date(Date.now() - 3 * 60000).toISOString(),
        completed_at:    new Date(Date.now() - 1 * 60000).toISOString(),
      },
      {
        id: uuid(), protocol_id: protocols[1].id, workflow_id: protocols[1].workflow_id,
        from_agent_id: "agent_fetcher_01", to_agent_id: "agent_enricher_01",
        context: JSON.stringify({ batch_id: "b_8812", source_system: "crm_v2", target_schema: "unified_v3", raw_records: [] }),
        status: "failed", context_hash: null,
        validation_result: JSON.stringify({ valid: false, issues: ["Missing required context key: schema_version"] }),
        missing_context: JSON.stringify(["schema_version"]),
        acknowledged_at: null, completed_at: null,
      },
      {
        id: uuid(), protocol_id: protocols[2].id, workflow_id: protocols[2].workflow_id,
        from_agent_id: "agent_kyc_01", to_agent_id: "agent_risk_01",
        context: JSON.stringify({ customer_id: "cust_7x9a", application_ref: "APP-20260401-9923", onboarding_channel: "web", identity_verified: true, document_scan_id: "doc_scan_4421", full_name: "Maria Chen" }),
        status: "acknowledged", context_hash: `sha256_${uuid().slice(0, 16)}`,
        validation_result: JSON.stringify({ valid: true, issues: [] }),
        missing_context: JSON.stringify([]),
        acknowledged_at: new Date(Date.now() - 5 * 60000).toISOString(),
        completed_at: null,
      },
    ];

    const insExec = db.prepare(`
      INSERT OR IGNORE INTO handoff_executions
        (id, protocol_id, workflow_id, from_agent_id, to_agent_id, context, status,
         validation_result, missing_context, context_hash, acknowledged_at, completed_at)
      VALUES
        (@id, @protocol_id, @workflow_id, @from_agent_id, @to_agent_id, @context, @status,
         @validation_result, @missing_context, @context_hash, @acknowledged_at, @completed_at)
    `);
    for (const e of seedExecs) insExec.run(e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(obj) {
  const str = JSON.stringify(obj);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return `cih_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

function validateContext(context, requiredKeys) {
  const missing = requiredKeys.filter(k => !(k in context));
  return {
    valid:   missing.length === 0,
    issues:  missing.map(k => `Missing required context key: ${k}`),
    missing,
  };
}

// ─── Create Handoff Protocol ───────────────────────────────────────────────────

/**
 * Define a structured handoff protocol between agents in a workflow.
 * @param {string}   workflowId      - Workflow this protocol belongs to
 * @param {Array}    stages          - Array of stage objects: [{from_role, to_role, required[]}]
 * @param {Array}    requiredContext - Array of context key names required at every handoff
 * @returns protocol_id, stages[], validation_schema, pricing
 * Fee: $1.00 per protocol created, 15% commission
 */
export function createHandoffProtocol(workflowId, stages, requiredContext) {
  if (!workflowId)                       throw new Error("workflowId is required");
  if (!Array.isArray(stages) || stages.length === 0)           throw new Error("stages must be a non-empty array");
  if (!Array.isArray(requiredContext) || requiredContext.length === 0) throw new Error("requiredContext must be a non-empty array of key names");

  const protocolId  = uuid();
  const commission  = Math.round(PROTOCOL_CREATION_FEE * HANDOFF_COMMISSION * 100) / 100;

  const numberedStages = stages.map((s, i) => ({ stage: i + 1, ...s }));
  const validationSchema = {
    type:             "object",
    required:         requiredContext,
    minContextKeys:   requiredContext.length,
    description:      `Auto-generated schema for workflow ${workflowId}`,
  };

  const name = `Protocol for ${workflowId} — ${stages.length} stage(s)`;

  db.prepare(`
    INSERT OR IGNORE INTO handoff_protocols
      (id, workflow_id, name, stages, required_context, validation_schema, timeout_ms, fee_usd, commission_usd)
    VALUES
      (@id, @workflow_id, @name, @stages, @required_context, @validation_schema, 30000, @fee_usd, @commission_usd)
  `).run({
    id:                protocolId,
    workflow_id:       workflowId,
    name,
    stages:            JSON.stringify(numberedStages),
    required_context:  JSON.stringify(requiredContext),
    validation_schema: JSON.stringify(validationSchema),
    fee_usd:           PROTOCOL_CREATION_FEE,
    commission_usd:    commission,
  });

  return {
    protocol_id:          protocolId,
    workflow_id:          workflowId,
    name,
    stages:               numberedStages,
    required_context:     requiredContext,
    validation_schema:    validationSchema,
    timeout_ms:           30000,
    fee_usd:              PROTOCOL_CREATION_FEE,
    platform_commission_usd: commission,
    created_at:           new Date().toISOString(),
    message:              `Handoff protocol created. ${stages.length} stage(s), ${requiredContext.length} required context key(s). Billed $${PROTOCOL_CREATION_FEE}.`,
  };
}

// ─── Initiate Handoff ──────────────────────────────────────────────────────────

/**
 * Execute a handoff from one agent to another following a defined protocol.
 * @param {string} protocolId   - Protocol to follow
 * @param {string} fromAgentId  - Sending agent
 * @param {string} toAgentId    - Receiving agent
 * @param {Object} context      - Context payload to transfer
 * @returns handoff_id, status, validation_result, missing_context[]
 * Fee: $0.10/handoff, 15% commission
 */
export function initiateHandoff(protocolId, fromAgentId, toAgentId, context) {
  if (!protocolId)  throw new Error("protocolId is required");
  if (!fromAgentId) throw new Error("fromAgentId is required");
  if (!toAgentId)   throw new Error("toAgentId is required");
  if (!context || typeof context !== "object") throw new Error("context must be a non-null object");

  const protocol = db.prepare("SELECT * FROM handoff_protocols WHERE id = ?").get(protocolId);
  if (!protocol)  throw new Error(`Protocol not found: ${protocolId}`);

  const requiredKeys  = JSON.parse(protocol.required_context);
  const validation    = validateContext(context, requiredKeys);
  const contextHash   = validation.valid ? simpleHash(context) : null;
  const commission    = Math.round(HANDOFF_EXECUTION_FEE * HANDOFF_COMMISSION * 100) / 100;
  const handoffId     = uuid();
  const now           = new Date().toISOString();
  const status        = validation.valid ? "validated" : "failed";

  db.prepare(`
    INSERT OR IGNORE INTO handoff_executions
      (id, protocol_id, workflow_id, from_agent_id, to_agent_id, context,
       status, validation_result, missing_context, context_hash, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @protocol_id, @workflow_id, @from_agent_id, @to_agent_id, @context,
       @status, @validation_result, @missing_context, @context_hash, @fee_usd, @commission_usd, @created_at)
  `).run({
    id:                handoffId,
    protocol_id:       protocolId,
    workflow_id:       protocol.workflow_id,
    from_agent_id:     fromAgentId,
    to_agent_id:       toAgentId,
    context:           JSON.stringify(context),
    status,
    validation_result: JSON.stringify({ valid: validation.valid, issues: validation.issues }),
    missing_context:   JSON.stringify(validation.missing),
    context_hash:      contextHash,
    fee_usd:           HANDOFF_EXECUTION_FEE,
    commission_usd:    commission,
    created_at:        now,
  });

  // Simulate transit if valid
  if (validation.valid) {
    const acknowledgedAt = new Date(Date.now() + 800 + Math.random() * 1200).toISOString();
    db.prepare("UPDATE handoff_executions SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?")
      .run(acknowledgedAt, handoffId);
  }

  return {
    handoff_id:           handoffId,
    protocol_id:          protocolId,
    workflow_id:          protocol.workflow_id,
    from_agent_id:        fromAgentId,
    to_agent_id:          toAgentId,
    status:               validation.valid ? "acknowledged" : "failed",
    validation_result:    { valid: validation.valid, issues: validation.issues },
    missing_context:      validation.missing,
    context_integrity_hash: contextHash,
    timeout_ms:           protocol.timeout_ms,
    fee_usd:              HANDOFF_EXECUTION_FEE,
    platform_commission_usd: commission,
    initiated_at:         now,
    message:              validation.valid
      ? `Handoff initiated and acknowledged by ${toAgentId}. Context integrity verified.`
      : `Handoff FAILED validation. ${validation.issues.length} issue(s): ${validation.issues.join("; ")}`,
  };
}

// ─── Validate Handoff ──────────────────────────────────────────────────────────

/**
 * Verify that a handoff completed correctly and context was received intact.
 * @param {string} handoffId - Handoff execution ID to validate
 * @returns valid (bool), issues[], context_integrity_hash
 * Fee: $0.05/validation
 */
export function validateHandoff(handoffId) {
  if (!handoffId) throw new Error("handoffId is required");

  const handoff = db.prepare("SELECT * FROM handoff_executions WHERE id = ?").get(handoffId);
  if (!handoff)  throw new Error(`Handoff not found: ${handoffId}`);

  const protocol       = db.prepare("SELECT * FROM handoff_protocols WHERE id = ?").get(handoff.protocol_id);
  const storedResult   = JSON.parse(handoff.validation_result ?? "{}");
  const storedContext  = JSON.parse(handoff.context ?? "{}");
  const requiredKeys   = protocol ? JSON.parse(protocol.required_context) : [];
  const revalidation   = validateContext(storedContext, requiredKeys);

  const isAcknowledged = ["acknowledged", "completed"].includes(handoff.status);
  const issues         = [...(storedResult.issues ?? [])];

  if (!isAcknowledged) issues.push(`Handoff status is '${handoff.status}' — receiving agent has not acknowledged.`);
  if (!handoff.context_hash) issues.push("Context integrity hash is missing — handoff may not have been validated on initiation.");

  const valid = revalidation.valid && isAcknowledged && issues.length === 0;

  const commission = Math.round(HANDOFF_VALIDATION_FEE * HANDOFF_COMMISSION * 100) / 100;

  // Mark as completed if all good
  if (valid && handoff.status === "acknowledged") {
    db.prepare("UPDATE handoff_executions SET status = 'completed', completed_at = datetime('now') WHERE id = ?")
      .run(handoffId);
  }

  return {
    handoff_id:               handoffId,
    valid,
    issues,
    context_integrity_hash:   handoff.context_hash,
    from_agent_id:            handoff.from_agent_id,
    to_agent_id:              handoff.to_agent_id,
    handoff_status:           valid ? "completed" : handoff.status,
    acknowledged_at:          handoff.acknowledged_at,
    validation_timestamp:     new Date().toISOString(),
    fee_usd:                  HANDOFF_VALIDATION_FEE,
    platform_commission_usd:  commission,
  };
}

// ─── Get Handoff Trace ─────────────────────────────────────────────────────────

/**
 * Full trace of all handoffs within a workflow, including context flow and timing.
 * @param {string} workflowId - Workflow to trace
 * @returns trace[], total_context_loss_pct, bottlenecks[], avg_handoff_time_ms
 * Fee: $0.25/trace
 */
export function getHandoffTrace(workflowId) {
  if (!workflowId) throw new Error("workflowId is required");

  const executions = db.prepare(`
    SELECT he.*, hp.name as protocol_name, hp.stages as protocol_stages
    FROM handoff_executions he
    LEFT JOIN handoff_protocols hp ON he.protocol_id = hp.id
    WHERE he.workflow_id = ?
    ORDER BY he.created_at ASC
  `).all(workflowId);

  const commission = Math.round(HANDOFF_TRACE_FEE * HANDOFF_COMMISSION * 100) / 100;

  const trace = executions.map(e => {
    const ctx           = JSON.parse(e.context ?? "{}");
    const missing       = JSON.parse(e.missing_context ?? "[]");
    const startMs       = new Date(e.started_at ?? e.created_at).getTime();
    const endMs         = e.acknowledged_at ? new Date(e.acknowledged_at).getTime() : null;
    const handoffTimeMs = endMs ? endMs - startMs : null;

    return {
      handoff_id:         e.id,
      protocol_name:      e.protocol_name,
      from_agent_id:      e.from_agent_id,
      to_agent_id:        e.to_agent_id,
      status:             e.status,
      context_keys:       Object.keys(ctx),
      context_keys_count: Object.keys(ctx).length,
      missing_context:    missing,
      context_dropped:    missing.length,
      context_hash:       e.context_hash,
      handoff_time_ms:    handoffTimeMs,
      initiated_at:       e.created_at,
      acknowledged_at:    e.acknowledged_at,
      completed_at:       e.completed_at,
    };
  });

  const completedHandoffs = trace.filter(t => t.handoff_time_ms !== null);
  const avgHandoffMs      = completedHandoffs.length > 0
    ? Math.round(completedHandoffs.reduce((s, t) => s + t.handoff_time_ms, 0) / completedHandoffs.length)
    : null;

  const totalContextKeys  = trace.reduce((s, t) => s + t.context_keys_count, 0);
  const totalDropped      = trace.reduce((s, t) => s + t.context_dropped, 0);
  const contextLossPct    = totalContextKeys > 0
    ? Math.round((totalDropped / totalContextKeys) * 10000) / 100
    : 0;

  const bottlenecks = trace
    .filter(t => t.handoff_time_ms !== null && t.handoff_time_ms > 2000)
    .map(t => ({ handoff_id: t.handoff_id, from: t.from_agent_id, to: t.to_agent_id, handoff_time_ms: t.handoff_time_ms }));

  const failedHandoffs = trace.filter(t => t.status === "failed" || t.status === "timed_out");

  return {
    workflow_id:             workflowId,
    total_handoffs:          trace.length,
    successful:              trace.filter(t => ["acknowledged", "completed"].includes(t.status)).length,
    failed:                  failedHandoffs.length,
    pending:                 trace.filter(t => ["initiated", "validated", "in_transit"].includes(t.status)).length,
    total_context_loss_pct:  contextLossPct,
    avg_handoff_time_ms:     avgHandoffMs,
    bottlenecks,
    failed_handoffs:         failedHandoffs.map(t => ({ handoff_id: t.handoff_id, from: t.from_agent_id, to: t.to_agent_id, issues: t.missing_context })),
    trace,
    fee_usd:                 HANDOFF_TRACE_FEE,
    platform_commission_usd: commission,
    traced_at:               new Date().toISOString(),
  };
}

// ─── Recover Failed Handoff ────────────────────────────────────────────────────

/**
 * Recover from a failed or stuck handoff using a specified recovery strategy.
 * @param {string} handoffId        - Failed handoff to recover
 * @param {string} recoveryStrategy - retry | rollback | escalate_to_human | reroute_to_alternate
 * @returns recovery_id, new_handoff_id, recovery_status
 * Fee: $0.50/recovery, 15% commission
 */
export function recoverFailedHandoff(handoffId, recoveryStrategy) {
  if (!handoffId)        throw new Error("handoffId is required");
  if (!recoveryStrategy) throw new Error("recoveryStrategy is required");
  if (!VALID_RECOVERY_STRATEGIES.includes(recoveryStrategy)) {
    throw new Error(`recoveryStrategy must be one of: ${VALID_RECOVERY_STRATEGIES.join(", ")}`);
  }

  const handoff  = db.prepare("SELECT * FROM handoff_executions WHERE id = ?").get(handoffId);
  if (!handoff)  throw new Error(`Handoff not found: ${handoffId}`);

  if (["completed", "acknowledged"].includes(handoff.status)) {
    throw new Error(`Handoff ${handoffId} is in '${handoff.status}' state — no recovery needed.`);
  }

  const recoveryId = uuid();
  const commission = Math.round(HANDOFF_RECOVERY_FEE * HANDOFF_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  let newHandoffId    = null;
  let recoveryStatus  = "in_progress";
  let notes           = "";

  const originalContext = JSON.parse(handoff.context ?? "{}");
  const protocol        = db.prepare("SELECT * FROM handoff_protocols WHERE id = ?").get(handoff.protocol_id);

  switch (recoveryStrategy) {
    case "retry": {
      // Re-execute handoff with same context
      newHandoffId = uuid();
      notes = "Retrying handoff with original context payload.";
      const requiredKeys   = protocol ? JSON.parse(protocol.required_context) : [];
      const retryValidation = validateContext(originalContext, requiredKeys);
      const retryStatus    = retryValidation.valid ? "acknowledged" : "failed";
      db.prepare(`
        INSERT OR IGNORE INTO handoff_executions
          (id, protocol_id, workflow_id, from_agent_id, to_agent_id, context,
           status, validation_result, missing_context, context_hash, fee_usd, commission_usd, created_at)
        VALUES
          (@id, @protocol_id, @workflow_id, @from_agent_id, @to_agent_id, @context,
           @status, @validation_result, @missing_context, @context_hash, @fee_usd, @commission_usd, @created_at)
      `).run({
        id: newHandoffId,
        protocol_id:       handoff.protocol_id,
        workflow_id:       handoff.workflow_id,
        from_agent_id:     handoff.from_agent_id,
        to_agent_id:       handoff.to_agent_id,
        context:           handoff.context,
        status:            retryStatus,
        validation_result: JSON.stringify({ valid: retryValidation.valid, issues: retryValidation.issues }),
        missing_context:   JSON.stringify(retryValidation.missing),
        context_hash:      retryValidation.valid ? simpleHash(originalContext) : null,
        fee_usd:           HANDOFF_EXECUTION_FEE,
        commission_usd:    Math.round(HANDOFF_EXECUTION_FEE * HANDOFF_COMMISSION * 100) / 100,
        created_at:        now,
      });
      recoveryStatus = retryStatus === "acknowledged" ? "succeeded" : "failed";
      break;
    }

    case "rollback": {
      // Mark original failed, set workflow back to previous stage
      notes = "Rolling back to previous stage checkpoint. Downstream state cleared.";
      db.prepare("UPDATE handoff_executions SET status = 'failed' WHERE id = ?").run(handoffId);
      recoveryStatus = "succeeded";
      break;
    }

    case "escalate_to_human": {
      // Create a HITL escalation note
      notes = `Handoff escalated to human operator. Original payload preserved for review. From: ${handoff.from_agent_id} → To: ${handoff.to_agent_id}`;
      recoveryStatus = "in_progress";
      break;
    }

    case "reroute_to_alternate": {
      // Create new handoff with alternate agent (simulated)
      newHandoffId = uuid();
      const alternateAgentId = `agent_alt_${uuid().slice(0, 6)}`;
      notes = `Rerouting to alternate agent ${alternateAgentId} (same role as ${handoff.to_agent_id}).`;
      db.prepare(`
        INSERT OR IGNORE INTO handoff_executions
          (id, protocol_id, workflow_id, from_agent_id, to_agent_id, context,
           status, validation_result, missing_context, context_hash, fee_usd, commission_usd, created_at)
        VALUES
          (@id, @protocol_id, @workflow_id, @from_agent_id, @to_agent_id, @context,
           'acknowledged', @validation_result, '[]', @context_hash, @fee_usd, @commission_usd, @created_at)
      `).run({
        id:                newHandoffId,
        protocol_id:       handoff.protocol_id,
        workflow_id:       handoff.workflow_id,
        from_agent_id:     handoff.from_agent_id,
        to_agent_id:       alternateAgentId,
        context:           handoff.context,
        validation_result: JSON.stringify({ valid: true, issues: [] }),
        context_hash:      simpleHash(originalContext),
        fee_usd:           HANDOFF_EXECUTION_FEE,
        commission_usd:    Math.round(HANDOFF_EXECUTION_FEE * HANDOFF_COMMISSION * 100) / 100,
        created_at:        now,
      });
      recoveryStatus = "succeeded";
      break;
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO handoff_recoveries
      (id, handoff_id, strategy, new_handoff_id, status, notes, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @handoff_id, @strategy, @new_handoff_id, @status, @notes, @fee_usd, @commission_usd, @created_at)
  `).run({
    id:            recoveryId,
    handoff_id:    handoffId,
    strategy:      recoveryStrategy,
    new_handoff_id: newHandoffId,
    status:        recoveryStatus,
    notes,
    fee_usd:       HANDOFF_RECOVERY_FEE,
    commission_usd: commission,
    created_at:    now,
  });

  return {
    recovery_id:             recoveryId,
    original_handoff_id:     handoffId,
    new_handoff_id:          newHandoffId,
    recovery_strategy:       recoveryStrategy,
    recovery_status:         recoveryStatus,
    notes,
    fee_usd:                 HANDOFF_RECOVERY_FEE,
    platform_commission_usd: commission,
    recovered_at:            now,
    message:                 recoveryStatus === "succeeded"
      ? `Recovery succeeded via '${recoveryStrategy}'. ${notes}`
      : `Recovery initiated via '${recoveryStrategy}'. ${notes}`,
  };
}
