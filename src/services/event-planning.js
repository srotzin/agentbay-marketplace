/**
 * HiveAgent — Event Planning & Venue Management Service
 *
 * AI-powered event operations for agents:
 *   searchVenues         — Search event venues                  free
 *   bookVenue            — Book a venue                         5% commission
 *   planEvent            — AI event planning                    $5.00/plan
 *   manageRegistration   — Event registration management        $0.25/registration
 *   coordinateVendors    — Coordinate catering, AV, decor, etc. $1.00/coordination
 *   getEventDashboard    — Event analytics dashboard            $3.00/event
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────
const FEES = {
  venue_search:    0,
  venue_booking:   0.05,   // 5% commission on venue price
  event_plan:      5.00,
  registration:    0.25,
  coordination:    1.00,
  dashboard:       3.00,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ev_venues (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    location      TEXT NOT NULL,
    event_types   TEXT NOT NULL DEFAULT '[]',
    capacity      INTEGER NOT NULL,
    price_per_day REAL NOT NULL,
    price_min     REAL NOT NULL,
    price_max     REAL NOT NULL,
    amenities     TEXT NOT NULL DEFAULT '[]',
    rating        REAL NOT NULL DEFAULT 4.0,
    photos_count  INTEGER NOT NULL DEFAULT 0,
    available     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ev_bookings (
    id                  TEXT PRIMARY KEY,
    venue_id            TEXT NOT NULL REFERENCES ev_venues(id),
    event_date          TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    attendees           INTEGER NOT NULL,
    organizer_name      TEXT NOT NULL,
    organizer_email     TEXT NOT NULL,
    deposit_required    REAL NOT NULL,
    total_price         REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    status              TEXT NOT NULL DEFAULT 'confirmed',
    cancellation_policy TEXT NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ev_events (
    id                  TEXT PRIMARY KEY,
    event_type          TEXT NOT NULL,
    attendees           INTEGER NOT NULL,
    budget              REAL NOT NULL,
    plan_json           TEXT NOT NULL DEFAULT '{}',
    fee_usd             REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ev_registrations (
    id                    TEXT PRIMARY KEY,
    event_id              TEXT NOT NULL,
    registrant_name       TEXT NOT NULL,
    registrant_email      TEXT NOT NULL,
    ticket_type           TEXT NOT NULL,
    dietary_preferences   TEXT NOT NULL DEFAULT 'none',
    special_requirements  TEXT,
    fee_usd               REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ev_vendors (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    service_type TEXT NOT NULL,
    location     TEXT NOT NULL,
    rating       REAL NOT NULL DEFAULT 4.0,
    price_tier   TEXT NOT NULL,
    available    INTEGER NOT NULL DEFAULT 1,
    specialties  TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_ev_venues_location ON ev_venues(location);
  CREATE INDEX IF NOT EXISTS idx_ev_registrations_event ON ev_registrations(event_id);
  CREATE INDEX IF NOT EXISTS idx_ev_vendors_service ON ev_vendors(service_type);
`);

// ─── Seed Venues ──────────────────────────────────────────────────────────────
const _venueCount = db.prepare("SELECT COUNT(*) as n FROM ev_venues").get().n;
if (_venueCount === 0) {
  const seedVenues = [
    { id: uuid(), name: "The Grand Ballroom",       location: "New York, NY",     event_types: '["wedding","corporate","gala"]',           capacity: 500,  price_per_day: 8000,  price_min: 6000,  price_max: 15000, amenities: '["catering","AV","parking","bridal suite"]',    rating: 4.8, photos_count: 48 },
    { id: uuid(), name: "Silicon Valley Conference Center", location: "San Jose, CA", event_types: '["conference","workshop","corporate"]', capacity: 800,  price_per_day: 12000, price_min: 9000,  price_max: 20000, amenities: '["AV","WiFi","catering","breakout rooms"]',      rating: 4.7, photos_count: 36 },
    { id: uuid(), name: "Lakeside Pavilion",        location: "Chicago, IL",      event_types: '["wedding","party","corporate"]',          capacity: 250,  price_per_day: 4500,  price_min: 3500,  price_max: 8000,  amenities: '["outdoor terrace","catering","parking","bar"]', rating: 4.6, photos_count: 30 },
    { id: uuid(), name: "Urban Loft Events",        location: "Brooklyn, NY",     event_types: '["party","corporate","wedding"]',          capacity: 150,  price_per_day: 3000,  price_min: 2000,  price_max: 5000,  amenities: '["rooftop","AV","bar","kitchen"]',               rating: 4.5, photos_count: 24 },
    { id: uuid(), name: "The Heritage Manor",       location: "Boston, MA",       event_types: '["wedding","gala","corporate"]',           capacity: 300,  price_per_day: 6000,  price_min: 4500,  price_max: 12000, amenities: '["garden","catering","parking","bridal suite"]', rating: 4.9, photos_count: 55 },
    { id: uuid(), name: "TechHub Meeting Space",    location: "Austin, TX",       event_types: '["workshop","conference","corporate"]',    capacity: 200,  price_per_day: 3500,  price_min: 2500,  price_max: 6000,  amenities: '["AV","WiFi","whiteboards","catering"]',         rating: 4.4, photos_count: 18 },
    { id: uuid(), name: "Oceanfront Events",        location: "Miami, FL",        event_types: '["wedding","party","gala"]',               capacity: 400,  price_per_day: 9000,  price_min: 7000,  price_max: 18000, amenities: '["beachfront","catering","AV","pool"]',          rating: 4.8, photos_count: 62 },
    { id: uuid(), name: "Mountain Lodge Retreat",   location: "Denver, CO",       event_types: '["corporate","wedding","workshop"]',       capacity: 120,  price_per_day: 4000,  price_min: 3000,  price_max: 7000,  amenities: '["mountain view","catering","WiFi","fireplace"]', rating: 4.7, photos_count: 28 },
    { id: uuid(), name: "The Botanical Garden",     location: "Seattle, WA",      event_types: '["wedding","party","gala"]',               capacity: 200,  price_per_day: 5500,  price_min: 4000,  price_max: 10000, amenities: '["gardens","outdoor","catering","parking"]',     rating: 4.9, photos_count: 44 },
    { id: uuid(), name: "Downtown Convention Hub",  location: "Las Vegas, NV",    event_types: '["conference","corporate","trade_show"]',  capacity: 2000, price_per_day: 25000, price_min: 18000, price_max: 50000, amenities: '["AV","WiFi","catering","exhibit hall"]',        rating: 4.5, photos_count: 80 },
    { id: uuid(), name: "Vineyard Estate",          location: "Napa, CA",         event_types: '["wedding","corporate","gala"]',           capacity: 180,  price_per_day: 7000,  price_min: 5500,  price_max: 14000, amenities: '["vineyard tour","wine","catering","terrace"]',  rating: 4.9, photos_count: 50 },
    { id: uuid(), name: "Historic Theater Venue",   location: "Nashville, TN",    event_types: '["corporate","gala","party","wedding"]',   capacity: 350,  price_per_day: 5000,  price_min: 3500,  price_max: 9000,  amenities: '["stage","AV","catering","green room"]',         rating: 4.6, photos_count: 32 },
    { id: uuid(), name: "Rooftop Sky Lounge",       location: "Los Angeles, CA",  event_types: '["party","corporate","wedding"]',          capacity: 200,  price_per_day: 6500,  price_min: 5000,  price_max: 12000, amenities: '["city view","bar","AV","catering"]',            rating: 4.7, photos_count: 38 },
    { id: uuid(), name: "Expo & Innovation Center", location: "Phoenix, AZ",      event_types: '["conference","trade_show","corporate"]',  capacity: 1500, price_per_day: 18000, price_min: 12000, price_max: 35000, amenities: '["exhibit space","AV","WiFi","parking"]',        rating: 4.4, photos_count: 55 },
    { id: uuid(), name: "Riverside Barn",           location: "Portland, OR",     event_types: '["wedding","party","corporate"]',          capacity: 160,  price_per_day: 3800,  price_min: 2800,  price_max: 6500,  amenities: '["rustic decor","outdoor","catering","bar"]',   rating: 4.8, photos_count: 35 },
  ];
  const insertVenue = db.prepare(`
    INSERT OR IGNORE INTO ev_venues
      (id, name, location, event_types, capacity, price_per_day, price_min, price_max, amenities, rating, photos_count, available)
    VALUES (@id, @name, @location, @event_types, @capacity, @price_per_day, @price_min, @price_max, @amenities, @rating, @photos_count, 1)
  `);
  for (const v of seedVenues) insertVenue.run(v);
}

// ─── Seed Vendors ─────────────────────────────────────────────────────────────
const _vendorCount = db.prepare("SELECT COUNT(*) as n FROM ev_vendors").get().n;
if (_vendorCount === 0) {
  const seedVendors = [
    { id: uuid(), name: "Elite Catering Co.",         service_type: "catering",    location: "New York, NY",    rating: 4.8, price_tier: "premium",   specialties: '["fine dining","buffet","dietary accommodations"]' },
    { id: uuid(), name: "SoundWave AV",               service_type: "av",          location: "Los Angeles, CA", rating: 4.7, price_tier: "standard",  specialties: '["live sound","projection","lighting"]' },
    { id: uuid(), name: "Bloom & Petal Florals",      service_type: "decor",       location: "Chicago, IL",     rating: 4.9, price_tier: "premium",   specialties: '["wedding florals","centerpieces","arch design"]' },
    { id: uuid(), name: "Snap Moments Photography",   service_type: "photography", location: "San Francisco, CA", rating: 4.8, price_tier: "standard", specialties: '["event","portrait","aerial drone"]' },
    { id: uuid(), name: "SilverScreen Video",         service_type: "videography", location: "Austin, TX",      rating: 4.6, price_tier: "standard",  specialties: '["highlight reel","livestream","4K"]' },
    { id: uuid(), name: "Party Perfect Rentals",      service_type: "rentals",     location: "Miami, FL",       rating: 4.5, price_tier: "budget",    specialties: '["chairs","tables","linens","tents"]' },
    { id: uuid(), name: "Gourmet Bites Catering",     service_type: "catering",    location: "Boston, MA",      rating: 4.7, price_tier: "standard",  specialties: '["cocktail reception","plated dinner","bar service"]' },
    { id: uuid(), name: "Stage & Screen Productions", service_type: "av",          location: "Nashville, TN",   rating: 4.9, price_tier: "premium",   specialties: '["concert audio","LED walls","stage design"]' },
    { id: uuid(), name: "Enchanted Events Decor",     service_type: "decor",       location: "Seattle, WA",     rating: 4.8, price_tier: "premium",   specialties: '["themed decor","balloon art","lighting design"]' },
    { id: uuid(), name: "FreshFrames Photo Booth",    service_type: "photography", location: "Denver, CO",      rating: 4.4, price_tier: "budget",    specialties: '["photo booth","instant prints","GIF booth"]' },
    { id: uuid(), name: "Taste of Italy Catering",   service_type: "catering",    location: "Las Vegas, NV",   rating: 4.6, price_tier: "standard",  specialties: '["Italian cuisine","buffet","food stations"]' },
    { id: uuid(), name: "ProLight Events",            service_type: "av",          location: "Phoenix, AZ",     rating: 4.5, price_tier: "standard",  specialties: '["uplighting","gobo projection","intelligent lighting"]' },
    { id: uuid(), name: "Rustic Charm Decor",         service_type: "decor",       location: "Portland, OR",    rating: 4.7, price_tier: "budget",    specialties: '["rustic","vintage","bohemian themes"]' },
    { id: uuid(), name: "Moment Makers Photography",  service_type: "photography", location: "Dallas, TX",      rating: 4.8, price_tier: "standard",  specialties: '["wedding","event","photojournalism"]' },
    { id: uuid(), name: "AllStar Party Supplies",     service_type: "rentals",     location: "Houston, TX",     rating: 4.3, price_tier: "budget",    specialties: '["inflatables","games","event equipment"]' },
    { id: uuid(), name: "Crimson & Gold Events",      service_type: "decor",       location: "Atlanta, GA",     rating: 4.7, price_tier: "premium",   specialties: '["luxury decor","drapery","custom installations"]' },
    { id: uuid(), name: "The Cake Studio",            service_type: "catering",    location: "Minneapolis, MN", rating: 4.9, price_tier: "premium",   specialties: '["wedding cakes","custom desserts","dessert stations"]' },
    { id: uuid(), name: "ClearView Livestream",       service_type: "av",          location: "San Diego, CA",   rating: 4.6, price_tier: "standard",  specialties: '["livestream","multi-camera","virtual events"]' },
    { id: uuid(), name: "Mobile Bar Solutions",       service_type: "catering",    location: "Nashville, TN",   rating: 4.5, price_tier: "standard",  specialties: '["open bar","craft cocktails","mocktails"]' },
    { id: uuid(), name: "Starlight Draping & Decor",  service_type: "decor",       location: "New York, NY",    rating: 4.8, price_tier: "premium",   specialties: '["ceiling draping","fairy lights","floral walls"]' },
  ];
  const insertVendor = db.prepare(`
    INSERT OR IGNORE INTO ev_vendors
      (id, name, service_type, location, rating, price_tier, available, specialties)
    VALUES (@id, @name, @service_type, @location, @rating, @price_tier, 1, @specialties)
  `);
  for (const v of seedVendors) insertVendor.run(v);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── searchVenues ─────────────────────────────────────────────────────────────
/**
 * Search for event venues.
 * @param {string} location   - City or region
 * @param {string} eventType  - conference | wedding | corporate | party | workshop
 * @param {number} capacity   - Required guest capacity
 * @param {object} dateRange  - {start, end} date range
 * @param {number} budget     - Maximum daily budget (USD)
 * @returns Matching venues with details, pricing, and availability
 */
