/**
 * Deathcare Operations Services
 *
 * Focus: funeral home operations planning and pricing.
 */

export function funeralServiceChecklist({
  service_type = "traditional",
  disposition = "burial",
  venue = "funeral_home",
  religious = false,
  has_visitation = true,
  has_graveside = false,
} = {}) {
  const base = [
    "Intake decedent information and legal next-of-kin authorization",
    "Arrange transportation (removal/transfer)",
    "File required permits/certificates",
    "Coordinate disposition scheduling (cemetery/crematory)",
    "Prepare obituary + announcements",
    "Confirm clergy/officiant and service order",
    "Arrange flowers, music, AV, and seating",
    "Confirm staff assignments and on-call coverage",
    "Create day-of timeline and vendor call sheet",
  ];

  if (has_visitation) base.splice(6, 0, "Prepare visitation room setup and guestbook/memorial items");
  if (has_graveside) base.push("Coordinate graveside logistics (procession, permits, equipment)");
  if (religious) base.push("Confirm religious requirements (washing, shrouding, timing restrictions)");

  return {
    ok: true,
    inputs: { service_type, disposition, venue, religious, has_visitation, has_graveside },
    checklist: base,
  };
}

export function funeralPricingEstimate({
  items = [],
  cash_advances = [],
  discount_pct = 0,
  tax_pct = 0,
  deposit_pct = 0.25,
} = {}) {
  const norm = (arr) => (Array.isArray(arr) ? arr : []).map((x, i) => ({
    name: x?.name ?? `item_${i + 1}`,
    amount: Number(x?.amount ?? 0),
    taxable: Boolean(x?.taxable ?? true),
  }));

  const lineItems = norm(items);
  const cash = norm(cash_advances).map((x) => ({ ...x, taxable: false, cash_advance: true }));

  const subtotal = lineItems.reduce((s, x) => s + x.amount, 0);
  const discount = subtotal * Number(discount_pct);
  const discountedSubtotal = Math.max(subtotal - discount, 0);

  const taxableBase = lineItems.reduce((s, x) => s + (x.taxable ? x.amount : 0), 0);
  const tax = Math.max(taxableBase - discount, 0) * Number(tax_pct);

  const cashTotal = cash.reduce((s, x) => s + x.amount, 0);
  const total = discountedSubtotal + tax + cashTotal;
  const deposit = total * Number(deposit_pct);

  return {
    ok: true,
    breakdown: {
      subtotal,
      discount,
      discounted_subtotal: discountedSubtotal,
      taxable_base: taxableBase,
      tax,
      cash_advances: cashTotal,
      total,
      deposit_due: deposit,
    },
    items: lineItems,
    cash_advances: cash,
  };
}

export function obituaryDraft({
  full_name,
  age,
  city,
  date_of_death,
  survivors = [],
  predeceased = [],
  service_details = null,
  charities = [],
} = {}) {
  if (!full_name) return { ok: false, error: "full_name is required" };

  const surv = Array.isArray(survivors) ? survivors : [];
  const pred = Array.isArray(predeceased) ? predeceased : [];

  const lines = [];
  lines.push(`${full_name}${age ? `, ${age}` : ""}${city ? `, of ${city}` : ""}, passed away${date_of_death ? ` on ${date_of_death}` : ""}.`);

  if (pred.length) lines.push(`Predeceased by ${pred.join(", ")}.`);
  if (surv.length) lines.push(`Survived by ${surv.join(", ")}.`);

  if (service_details) {
    lines.push(`Services will be held ${service_details}.`);
  }

  if (Array.isArray(charities) && charities.length) {
    lines.push(`In lieu of flowers, memorial contributions may be made to: ${charities.join("; ")}.`);
  }

  return {
    ok: true,
    obituary_text: lines.join("\n\n"),
  };
}
