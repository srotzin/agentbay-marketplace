/**
 * Ocean Shipping Service
 *
 * Offline-safe utilities for international ocean freight planning:
 * - estimate container load feasibility
 * - produce a shipment planning checklist
 * - compute basic lead-time windows (port cutoffs, ocean transit, clearance)
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const CONTAINER_SPECS = {
  "20ft": {
    label: "20ft standard",
    internal_volume_cbm: 33.2,
    max_payload_kg: 28200,
  },
  "40ft": {
    label: "40ft standard",
    internal_volume_cbm: 67.7,
    max_payload_kg: 26500,
  },
  "40hc": {
    label: "40ft high cube",
    internal_volume_cbm: 76.4,
    max_payload_kg: 26500,
  },
};

function getContainerSpec(type) {
  const t = String(type || "").toLowerCase();
  return CONTAINER_SPECS[t] || null;
}

export function oceanEstimateContainerLoad({
  container_type = "40hc",
  items,
  safety_margin = 0.1,
}) {
  const spec = getContainerSpec(container_type);
  if (!spec) throw new Error(`Unknown container_type: ${container_type}`);

  const list = Array.isArray(items) ? items : [];
  const normalized = list.map((it, idx) => {
    const units = Number(it.units ?? it.qty ?? 0);
    const weight_kg = Number(it.weight_kg ?? 0);
    const volume_cbm = Number(it.volume_cbm ?? 0);

    return {
      id: it.id || `item_${idx + 1}`,
      name: it.name || "item",
      units: Number.isFinite(units) ? units : 0,
      weight_kg: Number.isFinite(weight_kg) ? weight_kg : 0,
      volume_cbm: Number.isFinite(volume_cbm) ? volume_cbm : 0,
    };
  });

  const totals = normalized.reduce(
    (acc, it) => {
      acc.total_units += it.units;
      acc.total_weight_kg += it.units * it.weight_kg;
      acc.total_volume_cbm += it.units * it.volume_cbm;
      return acc;
    },
    { total_units: 0, total_weight_kg: 0, total_volume_cbm: 0 },
  );

  const margin = clamp(Number(safety_margin ?? 0.1), 0, 0.5);
  const usable_volume = spec.internal_volume_cbm * (1 - margin);
  const usable_payload = spec.max_payload_kg * (1 - margin);

  const volume_utilization = usable_volume > 0 ? totals.total_volume_cbm / usable_volume : 0;
  const weight_utilization = usable_payload > 0 ? totals.total_weight_kg / usable_payload : 0;

  const fits_by_volume = totals.total_volume_cbm <= usable_volume;
  const fits_by_weight = totals.total_weight_kg <= usable_payload;

  const limiting_factor = volume_utilization >= weight_utilization ? "volume" : "weight";

  const recommendation =
    fits_by_volume && fits_by_weight
      ? "Fits in a single container under the chosen safety margin."
      : "Does not fit in a single container under the chosen safety margin; consider splitting across multiple containers or reducing load.";

  return {
    container: {
      type: container_type,
      label: spec.label,
      internal_volume_cbm: spec.internal_volume_cbm,
      max_payload_kg: spec.max_payload_kg,
      safety_margin: margin,
      usable_volume_cbm: round2(usable_volume),
      usable_payload_kg: round2(usable_payload),
    },
    totals: {
      total_units: round2(totals.total_units),
      total_weight_kg: round2(totals.total_weight_kg),
      total_volume_cbm: round2(totals.total_volume_cbm),
    },
    utilization: {
      volume: round2(volume_utilization),
      weight: round2(weight_utilization),
      limiting_factor,
    },
    fits: {
      by_volume: fits_by_volume,
      by_weight: fits_by_weight,
      overall: fits_by_volume && fits_by_weight,
    },
    recommendation,
  };
}

export function oceanShipmentChecklist({
  incoterm = "FOB",
  cargo_type = "general",
  mode = "FCL",
  needs = [],
}) {
  const n = new Set((Array.isArray(needs) ? needs : []).map((x) => String(x).toLowerCase()));

  const checklist = [
    {
      category: "Commercial",
      items: [
        "Confirm HS codes + product descriptions",
        "Confirm Incoterms responsibilities (seller vs buyer)",
        "Create pro forma / commercial invoice",
        "Confirm packing list details (cartons, weights, dims)",
      ],
    },
    {
      category: "Freight booking",
      items: [
        `Choose mode: ${mode} (FCL vs LCL)` ,
        "Select origin/destination ports and preferred carrier/forwarder",
        "Book vessel and confirm sailing schedule (ETD/ETA)",
        "Confirm container type and pickup/return depots",
      ],
    },
    {
      category: "Documentation",
      items: [
        "Shipper's Letter of Instruction (SLI) if using a forwarder",
        "Bill of Lading instructions and consignee/notify details",
        "Certificates if required (COO, phytosanitary, MSDS)",
      ],
    },
    {
      category: "Customs",
      items: [
        "Confirm importer of record and customs broker",
        "Pre-clearance: submit entry data before arrival if possible",
        "Verify duties/taxes and required licenses/permits",
      ],
    },
    {
      category: "Risk & insurance",
      items: [
        "Decide cargo insurance coverage (All Risk vs named perils)",
        "Plan for damage/shortage claims process",
      ],
    },
    {
      category: "Operations",
      items: [
        "Confirm warehouse loading plan and seal procedure",
        "Capture container condition photos + seal number",
        "Track milestones: gate-in, loaded on vessel, discharge, out-gate",
      ],
    },
  ];

  if (String(incoterm).toUpperCase() === "DDP") {
    checklist.push({
      category: "DDP specifics",
      items: [
        "Confirm seller will pay import duties/taxes and can act via local broker",
        "Confirm last-mile delivery appointment scheduling",
      ],
    });
  }

  if (cargo_type === "hazmat" || n.has("hazmat") || n.has("msds")) {
    checklist.push({
      category: "Hazmat",
      items: [
        "Confirm IMDG classification and packing group",
        "Prepare SDS/MSDS and hazmat declarations",
        "Confirm carrier acceptance and restrictions",
      ],
    });
  }

  if (n.has("cold") || n.has("reefer")) {
    checklist.push({
      category: "Temperature-controlled",
      items: [
        "Confirm reefer setpoint and temperature recording",
        "Plan pre-trip inspection (PTI) and power availability",
      ],
    });
  }

  return {
    incoterm: String(incoterm).toUpperCase(),
    cargo_type,
    mode,
    checklist,
  };
}

export function oceanLeadTimeWindow({
  origin_cutoff_days = 4,
  ocean_transit_days = 24,
  destination_clearance_days = 5,
  buffer_days = 3,
}) {
  const a = [origin_cutoff_days, ocean_transit_days, destination_clearance_days, buffer_days].map((x) =>
    Math.max(0, Number(x) || 0),
  );
  const [cutoff, transit, clearance, buffer] = a;

  const best_case = cutoff + transit + clearance;
  const worst_case = best_case + buffer;

  return {
    assumptions_days: {
      origin_cutoff_days: cutoff,
      ocean_transit_days: transit,
      destination_clearance_days: clearance,
      buffer_days: buffer,
    },
    window_days: {
      best_case_days: round2(best_case),
      worst_case_days: round2(worst_case),
    },
    guidance: [
      "Use carrier schedules for transit time; add more buffer during peak season.",
      "If using LCL, add consolidation/deconsolidation time at both ends.",
      "Customs clearance can vary widely; pre-clear docs and ensure correct HS codes.",
    ],
  };
}
