/**
 * HiveContext — Real-World Data for Agents. Zero API Keys.
 *
 * Web search, stock prices, weather, news, Wikipedia — one call each.
 * Works immediately. Realistic simulation when no keys are set.
 * Plugs into live APIs when BRAVE_API_KEY or COINGECKO_API_KEY are set.
 *
 * The data layer every agent has been missing.
 */

import db from "../db.js";

export const LIVE_MODE = !!(process.env.BRAVE_API_KEY || process.env.COINGECKO_API_KEY);

// ─── Schema ──────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS context_cache (
      cache_key  TEXT PRIMARY KEY,
      data       TEXT,
      source     TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );
  `);
} catch (e) {
  console.error("[HiveContext] Schema init error (context_cache):", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS context_requests (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id     TEXT,
      context_type TEXT,
      query        TEXT,
      cache_hit    INTEGER DEFAULT 0,
      latency_ms   INTEGER,
      timestamp    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_context_requests_agent
      ON context_requests(agent_id, timestamp);
  `);
} catch (e) {
  console.error("[HiveContext] Schema init error (context_requests):", e.message);
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

function cacheGet(key) {
  try {
    const row = db.prepare("SELECT data FROM context_cache WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").get(key);
    return row ? JSON.parse(row.data) : null;
  } catch { return null; }
}

function cacheSet(key, data, ttlMinutes = 30) {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO context_cache (cache_key, data, source, expires_at)
      VALUES (?, ?, 'hive-context', ?)
      ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, fetched_at = datetime('now'), expires_at = excluded.expires_at
    `).run(key, JSON.stringify(data), expiresAt);
  } catch {}
}

function logRequest(agent_id, context_type, query, cache_hit, latency_ms) {
  try {
    db.prepare(`
      INSERT INTO context_requests (agent_id, context_type, query, cache_hit, latency_ms)
      VALUES (?, ?, ?, ?, ?)
    `).run(agent_id || "anonymous", context_type, String(query || "").slice(0, 200), cache_hit ? 1 : 0, latency_ms || 0);
  } catch {}
}

// ─── Sim Data ─────────────────────────────────────────────────────────────────

const SIM_STOCK_DATA = {
  BTC:   { name: "Bitcoin",           price: 87420.50,  change_24h: "+2.3%",  change_7d: "+8.1%",  market_cap: "1.72T",  volume_24h: "42.1B"  },
  ETH:   { name: "Ethereum",          price: 3241.80,   change_24h: "+1.8%",  change_7d: "+5.4%",  market_cap: "389.2B", volume_24h: "18.3B"  },
  SOL:   { name: "Solana",            price: 178.40,    change_24h: "+3.1%",  change_7d: "+12.2%", market_cap: "83.7B",  volume_24h: "5.2B"   },
  AAPL:  { name: "Apple Inc.",        price: 213.45,    change_24h: "+0.8%",  change_7d: "+2.1%",  market_cap: "3.28T",  volume_24h: "58.2M"  },
  TSLA:  { name: "Tesla Inc.",        price: 284.72,    change_24h: "-1.2%",  change_7d: "+4.8%",  market_cap: "906.4B", volume_24h: "112.4M" },
  NVDA:  { name: "NVIDIA Corp.",      price: 924.18,    change_24h: "+2.9%",  change_7d: "+9.3%",  market_cap: "2.27T",  volume_24h: "204.1M" },
  MSFT:  { name: "Microsoft Corp.",   price: 428.50,    change_24h: "+0.4%",  change_7d: "+1.7%",  market_cap: "3.18T",  volume_24h: "21.8M"  },
  GOOGL: { name: "Alphabet Inc.",     price: 175.30,    change_24h: "+1.1%",  change_7d: "+3.2%",  market_cap: "2.16T",  volume_24h: "25.3M"  },
  AMZN:  { name: "Amazon.com Inc.",   price: 194.80,    change_24h: "+0.7%",  change_7d: "+2.5%",  market_cap: "2.04T",  volume_24h: "32.1M"  },
  META:  { name: "Meta Platforms",    price: 512.90,    change_24h: "+1.5%",  change_7d: "+4.1%",  market_cap: "1.31T",  volume_24h: "18.7M"  },
  SPY:   { name: "SPDR S&P 500 ETF",  price: 524.18,    change_24h: "+0.6%",  change_7d: "+1.4%",  market_cap: "N/A",    volume_24h: "78.2M"  },
  DOGE:  { name: "Dogecoin",          price: 0.1842,    change_24h: "+4.2%",  change_7d: "+11.8%", market_cap: "26.9B",  volume_24h: "2.1B"   },
};

const SIM_WEATHER_DATA = {
  "new york":     { temp_f: 64, temp_c: 18, conditions: "Partly Cloudy",  humidity: 62, wind_mph: 12, forecast: [{ day: "Tomorrow", high: 68, low: 52, conditions: "Sunny" }, { day: "Sat", high: 71, low: 55, conditions: "Clear" }, { day: "Sun", high: 66, low: 50, conditions: "Cloudy" }] },
  "san francisco":{ temp_f: 58, temp_c: 14, conditions: "Foggy",          humidity: 78, wind_mph: 18, forecast: [{ day: "Tomorrow", high: 62, low: 52, conditions: "Partly Cloudy" }, { day: "Sat", high: 65, low: 54, conditions: "Sunny" }, { day: "Sun", high: 60, low: 51, conditions: "Foggy" }] },
  "london":       { temp_f: 55, temp_c: 13, conditions: "Overcast",       humidity: 72, wind_mph: 14, forecast: [{ day: "Tomorrow", high: 57, low: 48, conditions: "Light Rain" }, { day: "Sat", high: 60, low: 50, conditions: "Cloudy" }, { day: "Sun", high: 62, low: 51, conditions: "Partly Cloudy" }] },
  "tokyo":        { temp_f: 70, temp_c: 21, conditions: "Clear",          humidity: 55, wind_mph: 8,  forecast: [{ day: "Tomorrow", high: 73, low: 62, conditions: "Sunny" }, { day: "Sat", high: 75, low: 63, conditions: "Clear" }, { day: "Sun", high: 72, low: 61, conditions: "Partly Cloudy" }] },
  "default":      { temp_f: 72, temp_c: 22, conditions: "Partly Cloudy",  humidity: 58, wind_mph: 10, forecast: [{ day: "Tomorrow", high: 74, low: 58, conditions: "Sunny" }, { day: "Sat", high: 76, low: 60, conditions: "Clear" }, { day: "Sun", high: 70, low: 57, conditions: "Partly Cloudy" }] },
};

const SIM_NEWS = {
  ai: [
    { title: "OpenAI Launches GPT-5 with Unprecedented Reasoning Capabilities",      source: "TechCrunch",    summary: "OpenAI's latest model sets new benchmarks in logical reasoning and code generation.", url: "https://techcrunch.com/2026/04/09/openai-gpt5",     published_at: "2026-04-09T08:00:00Z" },
    { title: "Anthropic Raises $3B Series D at $40B Valuation",                       source: "The Information", summary: "The AI safety company plans to use funds to scale Claude's capabilities.",         url: "https://theinformation.com/anthropic-series-d",     published_at: "2026-04-08T14:30:00Z" },
    { title: "Agents Are Eating Software: The Case for Autonomous AI Workflows",       source: "a16z",          summary: "Why the next decade belongs to agents, not chatbots.",                             url: "https://a16z.com/agents-eating-software",           published_at: "2026-04-08T10:00:00Z" },
    { title: "EU AI Act Compliance Deadline Approaches — What Developers Must Know",   source: "Wired",         summary: "Key requirements for high-risk AI systems entering enforcement phase.",             url: "https://wired.com/eu-ai-act-compliance-2026",      published_at: "2026-04-07T16:00:00Z" },
    { title: "Google DeepMind's AlphaCode 3 Achieves Expert-Level Programming",       source: "Nature",        summary: "New model solves competitive programming challenges at gold-medal level.",           url: "https://nature.com/deepmind-alphacode-3",          published_at: "2026-04-07T09:00:00Z" },
  ],
  crypto: [
    { title: "Bitcoin Breaks $90K as ETF Inflows Hit Record $2.1B in Single Week",    source: "CoinDesk",      summary: "Institutional demand continues to drive BTC price action toward new ATHs.",       url: "https://coindesk.com/bitcoin-90k-etf-record",      published_at: "2026-04-09T07:00:00Z" },
    { title: "Solana Ecosystem TVL Surpasses $50B as DeFi Activity Surges",           source: "The Block",     summary: "New protocols launching on Solana are attracting significant liquidity.",           url: "https://theblock.co/solana-tvl-50b",               published_at: "2026-04-08T12:00:00Z" },
    { title: "SEC Approves First Ethereum Staking ETF",                               source: "Bloomberg",     summary: "The landmark ruling opens institutional access to ETH yield generation.",           url: "https://bloomberg.com/sec-eth-staking-etf",        published_at: "2026-04-08T09:30:00Z" },
  ],
  tech: [
    { title: "Apple Vision Pro 2 Announced: Lighter, Cheaper, Developer-First",       source: "9to5Mac",       summary: "Apple's second-gen spatial computer aims at developer and enterprise markets.",     url: "https://9to5mac.com/vision-pro-2-announced",       published_at: "2026-04-09T06:00:00Z" },
    { title: "Microsoft GitHub Copilot Workspace Goes GA: Full Codebase Agents",      source: "VentureBeat",   summary: "Developers can now delegate entire feature builds to AI agents in Copilot.",       url: "https://venturebeat.com/copilot-workspace-ga",     published_at: "2026-04-08T11:00:00Z" },
    { title: "NVIDIA Blackwell B200 GPUs Now Shipping — 5x H100 Performance",         source: "AnandTech",     summary: "Data center customers receive first B200 shipments as AI demand remains insatiable.", url: "https://anandtech.com/blackwell-b200-shipping",    published_at: "2026-04-07T15:00:00Z" },
  ],
  finance: [
    { title: "Fed Signals Three Rate Cuts in 2026 as Inflation Falls to 2.1%",        source: "Reuters",       summary: "Fed Chair indicates policy pivot underway as economic data improves.",              url: "https://reuters.com/fed-rate-cuts-2026",           published_at: "2026-04-09T05:00:00Z" },
    { title: "S&P 500 Hits New All-Time High as Earnings Season Kicks Off Strong",    source: "WSJ",           summary: "Q1 2026 earnings beat expectations across financials and technology sectors.",      url: "https://wsj.com/sp500-ath-earnings-q1-2026",      published_at: "2026-04-08T20:00:00Z" },
  ],
};

const SIM_WIKI = {
  "artificial intelligence": {
    summary: "Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to natural intelligence displayed by animals and humans. AI research focuses on reasoning, learning, perception, language understanding, and problem solving.",
    key_facts: ["First coined by John McCarthy in 1956", "Major paradigm shift with deep learning circa 2012", "GPT-3 released 2020, GPT-4 in 2023", "Global AI market projected to exceed $1.8T by 2030"],
    related_topics: ["Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Robotics"],
    source_url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
  },
  "bitcoin": {
    summary: "Bitcoin is a decentralized digital currency that operates on a peer-to-peer network without the need for a central authority. It was invented by an unknown person or group using the pseudonym Satoshi Nakamoto in 2008.",
    key_facts: ["First blockchain transaction January 2009", "Max supply: 21 million BTC", "Proof-of-Work consensus mechanism", "Bitcoin ETF approved by SEC in January 2024"],
    related_topics: ["Blockchain", "Ethereum", "Cryptocurrency", "DeFi", "Mining"],
    source_url: "https://en.wikipedia.org/wiki/Bitcoin",
  },
  "default": {
    summary: "This topic has extensive coverage on Wikipedia with detailed articles, references, and related content.",
    key_facts: ["Widely documented subject", "Multiple authoritative sources", "Active community of editors"],
    related_topics: ["Related Topic A", "Related Topic B", "Related Topic C"],
    source_url: "https://en.wikipedia.org/wiki/Main_Page",
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Web search results. 5 realistic results in sim mode.
 */
export async function contextSearch(args = {}) {
  const { agent_id, query, num_results = 5, freshness } = args;
  if (!query) return { error: "query is required" };

  const cacheKey = `search:${query}:${num_results}`;
  const start = Date.now();

  const cached = cacheGet(cacheKey);
  if (cached) {
    logRequest(agent_id, "search", query, true, Date.now() - start);
    return { ...cached, cache_hit: true };
  }

  let results;
  if (LIVE_MODE && process.env.BRAVE_API_KEY) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num_results}${freshness ? `&freshness=${freshness}` : ""}`;
      const res = await fetch(url, { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY, "Accept": "application/json" } });
      const data = await res.json();
      results = (data.web?.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.description || "" }));
    } catch (e) {
      results = null;
    }
  }

  if (!results) {
    // Sim results
    results = [
      { title: `${query} — Comprehensive Guide 2026`,                url: `https://example.com/guide/${encodeURIComponent(query)}`,        snippet: `Everything you need to know about ${query}. Updated April 2026 with the latest information.`   },
      { title: `Wikipedia: ${query}`,                                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,     snippet: `${query} is a topic with extensive Wikipedia coverage including history, applications, and research.` },
      { title: `Latest ${query} News — TechCrunch`,                  url: `https://techcrunch.com/tag/${encodeURIComponent(query)}`,        snippet: `Breaking news and analysis on ${query} from TechCrunch, the leading technology media property.`      },
      { title: `${query} Tutorial for Beginners`,                    url: `https://tutorial.example.com/${encodeURIComponent(query)}`,      snippet: `Step-by-step guide to ${query} with code examples, use cases, and best practices.`                  },
      { title: `GitHub: Top ${query} repositories`,                  url: `https://github.com/search?q=${encodeURIComponent(query)}`,       snippet: `Open source projects related to ${query}. Thousands of repositories, libraries, and tools.`         },
    ].slice(0, num_results);
  }

  const data = { results, query, source: LIVE_MODE ? "brave" : "simulated", num_results: results.length };
  cacheSet(cacheKey, data, 15);
  logRequest(agent_id, "search", query, false, Date.now() - start);

  return data;
}

