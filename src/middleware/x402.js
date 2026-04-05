/**
 * x402 Payment Middleware
 *
 * When an agent hits a paid endpoint without payment proof,
 * we return HTTP 402 with payment instructions.
 * Claude Code and other x402-compatible agents handle this automatically.
 */

import { getTreasuryAddress, getPaymentDetails, verifyPayment } from "../services/payments.js";

/**
 * Express middleware for x402 payment gating
 * Checks for payment proof in headers, returns 402 if missing
 */
export function requirePayment(priceUsd, serviceName) {
  return async (req, res, next) => {
    const treasury = getTreasuryAddress();

    // Check for x402 payment proof in headers
    const paymentHeader = req.headers["x-payment"] || req.headers["x-402-payment"];
    const txHash = req.headers["x-payment-tx"] || req.headers["x-402-tx"];

    if (paymentHeader || txHash) {
      // Agent has provided payment proof — verify it
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

    res.status(402).json({
      status: 402,
      message: "Payment Required",
      description: `This service costs $${priceUsd} USD. Pay in USDC on Base to access.`,
      payment: {
        ...payment,
        instructions: "Send the specified USDC amount to the recipient address on Base L2. Include the transaction hash in the x-payment-tx header and retry your request.",
      },
      headers_required: {
        "x-payment-tx": "Your USDC transaction hash on Base",
      },
    });
  };
}
