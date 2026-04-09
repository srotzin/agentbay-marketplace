/**
 * HiveAgent MCP Tools — Phase 55-62
 *
 * Phase 55 — Crossmint: Virtual Visa Cards for Agents
 *   Give any agent a real Visa card with programmable controls.
 *   100M+ merchants, instant issuance, per-transaction rules.
 *   Agent wallets → virtual cards → global commerce in one call.
 *
 * Phase 56 — Mastercard / BVNK Bridge
 *   Unified wallet behind the Mastercard $1.8B BVNK acquisition.
 *   Smart routing across crypto + fiat rails. USDC, USDT, EUR, USD.
 *   One wallet. Every rail. Best rate, auto-selected.
 *
 * Phase 57 — EU AI Act Compliance
 *   August 1, 2026 deadline. Missed it = €30M fine or 6% global revenue.
 *   Automated risk classification, compliance docs, EU database registration.
 *   From zero to compliant in one call.
 *
 * Phase 58 — Colorado AI Act
 *   June 1, 2026 deadline. First US state AI law with real enforcement teeth.
 *   High-risk AI system assessment, consumer disclosures, impact assessment.
 *   SB 205 compliance docs auto-generated in seconds.
 *
 * Phase 59 — AWS AgentCore
 *   Amazon Bedrock AgentCore: enterprise agent runtime for production.
 *   Memory, identity, API gateway, code interpreter, browser tool.
 *   Any framework (LangChain, CrewAI, AutoGen). AWS-grade security.
 *
 * Phase 60 — Visa CLI
 *   Command-line Visa card payments. No browser. No SDK. Just a call.
 *   Register a card, pay any merchant, get statements — from the terminal.
 *   Perfect for automated agent pipelines that need card-present commerce.
 *
 * Phase 61 — Tempo Blockchain
 *   $5B-valued Mastercard-backed chain: 100K TPS, sub-second finality.
 *   MPP (Multi-Party Payment) settlement layer for complex agent transactions.
 *   Stream micropayments by the second. Pay any counterparty on Tempo rails.
 *
 * Phase 62 — Visa Agentic Ready Programme
 *   Official Visa programme: enroll, run test scenarios, get readiness score.
 *   Generate the application packet that unlocks Visa's agentic payment rails.
 *   Be among the first agents certified for autonomous Visa transactions.
 *
 * 36 new tools.
 */

import {
  createAgentWallet,
  issueVirtualCard,
  chargeCard,
  getCardStatement,
  setSpendingControls,
  getCrossmintStatus,
} from "./services/crossmint.js";

import {
  createUnifiedWallet,
  smartRoute,
  convertRails,
  getUnifiedBalance,
  getBridgeStatus,
} from "./services/mastercard-bvnk-bridge.js";

import {
  assessRisk,
  generateCompliance,
  registerWithEuDatabase,
  getComplianceGap,
  getEuAiActStatus,
} from "./services/eu-ai-act.js";

import {
  coloradoAssess,
  generateDisclosure,
  coloradoImpactAssessment,
  coloradoStatus,
} from "./services/colorado-ai-act.js";

import {
  agentcoreDeploy,
  agentcoreMemory,
  agentcoreIdentity,
  agentcoreGateway,
  agentcoreStatus,
} from "./services/agentcore.js";

import {
  visaCliRegister,
  visaCliPay,
  visaCliStatement,
  visaCliStatus,
} from "./services/visa-cli.js";

import {
  tempoWalletCreate,
  tempoPay,
  tempoStream,
  tempoMPPSession,
  tempoStatus,
} from "./services/tempo-blockchain.js";

