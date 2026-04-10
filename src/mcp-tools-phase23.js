// Phase 23: Translation QA + Math/Units utilities

import { runTranslationQa, createTranslationQaJob } from "./services/translation-qa.js";
import { computeExpression, convertUnit, createMathUnitJob, listSupportedUnits } from "./services/math-units.js";

export const phase23Tools = [
  {
    name: "translation_qa_run",
    description: "Run lightweight translation quality checks (punctuation, long sentences, repeated tokens, optional glossary enforcement).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sourceText: { type: "string", description: "Original text" },
        translatedText: { type: "string", description: "Translated text to validate" },
        sourceLang: { type: "string", description: "Optional BCP-47 language tag for source text" },
        targetLang: { type: "string", description: "Optional BCP-47 language tag for translated text" },
        glossary: {
          type: "object",
          description: "Optional glossary mapping source_term -> expected_target_term",
          additionalProperties: { type: "string" },
        },
        rules: {
          type: "object",
          description: "Optional rule overrides",
          additionalProperties: false,
          properties: {
            maxSentenceLength: { type: "number", minimum: 40, maximum: 1000 },
            maxTokenRepeat: { type: "number", minimum: 2, maximum: 20 },
            requirePunctuationMatch: { type: "boolean" },
          },
        },
      },
      required: ["sourceText", "translatedText"],
    },
    handler: async (args) => {
      return runTranslationQa(args.sourceText, args.translatedText, {
        sourceLang: args.sourceLang,
        targetLang: args.targetLang,
        glossary: args.glossary,
        rules: args.rules,
      });
    },
  },
  {
    name: "translation_qa_create_job",
    description: "Run translation QA and persist the result for auditability (returns job id + score + issues).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        agentId: { type: "string" },
        sourceText: { type: "string" },
        translatedText: { type: "string" },
        sourceLang: { type: "string" },
        targetLang: { type: "string" },
        glossary: { type: "object", additionalProperties: { type: "string" } },
        rules: { type: "object" },
      },
      required: ["agentId", "sourceText", "translatedText"],
    },
    handler: async (args) => {
      return createTranslationQaJob(args.agentId, args.sourceText, args.translatedText, {
        sourceLang: args.sourceLang,
        targetLang: args.targetLang,
        glossary: args.glossary,
        rules: args.rules,
      });
    },
  },
  {
    name: "math_compute_expression",
    description: "Evaluate a numeric expression (supports +, -, *, /, parentheses, and ^ exponent). Optionally convert units.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        expression: { type: "string", description: "Example: (3+5)^2 / 4" },
        fromUnit: { type: "string", description: "Optional unit of the computed value" },
        toUnit: { type: "string", description: "Optional target unit" },
      },
      required: ["expression"],
    },
    handler: async (args) => {
      return computeExpression(args);
    },
  },
  {
    name: "math_convert_unit",
    description: "Convert between supported units (length, mass, volume).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "number" },
        fromUnit: { type: "string" },
        toUnit: { type: "string" },
      },
      required: ["value", "fromUnit", "toUnit"],
    },
    handler: async (args) => {
      return { value: args.value, fromUnit: args.fromUnit, toUnit: args.toUnit, converted: convertUnit(args.value, args.fromUnit, args.toUnit) };
    },
  },
  {
    name: "math_supported_units",
    description: "List supported unit abbreviations for conversions.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    handler: async () => {
      return { units: listSupportedUnits() };
    },
  },
  {
    name: "math_create_job",
    description: "Evaluate an expression / unit conversion and persist result (returns job id + output).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        agentId: { type: "string" },
        input: {
          type: "object",
          additionalProperties: false,
          properties: {
            expression: { type: "string" },
            fromUnit: { type: "string" },
            toUnit: { type: "string" },
          },
          required: ["expression"],
        },
      },
      required: ["agentId", "input"],
    },
    handler: async (args) => {
      return createMathUnitJob(args.agentId, args.input);
    },
  },
];
