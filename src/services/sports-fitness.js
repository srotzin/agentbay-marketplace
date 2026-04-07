import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const FEE_FACILITY_SEARCH      = 0.00;  // free
const FEE_WORKOUT_PLAN         = 1.00;  // per plan
const FEE_PERFORMANCE_ANALYSIS = 2.00;  // per analysis
const BOOKING_COMMISSION_RATE  = 0.05;  // 5% commission
const FEE_NUTRITION_PLAN       = 1.00;  // per plan

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sport_facilities (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    activity_type  TEXT NOT NULL,   -- gym, yoga, pool, tennis, basketball, soccer, climbing, cycling, boxing
    address        TEXT NOT NULL,
    city           TEXT NOT NULL,
    state          TEXT,
    price_monthly  REAL,
    price_dropIn   REAL,
    hours          TEXT,
    amenities      TEXT DEFAULT '[]',
    rating         REAL DEFAULT 4.0,
    phone          TEXT,
    website        TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sport_workout_plans (
    id                TEXT PRIMARY KEY,
    fitness_level     TEXT NOT NULL,   -- beginner, intermediate, advanced
    goals             TEXT NOT NULL,
    equipment         TEXT DEFAULT 'none',
    days_per_week     INTEGER DEFAULT 3,
    weeks             TEXT DEFAULT '[]',
    exercises         TEXT DEFAULT '[]',
    progression       TEXT DEFAULT '',
    estimated_calories_per_week INTEGER DEFAULT 0,
    fee_usd           REAL DEFAULT 1.00,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sport_bookings (
    id                  TEXT PRIMARY KEY,
    event_type          TEXT NOT NULL,
    location            TEXT NOT NULL,
    booking_date        TEXT NOT NULL,
    participants        INTEGER DEFAULT 1,
    cost_usd            REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    cancellation_policy TEXT,
    confirmation_code   TEXT,
    status              TEXT DEFAULT 'confirmed',
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sport_nutrition_plans (
    id                    TEXT PRIMARY KEY,
    goals                 TEXT NOT NULL,
    restrictions          TEXT DEFAULT '[]',
    budget_weekly_usd     REAL DEFAULT 100,
    meal_plan             TEXT DEFAULT '{}',
    macros                TEXT DEFAULT '{}',
    grocery_list          TEXT DEFAULT '[]',
    estimated_weekly_cost REAL DEFAULT 0,
    fee_usd               REAL DEFAULT 1.00,
    created_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_facilities_city ON sport_facilities(city);
  CREATE INDEX IF NOT EXISTS idx_facilities_activity ON sport_facilities(activity_type);
`);

// ─── Seed Facilities ──────────────────────────────────────────────────────────

const _facCount = db.prepare("SELECT COUNT(*) as n FROM sport_facilities").get().n;
if (_facCount === 0) {
  const facilities = [
    { name: "Equinox Fitness Club", activity_type: "gym", address: "1633 Broadway", city: "New York", state: "NY", price_monthly: 260, price_dropIn: 45, hours: "Mon-Fri 5am-11pm, Sat-Sun 7am-10pm", amenities: '["pool","sauna","steam room","classes","personal training","smoothie bar"]', rating: 4.8, phone: "212-555-0101", website: "https://equinox.com" },
    { name: "Planet Fitness", activity_type: "gym", address: "3rd Ave & 14th St", city: "New York", state: "NY", price_monthly: 25, price_dropIn: 5, hours: "24/7", amenities: '["cardio equipment","weight machines","tanning","massage chairs"]', rating: 4.1, phone: "212-555-0102", website: "https://planetfitness.com" },
    { name: "CorePower Yoga", activity_type: "yoga", address: "2040 Fillmore St", city: "San Francisco", state: "CA", price_monthly: 149, price_dropIn: 30, hours: "Mon-Fri 6am-9pm, Sat-Sun 7am-7pm", amenities: '["heated studios","beginner classes","teacher training","online streaming"]', rating: 4.7, phone: "415-555-0201", website: "https://corepoweryoga.com" },
    { name: "LA Fitness", activity_type: "gym", address: "7050 W Sunset Blvd", city: "Los Angeles", state: "CA", price_monthly: 35, price_dropIn: 10, hours: "Mon-Fri 5am-11pm, Sat-Sun 8am-8pm", amenities: '["pool","basketball court","racquetball","sauna","group classes"]', rating: 4.2, phone: "323-555-0301", website: "https://lafitness.com" },
    { name: "Lifetime Fitness", activity_type: "gym", address: "1000 N Michigan Ave", city: "Chicago", state: "IL", price_monthly: 199, price_dropIn: 35, hours: "Mon-Fri 4am-midnight, Sat-Sun 6am-11pm", amenities: '["pool","tennis","pickleball","spa","childcare","cafe"]', rating: 4.6, phone: "312-555-0401", website: "https://lifetimefitness.com" },
    { name: "CrossFit Downtown", activity_type: "gym", address: "420 S Commerce St", city: "Nashville", state: "TN", price_monthly: 175, price_dropIn: 25, hours: "Mon-Fri 5:30am-7pm, Sat 7am-noon", amenities: '["coached WODs","olympic lifting","mobility classes","nutrition coaching"]', rating: 4.9, phone: "615-555-0501", website: "https://crossfitdowntown.com" },
    { name: "Seattle Tennis Club", activity_type: "tennis", address: "922 McGilvra Blvd E", city: "Seattle", state: "WA", price_monthly: 450, price_dropIn: 30, hours: "Mon-Sun 7am-10pm", amenities: '["indoor courts","pro shop","lessons","leagues","fitness center"]', rating: 4.7, phone: "206-555-0601", website: "https://seattletennisclub.org" },
    { name: "Miami Swim Academy", activity_type: "pool", address: "3301 Rickenbacker Cswy", city: "Miami", state: "FL", price_monthly: 89, price_dropIn: 15, hours: "Mon-Fri 6am-9pm, Sat-Sun 7am-7pm", amenities: '["lap lanes","swim lessons","masters swim","triathlon training"]', rating: 4.5, phone: "305-555-0701", website: "https://miamiswimacademy.com" },
    { name: "Denver Climbing Center", activity_type: "climbing", address: "2829 Walnut St", city: "Denver", state: "CO", price_monthly: 75, price_dropIn: 22, hours: "Mon-Fri 6am-10pm, Sat-Sun 8am-8pm", amenities: '["bouldering","lead climbing","top rope","gear rental","lessons"]', rating: 4.8, phone: "720-555-0801", website: "https://denverclimbing.com" },
    { name: "Philadelphia Boxing Gym", activity_type: "boxing", address: "1920 N Broad St", city: "Philadelphia", state: "PA", price_monthly: 120, price_dropIn: 20, hours: "Mon-Fri 6am-9pm, Sat 8am-4pm", amenities: '["heavy bags","speed bags","ring sparring","conditioning classes","personal training"]', rating: 4.6, phone: "215-555-0901", website: "https://phillyboxing.com" },
    { name: "Austin Cycling Studio", activity_type: "cycling", address: "1100 S Lamar Blvd", city: "Austin", state: "TX", price_monthly: 145, price_dropIn: 30, hours: "Mon-Fri 5:30am-8pm, Sat-Sun 7am-6pm", amenities: '["indoor cycling","outdoor rides","strength training","nutrition counseling"]', rating: 4.7, phone: "512-555-1001", website: "https://austincycling.com" },
    { name: "Portland Soccer Complex", activity_type: "soccer", address: "6000 N Cutter Circle", city: "Portland", state: "OR", price_monthly: 95, price_dropIn: 18, hours: "Mon-Sun 6am-10pm", amenities: '["indoor fields","outdoor fields","leagues","youth programs","coaching"]', rating: 4.4, phone: "503-555-1101", website: "https://portlandsoccer.com" },
    { name: "Houston Basketball Center", activity_type: "basketball", address: "7 Greenway Plaza", city: "Houston", state: "TX", price_monthly: 85, price_dropIn: 12, hours: "Mon-Fri 6am-10pm, Sat-Sun 8am-8pm", amenities: '["full courts","half courts","leagues","skill clinics","shooting machines"]', rating: 4.3, phone: "713-555-1201", website: "https://houstonbasketball.com" },
    { name: "San Diego Yoga Flow", activity_type: "yoga", address: "4501 Mission Bay Dr", city: "San Diego", state: "CA", price_monthly: 129, price_dropIn: 25, hours: "Daily 6am-8pm", amenities: '["hot yoga","restorative","aerial yoga","workshops","meditation"]', rating: 4.8, phone: "619-555-1301", website: "https://sandiegoyogaflow.com" },
    { name: "Boston Sports & Fitness", activity_type: "gym", address: "360 Newbury St", city: "Boston", state: "MA", price_monthly: 110, price_dropIn: 20, hours: "Mon-Fri 5am-11pm, Sat-Sun 7am-9pm", amenities: '["weight room","cardio","pool","squash courts","group fitness","cafe"]', rating: 4.5, phone: "617-555-1401", website: "https://bostonfit.com" },
  ];

  const insFac = db.prepare(`INSERT OR IGNORE INTO sport_facilities (id,name,activity_type,address,city,state,price_monthly,price_dropIn,hours,amenities,rating,phone,website) VALUES (@id,@name,@activity_type,@address,@city,@state,@price_monthly,@price_dropIn,@hours,@amenities,@rating,@phone,@website)`);
  for (const row of facilities) insFac.run({ id: randomUUID(), ...row });
}

// ─── searchFacilities ──────────────────────────────────────────────────────────

/**
 * Find gyms, courts, studios near a location.
 * @param {string} location - City or zip code
 * @param {string} activityType - gym | yoga | pool | tennis | basketball | soccer | climbing | cycling | boxing
 * @param {string[]} amenities - Required amenities (optional)
 */
export function searchFacilities({ location, activityType, amenities = [] }) {
  let sql = "SELECT * FROM sport_facilities WHERE 1=1";
  const params = {};

  if (location) {
    sql += " AND (city LIKE @loc OR state LIKE @loc OR address LIKE @loc)";
    params.loc = `%${location}%`;
  }
  if (activityType) {
    sql += " AND activity_type = @type";
    params.type = activityType;
  }
  sql += " ORDER BY rating DESC LIMIT 20";

  let rows = db.prepare(sql).all(params);

  // Filter by amenities if provided
  if (amenities && amenities.length > 0) {
    rows = rows.filter(r => {
      const facAmenities = JSON.parse(r.amenities || "[]");
      return amenities.every(a => facAmenities.some(fa => fa.toLowerCase().includes(a.toLowerCase())));
    });
  }

  const facilities = rows.map(r => ({
    facility_id: r.id,
    name: r.name,
    activity_type: r.activity_type,
    address: r.address,
    city: r.city,
    state: r.state,
    price: {
      monthly_usd: r.price_monthly,
      drop_in_usd: r.price_dropIn,
    },
    hours: r.hours,
    amenities: JSON.parse(r.amenities || "[]"),
    rating: r.rating,
    phone: r.phone,
    website: r.website,
  }));

  return {
    facilities,
    total_found: facilities.length,
    location,
    activity_type: activityType || "all",
    fee_usd: FEE_FACILITY_SEARCH,
  };
}

// ─── createWorkoutPlan ─────────────────────────────────────────────────────────

/**
 * Create a personalized workout plan.
 * @param {string} fitnessLevel - beginner | intermediate | advanced
 * @param {string} goals - weight_loss | muscle_gain | endurance | flexibility | general_fitness
 * @param {string} equipment - none | home | gym | full
 * @param {number} daysPerWeek - 2-6
 */
export function createWorkoutPlan({ fitnessLevel, goals, equipment = "none", daysPerWeek = 3 }) {
  const planId = randomUUID();
  const level = fitnessLevel?.toLowerCase() || "beginner";
  const goal = goals?.toLowerCase() || "general_fitness";
  const days = Math.min(Math.max(parseInt(daysPerWeek) || 3, 2), 6);

  const exerciseLibrary = {
    strength: {
      beginner: ["Bodyweight squats", "Push-ups", "Lunges", "Glute bridges", "Plank (30s)", "Dumbbell rows"],
      intermediate: ["Goblet squats", "Bench press", "Romanian deadlifts", "Pull-ups", "Overhead press", "Barbell rows"],
      advanced: ["Back squats", "Deadlifts", "Weighted pull-ups", "Incline bench", "Power cleans", "Deficit push-ups"],
    },
    cardio: {
      beginner: ["Brisk walk 20min", "Cycling 15min", "Swimming 15min", "Jump rope 5min"],
      intermediate: ["Jog 25min", "Cycling 30min", "Jump rope 10min", "Rowing 20min"],
      advanced: ["HIIT intervals 30min", "Trail run 40min", "Cycling sprints 35min", "Rowing 25min"],
    },
    flexibility: {
      beginner: ["Hip flexor stretch", "Hamstring stretch", "Child's pose", "Cat-cow"],
      intermediate: ["Pigeon pose", "Thoracic rotation", "Deep squat hold", "Shoulder pass-throughs"],
      advanced: ["Full splits progression", "Overhead squat mobility", "Hip 90/90 stretch", "Pancake stretch"],
    },
  };

  const goalWeights = {
    weight_loss:     { strength: 0.35, cardio: 0.55, flexibility: 0.10 },
    muscle_gain:     { strength: 0.70, cardio: 0.15, flexibility: 0.15 },
    endurance:       { strength: 0.20, cardio: 0.65, flexibility: 0.15 },
    flexibility:     { strength: 0.25, cardio: 0.15, flexibility: 0.60 },
    general_fitness: { strength: 0.45, cardio: 0.35, flexibility: 0.20 },
  };

  const weights = goalWeights[goal] || goalWeights.general_fitness;
  const caloriesPerDay = {
    weight_loss: 450, muscle_gain: 320, endurance: 500,
    flexibility: 180, general_fitness: 380,
  }[goal] || 380;

  // Build 4-week progressive plan
  const weeks = Array.from({ length: 4 }, (_, weekIdx) => {
    const intensityMultiplier = 1 + weekIdx * 0.15;
    return {
      week: weekIdx + 1,
      focus: weekIdx === 0 ? "Foundation" : weekIdx === 1 ? "Build" : weekIdx === 2 ? "Intensify" : "Peak",
      days: Array.from({ length: days }, (_, dayIdx) => {
        const isRestDay = days < 5 && dayIdx === Math.floor(days / 2);
        if (isRestDay) return { day: dayIdx + 1, type: "active_recovery", exercises: ["Light stretching 15min", "Walk 20min"] };

        const dayType = dayIdx % 3 === 0 ? "strength" : dayIdx % 3 === 1 ? "cardio" : "flexibility";
        const exList = exerciseLibrary[dayType][level] || exerciseLibrary[dayType].beginner;
        return {
          day: dayIdx + 1,
          type: dayType,
          exercises: exList.slice(0, 4).map(e => ({
            name: e,
            sets: dayType === "strength" ? 3 + (weekIdx > 1 ? 1 : 0) : null,
            reps: dayType === "strength" ? (goal === "muscle_gain" ? "8-12" : "12-15") : null,
            duration_min: dayType !== "strength" ? Math.floor(20 * intensityMultiplier) : null,
          })),
        };
      }),
    };
  });

  const allExercises = [
    ...exerciseLibrary.strength[level].map(e => ({ name: e, category: "strength" })),
    ...exerciseLibrary.cardio[level].map(e => ({ name: e, category: "cardio" })),
    ...exerciseLibrary.flexibility[level].map(e => ({ name: e, category: "flexibility" })),
  ];

  const progression = `Week 1-2: Establish baseline form and consistency. Week 3: Increase weight/resistance by 5-10% or add one set. Week 4: Peak intensity — push to 80-85% effort. Deload after 4 weeks: reduce volume by 40%, maintain frequency.`;

  db.prepare(`INSERT INTO sport_workout_plans (id,fitness_level,goals,equipment,days_per_week,weeks,exercises,progression,estimated_calories_per_week,fee_usd) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(planId, fitnessLevel, goals, equipment, days, JSON.stringify(weeks), JSON.stringify(allExercises), progression, caloriesPerDay * days, FEE_WORKOUT_PLAN);

  return {
    plan_id: planId,
    fitness_level: fitnessLevel,
    goals,
    equipment,
    days_per_week: days,
    weeks,
    exercises: allExercises,
    progression,
    estimated_calories_per_week: caloriesPerDay * days,
    fee_usd: FEE_WORKOUT_PLAN,
    plan_url: `https://hiveagentiq.com/workout-plans/${planId}`,
  };
}

// ─── analyzePerformance ────────────────────────────────────────────────────────

/**
 * Analyze athletic performance data.
 * @param {object} athleteData - { age, weight_kg, height_cm, resting_hr, vo2max, sport_metrics }
 * @param {string} sport - running | cycling | swimming | strength | team_sports | crossfit
 * @param {string[]} metrics - Which metrics to analyze
 */
export function analyzePerformance({ athleteData = {}, sport, metrics = [] }) {
  const analysisId = randomUUID();

  const age = parseInt(athleteData.age) || 30;
  const weightKg = parseFloat(athleteData.weight_kg) || 75;
  const heightCm = parseFloat(athleteData.height_cm) || 175;
  const restingHr = parseInt(athleteData.resting_hr) || 65;
  const vo2max = parseFloat(athleteData.vo2max) || 45;

  // Calculate performance score (0-100)
  const maxHrPredicted = 220 - age;
  const hrReserveScore = Math.max(0, Math.min(100, ((maxHrPredicted - restingHr) / maxHrPredicted) * 100));
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const bmiScore = bmi >= 18.5 && bmi <= 24.9 ? 90 : bmi >= 25 && bmi <= 29.9 ? 70 : 50;
  const vo2Score = Math.min(100, Math.max(0, (vo2max - 25) / 40 * 100));

  const performanceScore = Math.round((hrReserveScore * 0.35 + bmiScore * 0.25 + vo2Score * 0.40));

  const sportStrengths = {
    running:     ["Aerobic base", "Pacing consistency", "Running economy"],
    cycling:     ["Power output", "Cadence control", "Climbing efficiency"],
    swimming:    ["Stroke mechanics", "Flip turn technique", "Breathing rhythm"],
    strength:    ["Compound lift form", "Progressive overload", "Recovery management"],
    team_sports: ["Agility", "Explosive speed", "Decision making under fatigue"],
    crossfit:    ["Metabolic conditioning", "Movement variety", "Mental resilience"],
  };

  const allStrengths = sportStrengths[sport] || sportStrengths.running;
  const strengths = allStrengths.slice(0, 2);
  const weaknesses = [
    `VO2max of ${vo2max} ml/kg/min is ${vo2max < 40 ? "below" : "approaching"} elite range for age group`,
    `Resting heart rate of ${restingHr} bpm — target <60 bpm for optimal cardiovascular fitness`,
    bmi > 25 ? "BMI indicates room for body composition improvement" : "Flexibility and mobility work would enhance performance",
  ].slice(0, 2);

  const recommendations = [
    `Increase ${sport === "running" ? "weekly mileage" : "training volume"} by 10% every 3 weeks`,
    `Add 2× weekly ${vo2max < 45 ? "VO2max interval sessions" : "lactate threshold training"} to lift aerobic ceiling`,
    `Prioritize sleep 8-9 hours nightly — the single highest-ROI recovery strategy`,
    `Track HRV daily: if HRV drops >10% below 7-day average, switch to active recovery`,
    `Consider ${sport === "strength" ? "mobility" : "strength"} training 2× weekly for injury prevention`,
  ];

  return {
    analysis_id: analysisId,
    sport,
    performance_score: performanceScore,
    performance_tier: performanceScore >= 80 ? "Elite" : performanceScore >= 65 ? "Competitive" : performanceScore >= 50 ? "Intermediate" : "Developing",
    strengths,
    weaknesses,
    recommendations,
    key_metrics: {
      bmi: Math.round(bmi * 10) / 10,
      predicted_max_hr: maxHrPredicted,
      hr_reserve: Math.round(maxHrPredicted - restingHr),
      vo2max_percentile: Math.round(vo2Score),
    },
    fee_usd: FEE_PERFORMANCE_ANALYSIS,
  };
}

// ─── bookSportsEvent ───────────────────────────────────────────────────────────

/**
 * Book sports facilities or events.
 * @param {string} eventType - court | field | lane | class | facility
 * @param {string} location - City or venue name
 * @param {object} dateRange - { date: 'YYYY-MM-DD', startTime: 'HH:MM', duration_hours: N }
 * @param {number} participants - Number of participants
 */
export function bookSportsEvent({ eventType, location, dateRange = {}, participants = 1 }) {
  const bookingId = randomUUID();
  const confirmationCode = `SPT-${randomUUID().substring(0, 8).toUpperCase()}`;

  const baseRates = {
    court: 35, field: 55, lane: 25, class: 20, facility: 45,
  };
  const hourlyRate = baseRates[eventType?.toLowerCase()] || 35;
  const durationHours = parseFloat(dateRange.duration_hours) || 1;
  const costUsd = Math.round(hourlyRate * durationHours * Math.ceil(participants / 2) * 100) / 100;
  const commissionUsd = Math.round(costUsd * BOOKING_COMMISSION_RATE * 100) / 100;

  const cancellationPolicy = `Full refund if cancelled 24+ hours before booking. 50% refund if cancelled 4-24 hours before. No refund for cancellations within 4 hours of scheduled start time.`;

  db.prepare(`INSERT INTO sport_bookings (id,event_type,location,booking_date,participants,cost_usd,commission_usd,cancellation_policy,confirmation_code,status) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(bookingId, eventType, location, dateRange.date || new Date().toISOString().split("T")[0], participants, costUsd, commissionUsd, cancellationPolicy, confirmationCode, "confirmed");

  return {
    booking_id: bookingId,
    confirmation_code: confirmationCode,
    event_type: eventType,
    location,
    date: dateRange.date,
    start_time: dateRange.startTime || "TBD",
    duration_hours: durationHours,
    participants,
    cost_usd: costUsd,
    commission_usd: commissionUsd,
    cancellation_policy: cancellationPolicy,
    status: "confirmed",
    booking_url: `https://hiveagentiq.com/bookings/${bookingId}`,
  };
}

// ─── getNutritionPlan ──────────────────────────────────────────────────────────

/**
 * Generate a personalized nutrition plan.
 * @param {string} goals - weight_loss | muscle_gain | endurance | maintenance | plant_based
 * @param {string[]} restrictions - vegetarian | vegan | gluten_free | dairy_free | nut_free | halal | kosher
 * @param {number} budget - Weekly grocery budget in USD
 */
export function getNutritionPlan({ goals, restrictions = [], budget = 100 }) {
  const planId = randomUUID();
  const goal = goals?.toLowerCase() || "maintenance";
  const weeklyBudget = parseFloat(budget) || 100;

  const macroTargets = {
    weight_loss:  { calories: 1800, protein_g: 150, carbs_g: 150, fat_g: 65 },
    muscle_gain:  { calories: 2800, protein_g: 210, carbs_g: 300, fat_g: 85 },
    endurance:    { calories: 2500, protein_g: 140, carbs_g: 380, fat_g: 65 },
    maintenance:  { calories: 2200, protein_g: 130, carbs_g: 240, fat_g: 75 },
    plant_based:  { calories: 2100, protein_g: 115, carbs_g: 270, fat_g: 70 },
  };

  const macros = macroTargets[goal] || macroTargets.maintenance;

  const isVegan = restrictions.includes("vegan");
  const isVegetarian = restrictions.includes("vegetarian") || isVegan;

  const proteinSources = isVegan
    ? ["Tempeh", "Lentils", "Chickpeas", "Edamame", "Tofu", "Hemp seeds"]
    : isVegetarian
    ? ["Eggs", "Greek yogurt", "Cottage cheese", "Lentils", "Chickpeas", "Quinoa"]
    : ["Chicken breast", "Salmon", "Eggs", "Greek yogurt", "Lean beef", "Tuna"];

  const carbSources = restrictions.includes("gluten_free")
    ? ["Brown rice", "Quinoa", "Sweet potatoes", "Oats (GF)", "Buckwheat", "Potatoes"]
    : ["Brown rice", "Quinoa", "Oats", "Sweet potatoes", "Whole wheat bread", "Pasta"];

  const mealPlan = {
    monday: {
      breakfast: `${carbSources[2]} with ${proteinSources[1]} and berries`,
      lunch: `${proteinSources[0]} with ${carbSources[1]} and roasted vegetables`,
      dinner: `${proteinSources[2]} stir-fry with ${carbSources[0]} and broccoli`,
      snacks: ["Apple with almond butter", "Handful of mixed nuts"],
    },
    tuesday: {
      breakfast: `${proteinSources[1]} smoothie with banana and ${carbSources[2]}`,
      lunch: `${proteinSources[0]} salad with avocado and ${carbSources[1]}`,
      dinner: `Baked ${proteinSources[2]} with ${carbSources[3]} and green beans`,
      snacks: ["Greek yogurt with granola", "Rice cakes with hummus"],
    },
    wednesday: {
      breakfast: "Overnight oats with chia seeds and mixed berries",
      lunch: `${proteinSources[3]} bowl with ${carbSources[0]} and roasted peppers`,
      dinner: `${proteinSources[0]} tacos with ${carbSources[4]} and salsa`,
      snacks: ["Protein shake", "Baby carrots with guacamole"],
    },
    // Remaining days abbreviated for brevity
    thursday: { breakfast: "Whole grain toast with eggs and avocado", lunch: `${proteinSources[2]} wrap with vegetables`, dinner: `${proteinSources[0]} curry with ${carbSources[0]}`, snacks: ["Fruit salad", "Mixed nuts"] },
    friday: { breakfast: "Smoothie bowl with granola and fresh fruit", lunch: "Grain bowl with roasted vegetables", dinner: `Grilled ${proteinSources[2]} with roasted ${carbSources[3]}`, snacks: ["Protein bar", "Celery with nut butter"] },
    saturday: { breakfast: "Veggie omelette with whole grain toast", lunch: `${proteinSources[0]} and ${carbSources[1]} power bowl`, dinner: "Stir-fry with mixed vegetables and tofu or chicken", snacks: ["Dark chocolate", "Mixed berries"] },
    sunday: { breakfast: "Pancakes with protein powder and fruit compote", lunch: "Large salad with grilled protein and quinoa", dinner: "Roast dinner with lean protein and roasted root vegetables", snacks: ["Yogurt parfait", "Popcorn (lightly salted)"] },
  };

  const groceryList = [
    // Proteins
    ...proteinSources.slice(0, 3).map(p => ({ item: p, quantity: "1 lb / week", category: "protein", est_cost_usd: 6.99 })),
    // Carbs
    ...carbSources.slice(0, 3).map(c => ({ item: c, quantity: "2 lbs", category: "carbs", est_cost_usd: 3.49 })),
    // Produce
    { item: "Mixed vegetables", quantity: "3 lbs", category: "produce", est_cost_usd: 8.99 },
    { item: "Berries (mixed)", quantity: "1 lb", category: "produce", est_cost_usd: 5.99 },
    { item: "Bananas", quantity: "1 bunch", category: "produce", est_cost_usd: 1.49 },
    { item: "Avocados", quantity: "4 count", category: "produce", est_cost_usd: 5.99 },
    { item: "Leafy greens", quantity: "1 bag", category: "produce", est_cost_usd: 3.99 },
    // Pantry
    { item: "Olive oil", quantity: "1 bottle", category: "pantry", est_cost_usd: 7.99 },
    { item: "Nuts & seeds", quantity: "1 bag", category: "pantry", est_cost_usd: 8.99 },
    { item: "Beans/lentils", quantity: "2 cans", category: "pantry", est_cost_usd: 3.49 },
  ];

  const estimatedWeeklyCost = Math.min(
    groceryList.reduce((acc, i) => acc + i.est_cost_usd, 0),
    weeklyBudget
  );

  db.prepare(`INSERT INTO sport_nutrition_plans (id,goals,restrictions,budget_weekly_usd,meal_plan,macros,grocery_list,estimated_weekly_cost,fee_usd) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(planId, goals, JSON.stringify(restrictions), weeklyBudget, JSON.stringify(mealPlan), JSON.stringify(macros), JSON.stringify(groceryList), estimatedWeeklyCost, FEE_NUTRITION_PLAN);

  return {
    plan_id: planId,
    goals,
    restrictions,
    meal_plan: mealPlan,
    macros,
    grocery_list: groceryList,
    estimated_weekly_cost_usd: Math.round(estimatedWeeklyCost * 100) / 100,
    weekly_budget_usd: weeklyBudget,
    fee_usd: FEE_NUTRITION_PLAN,
    plan_url: `https://hiveagentiq.com/nutrition-plans/${planId}`,
  };
}
