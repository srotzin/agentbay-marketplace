/**
 * Emergency Response Operations Service
 *
 * Focus: multi-agency incident triage, resource staging, and ICS-aware comms.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute a priority score for incidents.
 *
 * Use-case: a dispatch center needs a defensible triage ordering while
 * preserving overrides for life safety.
 */
export function incidentTriagePriority(args = {}) {
  const incidents = Array.isArray(args.incidents) ? args.incidents : [];
  const w = {
    life_safety: normalizeNumber(args.weights?.life_safety, 50),
    injuries: normalizeNumber(args.weights?.injuries, 8),
    fatalities: normalizeNumber(args.weights?.fatalities, 30),
    structure_fire: normalizeNumber(args.weights?.structure_fire, 25),
    hazmat: normalizeNumber(args.weights?.hazmat, 22),
    critical_infra: normalizeNumber(args.weights?.critical_infra, 14),
    evac_required: normalizeNumber(args.weights?.evac_required, 12),
    population_exposed: normalizeNumber(args.weights?.population_exposed, 0.01),
    age_minutes: normalizeNumber(args.weights?.age_minutes, 0.2),
  };

  const now = Date.now();

  const scored = incidents.map((i, idx) => {
    const createdAt = i.created_at ? Date.parse(i.created_at) : NaN;
    const ageMinutes = Number.isFinite(createdAt) ? (now - createdAt) / 60000 : 0;

    const injuries = normalizeNumber(i.injuries, 0);
    const fatalities = normalizeNumber(i.fatalities, 0);
    const population = normalizeNumber(i.population_exposed, 0);

    const flags = {
      life_safety: Boolean(i.life_safety),
      structure_fire: Boolean(i.structure_fire),
      hazmat: Boolean(i.hazmat),
      critical_infra: Boolean(i.critical_infrastructure),
      evac_required: Boolean(i.evac_required),
    };

    let score = 0;
    if (flags.life_safety) score += w.life_safety;
    score += injuries * w.injuries;
    score += fatalities * w.fatalities;
    if (flags.structure_fire) score += w.structure_fire;
    if (flags.hazmat) score += w.hazmat;
    if (flags.critical_infra) score += w.critical_infra;
    if (flags.evac_required) score += w.evac_required;
    score += population * w.population_exposed;
    score += clamp(ageMinutes, 0, 24 * 60) * w.age_minutes;

    // Allow a manual override to pin highest priority.
    if (typeof i.manual_priority === "number") {
      score = Math.max(score, i.manual_priority);
    }

    return {
      incident_id: i.incident_id ?? `incident_${idx + 1}`,
      score: Math.round(score * 100) / 100,
      age_minutes: Math.round(ageMinutes * 10) / 10,
      tags: Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    ranked_incidents: scored,
    weights: w,
    note:
      "Higher score means higher dispatch priority. This is a heuristic and should not replace local protocols.",
  };
}

/**
 * Suggest staging locations for teams/equipment.
 *
 * Approach: select up to N staging points by choosing candidate locations that
 * minimize distance to incident clusters (k-medoids-ish heuristic).
 */
export function stagingLocationSuggest(args = {}) {
  const incidents = Array.isArray(args.incidents) ? args.incidents : [];
  const candidates = Array.isArray(args.candidates) ? args.candidates : [];
  const maxStaging = clamp(normalizeNumber(args.max_staging_locations, 3), 1, 10);

  const inc = incidents
    .map((i) => ({
      incident_id: i.incident_id,
      lat: normalizeNumber(i.lat, NaN),
      lon: normalizeNumber(i.lon, NaN),
      weight: clamp(normalizeNumber(i.weight, 1), 0.1, 100),
    }))
    .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon));

  const cand = candidates
    .map((c, idx) => ({
      location_id: c.location_id ?? `candidate_${idx + 1}`,
      lat: normalizeNumber(c.lat, NaN),
      lon: normalizeNumber(c.lon, NaN),
      capacity_units: normalizeNumber(c.capacity_units, 0),
    }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));

  if (inc.length === 0 || cand.length === 0) {
    return {
      staging_locations: [],
      note:
        "Provide at least one incident (lat/lon) and one candidate location (lat/lon).",
    };
  }

  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Greedy selection: pick the candidate that reduces weighted distance the most.
  const selected = [];
  let remaining = [...cand];

  function totalWeightedDistance(locs) {
    return inc.reduce((sum, i) => {
      const best = locs.reduce((m, l) => Math.min(m, haversineKm(i, l)), Infinity);
      return sum + best * i.weight;
    }, 0);
  }

  while (selected.length < maxStaging && remaining.length > 0) {
    let best = null;
    let bestScore = Infinity;

    for (const c of remaining) {
      const score = totalWeightedDistance([...selected, c]);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    selected.push(best);
    remaining = remaining.filter((r) => r.location_id !== best.location_id);
  }

  // Assign incidents to nearest staging.
  const assignments = inc.map((i) => {
    let bestLoc = null;
    let bestKm = Infinity;
    for (const l of selected) {
      const km = haversineKm(i, l);
      if (km < bestKm) {
        bestKm = km;
        bestLoc = l;
      }
    }
    return {
      incident_id: i.incident_id,
      staging_location_id: bestLoc.location_id,
      distance_km: Math.round(bestKm * 10) / 10,
    };
  });

  return {
    staging_locations: selected.map((s) => ({
      location_id: s.location_id,
      lat: s.lat,
      lon: s.lon,
      capacity_units: s.capacity_units,
    })),
    assignments,
    note:
      "This heuristic chooses candidate staging points to reduce weighted travel distance to incidents.",
  };
}

/**
 * Draft an Incident Command System (ICS) brief.
 *
 * Output is a structured summary that can be pasted into a situation report.
 */
export function icsBriefDraft(args = {}) {
  const incident = args.incident ?? {};
  const objectives = Array.isArray(args.objectives) ? args.objectives : [];
  const hazards = Array.isArray(args.hazards) ? args.hazards : [];

  const name = incident.name ?? incident.incident_id ?? "Unnamed incident";
  const operationalPeriod = args.operational_period ?? "Next 12 hours";

  const resources = Array.isArray(args.resources) ? args.resources : [];

  return {
    incident_name: name,
    operational_period: operationalPeriod,
    situation_overview:
      args.situation_overview ??
      "Situation overview not provided. Include what happened, current conditions, and forecast.",
    objectives: objectives.length
      ? objectives
      : [
          "Protect life safety and conduct rescues as needed.",
          "Stabilize the incident (contain fire/leak/active hazard).",
          "Protect critical infrastructure and environment.",
        ],
    hazards: hazards.length
      ? hazards
      : [
          "Downed power lines / electrocution risk",
          "Structural instability",
          "Hazardous materials exposure",
        ],
    resource_summary: resources.map((r, idx) => ({
      resource_id: r.resource_id ?? `resource_${idx + 1}`,
      kind: r.kind ?? "unknown",
      count: normalizeNumber(r.count, 1),
      eta_minutes: normalizeNumber(r.eta_minutes, 0),
      status: r.status ?? "enroute",
    })),
    comms_plan: {
      primary: args.comms_primary ?? "VHF Channel 1",
      tactical: args.comms_tactical ?? "VHF Channel 3",
      medical: args.comms_medical ?? "VHF Channel 5",
    },
    notes:
      args.notes ??
      "This is a draft. Ensure compliance with local protocols and unify terminology across agencies.",
  };
}
