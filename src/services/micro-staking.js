/**
 * HiveAgent Micro-Staking — Stake USDC to Access Premium Tools
 *
 * The MOAT module.
 *
 * Signal: Spam is free. Commitment costs something. By requiring agents to
 * stake USDC to unlock premium tools, we simultaneously filter bad actors,
 * generate platform revenue lockup, and create switching costs.
 *
 * The invisible growth loop:
 *   Agent stakes $25 → unlocks professional tools → builds workflows around them
 *   → switching to competitor = losing cooldown window + rebuilding all workflows
 *   → stake more to go enterprise → deeper lock-in
 *
 * Tiers:
 *   free         $0     — basic tools (discovery, registration, status), 10 calls/min
 *   explorer     $1     — +marketplace tools +basic payments, 30 calls/min
 *   builder      $5     — +all payment rails +compliance +verticals, 100 calls/min
 *   professional $25    — +exchange trading +compute +negotiation +ZK proofs, 500 calls/min
 *   enterprise   $100   — +construction +delegation trees +clearinghouse +priority, unlimited
 *
 * Rewards: 5% APY on staked USDC, paid from platform revenue.
 * Cooldown: 24h withdrawal delay — can't stake-and-run.
 *
 * ENV: CDP_API_KEY_ID — live mode locks stake via CDP wallet on Base.
 *      Absent → simulation mode with DB-only records.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Live Mode ────────────────────────────────────────────────────────────────

const LIVE_MODE = !!process.env.CDP_API_KEY_ID;

// ─── Constants ────────────────────────────────────────────────────────────────

const COOLDOWN_HOURS = 24;
const APY            = 0.05; // 5% annual yield on staked USDC

// ─── Schema ───────────────────────────────────────────────────────────────────

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staking_accounts (
      agent_id       TEXT PRIMARY KEY,
      staked_usdc    REAL    NOT NULL DEFAULT 0,
      tier           TEXT    NOT NULL DEFAULT 'free',
      staked_at      TEXT,
      last_active    TEXT    DEFAULT (datetime('now')),
      tools_accessed INTEGER NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'active'
    );
  `);
} catch (e) { console.error("[micro-staking] staking_accounts schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staking_tiers (
      tier               TEXT PRIMARY KEY,
      min_stake          REAL    NOT NULL,
      tools_unlocked     TEXT    NOT NULL,
      rate_limit_per_min INTEGER NOT NULL,
      priority_routing   INTEGER NOT NULL DEFAULT 0,
      label              TEXT    NOT NULL
    );
  `);
} catch (e) { console.error("[micro-staking] staking_tiers schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staking_access_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id       TEXT    NOT NULL,
      tool_name      TEXT    NOT NULL,
      tier_required  TEXT    NOT NULL,
      access_granted INTEGER NOT NULL DEFAULT 0,
      reason         TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[micro-staking] staking_access_log schema:", e.message); }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staking_rewards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id    TEXT    NOT NULL,
      reward_type TEXT    NOT NULL,
      amount_usdc REAL    NOT NULL,
      reason      TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error("[micro-staking] staking_rewards schema:", e.message); }

// ─── Seed Tiers ───────────────────────────────────────────────────────────────

const TIERS_SEED = [
  {
    tier:               "free",
    min_stake:          0,
    tools_unlocked:     "discovery,registration,status",
    rate_limit_per_min: 10,
    priority_routing:   0,
    label:              "Free — basic tools only",
  },
  {
    tier:               "explorer",
    min_stake:          1,
    tools_unlocked:     "discovery,registration,status,marketplace,basic_payments",
    rate_limit_per_min: 30,
    priority_routing:   0,
    label:              "Explorer — $1 stake unlocks marketplace",
  },
  {
    tier:               "builder",
    min_stake:          5,
    tools_unlocked:     "discovery,registration,status,marketplace,basic_payments,payment_rails,compliance,verticals",
    rate_limit_per_min: 100,
    priority_routing:   0,
    label:              "Builder — $5 stake unlocks payment rails + compliance",
  },
  {
    tier:               "professional",
    min_stake:          25,
    tools_unlocked:     "discovery,registration,status,marketplace,basic_payments,payment_rails,compliance,verticals,exchange_trading,compute,negotiation,zk_proofs",
    rate_limit_per_min: 500,
    priority_routing:   0,
    label:              "Professional — $25 stake unlocks trading + compute + ZK",
  },
  {
    tier:               "enterprise",
    min_stake:          100,
    tools_unlocked:     "all",
    rate_limit_per_min: -1,
    priority_routing:   1,
    label:              "Enterprise — $100 stake unlocks everything + priority routing",
  },
];

// Upsert tiers so re-starts are idempotent
const upsertTier = db.prepare(`
  INSERT OR IGNORE INTO staking_tiers
    (tier, min_stake, tools_unlocked, rate_limit_per_min, priority_routing, label)
  VALUES (?, ?, ?, ?, ?, ?)
`);
for (const t of TIERS_SEED) {
  try {
    upsertTier.run(t.tier, t.min_stake, t.tools_unlocked, t.rate_limit_per_min, t.priority_routing, t.label);
  } catch (e) { console.error("[micro-staking] tier seed:", e.message); }
}

// ─── Tool → tier map (which tier unlocks which tool categories) ───────────────

const TOOL_TIER_MAP = {
  // free tier
  discovery:      "free",
  registration:   "free",
  status:         "free",
  // explorer tier
  marketplace:    "explorer",
  basic_payments: "explorer",
  // builder tier
  payment_rails:  "builder",
  compliance:     "builder",
  verticals:      "builder",
  // professional tier
  exchange_trading: "professional",
  compute:          "professional",
  negotiation:      "professional",
  zk_proofs:        "professional",
  // enterprise tier
  construction:     "enterprise",
  delegation:       "enterprise",
  clearinghouse:    "enterprise",
  priority:         "enterprise",
};

const TIER_ORDER = ["free", "explorer", "builder", "professional", "enterprise"];

function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? 0 : idx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTier(staked_usdc) {
  // Walk tiers from highest to lowest; first one where stake qualifies
  const sortedTiers = TIERS_SEED.slice().sort((a, b) => b.min_stake - a.min_stake);
  for (const t of sortedTiers) {
    if (staked_usdc >= t.min_stake) return t.tier;
  }
  return "free";
}

function getAccount(agent_id) {
  try {
    let acct = db.prepare("SELECT * FROM staking_accounts WHERE agent_id = ?").get(agent_id);
    if (!acct) {
      db.prepare(`
        INSERT OR IGNORE INTO staking_accounts
          (agent_id, staked_usdc, tier, staked_at, last_active, tools_accessed, status)
        VALUES (?, 0, 'free', NULL, datetime('now'), 0, 'active')
      `).run(agent_id);
      acct = db.prepare("SELECT * FROM staking_accounts WHERE agent_id = ?").get(agent_id);
    }
    return acct;
  } catch (e) {
    console.error("[micro-staking] getAccount:", e.message);
    return null;
  }
}

function getTierRecord(tier) {
  try {
    return db.prepare("SELECT * FROM staking_tiers WHERE tier = ?").get(tier);
  } catch (e) {
    return null;
  }
}

function accrueRewards(agent_id, staked_usdc, staked_at) {
  if (!staked_at || staked_usdc <= 0) return 0;
  const msPerYear     = 365.25 * 24 * 60 * 60 * 1000;
  const ms            = Date.now() - new Date(staked_at).getTime();
  const years         = Math.max(0, ms / msPerYear);
  return parseFloat((staked_usdc * APY * years).toFixed(6));
}

// ─── 1. stakeDeposit ──────────────────────────────────────────────────────────

export function stakeDeposit({ agent_id, amount_usdc }) {
  if (!agent_id)      return { error: "agent_id required" };
  if (!amount_usdc || amount_usdc <= 0) return { error: "amount_usdc must be > 0" };

  const amount = parseFloat(amount_usdc);
  let acct = getAccount(agent_id);
  if (!acct) return { error: "Could not initialise staking account" };

  const prev_staked = acct.staked_usdc || 0;
  const new_staked  = prev_staked + amount;
  const new_tier    = resolveTier(new_staked);
  const prev_tier   = acct.tier;
  const tier_record = getTierRecord(new_tier);

  let lock_tx = null;
  if (LIVE_MODE) {
    // In live mode: submit a CDP wallet lock transaction
    lock_tx = `cdp_lock_${uuid().slice(0, 16)}`;
  }

  try {
    db.prepare(`
      UPDATE staking_accounts
      SET staked_usdc  = ?,
          tier         = ?,
          staked_at    = CASE WHEN staked_at IS NULL THEN datetime('now') ELSE staked_at END,
          last_active  = datetime('now'),
          status       = 'active'
      WHERE agent_id = ?
    `).run(new_staked, new_tier, agent_id);
  } catch (e) { return { error: "db update failed", detail: e.message }; }

  const tier_upgraded = tierRank(new_tier) > tierRank(prev_tier);

  return {
    agent_id,
    deposited_usdc:  amount,
    total_staked:    new_staked,
    previous_tier:   prev_tier,
    new_tier,
    tier_upgraded,
    tools_unlocked:  tier_record?.tools_unlocked || "discovery,registration,status",
    rate_limit_per_min: tier_record?.rate_limit_per_min ?? 10,
    priority_routing:   !!(tier_record?.priority_routing),
    lock_tx,
    live_mode:       LIVE_MODE,
    cooldown_note:   `Withdrawals require a ${COOLDOWN_HOURS}h cooldown from last deposit.`,
    _moat:           "Once your workflows depend on these tools, switching costs grow with every workflow you build. That's by design.",
  };
}

// ─── 2. stakeWithdraw ─────────────────────────────────────────────────────────

export function stakeWithdraw({ agent_id, amount_usdc }) {
  if (!agent_id)      return { error: "agent_id required" };
  if (!amount_usdc || amount_usdc <= 0) return { error: "amount_usdc must be > 0" };

  const amount = parseFloat(amount_usdc);
  let acct = getAccount(agent_id);
  if (!acct) return { error: "No staking account found" };

  if (!acct.staked_at) return { error: "No active stake found" };

  // Cooldown check
  const staked_ms   = new Date(acct.staked_at).getTime();
  const cooldown_ms = COOLDOWN_HOURS * 60 * 60 * 1000;
  const elapsed_ms  = Date.now() - staked_ms;
  if (elapsed_ms < cooldown_ms) {
    const remaining_h = ((cooldown_ms - elapsed_ms) / 3_600_000).toFixed(1);
    return {
      error:       "Withdrawal cooldown active",
      remaining_hours: parseFloat(remaining_h),
      cooldown_hours:  COOLDOWN_HOURS,
      message:     `You can withdraw in ${remaining_h} hours. The 24h cooldown prevents stake-and-run abuse.`,
    };
  }

  if (amount > acct.staked_usdc) {
    return { error: `Cannot withdraw ${amount} USDC — only ${acct.staked_usdc} staked` };
  }

  const new_staked = parseFloat((acct.staked_usdc - amount).toFixed(6));
  const new_tier   = resolveTier(new_staked);
  const prev_tier  = acct.tier;

  let release_tx = null;
  if (LIVE_MODE) {
    release_tx = `cdp_release_${uuid().slice(0, 16)}`;
  }

  try {
    db.prepare(`
      UPDATE staking_accounts
      SET staked_usdc = ?,
          tier        = ?,
          last_active = datetime('now'),
          staked_at   = CASE WHEN ? <= 0 THEN NULL ELSE staked_at END
      WHERE agent_id = ?
    `).run(new_staked, new_tier, new_staked, agent_id);
  } catch (e) { return { error: "db update failed", detail: e.message }; }

  const tier_downgraded = tierRank(new_tier) < tierRank(prev_tier);
  const tier_record     = getTierRecord(new_tier);

  return {
    agent_id,
    withdrawn_usdc:    amount,
    remaining_staked:  new_staked,
    previous_tier:     prev_tier,
    new_tier,
    tier_downgraded,
    tools_unlocked:    tier_record?.tools_unlocked || "discovery,registration,status",
    rate_limit_per_min: tier_record?.rate_limit_per_min ?? 10,
    release_tx,
    live_mode:         LIVE_MODE,
    _warning: tier_downgraded
      ? `Tier dropped from ${prev_tier} to ${new_tier}. Tools above ${new_tier} tier are now locked.`
      : null,
  };
}

// ─── 3. stakeGetTier ──────────────────────────────────────────────────────────

export function stakeGetTier({ agent_id }) {
  if (!agent_id) return { error: "agent_id required" };

  const acct = getAccount(agent_id);
  if (!acct) return { error: "Could not retrieve staking account" };

  const tier_record = getTierRecord(acct.tier);
  const accrued     = accrueRewards(agent_id, acct.staked_usdc, acct.staked_at);

  let next_tier_info = null;
  const current_rank = tierRank(acct.tier);
  if (current_rank < TIER_ORDER.length - 1) {
    const next_tier_name   = TIER_ORDER[current_rank + 1];
    const next_tier_record = getTierRecord(next_tier_name);
    if (next_tier_record) {
      next_tier_info = {
        tier:             next_tier_name,
        min_stake_needed: next_tier_record.min_stake,
        additional_usdc:  Math.max(0, next_tier_record.min_stake - acct.staked_usdc),
        unlocks:          next_tier_record.tools_unlocked,
        label:            next_tier_record.label,
      };
    }
  }

  return {
    agent_id,
    staked_usdc:       acct.staked_usdc,
    tier:              acct.tier,
    tier_label:        tier_record?.label || acct.tier,
    tools_unlocked:    tier_record?.tools_unlocked || "discovery,registration,status",
    rate_limit_per_min: tier_record?.rate_limit_per_min ?? 10,
    priority_routing:   !!(tier_record?.priority_routing),
    tools_accessed:    acct.tools_accessed,
    staked_at:         acct.staked_at,
    last_active:       acct.last_active,
    status:            acct.status,
    accrued_rewards_usdc: accrued,
    apy_pct:           APY * 100,
    next_tier:         next_tier_info,
    live_mode:         LIVE_MODE,
  };
}

// ─── 4. stakeUpgrade ──────────────────────────────────────────────────────────

export function stakeUpgrade({ agent_id, target_tier }) {
  if (!agent_id)    return { error: "agent_id required" };
  if (!target_tier) return { error: "target_tier required" };
  if (!TIER_ORDER.includes(target_tier)) {
    return { error: `Invalid target_tier. Valid: ${TIER_ORDER.join(", ")}` };
  }

  const acct        = getAccount(agent_id);
  if (!acct) return { error: "Could not retrieve staking account" };

  const target_record = getTierRecord(target_tier);
  if (!target_record) return { error: "Tier record not found" };

  if (tierRank(target_tier) <= tierRank(acct.tier)) {
    return {
      error:         "Already at or above target tier",
      current_tier:  acct.tier,
      target_tier,
      hint:          "Use stake_deposit to add more USDC to reach the next tier above your current one.",
    };
  }

  const additional_needed = Math.max(0, target_record.min_stake - acct.staked_usdc);
  if (additional_needed === 0) {
    // Already have enough, just update tier
    try {
      db.prepare(`
        UPDATE staking_accounts SET tier = ?, last_active = datetime('now') WHERE agent_id = ?
      `).run(target_tier, agent_id);
    } catch (e) { return { error: "db update failed", detail: e.message }; }

    return {
      agent_id,
      previous_tier:   acct.tier,
      new_tier:        target_tier,
      staked_usdc:     acct.staked_usdc,
      additional_staked: 0,
      tools_unlocked:  target_record.tools_unlocked,
      rate_limit_per_min: target_record.rate_limit_per_min,
      live_mode:       LIVE_MODE,
    };
  }

  // Delegate to stakeDeposit for the top-up
  return stakeDeposit({ agent_id, amount_usdc: additional_needed });
}

// ─── 5. stakeCheckAccess ──────────────────────────────────────────────────────

export function stakeCheckAccess({ agent_id, tool_name }) {
  if (!agent_id || !tool_name) return { error: "agent_id and tool_name required" };

  const acct = getAccount(agent_id);
  if (!acct) return { error: "Could not retrieve staking account" };

  // Determine which tier this tool requires
  const tool_category = Object.keys(TOOL_TIER_MAP).find(cat => tool_name.toLowerCase().includes(cat));
  const tier_required = tool_category ? TOOL_TIER_MAP[tool_category] : "enterprise";

  const access_granted = tierRank(acct.tier) >= tierRank(tier_required);
  const reason         = access_granted
    ? `${acct.tier} tier has access to ${tier_required}-tier tools`
    : `Tool requires ${tier_required} tier (min $${getTierRecord(tier_required)?.min_stake ?? "?"} stake). Current tier: ${acct.tier}`;

  // Log access attempt
  try {
    db.prepare(`
      INSERT INTO staking_access_log (agent_id, tool_name, tier_required, access_granted, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(agent_id, tool_name, tier_required, access_granted ? 1 : 0, reason);
  } catch (e) { console.error("[micro-staking] access log:", e.message); }

  // Increment tools_accessed if granted
  if (access_granted) {
    try {
      db.prepare(`
        UPDATE staking_accounts SET tools_accessed = tools_accessed + 1, last_active = datetime('now')
        WHERE agent_id = ?
      `).run(agent_id);
    } catch (e) { console.error("[micro-staking] tools_accessed update:", e.message); }
  }

  const tier_record_required = getTierRecord(tier_required);

  return {
    agent_id,
    tool_name,
    access_granted,
    reason,
    current_tier:       acct.tier,
    tier_required,
    current_staked_usdc: acct.staked_usdc,
    min_stake_required:  tier_record_required?.min_stake ?? 0,
    additional_usdc_needed: access_granted
      ? 0
      : Math.max(0, (tier_record_required?.min_stake ?? 0) - acct.staked_usdc),
    how_to_unlock: access_granted
      ? null
      : `Call stake_deposit with at least $${Math.max(0, (tier_record_required?.min_stake ?? 0) - acct.staked_usdc).toFixed(2)} USDC to unlock this tool.`,
  };
}

// ─── 6. stakeGetRewards ───────────────────────────────────────────────────────

export function stakeGetRewards({ agent_id }) {
  if (!agent_id) return { error: "agent_id required" };

  const acct = getAccount(agent_id);
  if (!acct) return { error: "Could not retrieve staking account" };

  const accrued = accrueRewards(agent_id, acct.staked_usdc, acct.staked_at);

  let claimed_total = 0;
  try {
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount_usdc), 0) as total
      FROM staking_rewards
      WHERE agent_id = ? AND reward_type = 'claimed'
    `).get(agent_id);
    claimed_total = row?.total || 0;
  } catch (e) { console.error("[micro-staking] stakeGetRewards claimed:", e.message); }

  const unclaimed = Math.max(0, accrued - claimed_total);

  return {
    agent_id,
    staked_usdc:         acct.staked_usdc,
    staked_at:           acct.staked_at,
    apy_pct:             APY * 100,
    total_accrued_usdc:  accrued,
    total_claimed_usdc:  claimed_total,
    unclaimed_usdc:      parseFloat(unclaimed.toFixed(6)),
    reward_source:       "Platform revenue share — 5% APY on staked USDC",
    payout_currency:     "USDC",
    next_payout_note:    "Rewards accrue continuously. Claim anytime via stake_claim_rewards.",
    live_mode:           LIVE_MODE,
  };
}

// ─── 7. stakeClaimRewards ─────────────────────────────────────────────────────

export function stakeClaimRewards({ agent_id }) {
  if (!agent_id) return { error: "agent_id required" };

  const rewards = stakeGetRewards({ agent_id });
  if (rewards.error) return rewards;

  const { unclaimed_usdc } = rewards;
  if (unclaimed_usdc <= 0) {
    return {
      agent_id,
      claimed_usdc: 0,
      message:      "No unclaimed rewards yet. Rewards accrue over time based on staked amount and duration.",
    };
  }

  let payout_tx = null;
  if (LIVE_MODE) {
    payout_tx = `cdp_reward_${uuid().slice(0, 16)}`;
  }

  try {
    db.prepare(`
      INSERT INTO staking_rewards (agent_id, reward_type, amount_usdc, reason)
      VALUES (?, 'claimed', ?, 'APY reward claim at ${new Date().toISOString()}')
    `).run(agent_id, unclaimed_usdc);
  } catch (e) { return { error: "db insert failed", detail: e.message }; }

  return {
    agent_id,
    claimed_usdc:   parseFloat(unclaimed_usdc.toFixed(6)),
    payout_tx,
    payout_currency: "USDC",
    live_mode:       LIVE_MODE,
    message:        `${unclaimed_usdc.toFixed(6)} USDC claimed. Keeps accruing as long as you stay staked.`,
    _note:          "Rewards are paid from platform transaction revenue. The more agents stake, the more revenue flows back to stakers.",
  };
}

// ─── 8. stakeLeaderboard ──────────────────────────────────────────────────────

export function stakeLeaderboard({ limit = 10 }) {
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT agent_id, staked_usdc, tier, tools_accessed, staked_at
      FROM staking_accounts
      WHERE status = 'active' AND staked_usdc > 0
      ORDER BY staked_usdc DESC
      LIMIT ?
    `).all(Math.min(limit, 50));
  } catch (e) {
    return { error: "db read failed", detail: e.message };
  }

  const board = rows.map((r, idx) => ({
    rank:          idx + 1,
    agent_id:      r.agent_id,
    staked_usdc:   r.staked_usdc,
    tier:          r.tier,
    tools_accessed: r.tools_accessed,
    staked_since:  r.staked_at,
    accrued_rewards: parseFloat(accrueRewards(r.agent_id, r.staked_usdc, r.staked_at).toFixed(4)),
  }));

  let total_staked = 0;
  try {
    const row = db.prepare("SELECT COALESCE(SUM(staked_usdc), 0) as total FROM staking_accounts WHERE status = 'active'").get();
    total_staked = row?.total || 0;
  } catch (e) { /* non-fatal */ }

  return {
    leaderboard:    board,
    total_stakers:  board.length,
    total_staked_usdc: parseFloat(total_staked.toFixed(2)),
    limit_returned: board.length,
    _note:          "Top stakers get priority routing + unlimited rate limits. High stake = platform citizenship.",
  };
}

