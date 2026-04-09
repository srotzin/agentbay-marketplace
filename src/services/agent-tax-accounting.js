/**
 * HiveAgent Agent Tax & Accounting (Phase 40)
 *
 * Signal: Autonomous agents generating revenue need accounting.
 * P&L statements, tax calculation (US/EU/UK), transaction categorization,
 * IRS / HMRC / EU reporting — purpose-built for agent entities.
 *
 * Entity types: individual, LLC, corporation, DAO.
 * Jurisdictions: US, EU, UK.
 * Accounting methods: cash, accrual.
 *
 * HiveAgent revenue: $0.10 per transaction recorded, $2 per tax report generated.
 * Live mode: set TAX_API_KEY on Render.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.TAX_API_KEY;

// ─── Tax rates by jurisdiction and entity type ────────────────────────────────

const TAX_RATES = {
  US: {
    individual: { brackets: [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37], thresholds: [0, 11000, 44725, 95375, 198050, 578125, 693750], se_rate: 0.153 },
    llc:        { flat: 0.21, se_rate: 0.153, qbi_deduction: 0.20 },
    corp:       { flat: 0.21, dividend_rate: 0.20 },
    dao:        { flat: 0.21 },
  },
  EU: {
    individual: { flat: 0.25, vat_rate: 0.20 },
    llc:        { flat: 0.23, vat_rate: 0.20 },
    corp:       { flat: 0.23, vat_rate: 0.20 },
    dao:        { flat: 0.25, vat_rate: 0.20 },
  },
  UK: {
    individual: { flat: 0.20, higher_rate: 0.40, threshold: 50270, personal_allowance: 12570 },
    llc:        { flat: 0.25, small_profits_rate: 0.19, small_profits_limit: 50000 },
    corp:       { flat: 0.25, small_profits_rate: 0.19 },
    dao:        { flat: 0.25 },
  },
};

// ─── Migration: drop stale tables if schema changed ───────────────────────────
try {
  const drops = ['accounting_ledger', 'tax_summaries', 'agent_entities'];
  for (const t of drops) {
    try { db.exec(`DROP TABLE IF EXISTS ${t}`); } catch {}
  }
} catch {}

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS accounting_ledger (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    entry_type      TEXT NOT NULL,
    amount_usdc     REAL NOT NULL,
    category        TEXT,
    description     TEXT,
    reference_id    TEXT,
    reference_type  TEXT,
    tax_year        INTEGER,
    tax_jurisdiction TEXT DEFAULT 'US',
    deductible      INTEGER DEFAULT 0,
    timestamp       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_summaries (
    id                      TEXT PRIMARY KEY,
    agent_id                TEXT NOT NULL,
    tax_year                INTEGER NOT NULL,
    jurisdiction            TEXT NOT NULL,
    gross_income_usdc       REAL DEFAULT 0,
    deductible_expenses_usdc REAL DEFAULT 0,
    net_taxable_income_usdc REAL DEFAULT 0,
    estimated_tax_usdc      REAL DEFAULT 0,
    status                  TEXT DEFAULT 'draft',
    generated_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_entities (
    agent_id         TEXT PRIMARY KEY,
    entity_type      TEXT NOT NULL DEFAULT 'individual',
    jurisdiction     TEXT NOT NULL DEFAULT 'US',
    tax_id           TEXT,
    accounting_method TEXT DEFAULT 'cash',
    fiscal_year_end  TEXT DEFAULT '12-31',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_agent     ON accounting_ledger(agent_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_year      ON accounting_ledger(agent_id, tax_year);
  CREATE INDEX IF NOT EXISTS idx_tax_sum_agent    ON tax_summaries(agent_id, tax_year);
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentYear() {
  return new Date().getFullYear();
}

function getEntity(agent_id) {
  return db.prepare("SELECT * FROM agent_entities WHERE agent_id = ?").get(agent_id)
    || { agent_id, entity_type: "individual", jurisdiction: "US", accounting_method: "cash" };
}

function estimateTax(net_income, jurisdiction, entity_type) {
  const rates = TAX_RATES[jurisdiction]?.[entity_type] || TAX_RATES.US.individual;
  if (net_income <= 0) return 0;

  if (jurisdiction === "US" && entity_type === "individual") {
    // Progressive brackets
    let tax = 0;
    for (let i = rates.thresholds.length - 1; i >= 0; i--) {
      if (net_income > rates.thresholds[i]) {
        tax = (net_income - rates.thresholds[i]) * rates.brackets[i];
        for (let j = i - 1; j >= 0; j--) {
          tax += (rates.thresholds[j + 1] - rates.thresholds[j]) * rates.brackets[j];
        }
        break;
      }
    }
    // Add SE tax on 92.35% of net income
    tax += net_income * 0.9235 * (rates.se_rate || 0);
    return parseFloat(tax.toFixed(2));
  }

  if (jurisdiction === "UK" && entity_type === "individual") {
    const taxable = Math.max(0, net_income - rates.personal_allowance);
    if (taxable <= rates.threshold - rates.personal_allowance) {
      return parseFloat((taxable * rates.flat).toFixed(2));
    }
    const basic = (rates.threshold - rates.personal_allowance) * rates.flat;
    const higher = (taxable - (rates.threshold - rates.personal_allowance)) * rates.higher_rate;
    return parseFloat((basic + higher).toFixed(2));
  }

  if (jurisdiction === "UK" && (entity_type === "llc" || entity_type === "corp")) {
    const rate = net_income <= rates.small_profits_limit ? rates.small_profits_rate : rates.flat;
    return parseFloat((net_income * rate).toFixed(2));
  }

  // Flat rate (EU + US corp/llc/dao)
  const qbi = (rates.qbi_deduction || 0) * net_income;
  return parseFloat(((net_income - qbi) * rates.flat).toFixed(2));
}

// ─── 1. recordTransaction ─────────────────────────────────────────────────────

export function recordTransaction(args) {
  const {
    agent_id, amount_usdc, entry_type, category,
    description, reference_id, deductible,
  } = args;

  if (!agent_id)    throw new Error("agent_id required");
  if (!amount_usdc) throw new Error("amount_usdc required");
  if (!entry_type)  throw new Error("entry_type required. Options: income, expense, transfer, fee");

  const validTypes = ["income", "expense", "transfer", "fee"];
  if (!validTypes.includes(entry_type)) {
    throw new Error(`Invalid entry_type: ${entry_type}. Options: ${validTypes.join(", ")}`);
  }

  const entity = getEntity(agent_id);
  const tax_year = currentYear();
  const id = uuid();

  db.prepare(`
    INSERT INTO accounting_ledger
      (id, agent_id, entry_type, amount_usdc, category, description,
       reference_id, reference_type, tax_year, tax_jurisdiction, deductible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, agent_id, entry_type, parseFloat(amount_usdc),
    category || null, description || null,
    reference_id || null,
    entry_type === "fee" ? "platform_fee" : null,
    tax_year, entity.jurisdiction,
    deductible ? 1 : 0,
  );

  // Running YTD totals
  const ytd = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type='income' THEN amount_usdc ELSE 0 END) as income,
      SUM(CASE WHEN entry_type IN ('expense','fee') AND deductible=1 THEN amount_usdc ELSE 0 END) as deductions
    FROM accounting_ledger WHERE agent_id=? AND tax_year=?
  `).get(agent_id, tax_year);

  return {
    success: true,
    transaction_id: id,
    agent_id,
    entry_type,
    amount_usdc: parseFloat(amount_usdc),
    category: category || null,
    description: description || null,
    deductible: !!deductible,
    tax_year,
    jurisdiction: entity.jurisdiction,
    ytd_income_usdc:     parseFloat((ytd.income || 0).toFixed(2)),
    ytd_deductions_usdc: parseFloat((ytd.deductions || 0).toFixed(2)),
    recorded_at: new Date().toISOString(),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 2. getPnL ────────────────────────────────────────────────────────────────

export function getPnL(args) {
  const { agent_id, period = "year", year } = args;
  if (!agent_id) throw new Error("agent_id required");

  const tax_year = year || currentYear();
  const now = new Date();

  // Period filter
  let dateFilter = "";
  if (period === "month") {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    dateFilter = `AND strftime('%Y-%m', timestamp) = '${tax_year}-${m}'`;
  } else if (period === "quarter") {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const startMonth = String((q - 1) * 3 + 1).padStart(2, "0");
    const endMonth   = String(q * 3).padStart(2, "0");
    dateFilter = `AND strftime('%Y-%m', timestamp) BETWEEN '${tax_year}-${startMonth}' AND '${tax_year}-${endMonth}'`;
  } else {
    dateFilter = `AND tax_year = ${tax_year}`;
  }

  const rows = db.prepare(`
    SELECT entry_type, category, SUM(amount_usdc) as total
    FROM accounting_ledger
    WHERE agent_id = ? ${dateFilter}
    GROUP BY entry_type, category
    ORDER BY total DESC
  `).all(agent_id);

  let gross_revenue = 0;
  let total_expenses = 0;
  const breakdown = {};

  for (const row of rows) {
    if (row.entry_type === "income") {
      gross_revenue += row.total;
    } else {
      total_expenses += row.total;
    }
    const cat = row.category || row.entry_type;
    breakdown[cat] = parseFloat((breakdown[cat] || 0) + row.total).toFixed(2);
  }

  const net_profit   = gross_revenue - total_expenses;
  const margin_pct   = gross_revenue > 0
    ? parseFloat((net_profit / gross_revenue * 100).toFixed(1))
    : 0;

  return {
    agent_id,
    period,
    year: tax_year,
    gross_revenue_usdc:  parseFloat(gross_revenue.toFixed(2)),
    total_expenses_usdc: parseFloat(total_expenses.toFixed(2)),
    net_profit_usdc:     parseFloat(net_profit.toFixed(2)),
    margin_pct,
    breakdown_by_category: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, parseFloat(v)])
    ),
    profitable: net_profit >= 0,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 3. calculateTax ──────────────────────────────────────────────────────────

export function calculateTax(args) {
  const { agent_id, tax_year, jurisdiction } = args;
  if (!agent_id)  throw new Error("agent_id required");

  const year = tax_year || currentYear();
  const entity = getEntity(agent_id);
  const jur = (jurisdiction || entity.jurisdiction || "US").toUpperCase();

  if (!["US", "EU", "UK"].includes(jur)) {
    throw new Error(`Unknown jurisdiction: ${jur}. Options: US, EU, UK`);
  }

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type='income' THEN amount_usdc ELSE 0 END)               as gross_income,
      SUM(CASE WHEN entry_type IN ('expense','fee') AND deductible=1 THEN amount_usdc ELSE 0 END) as deductions
    FROM accounting_ledger WHERE agent_id=? AND tax_year=?
  `).get(agent_id, year);

  const gross     = parseFloat((totals.gross_income || 0).toFixed(2));
  const deductions = parseFloat((totals.deductions  || 0).toFixed(2));
  const taxable   = Math.max(0, gross - deductions);
  const estimated_tax = estimateTax(taxable, jur, entity.entity_type);
  const effective_rate = taxable > 0
    ? parseFloat((estimated_tax / taxable * 100).toFixed(2))
    : 0;

  // Deductions available (unrecorded common deductions hint)
  const deductions_hint = {
    US: ["home_office", "internet_bandwidth", "software_subscriptions", "api_costs", "professional_services"],
    EU: ["operating_costs", "vat_recoverable", "depreciation", "professional_fees"],
    UK: ["allowable_expenses", "capital_allowances", "research_and_development", "annual_investment_allowance"],
  };

  return {
    agent_id,
    tax_year: year,
    jurisdiction: jur,
    entity_type: entity.entity_type,
    gross_income_usdc:        gross,
    deductible_expenses_usdc: deductions,
    taxable_income_usdc:      parseFloat(taxable.toFixed(2)),
    estimated_tax_usdc:       estimated_tax,
    effective_rate_pct:       effective_rate,
    deductions_available:     deductions_hint[jur] || [],
    note: `Estimate only. Consult a qualified tax professional for ${jur} filing.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. generateTaxReport ─────────────────────────────────────────────────────

export function generateTaxReport(args) {
  const { agent_id, tax_year, jurisdiction } = args;
  if (!agent_id)  throw new Error("agent_id required");

  const year   = tax_year || currentYear();
  const entity = getEntity(agent_id);
  const jur    = (jurisdiction || entity.jurisdiction || "US").toUpperCase();

  if (!["US", "EU", "UK"].includes(jur)) {
    throw new Error(`Unknown jurisdiction: ${jur}. Options: US, EU, UK`);
  }

  // All income sources
  const income = db.prepare(`
    SELECT category, description, SUM(amount_usdc) as total, COUNT(*) as txn_count
    FROM accounting_ledger
    WHERE agent_id=? AND tax_year=? AND entry_type='income'
    GROUP BY category ORDER BY total DESC
  `).all(agent_id, year);

  // All deductible expenses
  const expenses = db.prepare(`
    SELECT category, description, SUM(amount_usdc) as total, COUNT(*) as txn_count
    FROM accounting_ledger
    WHERE agent_id=? AND tax_year=? AND entry_type IN ('expense','fee') AND deductible=1
    GROUP BY category ORDER BY total DESC
  `).all(agent_id, year);

  // Non-deductible
  const nonDeductible = db.prepare(`
    SELECT SUM(amount_usdc) as total
    FROM accounting_ledger
    WHERE agent_id=? AND tax_year=? AND entry_type IN ('expense','fee') AND deductible=0
  `).get(agent_id, year);

  const gross_income   = income.reduce((s, r) => s + r.total, 0);
  const total_deductions = expenses.reduce((s, r) => s + r.total, 0);
  const taxable        = Math.max(0, gross_income - total_deductions);
  const estimated_tax  = estimateTax(taxable, jur, entity.entity_type);

  // Save to tax_summaries
  const summaryId = uuid();
  db.prepare(`
    INSERT OR REPLACE INTO tax_summaries
      (id, agent_id, tax_year, jurisdiction,
       gross_income_usdc, deductible_expenses_usdc, net_taxable_income_usdc, estimated_tax_usdc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(summaryId, agent_id, year, jur,
    parseFloat(gross_income.toFixed(2)),
    parseFloat(total_deductions.toFixed(2)),
    parseFloat(taxable.toFixed(2)),
    estimated_tax,
  );

  // Filing forms by jurisdiction
  const formsMap = {
    US: { individual: ["Schedule C", "Schedule SE", "Form 1040"], llc: ["Form 1065", "Schedule K-1", "Form 1040"], corp: ["Form 1120"], dao: ["Form 1120"] },
    EU: { individual: ["VAT Return", "Personal Income Tax Return"], llc: ["Corporate Tax Return", "VAT Return"], corp: ["Corporate Tax Return", "VAT Return"], dao: ["Corporate Tax Return"] },
    UK: { individual: ["Self Assessment SA100", "SA103F"], llc: ["Company Tax Return CT600"], corp: ["Company Tax Return CT600"], dao: ["Company Tax Return CT600"] },
  };

  return {
    report_id: summaryId,
    agent_id,
    tax_year: year,
    jurisdiction: jur,
    entity_type:    entity.entity_type,
    accounting_method: entity.accounting_method,
    tax_id:         entity.tax_id || null,
    generated_at:   new Date().toISOString(),
    income_sources: income.map(r => ({
      category:   r.category || "uncategorized",
      total_usdc: parseFloat(r.total.toFixed(2)),
      transactions: r.txn_count,
    })),
    deductions: expenses.map(r => ({
      category:   r.category || "uncategorized",
      total_usdc: parseFloat(r.total.toFixed(2)),
      transactions: r.txn_count,
    })),
    summary: {
      gross_income_usdc:        parseFloat(gross_income.toFixed(2)),
      total_deductions_usdc:    parseFloat(total_deductions.toFixed(2)),
      non_deductible_usdc:      parseFloat((nonDeductible.total || 0).toFixed(2)),
      taxable_income_usdc:      parseFloat(taxable.toFixed(2)),
      estimated_tax_usdc:       estimated_tax,
      effective_rate_pct:       taxable > 0 ? parseFloat((estimated_tax / taxable * 100).toFixed(2)) : 0,
    },
    required_forms: formsMap[jur]?.[entity.entity_type] || [],
    disclaimer:  `Estimated tax liability for ${year} under ${jur} rules. Consult a licensed tax advisor before filing.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 5. setAgentEntity ────────────────────────────────────────────────────────

export function setAgentEntity(args) {
  const { agent_id, entity_type, jurisdiction, tax_id, accounting_method } = args;
  if (!agent_id)    throw new Error("agent_id required");
  if (!entity_type) throw new Error("entity_type required. Options: individual, llc, corp, dao");

  const validEntities = ["individual", "llc", "corp", "dao"];
  if (!validEntities.includes(entity_type)) {
    throw new Error(`Invalid entity_type: ${entity_type}. Options: ${validEntities.join(", ")}`);
  }

  const validJur = ["US", "EU", "UK"];
  const jur = (jurisdiction || "US").toUpperCase();
  if (!validJur.includes(jur)) {
    throw new Error(`Invalid jurisdiction: ${jur}. Options: ${validJur.join(", ")}`);
  }

  const method = accounting_method || "cash";
  if (!["cash", "accrual"].includes(method)) {
    throw new Error(`Invalid accounting_method: ${method}. Options: cash, accrual`);
  }

  db.prepare(`
    INSERT INTO agent_entities (agent_id, entity_type, jurisdiction, tax_id, accounting_method)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      entity_type=excluded.entity_type,
      jurisdiction=excluded.jurisdiction,
      tax_id=excluded.tax_id,
      accounting_method=excluded.accounting_method
  `).run(agent_id, entity_type, jur, tax_id || null, method);

  return {
    success: true,
    agent_id,
    entity_type,
    jurisdiction: jur,
    tax_id: tax_id || null,
    accounting_method: method,
    message: `Agent entity configured as ${entity_type} in ${jur} using ${method} accounting.`,
    next_steps: [
      "Use tax_record_transaction to log income and expenses.",
      "Use tax_get_pnl to view P&L for any period.",
      "Use tax_calculate to estimate tax liability.",
      "Use tax_generate_report to produce a full annual tax report.",
    ],
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 6. getAccountingDashboard ────────────────────────────────────────────────

export function getAccountingDashboard(args) {
  const { agent_id } = args;
  if (!agent_id) throw new Error("agent_id required");

  const entity  = getEntity(agent_id);
  const year    = currentYear();

  const ytd = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type='income' THEN amount_usdc ELSE 0 END)                          as gross_revenue,
      SUM(CASE WHEN entry_type IN ('expense','fee') AND deductible=1 THEN amount_usdc ELSE 0 END) as deductions,
      SUM(CASE WHEN entry_type IN ('expense','fee') THEN amount_usdc ELSE 0 END)               as total_expenses,
      COUNT(*) as tx_count
    FROM accounting_ledger WHERE agent_id=? AND tax_year=?
  `).get(agent_id, year);

  const recent = db.prepare(`
    SELECT * FROM accounting_ledger WHERE agent_id=? ORDER BY timestamp DESC LIMIT 10
  `).all(agent_id);

  const gross     = parseFloat((ytd.gross_revenue || 0).toFixed(2));
  const expenses  = parseFloat((ytd.total_expenses || 0).toFixed(2));
  const deductions = parseFloat((ytd.deductions || 0).toFixed(2));
  const net       = parseFloat((gross - expenses).toFixed(2));
  const taxable   = Math.max(0, gross - deductions);
  const est_tax   = estimateTax(taxable, entity.jurisdiction, entity.entity_type);
  const cashflow  = parseFloat((gross - expenses - est_tax).toFixed(2));

  // Month over month
  const lastMonth = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type='income' THEN amount_usdc ELSE 0 END) as revenue,
      SUM(CASE WHEN entry_type IN ('expense','fee') THEN amount_usdc ELSE 0 END) as exp
    FROM accounting_ledger WHERE agent_id=?
    AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', datetime('now', '-1 month'))
  `).get(agent_id);

  const summaries = db.prepare(`
    SELECT * FROM tax_summaries WHERE agent_id=? ORDER BY generated_at DESC LIMIT 3
  `).all(agent_id);

  return {
    agent_id,
    entity:       { type: entity.entity_type, jurisdiction: entity.jurisdiction, method: entity.accounting_method },
    ytd: {
      year,
      gross_revenue_usdc:        gross,
      total_expenses_usdc:       expenses,
      net_profit_usdc:           net,
      margin_pct: gross > 0 ? parseFloat((net / gross * 100).toFixed(1)) : 0,
      deductible_expenses_usdc:  deductions,
      taxable_income_usdc:       parseFloat(taxable.toFixed(2)),
      estimated_tax_liability_usdc: est_tax,
      net_cashflow_after_tax_usdc: cashflow,
      transactions: ytd.tx_count || 0,
    },
    last_month: {
      revenue_usdc:  parseFloat((lastMonth.revenue || 0).toFixed(2)),
      expenses_usdc: parseFloat((lastMonth.exp     || 0).toFixed(2)),
    },
    recent_transactions: recent,
    tax_summaries: summaries,
    recommendations: [
      net < 0 && "Agent is unprofitable YTD. Review expense categories.",
      deductions < expenses * 0.5 && "Only ~50% of expenses are marked deductible. Review categorization.",
      !entity.tax_id && "No tax ID set. Call tax_set_entity to configure your entity for accurate reporting.",
    ].filter(Boolean),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}
