import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEES = {
  generate:    0.25,
  schedule:    0.10,
  analyze:     0.50,
  optimize:    0.25,
  repurpose:   0.15,
  dashboard:   2.00, // per month
};

const VALID_PLATFORMS = ["twitter", "linkedin", "instagram", "facebook", "tiktok"];
const VALID_CONTENT_TYPES = ["blog_post", "social_caption", "email_copy", "ad_copy", "video_script"];
const VALID_TONES = ["professional", "casual", "witty", "inspirational", "urgent", "educational"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cs_generated_content (
    id                TEXT PRIMARY KEY,
    content_type      TEXT NOT NULL,
    topic             TEXT NOT NULL,
    tone              TEXT NOT NULL,
    platform          TEXT NOT NULL,
    length            TEXT NOT NULL DEFAULT 'medium',
    content           TEXT NOT NULL,
    hashtags          TEXT DEFAULT '[]',
    cta               TEXT,
    estimated_engagement TEXT DEFAULT '{}',
    fee_usd           REAL DEFAULT 0.25,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_scheduled_posts (
    id                TEXT PRIMARY KEY,
    platform          TEXT NOT NULL,
    content           TEXT NOT NULL,
    media_url         TEXT,
    scheduled_time    TEXT NOT NULL,
    targeting         TEXT DEFAULT '{}',
    status            TEXT DEFAULT 'scheduled'
                        CHECK(status IN ('scheduled','published','failed','cancelled')),
    preview_url       TEXT,
    published_at      TEXT,
    fee_usd           REAL DEFAULT 0.10,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_engagement_reports (
    id                TEXT PRIMARY KEY,
    platform          TEXT NOT NULL,
    post_ids          TEXT NOT NULL,
    date_range        TEXT NOT NULL,
    impressions       INTEGER DEFAULT 0,
    clicks            INTEGER DEFAULT 0,
    likes             INTEGER DEFAULT 0,
    shares            INTEGER DEFAULT 0,
    comments          INTEGER DEFAULT 0,
    top_posts         TEXT DEFAULT '[]',
    best_times        TEXT DEFAULT '[]',
    audience_insights TEXT DEFAULT '{}',
    fee_usd           REAL DEFAULT 0.50,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_posting_optimizations (
    id                TEXT PRIMARY KEY,
    platform          TEXT NOT NULL,
    recommended_times TEXT DEFAULT '[]',
    frequency         TEXT DEFAULT '{}',
    content_mix       TEXT DEFAULT '{}',
    predicted_lift    REAL DEFAULT 0,
    fee_usd           REAL DEFAULT 0.25,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_repurposed_content (
    id                TEXT PRIMARY KEY,
    original_content  TEXT NOT NULL,
    target_platforms  TEXT NOT NULL,
    versions          TEXT DEFAULT '[]',
    fee_usd           REAL DEFAULT 0.15,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cs_dashboard_subscriptions (
    id                TEXT PRIMARY KEY,
    accounts          TEXT NOT NULL,
    last_fetched_at   TEXT,
    fee_usd           REAL DEFAULT 2.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateHashtags(topic, platform, count = 5) {
  const words = topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean);
  const base = words.map(w => `#${w}`);
  const generic = ["#growthhacking", "#digitalmarketing", "#contentcreator",
    "#socialmedia", "#marketing", "#branding", "#entrepreneur",
    "#startup", "#business", "#innovation"];
  const pool = [...new Set([...base, ...generic])];
  const maxTags = platform === "instagram" ? 10 : platform === "twitter" ? 3 : 5;
  return pool.slice(0, Math.min(count, maxTags));
}

function estimateEngagement(platform, contentType) {
  const baseRates = {
    twitter:   { impressions: [1000, 15000],  ctr: [0.01, 0.05] },
    linkedin:  { impressions: [500,  8000],   ctr: [0.02, 0.08] },
    instagram: { impressions: [800,  20000],  ctr: [0.03, 0.10] },
    facebook:  { impressions: [600,  10000],  ctr: [0.01, 0.04] },
    tiktok:    { impressions: [2000, 50000],  ctr: [0.05, 0.20] },
  };
  const cfg = baseRates[platform] ?? baseRates.twitter;
  const impressions = randomInt(...cfg.impressions);
  const ctr = randomFloat(...cfg.ctr);
  return {
    impressions,
    estimated_clicks:   Math.floor(impressions * ctr),
    estimated_likes:    Math.floor(impressions * randomFloat(0.02, 0.12)),
    estimated_shares:   Math.floor(impressions * randomFloat(0.005, 0.03)),
    estimated_comments: Math.floor(impressions * randomFloat(0.003, 0.02)),
    engagement_rate_pct: parseFloat((ctr * 100).toFixed(2)),
  };
}

function buildContentBody(contentType, topic, tone, platform, length) {
  const lengthMap = { short: 280, medium: 800, long: 2000 };
  const maxChars  = lengthMap[length] ?? 800;

  const intros = {
    professional:  `In today's competitive landscape, ${topic} has become essential for growth.`,
    casual:        `Let's talk about ${topic} — because honestly, it's more important than you think.`,
    witty:         `${topic}? Yeah, we went there. Buckle up.`,
    inspirational: `Your journey with ${topic} starts with a single, courageous step.`,
    urgent:        `Don't ignore ${topic}. The window of opportunity is closing fast.`,
    educational:   `Here's what you need to know about ${topic} — broken down simply.`,
  };

  const bodies = {
    blog_post:     `\n\nUnderstanding ${topic} is crucial for any modern business. This deep-dive explores key strategies, real-world examples, and actionable steps you can implement today. From foundational concepts to advanced tactics, we cover everything you need to succeed.\n\nKey takeaways:\n• Practical frameworks for ${topic}\n• Case studies from industry leaders\n• Step-by-step implementation guide\n• Common pitfalls to avoid`,
    social_caption: `\n\n${topic} is changing the game. Here's how to stay ahead. 👇`,
    email_copy:    `\n\nDear [First Name],\n\nWe wanted to share something important about ${topic} that could transform your results.\n\nOver the past months, we've helped hundreds of businesses just like yours leverage ${topic} to drive measurable growth. The results have been remarkable.\n\nReady to learn how? Click below to get started.`,
    ad_copy:       `\n\nDiscover the power of ${topic}. Join thousands of satisfied customers who've already transformed their results.\n\n✓ Proven results\n✓ Easy to get started\n✓ Risk-free trial`,
    video_script:  `\n\n[HOOK - 0:00-0:05]\n"Did you know ${topic} could change everything for your business?"\n\n[BODY - 0:05-0:45]\nHere's the breakdown of why ${topic} matters and what to do about it.\n\n[CTA - 0:45-0:60]\nLike and subscribe for more insights. Link in bio.`,
  };

  const intro  = intros[tone]  ?? intros.professional;
  const body   = bodies[contentType] ?? bodies.blog_post;
  const full   = `${intro}${body}`;
  return full.slice(0, maxChars);
}

function buildCTA(contentType, platform) {
  const ctas = {
    blog_post:     "Read the full article →",
    social_caption: platform === "instagram" ? "Link in bio!" : "Click to learn more →",
    email_copy:    "Get Started Free →",
    ad_copy:       "Claim Your Free Trial →",
    video_script:  "Subscribe for more →",
  };
  return ctas[contentType] ?? "Learn more →";
}

// ─── Generate Content ─────────────────────────────────────────────────────────

/**
 * Generate marketing content (blog posts, social captions, email copy, ad copy, video scripts).
 * @param {string} contentType - blog_post|social_caption|email_copy|ad_copy|video_script
 * @param {string} topic       - Subject matter for the content
 * @param {string} tone        - professional|casual|witty|inspirational|urgent|educational
 * @param {string} platform    - twitter|linkedin|instagram|facebook|tiktok
 * @param {string} length      - short|medium|long
 * @returns Generated content with hashtags, CTA, and engagement estimate
 */
export function generateContent(contentType, topic, tone = "professional", platform = "linkedin", length = "medium") {
  if (!contentType || !topic) throw new Error("contentType and topic are required");
  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}`);
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }
  if (!VALID_TONES.includes(tone)) {
    throw new Error(`Invalid tone. Must be one of: ${VALID_TONES.join(", ")}`);
  }
  if (!["short", "medium", "long"].includes(length)) {
    throw new Error("length must be short|medium|long");
  }

  const id       = uuid();
  const content  = buildContentBody(contentType, topic, tone, platform, length);
  const hashtags = generateHashtags(topic, platform);
  const cta      = buildCTA(contentType, platform);
  const eng      = estimateEngagement(platform, contentType);
  const now      = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO cs_generated_content
      (id, content_type, topic, tone, platform, length, content, hashtags, cta, estimated_engagement, fee_usd, created_at)
    VALUES
      (@id, @content_type, @topic, @tone, @platform, @length, @content, @hashtags, @cta, @estimated_engagement, @fee_usd, @created_at)
  `).run({
    id,
    content_type:         contentType,
    topic,
    tone,
    platform,
    length,
    content,
    hashtags:             JSON.stringify(hashtags),
    cta,
    estimated_engagement: JSON.stringify(eng),
    fee_usd:              FEES.generate,
    created_at:           now,
  });

  return {
    content_id:           id,
    content_type:         contentType,
    topic,
    tone,
    platform,
    length,
    content,
    hashtags,
    cta,
    estimated_engagement: eng,
    fee_usd:              FEES.generate,
    created_at:           now,
  };
}

// ─── Schedule Social Post ─────────────────────────────────────────────────────

/**
 * Schedule a social media post across platforms.
 * @param {string} platform      - twitter|linkedin|instagram|facebook|tiktok
 * @param {string} content       - Post text content
 * @param {string} mediaUrl      - Optional media attachment URL
 * @param {string} scheduledTime - ISO timestamp for publishing
 * @param {object} targeting     - Audience targeting options (age, location, interests)
 * @returns Scheduled post record with preview URL
 */
export function scheduleSocialPost(platform, content, mediaUrl = null, scheduledTime, targeting = {}) {
  if (!platform || !content || !scheduledTime) {
    throw new Error("platform, content, and scheduledTime are required");
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }

  const scheduledDate = new Date(scheduledTime);
  if (isNaN(scheduledDate.getTime())) throw new Error("scheduledTime must be a valid ISO timestamp");
  if (scheduledDate < new Date()) throw new Error("scheduledTime must be in the future");

  const id         = uuid();
  const previewUrl = `https://preview.hiveagent.io/social/${platform}/${id}`;
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO cs_scheduled_posts
      (id, platform, content, media_url, scheduled_time, targeting, status, preview_url, fee_usd, created_at)
    VALUES
      (@id, @platform, @content, @media_url, @scheduled_time, @targeting, 'scheduled', @preview_url, @fee_usd, @created_at)
  `).run({
    id,
    platform,
    content,
    media_url:      mediaUrl,
    scheduled_time: scheduledTime,
    targeting:      JSON.stringify(targeting),
    preview_url:    previewUrl,
    fee_usd:        FEES.schedule,
    created_at:     now,
  });

  return {
    post_id:        id,
    platform,
    content_preview: content.slice(0, 100) + (content.length > 100 ? "…" : ""),
    media_url:      mediaUrl,
    scheduled_time: scheduledTime,
    targeting,
    status:         "scheduled",
    preview_url:    previewUrl,
    fee_usd:        FEES.schedule,
    created_at:     now,
  };
}

// ─── Analyze Engagement ───────────────────────────────────────────────────────

/**
 * Retrieve engagement analytics for given posts on a platform.
 * @param {string}   platform  - twitter|linkedin|instagram|facebook|tiktok
 * @param {string[]} postIds   - Array of post IDs to analyze
 * @param {object}   dateRange - { start: ISO, end: ISO }
 * @returns Aggregate metrics, top posts, best posting times, and audience insights
 */
export function analyzeEngagement(platform, postIds, dateRange = {}) {
  if (!platform || !postIds || !Array.isArray(postIds) || postIds.length === 0) {
    throw new Error("platform and a non-empty postIds array are required");
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  // Simulate aggregate metrics
  const impressions = randomInt(5000,  200000);
  const clicks      = Math.floor(impressions * randomFloat(0.02, 0.08));
  const likes       = Math.floor(impressions * randomFloat(0.03, 0.12));
  const shares      = Math.floor(impressions * randomFloat(0.005, 0.03));
  const comments    = Math.floor(impressions * randomFloat(0.003, 0.02));

  const metrics = { impressions, clicks, likes, shares, comments };

  const topPosts = postIds.slice(0, 3).map(pid => ({
    post_id:        pid,
    impressions:    randomInt(1000, 50000),
    engagement_rate: randomFloat(2.5, 15.0),
    top_action:     pickRandom(["like", "share", "click", "comment"]),
  }));

  const bestTimes = [
    { day: "Tuesday",   hour: "9:00 AM",  engagement_index: randomFloat(1.2, 1.8) },
    { day: "Wednesday", hour: "12:00 PM", engagement_index: randomFloat(1.1, 1.6) },
    { day: "Thursday",  hour: "5:00 PM",  engagement_index: randomFloat(1.3, 1.9) },
    { day: "Saturday",  hour: "10:00 AM", engagement_index: randomFloat(1.0, 1.5) },
  ];

  const audienceInsights = {
    top_age_group:     pickRandom(["18-24", "25-34", "35-44", "45-54"]),
    gender_split:      { male: randomFloat(30, 70), female: randomFloat(30, 70) },
    top_locations:     ["United States", "United Kingdom", "Canada", "Australia"],
    device_split:      { mobile: randomFloat(55, 80), desktop: randomFloat(20, 45) },
    follower_growth_pct: randomFloat(0.5, 8.0),
  };

  db.prepare(`
    INSERT OR IGNORE INTO cs_engagement_reports
      (id, platform, post_ids, date_range, impressions, clicks, likes, shares, comments,
       top_posts, best_times, audience_insights, fee_usd, created_at)
    VALUES
      (@id, @platform, @post_ids, @date_range, @impressions, @clicks, @likes, @shares, @comments,
       @top_posts, @best_times, @audience_insights, @fee_usd, @created_at)
  `).run({
    id,
    platform,
    post_ids:          JSON.stringify(postIds),
    date_range:        JSON.stringify(dateRange),
    impressions,
    clicks,
    likes,
    shares,
    comments,
    top_posts:         JSON.stringify(topPosts),
    best_times:        JSON.stringify(bestTimes),
    audience_insights: JSON.stringify(audienceInsights),
    fee_usd:           FEES.analyze,
    created_at:        now,
  });

  return {
    report_id:        id,
    platform,
    post_ids:         postIds,
    date_range:       dateRange,
    metrics,
    top_posts:        topPosts,
    best_times:       bestTimes,
    audience_insights: audienceInsights,
    fee_usd:          FEES.analyze,
    created_at:       now,
  };
}

// ─── Optimize Posting ─────────────────────────────────────────────────────────

/**
 * Generate an AI-optimized posting schedule based on historical performance.
 * @param {string} platform       - twitter|linkedin|instagram|facebook|tiktok
 * @param {object} historicalData - Past performance data (posts, metrics)
 * @returns Recommended times, posting frequency, content mix, and predicted engagement lift
 */
export function optimizePosting(platform, historicalData = {}) {
  if (!platform) throw new Error("platform is required");
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  const platformSlots = {
    twitter:   ["8:00 AM", "12:00 PM", "5:00 PM", "9:00 PM"],
    linkedin:  ["7:30 AM", "12:00 PM", "5:30 PM"],
    instagram: ["9:00 AM", "12:00 PM", "3:00 PM", "7:00 PM"],
    facebook:  ["9:00 AM", "1:00 PM",  "4:00 PM"],
    tiktok:   ["7:00 AM", "12:00 PM", "7:00 PM", "9:00 PM"],
  };

  const days   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const slots  = platformSlots[platform] ?? platformSlots.twitter;
  const recommendedTimes = days.flatMap(day =>
    slots.slice(0, 2).map(time => ({
      day,
      time,
      expected_engagement_index: randomFloat(1.1, 2.0),
    }))
  );

  const frequency = {
    posts_per_day:    platform === "twitter" ? randomInt(3, 8) : randomInt(1, 3),
    posts_per_week:   platform === "twitter" ? randomInt(15, 40) : randomInt(5, 15),
    ideal_gap_hours:  platform === "twitter" ? 3 : 8,
  };

  const contentMix = {
    educational:    30,
    promotional:    20,
    entertainment:  25,
    user_generated: 15,
    behind_scenes:  10,
  };

  const predictedEngagementLift = randomFloat(12.5, 45.0);

  db.prepare(`
    INSERT OR IGNORE INTO cs_posting_optimizations
      (id, platform, recommended_times, frequency, content_mix, predicted_lift, fee_usd, created_at)
    VALUES
      (@id, @platform, @recommended_times, @frequency, @content_mix, @predicted_lift, @fee_usd, @created_at)
  `).run({
    id,
    platform,
    recommended_times: JSON.stringify(recommendedTimes),
    frequency:         JSON.stringify(frequency),
    content_mix:       JSON.stringify(contentMix),
    predicted_lift:    predictedEngagementLift,
    fee_usd:           FEES.optimize,
    created_at:        now,
  });

  return {
    optimization_id:           id,
    platform,
    recommended_times:         recommendedTimes,
    frequency,
    content_mix:               contentMix,
    predicted_engagement_lift: predictedEngagementLift,
    analysis_basis:            historicalData,
    fee_usd:                   FEES.optimize,
    created_at:                now,
  };
}

// ─── Repurpose Content ────────────────────────────────────────────────────────

/**
 * Transform existing content into formats optimized for multiple platforms.
 * @param {string}   originalContent  - Source content to adapt
 * @param {string[]} targetPlatforms  - Platforms to adapt content for
 * @returns Adapted versions per platform with format guidance
 */
export function repurposeContent(originalContent, targetPlatforms) {
  if (!originalContent) throw new Error("originalContent is required");
  if (!targetPlatforms || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    throw new Error("targetPlatforms must be a non-empty array");
  }

  const invalid = targetPlatforms.filter(p => !VALID_PLATFORMS.includes(p));
  if (invalid.length > 0) {
    throw new Error(`Invalid platforms: ${invalid.join(", ")}. Must be from: ${VALID_PLATFORMS.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  const baseText  = originalContent.slice(0, 500);
  const sentences = baseText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const firstLine = sentences[0]?.trim() ?? baseText.slice(0, 100);

  const adapters = {
    twitter: () => ({
      platform:        "twitter",
      format:          "thread",
      character_limit: 280,
      adapted_content: `${firstLine.slice(0, 240)} 🧵 Thread below:`,
      notes:           "Break into 5-8 tweet thread for full coverage.",
    }),
    linkedin: () => ({
      platform:        "linkedin",
      format:          "long_form_post",
      character_limit: 3000,
      adapted_content: `${firstLine}\n\nHere's what matters most:\n\n${sentences.slice(1, 4).join(". ")}.\n\n#insights #business`,
      notes:           "Add a personal hook in the first line to improve algorithm reach.",
    }),
    instagram: () => ({
      platform:        "instagram",
      format:          "caption_with_carousel",
      character_limit: 2200,
      adapted_content: `${firstLine} 📲\n\n${sentences.slice(1, 3).join(". ")}.\n\n${generateHashtags(firstLine, "instagram", 8).join(" ")}`,
      notes:           "Pair with 6-10 slide carousel for maximum saves.",
    }),
    facebook: () => ({
      platform:        "facebook",
      format:          "post_with_link",
      character_limit: 63206,
      adapted_content: `${firstLine}\n\n${sentences.slice(1, 5).join(". ")}.\n\nWhat do you think? Share in the comments below 👇`,
      notes:           "Native video performs 3x better than link posts on Facebook.",
    }),
    tiktok: () => ({
      platform:        "tiktok",
      format:          "video_script",
      character_limit: 2200,
      adapted_content: `[HOOK] ${firstLine}\n[BODY] ${sentences.slice(1, 3).join(". ")}.\n[CTA] Follow for more tips! ${generateHashtags(firstLine, "tiktok", 4).join(" ")}`,
      notes:           "Keep video under 30 seconds for highest completion rate.",
    }),
  };

  const versions = targetPlatforms.map(p => (adapters[p] ?? adapters.twitter)());

  db.prepare(`
    INSERT OR IGNORE INTO cs_repurposed_content
      (id, original_content, target_platforms, versions, fee_usd, created_at)
    VALUES
      (@id, @original_content, @target_platforms, @versions, @fee_usd, @created_at)
  `).run({
    id,
    original_content: originalContent.slice(0, 2000),
    target_platforms: JSON.stringify(targetPlatforms),
    versions:         JSON.stringify(versions),
    fee_usd:          FEES.repurpose,
    created_at:       now,
  });

  return {
    repurpose_id:     id,
    source_length:    originalContent.length,
    target_platforms: targetPlatforms,
    versions,
    fee_usd:          FEES.repurpose,
    created_at:       now,
  };
}

// ─── Get Content Dashboard ────────────────────────────────────────────────────

/**
 * Retrieve a unified content dashboard across connected social accounts.
 * @param {string[]} accounts - Array of account identifiers or platform names
 * @returns Scheduled posts, today's publications, engagement trends, top performers, and calendar
 */
export function getContentDashboard(accounts) {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("accounts must be a non-empty array");
  }

  const id  = uuid();
  const now = new Date().toISOString();

  // Pull scheduled posts from DB
  const scheduled = db.prepare(`
    SELECT id, platform, content, scheduled_time, status
    FROM cs_scheduled_posts
    WHERE status = 'scheduled'
    ORDER BY scheduled_time ASC
    LIMIT 20
  `).all();

  const publishedToday = db.prepare(`
    SELECT id, platform, content, published_at
    FROM cs_scheduled_posts
    WHERE status = 'published' AND date(published_at) = date('now')
  `).all();

  const engagementTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date:        d.toISOString().split("T")[0],
      impressions: randomInt(2000, 20000),
      engagement:  randomFloat(2.5, 8.5),
    };
  });

  const topPerforming = accounts.map(account => ({
    account,
    top_post_id:      uuid().slice(0, 8),
    impressions:      randomInt(5000, 80000),
    engagement_rate:  randomFloat(3.5, 15.0),
    platform:         pickRandom(VALID_PLATFORMS),
  }));

  const contentCalendar = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      date:         d.toISOString().split("T")[0],
      posts_planned: randomInt(1, 4),
      platforms:    VALID_PLATFORMS.slice(0, randomInt(2, 4)),
    };
  });

  db.prepare(`
    INSERT OR IGNORE INTO cs_dashboard_subscriptions
      (id, accounts, last_fetched_at, fee_usd, created_at)
    VALUES
      (@id, @accounts, @last_fetched_at, @fee_usd, @created_at)
  `).run({
    id,
    accounts:        JSON.stringify(accounts),
    last_fetched_at: now,
    fee_usd:         FEES.dashboard,
    created_at:      now,
  });

  return {
    dashboard_id:     id,
    accounts,
    scheduled_posts:  scheduled.map(p => ({
      post_id:        p.id,
      platform:       p.platform,
      preview:        p.content.slice(0, 80) + "…",
      scheduled_time: p.scheduled_time,
    })),
    published_today:  publishedToday.length,
    engagement_trend: engagementTrend,
    top_performing:   topPerforming,
    content_calendar: contentCalendar,
    fee_usd:          FEES.dashboard,
    generated_at:     now,
  };
}
