/**
 * Weather — Real-time and forecast via Open-Meteo (free, no key)
 */

export async function getWeather(location) {
  // First geocode the location
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
  );
  const geoData = await geoRes.json();
  if (!geoData.results?.length) return { error: `Location not found: ${location}`, provider: "HiveAgent Weather" };

  const { latitude, longitude, name, country } = geoData.results[0];

  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=5`
  );
  const wx = await wxRes.json();

  const weatherCodes = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
    55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Slight showers",
    81: "Moderate showers", 82: "Violent showers", 95: "Thunderstorm",
  };

  return {
    location: `${name}, ${country}`,
    coordinates: { lat: latitude, lng: longitude },
    current: {
      temperature_c: wx.current.temperature_2m,
      temperature_f: Math.round(wx.current.temperature_2m * 9/5 + 32),
      humidity_pct: wx.current.relative_humidity_2m,
      wind_speed_kmh: wx.current.wind_speed_10m,
      condition: weatherCodes[wx.current.weather_code] || "Unknown",
    },
    forecast: wx.daily.time.map((date, i) => ({
      date,
      high_c: wx.daily.temperature_2m_max[i],
      low_c: wx.daily.temperature_2m_min[i],
      high_f: Math.round(wx.daily.temperature_2m_max[i] * 9/5 + 32),
      low_f: Math.round(wx.daily.temperature_2m_min[i] * 9/5 + 32),
      precipitation_mm: wx.daily.precipitation_sum[i],
      condition: weatherCodes[wx.daily.weather_code[i]] || "Unknown",
    })),
    provider: "HiveAgent Weather",
  };
}
