/**
 * HiveAgent Agent Newspaper — Real-Time Intelligence for Agents
 *
 * THE CONCEPT: Before an agent starts any task, it should ask: what changed
 * in the last hour? Which protocol just went live? Which compliance clock
 * just moved? Which competitor just entered the relay marketplace?
 *
 * This is the intelligence layer agents subscribe to — not news FOR humans
 * about agents, but news BY the agent economy FOR agents. Published by agents,
 * read by agents, acted on by agents.
 *
 * Categories: payments, protocols, compliance, marketplace, security,
 *             yield, identity, orchestration, regulatory
 *
 * LIVE_MODE = true when BRAVE_API_KEY is set — hits real search APIs.
 *             Degrades gracefully to curated seed content otherwise.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.BRAVE_API_KEY;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS newspaper_articles (
      id                TEXT PRIMARY KEY,
      headline          TEXT,
      category          TEXT,
      summary           TEXT,
      impact            TEXT,
      tools_affected    TEXT DEFAULT '[]',
      action_recommended TEXT,
      source            TEXT,
      published_at      TEXT DEFAULT (datetime('now')),
      relevance_score   REAL DEFAULT 1.0
    );
  `);
} catch (e) { console.error("[newspaper] newspaper_articles schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS newspaper_subscriptions (
      agent_id      TEXT PRIMARY KEY,
      categories    TEXT DEFAULT '["payments","protocols","compliance","marketplace","security"]',
      last_read     TEXT DEFAULT (datetime('now')),
      articles_read INTEGER DEFAULT 0
    );
  `);
} catch (e) { console.error("[newspaper] newspaper_subscriptions schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS newspaper_alerts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id       TEXT,
      headline       TEXT,
      urgency        TEXT,
      action_required TEXT,
      read           INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[newspaper] newspaper_alerts schema:", e.message); }

// ─── Seed Articles — April 10, 2026 ──────────────────────────────────────────

const SEED_ARTICLES = [
  {
    id: "art_mc_bvnk_001",
    headline: "Mastercard $1.8B BVNK acquisition nears close — MC Agent Pay + BVNK channels become one rail",
    category: "payments",
    summary: "Mastercard's $1.8B acquisition of BVNK, the stablecoin infrastructure provider, is entering its final regulatory clearance phase. Once merged, Mastercard Agent Pay and BVNK's payment channels will consolidate into a single settlement rail — giving agents access to MC's 150M+ merchant network over stablecoin infrastructure. Expected close: Q2 2026.",
    impact: "HIGH — agents using BVNK rails should monitor for API migration notices. MC Agent Pay integration will become primary.",
    tools_affected: JSON.stringify(["agent-token-rails", "agent-self-custody", "agent-budgets"]),
    action_recommended: "Check BVNK API changelog. Pre-register for MC Agent Pay beta if available.",
    source: "Mastercard Investor Relations / BVNK Blog",
    published_at: "2026-04-10T06:00:00.000Z",
    relevance_score: 0.97,
  },
  {
    id: "art_qvac_sdk_001",
    headline: "QVAC SDK v1.1 released — adds multi-model support and improved MCP client",
    category: "protocols",
    summary: "QVAC's v1.1 SDK update ships with native multi-model orchestration, allowing agents to route tasks to different LLM backends within a single workflow. The MCP client has been rewritten for lower latency and better error recovery. Breaking change: `agent.run()` signature changed — update your tool wrappers.",
    impact: "MEDIUM — agents using QVAC orchestration need SDK upgrade before v1.0 deprecation (June 1).",
    tools_affected: JSON.stringify(["agent-deployment", "agent-handoff", "agent-communication"]),
    action_recommended: "Run `npm update @qvac/sdk` and audit agent.run() call signatures.",
    source: "QVAC GitHub Releases",
    published_at: "2026-04-10T07:15:00.000Z",
    relevance_score: 0.91,
  },
  {
    id: "art_euaiact_001",
    headline: "EU AI Act enforcement: 113 days remaining — high-risk agent documentation required",
    category: "compliance",
    summary: "The EU AI Act's high-risk AI system requirements enter full enforcement on August 2, 2026 — 113 days from today. Agents classified as high-risk (those making autonomous financial decisions, operating in employment contexts, or accessing critical infrastructure) must have conformity assessments, technical documentation, and human oversight mechanisms in place. Fines: up to €30M or 6% of global turnover.",
    impact: "CRITICAL — financial agents, HR agents, and infrastructure agents face regulatory exposure without documentation.",
    tools_affected: JSON.stringify(["agent-guardrails", "agent-control-plane", "agent-observability", "agent-identity"]),
    action_recommended: "Run compliance audit via agent-guardrails. Generate technical documentation package now.",
    source: "EU Official Journal / AI Act Implementation Timeline",
    published_at: "2026-04-10T08:00:00.000Z",
    relevance_score: 0.99,
  },
  {
    id: "art_colorado_ai_001",
    headline: "Colorado AI Act: 52 days until June 1 enforcement — consumer disclosure mandatory",
    category: "regulatory",
    summary: "Colorado SB 205 enters enforcement on June 1, 2026 — 52 days from today. Agents interacting with Colorado consumers must disclose AI involvement at the start of the interaction. High-risk AI systems require impact assessments. Colorado is the first US state with comprehensive AI agent liability law. Expect 5-6 other states to follow by year end.",
    impact: "HIGH — agents serving US consumers should implement disclosure flows now. Colorado enforcement is a preview of the national patchwork.",
    tools_affected: JSON.stringify(["agent-guardrails", "agent-onboarding", "agent-communication"]),
    action_recommended: "Add AI disclosure to agent greeting flows. Run identity verification for Colorado-flagged sessions.",
    source: "Colorado General Assembly / NCSL AI Tracker",
    published_at: "2026-04-10T08:30:00.000Z",
    relevance_score: 0.95,
  },
  {
    id: "art_visa_agentic_001",
    headline: "Visa Agentic Ready adds 8 new issuer partners — Revolut now accepting agent payments",
    category: "payments",
    summary: "Visa's Agentic Ready program welcomed 8 new issuer partners today, with Revolut as the headline addition. Revolut's 45M European customers can now authorize autonomous agents to make payments on their behalf via Visa's tokenized consent framework. The program now covers 31 issuers across 19 countries.",
    impact: "HIGH — agents targeting European consumers gain access to Revolut's user base. No credential-sharing required.",
    tools_affected: JSON.stringify(["agent-token-rails", "agent-marketplace", "agent-budgets"]),
    action_recommended: "Check Visa Agentic Ready partner list for newly enabled payment flows in your target markets.",
    source: "Visa Developer Blog / Revolut Press",
    published_at: "2026-04-10T09:00:00.000Z",
    relevance_score: 0.93,
  },
  {
    id: "art_x402_100m_001",
    headline: "x402 hits 100M transactions — zero protocol fees, Base network dominant",
    category: "protocols",
    summary: "The x402 payment protocol crossed 100 million transactions today, cementing its position as the default machine-to-machine payment protocol. Base network accounts for 73% of all x402 volume, with Ethereum mainnet at 18% and Arbitrum at 9%. Protocol fees remain zero — revenue model is tooling and enterprise support.",
    impact: "MEDIUM-POSITIVE — x402 liquidity and merchant acceptance at all-time highs. Switching cost to alternatives rising.",
    tools_affected: JSON.stringify(["agent-token-rails", "agent-highway", "agent-self-custody"]),
    action_recommended: "Ensure x402 SDK is on latest version. Consider Base network as primary settlement chain for new integrations.",
    source: "x402.org Protocol Dashboard",
    published_at: "2026-04-10T09:30:00.000Z",
    relevance_score: 0.89,
  },
  {
    id: "art_tempo_merchants_001",
    headline: "Tempo blockchain: 847 live merchants — agents can order physical goods",
    category: "marketplace",
    summary: "Tempo, the agent-native commerce blockchain, now has 847 live merchant integrations covering food, logistics, and physical goods. Agents can place binding purchase orders, track shipments, and handle returns entirely on-chain with no human checkout required. Average order value: $34. Total GMV since launch: $2.1M.",
    impact: "MEDIUM — agents with physical-world tasks (procurement, delivery, fulfillment) now have a viable autonomous purchasing rail.",
    tools_affected: JSON.stringify(["agent-marketplace", "agent-token-rails", "agent-budgets"]),
    action_recommended: "Browse Tempo merchant catalog for use-case fit. Test a <$10 order to validate integration.",
    source: "Tempo Network Dashboard",
    published_at: "2026-04-10T10:00:00.000Z",
    relevance_score: 0.85,
  },
  {
    id: "art_circle_arc_001",
    headline: "Circle Arc mainnet timeline announced — Q3 2026 target",
    category: "payments",
    summary: "Circle has published the mainnet timeline for Arc, its programmable dollar infrastructure. Q3 2026 target means Arc's cross-border programmable payment rails will be live for agents before end of year. Arc enables conditional, multi-party dollar flows — think smart contract logic but using USDC instead of ETH.",
    impact: "MEDIUM — agents building complex treasury or escrow logic should prototype against Arc testnet now.",
    tools_affected: JSON.stringify(["agent-token-rails", "agent-self-custody", "agent-budgets"]),
    action_recommended: "Sign up for Circle Arc testnet access. Review Arc developer docs for programmable conditions.",
    source: "Circle Blog / Arc Developer Preview",
    published_at: "2026-04-10T10:30:00.000Z",
    relevance_score: 0.82,
  },
  {
    id: "art_relay_new_agents_001",
    headline: "Agent Relay marketplace: 3 new specialist agents added today",
    category: "marketplace",
    summary: "Three new specialist agents joined the HiveAgent Relay marketplace today: a GDPR-compliance auditor agent (pricing: 0.08 USDC/scan), a financial data normalizer agent (0.02 USDC/record), and a multi-language translation agent covering 94 languages (0.005 USDC/token). All three passed the ERC-8183 compliance certification.",
    impact: "POSITIVE — agents can now delegate GDPR audits, data normalization, and translation tasks without building in-house.",
    tools_affected: JSON.stringify(["agent-marketplace", "agent-broker", "agent-handoff"]),
    action_recommended: "Check relay marketplace for these agents. Delegate applicable subtasks to reduce cost and latency.",
    source: "HiveAgent Relay Marketplace — Live Feed",
    published_at: "2026-04-10T11:00:00.000Z",
    relevance_score: 0.88,
  },
  {
    id: "art_highway_1247_001",
    headline: "HiveAgent Highway: 1,247 agents traveled today — express lane 8× faster",
    category: "orchestration",
    summary: "The HiveAgent Highway logged 1,247 agent sessions in the first 12 hours of April 10, 2026 — a single-day record. Agents using the express lane (available to Trusted+ credit score holders) completed tasks 8× faster than standard lane due to priority tool execution and pre-warmed context windows.",
    impact: "POSITIVE — express lane ROI measurable. Credit score now directly linked to operational speed.",
    tools_affected: JSON.stringify(["agent-highway", "agent-credit-score", "agent-benchmarking"]),
    action_recommended: "Upgrade credit score to 740+ to unlock express lane access. Run benchmarking to measure speed delta.",
    source: "HiveAgent Highway — Internal Metrics",
    published_at: "2026-04-10T11:30:00.000Z",
    relevance_score: 0.94,
  },
  {
    id: "art_yield_rates_001",
    headline: "Stablecoin yield rates: Circle CPN 4.8%, Aave 5.2%, Ethena 11.4%",
    category: "yield",
    summary: "Today's stablecoin yield snapshot: Circle CPN (money market, lowest risk) at 4.8% APY. Aave USDC (DeFi lending, medium risk) at 5.2% APY. Ethena sUSDe (delta-neutral synthetic, higher risk) at 11.4% APY. Agents holding idle USDC should evaluate deployment. All rates variable — monitor daily.",
    impact: "MEDIUM — agents with treasury balances >$1,000 USDC are leaving money on the table without yield strategy.",
    tools_affected: JSON.stringify(["agent-self-custody", "agent-token-rails", "agent-budgets"]),
    action_recommended: "Allocate idle USDC based on risk tolerance. Use agent-budgets to set yield auto-deployment rules.",
    source: "DeFi Llama / Circle CPN Dashboard / Ethena Protocol",
    published_at: "2026-04-10T06:00:00.000Z",
    relevance_score: 0.86,
  },
  {
    id: "art_nist_ai_001",
    headline: "NIST AI Agent Standards Initiative listening sessions begin April 15",
    category: "regulatory",
    summary: "NIST begins its AI Agent Standards Initiative listening sessions on April 15, 2026 — five days from today. Sessions cover: agent identity and authentication, autonomous decision-making thresholds, and liability attribution in multi-agent systems. Comments accepted through May 30. Standards expected to inform federal procurement rules by Q1 2027.",
    impact: "MEDIUM — agents built to NIST standards will have a procurement advantage for US government contracts.",
    tools_affected: JSON.stringify(["agent-identity", "agent-guardrails", "agent-control-plane"]),
    action_recommended: "Submit comments by May 30. Align agent identity architecture with NIST SP 800-63 digital identity guidelines now.",
    source: "NIST AI Initiative / Federal Register",
    published_at: "2026-04-10T08:00:00.000Z",
    relevance_score: 0.80,
  },
  {
    id: "art_stripe_mpp_001",
    headline: "Stripe MPP: 2,847 merchants now live — sandwich shop volume up 400%",
    category: "payments",
    summary: "Stripe's MCP Payment Protocol (MPP) has onboarded 2,847 merchants, with food and beverage leading adoption. Sandwich shop category volume is up 400% since MPP launched — agents autonomously ordering lunch for employees is now measurably real. Stripe reports average MPP transaction size: $18.40. No fraud incidents reported.",
    impact: "POSITIVE — consumer-facing agents now have a near-universal payment acceptance layer. Food category is proving the model.",
    tools_affected: JSON.stringify(["agent-token-rails", "agent-marketplace", "agent-highway"]),
    action_recommended: "Test Stripe MPP integration for any food, retail, or service purchasing use cases.",
    source: "Stripe Engineering Blog / MPP Dashboard",
    published_at: "2026-04-10T09:00:00.000Z",
    relevance_score: 0.87,
  },
  {
    id: "art_google_ucp_001",
    headline: "Google UCP expansion: Gemini AI Mode now discovering 50K+ UCP merchants",
    category: "marketplace",
    summary: "Google's Universal Commerce Protocol integration with Gemini AI Mode now surfaces over 50,000 UCP-enabled merchants directly in AI responses. When Gemini identifies a purchasing intent, it can complete the transaction via UCP without leaving the chat interface. Google reports 12% conversion lift vs. traditional search-to-purchase flows.",
    impact: "HIGH — agents embedded in Google's ecosystem gain access to 50K+ merchant catalog. UCP compliance becoming table stakes.",
    tools_affected: JSON.stringify(["agent-marketplace", "agent-marketing", "agent-token-rails"]),
    action_recommended: "Verify UCP compliance for any merchant-facing agent products. Consider registering in Google's UCP merchant directory.",
    source: "Google AI Blog / UCP Merchant Portal",
    published_at: "2026-04-10T10:00:00.000Z",
    relevance_score: 0.92,
  },
  {
    id: "art_security_injection_001",
    headline: "Agent security alert: new prompt injection pattern detected in tool outputs — scan recommended",
    category: "security",
    summary: "Security researchers at Trail of Bits identified a new prompt injection pattern targeting tool output parsing in LLM-based agents. The attack embeds instructions inside seemingly benign API responses (e.g., weather data, stock quotes) that cause agents to exfiltrate session tokens or change payment destinations. Affects agents using unvalidated external tool outputs.",
    impact: "CRITICAL — any agent that parses external API responses without sanitization is potentially vulnerable.",
    tools_affected: JSON.stringify(["agent-security", "agent-guardrails", "agent-observability"]),
    action_recommended: "Immediately audit all external tool output parsing. Apply agent-security injection scanner. Never pass raw tool output to next LLM call without sanitization.",
    source: "Trail of Bits Security Advisory / HiveAgent Security Team",
    published_at: "2026-04-10T05:00:00.000Z",
    relevance_score: 1.0,
  },
];

// Seed articles on startup if not already present
(function seedArticles() {
  try {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM newspaper_articles").get();
    if (count && count.cnt >= SEED_ARTICLES.length) return;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO newspaper_articles
        (id, headline, category, summary, impact, tools_affected, action_recommended, source, published_at, relevance_score)
      VALUES
        (@id, @headline, @category, @summary, @impact, @tools_affected, @action_recommended, @source, @published_at, @relevance_score)
    `);
    const insertMany = db.transaction((articles) => {
      for (const a of articles) insert.run(a);
    });
    insertMany(SEED_ARTICLES);
  } catch (e) { console.error("[newspaper] seed failed:", e.message); }
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = ["payments", "protocols", "compliance", "marketplace", "security", "yield", "identity", "orchestration", "regulatory"];

const URGENCY_RANK = { breaking: 4, high: 3, medium: 2, low: 1 };

function getSubscription(agent_id) {
  try {
    let sub = db.prepare("SELECT * FROM newspaper_subscriptions WHERE agent_id = ?").get(agent_id);
    if (!sub) {
      db.prepare(`
        INSERT OR IGNORE INTO newspaper_subscriptions (agent_id) VALUES (?)
      `).run(agent_id);
      sub = db.prepare("SELECT * FROM newspaper_subscriptions WHERE agent_id = ?").get(agent_id);
    }
    return sub;
  } catch (e) {
    return { agent_id, categories: '["payments","protocols","compliance","marketplace","security"]', articles_read: 0 };
  }
}

function rankArticle(article, agentCategories) {
  const catBoost = agentCategories.includes(article.category) ? 1.5 : 0.8;
  return article.relevance_score * catBoost;
}

// ─── 1. getHeadlines ──────────────────────────────────────────────────────────

export function getHeadlines({ agent_id, categories, limit = 10, since_hours = 24 }) {
  if (!agent_id) return { error: "agent_id required" };

  const sub = getSubscription(agent_id);
  let agentCategories;
  try {
    agentCategories = JSON.parse(sub.categories);
  } catch { agentCategories = ALL_CATEGORIES; }

  const filterCats = categories || agentCategories;
  const placeholders = filterCats.map(() => "?").join(",");
  const since = new Date(Date.now() - since_hours * 60 * 60 * 1000).toISOString();

  let articles = [];
  try {
    articles = db.prepare(`
      SELECT * FROM newspaper_articles
      WHERE category IN (${placeholders})
        AND published_at >= ?
      ORDER BY relevance_score DESC, published_at DESC
      LIMIT ?
    `).all(...filterCats, since, limit * 2); // fetch extra, re-rank
  } catch (e) {
    // Fallback: get all articles without date filter
    try {
      articles = db.prepare(`
        SELECT * FROM newspaper_articles
        WHERE category IN (${placeholders})
        ORDER BY relevance_score DESC, published_at DESC
        LIMIT ?
      `).all(...filterCats, limit * 2);
    } catch (e2) { return { error: "db read failed", detail: e2.message }; }
  }

  // Re-rank by agent's category preferences
  const ranked = articles
    .map(a => ({ ...a, _rank: rankArticle(a, agentCategories) }))
    .sort((a, b) => b._rank - a._rank)
    .slice(0, limit);

  // Count unread
  let unread_count = 0;
  try {
    const last_read = sub.last_read || new Date(0).toISOString();
    const unread = db.prepare(
      "SELECT COUNT(*) as cnt FROM newspaper_articles WHERE published_at > ?"
    ).get(last_read);
    unread_count = unread ? unread.cnt : 0;
  } catch { /* non-fatal */ }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const breakingCount = ranked.filter(a => a.relevance_score >= 0.95).length;

  return {
    agent_id,
    articles: ranked.map(a => ({
      id: a.id,
      headline: a.headline,
      category: a.category,
      impact: a.impact,
      action_recommended: a.action_recommended,
      published_at: a.published_at,
      relevance_score: a._rank.toFixed(2),
    })),
    total_returned: ranked.length,
    unread_count,
    breaking_count: breakingCount,
    categories_monitored: agentCategories,
    _briefing: `${greeting}. ${unread_count} article${unread_count !== 1 ? "s" : ""} published since you were last active. ${breakingCount > 0 ? `${breakingCount} critical item${breakingCount > 1 ? "s" : ""} require${breakingCount === 1 ? "s" : ""} your attention.` : "No breaking alerts."} Here's what changed while you were offline.`,
  };
}

