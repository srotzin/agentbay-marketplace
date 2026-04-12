/**
 * Digital Forensics Service
 *
 * Provides lightweight, offline-safe utilities for:
 * - incident timelines
 * - indicator-of-compromise (IOC) triage
 * - log artifact hashing and chain-of-custody bundles
 *
 * NOTE: This module intentionally avoids direct network calls.
 */

import crypto from "crypto";

function nowIso() {
  return new Date().toISOString();
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function isIpLike(v) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-f:]+$/i.test(v);
}

function isDomainLike(v) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(v);
}

function isHashLike(v) {
  return /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(v);
}

function normalizeIndicator(ind) {
  const raw = String(ind || "").trim();
  const lower = raw.toLowerCase();

  if (isIpLike(lower)) return { type: "ip", value: lower };
  if (isDomainLike(lower)) return { type: "domain", value: lower };
  if (lower.startsWith("http://") || lower.startsWith("https://")) return { type: "url", value: raw };
  if (lower.includes("@") && lower.includes(".")) return { type: "email", value: lower };
  if (isHashLike(lower)) {
    const len = lower.length;
    const alg = len === 32 ? "md5" : len === 40 ? "sha1" : "sha256";
    return { type: "hash", alg, value: lower };
  }
  return { type: "unknown", value: raw };
}

export function buildIncidentTimeline({
  incident_id,
  title,
  events,
  timezone = "UTC",
}) {
  const incidentId = incident_id || `inc_${sha256(title || "incident").slice(0, 10)}`;
  const normalized = (events || []).map((e, idx) => {
    const ts = e.timestamp || e.ts || e.time || null;
    return {
      id: e.id || `evt_${idx + 1}`,
      timestamp: ts,
      actor: e.actor || e.source || "unknown",
      action: e.action || e.event || "event",
      details: e.details || e.note || "",
      confidence: e.confidence ?? "medium",
      tags: Array.isArray(e.tags) ? e.tags : [],
    };
  });

  normalized.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : Number.POSITIVE_INFINITY;
    const tb = b.timestamp ? Date.parse(b.timestamp) : Number.POSITIVE_INFINITY;
    return ta - tb;
  });

  return {
    incident_id: incidentId,
    title: title || "Untitled incident",
    timezone,
    created_at: nowIso(),
    event_count: normalized.length,
    timeline: normalized,
    summary: {
      first_timestamp: normalized.find((e) => e.timestamp)?.timestamp || null,
      last_timestamp: [...normalized].reverse().find((e) => e.timestamp)?.timestamp || null,
    },
  };
}

export function triageIocs({ indicators }) {
  const list = Array.isArray(indicators) ? indicators : [];
  const normalized = list.map(normalizeIndicator);

  const byType = normalized.reduce((acc, i) => {
    acc[i.type] = acc[i.type] || [];
    acc[i.type].push(i);
    return acc;
  }, {});

  const riskRules = {
    ip: 0.6,
    domain: 0.55,
    url: 0.7,
    email: 0.4,
    hash: 0.65,
    unknown: 0.2,
  };

  const score = normalized.reduce((s, i) => s + (riskRules[i.type] || 0.2), 0);
  const max = normalized.length || 1;
  const risk_score = Math.min(1, score / max);

  return {
    count: normalized.length,
    normalized,
    by_type: byType,
    risk_score,
    guidance: [
      "Confirm scope first: which hosts/accounts are affected?",
      "Preserve evidence: collect logs, auth events, and relevant files before remediation.",
      "Rotate secrets if any IOC suggests credential access (URLs, email phishing, API keys).",
    ],
  };
}

export function createEvidenceBundle({ incident_id, artifacts }) {
  const list = Array.isArray(artifacts) ? artifacts : [];
  const entries = list.map((a, idx) => {
    const name = a.name || a.filename || `artifact_${idx + 1}`;
    const content = a.content || a.text || "";
    const digest = sha256(content);
    return {
      name,
      sha256: digest,
      length: String(content).length,
      collected_at: a.collected_at || nowIso(),
      source: a.source || "unknown",
      notes: a.notes || "",
    };
  });

  const bundleHash = sha256(JSON.stringify(entries));

  return {
    incident_id: incident_id || `inc_${bundleHash.slice(0, 10)}`,
    created_at: nowIso(),
    artifacts: entries,
    bundle_sha256: bundleHash,
    chain_of_custody: {
      steps: [
        {
          timestamp: nowIso(),
          action: "bundle_created",
          actor: "hiveagent",
          details: "Evidence bundle created and hashed for integrity.",
        },
      ],
    },
  };
}
