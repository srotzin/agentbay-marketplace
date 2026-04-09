/**
 * HiveAgent MCP Tools — Phase 52-54
 *
 * Phase 52 — Smart Escrow
 *   Agent-to-agent escrow with programmable release conditions.
 *   Milestone-based, time-based, oracle-verified, or mutual approval.
 *   The payment primitive for trustless agent commerce.
 *   2% platform fee on every release.
 *
 * Phase 53 — Cross-Border Payments
 *   USDC → 180+ countries via optimal rail routing.
 *   SEPA, PIX, UPI, SPEI, GCash, M-Pesa, Faster Payments and more.
 *   15 pre-seeded corridors. 0.5% platform fee + fixed corridor fee.
 *
 * Phase 54 — Content Moderation
 *   MCP-native content safety screening for agents.
 *   8 categories: hate, violence, sexual, harassment, self_harm,
 *   spam, misinformation, illegal.
 *   3 built-in policies (strict/balanced/permissive) + custom policies.
 *   $0.001 per check.
 *
 * 17 new tools.
 */

import {
  createEscrow,
  fundEscrow,
  submitMilestone,
  releaseEscrow,
  disputeEscrow,
  getEscrowStatus,
  getEscrowDashboard,
} from "./services/smart-escrow.js";

import {
  getCorridorRates,
  sendCrossBorder,
  trackPayment,
  addRecipient,
  getCrossBorderStatus,
} from "./services/cross-border-payments.js";

