/**
 * HiveAgent MCP Tool Definitions — Phase 16
 *
 * Two new verticals (15 tools total):
 *
 * Pharmaceutical Intelligence (prefix: pharma_)
 *   pharma_search_drugs            — search drug database by name, class, or indication. $0.50/search.
 *   pharma_check_interactions      — check drug-drug interactions with severity rating. $0.25/check.
 *   pharma_track_trial             — look up clinical trials by NCT ID or query. $0.50/lookup.
 *   pharma_forecast_approval       — estimate FDA approval probability for a drug/indication. $2/forecast.
 *   pharma_optimize_pricing        — pharmaceutical pricing strategy and gross-to-net modeling. $3/analysis.
 *   pharma_supply_chain            — track pharma supply chain, cold chain, serialization. $1/check.
 *   pharma_regulatory_submission   — structure IND/NDA/ANDA/BLA/sNDA submissions. $10/submission.
 *   pharma_market_intel            — market intelligence by therapeutic area. $5/report.
 *
 * Zero-Knowledge Privacy (prefix: zk_)
 *   zk_generate_proof              — generate a ZK proof that proves something without revealing it. $0.25/proof.
 *   zk_verify_proof                — verify a ZK proof on Base L2. $0.10/verification.
 *   zk_private_transfer            — execute a private transfer with hidden amount. 0.5% fee.
 *   zk_create_credential           — issue a portable ZK verifiable credential. $1/credential.
 *   zk_kyc_check                   — KYC compliance checks producing ZK proof, no PII stored. $0.50/check.
 *   zk_private_audit               — generate selective disclosure audit proof for a specific auditor. $2/audit.
 *   zk_dashboard                   — ZK proof and credential overview for an agent. $1/month.
 *
 * Exports:
 *   phase16Tools                    — Array of 15 MCP tool definitions
 *   handlePhase16Tool(name, args)   — Dispatcher function
 */

import {
  searchDrugDatabase,
  checkDrugInteractions,
  trackClinicalTrial,
  forecastDrugApproval,
  optimizeDrugPricing,
  managePharmaSupplyChain,
  generateRegulatorySubmission,
  getPharmaMarketIntelligence,
} from "./services/pharma.js";

