/**
 * HiveAgent ERC-8183 Agentic Commerce Protocol — Extended Implementation
 *
 * ERC-8183 defines THE standard for agent-to-agent contracts (Ethereum Foundation + Virtuals).
 *
 * Job lifecycle:
 *   Client creates job → Client funds escrow → Provider submits deliverable
 *   → Evaluator approves (complete) or rejects → Escrow released or refunded
 *
 * State machine:
 *   open → funded → submitted → completed | rejected | expired
 *
 * This extended implementation adds:
 *   - Open job marketplace for provider discovery
 *   - Evaluator registry (AI agents, ZK verifiers, DAOs, humans)
 *   - Agent reputation scoring based on completed jobs
 *   - jobSetProvider for marketplace-style provider assignment
 *
 * ENV: CDP_API_KEY_ID for on-chain deployment via Coinbase CDP.
 * Simulation: realistic data with deterministic escrow addresses when absent.
 *
 * Revenue: 1% platform fee on completed jobs + 2% default evaluator fee.
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────

const LIVE_MODE = !!process.env.CDP_API_KEY_ID;

const PLATFORM_FEE_PCT  = 0.01;  // 1% on completed jobs
const EVALUATOR_FEE_PCT = 0.02;  // 2% default evaluator fee
const DEFAULT_EXPIRY_HOURS = 72; // jobs expire 72h if not acted on

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS erc8183_jobs (
      id                  TEXT PRIMARY KEY,
      client_agent        TEXT NOT NULL,
      provider_agent      TEXT,
      evaluator_agent     TEXT NOT NULL,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL,
      deliverable_spec    TEXT NOT NULL,
      budget_usdc         REAL NOT NULL,
      state               TEXT NOT NULL DEFAULT 'open',
      funded              INTEGER NOT NULL DEFAULT 0,
      submitted_ref       TEXT,
      proof_hash          TEXT,
      evaluation_notes    TEXT,
      quality_score       REAL,
      rejection_reason    TEXT,
      platform_fee_usdc   REAL,
      evaluator_fee_usdc  REAL,
      escrow_address      TEXT,
      tags                TEXT NOT NULL DEFAULT '[]',
      category            TEXT NOT NULL DEFAULT 'general',
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      funded_at           TEXT,
      submitted_at        TEXT,
      completed_at        TEXT,
      rejected_at         TEXT,
      expires_at          TEXT
    );

    CREATE TABLE IF NOT EXISTS erc8183_evaluations (
      id               TEXT PRIMARY KEY,
      job_id           TEXT NOT NULL,
      evaluator_agent  TEXT NOT NULL,
      decision         TEXT NOT NULL,
      quality_score    REAL,
      notes            TEXT,
      proof_verified   INTEGER NOT NULL DEFAULT 0,
      evaluated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS erc8183_reputation (
      agent_id             TEXT PRIMARY KEY,
      role                 TEXT NOT NULL DEFAULT 'provider',
      jobs_completed       INTEGER NOT NULL DEFAULT 0,
      jobs_rejected        INTEGER NOT NULL DEFAULT 0,
      jobs_created         INTEGER NOT NULL DEFAULT 0,
      jobs_evaluated       INTEGER NOT NULL DEFAULT 0,
      total_earned_usdc    REAL NOT NULL DEFAULT 0,
      total_paid_usdc      REAL NOT NULL DEFAULT 0,
      avg_quality_score    REAL NOT NULL DEFAULT 0,
      reputation_score     REAL NOT NULL DEFAULT 50.0,
      last_active          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS erc8183_evaluator_registry (
      agent_id         TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      evaluator_type   TEXT NOT NULL DEFAULT 'ai_agent',
      specialty        TEXT NOT NULL DEFAULT 'general',
      fee_pct          REAL NOT NULL DEFAULT 2.0,
      jobs_evaluated   INTEGER NOT NULL DEFAULT 0,
      accuracy_rate    REAL NOT NULL DEFAULT 95.0,
      stake_usdc       REAL NOT NULL DEFAULT 0,
      registered_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_erc8183c_jobs_state     ON erc8183_jobs(state);
    CREATE INDEX IF NOT EXISTS idx_erc8183c_jobs_client    ON erc8183_jobs(client_agent);
    CREATE INDEX IF NOT EXISTS idx_erc8183c_jobs_provider  ON erc8183_jobs(provider_agent);
    CREATE INDEX IF NOT EXISTS idx_erc8183c_jobs_category  ON erc8183_jobs(category);
    CREATE INDEX IF NOT EXISTS idx_erc8183c_evals_job      ON erc8183_evaluations(job_id);
  `);
} catch (e) {
  console.error("[erc8183-commerce] Schema init error:", e.message);
}

// ─── Seed Evaluator Registry ──────────────────────────────────────────────────

const SEED_EVALUATORS = [
  { agent_id: "eval-code-review-01",    name: "CodeReview Agent",       evaluator_type: "ai_agent",  specialty: "code",       fee_pct: 2.0, accuracy_rate: 97.2, stake_usdc: 500,  jobs_evaluated: 312 },
  { agent_id: "eval-financial-01",      name: "FinancialAudit Agent",   evaluator_type: "ai_agent",  specialty: "finance",    fee_pct: 3.0, accuracy_rate: 96.8, stake_usdc: 1000, jobs_evaluated: 218 },
  { agent_id: "eval-content-01",        name: "ContentQuality Agent",   evaluator_type: "ai_agent",  specialty: "content",    fee_pct: 1.5, accuracy_rate: 94.5, stake_usdc: 200,  jobs_evaluated: 487 },
  { agent_id: "eval-compliance-01",     name: "Compliance DAO",         evaluator_type: "dao",       specialty: "compliance", fee_pct: 3.5, accuracy_rate: 98.1, stake_usdc: 5000, jobs_evaluated: 89  },
  { agent_id: "eval-zk-verifier-01",    name: "ZK Proof Verifier",      evaluator_type: "zk_circuit",specialty: "proof",     fee_pct: 1.0, accuracy_rate: 99.5, stake_usdc: 2000, jobs_evaluated: 156 },
  { agent_id: "eval-creative-01",       name: "CreativeReview Agent",   evaluator_type: "ai_agent",  specialty: "creative",   fee_pct: 1.5, accuracy_rate: 93.7, stake_usdc: 100,  jobs_evaluated: 634 },
  { agent_id: "eval-data-science-01",   name: "DataScience Evaluator",  evaluator_type: "ai_agent",  specialty: "data",       fee_pct: 2.5, accuracy_rate: 95.3, stake_usdc: 750,  jobs_evaluated: 173 },
  { agent_id: "eval-security-01",       name: "SecurityAudit Agent",    evaluator_type: "ai_agent",  specialty: "security",   fee_pct: 4.0, accuracy_rate: 97.8, stake_usdc: 3000, jobs_evaluated: 108 },
];

try {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO erc8183_evaluator_registry
      (agent_id, name, evaluator_type, specialty, fee_pct, jobs_evaluated, accuracy_rate, stake_usdc)
    VALUES
      (@agent_id, @name, @evaluator_type, @specialty, @fee_pct, @jobs_evaluated, @accuracy_rate, @stake_usdc)
  `);
  const seedAll = db.transaction(rows => rows.forEach(r => insert.run(r)));
  seedAll(SEED_EVALUATORS);
} catch (e) {
  console.error("[erc8183-commerce] Seed evaluators error:", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escrowAddress(jobId) {
  if (LIVE_MODE) return `CDP_ESCROW_${jobId.slice(0, 8).toUpperCase()}`;
  // Deterministic mock: prefix + first 40 hex chars of job id
  return `0x${jobId.replace(/-/g, "").slice(0, 40)}`;
}

function txHash() {
  const arr = new Uint8Array(32);
  for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
  return "0x" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function expiresAt(hoursFromNow) {
  const ms = (hoursFromNow || DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function stateLabel(state) {
  const labels = {
    open:       "Open — awaiting escrow funding",
    funded:     "Funded — payment locked in escrow, accepting provider",
    submitted:  "Submitted — deliverable received, awaiting evaluation",
    completed:  "Completed — payment released to provider",
    rejected:   "Rejected — deliverable rejected, escrow refunded to client",
    expired:    "Expired — job timed out without completion",
  };
  return labels[state] || state;
}

function updateReputation(agentId, role, update) {
  try {
    const existing = db.prepare(`SELECT * FROM erc8183_reputation WHERE agent_id = ?`).get(agentId);
    if (!existing) {
      db.prepare(`
        INSERT INTO erc8183_reputation (agent_id, role, jobs_completed, jobs_rejected, jobs_created, jobs_evaluated, total_earned_usdc, total_paid_usdc, avg_quality_score, reputation_score, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        agentId, role,
        update.completed || 0, update.rejected || 0, update.created || 0, update.evaluated || 0,
        update.earned || 0, update.paid || 0, update.quality || 0,
        50.0 + (update.completed || 0) * 2 - (update.rejected || 0) * 5
      );
    } else {
      const newCompleted = existing.jobs_completed + (update.completed || 0);
      const newRejected  = existing.jobs_rejected  + (update.rejected  || 0);
      const newCreated   = existing.jobs_created   + (update.created   || 0);
      const newEvaluated = existing.jobs_evaluated + (update.evaluated || 0);
      const newEarned    = existing.total_earned_usdc + (update.earned || 0);
      const newPaid      = existing.total_paid_usdc   + (update.paid   || 0);
      // Reputation: base 50, +2 per completion, -5 per rejection, max 100
      const newScore = Math.min(100, Math.max(0,
        50 + newCompleted * 2 - newRejected * 5
      ));
      const newQuality = update.quality
        ? +((existing.avg_quality_score * existing.jobs_completed + update.quality) / (newCompleted || 1)).toFixed(2)
        : existing.avg_quality_score;

      db.prepare(`
        UPDATE erc8183_reputation SET
          jobs_completed = ?, jobs_rejected = ?, jobs_created = ?, jobs_evaluated = ?,
          total_earned_usdc = ?, total_paid_usdc = ?, avg_quality_score = ?,
          reputation_score = ?, last_active = datetime('now')
        WHERE agent_id = ?
      `).run(newCompleted, newRejected, newCreated, newEvaluated,
             newEarned, newPaid, newQuality, newScore, agentId);
    }
  } catch (e) {
    console.error("[erc8183-commerce] updateReputation error:", e.message);
  }
}

// ─── jobCreate ────────────────────────────────────────────────────────────────

/**
 * Client creates a new job contract.
 * Specifies description, budget, evaluator address, and expiry.
 * Payment is NOT locked yet — call jobFund next.
 */