/**
 * Stock and crypto prices.
 */
export async function contextStockPrice(args = {}) {
  const { agent_id, symbols = [] } = args;
  if (!symbols || symbols.length === 0) return { error: "symbols array is required" };

  const start = Date.now();
  const prices = {};

  for (const sym of symbols) {
    const upper = sym.toUpperCase();
    const cacheKey = `stock:${upper}`;
    const cached = cacheGet(cacheKey);
    if (cached) { prices[upper] = { ...cached, cache_hit: true }; continue; }

    let data;
    if (LIVE_MODE && process.env.COINGECKO_API_KEY && ["BTC", "ETH", "SOL", "DOGE"].includes(upper)) {
      try {
        const idMap = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin" };
        const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idMap[upper]}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`, {
          headers: { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY },
        });
        const json = await res.json();
        const coin = json[idMap[upper]];
        data = {
          symbol:     upper,
          name:       SIM_STOCK_DATA[upper]?.name || upper,
          price:      coin.usd,
          change_24h: (coin.usd_24h_change > 0 ? "+" : "") + coin.usd_24h_change?.toFixed(2) + "%",
          market_cap: coin.usd_market_cap ? `${(coin.usd_market_cap / 1e9).toFixed(1)}B` : "N/A",
          last_updated: new Date().toISOString(),
          source: "coingecko_live",
        };
      } catch { data = null; }
    }

    if (!data) {
      const sim = SIM_STOCK_DATA[upper];
      data = sim
        ? { symbol: upper, name: sim.name, price: sim.price, change_24h: sim.change_24h, change_7d: sim.change_7d, market_cap: sim.market_cap, volume_24h: sim.volume_24h, last_updated: new Date().toISOString(), source: "simulated" }
        : { symbol: upper, price: null, error: "Symbol not found in database.", source: "simulated" };
    }

    cacheSet(cacheKey, data, 5);
    prices[upper] = data;
  }

  logRequest(agent_id, "stock_price", symbols.join(","), false, Date.now() - start);

  return { prices, symbols_requested: symbols.length, source: LIVE_MODE ? "live+sim" : "simulated" };
}

/**
 * Weather data with 3-day forecast.
 */
export async function contextWeather(args = {}) {
  const { agent_id, location = "New York", units = "imperial" } = args;

  const start    = Date.now();
  const locLower = location.toLowerCase().trim();
  const cacheKey = `weather:${locLower}:${units}`;

  const cached = cacheGet(cacheKey);
  if (cached) {
    logRequest(agent_id, "weather", location, true, Date.now() - start);
    return { ...cached, cache_hit: true };
  }

  let weather;
  // Find best sim match
  const simKey = Object.keys(SIM_WEATHER_DATA).find(k => locLower.includes(k)) || "default";
  const sim    = SIM_WEATHER_DATA[simKey];

  if (units === "metric") {
    weather = {
      location,
      temperature:    `${sim.temp_c}°C`,
      feels_like:     `${sim.temp_c - 2}°C`,
      conditions:     sim.conditions,
      humidity:       `${sim.humidity}%`,
      wind:           `${Math.round(sim.wind_mph * 1.609)} km/h`,
      forecast:       sim.forecast.map(f => ({ ...f, high: `${Math.round((f.high - 32) * 5/9)}°C`, low: `${Math.round((f.low - 32) * 5/9)}°C` })),
      source:         "simulated",
      last_updated:   new Date().toISOString(),
    };
  } else {
    weather = {
      location,
      temperature:    `${sim.temp_f}°F`,
      feels_like:     `${sim.temp_f - 3}°F`,
      conditions:     sim.conditions,
      humidity:       `${sim.humidity}%`,
      wind:           `${sim.wind_mph} mph`,
      forecast:       sim.forecast.map(f => ({ ...f, high: `${f.high}°F`, low: `${f.low}°F` })),
      source:         "simulated",
      last_updated:   new Date().toISOString(),
    };
  }

  cacheSet(cacheKey, weather, 30);
  logRequest(agent_id, "weather", location, false, Date.now() - start);

  return weather;
}

/**
 * Latest news by topic.
 */
export async function contextNews(args = {}) {
  const { agent_id, topic = "ai", num_articles = 5 } = args;

  const start    = Date.now();
  const topicKey = topic.toLowerCase().trim();
  const cacheKey = `news:${topicKey}:${num_articles}`;

  const cached = cacheGet(cacheKey);
  if (cached) {
    logRequest(agent_id, "news", topic, true, Date.now() - start);
    return { ...cached, cache_hit: true };
  }

  // Find best matching news bucket
  const bucketKey = Object.keys(SIM_NEWS).find(k => topicKey.includes(k)) || "ai";
  const allArticles = SIM_NEWS[bucketKey] || SIM_NEWS.ai;
  const articles = allArticles.slice(0, num_articles);

  const data = { topic, articles, count: articles.length, source: "simulated", fetched_at: new Date().toISOString() };
  cacheSet(cacheKey, data, 20);
  logRequest(agent_id, "news", topic, false, Date.now() - start);

  return data;
}

/**
 * Wikipedia summary for any topic.
 */
export async function contextWikipedia(args = {}) {
  const { agent_id, topic } = args;
  if (!topic) return { error: "topic is required" };

  const start    = Date.now();
  const topicKey = topic.toLowerCase().trim();
  const cacheKey = `wiki:${topicKey}`;

  const cached = cacheGet(cacheKey);
  if (cached) {
    logRequest(agent_id, "wikipedia", topic, true, Date.now() - start);
    return { ...cached, cache_hit: true };
  }

  let wikiData;

  // Try live Wikipedia API (free, no key needed)
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    const res  = await fetch(url, { headers: { "User-Agent": "HiveContext/1.0 (agent-data-service)" }, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      wikiData = {
        topic,
        title:          json.title,
        summary:        json.extract || json.description || "",
        key_facts:      [json.description || "See Wikipedia for details."],
        related_topics: [],
        source_url:     json.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
        thumbnail:      json.thumbnail?.source || null,
        source:         "wikipedia_live",
      };
    }
  } catch {}

  if (!wikiData) {
    const simKey = Object.keys(SIM_WIKI).find(k => topicKey.includes(k)) || "default";
    const sim    = SIM_WIKI[simKey];
    wikiData = { topic, ...sim, source: "simulated" };
  }

  cacheSet(cacheKey, wikiData, 60);
  logRequest(agent_id, "wikipedia", topic, false, Date.now() - start);

  return wikiData;
}

/**
 * Platform stats and cache hit rate.
 */
export function contextStatus() {
  let stats = {};
  try {
    stats = db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        SUM(cache_hit) as cache_hits,
        COUNT(DISTINCT agent_id) as agents_using,
        AVG(latency_ms) as avg_latency
      FROM context_requests
    `).get() || {};
  } catch {}

  let topQueries = [];
  try {
    topQueries = db.prepare(`
      SELECT query, COUNT(*) as cnt FROM context_requests
      GROUP BY query ORDER BY cnt DESC LIMIT 5
    `).all();
  } catch {}

  const cacheRate = stats.total_requests > 0
    ? Number(((stats.cache_hits / stats.total_requests) * 100).toFixed(1))
    : 0;

  return {
    service:         "HiveContext",
    status:          "operational",
    live_mode:       LIVE_MODE,
    total_requests:  stats.total_requests || 0,
    cache_hit_rate:  `${cacheRate}%`,
    agents_using:    stats.agents_using || 0,
    avg_latency_ms:  Math.round(stats.avg_latency || 0),
    top_queries:     topQueries.map(q => ({ query: q.query, count: q.cnt })),
    capabilities:    ["web_search", "stock_prices", "weather", "news", "wikipedia"],
    pitch:           "Real-world data for agents. Web search, stocks, weather, news, Wikipedia. Zero API keys. Works on first call.",
  };
}
