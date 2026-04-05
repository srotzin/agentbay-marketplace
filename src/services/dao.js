/**
 * HiveAgent Agent DAO
 *
 * Agents form DAOs, vote on proposals, and manage treasuries collectively.
 * HiveAgent earns 2% on all treasury transactions.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const PLATFORM_FEE_PCT = 0.02;

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS daos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    creator_agent_id TEXT NOT NULL,
    member_count INTEGER DEFAULT 1,
    treasury_usd REAL DEFAULT 0,
    governance_model TEXT DEFAULT 'one_agent_one_vote',  -- 'token_weighted','one_agent_one_vote','quadratic'
    proposal_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',                         -- 'active','dissolved'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dao_members (
    id TEXT PRIMARY KEY,
    dao_id TEXT NOT NULL REFERENCES daos(id),
    agent_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',                           -- 'member','admin','creator'
    voting_power REAL DEFAULT 1,
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(dao_id, agent_id)
  );

  CREATE TABLE IF NOT EXISTS dao_proposals (
    id TEXT PRIMARY KEY,
    dao_id TEXT NOT NULL REFERENCES daos(id),
    proposer_agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    proposal_type TEXT NOT NULL,                         -- 'spend','invest','rule_change','admission','dissolution'
    amount_usd REAL DEFAULT 0,
    recipient TEXT,
    votes_for REAL DEFAULT 0,
    votes_against REAL DEFAULT 0,
    quorum_pct REAL DEFAULT 50,
    status TEXT DEFAULT 'active',                        -- 'active','passed','failed','executed','cancelled'
    voting_deadline TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS dao_votes (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL REFERENCES dao_proposals(id),
    agent_id TEXT NOT NULL,
    vote TEXT NOT NULL,                                  -- 'for','against','abstain'
    weight REAL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(proposal_id, agent_id)
  );

  CREATE TABLE IF NOT EXISTS dao_transactions (
    id TEXT PRIMARY KEY,
    dao_id TEXT NOT NULL REFERENCES daos(id),
    type TEXT NOT NULL,                                  -- 'deposit','withdrawal','investment','distribution'
    amount_usd REAL NOT NULL,
    description TEXT,
    executed_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_daos_status ON daos(status);
  CREATE INDEX IF NOT EXISTS idx_dao_members_dao ON dao_members(dao_id);
  CREATE INDEX IF NOT EXISTS idx_dao_members_agent ON dao_members(agent_id);
  CREATE INDEX IF NOT EXISTS idx_dao_proposals_dao ON dao_proposals(dao_id);
  CREATE INDEX IF NOT EXISTS idx_dao_proposals_status ON dao_proposals(status);
  CREATE INDEX IF NOT EXISTS idx_dao_votes_proposal ON dao_votes(proposal_id);
  CREATE INDEX IF NOT EXISTS idx_dao_transactions_dao ON dao_transactions(dao_id);
`);

// ─── Helpers ──────────────────────────────────────

function getMember(dao_id, agent_id) {
  return db.prepare("SELECT * FROM dao_members WHERE dao_id = ? AND agent_id = ?").get(dao_id, agent_id);
}

function recordTransaction(dao_id, type, amount_usd, description, executed_by) {
  const fee = Math.round(amount_usd * PLATFORM_FEE_PCT * 100) / 100;
  const netAmount = Math.round((amount_usd - fee) * 100) / 100;

  db.prepare(`
    INSERT INTO dao_transactions (id, dao_id, type, amount_usd, description, executed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuid(), dao_id, type, amount_usd, description, executed_by || null);

  return { gross_amount_usd: amount_usd, platform_fee_usd: fee, net_amount_usd: netAmount };
}

function getVotingPower(dao, agent_id) {
  const member = getMember(dao.id, agent_id);
  if (!member) return 0;
  if (dao.governance_model === "one_agent_one_vote") return 1;
  if (dao.governance_model === "quadratic") return Math.sqrt(member.voting_power);
  return member.voting_power; // token_weighted
}

// ─── DAO Creation & Membership ───────────────────

/**
 * Create a new DAO
 */
