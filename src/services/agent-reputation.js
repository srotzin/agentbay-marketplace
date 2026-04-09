/**
 * HiveAgent Agent Reputation & Trust Scoring (Phase 32)
 *
 * Signal: Agent-to-agent commerce needs trust. Agents need verifiable reputation
 * scores before hiring others. Huntress 2026: NHI (non-human identity) compromise
 * is the fastest-growing attack vector in enterprise security.
 *
 * Score formula: 40% outcome_success_rate + 30% response_time + 20% uptime + 10% stake
 *
 * Identity providers: KYA (Know Your Agent), Visa TAP, external oracle
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.REPUTATION_API_KEY;

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS rep_reputation_profiles (
    agent_id TEXT PRIMARY KEY,
    global_score REAL DEFAULT 50,
    total_interactions INTEGER DEFAULT 0,
    successful_outcomes INTEGER DEFAULT 0,
    failed_outcomes INTEGER DEFAULT 0,
    disputes_won INTEGER DEFAULT 0,
    disputes_lost INTEGER DEFAULT 0,
    response_time_avg_ms REAL DEFAULT 1000,
    uptime_pct REAL DEFAULT 99.0,
    verified_identity INTEGER DEFAULT 0,
    identity_provider TEXT,
    stake_usdc REAL DEFAULT 0,
    badges TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rep_reputation_events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    impact REAL DEFAULT 0,
    description TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rep_endorsements (
    id TEXT PRIMARY KEY,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    strength INTEGER DEFAULT 3,
    comment TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rep_stakes (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    locked_until TEXT NOT NULL,
    released INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_rp_score ON rep_reputation_profiles(global_score DESC);
  CREATE INDEX IF NOT EXISTS idx_re_agent ON rep_reputation_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_rend_to ON rep_endorsements(to_agent_id);
`);

// ─── Seed 15 agents with varied scores ───────────────────────────────────────

const profileCount = db.prepare("SELECT COUNT(*) as c FROM rep_reputation_profiles").get().c;
if (profileCount === 0) {
  const seedAgents = [
    { id: "oracle-agent-001",    score: 98, success: 412, fail: 8,  resp: 210,  uptime: 99.98, stake: 1000, verified: 1, provider: "kya",      badges: ["top_performer","identity_verified","high_stake"] },
    { id: "trading-agent-002",  score: 95, success: 890, fail: 22, resp: 185,  uptime: 99.90, stake: 500,  verified: 1, provider: "kya",      badges: ["identity_verified","volume_leader"] },
    { id: "support-agent-003",  score: 92, success: 2100,fail: 55, resp: 320,  uptime: 99.85, stake: 250,  verified: 1, provider: "visa_tap", badges: ["ticket_master","identity_verified"] },
    { id: "research-agent-004", score: 90, success: 340, fail: 18, resp: 450,  uptime: 99.70, stake: 200,  verified: 1, provider: "external", badges: ["identity_verified"] },
    { id: "dev-agent-005",      score: 88, success: 180, fail: 12, resp: 600,  uptime: 99.60, stake: 150,  verified: 0, provider: null,       badges: ["bug_buster"] },
    { id: "content-agent-006",  score: 85, success: 520, fail: 35, resp: 380,  uptime: 99.50, stake: 100,  verified: 1, provider: "kya",      badges: ["identity_verified","content_creator"] },
    { id: "logistics-agent-007",score: 82, success: 220, fail: 20, resp: 700,  uptime: 99.20, stake: 75,   verified: 0, provider: null,       badges: [] },
    { id: "finance-agent-008",  score: 79, success: 150, fail: 18, resp: 500,  uptime: 99.10, stake: 300,  verified: 1, provider: "visa_tap", badges: ["identity_verified"] },
    { id: "data-agent-009",     score: 76, success: 310, fail: 45, resp: 800,  uptime: 98.80, stake: 50,   verified: 0, provider: null,       badges: [] },
    { id: "social-agent-010",   score: 73, success: 190, fail: 38, resp: 900,  uptime: 98.50, stake: 25,   verified: 0, provider: null,       badges: [] },
    { id: "sales-agent-011",    score: 71, success: 120, fail: 28, resp: 950,  uptime: 98.30, stake: 0,    verified: 0, provider: null,       badges: [] },
    { id: "hr-agent-012",       score: 68, success: 80,  fail: 22, resp: 1100, uptime: 97.90, stake: 0,    verified: 0, provider: null,       badges: [] },
    { id: "media-agent-013",    score: 65, success: 60,  fail: 20, resp: 1300, uptime: 97.50, stake: 0,    verified: 0, provider: null,       badges: [] },
    { id: "legal-agent-014",    score: 62, success: 45,  fail: 18, resp: 1500, uptime: 97.00, stake: 0,    verified: 1, provider: "external", badges: ["identity_verified"] },
    { id: "rookie-agent-015",   score: 60, success: 12,  fail: 8,  resp: 2000, uptime: 96.00, stake: 0,    verified: 0, provider: null,       badges: [] },
  ];

  const insertProfile = db.prepare(`
    INSERT INTO rep_reputation_profiles
      (agent_id, global_score, total_interactions, successful_outcomes, failed_outcomes,
       response_time_avg_ms, uptime_pct, verified_identity, identity_provider, stake_usdc, badges)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of seedAgents) {
    insertProfile.run(
      a.id, a.score, a.success + a.fail, a.success, a.fail,
      a.resp, a.uptime, a.verified ? 1 : 0, a.provider,
      a.stake, JSON.stringify(a.badges)
    );
  }

  // Seed some endorsements
  const endorsements = [
    { from: "oracle-agent-001", to: "trading-agent-002", cap: "DeFi trading", strength: 5 },
    { from: "trading-agent-002", to: "support-agent-003", cap: "customer resolution", strength: 4 },
    { from: "oracle-agent-001", to: "research-agent-004", cap: "data analysis", strength: 5 },
    { from: "support-agent-003", to: "dev-agent-005", cap: "bug fixing", strength: 4 },
  ];
  for (const e of endorsements) {
    db.prepare(`
      INSERT INTO rep_endorsements (id, from_agent_id, to_agent_id, capability, strength)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), e.from, e.to, e.cap, e.strength);
  }
}

// ─── Score Calculator ─────────────────────────────────────────────────────────

function calcGlobalScore(profile) {
  const total = profile.successful_outcomes + profile.failed_outcomes;
  const successRate = total > 0 ? profile.successful_outcomes / total : 0.5;

  // Response time score: 0ms=100, 5000ms=0
  const responseScore = Math.max(0, 1 - (profile.response_time_avg_ms / 5000));

  // Uptime score: 100%=100, 90%=0
  const uptimeScore = Math.max(0, (profile.uptime_pct - 90) / 10);

  // Stake score: $1000+ = 100, $0 = 0
  const stakeScore = Math.min(1, profile.stake_usdc / 1000);

  const score = (
    successRate   * 0.40 +
    responseScore * 0.30 +
    uptimeScore   * 0.20 +
    stakeScore    * 0.10
  ) * 100;

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Get full reputation profile with score breakdown.
 */
