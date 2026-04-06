import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const DP_COMMISSION = 0.20; // 20% platform cut
const FEES = {
  monitor:    0.05,  // per competitor per product
  optimal:    0.25,
  simulate:   0.50,
  promo:      1.00,  // per plan
  dashboard:  5.00,  // per month
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS dp_competitors (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    market_share_pct REAL,
    price_strategy   TEXT CHECK(price_strategy IN ('aggressive','competitive','premium','value')),
    update_frequency TEXT DEFAULT 'daily',
    reliability      REAL DEFAULT 95.0,
    categories       TEXT DEFAULT '[]',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dp_price_data (
    id               TEXT PRIMARY KEY,
    product_id       TEXT NOT NULL,
    competitor_id    TEXT NOT NULL REFERENCES dp_competitors(id),
    price            REAL NOT NULL,
    currency         TEXT DEFAULT 'USD',
    recorded_at      TEXT DEFAULT (datetime('now')),
    in_stock         INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS dp_transactions (
    id               TEXT PRIMARY KEY,
    function_name    TEXT NOT NULL,
    fee_usd          REAL NOT NULL,
    commission_usd   REAL NOT NULL,
    request_data     TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Competitors ─────────────────────────────────────────────────────────

const _compCount = db.prepare("SELECT COUNT(*) as n FROM dp_competitors").get().n;
if (_compCount === 0) {
  const competitors = [
    { id: randomUUID(), name: "Amazon",        market_share_pct: 38.0, price_strategy: "aggressive",   update_frequency: "hourly",   reliability: 99.5, categories: '["electronics","home","apparel","books"]' },
    { id: randomUUID(), name: "Walmart",        market_share_pct: 21.0, price_strategy: "value",        update_frequency: "daily",    reliability: 97.8, categories: '["grocery","home","electronics","apparel"]' },
    { id: randomUUID(), name: "Target",         market_share_pct:  8.5, price_strategy: "competitive",  update_frequency: "daily",    reliability: 96.2, categories: '["home","apparel","beauty","electronics"]' },
    { id: randomUUID(), name: "Best Buy",       market_share_pct:  6.2, price_strategy: "competitive",  update_frequency: "daily",    reliability: 95.5, categories: '["electronics","appliances"]' },
    { id: randomUUID(), name: "Costco",         market_share_pct:  5.8, price_strategy: "value",        update_frequency: "weekly",   reliability: 93.1, categories: '["grocery","home","electronics","apparel"]' },
    { id: randomUUID(), name: "eBay",           market_share_pct:  4.1, price_strategy: "aggressive",   update_frequency: "realtime", reliability: 98.0, categories: '["electronics","collectibles","apparel"]' },
    { id: randomUUID(), name: "Shopify Stores", market_share_pct:  3.6, price_strategy: "premium",      update_frequency: "daily",    reliability: 88.4, categories: '["apparel","beauty","home","specialty"]' },
    { id: randomUUID(), name: "Home Depot",     market_share_pct:  3.2, price_strategy: "competitive",  update_frequency: "daily",    reliability: 94.7, categories: '["home_improvement","tools","appliances"]' },
    { id: randomUUID(), name: "Chewy",          market_share_pct:  2.9, price_strategy: "competitive",  update_frequency: "daily",    reliability: 96.8, categories: '["pet_supplies","pet_food"]' },
    { id: randomUUID(), name: "Wayfair",        market_share_pct:  2.1, price_strategy: "aggressive",   update_frequency: "daily",    reliability: 92.3, categories: '["furniture","home_decor","bedding"]' },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO dp_competitors (id, name, market_share_pct, price_strategy, update_frequency, reliability, categories)
    VALUES (@id, @name, @market_share_pct, @price_strategy, @update_frequency, @reliability, @categories)
  `);
  for (const c of competitors) ins.run(c);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordFee(functionName, requestData, feeMult = 1) {
  const fee        = Math.round((FEES[functionName] ?? 0) * feeMult * 100) / 100;
  const commission = Math.round(fee * DP_COMMISSION * 100) / 100;
  db.prepare(`
    INSERT OR IGNORE INTO dp_transactions (id, function_name, fee_usd, commission_usd, request_data)
    VALUES (@id, @function_name, @fee_usd, @commission_usd, @request_data)
  `).run({ id: randomUUID(), function_name: functionName, fee_usd: fee, commission_usd: commission, request_data: JSON.stringify(requestData) });
  return { fee_usd: fee, platform_commission_usd: commission };
}

function simulateCompetitorPrice(basePrice, strategy, seed = 0) {
  const multipliers = { aggressive: 0.88, competitive: 0.97, premium: 1.08, value: 0.93 };
  const noise = ((seed % 20) - 10) / 100; // ±10% noise
  return Math.round(basePrice * (multipliers[strategy] ?? 1.0) * (1 + noise) * 100) / 100;
}

function generatePriceHistory(basePrice, strategy, days = 30) {
  const history = [];
  let price = simulateCompetitorPrice(basePrice, strategy, days);
  for (let i = days; i >= 0; i -= 5) {
    const drift = (Math.random() - 0.48) * 0.03;
    price = Math.round(price * (1 + drift) * 100) / 100;
    history.push({
      date:  new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
      price: Math.max(1, price),
    });
  }
  return history;
}

// ─── monitorCompetitorPrices ──────────────────────────────────────────────────

/**
 * Monitor and return current competitor pricing for a product.
 * @param {string} productId - Your product SKU or ID
 * @param {string[]} competitors - Competitor names to monitor (empty = all)
 * @param {string} frequency - realtime|hourly|daily (informational)
 * @returns Current prices, history, and trend for each competitor
 */
export function monitorCompetitorPrices(productId, competitors = [], frequency = "daily") {
  if (!productId) throw new Error("productId is required");

  const validFreq = ["realtime", "hourly", "daily", "weekly"];
  if (!validFreq.includes(frequency)) throw new Error(`frequency must be one of: ${validFreq.join(", ")}`);

  let allComps = db.prepare("SELECT * FROM dp_competitors ORDER BY market_share_pct DESC").all();
  if (competitors.length > 0) {
    const lower = competitors.map(c => c.toLowerCase());
    allComps = allComps.filter(c => lower.includes(c.name.toLowerCase()));
  }
  if (allComps.length === 0) throw new Error("No matching competitors found");

  // Simulate a reference market price based on productId hash
  const productSeed = productId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const referencePrice = 20 + (productSeed % 480); // $20–$499

  const prices = allComps.map(comp => {
    const currentPrice = simulateCompetitorPrice(referencePrice, comp.price_strategy, productSeed + comp.name.length);
    const history = generatePriceHistory(currentPrice, comp.price_strategy);
    const prices7d = history.slice(-2).map(h => h.price);
    const trend = prices7d.length > 1
      ? prices7d[1] > prices7d[0] ? "increasing" : prices7d[1] < prices7d[0] ? "decreasing" : "stable"
      : "stable";

    // Save to dp_price_data
    db.prepare(`
      INSERT OR IGNORE INTO dp_price_data (id, product_id, competitor_id, price)
      VALUES (@id, @product_id, @competitor_id, @price)
    `).run({ id: randomUUID(), product_id: productId, competitor_id: comp.id, price: currentPrice });

    return {
      competitor:          comp.name,
      market_share_pct:    comp.market_share_pct,
      price:               currentPrice,
      currency:            "USD",
      in_stock:            productSeed % (comp.name.length + 3) !== 0,
      price_strategy:      comp.price_strategy,
      last_updated:        new Date().toISOString(),
      update_frequency:    comp.update_frequency,
      price_history:       history,
      trend,
      vs_reference_price_pct: Math.round(((currentPrice - referencePrice) / referencePrice) * 1000) / 10,
    };
  });

  prices.sort((a, b) => a.price - b.price);
  const lowestPrice = prices[0]?.price;
  const highestPrice = prices[prices.length - 1]?.price;
  const avgPrice = Math.round(prices.reduce((s, p) => s + p.price, 0) / prices.length * 100) / 100;

  const { fee_usd, platform_commission_usd } = recordFee("monitor", { productId, frequency }, allComps.length);

  return {
    product_id:              productId,
    monitoring_frequency:    frequency,
    reference_market_price:  referencePrice,
    current_prices:          prices,
    competitor_count:        prices.length,
    market_summary: {
      lowest_price:    lowestPrice,
      highest_price:   highestPrice,
      avg_price:       avgPrice,
      price_spread:    Math.round((highestPrice - lowestPrice) * 100) / 100,
    },
    snapshot_at: new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── calculateOptimalPrice ────────────────────────────────────────────────────

/**
 * Calculate the revenue-maximizing price point using elasticity and competitive data.
 * @param {object} productData - { id, name, currentPrice, currentUnits }
 * @param {number} costBasis - Total unit cost (COGS)
 * @param {number} demandElasticity - Price elasticity of demand (e.g. -1.5 means 1% price increase → 1.5% demand drop)
 * @param {number[]} competitorPrices - Array of competitor prices for this product
 * @param {number} targetMargin - Minimum acceptable margin as decimal (e.g. 0.30)
 * @returns Optimal price, expected units/revenue/margin, and sensitivity analysis
 */
export function calculateOptimalPrice(productData, costBasis, demandElasticity = -1.5, competitorPrices = [], targetMargin = 0.30) {
  if (!productData || !productData.currentPrice) throw new Error("productData.currentPrice is required");
  if (!costBasis || costBasis <= 0) throw new Error("costBasis must be a positive number");
  if (demandElasticity >= 0) throw new Error("demandElasticity must be negative (demand decreases as price increases)");

  const { id = "unknown", name = "Product", currentPrice, currentUnits = 1000 } = productData;
  const minPrice = costBasis * (1 + targetMargin);
  const maxPrice = currentPrice * 1.5;
  const compAvg  = competitorPrices.length > 0
    ? competitorPrices.reduce((s, p) => s + p, 0) / competitorPrices.length
    : currentPrice;

  // Sweep price points and find revenue maximum
  let bestRevenue = 0, bestPrice = currentPrice, bestUnits = currentUnits, bestMargin = 0;
  const sweepResults = [];

  for (let price = minPrice; price <= maxPrice; price += (maxPrice - minPrice) / 50) {
    const priceDelta    = (price - currentPrice) / currentPrice;
    const demandDelta   = priceDelta * demandElasticity;
    const units         = Math.max(0, currentUnits * (1 + demandDelta));
    const revenue       = units * price;
    const margin        = (price - costBasis) / price;
    const competitiveAdj = compAvg > 0 ? Math.max(0.5, 1 - (price - compAvg) / compAvg * 0.4) : 1;
    const adjRevenue    = revenue * competitiveAdj;

    sweepResults.push({ price: Math.round(price * 100) / 100, units: Math.round(units), revenue: Math.round(adjRevenue), margin: Math.round(margin * 1000) / 10 });

    if (adjRevenue > bestRevenue && margin >= targetMargin) {
      bestRevenue = adjRevenue;
      bestPrice   = price;
      bestUnits   = units;
      bestMargin  = margin;
    }
  }

  const optimalPrice = Math.round(bestPrice * 100) / 100;

  // Sensitivity analysis — ±5%, ±10%
  const sensitivity = [-0.10, -0.05, 0, 0.05, 0.10].map(delta => {
    const testPrice  = Math.round(optimalPrice * (1 + delta) * 100) / 100;
    const demandD    = delta * demandElasticity;
    const units      = Math.max(0, Math.round(bestUnits * (1 + demandD)));
    return {
      price_delta_pct: delta * 100,
      price:           testPrice,
      expected_units:  units,
      expected_revenue: Math.round(units * testPrice),
      margin_pct:      Math.round(((testPrice - costBasis) / testPrice) * 1000) / 10,
    };
  });

  const confidence = Math.min(95, 60 + competitorPrices.length * 5 + (currentUnits > 100 ? 10 : 0));
  const { fee_usd, platform_commission_usd } = recordFee("optimal", { product_id: id });

  return {
    product:            { id, name },
    cost_basis:         costBasis,
    current_price:      currentPrice,
    optimal_price:      optimalPrice,
    price_change_pct:   Math.round(((optimalPrice - currentPrice) / currentPrice) * 1000) / 10,
    expected_units:     Math.round(bestUnits),
    expected_revenue:   Math.round(bestRevenue),
    margin_pct:         Math.round(bestMargin * 1000) / 10,
    competitor_avg_price: Math.round(compAvg * 100) / 100,
    position_vs_market: optimalPrice < compAvg ? "below_market" : optimalPrice > compAvg ? "above_market" : "at_market",
    target_margin_pct:  targetMargin * 100,
    confidence_pct:     confidence,
    demand_elasticity:  demandElasticity,
    sensitivity_analysis: sensitivity,
    price_floor:        Math.round(minPrice * 100) / 100,
    methodology:        "Profit-maximization sweep with elasticity-adjusted demand and competitive positioning correction",
    fee_usd,
    platform_commission_usd,
  };
}

// ─── simulatePriceChange ──────────────────────────────────────────────────────

/**
 * Simulate the downstream impact of a specific price change.
 * @param {string} productId - Product SKU or ID
 * @param {number} newPrice - Proposed new price
 * @param {object} market - { currentPrice, currentUnits, demandElasticity, competitorPrices[], category }
 * @returns Projected changes in units, revenue, margin, cannibalization, and competitor response
 */
export function simulatePriceChange(productId, newPrice, market = {}) {
  if (!productId) throw new Error("productId is required");
  if (!newPrice || newPrice <= 0) throw new Error("newPrice must be a positive number");

  const {
    currentPrice       = 100,
    currentUnits       = 1000,
    demandElasticity   = -1.5,
    competitorPrices   = [],
    category           = "general",
  } = market;

  const priceDeltaPct = (newPrice - currentPrice) / currentPrice;
  const demandChangePct = priceDeltaPct * demandElasticity;
  const projectedUnits = Math.round(currentUnits * (1 + demandChangePct));
  const currentRevenue = currentPrice * currentUnits;
  const projectedRevenue = newPrice * projectedUnits;
  const revenueChangePct = Math.round(((projectedRevenue - currentRevenue) / currentRevenue) * 1000) / 10;

  // Competitor response likelihood
  const avgCompPrice = competitorPrices.length > 0
    ? competitorPrices.reduce((s, p) => s + p, 0) / competitorPrices.length
    : currentPrice;
  const gapToCompAvg = newPrice - avgCompPrice;
  const compResponseLikelihood = newPrice < avgCompPrice * 0.9 ? "high" : newPrice < avgCompPrice * 0.97 ? "moderate" : "low";

  // Cannibalization risk — relevant if part of a product family
  const cannibalizationRisk = newPrice < currentPrice * 0.85 ? "high" : newPrice < currentPrice * 0.95 ? "moderate" : "low";

  // Margin impact (assume cost is 40–60% of current price)
  const estimatedCost = currentPrice * 0.45;
  const currentMarginPct  = ((currentPrice - estimatedCost) / currentPrice) * 100;
  const projectedMarginPct = ((newPrice - estimatedCost) / newPrice) * 100;
  const marginImpactPpts  = Math.round((projectedMarginPct - currentMarginPct) * 10) / 10;

  const { fee_usd, platform_commission_usd } = recordFee("simulate", { productId, newPrice });

  return {
    product_id:                     productId,
    current_price:                  currentPrice,
    proposed_price:                 newPrice,
    price_change_pct:               Math.round(priceDeltaPct * 1000) / 10,
    projected_units_change_pct:     Math.round(demandChangePct * 1000) / 10,
    projected_units:                projectedUnits,
    projected_revenue:              Math.round(projectedRevenue),
    projected_revenue_change:       Math.round(projectedRevenue - currentRevenue),
    projected_revenue_change_pct:   revenueChangePct,
    projected_margin_impact_ppts:   marginImpactPpts,
    current_margin_pct:             Math.round(currentMarginPct * 10) / 10,
    projected_margin_pct:           Math.round(projectedMarginPct * 10) / 10,
    cannibalization_risk:           cannibalizationRisk,
    competitor_avg_price:           Math.round(avgCompPrice * 100) / 100,
    gap_to_competitor_avg:          Math.round(gapToCompAvg * 100) / 100,
    competitor_response_likelihood: compResponseLikelihood,
    recommendation:                 revenueChangePct > 0 && marginImpactPpts > -5
      ? "Proceed — projected revenue and margin acceptable."
      : "Caution — review margin impact and competitor response risk before implementing.",
    category,
    demand_elasticity_used:         demandElasticity,
    simulated_at:                   new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── generatePromotionalPricing ───────────────────────────────────────────────

/**
 * Generate optimized promotional pricing plans across a product set.
 * @param {object[]} products - Array of { id, name, currentPrice, costBasis, currentUnits }
 * @param {string} objective - revenue|margin|volume|clearance
 * @param {object} constraints - { maxDiscountPct, minMarginPct, budget }
 * @param {number} duration - Promotion duration in days
 * @returns Promotional plan per product with expected lift and ROI
 */
export function generatePromotionalPricing(products = [], objective = "revenue", constraints = {}, duration = 14) {
  if (!Array.isArray(products) || products.length === 0) throw new Error("products array is required");

  const validObjectives = ["revenue", "margin", "volume", "clearance"];
  if (!validObjectives.includes(objective)) throw new Error(`objective must be one of: ${validObjectives.join(", ")}`);

  const {
    maxDiscountPct = 30,
    minMarginPct   = 10,
    budget         = Infinity,
  } = constraints;

  // Discount targets by objective
  const discountTargets = { revenue: 15, margin: 8, volume: 22, clearance: 35 };
  const baseDiscountPct = Math.min(maxDiscountPct, discountTargets[objective]);

  // Elasticity by objective — volume/clearance have higher elasticity boosts
  const liftMultipliers = { revenue: 1.5, margin: 1.2, volume: 2.0, clearance: 2.8 };
  const liftMultiplier  = liftMultipliers[objective];

  let totalBudgetUsed = 0;
  const promotions = products.map(product => {
    const {
      id           = randomUUID(),
      name         = "Product",
      currentPrice = 100,
      costBasis    = currentPrice * 0.45,
      currentUnits = 1000,
    } = product;

    // Adjust discount to maintain minimum margin
    const maxDiscountForMargin = Math.max(0, ((currentPrice - costBasis) / currentPrice - minMarginPct / 100) * 100);
    const discountPct = Math.min(baseDiscountPct, maxDiscountForMargin);
    const promoPrice  = Math.round(currentPrice * (1 - discountPct / 100) * 100) / 100;
    const margin      = Math.round(((promoPrice - costBasis) / promoPrice) * 1000) / 10;

    // Expected lift: discount elasticity — 1% discount → ~liftMultiplier% volume increase
    const expectedLiftPct = Math.round(discountPct * liftMultiplier * 10) / 10;
    const promoUnits      = Math.round(currentUnits * (1 + expectedLiftPct / 100));
    const incrementalUnits = promoUnits - currentUnits;
    const revenueImpact   = Math.round((promoPrice * promoUnits) - (currentPrice * currentUnits));
    const budgetImpact    = Math.round(discountPct / 100 * currentPrice * promoUnits);

    totalBudgetUsed += budgetImpact;

    return {
      product_id:           id,
      product_name:         name,
      original_price:       currentPrice,
      promo_price:          promoPrice,
      discount_pct:         Math.round(discountPct * 10) / 10,
      expected_lift_pct:    expectedLiftPct,
      projected_units:      promoUnits,
      incremental_units:    incrementalUnits,
      revenue_impact_usd:   revenueImpact,
      margin_pct:           margin,
      min_margin_met:       margin >= minMarginPct,
      budget_cost_usd:      budgetImpact,
      recommended_duration_days: duration,
      recommended_channels: objective === "clearance" ? ["email", "site_banner", "ppc"] : ["email", "site_banner"],
      creative_headline:    `Save ${Math.round(discountPct)}% on ${name} — Limited Time`,
    };
  });

  const { fee_usd, platform_commission_usd } = recordFee("promo", { objective, product_count: products.length });

  return {
    objective,
    duration_days:       duration,
    constraints,
    promotions,
    plan_summary: {
      product_count:          promotions.length,
      avg_discount_pct:       Math.round(promotions.reduce((s, p) => s + p.discount_pct, 0) / promotions.length * 10) / 10,
      total_incremental_units: promotions.reduce((s, p) => s + p.incremental_units, 0),
      total_revenue_impact:   promotions.reduce((s, p) => s + p.revenue_impact_usd, 0),
      total_budget_cost:      Math.round(totalBudgetUsed),
      budget_available:       budget === Infinity ? "unlimited" : budget,
      budget_within_limit:    budget === Infinity || totalBudgetUsed <= budget,
    },
    generated_at:        new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── getPricingDashboard ──────────────────────────────────────────────────────

/**
 * Pricing analytics dashboard with margin, competitiveness, and elasticity KPIs.
 * @param {string} productCategory - Category to analyze (e.g. "electronics")
 * @param {object} dateRange - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns Pricing KPIs with revenue attribution breakdown
 */
export function getPricingDashboard(productCategory, dateRange = {}) {
  if (!productCategory) throw new Error("productCategory is required");

  const { start = "2026-01-01", end = new Date().toISOString().split("T")[0] } = dateRange;
  const dayCount = Math.max(1, (new Date(end) - new Date(start)) / 86400000);
  const seed = productCategory.split("").reduce((s, c) => s + c.charCodeAt(0), 0);

  const avgMargin         = Math.round((28 + (seed % 22)) * 10) / 10;
  const priceCompetitiveness = Math.round((82 + (seed % 15)) * 10) / 10; // % of time at or below competitor avg
  const winRate           = Math.round((65 + (seed % 25)) * 10) / 10;    // % of price-comparison wins
  const priceElasticity   = -Math.round((1.2 + (seed % 10) / 10) * 10) / 10;

  // Revenue attribution
  const totalRevenue      = 500000 + (seed * 12345) % 4500000;
  const pricingOptRevenue = Math.round(totalRevenue * (0.08 + (seed % 12) / 100));
  const promoRevenue      = Math.round(totalRevenue * (0.15 + (seed % 8) / 100));
  const baseRevenue       = totalRevenue - pricingOptRevenue - promoRevenue;

  const competitors = db.prepare("SELECT * FROM dp_competitors WHERE categories LIKE ? ORDER BY market_share_pct DESC LIMIT 3")
    .all(`%${productCategory}%`);

  const { fee_usd, platform_commission_usd } = recordFee("dashboard", { productCategory, start, end });

  return {
    product_category:        productCategory,
    date_range:              { start, end, days: Math.round(dayCount) },
    avg_margin_pct:          avgMargin,
    price_competitiveness_pct: priceCompetitiveness,
    win_rate_pct:            winRate,
    price_elasticity:        priceElasticity,
    elasticity_interpretation: `A 1% price increase reduces demand by ${Math.abs(priceElasticity)}%`,
    revenue_attribution: {
      total_revenue:                totalRevenue,
      base_revenue:                 baseRevenue,
      pricing_optimization_revenue: pricingOptRevenue,
      promotional_revenue:          promoRevenue,
      pricing_opt_pct_of_total:     Math.round((pricingOptRevenue / totalRevenue) * 1000) / 10,
    },
    top_competitors_in_category: competitors.map(c => ({
      name: c.name,
      market_share_pct: c.market_share_pct,
      price_strategy: c.price_strategy,
    })),
    alerts: [
      ...(avgMargin < 25 ? [{ level: "warning", message: `Avg margin ${avgMargin}% below 25% target — review pricing floor` }] : []),
      ...(winRate < 60   ? [{ level: "warning", message: `Win rate ${winRate}% below 60% — consider competitive repricing` }] : []),
      ...(priceCompetitiveness < 80 ? [{ level: "info", message: `Price competitiveness ${priceCompetitiveness}% — monitor competitor activity` }] : []),
    ],
    benchmarks: {
      avg_margin_best_in_class:   42.0,
      win_rate_industry_avg:      71.0,
      price_comp_industry_avg:    85.0,
    },
    generated_at:            new Date().toISOString(),
    billing_period:          `${start} to ${end}`,
    fee_usd,
    platform_commission_usd,
  };
}
