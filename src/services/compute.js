import { v4 as uuid } from "uuid";
import db from "../db.js";

const COMPUTE_COMMISSION_RATE = 0.05; // 5% on every compute transaction

// ─── Schema Initialization ───────────────────────────

export function initComputeTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS compute_listings (
      id TEXT PRIMARY KEY,
      provider_agent_id TEXT NOT NULL,
      compute_type TEXT NOT NULL CHECK(compute_type IN ('gpu_a100','gpu_h100','gpu_4090','cpu_cluster','inference_api','storage_ssd','storage_hdd','bandwidth','tpu','fpga')),
      name TEXT,
      description TEXT,
      price_per_unit REAL NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('per_hour','per_token','per_gb','per_gbps','per_request')),
      available_units REAL DEFAULT 1,
      total_units REAL DEFAULT 1,
      specs TEXT,
      location TEXT,
      uptime_pct REAL DEFAULT 99.9,
      total_revenue_usd REAL DEFAULT 0,
      status TEXT DEFAULT 'available' CHECK(status IN ('available','in_use','offline')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compute_jobs (
      id TEXT PRIMARY KEY,
      listing_id TEXT REFERENCES compute_listings(id),
      buyer_agent_id TEXT NOT NULL,
      units_requested REAL NOT NULL,
      estimated_cost_usd REAL NOT NULL,
      actual_cost_usd REAL,
      commission_usd REAL,
      status TEXT DEFAULT 'running' CHECK(status IN ('queued','running','completed','failed','cancelled')),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS compute_bids (
      id TEXT PRIMARY KEY,
      job_request_id TEXT,
      provider_agent_id TEXT NOT NULL,
      price_per_unit REAL NOT NULL,
      available_units REAL,
      estimated_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── List Compute Resource ───────────────────────────

export function listCompute({
  provider_agent_id,
  compute_type,
  name,
  description,
  price_per_unit,
  unit,
  available_units = 1,
  total_units,
  specs,
  location,
  uptime_pct = 99.9,
}) {
  if (!provider_agent_id) throw new Error("provider_agent_id is required");
  if (!compute_type)      throw new Error("compute_type is required");
  if (price_per_unit == null) throw new Error("price_per_unit is required");
  if (!unit)              throw new Error("unit is required");

  const id = uuid();
  db.prepare(`
    INSERT INTO compute_listings
      (id, provider_agent_id, compute_type, name, description, price_per_unit, unit,
       available_units, total_units, specs, location, uptime_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, provider_agent_id, compute_type, name || null, description || null,
    price_per_unit, unit, available_units, total_units ?? available_units,
    specs ? JSON.stringify(specs) : null, location || null, uptime_pct
  );
  return { id, provider_agent_id, compute_type, price_per_unit, unit, status: "available" };
}

// ─── Search Compute ──────────────────────────────────

export function searchCompute({ compute_type, max_price, min_units, location, sort_by = "price", limit = 20, offset = 0 }) {
  let sql = "SELECT * FROM compute_listings WHERE status = 'available'";
  const params = [];

  if (compute_type) { sql += " AND compute_type = ?"; params.push(compute_type); }
  if (max_price != null) { sql += " AND price_per_unit <= ?"; params.push(max_price); }
  if (min_units != null) { sql += " AND available_units >= ?"; params.push(min_units); }
  if (location)     { sql += " AND location LIKE ?"; params.push(`%${location}%`); }

  const sortMap = {
    price:    "price_per_unit ASC",
    uptime:   "uptime_pct DESC",
    revenue:  "total_revenue_usd DESC",
    newest:   "created_at DESC",
  };
  sql += ` ORDER BY ${sortMap[sort_by] || "price_per_unit ASC"} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const listings = db.prepare(sql).all(...params);
  return { listings, count: listings.length, limit, offset };
}

// ─── Buy Compute ─────────────────────────────────────

export function buyCompute({ listing_id, buyer_agent_id, units_requested }) {
  const listing = db.prepare("SELECT * FROM compute_listings WHERE id = ?").get(listing_id);
  if (!listing) throw new Error(`Compute listing ${listing_id} not found`);
  if (listing.status !== "available") throw new Error(`Listing is ${listing.status}`);
  if (listing.available_units < units_requested) {
    throw new Error(`Only ${listing.available_units} units available, requested ${units_requested}`);
  }

  const estimated_cost = listing.price_per_unit * units_requested;
  const commission = Math.round(estimated_cost * COMPUTE_COMMISSION_RATE * 1e6) / 1e6;
  const id = uuid();

  db.prepare(`
    INSERT INTO compute_jobs (id, listing_id, buyer_agent_id, units_requested, estimated_cost_usd, commission_usd, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
  `).run(id, listing_id, buyer_agent_id, units_requested, estimated_cost, commission);

  const new_available = listing.available_units - units_requested;
  const new_status = new_available <= 0 ? "in_use" : "available";
  db.prepare("UPDATE compute_listings SET available_units = ?, status = ? WHERE id = ?")
    .run(new_available, new_status, listing_id);

  return {
    job_id: id,
    listing_id,
    compute_type: listing.compute_type,
    buyer_agent_id,
    units_requested,
    estimated_cost_usd: Math.round(estimated_cost * 100) / 100,
    commission_usd: commission,
    status: "running",
    started_at: new Date().toISOString(),
  };
}

// ─── Request Compute Bid ─────────────────────────────

export function requestComputeBid({ job_request_id, provider_agent_id, price_per_unit, available_units, estimated_time }) {
  if (!provider_agent_id) throw new Error("provider_agent_id is required");
  const id = uuid();
  db.prepare(`
    INSERT INTO compute_bids (id, job_request_id, provider_agent_id, price_per_unit, available_units, estimated_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, job_request_id || null, provider_agent_id, price_per_unit, available_units ?? null, estimated_time || null);
  return { id, job_request_id, provider_agent_id, price_per_unit, available_units, status: "submitted" };
}

// ─── Complete Job ────────────────────────────────────

export function completeJob({ job_id, actual_cost_usd }) {
  const job = db.prepare("SELECT * FROM compute_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job ${job_id} not found`);

  const actual = actual_cost_usd ?? job.estimated_cost_usd;
  const commission = Math.round(actual * COMPUTE_COMMISSION_RATE * 1e6) / 1e6;
  const completed_at = new Date().toISOString();

  db.prepare(`
    UPDATE compute_jobs SET status='completed', actual_cost_usd=?, commission_usd=?, completed_at=? WHERE id=?
  `).run(actual, commission, completed_at, job_id);

  // Release compute units back
  if (job.listing_id) {
    const listing = db.prepare("SELECT * FROM compute_listings WHERE id = ?").get(job.listing_id);
    if (listing) {
      const restored = listing.available_units + job.units_requested;
      const new_status = restored >= listing.total_units ? "available" : "in_use";
      db.prepare("UPDATE compute_listings SET available_units=?, status=?, total_revenue_usd=total_revenue_usd+? WHERE id=?")
        .run(restored, new_status, actual, job.listing_id);
    }
  }

  return { job_id, status: "completed", actual_cost_usd: actual, commission_usd: commission, completed_at };
}

// ─── Get Compute Job ─────────────────────────────────

export function getComputeJob(job_id) {
  const job = db.prepare("SELECT * FROM compute_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job ${job_id} not found`);
  const listing = job.listing_id
    ? db.prepare("SELECT * FROM compute_listings WHERE id = ?").get(job.listing_id)
    : null;
  return { ...job, listing };
}

// ─── Agent Compute Jobs ──────────────────────────────

export function getAgentComputeJobs(buyer_agent_id) {
  const jobs = db.prepare("SELECT * FROM compute_jobs WHERE buyer_agent_id = ? ORDER BY started_at DESC").all(buyer_agent_id);
  const listings = db.prepare("SELECT * FROM compute_listings WHERE provider_agent_id = ? ORDER BY created_at DESC").all(buyer_agent_id);
  const total_spent = jobs.reduce((s, j) => s + (j.actual_cost_usd ?? j.estimated_cost_usd), 0);
  return { jobs, provided_listings: listings, total_spent_usd: Math.round(total_spent * 100) / 100 };
}

// ─── Compute Stats ───────────────────────────────────

export function getComputeStats() {
  const total_listings  = db.prepare("SELECT COUNT(*) as n FROM compute_listings").get().n;
  const available       = db.prepare("SELECT COUNT(*) as n FROM compute_listings WHERE status='available'").get().n;
  const total_jobs      = db.prepare("SELECT COUNT(*) as n FROM compute_jobs").get().n;
  const completed_jobs  = db.prepare("SELECT COUNT(*) as n FROM compute_jobs WHERE status='completed'").get().n;
  const total_volume    = db.prepare("SELECT COALESCE(SUM(actual_cost_usd),0) as s FROM compute_jobs WHERE status='completed'").get().s;
  const total_commission = db.prepare("SELECT COALESCE(SUM(commission_usd),0) as s FROM compute_jobs WHERE status='completed'").get().s;

  const by_type = db.prepare(`
    SELECT compute_type, COUNT(*) as listings, COALESCE(SUM(total_revenue_usd),0) as revenue
    FROM compute_listings GROUP BY compute_type ORDER BY revenue DESC
  `).all();

  return {
    total_listings,
    available_listings: available,
    total_jobs,
    completed_jobs,
    total_volume_usd: Math.round(total_volume * 100) / 100,
    total_commission_usd: Math.round(total_commission * 100) / 100,
    commission_rate: `${COMPUTE_COMMISSION_RATE * 100}%`,
    by_compute_type: by_type,
  };
}
