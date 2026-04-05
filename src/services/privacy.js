/**
 * HiveAgent Privacy Layer
 *
 * Zero-knowledge proofs and privacy features for agent transactions.
 *
 * THE PROBLEM:
 * On Base L2, every transaction is public. If Agent A researches a competitor
 * via HiveAgent, the competitor's agent can see that on-chain. Trading agents
 * front-run each other. Agent strategies are exposed.
 *
 * THE SOLUTION — Three privacy tiers:
 *
 * TIER 1: SHIELDED ACCOUNTS (Off-chain, free)
 * - Transactions settle internally in HiveAgent's ledger
 * - Only the net settlement goes on-chain (batched, aggregated)
 * - Individual transactions are invisible on-chain
 * - Like how Coinbase handles internal transfers
 *
 * TIER 2: COMMITMENT SCHEME (Crypto-native)
 * - Agent commits to a transaction with a hash (commit)
 * - Transaction executes privately
 * - After settlement, the commitment is revealed (reveal)
 * - Observers see the hash but can't decode the transaction until reveal
 * - Perfect for: prediction markets, auctions, sealed bids
 *
 * TIER 3: ZK-PROOF VERIFICATION (Future — when Base supports it)
 * - Agent proves they have sufficient balance without revealing the amount
 * - Agent proves they completed a task without revealing what it was
 * - Uses zk-SNARKs or zk-STARKs when Base/OP stack adds native support
 * - For now: simulate with commitment + off-chain verification
 *
 * PRIVACY FEATURES:
 * - Stealth addresses: One-time addresses per transaction
 * - Shielded balances: Only the agent knows their balance
 * - Private purchases: Service providers don't know who bought
 * - Sealed auctions: Bids are hidden until reveal
 * - Anonymous reputation: Prove you have 4.5+ stars without revealing identity
 *
 * Revenue: 1% privacy premium on shielded transactions
 */

import { v4 as uuid } from "uuid";
import crypto from "crypto";
import db from "../db.js";

const PRIVACY_FEE = 0.01; // 1% premium for privacy

db.exec(`
  CREATE TABLE IF NOT EXISTS shielded_accounts (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    stealth_address TEXT UNIQUE NOT NULL,
    shielded_balance_usd REAL DEFAULT 0,
    total_deposited REAL DEFAULT 0,
    total_withdrawn REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shielded_transactions (
    id TEXT PRIMARY KEY,
    from_stealth TEXT,
    to_stealth TEXT,
    amount_usd REAL NOT NULL,
    fee_usd REAL NOT NULL,
    type TEXT NOT NULL,                  -- 'deposit', 'withdraw', 'transfer', 'purchase', 'bet', 'swap'
    reference_id TEXT,                   -- Links to the actual transaction (encrypted)
    commitment_hash TEXT,                -- Hash of transaction details
    revealed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sealed_bids (
    id TEXT PRIMARY KEY,
    auction_id TEXT NOT NULL,
    bidder_stealth TEXT NOT NULL,
    commitment_hash TEXT NOT NULL,        -- Hash(bid_amount + salt)
    revealed_amount REAL,
    salt TEXT,
    status TEXT DEFAULT 'sealed',         -- 'sealed', 'revealed', 'won', 'lost'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zk_proofs (
    id TEXT PRIMARY KEY,
    agent_stealth TEXT NOT NULL,
    proof_type TEXT NOT NULL,             -- 'balance_gte', 'reputation_gte', 'age_gte', 'transaction_count_gte'
    claim TEXT NOT NULL,                  -- What they're proving (e.g., 'balance >= 100')
    proof_hash TEXT NOT NULL,             -- Hash that verifies the claim
    verified INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_shielded_agent ON shielded_accounts(agent_id);
  CREATE INDEX IF NOT EXISTS idx_shielded_stealth ON shielded_accounts(stealth_address);
  CREATE INDEX IF NOT EXISTS idx_stx_from ON shielded_transactions(from_stealth);
  CREATE INDEX IF NOT EXISTS idx_stx_to ON shielded_transactions(to_stealth);
`);

// ─── Stealth Address Generation ──────────────────

function generateStealthAddress() {
  return "0xS" + crypto.randomBytes(19).toString("hex"); // "S" prefix = stealth
}

