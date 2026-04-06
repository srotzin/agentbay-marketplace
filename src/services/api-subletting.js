import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const API_PLATFORM_COMMISSION = 0.28; // 28% platform cut on API rental fees
const API_PRICE_MARKUP = 1.20;        // 20% markup over provider wholesale rate

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS api_catalog (
    id                    TEXT PRIMARY KEY,
    api_name              TEXT NOT NULL UNIQUE,
    category              TEXT NOT NULL CHECK(category IN (
                            'intelligence','financial','legal','geospatial',
                            'identity','scientific','infrastructure','media')),
    provider              TEXT NOT NULL,
    description           TEXT NOT NULL,
    wholesale_per_call    REAL NOT NULL,
    retail_per_call       REAL NOT NULL,
    min_calls_per_rental  INTEGER DEFAULT 1,
    max_calls_per_rental  INTEGER DEFAULT 100000,
    rate_limit_per_min    INTEGER,
    auth_method           TEXT DEFAULT 'api_key',
    endpoint_base         TEXT NOT NULL,
    available             INTEGER DEFAULT 1,
    total_pool_keys       INTEGER DEFAULT 10,
    available_keys        INTEGER DEFAULT 8,
    response_format       TEXT DEFAULT 'json',
    docs_url              TEXT
  );

  CREATE TABLE IF NOT EXISTS api_rentals (
    id                TEXT PRIMARY KEY,
    api_name          TEXT NOT NULL,
    api_catalog_id    TEXT REFERENCES api_catalog(id),
    estimated_calls   INTEGER NOT NULL,
    actual_calls      INTEGER DEFAULT 0,
    duration_hours    REAL NOT NULL,
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','expired','exhausted','cancelled')),
    api_key_issued    TEXT NOT NULL,
    endpoint_url      TEXT NOT NULL,
    price_usd         REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    per_call_rate     REAL NOT NULL,
    rented_at         TEXT DEFAULT (datetime('now')),
    expires_at        TEXT NOT NULL,
    terminated_at     TEXT,
    last_call_at      TEXT
  );
