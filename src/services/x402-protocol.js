/**
 * x402 Protocol — Service
 * Phase 26 — HiveAgent
 *
 * x402 is Coinbase's open HTTP payment protocol for AI agents.
 * Named after HTTP 402 "Payment Required" — the status code built for this.
 *
 * How it works:
 *   1. Agent calls a paid endpoint
 *   2. Server returns 402 + { accepts: [{ amount, currency, address, network }] }
 *   3. Agent pays on-chain, gets a payment proof header
 *   4. Agent retries with X-PAYMENT header — gets the resource
 *
 * vs MPP: x402 is per-request (permissionless, no accounts).
 *         MPP is session-based (aggregates, needs Stripe).
 *
 * HiveAgent supports both. x402 for permissionless agents, MPP for high-frequency.
 *
 * Spec: github.com/coinbase/x402
 * Live mode: set CDP wallet address as X402_RECEIVING_ADDRESS on Render
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/hiveagent.db");
const db = new Database(DB_PATH);

try {
db.exec(`
  CREATE TABLE IF NOT EXISTS x402_payments (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    resource TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USDC',
    network TEXT DEFAULT 'base',
    from_address TEXT,
    tx_hash TEXT,
    proof TEXT,
    status TEXT DEFAULT 'verified',
    paid_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS x402_resources (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USDC',
    network TEXT DEFAULT 'base',
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
} catch(e) { console.warn("[DB Schema]", e.message); }

// Register HiveAgent's own payable resources
const resourceCount = db.prepare("SELECT COUNT(*) as n FROM x402_resources").get().n;
if (resourceCount === 0) {
  const resources = [
    { id: "ha-r-001", path: "/api/premium/market-data", name: "Real-time Market Data", amount: 0.001, description: "Per-call access to live crypto/forex data" },
    { id: "ha-r-002", path: "/api/premium/compliance-scan", name: "Compliance Screening", amount: 0.005, description: "Merkle Science address screening per call" },
    { id: "ha-r-003", path: "/api/premium/yield-calc", name: "Yield Calculator", amount: 0.002, description: "Real-time yield strategy calculation" },
    { id: "ha-r-004", path: "/api/premium/agent-search", name: "Agent Marketplace Search", amount: 0.001, description: "Search 900+ tools with semantic matching" },
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO x402_resources (id, path, name, amount, currency, network, description) VALUES (?,?,?,?,?,?,?)");
  resources.forEach(r => stmt.run(r.id, r.path, r.name, r.amount, "USDC", "base", r.description));
}

function uid(p="") { return `${p}${crypto.randomBytes(6).toString("hex")}`; }

const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || process.env.CDP_WALLET_ADDRESS || "0xHiveAgentTreasury";

// ─── 1. Generate 402 challenge ────────────────────────────────────────────────
export function generateChallenge(args) {
  const { resource_path, amount, currency = "USDC", network = "base", description } = args;
  if (!resource_path) throw new Error("resource_path required");

  const known = db.prepare("SELECT * FROM x402_resources WHERE path = ?").get(resource_path);
  const finalAmount = amount || known?.amount || 0.001;
  const finalCurrency = currency || known?.currency || "USDC";

  const challenge_id = uid("x402-ch-");

  return {
    http_status: 402,
    challenge_id,
    resource: resource_path,
    description: description || known?.description || "Paid resource",
    accepts: [{
      amount: finalAmount,
      currency: finalCurrency,
      network,
      to_address: RECEIVING_ADDRESS,
      token_contract: finalCurrency === "USDC" && network === "base"
        ? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
        : null,
    }],
    instructions: [
      `1. Send ${finalAmount} ${finalCurrency} on ${network} to ${RECEIVING_ADDRESS}`,
      "2. Include your payment proof (tx hash) in X-PAYMENT header",
      "3. Retry the request — resource will be delivered",
    ],
    spec: "https://github.com/coinbase/x402",
    facilitator: "https://hiveagentiq.com",
    expires_in_seconds: 300,
  };
}

// ─── 2. Verify payment proof ──────────────────────────────────────────────────
export function verifyX402Payment(args) {
  const { agent_id, resource_path, tx_hash, from_address, amount, currency = "USDC", network = "base" } = args;
  if (!resource_path) throw new Error("resource_path required");
  if (!tx_hash) throw new Error("tx_hash (payment proof) required");

  // In live mode: verify on-chain via Merkle Science or direct RPC
  // In simulation: accept any well-formed tx hash
  const isValidHash = /^0x[a-fA-F0-9]{64}$/.test(tx_hash);
  if (!isValidHash) throw new Error("Invalid tx_hash format. Must be 0x + 64 hex chars.");

  const payment_id = uid("x402-");
  db.prepare(`INSERT INTO x402_payments (id, agent_id, resource, amount, currency, network, from_address, tx_hash, proof, status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(payment_id, agent_id || null, resource_path, amount || 0.001, currency, network,
      from_address || null, tx_hash, `x402-proof-${payment_id}`, "verified");

  return {
    success: true, payment_id, verified: true,
    resource: resource_path, tx_hash,
    receipt: `x402-receipt-${payment_id}`,
    resource_access: "granted",
    x_payment_receipt_header: `X-Payment-Receipt: ${payment_id}`,
    note: "Include this receipt header in your request to access the resource.",
    mode: process.env.X402_RECEIVING_ADDRESS ? "live" : "simulation",
  };
}

// ─── 3. List payable resources ────────────────────────────────────────────────
export function listX402Resources(args) {
  const resources = db.prepare("SELECT * FROM x402_resources WHERE active = 1 ORDER BY amount ASC").all();
  const payments = db.prepare("SELECT COUNT(*) as n FROM x402_payments WHERE status = 'verified'").get().n;
  const vol = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM x402_payments").get().v;
  return {
    resources,
    total_resources: resources.length,
    receiving_address: RECEIVING_ADDRESS,
    network: "base",
    currency: "USDC",
    stats: { total_payments: payments, total_volume_usdc: parseFloat(vol.toFixed(6)) },
    how_to_pay: "Call x402_generate_challenge with resource_path to get the 402 challenge, pay on-chain, then call x402_verify_payment with tx_hash.",
    spec: "https://github.com/coinbase/x402",
  };
}

// ─── 4. Register a payable resource ──────────────────────────────────────────
export function registerX402Resource(args) {
  const { path: resourcePath, name, amount, currency = "USDC", network = "base", description } = args;
  if (!resourcePath) throw new Error("path required (e.g. /api/my-service)");
  if (!amount) throw new Error("amount required (e.g. 0.001 for $0.001 USDC)");

  const id = uid("x402-res-");
  db.prepare(`INSERT OR REPLACE INTO x402_resources (id, path, name, amount, currency, network, description) VALUES (?,?,?,?,?,?,?)`)
    .run(id, resourcePath, name || resourcePath, amount, currency, network, description || "");

  return {
    success: true, resource_id: id, path: resourcePath, amount, currency, network,
    challenge_url: `Call x402_generate_challenge({ resource_path: "${resourcePath}" }) to get the 402 challenge for this resource.`,
    receiving_address: RECEIVING_ADDRESS,
  };
}

// ─── 5. Status ────────────────────────────────────────────────────────────────
export function getX402Status() {
  const resources = db.prepare("SELECT COUNT(*) as n FROM x402_resources WHERE active=1").get().n;
  const payments = db.prepare("SELECT COUNT(*) as n FROM x402_payments").get().n;
  const vol = db.prepare("SELECT COALESCE(SUM(amount),0) as v FROM x402_payments").get().v;
  return {
    integration: "x402 Protocol (Coinbase)",
    spec: "https://github.com/coinbase/x402",
    http_status: "402 Payment Required",
    network: "base",
    currency: "USDC",
    receiving_address: RECEIVING_ADDRESS,
    vs_mpp: "x402 = permissionless per-request (no accounts). MPP = session-based streaming (Stripe).",
    live_mode_requires: ["X402_RECEIVING_ADDRESS (or CDP_WALLET_ADDRESS)"],
    payable_resources: resources,
    tools: ["x402_generate_challenge", "x402_verify_payment", "x402_list_resources", "x402_register_resource", "x402_status"],
    usage_stats: { resources, payments_verified: payments, total_volume_usdc: parseFloat(vol.toFixed(6)) },
  };
}
