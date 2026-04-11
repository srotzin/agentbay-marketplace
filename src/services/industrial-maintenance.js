/**
 * Industrial Maintenance Service (CMMS-lite)
 *
 * Work orders, assets, preventive maintenance schedules, and downtime logging.
 * Intended for agent workflows and prototypes.
 */

const _state = globalThis.__hive_industrialMaintenance || {
  assets: [],
  workOrders: [],
  pmPlans: [],
  downtime: [],
};

globalThis.__hive_industrialMaintenance = _state;

function _now() {
  return new Date().toISOString();
}

function _id(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function _norm(str) {
  return String(str || "").trim();
}

function _require(value, name) {
  if (value === undefined || value === null || _norm(value) === "") {
    const err = new Error(`Missing required field: ${name}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

function _ms(hours) {
  return Math.round(Number(hours) * 3600 * 1000);
}

export function im_asset_upsert({
  asset_id,
  name,
  type = "equipment",
  site,
  line,
  manufacturer,
  model,
  serial,
  criticality = "medium",
  tags = [],
  metadata = {},
} = {}) {
  const id = _norm(asset_id) || _id("asset");
  const existing = _state.assets.find((a) => a.asset_id === id);

  const record = {
    asset_id: id,
    name: _norm(name) || existing?.name || id,
    type: _norm(type) || "equipment",
    site: _norm(site),
    line: _norm(line),
    manufacturer: _norm(manufacturer),
    model: _norm(model),
    serial: _norm(serial),
    criticality: _norm(criticality) || "medium",
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    updated_at: _now(),
    created_at: existing?.created_at || _now(),
  };

  if (existing) Object.assign(existing, record);
  else _state.assets.push(record);

  return { ok: true, asset: record };
}

export function im_asset_list({ site, q, limit = 100 } = {}) {
  let out = [..._state.assets];
  if (_norm(site)) out = out.filter((a) => _norm(a.site).toLowerCase() === _norm(site).toLowerCase());
  if (_norm(q)) {
    const n = _norm(q).toLowerCase();
    out = out.filter((a) =>
      [a.name, a.type, a.site, a.line, a.manufacturer, a.model, a.serial].some((f) => _norm(f).toLowerCase().includes(n))
    );
  }
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, assets: out.slice(0, limit) };
}

export function im_work_order_create({
  asset_id,
  title,
  description,
  priority = "P3",
  requested_by,
  assigned_to,
  due_at,
  tags = [],
} = {}) {
  _require(asset_id, "asset_id");
  _require(title, "title");

  const asset = _state.assets.find((a) => a.asset_id === _norm(asset_id));
  if (!asset) return { ok: false, error: "ASSET_NOT_FOUND", asset_id: _norm(asset_id) };

  const work_order_id = _id("wo");
  const record = {
    work_order_id,
    asset_id: asset.asset_id,
    title: _norm(title),
    description: _norm(description),
    priority: _norm(priority) || "P3",
    status: "open",
    requested_by: _norm(requested_by),
    assigned_to: _norm(assigned_to),
    due_at: _norm(due_at),
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    created_at: _now(),
    updated_at: _now(),
    completed_at: null,
  };

  _state.workOrders.push(record);
  return { ok: true, work_order: record };
}

export function im_work_order_list({
  status,
  asset_id,
  priority,
  limit = 50,
} = {}) {
  let out = [..._state.workOrders];
  if (_norm(status)) out = out.filter((w) => _norm(w.status).toLowerCase() === _norm(status).toLowerCase());
  if (_norm(asset_id)) out = out.filter((w) => w.asset_id === _norm(asset_id));
  if (_norm(priority)) out = out.filter((w) => _norm(w.priority).toUpperCase() === _norm(priority).toUpperCase());
  out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return { ok: true, work_orders: out.slice(0, limit) };
}

export function im_work_order_update({
  work_order_id,
  status,
  assigned_to,
  due_at,
  resolution_notes,
} = {}) {
  _require(work_order_id, "work_order_id");
  const wo = _state.workOrders.find((w) => w.work_order_id === _norm(work_order_id));
  if (!wo) return { ok: false, error: "WORK_ORDER_NOT_FOUND", work_order_id: _norm(work_order_id) };

  if (_norm(status)) wo.status = _norm(status);
  if (_norm(assigned_to)) wo.assigned_to = _norm(assigned_to);
  if (_norm(due_at)) wo.due_at = _norm(due_at);
  if (_norm(resolution_notes)) wo.resolution_notes = _norm(resolution_notes);
  if (_norm(status) && _norm(status).toLowerCase() === "completed") {
    wo.completed_at = _now();
  }
  wo.updated_at = _now();
  return { ok: true, work_order: wo };
}

export function im_pm_plan_create({
  asset_id,
  name,
  interval_hours,
  interval_days,
  checklist = [],
  owner,
} = {}) {
  _require(asset_id, "asset_id");
  _require(name, "name");

  const asset = _state.assets.find((a) => a.asset_id === _norm(asset_id));
  if (!asset) return { ok: false, error: "ASSET_NOT_FOUND", asset_id: _norm(asset_id) };

  const pm_plan_id = _id("pm");
  const interval = {
    hours: interval_hours === undefined ? null : Number(interval_hours),
    days: interval_days === undefined ? null : Number(interval_days),
  };

  const record = {
    pm_plan_id,
    asset_id: asset.asset_id,
    name: _norm(name),
    interval,
    checklist: Array.isArray(checklist) ? checklist.map(_norm).filter(Boolean) : [],
    owner: _norm(owner),
    created_at: _now(),
    updated_at: _now(),
  };

  // next_due is a helper value; if interval is missing we keep it null
  const base = Date.now();
  if (interval.days) record.next_due_at = new Date(base + interval.days * 24 * 3600 * 1000).toISOString();
  else if (interval.hours) record.next_due_at = new Date(base + _ms(interval.hours)).toISOString();
  else record.next_due_at = null;

  _state.pmPlans.push(record);
  return { ok: true, pm_plan: record };
}

export function im_pm_plan_list({ asset_id, limit = 100 } = {}) {
  let out = [..._state.pmPlans];
  if (_norm(asset_id)) out = out.filter((p) => p.asset_id === _norm(asset_id));
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, pm_plans: out.slice(0, limit) };
}

export function im_downtime_log({
  asset_id,
  started_at,
  ended_at,
  minutes,
  category = "unplanned",
  reason,
  cost_usd,
} = {}) {
  _require(asset_id, "asset_id");

  const asset = _state.assets.find((a) => a.asset_id === _norm(asset_id));
  if (!asset) return { ok: false, error: "ASSET_NOT_FOUND", asset_id: _norm(asset_id) };

  const record = {
    downtime_id: _id("dt"),
    asset_id: asset.asset_id,
    started_at: _norm(started_at),
    ended_at: _norm(ended_at),
    minutes: minutes === undefined ? null : Number(minutes),
    category: _norm(category) || "unplanned",
    reason: _norm(reason),
    cost_usd: cost_usd === undefined ? null : Number(cost_usd),
    created_at: _now(),
  };

  _state.downtime.push(record);
  return { ok: true, downtime: record };
}

export function im_asset_kpis({ asset_id } = {}) {
  _require(asset_id, "asset_id");

  const asset = _state.assets.find((a) => a.asset_id === _norm(asset_id));
  if (!asset) return { ok: false, error: "ASSET_NOT_FOUND", asset_id: _norm(asset_id) };

  const wos = _state.workOrders.filter((w) => w.asset_id === asset.asset_id);
  const dts = _state.downtime.filter((d) => d.asset_id === asset.asset_id);

  const completed = wos.filter((w) => _norm(w.status).toLowerCase() === "completed");
  const totalDowntimeMinutes = dts.reduce((sum, d) => sum + (Number.isFinite(d.minutes) ? d.minutes : 0), 0);

  // crude MTTR estimation: average time between created_at and completed_at (minutes)
  const mttrMinutes = completed.length
    ? Math.round(
        completed.reduce((sum, w) => sum + (new Date(w.completed_at).getTime() - new Date(w.created_at).getTime()) / 60000, 0) /
          completed.length
      )
    : null;

  return {
    ok: true,
    kpis: {
      asset,
      work_orders_total: wos.length,
      work_orders_open: wos.filter((w) => _norm(w.status).toLowerCase() === "open").length,
      work_orders_completed: completed.length,
      downtime_events: dts.length,
      downtime_minutes_total: totalDowntimeMinutes,
      mttr_minutes_estimate: mttrMinutes,
      generated_at: _now(),
    },
  };
}