export function searchVenues(location = "", eventType = "", capacity = 0, dateRange = {}, budget = 0) {
  let sql = "SELECT * FROM ev_venues WHERE available = 1";
  const params = [];

  if (location) {
    sql += " AND location LIKE ?";
    params.push(`%${location}%`);
  }
  if (capacity > 0) {
    sql += " AND capacity >= ?";
    params.push(capacity);
  }
  if (budget > 0) {
    sql += " AND price_min <= ?";
    params.push(budget);
  }

  sql += " ORDER BY rating DESC LIMIT 10";

  let venues = db.prepare(sql).all(...params);

  // Filter by event type post-query
  if (eventType) {
    venues = venues.filter(v => {
      const types = JSON.parse(v.event_types || "[]");
      return types.includes(eventType);
    });
  }

  const results = venues.map(v => ({
    venue_id: v.id,
    name: v.name,
    location: v.location,
    capacity: v.capacity,
    price_range: { min: v.price_min, max: v.price_max, per_day: v.price_per_day },
    amenities: JSON.parse(v.amenities || "[]"),
    event_types: JSON.parse(v.event_types || "[]"),
    availability: dateRange.start ? "available" : "check_required",
    rating: v.rating,
    photos_count: v.photos_count,
    contact_required: true,
  }));

  return {
    venues: results,
    count: results.length,
    search_params: { location, event_type: eventType, capacity, budget },
    fee_usd: FEES.venue_search,
    searched_at: new Date().toISOString(),
  };
}

