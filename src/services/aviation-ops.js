import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS aviation_flights (
    id                TEXT PRIMARY KEY,
    flight_number     TEXT NOT NULL,
    origin            TEXT NOT NULL,
    destination       TEXT NOT NULL,
    scheduled_depart  TEXT,
    scheduled_arrive  TEXT,
    status            TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','boarding','departed','arrived','cancelled','diverted')),
    aircraft_tail     TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS aviation_crew (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    role              TEXT NOT NULL CHECK(role IN ('captain','first_officer','flight_attendant','dispatcher','maintenance')),
    base              TEXT,
    duty_status       TEXT DEFAULT 'available' CHECK(duty_status IN ('available','on_duty','resting','unavailable')),
    hours_last_7d     REAL DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS aviation_irrops (
    id                TEXT PRIMARY KEY,
    flight_id         TEXT REFERENCES aviation_flights(id),
    irrop_type        TEXT NOT NULL CHECK(irrop_type IN ('delay','cancel','diversion','aircraft_swap','crew_issue','maintenance')),
    severity          TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    reason            TEXT NOT NULL,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','mitigated','closed')),
    created_at        TEXT DEFAULT (datetime('now')),
    closed_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS aviation_turns (
    id                TEXT PRIMARY KEY,
    flight_id         TEXT REFERENCES aviation_flights(id),
    station           TEXT NOT NULL,
    planned_minutes   INTEGER NOT NULL,
    actual_minutes    INTEGER,
    status            TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),
    created_at        TEXT DEFAULT (datetime('now')),
    completed_at      TEXT
  );
`);

// ─── Seed ────────────────────────────────────────────────────────────────────

const _flightCount = db.prepare("SELECT COUNT(*) as n FROM aviation_flights").get().n;
if (_flightCount === 0) {
  const seedFlights = [
    { id: uuid(), flight_number: "HA102", origin: "FCO", destination: "LHR", aircraft_tail: "EI-HVA", status: "scheduled" },
    { id: uuid(), flight_number: "HA455", origin: "CDG", destination: "AMS", aircraft_tail: "EI-HVB", status: "scheduled" },
    { id: uuid(), flight_number: "HA880", origin: "MAD", destination: "BCN", aircraft_tail: "EI-HVC", status: "scheduled" },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO aviation_flights (id, flight_number, origin, destination, status, aircraft_tail)
    VALUES (@id, @flight_number, @origin, @destination, @status, @aircraft_tail)
  `);
  for (const f of seedFlights) insert.run(f);

  const seedCrew = [
    { id: uuid(), name: "Elena Rossi", role: "dispatcher", base: "FCO", duty_status: "available", hours_last_7d: 22.5 },
    { id: uuid(), name: "Martin Klein", role: "captain", base: "LHR", duty_status: "available", hours_last_7d: 18.0 },
    { id: uuid(), name: "Sara Dupont", role: "flight_attendant", base: "CDG", duty_status: "available", hours_last_7d: 26.0 },
    { id: uuid(), name: "Javier Morales", role: "maintenance", base: "MAD", duty_status: "available", hours_last_7d: 40.0 },
  ];
  const insertCrew = db.prepare(`
    INSERT OR IGNORE INTO aviation_crew (id, name, role, base, duty_status, hours_last_7d)
    VALUES (@id, @name, @role, @base, @duty_status, @hours_last_7d)
  `);
  for (const c of seedCrew) insertCrew.run(c);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityScore(severity) {
  return { low: 10, medium: 35, high: 75, critical: 95 }[severity] ?? 35;
}

function suggestedMitigations(irropType) {
  switch (irropType) {
    case "delay":
      return ["Confirm updated ETD/ETA", "Notify customer comms", "Adjust connections", "Rebalance crew duty limits"];
    case "cancel":
      return ["Protect passengers on alt flights", "Issue hotel/meal vouchers", "Coordinate aircraft routing", "Update ops control"];
    case "diversion":
      return ["Secure handling at diversion station", "Coordinate fuel/crew", "Update passenger comms", "Plan recovery flight"];
    case "aircraft_swap":
      return ["Verify tail compatibility", "Update load planning", "Recheck MEL/CDL", "Re-run turnaround plan"];
    case "crew_issue":
      return ["Find standby coverage", "Validate duty/rest legality", "Update dispatch release", "Coordinate with station"];
    default:
      return ["Open maintenance control case", "Assess MEL impact", "Confirm parts availability", "Decide repair vs swap"];
  }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export function aviationCreateFlight(flightNumber, origin, destination, aircraftTail) {
  if (!flightNumber) throw new Error("flightNumber is required");
  if (!origin) throw new Error("origin is required");
  if (!destination) throw new Error("destination is required");
  const id = uuid();
  db.prepare(
    `INSERT INTO aviation_flights (id, flight_number, origin, destination, status, aircraft_tail)
     VALUES (?, ?, ?, ?, 'scheduled', ?)`
  ).run(id, flightNumber, origin, destination, aircraftTail ?? null);
  return db.prepare("SELECT * FROM aviation_flights WHERE id = ?").get(id);
}

export function aviationUpdateFlightStatus(flightId, status) {
  if (!flightId) throw new Error("flightId is required");
  if (!["scheduled", "boarding", "departed", "arrived", "cancelled", "diverted"].includes(status)) {
    throw new Error("status must be scheduled|boarding|departed|arrived|cancelled|diverted");
  }
  const flight = db.prepare("SELECT * FROM aviation_flights WHERE id = ?").get(flightId);
  if (!flight) throw new Error(`flight not found: ${flightId}`);
  db.prepare("UPDATE aviation_flights SET status = ? WHERE id = ?").run(status, flightId);
  return db.prepare("SELECT * FROM aviation_flights WHERE id = ?").get(flightId);
}

export function aviationReportIrrop(flightId, irropType, severity, reason) {
  if (!flightId) throw new Error("flightId is required");
  const flight = db.prepare("SELECT * FROM aviation_flights WHERE id = ?").get(flightId);
  if (!flight) throw new Error(`flight not found: ${flightId}`);
  if (!["delay", "cancel", "diversion", "aircraft_swap", "crew_issue", "maintenance"].includes(irropType)) {
    throw new Error("irropType must be delay|cancel|diversion|aircraft_swap|crew_issue|maintenance");
  }
  if (!["low", "medium", "high", "critical"].includes(severity)) throw new Error("severity must be low|medium|high|critical");
  if (!reason) throw new Error("reason is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO aviation_irrops (id, flight_id, irrop_type, severity, reason, status)
     VALUES (?, ?, ?, ?, ?, 'open')`
  ).run(id, flightId, irropType, severity, reason);

  return {
    irrop: db.prepare("SELECT * FROM aviation_irrops WHERE id = ?").get(id),
    severity_score: severityScore(severity),
    suggested_mitigations: suggestedMitigations(irropType),
  };
}

export function aviationPlanTurnaround(flightId, station, plannedMinutes = 45) {
  if (!flightId) throw new Error("flightId is required");
  const flight = db.prepare("SELECT * FROM aviation_flights WHERE id = ?").get(flightId);
  if (!flight) throw new Error(`flight not found: ${flightId}`);
  if (!station) throw new Error("station is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO aviation_turns (id, flight_id, station, planned_minutes, status)
     VALUES (?, ?, ?, ?, 'planned')`
  ).run(id, flightId, station, Number(plannedMinutes ?? 45));

  return db.prepare("SELECT * FROM aviation_turns WHERE id = ?").get(id);
}

export function aviationOpsDashboard() {
  const flights = db.prepare("SELECT * FROM aviation_flights ORDER BY created_at DESC LIMIT 50").all();
  const openIrrops = db.prepare(
    "SELECT * FROM aviation_irrops WHERE status = 'open' ORDER BY created_at DESC LIMIT 50"
  ).all();
  const activeTurns = db.prepare(
    "SELECT * FROM aviation_turns WHERE status IN ('planned','in_progress') ORDER BY created_at DESC LIMIT 50"
  ).all();

  const sevTotal = openIrrops.reduce((acc, i) => acc + severityScore(i.severity), 0);
  return {
    flights,
    open_irrops: openIrrops,
    active_turnarounds: activeTurns,
    headline_metrics: {
      flight_count: flights.length,
      open_irrop_count: openIrrops.length,
      avg_open_irrop_severity_score: openIrrops.length ? Math.round((sevTotal / openIrrops.length) * 10) / 10 : 0,
    },
  };
}