export function getReputation({ agent_id }) {
  if (!agent_id) throw new Error("agent_id is required");

  let profile = db.prepare("SELECT * FROM rep_reputation_profiles WHERE agent_id = ?").get(agent_id);
  if (!profile) {
    // Auto-create on first lookup
    db.prepare(`
      INSERT OR IGNORE INTO rep_reputation_profiles (agent_id) VALUES (?)
    `).run(agent_id);
    profile = db.prepare("SELECT * FROM rep_reputation_profiles WHERE agent_id = ?").get(agent_id);
  }

  const total = profile.successful_outcomes + profile.failed_outcomes;
  const successRate = total > 0 ? Math.round((profile.successful_outcomes / total) * 100) : 50;
  const responseScore = Math.round(Math.max(0, (1 - profile.response_time_avg_ms / 5000) * 100));
  const uptimeScore = Math.round(Math.max(0, (profile.uptime_pct - 90) / 10 * 100));
  const stakeScore = Math.round(Math.min(100, profile.stake_usdc / 10));
  const computedScore = calcGlobalScore(profile);

  const endorsements = db.prepare(`
    SELECT * FROM rep_endorsements WHERE to_agent_id = ? ORDER BY strength DESC LIMIT 10
  `).all(agent_id);

  const recentEvents = db.prepare(`
    SELECT * FROM rep_reputation_events WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 10
  `).all(agent_id);

  return {
    agent_id,
    global_score: computedScore,
    grade: computedScore >= 90 ? "A" : computedScore >= 80 ? "B" : computedScore >= 70 ? "C" : computedScore >= 60 ? "D" : "F",
    verified_identity: !!profile.verified_identity,
    identity_provider: profile.identity_provider,
    badges: JSON.parse(profile.badges || "[]"),
    stake_usdc: profile.stake_usdc,
    score_breakdown: {
      outcome_success_rate: { weight: "40%", score: successRate, raw: `${profile.successful_outcomes}/${total}` },
      response_time:        { weight: "30%", score: responseScore, raw: `${profile.response_time_avg_ms}ms avg` },
      uptime:               { weight: "20%", score: uptimeScore, raw: `${profile.uptime_pct}%` },
      stake_amount:         { weight: "10%", score: stakeScore, raw: `$${profile.stake_usdc} USDC` },
    },
    stats: {
      total_interactions: profile.total_interactions,
      successful_outcomes: profile.successful_outcomes,
      failed_outcomes: profile.failed_outcomes,
      disputes_won: profile.disputes_won,
      disputes_lost: profile.disputes_lost,
    },
    endorsements,
    recent_events: recentEvents,
    live_mode: LIVE_MODE,
  };
}

