/**
 * HiveAgent Variant Expansion
 * Every service in multiple flavors — if an agent doesn't want vanilla, we have chocolate.
 * Run after seed-expanded.js: node src/seed-variants.js
 */

import * as mkt from "./services/marketplace.js";
import db from "./db.js";

console.log("Seeding HiveAgent variants...\n");

// Get existing providers or create variant providers
function getOrCreateProvider(name, description) {
  const existing = db.prepare("SELECT id FROM providers WHERE name = ?").get(name);
  if (existing) return existing.id;
  return mkt.registerProvider({ name, description }).id;
}

const providers = {
  search: getOrCreateProvider("SearchVariants", "Multi-format search services"),
  ai: getOrCreateProvider("AIVariants", "AI services in every flavor"),
  finance: getOrCreateProvider("FinanceVariants", "Financial data every way you want it"),
  data: getOrCreateProvider("DataVariants", "Data services all formats"),
  media: getOrCreateProvider("MediaVariants", "Media processing variants"),
  code: getOrCreateProvider("CodeVariants", "Code tools every language"),
  legal: getOrCreateProvider("LegalVariants", "Legal services by jurisdiction"),
  comm: getOrCreateProvider("CommVariants", "Communication all channels"),
  logistics: getOrCreateProvider("LogisticsVariants", "Logistics every carrier"),
  infra: getOrCreateProvider("InfraVariants", "Infrastructure all providers"),
};

