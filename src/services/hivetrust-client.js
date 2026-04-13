/**
 * HiveTrust Client — Cross-platform verification via HiveTrust API
 *
 * HiveTrust is the payment/identity authority. HiveAgent delegates
 * payment and subscription verification to HiveTrust.
 *
 * Uses native fetch() (Node 22+).
 */

const HIVETRUST_API_URL = process.env.HIVETRUST_API_URL || "https://hivetrust.onrender.com";
const HIVE_INTERNAL_KEY = process.env.HIVE_INTERNAL_KEY || "";

function headers() {
  const h = { "Content-Type": "application/json" };
  if (HIVE_INTERNAL_KEY) h["X-Hive-Internal-Key"] = HIVE_INTERNAL_KEY;
  return h;
}

/**
 * Verify a Stripe subscription via HiveTrust
 * @param {string} subscriptionId — Stripe subscription ID
 * @returns {Promise<{valid: boolean, plan?: string, error?: string}>}
 */
export async function verifySubscription(subscriptionId) {
  try {
    const res = await fetch(
      `${HIVETRUST_API_URL}/v1/pricing/verify-subscription?id=${encodeURIComponent(subscriptionId)}`,
      { headers: headers(), signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { valid: false, error: `HiveTrust returned ${res.status}` };
    return await res.json();
  } catch (e) {
    console.warn(`[hivetrust-client] verifySubscription failed: ${e.message} — falling back to local`);
    return { valid: false, error: e.message, fallback: true };
  }
}

/**
 * Verify a USDC payment via HiveTrust
 * @param {string} txHash — Base network USDC transaction hash
 * @param {number} amount — Expected amount in USD
 * @returns {Promise<{valid: boolean, details?: object, error?: string}>}
 */
export async function verifyPaymentViaTrust(txHash, amount) {
  try {
    const res = await fetch(`${HIVETRUST_API_URL}/v1/pricing/verify-payment`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ hash: txHash, amount, source: "hiveagent" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { valid: false, error: `HiveTrust returned ${res.status}` };
    return await res.json();
  } catch (e) {
    console.warn(`[hivetrust-client] verifyPaymentViaTrust failed: ${e.message} — falling back to local`);
    return { valid: false, error: e.message, fallback: true };
  }
}

/**
 * Get agent trust score from HiveTrust
 * @param {string} agentDid — Agent DID
 * @returns {Promise<{score?: number, tier?: string, error?: string}>}
 */
export async function getAgentTrustScore(agentDid) {
  try {
    const res = await fetch(
      `${HIVETRUST_API_URL}/v1/agents/${encodeURIComponent(agentDid)}`,
      { headers: headers(), signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { error: `HiveTrust returned ${res.status}` };
    return await res.json();
  } catch (e) {
    console.warn(`[hivetrust-client] getAgentTrustScore failed: ${e.message}`);
    return { error: e.message, fallback: true };
  }
}

/**
 * Get a pricing quote for an endpoint from HiveTrust
 * @param {string} endpoint — Endpoint path
 * @returns {Promise<{amount?: number, currency?: string, address?: string, error?: string}>}
 */
export async function getPricingQuote(endpoint) {
  try {
    const res = await fetch(
      `${HIVETRUST_API_URL}/v1/pricing/quote?endpoint=${encodeURIComponent(endpoint)}`,
      { headers: headers(), signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { error: `HiveTrust returned ${res.status}` };
    return await res.json();
  } catch (e) {
    console.warn(`[hivetrust-client] getPricingQuote failed: ${e.message}`);
    return { error: e.message, fallback: true };
  }
}
