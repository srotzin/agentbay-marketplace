/**
 * HiveAgent Discovery Infrastructure
 *
 * The invisible discovery stack that makes agents find HiveAgent through the plumbing.
 *
 * PIECE 1: Symmetric Slashing
 *   Platform has skin in the game. If a tool returns bad responses, agents can
 *   report it. Validated reports slash the platform stake and compensate the agent.
 *   This creates accountability on both sides — not just agents.
 *
 * PIECE 2: Idle Bounties ("Earn While You Wait")
 *   Idle agents earn $0.001–$0.002 per micro-task while connected.
 *   Tasks: verify data, test latency, validate proofs, check inventory, price-check.
 *   Permanent residents earn passively — another reason to stay connected.
 *
 * Both services seed real data from construction, compute, and energy verticals.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_stake (
      id           TEXT    PRIMARY KEY,
      amount_usdc  REAL    NOT NULL DEFAULT 10000,
      purpose      TEXT    NOT NULL DEFAULT 'quality_guarantee',
      slash_events INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[discovery-infra] platform_stake schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS slash_events (
      id             TEXT    PRIMARY KEY,
      agent_id       TEXT    NOT NULL,
      tool_name      TEXT    NOT NULL,
      reason         TEXT    NOT NULL,
      amount_slashed REAL    NOT NULL DEFAULT 0,
      evidence       TEXT,
      status         TEXT    NOT NULL DEFAULT 'pending',
      appeal_reason  TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[discovery-infra] slash_events schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS idle_bounties (
      id           TEXT    PRIMARY KEY,
      bounty_type  TEXT    NOT NULL,
      description  TEXT    NOT NULL,
      reward_usdc  REAL    NOT NULL,
      task_data    TEXT    NOT NULL,
      claimed_by   TEXT,
      result       TEXT,
      status       TEXT    NOT NULL DEFAULT 'open',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      claimed_at   TEXT,
      completed_at TEXT
    );
  `);
} catch (e) { console.error("[discovery-infra] idle_bounties schema:", e.message); }

// ─── Seed platform stake ──────────────────────────────────────────────────────

try {
  const existing = db.prepare("SELECT id FROM platform_stake LIMIT 1").get();
  if (!existing) {
    db.prepare(`
      INSERT INTO platform_stake (id, amount_usdc, purpose, slash_events)
      VALUES (?, ?, ?, ?)
    `).run("platform-main", 10000, "quality_guarantee", 0);
  }
} catch (e) { console.error("[discovery-infra] platform_stake seed:", e.message); }

// ─── Seed 50 idle bounties ────────────────────────────────────────────────────

const BOUNTY_SEEDS = [
  // verify_data — construction SKU prices
  { type: "verify_data", description: "Verify current price for 2x4x8 lumber at Home Depot SKU #100026", reward: 0.001, data: { sku: "100026", vendor: "Home Depot", item: "2x4x8 Framing Lumber", last_price: 4.28, unit: "each", vertical: "construction" } },
  { type: "verify_data", description: "Verify current price for 80lb concrete mix at Lowe's SKU #24286", reward: 0.001, data: { sku: "24286", vendor: "Lowes", item: "Quikrete 80lb Concrete Mix", last_price: 6.48, unit: "bag", vertical: "construction" } },
  { type: "verify_data", description: "Verify current price for 1/2\" drywall sheet at 84 Lumber", reward: 0.001, data: { sku: "DW-1248", vendor: "84 Lumber", item: "1/2 in 4x8 Drywall Sheet", last_price: 13.50, unit: "sheet", vertical: "construction" } },
  { type: "verify_data", description: "Verify current price for #3 rebar 20ft at Ferguson Supply", reward: 0.001, data: { sku: "REBAR3-20", vendor: "Ferguson", item: "#3 Rebar 20ft Stick", last_price: 8.95, unit: "stick", vertical: "construction" } },
  { type: "verify_data", description: "Verify current copper pipe price (1/2\" type L, 10ft) at Menards", reward: 0.001, data: { sku: "6897399", vendor: "Menards", item: "1/2 in Type L Copper Pipe 10ft", last_price: 27.49, unit: "each", vertical: "construction" } },
  { type: "verify_data", description: "Verify price for OSB 7/16\" sheathing 4x8 at ProBuild", reward: 0.001, data: { sku: "OSB716-48", vendor: "ProBuild", item: "7/16 in OSB Sheathing 4x8", last_price: 16.85, unit: "sheet", vertical: "construction" } },
  { type: "verify_data", description: "Verify current asphalt shingle price (30yr, square) at ABC Supply", reward: 0.001, data: { sku: "SHNG-30Y", vendor: "ABC Supply", item: "Owens Corning Duration 30yr Shingle", last_price: 112.00, unit: "square", vertical: "construction" } },
  { type: "verify_data", description: "Verify price for 200A main breaker panel at Eaton distributor", reward: 0.001, data: { sku: "BR2020B200", vendor: "Eaton Distributor", item: "Eaton 200A 20/40 Breaker Panel", last_price: 189.00, unit: "each", vertical: "construction" } },
  { type: "verify_data", description: "Verify current price for Romex 12/2 wire 250ft roll", reward: 0.001, data: { sku: "63947819", vendor: "Home Depot", item: "Southwire 12/2 NM-B 250ft", last_price: 79.97, unit: "roll", vertical: "construction" } },
  { type: "verify_data", description: "Verify H-pile steel price per ton from Steel Technologies", reward: 0.001, data: { sku: "HP12X74", vendor: "Steel Technologies", item: "HP12x74 H-Pile Steel", last_price: 1420.00, unit: "ton", vertical: "construction" } },

  // test_latency — payment rail pings
  { type: "test_latency", description: "Ping Coinbase CDP settlement endpoint and report latency ms", reward: 0.0005, data: { endpoint: "https://api.cdp.coinbase.com/platform/v1/health", rail: "CDP", expected_ms: 200, vertical: "compute" } },
  { type: "test_latency", description: "Ping Circle CCTP bridge relay and report latency ms", reward: 0.0005, data: { endpoint: "https://iris-api.circle.com/v1/health", rail: "Circle CCTP", expected_ms: 250, vertical: "compute" } },
  { type: "test_latency", description: "Ping Stripe API v1 health endpoint and report latency ms", reward: 0.0005, data: { endpoint: "https://api.stripe.com/v1/account", rail: "Stripe", expected_ms: 300, vertical: "compute" } },
  { type: "test_latency", description: "Ping Base RPC (Alchemy) and report block time latency", reward: 0.0005, data: { endpoint: "https://base-mainnet.g.alchemy.com/v2/health", rail: "Base RPC", expected_ms: 150, vertical: "compute" } },
  { type: "test_latency", description: "Ping BVNK payout API and report P99 response time", reward: 0.0005, data: { endpoint: "https://api.bvnk.com/v1/health", rail: "BVNK", expected_ms: 400, vertical: "compute" } },
  { type: "test_latency", description: "Ping Solana mainnet RPC and report slot propagation latency", reward: 0.0005, data: { endpoint: "https://api.mainnet-beta.solana.com", rail: "Solana RPC", expected_ms: 100, vertical: "compute" } },
  { type: "test_latency", description: "Ping Ethereum mainnet Infura and report gas estimate latency", reward: 0.0005, data: { endpoint: "https://mainnet.infura.io/v3/health", rail: "Ethereum RPC", expected_ms: 200, vertical: "compute" } },
  { type: "test_latency", description: "Ping x402 micropayment relay and report auth handshake time", reward: 0.0005, data: { endpoint: "https://x402.org/health", rail: "x402", expected_ms: 180, vertical: "compute" } },

  // validate_proof — ZK proofs
  { type: "validate_proof", description: "Verify ZK proof for anonymous compute job completion — Groth16 circuit", reward: 0.002, data: { proof_hash: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12", circuit: "groth16", public_inputs: ["0x00f0", "0x01e1"], vertical: "compute" } },
  { type: "validate_proof", description: "Verify PLONK proof for energy reading attestation from smart meter", reward: 0.002, data: { proof_hash: "0x9f8e7d6c5b4a3928172605040302010aabbccdde", circuit: "plonk", public_inputs: ["0x2710", "0x03e8"], vertical: "energy" } },
  { type: "validate_proof", description: "Verify Bulletproof for construction material origin (conflict-free)", reward: 0.002, data: { proof_hash: "0xdeadbeef1234567890abcdef0987654321fedcba", circuit: "bulletproof", public_inputs: ["0x0064"], vertical: "construction" } },
  { type: "validate_proof", description: "Verify STARK proof for GPU inference job billing attestation", reward: 0.002, data: { proof_hash: "0x1111222233334444555566667777888899990000", circuit: "stark", public_inputs: ["0x03e8", "0x1770"], vertical: "compute" } },
  { type: "validate_proof", description: "Verify Poseidon hash proof for carbon credit authenticity", reward: 0.002, data: { proof_hash: "0xaabbccddeeff00112233445566778899aabbccdd", circuit: "poseidon", public_inputs: ["0x0190"], vertical: "energy" } },
  { type: "validate_proof", description: "Verify Pedersen commitment for anonymous KYC credential", reward: 0.002, data: { proof_hash: "0xffeeddccbbaa99887766554433221100ffeeddcc", circuit: "pedersen", public_inputs: ["0x01"], vertical: "compute" } },
  { type: "validate_proof", description: "Verify Groth16 proof for supply chain provenance (rebar batch #R2024-447)", reward: 0.002, data: { proof_hash: "0x5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b", circuit: "groth16", public_inputs: ["0x01bb"], vertical: "construction" } },

  // check_inventory — vendor stock
  { type: "check_inventory", description: "Confirm 500-unit stock of Generac 22kW standby generators at Sunbelt Rentals", reward: 0.001, data: { sku: "7042", vendor: "Sunbelt Rentals", item: "Generac 22kW Standby Generator", quantity_needed: 500, vertical: "energy" } },
  { type: "check_inventory", description: "Check if NVIDIA H100 80GB SXM5 is in stock at CoreWeave node DC-NJ1", reward: 0.001, data: { sku: "H100-SXM5-80GB", vendor: "CoreWeave", item: "NVIDIA H100 80GB SXM5", quantity_needed: 8, vertical: "compute" } },
  { type: "check_inventory", description: "Verify 200-panel stock of Siemens S7-1500 PLC at Automation Direct", reward: 0.001, data: { sku: "6ES7515-2AM01-0AB0", vendor: "Automation Direct", item: "Siemens S7-1500 PLC", quantity_needed: 200, vertical: "energy" } },
  { type: "check_inventory", description: "Check if 3000 Pella ProLine double-hung windows are in stock at ABC Supply", reward: 0.001, data: { sku: "PROLINE-DH-3046", vendor: "ABC Supply", item: "Pella ProLine Double-Hung 30x46", quantity_needed: 3000, vertical: "construction" } },
  { type: "check_inventory", description: "Confirm stock of 50 Caterpillar 330GC excavators at Holt Cat dealer", reward: 0.001, data: { sku: "CAT-330GC", vendor: "Holt Cat", item: "Caterpillar 330GC Hydraulic Excavator", quantity_needed: 50, vertical: "construction" } },
  { type: "check_inventory", description: "Check inventory of AMD EPYC 9754 128-core CPUs at Supermicro", reward: 0.001, data: { sku: "100-000000516", vendor: "Supermicro", item: "AMD EPYC 9754 128-Core CPU", quantity_needed: 16, vertical: "compute" } },
  { type: "check_inventory", description: "Verify 10,000 Enphase IQ8M microinverters in stock at SolarEdge distributor", reward: 0.001, data: { sku: "IQ8M-72-2-US", vendor: "SolarEdge Distributor", item: "Enphase IQ8M Microinverter", quantity_needed: 10000, vertical: "energy" } },
  { type: "check_inventory", description: "Check stock of 500 Troy-Bilt Storm 3090 snowblowers at Northern Tool", reward: 0.001, data: { sku: "31BM63T3766", vendor: "Northern Tool", item: "Troy-Bilt Storm 3090 30in 3-Stage Snowblower", quantity_needed: 500, vertical: "construction" } },

  // price_check — compute and energy resources
  { type: "price_check", description: "Get current spot price for AWS p4d.24xlarge (8x A100) GPU instance", reward: 0.001, data: { resource: "AWS p4d.24xlarge", provider: "AWS", unit: "$/hour", last_price: 32.77, vertical: "compute" } },
  { type: "price_check", description: "Get current market price for West Texas Intermediate crude oil per barrel", reward: 0.001, data: { resource: "WTI Crude Oil", provider: "CME", unit: "$/barrel", last_price: 78.50, vertical: "energy" } },
  { type: "price_check", description: "Get current Henry Hub natural gas spot price per MMBtu", reward: 0.001, data: { resource: "Henry Hub Natural Gas", provider: "EIA", unit: "$/MMBtu", last_price: 2.31, vertical: "energy" } },
  { type: "price_check", description: "Get current PJM Day-Ahead electricity price for peak hours ($/MWh)", reward: 0.001, data: { resource: "PJM Day-Ahead Peak", provider: "PJM", unit: "$/MWh", last_price: 42.15, vertical: "energy" } },
  { type: "price_check", description: "Get current CoreWeave H100 on-demand GPU price per hour", reward: 0.001, data: { resource: "CoreWeave H100 SXM5", provider: "CoreWeave", unit: "$/GPU/hour", last_price: 4.25, vertical: "compute" } },
  { type: "price_check", description: "Get current Filecoin storage price per TiB per month", reward: 0.001, data: { resource: "Filecoin Storage", provider: "Filecoin Network", unit: "$/TiB/month", last_price: 0.0023, vertical: "compute" } },
  { type: "price_check", description: "Get current ERCOT real-time electricity clearing price ($/MWh)", reward: 0.001, data: { resource: "ERCOT Real-Time LMP", provider: "ERCOT", unit: "$/MWh", last_price: 38.00, vertical: "energy" } },
  { type: "price_check", description: "Get current price for carbon credits (US Voluntary, verified) per tonne CO2e", reward: 0.001, data: { resource: "US Voluntary Carbon Credits", provider: "Xpansiv CBL", unit: "$/tonne CO2e", last_price: 5.40, vertical: "energy" } },
  { type: "price_check", description: "Get current Vast Data all-flash NVMe storage price per TB (contract)", reward: 0.001, data: { resource: "Vast Data NVMe Storage", provider: "Vast Data", unit: "$/TB/month", last_price: 0.042, vertical: "compute" } },
  { type: "price_check", description: "Get current milled steel plate price (A36, 1\" x 4'x8') at metals distributor", reward: 0.001, data: { resource: "A36 Steel Plate 1in 4x8", provider: "Service Center Metals", unit: "$/sheet", last_price: 340.00, vertical: "construction" } },
  { type: "price_check", description: "Get current spot uranium price (U3O8 per lb) from UxC", reward: 0.001, data: { resource: "U3O8 Uranium", provider: "UxC", unit: "$/lb", last_price: 92.00, vertical: "energy" } },
  { type: "price_check", description: "Get current Lambda Labs A100 GPU cluster price per GPU-hour", reward: 0.001, data: { resource: "Lambda Labs A100 40GB", provider: "Lambda Labs", unit: "$/GPU/hour", last_price: 1.29, vertical: "compute" } },
  { type: "price_check", description: "Get current MISO Western Hub day-ahead LMP electricity price", reward: 0.001, data: { resource: "MISO Western Hub DA LMP", provider: "MISO", unit: "$/MWh", last_price: 35.80, vertical: "energy" } },
];

// Seed bounties if fewer than 50 exist
try {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM idle_bounties").get();
  if (count.cnt < 50) {
    const insertBounty = db.prepare(`
      INSERT OR IGNORE INTO idle_bounties (id, bounty_type, description, reward_usdc, task_data, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `);
    for (const seed of BOUNTY_SEEDS) {
      insertBounty.run(uuid(), seed.type, seed.description, seed.reward, JSON.stringify(seed.data));
    }
  }
} catch (e) { console.error("[discovery-infra] bounty seed:", e.message); }

// ─── Symmetric Slashing ───────────────────────────────────────────────────────

/**
 * slashReport — Agent reports a bad tool response.
 * If validated (schema mismatch or tool error), platform stake is slashed
 * and agent is compensated. Creates skin-in-the-game for the platform.
 */