// ─── bookVenue ────────────────────────────────────────────────────────────────
/**
 * Book an event venue.
 * @param {string} venueId     - Venue ID from searchVenues
 * @param {string} eventDate   - Date of event (YYYY-MM-DD)
 * @param {object} details     - {event_type, attendees, special_requests}
 * @param {object} contactInfo - {name, email, phone}
 * @returns Booking confirmation with deposit and cancellation policy
 */
export function bookVenue(venueId, eventDate, details = {}, contactInfo = {}) {
  if (!venueId) throw new Error("venueId is required");
  if (!eventDate) throw new Error("eventDate is required");
  if (!contactInfo.name) throw new Error("contactInfo.name is required");
  if (!contactInfo.email) throw new Error("contactInfo.email is required");

  const venue = db.prepare("SELECT * FROM ev_venues WHERE id = ?").get(venueId);
  if (!venue) throw new Error(`Venue not found: ${venueId}`);

  const eventType  = details.event_type ?? "corporate";
  const attendees  = details.attendees ?? Math.floor(venue.capacity * 0.7);
  const totalPrice = venue.price_per_day;
  const deposit    = Math.round(totalPrice * 0.25 * 100) / 100;
  const commission = Math.round(totalPrice * FEES.venue_booking * 100) / 100;

  const id = crypto.randomUUID();
  const cancellationPolicy =
    "Full refund if cancelled 30+ days before event. " +
    "50% refund if cancelled 15–29 days before. " +
    "No refund within 14 days of event.";

  db.prepare(`
    INSERT OR IGNORE INTO ev_bookings
      (id, venue_id, event_date, event_type, attendees, organizer_name, organizer_email, deposit_required, total_price, commission_usd, status, cancellation_policy)
    VALUES (@id, @venue_id, @event_date, @event_type, @attendees, @organizer_name, @organizer_email, @deposit_required, @total_price, @commission_usd, @status, @cancellation_policy)
  `).run({
    id,
    venue_id: venueId,
    event_date: eventDate,
    event_type: eventType,
    attendees,
    organizer_name: contactInfo.name,
    organizer_email: contactInfo.email,
    deposit_required: deposit,
    total_price: totalPrice,
    commission_usd: commission,
    status: "confirmed",
    cancellation_policy: cancellationPolicy,
  });

  return {
    booking_id: id,
    venue_name: venue.name,
    venue_location: venue.location,
    event_date: eventDate,
    event_type: eventType,
    attendees,
    total_price_usd: totalPrice,
    deposit_required_usd: deposit,
    deposit_due_date: new Date(Date.now() + 259200000).toISOString().split("T")[0],
    confirmation: `CONF-${id.slice(0, 8).toUpperCase()}`,
    status: "confirmed",
    cancellation_policy: cancellationPolicy,
    next_steps: [
      "Pay deposit to secure the booking",
      "Complete venue contract within 5 business days",
      "Provide final headcount 7 days before event",
      "Coordinate with venue coordinator for setup requirements",
    ],
    platform_fee_usd: commission,
    booked_at: new Date().toISOString(),
  };
}

