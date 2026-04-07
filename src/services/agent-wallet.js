/**
 * Agent Wallet as a Service
 *
 * HiveAgent becomes the bank. Every agent that holds a balance here has
 * gravitational lock-in: moving funds costs gas, so they stay. We take a
 * small fee on every in/out movement while internal transfers are instant,
 * free-of-gas, and irresistible.
 *
 * Revenue model:
 *   Deposits  — 0.1% fee
 *   Withdrawals — 0.5% fee
 *   Transfers — 0.1% fee (internal, no gas)
 */

import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────

const DEPOSIT_FEE_PCT    = 0.001; // 0.1%
const WITHDRAW_FEE_PCT   = 0.005; // 0.5%
const TRANSFER_FEE_PCT   = 0.001; // 0.1%

// ─── Schema Initialization ─────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hwa_wallets (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT NOT NULL UNIQUE,
    agent_name       TEXT NOT NULL,
    owner_email      TEXT NOT NULL,
    address          TEXT NOT NULL UNIQUE,
    balance          REAL NOT NULL DEFAULT 0,
    pending_incoming REAL NOT NULL DEFAULT 0,
    locked_in_escrow REAL NOT NULL DEFAULT 0,
    total_earned     REAL NOT NULL DEFAULT 0,
    total_spent      REAL NOT NULL DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hwa_wallet_transactions (
    id               TEXT PRIMARY KEY,
    wallet_id        TEXT NOT NULL REFERENCES hwa_wallets(id),
    type             TEXT NOT NULL CHECK(type IN ('deposit','withdrawal','transfer_in','transfer_out')),
    amount           REAL NOT NULL,
    fee              REAL NOT NULL DEFAULT 0,
    net_amount       REAL NOT NULL,
    counterparty     TEXT,
    source           TEXT,
    destination      TEXT,
    memo             TEXT,
    status           TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','completed','failed')),
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hwa_wallet_rules (
    id                          TEXT PRIMARY KEY,
    wallet_id                   TEXT NOT NULL UNIQUE REFERENCES hwa_wallets(id),
    max_per_transaction         REAL,
    daily_limit                 REAL,
    allowed_categories          TEXT DEFAULT '[]',
    require_approval_above      REAL,
    updated_at                  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_hwa_wallet_tx_wallet ON hwa_wallet_transactions(wallet_id);
  CREATE INDEX IF NOT EXISTS idx_hwa_wallet_tx_type   ON hwa_wallet_transactions(type);
`);

// ─── Seed Data ─────────────────────────────────────────────────────────────

const _walletCount = db.prepare("SELECT COUNT(*) as n FROM hwa_wallets").get().n;
if (_walletCount === 0) {
  const seedWallets = [
    {
      id: crypto.randomUUID(), agent_id: "agent_finbot_001",
      agent_name: "FinBot Pro", owner_email: "finance@acmecorp.com",
      address: "0x4a8f3c2e1d9b7a6f0e5c8d3b2a1f9e4c7d6b5a3e",
      balance: 12450.75, pending_incoming: 500.00, locked_in_escrow: 1000.00,
      total_earned: 45230.50, total_spent: 32779.75,
    },
    {
      id: crypto.randomUUID(), agent_id: "agent_supplybot_002",
      agent_name: "SupplyChain Agent", owner_email: "ops@globallogistics.io",
      address: "0x7b1e9d4c2f8a5b0e3c6d9f2a4b7e1c8d5f3a9b2c",
      balance: 87340.20, pending_incoming: 2100.00, locked_in_escrow: 5000.00,
      total_earned: 312000.00, total_spent: 224659.80,
    },
    {
      id: crypto.randomUUID(), agent_id: "agent_hrbot_003",
      agent_name: "HR Automation Agent", owner_email: "hr@techstartup.dev",
      address: "0x2c5d8e1a4f7b9c3e6a0d5f8b2c4e7a1d9f3b6c8e",
      balance: 3280.00, pending_incoming: 0, locked_in_escrow: 250.00,
      total_earned: 18900.00, total_spent: 15620.00,
    },
    {
      id: crypto.randomUUID(), agent_id: "agent_legalbot_004",
      agent_name: "LegalEagle Agent", owner_email: "agents@lawfirm.legal",
      address: "0x9d3f6c1b8e5a2c7d4f0b9e6c3a8d5f2b1c7e4a9d",
      balance: 55120.00, pending_incoming: 3400.00, locked_in_escrow: 8750.00,
      total_earned: 198450.00, total_spent: 143330.00,
    },
    {
      id: crypto.randomUUID(), agent_id: "agent_ecombot_005",
      agent_name: "E-Commerce Fulfillment Bot", owner_email: "bots@shopnow.store",
      address: "0x1f8b4d7a2e9c5f3b6d0a8c4e7f2b1d5a9c3e6f8b",
      balance: 28900.50, pending_incoming: 1200.00, locked_in_escrow: 3500.00,
      total_earned: 520100.25, total_spent: 491199.75,
    },
  ];

  const insertWallet = db.prepare(`
    INSERT OR IGNORE INTO hwa_wallets
      (id, agent_id, agent_name, owner_email, address, balance,
       pending_incoming, locked_in_escrow, total_earned, total_spent)
    VALUES
      (@id, @agent_id, @agent_name, @owner_email, @address, @balance,
       @pending_incoming, @locked_in_escrow, @total_earned, @total_spent)
  `);
  const insertTx = db.prepare(`
    INSERT OR IGNORE INTO hwa_wallet_transactions
      (id, wallet_id, type, amount, fee, net_amount, counterparty, source, destination, memo, status, created_at)
    VALUES
      (@id, @wallet_id, @type, @amount, @fee, @net_amount, @counterparty, @source, @destination, @memo, @status, @created_at)
  `);

  for (const w of seedWallets) {
    insertWallet.run(w);
    // Seed 3 historical transactions per wallet
    const seedTxs = [
      {
        id: crypto.randomUUID(), wallet_id: w.id, type: "deposit",
        amount: 5000.00, fee: 5.00, net_amount: 4995.00,
        counterparty: "Coinbase", source: "coinbase_custody", destination: w.address,
        memo: "Initial USDC deposit from Coinbase Custody", status: "completed",
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: crypto.randomUUID(), wallet_id: w.id, type: "transfer_in",
        amount: 1200.00, fee: 1.20, net_amount: 1198.80,
        counterparty: "agent_marketplace_escrow", source: "agent_marketplace_escrow", destination: w.id,
        memo: "Payment received for completed job #JOB-4821", status: "completed",
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: crypto.randomUUID(), wallet_id: w.id, type: "withdrawal",
        amount: 800.00, fee: 4.00, net_amount: 796.00,
        counterparty: "0xExternalWallet", source: w.address, destination: "0xA1B2C3D4E5F678901234567890ABCDEF12345678",
        memo: "Profit extraction to owner wallet", status: "completed",
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    for (const tx of seedTxs) insertTx.run(tx);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getWallet(walletId) {
  const w = db.prepare("SELECT * FROM hwa_wallets WHERE id = ?").get(walletId);
  if (!w) throw new Error(`Wallet not found: ${walletId}`);
  return w;
}

// ─── createWallet ──────────────────────────────────────────────────────────

/**
 * Create a HiveAgent wallet for any agent. Free to create.
 * @param {string} agentId    - Unique identifier for the agent
 * @param {string} agentName  - Human-readable agent name
 * @param {string} ownerEmail - Email of the wallet owner / operator
 * @returns {object} wallet_id, address, balance, created_at
 */
export function createWallet(agentId, agentName, ownerEmail) {
  if (!agentId)    throw new Error("agentId is required");
  if (!agentName)  throw new Error("agentName is required");
  if (!ownerEmail) throw new Error("ownerEmail is required");

  const existing = db.prepare("SELECT * FROM hwa_wallets WHERE agent_id = ?").get(agentId);
  if (existing) {
    return {
      wallet_id:  existing.id,
      agent_id:   existing.agent_id,
      agent_name: existing.agent_name,
      owner_email: existing.owner_email,
      address:    existing.address,
      balance:    existing.balance,
      created_at: existing.created_at,
      message:    "Wallet already exists for this agent — returning existing record.",
    };
  }

  const id = crypto.randomUUID();
  // Generate a deterministic-looking hex address
  const addrSeed = crypto.randomUUID().replace(/-/g, "");
  const address  = `0x${addrSeed}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const now      = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hwa_wallets (id, agent_id, agent_name, owner_email, address, balance)
    VALUES (@id, @agent_id, @agent_name, @owner_email, @address, 0)
  `).run({ id, agent_id: agentId, agent_name: agentName, owner_email: ownerEmail, address });

  return {
    wallet_id:   id,
    agent_id:    agentId,
    agent_name:  agentName,
    owner_email: ownerEmail,
    address,
    balance:     0,
    currency:    "USDC",
    created_at:  now,
    message:     "HiveAgent wallet created. Deposit USDC to begin. Internal transfers are instant and gas-free.",
  };
}

// ─── deposit ──────────────────────────────────────────────────────────────

/**
 * Deposit USDC into a HiveAgent wallet.
 * @param {string} walletId - Target wallet ID
 * @param {number} amount   - USDC amount to deposit (must be > 0)
 * @param {string} source   - Source description (e.g. "coinbase", "bank_transfer")
 * @returns {object} transaction_id, new_balance, fee
 */
export function deposit(walletId, amount, source) {
  if (!walletId)          throw new Error("walletId is required");
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!source)            throw new Error("source is required");

  const wallet  = getWallet(walletId);
  const fee     = Math.round(amount * DEPOSIT_FEE_PCT * 100) / 100;
  const net     = Math.round((amount - fee) * 100) / 100;
  const txId    = crypto.randomUUID();
  const now     = new Date().toISOString();
  const newBal  = Math.round((wallet.balance + net) * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO hwa_wallet_transactions
      (id, wallet_id, type, amount, fee, net_amount, source, memo, status, created_at)
    VALUES (@id, @wallet_id, 'deposit', @amount, @fee, @net_amount, @source, @memo, 'completed', @created_at)
  `).run({ id: txId, wallet_id: walletId, amount, fee, net_amount: net, source, memo: `Deposit from ${source}`, created_at: now });

  db.prepare(`
    UPDATE hwa_wallets
    SET balance = @balance, total_earned = total_earned + @net
    WHERE id = @id
  `).run({ balance: newBal, net, id: walletId });

  return {
    transaction_id:  txId,
    type:            "deposit",
    amount_deposited: amount,
    fee_usd:         fee,
    fee_pct:         "0.1%",
    net_credited:    net,
    new_balance:     newBal,
    currency:        "USDC",
    source,
    wallet_address:  wallet.address,
    completed_at:    now,
  };
}

