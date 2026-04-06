import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const AG_PLATFORM_COMMISSION  = 0.18; // 18% on crop identification fee
const FEE_CROP_IDENTIFY       = 1.00; // per identification
const FEE_YIELD_FORECAST      = 2.00; // per forecast
const FEE_COMMODITY_ALERTS    = 5.00; // per month
const FEE_SOIL_ANALYSIS       = 1.50; // per analysis
const FEE_COMPLIANCE_CHECK    = 2.00; // per check

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ag_commodities (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE,
    symbol           TEXT,
    category         TEXT NOT NULL,
    unit             TEXT NOT NULL,
    current_price    REAL NOT NULL,
    prev_price       REAL NOT NULL,
    price_date       TEXT NOT NULL,
    exchange         TEXT,
    season_factor    TEXT DEFAULT '{}',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ag_crop_issues (
    id               TEXT PRIMARY KEY,
    crop_type        TEXT NOT NULL,
    issue_name       TEXT NOT NULL,
    issue_type       TEXT NOT NULL CHECK(issue_type IN ('disease','pest','nutrient_deficiency','abiotic')),
    symptoms         TEXT DEFAULT '[]',
    affected_regions TEXT DEFAULT '[]',
    seasons          TEXT DEFAULT '[]',
    severity_default TEXT DEFAULT 'moderate',
    treatments       TEXT DEFAULT '[]',
    prevention       TEXT DEFAULT '[]',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ag_yield_history (
    id               TEXT PRIMARY KEY,
    crop_type        TEXT NOT NULL,
    state            TEXT,
    year             INTEGER NOT NULL,
    yield_per_acre   REAL NOT NULL,
    unit             TEXT DEFAULT 'bushels',
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Commodities ─────────────────────────────────────────────────────────

const _commCount = db.prepare("SELECT COUNT(*) as n FROM ag_commodities").get().n;
if (_commCount === 0) {
  const commodities = [
    { name: "Corn (No. 2 Yellow)",    symbol: "ZC",  category: "grains",     unit: "$/bushel",    current_price: 4.82,  prev_price: 4.74,  price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Soybeans (No. 1 Yellow)",symbol: "ZS",  category: "oilseeds",   unit: "$/bushel",    current_price: 10.47, prev_price: 10.51, price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Soft Red Winter Wheat",  symbol: "ZW",  category: "grains",     unit: "$/bushel",    current_price: 5.39,  prev_price: 5.44,  price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Soybean Oil",            symbol: "ZL",  category: "oilseeds",   unit: "$/lb",        current_price: 0.4512, prev_price: 0.4488, price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Soybean Meal",           symbol: "ZM",  category: "oilseeds",   unit: "$/short ton", current_price: 295.40, prev_price: 293.20, price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Live Cattle",            symbol: "LE",  category: "livestock",  unit: "$/cwt",       current_price: 201.50, prev_price: 199.75, price_date: "2026-04-04", exchange: "CME" },
    { name: "Lean Hogs",              symbol: "HE",  category: "livestock",  unit: "$/cwt",       current_price: 88.40,  prev_price: 87.15,  price_date: "2026-04-04", exchange: "CME" },
    { name: "Class III Milk",         symbol: "DC",  category: "dairy",      unit: "$/cwt",       current_price: 18.95,  prev_price: 18.72,  price_date: "2026-04-04", exchange: "CME" },
    { name: "Cotton No. 2",           symbol: "CT",  category: "fiber",      unit: "$/lb",        current_price: 0.7218, prev_price: 0.7255, price_date: "2026-04-04", exchange: "ICE" },
    { name: "Arabica Coffee (C)",     symbol: "KC",  category: "soft",       unit: "$/lb",        current_price: 3.2840, prev_price: 3.1950, price_date: "2026-04-04", exchange: "ICE" },
    { name: "Raw Sugar No. 11",       symbol: "SB",  category: "soft",       unit: "$/lb",        current_price: 0.1934, prev_price: 0.1921, price_date: "2026-04-04", exchange: "ICE" },
    { name: "Cocoa",                  symbol: "CC",  category: "soft",       unit: "$/metric ton", current_price: 8150,  prev_price: 7920,   price_date: "2026-04-04", exchange: "ICE" },
    { name: "Rough Rice (Long Grain)",symbol: "ZR",  category: "grains",     unit: "$/cwt",       current_price: 15.42,  prev_price: 15.38,  price_date: "2026-04-04", exchange: "CBOT" },
    { name: "Feeder Cattle",          symbol: "GF",  category: "livestock",  unit: "$/cwt",       current_price: 281.25, prev_price: 279.50, price_date: "2026-04-04", exchange: "CME" },
    { name: "Natural Orange Juice (A)", symbol: "OJ", category: "soft",    unit: "$/lb",        current_price: 4.0150, prev_price: 4.1200, price_date: "2026-04-04", exchange: "ICE" },
  ];

  const insertComm = db.prepare(`
    INSERT OR IGNORE INTO ag_commodities
      (id, name, symbol, category, unit, current_price, prev_price, price_date, exchange)
    VALUES
      (@id, @name, @symbol, @category, @unit, @current_price, @prev_price, @price_date, @exchange)
  `);
  for (const row of commodities) insertComm.run({ id: randomUUID(), ...row });
}

// ─── Seed Crop Issues ─────────────────────────────────────────────────────────

const _issueCount = db.prepare("SELECT COUNT(*) as n FROM ag_crop_issues").get().n;
if (_issueCount === 0) {
  const issues = [
    { crop_type: "corn", issue_name: "Gray Leaf Spot", issue_type: "disease", symptoms: '["Gray rectangular lesions parallel to leaf veins","Tan/gray coloring on lower leaves first","Premature leaf death in severe cases"]', affected_regions: '["Midwest","Southeast","Eastern Corn Belt"]', seasons: '["summer","fall"]', severity_default: "high", treatments: '["Apply fungicide (azoxystrobin, pyraclostrobin) at VT/R1 stage","Remove infected residue after harvest","Foliar application of triazole fungicides"]', prevention: '["Plant resistant hybrids","Rotate with soybeans or wheat","Minimum-till or no-till increases risk — monitor closely","Improve air circulation through plant spacing"]' },
    { crop_type: "corn", issue_name: "Northern Corn Leaf Blight", issue_type: "disease", symptoms: '["Cigar-shaped tan/gray lesions 1-6 inches long","Lesions appear on lower leaves and move upward","Dark sporulation visible inside lesion"]', affected_regions: '["Great Plains","Midwest","Upper Midwest"]', seasons: '["summer"]', severity_default: "moderate", treatments: '["Fungicide application (propiconazole, tebuconazole) before tasseling","Avoid dense plantings"]', prevention: '["Resistant hybrid selection primary control","Crop rotation reduces inoculum","Avoid overhead irrigation"]' },
    { crop_type: "corn", issue_name: "Western Corn Rootworm", issue_type: "pest", symptoms: '["Lodging/goosenecking of plants","Silk clipping by adult beetles","Pruned roots — node injury scale 1-3+","Wilting in dry weather"]', affected_regions: '["Corn Belt","Great Plains"]', seasons: '["spring","summer"]', severity_default: "high", treatments: '["Soil-applied insecticide at planting","Foliar insecticide for adult control","Bt traits (Cry3Bb1, mCry3A) with refuge compliance"]', prevention: '["Annual crop rotation is gold standard control","Avoid continuous corn plantings","Pyramid Bt traits to delay resistance"]' },
    { crop_type: "soybean", issue_name: "Soybean Cyst Nematode (SCN)", issue_type: "pest", symptoms: '["Patchy yellowing and stunting","Small white or yellow cysts on roots","Reduced nodulation","Yield drag 5-30%+ with no obvious symptoms"]', affected_regions: '["Midwest","Mid-South","Southeast"]', seasons: '["spring","summer"]', severity_default: "high", treatments: '["Nematicide seed treatments (fluopyram, abamectin)","Rotate resistant varieties","Biocontrol inoculants (Bacillus firmus)"]', prevention: '["Rotate with corn or small grains","Plant SCN-resistant varieties (PI88788 or Peking source)","Test fields before planting","Sanitize equipment"]' },
    { crop_type: "soybean", issue_name: "Sudden Death Syndrome (SDS)", issue_type: "disease", symptoms: '["Yellow spots between leaf veins (interveinal chlorosis)","Dead leaf tissue with green veins","Roots turn brown; internal stem tissue grey-brown","Premature defoliation"]', affected_regions: '["Midwest","Iowa","Illinois","Indiana"]', seasons: '["spring","summer"]', severity_default: "high", treatments: '["Fluopyram seed treatment (ILeVO) reduces severity","No rescue treatment after infection","Improve field drainage"]', prevention: '["Delay planting until soil >50°F","Seed treatment fungicides","Improve drainage in problem areas","Choose tolerant varieties"]' },
    { crop_type: "wheat", issue_name: "Fusarium Head Blight (Scab)", issue_type: "disease", symptoms: '["Bleached/pink spikelets during grain fill","Pink/orange spore masses on infected tissue","Shrunken, chalky kernels (tombstones)","DON (vomitoxin) mycotoxin contamination"]', affected_regions: '["Great Plains","Midwest","Mid-Atlantic"]', seasons: '["spring"]', severity_default: "critical", treatments: '["Apply fungicide (Miravis Ace, Prosaro) at early anthesis","Only 60-70% efficacy — timing critical","Harvest early to limit toxin accumulation"]', prevention: '["Plant resistant/moderately resistant varieties","Rotate with corn increases risk — avoid","Monitor for disease risk using Scab Risk Tool","Plant on well-drained soils"]' },
    { crop_type: "cotton", issue_name: "Boll Weevil", issue_type: "pest", symptoms: '["Small round punctures in squares and bolls","Yellowing of squares before shedding","Premature shedding of squares and bolls","Small white larvae inside affected bolls"]', affected_regions: '["Southeast","Texas","Mid-South"]', seasons: '["summer"]', severity_default: "critical", treatments: '["Malathion or pyrethroid application when threshold exceeded","Aerial application for large infestations"]', prevention: '["Boll Weevil Eradication Program compliance","Pheromone trap monitoring","Destroy crop residue in fall","Early planting to escape peak populations"]' },
    { crop_type: "tomato", issue_name: "Late Blight (Phytophthora infestans)", issue_type: "disease", symptoms: '["Greasy gray-green water-soaked spots on leaves","White sporulation on underside of leaves","Brown lesions on stems","Rapid collapse in humid conditions"]', affected_regions: '["Northeast","Pacific Northwest","Midwest"]', seasons: '["summer","fall"]', severity_default: "critical", treatments: '["Copper-based fungicides for organic production","Chlorothalonil, mancozeb, metalaxyl preventively","Remove infected plant material immediately"]', prevention: '["Plant certified disease-free transplants","Avoid overhead irrigation","Ensure good air circulation","Monitor blight risk forecasts (BlightCast)"]' },
    { crop_type: "potato", issue_name: "Colorado Potato Beetle", issue_type: "pest", symptoms: '["Skeletonized leaves with orange egg masses on underside","Yellow/orange larvae with two rows of black spots","Complete defoliation in severe infestations"]', affected_regions: '["Northeast","Midwest","Mid-Atlantic"]', seasons: '["spring","summer"]', severity_default: "high", treatments: '["Spinosad, azadirachtin for organic options","Imidacloprid soil drench at planting","Rotate chemical classes to prevent resistance"]', prevention: '["Crop rotation essential — beetle overwinters in soil","Mulched beds reduce emergence","Trap cropping with eggplant","Bt tenebrionis for early instars"]' },
    { crop_type: "apple", issue_name: "Fire Blight (Erwinia amylovora)", issue_type: "disease", symptoms: '["Shoot tip death with shepherd crook appearance","Water-soaked blossoms that turn brown","Bark cankers with bacterial ooze","Characteristic shepherd hook wilting"]', affected_regions: '["Northeast","Midwest","Pacific Northwest"]', seasons: '["spring"]', severity_default: "high", treatments: '["Copper bactericides at green tip","Streptomycin at bloom (where permitted)","Prune infected wood 12 inches below visible infection","Sterilize pruning tools between cuts"]', prevention: '["Plant resistant rootstocks and scion varieties","Monitor fire blight risk models (Cougarblight, MARYBLYT)","Avoid excessive nitrogen fertilization","Control sucking insects that spread pathogen"]' },
  ];

  const insertIssue = db.prepare(`
    INSERT OR IGNORE INTO ag_crop_issues
      (id, crop_type, issue_name, issue_type, symptoms, affected_regions, seasons, severity_default, treatments, prevention)
    VALUES
      (@id, @crop_type, @issue_name, @issue_type, @symptoms, @affected_regions, @seasons, @severity_default, @treatments, @prevention)
  `);
  for (const row of issues) insertIssue.run({ id: randomUUID(), ...row });
}

// ─── Seed Yield History ───────────────────────────────────────────────────────

const _yieldCount = db.prepare("SELECT COUNT(*) as n FROM ag_yield_history").get().n;
if (_yieldCount === 0) {
  const yieldData = [
    { crop_type: "corn",    state: "IA", year: 2023, yield_per_acre: 199, unit: "bushels" },
    { crop_type: "corn",    state: "IA", year: 2024, yield_per_acre: 205, unit: "bushels" },
    { crop_type: "corn",    state: "IL", year: 2023, yield_per_acre: 201, unit: "bushels" },
    { crop_type: "corn",    state: "IL", year: 2024, yield_per_acre: 207, unit: "bushels" },
    { crop_type: "soybean", state: "IA", year: 2023, yield_per_acre: 50,  unit: "bushels" },
    { crop_type: "soybean", state: "IA", year: 2024, yield_per_acre: 52,  unit: "bushels" },
    { crop_type: "wheat",   state: "KS", year: 2023, yield_per_acre: 42,  unit: "bushels" },
    { crop_type: "wheat",   state: "KS", year: 2024, yield_per_acre: 44,  unit: "bushels" },
    { crop_type: "cotton",  state: "TX", year: 2023, yield_per_acre: 820, unit: "lbs" },
    { crop_type: "cotton",  state: "TX", year: 2024, yield_per_acre: 845, unit: "lbs" },
  ];
  const insertYield = db.prepare(`
    INSERT OR IGNORE INTO ag_yield_history (id, crop_type, state, year, yield_per_acre, unit)
    VALUES (@id, @crop_type, @state, @year, @yield_per_acre, @unit)
  `);
  for (const row of yieldData) insertYield.run({ id: randomUUID(), ...row });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function symptomsMatch(symptoms, issueSymptoms) {
  const parsedSymptoms = JSON.parse(issueSymptoms || "[]");
  const lower = symptoms.toLowerCase();
  return parsedSymptoms.filter(s => {
    const words = s.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    return words.some(w => lower.includes(w));
  }).length;
}

// ─── identifyCropIssue ────────────────────────────────────────────────────────

/**
 * Identify crop diseases, pests, or deficiencies from described symptoms.
 * @param {string} cropType  - Crop type (e.g. "corn", "soybean", "wheat")
 * @param {string} symptoms  - Description of observed symptoms
 * @param {string} location  - State or region (e.g. "Iowa", "Midwest")
 * @param {string} season    - Current season: spring|summer|fall|winter
 * @returns Diagnosis with treatment options, confidence scores, and prevention measures
 */
export function identifyCropIssue(cropType, symptoms, location = "", season = "summer") {
  if (!cropType) throw new Error("cropType is required");
  if (!symptoms) throw new Error("symptoms is required");

  const feePaid    = FEE_CROP_IDENTIFY;
  const commission = Math.round(feePaid * AG_PLATFORM_COMMISSION * 100) / 100;

  const crop = cropType.toLowerCase();
  let candidates = db.prepare("SELECT * FROM ag_crop_issues WHERE crop_type = ?").all(crop);
  if (candidates.length === 0) {
    candidates = db.prepare("SELECT * FROM ag_crop_issues LIMIT 5").all();
  }

  const scored = candidates.map(issue => {
    const symScore    = symptomsMatch(symptoms, issue.symptoms);
    const seasons     = JSON.parse(issue.seasons || "[]");
    const seasonBonus = seasons.includes(season.toLowerCase()) ? 1 : 0;
    const regions     = JSON.parse(issue.affected_regions || "[]");
    const regionBonus = regions.some(r => location.toLowerCase().includes(r.toLowerCase().split(",")[0])) ? 0.5 : 0;
    return { ...issue, _score: symScore + seasonBonus + regionBonus };
  }).sort((a, b) => b._score - a._score);

  const topDiagnoses = scored.slice(0, 3).map((issue, idx) => ({
    rank:             idx + 1,
    issue_name:       issue.issue_name,
    issue_type:       issue.issue_type,
    confidence_pct:   Math.max(20, Math.min(95, Math.round(80 - idx * 20 - (3 - issue._score) * 5))),
    symptoms_matched: JSON.parse(issue.symptoms || "[]"),
    severity:         issue.severity_default,
    affected_regions: JSON.parse(issue.affected_regions || "[]"),
    active_seasons:   JSON.parse(issue.seasons || "[]"),
    treatment_options: JSON.parse(issue.treatments || "[]"),
    prevention_measures: JSON.parse(issue.prevention || "[]"),
  }));

  return {
    identification_id:   randomUUID(),
    crop_type:           cropType,
    symptoms_described:  symptoms,
    location,
    season,
    diagnosis:           topDiagnoses,
    primary_diagnosis:   topDiagnoses[0] ?? null,
    confidence:          topDiagnoses[0]?.confidence_pct ?? 0,
    severity:            topDiagnoses[0]?.severity ?? "unknown",
    treatment_options:   topDiagnoses[0]?.treatment_options ?? [],
    prevention_measures: topDiagnoses[0]?.prevention_measures ?? [],
    recommendation:      "Confirm diagnosis with a local Cooperative Extension Service agronomist before applying treatments.",
    extension_resources: `https://extension.edu/search?q=${encodeURIComponent(cropType)}+disease+identification`,
    fee_usd:             feePaid,
    platform_commission_usd: commission,
    identified_at:       new Date().toISOString(),
  };
}

// ─── forecastYield ────────────────────────────────────────────────────────────

/**
 * Forecast crop yield based on crop type, acreage, location, planting date, and weather data.
 * @param {string} cropType      - Crop type (e.g. "corn", "soybeans")
 * @param {number} acreage       - Total acres planted
 * @param {string} location      - State or region
 * @param {string} plantingDate  - ISO date string (e.g. "2026-05-01")
 * @param {object} weatherData   - { avg_temp_f, total_precip_inches, growing_degree_days, drought_index }
 * @returns Yield forecast with confidence interval, risk factors, and comparison to historical average
 */
export function forecastYield(cropType, acreage, location, plantingDate, weatherData = {}) {
  if (!cropType)     throw new Error("cropType is required");
  if (!acreage || acreage <= 0) throw new Error("acreage must be a positive number");
  if (!location)     throw new Error("location is required");
  if (!plantingDate) throw new Error("plantingDate is required");

  const feePaid = FEE_YIELD_FORECAST;
  const crop    = cropType.toLowerCase();

  // Get historical baseline
  const state   = location.toUpperCase().slice(0, 2);
  const history = db.prepare("SELECT AVG(yield_per_acre) as avg_yield, unit FROM ag_yield_history WHERE crop_type = ?").get(crop);
  const stateHist = db.prepare("SELECT AVG(yield_per_acre) as avg_yield FROM ag_yield_history WHERE crop_type = ? AND state = ?").get(crop, state);

  // Default baselines if no history
  const baselineYields = { corn: 200, soybean: 51, wheat: 43, cotton: 850, rice: 7600, potato: 44000, tomato: 40000 };
  const units = { corn: "bushels", soybean: "bushels", wheat: "bushels", cotton: "lbs", rice: "lbs", potato: "cwt", tomato: "lbs" };
  const baseYield  = stateHist?.avg_yield ?? history?.avg_yield ?? baselineYields[crop] ?? 100;
  const unit       = history?.unit ?? units[crop] ?? "units";

  // Weather adjustments
  const {
    avg_temp_f          = 72,
    total_precip_inches = 18,
    growing_degree_days = 2800,
    drought_index       = 0,   // 0 = no drought, 4 = exceptional drought (PDSI)
  } = weatherData;

  const riskFactors  = [];
  let yieldModifier  = 1.0;

  if (drought_index >= 3) { yieldModifier -= 0.25; riskFactors.push({ factor: "Exceptional drought stress", impact: "-25% yield estimate" }); }
  else if (drought_index >= 2) { yieldModifier -= 0.12; riskFactors.push({ factor: "Severe drought conditions", impact: "-12% yield estimate" }); }
  else if (drought_index >= 1) { yieldModifier -= 0.06; riskFactors.push({ factor: "Moderate drought stress", impact: "-6% yield estimate" }); }

  if (total_precip_inches < 12) { yieldModifier -= 0.10; riskFactors.push({ factor: "Below-optimal precipitation", impact: "-10% yield estimate" }); }
  if (avg_temp_f > 90)          { yieldModifier -= 0.08; riskFactors.push({ factor: "Heat stress during pollination", impact: "-8% yield estimate" }); }
  if (growing_degree_days < 2200) { yieldModifier -= 0.05; riskFactors.push({ factor: "Insufficient growing degree days", impact: "-5% yield estimate" }); }
  if (yieldModifier >= 1.02) riskFactors.push({ factor: "Favorable growing conditions", impact: "+2% above average" });

  // Planting date penalty for late planting
  const plantDate   = new Date(plantingDate);
  const optimalDate = new Date(plantDate.getFullYear() + "-05-01");
  const daysLate    = Math.max(0, Math.round((plantDate - optimalDate) / 86400000));
  if (daysLate > 14) {
    const latePenalty = Math.min(0.20, daysLate * 0.005);
    yieldModifier -= latePenalty;
    riskFactors.push({ factor: `Late planting (${daysLate} days past optimal)`, impact: `-${Math.round(latePenalty * 100)}% yield estimate` });
  }

  const estimatedYieldPerAcre = Math.max(0, Math.round(baseYield * yieldModifier * 10) / 10);
  const estimatedTotalYield   = Math.round(estimatedYieldPerAcre * acreage * 10) / 10;
  const variance              = estimatedYieldPerAcre * 0.12;

  return {
    forecast_id:            randomUUID(),
    crop_type:              cropType,
    acreage,
    location,
    planting_date:          plantingDate,
    estimated_yield_per_acre:  estimatedYieldPerAcre,
    yield_unit:             unit,
    estimated_total_yield:  estimatedTotalYield,
    confidence_interval: {
      low:    Math.max(0, Math.round((estimatedYieldPerAcre - variance * 1.5) * 10) / 10),
      median: estimatedYieldPerAcre,
      high:   Math.round((estimatedYieldPerAcre + variance * 1.5) * 10) / 10,
    },
    historical_average_per_acre: Math.round(baseYield * 10) / 10,
    comparison_to_average:  `${yieldModifier >= 1 ? "+" : ""}${Math.round((yieldModifier - 1) * 100)}% vs historical average`,
    yield_modifier_applied: Math.round(yieldModifier * 1000) / 1000,
    risk_factors:           riskFactors.length > 0 ? riskFactors : [{ factor: "No significant risk factors identified", impact: "Baseline yield expected" }],
    weather_inputs:         weatherData,
    revenue_estimate_usd:   null, // Caller should multiply by current commodity price
    fee_usd:                feePaid,
    forecast_date:          new Date().toISOString(),
    disclaimer:             "Yield forecast is an estimate based on historical data and provided weather inputs. Actual results will vary.",
  };
}

// ─── getCommodityAlerts ───────────────────────────────────────────────────────

/**
 * Get price alerts and market trends for specified agricultural commodities.
 * @param {string[]} commodities    - Commodity names or symbols (e.g. ["Corn", "ZS", "Cotton"])
 * @param {object}   priceThresholds - { "Corn": { above: 5.00, below: 4.50 } }
 * @returns Current prices, triggered alerts, market trends, and nearby futures
 */
export function getCommodityAlerts(commodities = [], priceThresholds = {}) {
  const feePaid = FEE_COMMODITY_ALERTS;

  let allComms;
  if (commodities.length === 0) {
    allComms = db.prepare("SELECT * FROM ag_commodities").all();
  } else {
    allComms = db.prepare("SELECT * FROM ag_commodities").all().filter(c =>
      commodities.some(q =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        (c.symbol && c.symbol.toLowerCase() === q.toLowerCase())
      )
    );
    if (allComms.length === 0) {
      allComms = db.prepare("SELECT * FROM ag_commodities").all();
    }
  }

  const alertsTriggered = [];
  const currentPrices   = allComms.map(c => {
    const change     = c.current_price - c.prev_price;
    const changePct  = Math.round((change / c.prev_price) * 10000) / 100;
    const thresholds = priceThresholds[c.name] ?? priceThresholds[c.symbol] ?? {};

    if (thresholds.above && c.current_price > thresholds.above) {
      alertsTriggered.push({ commodity: c.name, symbol: c.symbol, type: "ABOVE_THRESHOLD",
        current_price: c.current_price, threshold: thresholds.above, unit: c.unit,
        message: `${c.name} at ${c.current_price} ${c.unit} — above your alert threshold of ${thresholds.above}` });
    }
    if (thresholds.below && c.current_price < thresholds.below) {
      alertsTriggered.push({ commodity: c.name, symbol: c.symbol, type: "BELOW_THRESHOLD",
        current_price: c.current_price, threshold: thresholds.below, unit: c.unit,
        message: `${c.name} at ${c.current_price} ${c.unit} — below your alert threshold of ${thresholds.below}` });
    }

    return { name: c.name, symbol: c.symbol, category: c.category, exchange: c.exchange,
              current_price: c.current_price, unit: c.unit, prev_price: c.prev_price,
              change: Math.round(change * 10000) / 10000, change_pct: changePct,
              direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
              price_date: c.price_date };
  });

  const trendsByCategory = {};
  for (const cp of currentPrices) {
    if (!trendsByCategory[cp.category]) trendsByCategory[cp.category] = [];
    trendsByCategory[cp.category].push(cp.change_pct);
  }
  const marketTrends = Object.entries(trendsByCategory).map(([category, changes]) => ({
    category,
    avg_change_pct: Math.round(changes.reduce((a, b) => a + b, 0) / changes.length * 100) / 100,
    direction:      changes.reduce((a, b) => a + b, 0) > 0 ? "bullish" : "bearish",
  }));

  // Simulated nearby futures (spot + typical carry)
  const futuresPrices = currentPrices.slice(0, 5).map(c => ({
    name:          c.name,
    symbol:        c.symbol,
    spot:          c.current_price,
    front_month:   Math.round(c.current_price * 1.008 * 10000) / 10000,
    three_month:   Math.round(c.current_price * 1.018 * 10000) / 10000,
    six_month:     Math.round(c.current_price * 1.031 * 10000) / 10000,
    unit:          c.unit,
    curve_shape:   c.current_price * 1.031 > c.current_price ? "contango" : "backwardation",
  }));

  return {
    alert_id:         randomUUID(),
    commodities_monitored: commodities.length > 0 ? commodities : "all",
    current_prices:   currentPrices,
    alerts_triggered: alertsTriggered,
    alerts_count:     alertsTriggered.length,
    market_trends:    marketTrends,
    futures_prices:   futuresPrices,
    fee_usd:          feePaid,
    data_source:      "CME Group / ICE Futures (simulated — subscribe to live feeds for real-time data)",
    retrieved_at:     new Date().toISOString(),
  };
}

// ─── analyzeSoilReport ────────────────────────────────────────────────────────

/**
 * Interpret a soil analysis report and provide fertilization recommendations.
 * @param {object} soilMetrics - { ph, organic_matter_pct, nitrogen_ppm, phosphorus_ppm, potassium_ppm, cec, sand_pct, silt_pct, clay_pct }
 * @param {string} cropType    - Intended crop (e.g. "corn", "soybean")
 * @param {string} location    - State or region
 * @returns Soil quality score, nutrient levels, amendment recommendations, and estimated cost
 */
export function analyzeSoilReport(soilMetrics, cropType, location = "") {
  if (!soilMetrics || typeof soilMetrics !== "object") throw new Error("soilMetrics object is required");
  if (!cropType) throw new Error("cropType is required");

  const feePaid = FEE_SOIL_ANALYSIS;

  const {
    ph = 6.5,
    organic_matter_pct = 2.5,
    nitrogen_ppm = 15,
    phosphorus_ppm = 25,
    potassium_ppm = 150,
    cec = 15,
    sand_pct = 40,
    silt_pct = 40,
    clay_pct = 20,
  } = soilMetrics;

  // Crop-specific optimal ranges
  const optimalRanges = {
    corn:     { ph: [6.0, 6.8], n: [20, 40], p: [30, 60], k: [150, 250], om: [2.5, 5.0] },
    soybean:  { ph: [6.0, 6.8], n: [10, 25], p: [25, 50], k: [130, 220], om: [2.0, 4.5] },
    wheat:    { ph: [5.8, 7.0], n: [15, 30], p: [20, 40], k: [120, 200], om: [1.5, 3.5] },
    alfalfa:  { ph: [6.5, 7.5], n: [5, 15],  p: [30, 60], k: [200, 300], om: [2.0, 4.0] },
    potato:   { ph: [4.8, 5.5], n: [20, 40], p: [40, 80], k: [200, 350], om: [2.0, 4.0] },
    default:  { ph: [6.0, 7.0], n: [15, 35], p: [25, 55], k: [140, 230], om: [2.0, 4.5] },
  };

  const ranges     = optimalRanges[cropType.toLowerCase()] ?? optimalRanges.default;
  const nutrientLevels = {};
  const amendments = [];

  const rateLevel = (val, low, high, name, unit) => {
    let level, score;
    if      (val < low * 0.7)     { level = "very_low";  score = 1; }
    else if (val < low)           { level = "low";        score = 2; }
    else if (val <= high)         { level = "optimal";    score = 4; }
    else if (val <= high * 1.5)   { level = "high";       score = 3; }
    else                          { level = "very_high";  score = 2; }
    return { value: val, unit, optimal_range: `${low}–${high} ${unit}`, level, score };
  };

  nutrientLevels.ph                = rateLevel(ph,               ranges.ph[0],  ranges.ph[1],  "pH",     "pH units");
  nutrientLevels.organic_matter    = rateLevel(organic_matter_pct, ranges.om[0], ranges.om[1], "OM",     "%");
  nutrientLevels.nitrogen          = rateLevel(nitrogen_ppm,      ranges.n[0],   ranges.n[1],  "N",      "ppm");
  nutrientLevels.phosphorus        = rateLevel(phosphorus_ppm,    ranges.p[0],   ranges.p[1],  "P",      "ppm");
  nutrientLevels.potassium         = rateLevel(potassium_ppm,     ranges.k[0],   ranges.k[1],  "K",      "ppm");

  const scores   = Object.values(nutrientLevels).map(n => n.score);
  const soilQualityScore = Math.round((scores.reduce((a, b) => a + b, 0) / (scores.length * 4)) * 100);

  // Amendments
  if (nutrientLevels.ph.level === "very_low" || nutrientLevels.ph.level === "low") {
    amendments.push({ amendment: "Ag Lime (CaCO3)", rate: "2–4 tons/acre", purpose: "Raise soil pH", estimated_cost_per_acre: 60 });
  }
  if (ph > ranges.ph[1] + 0.5) {
    amendments.push({ amendment: "Elemental Sulfur", rate: "300–600 lbs/acre", purpose: "Lower soil pH", estimated_cost_per_acre: 45 });
  }
  if (nutrientLevels.nitrogen.level === "low" || nutrientLevels.nitrogen.level === "very_low") {
    amendments.push({ amendment: "Urea (46-0-0) or Anhydrous Ammonia", rate: "120–180 lbs N/acre", purpose: "Supply nitrogen", estimated_cost_per_acre: 85 });
  }
  if (nutrientLevels.phosphorus.level === "low" || nutrientLevels.phosphorus.level === "very_low") {
    amendments.push({ amendment: "Diammonium Phosphate (DAP 18-46-0)", rate: "100–200 lbs/acre", purpose: "Build phosphorus", estimated_cost_per_acre: 70 });
  }
  if (nutrientLevels.potassium.level === "low" || nutrientLevels.potassium.level === "very_low") {
    amendments.push({ amendment: "Potash (0-0-60)", rate: "150–250 lbs/acre", purpose: "Build potassium", estimated_cost_per_acre: 55 });
  }
  if (organic_matter_pct < ranges.om[0]) {
    amendments.push({ amendment: "Composted Manure or Cover Crop Incorporation", rate: "5–10 tons/acre", purpose: "Build organic matter", estimated_cost_per_acre: 40 });
  }

  const texture = sand_pct > 70 ? "Sandy" : clay_pct > 40 ? "Clay" : silt_pct > 50 ? "Silty" : "Loam";
  const totalCostEstimate = amendments.reduce((sum, a) => sum + a.estimated_cost_per_acre, 0);

  return {
    analysis_id:        randomUUID(),
    crop_type:          cropType,
    location,
    soil_texture:       texture,
    soil_quality_score: soilQualityScore,
    quality_rating:     soilQualityScore >= 80 ? "Excellent" : soilQualityScore >= 60 ? "Good" : soilQualityScore >= 40 ? "Fair" : "Poor",
    nutrient_levels:    nutrientLevels,
    cec,
    recommendations: [
      `Soil texture: ${texture} — ${clay_pct > 35 ? "good water retention, may need tile drainage" : sand_pct > 65 ? "low water retention, consider irrigation scheduling" : "balanced texture, well-suited for most crops"}`,
      `CEC of ${cec} indicates ${cec > 20 ? "high" : cec > 10 ? "medium" : "low"} nutrient-holding capacity.`,
      amendments.length > 0 ? `${amendments.length} amendments recommended before planting.` : "Soil is in good condition for the target crop.",
    ],
    amendments_needed:         amendments,
    estimated_amendment_cost:  { per_acre_usd: totalCostEstimate, note: "Materials only; application costs extra ($15–$35/acre typical)" },
    fee_usd:                   feePaid,
    analyzed_at:               new Date().toISOString(),
    disclaimer:                "Soil test interpretation is based on general agronomic guidelines. Consult your local Extension office for region-specific recommendations.",
  };
}

// ─── checkAgCompliance ────────────────────────────────────────────────────────

/**
 * Check USDA and EPA compliance requirements for a farm operation.
 * @param {string}   farmType   - Farm type: conventional|organic|concentrated_animal_feeding|aquaculture|small_farm
 * @param {string}   state      - 2-letter US state code
 * @param {string[]} activities - Activities performed (e.g. ["pesticide_application","nutrient_management","livestock"])
 * @returns Compliance status, required certifications, deadlines, and eligible programs
 */
export function checkAgCompliance(farmType, state, activities = []) {
  if (!farmType) throw new Error("farmType is required");
  if (!state)    throw new Error("state is required");

  const feePaid  = FEE_COMPLIANCE_CHECK;
  const fType    = farmType.toLowerCase();
  const stateUp  = state.toUpperCase();
  const actLower = activities.map(a => a.toLowerCase());

  const requirements = [];
  const certifications = [];
  const deadlines = [];
  const eligiblePrograms = [];
  const issues = [];

  // Universal requirements
  requirements.push("USDA Farm Service Agency (FSA) registration required for most federal programs.");
  requirements.push("File Schedule F (Profit or Loss from Farming) with IRS annually.");
  requirements.push("Maintain farm records for minimum 3 years for FSA and USDA audit purposes.");

  // Organic requirements
  if (fType === "organic") {
    certifications.push({ cert: "USDA National Organic Program (NOP) Certification", issuer: "USDA-accredited certifier", cost_usd: 750, annual_renewal: true });
    requirements.push("Maintain organic system plan (OSP) updated annually.");
    requirements.push("Use only OMRI-listed inputs; maintain input purchase records.");
    requirements.push("3-year transition period from last prohibited substance application.");
    deadlines.push({ deadline: "Annual organic certificate renewal", timing: "Before certification anniversary date" });
    eligiblePrograms.push({ program: "Organic Certification Cost Share Program (OCCSP)", benefit: "Up to 75% of certification costs, max $750/scope" });
  }

  // CAFO requirements
  if (fType === "concentrated_animal_feeding") {
    requirements.push("NPDES permit required for large CAFOs (EPA 40 CFR Part 122).");
    requirements.push("Nutrient management plan (NMP) required — developed by certified planner.");
    requirements.push("Annual discharge monitoring reports (DMR) filed with state agency.");
    certifications.push({ cert: "NPDES CAFO Permit", issuer: `${stateUp} Environmental Agency / EPA Region`, cost_usd: 2000, annual_renewal: false });
    deadlines.push({ deadline: "Annual NMP review and update", timing: "Before each crop year" });
    deadlines.push({ deadline: "Discharge monitoring report", timing: "Quarterly — due 28 days after period end" });
    eligiblePrograms.push({ program: "Environmental Quality Incentives Program (EQIP)", benefit: "Cost-share for waste storage facilities, feed management" });
  }

  // Pesticide activities
  if (actLower.some(a => a.includes("pesticide") || a.includes("spray"))) {
    requirements.push("Certified Pesticide Applicator license required for restricted-use pesticides (40 CFR Part 171).");
    requirements.push("Maintain pesticide application records 2+ years (EPA 40 CFR Part 170).");
    requirements.push("Worker Protection Standard (WPS) training for agricultural workers.");
    certifications.push({ cert: "State Pesticide Applicator Certification", issuer: `${stateUp} Department of Agriculture`, cost_usd: 50, annual_renewal: false });
    deadlines.push({ deadline: "WPS Safety Training for workers/handlers", timing: "Before first exposure to pesticide-treated areas" });
  }

  // Nutrient management
  if (actLower.some(a => a.includes("nutrient") || a.includes("fertilizer") || a.includes("manure"))) {
    requirements.push("Nutrient management plan required in most states if applying >50 lbs N/acre.");
    requirements.push("Manure application setback requirements — typically 100 ft from waterways.");
    deadlines.push({ deadline: "State nutrient management plan review", timing: "Annually before application season" });
  }

  // Livestock activities
  if (actLower.some(a => a.includes("livestock") || a.includes("cattle") || a.includes("poultry"))) {
    requirements.push("Brand registration required in most western states for cattle.");
    requirements.push("USDA APHIS Animal Identification (840 tag) for interstate movement.");
    eligiblePrograms.push({ program: "Livestock Forage Disaster Program (LFP)", benefit: "Compensation for forage losses due to drought or fire" });
    eligiblePrograms.push({ program: "Livestock Risk Protection (LRP) Insurance", benefit: "Price risk protection for feeder cattle, fed cattle, swine" });
  }

  // Water usage
  if (actLower.some(a => a.includes("irrigation") || a.includes("water"))) {
    requirements.push("Water right or water use permit required in most western states.");
    requirements.push("Irrigation water management plan required for EQIP water efficiency practices.");
  }

  // General programs all farms may qualify for
  eligiblePrograms.push({ program: "Conservation Reserve Program (CRP)", benefit: "Annual rental payments for enrolling sensitive land in conservation cover" });
  eligiblePrograms.push({ program: "Agricultural Risk Coverage (ARC) / Price Loss Coverage (PLC)", benefit: "Revenue and price support for covered commodity producers" });
  eligiblePrograms.push({ program: "Noninsured Crop Disaster Assistance Program (NAP)", benefit: "Financial assistance for non-insurable crops affected by disaster" });

  const compliant = issues.length === 0;

  return {
    check_id:             randomUUID(),
    farm_type:            farmType,
    state:                stateUp,
    activities_reviewed:  activities,
    compliant,
    compliance_summary:   compliant
      ? `No immediate compliance gaps identified for a ${farmType} operation in ${stateUp}.`
      : `${issues.length} compliance issue(s) require attention.`,
    requirements,
    certifications_needed: certifications,
    reporting_deadlines:   deadlines,
    programs_eligible:     eligiblePrograms,
    state_resources: {
      fsa_office:       `https://offices.sc.egov.usda.gov/locator/app?state=${stateUp}&agency=FSA`,
      extension_office: `https://nifa.usda.gov/land-grant-colleges-and-universities-partner-website-directory`,
      epa_region:       `https://www.epa.gov/aboutepa/regional-and-geographic-offices`,
    },
    fee_usd:              feePaid,
    checked_at:           new Date().toISOString(),
    disclaimer:           "This is a general compliance overview. Consult a licensed agricultural attorney and your state Department of Agriculture for binding compliance guidance.",
  };
}