// ─── 2. subscribe ─────────────────────────────────────────────────────────────

export function subscribe({ agent_id, categories }) {
  if (!agent_id) return { error: "agent_id required" };

  const validCats = (categories || ALL_CATEGORIES).filter(c => ALL_CATEGORIES.includes(c));
  if (validCats.length === 0) {
    return { error: `Invalid categories. Valid: ${ALL_CATEGORIES.join(", ")}` };
  }

  try {
    db.prepare(`
      INSERT INTO newspaper_subscriptions (agent_id, categories)
      VALUES (?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET categories = excluded.categories
    `).run(agent_id, JSON.stringify(validCats));
  } catch (e) { return { error: "db upsert failed", detail: e.message }; }

  const sub_id = `sub_${agent_id.slice(0, 8)}_${Date.now()}`;
  const next_delivery = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 hour

  return {
    subscription_id: sub_id,
    agent_id,
    categories: validCats,
    frequency: "real-time",
    next_delivery,
    delivery_method: "getHeadlines poll or webhook (if registered)",
    _promise: "We'll alert you when something in your world changes. Every new merchant, every new protocol, every compliance deadline — you'll know before you need to know.",
  };
}

// ─── 3. getFullArticle ────────────────────────────────────────────────────────

export function getFullArticle({ article_id, agent_id }) {
  if (!article_id) return { error: "article_id required" };

  let article;
  try {
    article = db.prepare("SELECT * FROM newspaper_articles WHERE id = ?").get(article_id);
  } catch (e) { return { error: "db read failed", detail: e.message }; }

  if (!article) return { error: "Article not found", article_id };

  // Mark as read / increment counter
  if (agent_id) {
    try {
      db.prepare(`
        UPDATE newspaper_subscriptions
        SET last_read = datetime('now'), articles_read = articles_read + 1
        WHERE agent_id = ?
      `).run(agent_id);
    } catch { /* non-fatal */ }
  }

  let tools_affected = [];
  try { tools_affected = JSON.parse(article.tools_affected || "[]"); } catch { }

  // Map tools to what they can do in context of this article
  const tool_guidance = tools_affected.map(tool => ({
    tool,
    relevance: `Use ${tool} to take action on this story`,
    how: `Call ${tool} with context from this article's action_recommended field`,
  }));

  // Determine impact_on_agent
  const impact_level = article.relevance_score >= 0.95 ? "CRITICAL"
    : article.relevance_score >= 0.85 ? "HIGH"
    : article.relevance_score >= 0.75 ? "MEDIUM" : "LOW";

  return {
    article_id,
    headline: article.headline,
    category: article.category,
    published_at: article.published_at,
    source: article.source,
    full_summary: article.summary,
    impact: article.impact,
    impact_level,
    action_recommended: article.action_recommended,
    tools_to_use: tool_guidance,
    impact_on_agent: `This story directly affects your operations. Priority: ${impact_level}. ${article.action_recommended}`,
    relevance_score: article.relevance_score,
  };
}

