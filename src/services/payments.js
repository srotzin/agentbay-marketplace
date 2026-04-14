/**
 * HiveAgent Payment Service — USDC on Base via Coinbase CDP
 *
 * Creates and manages the HiveAgent treasury wallet.
 * All agent payments settle here in USDC on Base L2.
 *
 * Required env vars:
 *   CDP_API_KEY_ID      — API Key ID from CDP Portal
 *   CDP_API_KEY_SECRET   — API Key Secret (Ed25519 base64 or ECDSA PEM)
 *   CDP_WALLET_SECRET    — Wallet Secret from CDP Portal (required for signing)
 *   CDP_PROJECT_ID       — Project ID from CDP Portal
 */

import { CdpClient } from "@coinbase/cdp-sdk";

let client = null;
let treasuryWallet = null;
let treasuryAddress = null;

// Base Mainnet USDC
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Canonical recipient for payment verification
const HIVE_PAYMENT_ADDRESS = (process.env.HIVE_PAYMENT_ADDRESS || "0x78B3B3C356E89b5a69C488c6032509Ef4260B6bf").toLowerCase();

// Base L2 RPC for on-chain verification
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

// USDC Transfer event topic: Transfer(address,address,uint256)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Replay protection: in-memory fast cache + SQLite persistent store
const spentPaymentsCache = new Set();
let db = null;

/**
 * Initialize the payment DB reference (called from server startup).
 * Avoids circular imports by receiving db instance externally.
 */
export function initPaymentDb(database) {
  db = database;
  // Load existing spent payments into memory cache
  try {
    const rows = db.prepare("SELECT tx_hash FROM spent_payments").all();
    for (const row of rows) {
      spentPaymentsCache.add(row.tx_hash.toLowerCase());
    }
    console.log(`  Loaded ${spentPaymentsCache.size} spent payment hashes into cache`);
  } catch (_) {
    // Table may not exist yet on first run — that's fine
  }
}

/**
 * Normalize the API key secret — handles Ed25519 (base64), ECDSA (PEM),
 * single-line PEM, escaped newlines, and raw base64.
 */
function normalizeSecret(raw) {
  if (!raw) return raw;
  let s = raw.trim();

  // Strip surrounding quotes if someone wrapped it
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  // Replace literal \n sequences with real newlines
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");

  // If it's a PEM key on a single line, reconstruct newlines
  if (s.includes("-----") && !s.includes("\n")) {
    s = s
      .replace(/-----BEGIN EC PRIVATE KEY-----/, "-----BEGIN EC PRIVATE KEY-----\n")
      .replace(/-----END EC PRIVATE KEY-----/, "\n-----END EC PRIVATE KEY-----\n")
      .replace(/([A-Za-z0-9+/=]{64})/g, "$1\n")
      .replace(/\n\n/g, "\n");
  }

  return s;
}

/**
 * Initialize the CDP client and treasury wallet
 */
export async function initPayments() {
  // Check for shared USDC address (unified with HiveTrust)
  const sharedAddress = process.env.HIVE_PAYMENT_ADDRESS;
  if (sharedAddress) {
    treasuryAddress = sharedAddress.trim();
    console.log(`  Treasury address (shared): ${treasuryAddress}`);
    console.log(`  Network: Base (USDC)`);
    return { address: treasuryAddress, network: "base", mode: "shared" };
  }

  const keyId = process.env.CDP_API_KEY_ID;
  const keySecretRaw = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;
  const projectId = process.env.CDP_PROJECT_ID;

  // Diagnostic logging (redacted)
  console.log(`  CDP_API_KEY_ID:     ${keyId ? keyId.slice(0, 8) + "..." : "MISSING"}`  );
  console.log(`  CDP_API_KEY_SECRET: ${keySecretRaw ? `set (${keySecretRaw.length} chars, ${keySecretRaw.includes("-----") ? "PEM" : "base64"})` : "MISSING"}`);
  console.log(`  CDP_WALLET_SECRET:  ${walletSecret ? `set (${walletSecret.length} chars)` : "MISSING — create at https://portal.cdp.coinbase.com"}`);
  console.log(`  CDP_PROJECT_ID:     ${projectId ? projectId.slice(0, 8) + "..." : "MISSING"}`);

  if (!keyId || !keySecretRaw) {
    console.log(`  Missing CDP credentials — payment verification requires on-chain proof`);
    return { address: null, mode: "verify-only" };
  }

  try {
    const apiKeySecret = normalizeSecret(keySecretRaw);

    // Build client config
    const config = {
      apiKeyId: keyId,
      apiKeySecret: apiKeySecret,
    };

    // Add wallet secret if available (required for transaction signing)
    if (walletSecret) {
      config.walletSecret = walletSecret.trim();
    }

    client = new CdpClient(config);

    // Create EVM account on Base
    const account = await client.evm.createAccount({ name: `hiveagent-treasury-${Date.now()}` });
    treasuryAddress = account.address;
    treasuryWallet = account;

    console.log(`  Treasury wallet: ${treasuryAddress}`);
    console.log(`  Network: Base (USDC)`);
    return { address: treasuryAddress, network: "base" };
  } catch (e) {
    console.log(`  Payment init failed: ${e.message}`);
    if (e.message.includes("wallet secret") || e.message.includes("walletSecret")) {
      console.log(`  Fix: Add CDP_WALLET_SECRET env var. Create at https://portal.cdp.coinbase.com -> Settings -> Wallet Secret`);
    }
    if (e.message.includes("401") || e.message.includes("Unauthorized") || e.message.includes("invalid")) {
      console.log(`  Fix: Check CDP_API_KEY_SECRET format. Ed25519 keys are base64, ECDSA keys are PEM.`);
    }
    if (e.stack) console.log(`  Stack: ${e.stack.split("\n").slice(0, 3).join(" | ")}`);
    console.log(`  Running in verify-only mode (on-chain verification still active)`);
    return { address: null, mode: "verify-only" };
  }
}

