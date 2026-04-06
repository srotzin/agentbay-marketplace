import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const TRADE_PLATFORM_COMMISSION   = 0.20; // 20% on HS classification
const FEE_HS_CLASSIFY             = 1.00; // per classification
const FEE_SANCTIONS_SCREEN        = 0.50; // per screen
const FEE_DUTY_CALC               = 0.75; // per calculation
const FEE_CUSTOMS_DOCS            = 5.00; // per document set
const FEE_EXPORT_CONTROL          = 2.00; // per check

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tc_hs_codes (
    id               TEXT PRIMARY KEY,
    hs_code          TEXT NOT NULL UNIQUE,
    hts_code         TEXT,
    description      TEXT NOT NULL,
    chapter          INTEGER NOT NULL,
    chapter_name     TEXT NOT NULL,
    duty_rate_pct    REAL NOT NULL,
    unit_of_measure  TEXT DEFAULT 'kg',
    notes            TEXT DEFAULT '[]',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tc_sanctions_entries (
    id               TEXT PRIMARY KEY,
    entity_name      TEXT NOT NULL,
    aliases          TEXT DEFAULT '[]',
    entity_type      TEXT NOT NULL CHECK(entity_type IN ('individual','organization','vessel','aircraft')),
    countries        TEXT DEFAULT '[]',
    list_source      TEXT NOT NULL,
    program          TEXT,
    sanction_type    TEXT,
    effective_date   TEXT,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tc_classifications (
    id               TEXT PRIMARY KEY,
    product_description TEXT NOT NULL,
    origin_country   TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    hs_code          TEXT,
    fee_usd          REAL,
    commission_usd   REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tc_duty_calcs (
    id               TEXT PRIMARY KEY,
    hs_code          TEXT NOT NULL,
    origin_country   TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    declared_value   REAL NOT NULL,
    quantity         REAL NOT NULL,
    duty_amount      REAL,
    vat_amount       REAL,
    total_landed_cost REAL,
    fee_usd          REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed HS Codes ────────────────────────────────────────────────────────────

const _hsCount = db.prepare("SELECT COUNT(*) as n FROM tc_hs_codes").get().n;
if (_hsCount === 0) {
  const hsCodes = [
    { hs_code: "0101.21", hts_code: "0101.21.0000", description: "Live horses — purebred breeding animals",            chapter: 1,  chapter_name: "Live animals",                    duty_rate_pct: 0.00, unit_of_measure: "head", notes: '["CITES may apply","Veterinary certificate required"]' },
    { hs_code: "0201.10", hts_code: "0201.10.1000", description: "Beef, fresh or chilled, carcasses and half-carcasses", chapter: 2, chapter_name: "Meat and offal",               duty_rate_pct: 4.40, unit_of_measure: "kg",   notes: '["SPS inspection required","Country-of-origin labeling required"]' },
    { hs_code: "0901.11", hts_code: "0901.11.0010", description: "Coffee, not roasted, not decaffeinated",             chapter: 9,  chapter_name: "Coffee, tea, spices",            duty_rate_pct: 0.00, unit_of_measure: "kg",   notes: '["FDA registration if >$2500","ICO certificate recommended"]' },
    { hs_code: "1001.11", hts_code: "1001.11.0000", description: "Durum wheat, seed",                                  chapter: 10, chapter_name: "Cereals",                        duty_rate_pct: 0.65, unit_of_measure: "kg",   notes: '["USDA phytosanitary certificate required"]' },
    { hs_code: "2204.21", hts_code: "2204.21.5000", description: "Wine of fresh grapes, in containers ≤2 litres",      chapter: 22, chapter_name: "Beverages, spirits, vinegar",    duty_rate_pct: 6.30, unit_of_measure: "l",    notes: '["TTB formula approval","Label approval required"]' },
    { hs_code: "2709.00", hts_code: "2709.00.2000", description: "Petroleum oils, crude",                              chapter: 27, chapter_name: "Mineral fuels",                  duty_rate_pct: 10.50, unit_of_measure: "l",   notes: '["ECCN EAR99","OFAC screening recommended"]' },
    { hs_code: "3004.90", hts_code: "3004.90.9160", description: "Medicaments, mixed, retail sale — other",            chapter: 30, chapter_name: "Pharmaceutical products",         duty_rate_pct: 0.00, unit_of_measure: "kg",   notes: '["FDA 510(k) or NDA may apply","DEA if controlled substance"]' },
    { hs_code: "3901.10", hts_code: "3901.10.0000", description: "Polyethylene, specific gravity <0.94",               chapter: 39, chapter_name: "Plastics and articles thereof",  duty_rate_pct: 6.50, unit_of_measure: "kg",   notes: '["Tariff Section VI"]' },
    { hs_code: "4011.10", hts_code: "4011.10.1020", description: "New pneumatic tyres, rubber — motor cars",           chapter: 40, chapter_name: "Rubber and articles thereof",    duty_rate_pct: 4.00, unit_of_measure: "u",    notes: '["DOT FMVSS 109 certification","Safety recall check required"]' },
    { hs_code: "4418.20", hts_code: "4418.20.4000", description: "Doors and frames, wood",                             chapter: 44, chapter_name: "Wood and articles of wood",       duty_rate_pct: 3.20, unit_of_measure: "m2",   notes: '["CARB ATCM Phase 2 may apply","Lacey Act declaration required"]' },
    { hs_code: "5208.21", hts_code: "5208.21.4000", description: "Woven fabrics, cotton ≥85%, plain weave, ≤100g/m2", chapter: 52, chapter_name: "Cotton",                         duty_rate_pct: 7.60, unit_of_measure: "m2",   notes: '["FLSA country-of-origin labeling","Textile quota may apply"]' },
    { hs_code: "6109.10", hts_code: "6109.10.0012", description: "T-shirts, singlets and other vests, cotton, knitted", chapter: 61, chapter_name: "Knitted/crocheted clothing",     duty_rate_pct: 16.50, unit_of_measure: "u",   notes: '["Textile visa may be required","CA Prop 65 if sold in California"]' },
    { hs_code: "6403.51", hts_code: "6403.51.9090", description: "Footwear, outer sole leather, uppers leather, ankle coverage", chapter: 64, chapter_name: "Footwear", duty_rate_pct: 10.00, unit_of_measure: "pr", notes: '["CPSC flammability","Anti-dumping may apply for China origin"]' },
    { hs_code: "7010.90", hts_code: "7010.90.5000", description: "Glass carboys, bottles, flasks — for conveyance",   chapter: 70, chapter_name: "Glass and glassware",             duty_rate_pct: 3.00, unit_of_measure: "u",    notes: '[]' },
    { hs_code: "7208.51", hts_code: "7208.51.0060", description: "Flat-rolled iron/steel, hot-rolled, ≥4.75mm thick", chapter: 72, chapter_name: "Iron and steel",                  duty_rate_pct: 25.00, unit_of_measure: "kg",  notes: '["Section 232 tariff applies","Steel import license required"]' },
    { hs_code: "8471.30", hts_code: "8471.30.0100", description: "Portable automatic data processing machines ≤10kg", chapter: 84, chapter_name: "Machinery and mechanical appliances", duty_rate_pct: 0.00, unit_of_measure: "u", notes: '["ITA zero-duty product","FCC Part 15 certification required","ECCN 5A992 typical"]' },
    { hs_code: "8517.12", hts_code: "8517.12.0050", description: "Smartphones — telephone for cellular networks",      chapter: 85, chapter_name: "Electrical machinery",             duty_rate_pct: 0.00, unit_of_measure: "u",    notes: '["FCC ID required","Section 301 tariffs may apply for CN origin","SAR testing required"]' },
    { hs_code: "8703.23", hts_code: "8703.23.0085", description: "Motor vehicles, spark-ignition, 1500–3000cc",        chapter: 87, chapter_name: "Vehicles",                         duty_rate_pct: 2.50, unit_of_measure: "u",    notes: '["EPA certificate of conformity","DOT FMVSS compliance","NHTSA importation"]' },
    { hs_code: "8802.40", hts_code: "8802.40.0060", description: "Aeroplanes and other powered aircraft, ≥15000kg",   chapter: 88, chapter_name: "Aircraft and spacecraft",           duty_rate_pct: 0.00, unit_of_measure: "u",    notes: '["FAA airworthiness certificate","OFAC/ITAR screening required","EAR 9A991"]' },
    { hs_code: "9006.51", hts_code: "9006.51.0040", description: "Cameras, flashlight photography, SLR",              chapter: 90, chapter_name: "Optical instruments",               duty_rate_pct: 0.00, unit_of_measure: "u",    notes: '[]' },
    { hs_code: "9013.80", hts_code: "9013.80.9000", description: "Liquid crystal devices, lasers, optical instruments NES", chapter: 90, chapter_name: "Optical instruments",       duty_rate_pct: 3.50, unit_of_measure: "u",    notes: '["Laser safety class certification","ECCN applies if CW-capable"]' },
    { hs_code: "9301.00", hts_code: "9301.00.9000", description: "Military weapons (artillery, rocket launchers)",     chapter: 93, chapter_name: "Arms and ammunition",              duty_rate_pct: 0.00, unit_of_measure: "u",    notes: '["ITAR controlled — DDTC license required","Congressional notification possible","EAR inapplicable"]' },
    { hs_code: "2710.19", hts_code: "2710.19.0540", description: "Medium oils and preparations, not biodiesel",        chapter: 27, chapter_name: "Mineral fuels",                  duty_rate_pct: 5.25, unit_of_measure: "l",    notes: '["EPA Tier 3 fuel standard","CBP CF-7501 entry required"]' },
    { hs_code: "3808.91", hts_code: "3808.91.1000", description: "Insecticides, retail packages ≤1.36kg",              chapter: 38, chapter_name: "Chemical products",               duty_rate_pct: 5.00, unit_of_measure: "kg",   notes: '["EPA FIFRA registration required","California DPR registration","Signal word labeling"]' },
    { hs_code: "8528.72", hts_code: "8528.72.6400", description: "Color television receivers, LCD flat panel",         chapter: 85, chapter_name: "Electrical machinery",             duty_rate_pct: 3.90, unit_of_measure: "u",    notes: '["FCC Part 15 certification","Energy Star may apply","CPSC compliance"]' },
    { hs_code: "9403.20", hts_code: "9403.20.0018", description: "Metal furniture — other",                            chapter: 94, chapter_name: "Furniture and bedding",             duty_rate_pct: 0.00, unit_of_measure: "u",    notes: '["CPSC flammability standards","Prop 65 if sold in California","Anti-dumping may apply"]' },
    { hs_code: "0306.17", hts_code: "0306.17.0004", description: "Frozen shrimp and prawns",                          chapter: 3,  chapter_name: "Fish and seafood",                 duty_rate_pct: 0.00, unit_of_measure: "kg",   notes: '["FDA HACCP seafood regulation","Mandatory country-of-origin labeling","Shrimp antidumping orders"]' },
    { hs_code: "2601.11", hts_code: "2601.11.0000", description: "Iron ores and concentrates, non-agglomerated",       chapter: 26, chapter_name: "Ores, slag, and ash",             duty_rate_pct: 0.00, unit_of_measure: "t",    notes: '[]' },
    { hs_code: "1211.90", hts_code: "1211.90.9150", description: "Plants for pharmacy, perfumery, insecticide — dried", chapter: 12, chapter_name: "Oil seeds and oleaginous fruits", duty_rate_pct: 0.00, unit_of_measure: "kg",   notes: '["USDA phytosanitary inspection","CBD products subject to FDA oversight"]' },
    { hs_code: "8481.80", hts_code: "8481.80.3090", description: "Taps, cocks, valves for pipes — other",              chapter: 84, chapter_name: "Machinery and mechanical appliances", duty_rate_pct: 3.00, unit_of_measure: "u", notes: '["NSF 61 certification for potable water","ASME certification if pressure vessel rated"]' },
  ];

  const insertHs = db.prepare(`
    INSERT OR IGNORE INTO tc_hs_codes
      (id, hs_code, hts_code, description, chapter, chapter_name, duty_rate_pct, unit_of_measure, notes)
    VALUES
      (@id, @hs_code, @hts_code, @description, @chapter, @chapter_name, @duty_rate_pct, @unit_of_measure, @notes)
  `);
  for (const row of hsCodes) insertHs.run({ id: randomUUID(), ...row });
}

// ─── Seed Sanctions Entries ────────────────────────────────────────────────────

const _sanctionCount = db.prepare("SELECT COUNT(*) as n FROM tc_sanctions_entries").get().n;
if (_sanctionCount === 0) {
  const sanctions = [
    { entity_name: "Mahan Air",                   aliases: '["Mahan Airlines","W5"]',             entity_type: "organization", countries: '["IR"]',        list_source: "OFAC-SDN",  program: "Iran",         sanction_type: "blocking",      effective_date: "2011-10-12", notes: "Designated for support of IRGC-QF" },
    { entity_name: "Rosoboronexport",             aliases: '["ROE","Federal State Unitary Enterprise Rosoboronexport"]', entity_type: "organization", countries: '["RU"]', list_source: "OFAC-SDN", program: "Russia-EO14024", sanction_type: "blocking", effective_date: "2022-03-01", notes: "Russian state arms exporter" },
    { entity_name: "Bank Mellat",                 aliases: '["Mellat Bank","First East Export Bank"]', entity_type: "organization", countries: '["IR"]',    list_source: "EU-Consolidated", program: "Iran-Nuclear", sanction_type: "asset_freeze", effective_date: "2010-07-26", notes: "Financing Iran nuclear program" },
    { entity_name: "Buyan (vessel IMO 9349559)",  aliases: '["Buyan","MMSI 273459600"]',           entity_type: "vessel",        countries: '["RU"]',        list_source: "OFAC-SDN",  program: "Ukraine-EO13685", sanction_type: "blocking",    effective_date: "2022-04-15", notes: "Russian naval vessel" },
    { entity_name: "Korea Mining Development Trading", aliases: '["KOMID","Korea Ryonbong"]',      entity_type: "organization", countries: '["KP"]',        list_source: "UN-1718",   program: "DPRK",         sanction_type: "asset_freeze",  effective_date: "2009-04-24", notes: "Primary arms dealer for DPRK" },
    { entity_name: "Quds Force (IRGC-QF)",        aliases: '["Islamic Revolutionary Guard Corps Qods Force"]',         entity_type: "organization", countries: '["IR"]', list_source: "OFAC-SDN", program: "Iran-EO13224", sanction_type: "blocking", effective_date: "2007-10-25", notes: "Foreign terrorist organization designation" },
    { entity_name: "Belarusian Potash Company",   aliases: '["BPC","Belaruskali"]',               entity_type: "organization", countries: '["BY"]',        list_source: "OFAC-SDN",  program: "Belarus-EO14038", sanction_type: "blocking",   effective_date: "2021-08-09", notes: "Sanctioned following 2021 Ryanair incident" },
    { entity_name: "Huawei Technologies Co Ltd",  aliases: '["Huawei","HW"]',                     entity_type: "organization", countries: '["CN"]',        list_source: "BIS-EL",    program: "Export-Controls", sanction_type: "entity_list", effective_date: "2019-05-16", notes: "BIS Entity List — license required for all items" },
    { entity_name: "Viktor Bout",                 aliases: '["Victor Bout","Merchant of Death"]', entity_type: "individual",   countries: '["RU"]',        list_source: "OFAC-SDN",  program: "Liberia-EO13348", sanction_type: "blocking",   effective_date: "2004-07-26", notes: "Arms trafficking; released in 2022 prisoner exchange" },
    { entity_name: "Shinwari Money Exchange",     aliases: '["Shinwari Exchange"]',               entity_type: "organization", countries: '["AF","PK"]',   list_source: "OFAC-SDN",  program: "Taliban",      sanction_type: "blocking",      effective_date: "2016-02-11", notes: "Hawala network supporting Taliban finances" },
  ];

  const insertSanction = db.prepare(`
    INSERT OR IGNORE INTO tc_sanctions_entries
      (id, entity_name, aliases, entity_type, countries, list_source, program, sanction_type, effective_date, notes)
    VALUES
      (@id, @entity_name, @aliases, @entity_type, @countries, @list_source, @program, @sanction_type, @effective_date, @notes)
  `);
  for (const row of sanctions) insertSanction.run({ id: randomUUID(), ...row });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fuzzyMatch(a, b) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = new Set(na.split(" "));
  const wordsB = nb.split(" ");
  const shared  = wordsB.filter(w => wordsA.has(w) && w.length > 2).length;
  return shared / Math.max(wordsA.size, wordsB.length);
}

function tradeAgreements(origin, destination) {
  const agreements = {
    "US-CA": "USMCA", "CA-US": "USMCA", "US-MX": "USMCA", "MX-US": "USMCA",
    "US-KR": "KORUS FTA", "KR-US": "KORUS FTA",
    "US-AU": "AUSFTA",   "AU-US": "AUSFTA",
    "US-SG": "USSFTA",   "SG-US": "USSFTA",
    "US-CL": "US-Chile FTA", "CL-US": "US-Chile FTA",
    "EU-JP": "JEFTA",    "JP-EU": "JEFTA",
    "GB-AU": "UK-Australia FTA", "AU-GB": "UK-Australia FTA",
    "CN-AU": "ChAFTA",   "AU-CN": "ChAFTA",
  };
  return agreements[`${origin}-${destination}`] ?? null;
}

function vatRate(country) {
  const rates = { GB: 0.20, DE: 0.19, FR: 0.20, IT: 0.22, ES: 0.21, NL: 0.21,
                  AU: 0.10, NZ: 0.15, CA: 0.05, JP: 0.10, KR: 0.10, IN: 0.18,
                  MX: 0.16, BR: 0.12, ZA: 0.15, SG: 0.09, AE: 0.05 };
  return rates[destination] ?? 0.0;
}

// ─── classifyHsCode ───────────────────────────────────────────────────────────

/**
 * Classify a product with an HS/HTS code using keyword matching against the seed database.
 * @param {string} productDescription - Description of the product to classify
 * @param {string} originCountry      - 2-letter ISO country code (e.g. "CN")
 * @param {string} destinationCountry - 2-letter ISO country code (e.g. "US")
 * @returns Classification result with HS code, duty rate, and preferential rates
 */
export function classifyHsCode(productDescription, originCountry, destinationCountry) {
  if (!productDescription) throw new Error("productDescription is required");
  if (!originCountry)      throw new Error("originCountry is required");
  if (!destinationCountry) throw new Error("destinationCountry is required");

  const id        = randomUUID();
  const feePaid   = FEE_HS_CLASSIFY;
  const commission = Math.round(feePaid * TRADE_PLATFORM_COMMISSION * 100) / 100;

  // Keyword-based classification against seeded HS codes
  const allCodes = db.prepare("SELECT * FROM tc_hs_codes").all();
  const descLower = productDescription.toLowerCase();

  const scored = allCodes.map(row => {
    const score = fuzzyMatch(productDescription, row.description) +
                  (descLower.split(" ").some(w => row.description.toLowerCase().includes(w) && w.length > 3) ? 0.2 : 0);
    return { ...row, _score: score };
  }).sort((a, b) => b._score - a._score);

  const best = scored[0] ?? null;
  const fta  = tradeAgreements(originCountry, destinationCountry);
  const preferentialRates = {};
  if (fta) {
    preferentialRates[fta] = Math.max(0, (best?.duty_rate_pct ?? 5) - (best?.duty_rate_pct ?? 5) * 0.60).toFixed(2) + "%";
    preferentialRates["GSP"] = originCountry !== "US" && originCountry !== "CN" ? "0% (if eligible)" : "N/A";
  }

  db.prepare(`
    INSERT OR IGNORE INTO tc_classifications
      (id, product_description, origin_country, destination_country, hs_code, fee_usd, commission_usd)
    VALUES (@id, @product_description, @origin_country, @destination_country, @hs_code, @fee_usd, @commission_usd)
  `).run({ id, product_description: productDescription, origin_country: originCountry,
            destination_country: destinationCountry, hs_code: best?.hs_code ?? null,
            fee_usd: feePaid, commission_usd: commission });

  return {
    classification_id:   id,
    hs_code:             best?.hs_code ?? "9999.99",
    hts_code:            best?.hts_code ?? "9999.99.0000",
    description:         best?.description ?? productDescription,
    chapter:             best?.chapter ?? 99,
    chapter_name:        best?.chapter_name ?? "Miscellaneous",
    duty_rate_pct:       best?.duty_rate_pct ?? 5.0,
    unit_of_measure:     best?.unit_of_measure ?? "kg",
    preferential_rates:  preferentialRates,
    trade_agreement:     fta,
    notes:               JSON.parse(best?.notes ?? "[]"),
    confidence_pct:      Math.round(Math.min(99, (best?._score ?? 0.3) * 90)),
    origin_country:      originCountry,
    destination_country: destinationCountry,
    fee_usd:             feePaid,
    platform_commission_usd: commission,
    classified_at:       new Date().toISOString(),
  };
}

// ─── screenSanctions ─────────────────────────────────────────────────────────

/**
 * Screen an entity name against OFAC, EU, and UN sanctions lists.
 * @param {string}   entityName  - Name of the entity to screen
 * @param {string}   entityType  - individual|organization|vessel|aircraft
 * @param {string[]} countries   - Array of country codes associated with the entity
 * @returns Screening result with match details and recommended action
 */
export function screenSanctions(entityName, entityType = "organization", countries = []) {
  if (!entityName) throw new Error("entityName is required");

  const feePaid = FEE_SANCTIONS_SCREEN;
  const allEntries = db.prepare("SELECT * FROM tc_sanctions_entries").all();

  const matches = [];
  for (const entry of allEntries) {
    const nameScore = fuzzyMatch(entityName, entry.entity_name);
    const aliases   = JSON.parse(entry.aliases || "[]");
    const aliasScore = Math.max(0, ...aliases.map(a => fuzzyMatch(entityName, a)));
    const bestScore  = Math.max(nameScore, aliasScore);
    if (bestScore >= 0.65) {
      const entryCountries = JSON.parse(entry.countries || "[]");
      const countryOverlap = countries.some(c => entryCountries.includes(c));
      matches.push({
        entity_name:     entry.entity_name,
        aliases:         aliases,
        entity_type:     entry.entity_type,
        list_source:     entry.list_source,
        program:         entry.program,
        sanction_type:   entry.sanction_type,
        effective_date:  entry.effective_date,
        match_score:     Math.round(bestScore * 100),
        country_overlap: countryOverlap,
        notes:           entry.notes,
      });
    }
  }

  matches.sort((a, b) => b.match_score - a.match_score);
  const clear = matches.length === 0;
  const highMatches = matches.filter(m => m.match_score >= 90);
  const riskLevel = highMatches.length > 0 ? "critical"
                  : matches.length > 0       ? "elevated"
                  : "low";

  const recommendedAction = riskLevel === "critical" ? "BLOCK — Do not proceed. File SAR with FinCEN if applicable."
                          : riskLevel === "elevated"  ? "ESCALATE — Manual compliance review required before proceeding."
                          : "PROCEED — No sanctions matches found. Document screening for record-keeping.";

  return {
    screen_id:           randomUUID(),
    entity_name:         entityName,
    entity_type:         entityType,
    countries_screened:  countries,
    clear,
    matches,
    risk_level:          riskLevel,
    list_sources:        ["OFAC-SDN", "OFAC-CONS", "EU-Consolidated", "UN-Security-Council", "BIS-Entity-List"],
    recommended_action:  recommendedAction,
    screened_at:         new Date().toISOString(),
    fee_usd:             feePaid,
    valid_for_days:      30,
  };
}

// ─── calculateDuty ───────────────────────────────────────────────────────────

/**
 * Calculate import duties and total landed cost for a shipment.
 * @param {string} hsCode             - HS/HTS code (e.g. "8471.30")
 * @param {string} originCountry      - 2-letter ISO code
 * @param {string} destinationCountry - 2-letter ISO code
 * @param {number} declaredValue      - Customs value in USD
 * @param {number} quantity           - Quantity being imported
 * @returns Duty breakdown including VAT and total landed cost
 */
export function calculateDuty(hsCode, originCountry, destinationCountry, declaredValue, quantity) {
  if (!hsCode)             throw new Error("hsCode is required");
  if (!originCountry)      throw new Error("originCountry is required");
  if (!destinationCountry) throw new Error("destinationCountry is required");
  if (declaredValue == null || declaredValue < 0) throw new Error("declaredValue must be a non-negative number");
  if (quantity == null || quantity <= 0)          throw new Error("quantity must be a positive number");

  const id      = randomUUID();
  const feePaid = FEE_DUTY_CALC;
  const clean   = hsCode.replace(/[^0-9.]/g, "");
  const hsRow   = db.prepare("SELECT * FROM tc_hs_codes WHERE hs_code = ?").get(clean)
               ?? db.prepare("SELECT * FROM tc_hs_codes WHERE hs_code LIKE ?").get(`${clean.slice(0, 4)}%`);

  const baseDutyRate    = hsRow?.duty_rate_pct ?? 5.0;
  const fta             = tradeAgreements(originCountry, destinationCountry);
  const ftaDiscount     = fta ? 0.60 : 0.0;  // 60% duty reduction under FTA
  const effectiveRate   = Math.max(0, baseDutyRate * (1 - ftaDiscount));
  const dutyAmount      = Math.round(declaredValue * (effectiveRate / 100) * 100) / 100;
  const destVatRate     = vatRate(destinationCountry);
  const vatBase         = declaredValue + dutyAmount;
  const vatAmount       = Math.round(vatBase * destVatRate * 100) / 100;

  // Estimated shipping/insurance (2.5% of declared value, simplified)
  const shippingEst     = Math.round(declaredValue * 0.025 * 100) / 100;
  const totalLandedCost = Math.round((declaredValue + dutyAmount + vatAmount + shippingEst) * 100) / 100;

  const agreements = [];
  if (fta) agreements.push({ agreement: fta, reduction_pct: 60, effective_duty_rate_pct: effectiveRate });

  db.prepare(`
    INSERT OR IGNORE INTO tc_duty_calcs
      (id, hs_code, origin_country, destination_country, declared_value, quantity, duty_amount, vat_amount, total_landed_cost, fee_usd)
    VALUES (@id, @hs_code, @origin_country, @destination_country, @declared_value, @quantity, @duty_amount, @vat_amount, @total_landed_cost, @fee_usd)
  `).run({ id, hs_code: clean, origin_country: originCountry, destination_country: destinationCountry,
            declared_value: declaredValue, quantity, duty_amount: dutyAmount, vat_amount: vatAmount,
            total_landed_cost: totalLandedCost, fee_usd: feePaid });

  return {
    calculation_id:           id,
    hs_code:                  clean,
    origin_country:           originCountry,
    destination_country:      destinationCountry,
    declared_value_usd:       declaredValue,
    quantity,
    duty_rate_pct:            baseDutyRate,
    effective_duty_rate_pct:  effectiveRate,
    duty_amount_usd:          dutyAmount,
    vat_rate_pct:             destVatRate * 100,
    vat_amount_usd:           vatAmount,
    estimated_shipping_usd:   shippingEst,
    total_landed_cost_usd:    totalLandedCost,
    cost_per_unit_usd:        Math.round((totalLandedCost / quantity) * 100) / 100,
    trade_agreements_applied: agreements,
    notes:                    JSON.parse(hsRow?.notes ?? "[]"),
    fee_usd:                  feePaid,
    calculated_at:            new Date().toISOString(),
  };
}

// ─── generateCustomsDocs ─────────────────────────────────────────────────────

/**
 * Generate a full set of customs documentation for an international shipment.
 * @param {object} shipmentDetails    - { shipper, consignee, description, weight_kg, value_usd, invoice_number }
 * @param {string} hsCode             - HS code for the goods
 * @param {string} originCountry      - 2-letter ISO code
 * @param {string} destinationCountry - 2-letter ISO code
 * @returns Array of documents with content, required signatures, and filing deadlines
 */
export function generateCustomsDocs(shipmentDetails, hsCode, originCountry, destinationCountry) {
  if (!shipmentDetails)    throw new Error("shipmentDetails is required");
  if (!hsCode)             throw new Error("hsCode is required");
  if (!originCountry)      throw new Error("originCountry is required");
  if (!destinationCountry) throw new Error("destinationCountry is required");

  const { shipper = "Acme Corp", consignee = "Consignee Ltd", description = "General Merchandise",
          weight_kg = 500, value_usd = 10000, invoice_number = `INV-${Date.now()}` } = shipmentDetails;

  const setId       = randomUUID();
  const feePaid     = FEE_CUSTOMS_DOCS;
  const now         = new Date();
  const filingDeadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const documents = [
    {
      doc_type:           "commercial_invoice",
      document_id:        randomUUID(),
      title:              "Commercial Invoice",
      content: {
        invoice_number,
        invoice_date:      now.toISOString().split("T")[0],
        seller:            shipper,
        buyer:             consignee,
        country_of_origin: originCountry,
        country_of_destination: destinationCountry,
        hs_code:           hsCode,
        description_of_goods: description,
        quantity:          1,
        unit_value_usd:    value_usd,
        total_value_usd:   value_usd,
        currency:          "USD",
        incoterms:         "CIF",
        payment_terms:     "Net 30",
        freight_cost_usd:  Math.round(value_usd * 0.025 * 100) / 100,
        insurance_usd:     Math.round(value_usd * 0.005 * 100) / 100,
      },
      required_signatures: ["Authorized Exporter Representative", "Notary (if >$500k value)"],
      filing_deadline:     filingDeadline,
      copies_required:     3,
    },
    {
      doc_type:           "packing_list",
      document_id:        randomUUID(),
      title:              "Packing List",
      content: {
        packing_list_number: `PL-${invoice_number}`,
        date:               now.toISOString().split("T")[0],
        shipper,
        consignee,
        packages: [
          { package_number: 1, description, gross_weight_kg: weight_kg,
            net_weight_kg: Math.round(weight_kg * 0.92 * 10) / 10, dimensions_cm: "120x80x80",
            hs_code: hsCode, marks_and_numbers: `${invoice_number}-01` },
        ],
        total_packages:    1,
        total_gross_kg:    weight_kg,
        total_net_kg:      Math.round(weight_kg * 0.92 * 10) / 10,
      },
      required_signatures: ["Shipper Representative"],
      filing_deadline:     filingDeadline,
      copies_required:     2,
    },
    {
      doc_type:           "certificate_of_origin",
      document_id:        randomUUID(),
      title:              "Certificate of Origin",
      content: {
        certificate_number: `COO-${randomUUID().slice(0, 8).toUpperCase()}`,
        issued_date:        now.toISOString().split("T")[0],
        exporter:           shipper,
        consignee,
        country_of_origin:  originCountry,
        hs_code:            hsCode,
        description,
        gross_weight_kg:    weight_kg,
        invoice_reference:  invoice_number,
        preferential_origin: tradeAgreements(originCountry, destinationCountry) !== null,
        applicable_agreement: tradeAgreements(originCountry, destinationCountry) ?? "None",
      },
      required_signatures: ["Chamber of Commerce Official", "Exporter Authorized Signatory"],
      filing_deadline:     filingDeadline,
      copies_required:     2,
    },
    {
      doc_type:           "bill_of_lading",
      document_id:        randomUUID(),
      title:              "Bill of Lading",
      content: {
        bl_number:          `BL-${Date.now().toString(36).toUpperCase()}`,
        shipper,
        consignee,
        notify_party:       consignee,
        port_of_loading:    `${originCountry} Main Port`,
        port_of_discharge:  `${destinationCountry} Main Port`,
        description,
        hs_code:            hsCode,
        gross_weight_kg:    weight_kg,
        freight_terms:      "Prepaid",
        container_type:     weight_kg > 10000 ? "40ft HC" : "20ft Standard",
        booking_number:     `BKG-${randomUUID().slice(0, 8).toUpperCase()}`,
        vessel_name:        "MV ATLANTIC HORIZON",
        voyage_number:      `ATL-${Math.floor(100 + Math.random() * 900)}`,
        estimated_departure: new Date(now.getTime() + 5 * 86400000).toISOString().split("T")[0],
        estimated_arrival:  new Date(now.getTime() + 18 * 86400000).toISOString().split("T")[0],
      },
      required_signatures: ["Carrier/Shipping Line Authorized Agent", "Shipper"],
      filing_deadline:     new Date(now.getTime() + 5 * 86400000).toISOString().split("T")[0],
      copies_required:     3,
    },
  ];

  return {
    document_set_id:     setId,
    shipment_reference:  invoice_number,
    origin_country:      originCountry,
    destination_country: destinationCountry,
    hs_code:             hsCode,
    documents,
    document_count:      documents.length,
    overall_deadline:    filingDeadline,
    fee_usd:             feePaid,
    generated_at:        now.toISOString(),
    instructions:        [
      "Submit commercial invoice and packing list 24 hours before vessel departure.",
      "Certificate of Origin must be endorsed by a recognized Chamber of Commerce.",
      "Retain all originals for 5 years per CBP recordkeeping requirements.",
      "Electronic filing via AES/ACE required for exports >$2500.",
    ],
  };
}

// ─── checkExportControls ──────────────────────────────────────────────────────

/**
 * Check EAR/ITAR export control classification for a product and destination.
 * @param {string} product            - Product name or description
 * @param {string} destinationCountry - 2-letter ISO code
 * @param {string} endUse             - Intended end-use (e.g. "civil aviation", "military")
 * @returns Export control classification with license requirements
 */
export function checkExportControls(product, destinationCountry, endUse = "commercial") {
  if (!product)            throw new Error("product is required");
  if (!destinationCountry) throw new Error("destinationCountry is required");

  const feePaid = FEE_EXPORT_CONTROL;

  // Simplified ECCN determination based on keywords
  const prodLower = product.toLowerCase();
  const isItar    = /weapon|missile|munition|firearm|artillery|launcher|warhead|torpedo|military aircraft|satellite|spacecraft/.test(prodLower);
  const isDualUse = /encryption|cipher|laser|night.?vision|drone|uav|nuclear|chemical|biological|semiconductor|microcontroller|radio|radar/.test(prodLower);
  const isEar99   = !isItar && !isDualUse;

  const embargoed = ["CU","IR","KP","RU","SY","BY","MM"];
  const isEmbargoed = embargoed.includes(destinationCountry.toUpperCase());
  const isMilitaryEnd = /military|defense|armed forces|weapons|wmد/.test(endUse.toLowerCase());

  let classification, licenseRequired, licenseType, restricted, eccn;

  if (isItar) {
    classification   = "ITAR — Controlled (USML)";
    eccn             = "See USML Category";
    licenseRequired  = true;
    licenseType      = "DDTC License (DSP-5 or DSP-73)";
    restricted       = true;
  } else if (isDualUse) {
    classification   = "EAR — Dual-Use Controlled";
    eccn             = "5A002 / 7A994 / 3A001 (product-dependent)";
    licenseRequired  = isEmbargoed || isMilitaryEnd;
    licenseType      = licenseRequired ? "BIS Export License (EAR)" : "License Exception may apply (ENC, STA, LVS)";
    restricted       = isEmbargoed;
  } else {
    classification   = "EAR99 — No Export License Required (unless sanctioned country)";
    eccn             = "EAR99";
    licenseRequired  = isEmbargoed;
    licenseType      = licenseRequired ? "BIS Export License — Sanctioned Country" : "No license required";
    restricted       = isEmbargoed;
  }

  const complianceNotes = [];
  if (isItar)      complianceNotes.push("ITAR registration with DDTC required before any export.");
  if (isDualUse)   complianceNotes.push("End-user statement (EUS) required from foreign consignee.");
  if (isEmbargoed) complianceNotes.push(`${destinationCountry} is subject to a comprehensive U.S. embargo.`);
  if (isMilitaryEnd && !isItar) complianceNotes.push("Military end-use rule (MEU) — additional due diligence required.");
  complianceNotes.push("Conduct red-flag screening on all parties to the transaction.");
  complianceNotes.push("File Electronic Export Information (EEI) via AES for shipments >$2500.");
  if (!restricted) complianceNotes.push("Retain transaction records for 5 years per 15 CFR § 762.");

  return {
    check_id:          randomUUID(),
    product,
    destination_country: destinationCountry,
    end_use:           endUse,
    classification,
    eccn,
    itar_controlled:   isItar,
    license_required:  licenseRequired,
    license_type:      licenseType,
    restricted:        restricted,
    embargo_applies:   isEmbargoed,
    compliance_notes:  complianceNotes,
    fee_usd:           feePaid,
    checked_at:        new Date().toISOString(),
    disclaimer:        "This is a preliminary automated screening. Consult a licensed export control attorney for binding classification.",
  };
}