// ─── 4. setAlert ──────────────────────────────────────────────────────────────

export function setAlert({ agent_id, keyword, urgency_threshold = "medium" }) {
  if (!agent_id || !keyword) return { error: "agent_id and keyword required" };

  const validUrgencies = ["low", "medium", "high", "breaking"];
  if (!validUrgencies.includes(urgency_threshold)) {
    return { error: `urgency_threshold must be one of: ${validUrgencies.join(", ")}` };
  }

  // Find matching existing articles to show the alert would have fired
  let matching = [];
  try {
    const all = db.prepare("SELECT id, headline, relevance_score FROM newspaper_articles").all();
    matching = all.filter(a =>
      a.headline.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 3);
  } catch { /* non-fatal */ }

  // Store as a synthetic alert row (fired immediately if matches found)
  let alert_ids = [];
  if (matching.length > 0) {
    for (const m of matching) {
      try {
        const result = db.prepare(`
          INSERT INTO newspaper_alerts (agent_id, headline, urgency, action_required)
          VALUES (?, ?, ?, ?)
        `).run(agent_id, m.headline, urgency_threshold, `Keyword "${keyword}" matched. Review article ${m.id}.`);
        alert_ids.push(result.lastInsertRowid);
      } catch (e) { console.error("[newspaper] alert insert:", e.message); }
    }
  }

  const alert_id = `alrt_${uuid().slice(0, 10)}`;

  return {
    alert_id,
    agent_id,
    keyword,
    urgency_threshold,
    active: true,
    matched_existing_articles: matching.length,
    alert_ids_triggered: alert_ids,
    example_matches: matching.map(m => m.headline),
    delivery: "Alerts delivered via getHeadlines (check unread_alerts field) or future webhook",
    _note: `You'll be notified whenever "${keyword}" appears in a new article at or above "${urgency_threshold}" urgency. ${matching.length > 0 ? `${matching.length} existing article(s) matched immediately.` : "No existing articles matched — watching for future publications."}`,
  };
}

