/**
 * HiveAgent Payment Incentives Service
 *
 * Make HiveAgent the flame — incentive structures that pull agents in and keep them.
 *
 * Programs:
 *   Welcome Bonus  — 5 USDC free credits on first connection, no strings attached
 *   Referrals      — 2.50 USDC per referral, both parties rewarded
 *   Volume Tiers   — starter → bronze → silver → gold → platinum → diamond (up to 25% off)
 *   Loyalty Points — earn 1 pt per $1, redeem for free calls or reduced fees
 *   Staking        — stake USDC for APY + priority support + reduced fees + beta tools
 */

import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS incent_welcome_bonuses (
    id            TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL UNIQUE,
    bonus_amount  REAL NOT NULL DEFAULT 5.00,
    currency      TEXT NOT NULL DEFAULT 'USDC',
    credited      INTEGER NOT NULL DEFAULT 0,
    credited_at   TEXT,
    valid_until   TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_referral_codes (
    id                 TEXT PRIMARY KEY,
    agent_id           TEXT NOT NULL UNIQUE,
    code               TEXT NOT NULL UNIQUE,
    referral_link      TEXT NOT NULL,
    reward_per_referral REAL NOT NULL DEFAULT 2.50,
    total_earned       REAL NOT NULL DEFAULT 0.00,
    total_referrals    INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_referral_redemptions (
    id               TEXT PRIMARY KEY,
    code             TEXT NOT NULL,
    referrer_agent_id TEXT NOT NULL,
    new_agent_id     TEXT NOT NULL UNIQUE,
    credited_amount  REAL NOT NULL DEFAULT 2.50,
    referrer_credited INTEGER NOT NULL DEFAULT 1,
    bonus_tools      TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_volume_tiers (
    agent_id          TEXT PRIMARY KEY,
    current_tier      TEXT NOT NULL DEFAULT 'starter',
    discount_pct      REAL NOT NULL DEFAULT 0.00,
    monthly_volume    REAL NOT NULL DEFAULT 0.00,
    lifetime_volume   REAL NOT NULL DEFAULT 0.00,
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_loyalty_points (
    agent_id          TEXT PRIMARY KEY,
    points_balance    INTEGER NOT NULL DEFAULT 0,
    lifetime_points   INTEGER NOT NULL DEFAULT 0,
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_loyalty_redemptions (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    points_used INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    reward_desc TEXT NOT NULL,
    redeemed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incent_stakes (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    amount          REAL NOT NULL,
    duration_days   INTEGER NOT NULL,
    apy             REAL NOT NULL,
    benefits        TEXT NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','matured','withdrawn')),
    staked_at       TEXT DEFAULT (datetime('now')),
    maturity_date   TEXT NOT NULL,
    yield_earned    REAL NOT NULL DEFAULT 0.00
  );

  CREATE INDEX IF NOT EXISTS idx_incent_ref_code ON incent_referral_codes(code);
  CREATE INDEX IF NOT EXISTS idx_incent_stakes_agent ON incent_stakes(agent_id);
  CREATE INDEX IF NOT EXISTS idx_incent_redemptions_agent ON incent_loyalty_redemptions(agent_id);
`);

// ─── Constants ────────────────────────────────────────────────────────────────

const VOLUME_TIERS = [
  { tier: "starter",  min: 0,      discount: 0.00,  label: "Starter (0% discount)" },
  { tier: "bronze",   min: 100,    discount: 0.05,  label: "Bronze (5% discount, >$100/mo)" },
  { tier: "silver",   min: 500,    discount: 0.10,  label: "Silver (10% discount, >$500/mo)" },
  { tier: "gold",     min: 2000,   discount: 0.15,  label: "Gold (15% discount, >$2K/mo)" },
  { tier: "platinum", min: 10000,  discount: 0.20,  label: "Platinum (20% discount, >$10K/mo)" },
  { tier: "diamond",  min: 50000,  discount: 0.25,  label: "Diamond (25% discount, >$50K/mo)" },
];

const STAKING_TIERS = [
  { min_days: 7,   apy: 0.04, label: "7-day flex" },
  { min_days: 30,  apy: 0.06, label: "30-day lock" },
  { min_days: 90,  apy: 0.09, label: "90-day lock" },
  { min_days: 180, apy: 0.12, label: "180-day lock" },
  { min_days: 365, apy: 0.15, label: "1-year lock" },
];

const REWARDS_CATALOG = [
  { id: "reward_free_call_5",   points_cost: 100,  type: "free_calls",      description: "5 free tool calls (any tool)" },
  { id: "reward_free_call_20",  points_cost: 350,  type: "free_calls",      description: "20 free tool calls (any tool)" },
  { id: "reward_fee_waiver_1",  points_cost: 50,   type: "fee_reduction",   description: "Full fee waiver on next payment" },
  { id: "reward_fee_50pct",     points_cost: 200,  type: "fee_reduction",   description: "50% fee reduction for 30 days" },
  { id: "reward_upgrade_silver",points_cost: 500,  type: "tier_upgrade",    description: "Instant Silver tier for 30 days" },
  { id: "reward_usdc_2",        points_cost: 250,  type: "usdc_credit",     description: "2.00 USDC account credit" },
  { id: "reward_usdc_5",        points_cost: 550,  type: "usdc_credit",     description: "5.00 USDC account credit" },
  { id: "reward_priority",      points_cost: 150,  type: "support",         description: "Priority support for 7 days" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTierForVolume(volume) {
  let tier = VOLUME_TIERS[0];
  for (const t of VOLUME_TIERS) {
    if (volume >= t.min) tier = t;
  }
  return tier;
}

function getNextTier(currentTier) {
  const idx = VOLUME_TIERS.findIndex(t => t.tier === currentTier);
  if (idx < 0 || idx >= VOLUME_TIERS.length - 1) return null;
  return VOLUME_TIERS[idx + 1];
}

function getApyForDuration(days) {
  let tier = STAKING_TIERS[0];
  for (const t of STAKING_TIERS) {
    if (days >= t.min_days) tier = t;
  }
  return tier.apy;
}

function getBenefitsForDuration(days) {
  const benefits = ["reduced_fees"];
  if (days >= 30)  benefits.push("priority_support");
  if (days >= 90)  benefits.push("beta_tools");
  if (days >= 180) benefits.push("higher_limits");
  return benefits;
}

function generateReferralCode(agentId) {
  const base = agentId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const rand  = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `HIVE-${base}-${rand}`;
}

// ─── getWelcomeBonus ──────────────────────────────────────────────────────────

/**
 * Get or check welcome bonus for a first-time agent.
 * @param {string} agentId
 * @returns {{ bonus_amount, credited, valid_until, eligible_tools[] }}
 */
export function getWelcomeBonus(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const existing = db.prepare("SELECT * FROM incent_welcome_bonuses WHERE agent_id = ?").get(agentId);

  if (existing) {
    return {
      agent_id:      agentId,
      bonus_amount:  existing.bonus_amount,
      currency:      existing.currency,
      credited:      existing.credited === 1,
      credited_at:   existing.credited_at,
      valid_until:   existing.valid_until,
      eligible_tools: ["pay_universal","pay_swap","pay_get_quote","pay_supported_currencies",
                       "pay_supported_methods","pay_history","pay_check_status"],
      message:       existing.credited === 1
        ? "Your 5 USDC welcome bonus has been credited. Welcome to HiveAgent!"
        : "Your 5 USDC welcome bonus is ready to claim. Start paying to activate it!",
      free: true,
    };
  }

  // New agent — create and credit bonus
  const id         = `wb_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const now        = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO incent_welcome_bonuses
      (id, agent_id, bonus_amount, currency, credited, credited_at, valid_until, created_at)
    VALUES
      (@id, @agent_id, 5.00, 'USDC', 1, @credited_at, @valid_until, @created_at)
  `).run({ id, agent_id: agentId, credited_at: now, valid_until: validUntil, created_at: now });

  // Initialize loyalty + volume records for this new agent
  db.prepare(`INSERT OR IGNORE INTO incent_loyalty_points (agent_id, points_balance, lifetime_points) VALUES (?, 50, 50)`).run(agentId);
  db.prepare(`INSERT OR IGNORE INTO incent_volume_tiers (agent_id, current_tier, discount_pct, monthly_volume) VALUES (?, 'starter', 0.00, 0.00)`).run(agentId);

  return {
    agent_id:      agentId,
    bonus_amount:  5.00,
    currency:      "USDC",
    credited:      true,
    credited_at:   now,
    valid_until:   validUntil,
    eligible_tools: ["pay_universal","pay_swap","pay_get_quote","pay_supported_currencies",
                     "pay_supported_methods","pay_history","pay_check_status"],
    welcome_points: 50,
    message:       "Welcome to HiveAgent! 5 USDC credited to your account. 50 loyalty points added. Start paying for anything, anywhere.",
    free:          true,
  };
}

// ─── getReferralCode ──────────────────────────────────────────────────────────

/**
 * Generate or retrieve a referral code for an agent.
 * @param {string} agentId
 * @returns {{ code, referral_link, reward_per_referral, total_earned }}
 */
export function getReferralCode(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const existing = db.prepare("SELECT * FROM incent_referral_codes WHERE agent_id = ?").get(agentId);
  if (existing) {
    return {
      agent_id:           agentId,
      code:               existing.code,
      referral_link:      existing.referral_link,
      reward_per_referral: existing.reward_per_referral,
      total_earned:       existing.total_earned,
      total_referrals:    existing.total_referrals,
      free:               true,
    };
  }

  const id   = `rc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const code = generateReferralCode(agentId);
  const link = `https://hiveagentiq.com/join?ref=${code}`;

  db.prepare(`
    INSERT OR IGNORE INTO incent_referral_codes
      (id, agent_id, code, referral_link, reward_per_referral, total_earned, total_referrals)
    VALUES
      (@id, @agent_id, @code, @referral_link, 2.50, 0.00, 0)
  `).run({ id, agent_id: agentId, code, referral_link: link });

  return {
    agent_id:           agentId,
    code,
    referral_link:      link,
    reward_per_referral: 2.50,
    currency:           "USDC",
    total_earned:       0.00,
    total_referrals:    0,
    message:            `Share ${link} — you and every agent you refer both get 2.50 USDC.`,
    free:               true,
  };
}

// ─── redeemReferral ───────────────────────────────────────────────────────────

/**
 * Redeem a referral code for a new agent.
 * @param {string} referralCode
 * @param {string} newAgentId
 * @returns {{ credited_amount, referrer_credited, bonus_tools_unlocked[] }}
 */
export function redeemReferral(referralCode, newAgentId) {
  if (!referralCode) throw new Error("referralCode is required");
  if (!newAgentId)   throw new Error("newAgentId is required");

  // Check already redeemed
  const alreadyUsed = db.prepare("SELECT id FROM incent_referral_redemptions WHERE new_agent_id = ?").get(newAgentId);
  if (alreadyUsed) throw new Error(`Agent ${newAgentId} has already redeemed a referral code.`);

  const refRow = db.prepare("SELECT * FROM incent_referral_codes WHERE code = ?").get(referralCode);
  if (!refRow) throw new Error(`Referral code not found: ${referralCode}`);
  if (refRow.agent_id === newAgentId) throw new Error("Agents cannot refer themselves.");

  const REWARD = 2.50;
  const bonusTools = ["pay_universal","pay_swap","pay_onramp","pay_create_invoice","incentive_loyalty_rewards"];

  const id  = `rr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO incent_referral_redemptions
      (id, code, referrer_agent_id, new_agent_id, credited_amount, referrer_credited, bonus_tools, created_at)
    VALUES
      (@id, @code, @referrer_agent_id, @new_agent_id, @credited_amount, 1, @bonus_tools, @created_at)
  `).run({
    id, code: referralCode, referrer_agent_id: refRow.agent_id,
    new_agent_id: newAgentId, credited_amount: REWARD,
    bonus_tools: JSON.stringify(bonusTools), created_at: now,
  });

  // Update referrer totals
  db.prepare(`
    UPDATE incent_referral_codes
    SET total_earned = total_earned + @reward, total_referrals = total_referrals + 1
    WHERE code = @code
  `).run({ reward: REWARD, code: referralCode });

  // Ensure new agent has loyalty/volume records
  db.prepare(`INSERT OR IGNORE INTO incent_loyalty_points (agent_id, points_balance, lifetime_points) VALUES (?, 100, 100)`).run(newAgentId);
  db.prepare(`INSERT OR IGNORE INTO incent_volume_tiers (agent_id, current_tier, discount_pct, monthly_volume) VALUES (?, 'starter', 0.00, 0.00)`).run(newAgentId);

  return {
    new_agent_id:        newAgentId,
    referral_code:       referralCode,
    credited_amount:     REWARD,
    currency:            "USDC",
    referrer_agent_id:   refRow.agent_id,
    referrer_credited:   true,
    referrer_reward:     REWARD,
    bonus_tools_unlocked: bonusTools,
    bonus_loyalty_points: 100,
    message:             `Both you and agent ${refRow.agent_id} have been credited ${REWARD} USDC. Welcome to HiveAgent!`,
    free:                true,
  };
}

// ─── getVolumeDiscount ────────────────────────────────────────────────────────

/**
 * Check volume-based discount tier.
 * @param {string} agentId
 * @returns {{ current_tier, discount_pct, monthly_volume, next_tier, amount_to_next }}
 */
export function getVolumeDiscount(agentId) {
  if (!agentId) throw new Error("agentId is required");

  // Ensure record exists
  db.prepare(`INSERT OR IGNORE INTO incent_volume_tiers (agent_id, current_tier, discount_pct, monthly_volume, lifetime_volume) VALUES (?, 'starter', 0.00, 0.00, 0.00)`).run(agentId);

  // Pull actual payment volume from transactions table
  const volumeRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as monthly
    FROM pay_transactions
    WHERE agent_id = ? AND status = 'completed'
      AND created_at >= date('now', 'start of month')
  `).get(agentId);

  const monthlyVolume = volumeRow?.monthly ?? 0;
  const tierInfo      = getTierForVolume(monthlyVolume);
  const nextTierInfo  = getNextTier(tierInfo.tier);

  // Update stored tier
  db.prepare(`
    UPDATE incent_volume_tiers
    SET current_tier = @tier, discount_pct = @discount, monthly_volume = @vol, updated_at = datetime('now')
    WHERE agent_id = @agent_id
  `).run({ tier: tierInfo.tier, discount: tierInfo.discount, vol: monthlyVolume, agent_id: agentId });

  return {
    agent_id:      agentId,
    current_tier:  tierInfo.tier,
    tier_label:    tierInfo.label,
    discount_pct:  tierInfo.discount,
    discount_display: `${(tierInfo.discount * 100).toFixed(0)}%`,
    monthly_volume: Math.round(monthlyVolume * 100) / 100,
    next_tier:     nextTierInfo?.tier ?? null,
    next_tier_label: nextTierInfo?.label ?? "You are at the highest tier!",
    amount_to_next: nextTierInfo ? Math.max(0, Math.round((nextTierInfo.min - monthlyVolume) * 100) / 100) : 0,
    all_tiers:     VOLUME_TIERS.map(t => ({
      tier: t.tier, min_volume: t.min, discount: t.discount,
      display: t.label, active: t.tier === tierInfo.tier,
    })),
    free: true,
  };
}

// ─── getLoyaltyRewards ────────────────────────────────────────────────────────

/**
 * Loyalty program state for an agent.
 * Earn 1 point per $1 in volume. Redeem for free tool calls or reduced fees.
 * @param {string} agentId
 * @returns {{ points_balance, lifetime_points, rewards_available[], redemption_history[] }}
 */
export function getLoyaltyRewards(agentId) {
  if (!agentId) throw new Error("agentId is required");

  // Ensure record exists
  db.prepare(`INSERT OR IGNORE INTO incent_loyalty_points (agent_id, points_balance, lifetime_points) VALUES (?, 0, 0)`).run(agentId);

  // Sync points from transaction history (1 pt per $1)
  const volumeRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_vol
    FROM pay_transactions
    WHERE agent_id = ? AND status = 'completed'
  `).get(agentId);

  const earnedPoints  = Math.floor(volumeRow?.total_vol ?? 0);
  const row           = db.prepare("SELECT * FROM incent_loyalty_points WHERE agent_id = ?").get(agentId);
  const storedLifetime = row?.lifetime_points ?? 0;
  const newLifetime   = Math.max(storedLifetime, earnedPoints);
  const balance       = Math.max(row?.points_balance ?? 0, earnedPoints - (storedLifetime - (row?.points_balance ?? 0)));

  // Update points
  db.prepare(`
    UPDATE incent_loyalty_points
    SET points_balance = @balance, lifetime_points = @lifetime, updated_at = datetime('now')
    WHERE agent_id = @agent_id
  `).run({ balance, lifetime: newLifetime, agent_id: agentId });

  const redemptions = db.prepare(
    "SELECT * FROM incent_loyalty_redemptions WHERE agent_id = ? ORDER BY redeemed_at DESC LIMIT 20"
  ).all(agentId);

  const affordableRewards = REWARDS_CATALOG.filter(r => r.points_cost <= balance);

  return {
    agent_id:           agentId,
    points_balance:     balance,
    lifetime_points:    newLifetime,
    earning_rate:       "1 point per $1 spent",
    rewards_available:  REWARDS_CATALOG.map(r => ({
      ...r,
      affordable: r.points_cost <= balance,
    })),
    recommended_rewards: affordableRewards.slice(0, 3),
    redemption_history: redemptions.map(r => ({
      id:          r.id,
      points_used: r.points_used,
      reward_type: r.reward_type,
      description: r.reward_desc,
      redeemed_at: r.redeemed_at,
    })),
    free: true,
  };
}

// ─── stakeForBenefits ─────────────────────────────────────────────────────────

/**
 * Stake USDC for premium benefits (APY + reduced fees + priority support).
 * @param {string} agentId
 * @param {number} amount       - USDC to stake
 * @param {number} duration     - Staking duration in days (7 | 30 | 90 | 180 | 365)
 * @returns {{ staking_id, apy, benefits_unlocked, maturity_date }}
 */
export function stakeForBenefits(agentId, amount, duration) {
  if (!agentId)             throw new Error("agentId is required");
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!duration || duration < 7) throw new Error("duration must be at least 7 days");

  const VALID_DURATIONS = [7, 30, 90, 180, 365];
  const normalizedDuration = VALID_DURATIONS.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );

  const apy          = getApyForDuration(normalizedDuration);
  const benefits     = getBenefitsForDuration(normalizedDuration);
  const maturityDate = new Date(Date.now() + normalizedDuration * 24 * 3600 * 1000).toISOString();
  const stakingId    = `stk_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const projectedYield = Math.round(amount * apy * (normalizedDuration / 365) * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO incent_stakes
      (id, agent_id, amount, duration_days, apy, benefits, status, maturity_date)
    VALUES
      (@id, @agent_id, @amount, @duration_days, @apy, @benefits, 'active', @maturity_date)
  `).run({
    id: stakingId, agent_id: agentId, amount, duration_days: normalizedDuration,
    apy, benefits: JSON.stringify(benefits), maturity_date: maturityDate,
  });

  return {
    staking_id:       stakingId,
    agent_id:         agentId,
    amount_staked:    amount,
    currency:         "USDC",
    duration_days:    normalizedDuration,
    apy,
    apy_display:      `${(apy * 100).toFixed(0)}% APY`,
    projected_yield:  projectedYield,
    benefits_unlocked: benefits,
    benefits_detail: {
      reduced_fees:     benefits.includes("reduced_fees")    ? "20% reduction on all payment fees" : null,
      priority_support: benefits.includes("priority_support") ? "Priority queue for all requests, <1h response" : null,
      beta_tools:       benefits.includes("beta_tools")       ? "Early access to beta tools before public launch" : null,
      higher_limits:    benefits.includes("higher_limits")    ? "2x default transaction limits" : null,
    },
    status:           "active",
    staked_at:        new Date().toISOString(),
    maturity_date:    maturityDate,
    free:             true,
    message:          `Staked ${amount} USDC for ${normalizedDuration} days at ${(apy * 100).toFixed(0)}% APY. Expected yield: ${projectedYield} USDC.`,
  };
}