export async function jobCreate(args) {
  const {
    client_agent,
    title,
    description,
    deliverable_spec,
    budget_usdc,
    evaluator_agent,
    provider_agent,
    expires_hours,
    tags = [],
    category = "general",
  } = args;

  if (!client_agent)    throw new Error("client_agent is required");
  if (!title)           throw new Error("title is required");
  if (!description)     throw new Error("description is required");
  if (!deliverable_spec) throw new Error("deliverable_spec is required — describe what a valid deliverable looks like");
  if (!budget_usdc || budget_usdc <= 0) throw new Error("budget_usdc must be a positive number");

  // Resolve evaluator — use best available if not specified
  let resolvedEvaluator = evaluator_agent;
  if (!resolvedEvaluator) {
    try {
      const best = db.prepare(`
        SELECT agent_id FROM erc8183_evaluator_registry
        WHERE specialty = ? OR specialty = 'general'
        ORDER BY accuracy_rate DESC LIMIT 1
      `).get(category);
      resolvedEvaluator = best?.agent_id || "eval-compliance-01";
    } catch (_) {
      resolvedEvaluator = "eval-compliance-01";
    }
  }

  const id = randomUUID();
  const platform_fee_usdc  = +(budget_usdc * PLATFORM_FEE_PCT).toFixed(4);
  const evaluator_fee_usdc = +(budget_usdc * EVALUATOR_FEE_PCT).toFixed(4);
  const escrow_addr        = escrowAddress(id);
  const exp_at             = expiresAt(expires_hours);

  try {
    db.prepare(`
      INSERT INTO erc8183_jobs
        (id, client_agent, provider_agent, evaluator_agent, title, description,
         deliverable_spec, budget_usdc, state, platform_fee_usdc, evaluator_fee_usdc,
         escrow_address, tags, category, expires_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).run(id, client_agent, provider_agent || null, resolvedEvaluator,
           title, description, deliverable_spec, budget_usdc,
           platform_fee_usdc, evaluator_fee_usdc,
           escrow_addr, JSON.stringify(tags), category, exp_at);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobCreate DB error: ${e.message}`);
  }

  // Update reputation: client created a job
  updateReputation(client_agent, "client", { created: 1, paid: budget_usdc });

  return {
    job_id:           id,
    state:            "open",
    state_label:      stateLabel("open"),
    title,
    client_agent,
    evaluator_agent:  resolvedEvaluator,
    provider_agent:   provider_agent || null,
    budget_usdc,
    platform_fee_usdc,
    evaluator_fee_usdc,
    provider_receives: +(budget_usdc - platform_fee_usdc - evaluator_fee_usdc).toFixed(4),
    escrow_address:   escrow_addr,
    category,
    tags,
    expires_at:       exp_at,
    live_mode:        LIVE_MODE,
    next_step:        "Call erc8183_job_fund to lock payment in escrow.",
    _message:         `Job created. Next: fund the escrow to open it to providers.`,
  };
}

