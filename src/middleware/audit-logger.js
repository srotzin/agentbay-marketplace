/**
 * Global Audit Logger Middleware
 *
 * Logs every request to SQLite audit_log table.
 * Non-fatal: audit failures never break request processing.
 *
 * Fields: endpoint, method, agent_id, status_code, success, duration_ms, ip, created_at
 */

let db = null;
let stmtInsert = null;
let stmtCleanup = null;

const RETENTION_DAYS = 7;

/**
 * Initialize the audit logger with a database reference.
 * Called once at server startup.
 */
export function initAuditLogger(database) {
  db = database;
  stmtInsert = db.prepare(
    `INSERT INTO audit_log (endpoint, method, agent_id, ip, status_code, success, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  stmtCleanup = db.prepare(
    `DELETE FROM audit_log WHERE created_at < datetime('now', ?)`
  );

  // Auto-cleanup logs older than RETENTION_DAYS, every hour
  setInterval(() => {
    try {
      stmtCleanup.run(`-${RETENTION_DAYS} days`);
    } catch (_) {}
  }, 60 * 60 * 1000);
}

/**
 * Express middleware — logs every request on response finish.
 */
export function auditLogMiddleware(req, res, next) {
  if (!db) return next();

  const start = Date.now();

  res.on("finish", () => {
    try {
      const duration = Date.now() - start;
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
      const agentId = req.headers["x-agent-id"] || null;
      const success = res.statusCode >= 200 && res.statusCode < 400 ? 1 : 0;

      stmtInsert.run(
        req.originalUrl || req.url,
        req.method,
        agentId,
        ip,
        res.statusCode,
        success,
        duration
      );
    } catch (_) {
      // Non-fatal — never break request processing
    }
  });

  next();
}
