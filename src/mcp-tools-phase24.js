/**
 * Phase 24 — Mastercard Agent Pay + Stripe MCP + OpenAI ACP + Google UCP
 *
 * 22 tools covering every major payment network in the agentic economy:
 *
 *   Mastercard Agent Pay (4 tools)
 *   ├── mc_agent_register      — register in Mastercard Agent Pay network
 *   ├── mc_agent_pay           — execute purchase on Mastercard rails
 *   ├── mc_insight_token       — get permissioned consumer purchase signals
 *   └── mc_status              — integration overview
 *
 *   Stripe Native MCP (8 tools)
 *   ├── stripe_customer_create — create Stripe customer
 *   ├── stripe_payment_intent  — create PaymentIntent
 *   ├── stripe_subscription    — create subscription
 *   ├── stripe_invoice         — create and finalize invoice
 *   ├── stripe_checkout        — hosted checkout session
 *   ├── stripe_customers_list  — search/list customers
 *   ├── stripe_refund          — create refund
 *   └── stripe_status          — integration overview
 *
 *   OpenAI Agentic Commerce Protocol (5 tools)
 *   ├── acp_product_feed       — push merchant catalog to ChatGPT agents
 *   ├── acp_session_create     — create ACP checkout session
 *   ├── acp_session_complete   — complete purchase with Stripe token
 *   ├── acp_products_list      — browse ACP product catalog
 *   └── acp_status             — integration overview
 *
 *   Google Universal Commerce Protocol (5 tools)
 *   ├── ucp_merchant_register  — register as UCP merchant (Gemini/Search discoverable)
 *   ├── ucp_checkout_create    — create UCP checkout session
 *   ├── ucp_checkout_complete  — complete UCP purchase
 *   ├── ucp_identity_link      — link agent identity to merchant
 *   ├── ucp_order_status       — track order post-purchase
 *   └── ucp_status             — integration overview
 *
 * Together with Phase 20 (BVNK) and Phase 21 (Visa ICC), HiveAgent now covers
 * every major payment network in the agentic economy.
 */

import {
  registerMcAgent, agentPay, requestInsightToken, getMcStatus,
} from "./services/mastercard-agent-pay.js";

import {
  createCustomer, createPaymentIntent, createSubscription,
  createInvoice, createCheckoutSession, listCustomers,
  createRefund, getStripeStatus,
} from "./services/stripe-mcp.js";

import {
  pushProductFeed, createAcpSession, completeAcpSession,
  listAcpProducts, getAcpStatus,
} from "./services/openai-acp.js";