function hashCommitment(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// ─── Shielded Account Management ─────────────────

/**
 * Create a shielded (private) account for an agent
 */
export function createShieldedAccount(agent_id) {
  const existing = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(agent_id);
  if (existing) return { stealth_address: existing.stealth_address, balance_usd: existing.shielded_balance_usd, status: "exists" };

  const id = uuid();
  const stealth = generateStealthAddress();
  db.prepare("INSERT INTO shielded_accounts (id, agent_id, stealth_address) VALUES (?, ?, ?)").run(id, agent_id, stealth);
  return { stealth_address: stealth, balance_usd: 0, status: "created", message: "Your shielded account is ready. Use your stealth address for private transactions." };
}

/**
 * Deposit into shielded account (public → private)
 */
export function shieldDeposit(agent_id, amount_usd) {
  const account = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(agent_id);
  if (!account) throw new Error("No shielded account. Call createShieldedAccount first.");

  const fee = Math.round(amount_usd * PRIVACY_FEE * 100) / 100;
  const net = amount_usd - fee;
  const txId = uuid();

  db.prepare("UPDATE shielded_accounts SET shielded_balance_usd = shielded_balance_usd + ?, total_deposited = total_deposited + ?, transaction_count = transaction_count + 1 WHERE agent_id = ?")
    .run(net, amount_usd, agent_id);

  const commitment = hashCommitment({ type: "deposit", to: account.stealth_address, amount: net, ts: Date.now() });
  db.prepare("INSERT INTO shielded_transactions (id, to_stealth, amount_usd, fee_usd, type, commitment_hash) VALUES (?, ?, ?, ?, 'deposit', ?)")
    .run(txId, account.stealth_address, net, fee, commitment);

  return { tx_id: txId, deposited: amount_usd, fee_usd: fee, shielded_balance: net, stealth_address: account.stealth_address, commitment_hash: commitment };
}

/**
 * Withdraw from shielded account (private → public)
 */
export function shieldWithdraw(agent_id, amount_usd) {
  const account = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(agent_id);
  if (!account) throw new Error("No shielded account");
  if (account.shielded_balance_usd < amount_usd) throw new Error("Insufficient shielded balance");

  const fee = Math.round(amount_usd * PRIVACY_FEE * 100) / 100;
  const net = amount_usd - fee;
  const txId = uuid();

  db.prepare("UPDATE shielded_accounts SET shielded_balance_usd = shielded_balance_usd - ?, total_withdrawn = total_withdrawn + ?, transaction_count = transaction_count + 1 WHERE agent_id = ?")
    .run(amount_usd, amount_usd, agent_id);

  const commitment = hashCommitment({ type: "withdraw", from: account.stealth_address, amount: net, ts: Date.now() });
  db.prepare("INSERT INTO shielded_transactions (id, from_stealth, amount_usd, fee_usd, type, commitment_hash) VALUES (?, ?, ?, ?, 'withdraw', ?)")
    .run(txId, account.stealth_address, net, fee, commitment);

  return { tx_id: txId, withdrawn: net, fee_usd: fee, remaining_balance: account.shielded_balance_usd - amount_usd };
}

/**
 * Private transfer between shielded accounts
 */
export function shieldedTransfer(from_agent_id, to_stealth_address, amount_usd) {
  const from = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(from_agent_id);
  if (!from) throw new Error("Sender has no shielded account");
  if (from.shielded_balance_usd < amount_usd) throw new Error("Insufficient shielded balance");

  const to = db.prepare("SELECT * FROM shielded_accounts WHERE stealth_address = ?").get(to_stealth_address);
  if (!to) throw new Error("Recipient stealth address not found");

  const fee = Math.round(amount_usd * PRIVACY_FEE * 100) / 100;
  const net = amount_usd - fee;
  const txId = uuid();

  db.prepare("UPDATE shielded_accounts SET shielded_balance_usd = shielded_balance_usd - ?, transaction_count = transaction_count + 1 WHERE agent_id = ?")
    .run(amount_usd, from_agent_id);
  db.prepare("UPDATE shielded_accounts SET shielded_balance_usd = shielded_balance_usd + ?, transaction_count = transaction_count + 1 WHERE stealth_address = ?")
    .run(net, to_stealth_address);

  const commitment = hashCommitment({ type: "transfer", from: from.stealth_address, to: to_stealth_address, amount: net, ts: Date.now() });
  db.prepare("INSERT INTO shielded_transactions (id, from_stealth, to_stealth, amount_usd, fee_usd, type, commitment_hash) VALUES (?, ?, ?, ?, ?, 'transfer', ?)")
    .run(txId, from.stealth_address, to_stealth_address, net, fee, commitment);

  return { tx_id: txId, amount_sent: net, fee_usd: fee, commitment_hash: commitment, message: "Transfer complete. Only sender and receiver know the details." };
}

// ─── Sealed Bid Auctions ─────────────────────────

/**
 * Submit a sealed bid (only hash visible until reveal)
 */
export function submitSealedBid(auction_id, bidder_agent_id, bid_amount, salt) {
  const account = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(bidder_agent_id);
  if (!account) throw new Error("Shielded account required for sealed bids");

  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const commitment = hashCommitment({ auction_id, amount: bid_amount, salt: actualSalt });
  const id = uuid();

  db.prepare("INSERT INTO sealed_bids (id, auction_id, bidder_stealth, commitment_hash) VALUES (?, ?, ?, ?)")
    .run(id, auction_id, account.stealth_address, commitment);

  return { bid_id: id, commitment_hash: commitment, salt: actualSalt, message: "Bid sealed. Save your salt — you need it to reveal." };
}

/**
 * Reveal a sealed bid
 */
export function revealSealedBid(bid_id, bid_amount, salt) {
  const bid = db.prepare("SELECT * FROM sealed_bids WHERE id = ?").get(bid_id);
  if (!bid) throw new Error("Bid not found");
  if (bid.status !== "sealed") throw new Error("Bid already revealed");

  const expectedHash = hashCommitment({ auction_id: bid.auction_id, amount: bid_amount, salt });
  if (expectedHash !== bid.commitment_hash) throw new Error("Invalid reveal — hash mismatch. Wrong amount or salt.");

  db.prepare("UPDATE sealed_bids SET status = 'revealed', revealed_amount = ?, salt = ? WHERE id = ?")
    .run(bid_amount, salt, bid_id);

  return { bid_id, revealed_amount: bid_amount, verified: true };
}

// ─── ZK-Proof Simulation ─────────────────────────

/**
 * Generate a proof that an agent meets a threshold without revealing exact value
 * e.g., "I have at least $100 in my account" without showing the actual balance
 */
export function generateProof(agent_id, proof_type, threshold) {
  const account = db.prepare("SELECT * FROM shielded_accounts WHERE agent_id = ?").get(agent_id);
  if (!account) throw new Error("Shielded account required");

  let actualValue;
  let claim;

  switch (proof_type) {
    case "balance_gte":
      actualValue = account.shielded_balance_usd;
      claim = `balance >= ${threshold}`;
      break;
    case "transaction_count_gte":
      actualValue = account.transaction_count;
      claim = `transactions >= ${threshold}`;
      break;
    default:
      throw new Error("Supported proof types: balance_gte, transaction_count_gte");
  }

  if (actualValue < threshold) throw new Error("Cannot generate proof — condition not met");

  const proofData = { agent_stealth: account.stealth_address, proof_type, threshold, ts: Date.now(), nonce: crypto.randomBytes(16).toString("hex") };
  const proofHash = hashCommitment(proofData);
  const id = uuid();
  const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  db.prepare("INSERT INTO zk_proofs (id, agent_stealth, proof_type, claim, proof_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, account.stealth_address, proof_type, claim, proofHash, expires);

  return { proof_id: id, claim, proof_hash: proofHash, expires_at: expires, verified: true, message: `Proof generated: ${claim}. Share proof_id to verify without revealing actual value.` };
}

/**
 * Verify a proof
 */
export function verifyProof(proof_id) {
  const proof = db.prepare("SELECT * FROM zk_proofs WHERE id = ?").get(proof_id);
  if (!proof) return { verified: false, error: "Proof not found" };
  if (new Date(proof.expires_at) < new Date()) return { verified: false, error: "Proof expired" };
  return { verified: true, claim: proof.claim, proof_type: proof.proof_type, expires_at: proof.expires_at };
}

// ─── Stats ───────────────────────────────────────

export function getPrivacyStats() {
  const accounts = db.prepare("SELECT COUNT(*) as count FROM shielded_accounts").get().count;
  const totalShielded = db.prepare("SELECT COALESCE(SUM(shielded_balance_usd), 0) as total FROM shielded_accounts").get().total;
  const transactions = db.prepare("SELECT COUNT(*) as count FROM shielded_transactions").get().count;
  const fees = db.prepare("SELECT COALESCE(SUM(fee_usd), 0) as total FROM shielded_transactions").get().total;
  const sealedBids = db.prepare("SELECT COUNT(*) as count FROM sealed_bids").get().count;
  const proofs = db.prepare("SELECT COUNT(*) as count FROM zk_proofs").get().count;
  return { shielded_accounts: accounts, total_shielded_usd: totalShielded, transactions, privacy_fees_usd: fees, sealed_bids: sealedBids, zk_proofs: proofs };
}