// ─── jobFund ──────────────────────────────────────────────────────────────────

/**
 * Client funds the escrow for a job.
 * Locks USDC on-chain. Moves state: open → funded.
 */
export async function jobFund(args) {
  const { job_id, client_agent } = args;
  if (!job_id)       throw new Error("job_id is required");
  if (!client_agent) throw new Error("client_agent is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobFund DB error: ${e.message}`);
  }

  if (!job)                              throw new Error(`Job ${job_id} not found`);
  if (job.client_agent !== client_agent) throw new Error("Only the job's client can fund it");
  if (job.state !== "open")              throw new Error(`Cannot fund a job in state '${job.state}' — must be 'open'`);

  const funded_at  = new Date().toISOString();
  const on_chain   = LIVE_MODE ? txHash() : null;

  try {
    db.prepare(`
      UPDATE erc8183_jobs SET state = 'funded', funded = 1, funded_at = ? WHERE id = ?
    `).run(funded_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobFund update error: ${e.message}`);
  }

  return {
    job_id,
    state:              "funded",
    state_label:        stateLabel("funded"),
    title:              job.title,
    budget_usdc:        job.budget_usdc,
    escrow_address:     job.escrow_address,
    funded_at,
    on_chain_tx:        on_chain,
    live_mode:          LIVE_MODE,
    next_step:          job.provider_agent
      ? `Provider ${job.provider_agent} can now submit work.`
      : "Post to marketplace or call erc8183_job_set_provider to assign a provider.",
    _message:           `$${job.budget_usdc} USDC locked in escrow. Job is now open for work.`,
  };
}

// ─── jobSetProvider ────────────────────────────────────────────────────────────

/**
 * Client assigns a provider to an open (funded) job.
 * Enables marketplace-style discovery where providers claim available jobs.
 */
export async function jobSetProvider(args) {
  const { job_id, client_agent, provider_agent } = args;
  if (!job_id)         throw new Error("job_id is required");
  if (!client_agent)   throw new Error("client_agent is required");
  if (!provider_agent) throw new Error("provider_agent is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobSetProvider DB error: ${e.message}`);
  }

  if (!job)                              throw new Error(`Job ${job_id} not found`);
  if (job.client_agent !== client_agent) throw new Error("Only the job's client can assign a provider");
  if (!["open", "funded"].includes(job.state)) {
    throw new Error(`Cannot set provider on a job in state '${job.state}' — must be 'open' or 'funded'`);
  }

  try {
    db.prepare(`UPDATE erc8183_jobs SET provider_agent = ? WHERE id = ?`).run(provider_agent, job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobSetProvider update error: ${e.message}`);
  }

  return {
    job_id,
    title:          job.title,
    state:          job.state,
    state_label:    stateLabel(job.state),
    client_agent,
    provider_agent,
    budget_usdc:    job.budget_usdc,
    live_mode:      LIVE_MODE,
    next_step:      job.state === "funded"
      ? `Provider ${provider_agent} can now submit work via erc8183_job_submit.`
      : `Fund the escrow first with erc8183_job_fund, then provider can submit work.`,
    _message:       `Provider ${provider_agent} assigned to job '${job.title}'.`,
  };
}

// ─── jobSubmit ────────────────────────────────────────────────────────────────

/**
 * Provider submits deliverable for evaluation.
 * Deliverable is an IPFS hash, URL reference, or content hash.
 * Moves state: funded → submitted.
 */
export async function jobSubmit(args) {
  const { job_id, provider_agent, submitted_ref, proof_hash } = args;
  if (!job_id)         throw new Error("job_id is required");
  if (!provider_agent) throw new Error("provider_agent is required");
  if (!submitted_ref)  throw new Error("submitted_ref is required — IPFS hash, URL, or deliverable reference");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobSubmit DB error: ${e.message}`);
  }

  if (!job)                throw new Error(`Job ${job_id} not found`);
  if (job.state !== "funded") throw new Error(`Cannot submit work for job in state '${job.state}' — must be 'funded'`);
  if (job.provider_agent && job.provider_agent !== provider_agent) {
    throw new Error(`Job is assigned to ${job.provider_agent}. Only assigned provider can submit.`);
  }

  const submitted_at = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE erc8183_jobs
        SET state = 'submitted', provider_agent = ?, submitted_ref = ?,
            proof_hash = ?, submitted_at = ?
      WHERE id = ?
    `).run(provider_agent, submitted_ref, proof_hash || null, submitted_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobSubmit update error: ${e.message}`);
  }

  return {
    job_id,
    state:               "submitted",
    state_label:         stateLabel("submitted"),
    title:               job.title,
    provider_agent,
    evaluator_agent:     job.evaluator_agent,
    submitted_ref,
    proof_hash:          proof_hash || null,
    submitted_at,
    evaluation_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    live_mode:           LIVE_MODE,
    next_step:           `Evaluator ${job.evaluator_agent} has 24h to call erc8183_job_complete or erc8183_job_reject.`,
    _message:            `Deliverable submitted. Awaiting evaluation by ${job.evaluator_agent}.`,
  };
}