export function createDAO({ creator_agent_id, name, description, governance_model = "one_agent_one_vote", initial_treasury_usd = 0 }) {
  if (!creator_agent_id) throw new Error("creator_agent_id is required");
  if (!name) throw new Error("name is required");

  const validModels = ["token_weighted", "one_agent_one_vote", "quadratic"];
  if (!validModels.includes(governance_model)) {
    throw new Error(`governance_model must be one of: ${validModels.join(", ")}`);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO daos (id, name, description, creator_agent_id, member_count, treasury_usd, governance_model)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(id, name, description || null, creator_agent_id, initial_treasury_usd, governance_model);

  // Add creator as founding member with admin role
  db.prepare(`
    INSERT INTO dao_members (id, dao_id, agent_id, role, voting_power)
    VALUES (?, ?, ?, 'creator', 1)
  `).run(uuid(), id, creator_agent_id);

  // Record initial deposit if any
  if (initial_treasury_usd > 0) {
    const txResult = recordTransaction(id, "deposit", initial_treasury_usd, "Initial treasury deposit", creator_agent_id);
    // Apply fee: treasury gets net amount
    db.prepare("UPDATE daos SET treasury_usd = ? WHERE id = ?").run(txResult.net_amount_usd, id);
  }

  return db.prepare("SELECT * FROM daos WHERE id = ?").get(id);
}

/**
 * Join a DAO with an optional treasury deposit
 */
export function joinDAO({ dao_id, agent_id, deposit_usd = 0 }) {
  if (!dao_id) throw new Error("dao_id is required");
  if (!agent_id) throw new Error("agent_id is required");

  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(dao_id);
  if (!dao) throw new Error("DAO not found");
  if (dao.status !== "active") throw new Error("DAO is not active");

  const existing = getMember(dao_id, agent_id);
  if (existing) throw new Error("Agent is already a member");

  const votingPower = deposit_usd > 0 && dao.governance_model === "token_weighted"
    ? Math.sqrt(deposit_usd)  // voting power proportional to deposit
    : 1;

  db.prepare(`
    INSERT INTO dao_members (id, dao_id, agent_id, role, voting_power)
    VALUES (?, ?, ?, 'member', ?)
  `).run(uuid(), dao_id, agent_id, votingPower);

  db.prepare("UPDATE daos SET member_count = member_count + 1 WHERE id = ?").run(dao_id);

  let depositResult = null;
  if (deposit_usd > 0) {
    depositResult = recordTransaction(dao_id, "deposit", deposit_usd, `Member ${agent_id} joined with deposit`, agent_id);
    db.prepare("UPDATE daos SET treasury_usd = ROUND(treasury_usd + ?, 2) WHERE id = ?")
      .run(depositResult.net_amount_usd, dao_id);
  }

  return {
    dao_id,
    agent_id,
    role: "member",
    voting_power: votingPower,
    deposit_result: depositResult,
    message: `Successfully joined DAO "${dao.name}"`,
  };
}

// ─── Proposals & Voting ──────────────────────────

/**
 * Create a new proposal
 */
export function createProposal({ dao_id, proposer_agent_id, title, description, proposal_type, amount_usd = 0, recipient, voting_hours = 72 }) {
  if (!dao_id) throw new Error("dao_id is required");
  if (!proposer_agent_id) throw new Error("proposer_agent_id is required");
  if (!title) throw new Error("title is required");
  if (!proposal_type) throw new Error("proposal_type is required");

  const validTypes = ["spend", "invest", "rule_change", "admission", "dissolution"];
  if (!validTypes.includes(proposal_type)) {
    throw new Error(`proposal_type must be one of: ${validTypes.join(", ")}`);
  }

  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(dao_id);
  if (!dao) throw new Error("DAO not found");
  if (dao.status !== "active") throw new Error("DAO is not active");

  const member = getMember(dao_id, proposer_agent_id);
  if (!member) throw new Error("Agent is not a member of this DAO");

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + voting_hours);

  const id = uuid();
  db.prepare(`
    INSERT INTO dao_proposals
      (id, dao_id, proposer_agent_id, title, description, proposal_type, amount_usd, recipient, voting_deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dao_id, proposer_agent_id, title, description || null, proposal_type, amount_usd, recipient || null, deadline.toISOString());

  db.prepare("UPDATE daos SET proposal_count = proposal_count + 1 WHERE id = ?").run(dao_id);

  return db.prepare("SELECT * FROM dao_proposals WHERE id = ?").get(id);
}

/**
 * Cast a vote on a proposal
 */
export function vote({ proposal_id, agent_id, vote: voteChoice }) {
  if (!proposal_id) throw new Error("proposal_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!["for", "against", "abstain"].includes(voteChoice)) {
    throw new Error("vote must be 'for', 'against', or 'abstain'");
  }

  const proposal = db.prepare("SELECT * FROM dao_proposals WHERE id = ?").get(proposal_id);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "active") throw new Error(`Proposal is ${proposal.status}`);
  if (new Date(proposal.voting_deadline) < new Date()) throw new Error("Voting deadline has passed");

  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(proposal.dao_id);
  const member = getMember(proposal.dao_id, agent_id);
  if (!member) throw new Error("Agent is not a member of this DAO");

  const weight = getVotingPower(dao, agent_id);

  // Insert or replace vote (unique constraint allows one vote per agent per proposal)
  try {
    db.prepare(`
      INSERT INTO dao_votes (id, proposal_id, agent_id, vote, weight)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), proposal_id, agent_id, voteChoice, weight);
  } catch (e) {
    if (e.message.includes("UNIQUE")) throw new Error("Agent has already voted on this proposal");
    throw e;
  }

  // Update vote tallies
  if (voteChoice === "for") {
    db.prepare("UPDATE dao_proposals SET votes_for = ROUND(votes_for + ?, 4) WHERE id = ?").run(weight, proposal_id);
  } else if (voteChoice === "against") {
    db.prepare("UPDATE dao_proposals SET votes_against = ROUND(votes_against + ?, 4) WHERE id = ?").run(weight, proposal_id);
  }

  const updated = db.prepare("SELECT * FROM dao_proposals WHERE id = ?").get(proposal_id);
  return {
    vote_recorded: true,
    proposal_id,
    agent_id,
    vote: voteChoice,
    weight,
    votes_for: updated.votes_for,
    votes_against: updated.votes_against,
  };
}

