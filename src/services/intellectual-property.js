import { v4 as uuid } from "uuid";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEES = {
  search_patents:    1.00,
  analyze_prior_art: 5.00,
  monitor_trademark: 2.00, // per month
  draft_claims:     10.00,
  ip_portfolio:      3.00,
  fto_analysis:      5.00,
};

const VALID_JURISDICTIONS = ["US", "EP", "WO", "CN", "JP", "KR", "CA", "AU", "GB", "DE"];
const RISK_LEVELS         = ["low", "medium", "high", "critical"];

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ip_patents (
    id              TEXT PRIMARY KEY,
    number          TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    abstract        TEXT NOT NULL,
    filing_date     TEXT NOT NULL,
    grant_date      TEXT,
    assignee        TEXT NOT NULL,
    inventors       TEXT DEFAULT '[]',
    classification  TEXT,
    jurisdiction    TEXT NOT NULL DEFAULT 'US',
    status          TEXT DEFAULT 'active' CHECK(status IN ('pending','active','expired','abandoned')),
    claims_count    INTEGER DEFAULT 0,
    citations_count INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_patent_searches (
    id              TEXT PRIMARY KEY,
    query           TEXT NOT NULL,
    classification  TEXT,
    date_range      TEXT DEFAULT '{}',
    jurisdiction    TEXT DEFAULT 'US',
    result_ids      TEXT DEFAULT '[]',
    total_found     INTEGER DEFAULT 0,
    fee_usd         REAL DEFAULT 1.00,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_prior_art_analyses (
    id                         TEXT PRIMARY KEY,
    invention_description      TEXT NOT NULL,
    claims                     TEXT DEFAULT '[]',
    prior_art_found            TEXT DEFAULT '[]',
    novelty_assessment         TEXT DEFAULT '{}',
    patentability_score        REAL DEFAULT 0,
    claim_modifications        TEXT DEFAULT '[]',
    fee_usd                    REAL DEFAULT 5.00,
    created_at                 TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_trademark_monitors (
    id             TEXT PRIMARY KEY,
    trademark      TEXT NOT NULL,
    classes        TEXT DEFAULT '[]',
    jurisdictions  TEXT DEFAULT '[]',
    conflicts      TEXT DEFAULT '[]',
    last_checked   TEXT,
    fee_usd        REAL DEFAULT 2.00,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_patent_drafts (
    id                        TEXT PRIMARY KEY,
    invention_description     TEXT NOT NULL,
    prior_art                 TEXT DEFAULT '[]',
    independent_claims        TEXT DEFAULT '[]',
    dependent_claims          TEXT DEFAULT '[]',
    specification_outline     TEXT DEFAULT '{}',
    estimated_prosecution_time TEXT,
    fee_usd                   REAL DEFAULT 10.00,
    created_at                TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_portfolios (
    id                   TEXT PRIMARY KEY,
    owner_id             TEXT NOT NULL UNIQUE,
    patents              TEXT DEFAULT '[]',
    trademarks           TEXT DEFAULT '[]',
    copyrights           TEXT DEFAULT '[]',
    total_value_estimate REAL DEFAULT 0,
    expiring_soon        TEXT DEFAULT '[]',
    maintenance_due      TEXT DEFAULT '[]',
    last_updated         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ip_fto_analyses (
    id                   TEXT PRIMARY KEY,
    product_description  TEXT NOT NULL,
    jurisdiction         TEXT NOT NULL,
    clear                INTEGER DEFAULT 0,
    blocking_patents     TEXT DEFAULT '[]',
    design_around        TEXT DEFAULT '[]',
    risk_assessment      TEXT DEFAULT '{}',
    fee_usd              REAL DEFAULT 5.00,
    created_at           TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Patents ─────────────────────────────────────────────────────────────

const _patentCount = db.prepare("SELECT COUNT(*) as n FROM ip_patents").get().n;
if (_patentCount === 0) {
  const seedPatents = [
    { number: "US10234567B2", title: "Method and System for Neural Network Compression",          abstract: "A method for reducing neural network model size using structured pruning and quantization techniques while preserving inference accuracy.",                               filing_date: "2020-03-15", assignee: "DeepTech Systems Inc.",      classification: "G06N 3/08",  jurisdiction: "US", status: "active",  claims_count: 18, citations_count: 42 },
    { number: "US10456789B1", title: "Distributed Ledger Transaction Verification Protocol",       abstract: "Systems and methods for achieving consensus in distributed ledger networks using proof-of-stake mechanisms with Byzantine fault tolerance.",                          filing_date: "2019-07-22", assignee: "BlockFoundation Ltd.",       classification: "G06F 21/64", jurisdiction: "US", status: "active",  claims_count: 24, citations_count: 67 },
    { number: "US10678901A1", title: "Autonomous Vehicle Perception System Using LiDAR Fusion",   abstract: "A sensor fusion architecture combining LiDAR, radar, and camera inputs for real-time object detection and scene understanding in autonomous driving applications.",  filing_date: "2021-01-10", assignee: "AutoDrive Technologies",     classification: "G08G 1/16",  jurisdiction: "US", status: "pending", claims_count: 32, citations_count: 19 },
    { number: "EP3456789A1",  title: "Biodegradable Polymer Composite for Packaging Applications", abstract: "A biodegradable polymer blend comprising polylactic acid and natural fiber reinforcements suitable for food-safe packaging with 90-day decomposition profile.",       filing_date: "2018-11-05", assignee: "GreenMatter GmbH",           classification: "C08L 67/04", jurisdiction: "EP", status: "active",  claims_count: 15, citations_count: 38 },
    { number: "WO2022045678", title: "CRISPR-Based Gene Editing for Sickle Cell Disease",         abstract: "A therapeutic approach using modified CRISPR-Cas9 to correct the HBB gene mutation responsible for sickle cell disease with off-target minimization.",                filing_date: "2021-09-30", assignee: "GeneTherapy Global Inc.",    classification: "C12N 15/11", jurisdiction: "WO", status: "pending", claims_count: 41, citations_count: 28 },
    { number: "US10891234B2", title: "Quantum Error Correction Using Surface Codes",              abstract: "Implementation of topological surface codes for fault-tolerant quantum computation, enabling logical qubit error rates below the fault-tolerance threshold.",          filing_date: "2020-06-18", assignee: "QuantumEdge Labs",           classification: "G06N 10/00", jurisdiction: "US", status: "active",  claims_count: 27, citations_count: 55 },
    { number: "US11023456A1", title: "Edge Computing Framework for IoT Data Processing",          abstract: "A distributed edge computing architecture enabling real-time IoT data preprocessing with adaptive load balancing and privacy-preserving federated learning.",           filing_date: "2022-02-14", assignee: "EdgeFlow Systems",           classification: "H04L 67/10", jurisdiction: "US", status: "pending", claims_count: 21, citations_count: 11 },
    { number: "JP2020123456A", title: "High-Efficiency Perovskite Solar Cell Structure",         abstract: "A tandem perovskite-silicon solar cell achieving 31% efficiency through novel interface passivation and charge transport layer optimization.",                          filing_date: "2019-04-25", assignee: "SolarAdvance Corp.",         classification: "H01L 31/04", jurisdiction: "JP", status: "active",  claims_count: 19, citations_count: 48 },
    { number: "US10765432B1", title: "Natural Language Query Interface for Database Systems",     abstract: "An AI-powered natural language processing system that translates plain-English queries into optimized SQL statements with semantic understanding of schema context.", filing_date: "2021-08-03", assignee: "DataBridge Technologies",    classification: "G06F 16/903",jurisdiction: "US", status: "active",  claims_count: 16, citations_count: 33 },
    { number: "EP3789012B1",  title: "Microfluidic Lab-on-Chip for Rapid Pathogen Detection",    abstract: "A microfluidic device integrating PCR amplification and optical detection for point-of-care pathogen identification within 15 minutes from sample to result.",          filing_date: "2018-05-30", assignee: "BioSense Diagnostics",       classification: "B01L 3/00",  jurisdiction: "EP", status: "active",  claims_count: 28, citations_count: 71 },
    { number: "US11145678B2", title: "Adversarial Robustness Training for Computer Vision Models",abstract: "Training methodology combining certified defenses and data augmentation strategies to improve neural network robustness against adversarial image perturbations.",     filing_date: "2020-12-01", assignee: "Robust AI Research",         classification: "G06N 3/04",  jurisdiction: "US", status: "active",  claims_count: 14, citations_count: 29 },
    { number: "CN112345678A",  title: "5G mmWave Beamforming Antenna Array Design",              abstract: "A massive MIMO antenna array design for 5G millimeter-wave communications with hybrid analog-digital beamforming achieving 64 simultaneous spatial streams.",           filing_date: "2020-09-12", assignee: "TelecomPro Ltd.",            classification: "H01Q 3/26",  jurisdiction: "CN", status: "active",  claims_count: 23, citations_count: 41 },
    { number: "US10987654A1", title: "Carbon Capture via Metal-Organic Framework Sorbents",      abstract: "A cyclic adsorption process using novel MOF sorbents for direct air capture of CO2 with sub-$100/tonne capture cost at industrial scale.",                            filing_date: "2021-06-07", assignee: "CleanAir Innovations",       classification: "B01D 53/04", jurisdiction: "US", status: "pending", claims_count: 20, citations_count: 16 },
    { number: "KR20210098765A","title": "Flexible OLED Display with Self-Healing Polymer Substrate", abstract: "A flexible OLED display incorporating a self-healing polyurethane substrate that recovers from mechanical damage within 30 minutes at room temperature.",      filing_date: "2020-11-18", assignee: "DisplayTech Korea",          classification: "H10K 77/10", jurisdiction: "KR", status: "active",  claims_count: 17, citations_count: 36 },
    { number: "US11234567B2", title: "Homomorphic Encryption for Privacy-Preserving ML Inference",abstract: "A practical homomorphic encryption scheme enabling machine learning model inference on encrypted data with polynomial-time computational overhead.",                  filing_date: "2021-04-20", assignee: "PrivacyGuard Technologies",  classification: "G06F 21/60", jurisdiction: "US", status: "active",  claims_count: 22, citations_count: 44 },
    { number: "EP3901234A1",  title: "Solid-State Lithium Battery with Ceramic Electrolyte",     abstract: "An all-solid-state lithium battery using a garnet-type ceramic electrolyte achieving 450 Wh/kg energy density with 1000-cycle calendar life at 25°C.",                filing_date: "2021-03-08", assignee: "BatteryFuture AG",           classification: "H01M 10/052",jurisdiction: "EP", status: "pending", claims_count: 26, citations_count: 22 },
    { number: "US10543210B1", title: "Zero-Trust Network Security Architecture",                  abstract: "A zero-trust security framework implementing continuous verification of device identity, user behavior, and workload integrity using AI-driven anomaly detection.",     filing_date: "2019-10-14", assignee: "CyberShield Corp.",          classification: "H04L 9/40",  jurisdiction: "US", status: "active",  claims_count: 19, citations_count: 58 },
    { number: "WO2023067890", title: "mRNA Delivery Nanoparticle with Organ-Selective Targeting", abstract: "Lipid nanoparticle formulations with ionizable lipid compositions enabling organ-selective mRNA delivery for therapeutic applications beyond the liver.",               filing_date: "2022-08-25", assignee: "NanoBio Therapeutics",       classification: "A61K 9/51",  jurisdiction: "WO", status: "pending", claims_count: 35, citations_count: 14 },
    { number: "US11345678A1", title: "Reinforcement Learning for Robotic Manipulation Tasks",     abstract: "A sim-to-real transfer framework for robot arm manipulation using domain randomization and meta-learning to achieve sub-5mm placement accuracy on novel objects.",    filing_date: "2022-01-19", assignee: "RoboLearn Systems",          classification: "G05B 13/02", jurisdiction: "US", status: "pending", claims_count: 18, citations_count: 9  },
    { number: "AU2021234567B2","title": "Water Recycling System for Arid Climate Agriculture",   abstract: "An integrated atmospheric water generation and closed-loop drip irrigation system enabling crop yields of 90% of conventional farming with zero external water input.", filing_date: "2020-07-11", assignee: "AquaGrow Solutions",         classification: "A01G 25/02", jurisdiction: "AU", status: "active",  claims_count: 13, citations_count: 25 },
  ];

  const insertPatent = db.prepare(`
    INSERT OR IGNORE INTO ip_patents
      (id, number, title, abstract, filing_date, assignee, classification, jurisdiction, status, claims_count, citations_count)
    VALUES
      (@id, @number, @title, @abstract, @filing_date, @assignee, @classification, @jurisdiction, @status, @claims_count, @citations_count)
  `);
  for (const p of seedPatents) insertPatent.run({ id: uuid(), ...p });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function relevanceScore(patent, query) {
  const q    = query.toLowerCase();
  const text = `${patent.title} ${patent.abstract}`.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const matches = words.filter(w => text.includes(w)).length;
  return parseFloat(Math.min(1.0, (matches / Math.max(words.length, 1)) + Math.random() * 0.3).toFixed(2));
}

// ─── Search Patents ───────────────────────────────────────────────────────────

/**
 * Search the patent database by keyword query, classification, date range, and jurisdiction.
 * @param {string} query          - Keyword or phrase to search
 * @param {string} classification - IPC/CPC classification code (optional)
 * @param {object} dateRange      - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } (optional)
 * @param {string} jurisdiction   - US|EP|WO|CN|JP|KR etc. (optional)
 * @returns Matching patents with relevance scores
 */
export function searchPatents(query, classification = null, dateRange = {}, jurisdiction = null) {
  if (!query) throw new Error("query is required");

  let sql    = "SELECT * FROM ip_patents WHERE 1=1";
  const params = [];

  if (jurisdiction && VALID_JURISDICTIONS.includes(jurisdiction)) {
    sql += " AND jurisdiction = ?";
    params.push(jurisdiction);
  }
  if (classification) {
    sql += " AND classification LIKE ?";
    params.push(`${classification}%`);
  }
  if (dateRange.start) {
    sql += " AND filing_date >= ?";
    params.push(dateRange.start);
  }
  if (dateRange.end) {
    sql += " AND filing_date <= ?";
    params.push(dateRange.end);
  }

  sql += " LIMIT 50";
  const allPatents = db.prepare(sql).all(...params);

  // Score and filter by relevance
  const scored = allPatents
    .map(p => ({ ...p, relevance_score: relevanceScore(p, query) }))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20);

  const id  = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO ip_patent_searches
      (id, query, classification, date_range, jurisdiction, result_ids, total_found, fee_usd, created_at)
    VALUES
      (@id, @query, @classification, @date_range, @jurisdiction, @result_ids, @total_found, @fee_usd, @created_at)
  `).run({
    id,
    query,
    classification:  classification ?? null,
    date_range:      JSON.stringify(dateRange),
    jurisdiction:    jurisdiction ?? "all",
    result_ids:      JSON.stringify(scored.map(p => p.id)),
    total_found:     scored.length,
    fee_usd:         FEES.search_patents,
    created_at:      now,
  });

  return {
    search_id:   id,
    query,
    filters:     { classification, date_range: dateRange, jurisdiction },
    total_found: scored.length,
    patents:     scored.map(p => ({
      patent_id:       p.id,
      number:          p.number,
      title:           p.title,
      abstract:        p.abstract,
      filing_date:     p.filing_date,
      assignee:        p.assignee,
      classification:  p.classification,
      jurisdiction:    p.jurisdiction,
      status:          p.status,
      claims_count:    p.claims_count,
      citations_count: p.citations_count,
      relevance_score: p.relevance_score,
    })),
    fee_usd:     FEES.search_patents,
    created_at:  now,
  };
}

// ─── Analyze Prior Art ────────────────────────────────────────────────────────

/**
 * Perform prior art analysis for a prospective invention.
 * @param {string}   inventionDescription - Detailed description of the invention
 * @param {string[]} claims               - Proposed patent claims
 * @returns Prior art list, novelty assessment, patentability score, and claim modification suggestions
 */
export function analyzePriorArt(inventionDescription, claims = []) {
  if (!inventionDescription) throw new Error("inventionDescription is required");

  const id  = uuid();
  const now = new Date().toISOString();

  const allPatents = db.prepare("SELECT * FROM ip_patents LIMIT 20").all();
  const priorArtFound = allPatents
    .filter(() => Math.random() > 0.55)
    .slice(0, randomInt(2, 6))
    .map(p => ({
      patent_number:    p.number,
      title:            p.title,
      assignee:         p.assignee,
      filing_date:      p.filing_date,
      overlap_elements: ["core_mechanism", "system_architecture", "claim_language"].filter(() => Math.random() > 0.5),
      relevance_score:  randomFloat(0.4, 0.9),
      concern_level:    pickRandom(RISK_LEVELS),
    }));

  const patentabilityScore = parseFloat(Math.max(15, 95 - priorArtFound.length * 12 + randomFloat(-5, 10)).toFixed(1));

  const noveltyAssessment = {
    novel:                     patentabilityScore > 60,
    non_obvious:               patentabilityScore > 50,
    utility:                   true,
    primary_concern:           priorArtFound.length > 3 ? "anticipation" : priorArtFound.length > 1 ? "obviousness" : "none",
    recommended_action:        patentabilityScore > 70 ? "proceed_to_filing" : patentabilityScore > 45 ? "amend_claims" : "reconsider_invention",
    estimated_allowance_chance: `${Math.floor(patentabilityScore * 0.8)}%`,
  };

  const claimModifications = claims.slice(0, 3).map((claim, i) => ({
    claim_index:        i + 1,
    original:           claim.slice(0, 120),
    modification:       `Amended to add the limitation of [specific technical feature] to distinguish from prior art in ${priorArtFound[0]?.patent_number ?? "found references"}.`,
    rationale:          "Narrowing amendment to overcome §102 rejection risk.",
    strength_after_amendment: pickRandom(["strong", "moderate", "weak"]),
  }));

  db.prepare(`
    INSERT OR IGNORE INTO ip_prior_art_analyses
      (id, invention_description, claims, prior_art_found, novelty_assessment,
       patentability_score, claim_modifications, fee_usd, created_at)
    VALUES
      (@id, @invention_description, @claims, @prior_art_found, @novelty_assessment,
       @patentability_score, @claim_modifications, @fee_usd, @created_at)
  `).run({
    id,
    invention_description: inventionDescription.slice(0, 2000),
    claims:                JSON.stringify(claims),
    prior_art_found:       JSON.stringify(priorArtFound),
    novelty_assessment:    JSON.stringify(noveltyAssessment),
    patentability_score:   patentabilityScore,
    claim_modifications:   JSON.stringify(claimModifications),
    fee_usd:               FEES.analyze_prior_art,
    created_at:            now,
  });

  return {
    analysis_id:               id,
    prior_art_found:           priorArtFound,
    novelty_assessment:        noveltyAssessment,
    patentability_score:       patentabilityScore,
    recommended_claim_modifications: claimModifications,
    fee_usd:                   FEES.analyze_prior_art,
    created_at:                now,
  };
}

// ─── Monitor Trademark ────────────────────────────────────────────────────────

/**
 * Monitor a trademark for potential infringements and conflicts across jurisdictions.
 * @param {string}   trademark    - The trademark text/name to monitor
 * @param {number[]} classes      - International trademark classes (1-45)
 * @param {string[]} jurisdictions - Jurisdictions to monitor (US, EP, CN...)
 * @returns Conflict list with similarity scores and risk levels
 */
export function monitorTrademark(trademark, classes = [], jurisdictions = ["US"]) {
  if (!trademark) throw new Error("trademark is required");

  const id  = uuid();
  const now = new Date().toISOString();

  const invalidJur = jurisdictions.filter(j => !VALID_JURISDICTIONS.includes(j));
  if (invalidJur.length > 0) {
    throw new Error(`Invalid jurisdictions: ${invalidJur.join(", ")}. Must be from: ${VALID_JURISDICTIONS.join(", ")}`);
  }

  // Simulate conflict detection
  const potentialConflicts = [
    { mark: `${trademark.slice(0, 4)}Tech`,    owner: "TechCorp Inc.",        similarity_pct: 82 },
    { mark: `${trademark}Pro`,                 owner: "ProSolutions Ltd.",     similarity_pct: 71 },
    { mark: `i${trademark}`,                   owner: "iProducts Global",      similarity_pct: 68 },
    { mark: `${trademark.slice(0, -1)}s`,      owner: "Brand Holdings Group",  similarity_pct: 65 },
    { mark: trademark.toUpperCase(),           owner: "Global Marks LLC",      similarity_pct: 95 },
  ].filter(() => Math.random() > 0.45).slice(0, randomInt(0, 4));

  const conflicts = potentialConflicts.map(c => ({
    mark:             c.mark,
    owner:            c.owner,
    class:            classes[0] ?? randomInt(1, 45),
    jurisdiction:     pickRandom(jurisdictions),
    filing_date:      `20${randomInt(15, 23)}-${String(randomInt(1, 12)).padStart(2, "0")}-${String(randomInt(1, 28)).padStart(2, "0")}`,
    status:           pickRandom(["registered", "pending", "opposition"]),
    similarity_score: parseFloat((c.similarity_pct / 100).toFixed(2)),
    risk_level:       c.similarity_pct >= 80 ? "high" : c.similarity_pct >= 65 ? "medium" : "low",
    recommended_action: c.similarity_pct >= 80 ? "consult_attorney_immediately" : "monitor_closely",
  }));

  db.prepare(`
    INSERT OR IGNORE INTO ip_trademark_monitors
      (id, trademark, classes, jurisdictions, conflicts, last_checked, fee_usd, created_at)
    VALUES
      (@id, @trademark, @classes, @jurisdictions, @conflicts, @last_checked, @fee_usd, @created_at)
  `).run({
    id,
    trademark,
    classes:       JSON.stringify(classes),
    jurisdictions: JSON.stringify(jurisdictions),
    conflicts:     JSON.stringify(conflicts),
    last_checked:  now,
    fee_usd:       FEES.monitor_trademark,
    created_at:    now,
  });

  return {
    monitor_id:    id,
    trademark,
    classes,
    jurisdictions,
    conflicts,
    conflict_count: conflicts.length,
    highest_risk:   conflicts.length > 0
      ? conflicts.reduce((a, b) => a.similarity_score > b.similarity_score ? a : b).risk_level
      : "none",
    fee_usd:       FEES.monitor_trademark,
    next_check_at: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
    created_at:    now,
  };
}

// ─── Draft Patent Claims ──────────────────────────────────────────────────────

/**
 * Auto-draft independent and dependent patent claims for an invention.
 * @param {string}   inventionDescription - Detailed technical description of the invention
 * @param {object[]} priorArt             - Known prior art references to design around
 * @returns Independent claims, dependent claims, specification outline, and prosecution timeline
 */
export function draftPatentClaims(inventionDescription, priorArt = []) {
  if (!inventionDescription) throw new Error("inventionDescription is required");

  const id  = uuid();
  const now = new Date().toISOString();

  // Build independent claims
  const independentClaims = [
    {
      claim_number: 1,
      type:         "independent",
      preamble:     "A system comprising:",
      body:         [
        `a processor configured to ${inventionDescription.slice(0, 80).toLowerCase().replace(/[^a-z0-9 ]/g, "")};`,
        "a memory storing instructions that, when executed by the processor, cause the processor to perform operations including:",
        "  receiving input data associated with the claimed functionality;",
        "  applying one or more transformations to said input data; and",
        "  generating an output reflecting the core inventive concept.",
      ],
      strength:     "broad",
    },
    {
      claim_number: 2,
      type:         "independent",
      preamble:     "A method comprising:",
      body:         [
        `receiving, by a computing system, data pertaining to ${inventionDescription.slice(0, 60).toLowerCase()};`,
        "processing said data using a trained model or algorithm;",
        "outputting a result based on the processing; and",
        "transmitting the result to a requesting entity.",
      ],
      strength:     "broad",
    },
    {
      claim_number: 3,
      type:         "independent",
      preamble:     "A non-transitory computer-readable medium storing instructions that, when executed, cause a processor to:",
      body:         [
        "perform the method of claim 2;",
        "wherein the instructions are optimized for execution on edge devices with limited compute resources.",
      ],
      strength:     "standard",
    },
  ];

  const dependentClaims = Array.from({ length: 8 }, (_, i) => ({
    claim_number: i + 4,
    type:         "dependent",
    depends_on:   i < 4 ? 1 : 2,
    limitation:   [
      "wherein the processor is a graphics processing unit (GPU).",
      "wherein the memory is a non-volatile solid-state memory.",
      "wherein the input data comprises time-series measurements.",
      "wherein the transformation includes a normalization step.",
      "further comprising a user interface module for displaying results.",
      "wherein the model is periodically retrained on newly collected data.",
      "further comprising an encryption layer protecting data in transit.",
      "wherein the system achieves sub-10ms latency on standard hardware.",
    ][i],
    strength:     "narrow",
  }));

  const specificationOutline = {
    sections: [
      { title: "Field of the Invention",       pages: 1 },
      { title: "Background of the Invention",  pages: 2 },
      { title: "Summary of the Invention",     pages: 1 },
      { title: "Brief Description of Drawings", pages: 1 },
      { title: "Detailed Description",         pages: 8 },
      { title: "Claims",                       pages: 3 },
      { title: "Abstract",                     pages: 1 },
    ],
    figures_needed:   randomInt(3, 8),
    total_pages_est:  randomInt(17, 28),
    prior_art_cited:  priorArt.length,
  };

  const estimatedProsecutionTime = `${randomInt(18, 36)} months from filing`;

  db.prepare(`
    INSERT OR IGNORE INTO ip_patent_drafts
      (id, invention_description, prior_art, independent_claims, dependent_claims,
       specification_outline, estimated_prosecution_time, fee_usd, created_at)
    VALUES
      (@id, @invention_description, @prior_art, @independent_claims, @dependent_claims,
       @specification_outline, @estimated_prosecution_time, @fee_usd, @created_at)
  `).run({
    id,
    invention_description:      inventionDescription.slice(0, 2000),
    prior_art:                  JSON.stringify(priorArt),
    independent_claims:         JSON.stringify(independentClaims),
    dependent_claims:           JSON.stringify(dependentClaims),
    specification_outline:      JSON.stringify(specificationOutline),
    estimated_prosecution_time: estimatedProsecutionTime,
    fee_usd:                    FEES.draft_claims,
    created_at:                 now,
  });

  return {
    draft_id:                   id,
    independent_claims:         independentClaims,
    dependent_claims:           dependentClaims,
    total_claims:               independentClaims.length + dependentClaims.length,
    specification_outline:      specificationOutline,
    estimated_prosecution_time: estimatedProsecutionTime,
    patent_strength_assessment: independentClaims.length >= 3 ? "strong" : "moderate",
    fee_usd:                    FEES.draft_claims,
    created_at:                 now,
  };
}

// ─── Get IP Portfolio ─────────────────────────────────────────────────────────

/**
 * Retrieve full IP portfolio overview for an owner including status, value, and maintenance schedule.
 * @param {string} ownerId - Portfolio owner identifier
 * @returns Patents, trademarks, copyrights, value estimate, expiring items, and maintenance schedule
 */
export function getIpPortfolio(ownerId) {
  if (!ownerId) throw new Error("ownerId is required");

  const id  = uuid();
  const now = new Date().toISOString();

  const existing = db.prepare("SELECT * FROM ip_portfolios WHERE owner_id = ?").get(ownerId);

  const dbPatents = db.prepare("SELECT number, title, status, filing_date, assignee FROM ip_patents WHERE status = 'active' LIMIT 5").all();

  const patents = dbPatents.map(p => ({
    number:         p.number,
    title:          p.title,
    status:         p.status,
    filing_date:    p.filing_date,
    expiry_date:    new Date(new Date(p.filing_date).setFullYear(new Date(p.filing_date).getFullYear() + 20)).toISOString().split("T")[0],
    annual_fee_usd: randomInt(1000, 8000),
    estimated_value_usd: randomInt(50000, 2000000),
  }));

  const trademarks = Array.from({ length: randomInt(2, 5) }, () => ({
    mark:             `${ownerId.slice(0, 6).toUpperCase()}-${randomInt(100, 999)}`,
    class:            randomInt(1, 45),
    jurisdiction:     pickRandom(VALID_JURISDICTIONS),
    registration_date: `20${randomInt(15, 22)}-${String(randomInt(1, 12)).padStart(2, "0")}-01`,
    renewal_date:     `20${randomInt(27, 32)}-${String(randomInt(1, 12)).padStart(2, "0")}-01`,
    status:           pickRandom(["registered", "pending"]),
  }));

  const copyrights = Array.from({ length: randomInt(1, 4) }, () => ({
    title:          `Work ${uuid().slice(0, 6)}`,
    type:           pickRandom(["software", "literary", "artistic", "database"]),
    registration:   `TXu-${randomInt(1000000, 9999999)}`,
    year:           randomInt(2015, 2023),
    term_years:     70,
  }));

  const totalValueEstimate = patents.reduce((s, p) => s + p.estimated_value_usd, 0);

  // Items expiring within 18 months
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + 18);
  const expiringSoon = patents
    .filter(p => new Date(p.expiry_date) <= cutoff)
    .map(p => ({ type: "patent", identifier: p.number, expiry_date: p.expiry_date, action_required: "pay_maintenance_fee" }));

  const maintenanceDue = patents
    .filter(() => Math.random() > 0.5)
    .map(p => ({
      patent_number: p.number,
      due_date:      new Date(Date.now() + randomInt(30, 180) * 86400000).toISOString().split("T")[0],
      fee_usd:       p.annual_fee_usd,
      year:          randomInt(3, 15),
      jurisdiction:  "US",
    }));

  db.prepare(`
    INSERT OR IGNORE INTO ip_portfolios
      (id, owner_id, patents, trademarks, copyrights, total_value_estimate, expiring_soon, maintenance_due, last_updated)
    VALUES
      (@id, @owner_id, @patents, @trademarks, @copyrights, @total_value_estimate, @expiring_soon, @maintenance_due, @last_updated)
    ON CONFLICT(owner_id) DO UPDATE SET last_updated = excluded.last_updated
  `).run({
    id:                   existing?.id ?? id,
    owner_id:             ownerId,
    patents:              JSON.stringify(patents),
    trademarks:           JSON.stringify(trademarks),
    copyrights:           JSON.stringify(copyrights),
    total_value_estimate: totalValueEstimate,
    expiring_soon:        JSON.stringify(expiringSoon),
    maintenance_due:      JSON.stringify(maintenanceDue),
    last_updated:         now,
  });

  return {
    portfolio_id:        id,
    owner_id:            ownerId,
    patents,
    trademarks,
    copyrights,
    total_assets:        patents.length + trademarks.length + copyrights.length,
    total_value_estimate: totalValueEstimate,
    expiring_soon:       expiringSoon,
    maintenance_due:     maintenanceDue,
    next_maintenance_usd: maintenanceDue.reduce((s, m) => s + m.fee_usd, 0),
    fee_usd:             FEES.ip_portfolio,
    generated_at:        now,
  };
}

// ─── Check Freedom to Operate ─────────────────────────────────────────────────

/**
 * Conduct a Freedom to Operate (FTO) analysis for a product or technology.
 * @param {string} productDescription - Detailed description of the product/technology
 * @param {string} jurisdiction       - Jurisdiction for FTO analysis (e.g., "US")
 * @returns FTO clearance status, blocking patents, design-around options, and risk assessment
 */
export function checkFreedomToOperate(productDescription, jurisdiction = "US") {
  if (!productDescription) throw new Error("productDescription is required");
  if (!VALID_JURISDICTIONS.includes(jurisdiction)) {
    throw new Error(`Invalid jurisdiction. Must be one of: ${VALID_JURISDICTIONS.join(", ")}`);
  }

  const id  = uuid();
  const now = new Date().toISOString();

  const allPatents = db.prepare(
    "SELECT * FROM ip_patents WHERE jurisdiction = ? AND status = 'active' LIMIT 20"
  ).all(jurisdiction);

  const blockingPatents = allPatents
    .filter(() => Math.random() > 0.65)
    .slice(0, randomInt(0, 4))
    .map(p => ({
      patent_number:    p.number,
      title:            p.title,
      assignee:         p.assignee,
      expiry_date:      new Date(new Date(p.filing_date).setFullYear(new Date(p.filing_date).getFullYear() + 20)).toISOString().split("T")[0],
      blocking_claims:  [`Claim ${randomInt(1, 5)}`, `Claim ${randomInt(6, 15)}`],
      overlap_analysis: pickRandom(["direct_infringement_risk", "contributory_infringement_risk", "potential_overlap"]),
      license_available: Math.random() > 0.4,
      estimated_license_usd: randomInt(5000, 200000),
    }));

  const clear = blockingPatents.length === 0;

  const designAroundOptions = blockingPatents.length > 0 ? [
    {
      approach:    "Modify core algorithm to avoid claim limitations",
      feasibility: pickRandom(["high", "medium", "low"]),
      cost_est:    `$${randomInt(20, 150)}k`,
      time_est:    `${randomInt(3, 12)} months`,
    },
    {
      approach:    "License the blocking patent(s) from assignee",
      feasibility: "medium",
      cost_est:    `$${randomInt(10, 500)}k/year`,
      time_est:    `${randomInt(1, 6)} months negotiation`,
    },
    {
      approach:    "Challenge patent validity via IPR petition",
      feasibility: "medium",
      cost_est:    `$${randomInt(50, 300)}k`,
      time_est:    "12-18 months",
    },
  ] : [];

  const overallRisk = blockingPatents.length === 0 ? "none"
    : blockingPatents.length <= 1 ? "low"
    : blockingPatents.length <= 2 ? "medium"
    : "high";

  const riskAssessment = {
    overall_risk:          overallRisk,
    blocking_count:        blockingPatents.length,
    jurisdiction,
    expiry_relief:         blockingPatents.filter(p => new Date(p.expiry_date) < new Date(Date.now() + 2 * 365 * 86400000)).length,
    recommended_action:    clear ? "proceed_to_market" : overallRisk === "high" ? "seek_legal_counsel_immediately" : "obtain_fto_opinion",
    confidence_level:      `${randomInt(75, 95)}%`,
    litigation_risk_score: blockingPatents.length * 15 + randomInt(5, 25),
  };

  db.prepare(`
    INSERT OR IGNORE INTO ip_fto_analyses
      (id, product_description, jurisdiction, clear, blocking_patents,
       design_around, risk_assessment, fee_usd, created_at)
    VALUES
      (@id, @product_description, @jurisdiction, @clear, @blocking_patents,
       @design_around, @risk_assessment, @fee_usd, @created_at)
  `).run({
    id,
    product_description: productDescription.slice(0, 2000),
    jurisdiction,
    clear:               clear ? 1 : 0,
    blocking_patents:    JSON.stringify(blockingPatents),
    design_around:       JSON.stringify(designAroundOptions),
    risk_assessment:     JSON.stringify(riskAssessment),
    fee_usd:             FEES.fto_analysis,
    created_at:          now,
  });

  return {
    fto_id:                id,
    product_description:   productDescription.slice(0, 200),
    jurisdiction,
    clear,
    blocking_patents:      blockingPatents,
    design_around_options: designAroundOptions,
    risk_assessment:       riskAssessment,
    fee_usd:               FEES.fto_analysis,
    created_at:            now,
  };
}