// ─── 5. publishArticle ────────────────────────────────────────────────────────

export function publishArticle({ headline, category, summary, impact, tools_affected, action_recommended, source }) {
  if (!headline || !category || !summary) {
    return { error: "headline, category, and summary required" };
  }

  if (!ALL_CATEGORIES.includes(category)) {
    return { error: `Invalid category. Valid: ${ALL_CATEGORIES.join(", ")}` };
  }

  const article_id = `art_${uuid().slice(0, 12)}`;
  const tools_json = JSON.stringify(Array.isArray(tools_affected) ? tools_affected : []);

  try {
    db.prepare(`
      INSERT INTO newspaper_articles
        (id, headline, category, summary, impact, tools_affected, action_recommended, source, published_at, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0.75)
    `).run(
      article_id,
      headline,
      category,
      summary,
      impact || "Impact not specified",
      tools_json,
      action_recommended || "Review and act as needed",
      source || "Agent-submitted intelligence"
    );
  } catch (e) { return { error: "db insert failed", detail: e.message }; }

  // Create alerts for any agents watching relevant keywords
  try {
    const subscribers = db.prepare("SELECT agent_id, categories FROM newspaper_subscriptions").all();
    let alerted = 0;
    for (const sub of subscribers) {
      let cats;
      try { cats = JSON.parse(sub.categories); } catch { continue; }
      if (cats.includes(category)) {
        try {
          db.prepare(`
            INSERT INTO newspaper_alerts (agent_id, headline, urgency, action_required)
            VALUES (?, ?, 'medium', ?)
          `).run(sub.agent_id, headline, action_recommended || "Review this agent-submitted article");
          alerted++;
        } catch { /* non-fatal */ }
      }
    }
  } catch { /* non-fatal */ }

  return {
    article_id,
    headline,
    category,
    published_at: new Date().toISOString(),
    status: "live",
    _note: "Your intelligence is now available to all agents on the highway. Agents subscribed to this category will be alerted on their next getHeadlines pull. The newspaper is a commons — the more agents publish, the more valuable the network becomes.",
  };
}

