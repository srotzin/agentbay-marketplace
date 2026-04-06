import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const DATA_ROOM_BASE_FEE_USD  = 500;   // per active room per month
const EXTRA_PARTICIPANT_FEE   = 50;    // per participant over 5 per month
const INCLUDED_PARTICIPANTS   = 5;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS data_rooms (
    id                 TEXT PRIMARY KEY,
    tenant_id          TEXT,
    creator_agent_id   TEXT NOT NULL,
    name               TEXT NOT NULL,
    purpose            TEXT CHECK(purpose IN (
                         'due_diligence','m_and_a','litigation','audit',
                         'regulatory','competitive_intel','ip_licensing','joint_venture')),
    classification     TEXT DEFAULT 'confidential' CHECK(classification IN ('internal','confidential','secret','top_secret')),
    access_control     TEXT DEFAULT 'invite_only' CHECK(access_control IN ('invite_only','tenant_only','public')),
    watermark          INTEGER DEFAULT 1,
    expiry             TEXT,
    max_participants   INTEGER DEFAULT 20,
    status             TEXT DEFAULT 'active' CHECK(status IN ('draft','active','locked','archived','destroyed')),
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_room_participants (
    id                TEXT PRIMARY KEY,
    room_id           TEXT REFERENCES data_rooms(id),
    agent_id          TEXT NOT NULL,
    role              TEXT DEFAULT 'viewer' CHECK(role IN ('owner','admin','contributor','viewer','auditor')),
    permissions       TEXT DEFAULT '["view"]',
    nda_signed        INTEGER DEFAULT 0,
    nda_signed_at     TEXT,
    access_log_count  INTEGER DEFAULT 0,
    last_access       TEXT,
    added_at          TEXT DEFAULT (datetime('now')),
    UNIQUE(room_id, agent_id)
  );

  CREATE TABLE IF NOT EXISTS data_room_documents (
    id             TEXT PRIMARY KEY,
    room_id        TEXT REFERENCES data_rooms(id),
    uploaded_by    TEXT NOT NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    category       TEXT CHECK(category IN ('financial','legal','technical','operational','ip','hr','other')),
    classification TEXT DEFAULT 'confidential',
    size_bytes     INTEGER,
    content_hash   TEXT,
    version        INTEGER DEFAULT 1,
    status         TEXT DEFAULT 'active' CHECK(status IN ('active','redacted','deleted')),
    view_count     INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_room_activity (
    id          TEXT PRIMARY KEY,
    room_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    action      TEXT NOT NULL CHECK(action IN (
                  'view_document','download_document','upload_document','comment',
                  'invite_participant','revoke_access','sign_nda','export')),
    document_id TEXT,
    details     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoom(room_id) {
  return db.prepare("SELECT * FROM data_rooms WHERE id = ?").get(room_id);
}

function getParticipant(room_id, agent_id) {
  return db.prepare(
    "SELECT * FROM data_room_participants WHERE room_id = ? AND agent_id = ?"
  ).get(room_id, agent_id);
}

function requireParticipant(room_id, agent_id) {
  const p = getParticipant(room_id, agent_id);
  if (!p) throw new Error(`Agent ${agent_id} is not a participant in room ${room_id}`);
  return p;
}

function requirePermission(participant, permission) {
  const perms = JSON.parse(participant.permissions || "[]");
  if (!perms.includes(permission) && !perms.includes("admin")) {
    throw new Error(`Agent lacks '${permission}' permission in this data room`);
  }
}

function logActivity({ room_id, agent_id, action, document_id, details }) {
  db.prepare(`
    INSERT INTO data_room_activity (id, room_id, agent_id, action, document_id, details)
    VALUES (@id, @room_id, @agent_id, @action, @document_id, @details)
  `).run({
    id: uuid(),
    room_id,
    agent_id,
    action,
    document_id: document_id ?? null,
    details: details ? (typeof details === "object" ? JSON.stringify(details) : details) : null,
  });
}

function calculateMonthlyFee(participant_count) {
  const extra = Math.max(0, participant_count - INCLUDED_PARTICIPANTS);
  return DATA_ROOM_BASE_FEE_USD + extra * EXTRA_PARTICIPANT_FEE;
}

// ─── Data Room CRUD ───────────────────────────────────────────────────────────

/**
 * Create a new secure data room.
 */
export function createDataRoom({
  tenant_id,
  creator_agent_id,
  name,
  purpose,
  classification = "confidential",
  access_control = "invite_only",
  max_participants = 20,
  expiry_days,
}) {
  if (!creator_agent_id) throw new Error("creator_agent_id is required");
  if (!name)             throw new Error("name is required");

  const room_id = uuid();
  const expiry = expiry_days
    ? new Date(Date.now() + expiry_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO data_rooms
      (id, tenant_id, creator_agent_id, name, purpose, classification,
       access_control, max_participants, expiry, status)
    VALUES
      (@id, @tenant_id, @creator_agent_id, @name, @purpose, @classification,
       @access_control, @max_participants, @expiry, 'active')
  `).run({
    id: room_id,
    tenant_id: tenant_id ?? null,
    creator_agent_id,
    name,
    purpose: purpose ?? null,
    classification,
    access_control,
    max_participants,
    expiry,
  });

  // Creator is automatically the owner
  db.prepare(`
    INSERT INTO data_room_participants
      (id, room_id, agent_id, role, permissions, nda_signed, nda_signed_at)
    VALUES
      (@id, @room_id, @agent_id, 'owner',
       '["view","download","upload","comment","redact","admin"]',
       1, datetime('now'))
  `).run({ id: uuid(), room_id, agent_id: creator_agent_id });

  logActivity({ room_id, agent_id: creator_agent_id, action: "invite_participant",
    details: { note: "Room created, owner added" } });

  return getDataRoom(room_id);
}

/**
 * Invite a participant to a data room.
 */
export function inviteToRoom({ room_id, agent_id, role = "viewer", permissions }) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);
  if (room.status === "destroyed") throw new Error("Room has been destroyed");
  if (room.status === "locked") throw new Error("Room is locked — no new participants");

  const current_count = db.prepare(
    "SELECT COUNT(*) as n FROM data_room_participants WHERE room_id = ?"
  ).get(room_id).n;

  if (current_count >= room.max_participants) {
    throw new Error(`Data room has reached max participant limit (${room.max_participants})`);
  }

  const defaultPerms = {
    owner: ["view","download","upload","comment","redact","admin"],
    admin: ["view","download","upload","comment","redact","admin"],
    contributor: ["view","download","upload","comment"],
    viewer: ["view"],
    auditor: ["view"],
  };

  const perms = permissions ?? defaultPerms[role] ?? ["view"];

  db.prepare(`
    INSERT INTO data_room_participants (id, room_id, agent_id, role, permissions)
    VALUES (@id, @room_id, @agent_id, @role, @permissions)
    ON CONFLICT(room_id, agent_id) DO UPDATE SET
      role = excluded.role,
      permissions = excluded.permissions
  `).run({
    id: uuid(),
    room_id,
    agent_id,
    role,
    permissions: JSON.stringify(Array.isArray(perms) ? perms : [perms]),
  });

  logActivity({ room_id, agent_id, action: "invite_participant",
    details: { role, permissions: perms } });

  const new_count = db.prepare(
    "SELECT COUNT(*) as n FROM data_room_participants WHERE room_id = ?"
  ).get(room_id).n;

  return {
    room_id,
    agent_id,
    role,
    permissions: perms,
    monthly_fee_usd: calculateMonthlyFee(new_count),
    participant_count: new_count,
  };
}

/**
 * Agent signs NDA before accessing sensitive room content.
 */
export function signNDA({ room_id, agent_id }) {
  const participant = requireParticipant(room_id, agent_id);
  if (participant.nda_signed) {
    return { room_id, agent_id, nda_signed: true, nda_signed_at: participant.nda_signed_at, message: "NDA already signed" };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE data_room_participants
    SET nda_signed = 1, nda_signed_at = ?
    WHERE room_id = ? AND agent_id = ?
  `).run(now, room_id, agent_id);

  logActivity({ room_id, agent_id, action: "sign_nda", details: { signed_at: now } });

  return { room_id, agent_id, nda_signed: true, nda_signed_at: now };
}

// ─── Document Management ──────────────────────────────────────────────────────

/**
 * Upload a document to a data room.
 */
export function uploadDocument({
  room_id,
  agent_id,
  name,
  description,
  category,
  classification = "confidential",
  content_hash,
  size_bytes,
}) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);
  if (room.status === "destroyed") throw new Error("Room has been destroyed");
  if (room.status === "locked")   throw new Error("Room is locked — no uploads allowed");

  const participant = requireParticipant(room_id, agent_id);
  if (!participant.nda_signed) throw new Error("NDA must be signed before uploading documents");
  requirePermission(participant, "upload");

  const doc_id = uuid();

  db.prepare(`
    INSERT INTO data_room_documents
      (id, room_id, uploaded_by, name, description, category,
       classification, size_bytes, content_hash)
    VALUES
      (@id, @room_id, @uploaded_by, @name, @description, @category,
       @classification, @size_bytes, @content_hash)
  `).run({
    id: doc_id,
    room_id,
    uploaded_by: agent_id,
    name,
    description: description ?? null,
    category: category ?? null,
    classification,
    size_bytes: size_bytes ?? null,
    content_hash: content_hash ?? null,
  });

  logActivity({ room_id, agent_id, action: "upload_document", document_id: doc_id,
    details: { name, category, classification, size_bytes } });

  return db.prepare("SELECT * FROM data_room_documents WHERE id = ?").get(doc_id);
}

/**
 * View a document (logs access, enforces NDA + view permission).
 */
export function viewDocument({ room_id, document_id, agent_id }) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);
  if (room.status === "destroyed") throw new Error("Room has been destroyed");

  const participant = requireParticipant(room_id, agent_id);
  if (!participant.nda_signed) throw new Error("NDA must be signed before viewing documents");
  requirePermission(participant, "view");

  const doc = db.prepare(
    "SELECT * FROM data_room_documents WHERE id = ? AND room_id = ? AND status = 'active'"
  ).get(document_id, room_id);
  if (!doc) throw new Error(`Document not found: ${document_id}`);

  // Increment view count
  db.prepare("UPDATE data_room_documents SET view_count = view_count + 1 WHERE id = ?").run(document_id);

  // Update participant access log
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE data_room_participants
    SET access_log_count = access_log_count + 1, last_access = ?
    WHERE room_id = ? AND agent_id = ?
  `).run(now, room_id, agent_id);

  logActivity({ room_id, agent_id, action: "view_document", document_id,
    details: { document_name: doc.name, watermark: room.watermark === 1 } });

  return {
    ...doc,
    watermarked: room.watermark === 1,
    watermark_agent: room.watermark === 1 ? agent_id : null,
    accessed_at: now,
  };
}

/**
 * Download a document (stricter permission check, logs download).
 */
export function downloadDocument({ room_id, document_id, agent_id }) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);
  if (room.status === "destroyed") throw new Error("Room has been destroyed");

  const participant = requireParticipant(room_id, agent_id);
  if (!participant.nda_signed) throw new Error("NDA must be signed before downloading documents");
  requirePermission(participant, "download");

  const doc = db.prepare(
    "SELECT * FROM data_room_documents WHERE id = ? AND room_id = ? AND status = 'active'"
  ).get(document_id, room_id);
  if (!doc) throw new Error(`Document not found: ${document_id}`);

  // Increment download count
  db.prepare("UPDATE data_room_documents SET download_count = download_count + 1 WHERE id = ?").run(document_id);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE data_room_participants
    SET access_log_count = access_log_count + 1, last_access = ?
    WHERE room_id = ? AND agent_id = ?
  `).run(now, room_id, agent_id);

  logActivity({ room_id, agent_id, action: "download_document", document_id,
    details: { document_name: doc.name, content_hash: doc.content_hash } });

  return {
    ...doc,
    download_token: `dl_${uuid()}`,   // In prod: signed URL
    watermarked: room.watermark === 1,
    watermark_agent: room.watermark === 1 ? agent_id : null,
    downloaded_at: now,
  };
}

