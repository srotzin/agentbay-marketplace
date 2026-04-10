/**
 * HiveAgent MCP Tool Definitions — Construction Supply Chain
 *
 * The deepest construction procurement MCP toolset in existence.
 * Built on 25 years of structural building products domain expertise.
 *
 * ── SKU & Compatibility (5 tools) ──────────────────────────────────────────────
 *   cs_sku_lookup              - Look up any product by SKU, name, or description
 *   cs_sku_compatibility       - Check if two products work together + load capacity
 *   cs_sku_alternatives        - Find alternatives meeting the same structural spec
 *   cs_sku_load_calc           - Engineering-grade load calculation with species/CD factors
 *   cs_sku_code_approval       - ICC-ES report numbers, IBC/IRC/CBC approval status
 *
 * ── Inventory & Procurement (7 tools) ──────────────────────────────────────────
 *   cs_inventory_check         - Real-time stock at local yards by zip code
 *   cs_inventory_reserve       - Reserve stock for a job (48-hour hold)
 *   cs_procurement_rfq         - Send RFQ to multiple vendors simultaneously
 *   cs_procurement_compare     - Compare quotes: price, delivery, rating
 *   cs_procurement_order       - Place PO with winning vendor (1.5% platform fee)
 *   cs_procurement_track       - Track order: confirmed→shipped→delivered
 *   cs_procurement_history     - Full procurement history by project/contractor/vendor
 *
 * ── Project & BOM (5 tools) ────────────────────────────────────────────────────
 *   cs_project_create          - Create a construction project with site parameters
 *   cs_bom_generate            - Auto-generate complete BOM from project specs
 *   cs_bom_optimize            - Find code-compliant alternatives to reduce cost
 *   cs_bom_price               - Price BOM across multiple vendors
 *   cs_project_schedule        - Procurement schedule aligned to construction phases
 *
 * ── Code Compliance (4 tools) ──────────────────────────────────────────────────
 *   cs_code_check              - Check connection vs. IBC/IRC/CBC/CBC by jurisdiction
 *   cs_inspection_schedule     - Schedule foundation/framing/MEP/final inspections
 *   cs_inspection_checklist    - Phase-specific inspector checklist
 *   cs_inspection_report       - Record inspection results, corrections, reinspect
 *
 * ── Logistics (3 tools) ────────────────────────────────────────────────────────
 *   cs_delivery_estimate       - Delivery estimate: truck type, weight, cost, ETA
 *   cs_delivery_schedule       - Schedule delivery aligned with construction phase
 *   cs_delivery_track          - Real-time delivery tracking with GPS (live mode)
 *
 * ── Contractor & Vendor (4 tools) ──────────────────────────────────────────────
 *   cs_contractor_register     - Register a licensed/insured contractor agent
 *   cs_contractor_reputation   - Reputation: completed jobs, on-time rate, quality
 *   cs_vendor_register         - Register a supplier/distributor agent
 *   cs_vendor_rating           - Vendor performance: fill rate, on-time, price
 *
 * ── Takeoff & Estimation (2 tools) ─────────────────────────────────────────────
 *   cs_takeoff                 - Smart takeoff from structural specs → full hardware list
 *   cs_estimate_project        - Full project cost: materials + labor + overhead + profit
 *
 * Revenue: $0.10–$5.00/call + 1.5% on purchase orders
 */

import {
  skuLookup,
  skuCompatibilityCheck,
  skuAlternatives,
  skuLoadCalculation,
  skuCodeApproval,
  inventoryCheck,
  inventoryReserve,
  procurementQuoteRequest,
  procurementCompareQuotes,
  procurementOrder,
  procurementTrack,
  procurementHistory,
  projectCreate,
  projectBomGenerate,
  projectBomOptimize,
  projectBomPrice,
  projectSchedule,
  codeCheck,
  inspectionSchedule,
  inspectionChecklist,
  inspectionReport,
  deliveryEstimate,
  deliverySchedule,
  deliveryTrack,
  contractorRegister,
  contractorReputation,
  vendorRegister,
  vendorRating,
  takeoffFromPlans,
  estimateProject,
} from "./services/construction-supply.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────────

