import { v4 as uuid } from "uuid";
import db from "../db.js";

// Translation Quality Assurance: lightweight, offline heuristics + optional glossary enforcement.

const DEFAULT_RULES = {
  maxSentenceLength: 220,
  maxTokenRepeat: 6,
  requirePunctuationMatch: true,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS translation_qa_jobs (
    id                TEXT PRIMARY KEY,
    agent_id           TEXT,
    source_lang        TEXT,
    target_lang        TEXT,
    source_text        TEXT NOT NULL,
    translated_text    TEXT NOT NULL,
    glossary_json      TEXT,
    rules_json         TEXT,
    score              REAL,
    issues_json        TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );
`);

function normalizeWhitespace(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function sentenceLengths(text) {
  const t = normalizeWhitespace(text);
  if (!t) return [];
  return t
    .split(/(?<=[.!?。！？])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.length);
}

function punctuationProfile(text) {
  const t = String(text ?? "");
  const counts = {
    period: (t.match(/[.。]/g) ?? []).length,
    comma: (t.match(/[,，]/g) ?? []).length,
    question: (t.match(/[?？]/g) ?? []).length,
    exclaim: (t.match(/[!！]/g) ?? []).length,
    colon: (t.match(/[:：]/g) ?? []).length,
    semicolon: (t.match(/[;；]/g) ?? []).length,
  };
  return counts;
}

function repeatedTokenIssues(text, maxTokenRepeat) {
  const t = normalizeWhitespace(text).toLowerCase();
  if (!t) return [];
  const tokens = t.split(/\s+/).filter(Boolean);
  const issues = [];
  let run = 1;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) run++;
    else run = 1;
    if (run >= maxTokenRepeat) {
      issues.push({
        type: "repeated_token_run",
        token: tokens[i],
        run,
        position: i,
      });
      run = 1;
    }
  }
  return issues;
}

function glossaryIssues(translatedText, glossary) {
  const t = String(translatedText ?? "");
  const issues = [];
  if (!glossary || typeof glossary !== "object") return issues;

  for (const [sourceTerm, targetTerm] of Object.entries(glossary)) {
    if (!sourceTerm || !targetTerm) continue;
    const hasSource = new RegExp(`\\b${escapeRegExp(sourceTerm)}\\b`, "i").test(t);
    const hasTarget = new RegExp(`\\b${escapeRegExp(targetTerm)}\\b`, "i").test(t);

    // The translated text should generally contain the target term, not the source term.
    if (hasSource && !hasTarget) {
      issues.push({
        type: "glossary_term_not_applied",
        source_term: sourceTerm,
        expected_target: targetTerm,
      });
    }
  }
  return issues;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function scoreFromIssues(issues) {
  // Simple diminishing score: start at 1.0, subtract weighted penalties.
  const weights = {
    empty_text: 0.8,
    very_long_sentence: 0.1,
    repeated_token_run: 0.1,
    punctuation_mismatch: 0.05,
    glossary_term_not_applied: 0.15,
  };
  let score = 1.0;
  for (const i of issues) score -= weights[i.type] ?? 0.05;
  return Math.round(clamp01(score) * 100) / 100;
}

/**
 * Runs a lightweight translation QA pass.
 * @param {string} sourceText
 * @param {string} translatedText
 * @param {{sourceLang?: string, targetLang?: string, glossary?: Record<string,string>, rules?: {maxSentenceLength?: number, maxTokenRepeat?: number, requirePunctuationMatch?: boolean}}} opts
 * @returns {{score:number, issues:Array, meta:Object}}
 */
export function runTranslationQa(sourceText, translatedText, opts = {}) {
  const rules = { ...DEFAULT_RULES, ...(opts.rules ?? {}) };

  const issues = [];
  const src = normalizeWhitespace(sourceText);
  const trg = normalizeWhitespace(translatedText);

  if (!src || !trg) {
    issues.push({ type: "empty_text", detail: "source_text or translated_text is empty" });
    return {
      score: scoreFromIssues(issues),
      issues,
      meta: { rules, sourceLang: opts.sourceLang, targetLang: opts.targetLang },
    };
  }

  const trgSentenceLens = sentenceLengths(trg);
  for (const len of trgSentenceLens) {
    if (len > rules.maxSentenceLength) {
      issues.push({ type: "very_long_sentence", length: len, max: rules.maxSentenceLength });
    }
  }

  issues.push(...repeatedTokenIssues(trg, rules.maxTokenRepeat));

  if (rules.requirePunctuationMatch) {
    const s = punctuationProfile(src);
    const t = punctuationProfile(trg);
    // Heuristic: allow small deviations, but flag large mismatches.
    const keys = Object.keys(s);
    for (const k of keys) {
      if (Math.abs((s[k] ?? 0) - (t[k] ?? 0)) >= 4) {
        issues.push({ type: "punctuation_mismatch", mark: k, source: s[k] ?? 0, target: t[k] ?? 0 });
      }
    }
  }

  issues.push(...glossaryIssues(trg, opts.glossary));

  return {
    score: scoreFromIssues(issues),
    issues,
    meta: {
      rules,
      sourceLang: opts.sourceLang,
      targetLang: opts.targetLang,
      sourceChars: src.length,
      translatedChars: trg.length,
    },
  };
}

/**
 * Persist a QA job for auditability.
 * @param {string} agentId
 * @param {string} sourceText
 * @param {string} translatedText
 * @param {{sourceLang?: string, targetLang?: string, glossary?: Record<string,string>, rules?: Object}} opts
 */
export function createTranslationQaJob(agentId, sourceText, translatedText, opts = {}) {
  const result = runTranslationQa(sourceText, translatedText, opts);
  const id = uuid();

  db.prepare(`
    INSERT INTO translation_qa_jobs (
      id, agent_id, source_lang, target_lang,
      source_text, translated_text,
      glossary_json, rules_json,
      score, issues_json
    ) VALUES (
      @id, @agent_id, @source_lang, @target_lang,
      @source_text, @translated_text,
      @glossary_json, @rules_json,
      @score, @issues_json
    )
  `).run({
    id,
    agent_id: agentId ?? null,
    source_lang: opts.sourceLang ?? null,
    target_lang: opts.targetLang ?? null,
    source_text: String(sourceText ?? ""),
    translated_text: String(translatedText ?? ""),
    glossary_json: JSON.stringify(opts.glossary ?? null),
    rules_json: JSON.stringify(opts.rules ?? null),
    score: result.score,
    issues_json: JSON.stringify(result.issues ?? []),
  });

  return { id, ...result };
}
