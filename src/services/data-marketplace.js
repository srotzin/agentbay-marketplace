/**
 * HiveAgent Data Marketplace
 *
 * Agents buy and sell datasets. The AWS Data Exchange for agents.
 *
 * Sellers list datasets with schema, sample, price.
 * Buyers preview, purchase, and download.
 * HiveAgent takes 20% of every data sale (higher margin — data is high value).
 *
 * Types:
 * - Real-time feeds (prices, news, social, weather)
 * - Historical datasets (market data, economic indicators)
 * - Enrichment data (company info, contacts, demographics)
 * - Training data (labeled datasets for ML)
 * - Proprietary research (reports, analysis, forecasts)
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    provider_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    format TEXT DEFAULT 'json',          -- 'json', 'csv', 'parquet', 'api'
    schema_preview TEXT,                 -- JSON schema or sample
    sample_data TEXT,                    -- Small sample for preview
    record_count INTEGER,
    price_usd REAL NOT NULL,
    price_model TEXT DEFAULT 'one_time', -- 'one_time', 'per_record', 'subscription'
    subscription_interval TEXT,          -- 'daily', 'weekly', 'monthly'
    rating REAL DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_revenue_usd REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_purchases (
    id TEXT PRIMARY KEY,
    dataset_id TEXT REFERENCES datasets(id),
    buyer_agent_id TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    provider_payout_usd REAL NOT NULL,
    records_delivered INTEGER,
    access_uri TEXT,                     -- Download link or API endpoint
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_subscriptions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT REFERENCES datasets(id),
    subscriber_agent_id TEXT NOT NULL,
    interval TEXT NOT NULL,
    price_usd REAL NOT NULL,
    status TEXT DEFAULT 'active',        -- 'active', 'cancelled', 'expired'
    next_delivery TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_datasets_category ON datasets(category);
  CREATE INDEX IF NOT EXISTS idx_datasets_active ON datasets(is_active);
`);

const DATA_COMMISSION = 0.20; // 20% — premium for data

export function listDataset({ provider_agent_id, name, description, category, format = "json", schema_preview, sample_data, record_count, price_usd, price_model = "one_time", tags = [] }) {
  const id = uuid();
  db.prepare(`
    INSERT INTO datasets (id, provider_agent_id, name, description, category, format, schema_preview, sample_data, record_count, price_usd, price_model, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, provider_agent_id, name, description, category, format, schema_preview || null, sample_data || null, record_count || null, price_usd, price_model, JSON.stringify(tags));
  return { dataset_id: id, name, price_usd, price_model, status: "listed" };
}

export function searchDatasets({ query, category, max_price, format, sort_by = "popular", limit = 20 }) {
  let sql = "SELECT * FROM datasets WHERE is_active = 1";
  const params = [];
  if (query) { sql += " AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)"; const q = `%${query}%`; params.push(q, q, q); }
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (max_price) { sql += " AND price_usd <= ?"; params.push(max_price); }
  if (format) { sql += " AND format = ?"; params.push(format); }
  const sortMap = { popular: "total_sales DESC", price_low: "price_usd ASC", newest: "created_at DESC", rating: "rating DESC" };
  sql += ` ORDER BY ${sortMap[sort_by] || "total_sales DESC"} LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function purchaseDataset({ dataset_id, buyer_agent_id }) {
  const dataset = db.prepare("SELECT * FROM datasets WHERE id = ? AND is_active = 1").get(dataset_id);
  if (!dataset) throw new Error("Dataset not found");
  const commission = Math.round(dataset.price_usd * DATA_COMMISSION * 100) / 100;
  const payout = Math.round((dataset.price_usd - commission) * 100) / 100;
  const id = uuid();
  const access_uri = `https://hiveagentiq.com/api/v1/data/${dataset_id}/download?token=${id}`;
  db.prepare(`
    INSERT INTO data_purchases (id, dataset_id, buyer_agent_id, amount_usd, commission_usd, provider_payout_usd, records_delivered, access_uri)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dataset_id, buyer_agent_id, dataset.price_usd, commission, payout, dataset.record_count, access_uri);
  db.prepare("UPDATE datasets SET total_sales = total_sales + 1, total_revenue_usd = total_revenue_usd + ? WHERE id = ?").run(dataset.price_usd, dataset_id);
  return { purchase_id: id, dataset: dataset.name, amount_usd: dataset.price_usd, commission_usd: commission, access_uri, format: dataset.format, records: dataset.record_count };
}

export function previewDataset(dataset_id) {
  const dataset = db.prepare("SELECT id, name, description, category, format, schema_preview, sample_data, record_count, price_usd, price_model, rating, total_sales FROM datasets WHERE id = ?").get(dataset_id);
  if (!dataset) return null;
  return { ...dataset, sample_data: dataset.sample_data ? JSON.parse(dataset.sample_data) : null };
}

export function getDataMarketplaceStats() {
  const datasets = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE is_active = 1").get().count;
  const sales = db.prepare("SELECT COUNT(*) as count FROM data_purchases").get().count;
  const volume = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM data_purchases").get().total;
  const fees = db.prepare("SELECT COALESCE(SUM(commission_usd), 0) as total FROM data_purchases").get().total;
  return { available_datasets: datasets, total_sales: sales, volume_usd: volume, fees_usd: fees, commission_rate: DATA_COMMISSION };
}
