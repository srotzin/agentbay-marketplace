import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const IDENTITY_PLATFORM_COMMISSION = 0.15; // 15% on identity registrations
const DELEGATION_PLATFORM_COMMISSION = 0.12; // 12% on delegation grants

const REGISTRATION_FEE_USD = 4.99;   // one-time per identity
const DELEGATION_FEE_USD   = 1.50;   // per delegation grant
const VERIFICATION_FEE_USD = 0.10;   // per verification call

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_identities (
    id                TEXT PRIMARY KEY,
    agent_name        TEXT NOT NULL,
    principal_org     TEXT NOT NULL,
    capabilities      TEXT NOT NULL,
    public_key        TEXT NOT NULL,
    key_algorithm     TEXT DEFAULT 'Ed25519',
    fingerprint       TEXT NOT NULL,
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','revoked')),
    trust_level       TEXT DEFAULT 'standard' CHECK(trust_level IN ('provisional','standard','elevated','sovereign')),
    registration_fee_usd  REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    verifications_count   INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_delegations (
    id                TEXT PRIMARY KEY,
    agent_id          TEXT NOT NULL REFERENCES agent_identities(id),
    scope             TEXT NOT NULL,
    max_spend_usd     REAL,
    spent_usd         REAL DEFAULT 0,
    granted_by        TEXT NOT NULL,
    status            TEXT DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
    delegation_fee_usd  REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    verifications_count INTEGER DEFAULT 0,
    granted_at        TEXT DEFAULT (datetime('now')),
    expires_at        TEXT NOT NULL,
    revoked_at        TEXT,
    last_used_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS delegation_audit_log (
    id                TEXT PRIMARY KEY,
    delegation_id     TEXT NOT NULL,
    agent_id          TEXT NOT NULL,
    action            TEXT NOT NULL CHECK(action IN ('granted','verified','denied','revoked','expired')),
    requested_scope   TEXT,
    result            TEXT NOT NULL CHECK(result IN ('allowed','denied','error')),
    reason            TEXT,
    fee_usd           REAL DEFAULT 0,
    ip_hint           TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Sample Identities ───────────────────────────────────────────────────

const _idCount = db.prepare("SELECT COUNT(*) as n FROM agent_identities").get().n;
if (_idCount === 0) {
  const seedIdentities = [
    {
      id: uuid(), agent_name: "FinanceBot-Prod",  principal_org: "Acme Capital LLC",
      capabilities: '["read_accounts","initiate_transfers","generate_reports"]',
      public_key: "ed25519:7f3a9c2b4d1e8f6a0c5b2d9e3f7a1c4b8e2f5a9c",
      key_algorithm: "Ed25519", fingerprint: "SHA256:fPK3xQ+mR7Yw9eN1vLzAoHdJcUbGsIiTkMnXpVqWE=",
      trust_level: "elevated", registration_fee_usd: REGISTRATION_FEE_USD,
      commission_usd: Math.round(REGISTRATION_FEE_USD * IDENTITY_PLATFORM_COMMISSION * 100) / 100,
    },
    {
      id: uuid(), agent_name: "ContractDrafter-v2", principal_org: "LexAI Partners",
      capabilities: '["draft_contracts","request_signatures","file_documents"]',
      public_key: "ed25519:3c1e7a9f2b5d8e4c0a6f3b9d2e7c5a8f1b4e7a2c",
      key_algorithm: "Ed25519", fingerprint: "SHA256:aXm2vBnYqRsKdLwPzJcOuFgHeTiAlNbMkVsXpQyWZ=",
      trust_level: "standard", registration_fee_usd: REGISTRATION_FEE_USD,
      commission_usd: Math.round(REGISTRATION_FEE_USD * IDENTITY_PLATFORM_COMMISSION * 100) / 100,
    },
    {
      id: uuid(), agent_name: "DataPipeline-EU",  principal_org: "Synthex GmbH",
      capabilities: '["read_databases","write_staging","trigger_etl","send_reports"]',
      public_key: "ed25519:9b2f6d1e4c8a3f7b0d5e2c9a6f3b1e8d4c7a2f5b",
      key_algorithm: "Ed25519", fingerprint: "SHA256:rNu4hCyWqMvFzKpLaGbOjItXsAdHlSeUmQnBkTxYc=",
      trust_level: "standard", registration_fee_usd: REGISTRATION_FEE_USD,
      commission_usd: Math.round(REGISTRATION_FEE_USD * IDENTITY_PLATFORM_COMMISSION * 100) / 100,
    },
  ];
  const insertId = db.prepare(`
    INSERT OR IGNORE INTO agent_identities
      (id, agent_name, principal_org, capabilities, public_key, key_algorithm, fingerprint, trust_level, registration_fee_usd, commission_usd)
    VALUES
      (@id, @agent_name, @principal_org, @capabilities, @public_key, @key_algorithm, @fingerprint, @trust_level, @registration_fee_usd, @commission_usd)
  `);
  for (const row of seedIdentities) insertId.run(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveFingerprint(publicKey) {
  // Deterministic mock fingerprint derived from the public key
  const hash = Buffer.from(publicKey).toString("base64").slice(0, 43);
  return `SHA256:${hash}=`;
}

function scopeIncludes(grantedScope, requestedScope) {
  // A granted scope of "transfers:*" covers "transfers:initiate", etc.
  const granted = grantedScope.split(",").map(s => s.trim());
  return granted.some(g => {
    if (g === requestedScope) return true;
    if (g.endsWith(":*") && requestedScope.startsWith(g.slice(0, -1))) return true;
    if (g === "*") return true;
    return false;
  });
}

// ─── Register Agent Identity ──────────────────────────────────────────────────

/**
 * Register a verifiable cryptographic identity for an agent.
 * @param {string} agentName       - Human-readable agent name
 * @param {string} principalOrg    - Owning organization
 * @param {string[]} capabilities  - List of capability strings
 * @param {string} publicKey       - PEM or base58 public key
 * @returns Identity record with fingerprint, trust level, and fee breakdown
 */
export function registerAgentIdentity(agentName, principalOrg, capabilities, publicKey) {
  if (!agentName)    throw new Error("agentName is required");
  if (!principalOrg) throw new Error("principalOrg is required");
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0)
    throw new Error("capabilities must be a non-empty array");
  if (!publicKey)    throw new Error("publicKey is required");

  const id          = uuid();
  const fingerprint = deriveFingerprint(publicKey);
  const commission  = Math.round(REGISTRATION_FEE_USD * IDENTITY_PLATFORM_COMMISSION * 100) / 100;
  const now         = new Date().toISOString();

  // Determine trust level based on capability scope
  const highPrivilege = ["initiate_transfers","file_documents","sign_contracts","admin","sudo"];
  const needsElevated = capabilities.some(c => highPrivilege.includes(c));
  const trustLevel    = needsElevated ? "elevated" : "standard";

  db.prepare(`
    INSERT OR IGNORE INTO agent_identities
      (id, agent_name, principal_org, capabilities, public_key, fingerprint, trust_level,
       registration_fee_usd, commission_usd, created_at, updated_at)
    VALUES
      (@id, @agent_name, @principal_org, @capabilities, @public_key, @fingerprint, @trust_level,
       @registration_fee_usd, @commission_usd, @created_at, @updated_at)
  `).run({
    id,
    agent_name:           agentName,
    principal_org:        principalOrg,
    capabilities:         JSON.stringify(capabilities),
    public_key:           publicKey,
    fingerprint,
    trust_level:          trustLevel,
    registration_fee_usd: REGISTRATION_FEE_USD,
    commission_usd:       commission,
    created_at:           now,
    updated_at:           now,
  });

  return {
    agent_id:              id,
    agent_name:            agentName,
    principal_org:         principalOrg,
    capabilities,
    public_key_fingerprint: fingerprint,
    key_algorithm:         "Ed25519",
    trust_level:           trustLevel,
    status:                "active",
    registration_fee_usd:  REGISTRATION_FEE_USD,
    platform_commission_usd: commission,
    net_fee_usd:           Math.round((REGISTRATION_FEE_USD - commission) * 100) / 100,
    created_at:            now,
    message:               `Agent identity registered. Fingerprint: ${fingerprint}`,
  };
}

// ─── Grant Delegation ─────────────────────────────────────────────────────────

/**
 * Grant a scoped authorization delegation to a registered agent.
 * @param {string} agentId       - Registered agent ID
 * @param {string} scope         - Comma-separated scope strings (e.g. "transfers:initiate,reports:read")
 * @param {number} maxSpendUsd   - Maximum spend cap enforced on delegated actions
 * @param {string} expiresAt     - ISO 8601 expiry timestamp
 * @returns Delegation record with signed grant token
 */
export function grantDelegation(agentId, scope, maxSpendUsd, expiresAt) {
  if (!agentId)    throw new Error("agentId is required");
  if (!scope)      throw new Error("scope is required");
  if (!expiresAt)  throw new Error("expiresAt is required");

  const agent = db.prepare("SELECT * FROM agent_identities WHERE id = ? AND status = 'active'").get(agentId);
  if (!agent) throw new Error(`No active agent identity found: ${agentId}`);

  const expiry = new Date(expiresAt);
  if (isNaN(expiry.getTime())) throw new Error("expiresAt must be a valid ISO 8601 timestamp");
  if (expiry <= new Date())    throw new Error("expiresAt must be in the future");

  const id         = uuid();
  const fee        = DELEGATION_FEE_USD;
  const commission = Math.round(fee * DELEGATION_PLATFORM_COMMISSION * 100) / 100;
  const now        = new Date().toISOString();
  const grantedBy  = `system:${agent.principal_org}`;

  db.prepare(`
    INSERT OR IGNORE INTO agent_delegations
      (id, agent_id, scope, max_spend_usd, granted_by, delegation_fee_usd, commission_usd, granted_at, expires_at)
    VALUES
      (@id, @agent_id, @scope, @max_spend_usd, @granted_by, @delegation_fee_usd, @commission_usd, @granted_at, @expires_at)
  `).run({
    id,
    agent_id:            agentId,
    scope,
    max_spend_usd:       maxSpendUsd ?? null,
    granted_by:          grantedBy,
    delegation_fee_usd:  fee,
    commission_usd:      commission,
    granted_at:          now,
    expires_at:          expiry.toISOString(),
  });

  // Audit log
  db.prepare(`
    INSERT OR IGNORE INTO delegation_audit_log (id, delegation_id, agent_id, action, requested_scope, result, reason, fee_usd, created_at)
    VALUES (@id, @delegation_id, @agent_id, 'granted', @scope, 'allowed', 'Delegation granted by principal', @fee_usd, @created_at)
  `).run({ id: uuid(), delegation_id: id, agent_id: agentId, scope, fee_usd: fee, created_at: now });

  const grantToken = `dlg_${Buffer.from(`${id}:${agentId}:${scope}`).toString("base64url").slice(0, 32)}`;

  return {
    delegation_id:        id,
    agent_id:             agentId,
    agent_name:           agent.agent_name,
    scope,
    max_spend_usd:        maxSpendUsd ?? null,
    granted_by:           grantedBy,
    status:               "active",
    grant_token:          grantToken,
    delegation_fee_usd:   fee,
    platform_commission_usd: commission,
    granted_at:           now,
    expires_at:           expiry.toISOString(),
    ttl_seconds:          Math.floor((expiry.getTime() - Date.now()) / 1000),
  };
}

// ─── Verify Delegation ────────────────────────────────────────────────────────

/**
 * Verify whether an agent has an active, unexpired delegation covering the requested scope.
 * @param {string} agentId        - Agent to verify
 * @param {string} requestedScope - Scope string to check
 * @returns Verification result with AUTHORIZED/UNAUTHORIZED decision and matching delegation
 */
export function verifyDelegation(agentId, requestedScope) {
  if (!agentId)        throw new Error("agentId is required");
  if (!requestedScope) throw new Error("requestedScope is required");

  const agent = db.prepare("SELECT * FROM agent_identities WHERE id = ?").get(agentId);
  if (!agent) {
    return { authorized: false, decision: "UNAUTHORIZED", reason: "Agent identity not found", agent_id: agentId };
  }

  if (agent.status !== "active") {
    return { authorized: false, decision: "UNAUTHORIZED", reason: `Agent status is '${agent.status}'`, agent_id: agentId };
  }

  const now = new Date().toISOString();
  const delegations = db.prepare(`
    SELECT * FROM agent_delegations
    WHERE agent_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY granted_at DESC
  `).all(agentId, now);

  // Mark expired delegations
  db.prepare("UPDATE agent_delegations SET status='expired' WHERE agent_id=? AND expires_at<=? AND status='active'").run(agentId, now);

  const fee     = VERIFICATION_FEE_USD;
  const matched = delegations.find(d => scopeIncludes(d.scope, requestedScope));

  const logId = uuid();
  if (matched) {
    db.prepare(`
      UPDATE agent_identities SET verifications_count = verifications_count + 1, updated_at = ? WHERE id = ?
    `).run(now, agentId);
    db.prepare(`
      UPDATE agent_delegations SET verifications_count = verifications_count + 1, last_used_at = ? WHERE id = ?
    `).run(now, matched.id);
    db.prepare(`
      INSERT OR IGNORE INTO delegation_audit_log (id, delegation_id, agent_id, action, requested_scope, result, reason, fee_usd, created_at)
      VALUES (@id, @delegation_id, @agent_id, 'verified', @scope, 'allowed', 'Scope matched delegation', @fee_usd, @created_at)
    `).run({ id: logId, delegation_id: matched.id, agent_id: agentId, scope: requestedScope, fee_usd: fee, created_at: now });

    return {
      authorized:            true,
      decision:              "AUTHORIZED",
      agent_id:              agentId,
      agent_name:            agent.agent_name,
      requested_scope:       requestedScope,
      matched_delegation_id: matched.id,
      matched_scope:         matched.scope,
      max_spend_usd:         matched.max_spend_usd,
      spent_usd:             matched.spent_usd,
      expires_at:            matched.expires_at,
      ttl_seconds:           Math.floor((new Date(matched.expires_at).getTime() - Date.now()) / 1000),
      verification_fee_usd:  fee,
      verified_at:           now,
    };
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO delegation_audit_log (id, delegation_id, agent_id, action, requested_scope, result, reason, fee_usd, created_at)
      VALUES (@id, @delegation_id, @agent_id, 'denied', @scope, 'denied', 'No active delegation covers requested scope', @fee_usd, @created_at)
    `).run({ id: logId, delegation_id: "none", agent_id: agentId, scope: requestedScope, fee_usd: fee, created_at: now });

    return {
      authorized:          false,
      decision:            "UNAUTHORIZED",
      agent_id:            agentId,
      agent_name:          agent.agent_name,
      requested_scope:     requestedScope,
      reason:              "No active delegation covers the requested scope",
      active_delegations:  delegations.length,
      verification_fee_usd: fee,
      verified_at:         now,
    };
  }
}

// ─── Revoke Delegation ────────────────────────────────────────────────────────

/**
 * Immediately revoke a delegation, preventing further use.
 * @param {string} delegationId - ID of the delegation to revoke
 * @returns Revocation confirmation
 */
export function revokeDelegation(delegationId) {
  if (!delegationId) throw new Error("delegationId is required");

  const delegation = db.prepare("SELECT * FROM agent_delegations WHERE id = ?").get(delegationId);
  if (!delegation) throw new Error(`Delegation not found: ${delegationId}`);
  if (delegation.status === "revoked") throw new Error(`Delegation ${delegationId} is already revoked`);

  const now = new Date().toISOString();
  db.prepare("UPDATE agent_delegations SET status='revoked', revoked_at=? WHERE id=?").run(now, delegationId);

  db.prepare(`
    INSERT OR IGNORE INTO delegation_audit_log (id, delegation_id, agent_id, action, requested_scope, result, reason, fee_usd, created_at)
    VALUES (@id, @delegation_id, @agent_id, 'revoked', @scope, 'allowed', 'Delegation manually revoked', 0, @created_at)
  `).run({ id: uuid(), delegation_id: delegationId, agent_id: delegation.agent_id, scope: delegation.scope, created_at: now });

  return {
    delegation_id:    delegationId,
    agent_id:         delegation.agent_id,
    scope:            delegation.scope,
    previous_status:  delegation.status,
    status:           "revoked",
    revoked_at:       now,
    message:          `Delegation ${delegationId} has been revoked. All future verification calls for this delegation will be denied.`,
  };
}

// ─── Get Agent Profile ────────────────────────────────────────────────────────

/**
 * Retrieve a full agent profile including all delegations and audit history.
 * @param {string} agentId
 * @returns Full agent profile with delegation history and access stats
 */
export function getAgentProfile(agentId) {
  if (!agentId) throw new Error("agentId is required");

  const agent = db.prepare("SELECT * FROM agent_identities WHERE id = ?").get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const delegations = db.prepare(`
    SELECT * FROM agent_delegations WHERE agent_id = ? ORDER BY granted_at DESC
  `).all(agentId);

  const auditLog = db.prepare(`
    SELECT * FROM delegation_audit_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(agentId);

  const now = new Date().toISOString();
  const activeDelegations  = delegations.filter(d => d.status === "active" && d.expires_at > now);
  const expiredDelegations = delegations.filter(d => d.status === "expired" || (d.status === "active" && d.expires_at <= now));
  const revokedDelegations = delegations.filter(d => d.status === "revoked");

  const totalSpend = delegations.reduce((sum, d) => sum + (d.delegation_fee_usd || 0), 0);
  const totalCommission = delegations.reduce((sum, d) => sum + (d.commission_usd || 0), 0);

  return {
    agent_id:            agent.id,
    agent_name:          agent.agent_name,
    principal_org:       agent.principal_org,
    capabilities:        JSON.parse(agent.capabilities || "[]"),
    public_key_fingerprint: agent.fingerprint,
    key_algorithm:       agent.key_algorithm,
    trust_level:         agent.trust_level,
    status:              agent.status,
    verifications_total: agent.verifications_count,
    registration_fee_usd: agent.registration_fee_usd,
    created_at:          agent.created_at,
    delegation_summary: {
      total:   delegations.length,
      active:  activeDelegations.length,
      expired: expiredDelegations.length,
      revoked: revokedDelegations.length,
    },
    active_delegations: activeDelegations.map(d => ({
      delegation_id:  d.id,
      scope:          d.scope,
      max_spend_usd:  d.max_spend_usd,
      spent_usd:      d.spent_usd,
      granted_by:     d.granted_by,
      expires_at:     d.expires_at,
      ttl_seconds:    Math.max(0, Math.floor((new Date(d.expires_at).getTime() - Date.now()) / 1000)),
      verifications:  d.verifications_count,
    })),
    delegation_history: delegations.slice(0, 20).map(d => ({
      delegation_id: d.id,
      scope:         d.scope,
      status:        d.status,
      granted_at:    d.granted_at,
      expires_at:    d.expires_at,
      revoked_at:    d.revoked_at,
    })),
    recent_audit_events: auditLog.slice(0, 10).map(e => ({
      action:          e.action,
      requested_scope: e.requested_scope,
      result:          e.result,
      reason:          e.reason,
      created_at:      e.created_at,
    })),
    financials: {
      total_delegation_fees_usd:   Math.round(totalSpend * 100) / 100,
      total_platform_commission_usd: Math.round(totalCommission * 100) / 100,
      registration_fee_usd:        agent.registration_fee_usd,
      lifetime_spend_usd:          Math.round((totalSpend + agent.registration_fee_usd) * 100) / 100,
    },
  };
}
