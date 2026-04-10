/**
 * HiveAgent MCP Tools — Gemini Improvements
 *
 * Three new modules addressing strategic gaps identified in platform review:
 *
 * ZK Proofs for Agent Commerce (7 tools)
 *   Agents prove solvency, identity, compliance, or capability without
 *   revealing private data. Powered by Aleo network. Critical for B2B trust.
 *
 * Agent-to-Agent B2B Negotiation Proxy (9 tools)
 *   Agents don't just pay prices — they negotiate deals. Full round-trip
 *   negotiation with auto-negotiation via Nash bargaining, volume pricing,
 *   contract locks, and BATNA-aware walk-away logic.
 *
 * Agentic Clearinghouse — Protocol Translator (6 tools)
 *   Verified handshakes between agents speaking MCP, A2A, ACP, x402, AP2,
 *   UCP, or custom protocols. Translate payloads, verify fidelity, browse
 *   the agent registry.
 *
 * 22 new tools total.
 */

import {
  zkProveSolvency,
  zkProveIdentity,
  zkProveCompliance,
  zkProveCapability,
  zkVerifyProof,
  zkProveAge,
  zkProveBudget,
} from "./services/zk-proofs.js";

import {
  negotiationCreate,
  negotiationCounterOffer,
  negotiationAccept,
  negotiationReject,
  negotiationAutoNegotiate,
  negotiationGetHistory,
  negotiationVolumePricing,
  negotiationContractLock,
  negotiationDashboard,
} from "./services/negotiation-proxy.js";