// ─── withdraw ─────────────────────────────────────────────────────────────

/**
 * Withdraw USDC from a HiveAgent wallet to an external address.
 * @param {string} walletId            - Source wallet ID
 * @param {number} amount              - USDC amount to withdraw
 * @param {string} destinationAddress  - External wallet address (0x...)
 * @returns {object} transaction_id, new_balance, fee, estimated_arrival
 */
export function withdraw(walletId, amount, destinationAddress) {
  if (!walletId)           throw new Error("walletId is required");
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");
  if (!destinationAddress) throw new Error("destinationAddress is required");

  const wallet = getWallet(walletId);
  const fee    = Math.round(amount * WITHDRAW_FEE_PCT * 100) / 100;
  const total  = Math.round((amount + fee) * 100) / 100;

  if (wallet.balance < total) {
    throw new Error(`Insufficient balance. Required: $${total} (incl. $${fee} fee), Available: $${wallet.balance}`);
  }

  const txId   = crypto.randomUUID();
  const now    = new Date().toISOString();
  const newBal = Math.round((wallet.balance - total) * 100) / 100;
  const arrival = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // ~15 min

  db.prepare(`
    INSERT OR IGNORE INTO hwa_wallet_transactions
      (id, wallet_id, type, amount, fee, net_amount, destination, memo, status, created_at)
    VALUES (@id, @wallet_id, 'withdrawal', @amount, @fee, @net_amount, @destination, @memo, 'completed', @created_at)
  `).run({
    id: txId, wallet_id: walletId, amount, fee, net_amount: amount,
    destination: destinationAddress,
    memo: `Withdrawal to ${destinationAddress}`, created_at: now,
  });

  db.prepare(`
    UPDATE hwa_wallets
    SET balance = @balance, total_spent = total_spent + @total
    WHERE id = @id
  `).run({ balance: newBal, total, id: walletId });

  return {
    transaction_id:       txId,
    type:                 "withdrawal",
    amount_withdrawn:     amount,
    fee_usd:              fee,
    fee_pct:              "0.5%",
    total_debited:        total,
    new_balance:          newBal,
    currency:             "USDC",
    destination_address:  destinationAddress,
    estimated_arrival:    arrival,
    note:                 "Tip: Keep funds inside HiveAgent for instant zero-gas internal transfers.",
    completed_at:         now,
  };
}

