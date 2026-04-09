import { v4 as uuid } from "uuid";
import db from "../db.js";

// Space Operations services: launch windows, ground station scheduling, anomaly triage, satellite tasking.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS space_missions (
    id                TEXT PRIMARY KEY,
    mission_name      TEXT NOT NULL,
    operator          TEXT NOT NULL,
    mission_type      TEXT DEFAULT 'satellite' CHECK(mission_type IN ('satellite','rideshare','launch','deep_space','iss')),
    orbit             TEXT DEFAULT 'LEO',
    status            TEXT DEFAULT 'planned' CHECK(status IN ('planned','scheduled','launched','operational','decommissioned','failed')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS launch_windows (
    id                TEXT PRIMARY KEY,
    mission_id        TEXT REFERENCES space_missions(id),
    site              TEXT NOT NULL,
    opens_at          TEXT NOT NULL,
    closes_at         TEXT NOT NULL,
    probability_go    REAL DEFAULT 0.7,
    constraints_json  TEXT DEFAULT '{}',
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ground_stations (
    id                TEXT PRIMARY KEY,
    station_name      TEXT NOT NULL,
    latitude          REAL NOT NULL,
    longitude         REAL NOT NULL,
    bands             TEXT DEFAULT '["S","X"]',
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','maintenance','offline')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ground_passes (
    id                TEXT PRIMARY KEY,
    mission_id        TEXT REFERENCES space_missions(id),
    station_id        TEXT REFERENCES ground_stations(id),
    pass_start        TEXT NOT NULL,
    pass_end          TEXT NOT NULL,
    purpose           TEXT DEFAULT 'telemetry' CHECK(purpose IN ('telemetry','command','payload','testing','emergency')),
    priority          TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
    status            TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS space_anomalies (
    id                TEXT PRIMARY KEY,
    mission_id        TEXT REFERENCES space_missions(id),
    subsystem         TEXT NOT NULL,
    severity          TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    description       TEXT NOT NULL,
    suspected_cause   TEXT,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','triaged','mitigated','closed')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Missions & Stations ─────────────────────────────────────────────────

const _missionCount = db.prepare("SELECT COUNT(*) AS n FROM space_missions").get().n;
if (_missionCount === 0) {
  const seedMissions = [
    { id: uuid(), mission_name: "Aurora-1", operator: "Northwind Space", mission_type: "satellite", orbit: "LEO", status: "scheduled" },
    { id: uuid(), mission_name: "Kepler Relay", operator: "Blue River Comms", mission_type: "satellite", orbit: "MEO", status: "operational" },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO space_missions (id, mission_name, operator, mission_type, orbit, status)
    VALUES (@id, @mission_name, @operator, @mission_type, @orbit, @status)
  `);
  for (const m of seedMissions) insert.run(m);
}

const _stationCount = db.prepare("SELECT COUNT(*) AS n FROM ground_stations").get().n;
if (_stationCount === 0) {
  const seedStations = [
    { id: uuid(), station_name: "Mojave Ground", latitude: 35.0, longitude: -117.7, bands: '["S","X","Ka"]', status: "active" },
    { id: uuid(), station_name: "Troll Station", latitude: 69.0, longitude: 18.9, bands: '["S","X"]', status: "active" },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO ground_stations (id, station_name, latitude, longitude, bands, status)
    VALUES (@id, @station_name, @latitude, @longitude, @bands, @status)
  `);
  for (const s of seedStations) insert.run(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isoPlusMinutes(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

function _assertProb(p) {
  const v = Number(p);
  if (Number.isNaN(v) || v < 0 || v > 1) throw new Error("probability_go must be between 0 and 1");
  return v;
}

// ─── Launch Window Planning ───────────────────────────────────────────────────

export function createLaunchWindow(missionName, site, opensAtIso, closesAtIso, probabilityGo = 0.7, constraints = {}) {
  if (!missionName) throw new Error("missionName is required");
  if (!site) throw new Error("site is required");
  if (!opensAtIso || !closesAtIso) throw new Error("opensAtIso and closesAtIso are required");

  const mission = db.prepare("SELECT * FROM space_missions WHERE mission_name = ?").get(missionName);
  if (!mission) throw new Error(`Unknown mission: ${missionName}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO launch_windows (id, mission_id, site, opens_at, closes_at, probability_go, constraints_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, mission.id, site, opensAtIso, closesAtIso, _assertProb(probabilityGo), JSON.stringify(constraints ?? {}));

  return db.prepare("SELECT * FROM launch_windows WHERE id = ?").get(id);
}

export function proposeLaunchWindow(missionName, site, durationMinutes = 120) {
  const opens = _isoPlusMinutes(60);
  const closes = _isoPlusMinutes(60 + durationMinutes);
  const constraints = { rangeSafety: true, weather: true, traffic: "low" };
  return createLaunchWindow(missionName, site, opens, closes, 0.72, constraints);
}

// ─── Ground Station Scheduling ────────────────────────────────────────────────

export function scheduleGroundPass(missionName, stationName, passStartIso, passEndIso, purpose = "telemetry", priority = "normal") {
  if (!missionName) throw new Error("missionName is required");
  if (!stationName) throw new Error("stationName is required");
  if (!passStartIso || !passEndIso) throw new Error("passStartIso and passEndIso are required");

  const mission = db.prepare("SELECT * FROM space_missions WHERE mission_name = ?").get(missionName);
  if (!mission) throw new Error(`Unknown mission: ${missionName}`);

  const station = db.prepare("SELECT * FROM ground_stations WHERE station_name = ?").get(stationName);
  if (!station) throw new Error(`Unknown ground station: ${stationName}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO ground_passes (id, mission_id, station_id, pass_start, pass_end, purpose, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `).run(id, mission.id, station.id, passStartIso, passEndIso, purpose, priority);

  return db.prepare("SELECT * FROM ground_passes WHERE id = ?").get(id);
}

export function proposeGroundPass(missionName, stationName, purpose = "telemetry") {
  const start = _isoPlusMinutes(15);
  const end = _isoPlusMinutes(27);
  return scheduleGroundPass(missionName, stationName, start, end, purpose, "normal");
}

// ─── Anomaly Management ───────────────────────────────────────────────────────

export function fileSpaceAnomaly(missionName, subsystem, description, severity = "medium", suspectedCause = "") {
  if (!missionName) throw new Error("missionName is required");
  if (!subsystem) throw new Error("subsystem is required");
  if (!description) throw new Error("description is required");

  const mission = db.prepare("SELECT * FROM space_missions WHERE mission_name = ?").get(missionName);
  if (!mission) throw new Error(`Unknown mission: ${missionName}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO space_anomalies (id, mission_id, subsystem, severity, description, suspected_cause, status)
    VALUES (?, ?, ?, ?, ?, ?, 'open')
  `).run(id, mission.id, subsystem, severity, description, suspectedCause);

  return db.prepare("SELECT * FROM space_anomalies WHERE id = ?").get(id);
}

export function triageSpaceAnomaly(anomalyId, suspectedCause = "", status = "triaged") {
  if (!anomalyId) throw new Error("anomalyId is required");
  const anom = db.prepare("SELECT * FROM space_anomalies WHERE id = ?").get(anomalyId);
  if (!anom) throw new Error(`Unknown anomaly: ${anomalyId}`);

  db.prepare("UPDATE space_anomalies SET suspected_cause = ?, status = ? WHERE id = ?").run(suspectedCause, status, anomalyId);
  return { ...anom, suspected_cause: suspectedCause, status };
}