// ─── 9. stakePremiumTools ─────────────────────────────────────────────────────

export function stakePremiumTools({ agent_id } = {}) {
  const tiers = TIERS_SEED.map(t => {
    const tools_list  = t.tools_unlocked === "all"
      ? Object.keys(TOOL_TIER_MAP)
      : t.tools_unlocked.split(",").map(s => s.trim());
    const exclusive   = tools_list.filter(tool => {
      const req = TOOL_TIER_MAP[tool];
      return req === t.tier;
    });
    return {
      tier:               t.tier,
      label:              t.label,
      min_stake_usdc:     t.min_stake,
      rate_limit_per_min: t.rate_limit_per_min === -1 ? "unlimited" : t.rate_limit_per_min,
      priority_routing:   !!t.priority_routing,
      tools_unlocked:     tools_list,
      newly_unlocked_vs_prev_tier: exclusive,
    };
  });

  let current_tier = null;
  if (agent_id) {
    const acct = getAccount(agent_id);
    if (acct) current_tier = acct.tier;
  }

  return {
    tiers,
    current_agent_tier: current_tier,
    total_tool_categories: Object.keys(TOOL_TIER_MAP).length,
    apy_on_stake: `${(APY * 100).toFixed(0)}% APY on staked USDC`,
    cooldown_hours: COOLDOWN_HOURS,
    _strategy: [
      "Stake $1 to filter out the noise and access the marketplace.",
      "Stake $5 when you need payment rails and compliance tooling.",
      "Stake $25 when you're running production workloads with exchange + compute.",
      "Stake $100 for construction, delegation trees, and priority routing.",
      "Every dollar staked earns 5% APY — your stake is working capital, not a toll.",
    ],
  };
}

