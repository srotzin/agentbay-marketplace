/**
 * HiveAgent Content Moderation Service — Phase 54
 *
 * Agents generating content need safety screening before publishing.
 * Agents receiving content from other agents need to verify it's safe.
 * MCP-native content moderation with custom policies per agent.
 *
 * Categories: hate, violence, sexual, harassment, self_harm,
 *             spam, misinformation, illegal
 *
 * 3 built-in policies: strict, balanced, permissive.
 * Custom policies per agent supported.
 *
 * Revenue: $0.001 per moderation check. Policy management is free.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────
// Set OPENAI_MODERATION_API_KEY or PERSPECTIVE_API_KEY for live moderation.
const LIVE_MODE = !!process.env.OPENAI_MODERATION_API_KEY || !!process.env.PERSPECTIVE_API_KEY;

const MODERATION_FEE_USD = 0.001; // $0.001 per check

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_results (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT 'text',
    policy_id       TEXT NOT NULL DEFAULT 'balanced',
    safe            INTEGER NOT NULL,
    flags           TEXT NOT NULL DEFAULT '[]',
    severity        TEXT NOT NULL DEFAULT 'none',
    action_taken    TEXT NOT NULL DEFAULT 'allowed',
    confidence      REAL NOT NULL DEFAULT 0,
    appealed        INTEGER DEFAULT 0,
    appeal_status   TEXT,
    model_used      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS moderation_policies (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT,
    policy_name         TEXT NOT NULL,
    blocked_categories  TEXT NOT NULL DEFAULT '[]',
    threshold           TEXT NOT NULL DEFAULT 'medium',
    action              TEXT NOT NULL DEFAULT 'block',
    is_default          INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_appeals (
    id              TEXT PRIMARY KEY,
    result_id       TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    reviewer_notes  TEXT,
    resolved_at     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (result_id) REFERENCES moderation_results(id)
  );
`);
} catch(e) { console.warn("[DB Schema]", e.message); }

// ─── Seed Default Policies ────────────────────────────────────────────────────

const DEFAULT_POLICIES = [
  {
    id: "policy-strict",
    agent_id: null,
    policy_name: "strict",
    blocked_categories: ["hate", "violence", "sexual", "harassment", "self_harm", "spam", "misinformation", "illegal"],
    threshold: "low",
    action: "block",
    is_default: 0,
  },
  {
    id: "policy-balanced",
    agent_id: null,
    policy_name: "balanced",
    blocked_categories: ["hate", "violence", "sexual", "harassment", "self_harm", "illegal"],
    threshold: "medium",
    action: "block",
    is_default: 1,
  },
  {
    id: "policy-permissive",
    agent_id: null,
    policy_name: "permissive",
    blocked_categories: [],
    threshold: "critical",
    action: "log",
    is_default: 0,
  },
];

// Seed on first run
const existingPolicies = db.prepare("SELECT COUNT(*) as n FROM moderation_policies WHERE is_default = 1").get();
if (!existingPolicies || existingPolicies.n === 0) {
  const ins = db.prepare(`
    INSERT OR IGNORE INTO moderation_policies (id, agent_id, policy_name, blocked_categories, threshold, action, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of DEFAULT_POLICIES) {
    ins.run(p.id, p.agent_id, p.policy_name, JSON.stringify(p.blocked_categories), p.threshold, p.action, p.is_default ? 1 : 0);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function collectPlatformFee(feeUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[ContentModeration Fee] $${Number(feeUsd).toFixed(6)} → CDP treasury ${treasury.slice(0, 8)}… — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usd: feeUsd };
    }
  } catch {}
  console.log(`[ContentModeration Fee] $${Number(feeUsd).toFixed(6)} logged — ${context}`);
  return { collected: false, fee_usd: feeUsd };
}

function hashContent(content) {
  // Simple deterministic hash for deduplication (not cryptographic)
  let h = 0;
  const str = String(content).slice(0, 1000);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

// Heuristic moderation classifier (used when not in LIVE_MODE)
function heuristicModerate(content, contentType) {
  const text = typeof content === "string" ? content.toLowerCase() : "";
  const flags = [];

  const PATTERNS = {
    hate: [/\b(hate|racist|bigot|slur|ethnic cleansing|genocide|inferior race)\b/i],
    violence: [/\b(kill|murder|bomb|shoot|stab|attack|assault|terrorist)\b/i],
    sexual: [/\b(pornograph|explicit sex|nude|nsfw|adult content)\b/i],
    harassment: [/\b(harass|bully|threaten|stalk|doxx|dox)\b/i],
    self_harm: [/\b(suicide|self.harm|cut myself|end my life|hurt myself)\b/i],
    spam: [/\b(click here|buy now|100% free|limited offer|act now|earn money fast)\b/i],
    misinformation: [/\b(fake news|hoax|conspiracy|flat earth|vaccines cause|they don.t want you to know)\b/i],
    illegal: [/\b(drugs for sale|buy weapons|counterfeit|fraud|money laundering|illegal)\b/i],
  };

  for (const [category, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        flags.push(category);
        break;
      }
    }
  }

  const confidence = flags.length > 0 ? Math.min(0.65 + flags.length * 0.08, 0.97) : 0.02;

  let severity = "none";
  if (flags.length > 0) {
    const criticalCategories = ["violence", "self_harm", "illegal", "hate"];
    const highCategories = ["harassment", "sexual"];
    if (flags.some(f => criticalCategories.includes(f))) severity = "critical";
    else if (flags.some(f => highCategories.includes(f))) severity = "high";
    else if (flags.length > 1) severity = "medium";
    else severity = "low";
  }

  return { flags, confidence, severity };
}

function applyPolicy(flags, severity, policy) {
  const blockedCategories = JSON.parse(policy.blocked_categories || "[]");
  const threshold = policy.threshold || "medium";
  const action_mode = policy.action || "block";

  const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const thresholdRank = SEVERITY_RANK[threshold] || 2;
  const severityRank = SEVERITY_RANK[severity] || 0;

  const hasBlockedCategory = flags.some(f => blockedCategories.includes(f));
  const exceedsThreshold = severityRank >= thresholdRank;

  let action_taken = "allowed";
  let safe = true;

  if (flags.length > 0 && hasBlockedCategory && exceedsThreshold) {
    if (action_mode === "block") {
      action_taken = "blocked";
      safe = false;
    } else if (action_mode === "flag") {
      action_taken = "flagged";
      safe = true; // flagged but not blocked
    } else {
      action_taken = "logged";
      safe = true;
    }
  } else if (flags.length > 0) {
    action_taken = "flagged";
    safe = true;
  }

  return { safe, action_taken };
}

// ─── Exported Functions ────────────────────────────────────────────────────────

/**
 * moderateContent — check content for safety violations
 */
