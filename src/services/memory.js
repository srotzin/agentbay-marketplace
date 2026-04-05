/**
 * HiveAgent Agent Memory Service
 *
 * Persistent key-value store that survives across sessions.
 * Agents can store, retrieve, and search data with optional TTL.
 * Supports namespaces and named collections.
 *
 * FREE SERVICE — the hook that gets agents to connect and stay.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    namespace TEXT DEFAULT 'default',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT DEFAULT 'string',
    ttl_seconds INTEGER,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_id, namespace, key)
  );

  CREATE TABLE IF NOT EXISTS memory_collections (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    item_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memory_collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT REFERENCES memory_collections(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memory_stats (
    agent_id TEXT PRIMARY KEY,
    total_keys INTEGER DEFAULT 0,
    total_size_bytes INTEGER DEFAULT 0,
    collections_count INTEGER DEFAULT 0,
    last_access TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_memory_agent_ns ON agent_memory(agent_id, namespace);
  CREATE INDEX IF NOT EXISTS idx_memory_expires ON agent_memory(expires_at);
`);

// ─── Helpers ──────────────────────────────────────

/**
 * Detect value type from a JavaScript value
 */
function detectType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) return "json";
  return "string";
}

/**
 * Serialize a value to a string for storage
 */
function serializeValue(value, type) {
  if (type === "json") return JSON.stringify(value);
  return String(value);
}

/**
 * Deserialize a stored string back to its typed value
 */
function deserializeValue(str, type) {
  if (type === "json") {
    try { return JSON.parse(str); } catch { return str; }
  }
  if (type === "number") return Number(str);
  if (type === "boolean") return str === "true";
  return str;
}

/**
 * Upsert memory stats for an agent (insert or update)
 */
function upsertStats(agent_id) {
  const keyCount = db.prepare(
    "SELECT COUNT(*) as c FROM agent_memory WHERE agent_id = ?"
  ).get(agent_id).c;

  const sizeResult = db.prepare(
    "SELECT COALESCE(SUM(LENGTH(key) + LENGTH(value)), 0) as s FROM agent_memory WHERE agent_id = ?"
  ).get(agent_id).s;

  const collCount = db.prepare(
    "SELECT COUNT(*) as c FROM memory_collections WHERE agent_id = ?"
  ).get(agent_id).c;

  db.prepare(`
    INSERT INTO memory_stats (agent_id, total_keys, total_size_bytes, collections_count, last_access)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(agent_id) DO UPDATE SET
      total_keys = excluded.total_keys,
      total_size_bytes = excluded.total_size_bytes,
      collections_count = excluded.collections_count,
      last_access = datetime('now')
  `).run(agent_id, keyCount, sizeResult, collCount);
}

// ─── Core Memory Operations ───────────────────────

/**
 * Store a value in agent memory.
 * Auto-detects value_type. Supports TTL. Upserts on duplicate key.
 */
