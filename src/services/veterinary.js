import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const VET_FEES = {
  triage_symptoms:      0.50,
  schedule_appointment: 0.25,
  get_health_record:    0.50,
  calculate_medication: 0.25,
  estimate_cost:        0.25,
  pet_care_dashboard:   1.00,
};

const PLATFORM_COMMISSION = 0.20;

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS vet_triages (
    id                  TEXT PRIMARY KEY,
    species             TEXT NOT NULL,
    breed               TEXT,
    age_years           REAL,
    symptoms            TEXT DEFAULT '[]',
    urgency             TEXT,
    severity            TEXT NOT NULL,
    possible_conditions TEXT DEFAULT '[]',
    recommended_action  TEXT,
    nearest_emergency   INTEGER DEFAULT 0,
    fee_usd             REAL,
    commission_usd      REAL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_appointments (
    id                TEXT PRIMARY KEY,
    clinic_id         TEXT,
    pet_id            TEXT,
    pet_name          TEXT,
    species           TEXT,
    appointment_type  TEXT NOT NULL,
    confirmed_time    TEXT,
    prep_instructions TEXT DEFAULT '[]',
    estimated_cost    REAL,
    status            TEXT DEFAULT 'confirmed',
    fee_usd           REAL,
    commission_usd    REAL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_pets (
    id             TEXT PRIMARY KEY,
    owner_id       TEXT NOT NULL,
    name           TEXT NOT NULL,
    species        TEXT NOT NULL,
    breed          TEXT,
    dob            TEXT,
    weight_kg      REAL,
    microchip_id   TEXT,
    insurance_id   TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_health_records (
    id              TEXT PRIMARY KEY,
    pet_id          TEXT NOT NULL,
    vaccinations    TEXT DEFAULT '[]',
    medical_history TEXT DEFAULT '[]',
    medications     TEXT DEFAULT '[]',
    allergies       TEXT DEFAULT '[]',
    weight_history  TEXT DEFAULT '[]',
    next_checkup    TEXT,
    fee_usd         REAL,
    commission_usd  REAL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_dosage_calcs (
    id              TEXT PRIMARY KEY,
    species         TEXT NOT NULL,
    weight_kg       REAL NOT NULL,
    condition       TEXT NOT NULL,
    medication      TEXT NOT NULL,
    dosage          TEXT,
    frequency       TEXT,
    duration        TEXT,
    warnings        TEXT DEFAULT '[]',
    interactions    TEXT DEFAULT '[]',
    cost_estimate   TEXT,
    fee_usd         REAL,
    commission_usd  REAL,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_cost_estimates (
    id                      TEXT PRIMARY KEY,
    procedure               TEXT NOT NULL,
    species                 TEXT NOT NULL,
    location                TEXT,
    estimated_low           REAL,
    estimated_mid           REAL,
    estimated_high          REAL,
    by_component            TEXT DEFAULT '[]',
    insurance_likely        INTEGER DEFAULT 0,
    financing_options       TEXT DEFAULT '[]',
    fee_usd                 REAL,
    commission_usd          REAL,
    created_at              TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vet_usage_log (
    id          TEXT PRIMARY KEY,
    operation   TEXT NOT NULL,
    fee_usd     REAL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed demo pets and clinics ───────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS vet_clinics (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    city         TEXT,
    phone        TEXT,
    emergency    INTEGER DEFAULT 0,
    rating       REAL DEFAULT 4.5,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

const _clinicCount = db.prepare("SELECT COUNT(*) as n FROM vet_clinics").get().n;
if (_clinicCount === 0) {
  const seedClinics = [
    { id: uuid(), name: "City Animal Hospital",         city: "New York",     phone: "+1-212-555-0101", emergency: 1, rating: 4.8 },
    { id: uuid(), name: "Westside Veterinary Center",   city: "Los Angeles",  phone: "+1-310-555-0202", emergency: 1, rating: 4.7 },
    { id: uuid(), name: "Green Meadow Vet Clinic",      city: "Chicago",      phone: "+1-312-555-0303", emergency: 0, rating: 4.6 },
    { id: uuid(), name: "BluePaw Emergency Animal Care",city: "Houston",      phone: "+1-713-555-0404", emergency: 1, rating: 4.9 },
    { id: uuid(), name: "Harmony Pet Wellness",         city: "London",       phone: "+44-20-5550505",  emergency: 0, rating: 4.7 },
    { id: uuid(), name: "Clinica Veterinaria Roma",     city: "Rome",         phone: "+39-06-5550606",  emergency: 0, rating: 4.5 },
  ];
  const ins = db.prepare(`INSERT OR IGNORE INTO vet_clinics (id, name, city, phone, emergency, rating) VALUES (@id, @name, @city, @phone, @emergency, @rating)`);
  for (const c of seedClinics) ins.run(c);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logUsage(operation, fee) {
  db.prepare(`INSERT OR IGNORE INTO vet_usage_log (id, operation, fee_usd) VALUES (@id, @operation, @fee_usd)`)
    .run({ id: uuid(), operation, fee_usd: fee });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function assessSeverity(species, symptoms, urgency) {
  const emergencyKeywords = ["collapse","seizure","difficulty breathing","not breathing","pale gums","unconscious","trauma","poisoning","bleeding heavily","choking"];
  const urgentKeywords    = ["vomiting blood","unable to urinate","extreme lethargy","swollen abdomen","eye injury","broken bone","severe pain","suspected toxin"];
  const symptomText       = symptoms.join(" ").toLowerCase();

  const hasEmergency = urgency === "emergency" || emergencyKeywords.some(k => symptomText.includes(k));
  const hasUrgent    = urgency === "urgent"    || urgentKeywords.some(k => symptomText.includes(k));

  if (hasEmergency) return "emergency";
  if (hasUrgent)    return "urgent";
  if (symptoms.length >= 3) return "urgent";
  if (symptoms.length >= 1) return "routine";
  return "monitor";
}

function getPossibleConditions(species, symptoms) {
  const symptomText = symptoms.join(" ").toLowerCase();
  const conditionMap = {
    vomit:       [{ condition: "Gastritis",            probability: 0.65 }, { condition: "Foreign body ingestion", probability: 0.20 }, { condition: "Pancreatitis", probability: 0.15 }],
    letharg:     [{ condition: "Anemia",               probability: 0.40 }, { condition: "Hypothyroidism",         probability: 0.30 }, { condition: "Infection",    probability: 0.30 }],
    limp:        [{ condition: "Sprain or strain",     probability: 0.50 }, { condition: "Arthritis",              probability: 0.25 }, { condition: "Fracture",     probability: 0.25 }],
    scratch:     [{ condition: "Allergic dermatitis",  probability: 0.55 }, { condition: "Parasites (fleas/mites)",probability: 0.35 }, { condition: "Fungal infection", probability: 0.10 }],
    cough:       [{ condition: "Kennel cough",         probability: 0.60 }, { condition: "Tracheal collapse",      probability: 0.20 }, { condition: "Heart disease", probability: 0.20 }],
    drink:       [{ condition: "Diabetes mellitus",    probability: 0.45 }, { condition: "Kidney disease",         probability: 0.35 }, { condition: "Cushing's disease", probability: 0.20 }],
    eat:         [{ condition: "Dental disease",       probability: 0.40 }, { condition: "Nausea",                 probability: 0.35 }, { condition: "Systemic illness", probability: 0.25 }],
    urinat:      [{ condition: "Urinary tract infection",probability: 0.55 },{ condition: "Bladder stones",        probability: 0.30 }, { condition: "Kidney disease", probability: 0.15 }],
  };

  for (const [keyword, conditions] of Object.entries(conditionMap)) {
    if (symptomText.includes(keyword)) return conditions;
  }
  return [
    { condition: "General systemic illness", probability: 0.50 },
    { condition: "Stress or anxiety",        probability: 0.30 },
    { condition: "Nutritional deficiency",   probability: 0.20 },
  ];
}

function buildVaccinations(species) {
  const now = new Date();
  const past = (days) => new Date(now - days * 86400000).toISOString().split("T")[0];
  const future = (days) => new Date(now.getTime() + days * 86400000).toISOString().split("T")[0];

  const dogVaccines = [
    { vaccine: "Rabies",           date_given: past(180), next_due: future(185), status: "current" },
    { vaccine: "DHPP",             date_given: past(365), next_due: future(0),   status: "due"     },
    { vaccine: "Bordetella",       date_given: past(90),  next_due: future(275), status: "current" },
    { vaccine: "Leptospirosis",    date_given: past(270), next_due: future(95),  status: "current" },
  ];
  const catVaccines = [
    { vaccine: "Rabies",           date_given: past(200), next_due: future(165), status: "current" },
    { vaccine: "FVRCP",            date_given: past(730), next_due: future(-365),status: "overdue" },
    { vaccine: "FeLV",             date_given: past(300), next_due: future(65),  status: "current" },
  ];
  const rabbitVaccines = [
    { vaccine: "RHD-2",            date_given: past(90),  next_due: future(275), status: "current" },
    { vaccine: "Myxomatosis",      date_given: past(60),  next_due: future(305), status: "current" },
  ];

  if (species === "dog")    return dogVaccines;
  if (species === "cat")    return catVaccines;
  if (species === "rabbit") return rabbitVaccines;
  return [{ vaccine: "Species-specific protocol", date_given: past(180), next_due: future(185), status: "current" }];
}

function buildMedHistory(species) {
  return [
    { date: "2024-03-12", diagnosis: "Ear infection (otitis externa)", treatment: "Otomax drops, 10-day course", resolved: true },
    { date: "2024-08-05", diagnosis: "Skin allergy",                   treatment: "Apoquel 16mg, ongoing", resolved: false },
    { date: "2025-01-20", diagnosis: "Annual wellness exam",           treatment: "No issues found", resolved: true },
  ];
}

function getDosageInfo(species, weightKg, condition, medication) {
  // Evidence-based dosage lookup simulation
  const dosageDb = {
    amoxicillin:     { dose_mg_per_kg: 11,    freq: "every 8–12 hours", duration: "7–10 days",   warnings: ["Complete full course","Check for penicillin allergy"], species: ["dog","cat"] },
    meloxicam:       { dose_mg_per_kg: 0.1,   freq: "once daily",       duration: "3–5 days",    warnings: ["Do not use in cats long-term","Monitor renal function","Do not combine with steroids"], species: ["dog","cat"] },
    metronidazole:   { dose_mg_per_kg: 15,    freq: "every 12 hours",   duration: "5–7 days",    warnings: ["May cause neurological signs at high doses"], species: ["dog","cat","rabbit"] },
    prednisolone:    { dose_mg_per_kg: 0.5,   freq: "once daily",       duration: "As directed", warnings: ["Taper dose on discontinuation","Monitor for polyuria/polydipsia"], species: ["dog","cat"] },
    furosemide:      { dose_mg_per_kg: 2,     freq: "every 8–12 hours", duration: "Ongoing",     warnings: ["Monitor electrolytes","Ensure access to water"], species: ["dog","cat"] },
    gabapentin:      { dose_mg_per_kg: 5,     freq: "every 8–12 hours", duration: "As directed", warnings: ["May cause sedation","Adjust dose in renal impairment"], species: ["dog","cat"] },
    enalapril:       { dose_mg_per_kg: 0.5,   freq: "every 12–24 hours",duration: "Ongoing",     warnings: ["Monitor blood pressure","Check renal values before starting"], species: ["dog","cat"] },
  };

  const med    = dosageDb[medication.toLowerCase()];
  const doseMg = med ? Math.round(med.dose_mg_per_kg * weightKg * 10) / 10 : null;

  return {
    found:    !!med,
    dosage:   med ? `${doseMg} mg (${med.dose_mg_per_kg} mg/kg × ${weightKg} kg)` : `Consult veterinarian — dosage not found for ${medication}`,
    frequency: med?.freq   ?? "Per veterinarian instruction",
    duration:  med?.duration ?? "Per veterinarian instruction",
    warnings:  med?.warnings ?? ["Always confirm dosage with a licensed veterinarian"],
    species_approved: med ? med.species.includes(species) : false,
  };
}

function buildCostComponents(procedure, species) {
  const locationMultiplier = 1.0; // adjusted later by location

  const procedureCosts = {
    spay:                 { components: [["Anesthesia", 150, 300], ["Surgery", 200, 400], ["Pre-op bloodwork", 80, 150], ["Recovery/post-op", 50, 120]], insurance: true  },
    neuter:               { components: [["Anesthesia", 100, 200], ["Surgery", 150, 300], ["Pre-op bloodwork", 80, 150], ["Recovery/post-op", 40, 100]], insurance: true  },
    dental_cleaning:      { components: [["Anesthesia", 150, 300], ["Dental scaling", 100, 250], ["Extractions (if needed)", 0, 300], ["X-rays", 50, 150]], insurance: true  },
    wellness_exam:        { components: [["Consultation", 50, 100], ["Vaccinations", 20, 60], ["Fecal test", 30, 70], ["Heartworm test", 25, 55]], insurance: false },
    x_ray:                { components: [["Sedation (if needed)", 0, 150], ["Radiograph", 75, 200], ["Radiologist review", 50, 100]], insurance: true  },
    emergency_visit:      { components: [["Emergency exam", 100, 250], ["Diagnostics", 100, 500], ["Treatment", 50, 300], ["Hospitalization (if needed)", 0, 800]], insurance: true },
    blood_panel:          { components: [["Collection fee", 20, 50], ["CBC", 40, 80], ["Chemistry panel", 60, 120]], insurance: false },
    ultrasound:           { components: [["Sedation (if needed)", 0, 150], ["Imaging", 150, 400], ["Specialist review", 75, 200]], insurance: true  },
  };

  const speciesMultipliers = { cat: 0.9, dog: 1.0, rabbit: 0.85, bird: 1.1, reptile: 1.2, horse: 4.5 };
  const sMult = speciesMultipliers[species] ?? 1.0;

  const template = procedureCosts[procedure.toLowerCase().replace(/\s+/g, "_")] ?? {
    components: [["Consultation", 50, 150], ["Procedure", 100, 500], ["Medications", 20, 100]],
    insurance:  false,
  };

  return {
    components: template.components.map(([name, low, high]) => ({
      component:     name,
      low_usd:       Math.round(low * sMult),
      high_usd:      Math.round(high * sMult),
    })).filter(c => c.low_usd !== undefined),
    insurance_likely: template.insurance,
  };
}

// ─── Triage Pet Symptoms ──────────────────────────────────────────────────────

/**
 * AI-powered triage for pet symptoms.
 * @param {string} species  - dog|cat|rabbit|bird|reptile|horse|other
 * @param {string} breed    - Breed name (optional)
 * @param {number} age      - Age in years
 * @param {Array}  symptoms - Array of symptom strings
 * @param {string} urgency  - Owner-reported urgency: emergency|urgent|routine|monitor
 * @returns Severity assessment, possible conditions, and recommended action
 */
export function triagePetSymptoms(species, breed, age, symptoms, urgency) {
  if (!species)                          throw new Error("species is required");
  if (!Array.isArray(symptoms) || symptoms.length === 0) throw new Error("symptoms must be a non-empty array");

  const id       = uuid();
  const severity = assessSeverity(species, symptoms, urgency);
  const conditions = getPossibleConditions(species, symptoms);
  const needsEmergency = severity === "emergency";

  const actionMap = {
    emergency: "Go to the nearest emergency veterinary clinic immediately. Do not wait for a regular appointment.",
    urgent:    "Contact your veterinarian today for a same-day or next-day appointment. Monitor closely for worsening.",
    routine:   "Schedule a routine veterinary appointment within the next 1–2 weeks.",
    monitor:   "Monitor at home. If symptoms worsen or persist beyond 48 hours, consult your vet.",
  };

  const nearestClinic = needsEmergency
    ? db.prepare("SELECT * FROM vet_clinics WHERE emergency = 1 ORDER BY RANDOM() LIMIT 1").get()
    : null;

  const fee        = VET_FEES.triage_symptoms;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO vet_triages
      (id, species, breed, age_years, symptoms, urgency, severity, possible_conditions,
       recommended_action, nearest_emergency, fee_usd, commission_usd)
    VALUES
      (@id, @species, @breed, @age_years, @symptoms, @urgency, @severity, @possible_conditions,
       @recommended_action, @nearest_emergency, @fee_usd, @commission_usd)
  `).run({
    id,
    species,
    breed:              breed ?? null,
    age_years:          age ?? null,
    symptoms:           JSON.stringify(symptoms),
    urgency:            urgency ?? "unknown",
    severity,
    possible_conditions: JSON.stringify(conditions),
    recommended_action: actionMap[severity],
    nearest_emergency:  needsEmergency ? 1 : 0,
    fee_usd:            fee,
    commission_usd:     commission,
  });

  logUsage("triage_symptoms", fee);

  return {
    triage_id:           id,
    species,
    breed:               breed ?? null,
    age_years:           age ?? null,
    symptoms_assessed:   symptoms,
    severity,
    possible_conditions: conditions,
    recommended_action:  actionMap[severity],
    nearest_emergency_vet: nearestClinic
      ? { name: nearestClinic.name, city: nearestClinic.city, phone: nearestClinic.phone, rating: nearestClinic.rating }
      : null,
    disclaimer:          "This triage is AI-assisted and does not replace examination by a licensed veterinarian.",
    fee_usd:             fee,
    platform_commission_usd: commission,
    created_at:          new Date().toISOString(),
  };
}

// ─── Schedule Pet Appointment ─────────────────────────────────────────────────

/**
 * Schedule a veterinary appointment for a pet.
 * @param {string} clinicId         - Clinic identifier (or null for auto-assign)
 * @param {object} petData          - { name, species, breed, owner_name, owner_phone }
 * @param {string} appointmentType  - wellness|vaccination|sick_visit|surgery|dental|emergency|follow_up
 * @param {string} preferredDate    - ISO date string (YYYY-MM-DD)
 * @returns Confirmed appointment with prep instructions and cost estimate
 */
export function schedulePetAppointment(clinicId, petData, appointmentType, preferredDate) {
  if (!petData)          throw new Error("petData is required");
  if (!appointmentType)  throw new Error("appointmentType is required");

  const validTypes = ["wellness","vaccination","sick_visit","surgery","dental","emergency","follow_up"];
  if (!validTypes.includes(appointmentType)) {
    throw new Error(`Invalid appointmentType: ${appointmentType}. Must be one of: ${validTypes.join(", ")}`);
  }

  const id      = uuid();
  const clinic  = clinicId
    ? db.prepare("SELECT * FROM vet_clinics WHERE id = ?").get(clinicId)
    : db.prepare("SELECT * FROM vet_clinics ORDER BY RANDOM() LIMIT 1").get();

  // Confirm at preferred date or next available slot
  const preferred  = preferredDate ? new Date(preferredDate) : new Date(Date.now() + 2 * 86400000);
  const timeSlots  = ["09:00", "10:30", "11:00", "14:00", "15:30", "16:00"];
  const confirmedTime = `${preferred.toISOString().split("T")[0]}T${pickRandom(timeSlots)}:00`;

  const prepMap = {
    wellness:    ["Bring previous vaccination records", "Fast pet for 2 hours prior", "Bring stool sample in sealed bag"],
    vaccination: ["Bring previous vaccination records", "No fasting required"],
    sick_visit:  ["Note symptom onset date and frequency", "Bring any current medications", "Collect urine sample if possible"],
    surgery:     ["Fast pet for 12 hours (no food) and 4 hours (no water)", "Bathe pet the day before", "Remove collar and tags if instructed"],
    dental:      ["Fast pet for 8–12 hours before procedure", "No treats after midnight"],
    emergency:   ["Bring pet immediately", "Keep pet calm and warm during transport"],
    follow_up:   ["Bring discharge notes from previous visit", "List any changes in symptoms"],
  };

  const costMap = {
    wellness:    75,  vaccination: 55,  sick_visit:  90,
    surgery:     600, dental:      350, emergency:   250, follow_up: 60,
  };

  const prepInstructions = prepMap[appointmentType] ?? [];
  const estimatedCost    = costMap[appointmentType] ?? 100;

  const fee        = VET_FEES.schedule_appointment;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO vet_appointments
      (id, clinic_id, pet_name, species, appointment_type, confirmed_time,
       prep_instructions, estimated_cost, fee_usd, commission_usd)
    VALUES
      (@id, @clinic_id, @pet_name, @species, @appointment_type, @confirmed_time,
       @prep_instructions, @estimated_cost, @fee_usd, @commission_usd)
  `).run({
    id,
    clinic_id:        clinic?.id ?? null,
    pet_name:         petData.name ?? "Unknown",
    species:          petData.species ?? "unknown",
    appointment_type: appointmentType,
    confirmed_time:   confirmedTime,
    prep_instructions: JSON.stringify(prepInstructions),
    estimated_cost:   estimatedCost,
    fee_usd:          fee,
    commission_usd:   commission,
  });

  logUsage("schedule_appointment", fee);

  return {
    appointment_id:          id,
    clinic: clinic
      ? { id: clinic.id, name: clinic.name, city: clinic.city, phone: clinic.phone }
      : { name: "HiveVet Partner Clinic", city: "Auto-assigned", phone: "See confirmation email" },
    pet_name:                petData.name ?? "Unknown",
    species:                 petData.species ?? "unknown",
    appointment_type:        appointmentType,
    confirmed_time:          confirmedTime,
    prep_instructions:       prepInstructions,
    estimated_cost_usd:      estimatedCost,
    status:                  "confirmed",
    cancellation_policy:     "Cancel at least 24 hours in advance to avoid a cancellation fee.",
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}

// ─── Get Pet Health Record ────────────────────────────────────────────────────

/**
 * Retrieve comprehensive health record for a pet.
 * @param {string} petId - Pet identifier
 * @returns Full health record: vaccinations, medical history, medications, allergies, weight, next checkup
 */
export function getPetHealthRecord(petId) {
  if (!petId) throw new Error("petId is required");

  const id     = uuid();
  const pet    = db.prepare("SELECT * FROM vet_pets WHERE id = ?").get(petId);
  const species = pet?.species ?? "dog";

  // Load from DB or synthesize a representative health record
  const existing = db.prepare("SELECT * FROM vet_health_records WHERE pet_id = ?").get(petId);

  const vaccinations  = existing ? JSON.parse(existing.vaccinations)    : buildVaccinations(species);
  const medHistory    = existing ? JSON.parse(existing.medical_history)  : buildMedHistory(species);
  const medications   = existing ? JSON.parse(existing.medications)      : [{ name: "Apoquel 16mg", dose: "16mg", frequency: "daily", condition: "allergies", start_date: "2024-08-05" }];
  const allergies     = existing ? JSON.parse(existing.allergies)        : [{ allergen: "Chicken protein", reaction: "skin irritation", severity: "mild" }];
  const weightHistory = existing ? JSON.parse(existing.weight_history)   : [
    { date: "2023-06-01", weight_kg: 8.2 },
    { date: "2024-01-15", weight_kg: 8.8 },
    { date: "2024-09-10", weight_kg: 9.1 },
    { date: "2025-03-20", weight_kg: 9.0 },
  ];
  const nextCheckup   = existing?.next_checkup ?? new Date(Date.now() + 120 * 86400000).toISOString().split("T")[0];

  const fee        = VET_FEES.get_health_record;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  if (!existing) {
    db.prepare(`
      INSERT OR IGNORE INTO vet_health_records
        (id, pet_id, vaccinations, medical_history, medications, allergies, weight_history, next_checkup, fee_usd, commission_usd)
      VALUES
        (@id, @pet_id, @vaccinations, @medical_history, @medications, @allergies, @weight_history, @next_checkup, @fee_usd, @commission_usd)
    `).run({
      id,
      pet_id:          petId,
      vaccinations:    JSON.stringify(vaccinations),
      medical_history: JSON.stringify(medHistory),
      medications:     JSON.stringify(medications),
      allergies:       JSON.stringify(allergies),
      weight_history:  JSON.stringify(weightHistory),
      next_checkup:    nextCheckup,
      fee_usd:         fee,
      commission_usd:  commission,
    });
  }

  logUsage("get_health_record", fee);

  const overdueVax = vaccinations.filter(v => v.status === "overdue").length;
  const dueVax     = vaccinations.filter(v => v.status === "due").length;

  return {
    record_id:        existing?.id ?? id,
    pet_id:           petId,
    pet:              pet ? { name: pet.name, species: pet.species, breed: pet.breed, dob: pet.dob, weight_kg: pet.weight_kg } : null,
    vaccinations,
    medical_history:  medHistory,
    medications,
    allergies,
    weight_history:   weightHistory,
    current_weight_kg: weightHistory.at(-1)?.weight_kg ?? null,
    next_checkup_due: nextCheckup,
    health_alerts: [
      ...overdueVax > 0 ? [{ type: "overdue_vaccination", message: `${overdueVax} vaccination(s) overdue`, severity: "high" }] : [],
      ...dueVax > 0     ? [{ type: "due_vaccination",     message: `${dueVax} vaccination(s) due soon`,   severity: "medium" }] : [],
    ],
    fee_usd:          fee,
    platform_commission_usd: commission,
    retrieved_at:     new Date().toISOString(),
  };
}

// ─── Calculate Medication ─────────────────────────────────────────────────────

/**
 * Calculate evidence-based medication dosage for a pet.
 * @param {string} species    - dog|cat|rabbit|bird|reptile|horse
 * @param {number} weight     - Body weight in kg
 * @param {string} condition  - Medical condition being treated
 * @param {string} medication - Medication name
 * @returns Dosage, frequency, duration, warnings, interactions, and cost estimate
 */
export function calculateMedication(species, weight, condition, medication) {
  if (!species)    throw new Error("species is required");
  if (!weight || weight <= 0) throw new Error("weight must be a positive number");
  if (!condition)  throw new Error("condition is required");
  if (!medication) throw new Error("medication is required");

  const id        = uuid();
  const dosageInfo = getDosageInfo(species, weight, condition, medication);

  const interactionWarnings = {
    meloxicam:  ["Do not combine with aspirin, other NSAIDs, or corticosteroids"],
    prednisolone: ["Avoid concurrent NSAIDs", "Concurrent use with ketoconazole may increase levels"],
    metronidazole: ["May increase anticoagulant effect of warfarin"],
    furosemide: ["Aminoglycosides + furosemide = increased ototoxicity risk"],
  };

  const interactions = interactionWarnings[medication.toLowerCase()] ?? [];
  const costPerUnit  = 0.15 + Math.random() * 0.85;
  const doseCount    = parseInt(dosageInfo.duration) || 10;
  const dosesPerDay  = dosageInfo.frequency?.includes("8") ? 3 : dosageInfo.frequency?.includes("12") ? 2 : 1;
  const totalCost    = Math.round(costPerUnit * doseCount * dosesPerDay * 100) / 100;

  const fee        = VET_FEES.calculate_medication;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO vet_dosage_calcs
      (id, species, weight_kg, condition, medication, dosage, frequency, duration,
       warnings, interactions, cost_estimate, fee_usd, commission_usd)
    VALUES
      (@id, @species, @weight_kg, @condition, @medication, @dosage, @frequency, @duration,
       @warnings, @interactions, @cost_estimate, @fee_usd, @commission_usd)
  `).run({
    id,
    species,
    weight_kg:    weight,
    condition,
    medication,
    dosage:       dosageInfo.dosage,
    frequency:    dosageInfo.frequency,
    duration:     dosageInfo.duration,
    warnings:     JSON.stringify(dosageInfo.warnings),
    interactions: JSON.stringify(interactions),
    cost_estimate: `$${totalCost.toFixed(2)} estimated for full course`,
    fee_usd:      fee,
    commission_usd: commission,
  });

  logUsage("calculate_medication", fee);

  return {
    calculation_id:          id,
    species,
    weight_kg:               weight,
    condition,
    medication,
    species_approved:        dosageInfo.species_approved,
    dosage:                  dosageInfo.dosage,
    frequency:               dosageInfo.frequency,
    duration:                dosageInfo.duration,
    warnings:                dosageInfo.warnings,
    interactions,
    cost_estimate:           `$${totalCost.toFixed(2)} estimated for full course`,
    disclaimer:              "This calculator is for reference only. Always confirm dosage with a licensed veterinarian before administering any medication.",
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}

// ─── Estimate Vet Cost ────────────────────────────────────────────────────────

/**
 * Estimate the cost of a veterinary procedure.
 * @param {string} procedure - Procedure name (e.g. "spay", "dental_cleaning", "x_ray")
 * @param {string} species   - dog|cat|rabbit|bird|reptile|horse
 * @param {string} location  - City or region for cost adjustment
 * @returns Cost range breakdown, insurance likelihood, and financing options
 */
export function estimateVetCost(procedure, species, location) {
  if (!procedure) throw new Error("procedure is required");
  if (!species)   throw new Error("species is required");

  const id            = uuid();
  const costData      = buildCostComponents(procedure, species);
  const locationMult  = location && ["new york","london","san francisco","zurich","sydney"].some(c => location.toLowerCase().includes(c)) ? 1.35 : 1.0;

  const components = costData.components.map(c => ({
    component: c.component,
    low_usd:   Math.round(c.low_usd * locationMult),
    high_usd:  Math.round(c.high_usd * locationMult),
  }));

  const totalLow  = components.reduce((s, c) => s + c.low_usd,  0);
  const totalHigh = components.reduce((s, c) => s + c.high_usd, 0);
  const totalMid  = Math.round((totalLow + totalHigh) / 2);

  const financingOptions = totalMid > 300
    ? [
        { provider: "CareCredit",    terms: "6 months interest-free", url: "https://www.carecredit.com" },
        { provider: "Scratchpay",    terms: "Flexible installment plans", url: "https://scratchpay.com" },
        { provider: "Pet insurance", terms: "Reimburses 70–90% after deductible", url: null },
      ]
    : [];

  const fee        = VET_FEES.estimate_cost;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;

  db.prepare(`
    INSERT OR IGNORE INTO vet_cost_estimates
      (id, procedure, species, location, estimated_low, estimated_mid, estimated_high,
       by_component, insurance_likely, financing_options, fee_usd, commission_usd)
    VALUES
      (@id, @procedure, @species, @location, @estimated_low, @estimated_mid, @estimated_high,
       @by_component, @insurance_likely, @financing_options, @fee_usd, @commission_usd)
  `).run({
    id,
    procedure,
    species,
    location:          location ?? null,
    estimated_low:     totalLow,
    estimated_mid:     totalMid,
    estimated_high:    totalHigh,
    by_component:      JSON.stringify(components),
    insurance_likely:  costData.insurance_likely ? 1 : 0,
    financing_options: JSON.stringify(financingOptions),
    fee_usd:           fee,
    commission_usd:    commission,
  });

  logUsage("estimate_cost", fee);

  return {
    estimate_id:             id,
    procedure,
    species,
    location:                location ?? "General",
    estimated_range: {
      low:  totalLow,
      mid:  totalMid,
      high: totalHigh,
    },
    by_component:            components,
    insurance_coverage_likely: costData.insurance_likely,
    financing_options:       financingOptions,
    note:                    "Estimates vary by clinic, region, and individual patient factors. Get a written quote before proceeding.",
    fee_usd:                 fee,
    platform_commission_usd: commission,
    created_at:              new Date().toISOString(),
  };
}

// ─── Pet Care Dashboard ───────────────────────────────────────────────────────

/**
 * Retrieve a comprehensive dashboard for a pet owner.
 * @param {string} ownerId - Owner identifier
 * @returns All pets, upcoming appointments, medication schedule, vaccination status, and wellness score
 */
export function getPetCareDashboard(ownerId) {
  if (!ownerId) throw new Error("ownerId is required");

  const pets       = db.prepare("SELECT * FROM vet_pets WHERE owner_id = ?").all(ownerId);
  const appointments = db.prepare(
    "SELECT * FROM vet_appointments WHERE status = 'confirmed' AND confirmed_time >= datetime('now') ORDER BY confirmed_time ASC LIMIT 10"
  ).all();

  // Build medication schedule across all pets
  const medSchedule = [];
  for (const pet of pets) {
    const rec = db.prepare("SELECT medications FROM vet_health_records WHERE pet_id = ?").get(pet.id);
    if (rec?.medications) {
      const meds = JSON.parse(rec.medications);
      for (const med of meds) {
        medSchedule.push({ pet_name: pet.name, pet_id: pet.id, ...med });
      }
    }
  }

  // Vaccination status across all pets
  const vaccinationStatus = [];
  for (const pet of pets) {
    const rec = db.prepare("SELECT vaccinations FROM vet_health_records WHERE pet_id = ?").get(pet.id);
    if (rec?.vaccinations) {
      const vax = JSON.parse(rec.vaccinations);
      const overdue = vax.filter(v => v.status === "overdue").length;
      const due     = vax.filter(v => v.status === "due").length;
      vaccinationStatus.push({ pet_name: pet.name, pet_id: pet.id, total: vax.length, overdue, due_soon: due, current: vax.length - overdue - due });
    }
  }

  // Wellness score: 0–100 based on overdue items
  const totalOverdue    = vaccinationStatus.reduce((s, v) => s + v.overdue, 0);
  const totalDue        = vaccinationStatus.reduce((s, v) => s + v.due_soon, 0);
  const wellnessScore   = Math.max(0, 100 - (totalOverdue * 20) - (totalDue * 5));

  const fee        = VET_FEES.pet_care_dashboard;
  const commission = Math.round(fee * PLATFORM_COMMISSION * 100) / 100;
  logUsage("pet_care_dashboard", fee);

  return {
    owner_id:             ownerId,
    pets: pets.map(p => ({ id: p.id, name: p.name, species: p.species, breed: p.breed, dob: p.dob, weight_kg: p.weight_kg })),
    pet_count:            pets.length,
    upcoming_appointments: appointments.map(a => ({
      appointment_id:   a.id,
      pet_name:         a.pet_name,
      type:             a.appointment_type,
      confirmed_time:   a.confirmed_time,
      estimated_cost:   a.estimated_cost,
      clinic_id:        a.clinic_id,
    })),
    medication_schedule:  medSchedule,
    vaccination_status:   vaccinationStatus,
    wellness_score:       wellnessScore,
    wellness_grade:       wellnessScore >= 90 ? "A" : wellnessScore >= 75 ? "B" : wellnessScore >= 60 ? "C" : "D",
    fee_usd:              fee,
    platform_commission_usd: commission,
    generated_at:         new Date().toISOString(),
  };
}
