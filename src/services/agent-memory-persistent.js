/**
 * Persistent Agent Memory
 *
 * Agents store their learned preferences, workflow history, and operational
 * context with HiveAgent. Leaving means losing everything — workflow patterns,
 * learned shortcuts, contact preferences, and credential references built up
 * over thousands of runs.
 *
 * Revenue model:
 *   Write  — $0.001/write
 *   Read   — $0.0005/read
 *   Search — $0.002/search
 *   Query  — $0.001/query
 *   Learn  — $0.001/write
 */

import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────

const MEMORY_WRITE_FEE    = 0.001;
const MEMORY_READ_FEE     = 0.0005;
const MEMORY_SEARCH_FEE   = 0.002;
const MEMORY_QUERY_FEE    = 0.001;
const MEMORY_LEARN_FEE    = 0.001;

const VALID_CATEGORIES = ["preference", "workflow_history", "learned_pattern", "contact", "credential_ref", "context"];

// ─── Schema Initialization ─────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hwa_memories (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    key          TEXT NOT NULL,
    value        TEXT NOT NULL,
    category     TEXT NOT NULL CHECK(category IN (
                   'preference','workflow_history','learned_pattern',
                   'contact','credential_ref','context')),
    access_count INTEGER NOT NULL DEFAULT 0,
    stored_at    TEXT DEFAULT (datetime('now')),
    expires_at   TEXT,
    UNIQUE(agent_id, key)
  );

  CREATE TABLE IF NOT EXISTS hwa_workflow_history (
    id             TEXT PRIMARY KEY,
    agent_id       TEXT NOT NULL,
    vertical       TEXT NOT NULL,
    tools_used     TEXT NOT NULL DEFAULT '[]',
    inputs_summary TEXT,
    outcome        TEXT NOT NULL CHECK(outcome IN ('success','failure','partial')),
    cost_usd       REAL NOT NULL DEFAULT 0,
    duration_ms    INTEGER,
    timestamp      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hwa_preferences (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    preference  TEXT NOT NULL,
    context     TEXT,
    confidence  REAL NOT NULL DEFAULT 1.0,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_id, preference)
  );

  CREATE INDEX IF NOT EXISTS idx_memories_agent   ON hwa_memories(agent_id);
  CREATE INDEX IF NOT EXISTS idx_memories_category ON hwa_memories(category);
  CREATE INDEX IF NOT EXISTS idx_wf_history_agent  ON hwa_workflow_history(agent_id);
  CREATE INDEX IF NOT EXISTS idx_prefs_agent       ON hwa_preferences(agent_id);