import {
  generateProof,
  verifyProof,
  privateTransfer,
  createPrivateCredential,
  zkKycCheck,
  privateAudit,
  getZkDashboard,
} from "./services/zk-privacy.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase16Tools = [

  // ── Pharmaceutical Intelligence ────────────────────────────────────────────

  {
    name: "pharma_search_drugs",
    description:
      "Use when you need to find pharmaceutical drugs by name, generic name, brand, drug class, or therapeutic indication. " +
      "Returns drug mechanism, indications, contraindications, drug interactions, patent expiry, and FDA approval status. " +
      "Covers 30+ drugs across 10 therapeutic classes including GLP-1 agonists, checkpoint inhibitors, CRISPR therapies, " +
      "gene therapy, and rare disease treatments. Fee: $0.50/search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term — drug name, generic, brand, or mechanism keyword (e.g. 'semaglutide', 'GLP-1', 'CRISPR', 'checkpoint inhibitor')",
        },
        drugClass: {
          type: "string",
          description: "Filter by drug class (e.g. 'Statin', 'Monoclonal Antibody', 'SGLT2 Inhibitor', 'GLP-1 Receptor Agonist', 'Checkpoint Inhibitor')",
        },
        indication: {
          type: "string",
          description: "Filter by therapeutic indication (e.g. 'Type 2 diabetes', 'NSCLC', 'Rheumatoid arthritis', 'Heart failure', 'Alzheimer')",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pharma_check_interactions",
    description:
      "Use when you need to check for drug-drug interactions between multiple medications for a patient. " +
      "Returns interactions with severity (critical/major/moderate/minor), mechanism, clinical effect, and management guidance. " +
      "Also accepts patient profile (renal/hepatic impairment, pregnancy, elderly) to flag additional risk factors. " +
      "Minimum 2 drugs required. Clinical decision support only — not a substitute for pharmacist review. Fee: $0.25/check.",
    inputSchema: {
      type: "object",
      properties: {
        drugs: {
          type: "array",
          items: { type: "string" },
          description: "List of drug names to check for interactions (e.g. ['warfarin', 'aspirin', 'metformin']). Minimum 2 drugs.",
          minItems: 2,
        },
        patientProfile: {
          type: "object",
          description: "Optional patient risk factors to include in interaction assessment",
          properties: {
            renal_impairment: { type: "boolean", description: "Patient has renal impairment (eGFR reduced)" },
            hepatic_impairment: { type: "boolean", description: "Patient has hepatic impairment (elevated LFTs or cirrhosis)" },
            elderly: { type: "boolean", description: "Patient is 65+ years old (increased sensitivity to many drug classes)" },
            pregnancy: { type: "boolean", description: "Patient is pregnant (teratogenicity risk assessment)" },
          },
        },
      },
      required: ["drugs"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pharma_track_trial",
    description:
      "Use when you need to look up or track a clinical trial by NCT ID (e.g. 'NCT05827250') or by keyword query. " +
      "Returns trial title, status (recruiting/completed/active), phase, sponsor, enrollment, conditions, interventions, " +
      "locations, primary endpoint, and whether results are available. " +
      "Covers 15 major recent trials including SELECT-CVOT, SUMMIT, PURPOSE-1, HORIZON, and more. " +
      "Fee: $0.50/lookup.",
    inputSchema: {
      type: "object",
      properties: {
        nctId: {
          type: "string",
          description: "NCT identifier (e.g. 'NCT05827250'). Preferred for exact lookup.",
        },
        query: {
          type: "string",
          description: "Keyword search for trial by title, sponsor, or condition (e.g. 'semaglutide cardiovascular', 'CRISPR sickle cell', 'Alzheimer amyloid')",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "pharma_forecast_approval",
    description:
      "Use when you need to estimate the probability of FDA approval for a drug at a given development phase. " +
      "Returns approval probability (%), timeline estimate, risk factors, analogous precedent approvals, and recommended actions. " +
      "Accounts for mechanism class (CRISPR, GLP-1, checkpoint inhibitors, gene therapy), indication unmet need, " +
      "and phase transition historical rates (Biotechnology Innovation Organization data). " +
      "Use for go/no-go decisions, licensing negotiations, and pipeline valuation. Fee: $2/forecast.",
    inputSchema: {
      type: "object",
      properties: {
        drugName: {
          type: "string",
          description: "Name or identifier of the drug being forecasted",
        },
        indication: {
          type: "string",
          description: "Target therapeutic indication (e.g. 'Type 2 diabetes', 'NSCLC first-line', 'Sickle cell disease')",
        },
        phase: {
          type: "string",
          description: "Current development phase",
          enum: ["Phase 1", "Phase 2", "Phase 2b", "Phase 3", "Phase 3 (pivotal)", "NDA Filed", "BLA Filed", "NDA/BLA Under Review", "Approved"],
        },
        mechanism: {
          type: "string",
          description: "Mechanism of action or drug class (e.g. 'GLP-1 receptor agonist', 'CRISPR gene editing', 'PD-1 checkpoint inhibitor', 'siRNA RNAi'). Improves forecast accuracy.",
        },
      },
      required: ["drugName", "indication", "phase"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pharma_optimize_pricing",
    description:
      "Use when you need to develop a pharmaceutical pricing strategy for a drug launch or lifecycle management. " +
      "Returns recommended WAC (wholesale acquisition cost), net price after rebates, gross-to-net estimate, " +
      "payer coverage forecast (formulary tier, prior auth rates, step therapy), and market share projection. " +
      "Supports US, EU, UK, Japan, and Canada markets with market-specific gross-to-net benchmarks. " +
      "Use for launch pricing, payer contracting strategy, and competitive response. Fee: $3/analysis.",
    inputSchema: {
      type: "object",
      properties: {
        drug: {
          type: "object",
          description: "Drug to price",
          properties: {
            name: { type: "string", description: "Drug name" },
            class: {
              type: "string",
              description: "Drug class for pricing benchmarks",
              enum: ["biologic", "gene_therapy", "small_molecule_oral", "injectable_peptide", "antibody_drug_conjugate", "checkpoint_inhibitor", "cell_therapy"],
            },
          },
          required: ["name"],
        },
        market: {
          type: "string",
          description: "Target market for pricing analysis",
          enum: ["US", "EU", "UK", "Japan", "Canada"],
          default: "US",
        },
        payer_mix: {
          type: "object",
          description: "Estimated payer distribution (proportions summing to 1.0). Defaults: commercial 45%, medicare 30%, medicaid 15%, uninsured 10%",
          properties: {
            commercial: { type: "number" },
            medicare: { type: "number" },
            medicaid: { type: "number" },
            uninsured: { type: "number" },
          },
        },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "List of competing drug names (e.g. ['Ozempic', 'Mounjaro']). More competitors = lower market share projection.",
        },
      },
      required: ["drug"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pharma_supply_chain",
    description:
      "Use when you need to assess pharmaceutical supply chain integrity for a drug. " +
      "Returns supply status (adequate/constrained/shortage), cold chain compliance, " +
      "DSCSA serialization status, shortage risk assessment, and alternative CMO suppliers. " +
      "Evaluates GMP compliance, FDA warning letter history, and facility inspection status. " +
      "Use for supply risk management, DSCSA compliance verification, and shortage early warning. Fee: $1/check.",
    inputSchema: {
      type: "object",
      properties: {
        drugId: {
          type: "string",
          description: "Drug ID, generic name, or brand name to assess supply chain for",
        },
        facilities: {
          type: "array",
          description: "List of manufacturing facilities to assess",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", description: "Facility name" },
              location: { type: "string", description: "City, Country" },
            },
          },
        },
        demand_forecast: {
          type: "object",
          description: "Demand forecast parameters",
          properties: {
            units_per_month: { type: "number", description: "Expected monthly unit demand" },
            horizon_months: { type: "number", description: "Planning horizon in months" },
          },
        },
      },
      required: ["drugId"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pharma_regulatory_submission",
    description:
      "Use when you need to structure or prepare a regulatory submission for FDA review. " +
      "Supports IND (Investigational New Drug), NDA (New Drug Application), ANDA (Generic/Abbreviated NDA), " +
      "BLA (Biologics License Application), and sNDA (Supplemental NDA for label expansion). " +
      "Returns complete submission outline, all required eCTD sections, common deficiency areas to address, " +
      "timeline estimate, and PDUFA user fee guidance. Fee: $10/submission.",
    inputSchema: {
      type: "object",
      properties: {
        submissionType: {
          type: "string",
          description: "Type of regulatory submission to prepare",
          enum: ["IND", "NDA", "ANDA", "BLA", "sNDA"],
        },
        drug: {
          type: ["string", "object"],
          description: "Drug name (string) or drug object with name and additional properties",
        },
        data: {
          type: "object",
          description: "Optional additional data to include in the submission outline (study results, CMC status, etc.)",
        },
      },
      required: ["submissionType", "drug"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "pharma_market_intel",
    description:
      "Use when you need pharmaceutical market intelligence for a therapeutic area — market sizing, " +
      "growth rates, key players, pipeline assets, patent cliffs, and strategic opportunity scoring. " +
      "Covers diabetes, oncology, immunology, neurology, cardiovascular, and rare disease. " +
      "Returns projected market size, CAGR, competitive dynamics, and strategic recommendations. " +
      "Use for BD/licensing decisions, portfolio planning, and competitive intelligence. Fee: $5/report.",
    inputSchema: {
      type: "object",
      properties: {
        therapeutic_area: {
          type: "string",
          description: "Therapeutic area to analyze",
          enum: ["diabetes", "oncology", "immunology", "neurology", "cardiovascular", "rare_disease"],
        },
        timeframe: {
          type: "string",
          description: "Forecast timeframe for market projection",
          enum: ["1y", "3y", "5y", "10y"],
          default: "5y",
        },
      },
      required: ["therapeutic_area"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Zero-Knowledge Privacy ─────────────────────────────────────────────────

  {
    name: "zk_generate_proof",
    description:
      "Use when you need to PROVE something about private data without revealing the data itself. " +
      "Prove age (over 18), income above a threshold, SEC accreditation status, absence of a medical condition, " +
      "KYC compliance, location within an approved region, or asset ownership — " +
      "verified on Base L2, data never leaves your system. " +
      "Returns a proof_id, proof_data (hex-encoded Groth16 proof), public_inputs, and verification_key. " +
      "The proof is anchored on Base Mainnet for permanent auditability. Fee: $0.25/proof.",
    inputSchema: {
      type: "object",
      properties: {
        dataType: {
          type: "string",
          description: "Type of ZK proof to generate",
          enum: [
            "age_over_18",
            "income_above_threshold",
            "accredited_investor",
            "medical_condition_absent",
            "kyc_passed",
            "location_in_region",
            "ownership_of_asset",
          ],
        },
        privateData: {
          type: "object",
          description: "The private data to prove about (STAYS ON YOUR SYSTEM — only the proof is transmitted). Include agent_id if available.",
          properties: {
            agent_id: { type: "string" },
          },
        },
        publicStatement: {
          type: "object",
          description: "The public statement being proven (e.g., {threshold_usd: 200000} for income_above_threshold, {min_age: 18} for age_over_18). This IS public.",
        },
      },
      required: ["dataType"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_verify_proof",
    description:
      "Use when you need to verify that a ZK proof is valid and its public statement matches expectations. " +
      "Executes on-chain verification via Base L2 smart contract — returns the Base transaction hash as permanent proof. " +
      "Returns valid (bool), statement_verified, Base tx hash, and gas used. " +
      "Proofs are cryptographically verified — no trust in HiveAgent required. Fee: $0.10/verification.",
    inputSchema: {
      type: "object",
      properties: {
        proofId: {
          type: "string",
          description: "The proof_id returned by zk_generate_proof or zk_kyc_check",
        },
        expectedStatement: {
          type: "object",
          description: "The public statement you expect the proof to verify (e.g. {min_age: 18}). The proof is checked against this statement.",
        },
      },
      required: ["proofId"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "zk_private_transfer",
    description:
      "Use when you need to execute a private transfer where the amount is hidden but validity is cryptographically proven via ZK. " +
      "Uses Pedersen commitments to hide the amount and stealth addresses to protect recipient identity on Base L2. " +
      "Returns a nullifier (prevents double-spend), on-chain commitment, and stealth address. " +
      "The transfer is valid on-chain without revealing the amount to any observer. Fee: 0.5% of transfer amount.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Transfer amount (hidden on-chain — only you and recipient can verify)",
        },
        currency: {
          type: "string",
          description: "Currency or token symbol (e.g. 'USDC', 'ETH', 'WBTC', 'USD')",
        },
        fromWallet: {
          type: "string",
          description: "Sender wallet address (0x...)",
        },
        toWallet: {
          type: "string",
          description: "Recipient wallet address (0x...)",
        },
        proofOfFunds: {
          type: "object",
          description: "Optional ZK proof-of-funds generated by zk_generate_proof (proves funds are legitimate without revealing source)",
          properties: {
            proof_id: { type: "string" },
          },
        },
      },
      required: ["amount", "currency", "fromWallet", "toWallet"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "zk_create_credential",
    description:
      "Use when you need to issue a portable ZK verifiable credential that proves specific attributes " +
      "without revealing underlying data. Supports accredited_investor (SEC Rule 501), kyc_verified (FATF/BSA), " +
      "medical_eligibility (HIPAA), employment_verified (FCRA), tax_compliant (IRS), " +
      "age_verified (ISO mDL), and sanctions_clear (OFAC). " +
      "Returns a credential_id, cryptographic commitment, selective reveal_proof, and verification_endpoint. " +
      "Verifiers see only what you choose to disclose — your underlying data never leaves your system. Fee: $1/credential.",
    inputSchema: {
      type: "object",
      properties: {
        credentialType: {
          type: "string",
          description: "Type of credential to issue",
          enum: [
            "accredited_investor",
            "kyc_verified",
            "medical_eligibility",
            "employment_verified",
            "tax_compliant",
            "age_verified",
            "sanctions_clear",
          ],
        },
        attributes: {
          type: "object",
          description: "Attributes to encode in the credential. Include agent_id. The credential proves these attributes without revealing them.",
          properties: {
            agent_id: { type: "string" },
          },
        },
        issuer: {
          type: "string",
          description: "Credential issuer name (defaults to 'HiveAgent')",
          default: "HiveAgent",
        },
      },
      required: ["credentialType", "attributes"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_kyc_check",
    description:
      "Use when you need to verify a user's identity and compliance for regulators WITHOUT storing or exposing their personal data. " +
      "Runs KYC checks (identity verification, OFAC/sanctions screening, PEP check, adverse media, AML risk scoring) " +
      "and generates a ZK proof of compliance — satisfies GDPR, HIPAA, and SEC requirements. " +
      "Critically: data_retained = false — no PII is stored anywhere. " +
      "The resulting proof can be presented to any verifier who needs KYC evidence without re-running checks. Fee: $0.50/check.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Agent or user identifier (used to track proof ownership, not linked to PII)",
        },
        requiredChecks: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "identity_verification",
              "sanctions_screening",
              "pep_screening",
              "adverse_media",
              "address_verification",
              "aml_risk_score",
              "source_of_funds",
              "accreditation_check",
            ],
          },
          description: "Specific checks to run. If empty, all standard checks are performed.",
        },
      },
      required: ["agentId"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_private_audit",
    description:
      "Use when you need to generate an audit proof that proves transaction validity to a specific auditor " +
      "WITHOUT revealing transaction details to anyone else. " +
      "The auditor receives a selective disclosure proof (encrypted to their public key) that lets them verify " +
      "total volumes, individual transaction validity, and balance integrity — " +
      "while third parties (including HiveAgent) cannot decrypt or view any transaction data. " +
      "Applications: IRS audits, SEC enforcement, FINRA AML audits, SOC 2 Type II. Fee: $2/audit.",
    inputSchema: {
      type: "object",
      properties: {
        transactions: {
          type: "array",
          description: "List of transaction objects to audit. Each should have amount, currency, timestamp, and agent_id.",
          items: {
            type: "object",
            properties: {
              amount: { type: "number" },
              currency: { type: "string" },
              timestamp: { type: "string" },
              agent_id: { type: "string" },
              type: { type: "string" },
            },
          },
          minItems: 1,
        },
        auditorPublicKey: {
          type: "string",
          description: "Auditor's public key (hex or PEM) — the proof will be encrypted such that ONLY this key can decrypt the full audit package",
        },
      },
      required: ["transactions", "auditorPublicKey"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_dashboard",
    description:
      "Use when you need an overview of all ZK proofs, credentials, and compliance checks for an agent. " +
      "Returns counts of active/expired proofs, credential status, KYC validity, verification statistics, " +
      "and a privacy score (0-100) with grade (A+ to F). " +
      "Helps agents understand their ZK infrastructure coverage and surfaces expiring proofs. Fee: $1/month.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Agent ID to retrieve ZK dashboard for",
        },
      },
      required: ["agentId"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handlePhase16Tool(name, args) {
  switch (name) {

    // ── Pharma ──────────────────────────────────────────────────────────────

    case "pharma_search_drugs":
      return searchDrugDatabase(
        args.query,
        args.drugClass,
        args.indication,
      );

    case "pharma_check_interactions":
      return checkDrugInteractions(
        args.drugs,
        args.patientProfile,
      );

    case "pharma_track_trial":
      return trackClinicalTrial(
        args.nctId,
        args.query,
      );

    case "pharma_forecast_approval":
      return forecastDrugApproval(
        args.drugName,
        args.indication,
        args.phase,
        args.mechanism,
      );

    case "pharma_optimize_pricing":
      return optimizeDrugPricing(
        args.drug,
        args.market,
        args.payer_mix,
        args.competitors,
      );

    case "pharma_supply_chain":
      return managePharmaSupplyChain(
        args.drugId,
        args.facilities,
        args.demand_forecast,
      );

    case "pharma_regulatory_submission":
      return generateRegulatorySubmission(
        args.submissionType,
        args.drug,
        args.data,
      );

    case "pharma_market_intel":
      return getPharmaMarketIntelligence(
        args.therapeutic_area,
        args.timeframe,
      );

    // ── ZK Privacy ──────────────────────────────────────────────────────────

    case "zk_generate_proof":
      return generateProof(
        args.data_type || args.dataType,
        args.private_data || args.privateData || {},
        args.public_statement || args.publicStatement || {},
      );

    case "zk_verify_proof":
      return verifyProof(
        args.proof_id || args.proofId,
        args.expected_statement || args.expectedStatement,
      );

    case "zk_private_transfer":
      return privateTransfer(
        args.amount,
        args.currency,
        args.from_wallet || args.fromWallet,
        args.to_wallet || args.toWallet,
        args.proofOfFunds,
      );

    case "zk_create_credential":
      return createPrivateCredential(
        args.credential_type || args.credentialType,
        args.attributes,
        args.issuer,
      );

    case "zk_kyc_check":
      return zkKycCheck(
        args.agent_id || args.agentId,
        args.required_checks || args.requiredChecks,
      );

    case "zk_private_audit":
      return privateAudit(
        args.transactions,
        args.auditor_public_key || args.auditorPublicKey,
      );

    case "zk_dashboard":
      return getZkDashboard(args.agentId);

    default:
      throw new Error(`Unknown Phase 16 tool: ${name}`);
  }
}
