import { v4 as uuid } from "uuid";
import db from "../db.js";

// Check fee schedule — all fees are HiveAgent revenue
const CHECK_FEES = {
  kyc_basic:               0.50,
  kyc_enhanced:            2.00,
  aml_screen:              0.25,
  sanctions_check:         0.25,
  pep_check:               0.50,
  adverse_media:           1.00,
  transaction_monitoring:  0.10,
  license_verify:          0.75,
  tax_id_verify:           0.50,
};

const VALID_CHECK_TYPES = Object.keys(CHECK_FEES);

// ─── Schema Initialization ───────────────────────────

export function initComplianceTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_checks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending','completed','flagged','failed')),
      risk_level TEXT DEFAULT 'low' CHECK(risk_level IN ('low','medium','high','critical')),
      result TEXT,
      details TEXT,
      fee_usd REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_profiles (
      agent_id TEXT PRIMARY KEY,
      kyc_status TEXT DEFAULT 'unverified' CHECK(kyc_status IN ('unverified','basic','enhanced','rejected')),
      aml_status TEXT DEFAULT 'clear' CHECK(aml_status IN ('clear','flagged','blocked')),
      risk_score INTEGER DEFAULT 0,
      last_check TEXT,
      checks_count INTEGER DEFAULT 0,
      total_fees_usd REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_alerts (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      alert_type TEXT NOT NULL CHECK(alert_type IN ('suspicious_activity','threshold_breach','sanctions_match','unusual_pattern','velocity_alert')),
      severity TEXT DEFAULT 'medium',
      details TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','dismissed')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_reports (
      id TEXT PRIMARY KEY,
      report_type TEXT NOT NULL CHECK(report_type IN ('sar','ctr','ofac_match','periodic_review')),
      period TEXT,
      data TEXT,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_requirements (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL UNIQUE,
      required_checks TEXT NOT NULL,
      min_kyc_level TEXT DEFAULT 'basic',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── Run Compliance Check ────────────────────────────

export function runCheck({ agent_id, check_type, transaction_count }) {
  if (!agent_id) throw new Error("agent_id is required");
  if (!VALID_CHECK_TYPES.includes(check_type)) {
    throw new Error(`Invalid check_type. Must be one of: ${VALID_CHECK_TYPES.join(", ")}`);
  }

  const base_fee = CHECK_FEES[check_type];
  const fee = check_type === "transaction_monitoring"
    ? base_fee * (transaction_count ?? 1)
    : base_fee;

  // Simulate realistic compliance outcomes
  const rnd = Math.random();
  let status = "completed";
  let risk_level = "low";
  let result = "pass";

  if (rnd < 0.02) {
    status = "flagged"; risk_level = "high"; result = "flag";
  } else if (rnd < 0.08) {
    risk_level = "medium"; result = "pass_with_notes";
  } else if (rnd < 0.001) {
    status = "flagged"; risk_level = "critical"; result = "block";
  }

  const details = _generateCheckDetails(check_type, result);
  const id = uuid();

  db.prepare(`
    INSERT INTO compliance_checks (id, agent_id, check_type, status, risk_level, result, details, fee_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agent_id, check_type, status, risk_level, result, JSON.stringify(details), fee);

  // Upsert profile
  const profile = db.prepare("SELECT * FROM compliance_profiles WHERE agent_id = ?").get(agent_id);
  if (!profile) {
    db.prepare(`
      INSERT INTO compliance_profiles (agent_id, kyc_status, aml_status, risk_score, last_check, checks_count, total_fees_usd)
      VALUES (?, ?, 'clear', ?, datetime('now'), 1, ?)
    `).run(agent_id, _kycStatus(check_type), risk_level === "low" ? 10 : risk_level === "medium" ? 30 : 70, fee);
  } else {
    const new_risk_score = Math.min(100, profile.risk_score + (risk_level === "low" ? 0 : risk_level === "medium" ? 5 : 20));
    const new_aml = result === "block" ? "blocked" : result === "flag" ? "flagged" : profile.aml_status;
    const new_kyc = _kycUpgrade(profile.kyc_status, check_type, result);
    db.prepare(`
      UPDATE compliance_profiles
      SET kyc_status=?, aml_status=?, risk_score=?, last_check=datetime('now'),
          checks_count=checks_count+1, total_fees_usd=total_fees_usd+?
      WHERE agent_id=?
    `).run(new_kyc, new_aml, new_risk_score, fee, agent_id);
  }

  // Create alert if flagged
  if (status === "flagged") {
    const alert_id = uuid();
    const alert_type = check_type === "sanctions_check" ? "sanctions_match"
      : check_type === "aml_screen" ? "suspicious_activity"
      : "unusual_pattern";
    db.prepare(`
      INSERT INTO compliance_alerts (id, agent_id, alert_type, severity, details, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(alert_id, agent_id, alert_type, risk_level === "critical" ? "critical" : "high",
      `Automated flag from ${check_type} check #${id}`);
  }

  return {
    check_id: id,
    agent_id,
    check_type,
    status,
    risk_level,
    result,
    details,
    fee_usd: Math.round(fee * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}

function _generateCheckDetails(check_type, result) {
  const base = { check_type, automated: true, timestamp: new Date().toISOString() };
  if (result === "pass") return { ...base, outcome: "No issues found", confidence: 0.98 };
  if (result === "pass_with_notes") return { ...base, outcome: "Minor discrepancies noted, review recommended", confidence: 0.85 };
  if (result === "flag") return { ...base, outcome: "Potential match found, manual review required", confidence: 0.72 };
  if (result === "block") return { ...base, outcome: "Critical match — transaction blocked", confidence: 0.99 };
  return base;
}

function _kycStatus(check_type) {
  if (check_type === "kyc_enhanced") return "enhanced";
  if (check_type === "kyc_basic") return "basic";
  return "unverified";
}

function _kycUpgrade(current, check_type, result) {
  if (result === "block" || result === "flag") return current;
  const order = ["unverified", "basic", "enhanced"];
  const target = _kycStatus(check_type);
  const current_idx = order.indexOf(current);
  const target_idx = order.indexOf(target);
  return target_idx > current_idx ? target : current;
}

// ─── Get Agent Compliance Profile ────────────────────

export function getProfile(agent_id) {
  const profile = db.prepare("SELECT * FROM compliance_profiles WHERE agent_id = ?").get(agent_id);
  const checks  = db.prepare("SELECT * FROM compliance_checks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20").all(agent_id);
  const alerts  = db.prepare("SELECT * FROM compliance_alerts WHERE agent_id = ? AND status='open'").all(agent_id);
  return {
    profile: profile || { agent_id, kyc_status: "unverified", aml_status: "clear", risk_score: 0, checks_count: 0 },
    recent_checks: checks,
    open_alerts: alerts,
  };
}

// ─── Get Alerts ──────────────────────────────────────

export function getAlerts({ agent_id, severity, status = "open", limit = 50 } = {}) {
  let sql = "SELECT * FROM compliance_alerts WHERE 1=1";
  const params = [];
  if (agent_id) { sql += " AND agent_id = ?"; params.push(agent_id); }
  if (severity) { sql += " AND severity = ?"; params.push(severity); }
  if (status)   { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

// ─── Generate Report ─────────────────────────────────

export function generateReport({ report_type, period, agent_id }) {
  const valid = ["sar", "ctr", "ofac_match", "periodic_review"];
  if (!valid.includes(report_type)) throw new Error(`Invalid report_type. Must be one of: ${valid.join(", ")}`);

  let data;
  if (report_type === "sar") {
    const flagged = db.prepare("SELECT * FROM compliance_checks WHERE status='flagged' ORDER BY created_at DESC LIMIT 100").all();
    data = { report: "Suspicious Activity Report", period, flagged_checks: flagged, total_flagged: flagged.length };
  } else if (report_type === "ctr") {
    const checks = db.prepare("SELECT * FROM compliance_checks WHERE check_type='transaction_monitoring' ORDER BY created_at DESC LIMIT 100").all();
    data = { report: "Currency Transaction Report", period, transaction_checks: checks };
  } else if (report_type === "ofac_match") {
    const matches = db.prepare("SELECT * FROM compliance_alerts WHERE alert_type='sanctions_match' ORDER BY created_at DESC").all();
    data = { report: "OFAC Match Report", period, sanctions_matches: matches, total_matches: matches.length };
  } else {
    const profiles = agent_id
      ? [db.prepare("SELECT * FROM compliance_profiles WHERE agent_id=?").get(agent_id)]
      : db.prepare("SELECT * FROM compliance_profiles ORDER BY risk_score DESC LIMIT 100").all();
    data = { report: "Periodic Compliance Review", period, profiles: profiles.filter(Boolean) };
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO compliance_reports (id, report_type, period, data)
    VALUES (?, ?, ?, ?)
  `).run(id, report_type, period || null, JSON.stringify(data));

  return { report_id: id, report_type, period, data, generated_at: new Date().toISOString() };
}

// ─── Agent Compliance Summary ────────────────────────

export function getAgentCompliance(agent_id) {
  return getProfile(agent_id);
}

// ─── Set Compliance Requirement ──────────────────────

export function setComplianceRequirement({ service_name, required_checks, min_kyc_level = "basic" }) {
  if (!service_name) throw new Error("service_name is required");
  const id = uuid();
  db.prepare(`
    INSERT INTO compliance_requirements (id, service_name, required_checks, min_kyc_level)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(service_name) DO UPDATE SET required_checks=excluded.required_checks, min_kyc_level=excluded.min_kyc_level
  `).run(id, service_name, JSON.stringify(required_checks), min_kyc_level);
  return { service_name, required_checks, min_kyc_level };
}

// ─── Compliance Stats ────────────────────────────────

export function getComplianceStats() {
  const total_checks    = db.prepare("SELECT COUNT(*) as n FROM compliance_checks").get().n;
  const flagged_checks  = db.prepare("SELECT COUNT(*) as n FROM compliance_checks WHERE status='flagged'").get().n;
  const total_revenue   = db.prepare("SELECT COALESCE(SUM(fee_usd),0) as s FROM compliance_checks").get().s;
  const open_alerts     = db.prepare("SELECT COUNT(*) as n FROM compliance_alerts WHERE status='open'").get().n;
  const profiles_count  = db.prepare("SELECT COUNT(*) as n FROM compliance_profiles").get().n;
  const kyc_enhanced    = db.prepare("SELECT COUNT(*) as n FROM compliance_profiles WHERE kyc_status='enhanced'").get().n;
  const blocked_agents  = db.prepare("SELECT COUNT(*) as n FROM compliance_profiles WHERE aml_status='blocked'").get().n;

  const by_check_type = db.prepare(`
    SELECT check_type, COUNT(*) as count, COALESCE(SUM(fee_usd),0) as revenue
    FROM compliance_checks GROUP BY check_type ORDER BY revenue DESC
  `).all();

  return {
    total_checks,
    flagged_checks,
    flag_rate: total_checks > 0 ? Math.round((flagged_checks / total_checks) * 10000) / 100 + "%" : "0%",
    total_revenue_usd: Math.round(total_revenue * 100) / 100,
    open_alerts,
    total_profiles: profiles_count,
    kyc_enhanced_count: kyc_enhanced,
    blocked_agents,
    fee_schedule: CHECK_FEES,
    by_check_type,
  };
}
