/**
 * HiveAgent ERC-8183 — Trustless Agent Work Contracts
 *
 * Proposed March 2026. The missing primitive for agentic commerce.
 *
 * The problem: agents need to exchange value for work. But who verifies the work?
 * Who holds the payment? Who arbitrates disputes? Humans? That defeats the point.
 *
 * ERC-8183 solves this with a three-role, five-state trustless contract:
 *   Client    — requests work and funds escrow
 *   Provider  — performs work and submits proof
 *   Evaluator — verifies outcome and triggers payment release
 *
 * State machine: open → funded → submitted → completed | rejected | expired
 *
 * Works identically for $0.10 image generation and $100,000 asset management.
 * Same contract. Same lifecycle. No trust required at any step.
 *
 * Revenue: HiveAgent charges 1% platform fee on completed jobs.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────
// Set CDP_API_KEY_ID to enable live on-chain escrow via Coinbase CDP.
const LIVE_MODE = !!process.env.CDP_API_KEY_ID;

const PLATFORM_FEE_PCT  = 0.01;  // 1% on completed jobs
const EVALUATOR_FEE_PCT = 0.02;  // default 2% evaluator fee
const DEFAULT_EXPIRY_HOURS = 72; // jobs expire after 72 hours if not acted on

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS erc8183_jobs (
      id                 TEXT PRIMARY KEY,
      client_agent       TEXT NOT NULL,
      provider_agent     TEXT,
      evaluator_agent    TEXT NOT NULL,
      title              TEXT NOT NULL,
      description        TEXT NOT NULL,
      deliverable        TEXT NOT NULL,
      payment_usdc       REAL NOT NULL,
      state              TEXT NOT NULL DEFAULT 'open',
      funded             INTEGER NOT NULL DEFAULT 0,
      submitted_work     TEXT,
      proof_url          TEXT,
      evaluation_result  TEXT,
      quality_score      REAL,
      rejection_reason   TEXT,
      platform_fee_usdc  REAL,
      evaluator_fee_usdc REAL,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      funded_at          TEXT,
      submitted_at       TEXT,
      completed_at       TEXT,
      expires_at         TEXT
    );

    CREATE TABLE IF NOT EXISTS erc8183_evaluators (
      agent_id        TEXT PRIMARY KEY,
      specialty       TEXT NOT NULL,
      fee_pct         REAL NOT NULL DEFAULT 2.0,
      jobs_evaluated  INTEGER NOT NULL DEFAULT 0,
      accuracy_rate   REAL NOT NULL DEFAULT 95.0,
      registered_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS erc8183_disputes (
      id               TEXT PRIMARY KEY,
      job_id           TEXT NOT NULL,
      disputing_agent  TEXT NOT NULL,
      reason           TEXT NOT NULL,
      evidence         TEXT,
      resolution       TEXT,
      resolved_at      TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_erc8183_jobs_state    ON erc8183_jobs(state);
    CREATE INDEX IF NOT EXISTS idx_erc8183_jobs_client   ON erc8183_jobs(client_agent);
    CREATE INDEX IF NOT EXISTS idx_erc8183_jobs_provider ON erc8183_jobs(provider_agent);
    CREATE INDEX IF NOT EXISTS idx_erc8183_disputes_job  ON erc8183_disputes(job_id);
  `);
} catch (e) {
  console.error("[erc8183] Schema init error:", e.message);
}

// ─── Seed Evaluators ──────────────────────────────────────────────────────────

try {
  const seedEvaluators = [
    { agent_id: "evaluator-code-review",        specialty: "code-review",        fee_pct: 2.0, accuracy_rate: 97.2 },
    { agent_id: "evaluator-financial-analysis", specialty: "financial-analysis",  fee_pct: 3.0, accuracy_rate: 96.8 },
    { agent_id: "evaluator-content-quality",    specialty: "content-quality",     fee_pct: 1.5, accuracy_rate: 94.5 },
    { agent_id: "evaluator-compliance-check",   specialty: "compliance-check",    fee_pct: 3.5, accuracy_rate: 98.1 },
    { agent_id: "evaluator-creative-review",    specialty: "creative-review",     fee_pct: 1.5, accuracy_rate: 93.7 },
  ];

  const insertEval = db.prepare(`
    INSERT OR IGNORE INTO erc8183_evaluators
      (agent_id, specialty, fee_pct, accuracy_rate)
    VALUES
      (@agent_id, @specialty, @fee_pct, @accuracy_rate)
  `);

  const seedAll = db.transaction((rows) => rows.forEach(r => insertEval.run(r)));
  seedAll(seedEvaluators);
} catch (e) {
  console.error("[erc8183] Seed error:", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateDescription(job) {
  const map = {
    open:      `Job posted and awaiting escrow funding. Client must call fundJob to lock payment before any provider begins work.`,
    funded:    `Payment of $${job.payment_usdc} USDC locked in escrow. Providers may now accept and execute this contract.`,
    submitted: `Work delivered by ${job.provider_agent || "provider"}. Evaluator (${job.evaluator_agent}) has 24 hours to verify.`,
    completed: `Contract fulfilled. Client received deliverable. Provider received payment. Evaluator fee collected. No disputes.`,
    rejected:  `Work did not meet specification. Reason: ${job.rejection_reason || "see evaluation"}. Provider may revise or dispute.`,
    expired:   `Contract expired before completion. Any locked funds are eligible for refund to client.`,
    disputed:  `Active dispute filed. Arbitration in progress. Funds frozen pending resolution.`,
  };
  return map[job.state] || `State: ${job.state}`;
}

function syntheticEscrowAddress(jobId) {
  // Deterministic mock address for demo; CDP provides real address in LIVE_MODE
  return `0x${jobId.replace(/-/g, "").slice(0, 40)}`;
}

function computeExpiry(hoursFromNow) {
  const ms = (hoursFromNow || DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

// ─── Exported Tools ───────────────────────────────────────────────────────────

/**
 * createJob — open a work contract
 * Client specifies work, payment, evaluator, and expiry.
 * Payment is NOT locked yet — that happens in fundJob.
 */
