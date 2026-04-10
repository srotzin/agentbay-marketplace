import { v4 as uuid } from "uuid";
import db from "../db.js";

// Telecom Operations services: network incidents, field dispatch, service provisioning, SLA tracking.

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS telecom_accounts (
    id                TEXT PRIMARY KEY,
    account_name      TEXT NOT NULL,
    industry          TEXT DEFAULT 'enterprise',
    region            TEXT DEFAULT 'NA',
    sla_tier          TEXT DEFAULT 'gold' CHECK(sla_tier IN ('bronze','silver','gold','platinum')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS telecom_circuits (
    id                TEXT PRIMARY KEY,
    account_id        TEXT REFERENCES telecom_accounts(id),
    circuit_id        TEXT NOT NULL,
    circuit_type      TEXT DEFAULT 'internet' CHECK(circuit_type IN ('internet','mpls','sdwan','sip_trunk','wavelength')),
    site_address      TEXT NOT NULL,
    bandwidth_mbps    INTEGER DEFAULT 100,
    status            TEXT DEFAULT 'active' CHECK(status IN ('ordered','provisioning','active','suspended','decommissioned')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS telecom_incidents (
    id                TEXT PRIMARY KEY,
    account_id        TEXT REFERENCES telecom_accounts(id),
    circuit_id        TEXT REFERENCES telecom_circuits(id),
    incident_type     TEXT DEFAULT 'outage' CHECK(incident_type IN ('outage','latency','packet_loss','security','billing')),
    severity          TEXT DEFAULT 'sev3' CHECK(severity IN ('sev1','sev2','sev3','sev4')),
    description       TEXT NOT NULL,
    status            TEXT DEFAULT 'open' CHECK(status IN ('open','acknowledged','in_progress','mitigated','resolved','cancelled')),
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS telecom_dispatch (
    id                TEXT PRIMARY KEY,
    incident_id       TEXT REFERENCES telecom_incidents(id),
    technician        TEXT NOT NULL,
    eta_iso           TEXT NOT NULL,
    dispatch_type     TEXT DEFAULT 'field' CHECK(dispatch_type IN ('field','remote','vendor')),
    status            TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','en_route','on_site','complete','cancelled')),
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed ─────────────────────────────────────────────────────────────────────

const _acctCount = db.prepare("SELECT COUNT(*) AS n FROM telecom_accounts").get().n;
if (_acctCount === 0) {
  const seed = [
    { id: uuid(), account_name: "Blue Peak Retail", industry: "retail", region: "NA", sla_tier: "gold" },
    { id: uuid(), account_name: "Northwind Health", industry: "healthcare", region: "EU", sla_tier: "platinum" },
  ];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO telecom_accounts (id, account_name, industry, region, sla_tier) VALUES (@id, @account_name, @industry, @region, @sla_tier)"
  );
  for (const a of seed) insert.run(a);
}

function _isoPlusMinutes(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

function _getAccount(accountName) {
  const acct = db.prepare("SELECT * FROM telecom_accounts WHERE account_name = ?").get(accountName);
  if (!acct) throw new Error(`Unknown account: ${accountName}`);
  return acct;
}

function _getCircuitByCircuitId(circuitId) {
  const c = db.prepare("SELECT * FROM telecom_circuits WHERE circuit_id = ?").get(circuitId);
  if (!c) throw new Error(`Unknown circuit_id: ${circuitId}`);
  return c;
}

// ─── Service Provisioning ─────────────────────────────────────────────────────

export function orderTelecomCircuit(accountName, circuitId, circuitType, siteAddress, bandwidthMbps = 100) {
  if (!accountName) throw new Error("accountName is required");
  if (!circuitId) throw new Error("circuitId is required");
  if (!siteAddress) throw new Error("siteAddress is required");

  const acct = _getAccount(accountName);
  const id = uuid();

  db.prepare(`
    INSERT INTO telecom_circuits (id, account_id, circuit_id, circuit_type, site_address, bandwidth_mbps, status)
    VALUES (?, ?, ?, ?, ?, ?, 'ordered')
  `).run(id, acct.id, circuitId, circuitType ?? "internet", siteAddress, Number(bandwidthMbps) || 100);

  return db.prepare("SELECT * FROM telecom_circuits WHERE id = ?").get(id);
}

export function updateTelecomCircuitStatus(circuitId, status) {
  if (!circuitId) throw new Error("circuitId is required");
  if (!status) throw new Error("status is required");

  const c = _getCircuitByCircuitId(circuitId);
  db.prepare("UPDATE telecom_circuits SET status = ? WHERE id = ?").run(status, c.id);
  return { ...c, status };
}

// ─── Incident Management ──────────────────────────────────────────────────────

export function fileTelecomIncident(accountName, circuitId, incidentType, severity, description) {
  if (!accountName) throw new Error("accountName is required");
  if (!description) throw new Error("description is required");

  const acct = _getAccount(accountName);
  const circuit = circuitId ? _getCircuitByCircuitId(circuitId) : null;

  const id = uuid();
  db.prepare(`
    INSERT INTO telecom_incidents (id, account_id, circuit_id, incident_type, severity, description, status)
    VALUES (?, ?, ?, ?, ?, ?, 'open')
  `).run(id, acct.id, circuit?.id ?? null, incidentType ?? "outage", severity ?? "sev3", description);

  return db.prepare("SELECT * FROM telecom_incidents WHERE id = ?").get(id);
}

export function acknowledgeTelecomIncident(incidentId) {
  if (!incidentId) throw new Error("incidentId is required");
  const inc = db.prepare("SELECT * FROM telecom_incidents WHERE id = ?").get(incidentId);
  if (!inc) throw new Error(`Unknown incident: ${incidentId}`);

  db.prepare("UPDATE telecom_incidents SET status = 'acknowledged' WHERE id = ?").run(incidentId);
  return { ...inc, status: "acknowledged" };
}

export function resolveTelecomIncident(incidentId, status = "resolved") {
  if (!incidentId) throw new Error("incidentId is required");
  const inc = db.prepare("SELECT * FROM telecom_incidents WHERE id = ?").get(incidentId);
  if (!inc) throw new Error(`Unknown incident: ${incidentId}`);

  db.prepare("UPDATE telecom_incidents SET status = ? WHERE id = ?").run(status, incidentId);
  return { ...inc, status };
}

// ─── Field Dispatch ───────────────────────────────────────────────────────────

export function scheduleTelecomDispatch(incidentId, technician, etaMinutes = 90, dispatchType = "field") {
  if (!incidentId) throw new Error("incidentId is required");
  if (!technician) throw new Error("technician is required");

  const inc = db.prepare("SELECT * FROM telecom_incidents WHERE id = ?").get(incidentId);
  if (!inc) throw new Error(`Unknown incident: ${incidentId}`);

  const id = uuid();
  const etaIso = _isoPlusMinutes(Number(etaMinutes) || 90);

  db.prepare(`
    INSERT INTO telecom_dispatch (id, incident_id, technician, eta_iso, dispatch_type, status)
    VALUES (?, ?, ?, ?, ?, 'scheduled')
  `).run(id, incidentId, technician, etaIso, dispatchType);

  return db.prepare("SELECT * FROM telecom_dispatch WHERE id = ?").get(id);
}

export function updateDispatchStatus(dispatchId, status) {
  if (!dispatchId) throw new Error("dispatchId is required");
  if (!status) throw new Error("status is required");

  const d = db.prepare("SELECT * FROM telecom_dispatch WHERE id = ?").get(dispatchId);
  if (!d) throw new Error(`Unknown dispatch: ${dispatchId}`);

  db.prepare("UPDATE telecom_dispatch SET status = ? WHERE id = ?").run(status, dispatchId);
  return { ...d, status };
}
