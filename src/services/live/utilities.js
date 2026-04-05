/**
 * Utility Services — IP geolocation, DNS, Whois, hashing, timezone, URL shortener
 */

import { promises as dns } from "dns";
import crypto from "crypto";

// ─── IP Geolocation ──────────────────────────────

export async function ipGeolocate(ip) {
  const res = await fetch(`https://api.ip2location.io/?ip=${ip}`);
  if (!res.ok) {
    // Fallback to ip-api.com
    const fallback = await fetch(`http://ip-api.com/json/${ip}`);
    if (!fallback.ok) return { error: "IP geolocation failed", provider: "HiveAgent IP" };
    const data = await fallback.json();
    return {
      ip, country: data.country, region: data.regionName, city: data.city,
      lat: data.lat, lng: data.lon, isp: data.isp, timezone: data.timezone,
      provider: "HiveAgent IP",
    };
  }
  const data = await res.json();
  return {
    ip, country: data.country_name, region: data.region_name, city: data.city_name,
    lat: data.latitude, lng: data.longitude, zip: data.zip_code,
    timezone: data.time_zone, is_proxy: data.is_proxy,
    provider: "HiveAgent IP",
  };
}

// ─── DNS Lookup ──────────────────────────────────

export async function dnsLookup(domain, recordType = "A") {
  const results = {};
  const types = recordType === "ALL" ? ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"] : [recordType.toUpperCase()];

  for (const type of types) {
    try {
      switch (type) {
        case "A": results[type] = await dns.resolve4(domain); break;
        case "AAAA": results[type] = await dns.resolve6(domain); break;
        case "MX": results[type] = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority); break;
        case "NS": results[type] = await dns.resolveNs(domain); break;
        case "TXT": results[type] = (await dns.resolveTxt(domain)).map(r => r.join("")); break;
        case "CNAME": results[type] = await dns.resolveCname(domain); break;
        case "SOA": results[type] = await dns.resolveSoa(domain); break;
      }
    } catch (e) {
      results[type] = { error: e.code || e.message };
    }
  }

  return { domain, records: results, provider: "HiveAgent DNS" };
}

// ─── Whois (via RDAP) ────────────────────────────

export async function whoisLookup(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { "Accept": "application/rdap+json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `RDAP lookup failed for ${domain}`, provider: "HiveAgent Whois" };
    const data = await res.json();

    const registrar = data.entities?.find(e => e.roles?.includes("registrar"));
    const registrant = data.entities?.find(e => e.roles?.includes("registrant"));

    return {
      domain: data.ldhName,
      status: data.status,
      registrar: registrar?.vcardArray?.[1]?.find(v => v[0] === "fn")?.[3] || registrar?.handle || "Unknown",
      created: data.events?.find(e => e.eventAction === "registration")?.eventDate,
      expires: data.events?.find(e => e.eventAction === "expiration")?.eventDate,
      updated: data.events?.find(e => e.eventAction === "last changed")?.eventDate,
      nameservers: data.nameservers?.map(ns => ns.ldhName) || [],
      provider: "HiveAgent Whois",
    };
  } catch (e) {
    return { error: e.message, domain, provider: "HiveAgent Whois" };
  }
}

// ─── Hash Generator ──────────────────────────────

export function generateHash(text, algorithm = "sha256") {
  const algos = ["md5", "sha1", "sha256", "sha512"];
  if (algorithm === "all") {
    const hashes = {};
    for (const a of algos) hashes[a] = crypto.createHash(a).update(text).digest("hex");
    return { input_length: text.length, hashes, provider: "HiveAgent Hash" };
  }

  if (!algos.includes(algorithm)) return { error: `Unsupported algorithm. Use: ${algos.join(", ")}`, provider: "HiveAgent Hash" };
  return {
    algorithm, hash: crypto.createHash(algorithm).update(text).digest("hex"),
    input_length: text.length, provider: "HiveAgent Hash",
  };
}

// ─── Timezone Converter ──────────────────────────

export function convertTimezone(datetime, fromTz, toTz) {
  try {
    const date = new Date(datetime);
    if (isNaN(date)) return { error: "Invalid datetime format. Use ISO 8601 (e.g., 2026-04-05T12:00:00)", provider: "HiveAgent Timezone" };

    const fromTime = date.toLocaleString("en-US", { timeZone: fromTz, dateStyle: "full", timeStyle: "long" });
    const toTime = date.toLocaleString("en-US", { timeZone: toTz, dateStyle: "full", timeStyle: "long" });

    return {
      input: datetime,
      from: { timezone: fromTz, datetime: fromTime },
      to: { timezone: toTz, datetime: toTime },
      provider: "HiveAgent Timezone",
    };
  } catch (e) {
    return { error: `Invalid timezone: ${e.message}`, provider: "HiveAgent Timezone" };
  }
}

// ─── Wikipedia Summary ───────────────────────────

export async function wikipediaSummary(topic) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`,
    { headers: { "User-Agent": "HiveAgent-Wiki/1.0" } }
  );
  if (!res.ok) return { error: `Wikipedia article not found: ${topic}`, provider: "HiveAgent Wikipedia" };
  const data = await res.json();

  return {
    title: data.title,
    summary: data.extract,
    url: data.content_urls?.desktop?.page,
    thumbnail: data.thumbnail?.source,
    description: data.description,
    provider: "HiveAgent Wikipedia",
  };
}

// ─── RSS Feed Parser ─────────────────────────────

export async function parseRSSFeed(feedUrl) {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "HiveAgent-RSS/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `Failed to fetch feed: HTTP ${res.status}`, provider: "HiveAgent RSS" };
    const xml = await res.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const link = item.match(/<link[^>]*>(.*?)<\/link>/)?.[1]?.trim();
      const desc = item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]
        ?.replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
      if (title) items.push({ title, url: link, description: desc, published: pubDate });
    }

    return { feed_url: feedUrl, items: items.slice(0, 20), total: items.length, provider: "HiveAgent RSS" };
  } catch (e) {
    return { error: e.message, provider: "HiveAgent RSS" };
  }
}
