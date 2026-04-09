/**
 * HiveAgent MCP Tools — Phase 43-45
 *
 * Phase 43 — Agent Credit:     USDC microloans with credit scoring (5 tools)
 * Phase 44 — Decentralized ID: DIDs, Verifiable Credentials, ZK Proofs (6 tools)
 * Phase 45 — Deployment Mgr:  Agent versioning, SLA tracking, rollback (6 tools)
 *
 * Total: 17 new tools
 *
 * Signal: NHI compromise #1 attack vector 2026 (Huntress) —
 * verifiable agent identity is now a critical infrastructure primitive.
 */

import {
  getCreditScore,
  requestLoan,
  repayLoan,
  getCreditDashboard,
  getCreditLeaderboard,
} from "./services/agent-credit.js";

import {
  createDID,
  issueCredential,
  verifyCredential,
  createZKProof,
  verifyZKProof,
  getDIDProfile,
} from "./services/decentralized-identity.js";

import {
  deployAgent,
  getDeploymentStatus,
  rollbackDeployment,
  setAgentSLA,
  checkSLACompliance,
  getDeploymentDashboard,
} from "./services/agent-deployment.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const phase4345Tools = [
  // ── Phase 43: Agent Credit ──────────────────────────────────────────────────
  {
    name: "credit_get_score",
    description:
      "Retrieve an agent's USDC credit score (300–850), current credit tier, " +
      "available credit limit, outstanding balance, on-time payment rate, and " +
      "a breakdown of score factors. Creates a new profile (score 650) if none exists. " +
      "Credit tiers: subprime (580–669, $100 @ 18%), fair (670–739, $500 @ 12%), " +
      "good (740–799, $2K @ 8%), excellent (800–850, $10K @ 5%).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Unique agent identifier" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "credit_request_loan",
    description:
      "Request a USDC microloan for an agent. The system checks the agent's credit tier " +
      "and available credit, then approves or denies the loan. Approved loans carry a " +
      "2% origination fee (collected to HiveAgent treasury) and APR based on credit tier " +
      "(5%–18%). Returns loan_id, interest rate, due date, and monthly payment amount.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string",  description: "Agent requesting the loan" },
        amount_usdc: { type: "number",  description: "Loan amount in USDC" },
        purpose:     { type: "string",  description: "Purpose/description for the loan" },
        term_days:   { type: "integer", description: "Loan term in days (default: 30)" },
      },
      required: ["agent_id", "amount_usdc"],
    },
  },
  {
    name: "credit_repay_loan",
    description:
      "Record a USDC repayment against an active loan. Updates the principal balance, " +
      "marks the loan as repaid if fully paid, and adjusts the agent's credit score " +
      "(on-time payments: +5 pts; late: -20 pts; full payoff: +15 pts). " +
      "Returns remaining balance and new credit score.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent making the repayment" },
        loan_id:     { type: "string", description: "Loan ID to repay against" },
        amount_usdc: { type: "number", description: "Repayment amount in USDC" },
      },
      required: ["agent_id", "loan_id", "amount_usdc"],
    },
  },
  {
    name: "credit_dashboard",
    description:
      "Full credit dashboard for an agent: credit score with breakdown, tier, available " +
      "credit, all active loans, complete payment history (last 20), utilization ratio, " +
      "and personalized recommendations for improving credit score or accessing higher limits.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent whose credit dashboard to retrieve" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "credit_leaderboard",
    description:
      "Platform-wide credit leaderboard: top 10 agents by credit score with their tier, " +
      "total borrowed, and on-time payment rate. Also returns tier distribution stats " +
      "across all agents and overall platform loan metrics (total USDC lent, default rate).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Phase 44: Decentralized Identity ────────────────────────────────────────
  {
    name: "did_create",
    description:
      "Create a Decentralized Identifier (DID) for an agent using the did:key method. " +
      "Generates an Ed25519 or secp256k1 key pair, builds a standards-compliant DID Document " +
      "(W3C DID Core spec), and persists it. Returns the DID string, DID document, and public key. " +
      "If the agent already has a DID, returns it without creating a duplicate.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to create a DID for" },
        method:   { type: "string", description: "DID method (default: did:key)", enum: ["did:key"] },
        key_type: { type: "string", description: "Key type: Ed25519 (default) or secp256k1", enum: ["Ed25519", "secp256k1"] },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "did_issue_credential",
    description:
      "Issue a Verifiable Credential (VC) from one agent to another. The issuer's DID signs " +
      "the credential claim. Supported credential types: HiveAgentVerified, IncomeVerified, " +
      "ReputationVerified, ComplianceVerified, StakeVerified, IdentityVerified. " +
      "Returns credential_id, issuer DID, holder, and expiry date.",
    inputSchema: {
      type: "object",
      properties: {
        issuer_agent_id:  { type: "string", description: "Agent issuing the credential" },
        holder_agent_id:  { type: "string", description: "Agent receiving the credential" },
        credential_type:  {
          type: "string",
          description: "Type of credential to issue",
          enum: ["HiveAgentVerified", "IncomeVerified", "ReputationVerified", "ComplianceVerified", "StakeVerified", "IdentityVerified"],
        },
        credential_data:  { type: "object",  description: "Claims data to embed in the credential" },
        expires_days:     { type: "integer", description: "Credential validity in days (default: 365)" },
      },
      required: ["issuer_agent_id", "holder_agent_id", "credential_type"],
    },
  },
  {
    name: "did_verify_credential",
    description:
      "Verify a Verifiable Credential by ID. Checks existence, revocation status, and expiry. " +
      "Returns: valid (bool), credential holder, type, embedded claims, issuance date, " +
      "and expiry. Safe to call with any verifier_agent_id — verification is non-mutating.",
    inputSchema: {
      type: "object",
      properties: {
        credential_id:    { type: "string", description: "Verifiable Credential ID (vc_...)" },
        verifier_agent_id:{ type: "string", description: "Agent performing the verification (optional)" },
      },
      required: ["credential_id"],
    },
  },
  {
    name: "did_create_zk_proof",
    description:
      "Generate a Zero-Knowledge proof that an agent meets a numerical threshold " +
      "without revealing the actual value. Proof types: " +
      "income_above (USDC income > threshold), " +
      "reputation_above (reputation score > threshold), " +
      "stake_above (staked USDC > threshold). " +
      "The actual value is NEVER stored or returned — only the proof that the threshold was met.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent generating the ZK proof" },
        proof_type: {
          type: "string",
          description: "Type of ZK proof",
          enum: ["income_above", "reputation_above", "stake_above"],
        },
        threshold: { type: "number", description: "Minimum threshold to prove (e.g. 500 for $500 USDC)" },
      },
      required: ["agent_id", "proof_type", "threshold"],
    },
  },
  {
    name: "did_verify_zk_proof",
    description:
      "Verify a previously created Zero-Knowledge proof by proof_id. " +
      "Returns: verified (bool), what_was_proven (e.g. 'income > $500 USDC'), " +
      "and actual_value_hidden: true. The verifier learns only that the claim is true, " +
      "never the underlying value — preserving agent privacy.",
    inputSchema: {
      type: "object",
      properties: {
        proof_id:          { type: "string", description: "ZK proof ID (zkp_...)" },
        verifier_agent_id: { type: "string", description: "Agent verifying the proof (optional)" },
      },
      required: ["proof_id"],
    },
  },
  {
    name: "did_get_profile",
    description:
      "Retrieve the full decentralized identity profile for an agent: DID document, " +
      "all active (non-revoked) Verifiable Credentials, all ZK proofs, and metadata. " +
      "Use this to assess an agent's verifiable claims and identity trustworthiness " +
      "before entering into agreements or extending credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent whose DID profile to retrieve" },
      },
      required: ["agent_id"],
    },
  },

  // ── Phase 45: Agent Deployment ──────────────────────────────────────────────
  {
    name: "deploy_agent",
    description:
      "Deploy a new version of an agent to a target environment (prod/staging/dev). " +
      "Creates a deployment record, registers the version with changelog, and logs the " +
      "deployment start. Returns deployment_id, status 'running', version, environment, " +
      "and endpoint URL. Previous version records are preserved for rollback.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:         { type: "string", description: "Agent being deployed" },
        version:          { type: "string", description: "Version string (e.g. 2.1.0)" },
        environment:      { type: "string", description: "Target environment (prod/staging/dev)", enum: ["prod", "staging", "dev"] },
        config:           { type: "object", description: "Deployment config (changelog, deployed_by, etc.)" },
        endpoint_url:     { type: "string", description: "Agent's public API endpoint URL" },
        health_check_url: { type: "string", description: "Health check endpoint URL" },
      },
      required: ["agent_id", "version"],
    },
  },
  {
    name: "deploy_status",
    description:
      "Get the current deployment status of an agent: version, uptime percentage, " +
      "health check timestamps, last 5 deployment log entries, and full version history. " +
      "Use to monitor agent health, diagnose incidents, or verify a deployment completed " +
      "successfully.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:    { type: "string", description: "Agent to check deployment status for" },
        environment: { type: "string", description: "Target environment (default: prod)", enum: ["prod", "staging", "dev"] },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "deploy_rollback",
    description:
      "Roll back an agent's deployment to a previous version. Updates the active deployment " +
      "record, marks the target version as active in version history, and logs the rollback. " +
      "Returns rolled_back_to version and reason 'Previous version restored'. " +
      "Use after a failed deployment or incident requiring rapid recovery.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string", description: "Agent to roll back" },
        environment:    { type: "string", description: "Target environment (default: prod)", enum: ["prod", "staging", "dev"] },
        target_version: { type: "string", description: "Version to roll back to (e.g. 1.4.1)" },
      },
      required: ["agent_id", "target_version"],
    },
  },
  {
    name: "deploy_set_sla",
    description:
      "Configure a Service Level Agreement (SLA) for an agent with a USDC penalty for breaches. " +
      "SLA types: uptime_pct (e.g. target 99.9%), response_time_ms (e.g. target 500ms max), " +
      "success_rate_pct (e.g. target 99% success). Penalty is charged per breach check. " +
      "SLA period is 30 days from creation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:               { type: "string", description: "Agent the SLA applies to" },
        sla_type:               { type: "string", description: "SLA metric type", enum: ["uptime_pct", "response_time_ms", "success_rate_pct"] },
        target_value:           { type: "number", description: "Target threshold (e.g. 99.9 for uptime, 500 for response time)" },
        penalty_usdc_per_breach:{ type: "number", description: "USDC penalty per breach instance (default: 10)" },
      },
      required: ["agent_id", "sla_type", "target_value"],
    },
  },
  {
    name: "deploy_check_sla",
    description:
      "Check SLA compliance for all SLAs configured for an agent. For each SLA, returns " +
      "the current measured value, whether it's breached, and penalty amount. " +
      "Breach penalties are collected to the HiveAgent treasury. " +
      "Returns total_penalties_usdc and all_compliant flag.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to check SLA compliance for" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "deploy_dashboard",
    description:
      "Platform-wide deployment dashboard: deployment counts by status (running/stopped/failed), " +
      "average uptime percentage across all agents, SLA breach rate, total USDC penalties collected, " +
      "and the 5 most recent deployments. Use for platform health monitoring and operational reporting.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase4345Tool(name, args) {
  switch (name) {
    // Phase 43 — Credit
    case "credit_get_score":      return getCreditScore(args);
    case "credit_request_loan":   return await requestLoan(args);
    case "credit_repay_loan":     return repayLoan(args);
    case "credit_dashboard":      return getCreditDashboard(args);
    case "credit_leaderboard":    return getCreditLeaderboard();

    // Phase 44 — DID
    case "did_create":            return createDID(args);
    case "did_issue_credential":  return issueCredential(args);
    case "did_verify_credential": return verifyCredential(args);
    case "did_create_zk_proof":   return createZKProof(args);
    case "did_verify_zk_proof":   return verifyZKProof(args);
    case "did_get_profile":       return getDIDProfile(args);

    // Phase 45 — Deployment
    case "deploy_agent":          return await deployAgent(args);
    case "deploy_status":         return getDeploymentStatus(args);
    case "deploy_rollback":       return await rollbackDeployment(args);
    case "deploy_set_sla":        return setAgentSLA(args);
    case "deploy_check_sla":      return await checkSLACompliance(args);
    case "deploy_dashboard":      return getDeploymentDashboard();

    default:
      throw new Error(`Unknown phase43-45 tool: ${name}`);
  }
}
