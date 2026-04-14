/**
 * Settlement & Escrow API Routes
 * Agent-to-agent transactions, escrow, disputes, subcontracting
 */

import { Router } from "express";
import * as settlement from "../services/settlement.js";
import { getOrCreateAgentWallet, getOnChainStats, getAgentOnChainHistory, processBatch } from "../services/onchain-settlement.js";

const router = Router();

// ─── Auth Middleware (all settlement routes) ────────────────────────────
router.use((req, res, next) => {
  const serviceKey = process.env.HIVEAGENT_SERVICE_KEY || process.env.INTERNAL_API_TOKEN || "";
  const token = req.headers["x-hive-internal-key"] || req.headers["x-api-key"];

  if (!serviceKey || token !== serviceKey) {
    return res.status(401).json({ error: "Unauthorized: valid service key required for settlement operations" });
  }
  next();
});

// ─── Escrow ──────────────────────────────────────

router.post("/escrow/lock", (req, res) => {
  try {
    const result = settlement.lockEscrow(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/escrow/:id/release", (req, res) => {
  try {
    const result = settlement.releaseEscrow(req.params.id, req.body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/escrow/:id/refund", (req, res) => {
  try {
    const result = settlement.refundEscrow(req.params.id, req.body.reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/escrow/:id/dispute", (req, res) => {
  try {
    const result = settlement.disputeEscrow(req.params.id, req.body.reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/escrow/:id", (req, res) => {
  const escrow = settlement.getEscrow(req.params.id);
  if (!escrow) return res.status(404).json({ error: "Escrow not found" });
  res.json(escrow);
});

// ─── Subcontracting ──────────────────────────────

router.post("/subcontract", (req, res) => {
  try {
    const result = settlement.subcontract(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Agent Accounts ──────────────────────────────

router.get("/agent/:id/balance", (req, res) => {
  res.json(settlement.getAgentBalance(req.params.id));
});

router.get("/agent/:id/ledger", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(settlement.getAgentLedger(req.params.id, limit));
});

router.get("/agent/:id/escrows", (req, res) => {
  res.json(settlement.getActiveEscrows(req.params.id));
});

// ─── Platform Stats ──────────────────────────────

router.get("/stats", (_req, res) => {
  res.json(settlement.getSettlementStats());
});

// ─── Admin: Expire Overdue ───────────────────────

router.post("/expire-overdue", (_req, res) => {
  const result = settlement.expireOverdueEscrows();
  res.json(result);
});

// ─── On-Chain Settlement ─────────────────────────

router.get("/onchain/stats", (_req, res) => {
  res.json(getOnChainStats());
});

router.post("/onchain/batch", async (_req, res) => {
  try {
    const result = await processBatch();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/agent/:id/wallet", async (req, res) => {
  try {
    const wallet = await getOrCreateAgentWallet(req.params.id);
    res.json(wallet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/agent/:id/onchain", (req, res) => {
  res.json(getAgentOnChainHistory(req.params.id));
});

export default router;
