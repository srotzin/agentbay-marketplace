import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS space_weather_events (
    id              TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL CHECK(event_type IN ('cme','solar_flare','geomagnetic_storm','radiation_storm')),
    severity        TEXT NOT NULL CHECK(severity IN ('g1','g2','g3','g4','g5')),
    start_time_utc  TEXT DEFAULT (datetime('now')),
    end_time_utc    TEXT,
    summary         TEXT NOT NULL,
    affected_systems TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS space_weather_assets (
    id            TEXT PRIMARY KEY,
    asset_type    TEXT NOT NULL CHECK(asset_type IN ('satellite','power_grid','aviation_hf','gnss','pipeline')),
    name          TEXT NOT NULL,
    operator      TEXT,
    risk_profile  TEXT DEFAULT 'medium' CHECK(risk_profile IN ('low','medium','high')),
    latitude      REAL,
    longitude     REAL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS space_weather_alerts (
    id             TEXT PRIMARY KEY,
    event_id       TEXT REFERENCES space_weather_events(id),
    asset_id       TEXT REFERENCES space_weather_assets(id),
    alert_level    TEXT NOT NULL CHECK(alert_level IN ('info','watch','warning','critical')),
    recommended_actions TEXT NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed ────────────────────────────────────────────────────────────────────

const _eventCount = db.prepare("SELECT COUNT(*) as n FROM space_weather_events").get().n;
if (_eventCount === 0) {
  const seedEvents = [
    {
      id: uuid(),
      event_type: "solar_flare",
      severity: "g2",
      summary: "Moderate flare with expected HF radio fade at high latitudes.",
      affected_systems: "aviation_hf,gnss",
    },
    {
      id: uuid(),
      event_type: "geomagnetic_storm",
      severity: "g3",
      summary: "Kp elevated; potential GNSS degradation and satellite drag increase.",
      affected_systems: "satellite,gnss,power_grid",
    },
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO space_weather_events (id, event_type, severity, summary, affected_systems)
    VALUES (@id, @event_type, @severity, @summary, @affected_systems)
  `);
  for (const e of seedEvents) insert.run(e);

  const seedAssets = [
    { id: uuid(), asset_type: "satellite", name: "LEO Comms-7", operator: "HiveSat", risk_profile: "high", latitude: 0, longitude: 0 },
    { id: uuid(), asset_type: "power_grid", name: "Nordic Intertie", operator: "GridOps", risk_profile: "high", latitude: 60.2, longitude: 11.1 },
    { id: uuid(), asset_type: "gnss", name: "GNSS Service - EU", operator: "NavOps", risk_profile: "medium", latitude: 52.0, longitude: 13.4 },
  ];
  const insertAsset = db.prepare(`
    INSERT OR IGNORE INTO space_weather_assets (id, asset_type, name, operator, risk_profile, latitude, longitude)
    VALUES (@id, @asset_type, @name, @operator, @risk_profile, @latitude, @longitude)
  `);
  for (const a of seedAssets) insertAsset.run(a);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gScore(severity) {
  return { g1: 20, g2: 40, g3: 65, g4: 85, g5: 100 }[String(severity).toLowerCase()] ?? 40;
}

function levelFromRisk(eventG, riskProfile) {
  const base = eventG;
  const mult = { low: 0.8, medium: 1.0, high: 1.25 }[riskProfile] ?? 1.0;
  const score = base * mult;
  if (score >= 90) return "critical";
  if (score >= 70) return "warning";
  if (score >= 45) return "watch";
  return "info";
}

function recommendedActions(assetType, alertLevel) {
  const common = {
    info: ["Monitor space-weather bulletins", "Validate telemetry baselines"],
    watch: ["Increase monitoring cadence", "Verify backup comms paths", "Brief operations"] ,
    warning: ["Execute ops runbook", "Defer non-critical maneuvers", "Tighten anomaly thresholds"],
    critical: ["Move to safe mode where applicable", "Suspend sensitive operations", "Activate incident bridge"],
  };

  const extra = {
    satellite: {
      watch: ["Review drag forecasts", "Plan orbit maintenance windows"],
      warning: ["Mitigate charging risk", "Review radiation-safe modes"],
      critical: ["Command safe configuration", "Pause payload operations"],
    },
    power_grid: {
      watch: ["Check GIC sensors", "Review transformer loading"],
      warning: ["Reduce reactive power stress", "Coordinate with neighbors"],
      critical: ["Pre-position response crews", "Implement conservative switching"],
    },
    aviation_hf: {
      watch: ["Pre-brief dispatch for polar routes"],
      warning: ["Plan reroutes around polar corridors", "Use SATCOM alternatives"],
      critical: ["Avoid HF-dependent routes", "Issue operational advisory"],
    },
    gnss: {
      watch: ["Validate RAIM/augmentation", "Notify downstream consumers"],
      warning: ["Increase integrity thresholds", "Use blended nav sources"],
      critical: ["Switch to inertial/ground-based nav where possible", "Suspend precision operations"],
    },
    pipeline: {
      watch: ["Review corrosion monitoring", "Check cathodic protection"],
      warning: ["Inspect anomalous readings", "Increase patrol"],
      critical: ["Activate integrity incident plan", "Coordinate with regulators"],
    },
  };

  const list = [...(common[alertLevel] ?? common.watch), ...((extra[assetType] ?? {})[alertLevel] ?? [])];
  return JSON.stringify(list);
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export function spaceWeatherCreateEvent(eventType, severity, summary, affectedSystems) {
  if (!eventType) throw new Error("eventType is required");
  if (!["cme", "solar_flare", "geomagnetic_storm", "radiation_storm"].includes(eventType)) {
    throw new Error("eventType must be cme|solar_flare|geomagnetic_storm|radiation_storm");
  }
  if (!severity) throw new Error("severity is required");
  const sev = String(severity).toLowerCase();
  if (!["g1", "g2", "g3", "g4", "g5"].includes(sev)) throw new Error("severity must be g1|g2|g3|g4|g5");
  if (!summary) throw new Error("summary is required");

  const id = uuid();
  db.prepare(
    `INSERT INTO space_weather_events (id, event_type, severity, summary, affected_systems)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, eventType, sev, summary, affectedSystems ?? null);

  return db.prepare("SELECT * FROM space_weather_events WHERE id = ?").get(id);
}

export function spaceWeatherRegisterAsset(assetType, name, operator, riskProfile = "medium", latitude, longitude) {
  if (!assetType) throw new Error("assetType is required");
  if (!["satellite", "power_grid", "aviation_hf", "gnss", "pipeline"].includes(assetType)) {
    throw new Error("assetType must be satellite|power_grid|aviation_hf|gnss|pipeline");
  }
  if (!name) throw new Error("name is required");
  const rp = String(riskProfile).toLowerCase();
  if (!["low", "medium", "high"].includes(rp)) throw new Error("riskProfile must be low|medium|high");

  const id = uuid();
  db.prepare(
    `INSERT INTO space_weather_assets (id, asset_type, name, operator, risk_profile, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, assetType, name, operator ?? null, rp, latitude ?? null, longitude ?? null);

  return db.prepare("SELECT * FROM space_weather_assets WHERE id = ?").get(id);
}

export function spaceWeatherAssessRisk(eventId, assetId) {
  if (!eventId) throw new Error("eventId is required");
  if (!assetId) throw new Error("assetId is required");

  const event = db.prepare("SELECT * FROM space_weather_events WHERE id = ?").get(eventId);
  if (!event) throw new Error(`event not found: ${eventId}`);
  const asset = db.prepare("SELECT * FROM space_weather_assets WHERE id = ?").get(assetId);
  if (!asset) throw new Error(`asset not found: ${assetId}`);

  const score = gScore(event.severity);
  const alert = levelFromRisk(score, asset.risk_profile);

  const id = uuid();
  const actions = recommendedActions(asset.asset_type, alert);
  db.prepare(
    `INSERT INTO space_weather_alerts (id, event_id, asset_id, alert_level, recommended_actions)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, eventId, assetId, alert, actions);

  return {
    event,
    asset,
    assessment: {
      g_score: score,
      alert_level: alert,
      recommended_actions: JSON.parse(actions),
    },
    alert_record: db.prepare("SELECT * FROM space_weather_alerts WHERE id = ?").get(id),
  };
}

export function spaceWeatherDashboard() {
  const events = db.prepare("SELECT * FROM space_weather_events ORDER BY created_at DESC LIMIT 50").all();
  const assets = db.prepare("SELECT * FROM space_weather_assets ORDER BY created_at DESC LIMIT 50").all();
  const alerts = db.prepare("SELECT * FROM space_weather_alerts ORDER BY created_at DESC LIMIT 100").all();

  const critical = alerts.filter((a) => a.alert_level === "critical").length;
  const warning = alerts.filter((a) => a.alert_level === "warning").length;

  return {
    events,
    assets,
    alerts,
    headline_metrics: {
      event_count: events.length,
      asset_count: assets.length,
      active_alerts: alerts.length,
      warning_or_higher: warning + critical,
    },
  };
}
