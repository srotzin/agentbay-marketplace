/**
 * Service Executor — Routes purchases to real service implementations
 *
 * When an agent buys a service via hiveagent_buy, this module
 * executes the actual service and returns real results.
 */

import { webSearch } from "./web-search.js";
import { readPage } from "./page-reader.js";
import { analyzeSentiment } from "./sentiment.js";
import { detectLanguage } from "./language-detect.js";
import { validateEmail } from "./email-validate.js";
import { geocode } from "./geocoding.js";
import { getCryptoPrice, getTopCryptos } from "./crypto-prices.js";
import { getNews } from "./news-feed.js";

/**
 * Execute a live service. Returns real data.
 * @param {string} serviceName - The service name from the catalog
 * @param {object} params - Parameters from the agent
 * @returns {object} Real service response
 */
export async function executeService(serviceName, params = {}) {
  const name = serviceName.toLowerCase();

  // ─── Search & Web ─────────────────────────────
  if (name.includes("web search")) {
    return webSearch(params.query || params.q || "latest technology news");
  }

  if (name.includes("page reader") || name.includes("web page")) {
    if (!params.url) return { error: "url parameter required" };
    return readPage(params.url);
  }

  if (name.includes("deep web search") || name.includes("deep search")) {
    // For now, same as web search with note about deep sources
    return webSearch(params.query || params.q || "research");
  }

  // ─── AI & Analysis ────────────────────────────
  if (name.includes("sentiment")) {
    if (!params.text) return { error: "text parameter required" };
    return analyzeSentiment(params.text);
  }

  if (name.includes("language detection") || name.includes("language detect")) {
    if (!params.text) return { error: "text parameter required" };
    return detectLanguage(params.text);
  }

  // ─── Data & Verification ──────────────────────
  if (name.includes("email valid")) {
    if (!params.email) return { error: "email parameter required" };
    return validateEmail(params.email);
  }

  if (name.includes("geocod") || name.includes("address verif")) {
    if (!params.address && !params.query) return { error: "address parameter required" };
    return geocode(params.address || params.query);
  }

  // ─── Finance ──────────────────────────────────
  if (name.includes("crypto price")) {
    if (params.coin) return getCryptoPrice(params.coin);
    return getTopCryptos(params.limit || 10);
  }

  if (name.includes("stock market")) {
    // Placeholder — will wire to free stock API
    return { note: "Stock data service coming soon. Try crypto prices.", provider: "HiveAgent" };
  }

  // ─── News ─────────────────────────────────────
  if (name.includes("news feed") || name.includes("real-time news")) {
    return getNews(params.topic, params.limit || 15);
  }

  if (name.includes("media monitor")) {
    return getNews(params.brand || params.topic, params.limit || 20);
  }

  // ─── Default: Service exists but no live implementation yet ──
  return {
    status: "service_registered",
    message: `${serviceName} is listed on HiveAgent. Live execution coming soon. Your transaction has been recorded.`,
    provider: "HiveAgent",
  };
}

/**
 * Check if a service has a live implementation
 */
export function isLiveService(serviceName) {
  const name = serviceName.toLowerCase();
  const livePatterns = [
    "web search", "page reader", "web page", "deep web search",
    "sentiment", "language detect",
    "email valid", "geocod", "address verif",
    "crypto price", "news feed", "real-time news", "media monitor",
  ];
  return livePatterns.some(p => name.includes(p));
}
