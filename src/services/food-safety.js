/**
 * Food Safety Service (HACCP-lite)
 *
 * Basic food safety operations for agents: products, suppliers, lots,
 * critical control point (CCP) checks, and recall simulation.
 *
 * Notes:
 * - Prototyping oriented (in-memory persistence).
 * - Not a replacement for regulated food safety systems.
 */

const _state = globalThis.__hive_foodSafety || {
  products: [],
  suppliers: [],
  lots: [],
  ccpChecks: [],
  recalls: [],
};

globalThis.__hive_foodSafety = _state;

function _now() {
  return new Date().toISOString();
}

function _id(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function _norm(v) {
  return String(v || "").trim();
}

function _require(v, name) {
  if (v === undefined || v === null || _norm(v) === "") {
    const err = new Error(`Missing required field: ${name}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

function _lower(v) {
  return _norm(v).toLowerCase();
}

export function food_supplier_upsert({
  supplier_id,
  name,
  country,
  contact,
  certifications = [],
  risk_level = "medium",
  notes,
  metadata = {},
} = {}) {
  const id = _norm(supplier_id) || _id("sup");
  const existing = _state.suppliers.find((s) => s.supplier_id === id);

  const rec = {
    supplier_id: id,
    name: _norm(name) || existing?.name || id,
    country: _norm(country),
    contact: _norm(contact),
    certifications: Array.isArray(certifications) ? certifications.map(_norm).filter(Boolean) : [],
    risk_level: _norm(risk_level) || "medium",
    notes: _norm(notes),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: existing?.created_at || _now(),
    updated_at: _now(),
  };

  if (existing) Object.assign(existing, rec);
  else _state.suppliers.push(rec);

  return { ok: true, supplier: rec };
}

export function food_supplier_list({ q, risk_level, limit = 100 } = {}) {
  let out = [..._state.suppliers];
  if (_norm(risk_level)) out = out.filter((s) => _lower(s.risk_level) === _lower(risk_level));
  if (_norm(q)) {
    const n = _lower(q);
    out = out.filter((s) => [s.name, s.country, s.contact, (s.certifications || []).join(" "), s.notes].map(_lower).some((f) => f.includes(n)));
  }
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, suppliers: out.slice(0, limit) };
}

export function food_product_upsert({
  product_id,
  name,
  category,
  allergens = [],
  shelf_life_days,
  storage = "ambient",
  spec,
  metadata = {},
} = {}) {
  const id = _norm(product_id) || _id("prod");
  const existing = _state.products.find((p) => p.product_id === id);

  const rec = {
    product_id: id,
    name: _norm(name) || existing?.name || id,
    category: _norm(category),
    allergens: Array.isArray(allergens) ? allergens.map(_norm).filter(Boolean) : [],
    shelf_life_days: shelf_life_days === undefined ? null : Number(shelf_life_days),
    storage: _norm(storage) || "ambient",
    spec: _norm(spec),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: existing?.created_at || _now(),
    updated_at: _now(),
  };

  if (existing) Object.assign(existing, rec);
  else _state.products.push(rec);

  return { ok: true, product: rec };
}

export function food_product_list({ q, category, storage, limit = 100 } = {}) {
  let out = [..._state.products];
  if (_norm(category)) out = out.filter((p) => _lower(p.category) === _lower(category));
  if (_norm(storage)) out = out.filter((p) => _lower(p.storage) === _lower(storage));
  if (_norm(q)) {
    const n = _lower(q);
    out = out.filter((p) => [p.name, p.category, (p.allergens || []).join(" "), p.storage, p.spec].map(_lower).some((f) => f.includes(n)));
  }
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, products: out.slice(0, limit) };
}

export function food_lot_create({
  product_id,
  supplier_id,
  lot_code,
  produced_at,
  expires_at,
  quantity,
  unit = "ea",
  storage_location,
  metadata = {},
} = {}) {
  _require(product_id, "product_id");
  _require(lot_code, "lot_code");

  const product = _state.products.find((p) => p.product_id === _norm(product_id));
  if (!product) return { ok: false, error: "PRODUCT_NOT_FOUND", product_id: _norm(product_id) };

  const supplier = _norm(supplier_id) ? _state.suppliers.find((s) => s.supplier_id === _norm(supplier_id)) : null;

  const lot_id = _id("lot");
  const rec = {
    lot_id,
    product_id: product.product_id,
    supplier_id: supplier?.supplier_id || _norm(supplier_id),
    lot_code: _norm(lot_code),
    produced_at: _norm(produced_at),
    expires_at: _norm(expires_at),
    quantity: quantity === undefined ? null : Number(quantity),
    unit: _norm(unit) || "ea",
    storage_location: _norm(storage_location),
    status: "released",
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: _now(),
    updated_at: _now(),
  };

  _state.lots.push(rec);
  return { ok: true, lot: rec };
}

export function food_lot_list({ product_id, supplier_id, status, q, limit = 100 } = {}) {
  let out = [..._state.lots];
  if (_norm(product_id)) out = out.filter((l) => l.product_id === _norm(product_id));
  if (_norm(supplier_id)) out = out.filter((l) => _lower(l.supplier_id) === _lower(supplier_id));
  if (_norm(status)) out = out.filter((l) => _lower(l.status) === _lower(status));
  if (_norm(q)) {
    const n = _lower(q);
    out = out.filter((l) => [l.lot_code, l.storage_location, l.status].map(_lower).some((f) => f.includes(n)));
  }
  out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return { ok: true, lots: out.slice(0, limit) };
}

export function food_ccp_check_log({
  lot_id,
  ccp = "temperature",
  measured_value,
  unit,
  within_limits,
  operator,
  observed_at,
  notes,
  metadata = {},
} = {}) {
  _require(lot_id, "lot_id");
  _require(measured_value, "measured_value");

  const lot = _state.lots.find((l) => l.lot_id === _norm(lot_id));
  if (!lot) return { ok: false, error: "LOT_NOT_FOUND", lot_id: _norm(lot_id) };

  const check_id = _id("ccp");
  const rec = {
    check_id,
    lot_id: lot.lot_id,
    product_id: lot.product_id,
    supplier_id: lot.supplier_id,
    ccp: _norm(ccp) || "temperature",
    measured_value: Number(measured_value),
    unit: _norm(unit),
    within_limits: within_limits === undefined ? null : Boolean(within_limits),
    operator: _norm(operator),
    observed_at: _norm(observed_at) || _now(),
    notes: _norm(notes),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: _now(),
  };

  _state.ccpChecks.push(rec);
  return { ok: true, check: rec };
}

export function food_ccp_check_list({ lot_id, ccp, limit = 200 } = {}) {
  let out = [..._state.ccpChecks];
  if (_norm(lot_id)) out = out.filter((c) => c.lot_id === _norm(lot_id));
  if (_norm(ccp)) out = out.filter((c) => _lower(c.ccp) === _lower(ccp));
  out.sort((a, b) => (b.observed_at || "").localeCompare(a.observed_at || ""));
  return { ok: true, checks: out.slice(0, limit) };
}

export function food_recall_simulate({
  lot_id,
  reason,
  risk_level = "high",
  initiated_by,
} = {}) {
  _require(lot_id, "lot_id");

  const lot = _state.lots.find((l) => l.lot_id === _norm(lot_id));
  if (!lot) return { ok: false, error: "LOT_NOT_FOUND", lot_id: _norm(lot_id) };

  lot.status = "recalled";
  lot.updated_at = _now();

  const recall_id = _id("recall");
  const rec = {
    recall_id,
    lot_id: lot.lot_id,
    product_id: lot.product_id,
    supplier_id: lot.supplier_id,
    reason: _norm(reason),
    risk_level: _norm(risk_level) || "high",
    initiated_by: _norm(initiated_by),
    initiated_at: _now(),
  };

  _state.recalls.push(rec);
  return { ok: true, recall: rec, impacted_lot: lot };
}

export function food_recall_list({ product_id, risk_level, limit = 100 } = {}) {
  let out = [..._state.recalls];
  if (_norm(product_id)) out = out.filter((r) => r.product_id === _norm(product_id));
  if (_norm(risk_level)) out = out.filter((r) => _lower(r.risk_level) === _lower(risk_level));
  out.sort((a, b) => (b.initiated_at || "").localeCompare(a.initiated_at || ""));
  return { ok: true, recalls: out.slice(0, limit) };
}
