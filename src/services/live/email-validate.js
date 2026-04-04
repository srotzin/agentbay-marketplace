/**
 * Email Validation — Check syntax + MX records
 * Free, no API needed.
 */

import { promises as dns } from "dns";

export async function validateEmail(email) {
  const result = {
    email,
    valid: false,
    checks: {},
    provider: "HiveAgent EmailValidation",
  };

  // Syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  result.checks.syntax = emailRegex.test(email);
  if (!result.checks.syntax) {
    result.reason = "Invalid email syntax";
    return result;
  }

  const domain = email.split("@")[1];

  // Check for disposable email domains
  const disposable = new Set([
    "tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com",
    "10minutemail.com", "yopmail.com", "trashmail.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "dispostable.com", "maildrop.cc",
  ]);
  result.checks.not_disposable = !disposable.has(domain);

  // MX record check
  try {
    const mx = await dns.resolveMx(domain);
    result.checks.mx_records = mx.length > 0;
    result.mx_hosts = mx.sort((a, b) => a.priority - b.priority).slice(0, 3).map(r => ({
      host: r.exchange,
      priority: r.priority,
    }));
  } catch {
    result.checks.mx_records = false;
    result.reason = "No MX records found — domain cannot receive email";
    return result;
  }

  // A record check (fallback mail delivery)
  try {
    const a = await dns.resolve4(domain);
    result.checks.domain_resolves = a.length > 0;
  } catch {
    result.checks.domain_resolves = false;
  }

  result.valid = result.checks.syntax && result.checks.mx_records && result.checks.not_disposable;
  if (!result.valid && !result.reason) {
    result.reason = result.checks.not_disposable ? "MX check failed" : "Disposable email domain";
  }

  return result;
}
