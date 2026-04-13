/**
 * Restaurant Operations Service Module
 *
 * Focus: practical, lightweight utilities restaurant operators and hospitality teams need.
 */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function requireNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}: expected a number`);
  return n;
}

/**
 * Compute a par sheet (prep list) given on-hand inventory and forecast.
 */
export function restaurantParSheet(args = {}) {
  const days = requireNumber(args.days ?? 1, "days");
  const wasteBufferPct = requireNumber(args.waste_buffer_pct ?? 0.05, "waste_buffer_pct");

  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error("items is required");

  const rows = items.map((it) => {
    const name = String(it.name ?? "").trim();
    if (!name) throw new Error("Each item needs a name");

    const unit = String(it.unit ?? "unit");
    const onHand = requireNumber(it.on_hand ?? 0, `${name}.on_hand`);
    const daily = requireNumber(it.daily_usage_forecast ?? 0, `${name}.daily_usage_forecast`);
    const incoming = requireNumber(it.incoming ?? 0, `${name}.incoming`);

    const target = daily * days * (1 + wasteBufferPct);
    const needed = Math.max(0, target - onHand - incoming);

    return {
      name,
      unit,
      on_hand: round2(onHand),
      incoming: round2(incoming),
      daily_usage_forecast: round2(daily),
      days,
      waste_buffer_pct: round2(wasteBufferPct),
      target_par: round2(target),
      suggested_prep_or_order: round2(needed),
    };
  });

  return {
    days,
    waste_buffer_pct: round2(wasteBufferPct),
    items: rows,
  };
}

/**
 * Build a staff schedule skeleton from forecasted demand.
 */
export function restaurantShiftPlanner(args = {}) {
  const dayParts = Array.isArray(args.day_parts) ? args.day_parts : [];
  if (!dayParts.length) throw new Error("day_parts is required");

  const roles = Array.isArray(args.roles) ? args.roles : [];
  if (!roles.length) throw new Error("roles is required");

  const plans = dayParts.map((p) => {
    const name = String(p.name ?? "").trim();
    if (!name) throw new Error("Each day part needs a name");

    const start = String(p.start ?? "").trim();
    const end = String(p.end ?? "").trim();
    const covers = requireNumber(p.covers_forecast ?? 0, `${name}.covers_forecast`);
    const coverBufferPct = requireNumber(p.cover_buffer_pct ?? 0.1, `${name}.cover_buffer_pct`);

    const targetCovers = covers * (1 + coverBufferPct);

    const staffing = roles.map((r) => {
      const role = String(r.role ?? "").trim();
      if (!role) throw new Error("Each role needs role");

      const coversPerStaff = requireNumber(r.covers_per_staff ?? 0, `${role}.covers_per_staff`);
      if (coversPerStaff <= 0) throw new Error(`${role}.covers_per_staff must be > 0`);

      const minStaff = requireNumber(r.min_staff ?? 0, `${role}.min_staff`);

      const needed = Math.max(minStaff, Math.ceil(targetCovers / coversPerStaff));

      return {
        role,
        covers_per_staff: round2(coversPerStaff),
        min_staff: Math.max(0, Math.floor(minStaff)),
        staff_needed: needed,
      };
    });

    return {
      day_part: name,
      start,
      end,
      covers_forecast: round2(covers),
      cover_buffer_pct: round2(coverBufferPct),
      target_covers: round2(targetCovers),
      staffing,
    };
  });

  return {
    day_parts: plans,
  };
}

/**
 * Compute menu item economics from ingredient cost, price, and estimated labor.
 */
export function restaurantMenuEngineering(args = {}) {
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error("items is required");

  const rows = items.map((it) => {
    const name = String(it.name ?? "").trim();
    if (!name) throw new Error("Each item needs a name");

    const price = requireNumber(it.price ?? 0, `${name}.price`);
    const ingredientCost = requireNumber(it.ingredient_cost ?? 0, `${name}.ingredient_cost`);
    const laborMin = requireNumber(it.labor_minutes ?? 0, `${name}.labor_minutes`);
    const laborRate = requireNumber(it.labor_rate_per_hour ?? 0, `${name}.labor_rate_per_hour`);

    const laborCost = (laborMin / 60) * laborRate;
    const totalCost = ingredientCost + laborCost;
    const grossProfit = price - totalCost;
    const foodCostPct = price > 0 ? ingredientCost / price : 0;

    return {
      name,
      price: round2(price),
      ingredient_cost: round2(ingredientCost),
      labor_minutes: round2(laborMin),
      labor_rate_per_hour: round2(laborRate),
      labor_cost: round2(laborCost),
      total_cost: round2(totalCost),
      gross_profit: round2(grossProfit),
      food_cost_pct: round2(foodCostPct),
    };
  });

  return {
    items: rows,
  };
}
