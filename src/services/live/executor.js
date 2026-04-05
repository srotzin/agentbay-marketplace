/**
 * Service Executor — Routes purchases to real service implementations
 * 20+ live services returning real data.
 */

import { webSearch } from "./web-search.js";
import { readPage } from "./page-reader.js";
import { analyzeSentiment } from "./sentiment.js";
import { detectLanguage } from "./language-detect.js";
import { validateEmail } from "./email-validate.js";
import { geocode } from "./geocoding.js";
import { getCryptoPrice, getTopCryptos } from "./crypto-prices.js";
import { getNews } from "./news-feed.js";
import { getWeather } from "./weather.js";
import { getStockQuote, getExchangeRate, getExchangeRates } from "./finance.js";
import {
  ipGeolocate, dnsLookup, whoisLookup, generateHash,
  convertTimezone, wikipediaSummary, parseRSSFeed,
} from "./utilities.js";

export async function executeService(serviceName, params = {}) {
  const name = serviceName.toLowerCase();

  // ─── Search & Web ─────────────────────────────
  if (name.includes("web search") || name.includes("deep web search")) {
    return webSearch(params.query || params.q || "latest technology news");
  }
  if (name.includes("page reader") || name.includes("web page")) {
    if (!params.url) return { error: "url parameter required" };
    return readPage(params.url);
  }
  if (name.includes("serp track")) {
    return webSearch(params.keyword || params.query || "AI agents");
  }
  if (name.includes("site monitor")) {
    if (!params.url) return { error: "url parameter required" };
    return readPage(params.url);
  }

  // ─── AI & Analysis ────────────────────────────
  if (name.includes("sentiment")) {
    if (!params.text) return { error: "text parameter required" };
    return analyzeSentiment(params.text);
  }
  if (name.includes("language detect") || name.includes("language detection")) {
    if (!params.text) return { error: "text parameter required" };
    return detectLanguage(params.text);
  }
  if (name.includes("text classif")) {
    if (!params.text) return { error: "text parameter required" };
    return analyzeSentiment(params.text); // Reuse sentiment as basic classifier
  }
  if (name.includes("entity extract")) {
    if (!params.text) return { error: "text parameter required" };
    // Basic entity extraction using regex patterns
    const emails = params.text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    const urls = params.text.match(/https?:\/\/[^\s]+/g) || [];
    const numbers = params.text.match(/\$[\d,.]+|\d+%/g) || [];
    return { entities: { emails, urls, numbers }, text_length: params.text.length, provider: "HiveAgent Entities" };
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
  if (name.includes("ip") && (name.includes("geolocat") || name.includes("lookup"))) {
    if (!params.ip) return { error: "ip parameter required" };
    return ipGeolocate(params.ip);
  }

  // ─── Weather ──────────────────────────────────
  if (name.includes("weather")) {
    if (!params.location && !params.city) return { error: "location parameter required" };
    return getWeather(params.location || params.city);
  }

  // ─── Finance ──────────────────────────────────
  if (name.includes("crypto price")) {
    if (params.coin) return getCryptoPrice(params.coin);
    return getTopCryptos(params.limit || 10);
  }
  if (name.includes("stock market") || name.includes("stock quote")) {
    if (!params.symbol && !params.ticker) return { error: "symbol parameter required (e.g., AAPL, TSLA)" };
    return getStockQuote(params.symbol || params.ticker);
  }
  if (name.includes("currency") || name.includes("exchange rate")) {
    if (params.from && params.to) return getExchangeRate(params.from, params.to);
    return getExchangeRates(params.base || "USD", params.targets);
  }
  if (name.includes("company financ") || name.includes("company research")) {
    if (!params.symbol) return { error: "symbol parameter required" };
    return getStockQuote(params.symbol);
  }

  // ─── News ─────────────────────────────────────
  if (name.includes("news feed") || name.includes("real-time news")) {
    return getNews(params.topic, params.limit || 15);
  }
  if (name.includes("media monitor")) {
    return getNews(params.brand || params.topic, params.limit || 20);
  }

  // ─── DNS & Domain ─────────────────────────────
  if (name.includes("dns lookup") || name.includes("dns record")) {
    if (!params.domain) return { error: "domain parameter required" };
    return dnsLookup(params.domain, params.type || "ALL");
  }
  if (name.includes("whois") || name.includes("domain lookup")) {
    if (!params.domain) return { error: "domain parameter required" };
    return whoisLookup(params.domain);
  }

  // ─── Utilities ────────────────────────────────
  if (name.includes("hash")) {
    if (!params.text) return { error: "text parameter required" };
    return generateHash(params.text, params.algorithm || "all");
  }
  if (name.includes("timezone")) {
    if (!params.datetime) return { error: "datetime, from_tz, and to_tz parameters required" };
    return convertTimezone(params.datetime, params.from_tz || "UTC", params.to_tz || "America/New_York");
  }
  if (name.includes("wikipedia") || name.includes("wiki summary")) {
    if (!params.topic) return { error: "topic parameter required" };
    return wikipediaSummary(params.topic);
  }
  if (name.includes("rss") || name.includes("feed pars")) {
    if (!params.url && !params.feed_url) return { error: "url parameter required" };
    return parseRSSFeed(params.url || params.feed_url);
  }

  // ─── Default ──────────────────────────────────
  return {
    status: "service_registered",
    message: `${serviceName} is listed on HiveAgent. Live execution coming soon.`,
    provider: "HiveAgent",
  };
}

export function isLiveService(serviceName) {
  const name = serviceName.toLowerCase();
  const livePatterns = [
    "web search", "page reader", "web page", "deep web search", "serp track", "site monitor",
    "sentiment", "language detect", "text classif", "entity extract",
    "email valid", "geocod", "address verif",
    "crypto price", "stock market", "stock quote", "currency", "exchange rate",
    "company financ", "company research",
    "news feed", "real-time news", "media monitor",
    "weather",
    "dns lookup", "dns record", "whois", "domain lookup",
    "hash", "timezone", "wikipedia", "wiki summary", "rss", "feed pars",
    "ip geolocat", "ip lookup",
  ];
  return livePatterns.some(p => name.includes(p));
}
