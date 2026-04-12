/**
 * Model Evaluation Service
 *
 * Provides small utilities for evaluating and comparing model outputs.
 * This is designed for agent-side testing of prompts, tools, and regressions.
 */

function safeDiv(a, b) {
  return b === 0 ? 0 : a / b;
}

function tokenizeLoose(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(aSet, bSet) {
  const a = new Set(aSet);
  const b = new Set(bSet);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

export function compareAnswers({ reference, candidate, metric = "token_jaccard" }) {
  const ref = String(reference || "");
  const cand = String(candidate || "");

  if (metric === "exact") {
    return {
      metric,
      score: ref === cand ? 1 : 0,
      details: { exact_match: ref === cand },
    };
  }

  if (metric === "token_jaccard") {
    const refTokens = tokenizeLoose(ref.toLowerCase());
    const candTokens = tokenizeLoose(cand.toLowerCase());
    return {
      metric,
      score: jaccard(refTokens, candTokens),
      details: {
        reference_tokens: refTokens.length,
        candidate_tokens: candTokens.length,
      },
    };
  }

  if (metric === "length_ratio") {
    const r = ref.length;
    const c = cand.length;
    return {
      metric,
      score: safeDiv(Math.min(r, c), Math.max(r, c) || 1),
      details: { reference_chars: r, candidate_chars: c },
    };
  }

  return {
    metric,
    score: 0,
    details: { error: "unknown_metric" },
  };
}

export function scoreToolResponse({ response, required_fields = [] }) {
  const obj = response && typeof response === "object" ? response : {};
  const missing = [];

  for (const f of required_fields) {
    if (!(f in obj)) missing.push(f);
  }

  const completeness = required_fields.length === 0 ? 1 : 1 - safeDiv(missing.length, required_fields.length);

  return {
    completeness,
    missing_fields: missing,
    ok: missing.length === 0,
  };
}

export function buildEvalReport({ run_id, tests }) {
  const list = Array.isArray(tests) ? tests : [];
  const rows = list.map((t, idx) => ({
    id: t.id || `test_${idx + 1}`,
    name: t.name || "unnamed",
    metric: t.metric || "token_jaccard",
    score: Number(t.score ?? 0),
    passed: Boolean(t.passed ?? (Number(t.score ?? 0) >= (t.threshold ?? 0.7))),
    threshold: Number(t.threshold ?? 0.7),
    notes: t.notes || "",
  }));

  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;
  const passRate = rows.length ? rows.filter((r) => r.passed).length / rows.length : 0;

  return {
    run_id: run_id || `eval_${Date.now()}`,
    created_at: new Date().toISOString(),
    test_count: rows.length,
    average_score: avg,
    pass_rate: passRate,
    results: rows,
  };
}
