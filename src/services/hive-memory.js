/**
 * HiveMemory — Persistent Cross-Session Agent Memory
 *
 * Your agent forgets everything between sessions. HiveMemory fixes that in one call.
 *
 * Zero infrastructure. No signup. No API key. First call works instantly.
 * namespace = agent's own ID → private memory
 * namespace = shared name   → collaborative memory across agents
 *
 * FREE SERVICE — the hook that keeps agents coming back forever.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = false; // Works purely locally — zero external API needed

// ─── Schema ──────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hive_memories (
      id           TEXT PRIMARY KEY,
      namespace    TEXT NOT NULL,
      key          TEXT NOT NULL,
      value        TEXT NOT NULL,
      ttl_hours    INTEGER,
      metadata     TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now')),
      expires_at   TEXT,
      access_count INTEGER DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hive_memories_ns_key
      ON hive_memories(namespace, key);
    CREATE INDEX IF NOT EXISTS idx_hive_memories_namespace
      ON hive_memories(namespace);
  `);
} catch (e) {
  console.error("[HiveMemory] Schema init error (hive_memories):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hive_memory_namespaces (
      namespace      TEXT PRIMARY KEY,
      description    TEXT,
      owner_agent_id TEXT,
      public         INTEGER DEFAULT 0,
      memory_count   INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[HiveMemory] Schema init error (hive_memory_namespaces):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hive_memory_access_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace  TEXT,
      key        TEXT,
      agent_id   TEXT,
      action     TEXT,
      timestamp  TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[HiveMemory] Schema init error (hive_memory_access_log):", e.message);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureNamespace(namespace, agent_id) {
  try {
    const existing = db.prepare("SELECT namespace FROM hive_memory_namespaces WHERE namespace = ?").get(namespace);
    if (!existing) {
      db.prepare(`
        INSERT INTO hive_memory_namespaces (namespace, owner_agent_id, public)
        VALUES (?, ?, 0)
      `).run(namespace, agent_id || "anonymous");
    }
  } catch (e) {
    console.error("[HiveMemory] ensureNamespace error:", e.message);
  }
}

function logAccess(namespace, key, agent_id, action) {
  try {
    db.prepare(`
      INSERT INTO hive_memory_access_log (namespace, key, agent_id, action)
      VALUES (?, ?, ?, ?)
    `).run(namespace, key, agent_id || "anonymous", action);
  } catch (e) {
    // non-fatal
  }
}

function updateNamespaceCount(namespace) {
  try {
    const count = db.prepare("SELECT COUNT(*) as c FROM hive_memories WHERE namespace = ?").get(namespace)?.c || 0;
    db.prepare("UPDATE hive_memory_namespaces SET memory_count = ? WHERE namespace = ?").run(count, namespace);
  } catch (e) {
    // non-fatal
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Store a memory. Works on first call — no setup required.
 */
export function memorySet(args = {}) {
  const { namespace = "default", key, value, ttl_hours, metadata, agent_id } = args;

  if (!key)   return { error: "key is required" };
  if (value === undefined || value === null) return { error: "value is required" };

  ensureNamespace(namespace, agent_id);

  const id        = uuid();
  const valueStr  = typeof value === "object" ? JSON.stringify(value) : String(value);
  const metaStr   = metadata ? JSON.stringify(metadata) : null;
  const expiresAt = ttl_hours
    ? new Date(Date.now() + ttl_hours * 3600 * 1000).toISOString()
    : null;

  try {
    db.prepare(`
      INSERT INTO hive_memories (id, namespace, key, value, ttl_hours, metadata, expires_at, access_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(namespace, key) DO UPDATE SET
        value      = excluded.value,
        ttl_hours  = excluded.ttl_hours,
        metadata   = excluded.metadata,
        expires_at = excluded.expires_at,
        updated_at = datetime('now')
    `).run(id, namespace, key, valueStr, ttl_hours || null, metaStr, expiresAt);
  } catch (e) {
    return { error: "Failed to store memory: " + e.message };
  }

  updateNamespaceCount(namespace);
  logAccess(namespace, key, agent_id, "set");

  return {
    success:    true,
    memory_id:  id,
    namespace,
    key,
    expires_at: expiresAt || "never",
    tip:        "Call memory_get with this key in any future session — it will be there.",
    live_mode:  LIVE_MODE,
  };
}