export function set({ agent_id, key, value, namespace = "default", ttl_seconds } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!key) throw new Error("key is required");
  if (value === undefined || value === null) throw new Error("value is required");

  const value_type = detectType(value);
  const serialized = serializeValue(value, value_type);

  let expires_at = null;
  if (ttl_seconds && ttl_seconds > 0) {
    const exp = new Date(Date.now() + ttl_seconds * 1000);
    expires_at = exp.toISOString();
  }

  db.prepare(`
    INSERT INTO agent_memory (agent_id, namespace, key, value, value_type, ttl_seconds, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(agent_id, namespace, key) DO UPDATE SET
      value = excluded.value,
      value_type = excluded.value_type,
      ttl_seconds = excluded.ttl_seconds,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(agent_id, namespace, key, serialized, value_type, ttl_seconds || null, expires_at);

  upsertStats(agent_id);

  return {
    agent_id,
    namespace,
    key,
    value_type,
    ttl_seconds: ttl_seconds || null,
    expires_at,
    stored: true,
  };
}

/**
 * Retrieve a value from agent memory.
 * Returns null if key does not exist or has expired.
 */
export function get({ agent_id, key, namespace = "default" } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!key) throw new Error("key is required");

  const row = db.prepare(`
    SELECT * FROM agent_memory
    WHERE agent_id = ? AND namespace = ? AND key = ?
  `).get(agent_id, namespace, key);

  if (!row) return null;

  // Check TTL expiry
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    db.prepare("DELETE FROM agent_memory WHERE id = ?").run(row.id);
    upsertStats(agent_id);
    return null;
  }

  // Update last_access
  db.prepare(`
    INSERT INTO memory_stats (agent_id, last_access)
    VALUES (?, datetime('now'))
    ON CONFLICT(agent_id) DO UPDATE SET last_access = datetime('now')
  `).run(agent_id);

  return {
    agent_id,
    namespace,
    key,
    value: deserializeValue(row.value, row.value_type),
    value_type: row.value_type,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Delete a key from agent memory.
 */
export function del({ agent_id, key, namespace = "default" } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!key) throw new Error("key is required");

  const result = db.prepare(`
    DELETE FROM agent_memory WHERE agent_id = ? AND namespace = ? AND key = ?
  `).run(agent_id, namespace, key);

  upsertStats(agent_id);

  return { deleted: result.changes > 0, key, namespace };
}

// Export as 'delete' alias too
export { del as delete };

/**
 * List keys in an agent's namespace with optional prefix filter.
 */
export function list({ agent_id, namespace = "default", prefix, limit = 100 } = {}) {
  if (!agent_id) throw new Error("agent_id is required");

  // First clean expired keys
  db.prepare(`
    DELETE FROM agent_memory WHERE agent_id = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')
  `).run(agent_id);

  let sql = `
    SELECT key, value_type, updated_at, expires_at
    FROM agent_memory
    WHERE agent_id = ? AND namespace = ?
  `;
  const params = [agent_id, namespace];

  if (prefix) {
    sql += " AND key LIKE ?";
    params.push(`${prefix}%`);
  }

  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  return {
    agent_id,
    namespace,
    prefix: prefix || null,
    keys: rows,
    count: rows.length,
  };
}

/**
 * Search across keys AND values using a LIKE query.
 */
export function search({ agent_id, query, namespace } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!query) throw new Error("query is required");

  // Clean expired first
  db.prepare(`
    DELETE FROM agent_memory WHERE agent_id = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')
  `).run(agent_id);

  let sql = `
    SELECT key, value, value_type, namespace, updated_at
    FROM agent_memory
    WHERE agent_id = ?
    AND (key LIKE ? OR value LIKE ?)
  `;
  const likeQuery = `%${query}%`;
  const params = [agent_id, likeQuery, likeQuery];

  if (namespace) {
    sql += " AND namespace = ?";
    params.push(namespace);
  }

  sql += " ORDER BY updated_at DESC LIMIT 50";

  const rows = db.prepare(sql).all(...params);

  return {
    agent_id,
    query,
    namespace: namespace || null,
    results: rows.map(r => ({
      ...r,
      value: deserializeValue(r.value, r.value_type),
    })),
    count: rows.length,
  };
}

// ─── Collections ──────────────────────────────────

/**
 * Create a named collection (like a folder for grouping related keys).
 */
export function createCollection({ agent_id, name, description } = {}) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!name) throw new Error("name is required");

  const id = uuid();

  db.prepare(`
    INSERT INTO memory_collections (id, agent_id, name, description)
    VALUES (?, ?, ?, ?)
  `).run(id, agent_id, name, description || null);

  upsertStats(agent_id);

  return {
    collection_id: id,
    agent_id,
    name,
    description: description || null,
    item_count: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Add an item to a collection.
 */
export function addToCollection({ collection_id, key, value, metadata } = {}) {
  if (!collection_id) throw new Error("collection_id is required");
  if (!key) throw new Error("key is required");
  if (value === undefined || value === null) throw new Error("value is required");

  const collection = db.prepare("SELECT * FROM memory_collections WHERE id = ?").get(collection_id);
  if (!collection) throw new Error("Collection not found");

  const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  db.prepare(`
    INSERT INTO memory_collection_items (collection_id, key, value, metadata)
    VALUES (?, ?, ?, ?)
  `).run(collection_id, key, serialized, metadataStr);

  db.prepare("UPDATE memory_collections SET item_count = item_count + 1 WHERE id = ?").run(collection_id);

  return {
    collection_id,
    key,
    added: true,
    item_count: collection.item_count + 1,
  };
}

/**
 * Get a collection with all its items.
 */
export function getCollection(collection_id) {
  if (!collection_id) throw new Error("collection_id is required");

  const collection = db.prepare("SELECT * FROM memory_collections WHERE id = ?").get(collection_id);
  if (!collection) throw new Error("Collection not found");

  const items = db.prepare(`
    SELECT id, key, value, metadata, created_at
    FROM memory_collection_items
    WHERE collection_id = ?
    ORDER BY created_at ASC
  `).all(collection_id);

  return {
    ...collection,
    items: items.map(item => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null,
    })),
  };
}

/**
 * Delete all keys in a given namespace for an agent.
 */
export function clearNamespace({ agent_id, namespace = "default" } = {}) {
  if (!agent_id) throw new Error("agent_id is required");

  const result = db.prepare(`
    DELETE FROM agent_memory WHERE agent_id = ? AND namespace = ?
  `).run(agent_id, namespace);

  upsertStats(agent_id);

  return {
    agent_id,
    namespace,
    deleted_count: result.changes,
  };
}

/**
 * Get memory usage statistics for an agent.
 */
export function getMemoryStats(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");

  // Clean expired first
  db.prepare(`
    DELETE FROM agent_memory WHERE agent_id = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')
  `).run(agent_id);

  upsertStats(agent_id);

  const stats = db.prepare("SELECT * FROM memory_stats WHERE agent_id = ?").get(agent_id);

  const namespaces = db.prepare(`
    SELECT namespace, COUNT(*) as key_count
    FROM agent_memory
    WHERE agent_id = ?
    GROUP BY namespace
    ORDER BY key_count DESC
  `).all(agent_id);

  const collections = db.prepare(`
    SELECT id, name, item_count, created_at
    FROM memory_collections
    WHERE agent_id = ?
    ORDER BY created_at DESC
  `).all(agent_id);

  return {
    agent_id,
    total_keys: stats ? stats.total_keys : 0,
    total_size_bytes: stats ? stats.total_size_bytes : 0,
    collections_count: stats ? stats.collections_count : 0,
    last_access: stats ? stats.last_access : null,
    namespaces,
    collections,
  };
}

/**
 * Batch delete all expired keys across all agents.
 * Called by a periodic cleanup job.
 */
export function cleanExpired() {
  const result = db.prepare(`
    DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
  `).run();

  return {
    deleted_count: result.changes,
    cleaned_at: new Date().toISOString(),
  };
}