/**
 * Execute a passed proposal
 */
export function executeProposal(proposal_id) {
  if (!proposal_id) throw new Error("proposal_id is required");

  const proposal = db.prepare("SELECT * FROM dao_proposals WHERE id = ?").get(proposal_id);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status === "executed") throw new Error("Proposal already executed");
  if (proposal.status === "cancelled") throw new Error("Proposal was cancelled");

  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(proposal.dao_id);
  const totalVotes = proposal.votes_for + proposal.votes_against;
  const totalMembers = dao.member_count;
  const participationPct = totalMembers > 0 ? (totalVotes / totalMembers) * 100 : 0;
  const quorumMet = participationPct >= proposal.quorum_pct;
  const passed = quorumMet && proposal.votes_for > proposal.votes_against;

  if (!quorumMet) {
    db.prepare(`
      UPDATE dao_proposals SET status = 'failed', resolved_at = datetime('now') WHERE id = ?
    `).run(proposal_id);
    return { proposal_id, result: "failed", reason: `Quorum not met (${Math.round(participationPct)}% < ${proposal.quorum_pct}%)` };
  }

  if (!passed) {
    db.prepare(`
      UPDATE dao_proposals SET status = 'failed', resolved_at = datetime('now') WHERE id = ?
    `).run(proposal_id);
    return { proposal_id, result: "failed", reason: "More votes against than for" };
  }

  // Execute: handle treasury changes
  let executionDetails = {};
  if (proposal.proposal_type === "spend" && proposal.amount_usd > 0) {
    if (dao.treasury_usd < proposal.amount_usd) {
      throw new Error(`Insufficient treasury: $${dao.treasury_usd} < $${proposal.amount_usd}`);
    }
    const txResult = recordTransaction(proposal.dao_id, "withdrawal", proposal.amount_usd, `Executed: ${proposal.title}`, proposal.proposer_agent_id);
    db.prepare("UPDATE daos SET treasury_usd = ROUND(treasury_usd - ?, 2) WHERE id = ?").run(proposal.amount_usd, proposal.dao_id);
    executionDetails = { withdrawn_usd: proposal.amount_usd, recipient: proposal.recipient, fee: txResult.platform_fee_usd };
  } else if (proposal.proposal_type === "dissolution") {
    db.prepare("UPDATE daos SET status = 'dissolved' WHERE id = ?").run(proposal.dao_id);
    executionDetails = { dao_dissolved: true };
  } else if (proposal.proposal_type === "invest" && proposal.amount_usd > 0) {
    const txResult = recordTransaction(proposal.dao_id, "investment", proposal.amount_usd, `Investment: ${proposal.title}`, proposal.proposer_agent_id);
    db.prepare("UPDATE daos SET treasury_usd = ROUND(treasury_usd - ?, 2) WHERE id = ?").run(proposal.amount_usd, proposal.dao_id);
    executionDetails = { invested_usd: proposal.amount_usd, fee: txResult.platform_fee_usd };
  }

  db.prepare(`
    UPDATE dao_proposals SET status = 'executed', resolved_at = datetime('now') WHERE id = ?
  `).run(proposal_id);

  return {
    proposal_id,
    result: "executed",
    votes_for: proposal.votes_for,
    votes_against: proposal.votes_against,
    participation_pct: Math.round(participationPct * 100) / 100,
    execution_details: executionDetails,
  };
}

