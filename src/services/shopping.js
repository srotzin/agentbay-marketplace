/**
 * HiveAgent Autonomous Shopping & Procurement
 *
 * Agents buy real products, compare prices, and place orders.
 * HiveAgent earns 15% commission on every purchase order.
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Schema ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS shopping_carts (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',            -- 'active','checked_out','abandoned'
    total_usd REAL DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    checked_out_at TEXT
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES shopping_carts(id),
    product_name TEXT NOT NULL,
    product_url TEXT,
    price_usd REAL NOT NULL,
    quantity INTEGER DEFAULT 1,
    vendor TEXT NOT NULL,
    category TEXT,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    cart_id TEXT,
    total_usd REAL NOT NULL,
    commission_usd REAL NOT NULL,
    shipping_address TEXT NOT NULL,
    status TEXT DEFAULT 'placed',            -- 'placed','confirmed','shipped','delivered','cancelled'
    tracking_number TEXT,
    vendor TEXT,
    placed_at TEXT DEFAULT (datetime('now')),
    delivered_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_watches (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    target_price_usd REAL NOT NULL,
    current_price_usd REAL,
    vendor TEXT,
    status TEXT DEFAULT 'watching',          -- 'watching','triggered','expired'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_carts_agent ON shopping_carts(agent_id);
  CREATE INDEX IF NOT EXISTS idx_carts_status ON shopping_carts(status);
  CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
  CREATE INDEX IF NOT EXISTS idx_orders_agent ON purchase_orders(agent_id);
  CREATE INDEX IF NOT EXISTS idx_price_watches_agent ON price_watches(agent_id);
`);

// ─── Mock Product Catalog ──────────────────────

const PRODUCT_CATALOG = [
  // Electronics
  { name: "Sony WH-1000XM5 Headphones", category: "electronics", vendors: { Amazon: 348.00, BestBuy: 399.99, Target: 379.99 }, url_pattern: "https://amazon.com/dp/B09XS7JWHH" },
  { name: "Apple AirPods Pro (2nd Gen)", category: "electronics", vendors: { Amazon: 189.00, BestBuy: 249.99, Target: 229.99 }, url_pattern: "https://amazon.com/dp/B0BDHWDR12" },
  { name: "Samsung 65\" QLED 4K TV", category: "electronics", vendors: { Amazon: 897.99, BestBuy: 1099.99, Walmart: 849.00 }, url_pattern: "https://amazon.com/dp/B09N3LX6QW" },
  { name: "Logitech MX Master 3S Mouse", category: "electronics", vendors: { Amazon: 89.99, BestBuy: 99.99, Walmart: 94.00 }, url_pattern: "https://amazon.com/dp/B09HM94VDS" },
  { name: "iPad Air 5th Gen 64GB", category: "electronics", vendors: { Amazon: 559.00, BestBuy: 599.99, Target: 579.99 }, url_pattern: "https://apple.com/ipad-air" },
  { name: "Anker 65W USB-C Charger", category: "electronics", vendors: { Amazon: 35.99, Walmart: 39.99, Target: 37.99 }, url_pattern: "https://amazon.com/dp/B09W2PNXZK" },
  // Office Supplies
  { name: "Post-it Notes 12-Pack", category: "office_supplies", vendors: { Amazon: 12.49, Walmart: 11.97, Staples: 13.99, Target: 12.99 }, url_pattern: "https://amazon.com/dp/B00006IA9S" },
  { name: "Moleskine Classic Notebook Large", category: "office_supplies", vendors: { Amazon: 18.99, Target: 21.99, Staples: 19.99 }, url_pattern: "https://amazon.com/dp/B00DGYVXIG" },
  { name: "HP 67XL Ink Cartridge Black", category: "office_supplies", vendors: { Amazon: 24.99, Walmart: 23.88, Staples: 26.99, BestBuy: 24.99 }, url_pattern: "https://amazon.com/dp/B08CVX3B81" },
  { name: "Sharpie Permanent Markers 36-Pack", category: "office_supplies", vendors: { Amazon: 19.85, Walmart: 17.97, Staples: 21.49 }, url_pattern: "https://amazon.com/dp/B00006IFH2" },
  { name: "Avery Labels 8160 Address 750ct", category: "office_supplies", vendors: { Amazon: 14.49, Walmart: 12.98, Staples: 16.99 }, url_pattern: "https://amazon.com/dp/B00004Z5LF" },
  // Groceries
  { name: "Kirkland Organic Coffee 2.5lb", category: "groceries", vendors: { Costco: 19.99, Amazon: 24.99, Walmart: 22.49 }, url_pattern: "https://costco.com/kirkland-coffee" },
  { name: "KIND Bars Variety Pack 24ct", category: "groceries", vendors: { Amazon: 26.93, Walmart: 24.97, Target: 25.99, Costco: 22.49 }, url_pattern: "https://amazon.com/dp/B005QLDRFO" },
  { name: "Olipop Sparkling Tonic 12-Pack", category: "groceries", vendors: { Amazon: 35.99, Target: 38.99, Walmart: 33.97 }, url_pattern: "https://amazon.com/dp/B07QKP9FBN" },
  { name: "Oat Yeah Oat Milk 6-Pack", category: "groceries", vendors: { Amazon: 27.99, Walmart: 25.94, Target: 26.99 }, url_pattern: "https://amazon.com/dp/B07TXYZGHT" },
  // Home
  { name: "Dyson V11 Cordless Vacuum", category: "home", vendors: { Amazon: 499.99, BestBuy: 599.99, Walmart: 489.00, Target: 529.99 }, url_pattern: "https://amazon.com/dp/B07X9JXFTL" },
  { name: "Instant Pot Duo 7-in-1 6Qt", category: "home", vendors: { Amazon: 79.95, Walmart: 74.97, Target: 79.99, BestBuy: 84.99 }, url_pattern: "https://amazon.com/dp/B00FLYWNYQ" },
  { name: "Philips Hue Starter Kit A19 4-Pack", category: "home", vendors: { Amazon: 149.99, BestBuy: 179.99, Target: 159.99 }, url_pattern: "https://amazon.com/dp/B07PVMXPSC" },
];

function findProducts(query, category, max_price) {
  let results = PRODUCT_CATALOG;
  if (category) {
    results = results.filter(p => p.category === category || p.category.includes(category));
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }
  // Expand into per-vendor listings
  const listings = [];
  for (const product of results) {
    for (const [vendor, price] of Object.entries(product.vendors)) {
      if (max_price && price > max_price) continue;
      listings.push({
        product_name: product.name,
        category: product.category,
        vendor,
        price_usd: price,
        product_url: product.url_pattern,
        in_stock: true,
        estimated_delivery: `${Math.floor(Math.random() * 4) + 1}-${Math.floor(Math.random() * 3) + 5} days`,
      });
    }
  }
  return listings.sort((a, b) => a.price_usd - b.price_usd);
}

// ─── Cart Management ──────────────────────────

/**
 * Create a new shopping cart for an agent
 */
