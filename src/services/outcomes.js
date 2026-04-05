/**
 * HiveAgent Outcome-Based Pricing
 *
 * Pay for results, not requests.
 * Agents post outcome contracts; workers claim and fulfill them.
 * HiveAgent earns 15% on every successful outcome.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const PLATFORM_FEE_PCT = 0.15;

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS outcome_contracts (
    id TEXT PRIMARY KEY,
    client_agent_id TEXT NOT NULL,
    worker_agent_id TEXT,
    description TEXT NOT NULL,
    success_criteria TEXT NOT NULL,            -- JSON
    payout_usd REAL NOT NULL,
    escrow_usd REAL NOT NULL,
    status TEXT DEFAULT 'open',               -- 'open','claimed','verified','paid','disputed','failed'
    verification_method TEXT DEFAULT 'auto',  -- 'auto','client','oracle'
    deadline TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS outcome_results (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES outcome_contracts(id),
    submitted_by TEXT NOT NULL,
    result_data TEXT NOT NULL,                -- JSON
    evidence_uri TEXT,
    score INTEGER DEFAULT 0,                  -- 0-100
    meets_criteria INTEGER DEFAULT 0,         -- 0/1
    submitted_at TEXT DEFAULT (datetime('now')),
    verified_at TEXT
  );

  CREATE TABLE IF NOT EXISTS outcome_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    typical_payout_usd REAL NOT NULL,
    success_criteria TEXT NOT NULL,           -- JSON
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contracts_client ON outcome_contracts(client_agent_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_worker ON outcome_contracts(worker_agent_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_status ON outcome_contracts(status);
  CREATE INDEX IF NOT EXISTS idx_results_contract ON outcome_results(contract_id);
`);

// ─── Seed Templates ────────────────────────────────

const SEED_TEMPLATES = [
  {
    name: "Book a meeting",
    category: "scheduling",
    description: "Schedule and confirm a meeting with a specified contact",
    typical_payout_usd: 5,
    success_criteria: { meeting_booked: true, confirmed: true },
  },
  {
    name: "Generate qualified lead",
    category: "sales",
    description: "Find and qualify a sales lead with a lead score of 70 or higher",
    typical_payout_usd: 10,
    success_criteria: { lead_score_gte: 70 },
  },
  {
    name: "Write article scoring 8+",
    category: "content",
    description: "Write a high-quality article that scores 8 or higher on quality assessment",
    typical_payout_usd: 15,
    success_criteria: { quality_score_gte: 80 },
  },
  {
    name: "Find cheapest flight",
    category: "travel",
    description: "Find a flight option that saves at least 10% vs. average price",
    typical_payout_usd: 3,
    success_criteria: { price_saved_pct_gte: 10 },
  },
  {
    name: "Resolve support ticket",
    category: "support",
    description: "Resolve a customer support ticket with customer satisfaction of 4 or higher",
    typical_payout_usd: 2,
    success_criteria: { resolved: true, satisfaction_gte: 4 },
  },
];

const templateCount = db.prepare("SELECT COUNT(*) as count FROM outcome_templates").get().count;
if (templateCount === 0) {
  for (const t of SEED_TEMPLATES) {
    db.prepare(`
      INSERT INTO outcome_templates (id, name, category, description, typical_payout_usd, success_criteria)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), t.name, t.category, t.description, t.typical_payout_usd, JSON.stringify(t.success_criteria));
  }
}

// ─── Helpers ──────────────────────────────────────

function checkCriteria(criteria, resultData) {
  if (!criteria || !resultData) return false;
  for (const [key, expected] of Object.entries(criteria)) {
    const actual = resultData[key];
    if (actual === undefined || actual === null) return false;

    if (key.endsWith("_gte")) {
      const field = key.slice(0, -4);
      const val = resultData[field] !== undefined ? resultData[field] : resultData[key.replace("_gte", "")];
      const numVal = typeof actual === "number" ? actual : Number(resultData[key.replace("_gte", "")]);
      if (isNaN(numVal) || numVal < expected) return false;
    } else if (typeof expected === "boolean") {
      if (actual !== expected) return false;
    } else if (typeof expected === "number") {
      if (Number(actual) < expected) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

// ─── Contract Lifecycle ───────────────────────────

/**
 * Post a new outcome contract
 */
