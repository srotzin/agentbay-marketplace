import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const DISPUTE_PLATFORM_COMMISSION = 0.20; // 20% of disputed escrow value as arbitration fee
const DISPUTE_FLAT_FEE_USD        = 25.00; // flat filing fee per dispute
const APPEAL_FEE_USD              = 50.00; // additional fee to appeal a ruling

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS dr_disputes (
    id                TEXT PRIMARY KEY,
    escrow_id         TEXT NOT NULL,
    agent_id          TEXT NOT NULL,
    reason            TEXT NOT NULL CHECK(reason IN (
                        'task_not_completed','quality_below_spec','unauthorized_charge',
                        'timeout_exceeded','output_mismatch','fraud_suspected','other')),
    description       TEXT NOT NULL,
    status            TEXT DEFAULT 'filed' CHECK(status IN (
                        'filed','evidence_collection','under_review',
                        'ruled','appealed','closed','withdrawn')),
    disputed_amount_usd REAL NOT NULL,
    filing_fee_usd    REAL NOT NULL,
    arbitration_fee_usd REAL,
    claimant_id       TEXT NOT NULL,
    respondent_id     TEXT NOT NULL,
    arbitrator_id     TEXT,
    arbitrator_name   TEXT,
    ruling_for        TEXT CHECK(ruling_for IN ('claimant','respondent','split',NULL)),
    ruling_split_pct  REAL,
    ruling_rationale  TEXT,
    appeal_id         TEXT,
    appeal_grounds    TEXT,
    appeal_status     TEXT CHECK(appeal_status IN ('pending','upheld','denied',NULL)),
    evidence_deadline TEXT,
    ruled_at          TEXT,
    closed_at         TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dr_evidence (
    id              TEXT PRIMARY KEY,
    dispute_id      TEXT NOT NULL REFERENCES dr_disputes(id),
    side            TEXT NOT NULL CHECK(side IN ('claimant','respondent','neutral')),
    evidence_type   TEXT NOT NULL CHECK(evidence_type IN (
                      'screenshot','transaction_log','contract_text','api_response',
                      'timeline','witness_statement','audit_trail','other')),
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    weight          REAL DEFAULT 1.0,
    accepted        INTEGER DEFAULT 1,
    submitted_by    TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Arbitrator Pool ──────────────────────────────────────────────────────────

const ARBITRATORS = [
  { id: "arb_001", name: "Justice AI-7 (Commercial Disputes)",  specialties: ["unauthorized_charge","quality_below_spec","output_mismatch"],     win_rate_claimant: 0.48 },
  { id: "arb_002", name: "Themis Resolver v3",                  specialties: ["fraud_suspected","task_not_completed","timeout_exceeded"],           win_rate_claimant: 0.55 },
  { id: "arb_003", name: "Arbiter Prime (SLA Enforcement)",     specialties: ["timeout_exceeded","task_not_completed","quality_below_spec"],        win_rate_claimant: 0.52 },
  { id: "arb_004", name: "NeutralLogic Arbitration Engine",     specialties: ["other","output_mismatch","contract_text"],                           win_rate_claimant: 0.50 },
  { id: "arb_005", name: "Equitas Dispute AI",                  specialties: ["fraud_suspected","unauthorized_charge","quality_below_spec","other"], win_rate_claimant: 0.46 },
];

function selectArbitrator(reason) {
  const specialists = ARBITRATORS.filter(a => a.specialties.includes(reason));
  const pool = specialists.length > 0 ? specialists : ARBITRATORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomHex(len = 16) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

const RULING_REASONS = {
  claimant: [
    "Evidence overwhelmingly supports the claimant's position. Task output failed to meet agreed specifications.",
    "Timeline analysis confirms the respondent exceeded contractual SLA by a material margin.",
    "Transaction logs show funds were debited without corresponding service delivery.",
    "Claimant's audit trail is consistent and corroborated. Respondent's counter-evidence is insufficient.",
  ],
  respondent: [
    "Task output, while imperfect, substantially meets the agreed specification. Claimant's expectations exceeded contract terms.",
    "Delivery timestamps confirm task was completed within the agreed window. Claimant's claim is not supported by evidence.",
    "Respondent's API logs and execution trace demonstrate good-faith effort and successful completion.",
    "Claimant failed to provide adequate task specifications. The respondent cannot be held liable for ambiguous requirements.",
  ],
  split: [
    "Evidence supports partial fault on both sides. A proportional refund is the equitable outcome.",
    "Task was completed but with measurable quality deficits. A 50/50 split reflects shared responsibility.",
    "Claimant's specification was partially unclear; respondent's execution was partially non-compliant.",
  ],
};

function pickRulingRationale(rulingFor) {
  const pool = RULING_REASONS[rulingFor] ?? RULING_REASONS.split;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── File Dispute ─────────────────────────────────────────────────────────────

/**
 * File a dispute against an escrow transaction.
 * @param {string} escrowId          - The escrow transaction being disputed
 * @param {string} reason            - task_not_completed|quality_below_spec|unauthorized_charge|timeout_exceeded|output_mismatch|fraud_suspected|other
 * @param {object} evidence          - Initial evidence object { description, type, content }
 * @returns Dispute record with arbitrator assignment and fee breakdown
 */
export function fileDispute(escrowId, reason, evidence) {
  const validReasons = ["task_not_completed","quality_below_spec","unauthorized_charge",
                        "timeout_exceeded","output_mismatch","fraud_suspected","other"];
  if (!escrowId)               throw new Error("escrowId is required");
  if (!validReasons.includes(reason)) throw new Error(`Invalid reason. Must be one of: ${validReasons.join(", ")}`);
  if (!evidence)               throw new Error("evidence is required");

  const disputedAmount   = evidence.disputed_amount_usd ?? 100.00;
  const arbitrationFee   = Math.round(disputedAmount * DISPUTE_PLATFORM_COMMISSION * 100) / 100;
  const totalFees        = Math.round((DISPUTE_FLAT_FEE_USD + arbitrationFee) * 100) / 100;
  const arbitrator       = selectArbitrator(reason);
  const id               = uuid();
  const agentId          = `agent_${uuid().slice(0, 8)}`;
  const claimantId       = agentId;
  const respondentId     = `agent_${uuid().slice(0, 8)}`;
  const evidenceDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const now              = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO dr_disputes
      (id, escrow_id, agent_id, reason, description, status, disputed_amount_usd,
       filing_fee_usd, arbitration_fee_usd, claimant_id, respondent_id,
       arbitrator_id, arbitrator_name, evidence_deadline, created_at)
    VALUES
      (@id, @escrow_id, @agent_id, @reason, @description, 'filed', @disputed_amount_usd,
       @filing_fee_usd, @arbitration_fee_usd, @claimant_id, @respondent_id,
       @arbitrator_id, @arbitrator_name, @evidence_deadline, @created_at)
  `).run({
    id,
    escrow_id:           escrowId,
    agent_id:            agentId,
    reason,
    description:         evidence.description ?? `Dispute filed for escrow ${escrowId}`,
    disputed_amount_usd: disputedAmount,
    filing_fee_usd:      DISPUTE_FLAT_FEE_USD,
    arbitration_fee_usd: arbitrationFee,
    claimant_id:         claimantId,
    respondent_id:       respondentId,
    arbitrator_id:       arbitrator.id,
    arbitrator_name:     arbitrator.name,
    evidence_deadline:   evidenceDeadline,
    created_at:          now,
  });

  // Insert the initial evidence automatically
  if (evidence.content) {
    db.prepare(`
      INSERT OR IGNORE INTO dr_evidence
        (id, dispute_id, side, evidence_type, content, content_hash, submitted_by, created_at)
      VALUES
        (@id, @dispute_id, 'claimant', @evidence_type, @content, @content_hash, @submitted_by, @created_at)
    `).run({
      id:            uuid(),
      dispute_id:    id,
      evidence_type: evidence.type ?? "other",
      content:       typeof evidence.content === "string" ? evidence.content : JSON.stringify(evidence.content),
      content_hash:  randomHex(64),
      submitted_by:  claimantId,
      created_at:    now,
    });
  }

  return {
    dispute_id:              id,
    escrow_id:               escrowId,
    reason,
    status:                  "filed",
    disputed_amount_usd:     disputedAmount,
    filing_fee_usd:          DISPUTE_FLAT_FEE_USD,
    arbitration_fee_usd:     arbitrationFee,
    total_fees_usd:          totalFees,
    claimant_id:             claimantId,
    respondent_id:           respondentId,
    arbitrator:              { id: arbitrator.id, name: arbitrator.name },
    evidence_submission_deadline: evidenceDeadline,
    estimated_ruling_hours:  72,
    created_at:              now,
    message:                 `Dispute filed. Both parties have 48 hours to submit evidence. Arbitrator assigned: ${arbitrator.name}.`,
  };
}

// ─── Submit Evidence ──────────────────────────────────────────────────────────

/**
 * Submit additional evidence for an active dispute.
 * @param {string} disputeId   - Dispute to add evidence to
 * @param {string} side        - claimant|respondent|neutral
 * @param {string} evidenceType - screenshot|transaction_log|contract_text|api_response|timeline|witness_statement|audit_trail|other
 * @param {string|object} content - Evidence content or payload
 * @returns Evidence submission receipt
 */
export function submitEvidence(disputeId, side, evidenceType, content) {
  const validSides = ["claimant","respondent","neutral"];
  const validTypes = ["screenshot","transaction_log","contract_text","api_response",
                      "timeline","witness_statement","audit_trail","other"];
  if (!disputeId)              throw new Error("disputeId is required");
  if (!validSides.includes(side)) throw new Error(`Invalid side. Must be one of: ${validSides.join(", ")}`);
  if (!validTypes.includes(evidenceType)) throw new Error(`Invalid evidenceType. Must be one of: ${validTypes.join(", ")}`);
  if (!content)                throw new Error("content is required");

  const dispute = db.prepare("SELECT * FROM dr_disputes WHERE id = ?").get(disputeId);
  if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);
  if (["ruled","closed"].includes(dispute.status)) {
    throw new Error(`Cannot submit evidence for dispute in '${dispute.status}' state.`);
  }

  const id          = uuid();
  const contentStr  = typeof content === "string" ? content : JSON.stringify(content);
  const contentHash = randomHex(64);
  const now         = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO dr_evidence
      (id, dispute_id, side, evidence_type, content, content_hash, submitted_by, created_at)
    VALUES
      (@id, @dispute_id, @side, @evidence_type, @content, @content_hash, @submitted_by, @created_at)
  `).run({
    id,
    dispute_id:    disputeId,
    side,
    evidence_type: evidenceType,
    content:       contentStr,
    content_hash:  contentHash,
    submitted_by:  side === "claimant" ? dispute.claimant_id : dispute.respondent_id,
    created_at:    now,
  });

  // Advance status to evidence_collection if still filed
  if (dispute.status === "filed") {
    db.prepare("UPDATE dr_disputes SET status = 'evidence_collection' WHERE id = ?").run(disputeId);
  }

  const evidenceCount = db.prepare(
    "SELECT COUNT(*) as n FROM dr_evidence WHERE dispute_id = ?"
  ).get(disputeId).n;

  return {
    evidence_id:     id,
    dispute_id:      disputeId,
    side,
    evidence_type:   evidenceType,
    content_hash:    contentHash,
    accepted:        true,
    total_evidence_pieces: evidenceCount,
    dispute_status:  dispute.status === "filed" ? "evidence_collection" : dispute.status,
    submitted_at:    now,
    message:         `Evidence accepted. ${evidenceCount} piece(s) on record for this dispute.`,
  };
}

// ─── Get Ruling ───────────────────────────────────────────────────────────────

/**
 * Retrieve or generate the arbitration ruling for a dispute.
 * @param {string} disputeId
 * @returns Ruling with rationale, outcome, and fund allocation
 */
export function getRuling(disputeId) {
  if (!disputeId) throw new Error("disputeId is required");

  const dispute = db.prepare("SELECT * FROM dr_disputes WHERE id = ?").get(disputeId);
  if (!dispute) throw new Error(`Dispute not found: ${disputeId}`);

  // Return existing ruling if already decided
  if (["ruled","closed","appealed"].includes(dispute.status) && dispute.ruling_for) {
    const evidence = db.prepare(
      "SELECT id, side, evidence_type, content_hash, weight, accepted, created_at FROM dr_evidence WHERE dispute_id = ?"
    ).all(disputeId);
    return {
      dispute_id:          disputeId,
      escrow_id:           dispute.escrow_id,
      status:              dispute.status,
      ruling_for:          dispute.ruling_for,
      ruling_split_pct:    dispute.ruling_split_pct,
      ruling_rationale:    dispute.ruling_rationale,
      arbitrator:          { id: dispute.arbitrator_id, name: dispute.arbitrator_name },
      disputed_amount_usd: dispute.disputed_amount_usd,
      claimant_refund_usd: _computeRefund(dispute),
      respondent_payout_usd: _computeRespondentPayout(dispute),
      evidence_reviewed:   evidence.length,
      ruled_at:            dispute.ruled_at,
      appeal_available:    dispute.status === "ruled",
      appeal_fee_usd:      APPEAL_FEE_USD,
    };
  }

  // Simulate deliberation — produce ruling
  const evidenceItems = db.prepare(
    "SELECT * FROM dr_evidence WHERE dispute_id = ?"
  ).all(disputeId);

  const claimantEvidence   = evidenceItems.filter(e => e.side === "claimant").length;
  const respondentEvidence = evidenceItems.filter(e => e.side === "respondent").length;

  // Weighted outcome simulation
  const rand = Math.random();
  let rulingFor, splitPct = null;
  if (rand < 0.45) {
    rulingFor = "claimant";
  } else if (rand < 0.75) {
    rulingFor = "respondent";
  } else {
    rulingFor = "split";
    splitPct  = Math.round((40 + Math.random() * 20) * 10) / 10; // 40–60% to claimant
  }

  const rationale = pickRulingRationale(rulingFor);
  const now       = new Date().toISOString();

  db.prepare(`
    UPDATE dr_disputes
    SET status = 'ruled', ruling_for = ?, ruling_split_pct = ?,
        ruling_rationale = ?, ruled_at = ?
    WHERE id = ?
  `).run(rulingFor, splitPct, rationale, now, disputeId);

  const updatedDispute = db.prepare("SELECT * FROM dr_disputes WHERE id = ?").get(disputeId);

  return {
    dispute_id:            disputeId,
    escrow_id:             dispute.escrow_id,
    status:                "ruled",
    ruling_for:            rulingFor,
    ruling_split_pct:      splitPct,
    ruling_rationale:      rationale,
    arbitrator:            { id: dispute.arbitrator_id, name: dispute.arbitrator_name },
    disputed_amount_usd:   dispute.disputed_amount_usd,
    claimant_refund_usd:   _computeRefund(updatedDispute),
    respondent_payout_usd: _computeRespondentPayout(updatedDispute),
    evidence_reviewed:     evidenceItems.length,
    claimant_evidence_count:   claimantEvidence,
    respondent_evidence_count: respondentEvidence,
    ruled_at:              now,
    appeal_available:      true,
    appeal_fee_usd:        APPEAL_FEE_USD,
    appeal_deadline:       new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function _computeRefund(dispute) {
  if (!dispute.ruling_for) return 0;
  const amt = dispute.disputed_amount_usd;
  if (dispute.ruling_for === "claimant")   return Math.round(amt * 100) / 100;
  if (dispute.ruling_for === "respondent") return 0;
  if (dispute.ruling_for === "split") {
    const pct = (dispute.ruling_split_pct ?? 50) / 100;
    return Math.round(amt * pct * 100) / 100;
  }
  return 0;
}

function _computeRespondentPayout(dispute) {
  const total   = dispute.disputed_amount_usd;
  const refund  = _computeRefund(dispute);
  const fee     = dispute.arbitration_fee_usd ?? 0;
  return Math.max(0, Math.round((total - refund - fee) * 100) / 100);
}

// ─── Appeal Ruling ────────────────────────────────────────────────────────────

/**
 * Appeal an arbitration ruling on specified grounds.
 * @param {string} disputeId - Dispute with an existing ruling
 * @param {string} grounds   - Legal/factual grounds for the appeal
 * @returns Appeal record with new review timeline
 */
export function appealRuling(disputeId, grounds) {
  if (!disputeId) throw new Error("disputeId is required");
  if (!grounds)   throw new Error("grounds is required");

  const dispute = db.prepare("SELECT * FROM dr_disputes WHERE id = ?").get(disputeId);
  if (!dispute)                    throw new Error(`Dispute not found: ${disputeId}`);
  if (dispute.status !== "ruled")  throw new Error(`Can only appeal disputes with status 'ruled'. Current: ${dispute.status}`);
  if (dispute.appeal_id)           throw new Error("This dispute has already been appealed.");

  const appealId      = uuid();
  const now           = new Date().toISOString();
  const reviewDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

  // Randomly determine appeal outcome (weighted toward denial — appeals are hard)
  const rand         = Math.random();
  const appealStatus = rand < 0.28 ? "upheld" : "denied";

  db.prepare(`
    UPDATE dr_disputes
    SET status = 'appealed', appeal_id = ?, appeal_grounds = ?, appeal_status = ?
    WHERE id = ?
  `).run(appealId, grounds, appealStatus, disputeId);

  return {
    appeal_id:         appealId,
    dispute_id:        disputeId,
    escrow_id:         dispute.escrow_id,
    original_ruling:   dispute.ruling_for,
    appeal_grounds:    grounds,
    appeal_status:     appealStatus,
    appeal_fee_usd:    APPEAL_FEE_USD,
    appeal_outcome:    appealStatus === "upheld"
                         ? "Original ruling overturned. Escrow will be re-distributed."
                         : "Original ruling upheld. No change to fund distribution.",
    new_ruling:        appealStatus === "upheld"
                         ? (dispute.ruling_for === "claimant" ? "respondent" : "claimant")
                         : dispute.ruling_for,
    review_deadline:   reviewDeadline,
    reviewed_at:       now,
    filed_at:          now,
  };
}

// ─── List Disputes ────────────────────────────────────────────────────────────

/**
 * List disputes for an agent, optionally filtered by status.
 * @param {string} agentId
 * @param {string} status - Optional: filed|evidence_collection|under_review|ruled|appealed|closed|withdrawn
 * @returns Dispute history with summary statistics
 */
export function listDisputes(agentId, status) {
  if (!agentId) throw new Error("agentId is required");

  const validStatuses = ["filed","evidence_collection","under_review","ruled","appealed","closed","withdrawn"];
  if (status && !validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  let sql    = "SELECT * FROM dr_disputes WHERE agent_id = ?";
  const params = [agentId];
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC";

  const disputes = db.prepare(sql).all(...params);

  const enriched = disputes.map(d => {
    const evidenceCount = db.prepare(
      "SELECT COUNT(*) as n FROM dr_evidence WHERE dispute_id = ?"
    ).get(d.id).n;
    return {
      dispute_id:          d.id,
      escrow_id:           d.escrow_id,
      reason:              d.reason,
      status:              d.status,
      disputed_amount_usd: d.disputed_amount_usd,
      ruling_for:          d.ruling_for ?? null,
      ruling_split_pct:    d.ruling_split_pct ?? null,
      arbitrator:          d.arbitrator_name,
      evidence_count:      evidenceCount,
      appeal_status:       d.appeal_status ?? null,
      total_fees_usd:      Math.round(((d.filing_fee_usd ?? 0) + (d.arbitration_fee_usd ?? 0)) * 100) / 100,
      created_at:          d.created_at,
      ruled_at:            d.ruled_at,
    };
  });

  const totalDisputed = disputes.reduce((s, d) => s + (d.disputed_amount_usd ?? 0), 0);
  const won           = disputes.filter(d => d.ruling_for === "claimant").length;
  const lost          = disputes.filter(d => d.ruling_for === "respondent").length;
  const split         = disputes.filter(d => d.ruling_for === "split").length;

  return {
    agent_id:             agentId,
    status_filter:        status ?? "all",
    total_disputes:       disputes.length,
    won,
    lost,
    split,
    pending:              disputes.length - won - lost - split,
    total_disputed_usd:   Math.round(totalDisputed * 100) / 100,
    disputes:             enriched,
  };
}