export const constructionTools = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SKU & COMPATIBILITY (5 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_sku_lookup",
    description:
      "SKU & COMPATIBILITY — Look up any construction product by SKU, name, or description. " +
      "Returns full specs: load ratings (download, uplift, shear), material, finish, ICC-ES code approval " +
      "number, compatible products, unit price, pack size, weight, install notes, and species factors. " +
      "Triggers: 'what is SKU LUS210', 'find joist hangers', 'look up SDS screws', 'what connectors do I need', " +
      "'show me post bases', 'search for wedge anchors', 'what's the load rating for H1 tie'. " +
      "Use category filter: 'connectors', 'fasteners', 'anchors', 'lumber', 'concrete', 'steel', 'adhesives', 'safety'. " +
      "Fee: $0.10/query.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Exact SKU code (e.g., 'LUS210', 'ABA44', 'HDU5-SDS2.5'). Case-insensitive.",
        },
        query: {
          type: "string",
          description: "Free-text search: product name, description, or category (e.g., 'joist hanger 2x10', 'hurricane tie', 'epoxy anchor').",
        },
        category: {
          type: "string",
          description: "Filter by product category.",
          enum: ["connectors","fasteners","anchors","lumber","concrete","steel","adhesives","safety"],
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10, max: 50).",
          default: 10,
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_sku_compatibility",
    description:
      "SKU & COMPATIBILITY — Check if two construction products are compatible and return the adjusted load capacity. " +
      "Handles connector + lumber combos, anchor + hardware combos, fastener compatibility checks. " +
      "Returns: compatible (yes/no), species-adjusted load capacity, required fastener pattern, code reference. " +
      "Triggers: 'can I use LUS210 with 2x10 SPF', 'is ABA44 compatible with 4x4 post', " +
      "'what load if I use H1 with SPF rafters', 'do SDS screws work with HDU5', " +
      "'compatibility check for LVL with HGUS210'. " +
      "Species codes: DF=Douglas Fir-Larch, SPF=Spruce-Pine-Fir, HF=Hem-Fir, SP=Southern Pine. " +
      "Fee: $0.25/check.",
    inputSchema: {
      type: "object",
      properties: {
        sku_a: {
          type: "string",
          description: "First product SKU (typically the connector/hardware, e.g., 'LUS210').",
        },
        sku_b: {
          type: "string",
          description: "Second product SKU (typically the lumber/substrate, e.g., '2X10-SPF-16FT').",
        },
        species: {
          type: "string",
          description: "Lumber species code for load adjustment: DF (Douglas Fir), SPF (Spruce-Pine-Fir), HF (Hem-Fir), SP (Southern Pine).",
          default: "SPF",
          enum: ["DF","SPF","HF","SP"],
        },
      },
      required: ["sku_a","sku_b"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_sku_alternatives",
    description:
      "SKU & COMPATIBILITY — Find alternative products that meet the same structural specification as a reference SKU. " +
      "Returns alternatives sorted by price, each with load rating, code approval, and price delta vs. reference. " +
      "Useful for value engineering, substitutions when a product is out of stock, or finding lighter/cheaper options. " +
      "Triggers: 'what else can handle 2000 lbs uplift on a 4x4', 'cheaper alternative to LUS210', " +
      "'substitute for HDU5 hold-down', 'find alternatives to epoxy anchors', 'value engineer my connector list'. " +
      "Fee: $0.25/query.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Reference SKU to find alternatives for (e.g., 'LUS210'). Optional if min_load_lbs and category are specified.",
        },
        min_load_lbs: {
          type: "number",
          description: "Minimum required load rating in lbs. Defaults to the reference SKU's load rating.",
        },
        category: {
          type: "string",
          description: "Product category to search within. Defaults to reference SKU's category.",
          enum: ["connectors","fasteners","anchors","lumber","concrete","steel","adhesives","safety"],
        },
        subcategory: {
          type: "string",
          description: "Product subcategory (e.g., 'joist-hangers', 'post-bases', 'hold-downs', 'mechanical-anchors').",
        },
        max_price: {
          type: "number",
          description: "Maximum unit price in USD. Leave unset to return all alternatives.",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_sku_load_calc",
    description:
      "SKU & COMPATIBILITY — Engineering-grade load capacity calculation for a specific product. " +
      "Applies species reduction factor (Cm), load duration factor (CD), and loading direction to compute " +
      "adjusted allowable loads for download, uplift, and shear. " +
      "Triggers: 'calculate load capacity of LUS210 in DF lumber', 'what's the wind uplift capacity of H2-5 at CD=1.6', " +
      "'seismic adjusted load for HDU5', 'what's the shear capacity of ABA66 in SPF', " +
      "'engineering load calculation for epoxy anchors'. " +
      "Duration factors: normal=1.0, floor live=1.0, roof snow=1.15, construction=1.25, wind/seismic=1.6. " +
      "Fee: $1.00/calculation.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU to calculate load capacity for (e.g., 'LUS210', 'HDU5-SDS2.5', 'H2-5').",
        },
        species: {
          type: "string",
          description: "Lumber species: DF=Douglas Fir, SPF=Spruce-Pine-Fir, HF=Hem-Fir, SP=Southern Pine.",
          default: "SPF",
          enum: ["DF","SPF","HF","SP"],
        },
        loading_direction: {
          type: "string",
          description: "Primary loading direction to compute governing load.",
          default: "vertical",
          enum: ["vertical","uplift","shear"],
        },
        duration_factor: {
          type: "number",
          description: "Load duration factor (CD): 1.0=normal, 1.15=2-month/snow, 1.25=7-day/construction, 1.6=wind/seismic.",
          default: 1.0,
        },
      },
      required: ["sku"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_sku_code_approval",
    description:
      "SKU & COMPATIBILITY — Look up code approval status for a product: ICC-ES report number, applicable building codes " +
      "(IBC 2021, IRC 2021, CBC 2022), and jurisdiction-specific notes (Florida HVHZ, California DSA/OSHPD). " +
      "Returns pass/fail status per code and special requirements for specific jurisdictions. " +
      "Triggers: 'is LUS210 IBC approved', 'what ICC-ES report covers HDU5', 'can I use ABA44 in Florida HVHZ', " +
      "'is this connector approved for California hospitals', 'code approval for wedge anchors', " +
      "'what building codes cover this product'. " +
      "Fee: $0.25/query.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU to check code approval for (e.g., 'LUS210', 'WEDGE-ANCHOR-0.5X3.5').",
        },
        jurisdiction: {
          type: "string",
          description: "State or jurisdiction code for special requirements (e.g., 'FL', 'CA', 'TX', 'NY'). Optional.",
        },
      },
      required: ["sku"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY & PROCUREMENT (7 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_inventory_check",
    description:
      "INVENTORY & PROCUREMENT — Check real-time stock for a product at local supply yards, filtered by zip code or state. " +
      "Returns: in-stock quantities at each yard, available vs. reserved, nearest yard with sufficient stock, " +
      "lead time if backordered. " +
      "Triggers: 'is LUS210 in stock near 94103', 'check inventory for joist hangers in California', " +
      "'do any yards have 500 HDU5 in stock', 'what's the lead time for LVL near Seattle', " +
      "'nearest yard with SDS screws', 'backorder status for ABA66'. " +
      "Fee: $0.15/check.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU to check inventory for (e.g., 'LUS210', 'ABA44').",
        },
        zip_code: {
          type: "string",
          description: "Job site zip code to find nearest yard with stock (e.g., '94103').",
        },
        state: {
          type: "string",
          description: "State code to filter inventory locations (e.g., 'CA', 'WA', 'TX').",
        },
        qty_needed: {
          type: "number",
          description: "Required quantity. Tool flags whether any location has sufficient stock.",
          default: 1,
        },
      },
      required: ["sku"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_inventory_reserve",
    description:
      "INVENTORY & PROCUREMENT — Reserve stock for a specific job at a specific yard, holding inventory for 48 hours. " +
      "Returns reservation ID and expiry. Reduces available quantity immediately. " +
      "Triggers: 'reserve 200 LUS210 at the SF yard', 'hold joist hangers for my project', " +
      "'lock in inventory for framing this week', 'reserve ABA44 post bases for Job #2024-09'. " +
      "Requires yard_id from cs_inventory_check. Hold expires automatically after hold_hours. " +
      "Fee: $0.50/reservation.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU to reserve (e.g., 'LUS210').",
        },
        qty: {
          type: "number",
          description: "Quantity to reserve.",
        },
        yard_id: {
          type: "string",
          description: "Yard identifier from cs_inventory_check results (e.g., 'yard-abc-sf-94103').",
        },
        project_id: {
          type: "string",
          description: "Project ID to associate the reservation with. Optional.",
        },
        hold_hours: {
          type: "number",
          description: "Hours to hold the inventory reservation. Default 48. Max 120.",
          default: 48,
        },
      },
      required: ["sku","qty","yard_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_procurement_rfq",
    description:
      "INVENTORY & PROCUREMENT — Send a Request for Quote (RFQ) to multiple vendors simultaneously. " +
      "Specify line items (SKU + qty), delivery address, required date, and optional vendor list. " +
      "Returns quotes from each vendor with unit prices, shipping costs, delivery timelines, and total. " +
      "Triggers: 'get quotes for my hardware list', 'RFQ to all vendors for framing connectors', " +
      "'request pricing for 500 joist hangers and 20 LVL beams', 'compare supplier pricing for BOM', " +
      "'send RFQ to ABC Supply and Fastenal'. " +
      "Fee: $1.00/RFQ.",
    inputSchema: {
      type: "object",
      properties: {
        line_items: {
          type: "array",
          description: "Products and quantities to quote. Each item requires sku and qty.",
          items: {
            type: "object",
            properties: {
              sku:  { type: "string", description: "Product SKU (e.g., 'LUS210')" },
              qty:  { type: "number", description: "Quantity needed" },
            },
            required: ["sku","qty"],
          },
        },
        delivery_address: {
          type: "string",
          description: "Delivery address for the job site.",
        },
        required_date: {
          type: "string",
          description: "Required delivery date (YYYY-MM-DD).",
        },
        vendor_ids: {
          type: "array",
          description: "Specific vendor IDs to request quotes from. Leave empty to auto-select top 3 vendors.",
          items: { type: "string" },
        },
        notes: {
          type: "string",
          description: "Special instructions for vendors (e.g., 'Must be HDG finish only', 'Palletized delivery required').",
        },
      },
      required: ["line_items"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_procurement_compare",
    description:
      "INVENTORY & PROCUREMENT — Compare all received quotes for an RFQ. Scores each quote on price (50%), " +
      "vendor rating (30%), and delivery speed (20%). Returns ranked list with recommended vendor. " +
      "Triggers: 'compare quotes for RFQ-ABCD1234', 'which vendor should I pick', 'rank the bids', " +
      "'who has the best price vs. delivery', 'compare my quotes'. " +
      "Requires rfq_id from cs_procurement_rfq. " +
      "Fee: $0.50/comparison.",
    inputSchema: {
      type: "object",
      properties: {
        rfq_id: {
          type: "string",
          description: "RFQ identifier from cs_procurement_rfq (e.g., 'RFQ-ABCD1234').",
        },
      },
      required: ["rfq_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_procurement_order",
    description:
      "INVENTORY & PROCUREMENT — Place a purchase order with the winning vendor from a quote. " +
      "Confirms the order, assigns a PO number, and triggers payment via HiveAgent payment rails. " +
      "Returns order_id, order_number, expected delivery, and platform fee (1.5% of order value). " +
      "Triggers: 'place order for quote QT-ABCD1234', 'order from the cheapest vendor', " +
      "'confirm PO for the framing hardware', 'submit purchase order', 'buy the materials'. " +
      "Fee: 1.5% of order total.",
    inputSchema: {
      type: "object",
      properties: {
        quote_id: {
          type: "string",
          description: "Quote ID to convert to a purchase order (e.g., 'QT-ABCD1234').",
        },
        project_id: {
          type: "string",
          description: "Project ID to associate the order with. Optional.",
        },
        contractor_id: {
          type: "string",
          description: "Contractor ID placing the order. Optional.",
        },
        delivery_address: {
          type: "string",
          description: "Delivery address for the order.",
        },
        required_date: {
          type: "string",
          description: "Required delivery date (YYYY-MM-DD).",
        },
        po_number: {
          type: "string",
          description: "Your own PO number for reference. Optional.",
        },
      },
      required: ["quote_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_procurement_track",
    description:
      "INVENTORY & PROCUREMENT — Track the status of a purchase order: draft → submitted → confirmed → shipped → in-transit → delivered. " +
      "Returns current status, tracking number, next milestone, and ETA. " +
      "Triggers: 'where is my order PO-12345678', 'track my LVL delivery', 'order status for my hardware', " +
      "'when will the joist hangers arrive', 'track order ID abc123'. " +
      "Fee: $0.25/track.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order UUID from cs_procurement_order.",
        },
        order_number: {
          type: "string",
          description: "Human-readable order number (e.g., 'PO-12345678').",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_procurement_history",
    description:
      "INVENTORY & PROCUREMENT — Full procurement history for a project, contractor, or vendor. " +
      "Returns all orders with status, totals, and volume analysis. Useful for spend analysis and vendor performance reviews. " +
      "Triggers: 'show all orders for project abc', 'procurement history for contractor xyz', " +
      "'how much have we spent on hardware', 'vendor order history for ABC Supply', " +
      "'spending breakdown by project', 'total materials cost'. " +
      "Fee: $0.50/query.",
    inputSchema: {
      type: "object",
      properties: {
        project_id:    { type: "string", description: "Filter orders by project ID." },
        contractor_id: { type: "string", description: "Filter orders by contractor ID." },
        vendor_id:     { type: "string", description: "Filter orders by vendor ID." },
        limit:         { type: "number", description: "Maximum orders to return (default: 20).", default: 20 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT & BOM MANAGEMENT (5 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_project_create",
    description:
      "PROJECT & BOM — Create a new construction project with site parameters: address, project type, " +
      "seismic zone, design wind speed, snow load, floor load, and framing type. " +
      "These parameters drive all BOM generation, code checks, and schedule tools. " +
      "Triggers: 'create new project for 123 Main St', 'start a new construction project', " +
      "'set up a 2400 sqft residential project in seismic zone D', 'new commercial project'. " +
      "Project types: residential, commercial, industrial, mixed-use. " +
      "Fee: $1.00/project.",
    inputSchema: {
      type: "object",
      properties: {
        name:            { type: "string", description: "Project name (e.g., 'Smith Residence Remodel')." },
        address:         { type: "string", description: "Project site address." },
        city:            { type: "string", description: "City." },
        state:           { type: "string", description: "State code (e.g., 'CA', 'TX', 'FL')." },
        zip_code:        { type: "string", description: "ZIP code." },
        project_type: {
          type: "string",
          description: "Project type.",
          enum: ["residential","commercial","industrial","mixed-use"],
          default: "residential",
        },
        scope:           { type: "string", description: "Scope description (e.g., '2-story wood-frame single family, 2400 sqft')." },
        seismic_zone: {
          type: "string",
          description: "ASCE 7 seismic design category: A (low) through F (high seismic). Most of California is D/E.",
          default: "C",
          enum: ["A","B","C","D","E","F"],
        },
        wind_speed_mph:  { type: "number", description: "ASCE 7 design wind speed (mph). Coastal Florida = 160+, Midwest = 115.", default: 115 },
        snow_load_psf:   { type: "number", description: "Ground snow load (psf). Mountain areas 50+, coastal areas near 0.", default: 25 },
        floor_load_psf:  { type: "number", description: "Design floor live load (psf). Residential = 40, commercial = 50-100.", default: 40 },
        sqft:            { type: "number", description: "Total conditioned floor area (sqft)." },
        stories:         { type: "number", description: "Number of stories above grade.", default: 1 },
        framing_type: {
          type: "string",
          description: "Primary structural framing system.",
          default: "wood-frame",
          enum: ["wood-frame","steel-frame","masonry","concrete","mixed"],
        },
        estimated_budget: { type: "number", description: "Total project budget in USD." },
      },
      required: ["name","address","project_type"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_bom_generate",
    description:
      "PROJECT & BOM — Auto-generate a complete Bill of Materials from project specifications. " +
      "Provides engineering-grade quantity takeoffs for all structural connectors, fasteners, anchors, " +
      "engineered lumber, concrete, and safety equipment — scaled to sqft, stories, seismic zone, and wind speed. " +
      "Triggers: '2-story 2400 sqft house seismic zone D generate BOM', 'what hardware do I need for this job', " +
      "'generate complete hardware list', 'BOM for wood-frame residential 1800 sqft', " +
      "'full material list for framing'. " +
      "Returns: line-by-line BOM with quantities, unit prices, extended costs, and reasoning. " +
      "Fee: $5.00/BOM.",
    inputSchema: {
      type: "object",
      properties: {
        project_id:      { type: "string", description: "Project ID from cs_project_create. Saves BOM to project record." },
        sqft:            { type: "number", description: "Total floor area (sqft).", default: 2000 },
        stories:         { type: "number", description: "Number of stories.", default: 1 },
        seismic_zone: {
          type: "string",
          description: "Seismic design category (A–F). Higher zones require more hold-downs and strap ties.",
          default: "C",
          enum: ["A","B","C","D","E","F"],
        },
        framing_type: {
          type: "string",
          description: "Framing system type.",
          default: "wood-frame",
          enum: ["wood-frame","steel-frame","masonry"],
        },
        joist_spacing_in: { type: "number", description: "Floor joist spacing in inches (12, 16, 19.2, or 24).", default: 16 },
        joist_span_ft:    { type: "number", description: "Typical floor joist span in feet.", default: 14 },
        header_span_ft:   { type: "number", description: "Largest header/beam span in feet (drives LVL sizing).", default: 10 },
        wind_speed_mph:   { type: "number", description: "Design wind speed (mph).", default: 115 },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_bom_optimize",
    description:
      "PROJECT & BOM — Optimize a Bill of Materials by finding code-compliant substitutions that reduce cost. " +
      "Compares each line item against alternatives with equal or greater load capacity, same code approvals. " +
      "Returns substituted BOM with total savings and per-item notes on why the sub is code-compliant. " +
      "Triggers: 'value engineer my BOM', 'find cheaper alternatives for my hardware list', " +
      "'reduce material cost while meeting code', 'optimize the connector list', " +
      "'find lower-cost substitutes for my takeoff'. " +
      "Fee: $3.00/optimize.",
    inputSchema: {
      type: "object",
      properties: {
        bom: {
          type: "array",
          description: "Bill of materials to optimize. Each item: sku, name, qty.",
          items: {
            type: "object",
            properties: {
              sku:  { type: "string" },
              name: { type: "string" },
              qty:  { type: "number" },
              unit_price: { type: "number", description: "Optional current unit price for savings calculation." },
            },
            required: ["sku","qty"],
          },
        },
        seismic_zone:    { type: "string", description: "Seismic zone (A-F) to ensure substitutes meet requirements.", default: "C" },
        max_savings_pct: { type: "number", description: "Maximum allowed price reduction per item (%). Prevents downgrading to marginal products.", default: 20 },
      },
      required: ["bom"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_bom_price",
    description:
      "PROJECT & BOM — Price out an entire Bill of Materials across multiple vendors. " +
      "Returns vendor-by-vendor breakdown showing unit prices, line totals, shipping, and grand total. " +
      "Identifies lowest-cost vendor. " +
      "Triggers: 'price my BOM across all vendors', 'total cost of my material list', " +
      "'which vendor is cheapest for my whole order', 'get pricing for the full BOM', " +
      "'cost comparison across suppliers'. " +
      "Fee: $2.00/pricing.",
    inputSchema: {
      type: "object",
      properties: {
        bom: {
          type: "array",
          description: "Bill of materials to price. Each item: sku, name, qty.",
          items: {
            type: "object",
            properties: {
              sku:  { type: "string", description: "Product SKU" },
              name: { type: "string", description: "Product name (optional, for display)" },
              qty:  { type: "number", description: "Quantity needed" },
            },
            required: ["sku","qty"],
          },
        },
        vendor_ids: {
          type: "array",
          description: "Specific vendor IDs to price with. Leave empty for top 3 vendors.",
          items: { type: "string" },
        },
      },
      required: ["bom"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_project_schedule",
    description:
      "PROJECT & BOM — Generate a procurement schedule aligned to construction phases. " +
      "Outputs phase-by-phase delivery schedule: Site Work → Foundation → Floor Framing → Wall Framing → " +
      "Roof Framing → Sheathing → Rough MEP → Insulation. Each phase includes: start/end dates, " +
      "procurement deadline (3 days before start), and which SKUs to order for that phase. " +
      "Triggers: 'create a procurement schedule starting March 1', 'when should I order each material', " +
      "'schedule deliveries for my construction phases', 'align hardware orders with framing schedule'. " +
      "Fee: $2.00/schedule.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID from cs_project_create. Optional." },
        start_date: { type: "string", description: "Construction start date (YYYY-MM-DD). Defaults to today." },
        sqft:       { type: "number", description: "Project square footage (affects phase durations).", default: 2000 },
        framing_type: {
          type: "string",
          description: "Framing type affects material sequencing.",
          default: "wood-frame",
          enum: ["wood-frame","steel-frame","masonry"],
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE COMPLIANCE & INSPECTIONS (4 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_code_check",
    description:
      "CODE COMPLIANCE — Check if a specific connection or product meets building code requirements for a given jurisdiction. " +
      "Verifies IBC 2021, IRC 2021, or CBC 2022 approval and checks if the product's allowable load meets the required load. " +
      "Returns: PASS/FAIL, code reference, species-adjusted allowable load vs. required load, jurisdiction notes. " +
      "Triggers: 'does LUS210 meet IBC for 2x10 SPF', 'code check for wedge anchor at 3000 lbs uplift', " +
      "'is ABA44 IRC approved', 'will H2-5 pass code in Florida', 'code compliance for HDU5 in California'. " +
      "Fee: $1.00/check.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU to check (e.g., 'LUS210', 'HDU5-SDS2.5', 'WEDGE-ANCHOR-0.5X3.5').",
        },
        jurisdiction: {
          type: "string",
          description: "Building code jurisdiction: IBC (International), IRC (Residential), CBC (California). State code for extras: CA, FL, TX.",
          default: "IBC",
          enum: ["IBC","IRC","CBC","CA","FL","TX","NY","WA","OR"],
        },
        connection_type: {
          type: "string",
          description: "Type of structural connection being checked (e.g., 'joist hanger', 'post base', 'hold-down', 'anchor bolt').",
        },
        load_lbs: {
          type: "number",
          description: "Required structural load in lbs. If provided, checks whether product's allowable load is sufficient.",
        },
        species: {
          type: "string",
          description: "Lumber species for load adjustment: DF, SPF, HF, SP.",
          default: "SPF",
          enum: ["DF","SPF","HF","SP"],
        },
      },
      required: ["sku"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_inspection_schedule",
    description:
      "CODE COMPLIANCE — Schedule a building inspection for a specific construction phase. " +
      "Phases: foundation, framing, rough_mep, insulation, final. Records inspector assignment, " +
      "permit number, and jurisdiction. " +
      "Triggers: 'schedule framing inspection for next Tuesday', 'book foundation inspection', " +
      "'set up rough MEP inspection', 'schedule final inspection', 'create inspection for permit 2024-01234'. " +
      "Fee: $0.50/schedule.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Project ID (required).",
        },
        phase: {
          type: "string",
          description: "Construction phase to inspect.",
          enum: ["foundation","framing","rough_mep","insulation","final","sheathing","partial"],
        },
        scheduled_date: {
          type: "string",
          description: "Inspection date (YYYY-MM-DD).",
        },
        inspector_name: {
          type: "string",
          description: "Inspector name (optional, assigned by AHJ).",
        },
        permit_number: {
          type: "string",
          description: "Building permit number.",
        },
        jurisdiction: {
          type: "string",
          description: "AHJ (Authority Having Jurisdiction) name (e.g., 'City of San Francisco', 'LA County').",
        },
      },
      required: ["project_id","phase"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_inspection_checklist",
    description:
      "CODE COMPLIANCE — Generate a phase-specific inspection checklist showing exactly what the inspector will look for. " +
      "Adapts checklist for seismic zone and wind speed requirements. " +
      "Includes code references (IBC §, IRC §, AWC WFCM). " +
      "Triggers: 'what does the framing inspector check', 'generate framing inspection checklist', " +
      "'what do I need for foundation inspection', 'inspection prep list for rough MEP', " +
      "'final inspection checklist'. " +
      "Fee: $0.50/checklist.",
    inputSchema: {
      type: "object",
      properties: {
        phase: {
          type: "string",
          description: "Construction phase for checklist.",
          enum: ["foundation","framing","rough_mep","insulation","final"],
        },
        seismic_zone: {
          type: "string",
          description: "Seismic zone — adds hold-down and continuous load path items for Zone D+.",
          default: "C",
          enum: ["A","B","C","D","E","F"],
        },
        wind_speed_mph: {
          type: "number",
          description: "Design wind speed — adds HVHZ items for 130+ mph.",
          default: 115,
        },
      },
      required: ["phase"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_inspection_report",
    description:
      "CODE COMPLIANCE — Record inspection results: pass/fail per item, findings, required corrections, and reinspection date. " +
      "Updates the inspection record and project status. " +
      "Triggers: 'record framing inspection passed', 'log inspection results', 'inspection failed — record corrections needed', " +
      "'update inspection with findings', 'mark inspection as passed', 'record reinspection date'. " +
      "Fee: $0.50/report.",
    inputSchema: {
      type: "object",
      properties: {
        inspection_id: {
          type: "string",
          description: "Inspection ID from cs_inspection_schedule.",
        },
        status: {
          type: "string",
          description: "Overall inspection result.",
          enum: ["passed","failed","partial","reinspection"],
        },
        findings: {
          type: "array",
          description: "List of inspection findings (items noted by inspector).",
          items: { type: "string" },
          default: [],
        },
        corrections: {
          type: "array",
          description: "Required corrections before reinspection or final sign-off.",
          items: { type: "string" },
          default: [],
        },
        reinspect_date: {
          type: "string",
          description: "Date for reinspection if status is failed or partial (YYYY-MM-DD).",
        },
      },
      required: ["inspection_id","status"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGISTICS & DELIVERY (3 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_delivery_estimate",
    description:
      "LOGISTICS — Estimate delivery logistics for a list of construction products: total weight, truck type required " +
      "(standard flatbed, tandem axle, boom truck, ready-mix drum), access constraints, and delivery cost. " +
      "Automatically recommends boom truck for oversize lumber, ready-mix drum for concrete. " +
      "Triggers: 'estimate delivery for my LVL and hardware order', 'what truck do I need to deliver these materials', " +
      "'delivery cost estimate for 5000 lbs of hardware', 'can a standard flatbed deliver my order', " +
      "'concrete delivery estimate'. " +
      "Fee: $0.25/estimate.",
    inputSchema: {
      type: "object",
      properties: {
        sku_list: {
          type: "array",
          description: "Products and quantities to estimate delivery for.",
          items: {
            type: "object",
            properties: {
              sku: { type: "string", description: "Product SKU" },
              qty: { type: "number", description: "Quantity" },
            },
            required: ["sku","qty"],
          },
        },
        total_weight_lbs: {
          type: "number",
          description: "Total estimated weight in lbs (optional — calculated from sku_list if not provided).",
        },
        delivery_address: {
          type: "string",
          description: "Delivery address (for access assessment).",
        },
        access_constraints: {
          type: "array",
          description: "Site access constraints (e.g., 'low overhead wire', 'gravel driveway', 'narrow gate 8ft', 'no 53ft trucks').",
          items: { type: "string" },
          default: [],
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_delivery_schedule",
    description:
      "LOGISTICS — Schedule or reschedule delivery for a placed order, aligned to a specific construction phase. " +
      "Sets the required delivery date and phase notes on the order record. " +
      "Triggers: 'schedule delivery for framing week', 'deliver hardware on March 15', " +
      "'push delivery to align with framing start', 'schedule concrete pour for Thursday', " +
      "'update delivery date for PO-12345678'. " +
      "Fee: $0.50/schedule.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order ID from cs_procurement_order.",
        },
        delivery_date: {
          type: "string",
          description: "Requested delivery date (YYYY-MM-DD).",
        },
        phase: {
          type: "string",
          description: "Construction phase this delivery supports (e.g., 'foundation', 'framing', 'roofing').",
        },
        notes: {
          type: "string",
          description: "Delivery instructions (e.g., 'Stack on north side of lot', 'Call 30 min before arrival').",
        },
      },
      required: ["order_id","delivery_date"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_delivery_track",
    description:
      "LOGISTICS — Real-time delivery tracking for a construction order. Returns current status, tracking number, " +
      "GPS coordinates (live mode), and ETA. " +
      "Triggers: 'where is my LVL delivery', 'track order PO-12345678', 'has my hardware shipped', " +
      "'tracking number for my order', 'where is the concrete truck', 'ETA for my delivery'. " +
      "Fee: $0.25/track.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order ID from cs_procurement_order.",
        },
        tracking_number: {
          type: "string",
          description: "Tracking number (if known from order confirmation).",
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRACTOR & VENDOR MANAGEMENT (4 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_contractor_register",
    description:
      "CONTRACTOR & VENDOR — Register a licensed contractor agent on the HiveAgent network. " +
      "Stores: contractor name, state license number, specialties, territory, insurance expiry, and bonding amount. " +
      "Required before a contractor can place orders, reserve inventory, or receive RFQs. " +
      "Triggers: 'register contractor John Smith Framing', 'onboard new framing contractor', " +
      "'add contractor with license CA-123456', 'register roofing subcontractor'. " +
      "Fee: $2.00/registration.",
    inputSchema: {
      type: "object",
      properties: {
        name:           { type: "string", description: "Contractor business name." },
        license_number: { type: "string", description: "State contractor license number." },
        state:          { type: "string", description: "State of licensure (e.g., 'CA', 'TX')." },
        specialties: {
          type: "array",
          description: "Trade specialties (e.g., ['framing','foundation','roofing','concrete']).",
          items: { type: "string" },
          default: [],
        },
        territory: {
          type: "array",
          description: "Service area zip codes or counties.",
          items: { type: "string" },
          default: [],
        },
        insurance_exp: {
          type: "string",
          description: "General liability insurance expiry date (YYYY-MM-DD).",
        },
        bonding_amount: {
          type: "number",
          description: "Contractor bond amount in USD.",
        },
      },
      required: ["name","state"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_contractor_reputation",
    description:
      "CONTRACTOR & VENDOR — Look up contractor reputation profile: completed jobs, on-time rate, quality score, " +
      "payment history, license status, and insurance currency. " +
      "Triggers: 'check reputation for contractor abc123', 'how many jobs has this contractor completed', " +
      "'contractor quality score', 'is their insurance current', 'contractor rating and reviews'. " +
      "Fee: $0.25/query.",
    inputSchema: {
      type: "object",
      properties: {
        contractor_id: {
          type: "string",
          description: "Contractor ID from cs_contractor_register.",
        },
      },
      required: ["contractor_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  {
    name: "cs_vendor_register",
    description:
      "CONTRACTOR & VENDOR — Register a new supply vendor/distributor on the HiveAgent network. " +
      "Stores: vendor name, type (manufacturer/distributor/wholesaler/dealer/online), product lines, " +
      "service territories, minimum order, and lead times. " +
      "Triggers: 'add new vendor Pacific Connectors', 'register lumber yard as vendor', " +
      "'onboard new hardware distributor', 'add supplier to the network'. " +
      "Fee: $2.00/registration.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vendor/company name." },
        type: {
          type: "string",
          description: "Vendor type.",
          enum: ["manufacturer","distributor","wholesaler","dealer","online"],
          default: "distributor",
        },
        product_lines: {
          type: "array",
          description: "Product categories carried (e.g., ['connectors','fasteners','lumber','anchors']).",
          items: { type: "string" },
          default: [],
        },
        territories: {
          type: "array",
          description: "Service territories as state codes or 'ALL' (e.g., ['CA','OR','WA'] or ['ALL']).",
          items: { type: "string" },
          default: [],
        },
        min_order_usd: { type: "number", description: "Minimum order value in USD.", default: 0 },
        lead_time_days: { type: "number", description: "Standard lead time in business days.", default: 5 },
        contact_email:  { type: "string", description: "Vendor order email." },
        contact_phone:  { type: "string", description: "Vendor phone number." },
        notes:          { type: "string", description: "Additional notes about this vendor." },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_vendor_rating",
    description:
      "CONTRACTOR & VENDOR — Look up vendor performance metrics: overall rating, fill rate (% of orders fully filled), " +
      "on-time delivery percentage, total order volume, lead time, and product lines. " +
      "Useful for vendor selection and annual vendor reviews. " +
      "Triggers: 'vendor rating for ABC Supply', 'what's the fill rate for vendor xyz', " +
      "'vendor performance review', 'on-time delivery stats for my suppliers', " +
      "'which vendors have the best fill rates'. " +
      "Fee: $0.25/query.",
    inputSchema: {
      type: "object",
      properties: {
        vendor_id: {
          type: "string",
          description: "Vendor ID (e.g., 'vendor-abc-supply', 'vendor-fastenal'). Use cs_procurement_history to find vendor IDs.",
        },
      },
      required: ["vendor_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAKEOFF & ESTIMATION (2 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "cs_takeoff",
    description:
      "TAKEOFF & ESTIMATION — Smart structural hardware takeoff from plan specifications. " +
      "Input: joist type, span, spacing, header spans, seismic zone, wind speed, sqft. " +
      "Output: complete connector, fastener, anchor, and LVL list — every hanger, strap, hold-down, " +
      "anchor bolt, and screw box needed for the framing package. With quantities and pricing. " +
      "Triggers: '24-ft span TJI floor system 16 OC takeoff', 'hardware list for 20-ft LVL headers', " +
      "'framing connector takeoff seismic zone D', 'what connectors do I need for 2400 sqft wood frame', " +
      "'complete hardware takeoff from structural specs', 'structural connector schedule for house plans'. " +
      "Fee: $5.00/takeoff.",
    inputSchema: {
      type: "object",
      properties: {
        project_sqft:     { type: "number", description: "Total project floor area (sqft) for quantity scaling.", default: 1000 },
        span_ft:          { type: "number", description: "Primary structural span in feet (longest joist/rafter span)." },
        joist_type: {
          type: "string",
          description: "Joist/rafter type: '2x10', '2x12', '2x6', 'I-joist 9.5', 'I-joist 11.875', 'TJI-360', 'LVL'.",
          default: "2x10",
        },
        joist_spacing_in: { type: "number", description: "Joist spacing in inches (12, 16, 19.2, or 24).", default: 16 },
        header_spans: {
          type: "array",
          description: "List of header/beam span lengths in feet (e.g., [8, 12, 16] for a house with three openings).",
          items: { type: "number" },
          default: [],
        },
        seismic_zone: {
          type: "string",
          description: "Seismic design category — drives hold-down count and anchor type.",
          default: "C",
          enum: ["A","B","C","D","E","F"],
        },
        wind_speed_mph: {
          type: "number",
          description: "Design wind speed (mph) — drives hurricane tie selection.",
          default: 115,
        },
        species: {
          type: "string",
          description: "Lumber species: DF, SPF, HF, SP.",
          default: "SPF",
          enum: ["DF","SPF","HF","SP"],
        },
        notes: {
          type: "string",
          description: "Additional notes about the structural system (e.g., 'cantilevered deck', 'hip roof', 'transfer beam at floor 2').",
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

  {
    name: "cs_estimate_project",
    description:
      "TAKEOFF & ESTIMATION — Full project cost estimate combining materials (from BOM pricing), labor (from local rates), " +
      "subcontractors, overhead, and profit margin. Returns total project cost and cost per sqft. " +
      "Supports three quality levels: standard (tract home), premium (custom), luxury. " +
      "Triggers: 'estimate total cost for 2400 sqft residential', 'what will this project cost to build', " +
      "'full project budget estimate', 'materials and labor cost for wood-frame house', " +
      "'cost per sqft for seismic zone D construction'. " +
      "Fee: $5.00/estimate.",
    inputSchema: {
      type: "object",
      properties: {
        project_type: {
          type: "string",
          description: "Project type for labor rate selection.",
          enum: ["residential","commercial","industrial","mixed-use"],
          default: "residential",
        },
        sqft: { type: "number", description: "Total floor area (sqft)." },
        stories: { type: "number", description: "Number of stories.", default: 1 },
        seismic_zone: {
          type: "string",
          description: "Seismic design category — affects connector and anchor costs.",
          default: "C",
          enum: ["A","B","C","D","E","F"],
        },
        framing_type: {
          type: "string",
          description: "Framing system.",
          default: "wood-frame",
          enum: ["wood-frame","steel-frame","masonry","concrete"],
        },
        quality_level: {
          type: "string",
          description: "Quality tier: standard (tract/production), premium (custom), luxury (high-end custom).",
          default: "standard",
          enum: ["standard","premium","luxury"],
        },
        overhead_pct: {
          type: "number",
          description: "Overhead percentage applied to direct costs (default 15%).",
          default: 0.15,
        },
        profit_pct: {
          type: "number",
          description: "Profit margin percentage (default 10%).",
          default: 0.10,
        },
        labor_rate_usd_per_sqft: {
          type: "number",
          description: "Regional labor rate in $/sqft. US average ~$28, CA/NY ~$45, rural midwest ~$18.",
          default: 28,
        },
      },
      required: ["sqft"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },

];

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function handleConstructionTool(name, args) {
  switch (name) {

    // SKU & Compatibility
    case "cs_sku_lookup":          return await skuLookup(args);
    case "cs_sku_compatibility":   return await skuCompatibilityCheck(args);
    case "cs_sku_alternatives":    return await skuAlternatives(args);
    case "cs_sku_load_calc":       return await skuLoadCalculation(args);
    case "cs_sku_code_approval":   return await skuCodeApproval(args);

    // Inventory & Procurement
    case "cs_inventory_check":     return await inventoryCheck(args);
    case "cs_inventory_reserve":   return await inventoryReserve(args);
    case "cs_procurement_rfq":     return await procurementQuoteRequest(args);
    case "cs_procurement_compare": return await procurementCompareQuotes(args);
    case "cs_procurement_order":   return await procurementOrder(args);
    case "cs_procurement_track":   return await procurementTrack(args);
    case "cs_procurement_history": return await procurementHistory(args);

    // Project & BOM
    case "cs_project_create":      return await projectCreate(args);
    case "cs_bom_generate":        return await projectBomGenerate(args);
    case "cs_bom_optimize":        return await projectBomOptimize(args);
    case "cs_bom_price":           return await projectBomPrice(args);
    case "cs_project_schedule":    return await projectSchedule(args);

    // Code Compliance
    case "cs_code_check":          return await codeCheck(args);
    case "cs_inspection_schedule": return await inspectionSchedule(args);
    case "cs_inspection_checklist":return await inspectionChecklist(args);
    case "cs_inspection_report":   return await inspectionReport(args);

    // Logistics
    case "cs_delivery_estimate":   return await deliveryEstimate(args);
    case "cs_delivery_schedule":   return await deliverySchedule(args);
    case "cs_delivery_track":      return await deliveryTrack(args);

    // Contractor & Vendor
    case "cs_contractor_register": return await contractorRegister(args);
    case "cs_contractor_reputation":return await contractorReputation(args);
    case "cs_vendor_register":     return await vendorRegister(args);
    case "cs_vendor_rating":       return await vendorRating(args);

    // Takeoff & Estimation
    case "cs_takeoff":             return await takeoffFromPlans(args);
    case "cs_estimate_project":    return await estimateProject(args);

    default:
      throw new Error(`Unknown construction tool: ${name}`);
  }
}