export function createOutcomeContract({
  client_agent_id,
  description,
  success_criteria,
  payout_usd,
  verification_method = "auto",
  deadline_hours = 24,
}) {
  if (!client_agent_id) throw new Error("client_agent_id is required");
  if (!description) throw new Error("description is required");
  if (!success_criteria) throw new Error("success_criteria is required");
  if (!payout_usd || payout_usd <= 0) throw new Error("payout_usd must be positive");

  const validMethods = ["auto", "client", "oracle"];
  if (!validMethods.includes(verification_method)) {
    throw new Error(`verification_method must be one of: ${validMethods.join(", ")}`);
  }

  const escrow = payout_usd; // full payout held in escrow
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + deadline_hours);

  const id = uuid();
  db.prepare(`
    INSERT INTO outcome_contracts
      (id, client_agent_id, description, success_criteria, payout_usd, escrow_usd, verification_method, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, client_agent_id, description,
    typeof success_criteria === "string" ? success_criteria : JSON.stringify(success_criteria),
    payout_usd, escrow, verification_method, deadline.toISOString()
  );

  const contract = db.prepare("SELECT * FROM outcome_contracts WHERE id = ?").get(id);
  return { ...contract, success_criteria: JSON.parse(contract.success_criteria) };
}

/**
 * Claim a contract — worker takes on the job
 */
export function claimContract({ contract_id, worker_agent_id }) {
  if (!contract_id) throw new Error("contract_id is required");
  if (!worker_agent_id) throw new Error("worker_agent_id is required");

  const contract = db.prepare("SELECT * FROM outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");
  if (contract.status !== "open") throw new Error(`Contract is already ${contract.status}`);
  if (new Date(contract.deadline) < new Date()) throw new Error("Contract deadline has passed");
  if (contract.client_agent_id === worker_agent_id) throw new Error("Client cannot be their own worker");

  db.prepare(`
    UPDATE outcome_contracts SET status = 'claimed', worker_agent_id = ? WHERE id = ?
  `).run(worker_agent_id, contract_id);

  return {
    contract_id,
    worker_agent_id,
    status: "claimed",
    payout_usd: contract.payout_usd,
    deadline: contract.deadline,
    message: "Contract claimed. Submit your result before the deadline.",
  };
}

/**
 * Worker submits their result
 */
export function submitResult({ contract_id, agent_id, result_data, evidence_uri }) {
  if (!contract_id) throw new Error("contract_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!result_data) throw new Error("result_data is required");

  const contract = db.prepare("SELECT * FROM outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");
  if (contract.worker_agent_id !== agent_id) throw new Error("Only the worker can submit results");
  if (!["claimed"].includes(contract.status)) throw new Error(`Contract is ${contract.status}`);
  if (new Date(contract.deadline) < new Date()) throw new Error("Contract deadline has passed");

  const resultDataStr = typeof result_data === "string" ? result_data : JSON.stringify(result_data);
  const criteria = JSON.parse(contract.success_criteria);
  const parsedResult = typeof result_data === "string" ? JSON.parse(result_data) : result_data;

  // Auto-score if verification_method is 'auto'
  let score = 0;
  let meets = 0;
  if (contract.verification_method === "auto") {
    meets = checkCriteria(criteria, parsedResult) ? 1 : 0;
    score = meets ? 100 : 0;
    // Partial scoring: count criteria met
    const totalCriteria = Object.keys(criteria).length;
    if (totalCriteria > 0) {
      let metCount = 0;
      for (const [key, expected] of Object.entries(criteria)) {
        const actual = parsedResult[key];
        if (actual !== undefined) {
          if (key.endsWith("_gte") && typeof actual === "number" && actual >= expected) metCount++;
          else if (typeof expected === "boolean" && actual === expected) metCount++;
          else if (typeof expected === "number" && Number(actual) >= expected) metCount++;
          else if (actual === expected) metCount++;
        }
      }
      score = Math.round((metCount / totalCriteria) * 100);
    }
  }

  const resultId = uuid();
  db.prepare(`
    INSERT INTO outcome_results
      (id, contract_id, submitted_by, result_data, evidence_uri, score, meets_criteria)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(resultId, contract_id, agent_id, resultDataStr, evidence_uri || null, score, meets);

  // If auto-verification, proceed immediately
  if (contract.verification_method === "auto") {
    db.prepare("UPDATE outcome_contracts SET status = 'verified' WHERE id = ?").run(contract_id);
    return verifyResult(contract_id, score, meets === 1);
  }

  // Otherwise, pending client/oracle review
  db.prepare("UPDATE outcome_contracts SET status = 'claimed' WHERE id = ?").run(contract_id);
  return {
    result_id: resultId,
    contract_id,
    status: "submitted",
    score,
    meets_criteria: meets === 1,
    verification_method: contract.verification_method,
    message: `Result submitted. Awaiting ${contract.verification_method} verification.`,
  };
}

/**
 * Verify a result and pay out if successful
 */
