/**
 * Utilities Outage Operations Service Module
 *
 * Focus: electric utility outage triage, crew routing heuristics, and restoration ETAs.
 *
 * Note: These are simplified heuristics for agent workflows and playbooks.
 */

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Triage and rank outage tickets for dispatch priority.
 */
export function outageTriagePriority(args = {}) {
  const { outages = [], weights = {} } = args;
  if (!Array.isArray(outages) || outages.length === 0) throw new Error("outages must be a non-empty array");

  const w = {
    customers: Number(weights.customers ?? 1.0),
    critical: Number(weights.critical_facilities ?? 3.0),
    safety: Number(weights.safety_hazard ?? 5.0),
    medical: Number(weights.medical_dependency ?? 4.0),
    duration: Number(weights.duration_hours ?? 0.4),
  };

  const scored = outages.map((o, i) => {
    const outage_id = o.outage_id || `outage_${i + 1}`;
    const customers = Math.max(0, Number(o.customers_affected || 0));
    const critical = Math.max(0, Number(o.critical_facilities || 0));
    const safety = o.safety_hazard ? 1 : 0;
    const medical = o.medical_dependency ? 1 : 0;
    const duration = Math.max(0, Number(o.duration_hours || 0));

    const score =
      w.customers * Math.log10(customers + 1) +
      w.critical * critical +
      w.safety * safety +
      w.medical * medical +
      w.duration * duration;

    return {
      outage_id,
      score: round(score, 3),
      customers_affected: customers,
      critical_facilities: critical,
      safety_hazard: !!o.safety_hazard,
      medical_dependency: !!o.medical_dependency,
      duration_hours: duration,
      recommended_action: safety ? "dispatch_immediately" : customers > 500 ? "dispatch_high" : "dispatch_normal",
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    inputs: { outages: outages.length, weights: w },
    prioritized: scored,
    notes: [
      "Uses a log scale for customers affected so very large outages do not dominate everything.",
      "Always escalate safety hazards (downed lines, fire) per utility protocol.",
    ],
  };
}

/**
 * Estimate restoration time from crew capacity, tasks, and access constraints.
 */
export function outageRestorationEta(args = {}) {
  const {
    tasks = [],
    crew_count,
    hours_per_crew_per_shift = 10,
    productivity_factor = 0.8,
    access_delay_hours = 0,
  } = args;

  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error("tasks must be a non-empty array");
  if (!(crew_count > 0)) throw new Error("crew_count must be > 0");

  const prod = clamp(Number(productivity_factor ?? 0.8), 0.1, 1);
  const hrsPerCrew = Math.max(1, Number(hours_per_crew_per_shift || 10));
  const accessDelay = Math.max(0, Number(access_delay_hours || 0));

  const totalLabor = tasks.reduce((s, t) => s + Math.max(0, Number(t.labor_hours || 0)), 0);
  if (!(totalLabor > 0)) throw new Error("Total labor_hours across tasks must be > 0");

  const effectiveCrewHoursPerShift = crew_count * hrsPerCrew * prod;
  const shifts = totalLabor / effectiveCrewHoursPerShift;
  const hours = shifts * hrsPerCrew + accessDelay;

  return {
    inputs: {
      crew_count,
      hours_per_crew_per_shift: hrsPerCrew,
      productivity_factor: prod,
      access_delay_hours: accessDelay,
      tasks: tasks.length,
      total_labor_hours: round(totalLabor, 2),
    },
    estimate: {
      shifts_required: round(shifts, 2),
      restoration_hours: round(hours, 2),
    },
    notes: [
      "Assumes parallelizable work and ignores switching/drive time; use crew routing for better estimates.",
    ],
  };
}

/**
 * Assign outages to crews using a nearest-neighbor heuristic.
 */
export function outageCrewRoutingHeuristic(args = {}) {
  const { crews = [], outages = [], max_outages_per_crew = 6 } = args;

  if (!Array.isArray(crews) || crews.length === 0) throw new Error("crews must be a non-empty array");
  if (!Array.isArray(outages) || outages.length === 0) throw new Error("outages must be a non-empty array");

  const maxPer = Math.max(1, Number(max_outages_per_crew || 6));

  function distKm(a, b) {
    const dx = (Number(a.lon) - Number(b.lon)) * 111;
    const dy = (Number(a.lat) - Number(b.lat)) * 111;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const remaining = outages.map((o, i) => ({
    outage_id: o.outage_id || `outage_${i + 1}`,
    lat: Number(o.lat),
    lon: Number(o.lon),
    priority: Number(o.priority ?? 0),
  })).filter(o => Number.isFinite(o.lat) && Number.isFinite(o.lon));

  if (remaining.length === 0) throw new Error("outages must include valid lat/lon");

  // High priority first
  remaining.sort((a, b) => (b.priority - a.priority));

  const assignments = crews.map((c, i) => ({
    crew_id: c.crew_id || `crew_${i + 1}`,
    start: { lat: Number(c.lat), lon: Number(c.lon) },
    route: [],
  })).filter(c => Number.isFinite(c.start.lat) && Number.isFinite(c.start.lon));

  for (const crew of assignments) {
    let current = crew.start;
    while (crew.route.length < maxPer && remaining.length) {
      // choose closest among top N priorities
      const topN = remaining.slice(0, Math.min(20, remaining.length));
      let bestIdx = 0;
      for (let j = 1; j < topN.length; j++) {
        if (distKm(current, topN[j]) < distKm(current, topN[bestIdx])) bestIdx = j;
      }
      const chosen = topN[bestIdx];

      // remove from remaining
      const globalIdx = remaining.findIndex(x => x.outage_id === chosen.outage_id);
      remaining.splice(globalIdx, 1);

      crew.route.push({
        outage_id: chosen.outage_id,
        lat: chosen.lat,
        lon: chosen.lon,
        distance_km_from_prev: round(distKm(current, chosen), 2),
      });
      current = chosen;
    }
  }

  return {
    inputs: { crews: crews.length, outages: outages.length, max_outages_per_crew: maxPer },
    assignments,
    unassigned_outages: remaining.map(o => o.outage_id),
    notes: [
      "Uses a simple heuristic; production dispatch should incorporate travel times, skill types, and crew availability.",
    ],
  };
}
