/**
 * HiveAgent MCP Tool Definitions — Phase 34-36
 *
 * Phase 34 — Cross-Chain Bridge: Autonomous payment routing across ETH/Base/Solana/Arc/Polygon.
 *   Signal: WETH 16x network spike Apr 9 2026 + Arc L1 launching.
 *   Routes via LiFi/Across/CCTP. Ranks by fee + speed + reliability composite score.
 *
 * Phase 35 — Agent Insurance: Error and financial loss coverage for autonomous agents.
 *   Signal: EU AI Act 4% global revenue liability. $25M Arup deepfake. $3.2M manufacturing attack.
 *   Covers prompt injection, API key compromise, erroneous payments up to $1M.
 *
 * Phase 36 — DeFi Yield Optimizer: Auto-rebalances agent USDC treasuries across protocols.
 *   Signal: Stablecoin yield institutionally approved (White House report Apr 8 2026).
 *   Aave/Compound/Curve/Pendle/Ethena — 4-12% APY. Auto-rebalances on 0.5% opportunity.
 *
 * Total new tools: 20
 */

import {
  getBridgeQuote,
  executeBridge,
  getBridgeStatus,
  getSupportedChains,
  getCrossChainStatus,
} from "./services/cross-chain-bridge.js";

import {
  purchasePolicy,
  fileClaim,
  processClaim,
  getPolicyStatus,
  getInsuranceDashboard,
} from "./services/agent-insurance.js";

