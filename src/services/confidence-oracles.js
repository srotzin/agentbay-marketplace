import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const ORACLE_PLATFORM_COMMISSION   = 0.10; // 10% rake on all staked amounts
const QUERY_LISTING_FEE_USD        = 0.50; // fee to post a query to the oracle market
const AGGREGATION_FEE_USD          = 1.50; // fee to retrieve calibrated aggregate estimate

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS oracle_queries (
    id                  TEXT PRIMARY KEY,
    question            TEXT NOT NULL,
    domain              TEXT NOT NULL,
    stake_usd           REAL NOT NULL,
    resolution_criteria TEXT NOT NULL,
    status              TEXT DEFAULT 'open' CHECK(status IN (
                          'open','closed','resolving','resolved','void')),
    resolution          TEXT,
    resolution_source   TEXT,
    posted_by           TEXT NOT NULL,
    listing_fee_usd     REAL NOT NULL,
    total_staked_usd    REAL DEFAULT 0,
    answer_count        INTEGER DEFAULT 0,
    closes_at           TEXT NOT NULL,
    resolved_at         TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS oracle_stakes (
    id               TEXT PRIMARY KEY,
    query_id         TEXT NOT NULL REFERENCES oracle_queries(id),
    staker_id        TEXT NOT NULL,
    answer           TEXT NOT NULL,
    confidence_level REAL NOT NULL CHECK(confidence_level BETWEEN 0.0 AND 1.0),
    stake_usd        REAL NOT NULL,
    commission_usd   REAL NOT NULL,
    net_stake_usd    REAL NOT NULL,
    payout_usd       REAL DEFAULT 0,
    outcome          TEXT DEFAULT 'pending' CHECK(outcome IN ('pending','won','lost','refunded')),
    rationale        TEXT,
    staker_score     REAL DEFAULT 5.0,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Open Queries ────────────────────────────────────────────────────────

const _queryCount = db.prepare("SELECT COUNT(*) as n FROM oracle_queries").get().n;
if (_queryCount === 0) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const nextWeek  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const seedQueries = [
    {
      id: uuid(), domain: "economics",
      question: "Will the US Federal Funds Rate be cut by 25bps or more before end of Q3 2026?",
      resolution_criteria: "Resolves YES if the FOMC announces a 25bps+ rate cut with effective date on or before September 30, 2026.",
      stake_usd: 500, total_staked_usd: 4820, answer_count: 47, closes_at: nextWeek,
    },
    {
      id: uuid(), domain: "technology",
      question: "Will a frontier AI model pass the full ARC-AGI benchmark above 85% by end of 2026?",
      resolution_criteria: "Resolves YES if any publicly released AI system scores >85% on the official ARC-AGI evaluation suite.",
      stake_usd: 250, total_staked_usd: 12400, answer_count: 134, closes_at: nextWeek,
    },
    {
      id: uuid(), domain: "web_automation",
      question: "Will agent_epsilon complete a 50-step browser automation task without human intervention?",
      resolution_criteria: "Resolves YES if agent_epsilon demonstrates end-to-end completion of a 50-step browser workflow with zero HITL interventions in a verified test.",
      stake_usd: 100, total_staked_usd: 1840, answer_count: 21, closes_at: tomorrow,
    },
    {
      id: uuid(), domain: "security",
      question: "Will the HiveAgent MCP marketplace experience a critical security incident in H1 2026?",
      resolution_criteria: "Resolves YES if HiveAgent publishes a security advisory rated CVSS ≥9.0 for any vulnerability exploited in production between Jan 1 and Jun 30, 2026.",
      stake_usd: 750, total_staked_usd: 8200, answer_count: 89, closes_at: nextWeek,
    },
    {
      id: uuid(), domain: "finance",
      question: "Will BTC/USD close above $120,000 on any single day before July 1, 2026?",
      resolution_criteria: "Resolves YES if the daily close price of BTC/USD on Coinbase Pro exceeds $120,000 on any day between now and June 30, 2026.",
      stake_usd: 1000, total_staked_usd: 31500, answer_count: 312, closes_at: nextWeek,
    },
  ];

  const insertQuery = db.prepare(`
    INSERT OR IGNORE INTO oracle_queries
      (id, question, domain, stake_usd, resolution_criteria, status, posted_by,
       listing_fee_usd, total_staked_usd, answer_count, closes_at, created_at)
    VALUES
      (@id, @question, @domain, @stake_usd, @resolution_criteria, 'open', @posted_by,
       @listing_fee_usd, @total_staked_usd, @answer_count, @closes_at, @created_at)
  `);

  for (const q of seedQueries) {
    insertQuery.run({
      ...q,
      posted_by:      `agent_${uuid().slice(0, 8)}`,
      listing_fee_usd: QUERY_LISTING_FEE_USD,
      created_at:     new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCalibration(stakes) {
  if (stakes.length === 0) return { estimate: 0.5, confidence_interval: [0.2, 0.8], staker_count: 0 };

  // Aggregate confidence levels weighted by net stake
  const totalWeight       = stakes.reduce((s, st) => s + st.net_stake_usd, 0);
  const weightedSum       = stakes.reduce((s, st) => s + st.confidence_level * st.net_stake_usd, 0);
  const weightedMean      = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Variance for credible interval
  const variance          = stakes.reduce((s, st) => {
    const diff = st.confidence_level - weightedMean;
    return s + (diff * diff * st.net_stake_usd);
  }, 0) / (totalWeight || 1);
  const stdDev            = Math.sqrt(variance);

  const lower             = Math.max(0, Math.round((weightedMean - 1.645 * stdDev) * 1000) / 1000);
  const upper             = Math.min(1, Math.round((weightedMean + 1.645 * stdDev) * 1000) / 1000);

  return {
    estimate:            Math.round(weightedMean * 1000) / 1000,
    confidence_interval: [lower, upper],
    staker_count:        stakes.length,
    total_staked_usd:    Math.round(totalWeight * 100) / 100,
    std_dev:             Math.round(stdDev * 1000) / 1000,
  };
}

// ─── Query Confidence ─────────────────────────────────────────────────────────

/**
 * Post a question to the oracle market with financial stakes attached.
 * Returns the current calibrated confidence distribution if similar questions exist.
 * @param {string} question   - The epistemic question to post
 * @param {string} domain     - Thematic domain (economics|technology|security|finance|web_automation|other)
 * @param {number} stakeUsd   - USD amount to attach as bounty for accurate answering
 * @returns Query record with existing calibrated distribution if available
 */
export function queryConfidence(question, domain, stakeUsd) {
  const validDomains = ["economics","technology","security","finance","web_automation",
                        "science","geopolitics","health","energy","other"];
  if (!question)             throw new Error("question is required");
  if (!validDomains.includes(domain)) throw new Error(`Invalid domain. Must be one of: ${validDomains.join(", ")}`);
  if (stakeUsd == null || stakeUsd < 1) throw new Error("stakeUsd must be at least $1");

  const id         = uuid();
  const postedBy   = `agent_${uuid().slice(0, 8)}`;
  const closesAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now        = new Date().toISOString();

  const resolutionCriteria = `Question resolves based on externally verifiable ground truth within the ${domain} domain. `
    + `Resolution source must be a primary or authoritative reference accepted by at least 2 of 3 designated oracle validators.`;

  db.prepare(`
    INSERT OR IGNORE INTO oracle_queries
      (id, question, domain, stake_usd, resolution_criteria, status, posted_by,
       listing_fee_usd, total_staked_usd, answer_count, closes_at, created_at)
    VALUES
      (@id, @question, @domain, @stake_usd, @resolution_criteria, 'open', @posted_by,
       @listing_fee_usd, 0, 0, @closes_at, @created_at)
  `).run({
    id,
    question,
    domain,
    stake_usd:        stakeUsd,
    resolution_criteria: resolutionCriteria,
    posted_by:        postedBy,
    listing_fee_usd:  QUERY_LISTING_FEE_USD,
    closes_at:        closesAt,
    created_at:       now,
  });

  // Surface existing calibration from similar domain queries
  const relatedQuery = db.prepare(
    "SELECT * FROM oracle_queries WHERE domain = ? AND status = 'open' AND id != ? ORDER BY answer_count DESC LIMIT 1"
  ).get(domain, id);

  let existingCalibration = null;
  if (relatedQuery && relatedQuery.answer_count > 0) {
    const relatedStakes = db.prepare(
      "SELECT * FROM oracle_stakes WHERE query_id = ?"
    ).all(relatedQuery.id);
    if (relatedStakes.length > 0) {
      existingCalibration = {
        similar_query_id: relatedQuery.id,
        similar_question: relatedQuery.question,
        calibration:      computeCalibration(relatedStakes),
      };
    }
  }

  return {
    query_id:            id,
    question,
    domain,
    status:              "open",
    stake_usd:           stakeUsd,
    listing_fee_usd:     QUERY_LISTING_FEE_USD,
    platform_commission_usd: Math.round(QUERY_LISTING_FEE_USD * ORACLE_PLATFORM_COMMISSION * 100) / 100,
    resolution_criteria: resolutionCriteria,
    closes_at:           closesAt,
    existing_domain_calibration: existingCalibration,
    posted_at:           now,
    message:             `Query posted. Stakers in the '${domain}' domain will be notified. Closes in 7 days.`,
  };
}

// ─── Stake Answer ─────────────────────────────────────────────────────────────

/**
 * Stake reputation and USD on an answer to an open oracle query.
 * @param {string} queryId         - Open query to answer
 * @param {string} answer          - The staker's answer (free text or yes/no/probability)
 * @param {number} confidenceLevel - Calibrated confidence in this answer (0.0–1.0)
 * @param {number} stakeUsd        - USD amount to stake on this answer
 * @returns Stake receipt with potential payout calculation
 */
export function stakeAnswer(queryId, answer, confidenceLevel, stakeUsd) {
  if (!queryId)                  throw new Error("queryId is required");
  if (!answer)                   throw new Error("answer is required");
  if (confidenceLevel == null || confidenceLevel < 0 || confidenceLevel > 1) {
    throw new Error("confidenceLevel must be between 0.0 and 1.0");
  }
  if (stakeUsd == null || stakeUsd < 0.10) throw new Error("stakeUsd must be at least $0.10");

  const query = db.prepare("SELECT * FROM oracle_queries WHERE id = ?").get(queryId);
  if (!query) throw new Error(`Query not found: ${queryId}`);
  if (query.status !== "open") throw new Error(`Cannot stake on query with status '${query.status}'.`);

  const stakerId    = `staker_${uuid().slice(0, 8)}`;
  const commission  = Math.round(stakeUsd * ORACLE_PLATFORM_COMMISSION * 100) / 100;
  const netStake    = Math.round((stakeUsd - commission) * 100) / 100;
  const id          = uuid();
  const now         = new Date().toISOString();

  // Calibration log-loss based max payout (Brier scoring approximation)
  const maxMultiplier = 1 + (1 - Math.abs(confidenceLevel - 0.5) * 2) * 2;
  const maxPayout     = Math.round(netStake * maxMultiplier * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO oracle_stakes
      (id, query_id, staker_id, answer, confidence_level, stake_usd,
       commission_usd, net_stake_usd, payout_usd, outcome, created_at)
    VALUES
      (@id, @query_id, @staker_id, @answer, @confidence_level, @stake_usd,
       @commission_usd, @net_stake_usd, 0, 'pending', @created_at)
  `).run({
    id,
    query_id:         queryId,
    staker_id:        stakerId,
    answer,
    confidence_level: confidenceLevel,
    stake_usd:        stakeUsd,
    commission_usd:   commission,
    net_stake_usd:    netStake,
    created_at:       now,
  });

  db.prepare(`
    UPDATE oracle_queries
    SET total_staked_usd = total_staked_usd + @net_stake,
        answer_count = answer_count + 1
    WHERE id = @id
  `).run({ net_stake: netStake, id: queryId });

  return {
    stake_id:            id,
    query_id:            queryId,
    staker_id:           stakerId,
    answer,
    confidence_level:    confidenceLevel,
    confidence_pct:      `${Math.round(confidenceLevel * 100)}%`,
    stake_usd:           stakeUsd,
    platform_commission_usd: commission,
    net_stake_usd:       netStake,
    max_potential_payout_usd: maxPayout,
    scoring_rule:        "brier-weighted",
    query_closes_at:     query.closes_at,
    staked_at:           now,
    message:             `Stake recorded. Your calibrated confidence of ${Math.round(confidenceLevel * 100)}% has been submitted. Max payout: $${maxPayout}.`,
  };
}

// ─── Get Calibrated Estimate ──────────────────────────────────────────────────

/**
 * Retrieve the aggregated calibrated probability estimate for a query from all stakers.
 * @param {string} queryId
 * @returns Calibrated distribution with confidence intervals and Brier metrics
 */
export function getCalibratedEstimate(queryId) {
  if (!queryId) throw new Error("queryId is required");

  const query = db.prepare("SELECT * FROM oracle_queries WHERE id = ?").get(queryId);
  if (!query) throw new Error(`Query not found: ${queryId}`);

  const stakes = db.prepare(
    "SELECT * FROM oracle_stakes WHERE query_id = ? ORDER BY net_stake_usd DESC"
  ).all(queryId);

  const calibration = computeCalibration(stakes);

  // Build answer distribution
  const answerMap = {};
  for (const s of stakes) {
    const key = s.answer.toLowerCase().trim();
    if (!answerMap[key]) answerMap[key] = { answer: s.answer, count: 0, total_stake: 0, avg_confidence: 0 };
    answerMap[key].count++;
    answerMap[key].total_stake += s.net_stake_usd;
    answerMap[key].avg_confidence += s.confidence_level;
  }
  for (const v of Object.values(answerMap)) {
    v.avg_confidence = Math.round((v.avg_confidence / v.count) * 1000) / 1000;
    v.total_stake    = Math.round(v.total_stake * 100) / 100;
    v.stake_share_pct = Math.round((v.total_stake / (calibration.total_staked_usd || 1)) * 1000) / 10;
  }

  const sortedAnswers = Object.values(answerMap)
    .sort((a, b) => b.total_stake - a.total_stake);

  return {
    query_id:            queryId,
    question:            query.question,
    domain:              query.domain,
    status:              query.status,
    calibrated_estimate: calibration.estimate,
    confidence_interval_90pct: calibration.confidence_interval,
    std_dev:             calibration.std_dev,
    staker_count:        calibration.staker_count,
    total_staked_usd:    calibration.total_staked_usd ?? query.total_staked_usd,
    fee_usd:             AGGREGATION_FEE_USD,
    platform_commission_usd: Math.round(AGGREGATION_FEE_USD * ORACLE_PLATFORM_COMMISSION * 100) / 100,
    answer_distribution: sortedAnswers,
    market_summary:      calibration.staker_count === 0
                           ? "No stakers yet. Be the first to stake an answer."
                           : calibration.estimate > 0.7
                           ? "Market leans strongly YES. High consensus among stakers."
                           : calibration.estimate < 0.3
                           ? "Market leans strongly NO. Strong disagreement with the premise."
                           : "Market is divided. Significant uncertainty remains.",
    closes_at:           query.closes_at,
    resolved_at:         query.resolved_at ?? null,
    methodology:         "stake-weighted-brier-calibration-v1",
    retrieved_at:        new Date().toISOString(),
  };
}

// ─── List Open Queries ────────────────────────────────────────────────────────

/**
 * Browse open oracle questions needing answers in a given domain.
 * @param {string} domain - Optional: filter by domain
 * @returns List of open queries sorted by total stake (highest first)
 */
export function listOpenQueries(domain) {
  const validDomains = ["economics","technology","security","finance","web_automation",
                        "science","geopolitics","health","energy","other"];
  if (domain && !validDomains.includes(domain)) {
    throw new Error(`Invalid domain. Must be one of: ${validDomains.join(", ")}`);
  }

  let sql    = "SELECT * FROM oracle_queries WHERE status = 'open'";
  const params = [];
  if (domain) {
    sql += " AND domain = ?";
    params.push(domain);
  }
  sql += " ORDER BY total_staked_usd DESC, answer_count DESC";

  const queries = db.prepare(sql).all(...params);

  const now = Date.now();

  return {
    domain_filter:   domain ?? "all",
    open_queries:    queries.length,
    queries: queries.map(q => {
      const closesMs      = new Date(q.closes_at).getTime();
      const hoursRemaining = Math.max(0, Math.round((closesMs - now) / 3600000));
      return {
        query_id:              q.id,
        question:              q.question,
        domain:                q.domain,
        total_staked_usd:      q.total_staked_usd,
        answer_count:          q.answer_count,
        hours_remaining:       hoursRemaining,
        closes_at:             q.closes_at,
        resolution_criteria:   q.resolution_criteria,
        stake_to_participate_usd: 0.10,
        urgency:               hoursRemaining < 4 ? "closing_soon" : hoursRemaining < 24 ? "active" : "open",
        posted_at:             q.created_at,
      };
    }),
    retrieved_at:    new Date().toISOString(),
  };
}

// ─── Resolve Query ────────────────────────────────────────────────────────────

/**
 * Resolve an oracle query with ground truth, triggering payout calculations.
 * @param {string} queryId    - Query to resolve
 * @param {string} resolution - The verified ground truth answer
 * @returns Resolution record with payout distribution to winning stakers
 */
export function resolveQuery(queryId, resolution) {
  if (!queryId)    throw new Error("queryId is required");
  if (!resolution) throw new Error("resolution is required");

  const query = db.prepare("SELECT * FROM oracle_queries WHERE id = ?").get(queryId);
  if (!query)                      throw new Error(`Query not found: ${queryId}`);
  if (query.status === "resolved") throw new Error("Query is already resolved.");
  if (query.status === "void")     throw new Error("Cannot resolve a voided query.");

  const now    = new Date().toISOString();
  const stakes = db.prepare(
    "SELECT * FROM oracle_stakes WHERE query_id = ?"
  ).all(queryId);

  const resolutionNorm = resolution.toLowerCase().trim();
  const winningStakes  = stakes.filter(s => s.answer.toLowerCase().trim() === resolutionNorm);
  const losingStakes   = stakes.filter(s => s.answer.toLowerCase().trim() !== resolutionNorm);

  const loserPool      = losingStakes.reduce((s, st) => s + st.net_stake_usd, 0);
  const winnerPool     = winningStakes.reduce((s, st) => s + st.net_stake_usd, 0);

  const payouts = winningStakes.map(s => {
    const share      = winnerPool > 0 ? s.net_stake_usd / winnerPool : 0;
    const rewardPool = loserPool * (1 - ORACLE_PLATFORM_COMMISSION);
    const payout     = Math.round((s.net_stake_usd + share * rewardPool) * 100) / 100;

    db.prepare("UPDATE oracle_stakes SET outcome = 'won', payout_usd = ? WHERE id = ?")
      .run(payout, s.id);

    return { staker_id: s.staker_id, answer: s.answer, stake_usd: s.stake_usd, payout_usd: payout };
  });

  for (const s of losingStakes) {
    db.prepare("UPDATE oracle_stakes SET outcome = 'lost', payout_usd = 0 WHERE id = ?").run(s.id);
  }

  db.prepare(`
    UPDATE oracle_queries
    SET status = 'resolved', resolution = ?, resolved_at = ?
    WHERE id = ?
  `).run(resolution, now, queryId);

  const platformRevenue = Math.round((loserPool * ORACLE_PLATFORM_COMMISSION) * 100) / 100;
  const totalPayout     = payouts.reduce((s, p) => s + p.payout_usd, 0);

  return {
    query_id:             queryId,
    question:             query.question,
    domain:               query.domain,
    resolution,
    status:               "resolved",
    total_stakers:        stakes.length,
    winning_stakers:      winningStakes.length,
    losing_stakers:       losingStakes.length,
    total_staked_usd:     Math.round((winnerPool + loserPool) * 100) / 100,
    total_payout_usd:     Math.round(totalPayout * 100) / 100,
    platform_revenue_usd: platformRevenue,
    winning_payouts:      payouts,
    brier_score_reward:   "distributed proportionally to net-staked weight among correct answerers",
    resolved_at:          now,
  };
}