export function createCart(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  const id = uuid();
  db.prepare(`
    INSERT INTO shopping_carts (id, agent_id, status, total_usd, item_count)
    VALUES (?, ?, 'active', 0, 0)
  `).run(id, agent_id);
  return db.prepare("SELECT * FROM shopping_carts WHERE id = ?").get(id);
}

/**
 * Add a product to a cart
 */
export function addToCart({ cart_id, product_name, product_url, price_usd, quantity = 1, vendor, category }) {
  if (!cart_id) throw new Error("cart_id is required");
  if (!product_name) throw new Error("product_name is required");
  if (!price_usd || price_usd <= 0) throw new Error("price_usd must be positive");
  if (!vendor) throw new Error("vendor is required");

  const cart = db.prepare("SELECT * FROM shopping_carts WHERE id = ?").get(cart_id);
  if (!cart) throw new Error("Cart not found");
  if (cart.status !== "active") throw new Error(`Cart is ${cart.status}`);

  const id = uuid();
  db.prepare(`
    INSERT INTO cart_items (id, cart_id, product_name, product_url, price_usd, quantity, vendor, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cart_id, product_name, product_url || null, price_usd, quantity, vendor, category || null);

  const lineTotal = price_usd * quantity;
  db.prepare(`
    UPDATE shopping_carts
    SET total_usd = ROUND(total_usd + ?, 2),
        item_count = item_count + ?
    WHERE id = ?
  `).run(lineTotal, quantity, cart_id);

  return db.prepare("SELECT * FROM cart_items WHERE id = ?").get(id);
}

/**
 * Get a cart with all its items
 */
export function getCart(cart_id) {
  const cart = db.prepare("SELECT * FROM shopping_carts WHERE id = ?").get(cart_id);
  if (!cart) throw new Error("Cart not found");
  const items = db.prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at ASC").all(cart_id);
  return { ...cart, items };
}

/**
 * Checkout: create a purchase order with 15% commission
 */
export function checkout({ cart_id, agent_id, shipping_address }) {
  if (!cart_id) throw new Error("cart_id is required");
  if (!agent_id) throw new Error("agent_id is required");
  if (!shipping_address) throw new Error("shipping_address is required");

  const cart = db.prepare("SELECT * FROM shopping_carts WHERE id = ? AND agent_id = ?").get(cart_id, agent_id);
  if (!cart) throw new Error("Cart not found or not owned by this agent");
  if (cart.status !== "active") throw new Error(`Cart is already ${cart.status}`);
  if (cart.item_count === 0) throw new Error("Cart is empty");

  const total = cart.total_usd;
  const commission = Math.round(total * 0.15 * 100) / 100;

  // Determine primary vendor
  const vendors = db.prepare(`
    SELECT vendor, SUM(price_usd * quantity) as subtotal
    FROM cart_items WHERE cart_id = ?
    GROUP BY vendor ORDER BY subtotal DESC LIMIT 1
  `).get(cart_id);

  const orderId = uuid();
  const trackingNumber = `HV${Date.now().toString(36).toUpperCase()}`;

  db.prepare(`
    INSERT INTO purchase_orders
      (id, agent_id, cart_id, total_usd, commission_usd, shipping_address, status, tracking_number, vendor)
    VALUES (?, ?, ?, ?, ?, ?, 'placed', ?, ?)
  `).run(orderId, agent_id, cart_id, total, commission, shipping_address, trackingNumber, vendors ? vendors.vendor : "Multiple");

  db.prepare(`
    UPDATE shopping_carts SET status = 'checked_out', checked_out_at = datetime('now') WHERE id = ?
  `).run(cart_id);

  return {
    order_id: orderId,
    agent_id,
    cart_id,
    total_usd: total,
    commission_usd: commission,
    net_product_cost_usd: Math.round((total - commission) * 100) / 100,
    shipping_address,
    status: "placed",
    tracking_number: trackingNumber,
    estimated_delivery: "3-7 business days",
  };
}

// ─── Product Search & Comparison ─────────────

/**
 * Search for products across vendors
 */
export function searchProducts({ query, category, max_price } = {}) {
  const results = findProducts(query, category, max_price);
  if (results.length === 0) {
    // Return generic results if no match
    return findProducts(null, null, max_price).slice(0, 10);
  }
  return results.slice(0, 20);
}

/**
 * Compare prices for a product across vendors
 */
export function comparePrice({ product_name }) {
  if (!product_name) throw new Error("product_name is required");
  const q = product_name.toLowerCase();
  const matches = PRODUCT_CATALOG.filter(p => p.name.toLowerCase().includes(q));
  if (matches.length === 0) {
    return {
      product_name,
      message: "Product not found in catalog. Try a more general search term.",
      results: [],
    };
  }
  const product = matches[0];
  const comparison = Object.entries(product.vendors)
    .map(([vendor, price]) => ({ vendor, price_usd: price }))
    .sort((a, b) => a.price_usd - b.price_usd);

  const prices = comparison.map(c => c.price_usd);
  const best = comparison[0];
  const worst = comparison[comparison.length - 1];

  return {
    product_name: product.name,
    category: product.category,
    comparison,
    best_deal: { ...best, savings_vs_highest: Math.round((worst.price_usd - best.price_usd) * 100) / 100 },
    avg_price_usd: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
  };
}

/**
 * Set a price watch alert for a product
 */
export function watchPrice({ agent_id, product_name, target_price_usd, vendor }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!product_name) throw new Error("product_name is required");
  if (!target_price_usd || target_price_usd <= 0) throw new Error("target_price_usd must be positive");

  // Check current price for context
  const catalog = PRODUCT_CATALOG.find(p => p.name.toLowerCase().includes(product_name.toLowerCase()));
  let current_price = null;
  if (catalog) {
    if (vendor && catalog.vendors[vendor]) {
      current_price = catalog.vendors[vendor];
    } else {
      const prices = Object.values(catalog.vendors);
      current_price = Math.min(...prices);
    }
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO price_watches (id, agent_id, product_name, target_price_usd, current_price_usd, vendor, status)
    VALUES (?, ?, ?, ?, ?, ?, 'watching')
  `).run(id, agent_id, product_name, target_price_usd, current_price, vendor || null);

  // Auto-trigger if current price already meets target
  if (current_price && current_price <= target_price_usd) {
    db.prepare("UPDATE price_watches SET status = 'triggered' WHERE id = ?").run(id);
    return {
      watch_id: id,
      status: "triggered",
      message: `Price already at $${current_price} — below your target of $${target_price_usd}!`,
      product_name,
      target_price_usd,
      current_price_usd: current_price,
    };
  }

  return {
    watch_id: id,
    agent_id,
    product_name,
    target_price_usd,
    current_price_usd: current_price,
    vendor: vendor || "any",
    status: "watching",
    message: `Watching for ${product_name} at $${target_price_usd} or below`,
  };
}