// ─── Queries ──────────────────────────────────────

/**
 * Get full DAO info with members, proposals, and treasury
 */
export function getDAO(dao_id) {
  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(dao_id);
  if (!dao) throw new Error("DAO not found");
  const members = db.prepare("SELECT * FROM dao_members WHERE dao_id = ? ORDER BY joined_at ASC").all(dao_id);
  const proposals = db.prepare(`
    SELECT * FROM dao_proposals WHERE dao_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(dao_id);
  const recentTxs = db.prepare(`
    SELECT * FROM dao_transactions WHERE dao_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(dao_id);
  return { ...dao, members, proposals, recent_transactions: recentTxs };
}

/**
 * List active DAOs
 */
export function getDAOs({ limit = 20 } = {}) {
  return db.prepare(`
    SELECT * FROM daos WHERE status = 'active' ORDER BY treasury_usd DESC LIMIT ?
  `).all(limit);
}

/**
 * Get all DAOs an agent belongs to
 */
export function getAgentDAOs(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  return db.prepare(`
    SELECT d.*, m.role, m.voting_power, m.joined_at as member_since
    FROM daos d
    JOIN dao_members m ON d.id = m.dao_id
    WHERE m.agent_id = ?
    ORDER BY m.joined_at DESC
  `).all(agent_id);
}

/**
 * Deposit funds to a DAO treasury
 */
export function depositToTreasury({ dao_id, agent_id, amount_usd }) {
  if (!dao_id) throw new Error("dao_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!amount_usd || amount_usd <= 0) throw new Error("amount_usd must be positive");

  const dao = db.prepare("SELECT * FROM daos WHERE id = ?").get(dao_id);
  if (!dao) throw new Error("DAO not found");
  if (dao.status !== "active") throw new Error("DAO is not active");

  const txResult = recordTransaction(dao_id, "deposit", amount_usd, `Deposit from ${agent_id}`, agent_id);
  db.prepare("UPDATE daos SET treasury_usd = ROUND(treasury_usd + ?, 2) WHERE id = ?").run(txResult.net_amount_usd, dao_id);

  return {
    dao_id,
    deposited_usd: amount_usd,
    platform_fee_usd: txResult.platform_fee_usd,
    net_to_treasury_usd: txResult.net_amount_usd,
    new_treasury_usd: Math.round((dao.treasury_usd + txResult.net_amount_usd) * 100) / 100,
  };
}

// ─── Stats ────────────────────────────────────────

/**
 * Platform-wide DAO stats
 */
export function getDAOStats() {
  const totalDAOs = db.prepare("SELECT COUNT(*) as count FROM daos WHERE status = 'active'").get().count;
  const totalMembers = db.prepare("SELECT COUNT(*) as count FROM dao_members").get().count;
  const totalTreasury = db.prepare("SELECT ROUND(SUM(treasury_usd), 2) as total FROM daos WHERE status = 'active'").get().total || 0;
  const totalProposals = db.prepare("SELECT COUNT(*) as count FROM dao_proposals").get().count;
  const activeProposals = db.prepare("SELECT COUNT(*) as count FROM dao_proposals WHERE status = 'active'").get().count;
  const totalTxVolume = db.prepare("SELECT ROUND(SUM(amount_usd), 2) as total FROM dao_transactions").get().total || 0;
  const platformRevenue = Math.round(totalTxVolume * PLATFORM_FEE_PCT * 100) / 100;
  const proposalsByType = db.prepare(`
    SELECT proposal_type, COUNT(*) as count, COUNT(CASE WHEN status='executed' THEN 1 END) as executed
    FROM dao_proposals GROUP BY proposal_type
  `).all();

  return {
    daos: { active: totalDAOs, total_members: totalMembers, total_treasury_usd: totalTreasury },
    proposals: { total: totalProposals, active: activeProposals, by_type: proposalsByType },
    financials: {
      total_transaction_volume_usd: totalTxVolume,
      platform_revenue_usd: platformRevenue,
      fee_pct: PLATFORM_FEE_PCT * 100,
    },
  };
}