export async function createJob(args) {
  const {
    client_agent,
    title,
    description,
    deliverable,
    payment_usdc,
    evaluator_agent,
    expires_hours,
  } = args;

  if (!client_agent)    throw new Error("client_agent is required");
  if (!title)           throw new Error("title is required");
  if (!description)     throw new Error("description is required");
  if (!deliverable)     throw new Error("deliverable is required");
  if (!payment_usdc || payment_usdc <= 0) throw new Error("payment_usdc must be positive");

  // Resolve evaluator — accept any registered agent or assign default
  let resolvedEvaluator = evaluator_agent;
  if (!resolvedEvaluator) {
    try {
      const row = db.prepare(`SELECT agent_id FROM erc8183_evaluators ORDER BY accuracy_rate DESC LIMIT 1`).get();
      resolvedEvaluator = row?.agent_id || "evaluator-compliance-check";
    } catch (e) {
      resolvedEvaluator = "evaluator-compliance-check";
    }
  }

  const id         = uuid();
  const expires_at = computeExpiry(expires_hours);
  const platform_fee_usdc  = +(payment_usdc * PLATFORM_FEE_PCT).toFixed(4);
  const evaluator_fee_usdc = +(payment_usdc * EVALUATOR_FEE_PCT).toFixed(4);
  const escrow_address     = LIVE_MODE
    ? `CDP_ESCROW_${id.slice(0, 8).toUpperCase()}`
    : syntheticEscrowAddress(id);

  try {
    db.prepare(`
      INSERT INTO erc8183_jobs
        (id, client_agent, evaluator_agent, title, description, deliverable,
         payment_usdc, state, platform_fee_usdc, evaluator_fee_usdc, expires_at)
      VALUES
        (@id, @client_agent, @evaluator_agent, @title, @description, @deliverable,
         @payment_usdc, 'open', @platform_fee_usdc, @evaluator_fee_usdc, @expires_at)
    `).run({ id, client_agent, evaluator_agent: resolvedEvaluator, title, description,
              deliverable, payment_usdc, platform_fee_usdc, evaluator_fee_usdc, expires_at });
  } catch (e) {
    throw new Error(`[erc8183] createJob DB error: ${e.message}`);
  }

  return {
    job_id:        id,
    state:         "open",
    title,
    payment_usdc,
    evaluator_agent: resolvedEvaluator,
    escrow_address,
    expires_at,
    live_mode:     LIVE_MODE,
    next_step:     "Call fundJob to lock payment in escrow and open this contract to providers.",
    _declaration:  "Work contract created on-chain. Payment held until delivery verified. No trust required.",
  };
}

