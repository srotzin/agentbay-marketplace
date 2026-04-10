/**
 * Supply Chain ESG Service Module
 *
 * Helps agents assess supplier ESG risk, produce questionnaires,
 * and prioritize outreach based on a simple weighted scoring model.
 */

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function normStr(s) {
  if (!s) return "";
  return String(s).trim();
}

function asArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// Default scoring weights. Sum to 1.
const DEFAULT_WEIGHTS = {
  labor: 0.25,
  environment: 0.25,
  governance: 0.20,
  data_privacy: 0.15,
  human_rights: 0.15,
};

// Heuristic risk signals.
const RISK_SIGNALS = {
  high_risk_countries: ["MM", "AF", "IR", "SY", "KP", "RU"],
  regulated_sectors: ["pharma", "medical", "financial", "defense", "energy"],
};

export function esgScoreSupplier({
  supplier_name,
  country_code,
  sector,
  answers = {},
  weights = DEFAULT_WEIGHTS,
}) {
  supplier_name = normStr(supplier_name);
  if (!supplier_name) throw new Error("supplier_name is required");

  const cc = normStr(country_code).toUpperCase();
  const sec = normStr(sector).toLowerCase();

  // Answers are expected to be 0..1 where 1 is best.
  const labor = clamp01(answers.labor ?? 0.5);
  const environment = clamp01(answers.environment ?? 0.5);
  const governance = clamp01(answers.governance ?? 0.5);
  const data_privacy = clamp01(answers.data_privacy ?? 0.5);
  const human_rights = clamp01(answers.human_rights ?? 0.5);

  const score =
    labor * weights.labor +
    environment * weights.environment +
    governance * weights.governance +
    data_privacy * weights.data_privacy +
    human_rights * weights.human_rights;

  const signals = [];
  if (cc && RISK_SIGNALS.high_risk_countries.includes(cc)) signals.push("high_risk_country");
  if (sec && RISK_SIGNALS.regulated_sectors.includes(sec)) signals.push("regulated_sector");

  // Convert quality score to risk score.
  const risk = 1 - score;

  return {
    supplier_name,
    country_code: cc || null,
    sector: sec || null,
    quality_score_0_1: Math.round(score * 10000) / 10000,
    risk_score_0_1: Math.round(risk * 10000) / 10000,
    signals,
    interpretation:
      risk > 0.66 ? "high" : risk > 0.33 ? "medium" : "low",
  };
}

export function esgPrioritizeSuppliers({ suppliers = [], top_n = 10 }) {
  const scored = suppliers.map((s) => ({
    ...esgScoreSupplier(s),
    metadata: {
      spend_usd: s.spend_usd ?? null,
      criticality: s.criticality ?? null,
    },
  }));

  // Priority: highest risk first, then highest spend.
  const sorted = scored.sort((a, b) => {
    const r = b.risk_score_0_1 - a.risk_score_0_1;
    if (r !== 0) return r;
    return (b.metadata.spend_usd ?? 0) - (a.metadata.spend_usd ?? 0);
  });

  return {
    total: sorted.length,
    top_n,
    suppliers: sorted.slice(0, Math.max(0, top_n)),
  };
}

export function esgGenerateQuestionnaire({
  supplier_name,
  focus_areas = ["labor", "environment", "governance", "data_privacy", "human_rights"],
}) {
  supplier_name = normStr(supplier_name);
  const areas = asArray(focus_areas).map((x) => String(x).trim());

  const questionsByArea = {
    labor: [
      "Do you have a documented policy prohibiting forced labor and child labor?",
      "Do you conduct regular wage-and-hour compliance audits?",
      "What grievance mechanisms exist for workers?",
    ],
    environment: [
      "Do you track Scope 1 and Scope 2 emissions?",
      "Do you have energy reduction targets and a baseline year?",
      "How do you manage hazardous waste and water discharge?",
    ],
    governance: [
      "Do you maintain an anti-corruption and gifts policy?",
      "Is ESG oversight assigned to a board member or executive?",
      "Do you have third-party risk management procedures?",
    ],
    data_privacy: [
      "Do you have an incident response plan for data breaches?",
      "What personal data do you process on behalf of customers?",
      "Do you perform regular penetration tests or security assessments?",
    ],
    human_rights: [
      "Do you have a human rights policy aligned with UNGP?",
      "Do you conduct country-level human rights due diligence?",
      "How do you remediate identified rights impacts?",
    ],
  };

  const questionnaire = [];
  for (const area of areas) {
    const qs = questionsByArea[area] || [];
    for (const q of qs) questionnaire.push({ area, question: q });
  }

  return {
    supplier_name,
    focus_areas: areas,
    questions: questionnaire,
    scoring_hint: "Ask suppliers to respond with evidence. Map responses to 0..1 for each area to compute risk score.",
  };
}

export function esgGetDefaultWeights() {
  return DEFAULT_WEIGHTS;
}
