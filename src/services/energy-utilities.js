import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ENERGY_PLATFORM_FEE = 0.20; // 20% platform margin
const FEES = {
  analyzeEnergyBill:    1.00,
  compareProviders:     0.50,
  forecastConsumption:  1.00,
  auditEfficiency:      3.00,
  optimizeSchedule:     0.50,
  getEnergyDashboard:   2.00, // per month
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS energy_providers (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    region            TEXT NOT NULL,
    fuel_type         TEXT NOT NULL CHECK(fuel_type IN ('electricity','gas','dual','renewable')),
    rate_kwh          REAL NOT NULL,
    plan_type         TEXT NOT NULL CHECK(plan_type IN ('fixed','variable','time_of_use','tiered')),
    estimated_monthly REAL NOT NULL,
    green_pct         INTEGER DEFAULT 0,
    contract_months   INTEGER DEFAULT 12,
    signup_bonus_usd  REAL DEFAULT 0,
    cancellation_fee  REAL DEFAULT 0,
    available         INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_bill_analyses (
    id                   TEXT PRIMARY KEY,
    current_provider     TEXT,
    location             TEXT,
    current_cost_usd     REAL,
    optimal_provider     TEXT,
    savings_pct          REAL,
    switching_rec        TEXT,
    usage_kwh            REAL,
    fee_usd              REAL DEFAULT 1.0,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_forecasts (
    id               TEXT PRIMARY KEY,
    location         TEXT,
    period_start     TEXT,
    period_end       TEXT,
    forecast_json    TEXT,
    peak_demand_kw   REAL,
    efficiency_score INTEGER,
    fee_usd          REAL DEFAULT 1.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_audits (
    id               TEXT PRIMARY KEY,
    building_type    TEXT,
    sqft             INTEGER,
    location         TEXT,
    efficiency_score INTEGER,
    issues_json      TEXT,
    recs_json        TEXT,
    estimated_savings REAL,
    fee_usd          REAL DEFAULT 3.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_schedules (
    id                 TEXT PRIMARY KEY,
    device_count       INTEGER,
    estimated_savings  REAL,
    peak_avoidance_pct REAL,
    schedule_json      TEXT,
    fee_usd            REAL DEFAULT 0.5,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_dashboards (
    id                  TEXT PRIMARY KEY,
    account_id          TEXT NOT NULL,
    total_kwh           REAL,
    cost_trend_json     TEXT,
    peak_usage_kw       REAL,
    carbon_kg           REAL,
    comparison_pct      REAL,
    fee_usd             REAL DEFAULT 2.0,
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Providers ───────────────────────────────────────────────────────────

const _providerCount = db.prepare("SELECT COUNT(*) as n FROM energy_providers").get().n;
if (_providerCount === 0) {
  const seedProviders = [
    { id: uuid(), name: "GreenWave Energy",      region: "Northeast",  fuel_type: "renewable",    rate_kwh: 0.112, plan_type: "fixed",       estimated_monthly: 89,  green_pct: 100, contract_months: 24, signup_bonus_usd: 50,  cancellation_fee: 100 },
    { id: uuid(), name: "PowerGrid Direct",       region: "Southeast",  fuel_type: "electricity",  rate_kwh: 0.098, plan_type: "variable",    estimated_monthly: 78,  green_pct: 12,  contract_months: 0,  signup_bonus_usd: 0,   cancellation_fee: 0   },
    { id: uuid(), name: "SolarFirst Utilities",   region: "Southwest",  fuel_type: "renewable",    rate_kwh: 0.105, plan_type: "time_of_use", estimated_monthly: 84,  green_pct: 95,  contract_months: 12, signup_bonus_usd: 75,  cancellation_fee: 50  },
    { id: uuid(), name: "MidWest Gas & Electric", region: "Midwest",    fuel_type: "dual",         rate_kwh: 0.093, plan_type: "tiered",      estimated_monthly: 102, green_pct: 8,   contract_months: 12, signup_bonus_usd: 0,   cancellation_fee: 75  },
    { id: uuid(), name: "CleanStream Power",      region: "Northwest",  fuel_type: "renewable",    rate_kwh: 0.088, plan_type: "fixed",       estimated_monthly: 70,  green_pct: 100, contract_months: 36, signup_bonus_usd: 100, cancellation_fee: 150 },
    { id: uuid(), name: "NationalGrid Plus",      region: "Northeast",  fuel_type: "electricity",  rate_kwh: 0.119, plan_type: "variable",    estimated_monthly: 95,  green_pct: 22,  contract_months: 0,  signup_bonus_usd: 25,  cancellation_fee: 0   },
    { id: uuid(), name: "SunBelt Energy",         region: "Southeast",  fuel_type: "renewable",    rate_kwh: 0.101, plan_type: "time_of_use", estimated_monthly: 81,  green_pct: 88,  contract_months: 12, signup_bonus_usd: 50,  cancellation_fee: 50  },
    { id: uuid(), name: "RockyMtn Power Co",      region: "Mountain",   fuel_type: "dual",         rate_kwh: 0.096, plan_type: "tiered",      estimated_monthly: 97,  green_pct: 35,  contract_months: 24, signup_bonus_usd: 0,   cancellation_fee: 100 },
    { id: uuid(), name: "Atlantic Utility Group", region: "Northeast",  fuel_type: "gas",          rate_kwh: 0.082, plan_type: "fixed",       estimated_monthly: 65,  green_pct: 5,   contract_months: 12, signup_bonus_usd: 0,   cancellation_fee: 50  },
    { id: uuid(), name: "PacificElectric Pro",    region: "Pacific",    fuel_type: "electricity",  rate_kwh: 0.134, plan_type: "time_of_use", estimated_monthly: 107, green_pct: 45,  contract_months: 0,  signup_bonus_usd: 0,   cancellation_fee: 0   },
    { id: uuid(), name: "WindRush Cooperative",   region: "Midwest",    fuel_type: "renewable",    rate_kwh: 0.086, plan_type: "variable",    estimated_monthly: 69,  green_pct: 100, contract_months: 0,  signup_bonus_usd: 0,   cancellation_fee: 0   },
    { id: uuid(), name: "TexStar Energy",         region: "Southwest",  fuel_type: "dual",         rate_kwh: 0.091, plan_type: "variable",    estimated_monthly: 73,  green_pct: 18,  contract_months: 0,  signup_bonus_usd: 30,  cancellation_fee: 0   },
  ];
  const insertProvider = db.prepare(`
    INSERT OR IGNORE INTO energy_providers
      (id, name, region, fuel_type, rate_kwh, plan_type, estimated_monthly,
       green_pct, contract_months, signup_bonus_usd, cancellation_fee)
    VALUES
      (@id, @name, @region, @fuel_type, @rate_kwh, @plan_type, @estimated_monthly,
       @green_pct, @contract_months, @signup_bonus_usd, @cancellation_fee)
  `);
  for (const p of seedProviders) insertProvider.run(p);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function regionForLocation(location) {
  const loc = (location || "").toLowerCase();
  if (/new york|boston|philadelphia|connecticut|maine|vermont|rhode/.test(loc)) return "Northeast";
  if (/florida|georgia|carolina|tennessee|alabama|mississippi|louisiana/.test(loc)) return "Southeast";
  if (/california|oregon|washington/.test(loc)) return "Pacific";
  if (/texas|arizona|new mexico|oklahoma/.test(loc)) return "Southwest";
  if (/colorado|utah|nevada|idaho|montana|wyoming/.test(loc)) return "Mountain";
  if (/illinois|ohio|michigan|indiana|wisconsin|minnesota|iowa|missouri/.test(loc)) return "Midwest";
  if (/seattle|portland|idaho/.test(loc)) return "Northwest";
  return "Midwest"; // default
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ─── analyzeEnergyBill ────────────────────────────────────────────────────────

/**
 * Scan an energy bill, extract usage patterns, compare providers, and recommend savings.
 * @param {object} billData       - Raw bill data: { total_usd, usage_kwh, billing_period, line_items[] }
 * @param {string} currentProvider - Name of current energy provider
 * @param {string} location        - City, state, or region
 * @returns Analysis with current_cost, optimal_provider, savings_pct, switching_recommendation, usage_breakdown
 * Fee: $1.00 per analysis
 */
export function analyzeEnergyBill(billData, currentProvider, location) {
  if (!billData)        throw new Error("billData is required");
  if (!currentProvider) throw new Error("currentProvider is required");
  if (!location)        throw new Error("location is required");

  const currentCost = billData.total_usd ?? randomBetween(75, 180);
  const usageKwh    = billData.usage_kwh  ?? randomBetween(600, 1400);
  const region      = regionForLocation(location);

  // Find cheapest available provider in region (excluding current)
  const bestProvider = db.prepare(`
    SELECT * FROM energy_providers
    WHERE region = ? AND name != ? AND available = 1
    ORDER BY rate_kwh ASC
    LIMIT 1
  `).get(region, currentProvider) ?? db.prepare(
    "SELECT * FROM energy_providers WHERE available = 1 ORDER BY rate_kwh ASC LIMIT 1"
  ).get();

  const optimalMonthly = bestProvider
    ? Math.round(usageKwh * bestProvider.rate_kwh * 100) / 100
    : currentCost * 0.82;

  const savingsPct = Math.round(((currentCost - optimalMonthly) / currentCost) * 100 * 10) / 10;

  const usageBreakdown = {
    heating_cooling_pct: 45,
    water_heating_pct:   18,
    appliances_pct:      15,
    lighting_pct:        12,
    electronics_pct:     7,
    other_pct:           3,
    base_charge_usd:     Math.round(currentCost * 0.12 * 100) / 100,
    energy_charge_usd:   Math.round(currentCost * 0.78 * 100) / 100,
    taxes_fees_usd:      Math.round(currentCost * 0.10 * 100) / 100,
  };

  const switchRec = savingsPct >= 5
    ? `Switch to ${bestProvider?.name ?? "optimal provider"} to save ~${savingsPct}% ($${Math.round((currentCost - optimalMonthly) * 12)}/year).`
    : "Your current rate is competitive. Consider a time-of-use plan to optimize further.";

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO energy_bill_analyses
      (id, current_provider, location, current_cost_usd, optimal_provider, savings_pct, switching_rec, usage_kwh, fee_usd)
    VALUES
      (@id, @current_provider, @location, @current_cost_usd, @optimal_provider, @savings_pct, @switching_rec, @usage_kwh, @fee_usd)
  `).run({
    id,
    current_provider: currentProvider,
    location,
    current_cost_usd: currentCost,
    optimal_provider: bestProvider?.name ?? "N/A",
    savings_pct:      savingsPct,
    switching_rec:    switchRec,
    usage_kwh:        usageKwh,
    fee_usd:          FEES.analyzeEnergyBill,
  });

  return {
    analysis_id:              id,
    current_cost_usd:         currentCost,
    current_provider:         currentProvider,
    current_rate_kwh:         Math.round((currentCost / usageKwh) * 1000) / 1000,
    optimal_provider:         bestProvider?.name ?? currentProvider,
    optimal_monthly_usd:      optimalMonthly,
    savings_pct:              savingsPct,
    annual_savings_usd:       Math.round((currentCost - optimalMonthly) * 12 * 100) / 100,
    switching_recommendation: switchRec,
    usage_kwh:                usageKwh,
    usage_breakdown:          usageBreakdown,
    billing_period:           billData.billing_period ?? "last 30 days",
    fee_usd:                  FEES.analyzeEnergyBill,
    platform_revenue_usd:     Math.round(FEES.analyzeEnergyBill * ENERGY_PLATFORM_FEE * 100) / 100,
    created_at:               new Date().toISOString(),
  };
}

// ─── compareEnergyProviders ───────────────────────────────────────────────────

/**
 * Compare electricity and gas providers for a given location and usage profile.
 * @param {string} location    - City, state, or region
 * @param {number} usage_kwh   - Monthly kWh consumption
 * @param {object} preferences - { fuel_type, max_contract_months, min_green_pct, plan_type }
 * @returns providers[] with name, rate, plan_type, estimated_monthly, green_pct, contract_terms
 * Fee: $0.50 per comparison
 */
export function compareEnergyProviders(location, usage_kwh, preferences = {}) {
  if (!location)  throw new Error("location is required");
  if (!usage_kwh) throw new Error("usage_kwh is required");

  const region    = regionForLocation(location);
  const prefs     = preferences ?? {};
  let sql         = "SELECT * FROM energy_providers WHERE available = 1";
  const params    = [];

  if (prefs.fuel_type) {
    sql += " AND (fuel_type = ? OR fuel_type = 'dual')";
    params.push(prefs.fuel_type);
  }
  if (prefs.max_contract_months != null) {
    sql += " AND contract_months <= ?";
    params.push(prefs.max_contract_months);
  }
  if (prefs.min_green_pct != null) {
    sql += " AND green_pct >= ?";
    params.push(prefs.min_green_pct);
  }
  if (prefs.plan_type) {
    sql += " AND plan_type = ?";
    params.push(prefs.plan_type);
  }
  sql += " ORDER BY rate_kwh ASC";

  const providers = db.prepare(sql).all(...params);
  const ranked = providers.map((p, i) => ({
    rank:              i + 1,
    provider_id:       p.id,
    name:              p.name,
    region:            p.region,
    fuel_type:         p.fuel_type,
    rate_kwh:          p.rate_kwh,
    plan_type:         p.plan_type,
    estimated_monthly: Math.round(usage_kwh * p.rate_kwh * 100) / 100,
    green_pct:         p.green_pct,
    contract_terms:    p.contract_months === 0
                         ? "Month-to-month, no commitment"
                         : `${p.contract_months}-month contract`,
    contract_months:   p.contract_months,
    signup_bonus_usd:  p.signup_bonus_usd,
    cancellation_fee:  p.cancellation_fee,
    best_for:          p.green_pct >= 80
                         ? "eco-conscious customers"
                         : p.plan_type === "time_of_use"
                           ? "flexible schedule households"
                           : p.contract_months === 0
                             ? "no-commitment preference"
                             : "price stability",
  }));

  const cheapest   = ranked[0];
  const greenest   = [...ranked].sort((a, b) => b.green_pct - a.green_pct)[0];
  const noContract = ranked.find(p => p.contract_months === 0);

  return {
    comparison_id:    uuid(),
    location,
    region,
    usage_kwh,
    preferences:      prefs,
    providers:        ranked,
    total_compared:   ranked.length,
    best_price:       cheapest ?? null,
    best_green:       greenest ?? null,
    best_flexible:    noContract ?? null,
    potential_savings_vs_avg_usd: ranked.length > 1
      ? Math.round((ranked[ranked.length - 1].estimated_monthly - ranked[0].estimated_monthly) * 100) / 100
      : 0,
    fee_usd:          FEES.compareProviders,
    platform_revenue_usd: Math.round(FEES.compareProviders * ENERGY_PLATFORM_FEE * 100) / 100,
    created_at:       new Date().toISOString(),
  };
}

// ─── forecastConsumption ──────────────────────────────────────────────────────

/**
 * Predict energy consumption based on historical usage and weather forecasts.
 * @param {string} location        - City, state, or region
 * @param {Array}  historicalUsage - Array of { period, kwh } objects
 * @param {object} weatherForecast - { periods: [{ month, avg_temp_f, heating_degree_days, cooling_degree_days }] }
 * @returns forecast[] by period, peak_demand, recommendations[], efficiency_score
 * Fee: $1.00 per forecast
 */
export function forecastConsumption(location, historicalUsage, weatherForecast = {}) {
  if (!location)        throw new Error("location is required");
  if (!historicalUsage) throw new Error("historicalUsage is required");

  const history    = Array.isArray(historicalUsage) ? historicalUsage : [];
  const avgHistorical = history.length > 0
    ? history.reduce((s, h) => s + (h.kwh ?? 800), 0) / history.length
    : 850;

  const weather    = weatherForecast?.periods ?? [];
  const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const seasonalFactors = {
    Jan: 1.35, Feb: 1.28, Mar: 1.10, Apr: 0.90,
    May: 0.85, Jun: 1.15, Jul: 1.40, Aug: 1.38,
    Sep: 1.05, Oct: 0.88, Nov: 1.00, Dec: 1.30,
  };

  const forecastPeriods = months.map((month, i) => {
    const weatherPeriod = weather.find(w => w.month === month) ?? {};
    const hdd           = weatherPeriod.heating_degree_days ?? 0;
    const cdd           = weatherPeriod.cooling_degree_days ?? 0;
    const factor        = seasonalFactors[month] + (hdd > 500 ? 0.1 : 0) + (cdd > 400 ? 0.08 : 0);
    const forecastKwh   = Math.round(avgHistorical * factor * 10) / 10;
    const forecastCost  = Math.round(forecastKwh * 0.105 * 100) / 100;
    return {
      period:         `${month} ${new Date().getFullYear() + (i < new Date().getMonth() ? 1 : 0)}`,
      month,
      forecast_kwh:   forecastKwh,
      forecast_cost_usd: forecastCost,
      vs_last_year_pct:  Math.round((factor - 1) * 100 * 10) / 10,
      heating_degree_days: hdd || (seasonalFactors[month] > 1.1 ? Math.round(Math.random() * 400 + 100) : 0),
      cooling_degree_days: cdd || (["Jun","Jul","Aug"].includes(month) ? Math.round(Math.random() * 300 + 200) : 0),
    };
  });

  const peakMonth     = forecastPeriods.reduce((a, b) => a.forecast_kwh > b.forecast_kwh ? a : b);
  const peakDemandKw  = Math.round(peakMonth.forecast_kwh / 200 * 10) / 10;
  const efficiencyScore = Math.round(70 + Math.random() * 25);

  const recommendations = [];
  if (efficiencyScore < 80) recommendations.push("Install a smart thermostat to reduce heating/cooling waste by up to 12%.");
  if (avgHistorical > 1000) recommendations.push("Audit insulation — high usage suggests thermal leakage.");
  recommendations.push("Shift high-draw appliances (washer, dryer, dishwasher) to off-peak hours (9pm–6am).");
  recommendations.push(`Pre-schedule HVAC setbacks before peak month (${peakMonth.month}) to reduce peak demand charges.`);
  if (efficiencyScore < 85) recommendations.push("Consider LED lighting replacement — 75% less energy than incandescents.");

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO energy_forecasts
      (id, location, period_start, period_end, forecast_json, peak_demand_kw, efficiency_score, fee_usd)
    VALUES
      (@id, @location, @period_start, @period_end, @forecast_json, @peak_demand_kw, @efficiency_score, @fee_usd)
  `).run({
    id,
    location,
    period_start:     forecastPeriods[0].period,
    period_end:       forecastPeriods[11].period,
    forecast_json:    JSON.stringify(forecastPeriods),
    peak_demand_kw:   peakDemandKw,
    efficiency_score: efficiencyScore,
    fee_usd:          FEES.forecastConsumption,
  });

  return {
    forecast_id:      id,
    location,
    forecast:         forecastPeriods,
    annual_kwh:       Math.round(forecastPeriods.reduce((s, p) => s + p.forecast_kwh, 0)),
    annual_cost_usd:  Math.round(forecastPeriods.reduce((s, p) => s + p.forecast_cost_usd, 0) * 100) / 100,
    peak_demand_kw:   peakDemandKw,
    peak_month:       peakMonth.month,
    efficiency_score: efficiencyScore,
    recommendations,
    data_points_used: history.length,
    fee_usd:          FEES.forecastConsumption,
    platform_revenue_usd: Math.round(FEES.forecastConsumption * ENERGY_PLATFORM_FEE * 100) / 100,
    created_at:       new Date().toISOString(),
  };
}

// ─── auditEnergyEfficiency ────────────────────────────────────────────────────

/**
 * Audit a building's energy efficiency and produce a remediation roadmap.
 * @param {string} buildingType - residential|commercial|industrial|mixed_use
 * @param {number} sqft         - Total square footage
 * @param {object} systems      - { hvac, insulation, windows, lighting, appliances, solar }
 * @param {string} location     - City, state, or region
 * @returns efficiency_score, issues[], recommendations[], estimated_savings, payback_periods[]
 * Fee: $3.00 per audit
 */
export function auditEnergyEfficiency(buildingType, sqft, systems, location) {
  if (!buildingType) throw new Error("buildingType is required");
  if (!sqft)         throw new Error("sqft is required");
  if (!location)     throw new Error("location is required");

  const sys    = systems ?? {};
  const typeMultiplier = { residential: 1.0, commercial: 1.4, industrial: 1.8, mixed_use: 1.2 }[buildingType] ?? 1.0;
  const baseEui        = 55 * typeMultiplier; // kBtu/sqft/year baseline
  let score            = 75;
  const issues         = [];
  const recommendations = [];
  const paybackPeriods  = [];

  // HVAC assessment
  const hvacAge = sys.hvac?.age_years ?? 10;
  if (hvacAge > 15) {
    score -= 15;
    issues.push({ system: "HVAC", severity: "high", description: `HVAC system is ${hvacAge} years old (industry replacement threshold: 15 years)`, energy_waste_pct: 22 });
    recommendations.push({ action: "Replace HVAC with ENERGY STAR rated unit", priority: "high", estimated_cost_usd: 8500, annual_savings_usd: 1200, emissions_reduction_kg: 2400 });
    paybackPeriods.push({ improvement: "HVAC replacement", years: 7.1 });
  } else if (hvacAge > 10) {
    score -= 7;
    issues.push({ system: "HVAC", severity: "medium", description: `HVAC system is ${hvacAge} years old — schedule preventive maintenance`, energy_waste_pct: 10 });
    recommendations.push({ action: "HVAC tune-up and filter replacement", priority: "medium", estimated_cost_usd: 350, annual_savings_usd: 180, emissions_reduction_kg: 360 });
    paybackPeriods.push({ improvement: "HVAC tune-up", years: 1.9 });
  }

  // Insulation
  const insulationRating = sys.insulation?.r_value ?? 19;
  if (insulationRating < 13) {
    score -= 12;
    issues.push({ system: "Insulation", severity: "high", description: `R-value ${insulationRating} is below minimum recommended R-13 for climate zone`, energy_waste_pct: 18 });
    recommendations.push({ action: "Add blown-in attic insulation to R-38", priority: "high", estimated_cost_usd: 2200, annual_savings_usd: 480, emissions_reduction_kg: 960 });
    paybackPeriods.push({ improvement: "Insulation upgrade", years: 4.6 });
  }

  // Windows
  const windowType = sys.windows?.type ?? "double_pane";
  if (windowType === "single_pane") {
    score -= 10;
    issues.push({ system: "Windows", severity: "medium", description: "Single-pane windows cause 25-30% heat loss", energy_waste_pct: 15 });
    recommendations.push({ action: "Replace with Low-E double-pane windows", priority: "medium", estimated_cost_usd: 12000, annual_savings_usd: 650, emissions_reduction_kg: 1300 });
    paybackPeriods.push({ improvement: "Window replacement", years: 18.5 });
  }

  // Lighting
  const lightingType = sys.lighting?.type ?? "led";
  if (lightingType === "incandescent" || lightingType === "fluorescent") {
    score -= 6;
    issues.push({ system: "Lighting", severity: "low", description: `${lightingType} lighting uses 3-5x more energy than LED alternatives`, energy_waste_pct: 8 });
    recommendations.push({ action: "Full LED retrofit", priority: "low", estimated_cost_usd: 1800, annual_savings_usd: 420, emissions_reduction_kg: 840 });
    paybackPeriods.push({ improvement: "LED retrofit", years: 4.3 });
  }

  // Solar opportunity
  if (!sys.solar?.installed) {
    const solarSavings = Math.round(sqft * 0.18);
    recommendations.push({ action: `Install ${Math.round(sqft / 600)} kW rooftop solar array`, priority: "medium", estimated_cost_usd: Math.round(sqft * 2.5), annual_savings_usd: solarSavings, emissions_reduction_kg: solarSavings * 0.85 });
    paybackPeriods.push({ improvement: "Solar installation", years: Math.round(sqft * 2.5 / solarSavings * 10) / 10 });
  }

  // Smart controls
  recommendations.push({ action: "Install building automation system (BAS)", priority: "medium", estimated_cost_usd: 4500, annual_savings_usd: 900, emissions_reduction_kg: 1800 });
  paybackPeriods.push({ improvement: "Building automation", years: 5.0 });

  score = Math.max(20, Math.min(99, score));
  const totalAnnualSavings = recommendations.reduce((s, r) => s + r.annual_savings_usd, 0);
  const totalInvestment    = recommendations.reduce((s, r) => s + r.estimated_cost_usd, 0);
  const eui                = Math.round(baseEui * (1 + (75 - score) / 100));

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO energy_audits
      (id, building_type, sqft, location, efficiency_score, issues_json, recs_json, estimated_savings, fee_usd)
    VALUES
      (@id, @building_type, @sqft, @location, @efficiency_score, @issues_json, @recs_json, @estimated_savings, @fee_usd)
  `).run({
    id,
    building_type:    buildingType,
    sqft,
    location,
    efficiency_score: score,
    issues_json:      JSON.stringify(issues),
    recs_json:        JSON.stringify(recommendations),
    estimated_savings: totalAnnualSavings,
    fee_usd:          FEES.auditEfficiency,
  });

  return {
    audit_id:          id,
    building_type:     buildingType,
    sqft,
    location,
    efficiency_score:  score,
    energy_grade:      score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    eui_kbtu_sqft:     eui,
    issues,
    recommendations:   recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])),
    payback_periods:   paybackPeriods,
    estimated_savings_annual_usd: totalAnnualSavings,
    total_investment_required_usd: totalInvestment,
    simple_payback_years: totalAnnualSavings > 0 ? Math.round(totalInvestment / totalAnnualSavings * 10) / 10 : null,
    carbon_reduction_potential_kg: recommendations.reduce((s, r) => s + r.emissions_reduction_kg, 0),
    fee_usd:           FEES.auditEfficiency,
    platform_revenue_usd: Math.round(FEES.auditEfficiency * ENERGY_PLATFORM_FEE * 100) / 100,
    created_at:        new Date().toISOString(),
  };
}

// ─── optimizeSchedule ─────────────────────────────────────────────────────────

/**
 * Optimize device and HVAC scheduling around time-of-use electricity tariffs.
 * @param {Array}  devices         - [{ name, type, wattage, daily_hours, flexible }]
 * @param {object} tariffSchedule  - { peak_hours: [[start, end]], peak_rate, off_peak_rate, mid_peak_rate }
 * @param {object} preferences     - { comfort_temp_range, max_delay_hours, avoid_noise_hours }
 * @returns schedule{}, estimated_savings, peak_avoidance_pct
 * Fee: $0.50 per optimization
 */
export function optimizeSchedule(devices, tariffSchedule, preferences = {}) {
  if (!devices || !Array.isArray(devices) || devices.length === 0) {
    throw new Error("devices must be a non-empty array");
  }
  if (!tariffSchedule) throw new Error("tariffSchedule is required");

  const tariff  = tariffSchedule;
  const prefs   = preferences ?? {};
  const peakRate    = tariff.peak_rate    ?? 0.28;
  const offPeakRate = tariff.off_peak_rate ?? 0.08;
  const midPeakRate = tariff.mid_peak_rate ?? 0.16;
  const peakHours   = tariff.peak_hours   ?? [[17, 21]];
  const maxDelay    = prefs.max_delay_hours ?? 4;

  function isInPeak(hour) {
    return peakHours.some(([s, e]) => hour >= s && hour < e);
  }

  const schedule    = {};
  let originalCost  = 0;
  let optimizedCost = 0;

  for (const device of devices) {
    const wKw       = (device.wattage ?? 1000) / 1000;
    const hours     = device.daily_hours ?? 2;
    const flexible  = device.flexible !== false;

    // Original schedule: run during peak if not specified
    const origHour  = device.preferred_start_hour ?? 18;
    const origRate  = isInPeak(origHour) ? peakRate : offPeakRate;
    const origCostDay = wKw * hours * origRate;
    originalCost   += origCostDay;

    let optHour     = origHour;
    let optRate     = origRate;

    if (flexible) {
      // Find cheapest window within max_delay constraint
      let bestRate = origRate;
      for (let h = 0; h < 24; h++) {
        if (Math.abs(h - origHour) <= maxDelay) {
          const r = isInPeak(h) ? peakRate : (h >= 9 && h < 17 ? midPeakRate : offPeakRate);
          if (r < bestRate) {
            bestRate = r;
            optHour  = h;
          }
        }
      }
      optRate = bestRate;
    }

    const optCostDay = wKw * hours * optRate;
    optimizedCost   += optCostDay;

    schedule[device.name ?? `device_${devices.indexOf(device)}`] = {
      device_name:          device.name,
      device_type:          device.type ?? "appliance",
      wattage:              device.wattage ?? 1000,
      daily_hours:          hours,
      original_start_hour:  origHour,
      optimized_start_hour: optHour,
      rate_period:          isInPeak(optHour) ? "peak" : (optHour >= 9 && optHour < 17 ? "mid_peak" : "off_peak"),
      rate_kwh:             Math.round(optRate * 1000) / 1000,
      daily_cost_usd:       Math.round(optCostDay * 100) / 100,
      daily_savings_usd:    Math.round((origCostDay - optCostDay) * 100) / 100,
      shifted:              optHour !== origHour,
      run_window:           `${optHour}:00–${(optHour + hours) % 24}:00`,
    };
  }

  const dailySavings     = Math.round((originalCost - optimizedCost) * 100) / 100;
  const monthlySavings   = Math.round(dailySavings * 30 * 100) / 100;
  const peakAvoidancePct = originalCost > 0
    ? Math.round(((originalCost - optimizedCost) / originalCost) * 100 * 10) / 10
    : 0;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO energy_schedules
      (id, device_count, estimated_savings, peak_avoidance_pct, schedule_json, fee_usd)
    VALUES
      (@id, @device_count, @estimated_savings, @peak_avoidance_pct, @schedule_json, @fee_usd)
  `).run({
    id,
    device_count:      devices.length,
    estimated_savings: monthlySavings,
    peak_avoidance_pct: peakAvoidancePct,
    schedule_json:     JSON.stringify(schedule),
    fee_usd:           FEES.optimizeSchedule,
  });

  return {
    schedule_id:          id,
    schedule,
    tariff_applied: {
      peak_rate_kwh:     peakRate,
      off_peak_rate_kwh: offPeakRate,
      mid_peak_rate_kwh: midPeakRate,
      peak_hours:        peakHours,
    },
    devices_optimized:    Object.values(schedule).filter(d => d.shifted).length,
    total_devices:        devices.length,
    daily_savings_usd:    dailySavings,
    monthly_savings_usd:  monthlySavings,
    annual_savings_usd:   Math.round(dailySavings * 365 * 100) / 100,
    peak_avoidance_pct:   peakAvoidancePct,
    estimated_savings_usd: monthlySavings,
    fee_usd:              FEES.optimizeSchedule,
    platform_revenue_usd: Math.round(FEES.optimizeSchedule * ENERGY_PLATFORM_FEE * 100) / 100,
    created_at:           new Date().toISOString(),
  };
}

// ─── getEnergyDashboard ───────────────────────────────────────────────────────

/**
 * Retrieve energy usage analytics dashboard for an account.
 * @param {string} accountId - Account identifier
 * @returns total_kwh, cost_trend, peak_usage, carbon_footprint, comparison_to_similar
 * Fee: $2.00 per month
 */
export function getEnergyDashboard(accountId) {
  if (!accountId) throw new Error("accountId is required");

  // Look up or generate analytics
  const existing = db.prepare(
    "SELECT * FROM energy_dashboards WHERE account_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(accountId);

  const totalKwh      = existing?.total_kwh      ?? randomBetween(8400, 14800);
  const peakUsageKw   = existing?.peak_usage_kw  ?? randomBetween(8, 18);
  const carbonKg      = existing?.carbon_kg      ?? Math.round(totalKwh * 0.85);
  const comparisonPct = existing?.comparison_pct ?? randomBetween(-18, 22);

  const months        = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const costTrend     = months.map((month, i) => ({
    month,
    kwh:          Math.round(totalKwh / 12 * (0.7 + Math.sin(i / 6 * Math.PI) * 0.4 + Math.random() * 0.1)),
    cost_usd:     Math.round(totalKwh / 12 * 0.105 * (0.7 + Math.sin(i / 6 * Math.PI) * 0.4) * 100) / 100,
    vs_prev_year: Math.round((Math.random() * 20 - 8) * 10) / 10,
  }));

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO energy_dashboards
      (id, account_id, total_kwh, cost_trend_json, peak_usage_kw, carbon_kg, comparison_pct, fee_usd)
    VALUES
      (@id, @account_id, @total_kwh, @cost_trend_json, @peak_usage_kw, @carbon_kg, @comparison_pct, @fee_usd)
  `).run({
    id,
    account_id:      accountId,
    total_kwh:       totalKwh,
    cost_trend_json: JSON.stringify(costTrend),
    peak_usage_kw:   peakUsageKw,
    carbon_kg:       carbonKg,
    comparison_pct:  comparisonPct,
    fee_usd:         FEES.getEnergyDashboard,
  });

  return {
    dashboard_id:         id,
    account_id:           accountId,
    period:               "trailing 12 months",
    total_kwh:            totalKwh,
    total_cost_usd:       Math.round(totalKwh * 0.105 * 100) / 100,
    avg_monthly_kwh:      Math.round(totalKwh / 12),
    avg_monthly_cost_usd: Math.round(totalKwh / 12 * 0.105 * 100) / 100,
    cost_trend:           costTrend,
    peak_usage_kw:        peakUsageKw,
    peak_month:           costTrend.reduce((a, b) => a.kwh > b.kwh ? a : b).month,
    carbon_footprint_kg:  carbonKg,
    carbon_trees_equivalent: Math.round(carbonKg / 21),
    comparison_to_similar: {
      vs_similar_homes_pct: comparisonPct,
      label:                comparisonPct < 0
                              ? `${Math.abs(comparisonPct)}% below average — great efficiency!`
                              : `${comparisonPct}% above average — room to improve`,
      percentile:           Math.round(50 - comparisonPct / 2),
    },
    top_savings_opportunity: "Time-of-use rate optimization could save $18–$42/month",
    fee_usd:              FEES.getEnergyDashboard,
    platform_revenue_usd: Math.round(FEES.getEnergyDashboard * ENERGY_PLATFORM_FEE * 100) / 100,
    generated_at:         new Date().toISOString(),
  };
}