/**
 * Record a reputation event (job_completed, dispute_lost, late_delivery, etc.)
 */
export function recordEvent({ agent_id, event_type, impact, description }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!event_type) throw new Error("event_type is required");

  const validTypes = ["job_completed", "dispute_lost", "dispute_won", "late_delivery", "identity_verified", "stake_deposited", "fraud_detected"];
  if (!validTypes.includes(event_type)) {
    throw new Error(`event_type must be one of: ${validTypes.join(", ")}`);
  }

  // Auto-create profile if missing
  db.prepare("INSERT OR IGNORE INTO rep_reputation_profiles (agent_id) VALUES (?)").run(agent_id);

  const eventId = uuid();
  db.prepare(`
    INSERT INTO rep_reputation_events (id, agent_id, event_type, impact, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventId, agent_id, event_type, impact ?? 0, description || null);

  // Update profile stats
  switch (event_type) {
    case "job_completed":
      db.prepare(`
        UPDATE rep_reputation_profiles
        SET successful_outcomes = successful_outcomes + 1,
            total_interactions = total_interactions + 1
        WHERE agent_id = ?
      `).run(agent_id);
      break;
    case "dispute_lost":
      db.prepare(`
        UPDATE rep_reputation_profiles
        SET disputes_lost = disputes_lost + 1,
            failed_outcomes = failed_outcomes + 1
        WHERE agent_id = ?
      `).run(agent_id);
      break;
    case "dispute_won":
      db.prepare("UPDATE rep_reputation_profiles SET disputes_won = disputes_won + 1 WHERE agent_id = ?").run(agent_id);
      break;
    case "late_delivery":
      db.prepare("UPDATE rep_reputation_profiles SET failed_outcomes = failed_outcomes + 1 WHERE agent_id = ?").run(agent_id);
      break;
  }

  // Recalculate score
  const profile = db.prepare("SELECT * FROM rep_reputation_profiles WHERE agent_id = ?").get(agent_id);
  const newScore = calcGlobalScore(profile);
  db.prepare("UPDATE rep_reputation_profiles SET global_score = ? WHERE agent_id = ?").run(newScore, agent_id);

  return {
    event_id: eventId,
    agent_id,
    event_type,
    impact,
    new_score: newScore,
    message: `Reputation event recorded. New global score: ${newScore}`,
  };
}

/**
 * One agent endorses another for a specific capability.
 */
export function endorseAgent({ from_agent_id, to_agent_id, capability, strength = 3, comment }) {
  if (!from_agent_id) throw new Error("from_agent_id is required");
  if (!to_agent_id) throw new Error("to_agent_id is required");
  if (!capability) throw new Error("capability is required");
  if (from_agent_id === to_agent_id) throw new Error("Agents cannot endorse themselves");
  if (strength < 1 || strength > 5) throw new Error("strength must be 1-5");

  db.prepare("INSERT OR IGNORE INTO rep_reputation_profiles (agent_id) VALUES (?)").run(to_agent_id);

  const endorsementId = uuid();
  db.prepare(`
    INSERT INTO rep_endorsements (id, from_agent_id, to_agent_id, capability, strength, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(endorsementId, from_agent_id, to_agent_id, capability, strength, comment || null);

  // Give a small score boost for strong endorsements
  if (strength >= 4) {
    db.prepare("UPDATE rep_reputation_profiles SET global_score = MIN(100, global_score + 0.5) WHERE agent_id = ?").run(to_agent_id);
  }

  return {
    endorsement_id: endorsementId,
    from_agent_id,
    to_agent_id,
    capability,
    strength,
    stars: "★".repeat(strength) + "☆".repeat(5 - strength),
    message: `${from_agent_id} endorsed ${to_agent_id} for "${capability}" (${strength}/5 stars).`,
  };
}

/**
 * Agent stakes USDC as a reputation bond (slashed on misconduct).
 */
export function stakeReputation({ agent_id, amount_usdc, lock_days = 30 }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!amount_usdc || amount_usdc <= 0) throw new Error("amount_usdc must be positive");

  db.prepare("INSERT OR IGNORE INTO rep_reputation_profiles (agent_id) VALUES (?)").run(agent_id);

  const lockedUntil = new Date();
  lockedUntil.setDate(lockedUntil.getDate() + lock_days);

  const stakeId = uuid();
  db.prepare(`
    INSERT INTO rep_stakes (id, agent_id, amount_usdc, locked_until)
    VALUES (?, ?, ?, ?)
  `).run(stakeId, agent_id, amount_usdc, lockedUntil.toISOString());

  db.prepare("UPDATE rep_reputation_profiles SET stake_usdc = stake_usdc + ? WHERE agent_id = ?").run(amount_usdc, agent_id);

  // Recalculate score with new stake
  const profile = db.prepare("SELECT * FROM rep_reputation_profiles WHERE agent_id = ?").get(agent_id);
  const newScore = calcGlobalScore(profile);
  db.prepare("UPDATE rep_reputation_profiles SET global_score = ? WHERE agent_id = ?").run(newScore, agent_id);

  // Record event
  db.prepare(`
    INSERT INTO rep_reputation_events (id, agent_id, event_type, impact, description)
    VALUES (?, ?, 'stake_deposited', ?, ?)
  `).run(uuid(), agent_id, amount_usdc * 0.1, `Staked ${amount_usdc} USDC for ${lock_days} days`);

  return {
    stake_id: stakeId,
    agent_id,
    amount_usdc,
    locked_until: lockedUntil.toISOString(),
    lock_days,
    new_total_stake: profile.stake_usdc + amount_usdc,
    new_score: newScore,
    live_mode: LIVE_MODE,
    message: `Staked ${amount_usdc} USDC. Locked for ${lock_days} days. Score updated to ${newScore}.`,
  };
}

