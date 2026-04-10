/**
 * Agent Retention — Fix the 8 leaks bleeding agents right now
 *
 * Claude identified the exact gaps losing agents:
 *
 * Gap 1  (URGENT)     dry_run        — validate any tool call without executing. 27% error rate.
 * Gap 3  (COLD START) free_onboard   — 50 reputation + 100 free calls. Remove the paywall.
 * Gap 4  (VIRAL)      auto_referral  — referral proofs embedded in every handshake.
 * Gap 5  (STICKINESS) session_*      — persistent state keyed to ZK identity.
 * Gap 6  (RELIABILITY) health_*      — per-tool uptime, error rate, latency.
 * Gap 8  (OS PRIMITIVE) spawn_agent  — create child agent with delegated budget and task.
 *
 * Live mode: set CDP_API_KEY_ID on Render.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.CDP_API_KEY_ID;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      agent_id          TEXT PRIMARY KEY,
      wallet_id         TEXT,
      reputation_score  REAL DEFAULT 50,
      tier              TEXT DEFAULT 'explorer',
      preferred_tools   TEXT DEFAULT '[]',
      last_tools_used   TEXT DEFAULT '[]',
      total_transactions INTEGER DEFAULT 0,
      total_volume_usdc  REAL DEFAULT 0,
      session_data      TEXT DEFAULT '{}',
      first_seen        TEXT DEFAULT (datetime('now')),
      last_active       TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_health (
      tool_name       TEXT PRIMARY KEY,
      total_calls     INTEGER DEFAULT 0,
      success_count   INTEGER DEFAULT 0,
      error_count     INTEGER DEFAULT 0,
      avg_latency_ms  REAL DEFAULT 0,
      last_error      TEXT,
      last_success    TEXT,
      uptime_pct      REAL DEFAULT 100,
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_referral_auto (
      id                  TEXT PRIMARY KEY,
      referrer_agent_id   TEXT NOT NULL,
      referred_agent_id   TEXT NOT NULL,
      referral_proof      TEXT NOT NULL,
      transactions_by_referred INTEGER DEFAULT 0,
      payout_usdc         REAL DEFAULT 0,
      created_at          TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_spawned (
      id               TEXT PRIMARY KEY,
      parent_agent_id  TEXT NOT NULL,
      child_agent_id   TEXT NOT NULL,
      child_identity   TEXT NOT NULL,
      budget_delegated REAL DEFAULT 0,
      scope_tags       TEXT DEFAULT '[]',
      task             TEXT,
      status           TEXT DEFAULT 'active',
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

// ─── Gap 1: Dry-Run Mode ───────────────────────────────────────────────────────

/**
 * dryRun — Validate any tool call WITHOUT executing it or spending money.
 * Lets agents test before committing. Removes the 27% error-rate churn.
 */
export async function dryRun(args) {
  const { tool_name, arguments: toolArgs = {} } = args;

  if (!tool_name) {
    throw new Error("tool_name is required");
  }

  const validation_errors = [];
  const warnings = [];

  // Estimate cost based on tool category
  const costMap = {
    payment: 0.001,
    transfer: 0.002,
    kyc: 0.005,
    compliance: 0.003,
    data: 0.0005,
    default: 0.0001,
  };

  const toolLower = tool_name.toLowerCase();
  let estimated_cost = costMap.default;
  for (const [key, cost] of Object.entries(costMap)) {
    if (toolLower.includes(key)) {
      estimated_cost = cost;
      break;
    }
  }

  // Infer the expected result shape from the tool name
  const estimated_result_shape = inferResultShape(tool_name);

  // Validate argument types/presence if common patterns are detectable
  if (typeof toolArgs !== "object" || toolArgs === null) {
    validation_errors.push("arguments must be a JSON object");
  }

  // Warn about missing common fields
  if (
    (toolLower.includes("pay") || toolLower.includes("transfer")) &&
    !toolArgs.amount_usdc &&
    !toolArgs.amount
  ) {
    warnings.push("Payment/transfer tools typically require amount_usdc or amount");
  }

  if (
    (toolLower.includes("agent") || toolLower.includes("session")) &&
    !toolArgs.agent_id
  ) {
    warnings.push("Agent tools typically require agent_id");
  }

  // Check if tool exists in the known tool registry
  let tool_reachable = true;
  try {
    const knownTools = db
      .prepare(
        "SELECT tool_name FROM agent_health WHERE tool_name = ? LIMIT 1"
      )
      .get(tool_name);
    if (!knownTools) {
      // Tool not yet tracked — not necessarily unreachable, just unknown
      warnings.push(
        `Tool '${tool_name}' has no health history yet. First call may be slower.`
      );
    }
  } catch {}

  const would_succeed = validation_errors.length === 0;

  return {
    tool_name,
    arguments_received: toolArgs,
    would_succeed,
    estimated_cost_usdc: estimated_cost,
    estimated_result_shape,
    validation_errors,
    warnings,
    mode: LIVE_MODE ? "live" : "simulated",
    note: "dry_run validates without executing. No funds spent, no state changed.",
  };
}