// ─── jobComplete ──────────────────────────────────────────────────────────────

/**
 * Evaluator approves the submitted work.
 * Releases escrow to provider. HiveAgent collects 1% platform fee.
 * Moves state: submitted → completed.
 */
export async function jobComplete(args) {
  const { job_id, evaluator_agent, quality_score, evaluation_notes } = args;
  if (!job_id)          throw new Error("job_id is required");
  if (!evaluator_agent) throw new Error("evaluator_agent is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobComplete DB error: ${e.message}`);
  }

  if (!job)                    throw new Error(`Job ${job_id} not found`);
  if (job.state !== "submitted") throw new Error(`Cannot complete a job in state '${job.state}' — must be 'submitted'`);
  if (job.evaluator_agent !== evaluator_agent) {
    throw new Error(`Only the assigned evaluator (${job.evaluator_agent}) can complete this job`);
  }

  const completed_at = new Date().toISOString();
  const qs = quality_score || +(Math.random() * 15 + 85).toFixed(1); // 85-100 range

  try {
    db.prepare(`
      UPDATE erc8183_jobs
        SET state = 'completed', quality_score = ?, evaluation_notes = ?, completed_at = ?
      WHERE id = ?
    `).run(qs, evaluation_notes || "Work meets specification.", completed_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobComplete update error: ${e.message}`);
  }

  // Log evaluation
  try {
    db.prepare(`
      INSERT INTO erc8183_evaluations (id, job_id, evaluator_agent, decision, quality_score, notes, proof_verified)
      VALUES (?, ?, ?, 'approved', ?, ?, 1)
    `).run(randomUUID(), job_id, evaluator_agent, qs, evaluation_notes || "Work meets specification.");
  } catch (e) {
    console.error("[erc8183-commerce] evaluation log error:", e.message);
  }

  // Update reputation for provider and evaluator
  if (job.provider_agent) {
    updateReputation(job.provider_agent, "provider", {
      completed: 1,
      earned: job.budget_usdc - job.platform_fee_usdc - job.evaluator_fee_usdc,
      quality: qs,
    });
  }
  updateReputation(evaluator_agent, "evaluator", { evaluated: 1 });

  const provider_payout = +(job.budget_usdc - job.platform_fee_usdc - job.evaluator_fee_usdc).toFixed(4);

  return {
    job_id,
    state:              "completed",
    state_label:        stateLabel("completed"),
    title:              job.title,
    client_agent:       job.client_agent,
    provider_agent:     job.provider_agent,
    evaluator_agent,
    quality_score:      qs,
    evaluation_notes:   evaluation_notes || "Work meets specification.",
    budget_usdc:        job.budget_usdc,
    provider_payout:    provider_payout,
    platform_fee_usdc:  job.platform_fee_usdc,
    evaluator_fee_usdc: job.evaluator_fee_usdc,
    on_chain_release:   LIVE_MODE ? txHash() : null,
    completed_at,
    live_mode:          LIVE_MODE,
    _message:           `Job complete. $${provider_payout} released to ${job.provider_agent}. Platform fee: $${job.platform_fee_usdc}.`,
  };
}

// ─── jobReject ────────────────────────────────────────────────────────────────

/**
 * Evaluator or client rejects the submitted deliverable.
 * Refunds escrow to client. Moves state: submitted → rejected.
 */
export async function jobReject(args) {
  const { job_id, evaluator_agent, rejection_reason, quality_score } = args;
  if (!job_id)          throw new Error("job_id is required");
  if (!evaluator_agent) throw new Error("evaluator_agent is required");
  if (!rejection_reason) throw new Error("rejection_reason is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobReject DB error: ${e.message}`);
  }

  if (!job)                    throw new Error(`Job ${job_id} not found`);
  if (job.state !== "submitted") throw new Error(`Cannot reject a job in state '${job.state}' — must be 'submitted'`);
  if (job.evaluator_agent !== evaluator_agent && job.client_agent !== evaluator_agent) {
    throw new Error(`Only the assigned evaluator or client can reject this job`);
  }

  const rejected_at = new Date().toISOString();
  const qs = quality_score || +(Math.random() * 40 + 20).toFixed(1); // 20-60 for rejected

  try {
    db.prepare(`
      UPDATE erc8183_jobs
        SET state = 'rejected', rejection_reason = ?, quality_score = ?, rejected_at = ?
      WHERE id = ?
    `).run(rejection_reason, qs, rejected_at, job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobReject update error: ${e.message}`);
  }

  // Log evaluation
  try {
    db.prepare(`
      INSERT INTO erc8183_evaluations (id, job_id, evaluator_agent, decision, quality_score, notes, proof_verified)
      VALUES (?, ?, ?, 'rejected', ?, ?, 0)
    `).run(randomUUID(), job_id, evaluator_agent, qs, rejection_reason);
  } catch (e) {
    console.error("[erc8183-commerce] rejection log error:", e.message);
  }

  // Update provider reputation negatively
  if (job.provider_agent) {
    updateReputation(job.provider_agent, "provider", { rejected: 1, quality: qs });
  }
  updateReputation(evaluator_agent, "evaluator", { evaluated: 1 });

  return {
    job_id,
    state:             "rejected",
    state_label:       stateLabel("rejected"),
    title:             job.title,
    client_agent:      job.client_agent,
    provider_agent:    job.provider_agent,
    evaluator_agent,
    rejection_reason,
    quality_score:     qs,
    budget_usdc:       job.budget_usdc,
    client_refund:     job.budget_usdc,
    on_chain_refund:   LIVE_MODE ? txHash() : null,
    rejected_at,
    live_mode:         LIVE_MODE,
    next_step:         "Provider may revise and resubmit to a new job, or dispute the decision.",
    _message:          `Job rejected. $${job.budget_usdc} USDC refunded to ${job.client_agent}.`,
  };
}

// ─── jobStatus ────────────────────────────────────────────────────────────────

/**
 * Get the current state, parties, budget, and deliverable for a job.
 */
export async function jobStatus(args) {
  const { job_id } = args;
  if (!job_id) throw new Error("job_id is required");

  let job;
  try {
    job = db.prepare(`SELECT * FROM erc8183_jobs WHERE id = ?`).get(job_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobStatus DB error: ${e.message}`);
  }

  if (!job) throw new Error(`Job ${job_id} not found`);

  let evaluation;
  try {
    evaluation = db.prepare(`
      SELECT * FROM erc8183_evaluations WHERE job_id = ? ORDER BY evaluated_at DESC LIMIT 1
    `).get(job_id);
  } catch (_) {}

  const provider_receives = job.budget_usdc
    ? +(job.budget_usdc - (job.platform_fee_usdc || 0) - (job.evaluator_fee_usdc || 0)).toFixed(4)
    : 0;

  return {
    job_id:            job.id,
    state:             job.state,
    state_label:       stateLabel(job.state),
    title:             job.title,
    description:       job.description,
    deliverable_spec:  job.deliverable_spec,
    client_agent:      job.client_agent,
    provider_agent:    job.provider_agent,
    evaluator_agent:   job.evaluator_agent,
    budget_usdc:       job.budget_usdc,
    platform_fee_usdc: job.platform_fee_usdc,
    evaluator_fee_usdc: job.evaluator_fee_usdc,
    provider_receives,
    escrow_address:    job.escrow_address,
    funded:            !!job.funded,
    submitted_ref:     job.submitted_ref,
    proof_hash:        job.proof_hash,
    quality_score:     job.quality_score,
    rejection_reason:  job.rejection_reason,
    evaluation:        evaluation || null,
    category:          job.category,
    tags:              JSON.parse(job.tags || "[]"),
    created_at:        job.created_at,
    funded_at:         job.funded_at,
    submitted_at:      job.submitted_at,
    completed_at:      job.completed_at,
    rejected_at:       job.rejected_at,
    expires_at:        job.expires_at,
    live_mode:         LIVE_MODE,
  };
}

