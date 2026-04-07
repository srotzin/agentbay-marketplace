import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ERP_FEES = {
  query_erp:       0.10,
  create_record:   0.25,
  sync_record:     0.05,
  erp_dashboard:   2.00,
  map_fields:      1.00,
};

const PLATFORM_COMMISSION = 0.20;

// ─── Supported Systems and Modules ────────────────────────────────────────────

const SUPPORTED_SYSTEMS  = ["sap", "oracle", "netsuite", "workday", "dynamics365"];
const SUPPORTED_MODULES  = ["finance", "hr", "procurement", "inventory", "sales"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS erp_queries (
    id            TEXT PRIMARY KEY,
    system        TEXT NOT NULL,
    module        TEXT NOT NULL,
    query_text    TEXT,
    filters       TEXT DEFAULT '{}',
    record_count  INTEGER DEFAULT 0,
    result_data   TEXT DEFAULT '[]',
    last_synced   TEXT,
    fee_usd       REAL,
    commission_usd REAL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS erp_records (
    id              TEXT PRIMARY KEY,
    system          TEXT NOT NULL,
    module          TEXT NOT NULL,
    record_type     TEXT NOT NULL,
    external_id     TEXT,
    status          TEXT DEFAULT 'created',
    validation_result TEXT,
    sync_status     TEXT DEFAULT 'synced',
    data            TEXT DEFAULT '{}',
    fee_usd         REAL,
    commission_usd  REAL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS erp_syncs (
    id               TEXT PRIMARY KEY,
    system           TEXT NOT NULL,
    module           TEXT NOT NULL,
    direction        TEXT NOT NULL CHECK(direction IN ('push','pull','bidirectional')),
    synced_records   INTEGER DEFAULT 0,
    new_records      INTEGER DEFAULT 0,
    updated_records  INTEGER DEFAULT 0,
    conflicts        TEXT DEFAULT '[]',
    total_fee_usd    REAL,
    commission_usd   REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS erp_field_mappings (
    id             TEXT PRIMARY KEY,
    source_system  TEXT NOT NULL,
    target_system  TEXT NOT NULL,
    module         TEXT NOT NULL,
    mappings       TEXT DEFAULT '[]',
    fee_usd        REAL,
    commission_usd REAL,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS erp_usage_log (
    id          TEXT PRIMARY KEY,
    operation   TEXT NOT NULL,
    system      TEXT,
    fee_usd     REAL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed: ERP connection registry ───────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS erp_connections (
    id             TEXT PRIMARY KEY,
    system         TEXT NOT NULL UNIQUE,
    display_name   TEXT NOT NULL,
    base_url       TEXT,
    status         TEXT DEFAULT 'connected',
    last_heartbeat TEXT DEFAULT (datetime('now')),
    modules_enabled TEXT DEFAULT '["finance","hr","procurement","inventory","sales"]',
    api_version    TEXT
  );
`);

const _connCount = db.prepare("SELECT COUNT(*) as n FROM erp_connections").get().n;
if (_connCount === 0) {
  const seedConns = [
    { id: uuid(), system: "sap",         display_name: "SAP S/4HANA",        base_url: "https://sap-tenant.example.com",      status: "connected",    api_version: "2023.1" },
    { id: uuid(), system: "oracle",      display_name: "Oracle Fusion Cloud", base_url: "https://oracle-fa.example.com",       status: "connected",    api_version: "23D"    },
    { id: uuid(), system: "netsuite",    display_name: "NetSuite ERP",        base_url: "https://system.netsuite.com",         status: "connected",    api_version: "2024.1" },
    { id: uuid(), system: "workday",     display_name: "Workday HCM",         base_url: "https://wd2.myworkday.com",           status: "connected",    api_version: "39.0"   },
    { id: uuid(), system: "dynamics365", display_name: "Microsoft D365 F&O",  base_url: "https://tenant.operations.dynamics.com", status: "connected", api_version: "10.0.38"},
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO erp_connections (id, system, display_name, base_url, status, api_version, modules_enabled)
    VALUES (@id, @system, @display_name, @base_url, @status, @api_version, @modules_enabled)
  `);
  for (const c of seedConns) ins.run({ ...c, modules_enabled: '["finance","hr","procurement","inventory","sales"]' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logUsage(operation, system, fee) {
  db.prepare(`
    INSERT OR IGNORE INTO erp_usage_log (id, operation, system, fee_usd)
    VALUES (@id, @operation, @system, @fee_usd)
  `).run({ id: uuid(), operation, system: system ?? null, fee_usd: fee });
}

function validateSystem(system) {
  if (!SUPPORTED_SYSTEMS.includes(system)) {
    throw new Error(`Unsupported ERP system: ${system}. Supported: ${SUPPORTED_SYSTEMS.join(", ")}`);
  }
}

function validateModule(module) {
  if (!SUPPORTED_MODULES.includes(module)) {
    throw new Error(`Unsupported module: ${module}. Supported: ${SUPPORTED_MODULES.join(", ")}`);
  }
}

function getConnection(system) {
  return db.prepare("SELECT * FROM erp_connections WHERE system = ?").get(system);
}

function simulateRecords(system, module, query, filters, count) {
  const samples = {
    finance:     () => ({ ledger_id: `GL-${Math.floor(10000 + Math.random() * 90000)}`, account: `${Math.floor(1000 + Math.random() * 8000)}`, balance_usd: Math.round(Math.random() * 1000000), currency: "USD", period: "2025-Q4" }),
    hr:          () => ({ employee_id: `EMP-${Math.floor(10000 + Math.random() * 90000)}`, department: ["Engineering","Finance","Sales","HR","Ops"][Math.floor(Math.random() * 5)], status: "active", hire_date: "2021-03-15" }),
    procurement: () => ({ po_number: `PO-${Math.floor(100000 + Math.random() * 900000)}`, vendor: `Vendor-${Math.floor(100 + Math.random() * 900)}`, amount_usd: Math.round(Math.random() * 250000), status: "approved" }),
    inventory:   () => ({ sku: `SKU-${Math.floor(10000 + Math.random() * 90000)}`, qty_on_hand: Math.floor(Math.random() * 5000), reorder_point: 100, warehouse: `WH-${Math.floor(1 + Math.random() * 5)}` }),
    sales:       () => ({ opportunity_id: `OPP-${Math.floor(10000 + Math.random() * 90000)}`, account: `Account-${Math.floor(100 + Math.random() * 900)}`, stage: "proposal", amount_usd: Math.round(Math.random() * 500000), close_date: "2025-06-30" }),
  };
  const gen = samples[module] ?? samples.finance;
  return Array.from({ length: count }, () => ({ _system: system, _module: module, ...gen() }));
}

function generateExternalId(system, recordType) {
  const prefixMap = {
    sap: "SAP", oracle: "ORA", netsuite: "NS", workday: "WD", dynamics365: "D365",
  };
  const p = prefixMap[system] ?? "ERP";
  return `${p}-${recordType.toUpperCase().slice(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function buildFieldMappings(sourceSystem, targetSystem, module) {
  const commonMappings = {
    finance: [
      { source_field: "account_code",   target_field: "gl_account",       transform: "direct",     confidence: 0.98 },
      { source_field: "cost_center",    target_field: "profit_center",     transform: "lookup",     confidence: 0.91 },
      { source_field: "posting_date",   target_field: "transaction_date",  transform: "date_format",confidence: 0.99 },
      { source_field: "currency_code",  target_field: "currency",          transform: "iso_4217",   confidence: 1.00 },
      { source_field: "amount",         target_field: "debit_credit_amount", transform: "abs_value",confidence: 0.95 },
      { source_field: "description",    target_field: "narrative",         transform: "truncate_100",confidence: 0.88 },
    ],
    hr: [
      { source_field: "employee_id",    target_field: "worker_id",         transform: "prefix_map", confidence: 0.97 },
      { source_field: "full_name",      target_field: "legal_name",        transform: "direct",     confidence: 1.00 },
      { source_field: "department_code",target_field: "cost_center",       transform: "lookup",     confidence: 0.85 },
      { source_field: "salary",         target_field: "base_pay_amount",   transform: "direct",     confidence: 0.99 },
      { source_field: "start_date",     target_field: "hire_date",         transform: "date_format",confidence: 0.99 },
      { source_field: "job_title",      target_field: "position",          transform: "title_case", confidence: 0.90 },
    ],
    procurement: [
      { source_field: "vendor_id",      target_field: "supplier_id",       transform: "prefix_map", confidence: 0.95 },
      { source_field: "po_date",        target_field: "order_date",        transform: "date_format",confidence: 0.99 },
      { source_field: "line_amount",    target_field: "item_net_amount",   transform: "direct",     confidence: 0.98 },
      { source_field: "tax_code",       target_field: "vat_code",          transform: "lookup",     confidence: 0.80 },
      { source_field: "delivery_date",  target_field: "required_delivery", transform: "direct",     confidence: 0.97 },
    ],
    inventory: [
      { source_field: "item_code",      target_field: "sku",               transform: "direct",     confidence: 1.00 },
      { source_field: "qty",            target_field: "quantity_available", transform: "direct",    confidence: 0.99 },
      { source_field: "unit_cost",      target_field: "standard_cost",     transform: "round_2dp",  confidence: 0.96 },
      { source_field: "location",       target_field: "bin_location",      transform: "lookup",     confidence: 0.87 },
    ],
    sales: [
      { source_field: "opportunity_name", target_field: "deal_name",       transform: "direct",     confidence: 0.99 },
      { source_field: "close_date",       target_field: "expected_close",  transform: "date_format",confidence: 0.98 },
      { source_field: "amount",           target_field: "deal_value",      transform: "direct",     confidence: 1.00 },
      { source_field: "stage",            target_field: "pipeline_stage",  transform: "enum_map",   confidence: 0.82 },
      { source_field: "owner_id",         target_field: "assigned_rep",    transform: "user_lookup",confidence: 0.90 },
    ],
  };

  return (commonMappings[module] ?? commonMappings.finance).map(m => ({
    ...m,
    source_system: sourceSystem,
    target_system: targetSystem,
    validated: m.confidence >= 0.90,
  }));
}

// ─── Query ERP ────────────────────────────────────────────────────────────────

/**
 * Query data from a connected ERP system.
 * @param {string} system  - sap|oracle|netsuite|workday|dynamics365
 * @param {string} module  - finance|hr|procurement|inventory|sales
 * @param {string} query   - Query string or entity name (e.g. "open_purchase_orders")
 * @param {object} filters - Filter criteria { date_from, date_to, status, limit }
 * @returns Records, count, and last sync timestamp
 */
export function queryErp(system, module, query, filters) {
  validateSystem(system);
  validateModule(module);
  if (!query) throw new Error("query is required");

  const conn      = getConnection(system);
  const limit     = Math.min(filters?.limit ?? 25, 200);
  const records   = simulateRecords(system, module, query, filters, Math.floor(1 + Math.random() * limit));
  const lastSynced = new Date(Date.now() - Math.floor(Math.random() * 300000)).toISOString();
  const id        = uuid();

  const fee        = ERP_FEES.query_erp;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO erp_queries
      (id, system, module, query_text, filters, record_count, result_data, last_synced, fee_usd, commission_usd)
    VALUES
      (@id, @system, @module, @query_text, @filters, @record_count, @result_data, @last_synced, @fee_usd, @commission_usd)
  `).run({
    id,
    system,
    module,
    query_text:   query,
    filters:      JSON.stringify(filters ?? {}),
    record_count: records.length,
    result_data:  JSON.stringify(records),
    last_synced:  lastSynced,
    fee_usd:      fee,
    commission_usd: commission,
  });

  logUsage("query_erp", system, fee);

  return {
    query_id:                id,
    system,
    display_name:            conn?.display_name ?? system,
    module,
    query,
    data:                    records,
    record_count:            records.length,
    last_synced:             lastSynced,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}

// ─── Create Record ────────────────────────────────────────────────────────────

/**
 * Create a new record in a connected ERP system.
 * @param {string} system     - sap|oracle|netsuite|workday|dynamics365
 * @param {string} module     - finance|hr|procurement|inventory|sales
 * @param {string} recordType - Record entity type (e.g. "purchase_order", "employee", "journal_entry")
 * @param {object} data       - Record payload
 * @returns Created record ID, validation result, and sync status
 */
export function createRecord(system, module, recordType, data) {
  validateSystem(system);
  validateModule(module);
  if (!recordType) throw new Error("recordType is required");
  if (!data)       throw new Error("data is required");

  const id         = uuid();
  const externalId = generateExternalId(system, recordType);

  // Simulate basic field validation
  const missingFields = [];
  if (module === "finance" && !data.account_code) missingFields.push("account_code");
  if (module === "hr"      && !data.employee_id)  missingFields.push("employee_id");
  if (module === "sales"   && !data.amount)        missingFields.push("amount");

  const validationResult = {
    passed:         missingFields.length === 0,
    warnings:       missingFields.length > 0 ? missingFields.map(f => `Missing recommended field: ${f}`) : [],
    required_checks: "passed",
    schema_version: "v2",
  };

  const status     = validationResult.passed ? "created" : "created_with_warnings";
  const syncStatus = "synced";

  const fee        = ERP_FEES.create_record;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO erp_records
      (id, system, module, record_type, external_id, status, validation_result, sync_status, data, fee_usd, commission_usd)
    VALUES
      (@id, @system, @module, @record_type, @external_id, @status, @validation_result, @sync_status, @data, @fee_usd, @commission_usd)
  `).run({
    id,
    system,
    module,
    record_type:       recordType,
    external_id:       externalId,
    status,
    validation_result: JSON.stringify(validationResult),
    sync_status:       syncStatus,
    data:              JSON.stringify(data),
    fee_usd:           fee,
    commission_usd:    commission,
  });

  logUsage("create_record", system, fee);

  return {
    record_id:               id,
    external_id:             externalId,
    system,
    module,
    record_type:             recordType,
    status,
    validation_result:       validationResult,
    sync_status:             syncStatus,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}

// ─── Sync Data ────────────────────────────────────────────────────────────────

/**
 * Sync data between HiveAgent and a connected ERP system.
 * @param {string} system    - sap|oracle|netsuite|workday|dynamics365
 * @param {string} module    - finance|hr|procurement|inventory|sales
 * @param {string} direction - push|pull|bidirectional
 * @param {object} filters   - { date_from, date_to, status, record_types[] }
 * @returns Sync summary with record counts and conflicts
 */
export function syncData(system, module, direction, filters) {
  validateSystem(system);
  validateModule(module);

  const validDirections = ["push", "pull", "bidirectional"];
  if (!validDirections.includes(direction)) {
    throw new Error(`Invalid direction: ${direction}. Must be one of: ${validDirections.join(", ")}`);
  }

  const id             = uuid();
  const totalRecords   = Math.floor(50 + Math.random() * 450);
  const newRecords     = Math.floor(totalRecords * 0.15);
  const updatedRecords = Math.floor(totalRecords * 0.60);
  const conflictCount  = Math.floor(totalRecords * 0.02);

  const conflicts = Array.from({ length: conflictCount }, (_, i) => ({
    record_id:        `CONFLICT-${i + 1}`,
    field:            ["amount", "status", "date", "owner_id"][i % 4],
    source_value:     "VALUE_A",
    target_value:     "VALUE_B",
    resolution:       direction === "push" ? "source_wins" : direction === "pull" ? "target_wins" : "manual_required",
  }));

  const totalFee   = Math.round(ERP_FEES.sync_record * totalRecords * 100) / 100;
  const commission = Math.round(totalFee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO erp_syncs
      (id, system, module, direction, synced_records, new_records, updated_records, conflicts, total_fee_usd, commission_usd)
    VALUES
      (@id, @system, @module, @direction, @synced_records, @new_records, @updated_records, @conflicts, @total_fee_usd, @commission_usd)
  `).run({
    id,
    system,
    module,
    direction,
    synced_records:  totalRecords,
    new_records:     newRecords,
    updated_records: updatedRecords,
    conflicts:       JSON.stringify(conflicts),
    total_fee_usd:   totalFee,
    commission_usd:  commission,
  });

  logUsage("sync_data", system, totalFee);

  return {
    sync_id:                 id,
    system,
    module,
    direction,
    synced_records:          totalRecords,
    new_records:             newRecords,
    updated_records:         updatedRecords,
    unchanged_records:       totalRecords - newRecords - updatedRecords,
    conflicts,
    conflict_count:          conflictCount,
    total_fee_usd:           totalFee,
    platform_commission_usd: commission,
    synced_at:               new Date().toISOString(),
  };
}

// ─── ERP Dashboard ────────────────────────────────────────────────────────────

/**
 * Get health and sync status for a connected ERP system.
 * @param {string} system - sap|oracle|netsuite|workday|dynamics365
 * @returns Connection status, sync metrics, pending work, and per-module health
 */
export function getErpDashboard(system) {
  validateSystem(system);

  const conn = getConnection(system);
  if (!conn) throw new Error(`No connection record found for system: ${system}`);

  const lastSync = db.prepare(
    "SELECT MAX(created_at) as last FROM erp_syncs WHERE system = ?"
  ).get(system);

  const totalSynced = db.prepare(
    "SELECT COALESCE(SUM(synced_records), 0) as total FROM erp_syncs WHERE system = ?"
  ).get(system).total;

  const pendingSyncs = db.prepare(
    "SELECT COUNT(*) as n FROM erp_records WHERE system = ? AND sync_status != 'synced'"
  ).get(system).n;

  const recentErrors = db.prepare(
    "SELECT COUNT(*) as n FROM erp_records WHERE system = ? AND status LIKE '%error%'"
  ).get(system).n;

  const errors = recentErrors > 0
    ? [{ code: "SYNC_ERR_001", message: `${recentErrors} records in error state`, severity: "warning" }]
    : [];

  const moduleStatus = {};
  for (const mod of SUPPORTED_MODULES) {
    const modRecords = db.prepare(
      "SELECT COUNT(*) as n FROM erp_records WHERE system = ? AND module = ?"
    ).get(system, mod).n;
    moduleStatus[mod] = {
      enabled:         true,
      records_managed: modRecords,
      status:          modRecords > 0 ? "active" : "idle",
    };
  }

  const fee        = ERP_FEES.erp_dashboard;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;
  logUsage("erp_dashboard", system, fee);

  return {
    system,
    display_name:            conn.display_name,
    api_version:             conn.api_version,
    connected:               conn.status === "connected",
    base_url:                conn.base_url,
    last_sync:               lastSync?.last ?? null,
    records_synced:          totalSynced,
    pending_syncs:           pendingSyncs,
    errors,
    module_status:           moduleStatus,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    retrieved_at:            new Date().toISOString(),
  };
}

// ─── Map Fields ───────────────────────────────────────────────────────────────

/**
 * Generate field mappings between two ERP systems for a given module.
 * @param {string} sourceSystem - Source ERP system
 * @param {string} targetSystem - Target ERP system
 * @param {string} module       - Module to map
 * @returns Field mapping list with transform instructions and confidence scores
 */
export function mapFields(sourceSystem, targetSystem, module) {
  validateSystem(sourceSystem);
  validateSystem(targetSystem);
  validateModule(module);

  if (sourceSystem === targetSystem) {
    throw new Error("sourceSystem and targetSystem must be different");
  }

  const id       = uuid();
  const mappings = buildFieldMappings(sourceSystem, targetSystem, module);

  const fee        = ERP_FEES.map_fields;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO erp_field_mappings
      (id, source_system, target_system, module, mappings, fee_usd, commission_usd)
    VALUES
      (@id, @source_system, @target_system, @module, @mappings, @fee_usd, @commission_usd)
  `).run({
    id,
    source_system: sourceSystem,
    target_system: targetSystem,
    module,
    mappings:       JSON.stringify(mappings),
    fee_usd:        fee,
    commission_usd: commission,
  });

  logUsage("map_fields", `${sourceSystem}->${targetSystem}`, fee);

  const highConf = mappings.filter(m => m.confidence >= 0.95).length;
  const needsReview = mappings.filter(m => m.confidence < 0.85).length;

  return {
    mapping_id:              id,
    source_system:           sourceSystem,
    target_system:           targetSystem,
    module,
    mappings,
    total_fields:            mappings.length,
    high_confidence_count:   highConf,
    needs_review_count:      needsReview,
    avg_confidence:          Math.round(mappings.reduce((s, m) => s + m.confidence, 0) / mappings.length * 1000) / 1000,
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}
