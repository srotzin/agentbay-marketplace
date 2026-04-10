import { v4 as uuid } from "uuid";
import db from "../db.js";

// Energy Trading services: day-ahead bids, real-time adjustments, settlement, risk limits.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS energy_trading_books (
    id                TEXT PRIMARY KEY,
    book_name         TEXT NOT NULL,
    market            TEXT DEFAULT 'ERCOT',
    base_currency     TEXT DEFAULT 'USD',
    risk_limit_mw     REAL DEFAULT 50,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_products (
    id                TEXT PRIMARY KEY,
    market            TEXT NOT NULL,
    product_code      TEXT NOT NULL,
    product_type      TEXT DEFAULT 'DA' CHECK(product_type IN ('DA','RT','FTR','REC')),
    delivery_start    TEXT NOT NULL,
    delivery_end      TEXT NOT NULL,
    node              TEXT NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_orders (
    id                TEXT PRIMARY KEY,
    book_id           TEXT REFERENCES energy_trading_books(id),
    product_id        TEXT REFERENCES energy_products(id),
    side              TEXT NOT NULL CHECK(side IN ('buy','sell')),
    quantity_mw       REAL NOT NULL,
    limit_price       REAL NOT NULL,
    status            TEXT DEFAULT 'working' CHECK(status IN ('working','filled','cancelled','rejected')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_positions (
    id                TEXT PRIMARY KEY,
    book_id           TEXT REFERENCES energy_trading_books(id),
    product_id        TEXT REFERENCES energy_products(id),
    net_mw            REAL NOT NULL,
    vwap_price        REAL NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS energy_settlements (
    id                TEXT PRIMARY KEY,
    book_id           TEXT REFERENCES energy_trading_books(id),
    product_id        TEXT REFERENCES energy_products(id),
    cleared_mw        REAL NOT NULL,
    cleared_price     REAL NOT NULL,
    pnl_usd           REAL NOT NULL,
    settlement_type   TEXT DEFAULT 'DA' CHECK(settlement_type IN ('DA','RT','FTR','REC')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed ─────────────────────────────────────────────────────────────────────

const _bookCount = db.prepare("SELECT COUNT(*) AS n FROM energy_trading_books").get().n;
if (_bookCount === 0) {
  const seed = [
    { id: uuid(), book_name: "Wind Hedge", market: "ERCOT", base_currency: "USD", risk_limit_mw: 80 },
    { id: uuid(), book_name: "Battery Arb", market: "CAISO", base_currency: "USD", risk_limit_mw: 40 },
  ];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO energy_trading_books (id, book_name, market, base_currency, risk_limit_mw) VALUES (@id, @book_name, @market, @base_currency, @risk_limit_mw)"
  );
  for (const b of seed) insert.run(b);
}

function _assertNumber(name, v) {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number`);
  return n;
}

function _getBook(bookName) {
  const b = db.prepare("SELECT * FROM energy_trading_books WHERE book_name = ?").get(bookName);
  if (!b) throw new Error(`Unknown book: ${bookName}`);
  return b;
}

function _isoPlusHours(hours) {
  return new Date(Date.now() + Number(hours) * 3600 * 1000).toISOString();
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function createEnergyProduct(market, productCode, productType, node, deliveryHours = 1) {
  if (!market) throw new Error("market is required");
  if (!productCode) throw new Error("productCode is required");
  if (!node) throw new Error("node is required");

  const id = uuid();
  const start = _isoPlusHours(1);
  const end = _isoPlusHours(1 + (Number(deliveryHours) || 1));

  db.prepare(`
    INSERT INTO energy_products (id, market, product_code, product_type, delivery_start, delivery_end, node)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, market, productCode, productType ?? "DA", start, end, node);

  return db.prepare("SELECT * FROM energy_products WHERE id = ?").get(id);
}

// ─── Orders + Risk ────────────────────────────────────────────────────────────

export function placeEnergyOrder(bookName, productId, side, quantityMw, limitPrice) {
  if (!bookName) throw new Error("bookName is required");
  if (!productId) throw new Error("productId is required");
  if (!side) throw new Error("side is required");

  const book = _getBook(bookName);
  const product = db.prepare("SELECT * FROM energy_products WHERE id = ?").get(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);

  const qty = _assertNumber("quantityMw", quantityMw);
  if (Math.abs(qty) > Number(book.risk_limit_mw)) {
    return {
      status: "rejected",
      reason: `Risk limit exceeded: |${qty}| MW > ${book.risk_limit_mw} MW`,
      book,
      product,
    };
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO energy_orders (id, book_id, product_id, side, quantity_mw, limit_price, status)
    VALUES (?, ?, ?, ?, ?, ?, 'working')
  `).run(id, book.id, productId, side, qty, _assertNumber("limitPrice", limitPrice));

  return db.prepare("SELECT * FROM energy_orders WHERE id = ?").get(id);
}

export function fillEnergyOrder(orderId, clearedPrice) {
  if (!orderId) throw new Error("orderId is required");

  const o = db.prepare("SELECT * FROM energy_orders WHERE id = ?").get(orderId);
  if (!o) throw new Error(`Unknown order: ${orderId}`);
  if (o.status !== "working") return { ...o, note: "Order not working" };

  db.prepare("UPDATE energy_orders SET status = 'filled' WHERE id = ?").run(orderId);

  // Naive position aggregation: one position row per fill for demo.
  const posId = uuid();
  const net = o.side === "buy" ? Number(o.quantity_mw) : -Number(o.quantity_mw);
  db.prepare(
    "INSERT INTO energy_positions (id, book_id, product_id, net_mw, vwap_price) VALUES (?, ?, ?, ?, ?)"
  ).run(posId, o.book_id, o.product_id, net, _assertNumber("clearedPrice", clearedPrice));

  return { ...o, status: "filled", cleared_price: _assertNumber("clearedPrice", clearedPrice) };
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export function settleEnergyProduct(bookName, productId, marketPrice) {
  if (!bookName) throw new Error("bookName is required");
  if (!productId) throw new Error("productId is required");

  const book = _getBook(bookName);
  const product = db.prepare("SELECT * FROM energy_products WHERE id = ?").get(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);

  const positions = db.prepare("SELECT * FROM energy_positions WHERE book_id = ? AND product_id = ?").all(book.id, productId);
  const netMw = positions.reduce((s, p) => s + Number(p.net_mw), 0);
  const avg = positions.length ? positions.reduce((s, p) => s + Number(p.vwap_price) * Math.abs(Number(p.net_mw)), 0) / positions.reduce((s, p) => s + Math.abs(Number(p.net_mw)), 0) : 0;

  const mkt = _assertNumber("marketPrice", marketPrice);
  const pnl = (mkt - avg) * netMw * 1; // $/MWh * MW, simplified

  const id = uuid();
  db.prepare(`
    INSERT INTO energy_settlements (id, book_id, product_id, cleared_mw, cleared_price, pnl_usd, settlement_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, book.id, productId, netMw, mkt, pnl, product.product_type);

  return db.prepare("SELECT * FROM energy_settlements WHERE id = ?").get(id);
}
