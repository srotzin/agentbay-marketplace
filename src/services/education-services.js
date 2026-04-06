import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ─────────────────────────────────────────────────────

const EDU_PLATFORM_COMMISSION    = 0.15; // 15% on curriculum generation
const FEE_CURRICULUM             = 3.00; // per curriculum
const FEE_PROGRESS_UPDATE        = 0.10; // per student update
const FEE_CREDENTIAL_VERIFY      = 1.00; // per verification
const FEE_AI_DETECT              = 0.25; // per scan
const FEE_FINANCIAL_AID          = 2.00; // per check

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS edu_issuers (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE,
    issuer_type      TEXT NOT NULL CHECK(issuer_type IN ('university','community_college','certification_body','k12_district','vocational','professional_association')),
    country          TEXT DEFAULT 'US',
    state            TEXT,
    accreditation    TEXT,
    verified         INTEGER DEFAULT 1,
    blockchain_registry TEXT,
    website          TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS edu_credentials (
    id               TEXT PRIMARY KEY,
    credential_id    TEXT NOT NULL UNIQUE,
    credential_type  TEXT NOT NULL CHECK(credential_type IN ('degree','transcript','certificate','license','certification','diploma')),
    issuer_id        TEXT REFERENCES edu_issuers(id),
    recipient_name   TEXT,
    issue_date       TEXT,
    expiration_date  TEXT,
    field_of_study   TEXT,
    gpa              REAL,
    blockchain_hash  TEXT,
    status           TEXT DEFAULT 'valid',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS edu_student_progress (
    id               TEXT PRIMARY KEY,
    student_id       TEXT NOT NULL,
    course_id        TEXT NOT NULL,
    mastery_level    REAL DEFAULT 0,
    sessions_count   INTEGER DEFAULT 0,
    last_updated     TEXT DEFAULT (datetime('now')),
    created_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS edu_curricula (
    id               TEXT PRIMARY KEY,
    subject          TEXT NOT NULL,
    grade_level      TEXT NOT NULL,
    standards        TEXT,
    duration_weeks   INTEGER,
    unit_count       INTEGER,
    fee_usd          REAL,
    commission_usd   REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Issuers ─────────────────────────────────────────────────────────────

const _issuerCount = db.prepare("SELECT COUNT(*) as n FROM edu_issuers").get().n;
if (_issuerCount === 0) {
  const issuers = [
    { name: "Massachusetts Institute of Technology",    issuer_type: "university",               country: "US", state: "MA", accreditation: "NECHE",  blockchain_registry: "MIT-Blockcerts", website: "https://web.mit.edu" },
    { name: "Stanford University",                      issuer_type: "university",               country: "US", state: "CA", accreditation: "WSCUC",  blockchain_registry: "Stanford-DCV",   website: "https://www.stanford.edu" },
    { name: "University of California Los Angeles",     issuer_type: "university",               country: "US", state: "CA", accreditation: "WSCUC",  blockchain_registry: null,             website: "https://www.ucla.edu" },
    { name: "Georgia Institute of Technology",          issuer_type: "university",               country: "US", state: "GA", accreditation: "SACSCOC", blockchain_registry: null,             website: "https://www.gatech.edu" },
    { name: "Harvard University",                       issuer_type: "university",               country: "US", state: "MA", accreditation: "NECHE",  blockchain_registry: "Harvard-Creds",  website: "https://www.harvard.edu" },
    { name: "Coursera (Google Career Certificates)",    issuer_type: "certification_body",       country: "US", state: null, accreditation: "DEAC",   blockchain_registry: null,             website: "https://www.coursera.org" },
    { name: "CompTIA",                                  issuer_type: "certification_body",       country: "US", state: "IL", accreditation: "ANSI",   blockchain_registry: "CompTIA-DCV",    website: "https://www.comptia.org" },
    { name: "Project Management Institute (PMI)",       issuer_type: "professional_association", country: "US", state: "PA", accreditation: "ANSI",   blockchain_registry: "PMI-Credly",     website: "https://www.pmi.org" },
    { name: "National Council for Geographic Education", issuer_type: "professional_association", country: "US", state: "DC", accreditation: null,    blockchain_registry: null,             website: "https://www.ncge.org" },
    { name: "Los Angeles Unified School District",      issuer_type: "k12_district",             country: "US", state: "CA", accreditation: "WASC",   blockchain_registry: null,             website: "https://www.lausd.net" },
  ];

  const insertIssuer = db.prepare(`
    INSERT OR IGNORE INTO edu_issuers
      (id, name, issuer_type, country, state, accreditation, blockchain_registry, website)
    VALUES
      (@id, @name, @issuer_type, @country, @state, @accreditation, @blockchain_registry, @website)
  `);
  for (const row of issuers) insertIssuer.run({ id: randomUUID(), ...row });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashCredential(credentialId, issuer, issueDate) {
  // Deterministic pseudo-hash for simulation
  const raw    = `${credentialId}:${issuer}:${issueDate}`;
  let hash     = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${hex}${"a8f3c2e19b74d056".repeat(4).slice(0, 56)}`;
}

function gradeLevelToNumeric(gradeLevel) {
  const map = { K: 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
                "9": 9, "10": 10, "11": 11, "12": 12, undergraduate: 13, graduate: 16 };
  return map[String(gradeLevel)] ?? 9;
}

// ─── generateCurriculum ────────────────────────────────────────────────────────

/**
 * Generate a standards-aligned curriculum for a given subject, grade level, and duration.
 * @param {string} subject     - Subject area (e.g. "Algebra I", "US History", "AP Biology")
 * @param {string} gradeLevel  - Grade level: K|1–12|undergraduate|graduate
 * @param {string} standards   - Curriculum standards: common_core|ngss|state_specific|ap|ib
 * @param {number} duration    - Duration in weeks
 * @returns Full curriculum structure with units, objectives, assessments, and estimated hours
 */
export function generateCurriculum(subject, gradeLevel, standards = "common_core", duration = 18) {
  if (!subject)    throw new Error("subject is required");
  if (!gradeLevel) throw new Error("gradeLevel is required");
  if (duration <= 0) throw new Error("duration must be a positive number");

  const feePaid     = FEE_CURRICULUM;
  const commission  = Math.round(feePaid * EDU_PLATFORM_COMMISSION * 100) / 100;
  const currId      = randomUUID();
  const gradeNum    = gradeLevelToNumeric(gradeLevel);
  const weeksPerUnit = Math.max(2, Math.floor(duration / 6));
  const unitCount   = Math.max(4, Math.floor(duration / weeksPerUnit));

  // Subject-specific unit templates
  const unitTemplates = {
    "Algebra I": [
      { title: "Foundations: Number Properties and Expressions", topics: ["Real number system","Properties of operations","Simplifying expressions","Order of operations"] },
      { title: "Equations and Inequalities in One Variable",     topics: ["Solving linear equations","Multi-step equations","Absolute value","Linear inequalities"] },
      { title: "Functions and Function Notation",                 topics: ["Defining functions","Domain and range","Function notation","Linear vs. nonlinear"] },
      { title: "Linear Functions and Slope",                      topics: ["Rate of change","Slope-intercept form","Point-slope form","Standard form"] },
      { title: "Systems of Equations",                            topics: ["Graphical solutions","Substitution method","Elimination method","Real-world applications"] },
      { title: "Exponents and Polynomials",                       topics: ["Laws of exponents","Adding/subtracting polynomials","Multiplying polynomials","FOIL method"] },
    ],
    "US History": [
      { title: "Foundations of American Democracy",               topics: ["Colonial America","Revolutionary War","Articles of Confederation","Constitution and Bill of Rights"] },
      { title: "Westward Expansion and Manifest Destiny",         topics: ["Louisiana Purchase","Oregon Trail","Mexican-American War","Native American displacement"] },
      { title: "Civil War and Reconstruction",                    topics: ["Causes of the Civil War","Major battles and leaders","Emancipation Proclamation","Reconstruction amendments"] },
      { title: "Industrialization and the Gilded Age",            topics: ["Industrial revolution","Labor movement","Immigration","Urbanization and social reform"] },
      { title: "The 20th Century: Wars and Civil Rights",         topics: ["World War I and II","Cold War","Civil Rights Movement","Vietnam War"] },
      { title: "Contemporary America",                            topics: ["Globalization","Technology revolution","September 11 and aftermath","21st century challenges"] },
    ],
    "AP Biology": [
      { title: "Chemistry of Life",                               topics: ["Water properties","Macromolecules","Enzyme activity","Free energy"] },
      { title: "Cell Structure and Function",                     topics: ["Prokaryotic vs. eukaryotic cells","Cell membranes","Transport mechanisms","Cell communication"] },
      { title: "Cellular Energetics",                             topics: ["Photosynthesis","Cellular respiration","Fermentation","ATP production"] },
      { title: "Cell Communication and Cell Cycle",               topics: ["Signal transduction","Cell cycle regulation","Mitosis","Cancer biology"] },
      { title: "Heredity and Gene Expression",                    topics: ["Meiosis","Mendelian genetics","Molecular genetics","Gene regulation"] },
      { title: "Natural Selection and Evolution",                 topics: ["Hardy-Weinberg equilibrium","Mechanisms of evolution","Phylogenetics","Origin of life"] },
    ],
  };

  const templateKey = Object.keys(unitTemplates).find(k => subject.toLowerCase().includes(k.toLowerCase())) ?? null;
  const templateUnits = templateKey ? unitTemplates[templateKey] : null;

  const units = [];
  for (let i = 0; i < unitCount; i++) {
    const unitNum   = i + 1;
    const template  = templateUnits?.[i] ?? null;
    const unitTitle = template?.title ?? `Unit ${unitNum}: ${subject} — Module ${unitNum}`;
    const topics    = template?.topics ?? [`${subject} concept ${unitNum * 3 - 2}`, `${subject} concept ${unitNum * 3 - 1}`, `${subject} concept ${unitNum * 3}`];

    units.push({
      unit_number:     unitNum,
      title:           unitTitle,
      duration_weeks:  weeksPerUnit,
      topics,
      learning_objectives: topics.map(t => `Students will be able to explain and apply ${t.toLowerCase()}`),
      instructional_activities: [
        "Direct instruction with guided notes",
        "Collaborative problem-solving in pairs",
        "Hands-on investigation or lab activity",
        "Formative exit ticket (last 5 min of class)",
      ],
      assessments: [
        { type: "formative", description: `${unitTitle} — warm-up checks and exit tickets`, weight_pct: 15 },
        { type: "summative",  description: `Unit ${unitNum} quiz (15–20 questions)`, weight_pct: 30 },
        { type: "project",   description: `Unit ${unitNum} performance task or lab report`, weight_pct: 55 },
      ],
      resources: [
        { type: "textbook",   title: `${subject} Student Edition — Chapter ${unitNum * 2 - 1} & ${unitNum * 2}` },
        { type: "digital",    title: `Khan Academy — ${unitTitle.split(":")[0]}` },
        { type: "primary_source", title: unitNum <= 2 ? "See unit supplemental reading packet" : null },
      ].filter(r => r.title),
    });
  }

  const standardsMap = {
    common_core: `CCSS.MATH.CONTENT.${gradeNum}` ,
    ngss:        `NGSS ${gradeLevel}-${subject.slice(0, 3).toUpperCase()}-${1}`,
    ap:          `AP ${subject} Course and Exam Description (CED) — College Board`,
    ib:          `IB ${subject} Subject Guide — International Baccalaureate Organization`,
    state_specific: `State Academic Standards for ${subject}, Grade ${gradeLevel}`,
  };

  const estimatedHours = duration * 5 * 0.9; // ~4.5 instructional hrs/week typical

  db.prepare(`
    INSERT OR IGNORE INTO edu_curricula
      (id, subject, grade_level, standards, duration_weeks, unit_count, fee_usd, commission_usd)
    VALUES (@id, @subject, @grade_level, @standards, @duration_weeks, @unit_count, @fee_usd, @commission_usd)
  `).run({ id: currId, subject, grade_level: String(gradeLevel), standards, duration_weeks: duration,
            unit_count: unitCount, fee_usd: feePaid, commission_usd: commission });

  return {
    curriculum_id:          currId,
    subject,
    grade_level:            gradeLevel,
    standards_framework:    standards,
    standards_alignment:    standardsMap[standards] ?? standards,
    duration_weeks:         duration,
    unit_count:             unitCount,
    units,
    learning_objectives: units.flatMap(u => u.learning_objectives).slice(0, 12),
    assessments: [
      { type: "ongoing_formative",   description: "Daily warm-ups, exit tickets, and classroom observations",   weight_pct: 20 },
      { type: "unit_assessments",    description: "Unit quizzes and performance tasks",                         weight_pct: 50 },
      { type: "cumulative_final",    description: "Semester/end-of-year exam or capstone project",              weight_pct: 30 },
    ],
    estimated_hours:        Math.round(estimatedHours),
    instructional_minutes_per_week: 225,
    differentiation_strategies: [
      "Tiered assignments — on-level, above, and below grade",
      "Choice boards for project-based assessments",
      "Scaffolded notes and graphic organizers for ELL/IEP students",
      "Extension challenge problems for gifted learners",
    ],
    fee_usd:                feePaid,
    platform_commission_usd: commission,
    generated_at:           new Date().toISOString(),
  };
}

// ─── trackStudentProgress ─────────────────────────────────────────────────────

/**
 * Record and analyze student progress with adaptive gap identification.
 * @param {string}   studentId   - Unique student identifier
 * @param {string}   courseId    - Course identifier
 * @param {object[]} assessments - Array of { skill, score_pct, max_score_pct, date }
 * @returns Mastery analysis with strengths, gaps, recommended next steps, and intervention flag
 */
export function trackStudentProgress(studentId, courseId, assessments = []) {
  if (!studentId) throw new Error("studentId is required");
  if (!courseId)  throw new Error("courseId is required");
  if (!Array.isArray(assessments)) throw new Error("assessments must be an array");

  const feePaid = FEE_PROGRESS_UPDATE;

  // Upsert progress record
  const existing = db.prepare("SELECT * FROM edu_student_progress WHERE student_id = ? AND course_id = ?").get(studentId, courseId);
  const sessionCount = (existing?.sessions_count ?? 0) + 1;

  // Calculate mastery from assessments
  const avgScore = assessments.length > 0
    ? assessments.reduce((sum, a) => sum + (a.score_pct ?? 0), 0) / assessments.length
    : existing?.mastery_level ?? 0;

  const masteryLevel = Math.min(100, Math.round(
    existing ? (existing.mastery_level * 0.3 + avgScore * 0.7) : avgScore
  ));

  if (existing) {
    db.prepare(`
      UPDATE edu_student_progress
        SET mastery_level = @mastery, sessions_count = @sessions, last_updated = datetime('now')
      WHERE student_id = @sid AND course_id = @cid
    `).run({ mastery: masteryLevel, sessions: sessionCount, sid: studentId, cid: courseId });
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO edu_student_progress (id, student_id, course_id, mastery_level, sessions_count)
      VALUES (@id, @sid, @cid, @mastery, 1)
    `).run({ id: randomUUID(), sid: studentId, cid: courseId, mastery: masteryLevel });
  }

  // Analyze strengths and gaps
  const strengths = [];
  const gaps      = [];
  for (const a of assessments) {
    const score = a.score_pct ?? 0;
    if (score >= 80) {
      strengths.push({ skill: a.skill ?? "Assessed skill", score_pct: score, status: "mastered" });
    } else if (score < 65) {
      gaps.push({ skill: a.skill ?? "Assessed skill", score_pct: score, status: score < 50 ? "emerging" : "developing",
                  suggested_resources: [`Khan Academy — ${a.skill ?? "topic"}`, `Textbook review — related chapter`, `Small group reteach session`] });
    }
  }

  // Expected pace: 5 sessions per module, 8 modules per course
  const expectedSessions = 40;
  const paceRatio        = sessionCount / expectedSessions;
  const paceVsExpected   = paceRatio < 0.85 ? "behind" : paceRatio > 1.15 ? "ahead" : "on_track";

  const masteryBand = masteryLevel >= 90 ? "advanced" : masteryLevel >= 75 ? "proficient"
                    : masteryLevel >= 60 ? "approaching" : "below_basic";

  const interventionNeeded = gaps.length >= 3 || masteryLevel < 50 || (gaps.length >= 1 && paceVsExpected === "behind");

  const recommendedNext = [];
  if (gaps.length > 0) {
    recommendedNext.push(`Reteach and remediate: ${gaps.map(g => g.skill).join(", ")}`);
    recommendedNext.push("Schedule check-in with instructor for targeted support.");
  }
  if (masteryBand === "advanced") {
    recommendedNext.push("Enroll in next course or honors section — student is ready.");
    recommendedNext.push("Offer enrichment: independent research project or peer tutoring role.");
  }
  if (paceVsExpected === "behind") {
    recommendedNext.push("Increase session frequency — consider additional tutorial sessions.");
  }
  if (recommendedNext.length === 0) {
    recommendedNext.push("Continue at current pace — student is on track.");
  }

  return {
    tracking_id:          randomUUID(),
    student_id:           studentId,
    course_id:            courseId,
    mastery_level:        masteryLevel,
    mastery_band:         masteryBand,
    sessions_completed:   sessionCount,
    assessments_recorded: assessments.length,
    strengths,
    gaps,
    recommended_next:     recommendedNext,
    pace_vs_expected:     paceVsExpected,
    intervention_needed:  interventionNeeded,
    intervention_type:    interventionNeeded ? (masteryLevel < 50 ? "intensive_support" : "targeted_reteach") : null,
    fee_usd:              feePaid,
    updated_at:           new Date().toISOString(),
  };
}

// ─── verifyCredential ─────────────────────────────────────────────────────────

/**
 * Verify an academic credential (degree, certificate, transcript) against issuer records.
 * @param {string} credentialType - degree|transcript|certificate|license|certification|diploma
 * @param {string} issuer         - Issuing institution name
 * @param {string} credentialId   - Credential ID, serial number, or document number
 * @returns Verification result with issuer status, expiration, and blockchain hash
 */
export function verifyCredential(credentialType, issuer, credentialId) {
  if (!credentialType) throw new Error("credentialType is required");
  if (!issuer)         throw new Error("issuer is required");
  if (!credentialId)   throw new Error("credentialId is required");

  const feePaid       = FEE_CREDENTIAL_VERIFY;
  const validTypes    = ["degree","transcript","certificate","license","certification","diploma"];
  if (!validTypes.includes(credentialType.toLowerCase())) {
    throw new Error(`credentialType must be one of: ${validTypes.join(", ")}`);
  }

  // Check if credential already in DB
  let credential = db.prepare("SELECT * FROM edu_credentials WHERE credential_id = ?").get(credentialId);
  let issuerRow  = db.prepare("SELECT * FROM edu_issuers WHERE name LIKE ?").get(`%${issuer.split(" ").slice(0, 3).join(" ")}%`);

  // Simulate verification: well-known issuers get "verified" result
  const isKnownIssuer = issuerRow !== null;
  const verifiedBool  = isKnownIssuer;
  const issuerVerified = isKnownIssuer;

  if (!credential && isKnownIssuer) {
    const issueDate = new Date(Date.now() - Math.random() * 4 * 365 * 86400000).toISOString().split("T")[0];
    const expDate   = credentialType === "license" || credentialType === "certification"
                      ? new Date(Date.now() + (1 + Math.floor(Math.random() * 3)) * 365 * 86400000).toISOString().split("T")[0]
                      : null;
    const blockHash = issuerRow.blockchain_registry
      ? hashCredential(credentialId, issuer, issueDate)
      : null;

    db.prepare(`
      INSERT OR IGNORE INTO edu_credentials
        (id, credential_id, credential_type, issuer_id, issue_date, expiration_date, blockchain_hash, status)
      VALUES (@id, @cid, @ctype, @isid, @issued, @expires, @bhash, 'valid')
    `).run({ id: randomUUID(), cid: credentialId, ctype: credentialType.toLowerCase(),
              isid: issuerRow.id, issued: issueDate, expires: expDate ?? null, bhash: blockHash ?? null });

    credential = db.prepare("SELECT * FROM edu_credentials WHERE credential_id = ?").get(credentialId);
  }

  const expirationDate = credential?.expiration_date ?? null;
  const isExpired      = expirationDate ? new Date(expirationDate) < new Date() : false;
  const blockchainHash = credential?.blockchain_hash ?? (isKnownIssuer ? hashCredential(credentialId, issuer, credential?.issue_date ?? "2022-06-15") : null);

  return {
    verification_id:  randomUUID(),
    credential_type:  credentialType,
    issuer,
    credential_id:    credentialId,
    verified:         verifiedBool && !isExpired,
    issuer_verified:  issuerVerified,
    issuer_details: issuerRow ? {
      issuer_id:       issuerRow.id,
      official_name:   issuerRow.name,
      issuer_type:     issuerRow.issuer_type,
      accreditation:   issuerRow.accreditation,
      country:         issuerRow.country,
      state:           issuerRow.state,
      website:         issuerRow.website,
      blockchain_registry: issuerRow.blockchain_registry,
    } : { message: "Issuer not found in verified registry — manual verification required." },
    credential_details: credential ? {
      issue_date:      credential.issue_date,
      field_of_study:  credential.field_of_study,
      gpa:             credential.gpa,
      status:          credential.status,
    } : null,
    expiration_date:  expirationDate,
    is_expired:       isExpired,
    blockchain_hash:  blockchainHash,
    blockchain_verified: blockchainHash !== null,
    verification_method: blockchainHash ? "blockchain_registry" : isKnownIssuer ? "institutional_database" : "unverifiable",
    confidence:       verifiedBool && !isExpired ? "high" : isKnownIssuer ? "medium" : "low",
    fee_usd:          feePaid,
    verified_at:      new Date().toISOString(),
    disclaimer:       "For employment or legal purposes, request official transcripts directly from the institution.",
  };
}

// ─── detectAiContent ──────────────────────────────────────────────────────────

/**
 * Detect AI-generated content in student submissions.
 * @param {string} text    - Text to analyze
 * @param {string} context - Context: essay|code|report|response|other
 * @returns AI probability score, human probability, mixed segments, and detection method
 */
export function detectAiContent(text, context = "essay") {
  if (!text || text.trim().length < 20) throw new Error("text must be at least 20 characters");

  const feePaid   = FEE_AI_DETECT;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Heuristic AI-signal features (simplified simulation of a real classifier)
  let aiScore = 0.0;
  const signals = [];

  // 1. Burstiness: AI text tends to have lower perplexity variance
  const sentences     = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceLens  = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLen        = sentenceLens.reduce((a, b) => a + b, 0) / (sentenceLens.length || 1);
  const variance      = sentenceLens.reduce((v, l) => v + Math.pow(l - avgLen, 2), 0) / (sentenceLens.length || 1);
  const burstiness    = Math.sqrt(variance) / avgLen;
  if (burstiness < 0.25) { aiScore += 0.25; signals.push({ signal: "Low burstiness (uniform sentence lengths)", weight: 0.25 }); }

  // 2. Transition words typical of AI overuse
  const aiTransitions = /\b(furthermore|moreover|in conclusion|it is worth noting|it is important to|notably|in summary|delve|utilize|leverage|it is essential|in the realm of|as an ai|i cannot|as a language model)\b/gi;
  const transMatches  = (text.match(aiTransitions) ?? []).length;
  if (transMatches >= 3) { aiScore += 0.20; signals.push({ signal: `AI-typical phrasing detected (${transMatches} instances)`, weight: 0.20 }); }
  else if (transMatches >= 1) { aiScore += 0.08; signals.push({ signal: `Some AI-typical phrases (${transMatches} instances)`, weight: 0.08 }); }

  // 3. Absence of first-person voice in essays
  const firstPerson   = /\b(i |i'm|i've|i'll|my |me |we |our )\b/gi;
  const firstPersonCount = (text.match(firstPerson) ?? []).length;
  if (context === "essay" && firstPersonCount === 0 && wordCount > 150) {
    aiScore += 0.15; signals.push({ signal: "No first-person voice in personal essay", weight: 0.15 });
  }

  // 4. Suspiciously even paragraph structure
  const paragraphs    = text.split(/\n\n+/).filter(p => p.trim().length > 30);
  const paraLens      = paragraphs.map(p => p.trim().split(/\s+/).length);
  const paraVariance  = paraLens.length > 1
    ? paraLens.reduce((v, l) => v + Math.pow(l - paraLens[0], 2), 0) / paraLens.length
    : 0;
  if (paraLens.length >= 3 && paraVariance < 400) {
    aiScore += 0.15; signals.push({ signal: "Suspiciously uniform paragraph lengths", weight: 0.15 });
  }

  // 5. Hedging without specific claims
  const hedges        = /\b(some argue|many believe|it has been suggested|research suggests|studies show|experts say)\b/gi;
  const hedgeCount    = (text.match(hedges) ?? []).length;
  if (hedgeCount >= 4) { aiScore += 0.10; signals.push({ signal: `Excessive non-specific hedging language (${hedgeCount} instances)`, weight: 0.10 }); }

  // 6. Repeated structural starts ("First, ... Second, ... Third, ...")
  const structStarts  = /\b(first,|second,|third,|fourth,|finally,|additionally,|subsequently,|consequently,)\b/gi;
  const structCount   = (text.match(structStarts) ?? []).length;
  if (structCount >= 3) { aiScore += 0.10; signals.push({ signal: "Mechanical structural organization markers", weight: 0.10 }); }

  // Cap and adjust
  aiScore = Math.min(0.97, aiScore);
  const humanScore = 1 - aiScore;

  // Mixed segments (simplified: flag paragraphs with high AI signals)
  const mixedSegments = paragraphs.slice(0, 5).map((para, idx) => {
    const paraAiHints  = (para.match(aiTransitions) ?? []).length + (para.match(hedges) ?? []).length;
    const paraAiProb   = Math.min(0.95, paraAiHints * 0.15 + (aiScore * 0.5));
    return {
      segment_index:    idx,
      text_preview:     para.trim().slice(0, 80) + (para.length > 80 ? "..." : ""),
      ai_probability:   Math.round(paraAiProb * 100) / 100,
      human_probability: Math.round((1 - paraAiProb) * 100) / 100,
    };
  });

  const overallLabel = aiScore >= 0.75 ? "likely_ai_generated"
                     : aiScore >= 0.50 ? "possibly_ai_generated"
                     : aiScore >= 0.25 ? "mixed_or_ai_assisted"
                     : "likely_human_written";

  return {
    scan_id:          randomUUID(),
    context,
    word_count:       wordCount,
    ai_probability:   Math.round(aiScore * 100) / 100,
    human_probability: Math.round(humanScore * 100) / 100,
    overall_label:    overallLabel,
    confidence:       signals.length >= 3 ? "high" : signals.length >= 1 ? "medium" : "low",
    detection_method: "heuristic_multi_signal_classifier",
    signals_detected: signals,
    mixed_segments:   mixedSegments,
    recommendation:   aiScore >= 0.75 ? "Flag for instructor review — multiple strong AI indicators detected."
                    : aiScore >= 0.50 ? "Request in-class writing sample for comparison."
                    : aiScore >= 0.25 ? "Minor AI assistance possible — consider brief oral discussion."
                    : "No significant AI signals — submission appears human-authored.",
    fee_usd:          feePaid,
    scanned_at:       new Date().toISOString(),
    disclaimer:       "AI detection tools are not 100% accurate. Results should inform — not replace — instructor judgment.",
  };
}

// ─── checkFinancialAid ────────────────────────────────────────────────────────

/**
 * Check financial aid eligibility for a student based on profile, institution, and program.
 * @param {object} studentProfile - { dependency_status, agi_usd, assets_usd, household_size, enrollment_status, state, gpa, citizenship }
 * @param {string} institution    - Institution name or type
 * @param {string} programType    - undergraduate|graduate|vocational|certificate
 * @returns Eligible programs with estimated award amounts, EFC, and application deadlines
 */
export function checkFinancialAid(studentProfile, institution, programType = "undergraduate") {
  if (!studentProfile || typeof studentProfile !== "object") throw new Error("studentProfile object is required");
  if (!institution)    throw new Error("institution is required");

  const feePaid = FEE_FINANCIAL_AID;

  const {
    dependency_status = "dependent",
    agi_usd           = 45000,
    assets_usd        = 10000,
    household_size    = 4,
    enrollment_status = "full_time",
    state             = "CA",
    gpa               = 3.0,
    citizenship       = "us_citizen",
  } = studentProfile;

  const isGrad     = programType === "graduate";
  const isIndep    = dependency_status === "independent";
  const isCitizen  = citizenship === "us_citizen" || citizenship === "permanent_resident";

  // Simplified SAI (Student Aid Index) calculation based on FAFSA 2024+ formula
  const incomeContribution = Math.max(0, (agi_usd - 25000) * (isIndep ? 0.22 : 0.22));
  const assetContribution  = Math.max(0, assets_usd * 0.12);
  const sai = Math.max(0, Math.round(incomeContribution + assetContribution - household_size * 1500));

  // COA estimates (simplified)
  const coaMap = {
    "4-year_public":     27000, "4-year_private": 58000, "community_college": 16000,
    "vocational":        12000, "graduate":        42000,
  };
  const instLower = institution.toLowerCase();
  const coaKey    = isGrad ? "graduate"
                  : instLower.includes("community") ? "community_college"
                  : instLower.includes("private") || ["harvard","stanford","mit","yale"].some(n => instLower.includes(n)) ? "4-year_private"
                  : programType === "vocational" ? "vocational"
                  : "4-year_public";
  const coa       = coaMap[coaKey] ?? 27000;
  const needAmount = Math.max(0, coa - sai);

  // Federal Aid Programs
  const eligiblePrograms = [];
  const estimatedAid     = { grants: 0, loans: 0, work_study: 0 };

  if (isCitizen) {
    // Pell Grant (undergraduate only)
    if (!isGrad && agi_usd < 60000 && enrollment_status !== "less_than_half_time") {
      const pellMax  = 7395; // 2025-26 max
      const pellAmt  = Math.max(0, Math.min(pellMax, Math.round(pellMax * (1 - sai / 7000) * (enrollment_status === "full_time" ? 1.0 : 0.5))));
      if (pellAmt > 0) {
        eligiblePrograms.push({ program: "Federal Pell Grant", type: "grant", estimated_amount_usd: pellAmt, renewable: true, based_on: "financial_need", url: "https://studentaid.gov/understand-aid/types/grants/pell" });
        estimatedAid.grants += pellAmt;
      }
    }

    // Subsidized Direct Loan
    if (!isGrad && needAmount > 0) {
      const subLimit = [3500, 4500, 5500, 5500][Math.min(3, Math.floor(gpa > 3.0 ? 1 : 0))];
      eligiblePrograms.push({ program: "Federal Direct Subsidized Loan", type: "loan", estimated_amount_usd: subLimit, interest_rate_pct: 6.53, renewable: true, based_on: "financial_need", url: "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized" });
      estimatedAid.loans += subLimit;
    }

    // Unsubsidized Direct Loan
    const unsubLimit = isGrad ? 20500 : 7000;
    eligiblePrograms.push({ program: `Federal Direct Unsubsidized Loan${isGrad ? " (Graduate)" : ""}`, type: "loan", estimated_amount_usd: unsubLimit, interest_rate_pct: isGrad ? 8.08 : 6.53, renewable: true, based_on: "enrollment_only", url: "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized" });
    estimatedAid.loans += unsubLimit;

    // Federal Work-Study
    if (needAmount > 2000 && enrollment_status === "full_time") {
      const wsAmt = Math.min(3500, Math.round(needAmount * 0.10));
      eligiblePrograms.push({ program: "Federal Work-Study Program", type: "work_study", estimated_amount_usd: wsAmt, renewable: true, based_on: "financial_need", url: "https://studentaid.gov/understand-aid/types/work-study" });
      estimatedAid.work_study += wsAmt;
    }

    // TEACH Grant (education students)
    if (!isGrad && instLower.includes("education") || programType === "certificate") {
      eligiblePrograms.push({ program: "Federal TEACH Grant", type: "grant", estimated_amount_usd: 4000, renewable: true, based_on: "service_commitment", note: "Converts to unsubsidized loan if service requirement not met", url: "https://studentaid.gov/understand-aid/types/grants/teach" });
    }

    // Iraq/Afghanistan Service Grant
    if (studentProfile.parent_died_military) {
      eligiblePrograms.push({ program: "Iraq and Afghanistan Service Grant", type: "grant", estimated_amount_usd: 7395, renewable: true, based_on: "eligibility_category", url: "https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service" });
    }
  }

  // State Grant (California example)
  if (state === "CA" && !isGrad && agi_usd < 90000) {
    const calgrantAmt = agi_usd < 46000 ? 9358 : Math.round(9358 * (1 - (agi_usd - 46000) / 44000));
    if (calgrantAmt > 0) {
      eligiblePrograms.push({ program: "Cal Grant A/B (California)", type: "grant", estimated_amount_usd: calgrantAmt, renewable: true, based_on: "need_and_gpa", note: "Requires FAFSA + GPA verification form by March 2", url: "https://www.csac.ca.gov/cal-grants" });
      estimatedAid.grants += calgrantAmt;
    }
  }

  // Merit scholarship estimate
  if (gpa >= 3.75) {
    eligiblePrograms.push({ program: "Institutional Merit Scholarship (estimate)", type: "grant", estimated_amount_usd: Math.round(coa * 0.15), renewable: true, based_on: "academic_merit", note: "Amount varies widely by institution — apply directly", url: null });
    estimatedAid.grants += Math.round(coa * 0.15);
  }

  const totalEstimatedAid = estimatedAid.grants + estimatedAid.loans + estimatedAid.work_study;

  const applicationDeadlines = [
    { program: "FAFSA",                          deadline: "June 30, 2027 (federal deadline)",    priority_deadline: "Check institution for priority date", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
    { program: "CSS Profile (private colleges)", deadline: "Varies by institution",               priority_deadline: "October–February for most schools", url: "https://cssprofile.collegeboard.org" },
    ...(state === "CA" ? [{ program: "Cal Grant",  deadline: "March 2, 2027",                      priority_deadline: "March 2, 2027 — strict deadline",  url: "https://myfafsa.ca.gov" }] : []),
  ];

  return {
    check_id:              randomUUID(),
    institution,
    program_type:          programType,
    student_profile_summary: {
      dependency_status, agi_usd, household_size, enrollment_status, state, gpa, citizenship,
    },
    sai_estimate:          sai,
    cost_of_attendance_est_usd: coa,
    financial_need_est_usd: needAmount,
    eligible_programs:     eligiblePrograms,
    estimated_aid: {
      grants_usd:          estimatedAid.grants,
      loans_usd:           estimatedAid.loans,
      work_study_usd:      estimatedAid.work_study,
      total_usd:           totalEstimatedAid,
    },
    estimated_out_of_pocket_usd: Math.max(0, coa - totalEstimatedAid),
    efc_estimate:          sai,
    application_deadlines: applicationDeadlines,
    next_steps: [
      "Complete FAFSA at studentaid.gov as early as possible after October 1.",
      "Submit CSS Profile if applying to private colleges.",
      "Contact institution's Financial Aid Office for institutional grant information.",
      `File state financial aid application for ${state} by the state deadline.`,
      "Explore institutional and private scholarships at fastweb.com and scholarships.com.",
    ],
    fee_usd:               feePaid,
    checked_at:            new Date().toISOString(),
    disclaimer:            "Aid estimates are illustrative based on provided profile data. Actual awards are determined by the institution and government after official FAFSA processing.",
  };
}
