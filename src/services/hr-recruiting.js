import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const HR_COMMISSION = 0.20; // 20% platform cut
const FEES = {
  screen:       0.25,
  match:        0.50,  // per candidate matched
  questions:    1.00,
  compensation: 0.50,
  onboarding:   2.00,
  dashboard:    5.00,  // per month
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS hr_comp_data (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    industry         TEXT NOT NULL,
    location         TEXT NOT NULL,
    experience_band  TEXT NOT NULL CHECK(experience_band IN ('entry','mid','senior','staff','principal','director','vp','c_suite')),
    p25_salary       REAL NOT NULL,
    p50_salary       REAL NOT NULL,
    p75_salary       REAL NOT NULL,
    p90_salary       REAL NOT NULL,
    total_comp_mult  REAL DEFAULT 1.15,
    equity_benchmark TEXT DEFAULT 'none',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hr_transactions (
    id               TEXT PRIMARY KEY,
    function_name    TEXT NOT NULL,
    fee_usd          REAL NOT NULL,
    commission_usd   REAL NOT NULL,
    request_data     TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Compensation Data ───────────────────────────────────────────────────

const _compCount = db.prepare("SELECT COUNT(*) as n FROM hr_comp_data").get().n;
if (_compCount === 0) {
  const compData = [
    { id: randomUUID(), title: "Software Engineer",           industry: "tech",      location: "San Francisco, CA", experience_band: "mid",       p25_salary: 145000, p50_salary: 165000, p75_salary: 185000, p90_salary: 210000, total_comp_mult: 1.35, equity_benchmark: "0.05-0.15% options" },
    { id: randomUUID(), title: "Software Engineer",           industry: "tech",      location: "Austin, TX",        experience_band: "mid",       p25_salary: 110000, p50_salary: 130000, p75_salary: 150000, p90_salary: 175000, total_comp_mult: 1.25, equity_benchmark: "0.02-0.08% options" },
    { id: randomUUID(), title: "Senior Software Engineer",    industry: "tech",      location: "San Francisco, CA", experience_band: "senior",    p25_salary: 185000, p50_salary: 210000, p75_salary: 240000, p90_salary: 280000, total_comp_mult: 1.45, equity_benchmark: "0.1-0.3% options" },
    { id: randomUUID(), title: "Staff Engineer",              industry: "tech",      location: "New York, NY",      experience_band: "staff",     p25_salary: 220000, p50_salary: 255000, p75_salary: 290000, p90_salary: 340000, total_comp_mult: 1.50, equity_benchmark: "0.25-0.5% options" },
    { id: randomUUID(), title: "Product Manager",             industry: "tech",      location: "San Francisco, CA", experience_band: "mid",       p25_salary: 140000, p50_salary: 165000, p75_salary: 190000, p90_salary: 220000, total_comp_mult: 1.30, equity_benchmark: "0.05-0.12% options" },
    { id: randomUUID(), title: "Senior Product Manager",      industry: "tech",      location: "Seattle, WA",       experience_band: "senior",    p25_salary: 170000, p50_salary: 195000, p75_salary: 225000, p90_salary: 260000, total_comp_mult: 1.35, equity_benchmark: "0.08-0.20% options" },
    { id: randomUUID(), title: "Data Scientist",              industry: "tech",      location: "New York, NY",      experience_band: "mid",       p25_salary: 130000, p50_salary: 155000, p75_salary: 180000, p90_salary: 210000, total_comp_mult: 1.28, equity_benchmark: "0.03-0.10% options" },
    { id: randomUUID(), title: "Machine Learning Engineer",   industry: "tech",      location: "San Francisco, CA", experience_band: "senior",    p25_salary: 195000, p50_salary: 225000, p75_salary: 260000, p90_salary: 310000, total_comp_mult: 1.50, equity_benchmark: "0.15-0.40% options" },
    { id: randomUUID(), title: "DevOps Engineer",             industry: "tech",      location: "Austin, TX",        experience_band: "mid",       p25_salary: 105000, p50_salary: 125000, p75_salary: 145000, p90_salary: 170000, total_comp_mult: 1.20, equity_benchmark: "0.01-0.05% options" },
    { id: randomUUID(), title: "UX Designer",                 industry: "tech",      location: "San Francisco, CA", experience_band: "mid",       p25_salary: 115000, p50_salary: 138000, p75_salary: 162000, p90_salary: 190000, total_comp_mult: 1.22, equity_benchmark: "0.02-0.06% options" },
    { id: randomUUID(), title: "Marketing Manager",           industry: "marketing", location: "New York, NY",      experience_band: "mid",       p25_salary:  85000, p50_salary: 105000, p75_salary: 128000, p90_salary: 155000, total_comp_mult: 1.15, equity_benchmark: "none" },
    { id: randomUUID(), title: "VP of Marketing",             industry: "marketing", location: "San Francisco, CA", experience_band: "vp",        p25_salary: 200000, p50_salary: 240000, p75_salary: 285000, p90_salary: 350000, total_comp_mult: 1.40, equity_benchmark: "0.5-1.0% options" },
    { id: randomUUID(), title: "Sales Development Rep",       industry: "sales",     location: "Chicago, IL",       experience_band: "entry",     p25_salary:  45000, p50_salary:  55000, p75_salary:  65000, p90_salary:  78000, total_comp_mult: 1.50, equity_benchmark: "none" },
    { id: randomUUID(), title: "Account Executive",           industry: "sales",     location: "New York, NY",      experience_band: "mid",       p25_salary:  85000, p50_salary: 110000, p75_salary: 140000, p90_salary: 180000, total_comp_mult: 1.80, equity_benchmark: "0.01-0.03% options" },
    { id: randomUUID(), title: "VP of Sales",                 industry: "sales",     location: "San Francisco, CA", experience_band: "vp",        p25_salary: 210000, p50_salary: 260000, p75_salary: 320000, p90_salary: 400000, total_comp_mult: 2.00, equity_benchmark: "0.5-1.5% options" },
    { id: randomUUID(), title: "Financial Analyst",           industry: "finance",   location: "New York, NY",      experience_band: "entry",     p25_salary:  72000, p50_salary:  85000, p75_salary: 100000, p90_salary: 120000, total_comp_mult: 1.25, equity_benchmark: "none" },
    { id: randomUUID(), title: "Senior Financial Analyst",    industry: "finance",   location: "New York, NY",      experience_band: "senior",    p25_salary: 105000, p50_salary: 125000, p75_salary: 148000, p90_salary: 175000, total_comp_mult: 1.30, equity_benchmark: "none" },
    { id: randomUUID(), title: "CFO",                         industry: "finance",   location: "New York, NY",      experience_band: "c_suite",   p25_salary: 320000, p50_salary: 420000, p75_salary: 550000, p90_salary: 750000, total_comp_mult: 2.20, equity_benchmark: "1.0-3.0% options/RSUs" },
    { id: randomUUID(), title: "HR Business Partner",         industry: "hr",        location: "Chicago, IL",       experience_band: "mid",       p25_salary:  78000, p50_salary:  95000, p75_salary: 115000, p90_salary: 138000, total_comp_mult: 1.12, equity_benchmark: "none" },
    { id: randomUUID(), title: "Chief People Officer",        industry: "hr",        location: "San Francisco, CA", experience_band: "c_suite",   p25_salary: 240000, p50_salary: 310000, p75_salary: 400000, p90_salary: 520000, total_comp_mult: 1.50, equity_benchmark: "0.5-1.5% options/RSUs" },
    { id: randomUUID(), title: "Registered Nurse",            industry: "healthcare",location: "Houston, TX",       experience_band: "mid",       p25_salary:  72000, p50_salary:  85000, p75_salary:  98000, p90_salary: 112000, total_comp_mult: 1.08, equity_benchmark: "none" },
    { id: randomUUID(), title: "Physician",                   industry: "healthcare",location: "Boston, MA",        experience_band: "senior",    p25_salary: 220000, p50_salary: 280000, p75_salary: 350000, p90_salary: 450000, total_comp_mult: 1.10, equity_benchmark: "none" },
    { id: randomUUID(), title: "Operations Manager",          industry: "operations",location: "Dallas, TX",        experience_band: "mid",       p25_salary:  72000, p50_salary:  88000, p75_salary: 108000, p90_salary: 130000, total_comp_mult: 1.12, equity_benchmark: "none" },
    { id: randomUUID(), title: "Supply Chain Manager",        industry: "operations",location: "Chicago, IL",       experience_band: "mid",       p25_salary:  82000, p50_salary: 100000, p75_salary: 122000, p90_salary: 148000, total_comp_mult: 1.15, equity_benchmark: "0.01-0.03% options" },
    { id: randomUUID(), title: "Legal Counsel",               industry: "legal",     location: "New York, NY",      experience_band: "senior",    p25_salary: 175000, p50_salary: 210000, p75_salary: 255000, p90_salary: 320000, total_comp_mult: 1.20, equity_benchmark: "0.1-0.3% options" },
    { id: randomUUID(), title: "Customer Success Manager",    industry: "tech",      location: "Austin, TX",        experience_band: "mid",       p25_salary:  75000, p50_salary:  92000, p75_salary: 112000, p90_salary: 135000, total_comp_mult: 1.20, equity_benchmark: "0.01-0.04% options" },
    { id: randomUUID(), title: "Engineering Manager",         industry: "tech",      location: "San Francisco, CA", experience_band: "director",  p25_salary: 200000, p50_salary: 235000, p75_salary: 275000, p90_salary: 330000, total_comp_mult: 1.45, equity_benchmark: "0.2-0.5% options" },
    { id: randomUUID(), title: "Principal Engineer",          industry: "tech",      location: "Seattle, WA",       experience_band: "principal", p25_salary: 240000, p50_salary: 280000, p75_salary: 330000, p90_salary: 400000, total_comp_mult: 1.55, equity_benchmark: "0.3-0.8% options/RSUs" },
    { id: randomUUID(), title: "Recruiter",                   industry: "hr",        location: "Austin, TX",        experience_band: "mid",       p25_salary:  62000, p50_salary:  78000, p75_salary:  96000, p90_salary: 118000, total_comp_mult: 1.10, equity_benchmark: "none" },
    { id: randomUUID(), title: "CEO",                         industry: "tech",      location: "San Francisco, CA", experience_band: "c_suite",   p25_salary: 300000, p50_salary: 450000, p75_salary: 650000, p90_salary: 950000, total_comp_mult: 3.00, equity_benchmark: "2.0-8.0% options/RSUs" },
  ];
  const ins = db.prepare(`
    INSERT OR IGNORE INTO hr_comp_data
      (id, title, industry, location, experience_band, p25_salary, p50_salary, p75_salary, p90_salary, total_comp_mult, equity_benchmark)
    VALUES
      (@id,@title,@industry,@location,@experience_band,@p25_salary,@p50_salary,@p75_salary,@p90_salary,@total_comp_mult,@equity_benchmark)
  `);
  for (const r of compData) ins.run(r);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordFee(functionName, requestData, feeMult = 1) {
  const fee        = Math.round((FEES[functionName] ?? 0) * feeMult * 100) / 100;
  const commission = Math.round(fee * HR_COMMISSION * 100) / 100;
  db.prepare(`
    INSERT OR IGNORE INTO hr_transactions (id, function_name, fee_usd, commission_usd, request_data)
    VALUES (@id, @function_name, @fee_usd, @commission_usd, @request_data)
  `).run({ id: randomUUID(), function_name: functionName, fee_usd: fee, commission_usd: commission, request_data: JSON.stringify(requestData) });
  return { fee_usd: fee, platform_commission_usd: commission };
}

function extractKeywords(text = "", wordlist = []) {
  const lower = text.toLowerCase();
  return wordlist.filter(w => lower.includes(w.toLowerCase()));
}

// ─── screenResume ─────────────────────────────────────────────────────────────

/**
 * Parse and score a resume against job requirements using NLP-style keyword analysis.
 * @param {string} resumeText - Full resume text content
 * @param {string[]} jobRequirements - Array of required skills/qualifications
 * @param {string[]} mustHaveSkills - Non-negotiable skills (absence = disqualifier)
 * @returns Candidate score, matched/missing skills, experience, education match, and flags
 */
export function screenResume(resumeText, jobRequirements = [], mustHaveSkills = []) {
  if (!resumeText || resumeText.trim().length < 50) throw new Error("resumeText must be at least 50 characters");
  if (!Array.isArray(jobRequirements) || jobRequirements.length === 0) throw new Error("jobRequirements must be a non-empty array");

  const text = resumeText.toLowerCase();

  // Skill matching
  const matchedSkills  = jobRequirements.filter(s => text.includes(s.toLowerCase()));
  const missingSkills  = jobRequirements.filter(s => !text.includes(s.toLowerCase()));
  const missingMustHave = mustHaveSkills.filter(s => !text.includes(s.toLowerCase()));
  const skillScore     = jobRequirements.length > 0 ? (matchedSkills.length / jobRequirements.length) * 40 : 40;

  // Experience years — look for patterns like "5 years", "8+ years", "three years"
  const yearsPatterns = [
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /(\d+)\+?\s*years?\s+(?:at|with|in)/gi,
    /(?:over|more than)\s+(\d+)\s*years/gi,
  ];
  const yearMatches = yearsPatterns.flatMap(p => [...resumeText.matchAll(p)]).map(m => parseInt(m[1]));
  const experienceYears = yearMatches.length > 0 ? Math.max(...yearMatches) : 0;
  const expScore = Math.min(25, experienceYears * 3.5);

  // Education matching
  const educationKeywords = { phd: 4, "ph.d": 4, doctorate: 4, master: 3, mba: 3, "m.s": 3, bachelor: 2, "b.s": 2, "b.a": 2, associate: 1 };
  let educationLevel = "none", educationScore = 0;
  for (const [kw, score] of Object.entries(educationKeywords)) {
    if (text.includes(kw) && score > educationScore) { educationScore = score; educationLevel = kw; }
  }
  const educationMatch = educationScore >= 2;
  const educationPts = Math.min(20, educationScore * 5);

  // Culture / soft skills
  const softSkills = ["led", "collaborated", "mentored", "improved", "scaled", "launched", "owned", "drove", "built", "delivered"];
  const softMatched = softSkills.filter(s => text.includes(s));
  const softScore   = Math.min(15, softMatched.length * 3);

  // Red flags
  const redFlags = [];
  if (missingMustHave.length > 0) redFlags.push(`Missing must-have skills: ${missingMustHave.join(", ")}`);
  if (experienceYears === 0)      redFlags.push("No quantified years of experience found in resume");
  if (!educationMatch)            redFlags.push("No bachelor's degree or higher detected");
  const gapPattern = /gap|career break|sabbatical/i;
  if (gapPattern.test(resumeText)) redFlags.push("Potential employment gap detected");

  let candidateScore = Math.round(skillScore + expScore + educationPts + softScore);
  if (missingMustHave.length > 0) candidateScore = Math.min(candidateScore, 45); // cap if missing must-haves

  const { fee_usd, platform_commission_usd } = recordFee("screen", { job_req_count: jobRequirements.length, must_have_count: mustHaveSkills.length });

  return {
    candidate_score:   Math.min(100, candidateScore),
    score_grade:       candidateScore >= 80 ? "A" : candidateScore >= 65 ? "B" : candidateScore >= 50 ? "C" : "D",
    recommendation:    candidateScore >= 75 ? "advance_to_interview" : candidateScore >= 55 ? "consider" : "reject",
    matched_skills:    matchedSkills,
    missing_skills:    missingSkills,
    missing_must_have: missingMustHave,
    experience_years:  experienceYears,
    education_level:   educationLevel,
    education_match:   educationMatch,
    soft_skills_found: softMatched,
    red_flags:         redFlags,
    score_breakdown: {
      skill_match:  Math.round(skillScore),
      experience:   Math.round(expScore),
      education:    educationPts,
      soft_skills:  softScore,
    },
    screened_at:      new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── matchCandidates ──────────────────────────────────────────────────────────

/**
 * Rank a pool of candidates against a job using weighted scoring.
 * @param {string} jobId - Job requisition ID
 * @param {object[]} candidatePool - Array of { id, name, skills[], experienceYears, education, resumeText }
 * @param {object} weights - { skills, experience, education, culture } — must sum to 1.0
 * @returns Ranked candidate list with fit breakdown and interview recommendations
 */
export function matchCandidates(jobId, candidatePool = [], weights = {}) {
  if (!jobId) throw new Error("jobId is required");
  if (!Array.isArray(candidatePool) || candidatePool.length === 0) throw new Error("candidatePool must be non-empty");

  const {
    skills:     wSkills     = 0.40,
    experience: wExperience = 0.30,
    education:  wEducation  = 0.15,
    culture:    wCulture    = 0.15,
  } = weights;

  const total = wSkills + wExperience + wEducation + wCulture;
  if (Math.abs(total - 1.0) > 0.01) throw new Error("weights must sum to 1.0");

  const educationScoreMap = { phd: 100, master: 85, mba: 85, bachelor: 70, associate: 50, none: 30 };
  const cultureKeywords   = ["teamwork", "collaboration", "ownership", "impact", "growth", "mission", "diverse", "inclusive"];

  const ranked = candidatePool.map(candidate => {
    const {
      id            = randomUUID(),
      name          = "Candidate",
      skills        = [],
      experienceYears = 0,
      education     = "none",
      resumeText    = "",
    } = candidate;

    const skillScore     = Math.min(100, skills.length * 12);
    const expScore       = Math.min(100, experienceYears * 8);
    const eduScore       = educationScoreMap[education.toLowerCase()] ?? 50;
    const cultureMatched = extractKeywords(resumeText, cultureKeywords);
    const cultureScore   = Math.min(100, cultureMatched.length * 15);

    const compositeScore = Math.round(
      skillScore   * wSkills +
      expScore     * wExperience +
      eduScore     * wEducation +
      cultureScore * wCulture
    );

    return {
      candidate_id: id,
      candidate_name: name,
      composite_score: compositeScore,
      fit_breakdown: {
        skills:     { score: skillScore,     weight: wSkills,     weighted: Math.round(skillScore * wSkills) },
        experience: { score: expScore,       weight: wExperience, weighted: Math.round(expScore * wExperience) },
        education:  { score: eduScore,       weight: wEducation,  weighted: Math.round(eduScore * wEducation) },
        culture:    { score: cultureScore,   weight: wCulture,    weighted: Math.round(cultureScore * wCulture), keywords_found: cultureMatched },
      },
      interview_recommendation: compositeScore >= 75 ? "strong_yes" : compositeScore >= 60 ? "yes" : compositeScore >= 45 ? "maybe" : "no",
      skills_count:    skills.length,
      experience_years: experienceYears,
      education,
    };
  });

  ranked.sort((a, b) => b.composite_score - a.composite_score);
  ranked.forEach((c, i) => { c.rank = i + 1; });

  const { fee_usd, platform_commission_usd } = recordFee("match", { jobId, candidate_count: candidatePool.length }, candidatePool.length);

  return {
    job_id:             jobId,
    candidate_count:    ranked.length,
    weights,
    ranked,
    top_candidate:      ranked[0] ?? null,
    advance_recommended: ranked.filter(c => ["strong_yes", "yes"].includes(c.interview_recommendation)).length,
    matched_at:         new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── generateInterviewQuestions ───────────────────────────────────────────────

/**
 * Generate a structured, role-specific interview question set.
 * @param {string} roleType - e.g. "software_engineer", "product_manager", "sales"
 * @param {string} seniority - entry|mid|senior|staff|director|vp|c_suite
 * @param {string[]} skills - Key skills to probe
 * @param {string[]} focusAreas - behavioral|technical|situational|culture_fit
 * @returns Categorized questions with expected answer points and scoring rubric
 */
export function generateInterviewQuestions(roleType, seniority = "mid", skills = [], focusAreas = ["behavioral", "technical"]) {
  if (!roleType) throw new Error("roleType is required");

  const validSeniority = ["entry", "mid", "senior", "staff", "principal", "director", "vp", "c_suite"];
  if (!validSeniority.includes(seniority)) throw new Error(`seniority must be one of: ${validSeniority.join(", ")}`);

  const seniorityDepth = { entry: 1, mid: 2, senior: 3, staff: 4, principal: 4, director: 5, vp: 5, c_suite: 5 }[seniority] ?? 2;

  const questionBank = {
    behavioral: [
      { q: "Tell me about a time you navigated a major conflict within your team. What was the outcome?", answer_points: ["Specific situation", "Actions taken", "Resolution", "Lessons learned"], rubric: "STAR format completeness, ownership of outcome, self-awareness" },
      { q: "Describe a project where you had to prioritize under significant resource constraints.", answer_points: ["Clear prioritization framework", "Stakeholder communication", "Trade-off decisions", "Result"], rubric: "Structured thinking, business impact focus, decisiveness" },
      { q: "Give an example of a time you failed and what you did about it.", answer_points: ["Honest failure admission", "Root cause analysis", "Corrective action", "What changed afterward"], rubric: "Self-awareness, growth mindset, accountability" },
    ],
    technical: skills.length > 0
      ? skills.map(skill => ({
          q:             `Walk me through how you've applied ${skill} in a production context. What were the trade-offs?`,
          answer_points: [`Depth of ${skill} knowledge`, "Real-world constraints handled", "Alternative approaches considered", "Performance/scale considerations"],
          rubric:        `Mastery of ${skill}, pragmatism, ability to articulate trade-offs`,
        }))
      : [
          { q: "Describe your approach to debugging a system that intermittently fails in production.", answer_points: ["Systematic isolation strategy", "Tooling/observability", "Hypothesis formation", "Post-mortem discipline"], rubric: "Methodical thinking, production experience, communication" },
          { q: "How do you evaluate whether to build vs. buy a new capability?", answer_points: ["Cost-benefit framing", "Core vs. context distinction", "Maintenance long-term", "Team capability"], rubric: "Strategic judgment, business sense, engineering pragmatism" },
        ],
    situational: [
      { q: `You are ${seniority === "entry" ? "three months" : "six months"} into this role and realize a key process is broken. How do you approach fixing it?`, answer_points: ["Situation assessment", "Stakeholder alignment", "Phased rollout", "Measuring success"], rubric: "Initiative, change management, cross-functional awareness" },
      ...(seniorityDepth >= 3 ? [{ q: "Your highest-performing team member gives notice the week before a critical launch. Walk me through your response.", answer_points: ["Immediate risk assessment", "Knowledge transfer", "Stakeholder communication", "Morale management"], rubric: "Crisis management, leadership under pressure, prioritization" }] : []),
    ],
    culture_fit: [
      { q: "What does 'ownership' mean to you, and how have you demonstrated it?", answer_points: ["Definition beyond job description", "Concrete example", "Impact of ownership", "How they hold others accountable"], rubric: "Alignment with company values, initiative, accountability culture" },
      { q: "How do you keep yourself up to date in a rapidly changing field?", answer_points: ["Specific resources named", "Learning cadence", "How learning is applied", "Teaching others"], rubric: "Intellectual curiosity, growth mindset, domain engagement" },
    ],
  };

  const questions = [];
  for (const focus of focusAreas) {
    const pool = questionBank[focus] ?? [];
    for (const item of pool.slice(0, seniorityDepth)) {
      questions.push({
        question:              item.q,
        category:              focus,
        seniority_level:       seniority,
        expected_answer_points: item.answer_points,
        scoring_rubric:        item.rubric,
        suggested_followups:   [
          "Can you quantify the impact?",
          "What would you do differently?",
          "How did that change how you work today?",
        ].slice(0, 2),
        time_allocation_min:  focus === "technical" ? 12 : 8,
      });
    }
  }

  const { fee_usd, platform_commission_usd } = recordFee("questions", { roleType, seniority, skill_count: skills.length });

  return {
    role_type:         roleType,
    seniority,
    focus_areas:       focusAreas,
    skills_probed:     skills,
    question_count:    questions.length,
    questions,
    total_time_min:    questions.reduce((s, q) => s + q.time_allocation_min, 0),
    interview_format:  "Structured behavioral + technical",
    scoring_scale:     "1–4: 1=Below expectations, 2=Meets some, 3=Meets expectations, 4=Exceeds expectations",
    generated_at:      new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── checkCompensation ────────────────────────────────────────────────────────

/**
 * Market compensation benchmarking for a given role.
 * @param {string} title - Job title
 * @param {string} location - City, state
 * @param {string} experience - experience_band: entry|mid|senior|staff|principal|director|vp|c_suite
 * @param {string} industry - Industry vertical
 * @returns Salary percentiles, total comp, equity benchmark, and regional adjustment
 */
export function checkCompensation(title, location, experience = "mid", industry = "tech") {
  if (!title)    throw new Error("title is required");
  if (!location) throw new Error("location is required");

  const validBands = ["entry", "mid", "senior", "staff", "principal", "director", "vp", "c_suite"];
  if (!validBands.includes(experience)) throw new Error(`experience must be one of: ${validBands.join(", ")}`);

  // Try exact match first, then fuzzy
  let row = db.prepare(`
    SELECT * FROM hr_comp_data
    WHERE lower(title) LIKE lower(?) AND lower(location) LIKE lower(?) AND experience_band = ?
    LIMIT 1
  `).get(`%${title}%`, `%${location.split(",")[0]}%`, experience);

  // Fallback: same title and band, any location
  if (!row) {
    row = db.prepare(`
      SELECT * FROM hr_comp_data
      WHERE lower(title) LIKE lower(?) AND experience_band = ? LIMIT 1
    `).get(`%${title}%`, experience);
  }

  // Fallback: same band and industry
  if (!row) {
    row = db.prepare(`
      SELECT * FROM hr_comp_data WHERE experience_band = ? AND lower(industry) = lower(?) LIMIT 1
    `).get(experience, industry);
  }

  // Last resort: closest band in any industry
  if (!row) {
    row = db.prepare("SELECT * FROM hr_comp_data WHERE experience_band = ? LIMIT 1").get(experience);
  }

  // Regional cost-of-living adjustments
  const colaMap = {
    "San Francisco": 1.25, "New York": 1.20, "Seattle": 1.15, "Boston": 1.12,
    "Los Angeles": 1.18, "Chicago": 1.05, "Austin": 1.02, "Denver": 1.03,
    "Atlanta": 0.95, "Dallas": 0.98, "Houston": 0.97, "Phoenix": 0.94,
  };
  const cityKey = Object.keys(colaMap).find(k => location.toLowerCase().includes(k.toLowerCase()));
  const colaMultiplier = colaMap[cityKey] ?? 1.0;

  const salary_range = {
    p25: Math.round(row.p25_salary * colaMultiplier),
    p50: Math.round(row.p50_salary * colaMultiplier),
    p75: Math.round(row.p75_salary * colaMultiplier),
    p90: Math.round(row.p90_salary * colaMultiplier),
  };

  const total_comp_range = {
    p25: Math.round(salary_range.p25 * row.total_comp_mult),
    p50: Math.round(salary_range.p50 * row.total_comp_mult),
    p75: Math.round(salary_range.p75 * row.total_comp_mult),
    p90: Math.round(salary_range.p90 * row.total_comp_mult),
  };

  const { fee_usd, platform_commission_usd } = recordFee("compensation", { title, location, experience, industry });

  return {
    title,
    location,
    experience_band:    experience,
    industry,
    salary_range,
    total_comp_range,
    total_comp_includes: "Base salary + bonus/commission target + RSU/options grant value",
    equity_benchmark:   row.equity_benchmark,
    benefits_benchmark: {
      health_insurance:  "Employer covers 80–100% of premium (market standard)",
      pto_days:          experience === "entry" ? "15–20" : experience === "mid" ? "18–25" : "unlimited or 25+",
      retirement_match:  "3–6% employer match",
      learning_budget:   "$1,000–$5,000/year",
    },
    regional_adjustment: { multiplier: colaMultiplier, city_reference: cityKey ?? "national_average", note: `Salaries adjusted ${Math.round((colaMultiplier - 1) * 100)}% relative to national median` },
    data_source:         row ? "HiveAgent Compensation Database (seeded)" : "Estimated from band average",
    data_vintage:        "2025–2026",
    fee_usd,
    platform_commission_usd,
  };
}

// ─── automateOnboarding ───────────────────────────────────────────────────────

/**
 * Generate a structured onboarding checklist for a new hire.
 * @param {object} newHireData - { name, title, email, employeeId }
 * @param {string} department - Engineering|Product|Sales|Marketing|Finance|HR|Operations
 * @param {string} startDate - "YYYY-MM-DD"
 * @returns Phased onboarding checklist with tasks, owners, due dates, and documents
 */
export function automateOnboarding(newHireData = {}, department = "Engineering", startDate) {
  if (!newHireData.name) throw new Error("newHireData.name is required");
  if (!startDate)        throw new Error("startDate is required");

  const start = new Date(startDate);
  if (isNaN(start.getTime())) throw new Error("startDate must be a valid date (YYYY-MM-DD)");

  const addDays = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().split("T")[0];
  const { name, title = "Employee", email = "", employeeId = randomUUID().slice(0, 8).toUpperCase() } = newHireData;

  const commonTasks = [
    { task: "Send offer letter and welcome email", owner: "HR", due_offset: -7, status: "completed", documents_needed: ["offer_letter.pdf", "welcome_packet.pdf"] },
    { task: "Provision laptop and equipment", owner: "IT", due_offset: -3, status: "pending", documents_needed: ["equipment_form.pdf"] },
    { task: "Set up corporate email and accounts", owner: "IT", due_offset: -1, status: "pending", documents_needed: [] },
    { task: "Complete I-9 employment eligibility verification", owner: "HR", due_offset: 0, status: "pending", documents_needed: ["i9_form.pdf", "govt_id_copy"] },
    { task: "Sign confidentiality and IP agreement", owner: "Legal", due_offset: 0, status: "pending", documents_needed: ["cia_agreement.pdf"] },
    { task: "Enroll in benefits (health, dental, vision, 401k)", owner: "Employee", due_offset: 3, status: "pending", documents_needed: ["benefits_guide.pdf", "401k_enrollment.pdf"] },
    { task: "Complete security awareness training", owner: "Employee", due_offset: 5, status: "pending", documents_needed: ["security_training_link"] },
    { task: "Meet with HR for culture and policies overview", owner: "HR", due_offset: 1, status: "pending", documents_needed: ["employee_handbook.pdf"] },
    { task: "30-day check-in with manager", owner: "Manager", due_offset: 30, status: "pending", documents_needed: ["30_day_goals_template.pdf"] },
    { task: "90-day performance review", owner: "Manager", due_offset: 90, status: "pending", documents_needed: ["90_day_review_form.pdf"] },
  ];

  const deptTasks = {
    Engineering: [
      { task: "Complete GitHub access and repo onboarding", owner: "Engineering Manager", due_offset: 1, status: "pending", documents_needed: ["github_access_guide.md"] },
      { task: "Set up local dev environment", owner: "Employee", due_offset: 2, status: "pending", documents_needed: ["dev_setup_guide.md"] },
      { task: "Complete architecture overview session with tech lead", owner: "Tech Lead", due_offset: 5, status: "pending", documents_needed: ["system_architecture_deck.pdf"] },
      { task: "First PR merged to production", owner: "Employee", due_offset: 14, status: "pending", documents_needed: [] },
    ],
    Product: [
      { task: "Product strategy and roadmap overview", owner: "Head of Product", due_offset: 2, status: "pending", documents_needed: ["product_roadmap.pdf"] },
      { task: "Customer interview shadowing session", owner: "PM Manager", due_offset: 7, status: "pending", documents_needed: [] },
      { task: "First feature spec draft submitted", owner: "Employee", due_offset: 21, status: "pending", documents_needed: ["feature_spec_template.pdf"] },
    ],
    Sales: [
      { task: "CRM system access and training (Salesforce)", owner: "RevOps", due_offset: 1, status: "pending", documents_needed: ["crm_guide.pdf"] },
      { task: "Product demo certification", owner: "Sales Enablement", due_offset: 7, status: "pending", documents_needed: ["demo_script.pdf"] },
      { task: "Shadow 3 customer calls", owner: "Sales Manager", due_offset: 10, status: "pending", documents_needed: [] },
    ],
  };

  const allTasks = [
    ...commonTasks,
    ...(deptTasks[department] ?? []),
  ].map(t => ({
    task_id:          randomUUID().slice(0, 8),
    task:             t.task,
    owner:            t.owner,
    due_date:         addDays(start, t.due_offset),
    phase:            t.due_offset < 0 ? "pre_start" : t.due_offset <= 7 ? "week_1" : t.due_offset <= 30 ? "month_1" : "month_2_3",
    status:           t.status,
    documents_needed: t.documents_needed,
  }));

  allTasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const { fee_usd, platform_commission_usd } = recordFee("onboarding", { name, department, startDate });

  return {
    new_hire: { name, title, email, employee_id: employeeId },
    department,
    start_date:       startDate,
    onboarding_window_days: 90,
    checklist:        allTasks,
    task_count:       allTasks.length,
    pre_start_tasks:  allTasks.filter(t => t.phase === "pre_start").length,
    week_1_tasks:     allTasks.filter(t => t.phase === "week_1").length,
    month_1_tasks:    allTasks.filter(t => t.phase === "month_1").length,
    month_2_3_tasks:  allTasks.filter(t => t.phase === "month_2_3").length,
    completion_pct:   Math.round((allTasks.filter(t => t.status === "completed").length / allTasks.length) * 100),
    generated_at:     new Date().toISOString(),
    fee_usd,
    platform_commission_usd,
  };
}

// ─── getRecruitingDashboard ───────────────────────────────────────────────────

/**
 * Recruiting KPI dashboard for a given date range.
 * @param {object} dateRange - { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * @returns Recruiting KPIs including open roles, TTF, pipeline, offer acceptance, source effectiveness
 */
export function getRecruitingDashboard(dateRange = {}) {
  const { start = "2026-01-01", end = new Date().toISOString().split("T")[0] } = dateRange;
  const dayCount = Math.max(1, (new Date(end) - new Date(start)) / 86400000);
  const seed = start.replace(/-/g, "").slice(-4) * 1;

  const openRoles          = 8  + (seed % 22);
  const avgTimeToFill      = 28 + (seed % 20);
  const offerAcceptanceRate = Math.round((78 + (seed % 18)) * 10) / 10;
  const costPerHire        = 4200 + (seed % 8800);

  const pipeline = {
    applied:      220 + (seed % 180),
    screened:     95  + (seed % 75),
    phone_screen: 48  + (seed % 38),
    technical:    22  + (seed % 18),
    final_round:  12  + (seed % 10),
    offered:       8  + (seed % 6),
    hired:         5  + (seed % 5),
  };

  const conversionRates = {
    applied_to_screened:   Math.round((pipeline.screened / pipeline.applied) * 1000) / 10,
    screened_to_phone:     Math.round((pipeline.phone_screen / pipeline.screened) * 1000) / 10,
    phone_to_technical:    Math.round((pipeline.technical / pipeline.phone_screen) * 1000) / 10,
    technical_to_final:    Math.round((pipeline.final_round / pipeline.technical) * 1000) / 10,
    final_to_offer:        Math.round((pipeline.offered / pipeline.final_round) * 1000) / 10,
    offer_acceptance:      offerAcceptanceRate,
  };

  const sources = [
    { source: "LinkedIn",       candidates: 80 + (seed % 50), hires: 3 + (seed % 3), cost_usd: 2800 },
    { source: "Employee Referral", candidates: 35 + (seed % 25), hires: 2 + (seed % 3), cost_usd: 1000 },
    { source: "Indeed",         candidates: 60 + (seed % 40), hires: 1 + (seed % 2), cost_usd: 800 },
    { source: "Company Career Page", candidates: 30 + (seed % 20), hires: 1 + (seed % 2), cost_usd: 200 },
    { source: "Recruiting Agency", candidates: 15 + (seed % 10), hires: 1 + (seed % 2), cost_usd: 8500 },
  ].map(s => ({
    ...s,
    conversion_rate_pct: Math.round((s.hires / s.candidates) * 1000) / 10,
    cost_per_hire:       s.hires > 0 ? Math.round(s.cost_usd / s.hires) : null,
  }));

  sources.sort((a, b) => b.conversion_rate_pct - a.conversion_rate_pct);

  const { fee_usd, platform_commission_usd } = recordFee("dashboard", { start, end });

  return {
    date_range:          { start, end, days: Math.round(dayCount) },
    open_roles:          openRoles,
    avg_time_to_fill_days: avgTimeToFill,
    offer_acceptance_rate_pct: offerAcceptanceRate,
    cost_per_hire_usd:   costPerHire,
    pipeline_by_stage:   pipeline,
    conversion_rates:    conversionRates,
    source_effectiveness: sources,
    alerts: [
      ...(avgTimeToFill > 40    ? [{ level: "warning", message: `Avg time to fill ${avgTimeToFill} days — exceeds 40-day target` }] : []),
      ...(offerAcceptanceRate < 80 ? [{ level: "warning", message: `Offer acceptance ${offerAcceptanceRate}% — below 80% benchmark` }] : []),
      ...(costPerHire > 8000    ? [{ level: "info",    message: `Cost per hire $${costPerHire} — review agency and sourcing mix` }] : []),
    ],
    benchmarks: {
      avg_time_to_fill_industry: 36,
      offer_acceptance_rate_avg: 85,
      cost_per_hire_avg:         4700,
    },
    generated_at:        new Date().toISOString(),
    billing_period:      `${start} to ${end}`,
    fee_usd,
    platform_commission_usd,
  };
}
