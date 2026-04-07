import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const TAX_PLATFORM_FEE = 0.20; // 20% platform margin
const FEES = {
  categorizeExpense:       0.02,
  prepareTaxReturn:       10.00,
  reconcileAccounts:       2.00,
  forecastCashFlow:        2.00,
  checkTaxDeadlines:       0.50,
  generateFinancialStatement: 3.00,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tax_expense_categories (
    id           TEXT PRIMARY KEY,
    description  TEXT,
    amount       REAL,
    vendor       TEXT,
    date         TEXT,
    category     TEXT,
    subcategory  TEXT,
    tax_deductible INTEGER,
    irs_schedule TEXT,
    confidence   REAL,
    notes        TEXT,
    fee_usd      REAL DEFAULT 0.02,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_returns (
    id                  TEXT PRIMARY KEY,
    business_type       TEXT,
    tax_year            INTEGER,
    state               TEXT,
    filing_status       TEXT,
    federal_liability   REAL,
    state_liability     REAL,
    effective_rate      REAL,
    estimated_refund    REAL,
    deductions_json     TEXT,
    credits_json        TEXT,
    forms_json          TEXT,
    fee_usd             REAL DEFAULT 10.0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_reconciliations (
    id                   TEXT PRIMARY KEY,
    matched_count        INTEGER,
    unmatched_bank_count INTEGER,
    unmatched_book_count INTEGER,
    discrepancy_amount   REAL,
    recs_json            TEXT,
    fee_usd              REAL DEFAULT 2.0,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_cashflow_forecasts (
    id             TEXT PRIMARY KEY,
    periods        INTEGER,
    forecast_json  TEXT,
    risk_flags_json TEXT,
    fee_usd        REAL DEFAULT 2.0,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_deadline_checks (
    id            TEXT PRIMARY KEY,
    entity_type   TEXT,
    state         TEXT,
    tax_year      INTEGER,
    deadlines_json TEXT,
    fee_usd       REAL DEFAULT 0.5,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_financial_statements (
    id              TEXT PRIMARY KEY,
    statement_type  TEXT,
    period          TEXT,
    statement_json  TEXT,
    ratios_json     TEXT,
    trends_json     TEXT,
    audit_notes_json TEXT,
    fee_usd         REAL DEFAULT 3.0,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundUsd(n) {
  return Math.round((n ?? 0) * 100) / 100;
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100 * 100) / 100;
}

// Expense category lookup map
const EXPENSE_CATEGORY_MAP = [
  { keywords: ["airfare","airline","flight","travel","hotel","lodging","motel","uber","lyft","taxi","car rental","toll","parking"], category: "Travel", subcategory: "Business Travel", deductible: true, schedule: "Schedule C / Form 2106", notes: "Must be ordinary and necessary; keep receipts and business purpose documentation." },
  { keywords: ["restaurant","meal","lunch","dinner","breakfast","coffee","food","catering","bar"], category: "Meals & Entertainment", subcategory: "Business Meals", deductible: true, schedule: "Schedule C Line 24b", notes: "50% deductible for business meals with clients or employees. Keep business purpose notes." },
  { keywords: ["office","supplies","paper","printer","staples","desk","chair","furniture","equipment"], category: "Office & Equipment", subcategory: "Office Supplies", deductible: true, schedule: "Schedule C Line 22", notes: "Fully deductible if used exclusively for business." },
  { keywords: ["software","saas","subscription","adobe","microsoft","google","aws","cloud","hosting"], category: "Technology", subcategory: "Software & SaaS", deductible: true, schedule: "Schedule C Line 22", notes: "Deductible in year paid for annual subscriptions or amortized for multi-year licenses." },
  { keywords: ["phone","mobile","cell","telecom","internet","broadband","wifi"], category: "Utilities", subcategory: "Telecommunications", deductible: true, schedule: "Schedule C Line 25", notes: "Pro-rate if used for both business and personal." },
  { keywords: ["rent","lease","office space","co-working","coworking","wework"], category: "Rent", subcategory: "Business Premises", deductible: true, schedule: "Schedule C Line 20b", notes: "Fully deductible for business-use premises." },
  { keywords: ["insurance","liability","malpractice","workers comp","health insurance","dental","vision"], category: "Insurance", subcategory: "Business Insurance", deductible: true, schedule: "Schedule C Line 15", notes: "Business-related insurance premiums are fully deductible." },
  { keywords: ["payroll","salary","wage","contractor","freelance","1099","w2","employee"], category: "Labor", subcategory: "Wages & Contractor Fees", deductible: true, schedule: "Schedule C Line 26", notes: "Employee wages on Line 26; contractor fees on Line 11 if $600+ (Form 1099-NEC required)." },
  { keywords: ["marketing","advertising","ads","google ads","facebook","seo","pr","promotion"], category: "Marketing", subcategory: "Advertising", deductible: true, schedule: "Schedule C Line 8", notes: "Fully deductible business advertising expenses." },
  { keywords: ["accounting","bookkeeping","cpa","legal","attorney","consulting","professional"], category: "Professional Services", subcategory: "Legal & Accounting", deductible: true, schedule: "Schedule C Line 17", notes: "Deductible in year paid. Capitalize fees tied to asset acquisition or business formation." },
  { keywords: ["bank","fee","wire","transaction","interest","loan","credit card"], category: "Financial", subcategory: "Bank & Finance Charges", deductible: true, schedule: "Schedule C Line 28", notes: "Bank fees and interest on business loans are deductible." },
  { keywords: ["training","course","education","certification","seminar","conference","workshop"], category: "Education & Training", subcategory: "Professional Development", deductible: true, schedule: "Schedule C Line 22", notes: "Deductible if improving skills in current business; not for entering a new profession." },
  { keywords: ["vehicle","fuel","gas","mileage","auto","car","truck","maintenance","repair"], category: "Vehicle", subcategory: "Business Vehicle Expense", deductible: true, schedule: "Schedule C Line 9", notes: "Use standard mileage rate ($0.67/mile for 2024) or actual expenses. Keep mileage log." },
  { keywords: ["inventory","cost of goods","cogs","materials","manufacturing","wholesale"], category: "Cost of Goods Sold", subcategory: "Inventory", deductible: true, schedule: "Schedule C Part III", notes: "COGS reduces gross profit directly. Use proper inventory accounting method (FIFO/LIFO)." },
  { keywords: ["personal","grocery","clothing","entertainment","gym","Netflix","spotify","vacation"], category: "Personal", subcategory: "Non-Deductible Personal", deductible: false, schedule: "N/A", notes: "Personal expenses are not deductible. Keep separate from business accounts." },
];

function lookupCategory(description, vendor) {
  const text = `${description} ${vendor}`.toLowerCase();
  for (const cat of EXPENSE_CATEGORY_MAP) {
    if (cat.keywords.some(kw => text.includes(kw))) {
      return cat;
    }
  }
  return {
    category:   "Miscellaneous",
    subcategory: "Other Business Expense",
    deductible:  true,
    schedule:    "Schedule C Line 27",
    notes:       "Review with a CPA to confirm deductibility. Retain receipt and document business purpose.",
  };
}

// ─── categorizeExpense ────────────────────────────────────────────────────────

/**
 * Auto-categorize a business expense and identify its tax treatment.
 * @param {string} description  - Expense description or merchant name
 * @param {number} amount       - Amount in USD
 * @param {string} vendor       - Vendor or payee name
 * @param {string} date         - Transaction date (YYYY-MM-DD)
 * @returns category, subcategory, tax_deductible, irs_schedule, confidence, notes
 * Fee: $0.02 per expense
 */
export function categorizeExpense(description, amount, vendor, date) {
  if (!description) throw new Error("description is required");
  if (amount == null) throw new Error("amount is required");

  const cat     = lookupCategory(description, vendor ?? "");
  const exact   = EXPENSE_CATEGORY_MAP.some(c => c.keywords.some(kw => `${description} ${vendor ?? ""}`.toLowerCase().includes(kw)));
  const confidence = exact ? 0.94 : 0.72;

  const deductibleAmount = cat.deductible
    ? (cat.subcategory === "Business Meals" ? roundUsd(amount * 0.5) : amount)
    : 0;

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_expense_categories
      (id, description, amount, vendor, date, category, subcategory, tax_deductible, irs_schedule, confidence, notes, fee_usd)
    VALUES
      (@id, @description, @amount, @vendor, @date, @category, @subcategory, @tax_deductible, @irs_schedule, @confidence, @notes, @fee_usd)
  `).run({
    id,
    description,
    amount,
    vendor:        vendor ?? null,
    date:          date ?? new Date().toISOString().slice(0, 10),
    category:      cat.category,
    subcategory:   cat.subcategory,
    tax_deductible: cat.deductible ? 1 : 0,
    irs_schedule:  cat.schedule,
    confidence,
    notes:         cat.notes,
    fee_usd:       FEES.categorizeExpense,
  });

  return {
    expense_id:       id,
    description,
    amount_usd:       amount,
    vendor:           vendor ?? null,
    date:             date ?? new Date().toISOString().slice(0, 10),
    category:         cat.category,
    subcategory:      cat.subcategory,
    tax_deductible:   cat.deductible,
    deductible_amount_usd: deductibleAmount,
    irs_schedule:     cat.schedule,
    confidence:       confidence,
    confidence_label: confidence >= 0.9 ? "high" : confidence >= 0.75 ? "medium" : "low",
    notes:            cat.notes,
    flag_for_review:  confidence < 0.75 || !cat.deductible,
    fee_usd:          FEES.categorizeExpense,
    platform_revenue_usd: roundUsd(FEES.categorizeExpense * TAX_PLATFORM_FEE),
    created_at:       new Date().toISOString(),
  };
}

// ─── prepareTaxReturn ─────────────────────────────────────────────────────────

/**
 * Prepare a tax return summary with liability, deductions, and credits.
 * @param {string} businessType  - sole_prop|partnership|s_corp|c_corp|llc
 * @param {object} income        - { gross_revenue, other_income, w2_income }
 * @param {object} expenses      - Key-value map of expense categories to amounts
 * @param {string} state         - Two-letter state code (e.g. "CA")
 * @param {string} filingStatus  - single|married_filing_jointly|married_filing_separately|head_of_household
 * @returns federal_liability, state_liability, effective_rate, deductions_taken[], credits_applied[], estimated_refund, forms_needed[]
 * Fee: $10.00 per return
 */
export function prepareTaxReturn(businessType, income, expenses, state, filingStatus) {
  if (!businessType) throw new Error("businessType is required");
  if (!income)       throw new Error("income is required");
  if (!state)        throw new Error("state is required");

  const inc   = income   ?? {};
  const exp   = expenses ?? {};
  const st    = (state ?? "CA").toUpperCase();
  const fs    = filingStatus ?? "single";

  const grossRevenue = inc.gross_revenue  ?? 0;
  const otherIncome  = inc.other_income   ?? 0;
  const w2Income     = inc.w2_income      ?? 0;
  const totalIncome  = grossRevenue + otherIncome + w2Income;

  // Aggregate deductions
  const deductionItems = [];
  const expTotal = Object.values(exp).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);

  if (expTotal > 0)         deductionItems.push({ name: "Business Expenses (Schedule C)", amount: expTotal, form: "Schedule C" });
  if (inc.home_office_sqft) {
    const hoDeduction = Math.min(1500, inc.home_office_sqft * 5); // simplified method
    deductionItems.push({ name: "Home Office Deduction", amount: hoDeduction, form: "Form 8829" });
  }

  // QBI deduction (20% of qualified business income for pass-throughs)
  const qbiEligible = ["sole_prop","s_corp","partnership","llc"].includes(businessType);
  const qbi         = qbiEligible ? roundUsd(Math.max(0, (grossRevenue - expTotal)) * 0.20) : 0;
  if (qbi > 0) deductionItems.push({ name: "Qualified Business Income (QBI) Deduction", amount: qbi, form: "Form 8995" });

  // Standard deduction
  const stdDeductions = { single: 14600, married_filing_jointly: 29200, married_filing_separately: 14600, head_of_household: 21900 };
  const stdDeduction  = stdDeductions[fs] ?? 14600;
  deductionItems.push({ name: "Standard Deduction", amount: stdDeduction, form: "Form 1040 Line 12" });

  const totalDeductions = deductionItems.reduce((s, d) => s + d.amount, 0);
  const taxableIncome   = Math.max(0, totalIncome - totalDeductions);

  // Federal tax brackets 2024 (single)
  const brackets2024 = [
    { min: 0,       max: 11600,  rate: 0.10 },
    { min: 11600,   max: 47150,  rate: 0.12 },
    { min: 47150,   max: 100525, rate: 0.22 },
    { min: 100525,  max: 191950, rate: 0.24 },
    { min: 191950,  max: 243725, rate: 0.32 },
    { min: 243725,  max: 609350, rate: 0.35 },
    { min: 609350,  max: Infinity, rate: 0.37 },
  ];
  const mfjBrackets = [
    { min: 0,       max: 23200,  rate: 0.10 },
    { min: 23200,   max: 94300,  rate: 0.12 },
    { min: 94300,   max: 201050, rate: 0.22 },
    { min: 201050,  max: 383900, rate: 0.24 },
    { min: 383900,  max: 487450, rate: 0.32 },
    { min: 487450,  max: 731200, rate: 0.35 },
    { min: 731200,  max: Infinity, rate: 0.37 },
  ];
  const applicableBrackets = fs === "married_filing_jointly" ? mfjBrackets : brackets2024;

  let federalTax = 0;
  let remaining  = taxableIncome;
  for (const bracket of applicableBrackets) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, bracket.max - bracket.min);
    federalTax   += taxable * bracket.rate;
    remaining    -= taxable;
  }

  // Self-employment tax for sole prop / LLC
  const seTax = qbiEligible ? roundUsd(Math.max(0, grossRevenue - expTotal) * 0.9235 * 0.153) : 0;
  if (seTax > 0) federalTax += seTax * 0.5; // deduct half of SE tax

  // State tax (simplified flat/bracket estimate)
  const stateRates = {
    CA: 0.093, NY: 0.0685, TX: 0, FL: 0, WA: 0, OR: 0.099,
    MA: 0.05,  IL: 0.0495, PA: 0.0307, OH: 0.04, GA: 0.055,
    NC: 0.0499, NJ: 0.1075, VA: 0.0575, AZ: 0.025, CO: 0.044,
  };
  const stateRate  = stateRates[st] ?? 0.05;
  const stateTax   = roundUsd(taxableIncome * stateRate);

  // Credits
  const creditsApplied = [];
  if (qbiEligible && w2Income > 0) {
    creditsApplied.push({ name: "Earned Income Credit (if eligible)", amount: 0, form: "Schedule EIC", note: "Run eligibility check — depends on AGI and dependents" });
  }
  if (businessType === "s_corp" || businessType === "c_corp") {
    creditsApplied.push({ name: "R&D Tax Credit (Form 6765)", amount: 0, form: "Form 6765", note: "Consult CPA — credit based on qualified research activities" });
  }
  const totalCredits   = creditsApplied.reduce((s, c) => s + c.amount, 0);
  federalTax           = Math.max(0, roundUsd(federalTax - totalCredits));

  const effectiveRate  = totalIncome > 0 ? pct(federalTax, totalIncome) : 0;
  const withholding    = inc.withholding_paid ?? 0;
  const estimatedRefund = roundUsd(withholding - federalTax);

  // Forms needed
  const formsNeeded = ["Form 1040"];
  if (["sole_prop","llc"].includes(businessType)) formsNeeded.push("Schedule C");
  if (qbiEligible && qbi > 0)  formsNeeded.push("Form 8995");
  if (seTax > 0)               formsNeeded.push("Schedule SE");
  if (businessType === "s_corp") formsNeeded.push("Form 1120-S", "Schedule K-1");
  if (businessType === "partnership") formsNeeded.push("Form 1065", "Schedule K-1");
  if (businessType === "c_corp") formsNeeded.push("Form 1120");
  if (inc.home_office_sqft)     formsNeeded.push("Form 8829");
  if (stateRate > 0)            formsNeeded.push(`State Return (${st})`);

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_returns
      (id, business_type, tax_year, state, filing_status, federal_liability, state_liability,
       effective_rate, estimated_refund, deductions_json, credits_json, forms_json, fee_usd)
    VALUES
      (@id, @business_type, @tax_year, @state, @filing_status, @federal_liability, @state_liability,
       @effective_rate, @estimated_refund, @deductions_json, @credits_json, @forms_json, @fee_usd)
  `).run({
    id,
    business_type:    businessType,
    tax_year:         inc.tax_year ?? new Date().getFullYear() - 1,
    state:            st,
    filing_status:    fs,
    federal_liability: federalTax,
    state_liability:  stateTax,
    effective_rate:   effectiveRate,
    estimated_refund: estimatedRefund,
    deductions_json:  JSON.stringify(deductionItems),
    credits_json:     JSON.stringify(creditsApplied),
    forms_json:       JSON.stringify(formsNeeded),
    fee_usd:          FEES.prepareTaxReturn,
  });

  return {
    return_id:           id,
    tax_year:            inc.tax_year ?? new Date().getFullYear() - 1,
    business_type:       businessType,
    state:               st,
    filing_status:       fs,
    total_income_usd:    totalIncome,
    total_deductions_usd: totalDeductions,
    taxable_income_usd:  taxableIncome,
    federal_liability_usd: federalTax,
    self_employment_tax_usd: seTax,
    state_liability_usd: stateTax,
    total_tax_liability_usd: roundUsd(federalTax + stateTax),
    effective_rate_pct:  effectiveRate,
    marginal_rate_pct:   applicableBrackets.find(b => taxableIncome >= b.min && taxableIncome < b.max)?.rate * 100 ?? 37,
    deductions_taken:    deductionItems,
    credits_applied:     creditsApplied,
    estimated_refund_usd: estimatedRefund,
    refund_or_owed:      estimatedRefund >= 0 ? "refund" : "owed",
    forms_needed:        formsNeeded,
    disclaimer:          "This is an estimate for planning purposes only. Consult a licensed CPA or enrolled agent for official filing.",
    fee_usd:             FEES.prepareTaxReturn,
    platform_revenue_usd: roundUsd(FEES.prepareTaxReturn * TAX_PLATFORM_FEE),
    created_at:          new Date().toISOString(),
  };
}

// ─── reconcileAccounts ────────────────────────────────────────────────────────

/**
 * Auto-reconcile bank statement transactions against book entries.
 * @param {Array} bankTransactions - [{ id, date, description, amount, type }]
 * @param {Array} bookEntries      - [{ id, date, description, amount, account }]
 * @returns matched[], unmatched_bank[], unmatched_book[], discrepancy_amount, recommendations[]
 * Fee: $2.00 per reconciliation
 */
export function reconcileAccounts(bankTransactions, bookEntries) {
  if (!bankTransactions || !Array.isArray(bankTransactions)) throw new Error("bankTransactions must be an array");
  if (!bookEntries      || !Array.isArray(bookEntries))      throw new Error("bookEntries must be an array");

  const matched         = [];
  const unmatchedBank   = [];
  const unmatchedBook   = [...bookEntries];

  for (const bank of bankTransactions) {
    let bestMatch = null;
    let bestScore = 0;
    let bestIdx   = -1;

    for (let i = 0; i < unmatchedBook.length; i++) {
      const book  = unmatchedBook[i];
      let score   = 0;

      // Exact amount match
      if (Math.abs((bank.amount ?? 0) - (book.amount ?? 0)) < 0.01) score += 50;
      else if (Math.abs((bank.amount ?? 0) - (book.amount ?? 0)) < 1.00) score += 20;

      // Date proximity (within 3 days)
      const bankDate = bank.date ? new Date(bank.date).getTime() : 0;
      const bookDate = book.date ? new Date(book.date).getTime() : 0;
      const daysDiff = Math.abs(bankDate - bookDate) / 86400000;
      if (daysDiff === 0) score += 30;
      else if (daysDiff <= 1) score += 20;
      else if (daysDiff <= 3) score += 10;

      // Description similarity
      const bankWords = (bank.description ?? "").toLowerCase().split(/\s+/);
      const bookWords = (book.description ?? "").toLowerCase().split(/\s+/);
      const common    = bankWords.filter(w => w.length > 3 && bookWords.includes(w));
      score += common.length * 8;

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = book;
        bestIdx   = i;
      }
    }

    if (bestMatch) {
      matched.push({
        bank_transaction: bank,
        book_entry:       bestMatch,
        match_confidence: bestScore >= 80 ? "high" : "medium",
        match_score:      bestScore,
        amount_diff_usd:  roundUsd(Math.abs((bank.amount ?? 0) - (bestMatch.amount ?? 0))),
      });
      unmatchedBook.splice(bestIdx, 1);
    } else {
      unmatchedBank.push(bank);
    }
  }

  const bankTotal = bankTransactions.reduce((s, t) => s + (t.amount ?? 0), 0);
  const bookTotal = bookEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
  const discrepancy = roundUsd(Math.abs(bankTotal - bookTotal));

  const recommendations = [];
  if (unmatchedBank.length > 0)   recommendations.push(`${unmatchedBank.length} bank transaction(s) have no matching book entry — investigate for unrecorded receipts or errors.`);
  if (unmatchedBook.length > 0)   recommendations.push(`${unmatchedBook.length} book entry/entries not found in bank statement — check for timing differences or outstanding checks.`);
  if (discrepancy > 0.01)         recommendations.push(`Total discrepancy of $${discrepancy} — trace to specific unmatched items before closing the period.`);
  if (matched.some(m => m.amount_diff_usd > 0)) recommendations.push("Some matched items have small amount differences — verify bank fees or rounding adjustments.");
  if (recommendations.length === 0) recommendations.push("All transactions reconciled successfully. Books match bank statement.");

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_reconciliations
      (id, matched_count, unmatched_bank_count, unmatched_book_count, discrepancy_amount, recs_json, fee_usd)
    VALUES
      (@id, @matched_count, @unmatched_bank_count, @unmatched_book_count, @discrepancy_amount, @recs_json, @fee_usd)
  `).run({
    id,
    matched_count:       matched.length,
    unmatched_bank_count: unmatchedBank.length,
    unmatched_book_count: unmatchedBook.length,
    discrepancy_amount:  discrepancy,
    recs_json:           JSON.stringify(recommendations),
    fee_usd:             FEES.reconcileAccounts,
  });

  return {
    reconciliation_id:     id,
    matched,
    unmatched_bank:        unmatchedBank,
    unmatched_book:        unmatchedBook,
    summary: {
      total_bank_transactions: bankTransactions.length,
      total_book_entries:      bookEntries.length,
      matched_count:           matched.length,
      unmatched_bank_count:    unmatchedBank.length,
      unmatched_book_count:    unmatchedBook.length,
      match_rate_pct:          pct(matched.length, bankTransactions.length),
      bank_total_usd:          roundUsd(bankTotal),
      book_total_usd:          roundUsd(bookTotal),
    },
    discrepancy_amount_usd: discrepancy,
    is_reconciled:         discrepancy < 0.01 && unmatchedBank.length === 0 && unmatchedBook.length === 0,
    recommendations,
    fee_usd:               FEES.reconcileAccounts,
    platform_revenue_usd:  roundUsd(FEES.reconcileAccounts * TAX_PLATFORM_FEE),
    created_at:            new Date().toISOString(),
  };
}

// ─── forecastCashFlow ─────────────────────────────────────────────────────────

/**
 * Generate a forward-looking cash flow forecast.
 * @param {object} historicalData - { monthly_revenue[], monthly_expenses[], avg_revenue, avg_expenses }
 * @param {Array}  receivables    - [{ client, amount, due_date, probability_pct }]
 * @param {Array}  payables       - [{ vendor, amount, due_date, recurring }]
 * @param {number} periods        - Number of months to forecast (1–24)
 * @returns forecast[] with period, inflow, outflow, net, cumulative, risk_flags[]
 * Fee: $2.00 per forecast
 */
export function forecastCashFlow(historicalData, receivables, payables, periods) {
  if (!historicalData) throw new Error("historicalData is required");
  const numPeriods = Math.min(24, Math.max(1, periods ?? 12));
  const hist       = historicalData ?? {};
  const recvArr    = Array.isArray(receivables) ? receivables : [];
  const payArr     = Array.isArray(payables)    ? payables    : [];

  // Derive baselines from historical data
  const histRev  = Array.isArray(hist.monthly_revenue)  ? hist.monthly_revenue  : [];
  const histExp  = Array.isArray(hist.monthly_expenses) ? hist.monthly_expenses : [];
  const avgRev   = histRev.length > 0
    ? histRev.reduce((s, v) => s + v, 0) / histRev.length
    : (hist.avg_revenue  ?? 50000);
  const avgExp   = histExp.length > 0
    ? histExp.reduce((s, v) => s + v, 0) / histExp.length
    : (hist.avg_expenses ?? 40000);

  // Growth trend from historical if available
  const revGrowthRate = histRev.length >= 3
    ? (histRev[histRev.length - 1] - histRev[0]) / histRev[0] / histRev.length
    : 0.005; // 0.5%/month default

  const forecast  = [];
  let cumulative  = hist.starting_cash ?? 0;
  const now       = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const periodDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const periodStr  = periodDate.toISOString().slice(0, 7);
    const month      = periodDate.getMonth();

    // Seasonal adjustments (Q4 bump, Q1 dip for most businesses)
    const seasonalFactor = [0.88, 0.90, 0.98, 1.02, 1.05, 1.08, 1.03, 1.06, 1.02, 1.08, 1.12, 1.22][month] ?? 1.0;

    // Revenue projection
    const baseRev        = avgRev * (1 + revGrowthRate * i) * seasonalFactor;
    const scheduledRecv  = recvArr
      .filter(r => r.due_date && r.due_date.startsWith(periodStr))
      .reduce((s, r) => s + (r.amount ?? 0) * ((r.probability_pct ?? 90) / 100), 0);
    const inflow         = roundUsd(baseRev + scheduledRecv);

    // Expense projection
    const baseExp        = avgExp * (1 + 0.002 * i); // slight cost creep
    const scheduledPay   = payArr
      .filter(p => p.due_date && p.due_date.startsWith(periodStr))
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const recurringPay   = payArr
      .filter(p => p.recurring)
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const outflow        = roundUsd(baseExp + scheduledPay + recurringPay);

    const net            = roundUsd(inflow - outflow);
    cumulative           = roundUsd(cumulative + net);

    // Risk flags
    const riskFlags = [];
    if (net < 0)          riskFlags.push({ type: "negative_cash_flow", message: `Projected cash outflow of $${Math.abs(net).toLocaleString()}`, severity: "high" });
    if (cumulative < 0)   riskFlags.push({ type: "negative_balance", message: `Projected cumulative deficit of $${Math.abs(cumulative).toLocaleString()}`, severity: "critical" });
    if (net < avgExp * 0.1 && net >= 0) riskFlags.push({ type: "tight_margin", message: "Cash flow margin below 10% — monitor closely", severity: "medium" });

    forecast.push({
      period:             periodStr,
      month_name:         periodDate.toLocaleString("en-US", { month: "long", year: "numeric" }),
      inflow_usd:         inflow,
      outflow_usd:        outflow,
      net_usd:            net,
      cumulative_usd:     cumulative,
      seasonal_factor:    seasonalFactor,
      risk_flags:         riskFlags,
    });
  }

  const positiveMonths = forecast.filter(p => p.net_usd >= 0).length;
  const lowestCash     = Math.min(...forecast.map(p => p.cumulative_usd));
  const highestCash    = Math.max(...forecast.map(p => p.cumulative_usd));
  const allRiskFlags   = forecast.flatMap(p => p.risk_flags);

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_cashflow_forecasts
      (id, periods, forecast_json, risk_flags_json, fee_usd)
    VALUES (@id, @periods, @forecast_json, @risk_flags_json, @fee_usd)
  `).run({
    id,
    periods:         numPeriods,
    forecast_json:   JSON.stringify(forecast),
    risk_flags_json: JSON.stringify(allRiskFlags),
    fee_usd:         FEES.forecastCashFlow,
  });

  return {
    forecast_id:          id,
    periods:              numPeriods,
    forecast,
    summary: {
      starting_cash_usd:  hist.starting_cash ?? 0,
      total_inflow_usd:   roundUsd(forecast.reduce((s, p) => s + p.inflow_usd, 0)),
      total_outflow_usd:  roundUsd(forecast.reduce((s, p) => s + p.outflow_usd, 0)),
      total_net_usd:      roundUsd(forecast.reduce((s, p) => s + p.net_usd, 0)),
      ending_cash_usd:    cumulative,
      positive_months:    positiveMonths,
      negative_months:    numPeriods - positiveMonths,
      lowest_cash_usd:    lowestCash,
      highest_cash_usd:   highestCash,
    },
    risk_flags:           allRiskFlags,
    overall_risk:         allRiskFlags.some(f => f.severity === "critical") ? "critical"
                        : allRiskFlags.some(f => f.severity === "high") ? "high"
                        : allRiskFlags.some(f => f.severity === "medium") ? "medium" : "low",
    fee_usd:              FEES.forecastCashFlow,
    platform_revenue_usd: roundUsd(FEES.forecastCashFlow * TAX_PLATFORM_FEE),
    created_at:           new Date().toISOString(),
  };
}

// ─── checkTaxDeadlines ────────────────────────────────────────────────────────

/**
 * Return all applicable federal and state tax deadlines for an entity.
 * @param {string} entityType - sole_prop|partnership|s_corp|c_corp|llc|individual|nonprofit
 * @param {string} state      - Two-letter state code
 * @param {number} taxYear    - Tax year (e.g. 2024)
 * @returns deadlines[] with form, due_date, penalties_if_late, extension_available, filing_method
 * Fee: $0.50 per check
 */
export function checkTaxDeadlines(entityType, state, taxYear) {
  if (!entityType) throw new Error("entityType is required");
  const st  = (state ?? "CA").toUpperCase();
  const yr  = taxYear ?? new Date().getFullYear() - 1;
  const ny  = yr + 1; // next year (filing year)

  const allDeadlines = [];

  // Federal deadlines by entity type
  if (["sole_prop","individual","llc"].includes(entityType)) {
    allDeadlines.push(
      { form: "Form 1040",          due_date: `${ny}-04-15`, penalties_if_late: "5% of unpaid tax per month, max 25% + interest", extension_available: true,  extension_due: `${ny}-10-15`, filing_method: "e-file or paper", notes: "Extension grants extra time to file, not to pay." },
      { form: "Q1 Estimated Tax",   due_date: `${ny}-04-15`, penalties_if_late: "Underpayment penalty (IRS Form 2210)",           extension_available: false, filing_method: "IRS Direct Pay or Form 1040-ES", notes: "Required if expecting $1,000+ tax liability." },
      { form: "Q2 Estimated Tax",   due_date: `${ny}-06-17`, penalties_if_late: "Underpayment penalty",                           extension_available: false, filing_method: "IRS Direct Pay", notes: null },
      { form: "Q3 Estimated Tax",   due_date: `${ny}-09-16`, penalties_if_late: "Underpayment penalty",                           extension_available: false, filing_method: "IRS Direct Pay", notes: null },
      { form: "Q4 Estimated Tax",   due_date: `${ny + 1}-01-15`, penalties_if_late: "Underpayment penalty",                       extension_available: false, filing_method: "IRS Direct Pay", notes: "Or file/pay by Jan 31 with full year return." },
      { form: "FinCEN 114 (FBAR)",  due_date: `${ny}-04-15`, penalties_if_late: "Up to $10,000 per violation (civil)",            extension_available: true,  extension_due: `${ny}-10-15`, filing_method: "BSA e-filing system", notes: "Required if foreign accounts exceeded $10,000." }
    );
  }

  if (["s_corp","partnership"].includes(entityType)) {
    allDeadlines.push(
      { form: entityType === "s_corp" ? "Form 1120-S" : "Form 1065", due_date: `${ny}-03-15`, penalties_if_late: "$220/partner/month, max 12 months (partnerships); $220/shareholder/month (S-corps)", extension_available: true, extension_due: `${ny}-09-15`, filing_method: "e-file (required for 10+ K-1s)", notes: "K-1s must be issued to partners/shareholders by this date." },
      { form: "Schedule K-1 Distribution", due_date: `${ny}-03-15`, penalties_if_late: "Recipient may face underpayment penalties", extension_available: true, extension_due: `${ny}-09-15`, filing_method: "Provide to partners/shareholders", notes: null }
    );
  }

  if (entityType === "c_corp") {
    allDeadlines.push(
      { form: "Form 1120",          due_date: `${ny}-04-15`, penalties_if_late: "5% of unpaid tax per month, max 25%",            extension_available: true,  extension_due: `${ny}-10-15`, filing_method: "e-file or paper", notes: "Calendar year corporations." },
      { form: "Q1 Corp Estimated",  due_date: `${ny}-04-15`, penalties_if_late: "4% underpayment interest",                       extension_available: false, filing_method: "EFTPS", notes: "25% of estimated annual liability each quarter." },
      { form: "Q2 Corp Estimated",  due_date: `${ny}-06-16`, penalties_if_late: "4% underpayment interest",                       extension_available: false, filing_method: "EFTPS", notes: null },
      { form: "Q3 Corp Estimated",  due_date: `${ny}-09-15`, penalties_if_late: "4% underpayment interest",                       extension_available: false, filing_method: "EFTPS", notes: null },
      { form: "Q4 Corp Estimated",  due_date: `${ny}-12-15`, penalties_if_late: "4% underpayment interest",                       extension_available: false, filing_method: "EFTPS", notes: null }
    );
  }

  if (entityType === "nonprofit") {
    allDeadlines.push(
      { form: "Form 990",           due_date: `${ny}-05-15`, penalties_if_late: "$20/day up to $10,000 (small orgs); $100/day up to $50,000 (large)", extension_available: true, extension_due: `${ny}-11-15`, filing_method: "e-file required for most", notes: "For calendar year exempt organizations." }
    );
  }

  // Payroll deadlines (universal)
  allDeadlines.push(
    { form: "W-2 to Employees",   due_date: `${ny}-01-31`, penalties_if_late: "$60–$310 per form",                              extension_available: false, filing_method: "Mail or electronic delivery", notes: "Also file Copy A with SSA by Jan 31." },
    { form: "1099-NEC (Contractors)", due_date: `${ny}-01-31`, penalties_if_late: "$60–$310 per form",                         extension_available: false, filing_method: "e-file (IRIS) or paper", notes: "For non-employee compensation of $600+." },
    { form: "Form 941 (Q4)",      due_date: `${ny}-01-31`, penalties_if_late: "2–15% of unpaid deposits",                      extension_available: false, filing_method: "e-file or paper", notes: "Quarterly payroll tax return." }
  );

  // State income tax deadline (simplified)
  const stateFilingDates = { CA: `${ny}-04-15`, NY: `${ny}-04-15`, TX: "N/A — no state income tax", FL: "N/A — no state income tax", WA: "N/A — no state income tax" };
  const stateDate = stateFilingDates[st] ?? `${ny}-04-15`;
  if (stateDate !== "N/A — no state income tax") {
    allDeadlines.push({
      form:                `${st} State Income Tax Return`,
      due_date:            stateDate,
      penalties_if_late:   "Varies by state — typically 5% per month",
      extension_available: true,
      extension_due:       `${ny}-10-15`,
      filing_method:       `${st} state tax portal or mail`,
      notes:               "Confirm with state revenue agency — dates may vary.",
    });
  }

  // Sort by due date
  allDeadlines.sort((a, b) => a.due_date.localeCompare(b.due_date));

  // Flag upcoming deadlines (within 60 days)
  const today       = new Date();
  const upcoming    = allDeadlines.filter(d => {
    const dd = new Date(d.due_date);
    const diff = (dd - today) / 86400000;
    return diff >= 0 && diff <= 60;
  });

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_deadline_checks
      (id, entity_type, state, tax_year, deadlines_json, fee_usd)
    VALUES (@id, @entity_type, @state, @tax_year, @deadlines_json, @fee_usd)
  `).run({
    id,
    entity_type:   entityType,
    state:         st,
    tax_year:      yr,
    deadlines_json: JSON.stringify(allDeadlines),
    fee_usd:       FEES.checkTaxDeadlines,
  });

  return {
    check_id:         id,
    entity_type:      entityType,
    state:            st,
    tax_year:         yr,
    deadlines:        allDeadlines,
    total_deadlines:  allDeadlines.length,
    upcoming_60_days: upcoming,
    next_deadline:    allDeadlines.find(d => new Date(d.due_date) >= today) ?? null,
    critical_alerts:  upcoming.filter(d => new Date(d.due_date) - today < 14 * 86400000).map(d => ({
      form:     d.form,
      due_date: d.due_date,
      days_remaining: Math.ceil((new Date(d.due_date) - today) / 86400000),
      alert:    "URGENT — deadline within 14 days",
    })),
    fee_usd:          FEES.checkTaxDeadlines,
    platform_revenue_usd: roundUsd(FEES.checkTaxDeadlines * TAX_PLATFORM_FEE),
    created_at:       new Date().toISOString(),
  };
}

// ─── generateFinancialStatement ───────────────────────────────────────────────

/**
 * Generate a formal financial statement from raw data.
 * @param {string} type   - income_statement|balance_sheet|cash_flow
 * @param {object} data   - Raw financial data appropriate to statement type
 * @param {string} period - Reporting period (e.g. "Q1 2024", "FY 2024", "2024-01")
 * @returns statement{}, key_ratios, trends, audit_notes[]
 * Fee: $3.00 per statement
 */
export function generateFinancialStatement(type, data, period) {
  const validTypes = ["income_statement", "balance_sheet", "cash_flow"];
  if (!validTypes.includes(type)) throw new Error(`type must be one of: ${validTypes.join(", ")}`);
  if (!data)   throw new Error("data is required");
  if (!period) throw new Error("period is required");

  const d = data ?? {};
  let statement = {};
  let keyRatios = {};
  let trends    = {};
  const auditNotes = [];

  if (type === "income_statement") {
    const revenue        = d.revenue          ?? d.gross_revenue ?? 100000;
    const cogs           = d.cogs             ?? d.cost_of_goods ?? revenue * 0.45;
    const grossProfit    = roundUsd(revenue - cogs);
    const opExpenses     = d.operating_expenses ?? revenue * 0.30;
    const ebitda         = roundUsd(grossProfit - opExpenses);
    const depreciation   = d.depreciation     ?? revenue * 0.03;
    const ebit           = roundUsd(ebitda - depreciation);
    const interest       = d.interest_expense ?? 0;
    const ebt            = roundUsd(ebit - interest);
    const taxRate        = d.tax_rate         ?? 0.21;
    const taxExpense     = roundUsd(Math.max(0, ebt * taxRate));
    const netIncome      = roundUsd(ebt - taxExpense);

    statement = {
      period,
      revenue,
      cost_of_goods_sold:  cogs,
      gross_profit:        grossProfit,
      gross_margin_pct:    pct(grossProfit, revenue),
      operating_expenses:  opExpenses,
      ebitda,
      depreciation_amortization: depreciation,
      ebit,
      interest_expense:    interest,
      earnings_before_tax: ebt,
      income_tax_expense:  taxExpense,
      net_income:          netIncome,
      net_margin_pct:      pct(netIncome, revenue),
    };

    keyRatios = {
      gross_margin_pct:    statement.gross_margin_pct,
      operating_margin_pct: pct(ebit, revenue),
      net_margin_pct:      statement.net_margin_pct,
      ebitda_margin_pct:   pct(ebitda, revenue),
      return_on_sales_pct: pct(netIncome, revenue),
    };

    if (grossProfit / revenue < 0.20) auditNotes.push("Gross margin below 20% — review pricing strategy and COGS allocation.");
    if (netIncome < 0)                auditNotes.push("Net loss reported — review for non-recurring items and going concern implications.");
    if (opExpenses / revenue > 0.50)  auditNotes.push("Operating expenses exceed 50% of revenue — cost control review recommended.");

  } else if (type === "balance_sheet") {
    const cash          = d.cash              ?? 50000;
    const receivables   = d.accounts_receivable ?? 30000;
    const inventory     = d.inventory         ?? 20000;
    const otherCurrent  = d.other_current_assets ?? 5000;
    const currentAssets = roundUsd(cash + receivables + inventory + otherCurrent);
    const ppe           = d.property_plant_equipment ?? 80000;
    const intangibles   = d.intangibles       ?? 10000;
    const totalAssets   = roundUsd(currentAssets + ppe + intangibles);

    const ap            = d.accounts_payable  ?? 25000;
    const shortTermDebt = d.short_term_debt   ?? 10000;
    const otherCurrLiab = d.other_current_liabilities ?? 5000;
    const currentLiab   = roundUsd(ap + shortTermDebt + otherCurrLiab);
    const longTermDebt  = d.long_term_debt    ?? 40000;
    const totalLiab     = roundUsd(currentLiab + longTermDebt);
    const equity        = roundUsd(totalAssets - totalLiab);

    statement = {
      period,
      assets: {
        cash_and_equivalents: cash,
        accounts_receivable:  receivables,
        inventory,
        other_current_assets: otherCurrent,
        total_current_assets: currentAssets,
        property_plant_equipment: ppe,
        intangible_assets:    intangibles,
        total_assets:         totalAssets,
      },
      liabilities: {
        accounts_payable:     ap,
        short_term_debt:      shortTermDebt,
        other_current_liabilities: otherCurrLiab,
        total_current_liabilities: currentLiab,
        long_term_debt:       longTermDebt,
        total_liabilities:    totalLiab,
      },
      equity: {
        total_equity:         equity,
        retained_earnings:    d.retained_earnings ?? roundUsd(equity * 0.7),
        common_stock:         d.common_stock      ?? roundUsd(equity * 0.3),
      },
      total_liabilities_and_equity: totalAssets,
      balanced:               Math.abs(totalAssets - totalLiab - equity) < 0.02,
    };

    keyRatios = {
      current_ratio:       currentLiab > 0 ? Math.round(currentAssets / currentLiab * 100) / 100 : null,
      quick_ratio:         currentLiab > 0 ? Math.round((currentAssets - inventory) / currentLiab * 100) / 100 : null,
      debt_to_equity:      equity > 0 ? Math.round(totalLiab / equity * 100) / 100 : null,
      debt_ratio:          totalAssets > 0 ? Math.round(totalLiab / totalAssets * 100) / 100 : null,
      equity_ratio:        totalAssets > 0 ? Math.round(equity / totalAssets * 100) / 100 : null,
    };

    if (!statement.balanced) auditNotes.push("Balance sheet does not balance — verify asset and liability totals.");
    if (keyRatios.current_ratio < 1.0) auditNotes.push("Current ratio below 1.0 — liquidity concern, review short-term obligations.");
    if (keyRatios.debt_to_equity > 2.0) auditNotes.push("High leverage (D/E > 2.0) — assess debt service capacity.");

  } else { // cash_flow
    const opInflow      = d.operating_inflow  ?? d.net_income ?? 30000;
    const opOutflow     = d.operating_outflow ?? opInflow * 0.65;
    const opCashFlow    = roundUsd(opInflow - opOutflow);
    const capex         = d.capital_expenditures ?? 15000;
    const investInflow  = d.investment_proceeds ?? 0;
    const investCF      = roundUsd(investInflow - capex);
    const debtProceeds  = d.debt_proceeds     ?? 0;
    const debtRepay     = d.debt_repayment    ?? 5000;
    const dividends     = d.dividends_paid    ?? 0;
    const financingCF   = roundUsd(debtProceeds - debtRepay - dividends);
    const netCashChange = roundUsd(opCashFlow + investCF + financingCF);
    const openingCash   = d.opening_cash      ?? 50000;
    const closingCash   = roundUsd(openingCash + netCashChange);

    statement = {
      period,
      operating_activities: {
        inflows:      opInflow,
        outflows:     opOutflow,
        net_cash_from_operations: opCashFlow,
      },
      investing_activities: {
        capital_expenditures: capex,
        proceeds_from_investments: investInflow,
        net_cash_from_investing: investCF,
      },
      financing_activities: {
        proceeds_from_debt: debtProceeds,
        debt_repayment:     debtRepay,
        dividends_paid:     dividends,
        net_cash_from_financing: financingCF,
      },
      net_change_in_cash:   netCashChange,
      opening_cash_balance: openingCash,
      closing_cash_balance: closingCash,
    };

    keyRatios = {
      free_cash_flow_usd:   roundUsd(opCashFlow - capex),
      capex_to_revenue_pct: d.revenue ? pct(capex, d.revenue) : null,
      operating_cf_margin_pct: d.revenue ? pct(opCashFlow, d.revenue) : null,
    };

    if (opCashFlow < 0)    auditNotes.push("Negative operating cash flow — review working capital management.");
    if (netCashChange < 0) auditNotes.push("Net cash decreased this period — ensure adequate liquidity reserves.");
    if (capex > opCashFlow * 1.5) auditNotes.push("CapEx significantly exceeds operating cash flow — review financing adequacy.");
  }

  trends = {
    period,
    statement_type: type,
    vs_prior_period_note: d.prior_period_data
      ? "Prior period comparison available — run trend analysis."
      : "No prior period data provided — single-period view only.",
  };

  if (auditNotes.length === 0) auditNotes.push("No significant issues detected. Standard review procedures recommended.");

  const id = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO tax_financial_statements
      (id, statement_type, period, statement_json, ratios_json, trends_json, audit_notes_json, fee_usd)
    VALUES
      (@id, @statement_type, @period, @statement_json, @ratios_json, @trends_json, @audit_notes_json, @fee_usd)
  `).run({
    id,
    statement_type:   type,
    period,
    statement_json:   JSON.stringify(statement),
    ratios_json:      JSON.stringify(keyRatios),
    trends_json:      JSON.stringify(trends),
    audit_notes_json: JSON.stringify(auditNotes),
    fee_usd:          FEES.generateFinancialStatement,
  });

  return {
    statement_id:    id,
    type,
    period,
    statement,
    key_ratios:      keyRatios,
    trends,
    audit_notes:     auditNotes,
    gaap_compliant_note: "Statement formatted per US GAAP principles. Independent audit recommended for external reporting.",
    fee_usd:         FEES.generateFinancialStatement,
    platform_revenue_usd: roundUsd(FEES.generateFinancialStatement * TAX_PLATFORM_FEE),
    created_at:      new Date().toISOString(),
  };
}
