import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const BROWSER_PLATFORM_COMMISSION = 0.22; // 22% platform cut on session fees
const SESSION_TYPE_MULTIPLIERS = { basic: 1.0, authenticated: 1.8, enterprise: 3.5 };

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS browser_sessions (
    id                TEXT PRIMARY KEY,
    session_type      TEXT NOT NULL CHECK(session_type IN ('basic','authenticated','enterprise')),
    target_url        TEXT NOT NULL,
    geo_region        TEXT NOT NULL,
    duration_minutes  INTEGER NOT NULL,
    proxy_url         TEXT NOT NULL,
    cookies           TEXT DEFAULT '[]',
    user_agent        TEXT,
    viewport_width    INTEGER DEFAULT 1920,
    viewport_height   INTEGER DEFAULT 1080,
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','expired','failed','terminated')),
    price_usd         REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    leased_at         TEXT DEFAULT (datetime('now')),
    expires_at        TEXT NOT NULL,
    ended_at          TEXT,
    options           TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS browser_session_catalog (
    id                TEXT PRIMARY KEY,
    session_type      TEXT NOT NULL,
    geo_region        TEXT NOT NULL,
    base_price_usd_per_minute REAL NOT NULL,
    available_slots   INTEGER NOT NULL,
    total_slots       INTEGER NOT NULL,
    features          TEXT DEFAULT '[]'
  );
`);

// ─── Seed Session Catalog ─────────────────────────────────────────────────────

const _catalogCount = db.prepare("SELECT COUNT(*) as n FROM browser_session_catalog").get().n;
if (_catalogCount === 0) {
  const catalog = [
    { id: uuid(), session_type: "basic",         geo_region: "us-east",    base_price_usd_per_minute: 0.012, available_slots: 48, total_slots: 50, features: '["residential-ip","cookie-persistence"]' },
    { id: uuid(), session_type: "basic",         geo_region: "eu-west",    base_price_usd_per_minute: 0.014, available_slots: 39, total_slots: 40, features: '["residential-ip","cookie-persistence"]' },
    { id: uuid(), session_type: "basic",         geo_region: "ap-south",   base_price_usd_per_minute: 0.010, available_slots: 28, total_slots: 30, features: '["residential-ip","cookie-persistence"]' },
    { id: uuid(), session_type: "authenticated", geo_region: "us-east",    base_price_usd_per_minute: 0.022, available_slots: 22, total_slots: 25, features: '["residential-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore"]' },
    { id: uuid(), session_type: "authenticated", geo_region: "eu-west",    base_price_usd_per_minute: 0.025, available_slots: 18, total_slots: 20, features: '["residential-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore"]' },
    { id: uuid(), session_type: "authenticated", geo_region: "ap-south",   base_price_usd_per_minute: 0.019, available_slots: 14, total_slots: 15, features: '["residential-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore"]' },
    { id: uuid(), session_type: "enterprise",    geo_region: "us-east",    base_price_usd_per_minute: 0.042, available_slots:  9, total_slots: 10, features: '["dedicated-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore","fingerprint-rotation","tls-fingerprint-spoof","custom-headers"]' },
    { id: uuid(), session_type: "enterprise",    geo_region: "eu-west",    base_price_usd_per_minute: 0.048, available_slots:  7, total_slots: 10, features: '["dedicated-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore","fingerprint-rotation","tls-fingerprint-spoof","custom-headers"]' },
    { id: uuid(), session_type: "enterprise",    geo_region: "ap-south",   base_price_usd_per_minute: 0.038, available_slots:  6, total_slots: 10, features: '["dedicated-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore","fingerprint-rotation","tls-fingerprint-spoof","custom-headers"]' },
    { id: uuid(), session_type: "enterprise",    geo_region: "us-west",    base_price_usd_per_minute: 0.044, available_slots:  8, total_slots: 10, features: '["dedicated-ip","cookie-persistence","pre-auth","2fa-bypass","session-restore","fingerprint-rotation","tls-fingerprint-spoof","custom-headers"]' },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO browser_session_catalog (id, session_type, geo_region, base_price_usd_per_minute, available_slots, total_slots, features)
    VALUES (@id, @session_type, @geo_region, @base_price_usd_per_minute, @available_slots, @total_slots, @features)
  `);
  for (const row of catalog) ins.run(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEO_PROXY_PREFIXES = {
  "us-east":  "proxy-use.hivenet.io",
  "us-west":  "proxy-usw.hivenet.io",
  "eu-west":  "proxy-euw.hivenet.io",
  "ap-south": "proxy-aps.hivenet.io",
  "ap-east":  "proxy-ape.hivenet.io",
  "sa-east":  "proxy-sae.hivenet.io",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function generateCookies(sessionType, targetUrl) {
  const domain = (() => { try { return new URL(targetUrl).hostname; } catch { return "example.com"; } })();
  const base = [
    { name: "session_id", value: uuid().replace(/-/g, ""), domain, path: "/", secure: true, httpOnly: true, sameSite: "Lax", expires: Date.now() / 1000 + 3600 },
    { name: "_csrf",      value: uuid().replace(/-/g, "").slice(0, 32), domain, path: "/", secure: true, httpOnly: false, sameSite: "Strict", expires: Date.now() / 1000 + 3600 },
  ];
  if (sessionType === "authenticated" || sessionType === "enterprise") {
    base.push({ name: "auth_token", value: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: uuid().slice(0, 8), iat: Math.floor(Date.now() / 1000) })).toString("base64url")}.simulated`, domain, path: "/", secure: true, httpOnly: true, sameSite: "Lax", expires: Date.now() / 1000 + 7200 });
    base.push({ name: "user_pref", value: `lang=en&theme=light&tz=UTC`, domain, path: "/", secure: false, httpOnly: false, sameSite: "Lax", expires: Date.now() / 1000 + 86400 * 30 });
  }
  return base;
}

// ─── Lease Browser Session ─────────────────────────────────────────────────────

/**
 * Lease an authenticated browser session for automated browsing.
 * @param {string} targetUrl       - The target URL or domain for the session
 * @param {string} sessionType     - basic | authenticated | enterprise
 * @param {string} geoRegion       - us-east | eu-west | ap-south | us-west | ap-east | sa-east
 * @param {number} durationMinutes - Duration to lease the session (5–480 minutes)
 * @returns Session record with proxy URL, cookies, and connection details
 */
export function leaseBrowserSession(targetUrl, sessionType = "basic", geoRegion = "us-east", durationMinutes = 30) {
  const validTypes = ["basic", "authenticated", "enterprise"];
  const validRegions = Object.keys(GEO_PROXY_PREFIXES);

  if (!targetUrl) throw new Error("targetUrl is required");
  if (!validTypes.includes(sessionType)) throw new Error(`Invalid sessionType. Must be: ${validTypes.join(", ")}`);
  if (!validRegions.includes(geoRegion)) throw new Error(`Invalid geoRegion. Must be: ${validRegions.join(", ")}`);
  if (durationMinutes < 5 || durationMinutes > 480) throw new Error("durationMinutes must be between 5 and 480");

  // Find catalog entry and price
  const catalog = db.prepare(`
    SELECT * FROM browser_session_catalog
    WHERE session_type = ? AND geo_region = ? AND available_slots > 0
    LIMIT 1
  `).get(sessionType, geoRegion);

  if (!catalog) throw new Error(`No available ${sessionType} sessions in ${geoRegion}. Try a different region or session type.`);

  const priceUsd    = Math.round(catalog.base_price_usd_per_minute * durationMinutes * 100) / 100;
  const commission  = Math.round(priceUsd * BROWSER_PLATFORM_COMMISSION * 100) / 100;
  const proxyHost   = GEO_PROXY_PREFIXES[geoRegion] ?? "proxy.hivenet.io";
  const proxyPort   = 10000 + Math.floor(Math.random() * 55000);
  const proxyUser   = `sess_${uuid().replace(/-/g, "").slice(0, 16)}`;
  const proxyPass   = uuid().replace(/-/g, "");
  const proxyUrl    = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const userAgent   = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const cookies     = generateCookies(sessionType, targetUrl);
  const now         = new Date();
  const expiresAt   = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();
  const id          = uuid();

  db.prepare(`
    INSERT OR IGNORE INTO browser_sessions
      (id, session_type, target_url, geo_region, duration_minutes, proxy_url,
       cookies, user_agent, viewport_width, viewport_height, status,
       price_usd, commission_usd, leased_at, expires_at, options)
    VALUES
      (@id, @session_type, @target_url, @geo_region, @duration_minutes, @proxy_url,
       @cookies, @user_agent, 1920, 1080, 'active',
       @price_usd, @commission_usd, @leased_at, @expires_at, '{}')
  `).run({
    id,
    session_type:    sessionType,
    target_url:      targetUrl,
    geo_region:      geoRegion,
    duration_minutes: durationMinutes,
    proxy_url:       proxyUrl,
    cookies:         JSON.stringify(cookies),
    user_agent:      userAgent,
    price_usd:       priceUsd,
    commission_usd:  commission,
    leased_at:       now.toISOString(),
    expires_at:      expiresAt,
  });

  // Decrement available slots
  db.prepare("UPDATE browser_session_catalog SET available_slots = available_slots - 1 WHERE id = ?").run(catalog.id);

  return {
    session_id:            id,
    session_type:          sessionType,
    status:                "active",
    target_url:            targetUrl,
    geo_region:            geoRegion,
    proxy_url:             proxyUrl,
    proxy_host:            proxyHost,
    proxy_port:            proxyPort,
    proxy_credentials:     { username: proxyUser, password: proxyPass },
    cookies,
    user_agent:            userAgent,
    viewport:              { width: 1920, height: 1080 },
    features:              JSON.parse(catalog.features || "[]"),
    duration_minutes:      durationMinutes,
    price_usd:             priceUsd,
    platform_commission_usd: commission,
    leased_at:             now.toISOString(),
    expires_at:            expiresAt,
    instructions:          `Configure your browser/playwright to use proxy ${proxyUrl} with the provided cookies and user-agent. Session expires at ${expiresAt}.`,
  };
}

// ─── Get Session Status ───────────────────────────────────────────────────────

/**
 * Check the status of a leased browser session.
 * @param {string} sessionId
 * @returns Session status, time remaining, and expiry details
 */
export function getSessionStatus(sessionId) {
  const session = db.prepare("SELECT * FROM browser_sessions WHERE id = ?").get(sessionId);
  if (!session) throw new Error(`Browser session not found: ${sessionId}`);

  const now       = new Date();
  const expiresAt = new Date(session.expires_at);
  const minutesRemaining = Math.max(0, Math.round((expiresAt - now) / 60000));

  // Auto-expire if past expiry time
  let status = session.status;
  if (status === "active" && now > expiresAt) {
    status = "expired";
    db.prepare("UPDATE browser_sessions SET status = 'expired' WHERE id = ?").run(sessionId);
  }

  return {
    session_id:        sessionId,
    session_type:      session.session_type,
    status,
    target_url:        session.target_url,
    geo_region:        session.geo_region,
    proxy_url:         status === "active" ? session.proxy_url : null,
    minutes_remaining: status === "active" ? minutesRemaining : 0,
    duration_minutes:  session.duration_minutes,
    leased_at:         session.leased_at,
    expires_at:        session.expires_at,
    ended_at:          session.ended_at,
    price_usd:         session.price_usd,
  };
}

// ─── End Session ──────────────────────────────────────────────────────────────

/**
 * Terminate a browser session early and release resources.
 * @param {string} sessionId
 * @returns Termination confirmation with cost summary
 */
export function endSession(sessionId) {
  const session = db.prepare("SELECT * FROM browser_sessions WHERE id = ?").get(sessionId);
  if (!session) throw new Error(`Browser session not found: ${sessionId}`);
  if (["expired", "terminated", "failed"].includes(session.status)) {
    return { session_id: sessionId, status: session.status, message: `Session already ${session.status}.` };
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE browser_sessions SET status = 'terminated', ended_at = ? WHERE id = ?").run(now, sessionId);

  // Release slot back to catalog
  const catalog = db.prepare(`
    SELECT id FROM browser_session_catalog
    WHERE session_type = ? AND geo_region = ?
    LIMIT 1
  `).get(session.session_type, session.geo_region);
  if (catalog) {
    db.prepare(`
      UPDATE browser_session_catalog
      SET available_slots = MIN(total_slots, available_slots + 1)
      WHERE id = ?
    `).run(catalog.id);
  }

  const leasedAt = new Date(session.leased_at);
  const endedAt  = new Date(now);
  const actualMinutes = Math.round((endedAt - leasedAt) / 60000);
  const refundUsd = Math.max(0, Math.round((session.price_usd - (actualMinutes * (session.price_usd / session.duration_minutes))) * 100) / 100);

  return {
    session_id:       sessionId,
    status:           "terminated",
    ended_at:         now,
    actual_duration_minutes: actualMinutes,
    total_price_usd:  session.price_usd,
    partial_refund_usd: refundUsd,
    message:          `Session terminated. Resources released. ${refundUsd > 0 ? `Partial refund of $${refundUsd} applied.` : ""}`,
  };
}

// ─── List Available Sessions ──────────────────────────────────────────────────

/**
 * Browse available session types and real-time pricing for a given region.
 * @param {string} geoRegion - Optional: filter by geo region
 * @returns Available session types with pricing and slot availability
 */
export function listAvailableSessions(geoRegion) {
  let sql = "SELECT * FROM browser_session_catalog WHERE 1=1";
  const params = [];

  if (geoRegion) {
    sql += " AND geo_region = ?";
    params.push(geoRegion);
  }

  sql += " ORDER BY session_type, geo_region";
  const rows = db.prepare(sql).all(...params);

  return {
    sessions: rows.map(r => ({
      session_type:                r.session_type,
      geo_region:                  r.geo_region,
      base_price_usd_per_minute:   r.base_price_usd_per_minute,
      example_price_30min_usd:     Math.round(r.base_price_usd_per_minute * 30 * 100) / 100,
      example_price_60min_usd:     Math.round(r.base_price_usd_per_minute * 60 * 100) / 100,
      available_slots:             r.available_slots,
      total_slots:                 r.total_slots,
      utilization_pct:             Math.round(((r.total_slots - r.available_slots) / r.total_slots) * 100),
      features:                    JSON.parse(r.features || "[]"),
    })),
    count:    rows.length,
    filter:   { geo_region: geoRegion ?? "all" },
    platform_commission_pct: BROWSER_PLATFORM_COMMISSION * 100,
  };
}

// ─── Configure Session ────────────────────────────────────────────────────────

/**
 * Update session options including viewport, user-agent, and cookies.
 * @param {string} sessionId
 * @param {object} options - { viewport, userAgent, cookies, extraHeaders }
 * @returns Updated session configuration
 */
export function configureSession(sessionId, options = {}) {
  const session = db.prepare("SELECT * FROM browser_sessions WHERE id = ?").get(sessionId);
  if (!session) throw new Error(`Browser session not found: ${sessionId}`);
  if (session.status !== "active") throw new Error(`Cannot configure a ${session.status} session.`);

  const current = JSON.parse(session.options || "{}");
  const merged  = { ...current, ...options };

  const updates = {};
  if (options.userAgent) updates.user_agent = options.userAgent;
  if (options.viewport?.width)  updates.viewport_width  = options.viewport.width;
  if (options.viewport?.height) updates.viewport_height = options.viewport.height;
  if (options.cookies) updates.cookies = JSON.stringify(options.cookies);
  updates.options = JSON.stringify(merged);

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(", ");
  if (setClauses) {
    db.prepare(`UPDATE browser_sessions SET ${setClauses} WHERE id = @id`).run({ ...updates, id: sessionId });
  }

  const updated = db.prepare("SELECT * FROM browser_sessions WHERE id = ?").get(sessionId);

  return {
    session_id:     sessionId,
    status:         updated.status,
    user_agent:     updated.user_agent,
    viewport:       { width: updated.viewport_width, height: updated.viewport_height },
    cookies:        JSON.parse(updated.cookies || "[]"),
    options:        JSON.parse(updated.options || "{}"),
    updated_at:     new Date().toISOString(),
    message:        "Session configuration updated successfully.",
  };
}
