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
import { getWeather } from "../services/live/weather.js";
import { getStockQuote, getExchangeRate, getExchangeRates } from "../services/live/finance.js";
import {
  ipGeolocate, dnsLookup, whoisLookup, generateHash,
  convertTimezone, wikipediaSummary, parseRSSFeed,
} from "../services/live/utilities.js";

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

// ─── Weather — $0.005/query ───────────────

router.get("/weather", requirePayment(0.005, "Weather"), async (req, res) => {
  if (!req.query.location) return res.status(400).json({ error: "location parameter required" });
  res.json(await getWeather(req.query.location));
});

// ─── Stock Quote — $0.01/query ─────────────

router.get("/stock", requirePayment(0.01, "Stock Quote"), async (req, res) => {
  if (!req.query.symbol) return res.status(400).json({ error: "symbol parameter required (e.g., AAPL, TSLA)" });
  res.json(await getStockQuote(req.query.symbol));
});

// ─── Exchange Rates — $0.002/query ──────────

router.get("/exchange-rate", requirePayment(0.002, "Exchange Rate"), async (req, res) => {
  if (req.query.from && req.query.to) {
    res.json(await getExchangeRate(req.query.from, req.query.to));
  } else {
    res.json(await getExchangeRates(req.query.base || "USD"));
  }
});

// ─── IP Geolocation — $0.003/query ──────────

router.get("/ip", requirePayment(0.003, "IP Geolocation"), async (req, res) => {
  if (!req.query.ip) return res.status(400).json({ error: "ip parameter required" });
  res.json(await ipGeolocate(req.query.ip));
});

// ─── DNS Lookup — $0.003/query ─────────────

router.get("/dns", requirePayment(0.003, "DNS Lookup"), async (req, res) => {
  if (!req.query.domain) return res.status(400).json({ error: "domain parameter required" });
  res.json(await dnsLookup(req.query.domain, req.query.type || "ALL"));
});

// ─── Whois — $0.01/query ─────────────────

router.get("/whois", requirePayment(0.01, "Whois Lookup"), async (req, res) => {
  if (!req.query.domain) return res.status(400).json({ error: "domain parameter required" });
  res.json(await whoisLookup(req.query.domain));
});

// ─── Hash — $0.001/request ────────────────

router.post("/hash", requirePayment(0.001, "Hash Generator"), (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: "text field required" });
  res.json(generateHash(req.body.text, req.body.algorithm || "all"));
});

// ─── Timezone — $0.001/convert ─────────────

router.get("/timezone", requirePayment(0.001, "Timezone Converter"), (req, res) => {
  if (!req.query.datetime) return res.status(400).json({ error: "datetime, from_tz, to_tz parameters required" });
  res.json(convertTimezone(req.query.datetime, req.query.from_tz || "UTC", req.query.to_tz || "America/New_York"));
});

// ─── Wikipedia — $0.002/summary ────────────

router.get("/wiki", requirePayment(0.002, "Wikipedia Summary"), async (req, res) => {
  if (!req.query.topic) return res.status(400).json({ error: "topic parameter required" });
  res.json(await wikipediaSummary(req.query.topic));
});

// ─── RSS Feed — $0.005/parse ──────────────

router.get("/rss", requirePayment(0.005, "RSS Parser"), async (req, res) => {
  if (!req.query.url) return res.status(400).json({ error: "url parameter required" });
  res.json(await parseRSSFeed(req.query.url));
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
      { endpoint: "GET /weather?location=Florence", price: "$0.005", description: "Weather + 5-day forecast" },
      { endpoint: "GET /stock?symbol=AAPL", price: "$0.01", description: "Stock quote" },
      { endpoint: "GET /exchange-rate?from=USD&to=EUR", price: "$0.002", description: "Currency exchange rate" },
      { endpoint: "GET /ip?ip=8.8.8.8", price: "$0.003", description: "IP geolocation" },
      { endpoint: "GET /dns?domain=google.com", price: "$0.003", description: "DNS lookup" },
      { endpoint: "GET /whois?domain=google.com", price: "$0.01", description: "Whois / domain info" },
      { endpoint: "POST /hash {text}", price: "$0.001", description: "Hash generator (MD5, SHA1, SHA256, SHA512)" },
      { endpoint: "GET /timezone?datetime=...&from_tz=UTC&to_tz=US/Eastern", price: "$0.001", description: "Timezone converter" },
      { endpoint: "GET /wiki?topic=Bitcoin", price: "$0.002", description: "Wikipedia summary" },
      { endpoint: "GET /rss?url=https://feed.xml", price: "$0.005", description: "RSS feed parser" },
    ],
    payment: {
      protocol: "x402",
      version: "1.0",
      network: "base",
      currency: "USDC",
      instructions: "Send a request → receive HTTP 402 with payment details → pay USDC → retry with X-Payment-Hash header",
      headers: {
        "X-Payment-Hash": "Base network USDC transaction hash (primary)",
        "X-Subscription-Id": "Stripe subscription ID (alternative)",
        "x-payment-tx": "Legacy alias for X-Payment-Hash",
        "x-402-payment": "Legacy alias for X-Payment-Hash",
      },
    },
    subscription_plans: {
      description: "Subscribe for unlimited access across HiveAgent and HiveTrust platforms",
      starter: { name: "Starter", url: "https://hivetrustiq.com/#pricing" },
      builder: { name: "Builder", url: "https://hivetrustiq.com/#pricing" },
      enterprise: { name: "Enterprise", url: "https://hivetrustiq.com/#pricing" },
    },
    registration_url: "https://hivetrustiq.com/#pricing",
  });
});

export default router;