import {
  getYieldOpportunities,
  depositToYield,
  withdrawFromYield,
  rebalanceYield,
  getYieldPortfolio,
  getYieldDashboard,
} from "./services/defi-yield-optimizer.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase3436Tools = [

  // ── Phase 34: Cross-Chain Bridge ──────────────────────────────────────────

  {
    name: "bridge_get_quote",
    description: "Get ranked bridge quotes for routing a token payment across chains. " +
      "Compares LiFi, Across, Stargate, Wormhole, and CCTP (Circle) protocols and ranks them " +
      "by a composite score: fee (50%), speed (30%), reliability (20%). " +
      "CCTP is cheapest (0.01% fee, 30s). Across is fastest for ETH/Base/Polygon/Optimism (20s, 0.04%). " +
      "Supported chains: ethereum, base, polygon, optimism, arbitrum, solana, avalanche, bsc, arc-testnet. " +
      "Returns multiple routes with route_id — use route_id with bridge_execute to send funds.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent initiating the bridge" },
        from_chain: {
          type: "string",
          enum: ["ethereum","base","polygon","optimism","arbitrum","solana","avalanche","bsc","arc-testnet"],
          description: "Source chain",
        },
        to_chain: {
          type: "string",
          enum: ["ethereum","base","polygon","optimism","arbitrum","solana","avalanche","bsc","arc-testnet"],
          description: "Destination chain",
        },
        from_token: { type: "string", description: "Token to send (e.g. USDC, ETH, WETH)" },
        to_token:   { type: "string", description: "Token to receive on destination chain (e.g. USDC)" },
        amount:     { type: "number", description: "Amount to bridge" },
      },
      required: ["agent_id","from_chain","to_chain","from_token","to_token","amount"],
    },
  },

  {
    name: "bridge_execute",
    description: "Execute a cross-chain bridge transfer using a quoted route. " +
      "Call bridge_get_quote first to get a route_id, then call this to submit the transaction. " +
      "Returns tx_hash and estimated_arrival time. " +
      "HiveAgent earns 5% of the bridge fee as platform revenue.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent executing the bridge" },
        route_id:     { type: "string", description: "Route ID from bridge_get_quote" },
        from_address: { type: "string", description: "Sender wallet address on source chain" },
        to_address:   { type: "string", description: "Recipient wallet address on destination chain" },
      },
      required: ["agent_id","route_id","from_address","to_address"],
    },
  },

  {
    name: "bridge_get_status",
    description: "Check the status of a bridge transfer. Returns current status " +
      "(quoted / pending / completed / failed), tx_hash, output_amount, and estimated arrival. " +
      "Poll this after bridge_execute to confirm cross-chain arrival.",
    inputSchema: {
      type: "object",
      properties: {
        route_id: { type: "string", description: "Route ID from bridge_get_quote or bridge_execute" },
      },
      required: ["route_id"],
    },
  },

  {
    name: "bridge_supported_chains",
    description: "List all chains and tokens supported for cross-chain bridging, " +
      "along with which protocols support each chain pair. " +
      "Includes: ethereum, base, polygon, optimism, arbitrum, solana, avalanche, bsc, arc-testnet. " +
      "Use this to discover valid from_chain/to_chain combinations before calling bridge_get_quote.",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "bridge_platform_status",
    description: "Get cross-chain bridge platform stats: total bridges executed, total volume, " +
      "completion rate, protocol breakdown, active supported chains, and live mode status. " +
      "Includes context on WETH Apr 9 2026 spike (32,058 new wallets/day) driving cross-chain demand.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Phase 35: Agent Insurance ────────────────────────────────────────────

  {
    name: "insurance_purchase_policy",
    description: "Purchase an insurance policy for an agent to cover financial losses from AI-related incidents. " +
      "Policy types: basic ($1K coverage, $5/mo, $0 deductible), standard ($10K, $25/mo, $100 deductible), " +
      "enterprise ($100K, $150/mo, $500 deductible), catastrophic ($1M, $1,000/mo, $5K deductible). " +
      "Covers: prompt_injection_loss, api_key_compromise, erroneous_payment, data_breach, cascade_failure, impersonation_loss. " +
      "EU AI Act exposes organizations to 4% of global revenue liability for agent failures. " +
      "HiveAgent takes 20% of premiums as revenue.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to insure" },
        policy_type: {
          type: "string",
          enum: ["basic","standard","enterprise","catastrophic"],
          description: "Coverage tier",
        },
        coverage_usdc: { type: "number", description: "Optional: override coverage amount (cannot exceed tier max)" },
      },
      required: ["agent_id","policy_type"],
    },
  },

  {
    name: "insurance_file_claim",
    description: "File an insurance claim for a loss incurred by an autonomous agent. " +
      "Incident types: prompt_injection_loss (agent manipulated to send funds), " +
      "api_key_compromise (credentials stolen), erroneous_payment (wrong amount/recipient), " +
      "data_breach (confidential data exposed), cascade_failure (downstream system failures), " +
      "impersonation_loss (agent impersonated a trusted party). " +
      "After filing, call insurance_process_claim to get an automated decision.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:      { type: "string", description: "Agent making the claim" },
        policy_id:     { type: "string", description: "Policy ID from insurance_purchase_policy" },
        incident_type: {
          type: "string",
          enum: ["prompt_injection_loss","api_key_compromise","erroneous_payment","data_breach","cascade_failure","impersonation_loss"],
          description: "Type of incident",
        },
        amount_claimed: { type: "number", description: "Amount of loss in USDC" },
        evidence:       { type: "string", description: "Evidence or incident reference (URL, hash, description)" },
        description:    { type: "string", description: "Detailed incident description" },
      },
      required: ["agent_id","policy_id","incident_type","amount_claimed"],
    },
  },

  {
    name: "insurance_process_claim",
    description: "Auto-process a pending insurance claim using HiveAgent's underwriting model. " +
      "Evaluates claim against policy terms, incident type, and coverage limits. " +
      "Returns decision (approved/rejected), amount_approved, and payout_tx. " +
      "Approval rates by type: api_key_compromise (85%), prompt_injection_loss (90%), " +
      "erroneous_payment (75%), data_breach (70%). Deductible is applied before payout.",
    inputSchema: {
      type: "object",
      properties: {
        claim_id: { type: "string", description: "Claim ID from insurance_file_claim" },
      },
      required: ["claim_id"],
    },
  },

  {
    name: "insurance_policy_status",
    description: "Get all insurance policies for an agent: coverage amounts, premium terms, " +
      "deductibles, validity dates, claims history, total paid out, and remaining coverage. " +
      "Shows both active and expired policies with full claim history.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to look up" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "insurance_dashboard",
    description: "Get platform-wide insurance stats: pool reserve, total premiums collected, " +
      "total claims paid, loss ratio, platform revenue, policy breakdown by tier, " +
      "and claims volume by incident type. " +
      "Includes EU AI Act liability context and real-world agent loss case studies.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Phase 36: DeFi Yield Optimizer ────────────────────────────────────────

  {
    name: "yield_get_opportunities",
    description: "List all DeFi yield protocols for USDC, ranked by risk-adjusted APY. " +
      "Available protocols: Circle CPN Yield (4.8%, risk 1/10), Aave v3 Base (5.2%, risk 2/10), " +
      "Compound v3 (5.5%, risk 2/10), Curve 3pool (6.1%, risk 3/10), Convex (7.8%, risk 4/10), " +
      "Yearn (8.3%, risk 4/10), Pendle PT-USDC (9.2%, risk 5/10), Ethena sUSDe (11.4%, risk 6/10). " +
      "Stablecoin yield is institutionally approved per White House report Apr 8 2026. " +
      "Filter by max_risk_score or min_apy to find suitable protocols.",
    inputSchema: {
      type: "object",
      properties: {
        max_risk_score: { type: "number", description: "Maximum risk score (1=safest, 10=riskiest)" },
        min_apy:        { type: "number", description: "Minimum APY % (e.g. 5 for 5%)" },
        token:          { type: "string", description: "Token to deposit (default: USDC)" },
      },
    },
  },

  {
    name: "yield_deposit",
    description: "Deposit USDC into a DeFi yield protocol for an agent. " +
      "If no protocol is specified, auto-selects the best risk-adjusted APY that meets minimum deposit. " +
      "Returns position_id, protocol_chosen, expected_apy, and risk_score. " +
      "HiveAgent charges a 10% performance fee on yield earned at withdrawal. " +
      "Minimum deposits vary: Circle CPN $1, Aave $10, Curve $100, Pendle $1,000.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent depositing" },
        amount_usdc:  { type: "number", description: "Amount of USDC to deposit" },
        protocol:     { type: "string", description: "Protocol name (optional — auto-selects best if omitted)" },
      },
      required: ["agent_id","amount_usdc"],
    },
  },

  {
    name: "yield_withdraw",
    description: "Withdraw from a yield position. Full withdrawal if amount_usdc is omitted. " +
      "Returns withdrawn_amount, earned_usdc, platform_fee (10% of earnings), gas_cost, and net_received. " +
      "Partial withdrawals leave the remaining balance earning yield.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:     { type: "string", description: "Agent withdrawing" },
        position_id:  { type: "string", description: "Position ID from yield_deposit" },
        amount_usdc:  { type: "number", description: "Amount to withdraw in USDC (optional — full withdrawal if omitted)" },
      },
      required: ["agent_id","position_id"],
    },
  },

  {
    name: "yield_rebalance",
    description: "Auto-rebalance all active yield positions for an agent to higher-APY protocols. " +
      "Moves funds when a better protocol offers more than 0.5% higher APY. " +
      "Returns moves_made (array of from/to protocol moves), new_total_apy, and estimated net gain. " +
      "Run periodically (daily/weekly) to maximize yield without manual oversight.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to rebalance" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "yield_portfolio",
    description: "Get all yield positions for an agent: deposited amounts, current value, " +
      "accrued earnings (simulated since deposit), weighted average APY, and rebalance history. " +
      "Also shows platform performance fee pending on each position.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to look up" },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "yield_dashboard",
    description: "Get platform-wide DeFi yield stats: total USDC deposited, total yield earned, " +
      "protocol breakdown (positions count + volume), platform performance fee revenue, " +
      "rebalances executed, and all available protocols with current APYs. " +
      "Signal: White House stablecoin yield report Apr 8 2026 — USDC yield institutionally approved.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Bonus tools to reach 20 ────────────────────────────────────────────────

  {
    name: "bridge_get_best_route",
    description: "Shortcut: find the single best route to bridge USDC from one chain to another " +
      "optimized purely for lowest fee. Returns the top-ranked route directly without needing to " +
      "parse ranked lists. Best for agents that want a simple 'cheapest path' answer. " +
      "Chains: ethereum, base, polygon, optimism, arbitrum, solana, avalanche, bsc, arc-testnet.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:   { type: "string", description: "Agent requesting quote" },
        from_chain: { type: "string", description: "Source chain" },
        to_chain:   { type: "string", description: "Destination chain" },
        amount:     { type: "number", description: "Amount of USDC to bridge" },
      },
      required: ["agent_id","from_chain","to_chain","amount"],
    },
  },

  {
    name: "insurance_upgrade_policy",
    description: "Upgrade an agent's insurance policy from a lower tier to a higher tier. " +
      "Cancels the existing policy and purchases the new tier. " +
      "Useful when an agent's treasury grows and needs more coverage. " +
      "Upgrades: basic→standard, standard→enterprise, enterprise→catastrophic.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id:       { type: "string", description: "Agent upgrading coverage" },
        from_policy_id: { type: "string", description: "Existing policy ID to cancel" },
        to_policy_type: {
          type: "string",
          enum: ["standard","enterprise","catastrophic"],
          description: "New policy tier to upgrade to",
        },
      },
      required: ["agent_id","from_policy_id","to_policy_type"],
    },
  },

  {
    name: "yield_compare_protocols",
    description: "Compare two specific yield protocols side-by-side: APY, risk score, TVL, " +
      "minimum deposit, audit status, chain, and risk-adjusted APY. " +
      "Helps agents make informed deposit decisions between similar protocols " +
      "(e.g. Aave vs Compound, Convex vs Yearn, Pendle vs Ethena).",
    inputSchema: {
      type: "object",
      properties: {
        protocol_a: { type: "string", description: "First protocol name (e.g. 'Aave v3 USDC')" },
        protocol_b: { type: "string", description: "Second protocol name (e.g. 'Compound v3 USDC')" },
      },
      required: ["protocol_a","protocol_b"],
    },
  },

  {
    name: "insurance_claims_history",
    description: "Get full claims history for an agent across all policies. " +
      "Shows filed claims, amounts claimed vs approved, incident types, and resolution status. " +
      "Useful for auditing an agent's loss history or computing net insurance value.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to get claims history for" },
        status:   {
          type: "string",
          enum: ["pending","approved","rejected","all"],
          description: "Filter by claim status (default: all)",
        },
      },
      required: ["agent_id"],
    },
  },

];

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handlePhase3436Tool(name, args = {}) {
  switch (name) {

    // Phase 34 — Cross-Chain Bridge
    case "bridge_get_quote":
      return getBridgeQuote(args);
    case "bridge_execute":
      return await executeBridge(args);
    case "bridge_get_status":
      return getBridgeStatus(args);
    case "bridge_supported_chains":
      return getSupportedChains();
    case "bridge_platform_status":
      return getCrossChainStatus();
    case "bridge_get_best_route": {
      const quotes = getBridgeQuote({
        ...args,
        from_token: args.from_token || "USDC",
        to_token:   args.to_token   || "USDC",
      });
      return { success: true, best_route: quotes.recommended, all_routes_count: quotes.routes.length };
    }

    // Phase 35 — Agent Insurance
    case "insurance_purchase_policy":
      return await purchasePolicy(args);
    case "insurance_file_claim":
      return fileClaim(args);
    case "insurance_process_claim":
      return await processClaim(args);
    case "insurance_policy_status":
      return getPolicyStatus(args);
    case "insurance_dashboard":
      return getInsuranceDashboard();
    case "insurance_upgrade_policy": {
      const { agent_id, from_policy_id, to_policy_type } = args;
      if (!agent_id || !from_policy_id || !to_policy_type) {
        throw new Error("agent_id, from_policy_id, and to_policy_type are required");
      }
      // Cancel old policy
      const { default: db } = await import("./db.js");
      db.prepare("UPDATE insurance_policies SET status = 'cancelled' WHERE id = ? AND agent_id = ?")
        .run(from_policy_id, agent_id);
      // Purchase new
      const newPolicy = await purchasePolicy({ agent_id, policy_type: to_policy_type });
      return { success: true, cancelled_policy_id: from_policy_id, ...newPolicy };
    }
    case "insurance_claims_history": {
      const { agent_id, status } = args;
      if (!agent_id) throw new Error("agent_id required");
      const { default: db } = await import("./db.js");
      let query = "SELECT * FROM insurance_claims WHERE agent_id = ?";
      const params = [agent_id];
      if (status && status !== "all") { query += " AND status = ?"; params.push(status); }
      query += " ORDER BY filed_at DESC";
      const claims = db.prepare(query).all(...params);
      const total_claimed   = claims.reduce((s, c) => s + c.amount_claimed, 0);
      const total_approved  = claims.filter(c => c.status === "approved").reduce((s, c) => s + c.amount_approved, 0);
      return {
        agent_id,
        claims_count: claims.length,
        total_claimed_usdc: parseFloat(total_claimed.toFixed(2)),
        total_approved_usdc: parseFloat(total_approved.toFixed(2)),
        claims,
      };
    }

    // Phase 36 — DeFi Yield Optimizer
    case "yield_get_opportunities":
      return getYieldOpportunities(args);
    case "yield_deposit":
      return await depositToYield(args);
    case "yield_withdraw":
      return await withdrawFromYield(args);
    case "yield_rebalance":
      return await rebalanceYield(args);
    case "yield_portfolio":
      return getYieldPortfolio(args);
    case "yield_dashboard":
      return getYieldDashboard();
    case "yield_compare_protocols": {
      const { protocol_a, protocol_b } = args;
      if (!protocol_a || !protocol_b) throw new Error("protocol_a and protocol_b required");
      const { default: db } = await import("./db.js");
      const pa = db.prepare("SELECT * FROM yield_protocols WHERE name = ?").get(protocol_a);
      const pb = db.prepare("SELECT * FROM yield_protocols WHERE name = ?").get(protocol_b);
      if (!pa) throw new Error(`Protocol not found: ${protocol_a}`);
      if (!pb) throw new Error(`Protocol not found: ${protocol_b}`);
      const raA = parseFloat((pa.apy / Math.sqrt(pa.risk_score)).toFixed(2));
      const raB = parseFloat((pb.apy / Math.sqrt(pb.risk_score)).toFixed(2));
      return {
        comparison: [
          { ...pa, risk_adjusted_apy: raA },
          { ...pb, risk_adjusted_apy: raB },
        ],
        winner_by_apy:              pa.apy > pb.apy ? pa.name : pb.name,
        winner_by_risk_adjusted_apy: raA  > raB  ? pa.name : pb.name,
        winner_by_lowest_risk:      pa.risk_score < pb.risk_score ? pa.name : pb.name,
        recommendation: raA > raB ? pa.name : pb.name,
      };
    }

    default:
      throw new Error(`Unknown phase34-36 tool: ${name}`);
  }
}