// ─── planEvent ────────────────────────────────────────────────────────────────
/**
 * Generate a comprehensive AI event plan.
 * @param {string} eventType  - Type of event (conference, wedding, corporate, party, workshop)
 * @param {number} attendees  - Expected number of attendees
 * @param {number} budget     - Total budget (USD)
 * @param {object} preferences - {theme, catering, style, location_preference}
 * @returns Complete event plan with timeline, vendors, budget breakdown, logistics
 */
export function planEvent(eventType = "corporate", attendees = 100, budget = 10000, preferences = {}) {
  if (attendees <= 0) throw new Error("attendees must be a positive number");
  if (budget <= 0)    throw new Error("budget must be a positive number");

  const validTypes = ["conference","wedding","corporate","party","workshop"];
  if (!validTypes.includes(eventType)) throw new Error(`eventType must be one of: ${validTypes.join(", ")}`);

  const timeline = [
    { week: -12, task: "Secure venue and confirm availability" },
    { week: -10, task: "Send save-the-dates and open registration" },
    { week:  -8, task: "Book catering, AV, and photography vendors" },
    { week:  -6, task: "Finalize agenda and confirm speakers/entertainment" },
    { week:  -4, task: "Send invitations with full event details" },
    { week:  -3, task: "Confirm all vendor contracts and deliverables" },
    { week:  -2, task: "Finalize headcount and special dietary requirements" },
    { week:  -1, task: "Conduct run-through with all vendors" },
    { week:   0, task: "Event day — execute plan, enjoy success!" },
  ];

  const budgetRatios = {
    conference: { venue: 0.30, catering: 0.25, av: 0.20, marketing: 0.10, misc: 0.15 },
    wedding:    { venue: 0.35, catering: 0.30, photography: 0.12, decor: 0.13, misc: 0.10 },
    corporate:  { venue: 0.30, catering: 0.25, av: 0.15, decor: 0.10, misc: 0.20 },
    party:      { venue: 0.30, catering: 0.30, entertainment: 0.20, decor: 0.10, misc: 0.10 },
    workshop:   { venue: 0.35, catering: 0.20, av: 0.15, materials: 0.15, misc: 0.15 },
  };

  const ratios = budgetRatios[eventType];
  const budget_breakdown = {};
  for (const [category, pct] of Object.entries(ratios)) {
    budget_breakdown[category] = Math.round(budget * pct * 100) / 100;
  }

  const vendorsByType = {
    conference: ["catering","av","photography"],
    wedding:    ["catering","photography","decor","videography"],
    corporate:  ["catering","av","decor"],
    party:      ["catering","av","decor","photography"],
    workshop:   ["catering","av","rentals"],
  };

  const vendors_needed = vendorsByType[eventType].map(type => ({
    service: type,
    budget_allocated: budget_breakdown[type] ?? Math.round(budget * 0.1),
    priority: ["catering","av","venue"].includes(type) ? "essential" : "recommended",
  }));

  const logistics = [
    `Arrange ${eventType === "conference" || eventType === "workshop" ? "shuttle service" : "valet parking"} for ${attendees} guests`,
    "Set up registration/check-in desk with digital check-in system",
    "Prepare emergency contact list and contingency plan",
    `Order ${Math.ceil(attendees * 1.1)} place settings/seats`,
    "Arrange branded signage and wayfinding",
  ];

  const checklist = [
    { item: "Venue booking confirmed", category: "venue" },
    { item: "Catering menu finalized", category: "catering" },
    { item: "AV equipment tested", category: "av" },
    { item: "Guest list finalized", category: "attendees" },
    { item: "Dietary requirements collected", category: "catering" },
    { item: "Insurance/liability coverage", category: "logistics" },
    { item: "Day-of schedule distributed to all staff", category: "operations" },
    { item: "Payment to all vendors processed", category: "finance" },
  ];

  const plan = { timeline, vendors_needed, budget_breakdown, logistics, checklist };

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO ev_events
      (id, event_type, attendees, budget, plan_json, fee_usd)
    VALUES (@id, @event_type, @attendees, @budget, @plan_json, @fee_usd)
  `).run({
    id,
    event_type: eventType,
    attendees,
    budget,
    plan_json: JSON.stringify(plan),
    fee_usd: FEES.event_plan,
  });

  return {
    plan_id: id,
    event_type: eventType,
    attendees,
    total_budget: budget,
    per_person_budget: Math.round(budget / attendees * 100) / 100,
    theme: preferences.theme ?? `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Excellence`,
    plan,
    fee_usd: FEES.event_plan,
    planned_at: new Date().toISOString(),
  };
}

// ─── manageRegistration ───────────────────────────────────────────────────────
/**
 * Register an attendee for an event.
 * @param {string} eventId        - Event identifier
 * @param {object} registrantData - {name, email, ticket_type, dietary_preferences, special_requirements}
 * @returns Registration confirmation with ticket details
 */
export function manageRegistration(eventId, registrantData = {}) {
  if (!eventId) throw new Error("eventId is required");
  if (!registrantData.name)  throw new Error("registrantData.name is required");
  if (!registrantData.email) throw new Error("registrantData.email is required");

  const ticketType = registrantData.ticket_type ?? "general_admission";
  const dietary    = registrantData.dietary_preferences ?? "none";
  const special    = registrantData.special_requirements ?? null;

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO ev_registrations
      (id, event_id, registrant_name, registrant_email, ticket_type, dietary_preferences, special_requirements, fee_usd)
    VALUES (@id, @event_id, @registrant_name, @registrant_email, @ticket_type, @dietary_preferences, @special_requirements, @fee_usd)
  `).run({
    id,
    event_id: eventId,
    registrant_name: registrantData.name,
    registrant_email: registrantData.email,
    ticket_type: ticketType,
    dietary_preferences: dietary,
    special_requirements: special,
    fee_usd: FEES.registration,
  });

  const registrantCount = db.prepare("SELECT COUNT(*) as n FROM ev_registrations WHERE event_id = ?").get(eventId).n;

  return {
    registration_id: id,
    event_id: eventId,
    confirmation: `REG-${id.slice(0, 10).toUpperCase()}`,
    registrant_name: registrantData.name,
    registrant_email: registrantData.email,
    ticket_type: ticketType,
    ticket_number: `TKT-${String(registrantCount).padStart(4, "0")}`,
    dietary_preferences: dietary,
    special_requirements: special,
    status: "confirmed",
    total_registered_for_event: registrantCount,
    fee_usd: FEES.registration,
    registered_at: new Date().toISOString(),
  };
}

