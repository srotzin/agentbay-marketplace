import { v4 as uuid } from "uuid";
import db from "../db.js";

// Geospatial intelligence: simple place/geometry store + routing + dataset catalog

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS geo_places (
    place_id          TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    country_code      TEXT,
    admin1            TEXT,
    admin2            TEXT,
    latitude          REAL,
    longitude         REAL,
    bbox_json         TEXT,
    tags_json         TEXT DEFAULT '[]',
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS geo_routes (
    route_id          TEXT PRIMARY KEY,
    origin_place_id   TEXT,
    dest_place_id     TEXT,
    mode              TEXT DEFAULT 'drive' CHECK(mode IN ('drive','walk','bike','transit','truck')),
    distance_km       REAL,
    duration_minutes  REAL,
    polyline_json     TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS geo_datasets (
    dataset_id        TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    domain            TEXT NOT NULL,
    license           TEXT,
    coverage          TEXT,
    update_cadence    TEXT,
    url               TEXT,
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Datasets ────────────────────────────────────────────────────────────

const _geoDatasetCount = db.prepare("SELECT COUNT(*) as n FROM geo_datasets").get().n;
if (_geoDatasetCount === 0) {
  const seed = [
    {
      dataset_id: "osm",
      name: "OpenStreetMap",
      domain: "basemap",
      license: "ODbL",
      coverage: "Global",
      update_cadence: "Continuous",
      url: "https://www.openstreetmap.org",
      notes: "Community-maintained street + POI data; use extracts for production.",
    },
    {
      dataset_id: "natural_earth",
      name: "Natural Earth",
      domain: "admin_boundaries",
      license: "Public domain",
      coverage: "Global",
      update_cadence: "Occasional",
      url: "https://www.naturalearthdata.com",
      notes: "Generalized cultural + physical vector/raster datasets.",
    },
    {
      dataset_id: "srtm",
      name: "SRTM (NASA Shuttle Radar Topography Mission)",
      domain: "elevation",
      license: "Public domain (US Gov)",
      coverage: "Near-global",
      update_cadence: "Static",
      url: "https://www2.jpl.nasa.gov/srtm/",
      notes: "Common DEM source used for terrain, slope, flood modeling.",
    },
    {
      dataset_id: "sentinel_hub",
      name: "Copernicus Sentinel imagery (via Sentinel Hub / APIs)",
      domain: "satellite_imagery",
      license: "Varies",
      coverage: "Global",
      update_cadence: "Daily",
      url: "https://www.copernicus.eu/en",
      notes: "Satellite imagery for NDVI, change detection, disaster response.",
    },
  ];

  const ins = db.prepare(`
    INSERT OR IGNORE INTO geo_datasets
      (dataset_id, name, domain, license, coverage, update_cadence, url, notes)
    VALUES
      (@dataset_id, @name, @domain, @license, @coverage, @update_cadence, @url, @notes)
  `);
  for (const row of seed) ins.run(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function normalizeMode(mode) {
  const m = (mode ?? "drive").toLowerCase();
  const allowed = ["drive", "walk", "bike", "transit", "truck"];
  if (!allowed.includes(m)) throw new Error(`mode must be one of: ${allowed.join(", ")}`);
  return m;
}

function mockGeocodeCandidates(query, countryCode) {
  // Deterministic pseudo-results so agents can prototype without a real geocoder.
  // Replace with a real provider later.
  const q = (query ?? "").trim();
  if (!q) return [];
  const h = [...q].reduce((a, c) => (a + c.charCodeAt(0)) % 10000, 0);
  const lat = ((h % 1800) / 10) - 90;
  const lon = (((h * 7) % 3600) / 10) - 180;

  const cc = (countryCode ?? "").toUpperCase() || null;

  return [
    {
      place_id: `mock_${h}`,
      name: q,
      country_code: cc,
      admin1: null,
      admin2: null,
      latitude: Math.round(lat * 100000) / 100000,
      longitude: Math.round(lon * 100000) / 100000,
      confidence: 0.35,
      provider: "mock",
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search places by text query (mock geocoder + local cache).
 */
export function searchPlaces({ query, country_code, limit = 5 }) {
  const lim = clamp(parseInt(limit ?? 5, 10), 1, 20);

  const local = db.prepare(`
    SELECT place_id, name, country_code, admin1, admin2, latitude, longitude, tags_json
    FROM geo_places
    WHERE name LIKE ?
      AND (? IS NULL OR country_code = ?)
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(`%${query ?? ""}%`, country_code?.toUpperCase() ?? null, country_code?.toUpperCase() ?? null, lim);

  const out = local.map((p) => ({
    ...p,
    tags: JSON.parse(p.tags_json ?? "[]"),
    source: "cache",
  }));

  // If cache misses, add a deterministic mock candidate so flows still work.
  if (out.length < lim) {
    const candidates = mockGeocodeCandidates(query, country_code);
    for (const c of candidates) {
      out.push({ ...c, source: "mock" });
      if (out.length >= lim) break;
    }
  }

  return {
    query,
    country_code: country_code?.toUpperCase() ?? null,
    results: out.slice(0, lim),
  };
}

/**
 * Create/update a place record.
 */
export function upsertPlace({ place_id, name, country_code, admin1, admin2, latitude, longitude, bbox, tags = [] }) {
  if (!name) throw new Error("name is required");

  const id = place_id || `place_${uuid().slice(0, 10)}`;
  const lat = latitude == null ? null : clamp(Number(latitude), -90, 90);
  const lon = longitude == null ? null : clamp(Number(longitude), -180, 180);

  db.prepare(`
    INSERT INTO geo_places (place_id, name, country_code, admin1, admin2, latitude, longitude, bbox_json, tags_json, updated_at)
    VALUES (@place_id, @name, @country_code, @admin1, @admin2, @latitude, @longitude, @bbox_json, @tags_json, datetime('now'))
    ON CONFLICT(place_id) DO UPDATE SET
      name = excluded.name,
      country_code = excluded.country_code,
      admin1 = excluded.admin1,
      admin2 = excluded.admin2,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      bbox_json = excluded.bbox_json,
      tags_json = excluded.tags_json,
      updated_at = datetime('now')
  `).run({
    place_id: id,
    name,
    country_code: country_code?.toUpperCase() ?? null,
    admin1: admin1 ?? null,
    admin2: admin2 ?? null,
    latitude: lat,
    longitude: lon,
    bbox_json: bbox ? JSON.stringify(bbox) : null,
    tags_json: JSON.stringify(Array.isArray(tags) ? tags : []),
  });

  return {
    place_id: id,
    name,
    country_code: country_code?.toUpperCase() ?? null,
    admin1: admin1 ?? null,
    admin2: admin2 ?? null,
    latitude: lat,
    longitude: lon,
    bbox: bbox ?? null,
    tags,
  };
}

/**
 * Create a simple route estimate between two places.
 */
export function planRoute({ origin_place_id, dest_place_id, mode = "drive" }) {
  if (!origin_place_id) throw new Error("origin_place_id is required");
  if (!dest_place_id) throw new Error("dest_place_id is required");

  const m = normalizeMode(mode);

  const o = db.prepare("SELECT latitude, longitude, name FROM geo_places WHERE place_id = ?").get(origin_place_id);
  const d = db.prepare("SELECT latitude, longitude, name FROM geo_places WHERE place_id = ?").get(dest_place_id);
  if (!o) throw new Error(`Unknown origin place_id: ${origin_place_id}`);
  if (!d) throw new Error(`Unknown dest place_id: ${dest_place_id}`);

  if (o.latitude == null || o.longitude == null || d.latitude == null || d.longitude == null) {
    throw new Error("Both origin and destination must have latitude/longitude");
  }

  // Haversine distance (km)
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(d.latitude - o.latitude);
  const dLon = toRad(d.longitude - o.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(o.latitude)) * Math.cos(toRad(d.latitude)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = Math.round(R * c * 100) / 100;

  // Speed assumptions
  const speedKph = { walk: 4.5, bike: 14, transit: 22, drive: 55, truck: 45 };
  const durationMin = Math.round((distKm / (speedKph[m] ?? 40)) * 60 * 10) / 10;

  const routeId = `route_${uuid().slice(0, 10)}`;
  const polyline = [
    { lat: o.latitude, lon: o.longitude },
    { lat: d.latitude, lon: d.longitude },
  ];

  db.prepare(`
    INSERT OR IGNORE INTO geo_routes
      (route_id, origin_place_id, dest_place_id, mode, distance_km, duration_minutes, polyline_json)
    VALUES
      (@route_id, @origin_place_id, @dest_place_id, @mode, @distance_km, @duration_minutes, @polyline_json)
  `).run({
    route_id: routeId,
    origin_place_id,
    dest_place_id,
    mode: m,
    distance_km: distKm,
    duration_minutes: durationMin,
    polyline_json: JSON.stringify(polyline),
  });

  return {
    route_id: routeId,
    mode: m,
    origin: { place_id: origin_place_id, name: o.name, latitude: o.latitude, longitude: o.longitude },
    destination: { place_id: dest_place_id, name: d.name, latitude: d.latitude, longitude: d.longitude },
    distance_km: distKm,
    duration_minutes: durationMin,
    polyline,
  };
}

/**
 * Search known geospatial datasets.
 */
export function searchGeoDatasets({ domain, query, limit = 10 }) {
  const lim = clamp(parseInt(limit ?? 10, 10), 1, 50);
  const q = (query ?? "").trim();

  const rows = db.prepare(`
    SELECT dataset_id, name, domain, license, coverage, update_cadence, url, notes
    FROM geo_datasets
    WHERE (? IS NULL OR domain = ?)
      AND (? = '' OR name LIKE ? OR notes LIKE ?)
    ORDER BY name ASC
    LIMIT ?
  `).all(domain ?? null, domain ?? null, q, `%${q}%`, `%${q}%`, lim);

  return {
    domain: domain ?? null,
    query: q,
    results: rows,
  };
}
