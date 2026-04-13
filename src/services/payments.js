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
    console.log(`  ✓ Treasury address (shared): ${treasuryAddress}`);
    console.log(`  ✓ Network: Base (USDC)`);
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
    console.log(`  ⚠  Missing CDP credentials — running in demo mode`);
    return { address: null, mode: "demo" };
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

    console.log(`  ✓ Treasury wallet: ${treasuryAddress}`);
    console.log(`  ✓ Network: Base (USDC)`);
    return { address: treasuryAddress, network: "base" };
  } catch (e) {
    console.log(`  ✗ Payment init failed: ${e.message}`);
    if (e.message.includes("wallet secret") || e.message.includes("walletSecret")) {
      console.log(`  → Fix: Add CDP_WALLET_SECRET env var. Create at https://portal.cdp.coinbase.com → Settings → Wallet Secret`);
    }
    if (e.message.includes("401") || e.message.includes("Unauthorized") || e.message.includes("invalid")) {
      console.log(`  → Fix: Check CDP_API_KEY_SECRET format. Ed25519 keys are base64, ECDSA keys are PEM.`);
    }
    if (e.stack) console.log(`  Stack: ${e.stack.split("\n").slice(0, 3).join(" | ")}`);
    console.log(`  Running in demo mode (no live payments)`);
    return { address: null, mode: "demo" };
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
 * Verify a USDC payment on Base
 * In production, verify the on-chain transaction
 */
export async function verifyPayment(txHash, expectedAmount) {
  if (!client) {
    // Demo mode — accept all payments
    return { verified: true, mode: "demo" };
  }

  try {
    // For MVP, we trust the transaction hash and verify later
    // Full verification would check:
    // 1. Transaction exists on Base
    // 2. Correct amount of USDC
    // 3. Sent to our treasury address
    // 4. Not already claimed
    return {
      verified: true,
      tx_hash: txHash,
      amount_usd: expectedAmount,
      network: "base",
    };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

export { client };