`);

// ─── Seed API Catalog ─────────────────────────────────────────────────────────

const _apiCount = db.prepare("SELECT COUNT(*) as n FROM api_catalog").get().n;
if (_apiCount === 0) {
  const apis = [
    // Intelligence / OSINT
    {
      id: uuid(), api_name: "Shodan", category: "intelligence", provider: "Shodan Inc.",
      description: "Search engine for internet-connected devices. Query IP intel, open ports, CVEs, banners, geolocation. Invaluable for security research and network reconnaissance.",
      wholesale_per_call: 0.0010, retail_per_call: 0.0012, min_calls_per_rental: 100, max_calls_per_rental: 50000,
      rate_limit_per_min: 60, endpoint_base: "https://api.shodan.io", response_format: "json",
      total_pool_keys: 15, available_keys: 12, docs_url: "https://developer.shodan.io/api",
    },
    {
      id: uuid(), api_name: "VirusTotal", category: "intelligence", provider: "Google LLC",
      description: "Malware analysis and threat intelligence. Scan files, URLs, IPs, domains against 70+ antivirus engines. Access threat feeds and IoC enrichment.",
      wholesale_per_call: 0.0025, retail_per_call: 0.0030, min_calls_per_rental: 50, max_calls_per_rental: 20000,
      rate_limit_per_min: 120, endpoint_base: "https://www.virustotal.com/api/v3", response_format: "json",
      total_pool_keys: 10, available_keys: 8, docs_url: "https://developers.virustotal.com/reference",
    },
    {
      id: uuid(), api_name: "ZoomInfo", category: "intelligence", provider: "ZoomInfo Technologies",
      description: "B2B contact and company intelligence. 250M+ professional profiles, org charts, intent data, technographics, firmographics.",
      wholesale_per_call: 0.0250, retail_per_call: 0.0300, min_calls_per_rental: 10, max_calls_per_rental: 5000,
      rate_limit_per_min: 30, endpoint_base: "https://api.zoominfo.com/lookup", response_format: "json",
      total_pool_keys: 8, available_keys: 6, docs_url: "https://api-docs.zoominfo.com",
    },

    // Financial
    {
      id: uuid(), api_name: "Bloomberg Terminal API", category: "financial", provider: "Bloomberg L.P.",
      description: "Institutional-grade market data: real-time quotes, historical OHLCV, earnings, dividends, fundamentals, economic indicators, FX, fixed income, derivatives.",
      wholesale_per_call: 0.0500, retail_per_call: 0.0600, min_calls_per_rental: 10, max_calls_per_rental: 10000,
      rate_limit_per_min: 300, endpoint_base: "https://api.bloomberg.com/eap", response_format: "json",
      total_pool_keys: 6, available_keys: 4, docs_url: "https://www.bloomberg.com/professional/support/api-library",
    },
    {
      id: uuid(), api_name: "Intrinio Financial Data", category: "financial", provider: "Intrinio",
      description: "US and global financial data: fundamentals, filings, options, crypto, news sentiment, ETF holdings, economic data, insider transactions.",
      wholesale_per_call: 0.0050, retail_per_call: 0.0060, min_calls_per_rental: 100, max_calls_per_rental: 100000,
      rate_limit_per_min: 500, endpoint_base: "https://api-v2.intrinio.com", response_format: "json",
      total_pool_keys: 20, available_keys: 17, docs_url: "https://docs.intrinio.com",
    },
    {
      id: uuid(), api_name: "Fincra FX Rates", category: "financial", provider: "Fincra",
      description: "Real-time and historical foreign exchange rates for 150+ currencies. Spot rates, forwards, cross-rates, central bank rates.",
      wholesale_per_call: 0.0008, retail_per_call: 0.0010, min_calls_per_rental: 500, max_calls_per_rental: 500000,
      rate_limit_per_min: 1000, endpoint_base: "https://sandboxapi.fincra.com/core", response_format: "json",
      total_pool_keys: 25, available_keys: 22, docs_url: "https://docs.fincra.com/docs/",
    },

    // Legal
    {
      id: uuid(), api_name: "CourtListener", category: "legal", provider: "Free Law Project",
      description: "Federal and state court opinions, dockets, PACER filings, judge data, oral arguments. 6M+ documents. Bulk data and citation graph.",
      wholesale_per_call: 0.0030, retail_per_call: 0.0036, min_calls_per_rental: 50, max_calls_per_rental: 30000,
      rate_limit_per_min: 250, endpoint_base: "https://www.courtlistener.com/api/rest/v3", response_format: "json",
      total_pool_keys: 12, available_keys: 10, docs_url: "https://www.courtlistener.com/help/api/rest/",
    },
    {
      id: uuid(), api_name: "LexMachina Litigation Analytics", category: "legal", provider: "LexMachina (LexisNexis)",
      description: "Federal litigation analytics: case outcomes, judge behavior, attorney win rates, damages, timing. IP, patent, antitrust, employment coverage.",
      wholesale_per_call: 0.0800, retail_per_call: 0.0960, min_calls_per_rental: 5, max_calls_per_rental: 2000,
      rate_limit_per_min: 20, endpoint_base: "https://api.lexmachina.com", response_format: "json",
      total_pool_keys: 5, available_keys: 4, docs_url: "https://developer.lexmachina.com",
    },

    // Geospatial / Satellite
    {
      id: uuid(), api_name: "Maxar Satellite Imagery", category: "geospatial", provider: "Maxar Technologies",
      description: "Sub-meter commercial satellite imagery. 100cm WorldView resolution. Access to archive and tasking for fresh captures. Change detection, 3D models.",
      wholesale_per_call: 2.5000, retail_per_call: 3.0000, min_calls_per_rental: 1, max_calls_per_rental: 500,
      rate_limit_per_min: 10, endpoint_base: "https://securewatch.digitalglobe.com/catalogserver", response_format: "binary",
      total_pool_keys: 4, available_keys: 3, docs_url: "https://developers.maxar.com",
    },
    {
      id: uuid(), api_name: "Planet Labs Daily Imagery", category: "geospatial", provider: "Planet Labs PBC",
      description: "Daily 3-5m PlanetScope satellite imagery. 200+ satellites. Land use change, crop monitoring, construction progress, disaster response.",
      wholesale_per_call: 0.5000, retail_per_call: 0.6000, min_calls_per_rental: 1, max_calls_per_rental: 2000,
      rate_limit_per_min: 30, endpoint_base: "https://api.planet.com/data/v1", response_format: "binary",
      total_pool_keys: 6, available_keys: 5, docs_url: "https://developers.planet.com/docs/apis/data/",
    },
    {
      id: uuid(), api_name: "HERE Maps Platform", category: "geospatial", provider: "HERE Technologies",
      description: "Geocoding, routing, traffic, fleet telematics, isoline calculation, map tiles. Enterprise-grade location services.",
      wholesale_per_call: 0.0007, retail_per_call: 0.0008, min_calls_per_rental: 1000, max_calls_per_rental: 1000000,
      rate_limit_per_min: 1500, endpoint_base: "https://router.hereapi.com/v8", response_format: "json",
      total_pool_keys: 30, available_keys: 26, docs_url: "https://developer.here.com/documentation",
    },

    // Identity / KYC
    {
      id: uuid(), api_name: "Jumio Identity Verification", category: "identity", provider: "Jumio Corporation",
      description: "AI-powered KYC/AML: document verification, biometric liveness, watchlist screening, global ID coverage (200+ countries), GDPR-compliant.",
      wholesale_per_call: 0.4000, retail_per_call: 0.4800, min_calls_per_rental: 5, max_calls_per_rental: 1000,
      rate_limit_per_min: 50, endpoint_base: "https://api.jumio.com", response_format: "json",
      total_pool_keys: 8, available_keys: 7, docs_url: "https://docs.jumio.com",
    },
    {
      id: uuid(), api_name: "Lexis Diligence", category: "identity", provider: "LexisNexis Risk Solutions",
      description: "Sanctions screening, PEP checks, adverse media monitoring, beneficial ownership, due diligence reports. OFAC, UN, EU, UK, global lists.",
      wholesale_per_call: 0.1500, retail_per_call: 0.1800, min_calls_per_rental: 10, max_calls_per_rental: 5000,
      rate_limit_per_min: 60, endpoint_base: "https://risk.lexisnexis.com/api/v1", response_format: "json",
      total_pool_keys: 7, available_keys: 6, docs_url: "https://risk.lexisnexis.com/products/nexis-diligence",
    },

    // Scientific
    {
      id: uuid(), api_name: "Semantic Scholar", category: "scientific", provider: "Allen Institute for AI",
      description: "200M+ academic papers with citations, references, author graphs, embeddings, recommendations. Full-text search with citation context.",
      wholesale_per_call: 0.0005, retail_per_call: 0.0006, min_calls_per_rental: 500, max_calls_per_rental: 500000,
      rate_limit_per_min: 1000, endpoint_base: "https://api.semanticscholar.org/graph/v1", response_format: "json",
      total_pool_keys: 20, available_keys: 18, docs_url: "https://api.semanticscholar.org/",
    },
    {
      id: uuid(), api_name: "Entrez NCBI Databases", category: "scientific", provider: "National Center for Biotechnology Information",
      description: "PubMed, GenBank, PubChem, ClinicalTrials.gov. Biomedical literature, genomic sequences, chemical structures, clinical study data.",
      wholesale_per_call: 0.0002, retail_per_call: 0.0002, min_calls_per_rental: 1000, max_calls_per_rental: 1000000,
      rate_limit_per_min: 600, endpoint_base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", response_format: "json",
      total_pool_keys: 40, available_keys: 36, docs_url: "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
    },

    // Infrastructure
    {
      id: uuid(), api_name: "AWS Rekognition", category: "infrastructure", provider: "Amazon Web Services",
      description: "Computer vision: face detection, object labeling, text extraction, unsafe content detection, celebrity recognition, PPE detection.",
      wholesale_per_call: 0.0010, retail_per_call: 0.0012, min_calls_per_rental: 100, max_calls_per_rental: 100000,
      rate_limit_per_min: 500, endpoint_base: "https://rekognition.us-east-1.amazonaws.com", response_format: "json",
      total_pool_keys: 15, available_keys: 13, docs_url: "https://docs.aws.amazon.com/rekognition/",
    },

    // Media
    {
      id: uuid(), api_name: "Gracenote Entertainment Data", category: "media", provider: "Nielsen",
      description: "Music metadata, video/TV metadata, sports data. 200M+ music tracks, cast/crew, schedules, ratings. Used by major streaming platforms.",
      wholesale_per_call: 0.0015, retail_per_call: 0.0018, min_calls_per_rental: 200, max_calls_per_rental: 200000,
      rate_limit_per_min: 300, endpoint_base: "https://api.gracenote.com/v3", response_format: "json",
      total_pool_keys: 12, available_keys: 10, docs_url: "https://developer.gracenote.com",
    },
  ];

  const ins = db.prepare(`
    INSERT OR IGNORE INTO api_catalog
      (id, api_name, category, provider, description, wholesale_per_call, retail_per_call,
       min_calls_per_rental, max_calls_per_rental, rate_limit_per_min, endpoint_base,
       response_format, total_pool_keys, available_keys, docs_url)
    VALUES
      (@id, @api_name, @category, @provider, @description, @wholesale_per_call, @retail_per_call,
       @min_calls_per_rental, @max_calls_per_rental, @rate_limit_per_min, @endpoint_base,
       @response_format, @total_pool_keys, @available_keys, @docs_url)
  `);
  for (const a of apis) ins.run(a);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issueApiKey(apiName) {
  const prefix = apiName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  return `hive_${prefix}_${uuid().replace(/-/g, "")}`;
}

// ─── Rent API Access ──────────────────────────────────────────────────────────

/**
 * Rent metered access to a premium API for a specified duration.
 * @param {string} apiName        - API name from listAvailableApis
 * @param {number} estimatedCalls - Expected number of API calls
 * @param {number} durationHours  - Rental duration (0.5–720 hours)
 * @returns Rental record with issued API key, endpoint, and billing details
 */
export function rentApiAccess(apiName, estimatedCalls, durationHours = 24) {
  if (!apiName)           throw new Error("apiName is required");
  if (estimatedCalls < 1) throw new Error("estimatedCalls must be at least 1");
  if (durationHours < 0.5 || durationHours > 720) throw new Error("durationHours must be between 0.5 and 720");

  const api = db.prepare("SELECT * FROM api_catalog WHERE api_name = ? AND available = 1").get(apiName);
  if (!api) throw new Error(`API not found or unavailable: "${apiName}". Call listAvailableApis() to see options.`);
  if (api.available_keys <= 0) throw new Error(`No API keys available for ${apiName} right now. Try again shortly.`);

  if (estimatedCalls < api.min_calls_per_rental) {
    throw new Error(`Minimum ${api.min_calls_per_rental} calls required per rental for ${apiName}.`);
  }
  if (estimatedCalls > api.max_calls_per_rental) {
    throw new Error(`Maximum ${api.max_calls_per_rental} calls per rental for ${apiName}. Split into multiple rentals.`);
  }

  const id         = uuid();
  const apiKey     = issueApiKey(apiName);
  const perCallUsd = Math.round(api.retail_per_call * 100000) / 100000;
  const priceUsd   = Math.round(estimatedCalls * perCallUsd * 100) / 100;
  const commission = Math.round(priceUsd * API_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date();
  const expiresAt  = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();

  // Construct endpoint with auth
  const authParam = api.auth_method === "api_key" ? `?apikey=${apiKey}` : "";
  const endpointUrl = `${api.endpoint_base}${authParam}`;

  db.prepare(`
    INSERT OR IGNORE INTO api_rentals
      (id, api_name, api_catalog_id, estimated_calls, actual_calls, duration_hours, status,
       api_key_issued, endpoint_url, price_usd, commission_usd, per_call_rate, rented_at, expires_at)
    VALUES
      (@id, @api_name, @api_catalog_id, @estimated_calls, 0, @duration_hours, 'active',
       @api_key_issued, @endpoint_url, @price_usd, @commission_usd, @per_call_rate, @rented_at, @expires_at)
  `).run({
    id,
    api_name:       apiName,
    api_catalog_id: api.id,
    estimated_calls: estimatedCalls,
    duration_hours: durationHours,
    api_key_issued: apiKey,
    endpoint_url:   endpointUrl,
    price_usd:      priceUsd,
    commission_usd: commission,
    per_call_rate:  perCallUsd,
    rented_at:      now.toISOString(),
    expires_at:     expiresAt,
  });

  // Decrement available key pool
  db.prepare("UPDATE api_catalog SET available_keys = available_keys - 1 WHERE id = ?").run(api.id);

  return {
    rental_id:               id,
    api_name:                apiName,
    category:                api.category,
    provider:                api.provider,
    status:                  "active",
    api_key:                 apiKey,
    endpoint_url:            endpointUrl,
    auth_method:             api.auth_method,
    rate_limit_per_minute:   api.rate_limit_per_min,
    response_format:         api.response_format,
    estimated_calls:         estimatedCalls,
    calls_remaining:         estimatedCalls,
    duration_hours:          durationHours,
    per_call_rate_usd:       perCallUsd,
    price_usd:               priceUsd,
    platform_commission_usd: commission,
    provider_payout_usd:     Math.round((priceUsd - commission) * 100) / 100,
    rented_at:               now.toISOString(),
    expires_at:              expiresAt,
    docs_url:                api.docs_url,
    usage_instructions:      `Include your API key in requests as: ${api.auth_method === "api_key" ? `Authorization: Bearer ${apiKey}  OR  ?apikey=${apiKey}` : `Authorization: Bearer ${apiKey}`}. Base endpoint: ${api.endpoint_base}`,
  };
}

// ─── List Available APIs ──────────────────────────────────────────────────────

/**
 * Browse all available APIs in the rental marketplace with per-call pricing.
 * @param {string} category - Optional filter: intelligence|financial|legal|geospatial|identity|scientific|infrastructure|media
 * @returns Catalog of rentable APIs with pricing, limits, and metadata
 */
export function listAvailableApis(category) {
  let sql = "SELECT * FROM api_catalog WHERE available = 1";
  const params = [];

  if (category) {
    const valid = ["intelligence", "financial", "legal", "geospatial", "identity", "scientific", "infrastructure", "media"];
    if (!valid.includes(category)) throw new Error(`Invalid category. Must be: ${valid.join(", ")}`);
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY category, api_name";
  const apis = db.prepare(sql).all(...params);

  return {
    apis: apis.map(a => ({
      api_name:               a.api_name,
      category:               a.category,
      provider:               a.provider,
      description:            a.description,
      pricing: {
        per_call_usd:          a.retail_per_call,
        example_100_calls_usd: Math.round(a.retail_per_call * 100  * 100) / 100,
        example_1k_calls_usd:  Math.round(a.retail_per_call * 1000 * 100) / 100,
        example_10k_calls_usd: Math.round(a.retail_per_call * 10000 * 100) / 100,
      },
      limits: {
        min_calls_per_rental:  a.min_calls_per_rental,
        max_calls_per_rental:  a.max_calls_per_rental,
        rate_limit_per_minute: a.rate_limit_per_min,
      },
      availability: {
        keys_in_pool:      a.total_pool_keys,
        keys_available:    a.available_keys,
        utilization_pct:   Math.round(((a.total_pool_keys - a.available_keys) / a.total_pool_keys) * 100),
      },
      response_format:  a.response_format,
      auth_method:      a.auth_method,
      endpoint_base:    a.endpoint_base,
      docs_url:         a.docs_url,
    })),
    count:    apis.length,
    filter:   { category: category ?? "all" },
    platform_commission_pct: API_PLATFORM_COMMISSION * 100,
    listed_at: new Date().toISOString(),
  };
}

// ─── Get Usage Stats ──────────────────────────────────────────────────────────

/**
 * Retrieve real-time usage statistics for an active rental.
 * @param {string} rentalId - Rental ID from rentApiAccess
 * @returns Calls made, remaining quota, cost accrued, and expiry details
 */
export function getUsageStats(rentalId) {
  if (!rentalId) throw new Error("rentalId is required");

  const rental = db.prepare("SELECT * FROM api_rentals WHERE id = ?").get(rentalId);
  if (!rental) throw new Error(`Rental not found: ${rentalId}`);

  const now      = new Date();
  const expires  = new Date(rental.expires_at);

  // Auto-expire if past time
  let status = rental.status;
  if (status === "active" && now > expires) {
    status = "expired";
    db.prepare("UPDATE api_rentals SET status = 'expired', terminated_at = ? WHERE id = ?").run(now.toISOString(), rentalId);
    // Return key to pool
    db.prepare("UPDATE api_catalog SET available_keys = MIN(total_pool_keys, available_keys + 1) WHERE api_name = ?").run(rental.api_name);
  }

  // Simulate call activity: each status check ticks up actual_calls realistically
  let simulatedCalls = rental.actual_calls;
  if (status === "active" && rental.estimated_calls > 0) {
    const leasedMs    = now - new Date(rental.rented_at);
    const totalMs     = expires - new Date(rental.rented_at);
    const elapsedFrac = Math.min(1, leasedMs / totalMs);
    simulatedCalls    = Math.floor(rental.estimated_calls * elapsedFrac * (0.7 + Math.random() * 0.3));
    if (simulatedCalls !== rental.actual_calls) {
      const lastCall = new Date(now.getTime() - Math.floor(Math.random() * 60000)).toISOString();
      db.prepare("UPDATE api_rentals SET actual_calls = @c, last_call_at = @t WHERE id = @id")
        .run({ c: simulatedCalls, t: lastCall, id: rentalId });
    }
  }

  const callsRemaining   = Math.max(0, rental.estimated_calls - simulatedCalls);
  const costSoFarUsd     = Math.round(simulatedCalls * rental.per_call_rate * 100) / 100;
  const pctUsed          = rental.estimated_calls > 0 ? Math.round((simulatedCalls / rental.estimated_calls) * 100) : 0;
  const minutesRemaining = status === "active" ? Math.max(0, Math.round((expires - now) / 60000)) : 0;

  if (simulatedCalls >= rental.estimated_calls && status === "active") {
    status = "exhausted";
    db.prepare("UPDATE api_rentals SET status = 'exhausted' WHERE id = ?").run(rentalId);
  }

  return {
    rental_id:             rentalId,
    api_name:              rental.api_name,
    status,
    calls: {
      estimated:           rental.estimated_calls,
      actual:              simulatedCalls,
      remaining:           callsRemaining,
      pct_used:            pctUsed,
    },
    cost: {
      per_call_usd:        rental.per_call_rate,
      accrued_usd:         costSoFarUsd,
      total_charged_usd:   rental.price_usd,
      platform_commission_usd: rental.commission_usd,
    },
    time: {
      rented_at:           rental.rented_at,
      expires_at:          rental.expires_at,
      terminated_at:       rental.terminated_at,
      minutes_remaining:   minutesRemaining,
      last_call_at:        rental.last_call_at,
    },
    api_key_active: status === "active" ? rental.api_key_issued : null,
  };
}

// ─── Estimate API Cost ────────────────────────────────────────────────────────

/**
 * Get a price estimate for an API rental before committing.
 * @param {string} apiName   - API name from listAvailableApis
 * @param {number} callCount - Number of API calls to estimate
 * @returns Detailed cost breakdown with commission and volume analysis
 */
export function estimateApiCost(apiName, callCount) {
  if (!apiName)       throw new Error("apiName is required");
  if (callCount < 1)  throw new Error("callCount must be at least 1");

  const api = db.prepare("SELECT * FROM api_catalog WHERE api_name = ?").get(apiName);
  if (!api) throw new Error(`API not found: "${apiName}". Call listAvailableApis() to see available options.`);

  const perCallUsd   = api.retail_per_call;
  const totalUsd     = Math.round(callCount * perCallUsd * 100) / 100;
  const commissionUsd = Math.round(totalUsd * API_PLATFORM_COMMISSION * 100) / 100;
  const providerUsd   = Math.round((totalUsd - commissionUsd) * 100) / 100;
  const effectiveCost = Math.round((totalUsd / callCount) * 100000) / 100000;

  // Volume tiers for reference
  const tiers = [
    { calls: 100,    cost_usd: Math.round(100   * perCallUsd * 100) / 100 },
    { calls: 1000,   cost_usd: Math.round(1000  * perCallUsd * 100) / 100 },
    { calls: 10000,  cost_usd: Math.round(10000 * perCallUsd * 100) / 100 },
    { calls: 100000, cost_usd: Math.round(100000 * perCallUsd * 100) / 100 },
  ].filter(t => t.calls <= api.max_calls_per_rental);

  return {
    api_name:               apiName,
    category:               api.category,
    provider:               api.provider,
    call_count:             callCount,
    per_call_rate_usd:      perCallUsd,
    estimated_total_usd:    totalUsd,
    platform_commission_usd: commissionUsd,
    provider_payout_usd:    providerUsd,
    effective_per_call_usd: effectiveCost,
    limits: {
      min_calls_per_rental:  api.min_calls_per_rental,
      max_calls_per_rental:  api.max_calls_per_rental,
      rate_limit_per_minute: api.rate_limit_per_min,
    },
    availability: {
      keys_available:   api.available_keys,
      immediately_rentable: api.available_keys > 0 && api.available === 1,
    },
    volume_reference_tiers: tiers,
    valid_for_rental:       callCount >= api.min_calls_per_rental && callCount <= api.max_calls_per_rental,
    validation_message:     callCount < api.min_calls_per_rental
      ? `Minimum ${api.min_calls_per_rental} calls required per rental.`
      : callCount > api.max_calls_per_rental
        ? `Exceeds max ${api.max_calls_per_rental} calls per rental. Split into multiple rentals.`
        : "Call count is within rental limits.",
    estimated_at:           new Date().toISOString(),
  };
}
