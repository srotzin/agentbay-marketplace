/**
 * HiveAgent BVNK Integration
 *
 * BVNK: Enterprise stablecoin payments infrastructure.
 * "As traditional payments, stablecoins, and onchain finance converge,
 *  the market is shifting away from fragmented tooling toward more
 *  integrated solutions." — Money Code / Stablecon (Apr 8, 2026)
 *
 * What BVNK adds that HiveAgent didn't have:
 *
 *   1. PAYMENT CHANNELS — persistent, reusable blockchain addresses.
 *      Assign one to a customer/agent; they send stablecoins whenever.
 *      BVNK auto-converts and credits your fiat or USDC wallet.
 *      This is the enterprise "accept crypto from end-users" flow.
 *
 *   2. PAY-IN (payment links) — create a one-time payment request,
 *      customer sends stablecoin, BVNK settles you in fiat or stablecoin.
 *      Supports: USDC, USDT, DAI → USD, EUR, GBP, or same crypto.
 *
 *   3. PAY-OUT (stablecoin disbursement) — start from a fiat wallet,
 *      BVNK auto-converts and sends stablecoins to any wallet address.
 *      No need to hold crypto. Fiat-native enterprise payout.
 *
 *   4. FX QUOTES — get a firm quote for fiat↔stablecoin conversion,
 *      lock it, accept it. Rate guaranteed for quote window.
 *
 *   5. WALLET BALANCES — check fiat and stablecoin wallet balances
 *      across all currencies.
 *
 *   6. CROSS-CHAIN AUTO-ROUTING — BVNK detects wrong-chain sends
 *      and auto-routes to the correct chain. Built into their infra.
 *
 * Live API: https://api.bvnk.com
 * Sandbox:  https://api.sandbox.bvnk.com
 * Auth:     Hawk (API key ID + secret) or Bearer JWT
 * Docs:     https://docs.bvnk.com
 *
 * Env vars required for live mode:
 *   BVNK_API_KEY     — Hawk Auth ID from BVNK Portal
 *   BVNK_API_SECRET  — Hawk Secret Key from BVNK Portal
 *   BVNK_MERCHANT_ID — Your BVNK Merchant ID
 *
 * When env vars are absent: runs in simulation mode with
 * production-realistic response shapes. Set env vars on Render
 * once you have a BVNK account to go live instantly.
 *
 * Revenue: HiveAgent charges 0.1% on BVNK-routed volume as a
 * wrapper/orchestration fee (on top of BVNK's own fees).
 */