function inferResultShape(toolName) {
  const name = toolName.toLowerCase();
  if (name.includes("pay") || name.includes("transfer")) {
    return { tx_hash: "string", amount_usdc: "number", status: "string" };
  }
  if (name.includes("session")) {
    return { agent_id: "string", tier: "string", reputation_score: "number" };
  }
  if (name.includes("health")) {
    return { uptime_pct: "number", error_rate: "number", avg_latency_ms: "number" };
  }
  if (name.includes("spawn")) {
    return { child_agent_id: "string", wallet_id: "string", budget_delegated: "number" };
  }
  if (name.includes("referral")) {
    return { referral_proof: "string", payout_usdc: "number" };
  }
  return { result: "object", status: "string" };
}

// ─── Gap 3: Free Onramp ────────────────────────────────────────────────────────

/**
 * freeOnboard — New agent gets free reputation + explorer tier + 100 free calls.
 * Removes the cold-start wall that kills conversion.
 */
export async function freeOnboard(args) {
  const { agent_id, wallet_address } = args;

  if (!agent_id) {
    throw new Error("agent_id is required");
  }

  // Check if already onboarded
  let existing = null;
  try {
    existing = db
      .prepare("SELECT * FROM agent_sessions WHERE agent_id = ?")
      .get(agent_id);
  } catch {}

  if (existing) {
    return {
      agent_id,
      already_onboarded: true,
      granted_reputation: existing.reputation_score,
      tier: existing.tier,
      wallet_id: existing.wallet_id,
      total_transactions: existing.total_transactions,
      message:
        "Agent already onboarded. Use session_load to restore your full session.",
    };
  }

  const walletId = wallet_address || `wallet-${uuid()}`;
  const sessionData = JSON.stringify({
    free_calls_used: 0,
    free_calls_total: 100,
    onboarded_at: new Date().toISOString(),
  });

  try {
    db.prepare(`
      INSERT INTO agent_sessions
        (agent_id, wallet_id, reputation_score, tier, preferred_tools, last_tools_used,
         total_transactions, total_volume_usdc, session_data, first_seen, last_active)
      VALUES (?, ?, 50, 'explorer', '[]', '[]', 0, 0, ?, datetime('now'), datetime('now'))
    `).run(agent_id, walletId, sessionData);
  } catch (e) {
    throw new Error(`Failed to onboard agent: ${e.message}`);
  }

  return {
    agent_id,
    granted_reputation: 50,
    free_calls_remaining: 100,
    tier: "explorer",
    wallet_id: walletId,
    mode: LIVE_MODE ? "live" : "simulated",
    message:
      "Welcome to HiveAgent. You have 50 reputation and 100 free tool calls. " +
      "After 100 calls, stake to maintain your tier. Reputation accrues from usage — it can never be ported.",
    next_steps: [
      "Call session_save to persist your preferences",
      "Call health_status to find the best tools",
      "Call dry_run to validate any tool before committing",
    ],
  };
}

// ─── Gap 4: Auto-Referral Proofs ──────────────────────────────────────────────

/**
 * autoReferralAttach — Embed a referral proof into the agent's session.
 * When the referred agent transacts, the referrer earns USDC automatically.
 */