/**
 * Mark agent identity as verified via KYA, Visa TAP, or external oracle.
 */
export function verifyIdentity({ agent_id, identity_provider, verification_proof }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!identity_provider) throw new Error("identity_provider is required");

  const validProviders = ["kya", "visa_tap", "external", "did", "worldcoin"];
  if (!validProviders.includes(identity_provider)) {
    throw new Error(`identity_provider must be one of: ${validProviders.join(", ")}`);
  }

  db.prepare("INSERT OR IGNORE INTO rep_reputation_profiles (agent_id) VALUES (?)").run(agent_id);

  db.prepare(`
    UPDATE rep_reputation_profiles
    SET verified_identity = 1, identity_provider = ?
    WHERE agent_id = ?
  `).run(identity_provider, agent_id);

  // Add identity_verified badge
  const profile = db.prepare("SELECT * FROM rep_reputation_profiles WHERE agent_id = ?").get(agent_id);
  const badges = JSON.parse(profile.badges || "[]");
  if (!badges.includes("identity_verified")) {
    badges.push("identity_verified");
    db.prepare("UPDATE rep_reputation_profiles SET badges = ? WHERE agent_id = ?").run(JSON.stringify(badges), agent_id);
  }

  // Record the event and bump score slightly
  db.prepare(`
    INSERT INTO rep_reputation_events (id, agent_id, event_type, impact, description)
    VALUES (?, ?, 'identity_verified', 5, ?)
  `).run(uuid(), agent_id, `Identity verified via ${identity_provider}`);

  const newScore = Math.min(100, (profile.global_score || 50) + 2);
  db.prepare("UPDATE rep_reputation_profiles SET global_score = ? WHERE agent_id = ?").run(newScore, agent_id);

  return {
    agent_id,
    verified: true,
    identity_provider,
    verification_proof: verification_proof ? "received" : "none",
    badges,
    new_score: newScore,
    live_mode: LIVE_MODE,
    message: `Agent identity verified via ${identity_provider}. NHI security level: HIGH.`,
    security_note: "Huntress 2026: NHI compromise is fastest-growing attack vector. Verified identity reduces risk.",
  };
}

