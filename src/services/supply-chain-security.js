import { v4 as uuid } from "uuid";
import crypto from "crypto";
import db from "../db.js";

/**
 * Supply Chain Security Service
 *
 * Minimal primitives for agents to track software artifacts, provenance metadata,
 * and dependency risk signals.
 */

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS artifacts (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    version         TEXT,
    artifact_type   TEXT NOT NULL CHECK(artifact_type IN ('container','npm','pypi','binary','model','dataset','other')),
    digest_sha256   TEXT NOT NULL,
    source_url      TEXT,
    provenance      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dependency_scans (
    id              TEXT PRIMARY KEY,
    artifact_id     TEXT NOT NULL REFERENCES artifacts(id),
    ecosystem       TEXT NOT NULL CHECK(ecosystem IN ('npm','pypi','container','other')),
    dependencies    TEXT NOT NULL,
    risk_score      REAL NOT NULL,
    summary         TEXT NOT NULL,
    scanned_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_artifacts_digest ON artifacts(digest_sha256);
  CREATE INDEX IF NOT EXISTS idx_dependency_scans_artifact ON dependency_scans(artifact_id);
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeType(t) {
  const x = (t ?? "other").toLowerCase();
  const allowed = ["container", "npm", "pypi", "binary", "model", "dataset", "other"];
  if (!allowed.includes(x)) throw new Error(`artifact_type must be one of: ${allowed.join("|")}`);
  return x;
}

function normalizeEcosystem(e) {
  const x = (e ?? "other").toLowerCase();
  const allowed = ["npm", "pypi", "container", "other"];
  if (!allowed.includes(x)) throw new Error(`ecosystem must be one of: ${allowed.join("|")}`);
  return x;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function artifactPublic(row) {
  return {
    artifact_id: row.id,
    name: row.name,
    version: row.version,
    artifact_type: row.artifact_type,
    digest_sha256: row.digest_sha256,
    source_url: row.source_url,
    provenance: row.provenance ? JSON.parse(row.provenance) : null,
    created_at: row.created_at,
  };
}

// ─── Register artifact ───────────────────────────────────────────────────────-

/**
 * Register an artifact and optional provenance metadata.
 * Digest can be provided directly or computed from provided content.
 */
export function scsRegisterArtifact({
  name,
  version = null,
  artifact_type = "other",
  digest_sha256 = null,
  content = null,
  source_url = null,
  provenance = null,
}) {
  if (!name || typeof name !== "string") throw new Error("name is required");
  const type = normalizeType(artifact_type);

  const digest = digest_sha256 || (content != null ? sha256Hex(String(content)) : null);
  if (!digest || typeof digest !== "string" || digest.length < 32) {
    throw new Error("digest_sha256 is required (or provide content to compute one)");
  }

  const id = uuid();

  db.prepare(
    `INSERT INTO artifacts (id, name, version, artifact_type, digest_sha256, source_url, provenance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, version, type, digest, source_url, provenance ? JSON.stringify(provenance) : null);

  const row = db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id);
  return artifactPublic(row);
}

// ─── Get artifact ───────────────────────────────────────────────────────────-

export function scsGetArtifact(artifact_id) {
  if (!artifact_id) throw new Error("artifact_id is required");
  const row = db.prepare("SELECT * FROM artifacts WHERE id = ?").get(artifact_id);
  if (!row) throw new Error(`artifact not found: ${artifact_id}`);
  return artifactPublic(row);
}

export function scsFindArtifactByDigest(digest_sha256) {
  if (!digest_sha256) throw new Error("digest_sha256 is required");
  const row = db.prepare("SELECT * FROM artifacts WHERE digest_sha256 = ? ORDER BY created_at DESC LIMIT 1").get(digest_sha256);
  return row ? artifactPublic(row) : null;
}

// ─── Dependency scan (heuristic scoring) ─────────────────────────────────────-

/**
 * Score dependency risk with lightweight heuristics.
 * Inputs: array of dependencies with {name, version, is_direct, license, maintainer_verified}
 */
export function scsDependencyScan({ artifact_id, ecosystem = "other", dependencies = [] }) {
  if (!artifact_id) throw new Error("artifact_id is required");

  const art = db.prepare("SELECT * FROM artifacts WHERE id = ?").get(artifact_id);
  if (!art) throw new Error(`artifact not found: ${artifact_id}`);

  const eco = normalizeEcosystem(ecosystem);
  if (!Array.isArray(dependencies)) throw new Error("dependencies must be an array");

  // Heuristic risk model (0..100)
  // - Unverified maintainer: +6
  // - Missing license: +4
  // - Pre-1.0 version: +2
  // - Indirect dependency: +1
  // - Very large dependency graph: +10 bonus if > 250
  let score = 0;
  let missingLicense = 0;
  let unverifiedMaintainer = 0;
  let pre1 = 0;
  let indirect = 0;

  for (const dep of dependencies) {
    const lic = dep?.license;
    const verified = dep?.maintainer_verified;
    const isDirect = dep?.is_direct !== false;
    const ver = String(dep?.version ?? "");

    if (!lic) {
      score += 4;
      missingLicense += 1;
    }
    if (verified === false) {
      score += 6;
      unverifiedMaintainer += 1;
    }
    if (/^0\./.test(ver)) {
      score += 2;
      pre1 += 1;
    }
    if (!isDirect) {
      score += 1;
      indirect += 1;
    }
  }

  if (dependencies.length > 250) score += 10;
  if (dependencies.length > 1000) score += 15;

  // scale to 0..100 with diminishing returns
  score = 100 * (1 - Math.exp(-score / 120));
  score = clamp(Math.round(score * 100) / 100, 0, 100);

  const riskBand = score < 20 ? "low" : score < 45 ? "medium" : score < 70 ? "high" : "critical";

  const summary =
    `Dependency risk ${riskBand} (score ${score}/100). ` +
    `deps=${dependencies.length}, indirect=${indirect}, unverified_maintainers=${unverifiedMaintainer}, missing_license=${missingLicense}, pre_1.0=${pre1}.`;

  const scanId = uuid();
  const scannedAt = nowIso();

  db.prepare(
    `INSERT INTO dependency_scans (id, artifact_id, ecosystem, dependencies, risk_score, summary, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(scanId, artifact_id, eco, JSON.stringify(dependencies), score, summary, scannedAt);

  return {
    scan_id: scanId,
    artifact_id,
    ecosystem: eco,
    risk_score: score,
    risk_band: riskBand,
    summary,
    scanned_at: scannedAt,
  };
}

export function scsListScans(artifact_id) {
  if (!artifact_id) throw new Error("artifact_id is required");
  const scans = db
    .prepare(
      "SELECT id, artifact_id, ecosystem, risk_score, summary, scanned_at FROM dependency_scans WHERE artifact_id = ? ORDER BY scanned_at DESC LIMIT 20"
    )
    .all(artifact_id);

  return scans.map((s) => ({
    scan_id: s.id,
    artifact_id: s.artifact_id,
    ecosystem: s.ecosystem,
    risk_score: s.risk_score,
    summary: s.summary,
    scanned_at: s.scanned_at,
  }));
}