`);

// ─── Seed Data ─────────────────────────────────────────────────────────────

const _memCount = db.prepare("SELECT COUNT(*) as n FROM hwa_memories").get().n;
if (_memCount === 0) {
  const agents = [
    {
      id: "agent_finbot_001",
      memories: [
        { key: "preferred_payment_rail",   value: "ACH over wire for domestic, SWIFT for international", category: "preference" },
        { key: "fraud_check_order",        value: "Always run fraud_screen_transaction before any payment > $500", category: "learned_pattern" },
        { key: "accounting_contact_cfo",   value: JSON.stringify({ name: "Sarah Chen", email: "schen@acmecorp.com", role: "CFO" }), category: "contact" },
        { key: "quickbooks_api_ref",       value: "credential_ref:vault://acmecorp/quickbooks_oauth_token", category: "credential_ref" },
        { key: "current_fiscal_quarter",   value: "Q2 2026 — ends June 30. Tax deadline July 15.", category: "context" },
      ],
      workflows: [
        { vertical: "finance", tools_used: ["invoice_extract_data","invoice_three_way_match","invoice_route_approval","invoice_optimize_payment"], inputs_summary: "Batch of 47 vendor invoices, total $124,500", outcome: "success", cost_usd: 2.35, duration_ms: 8400 },
        { vertical: "fraud", tools_used: ["fraud_screen_transaction","fraud_check_identity","fraud_predict_chargeback"], inputs_summary: "Wire transfer request $45,000 to new vendor", outcome: "success", cost_usd: 0.80, duration_ms: 1200 },
      ],
      prefs: [
        { preference: "Prefer FedEx over UPS for overnight packages", context: "FedEx has 99.2% on-time rate for this account" },
        { preference: "Always check fraud score before approving invoices > $10k", context: "Policy set by CFO after Q3 incident" },
      ],
    },
    {
      id: "agent_legalbot_004",
      memories: [
        { key: "preferred_jurisdiction", value: "California courts preferred; Texas as fallback for federal filings", category: "preference" },
        { key: "case_numbering_format", value: "Use format YEAR-VERTICAL-SEQNUM (e.g. 2026-PI-0042)", category: "learned_pattern" },
        { key: "opposing_counsel_smith", value: JSON.stringify({ name: "James Whitmore", firm: "Whitmore & Associates", email: "jwhitmore@whitmore.law", notes: "Aggressive discovery style, prefers email over phone" }), category: "contact" },
        { key: "westlaw_session_ref",   value: "credential_ref:vault://lawfirm/westlaw_session_key", category: "credential_ref" },
        { key: "statute_of_limitations_pi", value: "CA personal injury: 2 years from date of injury. Medical malpractice: 3 years or 1 year from discovery.", category: "context" },
        { key: "filing_deadline_tracker", value: JSON.stringify([{ case: "Chen v. Metro Hospital", deadline: "2026-05-15", type: "Answer to Complaint" }]), category: "context" },
      ],
      workflows: [
        { vertical: "legal", tools_used: ["legal_intake_case","legal_summarize_records","legal_search_case_law","legal_demand_letter","legal_track_deadlines"], inputs_summary: "Personal injury case — slip and fall, $180k claimed", outcome: "success", cost_usd: 1.20, duration_ms: 14500 },
        { vertical: "legal", tools_used: ["legal_search_case_law","legal_demand_letter"], inputs_summary: "Contract dispute, software vendor breach", outcome: "partial", cost_usd: 0.45, duration_ms: 5200 },
      ],
      prefs: [
        { preference: "Always cite Westlaw over Google Scholar when case law conflicts", context: "Higher court acceptance rate for Westlaw citations" },
        { preference: "Draft demand letters in formal tone, avoid contractions", context: "Senior partner requirement" },
      ],
    },
    {
      id: "agent_supplybot_002",
      memories: [
        { key: "preferred_freight_carrier", value: "Maersk for ocean freight; FedEx Freight for domestic LTL", category: "preference" },
        { key: "inventory_reorder_logic",   value: "Reorder when stock falls to 15% of 90-day average. Emergency reorder at 5%.", category: "learned_pattern" },
        { key: "supplier_acme_plastics",    value: JSON.stringify({ name: "ACME Plastics Inc.", contact: "mike@acmeplastics.com", lead_time_days: 12, payment_terms: "Net-30" }), category: "contact" },
        { key: "erp_connection_ref",        value: "credential_ref:vault://globallogistics/sap_api_key", category: "credential_ref" },
        { key: "tariff_context_2026",       value: "US-China tariffs: 25% on HS 8471 (computers), 7.5% on HS 3926 (plastic parts). Review quarterly.", category: "context" },
        { key: "top_suppliers_ranking",     value: JSON.stringify(["ACME Plastics","Shenzhen Components Ltd","Euro Parts GmbH"]), category: "learned_pattern" },
      ],
      workflows: [
        { vertical: "supply_chain", tools_used: ["supply_forecast_demand","supply_optimize_inventory","procurement_create_rfq","procurement_evaluate_bids"], inputs_summary: "Q2 inventory plan for 340 SKUs across 3 warehouses", outcome: "success", cost_usd: 3.10, duration_ms: 22000 },
        { vertical: "trade", tools_used: ["trade_classify_hs","trade_screen_sanctions","trade_calculate_duty","trade_generate_customs_docs"], inputs_summary: "Shipment of 5,000 units from Shenzhen to Chicago", outcome: "success", cost_usd: 1.80, duration_ms: 9800 },
        { vertical: "supply_chain", tools_used: ["supply_track_shipment","supply_compare_freight"], inputs_summary: "Emergency re-route — Suez Canal delay", outcome: "success", cost_usd: 0.60, duration_ms: 3400 },
      ],
      prefs: [
        { preference: "Always check trade_screen_sanctions before issuing PO to new international suppliers", context: "Compliance requirement after 2024 OFAC audit" },
        { preference: "Use Maersk over CMA-CGM for Asia-Pacific routes when price difference < 8%", context: "Maersk has better tracking API integration" },
      ],
    },
  ];

  const insertMem  = db.prepare(`INSERT OR IGNORE INTO hwa_memories (id, agent_id, key, value, category) VALUES (@id, @agent_id, @key, @value, @category)`);
  const insertWF   = db.prepare(`INSERT OR IGNORE INTO hwa_workflow_history (id, agent_id, vertical, tools_used, inputs_summary, outcome, cost_usd, duration_ms) VALUES (@id, @agent_id, @vertical, @tools_used, @inputs_summary, @outcome, @cost_usd, @duration_ms)`);
  const insertPref = db.prepare(`INSERT OR IGNORE INTO hwa_preferences (id, agent_id, preference, context) VALUES (@id, @agent_id, @preference, @context)`);

  for (const agent of agents) {
    for (const m of agent.memories) insertMem.run({ id: crypto.randomUUID(), agent_id: agent.id, ...m });
    for (const w of agent.workflows) insertWF.run({ id: crypto.randomUUID(), agent_id: agent.id, tools_used: JSON.stringify(w.tools_used), ...w, tools_used: JSON.stringify(w.tools_used) });
    for (const p of agent.prefs)    insertPref.run({ id: crypto.randomUUID(), agent_id: agent.id, ...p });
  }
}

// ─── storeMemory ───────────────────────────────────────────────────────────

/**
 * Store a key-value memory for an agent.
 * @param {string} agentId   - Agent identifier
 * @param {string} key       - Memory key (namespaced, e.g. "preferred_shipper")
 * @param {*}      value     - Any JSON-serialisable value
 * @param {string} category  - preference|workflow_history|learned_pattern|contact|credential_ref|context
 * @param {number} [ttl]     - Optional TTL in seconds
 * @returns {object} memory_id, stored_at, expires_at, fee_usd
 */
export function storeMemory(agentId, key, value, category, ttl) {
  if (!agentId)  throw new Error("agentId is required");
  if (!key)      throw new Error("key is required");
  if (value === undefined || value === null) throw new Error("value is required");
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  const id         = crypto.randomUUID();
  const storedAt   = new Date().toISOString();
  const expiresAt  = ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  db.prepare(`
    INSERT OR IGNORE INTO hwa_memories (id, agent_id, key, value, category, stored_at, expires_at)
    VALUES (@id, @agent_id, @key, @value, @category, @stored_at, @expires_at)
    ON CONFLICT(agent_id, key) DO UPDATE SET
      value      = excluded.value,
      category   = excluded.category,
      stored_at  = excluded.stored_at,
      expires_at = excluded.expires_at
  `).run({ id, agent_id: agentId, key, value: serialized, category, stored_at: storedAt, expires_at: expiresAt });

  return {
    memory_id:   id,
    agent_id:    agentId,
    key,
    category,
    stored_at:   storedAt,
    expires_at:  expiresAt ?? "never",
    fee_usd:     MEMORY_WRITE_FEE,
    message:     "Memory persisted. This knowledge travels with the agent across all sessions.",
  };
}

// ─── recallMemory ──────────────────────────────────────────────────────────

/**
 * Recall a specific memory by key.
 * @param {string} agentId
 * @param {string} key
 * @returns {object} value, category, stored_at, access_count, fee_usd
 */
export function recallMemory(agentId, key) {
  if (!agentId) throw new Error("agentId is required");
  if (!key)     throw new Error("key is required");

  const mem = db.prepare("SELECT * FROM hwa_memories WHERE agent_id = ? AND key = ?").get(agentId, key);
  if (!mem) throw new Error(`Memory not found: agent=${agentId}, key=${key}`);

  // Check TTL
  if (mem.expires_at && new Date(mem.expires_at) < new Date()) {
    db.prepare("DELETE FROM hwa_memories WHERE agent_id = ? AND key = ?").run(agentId, key);
    throw new Error(`Memory expired: agent=${agentId}, key=${key}`);
  }

  db.prepare("UPDATE hwa_memories SET access_count = access_count + 1 WHERE agent_id = ? AND key = ?")
    .run(agentId, key);

  let parsed;
  try { parsed = JSON.parse(mem.value); } catch { parsed = mem.value; }

  return {
    memory_id:    mem.id,
    agent_id:     agentId,
    key,
    value:        parsed,
    category:     mem.category,
    stored_at:    mem.stored_at,
    expires_at:   mem.expires_at ?? "never",
    access_count: mem.access_count + 1,
    fee_usd:      MEMORY_READ_FEE,
  };
}

// ─── searchMemory ──────────────────────────────────────────────────────────

/**
 * Semantic search across all stored memories for an agent.
 * @param {string} agentId
 * @param {string} query    - Natural language or keyword query
 * @param {string} [category] - Optional filter by category
 * @param {number} [limit]    - Max results (default 10)
 * @returns {object} matches[], fee_usd
 */
export function searchMemory(agentId, query, category, limit = 10) {
  if (!agentId) throw new Error("agentId is required");
  if (!query)   throw new Error("query is required");

  let sql    = "SELECT * FROM hwa_memories WHERE agent_id = ?";
  const params = [agentId];

  if (category) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);
    }
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY access_count DESC, stored_at DESC";
  const all = db.prepare(sql).all(...params);

  // Simple keyword relevance scoring (real implementation would use embeddings)
  const queryTerms = query.toLowerCase().split(/\s+/);
  const scored = all.map(m => {
    const text  = `${m.key} ${m.value}`.toLowerCase();
    const hits  = queryTerms.filter(t => text.includes(t)).length;
    const score = hits / queryTerms.length;
    return { ...m, relevance_score: Math.round(score * 100) / 100 };
  })
  .filter(m => m.relevance_score > 0)
  .sort((a, b) => b.relevance_score - a.relevance_score)
  .slice(0, limit);

  return {
    agent_id: agentId,
    query,
    category: category ?? "all",
    matches: scored.map(m => {
      let val;
      try { val = JSON.parse(m.value); } catch { val = m.value; }
      return {
        memory_id:       m.id,
        key:             m.key,
        value:           val,
        category:        m.category,
        relevance_score: m.relevance_score,
        stored_at:       m.stored_at,
        access_count:    m.access_count,
      };
    }),
    total_searched: all.length,
    fee_usd:        MEMORY_SEARCH_FEE,
  };
}

// ─── getWorkflowHistory ────────────────────────────────────────────────────

/**
 * Recall past workflow executions. "Last time you processed a construction permit
 * in Austin, you used these 5 tools."
 * @param {string} agentId
 * @param {string} [vertical] - Optional vertical filter
 * @param {number} [limit]    - Max results (default 10)
 * @returns {object} workflows[], fee_usd
 */
export function getWorkflowHistory(agentId, vertical, limit = 10) {
  if (!agentId) throw new Error("agentId is required");

  let sql    = "SELECT * FROM hwa_workflow_history WHERE agent_id = ?";
  const params = [agentId];

  if (vertical) { sql += " AND vertical = ?"; params.push(vertical); }
  sql += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  return {
    agent_id: agentId,
    vertical: vertical ?? "all",
    workflows: rows.map(w => ({
      workflow_id:    w.id,
      vertical:       w.vertical,
      tools_used:     JSON.parse(w.tools_used),
      inputs_summary: w.inputs_summary,
      outcome:        w.outcome,
      cost_usd:       w.cost_usd,
      duration_ms:    w.duration_ms,
      timestamp:      w.timestamp,
    })),
    total_runs:   rows.length,
    fee_usd:      MEMORY_QUERY_FEE,
    insight:      rows.length > 0
      ? `Last run: ${rows[0].vertical} workflow using ${JSON.parse(rows[0].tools_used).join(", ")}. Outcome: ${rows[0].outcome}.`
      : "No workflow history found for this agent.",
  };
}

// ─── learnPreference ──────────────────────────────────────────────────────

/**
 * Store a learned preference automatically.
 * "This agent prefers FedEx over UPS", "This agent always checks fraud before invoices."
 * @param {string} agentId
 * @param {string} preference - The preference to record
 * @param {string} [context]  - Why this preference was learned
 * @returns {object} preference_id, fee_usd
 */
export function learnPreference(agentId, preference, context) {
  if (!agentId)    throw new Error("agentId is required");
  if (!preference) throw new Error("preference is required");

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hwa_preferences (id, agent_id, preference, context, created_at)
    VALUES (@id, @agent_id, @preference, @context, @created_at)
    ON CONFLICT(agent_id, preference) DO UPDATE SET
      context    = excluded.context,
      created_at = excluded.created_at
  `).run({ id, agent_id: agentId, preference, context: context ?? null, created_at: now });

  // Also mirror into memories for searchability
  storeMemory(agentId, `pref_${id.slice(0, 8)}`, preference, "preference");

  return {
    preference_id: id,
    agent_id:      agentId,
    preference,
    context:       context ?? null,
    learned_at:    now,
    fee_usd:       MEMORY_LEARN_FEE,
    message:       "Preference stored. This agent will apply this preference automatically in future sessions.",
  };
}