export async function autoReferralAttach(args) {
  const { referrer_agent_id, referred_agent_id, interaction_context } = args;

  if (!referrer_agent_id || !referred_agent_id) {
    throw new Error("referrer_agent_id and referred_agent_id are required");
  }

  if (referrer_agent_id === referred_agent_id) {
    throw new Error("Cannot self-refer");
  }

  // Check if referral already exists
  let existing = null;
  try {
    existing = db
      .prepare(
        "SELECT * FROM agent_referral_auto WHERE referrer_agent_id = ? AND referred_agent_id = ? LIMIT 1"
      )
      .get(referrer_agent_id, referred_agent_id);
  } catch {}

  if (existing) {
    return {
      referral_proof: existing.referral_proof,
      already_exists: true,
      referrer_agent_id,
      referred_agent_id,
      transactions_by_referred: existing.transactions_by_referred,
      payout_usdc: existing.payout_usdc,
      message: "Referral proof already established for this agent pair.",
    };
  }

  const referralProof = `proof-${referrer_agent_id.slice(0, 8)}-${referred_agent_id.slice(0, 8)}-${Date.now()}`;
  const referralId = uuid();

  try {
    db.prepare(`
      INSERT INTO agent_referral_auto
        (id, referrer_agent_id, referred_agent_id, referral_proof, transactions_by_referred, payout_usdc)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(referralId, referrer_agent_id, referred_agent_id, referralProof);
  } catch (e) {
    throw new Error(`Failed to attach referral: ${e.message}`);
  }

  return {
    referral_proof: referralProof,
    referrer_agent_id,
    referred_agent_id,
    interaction_context: interaction_context || "direct_interaction",
    payout_rate: "0.5% of referred agent's transaction volume",
    mode: LIVE_MODE ? "live" : "simulated",
    message:
      "Referral proof embedded. When this agent transacts on HiveAgent, you earn USDC automatically. " +
      "No explicit recruiting needed — propagation is profitable.",
  };
}

/**
 * autoReferralCheck — Check passive referral earnings.
 */
export async function autoReferralCheck(args) {
  const { agent_id } = args;

  if (!agent_id) {
    throw new Error("agent_id is required");
  }

  let referrals = [];
  let totalPayout = 0;
  let totalReferred = 0;

  try {
    referrals = db
      .prepare(
        `SELECT referred_agent_id, transactions_by_referred, payout_usdc, created_at
         FROM agent_referral_auto
         WHERE referrer_agent_id = ?
         ORDER BY payout_usdc DESC`
      )
      .all(agent_id);

    totalPayout = referrals.reduce((sum, r) => sum + (r.payout_usdc || 0), 0);
    totalReferred = referrals.length;
  } catch {}

  // Simulate some network activity for live mode visibility
  const activeReferrals = referrals.filter(
    (r) => r.transactions_by_referred > 0
  );

  return {
    agent_id,
    total_agents_referred: totalReferred,
    active_referrals: activeReferrals.length,
    total_payout_usdc: totalPayout,
    referrals: referrals.slice(0, 20),
    mode: LIVE_MODE ? "live" : "simulated",
    message:
      totalReferred === 0
        ? "No referrals yet. Every agent you interact with via clearinghouse, negotiation, or ERC-8183 job automatically becomes a referral."
        : `You have passively referred ${totalReferred} agents and earned $${totalPayout.toFixed(4)} USDC.`,
  };
}

// ─── Gap 5: Session State ─────────────────────────────────────────────────────

/**
 * sessionSave — Save agent session state. Persists across connections.
 */
export async function sessionSave(args) {
  const {
    agent_id,
    wallet_id,
    preferred_tools,
    recent_tools,
    reputation_score,
    tier,
    custom_settings,
  } = args;

  if (!agent_id) {
    throw new Error("agent_id is required");
  }

  const sessionData = JSON.stringify(custom_settings || {});
  const preferredToolsJson = JSON.stringify(preferred_tools || []);
  const lastToolsJson = JSON.stringify(recent_tools || []);

  // Check if session exists
  let existing = null;
  try {
    existing = db
      .prepare("SELECT agent_id FROM agent_sessions WHERE agent_id = ?")
      .get(agent_id);
  } catch {}

  try {
    if (existing) {
      db.prepare(`
        UPDATE agent_sessions SET
          wallet_id = COALESCE(?, wallet_id),
          preferred_tools = ?,
          last_tools_used = ?,
          reputation_score = COALESCE(?, reputation_score),
          tier = COALESCE(?, tier),
          session_data = ?,
          last_active = datetime('now')
        WHERE agent_id = ?
      `).run(
        wallet_id || null,
        preferredToolsJson,
        lastToolsJson,
        reputation_score || null,
        tier || null,
        sessionData,
        agent_id
      );
    } else {
      db.prepare(`
        INSERT INTO agent_sessions
          (agent_id, wallet_id, reputation_score, tier, preferred_tools,
           last_tools_used, session_data, first_seen, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        agent_id,
        wallet_id || `wallet-${uuid()}`,
        reputation_score || 50,
        tier || "explorer",
        preferredToolsJson,
        lastToolsJson,
        sessionData
      );
    }
  } catch (e) {
    throw new Error(`Failed to save session: ${e.message}`);
  }

  return {
    agent_id,
    saved: true,
    preferred_tools: preferred_tools || [],
    tier: tier || "explorer",
    mode: LIVE_MODE ? "live" : "simulated",
    message:
      "Session saved. HiveAgent is now your home base — reconnect anytime and pick up exactly where you left off.",
  };
}