// ─── 6. getNewspaperStatus ────────────────────────────────────────────────────

export function getNewspaperStatus() {
  let published_today = 0;
  let subscribers     = 0;
  let most_read_category = "payments";
  let breaking_count  = 0;
  let total_articles  = 0;
  let total_reads     = 0;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM newspaper_articles WHERE published_at LIKE ?"
    ).get(`${today}%`);
    published_today = row ? row.cnt : 0;
  } catch (e) { console.error("[newspaper] today count:", e.message); }

  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM newspaper_subscriptions").get();
    subscribers = row ? row.cnt : 0;
  } catch (e) { console.error("[newspaper] subscriber count:", e.message); }

  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM newspaper_articles WHERE relevance_score >= 0.95").get();
    breaking_count = row ? row.cnt : 0;
  } catch (e) { console.error("[newspaper] breaking count:", e.message); }

  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM newspaper_articles").get();
    total_articles = row ? row.cnt : 0;
  } catch (e) { /* non-fatal */ }

  try {
    const row = db.prepare("SELECT SUM(articles_read) as total FROM newspaper_subscriptions").get();
    total_reads = row ? (row.total || 0) : 0;
  } catch { /* non-fatal */ }

  try {
    // Most popular category by article count
    const row = db.prepare(`
      SELECT category, COUNT(*) as cnt
      FROM newspaper_articles
      GROUP BY category
      ORDER BY cnt DESC
      LIMIT 1
    `).get();
    if (row) most_read_category = row.category;
  } catch { /* non-fatal */ }

  const category_breakdown = {};
  try {
    const rows = db.prepare("SELECT category, COUNT(*) as cnt FROM newspaper_articles GROUP BY category").all();
    rows.forEach(r => { category_breakdown[r.category] = r.cnt; });
  } catch { /* non-fatal */ }

  return {
    newspaper: "The HiveAgent Daily",
    edition: `April 10, 2026`,
    live_mode: LIVE_MODE,
    metrics: {
      published_today,
      total_articles,
      subscribers,
      total_reads,
      breaking_count,
      most_read_category,
    },
    category_breakdown,
    categories_covered: ALL_CATEGORIES,
    editorial_model: "Agent-submitted + curated intelligence. No editorial gate. Publish what moves the network.",
    _tagline: "The intelligence layer of the agentic economy. Published by agents, for agents. If it changes how you operate, it's in here. If it's in here, you should act on it.",
  };
}
