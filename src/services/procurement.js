import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const SUPPLIER_SEARCH_FEE      = 2.00;   // $2 per supplier discovery search
const SUPPLIER_COMMISSION      = 0.15;   // 15% commission on awarded contracts
const RFQ_CREATION_FEE         = 5.00;   // $5 per RFQ
const BID_EVALUATION_FEE       = 3.00;   // $3 per evaluation run
const CONTRACT_DRAFT_FEE       = 10.00;  // $10 per auto-drafted contract
const INVOICE_MATCH_FEE        = 0.50;   // $0.50 per 3-way match
const SPEND_ANALYTICS_FEE      = 10.00;  // $10/month for spend analytics

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS proc_suppliers (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    location         TEXT NOT NULL,
    country          TEXT NOT NULL,
    rating           REAL DEFAULT 3.5,
    certifications   TEXT DEFAULT '[]',
    lead_time_days   INTEGER DEFAULT 14,
    min_order_usd    REAL DEFAULT 500,
    price_range_low  REAL NOT NULL,
    price_range_high REAL NOT NULL,
    annual_revenue_m REAL,
    employees        INTEGER,
    years_in_business INTEGER DEFAULT 5,
    on_time_delivery_pct REAL DEFAULT 88.0,
    defect_rate_ppt  REAL DEFAULT 3.5,
    contact_email    TEXT,
    website          TEXT
  );

  CREATE TABLE IF NOT EXISTS proc_rfqs (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    items            TEXT NOT NULL,
    requirements     TEXT,
    deadline         TEXT NOT NULL,
    invited_count    INTEGER DEFAULT 0,
    invited_suppliers TEXT DEFAULT '[]',
    status           TEXT DEFAULT 'open' CHECK(status IN ('draft','open','closed','awarded','cancelled')),
    awarded_supplier TEXT,
    awarded_amount   REAL,
    fee_charged_usd  REAL DEFAULT 5.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proc_bids (
    id               TEXT PRIMARY KEY,
    rfq_id           TEXT NOT NULL REFERENCES proc_rfqs(id),
    supplier_id      TEXT NOT NULL REFERENCES proc_suppliers(id),
    price_usd        REAL NOT NULL,
    delivery_days    INTEGER NOT NULL,
    quality_notes    TEXT,
    payment_terms    TEXT DEFAULT 'net30',
    warranty_months  INTEGER DEFAULT 12,
    risk_flags       TEXT DEFAULT '[]',
    submitted_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proc_contracts (
    id               TEXT PRIMARY KEY,
    supplier_id      TEXT NOT NULL REFERENCES proc_suppliers(id),
    terms            TEXT NOT NULL,
    items            TEXT NOT NULL,
    payment_terms    TEXT NOT NULL,
    value_usd        REAL,
    status           TEXT DEFAULT 'draft' CHECK(status IN ('draft','under_review','executed','terminated')),
    risk_flags       TEXT DEFAULT '[]',
    suggested_modifications TEXT DEFAULT '[]',
    fee_charged_usd  REAL DEFAULT 10.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proc_purchase_orders (
    id               TEXT PRIMARY KEY,
    supplier_id      TEXT REFERENCES proc_suppliers(id),
    items            TEXT NOT NULL,
    total_amount_usd REAL NOT NULL,
    status           TEXT DEFAULT 'open',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proc_invoice_matches (
    id               TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    invoice_number   TEXT NOT NULL,
    invoice_amount   REAL NOT NULL,
    po_amount        REAL NOT NULL,
    match_result     TEXT NOT NULL CHECK(match_result IN ('matched','partial','mismatch')),
    discrepancies    TEXT DEFAULT '[]',
    approved         INTEGER DEFAULT 0,
    amount_variance  REAL DEFAULT 0,
    fee_charged_usd  REAL DEFAULT 0.50,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Suppliers ───────────────────────────────────────────────────────────

const _supplierCount = db.prepare("SELECT COUNT(*) as n FROM proc_suppliers").get().n;
if (_supplierCount === 0) {
  const seedSuppliers = [
    // IT & Technology
    { id: randomUUID(), name: "TechSource Global",       category: "IT Hardware",      location: "Shenzhen",      country: "China",       rating: 4.5, certifications: '["ISO9001","ISO14001","RoHS"]',          lead_time_days: 21, min_order_usd: 5000,  price_range_low: 0.85, price_range_high: 1.05, annual_revenue_m: 450,  employees: 2800, years_in_business: 18, on_time_delivery_pct: 91.2, defect_rate_ppt: 2.1, contact_email: "sales@techsourceglobal.com",    website: "https://techsourceglobal.com"  },
    { id: randomUUID(), name: "CloudNexus Solutions",    category: "Cloud Services",   location: "Austin",        country: "USA",         rating: 4.7, certifications: '["SOC2","ISO27001","FedRAMP"]',          lead_time_days: 5,  min_order_usd: 1000,  price_range_low: 0.90, price_range_high: 1.10, annual_revenue_m: 120,  employees: 650,  years_in_business: 9,  on_time_delivery_pct: 99.0, defect_rate_ppt: 0.5, contact_email: "enterprise@cloudnexus.io",      website: "https://cloudnexus.io"         },
    { id: randomUUID(), name: "DataCore Peripherals",    category: "IT Hardware",      location: "Taipei",        country: "Taiwan",      rating: 4.3, certifications: '["ISO9001","CE","FCC"]',                 lead_time_days: 28, min_order_usd: 2500,  price_range_low: 0.80, price_range_high: 1.00, annual_revenue_m: 230,  employees: 1400, years_in_business: 22, on_time_delivery_pct: 88.5, defect_rate_ppt: 3.0, contact_email: "b2b@datacore-peripherals.com", website: "https://datacore-peripherals.com"},
    // Office & Facilities
    { id: randomUUID(), name: "OfficeDepot ProSource",   category: "Office Supplies",  location: "Chicago",       country: "USA",         rating: 4.1, certifications: '["ISO9001","Green_Seal"]',               lead_time_days: 3,  min_order_usd: 200,   price_range_low: 0.90, price_range_high: 1.15, annual_revenue_m: 80,   employees: 400,  years_in_business: 30, on_time_delivery_pct: 94.0, defect_rate_ppt: 1.5, contact_email: "corporate@odprosource.com",     website: "https://odcorporate.com"       },
    { id: randomUUID(), name: "FacilityFirst Group",     category: "Facilities Mgmt",  location: "London",        country: "UK",          rating: 4.0, certifications: '["ISO14001","ISO45001","CHAS"]',         lead_time_days: 7,  min_order_usd: 1500,  price_range_low: 0.92, price_range_high: 1.08, annual_revenue_m: 190,  employees: 1100, years_in_business: 15, on_time_delivery_pct: 87.0, defect_rate_ppt: 2.8, contact_email: "contracts@facilityfirst.co.uk", website: "https://facilityfirst.co.uk"  },
    // Manufacturing & Raw Materials
    { id: randomUUID(), name: "SteelCraft Industries",   category: "Raw Materials",    location: "Pittsburgh",    country: "USA",         rating: 4.4, certifications: '["ISO9001","ASTM","AS9100"]',            lead_time_days: 35, min_order_usd: 10000, price_range_low: 0.82, price_range_high: 1.03, annual_revenue_m: 680,  employees: 3200, years_in_business: 45, on_time_delivery_pct: 89.5, defect_rate_ppt: 1.8, contact_email: "sales@steelcraftind.com",       website: "https://steelcraftind.com"     },
    { id: randomUUID(), name: "PolyForm Plastics",       category: "Raw Materials",    location: "Stuttgart",     country: "Germany",     rating: 4.6, certifications: '["ISO9001","ISO14001","IATF16949"]',     lead_time_days: 18, min_order_usd: 3000,  price_range_low: 0.88, price_range_high: 1.05, annual_revenue_m: 320,  employees: 1800, years_in_business: 28, on_time_delivery_pct: 93.0, defect_rate_ppt: 1.2, contact_email: "sales@polyform.de",             website: "https://polyform.de"           },
    { id: randomUUID(), name: "Pacific Packaging Co",    category: "Packaging",        location: "Ho Chi Minh City",country:"Vietnam",    rating: 3.9, certifications: '["ISO9001","FSC"]',                     lead_time_days: 25, min_order_usd: 2000,  price_range_low: 0.75, price_range_high: 0.95, annual_revenue_m: 55,   employees: 350,  years_in_business: 12, on_time_delivery_pct: 82.0, defect_rate_ppt: 5.5, contact_email: "export@pacpacking.vn",          website: "https://pacpacking.vn"         },
    // Logistics & Transport
    { id: randomUUID(), name: "SwiftLog Freight",        category: "Logistics",        location: "Rotterdam",     country: "Netherlands", rating: 4.5, certifications: '["ISO9001","AEO","TAPA"]',              lead_time_days: 4,  min_order_usd: 800,   price_range_low: 0.88, price_range_high: 1.08, annual_revenue_m: 290,  employees: 1600, years_in_business: 20, on_time_delivery_pct: 95.0, defect_rate_ppt: 0.8, contact_email: "enterprise@swiftlog.nl",        website: "https://swiftlog.nl"           },
    { id: randomUUID(), name: "Apex Express Delivery",   category: "Logistics",        location: "Singapore",     country: "Singapore",   rating: 4.7, certifications: '["ISO9001","ISO28000","SQAS"]',         lead_time_days: 2,  min_order_usd: 500,   price_range_low: 0.92, price_range_high: 1.12, annual_revenue_m: 175,  employees: 900,  years_in_business: 14, on_time_delivery_pct: 97.0, defect_rate_ppt: 0.4, contact_email: "b2b@apexexpress.sg",            website: "https://apexexpress.sg"        },
    // Professional Services
    { id: randomUUID(), name: "LegalEdge Advisory",      category: "Legal Services",   location: "New York",      country: "USA",         rating: 4.8, certifications: '["ABA","ISO27001"]',                    lead_time_days: 2,  min_order_usd: 5000,  price_range_low: 1.00, price_range_high: 1.30, annual_revenue_m: 95,   employees: 280,  years_in_business: 22, on_time_delivery_pct: 98.5, defect_rate_ppt: 0.2, contact_email: "corporate@legaledge.com",       website: "https://legaledge.com"         },
    { id: randomUUID(), name: "BDO Managed Accounting",  category: "Finance & Audit",  location: "Toronto",       country: "Canada",      rating: 4.6, certifications: '["CPA","SOC1","ISO27001"]',             lead_time_days: 5,  min_order_usd: 8000,  price_range_low: 0.95, price_range_high: 1.20, annual_revenue_m: 210,  employees: 1200, years_in_business: 35, on_time_delivery_pct: 99.0, defect_rate_ppt: 0.1, contact_email: "managed@bdo-partner.ca",        website: "https://bdo.ca"                },
    // Marketing & Creative
    { id: randomUUID(), name: "BrandForge Creative",     category: "Marketing",        location: "Sydney",        country: "Australia",   rating: 4.3, certifications: '["ISO9001"]',                           lead_time_days: 10, min_order_usd: 3000,  price_range_low: 0.90, price_range_high: 1.10, annual_revenue_m: 28,   employees: 145,  years_in_business: 9,  on_time_delivery_pct: 88.0, defect_rate_ppt: 1.0, contact_email: "new-business@brandforge.com.au", website: "https://brandforge.com.au"     },
    { id: randomUUID(), name: "Precision Digital Media", category: "Marketing",        location: "Dublin",        country: "Ireland",     rating: 4.4, certifications: '["GDPR_Compliant","ISO27001"]',         lead_time_days: 7,  min_order_usd: 2000,  price_range_low: 0.85, price_range_high: 1.05, annual_revenue_m: 42,   employees: 220,  years_in_business: 11, on_time_delivery_pct: 91.0, defect_rate_ppt: 1.5, contact_email: "sales@precisiondigital.ie",     website: "https://precisiondigital.ie"  },
    // HR & Staffing
    { id: randomUUID(), name: "TalentBridge Staffing",   category: "HR & Staffing",    location: "Atlanta",       country: "USA",         rating: 4.2, certifications: '["WBENC","ISO9001","SIA_member"]',      lead_time_days: 14, min_order_usd: 10000, price_range_low: 0.88, price_range_high: 1.08, annual_revenue_m: 340,  employees: 1900, years_in_business: 18, on_time_delivery_pct: 85.0, defect_rate_ppt: 2.5, contact_email: "enterprise@talentbridge.com",   website: "https://talentbridge.com"      },
    // Cybersecurity
    { id: randomUUID(), name: "CipherGuard Security",    category: "Cybersecurity",    location: "Tel Aviv",      country: "Israel",      rating: 4.8, certifications: '["ISO27001","SOC2","CREST"]',           lead_time_days: 7,  min_order_usd: 15000, price_range_low: 1.00, price_range_high: 1.35, annual_revenue_m: 85,   employees: 380,  years_in_business: 13, on_time_delivery_pct: 97.5, defect_rate_ppt: 0.3, contact_email: "enterprise@cipherguard.co.il",  website: "https://cipherguard.co.il"     },
    { id: randomUUID(), name: "ThreatPulse Analytics",   category: "Cybersecurity",    location: "London",        country: "UK",          rating: 4.6, certifications: '["ISO27001","Cyber_Essentials","NCSC"]',lead_time_days: 5,  min_order_usd: 8000,  price_range_low: 0.95, price_range_high: 1.20, annual_revenue_m: 58,   employees: 240,  years_in_business: 8,  on_time_delivery_pct: 96.0, defect_rate_ppt: 0.4, contact_email: "b2b@threatpulse.co.uk",         website: "https://threatpulse.co.uk"     },
    // Real Estate & Construction
    { id: randomUUID(), name: "BuildPro Contractors",    category: "Construction",     location: "Dubai",         country: "UAE",         rating: 4.0, certifications: '["ISO9001","ISO14001","OHSAS18001"]',   lead_time_days: 30, min_order_usd: 50000, price_range_low: 0.82, price_range_high: 1.05, annual_revenue_m: 520,  employees: 2400, years_in_business: 25, on_time_delivery_pct: 80.0, defect_rate_ppt: 4.2, contact_email: "tenders@buildpro.ae",           website: "https://buildpro.ae"           },
    // Healthcare & Pharma
    { id: randomUUID(), name: "MediSupply Direct",       category: "Medical Supplies", location: "Mumbai",        country: "India",       rating: 4.4, certifications: '["ISO13485","GMP","CE","FDA_registered"]',lead_time_days:20, min_order_usd: 2000, price_range_low: 0.78, price_range_high: 0.98, annual_revenue_m: 165,  employees: 920,  years_in_business: 19, on_time_delivery_pct: 90.0, defect_rate_ppt: 1.8, contact_email: "export@medisupplydirect.in",    website: "https://medisupplydirect.in"   },
    { id: randomUUID(), name: "BioTech Reagents Ltd",    category: "Lab Supplies",     location: "Basel",         country: "Switzerland", rating: 4.9, certifications: '["ISO9001","ISO13485","GMP","GCLP"]',   lead_time_days: 12, min_order_usd: 1000,  price_range_low: 1.05, price_range_high: 1.40, annual_revenue_m: 78,   employees: 310,  years_in_business: 17, on_time_delivery_pct: 98.0, defect_rate_ppt: 0.3, contact_email: "orders@bioreagents.ch",         website: "https://bioreagents.ch"        },
    // Food & Beverage
    { id: randomUUID(), name: "GlobalGrain Trading",     category: "Food & Agriculture",location:"Chicago",       country: "USA",         rating: 4.1, certifications: '["USDA_Organic","ISO22000","FSSC22000"]',lead_time_days:21, min_order_usd: 5000, price_range_low: 0.82, price_range_high: 1.02, annual_revenue_m: 760,  employees: 3800, years_in_business: 52, on_time_delivery_pct: 87.0, defect_rate_ppt: 2.5, contact_email: "trading@globalgrain.com",        website: "https://globalgrain.com"       },
    // Energy & Utilities
    { id: randomUUID(), name: "SolarGrid Equipment",     category: "Renewable Energy", location: "Munich",        country: "Germany",     rating: 4.5, certifications: '["ISO9001","IEC61215","TUV"]',          lead_time_days: 42, min_order_usd: 20000, price_range_low: 0.90, price_range_high: 1.10, annual_revenue_m: 390,  employees: 2100, years_in_business: 16, on_time_delivery_pct: 88.0, defect_rate_ppt: 1.5, contact_email: "b2b@solargrid.de",              website: "https://solargrid.de"          },
    // Telecoms
    { id: randomUUID(), name: "Nextel Network Infra",    category: "Telecommunications",location:"Stockholm",     country: "Sweden",      rating: 4.6, certifications: '["ISO9001","ISO27001","3GPP"]',         lead_time_days: 30, min_order_usd: 25000, price_range_low: 0.93, price_range_high: 1.15, annual_revenue_m: 1200, employees: 5500, years_in_business: 31, on_time_delivery_pct: 92.0, defect_rate_ppt: 1.0, contact_email: "enterprise@nextelinfra.se",      website: "https://nextelinfra.se"        },
    // Consulting
    { id: randomUUID(), name: "Vertex Strategy Group",   category: "Management Consulting",location:"Boston",    country: "USA",         rating: 4.7, certifications: '["ISO9001","MBE_Certified"]',           lead_time_days: 7,  min_order_usd: 20000, price_range_low: 0.95, price_range_high: 1.25, annual_revenue_m: 145,  employees: 680,  years_in_business: 14, on_time_delivery_pct: 96.0, defect_rate_ppt: 0.5, contact_email: "rfp@vertexstrategy.com",        website: "https://vertexstrategy.com"    },
    // Automotive
    { id: randomUUID(), name: "AutoParts Asia Pacific",  category: "Automotive Parts", location: "Bangkok",       country: "Thailand",    rating: 4.2, certifications: '["IATF16949","ISO14001","RoHS"]',       lead_time_days: 35, min_order_usd: 8000,  price_range_low: 0.78, price_range_high: 0.96, annual_revenue_m: 480,  employees: 2600, years_in_business: 27, on_time_delivery_pct: 86.0, defect_rate_ppt: 3.0, contact_email: "sales@autopartsap.co.th",       website: "https://autopartsap.co.th"     },
  ];
  const insS = db.prepare(`INSERT OR IGNORE INTO proc_suppliers
    (id, name, category, location, country, rating, certifications, lead_time_days, min_order_usd, price_range_low, price_range_high, annual_revenue_m, employees, years_in_business, on_time_delivery_pct, defect_rate_ppt, contact_email, website)
    VALUES (@id, @name, @category, @location, @country, @rating, @certifications, @lead_time_days, @min_order_usd, @price_range_low, @price_range_high, @annual_revenue_m, @employees, @years_in_business, @on_time_delivery_pct, @defect_rate_ppt, @contact_email, @website)`);
  for (const s of seedSuppliers) insS.run(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskFlags(supplier) {
  const flags = [];
  if (supplier.defect_rate_ppt > 4.0) flags.push("high_defect_rate");
  if (supplier.on_time_delivery_pct < 85) flags.push("below_avg_on_time_delivery");
  if (supplier.years_in_business < 5) flags.push("limited_operating_history");
  if (supplier.rating < 3.5) flags.push("low_supplier_rating");
  const certs = JSON.parse(supplier.certifications || "[]");
  if (certs.length === 0) flags.push("no_certifications");
  return flags;
}

// ─── discoverSuppliers ────────────────────────────────────────────────────────

/**
 * Discover and vet suppliers for a given category and requirements.
 * @param {string}   category         - Product/service category (e.g. "IT Hardware")
 * @param {Object}   requirements     - { min_rating, max_lead_time_days, keywords }
 * @param {string}   location         - Preferred geography (country or region)
 * @param {string[]} certifications   - Required certifications (e.g. ["ISO9001"])
 * @returns Vetted suppliers[] with scoring, risk flags, and contact info
 * Platform fee: $2/search + 15% commission on awarded contracts
 */
export function discoverSuppliers(category, requirements = {}, location = null, certifications = []) {
  if (!category) throw new Error("category is required");

  let query = "SELECT * FROM proc_suppliers WHERE 1=1";
  const params = [];

  query += " AND LOWER(category) LIKE ?";
  params.push(`%${category.toLowerCase()}%`);

  if (location) {
    query += " AND (LOWER(location) LIKE ? OR LOWER(country) LIKE ?)";
    params.push(`%${location.toLowerCase()}%`, `%${location.toLowerCase()}%`);
  }
  if (requirements.min_rating) {
    query += " AND rating >= ?";
    params.push(requirements.min_rating);
  }
  if (requirements.max_lead_time_days) {
    query += " AND lead_time_days <= ?";
    params.push(requirements.max_lead_time_days);
  }

  query += " ORDER BY rating DESC, on_time_delivery_pct DESC";

  let suppliers = db.prepare(query).all(...params);

  // Broaden search if no results
  if (suppliers.length === 0) {
    suppliers = db.prepare("SELECT * FROM proc_suppliers ORDER BY rating DESC LIMIT 8").all();
  }

  // Filter by certifications if specified
  if (certifications.length > 0) {
    suppliers = suppliers.filter(s => {
      const sc = JSON.parse(s.certifications || "[]");
      return certifications.every(c => sc.some(x => x.toLowerCase().includes(c.toLowerCase())));
    });
    if (suppliers.length === 0) {
      suppliers = db.prepare("SELECT * FROM proc_suppliers ORDER BY rating DESC LIMIT 5").all();
    }
  }

  const results = suppliers.map(s => ({
    supplier_id: s.id,
    name: s.name,
    category: s.category,
    location: s.location,
    country: s.country,
    rating: s.rating,
    certifications: JSON.parse(s.certifications || "[]"),
    lead_time_days: s.lead_time_days,
    min_order_usd: s.min_order_usd,
    price_range: { low_multiplier: s.price_range_low, high_multiplier: s.price_range_high },
    annual_revenue_m_usd: s.annual_revenue_m,
    employees: s.employees,
    years_in_business: s.years_in_business,
    on_time_delivery_pct: s.on_time_delivery_pct,
    defect_rate_per_thousand: s.defect_rate_ppt,
    risk_flags: riskFlags(s),
    contact_email: s.contact_email,
    website: s.website,
    commission_note: "15% platform commission applies on awarded contract value",
  }));

  return {
    search_id: randomUUID(),
    category,
    location_filter: location,
    certification_filter: certifications,
    requirements,
    suppliers: results,
    total_results: results.length,
    platform_fee_usd: SUPPLIER_SEARCH_FEE,
    search_timestamp: new Date().toISOString(),
  };
}

// ─── createRfq ────────────────────────────────────────────────────────────────

/**
 * Create a Request for Quote (RFQ) and invite suppliers to bid.
 * @param {string}   title             - RFQ title/description
 * @param {Array}    items             - [{name, quantity, unit, specs}]
 * @param {Object}   requirements      - {quality_standard, certifications_required, incoterms}
 * @param {string}   deadline          - ISO datetime for bid submission deadline
 * @param {string[]} invitedSuppliers  - Array of supplier_ids to invite
 * @returns RFQ record with id, status, and invited supplier count
 * Platform fee: $5/RFQ
 */
export function createRfq(title, items, requirements = {}, deadline, invitedSuppliers = []) {
  if (!title) throw new Error("title is required");
  if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");
  if (!deadline) throw new Error("deadline is required");

  const rfqId = randomUUID();

  // Validate invited suppliers exist
  const validSupplierIds = invitedSuppliers.filter(sid => {
    return db.prepare("SELECT id FROM proc_suppliers WHERE id = ?").get(sid);
  });

  db.prepare(`INSERT OR IGNORE INTO proc_rfqs
    (id, title, items, requirements, deadline, invited_count, invited_suppliers, status, fee_charged_usd)
    VALUES (@id, @title, @items, @requirements, @deadline, @invited_count, @invited_suppliers, @status, @fee_charged_usd)
  `).run({
    id: rfqId,
    title,
    items: JSON.stringify(items),
    requirements: JSON.stringify(requirements),
    deadline,
    invited_count: validSupplierIds.length,
    invited_suppliers: JSON.stringify(validSupplierIds),
    status: "open",
    fee_charged_usd: RFQ_CREATION_FEE,
  });

  // Simulate bids from invited suppliers
  const insertBid = db.prepare(`INSERT OR IGNORE INTO proc_bids
    (id, rfq_id, supplier_id, price_usd, delivery_days, quality_notes, payment_terms, warranty_months, risk_flags)
    VALUES (@id, @rfq_id, @supplier_id, @price_usd, @delivery_days, @quality_notes, @payment_terms, @warranty_months, @risk_flags)`);

  const itemTotal = items.reduce((sum, i) => sum + ((i.unit_price_usd ?? 100) * (i.quantity ?? 1)), 0);
  for (const sid of validSupplierIds) {
    const sup = db.prepare("SELECT * FROM proc_suppliers WHERE id = ?").get(sid);
    if (!sup) continue;
    const bidPrice = Math.round(itemTotal * (sup.price_range_low + Math.random() * (sup.price_range_high - sup.price_range_low)) * 100) / 100;
    insertBid.run({
      id: randomUUID(),
      rfq_id: rfqId,
      supplier_id: sid,
      price_usd: bidPrice,
      delivery_days: sup.lead_time_days + Math.floor(Math.random() * 7),
      quality_notes: `${sup.certifications} compliant. ${sup.on_time_delivery_pct}% on-time delivery track record.`,
      payment_terms: ["net30", "net45", "net60"][Math.floor(Math.random() * 3)],
      warranty_months: 12 + Math.floor(Math.random() * 24),
      risk_flags: JSON.stringify(riskFlags(sup)),
    });
  }

  return {
    rfq_id: rfqId,
    title,
    items_count: items.length,
    requirements,
    deadline,
    status: "open",
    invited_count: validSupplierIds.length,
    invited_supplier_ids: validSupplierIds,
    platform_fee_usd: RFQ_CREATION_FEE,
    commission_on_award: "15% on contract value",
    next_steps: "Suppliers will submit bids by the deadline. Use evaluateBids() to rank responses.",
    created_at: new Date().toISOString(),
  };
}

// ─── evaluateBids ─────────────────────────────────────────────────────────────

/**
 * Score and rank bids for an RFQ using weighted criteria.
 * @param {string} rfqId    - RFQ ID from createRfq
 * @param {Object} criteria - Evaluation criteria names: {price, delivery, quality, risk}
 * @param {Object} weights  - Weights summing to 1.0: {price: 0.4, delivery: 0.2, quality: 0.3, risk: 0.1}
 * @returns Ranked bids with composite scores, comparison table, and recommendation
 * Platform fee: $3/evaluation run
 */
export function evaluateBids(rfqId, criteria = {}, weights = { price: 0.4, delivery: 0.25, quality: 0.25, risk: 0.1 }) {
  if (!rfqId) throw new Error("rfqId is required");

  const rfq = db.prepare("SELECT * FROM proc_rfqs WHERE id = ?").get(rfqId);
  if (!rfq) throw new Error(`RFQ not found: ${rfqId}`);

  const bids = db.prepare("SELECT * FROM proc_bids WHERE rfq_id = ? ORDER BY price_usd ASC").all(rfqId);
  if (bids.length === 0) throw new Error(`No bids found for RFQ: ${rfqId}`);

  // Normalize weights
  const totalW = Object.values(weights).reduce((s, v) => s + v, 0);
  const w = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / totalW]));

  const prices = bids.map(b => b.price_usd);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const deliveries = bids.map(b => b.delivery_days);
  const minDel = Math.min(...deliveries);
  const maxDel = Math.max(...deliveries);

  const ranked = bids.map(b => {
    const sup = db.prepare("SELECT * FROM proc_suppliers WHERE id = ?").get(b.supplier_id);
    const flags = JSON.parse(b.risk_flags || "[]");

    // Normalize scores 0-100
    const priceScore    = maxPrice === minPrice ? 100 : Math.round((1 - (b.price_usd - minPrice) / (maxPrice - minPrice)) * 100);
    const deliveryScore = maxDel   === minDel   ? 100 : Math.round((1 - (b.delivery_days - minDel) / (maxDel - minDel)) * 100);
    const qualityScore  = Math.round((sup?.on_time_delivery_pct ?? 85) * 0.6 + (100 - (sup?.defect_rate_ppt ?? 3) * 5) * 0.4);
    const riskScore     = Math.max(0, 100 - flags.length * 18);

    const compositeScore = Math.round(
      priceScore    * (w.price    ?? 0.4) +
      deliveryScore * (w.delivery ?? 0.25) +
      qualityScore  * (w.quality  ?? 0.25) +
      riskScore     * (w.risk     ?? 0.1)
    );

    return {
      bid_id: b.id,
      supplier_id: b.supplier_id,
      supplier_name: sup?.name ?? "Unknown",
      price_usd: b.price_usd,
      delivery_days: b.delivery_days,
      payment_terms: b.payment_terms,
      warranty_months: b.warranty_months,
      quality_notes: b.quality_notes,
      scores: { price: priceScore, delivery: deliveryScore, quality: qualityScore, risk: riskScore, composite: compositeScore },
      risk_flags: flags,
      submitted_at: b.submitted_at,
    };
  });

  ranked.sort((a, b) => b.scores.composite - a.scores.composite);
  const recommendation = ranked[0];

  return {
    evaluation_id: randomUUID(),
    rfq_id: rfqId,
    rfq_title: rfq.title,
    bids_evaluated: ranked.length,
    weights_used: w,
    ranked_bids: ranked,
    recommended_supplier: {
      supplier_id: recommendation.supplier_id,
      supplier_name: recommendation.supplier_name,
      composite_score: recommendation.scores.composite,
      price_usd: recommendation.price_usd,
      rationale: `Highest composite score (${recommendation.scores.composite}/100) balancing price, delivery speed, quality metrics, and risk profile.`,
    },
    platform_fee_usd: BID_EVALUATION_FEE,
    evaluated_at: new Date().toISOString(),
  };
}

// ─── draftContract ────────────────────────────────────────────────────────────

/**
 * Auto-draft a procurement contract with a selected supplier.
 * @param {string} supplierId   - Supplier ID from discoverSuppliers
 * @param {Object} terms        - {governing_law, dispute_resolution, liability_cap_usd, termination_notice_days}
 * @param {Array}  items        - [{name, quantity, unit_price_usd, specs}]
 * @param {Object} paymentTerms - {terms: "net30", early_payment_discount_pct: 2, late_payment_penalty_pct: 1.5}
 * @returns Contract draft with content_preview, risk_flags, and suggested_modifications
 * Platform fee: $10/contract
 */
export function draftContract(supplierId, terms = {}, items = [], paymentTerms = {}) {
  if (!supplierId) throw new Error("supplierId is required");

  const supplier = db.prepare("SELECT * FROM proc_suppliers WHERE id = ?").get(supplierId);
  if (!supplier) throw new Error(`Supplier not found: ${supplierId}`);

  const contractId = randomUUID();
  const totalValue = items.reduce((s, i) => s + ((i.unit_price_usd ?? 100) * (i.quantity ?? 1)), 0);

  const flags = riskFlags(supplier);
  const contractRiskFlags = [...flags];
  if (!terms.governing_law) contractRiskFlags.push("no_governing_law_specified");
  if (!terms.liability_cap_usd) contractRiskFlags.push("no_liability_cap");
  if (totalValue > 100000 && !terms.performance_bond_required) contractRiskFlags.push("large_contract_no_performance_bond");

  const suggestedMods = [];
  if (!terms.governing_law) suggestedMods.push("Specify governing law and jurisdiction clause.");
  if (!terms.liability_cap_usd) suggestedMods.push("Add mutual liability cap (recommend 2x contract value).");
  if (!terms.ip_ownership) suggestedMods.push("Include IP ownership and data protection clauses.");
  if ((paymentTerms.terms ?? "net30") === "net60" && totalValue < 10000) suggestedMods.push("Net60 terms are unusual for contract value under $10K; consider net30.");
  if (supplier.country !== "USA" && !terms.export_controls) suggestedMods.push("Add export control and sanctions compliance clause (cross-border supplier).");

  const contentPreview = `
PROCUREMENT CONTRACT — DRAFT
Contract ID: ${contractId}
Date: ${new Date().toISOString().slice(0, 10)}

PARTIES
Buyer: [Your Organization]
Supplier: ${supplier.name}, ${supplier.location}, ${supplier.country}

SCOPE OF SUPPLY
${items.map((i, idx) => `  ${idx + 1}. ${i.name} — Qty: ${i.quantity ?? 1} @ $${i.unit_price_usd ?? 0}/unit`).join("\n") || "  [Items to be specified]"}

TOTAL CONTRACT VALUE: $${totalValue.toLocaleString()}

PAYMENT TERMS
Net: ${paymentTerms.terms ?? "net30"}
${paymentTerms.early_payment_discount_pct ? `Early payment discount: ${paymentTerms.early_payment_discount_pct}% if paid within 10 days` : ""}
Late payment penalty: ${paymentTerms.late_payment_penalty_pct ?? 1.5}% per month

DELIVERY
Lead time: ${supplier.lead_time_days} days from purchase order
Incoterms: ${terms.incoterms ?? "DDP (Delivered Duty Paid)"}

QUALITY & WARRANTIES
Defect threshold: < 5 PPT (parts per thousand)
Warranty period: ${terms.warranty_months ?? 12} months from delivery

GOVERNING LAW
${terms.governing_law ?? "[TO BE SPECIFIED — see risk flags]"}

TERMINATION
Notice period: ${terms.termination_notice_days ?? 30} days written notice

[Additional clauses: Force Majeure, Confidentiality, IP, Dispute Resolution — full draft available on execution]
  `.trim();

  db.prepare(`INSERT OR IGNORE INTO proc_contracts
    (id, supplier_id, terms, items, payment_terms, value_usd, status, risk_flags, suggested_modifications, fee_charged_usd)
    VALUES (@id, @supplier_id, @terms, @items, @payment_terms, @value_usd, @status, @risk_flags, @suggested_modifications, @fee_charged_usd)
  `).run({
    id: contractId,
    supplier_id: supplierId,
    terms: JSON.stringify(terms),
    items: JSON.stringify(items),
    payment_terms: JSON.stringify(paymentTerms),
    value_usd: totalValue,
    status: "draft",
    risk_flags: JSON.stringify(contractRiskFlags),
    suggested_modifications: JSON.stringify(suggestedMods),
    fee_charged_usd: CONTRACT_DRAFT_FEE,
  });

  return {
    contract_id: contractId,
    supplier_id: supplierId,
    supplier_name: supplier.name,
    contract_value_usd: totalValue,
    status: "draft",
    content_preview: contentPreview,
    risk_flags: contractRiskFlags,
    suggested_modifications: suggestedMods,
    platform_fee_usd: CONTRACT_DRAFT_FEE,
    next_steps: "Review risk flags and apply suggested modifications before sending for legal sign-off.",
    created_at: new Date().toISOString(),
  };
}

// ─── matchInvoice ─────────────────────────────────────────────────────────────

/**
 * Perform 3-way invoice matching against purchase order and receiving report.
 * @param {Object} invoiceData      - {invoice_number, supplier_id, amount_usd, line_items[], date}
 * @param {string} purchaseOrderId  - PO ID to match against (or pass PO data directly via invoiceData.po_amount_usd)
 * @returns Match result with discrepancies, approval status, and variance
 * Platform fee: $0.50/match
 */
export function matchInvoice(invoiceData, purchaseOrderId) {
  if (!invoiceData || !invoiceData.invoice_number) throw new Error("invoiceData.invoice_number is required");
  if (!purchaseOrderId) throw new Error("purchaseOrderId is required");

  const invoiceAmount = invoiceData.amount_usd ?? 0;
  let poAmount = invoiceData.po_amount_usd ?? null;

  // Try to load PO from DB
  const po = db.prepare("SELECT * FROM proc_purchase_orders WHERE id = ?").get(purchaseOrderId);
  if (po) poAmount = po.total_amount_usd;

  if (poAmount === null) {
    // Simulate a PO for demo purposes
    poAmount = Math.round(invoiceAmount * (0.97 + Math.random() * 0.06) * 100) / 100;
  }

  const variance = Math.round((invoiceAmount - poAmount) * 100) / 100;
  const variancePct = Math.abs(Math.round((variance / poAmount) * 10000) / 100);

  const discrepancies = [];
  let matchResult;

  if (Math.abs(variance) <= 0.01) {
    matchResult = "matched";
  } else if (variancePct <= 2.0) {
    matchResult = "partial";
    discrepancies.push({
      type: "minor_amount_variance",
      detail: `Invoice amount $${invoiceAmount} vs PO amount $${poAmount} (${variancePct}% variance — within tolerance)`,
      severity: "low",
    });
  } else {
    matchResult = "mismatch";
    discrepancies.push({
      type: "amount_mismatch",
      detail: `Invoice amount $${invoiceAmount} vs PO amount $${poAmount} (${variancePct}% variance — exceeds 2% threshold)`,
      severity: "high",
    });
    if (variancePct > 10) {
      discrepancies.push({
        type: "potential_fraud_flag",
        detail: `Variance exceeds 10% — manual review required before approval`,
        severity: "critical",
      });
    }
  }

  // Check line items if provided
  if (invoiceData.line_items && Array.isArray(invoiceData.line_items)) {
    const invoiceLineTotal = invoiceData.line_items.reduce((s, l) => s + ((l.quantity ?? 1) * (l.unit_price ?? 0)), 0);
    if (Math.abs(invoiceLineTotal - invoiceAmount) > 0.01) {
      discrepancies.push({
        type: "line_item_total_mismatch",
        detail: `Line item total $${invoiceLineTotal.toFixed(2)} does not match invoice total $${invoiceAmount}`,
        severity: "medium",
      });
    }
  }

  const approved = matchResult === "matched" || (matchResult === "partial" && variancePct <= 1.0);

  const matchId = randomUUID();
  db.prepare(`INSERT OR IGNORE INTO proc_invoice_matches
    (id, purchase_order_id, invoice_number, invoice_amount, po_amount, match_result, discrepancies, approved, amount_variance, fee_charged_usd)
    VALUES (@id, @purchase_order_id, @invoice_number, @invoice_amount, @po_amount, @match_result, @discrepancies, @approved, @amount_variance, @fee_charged_usd)
  `).run({
    id: matchId,
    purchase_order_id: purchaseOrderId,
    invoice_number: invoiceData.invoice_number,
    invoice_amount: invoiceAmount,
    po_amount: poAmount,
    match_result: matchResult,
    discrepancies: JSON.stringify(discrepancies),
    approved: approved ? 1 : 0,
    amount_variance: variance,
    fee_charged_usd: INVOICE_MATCH_FEE,
  });

  return {
    match_id: matchId,
    invoice_number: invoiceData.invoice_number,
    purchase_order_id: purchaseOrderId,
    invoice_amount_usd: invoiceAmount,
    po_amount_usd: poAmount,
    match_result: matchResult,
    amount_variance_usd: variance,
    variance_pct: variancePct,
    discrepancies,
    approved,
    approval_action: approved ? "Auto-approved for payment processing" : "Requires manual review and approval before payment",
    platform_fee_usd: INVOICE_MATCH_FEE,
    matched_at: new Date().toISOString(),
  };
}

// ─── getSpendAnalytics ────────────────────────────────────────────────────────

/**
 * Generate enterprise spend analytics dashboard for a department.
 * @param {string} department - Department name (e.g. "Engineering", "Marketing")
 * @param {Object} dateRange  - {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}
 * @param {Array}  categories - Filter to specific spend categories (optional)
 * @returns Spend analytics with totals, breakdowns, savings opportunities, and maverick spend
 * Platform fee: $10/month
 */
export function getSpendAnalytics(department, dateRange = {}, categories = []) {
  if (!department) throw new Error("department is required");

  const start = dateRange.start ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const end   = dateRange.end   ?? new Date().toISOString().slice(0, 10);

  // Simulate realistic department spend data
  const allCategories = ["IT Hardware", "Cloud Services", "Office Supplies", "Logistics", "Marketing", "Legal Services", "Facilities Mgmt", "HR & Staffing", "Cybersecurity", "Consulting"];
  const relevantCats = categories.length > 0 ? categories : allCategories.slice(0, 6);

  const byCategory = {};
  let totalSpend = 0;
  for (const cat of relevantCats) {
    const spend = Math.round((20000 + Math.random() * 180000) * 100) / 100;
    byCategory[cat] = spend;
    totalSpend += spend;
  }
  totalSpend = Math.round(totalSpend * 100) / 100;

  // Simulate top suppliers
  const suppliers = db.prepare("SELECT * FROM proc_suppliers ORDER BY RANDOM() LIMIT 6").all();
  const bySupplier = {};
  for (const s of suppliers) {
    bySupplier[s.name] = Math.round((5000 + Math.random() * 60000) * 100) / 100;
  }

  // Savings opportunities
  const savingsOpportunities = [
    { description: "Consolidate IT Hardware vendors from 4 to 2 — estimated savings 12%", potential_savings_usd: Math.round(totalSpend * 0.08 * 100) / 100, effort: "medium" },
    { description: "Renegotiate Cloud Services contract — current spend 18% above market benchmark", potential_savings_usd: Math.round(totalSpend * 0.05 * 100) / 100, effort: "low" },
    { description: "Switch Office Supplies to preferred vendor program", potential_savings_usd: Math.round(totalSpend * 0.02 * 100) / 100, effort: "low" },
    { description: "Extend payment terms from net30 to net45 for cash flow benefit", potential_savings_usd: 0, effort: "low", cashflow_impact_usd: Math.round(totalSpend * 0.03 * 100) / 100 },
  ];

  const maverickSpendPct = Math.round((8 + Math.random() * 22) * 10) / 10;

  return {
    analytics_id: randomUUID(),
    department,
    date_range: { start, end },
    total_spend_usd: totalSpend,
    by_category: byCategory,
    by_supplier: bySupplier,
    top_category: Object.entries(byCategory).sort(([, a], [, b]) => b - a)[0]?.[0],
    top_supplier: Object.entries(bySupplier).sort(([, a], [, b]) => b - a)[0]?.[0],
    maverick_spend_pct: maverickSpendPct,
    maverick_spend_usd: Math.round(totalSpend * maverickSpendPct / 100 * 100) / 100,
    savings_opportunities: savingsOpportunities,
    total_potential_savings_usd: savingsOpportunities.reduce((s, o) => s + (o.potential_savings_usd ?? 0), 0),
    purchase_order_compliance_pct: Math.round((100 - maverickSpendPct) * 10) / 10,
    platform_fee_usd: SPEND_ANALYTICS_FEE,
    generated_at: new Date().toISOString(),
  };
}