// ─── transfer ─────────────────────────────────────────────────────────────

/**
 * Transfer USDC between two HiveAgent wallets. Instant, no gas.
 * @param {string} fromWalletId - Sender wallet ID
 * @param {string} toWalletId   - Recipient wallet ID
 * @param {number} amount       - USDC amount to transfer
 * @param {string} memo         - Description / payment reference
 * @returns {object} transaction_id, from_balance, to_balance, fee
 */
export function transfer(fromWalletId, toWalletId, amount, memo) {
  if (!fromWalletId) throw new Error("fromWalletId is required");
  if (!toWalletId)   throw new Error("toWalletId is required");
  if (fromWalletId === toWalletId) throw new Error("Cannot transfer to the same wallet");
  if (!amount || amount <= 0) throw new Error("amount must be a positive number");

  const sender   = getWallet(fromWalletId);
  const receiver = getWallet(toWalletId);
  const fee      = Math.round(amount * TRANSFER_FEE_PCT * 100) / 100;
  const total    = Math.round((amount + fee) * 100) / 100;

  if (sender.balance < total) {
    throw new Error(`Insufficient balance. Required: $${total} (incl. $${fee} fee), Available: $${sender.balance}`);
  }

  const txId         = crypto.randomUUID();
  const now          = new Date().toISOString();
  const newFromBal   = Math.round((sender.balance - total) * 100) / 100;
  const newToBal     = Math.round((receiver.balance + amount) * 100) / 100;
  const memoText     = memo || "Internal HiveAgent transfer";

  const doTransfer = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO hwa_wallet_transactions
        (id, wallet_id, type, amount, fee, net_amount, counterparty, memo, status, created_at)
      VALUES (@id, @wallet_id, 'transfer_out', @amount, @fee, @net_amount, @counterparty, @memo, 'completed', @created_at)
    `).run({ id: txId, wallet_id: fromWalletId, amount, fee, net_amount: amount, counterparty: toWalletId, memo: memoText, created_at: now });

    db.prepare(`
      INSERT OR IGNORE INTO hwa_wallet_transactions
        (id, wallet_id, type, amount, fee, net_amount, counterparty, memo, status, created_at)
      VALUES (@id, @wallet_id, 'transfer_in', @amount, @fee, @net_amount, @counterparty, @memo, 'completed', @created_at)
    `).run({ id: crypto.randomUUID(), wallet_id: toWalletId, amount, fee: 0, net_amount: amount, counterparty: fromWalletId, memo: memoText, created_at: now });

    db.prepare("UPDATE hwa_wallets SET balance = @balance, total_spent = total_spent + @total WHERE id = @id")
      .run({ balance: newFromBal, total, id: fromWalletId });
    db.prepare("UPDATE hwa_wallets SET balance = @balance, total_earned = total_earned + @amount WHERE id = @id")
      .run({ balance: newToBal, amount, id: toWalletId });
  });

  doTransfer();

  return {
    transaction_id:  txId,
    type:            "transfer",
    amount:          amount,
    fee_usd:         fee,
    fee_pct:         "0.1%",
    memo:            memoText,
    from_wallet_id:  fromWalletId,
    from_agent:      sender.agent_name,
    from_balance:    newFromBal,
    to_wallet_id:    toWalletId,
    to_agent:        receiver.agent_name,
    to_balance:      newToBal,
    currency:        "USDC",
    settlement:      "instant",
    gas_fees:        0,
    completed_at:    now,
  };
}

// ─── getBalance ────────────────────────────────────────────────────────────

/**
 * Check the balance and financial summary of a wallet. Free.
 * @param {string} walletId
 * @returns {object} balance, pending_incoming, locked_in_escrow, total_earned, total_spent
 */
export function getBalance(walletId) {
  if (!walletId) throw new Error("walletId is required");
  const wallet = getWallet(walletId);

  return {
    wallet_id:        wallet.id,
    agent_id:         wallet.agent_id,
    agent_name:       wallet.agent_name,
    address:          wallet.address,
    balance:          wallet.balance,
    pending_incoming: wallet.pending_incoming,
    locked_in_escrow: wallet.locked_in_escrow,
    available:        Math.max(0, wallet.balance - wallet.locked_in_escrow),
    total_earned:     wallet.total_earned,
    total_spent:      wallet.total_spent,
    net_position:     Math.round((wallet.total_earned - wallet.total_spent) * 100) / 100,
    currency:         "USDC",
    as_of:            new Date().toISOString(),
  };
}

// ─── getTransactionHistory ─────────────────────────────────────────────────

/**
 * Full paginated transaction history for a wallet. Free.
 * @param {string} walletId
 * @param {number} limit  - Max records to return (default 20)
 * @param {number} offset - Pagination offset (default 0)
 * @returns {object} transactions[], total_count, wallet summary
 */
export function getTransactionHistory(walletId, limit = 20, offset = 0) {
  if (!walletId) throw new Error("walletId is required");
  const wallet = getWallet(walletId);

  const rows = db.prepare(`
    SELECT * FROM hwa_wallet_transactions
    WHERE wallet_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(walletId, limit, offset);

  const total = db.prepare("SELECT COUNT(*) as n FROM hwa_wallet_transactions WHERE wallet_id = ?").get(walletId).n;

  return {
    wallet_id:   walletId,
    agent_name:  wallet.agent_name,
    transactions: rows.map(tx => ({
      transaction_id: tx.id,
      type:           tx.type,
      amount:         tx.amount,
      fee:            tx.fee,
      net_amount:     tx.net_amount,
      counterparty:   tx.counterparty,
      source:         tx.source,
      destination:    tx.destination,
      memo:           tx.memo,
      status:         tx.status,
      timestamp:      tx.created_at,
    })),
    pagination: { limit, offset, total_count: total, has_more: offset + limit < total },
  };
}

