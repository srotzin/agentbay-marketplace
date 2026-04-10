import { randomUUID } from "crypto";
import db from "../db.js";

// Compute Marketplace — agents buy/sell GPU time, ZK proving capacity,
// AI inference, and edge compute with spot-market pricing and arbitrage.

const LIVE_MODE = !!process.env.COMPUTE_API_KEY;

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS compute_providers (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      gpu_type        TEXT NOT NULL,
      gpu_count       INTEGER NOT NULL DEFAULT 1,
      vram_gb         INTEGER NOT NULL,
      cpu_cores       INTEGER DEFAULT 32,
      ram_gb          INTEGER DEFAULT 256,
      storage_tb      REAL    DEFAULT 2.0,
      location        TEXT    NOT NULL,
      price_per_hr    REAL    NOT NULL,
      spot_price_hr   REAL,
      availability    TEXT    DEFAULT 'available' CHECK(availability IN ('available','busy','reserved','offline')),
      job_types       TEXT    DEFAULT '["ai_inference","training","rendering","zk_proving"]',
      benchmark_score REAL    DEFAULT 0,
      uptime_pct      REAL    DEFAULT 99.0,
      avg_latency_ms  INTEGER DEFAULT 50,
      rating          REAL    DEFAULT 4.5,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compute_jobs (
      id              TEXT PRIMARY KEY,
      poster_id       TEXT NOT NULL,
      job_type        TEXT NOT NULL CHECK(job_type IN ('ai_inference','zk_proving','training','rendering','fine_tuning','batch_processing')),
      gpu_type_req    TEXT,
      vram_req_gb     INTEGER,
      duration_hrs    REAL    NOT NULL,
      max_budget_usd  REAL    NOT NULL,
      status          TEXT    DEFAULT 'open' CHECK(status IN ('open','bidding','in_progress','completed','cancelled')),
      accepted_bid_id TEXT,
      provider_id     TEXT,
      result_url      TEXT,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compute_bids (
      id                   TEXT PRIMARY KEY,
      job_id               TEXT NOT NULL REFERENCES compute_jobs(id),
      provider_id          TEXT NOT NULL REFERENCES compute_providers(id),
      price_per_hr         REAL NOT NULL,
      total_price_usd      REAL NOT NULL,
      estimated_hrs        REAL NOT NULL,
      hardware_summary     TEXT,
      status               TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
      created_at           TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compute_benchmarks (
      id              TEXT PRIMARY KEY,
      provider_id     TEXT NOT NULL REFERENCES compute_providers(id),
      benchmark_type  TEXT NOT NULL,
      score           REAL NOT NULL,
      unit            TEXT NOT NULL,
      run_at          TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  console.error("[compute-marketplace] schema init error:", e.message);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

try {
  const _providerCount = db.prepare("SELECT COUNT(*) as n FROM compute_providers").get().n;
  if (_providerCount === 0) {
    const providers = [
      // H100 fleet
      { name: "NovaBurst-H100-01", gpu_type: "H100", gpu_count: 8,  vram_gb: 640, cpu_cores: 128, ram_gb: 2048, storage_tb: 10, location: "us-west-2",   price_per_hr: 2.89, spot_price_hr: 1.95, benchmark_score: 98.5, uptime_pct: 99.9, avg_latency_ms: 12,  rating: 4.9, job_types: '["ai_inference","training","fine_tuning"]' },
      { name: "TorchCloud-H100-02", gpu_type: "H100", gpu_count: 4, vram_gb: 320, cpu_cores: 64,  ram_gb: 1024, storage_tb: 5,  location: "us-east-1",   price_per_hr: 2.75, spot_price_hr: 1.85, benchmark_score: 97.8, uptime_pct: 99.8, avg_latency_ms: 18,  rating: 4.8, job_types: '["ai_inference","training"]' },
      { name: "DeepGrid-H100-EU",   gpu_type: "H100", gpu_count: 8, vram_gb: 640, cpu_cores: 128, ram_gb: 2048, storage_tb: 8,  location: "eu-central-1", price_per_hr: 3.10, spot_price_hr: 2.20, benchmark_score: 97.2, uptime_pct: 99.7, avg_latency_ms: 28,  rating: 4.7, job_types: '["ai_inference","training","fine_tuning"]' },
      { name: "AsiaPac-H100-SG",    gpu_type: "H100", gpu_count: 4, vram_gb: 320, cpu_cores: 64,  ram_gb: 1024, storage_tb: 4,  location: "ap-southeast-1", price_per_hr: 2.95, spot_price_hr: 2.05, benchmark_score: 96.5, uptime_pct: 99.5, avg_latency_ms: 35, rating: 4.6, job_types: '["ai_inference"]' },
      // A100 fleet
      { name: "Luminary-A100-01",  gpu_type: "A100", gpu_count: 8,  vram_gb: 640, cpu_cores: 96,  ram_gb: 1536, storage_tb: 8,  location: "us-west-2",   price_per_hr: 2.10, spot_price_hr: 1.30, benchmark_score: 91.2, uptime_pct: 99.8, avg_latency_ms: 15,  rating: 4.8, job_types: '["ai_inference","training","zk_proving"]' },
      { name: "CoreFlux-A100-02",  gpu_type: "A100", gpu_count: 4,  vram_gb: 320, cpu_cores: 48,  ram_gb: 768,  storage_tb: 4,  location: "us-central-1", price_per_hr: 1.99, spot_price_hr: 1.20, benchmark_score: 90.5, uptime_pct: 99.6, avg_latency_ms: 22,  rating: 4.7, job_types: '["ai_inference","training"]' },
      { name: "ZKForge-A100-01",   gpu_type: "A100", gpu_count: 16, vram_gb: 1280, cpu_cores: 192, ram_gb: 3072, storage_tb: 16, location: "us-east-1",  price_per_hr: 2.05, spot_price_hr: 1.25, benchmark_score: 94.1, uptime_pct: 99.9, avg_latency_ms: 10,  rating: 4.9, job_types: '["zk_proving","training"]' },
      { name: "AzureGrid-A100-EU", gpu_type: "A100", gpu_count: 8,  vram_gb: 640, cpu_cores: 96,  ram_gb: 1536, storage_tb: 6,  location: "eu-west-1",  price_per_hr: 2.25, spot_price_hr: 1.45, benchmark_score: 89.8, uptime_pct: 99.4, avg_latency_ms: 30,  rating: 4.5, job_types: '["ai_inference","rendering"]' },
      // L40S fleet
      { name: "RenderNode-L40S-01", gpu_type: "L40S", gpu_count: 4, vram_gb: 192, cpu_cores: 64,  ram_gb: 512,  storage_tb: 3,  location: "us-west-1",  price_per_hr: 1.45, spot_price_hr: 0.85, benchmark_score: 82.5, uptime_pct: 99.2, avg_latency_ms: 25,  rating: 4.6, job_types: '["rendering","ai_inference"]' },
      { name: "PixelBurst-L40S-02", gpu_type: "L40S", gpu_count: 8, vram_gb: 384, cpu_cores: 128, ram_gb: 1024, storage_tb: 6,  location: "us-east-2",  price_per_hr: 1.52, spot_price_hr: 0.92, benchmark_score: 83.0, uptime_pct: 99.0, avg_latency_ms: 20,  rating: 4.5, job_types: '["rendering","batch_processing"]' },
      // RTX 4090 fleet (consumer-grade but cheap)
      { name: "HobbyNode-4090-01",  gpu_type: "RTX 4090", gpu_count: 1, vram_gb: 24, cpu_cores: 16, ram_gb: 64,  storage_tb: 1,  location: "us-central-1", price_per_hr: 0.38, spot_price_hr: 0.22, benchmark_score: 65.2, uptime_pct: 95.0, avg_latency_ms: 80,  rating: 4.0, job_types: '["ai_inference","rendering"]' },
      { name: "GigaRig-4090-02",    gpu_type: "RTX 4090", gpu_count: 4, vram_gb: 96, cpu_cores: 32, ram_gb: 128, storage_tb: 2,  location: "us-south-1", price_per_hr: 0.42, spot_price_hr: 0.26, benchmark_score: 66.8, uptime_pct: 96.5, avg_latency_ms: 65,  rating: 4.2, job_types: '["ai_inference","fine_tuning","rendering"]' },
      { name: "GamingFarm-4090-03", gpu_type: "RTX 4090", gpu_count: 8, vram_gb: 192, cpu_cores: 64, ram_gb: 256, storage_tb: 4, location: "us-west-3",  price_per_hr: 0.40, spot_price_hr: 0.24, benchmark_score: 67.0, uptime_pct: 97.0, avg_latency_ms: 55,  rating: 4.3, job_types: '["rendering","batch_processing"]' },
      // ZK-specialized
      { name: "ProofCore-ZK-01",  gpu_type: "A100",    gpu_count: 32, vram_gb: 2560, cpu_cores: 256, ram_gb: 4096, storage_tb: 20, location: "us-east-1", price_per_hr: 4.50, spot_price_hr: 3.20, benchmark_score: 99.0, uptime_pct: 99.9, avg_latency_ms: 8,  rating: 5.0, job_types: '["zk_proving"]' },
      { name: "ZKMesh-EU-01",     gpu_type: "A100",    gpu_count: 16, vram_gb: 1280, cpu_cores: 128, ram_gb: 2048, storage_tb: 10, location: "eu-central-1", price_per_hr: 3.80, spot_price_hr: 2.60, benchmark_score: 97.5, uptime_pct: 99.8, avg_latency_ms: 25, rating: 4.8, job_types: '["zk_proving"]' },
      // Inference-optimized
      { name: "InferHub-A10G-01", gpu_type: "A10G",    gpu_count: 8,  vram_gb: 192, cpu_cores: 64, ram_gb: 512,  storage_tb: 2, location: "us-west-2",   price_per_hr: 0.95, spot_price_hr: 0.55, benchmark_score: 78.5, uptime_pct: 99.5, avg_latency_ms: 18, rating: 4.6, job_types: '["ai_inference"]' },
      { name: "FastServe-T4-01",  gpu_type: "T4",      gpu_count: 16, vram_gb: 256, cpu_cores: 96, ram_gb: 768,  storage_tb: 4, location: "us-central-1", price_per_hr: 0.55, spot_price_hr: 0.28, benchmark_score: 62.0, uptime_pct: 99.0, avg_latency_ms: 35, rating: 4.4, job_types: '["ai_inference","batch_processing"]' },
      // Edge compute
      { name: "EdgeNode-LA-01",   gpu_type: "RTX 4090", gpu_count: 2, vram_gb: 48,  cpu_cores: 16, ram_gb: 128, storage_tb: 1,  location: "us-la-edge",  price_per_hr: 0.45, spot_price_hr: 0.28, benchmark_score: 60.5, uptime_pct: 94.0, avg_latency_ms: 5,   rating: 4.1, job_types: '["ai_inference"]' },
      { name: "EdgeNode-NYC-01",  gpu_type: "RTX 4090", gpu_count: 2, vram_gb: 48,  cpu_cores: 16, ram_gb: 128, storage_tb: 1,  location: "us-nyc-edge",  price_per_hr: 0.48, spot_price_hr: 0.30, benchmark_score: 61.0, uptime_pct: 94.5, avg_latency_ms: 4,   rating: 4.2, job_types: '["ai_inference"]' },
      { name: "EdgeNode-CHI-01",  gpu_type: "A10G",     gpu_count: 4, vram_gb: 96,  cpu_cores: 32, ram_gb: 256, storage_tb: 2,  location: "us-chi-edge",  price_per_hr: 0.62, spot_price_hr: 0.38, benchmark_score: 72.0, uptime_pct: 96.0, avg_latency_ms: 8,   rating: 4.3, job_types: '["ai_inference","batch_processing"]' },
    ];

    const insertProvider = db.prepare(`
      INSERT OR IGNORE INTO compute_providers
        (id, name, gpu_type, gpu_count, vram_gb, cpu_cores, ram_gb, storage_tb, location, price_per_hr, spot_price_hr,
         availability, job_types, benchmark_score, uptime_pct, avg_latency_ms, rating)
      VALUES
        (@id, @name, @gpu_type, @gpu_count, @vram_gb, @cpu_cores, @ram_gb, @storage_tb, @location, @price_per_hr, @spot_price_hr,
         @availability, @job_types, @benchmark_score, @uptime_pct, @avg_latency_ms, @rating)
    `);
    for (const p of providers) {
      insertProvider.run({ id: randomUUID(), availability: "available", ...p });
    }

    // Seed some benchmarks
    const allProviders = db.prepare("SELECT id, gpu_type FROM compute_providers").all();
    const insertBench = db.prepare(`
      INSERT OR IGNORE INTO compute_benchmarks (id, provider_id, benchmark_type, score, unit)
      VALUES (@id, @provider_id, @benchmark_type, @score, @unit)
    `);
    for (const p of allProviders) {
      const tflops = p.gpu_type === "H100" ? 3958 : p.gpu_type === "A100" ? 1979 : p.gpu_type === "L40S" ? 1457 : p.gpu_type === "A10G" ? 250 : p.gpu_type === "T4" ? 65 : 82.6;
      insertBench.run({ id: randomUUID(), provider_id: p.id, benchmark_type: "fp16_tflops", score: tflops * (0.9 + Math.random() * 0.2), unit: "TFLOPS" });
      insertBench.run({ id: randomUUID(), provider_id: p.id, benchmark_type: "memory_bandwidth", score: p.gpu_type === "H100" ? 3350 : p.gpu_type === "A100" ? 2039 : 864, unit: "GB/s" });
    }
  }
} catch (e) {
  console.error("[compute-marketplace] seed error:", e.message);
}

// ─── 1. computeListProviders ──────────────────────────────────────────────────

export function computeListProviders(args) {
  const { gpu_type, min_vram_gb, job_type, max_price_hr, location, availability = "available", limit = 20, sort_by = "price_per_hr" } = args;

  let query = "SELECT p.*, GROUP_CONCAT(b.benchmark_type || ':' || ROUND(b.score,1) || ' ' || b.unit, ' | ') as benchmarks FROM compute_providers p LEFT JOIN compute_benchmarks b ON b.provider_id = p.id WHERE 1=1";
  const params = [];

  if (availability && availability !== "all") { query += " AND p.availability = ?"; params.push(availability); }
  if (gpu_type)       { query += " AND p.gpu_type = ?";              params.push(gpu_type); }
  if (min_vram_gb)    { query += " AND p.vram_gb >= ?";              params.push(parseInt(min_vram_gb)); }
  if (max_price_hr)   { query += " AND p.price_per_hr <= ?";         params.push(parseFloat(max_price_hr)); }
  if (location)       { query += " AND p.location LIKE ?";           params.push(`%${location}%`); }
  if (job_type)       { query += " AND p.job_types LIKE ?";          params.push(`%${job_type}%`); }

  const sortCol = ["price_per_hr","spot_price_hr","benchmark_score","rating","avg_latency_ms"].includes(sort_by) ? sort_by : "price_per_hr";
  const sortDir = sort_by === "avg_latency_ms" ? "ASC" : "ASC";

  query += ` GROUP BY p.id ORDER BY p.${sortCol} ${sortDir} LIMIT ?`;
  params.push(parseInt(limit) || 20);

  const providers = db.prepare(query).all(...params);

  return {
    count: providers.length,
    filters: { gpu_type, min_vram_gb, job_type, max_price_hr, location, availability },
    providers: providers.map(p => ({
      provider_id:      p.id,
      name:             p.name,
      gpu_type:         p.gpu_type,
      gpu_count:        p.gpu_count,
      vram_gb:          p.vram_gb,
      location:         p.location,
      price_per_hr:     p.price_per_hr,
      spot_price_hr:    p.spot_price_hr,
      availability:     p.availability,
      benchmark_score:  p.benchmark_score,
      benchmarks:       p.benchmarks,
      uptime_pct:       p.uptime_pct,
      avg_latency_ms:   p.avg_latency_ms,
      rating:           p.rating,
      job_types:        JSON.parse(p.job_types || "[]"),
      savings_vs_ondemand_pct: p.spot_price_hr ? parseFloat(((1 - p.spot_price_hr / p.price_per_hr) * 100).toFixed(1)) : 0,
    })),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 2. computePostJob ───────────────────────────────────────────────────────

export function computePostJob(args) {
  const { poster_id, job_type, gpu_type_req, vram_req_gb, duration_hrs, max_budget_usd, description } = args;
  if (!poster_id)      throw new Error("poster_id is required");
  if (!job_type)       throw new Error("job_type is required");
  if (!duration_hrs)   throw new Error("duration_hrs is required");
  if (!max_budget_usd) throw new Error("max_budget_usd is required");

  const validTypes = ["ai_inference","zk_proving","training","rendering","fine_tuning","batch_processing"];
  if (!validTypes.includes(job_type)) throw new Error(`Invalid job_type. Must be one of: ${validTypes.join(", ")}`);

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO compute_jobs (id, poster_id, job_type, gpu_type_req, vram_req_gb, duration_hrs, max_budget_usd, status)
      VALUES (@id, @poster_id, @job_type, @gpu_type_req, @vram_req_gb, @duration_hrs, @max_budget_usd, 'open')
    `).run({
      id,
      poster_id,
      job_type,
      gpu_type_req: gpu_type_req || null,
      vram_req_gb:  vram_req_gb ? parseInt(vram_req_gb) : null,
      duration_hrs: parseFloat(duration_hrs),
      max_budget_usd: parseFloat(max_budget_usd),
    });
  } catch (e) {
    console.error("[compute-marketplace] computePostJob insert error:", e.message);
    throw e;
  }

  // Find matching providers
  let matchQuery = "SELECT * FROM compute_providers WHERE availability = 'available' AND job_types LIKE ?";
  const matchParams = [`%${job_type}%`];
  if (gpu_type_req) { matchQuery += " AND gpu_type = ?"; matchParams.push(gpu_type_req); }
  if (vram_req_gb)  { matchQuery += " AND vram_gb >= ?"; matchParams.push(parseInt(vram_req_gb)); }
  matchQuery += " ORDER BY price_per_hr ASC LIMIT 5";

  const matches = db.prepare(matchQuery).all(...matchParams);

  return {
    job_id:        id,
    poster_id,
    job_type,
    gpu_type_req:  gpu_type_req || "any",
    vram_req_gb:   vram_req_gb  || "any",
    duration_hrs:  parseFloat(duration_hrs),
    max_budget_usd: parseFloat(max_budget_usd),
    status:        "open",
    matching_providers: matches.length,
    suggested_providers: matches.slice(0, 3).map(p => ({
      provider_id:   p.id,
      name:          p.name,
      gpu_type:      p.gpu_type,
      price_per_hr:  p.price_per_hr,
      spot_price_hr: p.spot_price_hr,
      est_total_usd: parseFloat((p.price_per_hr * parseFloat(duration_hrs)).toFixed(2)),
      within_budget: p.price_per_hr * parseFloat(duration_hrs) <= parseFloat(max_budget_usd),
    })),
    next_step: "Call compute_bid with job_id and provider_id to submit bids.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 3. computeBid ───────────────────────────────────────────────────────────

export function computeBid(args) {
  const { job_id, provider_id, price_per_hr, estimated_hrs, note } = args;
  if (!job_id)      throw new Error("job_id is required");
  if (!provider_id) throw new Error("provider_id is required");
  if (!price_per_hr) throw new Error("price_per_hr is required");

  const job = db.prepare("SELECT * FROM compute_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job not found: ${job_id}`);
  if (job.status !== "open") return { accepted: false, reason: `Job is already ${job.status}` };

  const provider = db.prepare("SELECT * FROM compute_providers WHERE id = ?").get(provider_id);
  if (!provider) throw new Error(`Provider not found: ${provider_id}`);

  const pricePhr   = parseFloat(price_per_hr);
  const estHrs     = parseFloat(estimated_hrs ?? job.duration_hrs);
  const totalPrice = parseFloat((pricePhr * estHrs).toFixed(2));
  const withinBudget = totalPrice <= job.max_budget_usd;

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO compute_bids (id, job_id, provider_id, price_per_hr, total_price_usd, estimated_hrs, hardware_summary, status)
      VALUES (@id, @job_id, @provider_id, @price_per_hr, @total_price_usd, @estimated_hrs, @hardware_summary, 'pending')
    `).run({
      id,
      job_id,
      provider_id,
      price_per_hr: pricePhr,
      total_price_usd: totalPrice,
      estimated_hrs: estHrs,
      hardware_summary: `${provider.gpu_count}x ${provider.gpu_type} (${provider.vram_gb}GB VRAM) @ ${provider.location}`,
    });

    // Mark job as bidding
    db.prepare("UPDATE compute_jobs SET status = 'bidding' WHERE id = ? AND status = 'open'").run(job_id);
  } catch (e) {
    console.error("[compute-marketplace] computeBid insert error:", e.message);
    throw e;
  }

  return {
    bid_id:          id,
    job_id,
    provider_id,
    provider_name:   provider.name,
    price_per_hr:    pricePhr,
    estimated_hrs:   estHrs,
    total_price_usd: totalPrice,
    max_budget_usd:  job.max_budget_usd,
    within_budget:   withinBudget,
    hardware:        `${provider.gpu_count}x ${provider.gpu_type} (${provider.vram_gb}GB VRAM) @ ${provider.location}`,
    status:          "pending",
    note: withinBudget ? "Bid submitted — awaiting acceptance." : `Warning: $${totalPrice} exceeds job budget of $${job.max_budget_usd}.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 4. computeAcceptBid ─────────────────────────────────────────────────────

export function computeAcceptBid(args) {
  const { bid_id, poster_id } = args;
  if (!bid_id) throw new Error("bid_id is required");

  const bid = db.prepare("SELECT * FROM compute_bids WHERE id = ?").get(bid_id);
  if (!bid) throw new Error(`Bid not found: ${bid_id}`);
  if (bid.status !== "pending") return { accepted: false, reason: `Bid is ${bid.status}` };

  const job = db.prepare("SELECT * FROM compute_jobs WHERE id = ?").get(bid.job_id);
  if (!job) throw new Error(`Job not found: ${bid.job_id}`);

  const provider = db.prepare("SELECT * FROM compute_providers WHERE id = ?").get(bid.provider_id);

  try {
    db.prepare("UPDATE compute_bids SET status = 'accepted' WHERE id = ?").run(bid_id);
    db.prepare("UPDATE compute_bids SET status = 'rejected' WHERE job_id = ? AND id != ? AND status = 'pending'").run(bid.job_id, bid_id);
    db.prepare("UPDATE compute_jobs SET status = 'in_progress', accepted_bid_id = ?, provider_id = ? WHERE id = ?").run(bid_id, bid.provider_id, bid.job_id);
    db.prepare("UPDATE compute_providers SET availability = 'busy' WHERE id = ?").run(bid.provider_id);
  } catch (e) {
    console.error("[compute-marketplace] computeAcceptBid update error:", e.message);
    throw e;
  }

  const escrowId = randomUUID();

  return {
    accepted:          true,
    bid_id,
    job_id:            bid.job_id,
    provider_id:       bid.provider_id,
    provider_name:     provider?.name,
    price_per_hr:      bid.price_per_hr,
    estimated_hrs:     bid.estimated_hrs,
    total_locked_usd:  bid.total_price_usd,
    escrow_id:         escrowId,
    escrow_status:     "funded",
    job_status:        "in_progress",
    message:           `Job started. $${bid.total_price_usd} held in escrow (ID: ${escrowId}). Released on completion.`,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 5. computeJobStatus ─────────────────────────────────────────────────────

export function computeJobStatus(args) {
  const { job_id, poster_id } = args;
  if (!job_id) throw new Error("job_id is required");

  const job = db.prepare("SELECT * FROM compute_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job not found: ${job_id}`);

  const bid = job.accepted_bid_id
    ? db.prepare("SELECT * FROM compute_bids WHERE id = ?").get(job.accepted_bid_id)
    : null;
  const provider = bid
    ? db.prepare("SELECT * FROM compute_providers WHERE id = ?").get(bid.provider_id)
    : null;
  const allBids = db.prepare("SELECT * FROM compute_bids WHERE job_id = ?").all(job_id);

  // Simulate progress for in_progress jobs
  const pct = job.status === "completed" ? 100 : job.status === "in_progress" ? Math.floor(30 + Math.random() * 60) : 0;
  const etaMin = job.status === "in_progress" && bid ? Math.round(bid.estimated_hrs * 60 * (1 - pct / 100)) : null;

  return {
    job_id,
    job_type:       job.job_type,
    status:         job.status,
    progress_pct:   pct,
    eta_minutes:    etaMin,
    poster_id:      job.poster_id,
    duration_hrs:   job.duration_hrs,
    max_budget_usd: job.max_budget_usd,
    bids_received:  allBids.length,
    accepted_bid:   bid ? {
      bid_id:         bid.id,
      price_per_hr:   bid.price_per_hr,
      total_usd:      bid.total_price_usd,
      hardware:       bid.hardware_summary,
    } : null,
    provider: provider ? {
      name:          provider.name,
      gpu_type:      provider.gpu_type,
      location:      provider.location,
      avg_latency_ms: provider.avg_latency_ms,
    } : null,
    result_url:     job.result_url || null,
    created_at:     job.created_at,
    mode:           LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 6. computeSpotPrice ─────────────────────────────────────────────────────

export function computeSpotPrice(args) {
  const { gpu_type, location } = args;

  let query = "SELECT gpu_type, location, AVG(spot_price_hr) as avg_spot, MIN(spot_price_hr) as min_spot, MAX(spot_price_hr) as max_spot, AVG(price_per_hr) as avg_ondemand, COUNT(*) as providers FROM compute_providers WHERE availability != 'offline'";
  const params = [];

  if (gpu_type)  { query += " AND gpu_type = ?"; params.push(gpu_type); }
  if (location)  { query += " AND location LIKE ?"; params.push(`%${location}%`); }

  query += " GROUP BY gpu_type ORDER BY avg_spot ASC";

  const rows = db.prepare(query).all(...params);

  return {
    spot_market: rows.map(r => ({
      gpu_type:           r.gpu_type,
      providers_available: r.providers,
      spot_price_hr:      { min: parseFloat(r.min_spot?.toFixed(3) ?? 0), avg: parseFloat(r.avg_spot?.toFixed(3) ?? 0), max: parseFloat(r.max_spot?.toFixed(3) ?? 0) },
      ondemand_price_hr:  parseFloat(r.avg_ondemand?.toFixed(3) ?? 0),
      spot_discount_pct:  parseFloat(((1 - r.avg_spot / r.avg_ondemand) * 100).toFixed(1)),
    })),
    timestamp: new Date().toISOString(),
    tip: "Spot prices can be 30-60% cheaper than on-demand. Great for fault-tolerant batch workloads.",
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 7. computeArbitrage ─────────────────────────────────────────────────────

export function computeArbitrage(args) {
  const { gpu_type, job_type, volume_hrs = 100 } = args;

  let query = "SELECT * FROM compute_providers WHERE availability != 'offline'";
  const params = [];

  if (gpu_type) { query += " AND gpu_type = ?"; params.push(gpu_type); }
  if (job_type) { query += " AND job_types LIKE ?"; params.push(`%${job_type}%`); }

  const providers = db.prepare(query).all(...params);

  if (providers.length < 2) return { opportunities: [], message: "Need 2+ providers to find arbitrage." };

  // Group by GPU type and find price gaps
  const byGpu = {};
  for (const p of providers) {
    if (!byGpu[p.gpu_type]) byGpu[p.gpu_type] = [];
    byGpu[p.gpu_type].push(p);
  }

  const opportunities = [];
  for (const [gtype, gpuProviders] of Object.entries(byGpu)) {
    if (gpuProviders.length < 2) continue;
    const sorted = gpuProviders.sort((a, b) => a.price_per_hr - b.price_per_hr);
    const cheapest  = sorted[0];
    const expensive = sorted[sorted.length - 1];
    const spotSorted = [...gpuProviders].sort((a, b) => (a.spot_price_hr || 999) - (b.spot_price_hr || 999));
    const cheapSpot  = spotSorted[0];

    const priceDiff = expensive.price_per_hr - cheapest.price_per_hr;
    const spotVsOndemand = cheapest.price_per_hr - (cheapSpot.spot_price_hr || cheapest.price_per_hr);

    if (priceDiff > 0.10) {
      opportunities.push({
        type: "provider_arbitrage",
        gpu_type: gtype,
        cheap_provider:     { id: cheapest.id,  name: cheapest.name,  price_per_hr: cheapest.price_per_hr,  location: cheapest.location },
        expensive_provider: { id: expensive.id, name: expensive.name, price_per_hr: expensive.price_per_hr, location: expensive.location },
        price_gap_hr:       parseFloat(priceDiff.toFixed(3)),
        savings_per_100hrs: parseFloat((priceDiff * (parseInt(volume_hrs) || 100)).toFixed(2)),
        action: `Use ${cheapest.name} at $${cheapest.price_per_hr}/hr instead of ${expensive.name} at $${expensive.price_per_hr}/hr — save $${(priceDiff * 100).toFixed(2)}/100 hrs.`,
      });
    }

    if (spotVsOndemand > 0.15) {
      opportunities.push({
        type: "spot_arbitrage",
        gpu_type: gtype,
        provider:            { id: cheapSpot.id, name: cheapSpot.name, location: cheapSpot.location },
        ondemand_price_hr:   cheapest.price_per_hr,
        spot_price_hr:       cheapSpot.spot_price_hr,
        discount_pct:        parseFloat(((spotVsOndemand / cheapest.price_per_hr) * 100).toFixed(1)),
        savings_per_100hrs:  parseFloat((spotVsOndemand * (parseInt(volume_hrs) || 100)).toFixed(2)),
        action: `Use spot pricing at ${cheapSpot.name}: $${cheapSpot.spot_price_hr}/hr vs $${cheapest.price_per_hr}/hr on-demand. Save $${(spotVsOndemand * 100).toFixed(2)}/100 hrs.`,
      });
    }
  }

  return {
    gpu_type_filter: gpu_type || "all",
    job_type_filter: job_type || "all",
    volume_hrs,
    opportunities_found: opportunities.length,
    opportunities: opportunities.sort((a, b) => b.savings_per_100hrs - a.savings_per_100hrs),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 8. computeReserve ───────────────────────────────────────────────────────

export function computeReserve(args) {
  const { provider_id, agent_id, start_hours_from_now = 1, duration_hrs, locked_price_hr } = args;
  if (!provider_id)  throw new Error("provider_id is required");
  if (!agent_id)     throw new Error("agent_id is required");
  if (!duration_hrs) throw new Error("duration_hrs is required");

  const provider = db.prepare("SELECT * FROM compute_providers WHERE id = ?").get(provider_id);
  if (!provider) throw new Error(`Provider not found: ${provider_id}`);
  if (provider.availability === "offline") throw new Error("Provider is offline");

  const lockedPrice = parseFloat(locked_price_hr ?? provider.price_per_hr);
  const totalCost   = parseFloat((lockedPrice * parseFloat(duration_hrs)).toFixed(2));
  const startAt     = new Date(Date.now() + parseFloat(start_hours_from_now) * 3600000).toISOString();
  const endAt       = new Date(Date.now() + (parseFloat(start_hours_from_now) + parseFloat(duration_hrs)) * 3600000).toISOString();

  const reservationId = randomUUID();
  try {
    db.prepare("UPDATE compute_providers SET availability = 'reserved' WHERE id = ?").run(provider_id);
  } catch (e) {
    console.error("[compute-marketplace] computeReserve update error:", e.message);
  }

  return {
    reservation_id:    reservationId,
    provider_id,
    provider_name:     provider.name,
    gpu_type:          provider.gpu_type,
    gpu_count:         provider.gpu_count,
    vram_gb:           provider.vram_gb,
    location:          provider.location,
    agent_id,
    locked_price_hr:   lockedPrice,
    current_price_hr:  provider.price_per_hr,
    price_locked:      lockedPrice <= provider.price_per_hr,
    duration_hrs:      parseFloat(duration_hrs),
    total_cost_usd:    totalCost,
    reserved_from:     startAt,
    reserved_until:    endAt,
    status:            "reserved",
    escrow_required_usd: totalCost,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 9. computeDashboard ─────────────────────────────────────────────────────

export function computeDashboard(args) {
  const { agent_id } = args;

  let jobs, bids, providers;
  try {
    jobs = agent_id
      ? db.prepare("SELECT * FROM compute_jobs WHERE poster_id = ? ORDER BY created_at DESC LIMIT 20").all(agent_id)
      : db.prepare("SELECT * FROM compute_jobs ORDER BY created_at DESC LIMIT 20").all();

    bids = db.prepare("SELECT * FROM compute_bids ORDER BY created_at DESC LIMIT 10").all();

    providers = db.prepare("SELECT gpu_type, COUNT(*) as count, AVG(price_per_hr) as avg_price, MIN(spot_price_hr) as min_spot FROM compute_providers WHERE availability = 'available' GROUP BY gpu_type ORDER BY avg_price").all();
  } catch (e) {
    console.error("[compute-marketplace] computeDashboard query error:", e.message);
    jobs = []; bids = []; providers = [];
  }

  const totalSpend = jobs
    .filter(j => j.status === "completed" && j.accepted_bid_id)
    .reduce((s, j) => {
      const b = bids.find(b => b.id === j.accepted_bid_id);
      return s + (b ? b.total_price_usd : 0);
    }, 0);

  return {
    agent_id: agent_id || "all",
    jobs: {
      total:       jobs.length,
      open:        jobs.filter(j => j.status === "open").length,
      in_progress: jobs.filter(j => j.status === "in_progress").length,
      completed:   jobs.filter(j => j.status === "completed").length,
      total_spend_usd: parseFloat(totalSpend.toFixed(2)),
    },
    market_snapshot: {
      gpu_types: providers.map(p => ({
        gpu_type:            p.gpu_type,
        available_providers: p.count,
        avg_price_hr:        parseFloat(p.avg_price?.toFixed(3) ?? 0),
        best_spot_hr:        parseFloat(p.min_spot?.toFixed(3) ?? 0),
      })),
    },
    recent_jobs: jobs.slice(0, 5).map(j => ({
      job_id:    j.id,
      job_type:  j.job_type,
      status:    j.status,
      budget:    j.max_budget_usd,
      created_at: j.created_at,
    })),
    mode: LIVE_MODE ? "live" : "simulation",
  };
}