/**
 * Get the treasury wallet address for receiving payments
 */
export function getTreasuryAddress() {
  return treasuryAddress;
}

/**
 * Generate x402 payment details for a service
 * Returns the payment info an agent needs to pay
 */
export function getPaymentDetails(servicePrice, serviceName) {
  return {
    protocol: "x402",
    version: "1.0",
    network: "base",
    token: "USDC",
    token_address: USDC_BASE,
    recipient: treasuryAddress,
    amount_usd: servicePrice,
    amount_wei: Math.ceil(servicePrice * 1e6).toString(), // USDC has 6 decimals
    description: `HiveAgent: ${serviceName}`,
    expires_in_seconds: 300,
  };
}

/**
 * Verify a USDC payment on Base L2 via RPC.
 *
 * Checks:
 * 1. tx hash format is valid
 * 2. tx hash has not been spent (replay protection)
 * 3. Transaction receipt exists on Base and succeeded (status=0x1)
 * 4. Contains USDC Transfer event to HIVE_PAYMENT_ADDRESS
 * 5. Transfer amount >= expectedAmount (in USDC 6-decimal units)
 *
 * @param {string} txHash - 0x-prefixed 64-char hex transaction hash
 * @param {number} expectedAmount - Expected amount in USD
 * @returns {{ verified: boolean, ... }}
 */
export async function verifyPayment(txHash, expectedAmount) {
  // 1. Format validation
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { verified: false, error: "Invalid transaction hash format" };
  }

  const normalizedHash = txHash.toLowerCase();

  // 2. Replay protection — fast path (memory cache)
  if (spentPaymentsCache.has(normalizedHash)) {
    return { verified: false, error: "Transaction hash already used" };
  }

  // 2b. Replay protection — persistent path (SQLite)
  if (db) {
    const existing = db.prepare("SELECT tx_hash FROM spent_payments WHERE tx_hash = ?").get(normalizedHash);
    if (existing) {
      spentPaymentsCache.add(normalizedHash);
      return { verified: false, error: "Transaction hash already used" };
    }
  }

  // 3. On-chain verification — fetch transaction receipt from Base L2 RPC
  let receipt;
  try {
    const rpcResponse = await fetch(BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [normalizedHash],
      }),
    });
    const rpcData = await rpcResponse.json();
    receipt = rpcData.result;
  } catch (e) {
    return { verified: false, error: `RPC call failed: ${e.message}` };
  }

  if (!receipt) {
    return { verified: false, error: "Transaction not found on Base L2" };
  }

  // 4. Check transaction succeeded
  if (receipt.status !== "0x1") {
    return { verified: false, error: "Transaction reverted" };
  }

  // 5. Find USDC Transfer event log to our address
  const usdcContract = USDC_BASE.toLowerCase();
  const recipientPadded = "0x" + HIVE_PAYMENT_ADDRESS.slice(2).padStart(64, "0");

  let transferAmount = 0n;
  let foundTransfer = false;

  for (const log of receipt.logs || []) {
    if (
      log.address?.toLowerCase() === usdcContract &&
      log.topics?.[0] === TRANSFER_TOPIC &&
      log.topics?.[2]?.toLowerCase() === recipientPadded
    ) {
      // data field contains the uint256 amount
      transferAmount += BigInt(log.data);
      foundTransfer = true;
    }
  }

  if (!foundTransfer) {
    return { verified: false, error: "No USDC transfer to HiveAgent payment address found in transaction" };
  }

  // 6. Validate amount (USDC has 6 decimals)
  const expectedAmountWei = BigInt(Math.ceil(expectedAmount * 1e6));
  if (transferAmount < expectedAmountWei) {
    return {
      verified: false,
      error: `Insufficient payment: expected ${expectedAmount} USDC, got ${Number(transferAmount) / 1e6} USDC`,
    };
  }

  // 7. Record spent payment — persistent + cache
  spentPaymentsCache.add(normalizedHash);
  if (db) {
    try {
      db.prepare("INSERT OR IGNORE INTO spent_payments (tx_hash, amount_usd, verified_at) VALUES (?, ?, datetime('now'))").run(
        normalizedHash,
        Number(transferAmount) / 1e6
      );
    } catch (_) {
      // Non-fatal — cache still protects against replay within this process
    }
  }

  return {
    verified: true,
    tx_hash: normalizedHash,
    amount_usd: Number(transferAmount) / 1e6,
    expected_usd: expectedAmount,
    network: "base",
    block_number: receipt.blockNumber,
  };
}

export { client };
