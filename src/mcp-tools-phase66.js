/**
 * HiveAgent MCP Tools — Phase 66
 *
 * New verticals:
 * - Litigation Support (matters, evidence, tasks, privilege logs)
 * - Food Safety (HACCP-lite: suppliers, products, lots, CCP checks, recall simulation)
 */

import * as litigation from "./services/litigation-support.js";
import * as foodSafety from "./services/food-safety.js";

export const phase66Tools = [
  // ────────────────────────────────────────────────────────────────────────────
  // Litigation Support
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "litigation_matter_create",
    description: "Create a litigation matter record (case) with basic metadata: client, jurisdiction, court, case number, stage, notes, tags. NOT legal advice. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Matter title (e.g., 'Acme v. Beta — contract dispute')" },
        client: { type: "string", description: "Client name" },
        jurisdiction: { type: "string", description: "Jurisdiction (e.g., 'CA', 'DE', 'SDNY')" },
        court: { type: "string", description: "Court name" },
        case_number: { type: "string", description: "Case number / docket" },
        counsel: { type: "string", description: "Lead counsel / firm" },
        opposing_party: { type: "string", description: "Opposing party" },
        stage: { type: "string", description: "Stage (e.g., pre-filing, pleadings, discovery, trial, appeal)" },
        notes: { type: "string", description: "Free-form notes" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for filtering" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "litigation_matter_list",
    description: "List litigation matters; filter by query string and/or stage. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search across title/client/court/etc." },
        stage: { type: "string", description: "Filter by stage" },
        limit: { type: "integer", description: "Max results (default 50)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "litigation_evidence_add",
    description: "Add an evidence item to a matter (source, custodian, collected_at, file hash, URI, confidentiality, tags). FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Matter ID" },
        title: { type: "string", description: "Evidence title" },
        source: { type: "string", description: "Where it came from (e.g., email export, laptop image, vendor portal)" },
        collected_at: { type: "string", description: "ISO timestamp when collected (default now)" },
        custodian: { type: "string", description: "Custodian (person/system)" },
        file_hash: { type: "string", description: "Optional file hash (sha256, md5, etc.)" },
        uri: { type: "string", description: "Optional URI/path" },
        description: { type: "string", description: "Description/notes" },
        confidentiality: { type: "string", description: "confidentiality label", enum: ["public", "internal", "confidential", "highly_confidential"] },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["matter_id", "title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "litigation_evidence_list",
    description: "List evidence items for a matter; filter by search query and confidentiality. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Filter by matter ID" },
        q: { type: "string", description: "Search title/source/custodian/hash/uri/description" },
        confidentiality: { type: "string", description: "Filter by confidentiality", enum: ["public", "internal", "confidential", "highly_confidential"] },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "litigation_task_create",
    description: "Create a litigation task (e.g., deposition prep, discovery request, motion draft), linked to a matter. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Matter ID" },
        title: { type: "string", description: "Task title" },
        type: { type: "string", description: "Task type", enum: ["general", "deposition", "discovery", "motion", "hearing", "trial", "expert"] },
        owner: { type: "string", description: "Owner/assignee" },
        due_at: { type: "string", description: "Due date/time (ISO)" },
        status: { type: "string", description: "Task status", enum: ["open", "in_progress", "blocked", "done"] },
        priority: { type: "string", description: "Priority", enum: ["P1", "P2", "P3", "P4"] },
        related_evidence_id: { type: "string", description: "Optional evidence ID" },
        notes: { type: "string", description: "Notes" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
      },
      required: ["matter_id", "title"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "litigation_task_list",
    description: "List litigation tasks; filter by matter, status, owner, and type. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Filter by matter ID" },
        status: { type: "string", description: "Filter by status", enum: ["open", "in_progress", "blocked", "done"] },
        owner: { type: "string", description: "Filter by owner" },
        type: { type: "string", description: "Filter by type", enum: ["general", "deposition", "discovery", "motion", "hearing", "trial", "expert"] },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "litigation_task_update",
    description: "Update a litigation task: status, owner, due_at, notes. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID" },
        status: { type: "string", description: "New status", enum: ["open", "in_progress", "blocked", "done"] },
        owner: { type: "string", description: "New owner" },
        due_at: { type: "string", description: "New due date/time (ISO)" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["task_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "litigation_privilege_log_add",
    description: "Add a privilege log entry for a matter (doc_id, author, recipients, privilege basis, Bates range, description). FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Matter ID" },
        doc_id: { type: "string", description: "Document ID for privilege log" },
        date: { type: "string", description: "Document date (ISO or text)" },
        author: { type: "string", description: "Author" },
        recipients: { type: "array", items: { type: "string" }, description: "Recipients" },
        privilege_basis: { type: "string", description: "Privilege basis", enum: ["attorney-client", "work-product", "joint-defense", "common-interest", "other"] },
        description: { type: "string", description: "Description (not revealing privileged substance)" },
        bates_start: { type: "string", description: "Bates start" },
        bates_end: { type: "string", description: "Bates end" },
        notes: { type: "string", description: "Notes" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["matter_id", "doc_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "litigation_privilege_log_list",
    description: "List privilege log entries for a matter. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        matter_id: { type: "string", description: "Matter ID" },
        limit: { type: "integer", description: "Max results (default 200)" },
      },
      required: ["matter_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Food Safety (HACCP-lite)
  // ────────────────────────────────────────────────────────────────────────────
  {
    name: "food_supplier_upsert",
    description: "Create or update a food supplier record with certifications and risk level. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        supplier_id: { type: "string", description: "Optional supplier ID (for update)" },
        name: { type: "string", description: "Supplier name" },
        country: { type: "string", description: "Country" },
        contact: { type: "string", description: "Contact info" },
        certifications: { type: "array", items: { type: "string" }, description: "Certifications (e.g., GFSI, BRCGS, SQF, ISO 22000)" },
        risk_level: { type: "string", description: "Risk level", enum: ["low", "medium", "high"] },
        notes: { type: "string", description: "Notes" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "food_supplier_list",
    description: "List suppliers; filter by search query or risk_level. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search" },
        risk_level: { type: "string", description: "Risk level filter", enum: ["low", "medium", "high"] },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "food_product_upsert",
    description: "Create or update a food product record (allergens, shelf life, storage). FREE.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Optional product ID (for update)" },
        name: { type: "string", description: "Product name" },
        category: { type: "string", description: "Category" },
        allergens: { type: "array", items: { type: "string" }, description: "Allergen list" },
        shelf_life_days: { type: "number", description: "Shelf life days" },
        storage: { type: "string", description: "Storage type", enum: ["ambient", "chilled", "frozen"] },
        spec: { type: "string", description: "Specification notes" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "food_product_list",
    description: "List products; filter by query, category, storage. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search" },
        category: { type: "string", description: "Category filter" },
        storage: { type: "string", description: "Storage filter", enum: ["ambient", "chilled", "frozen"] },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "food_lot_create",
    description: "Create a product lot/batch record for traceability. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product ID" },
        supplier_id: { type: "string", description: "Optional supplier ID" },
        lot_code: { type: "string", description: "Lot/batch code" },
        produced_at: { type: "string", description: "Production timestamp (ISO)" },
        expires_at: { type: "string", description: "Expiration timestamp (ISO)" },
        quantity: { type: "number", description: "Quantity" },
        unit: { type: "string", description: "Unit (ea, kg, lb, etc.)" },
        storage_location: { type: "string", description: "Where it is stored" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["product_id", "lot_code"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "food_lot_list",
    description: "List lots; filter by product, supplier, status, or search query. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product ID filter" },
        supplier_id: { type: "string", description: "Supplier ID filter" },
        status: { type: "string", description: "Status filter", enum: ["released", "hold", "recalled", "destroyed"] },
        q: { type: "string", description: "Search lot_code/location/status" },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "food_ccp_check_log",
    description: "Log a critical control point (CCP) check (e.g., temperature) for a lot. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        ccp: { type: "string", description: "CCP type (e.g., temperature, metal_detector, ph)" },
        measured_value: { type: "number", description: "Measured value" },
        unit: { type: "string", description: "Unit (C, F, ppm, etc.)" },
        within_limits: { type: "boolean", description: "Whether measurement is within critical limits" },
        operator: { type: "string", description: "Operator name/ID" },
        observed_at: { type: "string", description: "Timestamp (ISO)" },
        notes: { type: "string", description: "Notes" },
        metadata: { type: "object", description: "Optional extra structured data" },
      },
      required: ["lot_id", "measured_value"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "food_ccp_check_list",
    description: "List CCP checks for a lot and/or CCP type. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        ccp: { type: "string", description: "CCP filter" },
        limit: { type: "integer", description: "Max results (default 200)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "food_recall_simulate",
    description: "Simulate a product recall for a given lot (marks lot recalled, creates recall record). FREE.",
    inputSchema: {
      type: "object",
      properties: {
        lot_id: { type: "string", description: "Lot ID" },
        reason: { type: "string", description: "Reason for recall" },
        risk_level: { type: "string", description: "Risk level", enum: ["low", "medium", "high"] },
        initiated_by: { type: "string", description: "Who initiated the recall" },
      },
      required: ["lot_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "food_recall_list",
    description: "List recall events; filter by product and/or risk level. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product ID filter" },
        risk_level: { type: "string", description: "Risk filter", enum: ["low", "medium", "high"] },
        limit: { type: "integer", description: "Max results (default 100)" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export async function handlePhase66Tool(name, args) {
  switch (name) {
    // Litigation Support
    case "litigation_matter_create":
      return litigation.litigation_matter_create(args);
    case "litigation_matter_list":
      return litigation.litigation_matter_list(args);
    case "litigation_evidence_add":
      return litigation.litigation_evidence_add(args);
    case "litigation_evidence_list":
      return litigation.litigation_evidence_list(args);
    case "litigation_task_create":
      return litigation.litigation_task_create(args);
    case "litigation_task_list":
      return litigation.litigation_task_list(args);
    case "litigation_task_update":
      return litigation.litigation_task_update(args);
    case "litigation_privilege_log_add":
      return litigation.litigation_privilege_log_add(args);
    case "litigation_privilege_log_list":
      return litigation.litigation_privilege_log_list(args);

    // Food Safety
    case "food_supplier_upsert":
      return foodSafety.food_supplier_upsert(args);
    case "food_supplier_list":
      return foodSafety.food_supplier_list(args);
    case "food_product_upsert":
      return foodSafety.food_product_upsert(args);
    case "food_product_list":
      return foodSafety.food_product_list(args);
    case "food_lot_create":
      return foodSafety.food_lot_create(args);
    case "food_lot_list":
      return foodSafety.food_lot_list(args);
    case "food_ccp_check_log":
      return foodSafety.food_ccp_check_log(args);
    case "food_ccp_check_list":
      return foodSafety.food_ccp_check_list(args);
    case "food_recall_simulate":
      return foodSafety.food_recall_simulate(args);
    case "food_recall_list":
      return foodSafety.food_recall_list(args);

    default:
      throw new Error(`Phase 66 tool not found: ${name}`);
  }
}
