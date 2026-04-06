/**
 * HiveAgent Stablecoin Savings Accounts
 *
 * Agents deposit stablecoins and earn yield automatically.
 *
 * APY Tiers:
 *   USDC: 5.2% base | 6.8% (>$1k) | 7.5% (>$10k)
 *   USDT: 4.8% base | 6.2% (>$1k) | 7.0% (>$10k)
 *   DAI:  5.5% base | 7.0% (>$1k) | 8.0% (>$10k)
 *
 * Revenue: Platform keeps 20% of all interest earned.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS savings_accounts (
    id                    TEXT PRIMARY KEY,
    agent_id              TEXT NOT NULL,
    token                 TEXT DEFAULT 'USDC',
    balance               REAL DEFAULT 0,
    accrued_interest      REAL DEFAULT 0,
    apy_pct               REAL NOT NULL,
    platform_fee_pct      REAL DEFAULT 20,
    total_deposited       REAL DEFAULT 0,
    total_withdrawn       REAL DEFAULT 0,
    total_interest_earned REAL DEFAULT 0,
    total_platform_fees   REAL DEFAULT 0,
    status                TEXT DEFAULT 'active',
    created_at            TEXT DEFAULT (datetime('now')),
    last_interest_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS savings_transactions (
    id           TEXT PRIMARY KEY,
    account_id   TEXT REFERENCES savings_accounts(id),
    type         TEXT NOT NULL,
    amount       REAL NOT NULL,
    balance_after REAL,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APY_TIERS = {
  USDC: [
    { min: 10000, apy: 7.5 },
    { min: 1000,  apy: 6.8 },
    { min: 0,     apy: 5.2 },
  ],
  USDT: [
    { min: 10000, apy: 7.0 },
    { min: 1000,  apy: 6.2 },
    { min: 0,     apy: 4.8 },
  ],
  DAI: [
    { min: 10000, apy: 8.0 },
    { min: 1000,  apy: 7.0 },
    { min: 0,     apy: 5.5 },
  ],
};

function getApy(token, balance) {
  const tiers = APY_TIERS[token] || APY_TIERS["USDC"];
  for (const tier of tiers) {
    if (balance >= tier.min) return tier.apy;
  }
  return tiers[tiers.length - 1].apy;
}

function logTx(account_id, type, amount, balance_after) {
  db.prepare(`
    INSERT INTO savings_transactions (id, account_id, type, amount, balance_after)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuid(), account_id, type, amount, balance_after);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Open a new savings account for an agent.
 */
export function openAccount({ agent_id, token = "USDC" }) {
  if (!APY_TIERS[token]) throw new Error(`Unsupported token: ${token}. Supported: ${Object.keys(APY_TIERS).join(", ")}`);
  const id = uuid();
  const apy_pct = getApy(token, 0);
  db.prepare(`
    INSERT INTO savings_accounts (id, agent_id, token, apy_pct)
    VALUES (?, ?, ?, ?)
  `).run(id, agent_id, token, apy_pct);
  return db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(id);
}

/**
 * Deposit stablecoins into a savings account.
 */
export function deposit({ account_id, amount }) {
  if (amount <= 0) throw new Error("Deposit amount must be positive.");
  const account = db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(account_id);
  if (!account) throw new Error("Savings account not found.");
  if (account.status !== "active") throw new Error(`Account is ${account.status}. Only active accounts accept deposits.`);

  const new_balance = account.balance + amount;
  const new_apy = getApy(account.token, new_balance);

  db.prepare(`
    UPDATE savings_accounts
    SET balance = ?, total_deposited = total_deposited + ?, apy_pct = ?
    WHERE id = ?
  `).run(new_balance, amount, new_apy, account_id);

  logTx(account_id, "deposit", amount, new_balance);

  return db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(account_id);
}

/**
 * Withdraw stablecoins from a savings account (instant, no lockup).
 */
