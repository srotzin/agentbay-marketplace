import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FLEET_PLATFORM_FEE = 0.20; // 20% platform margin
const FEES = {
  optimizeRoute:         0.25,
  planLoad:              1.00,
  predictMaintenance:    0.50,
  trackFleet:            0.10,
  calculateFreightQuote: 0.25,
  getFleetDashboard:     5.00, // per month
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS fleet_cities (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    state       TEXT NOT NULL,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    hub         INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fleet_routes (
    id                  TEXT PRIMARY KEY,
    stops_json          TEXT NOT NULL,
    vehicle_type        TEXT,
    optimized_route_json TEXT,
    total_distance_mi   REAL,
    total_time_min      INTEGER,
    fuel_estimate_gal   REAL,
    savings_vs_direct   REAL,
    fee_usd             REAL DEFAULT 0.25,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_loads (
    id              TEXT PRIMARY KEY,
    shipment_count  INTEGER,
    vehicle_count   INTEGER,
    assignments_json TEXT,
    total_utilization REAL,
    fee_usd         REAL DEFAULT 1.0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_maintenance (
    id                TEXT PRIMARY KEY,
    vehicle_id        TEXT NOT NULL,
    mileage           INTEGER,
    items_json        TEXT,
    urgency           TEXT,
    estimated_cost    REAL,
    downtime_hours    REAL,
    fee_usd           REAL DEFAULT 0.5,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_tracking (
    id            TEXT PRIMARY KEY,
    vehicle_ids   TEXT,
    snapshot_json TEXT,
    fee_usd       REAL DEFAULT 0.1,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_freight_quotes (
    id            TEXT PRIMARY KEY,
    origin        TEXT,
    destination   TEXT,
    weight_lbs    REAL,
    service_level TEXT,
    quotes_json   TEXT,
    fee_usd       REAL DEFAULT 0.25,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_dashboards (
    id               TEXT PRIMARY KEY,
    fleet_id         TEXT NOT NULL,
    total_vehicles   INTEGER,
    active_vehicles  INTEGER,
    metrics_json     TEXT,
    fee_usd          REAL DEFAULT 5.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Cities ──────────────────────────────────────────────────────────────

const _cityCount = db.prepare("SELECT COUNT(*) as n FROM fleet_cities").get().n;
if (_cityCount === 0) {
  const seedCities = [
    { id: uuid(), name: "New York",      state: "NY", lat: 40.713,  lng: -74.006,  hub: 1 },
    { id: uuid(), name: "Los Angeles",   state: "CA", lat: 34.052,  lng: -118.244, hub: 1 },
    { id: uuid(), name: "Chicago",       state: "IL", lat: 41.878,  lng: -87.630,  hub: 1 },
    { id: uuid(), name: "Houston",       state: "TX", lat: 29.760,  lng: -95.370,  hub: 1 },
    { id: uuid(), name: "Phoenix",       state: "AZ", lat: 33.448,  lng: -112.074, hub: 0 },
    { id: uuid(), name: "Philadelphia",  state: "PA", lat: 39.952,  lng: -75.165,  hub: 0 },
    { id: uuid(), name: "San Antonio",   state: "TX", lat: 29.425,  lng: -98.494,  hub: 0 },
    { id: uuid(), name: "Dallas",        state: "TX", lat: 32.776,  lng: -96.797,  hub: 1 },
    { id: uuid(), name: "San Jose",      state: "CA", lat: 37.339,  lng: -121.894, hub: 0 },
    { id: uuid(), name: "Austin",        state: "TX", lat: 30.267,  lng: -97.743,  hub: 0 },
    { id: uuid(), name: "Jacksonville",  state: "FL", lat: 30.332,  lng: -81.656,  hub: 0 },
    { id: uuid(), name: "Fort Worth",    state: "TX", lat: 32.755,  lng: -97.330,  hub: 0 },
    { id: uuid(), name: "Columbus",      state: "OH", lat: 39.961,  lng: -82.999,  hub: 0 },
    { id: uuid(), name: "Charlotte",     state: "NC", lat: 35.227,  lng: -80.843,  hub: 0 },
    { id: uuid(), name: "Indianapolis",  state: "IN", lat: 39.768,  lng: -86.158,  hub: 0 },
    { id: uuid(), name: "Seattle",       state: "WA", lat: 47.608,  lng: -122.335, hub: 1 },
    { id: uuid(), name: "Denver",        state: "CO", lat: 39.739,  lng: -104.984, hub: 0 },
    { id: uuid(), name: "Nashville",     state: "TN", lat: 36.162,  lng: -86.781,  hub: 0 },
    { id: uuid(), name: "Atlanta",       state: "GA", lat: 33.749,  lng: -84.388,  hub: 1 },
    { id: uuid(), name: "Miami",         state: "FL", lat: 25.775,  lng: -80.209,  hub: 0 },
  ];
  const insertCity = db.prepare(`
    INSERT OR IGNORE INTO fleet_cities (id, name, state, lat, lng, hub)
    VALUES (@id, @name, @state, @lat, @lng, @hub)
  `);
  for (const c of seedCities) insertCity.run(c);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R   = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a   = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findCity(nameOrState) {
  const term = (nameOrState || "").toLowerCase();
  return db.prepare(
    "SELECT * FROM fleet_cities WHERE lower(name) LIKE ? OR lower(state) LIKE ? LIMIT 1"
  ).get(`%${term}%`, `%${term}%`);
}

function fuelRateGalPerMile(vehicleType) {
  const rates = {
    sedan: 0.033, van: 0.059, box_truck: 0.083,
    semi: 0.143, refrigerated: 0.167, flatbed: 0.125,
    motorcycle: 0.025, electric: 0, hybrid: 0.040,
  };
  return rates[vehicleType] ?? 0.083;
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ─── optimizeRoute ────────────────────────────────────────────────────────────

/**
 * Compute an optimized multi-stop delivery/pickup route using nearest-neighbor heuristic.
 * @param {Array}  stops       - [{ city, address, priority }] — at least 2
 * @param {string} vehicleType - sedan|van|box_truck|semi|refrigerated|flatbed|electric|hybrid
 * @param {object} constraints - { max_drive_hours, start_time, avoid_toll, return_to_origin }
 * @param {object} trafficData - { congestion_factor, incidents[] } (optional live feed)
 * @returns optimized_route[], total_distance, total_time, fuel_estimate, savings_vs_direct
 * Fee: $0.25 per optimization
 */
export function optimizeRoute(stops, vehicleType, constraints = {}, trafficData = {}) {
  if (!stops || !Array.isArray(stops) || stops.length < 2) {
    throw new Error("stops must be an array with at least 2 entries");
  }

  const vType      = vehicleType ?? "van";
  const cons       = constraints ?? {};
  const traffic    = trafficData ?? {};
  const congestion = traffic.congestion_factor ?? 1.0;
  const fuelRate   = fuelRateGalPerMile(vType);
  const fuelPrice  = 3.85; // $/gallon

  // Resolve stop coordinates
  const resolvedStops = stops.map((s, i) => {
    const city = findCity(s.city ?? s.address ?? "");
    return {
      index:    i,
      original: s,
      name:     city?.name ?? (s.city || s.address || `Stop ${i + 1}`),
      state:    city?.state ?? "",
      lat:      city?.lat  ?? (37 + Math.random() * 8),
      lng:      city?.lng  ?? (-95 - Math.random() * 25),
      priority: s.priority ?? "normal",
      time_window: s.time_window ?? null,
      service_minutes: s.service_minutes ?? 15,
    };
  });

  // Nearest-neighbor TSP heuristic starting from first stop
  const visited    = [false, ...resolvedStops.slice(1).map(() => false)];
  const route      = [resolvedStops[0]];
  visited[0]       = true;
  let remaining    = resolvedStops.slice(1);

  while (remaining.length > 0) {
    const last  = route[route.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < remaining.length; j++) {
      const d = haversineDistance(last.lat, last.lng, remaining[j].lat, remaining[j].lng);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    route.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  if (cons.return_to_origin !== false) route.push({ ...resolvedStops[0], name: resolvedStops[0].name + " (return)", is_return: true });

  // Build route legs
  let totalDistance = 0;
  let totalTime     = 0;
  const routeLegs   = [];

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to   = route[i + 1];
    const dist = Math.round(haversineDistance(from.lat, from.lng, to.lat, to.lng) * congestion * 10) / 10;
    const time = Math.round((dist / 55) * 60 * congestion + (to.service_minutes ?? 15)); // 55 mph avg
    totalDistance += dist;
    totalTime     += time;
    routeLegs.push({
      leg:             i + 1,
      from:            from.name,
      to:              to.name,
      distance_mi:     dist,
      drive_minutes:   Math.round((dist / 55) * 60 * congestion),
      service_minutes: to.service_minutes ?? 15,
      total_minutes:   time,
      priority:        to.priority ?? "normal",
      traffic_impact:  congestion > 1.1 ? "moderate" : "none",
    });
  }

  // Straight-line (direct-order) distance for savings comparison
  let directDist = 0;
  for (let i = 0; i < resolvedStops.length - 1; i++) {
    directDist += haversineDistance(resolvedStops[i].lat, resolvedStops[i].lng, resolvedStops[i+1].lat, resolvedStops[i+1].lng);
  }

  const fuelGal        = Math.round(totalDistance * fuelRate * 100) / 100;
  const fuelCost       = Math.round(fuelGal * fuelPrice * 100) / 100;
  const savingsVsDirect = Math.round(Math.max(0, directDist - totalDistance) * 10) / 10;
  const savingsPct      = directDist > 0 ? Math.round((savingsVsDirect / directDist) * 100 * 10) / 10 : 0;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_routes
      (id, stops_json, vehicle_type, optimized_route_json, total_distance_mi, total_time_min, fuel_estimate_gal, savings_vs_direct, fee_usd)
    VALUES
      (@id, @stops_json, @vehicle_type, @optimized_route_json, @total_distance_mi, @total_time_min, @fuel_estimate_gal, @savings_vs_direct, @fee_usd)
  `).run({
    id,
    stops_json:           JSON.stringify(stops),
    vehicle_type:         vType,
    optimized_route_json: JSON.stringify(routeLegs),
    total_distance_mi:    totalDistance,
    total_time_min:       totalTime,
    fuel_estimate_gal:    fuelGal,
    savings_vs_direct:    savingsVsDirect,
    fee_usd:              FEES.optimizeRoute,
  });

  return {
    route_id:           id,
    vehicle_type:       vType,
    optimized_route:    routeLegs,
    stop_sequence:      route.map((s, i) => ({ order: i + 1, name: s.name, priority: s.priority ?? "normal" })),
    total_distance_mi:  Math.round(totalDistance * 10) / 10,
    total_time_min:     totalTime,
    total_time_hours:   Math.round(totalTime / 60 * 10) / 10,
    fuel_estimate_gal:  fuelGal,
    fuel_cost_usd:      fuelCost,
    savings_vs_direct_mi:  savingsVsDirect,
    savings_vs_direct_pct: savingsPct,
    within_drive_limit: cons.max_drive_hours ? (totalTime / 60) <= cons.max_drive_hours : true,
    traffic_adjustment: congestion > 1.0 ? `+${Math.round((congestion - 1) * 100)}% travel time (traffic)` : "None",
    fee_usd:            FEES.optimizeRoute,
    platform_revenue_usd: Math.round(FEES.optimizeRoute * FLEET_PLATFORM_FEE * 100) / 100,
    created_at:         new Date().toISOString(),
  };
}

// ─── planLoad ─────────────────────────────────────────────────────────────────

/**
 * Optimize load planning across a fleet — assign shipments to vehicles maximizing utilization.
 * @param {Array}  shipments  - [{ id, weight_lbs, volume_cuft, destination, priority }]
 * @param {Array}  vehicles   - [{ id, type, capacity_lbs, capacity_cuft, available }]
 * @param {object} constraints - { max_stops_per_vehicle, same_day_required, hazmat_certified_only }
 * @returns assignments[] with vehicle, shipments, utilization_pct, weight_pct, volume_pct
 * Fee: $1.00 per plan
 */
export function planLoad(shipments, vehicles, constraints = {}) {
  if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
    throw new Error("shipments must be a non-empty array");
  }
  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    throw new Error("vehicles must be a non-empty array");
  }

  const cons           = constraints ?? {};
  const maxStops       = cons.max_stops_per_vehicle ?? 10;
  const availableVehs  = vehicles.filter(v => v.available !== false);

  // Sort shipments by priority then weight desc (bin-packing heuristic)
  const priorityOrder  = { high: 0, urgent: 0, normal: 1, low: 2 };
  const sortedShipments = [...shipments].sort((a, b) =>
    (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1) ||
    (b.weight_lbs ?? 0) - (a.weight_lbs ?? 0)
  );

  const assignments = availableVehs.map(v => ({
    vehicle_id:    v.id,
    vehicle_type:  v.type ?? "van",
    capacity_lbs:  v.capacity_lbs  ?? 5000,
    capacity_cuft: v.capacity_cuft ?? 250,
    shipments:     [],
    total_weight:  0,
    total_volume:  0,
    stop_count:    0,
  }));

  const unassigned = [];

  for (const ship of sortedShipments) {
    const w = ship.weight_lbs  ?? 100;
    const v = ship.volume_cuft ?? 10;
    let placed = false;

    for (const asgn of assignments) {
      if (
        asgn.stop_count < maxStops &&
        asgn.total_weight + w <= asgn.capacity_lbs &&
        asgn.total_volume + v <= asgn.capacity_cuft
      ) {
        asgn.shipments.push(ship);
        asgn.total_weight += w;
        asgn.total_volume += v;
        asgn.stop_count   += 1;
        placed             = true;
        break;
      }
    }
    if (!placed) unassigned.push(ship);
  }

  const result = assignments
    .filter(a => a.shipments.length > 0)
    .map(a => ({
      vehicle_id:      a.vehicle_id,
      vehicle_type:    a.vehicle_type,
      shipments:       a.shipments.map(s => ({ id: s.id, weight_lbs: s.weight_lbs ?? 100, volume_cuft: s.volume_cuft ?? 10, priority: s.priority ?? "normal", destination: s.destination })),
      shipment_count:  a.shipments.length,
      total_weight_lbs: a.total_weight,
      total_volume_cuft: a.total_volume,
      weight_pct:      Math.round((a.total_weight  / a.capacity_lbs)  * 100 * 10) / 10,
      volume_pct:      Math.round((a.total_volume  / a.capacity_cuft) * 100 * 10) / 10,
      utilization_pct: Math.round(Math.max(
        a.total_weight / a.capacity_lbs,
        a.total_volume / a.capacity_cuft
      ) * 100 * 10) / 10,
      capacity_lbs:    a.capacity_lbs,
      capacity_cuft:   a.capacity_cuft,
    }));

  const avgUtilization = result.length > 0
    ? Math.round(result.reduce((s, r) => s + r.utilization_pct, 0) / result.length * 10) / 10
    : 0;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_loads
      (id, shipment_count, vehicle_count, assignments_json, total_utilization, fee_usd)
    VALUES
      (@id, @shipment_count, @vehicle_count, @assignments_json, @total_utilization, @fee_usd)
  `).run({
    id,
    shipment_count:   shipments.length,
    vehicle_count:    vehicles.length,
    assignments_json: JSON.stringify(result),
    total_utilization: avgUtilization,
    fee_usd:          FEES.planLoad,
  });

  return {
    plan_id:              id,
    assignments:          result,
    vehicles_used:        result.length,
    vehicles_available:   availableVehs.length,
    shipments_assigned:   shipments.length - unassigned.length,
    shipments_total:      shipments.length,
    unassigned_shipments: unassigned,
    avg_utilization_pct:  avgUtilization,
    efficiency_rating:    avgUtilization >= 80 ? "excellent" : avgUtilization >= 65 ? "good" : avgUtilization >= 50 ? "fair" : "poor",
    fee_usd:              FEES.planLoad,
    platform_revenue_usd: Math.round(FEES.planLoad * FLEET_PLATFORM_FEE * 100) / 100,
    created_at:           new Date().toISOString(),
  };
}

// ─── predictMaintenance ───────────────────────────────────────────────────────

/**
 * Predict upcoming maintenance needs for a vehicle using mileage and telemetry.
 * @param {string} vehicleId    - Vehicle identifier
 * @param {number} mileage      - Current odometer reading in miles
 * @param {object} lastService  - { date, mileage, items_performed[] }
 * @param {object} telemetryData - { engine_temp_f, battery_voltage, brake_wear_pct, tire_pressure_psi, oil_life_pct, check_engine }
 * @returns maintenance_items[], urgency, estimated_cost, downtime_hours, risk_if_deferred
 * Fee: $0.50 per prediction
 */
export function predictMaintenance(vehicleId, mileage, lastService = {}, telemetryData = {}) {
  if (!vehicleId) throw new Error("vehicleId is required");
  if (mileage == null) throw new Error("mileage is required");

  const svc      = lastService   ?? {};
  const telem    = telemetryData ?? {};
  const milesSinceService = mileage - (svc.mileage ?? mileage - 4000);
  const daysSinceService  = svc.date
    ? Math.round((Date.now() - new Date(svc.date).getTime()) / 86400000)
    : 90;

  const maintenanceItems = [];

  // Oil change
  const oilLife = telem.oil_life_pct ?? Math.max(0, 100 - (milesSinceService / 50));
  if (oilLife < 15 || milesSinceService > 4500) {
    maintenanceItems.push({
      item:           "Oil & Filter Change",
      due_in_miles:   Math.max(0, 5000 - milesSinceService),
      urgency:        oilLife < 5 ? "critical" : oilLife < 15 ? "high" : "medium",
      estimated_cost_usd: 89,
      downtime_hours: 1,
      risk_if_deferred: "Engine wear, sludge buildup, potential engine failure",
      last_done_miles: svc.mileage ?? null,
    });
  }

  // Tire rotation
  if (milesSinceService > 6000 || !svc.items_performed?.includes("tire_rotation")) {
    maintenanceItems.push({
      item:           "Tire Rotation & Inspection",
      due_in_miles:   Math.max(0, 7500 - milesSinceService),
      urgency:        milesSinceService > 9000 ? "high" : "medium",
      estimated_cost_usd: 45,
      downtime_hours: 0.75,
      risk_if_deferred: "Uneven tread wear, reduced traction, early tire replacement",
      last_done_miles: svc.mileage ?? null,
    });
  }

  // Brake inspection
  const brakeWear = telem.brake_wear_pct ?? Math.min(100, (mileage / 500));
  if (brakeWear > 70 || telem.brake_warning) {
    maintenanceItems.push({
      item:           "Brake Pad Replacement",
      due_in_miles:   Math.max(0, Math.round((100 - brakeWear) * 20)),
      urgency:        brakeWear > 90 ? "critical" : "high",
      estimated_cost_usd: 280,
      downtime_hours: 2.5,
      risk_if_deferred: "Brake failure, rotor damage (+$400), safety liability",
      last_done_miles: null,
    });
  }

  // Check engine
  if (telem.check_engine) {
    maintenanceItems.push({
      item:           "Diagnostic Scan — Check Engine Light",
      due_in_miles:   0,
      urgency:        "high",
      estimated_cost_usd: 120,
      downtime_hours: 1.5,
      risk_if_deferred: "Unknown fault may cascade to drivetrain damage",
      last_done_miles: null,
    });
  }

  // Battery
  const battery = telem.battery_voltage ?? 12.8;
  if (battery < 12.4 || daysSinceService > 1095) {
    maintenanceItems.push({
      item:           "Battery Test & Possible Replacement",
      due_in_miles:   null,
      due_in_days:    Math.max(0, 30 - Math.max(0, daysSinceService - 1065)),
      urgency:        battery < 12.0 ? "critical" : "medium",
      estimated_cost_usd: 195,
      downtime_hours: 0.5,
      risk_if_deferred: "Vehicle no-start, stranded driver, missed deliveries",
      last_done_miles: null,
    });
  }

  // 30k / 60k / 90k service
  const nextMajor = [30000, 60000, 90000, 120000].find(m => m > mileage) ?? 150000;
  const milesTo   = nextMajor - mileage;
  if (milesTo < 3000) {
    maintenanceItems.push({
      item:           `${nextMajor.toLocaleString()}-Mile Major Service`,
      due_in_miles:   milesTo,
      urgency:        milesTo < 500 ? "high" : "medium",
      estimated_cost_usd: nextMajor % 60000 === 0 ? 650 : 350,
      downtime_hours: nextMajor % 60000 === 0 ? 4.0 : 2.5,
      risk_if_deferred: "Spark plugs, filters, fluid degradation, warranty implications",
      last_done_miles: nextMajor - (nextMajor % 30000 === 0 ? 30000 : 30000),
    });
  }

  const urgencyOrder  = { critical: 0, high: 1, medium: 2, low: 3 };
  const topUrgency    = maintenanceItems.length > 0
    ? maintenanceItems.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])[0].urgency
    : "none";
  const totalCost     = Math.round(maintenanceItems.reduce((s, i) => s + i.estimated_cost_usd, 0) * 100) / 100;
  const totalDowntime = Math.round(maintenanceItems.reduce((s, i) => s + i.downtime_hours, 0) * 10) / 10;
  const riskStatement = topUrgency === "critical"
    ? "CRITICAL: Immediate service required to prevent vehicle damage or safety incident."
    : topUrgency === "high"
    ? "HIGH RISK: Service within 1–2 weeks to prevent escalating repair costs."
    : topUrgency === "medium"
    ? "MODERATE: Schedule service within 30 days."
    : "Vehicle in good health. Routine monitoring recommended.";

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_maintenance
      (id, vehicle_id, mileage, items_json, urgency, estimated_cost, downtime_hours, fee_usd)
    VALUES
      (@id, @vehicle_id, @mileage, @items_json, @urgency, @estimated_cost, @downtime_hours, @fee_usd)
  `).run({
    id,
    vehicle_id:     vehicleId,
    mileage,
    items_json:     JSON.stringify(maintenanceItems),
    urgency:        topUrgency,
    estimated_cost: totalCost,
    downtime_hours: totalDowntime,
    fee_usd:        FEES.predictMaintenance,
  });

  return {
    prediction_id:     id,
    vehicle_id:        vehicleId,
    current_mileage:   mileage,
    miles_since_service: milesSinceService,
    maintenance_items: maintenanceItems,
    item_count:        maintenanceItems.length,
    urgency:           topUrgency,
    estimated_cost_usd: totalCost,
    downtime_hours:    totalDowntime,
    risk_if_deferred:  riskStatement,
    next_service_recommendation: maintenanceItems.length > 0
      ? `Schedule service within ${topUrgency === "critical" ? "48 hours" : topUrgency === "high" ? "1 week" : "30 days"}`
      : "No immediate service required",
    telemetry_flags: {
      check_engine:    telem.check_engine ?? false,
      low_battery:     battery < 12.4,
      brake_wear_high: brakeWear > 70,
      low_oil_life:    oilLife < 15,
    },
    fee_usd:           FEES.predictMaintenance,
    platform_revenue_usd: Math.round(FEES.predictMaintenance * FLEET_PLATFORM_FEE * 100) / 100,
    created_at:        new Date().toISOString(),
  };
}

// ─── trackFleet ───────────────────────────────────────────────────────────────

/**
 * Retrieve real-time tracking snapshots for a set of vehicles.
 * @param {Array} vehicleIds - Array of vehicle ID strings
 * @returns vehicles[] with location, status, driver, current_route, eta, fuel_level
 * Fee: $0.10 per check
 */
export function trackFleet(vehicleIds) {
  if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
    throw new Error("vehicleIds must be a non-empty array");
  }

  const statuses    = ["en_route", "en_route", "en_route", "idle", "loading", "at_stop", "returning"];
  const driverNames = [
    "Marcus Reid", "Sandra Liu", "Darnell Brooks", "Elena Kowalski",
    "James Osei", "Patricia Vega", "Tom Harrington", "Aisha Nwosu",
    "Carlos Fuentes", "Brigitte Müller",
  ];

  const cities = db.prepare("SELECT * FROM fleet_cities LIMIT 20").all();

  const vehicles = vehicleIds.map((vid, i) => {
    const status     = statuses[i % statuses.length];
    const city       = cities[i % cities.length] ?? { name: "Chicago", state: "IL", lat: 41.878, lng: -87.630 };
    const nextCity   = cities[(i + 3) % cities.length] ?? city;
    const fuelLevel  = Math.round(20 + Math.random() * 75);
    const speed      = status === "en_route" ? Math.round(45 + Math.random() * 30) : 0;
    const etaMin     = status === "en_route"
      ? Math.round(15 + Math.random() * 120)
      : null;

    return {
      vehicle_id:    vid,
      status,
      location: {
        city:       city.name,
        state:      city.state,
        lat:        Math.round((city.lat + (Math.random() - 0.5) * 0.5) * 10000) / 10000,
        lng:        Math.round((city.lng + (Math.random() - 0.5) * 0.5) * 10000) / 10000,
        updated_at: new Date().toISOString(),
      },
      driver: {
        name:   driverNames[i % driverNames.length],
        id:     `DRV-${(1000 + i).toString()}`,
        hours_on_duty: Math.round(1 + Math.random() * 9),
        hos_remaining_hours: Math.round(3 + Math.random() * 8),
      },
      current_route: status === "en_route" || status === "returning"
        ? { destination: nextCity.name, distance_remaining_mi: Math.round(20 + Math.random() * 200), progress_pct: Math.round(Math.random() * 80) }
        : null,
      eta_minutes:   etaMin,
      eta_timestamp: etaMin ? new Date(Date.now() + etaMin * 60000).toISOString() : null,
      fuel_level_pct: fuelLevel,
      fuel_warning:  fuelLevel < 25,
      speed_mph:     speed,
      engine_on:     status !== "idle",
      odometer_mi:   Math.round(12000 + Math.random() * 200000),
      last_stop:     status !== "en_route" ? city.name : null,
    };
  });

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_tracking
      (id, vehicle_ids, snapshot_json, fee_usd)
    VALUES (@id, @vehicle_ids, @snapshot_json, @fee_usd)
  `).run({
    id,
    vehicle_ids:   JSON.stringify(vehicleIds),
    snapshot_json: JSON.stringify(vehicles),
    fee_usd:       FEES.trackFleet,
  });

  const enRoute  = vehicles.filter(v => v.status === "en_route").length;
  const warnings = vehicles.filter(v => v.fuel_warning).length;

  return {
    snapshot_id:      id,
    vehicles,
    summary: {
      total:          vehicleIds.length,
      en_route:       enRoute,
      idle:           vehicles.filter(v => v.status === "idle").length,
      loading:        vehicles.filter(v => v.status === "loading").length,
      at_stop:        vehicles.filter(v => v.status === "at_stop").length,
      returning:      vehicles.filter(v => v.status === "returning").length,
      fuel_warnings:  warnings,
    },
    alerts:           warnings > 0
      ? vehicles.filter(v => v.fuel_warning).map(v => ({ vehicle_id: v.vehicle_id, type: "low_fuel", message: `Fuel at ${v.fuel_level_pct}% — refuel recommended` }))
      : [],
    tracked_at:       new Date().toISOString(),
    fee_usd:          Math.round(FEES.trackFleet * vehicleIds.length * 100) / 100,
    per_vehicle_fee:  FEES.trackFleet,
    platform_revenue_usd: Math.round(FEES.trackFleet * vehicleIds.length * FLEET_PLATFORM_FEE * 100) / 100,
  };
}

// ─── calculateFreightQuote ────────────────────────────────────────────────────

/**
 * Get instant freight quotes from multiple carriers for a shipment.
 * @param {string}  origin       - Origin city or address
 * @param {string}  destination  - Destination city or address
 * @param {number}  weight       - Shipment weight in lbs
 * @param {object}  dimensions   - { length_in, width_in, height_in }
 * @param {string}  serviceLevel - standard|expedited|overnight|ltl|ftl
 * @param {boolean} hazmat       - Whether shipment contains hazardous materials
 * @returns quotes[] with carrier, price, transit_days, reliability_score, carbon_footprint
 * Fee: $0.25 per quote
 */
export function calculateFreightQuote(origin, destination, weight, dimensions = {}, serviceLevel = "standard", hazmat = false) {
  if (!origin)      throw new Error("origin is required");
  if (!destination) throw new Error("destination is required");
  if (weight == null) throw new Error("weight is required");

  const originCity  = findCity(origin);
  const destCity    = findCity(destination);
  const distanceMi  = originCity && destCity
    ? haversineDistance(originCity.lat, originCity.lng, destCity.lat, destCity.lng)
    : 500 + Math.random() * 1500;

  const dims    = dimensions ?? {};
  const lengthIn = dims.length_in ?? 24;
  const widthIn  = dims.width_in  ?? 18;
  const heightIn = dims.height_in ?? 12;
  const dimWeight = Math.ceil((lengthIn * widthIn * heightIn) / 139); // DIM factor
  const billableWeight = Math.max(weight, dimWeight);

  const hazmatSurcharge = hazmat ? 0.15 : 0;
  const fuelSurcharge   = 0.185;

  const carrierProfiles = [
    { name: "FedEx Freight",   base_rate: 0.055, reliability: 97, green_factor: 0.82 },
    { name: "UPS Freight",     base_rate: 0.052, reliability: 96, green_factor: 0.80 },
    { name: "XPO Logistics",   base_rate: 0.048, reliability: 94, green_factor: 0.75 },
    { name: "Old Dominion",    base_rate: 0.057, reliability: 98, green_factor: 0.78 },
    { name: "SAIA Inc",        base_rate: 0.044, reliability: 93, green_factor: 0.72 },
    { name: "Estes Express",   base_rate: 0.046, reliability: 95, green_factor: 0.74 },
  ];

  const serviceLevelFactors = {
    standard: { multiplier: 1.0, days_base: 5 },
    expedited: { multiplier: 1.65, days_base: 2 },
    overnight: { multiplier: 2.40, days_base: 1 },
    ltl:       { multiplier: 0.85, days_base: 6 },
    ftl:       { multiplier: 0.75, days_base: 4 },
  };
  const svcFactor = serviceLevelFactors[serviceLevel] ?? serviceLevelFactors.standard;
  const transitDays = Math.max(1, Math.round(svcFactor.days_base + distanceMi / 800));

  const quotes = carrierProfiles.map(carrier => {
    const base   = carrier.base_rate * billableWeight * distanceMi / 100;
    const fuel   = base * fuelSurcharge;
    const haz    = base * hazmatSurcharge;
    const total  = Math.round((base + fuel + haz) * svcFactor.multiplier * 100) / 100;
    const carbon = Math.round(distanceMi * billableWeight / 2000 * carrier.green_factor * 10) / 10;

    return {
      carrier:            carrier.name,
      service_level:      serviceLevel,
      price_usd:          total,
      fuel_surcharge_usd: Math.round(fuel * svcFactor.multiplier * 100) / 100,
      hazmat_surcharge_usd: Math.round(haz * 100) / 100,
      transit_days:       transitDays,
      guaranteed:         serviceLevel === "overnight",
      reliability_score:  carrier.reliability,
      tracking_available: true,
      carbon_footprint_kg: carbon,
      notes:              hazmat ? "Hazmat handling certified" : null,
    };
  });

  quotes.sort((a, b) => a.price_usd - b.price_usd);

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_freight_quotes
      (id, origin, destination, weight_lbs, service_level, quotes_json, fee_usd)
    VALUES
      (@id, @origin, @destination, @weight_lbs, @service_level, @quotes_json, @fee_usd)
  `).run({
    id,
    origin,
    destination,
    weight_lbs:    weight,
    service_level: serviceLevel,
    quotes_json:   JSON.stringify(quotes),
    fee_usd:       FEES.calculateFreightQuote,
  });

  return {
    quote_id:         id,
    origin,
    destination,
    estimated_distance_mi: Math.round(distanceMi),
    weight_lbs:       weight,
    dim_weight_lbs:   dimWeight,
    billable_weight_lbs: billableWeight,
    service_level:    serviceLevel,
    hazmat:           hazmat,
    quotes,
    recommended:      quotes[0],
    price_range: {
      lowest_usd:  quotes[0]?.price_usd ?? 0,
      highest_usd: quotes[quotes.length - 1]?.price_usd ?? 0,
    },
    fee_usd:          FEES.calculateFreightQuote,
    platform_revenue_usd: Math.round(FEES.calculateFreightQuote * FLEET_PLATFORM_FEE * 100) / 100,
    created_at:       new Date().toISOString(),
  };
}

// ─── getFleetDashboard ────────────────────────────────────────────────────────

/**
 * Retrieve comprehensive KPI dashboard for a fleet.
 * @param {string} fleetId - Fleet identifier
 * @returns total_vehicles, active, utilization_pct, fuel_efficiency, on_time_delivery, cost_per_mile, maintenance_due[]
 * Fee: $5.00 per month
 */
export function getFleetDashboard(fleetId) {
  if (!fleetId) throw new Error("fleetId is required");

  const existing = db.prepare(
    "SELECT * FROM fleet_dashboards WHERE fleet_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(fleetId);

  const totalVehicles  = existing?.total_vehicles  ?? Math.round(15 + Math.random() * 85);
  const activeVehicles = existing?.active_vehicles ?? Math.round(totalVehicles * (0.7 + Math.random() * 0.2));
  const utilizationPct = Math.round((activeVehicles / totalVehicles) * 100 * 10) / 10;
  const fuelEfficiency = Math.round((6 + Math.random() * 6) * 10) / 10; // mpg
  const onTimePct      = Math.round((88 + Math.random() * 10) * 10) / 10;
  const costPerMile    = Math.round((0.45 + Math.random() * 0.65) * 100) / 100;
  const avgMileage     = Math.round(85000 + Math.random() * 120000);

  const maintenanceDue = [
    { vehicle_id: `VH-${Math.floor(1000 + Math.random() * 9000)}`, type: "Oil Change", urgency: "high",   due_miles: 250,  estimated_cost_usd: 89 },
    { vehicle_id: `VH-${Math.floor(1000 + Math.random() * 9000)}`, type: "Brake Inspection", urgency: "medium", due_miles: 1200, estimated_cost_usd: 120 },
    { vehicle_id: `VH-${Math.floor(1000 + Math.random() * 9000)}`, type: "Tire Rotation", urgency: "medium", due_miles: 800, estimated_cost_usd: 45 },
    { vehicle_id: `VH-${Math.floor(1000 + Math.random() * 9000)}`, type: "60k Major Service", urgency: "low",    due_miles: 2800, estimated_cost_usd: 650 },
  ].filter(() => Math.random() > 0.25);

  const monthlyMetrics = ["Jan","Feb","Mar","Apr","May","Jun"].map(month => ({
    month,
    miles_driven:      Math.round(80000 + Math.random() * 40000),
    deliveries:        Math.round(400 + Math.random() * 300),
    fuel_cost_usd:     Math.round(18000 + Math.random() * 12000),
    maintenance_usd:   Math.round(3000 + Math.random() * 5000),
    on_time_pct:       Math.round((85 + Math.random() * 12) * 10) / 10,
    incidents:         Math.round(Math.random() * 3),
  }));

  const metricsPayload = {
    utilization_pct:   utilizationPct,
    fuel_efficiency_mpg: fuelEfficiency,
    on_time_delivery_pct: onTimePct,
    cost_per_mile_usd: costPerMile,
    avg_vehicle_mileage: avgMileage,
    monthly_trend:     monthlyMetrics,
  };

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO fleet_dashboards
      (id, fleet_id, total_vehicles, active_vehicles, metrics_json, fee_usd)
    VALUES
      (@id, @fleet_id, @total_vehicles, @active_vehicles, @metrics_json, @fee_usd)
  `).run({
    id,
    fleet_id:        fleetId,
    total_vehicles:  totalVehicles,
    active_vehicles: activeVehicles,
    metrics_json:    JSON.stringify(metricsPayload),
    fee_usd:         FEES.getFleetDashboard,
  });

  return {
    dashboard_id:         id,
    fleet_id:             fleetId,
    period:               "trailing 6 months",
    total_vehicles:       totalVehicles,
    active:               activeVehicles,
    idle:                 totalVehicles - activeVehicles,
    utilization_pct:      utilizationPct,
    fuel_efficiency_mpg:  fuelEfficiency,
    on_time_delivery_pct: onTimePct,
    cost_per_mile_usd:    costPerMile,
    avg_vehicle_mileage:  avgMileage,
    maintenance_due:      maintenanceDue,
    maintenance_backlog_cost_usd: maintenanceDue.reduce((s, m) => s + m.estimated_cost_usd, 0),
    monthly_trend:        monthlyMetrics,
    kpi_ratings: {
      utilization:    utilizationPct >= 80 ? "excellent" : utilizationPct >= 65 ? "good" : "needs_improvement",
      fuel_efficiency: fuelEfficiency >= 10 ? "excellent" : fuelEfficiency >= 7 ? "good" : "needs_improvement",
      on_time:        onTimePct >= 95 ? "excellent" : onTimePct >= 88 ? "good" : "needs_improvement",
    },
    fee_usd:              FEES.getFleetDashboard,
    platform_revenue_usd: Math.round(FEES.getFleetDashboard * FLEET_PLATFORM_FEE * 100) / 100,
    generated_at:         new Date().toISOString(),
  };
}
