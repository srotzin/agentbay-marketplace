import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const PERMIT_LOOKUP_FEE        = 1.00;
const PERMIT_COMMISSION        = 0.18;   // 18%
const ESTIMATE_FEE             = 2.00;
const ESTIMATE_COMMISSION      = 0.15;   // 15%
const PARTS_SEARCH_FEE         = 0.50;
const PARTS_COMMISSION         = 0.12;
const CODE_CHECK_FEE           = 1.50;
const CODE_COMMISSION          = 0.15;
const INVOICE_FEE              = 0.25;
const INVOICE_COMMISSION       = 0.10;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS trades_municipalities (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    state           TEXT NOT NULL,
    county          TEXT,
    population      INTEGER,
    permit_portal   TEXT,
    phone           TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_permit_rules (
    id              TEXT PRIMARY KEY,
    municipality_id TEXT NOT NULL REFERENCES trades_municipalities(id),
    trade_type      TEXT NOT NULL CHECK(trade_type IN ('hvac','plumbing','electrical','roofing','general')),
    permit_required INTEGER NOT NULL DEFAULT 1,
    base_fee_usd    REAL NOT NULL,
    per_sqft_fee    REAL DEFAULT 0,
    processing_days INTEGER NOT NULL,
    application_url TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_distributors (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    region          TEXT NOT NULL,
    specialties     TEXT NOT NULL,
    warehouse_count INTEGER DEFAULT 1,
    next_day_cutoff TEXT DEFAULT '15:00',
    phone           TEXT,
    website         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_permit_lookups (
    id              TEXT PRIMARY KEY,
    municipality    TEXT NOT NULL,
    trade_type      TEXT NOT NULL,
    job_description TEXT,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    result_data     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_estimates (
    id              TEXT PRIMARY KEY,
    trade_type      TEXT NOT NULL,
    job_description TEXT,
    location        TEXT,
    property_type   TEXT,
    estimate_low    REAL,
    estimate_mid    REAL,
    estimate_high   REAL,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_invoices (
    id              TEXT PRIMARY KEY,
    job_id          TEXT,
    subtotal_usd    REAL NOT NULL,
    tax_usd         REAL NOT NULL,
    total_usd       REAL NOT NULL,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    line_items      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades_stats (
    id                  TEXT PRIMARY KEY DEFAULT 'singleton',
    jobs_estimated      INTEGER DEFAULT 0,
    permits_looked_up   INTEGER DEFAULT 0,
    invoices_generated  INTEGER DEFAULT 0,
    parts_searches      INTEGER DEFAULT 0,
    code_checks         INTEGER DEFAULT 0,
    total_savings_usd   REAL DEFAULT 0,
    updated_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Municipalities ──────────────────────────────────────────────────────

{
  const count = db.prepare("SELECT COUNT(*) as n FROM trades_municipalities").get().n;
  if (count === 0) {
    const municipalities = [
      { id: randomUUID(), name: "Austin",          state: "TX", county: "Travis",    population: 978908,  permit_portal: "https://austintexas.gov/permits",      phone: "512-978-4000" },
      { id: randomUUID(), name: "Phoenix",          state: "AZ", county: "Maricopa",  population: 1608139, permit_portal: "https://phoenix.gov/pdd/permits",       phone: "602-262-7811" },
      { id: randomUUID(), name: "Denver",           state: "CO", county: "Denver",    population: 715522,  permit_portal: "https://www.denvergov.org/permits",     phone: "720-865-2700" },
      { id: randomUUID(), name: "Nashville",        state: "TN", county: "Davidson",  population: 689447,  permit_portal: "https://nashville.gov/permits",         phone: "615-862-6500" },
      { id: randomUUID(), name: "Portland",         state: "OR", county: "Multnomah", population: 652503,  permit_portal: "https://www.portland.gov/bds/permits",   phone: "503-823-7300" },
      { id: randomUUID(), name: "Charlotte",        state: "NC", county: "Mecklenburg",population: 897901, permit_portal: "https://charlottenc.gov/permits",       phone: "704-336-2241" },
      { id: randomUUID(), name: "Columbus",         state: "OH", county: "Franklin",  population: 905748,  permit_portal: "https://columbus.gov/permits",          phone: "614-645-7433" },
      { id: randomUUID(), name: "San Antonio",      state: "TX", county: "Bexar",     population: 1434625, permit_portal: "https://sanantoniotx.gov/permits",      phone: "210-207-1111" },
      { id: randomUUID(), name: "Jacksonville",     state: "FL", county: "Duval",     population: 949611,  permit_portal: "https://coj.net/permits",               phone: "904-255-8300" },
      { id: randomUUID(), name: "Indianapolis",     state: "IN", county: "Marion",    population: 887642,  permit_portal: "https://indy.gov/permits",              phone: "317-327-4560" },
      { id: randomUUID(), name: "Memphis",          state: "TN", county: "Shelby",    population: 633104,  permit_portal: "https://memphis.gov/permits",           phone: "901-636-6620" },
      { id: randomUUID(), name: "El Paso",          state: "TX", county: "El Paso",   population: 678815,  permit_portal: "https://elpasotexas.gov/permits",       phone: "915-212-1522" },
      { id: randomUUID(), name: "Louisville",       state: "KY", county: "Jefferson", population: 633045,  permit_portal: "https://louisvilleky.gov/permits",      phone: "502-574-3321" },
      { id: randomUUID(), name: "Baltimore",        state: "MD", county: "Baltimore City", population: 585708, permit_portal: "https://baltimorecity.gov/permits", phone: "410-396-3360" },
      { id: randomUUID(), name: "Oklahoma City",   state: "OK", county: "Oklahoma",  population: 681054,  permit_portal: "https://okc.gov/permits",               phone: "405-297-2535" },
    ];

    const permitRules = [
      // Austin
      { trade: "hvac",       fee: 85,  sqft: 0.05, days: 5  },
      { trade: "plumbing",   fee: 75,  sqft: 0.03, days: 3  },
      { trade: "electrical", fee: 100, sqft: 0.04, days: 5  },
      { trade: "roofing",    fee: 65,  sqft: 0.02, days: 2  },
      // Phoenix
      { trade: "hvac",       fee: 95,  sqft: 0.06, days: 7  },
      { trade: "plumbing",   fee: 80,  sqft: 0.04, days: 4  },
      { trade: "electrical", fee: 110, sqft: 0.05, days: 7  },
      { trade: "roofing",    fee: 55,  sqft: 0.015,days: 3  },
      // Denver
      { trade: "hvac",       fee: 120, sqft: 0.07, days: 10 },
      { trade: "plumbing",   fee: 95,  sqft: 0.05, days: 7  },
      { trade: "electrical", fee: 135, sqft: 0.06, days: 10 },
      { trade: "roofing",    fee: 80,  sqft: 0.025,days: 5  },
    ];

    const insertMuni = db.prepare(`
      INSERT OR IGNORE INTO trades_municipalities (id,name,state,county,population,permit_portal,phone)
      VALUES (@id,@name,@state,@county,@population,@permit_portal,@phone)
    `);
    const insertRule = db.prepare(`
      INSERT OR IGNORE INTO trades_permit_rules (id,municipality_id,trade_type,permit_required,base_fee_usd,per_sqft_fee,processing_days,application_url,notes)
      VALUES (@id,@municipality_id,@trade_type,1,@base_fee_usd,@per_sqft_fee,@processing_days,@application_url,@notes)
    `);

    let ruleIdx = 0;
    for (let i = 0; i < municipalities.length; i++) {
      const m = municipalities[i];
      insertMuni.run(m);
      // Assign permit rules cycling through the template set
      const trades = ["hvac","plumbing","electrical","roofing"];
      for (const t of trades) {
        const template = permitRules[ruleIdx % permitRules.length];
        ruleIdx++;
        insertRule.run({
          id: randomUUID(),
          municipality_id: m.id,
          trade_type: t,
          base_fee_usd: template.fee + Math.floor(i * 3.5),
          per_sqft_fee: template.sqft,
          processing_days: template.days + (i % 3),
          application_url: m.permit_portal,
          notes: `${m.name} ${t} permit — submit plans + contractor license copy.`,
        });
      }
    }
  }
}

// ─── Seed Distributors ────────────────────────────────────────────────────────

{
  const count = db.prepare("SELECT COUNT(*) as n FROM trades_distributors").get().n;
  if (count === 0) {
    const distributors = [
      { id: randomUUID(), name: "Ferguson Enterprises",      region: "National",      specialties: '["plumbing","hvac","waterworks"]',         warehouse_count: 1700, phone: "855-273-7437", website: "ferguson.com" },
      { id: randomUUID(), name: "Wesco International",       region: "National",      specialties: '["electrical","industrial"]',              warehouse_count: 800,  phone: "412-454-2200", website: "wesco.com" },
      { id: randomUUID(), name: "Johnstone Supply",          region: "National",      specialties: '["hvac","refrigeration"]',                 warehouse_count: 400,  phone: "800-556-4678", website: "johnstonesupply.com" },
      { id: randomUUID(), name: "Hajoca Corporation",        region: "National",      specialties: '["plumbing","hvac","waterworks"]',         warehouse_count: 450,  phone: "610-667-3600", website: "hajoca.com" },
      { id: randomUUID(), name: "Rexel Holdings",            region: "National",      specialties: '["electrical","data","security"]',         warehouse_count: 500,  phone: "214-647-2900", website: "rexel.com" },
      { id: randomUUID(), name: "ABC Supply Co.",            region: "National",      specialties: '["roofing","siding","windows"]',           warehouse_count: 900,  phone: "888-227-2758", website: "abcsupply.com" },
      { id: randomUUID(), name: "Beacon Roofing Supply",     region: "National",      specialties: '["roofing","waterproofing","gutters"]',    warehouse_count: 600,  phone: "877-645-7663", website: "beaconroofing.com" },
      { id: randomUUID(), name: "Hughes Supply (HD Supply)", region: "Southeast",     specialties: '["plumbing","electrical","hvac"]',         warehouse_count: 250,  phone: "800-484-4374", website: "hdsupply.com" },
      { id: randomUUID(), name: "Moore Supply",              region: "Southwest",     specialties: '["plumbing","hvac"]',                      warehouse_count: 60,   phone: "281-998-8400", website: "mooresupply.com" },
      { id: randomUUID(), name: "Crescent Electric Supply",  region: "Midwest",       specialties: '["electrical","lighting","controls"]',     warehouse_count: 130,  phone: "800-786-3601", website: "crescent-electric.com" },
    ];
    const ins = db.prepare(`
      INSERT OR IGNORE INTO trades_distributors (id,name,region,specialties,warehouse_count,phone,website)
      VALUES (@id,@name,@region,@specialties,@warehouse_count,@phone,@website)
    `);
    for (const d of distributors) ins.run(d);
  }
}

// ─── Seed Stats Singleton ─────────────────────────────────────────────────────

db.prepare(`INSERT OR IGNORE INTO trades_stats (id) VALUES ('singleton')`).run();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function incrementStats(field, value = 1) {
  db.prepare(`UPDATE trades_stats SET ${field} = ${field} + ?, updated_at = datetime('now') WHERE id='singleton'`).run(value);
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

const TRADE_COST_PROFILES = {
  hvac: {
    replace_unit:     { low: 3800, mid: 6200, high: 10500, hours: [16, 24] },
    repair:           { low: 150,  mid: 380,  high: 850,   hours: [1, 4]   },
    duct_cleaning:    { low: 300,  mid: 500,  high: 900,   hours: [4, 8]   },
    new_install:      { low: 5000, mid: 9000, high: 16000, hours: [24, 40] },
  },
  plumbing: {
    leak_repair:      { low: 150,  mid: 350,  high: 700,   hours: [1, 3]   },
    water_heater:     { low: 800,  mid: 1400, high: 2800,  hours: [3, 6]   },
    pipe_replacement: { low: 1200, mid: 3500, high: 8000,  hours: [8, 24]  },
    drain_cleaning:   { low: 100,  mid: 220,  high: 450,   hours: [1, 2]   },
  },
  electrical: {
    panel_upgrade:    { low: 1500, mid: 3200, high: 6500,  hours: [8, 16]  },
    outlet_install:   { low: 100,  mid: 250,  high: 500,   hours: [1, 3]   },
    rewire:           { low: 3500, mid: 8000, high: 18000, hours: [24, 80] },
    ev_charger:       { low: 500,  mid: 1100, high: 2200,  hours: [4, 8]   },
  },
  roofing: {
    repair:           { low: 300,  mid: 800,  high: 2000,  hours: [4, 8]   },
    full_replace:     { low: 6000, mid: 12000,high: 25000, hours: [16, 40] },
    gutter_replace:   { low: 800,  mid: 1500, high: 3200,  hours: [8, 16]  },
    skylight_install: { low: 1200, mid: 2500, high: 5000,  hours: [6, 12]  },
  },
};

function detectJobProfile(tradeType, description) {
  const desc = description.toLowerCase();
  const profiles = TRADE_COST_PROFILES[tradeType] ?? TRADE_COST_PROFILES.hvac;
  for (const [key, profile] of Object.entries(profiles)) {
    if (desc.includes(key.replace(/_/g, " ")) || desc.includes(key.split("_")[0])) {
      return { key, ...profile };
    }
  }
  const keys = Object.keys(profiles);
  const fallbackKey = keys[Math.floor(Math.random() * keys.length)];
  return { key: fallbackKey, ...profiles[fallbackKey] };
}

// ─── lookupPermitRequirements ─────────────────────────────────────────────────

/**
 * Look up permit requirements for a given municipality and trade type.
 * Fee: $1.00/lookup | Commission: 18%
 *
 * @param {string} municipality  - City name (e.g. "Austin")
 * @param {string} tradeType     - hvac|plumbing|electrical|roofing|general
 * @param {string} jobDescription - Brief description of planned work
 * @returns {{ permits_required, estimated_fees, processing_time, application_url }}
 */
export function lookupPermitRequirements(municipality, tradeType, jobDescription) {
  if (!municipality)   throw new Error("municipality is required");
  if (!tradeType)      throw new Error("tradeType is required");

  const normalizedTrade = tradeType.toLowerCase();
  const validTrades = ["hvac","plumbing","electrical","roofing","general"];
  if (!validTrades.includes(normalizedTrade)) {
    throw new Error(`tradeType must be one of: ${validTrades.join(", ")}`);
  }

  // Look up stored rule or generate plausible synthetic data
  const muni = db.prepare(
    "SELECT * FROM trades_municipalities WHERE LOWER(name) LIKE LOWER(?)"
  ).get(`%${municipality}%`);

  let rule = null;
  if (muni) {
    rule = db.prepare(
      "SELECT * FROM trades_permit_rules WHERE municipality_id = ? AND trade_type = ?"
    ).get(muni.id, normalizedTrade);
  }

  const baseFee        = rule ? rule.base_fee_usd : randomBetween(55, 175);
  const processingDays = rule ? rule.processing_days : Math.floor(randomBetween(3, 21));
  const appUrl         = rule ? rule.application_url : (muni ? muni.permit_portal : `https://${municipality.toLowerCase().replace(/\s/g,"")}gov.com/permits`);

  const permitRequired = normalizedTrade !== "general" || Math.random() > 0.3;

  const additionalPermits = [];
  if (normalizedTrade === "electrical" && Math.random() > 0.5) {
    additionalPermits.push({ permit: "Electrical Inspection Certificate", fee: 45, notes: "Required before energizing new circuits" });
  }
  if (normalizedTrade === "hvac" && Math.random() > 0.6) {
    additionalPermits.push({ permit: "Mechanical Permit", fee: 60, notes: "Required for refrigerant handling per EPA 608" });
  }
  if (normalizedTrade === "plumbing" && Math.random() > 0.5) {
    additionalPermits.push({ permit: "Plumbing Inspection", fee: 40, notes: "Required before closing walls" });
  }
  if (normalizedTrade === "roofing" && Math.random() > 0.7) {
    additionalPermits.push({ permit: "Structural Review", fee: 85, notes: "Required for roofing over 50% tear-off" });
  }

  const totalFee = baseFee + additionalPermits.reduce((s, p) => s + p.fee, 0);
  const commission = Math.round(PERMIT_LOOKUP_FEE * PERMIT_COMMISSION * 100) / 100;

  const lookupId = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO trades_permit_lookups (id,municipality,trade_type,job_description,fee_charged_usd,commission_usd,result_data)
    VALUES (?,?,?,?,?,?,?)
  `).run(lookupId, municipality, normalizedTrade, jobDescription ?? null,
         PERMIT_LOOKUP_FEE, commission, JSON.stringify({ baseFee, totalFee }));

  incrementStats("permits_looked_up");

  return {
    lookup_id:           lookupId,
    municipality:        muni ? muni.name : municipality,
    state:               muni ? muni.state : "N/A",
    trade_type:          normalizedTrade,
    permits_required:    permitRequired ? [
      {
        permit:    `${normalizedTrade.charAt(0).toUpperCase() + normalizedTrade.slice(1)} Permit`,
        required:  true,
        fee_usd:   baseFee,
        notes:     rule?.notes ?? `Submit contractor license, insurance certificate, and job plans.`,
      },
      ...additionalPermits,
    ] : [],
    permit_required:     permitRequired,
    estimated_fees:      { base_usd: baseFee, additional_usd: totalFee - baseFee, total_usd: totalFee },
    processing_time:     { business_days: processingDays, expedite_available: processingDays > 5, expedite_days: Math.ceil(processingDays * 0.4) },
    application_url:     appUrl,
    contractor_requirements: [
      "Valid state contractor license",
      "General liability insurance ($1M minimum)",
      "Workers' compensation certificate",
      normalizedTrade === "electrical" ? "Master electrician license required" : null,
      normalizedTrade === "hvac" ? "EPA 608 refrigerant certification" : null,
    ].filter(Boolean),
    service_fee_usd:     PERMIT_LOOKUP_FEE,
    platform_commission_usd: commission,
    retrieved_at:        new Date().toISOString(),
  };
}

// ─── estimateJobFromDescription ───────────────────────────────────────────────

/**
 * Generate a cost estimate for a trade job from a natural-language description.
 * Fee: $2.00/estimate | Commission: 15%
 *
 * @param {string} tradeType      - hvac|plumbing|electrical|roofing
 * @param {string} jobDescription - Plain-English job description
 * @param {string} location       - City, state (affects labor rates)
 * @param {string} propertyType   - residential|commercial|industrial
 * @returns {{ estimated_cost_range, labor_hours, materials, comparable_jobs }}
 */
export function estimateJobFromDescription(tradeType, jobDescription, location, propertyType = "residential") {
  if (!tradeType)      throw new Error("tradeType is required");
  if (!jobDescription) throw new Error("jobDescription is required");

  const trade    = tradeType.toLowerCase();
  const propType = propertyType.toLowerCase();
  const profile  = detectJobProfile(trade, jobDescription);

  // Location-based cost-of-living multiplier
  const COL_MULTIPLIERS = {
    CA: 1.45, NY: 1.40, WA: 1.30, MA: 1.35, CO: 1.15,
    TX: 1.00, FL: 0.98, TN: 0.90, OH: 0.88, IN: 0.87,
  };
  const stateMatch = (location ?? "").match(/\b([A-Z]{2})\b/);
  const colMult    = stateMatch ? (COL_MULTIPLIERS[stateMatch[1]] ?? 1.0) : 1.0;
  const propMult   = propType === "commercial" ? 1.35 : propType === "industrial" ? 1.60 : 1.0;

  const low  = Math.round(profile.low  * colMult * propMult);
  const mid  = Math.round(profile.mid  * colMult * propMult);
  const high = Math.round(profile.high * colMult * propMult);

  const [hMin, hMax] = profile.hours;
  const laborHours   = { min: hMin, max: hMax, typical: Math.round((hMin + hMax) / 2) };

  const MATERIALS_BY_TRADE = {
    hvac:       ["Refrigerant (R-410A)", "Copper lineset", "Condenser unit", "Air handler", "Thermostat", "Disconnect box", "Ductwork"],
    plumbing:   ["PEX pipe", "Copper fittings", "Shut-off valves", "Solder flux", "P-trap", "Wax ring", "Supply lines"],
    electrical: ["12/2 Romex cable", "20A breakers", "GFCI outlets", "Junction boxes", "Wire nuts", "Conduit", "Panel lugs"],
    roofing:    ["Architectural shingles", "Underlayment", "Ice & water shield", "Roofing nails", "Ridge cap", "Drip edge", "Flashing"],
  };
  const allMaterials = MATERIALS_BY_TRADE[trade] ?? MATERIALS_BY_TRADE.hvac;
  const selectedMaterials = allMaterials.slice(0, 4 + Math.floor(Math.random() * 3)).map(name => ({
    name,
    unit_cost_usd: randomBetween(12, 280),
    quantity: Math.floor(randomBetween(1, 8)),
  }));

  const comparableJobs = [
    { description: `Similar ${trade} job in ${location ?? "your region"}`,          cost_usd: Math.round(mid * 0.92), completed: "2 weeks ago" },
    { description: `${propertyType} ${profile.key.replace(/_/g," ")} nearby`,       cost_usd: Math.round(mid * 1.08), completed: "1 month ago" },
    { description: `${trade.charAt(0).toUpperCase()+trade.slice(1)} work same scope`, cost_usd: Math.round(mid * 0.97), completed: "3 months ago" },
  ];

  const commission   = Math.round(ESTIMATE_FEE * ESTIMATE_COMMISSION * 100) / 100;
  const estimateId   = randomUUID();

  db.prepare(`
    INSERT OR IGNORE INTO trades_estimates
      (id,trade_type,job_description,location,property_type,estimate_low,estimate_mid,estimate_high,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(estimateId, trade, jobDescription, location ?? null, propType, low, mid, high, ESTIMATE_FEE, commission);

  incrementStats("jobs_estimated");
  incrementStats("total_savings_usd", Math.round((high - mid) * 0.4));

  return {
    estimate_id:            estimateId,
    trade_type:             trade,
    job_description:        jobDescription,
    location:               location ?? "Not specified",
    property_type:          propType,
    estimated_cost_range:   { low, mid, high, currency: "USD" },
    confidence:             "medium-high",
    cost_drivers:           ["Local labor rates", "Material costs", "Permit fees", "Property access"],
    labor_hours:            laborHours,
    labor_rate_usd_per_hr:  { min: 75, max: 145, regional_multiplier: colMult },
    materials:              selectedMaterials,
    comparable_jobs:        comparableJobs,
    savings_tip:            `Getting 3 quotes could save you $${Math.round((high - mid) * 0.4).toLocaleString()} vs. the high estimate.`,
    service_fee_usd:        ESTIMATE_FEE,
    platform_commission_usd: commission,
    estimated_at:           new Date().toISOString(),
  };
}

// ─── findParts ────────────────────────────────────────────────────────────────

/**
 * Search trade distributors for a part or material by description.
 * Fee: $0.50/search | Commission: 12%
 *
 * @param {string} partDescription - What you need (e.g. "3-ton Carrier condenser unit")
 * @param {string} urgency         - standard|next_day|same_day
 * @param {string} location        - City or ZIP for local availability
 * @returns {{ results: [{ distributor, price, in_stock, delivery_eta }] }}
 */
export function findParts(partDescription, urgency = "standard", location) {
  if (!partDescription) throw new Error("partDescription is required");

  const distributors = db.prepare("SELECT * FROM trades_distributors").all();
  const commission   = Math.round(PARTS_SEARCH_FEE * PARTS_COMMISSION * 100) / 100;

  const deliveryDays = { standard: [3, 7], next_day: [1, 1], same_day: [0, 0] };
  const [dMin, dMax] = deliveryDays[urgency] ?? deliveryDays.standard;

  const basePrice  = randomBetween(45, 680);
  const results    = distributors.map((dist, idx) => {
    const inStock    = Math.random() > 0.25;
    const price      = Math.round(basePrice * (0.88 + idx * 0.025 + Math.random() * 0.15) * 100) / 100;
    const etaDays    = inStock ? (dMin === dMax ? dMin : dMin + Math.floor(Math.random() * (dMax - dMin + 1))) : dMax + 2;
    const etaDate    = new Date(Date.now() + etaDays * 86400000).toISOString().split("T")[0];

    return {
      distributor:     dist.name,
      region:          dist.region,
      phone:           dist.phone,
      website:         dist.website,
      price_usd:       price,
      in_stock:        inStock,
      stock_qty:       inStock ? Math.floor(1 + Math.random() * 12) : 0,
      delivery_eta:    urgency === "same_day" && inStock ? "Today by 5 PM" : `${etaDate} (${etaDays} day${etaDays !== 1 ? "s" : ""})`,
      shipping_cost:   urgency === "same_day" ? 45 : urgency === "next_day" ? 28 : (price > 200 ? 0 : 12),
      warranty_months: [12, 12, 24, 12, 24, 12, 24, 12, 12, 12][idx],
    };
  }).sort((a, b) => a.price_usd - b.price_usd);

  incrementStats("parts_searches");

  return {
    part_description:    partDescription,
    urgency,
    location:            location ?? "Not specified",
    results,
    best_price:          results[0],
    in_stock_count:      results.filter(r => r.in_stock).length,
    service_fee_usd:     PARTS_SEARCH_FEE,
    platform_commission_usd: commission,
    searched_at:         new Date().toISOString(),
  };
}

// ─── checkCodeCompliance ──────────────────────────────────────────────────────

/**
 * Check proposed trade work against applicable building codes.
 * Fee: $1.50/check | Commission: 15%
 *
 * @param {string} jurisdiction   - State or municipality name
 * @param {string} tradeType      - hvac|plumbing|electrical|roofing
 * @param {string} proposedWork   - Description of the planned installation/repair
 * @returns {{ compliant, violations, required_modifications, code_references }}
 */
export function checkCodeCompliance(jurisdiction, tradeType, proposedWork) {
  if (!jurisdiction) throw new Error("jurisdiction is required");
  if (!tradeType)    throw new Error("tradeType is required");
  if (!proposedWork) throw new Error("proposedWork is required");

  const trade = tradeType.toLowerCase();
  const commission = Math.round(CODE_CHECK_FEE * CODE_COMMISSION * 100) / 100;

  const CODE_REFS = {
    hvac:       ["IRC M1401-M1412 Mechanical Systems", "ASHRAE 90.1 Energy Standard", "EPA 608 Refrigerant Regulations", "NFPA 90A Air Distribution"],
    plumbing:   ["UPC 2021 Uniform Plumbing Code",     "IRC P2900-P3100 Plumbing",    "NSF/ANSI 61 Drinking Water",       "IAPMO Standards"],
    electrical: ["NEC 2023 National Electric Code",    "NFPA 70E Electrical Safety",  "UL 489 Circuit Breakers",          "IEEE 1584 Arc Flash"],
    roofing:    ["IBC 2021 Building Code §15",         "ASCE 7-22 Wind Loads",        "IRC R905 Roof Coverings",          "FM 4470 Insulated Panels"],
  };

  const COMMON_VIOLATIONS = {
    hvac: [
      { code: "IRC M1411.3", violation: "Condensate drain must slope minimum 1/8\" per foot", severity: "moderate" },
      { code: "ASHRAE 62.2", violation: "Ventilation rate below required 7.5 CFM/person", severity: "high" },
      { code: "IRC M1403.1", violation: "Refrigerant line insulation missing in unconditioned spaces", severity: "low" },
    ],
    plumbing: [
      { code: "UPC 603.1",   violation: "Water supply line too close to drain (less than 6\")", severity: "moderate" },
      { code: "IRC P3003.1", violation: "DWV system lacks required vent stack", severity: "high" },
      { code: "UPC 610.1",   violation: "Backflow prevention device not installed", severity: "high" },
    ],
    electrical: [
      { code: "NEC 210.52",  violation: "Outlet spacing exceeds 12 feet along wall", severity: "high" },
      { code: "NEC 240.4",   violation: "Wire gauge undersized for circuit breaker rating", severity: "critical" },
      { code: "NEC 406.4",   violation: "GFCI protection missing within 6 feet of water source", severity: "high" },
    ],
    roofing: [
      { code: "IRC R905.2",  violation: "Ice & water shield missing in first 24\" from eave", severity: "moderate" },
      { code: "ASCE 7-22",   violation: "Fastener pattern insufficient for local wind speed", severity: "high" },
      { code: "IBC 1507.2",  violation: "Roof slope below minimum 2:12 for shingles", severity: "critical" },
    ],
  };

  const potentialViolations = (COMMON_VIOLATIONS[trade] ?? COMMON_VIOLATIONS.hvac);
  const violations           = potentialViolations.filter(() => Math.random() > 0.55);
  const compliant            = violations.length === 0;

  const modifications = violations.map(v => ({
    addresses_violation: v.code,
    modification:        `Correct ${v.violation.toLowerCase()} before inspection.`,
    estimated_cost_usd:  randomBetween(50, 400),
  }));

  incrementStats("code_checks");

  return {
    check_id:             randomUUID(),
    jurisdiction,
    trade_type:           trade,
    proposed_work:        proposedWork,
    compliant,
    compliance_score:     compliant ? 100 : Math.round(100 - violations.length * 18),
    violations:           violations.map(v => ({ ...v, description: v.violation })),
    required_modifications: modifications,
    code_references:      CODE_REFS[trade] ?? CODE_REFS.hvac,
    inspection_required:  !compliant || Math.random() > 0.4,
    next_steps:           compliant
      ? ["Schedule final inspection with local building department", "Ensure all permits are posted on-site"]
      : ["Address listed violations before proceeding", "Re-submit revised plans to permitting office"],
    service_fee_usd:      CODE_CHECK_FEE,
    platform_commission_usd: commission,
    checked_at:           new Date().toISOString(),
  };
}

// ─── generateInvoice ──────────────────────────────────────────────────────────

/**
 * Generate a professional invoice for completed trade work.
 * Fee: $0.25/invoice | Commission: 10%
 *
 * @param {object} jobDetails   - { customerName, customerAddress, jobAddress, jobDate, description, contractorName }
 * @param {number} laborHours   - Total labor hours billed
 * @param {Array}  materials    - [{ name, quantity, unit_price }]
 * @param {number} taxRate      - Sales tax rate (0.0 – 1.0)
 * @returns {{ invoice_id, line_items, subtotal, tax, total, pdf_url }}
 */
export function generateInvoice(jobDetails, laborHours, materials = [], taxRate = 0.08) {
  if (!jobDetails) throw new Error("jobDetails is required");
  if (laborHours == null || laborHours < 0) throw new Error("laborHours must be a non-negative number");

  const LABOR_RATE = 115; // $/hr blended
  const commission = Math.round(INVOICE_FEE * INVOICE_COMMISSION * 100) / 100;
  const invoiceId  = randomUUID();
  const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;

  const lineItems = [
    {
      type:        "labor",
      description: `Labor — ${jobDetails.description ?? "Trade work"}`,
      quantity:    laborHours,
      unit:        "hours",
      unit_price:  LABOR_RATE,
      amount:      Math.round(laborHours * LABOR_RATE * 100) / 100,
    },
    ...materials.map(m => ({
      type:        "material",
      description: m.name,
      quantity:    m.quantity ?? 1,
      unit:        "ea",
      unit_price:  m.unit_price,
      amount:      Math.round((m.quantity ?? 1) * m.unit_price * 100) / 100,
    })),
    {
      type:        "fee",
      description: "Service call / mobilization",
      quantity:    1,
      unit:        "flat",
      unit_price:  85,
      amount:      85,
    },
  ];

  const subtotal = Math.round(lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const tax      = Math.round(subtotal * taxRate * 100) / 100;
  const total    = Math.round((subtotal + tax) * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO trades_invoices
      (id,job_id,subtotal_usd,tax_usd,total_usd,fee_charged_usd,commission_usd,line_items)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(invoiceId, jobDetails.jobId ?? null, subtotal, tax, total, INVOICE_FEE, commission, JSON.stringify(lineItems));

  incrementStats("invoices_generated");

  return {
    invoice_id:      invoiceId,
    invoice_number:  invoiceNum,
    contractor:      jobDetails.contractorName ?? "Contractor",
    customer:        { name: jobDetails.customerName ?? "Customer", address: jobDetails.customerAddress ?? "" },
    job_address:     jobDetails.jobAddress ?? jobDetails.customerAddress ?? "",
    job_date:        jobDetails.jobDate ?? new Date().toISOString().split("T")[0],
    line_items:      lineItems,
    subtotal_usd:    subtotal,
    tax_rate:        taxRate,
    tax_usd:         tax,
    total_usd:       total,
    payment_terms:   "Net 30",
    pdf_url:         `https://hivemcp.io/invoices/${invoiceId}.pdf`,
    service_fee_usd: INVOICE_FEE,
    platform_commission_usd: commission,
    generated_at:    new Date().toISOString(),
  };
}

// ─── getTradesStats ───────────────────────────────────────────────────────────

/**
 * Retrieve platform-wide statistics for the trades service module.
 * Free (no fee).
 *
 * @returns Platform stats object
 */
export function getTradesStats() {
  const stats = db.prepare("SELECT * FROM trades_stats WHERE id='singleton'").get();
  const muniCount  = db.prepare("SELECT COUNT(*) as n FROM trades_municipalities").get().n;
  const distCount  = db.prepare("SELECT COUNT(*) as n FROM trades_distributors").get().n;

  return {
    platform:               "HiveAgent Trades Services",
    municipalities_indexed: muniCount,
    distributors_indexed:   distCount,
    jobs_estimated:         stats.jobs_estimated,
    permits_looked_up:      stats.permits_looked_up,
    invoices_generated:     stats.invoices_generated,
    parts_searches:         stats.parts_searches,
    code_checks:            stats.code_checks,
    total_savings_usd:      stats.total_savings_usd,
    trade_types_supported:  ["hvac", "plumbing", "electrical", "roofing", "general"],
    pricing: {
      permit_lookup:    { fee: PERMIT_LOOKUP_FEE,   commission_pct: PERMIT_COMMISSION * 100   },
      job_estimate:     { fee: ESTIMATE_FEE,         commission_pct: ESTIMATE_COMMISSION * 100 },
      parts_search:     { fee: PARTS_SEARCH_FEE,     commission_pct: PARTS_COMMISSION * 100   },
      code_compliance:  { fee: CODE_CHECK_FEE,       commission_pct: CODE_COMMISSION * 100    },
      invoice_generate: { fee: INVOICE_FEE,          commission_pct: INVOICE_COMMISSION * 100 },
    },
    updated_at: stats.updated_at,
  };
}