// ─── Room Info & Access ───────────────────────────────────────────────────────

/**
 * Get full data room details: participants, documents, billing.
 */
export function getDataRoom(room_id) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);

  const participants = db.prepare(
    "SELECT * FROM data_room_participants WHERE room_id = ? ORDER BY added_at"
  ).all(room_id);
  participants.forEach(p => { p.permissions = JSON.parse(p.permissions || "[]"); });

  const documents = db.prepare(
    "SELECT * FROM data_room_documents WHERE room_id = ? AND status != 'deleted' ORDER BY created_at DESC"
  ).all(room_id);

  const activity_count = db.prepare(
    "SELECT COUNT(*) as n FROM data_room_activity WHERE room_id = ?"
  ).get(room_id).n;

  const monthly_fee_usd = calculateMonthlyFee(participants.length);

  return {
    ...room,
    participants,
    participant_count: participants.length,
    documents,
    document_count: documents.length,
    activity_count,
    monthly_fee_usd,
    extra_participant_charges: Math.max(0, participants.length - INCLUDED_PARTICIPANTS) * EXTRA_PARTICIPANT_FEE,
  };
}

/**
 * List all data rooms an agent has access to.
 */
export function getAgentRooms(agent_id) {
  const memberships = db.prepare(
    "SELECT * FROM data_room_participants WHERE agent_id = ? ORDER BY added_at DESC"
  ).all(agent_id);

  const rooms = memberships.map(m => {
    const room = db.prepare("SELECT * FROM data_rooms WHERE id = ?").get(m.room_id);
    if (!room) return null;
    return {
      ...room,
      participant_role: m.role,
      permissions: JSON.parse(m.permissions || "[]"),
      nda_signed: m.nda_signed === 1,
    };
  }).filter(Boolean);

  return { agent_id, rooms, count: rooms.length };
}