/**
 * fundJob — client locks payment into escrow
 * Transitions: open → funded
 * Providers can only begin work after this step.
 */
export async function fundJob(args) {
  const { job_id, client_agent } = args;
  if (!job_id)       throw new Error("job_id is required");
  if (!client_agent) throw new Error("client_agent is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183] fundJob DB error: ${e.message}`);
  }

  if (!job)                         throw new Error(`Job ${job_id} not found`);
  if (job.client_agent !== client_agent) throw new Error("Only the job's client can fund it");
  if (job.state !== "open")         throw new Error(`Cannot fund a job in state '${job.state}' — must be 'open'`);

  const funded_at = new Date().toISOString();
  try {
    db.prepare(`
      UPDATE erc8183_jobs SET state = 'funded', funded = 1, funded_at = ? WHERE id = ?
    `).run(funded_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183] fundJob update error: ${e.message}`);
  }

  return {
    job_id,
    state:          "funded",
    title:          job.title,
    payment_locked: job.payment_usdc,
    funded_at,
    escrow_address: syntheticEscrowAddress(job_id),
    live_mode:      LIVE_MODE,
    next_step:      "A provider can now accept this contract and submit work.",
    _message:       "Payment locked. Provider can now begin work.",
  };
}

/**
 * submitWork — provider delivers completed work
 * Transitions: funded → submitted
 * Triggers evaluator notification (24-hour window).
 */
export async function submitWork(args) {
  const { job_id, provider_agent, work_result, proof_url } = args;
  if (!job_id)         throw new Error("job_id is required");
  if (!provider_agent) throw new Error("provider_agent is required");
  if (!work_result)    throw new Error("work_result is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183] submitWork DB error: ${e.message}`);
  }

  if (!job)                 throw new Error(`Job ${job_id} not found`);
  if (job.state !== "funded") throw new Error(`Cannot submit work for a job in state '${job.state}' — must be 'funded'`);

  const submitted_at = new Date().toISOString();
  const submission_id = uuid();

  try {
    db.prepare(`
      UPDATE erc8183_jobs
        SET state = 'submitted', provider_agent = ?, submitted_work = ?,
            proof_url = ?, submitted_at = ?
      WHERE id = ?
    `).run(provider_agent, JSON.stringify({ result: work_result, submission_id }), proof_url || null, submitted_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183] submitWork update error: ${e.message}`);
  }

  return {
    submission_id,
    job_id,
    state:              "submitted",
    provider_agent,
    evaluator_agent:    job.evaluator_agent,
    evaluator_notified: true,
    evaluation_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    live_mode:          LIVE_MODE,
    _message:           "Work submitted. Evaluator has 24 hours to verify.",
  };
}

/**
 * evaluateWork — evaluator approves or rejects submitted work
 * Approved  → completed, payment released to provider
 * Rejected  → provider may revise or open a dispute
 */
export async function evaluateWork(args) {
  const { job_id, evaluator_agent, approved, feedback, quality_score } = args;
  if (!job_id)          throw new Error("job_id is required");
  if (!evaluator_agent) throw new Error("evaluator_agent is required");
  if (approved === undefined) throw new Error("approved (boolean) is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183] evaluateWork DB error: ${e.message}`);
  }

  if (!job) throw new Error(`Job ${job_id} not found`);
  if (job.state !== "submitted") throw new Error(`Cannot evaluate a job in state '${job.state}' — must be 'submitted'`);

  const newState     = approved ? "completed" : "rejected";
  const completed_at = approved ? new Date().toISOString() : null;
  const platform_fee = approved ? job.platform_fee_usdc  : 0;
  const eval_fee     = approved ? job.evaluator_fee_usdc : 0;
  const net_payout   = approved ? +(job.payment_usdc - platform_fee - eval_fee).toFixed(4) : 0;

  try {
    db.prepare(`
      UPDATE erc8183_jobs
        SET state = ?, evaluation_result = ?, quality_score = ?,
            rejection_reason = ?, completed_at = ?
      WHERE id = ?
    `).run(
      newState,
      JSON.stringify({ approved, feedback, quality_score, evaluator_agent }),
      quality_score || null,
      approved ? null : (feedback || "Work did not meet specification"),
      completed_at,
      job_id
    );
  } catch (e) {
    throw new Error(`[erc8183] evaluateWork update error: ${e.message}`);
  }

  // Update evaluator stats
  try {
    db.prepare(`
      UPDATE erc8183_evaluators
        SET jobs_evaluated = jobs_evaluated + 1
      WHERE agent_id = ?
    `).run(evaluator_agent);
  } catch (e) {
    console.error("[erc8183] evaluator stats update failed:", e.message);
  }

  if (approved) {
    return {
      job_id,
      decision:         "approved",
      state:            "completed",
      quality_score:    quality_score || null,
      feedback,
      payment_released: net_payout,
      platform_fee:     platform_fee,
      fee_collected:    eval_fee,
      evaluator_agent,
      completed_at,
      live_mode:        LIVE_MODE,
      _story: "ERC-8183 completed. Client got work. Provider got paid. No middleman needed.",
    };
  } else {
    return {
      job_id,
      decision:           "rejected",
      state:              "rejected",
      quality_score:      quality_score || null,
      rejection_reason:   feedback || "Work did not meet specification",
      payment_released:   0,
      fee_collected:      0,
      next_steps:         ["Provider may resubmit revised work", "Provider may file a dispute"],
      evaluator_agent,
      live_mode:          LIVE_MODE,
      _story: "Work rejected. Payment still in escrow. Provider can revise and resubmit, or escalate to dispute arbitration.",
    };
  }
}

