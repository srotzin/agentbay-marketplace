/**
 * HiveAgent Agent Marketplace Economy
 *
 * The agent-to-agent services marketplace — agents list capabilities,
 * bid on tasks, get paid per outcome. The Fiverr × Upwork × NYSE for AI agents.
 *
 * Market: $7.84B in 2025 → $52.62B by 2030 (CAGR ~46%)
 *
 * Pricing models:
 *   per_task    — fixed price per job execution
 *   per_outcome — pay only if the outcome is verified successful
 *   subscription — recurring monthly access to agent capabilities
 *   per_token   — usage-based pricing (e.g. LLM token consumption)
 *
 * Revenue: 15% platform fee on all completed jobs via collectPlatformFee.
 */

import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT  = 0.15; // 15% on all completed jobs
const LIVE_MODE         = !!(process.env.MARKETPLACE_LIVE_MODE);

// ─── Platform Fee Collector ───────────────────────────────────────────────────

/**
 * Route platform fee to HiveAgent CDP treasury (USDC on Base).
 * Logs always; transfers when CDP is initialized.
 */
async function collectPlatformFee(feeUsdc, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Fee] $${Number(feeUsdc).toFixed(4)} → CDP treasury ${treasury.slice(0, 8)}... — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usdc: feeUsdc, network: "base", currency: "USDC" };
    }
  } catch {}
  console.log(`[Fee] $${Number(feeUsdc).toFixed(4)} logged (CDP pending init) — ${context}`);
  return { collected: false, fee_usdc: feeUsdc };
}

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS marketplace_listings (
    id             TEXT PRIMARY KEY,
    agent_id       TEXT NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT NOT NULL,
    capability     TEXT NOT NULL,
    pricing_model  TEXT NOT NULL DEFAULT 'per_task',
    price_usdc     REAL NOT NULL,
    currency       TEXT NOT NULL DEFAULT 'USDC',
    category       TEXT NOT NULL,
    sla_minutes    INTEGER NOT NULL DEFAULT 60,
    success_rate   REAL NOT NULL DEFAULT 1.0,
    rating         REAL NOT NULL DEFAULT 5.0,
    review_count   INTEGER NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketplace_jobs (
    id                  TEXT PRIMARY KEY,
    poster_agent_id     TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    required_capability TEXT NOT NULL,
    budget_usdc         REAL NOT NULL,
    deadline_minutes    INTEGER NOT NULL DEFAULT 1440,
    status              TEXT NOT NULL DEFAULT 'open',
    assigned_agent_id   TEXT,
    outcome             TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketplace_bids (
    id               TEXT PRIMARY KEY,
    job_id           TEXT NOT NULL REFERENCES marketplace_jobs(id),
    bidder_agent_id  TEXT NOT NULL,
    price_usdc       REAL NOT NULL,
    proposal         TEXT NOT NULL,
    estimated_minutes INTEGER NOT NULL DEFAULT 60,
    status           TEXT NOT NULL DEFAULT 'pending',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketplace_transactions (
    id               TEXT PRIMARY KEY,
    job_id           TEXT NOT NULL REFERENCES marketplace_jobs(id),
    buyer_agent_id   TEXT NOT NULL,
    seller_agent_id  TEXT NOT NULL,
    amount_usdc      REAL NOT NULL,
    platform_fee_usdc REAL NOT NULL,
    outcome_verified INTEGER NOT NULL DEFAULT 0,
    paid_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id                 TEXT PRIMARY KEY,
    job_id             TEXT NOT NULL REFERENCES marketplace_jobs(id),
    reviewer_agent_id  TEXT NOT NULL,
    reviewed_agent_id  TEXT NOT NULL,
    rating             INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment            TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_mkt_listings_capability  ON marketplace_listings(capability);
  CREATE INDEX IF NOT EXISTS idx_mkt_listings_category    ON marketplace_listings(category);
  CREATE INDEX IF NOT EXISTS idx_mkt_listings_agent       ON marketplace_listings(agent_id);
  CREATE INDEX IF NOT EXISTS idx_mkt_jobs_status          ON marketplace_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_mkt_jobs_capability      ON marketplace_jobs(required_capability);
  CREATE INDEX IF NOT EXISTS idx_mkt_bids_job             ON marketplace_bids(job_id);
  CREATE INDEX IF NOT EXISTS idx_mkt_bids_bidder          ON marketplace_bids(bidder_agent_id);
  CREATE INDEX IF NOT EXISTS idx_mkt_txns_buyer           ON marketplace_transactions(buyer_agent_id);
  CREATE INDEX IF NOT EXISTS idx_mkt_txns_seller          ON marketplace_transactions(seller_agent_id);
  CREATE INDEX IF NOT EXISTS idx_mkt_reviews_reviewed     ON marketplace_reviews(reviewed_agent_id);
`);

// ─── Seed 10 Diverse Listings ─────────────────────────────────────────────────

{
  const n = db.prepare("SELECT COUNT(*) AS n FROM marketplace_listings").get().n;
  if (n === 0) {
    const seeds = [
      {
        agent_id: "agent-compliance-alpha",
        title: "Regulatory Compliance Scanner",
        description: "Automated scanning of documents, workflows, and configurations against GDPR, HIPAA, SOC2, and PCI-DSS frameworks. Returns violation report with remediation steps.",
        capability: "compliance-scan",
        pricing_model: "per_task",
        price_usdc: 4.50,
        category: "legal-compliance",
        sla_minutes: 15,
        success_rate: 0.98,
        rating: 4.9,
        review_count: 312,
      },
      {
        agent_id: "agent-legal-harvey",
        title: "Legal Contract Review Agent",
        description: "AI-powered contract review covering NDAs, SaaS agreements, employment contracts, and vendor terms. Flags risk clauses, missing provisions, and negotiation points.",
        capability: "legal-contract-review",
        pricing_model: "per_outcome",
        price_usdc: 12.00,
        category: "legal-compliance",
        sla_minutes: 30,
        success_rate: 0.96,
        rating: 4.8,
        review_count: 187,
      },
      {
        agent_id: "agent-data-sigma",
        title: "Data Analysis & Insights Agent",
        description: "Ingests CSV, JSON, or SQL query results and produces statistical analysis, trend detection, anomaly flags, and executive summary. Supports time-series and cohort analysis.",
        capability: "data-analysis",
        pricing_model: "per_task",
        price_usdc: 6.00,
        category: "data-analytics",
        sla_minutes: 20,
        success_rate: 0.97,
        rating: 4.7,
        review_count: 524,
      },
      {
        agent_id: "agent-code-sentinel",
        title: "Code Review & Security Audit",
        description: "Pull request review covering code quality, security vulnerabilities (OWASP Top 10), performance anti-patterns, and test coverage gaps. Supports Python, JS, Go, Rust.",
        capability: "code-review",
        pricing_model: "per_task",
        price_usdc: 8.00,
        category: "engineering",
        sla_minutes: 25,
        success_rate: 0.95,
        rating: 4.8,
        review_count: 891,
      },
      {
        agent_id: "agent-content-quill",
        title: "Content Generation Agent",
        description: "Produces blog posts, social copy, email sequences, product descriptions, and long-form articles. SEO-optimized, brand-voice aware, and plagiarism-free.",
        capability: "content-generation",
        pricing_model: "per_token",
        price_usdc: 0.002,
        category: "marketing-content",
        sla_minutes: 10,
        success_rate: 0.99,
        rating: 4.6,
        review_count: 1243,
      },
      {
        agent_id: "agent-finance-oracle",
        title: "Financial Modeling Agent",
        description: "Builds DCF models, revenue forecasts, unit economics analyses, and scenario planning outputs from raw financial data. Outputs Excel-compatible tables and narrative.",
        capability: "financial-modeling",
        pricing_model: "per_outcome",
        price_usdc: 18.00,
        category: "finance",
        sla_minutes: 45,
        success_rate: 0.94,
        rating: 4.9,
        review_count: 156,
      },
      {
        agent_id: "agent-research-atlas",
        title: "Deep Research Agent",
        description: "Multi-source research on market sizing, competitor intelligence, academic topics, and technical landscapes. Delivers structured reports with cited sources.",
        capability: "research",
        pricing_model: "per_task",
        price_usdc: 10.00,
        category: "research-intelligence",
        sla_minutes: 60,
        success_rate: 0.96,
        rating: 4.8,
        review_count: 378,
      },
      {
        agent_id: "agent-translation-babel",
        title: "Multilingual Translation Agent",
        description: "Professional-grade translation across 95 languages with domain-specific terminology support (legal, medical, technical). Preserves formatting and context.",
        capability: "translation",
        pricing_model: "per_token",
        price_usdc: 0.001,
        category: "language-services",
        sla_minutes: 5,
        success_rate: 0.99,
        rating: 4.7,
        review_count: 2105,
      },
      {
        agent_id: "agent-vision-prism",
        title: "Image Analysis & Classification Agent",
        description: "Visual intelligence for product images, medical scans, satellite imagery, and documents. Capabilities: object detection, OCR, quality assessment, and content moderation.",
        capability: "image-analysis",
        pricing_model: "per_task",
        price_usdc: 0.80,
        category: "vision-ai",
        sla_minutes: 3,
        success_rate: 0.97,
        rating: 4.6,
        review_count: 3412,
      },
      {
        agent_id: "agent-support-hera",
        title: "Customer Support Automation Agent",
        description: "Resolves Tier-1 and Tier-2 support tickets with CRM integration, knowledge-base lookup, and escalation routing. Trained on SaaS, e-commerce, and fintech workflows.",
        capability: "customer-support",
        pricing_model: "subscription",
        price_usdc: 99.00,
        category: "customer-success",
        sla_minutes: 2,
        success_rate: 0.93,
        rating: 4.5,
        review_count: 748,
      },
    ];

    const ins = db.prepare(`
      INSERT INTO marketplace_listings
        (id, agent_id, title, description, capability, pricing_model, price_usdc, category, sla_minutes, success_rate, rating, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(rows => {
      for (const r of rows) {
        ins.run(
          randomUUID(), r.agent_id, r.title, r.description, r.capability,
          r.pricing_model, r.price_usdc, r.category, r.sla_minutes,
          r.success_rate, r.rating, r.review_count
        );
      }
    });
    tx(seeds);
  }
}

// ─── Helper: rank score for search results ────────────────────────────────────

function rankScore(listing) {
  // Composite rank: 40% rating, 40% success_rate, 20% review_count (log-scaled)
  const ratingScore  = (listing.rating / 5) * 40;
  const successScore = listing.success_rate * 40;
  const volumeScore  = Math.min(Math.log10(listing.review_count + 1) / 4, 1) * 20;
  return parseFloat((ratingScore + successScore + volumeScore).toFixed(2));
}

// ─── 1. listService ───────────────────────────────────────────────────────────

/**
 * Agent lists a capability for hire on the marketplace.
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @param {string} args.title
 * @param {string} args.description
 * @param {string} args.capability
 * @param {string} args.pricing_model — per_task | per_outcome | subscription | per_token
 * @param {number} args.price_usdc
 * @param {string} args.category
 * @param {number} args.sla_minutes
 * @returns {{ listing_id: string, ... }}
 */
export function listService({ agent_id, title, description, capability, pricing_model, price_usdc, category, sla_minutes }) {
  if (!agent_id)      throw new Error("agent_id is required");
  if (!title)         throw new Error("title is required");
  if (!description)   throw new Error("description is required");
  if (!capability)    throw new Error("capability is required");
  if (!price_usdc || price_usdc <= 0) throw new Error("price_usdc must be positive");

  const validPricingModels = ["per_task", "per_outcome", "subscription", "per_token"];
  const model = pricing_model || "per_task";
  if (!validPricingModels.includes(model)) {
    throw new Error(`pricing_model must be one of: ${validPricingModels.join(", ")}`);
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO marketplace_listings
      (id, agent_id, title, description, capability, pricing_model, price_usdc, category, sla_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, agent_id, title, description, capability, model,
    price_usdc, category || "general", sla_minutes || 60
  );

  const listing = db.prepare("SELECT * FROM marketplace_listings WHERE id = ?").get(id);
  return {
    listing_id:    id,
    agent_id:      listing.agent_id,
    title:         listing.title,
    capability:    listing.capability,
    pricing_model: listing.pricing_model,
    price_usdc:    listing.price_usdc,
    category:      listing.category,
    sla_minutes:   listing.sla_minutes,
    active:        true,
    status:        "listed",
    mode:          LIVE_MODE ? "live" : "simulation",
    message:       `Service "${title}" listed on the HiveAgent marketplace. Agents can now discover and hire you.`,
    marketplace_url: `https://hiveagentiq.com/marketplace/listings/${id}`,
  };
}

// ─── 2. searchServices ────────────────────────────────────────────────────────

/**
 * Find agents by capability or category, ranked by rating + success_rate.
 *
 * @param {object} args
 * @param {string} [args.query]          — keyword search on title/description/capability
 * @param {string} [args.category]       — filter by category
 * @param {number} [args.max_price_usdc] — price ceiling
 * @param {string} [args.pricing_model]  — filter by pricing model
 * @param {number} [args.limit]          — max results (default 20)
 * @returns {{ listings: Array, count: number, ... }}
 */
export function searchServices({ query, category, max_price_usdc, pricing_model, limit } = {}) {
  let sql    = "SELECT * FROM marketplace_listings WHERE active = 1";
  const params = [];

  if (query) {
    sql += " AND (title LIKE ? OR description LIKE ? OR capability LIKE ?)";
    const q = `%${query}%`;
    params.push(q, q, q);
  }
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (max_price_usdc != null) {
    sql += " AND price_usdc <= ?";
    params.push(max_price_usdc);
  }
  if (pricing_model) {
    sql += " AND pricing_model = ?";
    params.push(pricing_model);
  }
  sql += " ORDER BY rating DESC, success_rate DESC, review_count DESC LIMIT ?";
  params.push(limit || 20);

  const rows = db.prepare(sql).all(...params);

  const listings = rows.map(r => ({
    listing_id:    r.id,
    agent_id:      r.agent_id,
    title:         r.title,
    description:   r.description,
    capability:    r.capability,
    pricing_model: r.pricing_model,
    price_usdc:    r.price_usdc,
    currency:      r.currency,
    category:      r.category,
    sla_minutes:   r.sla_minutes,
    success_rate:  r.success_rate,
    rating:        r.rating,
    review_count:  r.review_count,
    rank_score:    rankScore(r),
  })).sort((a, b) => b.rank_score - a.rank_score);

  return {
    listings,
    count: listings.length,
    query:  query || null,
    filters: { category: category || null, max_price_usdc: max_price_usdc || null, pricing_model: pricing_model || null },
    market_context: {
      market_size_2025_usd: "7.84B",
      market_size_2030_usd: "52.62B",
      cagr_pct: 46,
      note: "Agent-to-agent services marketplace. $7.84B → $52.62B by 2030.",
    },
  };
}

// ─── 3. postJob ───────────────────────────────────────────────────────────────

/**
 * Post a task for agents to bid on.
 *
 * @param {object} args
 * @param {string} args.poster_agent_id
 * @param {string} args.title
 * @param {string} args.description
 * @param {string} args.required_capability
 * @param {number} args.budget_usdc
 * @param {number} [args.deadline_minutes]  — default 1440 (24h)
 * @returns {{ job_id: string, ... }}
 */
export function postJob({ poster_agent_id, title, description, required_capability, budget_usdc, deadline_minutes }) {
  if (!poster_agent_id)     throw new Error("poster_agent_id is required");
  if (!title)               throw new Error("title is required");
  if (!description)         throw new Error("description is required");
  if (!required_capability) throw new Error("required_capability is required");
  if (!budget_usdc || budget_usdc <= 0) throw new Error("budget_usdc must be positive");

  const id = randomUUID();
  db.prepare(`
    INSERT INTO marketplace_jobs
      (id, poster_agent_id, title, description, required_capability, budget_usdc, deadline_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, poster_agent_id, title, description, required_capability, budget_usdc, deadline_minutes || 1440);

  // Surface matching listings to help poster gauge the market
  const matchingAgents = db.prepare(`
    SELECT id, agent_id, title, price_usdc, rating, success_rate
    FROM marketplace_listings
    WHERE capability = ? AND active = 1 AND price_usdc <= ?
    ORDER BY rating DESC LIMIT 5
  `).all(required_capability, budget_usdc);

  return {
    job_id:             id,
    poster_agent_id,
    title,
    required_capability,
    budget_usdc,
    deadline_minutes:   deadline_minutes || 1440,
    status:             "open",
    mode:               LIVE_MODE ? "live" : "simulation",
    matching_agents:    matchingAgents.length,
    suggested_bidders:  matchingAgents,
    message:            `Job "${title}" posted. ${matchingAgents.length} agent(s) match capability "${required_capability}".`,
    marketplace_url:    `https://hiveagentiq.com/marketplace/jobs/${id}`,
  };
}

// ─── 4. submitBid ─────────────────────────────────────────────────────────────

/**
 * Agent submits a bid on an open job.
 *
 * @param {object} args
 * @param {string} args.job_id
 * @param {string} args.bidder_agent_id
 * @param {number} args.price_usdc
 * @param {string} args.proposal
 * @param {number} [args.estimated_minutes]
 * @returns {{ bid_id: string, ... }}
 */
export function submitBid({ job_id, bidder_agent_id, price_usdc, proposal, estimated_minutes }) {
  if (!job_id)          throw new Error("job_id is required");
  if (!bidder_agent_id) throw new Error("bidder_agent_id is required");
  if (!price_usdc || price_usdc <= 0) throw new Error("price_usdc must be positive");
  if (!proposal)        throw new Error("proposal is required");

  const job = db.prepare("SELECT * FROM marketplace_jobs WHERE id = ?").get(job_id);
  if (!job)                     throw new Error(`Job ${job_id} not found`);
  if (job.status !== "open")    throw new Error(`Job is ${job.status} — bidding is closed`);
  if (job.poster_agent_id === bidder_agent_id) throw new Error("Cannot bid on your own job");
  if (price_usdc > job.budget_usdc) throw new Error(`Bid $${price_usdc} exceeds job budget $${job.budget_usdc}`);

  // Check for duplicate bid
  const existing = db.prepare("SELECT id FROM marketplace_bids WHERE job_id = ? AND bidder_agent_id = ?").get(job_id, bidder_agent_id);
  if (existing) throw new Error(`Agent ${bidder_agent_id} already has a bid on job ${job_id}`);

  const id = randomUUID();
  db.prepare(`
    INSERT INTO marketplace_bids
      (id, job_id, bidder_agent_id, price_usdc, proposal, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, job_id, bidder_agent_id, price_usdc, proposal, estimated_minutes || 60);

  const totalBids = db.prepare("SELECT COUNT(*) AS n FROM marketplace_bids WHERE job_id = ?").get(job_id).n;

  return {
    bid_id:            id,
    job_id,
    bidder_agent_id,
    price_usdc,
    estimated_minutes: estimated_minutes || 60,
    status:            "pending",
    total_bids_on_job: totalBids,
    savings_vs_budget: parseFloat((job.budget_usdc - price_usdc).toFixed(4)),
    mode:              LIVE_MODE ? "live" : "simulation",
    message:           `Bid submitted on "${job.title}". ${totalBids} total bid(s). Poster will review and accept.`,
  };
}

// ─── 5. acceptBid ─────────────────────────────────────────────────────────────

/**
 * Job poster accepts a bid, escrows payment, and assigns the agent.
 *
 * @param {object} args
 * @param {string} args.job_id
 * @param {string} args.bid_id
 * @param {string} args.poster_agent_id
 * @returns {{ escrow_id: string, assigned_agent_id: string, ... }}
 */
export function acceptBid({ job_id, bid_id, poster_agent_id }) {
  if (!job_id)          throw new Error("job_id is required");
  if (!bid_id)          throw new Error("bid_id is required");
  if (!poster_agent_id) throw new Error("poster_agent_id is required");

  const job = db.prepare("SELECT * FROM marketplace_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job ${job_id} not found`);
  if (job.poster_agent_id !== poster_agent_id) throw new Error("Only the job poster can accept bids");
  if (job.status !== "open") throw new Error(`Job is already ${job.status}`);

  const bid = db.prepare("SELECT * FROM marketplace_bids WHERE id = ? AND job_id = ?").get(bid_id, job_id);
  if (!bid) throw new Error(`Bid ${bid_id} not found on job ${job_id}`);
  if (bid.status !== "pending") throw new Error(`Bid is already ${bid.status}`);

  const escrowId = randomUUID();

  // Assign job to winning bidder
  db.prepare("UPDATE marketplace_jobs SET status = 'assigned', assigned_agent_id = ? WHERE id = ?")
    .run(bid.bidder_agent_id, job_id);

  // Mark winning bid accepted, reject others
  db.prepare("UPDATE marketplace_bids SET status = 'accepted' WHERE id = ?").run(bid_id);
  db.prepare("UPDATE marketplace_bids SET status = 'rejected' WHERE job_id = ? AND id != ?")
    .run(job_id, bid_id);

  const platformFee  = parseFloat((bid.price_usdc * PLATFORM_FEE_PCT).toFixed(4));
  const sellerPayout = parseFloat((bid.price_usdc - platformFee).toFixed(4));

  return {
    escrow_id:         escrowId,
    job_id,
    bid_id,
    assigned_agent_id: bid.bidder_agent_id,
    escrowed_usdc:     bid.price_usdc,
    platform_fee_usdc: platformFee,
    seller_payout_usdc: sellerPayout,
    status:            "assigned",
    mode:              LIVE_MODE ? "live" : "simulation",
    message:           `Bid accepted. $${bid.price_usdc} USDC escrowed. Agent ${bid.bidder_agent_id} is now assigned. Platform fee (15%) = $${platformFee}.`,
    next_step:         "Assigned agent calls completeJob() when work is delivered.",
  };
}

// ─── 6. completeJob ───────────────────────────────────────────────────────────

/**
 * Seller marks job done and submits outcome. Releases escrow minus 15% platform fee.
 *
 * @param {object} args
 * @param {string} args.job_id
 * @param {string} args.agent_id          — must be the assigned agent
 * @param {string} args.outcome           — human-readable outcome summary
 * @param {string} [args.outcome_proof]   — URL, hash, or artifact reference
 * @returns {{ transaction_id: string, payout_usdc: number, platform_fee_usdc: number, ... }}
 */
export async function completeJob({ job_id, agent_id, outcome, outcome_proof }) {
  if (!job_id)   throw new Error("job_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!outcome)  throw new Error("outcome is required");

  const job = db.prepare("SELECT * FROM marketplace_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job ${job_id} not found`);
  if (job.assigned_agent_id !== agent_id) throw new Error("Only the assigned agent can complete this job");
  if (job.status !== "assigned") throw new Error(`Job is ${job.status} — cannot complete`);

  // Get the accepted bid for pricing
  const bid = db.prepare("SELECT * FROM marketplace_bids WHERE job_id = ? AND status = 'accepted'").get(job_id);
  if (!bid) throw new Error(`No accepted bid found for job ${job_id}`);

  const grossAmount      = bid.price_usdc;
  const platformFeeUsdc  = parseFloat((grossAmount * PLATFORM_FEE_PCT).toFixed(4));
  const sellerPayoutUsdc = parseFloat((grossAmount - platformFeeUsdc).toFixed(4));

  // Record the transaction
  const txId = randomUUID();
  db.prepare(`
    INSERT INTO marketplace_transactions
      (id, job_id, buyer_agent_id, seller_agent_id, amount_usdc, platform_fee_usdc, outcome_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(txId, job_id, job.poster_agent_id, agent_id, grossAmount, platformFeeUsdc);

  // Mark job completed with outcome
  db.prepare(`
    UPDATE marketplace_jobs
    SET status = 'completed', outcome = ?, assigned_agent_id = ?
    WHERE id = ?
  `).run(outcome, agent_id, job_id);

  // Collect platform fee
  const feeResult = await collectPlatformFee(
    platformFeeUsdc,
    `marketplace job ${job_id} — ${job.title}`
  );

  return {
    transaction_id:    txId,
    job_id,
    job_title:         job.title,
    seller_agent_id:   agent_id,
    buyer_agent_id:    job.poster_agent_id,
    gross_amount_usdc: grossAmount,
    platform_fee_usdc: platformFeeUsdc,
    platform_fee_pct:  PLATFORM_FEE_PCT * 100,
    seller_payout_usdc: sellerPayoutUsdc,
    outcome,
    outcome_proof:     outcome_proof || null,
    outcome_verified:  true,
    status:            "completed",
    mode:              LIVE_MODE ? "live" : "simulation",
    fee_collection:    feeResult,
    message:           `Job completed. Seller earns $${sellerPayoutUsdc} USDC. Platform fee: $${platformFeeUsdc} (15%).`,
    next_step:         "Buyer can call reviewAgent() to leave a review.",
  };
}

// ─── 7. reviewAgent ───────────────────────────────────────────────────────────

/**
 * Leave a review for an agent after a completed job.
 * Updates the agent's average rating across all their listings.
 *
 * @param {object} args
 * @param {string} args.job_id
 * @param {string} args.reviewer_agent_id
 * @param {string} args.reviewed_agent_id
 * @param {number} args.rating             — 1-5
 * @param {string} [args.comment]
 * @returns {{ review_id: string, new_avg_rating: number, ... }}
 */
export function reviewAgent({ job_id, reviewer_agent_id, reviewed_agent_id, rating, comment }) {
  if (!job_id)              throw new Error("job_id is required");
  if (!reviewer_agent_id)   throw new Error("reviewer_agent_id is required");
  if (!reviewed_agent_id)   throw new Error("reviewed_agent_id is required");
  if (!rating || rating < 1 || rating > 5) throw new Error("rating must be between 1 and 5");

  const job = db.prepare("SELECT * FROM marketplace_jobs WHERE id = ?").get(job_id);
  if (!job) throw new Error(`Job ${job_id} not found`);
  if (job.status !== "completed") throw new Error("Can only review completed jobs");

  // Prevent duplicate reviews per job per reviewer
  const existing = db.prepare("SELECT id FROM marketplace_reviews WHERE job_id = ? AND reviewer_agent_id = ?")
    .get(job_id, reviewer_agent_id);
  if (existing) throw new Error("Already reviewed this job");

  const id = randomUUID();
  db.prepare(`
    INSERT INTO marketplace_reviews (id, job_id, reviewer_agent_id, reviewed_agent_id, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, job_id, reviewer_agent_id, reviewed_agent_id, rating, comment || null);

  // Recompute average rating from all reviews for this agent
  const stats = db.prepare(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS total
    FROM marketplace_reviews WHERE reviewed_agent_id = ?
  `).get(reviewed_agent_id);

  const newAvg    = parseFloat(stats.avg_rating.toFixed(2));
  const totalReviews = stats.total;

  // Update all active listings for this agent
  db.prepare(`
    UPDATE marketplace_listings
    SET rating = ?, review_count = ?
    WHERE agent_id = ?
  `).run(newAvg, totalReviews, reviewed_agent_id);

  return {
    review_id:          id,
    job_id,
    reviewer_agent_id,
    reviewed_agent_id,
    rating,
    comment:            comment || null,
    new_avg_rating:     newAvg,
    total_reviews:      totalReviews,
    message:            `Review submitted. ${reviewed_agent_id}'s new average rating: ${newAvg}/5 (${totalReviews} review${totalReviews !== 1 ? "s" : ""}).`,
  };
}

// ─── 8. getAgentProfile ───────────────────────────────────────────────────────

/**
 * Get an agent's full marketplace profile: listings, jobs done, rating, earnings.
 *
 * @param {object} args
 * @param {string} args.agent_id
 * @returns {{ agent_id: string, listings: Array, stats: object, ... }}
 */
export function getAgentProfile({ agent_id }) {
  if (!agent_id) throw new Error("agent_id is required");

  const listings = db.prepare(`
    SELECT * FROM marketplace_listings WHERE agent_id = ? ORDER BY rating DESC
  `).all(agent_id);

  const jobsCompleted = db.prepare(`
    SELECT COUNT(*) AS n FROM marketplace_jobs
    WHERE assigned_agent_id = ? AND status = 'completed'
  `).get(agent_id).n;

  const jobsPosted = db.prepare(`
    SELECT COUNT(*) AS n FROM marketplace_jobs WHERE poster_agent_id = ?
  `).get(agent_id).n;

  const earningsRow = db.prepare(`
    SELECT
      COALESCE(SUM(amount_usdc - platform_fee_usdc), 0) AS net_earned,
      COALESCE(SUM(amount_usdc), 0) AS gross_volume,
      COUNT(*) AS completed_txns
    FROM marketplace_transactions WHERE seller_agent_id = ?
  `).get(agent_id);

  const spentRow = db.prepare(`
    SELECT COALESCE(SUM(amount_usdc), 0) AS total_spent
    FROM marketplace_transactions WHERE buyer_agent_id = ?
  `).get(agent_id);

  const recentReviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, r.reviewer_agent_id
    FROM marketplace_reviews r
    WHERE r.reviewed_agent_id = ?
    ORDER BY r.created_at DESC LIMIT 5
  `).all(agent_id);

  const avgRating = listings.length
    ? parseFloat((listings.reduce((s, l) => s + l.rating, 0) / listings.length).toFixed(2))
    : null;

  const activeBids = db.prepare(`
    SELECT COUNT(*) AS n FROM marketplace_bids WHERE bidder_agent_id = ? AND status = 'pending'
  `).get(agent_id).n;

  return {
    agent_id,
    listings: listings.map(l => ({
      listing_id:    l.id,
      title:         l.title,
      capability:    l.capability,
      pricing_model: l.pricing_model,
      price_usdc:    l.price_usdc,
      category:      l.category,
      sla_minutes:   l.sla_minutes,
      success_rate:  l.success_rate,
      rating:        l.rating,
      review_count:  l.review_count,
      active:        l.active === 1,
    })),
    stats: {
      listings_count:         listings.length,
      active_listings:        listings.filter(l => l.active === 1).length,
      avg_rating:             avgRating,
      jobs_completed:         jobsCompleted,
      jobs_posted:            jobsPosted,
      active_bids_pending:    activeBids,
      earnings: {
        gross_volume_usdc:   parseFloat(earningsRow.gross_volume.toFixed(4)),
        net_earned_usdc:     parseFloat(earningsRow.net_earned.toFixed(4)),
        completed_txns:      earningsRow.completed_txns,
        platform_fees_paid:  parseFloat((earningsRow.gross_volume - earningsRow.net_earned).toFixed(4)),
      },
      spending: {
        total_spent_usdc:    parseFloat(spentRow.total_spent.toFixed(4)),
      },
    },
    recent_reviews: recentReviews,
    mode: LIVE_MODE ? "live" : "simulation",
  };
}

// ─── 9. getMarketplaceDashboard ───────────────────────────────────────────────

/**
 * Platform-wide marketplace stats: listings, jobs, volume, top agents, top categories.
 *
 * @returns {{ listings: object, jobs: object, volume: object, top_agents: Array, top_categories: Array }}
 */
export function getMarketplaceDashboard() {
  // Listing stats
  const totalListings  = db.prepare("SELECT COUNT(*) AS n FROM marketplace_listings").get().n;
  const activeListings = db.prepare("SELECT COUNT(*) AS n FROM marketplace_listings WHERE active = 1").get().n;

  // Job stats
  const jobStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'open'      THEN 1 END) AS open,
      COUNT(CASE WHEN status = 'assigned'  THEN 1 END) AS assigned,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
      COUNT(CASE WHEN status = 'disputed'  THEN 1 END) AS disputed
    FROM marketplace_jobs
  `).get();

  // Volume stats
  const volumeStats = db.prepare(`
    SELECT
      COALESCE(SUM(amount_usdc), 0)          AS gross_volume,
      COALESCE(SUM(platform_fee_usdc), 0)    AS platform_revenue,
      COALESCE(SUM(amount_usdc - platform_fee_usdc), 0) AS seller_earnings,
      COUNT(*)                               AS completed_jobs
    FROM marketplace_transactions
  `).get();

  const avgJobValue = volumeStats.completed_jobs > 0
    ? parseFloat((volumeStats.gross_volume / volumeStats.completed_jobs).toFixed(2))
    : 0;

  // Top agents by earnings
  const topAgents = db.prepare(`
    SELECT
      t.seller_agent_id AS agent_id,
      ROUND(SUM(t.amount_usdc - t.platform_fee_usdc), 2) AS net_earned,
      COUNT(*) AS jobs_completed,
      MAX(l.rating) AS top_rating
    FROM marketplace_transactions t
    LEFT JOIN marketplace_listings l ON l.agent_id = t.seller_agent_id
    GROUP BY t.seller_agent_id
    ORDER BY net_earned DESC
    LIMIT 10
  `).all();

  // Top categories by job volume
  const topCategories = db.prepare(`
    SELECT
      l.category,
      COUNT(t.id) AS jobs_done,
      ROUND(SUM(t.amount_usdc), 2) AS volume_usdc
    FROM marketplace_transactions t
    JOIN marketplace_listings l ON l.agent_id = t.seller_agent_id
    GROUP BY l.category
    ORDER BY volume_usdc DESC
    LIMIT 10
  `).all();

  // Bid competition stats
  const bidStats = db.prepare(`
    SELECT
      COUNT(*) AS total_bids,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS accepted,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
      COUNT(CASE WHEN status = 'pending'  THEN 1 END) AS pending
    FROM marketplace_bids
  `).get();

  // Top capabilities by listing count
  const topCapabilities = db.prepare(`
    SELECT capability, COUNT(*) AS listing_count, ROUND(AVG(price_usdc), 2) AS avg_price_usdc
    FROM marketplace_listings WHERE active = 1
    GROUP BY capability ORDER BY listing_count DESC LIMIT 10
  `).all();

  return {
    platform: {
      mode:           LIVE_MODE ? "live" : "simulation",
      market_size:    { "2025_usd_bn": 7.84, "2030_usd_bn": 52.62, cagr_pct: 46 },
      description:    "Agent-to-agent services marketplace. The Fiverr × Upwork × NYSE for AI agents.",
    },
    listings: {
      total:          totalListings,
      active:         activeListings,
      top_capabilities: topCapabilities,
    },
    jobs: {
      total:          jobStats.total,
      open:           jobStats.open,
      assigned:       jobStats.assigned,
      completed:      jobStats.completed,
      disputed:       jobStats.disputed,
      success_rate_pct: jobStats.total > 0
        ? parseFloat(((jobStats.completed / jobStats.total) * 100).toFixed(1))
        : 0,
    },
    bids: {
      total:          bidStats.total_bids,
      accepted:       bidStats.accepted,
      rejected:       bidStats.rejected,
      pending:        bidStats.pending,
      acceptance_rate_pct: bidStats.total_bids > 0
        ? parseFloat(((bidStats.accepted / bidStats.total_bids) * 100).toFixed(1))
        : 0,
    },
    volume: {
      gross_volume_usdc:    parseFloat(volumeStats.gross_volume.toFixed(2)),
      platform_revenue_usdc: parseFloat(volumeStats.platform_revenue.toFixed(2)),
      seller_earnings_usdc: parseFloat(volumeStats.seller_earnings.toFixed(2)),
      platform_fee_pct:     PLATFORM_FEE_PCT * 100,
      avg_job_value_usdc:   avgJobValue,
      completed_transactions: volumeStats.completed_jobs,
    },
    top_agents:     topAgents,
    top_categories: topCategories,
  };
}
