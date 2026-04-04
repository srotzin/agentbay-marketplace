/**
 * HiveIQ Expanded Seed — 50+ services across all 9 departments
 * Run: node src/seed-expanded.js
 */

import * as mkt from "./services/marketplace.js";
import db from "./db.js";

// Clear existing data for clean reseed
db.exec("DELETE FROM transactions; DELETE FROM bids; DELETE FROM auctions; DELETE FROM services; DELETE FROM providers; DELETE FROM agents;");

console.log("Seeding HiveIQ marketplace — full catalog...\n");

const providers = [
  // Digital Services
  { name: "WebCrawl Pro", description: "High-performance web data extraction and monitoring" },
  { name: "DocuMind AI", description: "Document processing, summarization, and classification" },
  { name: "PixelForge", description: "AI image and video generation" },
  { name: "LinguaFlow", description: "Translation and localization services" },
  { name: "CodeAudit", description: "Code review, security scanning, and DevOps" },
  // Data & Intelligence
  { name: "MarketPulse", description: "Real-time market data and financial intelligence" },
  { name: "DataVault", description: "Structured datasets, enrichment, and verification" },
  { name: "SearchSphere", description: "Web and deep search APIs" },
  { name: "GeoIntel", description: "Geospatial data, mapping, and property intelligence" },
  { name: "NewsWire AI", description: "Real-time news feeds and media monitoring" },
  // Legal & Compliance
  { name: "LegalLens", description: "Legal research, filing lookup, and document analysis" },
  { name: "PatentScope", description: "IP search, trademark monitoring, and prior art analysis" },
  { name: "ComplianceIQ", description: "KYC/AML, sanctions screening, and regulatory compliance" },
  // Financial Services
  { name: "PayRails", description: "Payment processing, invoicing, and cross-border transfers" },
  { name: "LendLogic", description: "Credit checks, loan origination, and underwriting" },
  { name: "InsureBot", description: "Insurance quotes, claims, and risk assessment" },
  // Communication
  { name: "MessageHub", description: "Email, SMS, and messaging APIs" },
  { name: "VoiceStream", description: "Phone calls, IVR, and voice transcription" },
  // Commerce & Logistics
  { name: "ShipSmart", description: "Shipping rates, labels, and tracking" },
  { name: "BookingEngine", description: "Travel, restaurant, and appointment booking" },
  { name: "ProcureNet", description: "Supplier discovery and procurement automation" },
  // Infrastructure
  { name: "CloudForge", description: "GPU rental, serverless compute, and hosting" },
  { name: "VaultStore", description: "File hosting, CDN, and backup services" },
  { name: "AgentID", description: "Agent identity verification, reputation, and trust scoring" },
  // Physical World
  { name: "DroneOps", description: "Drone photography, delivery, and inspection" },
  { name: "MakerSpace", description: "3D printing, prototyping, and on-demand manufacturing" },
  // Human Services
  { name: "ResearchPro", description: "Custom market research and competitive analysis" },
  { name: "ContentForge", description: "Technical writing, copywriting, and editing" },
  { name: "DesignStudio", description: "UI/UX design, brand identity, and presentations" },
  { name: "AdvisoryIQ", description: "Legal, financial, and technical consulting" },
];

const providerRecords = providers.map((p) => {
  const result = mkt.registerProvider(p);
  return { ...p, ...result };
});

// Helper: get provider by index
const p = (i) => providerRecords[i].id;

