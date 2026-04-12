/**
 * Laboratory Automation Service
 *
 * Offline-safe utilities for wet-lab ops:
 * - convert protocols into run sheets
 * - calculate reagent master mixes
 * - generate sample plate maps
 */

function roundTo(n, places = 3) {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

function asNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function labMasterMix({
  reactions,
  overage = 0.1,
  components,
}) {
  const rxn = Math.max(0, Math.floor(asNumber(reactions, 0)));
  const ov = Math.min(0.5, Math.max(0, asNumber(overage, 0.1)));
  const comps = Array.isArray(components) ? components : [];

  if (!rxn) throw new Error("reactions must be a positive integer");
  if (!comps.length) throw new Error("components must be a non-empty array");

  const total_reactions = Math.ceil(rxn * (1 + ov));

  const mix = comps.map((c, idx) => {
    const per_rxn_ul = asNumber(c.per_reaction_ul ?? c.volume_ul ?? 0);
    return {
      id: c.id || `cmp_${idx + 1}`,
      name: c.name || "component",
      per_reaction_ul: roundTo(per_rxn_ul, 4),
      total_ul: roundTo(per_rxn_ul * total_reactions, 4),
      notes: c.notes || "",
    };
  });

  const total_mix_ul = roundTo(mix.reduce((s, c) => s + c.total_ul, 0), 4);

  return {
    reactions_requested: rxn,
    overage: ov,
    total_reactions_prepared: total_reactions,
    components: mix,
    total_mix_ul,
    guidance: [
      "Prepare master mix on ice if enzymes are temperature-sensitive.",
      "Vortex and quick-spin components as appropriate before aliquoting.",
      "Label tubes with component lot numbers for traceability.",
    ],
  };
}

export function labPlateMap({
  plate_type = "96",
  samples,
  controls = [],
  layout = "row",
}) {
  const rows = plate_type === "384" ? 16 : 8;
  const cols = plate_type === "384" ? 24 : 12;

  const s = Array.isArray(samples) ? samples : [];
  const c = Array.isArray(controls) ? controls : [];
  const wells = [];

  const all = [...c.map((x) => ({ ...x, _kind: "control" })), ...s.map((x) => ({ ...x, _kind: "sample" }))];

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const well = String.fromCharCode(65 + r) + String(col + 1).padStart(2, "0");
      const entry = all[idx];
      if (!entry) {
        wells.push({ well, kind: "empty", name: "" });
      } else {
        wells.push({
          well,
          kind: entry._kind,
          name: entry.name || entry.id || `item_${idx + 1}`,
          metadata: entry.metadata || {},
        });
      }
      idx++;
    }
  }

  if (layout === "column") {
    // Reorder wells column-major while preserving assignment order
    const reordered = [];
    let k = 0;
    for (let col = 0; col < cols; col++) {
      for (let r = 0; r < rows; r++) {
        reordered.push({ ...wells[k++] });
      }
    }
    return { plate_type, rows, cols, layout, wells: reordered };
  }

  return { plate_type, rows, cols, layout, wells };
}

export function labProtocolRunSheet({
  title,
  steps,
  metadata = {},
}) {
  const list = Array.isArray(steps) ? steps : [];
  const normalized = list.map((s, idx) => ({
    step: idx + 1,
    action: s.action || s.task || "step",
    duration_min: asNumber(s.duration_min ?? s.minutes ?? 0),
    notes: s.notes || "",
    checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : [],
  }));

  const total_minutes = roundTo(normalized.reduce((sum, s) => sum + s.duration_min, 0), 2);

  return {
    title: title || "Lab protocol run sheet",
    metadata,
    total_minutes,
    steps: normalized,
    guidance: [
      "Include lot numbers and instrument IDs in metadata for reproducibility.",
      "Add checkpoints at critical incubation and temperature steps.",
    ],
  };
}
