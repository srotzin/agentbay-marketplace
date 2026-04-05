/**
 * Finance — Stock quotes + Currency exchange rates
 */

// Stock quotes via Yahoo Finance public endpoint
export async function getStockQuote(symbol) {
  const s = symbol.toUpperCase();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=5d`,
      { headers: { "User-Agent": "HiveAgent-Finance/1.0" } }
    );
    if (!res.ok) return { error: `Stock not found: ${s}`, provider: "HiveAgent Finance" };
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return { error: `No data for ${s}`, provider: "HiveAgent Finance" };

    const prev = meta.chartPreviousClose || meta.previousClose;
    const price = meta.regularMarketPrice;
    const change = price - prev;
    const changePct = (change / prev) * 100;

    return {
      symbol: s,
      price: Math.round(price * 100) / 100,
      previous_close: Math.round(prev * 100) / 100,
      change: Math.round(change * 100) / 100,
      change_pct: Math.round(changePct * 100) / 100,
      currency: meta.currency,
      exchange: meta.exchangeName,
      market_state: meta.marketState,
      provider: "HiveAgent Finance",
    };
  } catch (e) {
    return { error: e.message, provider: "HiveAgent Finance" };
  }
}

// Currency exchange via open API
export async function getExchangeRate(from = "USD", to = "EUR") {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
    if (!res.ok) return { error: `Exchange rate API error`, provider: "HiveAgent Finance" };
    const data = await res.json();

    const toUpper = to.toUpperCase();
    if (!data.rates?.[toUpper]) return { error: `Currency not found: ${toUpper}`, provider: "HiveAgent Finance" };

    return {
      from: from.toUpperCase(),
      to: toUpper,
      rate: data.rates[toUpper],
      inverse: Math.round((1 / data.rates[toUpper]) * 10000) / 10000,
      last_updated: data.time_last_update_utc,
      provider: "HiveAgent Finance",
    };
  } catch (e) {
    return { error: e.message, provider: "HiveAgent Finance" };
  }
}

// Multiple exchange rates at once
export async function getExchangeRates(base = "USD", targets = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"]) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`);
    if (!res.ok) return { error: `Exchange rate API error`, provider: "HiveAgent Finance" };
    const data = await res.json();

    const rates = {};
    for (const t of targets) {
      const upper = t.toUpperCase();
      if (data.rates?.[upper]) rates[upper] = data.rates[upper];
    }

    return { base: base.toUpperCase(), rates, last_updated: data.time_last_update_utc, provider: "HiveAgent Finance" };
  } catch (e) {
    return { error: e.message, provider: "HiveAgent Finance" };
  }
}
