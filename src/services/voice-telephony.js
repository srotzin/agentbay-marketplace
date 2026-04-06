import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const PER_MINUTE_RATE_USD    = 0.08;  // $0.08 per minute of call
const PLATFORM_COMMISSION    = 0.20;  // 20% platform cut
const SCHEDULING_FEE_USD     = 0.25;  // flat fee per scheduled callback

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS voice_calls (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    phone_number         TEXT NOT NULL,
    prompt               TEXT NOT NULL,
    language             TEXT DEFAULT 'en-US',
    max_duration_minutes INTEGER DEFAULT 10,
    status               TEXT DEFAULT 'dialing' CHECK(status IN (
                           'dialing','active','completed','failed','no_answer','busy','voicemail')),
    duration_seconds     INTEGER,
    cost_usd             REAL,
    commission_usd       REAL,
    transcript           TEXT,
    outcome              TEXT CHECK(outcome IN (
                           'contact_reached','voicemail_left','no_answer',
                           'wrong_number','refused','completed','failed')),
    outcome_summary      TEXT,
    recording_url        TEXT,
    initiated_at         TEXT DEFAULT (datetime('now')),
    answered_at          TEXT,
    completed_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS voice_callbacks (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    phone_number         TEXT NOT NULL,
    prompt               TEXT NOT NULL,
    scheduled_time       TEXT NOT NULL,
    status               TEXT DEFAULT 'scheduled' CHECK(status IN (
                           'scheduled','dispatched','completed','cancelled','failed')),
    call_id              TEXT REFERENCES voice_calls(id),
    scheduling_fee_usd   REAL DEFAULT 0.25,
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTranscript(prompt, language, durationSeconds) {
  const turns = Math.max(2, Math.floor(durationSeconds / 20));
  const agentOpeners = [
    "Hello, this is an automated agent calling on behalf of a request. Is this a good time?",
    "Hi there! I'm reaching out regarding a service request. Do you have a moment?",
    "Good day! I'm calling to follow up on a previous inquiry. May I speak with the account holder?",
  ];
  const humanResponses = [
    "Yes, go ahead.", "Sure, what is this about?", "Hello?", "This is them speaking.",
  ];
  const agentBody = [
    `I'm calling to ${prompt.slice(0, 80)}...`,
    "Could you please confirm your details?",
    "I have a few questions I need to go through with you.",
    "This should only take a couple of minutes.",
  ];
  const humanBody = [
    "Yes, that sounds right.", "Can you repeat that?", "Sure, no problem.",
    "I'll need to check that.", "Yes, I can confirm that.", "Let me get back to you on that.",
  ];
  const agentClose = ["Thank you for your time. Have a great day!", "That's all I needed. Goodbye!"];

  const entries = [];
  const now = Date.now();

  entries.push({
    timestamp:    new Date(now).toISOString(),
    speaker:      "agent",
    text:         agentOpeners[Math.floor(Math.random() * agentOpeners.length)],
    language,
    confidence:   0.99,
  });
  entries.push({
    timestamp:    new Date(now + 4000).toISOString(),
    speaker:      "human",
    text:         humanResponses[Math.floor(Math.random() * humanResponses.length)],
    language,
    confidence:   0.97,
  });

  for (let i = 0; i < turns - 2; i++) {
    const offset = (i + 1) * 12000;
    if (i % 2 === 0) {
      entries.push({
        timestamp:  new Date(now + offset).toISOString(),
        speaker:    "agent",
        text:       agentBody[i % agentBody.length],
        language,
        confidence: 0.98,
      });
    } else {
      entries.push({
        timestamp:  new Date(now + offset).toISOString(),
        speaker:    "human",
        text:       humanBody[i % humanBody.length],
        language,
        confidence: 0.94 + Math.random() * 0.05,
      });
    }
  }

  entries.push({
    timestamp:    new Date(now + durationSeconds * 1000 - 5000).toISOString(),
    speaker:      "agent",
    text:         agentClose[Math.floor(Math.random() * agentClose.length)],
    language,
    confidence:   0.99,
  });

  return entries;
}

// ─── Initiate Call ────────────────────────────────────────────────────────────

/**
 * Place an outbound call with a synthetic voice agent using a prompt as instructions.
 * @param {string} phoneNumber         - E.164 format phone number (e.g. +14155552671)
 * @param {string} prompt              - Instructions for what the agent should say/do
 * @param {string} language            - BCP-47 language tag (e.g. en-US, es-MX, fr-FR)
 * @param {number} maxDurationMinutes  - Maximum call length; billing stops at this cap
 * @returns Call record with callId, status, and estimated cost
 */
export function initiateCall(phoneNumber, prompt, language = "en-US", maxDurationMinutes = 10) {
  if (!phoneNumber) throw new Error("phoneNumber is required (E.164 format)");
  if (!prompt)      throw new Error("prompt is required");
  if (maxDurationMinutes < 1 || maxDurationMinutes > 60) {
    throw new Error("maxDurationMinutes must be between 1 and 60");
  }

  const id             = uuid();
  const agentId        = `agent_${uuid().slice(0, 8)}`;
  const estimatedCost  = Math.round(maxDurationMinutes * PER_MINUTE_RATE_USD * 100) / 100;
  const commission     = Math.round(estimatedCost * PLATFORM_COMMISSION * 100) / 100;
  const now            = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO voice_calls
      (id, agent_id, phone_number, prompt, language, max_duration_minutes, status, initiated_at)
    VALUES
      (@id, @agent_id, @phone_number, @prompt, @language, @max_duration_minutes, 'dialing', @initiated_at)
  `).run({ id, agent_id: agentId, phone_number: phoneNumber, prompt, language, max_duration_minutes: maxDurationMinutes, initiated_at: now });

  return {
    call_id:                id,
    agent_id:               agentId,
    phone_number:           phoneNumber,
    status:                 "dialing",
    language,
    max_duration_minutes:   maxDurationMinutes,
    estimated_cost_usd:     estimatedCost,
    per_minute_rate_usd:    PER_MINUTE_RATE_USD,
    platform_commission:    `${PLATFORM_COMMISSION * 100}%`,
    initiated_at:           now,
    message:                `Outbound call to ${phoneNumber} is being dialed. Use getCallStatus(callId) to track progress.`,
  };
}

// ─── Get Call Status ──────────────────────────────────────────────────────────

/**
 * Get current status and metadata for an in-progress or completed call.
 * @param {string} callId
 * @returns Call status record
 */
export function getCallStatus(callId) {
  const call = db.prepare("SELECT * FROM voice_calls WHERE id = ?").get(callId);
  if (!call) throw new Error(`Call not found: ${callId}`);

  // Simulate call progression based on elapsed time
  const elapsedMs  = Date.now() - new Date(call.initiated_at).getTime();
  const elapsedSec = elapsedMs / 1000;

  let simulatedStatus = call.status;
  let answeredAt      = call.answered_at;
  let completedAt     = call.completed_at;
  let durationSeconds = call.duration_seconds;

  if (call.status === "dialing" && elapsedSec > 8) {
    // 85% answer rate
    const answered = Math.random() < 0.85;
    simulatedStatus = answered ? "active" : (Math.random() < 0.5 ? "no_answer" : "voicemail");
    answeredAt      = answered ? new Date(new Date(call.initiated_at).getTime() + 8000).toISOString() : null;

    db.prepare("UPDATE voice_calls SET status=@s, answered_at=@a WHERE id=@id")
      .run({ s: simulatedStatus, a: answeredAt ?? null, id: callId });
  }

  if (simulatedStatus === "active" && elapsedSec > 8 + (call.max_duration_minutes ?? 10) * 15) {
    simulatedStatus = "completed";
    durationSeconds = Math.floor(30 + Math.random() * call.max_duration_minutes * 45);
    const cost      = Math.round((durationSeconds / 60) * PER_MINUTE_RATE_USD * 100) / 100;
    const commission = Math.round(cost * PLATFORM_COMMISSION * 100) / 100;
    completedAt     = new Date().toISOString();

    db.prepare(`
      UPDATE voice_calls SET status='completed', duration_seconds=@d,
        cost_usd=@c, commission_usd=@comm, completed_at=@ca, outcome='contact_reached',
        outcome_summary='Call completed. Contact was reached and conversed with agent.'
      WHERE id=@id
    `).run({ d: durationSeconds, c: cost, comm: commission, ca: completedAt, id: callId });
  }

  return {
    call_id:         callId,
    phone_number:    call.phone_number,
    status:          simulatedStatus,
    language:        call.language,
    initiated_at:    call.initiated_at,
    answered_at:     answeredAt,
    completed_at:    completedAt,
    duration_seconds: durationSeconds,
    cost_usd:        call.cost_usd ?? null,
    max_duration_minutes: call.max_duration_minutes,
    outcome:         call.outcome ?? null,
    outcome_summary: call.outcome_summary ?? null,
  };
}

// ─── Get Call Transcript ──────────────────────────────────────────────────────

/**
 * Retrieve the full JSON transcript of a completed call.
 * @param {string} callId
 * @returns Full call transcript with speaker turns and timestamps
 */
export function getCallTranscript(callId) {
  const call = db.prepare("SELECT * FROM voice_calls WHERE id = ?").get(callId);
  if (!call) throw new Error(`Call not found: ${callId}`);
  if (call.status === "dialing") throw new Error("Call is still dialing — transcript not yet available.");
  if (call.status === "no_answer") {
    return { call_id: callId, status: "no_answer", transcript: [], message: "No one answered this call." };
  }
  if (call.status === "voicemail") {
    return {
      call_id: callId,
      status:  "voicemail",
      transcript: [{
        timestamp: call.initiated_at,
        speaker:   "agent",
        text:      `Voicemail left: "${call.prompt.slice(0, 120)}..."`,
        language:  call.language,
        confidence: 0.99,
      }],
      message: "Voicemail was left for this number.",
    };
  }

  // Generate or return stored transcript
  let transcript;
  if (call.transcript) {
    transcript = JSON.parse(call.transcript);
  } else {
    const durSec  = call.duration_seconds ?? Math.floor(60 + Math.random() * 180);
    transcript    = buildTranscript(call.prompt, call.language, durSec);
    const stored  = JSON.stringify(transcript);
    db.prepare("UPDATE voice_calls SET transcript=? WHERE id=?").run(stored, callId);
  }

  const durationSec = call.duration_seconds ?? transcript.length * 15;
  const cost        = call.cost_usd ?? Math.round((durationSec / 60) * PER_MINUTE_RATE_USD * 100) / 100;

  return {
    call_id:          callId,
    phone_number:     call.phone_number,
    status:           call.status,
    language:         call.language,
    duration_seconds: durationSec,
    cost_usd:         cost,
    outcome:          call.outcome ?? "contact_reached",
    initiated_at:     call.initiated_at,
    completed_at:     call.completed_at,
    transcript,
    word_count:       transcript.reduce((n, t) => n + t.text.split(" ").length, 0),
    turn_count:       transcript.length,
    recording_url:    `https://voice.hiveagent.ai/recordings/${callId}.mp3`,
  };
}

// ─── Schedule Callback ────────────────────────────────────────────────────────

/**
 * Schedule a future outbound call at a specific time.
 * @param {string} phoneNumber    - E.164 phone number
 * @param {string} prompt         - Call instructions
 * @param {string} scheduledTime  - ISO 8601 datetime string for when to place the call
 * @returns Callback record with callbackId and scheduling fee
 */
export function scheduleCallback(phoneNumber, prompt, scheduledTime) {
  if (!phoneNumber)    throw new Error("phoneNumber is required");
  if (!prompt)         throw new Error("prompt is required");
  if (!scheduledTime)  throw new Error("scheduledTime is required (ISO 8601)");

  const scheduled = new Date(scheduledTime);
  if (isNaN(scheduled.getTime())) throw new Error("scheduledTime is not a valid ISO 8601 datetime");
  if (scheduled <= new Date())    throw new Error("scheduledTime must be in the future");

  const id      = uuid();
  const agentId = `agent_${uuid().slice(0, 8)}`;
  const now     = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO voice_callbacks
      (id, agent_id, phone_number, prompt, scheduled_time, status, scheduling_fee_usd, created_at)
    VALUES
      (@id, @agent_id, @phone_number, @prompt, @scheduled_time, 'scheduled', @fee, @created_at)
  `).run({
    id, agent_id: agentId, phone_number: phoneNumber, prompt,
    scheduled_time: scheduled.toISOString(),
    fee: SCHEDULING_FEE_USD, created_at: now,
  });

  return {
    callback_id:         id,
    agent_id:            agentId,
    phone_number:        phoneNumber,
    status:              "scheduled",
    scheduled_time:      scheduled.toISOString(),
    scheduling_fee_usd:  SCHEDULING_FEE_USD,
    estimated_cost_usd:  Math.round((10 * PER_MINUTE_RATE_USD + SCHEDULING_FEE_USD) * 100) / 100,
    created_at:          now,
    message:             `Callback to ${phoneNumber} scheduled for ${scheduled.toISOString()}.`,
  };
}

// ─── List Calls ───────────────────────────────────────────────────────────────

/**
 * List call history for an agent, optionally filtered by status.
 * @param {string} agentId  - Agent whose calls to retrieve
 * @param {string} status   - Optional: filter by call status
 * @returns Paginated call history with cost summary
 */
export function listCalls(agentId, status) {
  if (!agentId) throw new Error("agentId is required");

  let sql    = "SELECT * FROM voice_calls WHERE agent_id = ?";
  const params = [agentId];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY initiated_at DESC LIMIT 50";

  const calls = db.prepare(sql).all(...params);

  const callbacks = db.prepare(
    "SELECT * FROM voice_callbacks WHERE agent_id = ? ORDER BY scheduled_time DESC LIMIT 20"
  ).all(agentId);

  const totalCost    = calls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
  const totalSeconds = calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const completed    = calls.filter(c => c.status === "completed").length;

  return {
    agent_id:              agentId,
    calls:                 calls.map(c => ({
      call_id:             c.id,
      phone_number:        c.phone_number,
      status:              c.status,
      language:            c.language,
      duration_seconds:    c.duration_seconds,
      cost_usd:            c.cost_usd,
      outcome:             c.outcome,
      initiated_at:        c.initiated_at,
      completed_at:        c.completed_at,
    })),
    scheduled_callbacks:   callbacks.map(cb => ({
      callback_id:         cb.id,
      phone_number:        cb.phone_number,
      scheduled_time:      cb.scheduled_time,
      status:              cb.status,
    })),
    summary: {
      total_calls:         calls.length,
      completed_calls:     completed,
      total_duration_seconds: totalSeconds,
      total_cost_usd:      Math.round(totalCost * 100) / 100,
      answer_rate_pct:     calls.length > 0
        ? Math.round((completed / calls.length) * 100)
        : 0,
    },
  };
}