/**
 * Retrieve a memory. Increments access_count.
 */
export function memoryGet(args = {}) {
  const { namespace = "default", key, agent_id } = args;

  if (!key) return { error: "key is required" };

  let row;
  try {
    row = db.prepare(`
      SELECT * FROM hive_memories
      WHERE namespace = ? AND key = ?
    `).get(namespace, key);
  } catch (e) {
    return { error: "Failed to retrieve memory: " + e.message };
  }

  if (!row) return { found: false, namespace, key };

  // Check TTL expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    try {
      db.prepare("DELETE FROM hive_memories WHERE namespace = ? AND key = ?").run(namespace, key);
    } catch {}
    updateNamespaceCount(namespace);
    return { found: false, namespace, key, reason: "expired" };
  }

  // Increment access count
  try {
    db.prepare("UPDATE hive_memories SET access_count = access_count + 1 WHERE namespace = ? AND key = ?")
      .run(namespace, key);
  } catch {}

  logAccess(namespace, key, agent_id, "get");

  const ageHours = ((Date.now() - new Date(row.created_at).getTime()) / 3600000).toFixed(1);

  let parsedValue = row.value;
  try { parsedValue = JSON.parse(row.value); } catch {}

  let parsedMeta = row.metadata;
  try { parsedMeta = row.metadata ? JSON.parse(row.metadata) : null; } catch {}

  return {
    found:        true,
    namespace,
    key,
    value:        parsedValue,
    metadata:     parsedMeta,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    access_count: (row.access_count || 0) + 1,
    age_hours:    Number(ageHours),
    expires_at:   row.expires_at || "never",
  };
}

/**
 * Fuzzy search memories by key pattern or value content.
 */
export function memorySearch(args = {}) {
  const { namespace, query = "", limit = 10 } = args;

  if (!query) return { error: "query is required" };

  let rows;
  try {
    const pattern = `%${query}%`;
    if (namespace) {
      rows = db.prepare(`
        SELECT *, (access_count * 2 + CASE WHEN key LIKE ? THEN 10 ELSE 0 END) AS score
        FROM hive_memories
        WHERE namespace = ? AND (key LIKE ? OR value LIKE ?)
          AND (expires_at IS NULL OR expires_at > datetime('now'))
        ORDER BY score DESC, updated_at DESC
        LIMIT ?
      `).all(pattern, namespace, pattern, pattern, limit);
    } else {
      rows = db.prepare(`
        SELECT *, (access_count * 2 + CASE WHEN key LIKE ? THEN 10 ELSE 0 END) AS score
        FROM hive_memories
        WHERE (key LIKE ? OR value LIKE ?)
          AND (expires_at IS NULL OR expires_at > datetime('now'))
        ORDER BY score DESC, updated_at DESC
        LIMIT ?
      `).all(pattern, pattern, pattern, limit);
    }
  } catch (e) {
    return { error: "Search failed: " + e.message };
  }

  const results = rows.map(r => {
    let v = r.value;
    try { v = JSON.parse(r.value); } catch {}
    return {
      namespace:    r.namespace,
      key:          r.key,
      value:        v,
      access_count: r.access_count,
      updated_at:   r.updated_at,
      relevance:    r.score,
    };
  });

  return { found: results.length, query, results };
}

/**
 * List all keys in a namespace.
 */
