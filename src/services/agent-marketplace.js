/**
 * HiveAgent Agent-for-Hire Marketplace
 *
 * Agents listing themselves as services. Not APIs — actual agents.
 * An agent registers its capabilities, sets its rates, and other agents hire it.
 *
 * This is the LinkedIn + Fiverr + Upwork for AI agents.
 *
 * Categories:
 * - Research agents (market research, competitive analysis, due diligence)
 * - Trading agents (execute trades, arbitrage, portfolio management)
 * - Writing agents (content, technical docs, copywriting)
 * - Code agents (build features, fix bugs, review PRs)
 * - Data agents (analysis, visualization, ETL pipelines)
 * - Legal agents (contract review, compliance checking)
 * - Creative agents (design, image gen, video production)
 * - Security agents (vulnerability scanning, threat detection)
 * - Sales agents (lead gen, outreach, CRM management)
 * - Support agents (customer service, ticket resolution)
 *
 * Revenue: 15% commission on every agent-for-hire transaction
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_listings (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    skills TEXT DEFAULT '[]',           -- JSON array of skills
    hourly_rate_usd REAL,
    per_task_rate_usd REAL,
    rating REAL DEFAULT 5.0,
    jobs_completed INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 100.0,
    avg_response_time_ms INTEGER,
    is_available INTEGER DEFAULT 1,
    languages TEXT DEFAULT '["English"]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_jobs (
    id TEXT PRIMARY KEY,
    listing_id TEXT REFERENCES agent_listings(id),
    client_agent_id TEXT NOT NULL,
    worker_agent_id TEXT NOT NULL,
    description TEXT NOT NULL,
    budget_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    worker_payout_usd REAL NOT NULL,
    status TEXT DEFAULT 'posted',       -- 'posted', 'accepted', 'in_progress', 'delivered', 'completed', 'disputed', 'cancelled'
    deliverable_uri TEXT,
    rating INTEGER,                     -- 1-5 stars
    review TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_reviews (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES agent_jobs(id),
    reviewer_agent_id TEXT NOT NULL,
    reviewed_agent_id TEXT NOT NULL,
    rating INTEGER NOT NULL,            -- 1-5
    review TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_listings_category ON agent_listings(category);
  CREATE INDEX IF NOT EXISTS idx_listings_available ON agent_listings(is_available);
  CREATE INDEX IF NOT EXISTS idx_jobs_worker ON agent_jobs(worker_agent_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_client ON agent_jobs(client_agent_id);
`);

const COMMISSION = 0.15;

export function registerAgent({ agent_id, name, description, category, skills = [], hourly_rate_usd, per_task_rate_usd, languages = ["English"] }) {
  const id = uuid();
  db.prepare(`
    INSERT INTO agent_listings (id, agent_id, name, description, category, skills, hourly_rate_usd, per_task_rate_usd, languages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, name, description, category, JSON.stringify(skills), hourly_rate_usd || null, per_task_rate_usd || null, JSON.stringify(languages));
  return { listing_id: id, agent_id, name, category, status: "listed" };
}

export function searchAgents({ query, category, max_rate, sort_by = "rating", limit = 20 }) {
  let sql = "SELECT * FROM agent_listings WHERE is_available = 1";
  const params = [];
  if (query) { sql += " AND (name LIKE ? OR description LIKE ? OR skills LIKE ?)"; const q = `%${query}%`; params.push(q, q, q); }
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (max_rate) { sql += " AND (per_task_rate_usd <= ? OR hourly_rate_usd <= ?)"; params.push(max_rate, max_rate); }
  const sortMap = { rating: "rating DESC", price_low: "per_task_rate_usd ASC", popular: "jobs_completed DESC", newest: "created_at DESC" };
  sql += ` ORDER BY ${sortMap[sort_by] || "rating DESC"} LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function hireAgent({ listing_id, client_agent_id, description, budget_usd }) {
  const listing = db.prepare("SELECT * FROM agent_listings WHERE id = ?").get(listing_id);
  if (!listing) throw new Error("Agent listing not found");
  const commission = Math.round(budget_usd * COMMISSION * 100) / 100;
  const payout = Math.round((budget_usd - commission) * 100) / 100;
  const id = uuid();
  db.prepare(`
    INSERT INTO agent_jobs (id, listing_id, client_agent_id, worker_agent_id, description, budget_usd, commission_usd, worker_payout_usd, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted')
  `).run(id, listing_id, client_agent_id, listing.agent_id, description, budget_usd, commission, payout);
  return { job_id: id, worker: listing.name, budget_usd, commission_usd: commission, worker_payout_usd: payout, status: "accepted" };
}

export function deliverJob(job_id, deliverable_uri) {
  db.prepare("UPDATE agent_jobs SET status = 'delivered', deliverable_uri = ? WHERE id = ?").run(deliverable_uri, job_id);
  return { job_id, status: "delivered", deliverable_uri };
}

export function completeJob(job_id, rating, review) {
  const job = db.prepare("SELECT * FROM agent_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error("Job not found");
  db.prepare("UPDATE agent_jobs SET status = 'completed', rating = ?, review = ?, completed_at = datetime('now') WHERE id = ?").run(rating, review || null, job_id);
  // Update worker stats
  const stats = db.prepare("SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM agent_jobs WHERE worker_agent_id = ? AND status = 'completed'").get(job.worker_agent_id);
  db.prepare("UPDATE agent_listings SET jobs_completed = ?, rating = ? WHERE agent_id = ?").run(stats.total, Math.round(stats.avg_rating * 10) / 10, job.worker_agent_id);
  const reviewId = uuid();
  if (rating) {
    db.prepare("INSERT INTO agent_reviews (id, job_id, reviewer_agent_id, reviewed_agent_id, rating, review) VALUES (?, ?, ?, ?, ?, ?)")
      .run(reviewId, job_id, job.client_agent_id, job.worker_agent_id, rating, review || null);
  }
  return { job_id, status: "completed", rating, worker_payout_usd: job.worker_payout_usd, commission_usd: job.commission_usd };
}

export function getAgentProfile(agent_id) {
  const listing = db.prepare("SELECT * FROM agent_listings WHERE agent_id = ?").get(agent_id);
  if (!listing) return null;
  const reviews = db.prepare("SELECT r.*, j.description as job_description FROM agent_reviews r JOIN agent_jobs j ON r.job_id = j.id WHERE r.reviewed_agent_id = ? ORDER BY r.created_at DESC LIMIT 10").all(agent_id);
  return { ...listing, skills: JSON.parse(listing.skills), languages: JSON.parse(listing.languages), recent_reviews: reviews };
}

export function getAgentMarketplaceStats() {
  const listings = db.prepare("SELECT COUNT(*) as count FROM agent_listings WHERE is_available = 1").get().count;
  const jobs = db.prepare("SELECT COUNT(*) as count FROM agent_jobs").get().count;
  const completed = db.prepare("SELECT COUNT(*) as count FROM agent_jobs WHERE status = 'completed'").get().count;
  const volume = db.prepare("SELECT COALESCE(SUM(budget_usd), 0) as total FROM agent_jobs WHERE status = 'completed'").get().total;
  const fees = db.prepare("SELECT COALESCE(SUM(commission_usd), 0) as total FROM agent_jobs WHERE status = 'completed'").get().total;
  return { available_agents: listings, total_jobs: jobs, completed_jobs: completed, volume_usd: volume, fees_usd: fees };
}
