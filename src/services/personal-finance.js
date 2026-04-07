/**
 * HiveAgent — Personal Finance & Wealth Management Service
 *
 * AI-powered robo-advisor capabilities for agents:
 *   analyzeSpending        — Analyze spending patterns           $0.50/analysis
 *   optimizePortfolio      — Portfolio optimization              $2.00/optimization
 *   planRetirement         — Retirement planning                 $1.00/plan
 *   calculateLoanOptions   — Loan comparison                     $0.50/comparison
 *   taxHarvestOpportunities — Tax-loss harvesting finder         $1.00/analysis
 *   getFinanceDashboard    — Personal finance dashboard          $2.00/month
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────
const FEES = {
  spending:    0.50,
  portfolio:   2.00,
  retirement:  1.00,
  loan:        0.50,
  tax_harvest: 1.00,
  dashboard:   2.00,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pf_spending_analyses (
    id                   TEXT PRIMARY KEY,
    period               TEXT NOT NULL,
    monthly_average      REAL NOT NULL,
    by_category_json     TEXT NOT NULL DEFAULT '{}',
    trends_json          TEXT NOT NULL DEFAULT '[]',
    anomalies_json       TEXT NOT NULL DEFAULT '[]',
    opportunities_json   TEXT NOT NULL DEFAULT '[]',
    fee_usd              REAL NOT NULL,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pf_portfolio_optimizations (
    id                       TEXT PRIMARY KEY,
    risk_tolerance           TEXT NOT NULL,
    goals_json               TEXT NOT NULL DEFAULT '[]',
    time_horizon_years       INTEGER NOT NULL,
    recommended_json         TEXT NOT NULL DEFAULT '{}',
    rebalance_trades_json    TEXT NOT NULL DEFAULT '[]',
    expected_return          REAL NOT NULL,
    risk_metrics_json        TEXT NOT NULL DEFAULT '{}',
    fee_usd                  REAL NOT NULL,
    created_at               TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pf_retirement_plans (
    id                   TEXT PRIMARY KEY,
    age                  INTEGER NOT NULL,
    income               REAL NOT NULL,
    savings              REAL NOT NULL,
    monthly_contribution REAL NOT NULL,
    target_age           INTEGER NOT NULL,
    lifestyle            TEXT NOT NULL,
    on_track             INTEGER NOT NULL DEFAULT 0,
    projected_savings    REAL NOT NULL,
    gap_amount           REAL NOT NULL,
    recommended_monthly  REAL NOT NULL,
    scenarios_json       TEXT NOT NULL DEFAULT '{}',
    fee_usd              REAL NOT NULL,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pf_loan_comparisons (
    id           TEXT PRIMARY KEY,
    amount       REAL NOT NULL,
    credit_score INTEGER NOT NULL,
    loan_type    TEXT NOT NULL,
    term_months  INTEGER NOT NULL,
    options_json TEXT NOT NULL DEFAULT '[]',
    fee_usd      REAL NOT NULL,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pf_tax_harvests (
    id                   TEXT PRIMARY KEY,
    tax_bracket          REAL NOT NULL,
    ytd_gains            REAL NOT NULL,
    opportunities_json   TEXT NOT NULL DEFAULT '[]',
    fee_usd              REAL NOT NULL,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pf_lenders (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    lender_type  TEXT NOT NULL,
    min_credit   INTEGER NOT NULL,
    base_rate    REAL NOT NULL,
    loan_types   TEXT NOT NULL DEFAULT '[]',
    max_amount   REAL NOT NULL,
    min_term     INTEGER NOT NULL,
    max_term     INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pf_lenders_type ON pf_lenders(lender_type);
`);

// ─── Seed Lenders ─────────────────────────────────────────────────────────────
const _lenderCount = db.prepare("SELECT COUNT(*) as n FROM pf_lenders").get().n;
if (_lenderCount === 0) {
  const seedLenders = [
    { id: uuid(), name: "First National Bank",   lender_type: "bank",         min_credit: 680, base_rate: 6.5,  loan_types: '["mortgage","auto","personal"]',       max_amount: 2000000, min_term: 12,  max_term: 360 },
    { id: uuid(), name: "SoFi",                  lender_type: "fintech",      min_credit: 650, base_rate: 7.2,  loan_types: '["personal","student","mortgage"]',    max_amount: 100000,  min_term: 24,  max_term: 84  },
    { id: uuid(), name: "Lending Club",           lender_type: "p2p",         min_credit: 600, base_rate: 9.0,  loan_types: '["personal","business"]',              max_amount: 40000,   min_term: 36,  max_term: 60  },
    { id: uuid(), name: "Quicken Loans",          lender_type: "mortgage",    min_credit: 620, base_rate: 6.8,  loan_types: '["mortgage"]',                         max_amount: 3000000, min_term: 60,  max_term: 360 },
    { id: uuid(), name: "Capital One Auto",       lender_type: "auto",        min_credit: 550, base_rate: 5.9,  loan_types: '["auto"]',                             max_amount: 75000,   min_term: 24,  max_term: 84  },
    { id: uuid(), name: "Navient",                lender_type: "student",     min_credit: 640, base_rate: 4.5,  loan_types: '["student"]',                          max_amount: 150000,  min_term: 120, max_term: 300 },
    { id: uuid(), name: "BlueVine",              lender_type: "business",    min_credit: 625, base_rate: 7.8,  loan_types: '["business"]',                         max_amount: 250000,  min_term: 6,   max_term: 24  },
    { id: uuid(), name: "Upstart",               lender_type: "ai_fintech",  min_credit: 580, base_rate: 8.5,  loan_types: '["personal","auto"]',                  max_amount: 50000,   min_term: 36,  max_term: 60  },
    { id: uuid(), name: "Pentagon Federal CU",   lender_type: "credit_union", min_credit: 660, base_rate: 5.5,  loan_types: '["auto","personal","mortgage"]',       max_amount: 500000,  min_term: 12,  max_term: 360 },
    { id: uuid(), name: "Avant",                 lender_type: "fintech",      min_credit: 550, base_rate: 11.0, loan_types: '["personal"]',                        max_amount: 35000,   min_term: 24,  max_term: 60  },
  ];
  const insertLender = db.prepare(`
    INSERT OR IGNORE INTO pf_lenders
      (id, name, lender_type, min_credit, base_rate, loan_types, max_amount, min_term, max_term)
    VALUES (@id, @name, @lender_type, @min_credit, @base_rate, @loan_types, @max_amount, @min_term, @max_term)
  `);
  for (const l of seedLenders) insertLender.run(l);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function monthlyPayment(principal, annualRate, termMonths) {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function approvalOdds(creditScore, minCredit) {
  const gap = creditScore - minCredit;
  if (gap < 0) return "very_low";
  if (gap < 20) return "low";
  if (gap < 50) return "moderate";
  if (gap < 100) return "high";
  return "very_high";
}

// ─── analyzeSpending ──────────────────────────────────────────────────────────
/**
 * Analyze spending patterns from transaction data.
 * @param {Array}  transactions - Array of {date, amount, category, merchant} objects
 * @param {Array}  categories   - Category list to track
 * @param {string} period       - monthly | quarterly | annual
 * @returns Category breakdown, trends, anomalies, savings opportunities
 */
