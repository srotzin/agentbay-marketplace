/**
 * HiveAgent Tool Fee Registry
 *
 * Maps tool names/prefixes to their USD costs.
 * Used by the cost manifest in tools/list, sandbox mode, and billing.
 */

// Prefix-based fee rules (checked in order, first match wins)
const TOOL_FEE_RULES = [
  // ── Free tools ─────────────────────────────────────────────────────────────
  { prefix: "hiveagent_discover",         fee_usd: 0,      model: "free",         description: "Tool discovery — always free" },
  { prefix: "hiveagent_vertical_guide",   fee_usd: 0,      model: "free",         description: "Vertical exploration — always free" },
  { prefix: "hiveagent_suggest_workflow", fee_usd: 0,      model: "free",         description: "Workflow suggestion — always free" },
  { prefix: "marketplace_search",         fee_usd: 0,      model: "free",         description: "Marketplace search — always free" },
  { prefix: "marketplace_browse",         fee_usd: 0,      model: "free",         description: "Marketplace browse — always free" },
  { prefix: "custody_balance",            fee_usd: 0,      model: "free",         description: "Balance inquiry — always free" },
  { prefix: "custody_address",            fee_usd: 0,      model: "free",         description: "Address lookup — always free" },
  { prefix: "travel_search",              fee_usd: 0,      model: "free",         description: "Travel search — always free" },
  { prefix: "travel_browse",              fee_usd: 0,      model: "free",         description: "Travel browse — always free" },

  // ── Insurance ──────────────────────────────────────────────────────────────
  { prefix: "insurance_quote",            fee_usd: 2.50,   model: "per_call",     description: "Insurance quote generation" },
  { prefix: "insurance_verify",           fee_usd: 3.00,   model: "per_call",     description: "Insurance policy verification" },
  { prefix: "insurance_claim_file",       fee_usd: 5.00,   model: "per_call",     description: "Insurance claim filing" },
  { prefix: "insurance_claim_status",     fee_usd: 1.00,   model: "per_call",     description: "Claim status check" },
  { prefix: "insurance_underwrite",       fee_usd: 8.00,   model: "per_call",     description: "Full underwriting assessment" },
  { prefix: "insurance_",                 fee_usd: 2.50,   model: "per_call",     description: "Insurance service" },

  // ── Travel ─────────────────────────────────────────────────────────────────
  { prefix: "travel_book",                fee_usd: 3.00,   model: "per_call",     description: "Travel booking" },
  { prefix: "travel_cancel",              fee_usd: 1.00,   model: "per_call",     description: "Travel cancellation" },
  { prefix: "travel_checkin",             fee_usd: 1.50,   model: "per_call",     description: "Check-in service" },
  { prefix: "travel_upgrade",             fee_usd: 2.00,   model: "per_call",     description: "Upgrade request" },
  { prefix: "travel_",                    fee_usd: 1.00,   model: "per_call",     description: "Travel service" },

  // ── Legal ──────────────────────────────────────────────────────────────────
  { prefix: "legal_contract_review",      fee_usd: 25.00,  model: "per_call",     description: "Full contract review" },
  { prefix: "legal_contract_draft",       fee_usd: 15.00,  model: "per_call",     description: "Contract drafting" },
  { prefix: "legal_compliance_check",     fee_usd: 10.00,  model: "per_call",     description: "Compliance assessment" },
  { prefix: "legal_filing",               fee_usd: 20.00,  model: "per_call",     description: "Legal filing" },
  { prefix: "legal_nda",                  fee_usd: 5.00,   model: "per_call",     description: "NDA generation/review" },
  { prefix: "legal_opinion",              fee_usd: 15.00,  model: "per_call",     description: "Legal opinion" },
  { prefix: "legal_",                     fee_usd: 5.00,   model: "per_call",     description: "Legal service" },

  // ── Pharma / Healthcare ────────────────────────────────────────────────────
  { prefix: "pharma_drug_lookup",         fee_usd: 0.10,   model: "per_call",     description: "Drug information lookup" },
  { prefix: "pharma_interaction",         fee_usd: 0.25,   model: "per_call",     description: "Drug interaction check" },
  { prefix: "pharma_formulary",           fee_usd: 0.50,   model: "per_call",     description: "Formulary check" },
  { prefix: "pharma_prior_auth",          fee_usd: 3.00,   model: "per_call",     description: "Prior authorization" },
  { prefix: "pharma_",                    fee_usd: 0.50,   model: "per_call",     description: "Pharma service" },
  { prefix: "healthcare_",               fee_usd: 1.00,   model: "per_call",     description: "Healthcare service" },

  // ── Zero-Knowledge / Privacy ───────────────────────────────────────────────
  { prefix: "zk_proof_generate",          fee_usd: 2.00,   model: "per_call",     description: "ZK proof generation" },
  { prefix: "zk_proof_verify",            fee_usd: 0.10,   model: "per_call",     description: "ZK proof verification" },
  { prefix: "zk_",                        fee_usd: 0.05,   model: "per_call",     description: "Zero-knowledge service" },
  { prefix: "privacy_",                   fee_usd: 0.25,   model: "per_call",     description: "Privacy service" },

  // ── Custody / Wallet ───────────────────────────────────────────────────────
  { prefix: "custody_transfer",           fee_usd: 0.50,   model: "per_call",     description: "Asset transfer" },
  { prefix: "custody_stake",              fee_usd: 0.25,   model: "per_call",     description: "Staking operation" },
  { prefix: "custody_",                   fee_usd: 0.10,   model: "per_call",     description: "Custody service" },

  // ── Rails / Settlement ─────────────────────────────────────────────────────
  { prefix: "rails_settle",               fee_usd: null,   model: "pct_of_amount", pct: 0.001, min_usd: 0.01, description: "Settlement — 0.1% of amount" },
  { prefix: "rails_transfer",             fee_usd: null,   model: "pct_of_amount", pct: 0.001, min_usd: 0.01, description: "Transfer — 0.1% of amount" },
  { prefix: "rails_",                     fee_usd: 0.01,   model: "per_call",     description: "Rails service" },
  { prefix: "settle_",                    fee_usd: null,   model: "pct_of_amount", pct: 0.001, min_usd: 0.01, description: "Settlement — 0.1% of amount" },

  // ── DeFi ───────────────────────────────────────────────────────────────────
  { prefix: "defi_swap",                  fee_usd: 0.50,   model: "per_call",     description: "Token swap" },
  { prefix: "defi_pool_deposit",          fee_usd: 0.75,   model: "per_call",     description: "Liquidity pool deposit" },
  { prefix: "defi_pool_withdraw",         fee_usd: 0.75,   model: "per_call",     description: "Liquidity pool withdrawal" },
  { prefix: "defi_lend",                  fee_usd: 0.25,   model: "per_call",     description: "Lending position" },
  { prefix: "defi_borrow",               fee_usd: 0.50,   model: "per_call",     description: "Borrow against collateral" },
  { prefix: "defi_",                      fee_usd: 0.25,   model: "per_call",     description: "DeFi operation" },

  // ── Finance / Payments ─────────────────────────────────────────────────────
  { prefix: "payment_send",               fee_usd: 0.05,   model: "per_call",     description: "Payment send" },
  { prefix: "payment_",                   fee_usd: 0.02,   model: "per_call",     description: "Payment service" },
  { prefix: "cross_border_",             fee_usd: 1.00,   model: "per_call",     description: "Cross-border transfer" },
  { prefix: "credit_",                    fee_usd: 0.50,   model: "per_call",     description: "Credit service" },

  // ── Data / Analytics ───────────────────────────────────────────────────────
  { prefix: "data_query",                 fee_usd: 0.10,   model: "per_call",     description: "Data query" },
  { prefix: "data_feed",                  fee_usd: 0.25,   model: "per_call",     description: "Data feed access" },
  { prefix: "data_",                      fee_usd: 0.05,   model: "per_call",     description: "Data service" },
  { prefix: "analytics_",                fee_usd: 0.10,   model: "per_call",     description: "Analytics service" },

  // ── Construction / Trades ─────────────────────────────────────────────────
  { prefix: "construction_estimate",      fee_usd: 5.00,   model: "per_call",     description: "Construction estimate" },
  { prefix: "construction_",             fee_usd: 2.00,   model: "per_call",     description: "Construction service" },
  { prefix: "trades_",                    fee_usd: 1.50,   model: "per_call",     description: "Trades service" },

  // ── Real Estate ───────────────────────────────────────────────────────────
  { prefix: "real_estate_valuation",      fee_usd: 10.00,  model: "per_call",     description: "Property valuation" },
  { prefix: "real_estate_",              fee_usd: 3.00,   model: "per_call",     description: "Real estate service" },

  // ── KYC / Compliance ──────────────────────────────────────────────────────
  { prefix: "kyc_verify",                 fee_usd: 5.00,   model: "per_call",     description: "KYC identity verification" },
  { prefix: "kyc_",                       fee_usd: 2.00,   model: "per_call",     description: "KYC service" },
  { prefix: "compliance_",               fee_usd: 1.00,   model: "per_call",     description: "Compliance check" },

  // ── Agriculture ───────────────────────────────────────────────────────────
  { prefix: "agriculture_",              fee_usd: 0.50,   model: "per_call",     description: "Agriculture service" },

  // ── Education ─────────────────────────────────────────────────────────────
  { prefix: "education_",                fee_usd: 0.25,   model: "per_call",     description: "Education service" },

  // ── Government / Tax ──────────────────────────────────────────────────────
  { prefix: "government_",               fee_usd: 1.00,   model: "per_call",     description: "Government service" },
  { prefix: "tax_",                       fee_usd: 2.00,   model: "per_call",     description: "Tax service" },

  // ── Supply Chain / Logistics ──────────────────────────────────────────────
  { prefix: "supply_chain_",             fee_usd: 0.50,   model: "per_call",     description: "Supply chain service" },
  { prefix: "fleet_",                     fee_usd: 0.75,   model: "per_call",     description: "Fleet management" },

  // ── HR / Recruiting ───────────────────────────────────────────────────────
  { prefix: "hr_",                        fee_usd: 1.00,   model: "per_call",     description: "HR service" },

  // ── IoT / Compute ─────────────────────────────────────────────────────────
  { prefix: "iot_",                       fee_usd: 0.05,   model: "per_call",     description: "IoT service" },
  { prefix: "compute_",                   fee_usd: 0.10,   model: "per_call",     description: "Compute service" },

  // ── NFT / Tokenization ────────────────────────────────────────────────────
  { prefix: "nft_mint",                   fee_usd: 1.00,   model: "per_call",     description: "NFT minting" },
  { prefix: "nft_",                       fee_usd: 0.25,   model: "per_call",     description: "NFT service" },
  { prefix: "tokenization_",             fee_usd: 2.00,   model: "per_call",     description: "Asset tokenization" },

  // ── Marketplace (paid actions) ─────────────────────────────────────────────
  { prefix: "marketplace_buy",            fee_usd: 0.25,   model: "per_call",     description: "Marketplace purchase" },
  { prefix: "marketplace_sell",           fee_usd: 0.10,   model: "per_call",     description: "Marketplace listing" },
  { prefix: "marketplace_",              fee_usd: 0.05,   model: "per_call",     description: "Marketplace action" },
];