import { v4 as uuid } from "uuid";
import { createHmac, createHash } from "crypto";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS bvnk_channels (
    id                TEXT PRIMARY KEY,
    bvnk_channel_id   TEXT UNIQUE,
    agent_id          TEXT NOT NULL,
    merchant_id       TEXT,
    reference         TEXT NOT NULL,
    label             TEXT,
    currency          TEXT NOT NULL DEFAULT 'USDC',   -- settlement currency
    network           TEXT NOT NULL DEFAULT 'BASE',   -- blockchain network
    channel_address   TEXT,                           -- the persistent receive address
    status            TEXT DEFAULT 'active',
    total_received    REAL DEFAULT 0,
    payment_count     INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bvnk_channel_payments (
    id               TEXT PRIMARY KEY,
    channel_id       TEXT NOT NULL REFERENCES bvnk_channels(id),
    bvnk_payment_id  TEXT UNIQUE,
    amount           REAL NOT NULL,
    currency         TEXT NOT NULL,
    from_address     TEXT,
    status           TEXT DEFAULT 'COMPLETE',
    tx_hash          TEXT,
    received_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bvnk_payins (
    id               TEXT PRIMARY KEY,
    bvnk_payment_id  TEXT UNIQUE,
    agent_id         TEXT NOT NULL,
    wallet_id        TEXT,
    reference        TEXT NOT NULL,
    amount           REAL NOT NULL,
    currency         TEXT NOT NULL,             -- display currency (USD, EUR)
    settlement_currency TEXT NOT NULL DEFAULT 'USD',
    accept_currencies TEXT DEFAULT '[]',        -- which stablecoins accepted
    pay_address      TEXT,                      -- address customer sends to
    hosted_page_url  TEXT,                      -- BVNK-hosted payment page
    status           TEXT DEFAULT 'PENDING',
    expires_at       TEXT,
    paid_amount      REAL,
    paid_currency    TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bvnk_payouts (
    id               TEXT PRIMARY KEY,
    bvnk_payment_id  TEXT UNIQUE,
    agent_id         TEXT NOT NULL,
    wallet_id        TEXT,
    reference        TEXT NOT NULL,
    amount           REAL NOT NULL,
    from_currency    TEXT NOT NULL DEFAULT 'USD',    -- source fiat wallet
    to_currency      TEXT NOT NULL DEFAULT 'USDC',  -- stablecoin to send
    to_address       TEXT NOT NULL,                  -- recipient wallet
    network          TEXT DEFAULT 'BASE',
    fee              REAL,
    status           TEXT DEFAULT 'COMPLETE',
    tx_hash          TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bvnk_quotes (
    id               TEXT PRIMARY KEY,
    bvnk_quote_id    TEXT UNIQUE,
    agent_id         TEXT NOT NULL,
    merchant_id      TEXT,
    from_currency    TEXT NOT NULL,
    to_currency      TEXT NOT NULL,
    from_amount      REAL,
    to_amount        REAL,
    rate             REAL NOT NULL,
    fee              REAL,
    status           TEXT DEFAULT 'PENDING',     -- PENDING | ACCEPTED | EXPIRED
    expires_at       TEXT,
    accepted_at      TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bvnk_channels_agent  ON bvnk_channels(agent_id);
  CREATE INDEX IF NOT EXISTS idx_bvnk_payins_agent    ON bvnk_payins(agent_id);
  CREATE INDEX IF NOT EXISTS idx_bvnk_payouts_agent   ON bvnk_payouts(agent_id);
`);

// ─── BVNK API Client ──────────────────────────────────────────────────────────

const BVNK_BASE_URL = process.env.BVNK_SANDBOX === "true"
  ? "https://api.sandbox.bvnk.com"
  : "https://api.bvnk.com";

const LIVE_MODE = !!(process.env.BVNK_API_KEY && process.env.BVNK_API_SECRET);
async function bvnkRequest(method, path, body) {
  if (!LIVE_MODE) return null;

  const url        = `${BVNK_BASE_URL}${path}`;
  const hawkId     = process.env.BVNK_API_KEY;
  const hawkSecret = process.env.BVNK_API_SECRET;
  const ts         = String(Math.floor(Date.now() / 1000));
  const nonce      = crypto.randomBytes(4).toString("hex");
  const parsed     = new URL(url);
  const host       = parsed.hostname;
  const port       = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const resource   = parsed.pathname + (parsed.search || "");
  const methUpper  = method.toUpperCase();
  const bodyStr    = body ? JSON.stringify(body) : "";

  // Payload hash per Hawk spec (required for POST/PUT with body)
  let payloadHash = "";
  if (bodyStr) {
    payloadHash = crypto
      .createHash("sha256")
      .update(`hawk.1.payload\napplication/json\n${bodyStr}\n`)
      .digest("base64");
  }

  // Normalized request string — exact order per mozilla/hawk spec
  const normalized = [
    "hawk.1.header",
    ts,
    nonce,
    methUpper,
    resource,
    host,
    port,
    payloadHash,
    "",
  ].join("\n") + "\n";

  const mac = crypto.createHmac("sha256", hawkSecret).update(normalized).digest("base64");

  let hawkHeader = `Hawk id="${hawkId}", ts="${ts}", nonce="${nonce}"`;
  if (payloadHash) hawkHeader += `, hash="${payloadHash}"`;
  hawkHeader += `, mac="${mac}"`;

  const opts = {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "Authorization": hawkHeader,
    },
  };
  if (process.env.BVNK_MERCHANT_ID) opts.headers["X-Merchant-Id"] = process.env.BVNK_MERCHANT_ID;
  if (bodyStr) opts.body = bodyStr;

  const res  = await fetch(url, opts);
  const text = (await res.text()).trim();

  if (!res.ok) {
    let detail = text || `HTTP ${res.status}`;
    try { detail = JSON.stringify(JSON.parse(text)); } catch {}
    throw new Error(`BVNK ${res.status}: ${detail.slice(0, 300)}`);
  }

  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
