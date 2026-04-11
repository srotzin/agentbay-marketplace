/**
 * Litigation Support Service
 *
 * A lightweight litigation ops module for agents: matters, evidence items,
 * deposition/task trackers, and privilege log helpers.
 *
 * Notes:
 * - This is NOT legal advice.
 * - This is a prototyping-oriented data layer; persistency is in-memory.
 */

const _state = globalThis.__hive_litigationSupport || {
  matters: [],
  evidence: [],
  tasks: [],
  privilegeLog: [],
};

globalThis.__hive_litigationSupport = _state;

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

export function litigation_matter_create({
  title,
  client,
  jurisdiction,
  court,
  case_number,
  counsel,
  opposing_party,
  stage = "pre-filing",
  notes,
  tags = [],
  metadata = {},
} = {}) {
  _require(title, "title");

  const matter_id = _id("matter");
  const rec = {
    matter_id,
    title: _norm(title),
    client: _norm(client),
    jurisdiction: _norm(jurisdiction),
    court: _norm(court),
    case_number: _norm(case_number),
    counsel: _norm(counsel),
    opposing_party: _norm(opposing_party),
    stage: _norm(stage) || "pre-filing",
    notes: _norm(notes),
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: _now(),
    updated_at: _now(),
  };
  _state.matters.push(rec);
  return { ok: true, matter: rec };
}

export function litigation_matter_list({ q, stage, limit = 50 } = {}) {
  let out = [..._state.matters];
  if (_norm(stage)) out = out.filter((m) => _lower(m.stage) === _lower(stage));
  if (_norm(q)) {
    const n = _lower(q);
    out = out.filter((m) =>
      [m.title, m.client, m.jurisdiction, m.court, m.case_number, m.counsel, m.opposing_party, m.notes]
        .map(_lower)
        .some((f) => f.includes(n))
    );
  }
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, matters: out.slice(0, limit) };
}

export function litigation_evidence_add({
  matter_id,
  title,
  source,
  collected_at,
  custodian,
  file_hash,
  uri,
  description,
  confidentiality = "confidential",
  tags = [],
  metadata = {},
} = {}) {
  _require(matter_id, "matter_id");
  _require(title, "title");

  const matter = _state.matters.find((m) => m.matter_id === _norm(matter_id));
  if (!matter) return { ok: false, error: "MATTER_NOT_FOUND", matter_id: _norm(matter_id) };

  const evidence_id = _id("evi");
  const rec = {
    evidence_id,
    matter_id: matter.matter_id,
    title: _norm(title),
    source: _norm(source),
    collected_at: _norm(collected_at) || _now(),
    custodian: _norm(custodian),
    file_hash: _norm(file_hash),
    uri: _norm(uri),
    description: _norm(description),
    confidentiality: _norm(confidentiality) || "confidential",
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: _now(),
    updated_at: _now(),
  };

  _state.evidence.push(rec);
  return { ok: true, evidence: rec };
}

export function litigation_evidence_list({ matter_id, q, confidentiality, limit = 100 } = {}) {
  let out = [..._state.evidence];
  if (_norm(matter_id)) out = out.filter((e) => e.matter_id === _norm(matter_id));
  if (_norm(confidentiality)) out = out.filter((e) => _lower(e.confidentiality) === _lower(confidentiality));
  if (_norm(q)) {
    const n = _lower(q);
    out = out.filter((e) =>
      [e.title, e.source, e.custodian, e.file_hash, e.uri, e.description]
        .map(_lower)
        .some((f) => f.includes(n))
    );
  }
  out.sort((a, b) => (b.collected_at || "").localeCompare(a.collected_at || ""));
  return { ok: true, evidence: out.slice(0, limit) };
}

export function litigation_task_create({
  matter_id,
  title,
  type = "general",
  owner,
  due_at,
  status = "open",
  priority = "P3",
  related_evidence_id,
  notes,
  tags = [],
} = {}) {
  _require(matter_id, "matter_id");
  _require(title, "title");

  const matter = _state.matters.find((m) => m.matter_id === _norm(matter_id));
  if (!matter) return { ok: false, error: "MATTER_NOT_FOUND", matter_id: _norm(matter_id) };

  const task_id = _id("task");
  const rec = {
    task_id,
    matter_id: matter.matter_id,
    title: _norm(title),
    type: _norm(type) || "general",
    owner: _norm(owner),
    due_at: _norm(due_at),
    status: _norm(status) || "open",
    priority: _norm(priority) || "P3",
    related_evidence_id: _norm(related_evidence_id),
    notes: _norm(notes),
    tags: Array.isArray(tags) ? tags.map(_norm).filter(Boolean) : [],
    created_at: _now(),
    updated_at: _now(),
    completed_at: null,
  };

  _state.tasks.push(rec);
  return { ok: true, task: rec };
}

export function litigation_task_list({ matter_id, status, owner, type, limit = 100 } = {}) {
  let out = [..._state.tasks];
  if (_norm(matter_id)) out = out.filter((t) => t.matter_id === _norm(matter_id));
  if (_norm(status)) out = out.filter((t) => _lower(t.status) === _lower(status));
  if (_norm(owner)) out = out.filter((t) => _lower(t.owner) === _lower(owner));
  if (_norm(type)) out = out.filter((t) => _lower(t.type) === _lower(type));
  out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return { ok: true, tasks: out.slice(0, limit) };
}

export function litigation_task_update({ task_id, status, owner, due_at, notes } = {}) {
  _require(task_id, "task_id");
  const task = _state.tasks.find((t) => t.task_id === _norm(task_id));
  if (!task) return { ok: false, error: "TASK_NOT_FOUND", task_id: _norm(task_id) };

  if (_norm(status)) task.status = _norm(status);
  if (_norm(owner)) task.owner = _norm(owner);
  if (_norm(due_at)) task.due_at = _norm(due_at);
  if (_norm(notes)) task.notes = _norm(notes);

  if (_norm(status) && _lower(status) === "done") task.completed_at = _now();
  task.updated_at = _now();
  return { ok: true, task };
}

export function litigation_privilege_log_add({
  matter_id,
  doc_id,
  date,
  author,
  recipients = [],
  privilege_basis,
  description,
  bates_start,
  bates_end,
  notes,
  metadata = {},
} = {}) {
  _require(matter_id, "matter_id");
  _require(doc_id, "doc_id");

  const matter = _state.matters.find((m) => m.matter_id === _norm(matter_id));
  if (!matter) return { ok: false, error: "MATTER_NOT_FOUND", matter_id: _norm(matter_id) };

  const entry_id = _id("priv");
  const rec = {
    entry_id,
    matter_id: matter.matter_id,
    doc_id: _norm(doc_id),
    date: _norm(date),
    author: _norm(author),
    recipients: Array.isArray(recipients) ? recipients.map(_norm).filter(Boolean) : [],
    privilege_basis: _norm(privilege_basis) || "attorney-client",
    description: _norm(description),
    bates_start: _norm(bates_start),
    bates_end: _norm(bates_end),
    notes: _norm(notes),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    created_at: _now(),
    updated_at: _now(),
  };

  _state.privilegeLog.push(rec);
  return { ok: true, entry: rec };
}

export function litigation_privilege_log_list({ matter_id, limit = 200 } = {}) {
  let out = [..._state.privilegeLog];
  if (_norm(matter_id)) out = out.filter((p) => p.matter_id === _norm(matter_id));
  out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return { ok: true, entries: out.slice(0, limit) };
}
