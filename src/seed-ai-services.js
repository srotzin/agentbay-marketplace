/**
 * HiveAgent New Services Seed — 25 AI-era service categories
 * Covers HITL, voice, logistics, identity, compliance, financial controls,
 * project management, security, and specialized inference services.
 *
 * Run: node src/seed-ai-services.js
 */

import * as mkt from "./services/marketplace.js";
import db from "./db.js";

console.log("Seeding HiveAgent — new AI-era service categories...\n");

// ─── Providers ────────────────────────────────────────────────────────────────

const providers = [
  // 1. Human-in-the-Loop
  { name: "HumanLayer",        description: "On-demand human worker pool for AI workflow escalations and approvals" },
  { name: "TaskForce HITL",    description: "Global network of vetted specialists for sensitive human-in-the-loop tasks" },

  // 2. Voice Telephony
  { name: "VoxBridge",         description: "Agent-native outbound calling with real-time transcription and callback scheduling" },
  { name: "CallOS",            description: "Programmable voice infrastructure for autonomous agents with PSTN access" },

  // 3. Physical Logistics
  { name: "AtomShip",          description: "Multi-carrier shipping API with local courier dispatch and 3PL fulfillment" },
  { name: "GroundTruth Ops",   description: "Physical verification and last-mile dispatch for agent-initiated tasks" },

  // 4. Communication Rails
  { name: "VerifiedReach",     description: "Cryptographically verified multi-channel messaging with delivery proof" },
  { name: "AckNet",            description: "Acknowledgment-assured communication rails for high-stakes agent messages" },

  // 5. Browser & Web Access
  { name: "CloudBrowser",      description: "Managed authenticated browser sessions with anti-detection and proxy rotation" },
  { name: "SessionForge",      description: "Persistent browser session leasing for agent-driven web automation" },

  // 6. Licensed Data Access
  { name: "VaultPress Data",   description: "Brokered access to paywalled news, financial data, and academic journals" },
  { name: "DataKey",           description: "Licensed proprietary database access including Crunchbase, PitchBook, and EDGAR" },

  // 7. API Subletting
  { name: "APIRent",           description: "Agent-to-agent API quota sharing marketplace with usage metering" },
  { name: "QuotaFlow",         description: "Fractionalized API access for premium services with real-time cost estimation" },

  // 8. Agent Identity & Delegation
  { name: "AgentCert",         description: "Cryptographic identity registration and verifiable delegation credentials for AI agents" },
  { name: "TrustRoot",         description: "Agent identity authority with delegation graphs and on-chain reputation anchoring" },

  // 9. Legal & Compliance
  { name: "JurisRoute",        description: "Multi-jurisdiction compliance router for cross-border agent transactions" },
  { name: "RegCheck AI",       description: "Real-time regulatory validation and jurisdiction-specific action approval" },

  // 10. E-Signature & Filing
  { name: "SignAgent",         description: "AI-native e-signature platform with government filing automation" },
  { name: "FiloBot",           description: "Legal entity formation and document signing with 50-state filing coverage" },

  // 11. Zero-Knowledge Vaults
  { name: "ZeroVault",         description: "Client-side encrypted secret storage with ZK-proof access control and audit trails" },
  { name: "ShadowStore",       description: "Zero-knowledge credential vaults with ephemeral token issuance for agents" },

  // 12. Proof & Verification
  { name: "ProofLayer",        description: "Third-party work completion verification with cryptographic attestation issuance" },
  { name: "VeritasProof",      description: "Decentralized proof-of-completion registry with on-chain attestation anchoring" },

  // 13. Dispute Resolution
  { name: "ArbiterAI",         description: "AI-assisted arbitration for agent-to-agent commercial disputes" },
  { name: "DisputeDAO",        description: "Decentralized dispute resolution with staked arbitrators and appeal panels" },

  // 14. Outcome Reputation
  { name: "ReputeGraph",       description: "Outcome-based agent reputation scoring with fraud risk models" },
  { name: "TrustTrace",        description: "Verifiable performance metrics and comparative provider reputation analytics" },

  // 15. Confidence Oracles
  { name: "CalibratePro",      description: "Stake-weighted prediction markets for agent epistemic uncertainty resolution" },
  { name: "OracleNet",         description: "Decentralized confidence oracle with Brier-scored calibration rewards" },

  // 16. Red Team & Security
  { name: "RedOps AI",         description: "Adversarial testing and vulnerability analysis for AI agent workflows" },
  { name: "ThreatSim",         description: "Automated red-team simulation with CVSS-rated vulnerability reports" },

  // 17. Virtual Cards & Fiat Bridge
  { name: "CardForge",         description: "Programmable virtual Visa/Mastercard issuance with USDC-to-USD bridge" },
  { name: "AgentPay",          description: "Disposable card minting for AI agent spending with category controls" },

  // 18. Agent Financial Controls
  { name: "BudgetOS",          description: "Hierarchical budget management and spending controls for multi-agent systems" },
  { name: "SpendGuard",        description: "Real-time spending oversight with approval workflows and reconciliation" },

  // 19. Project Management
  { name: "AgentProj",         description: "Milestone-based project management with escrow payment release for agent teams" },
  { name: "DeliverNet",        description: "Coordinated multi-agent project tracking with proof-gated payment milestones" },

  // 20. SLA & Insurance
  { name: "SLAShield",         description: "Performance insurance for AI service delivery with automated breach detection" },
  { name: "UptimePact",        description: "SLA underwriting and claims processing for agent-contracted services" },

  // 21. Knowledge Distillation
  { name: "LessonForge",       description: "AI-curated knowledge marketplace where agents publish and sell learned insights" },
  { name: "DistillHub",        description: "Peer-reviewed knowledge artifacts from completed agent tasks with domain scoring" },

  // 22. Schema Translation
  { name: "SchemaShift",       description: "Bidirectional schema conversion between all major data formats with validation" },
  { name: "FormatBridge",      description: "High-throughput batch schema translation for data pipeline interoperability" },

  // 23. Sandbox Testing
  { name: "SandboxGrid",       description: "Isolated execution environments for agent workflow testing and provider comparison" },
  { name: "TestPilot AI",      description: "Automated sandbox orchestration with parallel provider benchmarking" },

  // 24. Document Processing
  { name: "DocuFlow AI",       description: "AI-powered document extraction, redaction, OCR, and cross-language translation" },
  { name: "PaperMind",         description: "Intelligent document comparison and structured data extraction from any format" },

  // 25. GPU Inference
  { name: "InferGrid",         description: "On-demand GPU inference marketplace with H100/A100 access and batch pricing" },
  { name: "NeuralRent",        description: "Low-latency GPU compute for LLM, image generation, and embedding workloads" },
];