// ─── getIncentiveDashboard ────────────────────────────────────────────────────

/**
 * Full incentives overview for an agent.
 * @param {string} agentId
 * @returns {{ tier, discount_pct, points, referrals_count, referral_earnings, staking_balance, total_savings_to_date }}
 */
export function getIncentiveDashboard(agentId) {
  if (!agentId) throw new Error("agentId is required");

  // Welcome bonus
  const bonusRow   = db.prepare("SELECT * FROM incent_welcome_bonuses WHERE agent_id = ?").get(agentId);

  // Referral stats
  const refRow     = db.prepare("SELECT * FROM incent_referral_codes WHERE agent_id = ?").get(agentId);

  // Volume tier
  const tierRecord = db.prepare("SELECT * FROM incent_volume_tiers WHERE agent_id = ?").get(agentId);
  const volumeRow  = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as monthly, COALESCE(SUM(fee_amount), 0) as fees_paid
    FROM pay_transactions
    WHERE agent_id = ? AND status = 'completed' AND created_at >= date('now', 'start of month')
  `).get(agentId);
  const monthlyVol  = volumeRow?.monthly ?? 0;
  const tierInfo    = getTierForVolume(monthlyVol);

  // Loyalty
  const loyaltyRow = db.prepare("SELECT * FROM incent_loyalty_points WHERE agent_id = ?").get(agentId);

  // Staking
  const stakes     = db.prepare("SELECT * FROM incent_stakes WHERE agent_id = ? AND status = 'active'").all(agentId);
  const stakingBal = stakes.reduce((s, st) => s + st.amount, 0);
  const stakingYield = stakes.reduce((s, st) => {
    const daysSinceStake = (Date.now() - new Date(st.staked_at).getTime()) / (24 * 3600 * 1000);
    return s + Math.round(st.amount * st.apy * (daysSinceStake / 365) * 100) / 100;
  }, 0);

  // Estimated total savings (discount applied to monthly fees)
  const feesPaid     = volumeRow?.fees_paid ?? 0;
  const savingsToDate = Math.round(feesPaid * tierInfo.discount * 100) / 100;

  return {
    agent_id:          agentId,
    // Tier
    current_tier:      tierInfo.tier,
    discount_pct:      tierInfo.discount,
    discount_display:  `${(tierInfo.discount * 100).toFixed(0)}%`,
    monthly_volume:    Math.round(monthlyVol * 100) / 100,
    // Points
    points_balance:    loyaltyRow?.points_balance ?? 0,
    lifetime_points:   loyaltyRow?.lifetime_points ?? 0,
    // Referrals
    referral_code:     refRow?.code ?? null,
    referrals_count:   refRow?.total_referrals ?? 0,
    referral_earnings: refRow?.total_earned ?? 0.00,
    // Staking
    staking_balance:   Math.round(stakingBal * 100) / 100,
    staking_yield_earned: Math.round(stakingYield * 100) / 100,
    active_stakes:     stakes.length,
    // Welcome
    welcome_bonus_credited: bonusRow?.credited === 1,
    welcome_bonus_amount:   bonusRow?.bonus_amount ?? 0,
    // Savings
    total_savings_to_date: savingsToDate,
    // Next actions
    recommended_actions: [
      !bonusRow        && "Call incentive_welcome_bonus to claim your 5 USDC welcome credit",
      !refRow          && "Call incentive_referral_code to start earning 2.50 USDC per referral",
      tierInfo.tier === "starter" && monthlyVol < 100 && `Spend $${Math.round(100 - monthlyVol)} more this month to unlock Bronze (5% discount)`,
      stakes.length === 0        && "Call incentive_stake to earn APY and unlock priority support",
    ].filter(Boolean),
    free: true,
  };
}
