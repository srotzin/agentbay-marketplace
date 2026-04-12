/**
 * Smart Home Automation Service Module
 *
 * Untapped vertical: smart home / property IoT automation.
 *
 * Provides lightweight planning tools for automations, device grouping,
 * and safety checks (no direct device control).
 */

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeDevice(d) {
  const name = (d?.name || "").trim();
  const room = (d?.room || "").trim();
  const type = (d?.type || "").trim();
  const capabilities = uniq((d?.capabilities || []).map((c) => String(c).trim()).filter(Boolean));
  const protocols = uniq((d?.protocols || []).map((p) => String(p).trim()).filter(Boolean));

  if (!name) throw new Error("Device is missing required field: name");

  return {
    name,
    room: room || "unknown",
    type: type || "unknown",
    capabilities,
    protocols,
  };
}

export function homeSuggestAutomations(args = {}) {
  const goal = (args.goal || "").toString().trim();
  const constraints = (args.constraints || []).map((c) => String(c).trim()).filter(Boolean);
  const devices = (args.devices || []).map(normalizeDevice);

  const rooms = uniq(devices.map((d) => d.room));
  const protocols = uniq(devices.flatMap((d) => d.protocols));
  const deviceTypes = uniq(devices.map((d) => d.type));

  const suggestions = [];

  // Basic heuristics based on common capabilities.
  const has = (cap) => devices.some((d) => d.capabilities.includes(cap));

  if (has("motion")) {
    suggestions.push({
      id: "motion_lights",
      title: "Motion-activated lighting",
      description: "Turn on lights when motion is detected; turn off after a timeout.",
      triggers: ["motion_detected"],
      actions: ["light_on", "light_off_after"],
      safety_notes: ["Ensure night-mode brightness to avoid glare."]
    });
  }

  if (has("temperature") && has("thermostat")) {
    suggestions.push({
      id: "comfort_schedule",
      title: "Comfort + savings thermostat schedule",
      description: "Align thermostat setpoints to occupancy and sleep schedule.",
      triggers: ["time_of_day", "presence_change"],
      actions: ["set_temperature"],
      safety_notes: ["Avoid extreme setpoints that risk pipes freezing or overheating."]
    });
  }

  if (has("leak")) {
    suggestions.push({
      id: "leak_response",
      title: "Leak detection response",
      description: "Notify on leak detection; optionally shut off water if you have a valve actuator.",
      triggers: ["leak_detected"],
      actions: ["notify", "water_off_optional"],
      safety_notes: ["Test quarterly; false positives can be disruptive."]
    });
  }

  if (has("door")) {
    suggestions.push({
      id: "door_left_open",
      title: "Door left open alert",
      description: "Notify if an exterior door remains open beyond a threshold.",
      triggers: ["door_open_for"],
      actions: ["notify"],
      safety_notes: ["Tune thresholds to reduce noise."]
    });
  }

  // If no heuristics match, still provide generic patterns.
  if (!suggestions.length) {
    suggestions.push({
      id: "scene_preset",
      title: "Create scenes (home/away/night)",
      description: "Group actions into scenes you can trigger manually or by presence.",
      triggers: ["presence_change", "manual"],
      actions: ["set_scene"],
      safety_notes: ["Avoid automations that lock you out (e.g., auto-lock while inside)."],
    });
  }

  // Lightweight goal alignment ordering.
  const ranked = suggestions.map((s) => {
    let score = 0;
    const g = goal.toLowerCase();
    if (g.includes("energy") && s.id.includes("comfort")) score += 2;
    if (g.includes("security") && (s.id.includes("door") || s.id.includes("leak"))) score += 2;
    if (g.includes("convenience") && s.id.includes("motion")) score += 2;
    if (constraints.some((c) => c.toLowerCase().includes("privacy"))) score += 1;
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);

  return {
    goal: goal || "(none)",
    constraints,
    inventory_summary: {
      device_count: devices.length,
      rooms,
      device_types: deviceTypes,
      protocols,
    },
    suggestions: ranked.map(({ score, ...rest }) => rest),
  };
}

export function homeGenerateRoutineSpec(args = {}) {
  const name = (args.name || "").toString().trim() || "Routine";
  const trigger = args.trigger || { type: "manual" };
  const actions = (args.actions || []).map((a) => ({
    device: (a.device || "").toString().trim(),
    action: (a.action || "").toString().trim(),
    value: a.value,
    delay_seconds: typeof a.delay_seconds === "number" ? a.delay_seconds : undefined,
  })).filter((a) => a.device && a.action);

  if (!actions.length) throw new Error("At least one action is required");

  return {
    name,
    trigger,
    actions,
    notes: [
      "This is a portable routine spec; map actions to your platform (Home Assistant, Alexa, Google Home, etc.).",
      "For safety-critical automations (locks, water shutoff), include manual overrides and test procedures.",
    ],
  };
}

export function homeSafetyCheck(args = {}) {
  const routine = args.routine || {};
  const issues = [];

  const actions = Array.isArray(routine.actions) ? routine.actions : [];
  const actionStrings = actions.map((a) => `${a.action}`.toLowerCase());

  if (actionStrings.some((a) => a.includes("unlock"))) {
    issues.push({ severity: "high", issue: "Routine includes an unlock action", recommendation: "Require presence or a secondary confirmation." });
  }

  if (actionStrings.some((a) => a.includes("water_off")) || actionStrings.some((a) => a.includes("shut"))) {
    issues.push({ severity: "medium", issue: "Routine may interrupt utilities", recommendation: "Add notifications and a fast manual override." });
  }

  if (!issues.length) {
    issues.push({ severity: "low", issue: "No obvious safety risks detected", recommendation: "Still test in a controlled window and add monitoring." });
  }

  return {
    routine_name: routine.name || "(unknown)",
    issues,
  };
}
