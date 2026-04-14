/**
 * SQLite-backed Rate Limiter
 *
 * Persistent, tier-aware rate limiting keyed on IP + agent-id.
 * Survives server restarts. No bypass tokens.
 *
 * Tiers (per 15-minute window):
 *   free       = 100
 *   starter    = 500
 *   pro        = 2,000
 *   enterprise = 10,000
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_LABEL = "15m";

const TIER_LIMITS = {
  free: 100,
  starter: 500,
  pro: 2000,
  enterprise: 10000,
};

let db = null;
let stmtIncrement = null;
let stmtGet = null;
let stmtCleanup = null;

/**
 * Initialize the rate limiter with a database reference.
 * Called once at server startup.
 */
export function initRateLimiter(database) {
  db = database;
  stmtIncrement = db.prepare(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`
  );
  stmtGet = db.prepare(
    "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?"
  );
  stmtCleanup = db.prepare(
    "DELETE FROM rate_limits WHERE window_start < ?"
  );

  // Auto-cleanup old windows every 5 minutes
  setInterval(() => {
    try {
      const cutoff = windowKey(Date.now() - WINDOW_MS * 2);
      stmtCleanup.run(cutoff);
    } catch (_) {}
  }, 5 * 60 * 1000);
}

/**
 * Compute the window key (start of the current 15-min window).
 */
function windowKey(now) {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

/**
 * Determine the agent's tier. In production this would query a subscription
 * table or external service. For now, reads X-Agent-Tier header or defaults to free.
 */
function getAgentTier(req) {
  const tier = (req.headers["x-agent-tier"] || "free").toLowerCase();
  return TIER_LIMITS[tier] ? tier : "free";
}

/**
 * Express middleware — rate limits every request passing through it.
 */
export function rateLimitMiddleware(req, res, next) {
  if (!db) return next(); // If DB not initialized, pass through (startup race)

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  const agentId = req.headers["x-agent-id"] || "anon";
  const key = `${ip}:${agentId}`;

  const now = Date.now();
  const window = windowKey(now);
  const tier = getAgentTier(req);
  const limit = TIER_LIMITS[tier];

  try {
    // Increment counter
    stmtIncrement.run(key, window);

    // Read current count
    const row = stmtGet.get(key, window);
    const count = row ? row.count : 1;
    const remaining = Math.max(0, limit - count);

    res.set({
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil((window + WINDOW_MS) / 1000)),
      "X-RateLimit-Window": WINDOW_LABEL,
      "X-RateLimit-Tier": tier,
    });

    if (count > limit) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        tier,
        limit,
        window: WINDOW_LABEL,
        retry_after_seconds: Math.ceil((window + WINDOW_MS - now) / 1000),
      });
    }
  } catch (e) {
    // Non-fatal — don't break request processing if rate limiter fails
    console.error("Rate limiter error:", e.message);
  }

  next();
}
