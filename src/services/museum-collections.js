/**
 * Museum Collections Service
 *
 * Focus: accessioning, provenance risk triage, and deaccession recommendation scaffolding.
 */

function normalizeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Generate accession identifiers for new objects.
 *
 * Common museum formats include YYYY.NNN or YYYY.NNN.a (for multi-part).
 */
export function accessionIdGenerate(args = {}) {
  const year = String(args.year ?? new Date().getUTCFullYear());
  const sequence_start = clamp(normalizeNumber(args.sequence_start, 1), 1, 999999);
  const count = clamp(normalizeNumber(args.count, 1), 1, 500);
  const prefix = args.prefix ? String(args.prefix) : "";
  const pad = clamp(normalizeNumber(args.pad, 3), 1, 8);

  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const seq = String(sequence_start + i).padStart(pad, "0");
    ids.push(`${prefix}${year}.${seq}`);
  }

  return {
    accession_ids: ids,
    note:
      "Validate against your collections management system to avoid collisions; this tool does not check existing accessions.",
  };
}

/**
 * Triage provenance risk.
 *
 * This is a heuristic to flag objects needing deeper provenance research
 * (e.g., high-risk time periods, missing ownership chain, conflict regions).
 */
export function provenanceRiskScore(args = {}) {
  const objects = Array.isArray(args.objects) ? args.objects : [];
  const w = {
    missing_chain: normalizeNumber(args.weights?.missing_chain, 30),
    conflict_region: normalizeNumber(args.weights?.conflict_region, 18),
    nazi_era_gap: normalizeNumber(args.weights?.nazi_era_gap, 25),
    antiquities: normalizeNumber(args.weights?.antiquities, 14),
    export_docs_missing: normalizeNumber(args.weights?.export_docs_missing, 16),
    high_value: normalizeNumber(args.weights?.high_value, 10),
  };

  const scored = objects.map((o, idx) => {
    const categories = Array.isArray(o.categories) ? o.categories.map(String) : [];
    const categorySet = new Set(categories.map((c) => c.toLowerCase()));

    const flags = {
      missing_chain: Boolean(o.missing_ownership_chain),
      conflict_region: Boolean(o.conflict_region),
      nazi_era_gap: Boolean(o.nazi_era_gap),
      antiquities:
        Boolean(o.antiquities) || categorySet.has("antiquities") || categorySet.has("archaeology"),
      export_docs_missing: Boolean(o.export_docs_missing),
      high_value: normalizeNumber(o.estimated_value_usd, 0) >= 250000,
    };

    let score = 0;
    if (flags.missing_chain) score += w.missing_chain;
    if (flags.conflict_region) score += w.conflict_region;
    if (flags.nazi_era_gap) score += w.nazi_era_gap;
    if (flags.antiquities) score += w.antiquities;
    if (flags.export_docs_missing) score += w.export_docs_missing;
    if (flags.high_value) score += w.high_value;

    // Adjustments: older acquisition dates can increase risk if documentation is thin.
    const acquisitionYear = o.acquired_year ? normalizeNumber(o.acquired_year, NaN) : NaN;
    if (Number.isFinite(acquisitionYear) && acquisitionYear < 1970 && flags.missing_chain) {
      score += 6;
    }

    return {
      object_id: o.object_id ?? `object_${idx + 1}`,
      score: Math.round(score * 100) / 100,
      flags: Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k),
      weights: w,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    ranked_objects: scored,
    note:
      "Higher score means higher provenance risk and should trigger deeper research and/or legal review.",
  };
}

/**
 * Recommend a deaccession pathway.
 *
 * Outputs a recommendation category plus checklist prompts.
 */
export function deaccessionRecommendation(args = {}) {
  const object = args.object ?? {};
  const mission_fit = clamp(normalizeNumber(object.mission_fit, 0.5), 0, 1);
  const condition = clamp(normalizeNumber(object.condition, 0.5), 0, 1);
  const duplicates = clamp(normalizeNumber(object.duplicates, 0), 0, 999);
  const legal_restrictions = Boolean(object.legal_restrictions);
  const donor_restrictions = Boolean(object.donor_restrictions);
  const hazardous = Boolean(object.hazardous_materials);

  let recommendation = "retain";
  if (legal_restrictions || donor_restrictions) {
    recommendation = "retain_or_seek_counsel";
  } else if (mission_fit < 0.3 && (duplicates > 0 || condition < 0.3)) {
    recommendation = "candidate_for_deaccession";
  } else if (mission_fit < 0.3) {
    recommendation = "review_for_transfer";
  } else if (condition < 0.2) {
    recommendation = "conservation_or_disposal_review";
  }

  if (hazardous) recommendation = "hazmat_handling_required";

  const checklist = [
    "Confirm clear title and ownership rights.",
    "Review donor agreements and restrictions.",
    "Check cultural property and repatriation considerations (e.g., NAGPRA where applicable).",
    "Confirm proceeds use policy (collections care vs general operations).",
    "Ensure board approval and documentation per institutional policy.",
  ];

  return {
    recommendation,
    drivers: {
      mission_fit,
      condition,
      duplicates,
      legal_restrictions,
      donor_restrictions,
      hazardous,
    },
    checklist,
    note:
      "This tool provides a policy scaffold and is not legal advice. Deaccession decisions should follow institutional and jurisdictional rules.",
  };
}
