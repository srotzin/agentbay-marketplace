/**
 * Public Safety Dispatch Service
 *
 * Lightweight in-memory primitives for 911-style incident intake, triage, unit dispatch,
 * and after-action reporting. Designed for agent workflows, tabletop exercises, and
 * prototyping — not as a replacement for CAD/RMS.
 */

const _state = globalThis.__hive_publicSafetyDispatch || {
  incidents: [],
  units: [],
  dispatches: [],
  notes: [],
};

globalThis.__hive_publicSafetyDispatch = _state;

function _now() {
  return new Date().toISOString();
}

function _id(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function _norm(str) {
  return String(str || "").trim();
}

function _match(hay, needle) {
  const h = _norm(hay).toLowerCase();
  const n = _norm(needle).toLowerCase();
  if (!n) return true;
  return h.includes(n);
}

function _require(value, name) {
  if (value === undefined || value === null || _norm(value) === "") {
    const err = new Error(`Missing required field: ${name}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

function _severityScore(severity) {
  const s = _norm(severity).toLowerCase();
  if (["critical", "life_safety", "life-safety", "emergency"].includes(s)) return 4;
  if (["high", "urgent"].includes(s)) return 3;
  if (["medium", "normal"].includes(s)) return 2;
  if (["low"].includes(s)) return 1;
  return 2;
}

function _priorityRank(priority) {
  const p = _norm(priority).toUpperCase();
  if (["P0", "P1", "P2", "P3", "P4"].includes(p)) return parseInt(p.slice(1), 10);
  return 3;
}

export function ps_unit_register({
  unit_id,
  type = "police",
  callsign,
  agency,
  status = "available",
  location,
  capabilities = [],
  notes,
} = {}) {
  const id = _norm(unit_id) || _id("unit");
  const existing = _state.units.find((u) => u.unit_id === id);
  const record = {
    unit_id: id,
    type: _norm(type) || "police",
    callsign: _norm(callsign) || id,
    agency: _norm(agency),
    status: _norm(status) || "available",
    location: _norm(location),
    capabilities: Array.isArray(capabilities) ? capabilities.map(_norm).filter(Boolean) : [],
    notes: _norm(notes),
    updated_at: _now(),
    created_at: existing?.created_at || _now(),
  };

  if (existing) Object.assign(existing, record);
  else _state.units.push(record);
  return { ok: true, unit: record };
}

export function ps_unit_list({ status, type, limit = 100 } = {}) {
  let out = [..._state.units];
  if (_norm(status)) out = out.filter((u) => _norm(u.status).toLowerCase() === _norm(status).toLowerCase());
  if (_norm(type)) out = out.filter((u) => _norm(u.type).toLowerCase() === _norm(type).toLowerCase());
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, units: out.slice(0, limit) };
}

export function ps_incident_create({
  caller_name,
  caller_phone,
  location,
  incident_type = "unknown",
  description,
  severity = "medium",
  priority = "P3",
  reported_at,
  channel = "phone",
  tags = [],
} = {}) {
  _require(location, "location");
  _require(description, "description");

  const incident_id = _id("inc");
  const record = {
    incident_id,
    caller_name: _norm(caller_name),
    caller_phone: _norm(caller_phone),
    location: _norm(location),
    incident_type: _norm(incident_type) || "unknown",
    description: _norm(description),
    severity: _norm(severity) || "medium",
    priority: _norm(priority) || "P3",
    status: "open",
    channel: _norm(channel) || "phone",
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    reported_at: _norm(reported_at) || _now(),
    created_at: _now(),
    updated_at: _now(),
  };
  _state.incidents.push(record);
  return { ok: true, incident: record };
}

export function ps_incident_list({
  status,
  q,
  incident_type,
  min_severity,
  limit = 50,
} = {}) {
  let out = [..._state.incidents];
  if (_norm(status)) out = out.filter((i) => _norm(i.status).toLowerCase() === _norm(status).toLowerCase());
  if (_norm(incident_type)) out = out.filter((i) => _norm(i.incident_type).toLowerCase() === _norm(incident_type).toLowerCase());
  if (_norm(q)) {
    out = out.filter((i) => _match(i.description, q) || _match(i.location, q) || _match(i.caller_name, q));
  }
  if (_norm(min_severity)) {
    const min = _severityScore(min_severity);
    out = out.filter((i) => _severityScore(i.severity) >= min);
  }

  // Sort by (priority asc) then (severity desc) then (reported_at desc)
  out.sort((a, b) => {
    const pr = _priorityRank(a.priority) - _priorityRank(b.priority);
    if (pr !== 0) return pr;
    const sv = _severityScore(b.severity) - _severityScore(a.severity);
    if (sv !== 0) return sv;
    return (b.reported_at || "").localeCompare(a.reported_at || "");
  });

  return { ok: true, incidents: out.slice(0, limit) };
}

export function ps_incident_update({
  incident_id,
  status,
  severity,
  priority,
  description,
  tags,
} = {}) {
  _require(incident_id, "incident_id");
  const inc = _state.incidents.find((i) => i.incident_id === _norm(incident_id));
  if (!inc) return { ok: false, error: "INCIDENT_NOT_FOUND", incident_id: _norm(incident_id) };

  if (_norm(status)) inc.status = _norm(status);
  if (_norm(severity)) inc.severity = _norm(severity);
  if (_norm(priority)) inc.priority = _norm(priority);
  if (_norm(description)) inc.description = _norm(description);
  if (Array.isArray(tags)) inc.tags = tags.map(_norm).filter(Boolean);
  inc.updated_at = _now();

  return { ok: true, incident: inc };
}

export function ps_dispatch_create({
  incident_id,
  unit_id,
  disposition = "dispatched",
  eta_minutes,
  notes,
} = {}) {
  _require(incident_id, "incident_id");
  _require(unit_id, "unit_id");

  const inc = _state.incidents.find((i) => i.incident_id === _norm(incident_id));
  if (!inc) return { ok: false, error: "INCIDENT_NOT_FOUND", incident_id: _norm(incident_id) };

  const unit = _state.units.find((u) => u.unit_id === _norm(unit_id));
  if (!unit) return { ok: false, error: "UNIT_NOT_FOUND", unit_id: _norm(unit_id) };

  const dispatch_id = _id("dsp");
  const record = {
    dispatch_id,
    incident_id: inc.incident_id,
    unit_id: unit.unit_id,
    disposition: _norm(disposition) || "dispatched",
    eta_minutes: eta_minutes === undefined ? null : Number(eta_minutes),
    notes: _norm(notes),
    created_at: _now(),
  };

  _state.dispatches.push(record);
  unit.status = "assigned";
  unit.updated_at = _now();
  inc.updated_at = _now();

  return { ok: true, dispatch: record, incident: inc, unit };
}

export function ps_dispatch_list({ incident_id, unit_id, limit = 100 } = {}) {
  let out = [..._state.dispatches];
  if (_norm(incident_id)) out = out.filter((d) => d.incident_id === _norm(incident_id));
  if (_norm(unit_id)) out = out.filter((d) => d.unit_id === _norm(unit_id));
  out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return { ok: true, dispatches: out.slice(0, limit) };
}

export function ps_note_add({ incident_id, author, text } = {}) {
  _require(incident_id, "incident_id");
  _require(text, "text");
  const inc = _state.incidents.find((i) => i.incident_id === _norm(incident_id));
  if (!inc) return { ok: false, error: "INCIDENT_NOT_FOUND", incident_id: _norm(incident_id) };

  const note = {
    note_id: _id("note"),
    incident_id: inc.incident_id,
    author: _norm(author),
    text: _norm(text),
    created_at: _now(),
  };
  _state.notes.push(note);
  inc.updated_at = _now();
  return { ok: true, note };
}

export function ps_after_action_report({ incident_id } = {}) {
  _require(incident_id, "incident_id");
  const inc = _state.incidents.find((i) => i.incident_id === _norm(incident_id));
  if (!inc) return { ok: false, error: "INCIDENT_NOT_FOUND", incident_id: _norm(incident_id) };

  const dispatches = _state.dispatches.filter((d) => d.incident_id === inc.incident_id);
  const notes = _state.notes.filter((n) => n.incident_id === inc.incident_id);
  const units = dispatches
    .map((d) => _state.units.find((u) => u.unit_id === d.unit_id))
    .filter(Boolean);

  return {
    ok: true,
    report: {
      incident: inc,
      dispatches,
      units,
      notes,
      generated_at: _now(),
      summary:
        `${inc.incident_type || "incident"} at ${inc.location} (priority ${inc.priority}, severity ${inc.severity}) — ` +
        `${dispatches.length} dispatch(es), ${notes.length} note(s).`,
    },
  };
}