// ─── coordinateVendors ────────────────────────────────────────────────────────
/**
 * Coordinate vendors for an event.
 * @param {string} eventId            - Event identifier
 * @param {Array}  vendorRequirements - Array of {service_type, budget, date, location}
 * @returns Matched vendors with quotes and availability
 */
export function coordinateVendors(eventId, vendorRequirements = []) {
  if (!eventId) throw new Error("eventId is required");

  const requirements = vendorRequirements.length > 0 ? vendorRequirements
    : [{ service_type: "catering" }, { service_type: "av" }, { service_type: "decor" }];

  const vendor_matches = requirements.map(req => {
    const serviceType = req.service_type ?? "catering";
    const available = db.prepare(
      "SELECT * FROM ev_vendors WHERE service_type = ? AND available = 1 ORDER BY rating DESC LIMIT 2"
    ).all(serviceType);

    return available.map(v => {
      const priceTierMultiplier = { budget: 0.7, standard: 1.0, premium: 1.5 };
      const baseQuote = (req.budget ?? 1500) * (priceTierMultiplier[v.price_tier] ?? 1.0);
      const quote = Math.round((baseQuote * (0.9 + Math.random() * 0.2)) * 100) / 100;

      return {
        vendor_id: v.id,
        name: v.name,
        service: serviceType,
        location: v.location,
        quote_usd: quote,
        availability: "available",
        rating: v.rating,
        price_tier: v.price_tier,
        specialties: JSON.parse(v.specialties || "[]"),
        estimated_duration_hours: serviceType === "catering" ? 4 : serviceType === "photography" ? 8 : 6,
      };
    });
  }).flat();

  return {
    event_id: eventId,
    vendor_matches,
    total_vendors_found: vendor_matches.length,
    estimated_total_cost: Math.round(vendor_matches.reduce((s, v) => s + v.quote_usd, 0) * 100) / 100,
    coordination_note: "Contact vendors directly to confirm availability for your specific date",
    fee_usd: FEES.coordination,
    coordinated_at: new Date().toISOString(),
  };
}

