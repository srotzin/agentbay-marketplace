/**
 * Waste Management Services
 *
 * Focus: routing, container planning, contamination checks, and diversion metrics.
 */

export function wasteRoutePlanner({
  stops = [],
  depot = null,
  average_stop_minutes = 8,
  truck_capacity_volume = null,
  truck_capacity_weight = null,
  max_route_minutes = 480,
} = {}) {
  if (!Array.isArray(stops) || stops.length === 0) {
    return { ok: false, error: "stops must be a non-empty array" };
  }

  const normalizedStops = stops.map((s, i) => ({
    id: s.id ?? `stop_${i + 1}`,
    address: s.address ?? null,
    volume: Number(s.volume ?? 0),
    weight: Number(s.weight ?? 0),
    service_minutes: Number(s.service_minutes ?? average_stop_minutes),
    priority: s.priority ?? "normal",
  }));

  // Simple heuristic: prioritize "high" first, then original order.
  normalizedStops.sort((a, b) => {
    const pa = a.priority === "high" ? 0 : 1;
    const pb = b.priority === "high" ? 0 : 1;
    return pa - pb;
  });

  const totals = normalizedStops.reduce(
    (acc, s) => {
      acc.total_volume += s.volume;
      acc.total_weight += s.weight;
      acc.total_service_minutes += s.service_minutes;
      return acc;
    },
    { total_volume: 0, total_weight: 0, total_service_minutes: 0 }
  );

  const capacityFlags = {
    volume_exceeds_capacity:
      truck_capacity_volume != null && totals.total_volume > Number(truck_capacity_volume),
    weight_exceeds_capacity:
      truck_capacity_weight != null && totals.total_weight > Number(truck_capacity_weight),
    time_exceeds_limit: totals.total_service_minutes > Number(max_route_minutes),
  };

  return {
    ok: true,
    depot,
    plan: {
      stops: normalizedStops,
      totals,
      capacityFlags,
      notes: [
        "This is a heuristic ordering (priority + input order).",
        "For true drive-time optimization, feed stop coordinates into a routing engine and use this tool for capacity/time checks.",
      ],
    },
  };
}

export function wasteContainerSizing({
  daily_volume,
  days_between_pickups = 7,
  compaction_ratio = 1,
  container_volume = 8,
  safety_factor = 1.15,
} = {}) {
  const dv = Number(daily_volume ?? 0);
  if (!isFinite(dv) || dv <= 0) return { ok: false, error: "daily_volume must be > 0" };

  const days = Number(days_between_pickups);
  const comp = Number(compaction_ratio);
  const cv = Number(container_volume);
  const sf = Number(safety_factor);

  const effectiveVolumeNeeded = (dv * days * sf) / Math.max(comp, 1e-9);
  const containers = Math.ceil(effectiveVolumeNeeded / cv);

  return {
    ok: true,
    inputs: {
      daily_volume: dv,
      days_between_pickups: days,
      compaction_ratio: comp,
      container_volume: cv,
      safety_factor: sf,
    },
    result: {
      effective_volume_needed: effectiveVolumeNeeded,
      containers_required: containers,
      recommended_container_volume_each: cv,
    },
  };
}

export function recyclingContaminationCheck({
  stream = "single_stream",
  items = [],
  known_contaminants = ["plastic bag", "food", "grease", "battery", "electronics", "propane", "needle"],
} = {}) {
  const itemList = Array.isArray(items) ? items : [];
  const contaminants = [];

  for (const it of itemList) {
    const name = String(it?.name ?? it ?? "").toLowerCase().trim();
    if (!name) continue;
    if (known_contaminants.some((c) => name.includes(String(c).toLowerCase()))) {
      contaminants.push({ item: it?.name ?? it, reason: "Known contaminant" });
    }
  }

  const contamination_rate = itemList.length ? contaminants.length / itemList.length : 0;

  return {
    ok: true,
    stream,
    totals: {
      items_checked: itemList.length,
      contaminants_found: contaminants.length,
      contamination_rate,
    },
    contaminants,
    guidance: [
      "If contamination rate is high, consider targeted signage, bin placement changes, or an audit of upstream sorting.",
      "Hazardous items should be diverted to proper disposal channels.",
    ],
  };
}

export function diversionMetrics({
  recycled_tons = 0,
  composted_tons = 0,
  landfill_tons = 0,
  energy_recovery_tons = 0,
} = {}) {
  const r = Number(recycled_tons);
  const c = Number(composted_tons);
  const l = Number(landfill_tons);
  const e = Number(energy_recovery_tons);

  const total = Math.max(r + c + l + e, 0);
  const diverted = Math.max(r + c + e, 0);

  return {
    ok: true,
    totals: {
      total_tons: total,
      diverted_tons: diverted,
      landfill_tons: l,
    },
    diversion_rate: total > 0 ? diverted / total : 0,
    breakdown: {
      recycled_share: total > 0 ? r / total : 0,
      composted_share: total > 0 ? c / total : 0,
      energy_recovery_share: total > 0 ? e / total : 0,
      landfill_share: total > 0 ? l / total : 0,
    },
  };
}
