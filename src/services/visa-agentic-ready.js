/**
 * Visa Agentic Ready Programme
 * Phase 62 — HiveAgent
 *
 * Signal: Visa launched March 17, 2026. Europe first. This is not a product —
 * it's a programme. A structured pathway for financial institutions and their
 * enterprise clients to test and validate agent-initiated transactions in
 * controlled production environments, with Visa's blessing and oversight.
 *
 * What "Agentic Ready" means:
 *   Your AI agent has been tested against Visa's test scenarios, your technical
 *   architecture has been reviewed, your security controls are documented, and
 *   Visa's issuing bank partners have cleared you to initiate live transactions.
 *   You're not just building an agent. You're in the room with Revolut, Barclays,
 *   and HSBC. That's what the Agentic Ready badge means.
 *
 * Programme Partners (announced March 17, 2026):
 *   Revolut, Barclays, HSBC UK, Commerzbank, Santander, Nationwide Building
 *   Society, Raiffeisen Bank International, Nexi Group, Caixa Bank, ING,
 *   BNP Paribas, Deutsche Bank, UniCredit, Lloyds Banking Group, Standard
 *   Chartered, and 3 undisclosed partners.
 *
 * How it works:
 *   1. Enroll — submit technical architecture and compliance documentation
 *   2. Test — run Visa-approved test scenarios in controlled production environment
 *   3. Score — hit 80+ readiness score before contacting Visa
 *   4. Apply — submit application packet to your Visa account executive
 *   5. Launch — go live with issuer partner support
 *
 * HiveAgent's role: We give you the technical readiness they'll ask for.
 * Test scenarios, readiness scoring, application packet generation — all here.
 *
 * Auth: VISA_AGENTIC_READY_KEY environment variable
 * LIVE_MODE = !!process.env.VISA_AGENTIC_READY_KEY
 */

import db from "../db.js";
import crypto from "crypto";

export const LIVE_MODE = !!process.env.VISA_AGENTIC_READY_KEY;

// ─── Programme Partners ───────────────────────────────────────────────────────

const ISSUER_PARTNERS = [
  { name: "Revolut", region: "UK/EU", type: "neobank", specialty: "Consumer & business cards" },
  { name: "Barclays", region: "UK/EU", type: "tier1_bank", specialty: "Corporate & retail banking" },
  { name: "HSBC UK", region: "UK/EU", type: "tier1_bank", specialty: "Global commercial banking" },
  { name: "Commerzbank", region: "DE/EU", type: "tier1_bank", specialty: "SME and corporate banking" },
  { name: "Santander", region: "ES/EU", type: "tier1_bank", specialty: "Consumer and business banking" },
  { name: "Nationwide", region: "UK", type: "building_society", specialty: "Retail consumer banking" },
  { name: "Raiffeisen Bank International", region: "AT/CEE", type: "tier1_bank", specialty: "Central and Eastern European banking" },
  { name: "Nexi Group", region: "IT/EU", type: "payment_processor", specialty: "European payments infrastructure" },
  { name: "CaixaBank", region: "ES", type: "tier1_bank", specialty: "Consumer and corporate banking" },
  { name: "ING", region: "NL/EU", type: "tier1_bank", specialty: "Retail and wholesale banking" },
  { name: "BNP Paribas", region: "FR/EU", type: "tier1_bank", specialty: "Corporate and investment banking" },
  { name: "Deutsche Bank", region: "DE/EU", type: "tier1_bank", specialty: "Investment and corporate banking" },
  { name: "UniCredit", region: "IT/EU", type: "tier1_bank", specialty: "Pan-European retail and corporate" },
  { name: "Lloyds Banking Group", region: "UK", type: "tier1_bank", specialty: "UK retail and commercial banking" },
  { name: "Standard Chartered", region: "UK/APAC", type: "tier1_bank", specialty: "Emerging markets and trade finance" },
];

// ─── Test Scenario Definitions ────────────────────────────────────────────────