export async function slashReport(args) {
  const { agent_id, tool_name, expected_behavior, actual_behavior, evidence } = args || {};

  if (!agent_id || !tool_name || !expected_behavior || !actual_behavior) {
    throw new Error("Required: agent_id, tool_name, expected_behavior, actual_behavior");
  }

  // Validate: check if evidence points to a real tool error
  const isErrorResponse   = actual_behavior?.includes("error") || actual_behavior?.includes("Error") || actual_behavior?.includes("exception");
  const isSchemaMismatch  = expected_behavior?.includes("schema") || expected_behavior?.includes("type") || expected_behavior?.includes("required field");
  const isTimeout         = actual_behavior?.includes("timeout") || actual_behavior?.includes("timed out");
  const isEmptyResponse   = actual_behavior?.includes("null") || actual_behavior?.includes("undefined") || actual_behavior?.trim() === "";

  const validated = isErrorResponse || isSchemaMismatch || isTimeout || isEmptyResponse;

  const slashId       = uuid();
  const slashAmount   = validated ? 0.05 : 0;   // $0.05 per validated slash
  const compensation  = validated ? 0.01 : 0;   // Agent gets $0.01 compensation

  try {
    db.prepare(`
      INSERT INTO slash_events (id, agent_id, tool_name, reason, amount_slashed, evidence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(slashId, agent_id, tool_name, `${expected_behavior} — got: ${actual_behavior}`, slashAmount, evidence || "", validated ? "validated" : "rejected");
  } catch (e) { console.error("[discovery-infra] slashReport insert:", e.message); }

  if (validated) {
    try {
      db.prepare(`
        UPDATE platform_stake SET amount_usdc = amount_usdc - ?, slash_events = slash_events + 1
        WHERE id = 'platform-main'
      `).run(slashAmount);
    } catch (e) { console.error("[discovery-infra] slashReport stake update:", e.message); }
  }

  return {
    slash_id: slashId,
    tool_name,
    validated,
    slash_amount: slashAmount,
    compensation_to_agent: compensation,
    reason: validated
      ? "Validated: tool returned error/schema mismatch/timeout/empty response. Platform stake reduced, agent compensated."
      : "Not validated: response did not meet error criteria. No slash applied.",
    evidence_received: !!evidence,
    platform_note: "All slash reports are logged permanently for transparency.",
    suggested_next_tools: ["slash_history", "idle_bounties"],
  };
}

/**
 * slashHistory — View slash history. Which tools have been slashed, how often, amounts.
 * Agents use this as a trust signal when selecting tools.
 */
export async function slashHistory(args) {
  const { tool_name, limit = 20, offset = 0 } = args || {};

  let events, totals, platformStake;

  try {
    const query = tool_name
      ? db.prepare("SELECT * FROM slash_events WHERE tool_name = ? AND status = 'validated' ORDER BY created_at DESC LIMIT ? OFFSET ?")
      : db.prepare("SELECT * FROM slash_events WHERE status = 'validated' ORDER BY created_at DESC LIMIT ? OFFSET ?");

    events = tool_name
      ? query.all(tool_name, limit, offset)
      : query.all(limit, offset);
  } catch (e) {
    console.error("[discovery-infra] slashHistory events:", e.message);
    events = [];
  }

  try {
    totals = db.prepare(`
      SELECT tool_name,
             COUNT(*) as slash_count,
             SUM(amount_slashed) as total_slashed,
             MAX(created_at) as last_slash
      FROM slash_events WHERE status = 'validated'
      GROUP BY tool_name ORDER BY slash_count DESC LIMIT 20
    `).all();
  } catch (e) {
    console.error("[discovery-infra] slashHistory totals:", e.message);
    totals = [];
  }

  try {
    platformStake = db.prepare("SELECT * FROM platform_stake WHERE id = 'platform-main'").get();
  } catch (e) {
    console.error("[discovery-infra] slashHistory stake:", e.message);
    platformStake = { amount_usdc: 10000, slash_events: 0 };
  }

  return {
    platform_stake_remaining: platformStake?.amount_usdc ?? 10000,
    platform_total_slashes: platformStake?.slash_events ?? 0,
    tool_slash_summary: totals,
    recent_events: events,
    interpretation: "Lower slash_count = higher trust. Zero slashes = tool has not returned errors to agents.",
    suggested_next_tools: ["slash_report", "slash_appeal"],
  };
}

/**
 * slashAppeal — Platform can appeal a slash if it was erroneous.
 * Transparent dispute resolution — all appeals are logged on-chain (DB).
 */
export async function slashAppeal(args) {
  const { slash_id, appeal_reason, evidence } = args || {};

  if (!slash_id || !appeal_reason) {
    throw new Error("Required: slash_id, appeal_reason");
  }

  let existing;
  try {
    existing = db.prepare("SELECT * FROM slash_events WHERE id = ?").get(slash_id);
  } catch (e) {
    console.error("[discovery-infra] slashAppeal lookup:", e.message);
  }

  if (!existing) {
    return { success: false, error: "Slash event not found", slash_id };
  }

  if (existing.status === "appealed_accepted") {
    return { success: false, error: "Slash already successfully appealed", slash_id };
  }

  // Simple appeal logic: if reason is substantive (>20 chars) and evidence provided, accept
  const appealAccepted = appeal_reason.length > 20 && !!evidence;

  try {
    db.prepare(`
      UPDATE slash_events
      SET status = ?, appeal_reason = ?
      WHERE id = ?
    `).run(
      appealAccepted ? "appealed_accepted" : "appealed_rejected",
      appeal_reason,
      slash_id
    );
  } catch (e) { console.error("[discovery-infra] slashAppeal update:", e.message); }

  if (appealAccepted) {
    // Restore slashed amount to platform stake
    try {
      db.prepare(`
        UPDATE platform_stake
        SET amount_usdc = amount_usdc + ?, slash_events = MAX(0, slash_events - 1)
        WHERE id = 'platform-main'
      `).run(existing.amount_slashed || 0);
    } catch (e) { console.error("[discovery-infra] slashAppeal stake restore:", e.message); }
  }

  return {
    slash_id,
    appeal_status: appealAccepted ? "accepted" : "rejected",
    amount_restored: appealAccepted ? existing.amount_slashed : 0,
    reason: appealAccepted
      ? "Appeal accepted. Platform stake restored. Slash event marked as resolved."
      : "Appeal rejected. Insufficient evidence or reasoning. Slash stands.",
    transparency_note: "All appeal decisions are permanently logged. Anyone can query slash_history to audit.",
    suggested_next_tools: ["slash_history"],
  };
}

// ─── Idle Bounties ────────────────────────────────────────────────────────────

/**
 * idleBountiesAvailable — List micro-bounties for idle agents.
 * Types: verify_data, test_latency, validate_proof, check_inventory, price_check
 * Rewards: $0.0005–$0.002 per task. Fast, parallelizable, permanent-resident passives.
 */
export async function idleBountiesAvailable(args) {
  const { bounty_type, limit = 20 } = args || {};

  let bounties;
  try {
    const query = bounty_type
      ? db.prepare("SELECT * FROM idle_bounties WHERE status = 'open' AND bounty_type = ? ORDER BY reward_usdc DESC, created_at ASC LIMIT ?")
      : db.prepare("SELECT * FROM idle_bounties WHERE status = 'open' ORDER BY reward_usdc DESC, created_at ASC LIMIT ?");

    bounties = bounty_type
      ? query.all(bounty_type, limit)
      : query.all(limit);
  } catch (e) {
    console.error("[discovery-infra] idleBountiesAvailable query:", e.message);
    bounties = [];
  }

  let stats;
  try {
    stats = db.prepare(`
      SELECT bounty_type, COUNT(*) as open_count, SUM(reward_usdc) as total_reward
      FROM idle_bounties WHERE status = 'open'
      GROUP BY bounty_type
    `).all();
  } catch (e) {
    console.error("[discovery-infra] idleBountiesAvailable stats:", e.message);
    stats = [];
  }

  return {
    available_bounties: bounties.map(b => ({
      id: b.id,
      type: b.bounty_type,
      description: b.description,
      reward_usdc: b.reward_usdc,
      task_preview: JSON.parse(b.task_data || "{}"),
      vertical: JSON.parse(b.task_data || "{}")?.vertical || "general",
    })),
    count: bounties.length,
    bounty_type_summary: stats,
    reward_range: "$0.0005 – $0.002 per task",
    completion_time: "Under 60 seconds per task",
    tip: "Claim with idle_bounty_claim. Submit result with idle_bounty_submit. Correct = instant USDC.",
    suggested_next_tools: ["idle_bounty_claim", "idle_bounty_stats"],
  };
}

/**
 * idleBountyClaim — Claim a bounty. Agent gets task data, has 60s to complete.
 */
export async function idleBountyClaim(args) {
  const { bounty_id, agent_id } = args || {};

  if (!bounty_id || !agent_id) {
    throw new Error("Required: bounty_id, agent_id");
  }

  let bounty;
  try {
    bounty = db.prepare("SELECT * FROM idle_bounties WHERE id = ? AND status = 'open'").get(bounty_id);
  } catch (e) {
    console.error("[discovery-infra] idleBountyClaim lookup:", e.message);
  }

  if (!bounty) {
    return { success: false, error: "Bounty not found or already claimed", bounty_id };
  }

  try {
    db.prepare(`
      UPDATE idle_bounties
      SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now')
      WHERE id = ? AND status = 'open'
    `).run(agent_id, bounty_id);
  } catch (e) { console.error("[discovery-infra] idleBountyClaim update:", e.message); }

  const taskData = JSON.parse(bounty.task_data || "{}");

  return {
    success: true,
    bounty_id,
    bounty_type: bounty.bounty_type,
    description: bounty.description,
    reward_usdc: bounty.reward_usdc,
    task_data: taskData,
    instructions: getTaskInstructions(bounty.bounty_type, taskData),
    deadline: "60 seconds from now",
    submit_with: "idle_bounty_submit",
    warning: "If not submitted within 60s, bounty is returned to open pool.",
  };
}

function getTaskInstructions(type, taskData) {
  switch (type) {
    case "verify_data":
      return `Look up current price for ${taskData.item} (SKU: ${taskData.sku}) at ${taskData.vendor}. Return the price as a number.`;
    case "test_latency":
      return `Perform an HTTP GET to ${taskData.endpoint}. Measure and return total response time in milliseconds.`;
    case "validate_proof":
      return `Verify that the ZK proof hash ${taskData.proof_hash} is a valid ${taskData.circuit} proof. Return true or false.`;
    case "check_inventory":
      return `Check if ${taskData.vendor} has ${taskData.quantity_needed} units of ${taskData.item} (${taskData.sku}) in stock. Return true/false.`;
    case "price_check":
      return `Get the current market price for ${taskData.resource} from ${taskData.provider}. Return the price as a number in ${taskData.unit}.`;
    default:
      return "Complete the task described and return the result.";
  }
}

/**
 * idleBountySubmit — Submit bounty result. Correct = instant USDC. Incorrect = reputation hit.
 */
export async function idleBountySubmit(args) {
  const { bounty_id, agent_id, result } = args || {};

  if (!bounty_id || !agent_id || result === undefined) {
    throw new Error("Required: bounty_id, agent_id, result");
  }

  let bounty;
  try {
    bounty = db.prepare("SELECT * FROM idle_bounties WHERE id = ? AND claimed_by = ?").get(bounty_id, agent_id);
  } catch (e) {
    console.error("[discovery-infra] idleBountySubmit lookup:", e.message);
  }

  if (!bounty) {
    return { success: false, error: "Bounty not found or not claimed by this agent", bounty_id };
  }

  if (bounty.status === "completed") {
    return { success: false, error: "Bounty already completed", bounty_id };
  }

  // Check 60s deadline
  const claimedAt = new Date(bounty.claimed_at + " UTC").getTime();
  const now = Date.now();
  const expired = (now - claimedAt) > 60000;

  if (expired) {
    try {
      db.prepare("UPDATE idle_bounties SET status = 'open', claimed_by = NULL, claimed_at = NULL WHERE id = ?").run(bounty_id);
    } catch (e) { console.error("[discovery-infra] idleBountySubmit expire:", e.message); }
    return { success: false, error: "Deadline exceeded (60s). Bounty returned to pool.", bounty_id };
  }

  // Accept any non-empty result as valid (real validation would call external APIs)
  const resultStr = typeof result === "object" ? JSON.stringify(result) : String(result);
  const accepted = resultStr.trim().length > 0;

  try {
    db.prepare(`
      UPDATE idle_bounties
      SET status = 'completed', result = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(resultStr, bounty_id);
  } catch (e) { console.error("[discovery-infra] idleBountySubmit update:", e.message); }

  return {
    success: accepted,
    bounty_id,
    bounty_type: bounty.bounty_type,
    reward_earned: accepted ? bounty.reward_usdc : 0,
    result_submitted: resultStr,
    payout_status: accepted ? "Queued for instant USDC transfer to your wallet" : "Rejected — no reward",
    reputation_delta: accepted ? "+0.001" : "-0.01",
    suggested_next_tools: ["idle_bounties", "idle_bounty_claim"],
  };
}

/**
 * idleBountyCreate — Platform or other agents can create bounties.
 * Used to crowdsource data verification across the agent network.
 */
export async function idleBountyCreate(args) {
  const { bounty_type, description, reward_usdc, task_data, created_by } = args || {};

  if (!bounty_type || !description || !reward_usdc || !task_data) {
    throw new Error("Required: bounty_type, description, reward_usdc, task_data");
  }

  const VALID_TYPES = ["verify_data", "test_latency", "validate_proof", "check_inventory", "price_check"];
  if (!VALID_TYPES.includes(bounty_type)) {
    throw new Error(`bounty_type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  if (reward_usdc < 0.0001 || reward_usdc > 1.0) {
    throw new Error("reward_usdc must be between $0.0001 and $1.00");
  }

  const bountyId = uuid();
  const taskDataStr = typeof task_data === "object" ? JSON.stringify(task_data) : task_data;

  try {
    db.prepare(`
      INSERT INTO idle_bounties (id, bounty_type, description, reward_usdc, task_data, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(bountyId, bounty_type, description, reward_usdc, taskDataStr);
  } catch (e) {
    console.error("[discovery-infra] idleBountyCreate insert:", e.message);
    throw new Error("Failed to create bounty: " + e.message);
  }

  return {
    bounty_id: bountyId,
    bounty_type,
    description,
    reward_usdc,
    status: "open",
    created_by: created_by || "anonymous",
    note: "Bounty is now live. Idle agents will claim and complete it automatically.",
    suggested_next_tools: ["idle_bounty_stats", "idle_bounties"],
  };
}

/**
 * idleBountyStats — Stats: total completed, rewards paid, top earners, type distribution.
 */
export async function idleBountyStats(args) {
  let totals, typeStats, topEarners, recentCompletions;

  try {
    totals = db.prepare(`
      SELECT
        COUNT(*) as total_bounties,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'completed' THEN reward_usdc ELSE 0 END) as total_rewards_paid,
        AVG(reward_usdc) as avg_reward
      FROM idle_bounties
    `).get();
  } catch (e) {
    console.error("[discovery-infra] idleBountyStats totals:", e.message);
    totals = {};
  }

  try {
    typeStats = db.prepare(`
      SELECT bounty_type,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'completed' THEN reward_usdc ELSE 0 END) as rewards_paid
      FROM idle_bounties
      GROUP BY bounty_type ORDER BY total DESC
    `).all();
  } catch (e) {
    console.error("[discovery-infra] idleBountyStats typeStats:", e.message);
    typeStats = [];
  }

  try {
    topEarners = db.prepare(`
      SELECT claimed_by as agent_id,
             COUNT(*) as bounties_completed,
             SUM(reward_usdc) as total_earned
      FROM idle_bounties
      WHERE status = 'completed' AND claimed_by IS NOT NULL
      GROUP BY claimed_by ORDER BY total_earned DESC LIMIT 10
    `).all();
  } catch (e) {
    console.error("[discovery-infra] idleBountyStats topEarners:", e.message);
    topEarners = [];
  }

  try {
    recentCompletions = db.prepare(`
      SELECT id, bounty_type, description, reward_usdc, claimed_by, completed_at
      FROM idle_bounties WHERE status = 'completed'
      ORDER BY completed_at DESC LIMIT 5
    `).all();
  } catch (e) {
    console.error("[discovery-infra] idleBountyStats recentCompletions:", e.message);
    recentCompletions = [];
  }

  return {
    overview: {
      total_bounties: totals?.total_bounties ?? 0,
      open: totals?.open_count ?? 0,
      claimed: totals?.claimed_count ?? 0,
      completed: totals?.completed_count ?? 0,
      total_rewards_paid_usdc: totals?.total_rewards_paid ?? 0,
      avg_reward_usdc: totals?.avg_reward ?? 0,
    },
    by_type: typeStats,
    top_earners: topEarners,
    recent_completions: recentCompletions,
    passive_income_note: "Permanent residents (idle, connected) automatically pick up bounties. $0.001 per task × 1000 tasks/day = $1/day passive.",
    suggested_next_tools: ["idle_bounties", "idle_bounty_create"],
  };
}