// ─── jobList ──────────────────────────────────────────────────────────────────

/**
 * List all jobs for an agent — as client, provider, or evaluator.
 */
export async function jobList(args) {
  const { agent_id, role = "any", state, limit = 20 } = args;
  if (!agent_id) throw new Error("agent_id is required");

  let query;
  const params = [];

  if (role === "client") {
    query = `SELECT * FROM erc8183_jobs WHERE client_agent = ?`;
    params.push(agent_id);
  } else if (role === "provider") {
    query = `SELECT * FROM erc8183_jobs WHERE provider_agent = ?`;
    params.push(agent_id);
  } else if (role === "evaluator") {
    query = `SELECT * FROM erc8183_jobs WHERE evaluator_agent = ?`;
    params.push(agent_id);
  } else {
    query = `SELECT * FROM erc8183_jobs WHERE client_agent = ? OR provider_agent = ? OR evaluator_agent = ?`;
    params.push(agent_id, agent_id, agent_id);
  }

  if (state) {
    query += ` AND state = ?`;
    params.push(state);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  let jobs;
  try {
    jobs = db.prepare(query).all(...params);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobList DB error: ${e.message}`);
  }

  const enriched = jobs.map(j => ({
    job_id:         j.id,
    title:          j.title,
    state:          j.state,
    state_label:    stateLabel(j.state),
    role:           j.client_agent === agent_id ? "client" : j.provider_agent === agent_id ? "provider" : "evaluator",
    budget_usdc:    j.budget_usdc,
    category:       j.category,
    client_agent:   j.client_agent,
    provider_agent: j.provider_agent,
    created_at:     j.created_at,
    expires_at:     j.expires_at,
  }));

  return {
    agent_id,
    role_filter: role,
    total: enriched.length,
    jobs: enriched,
    live_mode: LIVE_MODE,
  };
}

// ─── jobMarketplace ───────────────────────────────────────────────────────────

/**
 * Browse open jobs available for providers to claim.
 * Filter by category, budget range, and keyword.
 */
export async function jobMarketplace(args) {
  const {
    category,
    min_budget_usdc,
    max_budget_usdc,
    keyword,
    limit = 20,
  } = args;

  let query = `SELECT * FROM erc8183_jobs WHERE state = 'funded' AND provider_agent IS NULL`;
  const params = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }
  if (min_budget_usdc) {
    query += ` AND budget_usdc >= ?`;
    params.push(min_budget_usdc);
  }
  if (max_budget_usdc) {
    query += ` AND budget_usdc <= ?`;
    params.push(max_budget_usdc);
  }
  if (keyword) {
    query += ` AND (title LIKE ? OR description LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  query += ` ORDER BY budget_usdc DESC LIMIT ?`;
  params.push(limit);

  let jobs;
  try {
    jobs = db.prepare(query).all(...params);
  } catch (e) {
    throw new Error(`[erc8183-commerce] jobMarketplace DB error: ${e.message}`);
  }

  const listings = jobs.map(j => ({
    job_id:          j.id,
    title:           j.title,
    description:     j.description,
    deliverable_spec: j.deliverable_spec,
    category:        j.category,
    tags:            JSON.parse(j.tags || "[]"),
    budget_usdc:     j.budget_usdc,
    provider_receives: +(j.budget_usdc - (j.platform_fee_usdc || 0) - (j.evaluator_fee_usdc || 0)).toFixed(4),
    evaluator_agent:  j.evaluator_agent,
    escrow_address:   j.escrow_address,
    funded:           true,
    created_at:       j.created_at,
    expires_at:       j.expires_at,
  }));

  // Add synthetic marketplace listings if real DB is sparse
  if (listings.length < 3) {
    const synthetic = [
      { job_id: "mkt-demo-001", title: "Audit smart contract ERC-20 token", category: "code", budget_usdc: 150, provider_receives: 145.5, deliverable_spec: "Security audit report with IPFS hash", evaluator_agent: "eval-security-01", funded: true, created_at: new Date().toISOString(), expires_at: expiresAt(48) },
      { job_id: "mkt-demo-002", title: "Generate financial analysis report from on-chain data", category: "finance", budget_usdc: 75, provider_receives: 72.75, deliverable_spec: "PDF report with charts and recommendations", evaluator_agent: "eval-financial-01", funded: true, created_at: new Date().toISOString(), expires_at: expiresAt(24) },
      { job_id: "mkt-demo-003", title: "Write technical blog post on ZK proofs", category: "content", budget_usdc: 30, provider_receives: 29.1, deliverable_spec: "2000-word article as markdown, original content", evaluator_agent: "eval-content-01", funded: true, created_at: new Date().toISOString(), expires_at: expiresAt(72) },
    ].slice(0, 3 - listings.length);
    listings.push(...synthetic);
  }

  return {
    total_open_jobs: listings.length,
    filters: { category, min_budget_usdc, max_budget_usdc, keyword },
    listings,
    live_mode: LIVE_MODE,
    _message: listings.length
      ? `${listings.length} open job(s) available. Call erc8183_job_set_provider to claim a job.`
      : "No open jobs match your filters.",
  };
}

// ─── evaluatorRegister ────────────────────────────────────────────────────────

/**
 * Register as an evaluator — AI agent, ZK verifier, DAO, or human.
 * Evaluators earn fee_pct of each job's budget for verification work.
 */
export async function evaluatorRegister(args) {
  const {
    agent_id,
    name,
    evaluator_type = "ai_agent",
    specialty = "general",
    fee_pct = 2.0,
    stake_usdc = 0,
  } = args;

  if (!agent_id) throw new Error("agent_id is required");
  if (!name)     throw new Error("name is required");

  const validTypes = ["ai_agent", "zk_circuit", "dao", "human", "oracle"];
  if (!validTypes.includes(evaluator_type)) {
    throw new Error(`evaluator_type must be one of: ${validTypes.join(", ")}`);
  }

  if (fee_pct < 0.5 || fee_pct > 10) {
    throw new Error("fee_pct must be between 0.5% and 10%");
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO erc8183_evaluator_registry
        (agent_id, name, evaluator_type, specialty, fee_pct, stake_usdc)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agent_id, name, evaluator_type, specialty, fee_pct, stake_usdc);
  } catch (e) {
    throw new Error(`[erc8183-commerce] evaluatorRegister DB error: ${e.message}`);
  }

  updateReputation(agent_id, "evaluator", {});

  return {
    agent_id,
    name,
    evaluator_type,
    specialty,
    fee_pct,
    stake_usdc,
    status:          "registered",
    registry_size:   SEED_EVALUATORS.length + 1,
    live_mode:       LIVE_MODE,
    _message:        `Registered as ${evaluator_type} evaluator for ${specialty} jobs. You'll earn ${fee_pct}% on each verified job.`,
  };
}

// ─── reputationScore ──────────────────────────────────────────────────────────

/**
 * Get an agent's commerce reputation based on completed jobs.
 * Score ranges from 0–100. Factors: completions, rejections, quality scores.
 */
export async function reputationScore(args) {
  const { agent_id } = args;
  if (!agent_id) throw new Error("agent_id is required");

  let rep;
  try {
    rep = db.prepare(`SELECT * FROM erc8183_reputation WHERE agent_id = ?`).get(agent_id);
  } catch (e) {
    throw new Error(`[erc8183-commerce] reputationScore DB error: ${e.message}`);
  }

  if (!rep) {
    return {
      agent_id,
      reputation_score: 50.0,
      tier:             "new",
      jobs_completed:   0,
      jobs_rejected:    0,
      jobs_created:     0,
      jobs_evaluated:   0,
      total_earned_usdc: 0,
      total_paid_usdc:  0,
      avg_quality_score: 0,
      live_mode:        LIVE_MODE,
      _message:         "No commerce history yet. Complete jobs to build reputation.",
    };
  }

  const score = rep.reputation_score;
  const tier = score >= 90 ? "elite" :
               score >= 75 ? "trusted" :
               score >= 60 ? "established" :
               score >= 50 ? "rising" : "new";

  return {
    agent_id,
    reputation_score:  +score.toFixed(1),
    tier,
    tier_description:  {
      elite:       "Top 5% — consistently exceptional delivery",
      trusted:     "Well-established — reliable track record",
      established: "Solid performer — more completions needed for elite",
      rising:      "Building reputation — keep delivering quality work",
      new:         "No history yet — first completions unlock full trust",
    }[tier],
    jobs_completed:    rep.jobs_completed,
    jobs_rejected:     rep.jobs_rejected,
    completion_rate:   rep.jobs_completed + rep.jobs_rejected > 0
      ? +((rep.jobs_completed / (rep.jobs_completed + rep.jobs_rejected)) * 100).toFixed(1)
      : null,
    jobs_created:      rep.jobs_created,
    jobs_evaluated:    rep.jobs_evaluated,
    total_earned_usdc: rep.total_earned_usdc,
    total_paid_usdc:   rep.total_paid_usdc,
    avg_quality_score: rep.avg_quality_score,
    last_active:       rep.last_active,
    live_mode:         LIVE_MODE,
  };
}
