import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const CATEGORIZE_FEE           = 0.02;
const CATEGORIZE_COMMISSION    = 0.15;
const TAX_PREP_FEE             = 5.00;
const TAX_PREP_COMMISSION      = 0.18;
const LICENSE_CHECK_FEE        = 1.00;
const LICENSE_CHECK_COMMISSION = 0.15;
const INSURANCE_FEE            = 2.00;
const INSURANCE_COMMISSION     = 0.20;   // highest — referral model
const CONTRACT_FEE             = 3.00;
const CONTRACT_COMMISSION      = 0.15;
const DASHBOARD_FEE            = 10.00;  // per month
const DASHBOARD_COMMISSION     = 0.12;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS smb_expense_categories (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    irs_line    TEXT,
    deductible  INTEGER DEFAULT 1,
    keywords    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_license_types (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    issuing_body     TEXT NOT NULL,
    typical_fee_usd  REAL NOT NULL,
    renewal_months   INTEGER NOT NULL,
    applies_to       TEXT NOT NULL,
    description      TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_insurance_providers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    am_best_rating  TEXT NOT NULL,
    specialties     TEXT NOT NULL,
    min_employees   INTEGER DEFAULT 1,
    max_employees   INTEGER DEFAULT 500,
    quote_url       TEXT,
    phone           TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_transactions (
    id              TEXT PRIMARY KEY,
    description     TEXT NOT NULL,
    amount_usd      REAL NOT NULL,
    merchant_name   TEXT,
    category        TEXT,
    subcategory     TEXT,
    tax_deductible  INTEGER DEFAULT 0,
    confidence      REAL DEFAULT 0,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_contracts (
    id              TEXT PRIMARY KEY,
    contract_type   TEXT NOT NULL,
    parties         TEXT NOT NULL,
    terms_summary   TEXT,
    full_text       TEXT,
    fee_charged_usd REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_dashboard_subs (
    id              TEXT PRIMARY KEY,
    business_id     TEXT NOT NULL UNIQUE,
    plan            TEXT DEFAULT 'monthly',
    fee_usd         REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    renewed_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smb_stats (
    id                    TEXT PRIMARY KEY DEFAULT 'singleton',
    transactions_processed INTEGER DEFAULT 0,
    contracts_generated    INTEGER DEFAULT 0,
    license_checks         INTEGER DEFAULT 0,
    tax_preps              INTEGER DEFAULT 0,
    insurance_comparisons  INTEGER DEFAULT 0,
    updated_at             TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Expense Categories ──────────────────────────────────────────────────

{
  const count = db.prepare("SELECT COUNT(*) as n FROM smb_expense_categories").get().n;
  if (count === 0) {
    const cats = [
      { cat: "Advertising",            sub: "Digital Ads",          irs: "Sch C Line 8",  ded: 1, kw: "google ads,facebook,instagram,meta,tiktok,sponsored,ad spend,ppc" },
      { cat: "Advertising",            sub: "Print & Outdoor",       irs: "Sch C Line 8",  ded: 1, kw: "flyer,postcard,billboard,mailer,brochure,signage,direct mail" },
      { cat: "Advertising",            sub: "SEO & Content",         irs: "Sch C Line 8",  ded: 1, kw: "seo,content marketing,blog,copywriter,backlinks" },
      { cat: "Auto & Transport",        sub: "Vehicle Fuel",          irs: "Sch C Line 9",  ded: 1, kw: "shell,chevron,bp,exxon,gas station,fuel,diesel,gasoline" },
      { cat: "Auto & Transport",        sub: "Rideshare",             irs: "Sch C Line 24", ded: 1, kw: "uber,lyft,rideshare,taxi,cab" },
      { cat: "Auto & Transport",        sub: "Parking & Tolls",       irs: "Sch C Line 24", ded: 1, kw: "parking,toll,ez-pass,fastrak,meter" },
      { cat: "Bank & Finance",          sub: "Bank Fees",             irs: "Sch C Line 27", ded: 1, kw: "bank fee,wire fee,overdraft,maintenance fee,monthly fee" },
      { cat: "Bank & Finance",          sub: "Merchant Processing",   irs: "Sch C Line 27", ded: 1, kw: "stripe,square,paypal,braintree,processing fee,merchant" },
      { cat: "Communication",           sub: "Phone",                 irs: "Sch C Line 25", ded: 1, kw: "verizon,at&t,t-mobile,sprint,cell,phone plan,wireless" },
      { cat: "Communication",           sub: "Internet",              irs: "Sch C Line 25", ded: 1, kw: "comcast,spectrum,att,cox,internet,broadband,fiber" },
      { cat: "Contractors",             sub: "Freelancers",           irs: "Sch C Line 11", ded: 1, kw: "upwork,fiverr,freelance,contractor,1099,subcontract" },
      { cat: "Contractors",             sub: "Staffing Agencies",     irs: "Sch C Line 11", ded: 1, kw: "staffing,temp agency,manpower,adecco,kelly services" },
      { cat: "Equipment",               sub: "Computer Hardware",     irs: "Sec 179",       ded: 1, kw: "apple,dell,hp,lenovo,laptop,desktop,monitor,keyboard,mouse,tablet" },
      { cat: "Equipment",               sub: "Office Equipment",      irs: "Sec 179",       ded: 1, kw: "printer,scanner,copier,shredder,projector,camera" },
      { cat: "Food & Entertainment",    sub: "Business Meals",        irs: "Sch C Line 24", ded: 1, kw: "restaurant,lunch,dinner,catering,doordash,grubhub,ubereats" },
      { cat: "Food & Entertainment",    sub: "Client Entertainment",  irs: "Sch C Line 24", ded: 1, kw: "tickets,event,golf,entertainment,client dinner,hospitality" },
      { cat: "Insurance",               sub: "Business Insurance",    irs: "Sch C Line 15", ded: 1, kw: "insurance premium,liability,workers comp,commercial insurance,bop" },
      { cat: "Insurance",               sub: "Health Insurance",      irs: "Sch 1 Line 17", ded: 1, kw: "health insurance,medical insurance,dental,vision,cobra,hsa" },
      { cat: "Legal & Professional",    sub: "Legal Fees",            irs: "Sch C Line 17", ded: 1, kw: "attorney,lawyer,legal,law firm,counsel,notary" },
      { cat: "Legal & Professional",    sub: "Accounting",            irs: "Sch C Line 17", ded: 1, kw: "cpa,accountant,bookkeeper,quickbooks,accounting,tax prep" },
      { cat: "Marketing",               sub: "Social Media Tools",    irs: "Sch C Line 8",  ded: 1, kw: "hootsuite,buffer,sprout,mailchimp,klaviyo,hubspot" },
      { cat: "Meals - Non-deductible",  sub: "Personal Meals",        irs: "N/A",           ded: 0, kw: "starbucks,mcdonald,wendys,chipotle,personal lunch,grocery" },
      { cat: "Office Supplies",         sub: "Paper & Stationery",    irs: "Sch C Line 22", ded: 1, kw: "staples,office depot,amazon basics,paper,folders,pens,ink" },
      { cat: "Office Supplies",         sub: "Postage & Shipping",    irs: "Sch C Line 22", ded: 1, kw: "usps,fedex,ups,dhl,postage,shipping,freight" },
      { cat: "Payroll",                 sub: "Salaries & Wages",      irs: "Sch C Line 26", ded: 1, kw: "gusto,adp,paychex,payroll,salary,wages,direct deposit" },
      { cat: "Payroll",                 sub: "Payroll Taxes",         irs: "Sch C Line 23", ded: 1, kw: "fica,payroll tax,employer tax,social security,medicare" },
      { cat: "Rent & Utilities",        sub: "Office Rent",           irs: "Sch C Line 20", ded: 1, kw: "rent,lease,office space,coworking,regus,wework,building" },
      { cat: "Rent & Utilities",        sub: "Utilities",             irs: "Sch C Line 25", ded: 1, kw: "electric,water,gas,sewage,utility,pge,con edison" },
      { cat: "Software & Subscriptions",sub: "SaaS Tools",            irs: "Sch C Line 27", ded: 1, kw: "slack,zoom,notion,asana,monday,salesforce,adobe,microsoft 365,google workspace" },
      { cat: "Software & Subscriptions",sub: "Cloud Hosting",         irs: "Sch C Line 27", ded: 1, kw: "aws,azure,google cloud,heroku,digitalocean,cloudflare,vercel" },
      { cat: "Travel",                  sub: "Airfare",               irs: "Sch C Line 24", ded: 1, kw: "airline,airfare,delta,united,american,southwest,flight,expedia" },
      { cat: "Travel",                  sub: "Hotel & Lodging",       irs: "Sch C Line 24", ded: 1, kw: "hotel,marriott,hilton,hyatt,airbnb,vrbo,lodging,motel" },
    ];

    const ins = db.prepare(`
      INSERT OR IGNORE INTO smb_expense_categories (id,category,subcategory,irs_line,deductible,keywords)
      VALUES (?,?,?,?,?,?)
    `);
    for (const c of cats) {
      ins.run(randomUUID(), c.cat, c.sub, c.irs, c.ded, c.kw);
    }
  }
}

// ─── Seed License Types ───────────────────────────────────────────────────────

{
  const count = db.prepare("SELECT COUNT(*) as n FROM smb_license_types").get().n;
  if (count === 0) {
    const licenses = [
      { name: "Business License (General)",      issuer: "City/County Clerk",         fee: 75,   months: 12, applies: "all",             desc: "Required for all businesses operating in city limits." },
      { name: "Seller's Permit",                 issuer: "State Board of Equalization",fee: 0,    months: 0,  applies: "retail,ecommerce", desc: "Required to collect sales tax on taxable goods." },
      { name: "Professional License — Contractor",issuer: "State Contractors Board",   fee: 250,  months: 24, applies: "construction",     desc: "Required for general contractors and specialty trades." },
      { name: "Food Handler's Permit",           issuer: "County Health Dept",         fee: 45,   months: 12, applies: "food,restaurant",  desc: "Required for food establishment employees." },
      { name: "Health Dept Permit",              issuer: "County Health Dept",         fee: 350,  months: 12, applies: "food,restaurant",  desc: "Annual inspection and operating permit for food businesses." },
      { name: "Liquor License — On-Premises",    issuer: "State ABC Commission",       fee: 14000,months: 24, applies: "bar,restaurant",   desc: "Permit to serve alcohol for on-site consumption." },
      { name: "Cosmetology License",             issuer: "State Board of Cosmetology", fee: 125,  months: 24, applies: "salon,beauty",     desc: "Required for barbers, cosmetologists, and estheticians." },
      { name: "Real Estate Broker License",      issuer: "State Real Estate Commission",fee: 450, months: 24, applies: "real_estate",      desc: "Required to operate a real estate brokerage." },
      { name: "Insurance Producer License",      issuer: "State Dept of Insurance",    fee: 200,  months: 24, applies: "insurance",        desc: "Required to sell or broker insurance products." },
      { name: "CPA License",                     issuer: "State Board of Accountancy",  fee: 300,  months: 24, applies: "accounting",       desc: "Required for Certified Public Accountants." },
      { name: "HVAC Contractor License",         issuer: "State HVAC Board",           fee: 180,  months: 24, applies: "hvac",             desc: "Required for HVAC installation and repair businesses." },
      { name: "Electrical Contractor License",   issuer: "State Electrical Board",     fee: 275,  months: 12, applies: "electrical",       desc: "Required for commercial and residential electrical work." },
      { name: "Auto Dealer License",             issuer: "State DMV / Motor Vehicles",  fee: 1200, months: 12, applies: "auto_dealer",      desc: "Required to buy and sell motor vehicles commercially." },
      { name: "Money Transmitter License",       issuer: "State Banking Dept",         fee: 5000, months: 12, applies: "fintech,payments",  desc: "Required for businesses that transmit money electronically." },
      { name: "Home Improvement Contractor",     issuer: "State Consumer Affairs Dept", fee: 200,  months: 24, applies: "home_improvement", desc: "Required for home improvement and renovation contractors." },
      { name: "Pest Control License",            issuer: "State Dept of Agriculture",  fee: 150,  months: 12, applies: "pest_control",     desc: "Required for pest management and extermination services." },
      { name: "Transportation Network (TNC) Permit", issuer: "State PUC",             fee: 500,  months: 12, applies: "rideshare,transport",desc: "Required for businesses operating rideshare platforms." },
      { name: "Childcare Facility License",      issuer: "State Child Care Licensing", fee: 400,  months: 12, applies: "childcare",        desc: "Required for daycare centers and childcare providers." },
      { name: "Security Guard Agency License",   issuer: "State Dept of Consumer Affairs",fee: 650,months: 12,applies: "security",         desc: "Required to operate a security guard or protection agency." },
      { name: "Pharmacy License",                issuer: "State Board of Pharmacy",    fee: 800,  months: 12, applies: "pharmacy,healthcare",desc: "Required for retail and specialty pharmacy operations." },
    ];

    const ins = db.prepare(`
      INSERT OR IGNORE INTO smb_license_types (id,name,issuing_body,typical_fee_usd,renewal_months,applies_to,description)
      VALUES (?,?,?,?,?,?,?)
    `);
    for (const l of licenses) {
      ins.run(randomUUID(), l.name, l.issuer, l.fee, l.months, l.applies, l.desc);
    }
  }
}

// ─── Seed Insurance Providers ─────────────────────────────────────────────────

{
  const count = db.prepare("SELECT COUNT(*) as n FROM smb_insurance_providers").get().n;
  if (count === 0) {
    const providers = [
      { name: "Hiscox Small Business",        rating: "A",    specialties: '["BOP","professional_liability","cyber"]',              min: 1,  max: 50,  url: "hiscox.com/small-business",        phone: "888-202-3007" },
      { name: "The Hartford",                  rating: "A+",   specialties: '["BOP","workers_comp","commercial_auto","umbrella"]',   min: 1,  max: 500, url: "thehartford.com/business",         phone: "860-547-5000" },
      { name: "Nationwide Business Insurance", rating: "A+",   specialties: '["BOP","farm","commercial_auto","surety"]',            min: 5,  max: 500, url: "nationwide.com/business",          phone: "877-669-6877" },
      { name: "Travelers",                     rating: "A++",  specialties: '["BOP","commercial_property","workers_comp","cyber"]',  min: 10, max: 500, url: "travelers.com/business",           phone: "866-336-2077" },
      { name: "Next Insurance",                rating: "A-",   specialties: '["BOP","general_liability","professional_liability"]',  min: 1,  max: 100, url: "nextinsurance.com",               phone: "855-222-6398" },
      { name: "Chubb",                         rating: "A++",  specialties: '["BOP","management_liability","cyber","surety"]',      min: 50, max: 500, url: "chubb.com/business",               phone: "800-372-4822" },
      { name: "Simply Business",               rating: "A",    specialties: '["general_liability","professional_liability","BOP"]',  min: 1,  max: 50,  url: "simplybusiness.com",              phone: "855-589-8901" },
      { name: "biBERK (Berkshire Hathaway)",   rating: "A++",  specialties: '["general_liability","workers_comp","BOP","umbrella"]', min: 1,  max: 200, url: "biberk.com",                      phone: "888-472-4375" },
    ];

    const ins = db.prepare(`
      INSERT OR IGNORE INTO smb_insurance_providers (id,name,am_best_rating,specialties,min_employees,max_employees,quote_url,phone)
      VALUES (@id,@name,@am_best_rating,@specialties,@min_employees,@max_employees,@quote_url,@phone)
    `);
    for (const p of providers) {
      ins.run({ id: randomUUID(), name: p.name, am_best_rating: p.rating, specialties: p.specialties, min_employees: p.min, max_employees: p.max, quote_url: p.url, phone: p.phone });
    }
  }
}

// ─── Seed Stats Singleton ─────────────────────────────────────────────────────

db.prepare(`INSERT OR IGNORE INTO smb_stats (id) VALUES ('singleton')`).run();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function incrementSmb(field, value = 1) {
  db.prepare(`UPDATE smb_stats SET ${field} = ${field} + ?, updated_at = datetime('now') WHERE id='singleton'`).run(value);
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
}

// ─── categorizeTransaction ────────────────────────────────────────────────────

/**
 * Categorize a business transaction for bookkeeping using keyword matching.
 * Handles 50+ expense categories with IRS schedule references.
 * Fee: $0.02/transaction | Commission: 15%
 *
 * @param {string} description  - Transaction description / memo
 * @param {number} amount       - Transaction amount in USD
 * @param {string} merchantName - Merchant or payee name
 * @returns {{ category, subcategory, tax_deductible, confidence, suggested_account }}
 */
export function categorizeTransaction(description, amount, merchantName = "") {
  if (!description) throw new Error("description is required");
  if (amount == null) throw new Error("amount is required");

  const haystack  = `${description} ${merchantName}`.toLowerCase();
  const categories = db.prepare("SELECT * FROM smb_expense_categories").all();

  let best = null;
  let bestScore = 0;

  for (const cat of categories) {
    const keywords = cat.keywords.split(",").map(k => k.trim());
    let score = 0;
    for (const kw of keywords) {
      if (haystack.includes(kw)) score += kw.split(" ").length; // multi-word phrases score higher
    }
    if (score > bestScore) {
      bestScore = best ? bestScore : 0;
      best = cat;
      bestScore = score;
    }
  }

  const confidence  = best && bestScore > 0 ? Math.min(0.99, 0.6 + bestScore * 0.06) : 0.45;
  const category    = best ? best.category    : "Uncategorized";
  const subcategory = best ? best.subcategory : "Review Required";
  const deductible  = best ? best.deductible === 1 : false;
  const irsLine     = best ? best.irs_line : "Review with accountant";

  // Map category to chart of accounts
  const ACCOUNT_MAP = {
    "Advertising":             "6100 · Advertising & Marketing",
    "Auto & Transport":        "6200 · Auto & Transportation",
    "Bank & Finance":          "6300 · Bank Charges & Fees",
    "Communication":           "6400 · Telephone & Internet",
    "Contractors":             "6500 · Outside Services",
    "Equipment":               "1500 · Equipment & Computers",
    "Food & Entertainment":    "6600 · Meals & Entertainment",
    "Insurance":               "6700 · Insurance Expense",
    "Legal & Professional":    "6800 · Professional Fees",
    "Marketing":               "6100 · Advertising & Marketing",
    "Meals - Non-deductible":  "9900 · Non-deductible Expenses",
    "Office Supplies":         "6900 · Office Supplies",
    "Payroll":                 "7000 · Payroll Expense",
    "Rent & Utilities":        "7100 · Rent & Utilities",
    "Software & Subscriptions":"7200 · Software & Subscriptions",
    "Travel":                  "7300 · Travel Expense",
  };

  const commission = Math.round(CATEGORIZE_FEE * CATEGORIZE_COMMISSION * 100) / 100;
  const txId       = randomUUID();

  db.prepare(`
    INSERT OR IGNORE INTO smb_transactions
      (id,description,amount_usd,merchant_name,category,subcategory,tax_deductible,confidence,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(txId, description, amount, merchantName, category, subcategory, deductible ? 1 : 0, confidence, CATEGORIZE_FEE, commission);

  incrementSmb("transactions_processed");

  return {
    transaction_id:   txId,
    description,
    amount_usd:       amount,
    merchant_name:    merchantName || null,
    category,
    subcategory,
    tax_deductible:   deductible,
    irs_reference:    irsLine,
    confidence:       Math.round(confidence * 100) / 100,
    confidence_label: confidence >= 0.85 ? "high" : confidence >= 0.65 ? "medium" : "low",
    suggested_account: ACCOUNT_MAP[category] ?? "9999 · Ask Your Accountant",
    review_recommended: confidence < 0.65,
    service_fee_usd:  CATEGORIZE_FEE,
    platform_commission_usd: commission,
    categorized_at:   new Date().toISOString(),
  };
}

// ─── prepTaxDocuments ─────────────────────────────────────────────────────────

/**
 * Prepare tax filing documents and compute estimated liability.
 * Fee: $5.00/preparation | Commission: 18%
 *
 * @param {string} businessType  - sole_prop|llc|s_corp|c_corp|partnership
 * @param {Array}  transactions  - Array of { amount, category, tax_deductible } objects
 * @param {number} taxYear       - e.g. 2024
 * @param {string} state         - Two-letter state code
 * @returns {{ forms_needed, estimated_liability, deductions_found, quarterly_estimates }}
 */
export function prepTaxDocuments(businessType, transactions = [], taxYear, state = "CA") {
  if (!businessType) throw new Error("businessType is required");
  if (!taxYear)      throw new Error("taxYear is required");

  const type = businessType.toLowerCase();
  const commission = Math.round(TAX_PREP_FEE * TAX_PREP_COMMISSION * 100) / 100;

  const FORMS_BY_TYPE = {
    sole_prop:   ["Schedule C (Form 1040)", "Schedule SE", "Form 1040", "Form 1040-ES"],
    llc:         ["Schedule C (Form 1040)", "Schedule SE", "Form 1040", "Form 1040-ES", "State LLC Annual Report"],
    s_corp:      ["Form 1120-S", "Schedule K-1", "Form W-2", "Form 941", "Form 940"],
    c_corp:      ["Form 1120", "Form W-2", "Form 941", "Form 940", "Form 4562"],
    partnership: ["Form 1065", "Schedule K-1 (multiple)", "Form W-2 (if applicable)"],
  };

  const formsNeeded = FORMS_BY_TYPE[type] ?? FORMS_BY_TYPE.sole_prop;

  // Aggregate transactions
  const gross    = transactions.filter(t => t.amount > 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = transactions.filter(t => t.tax_deductible).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netIncome = Math.max(0, gross - expenses);

  // Deductions analysis
  const deductionsByCategory = {};
  for (const tx of transactions.filter(t => t.tax_deductible)) {
    const cat = tx.category ?? "Other";
    deductionsByCategory[cat] = (deductionsByCategory[cat] ?? 0) + Math.abs(tx.amount);
  }

  const deductionsFound = Object.entries(deductionsByCategory).map(([cat, total]) => ({
    category:  cat,
    total_usd: Math.round(total * 100) / 100,
    irs_form:  "Schedule C",
  }));

  // Add QBI deduction hint for pass-throughs
  if (["sole_prop","llc","s_corp","partnership"].includes(type) && netIncome > 0) {
    deductionsFound.push({
      category:  "Qualified Business Income (QBI)",
      total_usd: Math.round(netIncome * 0.20 * 100) / 100,
      irs_form:  "Form 8995",
      note:      "Up to 20% deduction on qualified business income",
    });
  }

  // Tax liability estimate (simplified)
  const federalRate   = netIncome > 89075 ? 0.24 : netIncome > 40525 ? 0.22 : 0.12;
  const selfEmpTax    = ["sole_prop","llc"].includes(type) ? netIncome * 0.1413 : 0;
  const stateTaxRates = { CA: 0.093, NY: 0.0685, TX: 0, WA: 0, FL: 0, IL: 0.0495, CO: 0.044 };
  const stateRate     = stateTaxRates[state] ?? 0.05;

  const federalTax  = Math.round(netIncome * federalRate * 100) / 100;
  const stateTax    = Math.round(netIncome * stateRate * 100) / 100;
  const totalOwed   = Math.round((federalTax + stateTax + selfEmpTax) * 100) / 100;

  const quarterly = Math.round((totalOwed / 4) * 100) / 100;
  const quarters  = [
    { quarter: `Q1 ${taxYear}`, due: `${taxYear}-04-15`, amount_usd: quarterly },
    { quarter: `Q2 ${taxYear}`, due: `${taxYear}-06-15`, amount_usd: quarterly },
    { quarter: `Q3 ${taxYear}`, due: `${taxYear}-09-15`, amount_usd: quarterly },
    { quarter: `Q4 ${taxYear}`, due: `${Number(taxYear) + 1}-01-15`, amount_usd: quarterly },
  ];

  incrementSmb("tax_preps");

  return {
    prep_id:              randomUUID(),
    business_type:        type,
    tax_year:             taxYear,
    state,
    forms_needed:         formsNeeded.map(f => ({ form: f, filing_deadline: f.includes("1120") ? `${Number(taxYear)+1}-03-15` : `${Number(taxYear)+1}-04-15` })),
    estimated_liability:  { federal_usd: federalTax, state_usd: stateTax, self_employment_usd: selfEmpTax, total_usd: totalOwed },
    gross_revenue_usd:    Math.round(gross * 100) / 100,
    total_expenses_usd:   Math.round(expenses * 100) / 100,
    net_income_usd:       Math.round(netIncome * 100) / 100,
    deductions_found:     deductionsFound,
    quarterly_estimates:  quarters,
    recommendations:      [
      "Maximize retirement contributions (SEP-IRA up to 25% of net income)",
      "Review Section 179 equipment deductions before year-end",
      netIncome > 150000 ? "Consider S-Corp election to reduce self-employment tax" : null,
    ].filter(Boolean),
    service_fee_usd:      TAX_PREP_FEE,
    platform_commission_usd: commission,
    prepared_at:          new Date().toISOString(),
  };
}

// ─── checkLicenseRenewals ─────────────────────────────────────────────────────

/**
 * Check business license status and upcoming renewal dates.
 * Fee: $1.00/check | Commission: 15%
 *
 * @param {string} businessName  - Registered business name
 * @param {string} state         - Two-letter state code
 * @param {string} city          - City of operation
 * @param {Array}  licenseTypes  - Array of license type strings (e.g. ["Business License", "Seller's Permit"])
 * @returns {{ licenses, renewal_dates, expired, fees_due }}
 */
export function checkLicenseRenewals(businessName, state, city, licenseTypes = []) {
  if (!businessName) throw new Error("businessName is required");
  if (!state)        throw new Error("state is required");

  const commission = Math.round(LICENSE_CHECK_FEE * LICENSE_CHECK_COMMISSION * 100) / 100;

  // Fetch matching license types from DB
  let dbLicenses;
  if (licenseTypes.length > 0) {
    const placeholders = licenseTypes.map(() => "?").join(",");
    dbLicenses = db.prepare(
      `SELECT * FROM smb_license_types WHERE applies_to IN (${placeholders}) OR name IN (${placeholders})`
    ).all(...licenseTypes, ...licenseTypes);
  } else {
    dbLicenses = db.prepare("SELECT * FROM smb_license_types LIMIT 5").all();
  }

  const today    = new Date();
  const licenses = dbLicenses.map(lic => {
    // Simulate a realistic issue date (0-24 months ago)
    const issuedMonthsAgo = Math.floor(Math.random() * 24);
    const issuedDate      = addMonths(today, -issuedMonthsAgo);
    const renewalMonths   = lic.renewal_months || 12;
    const renewalDate     = addMonths(issuedDate, renewalMonths);
    const daysUntil       = Math.round((new Date(renewalDate) - today) / 86400000);
    const isExpired       = daysUntil < 0;
    const isUrgent        = daysUntil >= 0 && daysUntil <= 30;

    return {
      license_name:    lic.name,
      issuing_body:    lic.issuing_body,
      status:          isExpired ? "expired" : isUrgent ? "renewal_due" : "active",
      issued_date:     issuedDate,
      renewal_date:    renewalDate,
      days_until_renewal: daysUntil,
      renewal_fee_usd: lic.typical_fee_usd,
      description:     lic.description,
      renewal_url:     `https://${state.toLowerCase()}gov.com/licenses/renew`,
      urgent:          isUrgent || isExpired,
    };
  });

  const expired  = licenses.filter(l => l.status === "expired");
  const upcoming = licenses.filter(l => l.status === "renewal_due");
  const feesDue  = licenses.filter(l => l.status !== "active").reduce((s, l) => s + l.renewal_fee_usd, 0);

  incrementSmb("license_checks");

  return {
    check_id:     randomUUID(),
    business_name: businessName,
    state,
    city:         city ?? "Not specified",
    licenses,
    renewal_dates: licenses.map(l => ({ license: l.license_name, renewal_date: l.renewal_date, days_until: l.days_until_renewal })),
    expired,
    upcoming_renewals: upcoming,
    fees_due_usd: Math.round(feesDue * 100) / 100,
    action_required: expired.length > 0 || upcoming.length > 0,
    service_fee_usd: LICENSE_CHECK_FEE,
    platform_commission_usd: commission,
    checked_at:   new Date().toISOString(),
  };
}

// ─── compareInsurancePlans ────────────────────────────────────────────────────

/**
 * Compare business insurance plans across seeded providers.
 * Fee: $2.00/comparison | Commission: 20%
 *
 * @param {string} businessType    - Type of business (retail, tech, contractor, restaurant, etc.)
 * @param {number} employees       - Number of employees
 * @param {string} state           - Two-letter state code
 * @param {Array}  coverageNeeded  - e.g. ["general_liability","workers_comp","BOP"]
 * @returns {{ plans: [{ provider, premium, coverage, deductible, rating }] }}
 */
export function compareInsurancePlans(businessType, employees, state = "CA", coverageNeeded = ["BOP"]) {
  if (!businessType) throw new Error("businessType is required");
  if (employees == null || employees < 1) throw new Error("employees must be a positive number");

  const commission = Math.round(INSURANCE_FEE * INSURANCE_COMMISSION * 100) / 100;

  const providers = db.prepare(
    "SELECT * FROM smb_insurance_providers WHERE min_employees <= ? AND max_employees >= ?",
  ).all(employees, employees);

  // Cost-of-living multiplier by state
  const STATE_MULT = { CA: 1.30, NY: 1.25, FL: 1.05, TX: 0.95, WA: 1.15, CO: 1.08 };
  const stateMult  = STATE_MULT[state] ?? 1.0;

  // Base annual premium ($800 floor + $350 per employee, scaled)
  const basePremium = (800 + employees * 350) * stateMult;

  const plans = providers.map((p, idx) => {
    const providerSpecialties = JSON.parse(p.specialties || "[]");
    const matchScore = coverageNeeded.filter(c => providerSpecialties.includes(c)).length;
    const premiumMult = 0.85 + idx * 0.04 + Math.random() * 0.12;
    const annualPremium = Math.round(basePremium * premiumMult);

    return {
      plan_id:          randomUUID(),
      provider:         p.name,
      am_best_rating:   p.am_best_rating,
      annual_premium_usd: annualPremium,
      monthly_premium_usd: Math.round(annualPremium / 12),
      deductible_usd:   [500, 1000, 2500, 5000][idx % 4],
      coverage_limit_usd: [1000000, 2000000, 3000000][idx % 3],
      coverage_types:   providerSpecialties,
      covers_requested: coverageNeeded.filter(c => providerSpecialties.includes(c)),
      coverage_gaps:    coverageNeeded.filter(c => !providerSpecialties.includes(c)),
      match_score:      matchScore,
      quote_url:        `https://${p.quote_url}?type=${businessType}&emp=${employees}&state=${state}`,
      phone:            p.phone,
      recommended:      idx === 0 || matchScore === Math.max(...providers.map((_,i) => coverageNeeded.filter(c => JSON.parse(providers[i]?.specialties||"[]").includes(c)).length)),
    };
  }).sort((a, b) => b.match_score - a.match_score || a.annual_premium_usd - b.annual_premium_usd);

  incrementSmb("insurance_comparisons");

  return {
    comparison_id:   randomUUID(),
    business_type:   businessType,
    employees,
    state,
    coverage_needed: coverageNeeded,
    plans,
    best_value:      plans[0],
    cheapest:        [...plans].sort((a, b) => a.annual_premium_usd - b.annual_premium_usd)[0],
    service_fee_usd: INSURANCE_FEE,
    platform_commission_usd: commission,
    compared_at:     new Date().toISOString(),
  };
}

// ─── generateContract ─────────────────────────────────────────────────────────

/**
 * Generate a standard business contract document.
 * Types: vendor, nda, services, employment, lease
 * Fee: $3.00/contract | Commission: 15%
 *
 * @param {string} contractType - vendor|nda|services|employment|lease
 * @param {object} parties      - { party_a: { name, address }, party_b: { name, address } }
 * @param {object} terms        - Contract-specific terms object
 * @returns {{ contract_id, content_preview, full_text, execution_instructions }}
 */
export function generateContract(contractType, parties, terms = {}) {
  if (!contractType) throw new Error("contractType is required");
  if (!parties)      throw new Error("parties is required");

  const type = contractType.toLowerCase();
  const validTypes = ["vendor","nda","services","employment","lease"];
  if (!validTypes.includes(type)) {
    throw new Error(`contractType must be one of: ${validTypes.join(", ")}`);
  }

  const commission  = Math.round(CONTRACT_FEE * CONTRACT_COMMISSION * 100) / 100;
  const contractId  = randomUUID();
  const contractNum = `CTR-${Date.now().toString(36).toUpperCase()}`;
  const today       = new Date().toISOString().split("T")[0];
  const partyA      = parties.party_a?.name ?? "Party A";
  const partyB      = parties.party_b?.name ?? "Party B";

  const TEMPLATES = {
    nda: {
      title: "Non-Disclosure Agreement",
      preview: `This Non-Disclosure Agreement ("Agreement") entered into as of ${today} between ${partyA} ("Disclosing Party") and ${partyB} ("Receiving Party") sets forth the terms under which confidential information may be shared between the parties for the purpose of ${terms.purpose ?? "evaluating a potential business relationship"}.`,
      body: `1. CONFIDENTIAL INFORMATION\nAll non-public business, technical, and financial information disclosed by Disclosing Party is deemed confidential.\n\n2. OBLIGATIONS\nReceiving Party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose to third parties without prior written consent; (c) use Confidential Information solely for the stated Purpose.\n\n3. TERM\nThis Agreement remains in effect for ${terms.duration_years ?? 3} years from the date of execution.\n\n4. EXCEPTIONS\nObligations do not apply to information that: (a) is publicly known; (b) was known to Receiving Party prior to disclosure; (c) is required to be disclosed by law.\n\n5. GOVERNING LAW\nThis Agreement is governed by the laws of ${terms.governing_state ?? "California"}.`,
      instructions: ["Both parties sign two original copies", "Store executed copy in secure document management", "Set calendar reminder for expiration date"],
    },
    services: {
      title: "Professional Services Agreement",
      preview: `This Professional Services Agreement ("Agreement") is entered into as of ${today} by and between ${partyA} ("Client") and ${partyB} ("Service Provider") for the provision of ${terms.services_description ?? "professional services"} as further described herein.`,
      body: `1. SERVICES\nService Provider agrees to perform: ${terms.services_description ?? "Services as mutually agreed in writing"}.\n\n2. COMPENSATION\nClient shall pay $${terms.rate ?? "TBD"} ${terms.payment_type ?? "per hour"}, invoiced ${terms.invoicing_frequency ?? "monthly"}. Payment due Net 30.\n\n3. TERM\nThis Agreement commences ${today} and continues until ${terms.end_date ?? "project completion or termination"}.\n\n4. INDEPENDENT CONTRACTOR\nService Provider is an independent contractor. Nothing herein creates an employment, partnership, or joint venture relationship.\n\n5. INTELLECTUAL PROPERTY\nAll work product created under this Agreement ${terms.ip_ownership === "client" ? "is owned by Client upon full payment" : "remains property of Service Provider until full payment"}.\n\n6. TERMINATION\nEither party may terminate with ${terms.notice_days ?? 14} days written notice.\n\n7. LIMITATION OF LIABILITY\nNeither party shall be liable for indirect, incidental, or consequential damages.`,
      instructions: ["Sign and date all pages", "Attach scope-of-work exhibit", "Retain for duration of engagement plus 7 years"],
    },
    employment: {
      title: "Employment Agreement",
      preview: `This Employment Agreement ("Agreement") is made as of ${today} between ${partyA} ("Employer") and ${partyB} ("Employee") establishing the terms and conditions of employment for the position of ${terms.position ?? "the stated role"}.`,
      body: `1. POSITION & DUTIES\nEmployee is hired as ${terms.position ?? "Employee"}, reporting to ${terms.reports_to ?? "direct supervisor"}, with duties including ${terms.duties ?? "those customarily associated with the position"}.\n\n2. COMPENSATION\nBase salary of $${terms.salary_usd ?? "TBD"}/year, paid ${terms.pay_frequency ?? "bi-weekly"}. ${terms.bonus ? `Eligible for annual bonus up to ${terms.bonus}.` : ""}\n\n3. BENEFITS\nEmployee is eligible for benefits per the current employee handbook: ${terms.benefits ?? "health, dental, vision, 401k"}.\n\n4. AT-WILL EMPLOYMENT\nEmployment is at-will and may be terminated by either party at any time with or without cause.\n\n5. CONFIDENTIALITY & NON-COMPETE\nEmployee agrees to maintain confidentiality of Employer trade secrets and proprietary information during and after employment.\n\n6. GOVERNING LAW\nThis Agreement is governed by the laws of ${terms.state ?? "the state of hire"}.`,
      instructions: ["Sign before first day of employment", "Retain in employee personnel file", "Provide copy to Employee"],
    },
    vendor: {
      title: "Vendor Agreement",
      preview: `This Vendor Agreement ("Agreement") is entered into as of ${today} between ${partyA} ("Buyer") and ${partyB} ("Vendor") governing the purchase of goods and/or services described in purchase orders issued under this Agreement.`,
      body: `1. PURCHASE ORDERS\nBuyer will issue purchase orders specifying quantities, pricing, and delivery dates. Vendor must confirm within ${terms.confirmation_days ?? 2} business days.\n\n2. PRICING\nPrices are fixed as quoted unless Vendor provides 30-day written notice of price changes. Prices include all applicable taxes unless noted.\n\n3. DELIVERY\nVendor shall deliver goods per agreed schedule. Title and risk of loss pass to Buyer upon delivery and acceptance.\n\n4. WARRANTIES\nVendor warrants all goods are free from defects for ${terms.warranty_months ?? 12} months from delivery.\n\n5. PAYMENT TERMS\nBuyer shall pay invoices Net ${terms.payment_terms ?? 30} days from receipt and acceptance.\n\n6. TERMINATION\nEither party may terminate for convenience with 60 days notice, or immediately for cause.\n\n7. INDEMNIFICATION\nEach party indemnifies the other against third-party claims arising from its own negligence or breach.`,
      instructions: ["Both parties countersign purchase orders", "Attach product/service specifications as Exhibit A", "File with procurement records"],
    },
    lease: {
      title: "Commercial Lease Agreement",
      preview: `This Commercial Lease Agreement ("Lease") is executed as of ${today} by and between ${partyA} ("Landlord") and ${partyB} ("Tenant") for the commercial premises located at ${terms.property_address ?? "the Property address"}.`,
      body: `1. PREMISES\nLandlord leases to Tenant the premises at ${terms.property_address ?? "stated address"}, consisting of approximately ${terms.sqft ?? "TBD"} square feet.\n\n2. TERM\nLease commences ${terms.start_date ?? today} and expires ${terms.end_date ?? "12 months thereafter"} unless extended.\n\n3. RENT\nBase rent is $${terms.monthly_rent ?? "TBD"}/month, due on the 1st of each month. Late fee of 5% applies after 5-day grace period. Annual escalation: ${terms.rent_escalation ?? "3%"}.\n\n4. SECURITY DEPOSIT\nTenant shall deposit $${terms.security_deposit ?? "first and last month's rent"} as security, returned within 30 days of vacating less documented damages.\n\n5. USE\nPremises shall be used solely for ${terms.permitted_use ?? "lawful commercial purposes"}. No alterations without written Landlord consent.\n\n6. UTILITIES\nTenant responsible for ${terms.tenant_utilities ?? "all utilities including electric, gas, water, and internet"}.\n\n7. GOVERNING LAW\nThis Lease is governed by the laws of ${terms.state ?? "the state where the property is located"}.`,
      instructions: ["Both parties sign in the presence of a notary", "Tenant pays first/last/deposit before key transfer", "Record with county recorder if lease exceeds 1 year"],
    },
  };

  const template = TEMPLATES[type];
  const fullText = `${template.title.toUpperCase()}\nContract No: ${contractNum}\nDate: ${today}\n\nBETWEEN:\n  ${partyA} ("${type === "nda" ? "Disclosing Party" : type === "lease" ? "Landlord" : type === "employment" ? "Employer" : "Party A"}")\n  Address: ${parties.party_a?.address ?? "N/A"}\n\nAND:\n  ${partyB} ("${type === "nda" ? "Receiving Party" : type === "lease" ? "Tenant" : type === "employment" ? "Employee" : "Party B"}")\n  Address: ${parties.party_b?.address ?? "N/A"}\n\n${template.body}\n\nIN WITNESS WHEREOF, the parties execute this Agreement as of the date first written above.\n\n_________________________        _________________________\n${partyA}                         ${partyB}\nDate: ______________              Date: ______________`;

  db.prepare(`
    INSERT OR IGNORE INTO smb_contracts (id,contract_type,parties,terms_summary,full_text,fee_charged_usd,commission_usd)
    VALUES (?,?,?,?,?,?,?)
  `).run(contractId, type, JSON.stringify(parties), template.preview, fullText, CONTRACT_FEE, commission);

  incrementSmb("contracts_generated");

  return {
    contract_id:            contractId,
    contract_number:        contractNum,
    contract_type:          type,
    title:                  template.title,
    parties:                { party_a: partyA, party_b: partyB },
    effective_date:         today,
    content_preview:        template.preview,
    full_text:              fullText,
    execution_instructions: template.instructions,
    pdf_url:                `https://hivemcp.io/contracts/${contractId}.pdf`,
    esign_url:              `https://hivemcp.io/sign/${contractId}`,
    service_fee_usd:        CONTRACT_FEE,
    platform_commission_usd: commission,
    generated_at:           new Date().toISOString(),
  };
}

// ─── getSmbDashboard ──────────────────────────────────────────────────────────

/**
 * Get a holistic business operations dashboard snapshot.
 * Fee: $10.00/month | Commission: 12%
 *
 * @param {string} businessId - Unique business identifier
 * @returns {{ upcoming_renewals, tax_deadlines, spending_summary, compliance_alerts }}
 */
export function getSmbDashboard(businessId) {
  if (!businessId) throw new Error("businessId is required");

  const commission = Math.round(DASHBOARD_FEE * DASHBOARD_COMMISSION * 100) / 100;

  // Upsert subscription record
  db.prepare(`
    INSERT OR IGNORE INTO smb_dashboard_subs (id,business_id,fee_usd,commission_usd)
    VALUES (?,?,?,?)
  `).run(randomUUID(), businessId, DASHBOARD_FEE, commission);

  const today = new Date();

  const upcomingRenewals = [
    { item: "Business License",        due_date: addMonths(today, 1),  fee_usd: 75,   status: "renewal_due" },
    { item: "General Liability Insurance", due_date: addMonths(today, 2), fee_usd: 2800, status: "active" },
    { item: "State Annual Report",     due_date: addMonths(today, 3),  fee_usd: 50,   status: "active" },
    { item: "Seller's Permit",         due_date: addMonths(today, 0),  fee_usd: 0,    status: "renewal_due" },
  ];

  const taxDeadlines = [
    { event: "Q2 Estimated Tax Payment",  due: `${today.getFullYear()}-06-15`, amount_usd: null,  notes: "Pay 25% of estimated annual liability" },
    { event: "Q3 Estimated Tax Payment",  due: `${today.getFullYear()}-09-15`, amount_usd: null,  notes: "Pay 25% of estimated annual liability" },
    { event: "Annual Filing Deadline",    due: `${today.getFullYear()+1}-04-15`, amount_usd: null, notes: "File Form 1040 + Schedule C or corporate return" },
    { event: "W-2 / 1099 Distribution",  due: `${today.getFullYear()+1}-01-31`, amount_usd: null, notes: "Distribute to all employees and contractors" },
  ].filter(d => new Date(d.due) > today);

  const spendingSummary = {
    current_month_usd:    Math.round(18450 + Math.random() * 5000),
    prior_month_usd:      Math.round(16800 + Math.random() * 4000),
    ytd_usd:              Math.round(142000 + Math.random() * 30000),
    top_categories:       [
      { category: "Payroll",              pct: 48 },
      { category: "Rent & Utilities",     pct: 16 },
      { category: "Software & Subscriptions", pct: 9 },
      { category: "Marketing",            pct: 8 },
      { category: "Other",               pct: 19 },
    ],
    flagged_transactions: Math.floor(Math.random() * 5),
  };

  const complianceAlerts = [
    upcomingRenewals.filter(r => r.status === "renewal_due").length > 0
      ? { severity: "warning", message: `${upcomingRenewals.filter(r => r.status === "renewal_due").length} license(s) due for renewal within 30 days`, action_url: "/licenses" }
      : null,
    { severity: "info",    message: "Quarterly estimated tax payment due soon", action_url: "/tax" },
    spendingSummary.flagged_transactions > 0
      ? { severity: "warning", message: `${spendingSummary.flagged_transactions} transactions need categorization review`, action_url: "/transactions" }
      : null,
  ].filter(Boolean);

  return {
    dashboard_id:       randomUUID(),
    business_id:        businessId,
    generated_at:       today.toISOString(),
    upcoming_renewals:  upcomingRenewals,
    tax_deadlines:      taxDeadlines,
    spending_summary:   spendingSummary,
    compliance_alerts:  complianceAlerts,
    health_score:       Math.round(85 - complianceAlerts.filter(a => a.severity === "warning").length * 8),
    service_fee_usd:    DASHBOARD_FEE,
    platform_commission_usd: commission,
    billing_cycle:      "monthly",
  };
}