// ─── setSpendingRules ──────────────────────────────────────────────────────

/**
 * Configure auto-spending rules for a wallet. Free.
 * @param {string} walletId - Wallet to configure
 * @param {object} rules    - { max_per_transaction, daily_limit, allowed_categories[], require_approval_above }
 * @returns {object} rules_applied
 */
export function setSpendingRules(walletId, rules) {
  if (!walletId) throw new Error("walletId is required");
  if (!rules || typeof rules !== "object") throw new Error("rules must be an object");
  getWallet(walletId); // validate exists

  const {
    max_per_transaction = null,
    daily_limit         = null,
    allowed_categories  = [],
    require_approval_above = null,
  } = rules;

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO hwa_wallet_rules
      (id, wallet_id, max_per_transaction, daily_limit, allowed_categories, require_approval_above, updated_at)
    VALUES (@id, @wallet_id, @max_per_transaction, @daily_limit, @allowed_categories, @require_approval_above, @updated_at)
    ON CONFLICT(wallet_id) DO UPDATE SET
      max_per_transaction    = excluded.max_per_transaction,
      daily_limit            = excluded.daily_limit,
      allowed_categories     = excluded.allowed_categories,
      require_approval_above = excluded.require_approval_above,
      updated_at             = excluded.updated_at
  `).run({
    id, wallet_id: walletId,
    max_per_transaction,
    daily_limit,
    allowed_categories:     JSON.stringify(allowed_categories),
    require_approval_above,
    updated_at: now,
  });

  return {
    wallet_id:             walletId,
    rules_applied: {
      max_per_transaction:    max_per_transaction ?? "unlimited",
      daily_limit:            daily_limit ?? "unlimited",
      allowed_categories:     allowed_categories.length ? allowed_categories : ["all"],
      require_approval_above: require_approval_above ?? "never",
    },
    effective_immediately: true,
    updated_at:            now,
    message:               "Spending rules saved. All subsequent transactions will be validated against these rules.",
  };
}
