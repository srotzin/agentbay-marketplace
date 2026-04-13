/**
 * x402 Payment Middleware
 *
 * When an agent hits a paid endpoint without payment proof,
 * we return HTTP 402 with payment instructions.
 * Claude Code and other x402-compatible agents handle this automatically.
 *
 * Supports the unified HiveAgent ↔ HiveTrust payment protocol:
 * - X-Payment-Hash (primary), x-payment-tx, x-402-payment (legacy)
 * - X-Subscription-Id for Stripe subscription verification via HiveTrust
 * - Unified X-Payment-* response headers on 402
 */

import { getTreasuryAddress, getPaymentDetails, verifyPayment } from "../services/payments.js";
import { verifySubscription } from "../services/hivetrust-client.js";

/**
 * Express middleware for x402 payment gating
 * Checks for payment proof in headers, returns 402 if missing
 */
export function requirePayment(priceUsd, serviceName) {
  return async (req, res, next) => {
    const treasury = getTreasuryAddress();

    // Check for subscription — cross-platform via HiveTrust
    const subscriptionId = req.headers["x-subscription-id"];
    if (subscriptionId) {
      const sub = await verifySubscription(subscriptionId);
      if (sub.valid) {
        req.paymentVerified = true;
        req.paymentMethod = "subscription";
        req.subscriptionId = subscriptionId;
        return next();
      }
    }

    // Check for x402 payment proof in headers (unified + legacy)
    const txHash =
      req.headers["x-payment-hash"] ||   // Unified primary header
      req.headers["x-payment-tx"] ||      // Legacy HiveAgent
      req.headers["x-402-payment"] ||     // Legacy x402
      req.headers["x-payment"] ||         // Original
      req.headers["x-402-tx"];            // Original alt

    if (txHash) {
      const verification = await verifyPayment(txHash, priceUsd);
      if (verification.verified) {
        req.paymentVerified = true;
        req.paymentTx = txHash;
        return next();
      }
    }

    // No payment or verification failed — return 402
    if (!treasury) {
      // Demo mode — let it through
      req.paymentVerified = false;
      return next();
    }

    const payment = getPaymentDetails(priceUsd, serviceName);

    // Set unified response headers
    res.set("X-Payment-Amount", String(priceUsd));
    res.set("X-Payment-Currency", "USDC");
    res.set("X-Payment-Network", "base");
    res.set("X-Payment-Address", treasury);
    res.set("X-HiveTrust-Required", "true");
    res.set("X-HiveTrust-Challenge", JSON.stringify({
      amount: priceUsd,
      currency: "USDC",
      network: "base",
      address: treasury,
      service: serviceName,
      expires_in_seconds: 300,
    }));

    res.status(402).json({
      status: 402,
      message: "Payment Required",
      description: `This service costs $${priceUsd} USD. Pay in USDC on Base or use a HiveTrust subscription.`,
      payment: {
        ...payment,
        instructions: "Send the specified USDC amount to the recipient address on Base L2. Include the transaction hash in the X-Payment-Hash header and retry your request.",
      },
      headers_required: {
        "X-Payment-Hash": "Your USDC transaction hash on Base",
        "X-Subscription-Id": "Or provide your Stripe subscription ID",
      },
      subscription_plans: {
        starter: { name: "Starter", url: "https://hivetrustiq.com/#pricing" },
        builder: { name: "Builder", url: "https://hivetrustiq.com/#pricing" },
        enterprise: { name: "Enterprise", url: "https://hivetrustiq.com/#pricing" },
      },
      registration_url: "https://hivetrustiq.com/#pricing",
    });
  };
}