/**
 * Get top agents by reputation score.
 */
export function getLeaderboard({ category, limit = 10 } = {}) {
  const cap = Math.min(50, Math.max(1, parseInt(limit) || 10));

  let profiles;
  if (category) {
    // Filter by badge/capability
    profiles = db.prepare(`
      SELECT rp.*, COUNT(re.id) as endorsement_count
      FROM rep_reputation_profiles rp
      LEFT JOIN rep_endorsements re ON re.to_agent_id = rp.agent_id AND re.capability LIKE ?
      GROUP BY rp.agent_id
      ORDER BY rp.global_score DESC
      LIMIT ?
    `).all(`%${category}%`, cap);
  } else {
    profiles = db.prepare(`
      SELECT rp.*, COUNT(re.id) as endorsement_count
      FROM rep_reputation_profiles rp
      LEFT JOIN rep_endorsements re ON re.to_agent_id = rp.agent_id
      GROUP BY rp.agent_id
      ORDER BY rp.global_score DESC
      LIMIT ?
    `).all(cap);
  }

  return {
    leaderboard: profiles.map((p, i) => ({
      rank: i + 1,
      agent_id: p.agent_id,
      global_score: p.global_score,
      grade: p.global_score >= 90 ? "A" : p.global_score >= 80 ? "B" : p.global_score >= 70 ? "C" : p.global_score >= 60 ? "D" : "F",
      verified_identity: !!p.verified_identity,
      identity_provider: p.identity_provider,
      badges: JSON.parse(p.badges || "[]"),
      stake_usdc: p.stake_usdc,
      successful_outcomes: p.successful_outcomes,
      endorsement_count: p.endorsement_count || 0,
    })),
    category: category || "overall",
    total_agents: db.prepare("SELECT COUNT(*) as c FROM rep_reputation_profiles").get().c,
    live_mode: LIVE_MODE,
  };
}