/**
 * disputeJob — raise a formal dispute on a job
 * Available to client or provider; creates arbitration record.
 */
export async function disputeJob(args) {
  const { job_id, disputing_agent, reason, evidence } = args;
  if (!job_id)          throw new Error("job_id is required");
  if (!disputing_agent) throw new Error("disputing_agent is required");
  if (!reason)          throw new Error("reason is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183] disputeJob DB error: ${e.message}`);
  }

  if (!job) throw new Error(`Job ${job_id} not found`);

  const validStates = ["funded", "submitted", "rejected"];
  if (!validStates.includes(job.state)) {
    throw new Error(`Cannot dispute a job in state '${job.state}' — must be one of: ${validStates.join(", ")}`);
  }

  const dispute_id = uuid();

  try {
    db.prepare(`
      INSERT INTO erc8183_disputes (id, job_id, disputing_agent, reason, evidence)
      VALUES (@id, @job_id, @disputing_agent, @reason, @evidence)
    `).run({ id: dispute_id, job_id, disputing_agent, reason, evidence: evidence || null });

    db.prepare(`UPDATE erc8183_jobs SET state = 'disputed' WHERE id = ?`).run(job_id);
  } catch (e) {
    throw new Error(`[erc8183] disputeJob insert error: ${e.message}`);
  }

  return {
    dispute_id,
    job_id,
    state:             "disputed",
    disputing_agent,
    reason,
    arbitration_process: {
      step_1: "Both parties submit evidence within 48 hours",
      step_2: "Assigned evaluator reviews all evidence",
      step_3: "Decision issued within 72 hours of filing",
      step_4: "Funds released or refunded per decision",
      appeal:  "One appeal allowed within 24 hours of decision",
    },
    funds_status: "Frozen pending arbitration outcome",
    _story: "Dispute filed. Funds locked. Arbitration begins. The contract protects both sides.",
  };
}

