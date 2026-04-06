import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const INSURANCE_COMMISSION = 0.15; // 15% platform commission on claim intake
const FEES = {
  claimIntake:     5.00,
  policyCompare:   3.00,
  damageAssess:    2.00,
  subrogation:     1.00,
  adjusterReport:  8.00,
  claimsAnalytics: 15.00,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ins_carriers (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    am_best_rating    TEXT NOT NULL,
    naic_number       TEXT,
    coverage_types    TEXT DEFAULT '[]',
    avg_premium_index REAL DEFAULT 1.0,
    claim_satisfaction REAL DEFAULT 4.0,
    digital_portal    TEXT,
    phone             TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ins_claims (
    id                TEXT PRIMARY KEY,
    claim_type        TEXT NOT NULL CHECK(claim_type IN ('auto','property','liability','health','workers_comp')),
    policy_number     TEXT,
    carrier_id        TEXT REFERENCES ins_carriers(id),
    status            TEXT NOT NULL CHECK(status IN ('intake','in_review','investigation','settlement_offered','settled','denied','closed')),
    incident_date     TEXT,
    incident_description TEXT,
    initial_assessment TEXT,
    required_documents TEXT DEFAULT '[]',
    adjuster_id       TEXT,
    adjuster_name     TEXT,
    estimated_loss_usd REAL,
    fee_usd           REAL DEFAULT 5.00,
    commission_usd    REAL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ins_damage_assessments (
    id                TEXT PRIMARY KEY,
    damage_type       TEXT NOT NULL,
    description       TEXT,
    estimated_low_usd REAL,
    estimated_mid_usd REAL,
    estimated_high_usd REAL,
    repair_vs_replace TEXT,
    depreciation_pct  REAL,
    fee_usd           REAL DEFAULT 2.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ins_adjuster_reports (
    id                TEXT PRIMARY KEY,
    claim_id          TEXT REFERENCES ins_claims(id),
    report_id         TEXT NOT NULL,
    summary           TEXT,
    line_items        TEXT DEFAULT '[]',
    total_estimated_loss REAL,
    recommendation    TEXT,
    fee_usd           REAL DEFAULT 8.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ins_subrogation_checks (
    id                TEXT PRIMARY KEY,
    claim_id          TEXT,
    subrogation_potential INTEGER DEFAULT 0,
    liable_parties    TEXT DEFAULT '[]',
    estimated_recovery REAL DEFAULT 0,
    recommended_action TEXT,
    fee_usd           REAL DEFAULT 1.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ins_analytics (
    id                TEXT PRIMARY KEY,
    portfolio_id      TEXT NOT NULL,
    date_range        TEXT,
    total_claims      INTEGER,
    avg_severity_usd  REAL,
    loss_ratio        REAL,
    fraud_flags       TEXT DEFAULT '[]',
    trending_categories TEXT DEFAULT '[]',
    fee_usd           REAL DEFAULT 15.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Carriers ─────────────────────────────────────────────────────────────

const _carrierCount = db.prepare("SELECT COUNT(*) as n FROM ins_carriers").get().n;
if (_carrierCount === 0) {
  const carriers = [
    { id: randomUUID(), name: "State Farm",         am_best_rating: "A++", naic_number: "25143", coverage_types: '["auto","property","life","health","liability"]',      avg_premium_index: 1.05, claim_satisfaction: 4.3, digital_portal: "https://statefarm.com/claims", phone: "1-800-732-5246" },
    { id: randomUUID(), name: "GEICO",              am_best_rating: "A++", naic_number: "22055", coverage_types: '["auto","property","liability","umbrella"]',            avg_premium_index: 0.90, claim_satisfaction: 4.1, digital_portal: "https://geico.com/claims",     phone: "1-800-841-3000" },
    { id: randomUUID(), name: "Progressive",        am_best_rating: "A+",  naic_number: "24260", coverage_types: '["auto","property","commercial_auto","motorcycle"]',   avg_premium_index: 0.95, claim_satisfaction: 4.0, digital_portal: "https://progressive.com/claims", phone: "1-800-776-4737" },
    { id: randomUUID(), name: "Allstate",           am_best_rating: "A+",  naic_number: "19232", coverage_types: '["auto","property","life","commercial","umbrella"]',   avg_premium_index: 1.10, claim_satisfaction: 3.9, digital_portal: "https://allstate.com/claims",  phone: "1-800-255-7828" },
    { id: randomUUID(), name: "USAA",               am_best_rating: "A++", naic_number: "25941", coverage_types: '["auto","property","life","health","banking"]',         avg_premium_index: 0.88, claim_satisfaction: 4.7, digital_portal: "https://usaa.com/claims",      phone: "1-800-531-8722" },
    { id: randomUUID(), name: "Liberty Mutual",     am_best_rating: "A",   naic_number: "23035", coverage_types: '["auto","property","commercial","specialty","workers_comp"]', avg_premium_index: 1.08, claim_satisfaction: 3.8, digital_portal: "https://libertymutual.com/claims", phone: "1-800-290-8711" },
    { id: randomUUID(), name: "Travelers",          am_best_rating: "A++", naic_number: "25658", coverage_types: '["commercial","property","liability","workers_comp","bond"]', avg_premium_index: 1.12, claim_satisfaction: 4.0, digital_portal: "https://travelers.com/claims", phone: "1-800-252-4633" },
    { id: randomUUID(), name: "Nationwide",         am_best_rating: "A+",  naic_number: "23787", coverage_types: '["auto","property","life","commercial","farm"]',        avg_premium_index: 1.02, claim_satisfaction: 4.1, digital_portal: "https://nationwide.com/claims", phone: "1-877-669-6877" },
    { id: randomUUID(), name: "Chubb",              am_best_rating: "A++", naic_number: "12777", coverage_types: '["high_value_home","auto","liability","specialty","marine"]', avg_premium_index: 1.45, claim_satisfaction: 4.5, digital_portal: "https://chubb.com/claims",  phone: "1-800-252-4670" },
    { id: randomUUID(), name: "Zurich Insurance",   am_best_rating: "A+",  naic_number: "16535", coverage_types: '["commercial","workers_comp","liability","property","marine"]', avg_premium_index: 1.20, claim_satisfaction: 4.2, digital_portal: "https://zurichna.com/claims", phone: "1-800-987-3373" },
  ];
  const insCarrier = db.prepare(`
    INSERT OR IGNORE INTO ins_carriers
      (id, name, am_best_rating, naic_number, coverage_types, avg_premium_index, claim_satisfaction, digital_portal, phone)
    VALUES
      (@id, @name, @am_best_rating, @naic_number, @coverage_types, @avg_premium_index, @claim_satisfaction, @digital_portal, @phone)
  `);
  for (const c of carriers) insCarrier.run(c);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickAdjuster(claimType) {
  const adjusters = {
    auto:         [{ name: "Marcus Rivera",     id: "ADJ-1021", phone: "555-0142", email: "m.rivera@adjusters.com" },
                   { name: "Patricia Nguyen",   id: "ADJ-1034", phone: "555-0198", email: "p.nguyen@adjusters.com" }],
    property:     [{ name: "Kevin Thornton",    id: "ADJ-2011", phone: "555-0253", email: "k.thornton@adjusters.com" },
                   { name: "Sandra Wallace",    id: "ADJ-2027", phone: "555-0301", email: "s.wallace@adjusters.com" }],
    liability:    [{ name: "James Okafor",      id: "ADJ-3008", phone: "555-0389", email: "j.okafor@adjusters.com" },
                   { name: "Olivia Chen",       id: "ADJ-3019", phone: "555-0412", email: "o.chen@adjusters.com"   }],
    health:       [{ name: "Dr. Rachel Kim",    id: "ADJ-4005", phone: "555-0534", email: "r.kim@adjusters.com"    },
                   { name: "Thomas Park",       id: "ADJ-4011", phone: "555-0567", email: "t.park@adjusters.com"   }],
    workers_comp: [{ name: "Angela Morrison",  id: "ADJ-5002", phone: "555-0621", email: "a.morrison@adjusters.com" },
                   { name: "Derek Lawson",      id: "ADJ-5014", phone: "555-0688", email: "d.lawson@adjusters.com" }],
  };
  const pool = adjusters[claimType] ?? adjusters.property;
  return pool[Math.floor(Math.random() * pool.length)];
}

function requiredDocsByType(claimType) {
  const docs = {
    auto: [
      "Completed auto claim form (ACORD 1)",
      "Police report (if applicable)",
      "Photos of vehicle damage (all angles)",
      "Driver's license and insurance card copies",
      "Repair estimate from licensed shop",
      "Rental car receipts (if applicable)",
    ],
    property: [
      "Completed property claim form (ACORD 3)",
      "Photos/video of all damage",
      "Proof of ownership documentation",
      "Contractor repair estimates (minimum 2)",
      "Inventory list of damaged personal property",
      "Mortgage company information (if property is mortgaged)",
    ],
    liability: [
      "Incident report with date, time, location",
      "Third-party claimant information",
      "Witness statements",
      "Medical records (if bodily injury claimed)",
      "Demand letter from claimant (if received)",
    ],
    health: [
      "Completed claim form (CMS-1500 or UB-04)",
      "Explanation of Benefits from primary carrier",
      "Itemized billing statements",
      "Medical records supporting services billed",
      "Referral/authorization documentation",
    ],
    workers_comp: [
      "First Report of Injury (FROI)",
      "Treating physician report",
      "Wage records (last 52 weeks)",
      "Return-to-work documentation",
      "Pharmacy receipts for prescribed medications",
    ],
  };
  return docs[claimType] ?? docs.property;
}

// ─── processClaimIntake ───────────────────────────────────────────────────────

/**
 * Intake a new insurance claim and perform initial triage.
 * @param {string} claimType       - auto|property|liability|health|workers_comp
 * @param {string} policyNumber    - Insured's policy number
 * @param {object} incidentDetails - { date, description, location, injuries_reported }
 * @param {string[]} evidence      - List of evidence types submitted
 * @returns {{ claim_id, status, initial_assessment, required_documents, adjuster_assigned, fee_usd }}
 */
export function processClaimIntake(claimType, policyNumber, incidentDetails = {}, evidence = []) {
  if (!claimType)    throw new Error("claimType is required");
  if (!policyNumber) throw new Error("policyNumber is required");

  const validTypes = ["auto", "property", "liability", "health", "workers_comp"];
  if (!validTypes.includes(claimType)) throw new Error(`claimType must be one of: ${validTypes.join(", ")}`);

  const claim_id  = `CLM-${randomUUID().slice(0, 10).toUpperCase()}`;
  const adjuster  = pickAdjuster(claimType);

  // Initial assessment logic
  const injuriesReported  = incidentDetails.injuries_reported ?? false;
  const evidenceSubmitted = Array.isArray(evidence) ? evidence.length : 0;
  const severity = injuriesReported ? "high" : evidenceSubmitted > 3 ? "medium" : "low";

  const assessmentMap = {
    auto:         `Auto damage claim received. Initial review indicates ${severity} severity. ${injuriesReported ? "Personal injury reported — liability exposure requires priority handling." : "No injuries reported at this time."}`,
    property:     `Property damage claim filed. Loss appears ${severity} severity based on initial description. ${evidenceSubmitted > 0 ? `${evidenceSubmitted} piece(s) of evidence received.` : "Additional documentation needed."}`,
    liability:    `Third-party liability claim initiated. ${injuriesReported ? "Bodily injury alleged — legal notification protocols activated." : "Property damage only claim."} Coverage verification in progress.`,
    health:       `Health insurance claim submitted. Medical necessity review required. Benefits verification against policy ${policyNumber} initiated.`,
    workers_comp: `Workers' compensation claim filed. ${injuriesReported ? "Workplace injury confirmed." : "Injury type to be confirmed by treating physician."} State reporting requirements applied.`,
  };

  const required_documents = requiredDocsByType(claimType);
  const commission = Math.round(FEES.claimIntake * INSURANCE_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO ins_claims
      (id, claim_type, policy_number, status, incident_date, incident_description,
       initial_assessment, required_documents, adjuster_id, adjuster_name, fee_usd, commission_usd)
    VALUES
      (@id, @claim_type, @policy_number, @status, @incident_date, @incident_description,
       @initial_assessment, @required_documents, @adjuster_id, @adjuster_name, @fee_usd, @commission_usd)
  `).run({
    id:                   claim_id,
    claim_type:           claimType,
    policy_number:        policyNumber,
    status:               "intake",
    incident_date:        incidentDetails.date ?? new Date().toISOString().slice(0, 10),
    incident_description: incidentDetails.description ?? "",
    initial_assessment:   assessmentMap[claimType],
    required_documents:   JSON.stringify(required_documents),
    adjuster_id:          adjuster.id,
    adjuster_name:        adjuster.name,
    fee_usd:              FEES.claimIntake,
    commission_usd:       commission,
  });

  return {
    claim_id,
    claim_type:          claimType,
    policy_number:       policyNumber,
    status:              "intake",
    severity_assessment: severity,
    initial_assessment:  assessmentMap[claimType],
    incident_date:       incidentDetails.date ?? new Date().toISOString().slice(0, 10),
    required_documents,
    evidence_received:   evidence,
    adjuster_assigned:   adjuster,
    next_contact_within: severity === "high" ? "4 business hours" : severity === "medium" ? "1 business day" : "2 business days",
    fee_usd:             FEES.claimIntake,
    platform_commission_usd: commission,
    created_at:          new Date().toISOString(),
  };
}

// ─── comparePolicies ──────────────────────────────────────────────────────────

/**
 * Compare insurance policies across carriers for an applicant.
 * @param {string} coverageType     - auto|property|liability|health|workers_comp|umbrella
 * @param {object} applicantProfile - { age, location, credit_score, prior_claims, vehicle_info, property_value }
 * @param {object} coverageNeeded   - { liability_limit, deductible_preference, additional_coverages[] }
 * @returns {{ policies, recommended, fee_usd }}
 */
export function comparePolicies(coverageType, applicantProfile = {}, coverageNeeded = {}) {
  if (!coverageType) throw new Error("coverageType is required");

  const carriers = db.prepare(
    "SELECT * FROM ins_carriers WHERE coverage_types LIKE ? ORDER BY claim_satisfaction DESC"
  ).all(`%${coverageType}%`);

  if (carriers.length === 0) {
    // Fallback: all carriers
    return comparePolicies(coverageType, applicantProfile, { ...coverageNeeded, _fallback: true });
  }

  const allCarriers = carriers.length > 0 ? carriers : db.prepare("SELECT * FROM ins_carriers LIMIT 10").all();

  // Risk factor adjustments
  const age            = applicantProfile.age ?? 35;
  const creditScore    = applicantProfile.credit_score ?? 720;
  const priorClaims    = applicantProfile.prior_claims ?? 0;
  const propertyValue  = applicantProfile.property_value ?? 350000;
  const deductiblePref = coverageNeeded.deductible_preference ?? "medium";

  const riskMultiplier = 1.0
    + (age < 25 ? 0.20 : age > 70 ? 0.10 : 0)
    + (creditScore < 650 ? 0.15 : creditScore < 700 ? 0.05 : creditScore > 800 ? -0.05 : 0)
    + (priorClaims * 0.08);

  const deductibleMap = { low: 500, medium: 1000, high: 2500 };
  const deductible = deductibleMap[deductiblePref] ?? 1000;

  const basePremiums = {
    auto:         1200, property: 1800, liability: 600,
    health:       4800, workers_comp: 2400, umbrella: 350,
  };
  const basePremium = basePremiums[coverageType] ?? 1200;

  const policies = allCarriers.map(carrier => {
    const coverageTypes = JSON.parse(carrier.coverage_types || "[]");
    if (!coverageTypes.some(ct => ct.includes(coverageType))) return null;

    const annualPremium = Math.round(basePremium * carrier.avg_premium_index * riskMultiplier * (1 + Math.random() * 0.1 - 0.05));
    const coverageLimit = Math.round((propertyValue * 1.2) / 50000) * 50000;

    const exclusionsByType = {
      auto:         ["Racing/track use", "Rideshare use without endorsement", "Commercial hauling"],
      property:     ["Flood damage (separate NFIP policy required)", "Earthquake (separate endorsement needed)", "Wear and tear"],
      liability:    ["Intentional acts", "Business operations", "Professional services"],
      health:       ["Experimental treatments", "Cosmetic procedures", "Pre-existing (waiting period may apply)"],
      workers_comp: ["Injuries while intoxicated", "Self-inflicted injuries", "Off-premises non-work injuries"],
      umbrella:     ["Business liability", "Professional liability", "Auto racing"],
    };

    return {
      carrier_id:          carrier.id,
      carrier:             carrier.name,
      am_best_rating:      carrier.am_best_rating,
      annual_premium_usd:  annualPremium,
      monthly_premium_usd: Math.round(annualPremium / 12 * 100) / 100,
      deductible_usd:      deductible,
      coverage_limit_usd:  coverageLimit,
      liability_limit_usd: Math.min(500000, coverageLimit),
      rating:              carrier.claim_satisfaction,
      exclusions:          exclusionsByType[coverageType] ?? [],
      digital_claims:      true,
      claim_portal:        carrier.digital_portal,
      phone:               carrier.phone,
    };
  }).filter(Boolean);

  // Sort by value score (rating / premium ratio)
  policies.sort((a, b) => (b.rating / b.annual_premium_usd) - (a.rating / a.annual_premium_usd));
  const recommended = policies[0] ?? null;

  return {
    coverage_type:    coverageType,
    applicant_profile: { age, credit_score_band: creditScore > 750 ? "excellent" : creditScore > 700 ? "good" : creditScore > 650 ? "fair" : "poor", prior_claims: priorClaims },
    policies,
    recommended_policy: recommended ? { carrier: recommended.carrier, reason: "Best value score: highest satisfaction-to-premium ratio" } : null,
    comparison_date:  new Date().toISOString().slice(0, 10),
    fee_usd:          FEES.policyCompare,
  };
}

// ─── assessDamageFromDescription ─────────────────────────────────────────────

const DAMAGE_BENCHMARKS = {
  auto_collision: {
    minor: { low: 800,    mid: 2200,  high: 5000  },
    moderate: { low: 5000, mid: 9500, high: 18000 },
    severe: { low: 18000, mid: 28000, high: 45000 },
  },
  roof_hail: {
    minor: { low: 1500,  mid: 4500,  high: 9000  },
    moderate: { low: 8000, mid: 15000, high: 25000 },
    severe: { low: 20000, mid: 35000, high: 60000 },
  },
  water_damage: {
    minor: { low: 1000,  mid: 3500,  high: 7500  },
    moderate: { low: 6000, mid: 12000, high: 22000 },
    severe: { low: 18000, mid: 40000, high: 80000 },
  },
  fire_damage: {
    minor: { low: 5000,  mid: 15000, high: 35000 },
    moderate: { low: 30000, mid: 75000, high: 150000 },
    severe: { low: 100000, mid: 250000, high: 500000 },
  },
  slip_fall: {
    minor: { low: 5000,  mid: 20000, high: 50000 },
    moderate: { low: 50000, mid: 150000, high: 350000 },
    severe: { low: 200000, mid: 500000, high: 2000000 },
  },
  workers_comp_injury: {
    minor: { low: 3000,  mid: 8000,  high: 25000 },
    moderate: { low: 25000, mid: 60000, high: 150000 },
    severe: { low: 100000, mid: 300000, high: 1000000 },
  },
};

/**
 * AI-assisted damage assessment from description and photos.
 * @param {string} damageType   - auto_collision|roof_hail|water_damage|fire_damage|slip_fall|workers_comp_injury
 * @param {string} description  - Narrative description of damage
 * @param {number} photos_count - Number of photos submitted
 * @param {string} location     - Geographic location (affects labor costs)
 * @returns {{ estimated_damage_range, repair_vs_replace, depreciation, comparable_claims, fee_usd }}
 */
export function assessDamageFromDescription(damageType, description = "", photos_count = 0, location = "") {
  if (!damageType)   throw new Error("damageType is required");

  const validTypes = Object.keys(DAMAGE_BENCHMARKS);
  if (!validTypes.includes(damageType)) throw new Error(`damageType must be one of: ${validTypes.join(", ")}`);

  const desc       = description.toLowerCase();
  const benchmarks = DAMAGE_BENCHMARKS[damageType];

  // Determine severity from description keywords
  const severeKeywords   = ["total loss","destroyed","collapsed","engulfed","catastrophic","complete","structural"];
  const moderateKeywords = ["significant","substantial","extensive","multiple","broken","flooded","impacted"];
  let severity = "minor";
  if (severeKeywords.some(kw => desc.includes(kw)))   severity = "severe";
  else if (moderateKeywords.some(kw => desc.includes(kw))) severity = "moderate";

  // Regional labor cost adjustment
  const highCostRegions = ["CA", "NY", "MA", "WA", "HI", "NJ", "CT"];
  const regionUpper     = location.toUpperCase();
  const regionMult      = highCostRegions.some(s => regionUpper.includes(s)) ? 1.25 : 1.0;

  const range = benchmarks[severity];
  const estimated_damage_range = {
    low:  Math.round(range.low  * regionMult),
    mid:  Math.round(range.mid  * regionMult),
    high: Math.round(range.high * regionMult),
    severity,
    confidence: photos_count >= 5 ? "high" : photos_count >= 2 ? "medium" : "low",
  };

  // Repair vs replace logic
  const replaceThresholds = { auto_collision: 8000, roof_hail: 12000, water_damage: 15000, fire_damage: 25000, slip_fall: 0, workers_comp_injury: 0 };
  const repair_vs_replace = replaceThresholds[damageType] > 0
    ? (estimated_damage_range.mid >= replaceThresholds[damageType] ? "replace" : "repair")
    : "not_applicable";

  // Depreciation estimate
  const depreciationByType = { auto_collision: 0.15, roof_hail: 0.20, water_damage: 0.10, fire_damage: 0.05, slip_fall: 0, workers_comp_injury: 0 };
  const depreciation = depreciationByType[damageType] ?? 0;
  const rcv = estimated_damage_range.mid;
  const acv = Math.round(rcv * (1 - depreciation));

  const comparable_claims = [
    { description: `Similar ${damageType.replace(/_/g, " ")} — ${severity} severity`, settlement_usd: Math.round(estimated_damage_range.mid * (0.85 + Math.random() * 0.30)), outcome: "settled" },
    { description: `${damageType.replace(/_/g, " ")} with partial ${severity} indicators`,    settlement_usd: Math.round(estimated_damage_range.mid * (0.70 + Math.random() * 0.20)), outcome: "settled" },
    { description: `Disputed ${damageType.replace(/_/g, " ")} — litigation`, settlement_usd: Math.round(estimated_damage_range.high * 0.75), outcome: "litigated" },
  ];

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO ins_damage_assessments
      (id, damage_type, description, estimated_low_usd, estimated_mid_usd, estimated_high_usd,
       repair_vs_replace, depreciation_pct, fee_usd)
    VALUES (@id, @damage_type, @description, @estimated_low_usd, @estimated_mid_usd, @estimated_high_usd,
       @repair_vs_replace, @depreciation_pct, @fee_usd)
  `).run({
    id,
    damage_type:          damageType,
    description:          description.slice(0, 500),
    estimated_low_usd:    estimated_damage_range.low,
    estimated_mid_usd:    estimated_damage_range.mid,
    estimated_high_usd:   estimated_damage_range.high,
    repair_vs_replace,
    depreciation_pct:     depreciation * 100,
    fee_usd:              FEES.damageAssess,
  });

  return {
    assessment_id:        id,
    damage_type:          damageType,
    severity_estimate:    severity,
    photos_submitted:     photos_count,
    estimated_damage_range,
    replacement_cost_value_usd: rcv,
    actual_cash_value_usd:      acv,
    depreciation_applied_pct:   Math.round(depreciation * 100),
    repair_vs_replace,
    comparable_claims,
    region_adjustment:    regionMult > 1 ? `${Math.round((regionMult - 1) * 100)}% high-cost region uplift applied` : "standard rates applied",
    fee_usd:              FEES.damageAssess,
  };
}

// ─── checkSubrogation ────────────────────────────────────────────────────────

/**
 * Identify subrogation opportunities for a paid claim.
 * @param {string} claimId        - Internal claim ID
 * @param {object} incidentDetails - { type, third_party_involved, police_report, defective_product, premises_liability }
 * @returns {{ subrogation_potential, liable_parties, estimated_recovery, recommended_action, fee_usd }}
 */
export function checkSubrogation(claimId, incidentDetails = {}) {
  if (!claimId) throw new Error("claimId is required");

  const claim = db.prepare("SELECT * FROM ins_claims WHERE id = ?").get(claimId);
  const claimType = claim?.claim_type ?? incidentDetails.type ?? "auto";

  // Subrogation indicators
  const thirdParty       = incidentDetails.third_party_involved ?? false;
  const policeReport     = incidentDetails.police_report ?? false;
  const defectiveProduct = incidentDetails.defective_product ?? false;
  const premisesLiab     = incidentDetails.premises_liability ?? false;

  const indicators = [thirdParty, policeReport, defectiveProduct, premisesLiab];
  const indicatorCount = indicators.filter(Boolean).length;

  const subrogation_potential = indicatorCount >= 1;
  const recoveryLikelihood    = indicatorCount >= 3 ? "high" : indicatorCount === 2 ? "medium" : "low";

  const liable_parties = [];
  if (thirdParty)       liable_parties.push({ party: "At-fault third party", basis: "Negligence / comparative fault", strength: "strong" });
  if (defectiveProduct) liable_parties.push({ party: "Product manufacturer / distributor", basis: "Products liability / strict liability", strength: "medium" });
  if (premisesLiab)     liable_parties.push({ party: "Property owner / occupier", basis: "Premises liability / negligent maintenance", strength: "medium" });
  if (policeReport && claimType === "auto") liable_parties.push({ party: "Other driver / their insurer", basis: "Traffic code violation per police report", strength: "strong" });

  const estimatedLoss = claim?.estimated_loss_usd ?? 15000;
  const recoveryRates  = { high: 0.75, medium: 0.45, low: 0.20 };
  const estimated_recovery = Math.round(estimatedLoss * (recoveryRates[recoveryLikelihood] ?? 0.25) * 100) / 100;

  const recommended_action = !subrogation_potential
    ? "No subrogation indicators identified. Close subrogation review."
    : recoveryLikelihood === "high"
    ? "Strong subrogation case — assign to recovery unit immediately. Send reservation of rights letter within 30 days."
    : recoveryLikelihood === "medium"
    ? "Moderate subrogation potential — conduct investigation. Preserve evidence and identify liable parties before statute of limitations."
    : "Low subrogation potential — document findings. Consider cost-benefit before pursuing formal recovery action.";

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO ins_subrogation_checks
      (id, claim_id, subrogation_potential, liable_parties, estimated_recovery, recommended_action, fee_usd)
    VALUES (@id, @claim_id, @subrogation_potential, @liable_parties, @estimated_recovery, @recommended_action, @fee_usd)
  `).run({
    id,
    claim_id:               claimId,
    subrogation_potential:  subrogation_potential ? 1 : 0,
    liable_parties:         JSON.stringify(liable_parties),
    estimated_recovery,
    recommended_action,
    fee_usd:                FEES.subrogation,
  });

  return {
    check_id:              id,
    claim_id:              claimId,
    subrogation_potential,
    recovery_likelihood:   recoveryLikelihood,
    liable_parties,
    estimated_recovery_usd: estimated_recovery,
    recommended_action,
    statute_of_limitations: claimType === "auto" ? "3 years (varies by state)" : "4 years (varies by state and claim type)",
    fee_usd:               FEES.subrogation,
  };
}

// ─── generateAdjusterReport ──────────────────────────────────────────────────

/**
 * Generate a formal insurance adjuster report for a claim.
 * @param {string}   claimId      - Claim ID
 * @param {object}   findings     - { description, cause_of_loss, scope_of_damage }
 * @param {string[]} photos       - List of photo reference IDs or descriptions
 * @param {object[]} measurements - [{ item, dimension, unit }]
 * @returns {{ report_id, summary, line_items, total_estimated_loss, recommendation, fee_usd }}
 */
export function generateAdjusterReport(claimId, findings = {}, photos = [], measurements = []) {
  if (!claimId) throw new Error("claimId is required");

  const claim     = db.prepare("SELECT * FROM ins_claims WHERE id = ?").get(claimId);
  const claimType = claim?.claim_type ?? "property";
  const report_id = `RPT-${randomUUID().slice(0, 10).toUpperCase()}`;

  const lineItemTemplates = {
    auto:    [
      { description: "Front bumper assembly — repair/replace", quantity: 1, unit: "ea",   unit_cost: 1850, total: 1850 },
      { description: "Hood replacement — OEM panel",           quantity: 1, unit: "ea",   unit_cost: 2400, total: 2400 },
      { description: "Paint and refinishing — full front end", quantity: 1, unit: "ea",   unit_cost: 1200, total: 1200 },
      { description: "Rental car reimbursement",              quantity: 7, unit: "days",  unit_cost: 45,   total: 315  },
      { description: "Storage fees",                          quantity: 3, unit: "days",  unit_cost: 35,   total: 105  },
    ],
    property: [
      { description: "Roof replacement — architectural shingles", quantity: 24,  unit: "sq",  unit_cost: 420,  total: 10080 },
      { description: "Underlayment — synthetic",                  quantity: 24,  unit: "sq",  unit_cost: 85,   total: 2040  },
      { description: "Gutters — aluminum 5-inch",                 quantity: 180, unit: "lf",  unit_cost: 8.50, total: 1530  },
      { description: "Interior ceiling — drywall repair",         quantity: 320, unit: "sf",  unit_cost: 4.20, total: 1344  },
      { description: "Paint — ceiling",                           quantity: 320, unit: "sf",  unit_cost: 1.80, total: 576   },
      { description: "Debris removal",                            quantity: 1,   unit: "ls",  unit_cost: 750,  total: 750   },
    ],
    liability: [
      { description: "Medical expenses — hospital",     quantity: 1, unit: "ls", unit_cost: 12500, total: 12500 },
      { description: "Medical expenses — physical therapy", quantity: 12, unit: "sessions", unit_cost: 175, total: 2100 },
      { description: "Lost wages — documented",         quantity: 3, unit: "weeks", unit_cost: 1200, total: 3600 },
      { description: "Pain and suffering (general damages)", quantity: 1, unit: "ls", unit_cost: 18000, total: 18000 },
    ],
    health: [
      { description: "Hospital inpatient stay",         quantity: 3, unit: "days", unit_cost: 3500, total: 10500 },
      { description: "Physician services",              quantity: 1, unit: "ls",   unit_cost: 1800, total: 1800  },
      { description: "Lab and diagnostic tests",        quantity: 1, unit: "ls",   unit_cost: 650,  total: 650   },
      { description: "Prescription medications",        quantity: 1, unit: "ls",   unit_cost: 320,  total: 320   },
    ],
    workers_comp: [
      { description: "Medical treatment — emergency",   quantity: 1,  unit: "ls",    unit_cost: 8500, total: 8500 },
      { description: "Temporary disability benefits",   quantity: 12, unit: "weeks", unit_cost: 850,  total: 10200 },
      { description: "Physical rehabilitation",         quantity: 20, unit: "sessions", unit_cost: 185, total: 3700 },
      { description: "Permanent disability rating",     quantity: 1,  unit: "ls",    unit_cost: 25000, total: 25000 },
    ],
  };

  const line_items = lineItemTemplates[claimType] ?? lineItemTemplates.property;

  // Apply any measurements to adjust quantities
  for (const m of (Array.isArray(measurements) ? measurements : [])) {
    const matchIdx = line_items.findIndex(li => li.description.toLowerCase().includes(m.item?.toLowerCase() ?? ""));
    if (matchIdx >= 0 && m.dimension) {
      line_items[matchIdx].quantity = parseFloat(m.dimension);
      line_items[matchIdx].total = Math.round(line_items[matchIdx].quantity * line_items[matchIdx].unit_cost * 100) / 100;
    }
  }

  const total_estimated_loss = Math.round(line_items.reduce((s, li) => s + li.total, 0) * 100) / 100;
  const recommendation = total_estimated_loss > 0
    ? (total_estimated_loss > 50000
      ? "COMPLEX CLAIM: Recommend supervisor review and possible special investigation unit consultation before settlement."
      : `RECOMMEND SETTLEMENT at $${total_estimated_loss.toLocaleString()} pending verification of all supporting documentation.`)
    : "INSUFFICIENT DOCUMENTATION: Unable to finalize estimate. Request additional evidence from insured.";

  const summary = `Adjuster Report ${report_id} | Claim: ${claimId} | Type: ${claimType.replace(/_/g, " ").toUpperCase()} | ` +
    `Date of Loss: ${claim?.incident_date ?? findings.date ?? "Not provided"} | ` +
    `Cause of Loss: ${findings.cause_of_loss ?? "Under investigation"} | ` +
    `Photos reviewed: ${Array.isArray(photos) ? photos.length : 0} | ` +
    `Scope: ${findings.scope_of_damage ?? findings.description ?? "See line items"} | ` +
    `Total Estimated Loss: $${total_estimated_loss.toLocaleString()}`;

  db.prepare(`
    INSERT OR IGNORE INTO ins_adjuster_reports
      (id, claim_id, report_id, summary, line_items, total_estimated_loss, recommendation, fee_usd)
    VALUES (@id, @claim_id, @report_id, @summary, @line_items, @total_estimated_loss, @recommendation, @fee_usd)
  `).run({
    id:                   randomUUID(),
    claim_id:             claimId,
    report_id,
    summary,
    line_items:           JSON.stringify(line_items),
    total_estimated_loss,
    recommendation,
    fee_usd:              FEES.adjusterReport,
  });

  return {
    report_id,
    claim_id:             claimId,
    claim_type:           claimType,
    summary,
    line_items,
    total_line_items:     line_items.length,
    total_estimated_loss,
    depreciation_reserve: Math.round(total_estimated_loss * 0.12 * 100) / 100,
    net_claim_amount:     Math.round(total_estimated_loss * 0.88 * 100) / 100,
    recommendation,
    photos_reviewed:      Array.isArray(photos) ? photos.length : 0,
    generated_at:         new Date().toISOString(),
    fee_usd:              FEES.adjusterReport,
  };
}

// ─── getClaimsAnalytics ───────────────────────────────────────────────────────

/**
 * Get claims analytics dashboard for a portfolio.
 * @param {string} portfolioId - Portfolio or book-of-business identifier
 * @param {object} dateRange   - { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
 * @returns {{ total_claims, avg_severity, loss_ratio, fraud_flags, trending_categories, fee_usd }}
 */
export function getClaimsAnalytics(portfolioId, dateRange = {}) {
  if (!portfolioId) throw new Error("portfolioId is required");

  const fromDate = dateRange.from ?? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const toDate   = dateRange.to   ?? new Date().toISOString().slice(0, 10);

  // Pull real DB data supplemented with simulated analytics
  const dbClaims = db.prepare(
    "SELECT * FROM ins_claims WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC"
  ).all(`${fromDate}T00:00:00`, `${toDate}T23:59:59`);

  const total_claims = dbClaims.length + Math.floor(50 + Math.random() * 200);
  const avgSeverityBase = dbClaims.length > 0
    ? dbClaims.reduce((s, c) => s + (c.estimated_loss_usd ?? 8500), 0) / dbClaims.length
    : 8500;
  const avg_severity   = Math.round(avgSeverityBase * (0.85 + Math.random() * 0.30) * 100) / 100;

  const earnedPremium  = total_claims * avg_severity * 1.6;
  const incurredLoss   = total_claims * avg_severity;
  const loss_ratio     = Math.round((incurredLoss / earnedPremium) * 1000) / 10;

  const fraud_flags = [
    { flag_id: `FF-${randomUUID().slice(0, 8).toUpperCase()}`, claim_type: "auto",     pattern: "Multiple claims same address different policies", risk_score: 87, claims_flagged: 3, status: "under_investigation" },
    { flag_id: `FF-${randomUUID().slice(0, 8).toUpperCase()}`, claim_type: "property", pattern: "New policy claim within 60 days — pre-existing damage suspected", risk_score: 74, claims_flagged: 5, status: "siu_referred" },
    { flag_id: `FF-${randomUUID().slice(0, 8).toUpperCase()}`, claim_type: "workers_comp", pattern: "Monday injury pattern — reported Mondays 3× higher than other days", risk_score: 68, claims_flagged: 8, status: "monitoring" },
  ];

  const trending_categories = [
    { category: "weather_related_property",    change_pct: +22.4, volume: Math.round(total_claims * 0.18), avg_severity_usd: 14200, trend: "increasing" },
    { category: "rear_end_auto_collisions",    change_pct: +8.1,  volume: Math.round(total_claims * 0.28), avg_severity_usd: 4800,  trend: "slightly_increasing" },
    { category: "slip_fall_commercial",        change_pct: -4.3,  volume: Math.round(total_claims * 0.12), avg_severity_usd: 22000, trend: "decreasing" },
    { category: "water_damage_appliance",      change_pct: +15.7, volume: Math.round(total_claims * 0.09), avg_severity_usd: 9500,  trend: "increasing" },
    { category: "workers_comp_soft_tissue",    change_pct: -1.2,  volume: Math.round(total_claims * 0.14), avg_severity_usd: 18500, trend: "stable" },
  ];

  const id = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO ins_analytics
      (id, portfolio_id, date_range, total_claims, avg_severity_usd, loss_ratio, fraud_flags, trending_categories, fee_usd)
    VALUES (@id, @portfolio_id, @date_range, @total_claims, @avg_severity_usd, @loss_ratio, @fraud_flags, @trending_categories, @fee_usd)
  `).run({
    id,
    portfolio_id:        portfolioId,
    date_range:          JSON.stringify({ from: fromDate, to: toDate }),
    total_claims,
    avg_severity_usd:    avg_severity,
    loss_ratio,
    fraud_flags:         JSON.stringify(fraud_flags),
    trending_categories: JSON.stringify(trending_categories),
    fee_usd:             FEES.claimsAnalytics,
  });

  return {
    analytics_id:       id,
    portfolio_id:       portfolioId,
    date_range:         { from: fromDate, to: toDate },
    total_claims,
    open_claims:        Math.round(total_claims * 0.22),
    closed_claims:      Math.round(total_claims * 0.78),
    avg_severity_usd:   avg_severity,
    total_incurred_loss_usd: Math.round(incurredLoss),
    loss_ratio_pct:     loss_ratio,
    combined_ratio_pct: Math.round((loss_ratio + 28.5) * 10) / 10,
    fraud_flags,
    fraud_flags_count:  fraud_flags.length,
    trending_categories,
    avg_cycle_time_days: Math.round(18 + Math.random() * 12),
    customer_satisfaction_score: Math.round((3.8 + Math.random() * 1.0) * 10) / 10,
    generated_at:        new Date().toISOString(),
    fee_usd:             FEES.claimsAnalytics,
  };
}
