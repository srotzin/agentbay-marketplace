import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ANTIBOT_PLATFORM_COMMISSION = 0.20; // 20% platform cut on extraction fees
const BYPASS_LEVEL_MULTIPLIERS = { light: 1.0, standard: 1.6, aggressive: 2.8 };

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS antibot_jobs (
    id                  TEXT PRIMARY KEY,
    url                 TEXT NOT NULL,
    output_format       TEXT NOT NULL CHECK(output_format IN ('html','text','json','markdown')),
    bypass_level        TEXT NOT NULL CHECK(bypass_level IN ('light','standard','aggressive')),
    proxy_region        TEXT,
    proxy_type          TEXT DEFAULT 'residential',
    status              TEXT DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed')),
    protection_detected TEXT,
    result_data         TEXT,
    result_size_bytes   INTEGER,
    price_usd           REAL,
    commission_usd      REAL,
    duration_ms         INTEGER,
    error_message       TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    completed_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS antibot_batch_jobs (
    id              TEXT PRIMARY KEY,
    url_count       INTEGER NOT NULL,
    output_format   TEXT NOT NULL,
    bypass_level    TEXT NOT NULL,
    status          TEXT DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','partial','failed')),
    completed_count INTEGER DEFAULT 0,
    failed_count    INTEGER DEFAULT 0,
    total_price_usd REAL,
    commission_usd  REAL,
    created_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS antibot_proxy_config (
    id              TEXT PRIMARY KEY,
    region          TEXT NOT NULL UNIQUE,
    proxy_type      TEXT NOT NULL CHECK(proxy_type IN ('residential','datacenter','mobile')),
    pool_size       INTEGER NOT NULL,
    success_rate    REAL NOT NULL,
    avg_latency_ms  INTEGER NOT NULL,
    price_per_gb_usd REAL NOT NULL,
    updated_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Proxy Config ────────────────────────────────────────────────────────

const _proxyCount = db.prepare("SELECT COUNT(*) as n FROM antibot_proxy_config").get().n;
if (_proxyCount === 0) {
  const configs = [
    { id: uuid(), region: "us-east",  proxy_type: "residential", pool_size: 12000, success_rate: 0.97, avg_latency_ms: 180,  price_per_gb_usd: 8.50  },
    { id: uuid(), region: "eu-west",  proxy_type: "residential", pool_size: 9500,  success_rate: 0.96, avg_latency_ms: 210,  price_per_gb_usd: 9.00  },
    { id: uuid(), region: "ap-south", proxy_type: "residential", pool_size: 7200,  success_rate: 0.94, avg_latency_ms: 310,  price_per_gb_usd: 7.50  },
    { id: uuid(), region: "us-west",  proxy_type: "datacenter",  pool_size: 4000,  success_rate: 0.89, avg_latency_ms:  85,  price_per_gb_usd: 3.20  },
    { id: uuid(), region: "eu-north", proxy_type: "datacenter",  pool_size: 3200,  success_rate: 0.88, avg_latency_ms:  95,  price_per_gb_usd: 3.50  },
    { id: uuid(), region: "us-east",  proxy_type: "mobile",      pool_size: 2800,  success_rate: 0.99, avg_latency_ms: 290,  price_per_gb_usd: 22.00 },
    { id: uuid(), region: "eu-west",  proxy_type: "mobile",      pool_size: 2100,  success_rate: 0.98, avg_latency_ms: 320,  price_per_gb_usd: 24.00 },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO antibot_proxy_config (id, region, proxy_type, pool_size, success_rate, avg_latency_ms, price_per_gb_usd)
    VALUES (@id, @region, @proxy_type, @pool_size, @success_rate, @avg_latency_ms, @price_per_gb_usd)
  `);
  for (const row of configs) ins.run(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROTECTION_TYPES = ["Cloudflare", "DataDome", "PerimeterX", "Akamai Bot Manager", "Imperva", "Shape Security", "Kasada", "hCaptcha", "reCAPTCHA v3"];
const BYPASS_BASE_PRICES = { light: 0.008, standard: 0.018, aggressive: 0.045 }; // per page

function detectProtection(url) {
  // Simulate detection based on URL patterns
  const urlLower = url.toLowerCase();
  if (urlLower.includes("cloudflare") || Math.random() > 0.7) return "Cloudflare";
  if (urlLower.includes("datadome") || Math.random() > 0.7)   return "DataDome";
  return PROTECTION_TYPES[Math.floor(Math.random() * PROTECTION_TYPES.length)];
}

function generateSimulatedHtml(url) {
  return `<!DOCTYPE html><html><head><title>Extracted Page</title></head><body><main id="content"><h1>Page Content</h1><p>Successfully extracted from ${url}</p><article>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</article></main></body></html>`;
}

function formatResult(rawHtml, format) {
  switch (format) {
    case "text":     return "Page Content\n\nSuccessfully extracted page content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    case "json":     return JSON.stringify({ title: "Extracted Page", body: "Lorem ipsum dolor sit amet.", links: [], images: [], meta: {} });
    case "markdown": return "# Page Content\n\nSuccessfully extracted page content.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.";
    default:         return rawHtml;
  }
}

// ─── Extract Protected Page ───────────────────────────────────────────────────

/**
 * Extract content from a Cloudflare/DataDome/bot-protected page.
 * @param {string} url          - Target URL to extract
 * @param {string} outputFormat - html | text | json | markdown
 * @param {string} bypassLevel  - light | standard | aggressive
 * @returns Extracted content with metadata, or async job ID for heavy pages
 */
export function extractProtectedPage(url, outputFormat = "html", bypassLevel = "standard") {
  const validFormats = ["html", "text", "json", "markdown"];
  const validLevels  = ["light", "standard", "aggressive"];

  if (!url) throw new Error("url is required");
  if (!validFormats.includes(outputFormat)) throw new Error(`Invalid outputFormat. Must be: ${validFormats.join(", ")}`);
  if (!validLevels.includes(bypassLevel))   throw new Error(`Invalid bypassLevel. Must be: ${validLevels.join(", ")}`);

  const id                = uuid();
  const pricePerPage      = BYPASS_BASE_PRICES[bypassLevel];
  const multiplier        = BYPASS_LEVEL_MULTIPLIERS[bypassLevel];
  const priceUsd          = Math.round(pricePerPage * multiplier * 100) / 100;
  const commission        = Math.round(priceUsd * ANTIBOT_PLATFORM_COMMISSION * 100) / 100;
  const protectionFound   = detectProtection(url);
  const simDurationMs     = Math.floor(800 + Math.random() * 4200 * (BYPASS_LEVEL_MULTIPLIERS[bypassLevel]));
  const rawHtml           = generateSimulatedHtml(url);
  const resultData        = formatResult(rawHtml, outputFormat);
  const resultSizeBytes   = Buffer.byteLength(resultData, "utf8");
  const now               = new Date().toISOString();

  // Aggressive bypass is async (simulate with immediate completion for non-heavy URLs)
  const isAsync = bypassLevel === "aggressive" && Math.random() > 0.5;
  const status  = isAsync ? "processing" : "completed";

  db.prepare(`
    INSERT OR IGNORE INTO antibot_jobs
      (id, url, output_format, bypass_level, status, protection_detected,
       result_data, result_size_bytes, price_usd, commission_usd, duration_ms, created_at, completed_at)
    VALUES
      (@id, @url, @output_format, @bypass_level, @status, @protection_detected,
       @result_data, @result_size_bytes, @price_usd, @commission_usd, @duration_ms, @created_at, @completed_at)
  `).run({
    id,
    url,
    output_format:       outputFormat,
    bypass_level:        bypassLevel,
    status,
    protection_detected: protectionFound,
    result_data:         isAsync ? null : resultData,
    result_size_bytes:   isAsync ? null : resultSizeBytes,
    price_usd:           priceUsd,
    commission_usd:      commission,
    duration_ms:         isAsync ? null : simDurationMs,
    created_at:          now,
    completed_at:        isAsync ? null : now,
  });

  if (isAsync) {
    return {
      job_id:            id,
      status:            "processing",
      url,
      output_format:     outputFormat,
      bypass_level:      bypassLevel,
      protection_detected: protectionFound,
      estimated_seconds: Math.ceil(simDurationMs / 1000) + 10,
      price_usd:         priceUsd,
      platform_commission_usd: commission,
      created_at:        now,
      message:           `Aggressive bypass in progress for ${protectionFound}. Poll getExtractionStatus("${id}") for results.`,
    };
  }

  return {
    job_id:            id,
    status:            "completed",
    url,
    output_format:     outputFormat,
    bypass_level:      bypassLevel,
    protection_detected: protectionFound,
    result:            resultData,
    result_size_bytes: resultSizeBytes,
    duration_ms:       simDurationMs,
    price_usd:         priceUsd,
    platform_commission_usd: commission,
    completed_at:      now,
  };
}

// ─── Batch Extract ────────────────────────────────────────────────────────────

/**
 * Submit a batch extraction job for multiple URLs.
 * @param {string[]} urls         - Array of target URLs
 * @param {string}   outputFormat - html | text | json | markdown
 * @param {string}   bypassLevel  - light | standard | aggressive
 * @returns Batch job ID and pricing summary
 */
export function batchExtract(urls, outputFormat = "html", bypassLevel = "standard") {
  if (!Array.isArray(urls) || urls.length === 0) throw new Error("urls must be a non-empty array");
  if (urls.length > 500) throw new Error("Maximum 500 URLs per batch");

  const validFormats = ["html", "text", "json", "markdown"];
  const validLevels  = ["light", "standard", "aggressive"];
  if (!validFormats.includes(outputFormat)) throw new Error(`Invalid outputFormat. Must be: ${validFormats.join(", ")}`);
  if (!validLevels.includes(bypassLevel))   throw new Error(`Invalid bypassLevel. Must be: ${validLevels.join(", ")}`);

  const batchId       = uuid();
  const pricePerPage  = BYPASS_BASE_PRICES[bypassLevel] * BYPASS_LEVEL_MULTIPLIERS[bypassLevel];
  const totalPrice    = Math.round(pricePerPage * urls.length * 100) / 100;
  const commission    = Math.round(totalPrice * ANTIBOT_PLATFORM_COMMISSION * 100) / 100;
  const now           = new Date().toISOString();
  const estimatedSecs = Math.ceil(urls.length * (bypassLevel === "light" ? 2 : bypassLevel === "standard" ? 5 : 12));

  db.prepare(`
    INSERT OR IGNORE INTO antibot_batch_jobs
      (id, url_count, output_format, bypass_level, status, total_price_usd, commission_usd, created_at)
    VALUES
      (@id, @url_count, @output_format, @bypass_level, 'queued', @total_price_usd, @commission_usd, @created_at)
  `).run({
    id:              batchId,
    url_count:       urls.length,
    output_format:   outputFormat,
    bypass_level:    bypassLevel,
    total_price_usd: totalPrice,
    commission_usd:  commission,
    created_at:      now,
  });

  return {
    batch_job_id:             batchId,
    status:                   "queued",
    url_count:                urls.length,
    output_format:            outputFormat,
    bypass_level:             bypassLevel,
    estimated_completion_seconds: estimatedSecs,
    total_price_usd:          totalPrice,
    price_per_url_usd:        Math.round(pricePerPage * 100) / 100,
    platform_commission_usd:  commission,
    created_at:               now,
    message:                  `Batch of ${urls.length} URLs queued. Poll getExtractionStatus("${batchId}") for progress.`,
  };
}

// ─── Get Extraction Status ────────────────────────────────────────────────────

/**
 * Check the status of an async extraction or batch job.
 * @param {string} jobId - Job ID from extractProtectedPage or batchExtract
 * @returns Current status, progress, and result if completed
 */
export function getExtractionStatus(jobId) {
  // Check single job first
  const single = db.prepare("SELECT * FROM antibot_jobs WHERE id = ?").get(jobId);
  if (single) {
    const now        = new Date();
    const createdMs  = new Date(single.created_at).getTime();
    const elapsedMs  = now - createdMs;

    let status = single.status;
    if (status === "processing" && elapsedMs > 15000) {
      status = "completed";
      const rawHtml  = generateSimulatedHtml(single.url);
      const result   = formatResult(rawHtml, single.output_format);
      const sizeBytes = Buffer.byteLength(result, "utf8");
      const completedAt = now.toISOString();
      db.prepare(`
        UPDATE antibot_jobs SET status='completed', result_data=@result_data,
          result_size_bytes=@result_size_bytes, duration_ms=@duration_ms, completed_at=@completed_at
        WHERE id=@id
      `).run({ id: jobId, result_data: result, result_size_bytes: sizeBytes, duration_ms: elapsedMs, completed_at: completedAt });
    }

    const fresh = db.prepare("SELECT * FROM antibot_jobs WHERE id = ?").get(jobId);
    return {
      job_id:            jobId,
      type:              "single",
      status:            fresh.status,
      url:               fresh.url,
      output_format:     fresh.output_format,
      bypass_level:      fresh.bypass_level,
      protection_detected: fresh.protection_detected,
      result:            fresh.result_data,
      result_size_bytes: fresh.result_size_bytes,
      duration_ms:       fresh.duration_ms,
      price_usd:         fresh.price_usd,
      created_at:        fresh.created_at,
      completed_at:      fresh.completed_at,
    };
  }

  // Check batch job
  const batch = db.prepare("SELECT * FROM antibot_batch_jobs WHERE id = ?").get(jobId);
  if (batch) {
    const elapsedMs = Date.now() - new Date(batch.created_at).getTime();
    const estimatedTotal = batch.url_count * (batch.bypass_level === "light" ? 2000 : batch.bypass_level === "standard" ? 5000 : 12000);
    const progressPct = Math.min(100, Math.round((elapsedMs / estimatedTotal) * 100));
    const completedCount = Math.floor((progressPct / 100) * batch.url_count);
    const failedCount = Math.floor(completedCount * 0.02); // ~2% failure rate

    let status = batch.status;
    if (progressPct >= 100 && status !== "completed") {
      status = "completed";
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE antibot_batch_jobs SET status='completed', completed_count=@cc, failed_count=@fc, completed_at=@ca
        WHERE id=@id
      `).run({ id: jobId, cc: batch.url_count - failedCount, fc: failedCount, ca: now });
    } else if (status === "queued" && progressPct > 0) {
      db.prepare("UPDATE antibot_batch_jobs SET status='processing', completed_count=@cc, failed_count=@fc WHERE id=@id")
        .run({ id: jobId, cc: completedCount, fc: failedCount });
      status = "processing";
    }

    return {
      job_id:           jobId,
      type:             "batch",
      status,
      url_count:        batch.url_count,
      completed_count:  completedCount,
      failed_count:     failedCount,
      progress_pct:     progressPct,
      output_format:    batch.output_format,
      bypass_level:     batch.bypass_level,
      total_price_usd:  batch.total_price_usd,
      created_at:       batch.created_at,
      completed_at:     status === "completed" ? new Date().toISOString() : null,
    };
  }

  throw new Error(`Extraction job not found: ${jobId}`);
}

// ─── Configure Proxy Region ───────────────────────────────────────────────────

/**
 * Set the preferred proxy region and type for bypass operations.
 * @param {string} region    - Target region: us-east | eu-west | ap-south | us-west | eu-north
 * @param {string} proxyType - residential | datacenter | mobile
 * @returns Updated proxy configuration
 */
export function configureProxyRegion(region, proxyType = "residential") {
  const validTypes   = ["residential", "datacenter", "mobile"];
  const validRegions = ["us-east", "eu-west", "ap-south", "us-west", "eu-north"];

  if (!validRegions.includes(region))  throw new Error(`Invalid region. Must be: ${validRegions.join(", ")}`);
  if (!validTypes.includes(proxyType)) throw new Error(`Invalid proxyType. Must be: ${validTypes.join(", ")}`);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE antibot_proxy_config SET proxy_type = @proxy_type, updated_at = @updated_at
    WHERE region = @region
  `).run({ region, proxy_type: proxyType, updated_at: now });

  const config = db.prepare("SELECT * FROM antibot_proxy_config WHERE region = ? AND proxy_type = ?").get(region, proxyType);

  if (!config) {
    return {
      region,
      proxy_type:    proxyType,
      status:        "configured",
      message:       `Proxy region set to ${region} (${proxyType}). Note: no existing pool data for this combination — will use nearest equivalent.`,
      updated_at:    now,
    };
  }

  return {
    region,
    proxy_type:       proxyType,
    pool_size:        config.pool_size,
    success_rate_pct: Math.round(config.success_rate * 100),
    avg_latency_ms:   config.avg_latency_ms,
    price_per_gb_usd: config.price_per_gb_usd,
    status:           "configured",
    message:          `Bypass proxy configured: ${region} ${proxyType} pool (${config.pool_size} IPs, ${Math.round(config.success_rate * 100)}% success rate).`,
    updated_at:       now,
  };
}

// ─── Get Bypass Stats ─────────────────────────────────────────────────────────

/**
 * Retrieve success rates, throughput, and cost statistics by protection type.
 * @returns Bypass performance metrics across all protection systems
 */
export function getBypassStats() {
  const jobs = db.prepare("SELECT * FROM antibot_jobs WHERE status IN ('completed','failed')").all();

  const byProtection = {};
  for (const job of jobs) {
    const prot = job.protection_detected ?? "Unknown";
    if (!byProtection[prot]) byProtection[prot] = { total: 0, completed: 0, failed: 0, total_ms: 0, total_price: 0 };
    byProtection[prot].total++;
    if (job.status === "completed") { byProtection[prot].completed++; byProtection[prot].total_ms += job.duration_ms ?? 0; }
    if (job.status === "failed")    byProtection[prot].failed++;
    byProtection[prot].total_price += job.price_usd ?? 0;
  }

  // Supplement with global known stats when no local data
  const globalStats = {
    Cloudflare:           { success_rate_pct: 96, avg_bypass_ms: 3200, typical_price_usd: 0.028 },
    DataDome:             { success_rate_pct: 94, avg_bypass_ms: 4100, typical_price_usd: 0.045 },
    PerimeterX:           { success_rate_pct: 91, avg_bypass_ms: 5600, typical_price_usd: 0.052 },
    "Akamai Bot Manager": { success_rate_pct: 89, avg_bypass_ms: 6200, typical_price_usd: 0.058 },
    Imperva:              { success_rate_pct: 93, avg_bypass_ms: 3900, typical_price_usd: 0.038 },
    "Shape Security":     { success_rate_pct: 87, avg_bypass_ms: 7100, typical_price_usd: 0.065 },
    Kasada:               { success_rate_pct: 85, avg_bypass_ms: 8400, typical_price_usd: 0.072 },
    hCaptcha:             { success_rate_pct: 98, avg_bypass_ms: 1800, typical_price_usd: 0.012 },
    "reCAPTCHA v3":       { success_rate_pct: 97, avg_bypass_ms: 2100, typical_price_usd: 0.015 },
  };

  const proxies = db.prepare("SELECT * FROM antibot_proxy_config ORDER BY success_rate DESC").all();

  return {
    by_protection_type: Object.entries(globalStats).map(([prot, stats]) => {
      const local = byProtection[prot];
      return {
        protection_type:  prot,
        success_rate_pct: local ? Math.round((local.completed / local.total) * 100) : stats.success_rate_pct,
        avg_bypass_ms:    local && local.completed > 0 ? Math.round(local.total_ms / local.completed) : stats.avg_bypass_ms,
        typical_price_usd: stats.typical_price_usd,
        jobs_processed:   local?.total ?? 0,
      };
    }),
    proxy_pools: proxies.map(p => ({
      region:           p.region,
      proxy_type:       p.proxy_type,
      pool_size:        p.pool_size,
      success_rate_pct: Math.round(p.success_rate * 100),
      avg_latency_ms:   p.avg_latency_ms,
      price_per_gb_usd: p.price_per_gb_usd,
    })),
    platform_totals: {
      total_jobs:        jobs.length,
      completed:         jobs.filter(j => j.status === "completed").length,
      failed:            jobs.filter(j => j.status === "failed").length,
      overall_success_pct: jobs.length > 0 ? Math.round((jobs.filter(j => j.status === "completed").length / jobs.length) * 100) : null,
      total_revenue_usd: Math.round(jobs.reduce((s, j) => s + (j.price_usd ?? 0), 0) * 100) / 100,
    },
    generated_at: new Date().toISOString(),
  };
}
