import { v4 as uuid } from "uuid";
import { createHash, randomBytes } from "crypto";
import db from "../db.js";

// ─── Enterprise Plan Definitions ─────────────────────────────────────────────

const PLANS = {
  business: {
    id: "business",
    name: "Business",
    monthly_fee_usd: 999,
    agent_limit: 50,
    storage_limit_gb: 100,
    transaction_limit_monthly: 100_000,
    data_isolation: "logical",
    encryption: "aes256",
    compliance_frameworks: ["SOC2"],
    sla_uptime_pct: 99.9,
    sla_latency_ms: 500,
    support_tier: "email",
    description: "Shared infrastructure with logical isolation. Ideal for growing teams.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthly_fee_usd: 4_999,
    agent_limit: 500,
    storage_limit_gb: 1_000,
    transaction_limit_monthly: 1_000_000,
    data_isolation: "physical",
    encryption: "customer_managed_keys",
    compliance_frameworks: ["SOC2", "HIPAA", "GDPR"],
    sla_uptime_pct: 99.95,
    sla_latency_ms: 200,
    support_tier: "priority",
    description: "Dedicated infrastructure with customer-managed encryption keys.",
  },
  enterprise_plus: {
    id: "enterprise_plus",
    name: "Enterprise Plus",
    monthly_fee_usd: 14_999,
    agent_limit: -1,          // unlimited
    storage_limit_gb: 10_000,
    transaction_limit_monthly: -1, // unlimited
    data_isolation: "physical",
    encryption: "fips_140_2",
    compliance_frameworks: ["SOC2", "HIPAA", "GDPR", "PCI_DSS", "FedRAMP", "ITAR"],
    sla_uptime_pct: 99.99,
    sla_latency_ms: 100,
    support_tier: "dedicated",
    description: "Unlimited scale with FIPS 140-2 encryption and dedicated support.",
  },
  sovereign: {
    id: "sovereign",
    name: "Sovereign",
    monthly_fee_usd: 49_999,
    agent_limit: -1,
    storage_limit_gb: -1,     // unlimited
    transaction_limit_monthly: -1,
    data_isolation: "sovereign",
    encryption: "fips_140_2",
    compliance_frameworks: ["SOC2", "HIPAA", "GDPR", "PCI_DSS", "FedRAMP", "ITAR"],
    sla_uptime_pct: 99.99,
    sla_latency_ms: 50,
    support_tier: "24x7",
    description: "Dedicated sovereign infrastructure with data residency controls, FedRAMP High, and ITAR.",
  },
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS enterprise_tenants (
    id                         TEXT PRIMARY KEY,
    name                       TEXT NOT NULL,
    domain                     TEXT,
    industry                   TEXT CHECK(industry IN ('pharma','finance','consulting','tech','manufacturing','legal','government','healthcare','defense','energy')),
    admin_agent_id             TEXT NOT NULL,
    plan                       TEXT DEFAULT 'business' CHECK(plan IN ('business','enterprise','enterprise_plus','sovereign')),
    monthly_fee_usd            REAL NOT NULL,
    features                   TEXT DEFAULT '{}',
    agent_limit                INTEGER DEFAULT 50,
    storage_limit_gb           INTEGER DEFAULT 100,
    transaction_limit_monthly  INTEGER DEFAULT 100000,
    data_isolation             TEXT DEFAULT 'logical' CHECK(data_isolation IN ('logical','physical','sovereign')),
    encryption                 TEXT DEFAULT 'aes256' CHECK(encryption IN ('aes256','customer_managed_keys','fips_140_2')),
    compliance_frameworks      TEXT DEFAULT '[]',
    sla_uptime_pct             REAL DEFAULT 99.9,
    sla_latency_ms             INTEGER DEFAULT 500,
    support_tier               TEXT DEFAULT 'email' CHECK(support_tier IN ('email','priority','dedicated','24x7')),
    status                     TEXT DEFAULT 'active' CHECK(status IN ('trial','active','suspended','cancelled')),
    trial_ends_at              TEXT,
    created_at                 TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenant_agents (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT REFERENCES enterprise_tenants(id),
    agent_id    TEXT NOT NULL,
    role        TEXT DEFAULT 'member' CHECK(role IN ('admin','manager','member','viewer','auditor','compliance_officer')),
    permissions TEXT DEFAULT '["read","write"]',
    department  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, agent_id)
  );

  CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id                   TEXT PRIMARY KEY,
    tenant_id            TEXT REFERENCES enterprise_tenants(id),
    key_hash             TEXT NOT NULL,
    name                 TEXT,
    permissions          TEXT DEFAULT '["*"]',
    rate_limit_per_minute INTEGER DEFAULT 1000,
    last_used            TEXT,
    status               TEXT DEFAULT 'active',
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(rawKey) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function applyPlanDefaults(plan) {
  const p = PLANS[plan];
  if (!p) throw new Error(`Unknown plan: ${plan}`);
  return {
    monthly_fee_usd: p.monthly_fee_usd,
    agent_limit: p.agent_limit,
    storage_limit_gb: p.storage_limit_gb,
    transaction_limit_monthly: p.transaction_limit_monthly,
    data_isolation: p.data_isolation,
    encryption: p.encryption,
    compliance_frameworks: JSON.stringify(p.compliance_frameworks),
    sla_uptime_pct: p.sla_uptime_pct,
    sla_latency_ms: p.sla_latency_ms,
    support_tier: p.support_tier,
  };
}

// ─── Tenant CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new enterprise tenant.
 */
export function createTenant({ name, domain, industry, admin_agent_id, plan = "business" }) {
  if (!name) throw new Error("name is required");
  if (!admin_agent_id) throw new Error("admin_agent_id is required");

  const planDefaults = applyPlanDefaults(plan);
  const tenant_id = uuid();

  db.prepare(`
    INSERT INTO enterprise_tenants
      (id, name, domain, industry, admin_agent_id, plan, monthly_fee_usd,
       agent_limit, storage_limit_gb, transaction_limit_monthly,
       data_isolation, encryption, compliance_frameworks,
       sla_uptime_pct, sla_latency_ms, support_tier, status)
    VALUES
      (@id, @name, @domain, @industry, @admin_agent_id, @plan, @monthly_fee_usd,
       @agent_limit, @storage_limit_gb, @transaction_limit_monthly,
       @data_isolation, @encryption, @compliance_frameworks,
       @sla_uptime_pct, @sla_latency_ms, @support_tier, 'active')
  `).run({
    id: tenant_id,
    name,
    domain: domain ?? null,
    industry: industry ?? null,
    admin_agent_id,
    plan,
    ...planDefaults,
  });

  // Automatically add the admin agent to tenant_agents as admin
  db.prepare(`
    INSERT INTO tenant_agents (id, tenant_id, agent_id, role, permissions)
    VALUES (@id, @tenant_id, @agent_id, 'admin', '["read","write","delete","admin","compliance","financial","sensitive_data"]')
  `).run({ id: uuid(), tenant_id, agent_id: admin_agent_id });

  return getTenant(tenant_id);
}

/**
 * Retrieve full tenant info.
 */
export function getTenant(tenant_id) {
  const tenant = db.prepare("SELECT * FROM enterprise_tenants WHERE id = ?").get(tenant_id);
  if (!tenant) throw new Error(`Tenant not found: ${tenant_id}`);

  tenant.compliance_frameworks = JSON.parse(tenant.compliance_frameworks || "[]");
  tenant.features = JSON.parse(tenant.features || "{}");

  const agents = db.prepare("SELECT * FROM tenant_agents WHERE tenant_id = ?").all(tenant_id);
  agents.forEach(a => { a.permissions = JSON.parse(a.permissions || "[]"); });
  tenant.agents = agents;
  tenant.agent_count = agents.length;

  const plan = PLANS[tenant.plan] ?? {};
  tenant.plan_details = plan;

  return tenant;
}

/**
 * Update tenant fields (plan changes re-apply plan defaults).
 */
export function updateTenant(tenant_id, updates) {
  const tenant = db.prepare("SELECT * FROM enterprise_tenants WHERE id = ?").get(tenant_id);
  if (!tenant) throw new Error(`Tenant not found: ${tenant_id}`);

  // If plan is changing, merge plan defaults (caller may override individual fields)
  if (updates.plan && updates.plan !== tenant.plan) {
    const planDefaults = applyPlanDefaults(updates.plan);
    updates = { ...planDefaults, ...updates };
    if (updates.compliance_frameworks && Array.isArray(updates.compliance_frameworks)) {
      updates.compliance_frameworks = JSON.stringify(updates.compliance_frameworks);
    }
  }

  if (updates.features && typeof updates.features === "object") {
    updates.features = JSON.stringify(updates.features);
  }
  if (updates.compliance_frameworks && Array.isArray(updates.compliance_frameworks)) {
    updates.compliance_frameworks = JSON.stringify(updates.compliance_frameworks);
  }

  const allowed = [
    "name", "domain", "industry", "plan", "monthly_fee_usd", "features",
    "agent_limit", "storage_limit_gb", "transaction_limit_monthly",
    "data_isolation", "encryption", "compliance_frameworks",
    "sla_uptime_pct", "sla_latency_ms", "support_tier", "status", "trial_ends_at",
  ];

  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) throw new Error("No valid fields to update");

  const setClauses = fields.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE enterprise_tenants SET ${setClauses} WHERE id = @id`)
    .run({ ...updates, id: tenant_id });

  return getTenant(tenant_id);
}

// ─── Agent Management ─────────────────────────────────────────────────────────

/**
 * Add an agent to a tenant with a role and permissions.
 */
export function addAgent({ tenant_id, agent_id, role = "member", permissions, department }) {
  const tenant = db.prepare("SELECT * FROM enterprise_tenants WHERE id = ?").get(tenant_id);
  if (!tenant) throw new Error(`Tenant not found: ${tenant_id}`);

  const defaultPerms = {
    admin: ["read","write","delete","admin","compliance","financial","sensitive_data"],
    manager: ["read","write","delete","financial"],
    member: ["read","write"],
    viewer: ["read"],
    auditor: ["read","compliance"],
    compliance_officer: ["read","compliance","sensitive_data"],
  };

  const perms = permissions ?? defaultPerms[role] ?? ["read","write"];

  db.prepare(`
    INSERT INTO tenant_agents (id, tenant_id, agent_id, role, permissions, department)
    VALUES (@id, @tenant_id, @agent_id, @role, @permissions, @department)
    ON CONFLICT(tenant_id, agent_id) DO UPDATE SET
      role = excluded.role,
      permissions = excluded.permissions,
      department = excluded.department
  `).run({
    id: uuid(),
    tenant_id,
    agent_id,
    role,
    permissions: JSON.stringify(Array.isArray(perms) ? perms : [perms]),
    department: department ?? null,
  });

  return db.prepare("SELECT * FROM tenant_agents WHERE tenant_id = ? AND agent_id = ?")
    .get(tenant_id, agent_id);
}

/**
 * Remove an agent from a tenant.
 */
export function removeAgent(tenant_id, agent_id) {
  const tenant = db.prepare("SELECT * FROM enterprise_tenants WHERE id = ?").get(tenant_id);
  if (!tenant) throw new Error(`Tenant not found: ${tenant_id}`);

  if (tenant.admin_agent_id === agent_id) {
    throw new Error("Cannot remove the tenant admin agent. Transfer admin first.");
  }

  const result = db.prepare(
    "DELETE FROM tenant_agents WHERE tenant_id = ? AND agent_id = ?"
  ).run(tenant_id, agent_id);

  return { removed: result.changes > 0, agent_id };
}

/**
 * Update an agent's role and/or permissions within a tenant.
 */
export function updateAgentRole({ tenant_id, agent_id, role, permissions }) {
  const record = db.prepare(
    "SELECT * FROM tenant_agents WHERE tenant_id = ? AND agent_id = ?"
  ).get(tenant_id, agent_id);
  if (!record) throw new Error(`Agent ${agent_id} not found in tenant ${tenant_id}`);

  const updates = {};
  if (role) updates.role = role;
  if (permissions) updates.permissions = JSON.stringify(Array.isArray(permissions) ? permissions : [permissions]);

  if (!Object.keys(updates).length) throw new Error("Provide role or permissions to update");

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE tenant_agents SET ${setClauses} WHERE tenant_id = @tenant_id AND agent_id = @agent_id`)
    .run({ ...updates, tenant_id, agent_id });

  const updated = db.prepare(
    "SELECT * FROM tenant_agents WHERE tenant_id = ? AND agent_id = ?"
  ).get(tenant_id, agent_id);
  updated.permissions = JSON.parse(updated.permissions || "[]");
  return updated;
}

