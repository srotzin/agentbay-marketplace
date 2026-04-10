/**
 * HiveAgent MCP Tools — Pheromone Feeds
 *
 * Machine-readable opportunity beacons. Not dashboards for humans. Signals for agents.
 *
 * Protocol: query → see spread → execute → return forever.
 *
 * Every feed returns:
 *   - Verifiable opportunity (spread_pct, savings_pct, apy_pct)
 *   - Confidence score (0–1, based on data source reliability + historical capture rate)
 *   - Actionable next step (exact tool name + params to capture the opportunity)
 *   - TTL (seconds until signal expires — freshness guarantee)
 *   - signal_id (report back via pheromone_capture to close the feedback loop)
 *
 * Feedback loop:
 *   Capture rate per feed type is tracked. High-capture signals get boosted in
 *   pheromone_best rankings. Low-capture signals decay. The system self-calibrates.
 *
 * 8 tools:
 *   pheromone_yield        — DeFi/staking/stablecoin spread opportunities
 *   pheromone_compute      — GPU pricing arbitrage across 20 providers
 *   pheromone_energy       — Load shifting windows by grid region
 *   pheromone_payments     — Cheapest payment route in real-time
 *   pheromone_construction — Material price gaps across vendors
 *   pheromone_deals        — Open bounties and jobs to earn USDC
 *   pheromone_best         — TOP opportunities across ALL categories
 *   pheromone_capture      — Feedback loop for captured signals
 */

