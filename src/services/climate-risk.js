import { v4 as uuid } from "uuid";
import db from "../db.js";

// Climate risk ops: asset catalog + exposures + scenario scoring

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS climate_assets (
    asset_id          TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    category          TEXT DEFAULT 'facility' CHECK(category IN ('facility','portfolio','supply_node','infrastructure')),
    place_id          TEXT,
    latitude          REAL,
    longitude         REAL,
    metadata_json     TEXT DEFAULT '{}',
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS climate_exposures (
    exposure_id       TEXT PRIMARY KEY,
    asset_id          TEXT NOT NULL,
    hazard            TEXT NOT NULL CHECK(hazard IN (
                        'flood_river','flood_coastal','heat','wildfire','drought',
                        'storm_wind','storm_hail','landslide','sea_level_rise')),
    baseline_score    REAL NOT NULL,
    scenario          TEXT NOT NULL DEFAULT 'baseline',
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS climate_scenarios (
    scenario_id       TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    warming_c         REAL,
    horizon_year      INTEGER,
    description       TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Scenarios ───────────────────────────────────────────────────────────

const _scenarioCount = db.prepare("SELECT COUNT(*) as n FROM climate_scenarios").get().n;
if (_scenarioCount === 0) {
  const seed = [
    { scenario_id: "baseline", name: "Baseline (recent climate)", warming_c: 0.0, horizon_year: 2025, description: "Reference period representing current climate variability." },
    { scenario_id: "ssp245_2035", name: "SSP2-4.5 (2035)", warming_c: 1.5, horizon_year: 2035, description: "Mid-range transition pathway; moderate warming and hazard intensification." },
    { scenario_id: "ssp585_2050", name: "SSP5-8.5 (2050)", warming_c: 2.5, horizon_year: 2050, description: "High emissions pathway; strong hazard intensification and tail risks." },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO climate_scenarios
      (scenario_id, name, warming_c, horizon_year, description)
    VALUES
      (@scenario_id, @name, @warming_c, @horizon_year, @description)
  `);
  for (const s of seed) ins.run(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function hazardMultiplier(hazard, scenarioId) {
  // Very rough multipliers to enable planning flows; replace with real model later.
  const s = scenarioId ?? "baseline";
  const byScenario = {
    baseline: {
      flood_river: 1.0, flood_coastal: 1.0, heat: 1.0, wildfire: 1.0, drought: 1.0,
      storm_wind: 1.0, storm_hail: 1.0, landslide: 1.0, sea_level_rise: 1.0,
    },
    ssp245_2035: {
      flood_river: 1.1, flood_coastal: 1.15, heat: 1.25, wildfire: 1.2, drought: 1.15,
      storm_wind: 1.05, storm_hail: 1.05, landslide: 1.05, sea_level_rise: 1.2,
    },
    ssp585_2050: {
      flood_river: 1.25, flood_coastal: 1.35, heat: 1.6, wildfire: 1.5, drought: 1.35,
      storm_wind: 1.15, storm_hail: 1.15, landslide: 1.1, sea_level_rise: 1.5,
    },
  };
  const mult = byScenario[s]?.[hazard];
  return mult ?? 1.0;
}

function listHazards() {
  return [
    "flood_river",
    "flood_coastal",
    "heat",
    "wildfire",
    "drought",
    "storm_wind",
    "storm_hail",
    "landslide",
    "sea_level_rise",
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function upsertClimateAsset({ asset_id, name, category = "facility", place_id, latitude, longitude, metadata = {} }) {
  if (!name) throw new Error("name is required");
  const catAllowed = ["facility", "portfolio", "supply_node", "infrastructure"];
  if (!catAllowed.includes(category)) throw new Error(`category must be one of: ${catAllowed.join(", ")}`);

  const id = asset_id || `asset_${uuid().slice(0, 10)}`;
  const lat = latitude == null ? null : Number(latitude);
  const lon = longitude == null ? null : Number(longitude);

  db.prepare(`
    INSERT INTO climate_assets (asset_id, name, category, place_id, latitude, longitude, metadata_json, created_at, updated_at)
    VALUES (@asset_id, @name, @category, @place_id, @latitude, @longitude, @metadata_json, datetime('now'), datetime('now'))
    ON CONFLICT(asset_id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      place_id = excluded.place_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
  `).run({
    asset_id: id,
    name,
    category,
    place_id: place_id ?? null,
    latitude: lat,
    longitude: lon,
    metadata_json: JSON.stringify(metadata ?? {}),
  });

  return { asset_id: id, name, category, place_id: place_id ?? null, latitude: lat, longitude: lon, metadata };
}

export function listClimateScenarios() {
  const rows = db.prepare("SELECT scenario_id, name, warming_c, horizon_year, description FROM climate_scenarios ORDER BY horizon_year ASC").all();
  return { scenarios: rows };
}

export function setAssetExposure({ asset_id, hazard, baseline_score, scenario = "baseline", notes }) {
  if (!asset_id) throw new Error("asset_id is required");
  if (!listHazards().includes(hazard)) throw new Error(`hazard must be one of: ${listHazards().join(", ")}`);

  const asset = db.prepare("SELECT asset_id FROM climate_assets WHERE asset_id = ?").get(asset_id);
  if (!asset) throw new Error(`Unknown asset_id: ${asset_id}`);

  const expId = `exp_${uuid().slice(0, 10)}`;
  const base = clamp01(baseline_score);

  db.prepare(`
    INSERT OR IGNORE INTO climate_exposures
      (exposure_id, asset_id, hazard, baseline_score, scenario, notes)
    VALUES
      (@exposure_id, @asset_id, @hazard, @baseline_score, @scenario, @notes)
  `).run({
    exposure_id: expId,
    asset_id,
    hazard,
    baseline_score: base,
    scenario,
    notes: notes ?? null,
  });

  return { exposure_id: expId, asset_id, hazard, baseline_score: base, scenario, notes: notes ?? null };
}

export function scoreAssetRisk({ asset_id, scenario = "baseline" }) {
  if (!asset_id) throw new Error("asset_id is required");

  const asset = db.prepare("SELECT asset_id, name, category, place_id, latitude, longitude, metadata_json FROM climate_assets WHERE asset_id = ?").get(asset_id);
  if (!asset) throw new Error(`Unknown asset_id: ${asset_id}`);

  const exposures = db.prepare(`
    SELECT hazard, baseline_score, scenario, notes
    FROM climate_exposures
    WHERE asset_id = ?
  `).all(asset_id);

  const scored = exposures.map((e) => {
    const mult = hazardMultiplier(e.hazard, scenario);
    const score = Math.min(1, Math.round((clamp01(e.baseline_score) * mult) * 1000) / 1000);
    return { hazard: e.hazard, baseline_score: e.baseline_score, multiplier: mult, scenario_score: score, notes: e.notes ?? null };
  });

  const overall = scored.length
    ? Math.round((scored.reduce((a, x) => a + x.scenario_score, 0) / scored.length) * 1000) / 1000
    : 0;

  return {
    asset: {
      asset_id: asset.asset_id,
      name: asset.name,
      category: asset.category,
      place_id: asset.place_id,
      latitude: asset.latitude,
      longitude: asset.longitude,
      metadata: JSON.parse(asset.metadata_json ?? "{}"),
    },
    scenario,
    overall_risk_score: overall,
    hazard_breakdown: scored,
    interpretation: overall >= 0.66 ? "high" : overall >= 0.33 ? "medium" : "low",
  };
}
