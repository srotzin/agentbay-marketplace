/**
 * Water Treatment Operations Service Module
 *
 * Lightweight calculators and checklists for drinking water / wastewater operations.
 *
 * Note: These tools are heuristic and do not replace licensed operator judgment.
 */

function _num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _round(n, decimals = 3) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

function _clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert a target chlorine dose (mg/L) and flow rate to required chlorine mass per day.
 */
export function waterChlorineDoseCalculator({
  flow_m3_per_day,
  target_dose_mg_per_l,
  demand_mg_per_l = 0,
  solution_strength_percent = 12.5,
} = {}) {
  const Q = _num(flow_m3_per_day, NaN);
  const dose = _num(target_dose_mg_per_l, NaN);
  const demand = _num(demand_mg_per_l, 0);
  const strengthPct = _clamp(_num(solution_strength_percent, 12.5), 0.1, 100);

  if (!Number.isFinite(Q) || Q <= 0) throw new Error("flow_m3_per_day must be a positive number");
  if (!Number.isFinite(dose) || dose < 0) throw new Error("target_dose_mg_per_l must be a non-negative number");
  if (!Number.isFinite(demand) || demand < 0) throw new Error("demand_mg_per_l must be a non-negative number");

  const applied_mg_per_l = dose + demand;

  // 1 m3 = 1000 L; mg/L * L = mg; /1e6 = kg
  const kg_per_day_as_cl2 = applied_mg_per_l * (Q * 1000) / 1e6;

  // Convert to solution volume/mass given weight percent (approximation)
  const solution_fraction = strengthPct / 100;
  const kg_solution_per_day = solution_fraction > 0 ? kg_per_day_as_cl2 / solution_fraction : null;

  return {
    inputs: {
      flow_m3_per_day: Q,
      target_dose_mg_per_l: dose,
      demand_mg_per_l: demand,
      solution_strength_percent: strengthPct,
    },
    outputs: {
      applied_mg_per_l: _round(applied_mg_per_l, 3),
      chlorine_kg_per_day_as_cl2: _round(kg_per_day_as_cl2, 3),
      chlorine_solution_kg_per_day_est: kg_solution_per_day !== null ? _round(kg_solution_per_day, 3) : null,
    },
    notes: [
      "This assumes mg/L as Cl2 equivalent and ignores solution density; adjust for product density for accurate pump settings.",
      "Always validate CT requirements and residual targets per local regulations.",
    ],
  };
}

/**
 * Estimate alum dose (mg/L) based on a turbidity change using a crude linear heuristic.
 */
export function waterCoagulantDoseEstimate({
  influent_turbidity_ntu,
  target_turbidity_ntu = 1,
  base_dose_mg_per_l = 10,
  mg_per_l_per_ntu = 1.5,
  max_dose_mg_per_l = 80,
} = {}) {
  const tin = _num(influent_turbidity_ntu, NaN);
  const tout = _num(target_turbidity_ntu, 1);
  const base = _num(base_dose_mg_per_l, 10);
  const slope = _num(mg_per_l_per_ntu, 1.5);
  const maxDose = _num(max_dose_mg_per_l, 80);

  if (!Number.isFinite(tin) || tin < 0) throw new Error("influent_turbidity_ntu must be a non-negative number");
  if (!Number.isFinite(tout) || tout < 0) throw new Error("target_turbidity_ntu must be a non-negative number");

  const delta = Math.max(0, tin - tout);
  const dose = _clamp(base + slope * delta, 0, maxDose);

  return {
    inputs: {
      influent_turbidity_ntu: tin,
      target_turbidity_ntu: tout,
      base_dose_mg_per_l: base,
      mg_per_l_per_ntu: slope,
      max_dose_mg_per_l: maxDose,
    },
    estimated_alum_dose_mg_per_l: _round(dose, 2),
    caveats: [
      "Coagulant dosing must be determined via jar testing; this output is only a starting point.",
      "Raw water alkalinity, pH, temperature, NOM, and polymer use materially affect optimal dose.",
    ],
  };
}

/**
 * Generate an operator shift checklist for common plant conditions.
 */
export function waterOperatorShiftChecklist({
  plant_type = "drinking_water",
  disinfection = "chlorine",
  includes_filtration = true,
  includes_sludge_handling = false,
} = {}) {
  const pt = String(plant_type || "drinking_water");

  const common = [
    "Review alarms/trends since last shift and confirm critical setpoints.",
    "Walk the process: leaks, unusual vibrations/noise, odors, housekeeping.",
    "Verify chemical inventories and day tanks; confirm secondary containment.",
    "Check instrumentation health: analyzers, calibrations due, sample lines.",
    "Document any maintenance lockouts/LOTO and safety hazards.",
  ];

  const dw = [
    "Confirm source water quality and any intake constraints.",
    "Verify disinfectant residual at key points and compliance sampling schedule.",
    "Confirm clearwell/tank levels and distribution pump status.",
  ];

  const ww = [
    "Confirm influent flow/load and wet-weather bypass risk.",
    "Check DO/ORP targets, RAS/WAS rates, and sludge blanket levels.",
    "Inspect aeration, blowers, and odor control systems.",
  ];

  const filtration = [
    "Check filter run times/headloss; schedule backwash as needed.",
    "Inspect turbidimeters and particle counts; validate effluent quality.",
  ];

  const sludge = [
    "Verify polymer prep/dose, dewatering status, and cake storage/haul schedule.",
    "Check thickener/centrifuge/belt press condition and washdown.",
  ];

  const disinfect = {
    chlorine: ["Inspect chlorine feed and leak detection; verify injector/vacuum systems."],
    chloramine: ["Confirm ammonia feed ratio and monitor nitrification indicators."],
    uv: ["Check UV intensity and wiper function; verify standby ballast/lamps."],
    ozone: ["Verify ozone generator status and off-gas destruct operation."],
  };

  return {
    plant_type: pt,
    checklist: [
      ...common,
      ...(pt === "wastewater" ? ww : dw),
      ...(includes_filtration ? filtration : []),
      ...(includes_sludge_handling ? sludge : []),
      ...(disinfect[disinfection] || []),
    ],
    notes: [
      "Customize for your facility SOPs and regulatory reporting requirements.",
      "For safety-critical checks (gas chlorine, confined space), follow required procedures.",
    ],
  };
}