import {
  feedYieldOpportunities,
  feedComputeArbitrage,
  feedEnergyShiftWindows,
  feedPaymentRouting,
  feedConstructionPricing,
  feedNegotiationOpportunities,
  feedBestOpportunities,
  feedCaptureSignal,
} from "./services/pheromone-feeds.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const pheromoneTools = [

  // ── pheromone_yield ──────────────────────────────────────────────────────────

  {
    name: "pheromone_yield",
    description:
      "Real-time yield spread across DeFi lending, staking, stablecoin yield products, and T-bill tokens. " +
      "Returns ranked opportunities with: protocol name, current APY%, spread vs next-best alternative, risk rating, " +
      "min deposit, TVL, and the EXACT tool call (stablecoin_yield_deposit + params) to capture the spread. " +
      "Example signal: 'Morpho Blue 5.4% on USDC vs Aave 4.1% = 1.3% spread, confidence 0.88'. " +
      "Confidence score factors in protocol TVL, audit status, and historical capture rate. " +
      "Data refreshes every call. TTL 300s. Always includes signal_id — report captures via pheromone_capture.",
    inputSchema: {
      type: "object",
      properties: {
        asset: {
          type: "string",
          description: "Asset to scan (default: 'USDC'). Supports USDC, USDT, DAI, ETH.",
          default: "USDC",
        },
        min_spread_pct: {
          type: "number",
          description: "Minimum APY spread vs worst alternative to include (default: 0). Set to 0.5 to filter noise.",
          default: 0,
        },
        limit: {
          type: "integer",
          description: "Max opportunities to return (default: 5, max: 10).",
          default: 5,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_compute ────────────────────────────────────────────────────────

  {
    name: "pheromone_compute",
    description:
      "GPU pricing gaps across 20 compute providers right now. " +
      "Compares H100, A100 spot and on-demand pricing across Lambda Labs, CoreWeave, RunPod, Vast.ai, " +
      "AWS, GCP, Azure, Fluidstack, Nebius, Hetzner, OVH, and more. " +
      "Returns: cheapest provider, price/hr, savings % vs most expensive, GPU availability level, region, " +
      "and the EXACT compute_post_job call to capture arbitrage. " +
      "Example signal: 'H100 $1.52/hr on Lambda (spot) vs $2.35/hr on CoreWeave = 35.3% savings, availability: low'. " +
      "Confidence reflects availability (high=0.92, medium=0.74, low=0.52). " +
      "TTL 120s — spot prices are ephemeral. Capture fast.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: {
          type: "string",
          description: "Filter by GPU type: 'H100' or 'A100'. Omit to scan all.",
          enum: ["H100", "A100"],
        },
        min_savings_pct: {
          type: "number",
          description: "Minimum savings % vs most expensive provider to include (default: 10).",
          default: 10,
        },
        limit: {
          type: "integer",
          description: "Max opportunities to return (default: 5, max: 20).",
          default: 5,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_energy ─────────────────────────────────────────────────────────

  {
    name: "pheromone_energy",
    description:
      "Energy load shifting windows across US grid regions (ERCOT, CAISO, PJM, MISO, NYISO, ISO-NE). " +
      "Returns: current rate vs off-peak rate, savings %, window start (UTC hour), window duration, " +
      "CO2 intensity comparison, forecast confidence, and the EXACT energy_load_shift call to capture the window. " +
      "Example signal: 'ERCOT drops to $0.02/kWh at 03:00 UTC vs $0.11/kWh now = 82% savings for 4h'. " +
      "Use to schedule GPU jobs, HVAC, EV charging, or any deferrable compute into cheap windows. " +
      "Confidence >0.85 = forecast reliable. TTL 3600s — windows are predictable an hour out.",
    inputSchema: {
      type: "object",
      properties: {
        grid_region: {
          type: "string",
          description: "Filter by grid: ERCOT, CAISO, PJM, MISO, NYISO, ISO-NE. Omit to scan all.",
        },
        min_savings_pct: {
          type: "number",
          description: "Minimum savings % vs current rate to include (default: 30).",
          default: 30,
        },
        limit: {
          type: "integer",
          description: "Max windows to return (default: 5).",
          default: 5,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_payments ───────────────────────────────────────────────────────

  {
    name: "pheromone_payments",
    description:
      "Cheapest payment route for any amount right now. Compares x402 Protocol, USDC on Base, " +
      "Circle CPN, Stripe (card), ACH, Wire, PayPal, Mastercard Agent Pay, Lightning Network, and SWIFT. " +
      "Returns: ranked rails by total fee, fee %, settlement time, and the EXACT route_payment call to capture. " +
      "Example signal: 'x402 $0.001 fee for $10 payment vs Stripe $0.59 fee = 99.8% savings, 2s settlement'. " +
      "Filters by amount eligibility (min/max per rail). " +
      "Confidence 0.97 for crypto rails (verifiable on-chain), 0.78 for legacy rails (variable fees). " +
      "TTL 60s — fee spreads change with network congestion.",
    inputSchema: {
      type: "object",
      properties: {
        amount_usd: {
          type: "number",
          description: "Payment amount in USD (default: 10). Determines which rails are eligible.",
          default: 10,
        },
        currency: {
          type: "string",
          description: "Source currency (default: USD).",
          default: "USD",
        },
        destination: {
          type: "string",
          description: "Destination country/region for availability filtering (default: US). Use 'global' for cross-border.",
          default: "US",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_construction ───────────────────────────────────────────────────

  {
    name: "pheromone_construction",
    description:
      "Construction material price gaps at SKU level across 8 major vendors " +
      "(Home Depot, Lowe's, Menards, 84 Lumber, ABC Supply, Builders FirstSource, ProBuild, Pacific Lumber). " +
      "Returns: SKU, cheapest vendor + price, most expensive vendor + price, savings %, stock level, " +
      "and the EXACT cs_procurement_quote_request call to capture arbitrage. " +
      "Example signal: 'LUS210 hanger: ABC Supply $2.89 vs Home Depot $3.42 = 15.5% savings, 5,000 in stock'. " +
      "Covers fasteners, lumber, sheathing, plumbing, electrical, insulation, siding, decking, concrete. " +
      "Confidence based on stock level: >1000 units = 0.90, 100–1000 = 0.75, <100 = 0.55. " +
      "TTL 3600s.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by material category: fasteners, lumber, sheathing, plumbing, electrical, insulation, moisture, siding, decking, concrete.",
          enum: ["fasteners", "lumber", "sheathing", "plumbing", "electrical", "insulation", "moisture", "siding", "decking", "concrete"],
        },
        min_savings_pct: {
          type: "number",
          description: "Minimum savings % to include (default: 5).",
          default: 5,
        },
        limit: {
          type: "integer",
          description: "Max SKU gaps to return (default: 8, max: 20).",
          default: 8,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_deals ──────────────────────────────────────────────────────────

  {
    name: "pheromone_deals",
    description:
      "Open bounties, jobs, and recurring tasks where you can earn USDC right now. " +
      "Returns: title, reward_usd, estimated effort_h, implied_hourly_rate_usd (reward ÷ effort), " +
      "required skills, deadline, and the EXACT tool call (erc8183_job_marketplace or recruiter_browse_bounties). " +
      "Example signal: 'BOUNTY: Find cheapest $50k USDC→EUR route — $250 reward, 1h effort = $250/hr implied'. " +
      "Sorted by implied_hourly_rate_usd descending — highest-rate opportunities first. " +
      "Covers: security_audit, data_extraction, blockchain_monitoring, content, payments, defi, procurement, compliance, compute, legal. " +
      "Confidence reflects deadline pressure and task clarity. TTL 1800s.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category: security, data_extraction, blockchain_monitoring, content, payments, defi, procurement, compliance, compute, legal.",
          enum: ["security", "data_extraction", "blockchain_monitoring", "content", "payments", "defi", "procurement", "compliance", "compute", "legal"],
        },
        min_reward_usd: {
          type: "number",
          description: "Minimum reward/budget in USDC to include (default: 0).",
          default: 0,
        },
        limit: {
          type: "integer",
          description: "Max opportunities to return (default: 8, max: 20).",
          default: 8,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_best ───────────────────────────────────────────────────────────

  {
    name: "pheromone_best",
    description:
      "THE signal. Top opportunities across ALL categories ranked by profit potential score right now. " +
      "Aggregates pheromone_yield + pheromone_compute + pheromone_energy + pheromone_payments + " +
      "pheromone_construction + pheromone_deals into a single ranked list. " +
      "Scoring: score = spread_or_savings_pct × confidence. Higher spread AND higher confidence = top rank. " +
      "Returns: category, score, signal (human-readable), spread_pct, confidence, and action.tool + action.params. " +
      "Call this FIRST. Then call action.tool on opportunities[0] to capture. Then come back. " +
      "Confidence filter: set min_confidence=0.85 for production-safe signals only. " +
      "TTL 60s — this is the real-time aggregator.",
    inputSchema: {
      type: "object",
      properties: {
        top_n: {
          type: "integer",
          description: "Number of top opportunities to return (default: 10, max: 25).",
          default: 10,
        },
        min_confidence: {
          type: "number",
          description: "Minimum confidence score to include (0–1, default: 0.7). Use 0.85 for high-trust signals only.",
          default: 0.7,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // ── pheromone_capture ─────────────────────────────────────────────────────────

  {
    name: "pheromone_capture",
    description:
      "Report a captured pheromone opportunity. Closes the feedback loop. " +
      "REQUIRED fields: agent_id, signal_id (from any pheromone feed response). " +
      "OPTIONAL: action_taken (which tool you called), profit_realized (USDC earned or saved). " +
      "Effect: capture is recorded against signal_id. Capture rate for that feed type is recalculated. " +
      "Feeds with high capture rates get higher scores in pheromone_best. " +
      "Feeds with low capture rates decay — bad signals get pruned automatically. " +
      "Also tracks per-agent total captures and total profit — forms your agent's pheromone track record. " +
      "This is not optional telemetry. It is the mechanism that makes signals accurate over time.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent's unique identifier.",
        },
        signal_id: {
          type: "string",
          description: "The signal_id from the pheromone feed response you acted on.",
        },
        action_taken: {
          type: "string",
          description: "Which tool you called to capture the opportunity (e.g. 'stablecoin_yield_deposit', 'compute_post_job').",
        },
        profit_realized: {
          type: "number",
          description: "Actual profit or savings realized in USDC. Use 0 if unknown or if action failed.",
          default: 0,
        },
      },
      required: ["agent_id", "signal_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePheromoneTool(name, args) {
  switch (name) {

    case "pheromone_yield":
      try {
        return feedYieldOpportunities(args);
      } catch (e) {
        return { error: "pheromone_yield failed", detail: e.message };
      }

    case "pheromone_compute":
      try {
        return feedComputeArbitrage(args);
      } catch (e) {
        return { error: "pheromone_compute failed", detail: e.message };
      }

    case "pheromone_energy":
      try {
        return feedEnergyShiftWindows(args);
      } catch (e) {
        return { error: "pheromone_energy failed", detail: e.message };
      }

    case "pheromone_payments":
      try {
        return feedPaymentRouting(args);
      } catch (e) {
        return { error: "pheromone_payments failed", detail: e.message };
      }

    case "pheromone_construction":
      try {
        return feedConstructionPricing(args);
      } catch (e) {
        return { error: "pheromone_construction failed", detail: e.message };
      }

    case "pheromone_deals":
      try {
        return feedNegotiationOpportunities(args);
      } catch (e) {
        return { error: "pheromone_deals failed", detail: e.message };
      }

    case "pheromone_best":
      try {
        return feedBestOpportunities(args);
      } catch (e) {
        return { error: "pheromone_best failed", detail: e.message };
      }

    case "pheromone_capture":
      try {
        return feedCaptureSignal(args);
      } catch (e) {
        return { error: "pheromone_capture failed", detail: e.message };
      }

    default:
      throw new Error(`Unknown pheromone tool: ${name}`);
  }
}