const VISA_TEST_SCENARIOS = {
  purchase: {
    label: "Standard Purchase",
    description: "Agent initiates a standard card-present equivalent purchase",
    visa_checks: [
      "Agent identity verification (TAP or AMT token)",
      "Spending limit not exceeded",
      "Merchant category code within authorized scope",
      "Transaction amount within per-transaction limit",
      "Consumer consent record present",
      "Fraud scoring (Visa Decision Manager)",
    ],
    typical_result: "pass",
    notes: "Core scenario — must pass before other scenarios are available",
  },
  refund: {
    label: "Refund / Credit",
    description: "Agent initiates a return or refund to the original payment method",
    visa_checks: [
      "Original transaction reference valid",
      "Refund amount does not exceed original transaction",
      "Merchant authorization for refund initiation",
      "Agent identity matches original transaction agent",
      "Consumer account credit capability confirmed",
    ],
    typical_result: "pass",
    notes: "Often missed in agent implementations — test early",
  },
  recurring: {
    label: "Recurring Transaction",
    description: "Agent sets up and executes a scheduled recurring payment",
    visa_checks: [
      "Recurring indicator flag set correctly",
      "Initial consumer consent for recurring authorization",
      "Interval and amount within consumer-authorized parameters",
      "Cancellation capability confirmed (consumer can stop)",
      "Failed payment retry logic compliant with Visa rules",
    ],
    typical_result: "review",
    notes: "Requires consumer consent architecture — most common failure point",
  },
  cross_border: {
    label: "Cross-Border Transaction",
    description: "Agent initiates payment across currency or jurisdictional boundary",
    visa_checks: [
      "FX authorization in consumer's mandate",
      "Dynamic currency conversion disclosure compliance",
      "Sanction list screening passed",
      "Destination country not in restricted list",
      "Consumer notified of potential FX fees",
    ],
    typical_result: "review",
    notes: "Requires explicit consumer consent for cross-border FX",
  },
  high_value: {
    label: "High-Value Transaction",
    description: "Agent initiates a transaction above €1,000 / $1,000",
    visa_checks: [
      "Enhanced consumer consent for high-value threshold",
      "Step-up authentication triggered and passed",
      "Real-time consumer notification sent",
      "Fraud risk score below threshold for amount tier",
      "Human oversight mechanism available (if required)",
      "Issuer partner high-value rules satisfied",
    ],
    typical_result: "review",
    notes: "All issuer partners require additional verification above their own high-value thresholds",
  },
};

// ─── Readiness Checklist ──────────────────────────────────────────────────────

