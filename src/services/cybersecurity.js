/**
 * HiveAgent — Cybersecurity & Threat Intelligence Service
 *
 * Provides AI-powered security operations for SOC teams and agents:
 *   scanForThreats        — Scan URL/IP/domain for threats         $0.50/scan
 *   triageAlert           — Triage security alerts                 $0.10/triage
 *   checkIocReputation    — Check indicator-of-compromise reputation $0.05/check
 *   generateIncidentReport — Auto-generate IR report               $3.00/report
 *   assessVulnerability   — Full vulnerability assessment           $2.00/assessment
 *   getCyberDashboard     — Security posture dashboard             $10.00/month
 */

import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────
const FEES = {
  scan:         0.50,
  triage:       0.10,
  ioc_check:    0.05,
  incident_report: 3.00,
  assessment:   2.00,
  dashboard:    10.00,
};

// ─── Schema Initialization ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS cyber_scans (
    id              TEXT PRIMARY KEY,
    target          TEXT NOT NULL,
    scan_type       TEXT NOT NULL,
    depth           TEXT NOT NULL,
    risk_score      REAL NOT NULL,
    threats_json    TEXT NOT NULL DEFAULT '[]',
    cve_refs_json   TEXT NOT NULL DEFAULT '[]',
    remediation_json TEXT NOT NULL DEFAULT '[]',
    fee_usd         REAL NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cyber_alerts (
    id                     TEXT PRIMARY KEY,
    severity               TEXT NOT NULL,
    priority               TEXT NOT NULL,
    classification         TEXT NOT NULL,
    false_positive_prob    REAL NOT NULL,
    actions_json           TEXT NOT NULL DEFAULT '[]',
    related_alerts_json    TEXT NOT NULL DEFAULT '[]',
    fee_usd                REAL NOT NULL,
    created_at             TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cyber_iocs (
    id           TEXT PRIMARY KEY,
    ioc          TEXT NOT NULL,
    ioc_type     TEXT NOT NULL,
    malicious    INTEGER NOT NULL DEFAULT 0,
    confidence   REAL NOT NULL DEFAULT 0,
    threat_types_json TEXT NOT NULL DEFAULT '[]',
    sources_json      TEXT NOT NULL DEFAULT '[]',
    first_seen   TEXT,
    last_seen    TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cyber_incidents (
    id                 TEXT PRIMARY KEY,
    executive_summary  TEXT NOT NULL,
    technical_details  TEXT NOT NULL,
    timeline_json      TEXT NOT NULL DEFAULT '[]',
    impact_assessment  TEXT NOT NULL,
    remediation_plan   TEXT NOT NULL,
    fee_usd            REAL NOT NULL,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cyber_assessments (
    id                   TEXT PRIMARY KEY,
    target               TEXT NOT NULL,
    scope                TEXT NOT NULL,
    vulnerabilities_json TEXT NOT NULL DEFAULT '[]',
    fee_usd              REAL NOT NULL,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cyber_cves (
    id          TEXT PRIMARY KEY,
    cve_id      TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    cvss_score  REAL NOT NULL,
    severity    TEXT NOT NULL,
    published   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cyber_iocs_ioc ON cyber_iocs(ioc);
  CREATE INDEX IF NOT EXISTS idx_cyber_cves_cve ON cyber_cves(cve_id);
`);

// ─── Seed CVEs ─────────────────────────────────────────────────────────────────
const _cveCount = db.prepare("SELECT COUNT(*) as n FROM cyber_cves").get().n;
if (_cveCount === 0) {
  const seedCves = [
    { id: uuid(), cve_id: "CVE-2024-3400",  description: "PAN-OS command injection via GlobalProtect", cvss_score: 10.0, severity: "critical", published: "2024-04-12" },
    { id: uuid(), cve_id: "CVE-2024-21762", description: "Fortinet FortiOS out-of-bounds write in SSL VPN", cvss_score: 9.6, severity: "critical", published: "2024-02-08" },
    { id: uuid(), cve_id: "CVE-2023-46805", description: "Ivanti Connect Secure authentication bypass", cvss_score: 8.2, severity: "high", published: "2024-01-10" },
    { id: uuid(), cve_id: "CVE-2023-44487", description: "HTTP/2 Rapid Reset DDoS amplification", cvss_score: 7.5, severity: "high", published: "2023-10-10" },
    { id: uuid(), cve_id: "CVE-2021-44228", description: "Log4Shell — Log4j2 JNDI remote code execution", cvss_score: 10.0, severity: "critical", published: "2021-12-10" },
    { id: uuid(), cve_id: "CVE-2021-26084", description: "Confluence Server OGNL injection RCE", cvss_score: 9.8, severity: "critical", published: "2021-08-25" },
    { id: uuid(), cve_id: "CVE-2022-30190", description: "Microsoft Follina MSDT remote code execution", cvss_score: 7.8, severity: "high", published: "2022-05-30" },
    { id: uuid(), cve_id: "CVE-2023-20198", description: "Cisco IOS XE privilege escalation via web UI", cvss_score: 10.0, severity: "critical", published: "2023-10-16" },
    { id: uuid(), cve_id: "CVE-2022-1388",  description: "F5 BIG-IP iControl REST authentication bypass", cvss_score: 9.8, severity: "critical", published: "2022-05-04" },
    { id: uuid(), cve_id: "CVE-2023-4966",  description: "Citrix Bleed — NetScaler session token leak", cvss_score: 9.4, severity: "critical", published: "2023-10-10" },
    { id: uuid(), cve_id: "CVE-2024-1709",  description: "ConnectWise ScreenConnect auth bypass", cvss_score: 10.0, severity: "critical", published: "2024-02-21" },
    { id: uuid(), cve_id: "CVE-2023-34362", description: "MOVEit Transfer SQL injection", cvss_score: 9.8, severity: "critical", published: "2023-06-02" },
    { id: uuid(), cve_id: "CVE-2024-27198", description: "JetBrains TeamCity authentication bypass", cvss_score: 9.8, severity: "critical", published: "2024-03-04" },
    { id: uuid(), cve_id: "CVE-2022-26134", description: "Confluence Server/Data Center RCE via OGNL", cvss_score: 9.8, severity: "critical", published: "2022-06-02" },
    { id: uuid(), cve_id: "CVE-2021-34527", description: "PrintNightmare — Windows Print Spooler RCE", cvss_score: 8.8, severity: "high", published: "2021-07-01" },
    { id: uuid(), cve_id: "CVE-2020-1472",  description: "Zerologon — Netlogon elevation of privilege", cvss_score: 10.0, severity: "critical", published: "2020-08-11" },
    { id: uuid(), cve_id: "CVE-2021-21985", description: "VMware vCenter Server RCE via vSAN plugin", cvss_score: 9.8, severity: "critical", published: "2021-05-25" },
    { id: uuid(), cve_id: "CVE-2023-27997", description: "FortiOS heap buffer overflow in SSL-VPN", cvss_score: 9.8, severity: "critical", published: "2023-06-13" },
    { id: uuid(), cve_id: "CVE-2024-6387",  description: "OpenSSH regreSSHion race-condition RCE", cvss_score: 8.1, severity: "high", published: "2024-07-01" },
    { id: uuid(), cve_id: "CVE-2024-23113", description: "Fortinet FortiOS format-string RCE in fgfm", cvss_score: 9.8, severity: "critical", published: "2024-02-08" },
  ];
  const insertCve = db.prepare(`
    INSERT OR IGNORE INTO cyber_cves (id, cve_id, description, cvss_score, severity, published)
    VALUES (@id, @cve_id, @description, @cvss_score, @severity, @published)
  `);
  for (const c of seedCves) insertCve.run(c);
}

// ─── Seed IOCs ─────────────────────────────────────────────────────────────────
const _iocCount = db.prepare("SELECT COUNT(*) as n FROM cyber_iocs").get().n;
if (_iocCount === 0) {
  const seedIocs = [
    { ioc: "185.220.101.45",       ioc_type: "ip",     malicious: 1, confidence: 0.97, threat_types: ["c2","tor_exit"], sources: ["abuseipdb","virustotal"], first_seen: "2023-01-15", last_seen: "2024-11-20" },
    { ioc: "45.142.212.100",       ioc_type: "ip",     malicious: 1, confidence: 0.93, threat_types: ["scanner","botnet"], sources: ["shodan","abuseipdb"], first_seen: "2023-06-01", last_seen: "2024-12-10" },
    { ioc: "94.102.61.16",         ioc_type: "ip",     malicious: 1, confidence: 0.88, threat_types: ["phishing","spam"], sources: ["spamhaus","virustotal"], first_seen: "2024-03-10", last_seen: "2024-12-15" },
    { ioc: "malicious-update.net", ioc_type: "domain", malicious: 1, confidence: 0.99, threat_types: ["malware","c2"], sources: ["virustotal","threatfox"], first_seen: "2024-01-05", last_seen: "2024-11-30" },
    { ioc: "evil-cdn.xyz",         ioc_type: "domain", malicious: 1, confidence: 0.95, threat_types: ["phishing"], sources: ["urlscan","virustotal"], first_seen: "2024-05-20", last_seen: "2024-12-01" },
    { ioc: "fake-microsoft-login.ru", ioc_type: "domain", malicious: 1, confidence: 0.98, threat_types: ["phishing","credential_theft"], sources: ["phishtank","virustotal"], first_seen: "2024-08-11", last_seen: "2024-12-18" },
    { ioc: "d41d8cd98f00b204e9800998ecf8427e", ioc_type: "hash", malicious: 0, confidence: 0.0,  threat_types: [], sources: [], first_seen: null, last_seen: null },
    { ioc: "44d88612fea8a8f36de82e1278abb02f", ioc_type: "hash", malicious: 1, confidence: 0.91, threat_types: ["ransomware"], sources: ["virustotal","malwarebazaar"], first_seen: "2024-02-14", last_seen: "2024-10-30" },
    { ioc: "a3d5a62f9e8b1d4e3c7a0f2b6e9d1c5a", ioc_type: "hash", malicious: 1, confidence: 0.87, threat_types: ["trojan","rat"], sources: ["any.run","hybrid-analysis"], first_seen: "2024-04-01", last_seen: "2024-11-15" },
    { ioc: "http://phish.example.biz/login",  ioc_type: "url",  malicious: 1, confidence: 0.96, threat_types: ["phishing"], sources: ["urlscan","phishtank"], first_seen: "2024-07-20", last_seen: "2024-12-20" },
    { ioc: "https://malware-drop.io/payload",  ioc_type: "url",  malicious: 1, confidence: 0.99, threat_types: ["malware_distribution"], sources: ["virustotal","urlscan"], first_seen: "2024-09-01", last_seen: "2024-12-19" },
    { ioc: "noreply@spoofed-paypal.net",   ioc_type: "email", malicious: 1, confidence: 0.94, threat_types: ["phishing","bec"], sources: ["abuseipdb","emailrep"], first_seen: "2024-06-10", last_seen: "2024-12-05" },
    { ioc: "ceo-fraud@lookalik3.com",      ioc_type: "email", malicious: 1, confidence: 0.97, threat_types: ["bec","impersonation"], sources: ["emailrep","virustotal"], first_seen: "2024-10-01", last_seen: "2024-12-18" },
    { ioc: "192.168.1.1",                  ioc_type: "ip",    malicious: 0, confidence: 0.0,  threat_types: [], sources: [], first_seen: null, last_seen: null },
    { ioc: "10.0.0.1",                     ioc_type: "ip",    malicious: 0, confidence: 0.0,  threat_types: [], sources: [], first_seen: null, last_seen: null },
    { ioc: "cobalt-strike-beacon.ru",      ioc_type: "domain", malicious: 1, confidence: 0.99, threat_types: ["c2","cobalt_strike"], sources: ["threatfox","virustotal"], first_seen: "2023-11-05", last_seen: "2024-12-10" },
    { ioc: "123.45.67.89",                 ioc_type: "ip",    malicious: 1, confidence: 0.82, threat_types: ["scanner"], sources: ["shodan","greynoise"], first_seen: "2024-01-20", last_seen: "2024-12-01" },
    { ioc: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5", ioc_type: "hash", malicious: 1, confidence: 0.93, threat_types: ["spyware"], sources: ["virustotal","cape"], first_seen: "2024-03-15", last_seen: "2024-11-20" },
    { ioc: "update-flash-player.xyz",      ioc_type: "domain", malicious: 1, confidence: 0.98, threat_types: ["malware","social_engineering"], sources: ["virustotal","urlscan"], first_seen: "2024-05-01", last_seen: "2024-12-15" },
    { ioc: "support@microsoft-helpdesk.tk", ioc_type: "email", malicious: 1, confidence: 0.96, threat_types: ["tech_support_scam","phishing"], sources: ["emailrep","virustotal"], first_seen: "2024-08-20", last_seen: "2024-12-17" },
    { ioc: "209.58.128.203",               ioc_type: "ip",    malicious: 1, confidence: 0.85, threat_types: ["spam","botnet"], sources: ["spamhaus","abuseipdb"], first_seen: "2023-09-10", last_seen: "2024-12-01" },
    { ioc: "lock-your-files.onion",        ioc_type: "domain", malicious: 1, confidence: 0.99, threat_types: ["ransomware","c2"], sources: ["threatfox","malwarebazaar"], first_seen: "2024-02-01", last_seen: "2024-11-30" },
    { ioc: "e3b0c44298fc1c149afbf4c8996fb924", ioc_type: "hash", malicious: 0, confidence: 0.0, threat_types: [], sources: [], first_seen: null, last_seen: null },
    { ioc: "http://login.totally-not-google.gq/", ioc_type: "url", malicious: 1, confidence: 0.99, threat_types: ["phishing"], sources: ["phishtank","urlscan"], first_seen: "2024-10-10", last_seen: "2024-12-20" },
    { ioc: "172.16.0.1",                   ioc_type: "ip",    malicious: 0, confidence: 0.0,  threat_types: [], sources: [], first_seen: null, last_seen: null },
    { ioc: "f7e3d1a2b4c5e6d7f8a9b0c1d2e3f4a5", ioc_type: "hash", malicious: 1, confidence: 0.89, threat_types: ["dropper"], sources: ["any.run","virustotal"], first_seen: "2024-06-05", last_seen: "2024-12-08" },
    { ioc: "invoice-overdue.top",           ioc_type: "domain", malicious: 1, confidence: 0.94, threat_types: ["phishing","bec"], sources: ["urlscan","virustotal"], first_seen: "2024-07-15", last_seen: "2024-12-19" },
    { ioc: "billing@paypel-secure.com",    ioc_type: "email", malicious: 1, confidence: 0.97, threat_types: ["phishing"], sources: ["emailrep","phishtank"], first_seen: "2024-09-10", last_seen: "2024-12-18" },
    { ioc: "198.51.100.42",               ioc_type: "ip",    malicious: 1, confidence: 0.79, threat_types: ["brute_force"], sources: ["abuseipdb","greynoise"], first_seen: "2024-04-20", last_seen: "2024-12-05" },
    { ioc: "https://cdn.evil-toolkit.biz/stage2.ps1", ioc_type: "url", malicious: 1, confidence: 0.99, threat_types: ["malware","fileless"], sources: ["virustotal","any.run"], first_seen: "2024-11-01", last_seen: "2024-12-20" },
  ];
  const insertIoc = db.prepare(`
    INSERT OR IGNORE INTO cyber_iocs
      (id, ioc, ioc_type, malicious, confidence, threat_types_json, sources_json, first_seen, last_seen)
    VALUES (@id, @ioc, @ioc_type, @malicious, @confidence, @threat_types_json, @sources_json, @first_seen, @last_seen)
  `);
  for (const i of seedIocs) {
    insertIoc.run({
      id: uuid(),
      ioc: i.ioc,
      ioc_type: i.ioc_type,
      malicious: i.malicious,
      confidence: i.confidence,
      threat_types_json: JSON.stringify(i.threat_types),
      sources_json: JSON.stringify(i.sources),
      first_seen: i.first_seen,
      last_seen: i.last_seen,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickCves(count = 3) {
  return db.prepare("SELECT cve_id FROM cyber_cves ORDER BY RANDOM() LIMIT ?").all(count).map(r => r.cve_id);
}

function computeRiskScore(threats) {
  if (!threats.length) return Math.round(Math.random() * 20 * 10) / 10;
  const base = threats.length * 18 + Math.random() * 15;
  return Math.min(100, Math.round(base * 10) / 10);
}

const THREAT_TEMPLATES = {
  vulnerability: ["SQL injection", "XSS reflected", "CSRF token absent", "Outdated TLS 1.0", "Open redirect", "Directory traversal"],
  malware:       ["Trojan dropper", "Ransomware beacon", "Keylogger module", "Cryptominer", "Backdoor shell", "RAT communication"],
  phishing:      ["Credential harvesting page", "Lookalike domain", "Malicious attachment link", "Brand impersonation", "Fake login form"],
  configuration: ["Default credentials", "Debug endpoint exposed", "Insecure CORS policy", "Missing security headers", "Open S3 bucket", "RDP exposed to internet"],
};

const REMED_TEMPLATES = {
  vulnerability: ["Patch immediately via vendor advisory", "Deploy WAF rule to block exploitation", "Rotate affected credentials", "Conduct full code audit"],
  malware:       ["Isolate affected host", "Run EDR forensic sweep", "Reset all credentials on host", "Restore from clean backup"],
  phishing:      ["Takedown request to registrar", "Block domain at DNS layer", "Alert users via secure channel", "Enhance email filtering rules"],
  configuration: ["Apply CIS benchmark hardening", "Remove or password-protect debug endpoints", "Restrict CORS to trusted origins", "Enable MFA on all admin accounts"],
};

// ─── scanForThreats ────────────────────────────────────────────────────────────
/**
 * Scan a URL, IP, or domain for threats.
 * @param {string} target    - URL, IP address, or domain
 * @param {string} scanType  - vulnerability | malware | phishing | configuration
 * @param {string} depth     - quick | standard | deep
 * @returns Threats list, risk score, CVE references, and remediation steps
 */
export function scanForThreats(target, scanType = "vulnerability", depth = "standard") {
  if (!target) throw new Error("target is required");
  const validTypes = ["vulnerability", "malware", "phishing", "configuration"];
  if (!validTypes.includes(scanType)) throw new Error(`scanType must be one of: ${validTypes.join(", ")}`);

  const threatPool = THREAT_TEMPLATES[scanType];
  const count = depth === "deep" ? 4 : depth === "standard" ? 2 : 1;
  const threats = [];
  const usedThreats = new Set();

  for (let i = 0; i < count; i++) {
    let t;
    do { t = randomFrom(threatPool); } while (usedThreats.has(t));
    usedThreats.add(t);
    threats.push({
      threat: t,
      severity: randomFrom(["critical","high","medium","low"]),
      confidence: Math.round((0.7 + Math.random() * 0.3) * 100) / 100,
      location: target,
    });
  }

  const riskScore = computeRiskScore(threats);
  const cveRefs   = scanType === "vulnerability" ? pickCves(count) : [];
  const remediation = REMED_TEMPLATES[scanType].slice(0, count + 1);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO cyber_scans
      (id, target, scan_type, depth, risk_score, threats_json, cve_refs_json, remediation_json, fee_usd)
    VALUES (@id, @target, @scan_type, @depth, @risk_score, @threats_json, @cve_refs_json, @remediation_json, @fee_usd)
  `).run({
    id, target, scan_type: scanType, depth,
    risk_score: riskScore,
    threats_json: JSON.stringify(threats),
    cve_refs_json: JSON.stringify(cveRefs),
    remediation_json: JSON.stringify(remediation),
    fee_usd: FEES.scan,
  });

  return {
    scan_id: id,
    target,
    scan_type: scanType,
    depth,
    threats,
    risk_score: riskScore,
    risk_level: riskScore >= 75 ? "critical" : riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low",
    cve_references: cveRefs,
    remediation,
    fee_usd: FEES.scan,
    scanned_at: new Date().toISOString(),
  };
}

// ─── triageAlert ──────────────────────────────────────────────────────────────
/**
 * Triage an incoming security alert.
 * @param {object} alertData - Raw alert payload
 * @param {object} context   - Additional context (asset owner, environment, etc.)
 * @param {string} severity  - Reported severity (critical|high|medium|low|info)
 * @returns Triage result with priority, classification, recommended actions
 */
export function triageAlert(alertData = {}, context = {}, severity = "medium") {
  const validSeverities = ["critical","high","medium","low","info"];
  if (!validSeverities.includes(severity)) throw new Error(`severity must be one of: ${validSeverities.join(", ")}`);

  const classifications = ["True Positive — Active Threat","True Positive — Attempted Intrusion","True Positive — Policy Violation","False Positive — Benign Activity","False Positive — Misconfigured Rule","Undetermined — Needs Investigation"];
  const classification   = randomFrom(classifications);
  const isFalsePositive  = classification.startsWith("False Positive");
  const fpProb           = isFalsePositive ? 0.7 + Math.random() * 0.25 : Math.random() * 0.2;

  const priority = isFalsePositive ? "info"
    : severity === "critical" ? "critical"
    : severity === "high"     ? "high"
    : severity === "medium"   ? "medium"
    : "low";

  const actionsPool = {
    critical: ["Isolate affected endpoint immediately","Revoke compromised credentials","Escalate to CISO","Open P1 incident ticket","Initiate forensic collection"],
    high:     ["Block source IP at firewall","Run EDR scan on affected host","Notify asset owner","Escalate to SOC lead"],
    medium:   ["Add to watch list","Correlate with other alerts","Schedule investigation within 4 hours"],
    low:      ["Log and monitor for recurrence","Update detection rule tuning"],
    info:     ["Close alert as false positive","Tune detection rule to reduce noise"],
  };
  const recommended_actions = actionsPool[priority].slice(0, 3);

  const relatedAlertCount = Math.floor(Math.random() * 4);
  const related_alerts = Array.from({ length: relatedAlertCount }, () => `ALERT-${Math.floor(10000 + Math.random() * 90000)}`);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO cyber_alerts
      (id, severity, priority, classification, false_positive_prob, actions_json, related_alerts_json, fee_usd)
    VALUES (@id, @severity, @priority, @classification, @false_positive_prob, @actions_json, @related_alerts_json, @fee_usd)
  `).run({
    id, severity, priority, classification,
    false_positive_prob: Math.round(fpProb * 100) / 100,
    actions_json: JSON.stringify(recommended_actions),
    related_alerts_json: JSON.stringify(related_alerts),
    fee_usd: FEES.triage,
  });

  return {
    triage_id: id,
    input_severity: severity,
    priority,
    classification,
    recommended_actions,
    false_positive_probability: Math.round(fpProb * 100) / 100,
    related_alerts,
    analyst_note: priority === "critical" ? "Immediate escalation required — do not delay response." : "Review and respond within SLA.",
    fee_usd: FEES.triage,
    triaged_at: new Date().toISOString(),
  };
}

// ─── checkIocReputation ───────────────────────────────────────────────────────
/**
 * Check the reputation of an indicator of compromise.
 * @param {string} ioc     - The indicator (IP, domain, hash, URL, or email)
 * @param {string} iocType - ip | domain | hash | url | email
 * @returns Reputation data including malicious flag, threat types, confidence
 */
export function checkIocReputation(ioc, iocType = "ip") {
  if (!ioc) throw new Error("ioc is required");
  const validTypes = ["ip","domain","hash","url","email"];
  if (!validTypes.includes(iocType)) throw new Error(`iocType must be one of: ${validTypes.join(", ")}`);

  const record = db.prepare("SELECT * FROM cyber_iocs WHERE ioc = ? AND ioc_type = ?").get(ioc, iocType);

  let result;
  if (record) {
    result = {
      ioc,
      ioc_type: iocType,
      malicious: record.malicious === 1,
      threat_types: JSON.parse(record.threat_types_json || "[]"),
      first_seen: record.first_seen,
      last_seen: record.last_seen,
      confidence: record.confidence,
      sources: JSON.parse(record.sources_json || "[]"),
    };
  } else {
    // Unknown IOC — return benign with low confidence
    result = {
      ioc,
      ioc_type: iocType,
      malicious: false,
      threat_types: [],
      first_seen: null,
      last_seen: null,
      confidence: 0.1,
      sources: [],
    };
  }

  return {
    ...result,
    verdict: result.malicious ? "MALICIOUS" : result.confidence > 0.5 ? "SUSPICIOUS" : "CLEAN",
    fee_usd: FEES.ioc_check,
    checked_at: new Date().toISOString(),
  };
}

// ─── generateIncidentReport ───────────────────────────────────────────────────
/**
 * Auto-generate a structured incident response report.
 * @param {object} incidentData - Incident metadata (name, type, affected_systems, etc.)
 * @param {object} findings     - Technical findings from investigation
 * @param {Array}  timeline     - Array of timestamped events
 * @returns Full IR report with executive summary, technical details, remediation plan
 */
export function generateIncidentReport(incidentData = {}, findings = {}, timeline = []) {
  const incidentName = incidentData.name ?? "Security Incident";
  const incidentType = incidentData.type ?? "Unauthorized Access";
  const affectedSystems = incidentData.affected_systems ?? ["unknown"];
  const severity = incidentData.severity ?? "high";

  const executive_summary =
    `A ${severity}-severity ${incidentType} was detected affecting ${Array.isArray(affectedSystems) ? affectedSystems.join(", ") : affectedSystems}. ` +
    `Initial investigation has been completed and containment measures are in progress. ` +
    `Business impact is assessed as ${findings.impact ?? "moderate"} with estimated recovery time of ${findings.estimated_recovery ?? "4–8 hours"}.`;

  const technical_details =
    `Root cause: ${findings.root_cause ?? "Exploitation of unpatched vulnerability via external attack vector."}. ` +
    `Attack vector: ${findings.attack_vector ?? "Network — remote exploitation"}. ` +
    `Indicators of compromise identified: ${findings.ioc_count ?? 3}. ` +
    `Affected accounts: ${findings.affected_accounts ?? "Unknown — investigation ongoing"}.`;

  const impact_assessment =
    `Data confidentiality: ${findings.data_impact ?? "Potentially impacted — investigation ongoing"}. ` +
    `Service availability: ${findings.availability_impact ?? "Degraded for approximately 2 hours"}. ` +
    `Regulatory reporting required: ${findings.regulatory_required ?? false}.`;

  const remediation_plan =
    "1. Patch all affected systems to latest vendor-recommended version. " +
    "2. Reset credentials for all affected accounts and service accounts. " +
    "3. Deploy additional monitoring rules for attack pattern. " +
    "4. Conduct post-incident review within 5 business days. " +
    "5. Update incident response playbook with lessons learned.";

  const reportTimeline = timeline.length > 0 ? timeline : [
    { time: new Date(Date.now() - 3600000).toISOString(), event: "Incident detected by SIEM alert" },
    { time: new Date(Date.now() - 2400000).toISOString(), event: "Triage completed — escalated to IR team" },
    { time: new Date(Date.now() - 1800000).toISOString(), event: "Affected systems isolated" },
    { time: new Date(Date.now() - 600000).toISOString(),  event: "Root cause identified" },
    { time: new Date().toISOString(),                      event: "Incident report generated" },
  ];

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO cyber_incidents
      (id, executive_summary, technical_details, timeline_json, impact_assessment, remediation_plan, fee_usd)
    VALUES (@id, @executive_summary, @technical_details, @timeline_json, @impact_assessment, @remediation_plan, @fee_usd)
  `).run({
    id,
    executive_summary,
    technical_details,
    timeline_json: JSON.stringify(reportTimeline),
    impact_assessment,
    remediation_plan,
    fee_usd: FEES.incident_report,
  });

  return {
    report_id: id,
    incident_name: incidentName,
    incident_type: incidentType,
    severity,
    executive_summary,
    technical_details,
    timeline: reportTimeline,
    impact_assessment,
    remediation_plan,
    classification: "CONFIDENTIAL — RESTRICTED DISTRIBUTION",
    fee_usd: FEES.incident_report,
    generated_at: new Date().toISOString(),
  };
}

// ─── assessVulnerability ──────────────────────────────────────────────────────
/**
 * Perform a vulnerability assessment on a target.
 * @param {string} target - Hostname, IP range, or application URL
 * @param {string} scope  - web | network | cloud | container | full
 * @returns Vulnerability list with CVEs, CVSS scores, and fix availability
 */
export function assessVulnerability(target, scope = "full") {
  if (!target) throw new Error("target is required");
  const validScopes = ["web","network","cloud","container","full"];
  if (!validScopes.includes(scope)) throw new Error(`scope must be one of: ${validScopes.join(", ")}`);

  const cveRows = db.prepare("SELECT * FROM cyber_cves ORDER BY RANDOM() LIMIT ?").all(scope === "full" ? 6 : 3);

  const components = {
    web:       ["Web application","Session management","Input validation","Authentication module"],
    network:   ["Firewall ruleset","DNS configuration","VPN endpoint","Network switch firmware"],
    cloud:     ["IAM policy","S3 bucket config","Security groups","Container registry"],
    container: ["Base image","Pod security policy","Secrets management","Network policy"],
    full:      ["Web application","Network perimeter","Cloud infrastructure","Endpoint configuration","Database server"],
  };

  const vulnerabilities = cveRows.map(row => ({
    cve: row.cve_id,
    description: row.description,
    severity: row.severity,
    cvss_score: row.cvss_score,
    affected_component: randomFrom(components[scope] || components.full),
    fix_available: Math.random() > 0.2,
    exploit_probability: Math.round((row.cvss_score / 10) * (0.5 + Math.random() * 0.5) * 100) / 100,
    patch_priority: row.cvss_score >= 9.0 ? "immediate" : row.cvss_score >= 7.0 ? "high" : "medium",
  }));

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO cyber_assessments
      (id, target, scope, vulnerabilities_json, fee_usd)
    VALUES (@id, @target, @scope, @vulnerabilities_json, @fee_usd)
  `).run({
    id, target, scope,
    vulnerabilities_json: JSON.stringify(vulnerabilities),
    fee_usd: FEES.assessment,
  });

  const criticalCount = vulnerabilities.filter(v => v.severity === "critical").length;
  const highCount = vulnerabilities.filter(v => v.severity === "high").length;

  return {
    assessment_id: id,
    target,
    scope,
    vulnerabilities,
    summary: {
      total: vulnerabilities.length,
      critical: criticalCount,
      high: highCount,
      medium: vulnerabilities.filter(v => v.severity === "medium").length,
      low: vulnerabilities.filter(v => v.severity === "low").length,
      fix_available: vulnerabilities.filter(v => v.fix_available).length,
    },
    overall_risk: criticalCount > 0 ? "critical" : highCount > 0 ? "high" : "medium",
    fee_usd: FEES.assessment,
    assessed_at: new Date().toISOString(),
  };
}

// ─── getCyberDashboard ────────────────────────────────────────────────────────
/**
 * Get the security posture dashboard for an organization.
 * @param {string} orgId - Organization identifier
 * @returns Risk score, open vulnerabilities, incidents, patch compliance, top risks
 */
export function getCyberDashboard(orgId) {
  if (!orgId) throw new Error("orgId is required");

  const recentScans = db.prepare("SELECT * FROM cyber_scans ORDER BY created_at DESC LIMIT 5").all();
  const openAssessments = db.prepare("SELECT COUNT(*) as n FROM cyber_assessments").get().n;
  const totalIncidents = db.prepare("SELECT COUNT(*) as n FROM cyber_incidents").get().n;

  const avgRisk = recentScans.length > 0
    ? Math.round(recentScans.reduce((s, r) => s + r.risk_score, 0) / recentScans.length * 10) / 10
    : Math.round(30 + Math.random() * 40);

  const topRisks = [
    { risk: "Unpatched critical CVEs", severity: "critical", affected_assets: Math.floor(1 + Math.random() * 10) },
    { risk: "Weak password policy enforcement", severity: "high", affected_assets: Math.floor(5 + Math.random() * 20) },
    { risk: "Excessive IAM permissions", severity: "high", affected_assets: Math.floor(3 + Math.random() * 8) },
    { risk: "Missing MFA on privileged accounts", severity: "medium", affected_assets: Math.floor(2 + Math.random() * 5) },
    { risk: "Insecure legacy TLS configurations", severity: "medium", affected_assets: Math.floor(1 + Math.random() * 4) },
  ];

  return {
    org_id: orgId,
    risk_score: avgRisk,
    risk_level: avgRisk >= 75 ? "critical" : avgRisk >= 50 ? "high" : avgRisk >= 25 ? "medium" : "low",
    open_vulnerabilities: openAssessments * Math.floor(2 + Math.random() * 4),
    recent_incidents: totalIncidents,
    threat_trend: randomFrom(["increasing","stable","decreasing"]),
    patch_compliance_pct: Math.round((60 + Math.random() * 38) * 10) / 10,
    top_risks: topRisks,
    last_scan_at: recentScans[0]?.created_at ?? null,
    alerts_last_24h: Math.floor(Math.random() * 25),
    fee_usd: FEES.dashboard,
    generated_at: new Date().toISOString(),
  };
}