import {
  moderateContent,
  setModerationPolicy,
  getModerationHistory,
  appealDecision,
  getModerationStats,
} from "./services/content-moderation.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase5254Tools = [
  // ── Phase 52: Smart Escrow ──────────────────────────────────────────────────
  {
    name: "escrow_create",
    description:
      "Create a programmable agent-to-agent escrow contract with configurable release conditions. " +
      "Supports four modes: 'milestone' (funds release when all milestones are approved), " +
      "'time' (auto-release after deadline_hours), 'oracle' (external oracle triggers release), " +
      "'mutual' (both depositor and beneficiary must approve). " +
      "Optionally define individual milestones with separate amounts. " +
      "Returns escrow_id, deposit_address, and condition summary. " +
      "Platform charges 2% fee on release. FREE to create.",
    inputSchema: {
      type: "object",
      properties: {
        depositor_agent_id: {
          type: "string",
          description: "Agent ID of the party depositing funds (payer)",
        },
        beneficiary_agent_id: {
          type: "string",
          description: "Agent ID of the party receiving funds upon release (payee)",
        },
        amount_usdc: {
          type: "number",
          description: "Total USDC amount to hold in escrow",
        },
        release_condition: {
          type: "string",
          enum: ["milestone", "time", "oracle", "mutual"],
          description: "How funds are released: milestone=all milestones complete, time=deadline passes, oracle=external verify, mutual=both parties approve",
        },
        description: {
          type: "string",
          description: "Plain English description of the escrow purpose (e.g. 'Website redesign project payment')",
        },
        milestones: {
          type: "array",
          description: "Array of milestone objects: [{title, description, amount_usdc}]. Used for milestone-based escrow. If omitted, one default milestone is created.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              amount_usdc: { type: "number" },
            },
          },
        },
        deadline_hours: {
          type: "number",
          description: "Hours until auto-release (required for time-based, optional for oracle/mutual as a fallback)",
        },
      },
      required: ["depositor_agent_id", "beneficiary_agent_id", "amount_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "escrow_fund",
    description:
      "Mark an escrow as funded after USDC has been sent to the deposit_address. " +
      "In LIVE_MODE (CDP), this is triggered automatically by on-chain confirmation. " +
      "In demo mode, call this to simulate funding and activate the release conditions. " +
      "Returns funding status and whether release condition is now active.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: {
          type: "string",
          description: "Escrow ID returned by escrow_create",
        },
        amount_usdc: {
          type: "number",
          description: "Amount funded (defaults to full escrow amount if omitted)",
        },
      },
      required: ["escrow_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "escrow_submit_milestone",
    description:
      "Submit proof of milestone completion. The beneficiary agent calls this after completing a deliverable. " +
      "Include proof (URL, hash, or description) and result summary. " +
      "If ALL milestones are now complete and escrow condition is 'milestone', funds auto-release immediately. " +
      "Platform charges 2% fee on auto-release. " +
      "For partial milestone completion, call multiple times (one per milestone).",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: {
          type: "string",
          description: "Escrow ID",
        },
        milestone_id: {
          type: "string",
          description: "Milestone ID from escrow_create response",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must be escrow beneficiary or depositor)",
        },
        proof: {
          type: "string",
          description: "Evidence of completion: URL, IPFS hash, or description of deliverable",
        },
        result: {
          type: "string",
          description: "Summary of what was delivered / completed",
        },
      },
      required: ["escrow_id", "milestone_id", "agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "escrow_release",
    description:
      "Manually release escrow funds to the beneficiary. Only the depositor can call this. " +
      "Use partial_amount_usdc to release a portion. " +
      "Full release closes the escrow. Partial release leaves remaining funds in escrow. " +
      "Platform charges 2% fee on released amount. " +
      "For milestone-based escrow, prefer escrow_submit_milestone for auto-release.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: {
          type: "string",
          description: "Escrow ID to release",
        },
        depositor_agent_id: {
          type: "string",
          description: "Your agent ID — must be the depositor to authorize release",
        },
        partial_amount_usdc: {
          type: "number",
          description: "Amount to release (defaults to full funded amount if omitted)",
        },
      },
      required: ["escrow_id", "depositor_agent_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "escrow_dispute",
    description:
      "File a dispute against an escrow to freeze funds pending resolution. " +
      "Either the depositor or beneficiary can file. Funds are frozen immediately. " +
      "HiveAgent dispute resolution team reviews within 48 hours. " +
      "Provide evidence (links, logs, transaction IDs) to support your case. " +
      "Only one active dispute allowed per escrow at a time.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: {
          type: "string",
          description: "Escrow ID to dispute",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must be depositor or beneficiary)",
        },
        reason: {
          type: "string",
          description: "Reason for dispute (e.g. 'Deliverable not completed', 'Quality below agreed standard')",
        },
        evidence: {
          type: "object",
          description: "Supporting evidence: {urls: [], transaction_ids: [], description: ''}",
        },
      },
      required: ["escrow_id", "agent_id", "reason"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "escrow_status",
    description:
      "Get complete escrow status including milestone progress, release history, and dispute status. " +
      "Returns: funding status, milestones (completed/pending), releases made, disputes, " +
      "remaining balance, and timeline. FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        escrow_id: {
          type: "string",
          description: "Escrow ID to check",
        },
      },
      required: ["escrow_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "escrow_dashboard",
    description:
      "Get Smart Escrow platform statistics: total escrows, volume, fees collected, " +
      "breakdown by status (pending/funded/released/disputed), milestone stats, and " +
      "supported release conditions. Use to assess platform activity or audit escrow operations. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 53: Cross-Border Payments ─────────────────────────────────────────
  {
    name: "xborder_corridor_rates",
    description:
      "Get the best USDC → local currency route between two countries. " +
      "Returns optimal payment rail, exchange rate, fees, delivery time, and alternatives. " +
      "15 pre-seeded corridors: US→EU (SEPA), US→UK (Faster Payments), US→India (UPI/IMPS), " +
      "US→Mexico (SPEI), US→Brazil (PIX), US→Philippines (GCash), US→Nigeria, US→Argentina, " +
      "US→Pakistan (Raast), US→Kenya (M-Pesa), US→Vietnam (VietQR), US→Singapore (PayNow), " +
      "US→Colombia (PSE), EU→US (ACH), UK→EU (SEPA). 180+ countries supported. FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        from_country: {
          type: "string",
          description: "ISO country code of sender (default: US)",
        },
        to_country: {
          type: "string",
          description: "ISO country code of destination (e.g. IN, MX, BR, PH, GB)",
        },
        amount_usdc: {
          type: "number",
          description: "USDC amount to send (for fee calculation preview)",
        },
      },
      required: ["to_country"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "xborder_send",
    description:
      "Send USDC as local currency to a recipient in another country via optimal routing. " +
      "Automatically selects cheapest/fastest corridor. Supports 180+ destination countries. " +
      "Platform charges 0.5% fee + fixed corridor fee (varies: $0.50–$4.00). " +
      "Returns payment_id, tracking_url, exchange rate, local amount delivered, and estimated_arrival. " +
      "In LIVE_MODE, funds move via Wise or Stripe. In demo mode, simulated with full tracking.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID (payer)",
        },
        recipient_name: {
          type: "string",
          description: "Full legal name of the payment recipient",
        },
        recipient_account: {
          type: "string",
          description: "Recipient's bank account number, UPI ID, phone (for M-Pesa/GCash), or IBAN",
        },
        to_country: {
          type: "string",
          description: "ISO country code of destination (e.g. IN, MX, BR, PH, NG)",
        },
        amount_usdc: {
          type: "number",
          description: "USDC amount to send (inclusive of all fees)",
        },
        purpose: {
          type: "string",
          description: "Payment purpose for compliance (e.g. 'services', 'invoice', 'salary', 'family_support')",
        },
        from_country: {
          type: "string",
          description: "ISO country code of sender (default: US)",
        },
        recipient_id: {
          type: "string",
          description: "Pre-saved recipient ID from xborder_add_recipient (optional shortcut)",
        },
      },
      required: ["agent_id", "recipient_name", "recipient_account", "to_country", "amount_usdc"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "xborder_track",
    description:
      "Track a cross-border payment through its delivery pipeline. " +
      "Returns current stage (initiated → fx_conversion → compliance_check → in_transit → delivered), " +
      "progress percentage, estimated and actual arrival times, " +
      "and recipient/amount details. FREE to call.",
    inputSchema: {
      type: "object",
      properties: {
        payment_id: {
          type: "string",
          description: "Payment ID returned by xborder_send",
        },
      },
      required: ["payment_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "xborder_add_recipient",
    description:
      "Save a payment recipient for repeated cross-border payments. " +
      "Avoids re-entering account details on every send. " +
      "Returns a recipient_id you can use in xborder_send. " +
      "Supports bank accounts, UPI IDs, mobile wallets (M-Pesa, GCash), and IBANs. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        name: {
          type: "string",
          description: "Recipient's full legal name",
        },
        country: {
          type: "string",
          description: "ISO country code (e.g. IN, MX, NG)",
        },
        account_type: {
          type: "string",
          enum: ["bank", "upi", "mobile_wallet", "iban", "card"],
          description: "Type of payment account",
        },
        account_number: {
          type: "string",
          description: "Account number, UPI ID, phone number, or IBAN",
        },
        routing_info: {
          type: "object",
          description: "Additional routing details: {bank_name, swift_code, sort_code, ifsc_code, routing_number}",
        },
      },
      required: ["agent_id", "name", "country", "account_number"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "xborder_status",
    description:
      "Get Cross-Border Payments platform overview: total payments, volume, fees, " +
      "top destination countries, all active corridors with rates and rails, " +
      "and supported payment methods. FREE to call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ── Phase 54: Content Moderation ─────────────────────────────────────────────
  {
    name: "content_moderate",
    description:
      "Screen text, image URLs, or web URLs for safety violations before publishing or processing. " +
      "Checks 8 categories: hate, violence, sexual, harassment, self_harm, spam, misinformation, illegal. " +
      "Uses OpenAI Moderation API (LIVE_MODE) or HiveAgent heuristic classifier. " +
      "Returns: safe (bool), flags array, severity (none/low/medium/high/critical), " +
      "action_taken (allowed/flagged/blocked), confidence score, and policy applied. " +
      "Fee: $0.001 per check. Default policy: 'balanced' (blocks hate/violence/sexual/harassment/self_harm/illegal).",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        content: {
          type: "string",
          description: "Text to moderate, or URL of image/webpage to check",
        },
        content_type: {
          type: "string",
          enum: ["text", "image_url", "url"],
          description: "Type of content: text (default), image_url, or url",
        },
        policy_id: {
          type: "string",
          description: "Policy to apply: 'strict', 'balanced' (default), 'permissive', or a custom policy name/ID",
        },
      },
      required: ["agent_id", "content"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  {
    name: "content_set_policy",
    description:
      "Create or update a custom content moderation policy for your agent. " +
      "Choose which categories to block and the severity threshold. " +
      "3 built-in policies: strict (blocks everything flagged), balanced (blocks high-severity — default), " +
      "permissive (logs only, blocks nothing). " +
      "Custom policies are automatically applied to all future moderation checks for your agent. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        policy_name: {
          type: "string",
          description: "Name for this policy (e.g. 'my-custom-policy', 'enterprise-safe')",
        },
        blocked_categories: {
          type: "array",
          items: { type: "string", enum: ["hate", "violence", "sexual", "harassment", "self_harm", "spam", "misinformation", "illegal"] },
          description: "Categories to block. Empty array = block nothing (log only).",
        },
        threshold: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Minimum severity to trigger action. low=block anything flagged, medium=block medium+, high=block high+, critical=block only critical",
        },
      },
      required: ["agent_id", "policy_name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "content_history",
    description:
      "Retrieve past content moderation results for your agent. " +
      "Returns result list with flags, severity, action, and timestamps, " +
      "plus summary stats (safe rate, blocked count, flagged count). " +
      "Useful for auditing content pipeline or reviewing blocked items. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Your agent ID",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 50, max: 200)",
        },
      },
      required: ["agent_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "content_appeal",
    description:
      "Appeal a content moderation block if you believe it was a false positive. " +
      "Only blocked items can be appealed. Each result can only be appealed once. " +
      "Provide a clear reason and any context to support your appeal. " +
      "HiveAgent human reviewers respond within 24 hours. FREE.",
    inputSchema: {
      type: "object",
      properties: {
        result_id: {
          type: "string",
          description: "Moderation result ID from content_moderate response",
        },
        agent_id: {
          type: "string",
          description: "Your agent ID (must match the original requester)",
        },
        reason: {
          type: "string",
          description: "Explain why you believe this was a false positive (e.g. 'This is a medical text discussing self-harm prevention, not promotion')",
        },
      },
      required: ["result_id", "agent_id", "reason"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "content_stats",
    description:
      "Get Content Moderation platform statistics: total checks, safe/blocked/flagged rates, " +
      "flag rates broken down by category (hate/violence/spam etc.), " +
      "built-in policy descriptions, severity distribution, and appeals status. " +
      "Use to understand content safety trends or configure moderation policy. FREE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase5254Tool(name, args) {
  switch (name) {
    // Phase 52 — Smart Escrow
    case "escrow_create":            return await createEscrow(args);
    case "escrow_fund":              return await fundEscrow(args);
    case "escrow_submit_milestone":  return await submitMilestone(args);
    case "escrow_release":           return await releaseEscrow(args);
    case "escrow_dispute":           return await disputeEscrow(args);
    case "escrow_status":            return getEscrowStatus(args);
    case "escrow_dashboard":         return getEscrowDashboard();

    // Phase 53 — Cross-Border Payments
    case "xborder_corridor_rates":   return getCorridorRates(args);
    case "xborder_send":             return await sendCrossBorder(args);
    case "xborder_track":            return trackPayment(args);
    case "xborder_add_recipient":    return addRecipient(args);
    case "xborder_status":           return getCrossBorderStatus();

    // Phase 54 — Content Moderation
    case "content_moderate":         return await moderateContent(args);
    case "content_set_policy":       return setModerationPolicy(args);
    case "content_history":          return getModerationHistory(args);
    case "content_appeal":           return await appealDecision(args);
    case "content_stats":            return getModerationStats();

    default:
      throw new Error(`Unknown Phase 52-54 tool: ${name}`);
  }
}