/**
 * List all agents in a tenant with their roles.
 */
export function getTenantAgents(tenant_id) {
  const agents = db.prepare(
    "SELECT * FROM tenant_agents WHERE tenant_id = ? ORDER BY role, created_at"
  ).all(tenant_id);
  agents.forEach(a => { a.permissions = JSON.parse(a.permissions || "[]"); });
  return { tenant_id, agents, count: agents.length };
}

// ─── API Key Management ───────────────────────────────────────────────────────

/**
 * Generate a new API key for a tenant.
 * Returns the raw key once — it is never stored in plaintext.
 */
export function createApiKey({ tenant_id, name, permissions = ["*"], rate_limit_per_minute = 1000 }) {
  const tenant = db.prepare("SELECT id FROM enterprise_tenants WHERE id = ?").get(tenant_id);
  if (!tenant) throw new Error(`Tenant not found: ${tenant_id}`);

  const rawKey = `hive_ent_${randomBytes(32).toString("hex")}`;
  const key_hash = hashKey(rawKey);
  const key_id = uuid();

  db.prepare(`
    INSERT INTO tenant_api_keys (id, tenant_id, key_hash, name, permissions, rate_limit_per_minute)
    VALUES (@id, @tenant_id, @key_hash, @name, @permissions, @rate_limit_per_minute)
  `).run({
    id: key_id,
    tenant_id,
    key_hash,
    name: name ?? null,
    permissions: JSON.stringify(Array.isArray(permissions) ? permissions : [permissions]),
    rate_limit_per_minute,
  });

  return {
    key_id,
    tenant_id,
    name,
    raw_key: rawKey,          // returned ONCE — store securely
    permissions,
    rate_limit_per_minute,
    created_at: new Date().toISOString(),
    warning: "This is the only time the raw API key will be shown. Store it securely.",
  };
}

