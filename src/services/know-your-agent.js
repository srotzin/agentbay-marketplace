import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const VERIFY_AGENT_FEE          = 0.02;  // $0.02 per verification
const CLASSIFY_BOT_FEE          = 0.01;  // $0.01 per classification
const DELEGATION_CHECK_FEE      = 0.01;  // $0.01 per delegation check
const BEHAVIOR_SCORE_FEE        = 0.05;  // $0.05 per behavior score
const SPENDING_LIMIT_CHECK_FEE  = 0.01;  // $0.01 per spending limit check
const REPORT_AGENT_FEE          = 0.00;  // Free — security incentive

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kya_agents (
    id                   TEXT PRIMARY KEY,
    claimed_identity     TEXT NOT NULL,
    agent_type           TEXT DEFAULT 'ai_agent' CHECK(agent_type IN ('ai_agent','human_delegate','service_account','iot_device','rpa_bot')),
    owner_org            TEXT,
    created_by           TEXT,
    trust_level          TEXT DEFAULT 'unverified' CHECK(trust_level IN ('unverified','low','medium','high','trusted')),
    status               TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','flagged','revoked')),
    daily_spend_limit_usd REAL DEFAULT 1000,
    category_limits      TEXT DEFAULT '{}',
    requires_human_approval_above_usd REAL DEFAULT 500,
    total_verifications  INTEGER DEFAULT 0,
    total_spend_usd      REAL DEFAULT 0,
    daily_spend_usd      REAL DEFAULT 0,
    last_seen_at         TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kya_verification_log (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    claimed_identity     TEXT NOT NULL,
    requested_action     TEXT,
    verified             INTEGER NOT NULL,
    trust_score          REAL NOT NULL,
    identity_confidence  TEXT NOT NULL CHECK(identity_confidence IN ('very_low','low','medium','high','very_high')),
    delegation_chain     TEXT DEFAULT '[]',
    risk_level           TEXT NOT NULL CHECK(risk_level IN ('none','low','medium','high','critical')),
    fee_charged_usd      REAL DEFAULT 0.02,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kya_classification_log (
    id                   TEXT PRIMARY KEY,
    fingerprint_hash     TEXT NOT NULL,
    classification       TEXT NOT NULL CHECK(classification IN ('legitimate_agent','suspicious_bot','known_bad')),
    confidence           REAL NOT NULL,
    signals_analyzed     TEXT DEFAULT '[]',
    recommended_action   TEXT,
    fee_charged_usd      REAL DEFAULT 0.01,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kya_behavior_scores (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    timeframe            TEXT NOT NULL,
    behavior_score       REAL NOT NULL,
    anomalies            TEXT DEFAULT '[]',
    transaction_patterns TEXT DEFAULT '{}',
    risk_flags           TEXT DEFAULT '[]',
    peer_comparison      TEXT DEFAULT '{}',
    fee_charged_usd      REAL DEFAULT 0.05,
    scored_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kya_suspicious_reports (
    id                   TEXT PRIMARY KEY,
    reported_agent_id    TEXT NOT NULL,
    reported_by          TEXT,
    reason               TEXT NOT NULL,
    evidence             TEXT DEFAULT '{}',
    investigation_status TEXT DEFAULT 'pending' CHECK(investigation_status IN ('pending','under_review','resolved','dismissed')),
    agent_flagged        INTEGER DEFAULT 0,
    severity             TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Known Agents ────────────────────────────────────────────────────────

const _agentCount = db.prepare("SELECT COUNT(*) as n FROM kya_agents").get().n;
if (_agentCount === 0) {
  const seedAgents = [
    { id: randomUUID(), claimed_identity: "sales-automation-bot-v2",      agent_type: "ai_agent",       owner_org: "Acme Corp",          created_by: "admin@acme.com",          trust_level: "high",       status: "active",    daily_spend_limit_usd: 5000,  category_limits: '{"software":10000,"travel":2000}', requires_human_approval_above_usd: 2000, total_verifications: 4821, total_spend_usd: 128400, daily_spend_usd: 342  },
    { id: randomUUID(), claimed_identity: "inventory-reorder-agent",       agent_type: "ai_agent",       owner_org: "GlobalTrade Inc",     created_by: "ops@globaltrade.com",     trust_level: "trusted",    status: "active",    daily_spend_limit_usd: 50000, category_limits: '{"raw_materials":100000,"packaging":20000}', requires_human_approval_above_usd: 25000, total_verifications: 9102, total_spend_usd: 2800000, daily_spend_usd: 8900 },
    { id: randomUUID(), claimed_identity: "hr-onboarding-assistant",       agent_type: "rpa_bot",        owner_org: "TechStartup LLC",     created_by: "hr@techstartup.io",       trust_level: "medium",     status: "active",    daily_spend_limit_usd: 500,   category_limits: '{"software_licenses":2000}', requires_human_approval_above_usd: 200, total_verifications: 1244, total_spend_usd: 18200, daily_spend_usd: 45   },
    { id: randomUUID(), claimed_identity: "finance-reconciliation-bot",    agent_type: "rpa_bot",        owner_org: "Meridian Capital",    created_by: "cfo@meridiancap.com",     trust_level: "high",       status: "active",    daily_spend_limit_usd: 100,   category_limits: '{}', requires_human_approval_above_usd: 50, total_verifications: 6780, total_spend_usd: 9800, daily_spend_usd: 30      },
    { id: randomUUID(), claimed_identity: "customer-support-agent-gpt4",   agent_type: "ai_agent",       owner_org: "RetailCo",           created_by: "tech@retailco.com",       trust_level: "medium",     status: "active",    daily_spend_limit_usd: 200,   category_limits: '{"refunds":500}', requires_human_approval_above_usd: 150, total_verifications: 22400, total_spend_usd: 4500, daily_spend_usd: 18    },
    { id: randomUUID(), claimed_identity: "market-data-scraper-v1",        agent_type: "service_account",owner_org: "FinTech Analytics",  created_by: "data@fintechanalytics.io",trust_level: "low",        status: "flagged",   daily_spend_limit_usd: 50,    category_limits: '{}', requires_human_approval_above_usd: 25, total_verifications: 312, total_spend_usd: 890, daily_spend_usd: 8          },
    { id: randomUUID(), claimed_identity: "logistics-optimizer-claude",    agent_type: "ai_agent",       owner_org: "FreightMasters",     created_by: "ops@freightmasters.com",  trust_level: "high",       status: "active",    daily_spend_limit_usd: 10000, category_limits: '{"freight":25000,"customs":5000}', requires_human_approval_above_usd: 5000, total_verifications: 3390, total_spend_usd: 580000, daily_spend_usd: 1240 },
    { id: randomUUID(), claimed_identity: "unknown-procurement-caller",    agent_type: "ai_agent",       owner_org: null,                 created_by: null,                      trust_level: "unverified", status: "suspended", daily_spend_limit_usd: 0,     category_limits: '{}', requires_human_approval_above_usd: 0, total_verifications: 8, total_spend_usd: 0, daily_spend_usd: 0              },
    { id: randomUUID(), claimed_identity: "iot-fleet-telemetry-agent",     agent_type: "iot_device",     owner_org: "AutoFleet Systems",  created_by: "iot@autofleet.io",        trust_level: "trusted",    status: "active",    daily_spend_limit_usd: 500,   category_limits: '{"maintenance":2000,"fuel":1000}', requires_human_approval_above_usd: 300, total_verifications: 18220, total_spend_usd: 45000, daily_spend_usd: 125  },
    { id: randomUUID(), claimed_identity: "content-generation-bot",        agent_type: "ai_agent",       owner_org: "MediaHouse Digital", created_by: "dev@mediahouse.com",      trust_level: "medium",     status: "active",    daily_spend_limit_usd: 300,   category_limits: '{"api_usage":1000}', requires_human_approval_above_usd: 200, total_verifications: 5512, total_spend_usd: 12800, daily_spend_usd: 88     },
    { id: randomUUID(), claimed_identity: "suspicious-spend-agent-xr9",    agent_type: "ai_agent",       owner_org: "Unknown",            created_by: null,                      trust_level: "low",        status: "flagged",   daily_spend_limit_usd: 100,   category_limits: '{}', requires_human_approval_above_usd: 10, total_verifications: 45, total_spend_usd: 4200, daily_spend_usd: 90              },
    { id: randomUUID(), claimed_identity: "billing-automation-svc",        agent_type: "service_account",owner_org: "BillingSaaS Ltd",    created_by: "admin@billingsaas.com",   trust_level: "high",       status: "active",    daily_spend_limit_usd: 2000,  category_limits: '{"payment_processing":5000}', requires_human_approval_above_usd: 1500, total_verifications: 7290, total_spend_usd: 220000, daily_spend_usd: 580  },
  ];
  const insA = db.prepare(`INSERT OR IGNORE INTO kya_agents
    (id, claimed_identity, agent_type, owner_org, created_by, trust_level, status, daily_spend_limit_usd, category_limits, requires_human_approval_above_usd, total_verifications, total_spend_usd, daily_spend_usd)
    VALUES (@id, @claimed_identity, @agent_type, @owner_org, @created_by, @trust_level, @status, @daily_spend_limit_usd, @category_limits, @requires_human_approval_above_usd, @total_verifications, @total_spend_usd, @daily_spend_usd)`);
  for (const a of seedAgents) insA.run(a);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trustLevelScore(level) {
  return { unverified: 10, low: 30, medium: 55, high: 80, trusted: 97 }[level] ?? 10;
}

function identityConfidenceFromScore(score) {
  if (score >= 90) return "very_high";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "very_low";
}

function riskLevelFromScore(score, status) {
  if (status === "revoked")   return "critical";
  if (status === "suspended") return "critical";
  if (status === "flagged")   return "high";
  if (score < 30) return "high";
  if (score < 55) return "medium";
  if (score < 80) return "low";
  return "none";
}

// ─── verifyAgent ──────────────────────────────────────────────────────────────

/**
 * Verify an agent's identity and authorization for a requested action.
 * @param {string} agentId         - Agent identifier (UUID or claimed identity string)
 * @param {string} claimedIdentity - The identity the agent claims to have
 * @param {string} requestedAction - Action the agent is requesting (e.g. "purchase_order_creation")
 * @returns Verification result with trust_score, identity_confidence, delegation_chain, risk_level
 * Platform fee: $0.02/verification
 */
export function verifyAgent(agentId, claimedIdentity, requestedAction = null) {
  if (!agentId) throw new Error("agentId is required");
  if (!claimedIdentity) throw new Error("claimedIdentity is required");

  // Look up by ID or by claimed identity
  const agent = db.prepare("SELECT * FROM kya_agents WHERE id = ? OR claimed_identity = ?").get(agentId, agentId);

  let trustScore, identityMatch, statusPenalty;

  if (agent) {
    identityMatch = agent.claimed_identity.toLowerCase() === claimedIdentity.toLowerCase();
    const baseScore = trustLevelScore(agent.trust_level);
    statusPenalty = agent.status === "flagged" ? -25 : agent.status === "suspended" ? -50 : agent.status === "revoked" ? -80 : 0;
    const identityBonus = identityMatch ? 0 : -20;
    trustScore = Math.max(0, Math.min(100, baseScore + statusPenalty + identityBonus + (Math.random() * 6 - 3)));
  } else {
    // Unknown agent — assign low score
    trustScore = 15 + Math.random() * 15;
    identityMatch = false;
  }

  trustScore = Math.round(trustScore * 10) / 10;
  const identityConfidence = identityConfidenceFromScore(trustScore);
  const riskLevel = riskLevelFromScore(trustScore, agent?.status ?? "active");

  // Build delegation chain
  const delegationChain = [];
  if (agent?.created_by) delegationChain.push({ role: "creator", identity: agent.created_by });
  if (agent?.owner_org)  delegationChain.push({ role: "owning_organization", identity: agent.owner_org });
  if (delegationChain.length === 0 && !agent) delegationChain.push({ role: "unknown", identity: "No delegation chain found — unregistered agent" });

  const verified = trustScore >= 50 && identityMatch && (agent?.status === "active") && riskLevel !== "critical";

  // Log verification
  const logId = randomUUID();
  db.prepare(`INSERT OR IGNORE INTO kya_verification_log
    (id, agent_id, claimed_identity, requested_action, verified, trust_score, identity_confidence, delegation_chain, risk_level, fee_charged_usd)
    VALUES (@id, @agent_id, @claimed_identity, @requested_action, @verified, @trust_score, @identity_confidence, @delegation_chain, @risk_level, @fee_charged_usd)
  `).run({
    id: logId,
    agent_id: agentId,
    claimed_identity: claimedIdentity,
    requested_action: requestedAction,
    verified: verified ? 1 : 0,
    trust_score: trustScore,
    identity_confidence: identityConfidence,
    delegation_chain: JSON.stringify(delegationChain),
    risk_level: riskLevel,
    fee_charged_usd: VERIFY_AGENT_FEE,
  });

  if (agent) {
    db.prepare("UPDATE kya_agents SET total_verifications = total_verifications + 1, last_seen_at = datetime('now') WHERE id = ?").run(agent.id);
  }

  return {
    verification_id: logId,
    agent_id: agentId,
    claimed_identity: claimedIdentity,
    requested_action: requestedAction,
    verified,
    trust_score: trustScore,
    identity_confidence: identityConfidence,
    identity_match: identityMatch,
    agent_status: agent?.status ?? "not_registered",
    agent_type: agent?.agent_type ?? "unknown",
    owner_org: agent?.owner_org ?? null,
    delegation_chain: delegationChain,
    risk_level: riskLevel,
    denial_reason: !verified
      ? (!identityMatch ? "Identity mismatch" : agent?.status !== "active" ? `Agent is ${agent?.status}` : "Insufficient trust score")
      : null,
    platform_fee_usd: VERIFY_AGENT_FEE,
    verified_at: new Date().toISOString(),
  };
}

// ─── classifyBot ──────────────────────────────────────────────────────────────

/**
 * Classify whether a request fingerprint is from a legitimate agent, suspicious bot, or known bad actor.
 * @param {Object} requestFingerprint - {ip, user_agent, request_rate_rpm, payload_size_kb, origin_asn, tls_fingerprint}
 * @param {Object} behaviorSignals    - {repeated_errors, unusual_hours, geo_anomaly, velocity_spike, api_key_sharing}
 * @returns Classification with confidence, signals_analyzed, and recommended_action
 * Platform fee: $0.01/classification
 */
export function classifyBot(requestFingerprint = {}, behaviorSignals = {}) {
  const signals = [];
  let riskPoints = 0;

  // Analyze request fingerprint
  const rpm = requestFingerprint.request_rate_rpm ?? 0;
  if (rpm > 300) { signals.push({ signal: "very_high_request_rate", value: rpm, weight: 3 }); riskPoints += 3; }
  else if (rpm > 100) { signals.push({ signal: "elevated_request_rate", value: rpm, weight: 2 }); riskPoints += 2; }
  else if (rpm > 0) { signals.push({ signal: "normal_request_rate", value: rpm, weight: 0 }); }

  const ua = requestFingerprint.user_agent ?? "";
  if (!ua || ua.length < 10) { signals.push({ signal: "missing_or_short_user_agent", value: ua || "empty", weight: 2 }); riskPoints += 2; }
  else if (/python-requests|curl|scrapy|bot|spider/i.test(ua)) { signals.push({ signal: "bot_user_agent_detected", value: ua, weight: 2 }); riskPoints += 2; }
  else { signals.push({ signal: "legitimate_user_agent_pattern", value: ua.slice(0, 40), weight: 0 }); }

  const payloadKb = requestFingerprint.payload_size_kb ?? 0;
  if (payloadKb > 5000) { signals.push({ signal: "abnormally_large_payload", value: `${payloadKb}KB`, weight: 2 }); riskPoints += 2; }

  // Analyze behavior signals
  if (behaviorSignals.repeated_errors === true || behaviorSignals.repeated_errors > 10) {
    signals.push({ signal: "high_error_rate", value: behaviorSignals.repeated_errors, weight: 2 }); riskPoints += 2;
  }
  if (behaviorSignals.unusual_hours === true) {
    signals.push({ signal: "activity_outside_business_hours", value: true, weight: 1 }); riskPoints += 1;
  }
  if (behaviorSignals.geo_anomaly === true) {
    signals.push({ signal: "geographic_anomaly_detected", value: true, weight: 2 }); riskPoints += 2;
  }
  if (behaviorSignals.velocity_spike === true) {
    signals.push({ signal: "velocity_spike_detected", value: true, weight: 3 }); riskPoints += 3;
  }
  if (behaviorSignals.api_key_sharing === true) {
    signals.push({ signal: "possible_api_key_sharing", value: true, weight: 3 }); riskPoints += 3;
  }

  const tlsFp = requestFingerprint.tls_fingerprint ?? null;
  if (tlsFp && /^(known_bad|blocklist)/.test(tlsFp)) {
    signals.push({ signal: "tls_fingerprint_on_blocklist", value: tlsFp, weight: 5 }); riskPoints += 5;
  }

  // Classify
  let classification, recommendedAction;
  const maxRisk = 18;
  const riskPct = Math.min(100, Math.round((riskPoints / maxRisk) * 100));
  const confidence = Math.min(99, 55 + riskPct * 0.35 + Math.random() * 10);

  if (riskPoints >= 7 || (tlsFp && /known_bad/.test(tlsFp))) {
    classification = "known_bad";
    recommendedAction = "block_immediately";
  } else if (riskPoints >= 3) {
    classification = "suspicious_bot";
    recommendedAction = "require_captcha_or_elevated_auth";
  } else {
    classification = "legitimate_agent";
    recommendedAction = "allow_with_standard_monitoring";
  }

  const classId = randomUUID();
  const fpHash = `fp_${Buffer.from(JSON.stringify(requestFingerprint)).toString("base64").slice(0, 16)}`;

  db.prepare(`INSERT OR IGNORE INTO kya_classification_log
    (id, fingerprint_hash, classification, confidence, signals_analyzed, recommended_action, fee_charged_usd)
    VALUES (@id, @fingerprint_hash, @classification, @confidence, @signals_analyzed, @recommended_action, @fee_charged_usd)
  `).run({
    id: classId,
    fingerprint_hash: fpHash,
    classification,
    confidence: Math.round(confidence * 10) / 10,
    signals_analyzed: JSON.stringify(signals),
    recommended_action: recommendedAction,
    fee_charged_usd: CLASSIFY_BOT_FEE,
  });

  return {
    classification_id: classId,
    classification,
    confidence: Math.round(confidence * 10) / 10,
    risk_score: riskPoints,
    signals_analyzed: signals,
    signals_count: signals.length,
    recommended_action: recommendedAction,
    action_description: {
      allow_with_standard_monitoring: "Request appears legitimate. Proceed with normal rate limits and logging.",
      require_captcha_or_elevated_auth: "Suspicious patterns detected. Require additional authentication before proceeding.",
      block_immediately: "High-confidence malicious activity. Block request and alert security team.",
    }[recommendedAction],
    platform_fee_usd: CLASSIFY_BOT_FEE,
    classified_at: new Date().toISOString(),
  };
}

// ─── checkDelegationScope ─────────────────────────────────────────────────────

/**
 * Verify that an agent is authorized to perform a specific action and amount.
 * @param {string} agentId         - Agent ID or claimed identity
 * @param {string} requestedAction - Action string (e.g. "purchase_order", "invoice_approval")
 * @param {number} requestedAmount - Dollar amount involved in the action
 * @returns Authorization result with scope details and delegator chain
 * Platform fee: $0.01/check
 */
export function checkDelegationScope(agentId, requestedAction, requestedAmount = 0) {
  if (!agentId) throw new Error("agentId is required");
  if (!requestedAction) throw new Error("requestedAction is required");

  const agent = db.prepare("SELECT * FROM kya_agents WHERE id = ? OR claimed_identity = ?").get(agentId, agentId);

  if (!agent) {
    return {
      check_id: randomUUID(),
      agent_id: agentId,
      requested_action: requestedAction,
      requested_amount_usd: requestedAmount,
      authorized: false,
      reason: "Agent not found in registry — unregistered agents are not authorized",
      max_authorized_amount_usd: 0,
      daily_limit_usd: 0,
      scope_restrictions: ["not_registered"],
      delegator_chain: [],
      requires_human_approval: true,
      platform_fee_usd: DELEGATION_CHECK_FEE,
      checked_at: new Date().toISOString(),
    };
  }

  const categoryLimits = JSON.parse(agent.category_limits || "{}");
  const scopeRestrictions = [];

  // Determine category from action
  const actionCategoryMap = {
    purchase_order: "procurement", purchase_order_creation: "procurement",
    invoice_approval: "finance",   payment: "finance",  wire_transfer: "finance",
    travel_booking: "travel",      hotel_booking: "travel",
    software_license: "software",  cloud_resource: "software",
    hire_contractor: "hr",         staff_offboarding: "hr",
    data_export: "data",           api_key_rotation: "security",
  };
  const actionCategory = actionCategoryMap[requestedAction.toLowerCase()] ?? "general";

  // Check agent status
  if (agent.status !== "active") {
    scopeRestrictions.push(`agent_status_${agent.status}`);
  }

  // Check daily spend limit
  const dailyRemaining = Math.max(0, agent.daily_spend_limit_usd - agent.daily_spend_usd);
  if (requestedAmount > agent.daily_spend_limit_usd) {
    scopeRestrictions.push("exceeds_daily_limit");
  }
  if (requestedAmount > dailyRemaining) {
    scopeRestrictions.push("exceeds_remaining_daily_budget");
  }

  // Check category-specific limits
  const catLimit = categoryLimits[actionCategory] ?? null;
  if (catLimit !== null && requestedAmount > catLimit) {
    scopeRestrictions.push(`exceeds_category_limit_${actionCategory}`);
  }

  // Trust level restrictions
  if (agent.trust_level === "unverified" && requestedAmount > 0) {
    scopeRestrictions.push("unverified_agents_cannot_authorize_spend");
  }
  if (agent.trust_level === "low" && requestedAmount > 500) {
    scopeRestrictions.push("low_trust_agents_limited_to_500usd");
  }

  const requiresHumanApproval = requestedAmount > agent.requires_human_approval_above_usd || scopeRestrictions.length > 0;
  const authorized = agent.status === "active" && scopeRestrictions.length === 0 && !requiresHumanApproval;

  const delegatorChain = [];
  if (agent.created_by) delegatorChain.push({ role: "created_by", identity: agent.created_by, trust_level: agent.trust_level });
  if (agent.owner_org)  delegatorChain.push({ role: "owner_org",   identity: agent.owner_org  });

  return {
    check_id: randomUUID(),
    agent_id: agent.id,
    claimed_identity: agent.claimed_identity,
    requested_action: requestedAction,
    action_category: actionCategory,
    requested_amount_usd: requestedAmount,
    authorized,
    reason: authorized
      ? `Agent is authorized for ${requestedAction} up to $${agent.daily_spend_limit_usd}/day`
      : `Authorization denied: ${scopeRestrictions.join(", ")}`,
    max_authorized_amount_usd: Math.min(agent.daily_spend_limit_usd, catLimit ?? agent.daily_spend_limit_usd),
    remaining_daily_budget_usd: dailyRemaining,
    daily_limit_usd: agent.daily_spend_limit_usd,
    category_limit_usd: catLimit,
    requires_human_approval: requiresHumanApproval,
    human_approval_threshold_usd: agent.requires_human_approval_above_usd,
    scope_restrictions: scopeRestrictions,
    delegator_chain: delegatorChain,
    agent_trust_level: agent.trust_level,
    platform_fee_usd: DELEGATION_CHECK_FEE,
    checked_at: new Date().toISOString(),
  };
}

// ─── getAgentBehaviorScore ────────────────────────────────────────────────────

/**
 * Analyze an agent's behavioral patterns and produce a risk-adjusted score.
 * @param {string} agentId   - Agent ID or claimed identity
 * @param {string} timeframe - "24h"|"7d"|"30d"|"90d"
 * @returns Behavior score (0-100), anomalies, transaction_patterns, risk_flags, peer_comparison
 * Platform fee: $0.05/score
 */
export function getAgentBehaviorScore(agentId, timeframe = "7d") {
  if (!agentId) throw new Error("agentId is required");
  const validTimeframes = ["24h", "7d", "30d", "90d"];
  if (!validTimeframes.includes(timeframe)) throw new Error(`timeframe must be one of: ${validTimeframes.join(", ")}`);

  const agent = db.prepare("SELECT * FROM kya_agents WHERE id = ? OR claimed_identity = ?").get(agentId, agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const baseScore = trustLevelScore(agent.trust_level);
  const noise = Math.random() * 8 - 4;
  const behaviorScore = Math.max(0, Math.min(100, Math.round((baseScore + noise) * 10) / 10));

  // Generate realistic anomalies based on trust/status
  const anomalies = [];
  if (agent.status === "flagged") {
    anomalies.push({ type: "account_flagged", detected_at: new Date(Date.now() - 86400000 * 2).toISOString(), severity: "high", detail: "Account flagged for review following unusual activity pattern." });
  }
  if (agent.daily_spend_usd > agent.daily_spend_limit_usd * 0.9) {
    anomalies.push({ type: "approaching_daily_limit", detected_at: new Date().toISOString(), severity: "medium", detail: `Daily spend $${agent.daily_spend_usd} is within 10% of daily limit $${agent.daily_spend_limit_usd}` });
  }
  if (agent.trust_level === "low" || agent.trust_level === "unverified") {
    anomalies.push({ type: "low_trust_agent_active", detected_at: new Date().toISOString(), severity: "medium", detail: "Agent has low/unverified trust level; actions should require elevated oversight." });
  }
  if (Math.random() < 0.25) {
    anomalies.push({ type: "off_hours_activity", detected_at: new Date(Date.now() - 3600000 * 3).toISOString(), severity: "low", detail: "API calls detected outside normal business hours (02:00-04:00 UTC)." });
  }

  // Transaction patterns
  const timeframeMultiplier = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[timeframe];
  const transactionPatterns = {
    avg_transaction_usd: Math.round((agent.total_spend_usd / Math.max(1, agent.total_verifications)) * 100) / 100,
    total_spend_in_period_usd: Math.round(agent.total_spend_usd * (timeframeMultiplier / 365) * 100) / 100,
    estimated_transaction_count: Math.round(agent.total_verifications * (timeframeMultiplier / 365)),
    peak_activity_hour_utc: Math.floor(Math.random() * 24),
    most_common_action: ["purchase_order", "invoice_approval", "travel_booking", "supplier_search"][Math.floor(Math.random() * 4)],
    actions_per_day_avg: Math.round((agent.total_verifications / 365) * 10) / 10,
  };

  // Risk flags
  const riskFlags = [];
  if (behaviorScore < 40) riskFlags.push("low_behavior_score");
  if (anomalies.length >= 2) riskFlags.push("multiple_anomalies_detected");
  if (agent.total_spend_usd > 1000000) riskFlags.push("high_cumulative_spend");
  if (agent.status !== "active") riskFlags.push(`account_status_${agent.status}`);

  // Peer comparison (simulated)
  const peerAvgScore = 65 + Math.random() * 15;
  const peerComparison = {
    agent_type_avg_score: Math.round(peerAvgScore * 10) / 10,
    percentile: Math.round(Math.max(1, Math.min(99, (behaviorScore / peerAvgScore) * 50))),
    verdict: behaviorScore >= peerAvgScore * 1.1 ? "above_peer_average"
           : behaviorScore >= peerAvgScore * 0.9 ? "within_peer_average"
           : "below_peer_average",
  };

  const scoreId = randomUUID();
  db.prepare(`INSERT OR IGNORE INTO kya_behavior_scores
    (id, agent_id, timeframe, behavior_score, anomalies, transaction_patterns, risk_flags, peer_comparison, fee_charged_usd)
    VALUES (@id, @agent_id, @timeframe, @behavior_score, @anomalies, @transaction_patterns, @risk_flags, @peer_comparison, @fee_charged_usd)
  `).run({
    id: scoreId,
    agent_id: agent.id,
    timeframe,
    behavior_score: behaviorScore,
    anomalies: JSON.stringify(anomalies),
    transaction_patterns: JSON.stringify(transactionPatterns),
    risk_flags: JSON.stringify(riskFlags),
    peer_comparison: JSON.stringify(peerComparison),
    fee_charged_usd: BEHAVIOR_SCORE_FEE,
  });

  return {
    score_id: scoreId,
    agent_id: agent.id,
    claimed_identity: agent.claimed_identity,
    timeframe,
    behavior_score: behaviorScore,
    score_interpretation: behaviorScore >= 80 ? "Excellent — trusted, consistent behavior"
                        : behaviorScore >= 60 ? "Good — standard monitoring recommended"
                        : behaviorScore >= 40 ? "Fair — increased oversight advised"
                        : "Poor — suspend or require re-verification",
    anomalies,
    transaction_patterns: transactionPatterns,
    risk_flags: riskFlags,
    peer_comparison: peerComparison,
    agent_type: agent.agent_type,
    trust_level: agent.trust_level,
    platform_fee_usd: BEHAVIOR_SCORE_FEE,
    scored_at: new Date().toISOString(),
  };
}

// ─── enforceSpendingLimit ─────────────────────────────────────────────────────

/**
 * Check whether a proposed spend is within an agent's configured limits and approve or deny.
 * @param {string} agentId         - Agent ID or claimed identity
 * @param {number} proposedAmount  - Dollar amount of the proposed transaction
 * @param {string} category        - Spend category (e.g. "travel", "software", "procurement")
 * @returns Allow/deny decision with budget details and human approval requirements
 * Platform fee: $0.01/check
 */
export function enforceSpendingLimit(agentId, proposedAmount, category = "general") {
  if (!agentId) throw new Error("agentId is required");
  if (proposedAmount == null || proposedAmount < 0) throw new Error("proposedAmount must be a non-negative number");

  const agent = db.prepare("SELECT * FROM kya_agents WHERE id = ? OR claimed_identity = ?").get(agentId, agentId);

  if (!agent) {
    return {
      enforcement_id: randomUUID(),
      agent_id: agentId,
      proposed_amount_usd: proposedAmount,
      category,
      allowed: false,
      reason: "Agent not registered — all spend blocked for unregistered agents",
      remaining_budget_usd: 0,
      daily_limit_usd: 0,
      category_limit_usd: null,
      requires_human_approval: true,
      platform_fee_usd: SPENDING_LIMIT_CHECK_FEE,
      checked_at: new Date().toISOString(),
    };
  }

  const categoryLimits = JSON.parse(agent.category_limits || "{}");
  const catLimit = categoryLimits[category.toLowerCase()] ?? null;
  const dailyRemaining = Math.max(0, agent.daily_spend_limit_usd - agent.daily_spend_usd);

  const reasons = [];
  if (agent.status !== "active") reasons.push(`agent_${agent.status}`);
  if (proposedAmount > agent.daily_spend_limit_usd) reasons.push(`exceeds_daily_limit_of_$${agent.daily_spend_limit_usd}`);
  if (proposedAmount > dailyRemaining) reasons.push(`only_$${dailyRemaining}_remaining_today`);
  if (catLimit !== null && proposedAmount > catLimit) reasons.push(`exceeds_${category}_category_limit_of_$${catLimit}`);
  if (agent.trust_level === "unverified") reasons.push("unverified_agent_spend_blocked");
  if (agent.trust_level === "low" && proposedAmount > 200) reasons.push("low_trust_agent_capped_at_$200");

  const requiresHumanApproval = proposedAmount > agent.requires_human_approval_above_usd
    || agent.status === "flagged"
    || reasons.length > 0;

  const allowed = reasons.length === 0 && agent.status === "active"
    && proposedAmount <= agent.daily_spend_limit_usd
    && proposedAmount <= dailyRemaining
    && (catLimit === null || proposedAmount <= catLimit);

  // If allowed, simulate updating daily spend
  if (allowed) {
    db.prepare("UPDATE kya_agents SET daily_spend_usd = daily_spend_usd + ?, total_spend_usd = total_spend_usd + ? WHERE id = ?")
      .run(proposedAmount, proposedAmount, agent.id);
  }

  return {
    enforcement_id: randomUUID(),
    agent_id: agent.id,
    claimed_identity: agent.claimed_identity,
    proposed_amount_usd: proposedAmount,
    category,
    allowed,
    reason: allowed
      ? `Transaction approved. $${dailyRemaining - proposedAmount} remaining in daily budget.`
      : `Transaction denied: ${reasons.join("; ")}`,
    remaining_budget_usd: allowed ? Math.max(0, dailyRemaining - proposedAmount) : dailyRemaining,
    daily_limit_usd: agent.daily_spend_limit_usd,
    daily_spend_to_date_usd: allowed ? agent.daily_spend_usd + proposedAmount : agent.daily_spend_usd,
    category_limit_usd: catLimit,
    requires_human_approval: requiresHumanApproval,
    human_approval_threshold_usd: agent.requires_human_approval_above_usd,
    trust_level: agent.trust_level,
    platform_fee_usd: SPENDING_LIMIT_CHECK_FEE,
    checked_at: new Date().toISOString(),
  };
}

// ─── reportSuspiciousAgent ────────────────────────────────────────────────────

/**
 * Submit a report of suspicious agent behavior to the KYA trust network.
 * @param {string} agentId  - ID or identity of the agent being reported
 * @param {string} reason   - Reason for report (e.g. "unauthorized_spend_attempts", "identity_spoofing")
 * @param {Object} evidence - Supporting evidence: {transaction_ids[], screenshots, log_entries[], timestamp_range}
 * @returns Report ID, investigation status, and whether agent has been flagged
 * Platform fee: free (security incentive)
 */
export function reportSuspiciousAgent(agentId, reason, evidence = {}) {
  if (!agentId) throw new Error("agentId is required");
  if (!reason)  throw new Error("reason is required");

  const agent = db.prepare("SELECT * FROM kya_agents WHERE id = ? OR claimed_identity = ?").get(agentId, agentId);

  // Determine severity from reason
  const criticalReasons = ["identity_spoofing", "unauthorized_fund_transfer", "data_exfiltration", "ransomware_activity"];
  const highReasons     = ["repeated_auth_bypass", "privilege_escalation", "api_key_theft", "spend_limit_circumvention"];
  let severity = "medium";
  if (criticalReasons.some(r => reason.toLowerCase().includes(r.replace("_", "")))) severity = "critical";
  else if (highReasons.some(r => reason.toLowerCase().includes(r.replace("_", "")))) severity = "high";
  else if (reason.toLowerCase().includes("unusual") || reason.toLowerCase().includes("minor")) severity = "low";

  const reportId = randomUUID();
  const agentFlagged = severity === "critical" || severity === "high";

  db.prepare(`INSERT OR IGNORE INTO kya_suspicious_reports
    (id, reported_agent_id, reason, evidence, investigation_status, agent_flagged, severity)
    VALUES (@id, @reported_agent_id, @reason, @evidence, @investigation_status, @agent_flagged, @severity)
  `).run({
    id: reportId,
    reported_agent_id: agentId,
    reason,
    evidence: JSON.stringify(evidence),
    investigation_status: severity === "critical" ? "under_review" : "pending",
    agent_flagged: agentFlagged ? 1 : 0,
    severity,
  });

  // Auto-flag agent for critical/high severity
  if (agentFlagged && agent) {
    db.prepare("UPDATE kya_agents SET status = 'flagged' WHERE id = ? AND status = 'active'").run(agent.id);
  }

  return {
    report_id: reportId,
    reported_agent_id: agentId,
    reported_agent_identity: agent?.claimed_identity ?? agentId,
    reason,
    severity,
    evidence_items_submitted: Object.keys(evidence).length,
    investigation_status: severity === "critical" ? "under_review" : "pending",
    estimated_review_time: severity === "critical" ? "Within 1 hour" : severity === "high" ? "Within 4 hours" : "Within 24 hours",
    agent_flagged: agentFlagged,
    agent_suspended_immediately: agentFlagged && agent?.status === "active",
    next_steps: agentFlagged
      ? "Agent has been flagged and activity suspended pending investigation. You will be notified of findings."
      : "Report submitted. Investigation team will review within 24 hours.",
    platform_fee_usd: REPORT_AGENT_FEE,
    thank_you_note: "Thank you for helping maintain trust network integrity. Reports are reviewed by the KYA security team.",
    submitted_at: new Date().toISOString(),
  };
}