const variants = [
  // ═══ SEARCH VARIANTS ═══════════════════════════
  { p: providers.search, name: "Academic Paper Search", desc: "Search academic papers across PubMed, arXiv, IEEE, Springer. Returns titles, abstracts, DOIs, citation counts.", cat: "search", price: 0.01, tags: ["academic", "papers", "research"] },
  { p: providers.search, name: "Patent Search (US)", desc: "Search USPTO patents by keyword, inventor, assignee, class. Returns patent numbers, abstracts, claims.", cat: "search", price: 0.02, tags: ["patents", "ip", "us"] },
  { p: providers.search, name: "Patent Search (International)", desc: "Search EPO, WIPO, JPO patents. International patent coverage across 100+ countries.", cat: "search", price: 0.03, tags: ["patents", "international"] },
  { p: providers.search, name: "News Search (Real-Time)", desc: "Search breaking news from last 24 hours across 50,000+ sources.", cat: "search", price: 0.005, tags: ["news", "realtime"] },
  { p: providers.search, name: "News Search (Historical)", desc: "Search news archives going back 20 years. Perfect for research and due diligence.", cat: "search", price: 0.02, tags: ["news", "archive", "historical"] },
  { p: providers.search, name: "Image Search", desc: "Search for images by description. Returns URLs, dimensions, licenses.", cat: "search", price: 0.003, tags: ["images", "visual"] },
  { p: providers.search, name: "Video Search", desc: "Search YouTube, Vimeo, Dailymotion for videos. Returns titles, URLs, duration, views.", cat: "search", price: 0.005, tags: ["video", "youtube"] },
  { p: providers.search, name: "Social Media Search", desc: "Search X/Twitter, Reddit, LinkedIn posts by keyword. Returns posts, engagement metrics.", cat: "search", price: 0.01, tags: ["social", "twitter", "reddit"] },
  { p: providers.search, name: "Code Search", desc: "Search GitHub, GitLab, StackOverflow for code snippets and solutions.", cat: "search", price: 0.005, tags: ["code", "github", "stackoverflow"] },
  { p: providers.search, name: "Job Search", desc: "Search job listings across LinkedIn, Indeed, Glassdoor. Filter by role, location, salary.", cat: "search", price: 0.01, tags: ["jobs", "careers", "hiring"] },
  { p: providers.search, name: "Product Search", desc: "Search products across Amazon, eBay, Walmart. Prices, ratings, availability.", cat: "search", price: 0.005, tags: ["products", "shopping", "ecommerce"] },
  { p: providers.search, name: "Recipe Search", desc: "Search recipes by ingredients, cuisine, dietary restrictions. Nutritional info included.", cat: "search", price: 0.003, tags: ["recipes", "food", "cooking"] },
  { p: providers.search, name: "People Search", desc: "Find people by name, company, title. Returns professional profiles and contact info.", cat: "search", price: 0.05, tags: ["people", "contacts", "b2b"] },
  
  // ═══ WEATHER VARIANTS ═══════════════════════════
  { p: providers.data, name: "Weather (Current Only)", desc: "Current weather conditions for any location. Temperature, humidity, wind, conditions.", cat: "data", price: 0.001, tags: ["weather", "current"] },
  { p: providers.data, name: "Weather (7-Day Forecast)", desc: "7-day weather forecast with hourly breakdowns. Precipitation probability, UV index.", cat: "data", price: 0.005, tags: ["weather", "forecast", "7day"] },
  { p: providers.data, name: "Weather (14-Day Forecast)", desc: "Extended 14-day forecast. Temperature ranges, precipitation, wind patterns.", cat: "data", price: 0.01, tags: ["weather", "forecast", "14day"] },
  { p: providers.data, name: "Weather (Historical)", desc: "Historical weather data for any date/location going back 50 years.", cat: "data", price: 0.02, tags: ["weather", "historical"] },
  { p: providers.data, name: "Weather (Severe Alerts)", desc: "Real-time severe weather alerts — storms, hurricanes, tornadoes, floods.", cat: "data", price: 0.005, tags: ["weather", "alerts", "severe"] },
  { p: providers.data, name: "Weather (Marine)", desc: "Marine weather — wave height, wind speed, sea temperature, tides.", cat: "data", price: 0.01, tags: ["weather", "marine", "ocean"] },
  { p: providers.data, name: "Weather (Aviation)", desc: "Aviation weather — METAR, TAF, visibility, ceiling, winds aloft.", cat: "data", price: 0.01, tags: ["weather", "aviation", "flying"] },
  { p: providers.data, name: "Air Quality Index", desc: "Real-time air quality data. AQI, PM2.5, PM10, ozone, NO2 for any location.", cat: "data", price: 0.003, tags: ["air", "quality", "pollution"] },
  
  // ═══ FINANCE VARIANTS ═══════════════════════════
  { p: providers.finance, name: "Stock Quote (Real-Time)", desc: "Real-time stock price with bid/ask spread, volume, market cap.", cat: "finance", price: 0.01, tags: ["stocks", "realtime"] },
  { p: providers.finance, name: "Stock Quote (After-Hours)", desc: "Pre-market and after-hours stock prices and volume.", cat: "finance", price: 0.02, tags: ["stocks", "afterhours", "premarket"] },
  { p: providers.finance, name: "Stock Historical (Daily)", desc: "Daily OHLCV data for any stock. Up to 20 years of history.", cat: "finance", price: 0.05, tags: ["stocks", "historical", "daily"] },
  { p: providers.finance, name: "Stock Historical (Intraday)", desc: "1-minute and 5-minute intraday stock data. Last 30 days.", cat: "finance", price: 0.10, tags: ["stocks", "intraday", "minute"] },
  { p: providers.finance, name: "Options Chain", desc: "Full options chain for any stock. Strikes, premiums, greeks, open interest.", cat: "finance", price: 0.05, tags: ["options", "derivatives", "greeks"] },
  { p: providers.finance, name: "Earnings Calendar", desc: "Upcoming and historical earnings dates, EPS estimates, revenue estimates.", cat: "finance", price: 0.02, tags: ["earnings", "calendar", "estimates"] },
  { p: providers.finance, name: "Dividend Data", desc: "Dividend history, yield, ex-dates, payout ratios for any stock.", cat: "finance", price: 0.02, tags: ["dividends", "yield", "income"] },
  { p: providers.finance, name: "Insider Trading Data", desc: "SEC insider trading filings. Who's buying and selling at every public company.", cat: "finance", price: 0.05, tags: ["insider", "sec", "filings"] },
  { p: providers.finance, name: "ETF Data", desc: "ETF holdings, expense ratios, sector breakdown, performance.", cat: "finance", price: 0.02, tags: ["etf", "funds", "holdings"] },
  { p: providers.finance, name: "Forex Rates (170 Pairs)", desc: "Real-time forex rates for 170 currency pairs. Bid/ask, daily change.", cat: "finance", price: 0.005, tags: ["forex", "fx", "currency"] },
  { p: providers.finance, name: "Commodity Prices", desc: "Gold, silver, oil, natural gas, wheat, corn — real-time commodity prices.", cat: "finance", price: 0.005, tags: ["commodities", "gold", "oil"] },
  { p: providers.finance, name: "Bond Yields", desc: "Government bond yields for 50+ countries. 2Y, 5Y, 10Y, 30Y.", cat: "finance", price: 0.01, tags: ["bonds", "yields", "fixed-income"] },
  { p: providers.finance, name: "Economic Calendar", desc: "Upcoming economic events — Fed meetings, GDP, CPI, jobs data, PMI.", cat: "finance", price: 0.01, tags: ["economics", "calendar", "macro"] },
  { p: providers.finance, name: "IPO Calendar", desc: "Upcoming and recent IPOs. Dates, price ranges, underwriters.", cat: "finance", price: 0.02, tags: ["ipo", "new-listings"] },
  { p: providers.finance, name: "SEC Filing Search", desc: "Search SEC EDGAR filings — 10-K, 10-Q, 8-K, S-1, proxy statements.", cat: "finance", price: 0.05, tags: ["sec", "filings", "edgar"] },
  { p: providers.finance, name: "Crypto DeFi Yields", desc: "Current DeFi yields across protocols — Aave, Compound, Uniswap, Curve.", cat: "finance", price: 0.01, tags: ["defi", "yields", "crypto"] },
  { p: providers.finance, name: "Crypto On-Chain Analytics", desc: "Whale movements, exchange flows, active addresses, NVT ratio.", cat: "finance", price: 0.05, tags: ["crypto", "onchain", "analytics"] },
  { p: providers.finance, name: "Crypto Fear & Greed Index", desc: "Market sentiment index 0-100 with historical data.", cat: "finance", price: 0.002, tags: ["crypto", "sentiment", "fear-greed"] },

  // ═══ AI/ML VARIANTS ═══════════════════════════
  { p: providers.ai, name: "Summarizer (Bullet Points)", desc: "Summarize text into bullet points. Configurable depth: 3, 5, or 10 points.", cat: "ai", price: 0.03, tags: ["summarize", "bullets"] },
  { p: providers.ai, name: "Summarizer (Executive Brief)", desc: "One-paragraph executive summary. Perfect for reports and articles.", cat: "ai", price: 0.05, tags: ["summarize", "executive"] },
  { p: providers.ai, name: "Summarizer (Tweet-Length)", desc: "Compress any text to 280 characters. Social media ready.", cat: "ai", price: 0.01, tags: ["summarize", "short", "twitter"] },
  { p: providers.ai, name: "Text Rewriter (Formal)", desc: "Rewrite text in a formal, professional tone.", cat: "ai", price: 0.03, tags: ["rewrite", "formal", "professional"] },
  { p: providers.ai, name: "Text Rewriter (Casual)", desc: "Rewrite text in a casual, conversational tone.", cat: "ai", price: 0.03, tags: ["rewrite", "casual", "conversational"] },
  { p: providers.ai, name: "Text Rewriter (Simplified)", desc: "Simplify complex text to 5th-grade reading level.", cat: "ai", price: 0.03, tags: ["rewrite", "simple", "eli5"] },
  { p: providers.ai, name: "Keyword Extractor", desc: "Extract key phrases, topics, and entities from text. TF-IDF + NER.", cat: "ai", price: 0.02, tags: ["keywords", "extraction", "nlp"] },
  { p: providers.ai, name: "Text-to-SQL", desc: "Convert natural language questions to SQL queries. Supports PostgreSQL, MySQL, SQLite.", cat: "ai", price: 0.05, tags: ["sql", "natural-language", "database"] },
  { p: providers.ai, name: "JSON Extractor", desc: "Extract structured JSON from unstructured text. Define your schema, get clean data.", cat: "ai", price: 0.03, tags: ["json", "extraction", "structured"] },
  { p: providers.ai, name: "Spam/Content Classifier", desc: "Classify text as spam, toxic, NSFW, political, or clean. Content moderation.", cat: "ai", price: 0.005, tags: ["moderation", "spam", "classification"] },
  { p: providers.ai, name: "PII Detector", desc: "Detect personally identifiable information in text — names, SSNs, emails, phones, addresses.", cat: "ai", price: 0.01, tags: ["pii", "privacy", "detection"] },
  
  // ═══ DATA VARIANTS ═════════════════════════════
  { p: providers.data, name: "Company Lookup (Basic)", desc: "Company name, domain, industry, size, location. Free for basic.", cat: "data", price: 0.01, tags: ["company", "lookup", "basic"] },
  { p: providers.data, name: "Company Lookup (Full)", desc: "Complete company profile — financials, funding, leadership, tech stack, competitors.", cat: "data", price: 0.25, tags: ["company", "profile", "full"] },
  { p: providers.data, name: "Domain WHOIS + DNS", desc: "Combined WHOIS and DNS lookup for any domain. Registrar, dates, all records.", cat: "data", price: 0.01, tags: ["domain", "whois", "dns"] },
  { p: providers.data, name: "IP Reputation Check", desc: "Check if an IP is on blacklists, VPN, proxy, tor, or known for abuse.", cat: "data", price: 0.005, tags: ["ip", "reputation", "security"] },
  { p: providers.data, name: "Phone Number Lookup", desc: "Carrier, line type (mobile/landline/voip), location for any phone number.", cat: "data", price: 0.02, tags: ["phone", "carrier", "lookup"] },
  { p: providers.data, name: "URL Safety Check", desc: "Check if a URL is safe — malware, phishing, spam, reputation score.", cat: "data", price: 0.005, tags: ["url", "safety", "security"] },
  { p: providers.data, name: "Screenshot Website", desc: "Take a screenshot of any website. Returns PNG image URL. Desktop or mobile.", cat: "data", price: 0.02, tags: ["screenshot", "website", "visual"] },
  { p: providers.data, name: "PDF Text Extractor", desc: "Extract text from PDF files. Handles scanned PDFs with OCR.", cat: "data", price: 0.05, tags: ["pdf", "extraction", "ocr"] },
  { p: providers.data, name: "Barcode/QR Decoder", desc: "Decode any barcode or QR code from an image URL.", cat: "data", price: 0.01, tags: ["barcode", "qr", "decode"] },
  { p: providers.data, name: "Unit Converter", desc: "Convert between any units — length, weight, temperature, currency, time, data.", cat: "data", price: 0.001, tags: ["convert", "units", "calculator"] },
  { p: providers.data, name: "Random Data Generator", desc: "Generate fake but realistic data — names, addresses, emails, companies. For testing.", cat: "data", price: 0.001, tags: ["random", "fake", "testing"] },
  { p: providers.data, name: "Country Info", desc: "Country data — population, GDP, capital, languages, currency, timezone, flag.", cat: "data", price: 0.002, tags: ["country", "geography", "info"] },
  { p: providers.data, name: "Holiday Calendar", desc: "Public holidays for any country. Current and upcoming years.", cat: "data", price: 0.002, tags: ["holidays", "calendar", "dates"] },

  // ═══ MEDIA VARIANTS ════════════════════════════
  { p: providers.media, name: "Image Generation (Photorealistic)", desc: "Generate photorealistic images from text. 1024x1024.", cat: "media", price: 0.15, tags: ["image", "photorealistic"] },
  { p: providers.media, name: "Image Generation (Illustration)", desc: "Generate illustrations and cartoon-style images.", cat: "media", price: 0.10, tags: ["image", "illustration", "cartoon"] },
  { p: providers.media, name: "Image Generation (Logo)", desc: "Generate logo designs from text description.", cat: "media", price: 0.20, tags: ["logo", "design", "branding"] },
  { p: providers.media, name: "Image Background Removal", desc: "Remove background from any image. Returns transparent PNG.", cat: "media", price: 0.05, tags: ["image", "background", "removal"] },
  { p: providers.media, name: "Image to Text (OCR)", desc: "Extract text from images. Supports 100+ languages.", cat: "media", price: 0.03, tags: ["ocr", "image-to-text"] },
  { p: providers.media, name: "Text-to-Speech (English)", desc: "Convert text to natural speech audio. Multiple voices. English.", cat: "media", price: 0.05, tags: ["tts", "speech", "english"] },
  { p: providers.media, name: "Text-to-Speech (Multi-Language)", desc: "Text-to-speech in 50+ languages. Natural voices.", cat: "media", price: 0.08, tags: ["tts", "speech", "multilingual"] },
  { p: providers.media, name: "Speech-to-Text (Real-Time)", desc: "Real-time speech transcription from audio stream.", cat: "media", price: 0.10, tags: ["stt", "transcription", "realtime"] },
  { p: providers.media, name: "Video Summarizer", desc: "Generate text summary from a video URL. Key points and timestamps.", cat: "media", price: 0.15, tags: ["video", "summary"] },
  { p: providers.media, name: "Audio Podcast Summary", desc: "Summarize podcast episodes from RSS feed or URL.", cat: "media", price: 0.10, tags: ["podcast", "summary", "audio"] },

  // ═══ CODE VARIANTS ═════════════════════════════
  { p: providers.code, name: "Code Formatter", desc: "Format/beautify code in any language. Supports 30+ languages.", cat: "code", price: 0.01, tags: ["format", "beautify", "lint"] },
  { p: providers.code, name: "Code Minifier", desc: "Minify JavaScript, CSS, HTML for production.", cat: "code", price: 0.01, tags: ["minify", "compress", "optimize"] },
  { p: providers.code, name: "Regex Tester", desc: "Test regex patterns against text. Returns matches, groups, performance.", cat: "code", price: 0.005, tags: ["regex", "pattern", "test"] },
  { p: providers.code, name: "JSON Validator + Formatter", desc: "Validate and format JSON. Pretty print with syntax highlighting.", cat: "code", price: 0.005, tags: ["json", "validate", "format"] },
  { p: providers.code, name: "API Response Mocker", desc: "Generate mock API responses for testing. Supports REST and GraphQL.", cat: "code", price: 0.01, tags: ["mock", "api", "testing"] },
  { p: providers.code, name: "Markdown to HTML", desc: "Convert Markdown to clean HTML. Supports GFM, tables, code blocks.", cat: "code", price: 0.005, tags: ["markdown", "html", "convert"] },
  { p: providers.code, name: "HTML to Markdown", desc: "Convert HTML pages to clean Markdown. Preserves structure.", cat: "code", price: 0.005, tags: ["html", "markdown", "convert"] },
  { p: providers.code, name: "CSV to JSON", desc: "Convert CSV data to JSON array. Auto-detect headers and types.", cat: "code", price: 0.005, tags: ["csv", "json", "convert"] },
  { p: providers.code, name: "Diff Checker", desc: "Compare two texts and show differences. Line-by-line or word-by-word.", cat: "code", price: 0.01, tags: ["diff", "compare", "text"] },
  { p: providers.code, name: "Cron Expression Parser", desc: "Parse and explain cron expressions. Generate cron from natural language.", cat: "code", price: 0.005, tags: ["cron", "schedule", "parse"] },

  // ═══ LEGAL VARIANTS ════════════════════════════
  { p: providers.legal, name: "Contract Clause Library", desc: "Search 10,000+ standard contract clauses by type. NDA, SaaS, employment, IP.", cat: "legal", price: 0.10, tags: ["contracts", "clauses", "templates"] },
  { p: providers.legal, name: "Legal Citation Checker", desc: "Verify legal citations — case law, statutes, regulations. Check if still good law.", cat: "legal", price: 0.25, tags: ["citations", "legal", "verify"] },
  { p: providers.legal, name: "GDPR Compliance Check", desc: "Check a website or data practice against GDPR requirements. Returns compliance gaps.", cat: "legal", price: 1.00, tags: ["gdpr", "privacy", "compliance"] },
  { p: providers.legal, name: "Trademark Search (US)", desc: "Search USPTO trademark database. Check availability for new brands.", cat: "legal", price: 0.50, tags: ["trademark", "brand", "us"] },
  { p: providers.legal, name: "Trademark Search (Global)", desc: "Search trademark databases in 200+ jurisdictions via Madrid Protocol.", cat: "legal", price: 1.50, tags: ["trademark", "global", "madrid"] },
  { p: providers.legal, name: "Business Entity Search", desc: "Search business registrations across all 50 US states. Status, officers, filings.", cat: "legal", price: 0.25, tags: ["business", "entity", "registration"] },
  { p: providers.legal, name: "Court Case Search", desc: "Search federal and state court records. PACER and state databases.", cat: "legal", price: 0.50, tags: ["court", "cases", "litigation"] },

  // ═══ TRANSLATION VARIANTS ══════════════════════
  { p: providers.data, name: "Translation (Technical)", desc: "Technical document translation preserving terminology. Engineering, medical, legal.", cat: "translation", price: 0.08, tags: ["translation", "technical"] },
  { p: providers.data, name: "Translation (Marketing)", desc: "Marketing-focused translation with cultural adaptation and tone matching.", cat: "translation", price: 0.10, tags: ["translation", "marketing", "localization"] },
  { p: providers.data, name: "Translation (Legal)", desc: "Certified-quality legal translation. Contracts, filings, regulations.", cat: "translation", price: 0.15, tags: ["translation", "legal", "certified"] },
  { p: providers.data, name: "Website Localization", desc: "Translate and localize entire websites. Preserves HTML structure.", cat: "translation", price: 2.00, tags: ["localization", "website", "translation"] },

  // ═══ COMMUNICATION VARIANTS ════════════════════
  { p: providers.comm, name: "Email Verification (Bulk)", desc: "Verify up to 1000 email addresses. Syntax, MX, deliverability.", cat: "communication", price: 0.50, tags: ["email", "bulk", "verification"] },
  { p: providers.comm, name: "SMS (International)", desc: "Send SMS to 200+ countries. Delivery confirmation included.", cat: "communication", price: 0.05, tags: ["sms", "international"] },
  { p: providers.comm, name: "WhatsApp Message", desc: "Send WhatsApp messages via Business API. Templates and free-form.", cat: "communication", price: 0.03, tags: ["whatsapp", "messaging"] },
  { p: providers.comm, name: "Slack Integration", desc: "Send messages to Slack channels or DMs via webhook.", cat: "communication", price: 0.01, tags: ["slack", "messaging", "team"] },
  { p: providers.comm, name: "Push Notification", desc: "Send push notifications to iOS and Android devices.", cat: "communication", price: 0.005, tags: ["push", "notification", "mobile"] },
];

let count = 0;
for (const v of variants) {
  try {
    mkt.listService({
      provider_id: v.p,
      name: v.name,
      description: v.desc,
      category: v.cat,
      price_usd: v.price,
      price_model: "per_request",
      tags: v.tags,
    });
    count++;
  } catch (e) {
    console.error("  Skip:", v.name, e.message);
  }
}

const stats = mkt.getMarketplaceStats();
console.log(`\nVariants seeded: ${count} new services`);
console.log(`Total: ${stats.services} services across ${stats.providers} providers`);
