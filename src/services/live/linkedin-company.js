/**
 * Live Service: LinkedIn Company Lookup
 *
 * Purpose:
 * - Provide a structured company profile lookup by LinkedIn company URL or slug.
 * - Return a normalized object useful for sales/BD agents.
 *
 * Notes:
 * - This is implemented as an "open world" browser fetch (no official LinkedIn API).
 * - The implementation uses the existing page-reader live utility to fetch HTML.
 * - If LinkedIn blocks the request, the tool returns a partial result with a helpful error.
 */

import { readPage } from "./page-reader.js";

function normalizeLinkedInCompanyUrl(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Accept full URL or slug (e.g. "openai")
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  const slug = trimmed.replace(/^\/|\/$/g, "");
  return `https://www.linkedin.com/company/${slug}/`;
}

function extractCompanyJsonLd(html) {
  if (!html || typeof html !== "string") return null;

  // LinkedIn often includes JSON-LD blobs.
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of scripts) {
    const raw = (m?.[1] || "").trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const t = item["@type"];
        if (t === "Organization" || t === "Corporation") return item;
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function cleanText(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t || null;
}

export async function lookupLinkedInCompany({ companyUrlOrSlug }) {
  const url = normalizeLinkedInCompanyUrl(companyUrlOrSlug);
  if (!url) {
    return {
      ok: false,
      error: "Missing companyUrlOrSlug. Provide a full LinkedIn company URL or a slug like 'openai'.",
    };
  }

  const { ok, url: finalUrl, html, status, error } = await readPage({ url });

  if (!ok) {
    return {
      ok: false,
      url: finalUrl || url,
      status: status || null,
      error: error || "Failed to fetch LinkedIn page.",
      profile: null,
    };
  }

  const jsonld = extractCompanyJsonLd(html);

  const profile = {
    name: cleanText(jsonld?.name) || null,
    description: cleanText(jsonld?.description) || null,
    url: cleanText(jsonld?.url) || finalUrl || url,
    logo: cleanText(jsonld?.logo?.url || jsonld?.logo) || null,
    sameAs: Array.isArray(jsonld?.sameAs) ? jsonld.sameAs.slice(0, 15) : null,
    address: jsonld?.address
      ? {
          streetAddress: cleanText(jsonld.address.streetAddress) || null,
          addressLocality: cleanText(jsonld.address.addressLocality) || null,
          addressRegion: cleanText(jsonld.address.addressRegion) || null,
          postalCode: cleanText(jsonld.address.postalCode) || null,
          addressCountry: cleanText(jsonld.address.addressCountry) || null,
        }
      : null,
  };

  return {
    ok: true,
    url: finalUrl || url,
    status,
    profile,
    raw: {
      jsonldFound: Boolean(jsonld),
    },
  };
}