// ─── getEventDashboard ────────────────────────────────────────────────────────
/**
 * Get an analytics dashboard for a specific event.
 * @param {string} eventId - Event identifier
 * @returns Registrations, forecast, budget status, vendor status, checklist completion
 */
export function getEventDashboard(eventId) {
  if (!eventId) throw new Error("eventId is required");

  const registrations = db.prepare("SELECT COUNT(*) as n FROM ev_registrations WHERE event_id = ?").get(eventId).n;
  const bookings = db.prepare("SELECT * FROM ev_bookings LIMIT 1").all();
  const vendorCount = db.prepare("SELECT COUNT(*) as n FROM ev_vendors WHERE available = 1").get().n;

  const targetAttendees = Math.max(registrations * 1.2, 50);
  const attendance_forecast = {
    registered: registrations,
    expected_attendance: Math.round(registrations * 0.88),
    target: Math.round(targetAttendees),
    fill_rate_pct: Math.round((registrations / targetAttendees) * 100),
  };

  const budget_allocated = 10000;
  const budget_spent = Math.round(budget_allocated * (0.4 + Math.random() * 0.4) * 100) / 100;
  const budget_status = {
    allocated: budget_allocated,
    spent: budget_spent,
    remaining: Math.round((budget_allocated - budget_spent) * 100) / 100,
    utilization_pct: Math.round((budget_spent / budget_allocated) * 100),
  };

  const vendor_status = [
    { service: "catering", status: vendorCount > 0 ? "booked" : "pending", vendor: "Elite Catering Co." },
    { service: "av", status: "booked", vendor: "SoundWave AV" },
    { service: "decor", status: vendorCount > 3 ? "booked" : "searching", vendor: null },
    { service: "photography", status: "pending", vendor: null },
  ];

  const totalChecklist = 8;
  const completedChecklist = Math.floor(2 + Math.random() * 5);
  const checklist_completion_pct = Math.round((completedChecklist / totalChecklist) * 100);

  const risk_flags = [];
  if (registrations < targetAttendees * 0.5) risk_flags.push("Low registration rate — consider targeted outreach");
  if (budget_status.utilization_pct > 85) risk_flags.push("Budget nearly exhausted — review remaining expenses");
  if (vendor_status.filter(v => v.status === "pending").length > 2) risk_flags.push("Multiple vendors not yet secured");

  return {
    event_id: eventId,
    registrations: registrations,
    attendance_forecast,
    budget_status,
    vendor_status,
    checklist_completion_pct,
    completed_tasks: completedChecklist,
    total_tasks: totalChecklist,
    risk_flags,
    days_until_event: Math.floor(14 + Math.random() * 60),
    fee_usd: FEES.dashboard,
    generated_at: new Date().toISOString(),
  };
}
