// Phase 28: Energy Trading + Telecom Operations

import * as energyTrading from "./services/energy-trading.js";
import * as telecomOps from "./services/telecom-ops.js";

export const phase28EnergyTelecomTools = [
  // ─── Energy Trading ─────────────────────────────────────────────────────────
  {
    name: "energy_create_product",
    description:
      "Create an energy market product (e.g., day-ahead hourly node product). Returns product with delivery window.",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", description: "Market/ISO (e.g., ERCOT, CAISO, PJM)" },
        product_code: { type: "string", description: "Product code / label (e.g., HB_NORTH_1H)" },
        product_type: { type: "string", enum: ["DA", "RT", "FTR", "REC"], description: "Product type" },
        node: { type: "string", description: "Node / hub / zone" },
        delivery_hours: { type: "number", description: "Delivery duration in hours (default 1)" },
      },
      required: ["market", "product_code", "node"],
    },
  },
  {
    name: "energy_place_order",
    description:
      "Place an energy order (buy/sell MW at a limit price) with book risk limit enforcement.",
    inputSchema: {
      type: "object",
      properties: {
        book_name: { type: "string", description: "Trading book name (e.g., Wind Hedge)" },
        product_id: { type: "string", description: "Energy product id" },
        side: { type: "string", enum: ["buy", "sell"], description: "Order side" },
        quantity_mw: { type: "number", description: "Quantity in MW" },
        limit_price: { type: "number", description: "Limit price in $/MWh" },
      },
      required: ["book_name", "product_id", "side", "quantity_mw", "limit_price"],
    },
  },
  {
    name: "energy_fill_order",
    description: "Mark an energy order as filled and create a position entry at a cleared price.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Energy order id" },
        cleared_price: { type: "number", description: "Cleared price in $/MWh" },
      },
      required: ["order_id", "cleared_price"],
    },
  },
  {
    name: "energy_settle_product",
    description:
      "Settle a product against a market price and compute simplified PnL using positions for the book/product.",
    inputSchema: {
      type: "object",
      properties: {
        book_name: { type: "string", description: "Trading book name" },
        product_id: { type: "string", description: "Energy product id" },
        market_price: { type: "number", description: "Settlement market price in $/MWh" },
      },
      required: ["book_name", "product_id", "market_price"],
    },
  },

  // ─── Telecom Ops ────────────────────────────────────────────────────────────
  {
    name: "telecom_order_circuit",
    description:
      "Order/provision a telecom circuit (internet/MPLS/SD-WAN/SIP trunk/wavelength) for an account/site.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Customer account name" },
        circuit_id: { type: "string", description: "Provider circuit identifier" },
        circuit_type: {
          type: "string",
          enum: ["internet", "mpls", "sdwan", "sip_trunk", "wavelength"],
          description: "Circuit type",
        },
        site_address: { type: "string", description: "Service address" },
        bandwidth_mbps: { type: "number", description: "Bandwidth in Mbps (default 100)" },
      },
      required: ["account_name", "circuit_id", "site_address"],
    },
  },
  {
    name: "telecom_update_circuit_status",
    description: "Update telecom circuit status (ordered/provisioning/active/etc.).",
    inputSchema: {
      type: "object",
      properties: {
        circuit_id: { type: "string", description: "Provider circuit identifier" },
        status: {
          type: "string",
          enum: ["ordered", "provisioning", "active", "suspended", "decommissioned"],
          description: "New status",
        },
      },
      required: ["circuit_id", "status"],
    },
  },
  {
    name: "telecom_file_incident",
    description: "File a telecom incident for an account/circuit (outage, latency, packet loss, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Customer account name" },
        circuit_id: { type: "string", description: "Optional circuit identifier" },
        incident_type: { type: "string", enum: ["outage", "latency", "packet_loss", "security", "billing"] },
        severity: { type: "string", enum: ["sev1", "sev2", "sev3", "sev4"] },
        description: { type: "string", description: "Incident description" },
      },
      required: ["account_name", "description"],
    },
  },
  {
    name: "telecom_ack_incident",
    description: "Acknowledge a telecom incident (open -> acknowledged).",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident id" },
      },
      required: ["incident_id"],
    },
  },
  {
    name: "telecom_resolve_incident",
    description: "Resolve or otherwise close a telecom incident.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident id" },
        status: { type: "string", enum: ["resolved", "mitigated", "cancelled"] },
      },
      required: ["incident_id"],
    },
  },
  {
    name: "telecom_schedule_dispatch",
    description: "Schedule a field/remote/vendor dispatch for a telecom incident with an ETA.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident id" },
        technician: { type: "string", description: "Technician name" },
        eta_minutes: { type: "number", description: "ETA in minutes (default 90)" },
        dispatch_type: { type: "string", enum: ["field", "remote", "vendor"], description: "Dispatch type" },
      },
      required: ["incident_id", "technician"],
    },
  },
  {
    name: "telecom_update_dispatch_status",
    description: "Update dispatch status (scheduled/en_route/on_site/complete/cancelled).",
    inputSchema: {
      type: "object",
      properties: {
        dispatch_id: { type: "string", description: "Dispatch id" },
        status: { type: "string", enum: ["scheduled", "en_route", "on_site", "complete", "cancelled"] },
      },
      required: ["dispatch_id", "status"],
    },
  },
];

export function handlePhase28EnergyTelecomTool(name, args) {
  switch (name) {
    // Energy
    case "energy_create_product":
      return energyTrading.createEnergyProduct(
        args.market,
        args.product_code,
        args.product_type,
        args.node,
        args.delivery_hours
      );
    case "energy_place_order":
      return energyTrading.placeEnergyOrder(
        args.book_name,
        args.product_id,
        args.side,
        args.quantity_mw,
        args.limit_price
      );
    case "energy_fill_order":
      return energyTrading.fillEnergyOrder(args.order_id, args.cleared_price);
    case "energy_settle_product":
      return energyTrading.settleEnergyProduct(args.book_name, args.product_id, args.market_price);

    // Telecom
    case "telecom_order_circuit":
      return telecomOps.orderTelecomCircuit(
        args.account_name,
        args.circuit_id,
        args.circuit_type,
        args.site_address,
        args.bandwidth_mbps
      );
    case "telecom_update_circuit_status":
      return telecomOps.updateTelecomCircuitStatus(args.circuit_id, args.status);
    case "telecom_file_incident":
      return telecomOps.fileTelecomIncident(
        args.account_name,
        args.circuit_id,
        args.incident_type,
        args.severity,
        args.description
      );
    case "telecom_ack_incident":
      return telecomOps.acknowledgeTelecomIncident(args.incident_id);
    case "telecom_resolve_incident":
      return telecomOps.resolveTelecomIncident(args.incident_id, args.status ?? "resolved");
    case "telecom_schedule_dispatch":
      return telecomOps.scheduleTelecomDispatch(
        args.incident_id,
        args.technician,
        args.eta_minutes,
        args.dispatch_type
      );
    case "telecom_update_dispatch_status":
      return telecomOps.updateDispatchStatus(args.dispatch_id, args.status);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