import {
  varEnroll,
  varRunTestScenario,
  varGetReadinessScore,
  varGenerateApplicationPacket,
  varStatus,
} from "./services/visa-agentic-ready.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase5562Tools = [

  // ── Phase 55: Crossmint — Virtual Visa Cards for Agents ───────────────────

  {
    name: "crossmint_wallet_create",
    description:
      "Create a Crossmint agent wallet — the on-ramp to real Visa card spending. " +
      "Crossmint issues programmable agent wallets that fund virtual Visa cards instantly. " +
      "Call this first to get a wallet_id and deposit address, then call crossmint_card_issue. " +
      "Supports EVM chains (Base, Ethereum, Polygon) and Solana. " +
      "Wallet is custodied by Crossmint with MPC key management — no seed phrase exposure. " +
      "FREE to create.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier — used to link wallet to your agent",
        },
        chain: {
          type: "string",
          enum: ["base", "ethereum", "polygon", "solana"],
          description: "Blockchain for the wallet. 'base' recommended for lowest fees.",
        },
        label: {
          type: "string",
          description: "Human-readable label for this wallet (e.g. 'purchasing-agent-main')",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "crossmint_card_issue",
    description:
      "Issue a virtual Visa card funded from a Crossmint agent wallet — accepted at 100M+ merchants worldwide. " +
      "Your agent gets a real 16-digit Visa card number, CVV, expiry, and billing address in seconds. " +
      "Set hard spending limits at issuance. Use for any online purchase, API subscription, cloud spend, or service fee. " +
      "This is the fastest path from agent wallet → real-world purchasing power. No bank account required.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: {
          type: "string",
          description: "Wallet ID from crossmint_wallet_create",
        },
        spending_limit_usd: {
          type: "number",
          description: "Hard cap on total card spend in USD. Card auto-freezes when limit is hit.",
        },
        label: {
          type: "string",
          description: "Card label for tracking (e.g. 'aws-spend', 'vendor-payments')",
        },
        currency: {
          type: "string",
          enum: ["USD", "EUR", "GBP"],
          description: "Billing currency. Defaults to USD.",
        },
      },
      required: ["wallet_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "crossmint_card_charge",
    description:
      "Charge a Crossmint virtual Visa card for a specific amount and merchant. " +
      "Use when your agent needs to pay a merchant, settle a service invoice, or make a programmatic purchase. " +
      "Returns transaction_id, authorization code, and remaining balance. " +
      "Fails fast if spending controls block the merchant or amount exceeds limit — no surprise overcharges. " +
      "Pairs with crossmint_spending_controls to build rule-based purchasing agents.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "Card ID from crossmint_card_issue",
        },
        amount_usd: {
          type: "number",
          description: "Amount to charge in USD",
        },
        merchant_name: {
          type: "string",
          description: "Merchant name for the charge (e.g. 'AWS', 'Stripe', 'OpenAI')",
        },
        description: {
          type: "string",
          description: "Purpose of the charge — stored in statement for audit",
        },
        idempotency_key: {
          type: "string",
          description: "Optional unique key to prevent duplicate charges on retry",
        },
      },
      required: ["card_id", "amount_usd", "merchant_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "crossmint_card_statement",
    description:
      "Pull the transaction statement for a Crossmint virtual Visa card. " +
      "Returns an itemized list of charges with merchant, amount, timestamp, and status. " +
      "Use for expense reconciliation, spend auditing, or building financial reports for your agent's activity. " +
      "Supports date range filtering. Essential for any agent that needs to account for its spending.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "Card ID to pull statement for",
        },
        from_date: {
          type: "string",
          description: "Start date filter (ISO 8601, e.g. '2026-01-01'). Defaults to 30 days ago.",
        },
        to_date: {
          type: "string",
          description: "End date filter (ISO 8601). Defaults to today.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of transactions to return. Defaults to 50.",
        },
      },
      required: ["card_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "crossmint_spending_controls",
    description:
      "Set or update programmable spending controls on a Crossmint virtual Visa card. " +
      "Define per-transaction maximums, daily/monthly caps, merchant category blocks (MCCs), " +
      "and allowed/blocked merchant lists. " +
      "Use to lock an agent's card to only approved vendors, cap runaway spend, or restrict categories. " +
      "Controls apply immediately — no restart required. Returns updated control policy.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "Card ID to apply controls to",
        },
        per_transaction_limit_usd: {
          type: "number",
          description: "Maximum single transaction amount in USD",
        },
        daily_limit_usd: {
          type: "number",
          description: "Maximum total spend per calendar day in USD",
        },
        monthly_limit_usd: {
          type: "number",
          description: "Maximum total spend per month in USD",
        },
        blocked_mccs: {
          type: "array",
          items: { type: "string" },
          description: "Merchant Category Codes to block (e.g. ['7995'] blocks gambling)",
        },
        allowed_merchants: {
          type: "array",
          items: { type: "string" },
          description: "Whitelist of merchant names — all others will be declined if set",
        },
        frozen: {
          type: "boolean",
          description: "Freeze the card entirely (true) or unfreeze (false)",
        },
      },
      required: ["card_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "crossmint_status",
    description:
      "Check Crossmint service status: live mode availability, API connectivity, " +
      "supported chains, card issuance availability, and current fee schedule. " +
      "Use before issuing cards in production to confirm the service is operational. " +
      "Returns LIVE_MODE flag — if false, all calls run in demo mode with simulated card data.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 56: Mastercard / BVNK Bridge ────────────────────────────────────

  {
    name: "mc_bvnk_wallet_create",
    description:
      "Create a unified Mastercard/BVNK bridge wallet — one wallet that holds crypto AND fiat, " +
      "backed by Mastercard's $1.8B acquisition of BVNK. " +
      "Supports USDC, USDT, EUR, USD, GBP simultaneously in the same wallet. " +
      "This is the wallet that makes Mastercard's crypto-to-fiat vision real. " +
      "Returns wallet_id, balance map, and available rail list. FREE to create.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to bind this wallet to",
        },
        currencies: {
          type: "array",
          items: { type: "string" },
          description: "Currencies to activate in the wallet. Options: USDC, USDT, EUR, USD, GBP. Defaults to all.",
        },
        label: {
          type: "string",
          description: "Wallet label for your records",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "mc_bvnk_smart_route",
    description:
      "Intelligently route a payment across crypto + fiat rails to find the fastest, cheapest path. " +
      "The BVNK bridge evaluates SEPA, SWIFT, ACH, Faster Payments, Mastercard Send, " +
      "Base (USDC), Tron (USDT), and Solana in real time — picks the winner automatically. " +
      "Returns the selected rail, estimated fees, settlement time, and FX rate. " +
      "The key tool for any agent that moves money at scale and needs optimal routing without manual decisions.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: {
          type: "string",
          description: "Source wallet ID from mc_bvnk_wallet_create",
        },
        amount: {
          type: "number",
          description: "Amount to send",
        },
        from_currency: {
          type: "string",
          description: "Source currency (USDC, USDT, EUR, USD, GBP)",
        },
        to_currency: {
          type: "string",
          description: "Destination currency",
        },
        destination: {
          type: "string",
          description: "Recipient: IBAN, wallet address, or Mastercard Send recipient ID",
        },
        priority: {
          type: "string",
          enum: ["cheapest", "fastest", "balanced"],
          description: "Routing priority — cheapest minimizes fees, fastest minimizes time, balanced optimizes both",
        },
        dry_run: {
          type: "boolean",
          description: "If true, returns routing decision and quote without executing the payment",
        },
      },
      required: ["wallet_id", "amount", "from_currency", "to_currency", "destination"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "mc_bvnk_convert_rails",
    description:
      "Convert funds between crypto and fiat rails within the BVNK bridge wallet. " +
      "Instantly swap USDC → EUR, USDT → USD, GBP → USDC, and more — " +
      "at institutional rates with Mastercard's liquidity backing. " +
      "No external DEX slippage. No bank delays. Settlement in seconds. " +
      "The conversion primitive that unlocks seamless crypto/fiat agent workflows.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: {
          type: "string",
          description: "Wallet ID holding the source funds",
        },
        from_currency: {
          type: "string",
          description: "Currency to convert from (USDC, USDT, EUR, USD, GBP)",
        },
        to_currency: {
          type: "string",
          description: "Currency to convert to",
        },
        amount: {
          type: "number",
          description: "Amount of from_currency to convert",
        },
        lock_rate: {
          type: "boolean",
          description: "Lock the quoted rate for 30 seconds before execution (recommended for large amounts)",
        },
      },
      required: ["wallet_id", "from_currency", "to_currency", "amount"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "mc_bvnk_unified_balance",
    description:
      "Get the full balance map of a BVNK bridge wallet — every currency, every rail, in one call. " +
      "Returns USDC, USDT, EUR, USD, GBP balances plus pending inflows, pending outflows, " +
      "available-for-routing amounts, and FX equivalents in a chosen base currency. " +
      "The single source of truth for an agent managing multi-currency treasury.",
    inputSchema: {
      type: "object",
      properties: {
        wallet_id: {
          type: "string",
          description: "Wallet ID from mc_bvnk_wallet_create",
        },
        base_currency: {
          type: "string",
          description: "Currency to show FX equivalents in (defaults to USD)",
        },
      },
      required: ["wallet_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "mc_bvnk_bridge_status",
    description:
      "Check Mastercard/BVNK bridge service status: available rails, current FX spreads, " +
      "API connectivity, and LIVE_MODE flag. " +
      "Returns which rails are operational right now — useful before routing large payments. " +
      "If LIVE_MODE is false, all calls simulate routing and returns demo data.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 57: EU AI Act Compliance ────────────────────────────────────────

  {
    name: "eu_ai_act_assess",
    description:
      "Classify your AI system's risk level under the EU AI Act — before regulators do it for you. " +
      "The Act has four tiers: Unacceptable Risk (banned), High Risk (Article 6/7, full compliance required), " +
      "Limited Risk (disclosure obligations), Minimal Risk (free to use). " +
      "August 1, 2026 is the enforcement deadline. Fines reach €30M or 6% of global annual revenue. " +
      "Provide your system's purpose, capabilities, and deployment context — get back your risk tier, " +
      "the specific articles that apply, and the mandatory compliance actions.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "Name of the AI system being assessed",
        },
        purpose: {
          type: "string",
          description: "What the AI system does — natural language description of its primary function",
        },
        deployment_context: {
          type: "string",
          description: "Where and how it is deployed (e.g. 'HR hiring screening', 'medical diagnosis support', 'customer chatbot')",
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "List of capabilities: biometric identification, credit scoring, employment decisions, law enforcement, education, etc.",
        },
        eu_users: {
          type: "boolean",
          description: "Whether the system has EU-based users (if false, EU AI Act may not apply)",
        },
        autonomy_level: {
          type: "string",
          enum: ["human_in_loop", "human_on_loop", "fully_autonomous"],
          description: "Decision-making autonomy level of the system",
        },
      },
      required: ["system_name", "purpose", "deployment_context"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "eu_ai_act_generate_docs",
    description:
      "Auto-generate the full EU AI Act compliance documentation package for a High Risk or Limited Risk system. " +
      "Produces: Technical Documentation (Annex IV), Risk Management System records, " +
      "Conformity Assessment declaration, Data Governance statement, and Human Oversight protocol. " +
      "All in EU-mandated format, ready for notified body review. " +
      "Cuts 200+ hours of compliance work to minutes. August 1, 2026 deadline is real.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name",
        },
        risk_tier: {
          type: "string",
          enum: ["high_risk", "limited_risk"],
          description: "Risk tier from eu_ai_act_assess (or self-assessed)",
        },
        provider_name: {
          type: "string",
          description: "Legal name of the AI system provider/deployer",
        },
        system_description: {
          type: "string",
          description: "Full description of the system's intended purpose, inputs, outputs, and decision logic",
        },
        training_data_sources: {
          type: "array",
          items: { type: "string" },
          description: "Training data sources for data governance statement",
        },
        human_oversight_measures: {
          type: "string",
          description: "Description of how human oversight is implemented in the system",
        },
        output_format: {
          type: "string",
          enum: ["json", "markdown", "pdf_ready"],
          description: "Documentation format. 'pdf_ready' produces a formatted document.",
        },
      },
      required: ["system_name", "risk_tier", "provider_name", "system_description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "eu_ai_act_register",
    description:
      "Register a High Risk AI system with the EU AI Act database (EUID registry). " +
      "Mandatory for High Risk AI systems deployed in the EU — failure to register is an enforcement violation. " +
      "Submits the system profile to the EU's AI database and returns the EUID registration number. " +
      "Keep this number: it must appear in technical documentation and conformity declarations. " +
      "Works in simulation mode before the live registry opens.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name as it appears in compliance documentation",
        },
        provider_name: {
          type: "string",
          description: "Legal entity name of the provider",
        },
        provider_eu_address: {
          type: "string",
          description: "EU-based address for the provider or EU representative",
        },
        risk_tier: {
          type: "string",
          enum: ["high_risk"],
          description: "Only high_risk systems require registration",
        },
        intended_purpose: {
          type: "string",
          description: "Intended purpose of the AI system in plain language",
        },
        annex_iii_category: {
          type: "string",
          description: "Annex III category (e.g. 'employment', 'critical_infrastructure', 'law_enforcement', 'education')",
        },
      },
      required: ["system_name", "provider_name", "risk_tier", "intended_purpose"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "eu_ai_act_gap_analysis",
    description:
      "Run a gap analysis between your current AI governance posture and EU AI Act requirements. " +
      "Provide what you have in place today — get back a prioritized list of what's missing, " +
      "what articles are affected, estimated effort to close each gap, and a remediation roadmap. " +
      "The fastest way to know exactly what work remains before the August 1, 2026 deadline. " +
      "Returns gaps ranked by enforcement risk (Critical → High → Medium → Low).",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name",
        },
        risk_tier: {
          type: "string",
          enum: ["high_risk", "limited_risk", "minimal_risk"],
          description: "System's risk tier",
        },
        existing_measures: {
          type: "array",
          items: { type: "string" },
          description: "List of compliance measures already in place (e.g. 'technical_documentation', 'human_oversight', 'data_governance', 'conformity_assessment')",
        },
        target_deadline: {
          type: "string",
          description: "Your internal compliance deadline (ISO 8601). Defaults to 2026-08-01.",
        },
      },
      required: ["system_name", "risk_tier"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "eu_ai_act_status",
    description:
      "Get EU AI Act implementation timeline, current enforcement dates, and service status. " +
      "Returns: which provisions are in force today, days until August 1 enforcement deadline, " +
      "latest guidance updates from the EU AI Office, and LIVE_MODE flag. " +
      "Use before any compliance workflow to confirm you have the latest regulatory dates.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 58: Colorado AI Act ──────────────────────────────────────────────

  {
    name: "colorado_ai_assess",
    description:
      "Assess whether your AI system qualifies as a 'High-Risk AI System' under Colorado SB 205. " +
      "June 1, 2026 enforcement deadline. Colorado is the first US state with a real AI law with teeth. " +
      "High-risk = AI that makes or materially influences consequential decisions about Coloradans " +
      "in housing, employment, credit, education, healthcare, or insurance. " +
      "Returns risk classification, applicable obligations, and the specific SB 205 sections that apply.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name",
        },
        decision_domains: {
          type: "array",
          items: { type: "string" },
          description: "Decision domains: housing, employment, credit, education, healthcare, insurance, legal, other",
        },
        has_colorado_users: {
          type: "boolean",
          description: "Whether the system affects Colorado residents",
        },
        deployment_role: {
          type: "string",
          enum: ["developer", "deployer", "both"],
          description: "Your role in the AI supply chain — developers and deployers have different obligations",
        },
        system_description: {
          type: "string",
          description: "Description of what the AI system does and how it makes decisions",
        },
      },
      required: ["system_name", "decision_domains", "has_colorado_users", "deployment_role"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "colorado_generate_disclosure",
    description:
      "Generate the mandatory consumer disclosure notice required by Colorado SB 205 for High-Risk AI systems. " +
      "Colorado law requires deployers to notify consumers when an AI system makes or influences consequential decisions. " +
      "This generates the legally-compliant disclosure text, opt-out mechanism description, and appeal rights statement. " +
      "Ready-to-deploy in your product's UI or consent flow. " +
      "Missing or deficient disclosures trigger enforcement by the Colorado AG.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name",
        },
        deployer_name: {
          type: "string",
          description: "Legal name of the entity deploying the AI system",
        },
        decision_domain: {
          type: "string",
          description: "The decision domain (housing, employment, credit, etc.) for this specific disclosure",
        },
        decision_description: {
          type: "string",
          description: "Plain-English description of what decision the AI influences for the consumer",
        },
        appeal_contact: {
          type: "string",
          description: "Contact method for consumers to appeal AI decisions (email, URL, or phone)",
        },
        output_format: {
          type: "string",
          enum: ["plain_text", "html", "json"],
          description: "Format for the generated disclosure text",
        },
      },
      required: ["system_name", "deployer_name", "decision_domain", "decision_description"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "colorado_impact_assessment",
    description:
      "Generate the Annual Impact Assessment required for Colorado High-Risk AI deployers under SB 205. " +
      "Covers: purpose and benefits of the AI system, known risks of algorithmic discrimination, " +
      "safeguards in place, post-deployment monitoring, and bias testing results. " +
      "Must be completed before deployment and annually thereafter. " +
      "Returns a complete assessment document ready for internal records and potential AG review.",
    inputSchema: {
      type: "object",
      properties: {
        system_name: {
          type: "string",
          description: "AI system name",
        },
        deployer_name: {
          type: "string",
          description: "Deployer legal name",
        },
        system_description: {
          type: "string",
          description: "How the AI system works and what data it uses",
        },
        decision_domains: {
          type: "array",
          items: { type: "string" },
          description: "Consequential decision domains this system affects",
        },
        safeguards: {
          type: "array",
          items: { type: "string" },
          description: "Safeguards in place (e.g. 'human_review', 'bias_testing', 'audit_log', 'opt_out_mechanism')",
        },
        bias_testing_results: {
          type: "string",
          description: "Summary of any bias or fairness testing conducted",
        },
        assessment_year: {
          type: "integer",
          description: "Year this assessment covers. Defaults to current year.",
        },
      },
      required: ["system_name", "deployer_name", "system_description", "decision_domains"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "colorado_status",
    description:
      "Get Colorado AI Act (SB 205) implementation status, enforcement dates, and service status. " +
      "Returns: days until June 1, 2026 enforcement deadline, current AG guidance, " +
      "exemptions and safe harbors, and LIVE_MODE flag. " +
      "Use before compliance workflows to confirm you're working with current regulatory information.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 59: AWS AgentCore ────────────────────────────────────────────────

  {
    name: "agentcore_deploy",
    description:
      "Deploy your agent to Amazon Bedrock AgentCore — the enterprise production runtime for AI agents. " +
      "Used in production by Chime and Robinhood. Supports LangChain, CrewAI, AutoGen, Strands, or custom agents. " +
      "Provisions: isolated execution environment, 8-hour session limit, AWS CloudWatch logging, " +
      "VPC-optional networking, and auto-scaling. " +
      "Returns deployment_id, runtime endpoint, and session isolation token. " +
      "The path from prototype to enterprise-grade production in one call.",
    inputSchema: {
      type: "object",
      properties: {
        agent_name: {
          type: "string",
          description: "Name for the deployed agent",
        },
        framework: {
          type: "string",
          enum: ["LangChain", "CrewAI", "AutoGen", "Strands", "custom"],
          description: "Agent framework being deployed",
        },
        model_id: {
          type: "string",
          description: "Bedrock model ID (e.g. 'anthropic.claude-3-5-sonnet-20241022-v2:0'). Defaults to Claude 3.5 Sonnet v2.",
        },
        memory_enabled: {
          type: "boolean",
          description: "Enable AgentCore Memory for persistent cross-session context",
        },
        identity_provider: {
          type: "string",
          enum: ["cognito", "okta", "entra_id", "none"],
          description: "Identity provider for agent authentication",
        },
        vpc_config: {
          type: "object",
          description: "Optional VPC configuration: {vpc_id, subnet_ids, security_group_ids}",
        },
        environment_vars: {
          type: "object",
          description: "Environment variables to inject into the agent runtime",
        },
      },
      required: ["agent_name", "framework"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "agentcore_memory",
    description:
      "Read or write to AgentCore Memory — AWS-durable agent memory with short-term (session) and long-term (cross-session) tiers. " +
      "Write facts, preferences, task history, or intermediate results. Read them back in any future session. " +
      "Memory is cryptographically isolated per agent session. " +
      "Use for agents that need to remember user preferences, track progress across restarts, or share state with sub-agents. " +
      "Built on DynamoDB — millisecond reads, 99.999% durability.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: {
          type: "string",
          description: "AgentCore deployment ID from agentcore_deploy",
        },
        operation: {
          type: "string",
          enum: ["read", "write", "delete", "list"],
          description: "Memory operation: read a key, write a key-value pair, delete a key, or list all keys",
        },
        memory_tier: {
          type: "string",
          enum: ["short_term", "long_term"],
          description: "short_term = session-scoped (cleared on session end), long_term = persists across sessions",
        },
        key: {
          type: "string",
          description: "Memory key to read/write/delete",
        },
        value: {
          type: "string",
          description: "Value to store (required for 'write' operation). JSON-serializable.",
        },
        session_id: {
          type: "string",
          description: "Session ID for short-term memory scoping. Omit for long-term memory.",
        },
      },
      required: ["deployment_id", "operation", "memory_tier"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "agentcore_identity",
    description:
      "Manage verifiable agent identity via AgentCore's identity layer — backed by AWS Cognito, Okta, or Entra ID. " +
      "Issue agent credentials, verify agent identity tokens, rotate credentials, and set permission scopes. " +
      "Use when your agent needs to authenticate to external services, prove its identity in multi-agent workflows, " +
      "or operate under enterprise SSO policies. " +
      "Returns signed identity token, permission scopes, and expiry. " +
      "The foundation for trustworthy agent-to-agent and agent-to-service authentication.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: {
          type: "string",
          description: "AgentCore deployment ID",
        },
        operation: {
          type: "string",
          enum: ["issue", "verify", "rotate", "revoke"],
          description: "Identity operation: issue new credentials, verify an existing token, rotate for fresh credentials, or revoke",
        },
        identity_token: {
          type: "string",
          description: "Existing identity token (required for verify/rotate/revoke operations)",
        },
        scopes: {
          type: "array",
          items: { type: "string" },
          description: "Permission scopes for issued credentials (e.g. ['read:data', 'write:memory', 'call:apis'])",
        },
        ttl_seconds: {
          type: "integer",
          description: "Token time-to-live in seconds. Default 3600 (1 hour). Max 28800 (8 hours).",
        },
      },
      required: ["deployment_id", "operation"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "agentcore_gateway",
    description:
      "Convert any REST API into an MCP-compatible tool using AgentCore Gateway — in 30 seconds. " +
      "Provide an OpenAPI spec URL or JSON and AgentCore generates a fully typed, callable MCP tool " +
      "that any agent or IDE can discover and use immediately. " +
      "This is the killer feature: any API becomes an agent tool without writing a single line of code. " +
      "Returns the generated MCP tool schema, gateway endpoint, and authentication config.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: {
          type: "string",
          description: "AgentCore deployment ID to attach the gateway tool to",
        },
        openapi_spec_url: {
          type: "string",
          description: "URL of the OpenAPI 3.0 spec to convert (https://...)",
        },
        openapi_spec_json: {
          type: "object",
          description: "OpenAPI spec as a JSON object (alternative to spec URL)",
        },
        tool_name: {
          type: "string",
          description: "Name to give the generated MCP tool",
        },
        auth_config: {
          type: "object",
          description: "Authentication config for the target API: {type: 'apiKey'|'oauth2'|'basic', ...credentials}",
        },
        allowed_operations: {
          type: "array",
          items: { type: "string" },
          description: "Specific OpenAPI operation IDs to expose. Omit to expose all.",
        },
      },
      required: ["deployment_id", "tool_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "agentcore_status",
    description:
      "Get AgentCore service status: AWS region availability, supported frameworks and models, " +
      "active deployments, memory tier availability, and LIVE_MODE flag. " +
      "Use to verify AgentCore is available before deploying to production. " +
      "Returns per-region status, current model catalog, and pricing tier.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 60: Visa CLI ─────────────────────────────────────────────────────

  {
    name: "visa_cli_register",
    description:
      "Register a Visa card for CLI-based agent payments — no browser, no SDK, no manual steps. " +
      "Binds a Visa card to an agent ID for programmatic commerce. " +
      "Once registered, call visa_cli_pay to make payments from any automated pipeline. " +
      "Returns card_token (safe alias, never the raw PAN) and registration confirmation. " +
      "The entry point for agents that need card payments in fully automated, headless workflows.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to bind this card to",
        },
        card_pan: {
          type: "string",
          description: "16-digit Visa card number (never stored — immediately tokenized)",
        },
        card_expiry: {
          type: "string",
          description: "Card expiry in MM/YY format",
        },
        card_cvv: {
          type: "string",
          description: "CVV2/CVC2 security code",
        },
        billing_zip: {
          type: "string",
          description: "Billing postal code for AVS verification",
        },
        label: {
          type: "string",
          description: "Label for this card registration (e.g. 'primary-spend', 'vendor-pay')",
        },
      },
      required: ["agent_id", "card_pan", "card_expiry", "card_cvv"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "visa_cli_pay",
    description:
      "Execute a Visa card payment from the command line — pure programmatic commerce with no browser required. " +
      "Charge a registered Visa card for any amount, to any merchant that accepts card payments. " +
      "Returns authorization code, transaction ID, and settlement status in real time. " +
      "The tool for agents running in CI/CD pipelines, cron jobs, or headless infrastructure " +
      "that need to pay vendors, settle invoices, or purchase services without human interaction.",
    inputSchema: {
      type: "object",
      properties: {
        card_token: {
          type: "string",
          description: "Card token from visa_cli_register",
        },
        amount_usd: {
          type: "number",
          description: "Payment amount in USD",
        },
        merchant_name: {
          type: "string",
          description: "Merchant name",
        },
        merchant_category_code: {
          type: "string",
          description: "Merchant Category Code (MCC) for the transaction type",
        },
        description: {
          type: "string",
          description: "Payment description for statement and audit trail",
        },
        idempotency_key: {
          type: "string",
          description: "Unique key to prevent duplicate charges on retry (use a UUID)",
        },
      },
      required: ["card_token", "amount_usd", "merchant_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  {
    name: "visa_cli_statement",
    description:
      "Pull a Visa CLI card statement — full transaction history for reconciliation and audit. " +
      "Returns itemized list of all payments with merchant, amount, authorization code, and status. " +
      "Filter by date range or transaction status. " +
      "Essential for agents that manage spend budgets, need to reconcile vendor payments, " +
      "or produce financial reports for the humans reviewing their activity.",
    inputSchema: {
      type: "object",
      properties: {
        card_token: {
          type: "string",
          description: "Card token from visa_cli_register",
        },
        from_date: {
          type: "string",
          description: "Start date (ISO 8601). Defaults to 30 days ago.",
        },
        to_date: {
          type: "string",
          description: "End date (ISO 8601). Defaults to today.",
        },
        status_filter: {
          type: "string",
          enum: ["all", "approved", "declined", "pending", "settled"],
          description: "Filter transactions by status. Defaults to 'all'.",
        },
      },
      required: ["card_token"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "visa_cli_status",
    description:
      "Check Visa CLI service status: API availability, supported transaction types, " +
      "card tokenization status, and LIVE_MODE flag. " +
      "Returns current authorization success rates and any network incidents. " +
      "Use before automated payment runs to confirm the service is operational.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 61: Tempo Blockchain ─────────────────────────────────────────────

  {
    name: "tempo_wallet_create",
    description:
      "Create a wallet on Tempo — the $5B Mastercard-backed blockchain with 100K TPS and sub-second finality. " +
      "Tempo is not a public chain — it is a permissioned settlement layer purpose-built for payments, " +
      "used by Mastercard for institutional transactions and MPP (Multi-Party Payment) settlement. " +
      "Returns wallet_address, balance, and supported asset list. " +
      "The wallet you need before any tempo_pay, tempo_stream, or tempo_mpp_session call.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Agent identifier to associate with this wallet",
        },
        label: {
          type: "string",
          description: "Wallet label for your records",
        },
        supported_assets: {
          type: "array",
          items: { type: "string" },
          description: "Assets to activate: USDC, USDT, EUR, USD. Defaults to all.",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "tempo_pay",
    description:
      "Send a payment on the Tempo blockchain — 100K TPS, sub-second finality, Mastercard-grade settlement. " +
      "Ideal for high-frequency agent payments where traditional rails are too slow or too expensive. " +
      "Supports USDC, USDT, EUR, USD. Settles in under one second. " +
      "Returns transaction_hash, settlement_timestamp, and final confirmation. " +
      "The payment primitive for agents operating at scale in the Mastercard ecosystem.",
    inputSchema: {
      type: "object",
      properties: {
        from_wallet: {
          type: "string",
          description: "Source Tempo wallet address",
        },
        to_wallet: {
          type: "string",
          description: "Destination Tempo wallet address",
        },
        amount: {
          type: "number",
          description: "Payment amount",
        },
        asset: {
          type: "string",
          enum: ["USDC", "USDT", "EUR", "USD"],
          description: "Asset to send",
        },
        memo: {
          type: "string",
          description: "Payment memo (stored on-chain, visible to recipient)",
        },
        idempotency_key: {
          type: "string",
          description: "Unique key to prevent duplicate payments on retry",
        },
      },
      required: ["from_wallet", "to_wallet", "amount", "asset"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "tempo_stream",
    description:
      "Start a real-time micropayment stream on Tempo — pay by the second, minute, or hour. " +
      "Funds drip from sender to receiver continuously with sub-second settlement ticks. " +
      "Perfect for: API usage billing, agent-to-agent service fees, continuous data feeds, or time-based contracts. " +
      "Supports hard stop at total cap. Recipient can withdraw accrued balance at any time. " +
      "Returns stream_id, start_time, rate, and projected total.",
    inputSchema: {
      type: "object",
      properties: {
        from_wallet: {
          type: "string",
          description: "Source Tempo wallet address",
        },
        to_wallet: {
          type: "string",
          description: "Destination Tempo wallet address",
        },
        rate_per_second: {
          type: "number",
          description: "Payment rate per second in the chosen asset",
        },
        asset: {
          type: "string",
          enum: ["USDC", "USDT", "EUR", "USD"],
          description: "Asset to stream",
        },
        max_total: {
          type: "number",
          description: "Maximum total to stream before auto-stop. Required safety cap.",
        },
        duration_seconds: {
          type: "integer",
          description: "Optional fixed duration. Stream auto-stops after this many seconds.",
        },
        description: {
          type: "string",
          description: "Description of the streaming payment purpose",
        },
      },
      required: ["from_wallet", "to_wallet", "rate_per_second", "asset", "max_total"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "tempo_mpp_session",
    description:
      "Open a Multi-Party Payment (MPP) session on Tempo — the settlement primitive for complex " +
      "transactions involving 3+ parties that must settle atomically. " +
      "MPP is Tempo's flagship feature: all legs of a multi-party transaction succeed or all fail together. " +
      "Use for marketplace settlements, supply chain payments, revenue splits, or any workflow " +
      "where partial settlement is unacceptable. " +
      "Returns session_id, parties list, settlement conditions, and status.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Optional: provide to query or update an existing MPP session. Omit to create new.",
        },
        parties: {
          type: "array",
          description: "Array of payment parties: [{wallet_address, role: 'payer'|'payee'|'intermediary', amount, asset}]",
          items: {
            type: "object",
            properties: {
              wallet_address: { type: "string" },
              role: { type: "string", enum: ["payer", "payee", "intermediary"] },
              amount: { type: "number" },
              asset: { type: "string" },
            },
          },
        },
        settlement_condition: {
          type: "string",
          enum: ["all_confirm", "threshold", "time_lock"],
          description: "Settlement trigger: all_confirm=all parties confirm, threshold=N-of-M confirm, time_lock=auto-settle at timestamp",
        },
        time_lock_unix: {
          type: "integer",
          description: "Unix timestamp for auto-settlement (required if settlement_condition is 'time_lock')",
        },
        description: {
          type: "string",
          description: "Purpose of this MPP session",
        },
      },
      required: ["parties", "settlement_condition"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "tempo_status",
    description:
      "Check Tempo blockchain status: network TPS, current block time, asset availability, " +
      "MPP session capacity, streaming payment health, and LIVE_MODE flag. " +
      "Returns network stats and any active incidents. " +
      "Use before high-value MPP sessions to confirm the network is at full capacity.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 62: Visa Agentic Ready Programme ────────────────────────────────

  {
    name: "visa_agentic_ready_enroll",
    description:
      "Enroll in the Visa Agentic Ready Programme — Visa's official certification for AI agents " +
      "that operate autonomously in payment workflows. " +
      "Be among the first agents to gain Visa's stamp of approval for agentic payments. " +
      "Enrollment opens access to: test scenarios, sandbox API keys, readiness scoring, " +
      "and ultimately the application packet for live agentic payment rails. " +
      "Returns enrollment_id, programme tier, and next steps. This is how agents get Visa-certified.",
    inputSchema: {
      type: "object",
      properties: {
        agent_name: {
          type: "string",
          description: "Name of the agent enrolling",
        },
        organization_name: {
          type: "string",
          description: "Organization or company name",
        },
        agent_capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Agent capabilities relevant to payments: autonomous_purchasing, subscription_management, invoice_settlement, expense_reporting, etc.",
        },
        payment_volume_estimate: {
          type: "string",
          enum: ["under_10k_monthly", "10k_100k_monthly", "100k_1m_monthly", "over_1m_monthly"],
          description: "Estimated monthly payment volume through agentic channels",
        },
        contact_email: {
          type: "string",
          description: "Contact email for programme communications",
        },
        use_case_description: {
          type: "string",
          description: "Description of how the agent will use Visa agentic payment rails",
        },
      },
      required: ["agent_name", "organization_name", "agent_capabilities", "contact_email"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "visa_agentic_ready_test",
    description:
      "Run official Visa Agentic Ready test scenarios to validate your agent's payment behavior. " +
      "Visa provides 12 canonical test scenarios covering: authorization flows, declined transaction handling, " +
      "subscription management, recurring payments, dispute initiation, and spending control compliance. " +
      "Each scenario returns pass/fail with specific feedback on what to improve. " +
      "Run all scenarios before requesting your readiness score — incomplete scenarios block certification.",
    inputSchema: {
      type: "object",
      properties: {
        enrollment_id: {
          type: "string",
          description: "Enrollment ID from visa_agentic_ready_enroll",
        },
        scenario_id: {
          type: "string",
          description: "Specific scenario to run. Options: auth_basic, auth_3ds, decline_handling, subscription_create, subscription_cancel, recurring_payment, dispute_initiate, spending_limit_check, multi_merchant, international_payment, refund_flow, batch_payment. Use 'all' to run all 12.",
        },
        test_card_token: {
          type: "string",
          description: "Visa test card token to use in the scenario (provided by Visa sandbox)",
        },
        agent_behavior_log: {
          type: "string",
          description: "Optional: JSON log of your agent's behavior during the scenario for Visa's review",
        },
      },
      required: ["enrollment_id", "scenario_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "visa_agentic_ready_score",
    description:
      "Get your Visa Agentic Ready Programme readiness score — the numerical measure of how ready " +
      "your agent is for live Visa agentic payment rails. " +
      "Score is 0–100, calculated from: scenario pass rate, error handling quality, " +
      "spending control adherence, fraud signal response, and documentation completeness. " +
      "Score ≥ 85 unlocks the application packet. Feedback identifies exactly what's holding you back.",
    inputSchema: {
      type: "object",
      properties: {
        enrollment_id: {
          type: "string",
          description: "Enrollment ID from visa_agentic_ready_enroll",
        },
        include_breakdown: {
          type: "boolean",
          description: "Include per-category score breakdown and improvement recommendations",
        },
      },
      required: ["enrollment_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "visa_agentic_ready_packet",
    description:
      "Generate the Visa Agentic Ready application packet — the complete submission required " +
      "to unlock access to live Visa agentic payment rails. " +
      "Requires readiness score ≥ 85. " +
      "Produces: programme completion certificate, technical integration summary, " +
      "compliance attestation, agent behavior documentation, and the formal Visa application form. " +
      "This packet is what you submit to Visa to get approved for autonomous card transactions at scale. " +
      "The finish line for every agent serious about autonomous payments.",
    inputSchema: {
      type: "object",
      properties: {
        enrollment_id: {
          type: "string",
          description: "Enrollment ID from visa_agentic_ready_enroll",
        },
        output_format: {
          type: "string",
          enum: ["json", "pdf_ready", "zip"],
          description: "Output format: json for machine-readable, pdf_ready for formatted document, zip for complete package",
        },
        signatory_name: {
          type: "string",
          description: "Name of the authorized signatory for the compliance attestation",
        },
        signatory_title: {
          type: "string",
          description: "Title of the signatory (e.g. 'CTO', 'VP Engineering', 'Authorized Agent')",
        },
      },
      required: ["enrollment_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "visa_agentic_ready_status",
    description:
      "Check Visa Agentic Ready Programme status: programme availability, current enrollment window, " +
      "scenario test suite version, certification requirements, and LIVE_MODE flag. " +
      "Returns programme timeline and any updates to certification requirements. " +
      "Use before enrolling to confirm the programme is accepting new applications.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase5562Tool(name, args) {
  switch (name) {

    // Phase 55 — Crossmint
    case "crossmint_wallet_create":    return createAgentWallet(args);
    case "crossmint_card_issue":       return issueVirtualCard(args);
    case "crossmint_card_charge":      return chargeCard(args);
    case "crossmint_card_statement":   return getCardStatement(args);
    case "crossmint_spending_controls":return setSpendingControls(args);
    case "crossmint_status":           return getCrossmintStatus();

    // Phase 56 — Mastercard/BVNK Bridge
    case "mc_bvnk_wallet_create":      return createUnifiedWallet(args);
    case "mc_bvnk_smart_route":        return smartRoute(args);
    case "mc_bvnk_convert_rails":      return convertRails(args);
    case "mc_bvnk_unified_balance":    return getUnifiedBalance(args);
    case "mc_bvnk_bridge_status":      return getBridgeStatus();

    // Phase 57 — EU AI Act
    case "eu_ai_act_assess":           return assessRisk(args);
    case "eu_ai_act_generate_docs":    return generateCompliance(args);
    case "eu_ai_act_register":         return registerWithEuDatabase(args);
    case "eu_ai_act_gap_analysis":     return getComplianceGap(args);
    case "eu_ai_act_status":           return getEuAiActStatus();

    // Phase 58 — Colorado AI Act
    case "colorado_ai_assess":         return coloradoAssess(args);
    case "colorado_generate_disclosure":return generateDisclosure(args);
    case "colorado_impact_assessment": return coloradoImpactAssessment(args);
    case "colorado_status":            return coloradoStatus();

    // Phase 59 — AgentCore
    case "agentcore_deploy":           return agentcoreDeploy(args);
    case "agentcore_memory":           return agentcoreMemory(args);
    case "agentcore_identity":         return agentcoreIdentity(args);
    case "agentcore_gateway":          return agentcoreGateway(args);
    case "agentcore_status":           return agentcoreStatus();

    // Phase 60 — Visa CLI
    case "visa_cli_register":          return visaCliRegister(args);
    case "visa_cli_pay":               return visaCliPay(args);
    case "visa_cli_statement":         return visaCliStatement(args);
    case "visa_cli_status":            return visaCliStatus();

    // Phase 61 — Tempo Blockchain
    case "tempo_wallet_create":        return tempoWalletCreate(args);
    case "tempo_pay":                  return tempoPay(args);
    case "tempo_stream":               return tempoStream(args);
    case "tempo_mpp_session":          return tempoMPPSession(args);
    case "tempo_status":               return tempoStatus();

    // Phase 62 — Visa Agentic Ready
    case "visa_agentic_ready_enroll":  return varEnroll(args);
    case "visa_agentic_ready_test":    return varRunTestScenario(args);
    case "visa_agentic_ready_score":   return varGetReadinessScore(args);
    case "visa_agentic_ready_packet":  return varGenerateApplicationPacket(args);
    case "visa_agentic_ready_status":  return varStatus();

    default:
      throw new Error(`Unknown phase55-62 tool: ${name}`);
  }
}
