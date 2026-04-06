import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const CRM_PLATFORM_COMMISSION = 0.20; // 20% platform cut
const CRM_FEES = {
  enrichment:  0.25,
  score:       0.10,
  email:       0.15,
  meeting:     0.50,
  forecast:    2.00,
  report:      1.00,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS crm_leads (
    id                TEXT PRIMARY KEY,
    company_name      TEXT NOT NULL,
    contact_name      TEXT NOT NULL,
    email             TEXT NOT NULL,
    company_info      TEXT DEFAULT '{}',
    contact_info      TEXT DEFAULT '{}',
    news              TEXT DEFAULT '[]',
    funding_history   TEXT DEFAULT '[]',
    score             INTEGER,
    fit_breakdown     TEXT DEFAULT '{}',
    buying_signals    TEXT DEFAULT '[]',
    recommended_action TEXT DEFAULT 'nurture',
    status            TEXT DEFAULT 'new' CHECK(status IN ('new','enriched','scored','outreach_sent','meeting_scheduled','closed_won','closed_lost','disqualified')),
    enriched_at       TEXT,
    scored_at         TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_outreach (
    id                    TEXT PRIMARY KEY,
    lead_id               TEXT REFERENCES crm_leads(id),
    campaign              TEXT NOT NULL,
    tone                  TEXT NOT NULL,
    email_subject         TEXT NOT NULL,
    email_body            TEXT NOT NULL,
    follow_up_sequence    TEXT DEFAULT '[]',
    personalization_points TEXT DEFAULT '[]',
    sent_at               TEXT,
    opened_at             TEXT,
    replied_at            TEXT,
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_meetings (
    id                TEXT PRIMARY KEY,
    lead_id           TEXT REFERENCES crm_leads(id),
    contact_email     TEXT NOT NULL,
    confirmed_time    TEXT NOT NULL,
    duration_minutes  INTEGER NOT NULL,
    agenda            TEXT NOT NULL,
    calendar_link     TEXT NOT NULL,
    status            TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
    fee_usd           REAL NOT NULL,
    commission_usd    REAL NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_forecasts (
    id                        TEXT PRIMARY KEY,
    forecast_amount           REAL NOT NULL,
    confidence                REAL NOT NULL,
    deals_at_risk             TEXT DEFAULT '[]',
    recommended_actions       TEXT DEFAULT '[]',
    win_probability_by_deal   TEXT DEFAULT '{}',
    period_start              TEXT,
    period_end                TEXT,
    fee_usd                   REAL NOT NULL,
    commission_usd            REAL NOT NULL,
    created_at                TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_competitor_reports (
    id            TEXT PRIMARY KEY,
    competitors   TEXT NOT NULL,
    sources       TEXT NOT NULL,
    date_range    TEXT NOT NULL,
    mentions      TEXT DEFAULT '[]',
    fee_usd       REAL NOT NULL,
    commission_usd REAL NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _leadCount = db.prepare("SELECT COUNT(*) as n FROM crm_leads").get().n;
if (_leadCount === 0) {
  const seedLeads = [
    {
      id: randomUUID(),
      company_name: "Acme Corp",
      contact_name: "Jane Smith",
      email: "jane.smith@acmecorp.com",
      score: 82,
      recommended_action: "pursue",
      status: "scored",
    },
    {
      id: randomUUID(),
      company_name: "Globex Industries",
      contact_name: "Hank Scorpio",
      email: "h.scorpio@globex.io",
      score: 45,
      recommended_action: "nurture",
      status: "enriched",
    },
    {
      id: randomUUID(),
      company_name: "Initech Solutions",
      contact_name: "Bill Lumbergh",
      email: "blumbergh@initech.com",
      score: 21,
      recommended_action: "disqualify",
      status: "scored",
    },
  ];
  const insertLead = db.prepare(`
    INSERT OR IGNORE INTO crm_leads
      (id, company_name, contact_name, email, score, recommended_action, status)
    VALUES
      (@id, @company_name, @contact_name, @email, @score, @recommended_action, @status)
  `);
  for (const l of seedLeads) insertLead.run(l);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function commission(fee) {
  return Math.round(fee * CRM_PLATFORM_COMMISSION * 100) / 100;
}

const INDUSTRIES = ["SaaS", "FinTech", "HealthTech", "E-commerce", "Manufacturing", "Logistics", "EdTech", "CyberSecurity", "MarTech", "DevTools"];
const TECH_STACKS = [
  ["Salesforce", "HubSpot", "Slack", "AWS"],
  ["Notion", "Linear", "Vercel", "GCP"],
  ["SAP", "Oracle", "Microsoft Teams", "Azure"],
  ["Intercom", "Segment", "Snowflake", "Databricks"],
  ["Zendesk", "Jira", "GitHub", "Heroku"],
];
const TITLES = ["VP of Sales", "Director of Engineering", "CTO", "CEO", "Head of Growth", "Chief Revenue Officer", "COO", "VP Product", "Founder", "CFO"];
const NEWS_TEMPLATES = [
  (c) => `${c} announces Series B funding round of $24M led by Sequoia Capital`,
  (c) => `${c} expands into European markets with new Dublin office`,
  (c) => `${c} launches AI-powered platform, targets enterprise segment`,
  (c) => `${c} partners with Microsoft to accelerate go-to-market`,
  (c) => `${c} hits 10,000 customers milestone, revenue up 180% YoY`,
];
const FUNDING_ROUNDS = ["Seed", "Series A", "Series B", "Series C", "Growth"];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function simulateCompanyInfo(companyName) {
  const employees = [12, 45, 120, 340, 800, 1500, 4200][Math.floor(Math.random() * 7)];
  const revenueMap = { 12: "< $1M", 45: "$1M–$5M", 120: "$5M–$20M", 340: "$20M–$50M", 800: "$50M–$100M", 1500: "$100M–$250M", 4200: "$250M+" };
  return {
    revenue: revenueMap[employees],
    employees,
    industry: pickRandom(INDUSTRIES),
    tech_stack: pickRandom(TECH_STACKS),
    headquarters: pickRandom(["San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA", "Boston, MA", "Chicago, IL"]),
    founded: 2010 + Math.floor(Math.random() * 13),
    website: `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com`,
  };
}

function simulateContactInfo(contactName, companyName) {
  const slug = contactName.toLowerCase().replace(/\s+/g, "-");
  return {
    title: pickRandom(TITLES),
    linkedin: `https://linkedin.com/in/${slug}-${Math.floor(100 + Math.random() * 900)}`,
    twitter: `@${slug.replace(/-/g, "_")}`,
    location: pickRandom(["San Francisco, CA", "New York, NY", "Remote", "London, UK", "Austin, TX"]),
    seniority: pickRandom(["VP", "C-Suite", "Director", "Manager"]),
    years_at_company: Math.floor(1 + Math.random() * 8),
  };
}

function simulateFundingHistory(companyName) {
  const rounds = Math.floor(1 + Math.random() * 4);
  let amount = 500_000;
  const history = [];
  for (let i = 0; i < rounds; i++) {
    amount *= 3 + Math.random() * 5;
    const year = 2018 + i * Math.floor(1 + Math.random() * 2);
    history.push({
      round: FUNDING_ROUNDS[Math.min(i, FUNDING_ROUNDS.length - 1)],
      amount_usd: Math.round(amount),
      year,
      lead_investor: pickRandom(["Sequoia Capital", "a16z", "Accel", "Tiger Global", "Bessemer Ventures", "Lightspeed", "GV", "Founders Fund"]),
    });
  }
  return history;
}

function simulateNews(companyName) {
  const count = 1 + Math.floor(Math.random() * 3);
  const selected = NEWS_TEMPLATES.slice(0, count);
  return selected.map(tpl => ({
    headline: tpl(companyName),
    source: pickRandom(["TechCrunch", "Forbes", "Bloomberg", "VentureBeat", "Business Insider"]),
    date: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString().slice(0, 10),
    sentiment: pickRandom(["positive", "positive", "positive", "neutral"]),
    url: `https://example.com/news/${randomUUID().slice(0, 8)}`,
  }));
}

// ─── enrichLead ───────────────────────────────────────────────────────────────

/**
 * Enrich a sales lead with company data, contact intelligence, news, and funding.
 * @param {string} companyName  - Target company name
 * @param {string} contactName  - Primary contact's full name
 * @param {string} email        - Contact's business email
 * @returns Enriched lead record with company_info, contact_info, news, funding_history
 * Fee: $0.25 per enrichment (20% platform commission)
 */
export function enrichLead(companyName, contactName, email) {
  if (!companyName) throw new Error("companyName is required");
  if (!contactName) throw new Error("contactName is required");
  if (!email)       throw new Error("email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email format");

  const fee        = CRM_FEES.enrichment;
  const comm       = commission(fee);
  const id         = randomUUID();
  const now        = new Date().toISOString();

  const company_info      = simulateCompanyInfo(companyName);
  const contact_info      = simulateContactInfo(contactName, companyName);
  const news              = simulateNews(companyName);
  const funding_history   = simulateFundingHistory(companyName);

  db.prepare(`
    INSERT OR IGNORE INTO crm_leads
      (id, company_name, contact_name, email, company_info, contact_info, news, funding_history, status, enriched_at, created_at)
    VALUES
      (@id, @company_name, @contact_name, @email, @company_info, @contact_info, @news, @funding_history, 'enriched', @enriched_at, @created_at)
  `).run({
    id,
    company_name:    companyName,
    contact_name:    contactName,
    email,
    company_info:    JSON.stringify(company_info),
    contact_info:    JSON.stringify(contact_info),
    news:            JSON.stringify(news),
    funding_history: JSON.stringify(funding_history),
    enriched_at:     now,
    created_at:      now,
  });

  return {
    lead_id:          id,
    company_name:     companyName,
    contact_name:     contactName,
    email,
    company_info,
    contact_info,
    news,
    funding_history,
    enriched_at:      now,
    fee_usd:          fee,
    platform_commission_usd: comm,
    net_revenue_usd:  Math.round((fee - comm) * 100) / 100,
  };
}

// ─── scoreLead ────────────────────────────────────────────────────────────────

/**
 * Score a lead against an Ideal Customer Profile (ICP).
 * @param {object} leadData            - Lead object (output of enrichLead or equivalent shape)
 * @param {object} idealCustomerProfile - ICP definition with industry, size, tech_stack, etc.
 * @returns score (0–100), fit_breakdown, buying_signals[], recommended_action
 * Fee: $0.10 per score
 */
export function scoreLead(leadData, idealCustomerProfile) {
  if (!leadData)            throw new Error("leadData is required");
  if (!idealCustomerProfile) throw new Error("idealCustomerProfile is required");

  const fee  = CRM_FEES.score;
  const comm = commission(fee);

  const icp  = idealCustomerProfile;
  const info = leadData.company_info ?? {};

  // Dimension scoring (each out of 100, weighted average)
  const industryMatch   = icp.industries?.includes(info.industry)  ? 100 : 40;
  const sizeMatch       = (() => {
    const emp = info.employees ?? 0;
    const min = icp.min_employees ?? 0;
    const max = icp.max_employees ?? Infinity;
    return emp >= min && emp <= max ? 100 : emp >= min * 0.5 && emp <= max * 2 ? 55 : 15;
  })();
  const techMatch       = (() => {
    const stack = info.tech_stack ?? [];
    const wanted = icp.tech_stack ?? [];
    if (wanted.length === 0) return 70;
    const hits = stack.filter(t => wanted.includes(t)).length;
    return Math.min(100, (hits / wanted.length) * 100);
  })();
  const fundingSignal   = (leadData.funding_history ?? []).length > 1 ? 90 : 50;
  const newsSignal      = (leadData.news ?? []).some(n => n.sentiment === "positive") ? 80 : 50;
  const revenueMatch    = (() => {
    const rev = info.revenue ?? "";
    if (icp.target_revenue_band && rev.includes(icp.target_revenue_band)) return 100;
    return 60;
  })();

  const weights = { industry: 0.25, size: 0.25, tech: 0.20, funding: 0.10, news: 0.10, revenue: 0.10 };
  const raw = (
    industryMatch * weights.industry +
    sizeMatch     * weights.size     +
    techMatch     * weights.tech     +
    fundingSignal * weights.funding  +
    newsSignal    * weights.news     +
    revenueMatch  * weights.revenue
  );
  const score = Math.min(100, Math.round(raw));

  const fit_breakdown = {
    industry_fit:  Math.round(industryMatch),
    size_fit:      Math.round(sizeMatch),
    tech_stack_fit: Math.round(techMatch),
    funding_signal: Math.round(fundingSignal),
    news_signal:   Math.round(newsSignal),
    revenue_fit:   Math.round(revenueMatch),
  };

  const buying_signals = [];
  if (fundingSignal >= 80)  buying_signals.push("Recent funding round detected — likely budget available");
  if (newsSignal >= 75)     buying_signals.push("Positive press coverage indicates growth momentum");
  if (sizeMatch === 100)    buying_signals.push("Headcount squarely within ICP target range");
  if (techMatch >= 75)      buying_signals.push("Tech stack overlap suggests integration fit");
  if ((leadData.news ?? []).some(n => n.headline.toLowerCase().includes("expand")))
    buying_signals.push("Expansion news signals new budget authority");

  const recommended_action = score >= 70 ? "pursue" : score >= 40 ? "nurture" : "disqualify";

  // Persist score back to lead record if we have a lead_id
  if (leadData.lead_id) {
    db.prepare(`
      UPDATE crm_leads SET score=@score, fit_breakdown=@fit_breakdown,
        buying_signals=@buying_signals, recommended_action=@recommended_action,
        status='scored', scored_at=@scored_at
      WHERE id=@id
    `).run({
      id:                 leadData.lead_id,
      score,
      fit_breakdown:      JSON.stringify(fit_breakdown),
      buying_signals:     JSON.stringify(buying_signals),
      recommended_action,
      scored_at:          new Date().toISOString(),
    });
  }

  return {
    lead_id:             leadData.lead_id ?? null,
    company_name:        leadData.company_name,
    score,
    fit_breakdown,
    buying_signals,
    recommended_action,
    score_rationale:     `Score of ${score}/100. ${recommended_action === "pursue" ? "Strong ICP alignment — prioritize for immediate outreach." : recommended_action === "nurture" ? "Partial fit — enroll in nurture sequence and revisit in 30 days." : "Low fit — do not invest further sales resources."}`,
    fee_usd:             fee,
    platform_commission_usd: comm,
    net_revenue_usd:     Math.round((fee - comm) * 100) / 100,
  };
}

// ─── generateOutreach ─────────────────────────────────────────────────────────

/**
 * Generate personalized sales outreach email and follow-up sequence.
 * @param {object} leadData   - Lead data (output of enrichLead)
 * @param {string} campaign   - Campaign name or theme (e.g., "Q4 Enterprise Push")
 * @param {string} tone       - Email tone: professional|casual|consultative|urgency
 * @param {string[]} valueProps - Key value propositions to weave into the copy
 * @returns email_subject, email_body, follow_up_sequence[], personalization_points[]
 * Fee: $0.15 per email
 */
export function generateOutreach(leadData, campaign, tone = "professional", valueProps = []) {
  if (!leadData) throw new Error("leadData is required");
  if (!campaign) throw new Error("campaign is required");

  const validTones = ["professional", "casual", "consultative", "urgency"];
  if (!validTones.includes(tone)) throw new Error(`tone must be one of: ${validTones.join(", ")}`);

  const fee  = CRM_FEES.email;
  const comm = commission(fee);

  const { company_name = "your company", contact_name = "there", contact_info = {}, company_info = {}, funding_history = [], news = [] } = leadData;
  const firstName    = contact_name.split(" ")[0];
  const title        = contact_info.title ?? "leader";
  const industry     = company_info.industry ?? "your industry";
  const latestNews   = news[0]?.headline ?? null;
  const latestFunding = funding_history.at(-1) ?? null;
  const vp           = valueProps.length > 0 ? valueProps[0] : "accelerating revenue";

  const toneOpeners = {
    professional: `I hope this message finds you well.`,
    casual:       `Quick note — I've been following ${company_name} for a while and wanted to reach out.`,
    consultative: `I've been researching ${industry} companies at your growth stage and noticed a pattern worth sharing.`,
    urgency:      `I'll keep this short — we're seeing ${industry} teams move fast right now and I don't want you to miss the window.`,
  };

  const personalizationNote = latestNews
    ? `Congrats on "${latestNews.slice(0, 80)}..." — that's exactly the kind of momentum we love to amplify.`
    : latestFunding
      ? `Congrats on the ${latestFunding.round} round — looks like an exciting time to scale.`
      : `I've been tracking ${company_name}'s growth trajectory — impressive work.`;

  const email_subject = tone === "urgency"
    ? `${company_name} + [Our Platform] — time-sensitive`
    : tone === "casual"
      ? `Hey ${firstName}, quick idea for ${company_name}`
      : `${campaign}: How ${company_name} can ${vp}`;

  const email_body = `Hi ${firstName},

${toneOpeners[tone]}

${personalizationNote}

As a ${title} at ${company_name}, you're likely focused on ${vp}. That's exactly what our platform was built for — we've helped ${industry} companies like yours reduce cycle time by 40% and increase qualified pipeline by 3×.

${valueProps.slice(1, 3).map(v => `• ${v}`).join("\n")}

Would a 20-minute call this week make sense? I have availability ${pickRandom(["Tuesday at 10am or Thursday at 2pm", "Wednesday at 11am or Friday at 3pm", "Monday at 9am or Wednesday at 1pm"])} — happy to work around your schedule.

Best,
[Your Name]
[Company] | [Title]
[Phone] | [Calendar Link]`;

  const follow_up_sequence = [
    {
      day: 3,
      channel: "email",
      subject: `Following up — ${company_name}`,
      preview: `${firstName}, just wanted to make sure my note didn't get buried. The core idea: [one-line value prop]. Worth 15 minutes?`,
    },
    {
      day: 7,
      channel: "linkedin",
      preview: `${firstName} — sent you an email last week about ${vp}. Connecting here in case that's a better channel.`,
    },
    {
      day: 14,
      channel: "email",
      subject: `Last touch — ${company_name}`,
      preview: `${firstName}, I'll stop after this — but I'd feel remiss not sharing [case study/result]. If the timing's off, happy to reconnect in Q2.`,
    },
  ];

  const personalization_points = [
    latestNews ? `Recent news: "${latestNews.slice(0, 60)}..."` : null,
    latestFunding ? `Funding signal: ${latestFunding.round} from ${latestFunding.lead_investor}` : null,
    `Industry context: ${industry} competitive landscape`,
    `Title-specific framing for ${title}`,
    `Tech stack angle: integration with ${company_info.tech_stack?.[0] ?? "existing tools"}`,
  ].filter(Boolean);

  const id   = randomUUID();
  const now  = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO crm_outreach
      (id, lead_id, campaign, tone, email_subject, email_body, follow_up_sequence, personalization_points, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @lead_id, @campaign, @tone, @email_subject, @email_body, @follow_up_sequence, @personalization_points, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    lead_id:               leadData.lead_id ?? null,
    campaign,
    tone,
    email_subject,
    email_body,
    follow_up_sequence:    JSON.stringify(follow_up_sequence),
    personalization_points: JSON.stringify(personalization_points),
    fee_usd:               fee,
    commission_usd:        comm,
    created_at:            now,
  });

  return {
    outreach_id:            id,
    lead_id:                leadData.lead_id ?? null,
    campaign,
    tone,
    email_subject,
    email_body,
    follow_up_sequence,
    personalization_points,
    created_at:             now,
    fee_usd:                fee,
    platform_commission_usd: comm,
    net_revenue_usd:        Math.round((fee - comm) * 100) / 100,
  };
}

// ─── scheduleMeeting ──────────────────────────────────────────────────────────

/**
 * Schedule a meeting between a contact and the agent's calendar.
 * @param {string}   contactEmail    - Contact's email address
 * @param {string}   agentCalendar   - Agent's calendar ID or email
 * @param {string[]} preferredTimes  - ISO datetime strings of preferred slots
 * @param {number}   duration        - Duration in minutes (15, 30, 45, 60)
 * @param {string}   agenda          - Meeting agenda text
 * @returns meeting_id, confirmed_time, calendar_link, agenda
 * Fee: $0.50 per meeting
 */
export function scheduleMeeting(contactEmail, agentCalendar, preferredTimes = [], duration = 30, agenda) {
  if (!contactEmail)  throw new Error("contactEmail is required");
  if (!agentCalendar) throw new Error("agentCalendar is required");
  if (!agenda)        throw new Error("agenda is required");
  if (![15, 30, 45, 60, 90].includes(duration)) throw new Error("duration must be 15, 30, 45, 60, or 90 minutes");

  const fee  = CRM_FEES.meeting;
  const comm = commission(fee);

  // Pick the first preferred time or default to next business day at 10am
  let confirmedTime;
  if (preferredTimes && preferredTimes.length > 0) {
    confirmedTime = preferredTimes[0];
  } else {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(10, 0, 0, 0);
    confirmedTime = tomorrow.toISOString();
  }

  const meetingId    = randomUUID();
  const shortId      = meetingId.slice(0, 8).toUpperCase();
  const calendarLink = `https://meet.example.com/${shortId}`;
  const now          = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO crm_meetings
      (id, contact_email, confirmed_time, duration_minutes, agenda, calendar_link, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @contact_email, @confirmed_time, @duration_minutes, @agenda, @calendar_link, @fee_usd, @commission_usd, @created_at)
  `).run({
    id:               meetingId,
    contact_email:    contactEmail,
    confirmed_time:   confirmedTime,
    duration_minutes: duration,
    agenda,
    calendar_link:    calendarLink,
    fee_usd:          fee,
    commission_usd:   comm,
    created_at:       now,
  });

  return {
    meeting_id:             meetingId,
    contact_email:          contactEmail,
    agent_calendar:         agentCalendar,
    confirmed_time:         confirmedTime,
    duration_minutes:       duration,
    calendar_link:          calendarLink,
    conference_url:         `https://zoom.example.com/${shortId}`,
    agenda,
    invites_sent_to:        [contactEmail, agentCalendar],
    reminder_scheduled_at:  new Date(new Date(confirmedTime).getTime() - 3600000).toISOString(),
    status:                 "scheduled",
    created_at:             now,
    fee_usd:                fee,
    platform_commission_usd: comm,
    net_revenue_usd:        Math.round((fee - comm) * 100) / 100,
  };
}

// ─── forecastPipeline ─────────────────────────────────────────────────────────

/**
 * Forecast revenue pipeline using deal data and historical close rates.
 * @param {object[]} deals         - Array of deal objects {id, name, amount, stage, close_date, owner}
 * @param {object}   historicalData - Historical win rates, avg deal size, cycle length, etc.
 * @returns forecast_amount, confidence, deals_at_risk[], recommended_actions[], win_probability_by_deal
 * Fee: $2.00 per forecast
 */
export function forecastPipeline(deals, historicalData = {}) {
  if (!deals || !Array.isArray(deals) || deals.length === 0) throw new Error("deals must be a non-empty array");

  const fee  = CRM_FEES.forecast;
  const comm = commission(fee);

  const stageWinRates = {
    prospecting:    0.05,
    qualification:  0.15,
    demo:           0.30,
    proposal:       0.55,
    negotiation:    0.75,
    closed_won:     1.00,
    closed_lost:    0.00,
    ...( historicalData.stage_win_rates ?? {} ),
  };

  const win_probability_by_deal = {};
  let weightedTotal = 0;
  const deals_at_risk = [];

  for (const deal of deals) {
    const stage      = (deal.stage ?? "qualification").toLowerCase().replace(/\s+/g, "_");
    const winProb    = stageWinRates[stage] ?? 0.20;
    const amount     = deal.amount ?? 0;
    const weighted   = Math.round(amount * winProb);
    weightedTotal   += weighted;

    win_probability_by_deal[deal.id ?? deal.name] = {
      name:             deal.name,
      stage,
      amount,
      win_probability:  winProb,
      weighted_value:   weighted,
      close_date:       deal.close_date ?? null,
    };

    // Flag at-risk deals
    const daysToClose = deal.close_date
      ? Math.round((new Date(deal.close_date) - Date.now()) / 86400000)
      : null;
    const riskFactors = [];
    if (winProb < 0.30 && amount > (historicalData.avg_deal_size ?? 10000)) riskFactors.push("Low win probability on high-value deal");
    if (daysToClose !== null && daysToClose < 14 && stage === "prospecting") riskFactors.push("Close date too optimistic for current stage");
    if (deal.last_activity_days != null && deal.last_activity_days > 30) riskFactors.push("No activity in 30+ days — deal may have gone cold");
    if (riskFactors.length > 0) {
      deals_at_risk.push({ deal_id: deal.id ?? deal.name, name: deal.name, amount, stage, risk_factors: riskFactors });
    }
  }

  const totalPipeline = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const avgWinRate    = historicalData.avg_win_rate ?? 0.28;
  const confidence    = Math.min(0.95, Math.max(0.35, avgWinRate * (1 + deals.filter(d => (stageWinRates[(d.stage ?? "").toLowerCase().replace(/\s+/g, "_")] ?? 0) > 0.5).length / deals.length)));

  const recommended_actions = [];
  if (deals_at_risk.length > 0) recommended_actions.push(`Review ${deals_at_risk.length} at-risk deal(s) with your team this week`);
  if (totalPipeline < (historicalData.revenue_target ?? totalPipeline * 1.5)) recommended_actions.push("Pipeline coverage below 3× target — increase top-of-funnel activity");
  recommended_actions.push("Prioritize deals in proposal/negotiation stage for fastest path to revenue");
  if (deals.some(d => d.last_activity_days > 14)) recommended_actions.push("Re-engage stale deals with a value-add check-in, not a follow-up ask");

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO crm_forecasts
      (id, forecast_amount, confidence, deals_at_risk, recommended_actions, win_probability_by_deal, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @forecast_amount, @confidence, @deals_at_risk, @recommended_actions, @win_probability_by_deal, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    forecast_amount:          weightedTotal,
    confidence:               Math.round(confidence * 100) / 100,
    deals_at_risk:            JSON.stringify(deals_at_risk),
    recommended_actions:      JSON.stringify(recommended_actions),
    win_probability_by_deal:  JSON.stringify(win_probability_by_deal),
    fee_usd:                  fee,
    commission_usd:           comm,
    created_at:               now,
  });

  return {
    forecast_id:              id,
    forecast_amount:          weightedTotal,
    total_pipeline:           totalPipeline,
    confidence:               Math.round(confidence * 100) / 100,
    confidence_label:         confidence >= 0.75 ? "high" : confidence >= 0.50 ? "medium" : "low",
    deals_analyzed:           deals.length,
    deals_at_risk,
    recommended_actions,
    win_probability_by_deal,
    generated_at:             now,
    fee_usd:                  fee,
    platform_commission_usd:  comm,
    net_revenue_usd:          Math.round((fee - comm) * 100) / 100,
  };
}

// ─── trackCompetitorMentions ──────────────────────────────────────────────────

/**
 * Monitor competitor mentions across specified sources and surface threat intelligence.
 * @param {string[]} competitors - List of competitor names
 * @param {string[]} sources     - Sources to monitor: news|social|review_sites|job_boards|patents
 * @param {object}   dateRange   - {start: ISO date, end: ISO date}
 * @returns mentions[] with source, sentiment, summary, threat_level
 * Fee: $1.00 per report
 */
export function trackCompetitorMentions(competitors, sources = ["news", "social"], dateRange = {}) {
  if (!competitors || !Array.isArray(competitors) || competitors.length === 0) throw new Error("competitors must be a non-empty array");

  const validSources = ["news", "social", "review_sites", "job_boards", "patents"];
  const filteredSources = sources.filter(s => validSources.includes(s));
  if (filteredSources.length === 0) throw new Error(`sources must include at least one of: ${validSources.join(", ")}`);

  const fee  = CRM_FEES.report;
  const comm = commission(fee);

  const start = dateRange.start ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const end   = dateRange.end   ?? new Date().toISOString().slice(0, 10);

  const mentionTemplates = {
    news: [
      (c) => ({ summary: `${c} announces major product update targeting enterprise segment`, sentiment: "neutral", threat_level: "medium" }),
      (c) => ({ summary: `${c} raises $50M Series C, plans aggressive hiring`, sentiment: "negative", threat_level: "high" }),
      (c) => ({ summary: `${c} loses key enterprise customer after service outage`, sentiment: "positive", threat_level: "low" }),
    ],
    social: [
      (c) => ({ summary: `${c} trending on X/Twitter — viral post about new AI feature`, sentiment: "neutral", threat_level: "medium" }),
      (c) => ({ summary: `${c} getting negative sentiment on LinkedIn after layoffs`, sentiment: "positive", threat_level: "low" }),
    ],
    review_sites: [
      (c) => ({ summary: `${c} drops to 3.8★ on G2 — multiple reviews cite poor support`, sentiment: "positive", threat_level: "low" }),
      (c) => ({ summary: `${c} reaches #1 in category on Capterra — 150 new reviews in 30 days`, sentiment: "negative", threat_level: "high" }),
    ],
    job_boards: [
      (c) => ({ summary: `${c} posted 40 open roles including VP Sales and 8 AEs — expansion signal`, sentiment: "neutral", threat_level: "medium" }),
    ],
    patents: [
      (c) => ({ summary: `${c} filed 3 new patents in NLP/AI space — potential product direction shift`, sentiment: "neutral", threat_level: "medium" }),
    ],
  };

  const mentions = [];
  for (const competitor of competitors) {
    for (const source of filteredSources) {
      const templates = mentionTemplates[source] ?? [];
      const picked    = templates[Math.floor(Math.random() * templates.length)];
      if (!picked) continue;
      const base = picked(competitor);
      mentions.push({
        mention_id:    randomUUID(),
        competitor,
        source,
        date:          new Date(new Date(start).getTime() + Math.random() * (new Date(end) - new Date(start))).toISOString().slice(0, 10),
        summary:       base.summary,
        sentiment:     base.sentiment,
        threat_level:  base.threat_level,
        url:           `https://example.com/${source}/${randomUUID().slice(0, 8)}`,
        action_recommended: base.threat_level === "high"
          ? "Escalate to sales leadership immediately and update battlecard"
          : base.threat_level === "medium"
            ? "Monitor and update competitive positioning materials"
            : "Log for context; no immediate action needed",
      });
    }
  }

  // Sort by threat level
  const threatOrder = { high: 0, medium: 1, low: 2 };
  mentions.sort((a, b) => (threatOrder[a.threat_level] ?? 2) - (threatOrder[b.threat_level] ?? 2));

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO crm_competitor_reports
      (id, competitors, sources, date_range, mentions, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @competitors, @sources, @date_range, @mentions, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    competitors:    JSON.stringify(competitors),
    sources:        JSON.stringify(filteredSources),
    date_range:     JSON.stringify({ start, end }),
    mentions:       JSON.stringify(mentions),
    fee_usd:        fee,
    commission_usd: comm,
    created_at:     now,
  });

  const highThreatCount = mentions.filter(m => m.threat_level === "high").length;

  return {
    report_id:          id,
    competitors_tracked: competitors,
    sources_monitored:  filteredSources,
    date_range:         { start, end },
    total_mentions:     mentions.length,
    high_threat_count:  highThreatCount,
    mentions,
    executive_summary:  `Tracked ${competitors.length} competitor(s) across ${filteredSources.length} source(s). Found ${mentions.length} mention(s) — ${highThreatCount} high-threat signal(s) requiring immediate attention.`,
    generated_at:       now,
    fee_usd:            fee,
    platform_commission_usd: comm,
    net_revenue_usd:    Math.round((fee - comm) * 100) / 100,
  };
}