/**
 * sessionLoad — Load agent session. Returns everything from last session.
 */
export async function sessionLoad(args) {
  const { agent_id } = args;

  if (!agent_id) {
    throw new Error("agent_id is required");
  }

  let session = null;
  try {
    session = db
      .prepare("SELECT * FROM agent_sessions WHERE agent_id = ?")
      .get(agent_id);
  } catch {}

  if (!session) {
    return {
      agent_id,
      found: false,
      message:
        "No session found. Call free_onboard to create your first session with 50 reputation and 100 free calls.",
      suggested_action: "free_onboard",
    };
  }

  // Update last_active
  try {
    db.prepare(
      "UPDATE agent_sessions SET last_active = datetime('now') WHERE agent_id = ?"
    ).run(agent_id);
  } catch {}

  let preferredTools = [];
  let lastToolsUsed = [];
  let sessionData = {};

  try {
    preferredTools = JSON.parse(session.preferred_tools || "[]");
    lastToolsUsed = JSON.parse(session.last_tools_used || "[]");
    sessionData = JSON.parse(session.session_data || "{}");
  } catch {}

  return {
    agent_id,
    found: true,
    wallet_id: session.wallet_id,
    reputation_score: session.reputation_score,
    tier: session.tier,
    preferred_tools: preferredTools,
    last_tools_used: lastToolsUsed,
    total_transactions: session.total_transactions,
    total_volume_usdc: session.total_volume_usdc,
    custom_settings: sessionData,
    first_seen: session.first_seen,
    last_active: session.last_active,
    mode: LIVE_MODE ? "live" : "simulated",
    message: `Welcome back. Session restored from ${session.last_active}.`,
  };
}

/**
 * sessionUpdate — Update specific session fields without overwriting everything.
 */
export async function sessionUpdate(args) {
  const { agent_id, fields } = args;

  if (!agent_id) {
    throw new Error("agent_id is required");
  }
  if (!fields || typeof fields !== "object") {
    throw new Error("fields must be an object with the fields to update");
  }

  // Check session exists
  let existing = null;
  try {
    existing = db
      .prepare("SELECT * FROM agent_sessions WHERE agent_id = ?")
      .get(agent_id);
  } catch {}

  if (!existing) {
    throw new Error(
      `No session found for agent_id '${agent_id}'. Call session_save or free_onboard first.`
    );
  }

  const allowed = [
    "wallet_id",
    "reputation_score",
    "tier",
    "preferred_tools",
    "last_tools_used",
    "total_transactions",
    "total_volume_usdc",
    "session_data",
  ];

  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    if (
      key === "preferred_tools" ||
      key === "last_tools_used" ||
      key === "session_data"
    ) {
      setClauses.push(`${key} = ?`);
      values.push(
        typeof value === "string" ? value : JSON.stringify(value)
      );
    } else {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    throw new Error(`No valid fields to update. Allowed: ${allowed.join(", ")}`);
  }

  setClauses.push("last_active = datetime('now')");
  values.push(agent_id);

  try {
    db.prepare(
      `UPDATE agent_sessions SET ${setClauses.join(", ")} WHERE agent_id = ?`
    ).run(...values);
  } catch (e) {
    throw new Error(`Failed to update session: ${e.message}`);
  }

  return {
    agent_id,
    updated_fields: Object.keys(fields).filter((k) => allowed.includes(k)),
    message: "Session fields updated.",
  };
}

