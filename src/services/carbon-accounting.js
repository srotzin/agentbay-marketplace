/**
 * Carbon Accounting Service Module
 *
 * Provides utilities for estimating greenhouse gas (GHG) emissions,
 * building lightweight inventories, and generating basic compliance artifacts.
 *
 * Live-mode notes:
 * - Uses only deterministic computations; no external API keys required.
 * - Emission factors are embedded reference defaults; callers can override.
 */

// Default (illustrative) emission factors. Callers should override with their preferred dataset.
const DEFAULT_FACTORS = {
  electricity: {
    unit: "kwh",
    // Global average grid intensity (kgCO2e/kWh) — placeholder default.
    kgco2e_per_unit: 0.45,
  },
  natural_gas: {
    unit: "therm",
    kgco2e_per_unit: 5.3,
  },
  diesel: {
    unit: "liter",
    kgco2e_per_unit: 2.68,
  },
  gasoline: {
    unit: "liter",
    kgco2e_per_unit: 2.31,
  },
  flight_passenger_km: {
    unit: "passenger_km",
    kgco2e_per_unit: 0.115,
  },
  shipping_tonne_km: {
    unit: "tonne_km",
    kgco2e_per_unit: 0.015,
  },
};

function round(value, decimals = 6) {
  const d = 10 ** decimals;
  return Math.round(value * d) / d;
}

function assertNumber(n, name) {
  if (typeof n !== "number" || Number.isNaN(n) || !Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function normalizeCategory(category) {
  if (!category || typeof category !== "string") return "unknown";
  return category.trim().toLowerCase();
}

export function carbonEstimateEmissions({ category, quantity, unit, factor_kgco2e_per_unit, factors = DEFAULT_FACTORS }) {
  const cat = normalizeCategory(category);
  assertNumber(quantity, "quantity");

  const factorFromMap = factors?.[cat]?.kgco2e_per_unit;
  const resolvedFactor = typeof factor_kgco2e_per_unit === "number" ? factor_kgco2e_per_unit : factorFromMap;

  if (typeof resolvedFactor !== "number" || Number.isNaN(resolvedFactor)) {
    throw new Error(`No emission factor available for category '${cat}'. Provide factor_kgco2e_per_unit.`);
  }

  const expectedUnit = factors?.[cat]?.unit;
  const resolvedUnit = unit || expectedUnit || "unit";

  const kgco2e = quantity * resolvedFactor;

  return {
    category: cat,
    quantity,
    unit: resolvedUnit,
    factor_kgco2e_per_unit: resolvedFactor,
    emissions: {
      kgco2e: round(kgco2e, 6),
      tco2e: round(kgco2e / 1000, 9),
    },
    notes: expectedUnit && unit && unit !== expectedUnit ? [`Unit mismatch: expected '${expectedUnit}' for '${cat}', got '${unit}'.`] : [],
  };
}

export function carbonBuildInventory({ agent_id, org_name, period_start, period_end, items = [] }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!org_name) throw new Error("org_name is required");

  const lineItems = items.map((it, idx) => {
    const estimate = carbonEstimateEmissions(it);
    return {
      line_id: it.line_id || `line_${idx + 1}`,
      ...estimate,
      scope: it.scope || "unspecified",
      activity: it.activity || it.category,
      source: it.source || "user_provided",
    };
  });

  const totalKg = lineItems.reduce((sum, li) => sum + li.emissions.kgco2e, 0);

  return {
    agent_id,
    org_name,
    period_start,
    period_end,
    totals: {
      kgco2e: round(totalKg, 6),
      tco2e: round(totalKg / 1000, 9),
    },
    items: lineItems,
  };
}

export function carbonGenerateDisclosure({ inventory, framework = "GHG Protocol", assurance = "none" }) {
  if (!inventory) throw new Error("inventory is required");

  const { org_name, period_start, period_end, totals } = inventory;

  return {
    framework,
    org_name,
    reporting_period: { start: period_start, end: period_end },
    totals,
    methodology: {
      approach: "activity-based estimation",
      factors: "embedded defaults (replace with jurisdictional or supplier-specific factors for compliance)",
      rounding: "kgCO2e rounded to 1e-6",
      assurance,
    },
    limitations: [
      "This module provides estimation utilities, not a certified inventory.",
      "Replace default emission factors with authoritative sources for regulatory reporting.",
    ],
  };
}

export function carbonGetDefaultFactors() {
  return DEFAULT_FACTORS;
}