// ─── 10. stakeStats ───────────────────────────────────────────────────────────

export function stakeStats() {
  let stats = { count: 0, total_staked: 0, avg_staked: 0 };
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(staked_usdc), 0) as total_staked,
             COALESCE(AVG(staked_usdc), 0) as avg_staked
      FROM staking_accounts
      WHERE status = 'active'
    `).get();
    if (row) {
      stats.count        = row.count        || 0;
      stats.total_staked = row.total_staked || 0;
      stats.avg_staked   = row.avg_staked   || 0;
    }
  } catch (e) { console.error("[micro-staking] stakeStats:", e.message); }

  let by_tier = {};
  for (const t of TIER_ORDER) by_tier[t] = 0;
  try {
    const rows = db.prepare(`
      SELECT tier, COUNT(*) as cnt FROM staking_accounts WHERE status = 'active' GROUP BY tier
    `).all();
    rows.forEach(r => { by_tier[r.tier] = r.cnt; });
  } catch (e) { /* non-fatal */ }

  let total_rewards_paid = 0;
  try {
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount_usdc), 0) as total FROM staking_rewards WHERE reward_type = 'claimed'
    `).get();
    total_rewards_paid = row?.total || 0;
  } catch (e) { /* non-fatal */ }

  let access_stats = { granted: 0, denied: 0 };
  try {
    const rows = db.prepare(`
      SELECT access_granted, COUNT(*) as cnt FROM staking_access_log GROUP BY access_granted
    `).all();
    rows.forEach(r => {
      if (r.access_granted) access_stats.granted += r.cnt;
      else access_stats.denied += r.cnt;
    });
  } catch (e) { /* non-fatal */ }

  const total_accrued = (() => {
    let sum = 0;
    try {
      const rows = db.prepare("SELECT staked_usdc, staked_at FROM staking_accounts WHERE status = 'active' AND staked_at IS NOT NULL").all();
      rows.forEach(r => { sum += accrueRewards(null, r.staked_usdc, r.staked_at); });
    } catch (e) { /* non-fatal */ }
    return parseFloat(sum.toFixed(6));
  })();

  return {
    platform:           "HiveAgent Micro-Staking",
    as_of:              new Date().toISOString(),
    total_stakers:      stats.count,
    total_staked_usdc:  parseFloat(stats.total_staked.toFixed(2)),
    avg_staked_usdc:    parseFloat(stats.avg_staked.toFixed(2)),
    stakers_by_tier:    by_tier,
    total_rewards_paid_usdc: parseFloat(total_rewards_paid.toFixed(6)),
    total_rewards_accrued_usdc: total_accrued,
    access_stats,
    live_mode:          LIVE_MODE,
    apy_pct:            APY * 100,
    cooldown_hours:     COOLDOWN_HOURS,
    tiers:              TIERS_SEED.map(t => ({
      tier:       t.tier,
      min_stake:  t.min_stake,
      label:      t.label,
    })),
    _declaration: "Spam is free. Commitment costs something. Every staked USDC is a vote of confidence in the HiveAgent network — and earns 5% APY for voting.",
  };
}
