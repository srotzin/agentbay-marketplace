import { v4 as uuid } from "uuid";
import db from "../db.js";

// Developer Relations Ops
// PRDs for devrel: manage hackathons, bounties, and community submissions.

// ─── Schema Init ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS devrel_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'hackathon',
    starts_at TEXT,
    ends_at TEXT,
    location TEXT,
    url TEXT,
    prize_pool_usd REAL DEFAULT 0,
    status TEXT DEFAULT 'planned',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devrel_bounties (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    reward_usd REAL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    difficulty TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devrel_submissions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    bounty_id TEXT,
    submitter_agent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,
    demo_url TEXT,
    status TEXT DEFAULT 'submitted',
    score REAL,
    reviewer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_devrel_submissions_event ON devrel_submissions(event_id);
  CREATE INDEX IF NOT EXISTS idx_devrel_submissions_bounty ON devrel_submissions(bounty_id);
`);

function isoDateTime(d) {
  return d ? new Date(d).toISOString() : null;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function createDevrelEvent({
  name,
  type = "hackathon",
  starts_at,
  ends_at,
  location,
  url,
  prize_pool_usd = 0,
  status = "planned",
  notes,
}) {
  if (!name) throw new Error("name is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO devrel_events (id, name, type, starts_at, ends_at, location, url, prize_pool_usd, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    type,
    isoDateTime(starts_at),
    isoDateTime(ends_at),
    location || null,
    url || null,
    Number(prize_pool_usd) || 0,
    status,
    notes || null
  );
  return getDevrelEvent(id);
}

export function listDevrelEvents({ status, limit = 50 } = {}) {
  if (status) {
    return db
      .prepare(
        `SELECT * FROM devrel_events
         WHERE status = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      )
      .all(status, limit);
  }
  return db
    .prepare(
      `SELECT * FROM devrel_events
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getDevrelEvent(id) {
  const row = db.prepare("SELECT * FROM devrel_events WHERE id = ?").get(id);
  if (!row) throw new Error("Event not found");
  return row;
}

export function updateDevrelEventStatus({ event_id, status }) {
  if (!event_id) throw new Error("event_id is required");
  if (!status) throw new Error("status is required");
  db.prepare("UPDATE devrel_events SET status = ? WHERE id = ?").run(status, event_id);
  return getDevrelEvent(event_id);
}

// ─── Bounties ────────────────────────────────────────────────────────────────

export function createBounty({ title, description, reward_usd = 0, tags = [], difficulty = "medium" }) {
  if (!title) throw new Error("title is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO devrel_bounties (id, title, description, reward_usd, tags, difficulty)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, title, description || null, Number(reward_usd) || 0, JSON.stringify(tags || []), difficulty);
  return getBounty(id);
}

export function listBounties({ status, limit = 100 } = {}) {
  if (status) {
    return db
      .prepare(
        `SELECT * FROM devrel_bounties
         WHERE status = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      )
      .all(status, limit);
  }
  return db
    .prepare(
      `SELECT * FROM devrel_bounties
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getBounty(id) {
  const row = db.prepare("SELECT * FROM devrel_bounties WHERE id = ?").get(id);
  if (!row) throw new Error("Bounty not found");
  return { ...row, tags: safeJson(row.tags, []) };
}

export function closeBounty({ bounty_id }) {
  if (!bounty_id) throw new Error("bounty_id is required");
  db.prepare("UPDATE devrel_bounties SET status = 'closed' WHERE id = ?").run(bounty_id);
  return getBounty(bounty_id);
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export function submitProject({
  event_id,
  bounty_id,
  submitter_agent_id,
  title,
  description,
  repo_url,
  demo_url,
}) {
  if (!title) throw new Error("title is required");
  if (event_id && bounty_id) throw new Error("Provide either event_id or bounty_id, not both");

  if (event_id) getDevrelEvent(event_id);
  if (bounty_id) getBounty(bounty_id);

  const id = uuid();
  db.prepare(
    `INSERT INTO devrel_submissions
     (id, event_id, bounty_id, submitter_agent_id, title, description, repo_url, demo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    event_id || null,
    bounty_id || null,
    submitter_agent_id || null,
    title,
    description || null,
    repo_url || null,
    demo_url || null
  );
  return getSubmission(id);
}

export function listSubmissions({ event_id, bounty_id, status, limit = 200 } = {}) {
  let sql = `SELECT * FROM devrel_submissions`;
  const where = [];
  const params = [];

  if (event_id) {
    where.push("event_id = ?");
    params.push(event_id);
  }
  if (bounty_id) {
    where.push("bounty_id = ?");
    params.push(bounty_id);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY datetime(created_at) DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params).map((s) => ({ ...s }));
}

export function reviewSubmission({ submission_id, status, score, reviewer_notes }) {
  if (!submission_id) throw new Error("submission_id is required");
  if (!status) throw new Error("status is required");

  db.prepare(
    `UPDATE devrel_submissions
     SET status = ?, score = ?, reviewer_notes = ?
     WHERE id = ?`
  ).run(status, score ?? null, reviewer_notes || null, submission_id);

  return getSubmission(submission_id);
}

export function getSubmission(id) {
  const row = db.prepare("SELECT * FROM devrel_submissions WHERE id = ?").get(id);
  if (!row) throw new Error("Submission not found");
  return row;
}

function safeJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
