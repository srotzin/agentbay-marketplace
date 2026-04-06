import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FLIGHT_COMMISSION        = 0.05;  // 5% on flight bookings
const HOTEL_COMMISSION         = 0.08;  // 8% on hotel bookings
const CAR_RENTAL_COMMISSION    = 0.05;  // 5% on car rental bookings
const RESTAURANT_FEE           = 0.50;  // $0.50 per reservation
const ITINERARY_FEE            = 3.00;  // $3 per itinerary
const VISA_LOOKUP_FEE          = 0.50;  // $0.50 per lookup

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS travel_airlines (
    id              TEXT PRIMARY KEY,
    iata_code       TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    alliance        TEXT,
    hub             TEXT,
    base_price_usd  REAL NOT NULL,
    quality_score   REAL DEFAULT 7.5,
    on_time_pct     REAL DEFAULT 82.0
  );

  CREATE TABLE IF NOT EXISTS travel_hotels (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    city                 TEXT NOT NULL,
    country              TEXT NOT NULL,
    star_rating          INTEGER NOT NULL,
    price_per_night_usd  REAL NOT NULL,
    rating               REAL DEFAULT 8.0,
    amenities            TEXT DEFAULT '[]',
    distance_to_center_km REAL DEFAULT 2.0,
    cancellation_policy  TEXT DEFAULT 'free_24h',
    address              TEXT
  );

  CREATE TABLE IF NOT EXISTS travel_restaurants (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    city            TEXT NOT NULL,
    cuisine         TEXT NOT NULL,
    price_range     TEXT NOT NULL CHECK(price_range IN ('$','$$','$$$','$$$$')),
    rating          REAL DEFAULT 4.0,
    michelin_stars  INTEGER DEFAULT 0,
    open_times      TEXT DEFAULT '["12:00","13:00","19:00","20:00","21:00"]',
    max_party_size  INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS travel_visa_requirements (
    id               TEXT PRIMARY KEY,
    nationality      TEXT NOT NULL,
    destination      TEXT NOT NULL,
    visa_required    INTEGER NOT NULL DEFAULT 1,
    visa_type        TEXT,
    processing_days  INTEGER DEFAULT 10,
    documents_needed TEXT DEFAULT '[]',
    estimated_cost_usd REAL DEFAULT 0,
    notes            TEXT,
    UNIQUE(nationality, destination)
  );

  CREATE TABLE IF NOT EXISTS travel_flight_bookings (
    id                  TEXT PRIMARY KEY,
    flight_id           TEXT NOT NULL,
    confirmation_code   TEXT NOT NULL UNIQUE,
    passenger_count     INTEGER NOT NULL,
    cabin_class         TEXT NOT NULL,
    total_cost_usd      REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    payment_method      TEXT,
    status              TEXT DEFAULT 'confirmed',
    cancellation_policy TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS travel_hotel_bookings (
    id                  TEXT PRIMARY KEY,
    hotel_id            TEXT NOT NULL,
    confirmation_number TEXT NOT NULL UNIQUE,
    checkin_date        TEXT NOT NULL,
    checkout_date       TEXT NOT NULL,
    guest_count         INTEGER NOT NULL,
    room_count          INTEGER DEFAULT 1,
    total_cost_usd      REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    payment_method      TEXT,
    status              TEXT DEFAULT 'confirmed',
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Airlines ────────────────────────────────────────────────────────────

const _airlineCount = db.prepare("SELECT COUNT(*) as n FROM travel_airlines").get().n;
if (_airlineCount === 0) {
  const seedAirlines = [
    { id: randomUUID(), iata_code: "AA", name: "American Airlines",       alliance: "Oneworld",    hub: "Dallas/Fort Worth",    base_price_usd: 280, quality_score: 7.2, on_time_pct: 79.1 },
    { id: randomUUID(), iata_code: "DL", name: "Delta Air Lines",         alliance: "SkyTeam",     hub: "Atlanta Hartsfield",   base_price_usd: 310, quality_score: 8.1, on_time_pct: 84.3 },
    { id: randomUUID(), iata_code: "UA", name: "United Airlines",         alliance: "Star Alliance",hub: "Chicago O'Hare",       base_price_usd: 295, quality_score: 7.5, on_time_pct: 80.7 },
    { id: randomUUID(), iata_code: "LH", name: "Lufthansa",               alliance: "Star Alliance",hub: "Frankfurt",            base_price_usd: 620, quality_score: 8.6, on_time_pct: 86.2 },
    { id: randomUUID(), iata_code: "BA", name: "British Airways",         alliance: "Oneworld",    hub: "London Heathrow",      base_price_usd: 590, quality_score: 8.3, on_time_pct: 83.9 },
    { id: randomUUID(), iata_code: "EK", name: "Emirates",                alliance: null,           hub: "Dubai",                base_price_usd: 750, quality_score: 9.2, on_time_pct: 88.4 },
    { id: randomUUID(), iata_code: "SQ", name: "Singapore Airlines",      alliance: "Star Alliance",hub: "Singapore Changi",     base_price_usd: 820, quality_score: 9.6, on_time_pct: 90.1 },
    { id: randomUUID(), iata_code: "QF", name: "Qantas",                  alliance: "Oneworld",    hub: "Sydney",               base_price_usd: 680, quality_score: 8.8, on_time_pct: 85.7 },
    { id: randomUUID(), iata_code: "AF", name: "Air France",              alliance: "SkyTeam",     hub: "Paris CDG",            base_price_usd: 600, quality_score: 8.0, on_time_pct: 81.5 },
    { id: randomUUID(), iata_code: "NH", name: "ANA (All Nippon Airways)",alliance: "Star Alliance",hub: "Tokyo Haneda",         base_price_usd: 790, quality_score: 9.3, on_time_pct: 91.0 },
    { id: randomUUID(), iata_code: "CX", name: "Cathay Pacific",          alliance: "Oneworld",    hub: "Hong Kong",            base_price_usd: 710, quality_score: 8.9, on_time_pct: 87.5 },
    { id: randomUUID(), iata_code: "TK", name: "Turkish Airlines",        alliance: "Star Alliance",hub: "Istanbul",             base_price_usd: 520, quality_score: 8.2, on_time_pct: 80.3 },
    { id: randomUUID(), iata_code: "FR", name: "Ryanair",                 alliance: null,           hub: "Dublin",               base_price_usd:  95, quality_score: 5.8, on_time_pct: 88.0 },
    { id: randomUUID(), iata_code: "WN", name: "Southwest Airlines",      alliance: null,           hub: "Dallas Love Field",    base_price_usd: 155, quality_score: 7.8, on_time_pct: 83.2 },
    { id: randomUUID(), iata_code: "AC", name: "Air Canada",              alliance: "Star Alliance",hub: "Toronto Pearson",      base_price_usd: 340, quality_score: 7.6, on_time_pct: 78.9 },
  ];
  const ins = db.prepare(`INSERT OR IGNORE INTO travel_airlines
    (id, iata_code, name, alliance, hub, base_price_usd, quality_score, on_time_pct)
    VALUES (@id, @iata_code, @name, @alliance, @hub, @base_price_usd, @quality_score, @on_time_pct)`);
  for (const a of seedAirlines) ins.run(a);
}

// ─── Seed Hotels ──────────────────────────────────────────────────────────────

const _hotelCount = db.prepare("SELECT COUNT(*) as n FROM travel_hotels").get().n;
if (_hotelCount === 0) {
  const seedHotels = [
    { id: randomUUID(), name: "The Ritz Paris",                city: "Paris",      country: "France",      star_rating: 5, price_per_night_usd: 1200, rating: 9.6, amenities: '["spa","pool","restaurant","concierge","valet"]',        distance_to_center_km: 0.3, cancellation_policy: "free_48h", address: "15 Place Vendôme, Paris" },
    { id: randomUUID(), name: "Burj Al Arab",                  city: "Dubai",      country: "UAE",         star_rating: 7, price_per_night_usd: 2800, rating: 9.8, amenities: '["helipad","butler","private_beach","pool","spa"]',       distance_to_center_km: 1.2, cancellation_policy: "non_refundable", address: "Jumeirah Beach Rd, Dubai" },
    { id: randomUUID(), name: "The Standard High Line",        city: "New York",   country: "USA",         star_rating: 4, price_per_night_usd:  420, rating: 8.9, amenities: '["rooftop_bar","gym","restaurant","concierge"]',          distance_to_center_km: 3.1, cancellation_policy: "free_24h", address: "848 Washington St, New York" },
    { id: randomUUID(), name: "Hotel Sacher Wien",             city: "Vienna",     country: "Austria",     star_rating: 5, price_per_night_usd:  580, rating: 9.2, amenities: '["spa","restaurant","bar","concierge","valet"]',          distance_to_center_km: 0.2, cancellation_policy: "free_48h", address: "Philharmoniker Str. 4, Vienna" },
    { id: randomUUID(), name: "Aman Tokyo",                    city: "Tokyo",      country: "Japan",       star_rating: 5, price_per_night_usd: 1100, rating: 9.5, amenities: '["spa","pool","dojo","restaurant","butler"]',            distance_to_center_km: 0.5, cancellation_policy: "free_72h", address: "The Otemachi Tower, Tokyo" },
    { id: randomUUID(), name: "Mandarin Oriental Bangkok",     city: "Bangkok",    country: "Thailand",    star_rating: 5, price_per_night_usd:  320, rating: 9.4, amenities: '["river_view","spa","multiple_restaurants","pool"]',      distance_to_center_km: 1.8, cancellation_policy: "free_24h", address: "48 Oriental Ave, Bangkok" },
    { id: randomUUID(), name: "Soho House Berlin",             city: "Berlin",     country: "Germany",     star_rating: 4, price_per_night_usd:  260, rating: 8.7, amenities: '["rooftop_pool","screening_room","gym","bar"]',          distance_to_center_km: 2.0, cancellation_policy: "free_24h", address: "Torstraße 1, Berlin" },
    { id: randomUUID(), name: "One&Only Cape Town",            city: "Cape Town",  country: "South Africa",star_rating: 5, price_per_night_usd:  480, rating: 9.3, amenities: '["spa","marina","pool","multiple_restaurants"]',         distance_to_center_km: 0.6, cancellation_policy: "free_48h", address: "Dock Rd, V&A Waterfront, Cape Town" },
    { id: randomUUID(), name: "Park Hyatt Sydney",             city: "Sydney",     country: "Australia",   star_rating: 5, price_per_night_usd:  510, rating: 9.1, amenities: '["harbour_view","spa","pool","restaurant","concierge"]',  distance_to_center_km: 0.8, cancellation_policy: "free_24h", address: "7 Hickson Rd, The Rocks, Sydney" },
    { id: randomUUID(), name: "Hotel Arts Barcelona",          city: "Barcelona",  country: "Spain",       star_rating: 5, price_per_night_usd:  390, rating: 8.8, amenities: '["beach","pool","spa","restaurant","bar"]',             distance_to_center_km: 4.2, cancellation_policy: "free_48h", address: "Carrer de la Marina 19, Barcelona" },
    { id: randomUUID(), name: "Claridge's",                    city: "London",     country: "UK",          star_rating: 5, price_per_night_usd:  780, rating: 9.4, amenities: '["afternoon_tea","spa","restaurant","bar","concierge"]',  distance_to_center_km: 1.5, cancellation_policy: "free_48h", address: "Brook St, London" },
    { id: randomUUID(), name: "Four Seasons Bali at Sayan",   city: "Ubud",       country: "Indonesia",   star_rating: 5, price_per_night_usd:  650, rating: 9.7, amenities: '["infinity_pool","spa","yoga","jungle_view","butler"]',   distance_to_center_km: 2.5, cancellation_policy: "free_72h", address: "Sayan, Ubud, Bali" },
    { id: randomUUID(), name: "citizenM New York Times Square",city: "New York",   country: "USA",         star_rating: 3, price_per_night_usd:  185, rating: 8.3, amenities: '["rooftop_bar","24h_gym","self_checkin"]',               distance_to_center_km: 2.0, cancellation_policy: "free_24h", address: "218 W 50th St, New York" },
    { id: randomUUID(), name: "The Savoy",                     city: "London",     country: "UK",          star_rating: 5, price_per_night_usd:  860, rating: 9.5, amenities: '["river_view","pool","spa","restaurant","butler"]',      distance_to_center_km: 0.4, cancellation_policy: "free_72h", address: "Strand, London" },
    { id: randomUUID(), name: "Raffles Singapore",             city: "Singapore",  country: "Singapore",   star_rating: 5, price_per_night_usd:  720, rating: 9.3, amenities: '["pool","butler","spa","multiple_restaurants"]',        distance_to_center_km: 1.0, cancellation_policy: "free_48h", address: "1 Beach Rd, Singapore" },
    { id: randomUUID(), name: "Belmond Hotel Cipriani",        city: "Venice",     country: "Italy",       star_rating: 5, price_per_night_usd:  980, rating: 9.6, amenities: '["private_island","pool","spa","gondola","restaurant"]', distance_to_center_km: 0.5, cancellation_policy: "free_72h", address: "Giudecca 10, Venice" },
    { id: randomUUID(), name: "1 Hotel Brooklyn Bridge",       city: "New York",   country: "USA",         star_rating: 4, price_per_night_usd:  345, rating: 8.7, amenities: '["rooftop_pool","spa","restaurant","sustainable"]',     distance_to_center_km: 5.0, cancellation_policy: "free_24h", address: "60 Furman St, Brooklyn, NY" },
    { id: randomUUID(), name: "COMO Uma Paro",                 city: "Paro",       country: "Bhutan",      star_rating: 5, price_per_night_usd:  890, rating: 9.4, amenities: '["himalayan_view","spa","yoga","trekking"]',            distance_to_center_km: 1.5, cancellation_policy: "free_72h", address: "Paro Valley, Bhutan" },
    { id: randomUUID(), name: "Ibis Budapest City",            city: "Budapest",   country: "Hungary",     star_rating: 3, price_per_night_usd:   75, rating: 7.8, amenities: '["bar","24h_reception","gym"]',                        distance_to_center_km: 3.0, cancellation_policy: "free_24h", address: "Asbóth u. 1, Budapest" },
    { id: randomUUID(), name: "Rosewood Hong Kong",            city: "Hong Kong",  country: "China",       star_rating: 5, price_per_night_usd:  640, rating: 9.2, amenities: '["harbour_view","pool","spa","multiple_restaurants"]',  distance_to_center_km: 1.2, cancellation_policy: "free_48h", address: "18 Salisbury Rd, Tsim Sha Tsui" },
  ];
  const insH = db.prepare(`INSERT OR IGNORE INTO travel_hotels
    (id, name, city, country, star_rating, price_per_night_usd, rating, amenities, distance_to_center_km, cancellation_policy, address)
    VALUES (@id, @name, @city, @country, @star_rating, @price_per_night_usd, @rating, @amenities, @distance_to_center_km, @cancellation_policy, @address)`);
  for (const h of seedHotels) insH.run(h);
}

// ─── Seed Restaurants ─────────────────────────────────────────────────────────

const _restCount = db.prepare("SELECT COUNT(*) as n FROM travel_restaurants").get().n;
if (_restCount === 0) {
  const seedRestaurants = [
    { id: randomUUID(), name: "Noma",              city: "Copenhagen", cuisine: "New Nordic",   price_range: "$$$$", rating: 4.9, michelin_stars: 2, open_times: '["18:00","18:30","19:00"]',          max_party_size: 6  },
    { id: randomUUID(), name: "Eleven Madison Park",city: "New York",  cuisine: "Contemporary", price_range: "$$$$", rating: 4.8, michelin_stars: 3, open_times: '["17:30","18:00","21:00","21:30"]',  max_party_size: 8  },
    { id: randomUUID(), name: "Osteria Francescana",city: "Modena",    cuisine: "Italian",      price_range: "$$$$", rating: 4.9, michelin_stars: 3, open_times: '["12:30","20:00","20:30"]',          max_party_size: 6  },
    { id: randomUUID(), name: "Narisawa",           city: "Tokyo",     cuisine: "Japanese",     price_range: "$$$$", rating: 4.8, michelin_stars: 2, open_times: '["12:00","19:00","19:30"]',          max_party_size: 4  },
    { id: randomUUID(), name: "Central",            city: "Lima",      cuisine: "Peruvian",     price_range: "$$$$", rating: 4.8, michelin_stars: 0, open_times: '["12:30","13:00","19:30","20:00"]',  max_party_size: 8  },
    { id: randomUUID(), name: "Le Jules Verne",     city: "Paris",     cuisine: "French",       price_range: "$$$$", rating: 4.6, michelin_stars: 1, open_times: '["12:00","12:30","19:00","19:30"]',  max_party_size: 10 },
    { id: randomUUID(), name: "The Ledbury",        city: "London",    cuisine: "Modern British",price_range:"$$$$", rating: 4.7, michelin_stars: 2, open_times: '["12:30","13:00","19:00","19:30"]',  max_party_size: 8  },
    { id: randomUUID(), name: "Sukiyabashi Jiro",   city: "Tokyo",     cuisine: "Sushi",        price_range: "$$$$", rating: 4.9, michelin_stars: 3, open_times: '["11:30","12:00","17:30","18:00"]',  max_party_size: 2  },
    { id: randomUUID(), name: "Gaggan Anand",       city: "Bangkok",   cuisine: "Progressive Indian",price_range:"$$$$",rating:4.7,michelin_stars:2,open_times:'["18:00","18:30","19:00"]',           max_party_size: 6  },
    { id: randomUUID(), name: "Di Fara Pizza",      city: "New York",  cuisine: "Pizza",        price_range: "$$",  rating: 4.5, michelin_stars: 0, open_times: '["12:00","13:00","17:00","18:00","19:00"]', max_party_size: 8 },
    { id: randomUUID(), name: "Hawker Chan",        city: "Singapore", cuisine: "Hainanese",    price_range: "$",   rating: 4.4, michelin_stars: 1, open_times: '["10:30","12:00","13:00","18:00","19:00"]', max_party_size: 6 },
    { id: randomUUID(), name: "Maison Lameloise",   city: "Chagny",    cuisine: "French",       price_range: "$$$$", rating: 4.7, michelin_stars: 3, open_times: '["12:00","19:30","20:00"]',          max_party_size: 10 },
    { id: randomUUID(), name: "Quintonil",          city: "Mexico City",cuisine: "Mexican",     price_range: "$$$", rating: 4.6, michelin_stars: 0, open_times: '["13:00","14:00","20:00","21:00"]',  max_party_size: 12 },
    { id: randomUUID(), name: "Brae",               city: "Melbourne", cuisine: "Australian",   price_range: "$$$", rating: 4.7, michelin_stars: 0, open_times: '["12:00","19:00","19:30","20:00"]',  max_party_size: 8  },
    { id: randomUUID(), name: "Mirazur",            city: "Menton",    cuisine: "Mediterranean",price_range: "$$$$", rating: 4.9, michelin_stars: 3, open_times: '["12:30","19:30","20:00"]',          max_party_size: 6  },
  ];
  const insR = db.prepare(`INSERT OR IGNORE INTO travel_restaurants
    (id, name, city, cuisine, price_range, rating, michelin_stars, open_times, max_party_size)
    VALUES (@id, @name, @city, @cuisine, @price_range, @rating, @michelin_stars, @open_times, @max_party_size)`);
  for (const r of seedRestaurants) insR.run(r);
}

// ─── Seed Visa Requirements ───────────────────────────────────────────────────

const _visaCount = db.prepare("SELECT COUNT(*) as n FROM travel_visa_requirements").get().n;
if (_visaCount === 0) {
  const seedVisa = [
    { id: randomUUID(), nationality: "US",  destination: "France",      visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "90-day Schengen visa-free access" },
    { id: randomUUID(), nationality: "US",  destination: "Japan",       visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "90-day visa-free" },
    { id: randomUUID(), nationality: "US",  destination: "China",       visa_required: 1, visa_type: "tourist_visa",   processing_days: 4,  documents_needed: '["passport","application_form","photo","itinerary","hotel_booking"]', estimated_cost_usd: 140, notes: "Visa required; 144-hour transit exemption in select cities" },
    { id: randomUUID(), nationality: "US",  destination: "India",       visa_required: 1, visa_type: "e_visa",         processing_days: 3,  documents_needed: '["passport","photo","credit_card"]',                estimated_cost_usd: 25,  notes: "e-Visa available online; 60-day single entry" },
    { id: randomUUID(), nationality: "US",  destination: "Australia",   visa_required: 1, visa_type: "eta",            processing_days: 1,  documents_needed: '["passport"]',                                      estimated_cost_usd: 20,  notes: "Electronic Travel Authority; apply online" },
    { id: randomUUID(), nationality: "US",  destination: "Brazil",      visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "90-day visa-free" },
    { id: randomUUID(), nationality: "UK",  destination: "USA",         visa_required: 1, visa_type: "esta",           processing_days: 1,  documents_needed: '["passport","esta_application"]',                   estimated_cost_usd: 21,  notes: "ESTA required; 90-day entry" },
    { id: randomUUID(), nationality: "UK",  destination: "Australia",   visa_required: 1, visa_type: "eta",            processing_days: 1,  documents_needed: '["passport"]',                                      estimated_cost_usd: 20,  notes: "ETA required; up to 3 months" },
    { id: randomUUID(), nationality: "UK",  destination: "India",       visa_required: 1, visa_type: "e_visa",         processing_days: 3,  documents_needed: '["passport","photo","credit_card"]',                estimated_cost_usd: 25,  notes: "e-Visa available; 60-day single entry" },
    { id: randomUUID(), nationality: "UK",  destination: "Japan",       visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "90-day visa-free" },
    { id: randomUUID(), nationality: "IN",  destination: "USA",         visa_required: 1, visa_type: "b1_b2_visa",     processing_days: 30, documents_needed: '["passport","ds160","bank_statements","employment_letter","photo"]', estimated_cost_usd: 185, notes: "B1/B2 visa; interview required" },
    { id: randomUUID(), nationality: "IN",  destination: "UK",          visa_required: 1, visa_type: "standard_visitor",processing_days:15, documents_needed: '["passport","bank_statements","employment_letter","accommodation_proof"]', estimated_cost_usd: 115, notes: "Standard Visitor visa; up to 6 months" },
    { id: randomUUID(), nationality: "IN",  destination: "UAE",         visa_required: 1, visa_type: "e_visa",         processing_days: 3,  documents_needed: '["passport","photo","return_ticket"]',              estimated_cost_usd: 55,  notes: "30-day e-Visa; renewable once" },
    { id: randomUUID(), nationality: "IN",  destination: "Thailand",    visa_required: 0, visa_type: "visa_on_arrival",processing_days: 0,  documents_needed: '["passport","photo","return_ticket","cash_10000thb"]',estimated_cost_usd: 0, notes: "30-day visa-on-arrival" },
    { id: randomUUID(), nationality: "CN",  destination: "USA",         visa_required: 1, visa_type: "b1_b2_visa",     processing_days: 30, documents_needed: '["passport","ds160","bank_statements","photo"]',    estimated_cost_usd: 185, notes: "B1/B2 visa; interview required" },
    { id: randomUUID(), nationality: "CN",  destination: "UK",          visa_required: 1, visa_type: "standard_visitor",processing_days:15, documents_needed: '["passport","bank_statements","photo","accommodation"]', estimated_cost_usd: 115, notes: "Standard Visitor visa" },
    { id: randomUUID(), nationality: "CN",  destination: "Japan",       visa_required: 1, visa_type: "tourist_visa",   processing_days: 7,  documents_needed: '["passport","application","bank_statements","itinerary"]', estimated_cost_usd: 0, notes: "Free; Japan Embassy processes" },
    { id: randomUUID(), nationality: "CN",  destination: "Thailand",    visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "30-day visa exemption" },
    { id: randomUUID(), nationality: "DE",  destination: "USA",         visa_required: 1, visa_type: "esta",           processing_days: 1,  documents_needed: '["passport","esta_application"]',                   estimated_cost_usd: 21,  notes: "ESTA required; 90-day entry" },
    { id: randomUUID(), nationality: "DE",  destination: "China",       visa_required: 1, visa_type: "tourist_visa",   processing_days: 5,  documents_needed: '["passport","application","photo","hotel_booking"]', estimated_cost_usd: 60,  notes: "L-visa tourist" },
    { id: randomUUID(), nationality: "BR",  destination: "USA",         visa_required: 1, visa_type: "b1_b2_visa",     processing_days: 45, documents_needed: '["passport","ds160","bank_statements","photo"]',    estimated_cost_usd: 185, notes: "B1/B2 visa; interview required" },
    { id: randomUUID(), nationality: "BR",  destination: "UK",          visa_required: 1, visa_type: "standard_visitor",processing_days:15, documents_needed: '["passport","bank_statements","accommodation"]',   estimated_cost_usd: 115, notes: "Standard Visitor visa" },
    { id: randomUUID(), nationality: "AU",  destination: "USA",         visa_required: 1, visa_type: "esta",           processing_days: 1,  documents_needed: '["passport","esta_application"]',                   estimated_cost_usd: 21,  notes: "ESTA required; 90-day entry" },
    { id: randomUUID(), nationality: "ZA",  destination: "UK",          visa_required: 1, visa_type: "standard_visitor",processing_days:15, documents_needed: '["passport","bank_statements","employer_letter","accommodation"]', estimated_cost_usd: 115, notes: "Standard Visitor visa" },
    { id: randomUUID(), nationality: "NG",  destination: "UAE",         visa_required: 1, visa_type: "e_visa",         processing_days: 5,  documents_needed: '["passport","photo","bank_statement","sponsor_letter"]', estimated_cost_usd: 90, notes: "UAE visa required; sponsor may assist" },
    { id: randomUUID(), nationality: "MX",  destination: "USA",         visa_required: 1, visa_type: "b1_b2_visa",     processing_days: 20, documents_needed: '["passport","ds160","bank_statements","ties_to_home"]', estimated_cost_usd: 185, notes: "B1/B2 visa; interview required at US embassy" },
    { id: randomUUID(), nationality: "JP",  destination: "USA",         visa_required: 1, visa_type: "esta",           processing_days: 1,  documents_needed: '["passport","esta_application"]',                   estimated_cost_usd: 21,  notes: "ESTA required; 90-day entry" },
    { id: randomUUID(), nationality: "JP",  destination: "France",      visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport"]',                                estimated_cost_usd: 0,   notes: "90-day Schengen visa-free" },
    { id: randomUUID(), nationality: "CA",  destination: "USA",         visa_required: 0, visa_type: "visa_free",      processing_days: 0,  documents_needed: '["valid_passport_or_nexus"]',                       estimated_cost_usd: 0,   notes: "Passport or NEXUS card; no visa needed" },
    { id: randomUUID(), nationality: "CA",  destination: "Australia",   visa_required: 1, visa_type: "eta",            processing_days: 1,  documents_needed: '["passport"]',                                      estimated_cost_usd: 20,  notes: "ETA required; up to 3 months" },
  ];
  const insV = db.prepare(`INSERT OR IGNORE INTO travel_visa_requirements
    (id, nationality, destination, visa_required, visa_type, processing_days, documents_needed, estimated_cost_usd, notes)
    VALUES (@id, @nationality, @destination, @visa_required, @visa_type, @processing_days, @documents_needed, @estimated_cost_usd, @notes)`);
  for (const v of seedVisa) insV.run(v);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cabinMultiplier(cabinClass) {
  return { economy: 1.0, premium_economy: 1.6, business: 3.8, first: 6.5 }[cabinClass] ?? 1.0;
}

function randomInRange(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function generateConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function daysUntil(dateStr) {
  return Math.max(0, Math.round((new Date(dateStr) - Date.now()) / 86400000));
}

// ─── searchFlights ─────────────────────────────────────────────────────────────

/**
 * Search available flights across carriers.
 * @param {string} origin         - IATA airport code (e.g. "JFK")
 * @param {string} destination    - IATA airport code (e.g. "LHR")
 * @param {string} departDate     - ISO date string "YYYY-MM-DD"
 * @param {string} returnDate     - ISO date for return leg (optional for one-way)
 * @param {number} passengers     - Number of passengers (default 1)
 * @param {string} cabinClass     - economy|premium_economy|business|first
 * @param {boolean} flexibleDates - Include ±3 day alternatives
 * @returns Search results with flights[], pricing, and search metadata
 * Platform fee: free search; 5% commission on booking
 */
export function searchFlights(origin, destination, departDate, returnDate = null, passengers = 1, cabinClass = "economy", flexibleDates = false) {
  if (!origin || !destination) throw new Error("origin and destination are required");
  if (!departDate) throw new Error("departDate is required");
  if (!["economy", "premium_economy", "business", "first"].includes(cabinClass))
    throw new Error("cabinClass must be economy|premium_economy|business|first");

  const airlines = db.prepare("SELECT * FROM travel_airlines ORDER BY quality_score DESC").all();
  const mult = cabinMultiplier(cabinClass);
  const daysOut = daysUntil(departDate);
  const demandFactor = daysOut < 7 ? 1.45 : daysOut < 21 ? 1.15 : daysOut > 90 ? 0.85 : 1.0;

  const flights = airlines.map(a => {
    const baseOne = a.base_price_usd * mult * demandFactor * passengers;
    const price = Math.round(baseOne * (0.88 + Math.random() * 0.28) * 100) / 100;
    const durationH = Math.floor(5 + Math.random() * 12);
    const durationM = Math.floor(Math.random() * 60);
    const stops = a.base_price_usd < 200 ? Math.floor(Math.random() * 2) + 1 : Math.random() > 0.65 ? 1 : 0;
    const depHour = 6 + Math.floor(Math.random() * 16);
    const depMin = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    const arrivalDate = new Date(departDate);
    arrivalDate.setHours(depHour + durationH, depMin + durationM);

    return {
      flight_id: `FL-${a.iata_code}-${randomUUID().slice(0, 8).toUpperCase()}`,
      airline: a.name,
      iata_code: a.iata_code,
      alliance: a.alliance,
      origin,
      destination,
      depart_date: departDate,
      departure_time: `${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}`,
      arrival_time: `${String(arrivalDate.getHours() % 24).padStart(2, "0")}:${String(arrivalDate.getMinutes()).padStart(2, "0")}`,
      duration_hours: durationH,
      duration_minutes: durationM,
      stops,
      cabin_class: cabinClass,
      passengers,
      price_usd: price,
      price_per_person_usd: Math.round(price / passengers * 100) / 100,
      return_date: returnDate,
      carbon_offset_kg: Math.round(durationH * 92 * passengers),
      baggage_included: cabinClass !== "economy" || Math.random() > 0.5,
      refundable: cabinClass === "business" || cabinClass === "first",
      quality_score: a.quality_score,
      on_time_pct: a.on_time_pct,
      booking_fee_note: "Free to search. 5% platform commission applied at booking.",
    };
  });

  flights.sort((a, b) => a.price_usd - b.price_usd);

  const alternatives = flexibleDates ? [-2, -1, 1, 2, 3].map(offset => {
    const alt = new Date(departDate);
    alt.setDate(alt.getDate() + offset);
    const altStr = alt.toISOString().slice(0, 10);
    return { date: altStr, price_change_pct: Math.round((Math.random() * 20 - 10) * 10) / 10 };
  }) : [];

  return {
    search_id: randomUUID(),
    origin,
    destination,
    depart_date: departDate,
    return_date: returnDate,
    passengers,
    cabin_class: cabinClass,
    flights,
    total_results: flights.length,
    cheapest_usd: flights[0]?.price_usd ?? null,
    flexible_date_options: alternatives,
    search_timestamp: new Date().toISOString(),
  };
}

// ─── bookFlight ────────────────────────────────────────────────────────────────

/**
 * Book a flight by flight_id from a searchFlights result.
 * @param {string} flightId     - flight_id from searchFlights
 * @param {Array}  passengers   - Array of {name, dob, passport_number, nationality}
 * @param {string} paymentMethod - credit_card|bank_transfer|crypto|points
 * @returns Booking confirmation with e-ticket, total cost, and cancellation policy
 * Platform fee: 5% commission on total cost
 */
export function bookFlight(flightId, passengers, paymentMethod = "credit_card") {
  if (!flightId) throw new Error("flightId is required");
  if (!Array.isArray(passengers) || passengers.length === 0) throw new Error("passengers must be a non-empty array");

  const parts = flightId.split("-");
  const iataCode = parts[1] ?? "AA";
  const airline = db.prepare("SELECT * FROM travel_airlines WHERE iata_code = ?").get(iataCode);
  if (!airline) throw new Error(`Airline not found for flight: ${flightId}`);

  const pricePerPax = airline.base_price_usd * (1.0 + Math.random() * 0.3);
  const subtotal = Math.round(pricePerPax * passengers.length * 100) / 100;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;
  const totalCost = Math.round((subtotal + taxes) * 100) / 100;
  const commission = Math.round(totalCost * FLIGHT_COMMISSION * 100) / 100;
  const confirmationCode = generateConfirmationCode();
  const bookingId = randomUUID();

  db.prepare(`INSERT OR IGNORE INTO travel_flight_bookings
    (id, flight_id, confirmation_code, passenger_count, cabin_class, total_cost_usd, commission_usd, payment_method, status, cancellation_policy)
    VALUES (@id, @flight_id, @confirmation_code, @passenger_count, @cabin_class, @total_cost_usd, @commission_usd, @payment_method, @status, @cancellation_policy)
  `).run({
    id: bookingId,
    flight_id: flightId,
    confirmation_code: confirmationCode,
    passenger_count: passengers.length,
    cabin_class: "economy",
    total_cost_usd: totalCost,
    commission_usd: commission,
    payment_method: paymentMethod,
    status: "confirmed",
    cancellation_policy: airline.quality_score >= 8.5 ? "free_24h" : "non_refundable",
  });

  return {
    booking_id: bookingId,
    flight_id: flightId,
    confirmation_code: confirmationCode,
    airline: airline.name,
    passenger_count: passengers.length,
    e_ticket: `ET-${confirmationCode}-${bookingId.slice(0, 6).toUpperCase()}`,
    subtotal_usd: subtotal,
    taxes_fees_usd: taxes,
    total_cost_usd: totalCost,
    platform_commission_usd: commission,
    payment_method: paymentMethod,
    cancellation_policy: airline.quality_score >= 8.5 ? "Free cancellation within 24 hours of booking" : "Non-refundable after booking",
    status: "confirmed",
    check_in_opens: "24 hours before departure",
    created_at: new Date().toISOString(),
  };
}

// ─── searchHotels ──────────────────────────────────────────────────────────────

/**
 * Search hotels at a given location.
 * @param {string} location      - City or region name
 * @param {string} checkinDate   - ISO date "YYYY-MM-DD"
 * @param {string} checkoutDate  - ISO date "YYYY-MM-DD"
 * @param {number} guests        - Number of guests
 * @param {number} rooms         - Number of rooms required
 * @param {number} starRating    - Minimum star rating filter (1-7)
 * @param {number} maxPrice      - Maximum price per night in USD
 * @returns Hotels array with pricing, amenities, availability
 * Platform fee: free search; 8% commission on booking
 */
export function searchHotels(location, checkinDate, checkoutDate, guests = 1, rooms = 1, starRating = 0, maxPrice = 99999) {
  if (!location) throw new Error("location is required");
  if (!checkinDate || !checkoutDate) throw new Error("checkinDate and checkoutDate are required");

  const nights = Math.max(1, Math.round((new Date(checkoutDate) - new Date(checkinDate)) / 86400000));

  let query = "SELECT * FROM travel_hotels WHERE 1=1";
  const params = [];
  const locationLower = location.toLowerCase();
  query += " AND (LOWER(city) LIKE ? OR LOWER(country) LIKE ?)";
  params.push(`%${locationLower}%`, `%${locationLower}%`);
  if (starRating > 0) { query += " AND star_rating >= ?"; params.push(starRating); }
  if (maxPrice < 99999) { query += " AND price_per_night_usd <= ?"; params.push(maxPrice); }
  query += " ORDER BY rating DESC";

  let hotels = db.prepare(query).all(...params);

  // Fall back to global sample if location-specific results are empty
  if (hotels.length === 0) {
    hotels = db.prepare("SELECT * FROM travel_hotels ORDER BY rating DESC LIMIT 10").all();
  }

  const results = hotels.map(h => {
    const demandMult = 0.95 + Math.random() * 0.2;
    const nightlyRate = Math.round(h.price_per_night_usd * demandMult * rooms * 100) / 100;
    const totalCost = Math.round(nightlyRate * nights * 100) / 100;
    return {
      hotel_id: h.id,
      name: h.name,
      city: h.city,
      country: h.country,
      address: h.address,
      star_rating: h.star_rating,
      rating: h.rating,
      price_per_night_usd: nightlyRate,
      total_cost_usd: totalCost,
      nights,
      rooms,
      amenities: JSON.parse(h.amenities || "[]"),
      distance_to_center_km: h.distance_to_center_km,
      cancellation_policy: h.cancellation_policy,
      availability: "available",
      booking_fee_note: "Free to search. 8% platform commission applied at booking.",
    };
  });

  return {
    search_id: randomUUID(),
    location,
    checkin_date: checkinDate,
    checkout_date: checkoutDate,
    nights,
    guests,
    rooms,
    hotels: results,
    total_results: results.length,
    cheapest_per_night_usd: results.length ? Math.min(...results.map(h => h.price_per_night_usd)) : null,
    search_timestamp: new Date().toISOString(),
  };
}

// ─── bookHotel ─────────────────────────────────────────────────────────────────

/**
 * Book a hotel by hotel_id from a searchHotels result.
 * @param {string} hotelId      - hotel_id from searchHotels
 * @param {string} checkinDate  - ISO date "YYYY-MM-DD"
 * @param {string} checkoutDate - ISO date "YYYY-MM-DD"
 * @param {number} guests       - Number of guests
 * @param {string} paymentMethod - credit_card|bank_transfer|crypto
 * @returns Booking confirmation with total cost breakdown
 * Platform fee: 8% commission on total cost
 */
export function bookHotel(hotelId, checkinDate, checkoutDate, guests = 1, paymentMethod = "credit_card") {
  if (!hotelId) throw new Error("hotelId is required");
  if (!checkinDate || !checkoutDate) throw new Error("checkinDate and checkoutDate are required");

  const hotel = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(hotelId);
  if (!hotel) throw new Error(`Hotel not found: ${hotelId}`);

  const nights = Math.max(1, Math.round((new Date(checkoutDate) - new Date(checkinDate)) / 86400000));
  const subtotal = Math.round(hotel.price_per_night_usd * nights * 100) / 100;
  const taxes = Math.round(subtotal * 0.14 * 100) / 100;
  const totalCost = Math.round((subtotal + taxes) * 100) / 100;
  const commission = Math.round(totalCost * HOTEL_COMMISSION * 100) / 100;
  const confirmationNumber = `HTL-${generateConfirmationCode()}`;
  const bookingId = randomUUID();

  db.prepare(`INSERT OR IGNORE INTO travel_hotel_bookings
    (id, hotel_id, confirmation_number, checkin_date, checkout_date, guest_count, total_cost_usd, commission_usd, payment_method, status)
    VALUES (@id, @hotel_id, @confirmation_number, @checkin_date, @checkout_date, @guest_count, @total_cost_usd, @commission_usd, @payment_method, @status)
  `).run({
    id: bookingId,
    hotel_id: hotelId,
    confirmation_number: confirmationNumber,
    checkin_date: checkinDate,
    checkout_date: checkoutDate,
    guest_count: guests,
    total_cost_usd: totalCost,
    commission_usd: commission,
    payment_method: paymentMethod,
    status: "confirmed",
  });

  return {
    booking_id: bookingId,
    hotel_name: hotel.name,
    hotel_city: hotel.city,
    confirmation_number: confirmationNumber,
    checkin_date: checkinDate,
    checkout_date: checkoutDate,
    nights,
    guests,
    price_per_night_usd: hotel.price_per_night_usd,
    subtotal_usd: subtotal,
    taxes_fees_usd: taxes,
    total_cost_usd: totalCost,
    platform_commission_usd: commission,
    payment_method: paymentMethod,
    cancellation_policy: hotel.cancellation_policy === "free_24h"
      ? "Free cancellation up to 24 hours before check-in"
      : hotel.cancellation_policy === "free_48h"
      ? "Free cancellation up to 48 hours before check-in"
      : hotel.cancellation_policy === "free_72h"
      ? "Free cancellation up to 72 hours before check-in"
      : "Non-refundable",
    status: "confirmed",
    created_at: new Date().toISOString(),
  };
}

// ─── searchRestaurants ─────────────────────────────────────────────────────────

/**
 * Search restaurants with availability for a given location and party size.
 * @param {string} location   - City or region
 * @param {string} cuisine    - Cuisine type filter (optional)
 * @param {number} partySize  - Number of diners
 * @param {string} dateTime   - ISO datetime for the reservation
 * @param {string} priceRange - $|$$|$$$|$$$$ filter (optional)
 * @returns Restaurants array with available_times for party size
 * Platform fee: $0.50 per confirmed reservation
 */
export function searchRestaurants(location, cuisine = null, partySize = 2, dateTime = null, priceRange = null) {
  if (!location) throw new Error("location is required");

  let query = "SELECT * FROM travel_restaurants WHERE 1=1";
  const params = [];
  query += " AND LOWER(city) LIKE ?";
  params.push(`%${location.toLowerCase()}%`);
  if (cuisine) { query += " AND LOWER(cuisine) LIKE ?"; params.push(`%${cuisine.toLowerCase()}%`); }
  if (priceRange) { query += " AND price_range = ?"; params.push(priceRange); }
  query += " AND max_party_size >= ?";
  params.push(partySize);
  query += " ORDER BY rating DESC";

  let restaurants = db.prepare(query).all(...params);
  if (restaurants.length === 0) {
    restaurants = db.prepare(
      "SELECT * FROM travel_restaurants WHERE max_party_size >= ? ORDER BY rating DESC LIMIT 8"
    ).all(partySize);
  }

  const results = restaurants.map(r => {
    const times = JSON.parse(r.open_times || "[]");
    return {
      restaurant_id: r.id,
      name: r.name,
      city: r.city,
      cuisine: r.cuisine,
      rating: r.rating,
      michelin_stars: r.michelin_stars,
      price_range: r.price_range,
      max_party_size: r.max_party_size,
      available_times: times,
      reservation_fee_usd: RESTAURANT_FEE,
      reservation_fee_note: `$${RESTAURANT_FEE} platform fee per confirmed reservation`,
    };
  });

  return {
    search_id: randomUUID(),
    location,
    cuisine_filter: cuisine,
    party_size: partySize,
    date_time: dateTime,
    price_range_filter: priceRange,
    restaurants: results,
    total_results: results.length,
    search_timestamp: new Date().toISOString(),
  };
}

// ─── buildItinerary ────────────────────────────────────────────────────────────

/**
 * Generate an AI-optimized day-by-day travel itinerary.
 * @param {string} destination  - City or region
 * @param {string} startDate    - ISO date "YYYY-MM-DD"
 * @param {string} endDate      - ISO date "YYYY-MM-DD"
 * @param {number} budget       - Total budget in USD
 * @param {Object} preferences  - { style, interests[], pace, dietary }
 * @returns Itinerary with days[], estimated_costs, and booking_suggestions
 * Platform fee: $3.00 per itinerary
 */
export function buildItinerary(destination, startDate, endDate, budget = 2000, preferences = {}) {
  if (!destination) throw new Error("destination is required");
  if (!startDate || !endDate) throw new Error("startDate and endDate are required");

  const nights = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
  const style = preferences.style ?? "balanced";
  const pace = preferences.pace ?? "moderate";
  const interests = preferences.interests ?? ["culture", "food", "sightseeing"];

  const activitiesByStyle = {
    luxury:    ["Michelin-star dinner", "Private guided tour", "Spa day", "Helicopter tour", "Exclusive tasting"],
    budget:    ["Free walking tour", "Street food tour", "Public museum", "Local market visit", "Scenic hike"],
    adventure: ["Rock climbing", "Paragliding", "White-water rafting", "Mountain bike tour", "Zip-lining"],
    cultural:  ["Museum visit", "Historical site tour", "Local cooking class", "Traditional performance", "Art gallery"],
    balanced:  ["Guided city tour", "Local restaurant lunch", "Museum/gallery", "Neighbourhood walk", "Rooftop bar"],
  };
  const actPool = activitiesByStyle[style] ?? activitiesByStyle.balanced;
  const transportOptions = ["Metro/Public transit", "Taxi/Rideshare", "Rental bike", "Walking", "Private transfer"];

  const days = [];
  let remainingBudget = budget - ITINERARY_FEE;
  const dailyBudget = Math.round(remainingBudget / nights);

  for (let i = 0; i < nights; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayLabel = date.toISOString().slice(0, 10);

    const activities = [
      { time: "09:00", activity: actPool[i % actPool.length],              estimated_cost_usd: Math.round(dailyBudget * 0.15) },
      { time: "12:30", activity: `Lunch in ${destination}`,                estimated_cost_usd: Math.round(dailyBudget * 0.12) },
      { time: "14:30", activity: actPool[(i + 1) % actPool.length],        estimated_cost_usd: Math.round(dailyBudget * 0.18) },
      { time: "19:30", activity: `Dinner – local cuisine in ${destination}`,estimated_cost_usd: Math.round(dailyBudget * 0.20) },
    ];
    const transport = transportOptions[i % transportOptions.length];
    const transportCost = Math.round(dailyBudget * 0.08);
    const dayCost = activities.reduce((s, a) => s + a.estimated_cost_usd, 0) + transportCost;

    days.push({
      day: i + 1,
      date: dayLabel,
      activities,
      transport: { mode: transport, estimated_cost_usd: transportCost },
      accommodation_note: `1 night in ${destination} – see hotel search for options`,
      estimated_day_cost_usd: dayCost,
    });
  }

  const totalActivitiesCost = days.reduce((s, d) => s + d.estimated_day_cost_usd, 0);

  return {
    itinerary_id: randomUUID(),
    destination,
    start_date: startDate,
    end_date: endDate,
    nights,
    style,
    pace,
    interests,
    days,
    estimated_activities_cost_usd: totalActivitiesCost,
    recommended_accommodation_budget_usd: Math.round(budget * 0.4),
    recommended_flights_budget_usd: Math.round(budget * 0.25),
    total_budget_usd: budget,
    platform_fee_usd: ITINERARY_FEE,
    tips: [
      `Book restaurants at least 2 weeks in advance in ${destination}.`,
      "Keep digital copies of all travel documents.",
      "Purchase travel insurance covering medical and trip cancellation.",
    ],
    generated_at: new Date().toISOString(),
  };
}

// ─── getVisaRequirements ───────────────────────────────────────────────────────

/**
 * Look up visa and entry requirements for a nationality/destination pair.
 * @param {string} nationality  - Two-letter country code (e.g. "US", "IN")
 * @param {string} destination  - Country name (e.g. "France", "Japan")
 * @param {string} purpose      - tourism|business|study|work
 * @param {number} duration     - Intended stay in days
 * @returns Visa requirements with documents_needed[], processing_time, costs
 * Platform fee: $0.50 per lookup
 */
export function getVisaRequirements(nationality, destination, purpose = "tourism", duration = 14) {
  if (!nationality || !destination) throw new Error("nationality and destination are required");

  const req = db.prepare(
    "SELECT * FROM travel_visa_requirements WHERE UPPER(nationality)=UPPER(?) AND LOWER(destination)=LOWER(?)"
  ).get(nationality, destination);

  const result = req ? {
    nationality: nationality.toUpperCase(),
    destination,
    purpose,
    intended_duration_days: duration,
    visa_required: req.visa_required === 1,
    visa_type: req.visa_type,
    processing_time_days: req.processing_days,
    documents_needed: JSON.parse(req.documents_needed || "[]"),
    estimated_cost_usd: req.estimated_cost_usd,
    notes: req.notes,
    duration_warning: duration > 90 ? "Intended stay exceeds typical visa-free/tourist visa limits. Long-stay visa may be required." : null,
  } : {
    nationality: nationality.toUpperCase(),
    destination,
    purpose,
    intended_duration_days: duration,
    visa_required: true,
    visa_type: "check_embassy",
    processing_time_days: 14,
    documents_needed: ["valid_passport", "application_form", "proof_of_funds", "travel_itinerary"],
    estimated_cost_usd: 80,
    notes: "Specific requirements not found in database. Contact the destination country embassy or consulate for authoritative requirements.",
    duration_warning: null,
  };

  return {
    ...result,
    lookup_id: randomUUID(),
    platform_fee_usd: VISA_LOOKUP_FEE,
    disclaimer: "Visa requirements change frequently. Always verify with the official embassy or government website before travel.",
    lookup_timestamp: new Date().toISOString(),
  };
}

// ─── compareCarRentals ────────────────────────────────────────────────────────

/**
 * Compare car rental options at a location.
 * @param {string} location    - City or airport code
 * @param {string} pickupDate  - ISO date "YYYY-MM-DD"
 * @param {string} dropoffDate - ISO date "YYYY-MM-DD"
 * @param {string} carType     - economy|compact|midsize|suv|luxury|van
 * @returns Ranked rentals[] with pricing, insurance options, company ratings
 * Platform fee: 5% commission on booking
 */
export function compareCarRentals(location, pickupDate, dropoffDate, carType = "economy") {
  if (!location) throw new Error("location is required");
  if (!pickupDate || !dropoffDate) throw new Error("pickupDate and dropoffDate are required");

  const validTypes = ["economy", "compact", "midsize", "suv", "luxury", "van"];
  if (!validTypes.includes(carType)) throw new Error(`carType must be one of: ${validTypes.join(", ")}`);

  const days = Math.max(1, Math.round((new Date(dropoffDate) - new Date(pickupDate)) / 86400000));

  const companies = [
    { name: "Enterprise",  base: { economy: 45, compact: 55, midsize: 65, suv: 85, luxury: 150, van: 95 }, rating: 8.2, free_miles: "unlimited" },
    { name: "Hertz",       base: { economy: 50, compact: 60, midsize: 72, suv: 92, luxury: 165, van: 105 }, rating: 7.8, free_miles: "unlimited" },
    { name: "Avis",        base: { economy: 48, compact: 58, midsize: 68, suv: 88, luxury: 155, van: 98  }, rating: 7.9, free_miles: "unlimited" },
    { name: "Budget",      base: { economy: 38, compact: 46, midsize: 55, suv: 72, luxury: 130, van: 85  }, rating: 7.2, free_miles: "200/day"   },
    { name: "Sixt",        base: { economy: 42, compact: 52, midsize: 62, suv: 82, luxury: 145, van: 92  }, rating: 8.0, free_miles: "unlimited" },
    { name: "Europcar",    base: { economy: 40, compact: 50, midsize: 60, suv: 78, luxury: 135, van: 88  }, rating: 7.5, free_miles: "unlimited" },
    { name: "Dollar",      base: { economy: 35, compact: 43, midsize: 52, suv: 68, luxury: 120, van: 80  }, rating: 7.0, free_miles: "150/day"   },
    { name: "National",    base: { economy: 46, compact: 56, midsize: 66, suv: 86, luxury: 152, van: 96  }, rating: 8.3, free_miles: "unlimited" },
  ];

  const carModels = {
    economy: ["Toyota Yaris", "VW Polo", "Ford Fiesta"],
    compact: ["Toyota Corolla", "VW Golf", "Honda Civic"],
    midsize: ["Toyota Camry", "VW Passat", "Ford Fusion"],
    suv:     ["Toyota RAV4", "Ford Explorer", "Jeep Grand Cherokee"],
    luxury:  ["Mercedes E-Class", "BMW 5 Series", "Audi A6"],
    van:     ["Mercedes Sprinter", "Ford Transit", "VW Transporter"],
  };

  const insuranceOptions = [
    { type: "basic_cdw",     description: "Collision Damage Waiver – basic", price_per_day: 8 },
    { type: "full_coverage", description: "Full coverage incl. theft + roadside", price_per_day: 22 },
    { type: "premium",       description: "Zero-excess premium protection", price_per_day: 35 },
  ];

  const rentals = companies.map(c => {
    const basePPD = (c.base[carType] ?? 55) * (0.9 + Math.random() * 0.2);
    const pricePerDay = Math.round(basePPD * 100) / 100;
    const subtotal = Math.round(pricePerDay * days * 100) / 100;
    const taxes = Math.round(subtotal * 0.13 * 100) / 100;
    const total = Math.round((subtotal + taxes) * 100) / 100;
    const commission = Math.round(total * CAR_RENTAL_COMMISSION * 100) / 100;
    const models = carModels[carType] ?? carModels.compact;
    const car = models[Math.floor(Math.random() * models.length)];

    return {
      rental_id: `CAR-${c.name.toUpperCase().slice(0, 3)}-${randomUUID().slice(0, 8).toUpperCase()}`,
      company: c.name,
      car_type: carType,
      car_model: car,
      location,
      pickup_date: pickupDate,
      dropoff_date: dropoffDate,
      days,
      price_per_day_usd: pricePerDay,
      subtotal_usd: subtotal,
      taxes_fees_usd: taxes,
      total_usd: total,
      platform_commission_usd: commission,
      free_mileage: c.free_miles,
      company_rating: c.rating,
      insurance_options: insuranceOptions,
      booking_fee_note: "5% platform commission on booking total",
    };
  });

  rentals.sort((a, b) => a.total_usd - b.total_usd);

  return {
    search_id: randomUUID(),
    location,
    pickup_date: pickupDate,
    dropoff_date: dropoffDate,
    days,
    car_type: carType,
    rentals,
    total_results: rentals.length,
    cheapest_total_usd: rentals[0]?.total_usd ?? null,
    search_timestamp: new Date().toISOString(),
  };
}