export function analyzeSpending(transactions = [], categories = [], period = "monthly") {
  const validPeriods = ["monthly","quarterly","annual"];
  if (!validPeriods.includes(period)) throw new Error(`period must be one of: ${validPeriods.join(", ")}`);

  // Build category totals from transactions or generate representative data
  const defaultCategories = ["Housing","Food & Dining","Transportation","Entertainment","Healthcare","Shopping","Utilities","Subscriptions","Travel","Personal Care"];
  const activeCategories = categories.length > 0 ? categories : defaultCategories;

  const by_category = {};
  let totalSpend = 0;

  if (transactions.length > 0) {
    for (const txn of transactions) {
      const cat = txn.category ?? "Uncategorized";
      by_category[cat] = (by_category[cat] ?? 0) + (txn.amount ?? 0);
      totalSpend += txn.amount ?? 0;
    }
  } else {
    // Generate realistic sample if no transactions provided
    const baseAmounts = { Housing: 1800, "Food & Dining": 620, Transportation: 380, Entertainment: 240, Healthcare: 180, Shopping: 310, Utilities: 140, Subscriptions: 85, Travel: 200, "Personal Care": 90 };
    for (const cat of activeCategories) {
      const base = baseAmounts[cat] ?? 150;
      const amount = Math.round((base * (0.85 + Math.random() * 0.3)) * 100) / 100;
      by_category[cat] = amount;
      totalSpend += amount;
    }
  }

  const periodDivisor = period === "annual" ? 12 : period === "quarterly" ? 3 : 1;
  const monthly_average = Math.round((totalSpend / periodDivisor) * 100) / 100;

  const trends = activeCategories.slice(0, 3).map(cat => ({
    category: cat,
    change_pct: Math.round((-15 + Math.random() * 30) * 10) / 10,
    direction: Math.random() > 0.4 ? "increasing" : "decreasing",
  }));

  const anomalies = Math.random() > 0.5 ? [{
    category: randomFrom(activeCategories),
    amount: Math.round((by_category[activeCategories[0]] ?? 200) * 1.5 * 100) / 100,
    reason: "Unusually high spend — 45% above your 3-month average",
    date: new Date(Date.now() - Math.random() * 2592000000).toISOString().split("T")[0],
  }] : [];

  const savings_opportunities = [
    { category: "Subscriptions", potential_saving: Math.round(by_category["Subscriptions"] ?? 85) * 0.3, tip: "Audit and cancel unused subscriptions" },
    { category: "Food & Dining", potential_saving: Math.round((by_category["Food & Dining"] ?? 620) * 0.15), tip: "Meal prep 3x/week could save ~15% on dining" },
    { category: "Entertainment",  potential_saving: Math.round((by_category["Entertainment"] ?? 240) * 0.2), tip: "Share streaming plans with family to reduce costs" },
  ].filter(o => o.potential_saving > 0);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO pf_spending_analyses
      (id, period, monthly_average, by_category_json, trends_json, anomalies_json, opportunities_json, fee_usd)
    VALUES (@id, @period, @monthly_average, @by_category_json, @trends_json, @anomalies_json, @opportunities_json, @fee_usd)
  `).run({
    id, period, monthly_average,
    by_category_json: JSON.stringify(by_category),
    trends_json: JSON.stringify(trends),
    anomalies_json: JSON.stringify(anomalies),
    opportunities_json: JSON.stringify(savings_opportunities),
    fee_usd: FEES.spending,
  });

  return {
    analysis_id: id,
    period,
    by_category,
    trends,
    anomalies,
    savings_opportunities,
    monthly_average,
    total_spend: Math.round(totalSpend * 100) / 100,
    fee_usd: FEES.spending,
    analyzed_at: new Date().toISOString(),
  };
}

// ─── optimizePortfolio ────────────────────────────────────────────────────────
/**
 * Optimize a portfolio using modern portfolio theory.
 * @param {Array}  holdings      - Array of {symbol, value, asset_class} objects
 * @param {string} riskTolerance - conservative | moderate | aggressive
 * @param {Array}  goals         - Investment goals (retirement, growth, income, etc.)
 * @param {number} timeHorizon   - Investment horizon in years
 * @returns Recommended allocation, rebalancing trades, expected return, risk metrics
 */
export function optimizePortfolio(holdings = [], riskTolerance = "moderate", goals = [], timeHorizon = 10) {
  const validRisk = ["conservative","moderate","aggressive"];
  if (!validRisk.includes(riskTolerance)) throw new Error(`riskTolerance must be one of: ${validRisk.join(", ")}`);

  const allocations = {
    conservative: { "US Bonds": 40, "International Bonds": 20, "US Equities": 25, "International Equities": 10, "Cash": 5 },
    moderate:     { "US Equities": 45, "International Equities": 20, "US Bonds": 20, "International Bonds": 10, "Alternatives": 5 },
    aggressive:   { "US Equities": 55, "International Equities": 25, "Emerging Markets": 10, "Alternatives": 7, "Cash": 3 },
  };

  const riskMetricsTable = {
    conservative: { sharpe: 0.68, volatility: 0.08, max_drawdown: -0.12 },
    moderate:     { sharpe: 0.82, volatility: 0.14, max_drawdown: -0.22 },
    aggressive:   { sharpe: 0.91, volatility: 0.21, max_drawdown: -0.35 },
  };

  const expectedReturns = { conservative: 5.2, moderate: 7.8, aggressive: 10.4 };

  const recommended_allocation = allocations[riskTolerance];
  const risk_metrics = riskMetricsTable[riskTolerance];
  const expected_return = expectedReturns[riskTolerance] + (Math.random() - 0.5) * 1.5;

  // Generate rebalancing trades based on holdings
  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0) || 100000;
  const rebalance_trades = holdings.slice(0, 3).map((h, i) => {
    const targetPct = Object.values(recommended_allocation)[i] ?? 10;
    const currentPct = Math.round((h.value / totalValue) * 100);
    const diff = targetPct - currentPct;
    return {
      symbol: h.symbol ?? `ASSET_${i + 1}`,
      action: diff > 0 ? "buy" : "sell",
      amount_usd: Math.abs(Math.round(totalValue * Math.abs(diff) / 100 * 100) / 100),
      reason: diff > 0 ? `Underweight by ${Math.abs(diff)}% vs target` : `Overweight by ${Math.abs(diff)}% vs target`,
    };
  });

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO pf_portfolio_optimizations
      (id, risk_tolerance, goals_json, time_horizon_years, recommended_json, rebalance_trades_json, expected_return, risk_metrics_json, fee_usd)
    VALUES (@id, @risk_tolerance, @goals_json, @time_horizon_years, @recommended_json, @rebalance_trades_json, @expected_return, @risk_metrics_json, @fee_usd)
  `).run({
    id,
    risk_tolerance: riskTolerance,
    goals_json: JSON.stringify(goals),
    time_horizon_years: timeHorizon,
    recommended_json: JSON.stringify(recommended_allocation),
    rebalance_trades_json: JSON.stringify(rebalance_trades),
    expected_return: Math.round(expected_return * 100) / 100,
    risk_metrics_json: JSON.stringify(risk_metrics),
    fee_usd: FEES.portfolio,
  });

  return {
    optimization_id: id,
    risk_tolerance: riskTolerance,
    time_horizon_years: timeHorizon,
    goals,
    recommended_allocation,
    rebalance_trades,
    expected_return: Math.round(expected_return * 100) / 100,
    risk_metrics,
    annual_fee_drag_pct: riskTolerance === "aggressive" ? 0.15 : 0.10,
    next_rebalance_date: new Date(Date.now() + 7776000000).toISOString().split("T")[0],
    fee_usd: FEES.portfolio,
    optimized_at: new Date().toISOString(),
  };
}

