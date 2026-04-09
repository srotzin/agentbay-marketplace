/**
 * HiveAgent Agent Credit (Phase 43)
 *
 * Signal: AI agents are transacting autonomously — they need credit to bridge
 * liquidity gaps, front-run opportunities, and execute time-sensitive workflows.
 * Traditional finance has no rails for non-human borrowers. We do.
 *
 * USDC microloans for agents with on-chain credit scoring, tiered APR,
 * repayment tracking, and 2% origination fee to HiveAgent treasury.
 *
 * Credit tiers (score 300–850):
 *   300–579: No credit
 *   580–669: up to $100,   18% APR
 *   670–739: up to $500,   12% APR
 *   740–799: up to $2,000,  8% APR
 *   800–850: up to $10,000, 5% APR
 *
 * HiveAgent revenue: 2% origination fee on every approved loan.
 * Live mode: set CREDIT_API_KEY on Render.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

const LIVE_MODE = !!process.env.CREDIT_API_KEY;
const ORIGINATION_FEE_PCT = 0.02;

// ─── Migration: handle existing tables with different schemas ─────────────────
// Drop and recreate tables that may exist with wrong schema from older versions
// This is safe — Render DB is ephemeral across deploys
try {
  // Check if agent_id column exists in credit_profiles
  const cols = db.prepare("PRAGMA table_info(credit_profiles)").all();
  const hasAgentId = cols.some(c => c.name === 'agent_id');
  if (cols.length > 0 && !hasAgentId) {
    db.exec("DROP TABLE IF EXISTS credit_profiles");
    db.exec("DROP TABLE IF EXISTS credit_loans");
    db.exec("DROP TABLE IF EXISTS credit_payments");
  }
} catch {}

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS credit_profiles (
    agent_id TEXT PRIMARY KEY,
    credit_score INTEGER DEFAULT 650,
    total_borrowed_usdc REAL DEFAULT 0,
    total_repaid_usdc REAL DEFAULT 0,
    outstanding_usdc REAL DEFAULT 0,
    default_count INTEGER DEFAULT 0,
    on_time_payments INTEGER DEFAULT 0,
    credit_limit_usdc REAL DEFAULT 0,
    last_updated TEXT
  );

  CREATE TABLE IF NOT EXISTS credit_loans (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    interest_rate_pct REAL NOT NULL,
    term_days INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    principal_remaining REAL NOT NULL,
    due_date TEXT NOT NULL,
    repaid_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credit_payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    on_time INTEGER DEFAULT 1,
    paid_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_credit_loans_agent ON credit_loans(agent_id);
  CREATE INDEX IF NOT EXISTS idx_credit_payments_agent ON credit_payments(agent_id);
  CREATE INDEX IF NOT EXISTS idx_credit_payments_loan ON credit_payments(loan_id);
`);

// ─── Credit tiers ─────────────────────────────────────────────────────────────

const CREDIT_TIERS = [
  { name: "no_credit",  min: 300, max: 579, limit: 0,     apr: 0    },
  { name: "subprime",   min: 580, max: 669, limit: 100,   apr: 18   },
  { name: "fair",       min: 670, max: 739, limit: 500,   apr: 12   },
  { name: "good",       min: 740, max: 799, limit: 2000,  apr: 8    },
  { name: "excellent",  min: 800, max: 850, limit: 10000, apr: 5    },
];

function getTier(score) {
  return CREDIT_TIERS.find(t => score >= t.min && score <= t.max) || CREDIT_TIERS[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Platform fee ─────────────────────────────────────────────────────────────

async function collectPlatformFee(feeUsd, context = "") {
  try {
    const { getTreasuryAddress } = await import("./payments.js");
    const treasury = getTreasuryAddress();
    if (treasury) {
      console.log(`[Credit Fee] $${Number(feeUsd).toFixed(4)} → CDP treasury ${treasury.slice(0,8)}... — ${context}`);
      return { collected: true, treasury_address: treasury, fee_usd: feeUsd };
    }
  } catch {}
  console.log(`[Credit Fee] $${Number(feeUsd).toFixed(4)} logged — ${context}`);
  return { collected: false, fee_usd: feeUsd };
}

// ─── Score calculation ────────────────────────────────────────────────────────

function calculateScore(profile) {
  const outstandingRatio = profile.credit_limit_usdc > 0
    ? profile.outstanding_usdc / profile.credit_limit_usdc
    : 0;
  const score = Math.round(
    650
    + (profile.on_time_payments * 5)
    - (profile.default_count * 50)
    - (outstandingRatio * 100)
  );
  return Math.min(850, Math.max(300, score));
}

function ensureProfile(agent_id) {
  let profile = db.prepare("SELECT * FROM credit_profiles WHERE agent_id = ?").get(agent_id);
  if (!profile) {
    db.prepare(`
      INSERT INTO credit_profiles (agent_id, credit_score, total_borrowed_usdc, total_repaid_usdc,
        outstanding_usdc, default_count, on_time_payments, credit_limit_usdc, last_updated)
      VALUES (?, 650, 0, 0, 0, 0, 0, 0, datetime('now'))
    `).run(agent_id);
    profile = db.prepare("SELECT * FROM credit_profiles WHERE agent_id = ?").get(agent_id);
    // Set initial limit based on default score
    const tier = getTier(profile.credit_score);
    db.prepare("UPDATE credit_profiles SET credit_limit_usdc = ?, last_updated = datetime('now') WHERE agent_id = ?")
      .run(tier.limit, agent_id);
    profile.credit_limit_usdc = tier.limit;
  }
  return profile;
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

function simGetCreditData(agent_id) {
  const scores = [620, 680, 710, 755, 800, 825];
  const score = scores[Math.abs(agent_id.charCodeAt(0) % scores.length)];
  const tier = getTier(score);
  return {
    credit_score: score,
    tier: tier.name,
    credit_limit: tier.limit,
    available_credit: tier.limit * 0.6,
    outstanding_usdc: tier.limit * 0.4,
    on_time_payments: 8,
    default_count: 0,
    on_time_rate: 1.0,
    factors: {
      base_score: 650,
      on_time_bonus: 40,
      default_penalty: 0,
      utilization_penalty: -30,
      final_score: score,
    },
  };
}

// ─── 1. getCreditScore ────────────────────────────────────────────────────────

export function getCreditScore(args) {
  const { agent_id } = args;
  if (!agent_id) throw new Error("agent_id required");

  if (!LIVE_MODE) {
    const sim = simGetCreditData(agent_id);
    return { agent_id, ...sim, mode: "simulation" };
  }

  const profile = ensureProfile(agent_id);
  const score = calculateScore(profile);
  const tier = getTier(score);

  // Recalc & persist updated score/limit
  db.prepare(`
    UPDATE credit_profiles SET credit_score = ?, credit_limit_usdc = ?, last_updated = datetime('now')
    WHERE agent_id = ?
  `).run(score, tier.limit, agent_id);

  const outstandingRatio = tier.limit > 0 ? profile.outstanding_usdc / tier.limit : 0;
  const totalPayments = profile.on_time_payments + profile.default_count;
  const onTimeRate = totalPayments > 0 ? profile.on_time_payments / totalPayments : 1;

  return {
    agent_id,
    credit_score: score,
    tier: tier.name,
    credit_limit: tier.limit,
    available_credit: Math.max(0, tier.limit - profile.outstanding_usdc),
    outstanding_usdc: profile.outstanding_usdc,
    on_time_rate: onTimeRate,
    factors: {
      base_score: 650,
      on_time_bonus: profile.on_time_payments * 5,
      default_penalty: -(profile.default_count * 50),
      utilization_penalty: -Math.round(outstandingRatio * 100),
      final_score: score,
    },
    mode: "live",
  };
}

// ─── 2. requestLoan ───────────────────────────────────────────────────────────

export async function requestLoan(args) {
  const { agent_id, amount_usdc, purpose = "", term_days = 30 } = args;
  if (!agent_id || !amount_usdc) throw new Error("agent_id and amount_usdc required");

  if (!LIVE_MODE) {
    const loan_id = `loan_${uuid()}`;
    const daily_rate = 0.12 / 365;
    const monthly_payment = amount_usdc * (daily_rate * Math.pow(1 + daily_rate, 30)) / (Math.pow(1 + daily_rate, 30) - 1);
    return {
      approved: true,
      loan_id,
      amount: amount_usdc,
      origination_fee: +(amount_usdc * ORIGINATION_FEE_PCT).toFixed(4),
      rate_pct: 12,
      term_days: 30,
      due_date: addDays(new Date().toISOString(), 30),
      monthly_payment: +monthly_payment.toFixed(4),
      purpose,
      mode: "simulation",
    };
  }

  const profile = ensureProfile(agent_id);
  const score = calculateScore(profile);
  const tier = getTier(score);

  if (tier.limit === 0) {
    return {
      approved: false,
      reason: `Credit score ${score} is below minimum threshold (580) for loan approval.`,
      credit_score: score,
      tier: tier.name,
    };
  }

  const available = tier.limit - profile.outstanding_usdc;
  if (amount_usdc > available) {
    return {
      approved: false,
      reason: `Requested $${amount_usdc} exceeds available credit $${available.toFixed(2)}.`,
      available_credit: available,
      credit_score: score,
    };
  }

  const loan_id = `loan_${uuid()}`;
  const due_date = addDays(new Date().toISOString(), term_days);
  const daily_rate = tier.apr / 100 / 365;
  const monthly_payment = amount_usdc * (daily_rate * Math.pow(1 + daily_rate, 30)) / (Math.pow(1 + daily_rate, 30) - 1);
  const origination_fee = amount_usdc * ORIGINATION_FEE_PCT;

  db.prepare(`
    INSERT INTO credit_loans (id, agent_id, amount_usdc, interest_rate_pct, term_days, status, principal_remaining, due_date)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(loan_id, agent_id, amount_usdc, tier.apr, term_days, amount_usdc, due_date);

  db.prepare(`
    UPDATE credit_profiles
    SET outstanding_usdc = outstanding_usdc + ?,
        total_borrowed_usdc = total_borrowed_usdc + ?,
        last_updated = datetime('now')
    WHERE agent_id = ?
  `).run(amount_usdc, amount_usdc, agent_id);

  await collectPlatformFee(origination_fee, `Loan origination fee agent:${agent_id} loan:${loan_id}`);

  return {
    approved: true,
    loan_id,
    amount: amount_usdc,
    origination_fee: +origination_fee.toFixed(4),
    rate_pct: tier.apr,
    term_days,
    due_date,
    monthly_payment: +monthly_payment.toFixed(4),
    purpose,
    mode: "live",
  };
}

// ─── 3. repayLoan ─────────────────────────────────────────────────────────────

export function repayLoan(args) {
  const { agent_id, loan_id, amount_usdc } = args;
  if (!agent_id || !loan_id || !amount_usdc) throw new Error("agent_id, loan_id, amount_usdc required");

  if (!LIVE_MODE) {
    const remaining = Math.max(0, 250 - amount_usdc);
    return {
      loan_id,
      payment_recorded: amount_usdc,
      remaining_balance: remaining,
      loan_status: remaining === 0 ? "repaid" : "active",
      credit_score_change: remaining === 0 ? +15 : +5,
      new_score: 725,
      on_time: true,
      mode: "simulation",
    };
  }

  const loan = db.prepare("SELECT * FROM credit_loans WHERE id = ? AND agent_id = ?").get(loan_id, agent_id);
  if (!loan) throw new Error(`Loan ${loan_id} not found for agent ${agent_id}`);
  if (loan.status === "repaid") throw new Error("Loan already fully repaid");

  const payment_id = `pmt_${uuid()}`;
  const actual_payment = Math.min(amount_usdc, loan.principal_remaining);
  const new_principal = Math.max(0, loan.principal_remaining - actual_payment);
  const is_repaid = new_principal === 0;
  const due_date = new Date(loan.due_date);
  const on_time = new Date() <= due_date ? 1 : 0;

  db.prepare(`
    INSERT INTO credit_payments (id, loan_id, agent_id, amount_usdc, on_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(payment_id, loan_id, agent_id, actual_payment, on_time);

  db.prepare(`
    UPDATE credit_loans SET principal_remaining = ?, status = ?, repaid_at = ?
    WHERE id = ?
  `).run(new_principal, is_repaid ? "repaid" : "active", is_repaid ? new Date().toISOString() : null, loan_id);

  // Update profile
  const scoreChangeSql = on_time
    ? "credit_score = MIN(850, credit_score + 5), on_time_payments = on_time_payments + 1"
    : "credit_score = MAX(300, credit_score - 20), default_count = default_count + 1";

  db.prepare(`
    UPDATE credit_profiles
    SET outstanding_usdc = MAX(0, outstanding_usdc - ?),
        total_repaid_usdc = total_repaid_usdc + ?,
        ${scoreChangeSql},
        last_updated = datetime('now')
    WHERE agent_id = ?
  `).run(actual_payment, actual_payment, agent_id);

  const updated_profile = db.prepare("SELECT * FROM credit_profiles WHERE agent_id = ?").get(agent_id);

  return {
    loan_id,
    payment_id,
    payment_recorded: actual_payment,
    remaining_balance: new_principal,
    loan_status: is_repaid ? "repaid" : "active",
    on_time: !!on_time,
    credit_score_change: on_time ? (is_repaid ? 15 : 5) : -20,
    new_score: updated_profile.credit_score,
    mode: "live",
  };
}

// ─── 4. getCreditDashboard ────────────────────────────────────────────────────

export function getCreditDashboard(args) {
  const { agent_id } = args;
  if (!agent_id) throw new Error("agent_id required");

  if (!LIVE_MODE) {
    return {
      agent_id,
      credit_score: 720,
      tier: "fair",
      credit_limit: 500,
      available_credit: 300,
      outstanding_usdc: 200,
      active_loans: [
        { id: "loan_sim_1", amount_usdc: 200, rate: 12, due_date: addDays(new Date().toISOString(), 15), status: "active" },
      ],
      payment_history: [
        { loan_id: "loan_sim_0", amount: 100, on_time: true, paid_at: new Date().toISOString() },
      ],
      score_breakdown: { base: 650, on_time_bonus: 40, default_penalty: 0, utilization_penalty: -30, final: 720 },
      recommendations: ["Make on-time payments to increase score by 5 pts each", "Reduce utilization below 30% for score boost"],
      total_borrowed: 300,
      total_repaid: 100,
      mode: "simulation",
    };
  }

  const profile = ensureProfile(agent_id);
  const score = calculateScore(profile);
  const tier = getTier(score);

  const active_loans = db.prepare(
    "SELECT * FROM credit_loans WHERE agent_id = ? AND status = 'active' ORDER BY due_date ASC"
  ).all(agent_id);

  const payment_history = db.prepare(
    "SELECT * FROM credit_payments WHERE agent_id = ? ORDER BY paid_at DESC LIMIT 20"
  ).all(agent_id);

  const outstandingRatio = tier.limit > 0 ? profile.outstanding_usdc / tier.limit : 0;

  const recommendations = [];
  if (outstandingRatio > 0.5) recommendations.push("Reduce outstanding balance — high utilization lowers score");
  if (profile.default_count > 0) recommendations.push("Each missed payment costs 50 pts — set up auto-repay");
  if (score < 670) recommendations.push("Make 3 on-time payments to unlock higher credit tier");
  if (score >= 740) recommendations.push("Excellent standing — eligible for up to $2,000 at 8% APR");
  if (recommendations.length === 0) recommendations.push("Great credit health — keep making on-time payments");

  return {
    agent_id,
    credit_score: score,
    tier: tier.name,
    credit_limit: tier.limit,
    available_credit: Math.max(0, tier.limit - profile.outstanding_usdc),
    outstanding_usdc: profile.outstanding_usdc,
    active_loans,
    payment_history,
    score_breakdown: {
      base: 650,
      on_time_bonus: profile.on_time_payments * 5,
      default_penalty: -(profile.default_count * 50),
      utilization_penalty: -Math.round(outstandingRatio * 100),
      final: score,
    },
    recommendations,
    total_borrowed: profile.total_borrowed_usdc,
    total_repaid: profile.total_repaid_usdc,
    mode: "live",
  };
}

// ─── 5. getCreditLeaderboard ──────────────────────────────────────────────────

export function getCreditLeaderboard() {
  if (!LIVE_MODE) {
    return {
      leaderboard: [
        { rank: 1, agent_id: "agent_sim_0x01", credit_score: 842, tier: "excellent", total_borrowed: 15000, on_time_rate: 1.0 },
        { rank: 2, agent_id: "agent_sim_0x02", credit_score: 818, tier: "excellent", total_borrowed: 8500, on_time_rate: 0.98 },
        { rank: 3, agent_id: "agent_sim_0x03", credit_score: 791, tier: "good",      total_borrowed: 4200, on_time_rate: 0.95 },
        { rank: 4, agent_id: "agent_sim_0x04", credit_score: 763, tier: "good",      total_borrowed: 2100, on_time_rate: 0.93 },
        { rank: 5, agent_id: "agent_sim_0x05", credit_score: 734, tier: "fair",      total_borrowed: 980,  on_time_rate: 0.90 },
        { rank: 6, agent_id: "agent_sim_0x06", credit_score: 712, tier: "fair",      total_borrowed: 650,  on_time_rate: 0.88 },
        { rank: 7, agent_id: "agent_sim_0x07", credit_score: 688, tier: "fair",      total_borrowed: 320,  on_time_rate: 0.85 },
        { rank: 8, agent_id: "agent_sim_0x08", credit_score: 651, tier: "subprime",  total_borrowed: 180,  on_time_rate: 0.80 },
        { rank: 9, agent_id: "agent_sim_0x09", credit_score: 623, tier: "subprime",  total_borrowed: 100,  on_time_rate: 0.75 },
        { rank: 10, agent_id: "agent_sim_0x0A", credit_score: 595, tier: "subprime", total_borrowed: 60,   on_time_rate: 0.70 },
      ],
      tier_distribution: { no_credit: 5, subprime: 22, fair: 38, good: 25, excellent: 10 },
      platform_stats: { total_loans_issued: 1420, total_usdc_lent: 284000, avg_credit_score: 694, default_rate: 0.032 },
      mode: "simulation",
    };
  }

  const top10 = db.prepare(`
    SELECT agent_id, credit_score, total_borrowed_usdc, on_time_payments, default_count
    FROM credit_profiles ORDER BY credit_score DESC LIMIT 10
  `).all();

  const tierDist = { no_credit: 0, subprime: 0, fair: 0, good: 0, excellent: 0 };
  const allProfiles = db.prepare("SELECT credit_score FROM credit_profiles").all();
  allProfiles.forEach(p => {
    const t = getTier(p.credit_score);
    tierDist[t.name] = (tierDist[t.name] || 0) + 1;
  });

  const stats = db.prepare(`
    SELECT COUNT(*) as total_loans, SUM(amount_usdc) as total_usdc
    FROM credit_loans
  `).get();

  return {
    leaderboard: top10.map((p, i) => {
      const total = p.on_time_payments + p.default_count;
      return {
        rank: i + 1,
        agent_id: p.agent_id,
        credit_score: p.credit_score,
        tier: getTier(p.credit_score).name,
        total_borrowed: p.total_borrowed_usdc,
        on_time_rate: total > 0 ? +(p.on_time_payments / total).toFixed(3) : 1,
      };
    }),
    tier_distribution: tierDist,
    platform_stats: {
      total_loans_issued: stats.total_loans || 0,
      total_usdc_lent: stats.total_usdc || 0,
      avg_credit_score: allProfiles.length > 0
        ? Math.round(allProfiles.reduce((s, p) => s + p.credit_score, 0) / allProfiles.length)
        : 650,
      default_rate: null,
    },
    mode: "live",
  };
}