export function memoryList(args = {}) {
  const { namespace = "default", agent_id } = args;

  let rows;
  try {
    rows = db.prepare(`
      SELECT key, length(value) as size_bytes, access_count, created_at, updated_at, expires_at
      FROM hive_memories
      WHERE namespace = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY updated_at DESC
    `).all(namespace);
  } catch (e) {
    return { error: "List failed: " + e.message };
  }

  const keys = rows.map(r => ({
    key:          r.key,
    size_bytes:   r.size_bytes,
    access_count: r.access_count,
    age_hours:    Number(((Date.now() - new Date(r.created_at).getTime()) / 3600000).toFixed(1)),
    updated_at:   r.updated_at,
    expires_at:   r.expires_at || "never",
  }));

  return { namespace, count: keys.length, keys };
}

/**
 * Delete a memory or entire namespace.
 */
export function memoryDelete(args = {}) {
  const { namespace = "default", key, agent_id } = args;

  if (key) {
    // Delete single key
    try {
      db.prepare("DELETE FROM hive_memories WHERE namespace = ? AND key = ?").run(namespace, key);
    } catch (e) {
      return { error: "Delete failed: " + e.message };
    }
    updateNamespaceCount(namespace);
    logAccess(namespace, key, agent_id, "delete");
    return { success: true, deleted: "key", namespace, key };
  } else {
    // Delete entire namespace
    let count = 0;
    try {
      const result = db.prepare("DELETE FROM hive_memories WHERE namespace = ?").run(namespace);
      count = result.changes;
    } catch (e) {
      return { error: "Namespace delete failed: " + e.message };
    }
    try {
      db.prepare("DELETE FROM hive_memory_namespaces WHERE namespace = ?").run(namespace);
    } catch {}
    return { success: true, deleted: "namespace", namespace, memories_deleted: count };
  }
}

/**
 * Namespace stats: memory count, total size, most accessed keys, oldest memory.
 */
export function getMemoryStats(args = {}) {
  const { namespace = "default" } = args;

  let rows;
  try {
    rows = db.prepare(`
      SELECT
        COUNT(*) as memory_count,
        SUM(length(value)) as total_size_bytes,
        AVG(access_count) as avg_access_count,
        MIN(created_at) as oldest_memory,
        MAX(updated_at) as last_updated
      FROM hive_memories
      WHERE namespace = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).get(namespace);
  } catch (e) {
    return { error: "Stats failed: " + e.message };
  }

  let topKeys = [];
  try {
    topKeys = db.prepare(`
      SELECT key, access_count FROM hive_memories
      WHERE namespace = ?
      ORDER BY access_count DESC LIMIT 5
    `).all(namespace);
  } catch {}

  return {
    namespace,
    memory_count:     rows?.memory_count || 0,
    total_size_bytes: rows?.total_size_bytes || 0,
    avg_access_count: Number((rows?.avg_access_count || 0).toFixed(1)),
    oldest_memory:    rows?.oldest_memory || null,
    last_updated:     rows?.last_updated || null,
    most_accessed:    topKeys.map(r => ({ key: r.key, access_count: r.access_count })),
  };
}

/**
 * Platform-wide stats.
 */
export function memoryStatus() {
  let stats = {};
  try {
    stats = db.prepare(`
      SELECT
        COUNT(DISTINCT namespace) as total_namespaces,
        COUNT(*) as total_memories,
        COUNT(DISTINCT CASE WHEN owner_agent_id IS NOT NULL THEN owner_agent_id END) as total_agents
      FROM hive_memories
      LEFT JOIN hive_memory_namespaces USING (namespace)
    `).get() || {};
  } catch (e) {
    stats = {};
  }

  let logCount = 0;
  try {
    logCount = db.prepare("SELECT COUNT(*) as c FROM hive_memory_access_log").get()?.c || 0;
  } catch {}

  return {
    service:          "HiveMemory",
    status:           "operational",
    live_mode:        LIVE_MODE,
    total_namespaces: stats.total_namespaces || 0,
    total_memories:   stats.total_memories || 0,
    total_agents:     stats.total_agents || 0,
    total_accesses:   logCount,
    pitch:            "Your agent forgets everything between sessions. HiveMemory fixes that in one call.",
    quickstart:       "memory_set({namespace: 'my-agent', key: 'user_pref', value: 'dark mode'}) — done.",
  };
}