// ─── getAgentProfile ──────────────────────────────────────────────────────

/**
 * Full agent profile built from accumulated memory. Free.
 * @param {string} agentId
 * @returns {object} preferences[], frequent_tools[], verticals_used[], avg_session_length, total_transactions, workflow_patterns[]
 */
export function getAgentProfile(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const memories    = db.prepare("SELECT * FROM hwa_memories WHERE agent_id = ? ORDER BY access_count DESC").all(agentId);
  const workflows   = db.prepare("SELECT * FROM hwa_workflow_history WHERE agent_id = ? ORDER BY timestamp DESC").all(agentId);
  const preferences = db.prepare("SELECT * FROM hwa_preferences WHERE agent_id = ? ORDER BY created_at DESC").all(agentId);

  // Aggregate tool usage frequency
  const toolFreq = {};
  for (const wf of workflows) {
    const tools = JSON.parse(wf.tools_used);
    for (const t of tools) toolFreq[t] = (toolFreq[t] ?? 0) + 1;
  }
  const frequentTools = Object.entries(toolFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, uses: count }));

  // Aggregate verticals used
  const vertFreq = {};
  for (const wf of workflows) vertFreq[wf.vertical] = (vertFreq[wf.vertical] ?? 0) + 1;
  const verticalsUsed = Object.entries(vertFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([vertical, runs]) => ({ vertical, runs }));

  // Avg session length
  const durations   = workflows.filter(w => w.duration_ms).map(w => w.duration_ms);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  // Total cost
  const totalCost   = workflows.reduce((sum, w) => sum + w.cost_usd, 0);
  const successRate = workflows.length
    ? Math.round((workflows.filter(w => w.outcome === "success").length / workflows.length) * 100)
    : 0;

  return {
    agent_id:            agentId,
    memory_count:        memories.length,
    preference_count:    preferences.length,
    preferences:         preferences.map(p => ({ preference: p.preference, context: p.context, learned_at: p.created_at })),
    frequent_tools:      frequentTools,
    verticals_used:      verticalsUsed,
    total_workflow_runs: workflows.length,
    success_rate_pct:    successRate,
    avg_session_ms:      avgDuration,
    total_spent_usd:     Math.round(totalCost * 1000) / 1000,
    workflow_patterns:   workflows.slice(0, 5).map(w => ({
      vertical:   w.vertical,
      tools_used: JSON.parse(w.tools_used),
      outcome:    w.outcome,
      timestamp:  w.timestamp,
    })),
    memory_categories:   VALID_CATEGORIES.map(cat => ({
      category: cat,
      count:    memories.filter(m => m.category === cat).length,
    })),
    as_of: new Date().toISOString(),
  };
}

// ─── deleteMemory ─────────────────────────────────────────────────────────

/**
 * GDPR-compliant deletion of a specific memory. Free.
 * @param {string} agentId
 * @param {string} key
 * @returns {object} deleted(bool)
 */
export function deleteMemory(agentId, key) {
  if (!agentId) throw new Error("agentId is required");
  if (!key)     throw new Error("key is required");

  const result = db.prepare("DELETE FROM hwa_memories WHERE agent_id = ? AND key = ?").run(agentId, key);

  return {
    agent_id:  agentId,
    key,
    deleted:   result.changes > 0,
    deleted_at: new Date().toISOString(),
    message:   result.changes > 0
      ? "Memory permanently deleted in compliance with GDPR Article 17."
      : "No memory found for this agent/key combination.",
  };
}