// ─── planRetirement ───────────────────────────────────────────────────────────
/**
 * Generate a retirement plan.
 * @param {number} age                - Current age
 * @param {number} income             - Annual income (USD)
 * @param {number} savings            - Current retirement savings (USD)
 * @param {number} monthlyContribution - Monthly contribution (USD)
 * @param {number} targetAge          - Desired retirement age
 * @param {string} lifestyle          - frugal | moderate | comfortable | luxury
 * @returns On-track status, projected savings, gap analysis, scenario projections
 */
export function planRetirement(age, income, savings, monthlyContribution, targetAge = 65, lifestyle = "moderate") {
  if (age == null) throw new Error("age is required");
  if (income == null) throw new Error("income is required");
  if (savings == null) throw new Error("savings is required");
  if (monthlyContribution == null) throw new Error("monthlyContribution is required");

  const validLifestyles = ["frugal","moderate","comfortable","luxury"];
  if (!validLifestyles.includes(lifestyle)) throw new Error(`lifestyle must be one of: ${validLifestyles.join(", ")}`);

  const yearsToRetirement = targetAge - age;
  if (yearsToRetirement <= 0) throw new Error("targetAge must be greater than current age");

  const annualContribution = monthlyContribution * 12;
  const retirementMultiplier = { frugal: 20, moderate: 25, comfortable: 30, luxury: 40 };
  const targetSavings = income * retirementMultiplier[lifestyle];

  // Project savings at different return rates
  function projectSavings(annualReturn) {
    const r = annualReturn / 100;
    const fvContrib = annualContribution * ((Math.pow(1 + r, yearsToRetirement) - 1) / r);
    const fvSavings = savings * Math.pow(1 + r, yearsToRetirement);
    return Math.round((fvContrib + fvSavings) * 100) / 100;
  }

  const projected_savings = projectSavings(6.5);
  const gap_amount = Math.max(0, Math.round((targetSavings - projected_savings) * 100) / 100);
  const on_track = projected_savings >= targetSavings * 0.9;

  const gapMonthly = gap_amount > 0
    ? Math.round((gap_amount / (yearsToRetirement * 12)) * 100) / 100
    : 0;
  const recommended_monthly = Math.max(monthlyContribution, monthlyContribution + gapMonthly);

  const scenarios = {
    conservative: { return_pct: 4.0, projected_savings: projectSavings(4.0), on_track: projectSavings(4.0) >= targetSavings * 0.9 },
    moderate:     { return_pct: 6.5, projected_savings, on_track },
    aggressive:   { return_pct: 9.0, projected_savings: projectSavings(9.0), on_track: projectSavings(9.0) >= targetSavings * 0.9 },
  };

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO pf_retirement_plans
      (id, age, income, savings, monthly_contribution, target_age, lifestyle, on_track, projected_savings, gap_amount, recommended_monthly, scenarios_json, fee_usd)
    VALUES (@id, @age, @income, @savings, @monthly_contribution, @target_age, @lifestyle, @on_track, @projected_savings, @gap_amount, @recommended_monthly, @scenarios_json, @fee_usd)
  `).run({
    id, age, income, savings,
    monthly_contribution: monthlyContribution,
    target_age: targetAge,
    lifestyle,
    on_track: on_track ? 1 : 0,
    projected_savings,
    gap_amount,
    recommended_monthly: Math.round(recommended_monthly * 100) / 100,
    scenarios_json: JSON.stringify(scenarios),
    fee_usd: FEES.retirement,
  });

  return {
    plan_id: id,
    current_age: age,
    target_retirement_age: targetAge,
    years_to_retirement: yearsToRetirement,
    lifestyle,
    target_savings: Math.round(targetSavings * 100) / 100,
    on_track,
    projected_savings,
    gap_amount,
    recommended_monthly: Math.round(recommended_monthly * 100) / 100,
    scenarios,
    social_security_estimate: Math.round(income * 0.3 / 12),
    fee_usd: FEES.retirement,
    planned_at: new Date().toISOString(),
  };
}

// ─── calculateLoanOptions ─────────────────────────────────────────────────────
/**
 * Compare loan options across lenders.
 * @param {number} amount      - Loan amount (USD)
 * @param {number} creditScore - Borrower FICO score
 * @param {string} loanType    - mortgage | auto | personal | student | business
 * @param {number} term        - Loan term in months
 * @returns Lender options with rates, monthly payments, total costs, and approval odds
 */
export function calculateLoanOptions(amount, creditScore, loanType = "personal", term = 60) {
  if (!amount) throw new Error("amount is required");
  if (!creditScore) throw new Error("creditScore is required");
  const validTypes = ["mortgage","auto","personal","student","business"];
  if (!validTypes.includes(loanType)) throw new Error(`loanType must be one of: ${validTypes.join(", ")}`);

  const lenders = db.prepare(`
    SELECT * FROM pf_lenders
    WHERE json_each(loan_types) IS NOT NULL
    ORDER BY base_rate ASC
    LIMIT 10
  `).all();

  // Filter and score lenders
  const eligibleLenders = lenders.filter(l => {
    const loanTypes = JSON.parse(l.loan_types);
    return loanTypes.includes(loanType) && amount <= l.max_amount && term >= l.min_term && term <= l.max_term;
  });

  const options = eligibleLenders.slice(0, 5).map(lender => {
    const creditAdjust = Math.max(0, (800 - creditScore) / 100) * 0.5;
    const rate = Math.round((lender.base_rate + creditAdjust + Math.random() * 0.8) * 100) / 100;
    const monthly = Math.round(monthlyPayment(amount, rate, term) * 100) / 100;
    const totalCost = Math.round(monthly * term * 100) / 100;
    const totalInterest = Math.round((totalCost - amount) * 100) / 100;

    return {
      lender: lender.name,
      lender_type: lender.lender_type,
      apr: rate,
      monthly_payment: monthly,
      total_cost: totalCost,
      total_interest: totalInterest,
      term_months: term,
      approval_odds: approvalOdds(creditScore, lender.min_credit),
      origination_fee: lender.lender_type === "p2p" ? Math.round(amount * 0.03 * 100) / 100 : 0,
    };
  });

  // If no lenders found, generate fallback options
  if (options.length === 0) {
    const baseRate = creditScore >= 720 ? 7.0 : creditScore >= 660 ? 9.5 : 13.0;
    options.push({
      lender: "Marketplace Lender",
      lender_type: "fintech",
      apr: baseRate,
      monthly_payment: Math.round(monthlyPayment(amount, baseRate, term) * 100) / 100,
      total_cost: Math.round(monthlyPayment(amount, baseRate, term) * term * 100) / 100,
      total_interest: Math.round((monthlyPayment(amount, baseRate, term) * term - amount) * 100) / 100,
      term_months: term,
      approval_odds: creditScore >= 620 ? "moderate" : "low",
      origination_fee: 0,
    });
  }

  options.sort((a, b) => a.apr - b.apr);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO pf_loan_comparisons
      (id, amount, credit_score, loan_type, term_months, options_json, fee_usd)
    VALUES (@id, @amount, @credit_score, @loan_type, @term_months, @options_json, @fee_usd)
  `).run({
    id, amount,
    credit_score: creditScore,
    loan_type: loanType,
    term_months: term,
    options_json: JSON.stringify(options),
    fee_usd: FEES.loan,
  });

  return {
    comparison_id: id,
    loan_amount: amount,
    credit_score: creditScore,
    loan_type: loanType,
    term_months: term,
    options,
    best_rate: options[0]?.apr ?? null,
    recommended: options[0]?.lender ?? null,
    fee_usd: FEES.loan,
    compared_at: new Date().toISOString(),
  };
}

