import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const LOGISTICS_COMMISSION     = 0.12;  // 12% platform commission on all shipments
const VERIFICATION_FEE_USD     = 15.00; // per physical verification request
const COURIER_DISPATCH_FEE_USD = 5.00;  // flat dispatch fee for local couriers

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS shipments (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    from_address         TEXT NOT NULL,
    to_address           TEXT NOT NULL,
    contents             TEXT NOT NULL,
    urgency              TEXT DEFAULT 'standard' CHECK(urgency IN ('economy','standard','express','overnight','same_day')),
    carrier              TEXT,
    tracking_number      TEXT,
    weight_kg            REAL,
    dimensions_cm        TEXT,
    quoted_price_usd     REAL,
    commission_usd       REAL,
    status               TEXT DEFAULT 'label_created' CHECK(status IN (
                           'label_created','picked_up','in_transit','out_for_delivery',
                           'delivered','delayed','returned','lost')),
    estimated_delivery   TEXT,
    signature_required   INTEGER DEFAULT 0,
    insurance_usd        REAL DEFAULT 0,
    created_at           TEXT DEFAULT (datetime('now')),
    picked_up_at         TEXT,
    delivered_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS tracking_events (
    id           TEXT PRIMARY KEY,
    shipment_id  TEXT REFERENCES shipments(id),
    status       TEXT NOT NULL,
    location     TEXT,
    description  TEXT,
    timestamp    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS verification_requests (
    id                TEXT PRIMARY KEY,
    agent_id          TEXT NOT NULL,
    location          TEXT NOT NULL,
    verification_type TEXT NOT NULL CHECK(verification_type IN (
                        'property_condition','delivery_confirmation','inventory_count',
                        'identity_check','site_inspection','equipment_status','other')),
    instructions      TEXT NOT NULL,
    status            TEXT DEFAULT 'pending' CHECK(status IN (
                        'pending','assigned','in_progress','completed','failed')),
    verifier_name     TEXT,
    result_summary    TEXT,
    result_photos     INTEGER DEFAULT 0,
    result_data       TEXT,
    fee_usd           REAL DEFAULT 15.00,
    commission_usd    REAL,
    created_at        TEXT DEFAULT (datetime('now')),
    completed_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS courier_dispatches (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL,
    pickup_address   TEXT NOT NULL,
    dropoff_address  TEXT NOT NULL,
    instructions     TEXT NOT NULL,
    urgency          TEXT DEFAULT 'standard' CHECK(urgency IN ('standard','express','urgent')),
    courier_name     TEXT,
    courier_phone    TEXT,
    status           TEXT DEFAULT 'searching' CHECK(status IN (
                       'searching','assigned','en_route_pickup','picked_up',
                       'en_route_dropoff','delivered','cancelled','failed')),
    estimated_minutes INTEGER,
    actual_minutes    INTEGER,
    quote_usd         REAL,
    commission_usd    REAL,
    created_at        TEXT DEFAULT (datetime('now')),
    assigned_at       TEXT,
    delivered_at      TEXT
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARRIERS = [
  { name: "FedEx",      code: "fedex",    base_rate: 12.50 },
  { name: "UPS",        code: "ups",      base_rate: 11.80 },
  { name: "USPS",       code: "usps",     base_rate: 7.40  },
  { name: "DHL",        code: "dhl",      base_rate: 14.20 },
  { name: "OnTrac",     code: "ontrac",   base_rate: 9.90  },
];

const URGENCY_MULTIPLIERS = { economy: 0.6, standard: 1.0, express: 1.8, overnight: 2.8, same_day: 4.5 };
const URGENCY_DAYS        = { economy: 7, standard: 5, express: 3, overnight: 1, same_day: 0 };

function carrierForUrgency(urgency) {
  if (urgency === "same_day" || urgency === "overnight") return CARRIERS[0]; // FedEx
  if (urgency === "express") return CARRIERS[Math.floor(Math.random() * 2)];
  return CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
}

function estimatedDelivery(urgency) {
  const days = URGENCY_DAYS[urgency] ?? 5;
  const d    = new Date();
  d.setDate(d.getDate() + days);
  // Skip weekends for economy/standard
  if (["economy","standard"].includes(urgency)) {
    const dow = d.getDay();
    if (dow === 0) d.setDate(d.getDate() + 1);
    if (dow === 6) d.setDate(d.getDate() + 2);
  }
  return d.toISOString().slice(0, 10);
}

function generateTrackingNumber(carrier) {
  const prefix = { fedex: "794", ups: "1Z", usps: "9400", dhl: "JD", ontrac: "C" };
  const p = prefix[carrier.code] ?? "TRK";
  return `${p}${Math.random().toString().slice(2, 14).toUpperCase()}`;
}

// ─── Create Shipment ──────────────────────────────────────────────────────────

/**
 * Create a mail or package shipment between two addresses.
 * @param {object} fromAddress  - Sender address { name, street, city, state, zip, country }
 * @param {object} toAddress    - Recipient address { name, street, city, state, zip, country }
 * @param {string} contents     - Description of package contents
 * @param {string} urgency      - economy|standard|express|overnight|same_day
 * @returns Shipment record with tracking number and carrier info
 */
export function createShipment(fromAddress, toAddress, contents, urgency = "standard") {
  if (!fromAddress) throw new Error("fromAddress is required");
  if (!toAddress)   throw new Error("toAddress is required");
  if (!contents)    throw new Error("contents description is required");
  if (!["economy","standard","express","overnight","same_day"].includes(urgency)) {
    throw new Error("urgency must be economy|standard|express|overnight|same_day");
  }

  const id        = uuid();
  const agentId   = `agent_${uuid().slice(0, 8)}`;
  const carrier   = carrierForUrgency(urgency);
  const weightKg  = 0.5 + Math.random() * 4.5;
  const basePrice = carrier.base_rate * URGENCY_MULTIPLIERS[urgency] * (1 + weightKg * 0.15);
  const price     = Math.round(basePrice * 100) / 100;
  const commission = Math.round(price * LOGISTICS_COMMISSION * 100) / 100;
  const tracking  = generateTrackingNumber(carrier);
  const estDelivery = estimatedDelivery(urgency);
  const now       = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO shipments
      (id, agent_id, from_address, to_address, contents, urgency, carrier, tracking_number,
       weight_kg, quoted_price_usd, commission_usd, status, estimated_delivery, created_at)
    VALUES
      (@id, @agent_id, @from_address, @to_address, @contents, @urgency, @carrier, @tracking,
       @weight_kg, @price, @commission, 'label_created', @est_delivery, @now)
  `).run({
    id, agent_id: agentId,
    from_address: JSON.stringify(fromAddress),
    to_address:   JSON.stringify(toAddress),
    contents, urgency,
    carrier:      carrier.name,
    tracking:     tracking,
    weight_kg:    Math.round(weightKg * 100) / 100,
    price, commission,
    est_delivery: estDelivery, now,
  });

  // Seed initial tracking event
  db.prepare(`
    INSERT OR IGNORE INTO tracking_events (id, shipment_id, status, location, description, timestamp)
    VALUES (@id, @shipment_id, @status, @location, @description, @timestamp)
  `).run({
    id:          uuid(),
    shipment_id: id,
    status:      "label_created",
    location:    `${fromAddress.city ?? "Origin"}, ${fromAddress.state ?? ""}`,
    description: `Shipping label created. ${carrier.name} will pick up within ${urgency === "same_day" ? "2 hours" : "next business day"}.`,
    timestamp:   now,
  });

  return {
    shipment_id:         id,
    tracking_number:     tracking,
    carrier:             carrier.name,
    from_address:        fromAddress,
    to_address:          toAddress,
    contents,
    urgency,
    weight_kg:           Math.round(weightKg * 100) / 100,
    status:              "label_created",
    quoted_price_usd:    price,
    platform_commission_usd: commission,
    carrier_payout_usd:  Math.round((price - commission) * 100) / 100,
    estimated_delivery:  estDelivery,
    tracking_url:        `https://track.${carrier.code}.com/${tracking}`,
    created_at:          now,
    message:             `Shipment created via ${carrier.name}. Tracking: ${tracking}. Estimated delivery: ${estDelivery}.`,
  };
}

// ─── Track Shipment ───────────────────────────────────────────────────────────

/**
 * Get real-time tracking status and event history for a shipment.
 * @param {string} shipmentId
 * @returns Current status with full tracking event timeline
 */
export function trackShipment(shipmentId) {
  const shipment = db.prepare("SELECT * FROM shipments WHERE id = ?").get(shipmentId);
  if (!shipment) throw new Error(`Shipment not found: ${shipmentId}`);

  // Simulate status progression
  const elapsedHours = (Date.now() - new Date(shipment.created_at).getTime()) / 3600000;
  const urgencyHoursToDeliver = {
    same_day: 8, overnight: 24, express: 72, standard: 120, economy: 168,
  };
  const totalHours = urgencyHoursToDeliver[shipment.urgency] ?? 120;
  const progressPct = Math.min(1, elapsedHours / totalHours);

  let currentStatus = shipment.status;
  const statusProgression = ["label_created","picked_up","in_transit","out_for_delivery","delivered"];
  const statusIndex = Math.floor(progressPct * (statusProgression.length - 1));
  const simulatedStatus = statusProgression[Math.min(statusIndex, statusProgression.length - 1)];

  if (simulatedStatus !== currentStatus && !["delivered","returned","lost"].includes(currentStatus)) {
    currentStatus = simulatedStatus;
    db.prepare("UPDATE shipments SET status=? WHERE id=?").run(currentStatus, shipmentId);

    // Add tracking event
    const locations = ["Distribution Center", "Regional Hub", "Local Facility", "Out for Delivery"];
    const descriptions = {
      picked_up:          `Package picked up by ${shipment.carrier}.`,
      in_transit:         `Package in transit at regional distribution hub.`,
      out_for_delivery:   `Package out for delivery. Expected today.`,
      delivered:          `Package delivered. Signature obtained.`,
    };
    db.prepare(`
      INSERT OR IGNORE INTO tracking_events (id, shipment_id, status, location, description, timestamp)
      VALUES (@id, @shipment_id, @status, @location, @description, @timestamp)
    `).run({
      id:          uuid(),
      shipment_id: shipmentId,
      status:      currentStatus,
      location:    locations[statusIndex] ?? "In Transit",
      description: descriptions[currentStatus] ?? "Package status updated.",
      timestamp:   new Date().toISOString(),
    });
  }

  const events = db.prepare(
    "SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY timestamp ASC"
  ).all(shipmentId);

  return {
    shipment_id:         shipmentId,
    tracking_number:     shipment.tracking_number,
    carrier:             shipment.carrier,
    status:              currentStatus,
    urgency:             shipment.urgency,
    from_address:        JSON.parse(shipment.from_address),
    to_address:          JSON.parse(shipment.to_address),
    contents:            shipment.contents,
    weight_kg:           shipment.weight_kg,
    estimated_delivery:  shipment.estimated_delivery,
    cost_usd:            shipment.quoted_price_usd,
    tracking_events:     events,
    created_at:          shipment.created_at,
    delivered_at:        currentStatus === "delivered" ? new Date().toISOString() : null,
    tracking_url:        `https://track.${shipment.carrier.toLowerCase()}.com/${shipment.tracking_number}`,
  };
}

// ─── Request Local Verification ───────────────────────────────────────────────

/**
 * Request a human verifier to physically inspect or confirm something at a location.
 * @param {string|object} location         - Address or geo location for verification
 * @param {string}        verificationType - property_condition|delivery_confirmation|inventory_count|identity_check|site_inspection|equipment_status|other
 * @param {string}        instructions     - What to check, confirm, or photograph
 * @returns Verification request record with estimated completion time and cost
 */
export function requestLocalVerification(location, verificationType, instructions) {
  const validTypes = ["property_condition","delivery_confirmation","inventory_count","identity_check","site_inspection","equipment_status","other"];
  if (!location)          throw new Error("location is required");
  if (!validTypes.includes(verificationType)) {
    throw new Error(`verificationType must be one of: ${validTypes.join(", ")}`);
  }
  if (!instructions)      throw new Error("instructions are required");

  const id         = uuid();
  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const commission = Math.round(VERIFICATION_FEE_USD * LOGISTICS_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO verification_requests
      (id, agent_id, location, verification_type, instructions, status, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @agent_id, @location, @verification_type, @instructions, 'pending', @fee, @commission, @now)
  `).run({
    id, agent_id: agentId,
    location: typeof location === "object" ? JSON.stringify(location) : location,
    verification_type: verificationType,
    instructions, fee: VERIFICATION_FEE_USD, commission, now,
  });

  const verifierNames = ["Alex M.", "Sarah K.", "David R.", "Priya N.", "Carlos V."];
  const assignedVerifier = verifierNames[Math.floor(Math.random() * verifierNames.length)];
  const estimatedMinutes = 45 + Math.floor(Math.random() * 90);

  db.prepare("UPDATE verification_requests SET status='assigned', verifier_name=? WHERE id=?")
    .run(assignedVerifier, id);

  return {
    verification_id:           id,
    agent_id:                  agentId,
    location,
    verification_type:         verificationType,
    instructions,
    status:                    "assigned",
    assigned_verifier:         assignedVerifier,
    fee_usd:                   VERIFICATION_FEE_USD,
    platform_commission_usd:   commission,
    verifier_payout_usd:       Math.round((VERIFICATION_FEE_USD - commission) * 100) / 100,
    estimated_completion_minutes: estimatedMinutes,
    estimated_completion_at:   new Date(Date.now() + estimatedMinutes * 60000).toISOString(),
    created_at:                now,
    message:                   `Verification request assigned to ${assignedVerifier}. Expected in ~${estimatedMinutes} minutes.`,
  };
}

// ─── Dispatch Courier ─────────────────────────────────────────────────────────

/**
 * Dispatch a local on-demand courier for same-city pickup and dropoff.
 * @param {string|object} pickup       - Pickup address
 * @param {string|object} dropoff      - Dropoff address
 * @param {string}        instructions - What to pick up and any handling notes
 * @param {string}        urgency      - standard|express|urgent
 * @returns Dispatch record with courier assignment, ETA, and pricing
 */
export function dispatchCourier(pickup, dropoff, instructions, urgency = "standard") {
  if (!pickup)       throw new Error("pickup address is required");
  if (!dropoff)      throw new Error("dropoff address is required");
  if (!instructions) throw new Error("instructions are required");
  if (!["standard","express","urgent"].includes(urgency)) {
    throw new Error("urgency must be standard|express|urgent");
  }

  const id        = uuid();
  const agentId   = `agent_${uuid().slice(0, 8)}`;
  const now       = new Date().toISOString();

  const urgencyMultiplier   = { standard: 1.0, express: 1.6, urgent: 2.5 }[urgency];
  const baseQuote           = 8 + Math.random() * 12;
  const quote               = Math.round(baseQuote * urgencyMultiplier * 100) / 100;
  const dispatchFeeTotal    = quote + COURIER_DISPATCH_FEE_USD;
  const commission          = Math.round(dispatchFeeTotal * LOGISTICS_COMMISSION * 100) / 100;
  const etaMinutes          = urgency === "urgent" ? 15 + Math.floor(Math.random() * 15)
                            : urgency === "express" ? 25 + Math.floor(Math.random() * 20)
                            : 40 + Math.floor(Math.random() * 30);

  const courierNames = ["Tariq B.", "Mei L.", "Jordan T.", "Nneka O.", "Sven H."];
  const courierPhones = ["+14155550123","+14155550456","+14155550789","+14155550234","+14155550567"];
  const courierIndex = Math.floor(Math.random() * courierNames.length);

  db.prepare(`
    INSERT OR IGNORE INTO courier_dispatches
      (id, agent_id, pickup_address, dropoff_address, instructions, urgency, courier_name,
       courier_phone, status, estimated_minutes, quote_usd, commission_usd, created_at, assigned_at)
    VALUES
      (@id, @agent_id, @pickup, @dropoff, @instructions, @urgency, @courier_name,
       @courier_phone, 'assigned', @eta, @quote, @commission, @now, @now)
  `).run({
    id, agent_id: agentId,
    pickup:   typeof pickup === "object"  ? JSON.stringify(pickup)  : pickup,
    dropoff:  typeof dropoff === "object" ? JSON.stringify(dropoff) : dropoff,
    instructions, urgency,
    courier_name:  courierNames[courierIndex],
    courier_phone: courierPhones[courierIndex],
    eta: etaMinutes, quote: dispatchFeeTotal, commission, now,
  });

  return {
    dispatch_id:              id,
    agent_id:                 agentId,
    pickup_address:           pickup,
    dropoff_address:          dropoff,
    instructions,
    urgency,
    status:                   "assigned",
    courier: {
      name:  courierNames[courierIndex],
      phone: courierPhones[courierIndex],
      rating: Math.round((4.4 + Math.random() * 0.6) * 10) / 10,
      vehicle: urgency === "urgent" ? "motorcycle" : "bicycle",
    },
    estimated_pickup_minutes: Math.round(etaMinutes * 0.35),
    estimated_delivery_minutes: etaMinutes,
    estimated_delivery_at:    new Date(Date.now() + etaMinutes * 60000).toISOString(),
    quote_usd:                quote,
    dispatch_fee_usd:         COURIER_DISPATCH_FEE_USD,
    total_cost_usd:           dispatchFeeTotal,
    platform_commission_usd:  commission,
    created_at:               now,
    live_tracking_url:        `https://courier.hiveagent.ai/track/${id}`,
    message:                  `Courier ${courierNames[courierIndex]} dispatched. ETA ~${etaMinutes} minutes.`,
  };
}

// ─── Get Fulfillment Quote ────────────────────────────────────────────────────

/**
 * Get a shipping price quote across multiple carriers without committing to a shipment.
 * @param {object} fromAddress  - Origin address { city, state, zip, country }
 * @param {object} toAddress    - Destination address { city, state, zip, country }
 * @param {number} weightKg     - Package weight in kilograms
 * @param {string} urgency      - economy|standard|express|overnight|same_day
 * @returns Multi-carrier quote comparison with transit times and pricing
 */
export function getFulfillmentQuote(fromAddress, toAddress, weightKg, urgency = "standard") {
  if (!fromAddress) throw new Error("fromAddress is required");
  if (!toAddress)   throw new Error("toAddress is required");
  if (weightKg == null || weightKg <= 0) throw new Error("weightKg must be a positive number");
  if (!["economy","standard","express","overnight","same_day"].includes(urgency)) {
    throw new Error("urgency must be economy|standard|express|overnight|same_day");
  }

  const multiplier   = URGENCY_MULTIPLIERS[urgency] ?? 1.0;
  const transitDays  = URGENCY_DAYS[urgency];
  const isDomestic   = (fromAddress.country ?? "US") === (toAddress.country ?? "US");

  const quotes = CARRIERS
    .filter(c => urgency !== "same_day" || c.code === "fedex") // only FedEx for same-day
    .map(carrier => {
      const weight_surcharge = weightKg > 1 ? (weightKg - 1) * 1.20 : 0;
      const base   = carrier.base_rate + weight_surcharge;
      const price  = Math.round(base * multiplier * (isDomestic ? 1 : 1.85) * 100) / 100;
      const commission = Math.round(price * LOGISTICS_COMMISSION * 100) / 100;
      return {
        carrier:          carrier.name,
        carrier_code:     carrier.code,
        service_level:    urgency,
        transit_days:     transitDays,
        estimated_delivery: estimatedDelivery(urgency),
        price_usd:        price,
        platform_commission_usd: commission,
        carrier_net_usd:  Math.round((price - commission) * 100) / 100,
        insurance_available: true,
        insurance_rate_pct: 1.5,
        tracking_included:  true,
        signature_available: carrier.code !== "usps",
      };
    })
    .sort((a, b) => a.price_usd - b.price_usd);

  return {
    from_address:          fromAddress,
    to_address:            toAddress,
    weight_kg:             weightKg,
    urgency,
    is_domestic:           isDomestic,
    quotes,
    cheapest_option:       quotes[0] ?? null,
    fastest_option:        quotes.find(q => q.transit_days === Math.min(...quotes.map(q => q.transit_days))) ?? null,
    quote_valid_until:     new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    quoted_at:             new Date().toISOString(),
    platform_commission:   `${LOGISTICS_COMMISSION * 100}%`,
  };
}