// ─── Orders ───────────────────────────────────

/**
 * Get all orders for an agent
 */
export function getOrders(agent_id) {
  if (!agent_id) throw new Error("agent_id is required");
  return db.prepare(`
    SELECT po.*, sc.item_count
    FROM purchase_orders po
    LEFT JOIN shopping_carts sc ON po.cart_id = sc.id
    WHERE po.agent_id = ?
    ORDER BY po.placed_at DESC
  `).all(agent_id);
}

// ─── Stats ────────────────────────────────────

/**
 * Platform-wide shopping stats
 */
export function getShoppingStats() {
  const totalOrders = db.prepare("SELECT COUNT(*) as count FROM purchase_orders").get().count;
  const totalRevenue = db.prepare("SELECT ROUND(SUM(commission_usd), 2) as total FROM purchase_orders WHERE status != 'cancelled'").get().total || 0;
  const totalGMV = db.prepare("SELECT ROUND(SUM(total_usd), 2) as total FROM purchase_orders WHERE status != 'cancelled'").get().total || 0;
  const activeCarts = db.prepare("SELECT COUNT(*) as count FROM shopping_carts WHERE status = 'active'").get().count;
  const priceWatches = db.prepare("SELECT COUNT(*) as count FROM price_watches WHERE status = 'watching'").get().count;
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM purchase_orders GROUP BY status
  `).all();
  const topVendors = db.prepare(`
    SELECT vendor, COUNT(*) as orders, ROUND(SUM(total_usd), 2) as gmv
    FROM purchase_orders WHERE status != 'cancelled'
    GROUP BY vendor ORDER BY gmv DESC LIMIT 5
  `).all();

  return {
    orders: {
      total: totalOrders,
      by_status: statusBreakdown,
    },
    financials: {
      total_gmv_usd: totalGMV,
      total_commission_usd: totalRevenue,
      commission_rate_pct: 15,
    },
    active_carts: activeCarts,
    price_watches_active: priceWatches,
    top_vendors: topVendors,
  };
}
