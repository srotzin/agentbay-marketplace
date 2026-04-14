/**
 * Maritime & Port Operations Service Module
 *
 * Focus: container terminal planning, berth allocation heuristics, and demurrage estimates.
 *
 * Note: These are lightweight heuristics intended for agent planning + rough ops estimates,
 * not a substitute for port/terminal TOS software.
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/**
 * Estimate crane-hours and total move time for a container vessel.
 */
export function portCraneHoursEstimate(args = {}) {
  const {
    total_moves,
    cranes_assigned = 4,
    moves_per_crane_hour = 25,
    efficiency_factor = 0.85,
    shift_change_hours = 0,
  } = args;

  if (!(total_moves > 0)) throw new Error("total_moves must be > 0");
  if (!(cranes_assigned > 0)) throw new Error("cranes_assigned must be > 0");
  if (!(moves_per_crane_hour > 0)) throw new Error("moves_per_crane_hour must be > 0");

  const eff = clamp(Number(efficiency_factor ?? 0.85), 0.1, 1);
  const effectiveRate = cranes_assigned * moves_per_crane_hour * eff;

  const pureHours = total_moves / effectiveRate;
  const totalHours = pureHours + Number(shift_change_hours || 0);

  return {
    inputs: {
      total_moves,
      cranes_assigned,
      moves_per_crane_hour,
      efficiency_factor: eff,
      shift_change_hours: Number(shift_change_hours || 0),
    },
    effective_moves_per_hour: round(effectiveRate, 2),
    pure_work_hours: round(pureHours, 2),
    total_hours_including_shift_change: round(totalHours, 2),
    notes: [
      "Assumes a constant net move rate; weather, equipment downtime, and yard congestion can materially impact results.",
    ],
  };
}

/**
 * Build a simple berth plan (FCFS heuristic) and detect conflicts.
 */
export function portBerthPlanHeuristic(args = {}) {
  const {
    vessels = [],
    berth_count = 2,
    safety_gap_hours = 0.5,
  } = args;

  if (!Array.isArray(vessels) || vessels.length === 0) {
    throw new Error("vessels must be a non-empty array");
  }
  if (!(berth_count > 0)) throw new Error("berth_count must be > 0");

  const gap = Math.max(0, Number(safety_gap_hours || 0));

  // Normalize and sort by ETA
  const v = vessels.map((x, i) => {
    const id = x.vessel_id || `vessel_${i + 1}`;
    const eta = new Date(x.eta).getTime();
    const service = Number(x.service_hours);
    if (!Number.isFinite(eta)) throw new Error(`Invalid eta for ${id}`);
    if (!(service > 0)) throw new Error(`service_hours must be > 0 for ${id}`);
    return { ...x, vessel_id: id, eta_ms: eta, service_hours: service };
  }).sort((a, b) => a.eta_ms - b.eta_ms);

  // Track next available time per berth
  const berths = Array.from({ length: berth_count }, () => ({ next_ms: -Infinity }));
  const schedule = [];

  for (const vessel of v) {
    // assign to the berth that frees the earliest, but not before ETA
    let bestIdx = 0;
    for (let i = 1; i < berths.length; i++) {
      if (berths[i].next_ms < berths[bestIdx].next_ms) bestIdx = i;
    }

    const start_ms = Math.max(vessel.eta_ms, berths[bestIdx].next_ms);
    const end_ms = start_ms + vessel.service_hours * 3600_000;
    berths[bestIdx].next_ms = end_ms + gap * 3600_000;

    schedule.push({
      vessel_id: vessel.vessel_id,
      berth: bestIdx + 1,
      eta: new Date(vessel.eta_ms).toISOString(),
      start: new Date(start_ms).toISOString(),
      end: new Date(end_ms).toISOString(),
      wait_hours: round((start_ms - vessel.eta_ms) / 3600_000, 2),
      service_hours: vessel.service_hours,
    });
  }

  const totalWait = schedule.reduce((s, x) => s + x.wait_hours, 0);
  const maxWait = Math.max(...schedule.map(x => x.wait_hours));

  return {
    inputs: { berth_count, safety_gap_hours: gap, vessels: vessels.length },
    schedule,
    kpis: {
      total_wait_hours: round(totalWait, 2),
      avg_wait_hours: round(totalWait / schedule.length, 2),
      max_wait_hours: round(maxWait, 2),
    },
    notes: [
      "This is a simple first-come-first-served heuristic. For tidal windows, crane constraints, and yard constraints, use an optimizer.",
    ],
  };
}

/**
 * Estimate demurrage/detention cost for a set of containers based on free days.
 */
export function portDemurrageEstimate(args = {}) {
  const {
    containers = [],
    free_days = 4,
    rate_per_container_day = 150,
    start_date,
    end_date,
  } = args;

  if (!Array.isArray(containers) || containers.length === 0) {
    throw new Error("containers must be a non-empty array");
  }

  const s = new Date(start_date).getTime();
  const e = new Date(end_date).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
    throw new Error("start_date and end_date must be valid ISO dates with end_date after start_date");
  }

  const totalDays = Math.ceil((e - s) / 86400_000);
  const chargeableDays = Math.max(0, totalDays - Math.max(0, Number(free_days || 0)));
  const rate = Math.max(0, Number(rate_per_container_day || 0));

  const items = containers.map((c, i) => {
    const id = c.container_id || `ctr_${i + 1}`;
    const count = Math.max(1, Number(c.count || 1));
    const cost = chargeableDays * rate * count;
    return { container_id: id, count, chargeable_days: chargeableDays, cost_usd: round(cost, 2) };
  });

  const total = items.reduce((s2, x) => s2 + x.cost_usd, 0);

  return {
    inputs: {
      free_days: Math.max(0, Number(free_days || 0)),
      rate_per_container_day: rate,
      start_date: new Date(s).toISOString(),
      end_date: new Date(e).toISOString(),
      total_days: totalDays,
      chargeable_days: chargeableDays,
    },
    line_items: items,
    total_cost_usd: round(total, 2),
    notes: [
      "Rates and free time vary by carrier, terminal, and contract. Use as a quick estimate.",
    ],
  };
}