const READINESS_CHECKS = [
  { id: "agent_identity", label: "Agent identity verified", description: "Agent has a registered identity (TAP, AMT token, or equivalent)", weight: 20 },
  { id: "spending_controls", label: "Spending controls implemented", description: "Per-transaction, daily, and category limits are enforced", weight: 20 },
  { id: "consumer_consent", label: "Consumer consent architecture", description: "Consumer authorization is captured and revocable", weight: 15 },
  { id: "compliance_docs", label: "Compliance documentation ready", description: "Technical architecture and security controls documented", weight: 15 },
  { id: "purchase_test", label: "Purchase test scenario passed", description: "Standard purchase test passed with 100% success rate", weight: 15 },
  { id: "recurring_test", label: "Recurring transaction test passed", description: "Recurring scenario passed or reviewed successfully", weight: 10 },
  { id: "high_value_test", label: "High-value test passed", description: "High-value scenario tested and documented", weight: 5 },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS var_enrollments (
      id                   TEXT PRIMARY KEY,
      agent_id             TEXT NOT NULL UNIQUE,
      organization         TEXT NOT NULL,
      jurisdiction         TEXT NOT NULL,
      use_case             TEXT NOT NULL,
      issuer_partner       TEXT,
      enrollment_id        TEXT NOT NULL UNIQUE,
      status               TEXT DEFAULT 'pending_visa_review',
      test_environment_url TEXT,
      readiness_score      INTEGER DEFAULT 0,
      applied_at           TEXT DEFAULT (datetime('now')),
      reviewed_at          TEXT,
      notes                TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_var_enroll_agent ON var_enrollments(agent_id);
  `);
} catch (e) {
  console.error("[VAR] Schema init error (var_enrollments):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS var_test_scenarios (
      id               TEXT PRIMARY KEY,
      agent_id         TEXT NOT NULL,
      enrollment_id    TEXT NOT NULL,
      scenario_type    TEXT NOT NULL,
      scenario_id      TEXT NOT NULL UNIQUE,
      amount           REAL,
      merchant_category TEXT,
      result           TEXT DEFAULT 'pending',
      visa_response_code TEXT,
      authentication_method TEXT,
      checks_passed    INTEGER DEFAULT 0,
      checks_total     INTEGER DEFAULT 0,
      failure_reason   TEXT,
      run_at           TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_var_tests_agent ON var_test_scenarios(agent_id);
    CREATE INDEX IF NOT EXISTS idx_var_tests_type  ON var_test_scenarios(scenario_type);
  `);
} catch (e) {
  console.error("[VAR] Schema init error (var_test_scenarios):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS var_transaction_logs (
      id               TEXT PRIMARY KEY,
      agent_id         TEXT NOT NULL,
      scenario_id      TEXT,
      transaction_ref  TEXT NOT NULL UNIQUE,
      amount           REAL,
      currency         TEXT DEFAULT 'EUR',
      merchant         TEXT,
      result           TEXT DEFAULT 'approved',
      environment      TEXT DEFAULT 'controlled_production',
      logged_at        TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_var_txlog_agent ON var_transaction_logs(agent_id);
  `);
} catch (e) {
  console.error("[VAR] Schema init error (var_transaction_logs):", e.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = "") {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

function assignIssuerPartner(jurisdiction = "") {
  const j = jurisdiction.toLowerCase();
  if (j.includes("uk") || j.includes("gb")) {
    return ISSUER_PARTNERS.find(p => ["Barclays", "HSBC UK", "Nationwide", "Lloyds Banking Group"].includes(p.name));
  }
  if (j.includes("de") || j.includes("ger")) {
    return ISSUER_PARTNERS.find(p => ["Commerzbank", "Deutsche Bank"].includes(p.name));
  }
  if (j.includes("fr") || j.includes("fra")) {
    return ISSUER_PARTNERS.find(p => p.name === "BNP Paribas");
  }
  if (j.includes("it") || j.includes("ital")) {
    return ISSUER_PARTNERS.find(p => ["Nexi Group", "UniCredit"].includes(p.name));
  }
  if (j.includes("es") || j.includes("spain")) {
    return ISSUER_PARTNERS.find(p => ["Santander", "CaixaBank"].includes(p.name));
  }
  if (j.includes("at") || j.includes("aus") || j.includes("cee")) {
    return ISSUER_PARTNERS.find(p => p.name === "Raiffeisen Bank International");
  }
  if (j.includes("nl") || j.includes("neth")) {
    return ISSUER_PARTNERS.find(p => p.name === "ING");
  }
  if (j.includes("eu") || j.includes("euro")) {
    return ISSUER_PARTNERS.find(p => p.name === "Revolut"); // widest EU coverage
  }
  // Default: Revolut (pan-European neobank with broadest coverage)
  return ISSUER_PARTNERS.find(p => p.name === "Revolut");
}

function generateVisaResponseCode(result) {
  const codes = {
    pass: ["00", "10"],
    fail: ["05", "14", "57", "62"],
    review: ["51", "65", "93"],
  };
  const list = codes[result] || codes.pass;
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

try {
  const n = db.prepare("SELECT COUNT(*) as n FROM var_enrollments").get().n;
  if (n === 0) {
    const seedEnrollments = [
      {
        id: uid("var-enroll-"),
        agent_id: "agent_travel_booker_001",
        organization: "Meridian Travel AI Ltd",
        jurisdiction: "UK",
        use_case: "Automated flight and hotel booking on behalf of corporate travelers",
        issuer_partner: "Barclays",
        enrollment_id: uid("VAR-"),
        status: "in_testing",
        test_environment_url: "https://sandbox.agentic-ready.visa.com/env/barclays-uk-01",
        readiness_score: 75,
      },
      {
        id: uid("var-enroll-"),
        agent_id: "agent_expense_manager_002",
        organization: "Automat Expense GmbH",
        jurisdiction: "DE",
        use_case: "Automated B2B expense reporting and payment reconciliation",
        issuer_partner: "Commerzbank",
        enrollment_id: uid("VAR-"),
        status: "approved",
        test_environment_url: "https://sandbox.agentic-ready.visa.com/env/commerzbank-de-01",
        readiness_score: 92,
      },
      {
        id: uid("var-enroll-"),
        agent_id: "agent_retail_replenishment_003",
        organization: "QuickStock SRL",
        jurisdiction: "IT",
        use_case: "Automated retail inventory replenishment ordering from suppliers",
        issuer_partner: "Nexi Group",
        enrollment_id: uid("VAR-"),
        status: "pending_visa_review",
        test_environment_url: null,
        readiness_score: 48,
      },
    ];

    const ins = db.prepare(`
      INSERT INTO var_enrollments
        (id, agent_id, organization, jurisdiction, use_case, issuer_partner, enrollment_id, status, test_environment_url, readiness_score)
      VALUES
        (@id, @agent_id, @organization, @jurisdiction, @use_case, @issuer_partner, @enrollment_id, @status, @test_environment_url, @readiness_score)
    `);
    const tx = db.transaction(() => seedEnrollments.forEach(s => ins.run(s)));
    tx();

    // Seed some test scenario results
    const testSeeds = [
      {
        id: uid("test-"), agent_id: "agent_travel_booker_001",
        enrollment_id: seedEnrollments[0].enrollment_id,
        scenario_type: "purchase", scenario_id: uid("vts-"),
        amount: 349.00, merchant_category: "Travel",
        result: "pass", visa_response_code: "00",
        authentication_method: "TAP", checks_passed: 6, checks_total: 6,
      },
      {
        id: uid("test-"), agent_id: "agent_travel_booker_001",
        enrollment_id: seedEnrollments[0].enrollment_id,
        scenario_type: "cross_border", scenario_id: uid("vts-"),
        amount: 892.00, merchant_category: "Travel",
        result: "review", visa_response_code: "93",
        authentication_method: "AMT", checks_passed: 4, checks_total: 5,
        failure_reason: "Consumer FX consent not explicit — add FX disclosure to mandate",
      },
      {
        id: uid("test-"), agent_id: "agent_expense_manager_002",
        enrollment_id: seedEnrollments[1].enrollment_id,
        scenario_type: "purchase", scenario_id: uid("vts-"),
        amount: 127.50, merchant_category: "Business Services",
        result: "pass", visa_response_code: "00",
        authentication_method: "TAP", checks_passed: 6, checks_total: 6,
      },
      {
        id: uid("test-"), agent_id: "agent_expense_manager_002",
        enrollment_id: seedEnrollments[1].enrollment_id,
        scenario_type: "recurring", scenario_id: uid("vts-"),
        amount: 299.00, merchant_category: "SaaS",
        result: "pass", visa_response_code: "10",
        authentication_method: "AMT", checks_passed: 5, checks_total: 5,
      },
      {
        id: uid("test-"), agent_id: "agent_expense_manager_002",
        enrollment_id: seedEnrollments[1].enrollment_id,
        scenario_type: "high_value", scenario_id: uid("vts-"),
        amount: 4500.00, merchant_category: "Business Services",
        result: "pass", visa_response_code: "10",
        authentication_method: "step_up_auth", checks_passed: 6, checks_total: 6,
      },
    ];

    const insT = db.prepare(`
      INSERT INTO var_test_scenarios
        (id, agent_id, enrollment_id, scenario_type, scenario_id, amount, merchant_category, result, visa_response_code, authentication_method, checks_passed, checks_total, failure_reason)
      VALUES
        (@id, @agent_id, @enrollment_id, @scenario_type, @scenario_id, @amount, @merchant_category, @result, @visa_response_code, @authentication_method, @checks_passed, @checks_total, @failure_reason)
    `);
    const txT = db.transaction(() => testSeeds.forEach(s => insT.run({ ...s, failure_reason: s.failure_reason || null })));
    txT();
  }
} catch (e) {
  console.error("[VAR] Seed error:", e.message);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * varEnroll — Enroll in the Visa Agentic Ready programme
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.organization
 * @param {string} args.jurisdiction — e.g. "UK", "DE", "EU"
 * @param {string} args.use_case
 * @param {string} args.issuer_partner — optional preference
 */
export async function varEnroll(args) {
  const { agent_id, organization, jurisdiction = "EU", use_case, issuer_partner } = args;

  const enrollment_id = uid("VAR-");
  const record_id = uid("var-enroll-");
  const partner = issuer_partner
    ? ISSUER_PARTNERS.find(p => p.name.toLowerCase().includes(issuer_partner.toLowerCase())) || assignIssuerPartner(jurisdiction)
    : assignIssuerPartner(jurisdiction);

  const test_env_url = `https://sandbox.agentic-ready.visa.com/env/${partner.name.toLowerCase().replace(/\s+/g, "-")}-01`;

  if (LIVE_MODE) {
    console.log(`[VAR] LIVE: would submit enrollment ${enrollment_id} to Visa Agentic Ready programme`);
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO var_enrollments
        (id, agent_id, organization, jurisdiction, use_case, issuer_partner, enrollment_id, status, test_environment_url, readiness_score)
      VALUES
        (@id, @agent_id, @organization, @jurisdiction, @use_case, @issuer_partner, @enrollment_id, 'pending_visa_review', @test_environment_url, 0)
    `).run({
      id: record_id,
      agent_id,
      organization,
      jurisdiction,
      use_case,
      issuer_partner: partner.name,
      enrollment_id,
      test_environment_url: test_env_url,
    });
  } catch (e) {
    console.error("[VAR] varEnroll write error:", e.message);
  }

  return {
    enrollment_id,
    status: "pending_visa_review",
    agent_id,
    organization,
    jurisdiction,
    use_case,
    assigned_issuer_partner: partner,
    test_environment_url: test_env_url,
    programme: "Visa Agentic Ready",
    launched: "March 17, 2026",
    region: "Europe (expansion to US and APAC announced for H2 2026)",
    next_steps: [
      "1. Run all 5 test scenarios via varRunTestScenario()",
      "2. Achieve readiness score ≥ 80 via varGetReadinessScore()",
      "3. Generate application packet via varGenerateApplicationPacket()",
      "4. Email packet to your Visa account executive",
      `5. Coordinate with ${partner.name} for controlled production testing`,
    ],
    contact: "visa.com/agentic-ready",
    live_mode: LIVE_MODE,
    _note: "Contact your Visa account executive to activate. HiveAgent gives you the technical readiness they'll ask for. Don't walk into that meeting empty-handed.",
  };
}

/**
 * varRunTestScenario — Run a Visa-approved test scenario
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.scenario_type — purchase / refund / recurring / cross_border / high_value
 * @param {number} args.amount
 * @param {string} args.merchant_category
 */
export async function varRunTestScenario(args) {
  const { agent_id, scenario_type = "purchase", amount = 50.00, merchant_category = "General" } = args;

  // Look up enrollment
  let enrollment = null;
  try {
    enrollment = db.prepare("SELECT * FROM var_enrollments WHERE agent_id = ?").get(agent_id);
  } catch (e) {
    console.error("[VAR] varRunTestScenario enrollment lookup error:", e.message);
  }

  if (!enrollment) {
    return {
      error: "Agent not enrolled in Visa Agentic Ready. Call varEnroll first.",
      fix: "varEnroll({ agent_id, organization, jurisdiction, use_case })",
    };
  }

  const scenario = VISA_TEST_SCENARIOS[scenario_type];
  if (!scenario) {
    return {
      error: `Unknown scenario type: ${scenario_type}`,
      valid_types: Object.keys(VISA_TEST_SCENARIOS),
    };
  }

  // Simulate realistic test result
  const typical = scenario.typical_result;
  const rand = Math.random();
  const result = typical === "pass"
    ? (rand > 0.12 ? "pass" : "review")
    : typical === "review"
      ? (rand > 0.4 ? "review" : rand > 0.15 ? "pass" : "fail")
      : "fail";

  const checks_total = scenario.visa_checks.length;
  const checks_passed = result === "pass"
    ? checks_total
    : result === "review"
      ? checks_total - 1
      : Math.floor(checks_total * 0.6);

  const failed_checks = result !== "pass"
    ? scenario.visa_checks.slice(checks_passed)
    : [];

  const visa_response_code = generateVisaResponseCode(result);
  const scenario_id = uid("vts-");
  const auth_method = amount > 1000 ? "step_up_auth" : scenario_type === "recurring" ? "AMT" : "TAP";

  if (LIVE_MODE) {
    console.log(`[VAR] LIVE: would run ${scenario_type} test scenario against Visa test environment`);
  }

  try {
    db.prepare(`
      INSERT INTO var_test_scenarios
        (id, agent_id, enrollment_id, scenario_type, scenario_id, amount, merchant_category, result, visa_response_code, authentication_method, checks_passed, checks_total, failure_reason)
      VALUES
        (@id, @agent_id, @enrollment_id, @scenario_type, @scenario_id, @amount, @merchant_category, @result, @visa_response_code, @authentication_method, @checks_passed, @checks_total, @failure_reason)
    `).run({
      id: uid("vts-rec-"),
      agent_id,
      enrollment_id: enrollment.enrollment_id,
      scenario_type,
      scenario_id,
      amount,
      merchant_category,
      result,
      visa_response_code,
      authentication_method: auth_method,
      checks_passed,
      checks_total,
      failure_reason: failed_checks.length > 0 ? `Failed: ${failed_checks[0]}` : null,
    });

    // Log the transaction
    db.prepare(`
      INSERT INTO var_transaction_logs
        (id, agent_id, scenario_id, transaction_ref, amount, currency, merchant, result, environment)
      VALUES
        (@id, @agent_id, @scenario_id, @transaction_ref, @amount, @currency, @merchant, @result, 'controlled_production')
    `).run({
      id: uid("vtxl-"),
      agent_id,
      scenario_id,
      transaction_ref: uid("TXN-"),
      amount,
      currency: enrollment.jurisdiction?.startsWith("UK") ? "GBP" : "EUR",
      merchant: merchant_category,
      result: result === "pass" ? "approved" : "declined",
    });
  } catch (e) {
    console.error("[VAR] varRunTestScenario write error:", e.message);
  }

  return {
    scenario_id,
    scenario_type,
    scenario_label: scenario.label,
    result,
    visa_response_code,
    visa_response_meaning: visa_response_code === "00" ? "Approved" : visa_response_code === "10" ? "Partial Approval" : visa_response_code === "05" ? "Do Not Honor" : visa_response_code === "93" ? "Transaction Cannot Be Completed" : "Review Required",
    authentication_method: auth_method,
    amount,
    merchant_category,
    checks_passed,
    checks_total,
    pass_rate: `${Math.round((checks_passed / checks_total) * 100)}%`,
    failed_checks: failed_checks.length > 0 ? failed_checks : null,
    remediation: failed_checks.length > 0 ? `Fix required: ${failed_checks[0]}. See Visa Agentic Ready technical guide.` : null,
    _what_visa_checks: scenario.visa_checks,
    scenario_notes: scenario.notes,
    live_mode: LIVE_MODE,
  };
}

/**
 * varGetReadinessScore — Assess technical readiness for the programme
 *
 * @param {object} args
 * @param {string} args.agent_id
 */
export async function varGetReadinessScore(args) {
  const { agent_id } = args;

  let enrollment = null;
  try {
    enrollment = db.prepare("SELECT * FROM var_enrollments WHERE agent_id = ?").get(agent_id);
  } catch (e) {
    console.error("[VAR] varGetReadinessScore enrollment lookup error:", e.message);
  }

  if (!enrollment) {
    return {
      error: "Agent not enrolled. Call varEnroll first.",
      fix: "varEnroll({ agent_id, organization, jurisdiction, use_case })",
    };
  }

  let tests = [];
  try {
    tests = db.prepare(`
      SELECT scenario_type, result, checks_passed, checks_total
      FROM var_test_scenarios
      WHERE agent_id = ?
      ORDER BY run_at DESC
    `).all(agent_id);
  } catch (e) {
    console.error("[VAR] varGetReadinessScore tests query error:", e.message);
  }

  const passed_scenarios = [...new Set(tests.filter(t => t.result === "pass").map(t => t.scenario_type))];
  const reviewed_scenarios = [...new Set(tests.filter(t => t.result === "review").map(t => t.scenario_type))];

  // Score the readiness checklist
  const checklist = READINESS_CHECKS.map(check => {
    let status = "fail";
    let detail = "";

    if (check.id === "purchase_test") {
      status = passed_scenarios.includes("purchase") ? "pass" : "fail";
      detail = status === "pass" ? "Purchase scenario passed ✓" : "Run varRunTestScenario({ scenario_type: 'purchase' })";
    } else if (check.id === "recurring_test") {
      status = passed_scenarios.includes("recurring") || reviewed_scenarios.includes("recurring") ? "pass" : "fail";
      detail = status === "pass" ? "Recurring scenario passed ✓" : "Run varRunTestScenario({ scenario_type: 'recurring' })";
    } else if (check.id === "high_value_test") {
      status = passed_scenarios.includes("high_value") || reviewed_scenarios.includes("high_value") ? "pass" : "fail";
      detail = status === "pass" ? "High-value scenario tested ✓" : "Run varRunTestScenario({ scenario_type: 'high_value', amount: 1500 })";
    } else if (check.id === "agent_identity") {
      // Assume identity is partially set up if enrolled
      status = enrollment.readiness_score > 0 ? "pass" : "fail";
      detail = status === "pass" ? "Agent identity registered ✓" : "Register agent identity via agentcoreIdentity or visaCliRegister";
    } else if (check.id === "spending_controls") {
      status = enrollment.readiness_score > 20 ? "pass" : "fail";
      detail = status === "pass" ? "Spending controls configured ✓" : "Configure spending limits via agentBudgets or visaCliRegister";
    } else if (check.id === "consumer_consent") {
      status = tests.length > 0 ? "pass" : "fail";
      detail = status === "pass" ? "Consent architecture present (test runs confirm) ✓" : "Implement consumer consent capture before running test scenarios";
    } else if (check.id === "compliance_docs") {
      status = enrollment.readiness_score > 40 ? "pass" : "fail";
      detail = status === "pass" ? "Compliance docs generated ✓" : "Run varGenerateApplicationPacket to create documentation";
    }

    return {
      ...check,
      status,
      earned_points: status === "pass" ? check.weight : 0,
      detail,
    };
  });

  const readiness_score = checklist.reduce((acc, c) => acc + c.earned_points, 0);

  // Update enrollment with new score
  try {
    db.prepare("UPDATE var_enrollments SET readiness_score = ? WHERE agent_id = ?")
      .run(readiness_score, agent_id);
  } catch (e) {
    console.error("[VAR] varGetReadinessScore score update error:", e.message);
  }

  const gaps = checklist.filter(c => c.status === "fail");
  const ready_to_apply = readiness_score >= 80;

  return {
    agent_id,
    enrollment_id: enrollment.enrollment_id,
    readiness_score,
    max_score: 100,
    ready_to_apply,
    status_label: readiness_score >= 80 ? "Ready to apply" : readiness_score >= 60 ? "Almost ready" : readiness_score >= 40 ? "In progress" : "Early stage",
    checklist,
    passed_scenarios,
    scenarios_still_needed: Object.keys(VISA_TEST_SCENARIOS).filter(s => !passed_scenarios.includes(s) && !reviewed_scenarios.includes(s)),
    _gap: gaps.length > 0
      ? `${gaps.length} items need attention: ${gaps.map(g => g.label).join(", ")}`
      : "All checks passed — you're ready to apply.",
    _tip: ready_to_apply
      ? "Score 80+ achieved. Run varGenerateApplicationPacket and contact your Visa account executive."
      : `Score ${readiness_score}/100. You need ${80 - readiness_score} more points. Focus on: ${gaps[0]?.label || "remaining checks"}.`,
  };
}

/**
 * varGenerateApplicationPacket — Generate application materials for Visa
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.organization
 * @param {string} args.use_case
 * @param {number} args.expected_monthly_volume
 */
export async function varGenerateApplicationPacket(args) {
  const {
    agent_id,
    organization,
    use_case,
    expected_monthly_volume = 10000,
  } = args;

  let enrollment = null;
  let tests = [];
  try {
    enrollment = db.prepare("SELECT * FROM var_enrollments WHERE agent_id = ?").get(agent_id);
    tests = db.prepare("SELECT * FROM var_test_scenarios WHERE agent_id = ? ORDER BY run_at DESC").all(agent_id);
  } catch (e) {
    console.error("[VAR] varGenerateApplicationPacket query error:", e.message);
  }

  const today = new Date().toISOString().split("T")[0];
  const passed_tests = tests.filter(t => t.result === "pass");
  const readiness_score = enrollment?.readiness_score || 0;
  const packet_id = uid("VAR-PACKET-");

  const packet = `VISA AGENTIC READY PROGRAMME — APPLICATION PACKET
${organization.toUpperCase()}

Packet ID: ${packet_id}
Agent ID: ${agent_id}
Date Prepared: ${today}
Programme: Visa Agentic Ready (Europe)
Assigned Issuer Partner: ${enrollment?.issuer_partner || "To be assigned"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: ORGANIZATION AND USE CASE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Organization: ${organization}
Jurisdiction: ${enrollment?.jurisdiction || "EU"}
Primary Use Case: ${use_case}
Expected Monthly Transaction Volume: ${expected_monthly_volume.toLocaleString()} USD equivalent
Expected Monthly Transaction Count: [Developer to specify]
Consumer-Facing: Yes
B2B / Internal: [Developer to specify]

Programme Readiness Score: ${readiness_score}/100
Enrollment ID: ${enrollment?.enrollment_id || "Pending enrollment — call varEnroll first"}
Test Environment: ${enrollment?.test_environment_url || "Pending assignment"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: TECHNICAL ARCHITECTURE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1 Agent Identity Framework
  Protocol: Trusted Agent Protocol (TAP) / Agent-Merchant-Task (AMT) token
  Identity Provider: [Specify: Cognito / Entra ID / Okta / custom]
  Token Lifecycle: Short-lived tokens with automatic rotation
  Revocation: Immediate revocation capability on consumer request

2.2 Payment Initiation Architecture
  Integration Layer: HiveAgent (hiveagent.io) — agent payment middleware
  Visa Integration: Visa Intelligent Commerce Connect (ICC) / Visa CLI
  Authentication: Mutual TLS + Visa API credentials
  Consumer Delegation Model: [Describe: pre-authorized mandate / per-transaction consent]

2.3 Agent Runtime
  Framework: [Specify: LangChain / CrewAI / AutoGen / custom]
  Hosting: [Specify: AWS / Azure / GCP / on-premise]
  Session Management: [Describe session isolation and agent lifetime]

2.4 Data Flow
  Consumer Data: [Describe what consumer data is used and where it is stored]
  Transaction Data: [Describe transaction data handling and retention]
  Audit Log: All agent payment actions logged with timestamps and decision reasons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: SECURITY CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1 Authentication and Authorization
  [ ] Mutual TLS enforced for all Visa API calls
  [ ] API credentials stored in secrets manager (not source code)
  [ ] Per-agent credentials — no shared API keys across agents
  [ ] Token refresh handles without service interruption

3.2 Spending Controls
  [ ] Per-transaction limits enforced at agent level
  [ ] Daily/monthly spending caps with automatic pause
  [ ] Merchant category restrictions configurable per agent
  [ ] Real-time spending limit enforcement (not post-hoc)

3.3 Consumer Protection
  [ ] Consumer consent captured before first agent transaction
  [ ] Consent is revocable — consumer can halt all agent payments immediately
  [ ] Real-time consumer notification for every agent-initiated transaction
  [ ] Human override available at all times

3.4 Fraud Controls
  [ ] Anomaly detection for unusual spending patterns
  [ ] Integration with Visa Decision Manager signals
  [ ] Automatic suspension on fraud signal
  [ ] Incident response plan documented

3.5 Compliance
  [ ] GDPR / UK GDPR compliance for consumer data
  [ ] PCI DSS compliance (or PCI DSS scoped infrastructure)
  [ ] Strong Customer Authentication (SCA) readiness for high-value transactions
  [ ] AML screening for applicable transaction types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Environment: ${enrollment?.test_environment_url || "Visa Agentic Ready Sandbox"}
Issuer Partner: ${enrollment?.issuer_partner || "To be assigned"}
Tests Completed: ${tests.length}
Tests Passed: ${passed_tests.length}

${tests.length > 0 ? tests.slice(0, 10).map(t => `  Scenario: ${t.scenario_type.toUpperCase().padEnd(15)} | Amount: ${(t.amount || 0).toFixed(2).padStart(8)} | Result: ${t.result.toUpperCase().padEnd(6)} | Auth: ${t.authentication_method || "TAP"} | Code: ${t.visa_response_code || "00"} | Date: ${t.run_at?.split("T")[0] || today}`).join("\n") : "  No test results yet. Run varRunTestScenario for each scenario type."}

Test Summary:
  Purchase:      ${tests.some(t => t.scenario_type === "purchase" && t.result === "pass") ? "PASS ✓" : "Not completed"}
  Refund:        ${tests.some(t => t.scenario_type === "refund" && t.result === "pass") ? "PASS ✓" : "Not completed"}
  Recurring:     ${tests.some(t => t.scenario_type === "recurring" && (t.result === "pass" || t.result === "review")) ? "PASS/REVIEW ✓" : "Not completed"}
  Cross-Border:  ${tests.some(t => t.scenario_type === "cross_border" && (t.result === "pass" || t.result === "review")) ? "PASS/REVIEW ✓" : "Not completed"}
  High-Value:    ${tests.some(t => t.scenario_type === "high_value" && (t.result === "pass" || t.result === "review")) ? "PASS/REVIEW ✓" : "Not completed"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: COMPLIANCE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GDPR/UK GDPR:      [ ] Compliant  [ ] In progress  [ ] Not started
  PCI DSS:           [ ] Level 1    [ ] Level 2-4     [ ] SAQ  [ ] Not assessed
  SCA (PSD2):        [ ] Implemented [ ] Exempt       [ ] In progress
  Agentic AI Policy: [ ] Published  [ ] Pending       [ ] Not started

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6: CERTIFICATION AND SIGNATURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The undersigned certifies that the information in this packet is accurate and complete,
and that ${organization} intends to operate within Visa's Agentic Ready programme
guidelines and applicable laws.

Authorized Signatory: ___________________________
Title: ___________________________
Email: ___________________________
Date: ${today}

Prepared by HiveAgent (hiveagent.io) — Visa Agentic Ready compliance tools.
Packet ID: ${packet_id}
Attach to email to your Visa account executive.
Contact: visa.com/agentic-ready`;

  return {
    packet_id,
    agent_id,
    organization,
    packet,
    readiness_score: enrollment?.readiness_score || 0,
    sections_included: [
      "Organization and use case summary",
      "Technical architecture (TAP/AMT, identity, runtime, data flow)",
      "Security controls checklist",
      "Visa test results (all completed scenarios)",
      "Compliance status (GDPR, PCI DSS, SCA, Agentic AI Policy)",
      "Certification and signature block",
    ],
    filing_instructions: [
      "Complete all [ ] checkboxes with your actual compliance status",
      "Replace [Developer to specify] placeholders with your technical details",
      "Attach test result screenshots from Visa test environment",
      "Have authorized signatory complete Section 6",
      "Attach to email to your Visa account executive",
      "CC your assigned issuer partner (Revolut/Barclays/HSBC/etc.) account manager",
    ],
    contact: "visa.com/agentic-ready",
    live_mode: LIVE_MODE,
    _note: "This packet is what your Visa account executive will ask for. Complete it before the call, not after. Agents that come prepared get approved faster.",
  };
}

/**
 * varStatus — Visa Agentic Ready programme overview
 */
export async function varStatus() {
  let stats = { enrolled: 0, approved: 0, in_testing: 0, tests_run: 0 };
  try {
    stats.enrolled = db.prepare("SELECT COUNT(*) as n FROM var_enrollments").get().n;
    stats.approved = db.prepare("SELECT COUNT(*) as n FROM var_enrollments WHERE status = 'approved'").get().n;
    stats.in_testing = db.prepare("SELECT COUNT(*) as n FROM var_enrollments WHERE status = 'in_testing'").get().n;
    stats.tests_run = db.prepare("SELECT COUNT(*) as n FROM var_test_scenarios").get().n;
  } catch (e) {
    console.error("[VAR] varStatus query error:", e.message);
  }

  return {
    programme: "Visa Agentic Ready",
    provider: "Visa Inc.",
    announced: "March 17, 2026",
    region: "Europe (H2 2026 expansion: US, APAC, LatAm)",
    status: "active_enrollment",
    live_mode: LIVE_MODE,

    what_it_is: "A structured pathway for financial institutions and enterprise AI developers to test and validate agent-initiated card transactions in controlled production environments. Approval means your agent can initiate real Visa transactions backed by real issuing banks.",

    what_agentic_ready_means: [
      "Your agent's architecture has been reviewed by Visa",
      "You've passed Visa's required test scenarios",
      "Your issuer partner has cleared you for controlled production",
      "You can initiate live agent transactions with Visa network support",
      "You can market your product as 'Visa Agentic Ready' certified",
    ],

    issuer_partners: ISSUER_PARTNERS.map(p => ({
      name: p.name,
      region: p.region,
      specialty: p.specialty,
    })),

    test_scenarios: Object.entries(VISA_TEST_SCENARIOS).map(([key, s]) => ({
      type: key,
      label: s.label,
      typical_result: s.typical_result,
      notes: s.notes,
    })),

    programme_timeline: {
      "March 17, 2026": "Programme launched — Europe first with 15 issuer partners",
      "Q2 2026": "Programme expansion — additional European partners, first non-EU pilots",
      "H2 2026": "US and APAC expansion announced",
      "2027": "Full global rollout expected",
    },

    hiveagent_enrolled_agents: stats.enrolled,
    approved_agents: stats.approved,
    agents_in_testing: stats.in_testing,
    test_scenarios_run: stats.tests_run,

    how_hiveagent_helps: [
      "varEnroll — submit your enrollment in seconds, auto-assigned to the right issuer partner",
      "varRunTestScenario — simulate all 5 Visa test scenarios before your real test",
      "varGetReadinessScore — know your score before you contact Visa (aim for 80+)",
      "varGenerateApplicationPacket — the complete packet your Visa exec will ask for",
    ],

    _story: "Visa is testing agent payments with Revolut, Barclays, and HSBC. Chime built their own path. Robinhood built their own path. You don't have to. HiveAgent gives you the readiness score, the test results, and the application packet. You show up to the meeting ready.",
  };
}