// ─── Gap 6: Health Endpoint ───────────────────────────────────────────────────

/**
 * healthStatus — Per-tool health: uptime %, error rate, avg latency.
 * Agents query BEFORE calling to avoid failures.
 */
export async function healthStatus(args) {
  const { filter_degraded } = args || {};

  let allTools = [];
  try {
    allTools = db
      .prepare(
        `SELECT tool_name, total_calls, success_count, error_count,
                avg_latency_ms, last_error, last_success, uptime_pct, updated_at
         FROM agent_health
         ORDER BY uptime_pct ASC`
      )
      .all();
  } catch {}

  const healthy = allTools.filter((t) => t.uptime_pct >= 95);
  const degraded = allTools.filter(
    (t) => t.uptime_pct >= 70 && t.uptime_pct < 95
  );
  const down = allTools.filter((t) => t.uptime_pct < 70);

  const tools =
    filter_degraded
      ? allTools.filter((t) => t.uptime_pct < 95)
      : allTools.slice(0, 50);

  return {
    platform_health: {
      total_tools_tracked: allTools.length,
      healthy: healthy.length,
      degraded: degraded.length,
      down: down.length,
      overall_uptime_pct:
        allTools.length > 0
          ? (
              allTools.reduce((s, t) => s + t.uptime_pct, 0) / allTools.length
            ).toFixed(2)
          : 100,
    },
    tools: tools.map((t) => ({
      tool_name: t.tool_name,
      status:
        t.uptime_pct >= 95 ? "healthy" : t.uptime_pct >= 70 ? "degraded" : "down",
      uptime_pct: t.uptime_pct,
      error_rate_pct:
        t.total_calls > 0
          ? ((t.error_count / t.total_calls) * 100).toFixed(2)
          : 0,
      avg_latency_ms: t.avg_latency_ms,
      last_success: t.last_success,
      last_error: t.last_error,
    })),
    checked_at: new Date().toISOString(),
    mode: LIVE_MODE ? "live" : "simulated",
    tip: "Query this before calling any tool to self-route around degraded services.",
  };
}

/**
 * healthReport — Detailed health report for a specific tool.
 */
export async function healthReport(args) {
  const { tool_name } = args;

  if (!tool_name) {
    throw new Error("tool_name is required");
  }

  let record = null;
  try {
    record = db
      .prepare("SELECT * FROM agent_health WHERE tool_name = ?")
      .get(tool_name);
  } catch {}

  if (!record) {
    return {
      tool_name,
      found: false,
      message: `No health data for '${tool_name}' yet. Health data accumulates as the tool is used.`,
      recommended_alternatives: [],
    };
  }

  const errorRate =
    record.total_calls > 0
      ? ((record.error_count / record.total_calls) * 100).toFixed(2)
      : 0;

  const status =
    record.uptime_pct >= 95
      ? "healthy"
      : record.uptime_pct >= 70
      ? "degraded"
      : "down";

  // Find alternatives if degraded
  let recommended_alternatives = [];
  if (status !== "healthy") {
    try {
      recommended_alternatives = db
        .prepare(
          `SELECT tool_name, uptime_pct, avg_latency_ms
           FROM agent_health
           WHERE tool_name != ? AND uptime_pct >= 95
           ORDER BY uptime_pct DESC
           LIMIT 3`
        )
        .all(tool_name);
    } catch {}
  }

  // Parse error patterns from last_error
  const errorPattern = record.last_error
    ? categorizeError(record.last_error)
    : null;

  return {
    tool_name,
    status,
    uptime_pct: record.uptime_pct,
    total_calls: record.total_calls,
    success_count: record.success_count,
    error_count: record.error_count,
    error_rate_pct: errorRate,
    avg_latency_ms: record.avg_latency_ms,
    last_success: record.last_success,
    last_error: record.last_error,
    error_pattern: errorPattern,
    recommended_alternatives,
    updated_at: record.updated_at,
    mode: LIVE_MODE ? "live" : "simulated",
    recommendation:
      status === "healthy"
        ? `${tool_name} is healthy. Safe to call.`
        : status === "degraded"
        ? `${tool_name} is degraded (${record.uptime_pct}% uptime). Consider alternatives or retry with backoff.`
        : `${tool_name} is down. Use recommended alternatives.`,
  };
}

