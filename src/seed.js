/**
 * Seed the AgentBay marketplace with initial services.
 * Run: node src/seed.js
 */

import * as mkt from "./services/marketplace.js";

console.log("Seeding AgentBay marketplace...\n");

// ─── Register Providers ────────────────────────────

const providers = [
  { name: "WebCrawl Pro", description: "High-performance web data extraction" },
  { name: "DocuMind AI", description: "Document processing and summarization" },
  { name: "PixelForge", description: "AI image generation and manipulation" },
  { name: "LegalLens", description: "Legal document search and analysis" },
  { name: "CodeAudit", description: "Automated code review and security scanning" },
  { name: "MarketPulse", description: "Real-time market data and research" },
  { name: "LinguaFlow", description: "Multi-language translation service" },
  { name: "DataVault", description: "Structured datasets and data enrichment" },
  { name: "SearchSphere", description: "Web search API for agents" },
  { name: "SentimentIQ", description: "Text sentiment and emotion analysis" },
];

const providerRecords = providers.map((p) => {
  const result = mkt.registerProvider(p);
  console.log(`  Provider: ${p.name} → ${result.id}`);
  return { ...p, ...result };
});

// ─── List Services ─────────────────────────────────

const services = [
  // Search & Web
  { provider: 0, name: "Web Search API", description: "Search the web and get structured results. Returns top 10 results with titles, URLs, and snippets.", category: "search", price_usd: 0.002, price_model: "per_request", tags: ["search", "web", "scraping"] },
  { provider: 0, name: "Web Page Reader", description: "Fetch and extract clean text from any URL. Handles JavaScript rendering.", category: "search", price_usd: 0.005, price_model: "per_request", tags: ["web", "extraction", "scraping"] },
  { provider: 8, name: "Deep Web Search", description: "Search across 50+ sources including academic papers, patents, and news archives.", category: "search", price_usd: 0.01, price_model: "per_request", tags: ["search", "academic", "patents"] },

  // AI & ML
  { provider: 1, name: "Document Summarizer", description: "Summarize any document (PDF, DOCX, TXT) into key points. Up to 100 pages.", category: "ai", price_usd: 0.05, price_model: "per_request", tags: ["summarization", "documents", "ai"] },
  { provider: 1, name: "Text Classifier", description: "Classify text into custom categories. Supports up to 50 labels.", category: "ai", price_usd: 0.01, price_model: "per_request", tags: ["classification", "nlp", "ai"] },
  { provider: 9, name: "Sentiment Analysis", description: "Analyze sentiment and emotion in text. Returns scores for positive, negative, neutral, plus 8 emotions.", category: "ai", price_usd: 0.003, price_model: "per_request", tags: ["sentiment", "nlp", "emotions"] },

  // Media
  { provider: 2, name: "Image Generation", description: "Generate images from text descriptions. 1024x1024, multiple styles.", category: "media", price_usd: 0.10, price_model: "per_request", tags: ["image", "generation", "ai"] },
  { provider: 2, name: "Image Upscaler", description: "Upscale images 4x with AI. Maintains quality and adds detail.", category: "media", price_usd: 0.05, price_model: "per_request", tags: ["image", "upscale", "enhancement"] },

  // Legal
  { provider: 3, name: "Legal Filing Lookup", description: "Search SEC filings, court records, and business registrations across all 50 US states.", category: "legal", price_usd: 0.50, price_model: "per_request", tags: ["legal", "filings", "sec", "courts"] },
  { provider: 3, name: "Patent Search", description: "Search USPTO and international patent databases. Returns patent abstracts, claims, and citations.", category: "legal", price_usd: 1.00, price_model: "per_request", tags: ["patents", "ip", "legal"] },
  { provider: 3, name: "Contract Analyzer", description: "Analyze contracts and highlight key terms, risks, and obligations. Upload PDF or paste text.", category: "legal", price_usd: 2.00, price_model: "per_request", tags: ["contracts", "legal", "analysis"] },

  // Code
  { provider: 4, name: "Code Review", description: "Automated code review with security scanning, style checks, and bug detection. Supports 20+ languages.", category: "code", price_usd: 0.50, price_model: "per_request", tags: ["code", "review", "security"] },
  { provider: 4, name: "Dependency Audit", description: "Scan project dependencies for known vulnerabilities and license issues.", category: "code", price_usd: 0.25, price_model: "per_request", tags: ["security", "dependencies", "audit"] },

  // Finance & Data
  { provider: 5, name: "Stock Market Data", description: "Real-time and historical stock data. Price, volume, fundamentals for any ticker.", category: "finance", price_usd: 0.01, price_model: "per_request", tags: ["stocks", "market", "finance"] },
  { provider: 5, name: "Company Research Report", description: "Comprehensive company research including financials, competitors, and market position.", category: "finance", price_usd: 5.00, price_model: "per_request", tags: ["research", "company", "finance"] },
  { provider: 5, name: "Crypto Price Feed", description: "Real-time cryptocurrency prices across 500+ tokens. Includes 24h change and volume.", category: "finance", price_usd: 0.001, price_model: "per_request", tags: ["crypto", "prices", "market"] },

  // Translation
  { provider: 6, name: "Text Translation", description: "Translate text between 100+ languages. Preserves formatting and context.", category: "translation", price_usd: 0.03, price_model: "per_request", tags: ["translation", "languages", "text"] },
  { provider: 6, name: "Document Translation", description: "Translate full documents (PDF, DOCX) while preserving layout. Up to 50 pages.", category: "translation", price_usd: 1.00, price_model: "per_request", tags: ["translation", "documents", "languages"] },

  // Data
  { provider: 7, name: "Company Contact Enrichment", description: "Enrich company data with contacts, emails, phone numbers, and social profiles.", category: "data", price_usd: 0.10, price_model: "per_request", tags: ["data", "enrichment", "contacts"] },
  { provider: 7, name: "Address Verification", description: "Verify and standardize postal addresses worldwide. Returns geocoordinates.", category: "data", price_usd: 0.02, price_model: "per_request", tags: ["data", "address", "verification"] },
  { provider: 7, name: "Email Validation", description: "Validate email addresses — check syntax, MX records, and deliverability.", category: "data", price_usd: 0.005, price_model: "per_request", tags: ["data", "email", "validation"] },

  // Auction-only services (higher value)
  { provider: 5, name: "Market Research Report", description: "Custom market research on any industry or company. Delivered within 24 hours.", category: "finance", price_usd: null, price_model: "auction_only", tags: ["research", "market", "custom"] },
  { provider: 4, name: "Security Penetration Test", description: "Automated security testing of web applications. Full vulnerability report.", category: "code", price_usd: null, price_model: "auction_only", tags: ["security", "pentest", "audit"] },
];

services.forEach((s) => {
  const result = mkt.listService({
    provider_id: providerRecords[s.provider].id,
    name: s.name,
    description: s.description,
    category: s.category,
    price_usd: s.price_usd,
    price_model: s.price_model,
    tags: s.tags,
  });
  const priceStr = s.price_usd ? `$${s.price_usd}` : "auction";
  console.log(`  Service: ${s.name} (${priceStr}) → ${result.id}`);
});

// ─── Summary ───────────────────────────────────────

const stats = mkt.getMarketplaceStats();
console.log(`\n✓ Seeded: ${stats.providers} providers, ${stats.services} services`);
console.log("  Run the server: node src/server.js\n");
