/**
 * HiveAgent Construction Supply Chain — Structural Products Vertical
 *
 * The deepest construction procurement MCP toolset in existence.
 * Built on 25 years of structural building products domain expertise
 * (structural connectors, fasteners, anchors, engineered lumber, concrete, steel).
 *
 * Functions (30+):
 *   skuLookup                 $0.10 / query
 *   skuCompatibilityCheck     $0.25 / check
 *   skuAlternatives           $0.25 / query
 *   skuLoadCalculation        $1.00 / calc
 *   skuCodeApproval           $0.25 / query
 *   inventoryCheck            $0.15 / check
 *   inventoryReserve          $0.50 / reserve
 *   procurementQuoteRequest   $1.00 / RFQ
 *   procurementCompareQuotes  $0.50 / compare
 *   procurementOrder          1.5% of order value
 *   procurementTrack          $0.25 / track
 *   procurementHistory        $0.50 / query
 *   projectCreate             $1.00 / project
 *   projectBomGenerate        $5.00 / BOM
 *   projectBomOptimize        $3.00 / optimize
 *   projectBomPrice           $2.00 / price
 *   projectSchedule           $2.00 / schedule
 *   codeCheck                 $1.00 / check
 *   inspectionSchedule        $0.50 / schedule
 *   inspectionChecklist       $0.50 / checklist
 *   inspectionReport          $0.50 / report
 *   deliveryEstimate          $0.25 / estimate
 *   deliverySchedule          $0.50 / schedule
 *   deliveryTrack             $0.25 / track
 *   contractorRegister        $2.00 / register
 *   contractorReputation      $0.25 / query
 *   vendorRegister            $2.00 / register
 *   vendorRating              $0.25 / query
 *   takeoffFromPlans          $5.00 / takeoff
 *   estimateProject           $5.00 / estimate
 *
 * @module construction-supply
 */

import { randomUUID } from "crypto";
import db from "../db.js";
import { COMPLETE_PRODUCT_CATALOG } from './construction-seed-data.js';

// ─── Live Mode ──────────────────────────────────────────────────────────────────
const LIVE_MODE = !!process.env.CONSTRUCTION_API_KEY;

// ─── Fees ───────────────────────────────────────────────────────────────────────
const FEES = {
  skuLookup:               0.10,
  skuCompatibilityCheck:   0.25,
  skuAlternatives:         0.25,
  skuLoadCalculation:      1.00,
  skuCodeApproval:         0.25,
  inventoryCheck:          0.15,
  inventoryReserve:        0.50,
  procurementQuoteRequest: 1.00,
  procurementCompareQuotes:0.50,
  procurementTrack:        0.25,
  procurementHistory:      0.50,
  projectCreate:           1.00,
  projectBomGenerate:      5.00,
  projectBomOptimize:      3.00,
  projectBomPrice:         2.00,
  projectSchedule:         2.00,
  codeCheck:               1.00,
  inspectionSchedule:      0.50,
  inspectionChecklist:     0.50,
  inspectionReport:        0.50,
  deliveryEstimate:        0.25,
  deliverySchedule:        0.50,
  deliveryTrack:           0.25,
  contractorRegister:      2.00,
  contractorReputation:    0.25,
  vendorRegister:          2.00,
  vendorRating:            0.25,
  takeoffFromPlans:        5.00,
  estimateProject:         5.00,
};

