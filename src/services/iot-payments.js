import { v4 as uuid } from "uuid";
import db from "../db.js";

const IOT_COMMISSION_RATE = 0.03; // 3% of every IoT transaction

// ─── Schema Initialization ───────────────────────────

export function initIoTTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS iot_devices (
      id TEXT PRIMARY KEY,
      owner_agent_id TEXT,
      device_type TEXT NOT NULL CHECK(device_type IN ('ev_charger','smart_appliance','drone','autonomous_vehicle','sensor','robot','vending_machine','meter')),
      name TEXT,
      location TEXT,
      wallet_address TEXT,
      rate_usd REAL,
      rate_unit TEXT CHECK(rate_unit IN ('per_kwh','per_minute','per_use','per_kg','per_km')),
      status TEXT DEFAULT 'online' CHECK(status IN ('online','offline','maintenance')),
      total_earned_usd REAL DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS iot_transactions (
      id TEXT PRIMARY KEY,
      device_id TEXT REFERENCES iot_devices(id),
      payer_agent_id TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      quantity REAL,
      unit TEXT,
      fee_usd REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS iot_subscriptions (
      id TEXT PRIMARY KEY,
      device_id TEXT,
      subscriber_agent_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      price_usd_monthly REAL NOT NULL,
      data_points_included INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  _seedDevices();
}

function _seedDevices() {
  const count = db.prepare("SELECT COUNT(*) as n FROM iot_devices").get()?.n ?? 0;
  if (count > 0) return;

  const devices = [
    { device_type: "ev_charger",         name: "EV Charger Station Alpha",   location: "San Francisco, CA",   rate_usd: 0.15,  rate_unit: "per_kwh"    },
    { device_type: "smart_appliance",    name: "Smart Fridge Hub",            location: "Austin, TX",          rate_usd: 0.50,  rate_unit: "per_use"    },
    { device_type: "drone",             name: "Drone Delivery Network",      location: "Seattle, WA",         rate_usd: 2.00,  rate_unit: "per_km"     },
    { device_type: "autonomous_vehicle", name: "Autonomous Taxi Fleet",       location: "Phoenix, AZ",         rate_usd: 1.50,  rate_unit: "per_km"     },
    { device_type: "sensor",            name: "Weather Sensor Array",        location: "Denver, CO",          rate_usd: 0.001, rate_unit: "per_use"    },
    { device_type: "robot",             name: "Industrial Robot Arm",        location: "Detroit, MI",         rate_usd: 5.00,  rate_unit: "per_minute" },
    { device_type: "meter",             name: "Smart Parking Meter",         location: "Chicago, IL",         rate_usd: 0.10,  rate_unit: "per_minute" },
    { device_type: "sensor",            name: "Solar Panel Array",           location: "Las Vegas, NV",       rate_usd: 0.08,  rate_unit: "per_kwh"    },
    { device_type: "drone",             name: "Agricultural Drone",          location: "Fresno, CA",          rate_usd: 3.00,  rate_unit: "per_use"    },
    { device_type: "sensor",            name: "Security Camera Network",     location: "New York, NY",        rate_usd: 0.005, rate_unit: "per_use"    },
  ];

  const insert = db.prepare(`
    INSERT INTO iot_devices (id, owner_agent_id, device_type, name, location, rate_usd, rate_unit, status)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 'online')
  `);
  for (const d of devices) {
    insert.run(uuid(), d.device_type, d.name, d.location, d.rate_usd, d.rate_unit);
  }
}

// ─── Device Registration ─────────────────────────────

export function registerDevice({
  owner_agent_id,
  device_type,
  name,
  location,
  wallet_address,
  rate_usd,
  rate_unit,
}) {
  if (!device_type) throw new Error("device_type is required");
  const id = uuid();
  db.prepare(`
    INSERT INTO iot_devices (id, owner_agent_id, device_type, name, location, wallet_address, rate_usd, rate_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, owner_agent_id || null, device_type, name || null, location || null, wallet_address || null, rate_usd ?? null, rate_unit || null);
  return { id, device_type, name, rate_usd, rate_unit, status: "online" };
}

// ─── Device Payment ──────────────────────────────────

export function payDevice({ device_id, payer_agent_id, quantity, metadata }) {
  const device = db.prepare("SELECT * FROM iot_devices WHERE id = ?").get(device_id);
  if (!device) throw new Error(`Device ${device_id} not found`);
  if (device.status !== "online") throw new Error(`Device ${device_id} is ${device.status}`);

  const q = quantity ?? 1;
  const gross = (device.rate_usd ?? 0) * q;
  const fee = Math.round(gross * IOT_COMMISSION_RATE * 1e6) / 1e6;
  const id = uuid();

  db.prepare(`
    INSERT INTO iot_transactions (id, device_id, payer_agent_id, amount_usd, quantity, unit, fee_usd, status, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).run(id, device_id, payer_agent_id, gross, q, device.rate_unit || null, fee, metadata ? JSON.stringify(metadata) : null);

  db.prepare(`
    UPDATE iot_devices SET total_earned_usd = total_earned_usd + ?, total_transactions = total_transactions + 1 WHERE id = ?
  `).run(gross, device_id);

  return {
    transaction_id: id,
    device_id,
    device_name: device.name,
    payer_agent_id,
    quantity: q,
    unit: device.rate_unit,
    amount_usd: gross,
    fee_usd: fee,
    net_to_device_usd: Math.round((gross - fee) * 1e6) / 1e6,
    status: "completed",
  };
}

// ─── Device Subscription ─────────────────────────────

export function subscribeToDevice({
  device_id,
  subscriber_agent_id,
  plan,
  price_usd_monthly,
  data_points_included,
}) {
  const id = uuid();
  db.prepare(`
    INSERT INTO iot_subscriptions (id, device_id, subscriber_agent_id, plan, price_usd_monthly, data_points_included)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, device_id || null, subscriber_agent_id, plan, price_usd_monthly, data_points_included ?? null);
  return { id, device_id, subscriber_agent_id, plan, price_usd_monthly, status: "active" };
}

// ─── Device Lookup ───────────────────────────────────

export function getDevice(id) {
  const device = db.prepare("SELECT * FROM iot_devices WHERE id = ?").get(id);
  if (!device) throw new Error(`Device ${id} not found`);
  const recent = db.prepare("SELECT * FROM iot_transactions WHERE device_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
  return { ...device, recent_transactions: recent };
}

// ─── Device Search ───────────────────────────────────

export function searchDevices({ device_type, location, max_rate, status, limit = 20, offset = 0 }) {
  let sql = "SELECT * FROM iot_devices WHERE 1=1";
  const params = [];

  if (device_type) { sql += " AND device_type = ?"; params.push(device_type); }
  if (location)    { sql += " AND location LIKE ?"; params.push(`%${location}%`); }
  if (max_rate != null) { sql += " AND rate_usd <= ?"; params.push(max_rate); }
  if (status)      { sql += " AND status = ?"; params.push(status); }

  sql += " ORDER BY total_transactions DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const devices = db.prepare(sql).all(...params);
  return { devices, count: devices.length, limit, offset };
}

// ─── Agent Devices ───────────────────────────────────

export function getAgentDevices(owner_agent_id) {
  const devices = db.prepare("SELECT * FROM iot_devices WHERE owner_agent_id = ? ORDER BY created_at DESC").all(owner_agent_id);
  const subscriptions = db.prepare("SELECT * FROM iot_subscriptions WHERE subscriber_agent_id = ? AND status = 'active'").all(owner_agent_id);
  const payments = db.prepare("SELECT * FROM iot_transactions WHERE payer_agent_id = ? ORDER BY created_at DESC LIMIT 20").all(owner_agent_id);
  return { owned_devices: devices, subscriptions, recent_payments: payments };
}

// ─── IoT Stats ───────────────────────────────────────

export function getIoTStats() {
  const total_devices      = db.prepare("SELECT COUNT(*) as n FROM iot_devices").get().n;
  const online_devices     = db.prepare("SELECT COUNT(*) as n FROM iot_devices WHERE status = 'online'").get().n;
  const total_transactions = db.prepare("SELECT COUNT(*) as n FROM iot_transactions").get().n;
  const total_volume       = db.prepare("SELECT COALESCE(SUM(amount_usd),0) as s FROM iot_transactions").get().s;
  const total_fees         = db.prepare("SELECT COALESCE(SUM(fee_usd),0) as s FROM iot_transactions").get().s;
  const active_subs        = db.prepare("SELECT COUNT(*) as n FROM iot_subscriptions WHERE status='active'").get().n;

  const by_type = db.prepare(`
    SELECT device_type, COUNT(*) as count, COALESCE(SUM(total_earned_usd),0) as earned
    FROM iot_devices GROUP BY device_type ORDER BY earned DESC
  `).all();

  return {
    total_devices,
    online_devices,
    total_transactions,
    total_volume_usd: Math.round(total_volume * 100) / 100,
    total_fees_usd: Math.round(total_fees * 100) / 100,
    active_subscriptions: active_subs,
    commission_rate: `${IOT_COMMISSION_RATE * 100}%`,
    devices_by_type: by_type,
  };
}
