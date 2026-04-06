import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const CONSTRUCTION_COMMISSION = 0.18; // 18% platform commission on zoning lookups
const FEES = {
  zoning:        2.00,
  permit:        0.50,
  takeoff:       5.00,
  subcontractor: 3.00,
  drawSchedule: 10.00,
  stats:         0.00,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS con_municipalities (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    state           TEXT NOT NULL,
    county          TEXT,
    permit_url      TEXT,
    gis_url         TEXT,
    avg_permit_days INTEGER DEFAULT 30,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_zoning_districts (
    id              TEXT PRIMARY KEY,
    municipality_id TEXT NOT NULL REFERENCES con_municipalities(id),
    zone_code       TEXT NOT NULL,
    zone_name       TEXT NOT NULL,
    allowed_uses    TEXT DEFAULT '[]',
    restrictions    TEXT DEFAULT '[]',
    setback_front   REAL DEFAULT 25,
    setback_rear    REAL DEFAULT 20,
    setback_side    REAL DEFAULT 5,
    max_height_ft   REAL DEFAULT 35,
    max_lot_coverage REAL DEFAULT 0.40,
    min_lot_size_sqft REAL DEFAULT 6000,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_zoning_lookups (
    id              TEXT PRIMARY KEY,
    address         TEXT NOT NULL,
    municipality_id TEXT,
    zone_code       TEXT,
    zone_name       TEXT,
    allowed_uses    TEXT DEFAULT '[]',
    restrictions    TEXT DEFAULT '[]',
    setbacks        TEXT DEFAULT '{}',
    max_height_ft   REAL,
    max_lot_coverage REAL,
    fee_usd         REAL DEFAULT 2.00,
    commission_usd  REAL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_permits (
    id              TEXT PRIMARY KEY,
    permit_id_external TEXT NOT NULL,
    municipality_id TEXT,
    project_type    TEXT,
    applicant       TEXT,
    status          TEXT NOT NULL CHECK(status IN ('submitted','in_review','approved','denied','inspection_scheduled','closed')),
    submitted_at    TEXT,
    timeline        TEXT DEFAULT '[]',
    next_steps      TEXT DEFAULT '[]',
    inspector_notes TEXT DEFAULT '[]',
    fee_usd         REAL DEFAULT 0.50,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_subcontractors (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    trade           TEXT NOT NULL,
    location        TEXT NOT NULL,
    state           TEXT,
    rating          REAL DEFAULT 4.5,
    reviews         INTEGER DEFAULT 0,
    rate_min_usd    REAL,
    rate_max_usd    REAL,
    rate_unit       TEXT DEFAULT 'hour',
    specialties     TEXT DEFAULT '[]',
    insurance_verified INTEGER DEFAULT 1,
    license_number  TEXT,
    available       INTEGER DEFAULT 1,
    lead_time_days  INTEGER DEFAULT 14,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_draw_schedules (
    id              TEXT PRIMARY KEY,
    project_value   REAL NOT NULL,
    draws           TEXT DEFAULT '[]',
    total_draws     INTEGER,
    fee_usd         REAL DEFAULT 10.00,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS con_takeoffs (
    id              TEXT PRIMARY KEY,
    project_type    TEXT NOT NULL,
    square_footage  REAL NOT NULL,
    materials       TEXT DEFAULT '[]',
    estimated_costs TEXT DEFAULT '{}',
    waste_factor    REAL DEFAULT 0.10,
    fee_usd         REAL DEFAULT 5.00,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Municipalities ───────────────────────────────────────────────────────

const _muniCount = db.prepare("SELECT COUNT(*) as n FROM con_municipalities").get().n;
if (_muniCount === 0) {
  const municipalities = [
    { id: randomUUID(), name: "Austin",         state: "TX", county: "Travis",        permit_url: "https://permitting.austintexas.gov", gis_url: "https://gis.austintexas.gov",       avg_permit_days: 21 },
    { id: randomUUID(), name: "Denver",          state: "CO", county: "Denver",        permit_url: "https://permits.denvergov.org",       gis_url: "https://denvercpd.maps.arcgis.com", avg_permit_days: 28 },
    { id: randomUUID(), name: "Phoenix",         state: "AZ", county: "Maricopa",      permit_url: "https://pdd.phoenix.gov",             gis_url: "https://maps.phoenix.gov",          avg_permit_days: 18 },
    { id: randomUUID(), name: "Nashville",       state: "TN", county: "Davidson",      permit_url: "https://permits.nashville.gov",       gis_url: "https://maps.nashville.gov",        avg_permit_days: 35 },
    { id: randomUUID(), name: "Charlotte",       state: "NC", county: "Mecklenburg",   permit_url: "https://permits.charlottenc.gov",     gis_url: "https://maps.charlottenc.gov",      avg_permit_days: 25 },
    { id: randomUUID(), name: "Portland",        state: "OR", county: "Multnomah",     permit_url: "https://www.portlandmaps.com/permits",gis_url: "https://portlandmaps.com",          avg_permit_days: 45 },
    { id: randomUUID(), name: "Raleigh",         state: "NC", county: "Wake",          permit_url: "https://raleighnc.gov/permits",       gis_url: "https://maps.raleighnc.gov",        avg_permit_days: 22 },
    { id: randomUUID(), name: "Tampa",           state: "FL", county: "Hillsborough",  permit_url: "https://www.tampa.gov/permits",       gis_url: "https://gis.tampagov.net",          avg_permit_days: 20 },
    { id: randomUUID(), name: "Salt Lake City",  state: "UT", county: "Salt Lake",     permit_url: "https://permits.slcgov.com",          gis_url: "https://gis.slcgov.com",            avg_permit_days: 30 },
    { id: randomUUID(), name: "Columbus",        state: "OH", county: "Franklin",      permit_url: "https://permits.columbus.gov",        gis_url: "https://gis.columbus.gov",          avg_permit_days: 27 },
    { id: randomUUID(), name: "Indianapolis",    state: "IN", county: "Marion",        permit_url: "https://www.indy.gov/permits",        gis_url: "https://maps.indy.gov",             avg_permit_days: 24 },
    { id: randomUUID(), name: "Kansas City",     state: "MO", county: "Jackson",       permit_url: "https://kcmo.gov/permits",            gis_url: "https://maps.kcmo.gov",             avg_permit_days: 32 },
    { id: randomUUID(), name: "Las Vegas",       state: "NV", county: "Clark",         permit_url: "https://onlineservices.clarkcountynv.gov", gis_url: "https://gis.clarkcountynv.gov", avg_permit_days: 19 },
    { id: randomUUID(), name: "San Antonio",     state: "TX", county: "Bexar",         permit_url: "https://saonline.sanantonio.gov",     gis_url: "https://gis.sanantonio.gov",        avg_permit_days: 23 },
    { id: randomUUID(), name: "Jacksonville",    state: "FL", county: "Duval",         permit_url: "https://www.coj.net/permits",         gis_url: "https://maps.coj.net",              avg_permit_days: 26 },
  ];
  const insMuni = db.prepare(`
    INSERT OR IGNORE INTO con_municipalities (id, name, state, county, permit_url, gis_url, avg_permit_days)
    VALUES (@id, @name, @state, @county, @permit_url, @gis_url, @avg_permit_days)
  `);
  for (const m of municipalities) insMuni.run(m);

  // Seed zoning districts for each municipality
  const zoningTemplates = [
    { zone_code: "R-1",  zone_name: "Single-Family Residential",   allowed_uses: '["single_family_dwelling","home_occupation","accessory_structures"]', restrictions: '["no_commercial_activity","max_one_dwelling_unit"]', setback_front: 25, setback_rear: 20, setback_side: 5,  max_height_ft: 35, max_lot_coverage: 0.40, min_lot_size_sqft: 6000 },
    { zone_code: "R-2",  zone_name: "Multi-Family Residential",    allowed_uses: '["duplex","triplex","fourplex","apartment_complex","single_family"]',  restrictions: '["max_density_per_acre","parking_requirements"]',   setback_front: 20, setback_rear: 15, setback_side: 5,  max_height_ft: 45, max_lot_coverage: 0.55, min_lot_size_sqft: 8000 },
    { zone_code: "C-1",  zone_name: "Neighborhood Commercial",     allowed_uses: '["retail","restaurant","office","personal_services","bank"]',          restrictions: '["no_drive_through","max_10000_sqft_floor_area"]',  setback_front: 10, setback_rear: 10, setback_side: 0,  max_height_ft: 40, max_lot_coverage: 0.75, min_lot_size_sqft: 3000 },
    { zone_code: "C-2",  zone_name: "General Commercial",          allowed_uses: '["all_retail","auto_sales","hotel","shopping_center","warehouse_retail"]', restrictions: '["landscape_buffer_required","light_pollution_controls"]', setback_front: 15, setback_rear: 15, setback_side: 5, max_height_ft: 60, max_lot_coverage: 0.80, min_lot_size_sqft: 5000 },
    { zone_code: "I-1",  zone_name: "Light Industrial",            allowed_uses: '["manufacturing","warehouse","distribution","research_development","office_park"]', restrictions: '["no_residential","noise_limits","hazmat_restrictions"]', setback_front: 30, setback_rear: 20, setback_side: 10, max_height_ft: 50, max_lot_coverage: 0.60, min_lot_size_sqft: 20000 },
    { zone_code: "MU",   zone_name: "Mixed-Use Urban",             allowed_uses: '["residential_above_retail","office","live_work","restaurant","hotel"]', restrictions: '["ground_floor_commercial_required","affordable_housing_20pct"]', setback_front: 0, setback_rear: 10, setback_side: 0, max_height_ft: 80, max_lot_coverage: 0.90, min_lot_size_sqft: 2000 },
    { zone_code: "AG",   zone_name: "Agricultural",                allowed_uses: '["farming","ranching","single_family_on_5_acres","nursery","agritourism"]', restrictions: '["no_subdivision_under_5_acres","no_industrial"]', setback_front: 50, setback_rear: 50, setback_side: 25, max_height_ft: 35, max_lot_coverage: 0.10, min_lot_size_sqft: 217800 },
  ];

  const munis = db.prepare("SELECT id FROM con_municipalities").all();
  const insZone = db.prepare(`
    INSERT OR IGNORE INTO con_zoning_districts
      (id, municipality_id, zone_code, zone_name, allowed_uses, restrictions,
       setback_front, setback_rear, setback_side, max_height_ft, max_lot_coverage, min_lot_size_sqft)
    VALUES
      (@id, @municipality_id, @zone_code, @zone_name, @allowed_uses, @restrictions,
       @setback_front, @setback_rear, @setback_side, @max_height_ft, @max_lot_coverage, @min_lot_size_sqft)
  `);
  for (const muni of munis) {
    for (const zone of zoningTemplates) {
      insZone.run({ id: randomUUID(), municipality_id: muni.id, ...zone });
    }
  }
}

// ─── Seed Subcontractors ───────────────────────────────────────────────────────

const _subCount = db.prepare("SELECT COUNT(*) as n FROM con_subcontractors").get().n;
if (_subCount === 0) {
  const subs = [
    { id: randomUUID(), name: "Apex Electrical LLC",        trade: "electrical",   location: "Austin, TX",        state: "TX", rating: 4.8, reviews: 312, rate_min_usd: 85,  rate_max_usd: 125, rate_unit: "hour", specialties: '["commercial","residential","solar"]',             insurance_verified: 1, license_number: "TECL-34821", lead_time_days: 10 },
    { id: randomUUID(), name: "BlueLine Plumbing Co.",       trade: "plumbing",     location: "Denver, CO",        state: "CO", rating: 4.7, reviews: 198, rate_min_usd: 95,  rate_max_usd: 140, rate_unit: "hour", specialties: '["commercial","new_construction","remodels"]',     insurance_verified: 1, license_number: "CO-PLB-9912",  lead_time_days: 14 },
    { id: randomUUID(), name: "Summit Steel Fabricators",   trade: "structural",   location: "Phoenix, AZ",       state: "AZ", rating: 4.9, reviews: 87,  rate_min_usd: 12,  rate_max_usd: 18,  rate_unit: "sqft",specialties: '["steel_framing","prefab","seismic_retrofit"]',     insurance_verified: 1, license_number: "AZ-STR-4451",  lead_time_days: 21 },
    { id: randomUUID(), name: "Prestige HVAC Solutions",    trade: "hvac",         location: "Nashville, TN",     state: "TN", rating: 4.6, reviews: 445, rate_min_usd: 80,  rate_max_usd: 120, rate_unit: "hour", specialties: '["commercial_hvac","ductwork","controls"]',        insurance_verified: 1, license_number: "TN-HVAC-7821", lead_time_days: 12 },
    { id: randomUUID(), name: "Carolina Concrete Inc.",     trade: "concrete",     location: "Charlotte, NC",     state: "NC", rating: 4.5, reviews: 267, rate_min_usd: 8,   rate_max_usd: 15,  rate_unit: "sqft",specialties: '["foundations","flatwork","decorative"]',          insurance_verified: 1, license_number: "NC-CON-2234",  lead_time_days: 18 },
    { id: randomUUID(), name: "Pacific Frame & Finish",     trade: "framing",      location: "Portland, OR",      state: "OR", rating: 4.7, reviews: 156, rate_min_usd: 6,   rate_max_usd: 10,  rate_unit: "sqft",specialties: '["wood_framing","timber_frame","green_building"]',  insurance_verified: 1, license_number: "OR-FRM-6643",  lead_time_days: 16 },
    { id: randomUUID(), name: "Triangle Roofing Group",     trade: "roofing",      location: "Raleigh, NC",       state: "NC", rating: 4.8, reviews: 523, rate_min_usd: 5,   rate_max_usd: 12,  rate_unit: "sqft",specialties: '["commercial","residential","metal","solar_ready"]',insurance_verified: 1, license_number: "NC-ROO-8812",  lead_time_days: 8  },
    { id: randomUUID(), name: "Sunshine Drywall LLC",       trade: "drywall",      location: "Tampa, FL",         state: "FL", rating: 4.4, reviews: 189, rate_min_usd: 2,   rate_max_usd: 5,   rate_unit: "sqft",specialties: '["commercial","residential","fire_rated","clean_room"]', insurance_verified: 1, license_number: "FL-DRY-3312", lead_time_days: 7 },
    { id: randomUUID(), name: "Wasatch Masonry Works",      trade: "masonry",      location: "Salt Lake City, UT",state: "UT", rating: 4.9, reviews: 94,  rate_min_usd: 18,  rate_max_usd: 32,  rate_unit: "sqft",specialties: '["brick","stone","restoration","retaining_walls"]',  insurance_verified: 1, license_number: "UT-MAS-1122",  lead_time_days: 20 },
    { id: randomUUID(), name: "Buckeye Painting Pros",      trade: "painting",     location: "Columbus, OH",      state: "OH", rating: 4.5, reviews: 378, rate_min_usd: 3,   rate_max_usd: 7,   rate_unit: "sqft",specialties: '["commercial","industrial_coatings","epoxy_floors"]', insurance_verified: 1, license_number: "OH-PAI-9901", lead_time_days: 5  },
    { id: randomUUID(), name: "Hoosier Tile & Stone",       trade: "tile",         location: "Indianapolis, IN",  state: "IN", rating: 4.6, reviews: 231, rate_min_usd: 10,  rate_max_usd: 22,  rate_unit: "sqft",specialties: '["porcelain","natural_stone","large_format","pool"]',  insurance_verified: 1, license_number: "IN-TIL-5543",  lead_time_days: 10 },
    { id: randomUUID(), name: "Heartland Excavation Co.",   trade: "excavation",   location: "Kansas City, MO",   state: "MO", rating: 4.7, reviews: 143, rate_min_usd: 95,  rate_max_usd: 160, rate_unit: "hour", specialties: '["site_prep","utility_trenching","demolition"]',    insurance_verified: 1, license_number: "MO-EXC-7723",  lead_time_days: 14 },
    { id: randomUUID(), name: "Desert Glass & Glazing",     trade: "glazing",      location: "Las Vegas, NV",     state: "NV", rating: 4.8, reviews: 112, rate_min_usd: 45,  rate_max_usd: 90,  rate_unit: "hour", specialties: '["curtain_wall","storefronts","skylights","mirrors"]',insurance_verified: 1, license_number: "NV-GLA-4421",  lead_time_days: 21 },
    { id: randomUUID(), name: "Lone Star Landscaping",      trade: "landscaping",  location: "San Antonio, TX",   state: "TX", rating: 4.5, reviews: 456, rate_min_usd: 55,  rate_max_usd: 95,  rate_unit: "hour", specialties: '["commercial","irrigation","hardscape","xeriscape"]', insurance_verified: 1, license_number: "TX-LAN-3391", lead_time_days: 6  },
    { id: randomUUID(), name: "First Coast Fire Protection",trade: "fire_sprinkler",location: "Jacksonville, FL", state: "FL", rating: 4.9, reviews: 78,  rate_min_usd: 3,   rate_max_usd: 8,   rate_unit: "sqft",specialties: '["wet_systems","dry_systems","suppression","inspections"]', insurance_verified: 1, license_number: "FL-FPS-6612", lead_time_days: 25 },
    { id: randomUUID(), name: "Rocky Mountain Insulation",  trade: "insulation",   location: "Denver, CO",        state: "CO", rating: 4.6, reviews: 203, rate_min_usd: 1,   rate_max_usd: 4,   rate_unit: "sqft",specialties: '["spray_foam","blown_in","rigid_board","energy_audits"]', insurance_verified: 1, license_number: "CO-INS-2287", lead_time_days: 9 },
    { id: randomUUID(), name: "Sunbelt Mechanical Inc.",    trade: "plumbing",     location: "Phoenix, AZ",       state: "AZ", rating: 4.7, reviews: 334, rate_min_usd: 90,  rate_max_usd: 130, rate_unit: "hour", specialties: '["commercial","medical_gas","fire_suppression"]',   insurance_verified: 1, license_number: "AZ-PLB-8831",  lead_time_days: 11 },
    { id: randomUUID(), name: "Steel City Structural",      trade: "structural",   location: "Indianapolis, IN",  state: "IN", rating: 4.8, reviews: 65,  rate_min_usd: 14,  rate_max_usd: 22,  rate_unit: "sqft",specialties: '["steel_erection","welding","crane_operations"]',    insurance_verified: 1, license_number: "IN-STR-1167",  lead_time_days: 30 },
    { id: randomUUID(), name: "Tidewater Electrical Svcs.", trade: "electrical",   location: "Jacksonville, FL",  state: "FL", rating: 4.5, reviews: 289, rate_min_usd: 80,  rate_max_usd: 115, rate_unit: "hour", specialties: '["industrial","data_centers","generator_install"]',  insurance_verified: 1, license_number: "FL-ECT-9943",  lead_time_days: 13 },
    { id: randomUUID(), name: "Cascade Millwork & Finish",  trade: "millwork",     location: "Portland, OR",      state: "OR", rating: 4.9, reviews: 121, rate_min_usd: 65,  rate_max_usd: 110, rate_unit: "hour", specialties: '["custom_cabinetry","trim","doors","architectural_woodwork"]', insurance_verified: 1, license_number: "OR-MIL-5512", lead_time_days: 28 },
  ];
  const insSub = db.prepare(`
    INSERT OR IGNORE INTO con_subcontractors
      (id, name, trade, location, state, rating, reviews, rate_min_usd, rate_max_usd, rate_unit,
       specialties, insurance_verified, license_number, available, lead_time_days)
    VALUES
      (@id, @name, @trade, @location, @state, @rating, @reviews, @rate_min_usd, @rate_max_usd, @rate_unit,
       @specialties, @insurance_verified, @license_number, 1, @lead_time_days)
  `);
  for (const s of subs) insSub.run(s);
}

// ─── lookupZoning ─────────────────────────────────────────────────────────────

/**
 * Look up zoning classification and allowed uses for an address.
 * @param {string} address       - Street address being researched
 * @param {string} municipality  - City or municipality name
 * @param {string} proposedUse   - Intended use (e.g., "multifamily residential")
 * @returns {{ zone_code, zone_name, allowed_uses, restrictions, setbacks, max_height_ft, max_lot_coverage, fee_usd }}
 */
export function lookupZoning(address, municipality, proposedUse = "") {
  if (!address)      throw new Error("address is required");
  if (!municipality) throw new Error("municipality is required");

  const muni = db.prepare(
    "SELECT * FROM con_municipalities WHERE name LIKE ? LIMIT 1"
  ).get(`%${municipality}%`);

  const muniId = muni?.id ?? null;

  // Pick zone based on proposed use heuristic
  let zonePreference = "R-1";
  const use = proposedUse.toLowerCase();
  if (use.includes("commercial") || use.includes("retail") || use.includes("office")) zonePreference = "C-1";
  else if (use.includes("industrial") || use.includes("warehouse") || use.includes("manufacturing")) zonePreference = "I-1";
  else if (use.includes("mixed") || use.includes("live-work") || use.includes("live work")) zonePreference = "MU";
  else if (use.includes("multi") || use.includes("apartment") || use.includes("duplex")) zonePreference = "R-2";
  else if (use.includes("farm") || use.includes("agri") || use.includes("ranch")) zonePreference = "AG";

  let zone;
  if (muniId) {
    zone = db.prepare(
      "SELECT * FROM con_zoning_districts WHERE municipality_id = ? AND zone_code = ? LIMIT 1"
    ).get(muniId, zonePreference)
      ?? db.prepare("SELECT * FROM con_zoning_districts WHERE municipality_id = ? LIMIT 1").get(muniId);
  }

  // Fallback to generic if no DB match
  if (!zone) {
    zone = {
      zone_code: zonePreference, zone_name: "Residential District",
      allowed_uses: '["single_family_dwelling","home_occupation"]',
      restrictions: '["no_commercial_activity"]',
      setback_front: 25, setback_rear: 20, setback_side: 5,
      max_height_ft: 35, max_lot_coverage: 0.40, min_lot_size_sqft: 6000,
    };
  }

  const allowed_uses   = JSON.parse(zone.allowed_uses  || "[]");
  const restrictions   = JSON.parse(zone.restrictions  || "[]");
  const setbacks = { front_ft: zone.setback_front, rear_ft: zone.setback_rear, side_ft: zone.setback_side };

  const proposedAllowed = proposedUse
    ? allowed_uses.some(u => proposedUse.toLowerCase().includes(u.replace(/_/g, " ")) || u.includes(proposedUse.toLowerCase().replace(/ /g, "_")))
    : null;

  const commission = Math.round(FEES.zoning * CONSTRUCTION_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO con_zoning_lookups
      (id, address, municipality_id, zone_code, zone_name, allowed_uses, restrictions, setbacks,
       max_height_ft, max_lot_coverage, fee_usd, commission_usd)
    VALUES (@id, @address, @municipality_id, @zone_code, @zone_name, @allowed_uses, @restrictions,
       @setbacks, @max_height_ft, @max_lot_coverage, @fee_usd, @commission_usd)
  `).run({
    id:              randomUUID(),
    address,
    municipality_id: muniId,
    zone_code:       zone.zone_code,
    zone_name:       zone.zone_name,
    allowed_uses:    JSON.stringify(allowed_uses),
    restrictions:    JSON.stringify(restrictions),
    setbacks:        JSON.stringify(setbacks),
    max_height_ft:   zone.max_height_ft,
    max_lot_coverage: zone.max_lot_coverage,
    fee_usd:         FEES.zoning,
    commission_usd:  commission,
  });

  return {
    address,
    municipality:        muni?.name ?? municipality,
    state:               muni?.state ?? null,
    zone_code:           zone.zone_code,
    zone_name:           zone.zone_name,
    allowed_uses,
    restrictions,
    setbacks,
    max_height_ft:       zone.max_height_ft,
    max_lot_coverage_pct: Math.round(zone.max_lot_coverage * 100),
    min_lot_size_sqft:   zone.min_lot_size_sqft,
    proposed_use:        proposedUse || null,
    proposed_use_allowed: proposedAllowed,
    permit_portal:       muni?.permit_url ?? null,
    gis_portal:          muni?.gis_url   ?? null,
    fee_usd:             FEES.zoning,
    platform_commission_usd: commission,
  };
}

// ─── trackPermitStatus ────────────────────────────────────────────────────────

const PERMIT_TIMELINES = {
  submitted:             ["Application received", "Completeness review initiated"],
  in_review:             ["Completeness review passed", "Assigned to plan reviewer", "Structural review in progress", "Zoning compliance check pending"],
  approved:              ["All reviews passed", "Permit issued", "Ready for construction start"],
  denied:                ["Review completed", "Deficiencies identified", "Denial notice issued"],
  inspection_scheduled:  ["Permit issued", "Construction underway", "Inspection requested", "Inspector assigned"],
};

/**
 * Track the status of a building permit application.
 * @param {string} permitId      - Permit application number
 * @param {string} municipality  - City or municipality where permit was filed
 * @returns {{ status, timeline, next_steps, inspector_notes, fee_usd }}
 */
export function trackPermitStatus(permitId, municipality) {
  if (!permitId)     throw new Error("permitId is required");
  if (!municipality) throw new Error("municipality is required");

  // Check if we've seen this permit before
  let permit = db.prepare(
    "SELECT * FROM con_permits WHERE permit_id_external = ? LIMIT 1"
  ).get(permitId);

  const muni = db.prepare("SELECT * FROM con_municipalities WHERE name LIKE ? LIMIT 1").get(`%${municipality}%`);

  if (!permit) {
    // Simulate a new permit lookup — assign a realistic status
    const statusOptions = ["submitted", "in_review", "in_review", "approved", "inspection_scheduled", "denied"];
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    const id = randomUUID();

    db.prepare(`
      INSERT OR IGNORE INTO con_permits
        (id, permit_id_external, municipality_id, status, submitted_at, timeline, next_steps, inspector_notes, fee_usd)
      VALUES (@id, @permit_id_external, @municipality_id, @status, @submitted_at, @timeline, @next_steps, @inspector_notes, @fee_usd)
    `).run({
      id,
      permit_id_external: permitId,
      municipality_id:    muni?.id ?? null,
      status,
      submitted_at:       new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
      timeline:           JSON.stringify(PERMIT_TIMELINES[status] ?? []),
      next_steps:         JSON.stringify([]),
      inspector_notes:    JSON.stringify([]),
      fee_usd:            FEES.permit,
    });
    permit = db.prepare("SELECT * FROM con_permits WHERE id = ? LIMIT 1").get(id);
  }

  const status   = permit.status;
  const timeline = JSON.parse(permit.timeline || "[]");

  const nextStepsMap = {
    submitted:            ["Wait for completeness review (typically 5–10 business days)", "Ensure all required documents have been uploaded"],
    in_review:            ["Respond promptly to any reviewer comments or correction notices", `Estimated approval: ${muni?.avg_permit_days ?? 30} days from submission`],
    approved:             ["Pay permit fee at permit office", "Post permit on job site before work begins", "Schedule required inspections through the permit portal"],
    denied:               ["Review denial notice for specific deficiencies", "Resubmit corrected plans within 90 days", "Request pre-submittal meeting with plan reviewer"],
    inspection_scheduled: ["Ensure work is ready for inspection", "Provide safe access to all inspection areas", "Have approved plans on site for inspector reference"],
    closed:               ["No further action required", "Retain permit documents for 3 years"],
  };

  const inspector_notes = status === "inspection_scheduled" ? [
    "Inspector: John Martinez — License #INSP-4421",
    `Scheduled: ${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}`,
    "Items to verify: framing, rough-in electrical, plumbing rough-in",
  ] : JSON.parse(permit.inspector_notes || "[]");

  return {
    permit_id:       permitId,
    municipality:    muni?.name ?? municipality,
    state:           muni?.state ?? null,
    status,
    submitted_at:    permit.submitted_at,
    timeline,
    next_steps:      nextStepsMap[status] ?? [],
    inspector_notes,
    permit_portal:   muni?.permit_url ?? null,
    estimated_completion: muni ? new Date(new Date(permit.submitted_at).getTime() + (muni.avg_permit_days ?? 30) * 86400000).toISOString().slice(0, 10) : null,
    fee_usd:         FEES.permit,
  };
}

// ─── estimateMaterialTakeoff ──────────────────────────────────────────────────

const MATERIAL_RATES = {
  single_family:  { lumber: 5.50, concrete: 3.20, drywall: 1.80, roofing: 4.50, insulation: 1.20, windows_doors: 2.80, flooring: 3.50, electrical: 4.20, plumbing: 3.80, hvac: 6.00, paint: 0.90, exterior: 3.20 },
  multifamily:    { lumber: 4.80, concrete: 4.50, drywall: 1.60, roofing: 3.80, insulation: 1.40, windows_doors: 2.50, flooring: 3.20, electrical: 5.00, plumbing: 4.20, hvac: 5.50, paint: 0.80, exterior: 2.90 },
  commercial:     { lumber: 2.00, concrete: 6.00, steel: 8.50,   roofing: 5.00, insulation: 1.80, windows_doors: 6.00, flooring: 5.50, electrical: 8.00, plumbing: 5.00, hvac: 9.00, paint: 1.20, exterior: 7.00 },
  industrial:     { concrete: 7.50, steel: 12.00, roofing: 4.50, insulation: 2.00, electrical: 10.00, plumbing: 3.50, hvac: 4.00, exterior: 5.00 },
  renovation:     { lumber: 3.50, drywall: 2.00,  roofing: 3.00, insulation: 1.00, windows_doors: 2.00, flooring: 4.00, electrical: 3.50, plumbing: 3.00, hvac: 4.50, paint: 1.50, exterior: 2.00 },
  addition:       { lumber: 5.00, concrete: 3.00, drywall: 1.90, roofing: 4.00, insulation: 1.30, windows_doors: 2.60, flooring: 3.60, electrical: 4.50, plumbing: 4.00, hvac: 5.50, paint: 1.00, exterior: 3.00 },
};

/**
 * Estimate materials and quantities for a construction project.
 * @param {string} projectType    - single_family|multifamily|commercial|industrial|renovation|addition
 * @param {number} squareFootage  - Gross square footage of project
 * @param {object} specifications - { stories, quality_grade, region_factor }
 * @returns {{ materials, quantities, estimated_costs, vendor_options, waste_factor, fee_usd }}
 */
export function estimateMaterialTakeoff(projectType, squareFootage, specifications = {}) {
  if (!projectType)   throw new Error("projectType is required");
  if (!squareFootage) throw new Error("squareFootage is required");

  const sf          = parseFloat(squareFootage);
  const wasteFactor = 0.10 + (specifications.waste_factor ?? 0);
  const regionMult  = specifications.region_factor ?? 1.0;
  const qualityMult = { standard: 1.0, premium: 1.35, luxury: 1.80 }[specifications.quality_grade ?? "standard"] ?? 1.0;

  const rates = MATERIAL_RATES[projectType] ?? MATERIAL_RATES.single_family;
  const materials = [];
  const estimated_costs = {};
  let totalCost = 0;

  for (const [material, rate] of Object.entries(rates)) {
    const baseCost  = rate * sf * (1 + wasteFactor) * regionMult * qualityMult;
    const rounded   = Math.round(baseCost * 100) / 100;
    const unitMap   = { lumber: "board-ft", concrete: "cu-yd", drywall: "sheets", roofing: "squares", insulation: "sq-ft", windows_doors: "units", flooring: "sq-ft", electrical: "rough-in sf", plumbing: "rough-in sf", hvac: "tons", paint: "gallons", exterior: "sq-ft", steel: "lbs" };
    const quantityMultiplier = { lumber: 0.75, concrete: 0.04, drywall: 0.09, roofing: 0.01, insulation: 1.0, windows_doors: 0.003, flooring: 1.05, electrical: 1.0, plumbing: 1.0, hvac: 0.00033, paint: 0.025, exterior: 1.0, steel: 3.0 };

    const qty = Math.round(sf * (quantityMultiplier[material] ?? 1) * 100) / 100;

    materials.push({ material, quantity: qty, unit: unitMap[material] ?? "unit", unit_cost_usd: rate, total_cost_usd: rounded });
    estimated_costs[material] = rounded;
    totalCost += rounded;
  }

  estimated_costs.total = Math.round(totalCost * 100) / 100;
  estimated_costs.per_sqft = Math.round((totalCost / sf) * 100) / 100;

  const vendor_options = [
    { vendor: "Home Depot Pro",   discount_pct: 8,  delivery: "Next day", notes: "Best for residential projects" },
    { vendor: "84 Lumber",        discount_pct: 12, delivery: "2–3 days", notes: "Volume pricing on lumber and panels" },
    { vendor: "Builders FirstSource", discount_pct: 15, delivery: "3–5 days", notes: "Preferred for commercial projects" },
    { vendor: "Ferguson Enterprises", discount_pct: 10, delivery: "2–4 days", notes: "Best for plumbing and HVAC" },
    { vendor: "Graybar Electric", discount_pct: 11, delivery: "1–2 days", notes: "Best for electrical materials" },
  ];

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO con_takeoffs
      (id, project_type, square_footage, materials, estimated_costs, waste_factor, fee_usd)
    VALUES (@id, @project_type, @square_footage, @materials, @estimated_costs, @waste_factor, @fee_usd)
  `).run({
    id,
    project_type:    projectType,
    square_footage:  sf,
    materials:       JSON.stringify(materials),
    estimated_costs: JSON.stringify(estimated_costs),
    waste_factor:    wasteFactor,
    fee_usd:         FEES.takeoff,
  });

  return {
    takeoff_id:      id,
    project_type:    projectType,
    square_footage:  sf,
    quality_grade:   specifications.quality_grade ?? "standard",
    materials,
    estimated_costs,
    vendor_options,
    waste_factor:    wasteFactor,
    region_factor:   regionMult,
    fee_usd:         FEES.takeoff,
  };
}

// ─── matchSubcontractor ───────────────────────────────────────────────────────

/**
 * Find available subcontractors for a given trade.
 * @param {string} tradeNeeded   - Trade type (e.g., "electrical", "plumbing", "roofing")
 * @param {string} location      - City/region
 * @param {string} projectSize   - small|medium|large|mega
 * @param {string} timeline      - Desired start timeline (e.g., "2 weeks", "immediate")
 * @returns {{ matches, total_found, fee_usd }}
 */
export function matchSubcontractor(tradeNeeded, location, projectSize = "medium", timeline = "") {
  if (!tradeNeeded) throw new Error("tradeNeeded is required");
  if (!location)    throw new Error("location is required");

  const normalizedTrade = tradeNeeded.toLowerCase().replace(/\s+/g, "_");
  const state = location.split(",").pop()?.trim() ?? "";

  // Try exact trade match, then partial
  let subs = db.prepare(
    "SELECT * FROM con_subcontractors WHERE trade = ? AND available = 1 ORDER BY rating DESC LIMIT 10"
  ).all(normalizedTrade);

  if (subs.length === 0) {
    subs = db.prepare(
      "SELECT * FROM con_subcontractors WHERE trade LIKE ? AND available = 1 ORDER BY rating DESC LIMIT 10"
    ).all(`%${normalizedTrade.split("_")[0]}%`);
  }

  // Fallback: return all available if no trade match
  if (subs.length === 0) {
    subs = db.prepare(
      "SELECT * FROM con_subcontractors WHERE available = 1 ORDER BY rating DESC LIMIT 10"
    ).all();
  }

  // Score and filter
  const urgentTimeline = timeline.toLowerCase().includes("immediate") || timeline.toLowerCase().includes("1 week");
  const projectMult = { small: 0.8, medium: 1.0, large: 1.2, mega: 1.5 }[projectSize] ?? 1.0;

  const matches = subs.map(s => ({
    subcontractor_id:  s.id,
    name:              s.name,
    trade:             s.trade,
    location:          s.location,
    rating:            s.rating,
    review_count:      s.reviews,
    rate_range:        `$${s.rate_min_usd}–$${s.rate_max_usd} per ${s.rate_unit}`,
    estimated_project_cost_range: `$${Math.round(s.rate_min_usd * 1000 * projectMult).toLocaleString()}–$${Math.round(s.rate_max_usd * 2000 * projectMult).toLocaleString()}`,
    specialties:       JSON.parse(s.specialties || "[]"),
    insurance_verified: s.insurance_verified === 1,
    license_number:    s.license_number,
    availability:      urgentTimeline && s.lead_time_days <= 7 ? "available_immediately" : `available_in_${s.lead_time_days}_days`,
    lead_time_days:    s.lead_time_days,
  }));

  return {
    trade_requested: tradeNeeded,
    location,
    project_size:    projectSize,
    timeline,
    matches,
    total_found:     matches.length,
    fee_usd:         FEES.subcontractor,
  };
}

// ─── generateDrawSchedule ─────────────────────────────────────────────────────

/**
 * Generate a construction draw schedule for lender disbursement.
 * @param {number}   projectValue         - Total project value in USD
 * @param {string[]} milestones           - Construction milestones
 * @param {object}   lenderRequirements   - { num_draws, retainage_pct, inspection_required }
 * @returns {{ draws, amounts, inspection_requirements, lien_waiver_status, fee_usd }}
 */
export function generateDrawSchedule(projectValue, milestones = [], lenderRequirements = {}) {
  if (!projectValue || projectValue <= 0) throw new Error("projectValue must be a positive number");

  const retainage   = lenderRequirements.retainage_pct ?? 10;
  const numDraws    = lenderRequirements.num_draws ?? 5;
  const inspRequired = lenderRequirements.inspection_required !== false;

  const defaultMilestones = [
    "Site preparation & foundation",
    "Framing & rough-in structural",
    "Rough-in MEP (mechanical, electrical, plumbing)",
    "Exterior envelope & weatherproofing",
    "Interior finishes & punch list",
  ];
  const allMilestones = milestones.length > 0 ? milestones : defaultMilestones;
  const adjustedMilestones = allMilestones.slice(0, numDraws);

  // Draw percentage distribution (typical residential/commercial lending)
  const drawPercentages = [0.15, 0.20, 0.25, 0.20, 0.10];
  const retainageRelease = retainage / 100;

  const draws = [];
  let cumulativePct = 0;

  for (let i = 0; i < adjustedMilestones.length; i++) {
    const pct          = drawPercentages[i] ?? (1 - cumulativePct - retainageRelease) / (adjustedMilestones.length - i);
    const grossAmount  = Math.round(projectValue * pct * 100) / 100;
    const retained     = i < adjustedMilestones.length - 1 ? Math.round(grossAmount * (retainage / 100) * 100) / 100 : 0;
    const netAmount    = Math.round((grossAmount - retained) * 100) / 100;
    const schedDate    = new Date(Date.now() + (i + 1) * 30 * 86400000).toISOString().slice(0, 10);

    draws.push({
      draw_number:             i + 1,
      milestone:               adjustedMilestones[i],
      gross_amount_usd:        grossAmount,
      retainage_held_usd:      retained,
      net_disbursement_usd:    netAmount,
      completion_percentage:   Math.round((cumulativePct + pct) * 100),
      scheduled_date:          schedDate,
      inspection_required:     inspRequired,
      lien_waiver_required:    true,
      status:                  i === 0 ? "ready" : "pending",
    });
    cumulativePct += pct;
  }

  // Final retainage release
  const totalRetained = draws.reduce((sum, d) => sum + d.retainage_held_usd, 0);
  if (totalRetained > 0) {
    draws.push({
      draw_number:             draws.length + 1,
      milestone:               "Final completion & retainage release",
      gross_amount_usd:        totalRetained,
      retainage_held_usd:      0,
      net_disbursement_usd:    totalRetained,
      completion_percentage:   100,
      scheduled_date:          new Date(Date.now() + (draws.length + 1) * 30 * 86400000).toISOString().slice(0, 10),
      inspection_required:     true,
      lien_waiver_required:    true,
      status:                  "pending",
    });
  }

  const inspection_requirements = inspRequired ? [
    "Independent third-party inspection required before each draw",
    "Inspection report must be submitted to lender within 5 business days of completion claim",
    "Final inspection requires certificate of occupancy",
  ] : ["Self-certification with photo documentation accepted"];

  const lien_waiver_status = draws.map(d => ({
    draw_number: d.draw_number,
    conditional_lien_waiver: d.status === "ready" ? "obtained" : "pending",
    unconditional_lien_waiver: "pending",
  }));

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO con_draw_schedules
      (id, project_value, draws, total_draws, fee_usd)
    VALUES (@id, @project_value, @draws, @total_draws, @fee_usd)
  `).run({
    id,
    project_value: projectValue,
    draws:         JSON.stringify(draws),
    total_draws:   draws.length,
    fee_usd:       FEES.drawSchedule,
  });

  return {
    schedule_id:             id,
    project_value_usd:       projectValue,
    total_draws:             draws.length,
    retainage_pct:           retainage,
    draws,
    total_net_disbursements: Math.round(draws.reduce((s, d) => s + d.net_disbursement_usd, 0) * 100) / 100,
    total_retainage_held:    Math.round(draws.reduce((s, d) => s + d.retainage_held_usd, 0) * 100) / 100,
    inspection_requirements,
    lien_waiver_status,
    fee_usd:                 FEES.drawSchedule,
  };
}

// ─── getConstructionStats ─────────────────────────────────────────────────────

/**
 * Get platform statistics and construction market data. Free to call.
 * @returns {{ platform_stats, market_data }}
 */
export function getConstructionStats() {
  const muniCount  = db.prepare("SELECT COUNT(*) as n FROM con_municipalities").get().n;
  const subCount   = db.prepare("SELECT COUNT(*) as n FROM con_subcontractors").get().n;
  const subAvail   = db.prepare("SELECT COUNT(*) as n FROM con_subcontractors WHERE available = 1").get().n;
  const zoneCount  = db.prepare("SELECT COUNT(*) as n FROM con_zoning_districts").get().n;
  const lookups    = db.prepare("SELECT COUNT(*) as n FROM con_zoning_lookups").get().n;
  const takeoffs   = db.prepare("SELECT COUNT(*) as n FROM con_takeoffs").get().n;
  const schedules  = db.prepare("SELECT COUNT(*) as n FROM con_draw_schedules").get().n;
  const permits    = db.prepare("SELECT COUNT(*) as n FROM con_permits").get().n;

  const avgPermitDays = db.prepare("SELECT AVG(avg_permit_days) as avg FROM con_municipalities").get().avg;
  const topTrades     = db.prepare("SELECT trade, COUNT(*) as n FROM con_subcontractors GROUP BY trade ORDER BY n DESC LIMIT 5").all();
  const avgRating     = db.prepare("SELECT AVG(rating) as avg FROM con_subcontractors").get().avg;

  return {
    platform_stats: {
      municipalities_covered:   muniCount,
      zoning_districts_indexed: zoneCount,
      subcontractors_in_network: subCount,
      subcontractors_available: subAvail,
      zoning_lookups_performed: lookups,
      material_takeoffs_run:    takeoffs,
      draw_schedules_generated: schedules,
      permits_tracked:          permits,
    },
    market_data: {
      avg_permit_processing_days: Math.round(avgPermitDays * 10) / 10,
      top_trades_by_availability: topTrades,
      avg_subcontractor_rating:   Math.round(avgRating * 100) / 100,
      material_cost_index: {
        lumber_per_1000_bf:    850,
        concrete_per_yard:     165,
        steel_per_ton:        1280,
        copper_wire_per_lb:    4.35,
        drywall_per_sheet:     14.50,
      },
      cost_per_sqft_ranges: {
        single_family_standard:  { low: 120, high: 200 },
        single_family_premium:   { low: 200, high: 350 },
        commercial_tilt_up:      { low: 85,  high: 150 },
        multifamily_wood_frame:  { low: 130, high: 220 },
        industrial_warehouse:    { low: 60,  high: 120 },
      },
    },
    fee_usd: FEES.stats,
    generated_at: new Date().toISOString(),
  };
}
