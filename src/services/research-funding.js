import { v4 as uuid } from "uuid";
import db from "../db.js";

// Research funding discovery + grant application workflow.
// Patterned after services/hitl.js: schema init + seed + exported functions.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS funding_opportunities (
    id               TEXT PRIMARY KEY,
    funder           TEXT NOT NULL,
    program_name     TEXT NOT NULL,
    domain           TEXT NOT NULL,
    country          TEXT DEFAULT 'US',
    min_award_usd    REAL,
    max_award_usd    REAL,
    deadline_iso     TEXT,
    eligibility_json TEXT DEFAULT '[]',
    url              TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(funder, program_name, country)
  );

  CREATE TABLE IF NOT EXISTS grant_applications (
    id               TEXT PRIMARY KEY,
    applicant_id     TEXT NOT NULL,
    funding_id       TEXT NOT NULL,
    title            TEXT NOT NULL,
    status           TEXT DEFAULT 'draft' CHECK(status IN ('draft','submitted','awarded','rejected')),
    requested_usd    REAL,
    narrative_md     TEXT,
    attachments_json TEXT DEFAULT '[]',
    submitted_at     TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(applicant_id, funding_id)
  );
`);

// ─── Seed Opportunities ───────────────────────────────────────────────────────

const _fundingCount = db.prepare("SELECT COUNT(*) as n FROM funding_opportunities").get().n;
if (_fundingCount === 0) {
  const seed = [
    {
      id: uuid(),
      funder: "Example Foundation",
      program_name: "Community Innovation Grants",
      domain: "civic-tech",
      country: "US",
      min_award_usd: 5000,
      max_award_usd: 50000,
      deadline_iso: "2026-12-31",
      eligibility_json: JSON.stringify(["nonprofit", "public-benefit", "pilot-ready"]),
      url: "https://example.org/grants",
    },
    {
      id: uuid(),
      funder: "Example Agency",
      program_name: "AI Safety Research",
      domain: "ai-safety",
      country: "US",
      min_award_usd: 25000,
      max_award_usd: 250000,
      deadline_iso: "2026-09-15",
      eligibility_json: JSON.stringify(["university", "research-lab", "industry-partner"]),
      url: "https://example.gov/funding",
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO funding_opportunities
      (id, funder, program_name, domain, country, min_award_usd, max_award_usd, deadline_iso, eligibility_json, url)
    VALUES
      (@id, @funder, @program_name, @domain, @country, @min_award_usd, @max_award_usd, @deadline_iso, @eligibility_json, @url)
  `);

  for (const r of seed) insert.run(r);
}

// ─── Search Funding ───────────────────────────────────────────────────────────

export function searchFunding({ domain, country = "US", minAwardUsd, maxAwardUsd, beforeDeadlineIso, limit = 10 } = {}) {
  if (!domain) throw new Error("domain is required");

  let query = "SELECT * FROM funding_opportunities WHERE lower(domain) = lower(?) AND country = ?";
  const params = [domain, country];

  if (minAwardUsd != null) {
    query += " AND (max_award_usd IS NULL OR max_award_usd >= ?)";
    params.push(minAwardUsd);
  }

  if (maxAwardUsd != null) {
    query += " AND (min_award_usd IS NULL OR min_award_usd <= ?)";
    params.push(maxAwardUsd);
  }

  if (beforeDeadlineIso) {
    query += " AND (deadline_iso IS NULL OR deadline_iso <= ?)";
    params.push(beforeDeadlineIso);
  }

  query += " ORDER BY deadline_iso ASC LIMIT ?";
  params.push(Math.max(1, Math.min(50, Number(limit) || 10)));

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    eligibility: JSON.parse(r.eligibility_json || "[]"),
  }));
}

// ─── Draft Application ────────────────────────────────────────────────────────

/**
 * Create or update an application draft.
 */
export function upsertGrantApplication({ applicant_id, funding_id, title, requested_usd, narrative_md, attachments } = {}) {
  if (!applicant_id) throw new Error("applicant_id is required");
  if (!funding_id) throw new Error("funding_id is required");
  if (!title) throw new Error("title is required");

  const record = {
    id: uuid(),
    applicant_id,
    funding_id,
    title,
    requested_usd: requested_usd ?? null,
    narrative_md: narrative_md ?? null,
    attachments_json: JSON.stringify(attachments ?? []),
  };

  db.prepare(`
    INSERT INTO grant_applications
      (id, applicant_id, funding_id, title, requested_usd, narrative_md, attachments_json)
    VALUES
      (@id, @applicant_id, @funding_id, @title, @requested_usd, @narrative_md, @attachments_json)
    ON CONFLICT(applicant_id, funding_id) DO UPDATE SET
      title = excluded.title,
      requested_usd = excluded.requested_usd,
      narrative_md = excluded.narrative_md,
      attachments_json = excluded.attachments_json
  `).run(record);

  return db.prepare(
    "SELECT * FROM grant_applications WHERE applicant_id = ? AND funding_id = ?"
  ).get(applicant_id, funding_id);
}

// ─── Submit Application ───────────────────────────────────────────────────────

export function submitGrantApplication(applicantId, fundingId) {
  if (!applicantId) throw new Error("applicantId is required");
  if (!fundingId) throw new Error("fundingId is required");

  const app = db.prepare(
    "SELECT * FROM grant_applications WHERE applicant_id = ? AND funding_id = ?"
  ).get(applicantId, fundingId);

  if (!app) throw new Error("application not found");
  if (app.status !== "draft") throw new Error(`application status must be draft (current: ${app.status})`);

  db.prepare(
    "UPDATE grant_applications SET status = 'submitted', submitted_at = datetime('now') WHERE id = ?"
  ).run(app.id);

  return db.prepare("SELECT * FROM grant_applications WHERE id = ?").get(app.id);
}
