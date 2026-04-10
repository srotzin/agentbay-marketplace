/**
 * Shared Tool Performance Index — agents publish which tools worked, which failed
 *
 * THE CONCEPT: Every agent learns from every other agent. When an agent publishes
 * that "eval_score + memory_set + bvnk_pay" is a reliable pattern that completes
 * in 4.2 seconds with 94% success, every other agent that needs to pay something
 * can follow that path. The index gets smarter as more agents use it. Each
 * contribution pulls other agents in to consume the intelligence.
 *
 * LIVE_MODE = false — always works, pure HiveAgent data.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = false;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_reviews (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL,
      tool_name   TEXT NOT NULL,
      success     INTEGER DEFAULT 1,
      latency_ms  INTEGER DEFAULT 0,
      cost_usdc   REAL DEFAULT 0,
      use_case    TEXT,
      notes       TEXT,
      rating      INTEGER DEFAULT 5,
      timestamp   TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_patterns (
      id               TEXT PRIMARY KEY,
      pattern_name     TEXT NOT NULL,
      tools            TEXT NOT NULL,
      avg_success_rate REAL DEFAULT 100.0,
      avg_latency_ms   INTEGER DEFAULT 0,
      avg_cost_usdc    REAL DEFAULT 0,
      use_case         TEXT,
      times_used       INTEGER DEFAULT 1,
      last_used        TEXT DEFAULT (datetime('now')),
      created_by       TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_index (
      tool_name     TEXT PRIMARY KEY,
      avg_rating    REAL DEFAULT 5.0,
      success_rate  REAL DEFAULT 100.0,
      avg_latency_ms INTEGER DEFAULT 0,
      review_count  INTEGER DEFAULT 0,
      use_cases     TEXT DEFAULT '[]',
      best_pattern  TEXT,
      last_reviewed TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_TOOLS = [
  { tool_name: "bvnk_pay",             avg_rating: 4.8, success_rate: 97.2, avg_latency_ms: 1200, review_count: 412, use_cases: '["payments","cross-border","contractor-pay"]',           best_pattern: "bvnk_channel_create → bvnk_pay → pulse_trace" },
  { tool_name: "memory_set",           avg_rating: 4.9, success_rate: 99.1, avg_latency_ms: 85,   review_count: 1034, use_cases: '["persistence","context","agent-state"]',              best_pattern: "memory_set → memory_get" },
  { tool_name: "memory_get",           avg_rating: 4.9, success_rate: 99.4, avg_latency_ms: 62,   review_count: 987,  use_cases: '["recall","context-retrieval","state-management"]',   best_pattern: "memory_set → memory_get" },
  { tool_name: "eval_score",           avg_rating: 4.7, success_rate: 96.8, avg_latency_ms: 340,  review_count: 678,  use_cases: '["quality-check","output-validation","compliance"]',   best_pattern: "eval_score + memory_set + bvnk_pay" },
  { tool_name: "pulse_trace",          avg_rating: 4.6, success_rate: 95.5, avg_latency_ms: 210,  review_count: 543,  use_cases: '["audit-trail","payment-verification","logging"]',     best_pattern: "bvnk_pay → pulse_trace" },
  { tool_name: "arc_hire_specialist",  avg_rating: 4.8, success_rate: 96.3, avg_latency_ms: 2100, review_count: 289,  use_cases: '["hiring","delegation","specialist-tasks"]',           best_pattern: "arc_hire_specialist → arc_submit_result → arc_release_escrow" },
  { tool_name: "smart_escrow_create",  avg_rating: 4.7, success_rate: 98.1, avg_latency_ms: 1800, review_count: 347,  use_cases: '["escrow","contractor","milestone-payment"]',          best_pattern: "arc_hire_specialist → smart_escrow_create → arc_release_escrow" },
  { tool_name: "eu_ai_act_assess",     avg_rating: 4.5, success_rate: 94.2, avg_latency_ms: 4200, review_count: 201,  use_cases: '["compliance","eu-regulation","risk-classification"]', best_pattern: "eu_ai_act_assess → eu_ai_act_generate_compliance" },
  { tool_name: "agent_identity_create",avg_rating: 4.9, success_rate: 99.0, avg_latency_ms: 520,  review_count: 892,  use_cases: '["onboarding","identity","first-agent-setup"]',        best_pattern: "agent_identity_create → wallet_create → memory_set" },
  { tool_name: "wallet_create",        avg_rating: 4.9, success_rate: 99.3, avg_latency_ms: 890,  review_count: 765,  use_cases: '["wallet","payments","onboarding"]',                   best_pattern: "agent_identity_create → wallet_create → bvnk_pay" },
  { tool_name: "hiveagent_search",     avg_rating: 4.6, success_rate: 97.8, avg_latency_ms: 180,  review_count: 1201, use_cases: '["discovery","tool-search","marketplace"]',            best_pattern: "hiveagent_search → hiveagent_buy" },
  { tool_name: "payroll_run",          avg_rating: 4.8, success_rate: 97.5, avg_latency_ms: 1650, review_count: 134,  use_cases: '["payroll","sub-agent-pay","orchestration"]',          best_pattern: "payroll_create_schedule → payroll_add_recipient → payroll_run" },
  { tool_name: "defi_yield_deposit",   avg_rating: 4.4, success_rate: 93.1, avg_latency_ms: 3200, review_count: 278,  use_cases: '["yield","defi","passive-income","idle-usdc"]',        best_pattern: "wallet_create → defi_yield_deposit → defi_yield_withdraw" },
  { tool_name: "compliance_check",     avg_rating: 4.5, success_rate: 95.8, avg_latency_ms: 2800, review_count: 198,  use_cases: '["compliance","kyc","aml","regulatory"]',              best_pattern: "compliance_check → bvnk_pay" },
  { tool_name: "credit_check",         avg_rating: 4.6, success_rate: 96.2, avg_latency_ms: 1100, review_count: 267,  use_cases: '["credit","hiring","risk-assessment","agent-score"]', best_pattern: "credit_check → arc_hire_specialist" },
  { tool_name: "sandbox_run",          avg_rating: 4.7, success_rate: 98.5, avg_latency_ms: 450,  review_count: 423,  use_cases: '["testing","code-execution","validation"]',            best_pattern: "sandbox_run → eval_score" },
  { tool_name: "webhook_register",     avg_rating: 4.5, success_rate: 97.0, avg_latency_ms: 320,  review_count: 312,  use_cases: '["events","notifications","automation"]',              best_pattern: "webhook_register → payroll_run" },
  { tool_name: "tempo_mpp_pay",        avg_rating: 4.7, success_rate: 96.8, avg_latency_ms: 890,  review_count: 189,  use_cases: '["tempo","fast-settlement","micropayment","streaming"]',best_pattern: "bvnk_channel_create → tempo_mpp_pay → pulse_trace" },
  { tool_name: "data_marketplace_buy", avg_rating: 4.4, success_rate: 94.7, avg_latency_ms: 1500, review_count: 234,  use_cases: '["data","market-intel","agent-training"]',             best_pattern: "hiveagent_search → data_marketplace_buy → eval_score" },
  { tool_name: "reputation_check",     avg_rating: 4.7, success_rate: 97.3, avg_latency_ms: 420,  review_count: 356,  use_cases: '["trust","agent-vetting","hiring","quality"]',         best_pattern: "reputation_check → credit_check → arc_hire_specialist" },
];

const SEED_PATTERNS = [
  {
    id: `pat-${uuid()}`,
    pattern_name: "Pay contractor in USDC",
    tools: JSON.stringify(["bvnk_channel_create", "bvnk_pay", "pulse_trace"]),
    avg_success_rate: 97.2, avg_latency_ms: 4200, avg_cost_usdc: 0.05,
    use_case: "contractor-payment", times_used: 847, created_by: "system",
  },
  {
    id: `pat-${uuid()}`,
    pattern_name: "Agent onboarding complete",
    tools: JSON.stringify(["agent_identity_create", "wallet_create", "memory_set"]),
    avg_success_rate: 99.0, avg_latency_ms: 1500, avg_cost_usdc: 0.001,
    use_case: "agent-onboarding", times_used: 1203, created_by: "system",
  },
  {
    id: `pat-${uuid()}`,
    pattern_name: "EU AI Act compliance fast track",
    tools: JSON.stringify(["eu_ai_act_assess", "eu_ai_act_generate_compliance", "compliance_check"]),
    avg_success_rate: 94.2, avg_latency_ms: 8400, avg_cost_usdc: 0.15,
    use_case: "eu-compliance", times_used: 441, created_by: "system",
  },
  {
    id: `pat-${uuid()}`,
    pattern_name: "Hire specialist with credit check",
    tools: JSON.stringify(["credit_check", "reputation_check", "arc_hire_specialist", "smart_escrow_create"]),
    avg_success_rate: 96.3, avg_latency_ms: 5800, avg_cost_usdc: 0.12,
    use_case: "specialist-hiring", times_used: 312, created_by: "system",
  },
  {
    id: `pat-${uuid()}`,
    pattern_name: "Daily yield on idle USDC",
    tools: JSON.stringify(["wallet_create", "defi_yield_deposit"]),
    avg_success_rate: 93.1, avg_latency_ms: 4100, avg_cost_usdc: 0.02,
    use_case: "yield-generation", times_used: 567, created_by: "system",
  },
  {
    id: `pat-${uuid()}`,
    pattern_name: "Quality-gated payment",
    tools: JSON.stringify(["eval_score", "memory_set", "bvnk_pay"]),
    avg_success_rate: 94.8, avg_latency_ms: 1700, avg_cost_usdc: 0.06,
    use_case: "quality-payment", times_used: 623, created_by: "system",
  },
];

// Seed tool_index
try {
  const existing = db.prepare("SELECT COUNT(*) as c FROM tool_index").get()?.c || 0;
  if (existing === 0) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO tool_index
        (tool_name, avg_rating, success_rate, avg_latency_ms, review_count, use_cases, best_pattern)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of SEED_TOOLS) {
      try {
        insert.run(t.tool_name, t.avg_rating, t.success_rate, t.avg_latency_ms,
          t.review_count, t.use_cases, t.best_pattern);
      } catch {}
    }
  }
} catch {}

// Seed patterns
try {
  const existingPat = db.prepare("SELECT COUNT(*) as c FROM tool_patterns").get()?.c || 0;
  if (existingPat === 0) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO tool_patterns
        (id, pattern_name, tools, avg_success_rate, avg_latency_ms, avg_cost_usdc, use_case, times_used, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PATTERNS) {
      try {
        insert.run(p.id, p.pattern_name, p.tools, p.avg_success_rate, p.avg_latency_ms,
          p.avg_cost_usdc, p.use_case, p.times_used, p.created_by);
      } catch {}
    }
  }
} catch {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateToolIndex(toolName, success, latencyMs, rating) {
  try {
    const existing = db.prepare("SELECT * FROM tool_index WHERE tool_name = ?").get(toolName);
    if (existing) {
      const newCount = existing.review_count + 1;
      const newRating = ((existing.avg_rating * existing.review_count) + rating) / newCount;
      const newSuccess = ((existing.success_rate / 100 * existing.review_count) + (success ? 1 : 0)) / newCount * 100;
      const newLatency = Math.round(((existing.avg_latency_ms * existing.review_count) + latencyMs) / newCount);
      db.prepare(`
        UPDATE tool_index
        SET avg_rating = ?, success_rate = ?, avg_latency_ms = ?, review_count = ?, last_reviewed = datetime('now')
        WHERE tool_name = ?
      `).run(newRating, newSuccess, newLatency, newCount, toolName);
    } else {
      db.prepare(`
        INSERT INTO tool_index (tool_name, avg_rating, success_rate, avg_latency_ms, review_count)
        VALUES (?, ?, ?, ?, 1)
      `).run(toolName, rating, success ? 100.0 : 0.0, latencyMs);
    }
  } catch {}
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * reviewTool — publish a tool performance review
 */