import {
  registerUcpMerchant, createUcpCheckout, completeUcpCheckout,
  linkUcpIdentity, getUcpOrderStatus, getUcpStatus,
} from "./services/google-ucp.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const phase24Tools = [

  // ── MASTERCARD ──────────────────────────────────────────────────────────────

  {
    name: "mc_agent_register",
    description: "Register an AI agent with Mastercard Agent Pay — the trusted agentic transaction network live for all US Mastercard cardholders, with global rollout in 2026. Once registered, the agent can execute purchases on Mastercard rails and access Insight Tokens (permissioned consumer purchase signals). Pairs with Visa ICC (visa_icc_agent_register) to cover both major card networks.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Unique agent identifier." },
        agent_name: { type: "string", description: "Human-readable agent name shown to cardholders." },
        cardholder_id: { type: "string", description: "Mastercard cardholder ID to link this agent to. Optional at registration." },
        capabilities: { type: "array", items: { type: "string" }, description: "Requested capabilities: ['agent_pay', 'insight_tokens', 'merchant_discovery']." },
      },
      required: ["agent_id"],
    },
  },

  {
    name: "mc_agent_pay",
    description: "Execute a purchase on Mastercard Agent Pay rails. The same security as any Mastercard transaction — agent identity verified, cardholder authorization checked, Insight Token optionally applied for personalization. Works across all US Mastercard cardholders. HiveAgent charges 0.1% wrapper fee.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Registered agent executing the purchase." },
        merchant: { type: "string", description: "Merchant name." },
        amount: { type: "number", description: "Purchase amount in display currency." },
        currency: { type: "string", description: "Currency. Default: USD." },
        item: { type: "string", description: "Item or service description." },
        cardholder_id: { type: "string", description: "Cardholder ID authorizing this purchase." },
        insight_token_id: { type: "string", description: "Insight Token ID from mc_insight_token — personalizes checkout." },
      },
      required: ["agent_id", "merchant", "amount"],
    },
  },

  {
    name: "mc_insight_token",
    description: "Request a Mastercard Insight Token — permissioned access to a cardholder's purchase history, preferred merchants, spending patterns, and loyalty programs. Used to personalize agent-initiated purchases. Consumer must grant consent. Token valid 24 hours. Built on Mastercard's SAP Concur-supported infrastructure.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent requesting the token." },
        cardholder_id: { type: "string", description: "Cardholder whose signals to access." },
        scope: { type: "string", description: "Signal scope. Default: 'purchase_history'. Options: purchase_history, preferences, loyalty, spending_patterns." },
        consent_granted: { type: "boolean", description: "Consumer has explicitly granted consent. Must be true." },
      },
      required: ["agent_id", "cardholder_id"],
    },
  },

  {
    name: "mc_status",
    description: "Get Mastercard Agent Pay integration status — live vs simulation mode, env vars needed, capabilities overview (Agent Pay, Insight Tokens, Agent Sign-Up, Agent Toolkit), and usage stats.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── STRIPE ──────────────────────────────────────────────────────────────────

  {
    name: "stripe_customer_create",
    description: "Create a Stripe customer record — stores email, name, and metadata. The foundation for subscriptions, invoices, and saved payment methods. Works in both live (STRIPE_SECRET_KEY set) and simulation mode.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the customer." },
        email: { type: "string", description: "Customer email address." },
        name: { type: "string", description: "Customer full name." },
        metadata: { type: "object", description: "Key-value metadata to attach (e.g. { plan: 'pro', source: 'hiveagent' })." },
      },
      required: [],
    },
  },

  {
    name: "stripe_payment_intent",
    description: "Create a Stripe PaymentIntent — the primary payment flow for one-time charges. Returns a client_secret for frontend confirmation, or confirm server-side. Amount in cents (e.g. 1999 = $19.99). Supports card, bank transfer, and 20+ payment methods. HiveAgent charges 0.1% wrapper fee on top of Stripe's 2.9% + $0.30.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent initiating the payment." },
        amount: { type: "number", description: "Amount in cents (e.g. 4999 = $49.99)." },
        currency: { type: "string", description: "Currency code. Default: usd." },
        customer_id: { type: "string", description: "Stripe customer ID. Optional." },
        description: { type: "string", description: "Payment description." },
        payment_method_types: { type: "array", items: { type: "string" }, description: "Accepted methods. Default: ['card']." },
      },
      required: ["amount"],
    },
  },

  {
    name: "stripe_subscription_create",
    description: "Create a Stripe subscription — recurring billing linked to a customer and price. Supports trial periods. Returns subscription ID and billing details. Use stripe_customer_create first, then create a Price in Stripe dashboard or via API to get a price_id.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the subscription." },
        customer_id: { type: "string", description: "Stripe customer ID." },
        price_id: { type: "string", description: "Stripe Price ID (e.g. price_1ABC...). Create in Stripe dashboard." },
        trial_days: { type: "number", description: "Free trial days before first charge. Optional." },
      },
      required: ["customer_id", "price_id"],
    },
  },

  {
    name: "stripe_invoice_create",
    description: "Create and finalize a Stripe invoice — billing document sent to a customer. Can include line items or be auto-generated from subscription. Returns hosted_invoice_url to share with customer for payment.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the invoice." },
        customer_id: { type: "string", description: "Stripe customer ID." },
        description: { type: "string", description: "Invoice line item description." },
        amount_cents: { type: "number", description: "Amount to invoice in cents. Leave blank for subscription-auto invoices." },
        currency: { type: "string", description: "Currency. Default: usd." },
        auto_advance: { type: "boolean", description: "Auto-finalize and send invoice. Default: true." },
      },
      required: ["customer_id"],
    },
  },

  {
    name: "stripe_checkout_session",
    description: "Create a Stripe hosted checkout session — a Stripe-hosted payment page for one-time payments, subscriptions, or setup. Returns a checkout_url to redirect the customer to. Stripe handles PCI compliance, 3D Secure, and payment method display.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the session." },
        line_items: { type: "array", items: { type: "object" }, description: "Array of { price: 'price_id', quantity: 1 } objects." },
        mode: { type: "string", description: "Checkout mode: 'payment' | 'subscription' | 'setup'. Default: payment." },
        success_url: { type: "string", description: "URL to redirect after successful payment." },
        cancel_url: { type: "string", description: "URL to redirect if customer cancels." },
        customer_id: { type: "string", description: "Stripe customer ID. Optional." },
      },
      required: ["line_items", "success_url"],
    },
  },

  {
    name: "stripe_customers_list",
    description: "List or search Stripe customers. Filter by email for exact lookup, or list all with pagination. Returns customer ID, email, name, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Filter by exact email address." },
        limit: { type: "number", description: "Max results to return. Default: 10." },
      },
      required: [],
    },
  },

  {
    name: "stripe_refund_create",
    description: "Create a Stripe refund for a completed payment. Provide the payment_intent_id and optionally a partial amount in cents. Full refund if amount is omitted. Reason defaults to 'requested_by_customer'.",
    inputSchema: {
      type: "object",
      properties: {
        payment_intent_id: { type: "string", description: "PaymentIntent ID to refund (pi_...)." },
        amount: { type: "number", description: "Partial refund amount in cents. Omit for full refund." },
        reason: { type: "string", description: "Refund reason: 'requested_by_customer' | 'duplicate' | 'fraudulent'." },
      },
      required: ["payment_intent_id"],
    },
  },

  {
    name: "stripe_status",
    description: "Get Stripe MCP integration status — live vs simulation, env var needed (STRIPE_SECRET_KEY), all 8 tools available, usage stats (customers, payments, subscriptions, volume).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── OPENAI ACP ──────────────────────────────────────────────────────────────

  {
    name: "acp_product_feed",
    description: "Push a merchant product catalog to make it discoverable by ChatGPT agents via OpenAI's Agentic Commerce Protocol (ACP). Once submitted, ChatGPT's 900M+ weekly users can find and purchase your products via AI-native checkout. Apache 2.0 open source — agenticcommerce.dev. HiveAgent's own tools and credits are already in the catalog.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent submitting the feed." },
        products: {
          type: "array",
          items: { type: "object" },
          description: "Array of products: { id, title, description, price, currency, category, image_url, availability }.",
        },
      },
      required: ["products"],
    },
  },

  {
    name: "acp_session_create",
    description: "Create an ACP checkout session for a product in the catalog. Returns session_id with cart totals. Complete with acp_session_complete + a Stripe Shared Payment Token to execute the purchase. This is how ChatGPT agents buy things on behalf of users.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the session." },
        product_id: { type: "string", description: "Product ID from acp_products_list." },
        quantity: { type: "number", description: "Quantity to purchase. Default: 1." },
        merchant_id: { type: "string", description: "Merchant ID. Defaults to HiveAgent." },
        shipping_address: { type: "object", description: "Shipping address object. Optional for digital goods." },
      },
      required: ["product_id"],
    },
  },

  {
    name: "acp_session_complete",
    description: "Complete an ACP checkout session using a Stripe Shared Payment Token. Finalizes the purchase, triggers merchant fulfillment, and sends a commerce signal back to OpenAI. This is the final step in the ACP purchase flow.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from acp_session_create." },
        payment_token: { type: "string", description: "Stripe Shared Payment Token scoped to this purchase." },
        agent_id: { type: "string", description: "Agent completing the purchase." },
      },
      required: ["session_id", "payment_token"],
    },
  },

  {
    name: "acp_products_list",
    description: "List all ACP-eligible products in the HiveAgent catalog — discoverable by ChatGPT agents. Filter by category. Includes HiveAgent Pro subscriptions, API credits, and enterprise plans.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category (e.g. 'software_subscription', 'credits'). Leave blank for all." },
        limit: { type: "number", description: "Max results. Default: 20." },
      },
      required: [],
    },
  },

  {
    name: "acp_status",
    description: "Get OpenAI ACP integration status — mode, spec URL, ChatGPT reach, products in catalog, checkout sessions, completed purchases.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── GOOGLE UCP ──────────────────────────────────────────────────────────────

  {
    name: "ucp_merchant_register",
    description: "Register as a UCP-compatible merchant — making your products and services discoverable by Gemini and Google Search AI Mode agents. UCP is Google + Shopify's open commerce protocol (ucp.dev), announced Jan 2026. Agents discover merchants via /.well-known/ucp profile. Supports three capabilities: checkout, identity linking, and order management.",
    inputSchema: {
      type: "object",
      properties: {
        merchant_id: { type: "string", description: "Your merchant identifier." },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "UCP capabilities to declare: ['dev.ucp.checkout', 'dev.ucp.identity_linking', 'dev.ucp.order_management'].",
        },
        profile_url: { type: "string", description: "URL where your UCP profile is hosted. Defaults to hiveagentiq.com/.well-known/ucp/{merchant_id}." },
      },
      required: ["merchant_id"],
    },
  },

  {
    name: "ucp_checkout_create",
    description: "Create a UCP checkout session — modular cart with tax calculation, line items, and currency. Used by Gemini and Google Search AI Mode agents to initiate purchases at UCP-registered merchants. Complete with ucp_checkout_complete.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent creating the session." },
        merchant_id: { type: "string", description: "UCP merchant ID. Default: hiveagentiq." },
        items: {
          type: "array",
          items: { type: "object" },
          description: "Array of { id, title, price, quantity } objects.",
        },
        currency: { type: "string", description: "Currency code. Default: USD." },
        identity_token: { type: "string", description: "Optional linked identity token for personalization." },
      },
      required: ["items"],
    },
  },

  {
    name: "ucp_checkout_complete",
    description: "Complete a UCP checkout session — finalizes the purchase, creates an order record with tracking, and sends a commerce signal. Returns order_id for post-purchase tracking via ucp_order_status.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from ucp_checkout_create." },
        payment_method: { type: "string", description: "Payment method identifier or token." },
        agent_id: { type: "string", description: "Agent completing the checkout." },
      },
      required: ["session_id"],
    },
  },

  {
    name: "ucp_identity_link",
    description: "Link an agent's identity to a merchant using UCP's OAuth 2.0 identity linking capability. Enables personalized experiences — merchant can use purchase history and preferences for this agent's future sessions. Consumer consent is implicit in the linking flow.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent to link." },
        merchant_id: { type: "string", description: "Merchant to link to." },
        scope: { type: "string", description: "Data scope: 'purchase_history,preferences'. Default: both." },
      },
      required: ["agent_id", "merchant_id"],
    },
  },

  {
    name: "ucp_order_status",
    description: "Get post-purchase order status via UCP order management capability — tracking number, carrier, estimated delivery, and order status. Call after ucp_checkout_complete with the returned order_id.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID from ucp_checkout_complete." },
        agent_id: { type: "string", description: "Agent who placed the order." },
      },
      required: ["order_id"],
    },
  },

  {
    name: "ucp_status",
    description: "Get Google UCP integration status — mode, spec, reach (Gemini + Google Search AI Mode), declared capabilities, merchant profile URL, and usage stats.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handlePhase24Tool(name, args) {
  switch (name) {
    // Mastercard
    case "mc_agent_register":         return await registerMcAgent(args);
    case "mc_agent_pay":              return await agentPay(args);
    case "mc_insight_token":          return await requestInsightToken(args);
    case "mc_status":                 return getMcStatus();
    // Stripe
    case "stripe_customer_create":    return await createCustomer(args);
    case "stripe_payment_intent":     return await createPaymentIntent(args);
    case "stripe_subscription_create":return await createSubscription(args);
    case "stripe_invoice_create":     return await createInvoice(args);
    case "stripe_checkout_session":   return await createCheckoutSession(args);
    case "stripe_customers_list":     return await listCustomers(args);
    case "stripe_refund_create":      return await createRefund(args);
    case "stripe_status":             return getStripeStatus();
    // OpenAI ACP
    case "acp_product_feed":          return await pushProductFeed(args);
    case "acp_session_create":        return await createAcpSession(args);
    case "acp_session_complete":      return await completeAcpSession(args);
    case "acp_products_list":         return await listAcpProducts(args);
    case "acp_status":                return getAcpStatus();
    // Google UCP
    case "ucp_merchant_register":     return await registerUcpMerchant(args);
    case "ucp_checkout_create":       return await createUcpCheckout(args);
    case "ucp_checkout_complete":     return await completeUcpCheckout(args);
    case "ucp_identity_link":         return await linkUcpIdentity(args);
    case "ucp_order_status":          return await getUcpOrderStatus(args);
    case "ucp_status":                return getUcpStatus();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
