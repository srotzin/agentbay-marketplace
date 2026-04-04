/**
 * Crypto Prices — Real-time via CoinGecko free API
 */

export async function getCryptoPrice(coinId = "bitcoin") {
  const id = coinId.toLowerCase().replace(/\s+/g, '-');
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,eur,btc&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
    { headers: { "User-Agent": "HiveAgent-CryptoPrices/1.0" } }
  );

  if (!res.ok) return { error: `CoinGecko API error: HTTP ${res.status}`, provider: "HiveAgent CryptoPrices" };

  const data = await res.json();
  if (!data[id]) return { error: `Coin not found: ${coinId}. Try: bitcoin, ethereum, solana, dogecoin`, provider: "HiveAgent CryptoPrices" };

  const coin = data[id];
  return {
    coin: coinId,
    price_usd: coin.usd,
    price_eur: coin.eur,
    price_btc: coin.btc,
    change_24h_pct: coin.usd_24h_change ? Math.round(coin.usd_24h_change * 100) / 100 : null,
    market_cap_usd: coin.usd_market_cap,
    volume_24h_usd: coin.usd_24h_vol,
    provider: "HiveAgent CryptoPrices",
  };
}

export async function getTopCryptos(limit = 10) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
    { headers: { "User-Agent": "HiveAgent-CryptoPrices/1.0" } }
  );

  if (!res.ok) return { error: `CoinGecko API error: HTTP ${res.status}`, provider: "HiveAgent CryptoPrices" };

  const data = await res.json();
  return {
    coins: data.map(c => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price_usd: c.current_price,
      change_24h_pct: Math.round(c.price_change_percentage_24h * 100) / 100,
      market_cap_usd: c.market_cap,
      volume_24h_usd: c.total_volume,
      rank: c.market_cap_rank,
    })),
    provider: "HiveAgent CryptoPrices",
  };
}
