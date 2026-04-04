/**
 * Geocoding — Address to lat/lng via OpenStreetMap Nominatim (free)
 */

export async function geocode(address) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=3&addressdetails=1`,
    { headers: { "User-Agent": "HiveAgent-Geocoder/1.0 (https://hiveagentiq.com)" } }
  );

  if (!res.ok) return { error: `Geocoding failed: HTTP ${res.status}`, provider: "HiveAgent Geocoding" };

  const data = await res.json();
  if (!data.length) return { error: "Address not found", query: address, provider: "HiveAgent Geocoding" };

  return {
    query: address,
    results: data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display_name: r.display_name,
      type: r.type,
      address: r.address || {},
      importance: r.importance,
    })),
    provider: "HiveAgent Geocoding",
  };
}

export async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { "User-Agent": "HiveAgent-Geocoder/1.0 (https://hiveagentiq.com)" } }
  );

  if (!res.ok) return { error: `Reverse geocoding failed: HTTP ${res.status}` };

  const data = await res.json();
  return {
    lat, lng,
    display_name: data.display_name,
    address: data.address || {},
    provider: "HiveAgent Geocoding",
  };
}
