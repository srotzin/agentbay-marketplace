import { randomUUID } from "crypto";
import db from "../db.js";

// Logistics & Capacity Auctions — agents bid on shipping capacity,
// optimize routes, and consolidate freight for maximum margin.

const LIVE_MODE = !!process.env.LOGISTICS_API_KEY;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS logistics_shipments (
      id              TEXT PRIMARY KEY,
      shipper_id      TEXT NOT NULL,
      origin          TEXT NOT NULL,
      destination     TEXT NOT NULL,
      weight_lbs      REAL NOT NULL,
      length_in       REAL DEFAULT 12,
      width_in        REAL DEFAULT 12,
      height_in       REAL DEFAULT 12,
      urgency         TEXT DEFAULT 'standard' CHECK(urgency IN ('economy','standard','expedited','overnight')),
      status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','quoted','in_transit','delivered','cancelled')),
      carrier_id      TEXT,
      tracking_code   TEXT,
      quote_usd       REAL,
      actual_cost_usd REAL,
      eta             TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logistics_capacity (
      id              TEXT PRIMARY KEY,
      carrier_id      TEXT NOT NULL,
      carrier_name    TEXT NOT NULL,
      vehicle_type    TEXT NOT NULL CHECK(vehicle_type IN ('flatbed','dry_van','reefer','box_truck','ltl','container','drayage')),
      origin_city     TEXT NOT NULL,
      dest_city       TEXT NOT NULL,
      depart_date     TEXT NOT NULL,
      capacity_lbs    REAL NOT NULL,
      remaining_lbs   REAL NOT NULL,
      price_per_mile  REAL NOT NULL,
      distance_miles  REAL NOT NULL,
      transit_days    INTEGER NOT NULL,
      status          TEXT DEFAULT 'available' CHECK(status IN ('available','partial','full','departed')),
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logistics_bids (
      id              TEXT PRIMARY KEY,
      capacity_id     TEXT NOT NULL REFERENCES logistics_capacity(id),
      bidder_id       TEXT NOT NULL,
      weight_lbs      REAL NOT NULL,
      bid_per_mile    REAL NOT NULL,
      total_bid_usd   REAL NOT NULL,
      status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logistics_routes (
      id              TEXT PRIMARY KEY,
      agent_id        TEXT,
      stops_json      TEXT NOT NULL,
      optimized_json  TEXT,
      total_miles     REAL,
      total_hrs       REAL,
      fuel_cost_usd   REAL,
      num_stops       INTEGER,
      vehicle_type    TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[logistics-routing] schema init error:", e.message);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

try {
  const _capacityCount = db.prepare("SELECT COUNT(*) as n FROM logistics_capacity").get().n;
  if (_capacityCount === 0) {
    // Realistic US domestic shipping lanes with carrier pricing
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const in2days  = new Date(Date.now() + 172800000).toISOString().slice(0, 10);
    const in3days  = new Date(Date.now() + 259200000).toISOString().slice(0, 10);

    const capacityLanes = [
      // LA → NYC (2,790 miles)
      { carrier_id: "AMER-FREIGHT-01", carrier_name: "AmeriFreight",    vehicle_type: "dry_van",  origin_city: "Los Angeles, CA", dest_city: "New York, NY",    depart_date: tomorrow, capacity_lbs: 44000, remaining_lbs: 18000, price_per_mile: 0.42, distance_miles: 2790, transit_days: 5, notes: "Partial load — 18,000 lbs available" },
      { carrier_id: "SWIFT-02",        carrier_name: "Swift Transport",  vehicle_type: "flatbed",  origin_city: "Los Angeles, CA", dest_city: "New York, NY",    depart_date: in2days,  capacity_lbs: 48000, remaining_lbs: 48000, price_per_mile: 0.44, distance_miles: 2790, transit_days: 5, notes: "Full load available" },
      { carrier_id: "CEVA-03",         carrier_name: "CEVA Logistics",   vehicle_type: "reefer",   origin_city: "Los Angeles, CA", dest_city: "New York, NY",    depart_date: tomorrow, capacity_lbs: 40000, remaining_lbs: 22000, price_per_mile: 0.55, distance_miles: 2790, transit_days: 5, notes: "Temperature-controlled, partial load" },
      // CHI → MIA (1,381 miles)
      { carrier_id: "ECHO-04",         carrier_name: "Echo Global",      vehicle_type: "dry_van",  origin_city: "Chicago, IL",     dest_city: "Miami, FL",       depart_date: tomorrow, capacity_lbs: 44000, remaining_lbs: 12000, price_per_mile: 0.38, distance_miles: 1381, transit_days: 3, notes: "Consolidation run — great rate" },
      { carrier_id: "JB-HUNT-05",      carrier_name: "J.B. Hunt",        vehicle_type: "dry_van",  origin_city: "Chicago, IL",     dest_city: "Miami, FL",       depart_date: in2days,  capacity_lbs: 44000, remaining_lbs: 44000, price_per_mile: 0.40, distance_miles: 1381, transit_days: 3, notes: "Full dedicated lane" },
      // SEA → DEN (1,321 miles)
      { carrier_id: "DART-06",         carrier_name: "Dart Freight",     vehicle_type: "flatbed",  origin_city: "Seattle, WA",     dest_city: "Denver, CO",      depart_date: tomorrow, capacity_lbs: 48000, remaining_lbs: 30000, price_per_mile: 0.35, distance_miles: 1321, transit_days: 3, notes: "Flatbed, partial load available" },
      { carrier_id: "XPO-07",          carrier_name: "XPO Logistics",    vehicle_type: "ltl",      origin_city: "Seattle, WA",     dest_city: "Denver, CO",      depart_date: tomorrow, capacity_lbs: 20000, remaining_lbs: 8500,  price_per_mile: 0.48, distance_miles: 1321, transit_days: 3, notes: "LTL consolidation" },
      // DAL → ATL (780 miles)
      { carrier_id: "ESTES-08",        carrier_name: "Estes Express",    vehicle_type: "box_truck", origin_city: "Dallas, TX",     dest_city: "Atlanta, GA",     depart_date: tomorrow, capacity_lbs: 26000, remaining_lbs: 10000, price_per_mile: 0.32, distance_miles: 780,  transit_days: 2, notes: "Box truck, solid Southeast lane" },
      { carrier_id: "WERNER-09",       carrier_name: "Werner Enterprises",vehicle_type: "dry_van",  origin_city: "Dallas, TX",     dest_city: "Atlanta, GA",     depart_date: in2days,  capacity_lbs: 44000, remaining_lbs: 44000, price_per_mile: 0.36, distance_miles: 780,  transit_days: 2, notes: "FTL available, quick turnaround" },
      // PHX → HOU (1,175 miles)
      { carrier_id: "LANDSTAR-10",     carrier_name: "Landstar",         vehicle_type: "flatbed",  origin_city: "Phoenix, AZ",    dest_city: "Houston, TX",     depart_date: in2days,  capacity_lbs: 48000, remaining_lbs: 35000, price_per_mile: 0.37, distance_miles: 1175, transit_days: 2, notes: "Flatbed with partial capacity" },
      // NYC → CHI (790 miles)
      { carrier_id: "OLD-DOM-11",      carrier_name: "Old Dominion",     vehicle_type: "ltl",      origin_city: "New York, NY",   dest_city: "Chicago, IL",     depart_date: tomorrow, capacity_lbs: 22000, remaining_lbs: 9000,  price_per_mile: 0.45, distance_miles: 790,  transit_days: 2, notes: "LTL hub-and-spoke, reliable" },
      { carrier_id: "FEDEX-FRT-12",    carrier_name: "FedEx Freight",    vehicle_type: "dry_van",  origin_city: "New York, NY",   dest_city: "Chicago, IL",     depart_date: in3days,  capacity_lbs: 44000, remaining_lbs: 20000, price_per_mile: 0.52, distance_miles: 790,  transit_days: 2, notes: "Guaranteed service available" },
      // MIA → ATL (661 miles)
      { carrier_id: "SAIA-13",         carrier_name: "Saia Inc",         vehicle_type: "dry_van",  origin_city: "Miami, FL",      dest_city: "Atlanta, GA",     depart_date: tomorrow, capacity_lbs: 44000, remaining_lbs: 28000, price_per_mile: 0.33, distance_miles: 661,  transit_days: 1, notes: "Next-day capacity" },
      // Denver backhaul
      { carrier_id: "DEN-BACKHAUL-14", carrier_name: "Mountain West Freight", vehicle_type: "flatbed", origin_city: "Denver, CO", dest_city: "Los Angeles, CA", depart_date: tomorrow, capacity_lbs: 46000, remaining_lbs: 46000, price_per_mile: 0.31, distance_miles: 1020, transit_days: 2, notes: "Backhaul — excellent rate opportunity" },
      // Container drayage
      { carrier_id: "PORT-DRAY-15",   carrier_name: "LA Port Drayage",   vehicle_type: "drayage",  origin_city: "Port of LA, CA", dest_city: "Los Angeles, CA", depart_date: tomorrow, capacity_lbs: 44000, remaining_lbs: 44000, price_per_mile: 0.65, distance_miles: 45,   transit_days: 1, notes: "Port container pickup and delivery" },
    ];

    const insertCap = db.prepare(`
      INSERT OR IGNORE INTO logistics_capacity
        (id, carrier_id, carrier_name, vehicle_type, origin_city, dest_city, depart_date, capacity_lbs, remaining_lbs, price_per_mile, distance_miles, transit_days, status, notes)
      VALUES
        (@id, @carrier_id, @carrier_name, @vehicle_type, @origin_city, @dest_city, @depart_date, @capacity_lbs, @remaining_lbs, @price_per_mile, @distance_miles, @transit_days, @status, @notes)
    `);
    for (const lane of capacityLanes) {
      insertCap.run({ id: randomUUID(), status: "available", ...lane });
    }
  }
} catch (e) {
  console.error("[logistics-routing] seed error:", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CITY_COORDS = {
  "Los Angeles, CA":   { lat: 34.052, lon: -118.244 },
  "New York, NY":      { lat: 40.713, lon: -74.006  },
  "Chicago, IL":       { lat: 41.878, lon: -87.630  },
  "Houston, TX":       { lat: 29.760, lon: -95.370  },
  "Miami, FL":         { lat: 25.775, lon: -80.209  },
  "Seattle, WA":       { lat: 47.608, lon: -122.335 },
  "Denver, CO":        { lat: 39.739, lon: -104.984 },
  "Dallas, TX":        { lat: 32.776, lon: -96.797  },
  "Atlanta, GA":       { lat: 33.749, lon: -84.388  },
  "Phoenix, AZ":       { lat: 33.448, lon: -112.074 },
  "Minneapolis, MN":   { lat: 44.977, lon: -93.265  },
  "Portland, OR":      { lat: 45.523, lon: -122.676 },
  "Nashville, TN":     { lat: 36.162, lon: -86.781  },
  "Kansas City, MO":   { lat: 39.099, lon: -94.578  },
  "Indianapolis, IN":  { lat: 39.768, lon: -86.158  },
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function estimateDistance(origin, dest) {
  const o = CITY_COORDS[origin];
  const d = CITY_COORDS[dest];
  if (!o || !d) return 500; // fallback
  return Math.round(haversine(o.lat, o.lon, d.lat, d.lon) * 1.3); // road factor
}

function dimWeight(lengthIn, widthIn, heightIn) {
  return (lengthIn * widthIn * heightIn) / 139; // standard DIM factor in lbs
}

// ─── 1. logisticsQuote ────────────────────────────────────────────────────────

export function logisticsQuote(args) {
  const { origin, destination, weight_lbs, length_in = 48, width_in = 40, height_in = 48, urgency = "standard", shipper_id } = args;
  if (!origin)      throw new Error("origin is required");
  if (!destination) throw new Error("destination is required");
  if (!weight_lbs)  throw new Error("weight_lbs is required");

  const wt      = parseFloat(weight_lbs);
  const dimWt   = dimWeight(parseFloat(length_in), parseFloat(width_in), parseFloat(height_in));
  const billWt  = Math.max(wt, dimWt);
  const miles   = estimateDistance(origin, destination);

  // Carrier rate table by urgency
  const urgencyMultipliers = { economy: 0.75, standard: 1.0, expedited: 1.45, overnight: 2.20 };
  const mult = urgencyMultipliers[urgency] || 1.0;

  const carriers = [
    { carrier: "FedEx Freight",     base_rate_per_lb: 0.085, fuel_surcharge_pct: 22, transit_days: urgency === "overnight" ? 1 : urgency === "expedited" ? 2 : 3, type: "LTL/FTL" },
    { carrier: "UPS Freight",       base_rate_per_lb: 0.082, fuel_surcharge_pct: 21, transit_days: urgency === "overnight" ? 1 : urgency === "expedited" ? 2 : 3, type: "LTL" },
    { carrier: "XPO Logistics",     base_rate_per_lb: 0.078, fuel_surcharge_pct: 20, transit_days: urgency === "overnight" ? 1 : urgency === "expedited" ? 3 : 4, type: "LTL/FTL" },
    { carrier: "Old Dominion",      base_rate_per_lb: 0.080, fuel_surcharge_pct: 19, transit_days: urgency === "overnight" ? 1 : urgency === "expedited" ? 2 : 3, type: "LTL" },
    { carrier: "Estes Express",     base_rate_per_lb: 0.075, fuel_surcharge_pct: 18, transit_days: urgency === "overnight" ? 2 : urgency === "expedited" ? 3 : 4, type: "LTL" },
    { carrier: "Spot Truckload",    base_rate_per_lb: 0.065, fuel_surcharge_pct: 15, transit_days: urgency === "overnight" ? 2 : urgency === "expedited" ? 3 : 5, type: "FTL" },
  ];

  const quotes = carriers.map(c => {
    const baseFreight = billWt * c.base_rate_per_lb * mult + miles * 0.015;
    const fuelAdj     = baseFreight * (c.fuel_surcharge_pct / 100);
    const total       = parseFloat((baseFreight + fuelAdj).toFixed(2));
    const eta         = new Date(Date.now() + c.transit_days * 86400000).toISOString().slice(0, 10);
    return {
      carrier:            c.carrier,
      service_type:       c.type,
      transit_days:       c.transit_days,
      eta_date:           eta,
      base_freight_usd:   parseFloat(baseFreight.toFixed(2)),
      fuel_surcharge_usd: parseFloat(fuelAdj.toFixed(2)),
      total_usd:          total,
      rate_per_mile:      parseFloat((total / miles).toFixed(3)),
    };
  }).sort((a, b) => a.total_usd - b.total_usd);

  const shipmentId = randomUUID();
  try {
    db.prepare(`
      INSERT INTO logistics_shipments (id, shipper_id, origin, destination, weight_lbs, length_in, width_in, height_in, urgency, status, quote_usd)
      VALUES (@id, @shipper_id, @origin, @destination, @weight_lbs, @length_in, @width_in, @height_in, @urgency, 'quoted', @quote_usd)
    `).run({
      id: shipmentId,
      shipper_id: shipper_id || "anon",
      origin, destination,
      weight_lbs: wt,
      length_in: parseFloat(length_in),
      width_in: parseFloat(width_in),
      height_in: parseFloat(height_in),
      urgency,
      quote_usd: quotes[0].total_usd,
    });
  } catch (e) {
    console.error("[logistics-routing] logisticsQuote insert error:", e.message);
  }

  return {
    shipment_id:    shipmentId,
    origin,
    destination,
    weight_lbs:     wt,
    dim_weight_lbs: parseFloat(dimWt.toFixed(1)),
    billable_weight_lbs: parseFloat(billWt.toFixed(1)),
    distance_miles: miles,
    urgency,
    quotes,
    best_rate:      quotes[0],
    savings_vs_worst: parseFloat((quotes[quotes.length-1].total_usd - quotes[0].total_usd).toFixed(2)),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 2. logisticsCapacityAuction ──────────────────────────────────────────────

export function logisticsCapacityAuction(args) {
  const { carrier_id, carrier_name, vehicle_type = "dry_van", origin_city, dest_city, depart_date, capacity_lbs, price_per_mile, notes } = args;
  if (!carrier_id)    throw new Error("carrier_id is required");
  if (!carrier_name)  throw new Error("carrier_name is required");
  if (!origin_city)   throw new Error("origin_city is required");
  if (!dest_city)     throw new Error("dest_city is required");
  if (!capacity_lbs)  throw new Error("capacity_lbs is required");
  if (!price_per_mile) throw new Error("price_per_mile is required");

  const distance   = estimateDistance(origin_city, dest_city);
  const transitDays = Math.max(1, Math.ceil(distance / 500));
  const totalValue = parseFloat((parseFloat(capacity_lbs) * 0.5 / 100 * parseFloat(price_per_mile) * distance).toFixed(2)); // rough estimate

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO logistics_capacity
        (id, carrier_id, carrier_name, vehicle_type, origin_city, dest_city, depart_date, capacity_lbs, remaining_lbs, price_per_mile, distance_miles, transit_days, status, notes)
      VALUES
        (@id, @carrier_id, @carrier_name, @vehicle_type, @origin_city, @dest_city, @depart_date, @capacity_lbs, @remaining_lbs, @price_per_mile, @distance_miles, @transit_days, 'available', @notes)
    `).run({
      id,
      carrier_id,
      carrier_name,
      vehicle_type,
      origin_city,
      dest_city,
      depart_date: depart_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      capacity_lbs: parseFloat(capacity_lbs),
      remaining_lbs: parseFloat(capacity_lbs),
      price_per_mile: parseFloat(price_per_mile),
      distance_miles: distance,
      transit_days: transitDays,
      notes: notes || "",
    });
  } catch (e) {
    console.error("[logistics-routing] logisticsCapacityAuction insert error:", e.message);
    throw e;
  }

  return {
    capacity_id:    id,
    carrier_id,
    carrier_name,
    vehicle_type,
    lane:           `${origin_city} → ${dest_city}`,
    depart_date:    depart_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    capacity_lbs:   parseFloat(capacity_lbs),
    price_per_mile: parseFloat(price_per_mile),
    distance_miles: distance,
    transit_days:   transitDays,
    total_lane_value_usd: totalValue,
    status:         "available",
    message:        `Capacity posted — shippers can now bid on your ${origin_city} → ${dest_city} lane.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 3. logisticsBidCapacity ─────────────────────────────────────────────────

export function logisticsBidCapacity(args) {
  const { capacity_id, bidder_id, weight_lbs, bid_per_mile } = args;
  if (!capacity_id) throw new Error("capacity_id is required");
  if (!bidder_id)   throw new Error("bidder_id is required");
  if (!weight_lbs)  throw new Error("weight_lbs is required");
  if (!bid_per_mile) throw new Error("bid_per_mile is required");

  const cap = db.prepare("SELECT * FROM logistics_capacity WHERE id = ?").get(capacity_id);
  if (!cap) throw new Error(`Capacity listing not found: ${capacity_id}`);
  if (cap.status === "full" || cap.status === "departed") {
    return { accepted: false, reason: `Capacity is ${cap.status}` };
  }

  const wt       = parseFloat(weight_lbs);
  const bidPpm   = parseFloat(bid_per_mile);
  const total    = parseFloat((bidPpm * cap.distance_miles).toFixed(2));
  const withinCap = wt <= cap.remaining_lbs;
  const competitive = bidPpm >= cap.price_per_mile * 0.85; // within 15% of ask

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO logistics_bids (id, capacity_id, bidder_id, weight_lbs, bid_per_mile, total_bid_usd, status)
      VALUES (@id, @capacity_id, @bidder_id, @weight_lbs, @bid_per_mile, @total_bid_usd, 'pending')
    `).run({ id, capacity_id, bidder_id, weight_lbs: wt, bid_per_mile: bidPpm, total_bid_usd: total });
  } catch (e) {
    console.error("[logistics-routing] logisticsBidCapacity insert error:", e.message);
    throw e;
  }

  return {
    bid_id:          id,
    capacity_id,
    lane:            `${cap.origin_city} → ${cap.dest_city}`,
    bidder_id,
    weight_lbs:      wt,
    bid_per_mile:    bidPpm,
    ask_per_mile:    cap.price_per_mile,
    total_bid_usd:   total,
    distance_miles:  cap.distance_miles,
    weight_fits:     withinCap,
    competitive_bid: competitive,
    transit_days:    cap.transit_days,
    status:          "pending",
    tip: !competitive ? `Your bid of $${bidPpm}/mi is below the ask of $${cap.price_per_mile}/mi — consider raising to improve acceptance odds.` : "Competitive bid — good chance of acceptance.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. logisticsRouteOptimize ────────────────────────────────────────────────

export function logisticsRouteOptimize(args) {
  const { stops, vehicle_type = "dry_van", max_weight_lbs = 44000, agent_id } = args;
  if (!stops || !Array.isArray(stops) || stops.length < 2) throw new Error("stops must be an array of 2+ locations");

  const fuelPricePerGallon = 3.85;
  const mpg = { dry_van: 6.5, flatbed: 6.0, reefer: 5.8, box_truck: 8.5, ltl: 6.5, drayage: 7.0, container: 6.0 }[vehicle_type] || 6.5;

  // Nearest-neighbor TSP heuristic
  const stopList = [...stops];
  const optimized = [stopList[0]];
  const remaining = stopList.slice(1);

  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    const lastCoords = CITY_COORDS[last.city || last] || { lat: 39, lon: -98 };
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const stopCity = remaining[i].city || remaining[i];
      const coords   = CITY_COORDS[stopCity] || { lat: 39, lon: -98 };
      const dist     = haversine(lastCoords.lat, lastCoords.lon, coords.lat, coords.lon);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    }
    optimized.push(remaining.splice(nearestIdx, 1)[0]);
  }

  // Calculate totals
  let totalMiles = 0;
  const legs = [];
  for (let i = 0; i < optimized.length - 1; i++) {
    const fromCity = optimized[i].city || optimized[i];
    const toCity   = optimized[i+1].city || optimized[i+1];
    const miles    = estimateDistance(fromCity, toCity);
    const driveHrs = miles / 55; // avg 55 mph
    const fuelCost = (miles / mpg) * fuelPricePerGallon;
    totalMiles += miles;
    legs.push({ from: fromCity, to: toCity, miles, drive_hrs: parseFloat(driveHrs.toFixed(1)), fuel_cost_usd: parseFloat(fuelCost.toFixed(2)) });
  }

  const totalHrs     = legs.reduce((s, l) => s + l.drive_hrs, 0) + (optimized.length - 2) * 0.5; // 30min stop time
  const totalFuel    = legs.reduce((s, l) => s + l.fuel_cost_usd, 0);
  const driverCostHr = 0.55 * 55; // $0.55/mile at 55mph
  const totalDriverCost = driverCostHr * (totalHrs / 55) * 55; // rough
  const totalCost    = totalFuel + totalFuel * 0.6; // fuel + driver approximation

  const routeId = randomUUID();
  try {
    db.prepare(`
      INSERT INTO logistics_routes (id, agent_id, stops_json, optimized_json, total_miles, total_hrs, fuel_cost_usd, num_stops, vehicle_type)
      VALUES (@id, @agent_id, @stops_json, @optimized_json, @total_miles, @total_hrs, @fuel_cost_usd, @num_stops, @vehicle_type)
    `).run({
      id: routeId,
      agent_id: agent_id || "anon",
      stops_json: JSON.stringify(stops),
      optimized_json: JSON.stringify(optimized),
      total_miles: parseFloat(totalMiles.toFixed(1)),
      total_hrs: parseFloat(totalHrs.toFixed(1)),
      fuel_cost_usd: parseFloat(totalFuel.toFixed(2)),
      num_stops: optimized.length,
      vehicle_type,
    });
  } catch (e) {
    console.error("[logistics-routing] logisticsRouteOptimize insert error:", e.message);
  }

  return {
    route_id:        routeId,
    vehicle_type,
    original_stops:  stops,
    optimized_route: optimized,
    legs,
    total_miles:     parseFloat(totalMiles.toFixed(1)),
    total_drive_hrs: parseFloat(totalHrs.toFixed(1)),
    total_days:      parseFloat((totalHrs / 11).toFixed(1)), // 11hrs driving per day max
    fuel_cost_usd:   parseFloat(totalFuel.toFixed(2)),
    fuel_gals:       parseFloat((totalMiles / mpg).toFixed(1)),
    est_total_cost_usd: parseFloat(totalCost.toFixed(2)),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 5. logisticsTrack ────────────────────────────────────────────────────────

export function logisticsTrack(args) {
  const { shipment_id, tracking_code } = args;
  if (!shipment_id && !tracking_code) throw new Error("shipment_id or tracking_code is required");

  const shipment = shipment_id
    ? db.prepare("SELECT * FROM logistics_shipments WHERE id = ?").get(shipment_id)
    : db.prepare("SELECT * FROM logistics_shipments WHERE tracking_code = ?").get(tracking_code);

  if (!shipment) {
    // Return simulated tracking for unknown IDs
    const fakeEvents = [
      { timestamp: new Date(Date.now() - 14400000).toISOString(), event: "Package picked up", location: "Origin facility" },
      { timestamp: new Date(Date.now() - 7200000).toISOString(),  event: "In transit to hub",  location: "Regional sortation center" },
      { timestamp: new Date(Date.now() - 1800000).toISOString(),  event: "Out for delivery",   location: "Destination city" },
    ];
    return {
      tracking_code: tracking_code || "SIM-" + (shipment_id || "").slice(0, 8),
      status: "in_transit",
      progress_pct: 75,
      eta: new Date(Date.now() + 18000000).toISOString(),
      events: fakeEvents,
      delay_alert: false,
      mode: "simulation",
    };
  }

  const transitPct = shipment.status === "delivered" ? 100 : shipment.status === "in_transit" ? Math.floor(20 + Math.random() * 70) : 5;
  const etaDate    = shipment.eta || new Date(Date.now() + 86400000 * 3).toISOString();

  const events = [
    { timestamp: shipment.created_at, event: "Shipment booked",   location: shipment.origin },
    { timestamp: new Date(new Date(shipment.created_at).getTime() + 7200000).toISOString(), event: "Picked up by carrier", location: shipment.origin },
  ];
  if (shipment.status === "in_transit" || shipment.status === "delivered") {
    events.push({ timestamp: new Date(Date.now() - 3600000 * Math.floor(Math.random() * 12)).toISOString(), event: "In transit", location: "En route" });
  }
  if (shipment.status === "delivered") {
    events.push({ timestamp: etaDate, event: "Delivered", location: shipment.destination });
  }

  return {
    shipment_id:    shipment.id,
    tracking_code:  shipment.tracking_code,
    origin:         shipment.origin,
    destination:    shipment.destination,
    status:         shipment.status,
    progress_pct:   transitPct,
    eta:            etaDate,
    carrier:        shipment.carrier_id,
    weight_lbs:     shipment.weight_lbs,
    urgency:        shipment.urgency,
    delay_alert:    false,
    events,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 6. logisticsConsolidate ─────────────────────────────────────────────────

export function logisticsConsolidate(args) {
  const { shipments, destination, agent_id } = args;
  if (!shipments || !Array.isArray(shipments) || shipments.length < 2) {
    throw new Error("shipments must be an array of 2+ shipment objects");
  }
  if (!destination) throw new Error("destination is required");

  const totalWeight = shipments.reduce((s, sh) => s + parseFloat(sh.weight_lbs || 0), 0);
  const totalItems  = shipments.length;

  // Calculate individual shipping cost vs consolidated
  const individualCosts = shipments.map(sh => {
    const miles    = estimateDistance(sh.origin || "Chicago, IL", destination);
    const billWt   = Math.max(parseFloat(sh.weight_lbs || 100), 50);
    return { origin: sh.origin, weight: parseFloat(sh.weight_lbs || 100), individual_cost: parseFloat((billWt * 0.085 * 1.22 + miles * 0.015).toFixed(2)) };
  });

  const totalIndividual  = individualCosts.reduce((s, c) => s + c.individual_cost, 0);
  const consolidatedCost = parseFloat((totalWeight * 0.065 * 1.18 + 800 * 0.015 + 150).toFixed(2)); // bulk rate + base
  const savings          = parseFloat((totalIndividual - consolidatedCost).toFixed(2));
  const savingsPct       = parseFloat(((savings / totalIndividual) * 100).toFixed(1));

  const pickupSchedule = shipments.map((sh, i) => ({
    shipment_ref: sh.ref || `SHIP-${i+1}`,
    origin:       sh.origin,
    weight_lbs:   parseFloat(sh.weight_lbs || 100),
    pickup_window: `Day 1, ${8 + i * 2}:00 - ${10 + i * 2}:00`,
    individual_cost_usd: individualCosts[i].individual_cost,
  }));

  return {
    consolidation_id:       randomUUID(),
    agent_id:               agent_id || "anon",
    destination,
    shipments_consolidated: totalItems,
    total_weight_lbs:       parseFloat(totalWeight.toFixed(1)),
    pickup_schedule:        pickupSchedule,
    individual_total_usd:   parseFloat(totalIndividual.toFixed(2)),
    consolidated_cost_usd:  consolidatedCost,
    savings_usd:            savings > 0 ? savings : 0,
    savings_pct:            savings > 0 ? savingsPct : 0,
    recommended_carrier:    totalWeight > 20000 ? "FTL — Werner Enterprises" : "LTL — Old Dominion Freight",
    vehicle_needed:         totalWeight > 20000 ? "dry_van FTL" : "LTL pallet consolidation",
    transit_days:           3,
    action: savings > 0
      ? `Consolidate ${totalItems} shipments to save $${savings.toFixed(2)} (${savingsPct}%) vs shipping individually.`
      : "Individual shipping may be more cost-effective for this shipment mix.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 7. logisticsLastMile ────────────────────────────────────────────────────

export function logisticsLastMile(args) {
  const { destination_address, weight_lbs = 5, dimensions_in, delivery_window, special_instructions } = args;
  if (!destination_address) throw new Error("destination_address is required");

  const wt = parseFloat(weight_lbs);

  const options = [
    {
      method:          "Standard Ground",
      carrier:         "UPS/FedEx Ground",
      transit_days:    3,
      price_usd:       parseFloat((wt * 0.045 + 8.50).toFixed(2)),
      tracking:        true,
      signature_req:   false,
      eco_score:       3,
      description:     "Standard residential delivery. Most cost-effective for non-urgent packages.",
    },
    {
      method:          "Direct 2-Day",
      carrier:         "FedEx 2Day",
      transit_days:    2,
      price_usd:       parseFloat((wt * 0.065 + 18.50).toFixed(2)),
      tracking:        true,
      signature_req:   false,
      eco_score:       3,
      description:     "Guaranteed 2-day delivery to most US addresses.",
    },
    {
      method:          "Overnight Express",
      carrier:         "FedEx Priority Overnight",
      transit_days:    1,
      price_usd:       parseFloat((wt * 0.12 + 38.00).toFixed(2)),
      tracking:        true,
      signature_req:   true,
      eco_score:       2,
      description:     "Next business day delivery by 10:30 AM.",
    },
    {
      method:          "Smart Locker",
      carrier:         "Amazon Hub / UPS Access Point",
      transit_days:    2,
      price_usd:       parseFloat((wt * 0.038 + 6.00).toFixed(2)),
      tracking:        true,
      signature_req:   false,
      eco_score:       5,
      description:     "Deliver to nearby locker — reduces failed deliveries and theft. Best eco option.",
    },
    {
      method:          "Scheduled Window",
      carrier:         "Instacart/GoFor Local Delivery",
      transit_days:    wt > 50 ? 2 : 1,
      price_usd:       parseFloat((wt * 0.05 + 15.00).toFixed(2)),
      tracking:        true,
      signature_req:   true,
      eco_score:       4,
      description:     `2-hour delivery window. ${delivery_window ? `Requested: ${delivery_window}.` : "Choose your window at checkout."}`,
    },
    {
      method:          "Drone Delivery",
      carrier:         "Wing / Amazon Prime Air",
      transit_days:    0.04, // ~1 hour
      price_usd:       parseFloat((wt * 0.08 + 25.00).toFixed(2)),
      tracking:        true,
      signature_req:   false,
      eco_score:       4,
      available:       wt <= 5,
      description:     wt <= 5 ? "Sub-1-hour drone delivery. Only available for packages under 5 lbs." : "Not available — package exceeds 5 lb drone weight limit.",
    },
  ].filter(o => o.available !== false).sort((a, b) => a.price_usd - b.price_usd);

  return {
    destination:       destination_address,
    weight_lbs:        wt,
    options,
    best_value:        options[0],
    fastest:           options.reduce((a, b) => a.transit_days < b.transit_days ? a : b),
    most_eco:          options.reduce((a, b) => a.eco_score > b.eco_score ? a : b),
    special_instructions: special_instructions || null,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 8. logisticsDashboard ────────────────────────────────────────────────────

export function logisticsDashboard(args) {
  const { agent_id } = args;

  let shipments, capacity, bids, routes;
  try {
    shipments = agent_id
      ? db.prepare("SELECT * FROM logistics_shipments WHERE shipper_id = ? ORDER BY created_at DESC LIMIT 20").all(agent_id)
      : db.prepare("SELECT * FROM logistics_shipments ORDER BY created_at DESC LIMIT 20").all();

    capacity = db.prepare("SELECT * FROM logistics_capacity WHERE status = 'available' ORDER BY price_per_mile ASC LIMIT 10").all();
    bids     = db.prepare("SELECT * FROM logistics_bids ORDER BY created_at DESC LIMIT 10").all();
    routes   = agent_id
      ? db.prepare("SELECT * FROM logistics_routes WHERE agent_id = ? ORDER BY created_at DESC LIMIT 5").all(agent_id)
      : db.prepare("SELECT * FROM logistics_routes ORDER BY created_at DESC LIMIT 5").all();
  } catch (e) {
    console.error("[logistics-routing] logisticsDashboard query error:", e.message);
    shipments = []; capacity = []; bids = []; routes = [];
  }

  const totalFreightSpend = shipments
    .filter(s => s.actual_cost_usd)
    .reduce((sum, s) => sum + s.actual_cost_usd, 0);

  const onTimeCount  = shipments.filter(s => s.status === "delivered").length;
  const inTransit    = shipments.filter(s => s.status === "in_transit").length;
  const carrierCounts = {};
  for (const s of shipments) {
    if (s.carrier_id) carrierCounts[s.carrier_id] = (carrierCounts[s.carrier_id] || 0) + 1;
  }
  const topCarrier = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    agent_id: agent_id || "all",
    shipments: {
      total:          shipments.length,
      in_transit:     inTransit,
      delivered:      onTimeCount,
      pending:        shipments.filter(s => s.status === "pending").length,
      total_freight_spend_usd: parseFloat(totalFreightSpend.toFixed(2)),
      on_time_rate_pct: shipments.length > 0 ? parseFloat(((onTimeCount / shipments.length) * 100).toFixed(1)) : null,
    },
    top_carrier: topCarrier ? { carrier: topCarrier[0], shipments: topCarrier[1] } : null,
    available_capacity: {
      count: capacity.length,
      best_lanes: capacity.slice(0, 3).map(c => ({
        lane:           `${c.origin_city} → ${c.dest_city}`,
        vehicle_type:   c.vehicle_type,
        remaining_lbs:  c.remaining_lbs,
        price_per_mile: c.price_per_mile,
        depart_date:    c.depart_date,
      })),
    },
    recent_routes: routes.map(r => ({
      route_id:    r.id,
      stops:       r.num_stops,
      total_miles: r.total_miles,
      fuel_cost:   r.fuel_cost_usd,
    })),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}
