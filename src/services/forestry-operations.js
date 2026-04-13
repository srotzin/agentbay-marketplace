/**
 * Forestry Operations Service Module
 *
 * Practical planning helpers for forest operations, compliance, and stand-level decisions.
 *
 * Note: These tools are heuristic and educational; they do not replace a registered forester.
 */

function _num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function _round(n, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/**
 * Estimate stand volume (m³/ha) from basal area and mean height using a form factor.
 */
export function forestryStandVolumeEstimate({
  basal_area_m2_per_ha,
  mean_height_m,
  form_factor = 0.45,
} = {}) {
  const G = _num(basal_area_m2_per_ha, NaN);
  const H = _num(mean_height_m, NaN);
  const f = _clamp(_num(form_factor, 0.45), 0.25, 0.8);

  if (!Number.isFinite(G) || G <= 0) {
    throw new Error("basal_area_m2_per_ha must be a positive number");
  }
  if (!Number.isFinite(H) || H <= 0) {
    throw new Error("mean_height_m must be a positive number");
  }

  // Simple stand volume proxy: V = G * H * f
  const volume_m3_per_ha = G * H * f;

  return {
    unit: "m3_per_ha",
    inputs: { basal_area_m2_per_ha: G, mean_height_m: H, form_factor: f },
    volume_m3_per_ha: _round(volume_m3_per_ha, 2),
    notes: [
      "This is a stand-level approximation; species/site/age-specific volume equations are more accurate.",
      "Typical form factors range ~0.35–0.55 depending on species and taper.",
    ],
  };
}

/**
 * Build a harvest schedule suggestion given objectives and constraints.
 */
export function forestryHarvestSchedule({
  objective = "revenue",
  area_ha,
  stand_volume_m3_per_ha,
  removal_fraction = 0.3,
  years_between_entries = 10,
  market_price_per_m3,
  harvest_cost_per_m3,
} = {}) {
  const A = _num(area_ha, NaN);
  const Vha = _num(stand_volume_m3_per_ha, NaN);
  const r = _clamp(_num(removal_fraction, 0.3), 0.05, 0.95);
  const years = _clamp(_num(years_between_entries, 10), 1, 50);
  const price = _num(market_price_per_m3, 0);
  const cost = _num(harvest_cost_per_m3, 0);

  if (!Number.isFinite(A) || A <= 0) throw new Error("area_ha must be a positive number");
  if (!Number.isFinite(Vha) || Vha <= 0) throw new Error("stand_volume_m3_per_ha must be a positive number");

  const gross_m3 = A * Vha * r;
  const gross_revenue = price > 0 ? gross_m3 * price : null;
  const gross_cost = cost > 0 ? gross_m3 * cost : null;
  const net = gross_revenue !== null && gross_cost !== null ? gross_revenue - gross_cost : null;

  const objectiveNotes = {
    revenue: ["Prioritize sawtimber value and timing around strong markets."],
    fuel_break: ["Prioritize ladder-fuel removal and spacing; consider mastication/prescribed fire."],
    habitat: ["Maintain structural diversity and retention patches; stagger entries."],
    carbon: ["Avoid high-intensity removals; consider longer rotations and low-impact harvest."],
  };

  return {
    objective,
    schedule: {
      recommended_entry: `Plan the next entry within ${years} years`,
      removal_fraction: r,
      estimated_removed_volume_m3: _round(gross_m3, 2),
      price_assumption_per_m3: price > 0 ? price : null,
      cost_assumption_per_m3: cost > 0 ? cost : null,
      estimated_gross_revenue: gross_revenue !== null ? _round(gross_revenue, 2) : null,
      estimated_harvest_cost: gross_cost !== null ? _round(gross_cost, 2) : null,
      estimated_net: net !== null ? _round(net, 2) : null,
    },
    guidance: [
      ...(objectiveNotes[objective] || ["Balance objectives (revenue, fuels, habitat, and compliance)."]),
      "Confirm legal requirements for buffers, stream crossings, and seasonal restrictions.",
      "Use a local forester/cruiser for merchantable volume by product class.",
    ],
  };
}

/**
 * Generate a compliance checklist for common forestry operations.
 */
export function forestryComplianceChecklist({
  jurisdiction = "unknown",
  operation = "harvest",
  near_water = false,
  mechanized_equipment = true,
  burning = false,
} = {}) {
  const op = String(operation || "harvest");

  const base = [
    "Verify land ownership boundaries and easements.",
    "Confirm required notifications/permits for timber operations in the jurisdiction.",
    "Document a map: access roads, landings, skid trails, sensitive areas.",
    "Implement erosion control (water bars, seeding, slash placement) on disturbed soils.",
    "Plan invasive species prevention (clean equipment, manage fill material).",
  ];

  const water = [
    "Identify riparian management zones and required setbacks.",
    "Use approved stream crossing methods; install/remove temporary crossings properly.",
    "Schedule work to avoid wet season damage; have spill kit on site.",
  ];

  const mech = [
    "Confirm road load limits/seasonal closures and hauling permits.",
    "Check operator certifications and safety plan (PPE, traffic control, communications).",
  ];

  const burn = [
    "Obtain burn permit or authorization; comply with air quality rules.",
    "Prepare burn plan: weather thresholds, containment lines, resources, mop-up.",
  ];

  return {
    jurisdiction,
    operation: op,
    checklist: [
      ...base,
      ...(near_water ? water : []),
      ...(mechanized_equipment ? mech : []),
      ...(burning ? burn : []),
    ],
    notes: [
      "Requirements vary widely by state/province/country; treat this as a starting point.",
      "For safety-critical operations, follow local OSH/worker safety standards.",
    ],
  };
}
