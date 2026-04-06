import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const GOV_PLATFORM_COMMISSION     = 0.15; // 15% on business license lookups
const FEE_LICENSE_LOOKUP          = 1.00; // per lookup
const FEE_PERMIT_LOOKUP           = 1.50; // per lookup
const FEE_FOIA_SUBMISSION         = 3.00; // per FOIA request
const FEE_CONTRACT_MONITOR        = 5.00; // per month per search
const FEE_REGULATORY_TRACK        = 10.00; // per month

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS gov_license_types (
    id               TEXT PRIMARY KEY,
    license_name     TEXT NOT NULL,
    business_type    TEXT NOT NULL,
    state            TEXT NOT NULL,
    city             TEXT DEFAULT 'statewide',
    fee_usd          REAL NOT NULL,
    renewal_frequency TEXT NOT NULL,
    processing_days  INTEGER NOT NULL,
    application_url  TEXT,
    requirements     TEXT DEFAULT '[]',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gov_contract_opportunities (
    id                  TEXT PRIMARY KEY,
    solicitation_number TEXT NOT NULL UNIQUE,
    agency              TEXT NOT NULL,
    office              TEXT,
    title               TEXT NOT NULL,
    description         TEXT,
    due_date            TEXT NOT NULL,
    posted_date         TEXT NOT NULL,
    value_estimate_usd  REAL,
    naics_code          TEXT,
    set_aside_type      TEXT,
    contract_type       TEXT,
    place_of_performance TEXT,
    contact_email       TEXT,
    status              TEXT DEFAULT 'open',
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gov_foia_requests (
    id               TEXT PRIMARY KEY,
    agency           TEXT NOT NULL,
    request_description TEXT NOT NULL,
    preferred_format TEXT DEFAULT 'electronic',
    tracking_number  TEXT NOT NULL UNIQUE,
    status           TEXT DEFAULT 'submitted',
    estimated_days   INTEGER,
    agency_contact   TEXT,
    fee_usd          REAL,
    submitted_at     TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed License Types ────────────────────────────────────────────────────────

const _licCount = db.prepare("SELECT COUNT(*) as n FROM gov_license_types").get().n;
if (_licCount === 0) {
  const licenses = [
    { license_name: "General Business License", business_type: "general", state: "CA", city: "statewide", fee_usd: 45,  renewal_frequency: "annual",    processing_days: 10, application_url: "https://businessportal.ca.gov", requirements: '["Articles of Incorporation","EIN","Agent of Process"]' },
    { license_name: "Food Handler Permit",       business_type: "restaurant", state: "CA", city: "Los Angeles", fee_usd: 155, renewal_frequency: "annual", processing_days: 21, application_url: "https://ehservices.publichealth.lacounty.gov", requirements: '["FSSC plan","Kitchen inspection","Food safety manager cert"]' },
    { license_name: "Contractor License (Class A)", business_type: "construction", state: "CA", city: "statewide", fee_usd: 500, renewal_frequency: "biennial", processing_days: 90, application_url: "https://www.cslb.ca.gov", requirements: '["4 years experience","$15k bond","Workers comp insurance","Exam required"]' },
    { license_name: "Retail Seller Permit",      business_type: "retail", state: "TX", city: "statewide", fee_usd: 0,   renewal_frequency: "never",     processing_days: 5,  application_url: "https://mycpa.cpa.state.tx.us", requirements: '["EIN","Texas mailing address"]' },
    { license_name: "Professional Engineer License", business_type: "engineering", state: "TX", city: "statewide", fee_usd: 225, renewal_frequency: "biennial", processing_days: 60, application_url: "https://pels.texas.gov", requirements: '["ABET-accredited degree","4 yrs experience","PE exam passing score","References x5"]' },
    { license_name: "Real Estate Broker License", business_type: "real_estate", state: "FL", city: "statewide", fee_usd: 91.75, renewal_frequency: "biennial", processing_days: 30, application_url: "https://www.myfloridalicense.com", requirements: '["24 months active sales associate","72hr broker course","Fingerprinting","Background check"]' },
    { license_name: "Liquor License (Beer & Wine)", business_type: "restaurant", state: "FL", city: "statewide", fee_usd: 1820, renewal_frequency: "annual", processing_days: 90, application_url: "https://www.myfloridalicense.com/DBPR/alcoholic-beverages", requirements: '["Lease agreement","Background check","Site plan","Zoning approval"]' },
    { license_name: "Pharmacy License",          business_type: "pharmacy", state: "NY", city: "statewide", fee_usd: 680, renewal_frequency: "triennial", processing_days: 45, application_url: "https://www.op.nysed.gov", requirements: '["Registered pharmacist on-site","DEA registration","Facility inspection","Liability insurance"]' },
    { license_name: "Money Transmitter License", business_type: "fintech", state: "NY", city: "statewide", fee_usd: 5000, renewal_frequency: "annual", processing_days: 180, application_url: "https://www.dfs.ny.gov/apps_and_licensing", requirements: '["$500k net worth","Surety bond","AML program","NMLS registration","Background checks all principals"]' },
    { license_name: "Home Occupation Permit",    business_type: "home_business", state: "WA", city: "Seattle", fee_usd: 105, renewal_frequency: "annual", processing_days: 7, application_url: "https://www.seattle.gov/licenses", requirements: '["No employees on-site","Max 25% home area","No signage","No customer traffic"]' },
    { license_name: "Cosmetology Establishment License", business_type: "salon", state: "WA", city: "statewide", fee_usd: 50, renewal_frequency: "annual", processing_days: 14, application_url: "https://app.leg.wa.gov/WAC/default.aspx", requirements: '["Licensed cosmetologist on-staff","State inspection","Sanitation standards"]' },
    { license_name: "Childcare Facility License", business_type: "childcare", state: "IL", city: "statewide", fee_usd: 140, renewal_frequency: "annual", processing_days: 60, application_url: "https://www.ilchildcare.org", requirements: '["Fire safety inspection","Health inspection","CPR certification","Background checks all staff","Staff-to-child ratios"]' },
    { license_name: "Pawnbroker License",        business_type: "pawnshop", state: "IL", city: "Chicago", fee_usd: 2250, renewal_frequency: "annual", processing_days: 45, application_url: "https://chicago.gov/city/en/depts/bacp.html", requirements: '["Surety bond $5k","Background check","Zoning approval","Police Dept notification"]' },
    { license_name: "Pest Control License",      business_type: "pest_control", state: "GA", city: "statewide", fee_usd: 75, renewal_frequency: "annual", processing_days: 20, application_url: "https://agr.georgia.gov", requirements: '["CEU 10 hrs","Certified applicator exam","Liability insurance $100k","EPA compliance"]' },
    { license_name: "Auto Dealer License",       business_type: "auto_sales", state: "GA", city: "statewide", fee_usd: 400, renewal_frequency: "annual", processing_days: 30, application_url: "https://mvd.dor.ga.gov", requirements: '["Established place of business","Surety bond $35k","Background check","Display lot requirements","DMV approved"]' },
    { license_name: "Electrical Contractor License", business_type: "electrical", state: "CO", city: "statewide", fee_usd: 130, renewal_frequency: "annual", processing_days: 21, application_url: "https://dora.colorado.gov/electrical", requirements: '["8 yrs electrician experience","Master electrician certification","Insurance","Exam required"]' },
    { license_name: "Short-Term Rental Permit",  business_type: "str_rental", state: "CO", city: "Denver", fee_usd: 100, renewal_frequency: "annual", processing_days: 14, application_url: "https://www.denvergov.org/STR", requirements: '["Primary residence only","Sales tax license","Lodger tax account","Safety inspection"]' },
    { license_name: "Motor Vehicle Repair License", business_type: "auto_repair", state: "MA", city: "statewide", fee_usd: 100, renewal_frequency: "annual", processing_days: 21, application_url: "https://www.mass.gov/car-repair-shops", requirements: '["Registered with MA RMV","Liability insurance","Facility requirements","Consumer protection compliance"]' },
    { license_name: "Firearms Dealer (FFL Type 1)", business_type: "firearms", state: "AZ", city: "statewide", fee_usd: 200, renewal_frequency: "triennial", processing_days: 60, application_url: "https://www.atf.gov/firearms/apply-license", requirements: '["ATF Form 7 application","Background check owner","Premises inspection","State/local compliance","Safe storage requirements"]' },
    { license_name: "Agricultural Dealer License", business_type: "agriculture", state: "IA", city: "statewide", fee_usd: 50, renewal_frequency: "annual", processing_days: 10, application_url: "https://iowaagriculture.gov", requirements: '["Bonded $10k per commodity","USDA compliance","Grain weighmaster if applicable"]' },
  ];

  const insertLic = db.prepare(`
    INSERT OR IGNORE INTO gov_license_types
      (id, license_name, business_type, state, city, fee_usd, renewal_frequency, processing_days, application_url, requirements)
    VALUES
      (@id, @license_name, @business_type, @state, @city, @fee_usd, @renewal_frequency, @processing_days, @application_url, @requirements)
  `);
  for (const row of licenses) insertLic.run({ id: randomUUID(), ...row });
}

// ─── Seed Contract Opportunities ──────────────────────────────────────────────

const _contCount = db.prepare("SELECT COUNT(*) as n FROM gov_contract_opportunities").get().n;
if (_contCount === 0) {
  const now = new Date();
  const daysOut = (d) => new Date(now.getTime() + d * 86400000).toISOString().split("T")[0];

  const opportunities = [
    { solicitation_number: "W912BU-26-R-0041", agency: "US Army Corps of Engineers", office: "South Pacific Division", title: "Levee Rehabilitation and Flood Risk Management — Sacramento River", description: "Civil works construction for levee rehabilitation along 12-mile reach.", due_date: daysOut(21), posted_date: daysOut(-5), value_estimate_usd: 45000000, naics_code: "237990", set_aside_type: "total_small_business", contract_type: "FFP", place_of_performance: "Sacramento, CA", contact_email: "usace.spd.contracting@usace.army.mil" },
    { solicitation_number: "36C10G26R0012",    agency: "Dept of Veterans Affairs", office: "VA Strategic Acquisition Center", title: "Electronic Health Record Maintenance Support Services", description: "IT O&M support for VistA legacy systems across 172 VA Medical Centers.", due_date: daysOut(30), posted_date: daysOut(-3), value_estimate_usd: 120000000, naics_code: "541519", set_aside_type: "service_disabled_vet", contract_type: "IDIQ", place_of_performance: "Nationwide", contact_email: "vaco.sac@va.gov" },
    { solicitation_number: "HQ003426R0018",    agency: "Defense Information Systems Agency", office: "DISA Procurement", title: "Zero Trust Network Access (ZTNA) Platform License and Integration", description: "Enterprise ZTNA implementation covering 4.5M DoD endpoints.", due_date: daysOut(45), posted_date: daysOut(-7), value_estimate_usd: 890000000, naics_code: "541512", set_aside_type: "unrestricted", contract_type: "IDIQ", place_of_performance: "Fort Meade, MD / Remote", contact_email: "disa.pco@mail.mil" },
    { solicitation_number: "70RSAT26R00008",   agency: "Dept of Homeland Security", office: "CISA Acquisitions", title: "Cybersecurity Advisory and Incident Response Services", description: "CISA requires penetration testing, threat hunting, and IR retainer services.", due_date: daysOut(18), posted_date: daysOut(-10), value_estimate_usd: 75000000, naics_code: "541690", set_aside_type: "8a", contract_type: "T&M", place_of_performance: "Arlington, VA", contact_email: "cisa.contracts@hq.dhs.gov" },
    { solicitation_number: "DTFAWA26R00052",   agency: "FAA", office: "Acquisitions and Business Services", title: "NextGen Runway Status Lights (RWSL) Nationwide Deployment", description: "Install and commission RWSL systems at 20 Class B/C airports.", due_date: daysOut(60), posted_date: daysOut(-2), value_estimate_usd: 38000000, naics_code: "562910", set_aside_type: "total_small_business", contract_type: "FFP", place_of_performance: "Multiple CONUS airports", contact_email: "faa.acquisitions@faa.gov" },
    { solicitation_number: "GS00Q26NS00148",   agency: "General Services Administration", office: "FAS IT Category", title: "Cloud Infrastructure as a Service (IaaS) BPA Refresh", description: "GSA Blanket Purchase Agreement for commercial cloud IaaS across civilian agencies.", due_date: daysOut(35), posted_date: daysOut(-8), value_estimate_usd: 5000000000, naics_code: "518210", set_aside_type: "unrestricted", contract_type: "BPA", place_of_performance: "Commercial Cloud / Gov Region", contact_email: "gsa.cloud@gsa.gov" },
    { solicitation_number: "75N93026R00041",   agency: "NIH", office: "National Cancer Institute", title: "AI-Assisted Drug Discovery Platform for Oncology Research", description: "Multi-year research contract for AI/ML platform development and cancer genomics.", due_date: daysOut(50), posted_date: daysOut(-4), value_estimate_usd: 22000000, naics_code: "541714", set_aside_type: "HUBZone", contract_type: "CPFF", place_of_performance: "Bethesda, MD", contact_email: "nci.contracts@mail.nih.gov" },
    { solicitation_number: "DE-SOL-0009873",   agency: "Dept of Energy", office: "NNSA", title: "Spent Nuclear Fuel Dry Cask Storage Systems — Hanford Site", description: "Design, fabricate and deploy dry cask storage for SNF at Hanford Site WA.", due_date: daysOut(90), posted_date: daysOut(-1), value_estimate_usd: 310000000, naics_code: "562910", set_aside_type: "unrestricted", contract_type: "CPAF", place_of_performance: "Richland, WA", contact_email: "doe.nnsa.hanford.contracts@energy.gov" },
    { solicitation_number: "EDPSC26R00055",    agency: "Dept of Education", office: "PSC Acquisitions", title: "Federal Student Aid Technology Modernization (FAFSA Simplification)", description: "Legacy FAFSA system modernization — full replatform on cloud-native architecture.", due_date: daysOut(40), posted_date: daysOut(-6), value_estimate_usd: 175000000, naics_code: "541511", set_aside_type: "service_disabled_vet", contract_type: "T&M", place_of_performance: "Washington DC / Remote", contact_email: "ed.psc.contracts@ed.gov" },
    { solicitation_number: "47QMCA26R0108",    agency: "GSA Public Buildings Service", office: "National Capital Region", title: "HVAC Modernization — Federal Triangle Campus, Washington DC", description: "Replace aging HVAC systems in 6 historic federal buildings; LEED Gold target.", due_date: daysOut(25), posted_date: daysOut(-9), value_estimate_usd: 85000000, naics_code: "238220", set_aside_type: "small_business", contract_type: "FFP", place_of_performance: "Washington DC", contact_email: "gsa.pbs.ncr@gsa.gov" },
    { solicitation_number: "SSAGAD26R00118",   agency: "Social Security Administration", office: "Office of Acquisitions", title: "Field Office IT Hardware Refresh — 1,200 Locations", description: "Workstation, printer, and display procurement with deployment services.", due_date: daysOut(15), posted_date: daysOut(-12), value_estimate_usd: 60000000, naics_code: "334118", set_aside_type: "total_small_business", contract_type: "FFP", place_of_performance: "Nationwide", contact_email: "ssa.acquisitions@ssa.gov" },
    { solicitation_number: "19AQMM26R00064",   agency: "Dept of State", office: "Bureau of Information Resource Management", title: "Unclassified IT Helpdesk and End-User Support Services", description: "Tier 1-3 IT support for 40,000 State Dept users domestically and abroad.", due_date: daysOut(28), posted_date: daysOut(-11), value_estimate_usd: 145000000, naics_code: "561422", set_aside_type: "unrestricted", contract_type: "T&M", place_of_performance: "Washington DC + 20 overseas", contact_email: "state.birm.contracts@state.gov" },
    { solicitation_number: "W9124J26R0021",    agency: "Army Contracting Command", office: "Fort Bragg Installation", title: "Grounds Maintenance and Landscaping — Fort Liberty (Fort Bragg) NC", description: "Base operations support: 3,500 acres grounds maintenance, 5-year base + 5 options.", due_date: daysOut(20), posted_date: daysOut(-14), value_estimate_usd: 15000000, naics_code: "561730", set_aside_type: "8a", contract_type: "FFP", place_of_performance: "Fort Liberty (Bragg), NC", contact_email: "acc.fortliberty@army.mil" },
    { solicitation_number: "NRC-HQ-60-26-R-0009", agency: "Nuclear Regulatory Commission", office: "Acquisitions Management Division", title: "Independent Verification and Validation for Reactor Safety Software", description: "IV&V services for NRC-licensed reactor digital I&C systems.", due_date: daysOut(55), posted_date: daysOut(-3), value_estimate_usd: 9500000, naics_code: "541330", set_aside_type: "unrestricted", contract_type: "CPFF", place_of_performance: "Rockville, MD", contact_email: "nrc.acquisitions@nrc.gov" },
    { solicitation_number: "USPS-OFI-26-R-145", agency: "US Postal Service", office: "Supply Management", title: "Electric Delivery Vehicle (EDV) Fleet Expansion — Next 20,000 Units", description: "Purchase and delivery of next-generation battery-electric delivery vehicles.", due_date: daysOut(75), posted_date: daysOut(-2), value_estimate_usd: 3000000000, naics_code: "336120", set_aside_type: "unrestricted", contract_type: "FFP", place_of_performance: "Multiple US delivery depots", contact_email: "usps.supplymanagement@usps.gov" },
  ];

  const insertOpp = db.prepare(`
    INSERT OR IGNORE INTO gov_contract_opportunities
      (id, solicitation_number, agency, office, title, description, due_date, posted_date,
       value_estimate_usd, naics_code, set_aside_type, contract_type, place_of_performance, contact_email)
    VALUES
      (@id, @solicitation_number, @agency, @office, @title, @description, @due_date, @posted_date,
       @value_estimate_usd, @naics_code, @set_aside_type, @contract_type, @place_of_performance, @contact_email)
  `);
  for (const row of opportunities) insertOpp.run({ id: randomUUID(), ...row });
}

// ─── lookupBusinessLicense ────────────────────────────────────────────────────

/**
 * Find required business licenses for a given type, state, and city.
 * @param {string} businessType - Type of business (e.g. "restaurant", "construction")
 * @param {string} state        - 2-letter US state code (e.g. "CA")
 * @param {string} city         - City name or "statewide"
 * @returns Required licenses with fees, URLs, and processing times
 */
export function lookupBusinessLicense(businessType, state, city = "statewide") {
  if (!businessType) throw new Error("businessType is required");
  if (!state)        throw new Error("state is required");

  const feePaid    = FEE_LICENSE_LOOKUP;
  const commission = Math.round(feePaid * GOV_PLATFORM_COMMISSION * 100) / 100;

  // Match on exact business_type, or partial, or fallback to general
  let licenses = db.prepare(`
    SELECT * FROM gov_license_types
    WHERE state = ? AND (business_type = ? OR business_type = 'general')
    ORDER BY CASE WHEN business_type = ? THEN 0 ELSE 1 END
  `).all(state.toUpperCase(), businessType.toLowerCase(), businessType.toLowerCase());

  if (licenses.length === 0) {
    // Fallback: any general licenses for any state that match the business type
    licenses = db.prepare(`
      SELECT * FROM gov_license_types WHERE business_type = ? LIMIT 3
    `).all(businessType.toLowerCase());
  }

  return {
    query: { business_type: businessType, state: state.toUpperCase(), city },
    licenses_required: licenses.map(l => ({
      license_id:         l.id,
      license_name:       l.license_name,
      issuing_authority:  `${l.state} ${l.city !== "statewide" ? l.city + " " : ""}Government`,
      state:              l.state,
      city:               l.city,
      fee_usd:            l.fee_usd,
      renewal_frequency:  l.renewal_frequency,
      requirements:       JSON.parse(l.requirements || "[]"),
    })),
    fees:              licenses.map(l => ({ name: l.license_name, amount_usd: l.fee_usd })),
    application_urls:  licenses.map(l => l.application_url).filter(Boolean),
    processing_times:  licenses.map(l => ({ name: l.license_name, business_days: l.processing_days })),
    renewal_frequency: licenses.length > 0 ? licenses[0].renewal_frequency : "annual",
    total_estimated_fees_usd: licenses.reduce((sum, l) => sum + l.fee_usd, 0),
    count:             licenses.length,
    platform_fee_usd:  feePaid,
    platform_commission_usd: commission,
    note:              "Always verify with the issuing authority — fees and requirements change frequently.",
    retrieved_at:      new Date().toISOString(),
  };
}

// ─── lookupPermitRequirementsGov ───────────────────────────────────────────────

/**
 * Look up building, zoning, and special permit requirements for a project.
 * @param {string} projectType  - Type of project (e.g. "residential_addition", "commercial_signage")
 * @param {string} jurisdiction - City, county, or state name
 * @returns Permit requirements, fees, and estimated timeline
 */
export function lookupPermitRequirementsGov(projectType, jurisdiction) {
  if (!projectType)  throw new Error("projectType is required");
  if (!jurisdiction) throw new Error("jurisdiction is required");

  const feePaid = FEE_PERMIT_LOOKUP;

  const permitMap = {
    residential_addition:  { permits: ["Building Permit","Zoning Variance (if over setback)","MEP Sub-permits (Mechanical, Electrical, Plumbing)"], base_fee: 800, per_sqft: 0.75, timeline_days: 30 },
    commercial_construction: { permits: ["Commercial Building Permit","Fire Marshal Approval","Zoning Compliance Certificate","Environmental Review"], base_fee: 3500, per_sqft: 1.20, timeline_days: 90 },
    commercial_signage:    { permits: ["Sign Permit","Electrical Permit (if illuminated)","Zoning Approval"], base_fee: 250, per_sqft: 12, timeline_days: 14 },
    home_renovation:       { permits: ["Building Permit","Electrical Permit","Plumbing Permit"], base_fee: 350, per_sqft: 0.50, timeline_days: 10 },
    short_term_rental:     { permits: ["Short-Term Rental Permit","Zoning Verification","Business License","Fire Safety Inspection"], base_fee: 200, per_sqft: 0, timeline_days: 21 },
    solar_installation:    { permits: ["Building Permit","Electrical Permit","Interconnection Agreement (utility)"], base_fee: 450, per_sqft: 0, timeline_days: 14 },
    food_truck:            { permits: ["Mobile Food Vendor Permit","Health Department Permit","Fire Extinguisher Certification","Commissary Agreement"], base_fee: 600, per_sqft: 0, timeline_days: 28 },
    demolition:            { permits: ["Demolition Permit","Asbestos Survey (if pre-1980)","Utility Disconnect Confirmations","Environmental Clearance"], base_fee: 500, per_sqft: 0.25, timeline_days: 21 },
    grading_excavation:    { permits: ["Grading Permit","Stormwater Pollution Prevention Plan (SWPPP)","Encroachment Permit (if near ROW)"], base_fee: 700, per_sqft: 0, timeline_days: 30 },
    telecommunications:   { permits: ["Small Cell Wireless Facility Permit","Building Permit","ROW Encroachment Permit","FAA 7460-1 (if >200ft)"], base_fee: 1000, per_sqft: 0, timeline_days: 60 },
  };

  const pKey    = projectType.toLowerCase().replace(/[ -]/g, "_");
  const matched = permitMap[pKey] ?? permitMap["home_renovation"];

  const feeSchedule = {
    base_application_fee_usd:  matched.base_fee,
    per_sqft_fee_usd:          matched.per_sqft,
    plan_check_fee_usd:        Math.round(matched.base_fee * 0.65 * 100) / 100,
    inspection_fee_usd:        Math.round(matched.base_fee * 0.30 * 100) / 100,
    state_surcharge_pct:       4,
    total_estimate_usd:        Math.round(matched.base_fee * 2.0 * 100) / 100,
  };

  return {
    lookup_id:          randomUUID(),
    project_type:       projectType,
    jurisdiction,
    permits:            matched.permits,
    requirements:       [
      "Submit complete architectural/engineering drawings",
      "Include site plan with property lines and setbacks",
      "Provide contractor license number and insurance",
      "Owner signature required on application",
      "Pay plan-check fee at submission",
    ],
    estimated_timeline: `${matched.timeline_days} business days from complete submission`,
    timeline_days:      matched.timeline_days,
    fee_schedule:       feeSchedule,
    common_delays:      ["Incomplete plans", "Setback or height violations", "HOA approval required", "Environmental review triggered"],
    inspection_stages:  ["Foundation", "Framing", "Rough MEP", "Insulation", "Final"],
    platform_fee_usd:   feePaid,
    retrieved_at:       new Date().toISOString(),
    disclaimer:         "Requirements vary by jurisdiction. Confirm all fees and procedures with the local building department.",
  };
}

// ─── submitFoiaRequest ────────────────────────────────────────────────────────

/**
 * Automate and draft a FOIA request to a federal agency.
 * @param {string} agency              - Federal agency name or acronym (e.g. "FBI", "EPA")
 * @param {string} requestDescription  - Detailed description of records requested
 * @param {string} preferredFormat     - electronic|paper
 * @returns FOIA request record with tracking number and expected response time
 */
export function submitFoiaRequest(agency, requestDescription, preferredFormat = "electronic") {
  if (!agency)             throw new Error("agency is required");
  if (!requestDescription) throw new Error("requestDescription is required");
  if (!["electronic","paper"].includes(preferredFormat)) throw new Error("preferredFormat must be electronic|paper");

  const feePaid      = FEE_FOIA_SUBMISSION;
  const reqId        = randomUUID();
  const trackingNum  = `FOIA-${agency.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5)}-${Date.now().toString(36).toUpperCase()}`;

  const agencyContacts = {
    "FBI":   { email: "foiparequest@ic.fbi.gov",     phone: "(540) 868-4593", url: "https://efoia.fbi.gov",           avg_days: 245 },
    "CIA":   { email: "foia@ucia.gov",               phone: "(703) 613-1287", url: "https://www.cia.gov/readingroom",  avg_days: 365 },
    "EPA":   { email: "hq.foia@epa.gov",             phone: "(202) 566-1667", url: "https://foiaonline.gov",           avg_days: 40  },
    "DHS":   { email: "dhsfoia@hq.dhs.gov",          phone: "(202) 343-1743", url: "https://www.dhs.gov/foia",         avg_days: 80  },
    "DOJ":   { email: "doj.foia@usdoj.gov",          phone: "(202) 514-3642", url: "https://www.justice.gov/oip",      avg_days: 60  },
    "HHS":   { email: "foia@hhs.gov",                phone: "(202) 690-7453", url: "https://www.hhs.gov/foia",         avg_days: 45  },
    "USDA":  { email: "agsec.foia@usda.gov",         phone: "(202) 690-3755", url: "https://efts.usda.gov/EFTS",       avg_days: 30  },
    "DOD":   { email: "osd.foia@mail.mil",           phone: "(571) 372-0498", url: "https://www.esd.whs.mil/FOIA",     avg_days: 120 },
    "SEC":   { email: "foiapa@sec.gov",              phone: "(202) 551-8090", url: "https://www.sec.gov/foia",         avg_days: 25  },
    "FTC":   { email: "foia@ftc.gov",                phone: "(202) 326-2430", url: "https://www.ftc.gov/foia",         avg_days: 35  },
  };

  const agencyKey    = agency.toUpperCase().replace(/[^A-Z]/g, "");
  const contact      = agencyContacts[agencyKey] ?? { email: `foia@${agencyKey.toLowerCase()}.gov`, phone: "N/A", url: `https://www.${agencyKey.toLowerCase()}.gov/foia`, avg_days: 60 };
  const estimatedDays = contact.avg_days;

  db.prepare(`
    INSERT OR IGNORE INTO gov_foia_requests
      (id, agency, request_description, preferred_format, tracking_number, status, estimated_days, agency_contact, fee_usd)
    VALUES (@id, @agency, @request_description, @preferred_format, @tracking_number, 'submitted', @estimated_days, @agency_contact, @fee_usd)
  `).run({ id: reqId, agency, request_description: requestDescription, preferred_format: preferredFormat,
            tracking_number: trackingNum, estimated_days: estimatedDays,
            agency_contact: JSON.stringify(contact), fee_usd: feePaid });

  return {
    request_id:           reqId,
    tracking_number:      trackingNum,
    agency,
    request_description:  requestDescription,
    preferred_format:     preferredFormat,
    status:               "submitted",
    estimated_response_time: `${estimatedDays} business days (agency average)`,
    estimated_response_by:   new Date(Date.now() + estimatedDays * 86400000).toISOString().split("T")[0],
    agency_contact: {
      email: contact.email,
      phone: contact.phone,
      portal_url: contact.url,
    },
    draft_request_text: `This is a request under the Freedom of Information Act (5 U.S.C. § 552) and, where applicable, the Privacy Act (5 U.S.C. § 552a).\n\nI hereby request the following records from ${agency}:\n\n${requestDescription}\n\nI prefer to receive records in ${preferredFormat} format. If fees are expected to exceed $25, please notify me before processing.\n\nTracking Reference: ${trackingNum}\n\nThank you for your prompt attention.`,
    appeal_rights:        "If your request is denied in full or in part, you have the right to appeal within 90 days of receipt of denial per 5 U.S.C. § 552(a)(6).",
    fee_usd:              feePaid,
    submitted_at:         new Date().toISOString(),
  };
}

// ─── monitorContractBids ──────────────────────────────────────────────────────

/**
 * Monitor government contract bid opportunities matching keywords, agencies, and set-aside types.
 * @param {string[]} keywords      - Keywords to match in opportunity titles/descriptions
 * @param {string[]} agencies      - Agency names to filter (empty = all)
 * @param {string[]} setAsideTypes - Set-aside type filters: 8a, small_business, hubzone, service_disabled_vet, etc.
 * @returns Matching contract opportunities from SAM.gov seed data
 */
export function monitorContractBids(keywords = [], agencies = [], setAsideTypes = []) {
  const feePaid = FEE_CONTRACT_MONITOR;

  let sql    = "SELECT * FROM gov_contract_opportunities WHERE status = 'open'";
  const params = [];

  if (agencies.length > 0) {
    const placeholders = agencies.map(() => "?").join(",");
    sql += ` AND agency IN (${placeholders})`;
    params.push(...agencies);
  }
  if (setAsideTypes.length > 0) {
    const placeholders = setAsideTypes.map(() => "?").join(",");
    sql += ` AND set_aside_type IN (${placeholders})`;
    params.push(...setAsideTypes);
  }
  sql += " ORDER BY due_date ASC";

  let opportunities = db.prepare(sql).all(...params);

  // Keyword filter in JS (SQLite FTS not guaranteed)
  if (keywords.length > 0) {
    const lowerKw = keywords.map(k => k.toLowerCase());
    opportunities = opportunities.filter(opp =>
      lowerKw.some(kw => opp.title.toLowerCase().includes(kw) || (opp.description ?? "").toLowerCase().includes(kw))
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return {
    search_id:       randomUUID(),
    keywords,
    agencies_filter: agencies,
    set_aside_filter: setAsideTypes,
    opportunities:   opportunities.map(o => ({
      opportunity_id:     o.id,
      solicitation_number: o.solicitation_number,
      agency:             o.agency,
      office:             o.office,
      title:              o.title,
      description:        o.description,
      naics_code:         o.naics_code,
      due_date:           o.due_date,
      posted_date:        o.posted_date,
      days_until_due:     Math.ceil((new Date(o.due_date) - new Date(today)) / 86400000),
      value_estimate_usd: o.value_estimate_usd,
      value_label:        o.value_estimate_usd >= 1e9 ? `$${(o.value_estimate_usd/1e9).toFixed(1)}B`
                        : o.value_estimate_usd >= 1e6 ? `$${(o.value_estimate_usd/1e6).toFixed(1)}M`
                        : `$${(o.value_estimate_usd/1e3).toFixed(0)}K`,
      set_aside_type:     o.set_aside_type,
      contract_type:      o.contract_type,
      place_of_performance: o.place_of_performance,
      contact_email:      o.contact_email,
      sam_gov_url:        `https://sam.gov/opp/${o.solicitation_number}`,
    })),
    total_found:     opportunities.length,
    fee_usd:         feePaid,
    note:            "Full details and attachments available on SAM.gov. Set up email alerts at beta.sam.gov for real-time notifications.",
    searched_at:     new Date().toISOString(),
  };
}

// ─── trackRegulatoryChanges ───────────────────────────────────────────────────

/**
 * Monitor and alert on regulatory changes affecting specified industries and jurisdictions.
 * @param {string[]} industries    - Industries to monitor (e.g. ["fintech","healthcare","construction"])
 * @param {string[]} jurisdictions - Jurisdictions to cover (e.g. ["federal","CA","NY"])
 * @returns Recent regulatory changes with impact assessments and compliance deadlines
 */
export function trackRegulatoryChanges(industries = [], jurisdictions = []) {
  if (!Array.isArray(industries))    throw new Error("industries must be an array");
  if (!Array.isArray(jurisdictions)) throw new Error("jurisdictions must be an array");

  const feePaid = FEE_REGULATORY_TRACK;

  // Static curated regulatory changes database (realistic recent changes)
  const allChanges = [
    { regulation: "SEC Cybersecurity Disclosure Rules (17 CFR Parts 229 & 249)", industries: ["fintech","technology","financial_services"], jurisdictions: ["federal"], effective_date: "2025-12-15", summary: "Public companies must disclose material cybersecurity incidents within 4 business days and annually describe cybersecurity risk management.", impact_assessment: "HIGH — all public companies must update IR plans, disclosure procedures, and board governance.", compliance_deadline: "2025-12-15" },
    { regulation: "CMS Final Rule — Medicare Drug Price Negotiation (IRA §1191)", industries: ["pharmaceutical","healthcare"], jurisdictions: ["federal"], effective_date: "2026-01-01", summary: "First 10 drugs subject to Medicare negotiated prices take effect. Manufacturers must comply with maximum fair price.", impact_assessment: "CRITICAL — affects pricing strategies, contracting, and gross-to-net calculations for listed drugs.", compliance_deadline: "2026-01-01" },
    { regulation: "California SB 1047 — Safe and Secure AI Act", industries: ["technology","ai","fintech"], jurisdictions: ["CA"], effective_date: "2026-01-01", summary: "Large AI model developers must implement safety plans, conduct testing, and preserve shutdown capability. Applies to models trained with >$100M compute.", impact_assessment: "HIGH — major AI labs must adopt safety frameworks and file annual reports with Attorney General.", compliance_deadline: "2026-01-01" },
    { regulation: "EPA PFAS Maximum Contaminant Level Rule (40 CFR Part 141)", industries: ["manufacturing","utilities","food_beverage"], jurisdictions: ["federal"], effective_date: "2026-04-26", summary: "MCLs set for 6 PFAS compounds in public drinking water systems. PFOA at 4 ng/L, PFOS at 4 ng/L.", impact_assessment: "HIGH — water utilities and industrial dischargers must test, treat, and report.", compliance_deadline: "2026-04-26" },
    { regulation: "NY DFS Part 500 — Cybersecurity Regulation (Amended)", industries: ["fintech","insurance","financial_services"], jurisdictions: ["NY"], effective_date: "2025-11-01", summary: "Expanded requirements: CISO reporting to board, penetration testing, MFA for privileged accounts, incident reporting 72 hours.", impact_assessment: "HIGH — affects all DFS-regulated entities including banks, insurers, and money transmitters.", compliance_deadline: "2025-11-01" },
    { regulation: "USDA Final Rule — Organic Livestock and Poultry Practices", industries: ["agriculture","food_beverage"], jurisdictions: ["federal"], effective_date: "2026-03-20", summary: "New outdoor access, space, and welfare standards for organic-certified livestock and poultry operations.", impact_assessment: "MEDIUM — certified organic producers must update facilities and practices by effective date.", compliance_deadline: "2026-03-20" },
    { regulation: "FTC Non-Compete Clause Rule (16 CFR Part 910)", industries: ["technology","financial_services","healthcare","construction"], jurisdictions: ["federal"], effective_date: "2026-09-04", summary: "Bans most employee non-compete agreements nationwide. Senior executives may retain existing agreements but no new ones.", impact_assessment: "HIGH — employers must review all employment contracts and notify current/former employees with void non-competes.", compliance_deadline: "2026-09-04" },
    { regulation: "Texas HB 4 — Texas Data Privacy and Security Act", industries: ["technology","retail","healthcare"], jurisdictions: ["TX"], effective_date: "2025-07-01", summary: "Comprehensive consumer data privacy law. Controllers must honor opt-out rights, data subject access requests within 45 days, and conduct risk assessments.", impact_assessment: "MEDIUM — businesses targeting TX consumers must update privacy notices, DSR processes, and vendor contracts.", compliance_deadline: "2025-07-01" },
    { regulation: "DOL Final Rule — Independent Contractor Classification (29 CFR Part 795)", industries: ["technology","transportation","construction","gig_economy"], jurisdictions: ["federal"], effective_date: "2024-03-11", summary: "New six-factor economic reality test for worker classification. Restores totality-of-circumstances analysis.", impact_assessment: "HIGH — gig platforms and contractors must reassess worker relationships; misclassification penalties up to $10k/violation.", compliance_deadline: "Effective — ongoing compliance required" },
    { regulation: "Revised Federal Acquisition Regulation (FAR) Cyber Clause 52.204-21", industries: ["defense","technology","government_contractors"], jurisdictions: ["federal"], effective_date: "2025-10-01", summary: "Expands basic safeguarding requirements for contractors handling federal CUI. Aligns with NIST SP 800-171 Rev 3.", impact_assessment: "HIGH — all federal contractors with CUI must achieve CMMC Level 2 certification by end of FY2026.", compliance_deadline: "2026-09-30" },
    { regulation: "Florida SB 264 — Foreign Principal Real Property Restriction", industries: ["real_estate","agriculture"], jurisdictions: ["FL"], effective_date: "2023-07-01", summary: "Restricts certain foreign nationals from owning agricultural land or real property near military installations.", impact_assessment: "MEDIUM — existing owners must register; new acquisitions by covered nationals prohibited.", compliance_deadline: "Effective — ongoing" },
    { regulation: "SEC Climate Disclosure Rules (Final — Phase-in)", industries: ["financial_services","energy","manufacturing","technology"], jurisdictions: ["federal"], effective_date: "2026-02-04", summary: "Large accelerated filers must disclose Scope 1 and 2 GHG emissions; material climate risks in 10-K. Scope 3 requirement removed.", impact_assessment: "HIGH — public companies must build GHG measurement infrastructure and update 10-K disclosures.", compliance_deadline: "2026-02-04" },
  ];

  const lowerIndustries    = industries.map(i => i.toLowerCase());
  const lowerJurisdictions = jurisdictions.map(j => j.toLowerCase());

  let filtered = allChanges;
  if (lowerIndustries.length > 0) {
    filtered = filtered.filter(c => c.industries.some(ind => lowerIndustries.some(li => ind.includes(li) || li.includes(ind))));
  }
  if (lowerJurisdictions.length > 0) {
    filtered = filtered.filter(c => c.jurisdictions.some(j => lowerJurisdictions.some(lj => j.toLowerCase() === lj || lj === "all")));
  }

  const today = new Date().toISOString().split("T")[0];

  return {
    monitor_id:    randomUUID(),
    industries_monitored: industries,
    jurisdictions_monitored: jurisdictions,
    changes:       filtered.map(c => ({
      regulation:           c.regulation,
      industries_affected:  c.industries,
      jurisdictions:        c.jurisdictions,
      effective_date:       c.effective_date,
      days_until_effective: Math.ceil((new Date(c.effective_date) - new Date(today)) / 86400000),
      summary:              c.summary,
      impact_assessment:    c.impact_assessment,
      compliance_deadline:  c.compliance_deadline,
      source_url:           `https://federalregister.gov/search?query=${encodeURIComponent(c.regulation.split("—")[0].trim())}`,
    })),
    total_changes:  filtered.length,
    high_priority:  filtered.filter(c => c.impact_assessment.startsWith("HIGH") || c.impact_assessment.startsWith("CRITICAL")).length,
    fee_usd:        feePaid,
    note:           "Subscribe to Federal Register daily email digest at federalregister.gov for real-time updates.",
    retrieved_at:   new Date().toISOString(),
  };
}