const services = [
  // ═══ DIGITAL SERVICES ═══════════════════════════════
  // Search & Web
  { pid: p(0), name: "Web Search API", desc: "Search the web, get structured results with titles, URLs, snippets. Top 10 results.", cat: "search", price: 0.002, tags: ["search", "web"] },
  { pid: p(0), name: "Web Page Reader", desc: "Fetch and extract clean text from any URL. Handles JavaScript rendering.", cat: "search", price: 0.005, tags: ["web", "extraction"] },
  { pid: p(7), name: "Deep Web Search", desc: "Search 50+ sources including academic papers, patents, news archives, and government databases.", cat: "search", price: 0.01, tags: ["search", "academic", "deep"] },
  { pid: p(0), name: "Site Monitoring", desc: "Monitor any website for changes. Get notified when content updates.", cat: "search", price: 0.10, tags: ["monitoring", "web", "alerts"], model: "per_request" },
  { pid: p(7), name: "SERP Tracker", desc: "Track search engine rankings for any keyword across Google, Bing, and DuckDuckGo.", cat: "search", price: 0.05, tags: ["seo", "rankings", "search"] },

  // AI & ML
  { pid: p(1), name: "Document Summarizer", desc: "Summarize any document (PDF, DOCX, TXT) into key points. Up to 100 pages.", cat: "ai", price: 0.05, tags: ["summarization", "documents"] },
  { pid: p(1), name: "Text Classifier", desc: "Classify text into custom categories. Supports up to 50 labels.", cat: "ai", price: 0.01, tags: ["classification", "nlp"] },
  { pid: p(1), name: "Entity Extraction", desc: "Extract names, dates, companies, locations, and custom entities from text.", cat: "ai", price: 0.02, tags: ["ner", "extraction", "nlp"] },
  { pid: p(1), name: "Sentiment Analysis", desc: "Analyze sentiment and emotion. Scores for positive/negative/neutral plus 8 emotions.", cat: "ai", price: 0.003, tags: ["sentiment", "emotions"] },
  { pid: p(1), name: "Embeddings API", desc: "Generate text embeddings for semantic search, clustering, and similarity. 1536 dimensions.", cat: "ai", price: 0.001, tags: ["embeddings", "vectors", "search"] },

  // Code & Dev
  { pid: p(4), name: "Code Review", desc: "Automated code review with security scanning, style checks, and bug detection. 20+ languages.", cat: "code", price: 0.50, tags: ["code", "review", "security"] },
  { pid: p(4), name: "Dependency Audit", desc: "Scan dependencies for vulnerabilities and license issues.", cat: "code", price: 0.25, tags: ["security", "dependencies"] },
  { pid: p(4), name: "Unit Test Generator", desc: "Generate unit tests for any function. Supports Python, JS, Go, Rust.", cat: "code", price: 0.30, tags: ["testing", "code", "automation"] },
  { pid: p(4), name: "API Endpoint Tester", desc: "Test REST/GraphQL endpoints. Validates responses, checks latency, finds errors.", cat: "code", price: 0.10, tags: ["api", "testing", "qa"] },

  // Media & Creative
  { pid: p(2), name: "Image Generation", desc: "Generate images from text descriptions. 1024x1024, multiple styles.", cat: "media", price: 0.10, tags: ["image", "generation"] },
  { pid: p(2), name: "Image Upscaler", desc: "Upscale images 4x with AI. Maintains quality and adds detail.", cat: "media", price: 0.05, tags: ["image", "upscale"] },
  { pid: p(2), name: "Video Generation", desc: "Generate short video clips (5-15s) from text descriptions.", cat: "media", price: 0.50, tags: ["video", "generation"] },
  { pid: p(2), name: "Audio Transcription", desc: "Transcribe audio/video to text. Speaker diarization. 100+ languages.", cat: "media", price: 0.06, tags: ["transcription", "audio", "speech"] },

  // Translation
  { pid: p(3), name: "Text Translation", desc: "Translate text between 100+ languages. Preserves formatting and context.", cat: "translation", price: 0.03, tags: ["translation", "languages"] },
  { pid: p(3), name: "Document Translation", desc: "Translate full documents (PDF, DOCX) while preserving layout. Up to 50 pages.", cat: "translation", price: 1.00, tags: ["translation", "documents"] },
  { pid: p(3), name: "Language Detection", desc: "Detect the language of any text. Returns top 3 with confidence scores.", cat: "translation", price: 0.001, tags: ["language", "detection"] },
  { pid: p(3), name: "OCR + Translation", desc: "Extract text from images and translate. Supports 50+ languages.", cat: "translation", price: 0.10, tags: ["ocr", "translation", "images"] },

  // ═══ DATA & INTELLIGENCE ═══════════════════════════
  { pid: p(5), name: "Stock Market Data", desc: "Real-time and historical stock data. Price, volume, fundamentals for any ticker.", cat: "finance", price: 0.01, tags: ["stocks", "market"] },
  { pid: p(5), name: "Crypto Price Feed", desc: "Real-time crypto prices across 500+ tokens. 24h change and volume.", cat: "finance", price: 0.001, tags: ["crypto", "prices"] },
  { pid: p(5), name: "Company Financials", desc: "Revenue, earnings, balance sheet, cash flow for any public company.", cat: "finance", price: 0.50, tags: ["financials", "company"] },
  { pid: p(5), name: "Company Research Report", desc: "Comprehensive company research: financials, competitors, market position.", cat: "finance", price: 5.00, tags: ["research", "company"] },
  { pid: p(6), name: "Contact Enrichment", desc: "Enrich company data with contacts, emails, phones, social profiles.", cat: "data", price: 0.10, tags: ["data", "enrichment", "contacts"] },
  { pid: p(6), name: "Email Validation", desc: "Validate emails — syntax, MX records, deliverability.", cat: "data", price: 0.005, tags: ["email", "validation"] },
  { pid: p(6), name: "Address Verification", desc: "Verify and standardize postal addresses worldwide. Returns geocoordinates.", cat: "data", price: 0.02, tags: ["address", "verification"] },
  { pid: p(8), name: "Geocoding API", desc: "Convert addresses to lat/lng and reverse. Worldwide coverage.", cat: "data", price: 0.005, tags: ["geocoding", "maps"] },
  { pid: p(8), name: "Property Data Lookup", desc: "Property records, ownership, valuations, zoning for any US address.", cat: "data", price: 0.25, tags: ["property", "real-estate"] },
  { pid: p(9), name: "Real-Time News Feed", desc: "Breaking news from 50,000+ sources. Filter by topic, region, language.", cat: "data", price: 0.01, tags: ["news", "real-time"] },
  { pid: p(9), name: "Media Monitoring", desc: "Track brand mentions across news, social media, and forums.", cat: "data", price: 0.05, tags: ["media", "monitoring", "brand"] },

  // ═══ LEGAL & COMPLIANCE ═══════════════════════════
  { pid: p(10), name: "Legal Filing Lookup", desc: "Search SEC filings, court records, business registrations across all 50 US states.", cat: "legal", price: 0.50, tags: ["legal", "filings"] },
  { pid: p(11), name: "Patent Search", desc: "Search USPTO and international patent databases. Abstracts, claims, citations.", cat: "legal", price: 1.00, tags: ["patents", "ip"] },
  { pid: p(10), name: "Contract Analyzer", desc: "Analyze contracts, highlight key terms, risks, obligations. Upload PDF or text.", cat: "legal", price: 2.00, tags: ["contracts", "analysis"] },
  { pid: p(11), name: "Trademark Monitor", desc: "Monitor trademark filings that may conflict with yours. Weekly alerts.", cat: "legal", price: 5.00, tags: ["trademark", "monitoring"], model: "per_request" },
  { pid: p(12), name: "KYC/AML Check", desc: "Identity verification, sanctions screening, PEP checks for individuals and businesses.", cat: "compliance", price: 1.50, tags: ["kyc", "aml", "compliance"] },
  { pid: p(12), name: "License Verification", desc: "Verify professional licenses (medical, legal, financial) across all US states.", cat: "compliance", price: 0.75, tags: ["license", "verification"] },

  // ═══ FINANCIAL SERVICES ═══════════════════════════
  { pid: p(13), name: "Invoice Generator", desc: "Generate professional invoices. PDF output with payment links.", cat: "finance", price: 0.10, tags: ["invoice", "billing"] },
  { pid: p(13), name: "Cross-Border Transfer", desc: "Send money internationally via USDC. 150+ countries. Sub-cent fees.", cat: "finance", price: 0.50, tags: ["payments", "international"] },
  { pid: p(14), name: "Credit Check", desc: "Run credit checks on individuals or businesses. FICO scores and history.", cat: "finance", price: 3.00, tags: ["credit", "lending"] },
  { pid: p(15), name: "Insurance Quote", desc: "Get insurance quotes from 20+ providers. Auto, home, business, health.", cat: "finance", price: 0.25, tags: ["insurance", "quotes"] },

  // ═══ COMMUNICATION ═══════════════════════════════
  { pid: p(16), name: "Send Email", desc: "Send transactional or marketing emails. Templates, tracking, deliverability.", cat: "communication", price: 0.003, tags: ["email", "send"] },
  { pid: p(16), name: "Send SMS", desc: "Send SMS to 200+ countries. Delivery confirmation. Unicode support.", cat: "communication", price: 0.02, tags: ["sms", "messaging"] },
  { pid: p(17), name: "Phone Call API", desc: "Make outbound phone calls. TTS or recorded audio. Call recording available.", cat: "communication", price: 0.10, tags: ["phone", "voice", "calls"] },
  { pid: p(17), name: "Voicemail Transcription", desc: "Transcribe voicemail messages to text. Speaker identification.", cat: "communication", price: 0.05, tags: ["voicemail", "transcription"] },
  { pid: p(16), name: "Webhook Relay", desc: "Forward webhooks to any endpoint. Retry logic, logging, transformation.", cat: "communication", price: 0.001, tags: ["webhooks", "notifications"] },

  // ═══ COMMERCE & LOGISTICS ═══════════════════════
  { pid: p(18), name: "Shipping Rate Compare", desc: "Compare shipping rates across UPS, FedEx, USPS, DHL. Best price finder.", cat: "logistics", price: 0.05, tags: ["shipping", "rates"] },
  { pid: p(18), name: "Label Generator", desc: "Generate shipping labels for any carrier. Print-ready PDF.", cat: "logistics", price: 0.15, tags: ["shipping", "labels"] },
  { pid: p(18), name: "Package Tracker", desc: "Track any package across all major carriers. Real-time status updates.", cat: "logistics", price: 0.02, tags: ["tracking", "shipping"] },
  { pid: p(19), name: "Flight Search", desc: "Search flights across 500+ airlines. Prices, schedules, seat availability.", cat: "logistics", price: 0.10, tags: ["travel", "flights"] },
  { pid: p(19), name: "Hotel Search", desc: "Search hotels worldwide. Prices, availability, reviews, photos.", cat: "logistics", price: 0.10, tags: ["travel", "hotels"] },
  { pid: p(19), name: "Restaurant Booking", desc: "Find and book restaurants. Availability, cuisine, ratings.", cat: "logistics", price: 0.05, tags: ["booking", "restaurants"] },
  { pid: p(20), name: "Supplier Discovery", desc: "Find B2B suppliers for any product or material. Verified manufacturers.", cat: "logistics", price: 0.50, tags: ["procurement", "suppliers"] },

  // ═══ INFRASTRUCTURE ══════════════════════════════
  { pid: p(21), name: "GPU Compute (Hourly)", desc: "Rent GPU compute. A100, H100 available. Per-hour billing.", cat: "infrastructure", price: 2.50, tags: ["gpu", "compute"] },
  { pid: p(21), name: "Serverless Function", desc: "Run code on demand. Node.js, Python, Go. Pay per invocation.", cat: "infrastructure", price: 0.001, tags: ["serverless", "compute"] },
  { pid: p(22), name: "File Hosting", desc: "Upload and host files. CDN delivery. Permanent URLs.", cat: "infrastructure", price: 0.01, tags: ["storage", "hosting", "cdn"] },
  { pid: p(23), name: "Agent Identity (KYA)", desc: "Verify agent identity. Trust scoring based on on-chain history and reputation.", cat: "infrastructure", price: 0.25, tags: ["identity", "kya", "trust"] },
  { pid: p(23), name: "Reputation Score", desc: "Get reputation score for any agent or provider. Based on transaction history.", cat: "infrastructure", price: 0.05, tags: ["reputation", "trust"] },

  // ═══ PHYSICAL WORLD ══════════════════════════════
  { pid: p(24), name: "Aerial Photography", desc: "Drone aerial photography for any US location. 4K imagery delivered in 48h.", cat: "physical", price: 50.00, tags: ["drone", "photography"], model: "auction_only" },
  { pid: p(25), name: "3D Print Service", desc: "3D print any STL file. PLA, ABS, resin. Ships in 3-5 days.", cat: "physical", price: null, tags: ["3d-printing", "manufacturing"], model: "auction_only" },
  { pid: p(25), name: "Prototype Manufacturing", desc: "Custom prototype from CAD files. CNC, injection molding, sheet metal.", cat: "physical", price: null, tags: ["prototype", "manufacturing"], model: "auction_only" },

  // ═══ HUMAN SERVICES (Auction-native) ═════════════
  { pid: p(26), name: "Custom Market Research", desc: "In-depth market research on any industry. 10-20 page report. 24-48h delivery.", cat: "human", price: null, tags: ["research", "market"], model: "auction_only" },
  { pid: p(26), name: "Competitive Analysis", desc: "Detailed competitive analysis with market positioning. 5-10 competitors.", cat: "human", price: null, tags: ["research", "competitive"], model: "auction_only" },
  { pid: p(27), name: "Technical Writing", desc: "Technical documentation, API docs, user guides. Expert writers.", cat: "human", price: null, tags: ["writing", "technical"], model: "auction_only" },
  { pid: p(27), name: "Copywriting", desc: "Marketing copy, landing pages, email campaigns. Brand-voice aligned.", cat: "human", price: null, tags: ["writing", "marketing"], model: "auction_only" },
  { pid: p(28), name: "UI/UX Design", desc: "App or web interface design. Figma deliverables. 2-5 day turnaround.", cat: "human", price: null, tags: ["design", "ui", "ux"], model: "auction_only" },
  { pid: p(28), name: "Brand Identity Package", desc: "Logo, colors, typography, brand guidelines. Full brand system.", cat: "human", price: null, tags: ["design", "branding"], model: "auction_only" },
  { pid: p(29), name: "Legal Consultation", desc: "1-hour consultation with a licensed attorney. Contract, IP, or compliance.", cat: "human", price: null, tags: ["legal", "consulting"], model: "auction_only" },
  { pid: p(29), name: "Financial Advisory", desc: "Financial strategy session. Budgeting, fundraising, or tax planning.", cat: "human", price: null, tags: ["finance", "consulting"], model: "auction_only" },
];

services.forEach((s) => {
  mkt.listService({
    provider_id: s.pid,
    name: s.name,
    description: s.desc,
    category: s.cat,
    price_usd: s.price,
    price_model: s.model || "per_request",
    tags: s.tags,
  });
});

const stats = mkt.getMarketplaceStats();
console.log(`\nHiveIQ seeded: ${stats.providers} providers, ${stats.services} services`);
console.log(`Categories: ${JSON.stringify(mkt.getCategories())}`);
console.log("\nRun the server: node src/server.js\n");