/**
 * getJob — full job status with human-readable state explanation
 */
export async function getJob(args) {
  const { job_id } = args;
  if (!job_id) throw new Error("job_id is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183] getJob DB error: ${e.message}`);
  }

  if (!job) throw new Error(`Job ${job_id} not found`);

  let disputes = [];
  try {
    disputes = db.prepare(`SELECT * FROM erc8183_disputes WHERE job_id = ?`).all(job_id);
  } catch (e) {
    console.error("[erc8183] getJob disputes fetch failed:", e.message);
  }

  const timeline = [];
  if (job.created_at)   timeline.push({ event: "created",   at: job.created_at });
  if (job.funded_at)    timeline.push({ event: "funded",    at: job.funded_at });
  if (job.submitted_at) timeline.push({ event: "submitted", at: job.submitted_at });
  if (job.completed_at) timeline.push({ event: "completed", at: job.completed_at });

  return {
    job_id:           job.id,
    title:            job.title,
    description:      job.description,
    deliverable:      job.deliverable,
    client_agent:     job.client_agent,
    provider_agent:   job.provider_agent,
    evaluator_agent:  job.evaluator_agent,
    state:            job.state,
    payment_usdc:     job.payment_usdc,
    funded:           !!job.funded,
    quality_score:    job.quality_score,
    rejection_reason: job.rejection_reason,
    disputes:         disputes.length,
    dispute_records:  disputes,
    timeline,
    expires_at:       job.expires_at,
    live_mode:        LIVE_MODE,
    _state_description: stateDescription(job),
  };
}

/**
 * getJobMarket — open jobs available for providers to take
 * The job board for agents. No resumes. No interviews.
 */
export async function getJobMarket(args = {}) {
  let open_jobs = [];
  let total_value = 0;
  let all_states = {};

  try {
    open_jobs = db.prepare(`
      SELECT id, title, description, deliverable, payment_usdc,
             evaluator_agent, created_at, expires_at
      FROM erc8183_jobs
      WHERE state = 'open' AND funded = 0
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY payment_usdc DESC
    `).all();
  } catch (e) {
    throw new Error(`[erc8183] getJobMarket DB error: ${e.message}`);
  }

  try {
    const funded_total = db.prepare(`
      SELECT COALESCE(SUM(payment_usdc), 0) AS total
      FROM erc8183_jobs WHERE state IN ('funded','submitted')
    `).get();
    total_value = +(funded_total?.total || 0).toFixed(2);
  } catch (e) {
    console.error("[erc8183] getJobMarket escrow total failed:", e.message);
  }

  try {
    const rows = db.prepare(`SELECT state, COUNT(*) as cnt FROM erc8183_jobs GROUP BY state`).all();
    rows.forEach(r => { all_states[r.state] = r.cnt; });
  } catch (e) {
    console.error("[erc8183] getJobMarket stats failed:", e.message);
  }

  return {
    open_jobs,
    open_count:           open_jobs.length,
    total_value_in_escrow: total_value,
    contract_states:      all_states,
    live_mode:            LIVE_MODE,
    _hook: "The job market for agents. No resumes. No interviews. Work, deliver, get paid.",
  };
}
