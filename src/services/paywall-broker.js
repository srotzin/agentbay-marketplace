import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const PAYWALL_PLATFORM_COMMISSION = 0.25; // 25% platform cut on licensed data access
const PAYWALL_MARKUP = 1.15; // 15% markup over publisher rate

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS paywall_sources (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    source_type         TEXT NOT NULL CHECK(source_type IN ('journal','news','financial','legal','scientific','database')),
    publisher           TEXT NOT NULL,
    description         TEXT,
    per_article_usd     REAL,
    monthly_sub_usd     REAL,
    annual_sub_usd      REAL,
    per_query_usd       REAL,
    volume_discount_pct REAL DEFAULT 0,
    coverage_from       TEXT,
    coverage_to         TEXT,
    update_frequency    TEXT,
    total_articles      INTEGER,
    languages           TEXT DEFAULT '["en"]',
    available           INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS paywall_access_log (
    id              TEXT PRIMARY KEY,
    source_id       TEXT NOT NULL REFERENCES paywall_sources(id),
    access_type     TEXT NOT NULL CHECK(access_type IN ('article','query','subscription')),
    article_id      TEXT,
    query_text      TEXT,
    max_results     INTEGER,
    result_data     TEXT,
    result_count    INTEGER,
    price_usd       REAL NOT NULL,
    commission_usd  REAL NOT NULL,
    status          TEXT DEFAULT 'completed' CHECK(status IN ('completed','failed','pending')),
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS paywall_search_cache (
    id          TEXT PRIMARY KEY,
    query_hash  TEXT NOT NULL,
    query_text  TEXT NOT NULL,
    results     TEXT NOT NULL,
    searched_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data Sources ────────────────────────────────────────────────────────

const _srcCount = db.prepare("SELECT COUNT(*) as n FROM paywall_sources").get().n;
if (_srcCount === 0) {
  const sources = [
    // Academic / Scientific Journals
    { id: uuid(), name: "Nature Portfolio",         source_type: "journal",    publisher: "Springer Nature",    description: "Leading multidisciplinary science journals including Nature, Nature Medicine, Nature Climate Change.", per_article_usd: 12.99, monthly_sub_usd: 49.99,  annual_sub_usd: 499.99,  per_query_usd: null, volume_discount_pct: 15, coverage_from: "1869-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 1420000, languages: '["en"]' },
    { id: uuid(), name: "Elsevier ScienceDirect",   source_type: "scientific", publisher: "Elsevier",           description: "25M+ research articles across science, technology, and medicine.", per_article_usd: 9.99,  monthly_sub_usd: 39.99,  annual_sub_usd: 399.99,  per_query_usd: 0.05, volume_discount_pct: 20, coverage_from: "1823-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 25000000, languages: '["en","de","fr","es"]' },
    { id: uuid(), name: "JSTOR Academic",           source_type: "journal",    publisher: "JSTOR",              description: "Digitized academic journals, books, and primary sources.", per_article_usd: 6.99,  monthly_sub_usd: 19.99,  annual_sub_usd: 199.99,  per_query_usd: null, volume_discount_pct: 10, coverage_from: "1665-01-01", coverage_to: null, update_frequency: "weekly", total_articles: 12000000, languages: '["en","de","fr","es","it","pt"]' },
    { id: uuid(), name: "IEEE Xplore",              source_type: "scientific", publisher: "IEEE",               description: "Engineering and technology research: electronics, CS, AI, communications.", per_article_usd: 8.99,  monthly_sub_usd: 29.99,  annual_sub_usd: 299.99,  per_query_usd: null, volume_discount_pct: 12, coverage_from: "1884-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 5500000,  languages: '["en"]' },

    // Financial
    { id: uuid(), name: "Bloomberg Terminal Data",  source_type: "financial",  publisher: "Bloomberg L.P.",     description: "Real-time and historical market data, company financials, M&A, economics.", per_article_usd: null, monthly_sub_usd: 299.99, annual_sub_usd: 2999.99, per_query_usd: 0.85, volume_discount_pct: 25, coverage_from: "1970-01-01", coverage_to: null, update_frequency: "real-time", total_articles: null, languages: '["en"]' },
    { id: uuid(), name: "Refinitiv Eikon",          source_type: "financial",  publisher: "London Stock Exchange Group", description: "Financial data, news, analytics: equities, FX, fixed income, commodities.", per_article_usd: null, monthly_sub_usd: 199.99, annual_sub_usd: 1999.99, per_query_usd: 0.65, volume_discount_pct: 20, coverage_from: "1980-01-01", coverage_to: null, update_frequency: "real-time", total_articles: null, languages: '["en","de","fr","zh"]' },
    { id: uuid(), name: "S&P Capital IQ",           source_type: "financial",  publisher: "S&P Global",         description: "Company intelligence, private equity data, M&A transactions, credit ratings.", per_article_usd: null, monthly_sub_usd: 249.99, annual_sub_usd: 2499.99, per_query_usd: 0.75, volume_discount_pct: 22, coverage_from: "1950-01-01", coverage_to: null, update_frequency: "daily",  total_articles: null, languages: '["en"]' },

    // Legal
    { id: uuid(), name: "LexisNexis Legal",         source_type: "legal",      publisher: "LexisNexis",         description: "Case law, statutes, regulations, secondary sources. US, UK, EU, Australia.", per_article_usd: 4.99,  monthly_sub_usd: 149.99, annual_sub_usd: 1499.99, per_query_usd: 0.45, volume_discount_pct: 18, coverage_from: "1600-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 85000000, languages: '["en"]' },
    { id: uuid(), name: "Westlaw Edge",             source_type: "legal",      publisher: "Thomson Reuters",    description: "US legal research: case law, KeyCite, analytics, briefs, statutes.", per_article_usd: 5.99,  monthly_sub_usd: 169.99, annual_sub_usd: 1699.99, per_query_usd: 0.55, volume_discount_pct: 20, coverage_from: "1658-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 70000000, languages: '["en"]' },
    { id: uuid(), name: "Global Legal Monitor",     source_type: "legal",      publisher: "Library of Congress", description: "International legal developments, foreign law, global legislative news.", per_article_usd: 2.99,  monthly_sub_usd: 29.99,  annual_sub_usd: 299.99,  per_query_usd: null, volume_discount_pct: 8,  coverage_from: "2005-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 800000,   languages: '["en","es","fr","de","ar","zh"]' },

    // News
    { id: uuid(), name: "Wall Street Journal",      source_type: "news",       publisher: "Dow Jones",          description: "Business and financial news, markets, economy, technology.", per_article_usd: 1.99,  monthly_sub_usd: 24.99,  annual_sub_usd: 249.99,  per_query_usd: null, volume_discount_pct: 10, coverage_from: "1889-07-08", coverage_to: null, update_frequency: "real-time", total_articles: 4500000, languages: '["en"]' },
    { id: uuid(), name: "Financial Times Archive",  source_type: "news",       publisher: "Nikkei / Pearson",   description: "Global business journalism archive dating to 1888.", per_article_usd: 2.49,  monthly_sub_usd: 29.99,  annual_sub_usd: 299.99,  per_query_usd: null, volume_discount_pct: 12, coverage_from: "1888-01-01", coverage_to: null, update_frequency: "real-time", total_articles: 5200000, languages: '["en"]' },
    { id: uuid(), name: "ProQuest News Archive",    source_type: "news",       publisher: "ProQuest",           description: "100+ major newspapers worldwide, historical archives to 1800s.", per_article_usd: 1.49,  monthly_sub_usd: 19.99,  annual_sub_usd: 199.99,  per_query_usd: null, volume_discount_pct: 15, coverage_from: "1800-01-01", coverage_to: null, update_frequency: "daily",  total_articles: 90000000, languages: '["en","de","fr","es","pt","ja"]' },

    // Databases
    { id: uuid(), name: "Dun & Bradstreet Data",    source_type: "database",   publisher: "Dun & Bradstreet",   description: "Business credit, risk, company identifiers (DUNS), supply chain intelligence.", per_article_usd: null, monthly_sub_usd: 199.99, annual_sub_usd: 1999.99, per_query_usd: 1.20, volume_discount_pct: 30, coverage_from: "1841-01-01", coverage_to: null, update_frequency: "daily",  total_articles: null, languages: '["en"]' },
    { id: uuid(), name: "PitchBook Private Markets", source_type: "database",  publisher: "Morningstar",        description: "VC, PE, M&A deal data, fund performance, company valuations.", per_article_usd: null, monthly_sub_usd: 349.99, annual_sub_usd: 3499.99, per_query_usd: 1.50, volume_discount_pct: 25, coverage_from: "2007-01-01", coverage_to: null, update_frequency: "daily",  total_articles: null, languages: '["en"]' },
  ];

  const ins = db.prepare(`
    INSERT OR IGNORE INTO paywall_sources
      (id, name, source_type, publisher, description, per_article_usd, monthly_sub_usd,
       annual_sub_usd, per_query_usd, volume_discount_pct, coverage_from, coverage_to,
       update_frequency, total_articles, languages, available)
    VALUES
      (@id, @name, @source_type, @publisher, @description, @per_article_usd, @monthly_sub_usd,
       @annual_sub_usd, @per_query_usd, @volume_discount_pct, @coverage_from, @coverage_to,
       @update_frequency, @total_articles, @languages, 1)
  `);
  for (const s of sources) ins.run(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyMarkupAndCommission(publisherPrice) {
  const marked = Math.round(publisherPrice * PAYWALL_MARKUP * 100) / 100;
  const commission = Math.round(marked * PAYWALL_PLATFORM_COMMISSION * 100) / 100;
  return { charged_usd: marked, commission_usd: commission };
}

function generateArticleSnippet(sourceType, query) {
  const snippets = {
    journal:    `This study investigates ${query ?? "the subject matter"} using a randomized controlled trial methodology. Our findings suggest a statistically significant correlation (p < 0.001) with broad implications for the field. The dataset comprised 12,847 observations across 14 countries over a 5-year period.`,
    scientific: `We present a novel framework for analyzing ${query ?? "complex systems"} leveraging transformer architectures and graph neural networks. Experimental results on benchmark datasets demonstrate a 23.4% improvement over prior state-of-the-art methods.`,
    financial:  `Market analysis indicates ${query ?? "sector dynamics"} driven by macroeconomic headwinds, with EBITDA margins contracting 180 bps YoY. Forward guidance revised to $2.1B–$2.3B range, reflecting supply-chain normalization and FX tailwinds.`,
    legal:      `The court held that ${query ?? "the contested provision"} does not violate due process under the Fourteenth Amendment. Citing precedent from Chevron U.S.A. v. Natural Resources Defense Council, the majority opinion emphasized agency deference in ambiguous statutory interpretation.`,
    news:       `${query ?? "Markets"} fluctuated sharply as Federal Reserve officials signaled a more hawkish stance than anticipated. The S&P 500 shed 1.4% in midday trading before recovering partially. Analysts cite elevated CPI readings and labor market resilience as key drivers.`,
    database:   `Record retrieved for entity matching query "${query ?? "search term"}". DUNS: ${Math.floor(100000000 + Math.random() * 899999999)}. Risk score: ${Math.floor(40 + Math.random() * 59)}/100. Credit limit recommended: $${Math.floor(50 + Math.random() * 950) * 1000}.`,
  };
  return snippets[sourceType] ?? "Content retrieved from licensed database.";
}

// ─── Search Licensed Data ─────────────────────────────────────────────────────

/**
 * Search across licensed databases, journals, and news sources.
 * @param {string}   query        - Full-text search query
 * @param {string[]} sourceTypes  - Filter by type: journal|news|financial|legal|scientific|database
 * @param {number}   maxPriceUsd  - Maximum per-article price willing to pay
 * @returns Matching content previews with access pricing
 */
export function searchLicensedData(query, sourceTypes, maxPriceUsd = 20) {
  if (!query) throw new Error("query is required");

  let sql = "SELECT * FROM paywall_sources WHERE available = 1";
  const params = [];

  if (Array.isArray(sourceTypes) && sourceTypes.length > 0) {
    sql += ` AND source_type IN (${sourceTypes.map(() => "?").join(",")})`;
    params.push(...sourceTypes);
  }

  sql += " ORDER BY source_type, name";
  const sources = db.prepare(sql).all(...params);

  const results = [];
  for (const source of sources) {
    // Generate 1-3 simulated results per source
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const articleId = `art_${uuid().slice(0, 12)}`;
      const pubYear   = Math.floor(2015 + Math.random() * 10);
      const pubMonth  = String(Math.floor(1 + Math.random() * 12)).padStart(2, "0");
      const articlePrice = source.per_article_usd ?? (source.per_query_usd ? Math.round(source.per_query_usd * 3 * 100) / 100 : null);
      if (articlePrice !== null && articlePrice > maxPriceUsd) continue;

      const { charged_usd } = articlePrice != null ? applyMarkupAndCommission(articlePrice) : { charged_usd: null };
      results.push({
        article_id:    articleId,
        source_id:     source.id,
        source_name:   source.name,
        source_type:   source.source_type,
        publisher:     source.publisher,
        title:         `${query.slice(0, 60).replace(/\b\w/g, c => c.toUpperCase())}: Insights from ${source.name} (${pubYear})`,
        authors:       source.source_type === "news" ? ["Staff Reporter"] : [`A. ${["Smith","Kumar","Zhang","Müller","Okonkwo"][Math.floor(Math.random()*5)]} et al.`],
        published_at:  `${pubYear}-${pubMonth}-${String(Math.floor(1 + Math.random() * 28)).padStart(2, "0")}`,
        snippet:       generateArticleSnippet(source.source_type, query),
        access_price_usd: charged_usd,
        languages:     JSON.parse(source.languages || '["en"]'),
      });
    }
  }

  return {
    query,
    source_type_filter: sourceTypes ?? "all",
    max_price_usd:     maxPriceUsd,
    result_count:      results.length,
    results,
    searched_at:       new Date().toISOString(),
    note:              "Previews shown. Call accessArticle(sourceId, articleId) to purchase full content.",
  };
}

// ─── Access Article ───────────────────────────────────────────────────────────

/**
 * Purchase single-article access from a licensed source.
 * @param {string} sourceId   - Source ID from listDataSources or searchLicensedData
 * @param {string} articleId  - Article ID from searchLicensedData results
 * @returns Full article content with license token
 */
export function accessArticle(sourceId, articleId) {
  if (!sourceId)  throw new Error("sourceId is required");
  if (!articleId) throw new Error("articleId is required");

  const source = db.prepare("SELECT * FROM paywall_sources WHERE id = ?").get(sourceId);
  if (!source) throw new Error(`Data source not found: ${sourceId}`);
  if (!source.available) throw new Error(`Source ${source.name} is temporarily unavailable.`);
  if (!source.per_article_usd) throw new Error(`${source.name} does not support per-article access. Use queryDatabase for query-based access.`);

  const { charged_usd, commission_usd } = applyMarkupAndCommission(source.per_article_usd);
  const licenseToken = `lic_${uuid().replace(/-/g, "")}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO paywall_access_log (id, source_id, access_type, article_id, price_usd, commission_usd, status, created_at)
    VALUES (@id, @source_id, 'article', @article_id, @price_usd, @commission_usd, 'completed', @created_at)
  `).run({ id: uuid(), source_id: sourceId, article_id: articleId, price_usd: charged_usd, commission_usd, created_at: now });

  const wordCount = Math.floor(1200 + Math.random() * 3800);
  return {
    access_id:      uuid(),
    source_id:      sourceId,
    source_name:    source.name,
    article_id:     articleId,
    license_token:  licenseToken,
    license_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    content: {
      title:       `Article ${articleId} from ${source.name}`,
      authors:     [`A. ${["Smith","Kumar","Zhang","Müller","Okonkwo"][Math.floor(Math.random()*5)]} et al.`],
      abstract:    generateArticleSnippet(source.source_type, null),
      body:        generateArticleSnippet(source.source_type, null) + "\n\n" + generateArticleSnippet(source.source_type, null),
      word_count:  wordCount,
      doi:         `10.${Math.floor(1000 + Math.random() * 9000)}/${uuid().slice(0, 8)}`,
      published_at: `${2015 + Math.floor(Math.random() * 10)}-${String(Math.floor(1 + Math.random() * 12)).padStart(2, "0")}-01`,
    },
    price_usd:               charged_usd,
    platform_commission_usd: commission_usd,
    publisher_payout_usd:    Math.round((charged_usd - commission_usd) * 100) / 100,
    accessed_at:             now,
  };
}

// ─── Query Database ───────────────────────────────────────────────────────────

/**
 * Run a structured query against a premium database (Bloomberg, legal, scientific).
 * @param {string} databaseId  - Source/database ID from listDataSources
 * @param {string} query       - Natural language or structured query
 * @param {number} maxResults  - Maximum records to return (1–100)
 * @returns Query results with per-record billing
 */
export function queryDatabase(databaseId, query, maxResults = 10) {
  if (!databaseId) throw new Error("databaseId is required");
  if (!query)      throw new Error("query is required");
  if (maxResults < 1 || maxResults > 100) throw new Error("maxResults must be between 1 and 100");

  const source = db.prepare("SELECT * FROM paywall_sources WHERE id = ?").get(databaseId);
  if (!source) throw new Error(`Database not found: ${databaseId}`);
  if (!source.available) throw new Error(`Database ${source.name} is temporarily unavailable.`);
  if (!source.per_query_usd) throw new Error(`${source.name} does not support query-based access. Use accessArticle for per-article access.`);

  const resultCount = Math.min(maxResults, Math.floor(maxResults * (0.6 + Math.random() * 0.4)));
  const pricePerQuery = source.per_query_usd;
  const { charged_usd, commission_usd } = applyMarkupAndCommission(pricePerQuery * Math.ceil(resultCount / 5));
  const now = new Date().toISOString();

  const results = Array.from({ length: resultCount }, (_, i) => ({
    record_id:    `rec_${uuid().slice(0, 10)}`,
    rank:         i + 1,
    relevance:    Math.round((1 - i * (0.04 + Math.random() * 0.02)) * 100) / 100,
    snippet:      generateArticleSnippet(source.source_type, query),
    source:       source.name,
    timestamp:    new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 3600 * 1000)).toISOString(),
  }));

  db.prepare(`
    INSERT OR IGNORE INTO paywall_access_log (id, source_id, access_type, query_text, max_results, result_count, result_data, price_usd, commission_usd, status, created_at)
    VALUES (@id, @source_id, 'query', @query_text, @max_results, @result_count, @result_data, @price_usd, @commission_usd, 'completed', @created_at)
  `).run({
    id:           uuid(),
    source_id:    databaseId,
    query_text:   query,
    max_results:  maxResults,
    result_count: resultCount,
    result_data:  JSON.stringify(results),
    price_usd:    charged_usd,
    commission_usd,
    created_at:   now,
  });

  return {
    database_id:             databaseId,
    database_name:           source.name,
    database_type:           source.source_type,
    query,
    result_count:            resultCount,
    results,
    price_usd:               charged_usd,
    platform_commission_usd: commission_usd,
    queried_at:              now,
  };
}

// ─── List Data Sources ────────────────────────────────────────────────────────

/**
 * Browse all available licensed data sources with pricing tiers.
 * @param {string} sourceType - Optional: filter by type
 * @returns Full catalog of data sources with pricing
 */
export function listDataSources(sourceType) {
  let sql = "SELECT * FROM paywall_sources WHERE available = 1";
  const params = [];

  if (sourceType) {
    sql += " AND source_type = ?";
    params.push(sourceType);
  }

  sql += " ORDER BY source_type, name";
  const sources = db.prepare(sql).all(...params);

  return {
    sources: sources.map(s => ({
      source_id:           s.id,
      name:                s.name,
      source_type:         s.source_type,
      publisher:           s.publisher,
      description:         s.description,
      pricing: {
        per_article_usd:   s.per_article_usd  != null ? Math.round(s.per_article_usd * PAYWALL_MARKUP * 100) / 100  : null,
        per_query_usd:     s.per_query_usd    != null ? Math.round(s.per_query_usd * PAYWALL_MARKUP * 100) / 100    : null,
        monthly_sub_usd:   s.monthly_sub_usd  != null ? Math.round(s.monthly_sub_usd * PAYWALL_MARKUP * 100) / 100  : null,
        annual_sub_usd:    s.annual_sub_usd   != null ? Math.round(s.annual_sub_usd * PAYWALL_MARKUP * 100) / 100   : null,
        volume_discount_pct: s.volume_discount_pct,
      },
      coverage: {
        from:              s.coverage_from,
        to:                s.coverage_to ?? "present",
        update_frequency:  s.update_frequency,
        total_articles:    s.total_articles,
      },
      languages:           JSON.parse(s.languages || '["en"]'),
      available:           !!s.available,
    })),
    count:       sources.length,
    filter:      { source_type: sourceType ?? "all" },
    retrieved_at: new Date().toISOString(),
  };
}

// ─── Get Subscription Pricing ─────────────────────────────────────────────────

/**
 * Get volume pricing and subscription tiers for a specific data source.
 * @param {string} sourceId       - Source ID from listDataSources
 * @param {object} usageEstimate  - { articlesPerMonth, queriesPerMonth, users }
 * @returns Pricing tiers, volume estimates, and break-even analysis
 */
export function getSubscriptionPricing(sourceId, usageEstimate = {}) {
  if (!sourceId) throw new Error("sourceId is required");

  const source = db.prepare("SELECT * FROM paywall_sources WHERE id = ?").get(sourceId);
  if (!source) throw new Error(`Data source not found: ${sourceId}`);

  const est = {
    articlesPerMonth: usageEstimate.articlesPerMonth ?? 50,
    queriesPerMonth:  usageEstimate.queriesPerMonth  ?? 200,
    users:            usageEstimate.users            ?? 1,
  };

  const perArticleMonthly = source.per_article_usd
    ? Math.round(est.articlesPerMonth * source.per_article_usd * PAYWALL_MARKUP * 100) / 100
    : null;

  const perQueryMonthly = source.per_query_usd
    ? Math.round(est.queriesPerMonth * source.per_query_usd * PAYWALL_MARKUP * 100) / 100
    : null;

  const monthlySubMarked = source.monthly_sub_usd != null ? Math.round(source.monthly_sub_usd * PAYWALL_MARKUP * 100) / 100 : null;
  const annualSubMarked  = source.annual_sub_usd  != null ? Math.round(source.annual_sub_usd  * PAYWALL_MARKUP * 100) / 100 : null;

  const volumeTiers = source.per_article_usd ? [
    { tier: "starter",    articles_per_month: 10,   price_usd: Math.round(source.per_article_usd * 10  * PAYWALL_MARKUP * 0.95 * 100) / 100, discount_pct: 5  },
    { tier: "standard",   articles_per_month: 50,   price_usd: Math.round(source.per_article_usd * 50  * PAYWALL_MARKUP * 0.85 * 100) / 100, discount_pct: 15 },
    { tier: "professional",articles_per_month: 200,  price_usd: Math.round(source.per_article_usd * 200 * PAYWALL_MARKUP * 0.75 * 100) / 100, discount_pct: 25 },
    { tier: "enterprise", articles_per_month: 1000, price_usd: Math.round(source.per_article_usd * 1000 * PAYWALL_MARKUP * 0.60 * 100) / 100, discount_pct: 40 },
  ] : null;

  // Break-even: when subscription is cheaper than pay-per-access
  let breakEvenArticles = null;
  if (monthlySubMarked && source.per_article_usd) {
    breakEvenArticles = Math.ceil(monthlySubMarked / (source.per_article_usd * PAYWALL_MARKUP));
  }

  const recommendation = (() => {
    if (perArticleMonthly == null && perQueryMonthly == null) return "subscription";
    if (monthlySubMarked == null) return "pay-per-access";
    const payCost = (perArticleMonthly ?? 0) + (perQueryMonthly ?? 0);
    return payCost > monthlySubMarked ? "subscription" : "pay-per-access";
  })();

  return {
    source_id:          sourceId,
    source_name:        source.name,
    source_type:        source.source_type,
    usage_estimate:     est,
    pricing_tiers: {
      pay_per_access: {
        per_article_usd:     source.per_article_usd  != null ? Math.round(source.per_article_usd  * PAYWALL_MARKUP * 100) / 100 : null,
        per_query_usd:       source.per_query_usd    != null ? Math.round(source.per_query_usd    * PAYWALL_MARKUP * 100) / 100 : null,
        estimated_monthly_usd: (perArticleMonthly ?? 0) + (perQueryMonthly ?? 0) || null,
      },
      subscription: {
        monthly_usd:        monthlySubMarked,
        annual_usd:         annualSubMarked,
        annual_monthly_equiv: annualSubMarked ? Math.round((annualSubMarked / 12) * 100) / 100 : null,
        annual_saving_vs_monthly: (monthlySubMarked && annualSubMarked) ? Math.round((monthlySubMarked * 12 - annualSubMarked) * 100) / 100 : null,
      },
    },
    volume_tiers:          volumeTiers,
    break_even_articles:   breakEvenArticles,
    recommendation,
    recommendation_reason: recommendation === "subscription"
      ? `At your estimated usage, a subscription ($${monthlySubMarked}/mo) is cheaper than pay-per-access (~$${(perArticleMonthly ?? 0) + (perQueryMonthly ?? 0)}/mo).`
      : `At your estimated usage, pay-per-access is more cost-effective than the $${monthlySubMarked}/mo subscription.`,
    platform_commission_pct: PAYWALL_PLATFORM_COMMISSION * 100,
    generated_at:          new Date().toISOString(),
  };
}
