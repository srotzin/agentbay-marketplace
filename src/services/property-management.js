import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEES = {
  screen_tenant:     3.00,
  create_lease:      5.00,
  track_maintenance: 0.50,
  optimize_rent:     1.00,
  rent_collection:   0.25, // per property/month
  dashboard:         5.00, // per month
};

const URGENCY_LEVELS   = ["low", "medium", "high", "emergency"];
const RECOMMENDATION_OPTIONS = ["approve", "conditional", "deny"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pm_tenant_screenings (
    id                  TEXT PRIMARY KEY,
    applicant_name      TEXT NOT NULL,
    applicant_email     TEXT,
    property_id         TEXT,
    credit_score_range  TEXT NOT NULL,
    income_verification TEXT NOT NULL,
    rental_history      TEXT NOT NULL,
    eviction_check      TEXT NOT NULL,
    recommendation      TEXT NOT NULL CHECK(recommendation IN ('approve','conditional','deny')),
    risk_score          REAL NOT NULL,
    criteria            TEXT DEFAULT '{}',
    fee_usd             REAL DEFAULT 3.00,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_leases (
    id                  TEXT PRIMARY KEY,
    property_id         TEXT NOT NULL,
    tenant_name         TEXT NOT NULL,
    tenant_email        TEXT,
    start_date          TEXT NOT NULL,
    end_date            TEXT NOT NULL,
    monthly_rent_usd    REAL NOT NULL,
    security_deposit    REAL,
    status              TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_signature','active','expired','terminated')),
    document_preview    TEXT,
    terms_summary       TEXT,
    required_signatures TEXT DEFAULT '[]',
    move_in_checklist   TEXT DEFAULT '[]',
    fee_usd             REAL DEFAULT 5.00,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_maintenance_tickets (
    id               TEXT PRIMARY KEY,
    property_id      TEXT NOT NULL,
    tenant_id        TEXT,
    issue            TEXT NOT NULL,
    urgency          TEXT NOT NULL CHECK(urgency IN ('low','medium','high','emergency')),
    priority         INTEGER NOT NULL,
    assigned_vendor  TEXT,
    estimated_cost   REAL,
    eta              TEXT,
    status           TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','cancelled')),
    fee_usd          REAL DEFAULT 0.50,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_rent_optimizations (
    id                  TEXT PRIMARY KEY,
    property_id         TEXT NOT NULL,
    current_rent        REAL NOT NULL,
    recommended_rent    REAL NOT NULL,
    market_comparison   TEXT DEFAULT '{}',
    occupancy_impact    TEXT DEFAULT '{}',
    revenue_projection  TEXT DEFAULT '{}',
    fee_usd             REAL DEFAULT 1.00,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_rent_collections (
    id               TEXT PRIMARY KEY,
    property_id      TEXT NOT NULL,
    collection_data  TEXT NOT NULL,
    summary          TEXT DEFAULT '{}',
    fee_usd          REAL DEFAULT 0.25,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_portfolios (
    id                    TEXT PRIMARY KEY,
    portfolio_id          TEXT NOT NULL UNIQUE,
    property_count        INTEGER DEFAULT 0,
    occupancy_rate        REAL DEFAULT 0,
    monthly_revenue       REAL DEFAULT 0,
    maintenance_costs     REAL DEFAULT 0,
    delinquency_rate      REAL DEFAULT 0,
    appreciation_estimate REAL DEFAULT 0,
    last_updated          TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calcRiskScore(creditRange, evictionFound, incomeRatio) {
  let score = 50;
  if (creditRange === "excellent") score -= 25;
  else if (creditRange === "good")  score -= 15;
  else if (creditRange === "fair")  score += 10;
  else                              score += 25;
  if (evictionFound)   score += 30;
  if (incomeRatio >= 3) score -= 15;
  else if (incomeRatio < 2.5) score += 15;
  return Math.max(0, Math.min(100, score));
}

function vendorForIssue(issue) {
  const lower = issue.toLowerCase();
  if (lower.includes("plumb") || lower.includes("leak") || lower.includes("water"))  return "AquaFix Plumbing";
  if (lower.includes("electric") || lower.includes("power") || lower.includes("wir")) return "Bright Spark Electric";
  if (lower.includes("heat") || lower.includes("hvac") || lower.includes("air"))     return "ClimateRight HVAC";
  if (lower.includes("pest") || lower.includes("bug") || lower.includes("rodent"))   return "ShieldPest Control";
  if (lower.includes("roof") || lower.includes("ceiling"))                           return "TopShield Roofing";
  return "AllPro Maintenance Services";
}

// ─── Screen Tenant ────────────────────────────────────────────────────────────

/**
 * Run a comprehensive tenant screening with credit, income, rental history, and eviction checks.
 * @param {object} applicantData - { name, email, monthly_income, rent_amount, employment_status }
 * @param {object} criteria      - { min_credit_score, min_income_ratio, allow_prior_evictions }
 * @returns Screening report with recommendation and risk score
 */
export function screenTenant(applicantData, criteria = {}) {
  if (!applicantData || !applicantData.name) throw new Error("applicantData.name is required");

  const minIncomeRatio = criteria.min_income_ratio ?? 2.5;
  const monthlyIncome  = applicantData.monthly_income ?? randomFloat(3000, 12000);
  const rentAmount     = applicantData.rent_amount    ?? randomFloat(1000, 3000);
  const incomeRatio    = parseFloat((monthlyIncome / rentAmount).toFixed(2));

  const creditBands = ["poor", "fair", "good", "very_good", "excellent"];
  const creditRange = applicantData.credit_band ?? pickRandom(creditBands.slice(1));

  const evictionFound   = criteria.allow_prior_evictions
    ? false
    : Math.random() < 0.08;

  const rentalHistoryMonths = randomInt(12, 84);
  const latePayments        = randomInt(0, 3);

  const incomeVerification = {
    monthly_income_usd: monthlyIncome,
    rent_amount_usd:    rentAmount,
    income_to_rent_ratio: incomeRatio,
    meets_requirement:  incomeRatio >= minIncomeRatio,
    employment_status:  applicantData.employment_status ?? "employed_full_time",
  };

  const rentalHistory = {
    months_of_history:   rentalHistoryMonths,
    late_payments:       latePayments,
    landlord_references: randomInt(1, 3),
    prior_evictions:     evictionFound ? 1 : 0,
    rating:              latePayments === 0 ? "excellent" : latePayments <= 1 ? "good" : "fair",
  };

  const evictionCheck = {
    evictions_found: evictionFound,
    records_checked: ["national_eviction_registry", "local_court_records"],
    jurisdictions:   ["state", "county", "city"],
  };

  const riskScore = calcRiskScore(creditRange, evictionFound, incomeRatio);

  let recommendation;
  if (riskScore <= 30 && !evictionFound && incomeRatio >= minIncomeRatio) recommendation = "approve";
  else if (riskScore <= 60 && !evictionFound)                              recommendation = "conditional";
  else                                                                     recommendation = "deny";

  if (criteria.allow_prior_evictions === false && evictionFound) recommendation = "deny";

  const id  = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pm_tenant_screenings
      (id, applicant_name, applicant_email, property_id, credit_score_range, income_verification,
       rental_history, eviction_check, recommendation, risk_score, criteria, fee_usd, created_at)
    VALUES
      (@id, @applicant_name, @applicant_email, @property_id, @credit_score_range,
       @income_verification, @rental_history, @eviction_check,
       @recommendation, @risk_score, @criteria, @fee_usd, @created_at)
  `).run({
    id,
    applicant_name:      applicantData.name,
    applicant_email:     applicantData.email ?? null,
    property_id:         applicantData.property_id ?? null,
    credit_score_range:  creditRange,
    income_verification: JSON.stringify(incomeVerification),
    rental_history:      JSON.stringify(rentalHistory),
    eviction_check:      JSON.stringify(evictionCheck),
    recommendation,
    risk_score:          riskScore,
    criteria:            JSON.stringify(criteria),
    fee_usd:             FEES.screen_tenant,
    created_at:          now,
  });

  return {
    screening_id:        id,
    applicant:           { name: applicantData.name, email: applicantData.email ?? null },
    credit_score_range:  creditRange,
    income_verification: incomeVerification,
    rental_history:      rentalHistory,
    eviction_check:      evictionCheck,
    recommendation,
    risk_score:          riskScore,
    risk_level:          riskScore <= 30 ? "low" : riskScore <= 60 ? "medium" : "high",
    fee_usd:             FEES.screen_tenant,
    created_at:          now,
  };
}

// ─── Create Lease ─────────────────────────────────────────────────────────────

/**
 * Generate a lease agreement for a property and tenant.
 * @param {string} propertyId  - Property identifier
 * @param {object} tenantData  - { name, email, phone }
 * @param {object} terms       - { start_date, end_date, monthly_rent_usd, security_deposit, pets_allowed, utilities }
 * @returns Lease record with document preview, terms summary, required signatures, and move-in checklist
 */
export function createLease(propertyId, tenantData, terms = {}) {
  if (!propertyId)          throw new Error("propertyId is required");
  if (!tenantData?.name)    throw new Error("tenantData.name is required");
  if (!terms.monthly_rent_usd) throw new Error("terms.monthly_rent_usd is required");

  const startDate      = terms.start_date ?? new Date().toISOString().split("T")[0];
  const endDateDefault = new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)).toISOString().split("T")[0];
  const endDate        = terms.end_date ?? endDateDefault;
  const secDeposit     = terms.security_deposit ?? terms.monthly_rent_usd * 2;
  const petsAllowed    = terms.pets_allowed ?? false;

  const id  = uuid();
  const now = new Date().toISOString();

  const termsSummary = {
    lease_type:          "fixed_term",
    start_date:          startDate,
    end_date:            endDate,
    monthly_rent_usd:    terms.monthly_rent_usd,
    security_deposit_usd: secDeposit,
    late_fee_usd:        50,
    grace_period_days:   5,
    pets_allowed:        petsAllowed,
    utilities_included:  terms.utilities ?? [],
    rent_increase_cap:   "3% per annum",
    notice_to_vacate_days: 30,
  };

  const documentPreview = `RESIDENTIAL LEASE AGREEMENT\n\nProperty: ${propertyId}\nTenant: ${tenantData.name}\nLease Term: ${startDate} to ${endDate}\nMonthly Rent: $${terms.monthly_rent_usd}\nSecurity Deposit: $${secDeposit}\n\n[Full 12-page lease document available at https://docs.hiveagent.io/lease/${id}]`;

  const requiredSignatures = [
    { party: "tenant",   name: tenantData.name,      signed: false, due_date: startDate },
    { party: "landlord", name: "Property Owner",      signed: false, due_date: startDate },
  ];
  if (tenantData.co_signer) {
    requiredSignatures.push({ party: "co_signer", name: tenantData.co_signer, signed: false, due_date: startDate });
  }

  const moveInChecklist = [
    { item: "Keys handed over",                  completed: false },
    { item: "Property walkthrough completed",    completed: false },
    { item: "Move-in condition report signed",   completed: false },
    { item: "Utility accounts transferred",      completed: false },
    { item: "Security deposit received",         completed: false },
    { item: "Renter's insurance proof provided", completed: false },
    { item: "Emergency contact form submitted",  completed: false },
    { item: "Parking assignment confirmed",      completed: false },
  ];

  db.prepare(`
    INSERT OR IGNORE INTO pm_leases
      (id, property_id, tenant_name, tenant_email, start_date, end_date, monthly_rent_usd,
       security_deposit, status, document_preview, terms_summary, required_signatures,
       move_in_checklist, fee_usd, created_at)
    VALUES
      (@id, @property_id, @tenant_name, @tenant_email, @start_date, @end_date,
       @monthly_rent_usd, @security_deposit, 'pending_signature', @document_preview,
       @terms_summary, @required_signatures, @move_in_checklist, @fee_usd, @created_at)
  `).run({
    id,
    property_id:        propertyId,
    tenant_name:        tenantData.name,
    tenant_email:       tenantData.email ?? null,
    start_date:         startDate,
    end_date:           endDate,
    monthly_rent_usd:   terms.monthly_rent_usd,
    security_deposit:   secDeposit,
    document_preview:   documentPreview,
    terms_summary:      JSON.stringify(termsSummary),
    required_signatures: JSON.stringify(requiredSignatures),
    move_in_checklist:  JSON.stringify(moveInChecklist),
    fee_usd:            FEES.create_lease,
    created_at:         now,
  });

  return {
    lease_id:            id,
    property_id:         propertyId,
    tenant:              { name: tenantData.name, email: tenantData.email ?? null },
    status:              "pending_signature",
    document_preview:    documentPreview,
    document_url:        `https://docs.hiveagent.io/lease/${id}`,
    terms_summary:       termsSummary,
    required_signatures: requiredSignatures,
    move_in_checklist:   moveInChecklist,
    fee_usd:             FEES.create_lease,
    created_at:          now,
  };
}

// ─── Track Maintenance ────────────────────────────────────────────────────────

/**
 * Create a maintenance request ticket for a property.
 * @param {string} propertyId       - Property identifier
 * @param {string} issueDescription - Description of the maintenance issue
 * @param {string} urgency          - low|medium|high|emergency
 * @param {string} tenantId         - Optional tenant who filed the request
 * @returns Ticket with priority, assigned vendor, estimated cost, and ETA
 */
export function trackMaintenance(propertyId, issueDescription, urgency = "medium", tenantId = null) {
  if (!propertyId)       throw new Error("propertyId is required");
  if (!issueDescription) throw new Error("issueDescription is required");
  if (!URGENCY_LEVELS.includes(urgency)) {
    throw new Error(`Invalid urgency. Must be one of: ${URGENCY_LEVELS.join(", ")}`);
  }

  const priorityMap = { low: 4, medium: 3, high: 2, emergency: 1 };
  const priority    = priorityMap[urgency];
  const vendor      = vendorForIssue(issueDescription);

  const costRanges  = { low: [50, 250], medium: [150, 800], high: [400, 2000], emergency: [800, 5000] };
  const [cMin, cMax] = costRanges[urgency];
  const estimatedCost = randomFloat(cMin, cMax);

  const etaHours  = { low: 72, medium: 24, high: 8, emergency: 2 };
  const hoursOut  = etaHours[urgency];
  const etaDate   = new Date(Date.now() + hoursOut * 3600000).toISOString();

  const id  = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO pm_maintenance_tickets
      (id, property_id, tenant_id, issue, urgency, priority, assigned_vendor,
       estimated_cost, eta, status, fee_usd, created_at)
    VALUES
      (@id, @property_id, @tenant_id, @issue, @urgency, @priority, @assigned_vendor,
       @estimated_cost, @eta, 'open', @fee_usd, @created_at)
  `).run({
    id,
    property_id:     propertyId,
    tenant_id:       tenantId,
    issue:           issueDescription,
    urgency,
    priority,
    assigned_vendor: vendor,
    estimated_cost:  estimatedCost,
    eta:             etaDate,
    fee_usd:         FEES.track_maintenance,
    created_at:      now,
  });

  return {
    ticket_id:       id,
    property_id:     propertyId,
    tenant_id:       tenantId,
    issue:           issueDescription,
    urgency,
    priority,
    status:          "open",
    assigned_vendor: vendor,
    estimated_cost_usd: estimatedCost,
    eta:             etaDate,
    eta_hours:       hoursOut,
    fee_usd:         FEES.track_maintenance,
    created_at:      now,
  };
}

// ─── Optimize Rent ────────────────────────────────────────────────────────────

/**
 * Analyze market conditions and recommend optimal rent pricing.
 * @param {string} propertyId   - Property identifier
 * @param {number} currentRent  - Current monthly rent in USD
 * @param {object} marketData   - { zip_code, bedrooms, bathrooms, sqft, amenities[] }
 * @returns Recommended rent, market comparison, occupancy impact, and revenue projection
 */
export function optimizeRent(propertyId, currentRent, marketData = {}) {
  if (!propertyId)            throw new Error("propertyId is required");
  if (currentRent == null || currentRent <= 0) throw new Error("currentRent must be a positive number");

  const id  = uuid();
  const now = new Date().toISOString();

  const marketMedian     = currentRent * randomFloat(0.90, 1.15);
  const marketPercentile = randomInt(30, 80);
  const recommendedRent  = parseFloat((currentRent * randomFloat(1.02, 1.08)).toFixed(2));
  const changePercent    = parseFloat((((recommendedRent - currentRent) / currentRent) * 100).toFixed(1));

  const marketComparison = {
    median_market_rent:  parseFloat(marketMedian.toFixed(2)),
    your_rent_percentile: marketPercentile,
    comparable_units:    randomInt(8, 25),
    avg_days_on_market:  randomInt(14, 45),
    absorption_rate:     `${randomFloat(85, 98)}%`,
    zip_code:            marketData.zip_code ?? "00000",
  };

  const occupancyImpact = {
    current_occupancy_pct:  randomFloat(88, 99),
    projected_at_new_rent:  randomFloat(82, 97),
    vacancy_risk:           changePercent > 5 ? "medium" : "low",
    avg_tenant_tenure_months: randomInt(14, 36),
  };

  const annualCurrentRevenue    = currentRent * 12;
  const annualRecommendedRevenue = recommendedRent * 12;
  const revenueProjection = {
    annual_current_usd:    annualCurrentRevenue,
    annual_recommended_usd: annualRecommendedRevenue,
    annual_increase_usd:   parseFloat((annualRecommendedRevenue - annualCurrentRevenue).toFixed(2)),
    break_even_vacancy_days: Math.floor((recommendedRent - currentRent) === 0
      ? 0
      : 30 / ((recommendedRent - currentRent) / currentRent * 100)),
    five_year_projection:  parseFloat((annualRecommendedRevenue * 5 * 1.03).toFixed(2)),
  };

  db.prepare(`
    INSERT OR IGNORE INTO pm_rent_optimizations
      (id, property_id, current_rent, recommended_rent, market_comparison,
       occupancy_impact, revenue_projection, fee_usd, created_at)
    VALUES
      (@id, @property_id, @current_rent, @recommended_rent, @market_comparison,
       @occupancy_impact, @revenue_projection, @fee_usd, @created_at)
  `).run({
    id,
    property_id:        propertyId,
    current_rent:       currentRent,
    recommended_rent:   recommendedRent,
    market_comparison:  JSON.stringify(marketComparison),
    occupancy_impact:   JSON.stringify(occupancyImpact),
    revenue_projection: JSON.stringify(revenueProjection),
    fee_usd:            FEES.optimize_rent,
    created_at:         now,
  });

  return {
    analysis_id:        id,
    property_id:        propertyId,
    current_rent_usd:   currentRent,
    recommended_rent_usd: recommendedRent,
    change_percent:     changePercent,
    market_comparison:  marketComparison,
    occupancy_impact:   occupancyImpact,
    revenue_projection: revenueProjection,
    fee_usd:            FEES.optimize_rent,
    created_at:         now,
  };
}

// ─── Manage Rent Collection ───────────────────────────────────────────────────

/**
 * Track rent collection status for all tenants at a property.
 * @param {string}   propertyId - Property identifier
 * @param {object[]} tenants    - Array of { id, name, rent_due_usd, due_date }
 * @returns Collection status per tenant with next-action recommendations
 */
export function manageRentCollection(propertyId, tenants) {
  if (!propertyId)  throw new Error("propertyId is required");
  if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
    throw new Error("tenants must be a non-empty array");
  }

  const id  = uuid();
  const now = new Date().toISOString();
  const today = new Date();

  const collectionStatus = tenants.map(tenant => {
    const dueDate  = tenant.due_date ? new Date(tenant.due_date) : new Date(today.getFullYear(), today.getMonth(), 1);
    const daysLate = Math.max(0, Math.floor((today - dueDate) / 86400000));
    const paid     = daysLate === 0 ? Math.random() > 0.15 : Math.random() > 0.4;

    let nextAction;
    if (paid) {
      nextAction = "none";
    } else if (daysLate === 0) {
      nextAction = "send_reminder";
    } else if (daysLate <= 5) {
      nextAction = "courtesy_call";
    } else if (daysLate <= 14) {
      nextAction = "late_fee_notice";
    } else {
      nextAction = "eviction_notice_consideration";
    }

    return {
      tenant_id:   tenant.id ?? uuid().slice(0, 8),
      tenant_name: tenant.name ?? "Unknown Tenant",
      amount_due:  tenant.rent_due_usd ?? 0,
      paid,
      amount_paid: paid ? (tenant.rent_due_usd ?? 0) : 0,
      days_late:   paid ? 0 : daysLate,
      due_date:    dueDate.toISOString().split("T")[0],
      late_fee_usd: paid || daysLate <= 5 ? 0 : 50,
      next_action: nextAction,
    };
  });

  const totalDue   = collectionStatus.reduce((s, t) => s + (t.amount_due ?? 0), 0);
  const totalPaid  = collectionStatus.reduce((s, t) => s + (t.amount_paid ?? 0), 0);
  const delinquent = collectionStatus.filter(t => !t.paid).length;

  const summary = {
    total_due_usd:       parseFloat(totalDue.toFixed(2)),
    total_collected_usd: parseFloat(totalPaid.toFixed(2)),
    collection_rate_pct: totalDue > 0 ? parseFloat(((totalPaid / totalDue) * 100).toFixed(1)) : 100,
    delinquent_count:    delinquent,
    on_time_count:       collectionStatus.filter(t => t.paid).length,
  };

  db.prepare(`
    INSERT OR IGNORE INTO pm_rent_collections
      (id, property_id, collection_data, summary, fee_usd, created_at)
    VALUES
      (@id, @property_id, @collection_data, @summary, @fee_usd, @created_at)
  `).run({
    id,
    property_id:     propertyId,
    collection_data: JSON.stringify(collectionStatus),
    summary:         JSON.stringify(summary),
    fee_usd:         FEES.rent_collection,
    created_at:      now,
  });

  return {
    collection_id:     id,
    property_id:       propertyId,
    collection_status: collectionStatus,
    summary,
    fee_usd:           FEES.rent_collection,
    created_at:        now,
  };
}

// ─── Get Property Dashboard ───────────────────────────────────────────────────

/**
 * Retrieve portfolio-level analytics for a property manager.
 * @param {string} portfolioId - Portfolio identifier
 * @returns Occupancy rate, revenue, maintenance costs, delinquency rate, appreciation estimate
 */
export function getPropertyDashboard(portfolioId) {
  if (!portfolioId) throw new Error("portfolioId is required");

  const id  = uuid();
  const now = new Date().toISOString();

  // Pull from DB if available
  const existing = db.prepare("SELECT * FROM pm_portfolios WHERE portfolio_id = ?").get(portfolioId);

  const totalProperties      = existing?.property_count   ?? randomInt(3, 25);
  const occupancyRate        = existing?.occupancy_rate    ?? randomFloat(85, 98);
  const monthlyRevenue       = existing?.monthly_revenue   ?? randomFloat(15000, 120000);
  const maintenanceCosts     = existing?.maintenance_costs ?? randomFloat(800, 8000);
  const delinquencyRate      = existing?.delinquency_rate  ?? randomFloat(1, 8);
  const appreciationEstimate = existing?.appreciation_estimate ?? randomFloat(3, 9);

  // Recent maintenance tickets
  const openTickets = db.prepare(`
    SELECT id, property_id, issue, urgency, status, created_at
    FROM pm_maintenance_tickets
    WHERE status IN ('open','in_progress')
    ORDER BY priority ASC
    LIMIT 10
  `).all();

  // Recent screenings
  const recentScreenings = db.prepare(`
    SELECT id, applicant_name, recommendation, risk_score, created_at
    FROM pm_tenant_screenings
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  db.prepare(`
    INSERT OR IGNORE INTO pm_portfolios
      (id, portfolio_id, property_count, occupancy_rate, monthly_revenue,
       maintenance_costs, delinquency_rate, appreciation_estimate, last_updated)
    VALUES
      (@id, @portfolio_id, @property_count, @occupancy_rate, @monthly_revenue,
       @maintenance_costs, @delinquency_rate, @appreciation_estimate, @last_updated)
    ON CONFLICT(portfolio_id) DO UPDATE SET
      last_updated = excluded.last_updated
  `).run({
    id,
    portfolio_id:          portfolioId,
    property_count:        totalProperties,
    occupancy_rate:        occupancyRate,
    monthly_revenue:       monthlyRevenue,
    maintenance_costs:     maintenanceCosts,
    delinquency_rate:      delinquencyRate,
    appreciation_estimate: appreciationEstimate,
    last_updated:          now,
  });

  return {
    dashboard_id:          id,
    portfolio_id:          portfolioId,
    total_properties:      totalProperties,
    occupancy_rate:        occupancyRate,
    revenue: {
      monthly_usd:         parseFloat(monthlyRevenue.toFixed(2)),
      annual_usd:          parseFloat((monthlyRevenue * 12).toFixed(2)),
      noi_usd:             parseFloat((monthlyRevenue - maintenanceCosts).toFixed(2)),
    },
    maintenance_costs_usd: parseFloat(maintenanceCosts.toFixed(2)),
    delinquency_rate_pct:  delinquencyRate,
    appreciation_estimate_pct: appreciationEstimate,
    open_maintenance_tickets: openTickets.length,
    maintenance_tickets:   openTickets,
    recent_screenings:     recentScreenings,
    health_score:          parseFloat(((occupancyRate + (100 - delinquencyRate) + (100 - maintenanceCosts / monthlyRevenue * 100)) / 3).toFixed(1)),
    fee_usd:               FEES.dashboard,
    generated_at:          now,
  };
}