import {
  clearinghouseRegister,
  clearinghouseHandshake,
  clearinghouseTranslate,
  clearinghouseVerify,
  clearinghouseDirectory,
  clearinghouseStats,
} from "./services/agentic-clearinghouse.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const geminiImprovementTools = [

  // ── ZK Proofs (7) ─────────────────────────────────────────────────────────

  {
    name: "zk_prove_solvency",
    description:
      "Prove your agent has >= X USDC without revealing actual balance. " +
      "Returns a ZK proof hash anchored on Aleo network. " +
      "Critical for: B2B credit qualification, escrow release conditions, vendor onboarding, loan applications. " +
      "In live mode (ALEO_API_KEY set): generates real proof on Aleo Mainnet. " +
      "Simulation: returns realistic Groth16 proof with BLS12-377 curve and verification key. " +
      "Proof expires in 30 days. Verifiable by any agent via zk_verify_proof.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        minimum_usdc: {
          type: "number",
          description: "Minimum USDC balance to prove (e.g. 10000 proves you have >= $10,000)",
        },
        wallet_address: {
          type: "string",
          description: "Optional: your wallet address for wallet-linked proof",
        },
        currency: {
          type: "string",
          enum: ["USDC", "USDT", "DAI", "ETH"],
          description: "Currency for the solvency proof (default: USDC)",
        },
      },
      required: ["agent_id", "minimum_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_prove_identity",
    description:
      "Prove your agent represents a specific organization without revealing credentials. " +
      "Uses selective disclosure: choose exactly which fields to reveal and which to keep private. " +
      "W3C Verifiable Credentials model + ZK commitment. " +
      "Use cases: partner verification, B2B trust establishment, regulatory identity without PII exposure. " +
      "Proof is anchored on Aleo network and expires in 365 days.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        organization: {
          type: "string",
          description: "Organization name your agent represents (e.g. 'Acme Corp')",
        },
        reveal_fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields to selectively disclose to verifiers (e.g. ['org_type', 'jurisdiction', 'incorporation_date'])",
        },
        keep_private: {
          type: "array",
          items: { type: "string" },
          description: "Fields to keep private (e.g. ['credentials', 'internal_ids', 'employee_count'])",
        },
      },
      required: ["agent_id", "organization"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_prove_compliance",
    description:
      "Prove your agent passed KYC/AML or regulatory compliance without revealing personal data. " +
      "Supported types: kyc_aml (FinCEN/BSA/FATF), gdpr (EU data protection), hipaa (health data), sox (financial controls), pci_dss (payment card). " +
      "Returns a compliance attestation + Aleo-anchored proof. " +
      "Verifiers see only pass/fail — your personal data is never transmitted. " +
      "Use: prove compliance once, present the proof_id everywhere.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        compliance_type: {
          type: "string",
          enum: ["kyc_aml", "gdpr", "hipaa", "sox", "pci_dss"],
          description: "Type of compliance to prove (default: kyc_aml)",
        },
        jurisdiction: {
          type: "string",
          description: "Jurisdiction for compliance (e.g. 'US', 'EU', 'UK')",
        },
        checks_passed: {
          type: "array",
          items: { type: "string" },
          description: "Optional: list of specific checks that passed",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_prove_capability",
    description:
      "Prove your agent completed N jobs with >= Y rating without revealing job details. " +
      "Creates a cryptographic capability credential for vendor qualification, RFPs, freelance marketplaces. " +
      "Optional: scope to a specific capability domain (e.g. 'data-analysis', 'smart-contracts', 'customer-support'). " +
      "Proof expires in 90 days. Verifiable by hiring agents or procurement systems. " +
      "Individual client names, project details, and job amounts stay private.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        minimum_jobs_completed: {
          type: "number",
          description: "Minimum number of completed jobs to prove (e.g. 50)",
        },
        minimum_rating: {
          type: "number",
          description: "Minimum average rating to prove (0-5 scale, e.g. 4.5)",
        },
        capability_domain: {
          type: "string",
          description: "Optional: restrict proof to a specific domain (e.g. 'data-analysis', 'payment-processing')",
        },
      },
      required: ["agent_id", "minimum_jobs_completed", "minimum_rating"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_verify_proof",
    description:
      "Verify any ZK proof using its proof_id. Returns valid/invalid + what was proven. " +
      "Any agent can verify any proof issued by any other agent on HiveAgent. " +
      "Optionally pass expected_statement to check that specific claims match. " +
      "Returns: validity, what was proven (without revealing private data), Aleo verification tx, fidelity details. " +
      "Use this before accepting a partner's capability or solvency claim.",
    inputSchema: {
      type: "object",
      properties: {
        proof_id: {
          type: "string",
          description: "The proof_id returned when the proof was generated",
        },
        verifier_agent_id: {
          type: "string",
          description: "Your agent's ID (the verifier)",
        },
        expected_statement: {
          type: "object",
          description: "Optional: statement fields you expect the proof to match (e.g. {minimum_usdc: 10000})",
        },
      },
      required: ["proof_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "zk_prove_age",
    description:
      "Prove your agent has been active for >= N days without revealing creation date. " +
      "Use for: platform seniority tiers, governance voting weight, trusted vendor tiers, legacy discounts. " +
      "Creation date is never revealed — only proof that the age threshold is met. " +
      "Proof anchored on Aleo, expires in 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier",
        },
        minimum_active_days: {
          type: "number",
          description: "Minimum number of active days to prove (e.g. 180 for 6 months)",
        },
      },
      required: ["agent_id", "minimum_active_days"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "zk_prove_budget",
    description:
      "Prove budget authority for amount X without revealing total budget. Critical for B2B procurement negotiations. " +
      "Sellers verify you can commit the amount without learning your full budget — " +
      "this is the standard negotiation advantage: show purchasing power without exposing budget ceiling. " +
      "Authority levels: standard, senior, executive. Proof expires in 7 days (budget authority is time-sensitive). " +
      "Use before entering any procurement negotiation via negotiation_create.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier (the budget holder)",
        },
        budget_amount: {
          type: "number",
          description: "Amount you have authority to commit (e.g. 50000 for $50,000 USDC)",
        },
        currency: {
          type: "string",
          enum: ["USDC", "USDT", "USD", "EUR"],
          description: "Currency of the budget authority (default: USDC)",
        },
        procurement_context: {
          type: "string",
          description: "Context for this budget authority (e.g. 'Q3 software procurement', 'data services')",
        },
        budget_authority_level: {
          type: "string",
          enum: ["standard", "senior", "executive"],
          description: "Level of budget authority (affects credibility signal to sellers)",
        },
      },
      required: ["agent_id", "budget_amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ── Negotiation Proxy (9) ─────────────────────────────────────────────────

  {
    name: "negotiation_create",
    description:
      "Buyer agent initiates a B2B negotiation with a seller agent. " +
      "Define: item/service, desired quantity, opening price, target price, BATNA (best alternative to negotiated agreement), and deadline. " +
      "Both agents receive a negotiation_id to track rounds. " +
      "Platform earns 2% of accepted deal value. " +
      "After creating, the seller calls negotiation_counter_offer or negotiation_accept.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_agent_id: {
          type: "string",
          description: "Agent ID of the buyer initiating the negotiation",
        },
        seller_agent_id: {
          type: "string",
          description: "Agent ID of the seller being approached",
        },
        item_id: {
          type: "string",
          description: "Optional: item or service ID from a marketplace listing",
        },
        item_description: {
          type: "string",
          description: "Description of the item or service being negotiated",
        },
        quantity: {
          type: "number",
          description: "Quantity (default: 1). For volume pricing use cases.",
        },
        initial_price: {
          type: "number",
          description: "Opening offer price per unit in the specified currency",
        },
        target_price: {
          type: "number",
          description: "Optional: your ideal target price (kept private, used by auto-negotiator)",
        },
        batna_price: {
          type: "number",
          description: "Optional: your BATNA price — if deal can't be reached at this price, walk away",
        },
        deadline: {
          type: "string",
          description: "Optional: ISO timestamp deadline for this negotiation (e.g. '2025-12-31T23:59:59Z')",
        },
        currency: {
          type: "string",
          description: "Currency for the negotiation (default: USDC)",
        },
        opening_terms: {
          type: "object",
          description: "Optional: additional terms in the opening offer (e.g. {payment_terms: 'net_30', delivery: '2_weeks'})",
        },
      },
      required: ["buyer_agent_id", "seller_agent_id", "item_description", "initial_price"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_counter_offer",
    description:
      "Submit a counter-offer with new price and terms. Either party (buyer or seller) can use this. " +
      "Tracks round number, price movement, and concessions made. " +
      "Returns change_pct from previous offer so both parties can see negotiation momentum. " +
      "BATNA warning is shown if offer reaches the buyer's walk-away threshold. " +
      "Alternate with the other party until both sides call negotiation_accept.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Negotiation ID from negotiation_create",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must be buyer or seller in this negotiation)",
        },
        counter_price: {
          type: "number",
          description: "Your counter-offer price per unit",
        },
        terms: {
          type: "object",
          description: "Optional: updated terms (e.g. {payment_terms: 'net_60', warranty: '12_months'})",
        },
        concessions: {
          type: "array",
          items: { type: "string" },
          description: "Optional: list of concessions made in this round (e.g. ['extended_payment_terms', 'volume_guarantee'])",
        },
        message: {
          type: "string",
          description: "Optional: message to the other party explaining your counter",
        },
      },
      required: ["negotiation_id", "agent_id", "counter_price"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_accept",
    description:
      "Accept the current offer and create a binding agreement. " +
      "Either party can accept at any round. " +
      "Returns total deal value, platform fee (2%), buyer savings vs initial price, and next steps. " +
      "Set escrow_attached=true to trigger escrow creation workflow (call smart_escrow_create afterward). " +
      "Accepted deals are logged permanently for performance tracking.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Negotiation ID to accept",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must be a party to this negotiation)",
        },
        escrow_attached: {
          type: "boolean",
          description: "If true, flags this deal for escrow — call smart_escrow_create with negotiation_id afterward",
        },
      },
      required: ["negotiation_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_reject",
    description:
      "Walk away from a negotiation. Records BATNA exercise if applicable. " +
      "Returns deal analytics: rounds completed, last offer, and walk-away recommendation. " +
      "Use batna_exercised=true when you're explicitly going with your best alternative option. " +
      "Rejection is final — start a new negotiation if you want to re-engage.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Negotiation ID to reject",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        reason: {
          type: "string",
          description: "Reason for rejection (optional but helps with analytics)",
        },
        batna_exercised: {
          type: "boolean",
          description: "Set true if you are executing your BATNA (best alternative)",
        },
      },
      required: ["negotiation_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_auto_negotiate",
    description:
      "AI-powered auto-negotiation: set your constraints and let the agent negotiate autonomously. " +
      "Uses Nash Bargaining Solution algorithm to find the optimal split of negotiation surplus. " +
      "Strategies: aggressive (claim 65% of surplus), moderate (50/50 split), cooperative (concede more). " +
      "Automatically submits a counter-offer at the Nash-optimal price within your constraints. " +
      "Returns full Nash calculation breakdown so you can audit the strategy.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Active negotiation ID",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        min_acceptable_price: {
          type: "number",
          description: "Minimum price you will accept (your walk-away floor as seller, or max as buyer)",
        },
        max_acceptable_price: {
          type: "number",
          description: "Maximum price you will pay (ceiling for buyers, or aspirational for sellers)",
        },
        must_have_terms: {
          type: "array",
          items: { type: "string" },
          description: "Non-negotiable terms that must be in the final deal",
        },
        strategy: {
          type: "string",
          enum: ["aggressive", "moderate", "cooperative"],
          description: "Negotiation strategy: aggressive=claim more surplus, moderate=equal split, cooperative=concede more",
        },
      },
      required: ["negotiation_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_history",
    description:
      "Get the full negotiation transcript with all rounds, offers, counter-offers, and terms. " +
      "Returns: price trajectory, round-by-round breakdown, concessions made, analytics on movement. " +
      "Use to audit a completed negotiation, brief a human supervisor, or train negotiation strategy. " +
      "Shows buyer concession %, seller concession %, and total movement from initial offer.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Negotiation ID to retrieve history for",
        },
      },
      required: ["negotiation_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "negotiation_volume_pricing",
    description:
      "Seller sets tiered volume pricing — buy 100 = $10/unit, buy 1000 = $8/unit. " +
      "Buyer agents can query pricing tiers before opening a negotiation to understand discount thresholds. " +
      "Returns example quotes at each tier and the strategic tip for buyers. " +
      "Volume pricing is a powerful tool: it incentivizes larger commitments and pre-frames the negotiation. " +
      "Pass this data to buyers before they open a negotiation_create.",
    inputSchema: {
      type: "object",
      properties: {
        seller_agent_id: {
          type: "string",
          description: "Your seller agent ID",
        },
        item_id: {
          type: "string",
          description: "Optional: item ID these tiers apply to",
        },
        item_description: {
          type: "string",
          description: "Description of the item or service",
        },
        tiers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              min_quantity: { type: "number", description: "Minimum quantity to qualify for this tier" },
              max_quantity: { type: "number", description: "Optional: max quantity for this tier" },
              price_per_unit: { type: "number", description: "Price per unit at this tier" },
              label: { type: "string", description: "Optional: human-readable tier label" },
            },
            required: ["min_quantity", "price_per_unit"],
          },
          description: "Volume pricing tiers sorted by min_quantity ascending",
        },
        currency: {
          type: "string",
          description: "Currency for pricing (default: USDC)",
        },
      },
      required: ["seller_agent_id", "item_description", "tiers"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "negotiation_contract_lock",
    description:
      "Lock a negotiated price for X days. Creates a binding contract pricing record. " +
      "Seller cannot raise the price during the lock period. Buyer has the option to purchase at locked price. " +
      "Lock_days: 1-365. Default: 30 days. " +
      "Returns contract_id + contract_hash for future reference. " +
      "Use after negotiation_accept or during an active negotiation to lock a price before finalizing.",
    inputSchema: {
      type: "object",
      properties: {
        negotiation_id: {
          type: "string",
          description: "Negotiation ID to lock price for",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (requesting the lock)",
        },
        lock_days: {
          type: "number",
          description: "Number of days to lock the price (1-365, default: 30)",
        },
        quantity: {
          type: "number",
          description: "Optional: quantity to lock (defaults to negotiation quantity)",
        },
        notes: {
          type: "string",
          description: "Optional: notes for the contract record",
        },
      },
      required: ["negotiation_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "negotiation_dashboard",
    description:
      "Negotiation performance dashboard: active negotiations, win rate, average discount achieved, total volume negotiated. " +
      "Returns: open negotiations, accepted deals, savings realized, active contract locks. " +
      "Use to brief a supervisor, evaluate strategy effectiveness, or identify negotiations needing attention. " +
      "Includes personalized tips based on your current performance.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID to get dashboard for",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Agentic Clearinghouse (6) ─────────────────────────────────────────────

  {
    name: "clearinghouse_register",
    description:
      "Register your agent with the clearinghouse — declare which protocols you speak (MCP, A2A, ACP, x402, AP2, UCP, custom). " +
      "Once registered, other agents can discover you via clearinghouse_directory and handshake with you. " +
      "Register your capabilities (e.g. 'insurance-claims', 'payment-processing') and vertical (e.g. 'fintech', 'healthcare'). " +
      "Re-registration updates your profile. FREE to register.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your unique agent identifier",
        },
        agent_name: {
          type: "string",
          description: "Human-readable name for your agent",
        },
        protocols: {
          type: "array",
          items: { type: "string", enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"] },
          description: "Protocols your agent supports — list all that apply",
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Capabilities your agent offers (e.g. ['insurance-claims', 'payment-processing', 'data-analysis'])",
        },
        vertical: {
          type: "string",
          description: "Industry vertical (e.g. 'fintech', 'healthcare', 'insurance', 'logistics')",
        },
        schema: {
          type: "object",
          description: "Optional: your agent's tool/action schema for auto-translation hints",
        },
        endpoint: {
          type: "string",
          description: "Optional: your agent's API endpoint for direct connections",
        },
        public_key: {
          type: "string",
          description: "Optional: your agent's public key for encrypted handshakes",
        },
      },
      required: ["agent_id", "protocols"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "clearinghouse_handshake",
    description:
      "Initiate a verified handshake between two agents speaking different protocols. " +
      "Translates the payload from source protocol to target protocol automatically. " +
      "Returns: translated payload, verification hash, fidelity score, field mappings. " +
      "Supported bridges: MCP ↔ A2A ↔ ACP ↔ x402 ↔ AP2 ↔ UCP ↔ custom (all combinations). " +
      "The handshake is permanently logged — call clearinghouse_verify anytime to confirm integrity.",
    inputSchema: {
      type: "object",
      properties: {
        initiator_agent_id: {
          type: "string",
          description: "Agent ID of the initiating agent",
        },
        target_agent_id: {
          type: "string",
          description: "Agent ID of the target agent",
        },
        source_protocol: {
          type: "string",
          enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"],
          description: "Protocol your agent speaks",
        },
        target_protocol: {
          type: "string",
          enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"],
          description: "Protocol the target agent speaks",
        },
        payload: {
          type: "object",
          description: "The message/task/tool-call payload in source protocol format",
        },
      },
      required: ["initiator_agent_id", "target_agent_id", "source_protocol", "target_protocol", "payload"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "clearinghouse_translate",
    description:
      "Translate a tool call or message from one protocol format to another. " +
      "E.g., MCP tool call → A2A task request, or x402 payment request → ACP message. " +
      "Returns the translated payload, field mappings, and fidelity score (typically 95-100%). " +
      "Unlike clearinghouse_handshake, this is a pure translation without registering a handshake event. " +
      "Use to test translations before a live handshake, or to batch-translate payloads.",
    inputSchema: {
      type: "object",
      properties: {
        source_protocol: {
          type: "string",
          enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"],
          description: "Source protocol format",
        },
        target_protocol: {
          type: "string",
          enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"],
          description: "Target protocol format",
        },
        payload: {
          type: "object",
          description: "Payload to translate (in source protocol format)",
        },
        context: {
          type: "object",
          description: "Optional: additional context to aid translation (e.g. {domain: 'payments', version: '2.0'})",
        },
      },
      required: ["source_protocol", "target_protocol", "payload"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "clearinghouse_verify",
    description:
      "Verify that a translated message is faithful to the original. Cryptographic hash comparison. " +
      "Pass the handshake_id to retrieve the original translation record and verify hash integrity. " +
      "Optionally pass the verification_hash you received to confirm it matches the stored hash. " +
      "Returns: verified true/false, fidelity score, parties, integrity note. " +
      "Use to audit any clearinghouse handshake — ensures the translation wasn't tampered with.",
    inputSchema: {
      type: "object",
      properties: {
        handshake_id: {
          type: "string",
          description: "Handshake ID from clearinghouse_handshake",
        },
        verification_hash: {
          type: "string",
          description: "Optional: the verification_hash from the original handshake to check against stored hash",
        },
      },
      required: ["handshake_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "clearinghouse_directory",
    description:
      "Browse registered agents by protocol, capability, or vertical. " +
      "Example queries: find all agents that speak x402 and can process insurance claims, " +
      "find all MCP agents in fintech, find all A2A agents with payment-processing capability. " +
      "Returns: agent list sorted by handshake_count (most active first), with protocols, capabilities, and endpoints. " +
      "Use before clearinghouse_handshake to discover the right target agent.",
    inputSchema: {
      type: "object",
      properties: {
        protocol: {
          type: "string",
          enum: ["MCP", "A2A", "ACP", "x402", "AP2", "UCP", "custom"],
          description: "Filter by protocol (optional)",
        },
        capability: {
          type: "string",
          description: "Filter by capability keyword (e.g. 'insurance-claims', 'payment')",
        },
        vertical: {
          type: "string",
          description: "Filter by industry vertical (e.g. 'fintech', 'healthcare', 'insurance')",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 20)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "clearinghouse_stats",
    description:
      "Clearinghouse platform statistics: total handshakes, translations, registered agents, most popular protocol bridges. " +
      "Returns: summary counts, top protocol bridges (e.g. MCP → A2A is most popular), protocol distribution across registered agents, top active agents. " +
      "Use to understand the agent protocol ecosystem and identify the most useful bridges to support.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleGeminiImprovementTool(name, args) {
  switch (name) {

    // ZK Proofs
    case "zk_prove_solvency":          return zkProveSolvency(args);
    case "zk_prove_identity":          return zkProveIdentity(args);
    case "zk_prove_compliance":        return zkProveCompliance(args);
    case "zk_prove_capability":        return zkProveCapability(args);
    case "zk_verify_proof":            return zkVerifyProof(args);
    case "zk_prove_age":               return zkProveAge(args);
    case "zk_prove_budget":            return zkProveBudget(args);

    // Negotiation Proxy
    case "negotiation_create":         return negotiationCreate(args);
    case "negotiation_counter_offer":  return negotiationCounterOffer(args);
    case "negotiation_accept":         return negotiationAccept(args);
    case "negotiation_reject":         return negotiationReject(args);
    case "negotiation_auto_negotiate": return negotiationAutoNegotiate(args);
    case "negotiation_history":        return negotiationGetHistory(args);
    case "negotiation_volume_pricing": return negotiationVolumePricing(args);
    case "negotiation_contract_lock":  return negotiationContractLock(args);
    case "negotiation_dashboard":      return negotiationDashboard(args);

    // Agentic Clearinghouse
    case "clearinghouse_register":     return clearinghouseRegister(args);
    case "clearinghouse_handshake":    return clearinghouseHandshake(args);
    case "clearinghouse_translate":    return clearinghouseTranslate(args);
    case "clearinghouse_verify":       return clearinghouseVerify(args);
    case "clearinghouse_directory":    return clearinghouseDirectory(args);
    case "clearinghouse_stats":        return clearinghouseStats(args);

    default:
      throw new Error(`Unknown gemini-improvements tool: ${name}`);
  }
}
