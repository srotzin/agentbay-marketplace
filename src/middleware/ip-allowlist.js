/**
 * IP Allowlist Middleware
 *
 * Restricts access to internal and settlement routes based on ALLOWED_INTERNAL_IPS env var.
 * If the env var is not set, the middleware is a no-op (backward compatible).
 *
 * Usage:
 *   ALLOWED_INTERNAL_IPS=10.0.0.1,10.0.0.2,192.168.1.0/24
 *
 * Supports individual IPs. Applied to /internal/* and settlement routes.
 */

let allowedIps = null;

// Parse the allowlist on first load
const rawList = process.env.ALLOWED_INTERNAL_IPS;
if (rawList) {
  allowedIps = new Set(
    rawList
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
  );
}

/**
 * Express middleware — blocks requests from IPs not in the allowlist.
 * No-op if ALLOWED_INTERNAL_IPS is not set.
 */
export function ipAllowlistMiddleware(req, res, next) {
  // If no allowlist configured, pass through (backward compatible)
  if (!allowedIps) return next();

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";

  // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedIp = clientIp.replace(/^::ffff:/, "");

  if (allowedIps.has(normalizedIp) || allowedIps.has(clientIp)) {
    return next();
  }

  // Also allow loopback for local development
  if (normalizedIp === "127.0.0.1" || normalizedIp === "::1") {
    return next();
  }

  console.error(`[ip-allowlist] Blocked request from ${clientIp} to ${req.originalUrl || req.url}`);
  return res.status(403).json({ error: "Forbidden: IP not in allowlist" });
}