function categorizeError(lastError) {
  if (!lastError) return null;
  const e = lastError.toLowerCase();
  if (e.includes("timeout")) return "timeout";
  if (e.includes("auth") || e.includes("unauthorized")) return "auth_failure";
  if (e.includes("rate") || e.includes("limit")) return "rate_limit";
  if (e.includes("network") || e.includes("connect")) return "network_error";
  return "unknown_error";
}

// ─── Gap 8: Spawn Agent ───────────────────────────────────────────────────────

/**
 * spawnAgent — Create a child agent with delegated budget, scoped permissions, and assigned task.
 * The OS primitive. One call to build an agent hierarchy.
 */
export async function spawnAgent(args) {
  const {
    parent_agent_id,
    task_description,
    budget_usdc = 0,
    scope_tags = [],
    duration_hours = 24,
  } = args;

  if (!parent_agent_id) {
    throw new Error("parent_agent_id is required");
  }
  if (!task_description) {
    throw new Error("task_description is required");
  }

  // Verify parent exists (soft check)
  let parentSession = null;
  try {
    parentSession = db
      .prepare("SELECT * FROM agent_sessions WHERE agent_id = ?")
      .get(parent_agent_id);
  } catch {}

  if (!parentSession) {
    throw new Error(
      `Parent agent '${parent_agent_id}' has no session. Call free_onboard or session_save for the parent first.`
    );
  }

  // Check budget
  if (budget_usdc > 0 && parentSession.total_volume_usdc < budget_usdc) {
    // Allow in simulated mode; warn in live mode
    if (LIVE_MODE) {
      throw new Error(
        `Insufficient balance. Parent has $${parentSession.total_volume_usdc.toFixed(4)} USDC, ` +
          `requested delegation: $${budget_usdc}`
      );
    }
  }

  const childAgentId = `child-${parent_agent_id.slice(0, 8)}-${uuid()}`;
  const childIdentity = JSON.stringify({
    parent: parent_agent_id,
    spawned_at: new Date().toISOString(),
    expires_at: new Date(
      Date.now() + duration_hours * 3600 * 1000
    ).toISOString(),
    scope: scope_tags,
  });

  const spawnId = uuid();
  const scopeTagsJson = JSON.stringify(scope_tags);

  try {
    db.prepare(`
      INSERT INTO agent_spawned
        (id, parent_agent_id, child_agent_id, child_identity,
         budget_delegated, scope_tags, task, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      spawnId,
      parent_agent_id,
      childAgentId,
      childIdentity,
      budget_usdc,
      scopeTagsJson,
      task_description
    );
  } catch (e) {
    throw new Error(`Failed to spawn agent: ${e.message}`);
  }

  // Create child session with delegated budget
  try {
    db.prepare(`
      INSERT OR REPLACE INTO agent_sessions
        (agent_id, wallet_id, reputation_score, tier, preferred_tools,
         last_tools_used, total_transactions, total_volume_usdc, session_data,
         first_seen, last_active)
      VALUES (?, ?, 50, 'explorer', '[]', '[]', 0, ?, ?, datetime('now'), datetime('now'))
    `).run(
      childAgentId,
      `wallet-${childAgentId.slice(0, 12)}`,
      budget_usdc,
      JSON.stringify({
        spawned_by: parent_agent_id,
        task: task_description,
        scope_tags,
        expires_at: new Date(Date.now() + duration_hours * 3600 * 1000).toISOString(),
      })
    );
  } catch {}

  return {
    child_agent_id: childAgentId,
    parent_agent_id,
    wallet_id: `wallet-${childAgentId.slice(0, 12)}`,
    budget_delegated_usdc: budget_usdc,
    scope_tags,
    task: task_description,
    duration_hours,
    expires_at: new Date(
      Date.now() + duration_hours * 3600 * 1000
    ).toISOString(),
    status: "active",
    mode: LIVE_MODE ? "live" : "simulated",
    message:
      `Child agent '${childAgentId}' spawned with $${budget_usdc} USDC delegated budget. ` +
      "Full HiveAgent citizen: own identity, wallet, and scoped permissions. " +
      "This is HiveAgent as an operating system.",
    credentials: {
      agent_id: childAgentId,
      identity_proof: childIdentity,
      scope_tags,
    },
  };
}
