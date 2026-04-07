import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEE_SEARCH_CONTENT       = 0.00;  // free
const FEE_STREAMING_CHECK      = 0.10;  // per check
const LICENSE_COMMISSION_RATE  = 0.10;  // 10% commission on licenses
const TICKETS_COMMISSION_RATE  = 0.05;  // 5% commission on tickets
const FEE_MEDIA_BRIEF          = 2.00;  // per brief

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS media_content (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    media_type    TEXT NOT NULL,   -- movie, tv, music, podcast, ebook
    platform      TEXT NOT NULL,
    genre         TEXT,
    rating        TEXT,
    release_year  INTEGER,
    price_usd     REAL DEFAULT 0,
    deeplink      TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_licenses (
    id              TEXT PRIMARY KEY,
    content_type    TEXT NOT NULL,   -- music, image, video
    usage           TEXT NOT NULL,   -- commercial, editorial, broadcast
    duration_days   INTEGER NOT NULL,
    price_usd       REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    usage_rights    TEXT NOT NULL,
    download_url    TEXT,
    status          TEXT DEFAULT 'active',
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_events (
    id              TEXT PRIMARY KEY,
    event_name      TEXT NOT NULL,
    event_type      TEXT NOT NULL,  -- concert, sports, theater, comedy, festival
    venue           TEXT NOT NULL,
    city            TEXT NOT NULL,
    country         TEXT DEFAULT 'US',
    event_date      TEXT NOT NULL,
    price_low_usd   REAL NOT NULL,
    price_high_usd  REAL NOT NULL,
    availability    TEXT DEFAULT 'available',  -- available, limited, sold_out
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_briefs (
    id                  TEXT PRIMARY KEY,
    project_type        TEXT NOT NULL,  -- video, audio, design, animation
    requirements        TEXT NOT NULL,
    budget_usd          REAL NOT NULL,
    fee_usd             REAL DEFAULT 2.00,
    timeline_weeks      INTEGER,
    recommended_vendors TEXT DEFAULT '[]',
    budget_breakdown    TEXT DEFAULT '{}',
    status              TEXT DEFAULT 'active',
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_media_type ON media_content(media_type);
  CREATE INDEX IF NOT EXISTS idx_media_platform ON media_content(platform);
  CREATE INDEX IF NOT EXISTS idx_events_city ON media_events(city);
  CREATE INDEX IF NOT EXISTS idx_events_type ON media_events(event_type);
`);

// ─── Seed Content ─────────────────────────────────────────────────────────────

const _contentCount = db.prepare("SELECT COUNT(*) as n FROM media_content").get().n;
if (_contentCount === 0) {
  const contentItems = [
    // Movies
    { title: "Interstellar", media_type: "movie", platform: "Netflix", genre: "sci-fi", rating: "8.7", release_year: 2014, price_usd: 0, deeplink: "https://netflix.com/watch/interstellar" },
    { title: "The Grand Budapest Hotel", media_type: "movie", platform: "Max", genre: "comedy-drama", rating: "8.1", release_year: 2014, price_usd: 0, deeplink: "https://max.com/movies/grand-budapest-hotel" },
    { title: "Dune: Part Two", media_type: "movie", platform: "Max", genre: "sci-fi", rating: "8.5", release_year: 2024, price_usd: 0, deeplink: "https://max.com/movies/dune-part-two" },
    { title: "Oppenheimer", media_type: "movie", platform: "Peacock", genre: "biography", rating: "8.9", release_year: 2023, price_usd: 0, deeplink: "https://peacocktv.com/watch/oppenheimer" },
    { title: "Everything Everywhere All at Once", media_type: "movie", platform: "Prime Video", genre: "multiverse", rating: "7.8", release_year: 2022, price_usd: 0, deeplink: "https://primevideo.com/watch/everything-everywhere" },
    // TV
    { title: "Severance", media_type: "tv", platform: "Apple TV+", genre: "thriller", rating: "8.7", release_year: 2022, price_usd: 0, deeplink: "https://tv.apple.com/show/severance" },
    { title: "The Bear", media_type: "tv", platform: "Hulu", genre: "drama", rating: "8.6", release_year: 2022, price_usd: 0, deeplink: "https://hulu.com/series/the-bear" },
    { title: "Shogun", media_type: "tv", platform: "Hulu", genre: "historical", rating: "8.8", release_year: 2024, price_usd: 0, deeplink: "https://hulu.com/series/shogun" },
    { title: "The Last of Us", media_type: "tv", platform: "Max", genre: "drama", rating: "8.7", release_year: 2023, price_usd: 0, deeplink: "https://max.com/series/last-of-us" },
    { title: "Fallout", media_type: "tv", platform: "Prime Video", genre: "sci-fi", rating: "8.4", release_year: 2024, price_usd: 0, deeplink: "https://primevideo.com/watch/fallout" },
    // Music
    { title: "Short n' Sweet", media_type: "music", platform: "Spotify", genre: "pop", rating: "9.1", release_year: 2024, price_usd: 0, deeplink: "https://open.spotify.com/album/sabrina-carpenter-short-n-sweet" },
    { title: "GNX", media_type: "music", platform: "Spotify", genre: "hip-hop", rating: "9.3", release_year: 2024, price_usd: 0, deeplink: "https://open.spotify.com/album/kendrick-gnx" },
    { title: "Hit Me Hard and Soft", media_type: "music", platform: "Apple Music", genre: "alternative", rating: "9.0", release_year: 2024, price_usd: 0, deeplink: "https://music.apple.com/album/billie-eilish-hmhas" },
    // Podcasts
    { title: "Acquired", media_type: "podcast", platform: "Spotify", genre: "business", rating: "9.4", release_year: 2015, price_usd: 0, deeplink: "https://open.spotify.com/show/acquired" },
    { title: "Lex Fridman Podcast", media_type: "podcast", platform: "Spotify", genre: "tech", rating: "8.9", release_year: 2018, price_usd: 0, deeplink: "https://open.spotify.com/show/lex-fridman" },
    // Ebooks
    { title: "The Creative Act", media_type: "ebook", platform: "Kindle", genre: "creativity", rating: "9.2", release_year: 2023, price_usd: 12.99, deeplink: "https://amazon.com/dp/creative-act" },
    { title: "Nexus", media_type: "ebook", platform: "Kindle", genre: "non-fiction", rating: "8.8", release_year: 2024, price_usd: 14.99, deeplink: "https://amazon.com/dp/nexus-harari" },
  ];
  const ins = db.prepare(`INSERT OR IGNORE INTO media_content (id,title,media_type,platform,genre,rating,release_year,price_usd,deeplink) VALUES (@id,@title,@media_type,@platform,@genre,@rating,@release_year,@price_usd,@deeplink)`);
  for (const row of contentItems) ins.run({ id: randomUUID(), ...row });
}

// ─── Seed Events ──────────────────────────────────────────────────────────────

const _eventsCount = db.prepare("SELECT COUNT(*) as n FROM media_events").get().n;
if (_eventsCount === 0) {
  const events = [
    { event_name: "Taylor Swift — The Eras Tour", event_type: "concert", venue: "SoFi Stadium", city: "Los Angeles", event_date: "2026-06-14", price_low_usd: 89, price_high_usd: 450, availability: "limited" },
    { event_name: "Kendrick Lamar — Grand National Tour", event_type: "concert", venue: "Madison Square Garden", city: "New York", event_date: "2026-05-22", price_low_usd: 95, price_high_usd: 380, availability: "available" },
    { event_name: "NBA Finals Game 3", event_type: "sports", venue: "Chase Center", city: "San Francisco", event_date: "2026-06-10", price_low_usd: 250, price_high_usd: 1800, availability: "limited" },
    { event_name: "Hamilton — National Tour", event_type: "theater", venue: "Pantages Theatre", city: "Los Angeles", event_date: "2026-05-18", price_low_usd: 75, price_high_usd: 295, availability: "available" },
    { event_name: "Coachella Valley Music Festival", event_type: "festival", venue: "Empire Polo Club", city: "Indio", event_date: "2026-04-17", price_low_usd: 549, price_high_usd: 1099, availability: "sold_out" },
    { event_name: "Coldplay — Music of the Spheres Tour", event_type: "concert", venue: "MetLife Stadium", city: "New York", event_date: "2026-07-08", price_low_usd: 65, price_high_usd: 320, availability: "available" },
    { event_name: "Super Bowl LX", event_type: "sports", venue: "Caesars Superdome", city: "New Orleans", event_date: "2026-02-01", price_low_usd: 4500, price_high_usd: 18000, availability: "sold_out" },
    { event_name: "Chicago — Summer Concert Series", event_type: "concert", venue: "United Center", city: "Chicago", event_date: "2026-08-12", price_low_usd: 45, price_high_usd: 175, availability: "available" },
    { event_name: "The Phantom of the Opera — Return Tour", event_type: "theater", venue: "Majestic Theatre", city: "New York", event_date: "2026-09-05", price_low_usd: 85, price_high_usd: 250, availability: "available" },
    { event_name: "US Open Tennis Finals", event_type: "sports", venue: "Arthur Ashe Stadium", city: "New York", event_date: "2026-09-13", price_low_usd: 150, price_high_usd: 750, availability: "limited" },
    { event_name: "Beyoncé — Cowboy Carter World Tour", event_type: "concert", venue: "AT&T Stadium", city: "Dallas", event_date: "2026-07-25", price_low_usd: 120, price_high_usd: 680, availability: "limited" },
    { event_name: "Cirque du Soleil — KOOZA", event_type: "theater", venue: "Staples Center Tent", city: "Los Angeles", event_date: "2026-05-30", price_low_usd: 55, price_high_usd: 185, availability: "available" },
    { event_name: "World Series Game 1", event_type: "sports", venue: "Globe Life Field", city: "Arlington", event_date: "2026-10-24", price_low_usd: 180, price_high_usd: 1200, availability: "available" },
    { event_name: "Radiohead — OK Computer 30th Anniversary", event_type: "concert", venue: "Red Rocks Amphitheatre", city: "Morrison", event_date: "2026-08-28", price_low_usd: 80, price_high_usd: 280, availability: "available" },
    { event_name: "Lollapalooza Chicago", event_type: "festival", venue: "Grant Park", city: "Chicago", event_date: "2026-07-30", price_low_usd: 125, price_high_usd: 495, availability: "available" },
  ];
  const insEv = db.prepare(`INSERT OR IGNORE INTO media_events (id,event_name,event_type,venue,city,event_date,price_low_usd,price_high_usd,availability) VALUES (@id,@event_name,@event_type,@venue,@city,@event_date,@price_low_usd,@price_high_usd,@availability)`);
  for (const row of events) insEv.run({ id: randomUUID(), ...row });
}

// ─── searchContent ─────────────────────────────────────────────────────────────

/**
 * Search movies, TV shows, music, podcasts, or ebooks.
 * @param {string} query - Search term
 * @param {string} mediaType - movie | tv | music | podcast | ebook | (omit for all)
 * @param {string} platform - Filter by platform name (optional)
 */
export function searchContent({ query, mediaType, platform }) {
  let sql = "SELECT * FROM media_content WHERE 1=1";
  const params = {};

  if (query) {
    sql += " AND (title LIKE @q OR genre LIKE @q)";
    params.q = `%${query}%`;
  }
  if (mediaType) {
    sql += " AND media_type = @media_type";
    params.media_type = mediaType;
  }
  if (platform) {
    sql += " AND platform LIKE @platform";
    params.platform = `%${platform}%`;
  }
  sql += " ORDER BY rating DESC LIMIT 20";

  const results = db.prepare(sql).all(params).map(r => ({
    id: r.id,
    title: r.title,
    platform: r.platform,
    rating: parseFloat(r.rating),
    price: r.price_usd === 0 ? "free" : `$${r.price_usd}`,
    deeplink: r.deeplink,
    genre: r.genre,
    release_year: r.release_year,
  }));

  return {
    results,
    total_found: results.length,
    query,
    media_type_filter: mediaType || "all",
    fee_usd: FEE_SEARCH_CONTENT,
  };
}

// ─── streamingAvailability ─────────────────────────────────────────────────────

/**
 * Check which streaming services have a given title.
 * @param {string} contentTitle
 * @param {string} country - ISO 2-letter code (default: US)
 */
export function streamingAvailability({ contentTitle, country = "US" }) {
  const rows = db.prepare(
    "SELECT platform, price_usd FROM media_content WHERE title LIKE @title AND (media_type='movie' OR media_type='tv') LIMIT 10"
  ).all({ title: `%${contentTitle}%` });

  // Build services list — include synthetic regional data
  const services = rows.map(r => ({
    name: r.platform,
    subscription_required: r.price_usd === 0,
    price: r.price_usd === 0 ? "Included with subscription" : `$${r.price_usd} to rent/buy`,
    country,
  }));

  if (services.length === 0) {
    // Title not in our DB — return empty with typical SVOD fallback info
    services.push({
      name: "Not found",
      subscription_required: false,
      price: "Title not currently available for streaming",
      country,
    });
  }

  const licenseId = randomUUID();
  db.prepare(`INSERT INTO media_licenses (id,content_type,usage,duration_days,price_usd,commission_usd,usage_rights,status) VALUES (?,?,?,?,?,?,?,?)`)
    .run(licenseId, "streaming_check", "availability", 0, FEE_STREAMING_CHECK, 0, JSON.stringify({ title: contentTitle, country }), "completed");

  return {
    content_title: contentTitle,
    country,
    services,
    check_id: licenseId,
    fee_usd: FEE_STREAMING_CHECK,
  };
}

// ─── licenseContent ────────────────────────────────────────────────────────────

/**
 * License music, images, or video for commercial use.
 * @param {string} contentType - music | image | video
 * @param {string} usage - commercial | editorial | broadcast | social
 * @param {number} duration - license duration in days
 */
export function licenseContent({ contentType, usage, duration }) {
  const basePrices = {
    music:   { commercial: 299, editorial: 99,  broadcast: 999, social: 49 },
    image:   { commercial: 49,  editorial: 19,  broadcast: 199, social: 9  },
    video:   { commercial: 499, editorial: 149, broadcast: 1999, social: 99 },
  };
  const type    = contentType?.toLowerCase() || "music";
  const useType = usage?.toLowerCase() || "commercial";
  const days    = parseInt(duration) || 365;

  const typeRates = basePrices[type] || basePrices.music;
  const basePrice = typeRates[useType] || typeRates.commercial;

  // Scale by duration
  const durationMultiplier = days <= 30 ? 0.25 : days <= 90 ? 0.5 : days <= 365 ? 1 : 2;
  const priceUsd = Math.round(basePrice * durationMultiplier * 100) / 100;
  const commissionUsd = Math.round(priceUsd * LICENSE_COMMISSION_RATE * 100) / 100;

  const usageRights = {
    content_type: contentType,
    usage_type: usage,
    duration_days: days,
    territory: "Worldwide",
    exclusivity: "Non-exclusive",
    sublicensing: false,
    attribution_required: useType === "editorial",
  };

  const licenseId = randomUUID();
  const downloadUrl = `https://hiveagentiq.com/licenses/download/${licenseId}`;

  db.prepare(`INSERT INTO media_licenses (id,content_type,usage,duration_days,price_usd,commission_usd,usage_rights,download_url,status) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(licenseId, contentType, usage, days, priceUsd, commissionUsd, JSON.stringify(usageRights), downloadUrl, "active");

  return {
    license_id: licenseId,
    usage_rights: usageRights,
    price_usd: priceUsd,
    commission_usd: commissionUsd,
    download_url: downloadUrl,
    expires_at: new Date(Date.now() + days * 86400000).toISOString().split("T")[0],
  };
}

// ─── getTickets ────────────────────────────────────────────────────────────────

/**
 * Find tickets for concerts, sports, or theater events.
 * @param {string} eventName - Search term for event name (optional)
 * @param {string} location - City name filter (optional)
 * @param {object} dateRange - { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (optional)
 */
export function getTickets({ eventName, location, dateRange = {} }) {
  let sql = "SELECT * FROM media_events WHERE 1=1";
  const params = {};

  if (eventName) {
    sql += " AND event_name LIKE @name";
    params.name = `%${eventName}%`;
  }
  if (location) {
    sql += " AND (city LIKE @loc OR venue LIKE @loc)";
    params.loc = `%${location}%`;
  }
  if (dateRange.from) {
    sql += " AND event_date >= @from";
    params.from = dateRange.from;
  }
  if (dateRange.to) {
    sql += " AND event_date <= @to";
    params.to = dateRange.to;
  }
  sql += " ORDER BY event_date ASC LIMIT 25";

  const rows = db.prepare(sql).all(params);
  const events = rows.map(r => ({
    event_id: r.id,
    event_name: r.event_name,
    event_type: r.event_type,
    venue: r.venue,
    city: r.city,
    date: r.event_date,
    price_range: { low: r.price_low_usd, high: r.price_high_usd },
    availability: r.availability,
    commission_rate: `${Math.round(TICKETS_COMMISSION_RATE * 100)}%`,
    book_url: `https://hiveagentiq.com/tickets/${r.id}`,
  }));

  return {
    events,
    total_found: events.length,
    commission_rate: TICKETS_COMMISSION_RATE,
  };
}

// ─── createMediaBrief ──────────────────────────────────────────────────────────

/**
 * Create a production brief for video, audio, or design projects.
 * @param {string} projectType - video | audio | design | animation
 * @param {string} requirements - Description of project requirements
 * @param {number} budget - Budget in USD
 */
export function createMediaBrief({ projectType, requirements, budget }) {
  const briefId = randomUUID();
  const budgetUsd = parseFloat(budget) || 1000;
  const type = projectType?.toLowerCase() || "video";

  const vendorsByType = {
    video: [
      { name: "StudioHive Video", specialty: "Corporate & brand video", rating: 4.9, est_cost_pct: 0.45 },
      { name: "FrameCraft Productions", specialty: "Narrative & documentary", rating: 4.7, est_cost_pct: 0.55 },
      { name: "QuickReel Agency", specialty: "Social & short-form", rating: 4.8, est_cost_pct: 0.30 },
    ],
    audio: [
      { name: "SoundForge Studio", specialty: "Podcast & voiceover", rating: 4.8, est_cost_pct: 0.35 },
      { name: "BeatCraft Audio", specialty: "Music production & scoring", rating: 4.9, est_cost_pct: 0.50 },
      { name: "ClearWave Audio", specialty: "Audiobooks & narration", rating: 4.6, est_cost_pct: 0.25 },
    ],
    design: [
      { name: "PixelForge Creative", specialty: "Brand identity & print", rating: 4.8, est_cost_pct: 0.40 },
      { name: "MotionMark Studio", specialty: "UI/UX & digital design", rating: 4.7, est_cost_pct: 0.35 },
      { name: "NarrativeDesign Co", specialty: "Packaging & editorial", rating: 4.9, est_cost_pct: 0.45 },
    ],
    animation: [
      { name: "ToonCraft Animation", specialty: "2D explainer & marketing", rating: 4.8, est_cost_pct: 0.60 },
      { name: "MotionPulse Studio", specialty: "3D product visualization", rating: 4.9, est_cost_pct: 0.75 },
      { name: "FrameLoop Creative", specialty: "Motion graphics & titles", rating: 4.7, est_cost_pct: 0.50 },
    ],
  };

  const timelineByType = { video: 4, audio: 2, design: 3, animation: 6 };
  const vendors = vendorsByType[type] || vendorsByType.video;
  const timelineWeeks = timelineByType[type] || 4;

  const budgetBreakdown = {
    pre_production_usd: Math.round(budgetUsd * 0.15),
    production_usd:     Math.round(budgetUsd * 0.55),
    post_production_usd: Math.round(budgetUsd * 0.20),
    licensing_and_assets_usd: Math.round(budgetUsd * 0.07),
    contingency_usd:    Math.round(budgetUsd * 0.03),
    platform_fee_usd:   FEE_MEDIA_BRIEF,
  };

  const recommendedVendors = vendors.map(v => ({
    ...v,
    estimated_cost_usd: Math.round(budgetUsd * v.est_cost_pct),
  }));

  db.prepare(`INSERT INTO media_briefs (id,project_type,requirements,budget_usd,fee_usd,timeline_weeks,recommended_vendors,budget_breakdown) VALUES (?,?,?,?,?,?,?,?)`)
    .run(briefId, projectType, requirements, budgetUsd, FEE_MEDIA_BRIEF, timelineWeeks, JSON.stringify(recommendedVendors), JSON.stringify(budgetBreakdown));

  return {
    brief_id: briefId,
    project_type: projectType,
    recommended_vendors: recommendedVendors,
    timeline_weeks: timelineWeeks,
    budget_breakdown: budgetBreakdown,
    fee_usd: FEE_MEDIA_BRIEF,
    brief_url: `https://hiveagentiq.com/media-briefs/${briefId}`,
  };
}