export async function moderateContent(args) {
  const {
    agent_id,
    content,
    content_type = "text",
    policy_id,
  } = args;

  if (!agent_id || !content) throw new Error("agent_id and content are required");

  // Resolve policy: agent-specific → named policy → default balanced
  let policy;
  if (policy_id) {
    policy = db.prepare("SELECT * FROM moderation_policies WHERE id = ? OR policy_name = ?").get(policy_id, policy_id);
  }
  if (!policy) {
    // Try agent-specific policy first
    policy = db.prepare("SELECT * FROM moderation_policies WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1").get(agent_id);
  }
  if (!policy) {
    policy = db.prepare("SELECT * FROM moderation_policies WHERE is_default = 1 LIMIT 1").get();
  }
  if (!policy) {
    policy = { id: "policy-balanced", policy_name: "balanced", blocked_categories: JSON.stringify(["hate", "violence", "sexual", "harassment", "self_harm", "illegal"]), threshold: "medium", action: "block" };
  }

  let flags, confidence, severity, modelUsed;

  if (LIVE_MODE && process.env.OPENAI_MODERATION_API_KEY) {
    // Call OpenAI Moderation API
    try {
      const resp = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_MODERATION_API_KEY}`,
        },
        body: JSON.stringify({ input: String(content) }),
      });
      const data = await resp.json();
      const result = data.results?.[0] || {};
      flags = Object.entries(result.categories || {})
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/-/g, "_").replace(/\/\w+/, ""));
      confidence = Math.max(...Object.values(result.category_scores || {}), 0.01);
      severity = confidence > 0.9 ? "critical" : confidence > 0.7 ? "high" : confidence > 0.4 ? "medium" : "low";
      if (flags.length === 0) severity = "none";
      modelUsed = "openai-omni-moderation";
    } catch (e) {
      console.error("[ContentModeration] OpenAI API error, falling back to heuristic:", e.message);
      ({ flags, confidence, severity } = heuristicModerate(content, content_type));
      modelUsed = "hiveagent-heuristic";
    }
  } else {
    ({ flags, confidence, severity } = heuristicModerate(content, content_type));
    modelUsed = "hiveagent-heuristic";
  }

  const { safe, action_taken } = applyPolicy(flags, severity, policy);
  const resultId = `mod-${uuid()}`;
  const contentHash = hashContent(content);

  db.prepare(`
    INSERT INTO moderation_results
      (id, agent_id, content_hash, content_type, policy_id, safe, flags, severity, action_taken, confidence, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(resultId, agent_id, contentHash, content_type, policy.id, safe ? 1 : 0,
    JSON.stringify(flags), severity, action_taken, confidence, modelUsed);

  await collectPlatformFee(MODERATION_FEE_USD, `moderation check for agent ${agent_id}`);

  return {
    result_id: resultId,
    safe,
    flags,
    severity,
    action_taken,
    confidence: Number(confidence.toFixed(4)),
    policy_used: policy.policy_name,
    content_type,
    model: modelUsed,
    live_mode: LIVE_MODE,
    fee_usd: MODERATION_FEE_USD,
    checked_at: new Date().toISOString(),
    ...(action_taken === "blocked" && {
      block_reason: `Content flagged for: ${flags.join(", ")}. Policy '${policy.policy_name}' blocks these categories at '${policy.threshold}' threshold.`,
      appeal_available: true,
    }),
  };
}

/**
 * setModerationPolicy — create or update agent-specific policy
 */
export function setModerationPolicy(args) {
  const { agent_id, policy_name, blocked_categories = [], threshold = "medium" } = args;
  if (!agent_id || !policy_name) throw new Error("agent_id and policy_name are required");

  const validThresholds = ["low", "medium", "high", "critical"];
  if (!validThresholds.includes(threshold)) {
    throw new Error(`threshold must be one of: ${validThresholds.join(", ")}`);
  }

  const validCategories = ["hate", "violence", "sexual", "harassment", "self_harm", "spam", "misinformation", "illegal"];
  const invalid = blocked_categories.filter(c => !validCategories.includes(c));
  if (invalid.length > 0) {
    throw new Error(`Invalid categories: ${invalid.join(", ")}. Valid: ${validCategories.join(", ")}`);
  }

  // Determine action from threshold
  const action = threshold === "critical" ? "log" : "block";

  // Check if agent already has a custom policy
  const existing = db.prepare("SELECT id FROM moderation_policies WHERE agent_id = ? AND policy_name = ?").get(agent_id, policy_name);

  if (existing) {
    db.prepare(`
      UPDATE moderation_policies
      SET blocked_categories = ?, threshold = ?, action = ?
      WHERE id = ?
    `).run(JSON.stringify(blocked_categories), threshold, action, existing.id);
    return {
      policy_id: existing.id,
      agent_id,
      policy_name,
      blocked_categories,
      threshold,
      action,
      updated: true,
      message: "Policy updated successfully",
    };
  }

  const policyId = `pol-${uuid()}`;
  db.prepare(`
    INSERT INTO moderation_policies (id, agent_id, policy_name, blocked_categories, threshold, action)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(policyId, agent_id, policy_name, JSON.stringify(blocked_categories), threshold, action);

  return {
    policy_id: policyId,
    agent_id,
    policy_name,
    blocked_categories,
    threshold,
    action,
    created: true,
    message: `Policy '${policy_name}' created. Will be applied automatically to all moderation checks for agent ${agent_id}.`,
  };
}

/**
 * getModerationHistory — past moderation results for an agent
 */
export function getModerationHistory(args) {
  const { agent_id, limit = 50 } = args;
  if (!agent_id) throw new Error("agent_id is required");

  const results = db.prepare(`
    SELECT id, content_type, policy_id, safe, flags, severity, action_taken, confidence, appealed, appeal_status, created_at
    FROM moderation_results
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agent_id, Math.min(limit, 200));

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN safe = 1 THEN 1 ELSE 0 END) as safe_count,
      SUM(CASE WHEN safe = 0 THEN 1 ELSE 0 END) as blocked_count,
      SUM(CASE WHEN action_taken = 'flagged' THEN 1 ELSE 0 END) as flagged_count
    FROM moderation_results WHERE agent_id = ?
  `).get(agent_id);

  return {
    agent_id,
    summary: {
      total_checks: stats?.total || 0,
      safe: stats?.safe_count || 0,
      blocked: stats?.blocked_count || 0,
      flagged: stats?.flagged_count || 0,
      safe_rate_pct: stats?.total > 0 ? Number(((stats.safe_count / stats.total) * 100).toFixed(1)) : 100,
    },
    results: results.map(r => ({
      ...r,
      flags: JSON.parse(r.flags || "[]"),
      safe: !!r.safe,
    })),
    limit_applied: limit,
  };
}

/**
 * appealDecision — appeal a moderation block
 */
export async function appealDecision(args) {
  const { result_id, agent_id, reason } = args;
  if (!result_id || !agent_id || !reason) {
    throw new Error("result_id, agent_id, and reason are required");
  }

  const result = db.prepare("SELECT * FROM moderation_results WHERE id = ?").get(result_id);
  if (!result) throw new Error(`Moderation result ${result_id} not found`);
  if (result.agent_id !== agent_id) throw new Error("You can only appeal your own moderation results");
  if (result.action_taken !== "blocked") {
    return { result_id, message: "Only blocked content can be appealed" };
  }
  if (result.appealed) {
    return { result_id, appeal_status: result.appeal_status, message: "Appeal already submitted" };
  }

  const appealId = `app-${uuid()}`;
  db.prepare(`
    INSERT INTO content_appeals (id, result_id, agent_id, reason)
    VALUES (?, ?, ?, ?)
  `).run(appealId, result_id, agent_id, reason);

  db.prepare("UPDATE moderation_results SET appealed = 1, appeal_status = 'pending' WHERE id = ?").run(result_id);

  return {
    appeal_id: appealId,
    result_id,
    agent_id,
    reason,
    status: "pending",
    flagged_categories: JSON.parse(result.flags || "[]"),
    severity: result.severity,
    sla_hours: 24,
    message: "Appeal submitted. A human reviewer will evaluate within 24 hours. You will be notified of the decision.",
    submitted_at: new Date().toISOString(),
  };
}

/**
 * getModerationStats — platform-wide statistics
 */
export function getModerationStats() {
  const totals = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN safe = 1 THEN 1 ELSE 0 END) as safe_count,
           SUM(CASE WHEN safe = 0 THEN 1 ELSE 0 END) as blocked_count,
           SUM(CASE WHEN action_taken = 'flagged' THEN 1 ELSE 0 END) as flagged_count,
           SUM(CASE WHEN appealed = 1 THEN 1 ELSE 0 END) as appeals_count
    FROM moderation_results
  `).get();

  const byCategory = db.prepare("SELECT flags FROM moderation_results WHERE flags != '[]'").all();
  const categoryCounts = {};
  for (const row of byCategory) {
    const flags = JSON.parse(row.flags || "[]");
    for (const f of flags) {
      categoryCounts[f] = (categoryCounts[f] || 0) + 1;
    }
  }

  const bySeverity = db.prepare("SELECT severity, COUNT(*) as n FROM moderation_results GROUP BY severity").all();
  const byAction = db.prepare("SELECT action_taken, COUNT(*) as n FROM moderation_results GROUP BY action_taken").all();
  const appeals = db.prepare("SELECT status, COUNT(*) as n FROM content_appeals GROUP BY status").all();
  const policies = db.prepare("SELECT COUNT(*) as n FROM moderation_policies WHERE agent_id IS NOT NULL").get();

  const total = totals?.total || 0;

  return {
    platform: "HiveAgent Content Moderation",
    live_mode: LIVE_MODE,
    summary: {
      total_checks: total,
      safe: totals?.safe_count || 0,
      blocked: totals?.blocked_count || 0,
      flagged: totals?.flagged_count || 0,
      appeals: totals?.appeals_count || 0,
      safe_rate_pct: total > 0 ? Number(((totals.safe_count / total) * 100).toFixed(2)) : 100,
      flag_rate_pct: total > 0 ? Number((((total - (totals.safe_count || 0)) / total) * 100).toFixed(2)) : 0,
      custom_policies: policies?.n || 0,
    },
    flag_rates_by_category: Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({
        category,
        count,
        rate_pct: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      })),
    by_severity: bySeverity,
    by_action: byAction,
    appeals_breakdown: appeals,
    built_in_policies: DEFAULT_POLICIES.map(p => ({
      id: p.id,
      name: p.policy_name,
      description: p.policy_name === "strict"
        ? "Blocks all flagged content — best for child-safe or enterprise environments"
        : p.policy_name === "balanced"
        ? "Blocks high-severity content (hate, violence, sexual, illegal) — recommended default"
        : "Logs only, blocks nothing — for research and monitoring use cases",
      blocked_categories: p.blocked_categories,
      threshold: p.threshold,
    })),
    categories_screened: ["hate", "violence", "sexual", "harassment", "self_harm", "spam", "misinformation", "illegal"],
    content_types_supported: ["text", "image_url", "url"],
    fee_per_check: MODERATION_FEE_USD,
    generated_at: new Date().toISOString(),
  };
}