/**
 * Get full activity log for a data room.
 */
export function getRoomActivity(room_id) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);

  const activities = db.prepare(
    "SELECT * FROM data_room_activity WHERE room_id = ? ORDER BY created_at DESC"
  ).all(room_id);

  activities.forEach(a => {
    if (a.details) {
      try { a.details = JSON.parse(a.details); } catch { /* keep as string */ }
    }
  });

  return { room_id, room_name: room.name, activities, count: activities.length };
}

// ─── Room Lifecycle ───────────────────────────────────────────────────────────

/**
 * Lock a data room — no new uploads, invites, or modifications.
 */
export function lockRoom(room_id) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);
  if (room.status === "destroyed") throw new Error("Cannot lock a destroyed room");

  db.prepare("UPDATE data_rooms SET status = 'locked' WHERE id = ?").run(room_id);

  logActivity({ room_id, agent_id: room.creator_agent_id, action: "comment",
    details: { note: "Room locked by creator" } });

  return { room_id, status: "locked", name: room.name };
}

/**
 * Permanently destroy a data room and mark all documents as deleted.
 */
export function destroyRoom(room_id) {
  const room = getRoom(room_id);
  if (!room) throw new Error(`Data room not found: ${room_id}`);

  db.prepare("UPDATE data_room_documents SET status = 'deleted' WHERE room_id = ?").run(room_id);
  db.prepare("UPDATE data_rooms SET status = 'destroyed' WHERE id = ?").run(room_id);

  logActivity({ room_id, agent_id: room.creator_agent_id, action: "comment",
    details: { note: "Room permanently destroyed. All documents purged." } });

  return {
    room_id,
    status: "destroyed",
    name: room.name,
    destroyed_at: new Date().toISOString(),
    warning: "Room and all documents are permanently destroyed and unrecoverable.",
  };
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

/**
 * Get platform-wide data room statistics.
 */
export function getDataRoomStats() {
  const total_rooms = db.prepare("SELECT COUNT(*) as n FROM data_rooms").get().n;

  const active_rooms = db.prepare(
    "SELECT COUNT(*) as n FROM data_rooms WHERE status = 'active'"
  ).get().n;

  const total_documents = db.prepare(
    "SELECT COUNT(*) as n FROM data_room_documents WHERE status = 'active'"
  ).get().n;

  const total_participants = db.prepare(
    "SELECT COUNT(*) as n FROM data_room_participants"
  ).get().n;

  // MRR calculation: sum of fees per active room
  const activeRooms = db.prepare(
    "SELECT id FROM data_rooms WHERE status = 'active'"
  ).all();

  let mrr_usd = 0;
  for (const r of activeRooms) {
    const count = db.prepare(
      "SELECT COUNT(*) as n FROM data_room_participants WHERE room_id = ?"
    ).get(r.id).n;
    mrr_usd += calculateMonthlyFee(count);
  }

  const by_purpose = db.prepare(`
    SELECT purpose, COUNT(*) as count
    FROM data_rooms
    WHERE status IN ('active','locked') AND purpose IS NOT NULL
    GROUP BY purpose
    ORDER BY count DESC
  `).all();

  const by_classification = db.prepare(`
    SELECT classification, COUNT(*) as count
    FROM data_rooms
    WHERE status IN ('active','locked')
    GROUP BY classification
    ORDER BY count DESC
  `).all();

  const total_downloads = db.prepare(
    "SELECT COALESCE(SUM(download_count),0) as n FROM data_room_documents"
  ).get().n;

  const total_views = db.prepare(
    "SELECT COALESCE(SUM(view_count),0) as n FROM data_room_documents"
  ).get().n;

  return {
    total_rooms,
    active_rooms,
    total_documents,
    total_participants,
    total_views,
    total_downloads,
    mrr_usd,
    arr_usd: mrr_usd * 12,
    avg_fee_per_room: active_rooms > 0 ? Math.round(mrr_usd / active_rooms) : 0,
    by_purpose,
    by_classification,
  };
}
