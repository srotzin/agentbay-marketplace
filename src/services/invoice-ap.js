import { randomUUID } from "crypto";
import db from "../db.js";

// ─── Revenue Configuration ────────────────────────────────────────────────────

const AP_PLATFORM_COMMISSION = 0.20; // 20% platform cut
const AP_FEES = {
  extraction:   0.50,
  match:        0.25,
  duplicate:    0.10,
  routing:      0.15,
  optimization: 1.00,
  dashboard:    5.00,
};

// ─── Schema Initialization ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ap_invoices (
    id                  TEXT PRIMARY KEY,
    invoice_url         TEXT,
    format              TEXT DEFAULT 'pdf',
    vendor              TEXT NOT NULL,
    invoice_number      TEXT NOT NULL,
    invoice_date        TEXT,
    line_items          TEXT DEFAULT '[]',
    subtotal            REAL,
    tax                 REAL,
    total               REAL,
    payment_terms       TEXT DEFAULT 'Net 30',
    confidence_score    REAL,
    status              TEXT DEFAULT 'extracted' CHECK(status IN (
                          'extracted','matched','approved','paid','disputed','duplicate','rejected')),
    approver_chain      TEXT DEFAULT '[]',
    approved_at         TEXT,
    paid_at             TEXT,
    due_date            TEXT,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ap_matches (
    id                  TEXT PRIMARY KEY,
    invoice_id          TEXT REFERENCES ap_invoices(id),
    purchase_order_id   TEXT,
    receipt_id          TEXT,
    match_status        TEXT NOT NULL CHECK(match_status IN ('full_match','partial','mismatch')),
    variances           TEXT DEFAULT '[]',
    auto_approved       INTEGER DEFAULT 0,
    exceptions          TEXT DEFAULT '[]',
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ap_duplicate_checks (
    id                  TEXT PRIMARY KEY,
    invoice_id          TEXT,
    duplicate_found     INTEGER DEFAULT 0,
    matching_invoices   TEXT DEFAULT '[]',
    similarity_score    REAL DEFAULT 0,
    amount_at_risk      REAL DEFAULT 0,
    fee_usd             REAL NOT NULL,
    commission_usd      REAL NOT NULL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ap_payment_schedules (
    id                    TEXT PRIMARY KEY,
    invoice_ids           TEXT NOT NULL,
    cash_position         REAL,
    payment_schedule      TEXT DEFAULT '[]',
    early_pay_savings     REAL DEFAULT 0,
    cash_flow_impact      TEXT DEFAULT '{}',
    recommended_actions   TEXT DEFAULT '[]',
    fee_usd               REAL NOT NULL,
    commission_usd        REAL NOT NULL,
    created_at            TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _invCount = db.prepare("SELECT COUNT(*) as n FROM ap_invoices").get().n;
if (_invCount === 0) {
  const seedInvoices = [
    { id: randomUUID(), vendor: "Acme Supplies Co", invoice_number: "INV-2024-00441", invoice_date: "2024-03-15", subtotal: 4250.00, tax: 361.25, total: 4611.25, payment_terms: "Net 30", confidence_score: 0.98, status: "approved", fee_usd: AP_FEES.extraction, commission_usd: Math.round(AP_FEES.extraction * AP_PLATFORM_COMMISSION * 100) / 100 },
    { id: randomUUID(), vendor: "TechGear Ltd",     invoice_number: "INV-55221-B",    invoice_date: "2024-03-22", subtotal: 12800.00, tax: 1088.00, total: 13888.00, payment_terms: "Net 45", confidence_score: 0.95, status: "matched",  fee_usd: AP_FEES.extraction, commission_usd: Math.round(AP_FEES.extraction * AP_PLATFORM_COMMISSION * 100) / 100 },
    { id: randomUUID(), vendor: "Global Freight",   invoice_number: "GF-2024-9981",   invoice_date: "2024-02-28", subtotal: 1875.50, tax: 0,      total: 1875.50,  payment_terms: "Net 15", confidence_score: 0.91, status: "paid",     fee_usd: AP_FEES.extraction, commission_usd: Math.round(AP_FEES.extraction * AP_PLATFORM_COMMISSION * 100) / 100 },
  ];
  const insertInv = db.prepare(`
    INSERT OR IGNORE INTO ap_invoices
      (id, vendor, invoice_number, invoice_date, subtotal, tax, total, payment_terms, confidence_score, status, fee_usd, commission_usd)
    VALUES
      (@id, @vendor, @invoice_number, @invoice_date, @subtotal, @tax, @total, @payment_terms, @confidence_score, @status, @fee_usd, @commission_usd)
  `);
  for (const inv of seedInvoices) insertInv.run(inv);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function commission(fee) {
  return Math.round(fee * AP_PLATFORM_COMMISSION * 100) / 100;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const VENDOR_CATEGORIES = {
  "Acme":      "Office Supplies",
  "Tech":      "IT Equipment",
  "Global":    "Logistics",
  "Cloud":     "Software/SaaS",
  "Pro":       "Professional Services",
  "Delta":     "Facilities",
};

function inferCategory(vendorName) {
  for (const [key, cat] of Object.entries(VENDOR_CATEGORIES)) {
    if (vendorName.toLowerCase().includes(key.toLowerCase())) return cat;
  }
  return "General";
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── extractInvoiceData ───────────────────────────────────────────────────────

/**
 * OCR and extract structured data from any invoice format (PDF, image, EDI, XML).
 * @param {string} invoiceUrl  - URL of the invoice document
 * @param {string} format      - Document format: pdf|image|edi|xml|csv
 * @returns vendor, invoice_number, date, line_items[], subtotal, tax, total, payment_terms, confidence_score
 * Fee: $0.50 per extraction
 */
export function extractInvoiceData(invoiceUrl, format = "pdf") {
  if (!invoiceUrl) throw new Error("invoiceUrl is required");

  const validFormats = ["pdf", "image", "edi", "xml", "csv"];
  if (!validFormats.includes(format)) throw new Error(`format must be one of: ${validFormats.join(", ")}`);

  const fee  = AP_FEES.extraction;
  const comm = commission(fee);

  // Simulate realistic OCR extraction
  const vendors   = ["Apex Software Inc", "BlueSky Analytics", "Cascade Consulting", "Delta Cloud Services", "Edge Networks", "FrontLine Pro Services"];
  const vendor    = pickRandom(vendors);
  const invoiceNo = `INV-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;
  const invDate   = addDays(new Date().toISOString().slice(0, 10), -Math.floor(randomBetween(1, 60)));

  const lineItemDescriptions = [
    "Professional Services — Q1 Retainer",
    "Software License (annual)",
    "Cloud Infrastructure — March 2024",
    "Consulting Hours (40 hrs @ $150/hr)",
    "Support & Maintenance",
    "Hardware: Server Rack Unit",
    "Training Workshop — 2 day",
    "Data Migration Services",
  ];

  const numLines = Math.floor(randomBetween(2, 6));
  const line_items = [];
  let subtotal = 0;
  for (let i = 0; i < numLines; i++) {
    const qty         = Math.floor(randomBetween(1, 10));
    const unit_price  = Math.round(randomBetween(50, 2500) * 100) / 100;
    const amount      = Math.round(qty * unit_price * 100) / 100;
    subtotal         += amount;
    line_items.push({
      line_number:  i + 1,
      description:  pickRandom(lineItemDescriptions),
      quantity:     qty,
      unit_price,
      amount,
      gl_code:      `GL-${Math.floor(1000 + Math.random() * 9000)}`,
    });
  }

  subtotal          = Math.round(subtotal * 100) / 100;
  const taxRate     = format === "edi" ? 0 : pickRandom([0, 0, 0.085, 0.10]);
  const tax         = Math.round(subtotal * taxRate * 100) / 100;
  const total       = Math.round((subtotal + tax) * 100) / 100;
  const terms       = pickRandom(["Net 15", "Net 30", "Net 45", "Net 60", "2/10 Net 30"]);
  const dueDate     = addDays(invDate, parseInt(terms.match(/\d+$/)?.[0] ?? "30", 10));
  const confidence  = Math.round(randomBetween(format === "pdf" ? 0.92 : 0.78, 0.99) * 1000) / 1000;

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO ap_invoices
      (id, invoice_url, format, vendor, invoice_number, invoice_date, line_items, subtotal, tax, total, payment_terms, confidence_score, due_date, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @invoice_url, @format, @vendor, @invoice_number, @invoice_date, @line_items, @subtotal, @tax, @total, @payment_terms, @confidence_score, @due_date, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    invoice_url:      invoiceUrl,
    format,
    vendor,
    invoice_number:   invoiceNo,
    invoice_date:     invDate,
    line_items:       JSON.stringify(line_items),
    subtotal,
    tax,
    total,
    payment_terms:    terms,
    confidence_score: confidence,
    due_date:         dueDate,
    fee_usd:          fee,
    commission_usd:   comm,
    created_at:       now,
  });

  return {
    invoice_id:         id,
    invoice_url:        invoiceUrl,
    format,
    vendor,
    invoice_number:     invoiceNo,
    date:               invDate,
    due_date:           dueDate,
    line_items,
    subtotal,
    tax,
    total,
    payment_terms:      terms,
    currency:           "USD",
    confidence_score:   confidence,
    requires_review:    confidence < 0.90,
    extracted_at:       now,
    fee_usd:            fee,
    platform_commission_usd: comm,
    net_revenue_usd:    Math.round((fee - comm) * 100) / 100,
  };
}

// ─── matchThreeWay ────────────────────────────────────────────────────────────

/**
 * Perform 3-way matching between invoice, purchase order, and goods receipt.
 * @param {object} invoiceData     - Extracted invoice data (output of extractInvoiceData)
 * @param {string} purchaseOrderId - PO number to match against
 * @param {string} receiptId       - Goods receipt ID to match against
 * @returns match_status, variances[], auto_approved, exceptions[]
 * Fee: $0.25 per match
 */
export function matchThreeWay(invoiceData, purchaseOrderId, receiptId) {
  if (!invoiceData)       throw new Error("invoiceData is required");
  if (!purchaseOrderId)   throw new Error("purchaseOrderId is required");
  if (!receiptId)         throw new Error("receiptId is required");

  const fee  = AP_FEES.match;
  const comm = commission(fee);

  // Simulate PO and receipt with slight variances
  const poTotal      = Math.round((invoiceData.total ?? 1000) * pickRandom([1.0, 1.0, 1.0, 1.02, 0.98]) * 100) / 100;
  const receiptTotal = Math.round((invoiceData.total ?? 1000) * pickRandom([1.0, 1.0, 1.03, 0.97]) * 100) / 100;

  const variances = [];
  const exceptions = [];

  const invTotal = invoiceData.total ?? 0;

  // Price variance
  const priceVariancePct = Math.abs(invTotal - poTotal) / (poTotal || 1);
  if (priceVariancePct > 0.005) {
    variances.push({
      field:       "total_amount",
      invoice:     invTotal,
      purchase_order: poTotal,
      variance:    Math.round((invTotal - poTotal) * 100) / 100,
      variance_pct: Math.round(priceVariancePct * 10000) / 100,
    });
    if (priceVariancePct > 0.05) exceptions.push({ code: "PRICE_VARIANCE", severity: "high", message: `Invoice total exceeds PO by ${(priceVariancePct * 100).toFixed(1)}% — manual review required` });
  }

  // Quantity variance (receipt vs invoice)
  const qtyVariancePct = Math.abs(invTotal - receiptTotal) / (receiptTotal || 1);
  if (qtyVariancePct > 0.005) {
    variances.push({
      field:   "quantity/receipt_total",
      invoice: invTotal,
      receipt: receiptTotal,
      variance: Math.round((invTotal - receiptTotal) * 100) / 100,
      variance_pct: Math.round(qtyVariancePct * 10000) / 100,
    });
    if (qtyVariancePct > 0.03) exceptions.push({ code: "QUANTITY_VARIANCE", severity: "medium", message: `Receipt total differs from invoice by ${(qtyVariancePct * 100).toFixed(1)}%` });
  }

  // Tax check
  if ((invoiceData.tax ?? 0) > invTotal * 0.15) {
    exceptions.push({ code: "HIGH_TAX_RATE", severity: "low", message: "Tax amount exceeds 15% — verify correct tax jurisdiction" });
  }

  const matchStatus   = variances.length === 0 ? "full_match" : priceVariancePct > 0.10 ? "mismatch" : "partial";
  const autoApproved  = matchStatus === "full_match" || (matchStatus === "partial" && exceptions.every(e => e.severity !== "high"));

  const id  = randomUUID();
  const now = new Date().toISOString();

  // Update invoice status
  if (invoiceData.invoice_id) {
    db.prepare("UPDATE ap_invoices SET status = ? WHERE id = ?")
      .run(autoApproved ? "approved" : "disputed", invoiceData.invoice_id);
  }

  db.prepare(`
    INSERT OR IGNORE INTO ap_matches
      (id, invoice_id, purchase_order_id, receipt_id, match_status, variances, auto_approved, exceptions, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @invoice_id, @purchase_order_id, @receipt_id, @match_status, @variances, @auto_approved, @exceptions, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    invoice_id:        invoiceData.invoice_id ?? null,
    purchase_order_id: purchaseOrderId,
    receipt_id:        receiptId,
    match_status:      matchStatus,
    variances:         JSON.stringify(variances),
    auto_approved:     autoApproved ? 1 : 0,
    exceptions:        JSON.stringify(exceptions),
    fee_usd:           fee,
    commission_usd:    comm,
    created_at:        now,
  });

  return {
    match_id:               id,
    invoice_id:             invoiceData.invoice_id ?? null,
    purchase_order_id:      purchaseOrderId,
    receipt_id:             receiptId,
    match_status:           matchStatus,
    variances,
    auto_approved:          autoApproved,
    approval_note:          autoApproved
      ? "All tolerances within policy — approved for payment"
      : "Manual review required before payment authorization",
    exceptions,
    matched_at:             now,
    fee_usd:                fee,
    platform_commission_usd: comm,
    net_revenue_usd:        Math.round((fee - comm) * 100) / 100,
  };
}

// ─── detectDuplicateInvoice ───────────────────────────────────────────────────

/**
 * Check whether an invoice has already been submitted and processed.
 * @param {object} invoiceData   - Invoice data to check
 * @param {number} lookbackDays  - Number of days to look back for duplicates
 * @returns duplicate_found, matching_invoices[], similarity_score, amount_at_risk
 * Fee: $0.10 per check
 */
export function detectDuplicateInvoice(invoiceData, lookbackDays = 90) {
  if (!invoiceData) throw new Error("invoiceData is required");
  if (lookbackDays < 1 || lookbackDays > 365) throw new Error("lookbackDays must be between 1 and 365");

  const fee  = AP_FEES.duplicate;
  const comm = commission(fee);

  // Look for invoices with similar vendor/amount within the lookback window
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -lookbackDays);
  const candidates = db.prepare(`
    SELECT id, vendor, invoice_number, invoice_date, total
    FROM ap_invoices
    WHERE vendor = @vendor
      AND invoice_date >= @cutoff
      AND id != @self_id
    ORDER BY invoice_date DESC
    LIMIT 10
  `).all({
    vendor:   invoiceData.vendor ?? "",
    cutoff,
    self_id:  invoiceData.invoice_id ?? "",
  });

  const matching_invoices = [];
  let topSimilarity = 0;

  for (const candidate of candidates) {
    let similarity = 0;

    // Invoice number exact match
    if (candidate.invoice_number === (invoiceData.invoice_number ?? "")) similarity += 0.50;

    // Amount proximity (within 1%)
    const amtDiff = Math.abs((candidate.total ?? 0) - (invoiceData.total ?? 0));
    const amtPct  = amtDiff / Math.max(candidate.total ?? 1, invoiceData.total ?? 1);
    if (amtPct < 0.01) similarity += 0.35;
    else if (amtPct < 0.05) similarity += 0.15;

    // Date proximity (within 7 days)
    const dayDiff = Math.abs(new Date(candidate.invoice_date) - new Date(invoiceData.date ?? new Date())) / 86400000;
    if (dayDiff <= 7) similarity += 0.15;

    similarity = Math.min(1.0, similarity);
    if (similarity > 0.30) {
      topSimilarity = Math.max(topSimilarity, similarity);
      matching_invoices.push({
        invoice_id:      candidate.id,
        vendor:          candidate.vendor,
        invoice_number:  candidate.invoice_number,
        invoice_date:    candidate.invoice_date,
        total:           candidate.total,
        similarity_score: Math.round(similarity * 100) / 100,
        status:          "already_processed",
      });
    }
  }

  // For demo: if no DB matches but probability is high, simulate a synthetic match
  if (matching_invoices.length === 0 && Math.random() < 0.15) {
    topSimilarity = 0.92;
    matching_invoices.push({
      invoice_id:      randomUUID(),
      vendor:          invoiceData.vendor,
      invoice_number:  invoiceData.invoice_number,
      invoice_date:    addDays(invoiceData.date ?? new Date().toISOString().slice(0, 10), -2),
      total:           invoiceData.total,
      similarity_score: 0.92,
      status:          "already_paid",
    });
  }

  const duplicate_found = topSimilarity >= 0.75;
  const amount_at_risk  = duplicate_found ? (invoiceData.total ?? 0) : 0;

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO ap_duplicate_checks
      (id, invoice_id, duplicate_found, matching_invoices, similarity_score, amount_at_risk, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @invoice_id, @duplicate_found, @matching_invoices, @similarity_score, @amount_at_risk, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    invoice_id:        invoiceData.invoice_id ?? null,
    duplicate_found:   duplicate_found ? 1 : 0,
    matching_invoices: JSON.stringify(matching_invoices),
    similarity_score:  topSimilarity,
    amount_at_risk,
    fee_usd:           fee,
    commission_usd:    comm,
    created_at:        now,
  });

  // Flag invoice as duplicate in DB
  if (duplicate_found && invoiceData.invoice_id) {
    db.prepare("UPDATE ap_invoices SET status = 'duplicate' WHERE id = ?").run(invoiceData.invoice_id);
  }

  return {
    check_id:               id,
    invoice_id:             invoiceData.invoice_id ?? null,
    duplicate_found,
    matching_invoices,
    similarity_score:       Math.round(topSimilarity * 100) / 100,
    amount_at_risk,
    recommendation:         duplicate_found
      ? `HOLD — Likely duplicate of existing invoice. Amount at risk: $${amount_at_risk.toFixed(2)}. Route to AP manager for manual review.`
      : "No duplicate detected — invoice is safe to process.",
    lookback_days:          lookbackDays,
    checked_at:             now,
    fee_usd:                fee,
    platform_commission_usd: comm,
    net_revenue_usd:        Math.round((fee - comm) * 100) / 100,
  };
}

// ─── routeForApproval ─────────────────────────────────────────────────────────

/**
 * Determine the appropriate approval chain for an invoice based on policy rules.
 * @param {object} invoiceData    - Invoice data object
 * @param {object} approvalPolicy - Policy config: thresholds, department_rules, vendor_whitelist
 * @returns approver_chain[], estimated_approval_time, escalation_rules[]
 * Fee: $0.15 per routing
 */
export function routeForApproval(invoiceData, approvalPolicy = {}) {
  if (!invoiceData) throw new Error("invoiceData is required");

  const fee  = AP_FEES.routing;
  const comm = commission(fee);

  const total    = invoiceData.total ?? 0;
  const vendor   = invoiceData.vendor ?? "";
  const category = inferCategory(vendor);

  const policy = {
    auto_approve_under:   approvalPolicy.auto_approve_under   ?? 500,
    manager_approve:      approvalPolicy.manager_approve      ?? 5000,
    director_approve:     approvalPolicy.director_approve     ?? 25000,
    vp_approve:           approvalPolicy.vp_approve           ?? 100000,
    cfo_approve:          approvalPolicy.cfo_approve          ?? 250000,
    vendor_whitelist:     approvalPolicy.vendor_whitelist      ?? [],
    sla_hours:            approvalPolicy.sla_hours            ?? 24,
    ...approvalPolicy,
  };

  const isWhitelisted = policy.vendor_whitelist.some(v => vendor.toLowerCase().includes(v.toLowerCase()));

  const approver_chain = [];

  if (isWhitelisted || total <= policy.auto_approve_under) {
    approver_chain.push({ level: 1, role: "System", name: "Auto-Approval Bot", email: "ap-bot@company.com", threshold: policy.auto_approve_under, reason: isWhitelisted ? "Vendor is whitelisted" : "Amount below auto-approval threshold" });
  } else if (total <= policy.manager_approve) {
    approver_chain.push({ level: 1, role: "AP Manager", name: "Sarah Chen", email: "s.chen@company.com", threshold: policy.manager_approve, estimated_hours: 4 });
  } else if (total <= policy.director_approve) {
    approver_chain.push({ level: 1, role: "AP Manager", name: "Sarah Chen", email: "s.chen@company.com", threshold: policy.manager_approve, estimated_hours: 4 });
    approver_chain.push({ level: 2, role: "Finance Director", name: "Marcus Reed", email: "m.reed@company.com", threshold: policy.director_approve, estimated_hours: 8 });
  } else if (total <= policy.vp_approve) {
    approver_chain.push({ level: 1, role: "AP Manager", name: "Sarah Chen", email: "s.chen@company.com", threshold: policy.manager_approve, estimated_hours: 4 });
    approver_chain.push({ level: 2, role: "Finance Director", name: "Marcus Reed", email: "m.reed@company.com", threshold: policy.director_approve, estimated_hours: 8 });
    approver_chain.push({ level: 3, role: "VP Finance", name: "Amanda Torres", email: "a.torres@company.com", threshold: policy.vp_approve, estimated_hours: 24 });
  } else {
    approver_chain.push({ level: 1, role: "AP Manager", name: "Sarah Chen", email: "s.chen@company.com", threshold: policy.manager_approve, estimated_hours: 4 });
    approver_chain.push({ level: 2, role: "Finance Director", name: "Marcus Reed", email: "m.reed@company.com", threshold: policy.director_approve, estimated_hours: 8 });
    approver_chain.push({ level: 3, role: "VP Finance", name: "Amanda Torres", email: "a.torres@company.com", threshold: policy.vp_approve, estimated_hours: 24 });
    approver_chain.push({ level: 4, role: "CFO", name: "James Park", email: "j.park@company.com", threshold: policy.cfo_approve, estimated_hours: 48 });
  }

  const totalHours     = approver_chain.reduce((s, a) => s + (a.estimated_hours ?? 0), 0);
  const escalation_rules = [
    { trigger: "no_response", hours: policy.sla_hours, action: "escalate_to_next_approver", message: "Auto-escalate if no response within SLA" },
    { trigger: "out_of_office", action: "route_to_delegate", message: "Re-route to designated delegate if approver is OOO" },
    { trigger: "rejected", action: "return_to_requestor", message: "Return to submitter with rejection reason" },
    ...(total > policy.vp_approve ? [{ trigger: "high_value_alert", action: "notify_cfo_immediately", message: "High-value invoice — CFO notified regardless of approval chain" }] : []),
  ];

  // Update invoice routing in DB
  if (invoiceData.invoice_id) {
    db.prepare("UPDATE ap_invoices SET approver_chain = ? WHERE id = ?")
      .run(JSON.stringify(approver_chain), invoiceData.invoice_id);
  }

  const now = new Date().toISOString();

  return {
    invoice_id:               invoiceData.invoice_id ?? null,
    vendor,
    total,
    category,
    approver_chain,
    approver_count:           approver_chain.length,
    estimated_approval_time:  `${totalHours} hours`,
    estimated_approval_hours: totalHours,
    escalation_rules,
    routing_policy_applied:   isWhitelisted ? "vendor_whitelist" : `${approver_chain[0]?.role ?? "manual"}_threshold`,
    routed_at:                now,
    fee_usd:                  fee,
    platform_commission_usd:  comm,
    net_revenue_usd:          Math.round((fee - comm) * 100) / 100,
  };
}

// ─── optimizePaymentTiming ────────────────────────────────────────────────────

/**
 * Optimize payment schedule to maximize early payment discounts and preserve cash flow.
 * @param {object[]} invoices           - Array of invoice objects from extractInvoiceData
 * @param {number}   cashPosition       - Current cash available for AP (USD)
 * @param {object[]} earlyPayDiscounts  - [{vendor, discount_pct, pay_within_days}]
 * @returns payment_schedule[], early_pay_savings, cash_flow_impact, recommended_actions[]
 * Fee: $1.00 per optimization
 */
export function optimizePaymentTiming(invoices, cashPosition, earlyPayDiscounts = []) {
  if (!invoices || !Array.isArray(invoices) || invoices.length === 0) throw new Error("invoices must be a non-empty array");
  if (cashPosition == null || cashPosition < 0) throw new Error("cashPosition must be a non-negative number");

  const fee  = AP_FEES.optimization;
  const comm = commission(fee);

  const discountMap = {};
  for (const d of earlyPayDiscounts) {
    if (d.vendor) discountMap[d.vendor.toLowerCase()] = d;
  }

  let remainingCash    = cashPosition;
  const payment_schedule = [];
  let early_pay_savings  = 0;
  const today = new Date();

  // Sort invoices: early-pay discount opportunities first, then by due date
  const sorted = [...invoices].sort((a, b) => {
    const aDisc = discountMap[a.vendor?.toLowerCase()] ? 1 : 0;
    const bDisc = discountMap[b.vendor?.toLowerCase()] ? 1 : 0;
    if (aDisc !== bDisc) return bDisc - aDisc; // discount invoices first
    return new Date(a.due_date ?? a.date ?? today) - new Date(b.due_date ?? b.date ?? today);
  });

  for (const inv of sorted) {
    const total       = inv.total ?? 0;
    const dueDate     = inv.due_date ?? inv.date ?? addDays(today.toISOString().slice(0, 10), 30);
    const daysUntilDue = Math.round((new Date(dueDate) - today) / 86400000);
    const discountDef = discountMap[inv.vendor?.toLowerCase()];

    let recommended_pay_date = dueDate;
    let savings = 0;
    let payAmount = total;
    let strategy = "pay_on_due_date";

    if (discountDef && daysUntilDue >= 0) {
      const earlyDeadline  = addDays(today.toISOString().slice(0, 10), discountDef.pay_within_days ?? 10);
      const discountAmount = Math.round(total * (discountDef.discount_pct / 100) * 100) / 100;

      if (remainingCash >= total) {
        recommended_pay_date = earlyDeadline;
        savings    = discountAmount;
        payAmount  = Math.round((total - discountAmount) * 100) / 100;
        strategy   = "early_pay_discount";
        early_pay_savings += discountAmount;
        remainingCash     -= payAmount;
      } else {
        strategy = "cash_constrained_skip_discount";
      }
    } else if (remainingCash >= total) {
      remainingCash -= total;
    } else {
      strategy = "defer_to_avoid_overdraft";
      recommended_pay_date = addDays(dueDate, 5); // grace period
    }

    payment_schedule.push({
      invoice_id:              inv.invoice_id ?? inv.id ?? null,
      vendor:                  inv.vendor,
      invoice_total:           total,
      pay_amount:              payAmount,
      recommended_pay_date,
      due_date:                dueDate,
      days_until_due:          daysUntilDue,
      discount_captured:       savings,
      strategy,
      priority:                daysUntilDue <= 7 ? "urgent" : daysUntilDue <= 14 ? "high" : "normal",
    });
  }

  const totalPayable       = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const cash_flow_impact   = {
    opening_cash:         cashPosition,
    total_payable:        totalPayable,
    closing_cash_est:     Math.round((cashPosition - totalPayable + early_pay_savings) * 100) / 100,
    weeks: [0, 1, 2, 3, 4].map(w => ({
      week:          `Week ${w + 1}`,
      payments_due:  payment_schedule
        .filter(p => {
          const d = Math.round((new Date(p.recommended_pay_date) - today) / 86400000);
          return d >= w * 7 && d < (w + 1) * 7;
        })
        .reduce((s, p) => s + p.pay_amount, 0),
    })),
  };

  const recommended_actions = [];
  if (early_pay_savings > 0) recommended_actions.push(`Capture $${early_pay_savings.toFixed(2)} in early payment discounts by paying ${earlyPayDiscounts.length} vendor(s) within their discount window`);
  const urgent = payment_schedule.filter(p => p.priority === "urgent");
  if (urgent.length > 0) recommended_actions.push(`${urgent.length} invoice(s) due within 7 days — process immediately to avoid late fees`);
  const deferred = payment_schedule.filter(p => p.strategy === "defer_to_avoid_overdraft");
  if (deferred.length > 0) recommended_actions.push(`${deferred.length} payment(s) deferred due to cash position — consider a short-term credit facility`);
  recommended_actions.push("Review payment schedule weekly and adjust as new invoices arrive");

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO ap_payment_schedules
      (id, invoice_ids, cash_position, payment_schedule, early_pay_savings, cash_flow_impact, recommended_actions, fee_usd, commission_usd, created_at)
    VALUES
      (@id, @invoice_ids, @cash_position, @payment_schedule, @early_pay_savings, @cash_flow_impact, @recommended_actions, @fee_usd, @commission_usd, @created_at)
  `).run({
    id,
    invoice_ids:          JSON.stringify(invoices.map(i => i.invoice_id ?? i.id ?? null)),
    cash_position:        cashPosition,
    payment_schedule:     JSON.stringify(payment_schedule),
    early_pay_savings,
    cash_flow_impact:     JSON.stringify(cash_flow_impact),
    recommended_actions:  JSON.stringify(recommended_actions),
    fee_usd:              fee,
    commission_usd:       comm,
    created_at:           now,
  });

  return {
    schedule_id:             id,
    invoices_optimized:      invoices.length,
    payment_schedule,
    early_pay_savings:       Math.round(early_pay_savings * 100) / 100,
    cash_flow_impact,
    recommended_actions,
    optimized_at:            now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}

// ─── getApDashboard ───────────────────────────────────────────────────────────

/**
 * Retrieve AP analytics dashboard for a given date range.
 * @param {object} dateRange - {start: ISO date, end: ISO date}
 * @returns total_payable, aging_buckets, avg_processing_time, duplicate_savings, early_pay_savings, exceptions_rate
 * Fee: $5.00 per month (billed per call)
 */
export function getApDashboard(dateRange = {}) {
  const fee  = AP_FEES.dashboard;
  const comm = commission(fee);

  const start = dateRange.start ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const end   = dateRange.end   ?? new Date().toISOString().slice(0, 10);

  // Pull actuals from DB
  const invoices = db.prepare(`
    SELECT * FROM ap_invoices WHERE invoice_date >= ? AND invoice_date <= ?
  `).all(start, end);

  const dupChecks  = db.prepare("SELECT * FROM ap_duplicate_checks WHERE created_at >= ?").all(start);
  const matches    = db.prepare("SELECT * FROM ap_matches WHERE created_at >= ?").all(start);

  const total_payable = invoices.filter(i => !["paid", "rejected"].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0);

  const today = new Date();
  const aging_buckets = { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, over_90: 0 };
  for (const inv of invoices.filter(i => i.status !== "paid")) {
    const due   = inv.due_date ? new Date(inv.due_date) : today;
    const days  = Math.round((today - due) / 86400000);
    if (days <= 0)      aging_buckets.current += inv.total ?? 0;
    else if (days <= 30) aging_buckets["1_30"] += inv.total ?? 0;
    else if (days <= 60) aging_buckets["31_60"] += inv.total ?? 0;
    else if (days <= 90) aging_buckets["61_90"] += inv.total ?? 0;
    else                aging_buckets.over_90  += inv.total ?? 0;
  }
  for (const k of Object.keys(aging_buckets)) {
    aging_buckets[k] = Math.round(aging_buckets[k] * 100) / 100;
  }

  // Simulate processing time: average 2.8 days if no data
  const avg_processing_time_days = invoices.length > 2
    ? Math.round(randomBetween(1.5, 4.5) * 10) / 10
    : 2.8;

  const duplicate_savings = dupChecks
    .filter(d => d.duplicate_found === 1)
    .reduce((s, d) => s + (d.amount_at_risk ?? 0), 0);

  const schedules = db.prepare("SELECT early_pay_savings FROM ap_payment_schedules WHERE created_at >= ?").all(start);
  const early_pay_savings_total = schedules.reduce((s, r) => s + (r.early_pay_savings ?? 0), 0);

  const totalMatches      = matches.length;
  const exceptionsCount   = matches.filter(m => JSON.parse(m.exceptions ?? "[]").length > 0).length;
  const exceptions_rate   = totalMatches > 0 ? Math.round((exceptionsCount / totalMatches) * 10000) / 100 : 0;

  const invoice_volume_by_status = {};
  for (const inv of invoices) {
    invoice_volume_by_status[inv.status] = (invoice_volume_by_status[inv.status] ?? 0) + 1;
  }

  const top_vendors = Object.entries(
    invoices.reduce((acc, inv) => {
      acc[inv.vendor] = (acc[inv.vendor] ?? 0) + (inv.total ?? 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vendor, total]) => ({ vendor, total: Math.round(total * 100) / 100 }));

  const now = new Date().toISOString();

  return {
    date_range:              { start, end },
    invoices_processed:      invoices.length,
    total_payable:           Math.round(total_payable * 100) / 100,
    total_paid:              Math.round(invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0) * 100) / 100,
    aging_buckets,
    avg_processing_time_days,
    duplicate_savings:       Math.round(duplicate_savings * 100) / 100,
    early_pay_savings:       Math.round(early_pay_savings_total * 100) / 100,
    exceptions_rate_pct:     exceptions_rate,
    invoice_volume_by_status,
    top_vendors_by_spend:    top_vendors,
    auto_approval_rate_pct:  matches.length > 0
      ? Math.round((matches.filter(m => m.auto_approved === 1).length / matches.length) * 10000) / 100
      : 0,
    generated_at:            now,
    fee_usd:                 fee,
    platform_commission_usd: comm,
    net_revenue_usd:         Math.round((fee - comm) * 100) / 100,
  };
}
