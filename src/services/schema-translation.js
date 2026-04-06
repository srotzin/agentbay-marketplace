import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ST_PLATFORM_COMMISSION    = 0.20; // 20% platform cut
const ST_PRICE_PER_TRANSLATION  = 0.02; // $0.02 per schema translation
const ST_PRICE_PER_VALIDATION   = 0.005; // $0.005 per validation call
const ST_BATCH_DISCOUNT         = 0.15; // 15% discount on batch jobs

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS st_translations (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    input_format    TEXT NOT NULL,
    output_format   TEXT NOT NULL,
    input_schema    TEXT NOT NULL,
    output_schema   TEXT,
    field_count     INTEGER DEFAULT 0,
    warnings        TEXT DEFAULT '[]',
    status          TEXT DEFAULT 'completed' CHECK(status IN ('completed','failed','partial')),
    price_usd       REAL DEFAULT 0,
    commission_usd  REAL DEFAULT 0,
    error_message   TEXT,
    duration_ms     INTEGER,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS st_validations (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    format          TEXT NOT NULL,
    schema_input    TEXT NOT NULL,
    is_valid        INTEGER NOT NULL,
    errors          TEXT DEFAULT '[]',
    warnings        TEXT DEFAULT '[]',
    field_count     INTEGER DEFAULT 0,
    price_usd       REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS st_batch_jobs (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    input_format    TEXT NOT NULL,
    output_format   TEXT NOT NULL,
    item_count      INTEGER NOT NULL,
    success_count   INTEGER DEFAULT 0,
    failure_count   INTEGER DEFAULT 0,
    total_price_usd REAL DEFAULT 0,
    commission_usd  REAL DEFAULT 0,
    status          TEXT DEFAULT 'completed',
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Format Registry ──────────────────────────────────────────────────────────

const SUPPORTED_FORMATS = {
  openai: {
    name:        "OpenAI Chat Completions",
    version:     "v1",
    description: "OpenAI-compatible request/response schema (messages[], tools[], function_call)",
    example_fields: ["messages", "model", "temperature", "tools", "tool_choice", "response_format"],
    spec_url:    "https://platform.openai.com/docs/api-reference/chat",
  },
  anthropic: {
    name:        "Anthropic Messages API",
    version:     "2023-06-01",
    description: "Anthropic Claude API schema (content blocks, tool_use, system prompt)",
    example_fields: ["model", "max_tokens", "messages", "system", "tools", "tool_choice"],
    spec_url:    "https://docs.anthropic.com/en/api/messages",
  },
  mcp: {
    name:        "Model Context Protocol",
    version:     "2024-11-05",
    description: "MCP tool/resource/prompt definitions for LLM-context injection",
    example_fields: ["tools", "resources", "prompts", "sampling", "roots"],
    spec_url:    "https://modelcontextprotocol.io/specification",
  },
  rest: {
    name:        "REST/JSON API",
    version:     "openapi-3.1",
    description: "Generic REST endpoint schema with OpenAPI 3.1 path/operation definitions",
    example_fields: ["paths", "components", "schemas", "parameters", "requestBody", "responses"],
    spec_url:    "https://spec.openapis.org/oas/v3.1.0",
  },
  graphql: {
    name:        "GraphQL Schema",
    version:     "june-2018",
    description: "GraphQL type definitions, queries, mutations, and subscriptions",
    example_fields: ["types", "queries", "mutations", "subscriptions", "scalars", "directives"],
    spec_url:    "https://spec.graphql.org",
  },
  jsonschema: {
    name:        "JSON Schema",
    version:     "draft-2020-12",
    description: "Standard JSON Schema for data validation and object shape definitions",
    example_fields: ["type", "properties", "required", "additionalProperties", "definitions", "$ref"],
    spec_url:    "https://json-schema.org/specification",
  },
  grpc: {
    name:        "gRPC / Protocol Buffers",
    version:     "proto3",
    description: "gRPC service and message definitions in protobuf3 syntax",
    example_fields: ["service", "rpc", "message", "enum", "import", "package"],
    spec_url:    "https://protobuf.dev/programming-guides/proto3",
  },
  langchain: {
    name:        "LangChain Tool Schema",
    version:     "0.3",
    description: "LangChain-compatible structured tool definitions with Zod/Pydantic schemas",
    example_fields: ["name", "description", "schema", "func", "return_direct", "args_schema"],
    spec_url:    "https://js.langchain.com/docs/concepts/tools",
  },
};

// ─── Translation Logic ────────────────────────────────────────────────────────

function performTranslation(inputSchema, inputFormat, outputFormat) {
  // Parse input
  let parsed;
  try {
    parsed = typeof inputSchema === "string" ? JSON.parse(inputSchema) : inputSchema;
  } catch {
    throw new Error("inputSchema is not valid JSON");
  }

  const warnings = [];
  const startMs  = Date.now();

  // Normalise to intermediate representation
  const intermediate = normaliseToIntermediate(parsed, inputFormat, warnings);

  // Map to target format
  const output = mapFromIntermediate(intermediate, outputFormat, warnings);

  return {
    output,
    warnings,
    field_count: countFields(output),
    duration_ms: Date.now() - startMs,
  };
}

function normaliseToIntermediate(schema, format, warnings) {
  // Produce a canonical shape: { name, description, parameters: [...], returns: {...} }
  switch (format) {
    case "openai": {
      const tool = Array.isArray(schema.tools) ? schema.tools[0] : schema;
      const fn   = tool?.function ?? tool;
      return {
        name:        fn?.name ?? "unnamed_function",
        description: fn?.description ?? "",
        parameters:  extractJsonSchemaFields(fn?.parameters),
        returns:     { type: "object" },
        raw:         schema,
      };
    }
    case "anthropic": {
      const tool = Array.isArray(schema.tools) ? schema.tools[0] : schema;
      return {
        name:        tool?.name ?? "unnamed_tool",
        description: tool?.description ?? "",
        parameters:  extractJsonSchemaFields(tool?.input_schema),
        returns:     { type: "object" },
        raw:         schema,
      };
    }
    case "mcp": {
      const tool = Array.isArray(schema.tools) ? schema.tools[0] : schema;
      return {
        name:        tool?.name ?? "unnamed_tool",
        description: tool?.description ?? "",
        parameters:  extractJsonSchemaFields(tool?.inputSchema),
        returns:     { type: "object" },
        raw:         schema,
      };
    }
    case "graphql": {
      warnings.push("GraphQL to intermediate: mutation/query distinction flattened to function definition.");
      const typeDef = schema.type ?? schema;
      return {
        name:        typeDef.name ?? "GraphQLOperation",
        description: typeDef.description ?? "",
        parameters:  (typeDef.args ?? []).map(a => ({ name: a.name, type: a.type ?? "String", description: a.description ?? "", required: !a.defaultValue })),
        returns:     { type: typeDef.returnType ?? "String" },
        raw:         schema,
      };
    }
    default: {
      // Generic: treat root object as parameter bag
      warnings.push(`Input format "${format}" — using generic field extraction.`);
      return {
        name:        schema.name ?? schema.operationId ?? "operation",
        description: schema.description ?? schema.summary ?? "",
        parameters:  extractJsonSchemaFields(schema.parameters ?? schema.properties ? { type: "object", properties: schema.properties ?? {} } : schema),
        returns:     { type: "object" },
        raw:         schema,
      };
    }
  }
}

function mapFromIntermediate(inter, outputFormat, warnings) {
  const { name, description, parameters, returns } = inter;

  switch (outputFormat) {
    case "openai":
      return {
        type: "function",
        function: {
          name,
          description,
          parameters: {
            type: "object",
            properties: Object.fromEntries(parameters.map(p => [p.name, { type: p.type ?? "string", description: p.description ?? "" }])),
            required: parameters.filter(p => p.required).map(p => p.name),
          },
        },
      };

    case "anthropic":
      return {
        name,
        description,
        input_schema: {
          type: "object",
          properties: Object.fromEntries(parameters.map(p => [p.name, { type: (p.type ?? "string").toLowerCase(), description: p.description ?? "" }])),
          required: parameters.filter(p => p.required).map(p => p.name),
        },
      };

    case "mcp":
      return {
        name,
        description,
        inputSchema: {
          type: "object",
          properties: Object.fromEntries(parameters.map(p => [p.name, { type: (p.type ?? "string").toLowerCase(), description: p.description ?? "" }])),
          required: parameters.filter(p => p.required).map(p => p.name),
        },
      };

    case "graphql": {
      warnings.push("Mapped to GraphQL query definition. Review scalar types manually.");
      const args = parameters.map(p => `  ${p.name}: ${graphqlType(p.type)}${p.required ? "!" : ""}`).join("\n");
      return {
        graphql_schema: `type Query {\n  ${name}(${args ? `\n${args}\n` : ""}): ${graphqlType(returns.type)}\n}`,
        description,
        operation_type: "query",
      };
    }

    case "rest":
      return {
        openapi: "3.1.0",
        info: { title: name, description, version: "1.0.0" },
        paths: {
          [`/${name.replace(/_/g, "-")}`]: {
            post: {
              operationId: name,
              summary: description,
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: Object.fromEntries(parameters.map(p => [p.name, { type: p.type ?? "string", description: p.description ?? "" }])),
                      required: parameters.filter(p => p.required).map(p => p.name),
                    },
                  },
                },
              },
              responses: { "200": { description: "Success", content: { "application/json": { schema: { type: "object" } } } } },
            },
          },
        },
      };

    case "jsonschema":
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: name,
        description,
        type: "object",
        properties: Object.fromEntries(parameters.map(p => [p.name, { type: (p.type ?? "string").toLowerCase(), description: p.description ?? "" }])),
        required: parameters.filter(p => p.required).map(p => p.name),
      };

    case "grpc": {
      warnings.push("gRPC mapping is approximate — review message field numbering and types manually.");
      const fields = parameters.map((p, i) => `  ${protoType(p.type)} ${p.name} = ${i + 1};`).join("\n");
      return {
        proto: `syntax = "proto3";\n\nservice ${toPascal(name)}Service {\n  rpc ${toPascal(name)} (${toPascal(name)}Request) returns (${toPascal(name)}Response);\n}\n\nmessage ${toPascal(name)}Request {\n${fields}\n}\n\nmessage ${toPascal(name)}Response {\n  string result = 1;\n}`,
        description,
      };
    }

    case "langchain":
      return {
        name,
        description,
        args_schema: {
          type: "object",
          properties: Object.fromEntries(parameters.map(p => [p.name, { type: (p.type ?? "string").toLowerCase(), description: p.description ?? "" }])),
          required: parameters.filter(p => p.required).map(p => p.name),
        },
        return_direct: false,
        func: `async (args) => { /* implement ${name} */ }`,
      };

    default:
      warnings.push(`Unknown output format "${outputFormat}" — returning intermediate representation.`);
      return { name, description, parameters, returns };
  }
}