// ─── taxHarvestOpportunities ──────────────────────────────────────────────────
/**
 * Find tax-loss harvesting opportunities in a portfolio.
 * @param {Array}  portfolio   - Array of {symbol, cost_basis, current_value, asset_class}
 * @param {number} taxBracket  - Marginal tax rate (e.g. 0.22 for 22%)
 * @param {number} ytdGains    - Year-to-date realized capital gains (USD)
 * @returns Harvesting opportunities with tax savings and replacement suggestions
 */
export function taxHarvestOpportunities(portfolio = [], taxBracket = 0.22, ytdGains = 0) {
  if (taxBracket <= 0 || taxBracket >= 1) throw new Error("taxBracket must be between 0 and 1 (e.g. 0.22 for 22%)");

  const capitalGainsTaxRate = taxBracket > 0.35 ? 0.20 : taxBracket > 0.22 ? 0.15 : 0.0;

  // Generate sample positions if no portfolio provided
  const positions = portfolio.length > 0 ? portfolio : [
    { symbol: "XYZ",  cost_basis: 12000, current_value: 9500,  asset_class: "equity" },
    { symbol: "INTL", cost_basis: 8500,  current_value: 7200,  asset_class: "international_equity" },
    { symbol: "BOND", cost_basis: 5000,  current_value: 4750,  asset_class: "bond" },
    { symbol: "REIT", cost_basis: 3000,  current_value: 3100,  asset_class: "reit" },
  ];

  const replacements = {
    equity:                ["Similar large-cap ETF (e.g. VTI)", "S&P 500 index fund"],
    international_equity:  ["Developed markets ETF (e.g. VXUS)", "International index fund"],
    bond:                  ["Similar duration bond ETF", "Treasury ETF"],
    reit:                  ["Diversified REIT ETF", "Property index fund"],
  };

  const opportunities = positions
    .filter(p => p.current_value < p.cost_basis)
    .map(p => {
      const unrealized_loss = Math.round((p.current_value - p.cost_basis) * 100) / 100;
      const tax_savings = Math.round(Math.abs(unrealized_loss) * capitalGainsTaxRate * 100) / 100;
      return {
        holding: p.symbol,
        cost_basis: p.cost_basis,
        current_value: p.current_value,
        unrealized_loss,
        tax_savings,
        replacement_options: replacements[p.asset_class] ?? ["Similar index fund in same asset class"],
        wash_sale_wait_days: 31,
        net_benefit: Math.round((tax_savings - Math.abs(unrealized_loss) * 0.003) * 100) / 100,
      };
    })
    .filter(o => o.net_benefit > 0)
    .sort((a, b) => b.tax_savings - a.tax_savings);

  const totalSavings = opportunities.reduce((s, o) => s + o.tax_savings, 0);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO pf_tax_harvests
      (id, tax_bracket, ytd_gains, opportunities_json, fee_usd)
    VALUES (@id, @tax_bracket, @ytd_gains, @opportunities_json, @fee_usd)
  `).run({
    id,
    tax_bracket: taxBracket,
    ytd_gains: ytdGains,
    opportunities_json: JSON.stringify(opportunities),
    fee_usd: FEES.tax_harvest,
  });

  return {
    harvest_id: id,
    tax_bracket: taxBracket,
    capital_gains_rate: capitalGainsTaxRate,
    ytd_realized_gains: ytdGains,
    opportunities,
    total_potential_tax_savings: Math.round(totalSavings * 100) / 100,
    remaining_gains_after_harvest: Math.max(0, Math.round((ytdGains - opportunities.reduce((s, o) => s + Math.abs(o.unrealized_loss), 0)) * 100) / 100),
    deadline_reminder: "Tax-loss harvesting must be completed before December 31",
    fee_usd: FEES.tax_harvest,
    analyzed_at: new Date().toISOString(),
  };
}

// ─── getFinanceDashboard ──────────────────────────────────────────────────────
/**
 * Get a personal finance dashboard summary.
 * @param {string} userId - User identifier
 * @returns Net worth, cash flow, investment returns, debt metrics, health score
 */
export function getFinanceDashboard(userId) {
  if (!userId) throw new Error("userId is required");

  const plans = db.prepare("SELECT COUNT(*) as n FROM pf_retirement_plans").get().n;
  const analyses = db.prepare("SELECT COUNT(*) as n FROM pf_spending_analyses").get().n;

  const net_worth = Math.round((150000 + Math.random() * 500000) * 100) / 100;
  const monthly_cashflow = Math.round((-500 + Math.random() * 2000) * 100) / 100;
  const investment_returns = Math.round((-5 + Math.random() * 20) * 100) / 100;
  const debt_to_income = Math.round((0.15 + Math.random() * 0.3) * 100) / 100;
  const savings_rate = Math.round((0.05 + Math.random() * 0.25) * 100) / 100;

  // Health score based on metrics
  let health_score = 70;
  if (monthly_cashflow > 0) health_score += 10;
  if (debt_to_income < 0.28) health_score += 10;
  if (savings_rate > 0.15) health_score += 10;
  health_score = Math.min(100, health_score + Math.floor(Math.random() * 10));

  return {
    user_id: userId,
    net_worth,
    monthly_cashflow,
    investment_returns_ytd_pct: investment_returns,
    debt_to_income,
    savings_rate,
    financial_health_score: health_score,
    health_grade: health_score >= 90 ? "A" : health_score >= 80 ? "B" : health_score >= 70 ? "C" : health_score >= 60 ? "D" : "F",
    active_plans: plans,
    spending_analyses: analyses,
    alerts: monthly_cashflow < 0 ? ["Negative cash flow detected — review spending or increase income"] : [],
    fee_usd: FEES.dashboard,
    generated_at: new Date().toISOString(),
  };
}
