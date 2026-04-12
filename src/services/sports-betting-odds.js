/**
 * Sports Betting Odds Service Module
 *
 * Untapped vertical: sports odds formatting and bet slip sanity checks.
 * No live odds fetching; purely transforms and computes implied probability.
 */

function round(n, places = 4) {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

function americanToDecimal(american) {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0) throw new Error("Invalid American odds");
  if (a > 0) return 1 + a / 100;
  return 1 + 100 / Math.abs(a);
}

function decimalToAmerican(decimal) {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 1) throw new Error("Invalid decimal odds");
  if (d >= 2) return Math.round((d - 1) * 100);
  return -Math.round(100 / (d - 1));
}

function impliedProbFromDecimal(decimal) {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 1) throw new Error("Invalid decimal odds");
  return 1 / d;
}

export function oddsConvert(args = {}) {
  const format = (args.format || "american").toLowerCase();
  const value = args.value;

  let dec;
  if (format === "american") dec = americanToDecimal(value);
  else if (format === "decimal") dec = Number(value);
  else throw new Error("format must be american or decimal");

  if (!Number.isFinite(dec) || dec <= 1) throw new Error("Invalid odds value");

  const prob = impliedProbFromDecimal(dec);

  return {
    input: { format, value },
    decimal: round(dec, 6),
    american: decimalToAmerican(dec),
    implied_probability: round(prob, 6),
    implied_probability_pct: round(prob * 100, 2),
  };
}

export function oddsParlay(args = {}) {
  const legs = Array.isArray(args.legs) ? args.legs : [];
  if (!legs.length) throw new Error("legs is required");

  const normalized = legs.map((l) => {
    const format = (l.format || "american").toLowerCase();
    let dec;
    if (format === "american") dec = americanToDecimal(l.value);
    else if (format === "decimal") dec = Number(l.value);
    else throw new Error("Each leg format must be american or decimal");

    if (!Number.isFinite(dec) || dec <= 1) throw new Error("Invalid leg odds");
    return {
      name: (l.name || "leg").toString(),
      format,
      value: l.value,
      decimal: dec,
      implied_probability: impliedProbFromDecimal(dec),
    };
  });

  const parlayDecimal = normalized.reduce((acc, l) => acc * l.decimal, 1);
  const parlayProb = normalized.reduce((acc, l) => acc * l.implied_probability, 1);

  return {
    legs: normalized.map((l) => ({
      name: l.name,
      input: { format: l.format, value: l.value },
      decimal: round(l.decimal, 6),
      implied_probability: round(l.implied_probability, 6),
    })),
    parlay: {
      decimal: round(parlayDecimal, 6),
      american: decimalToAmerican(parlayDecimal),
      implied_probability: round(parlayProb, 8),
      implied_probability_pct: round(parlayProb * 100, 4),
    },
    notes: [
      "Implied probability assumes independence between legs.",
      "This tool does not assess edge, limits, or market quality.",
    ],
  };
}

export function oddsBetSlipCheck(args = {}) {
  const stake = Number(args.stake);
  const format = (args.format || "american").toLowerCase();
  const odds = args.odds;

  if (!Number.isFinite(stake) || stake <= 0) throw new Error("stake must be a positive number");

  let dec;
  if (format === "american") dec = americanToDecimal(odds);
  else if (format === "decimal") dec = Number(odds);
  else throw new Error("format must be american or decimal");

  if (!Number.isFinite(dec) || dec <= 1) throw new Error("Invalid odds");

  const potentialPayout = stake * dec;
  const profit = potentialPayout - stake;

  return {
    stake: round(stake, 2),
    odds: { format, value: odds, decimal: round(dec, 6) },
    potential_payout: round(potentialPayout, 2),
    profit: round(profit, 2),
    implied_probability_pct: round(impliedProbFromDecimal(dec) * 100, 2),
    reminders: [
      "Verify selection, market (spread/total/moneyline), and event start time.",
      "Check local laws and platform rules before placing bets.",
    ],
  };
}
