/**
 * Mobility Operations Service Module
 *
 * Focus: fleet and shared mobility planning utilities.
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
 * Estimate required active vehicles (or drivers) given demand and throughput.
 */
export function mobilityFleetSizing(args = {}) {
  const demandTrips = requireNumber(args.demand_trips ?? 0, "demand_trips");
  const avgTripMinutes = requireNumber(args.avg_trip_minutes ?? 0, "avg_trip_minutes");
  const opsWindowMinutes = requireNumber(args.ops_window_minutes ?? 0, "ops_window_minutes");
  const utilization = requireNumber(args.utilization ?? 0.75, "utilization");

  if (opsWindowMinutes <= 0) throw new Error("ops_window_minutes must be > 0");
  if (avgTripMinutes <= 0) throw new Error("avg_trip_minutes must be > 0");
  if (utilization <= 0 || utilization > 1) throw new Error("utilization must be in (0, 1]");

  const availableMinutesPerVehicle = opsWindowMinutes * utilization;
  const tripsPerVehicle = availableMinutesPerVehicle / avgTripMinutes;

  const requiredVehicles = tripsPerVehicle > 0 ? Math.ceil(demandTrips / tripsPerVehicle) : 0;

  return {
    demand_trips: Math.floor(demandTrips),
    avg_trip_minutes: round2(avgTripMinutes),
    ops_window_minutes: round2(opsWindowMinutes),
    utilization: round2(utilization),
    available_minutes_per_vehicle: round2(availableMinutesPerVehicle),
    trips_per_vehicle: round2(tripsPerVehicle),
    required_active_vehicles: requiredVehicles,
  };
}

/**
 * Estimate driver pay and total cost for an hourly+per-mile model.
 */
export function mobilityDriverPayEstimate(args = {}) {
  const hours = requireNumber(args.hours ?? 0, "hours");
  const miles = requireNumber(args.miles ?? 0, "miles");
  const hourlyRate = requireNumber(args.hourly_rate ?? 0, "hourly_rate");
  const perMileRate = requireNumber(args.per_mile_rate ?? 0, "per_mile_rate");
  const platformFeePct = requireNumber(args.platform_fee_pct ?? 0, "platform_fee_pct");

  if (platformFeePct < 0 || platformFeePct > 1) throw new Error("platform_fee_pct must be in [0, 1]");

  const gross = hours * hourlyRate + miles * perMileRate;
  const fee = gross * platformFeePct;
  const net = gross - fee;

  return {
    hours: round2(hours),
    miles: round2(miles),
    hourly_rate: round2(hourlyRate),
    per_mile_rate: round2(perMileRate),
    platform_fee_pct: round2(platformFeePct),
    gross_pay: round2(gross),
    platform_fee: round2(fee),
    net_pay: round2(net),
  };
}

/**
 * Compute basic rider pricing from cost components.
 */
export function mobilityTripPricing(args = {}) {
  const baseFare = requireNumber(args.base_fare ?? 0, "base_fare");
  const minutes = requireNumber(args.minutes ?? 0, "minutes");
  const miles = requireNumber(args.miles ?? 0, "miles");

  const perMinute = requireNumber(args.per_minute ?? 0, "per_minute");
  const perMile = requireNumber(args.per_mile ?? 0, "per_mile");

  const surge = requireNumber(args.surge_multiplier ?? 1, "surge_multiplier");
  const bookingFee = requireNumber(args.booking_fee ?? 0, "booking_fee");

  if (surge <= 0) throw new Error("surge_multiplier must be > 0");

  const subtotal = baseFare + minutes * perMinute + miles * perMile;
  const surged = subtotal * surge;
  const total = surged + bookingFee;

  return {
    base_fare: round2(baseFare),
    minutes: round2(minutes),
    miles: round2(miles),
    per_minute: round2(perMinute),
    per_mile: round2(perMile),
    surge_multiplier: round2(surge),
    booking_fee: round2(bookingFee),
    subtotal: round2(subtotal),
    surged_subtotal: round2(surged),
    total_fare: round2(total),
  };
}
