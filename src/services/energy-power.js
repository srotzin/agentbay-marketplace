import { randomUUID } from "crypto";
import db from "../db.js";

// Energy & Power Load Optimization
// Agents arbitrage electricity pricing, shift loads, and trade power contracts.

const LIVE_MODE = !!process.env.ENERGY_API_KEY;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS energy_prices (
      id            TEXT PRIMARY KEY,
      region        TEXT NOT NULL,
      node          TEXT,
      hour_utc      INTEGER NOT NULL,
      price_kwh     REAL NOT NULL,
      period_type   TEXT NOT NULL CHECK(period_type IN ('off_peak','shoulder','on_peak','super_peak')),
      forecast_json TEXT DEFAULT '[]',
      recorded_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS energy_loads (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL,
      region        TEXT NOT NULL,
      current_kw    REAL NOT NULL,
      flexible_kw   REAL NOT NULL,
      flex_hours    TEXT DEFAULT '[]',
      schedule_json TEXT DEFAULT '{}',
      savings_usd   REAL DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS energy_contracts (
      id              TEXT PRIMARY KEY,
      contract_type   TEXT NOT NULL CHECK(contract_type IN ('ppa','spot','futures','capacity')),
      region          TEXT NOT NULL,
      seller_id       TEXT,
      buyer_id        TEXT,
      volume_kwh      REAL NOT NULL,
      price_kwh       REAL NOT NULL,
      duration_days   INTEGER NOT NULL,
      status          TEXT DEFAULT 'open' CHECK(status IN ('open','pending','active','settled','cancelled')),
      start_date      TEXT,
      end_date        TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS energy_arbitrage (
      id              TEXT PRIMARY KEY,
      agent_id        TEXT,
      region_buy      TEXT NOT NULL,
      region_sell     TEXT,
      hour_buy        INTEGER,
      hour_sell       INTEGER,
      buy_price_kwh   REAL NOT NULL,
      sell_price_kwh  REAL NOT NULL,
      volume_kwh      REAL NOT NULL,
      spread_kwh      REAL NOT NULL,
      profit_usd      REAL NOT NULL,
      strategy        TEXT NOT NULL,
      detected_at     TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[energy-power] schema init error:", e.message);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

try {
  const _priceCount = db.prepare("SELECT COUNT(*) as n FROM energy_prices").get().n;
  if (_priceCount === 0) {
    // Grid regions with realistic TOU rates by hour
    const regions = [
      { region: "CAISO", node: "SP15" },
      { region: "ERCOT", node: "HB_NORTH" },
      { region: "PJM",   node: "AEP-DAYTON" },
      { region: "NYISO", node: "NYC" },
      { region: "MISO",  node: "ILL.HUB" },
    ];

    // Hourly price profiles — off-peak 0-6h, shoulder 6-9h/20-22h, on-peak 9-19h, super-peak 16-19h
    const hourlyRates = {
      CAISO: [0.032,0.029,0.027,0.026,0.028,0.031,0.048,0.062,0.078,0.092,0.095,0.098,0.102,0.105,0.110,0.118,0.125,0.132,0.128,0.115,0.095,0.072,0.058,0.041],
      ERCOT: [0.024,0.021,0.019,0.018,0.020,0.025,0.038,0.052,0.068,0.082,0.085,0.087,0.089,0.091,0.088,0.095,0.102,0.108,0.098,0.085,0.070,0.055,0.042,0.031],
      PJM:   [0.028,0.025,0.023,0.022,0.024,0.028,0.042,0.058,0.072,0.088,0.092,0.095,0.097,0.099,0.102,0.112,0.118,0.122,0.115,0.102,0.085,0.068,0.052,0.037],
      NYISO: [0.038,0.034,0.031,0.029,0.031,0.036,0.055,0.072,0.089,0.108,0.112,0.115,0.118,0.120,0.122,0.135,0.148,0.155,0.142,0.128,0.105,0.082,0.065,0.048],
      MISO:  [0.022,0.020,0.018,0.017,0.019,0.023,0.035,0.048,0.062,0.075,0.078,0.080,0.082,0.084,0.086,0.092,0.098,0.102,0.094,0.082,0.068,0.052,0.040,0.028],
    };

    const periodFor = (region, hour) => {
      const r = hourlyRates[region][hour];
      const max = Math.max(...hourlyRates[region]);
      const ratio = r / max;
      if (ratio >= 0.85) return "super_peak";
      if (ratio >= 0.65) return "on_peak";
      if (ratio >= 0.35) return "shoulder";
      return "off_peak";
    };

    const insertPrice = db.prepare(`
      INSERT OR IGNORE INTO energy_prices (id, region, node, hour_utc, price_kwh, period_type, forecast_json)
      VALUES (@id, @region, @node, @hour_utc, @price_kwh, @period_type, @forecast_json)
    `);

    for (const { region, node } of regions) {
      const rates = hourlyRates[region];
      for (let h = 0; h < 24; h++) {
        // Build 24-hr forecast with slight variation
        const forecast = rates.map((r, i) => ({
          hour: i,
          price_kwh: parseFloat((r * (0.95 + Math.random() * 0.1)).toFixed(4)),
        }));
        insertPrice.run({
          id: randomUUID(),
          region,
          node,
          hour_utc: h,
          price_kwh: rates[h],
          period_type: periodFor(region, h),
          forecast_json: JSON.stringify(forecast),
        });
      }
    }

    // Seed available contracts
    const contractSeed = [
      { type: "ppa",      region: "CAISO", volume: 500000,  price: 0.041, days: 365, seller: "SolarFarm-CV-01" },
      { type: "ppa",      region: "ERCOT", volume: 1000000, price: 0.032, days: 365, seller: "WindFarm-TX-12" },
      { type: "futures",  region: "PJM",   volume: 250000,  price: 0.068, days: 90,  seller: "GridTrader-PJM" },
      { type: "capacity", region: "NYISO", volume: 150000,  price: 0.088, days: 180, seller: "PeakerPlant-NY" },
      { type: "spot",     region: "MISO",  volume: 75000,   price: 0.025, days: 7,   seller: "MidwestGrid-01" },
      { type: "ppa",      region: "CAISO", volume: 200000,  price: 0.038, days: 730, seller: "GeoEnergy-CA-03" },
      { type: "futures",  region: "ERCOT", volume: 500000,  price: 0.029, days: 30,  seller: "EnergyArb-TX" },
    ];

    const insertContract = db.prepare(`
      INSERT OR IGNORE INTO energy_contracts (id, contract_type, region, seller_id, volume_kwh, price_kwh, duration_days, status)
      VALUES (@id, @contract_type, @region, @seller_id, @volume_kwh, @price_kwh, @duration_days, @status)
    `);
    for (const c of contractSeed) {
      insertContract.run({
        id: randomUUID(),
        contract_type: c.type,
        region: c.region,
        seller_id: c.seller,
        volume_kwh: c.volume,
        price_kwh: c.price,
        duration_days: c.days,
        status: "open",
      });
    }
  }
} catch (e) {
  console.error("[energy-power] seed error:", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRegionPrices(region) {
  return db.prepare("SELECT * FROM energy_prices WHERE region = ? ORDER BY hour_utc").all(region.toUpperCase());
}

// ─── 1. energyGetPrices ───────────────────────────────────────────────────────

export function energyGetPrices(args) {
  const { region = "CAISO", hour_utc } = args;
  const reg = (region || "CAISO").toUpperCase();

  const rows = hour_utc != null
    ? db.prepare("SELECT * FROM energy_prices WHERE region = ? AND hour_utc = ?").all(reg, Number(hour_utc))
    : getRegionPrices(reg);

  if (rows.length === 0) {
    const all = db.prepare("SELECT DISTINCT region FROM energy_prices").all().map(r => r.region);
    return { error: `No price data for region "${reg}"`, available_regions: all };
  }

  const currentHour = new Date().getUTCHours();
  const currentRow  = rows.find(r => r.hour_utc === currentHour) || rows[0];
  const offPeak     = rows.filter(r => r.period_type === "off_peak");
  const onPeak      = rows.filter(r => r.period_type === "on_peak" || r.period_type === "super_peak");

  const avgOff  = offPeak.reduce((s, r) => s + r.price_kwh, 0) / (offPeak.length || 1);
  const avgPeak = onPeak.reduce((s, r)  => s + r.price_kwh, 0) / (onPeak.length  || 1);

  return {
    region: reg,
    node: currentRow.node,
    current_price_kwh: currentRow.price_kwh,
    current_period:    currentRow.period_type,
    current_hour_utc:  currentHour,
    off_peak_avg_kwh:  parseFloat(avgOff.toFixed(5)),
    on_peak_avg_kwh:   parseFloat(avgPeak.toFixed(5)),
    peak_offpeak_ratio: parseFloat((avgPeak / avgOff).toFixed(2)),
    forecast_24h:      rows.map(r => ({ hour: r.hour_utc, price_kwh: r.price_kwh, period: r.period_type })),
    mode: LIVE_MODE ? "live" : "simulation",
    arbitrage_hint: `Peak/off-peak spread: $${((avgPeak - avgOff) * 1000).toFixed(2)}/MWh — shift loads or charge batteries off-peak.`,
  };
}

// ─── 2. energyLoadShift ───────────────────────────────────────────────────────

export function energyLoadShift(args) {
  const { current_kw = 100, flexible_kw, flex_hours = 8, region = "CAISO", agent_id } = args;
  if (!current_kw) throw new Error("current_kw is required");

  const reg      = (region || "CAISO").toUpperCase();
  const flexKw   = parseFloat(flexible_kw ?? current_kw * 0.4);
  const flexHrs  = parseInt(flex_hours) || 8;
  const prices   = getRegionPrices(reg);

  if (prices.length === 0) throw new Error(`No pricing data for region: ${reg}`);

  // Sort hours by price to find cheapest windows
  const sorted = [...prices].sort((a, b) => a.price_kwh - b.price_kwh);
  const cheapHours = sorted.slice(0, flexHrs).map(r => r.hour_utc).sort((a, b) => a - b);
  const expensiveHours = sorted.slice(-flexHrs).map(r => r.hour_utc);

  const avgCheap    = cheapHours.reduce((s, h) => s + prices[h].price_kwh, 0) / cheapHours.length;
  const avgExpensive = expensiveHours.reduce((s, h) => s + prices[h].price_kwh, 0) / expensiveHours.length;

  const dailySavingsKwh = flexKw * flexHrs;
  const dailySavingsUsd = dailySavingsKwh * (avgExpensive - avgCheap);
  const monthlySavings  = dailySavingsUsd * 30;

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO energy_loads (id, agent_id, region, current_kw, flexible_kw, flex_hours, schedule_json, savings_usd)
      VALUES (@id, @agent_id, @region, @current_kw, @flexible_kw, @flex_hours, @schedule_json, @savings_usd)
    `).run({
      id,
      agent_id: agent_id || "anon",
      region: reg,
      current_kw: parseFloat(current_kw),
      flexible_kw: flexKw,
      flex_hours: JSON.stringify(cheapHours),
      schedule_json: JSON.stringify({ run_hours: cheapHours, avoid_hours: expensiveHours }),
      savings_usd: parseFloat(dailySavingsUsd.toFixed(4)),
    });
  } catch (e) {
    console.error("[energy-power] energyLoadShift insert error:", e.message);
  }

  return {
    load_shift_id:     id,
    region:            reg,
    total_load_kw:     current_kw,
    flexible_load_kw:  flexKw,
    recommended_run_hours: cheapHours,
    avoid_peak_hours:  expensiveHours,
    avg_cheap_kwh:     parseFloat(avgCheap.toFixed(5)),
    avg_peak_kwh:      parseFloat(avgExpensive.toFixed(5)),
    daily_savings_usd: parseFloat(dailySavingsUsd.toFixed(2)),
    monthly_savings_usd: parseFloat(monthlySavings.toFixed(2)),
    annual_savings_usd:  parseFloat((monthlySavings * 12).toFixed(2)),
    action: `Run your ${flexKw} kW flexible load during hours ${cheapHours.join(", ")} UTC to save $${dailySavingsUsd.toFixed(2)}/day.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 3. energyArbitrage ───────────────────────────────────────────────────────

export function energyArbitrage(args) {
  const { region, volume_kwh = 10000, strategy = "time" } = args;

  const allRegions = ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"];
  const targetRegions = region ? [(region || "CAISO").toUpperCase()] : allRegions;

  const opportunities = [];

  if (strategy === "time" || !strategy) {
    // Time-of-use arbitrage within each region
    for (const reg of targetRegions) {
      const prices = getRegionPrices(reg);
      if (!prices.length) continue;
      const minP = prices.reduce((a, b) => a.price_kwh < b.price_kwh ? a : b);
      const maxP = prices.reduce((a, b) => a.price_kwh > b.price_kwh ? a : b);
      const spread = maxP.price_kwh - minP.price_kwh;
      if (spread > 0.02) {
        const profit = spread * volume_kwh;
        opportunities.push({
          type: "time_arbitrage",
          region: reg,
          buy_hour: minP.hour_utc,
          sell_hour: maxP.hour_utc,
          buy_price_kwh: minP.price_kwh,
          sell_price_kwh: maxP.price_kwh,
          spread_kwh: parseFloat(spread.toFixed(5)),
          volume_kwh,
          gross_profit_usd: parseFloat(profit.toFixed(2)),
          roi_pct: parseFloat(((spread / minP.price_kwh) * 100).toFixed(1)),
          action: `Buy ${volume_kwh.toLocaleString()} kWh at $${minP.price_kwh}/kWh (hour ${minP.hour_utc} UTC), sell at $${maxP.price_kwh}/kWh (hour ${maxP.hour_utc} UTC). Profit: $${profit.toFixed(2)}.`,
        });
      }
    }
  }

  if (strategy === "spatial" || !strategy) {
    // Cross-region arbitrage (if buying cheap in one, selling in another)
    const regionCurrentPrices = allRegions.map(reg => {
      const prices = getRegionPrices(reg);
      const off = prices.filter(p => p.period_type === "off_peak");
      const avgOff = off.length ? off.reduce((s, r) => s + r.price_kwh, 0) / off.length : null;
      return { region: reg, avg_off_peak: avgOff };
    }).filter(r => r.avg_off_peak !== null).sort((a, b) => a.avg_off_peak - b.avg_off_peak);

    if (regionCurrentPrices.length >= 2) {
      const cheapest   = regionCurrentPrices[0];
      const mostExpensive = regionCurrentPrices[regionCurrentPrices.length - 1];
      const spread = mostExpensive.avg_off_peak - cheapest.avg_off_peak;
      if (spread > 0.005) {
        const profit = spread * volume_kwh * 0.85; // 15% transmission loss estimate
        opportunities.push({
          type: "spatial_arbitrage",
          buy_region: cheapest.region,
          sell_region: mostExpensive.region,
          buy_price_kwh: parseFloat(cheapest.avg_off_peak.toFixed(5)),
          sell_price_kwh: parseFloat(mostExpensive.avg_off_peak.toFixed(5)),
          spread_kwh: parseFloat(spread.toFixed(5)),
          volume_kwh,
          transmission_loss_pct: 15,
          net_profit_usd: parseFloat(profit.toFixed(2)),
          action: `Buy off-peak power in ${cheapest.region} at $${cheapest.avg_off_peak.toFixed(4)}/kWh, sell in ${mostExpensive.region} at $${mostExpensive.avg_off_peak.toFixed(4)}/kWh. Est. profit after transmission: $${profit.toFixed(2)}.`,
        });
      }
    }
  }

  // Persist top opportunity
  if (opportunities.length > 0) {
    const top = opportunities.sort((a, b) => (b.gross_profit_usd ?? b.net_profit_usd) - (a.gross_profit_usd ?? a.net_profit_usd))[0];
    try {
      db.prepare(`
        INSERT INTO energy_arbitrage (id, region_buy, region_sell, hour_buy, hour_sell, buy_price_kwh, sell_price_kwh, volume_kwh, spread_kwh, profit_usd, strategy)
        VALUES (@id, @region_buy, @region_sell, @hour_buy, @hour_sell, @buy_price_kwh, @sell_price_kwh, @volume_kwh, @spread_kwh, @profit_usd, @strategy)
      `).run({
        id: randomUUID(),
        region_buy:    top.buy_region  || top.region || "",
        region_sell:   top.sell_region || top.region || "",
        hour_buy:      top.buy_hour   ?? null,
        hour_sell:     top.sell_hour  ?? null,
        buy_price_kwh: top.buy_price_kwh,
        sell_price_kwh: top.sell_price_kwh,
        volume_kwh,
        spread_kwh:    top.spread_kwh,
        profit_usd:    top.gross_profit_usd ?? top.net_profit_usd,
        strategy:      top.type,
      });
    } catch (e) {
      console.error("[energy-power] energyArbitrage insert error:", e.message);
    }
  }

  return {
    strategy,
    volume_kwh,
    opportunities_found: opportunities.length,
    opportunities: opportunities.sort((a, b) => (b.gross_profit_usd ?? b.net_profit_usd ?? 0) - (a.gross_profit_usd ?? a.net_profit_usd ?? 0)),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. energyContractBid ─────────────────────────────────────────────────────

export function energyContractBid(args) {
  const { contract_id, buyer_id, max_price_kwh, volume_kwh, note } = args;
  if (!contract_id) throw new Error("contract_id is required");
  if (!max_price_kwh) throw new Error("max_price_kwh is required");
  if (!volume_kwh)  throw new Error("volume_kwh is required");

  const contract = db.prepare("SELECT * FROM energy_contracts WHERE id = ?").get(contract_id);
  if (!contract) throw new Error(`Contract not found: ${contract_id}`);
  if (contract.status !== "open") return { accepted: false, reason: `Contract is ${contract.status}`, contract };

  const accepted = parseFloat(max_price_kwh) >= contract.price_kwh && parseFloat(volume_kwh) <= contract.volume_kwh;

  if (accepted) {
    try {
      db.prepare("UPDATE energy_contracts SET status = 'pending', buyer_id = ? WHERE id = ?").run(buyer_id || "anon", contract_id);
    } catch (e) {
      console.error("[energy-power] energyContractBid update error:", e.message);
    }
  }

  const totalCost = parseFloat(volume_kwh) * contract.price_kwh;

  return {
    bid_accepted: accepted,
    contract_id,
    contract_type: contract.contract_type,
    region: contract.region,
    your_max_price_kwh: max_price_kwh,
    contract_price_kwh: contract.price_kwh,
    volume_kwh: parseFloat(volume_kwh),
    total_cost_usd: parseFloat(totalCost.toFixed(2)),
    duration_days: contract.duration_days,
    reason: accepted ? "Bid exceeds ask — contract moved to pending." : `Contract price $${contract.price_kwh}/kWh exceeds your max $${max_price_kwh}/kWh.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 5. energyContractList ────────────────────────────────────────────────────

export function energyContractList(args) {
  const { region, contract_type, max_price_kwh, status = "open", limit = 20 } = args;

  let query = "SELECT * FROM energy_contracts WHERE status = ?";
  const params = [status];

  if (region) { query += " AND region = ?"; params.push(region.toUpperCase()); }
  if (contract_type) { query += " AND contract_type = ?"; params.push(contract_type); }
  if (max_price_kwh) { query += " AND price_kwh <= ?"; params.push(parseFloat(max_price_kwh)); }

  query += " ORDER BY price_kwh ASC LIMIT ?";
  params.push(parseInt(limit) || 20);

  const contracts = db.prepare(query).all(...params);

  return {
    count: contracts.length,
    status_filter: status,
    contracts: contracts.map(c => ({
      contract_id:    c.id,
      contract_type:  c.contract_type,
      region:         c.region,
      seller_id:      c.seller_id,
      volume_kwh:     c.volume_kwh,
      price_kwh:      c.price_kwh,
      duration_days:  c.duration_days,
      total_cost_usd: parseFloat((c.volume_kwh * c.price_kwh).toFixed(2)),
      status:         c.status,
    })),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 6. energySolarEstimate ───────────────────────────────────────────────────

export function energySolarEstimate(args) {
  const { lat, lon, panel_kw = 100, orientation = "south", tilt_deg = 30, region = "CAISO" } = args;
  if (lat == null || lon == null) throw new Error("lat and lon are required");

  const latitude   = parseFloat(lat);
  const panelKw    = parseFloat(panel_kw);
  const tilt       = parseFloat(tilt_deg);
  const reg        = (region || "CAISO").toUpperCase();

  // Simplified irradiance estimate: peak sun hours by latitude band
  let peakSunHrs = 5.5; // default
  if (latitude >= 50) peakSunHrs = 3.8;
  else if (latitude >= 40) peakSunHrs = 4.8;
  else if (latitude >= 30) peakSunHrs = 5.8;
  else if (latitude >= 20) peakSunHrs = 6.2;
  else peakSunHrs = 6.0;

  // Tilt factor (optimal ~latitude degrees)
  const optTilt = Math.abs(latitude);
  const tiltFactor = 1 - Math.abs(tilt - optTilt) * 0.003;

  // Orientation factor
  const orientFactors = { south: 1.0, southeast: 0.95, southwest: 0.95, east: 0.80, west: 0.80, north: 0.55 };
  const orientFactor  = orientFactors[orientation.toLowerCase()] ?? 0.90;

  const systemEfficiency = 0.80; // inverter + wiring losses
  const dailyKwh = panelKw * peakSunHrs * tiltFactor * orientFactor * systemEfficiency;
  const annualKwh = dailyKwh * 365;

  const prices = getRegionPrices(reg);
  const avgPrice = prices.length ? prices.reduce((s, p) => s + p.price_kwh, 0) / prices.length : 0.08;
  const peakPrice = prices.length ? Math.max(...prices.map(p => p.price_kwh)) : 0.12;

  const annualRevenue    = annualKwh * peakPrice * 0.6 + annualKwh * avgPrice * 0.4;
  const carbonOffsetTons = annualKwh * 0.000386; // US grid average: 386g CO2/kWh

  return {
    location: { lat: latitude, lon: parseFloat(lon) },
    system: { panel_kw: panelKw, orientation, tilt_deg: tilt },
    region: reg,
    peak_sun_hours_day: parseFloat(peakSunHrs.toFixed(1)),
    tilt_efficiency_factor: parseFloat(tiltFactor.toFixed(3)),
    orientation_efficiency_factor: parseFloat(orientFactor.toFixed(2)),
    daily_generation_kwh:  parseFloat(dailyKwh.toFixed(1)),
    annual_generation_kwh: parseFloat(annualKwh.toFixed(0)),
    annual_revenue_usd:    parseFloat(annualRevenue.toFixed(2)),
    avg_grid_price_kwh:    parseFloat(avgPrice.toFixed(5)),
    peak_grid_price_kwh:   parseFloat(peakPrice.toFixed(5)),
    carbon_offset_tons_yr: parseFloat(carbonOffsetTons.toFixed(2)),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 7. energyBatteryOptimize ─────────────────────────────────────────────────

export function energyBatteryOptimize(args) {
  const { capacity_kwh = 1000, charge_rate_kw = 250, discharge_rate_kw = 250, region = "CAISO", cycles_per_day = 1 } = args;

  const reg      = (region || "CAISO").toUpperCase();
  const capKwh   = parseFloat(capacity_kwh);
  const chgKw    = parseFloat(charge_rate_kw);
  const dischgKw = parseFloat(discharge_rate_kw);
  const prices   = getRegionPrices(reg);

  if (!prices.length) throw new Error(`No price data for region: ${reg}`);

  const sorted = [...prices].sort((a, b) => a.price_kwh - b.price_kwh);
  const chargeHours   = sorted.slice(0, Math.ceil(capKwh / chgKw)).map(p => p.hour_utc);
  const dischargeHours = sorted.slice(-Math.ceil(capKwh / dischgKw)).map(p => p.hour_utc);

  const avgCharge    = chargeHours.reduce((s, h) => s + prices[h].price_kwh, 0) / chargeHours.length;
  const avgDischarge = dischargeHours.reduce((s, h) => s + prices[h].price_kwh, 0) / dischargeHours.length;
  const roundTripEff = 0.90; // 90% round-trip efficiency

  const dailyKwhCycled = Math.min(capKwh * cycles_per_day, capKwh);
  const dailyProfit    = dailyKwhCycled * (avgDischarge * roundTripEff - avgCharge);
  const annualProfit   = dailyProfit * 365;
  const degradationCostPerCycle = capKwh * 250 / (3000 * capKwh); // $250/kWh battery cost, 3000 cycle life

  return {
    battery: { capacity_kwh: capKwh, charge_rate_kw: chgKw, discharge_rate_kw: dischgKw },
    region: reg,
    charge_schedule:    chargeHours.sort((a, b) => a - b),
    discharge_schedule: dischargeHours.sort((a, b) => a - b),
    avg_charge_price_kwh:    parseFloat(avgCharge.toFixed(5)),
    avg_discharge_price_kwh: parseFloat(avgDischarge.toFixed(5)),
    spread_kwh:              parseFloat((avgDischarge - avgCharge).toFixed(5)),
    round_trip_efficiency:   roundTripEff,
    daily_kwh_cycled:        parseFloat(dailyKwhCycled.toFixed(1)),
    daily_gross_profit_usd:  parseFloat(dailyProfit.toFixed(2)),
    degradation_cost_per_cycle_usd: parseFloat(degradationCostPerCycle.toFixed(4)),
    daily_net_profit_usd:    parseFloat((dailyProfit - degradationCostPerCycle).toFixed(2)),
    annual_net_profit_usd:   parseFloat(annualProfit.toFixed(2)),
    payback_years:           annualProfit > 0 ? parseFloat((capKwh * 250 / annualProfit).toFixed(1)) : null,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 8. energyDashboard ──────────────────────────────────────────────────────

export function energyDashboard(args) {
  const { agent_id } = args;

  let contracts, loads, arbitrage;
  try {
    contracts = agent_id
      ? db.prepare("SELECT * FROM energy_contracts WHERE buyer_id = ? OR seller_id = ?").all(agent_id, agent_id)
      : db.prepare("SELECT * FROM energy_contracts WHERE status IN ('active','pending') LIMIT 10").all();
    loads = agent_id
      ? db.prepare("SELECT * FROM energy_loads WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10").all(agent_id)
      : db.prepare("SELECT * FROM energy_loads ORDER BY created_at DESC LIMIT 10").all();
    arbitrage = db.prepare("SELECT * FROM energy_arbitrage ORDER BY detected_at DESC LIMIT 5").all();
  } catch (e) {
    console.error("[energy-power] energyDashboard query error:", e.message);
    contracts = []; loads = []; arbitrage = [];
  }

  const totalContractValue = contracts.reduce((s, c) => s + c.volume_kwh * c.price_kwh, 0);
  const totalSavings       = loads.reduce((s, l) => s + (l.savings_usd || 0), 0);
  const topArb             = arbitrage[0];

  return {
    agent_id: agent_id || "all",
    contracts: {
      count: contracts.length,
      total_volume_kwh: contracts.reduce((s, c) => s + c.volume_kwh, 0),
      total_value_usd:  parseFloat(totalContractValue.toFixed(2)),
      by_status: {
        open:    contracts.filter(c => c.status === "open").length,
        pending: contracts.filter(c => c.status === "pending").length,
        active:  contracts.filter(c => c.status === "active").length,
      },
    },
    load_optimization: {
      sessions:          loads.length,
      total_savings_usd: parseFloat(totalSavings.toFixed(2)),
      recent:            loads.slice(0, 5).map(l => ({ region: l.region, current_kw: l.current_kw, savings_usd: l.savings_usd })),
    },
    top_arbitrage_opportunity: topArb ? {
      region:         topArb.region_buy || topArb.region_sell,
      spread_kwh:     topArb.spread_kwh,
      profit_usd:     topArb.profit_usd,
      strategy:       topArb.strategy,
      detected_at:    topArb.detected_at,
    } : null,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}