function extractJsonSchemaFields(schema) {
  if (!schema || !schema.properties) return [];
  const required = schema.required ?? [];
  return Object.entries(schema.properties).map(([name, def]) => ({
    name,
    type:        def.type ?? "string",
    description: def.description ?? "",
    required:    required.includes(name),
  }));
}

function countFields(obj) {
  if (typeof obj !== "object" || obj === null) return 0;
  const str = JSON.stringify(obj);
  return (str.match(/:/g) ?? []).length;
}

function graphqlType(t) {
  const map = { string: "String", number: "Float", integer: "Int", boolean: "Boolean", object: "JSON", array: "[JSON]" };
  return map[(t ?? "").toLowerCase()] ?? "String";
}

function protoType(t) {
  const map = { string: "string", number: "double", integer: "int32", boolean: "bool", object: "bytes", array: "bytes" };
  return map[(t ?? "").toLowerCase()] ?? "string";
}

function toPascal(s) {
  return s.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
}

// ─── Translate Schema ─────────────────────────────────────────────────────────

/**
 * Translate a schema between supported formats.
 * @param {object|string} input       - Schema to translate (object or JSON string)
 * @param {string}        inputFormat - Source format key (openai|anthropic|mcp|rest|graphql|jsonschema|grpc|langchain)
 * @param {string}        outputFormat - Target format key
 * @returns Translated schema with warnings and cost
 */