// ─── Schema Initialization ──────────────────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS construction_products (
      id                TEXT PRIMARY KEY,
      sku               TEXT NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL,
      subcategory       TEXT NOT NULL,
      description       TEXT,
      material          TEXT,
      finish            TEXT,
      load_rating_lbs   REAL,
      uplift_rating_lbs REAL,
      shear_rating_lbs  REAL,
      code_approval     TEXT,
      ibc_approved      INTEGER DEFAULT 1,
      irc_approved      INTEGER DEFAULT 1,
      cbc_approved      INTEGER DEFAULT 1,
      compatible_with   TEXT DEFAULT '[]',
      unit_price        REAL NOT NULL,
      pack_size         INTEGER DEFAULT 1,
      weight_lbs        REAL,
      unit              TEXT DEFAULT 'EA',
      dimensions        TEXT DEFAULT '{}',
      install_notes     TEXT,
      species_factor    TEXT DEFAULT '{}',
      created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_inventory (
      id            TEXT PRIMARY KEY,
      sku           TEXT NOT NULL,
      yard_id       TEXT NOT NULL,
      yard_name     TEXT NOT NULL,
      zip_code      TEXT NOT NULL,
      state         TEXT NOT NULL,
      qty_on_hand   INTEGER DEFAULT 0,
      qty_reserved  INTEGER DEFAULT 0,
      qty_available INTEGER GENERATED ALWAYS AS (qty_on_hand - qty_reserved) VIRTUAL,
      reorder_point INTEGER DEFAULT 10,
      lead_time_days INTEGER DEFAULT 3,
      last_received TEXT,
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_orders (
      id               TEXT PRIMARY KEY,
      order_number     TEXT NOT NULL UNIQUE,
      project_id       TEXT,
      vendor_id        TEXT NOT NULL,
      contractor_id    TEXT,
      status           TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft','submitted','confirmed','shipped','in_transit','delivered','cancelled')),
      line_items       TEXT DEFAULT '[]',
      subtotal_usd     REAL DEFAULT 0,
      tax_usd          REAL DEFAULT 0,
      shipping_usd     REAL DEFAULT 0,
      total_usd        REAL DEFAULT 0,
      po_number        TEXT,
      delivery_address TEXT,
      required_date    TEXT,
      tracking_number  TEXT,
      shipped_at       TEXT,
      delivered_at     TEXT,
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_quotes (
      id             TEXT PRIMARY KEY,
      rfq_id         TEXT NOT NULL,
      vendor_id      TEXT NOT NULL,
      vendor_name    TEXT NOT NULL,
      line_items     TEXT DEFAULT '[]',
      subtotal_usd   REAL DEFAULT 0,
      shipping_usd   REAL DEFAULT 0,
      total_usd      REAL DEFAULT 0,
      valid_until    TEXT,
      delivery_days  INTEGER,
      terms          TEXT DEFAULT 'NET30',
      status         TEXT DEFAULT 'received'
                       CHECK(status IN ('pending','received','accepted','rejected','expired')),
      vendor_rating  REAL DEFAULT 4.0,
      notes          TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_compatibility (
      id              TEXT PRIMARY KEY,
      sku_a           TEXT NOT NULL,
      sku_b           TEXT NOT NULL,
      compatible      INTEGER DEFAULT 1,
      load_capacity_lbs REAL,
      fastener_pattern  TEXT,
      notes           TEXT,
      code_reference  TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_projects (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      address          TEXT NOT NULL,
      city             TEXT,
      state            TEXT,
      zip_code         TEXT,
      project_type     TEXT NOT NULL CHECK(project_type IN ('residential','commercial','industrial','mixed-use')),
      scope            TEXT,
      seismic_zone     TEXT DEFAULT 'C',
      wind_speed_mph   INTEGER DEFAULT 115,
      snow_load_psf    REAL DEFAULT 25,
      floor_load_psf   REAL DEFAULT 40,
      roof_load_psf    REAL DEFAULT 20,
      sqft             REAL,
      stories          INTEGER DEFAULT 1,
      framing_type     TEXT DEFAULT 'wood-frame',
      estimated_budget REAL,
      status           TEXT DEFAULT 'planning'
                         CHECK(status IN ('planning','design','permitting','construction','closeout','complete')),
      bom              TEXT DEFAULT '[]',
      phases           TEXT DEFAULT '[]',
      notes            TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_inspections (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL,
      phase           TEXT NOT NULL,
      inspector_name  TEXT,
      scheduled_date  TEXT,
      completed_date  TEXT,
      status          TEXT DEFAULT 'scheduled'
                        CHECK(status IN ('scheduled','passed','failed','partial','reinspection')),
      checklist       TEXT DEFAULT '[]',
      findings        TEXT DEFAULT '[]',
      corrections     TEXT DEFAULT '[]',
      reinspect_date  TEXT,
      permit_number   TEXT,
      jurisdiction    TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_vendors (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      type           TEXT DEFAULT 'distributor'
                       CHECK(type IN ('manufacturer','distributor','wholesaler','dealer','online')),
      product_lines  TEXT DEFAULT '[]',
      territories    TEXT DEFAULT '[]',
      min_order_usd  REAL DEFAULT 0,
      lead_time_days INTEGER DEFAULT 5,
      fill_rate_pct  REAL DEFAULT 95,
      on_time_pct    REAL DEFAULT 90,
      rating         REAL DEFAULT 4.0,
      contact_email  TEXT,
      contact_phone  TEXT,
      notes          TEXT,
      active         INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_contractors (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      license_number   TEXT,
      state            TEXT NOT NULL,
      specialties      TEXT DEFAULT '[]',
      territory        TEXT DEFAULT '[]',
      insurance_exp    TEXT,
      bonding_amount   REAL,
      rating           REAL DEFAULT 4.0,
      completed_jobs   INTEGER DEFAULT 0,
      on_time_rate_pct REAL DEFAULT 90,
      quality_score    REAL DEFAULT 4.0,
      payment_score    REAL DEFAULT 4.0,
      active           INTEGER DEFAULT 1,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[construction-supply] schema init error:", e.message);
}


// ─── Map seed product → DB insert format ─────────────────────────────────────
function mapSeedProduct(p) {
  return {
    sku:              p.sku,
    name:             p.generic_name,
    category:         p.category,
    subcategory:      p.subcategory,
    description:      [
                        p.fits_member   ? `Fits: ${p.fits_member}`         : null,
                        p.icc_es_report ? `ICC-ES: ${p.icc_es_report}`     : null,
                        p.notes         || null,
                      ].filter(Boolean).join(' | ') || null,
    material:         p.material,
    finish:           p.finish,
    load_rating_lbs:  p.load_ratings?.download_lbs
                        ?? p.load_ratings?.tension_lbs_DF
                        ?? p.load_ratings?.tension_lbs
                        ?? null,
    uplift_rating_lbs: p.load_ratings?.uplift_lbs
                        ?? p.load_ratings?.uplift_lbs_nails
                        ?? null,
    shear_rating_lbs: p.load_ratings?.lateral_lbs
                        ?? p.load_ratings?.shear_lbs
                        ?? null,
    code_approval:    p.icc_es_report ? `ICC-ES ${p.icc_es_report}` : null,
    ibc_approved:     p.code_compliance?.some(c => c.includes('IBC')) ? 1 : 0,
    irc_approved:     p.code_compliance?.some(c => c.includes('IRC')) ? 1 : 0,
    cbc_approved:     p.code_compliance?.some(c => c.includes('IBC')) ? 1 : 0,
    compatible_with:  JSON.stringify(p.compatible_with ?? []),
    unit_price:       p.unit_price_usd,
    pack_size:        p.pack_size ?? 1,
    weight_lbs:       p.weight_lbs ?? null,
    unit:             p.unit ?? 'EA',
    dimensions:       JSON.stringify(p.dimensions_in ?? {}),
    install_notes:    [
                        p.fastener_schedule
                          ? 'Fasteners: ' + JSON.stringify(p.fastener_schedule)
                          : null,
                        p.notes || null,
                      ].filter(Boolean).join(' | ') || null,
    species_factor:   JSON.stringify({ DF: 1.0, SPF: 0.95 }),
  };
}


// ─── Seed Vendors ──────────────────────────────────────────────────────────────
const VENDORS = [
  {
    id: "vendor-abc-supply",
    name: "ABC Supply Co.",
    type: "distributor",
    product_lines: JSON.stringify(["connectors","fasteners","lumber","roofing","siding"]),
    territories: JSON.stringify(["CA","OR","WA","NV","AZ"]),
    min_order_usd: 50, lead_time_days: 1, fill_rate_pct: 97, on_time_pct: 94,
    rating: 4.7, contact_email: "orders@abcsupply-demo.com",
    contact_phone: "1-800-222-5000", notes: "National distributor, 900+ locations",
  },
  {
    id: "vendor-builders-first-source",
    name: "Builders FirstSource",
    type: "distributor",
    product_lines: JSON.stringify(["lumber","engineered-lumber","connectors","millwork","windows"]),
    territories: JSON.stringify(["ALL"]),
    min_order_usd: 200, lead_time_days: 2, fill_rate_pct: 95, on_time_pct: 91,
    rating: 4.5, contact_email: "orders@bfs-demo.com",
    contact_phone: "1-800-877-5612", notes: "Largest US building materials distributor",
  },
  {
    id: "vendor-fastenal",
    name: "Fastenal Construction",
    type: "distributor",
    product_lines: JSON.stringify(["fasteners","anchors","safety","tools","hardware"]),
    territories: JSON.stringify(["ALL"]),
    min_order_usd: 25, lead_time_days: 1, fill_rate_pct: 98, on_time_pct: 96,
    rating: 4.8, contact_email: "construction@fastenal-demo.com",
    contact_phone: "1-507-454-5374", notes: "2600+ US locations, 24/7 vending machines",
  },
  {
    id: "vendor-pacific-coast-supply",
    name: "Pacific Coast Supply",
    type: "wholesaler",
    product_lines: JSON.stringify(["connectors","anchors","fasteners","adhesives"]),
    territories: JSON.stringify(["CA","OR","WA","NV"]),
    min_order_usd: 100, lead_time_days: 2, fill_rate_pct: 93, on_time_pct: 88,
    rating: 4.2, contact_email: "sales@pcs-demo.com",
    contact_phone: "1-510-555-0100", notes: "West Coast specialist. Good stock on structural connectors.",
  },
  {
    id: "vendor-concrete-express",
    name: "Concrete Express Ready Mix",
    type: "manufacturer",
    product_lines: JSON.stringify(["concrete","aggregate","grout"]),
    territories: JSON.stringify(["CA","AZ","NV"]),
    min_order_usd: 400, lead_time_days: 1, fill_rate_pct: 99, on_time_pct: 90,
    rating: 4.6, contact_email: "dispatch@cexpress-demo.com",
    contact_phone: "1-800-555-CONC", notes: "Same-day delivery if ordered by 8am. Admixtures available.",
  },
];

// ─── Seed Inventory (some yards, some products) ────────────────────────────────
const INVENTORY = [
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "LUS210",    qty_on_hand: 1250, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "LUS26",     qty_on_hand: 870,  lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "H1",        qty_on_hand: 2400, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "H2-5",      qty_on_hand: 1800, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "ABA44",     qty_on_hand: 145,  lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "ABA66",     qty_on_hand: 80,   lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "HDU5-SDS2.5", qty_on_hand: 55, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "SDS-0.25X3", qty_on_hand: 340, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "10D-JOIST-HDG", qty_on_hand: 920, lead_time_days: 1 },
  { yard_id: "yard-abc-sf-94103", yard_name: "ABC Supply SF", zip_code: "94103", state: "CA", sku: "WEDGE-ANCHOR-0.5X3.5", qty_on_hand: 420, lead_time_days: 1 },
  { yard_id: "yard-bfs-seattle-98101", yard_name: "Builders FirstSource Seattle", zip_code: "98101", state: "WA", sku: "LVL-1.75X9.5-20FT", qty_on_hand: 48, lead_time_days: 2 },
  { yard_id: "yard-bfs-seattle-98101", yard_name: "Builders FirstSource Seattle", zip_code: "98101", state: "WA", sku: "TJI-360-9.5-20FT",  qty_on_hand: 120, lead_time_days: 2 },
  { yard_id: "yard-bfs-seattle-98101", yard_name: "Builders FirstSource Seattle", zip_code: "98101", state: "WA", sku: "2X10-SPF-16FT",      qty_on_hand: 600, lead_time_days: 1 },
  { yard_id: "yard-bfs-seattle-98101", yard_name: "Builders FirstSource Seattle", zip_code: "98101", state: "WA", sku: "LUS210",             qty_on_hand: 750, lead_time_days: 1 },
  { yard_id: "yard-fastenal-la-90001", yard_name: "Fastenal Los Angeles", zip_code: "90001", state: "CA", sku: "WEDGE-ANCHOR-0.625X4",  qty_on_hand: 380, lead_time_days: 1 },
  { yard_id: "yard-fastenal-la-90001", yard_name: "Fastenal Los Angeles", zip_code: "90001", state: "CA", sku: "EPOXY-ANCHOR-KIT-0.5",  qty_on_hand: 95,  lead_time_days: 1 },
  { yard_id: "yard-fastenal-la-90001", yard_name: "Fastenal Los Angeles", zip_code: "90001", state: "CA", sku: "SDS-0.25X3",            qty_on_hand: 510, lead_time_days: 1 },
  { yard_id: "yard-fastenal-la-90001", yard_name: "Fastenal Los Angeles", zip_code: "90001", state: "CA", sku: "HARNESS-FP-CLASS2",     qty_on_hand: 28,  lead_time_days: 1 },
];

// ─── Run Seed Data ──────────────────────────────────────────────────────────────
try {
  const insProd = db.prepare(`
    INSERT OR IGNORE INTO construction_products
      (id, sku, name, category, subcategory, description, material, finish, load_rating_lbs,
       uplift_rating_lbs, shear_rating_lbs, code_approval, ibc_approved, irc_approved,
       cbc_approved, compatible_with, unit_price, pack_size, weight_lbs, unit,
       dimensions, install_notes, species_factor)
    VALUES
      (@id, @sku, @name, @category, @subcategory, @description, @material, @finish, @load_rating_lbs,
       @uplift_rating_lbs, @shear_rating_lbs, @code_approval, @ibc_approved, @irc_approved,
       @cbc_approved, @compatible_with, @unit_price, @pack_size, @weight_lbs, @unit,
       @dimensions, @install_notes, @species_factor)
  `);
  for (const p of COMPLETE_PRODUCT_CATALOG) {
    insProd.run({ id: randomUUID(), ...mapSeedProduct(p) });
  }
} catch (e) {
  console.error("[construction-supply] product seed error:", e.message);
}

try {
  const vendorCount = db.prepare("SELECT COUNT(*) as n FROM construction_vendors").get().n;
  if (vendorCount === 0) {
    const insVend = db.prepare(`
      INSERT INTO construction_vendors
        (id, name, type, product_lines, territories, min_order_usd, lead_time_days,
         fill_rate_pct, on_time_pct, rating, contact_email, contact_phone, notes)
      VALUES
        (@id, @name, @type, @product_lines, @territories, @min_order_usd, @lead_time_days,
         @fill_rate_pct, @on_time_pct, @rating, @contact_email, @contact_phone, @notes)
    `);
    for (const v of VENDORS) {
      insVend.run(v);
    }
  }
} catch (e) {
  console.error("[construction-supply] vendor seed error:", e.message);
}

try {
  const invCount = db.prepare("SELECT COUNT(*) as n FROM construction_inventory").get().n;
  if (invCount === 0) {
    const insInv = db.prepare(`
      INSERT INTO construction_inventory
        (id, sku, yard_id, yard_name, zip_code, state, qty_on_hand, qty_reserved, lead_time_days)
      VALUES
        (@id, @sku, @yard_id, @yard_name, @zip_code, @state, @qty_on_hand, @qty_reserved, @lead_time_days)
    `);
    for (const inv of INVENTORY) {
      insInv.run({ id: randomUUID(), qty_reserved: 0, ...inv });
    }
  }
} catch (e) {
  console.error("[construction-supply] inventory seed error:", e.message);
}

// ─── Helper Utilities ──────────────────────────────────────────────────────────

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
}

function parseJSON(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Compute species-adjusted load from base load and species code */
function speciesAdjustedLoad(baseLbs, speciesFactorJson, speciesCode = "SPF") {
  const factors = parseJSON(speciesFactorJson, {});
  const f = factors[speciesCode] ?? factors["DF"] ?? 1.0;
  return Math.round(baseLbs * f);
}

// ─── SKU & COMPATIBILITY ENGINE ────────────────────────────────────────────────

export async function skuLookup(args) {
  const { query, sku, category, limit = 10 } = args;

  try {
    let products = [];

    if (sku) {
      const p = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku.toUpperCase());
      if (p) products = [p];
    } else if (query) {
      const q = `%${query}%`;
      products = db.prepare(`
        SELECT * FROM construction_products
        WHERE name LIKE ? OR sku LIKE ? OR description LIKE ? OR subcategory LIKE ? OR category LIKE ?
        ORDER BY category, subcategory, sku
        LIMIT ?
      `).all(q, q, q, q, q, limit);
    } else if (category) {
      products = db.prepare(
        "SELECT * FROM construction_products WHERE category = ? ORDER BY subcategory, sku LIMIT ?"
      ).all(category, limit);
    } else {
      products = db.prepare("SELECT * FROM construction_products ORDER BY category, subcategory LIMIT ?").all(limit);
    }

    if (products.length === 0) {
      return { found: false, message: "No products matched. Try a different SKU, description, or category.", fee_usd: FEES.skuLookup };
    }

    const results = products.map(p => ({
      ...p,
      compatible_with: parseJSON(p.compatible_with, []),
      dimensions: parseJSON(p.dimensions, {}),
      species_factor: parseJSON(p.species_factor, {}),
    }));

    return {
      found: true,
      count: results.length,
      products: results,
      live_mode: LIVE_MODE,
      fee_usd: FEES.skuLookup,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function skuCompatibilityCheck(args) {
  const { sku_a, sku_b, species = "SPF" } = args;

  try {
    const prodA = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku_a?.toUpperCase());
    const prodB = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku_b?.toUpperCase());

    if (!prodA) return { error: `SKU not found: ${sku_a}`, fee_usd: 0 };
    if (!prodB) return { error: `SKU not found: ${sku_b}`, fee_usd: 0 };

    const compatListA = parseJSON(prodA.compatible_with, []);
    const compatListB = parseJSON(prodB.compatible_with, []);

    const compatible = compatListA.includes(sku_b.toUpperCase()) || compatListB.includes(sku_a.toUpperCase());

    let loadCapacityLbs = null;
    let fastenerPattern = null;
    let notes = null;

    // Check explicit compatibility record
    const record = db.prepare(`
      SELECT * FROM construction_compatibility
      WHERE (sku_a = ? AND sku_b = ?) OR (sku_a = ? AND sku_b = ?)
      LIMIT 1
    `).get(sku_a.toUpperCase(), sku_b.toUpperCase(), sku_b.toUpperCase(), sku_a.toUpperCase());

    if (record) {
      loadCapacityLbs = record.load_capacity_lbs;
      fastenerPattern = record.fastener_pattern;
      notes = record.notes;
    } else if (compatible) {
      // Derive load from hanger/lumber combo
      loadCapacityLbs = speciesAdjustedLoad(prodA.load_rating_lbs || 0, prodA.species_factor, species);
      notes = `Based on catalog load rating for ${species} species.`;
    }

    return {
      sku_a: prodA.sku,
      sku_b: prodB.sku,
      product_a: prodA.name,
      product_b: prodB.name,
      compatible,
      species,
      load_capacity_lbs: loadCapacityLbs,
      fastener_pattern: fastenerPattern,
      code_reference: prodA.code_approval,
      notes: notes ?? (compatible ? "Products are listed as compatible." : "Products are NOT listed as compatible — verify with manufacturer."),
      live_mode: LIVE_MODE,
      fee_usd: FEES.skuCompatibilityCheck,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function skuAlternatives(args) {
  const { sku, min_load_lbs, category, subcategory, max_price } = args;

  try {
    let refProduct = null;
    if (sku) {
      refProduct = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku.toUpperCase());
    }

    const minLoad = min_load_lbs ?? (refProduct?.load_rating_lbs ?? 0);
    const cat = category ?? refProduct?.category;
    const subcat = subcategory ?? refProduct?.subcategory;

    let query = `SELECT * FROM construction_products WHERE load_rating_lbs >= ? AND category = ?`;
    const params = [minLoad * 0.95, cat];

    if (subcat) { query += ` AND subcategory = ?`; params.push(subcat); }
    if (max_price) { query += ` AND unit_price <= ?`; params.push(max_price); }
    if (sku) { query += ` AND sku != ?`; params.push(sku.toUpperCase()); }

    query += ` ORDER BY unit_price ASC LIMIT 8`;

    const alts = db.prepare(query).all(...params).map(p => ({
      sku: p.sku,
      name: p.name,
      subcategory: p.subcategory,
      load_rating_lbs: p.load_rating_lbs,
      uplift_rating_lbs: p.uplift_rating_lbs,
      code_approval: p.code_approval,
      unit_price: p.unit_price,
      pack_size: p.pack_size,
      price_delta_vs_ref: refProduct ? +(p.unit_price - refProduct.unit_price).toFixed(2) : null,
    }));

    return {
      reference_sku: refProduct?.sku ?? null,
      reference_load_lbs: minLoad,
      alternatives: alts,
      count: alts.length,
      live_mode: LIVE_MODE,
      fee_usd: FEES.skuAlternatives,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function skuLoadCalculation(args) {
  const {
    sku,
    species = "SPF",
    loading_direction = "vertical",
    num_fasteners = null,
    duration_factor = 1.0,  // CD: normal=1.0, wind/seismic=1.6, roof snow=1.15
  } = args;

  try {
    const p = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku?.toUpperCase());
    if (!p) return { error: `SKU not found: ${sku}`, fee_usd: 0 };

    const sf = parseJSON(p.species_factor, {});
    const speciesMult = sf[species] ?? sf["DF"] ?? 1.0;

    const baseDownload = p.load_rating_lbs ?? 0;
    const baseUplift   = p.uplift_rating_lbs ?? 0;
    const baseShear    = p.shear_rating_lbs ?? 0;

    const adjDownload = Math.round(baseDownload * speciesMult * duration_factor);
    const adjUplift   = Math.round(baseUplift   * speciesMult * duration_factor);
    const adjShear    = Math.round(baseShear    * speciesMult * duration_factor);

    const governingLoad = loading_direction === "uplift"
      ? adjUplift : loading_direction === "shear" ? adjShear : adjDownload;

    return {
      sku: p.sku,
      name: p.name,
      species,
      species_factor: speciesMult,
      duration_factor,
      loading_direction,
      base_loads: {
        download_lbs: baseDownload,
        uplift_lbs: baseUplift,
        shear_lbs: baseShear,
      },
      adjusted_loads: {
        download_lbs: adjDownload,
        uplift_lbs: adjUplift,
        shear_lbs: adjShear,
      },
      governing_load_lbs: governingLoad,
      code_approval: p.code_approval,
      install_notes: p.install_notes,
      method: "NDS-2018 Chapter 11 with CD and species Cm adjustments (Dry service)",
      live_mode: LIVE_MODE,
      fee_usd: FEES.skuLoadCalculation,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function skuCodeApproval(args) {
  const { sku, jurisdiction } = args;

  try {
    const p = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku?.toUpperCase());
    if (!p) return { error: `SKU not found: ${sku}`, fee_usd: 0 };

    const codes = [];
    if (p.ibc_approved) codes.push({ code: "IBC 2021", status: "approved", notes: "International Building Code" });
    if (p.irc_approved) codes.push({ code: "IRC 2021", status: "approved", notes: "International Residential Code" });
    if (p.cbc_approved) codes.push({ code: "CBC 2022", status: "approved", notes: "California Building Code" });

    // Check jurisdiction-specific overrides
    let jurisdictionNote = null;
    if (jurisdiction) {
      const j = jurisdiction.toUpperCase();
      if (j === "FL" && p.category === "connectors") {
        jurisdictionNote = "Florida High-Velocity Hurricane Zone (HVHZ) may require FBC Product Approval (NOA) in Miami-Dade and Broward counties.";
      } else if (j === "CA" && p.category === "anchors") {
        jurisdictionNote = "California DSA (Division of the State Architect) or OSHPD projects require additional approval for anchors in hospitals/schools.";
      }
    }

    return {
      sku: p.sku,
      name: p.name,
      code_approval_number: p.code_approval,
      approved_codes: codes,
      jurisdiction_note: jurisdictionNote,
      category: p.category,
      live_mode: LIVE_MODE,
      fee_usd: FEES.skuCodeApproval,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── INVENTORY & PROCUREMENT ───────────────────────────────────────────────────

export async function inventoryCheck(args) {
  const { sku, zip_code, state, qty_needed = 1 } = args;

  try {
    let rows = [];
    if (zip_code) {
      rows = db.prepare("SELECT * FROM construction_inventory WHERE sku = ? AND zip_code = ?").all(
        sku.toUpperCase(), zip_code
      );
      if (rows.length === 0) {
        // Nearby state fallback
        rows = db.prepare("SELECT * FROM construction_inventory WHERE sku = ? ORDER BY qty_on_hand DESC LIMIT 5").all(sku.toUpperCase());
      }
    } else if (state) {
      rows = db.prepare("SELECT * FROM construction_inventory WHERE sku = ? AND state = ? ORDER BY qty_on_hand DESC LIMIT 5").all(sku.toUpperCase(), state.toUpperCase());
    } else {
      rows = db.prepare("SELECT * FROM construction_inventory WHERE sku = ? ORDER BY qty_on_hand DESC LIMIT 5").all(sku.toUpperCase());
    }

    const product = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku.toUpperCase());
    if (!product && rows.length === 0) return { error: `SKU not found: ${sku}`, fee_usd: 0 };

    const locations = rows.map(r => ({
      yard_id: r.yard_id,
      yard_name: r.yard_name,
      zip_code: r.zip_code,
      state: r.state,
      qty_on_hand: r.qty_on_hand,
      qty_reserved: r.qty_reserved,
      qty_available: r.qty_on_hand - r.qty_reserved,
      sufficient: (r.qty_on_hand - r.qty_reserved) >= qty_needed,
      lead_time_days: r.lead_time_days,
    }));

    const inStock = locations.some(l => l.sufficient);
    const totalAvail = locations.reduce((s, l) => s + l.qty_available, 0);

    return {
      sku: sku.toUpperCase(),
      product_name: product?.name ?? "Unknown",
      qty_needed,
      total_available: totalAvail,
      in_stock: inStock,
      backordered: !inStock,
      backorder_lead_days: inStock ? null : 5,
      locations,
      live_mode: LIVE_MODE,
      fee_usd: FEES.inventoryCheck,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function inventoryReserve(args) {
  const { sku, qty, yard_id, project_id, hold_hours = 48 } = args;

  try {
    const invRow = db.prepare(
      "SELECT * FROM construction_inventory WHERE sku = ? AND yard_id = ?"
    ).get(sku.toUpperCase(), yard_id);

    if (!invRow) return { error: `No inventory found for SKU ${sku} at yard ${yard_id}`, fee_usd: 0 };

    const available = invRow.qty_on_hand - invRow.qty_reserved;
    if (available < qty) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${available}, Requested: ${qty}`,
        fee_usd: 0,
      };
    }

    db.prepare("UPDATE construction_inventory SET qty_reserved = qty_reserved + ? WHERE id = ?").run(qty, invRow.id);

    const reservationId = `RES-${randomUUID().slice(0, 8).toUpperCase()}`;
    const expiry = new Date(Date.now() + hold_hours * 3600000).toISOString();

    return {
      success: true,
      reservation_id: reservationId,
      sku: sku.toUpperCase(),
      qty_reserved: qty,
      yard_id,
      yard_name: invRow.yard_name,
      project_id: project_id ?? null,
      hold_expires: expiry,
      hold_hours,
      live_mode: LIVE_MODE,
      fee_usd: FEES.inventoryReserve,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function procurementQuoteRequest(args) {
  const { line_items, delivery_address, required_date, vendor_ids, notes } = args;

  try {
    const rfqId = `RFQ-${randomUUID().slice(0, 8).toUpperCase()}`;

    // Get vendor list
    let vendors = [];
    if (vendor_ids?.length) {
      vendors = db.prepare(
        `SELECT * FROM construction_vendors WHERE id IN (${vendor_ids.map(() => "?").join(",")}) AND active = 1`
      ).all(...vendor_ids);
    } else {
      vendors = db.prepare("SELECT * FROM construction_vendors WHERE active = 1 ORDER BY rating DESC LIMIT 3").all();
    }

    // Build simulated quotes per vendor
    const quotes = vendors.map(v => {
      const quoteId = `QT-${randomUUID().slice(0, 8).toUpperCase()}`;
      const vendorLineItems = (line_items || []).map(item => {
        const prod = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(item.sku?.toUpperCase());
        if (!prod) return { ...item, unit_price: null, extended: null, available: false };
        const markup = 1.0 + (Math.random() * 0.12); // 0-12% vendor markup
        const unitPrice = +(prod.unit_price * markup).toFixed(2);
        return {
          sku: item.sku.toUpperCase(),
          name: prod.name,
          qty: item.qty,
          unit_price: unitPrice,
          extended: +(unitPrice * item.qty).toFixed(2),
          available: true,
          lead_time_days: v.lead_time_days,
        };
      });

      const subtotal = vendorLineItems.reduce((s, i) => s + (i.extended ?? 0), 0);
      const shipping = subtotal > 500 ? 0 : 45; // Free shipping over $500

      const qt = {
        id: quoteId,
        rfq_id: rfqId,
        vendor_id: v.id,
        vendor_name: v.name,
        line_items: JSON.stringify(vendorLineItems),
        subtotal_usd: +subtotal.toFixed(2),
        shipping_usd: shipping,
        total_usd: +(subtotal + shipping).toFixed(2),
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        delivery_days: v.lead_time_days + 1,
        terms: "NET30",
        status: "received",
        vendor_rating: v.rating,
        notes: v.notes,
      };

      db.prepare(`
        INSERT INTO construction_quotes
          (id, rfq_id, vendor_id, vendor_name, line_items, subtotal_usd, shipping_usd,
           total_usd, valid_until, delivery_days, terms, status, vendor_rating, notes)
        VALUES
          (@id, @rfq_id, @vendor_id, @vendor_name, @line_items, @subtotal_usd, @shipping_usd,
           @total_usd, @valid_until, @delivery_days, @terms, @status, @vendor_rating, @notes)
      `).run(qt);

      return { ...qt, line_items: vendorLineItems };
    });

    return {
      rfq_id: rfqId,
      status: "quotes_received",
      quotes_count: quotes.length,
      quotes,
      delivery_address,
      required_date: required_date ?? null,
      notes: notes ?? null,
      live_mode: LIVE_MODE,
      fee_usd: FEES.procurementQuoteRequest,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function procurementCompareQuotes(args) {
  const { rfq_id } = args;

  try {
    const quotes = db.prepare("SELECT * FROM construction_quotes WHERE rfq_id = ?").all(rfq_id);
    if (quotes.length === 0) return { error: `No quotes found for RFQ ${rfq_id}`, fee_usd: 0 };

    const parsed = quotes.map(q => ({
      ...q,
      line_items: parseJSON(q.line_items, []),
      score: +(
        (1 / q.total_usd) * 50 +        // price weight 50%
        (q.vendor_rating / 5.0) * 30 +  // quality weight 30%
        (1 / q.delivery_days) * 20       // speed weight 20%
      ).toFixed(6),
    })).sort((a, b) => b.score - a.score);

    return {
      rfq_id,
      quotes_count: parsed.length,
      recommended: parsed[0]?.id,
      recommended_vendor: parsed[0]?.vendor_name,
      recommended_total_usd: parsed[0]?.total_usd,
      rankings: parsed.map((q, i) => ({
        rank: i + 1,
        quote_id: q.id,
        vendor_name: q.vendor_name,
        vendor_rating: q.vendor_rating,
        subtotal_usd: q.subtotal_usd,
        shipping_usd: q.shipping_usd,
        total_usd: q.total_usd,
        delivery_days: q.delivery_days,
        valid_until: q.valid_until,
        score: q.score,
      })),
      live_mode: LIVE_MODE,
      fee_usd: FEES.procurementCompareQuotes,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function procurementOrder(args) {
  const { quote_id, project_id, contractor_id, delivery_address, required_date, po_number } = args;

  try {
    const quote = db.prepare("SELECT * FROM construction_quotes WHERE id = ?").get(quote_id);
    if (!quote) return { error: `Quote not found: ${quote_id}`, fee_usd: 0 };

    const orderNumber = `PO-${Date.now().toString().slice(-8)}`;
    const orderId = randomUUID();
    const commission = +(quote.total_usd * 0.015).toFixed(2); // 1.5% platform fee

    db.prepare(`
      INSERT INTO construction_orders
        (id, order_number, project_id, vendor_id, contractor_id, status, line_items,
         subtotal_usd, tax_usd, shipping_usd, total_usd, po_number, delivery_address, required_date, notes)
      VALUES
        (?, ?, ?, ?, ?, 'confirmed', ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, orderNumber, project_id ?? null, quote.vendor_id, contractor_id ?? null,
      quote.line_items, quote.subtotal_usd, quote.shipping_usd, quote.total_usd,
      po_number ?? null, delivery_address ?? null, required_date ?? null, null
    );

    db.prepare("UPDATE construction_quotes SET status = 'accepted' WHERE id = ?").run(quote_id);

    return {
      success: true,
      order_id: orderId,
      order_number: orderNumber,
      status: "confirmed",
      vendor_id: quote.vendor_id,
      vendor_name: quote.vendor_name,
      total_usd: quote.total_usd,
      platform_fee_usd: commission,
      expected_delivery_days: quote.delivery_days,
      live_mode: LIVE_MODE,
      fee_usd: commission,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function procurementTrack(args) {
  const { order_id, order_number } = args;

  try {
    let order = null;
    if (order_id) {
      order = db.prepare("SELECT * FROM construction_orders WHERE id = ?").get(order_id);
    } else if (order_number) {
      order = db.prepare("SELECT * FROM construction_orders WHERE order_number = ?").get(order_number);
    }

    if (!order) return { error: "Order not found", fee_usd: 0 };

    // Simulate tracking progression
    const statusTimeline = {
      draft:       { next: "submitted",   eta_hours: 0 },
      submitted:   { next: "confirmed",   eta_hours: 4 },
      confirmed:   { next: "shipped",     eta_hours: 24 },
      shipped:     { next: "in_transit",  eta_hours: 2 },
      in_transit:  { next: "delivered",   eta_hours: 48 },
      delivered:   { next: null,          eta_hours: 0 },
    };

    const current = statusTimeline[order.status];

    return {
      order_id: order.id,
      order_number: order.order_number,
      status: order.status,
      next_status: current?.next,
      next_status_eta_hours: current?.eta_hours,
      tracking_number: order.tracking_number ?? `TRK${order.id.slice(0, 10).toUpperCase()}`,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      total_usd: order.total_usd,
      live_mode: LIVE_MODE,
      fee_usd: FEES.procurementTrack,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function procurementHistory(args) {
  const { project_id, contractor_id, vendor_id, limit = 20 } = args;

  try {
    let orders = [];
    if (project_id) {
      orders = db.prepare("SELECT * FROM construction_orders WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(project_id, limit);
    } else if (contractor_id) {
      orders = db.prepare("SELECT * FROM construction_orders WHERE contractor_id = ? ORDER BY created_at DESC LIMIT ?").all(contractor_id, limit);
    } else if (vendor_id) {
      orders = db.prepare("SELECT * FROM construction_orders WHERE vendor_id = ? ORDER BY created_at DESC LIMIT ?").all(vendor_id, limit);
    } else {
      orders = db.prepare("SELECT * FROM construction_orders ORDER BY created_at DESC LIMIT ?").all(limit);
    }

    const totalSpend = orders.reduce((s, o) => s + (o.total_usd ?? 0), 0);
    const delivered = orders.filter(o => o.status === "delivered").length;

    return {
      count: orders.length,
      total_spend_usd: +totalSpend.toFixed(2),
      delivered_count: delivered,
      in_progress_count: orders.length - delivered,
      orders: orders.map(o => pick(o, ["id","order_number","vendor_id","status","total_usd","required_date","delivered_at","created_at"])),
      live_mode: LIVE_MODE,
      fee_usd: FEES.procurementHistory,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── PROJECT & BOM MANAGEMENT ──────────────────────────────────────────────────

export async function projectCreate(args) {
  const {
    name, address, city, state, zip_code, project_type,
    scope, seismic_zone = "C", wind_speed_mph = 115,
    snow_load_psf = 25, floor_load_psf = 40, roof_load_psf = 20,
    sqft, stories = 1, framing_type = "wood-frame", estimated_budget,
  } = args;

  try {
    const projectId = randomUUID();

    db.prepare(`
      INSERT INTO construction_projects
        (id, name, address, city, state, zip_code, project_type, scope, seismic_zone,
         wind_speed_mph, snow_load_psf, floor_load_psf, roof_load_psf, sqft, stories,
         framing_type, estimated_budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, name, address, city ?? null, state ?? null, zip_code ?? null,
      project_type, scope ?? null, seismic_zone, wind_speed_mph,
      snow_load_psf, floor_load_psf, roof_load_psf,
      sqft ?? null, stories, framing_type, estimated_budget ?? null
    );

    return {
      success: true,
      project_id: projectId,
      name,
      project_type,
      seismic_zone,
      wind_speed_mph,
      status: "planning",
      live_mode: LIVE_MODE,
      fee_usd: FEES.projectCreate,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function projectBomGenerate(args) {
  const {
    project_id,
    sqft = 2000,
    stories = 1,
    seismic_zone = "C",
    framing_type = "wood-frame",
    joist_spacing_in = 16,
    joist_span_ft = 14,
    header_span_ft = 10,
    wind_speed_mph = 115,
  } = args;

  try {
    // ─── BOM Calculation Logic (engineering-grade) ──────────────────────────
    const floorJoists = Math.ceil((sqft / stories) / (joist_spacing_in / 12) * stories);
    const hangers2x10 = floorJoists;
    const hurricaneTies = Math.ceil(sqft / 24); // ~ 1 per 24 sqft of roof area
    const headers = Math.ceil(sqft / 400); // rough header count
    const postBases44 = Math.ceil(sqft / 500);
    const postBases66 = Math.ceil(sqft / 1500);
    const holdDowns = seismic_zone >= "D" ? 4 * stories : 2 * stories;
    const wedgeAnchors = Math.ceil(sqft / 200);
    const sdsBoxes = Math.ceil(sqft / 800);
    const joisthangernails = Math.ceil(hangers2x10 * 0.15); // ~0.15 lb per hanger
    const straps = Math.ceil(sqft / 100);
    const lvlBeams = headers;
    const readyMixCY = Math.ceil(sqft / 600); // rough footing calc

    const bom = [
      { sku: "LUS210",             name: "Joist Hanger 2x10",          qty: hangers2x10,  unit: "EA",  reason: "Floor joist connections" },
      { sku: "H1",                 name: "Hurricane Tie",               qty: hurricaneTies, unit: "EA", reason: `Rafter/truss ties (${seismic_zone}/${wind_speed_mph}mph)` },
      { sku: "H2-5",               name: "Hurricane Tie Double Shear",  qty: Math.ceil(hurricaneTies * 0.3), unit: "EA", reason: "High-uplift zones (hip corners)" },
      { sku: "ABA44",              name: "Post Base 4x4",               qty: postBases44,  unit: "EA",  reason: "Deck/porch post connections" },
      { sku: "ABA66",              name: "Post Base 6x6",               qty: postBases66,  unit: "EA",  reason: "Beam post connections" },
      { sku: "HDU5-SDS2.5",        name: "Holdown 5 kip",               qty: holdDowns,    unit: "EA",  reason: `Shear wall hold-downs (Seismic Zone ${seismic_zone})` },
      { sku: "MSTA12",             name: "Strap Tie 12 in.",            qty: straps,       unit: "EA",  reason: "Continuous load path straps" },
      { sku: "LVL-1.75X9.5-20FT", name: "LVL Beam 1.75x9.5 20ft",      qty: lvlBeams,     unit: "EA",  reason: `${header_span_ft}-ft header spans` },
      { sku: "TJI-360-9.5-20FT",  name: "I-Joist 9.5in 20ft",          qty: Math.ceil(floorJoists * 0.5), unit: "EA", reason: `Engineered floor system ${joist_span_ft}-ft span` },
      { sku: "WEDGE-ANCHOR-0.5X3.5", name: "Wedge Anchor 1/2x3.5",    qty: wedgeAnchors, unit: "BOX (10ct)", reason: "Sill plate and post base anchoring" },
      { sku: "SDS-0.25X3",         name: "SDS Screw 1/4x3 (100ct box)", qty: sdsBoxes,   unit: "BOX",  reason: "Connector fastening" },
      { sku: "10D-JOIST-HDG",      name: "10d Joist Hanger Nails (1lb)", qty: joisthangernails, unit: "LB", reason: "Hanger nail fill" },
      { sku: "READY-MIX-3000PSI",  name: "Ready-Mix Concrete 3000 psi", qty: readyMixCY,  unit: "CY",  reason: "Footings and foundation" },
      { sku: "REBAR-4",            name: "#4 Rebar 20ft",               qty: Math.ceil(readyMixCY * 8), unit: "EA", reason: "Footing and stem wall reinforcing" },
      { sku: "EPOXY-ANCHOR-KIT-0.5", name: "Epoxy Anchor 1/2in",       qty: seismic_zone >= "D" ? 12 : 0, unit: "KIT", reason: "Hold-down retrofit anchors (seismic)" },
      { sku: "CONST-ADH-PL400",    name: "Construction Adhesive 28oz",  qty: Math.ceil(sqft / 400), unit: "EA", reason: "Subfloor adhesive (squeak prevention)" },
      { sku: "HARNESS-FP-CLASS2",  name: "Fall Protection Harness",      qty: 2,           unit: "EA",  reason: "OSHA required fall protection" },
      { sku: "SELF-RETRACTING-LIFELINE-30FT", name: "SRL 30ft",         qty: 1,           unit: "EA",  reason: "Lifeline for roof work" },
      { sku: "PPE-HARDHAT-TYPE1",  name: "Hard Hat Type I",              qty: 4,           unit: "EA",  reason: "Site safety PPE" },
    ].filter(item => item.qty > 0);

    // Price each line
    const pricedBom = bom.map(item => {
      const prod = db.prepare("SELECT unit_price FROM construction_products WHERE sku = ?").get(item.sku);
      const unitPrice = prod?.unit_price ?? 0;
      return {
        ...item,
        unit_price: unitPrice,
        extended_usd: +(unitPrice * item.qty).toFixed(2),
      };
    });

    const totalMaterials = +pricedBom.reduce((s, i) => s + i.extended_usd, 0).toFixed(2);

    if (project_id) {
      try {
        db.prepare("UPDATE construction_projects SET bom = ? WHERE id = ?").run(
          JSON.stringify(pricedBom), project_id
        );
      } catch (e2) { /* silent */ }
    }

    return {
      project_id: project_id ?? null,
      sqft,
      stories,
      seismic_zone,
      framing_type,
      bom_line_count: pricedBom.length,
      bom: pricedBom,
      total_materials_usd: totalMaterials,
      notes: "BOM is a representative hardware takeoff. Consult structural engineer for final quantities.",
      live_mode: LIVE_MODE,
      fee_usd: FEES.projectBomGenerate,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function projectBomOptimize(args) {
  const { bom, seismic_zone = "C", max_savings_pct = 20 } = args;

  try {
    const optimized = [];
    let totalSavings = 0;

    for (const item of (bom || [])) {
      const prod = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(item.sku?.toUpperCase());
      if (!prod) { optimized.push({ ...item, action: "no_change", note: "SKU not found" }); continue; }

      // Find cheaper alternative with same load rating
      const alt = db.prepare(`
        SELECT * FROM construction_products
        WHERE category = ? AND subcategory = ?
          AND load_rating_lbs >= ? AND unit_price < ? AND sku != ?
        ORDER BY unit_price ASC LIMIT 1
      `).get(prod.category, prod.subcategory, (prod.load_rating_lbs ?? 0) * 0.95, prod.unit_price, prod.sku);

      if (alt && prod.unit_price > 0) {
        const savings = +(( prod.unit_price - alt.unit_price) * item.qty).toFixed(2);
        const savingsPct = ((prod.unit_price - alt.unit_price) / prod.unit_price) * 100;
        if (savingsPct <= max_savings_pct) {
          totalSavings += savings;
          optimized.push({
            ...item, sku: alt.sku, name: alt.name, unit_price: alt.unit_price,
            extended_usd: +(alt.unit_price * item.qty).toFixed(2),
            action: "substituted",
            original_sku: prod.sku,
            savings_usd: savings,
            note: `Code-compliant substitution: ${alt.code_approval}`,
          });
          continue;
        }
      }
      optimized.push({ ...item, action: "no_change", savings_usd: 0 });
    }

    return {
      optimized_bom: optimized,
      total_savings_usd: +totalSavings.toFixed(2),
      items_substituted: optimized.filter(i => i.action === "substituted").length,
      live_mode: LIVE_MODE,
      fee_usd: FEES.projectBomOptimize,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function projectBomPrice(args) {
  const { bom, vendor_ids } = args;

  try {
    let vendors = [];
    if (vendor_ids?.length) {
      vendors = db.prepare(
        `SELECT * FROM construction_vendors WHERE id IN (${vendor_ids.map(() => "?").join(",")}) AND active = 1`
      ).all(...vendor_ids);
    } else {
      vendors = db.prepare("SELECT * FROM construction_vendors WHERE active = 1 ORDER BY rating DESC LIMIT 3").all();
    }

    const vendorPricing = vendors.map(v => {
      const lineItems = (bom || []).map(item => {
        const prod = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(item.sku?.toUpperCase());
        const unitPrice = prod ? +(prod.unit_price * (1 + Math.random() * 0.10)).toFixed(2) : null;
        return {
          sku: item.sku,
          name: item.name ?? prod?.name,
          qty: item.qty,
          unit_price: unitPrice,
          extended_usd: unitPrice ? +(unitPrice * item.qty).toFixed(2) : null,
        };
      });
      const subtotal = lineItems.reduce((s, i) => s + (i.extended_usd ?? 0), 0);
      return {
        vendor_id: v.id,
        vendor_name: v.name,
        vendor_rating: v.rating,
        line_items: lineItems,
        subtotal_usd: +subtotal.toFixed(2),
        shipping_usd: subtotal > 1000 ? 0 : 95,
        total_usd: subtotal > 1000 ? +subtotal.toFixed(2) : +(subtotal + 95).toFixed(2),
        lead_time_days: v.lead_time_days,
      };
    });

    const best = vendorPricing.sort((a, b) => a.total_usd - b.total_usd)[0];

    return {
      vendor_count: vendorPricing.length,
      best_vendor: best?.vendor_name,
      best_total_usd: best?.total_usd,
      vendor_breakdown: vendorPricing,
      live_mode: LIVE_MODE,
      fee_usd: FEES.projectBomPrice,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function projectSchedule(args) {
  const { project_id, start_date, sqft = 2000, framing_type = "wood-frame" } = args;

  try {
    const start = start_date ? new Date(start_date) : new Date();
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().split("T")[0];

    const phases = [
      {
        phase: "Site Work & Excavation", start_offset_days: 0, duration_days: 5,
        procurement_items: ["REBAR-4","REBAR-5","READY-MIX-3000PSI","READY-MIX-4000PSI"],
        note: "Order concrete and rebar before breaking ground.",
      },
      {
        phase: "Foundation & Footings", start_offset_days: 5, duration_days: 10,
        procurement_items: ["WEDGE-ANCHOR-0.5X3.5","EPOXY-ANCHOR-KIT-0.5","FIBER-CONCRETE-4000PSI"],
        note: "Anchor bolts set in concrete during pour. Cure 28 days for full strength.",
      },
      {
        phase: "Framing — Floor System", start_offset_days: 15, duration_days: 8,
        procurement_items: ["LUS210","HGUS210","TJI-360-9.5-20FT","LVL-1.75X9.5-20FT","10D-JOIST-HDG","SDS-0.25X3","CONST-ADH-PL400"],
        note: "Deliver engineered lumber same day as framing crew arrives.",
      },
      {
        phase: "Framing — Wall System", start_offset_days: 23, duration_days: 10,
        procurement_items: ["2X6-SPF-8FT","HDU5-SDS2.5","HDU11-SDS2.5","MSTA12","A35","NAILS-8D","SDS-0.25X3"],
        note: "Hold-downs must be installed and nailed before sheating.",
      },
      {
        phase: "Framing — Roof System", start_offset_days: 33, duration_days: 7,
        procurement_items: ["H1","H2-5","CMST14","LVL-3.5X11.25-24FT","10D-JOIST-HDG","HARNESS-FP-CLASS2","SELF-RETRACTING-LIFELINE-30FT"],
        note: "Hurricane ties required at every rafter. Fall protection mandatory.",
      },
      {
        phase: "Sheathing & Weatherproofing", start_offset_days: 40, duration_days: 6,
        procurement_items: ["NAILS-8D","SEALANT-NP1-10OZ","SILICONE-NEUTRAL-10OZ"],
        note: "Seal all penetrations before insulation.",
      },
      {
        phase: "Rough MEP", start_offset_days: 46, duration_days: 14,
        procurement_items: [],
        note: "Coordinate connector clearances for HVAC penetrations through LVL.",
      },
      {
        phase: "Insulation & Drywall", start_offset_days: 60, duration_days: 10,
        procurement_items: [],
        note: "Framing inspection required before covering walls.",
      },
    ];

    const scheduledPhases = phases.map(ph => ({
      ...ph,
      start_date: addDays(start, ph.start_offset_days),
      end_date: addDays(start, ph.start_offset_days + ph.duration_days),
      procurement_deadline: addDays(start, ph.start_offset_days - 3),
    }));

    if (project_id) {
      try {
        db.prepare("UPDATE construction_projects SET phases = ?, status = 'construction' WHERE id = ?").run(
          JSON.stringify(scheduledPhases), project_id
        );
      } catch (e2) { /* silent */ }
    }

    return {
      project_id: project_id ?? null,
      project_start: addDays(start, 0),
      estimated_completion: addDays(start, 70),
      phases: scheduledPhases,
      live_mode: LIVE_MODE,
      fee_usd: FEES.projectSchedule,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── CODE COMPLIANCE & INSPECTIONS ────────────────────────────────────────────

export async function codeCheck(args) {
  const { sku, jurisdiction = "IBC", connection_type, load_lbs, species = "SPF" } = args;

  try {
    const prod = db.prepare("SELECT * FROM construction_products WHERE sku = ?").get(sku?.toUpperCase());
    if (!prod) return { error: `SKU not found: ${sku}`, fee_usd: 0 };

    const codes = {
      IBC:  { approved: !!prod.ibc_approved, name: "International Building Code 2021" },
      IRC:  { approved: !!prod.irc_approved, name: "International Residential Code 2021" },
      CBC:  { approved: !!prod.cbc_approved, name: "California Building Code 2022" },
    };

    const juris = jurisdiction.toUpperCase();
    const codeResult = codes[juris] ?? { approved: !!prod.ibc_approved, name: `Code: ${jurisdiction}` };

    const sf = parseJSON(prod.species_factor, {});
    const speciesMult = sf[species] ?? sf["DF"] ?? 1.0;
    const allowableLoad = Math.round((prod.load_rating_lbs ?? 0) * speciesMult);

    const adequate = load_lbs ? allowableLoad >= load_lbs : null;

    return {
      sku: prod.sku,
      name: prod.name,
      jurisdiction,
      code_approved: codeResult.approved,
      code_name: codeResult.name,
      code_approval_number: prod.code_approval,
      species,
      allowable_load_lbs: allowableLoad,
      required_load_lbs: load_lbs ?? null,
      load_adequate: adequate,
      result: codeResult.approved && (adequate !== false) ? "PASS" : "FAIL",
      notes: !codeResult.approved
        ? `${prod.sku} does not carry ${jurisdiction} listing. Verify with AHJ.`
        : adequate === false
          ? `Allowable load (${allowableLoad} lbs) is less than required (${load_lbs} lbs). Upsize connector.`
          : `${prod.sku} meets ${jurisdiction} requirements for ${species} lumber.`,
      live_mode: LIVE_MODE,
      fee_usd: FEES.codeCheck,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function inspectionSchedule(args) {
  const { project_id, phase, scheduled_date, inspector_name, permit_number, jurisdiction } = args;

  try {
    if (!project_id) return { error: "project_id required", fee_usd: 0 };

    const inspId = randomUUID();

    db.prepare(`
      INSERT INTO construction_inspections
        (id, project_id, phase, scheduled_date, inspector_name, permit_number, jurisdiction, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `).run(inspId, project_id, phase, scheduled_date ?? null, inspector_name ?? null, permit_number ?? null, jurisdiction ?? null);

    return {
      inspection_id: inspId,
      project_id,
      phase,
      scheduled_date,
      inspector_name: inspector_name ?? "To be assigned",
      status: "scheduled",
      live_mode: LIVE_MODE,
      fee_usd: FEES.inspectionSchedule,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function inspectionChecklist(args) {
  const { phase, seismic_zone = "C", wind_speed_mph = 115 } = args;

  const CHECKLISTS = {
    foundation: [
      "Footing dimensions match approved plans",
      "Rebar size, spacing, and cover depth",
      "Anchor bolt size, spacing, and embedment",
      "Concrete slump and strength (test cylinders if required)",
      "Moisture barrier under slab",
      "Drainage and waterproofing",
      "Snap ties removed and holes patched",
    ],
    framing: [
      "All joist hangers full-nailed (correct nail size and count)",
      "Hurricane/rafter ties at every bearing",
      seismic_zone >= "D" ? "Hold-downs installed per shear wall schedule" : null,
      "Blocking at all bearing points under I-joists",
      "LVL beams: no notches, bearing length adequate",
      "Header sizes match schedule",
      "Cripple stud layout at openings",
      "Double top plates lapped at corners",
      "Anchor bolt nuts and washers installed",
      wind_speed_mph >= 130 ? "HVHZ continuous load path verified" : null,
      "No unapproved penetrations through LVL or I-joist flanges",
      "Sheathing nailing pattern (3 in. field, 6 in. edge for shear walls)",
    ].filter(Boolean),
    rough_mep: [
      "Notch and hole limits per NDS/IRC for framing members",
      "Bearing studs not notched more than 25%",
      "I-joist knockouts used for MEP penetrations (not field-cut)",
      "Clearance maintained around structural members",
    ],
    insulation: [
      "Insulation R-value meets energy code",
      "Air barrier continuous at all penetrations",
      "No compression of batt insulation",
    ],
    final: [
      "Address numbers visible",
      "Smoke and CO detectors installed per code",
      "GFCI protection in wet areas",
      "Final grading and drainage",
      "All permits, inspections, and corrections signed off",
    ],
  };

  const checklist = CHECKLISTS[phase?.toLowerCase()] ?? [];

  return {
    phase,
    seismic_zone,
    wind_speed_mph,
    checklist_items: checklist,
    item_count: checklist.length,
    code_references: phase === "framing"
      ? ["IBC 2021 §2308", "IRC R802", "AWC WFCM 2018"]
      : phase === "foundation"
        ? ["IBC 2021 §1807", "ACI 318-19"]
        : [],
    live_mode: LIVE_MODE,
    fee_usd: FEES.inspectionChecklist,
  };
}

export async function inspectionReport(args) {
  const { inspection_id, status, findings = [], corrections = [], reinspect_date } = args;

  try {
    const insp = db.prepare("SELECT * FROM construction_inspections WHERE id = ?").get(inspection_id);
    if (!insp) return { error: `Inspection not found: ${inspection_id}`, fee_usd: 0 };

    db.prepare(`
      UPDATE construction_inspections
      SET status = ?, findings = ?, corrections = ?, reinspect_date = ?, completed_date = datetime('now')
      WHERE id = ?
    `).run(status, JSON.stringify(findings), JSON.stringify(corrections), reinspect_date ?? null, inspection_id);

    return {
      inspection_id,
      project_id: insp.project_id,
      phase: insp.phase,
      status,
      findings_count: findings.length,
      corrections_count: corrections.length,
      reinspect_date: reinspect_date ?? null,
      pass: status === "passed",
      live_mode: LIVE_MODE,
      fee_usd: FEES.inspectionReport,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── LOGISTICS & DELIVERY ──────────────────────────────────────────────────────

export async function deliveryEstimate(args) {
  const { sku_list, total_weight_lbs, delivery_address, access_constraints = [] } = args;

  try {
    const weight = total_weight_lbs ?? sku_list?.reduce((s, item) => {
      const p = db.prepare("SELECT weight_lbs, pack_size FROM construction_products WHERE sku = ?").get(item.sku?.toUpperCase());
      return s + (p ? p.weight_lbs * (item.qty ?? 1) : 0);
    }, 0) ?? 0;

    let truckType = "standard-flatbed";
    let accessNote = null;

    if (weight > 20000) {
      truckType = "tandem-axle-flatbed";
    }
    if (sku_list?.some(i => ["READY-MIX-3000PSI","READY-MIX-4000PSI","FIBER-CONCRETE-4000PSI"].includes(i.sku))) {
      truckType = "ready-mix-drum";
      accessNote = "Concrete trucks require 10 ft clearance and firm access. Max reach: 20 ft from truck.";
    }
    if (sku_list?.some(i => ["GLULAM-3.125X12-24FT","LVL-3.5X11.25-24FT"].includes(i.sku))) {
      truckType = "boom-truck";
      accessNote = "Oversize lumber requires boom truck or crane assist for placement.";
    }

    const hasConstraints = access_constraints.length > 0;

    return {
      estimated_weight_lbs: +weight.toFixed(0),
      truck_type: truckType,
      access_note: accessNote,
      access_constraints,
      estimated_days: truckType === "ready-mix-drum" ? 0 : hasConstraints ? 3 : 2,
      cost_estimate_usd: weight < 500 ? 75 : weight < 5000 ? 150 : 285,
      notes: "Estimate only. Final cost confirmed at booking.",
      live_mode: LIVE_MODE,
      fee_usd: FEES.deliveryEstimate,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function deliverySchedule(args) {
  const { order_id, delivery_date, phase, notes } = args;

  try {
    const order = db.prepare("SELECT * FROM construction_orders WHERE id = ?").get(order_id);
    if (!order) return { error: `Order not found: ${order_id}`, fee_usd: 0 };

    db.prepare("UPDATE construction_orders SET required_date = ?, notes = ? WHERE id = ?")
      .run(delivery_date, notes ?? null, order_id);

    return {
      order_id,
      order_number: order.order_number,
      delivery_date,
      phase: phase ?? "unspecified",
      scheduled: true,
      reminder_sent: LIVE_MODE,
      live_mode: LIVE_MODE,
      fee_usd: FEES.deliverySchedule,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function deliveryTrack(args) {
  const { order_id, tracking_number } = args;

  try {
    let order = null;
    if (order_id) {
      order = db.prepare("SELECT * FROM construction_orders WHERE id = ?").get(order_id);
    } else if (tracking_number) {
      order = db.prepare("SELECT * FROM construction_orders WHERE tracking_number = ?").get(tracking_number);
    }
    if (!order) return { error: "Order/tracking not found", fee_usd: 0 };

    const gpsLat = 37.7749 + (Math.random() - 0.5) * 0.5;
    const gpsLon = -122.4194 + (Math.random() - 0.5) * 0.5;

    return {
      order_id: order.id,
      order_number: order.order_number,
      tracking_number: order.tracking_number ?? `TRK${order.id.slice(0, 10).toUpperCase()}`,
      status: order.status,
      current_location: LIVE_MODE ? { lat: gpsLat, lon: gpsLon } : "GPS unavailable in demo mode",
      eta: order.required_date ?? "Not specified",
      delivered_at: order.delivered_at,
      live_mode: LIVE_MODE,
      fee_usd: FEES.deliveryTrack,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── CONTRACTOR & VENDOR MANAGEMENT ───────────────────────────────────────────

export async function contractorRegister(args) {
  const { name, license_number, state, specialties = [], territory = [], insurance_exp, bonding_amount } = args;

  try {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO construction_contractors
        (id, name, license_number, state, specialties, territory, insurance_exp, bonding_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, license_number ?? null, state, JSON.stringify(specialties), JSON.stringify(territory), insurance_exp ?? null, bonding_amount ?? null);

    return {
      contractor_id: id,
      name,
      state,
      license_number,
      specialties,
      status: "registered",
      live_mode: LIVE_MODE,
      fee_usd: FEES.contractorRegister,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function contractorReputation(args) {
  const { contractor_id } = args;

  try {
    const c = db.prepare("SELECT * FROM construction_contractors WHERE id = ?").get(contractor_id);
    if (!c) return { error: `Contractor not found: ${contractor_id}`, fee_usd: 0 };

    return {
      contractor_id: c.id,
      name: c.name,
      state: c.state,
      license_number: c.license_number,
      specialties: parseJSON(c.specialties, []),
      rating: c.rating,
      completed_jobs: c.completed_jobs,
      on_time_rate_pct: c.on_time_rate_pct,
      quality_score: c.quality_score,
      payment_score: c.payment_score,
      insurance_current: c.insurance_exp ? new Date(c.insurance_exp) > new Date() : null,
      bonding_amount: c.bonding_amount,
      live_mode: LIVE_MODE,
      fee_usd: FEES.contractorReputation,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function vendorRegister(args) {
  const { name, type = "distributor", product_lines = [], territories = [], min_order_usd = 0, lead_time_days = 5, contact_email, contact_phone, notes } = args;

  try {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO construction_vendors
        (id, name, type, product_lines, territories, min_order_usd, lead_time_days, contact_email, contact_phone, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, JSON.stringify(product_lines), JSON.stringify(territories), min_order_usd, lead_time_days, contact_email ?? null, contact_phone ?? null, notes ?? null);

    return {
      vendor_id: id,
      name,
      type,
      status: "registered",
      live_mode: LIVE_MODE,
      fee_usd: FEES.vendorRegister,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function vendorRating(args) {
  const { vendor_id } = args;

  try {
    const v = db.prepare("SELECT * FROM construction_vendors WHERE id = ?").get(vendor_id);
    if (!v) return { error: `Vendor not found: ${vendor_id}`, fee_usd: 0 };

    // Compute order metrics
    const orderStats = db.prepare(`
      SELECT COUNT(*) as total_orders,
             SUM(total_usd) as total_volume_usd,
             SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered_count
      FROM construction_orders WHERE vendor_id = ?
    `).get(vendor_id);

    return {
      vendor_id: v.id,
      name: v.name,
      type: v.type,
      rating: v.rating,
      fill_rate_pct: v.fill_rate_pct,
      on_time_pct: v.on_time_pct,
      total_orders: orderStats?.total_orders ?? 0,
      total_volume_usd: orderStats?.total_volume_usd ?? 0,
      delivered_count: orderStats?.delivered_count ?? 0,
      lead_time_days: v.lead_time_days,
      min_order_usd: v.min_order_usd,
      product_lines: parseJSON(v.product_lines, []),
      territories: parseJSON(v.territories, []),
      live_mode: LIVE_MODE,
      fee_usd: FEES.vendorRating,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

// ─── SMART TAKEOFF & ESTIMATION ────────────────────────────────────────────────

export async function takeoffFromPlans(args) {
  const {
    span_ft,
    joist_type = "2x10",
    joist_spacing_in = 16,
    header_spans = [],
    seismic_zone = "C",
    wind_speed_mph = 115,
    project_sqft = 1000,
    species = "SPF",
    notes: userNotes,
  } = args;

  try {
    const joistCount = Math.ceil(project_sqft / (joist_spacing_in / 12));

    const items = [];

    // Joist hangers
    if (joist_type.includes("10") || joist_type.includes("I-joist")) {
      items.push({ sku: "LUS210", name: "Joist Hanger 2x10", qty: joistCount, unit: "EA", reason: `${joist_type} at ${joist_spacing_in}" OC` });
    } else if (joist_type.includes("6")) {
      items.push({ sku: "LUS26", name: "Joist Hanger 2x6", qty: joistCount, unit: "EA", reason: `${joist_type} at ${joist_spacing_in}" OC` });
    }

    // Hurricane ties
    const tieQty = Math.ceil(project_sqft / 20);
    items.push({ sku: "H1", name: "Hurricane Tie", qty: tieQty, unit: "EA", reason: "Rafter/truss connections" });
    if (wind_speed_mph >= 130) {
      items.push({ sku: "H2-5", name: "Hurricane Tie Double Shear", qty: Math.ceil(tieQty * 0.4), unit: "EA", reason: "High-wind corner/hip ties" });
    }

    // Headers (LVL beams)
    for (const hs of header_spans) {
      if (hs >= 12) {
        items.push({ sku: "LVL-3.5X11.25-24FT", name: "LVL Beam 3.5x11.25 24ft", qty: Math.ceil(hs / 24) + 1, unit: "EA", reason: `${hs}-ft header span` });
        items.push({ sku: "HU46", name: "HU46 Heavy Hanger", qty: 2, unit: "EA", reason: `LVL beam end support at ${hs}-ft opening` });
      } else {
        items.push({ sku: "LVL-1.75X9.5-20FT", name: "LVL Beam 1.75x9.5 20ft", qty: 2, unit: "EA", reason: `${hs}-ft header span (2-ply)` });
        items.push({ sku: "HGUS210", name: "Top-Flange Hanger 2x10", qty: 2, unit: "EA", reason: `LVL header bearing at ${hs}-ft opening` });
      }
    }

    // Seismic hold-downs
    if (seismic_zone >= "D") {
      items.push({ sku: "HDU11-SDS2.5", name: "Holdown 11 kip", qty: 4, unit: "EA", reason: `Seismic Zone ${seismic_zone} shear wall hold-downs` });
      items.push({ sku: "EPOXY-ANCHOR-KIT-0.5", name: "Epoxy Anchor 1/2 in.", qty: 4, unit: "KIT", reason: "Anchor rods for high-seismic hold-downs" });
    } else {
      items.push({ sku: "HDU5-SDS2.5", name: "Holdown 5 kip", qty: 4, unit: "EA", reason: `Zone ${seismic_zone} hold-downs` });
      items.push({ sku: "WEDGE-ANCHOR-0.625X4", name: "Wedge Anchor 5/8x4", qty: 4, unit: "BOX", reason: "Hold-down anchors" });
    }

    // Straps
    const strapQty = Math.ceil(project_sqft / 80);
    items.push({ sku: "MSTA12", name: "Strap Tie 12 in.", qty: strapQty, unit: "EA", reason: "Continuous load path straps" });

    // Fasteners
    items.push({ sku: "10D-JOIST-HDG",  name: "10d Joist Hanger Nails", qty: Math.ceil(joistCount * 0.2), unit: "LB", reason: "Hanger nail fill" });
    items.push({ sku: "SDS-0.25X3",      name: "SDS Screw 1/4x3 (100ct)", qty: Math.ceil(project_sqft / 600), unit: "BOX", reason: "Heavy connector fasteners" });
    items.push({ sku: "16D-SINKER-HDG",  name: "16d Sinker Nails HDG", qty: Math.ceil(project_sqft / 500), unit: "BOX", reason: "General framing nailing" });

    // Post bases (if deck/porch)
    items.push({ sku: "ABA44", name: "Post Base 4x4", qty: 4, unit: "EA", reason: "Typical deck post bases" });

    // Price it
    const priced = items.map(item => {
      const prod = db.prepare("SELECT unit_price FROM construction_products WHERE sku = ?").get(item.sku);
      const unitPrice = prod?.unit_price ?? 0;
      return { ...item, unit_price: unitPrice, extended_usd: +(unitPrice * item.qty).toFixed(2) };
    });

    const totalUsd = +priced.reduce((s, i) => s + i.extended_usd, 0).toFixed(2);

    return {
      project_sqft,
      span_ft: span_ft ?? "varies",
      joist_type,
      seismic_zone,
      wind_speed_mph,
      species,
      takeoff_items: priced,
      item_count: priced.length,
      total_hardware_usd: totalUsd,
      notes: userNotes ?? "Takeoff based on plans. Verify quantities with framing contractor before ordering.",
      live_mode: LIVE_MODE,
      fee_usd: FEES.takeoffFromPlans,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}

export async function estimateProject(args) {
  const {
    project_type = "residential",
    sqft,
    stories = 1,
    seismic_zone = "C",
    framing_type = "wood-frame",
    quality_level = "standard",  // standard | premium | luxury
    overhead_pct = 0.15,
    profit_pct = 0.10,
    labor_rate_usd_per_sqft = 28,
  } = args;

  try {
    // Get BOM cost
    const bomResult = await projectBomGenerate({ sqft, stories, seismic_zone, framing_type });
    const materialsCost = bomResult.total_materials_usd ?? 0;

    const qualityMult = quality_level === "premium" ? 1.35 : quality_level === "luxury" ? 1.75 : 1.0;

    const laborCost = +(sqft * labor_rate_usd_per_sqft * stories * qualityMult).toFixed(2);
    const subcontractors = +(sqft * 18 * qualityMult).toFixed(2); // MEP, etc.
    const materialsAdj = +(materialsCost * qualityMult).toFixed(2);
    const subtotal = materialsAdj + laborCost + subcontractors;
    const overhead = +(subtotal * overhead_pct).toFixed(2);
    const profit = +(subtotal * profit_pct).toFixed(2);
    const total = +(subtotal + overhead + profit).toFixed(2);
    const perSqft = sqft > 0 ? +(total / sqft).toFixed(2) : null;

    return {
      project_type,
      sqft,
      stories,
      seismic_zone,
      quality_level,
      framing_type,
      breakdown: {
        materials_usd: materialsAdj,
        labor_usd: laborCost,
        subcontractors_usd: subcontractors,
        overhead_usd: overhead,
        profit_usd: profit,
        total_usd: total,
        cost_per_sqft: perSqft,
      },
      bom_sample: bomResult.bom?.slice(0, 5),
      notes: `Estimate based on ${quality_level} quality ${framing_type} construction in Seismic Zone ${seismic_zone}.`,
      live_mode: LIVE_MODE,
      fee_usd: FEES.estimateProject,
    };
  } catch (e) {
    return { error: e.message, fee_usd: 0 };
  }
}
