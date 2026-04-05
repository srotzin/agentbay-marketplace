/**
 * HiveAgent Payment Service — USDC on Base via Coinbase CDP
 *
 * Creates and manages the HiveAgent treasury wallet.
 * All agent payments settle here in USDC on Base L2.
 */

import { CdpClient } from "@coinbase/cdp-sdk";

let client = null;
let treasuryWallet = null;
let treasuryAddress = null;

// Base Mainnet USDC
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Initialize the CDP client and treasury wallet
 */
export async function initPayments() {
  try {
    client = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET?.replace(/\\n/g, "\n"),
      projectId: process.env.CDP_PROJECT_ID,
    });

    // Create or load treasury wallet
    // In production, store the wallet ID and reload it
    const account = await client.evm.createAccount({ network: "base" });
    treasuryAddress = account.address;
    treasuryWallet = account;

    console.log(`  Treasury wallet: ${treasuryAddress}`);
    console.log(`  Network: Base (USDC)`);
    return { address: treasuryAddress, network: "base" };
  } catch (e) {
    console.log(`  Payment init warning: ${e.message}`);
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