export function translateSchema(input, inputFormat, outputFormat) {
  if (!input)        throw new Error("input schema is required");
  if (!inputFormat)  throw new Error("inputFormat is required");
  if (!outputFormat) throw new Error("outputFormat is required");
  if (!SUPPORTED_FORMATS[inputFormat])  throw new Error(`Unsupported inputFormat: "${inputFormat}". Call listSupportedFormats() for options.`);
  if (!SUPPORTED_FORMATS[outputFormat]) throw new Error(`Unsupported outputFormat: "${outputFormat}". Call listSupportedFormats() for options.`);
  if (inputFormat === outputFormat)     throw new Error("inputFormat and outputFormat must be different.");

  const agentId    = `agent_${uuid().slice(0, 8)}`;
  const id         = uuid();
  const price      = ST_PRICE_PER_TRANSLATION;
  const commission = Math.round(price * ST_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();

  let result, status, errorMessage;
  try {
    result = performTranslation(input, inputFormat, outputFormat);
    status = result.warnings.length > 0 ? "partial" : "completed";
  } catch (e) {
    status       = "failed";
    errorMessage = e.message;
    result       = { output: null, warnings: [], field_count: 0, duration_ms: 0 };
  }

  db.prepare(`
    INSERT OR IGNORE INTO st_translations
      (id, agent_id, input_format, output_format, input_schema, output_schema,
       field_count, warnings, status, price_usd, commission_usd, error_message, duration_ms, created_at)
    VALUES
      (@id, @agent_id, @input_format, @output_format, @input_schema, @output_schema,
       @field_count, @warnings, @status, @price_usd, @commission_usd, @error_message, @duration_ms, @created_at)
  `).run({
    id,
    agent_id:      agentId,
    input_format:  inputFormat,
    output_format: outputFormat,
    input_schema:  typeof input === "string" ? input : JSON.stringify(input),
    output_schema: result.output ? JSON.stringify(result.output) : null,
    field_count:   result.field_count,
    warnings:      JSON.stringify(result.warnings),
    status,
    price_usd:     price,
    commission_usd: commission,
    error_message: errorMessage ?? null,
    duration_ms:   result.duration_ms,
    created_at:    now,
  });

  if (status === "failed") throw new Error(`Translation failed: ${errorMessage}`);

  return {
    translation_id:    id,
    agent_id:          agentId,
    input_format:      inputFormat,
    output_format:     outputFormat,
    translated_schema: result.output,
    warnings:          result.warnings,
    field_count:       result.field_count,
    status,
    price_usd:         price,
    platform_commission_usd: commission,
    duration_ms:       result.duration_ms,
    translated_at:     now,
    from_format:       SUPPORTED_FORMATS[inputFormat].name,
    to_format:         SUPPORTED_FORMATS[outputFormat].name,
  };
}

// ─── List Supported Formats ───────────────────────────────────────────────────

/**
 * List all supported schema formats with descriptions and compatibility matrix.
 * @returns All supported formats and pricing info
 */
export function listSupportedFormats() {
  const keys = Object.keys(SUPPORTED_FORMATS);

  return {
    formats: Object.entries(SUPPORTED_FORMATS).map(([key, f]) => ({
      format_key:     key,
      name:           f.name,
      version:        f.version,
      description:    f.description,
      example_fields: f.example_fields,
      spec_url:       f.spec_url,
      compatible_with: keys.filter(k => k !== key),
    })),
    total_formats:              keys.length,
    total_translation_pairs:    keys.length * (keys.length - 1),
    price_per_translation_usd:  ST_PRICE_PER_TRANSLATION,
    price_per_validation_usd:   ST_PRICE_PER_VALIDATION,
    batch_discount_pct:         ST_BATCH_DISCOUNT * 100,
    platform_commission_rate:   ST_PLATFORM_COMMISSION,
  };
}

// ─── Validate Schema ──────────────────────────────────────────────────────────

/**
 * Validate a schema against its format specification.
 * @param {object|string} schema - Schema to validate
 * @param {string}        format - Format key to validate against
 * @returns Validation result with error details
 */
export function validateSchema(schema, format) {
  if (!schema) throw new Error("schema is required");
  if (!format) throw new Error("format is required");
  if (!SUPPORTED_FORMATS[format]) throw new Error(`Unsupported format: "${format}". Call listSupportedFormats() for options.`);

  const agentId = `agent_${uuid().slice(0, 8)}`;
  const id      = uuid();
  const now     = new Date().toISOString();

  let parsed;
  try {
    parsed = typeof schema === "string" ? JSON.parse(schema) : schema;
  } catch {
    const row = { id, agent_id: agentId, format, schema_input: String(schema), is_valid: 0, errors: JSON.stringify(["Schema is not valid JSON"]), warnings: "[]", field_count: 0, price_usd: ST_PRICE_PER_VALIDATION, created_at: now };
    db.prepare(`INSERT OR IGNORE INTO st_validations (id,agent_id,format,schema_input,is_valid,errors,warnings,field_count,price_usd,created_at) VALUES (@id,@agent_id,@format,@schema_input,@is_valid,@errors,@warnings,@field_count,@price_usd,@created_at)`).run(row);
    return { validation_id: id, format, is_valid: false, errors: ["Schema is not valid JSON"], warnings: [], field_count: 0, price_usd: ST_PRICE_PER_VALIDATION };
  }

  const errors   = [];
  const warnings = [];

  // Format-specific validation rules
  switch (format) {
    case "openai":
      if (!parsed.type && !parsed.function && !Array.isArray(parsed.tools)) errors.push("Missing 'type', 'function', or 'tools' at root level");
      if (parsed.function && !parsed.function.name) errors.push("function.name is required");
      if (parsed.function?.parameters && parsed.function.parameters.type !== "object") errors.push("function.parameters.type must be 'object'");
      break;
    case "anthropic":
      if (!parsed.name) errors.push("'name' field is required for Anthropic tool schema");
      if (!parsed.input_schema) errors.push("'input_schema' field is required");
      if (parsed.input_schema && parsed.input_schema.type !== "object") errors.push("input_schema.type must be 'object'");
      break;
    case "mcp":
      if (!parsed.name) errors.push("'name' field is required for MCP tool");
      if (!parsed.inputSchema) errors.push("'inputSchema' field is required");
      if (parsed.inputSchema && !parsed.inputSchema.type) warnings.push("inputSchema.type should be specified (recommend 'object')");
      break;
    case "rest":
      if (!parsed.paths && !parsed.openapi) errors.push("OpenAPI schema must have 'openapi' version and 'paths' fields");
      if (parsed.openapi && !parsed.openapi.startsWith("3")) warnings.push("Recommended: OpenAPI 3.x format");
      break;
    case "graphql":
      if (!parsed.graphql_schema && !parsed.type && !parsed.types) errors.push("GraphQL schema must include 'graphql_schema', 'type', or 'types'");
      if (parsed.graphql_schema && typeof parsed.graphql_schema !== "string") errors.push("graphql_schema must be a string SDL definition");
      break;
    case "jsonschema":
      if (!parsed.type && !parsed.$schema) warnings.push("JSON Schema should include '$schema' and 'type' at root");
      if (parsed.properties && !parsed.type) errors.push("'type' must be specified when 'properties' is present");
      break;
    case "grpc":
      if (!parsed.proto && !parsed.service) errors.push("gRPC schema must include 'proto' (string) or 'service' definition");
      if (parsed.proto && !parsed.proto.includes("syntax")) warnings.push("proto string should declare 'syntax = \"proto3\"'");
      break;
    case "langchain":
      if (!parsed.name) errors.push("'name' is required for LangChain tool schema");
      if (!parsed.description) errors.push("'description' is required for LangChain tool schema");
      if (!parsed.args_schema && !parsed.schema) errors.push("'args_schema' or 'schema' is required");
      break;
  }

  const isValid    = errors.length === 0;
  const fieldCount = countFields(parsed);

  db.prepare(`
    INSERT OR IGNORE INTO st_validations (id, agent_id, format, schema_input, is_valid, errors, warnings, field_count, price_usd, created_at)
    VALUES (@id, @agent_id, @format, @schema_input, @is_valid, @errors, @warnings, @field_count, @price_usd, @created_at)
  `).run({
    id, agent_id: agentId, format,
    schema_input: JSON.stringify(parsed),
    is_valid:     isValid ? 1 : 0,
    errors:       JSON.stringify(errors),
    warnings:     JSON.stringify(warnings),
    field_count:  fieldCount,
    price_usd:    ST_PRICE_PER_VALIDATION,
    created_at:   now,
  });

  return {
    validation_id: id,
    format,
    format_name:   SUPPORTED_FORMATS[format].name,
    is_valid:      isValid,
    errors,
    warnings,
    field_count:   fieldCount,
    price_usd:     ST_PRICE_PER_VALIDATION,
    platform_commission_usd: Math.round(ST_PRICE_PER_VALIDATION * ST_PLATFORM_COMMISSION * 100) / 100,
    validated_at:  now,
  };
}

// ─── Batch Translate ──────────────────────────────────────────────────────────

/**
 * Translate multiple schemas in a single batch job (15% discount applied).
 * @param {Array}  inputs       - Array of schemas to translate
 * @param {string} inputFormat  - Source format
 * @param {string} outputFormat - Target format
 * @returns Batch result with all translations and aggregate pricing
 */
export function batchTranslate(inputs, inputFormat, outputFormat) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error("inputs must be a non-empty array");
  if (inputs.length > 100) throw new Error("Batch size limit is 100 schemas per job");
  if (!inputFormat)  throw new Error("inputFormat is required");
  if (!outputFormat) throw new Error("outputFormat is required");
  if (!SUPPORTED_FORMATS[inputFormat])  throw new Error(`Unsupported inputFormat: "${inputFormat}"`);
  if (!SUPPORTED_FORMATS[outputFormat]) throw new Error(`Unsupported outputFormat: "${outputFormat}"`);
  if (inputFormat === outputFormat) throw new Error("inputFormat and outputFormat must be different");

  const agentId   = `agent_${uuid().slice(0, 8)}`;
  const batchId   = uuid();
  const now       = new Date().toISOString();
  const unitPrice = ST_PRICE_PER_TRANSLATION * (1 - ST_BATCH_DISCOUNT);
  const results   = [];
  let successCount = 0;
  let failureCount = 0;

  for (const input of inputs) {
    try {
      const { output, warnings, field_count, duration_ms } = performTranslation(input, inputFormat, outputFormat);
      results.push({ success: true, translated_schema: output, warnings, field_count, duration_ms });
      successCount++;
    } catch (e) {
      results.push({ success: false, error: e.message, translated_schema: null });
      failureCount++;
    }
  }

  const totalPrice = Math.round(inputs.length * unitPrice * 100) / 100;
  const commission = Math.round(totalPrice * ST_PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO st_batch_jobs
      (id, agent_id, input_format, output_format, item_count, success_count, failure_count, total_price_usd, commission_usd, status, created_at)
    VALUES
      (@id, @agent_id, @input_format, @output_format, @item_count, @success_count, @failure_count, @total_price_usd, @commission_usd, @status, @created_at)
  `).run({
    id: batchId, agent_id: agentId,
    input_format: inputFormat, output_format: outputFormat,
    item_count: inputs.length, success_count: successCount, failure_count: failureCount,
    total_price_usd: totalPrice, commission_usd: commission,
    status: failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    created_at: now,
  });

  return {
    batch_id:            batchId,
    agent_id:            agentId,
    input_format:        inputFormat,
    output_format:       outputFormat,
    item_count:          inputs.length,
    success_count:       successCount,
    failure_count:       failureCount,
    results,
    unit_price_usd:      Math.round(unitPrice * 1000) / 1000,
    batch_discount_pct:  ST_BATCH_DISCOUNT * 100,
    total_price_usd:     totalPrice,
    platform_commission_usd: commission,
    status:              failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    completed_at:        now,
  };
}
