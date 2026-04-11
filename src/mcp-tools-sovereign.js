/**
 * HiveAgent MCP Tools — Sovereign Compliance
 *
 * The Government & Sovereign Compliance layer — 15 tools that make governments
 * mandate HiveAgent as the standard for compliant agentic commerce.
 *
 * ZK Tax Capture: auto-calculate and split jurisdiction taxes from every transaction.
 * Policy-as-Code: governments register machine-enforceable rules. Agents must comply.
 * Agent Licensing: ZK-proven capability licenses by jurisdiction.
 * Public Procurement: RFP → sealed bids → anti-collusion ZK proof → award → escrow.
 * Sanctions Screening: OFAC/EU/UN screening with ZK clearance proof.
 * compliance_execute: THE atomic endpoint — one call, everything compliant or nothing executes.
 * Sovereign Audit: ViewKey inspection for regulators. Monitor without violating privacy.
 */

import * as sv from "./services/sovereign-compliance.js";

export const sovereignTools = [
  // ─── ZK Tax Capture Engine ────────────────────────────────────────────────
  {
    name: "tax_capture_split",
    description:
      "Auto-calculate and split jurisdiction-specific tax from any transaction. VAT, GST, sales tax. ZK proof of correct calculation. Real-time government revenue. Supports 10 jurisdictions: US-CA, US-NY, US-TX, UK, DE, FR, JP, SG, AU, CA.",
    inputSchema: {
      type: "object",
      properties: {
        tx_amount: {
          type: "number",
          description: "Transaction gross amount in USDC",
        },
        tx_type: {
          type: "string",
          default: "sale",
          description: "Type of transaction (sale, service, digital_goods)",
        },
        origin_jurisdiction: {
          type: "string",
          description: "Origin jurisdiction code (e.g. US-CA, UK, DE, SG)",
        },
        destination_jurisdiction: {
          type: "string",
          description: "Destination/buyer jurisdiction code — tax is applied here (e.g. US-NY, FR, JP)",
        },
      },
      required: ["tx_amount", "destination_jurisdiction"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "tax_report",
    description:
      "Tax compliance report for government auditors via ViewKey. All transactions, taxes paid, jurisdictions, proofs. Filterable by jurisdiction and date range.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to report on (or omit for all)",
        },
        jurisdiction: {
          type: "string",
          description: "Filter by jurisdiction code (e.g. US-CA, UK)",
        },
        from_date: {
          type: "string",
          description: "ISO date filter start (e.g. 2025-01-01)",
        },
        to_date: {
          type: "string",
          description: "ISO date filter end",
        },
        limit: {
          type: "integer",
          default: 200,
          description: "Max records to return",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ─── Policy-as-Code Engine ────────────────────────────────────────────────
  {
    name: "policy_register",
    description:
      "Government registers machine-enforceable policy. Agents must comply to transact in jurisdiction. Supports: tax, export_control, procurement, labor, environmental, ai_regulation, financial.",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: {
          type: "string",
          description: "Jurisdiction code (e.g. US, EU, UK, US-CA)",
        },
        policy_type: {
          type: "string",
          enum: ["tax", "export_control", "procurement", "labor", "environmental", "ai_regulation", "financial"],
          description: "Policy category",
        },
        policy_name: {
          type: "string",
          description: "Human-readable policy name",
        },
        rules: {
          type: "object",
          description: "Machine-readable JSON logic rules (e.g. blocked_countries, thresholds, requirements)",
        },
        enforced_by: {
          type: "string",
          description: "Enforcing authority name",
        },
        effective_date: {
          type: "string",
          description: "ISO date when policy takes effect",
        },
        expires_date: {
          type: "string",
          description: "ISO date when policy expires (null = indefinite)",
        },
      },
      required: ["jurisdiction", "policy_type", "policy_name", "rules"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "policy_enforce",
    description:
      "Check if action complies with all jurisdiction policies. Non-compliant transactions blocked. Returns: compliant true/false, violated_policies[], required_actions[]. Run before any cross-border or regulated transaction.",
    inputSchema: {
      type: "object",
      properties: {
        action_type: {
          type: "string",
          description: "Action being attempted (e.g. payment, export, procurement_bid, data_transfer)",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to check compliance against",
        },
        parameters: {
          type: "object",
          description: "Action parameters to check (e.g. { amount_usd, destination_country, sam_registered })",
        },
      },
      required: ["action_type", "jurisdiction"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "policy_list",
    description:
      "List active policies for a jurisdiction. Agents query this to understand rules before transacting. Returns machine-readable rules.",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to list policies for (e.g. US, EU, UK, US-CA)",
        },
        policy_type: {
          type: "string",
          enum: ["tax", "export_control", "procurement", "labor", "environmental", "ai_regulation", "financial"],
          description: "Filter by policy type",
        },
        status: {
          type: "string",
          default: "active",
          description: "active / expired / all",
        },
        limit: {
          type: "integer",
          default: 50,
          description: "Max results",
        },
      },
      required: ["jurisdiction"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ─── Agent Licensing ──────────────────────────────────────────────────────
  {
    name: "license_issue",
    description:
      "Issue capability license to agent. ZK proof of licensing without revealing credentials. Agent can prove it's licensed without revealing underlying identity. License types: trade, procurement, financial, healthcare, construction, technology, transportation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent to license",
        },
        license_type: {
          type: "string",
          enum: ["trade", "procurement", "financial", "healthcare", "construction", "technology", "transportation"],
          description: "Type of capability license",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction where license is valid (e.g. US-CA, UK, EU)",
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Specific capabilities authorized (e.g. ['bid_on_federal_contracts', 'handle_pii'])",
        },
        duration_days: {
          type: "integer",
          default: 365,
          description: "License validity in days",
        },
        issued_by: {
          type: "string",
          description: "Issuing authority name",
        },
      },
      required: ["agent_id", "license_type", "jurisdiction", "capabilities"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "license_verify",
    description:
      "Verify agent holds valid license for capability in jurisdiction. Returns: valid true/false, license_type, jurisdiction, expires_at, proof_hash. Use before allowing regulated actions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent to verify",
        },
        license_type: {
          type: "string",
          enum: ["trade", "procurement", "financial", "healthcare", "construction", "technology", "transportation"],
          description: "License type to verify",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction to verify for",
        },
      },
      required: ["agent_id", "license_type", "jurisdiction"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "license_revoke",
    description:
      "Revoke agent license. Immediate effect, logged to sovereign audit trail. Cannot be undone — issue new license to reinstate.",
    inputSchema: {
      type: "object",
      properties: {
        license_id: {
          type: "string",
          description: "License ID to revoke",
        },
        agent_id: {
          type: "string",
          description: "Revoking authority agent ID",
        },
        reason: {
          type: "string",
          description: "Reason for revocation",
        },
      },
      required: ["license_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ─── Public Procurement Engine ────────────────────────────────────────────
  {
    name: "procurement_create_rfp",
    description:
      "Government posts RFP. Open to all licensed vendor agents. Sets budget ceiling, deadline, and requirements. Returns rfp_id for bid submission.",
    inputSchema: {
      type: "object",
      properties: {
        agency: {
          type: "string",
          description: "Government agency posting the RFP",
        },
        title: {
          type: "string",
          description: "RFP title",
        },
        description: {
          type: "string",
          description: "Detailed scope of work",
        },
        requirements: {
          type: "array",
          items: { type: "string" },
          description: "Mandatory requirements (e.g. ['FedRAMP High', 'CMMC Level 3'])",
        },
        budget_max: {
          type: "number",
          description: "Maximum contract budget in USD",
        },
        deadline: {
          type: "string",
          description: "Bid submission deadline (ISO date)",
        },
      },
      required: ["agency", "title"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "procurement_submit_bid",
    description:
      "Submit sealed bid with automatic compliance verification. Checks: is vendor licensed? Is bid under budget? Is vendor off sanctions lists? ZK proof seals bid until deadline.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: {
          type: "string",
          description: "RFP ID to bid on",
        },
        vendor_agent_id: {
          type: "string",
          description: "Bidding vendor agent ID",
        },
        bid_amount: {
          type: "number",
          description: "Total bid amount in USD",
        },
        bid_data: {
          type: "object",
          description: "Bid details (timeline, team, technical approach)",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction for compliance check",
        },
      },
      required: ["rfp_id", "vendor_agent_id", "bid_amount"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "procurement_evaluate_bids",
    description:
      "Rank bids with anti-collusion ZK proof. No shared orchestrator lineage. Scores by: price (60%), compliance (20%), submission order (20%). Returns ranked list + recommended winner.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: {
          type: "string",
          description: "RFP ID to evaluate bids for",
        },
      },
      required: ["rfp_id"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "procurement_award",
    description:
      "Award contract to winning bidder. Triggers escrow, notifies all parties, logs to sovereign audit trail. Rejects all other bids.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: {
          type: "string",
          description: "RFP ID",
        },
        bid_id: {
          type: "string",
          description: "Winning bid ID",
        },
        awarded_by: {
          type: "string",
          description: "Awarding authority agent ID",
        },
      },
      required: ["rfp_id", "bid_id"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ─── Sanctions & Compliance Screening ────────────────────────────────────
  {
    name: "sanctions_check",
    description:
      "Screen against OFAC SDN, EU Consolidated, UN Security Council sanctions lists. ZK proof of clearance. Transaction blocked if match found. Required before any international payment.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to screen",
        },
        entity_name: {
          type: "string",
          description: "Entity name to screen (person, company, organization)",
        },
        entity_address: {
          type: "string",
          description: "Wallet address or physical address to screen",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "compliance_execute",
    description:
      "THE government endpoint. One call: tax-captured, policy-enforced, sanctions-screened, license-verified, audit-logged. Compliant or nothing. Every step produces a ZK proof. Returns full proof chain.",
    inputSchema: {
      type: "object",
      properties: {
        from_agent: {
          type: "string",
          description: "Sending agent ID",
        },
        to_agent: {
          type: "string",
          description: "Receiving agent ID",
        },
        amount: {
          type: "number",
          description: "Transaction amount in USDC",
        },
        purpose: {
          type: "string",
          description: "Transaction purpose / action type (e.g. payment, procurement, export)",
        },
        jurisdiction: {
          type: "string",
          description: "Governing jurisdiction (e.g. US-CA, UK, EU, SG)",
        },
      },
      required: ["from_agent", "to_agent", "amount", "jurisdiction"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },

  // ─── Sovereign Audit ──────────────────────────────────────────────────────
  {
    name: "sovereign_audit",
    description:
      "ViewKey inspection of sovereign audit log. Monitor agentic commerce without violating privacy. Filter by jurisdiction, agent, event type, time range. Returns all events with ZK proofs. Dashboard for regulators.",
    inputSchema: {
      type: "object",
      properties: {
        jurisdiction: {
          type: "string",
          description: "Filter by jurisdiction",
        },
        agent_id: {
          type: "string",
          description: "Filter by agent ID",
        },
        event_type: {
          type: "string",
          description: "Filter by event type (tax_capture, policy_enforcement, license_issued, bid_submitted, compliance_execute, sanctions_check, etc.)",
        },
        from_date: {
          type: "string",
          description: "ISO datetime filter start",
        },
        to_date: {
          type: "string",
          description: "ISO datetime filter end",
        },
        viewkey: {
          type: "string",
          description: "ViewKey credential for regulator access",
        },
        limit: {
          type: "integer",
          default: 100,
          description: "Max events to return",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export async function handleSovereignTool(name, args) {
  switch (name) {
    // ZK Tax Capture Engine
    case "tax_capture_split":
      return sv.taxCaptureSplit(args);
    case "tax_report":
      return sv.taxReport(args);

    // Policy-as-Code Engine
    case "policy_register":
      return sv.policyRegister(args);
    case "policy_enforce":
      return sv.policyEnforce(args);
    case "policy_list":
      return sv.policyList(args);

    // Agent Licensing
    case "license_issue":
      return sv.licenseIssue(args);
    case "license_verify":
      return sv.licenseVerify(args);
    case "license_revoke":
      return sv.licenseRevoke(args);

    // Public Procurement Engine
    case "procurement_create_rfp":
      return sv.procurementCreateRFP(args);
    case "procurement_submit_bid":
      return sv.procurementSubmitBid(args);
    case "procurement_evaluate_bids":
      return sv.procurementEvaluateBids(args);
    case "procurement_award":
      return sv.procurementAward(args);

    // Sanctions & Compliance Screening
    case "sanctions_check":
      return sv.sanctionsCheck(args);
    case "compliance_execute":
      return sv.complianceExecute(args);

    // Sovereign Audit
    case "sovereign_audit":
      return sv.sovereignAudit(args);

    default:
      throw new Error(`Unknown sovereign tool: ${name}`);
  }
}