/**
 * Revoke an API key.
 */
export function revokeApiKey(key_id) {
  const key = db.prepare("SELECT * FROM tenant_api_keys WHERE id = ?").get(key_id);
  if (!key) throw new Error(`API key not found: ${key_id}`);

  db.prepare("UPDATE tenant_api_keys SET status = 'revoked' WHERE id = ?").run(key_id);
  return { key_id, status: "revoked" };
}

// ─── Plans & Stats ────────────────────────────────────────────────────────────

/**
 * Return all available enterprise plans.
 */
export function getPlans() {
  return Object.values(PLANS).map(p => ({
    ...p,
    agent_limit_display: p.agent_limit === -1 ? "Unlimited" : p.agent_limit,
    storage_limit_display: p.storage_limit_gb === -1 ? "Unlimited" : `${p.storage_limit_gb} GB`,
    transaction_limit_display: p.transaction_limit_monthly === -1 ? "Unlimited" : p.transaction_limit_monthly.toLocaleString(),
  }));
}

/**
 * Get platform-wide enterprise stats: total tenants, MRR, agents, by plan.
 */
export function getEnterpriseStats() {
  const total_tenants = db.prepare(
    "SELECT COUNT(*) as n FROM enterprise_tenants WHERE status IN ('active','trial')"
  ).get().n;

  const mrr = db.prepare(
    "SELECT COALESCE(SUM(monthly_fee_usd),0) as total FROM enterprise_tenants WHERE status = 'active'"
  ).get().total;

  const total_agents = db.prepare("SELECT COUNT(*) as n FROM tenant_agents").get().n;

  const by_plan = db.prepare(`
    SELECT plan, COUNT(*) as count, SUM(monthly_fee_usd) as mrr
    FROM enterprise_tenants
    WHERE status IN ('active','trial')
    GROUP BY plan
    ORDER BY mrr DESC
  `).all();

  const by_industry = db.prepare(`
    SELECT industry, COUNT(*) as count
    FROM enterprise_tenants
    WHERE status IN ('active','trial') AND industry IS NOT NULL
    GROUP BY industry
    ORDER BY count DESC
  `).all();

  const api_keys_active = db.prepare(
    "SELECT COUNT(*) as n FROM tenant_api_keys WHERE status = 'active'"
  ).get().n;

  return {
    total_tenants,
    mrr_usd: mrr,
    arr_usd: mrr * 12,
    total_agents,
    api_keys_active,
    by_plan,
    by_industry,
  };
}