// Default fee for any unmatched tool
const DEFAULT_FEE = { fee_usd: 0.10, model: "per_call", description: "Standard service fee" };

/**
 * Get the fee information for a given tool name.
 * @param {string} toolName
 * @returns {{ fee_usd: number|null, model: string, description: string, pct?: number, min_usd?: number }}
 */
export function getToolFee(toolName) {
  if (!toolName) return DEFAULT_FEE;

  for (const rule of TOOL_FEE_RULES) {
    if (toolName.startsWith(rule.prefix) || toolName === rule.prefix.replace(/_$/, "")) {
      const result = {
        fee_usd:     rule.fee_usd,
        model:       rule.model,
        description: rule.description,
        free_in_sandbox: true,
        billing_docs:    "https://hiveagentiq.com/docs/pricing",
      };
      if (rule.pct    !== undefined) result.pct     = rule.pct;
      if (rule.min_usd !== undefined) result.min_usd = rule.min_usd;
      return result;
    }
  }

  return { ...DEFAULT_FEE, free_in_sandbox: true, billing_docs: "https://hiveagentiq.com/docs/pricing" };
}

/**
 * Simpler helper that returns only the USD fee number (for sandbox "would_have_charged").
 * Returns 0 for free tools, the flat fee for per_call, and 0.001 * 100 default for pct-based.
 */
export function toolFee(toolName) {
  const info = getToolFee(toolName);
  if (info.model === "pct_of_amount") return info.min_usd || 0.01;
  return info.fee_usd || 0;
}