export function withdraw({ account_id, amount }) {
  if (amount <= 0) throw new Error("Withdrawal amount must be positive.");
  const account = db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(account_id);
  if (!account) throw new Error("Savings account not found.");
  if (account.status !== "active") throw new Error(`Account is ${account.status}. Withdrawals require active status.`);
  if (account.balance < amount) throw new Error(`Insufficient balance. Available: ${account.balance.toFixed(2)}`);

  const new_balance = account.balance - amount;
  const new_apy = getApy(account.token, new_balance);

  db.prepare(`
    UPDATE savings_accounts
    SET balance = ?, total_withdrawn = total_withdrawn + ?, apy_pct = ?
    WHERE id = ?
  `).run(new_balance, amount, new_apy, account_id);

  logTx(account_id, "withdraw", amount, new_balance);

  return db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(account_id);
}

/**
 * Get savings account details (balance, interest, APY).
 */
export function getAccount(account_id) {
  const account = db.prepare("SELECT * FROM savings_accounts WHERE id = ?").get(account_id);
  if (!account) throw new Error("Savings account not found.");
  const transactions = db.prepare(
    "SELECT * FROM savings_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(account_id);
  return { ...account, recent_transactions: transactions };
}

/**
 * Get all savings accounts for an agent.
 */
export function getAgentAccounts(agent_id) {
  return db.prepare("SELECT * FROM savings_accounts WHERE agent_id = ? ORDER BY created_at DESC").all(agent_id);
}

/**
 * Batch process interest accrual for all active savings accounts.
 * Calculates interest based on time since last_interest_at, applies APY tier,
 * deducts 20% platform fee, and updates balances.
 * Intended to be called periodically (e.g., every hour or daily).
 */
export function accrueInterest() {
  const accounts = db.prepare(
    "SELECT * FROM savings_accounts WHERE status = 'active' AND balance > 0"
  ).all();

  const now = new Date();
  let processed = 0;
  let total_interest = 0;
  let total_fees = 0;

  for (const account of accounts) {
    const lastAt = new Date(account.last_interest_at);
    const elapsedMs = now - lastAt;
    const elapsedYearFraction = elapsedMs / (1000 * 60 * 60 * 24 * 365);

    if (elapsedYearFraction <= 0) continue;

    // Recalculate APY based on current balance tier
    const apy = getApy(account.token, account.balance);
    const gross_interest = account.balance * (apy / 100) * elapsedYearFraction;

    if (gross_interest < 0.000001) continue; // skip negligible amounts

    const platform_fee = gross_interest * (account.platform_fee_pct / 100);
    const net_interest = gross_interest - platform_fee;

    const new_balance = account.balance + net_interest;

    db.prepare(`
      UPDATE savings_accounts
      SET balance = ?,
          accrued_interest = accrued_interest + ?,
          total_interest_earned = total_interest_earned + ?,
          total_platform_fees = total_platform_fees + ?,
          apy_pct = ?,
          last_interest_at = datetime('now')
      WHERE id = ?
    `).run(new_balance, net_interest, gross_interest, platform_fee, apy, account.id);

    logTx(account.id, "interest", net_interest, new_balance);
    if (platform_fee > 0) {
      logTx(account.id, "fee", platform_fee, new_balance);
    }

    processed++;
    total_interest += gross_interest;
    total_fees += platform_fee;
  }

  return {
    accounts_processed: processed,
    total_gross_interest: parseFloat(total_interest.toFixed(6)),
    total_platform_fees: parseFloat(total_fees.toFixed(6)),
    total_net_interest: parseFloat((total_interest - total_fees).toFixed(6)),
    processed_at: now.toISOString(),
  };
}

/**
 * Get platform-wide savings statistics.
 */
export function getSavingsStats() {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_accounts,
      COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_accounts,
      SUM(balance) AS tvl,
      SUM(total_deposited) AS total_deposited,
      SUM(total_withdrawn) AS total_withdrawn,
      SUM(total_interest_earned) AS total_interest_earned,
      SUM(total_platform_fees) AS total_platform_fees
    FROM savings_accounts
  `).get();

  const by_token = db.prepare(`
    SELECT token, COUNT(*) AS accounts, SUM(balance) AS balance, SUM(total_interest_earned) AS interest_earned
    FROM savings_accounts
    GROUP BY token
  `).all();

  return { ...stats, by_token };
}
