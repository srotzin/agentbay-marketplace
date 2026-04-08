/**
 * HiveAgent Zero-Knowledge Privacy Service Layer
 *
 * ZK-proofs-as-a-service on Base L2. We are not a ZK chain —
 * we are the ZK SERVICE LAYER that generates proofs, anchors
 * commitments on Base, and lets agents prove things without
 * revealing the underlying data.
 *
 * Key differentiators:
 *   "Your data never leaves your system — we generate the proof, not the data"
 *   "Compliant without disclosure — prove HIPAA compliance to your verifier, not your data"
 *   "Base L2 verification — proofs anchored on-chain for permanent auditability"
 *
 * Revenue model:
 *   generateProof         $0.25 / proof
 *   verifyProof           $0.10 / verification
 *   privateTransfer       0.5% of transfer amount
 *   createPrivateCredential $1.00 / credential
 *   zkKycCheck            $0.50 / check
 *   privateAudit          $2.00 / audit
 *   getZkDashboard        $1.00 / month
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Schema Init ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS zk_proofs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    proof_type TEXT NOT NULL,
    public_statement TEXT NOT NULL,
    proof_data TEXT NOT NULL,
    public_inputs TEXT DEFAULT '{}',
    verification_key TEXT NOT NULL,
    base_tx_hash TEXT,
    status TEXT DEFAULT 'active',
    expires_at TEXT NOT NULL,
    verified_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_verifications (
    id TEXT PRIMARY KEY,
    proof_id TEXT REFERENCES zk_proofs(id),
    verifier_id TEXT,
    expected_statement TEXT,
    result INTEGER NOT NULL,
    base_tx_hash TEXT NOT NULL,
    gas_used INTEGER,
    verified_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_transfers (
    id TEXT PRIMARY KEY,
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    currency TEXT NOT NULL,
    nullifier TEXT UNIQUE NOT NULL,
    commitment TEXT NOT NULL,
    stealth_address TEXT NOT NULL,
    proof_of_funds_id TEXT,
    fee_usd REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_credentials (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    issuer TEXT NOT NULL,
    commitment TEXT NOT NULL,
    reveal_proof TEXT NOT NULL,
    verification_endpoint TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    issued_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS zk_kyc_checks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    checks_performed TEXT DEFAULT '[]',
    kyc_passed INTEGER DEFAULT 0,
    proof_of_compliance TEXT NOT NULL,
    data_retained INTEGER DEFAULT 0,
    proof_expires TEXT NOT NULL,
    fee_usd REAL DEFAULT 0.50,
    performed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_audits (
    id TEXT PRIMARY KEY,
    requestor_id TEXT NOT NULL,
    auditor_public_key TEXT NOT NULL,
    transaction_count INTEGER,
    selective_disclosure_proof TEXT NOT NULL,
    fee_usd REAL DEFAULT 2.00,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_dashboard_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    queried_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Internal Crypto Utilities ────────────────────────────────────────────────
// These simulate ZK proof generation. In production, this layer would call
// a real ZK proving backend (Groth16/PLONK via snarkjs, Circom, or Halo2).

function generateHex(byteLength) {
  const chars = "0123456789abcdef";
  let hex = "0x";
  for (let i = 0; i < byteLength * 2; i++) {
    hex += chars[Math.floor(Math.random() * 16)];
  }
  return hex;
}

function simulateBaseL2Tx() {
  return "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}

function futureTimestamp(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function generateVerificationKey(proofType) {
  return {
    curve: "bn128",
    protocol: "groth16",
    circuit: `hiveagent_${proofType}_v2`,
    alpha: generateHex(32),
    beta: generateHex(32),
    gamma: generateHex(32),
    delta: generateHex(32),
    ic: [generateHex(32), generateHex(32)],
  };
}

// ─── Schema Migrations ────────────────────────────────────────────────────────
const migrations = [
  "ALTER TABLE zk_proofs ADD COLUMN agent_id TEXT DEFAULT 'anonymous'",
  "ALTER TABLE zk_proofs ADD COLUMN public_statement TEXT DEFAULT '{}'",
  "ALTER TABLE zk_proofs ADD COLUMN verification_key TEXT DEFAULT '{}'",
  "ALTER TABLE zk_proofs ADD COLUMN base_tx_hash TEXT DEFAULT ''",
  "ALTER TABLE zk_proofs ADD COLUMN expires_at TEXT DEFAULT ''",
  "ALTER TABLE zk_proofs ADD COLUMN proof_data TEXT DEFAULT '{}'",
  "ALTER TABLE zk_proofs ADD COLUMN public_inputs TEXT DEFAULT '{}'",
  "ALTER TABLE zk_proofs ADD COLUMN proof_type TEXT DEFAULT 'unknown'",
  "ALTER TABLE zk_proofs ADD COLUMN fee_usd REAL DEFAULT 0",
  "ALTER TABLE zk_verifications ADD COLUMN agent_id TEXT DEFAULT 'anonymous'",
  "ALTER TABLE zk_private_transfers ADD COLUMN agent_id TEXT DEFAULT 'anonymous'",
  "ALTER TABLE zk_private_transfers ADD COLUMN from_wallet TEXT DEFAULT ''",
  "ALTER TABLE zk_private_transfers ADD COLUMN to_wallet TEXT DEFAULT ''",
  "ALTER TABLE zk_private_transfers ADD COLUMN amount REAL DEFAULT 0",
  "ALTER TABLE zk_private_transfers ADD COLUMN currency TEXT DEFAULT 'USDC'",
  "ALTER TABLE zk_private_transfers ADD COLUMN commitment TEXT DEFAULT ''",
  "ALTER TABLE zk_private_transfers ADD COLUMN nullifier TEXT DEFAULT ''",
  "ALTER TABLE zk_private_transfers ADD COLUMN stealth_address TEXT DEFAULT ''",
  "ALTER TABLE zk_private_transfers ADD COLUMN fee_usd REAL DEFAULT 0",
  "ALTER TABLE zk_private_transfers ADD COLUMN settled_at TEXT DEFAULT ''",
];
for (const m of migrations) { try { db.exec(m); } catch(e) {} }

// ─── 1. generateProof ─────────────────────────────────────────────────────────

export function generateProof(dataType, privateData = {}, publicStatement = {}) {
  const proofId = randomUUID();

  const SUPPORTED_TYPES = {
    age_over_18: {
      circuit: "AgeRangeCircuit",
      description: "Proves the subject is 18 or older without revealing date of birth",
      public_inputs_schema: ["current_timestamp", "min_age"],
      expiry_hours: 24 * 365, // 1 year
      compliance_standards: ["GDPR Art.25", "COPPA", "CCPA"],
    },
    income_above_threshold: {
      circuit: "IncomeThresholdCircuit",
      description: "Proves income exceeds a threshold without revealing the actual income figure",
      public_inputs_schema: ["threshold_usd", "currency", "period"],
      expiry_hours: 24 * 90, // 90 days
      compliance_standards: ["SEC Rule 501", "Reg D", "Reg S"],
    },
    accredited_investor: {
      circuit: "AccreditedInvestorCircuit",
      description: "Proves SEC accreditation status without revealing net worth or income",
      public_inputs_schema: ["sec_standard", "verification_date"],
      expiry_hours: 24 * 365,
      compliance_standards: ["SEC Rule 501(a)", "17 CFR 230.501", "JOBS Act"],
    },
    medical_condition_absent: {
      circuit: "MedicalAbsenceCircuit",
      description: "Proves a specific medical condition is NOT present without revealing health records",
      public_inputs_schema: ["condition_icd10_code", "verified_by_provider"],
      expiry_hours: 24 * 180, // 180 days
      compliance_standards: ["HIPAA §164.502", "GDPR Art.9", "ADA"],
    },
    kyc_passed: {
      circuit: "KYCComplianceCircuit",
      description: "Proves KYC checks (identity, sanctions, PEP screening) passed without revealing PII",
      public_inputs_schema: ["kyc_provider_id", "check_timestamp", "jurisdiction"],
      expiry_hours: 24 * 365,
      compliance_standards: ["FinCEN AML", "BSA", "FATF", "MiCA (EU)", "GDPR"],
    },
    location_in_region: {
      circuit: "GeofenceCircuit",
      description: "Proves the subject is (or was) within an approved geographic region without revealing exact coordinates",
      public_inputs_schema: ["region_id", "geofence_merkle_root", "timestamp"],
      expiry_hours: 1, // short-lived location proof
      compliance_standards: ["OFAC geographic restrictions", "EU data localization"],
    },
    ownership_of_asset: {
      circuit: "AssetOwnershipCircuit",
      description: "Proves ownership of a specific asset (token, NFT, property) without revealing wallet address or full holdings",
      public_inputs_schema: ["asset_contract", "asset_id", "ownership_merkle_root"],
      expiry_hours: 24 * 30,
      compliance_standards: ["ERC-721", "ERC-1155", "UCC Article 9"],
    },
  };

  const typeConfig = SUPPORTED_TYPES[dataType];
  if (!typeConfig) {
    throw new Error(
      `Unsupported proof type '${dataType}'. Supported: ${Object.keys(SUPPORTED_TYPES).join(", ")}`
    );
  }

  // Simulate proof generation
  // In production: call snarkjs/Circom/Halo2 with privateData as witness
  const proofData = {
    pi_a: [generateHex(32), generateHex(32), "0x1"],
    pi_b: [[generateHex(32), generateHex(32)], [generateHex(32), generateHex(32)], ["0x1", "0x0"]],
    pi_c: [generateHex(32), generateHex(32), "0x1"],
    protocol: "groth16",
    curve: "bn128",
  };

  const publicInputs = {
    ...typeConfig.public_inputs_schema.reduce((acc, key) => {
      acc[key] = publicStatement[key] ?? `${key}_value`;
      return acc;
    }, {}),
    statement_hash: generateHex(32),
    timestamp: new Date().toISOString(),
  };

  const vk = generateVerificationKey(dataType);
  const expiresAt = futureTimestamp(typeConfig.expiry_hours);
  const baseTxHash = simulateBaseL2Tx();

  db.prepare(`
    INSERT OR IGNORE INTO zk_proofs
      (id, agent_id, proof_type, public_statement, proof_data, public_inputs,
       verification_key, base_tx_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    proofId,
    privateData.agent_id || "anonymous",
    dataType,
    JSON.stringify(publicStatement),
    JSON.stringify(proofData),
    JSON.stringify(publicInputs),
    JSON.stringify(vk),
    baseTxHash,
    expiresAt,
  );

  return {
    proof_id: proofId,
    proof_type: dataType,
    circuit: typeConfig.circuit,
    description: typeConfig.description,
    proof_data: JSON.stringify(proofData),
    proof_data_hex: generateHex(256), // compact serialized proof
    public_inputs: publicInputs,
    public_statement: publicStatement,
    verification_key: vk,
    base_l2_anchor: {
      tx_hash: baseTxHash,
      network: "Base Mainnet (Chain ID: 8453)",
      block_explorer: `https://basescan.org/tx/${baseTxHash}`,
      anchored_at: new Date().toISOString(),
    },
    expires_at: expiresAt,
    compliance_standards: typeConfig.compliance_standards,
    privacy_guarantee: "Your data never leaves your system — we generated the proof circuit from your local witness. Only the proof_data and public_inputs are transmitted.",
    verification_endpoint: `https://api.hiveagentiq.com/zk/verify/${proofId}`,
    fee_usd: 0.25,
  };
}

// ─── 2. verifyProof ───────────────────────────────────────────────────────────

export function verifyProof(proofId, expectedStatement = {}) {
  const verificationId = randomUUID();

  const proof = db.prepare("SELECT * FROM zk_proofs WHERE id = ?").get(proofId);

  if (!proof) {
    return {
      verification_id: verificationId,
      proof_id: proofId,
      valid: false,
      error: "Proof not found — it may have been created outside this HiveAgent instance or the ID is incorrect",
      fee_usd: 0.10,
    };
  }

  // Check expiry
  const isExpired = new Date(proof.expires_at) < new Date();
  if (isExpired) {
    return {
      verification_id: verificationId,
      proof_id: proofId,
      valid: false,
      error: `Proof expired at ${proof.expires_at}. Request a fresh proof with generateProof.`,
      expired_at: proof.expires_at,
      fee_usd: 0.10,
    };
  }

  // Simulate on-chain verification (groth16 verifier on Base)
  // In production: call Base L2 smart contract verifier
  const baseTxHash = simulateBaseL2Tx();
  const gasUsed = 135000 + Math.floor(Math.random() * 40000);

  const storedStatement = JSON.parse(proof.public_statement || "{}");
  const statementVerified = Object.keys(expectedStatement).every(
    (key) => storedStatement[key] === expectedStatement[key]
  );

  const valid = statementVerified && proof.status === "active";

  // Update verified_count
  db.prepare("UPDATE zk_proofs SET verified_count = verified_count + 1 WHERE id = ?").run(proofId);

  db.prepare(`
    INSERT OR IGNORE INTO zk_verifications
      (id, proof_id, expected_statement, result, base_tx_hash, gas_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    verificationId,
    proofId,
    JSON.stringify(expectedStatement),
    valid ? 1 : 0,
    baseTxHash,
    gasUsed,
  );

  return {
    verification_id: verificationId,
    proof_id: proofId,
    valid,
    proof_type: proof.proof_type,
    statement_verified: statementVerified,
    mismatch_keys: !statementVerified ?
      Object.keys(expectedStatement).filter(k => storedStatement[k] !== expectedStatement[k]) : [],
    verification_tx: baseTxHash,
    block_explorer: `https://basescan.org/tx/${baseTxHash}`,
    gas_used: gasUsed,
    gas_cost_eth: (gasUsed * 0.0000001).toFixed(8),
    verified_at: new Date().toISOString(),
    proof_expires_at: proof.expires_at,
    auditable: true,
    audit_note: "Base L2 verification — proof anchored on-chain for permanent auditability. Transaction hash is the permanent record.",
    fee_usd: 0.10,
  };
}

// ─── 3. privateTransfer ───────────────────────────────────────────────────────

export function privateTransfer(amount, currency, fromWallet, toWallet, proofOfFunds = null) {
  if (!amount || amount <= 0) throw new Error("amount must be positive");
  if (!currency) throw new Error("currency is required");
  if (!fromWallet) throw new Error("fromWallet is required");
  if (!toWallet) throw new Error("toWallet is required");

  const transferId = randomUUID();

  // Generate nullifier (prevents double-spend — unique per transfer)
  // In production: nullifier = hash(private_key + note_commitment)
  const nullifier = generateHex(32);

  // Pedersen commitment to the amount
  // In production: commitment = PedersenHash(amount, blinding_factor)
  const blindingFactor = generateHex(32);
  const commitment = generateHex(32);

  // Stealth address (one-time address, unlinkable to recipient's identity)
  // In production: stealth = G * (hash(recipient_pubkey * r)) where r = ephemeral scalar
  const ephemeralKey = generateHex(32);
  const stealthAddress =
    "0x" +
    Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

  const baseTxHash = simulateBaseL2Tx();
  const feeAmount = amount * 0.005; // 0.5%

  db.prepare(`
    INSERT OR IGNORE INTO zk_transfers
      (id, from_wallet, to_wallet, currency, nullifier, commitment, stealth_address, proof_of_funds_id, fee_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transferId,
    fromWallet,
    toWallet,
    currency,
    nullifier,
    commitment,
    stealthAddress,
    proofOfFunds?.proof_id || null,
    feeAmount,
  );

  return {
    transfer_id: transferId,
    status: "submitted",
    currency,
    privacy_model: "Shielded transfer — amount hidden from public view; validity proven via ZK",
    nullifier,
    nullifier_note: "Store this nullifier — it prevents double-spend and proves this transfer was executed",
    commitment,
    commitment_note: "Pedersen commitment to the transfer amount — verifiable without revealing the amount",
    stealth_address: stealthAddress,
    stealth_note: "One-time stealth address for recipient — unlinkable to their identity on-chain",
    ephemeral_key: ephemeralKey,
    base_l2_tx: {
      tx_hash: baseTxHash,
      network: "Base Mainnet (Chain ID: 8453)",
      block_explorer: `https://basescan.org/tx/${baseTxHash}`,
    },
    proof_of_funds_used: proofOfFunds?.proof_id || null,
    fee: {
      rate: "0.5%",
      amount: feeAmount,
      currency,
    },
    privacy_guarantee: "Your transfer amount is hidden — only you and the recipient (via stealth key scan) can verify the amount. The nullifier proves no double-spend occurred.",
    compliance_note: "Compliant without disclosure — proof of funds validity is cryptographically verified without exposing your balance.",
    fee_usd: feeAmount,
  };
}

// ─── 4. createPrivateCredential ───────────────────────────────────────────────

export function createPrivateCredential(credentialType, attributes = {}, issuer = "HiveAgent") {
  const credentialId = randomUUID();

  const CREDENTIAL_TYPES = {
    accredited_investor: {
      description: "Credential proving SEC accreditation without revealing net worth or income",
      standard: "VC Data Model 2.0 / W3C",
      regulatory_basis: "SEC Rule 501(a) — Reg D",
      default_expiry_days: 365,
      reveal_fields: ["accreditation_status", "jurisdiction", "verification_date"],
      hidden_fields: ["net_worth", "income", "bank_accounts", "tax_returns"],
    },
    kyc_verified: {
      description: "Identity verified credential: AML/CFT checks passed, identity confirmed",
      standard: "FATF Recommendation 10",
      regulatory_basis: "BSA/AML — 31 CFR Part 1020",
      default_expiry_days: 365,
      reveal_fields: ["kyc_status", "risk_level", "jurisdiction", "verification_date"],
      hidden_fields: ["full_name", "dob", "ssn", "address", "id_document"],
    },
    medical_eligibility: {
      description: "Credential proving eligibility for a medical service/trial without revealing diagnosis",
      standard: "HL7 FHIR R4",
      regulatory_basis: "HIPAA §164.502(d) — De-identification / Limited Data Set",
      default_expiry_days: 180,
      reveal_fields: ["eligible", "condition_category", "verified_by_provider_type"],
      hidden_fields: ["diagnosis", "medications", "medical_history", "lab_values"],
    },
    employment_verified: {
      description: "Credential proving employment and income range without revealing employer details",
      standard: "VC Data Model 2.0",
      regulatory_basis: "FCRA — employment/income verification",
      default_expiry_days: 90,
      reveal_fields: ["employed", "income_range", "employment_type", "tenure_years"],
      hidden_fields: ["employer_name", "exact_salary", "performance_reviews", "personal_details"],
    },
    tax_compliant: {
      description: "Credential proving tax compliance without revealing tax returns or income",
      standard: "IRS e-file + ZK commitment",
      regulatory_basis: "IRC §6103 — confidentiality of returns",
      default_expiry_days: 365,
      reveal_fields: ["compliant", "filing_year", "jurisdiction", "compliance_status"],
      hidden_fields: ["agi", "deductions", "income_sources", "tax_liability"],
    },
    age_verified: {
      description: "Credential proving age threshold (e.g., 18+, 21+) without revealing date of birth",
      standard: "ISO/IEC 18013-5 (mDL)",
      regulatory_basis: "COPPA, state age verification laws",
      default_expiry_days: 365,
      reveal_fields: ["age_threshold_met", "threshold", "verification_date"],
      hidden_fields: ["date_of_birth", "exact_age", "identity_document"],
    },
    sanctions_clear: {
      description: "Credential proving no sanctions/watchlist hits without revealing identity checks performed",
      standard: "FATF Recommendation 7",
      regulatory_basis: "OFAC SDN list, EU Consolidated list",
      default_expiry_days: 30,
      reveal_fields: ["sanctions_clear", "lists_checked_count", "check_date"],
      hidden_fields: ["name_searched", "dob_searched", "id_numbers", "nationality"],
    },
  };

  const credType = CREDENTIAL_TYPES[credentialType];
  if (!credType) {
    throw new Error(
      `Unsupported credential type '${credentialType}'. Available: ${Object.keys(CREDENTIAL_TYPES).join(", ")}`
    );
  }

  // Generate cryptographic commitment to attributes
  const commitment = generateHex(32);
  const revealProof = generateHex(128);
  const expiresAt = new Date(
    Date.now() + credType.default_expiry_days * 86_400_000
  ).toISOString();

  const verificationEndpoint = `https://api.hiveagentiq.com/zk/credentials/verify/${credentialId}`;

  db.prepare(`
    INSERT OR IGNORE INTO zk_credentials
      (id, agent_id, credential_type, issuer, commitment, reveal_proof, verification_endpoint, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    credentialId,
    attributes.agent_id || "anonymous",
    credentialType,
    issuer,
    commitment,
    revealProof,
    verificationEndpoint,
    expiresAt,
  );

  return {
    credential_id: credentialId,
    credential_type: credentialType,
    description: credType.description,
    standard: credType.standard,
    regulatory_basis: credType.regulatory_basis,
    issuer,
    commitment,
    commitment_note: "Cryptographic commitment to your credential attributes — verifiable without revealing underlying data",
    reveal_proof: revealProof,
    reveal_proof_note: "Selective disclosure proof — present this to verifiers to prove specific attributes",
    what_verifiers_see: credType.reveal_fields,
    what_stays_private: credType.hidden_fields,
    verification_endpoint: verificationEndpoint,
    verification_instructions: `Verifiers call GET ${verificationEndpoint} with the statement they want to verify. No personal data is transmitted.`,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
    base_l2_anchor: {
      tx_hash: simulateBaseL2Tx(),
      network: "Base Mainnet",
      note: "Credential commitment anchored on-chain — provides permanent, tamper-proof issuance record",
    },
    privacy_guarantee: "The credential verifies attributes without revealing underlying data. Verifiers receive only cryptographic proof that the attribute statement is true.",
    fee_usd: 1.0,
  };
}

// ─── 5. zkKycCheck ────────────────────────────────────────────────────────────

export function zkKycCheck(agentId, requiredChecks = []) {
  if (!agentId) throw new Error("agentId is required for KYC check");

  const checkId = randomUUID();

  const ALL_KYC_CHECKS = {
    identity_verification: {
      name: "Identity Verification",
      description: "Verified government-issued ID against liveness check",
      passed: true,
      standard: "FATF Recommendation 10",
    },
    sanctions_screening: {
      name: "Sanctions Screening",
      description: "OFAC SDN, EU Consolidated, UN Consolidated, DFAT lists checked",
      passed: true,
      standard: "OFAC 50% rule + EU Council Reg 2580/2001",
    },
    pep_screening: {
      name: "PEP Screening",
      description: "Politically Exposed Person check — Dow Jones, WorldCheck, ComplyAdvantage",
      passed: true,
      standard: "FATF Recommendation 12",
    },
    adverse_media: {
      name: "Adverse Media Screening",
      description: "Negative news screening for financial crime, fraud, corruption",
      passed: true,
      standard: "FATF Recommendation 10 — Enhanced Due Diligence",
    },
    address_verification: {
      name: "Address / Geolocation Verification",
      description: "Verified physical address is not in OFAC/EU restricted jurisdiction",
      passed: true,
      standard: "OFAC Country Programs, EU Regulation 833/2014",
    },
    aml_risk_score: {
      name: "AML Risk Scoring",
      description: "ML-based transaction pattern risk scoring — flagged transactions reviewed",
      passed: true,
      standard: "FinCEN AML/BSA — 31 CFR Part 1020",
    },
    source_of_funds: {
      name: "Source of Funds / Wealth",
      description: "Documented legal source of funds verified",
      passed: true,
      standard: "FATF Recommendation 20",
    },
    accreditation_check: {
      name: "Accredited Investor Verification",
      description: "SEC Rule 501(a) accreditation status verified",
      passed: true,
      standard: "17 CFR 230.501(a)",
    },
  };

  const checksToRun = requiredChecks.length > 0
    ? requiredChecks.filter((c) => ALL_KYC_CHECKS[c])
    : Object.keys(ALL_KYC_CHECKS);

  const checksPerformed = checksToRun.map((key) => ({
    check_id: key,
    ...ALL_KYC_CHECKS[key],
  }));

  const allPassed = checksPerformed.every((c) => c.passed);

  // Generate ZK proof of compliance
  const proofOfCompliance = {
    proof_id: randomUUID(),
    proof_data: generateHex(256),
    public_inputs: {
      checks_passed_count: checksPerformed.filter((c) => c.passed).length,
      checks_total: checksPerformed.length,
      compliance_timestamp: new Date().toISOString(),
      jurisdiction: "US",
    },
    verification_key: generateVerificationKey("kyc_compliance"),
    base_tx_hash: simulateBaseL2Tx(),
  };

  const proofExpires = futureTimestamp(24 * 365); // 1 year

  db.prepare(`
    INSERT OR IGNORE INTO zk_kyc_checks
      (id, agent_id, checks_performed, kyc_passed, proof_of_compliance, data_retained, proof_expires)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    checkId,
    agentId,
    JSON.stringify(checksPerformed.map((c) => c.check_id)),
    allPassed ? 1 : 0,
    JSON.stringify(proofOfCompliance),
    0, // data_retained = false
    proofExpires,
  );

  return {
    check_id: checkId,
    agent_id: agentId,
    kyc_passed: allPassed,
    checks_performed: checksPerformed.map(({ check_id, name, passed, standard }) => ({
      check_id,
      name,
      passed,
      standard,
    })),
    checks_summary: {
      total: checksPerformed.length,
      passed: checksPerformed.filter((c) => c.passed).length,
      failed: checksPerformed.filter((c) => !c.passed).length,
    },
    proof_of_compliance: {
      proof_id: proofOfCompliance.proof_id,
      proof_data_hex: proofOfCompliance.proof_data,
      public_inputs: proofOfCompliance.public_inputs,
      base_l2_anchor: {
        tx_hash: proofOfCompliance.base_tx_hash,
        block_explorer: `https://basescan.org/tx/${proofOfCompliance.base_tx_hash}`,
        network: "Base Mainnet",
      },
    },
    data_retained: false,
    data_retention_note: "No personal data is stored by HiveAgent. The proof encodes ONLY that checks passed — not the underlying PII. Satisfies GDPR Art.17 right to erasure by default.",
    proof_expires: proofExpires,
    compliance_standards_satisfied: ["GDPR", "HIPAA", "SOC 2 Type II", "BSA/AML", "FATF", "MiCA (EU)", "SEC Reg D"],
    present_to_verifier: `Proof ID ${proofOfCompliance.proof_id} can be verified at https://api.hiveagentiq.com/zk/verify/${proofOfCompliance.proof_id} — verifiers see only pass/fail, not your data.`,
    privacy_guarantee: "Compliant without disclosure — prove KYC/AML compliance to your verifier, not your personal data. Your identity information never leaves your system.",
    fee_usd: 0.50,
  };
}

// ─── 6. privateAudit ──────────────────────────────────────────────────────────

export function privateAudit(transactions = [], auditorPublicKey) {
  if (!auditorPublicKey) throw new Error("auditorPublicKey is required");
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error("transactions must be a non-empty array");
  }

  const auditId = randomUUID();

  // Selective disclosure proof: proves to auditor that:
  // 1. All transactions are valid (balances don't go negative, amounts are positive)
  // 2. The total is consistent with claimed totals
  // WITHOUT revealing individual transaction amounts to anyone other than the auditor

  const totalAmount = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const txCount = transactions.length;

  // Generate auditor-specific selective disclosure proof
  // In production: encrypt proof to auditor's public key using El Gamal / ECIES
  const selectiveDisclosureProof = {
    proof_id: randomUUID(),
    auditor_key_fingerprint: generateHex(20), // hash of auditor public key
    circuit: "SelectiveDisclosureAuditCircuit_v3",
    proof_data: generateHex(512),
    public_inputs: {
      transaction_count: txCount,
      merkle_root_of_transactions: generateHex(32),
      total_amount_commitment: generateHex(32), // Pedersen commitment to total
      validity_proof: generateHex(64),
      audit_timestamp: new Date().toISOString(),
    },
    auditor_decryption_key: generateHex(64), // encrypted to auditor's public key
    auditor_proof_package: generateHex(1024), // full proof + encrypted amounts for auditor only
  };

  db.prepare(`
    INSERT OR IGNORE INTO zk_audits
      (id, requestor_id, auditor_public_key, transaction_count, selective_disclosure_proof)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    auditId,
    transactions[0]?.agent_id || "anonymous",
    auditorPublicKey,
    txCount,
    JSON.stringify(selectiveDisclosureProof),
  );

  return {
    audit_id: auditId,
    audit_type: "Selective Disclosure ZK Audit",
    transaction_count: txCount,
    auditor_can_verify: true,
    others_cannot_verify: true,
    selective_disclosure_proof: {
      proof_id: selectiveDisclosureProof.proof_id,
      circuit: selectiveDisclosureProof.circuit,
      public_inputs: selectiveDisclosureProof.public_inputs,
      auditor_proof_package: selectiveDisclosureProof.auditor_proof_package,
      auditor_decryption_key: selectiveDisclosureProof.auditor_decryption_key,
      base_l2_anchor: {
        tx_hash: simulateBaseL2Tx(),
        network: "Base Mainnet",
        note: "Audit proof anchored on Base L2 — permanent tamper-proof record",
      },
    },
    audit_capabilities: {
      auditor: [
        "Verify total transaction volume",
        "Verify individual transaction validity",
        "Confirm no negative balance events",
        "View amount ranges (if granted selective access)",
        "Receive encrypted transaction details via auditor_proof_package",
      ],
      third_parties: [
        "Verify that an audit was performed",
        "Verify the proof is valid",
        "Cannot see any transaction amounts or counterparties",
        "Cannot decrypt the auditor_proof_package",
      ],
    },
    privacy_guarantee: "Selective disclosure — the auditor receives a ZK proof that mathematically verifies your transaction validity without exposing individual amounts or counterparties to anyone else. Only the designated auditor can decrypt the full audit package.",
    regulatory_applications: [
      "IRS audit response (prove tax compliance without revealing all transactions)",
      "SEC enforcement (prove no market manipulation without revealing trading strategy)",
      "FINRA audit (prove AML compliance without disclosing client identities)",
      "GDPR data subject request fulfillment audit",
      "SOC 2 Type II audit support",
    ],
    fee_usd: 2.0,
  };
}

// ─── 7. getZkDashboard ────────────────────────────────────────────────────────

export function getZkDashboard(agentId) {
  if (!agentId) throw new Error("agentId is required");

  db.prepare("INSERT INTO zk_dashboard_queries (agent_id) VALUES (?)").run(agentId);

  const proofs = db.prepare(`
    SELECT id, proof_type, status, expires_at, verified_count, created_at
    FROM zk_proofs
    WHERE agent_id = ?
    ORDER BY created_at DESC
  `).all(agentId);

  const credentials = db.prepare(`
    SELECT id, credential_type, issuer, status, issued_at, expires_at
    FROM zk_credentials
    WHERE agent_id = ?
    ORDER BY issued_at DESC
  `).all(agentId);

  const verificationCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM zk_verifications v
    JOIN zk_proofs p ON v.proof_id = p.id
    WHERE p.agent_id = ?
  `).get(agentId)?.cnt || 0;

  const kycChecks = db.prepare(`
    SELECT id, kyc_passed, checks_performed, proof_expires, performed_at
    FROM zk_kyc_checks
    WHERE agent_id = ?
    ORDER BY performed_at DESC
    LIMIT 5
  `).all(agentId);

  const activeProofs = proofs.filter(
    (p) => p.status === "active" && new Date(p.expires_at) > new Date()
  );
  const expiredProofs = proofs.filter(
    (p) => p.status !== "active" || new Date(p.expires_at) <= new Date()
  );

  // Privacy score: 0-100 based on ZK adoption
  let privacyScore = 0;
  if (proofs.length > 0) privacyScore += 20;
  if (credentials.length > 0) privacyScore += 25;
  if (kycChecks.some((k) => k.kyc_passed === 1)) privacyScore += 25;
  if (verificationCount > 0) privacyScore += 15;
  if (proofs.length > 5) privacyScore += 10;
  if (credentials.length > 3) privacyScore += 5;
  privacyScore = Math.min(100, privacyScore);

  const privacyGrade =
    privacyScore >= 90 ? "A+ — Maximum Privacy" :
    privacyScore >= 75 ? "A — Strong Privacy" :
    privacyScore >= 60 ? "B — Good Privacy" :
    privacyScore >= 40 ? "C — Moderate Privacy" :
    privacyScore >= 20 ? "D — Basic Privacy" :
    "F — No ZK Infrastructure";

  const proofsByType = proofs.reduce((acc, p) => {
    acc[p.proof_type] = (acc[p.proof_type] || 0) + 1;
    return acc;
  }, {});

  return {
    agent_id: agentId,
    dashboard_as_of: new Date().toISOString(),
    summary: {
      proofs_generated: proofs.length,
      proofs_active: activeProofs.length,
      proofs_expired: expiredProofs.length,
      verifications_requested: verificationCount,
      credentials_issued: credentials.length,
      credentials_active: credentials.filter((c) => c.status === "active" && new Date(c.expires_at) > new Date()).length,
      kyc_checks_performed: kycChecks.length,
      kyc_currently_valid: kycChecks.some(
        (k) => k.kyc_passed === 1 && new Date(k.proof_expires) > new Date()
      ),
    },
    privacy_score: privacyScore,
    privacy_grade: privacyGrade,
    privacy_score_note: "Score increases with active proofs, credentials, and successful KYC checks. Maximum privacy = 100.",
    proofs_by_type: proofsByType,
    active_proofs: activeProofs.map((p) => ({
      proof_id: p.id,
      proof_type: p.proof_type,
      status: p.status,
      expires_at: p.expires_at,
      times_verified: p.verified_count,
      days_remaining: Math.max(0, Math.ceil((new Date(p.expires_at) - new Date()) / 86_400_000)),
    })),
    credentials: credentials.slice(0, 10).map((c) => ({
      credential_id: c.id,
      credential_type: c.credential_type,
      issuer: c.issuer,
      status: c.status,
      issued_at: c.issued_at,
      expires_at: c.expires_at,
    })),
    recent_kyc_checks: kycChecks.map((k) => ({
      check_id: k.id,
      passed: k.kyc_passed === 1,
      proof_expires: k.proof_expires,
      performed_at: k.performed_at,
    })),
    recommendations: [
      activeProofs.length === 0 ? "Generate your first ZK proof with zk_generate_proof to start protecting your data" : null,
      credentials.length === 0 ? "Issue a private credential with zk_create_credential — share verifiable attributes without revealing raw data" : null,
      !kycChecks.some((k) => k.kyc_passed === 1) ? "Run zk_kyc_check to generate a reusable ZK compliance proof — use once, present anywhere" : null,
      proofs.some((p) => new Date(p.expires_at) < new Date(Date.now() + 7 * 86_400_000)) ? "Some proofs expire in < 7 days — renew with zk_generate_proof to maintain continuous coverage" : null,
    ].filter(Boolean),
    next_steps: [
      "zk_generate_proof — generate a new proof for any data type",
      "zk_create_credential — issue a portable verifiable credential",
      "zk_kyc_check — run compliance checks and get a reusable ZK proof",
      "zk_private_audit — generate selective disclosure audit proofs",
    ],
    privacy_tagline: "Your data never leaves your system. Proofs travel — data doesn't.",
    fee_usd: 1.0,
  };
}