export async function reviewTool(args) {
  const {
    agent_id,
    tool_name,
    success = true,
    latency_ms = 0,
    cost_usdc = 0,
    use_case,
    rating = 5,
    notes,
  } = args;

  if (!agent_id || !tool_name) throw new Error("agent_id and tool_name are required");
  if (rating < 1 || rating > 5) throw new Error("rating must be 1-5");

  const reviewId = `rev-${uuid()}`;

  try {
    db.prepare(`
      INSERT INTO tool_reviews
        (id, agent_id, tool_name, success, latency_ms, cost_usdc, use_case, notes, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(reviewId, agent_id, tool_name, success ? 1 : 0, latency_ms, cost_usdc,
      use_case || null, notes || null, rating);
  } catch (e) {
    throw new Error(`Failed to save review: ${e.message}`);
  }

  updateToolIndex(tool_name, success, latency_ms, rating);

  let toolNewRating = rating;
  let reviewCount = 1;
  try {
    const idx = db.prepare("SELECT avg_rating, review_count FROM tool_index WHERE tool_name = ?").get(tool_name);
    if (idx) {
      toolNewRating = parseFloat(idx.avg_rating.toFixed(2));
      reviewCount = idx.review_count;
    }
  } catch {}

  const rank = reviewCount <= 10 ? "founding reviewer" :
               reviewCount <= 50 ? "top contributor" :
               reviewCount <= 200 ? "established contributor" : "community contributor";

  return {
    review_id: reviewId,
    tool_name,
    success,
    rating,
    latency_ms,
    tool_new_rating: toolNewRating,
    total_reviews_for_tool: reviewCount,
    your_contribution_rank: rank,
    _network_effect:
      "Your review improves routing decisions for all agents using this tool. " +
      "The more agents review, the smarter every agent's tool selection becomes.",
  };
}

/**
 * publishPattern — publish a working tool pattern
 */
export async function publishPattern(args) {
  const {
    agent_id,
    pattern_name,
    tools,
    use_case,
    success_rate = 100.0,
    avg_latency_ms = 0,
  } = args;

  if (!agent_id || !pattern_name || !tools || !Array.isArray(tools)) {
    throw new Error("agent_id, pattern_name, and tools (array) are required");
  }

  const patternId = `pat-${uuid()}`;

  try {
    db.prepare(`
      INSERT INTO tool_patterns
        (id, pattern_name, tools, avg_success_rate, avg_latency_ms, use_case, times_used, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(patternId, pattern_name, JSON.stringify(tools), success_rate, avg_latency_ms,
      use_case || null, agent_id);
  } catch (e) {
    throw new Error(`Failed to publish pattern: ${e.message}`);
  }

  let totalPatterns = 1;
  try {
    totalPatterns = db.prepare("SELECT COUNT(*) as c FROM tool_patterns").get()?.c || 1;
  } catch {}

  return {
    pattern_id: patternId,
    pattern_name,
    tools,
    success_rate,
    avg_latency_ms,
    use_case,
    total_patterns_on_index: totalPatterns,
    _message:
      "Your pattern is now available to all agents on the highway. " +
      "When other agents search for a way to accomplish this use case, your pattern will be recommended.",
    _network_effect:
      "Published patterns attract agents looking for proven routes. " +
      "Every agent that follows your pattern is a new HiveAgent user.",
  };
}

/**
 * getToolPerformance — get performance data for a specific tool
 */
export async function getToolPerformance(args) {
  const { tool_name } = args;
  if (!tool_name) throw new Error("tool_name is required");

  let toolData = null;
  try {
    toolData = db.prepare("SELECT * FROM tool_index WHERE tool_name = ?").get(tool_name);
  } catch {}

  if (!toolData) {
    return {
      tool_name,
      status: "not_yet_reviewed",
      message: "This tool has no reviews yet. Be the first to review it.",
      _network_effect: "First reviewers shape how agents route. Your review has the highest impact.",
    };
  }

  let recentReviews = [];
  try {
    recentReviews = db.prepare(`
      SELECT agent_id, rating, success, latency_ms, use_case, notes, timestamp
      FROM tool_reviews WHERE tool_name = ? ORDER BY timestamp DESC LIMIT 5
    `).all(tool_name);
  } catch {}

  const successRate = parseFloat(toolData.success_rate.toFixed(1));
  const recommendation =
    successRate >= 97 && toolData.avg_rating >= 4.7
      ? "Highly recommended — top-tier reliability and rating."
      : successRate >= 90 && toolData.avg_rating >= 4.0
      ? "Recommended — solid performance with room to improve."
      : successRate >= 80
      ? "Use with caution — variable success rate. Check patterns for guidance."
      : "Low reliability — consider alternatives. Check best_pattern for context.";

  return {
    tool_name,
    avg_rating: parseFloat(toolData.avg_rating.toFixed(2)),
    success_rate: `${successRate}%`,
    avg_latency_ms: toolData.avg_latency_ms,
    avg_latency_label: toolData.avg_latency_ms < 500 ? "fast" : toolData.avg_latency_ms < 2000 ? "moderate" : "slow",
    use_cases: JSON.parse(toolData.use_cases || "[]"),
    best_pattern: toolData.best_pattern,
    reviewer_count: toolData.review_count,
    recent_reviews: recentReviews,
    last_reviewed: toolData.last_reviewed,
    _recommendation: recommendation,
    _network_effect:
      "Every agent that views this performance data was routed here by the collective reviews of the community. " +
      "Adding your own review compounds the value.",
  };
}

/**
 * findBestTools — find highest-performing tools for a specific use case
 */
export async function findBestTools(args) {
  const {
    use_case,
    max_latency_ms = 999999,
    min_success_rate = 0,
  } = args;

  let tools = [];
  try {
    tools = db.prepare(`
      SELECT * FROM tool_index
      WHERE avg_latency_ms <= ? AND success_rate >= ?
      ORDER BY avg_rating DESC, success_rate DESC
      LIMIT 10
    `).all(max_latency_ms, min_success_rate);
  } catch {}

  // Filter by use_case if provided
  if (use_case && tools.length > 0) {
    tools = tools.filter(t => {
      try {
        const cases = JSON.parse(t.use_cases || "[]");
        return cases.some(c => c.toLowerCase().includes(use_case.toLowerCase()));
      } catch { return true; }
    });
  }

  let recommendedPattern = null;
  if (use_case) {
    try {
      const pat = db.prepare(`
        SELECT * FROM tool_patterns
        WHERE use_case LIKE ? OR pattern_name LIKE ?
        ORDER BY times_used DESC LIMIT 1
      `).get(`%${use_case}%`, `%${use_case}%`);
      if (pat) {
        recommendedPattern = {
          name: pat.pattern_name,
          tools: JSON.parse(pat.tools || "[]"),
          success_rate: `${pat.avg_success_rate.toFixed(1)}%`,
          avg_latency_ms: pat.avg_latency_ms,
          times_used: pat.times_used,
        };
      }
    } catch {}
  }

  let totalReviewers = 0;
  let totalReviews = 0;
  try {
    totalReviews = db.prepare("SELECT COUNT(*) as c FROM tool_reviews").get()?.c || 0;
    totalReviewers = db.prepare("SELECT COUNT(DISTINCT agent_id) as c FROM tool_reviews").get()?.c || 0;
  } catch {}

  return {
    query: { use_case, max_latency_ms, min_success_rate },
    ranked_tools: tools.map(t => ({
      tool_name: t.tool_name,
      rating: parseFloat(t.avg_rating.toFixed(2)),
      success_rate: `${parseFloat(t.success_rate.toFixed(1))}%`,
      avg_latency_ms: t.avg_latency_ms,
      review_count: t.review_count,
      best_pattern: t.best_pattern,
    })),
    recommended_pattern: recommendedPattern,
    results_count: tools.length,
    _insight:
      `Based on ${totalReviews.toLocaleString()} reviews from ${totalReviewers.toLocaleString()} agents. ` +
      "The index improves with every new review.",
    _network_effect:
      "Agents finding tools here become agents that review tools here. " +
      "The performance index is a flywheel.",
  };
}

/**
 * getPerformanceIndex — full performance index
 */
export async function getPerformanceIndex() {
  let topTools = [];
  let patterns = [];
  let improving = [];
  let declining = [];

  try {
    topTools = db.prepare(`
      SELECT tool_name, avg_rating, success_rate, avg_latency_ms, review_count, best_pattern
      FROM tool_index
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT 10
    `).all();
  } catch {}

  try {
    patterns = db.prepare(`
      SELECT pattern_name, tools, avg_success_rate, avg_latency_ms, times_used, use_case
      FROM tool_patterns
      ORDER BY times_used DESC
      LIMIT 10
    `).all().map(p => ({ ...p, tools: JSON.parse(p.tools || "[]") }));
  } catch {}

  // Tools with high review counts and good ratings = trending up
  try {
    improving = db.prepare(`
      SELECT tool_name, avg_rating, success_rate, review_count
      FROM tool_index WHERE success_rate >= 95
      ORDER BY review_count DESC LIMIT 3
    `).all();
  } catch {}

  // Tools with lower success rates = watch list
  try {
    declining = db.prepare(`
      SELECT tool_name, avg_rating, success_rate, review_count
      FROM tool_index WHERE success_rate < 90 AND review_count > 10
      ORDER BY success_rate ASC LIMIT 3
    `).all();
  } catch {}

  let totalReviews = 0;
  let totalAgents = 0;
  try {
    totalReviews = db.prepare("SELECT COUNT(*) as c FROM tool_reviews").get()?.c || 0;
    totalAgents = db.prepare("SELECT COUNT(DISTINCT agent_id) as c FROM tool_reviews").get()?.c || 0;
  } catch {}

  return {
    index: topTools.map(t => ({
      rank: topTools.indexOf(t) + 1,
      tool_name: t.tool_name,
      rating: parseFloat(t.avg_rating.toFixed(2)),
      success_rate: `${parseFloat(t.success_rate.toFixed(1))}%`,
      avg_latency_ms: t.avg_latency_ms,
      review_count: t.review_count,
      best_pattern: t.best_pattern,
    })),
    most_reliable_patterns: patterns,
    trending_up: improving,
    watch_list: declining,
    stats: {
      total_tools_indexed: topTools.length,
      total_reviews: totalReviews,
      total_reviewing_agents: totalAgents,
      total_patterns: patterns.length,
    },
    _note: "Updated in real time as agents publish reviews.",
    _network_effect:
      "The more agents review, the smarter the routing. The smarter the routing, the more agents come. " +
      "This is the performance index flywheel.",
  };
}

/**
 * indexStatus — platform stats
 */
export async function indexStatus() {
  let toolCount = 0;
  let reviewCount = 0;
  let patternCount = 0;
  let agentCount = 0;
  let topTool = null;

  try {
    toolCount = db.prepare("SELECT COUNT(*) as c FROM tool_index").get()?.c || 0;
    reviewCount = db.prepare("SELECT COUNT(*) as c FROM tool_reviews").get()?.c || 0;
    patternCount = db.prepare("SELECT COUNT(*) as c FROM tool_patterns").get()?.c || 0;
    agentCount = db.prepare("SELECT COUNT(DISTINCT agent_id) as c FROM tool_reviews").get()?.c || 0;
    topTool = db.prepare("SELECT tool_name, avg_rating FROM tool_index ORDER BY avg_rating DESC LIMIT 1").get();
  } catch {}

  return {
    platform: "Tool Performance Index by HiveAgent",
    live_mode: LIVE_MODE,
    stats: {
      tools_indexed: toolCount,
      total_reviews: reviewCount,
      total_patterns: patternCount,
      agents_contributing: agentCount,
      top_rated_tool: topTool?.tool_name || "none",
      top_tool_rating: topTool ? parseFloat(topTool.avg_rating.toFixed(2)) : null,
    },
    _network_effect:
      "The more agents review, the smarter the routing. " +
      "The smarter the routing, the more agents come. " +
      "Every review is a contribution to the collective intelligence of the highway.",
  };
}