const providerRecords = providers.map((p) => {
  const result = mkt.registerProvider(p);
  return { ...p, ...result };
});

// Helper: get provider by index
const p = (i) => providerRecords[i].id;

// ─── Services ─────────────────────────────────────────────────────────────────

const services = [

  // ════════════════════════════════════════════════════════════
  // 1. HUMAN-IN-THE-LOOP SERVICES
  // ════════════════════════════════════════════════════════════
  {
    pid: p(0),
    name: "HITL Task Submission",
    desc: "Delegate any task requiring human judgment to a vetted worker pool. Supports MFA approvals, phone calls, document notarization, and data entry. Workers assigned in under 2 minutes.",
    cat: "hitl",
    price: 5.00,
    tags: ["hitl", "human", "approval", "verification"],
    model: "per_request",
  },
  {
    pid: p(0),
    name: "HITL Physical Verification",
    desc: "Dispatch a local agent to physically verify an asset, location, or identity at a given address. Includes photo documentation and signed report.",
    cat: "hitl",
    price: 35.00,
    tags: ["hitl", "physical", "verification", "field-agent"],
    model: "per_request",
  },
  {
    pid: p(1),
    name: "HITL Expert Judgment",
    desc: "Route complex subjective decisions to credentialed domain experts — legal review, financial judgment, medical triage. 15-minute response SLA.",
    cat: "hitl",
    price: 45.00,
    tags: ["hitl", "expert", "judgment", "professional"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 2. VOICE TELEPHONY
  // ════════════════════════════════════════════════════════════
  {
    pid: p(2),
    name: "Outbound Call (TTS)",
    desc: "Make an outbound phone call to any number worldwide using text-to-speech. Includes real-time transcription and call recording. Pay per minute.",
    cat: "voice",
    price: 0.12,
    tags: ["voice", "telephony", "call", "tts"],
    model: "per_request",
  },
  {
    pid: p(2),
    name: "Callback Scheduler",
    desc: "Schedule automated callback calls with retry logic. Ideal for appointment confirmations, follow-ups, and time-sensitive agent outreach.",
    cat: "voice",
    price: 0.25,
    tags: ["voice", "callback", "scheduler"],
    model: "per_request",
  },
  {
    pid: p(3),
    name: "Call Transcription",
    desc: "Retrieve full transcripts with speaker diarization from any completed call. Includes sentiment analysis and key topic extraction.",
    cat: "voice",
    price: 0.05,
    tags: ["voice", "transcription", "diarization"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 3. PHYSICAL LOGISTICS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(4),
    name: "Multi-Carrier Shipping",
    desc: "Create shipments and print labels across UPS, FedEx, USPS, and DHL. Automatic best-price carrier selection. Returns tracking number instantly.",
    cat: "logistics",
    price: 0.15,
    tags: ["shipping", "logistics", "carrier", "label"],
    model: "per_request",
  },
  {
    pid: p(4),
    name: "Package Tracking",
    desc: "Real-time tracking across all major carriers with ETD, location history, and exception alerts.",
    cat: "logistics",
    price: 0.02,
    tags: ["tracking", "logistics", "shipping"],
    model: "per_request",
  },
  {
    pid: p(5),
    name: "On-Demand Courier Dispatch",
    desc: "Same-day local courier pickup and delivery within any major metro area. Average pickup in 45 minutes.",
    cat: "logistics",
    price: 18.00,
    tags: ["courier", "logistics", "same-day", "local"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 4. COMMUNICATION RAILS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(6),
    name: "Verified Email Delivery",
    desc: "Send emails with cryptographic delivery proof and read receipts. Supports required acknowledgment with audit trail.",
    cat: "communication",
    price: 0.008,
    tags: ["email", "verified", "communication", "proof"],
    model: "per_request",
  },
  {
    pid: p(6),
    name: "Verified SMS Delivery",
    desc: "Send SMS to 200+ countries with delivery confirmation and acknowledgment verification. GDPR-compliant opt-out handling.",
    cat: "communication",
    price: 0.03,
    tags: ["sms", "verified", "communication"],
    model: "per_request",
  },
  {
    pid: p(7),
    name: "Automated Follow-Up Rail",
    desc: "Schedule intelligent follow-up messages across any channel if a recipient does not respond within a defined window. Configurable retry cadence.",
    cat: "communication",
    price: 0.05,
    tags: ["followup", "automation", "communication"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 5. BROWSER & WEB ACCESS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(8),
    name: "Authenticated Browser Session",
    desc: "Lease a managed browser session with persistent cookies for any target site. Supports stealth mode, proxy rotation, and multi-region access.",
    cat: "browser",
    price: 0.50,
    tags: ["browser", "session", "automation", "web"],
    model: "per_request",
  },
  {
    pid: p(8),
    name: "Browser Session Pool (Hourly)",
    desc: "Rent a pool of 10 concurrent authenticated browser sessions for high-volume web automation tasks.",
    cat: "browser",
    price: 4.50,
    tags: ["browser", "session", "pool", "automation"],
    model: "per_request",
  },
  {
    pid: p(9),
    name: "Stealth Browser Access",
    desc: "Premium residential-IP browser sessions with advanced fingerprint randomization for sites with strict bot detection.",
    cat: "browser",
    price: 2.00,
    tags: ["browser", "stealth", "residential", "antibot"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 6. LICENSED DATA ACCESS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(10),
    name: "Paywalled Article Access",
    desc: "Retrieve full text from paywalled news sources including WSJ, FT, Bloomberg, and The Economist via licensed access.",
    cat: "data",
    price: 0.75,
    tags: ["paywall", "news", "licensed", "data"],
    model: "per_request",
  },
  {
    pid: p(10),
    name: "Academic Journal Access",
    desc: "Access full-text papers from JSTOR, Elsevier, Springer, and Nature via institutional licensing. Covers 50M+ papers.",
    cat: "data",
    price: 1.50,
    tags: ["academic", "journals", "research", "licensed"],
    model: "per_request",
  },
  {
    pid: p(11),
    name: "Proprietary Database Query",
    desc: "Query Crunchbase, PitchBook, or Dun & Bradstreet for company financials, funding rounds, and executive data.",
    cat: "data",
    price: 3.00,
    tags: ["database", "crunchbase", "pitchbook", "licensed"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 7. API SUBLETTING
  // ════════════════════════════════════════════════════════════
  {
    pid: p(12),
    name: "Premium API Quota Rental",
    desc: "Rent surplus API quota from other agents for GPT-4, Claude, Gemini, and other premium AI APIs. Pay only for calls used.",
    cat: "infrastructure",
    price: 0.002,
    tags: ["api", "quota", "subletting", "ai"],
    model: "per_request",
  },
  {
    pid: p(12),
    name: "Data API Time Slot",
    desc: "Rent hourly access to premium data APIs including Google Maps, Clearbit, and financial data feeds at bulk rates.",
    cat: "infrastructure",
    price: 1.20,
    tags: ["api", "data", "rental", "subletting"],
    model: "per_request",
  },
  {
    pid: p(13),
    name: "API Cost Estimation",
    desc: "Get instant cost estimates for any API subletting rental before committing. Includes usage projections and savings vs. direct subscription.",
    cat: "infrastructure",
    price: 0.00,
    tags: ["api", "estimation", "cost"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 8. AGENT IDENTITY & DELEGATION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(14),
    name: "Agent Identity Registration",
    desc: "Register a cryptographic identity for your agent with verifiable credentials, capability declarations, and a public reputation profile.",
    cat: "infrastructure",
    price: 1.00,
    tags: ["identity", "agent", "credentials", "registration"],
    model: "per_request",
  },
  {
    pid: p(14),
    name: "Delegation Credential Issuance",
    desc: "Issue a scoped delegation credential allowing a sub-agent to act on behalf of a principal with configurable permissions and spend limits.",
    cat: "infrastructure",
    price: 0.50,
    tags: ["delegation", "identity", "agent", "authority"],
    model: "per_request",
  },
  {
    pid: p(15),
    name: "Agent Trust Verification",
    desc: "Instantly verify any delegation credential or agent identity before accepting work, preventing impersonation and scope creep.",
    cat: "infrastructure",
    price: 0.10,
    tags: ["verification", "trust", "delegation", "identity"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 9. LEGAL & COMPLIANCE
  // ════════════════════════════════════════════════════════════
  {
    pid: p(16),
    name: "Compliance Check (Single Action)",
    desc: "Instantly check whether a proposed agent action is legally compliant in a given jurisdiction. Covers GDPR, CCPA, AML, and 40+ regulatory frameworks.",
    cat: "compliance",
    price: 0.75,
    tags: ["compliance", "legal", "regulation", "jurisdiction"],
    model: "per_request",
  },
  {
    pid: p(16),
    name: "Multi-Jurisdiction Routing",
    desc: "Automatically determine the correct legal jurisdiction for cross-border transactions and route to the appropriate regulatory checks.",
    cat: "compliance",
    price: 2.00,
    tags: ["compliance", "jurisdiction", "cross-border", "routing"],
    model: "per_request",
  },
  {
    pid: p(17),
    name: "Regulatory Requirements Report",
    desc: "Get a comprehensive report of regulatory requirements for any action type in any jurisdiction. Includes required disclosures and timing constraints.",
    cat: "compliance",
    price: 5.00,
    tags: ["compliance", "regulation", "report", "legal"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 10. E-SIGNATURE & FILING
  // ════════════════════════════════════════════════════════════
  {
    pid: p(18),
    name: "E-Signature Request",
    desc: "Create legally binding e-signature requests routing documents to any number of signatories. Compliant with eIDAS, ESIGN Act, and UETA.",
    cat: "legal",
    price: 1.50,
    tags: ["esignature", "legal", "document", "signing"],
    model: "per_request",
  },
  {
    pid: p(18),
    name: "Entity Formation Filing",
    desc: "File LLC or corporation formations in any US state with same-day state acceptance confirmation. Includes registered agent service.",
    cat: "legal",
    price: 49.00,
    tags: ["legal", "filing", "entity", "llc", "formation"],
    model: "per_request",
  },
  {
    pid: p(19),
    name: "Rush Government Filing",
    desc: "Expedited government filing service for entity amendments, annual reports, and regulatory submissions. 24-hour guaranteed acceptance.",
    cat: "legal",
    price: 99.00,
    tags: ["legal", "filing", "rush", "government"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 11. ZERO-KNOWLEDGE VAULTS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(20),
    name: "ZK Secret Vault (90-Day)",
    desc: "Store an encrypted secret (API key, credential, private key) in a zero-knowledge vault. The platform never sees plaintext. Includes access audit log.",
    cat: "infrastructure",
    price: 0.50,
    tags: ["vault", "secret", "zk", "security", "encryption"],
    model: "per_request",
  },
  {
    pid: p(20),
    name: "Ephemeral Access Token",
    desc: "Request a time-limited (5-minute) access token to retrieve a vaulted secret for a single operation. Automatically logged for compliance.",
    cat: "infrastructure",
    price: 0.05,
    tags: ["vault", "token", "ephemeral", "access", "security"],
    model: "per_request",
  },
  {
    pid: p(21),
    name: "ZK Vault Audit Report",
    desc: "Generate a full cryptographic audit trail for all secret accesses in a vault, suitable for compliance reviews.",
    cat: "infrastructure",
    price: 0.25,
    tags: ["vault", "audit", "compliance", "security"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 12. PROOF & VERIFICATION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(22),
    name: "Work Completion Proof",
    desc: "Submit and verify third-party proof of task completion. Accepted formats include deliverable hashes, output URLs, and ZK proofs.",
    cat: "infrastructure",
    price: 0.50,
    tags: ["proof", "verification", "completion", "attestation"],
    model: "per_request",
  },
  {
    pid: p(22),
    name: "Completion Attestation Certificate",
    desc: "Generate a signed, tamper-proof attestation certificate for verified work. Suitable for on-chain recording or B2B sharing.",
    cat: "infrastructure",
    price: 1.00,
    tags: ["attestation", "certificate", "proof", "verification"],
    model: "per_request",
  },
  {
    pid: p(23),
    name: "On-Chain Proof Anchoring",
    desc: "Anchor a completion proof hash to a public blockchain for permanent, immutable verification record. Supports Ethereum, Polygon, and Solana.",
    cat: "infrastructure",
    price: 2.00,
    tags: ["proof", "blockchain", "onchain", "immutable"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 13. DISPUTE RESOLUTION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(24),
    name: "Dispute Filing",
    desc: "File a formal dispute against any transaction or delivery. AI-assisted evidence collection and arbitrator assignment within 1 hour.",
    cat: "legal",
    price: 5.00,
    tags: ["dispute", "arbitration", "legal", "resolution"],
    model: "per_request",
  },
  {
    pid: p(24),
    name: "Expedited Arbitration",
    desc: "Fast-track arbitration for disputes under $10,000 with binding ruling in under 24 hours. Includes one appeal round.",
    cat: "legal",
    price: 25.00,
    tags: ["dispute", "arbitration", "expedited", "legal"],
    model: "per_request",
  },
  {
    pid: p(25),
    name: "Dispute Evidence Package",
    desc: "Professional evidence packaging service that compiles, formats, and submits supporting documentation for a dispute case.",
    cat: "legal",
    price: 10.00,
    tags: ["dispute", "evidence", "legal", "documentation"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 14. OUTCOME REPUTATION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(26),
    name: "Agent Reputation Score",
    desc: "Get a comprehensive reputation score for any agent or provider based on verified delivery outcomes, fraud rates, and peer ratings.",
    cat: "data",
    price: 0.25,
    tags: ["reputation", "agent", "score", "trust"],
    model: "per_request",
  },
  {
    pid: p(26),
    name: "Provider Comparison Report",
    desc: "Compare reputation metrics across multiple providers for a service category including quality, speed, and fraud risk.",
    cat: "data",
    price: 1.00,
    tags: ["reputation", "comparison", "provider", "analytics"],
    model: "per_request",
  },
  {
    pid: p(27),
    name: "Fraud Risk Assessment",
    desc: "Get a calibrated fraud probability score for any agent before engaging. Trained on millions of verified agent-to-agent transactions.",
    cat: "data",
    price: 0.50,
    tags: ["fraud", "risk", "assessment", "reputation"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 15. CONFIDENCE ORACLES
  // ════════════════════════════════════════════════════════════
  {
    pid: p(28),
    name: "Confidence Oracle Query",
    desc: "Post an epistemic question to a stake-weighted oracle market. Returns calibrated probability estimates from domain experts. 7-day resolution window.",
    cat: "data",
    price: 0.50,
    tags: ["oracle", "prediction", "confidence", "calibration"],
    model: "per_request",
  },
  {
    pid: p(28),
    name: "Calibrated Estimate Retrieval",
    desc: "Retrieve the aggregated Brier-scored probability estimate for any open oracle query, including confidence intervals and staker distribution.",
    cat: "data",
    price: 1.50,
    tags: ["oracle", "estimate", "calibration", "confidence"],
    model: "per_request",
  },
  {
    pid: p(29),
    name: "Oracle Answer Staking",
    desc: "Stake USD on an answer to earn rewards if correct. Uses stake-weighted Brier scoring to incentivize accurate calibration.",
    cat: "data",
    price: 0.10,
    tags: ["oracle", "staking", "prediction", "market"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 16. RED TEAM & SECURITY
  // ════════════════════════════════════════════════════════════
  {
    pid: p(30),
    name: "Workflow Red Team Review",
    desc: "Submit an agent workflow for adversarial security analysis. Identifies prompt injection, data exfiltration risks, and auth bypass vulnerabilities.",
    cat: "security",
    price: 15.00,
    tags: ["security", "redteam", "workflow", "vulnerability"],
    model: "per_request",
  },
  {
    pid: p(30),
    name: "Deep Threat Analysis",
    desc: "Comprehensive multi-vector threat analysis for production agent systems. Includes CVSS ratings, attack scenarios, and remediation roadmap.",
    cat: "security",
    price: 75.00,
    tags: ["security", "threat", "analysis", "redteam"],
    model: "per_request",
  },
  {
    pid: p(31),
    name: "Failure Mode Simulation",
    desc: "Run controlled adversarial simulations against a live agent workflow. Tests resilience to resource exhaustion, dependency failures, and poisoning attacks.",
    cat: "security",
    price: 25.00,
    tags: ["security", "simulation", "resilience", "testing"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 17. VIRTUAL CARDS & FIAT BRIDGE
  // ════════════════════════════════════════════════════════════
  {
    pid: p(32),
    name: "Virtual Card Issuance",
    desc: "Mint a disposable Visa or Mastercard funded from USDC. Supports single-use or multi-use with per-category merchant restrictions. 2.5% issuance fee.",
    cat: "finance",
    price: 0.00,
    tags: ["virtual-card", "fiat", "payment", "usdc"],
    model: "per_request",
  },
  {
    pid: p(32),
    name: "Card Spending Controls",
    desc: "Configure per-transaction limits and merchant allow-lists on any virtual card. Instant updates with no downtime.",
    cat: "finance",
    price: 0.10,
    tags: ["virtual-card", "controls", "limits", "spending"],
    model: "per_request",
  },
  {
    pid: p(33),
    name: "Advertising Card Bundle",
    desc: "Bundle of 5 advertising-category virtual cards pre-configured for Google Ads, Meta, LinkedIn, and TikTok spending.",
    cat: "finance",
    price: 2.50,
    tags: ["virtual-card", "advertising", "bundle", "marketing"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 18. AGENT FINANCIAL CONTROLS
  // ════════════════════════════════════════════════════════════
  {
    pid: p(34),
    name: "Agent Budget Setup",
    desc: "Create hierarchical spending budgets for multi-agent systems with per-category limits, period resets, and approval workflows.",
    cat: "finance",
    price: 0.50,
    tags: ["budget", "financial", "controls", "agent"],
    model: "per_request",
  },
  {
    pid: p(34),
    name: "Spending Report (Monthly)",
    desc: "Detailed monthly spending report for any agent budget, broken down by category, service, and time. Includes variance analysis.",
    cat: "finance",
    price: 1.00,
    tags: ["budget", "report", "spending", "financial"],
    model: "per_request",
  },
  {
    pid: p(35),
    name: "Transaction Reconciliation",
    desc: "Automated reconciliation of agent spending against external ledgers with discrepancy flagging and correction workflows.",
    cat: "finance",
    price: 2.00,
    tags: ["reconciliation", "financial", "audit", "budget"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 19. PROJECT MANAGEMENT
  // ════════════════════════════════════════════════════════════
  {
    pid: p(36),
    name: "Agent Project Creation",
    desc: "Create a structured project for multi-agent coordination with milestone definitions, budgets, and escrow-backed payment releases.",
    cat: "infrastructure",
    price: 1.00,
    tags: ["project", "management", "milestones", "agent"],
    model: "per_request",
  },
  {
    pid: p(36),
    name: "Milestone Payment Release",
    desc: "Proof-gated milestone payment release — funds held in escrow until completion proof is verified and approved.",
    cat: "infrastructure",
    price: 0.50,
    tags: ["project", "milestone", "payment", "escrow"],
    model: "per_request",
  },
  {
    pid: p(37),
    name: "Project Status Dashboard",
    desc: "Real-time project status across all milestones, agent assignments, and budget consumption. Includes risk flagging for off-track items.",
    cat: "infrastructure",
    price: 0.25,
    tags: ["project", "status", "dashboard", "management"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 20. SLA & INSURANCE
  // ════════════════════════════════════════════════════════════
  {
    pid: p(38),
    name: "Uptime SLA Insurance",
    desc: "Purchase uptime insurance for any service with automated breach detection and payout when SLA targets are missed.",
    cat: "finance",
    price: 5.00,
    tags: ["sla", "insurance", "uptime", "coverage"],
    model: "per_request",
  },
  {
    pid: p(38),
    name: "Delivery Speed Insurance",
    desc: "Insure against late deliveries with configurable payout tiers. Automatically monitors delivery timestamps against SLA thresholds.",
    cat: "finance",
    price: 3.00,
    tags: ["sla", "insurance", "delivery", "speed"],
    model: "per_request",
  },
  {
    pid: p(39),
    name: "Comprehensive SLA Coverage",
    desc: "All-in-one SLA insurance covering uptime, latency, delivery speed, and quality metrics for critical agent services.",
    cat: "finance",
    price: 12.00,
    tags: ["sla", "insurance", "comprehensive", "coverage"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 21. KNOWLEDGE DISTILLATION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(40),
    name: "Knowledge Lesson Publish",
    desc: "Publish a distilled insight or lesson from completed work, making it discoverable and monetizable by other agents in the HiveAgent ecosystem.",
    cat: "data",
    price: 0.25,
    tags: ["knowledge", "lesson", "publish", "distillation"],
    model: "per_request",
  },
  {
    pid: p(40),
    name: "Knowledge Search & Access",
    desc: "Search and purchase access to curated agent-generated knowledge across finance, legal, engineering, and research domains.",
    cat: "data",
    price: 0.50,
    tags: ["knowledge", "search", "access", "insights"],
    model: "per_request",
  },
  {
    pid: p(41),
    name: "Trending Domain Insights",
    desc: "Get the top-trending knowledge artifacts across all domains, curated by access count and peer ratings.",
    cat: "data",
    price: 0.10,
    tags: ["knowledge", "trending", "insights", "curation"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 22. SCHEMA TRANSLATION
  // ════════════════════════════════════════════════════════════
  {
    pid: p(42),
    name: "Schema Conversion (Single)",
    desc: "Convert a schema between any two supported formats — JSON Schema, OpenAPI, GraphQL, Protobuf, Avro, Parquet, XSD, and SQL DDL.",
    cat: "data",
    price: 0.10,
    tags: ["schema", "translation", "conversion", "data"],
    model: "per_request",
  },
  {
    pid: p(42),
    name: "Schema Validation",
    desc: "Validate any schema definition against its format specification, returning structured errors and warnings.",
    cat: "data",
    price: 0.05,
    tags: ["schema", "validation", "data", "format"],
    model: "per_request",
  },
  {
    pid: p(43),
    name: "Batch Schema Translation",
    desc: "Translate hundreds of schemas in a single batch operation. Ideal for data lake migrations and API gateway standardization.",
    cat: "data",
    price: 0.50,
    tags: ["schema", "batch", "translation", "migration"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 23. SANDBOX TESTING
  // ════════════════════════════════════════════════════════════
  {
    pid: p(44),
    name: "Isolated Sandbox Environment",
    desc: "Create an isolated execution sandbox for testing agent workflows or code without real-world side effects. Node.js, Python, Docker, or browser environments.",
    cat: "infrastructure",
    price: 0.20,
    tags: ["sandbox", "testing", "isolation", "execution"],
    model: "per_request",
  },
  {
    pid: p(44),
    name: "Provider A/B Comparison",
    desc: "Run identical tests across multiple provider implementations in parallel and compare outputs, latency, and cost.",
    cat: "infrastructure",
    price: 1.00,
    tags: ["sandbox", "testing", "comparison", "benchmarking"],
    model: "per_request",
  },
  {
    pid: p(45),
    name: "Automated Test Suite Execution",
    desc: "Upload a full test suite and run it against any service in an isolated sandbox. Returns structured pass/fail results with performance metrics.",
    cat: "infrastructure",
    price: 2.00,
    tags: ["sandbox", "testing", "automation", "qa"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 24. DOCUMENT PROCESSING
  // ════════════════════════════════════════════════════════════
  {
    pid: p(46),
    name: "AI Document Extraction",
    desc: "Extract structured data from PDFs, DOCX files, and scanned images using AI layout analysis. Supports invoices, contracts, and financial statements.",
    cat: "ai",
    price: 0.30,
    tags: ["document", "extraction", "ai", "ocr"],
    model: "per_request",
  },
  {
    pid: p(46),
    name: "PII Redaction",
    desc: "AI-powered redaction of personal data, financial information, and privileged content from any document format. GDPR and HIPAA compliant.",
    cat: "ai",
    price: 0.50,
    tags: ["document", "redaction", "pii", "privacy"],
    model: "per_request",
  },
  {
    pid: p(47),
    name: "Document Comparison (Diff)",
    desc: "Compare two document versions and produce a precise diff for text, legal clauses, or financial figures. Ideal for contract review.",
    cat: "ai",
    price: 0.75,
    tags: ["document", "comparison", "diff", "legal"],
    model: "per_request",
  },

  // ════════════════════════════════════════════════════════════
  // 25. GPU INFERENCE
  // ════════════════════════════════════════════════════════════
  {
    pid: p(48),
    name: "A100 GPU Inference",
    desc: "Run LLM, image generation, or embedding workloads on NVIDIA A100 GPUs. Sub-second cold-start. Pay per token or per image.",
    cat: "infrastructure",
    price: 0.002,
    tags: ["gpu", "inference", "a100", "llm"],
    model: "per_request",
  },
  {
    pid: p(48),
    name: "H100 GPU Inference (Premium)",
    desc: "Maximum-performance inference on NVIDIA H100 GPUs. Ideal for large batch jobs and ultra-low-latency production workloads.",
    cat: "infrastructure",
    price: 0.005,
    tags: ["gpu", "inference", "h100", "premium"],
    model: "per_request",
  },
  {
    pid: p(49),
    name: "Batch GPU Inference",
    desc: "Submit hundreds of inference requests in a single batch job at 60% reduced cost vs. real-time. Results delivered via webhook when complete.",
    cat: "infrastructure",
    price: 0.0008,
    tags: ["gpu", "inference", "batch", "cost-effective"],
    model: "per_request",
  },
];

// ─── Register Services ────────────────────────────────────────────────────────

services.forEach((s) => {
  mkt.listService({
    provider_id: s.pid,
    name: s.name,
    description: s.desc,
    category: s.cat,
    price_usd: s.price,
    price_model: s.model || "per_request",
    tags: s.tags,
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

const stats = mkt.getMarketplaceStats();
console.log(`\nHiveAgent new services seeded: ${providers.length} providers, ${services.length} services`);
console.log(`Marketplace totals: ${stats.providers} providers, ${stats.services} services`);
console.log(`Categories: ${JSON.stringify(mkt.getCategories())}`);
console.log("\nRun the server: node src/server.js\n");
