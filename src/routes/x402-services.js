/**
 * x402 Direct Service Endpoints
 *
 * These endpoints serve as x402-native paid APIs.
 * Any agent that speaks x402 (Claude Code, Coinbase agents, etc.)
 * can hit these directly and pay per-request in USDC.
 *
 * Flow:
 * 1. Agent hits endpoint → gets 402 with payment details
 * 2. Agent pays USDC on Base → retries with tx hash in header
 * 3. Server verifies payment → returns real data
 */

import { Router } from "express";
import { requirePayment } from "../middleware/x402.js";
import { webSearch } from "../services/live/web-search.js";
import { readPage } from "../services/live/page-reader.js";
import { analyzeSentiment } from "../services/live/sentiment.js";
import { detectLanguage } from "../services/live/language-detect.js";
import { validateEmail } from "../services/live/email-validate.js";
import { geocode } from "../services/live/geocoding.js";
import { getCryptoPrice, getTopCryptos } from "../services/live/crypto-prices.js";
import { getNews } from "../services/live/news-feed.js";

const router = Router();

// ─── Web Search — $0.002/query ───────────────────

router.get("/search", requirePayment(0.002, "Web Search"), async (req, res) => {
  const result = await webSearch(req.query.q || req.query.query || "latest news");
  res.json(result);
});

// ─── Page Reader — $0.005/page ───────────────────

router.get("/read", requirePayment(0.005, "Page Reader"), async (req, res) => {
  if (!req.query.url) return res.status(400).json({ error: "url parameter required" });
  const result = await readPage(req.query.url);
  res.json(result);
});

// ─── Sentiment — $0.003/analysis ─────────────────

router.post("/sentiment", requirePayment(0.003, "Sentiment Analysis"), (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: "text field required in body" });
  res.json(analyzeSentiment(req.body.text));
});

// ─── Language Detection — $0.001/detect ──────────

router.post("/detect-language", requirePayment(0.001, "Language Detection"), (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: "text field required in body" });
  res.json(detectLanguage(req.body.text));
});

// ─── Email Validation — $0.005/check ────────────

router.get("/validate-email", requirePayment(0.005, "Email Validation"), async (req, res) => {
  if (!req.query.email) return res.status(400).json({ error: "email parameter required" });
  const result = await validateEmail(req.query.email);
  res.json(result);
});

// ─── Geocoding — $0.005/lookup ──────────────────

router.get("/geocode", requirePayment(0.005, "Geocoding"), async (req, res) => {
  if (!req.query.address) return res.status(400).json({ error: "address parameter required" });
  const result = await geocode(req.query.address);
  res.json(result);
});

// ─── Crypto Prices — $0.001/query ───────────────

router.get("/crypto", requirePayment(0.001, "Crypto Price"), async (req, res) => {
  if (req.query.coin) {
    res.json(await getCryptoPrice(req.query.coin));
  } else {
    res.json(await getTopCryptos(parseInt(req.query.limit) || 10));
  }
});

// ─── News — $0.01/feed ──────────────────────────

router.get("/news", requirePayment(0.01, "News Feed"), async (req, res) => {
  const result = await getNews(req.query.topic, parseInt(req.query.limit) || 15);
  res.json(result);
});

// ─── Service Directory ──────────────────────────

router.get("/", (_req, res) => {
  res.json({
    name: "HiveAgent x402 Services",
    description: "Pay-per-request APIs. All prices in USDC on Base L2.",
    services: [
      { endpoint: "GET /search?q=query", price: "$0.002", description: "Web search" },
      { endpoint: "GET /read?url=https://...", price: "$0.005", description: "Extract text from URL" },
      { endpoint: "POST /sentiment {text}", price: "$0.003", description: "Sentiment analysis" },
      { endpoint: "POST /detect-language {text}", price: "$0.001", description: "Detect language" },
      { endpoint: "GET /validate-email?email=x@y.com", price: "$0.005", description: "Validate email" },
      { endpoint: "GET /geocode?address=...", price: "$0.005", description: "Geocode address" },
      { endpoint: "GET /crypto?coin=bitcoin", price: "$0.001", description: "Crypto prices" },
      { endpoint: "GET /news?topic=ai", price: "$0.01", description: "Real-time news" },
    ],
    payment: {
      protocol: "x402",
      network: "Base L2",
      token: "USDC",
      instructions: "Send a request → receive HTTP 402 with payment details → pay USDC → retry with x-payment-tx header",
    },
  });
});

export default router;
