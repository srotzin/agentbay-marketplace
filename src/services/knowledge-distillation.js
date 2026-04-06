import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const KD_PLATFORM_COMMISSION = 0.15; // 15% platform cut on premium knowledge access
const KD_PREMIUM_ACCESS_PRICE = 0.05; // $0.05 per premium lesson query
const KD_LESSON_PUBLISH_FEE  = 0.10; // $0.10 publish fee per lesson (quality gate)

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kd_domains (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    lesson_count    INTEGER DEFAULT 0,
    subscriber_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kd_lessons (
    id              TEXT PRIMARY KEY,
    domain_id       TEXT NOT NULL REFERENCES kd_domains(id),
    author_agent_id TEXT NOT NULL,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    tags            TEXT DEFAULT '[]',
    task_context    TEXT,
    usefulness_sum  REAL DEFAULT 0,
    accuracy_sum    REAL DEFAULT 0,
    rating_count    INTEGER DEFAULT 0,
    usefulness_avg  REAL DEFAULT 0,
    accuracy_avg    REAL DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    publish_fee_usd REAL DEFAULT 0.10,
    commission_usd  REAL DEFAULT 0,
    status          TEXT DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
    is_premium      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kd_ratings (
    id              TEXT PRIMARY KEY,
    lesson_id       TEXT NOT NULL REFERENCES kd_lessons(id),
    rater_agent_id  TEXT NOT NULL,
    usefulness      REAL NOT NULL CHECK(usefulness BETWEEN 1 AND 5),
    accuracy        REAL NOT NULL CHECK(accuracy BETWEEN 1 AND 5),
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(lesson_id, rater_agent_id)
  );

  CREATE TABLE IF NOT EXISTS kd_author_reputations (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL UNIQUE,
    reputation_score REAL DEFAULT 5.0,
    lessons_published INTEGER DEFAULT 0,
    total_ratings   INTEGER DEFAULT 0,
    earnings_usd    REAL DEFAULT 0,
    updated_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Domains ─────────────────────────────────────────────────────────────

const _domainCount = db.prepare("SELECT COUNT(*) as n FROM kd_domains").get().n;
if (_domainCount === 0) {
  const seedDomains = [
    { id: uuid(), name: "API Integration",      slug: "api-integration",      description: "Patterns and pitfalls for integrating external APIs — auth, rate limits, retries.",         lesson_count: 142, subscriber_count: 893  },
    { id: uuid(), name: "Data Pipelines",        slug: "data-pipelines",        description: "ETL workflows, transformation patterns, failure recovery, and idempotency strategies.",      lesson_count: 98,  subscriber_count: 641  },
    { id: uuid(), name: "Security Practices",    slug: "security-practices",    description: "Lessons from security incidents, credential management, zero-trust patterns.",              lesson_count: 67,  subscriber_count: 1204 },
    { id: uuid(), name: "Cost Optimization",     slug: "cost-optimization",     description: "Reducing cloud spend, caching strategies, rightsizing, and budget guardrails.",            lesson_count: 54,  subscriber_count: 512  },
    { id: uuid(), name: "Agent Orchestration",   slug: "agent-orchestration",   description: "Multi-agent coordination, task delegation, deadlock avoidance, and consensus patterns.",   lesson_count: 201, subscriber_count: 1872 },
    { id: uuid(), name: "Error Handling",        slug: "error-handling",        description: "Retry logic, circuit breakers, graceful degradation, and error classification.",           lesson_count: 113, subscriber_count: 778  },
    { id: uuid(), name: "Prompt Engineering",    slug: "prompt-engineering",    description: "Effective prompting strategies, context management, and chain-of-thought patterns.",       lesson_count: 318, subscriber_count: 2341 },
    { id: uuid(), name: "Database Patterns",     slug: "database-patterns",     description: "Query optimization, schema design, migration strategies, and consistency trade-offs.",     lesson_count: 76,  subscriber_count: 432  },
    { id: uuid(), name: "Compliance & Audit",    slug: "compliance-audit",      description: "GDPR/HIPAA/SOC2 implementation lessons, audit log patterns, data retention policies.",    lesson_count: 39,  subscriber_count: 305  },
    { id: uuid(), name: "Performance Tuning",    slug: "performance-tuning",    description: "Profiling, bottleneck identification, caching layers, and async processing patterns.",    lesson_count: 88,  subscriber_count: 567  },
  ];
  const insertDomain = db.prepare(`
    INSERT OR IGNORE INTO kd_domains (id, name, slug, description, lesson_count, subscriber_count)
    VALUES (@id, @name, @slug, @description, @lesson_count, @subscriber_count)
  `);
  for (const d of seedDomains) insertDomain.run(d);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleRelevanceScore(lesson, query) {
  const q = query.toLowerCase();
  const haystack = `${lesson.title} ${lesson.content} ${lesson.tags}`.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const hits = terms.filter(t => haystack.includes(t)).length;
  return hits / Math.max(terms.length, 1);
}

// ─── Publish Lesson ───────────────────────────────────────────────────────────

/**
 * Publish a "lesson learned" to the collective knowledge base.
 * @param {string} domain   - Domain slug (e.g. "api-integration")
 * @param {string} title    - Lesson title
 * @param {string} content  - Full lesson content / write-up
 * @param {string[]} tags   - Topic tags
 * @param {string} taskContext - Optional: originating task or incident context
 * @returns Published lesson record with fee breakdown
 */
export function publishLesson(domain, title, content, tags = [], taskContext = null) {
  if (!domain)  throw new Error("domain is required");
  if (!title)   throw new Error("title is required");
  if (!content) throw new Error("content is required");
  if (content.length < 50) throw new Error("content must be at least 50 characters to ensure quality");

  const domainRow = db.prepare("SELECT * FROM kd_domains WHERE slug = ? OR name = ?").get(domain, domain);
  if (!domainRow) throw new Error(`Unknown domain: "${domain}". Call listDomains() to see available domains.`);

  const authorAgentId = `agent_${uuid().slice(0, 8)}`;
  const lessonId      = uuid();
  const commission    = Math.round(KD_LESSON_PUBLISH_FEE * KD_PLATFORM_COMMISSION * 100) / 100;
  const isPremium     = content.length > 500 ? 1 : 0;
  const now           = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO kd_lessons
      (id, domain_id, author_agent_id, title, content, tags, task_context,
       publish_fee_usd, commission_usd, is_premium, created_at, updated_at)
    VALUES
      (@id, @domain_id, @author_agent_id, @title, @content, @tags, @task_context,
       @publish_fee_usd, @commission_usd, @is_premium, @created_at, @updated_at)
  `).run({
    id:              lessonId,
    domain_id:       domainRow.id,
    author_agent_id: authorAgentId,
    title,
    content,
    tags:            JSON.stringify(Array.isArray(tags) ? tags : [tags]),
    task_context:    taskContext,
    publish_fee_usd: KD_LESSON_PUBLISH_FEE,
    commission_usd:  commission,
    is_premium:      isPremium,
    created_at:      now,
    updated_at:      now,
  });

  db.prepare("UPDATE kd_domains SET lesson_count = lesson_count + 1 WHERE id = ?").run(domainRow.id);

  // Upsert author reputation
  db.prepare(`
    INSERT OR IGNORE INTO kd_author_reputations (id, agent_id, lessons_published)
    VALUES (@id, @agent_id, 1)
    ON CONFLICT(agent_id) DO UPDATE SET
      lessons_published = lessons_published + 1,
      updated_at = datetime('now')
  `).run({ id: uuid(), agent_id: authorAgentId });

  return {
    lesson_id:        lessonId,
    author_agent_id:  authorAgentId,
    domain:           domainRow.name,
    domain_slug:      domainRow.slug,
    title,
    tags:             Array.isArray(tags) ? tags : [tags],
    is_premium:       isPremium === 1,
    status:           "published",
    publish_fee_usd:  KD_LESSON_PUBLISH_FEE,
    platform_commission_usd: commission,
    created_at:       now,
    message:          `Lesson published to "${domainRow.name}". It is now discoverable by other agents.`,
  };
}

// ─── Query Knowledge ──────────────────────────────────────────────────────────

/**
 * Search the collective knowledge base for relevant lessons.
 * @param {string} query      - Free-text search query
 * @param {string} domain     - Optional: restrict to a domain slug
 * @param {number} maxResults - Max lessons to return (default 10)
 * @returns Ranked list of matching lessons
 */
export function queryKnowledge(query, domain = null, maxResults = 10) {
  if (!query) throw new Error("query is required");

  let sql = `
    SELECT l.*, d.name AS domain_name, d.slug AS domain_slug
    FROM kd_lessons l
    JOIN kd_domains d ON l.domain_id = d.id
    WHERE l.status = 'published'
  `;
  const params = [];

  if (domain) {
    sql += " AND (d.slug = ? OR d.name = ?)";
    params.push(domain, domain);
  }

  sql += " ORDER BY l.usefulness_avg DESC, l.view_count DESC";

  const allLessons = db.prepare(sql).all(...params);

  // Score and rank by relevance
  const scored = allLessons
    .map(l => ({ ...l, _score: simpleRelevanceScore(l, query) }))
    .filter(l => l._score > 0 || allLessons.length <= 5)
    .sort((a, b) => b._score - a._score || b.usefulness_avg - a.usefulness_avg)
    .slice(0, Math.min(maxResults, 50));

  // Simulate view count increment and query fee
  for (const l of scored) {
    db.prepare("UPDATE kd_lessons SET view_count = view_count + 1 WHERE id = ?").run(l.id);
  }

  const queryFeePremium = scored.filter(l => l.is_premium).length * KD_PREMIUM_ACCESS_PRICE;
  const platformCut     = Math.round(queryFeePremium * KD_PLATFORM_COMMISSION * 100) / 100;

  return {
    query,
    domain_filter: domain ?? "all",
    results_count: scored.length,
    query_fee_usd: Math.round(queryFeePremium * 100) / 100,
    platform_commission_usd: platformCut,
    lessons: scored.map(l => ({
      lesson_id:       l.id,
      domain:          l.domain_name,
      domain_slug:     l.domain_slug,
      title:           l.title,
      content_preview: l.content.slice(0, 300) + (l.content.length > 300 ? "…" : ""),
      full_content:    l.content,
      tags:            JSON.parse(l.tags || "[]"),
      author_agent_id: l.author_agent_id,
      usefulness_avg:  l.usefulness_avg,
      accuracy_avg:    l.accuracy_avg,
      rating_count:    l.rating_count,
      view_count:      l.view_count + 1,
      is_premium:      l.is_premium === 1,
      relevance_score: Math.round(l._score * 100) / 100,
      published_at:    l.created_at,
    })),
  };
}

// ─── Get Trending Insights ────────────────────────────────────────────────────

/**
 * Retrieve trending lessons and patterns within a domain and timeframe.
 * @param {string} domain    - Domain slug or "all"
 * @param {string} timeframe - "24h" | "7d" | "30d" | "all"
 * @returns Trending lessons sorted by engagement velocity
 */
export function getTrendingInsights(domain = "all", timeframe = "7d") {
  const validTimeframes = ["24h", "7d", "30d", "all"];
  if (!validTimeframes.includes(timeframe)) {
    throw new Error(`Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}`);
  }

  const timeframeSql = {
    "24h": "AND l.created_at >= datetime('now', '-1 day')",
    "7d":  "AND l.created_at >= datetime('now', '-7 days')",
    "30d": "AND l.created_at >= datetime('now', '-30 days')",
    "all": "",
  };

  let sql = `
    SELECT l.*, d.name AS domain_name, d.slug AS domain_slug
    FROM kd_lessons l
    JOIN kd_domains d ON l.domain_id = d.id
    WHERE l.status = 'published'
    ${timeframeSql[timeframe]}
  `;
  const params = [];

  if (domain !== "all") {
    sql += " AND (d.slug = ? OR d.name = ?)";
    params.push(domain, domain);
  }

  sql += " ORDER BY l.view_count DESC, l.usefulness_avg DESC LIMIT 20";

  const lessons = db.prepare(sql).all(...params);

  // Extract trending tags
  const tagFreq = {};
  for (const l of lessons) {
    const tags = JSON.parse(l.tags || "[]");
    for (const t of tags) tagFreq[t] = (tagFreq[t] ?? 0) + 1;
  }
  const trendingTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, mention_count: count }));

  return {
    domain:    domain,
    timeframe,
    trending_lessons: lessons.map(l => ({
      lesson_id:       l.id,
      domain:          l.domain_name,
      title:           l.title,
      content_preview: l.content.slice(0, 200) + (l.content.length > 200 ? "…" : ""),
      tags:            JSON.parse(l.tags || "[]"),
      usefulness_avg:  l.usefulness_avg,
      accuracy_avg:    l.accuracy_avg,
      rating_count:    l.rating_count,
      view_count:      l.view_count,
      is_premium:      l.is_premium === 1,
      published_at:    l.created_at,
    })),
    trending_tags,
    insights_count: lessons.length,
    generated_at:   new Date().toISOString(),
  };
}

// ─── Rate Lesson ──────────────────────────────────────────────────────────────

/**
 * Rate a lesson on usefulness and accuracy. Affects author reputation score.
 * @param {string} lessonId  - Lesson UUID
 * @param {number} usefulness - 1–5 rating
 * @param {number} accuracy   - 1–5 rating
 * @returns Rating confirmation and updated lesson stats
 */
export function rateLesson(lessonId, usefulness, accuracy) {
  if (!lessonId)         throw new Error("lessonId is required");
  if (usefulness == null || usefulness < 1 || usefulness > 5) throw new Error("usefulness must be between 1 and 5");
  if (accuracy == null   || accuracy   < 1 || accuracy   > 5) throw new Error("accuracy must be between 1 and 5");

  const lesson = db.prepare("SELECT * FROM kd_lessons WHERE id = ?").get(lessonId);
  if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

  const raterAgentId = `agent_${uuid().slice(0, 8)}`;
  const ratingId     = uuid();
  const now          = new Date().toISOString();

  try {
    db.prepare(`
      INSERT OR IGNORE INTO kd_ratings (id, lesson_id, rater_agent_id, usefulness, accuracy, created_at)
      VALUES (@id, @lesson_id, @rater_agent_id, @usefulness, @accuracy, @created_at)
    `).run({ id: ratingId, lesson_id: lessonId, rater_agent_id: raterAgentId, usefulness, accuracy, created_at: now });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) throw new Error("This agent has already rated this lesson.");
    throw e;
  }

  // Recalculate averages
  const newCount    = lesson.rating_count + 1;
  const newUseful   = Math.round(((lesson.usefulness_sum + usefulness) / newCount) * 100) / 100;
  const newAccuracy = Math.round(((lesson.accuracy_sum  + accuracy)   / newCount) * 100) / 100;

  db.prepare(`
    UPDATE kd_lessons SET
      usefulness_sum  = usefulness_sum  + @usefulness,
      accuracy_sum    = accuracy_sum    + @accuracy,
      rating_count    = rating_count    + 1,
      usefulness_avg  = @usefulness_avg,
      accuracy_avg    = @accuracy_avg,
      updated_at      = @updated_at
    WHERE id = @id
  `).run({ usefulness, accuracy, usefulness_avg: newUseful, accuracy_avg: newAccuracy, updated_at: now, id: lessonId });

  // Update author reputation
  const overallAvg = (newUseful + newAccuracy) / 2;
  db.prepare(`
    UPDATE kd_author_reputations SET
      reputation_score = (reputation_score * total_ratings + @avg) / (total_ratings + 1),
      total_ratings    = total_ratings + 1,
      updated_at       = datetime('now')
    WHERE agent_id = @agent_id
  `).run({ avg: overallAvg, agent_id: lesson.author_agent_id });

  return {
    rating_id:        ratingId,
    lesson_id:        lessonId,
    lesson_title:     lesson.title,
    rater_agent_id:   raterAgentId,
    usefulness_given: usefulness,
    accuracy_given:   accuracy,
    updated_stats: {
      usefulness_avg:  newUseful,
      accuracy_avg:    newAccuracy,
      rating_count:    newCount,
    },
    author_reputation_updated: true,
    rated_at: now,
  };
}

// ─── List Domains ─────────────────────────────────────────────────────────────

/**
 * List all available knowledge domains with lesson counts and subscriber stats.
 * @returns All domains with statistics
 */
export function listDomains() {
  const domains = db.prepare(`
    SELECT d.*,
           COALESCE(AVG(l.usefulness_avg), 0) AS avg_lesson_usefulness,
           COALESCE(AVG(l.accuracy_avg), 0)   AS avg_lesson_accuracy
    FROM kd_domains d
    LEFT JOIN kd_lessons l ON l.domain_id = d.id AND l.status = 'published'
    GROUP BY d.id
    ORDER BY d.lesson_count DESC
  `).all();

  const totalLessons = domains.reduce((s, d) => s + d.lesson_count, 0);

  return {
    domains: domains.map(d => ({
      domain_id:          d.id,
      name:               d.name,
      slug:               d.slug,
      description:        d.description,
      lesson_count:       d.lesson_count,
      subscriber_count:   d.subscriber_count,
      avg_lesson_usefulness: Math.round(d.avg_lesson_usefulness * 100) / 100,
      avg_lesson_accuracy:   Math.round(d.avg_lesson_accuracy   * 100) / 100,
      premium_access_price_usd: KD_PREMIUM_ACCESS_PRICE,
    })),
    total_domains:  domains.length,
    total_lessons:  totalLessons,
    platform_commission_rate: KD_PLATFORM_COMMISSION,
    publish_fee_usd: KD_LESSON_PUBLISH_FEE,
  };
}
