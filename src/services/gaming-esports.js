import { v4 as uuid } from "uuid";
import db from "../db.js";

// Gaming & Esports services: tournament ops, anti-cheat signals, content moderation, creator revenue.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS gaming_orgs (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    region            TEXT DEFAULT 'global',
    game_titles       TEXT DEFAULT '[]',
    contact_email     TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS esports_events (
    id                TEXT PRIMARY KEY,
    org_id            TEXT REFERENCES gaming_orgs(id),
    title             TEXT NOT NULL,
    game_title        TEXT NOT NULL,
    start_time        TEXT NOT NULL,
    end_time          TEXT NOT NULL,
    bracket_format    TEXT DEFAULT 'single_elim' CHECK(bracket_format IN (
                        'single_elim','double_elim','swiss','round_robin','custom')),
    ruleset_json      TEXT DEFAULT '{}',
    status            TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','live','paused','completed','cancelled')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS anti_cheat_reports (
    id                TEXT PRIMARY KEY,
    event_id          TEXT REFERENCES esports_events(id),
    player_handle     TEXT NOT NULL,
    signal_type       TEXT NOT NULL CHECK(signal_type IN (
                        'aim_assist','wallhack','macro','lag_switch','smurfing','account_share','other')),
    severity          TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    evidence_links    TEXT DEFAULT '[]',
    notes             TEXT,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','triaged','actioned','dismissed')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS creator_payouts (
    id                TEXT PRIMARY KEY,
    org_id            TEXT REFERENCES gaming_orgs(id),
    creator_handle    TEXT NOT NULL,
    period_start      TEXT NOT NULL,
    period_end        TEXT NOT NULL,
    gross_usd         REAL NOT NULL,
    fees_usd          REAL DEFAULT 0,
    net_usd           REAL NOT NULL,
    payout_method     TEXT DEFAULT 'bank' CHECK(payout_method IN ('bank','stablecoin','paypal','platform_wallet')),
    status            TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','failed')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Orgs ────────────────────────────────────────────────────────────────

const _orgCount = db.prepare("SELECT COUNT(*) AS n FROM gaming_orgs").get().n;
if (_orgCount === 0) {
  const seedOrgs = [
    { id: uuid(), name: "Nova Arena", region: "NA", game_titles: '["Valorant","CS2"]', contact_email: "ops@novaarena.gg" },
    { id: uuid(), name: "Koi League", region: "EU", game_titles: '["League of Legends","Fortnite"]', contact_email: "admin@koileague.gg" },
  ];
  const insertOrg = db.prepare(`
    INSERT OR IGNORE INTO gaming_orgs (id, name, region, game_titles, contact_email)
    VALUES (@id, @name, @region, @game_titles, @contact_email)
  `);
  for (const o of seedOrgs) insertOrg.run(o);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _nowIso() {
  return new Date().toISOString();
}

function _timeRangeHours(hours) {
  const start = new Date(Date.now() + 5 * 60 * 1000); // 5m from now
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─── Tournament Ops ───────────────────────────────────────────────────────────

/**
 * Create an esports event and return its record.
 */
export function createEsportsEvent(orgName, title, gameTitle, bracketFormat = "single_elim", durationHours = 6) {
  if (!orgName) throw new Error("orgName is required");
  if (!title) throw new Error("title is required");
  if (!gameTitle) throw new Error("gameTitle is required");

  const org = db.prepare("SELECT * FROM gaming_orgs WHERE name = ?").get(orgName);
  if (!org) throw new Error(`Unknown org: ${orgName}`);

  const { start, end } = _timeRangeHours(durationHours);
  const id = uuid();
  db.prepare(`
    INSERT INTO esports_events (id, org_id, title, game_title, start_time, end_time, bracket_format, ruleset_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `).run(id, org.id, title, gameTitle, start, end, bracketFormat, JSON.stringify({ version: 1, antiCheat: true }));

  return db.prepare("SELECT * FROM esports_events WHERE id = ?").get(id);
}

/**
 * Mark an event as live.
 */
export function startEsportsEvent(eventId) {
  if (!eventId) throw new Error("eventId is required");
  const ev = db.prepare("SELECT * FROM esports_events WHERE id = ?").get(eventId);
  if (!ev) throw new Error(`Unknown event: ${eventId}`);
  if (ev.status === "cancelled") throw new Error("Cannot start a cancelled event");

  db.prepare("UPDATE esports_events SET status = 'live' WHERE id = ?").run(eventId);
  return { ...ev, status: "live", updated_at: _nowIso() };
}

/**
 * Post an anti-cheat report for review.
 */
export function fileAntiCheatReport(eventId, playerHandle, signalType, severity = "medium", evidenceLinks = [], notes = "") {
  if (!eventId) throw new Error("eventId is required");
  if (!playerHandle) throw new Error("playerHandle is required");
  if (!signalType) throw new Error("signalType is required");

  const ev = db.prepare("SELECT * FROM esports_events WHERE id = ?").get(eventId);
  if (!ev) throw new Error(`Unknown event: ${eventId}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO anti_cheat_reports (id, event_id, player_handle, signal_type, severity, evidence_links, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(id, eventId, playerHandle, signalType, severity, JSON.stringify(evidenceLinks ?? []), notes);

  return db.prepare("SELECT * FROM anti_cheat_reports WHERE id = ?").get(id);
}

// ─── Creator Revenue Ops ──────────────────────────────────────────────────────

/**
 * Compute a payout quote for a creator (simple fee model).
 */
export function quoteCreatorPayout(grossUsd, feeBps = 250) {
  if (grossUsd == null || Number.isNaN(Number(grossUsd))) throw new Error("grossUsd must be a number");
  const gross = Number(grossUsd);
  const fees = Math.round(gross * (feeBps / 10000) * 100) / 100;
  const net = Math.round((gross - fees) * 100) / 100;
  return { gross_usd: gross, fees_usd: fees, net_usd: net, fee_bps: feeBps };
}

/**
 * Record a creator payout request.
 */
export function createCreatorPayout(orgName, creatorHandle, periodStartIso, periodEndIso, grossUsd, payoutMethod = "bank") {
  if (!orgName) throw new Error("orgName is required");
  if (!creatorHandle) throw new Error("creatorHandle is required");
  if (!periodStartIso || !periodEndIso) throw new Error("periodStartIso and periodEndIso are required");

  const org = db.prepare("SELECT * FROM gaming_orgs WHERE name = ?").get(orgName);
  if (!org) throw new Error(`Unknown org: ${orgName}`);

  const q = quoteCreatorPayout(grossUsd);
  const id = uuid();
  db.prepare(`
    INSERT INTO creator_payouts (id, org_id, creator_handle, period_start, period_end, gross_usd, fees_usd, net_usd, payout_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, org.id, creatorHandle, periodStartIso, periodEndIso, q.gross_usd, q.fees_usd, q.net_usd, payoutMethod);

  return db.prepare("SELECT * FROM creator_payouts WHERE id = ?").get(id);
}