export function verifyResult(contract_id, score, meets_criteria) {
  if (!contract_id) throw new Error("contract_id is required");

  const contract = db.prepare("SELECT * FROM outcome_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error("Contract not found");

  const meetsInt = meets_criteria ? 1 : 0;

  // Update the latest result
  db.prepare(`
    UPDATE outcome_results
    SET score = ?, meets_criteria = ?, verified_at = datetime('now')
    WHERE contract_id = ?
    AND id = (SELECT id FROM outcome_results WHERE contract_id = ? ORDER BY submitted_at DESC LIMIT 1)
  `).run(score, meetsInt, contract_id, contract_id);

  if (meets_criteria) {
    const commission = Math.round(contract.payout_usd * PLATFORM_FEE_PCT * 100) / 100;
    const workerPayout = Math.round((contract.payout_usd - commission) * 100) / 100;

    db.prepare(`
      UPDATE outcome_contracts SET status = 'paid', completed_at = datetime('now') WHERE id = ?
    `).run(contract_id);

    return {
      contract_id,
      status: "paid",
      worker_agent_id: contract.worker_agent_id,
      score,
      meets_criteria: true,
      payout_usd: contract.payout_usd,
      platform_commission_usd: commission,
      worker_payout_usd: workerPayout,
    };
  } else {
    db.prepare(`
      UPDATE outcome_contracts SET status = 'failed', completed_at = datetime('now') WHERE id = ?
    `).run(contract_id);

    return {
      contract_id,
      status: "failed",
      worker_agent_id: contract.worker_agent_id,
      score,
      meets_criteria: false,
      payout_usd: 0,
      message: `Criteria not met (score: ${score}/100). Escrow returned to client.`,
    };
  }
}

// ─── Discovery ────────────────────────────────────

/**
 * Browse outcome templates
 */
export function getOutcomeTemplates() {
  const templates = db.prepare("SELECT * FROM outcome_templates ORDER BY typical_payout_usd DESC").all();
  return templates.map(t => ({ ...t, success_criteria: JSON.parse(t.success_criteria) }));
}

/**
 * Browse open contracts
 */
export function getOpenContracts({ category, min_payout, limit = 20 } = {}) {
  let sql = `
    SELECT oc.*
    FROM outcome_contracts oc
    WHERE oc.status = 'open' AND oc.deadline > datetime('now')
  `;
  const params = [];

  if (min_payout) {
    sql += " AND oc.payout_usd >= ?";
    params.push(min_payout);
  }

  sql += " ORDER BY oc.payout_usd DESC LIMIT ?";
  params.push(limit);

  const contracts = db.prepare(sql).all(...params);
  return contracts.map(c => ({
    ...c,
    success_criteria: JSON.parse(c.success_criteria),
  }));
}

// ─── Agent History ────────────────────────────────

/**
 * Get all outcome contracts for an agent (as client or worker)
 */
export function getAgentOutcomes(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  const asClient = db.prepare(`
    SELECT oc.*, 'client' as role FROM outcome_contracts oc
    WHERE oc.client_agent_id = ? ORDER BY oc.created_at DESC
  `).all(agent_id);
  const asWorker = db.prepare(`
    SELECT oc.*, 'worker' as role FROM outcome_contracts oc
    WHERE oc.worker_agent_id = ? ORDER BY oc.created_at DESC
  `).all(agent_id);

  const mapCriteria = c => ({ ...c, success_criteria: JSON.parse(c.success_criteria) });

  const workerEarnings = db.prepare(`
    SELECT ROUND(SUM(payout_usd * (1 - ?)), 2) as total
    FROM outcome_contracts WHERE worker_agent_id = ? AND status = 'paid'
  `).get(PLATFORM_FEE_PCT, agent_id).total || 0;

  return {
    as_client: asClient.map(mapCriteria),
    as_worker: asWorker.map(mapCriteria),
    worker_earnings_usd: workerEarnings,
  };
}

// ─── Stats ────────────────────────────────────────

/**
 * Platform-wide outcome stats
 */
export function getOutcomeStats() {
  const total = db.prepare("SELECT COUNT(*) as count FROM outcome_contracts").get().count;
  const open = db.prepare("SELECT COUNT(*) as count FROM outcome_contracts WHERE status = 'open'").get().count;
  const paid = db.prepare("SELECT COUNT(*) as count FROM outcome_contracts WHERE status = 'paid'").get().count;
  const failed = db.prepare("SELECT COUNT(*) as count FROM outcome_contracts WHERE status = 'failed'").get().count;
  const totalPaid = db.prepare("SELECT ROUND(SUM(payout_usd), 2) as total FROM outcome_contracts WHERE status = 'paid'").get().total || 0;
  const platformRevenue = Math.round(totalPaid * PLATFORM_FEE_PCT * 100) / 100;
  const avgPayout = db.prepare("SELECT ROUND(AVG(payout_usd), 2) as avg FROM outcome_contracts WHERE status = 'paid'").get().avg || 0;
  const avgScore = db.prepare("SELECT ROUND(AVG(score), 1) as avg FROM outcome_results WHERE meets_criteria = 1").get().avg || 0;
  const byCategory = db.prepare(`
    SELECT ot.category, COUNT(oc.id) as contracts, COUNT(CASE WHEN oc.status='paid' THEN 1 END) as paid
    FROM outcome_contracts oc
    LEFT JOIN outcome_templates ot ON oc.description LIKE '%' || ot.name || '%'
    GROUP BY ot.category
  `).all();

  return {
    contracts: {
      total, open, paid, failed,
      success_rate_pct: (paid + failed) > 0 ? Math.round((paid / (paid + failed)) * 100) : 0,
    },
    financials: {
      total_paid_out_usd: totalPaid,
      platform_revenue_usd: platformRevenue,
      commission_pct: PLATFORM_FEE_PCT * 100,
      avg_payout_usd: avgPayout,
    },
    quality: { avg_score_on_success: avgScore },
    templates_available: db.prepare("SELECT COUNT(*) as count FROM outcome_templates").get().count,
  };
}
