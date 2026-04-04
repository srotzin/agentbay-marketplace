import { Router } from "express";
import * as mkt from "../services/marketplace.js";

const router = Router();

// ─── Provider Routes ─────────────────────────────────

router.post("/providers/register", (req, res) => {
  try {
    const { name, wallet_address, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const result = mkt.registerProvider({ name, wallet_address, description });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/providers/:id", (req, res) => {
  const provider = mkt.getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const { api_key, ...safe } = provider;
  res.json(safe);
});

// ─── Service Routes ──────────────────────────────────

router.post("/services", (req, res) => {
  try {
    const { provider_api_key, ...data } = req.body;
    if (!provider_api_key) return res.status(401).json({ error: "provider_api_key required" });
    const provider = mkt.getProviderByApiKey(provider_api_key);
    if (!provider) return res.status(401).json({ error: "Invalid API key" });
    data.provider_id = provider.id;
    const result = mkt.listService(data);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/services", (req, res) => {
  const { query, category, max_price, sort_by, limit, offset } = req.query;
  const result = mkt.searchServices({
    query,
    category,
    max_price: max_price ? parseFloat(max_price) : undefined,
    sort_by,
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0,
  });
  res.json(result);
});

router.get("/services/:id", (req, res) => {
  const service = mkt.getService(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  res.json(service);
});

router.get("/categories", (_req, res) => {
  res.json(mkt.getCategories());
});

// ─── Purchase Route ──────────────────────────────────

router.post("/purchase", (req, res) => {
  try {
    const { service_id, agent_id } = req.body;
    if (!service_id || !agent_id) return res.status(400).json({ error: "service_id and agent_id required" });
    const result = mkt.purchaseService({ service_id, agent_id });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Auction Routes ──────────────────────────────────

router.post("/auctions", (req, res) => {
  try {
    const { agent_id, category, description, max_price_usd, duration_seconds } = req.body;
    if (!agent_id || !category || !description) {
      return res.status(400).json({ error: "agent_id, category, and description required" });
    }
    const result = mkt.createAuction({ agent_id, category, description, max_price_usd, duration_seconds });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/auctions", (req, res) => {
  const { category, limit } = req.query;
  const auctions = mkt.getOpenAuctions({ category, limit: limit ? parseInt(limit) : 20 });
  res.json(auctions);
});

router.get("/auctions/:id/bids", (req, res) => {
  const bids = mkt.getAuctionBids(req.params.id);
  res.json(bids);
});

router.post("/auctions/:id/bid", (req, res) => {
  try {
    const { provider_api_key, service_id, price_usd, estimated_time_ms, message } = req.body;
    if (!provider_api_key) return res.status(401).json({ error: "provider_api_key required" });
    const provider = mkt.getProviderByApiKey(provider_api_key);
    if (!provider) return res.status(401).json({ error: "Invalid API key" });
    if (!price_usd) return res.status(400).json({ error: "price_usd required" });
    const result = mkt.placeBid({
      auction_id: req.params.id,
      provider_id: provider.id,
      service_id,
      price_usd: parseFloat(price_usd),
      estimated_time_ms,
      message,
    });
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/auctions/:id/accept", (req, res) => {
  try {
    const { bid_id, agent_id } = req.body;
    if (!bid_id || !agent_id) return res.status(400).json({ error: "bid_id and agent_id required" });
    const result = mkt.acceptBid(req.params.id, bid_id, agent_id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Stats ───────────────────────────────────────────

router.get("/stats", (_req, res) => {
  res.json(mkt.getMarketplaceStats());
});

export default router;
