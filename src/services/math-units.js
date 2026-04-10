import { v4 as uuid } from "uuid";
import db from "../db.js";

// Math + Units: safe, minimal expression evaluation and unit normalization.

const ALLOWED_EXPR = /^[0-9+\-*/().\s^%eE]+$/;

const UNIT_FACTORS = {
  // length
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
  // mass
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
  // volume
  l: 1,
  ml: 0.001,
  gal: 3.785411784,
  qt: 0.946352946,
  pt: 0.473176473,
  cup: 0.2365882365,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS math_unit_jobs (
    id              TEXT PRIMARY KEY,
    agent_id         TEXT,
    input_text       TEXT NOT NULL,
    result_json      TEXT NOT NULL,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

function safeEvalExpression(expr) {
  const s = String(expr ?? "").trim();
  if (!s) throw new Error("expression is required");
  if (!ALLOWED_EXPR.test(s)) throw new Error("expression contains unsupported characters");

  // Replace '^' with '**' (JS exponentiation)
  const jsExpr = s.replace(/\^/g, "**");

  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict"; return (${jsExpr});`);
  const val = fn();
  if (typeof val !== "number" || !Number.isFinite(val)) throw new Error("expression did not evaluate to a finite number");
  return val;
}

function normalizeUnit(u) {
  return String(u ?? "").trim().toLowerCase();
}

/**
 * Convert a value between supported units.
 * @param {number} value
 * @param {string} fromUnit
 * @param {string} toUnit
 */
export function convertUnit(value, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!(from in UNIT_FACTORS)) throw new Error(`Unsupported fromUnit: ${fromUnit}`);
  if (!(to in UNIT_FACTORS)) throw new Error(`Unsupported toUnit: ${toUnit}`);

  const base = Number(value) * UNIT_FACTORS[from];
  const converted = base / UNIT_FACTORS[to];
  return Math.round(converted * 1e9) / 1e9;
}

/**
 * Evaluate a numeric expression and optionally convert units.
 * @param {{expression: string, fromUnit?: string, toUnit?: string}} input
 */
export function computeExpression(input) {
  if (!input || typeof input !== "object") throw new Error("input object required");
  const value = safeEvalExpression(input.expression);
  if (input.fromUnit && input.toUnit) {
    const converted = convertUnit(value, input.fromUnit, input.toUnit);
    return {
      value,
      fromUnit: normalizeUnit(input.fromUnit),
      toUnit: normalizeUnit(input.toUnit),
      converted,
    };
  }
  return { value };
}

/**
 * Persist a math/unit computation job.
 */
export function createMathUnitJob(agentId, input) {
  const result = computeExpression(input);
  const id = uuid();
  db.prepare(`
    INSERT INTO math_unit_jobs (id, agent_id, input_text, result_json)
    VALUES (@id, @agent_id, @input_text, @result_json)
  `).run({
    id,
    agent_id: agentId ?? null,
    input_text: JSON.stringify(input ?? {}),
    result_json: JSON.stringify(result),
  });
  return { id, ...result };
}

export function listSupportedUnits() {
  return Object.keys(UNIT_FACTORS).sort();
}
