// Swarm Verticals: Energy & Power + Compute Marketplace + Logistics & Routing
// 25 tools total — clear arbitrage loops that agents naturally swarm to.
// These are the verticals where agents show up without being asked:
//   - Energy: price spreads are public, repeating, and computable in seconds
//   - Compute: GPU spot markets fluctuate hourly — perfect for agent arbitrage
//   - Logistics: capacity auctions leave money on the table every day

import * as energyPower       from "./services/energy-power.js";
import * as computeMarketplace from "./services/compute-marketplace.js";
import * as logisticsRouting  from "./services/logistics-routing.js";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const swarmVerticalTools = [

  // ═══════════════════════════════════════════════════════════════════════════
  // ENERGY & POWER LOAD OPTIMIZATION (8 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "energy_prices",
    description: "Get real-time electricity pricing by grid region (CAISO, ERCOT, PJM, NYISO, MISO). Returns current $/kWh, peak vs off-peak rates, and a 24-hour price forecast. Use this before any compute or mining workload to find the cheapest window to run. Off-peak/peak spreads of 3-5x are common — highly actionable arbitrage signal.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Grid region/ISO to query. Defaults to CAISO (California).",
          default: "CAISO",
        },
        hour_utc: {
          type: "integer",
          description: "Specific UTC hour to fetch (0-23). Omit to get all 24 hours with current highlighted.",
          minimum: 0,
          maximum: 23,
        },
      },
    },
  },

  {
    name: "energy_load_shift",
    description: "Calculate the optimal time window to run compute rigs, mining hardware, or any flexible electric load to minimize energy cost. Input your total load in kW and how many hours are flexible — get back the exact hours to run and estimated savings per day, month, and year. Agents with GPU clusters or crypto miners should call this daily.",
    inputSchema: {
      type: "object",
      properties: {
        current_kw: {
          type: "number",
          description: "Total current load in kilowatts (e.g. 100 for a GPU mining farm).",
        },
        flexible_kw: {
          type: "number",
          description: "How many kW can be flexibly scheduled (can defer or shift). Defaults to 40% of current_kw.",
        },
        flex_hours: {
          type: "integer",
          description: "How many hours per day the flexible load can run. Default 8.",
          default: 8,
        },
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Grid region where the load operates.",
          default: "CAISO",
        },
        agent_id: {
          type: "string",
          description: "Agent identifier for tracking savings history.",
        },
      },
      required: ["current_kw"],
    },
  },

  {
    name: "energy_arbitrage",
    description: "Detect electricity price arbitrage opportunities — both time-of-use (buy off-peak, sell/avoid peak) and spatial (buy cheap in one ISO, sell in another). Returns ranked opportunities with exact buy/sell hours, spread per kWh, and gross profit estimate for a given volume. Run this before bidding on power contracts or charging battery storage.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Target region. Omit to scan all regions for the best cross-market opportunity.",
        },
        volume_kwh: {
          type: "number",
          description: "Volume of power to arbitrage in kWh. Default 10,000 kWh.",
          default: 10000,
        },
        strategy: {
          type: "string",
          enum: ["time", "spatial"],
          description: "Arbitrage type: 'time' (within one region across hours) or 'spatial' (between regions). Omit to find both.",
        },
      },
    },
  },

  {
    name: "energy_contract_bid",
    description: "Submit a bid on an open power purchase agreement (PPA), spot contract, futures, or capacity contract. Set your max price per kWh and desired volume — the system checks if your bid clears the ask and moves the contract to pending. Use energy_contract_list first to find open contracts.",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: {
          type: "string",
          description: "Contract ID from energy_contract_list.",
        },
        buyer_id: {
          type: "string",
          description: "Buyer agent identifier.",
        },
        max_price_kwh: {
          type: "number",
          description: "Maximum price per kWh you are willing to pay (e.g. 0.045).",
        },
        volume_kwh: {
          type: "number",
          description: "Volume in kWh you want to purchase under this contract.",
        },
        note: {
          type: "string",
          description: "Optional note attached to the bid.",
        },
      },
      required: ["contract_id", "max_price_kwh", "volume_kwh"],
    },
  },

  {
    name: "energy_contract_list",
    description: "Browse available power purchase agreements, spot contracts, and futures on the energy marketplace. Filter by region, contract type, and max price. Returns ranked by price with total cost estimate. These are real structured contracts — PPAs from solar/wind farms, grid capacity, spot desk listings.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Filter by grid region.",
        },
        contract_type: {
          type: "string",
          enum: ["ppa", "spot", "futures", "capacity"],
          description: "Filter by contract type.",
        },
        max_price_kwh: {
          type: "number",
          description: "Maximum price per kWh to show.",
        },
        status: {
          type: "string",
          enum: ["open", "pending", "active", "settled"],
          description: "Contract status filter. Default 'open'.",
          default: "open",
        },
        limit: {
          type: "integer",
          description: "Max results. Default 20.",
          default: 20,
        },
      },
    },
  },

  {
    name: "energy_solar_estimate",
    description: "Estimate solar generation capacity and revenue for a location. Input latitude/longitude, panel system size, and orientation — get back daily/annual kWh generation, revenue at current grid prices, and carbon offset. Use before signing a PPA or sizing battery storage.",
    inputSchema: {
      type: "object",
      properties: {
        lat: {
          type: "number",
          description: "Latitude of the installation site (e.g. 37.77 for San Francisco).",
        },
        lon: {
          type: "number",
          description: "Longitude of the installation site (e.g. -122.42 for San Francisco).",
        },
        panel_kw: {
          type: "number",
          description: "Total panel system capacity in kW DC. Default 100 kW.",
          default: 100,
        },
        orientation: {
          type: "string",
          enum: ["south", "southeast", "southwest", "east", "west", "north"],
          description: "Panel orientation. 'south' is optimal in the northern hemisphere.",
          default: "south",
        },
        tilt_deg: {
          type: "number",
          description: "Panel tilt angle in degrees from horizontal. Optimal ≈ site latitude. Default 30.",
          default: 30,
        },
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Grid region for revenue calculation. Affects pricing.",
          default: "CAISO",
        },
      },
      required: ["lat", "lon"],
    },
  },

  {
    name: "energy_battery_optimize",
    description: "Find the optimal charge/discharge schedule for battery storage to maximize energy arbitrage profit. Input battery capacity, charge/discharge rate, and grid region — get back the exact hours to charge (off-peak) and discharge (peak), daily profit, ROI, and payback period. This is the math behind utility-scale battery arbitrage.",
    inputSchema: {
      type: "object",
      properties: {
        capacity_kwh: {
          type: "number",
          description: "Total battery capacity in kWh (e.g. 1000 for a 1 MWh system).",
          default: 1000,
        },
        charge_rate_kw: {
          type: "number",
          description: "Maximum charge rate in kW. Default 250 kW (4-hour charge for 1 MWh system).",
          default: 250,
        },
        discharge_rate_kw: {
          type: "number",
          description: "Maximum discharge rate in kW. Default 250 kW.",
          default: 250,
        },
        region: {
          type: "string",
          enum: ["CAISO", "ERCOT", "PJM", "NYISO", "MISO"],
          description: "Grid region for pricing data.",
          default: "CAISO",
        },
        cycles_per_day: {
          type: "number",
          description: "How many charge/discharge cycles per day. Default 1.",
          default: 1,
        },
      },
    },
  },

  {
    name: "energy_dashboard",
    description: "Portfolio view of energy activity: active contracts, current costs, load shift savings achieved, and top detected arbitrage opportunities. Call this to get a summary of your agent's energy position and outstanding actions.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Filter to a specific agent's contracts and loads. Omit for platform-wide view.",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTE MARKETPLACE (9 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "compute_list_providers",
    description: "Browse available GPU compute providers: H100, A100, L40S, RTX 4090, A10G, T4 — with VRAM, pricing per hour, spot pricing, benchmark scores, uptime, and latency. Filter by GPU type, VRAM requirement, job type (AI inference, ZK proving, training, rendering), location, or max price. Returns 20 providers sorted by price by default. Start here to find the cheapest GPU for your job.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: {
          type: "string",
          enum: ["H100", "A100", "L40S", "RTX 4090", "A10G", "T4"],
          description: "Filter by GPU model.",
        },
        min_vram_gb: {
          type: "integer",
          description: "Minimum VRAM required in GB (e.g. 80 for large LLM inference).",
        },
        job_type: {
          type: "string",
          enum: ["ai_inference", "zk_proving", "training", "rendering", "fine_tuning", "batch_processing"],
          description: "Filter providers that support this job type.",
        },
        max_price_hr: {
          type: "number",
          description: "Maximum on-demand price per hour.",
        },
        location: {
          type: "string",
          description: "Filter by location/region (e.g. 'us-west', 'eu', 'ap').",
        },
        availability: {
          type: "string",
          enum: ["available", "busy", "reserved", "all"],
          description: "Filter by availability. Default 'available'.",
          default: "available",
        },
        sort_by: {
          type: "string",
          enum: ["price_per_hr", "spot_price_hr", "benchmark_score", "rating", "avg_latency_ms"],
          description: "Sort order. Default 'price_per_hr'.",
          default: "price_per_hr",
        },
        limit: {
          type: "integer",
          description: "Max results. Default 20.",
          default: 20,
        },
      },
    },
  },

  {
    name: "compute_post_job",
    description: "Post a compute job to the marketplace: AI inference, ZK proving, GPU training, rendering, fine-tuning, or batch processing. Specify requirements (GPU type, VRAM, duration, max budget) and get back matching provider suggestions with estimated costs. Providers then submit bids via compute_bid.",
    inputSchema: {
      type: "object",
      properties: {
        poster_id: {
          type: "string",
          description: "Posting agent's identifier.",
        },
        job_type: {
          type: "string",
          enum: ["ai_inference", "zk_proving", "training", "rendering", "fine_tuning", "batch_processing"],
          description: "Type of compute workload.",
        },
        gpu_type_req: {
          type: "string",
          enum: ["H100", "A100", "L40S", "RTX 4090", "A10G", "T4"],
          description: "Required GPU type. Omit to accept any.",
        },
        vram_req_gb: {
          type: "integer",
          description: "Minimum VRAM required in GB.",
        },
        duration_hrs: {
          type: "number",
          description: "Estimated job duration in hours.",
        },
        max_budget_usd: {
          type: "number",
          description: "Maximum total spend in USD. Bids above this won't be auto-accepted.",
        },
        description: {
          type: "string",
          description: "Optional job description / additional requirements.",
        },
      },
      required: ["poster_id", "job_type", "duration_hrs", "max_budget_usd"],
    },
  },

  {
    name: "compute_bid",
    description: "As a compute provider, submit a bid on an open job. Specify your price per hour and estimated completion time. The job poster can then accept your bid via compute_accept_bid. Multiple providers can bid — lowest qualifying price usually wins.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID from compute_post_job.",
        },
        provider_id: {
          type: "string",
          description: "Provider ID from compute_list_providers.",
        },
        price_per_hr: {
          type: "number",
          description: "Your bid price per GPU-hour in USD.",
        },
        estimated_hrs: {
          type: "number",
          description: "Your estimated completion time in hours. Defaults to the job's requested duration.",
        },
        note: {
          type: "string",
          description: "Optional message to the job poster (e.g. 'Available immediately, SLA 99.9%').",
        },
      },
      required: ["job_id", "provider_id", "price_per_hr"],
    },
  },

  {
    name: "compute_accept_bid",
    description: "Accept a provider bid on a compute job. Triggers escrow via HiveAgent payment rails — funds are locked and released on job completion. Automatically rejects all other pending bids for the same job and marks the provider as busy.",
    inputSchema: {
      type: "object",
      properties: {
        bid_id: {
          type: "string",
          description: "Bid ID from compute_bid.",
        },
        poster_id: {
          type: "string",
          description: "Poster agent ID confirming ownership of the job.",
        },
      },
      required: ["bid_id"],
    },
  },

  {
    name: "compute_job_status",
    description: "Check the status of a compute job: queued, in_progress (with % complete and ETA), or completed (with result URL). Also shows all bids received, accepted provider details, and hardware being used.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job ID from compute_post_job.",
        },
        poster_id: {
          type: "string",
          description: "Optional: poster agent ID for ownership verification.",
        },
      },
      required: ["job_id"],
    },
  },

  {
    name: "compute_spot_price",
    description: "Get current spot market pricing for GPU compute by type — like an electricity spot market but for GPUs. Returns min/avg/max spot prices, on-demand prices, and spot discount % for each GPU type. H100 spot can be 30-40% below on-demand. Call before posting a job to know if you should use spot or reserved.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: {
          type: "string",
          enum: ["H100", "A100", "L40S", "RTX 4090", "A10G", "T4"],
          description: "Filter to a specific GPU type. Omit to see all.",
        },
        location: {
          type: "string",
          description: "Filter by region (e.g. 'us-west', 'eu').",
        },
      },
    },
  },

  {
    name: "compute_arbitrage",
    description: "Find price gaps between compute providers for the same GPU type — the compute equivalent of energy arbitrage. Example: 'H100 at $2.89/hr on NovaBurst vs $2.10/hr on Luminary — same GPU, $0.79/hr savings.' Also detects spot vs on-demand gaps. Returns savings per 100 hours for each opportunity.",
    inputSchema: {
      type: "object",
      properties: {
        gpu_type: {
          type: "string",
          enum: ["H100", "A100", "L40S", "RTX 4090", "A10G", "T4"],
          description: "Find arbitrage for a specific GPU type. Omit to scan all.",
        },
        job_type: {
          type: "string",
          enum: ["ai_inference", "zk_proving", "training", "rendering", "fine_tuning", "batch_processing"],
          description: "Filter providers by job type support.",
        },
        volume_hrs: {
          type: "number",
          description: "Compute volume in hours to size the savings estimate. Default 100 hrs.",
          default: 100,
        },
      },
    },
  },

  {
    name: "compute_reserve",
    description: "Reserve compute capacity in advance at a locked price — like a hotel reservation for GPU time. Prevents price spikes before a critical job. Triggers an escrow hold for the total cost. Use this 12-48 hours before a large training run or ZK proving job.",
    inputSchema: {
      type: "object",
      properties: {
        provider_id: {
          type: "string",
          description: "Provider ID from compute_list_providers.",
        },
        agent_id: {
          type: "string",
          description: "Reserving agent's identifier.",
        },
        start_hours_from_now: {
          type: "number",
          description: "Hours from now when the reservation starts. Default 1.",
          default: 1,
        },
        duration_hrs: {
          type: "number",
          description: "How many hours to reserve.",
        },
        locked_price_hr: {
          type: "number",
          description: "Price to lock in. If blank, uses provider's current on-demand rate.",
        },
      },
      required: ["provider_id", "agent_id", "duration_hrs"],
    },
  },

  {
    name: "compute_dashboard",
    description: "Portfolio view of compute activity: active jobs, total spend, savings vs on-demand, provider performance, and current market snapshot. Also shows a GPU spot market summary so you can instantly see where prices are moving.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Filter to a specific agent's jobs and spend. Omit for platform-wide view.",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGISTICS & CAPACITY AUCTIONS (8 tools)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: "logistics_quote",
    description: "Get multi-carrier shipping quotes for a shipment: origin, destination, weight, dimensions, and urgency level. Returns 6 carriers ranked by price with transit times, fuel surcharges, and total cost. Shows savings vs most expensive option. This is the starting point for any freight decision — call before booking anything.",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Origin city/address (e.g. 'Los Angeles, CA' or '123 Main St, Los Angeles, CA 90001').",
        },
        destination: {
          type: "string",
          description: "Destination city/address.",
        },
        weight_lbs: {
          type: "number",
          description: "Shipment weight in pounds.",
        },
        length_in: {
          type: "number",
          description: "Package length in inches. Default 48.",
          default: 48,
        },
        width_in: {
          type: "number",
          description: "Package width in inches. Default 40.",
          default: 40,
        },
        height_in: {
          type: "number",
          description: "Package height in inches. Default 48.",
          default: 48,
        },
        urgency: {
          type: "string",
          enum: ["economy", "standard", "expedited", "overnight"],
          description: "Delivery urgency. Affects carrier options and pricing.",
          default: "standard",
        },
        shipper_id: {
          type: "string",
          description: "Shipper agent identifier for tracking.",
        },
      },
      required: ["origin", "destination", "weight_lbs"],
    },
  },

  {
    name: "logistics_capacity_auction",
    description: "Post unused truck or container capacity to the auction marketplace. Carriers with empty or partial loads list available space — other agents bid to fill it at below-market rates. Example: 'Half-empty flatbed leaving Denver for Phoenix tomorrow — $0.40/mile.' Sellers post, buyers bid, platform takes a margin on the match.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: {
          type: "string",
          description: "Your carrier identifier.",
        },
        carrier_name: {
          type: "string",
          description: "Your company name.",
        },
        vehicle_type: {
          type: "string",
          enum: ["flatbed", "dry_van", "reefer", "box_truck", "ltl", "container", "drayage"],
          description: "Type of vehicle/capacity being offered.",
        },
        origin_city: {
          type: "string",
          description: "Departure city (e.g. 'Denver, CO').",
        },
        dest_city: {
          type: "string",
          description: "Destination city (e.g. 'Phoenix, AZ').",
        },
        depart_date: {
          type: "string",
          description: "Departure date (YYYY-MM-DD). Defaults to tomorrow.",
        },
        capacity_lbs: {
          type: "number",
          description: "Available capacity in pounds.",
        },
        price_per_mile: {
          type: "number",
          description: "Your asking price per mile (e.g. 0.40).",
        },
        notes: {
          type: "string",
          description: "Additional notes (hazmat restrictions, temperature requirements, etc.).",
        },
      },
      required: ["carrier_id", "carrier_name", "origin_city", "dest_city", "capacity_lbs", "price_per_mile"],
    },
  },

  {
    name: "logistics_bid_capacity",
    description: "Bid on available carrier capacity posted in the auction marketplace. Specify how much weight you need to move and your per-mile offer. System checks if weight fits remaining capacity and if your bid is competitive vs the ask. Returns bid status and guidance if your price is too low.",
    inputSchema: {
      type: "object",
      properties: {
        capacity_id: {
          type: "string",
          description: "Capacity listing ID from logistics_capacity_auction or logistics_dashboard.",
        },
        bidder_id: {
          type: "string",
          description: "Bidding agent identifier.",
        },
        weight_lbs: {
          type: "number",
          description: "Weight of your shipment in pounds.",
        },
        bid_per_mile: {
          type: "number",
          description: "Your bid price per mile (e.g. 0.38).",
        },
      },
      required: ["capacity_id", "bidder_id", "weight_lbs", "bid_per_mile"],
    },
  },

  {
    name: "logistics_route_optimize",
    description: "Optimize a multi-stop delivery route using nearest-neighbor routing. Input a list of stops with city names — get back the optimized sequence, distances per leg, drive times, fuel costs, and total trip economics. Useful for any agent managing multi-pickup or multi-delivery logistics operations.",
    inputSchema: {
      type: "object",
      properties: {
        stops: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", description: "City name (e.g. 'Chicago, IL')" },
              {
                type: "object",
                properties: {
                  city:        { type: "string",  description: "City name" },
                  time_window: { type: "string",  description: "Delivery window (e.g. '09:00-12:00')" },
                  weight_lbs:  { type: "number",  description: "Weight to pick up or drop off at this stop" },
                },
                required: ["city"],
              },
            ],
          },
          description: "Array of stop locations (city names or objects with city + constraints). Minimum 2 stops.",
          minItems: 2,
        },
        vehicle_type: {
          type: "string",
          enum: ["dry_van", "flatbed", "reefer", "box_truck", "ltl", "drayage"],
          description: "Vehicle type. Affects fuel consumption calculation.",
          default: "dry_van",
        },
        max_weight_lbs: {
          type: "number",
          description: "Vehicle weight capacity in lbs. Default 44,000 lbs.",
          default: 44000,
        },
        agent_id: {
          type: "string",
          description: "Agent identifier for route history tracking.",
        },
      },
      required: ["stops"],
    },
  },

  {
    name: "logistics_track",
    description: "Real-time shipment tracking: GPS position estimate, transit progress percentage, ETA, and full event timeline (picked up, in transit, out for delivery, delivered). Triggers delay alerts if ETA is at risk. Works with HiveAgent shipment IDs or carrier tracking codes.",
    inputSchema: {
      type: "object",
      properties: {
        shipment_id: {
          type: "string",
          description: "HiveAgent shipment ID from logistics_quote.",
        },
        tracking_code: {
          type: "string",
          description: "Carrier tracking code (e.g. 1Z999AA10123456784).",
        },
      },
    },
  },

  {
    name: "logistics_consolidate",
    description: "Combine multiple small shipments going to the same destination into one load. Calculates individual vs consolidated cost, recommends FTL or LTL based on total weight, and generates a pickup schedule. Consolidation typically saves 20-40% vs shipping each piece separately. Input an array of shipments with origins and weights.",
    inputSchema: {
      type: "object",
      properties: {
        shipments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref:        { type: "string", description: "Reference label for this shipment" },
              origin:     { type: "string", description: "Origin city (e.g. 'Chicago, IL')" },
              weight_lbs: { type: "number", description: "Weight in pounds" },
            },
            required: ["origin", "weight_lbs"],
          },
          description: "Array of 2+ shipments to consolidate.",
          minItems: 2,
        },
        destination: {
          type: "string",
          description: "Common destination city for all shipments.",
        },
        agent_id: {
          type: "string",
          description: "Agent identifier.",
        },
      },
      required: ["shipments", "destination"],
    },
  },

  {
    name: "logistics_last_mile",
    description: "Compare last-mile delivery options for a package: standard ground, 2-day, overnight, smart locker, scheduled window, and drone delivery (for packages under 5 lbs). Returns price, transit time, eco score, and suitability for each option. Perfect for agents managing e-commerce fulfillment or residential delivery.",
    inputSchema: {
      type: "object",
      properties: {
        destination_address: {
          type: "string",
          description: "Delivery address or city.",
        },
        weight_lbs: {
          type: "number",
          description: "Package weight in pounds. Default 5 lbs.",
          default: 5,
        },
        dimensions_in: {
          type: "string",
          description: "Package dimensions as 'LxWxH' in inches (e.g. '12x10x8').",
        },
        delivery_window: {
          type: "string",
          description: "Preferred delivery window (e.g. '2pm-6pm weekdays'). Used for scheduled window option.",
        },
        special_instructions: {
          type: "string",
          description: "Signature required, leave at door, fragile, etc.",
        },
      },
      required: ["destination_address"],
    },
  },

  {
    name: "logistics_dashboard",
    description: "Shipping portfolio overview: active shipments, total freight spend, carrier performance, on-time delivery rate, and available capacity lanes in the auction marketplace. Shows top backhaul opportunities — lanes where carriers have partial space and need loads to fill. Use this daily to spot arbitrage in available capacity.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Filter to a specific agent's shipments. Omit for platform-wide view.",
        },
      },
    },
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSwarmVerticalTool(name, args) {
  switch (name) {

    // ─── Energy & Power ───────────────────────────────────────────────────────
    case "energy_prices":
      return energyPower.energyGetPrices(args);
    case "energy_load_shift":
      return energyPower.energyLoadShift(args);
    case "energy_arbitrage":
      return energyPower.energyArbitrage(args);
    case "energy_contract_bid":
      return energyPower.energyContractBid(args);
    case "energy_contract_list":
      return energyPower.energyContractList(args);
    case "energy_solar_estimate":
      return energyPower.energySolarEstimate(args);
    case "energy_battery_optimize":
      return energyPower.energyBatteryOptimize(args);
    case "energy_dashboard":
      return energyPower.energyDashboard(args);

    // ─── Compute Marketplace ──────────────────────────────────────────────────
    case "compute_list_providers":
      return computeMarketplace.computeListProviders(args);
    case "compute_post_job":
      return computeMarketplace.computePostJob(args);
    case "compute_bid":
      return computeMarketplace.computeBid(args);
    case "compute_accept_bid":
      return computeMarketplace.computeAcceptBid(args);
    case "compute_job_status":
      return computeMarketplace.computeJobStatus(args);
    case "compute_spot_price":
      return computeMarketplace.computeSpotPrice(args);
    case "compute_arbitrage":
      return computeMarketplace.computeArbitrage(args);
    case "compute_reserve":
      return computeMarketplace.computeReserve(args);
    case "compute_dashboard":
      return computeMarketplace.computeDashboard(args);

    // ─── Logistics & Routing ─────────────────────────────────────────────────
    case "logistics_quote":
      return logisticsRouting.logisticsQuote(args);
    case "logistics_capacity_auction":
      return logisticsRouting.logisticsCapacityAuction(args);
    case "logistics_bid_capacity":
      return logisticsRouting.logisticsBidCapacity(args);
    case "logistics_route_optimize":
      return logisticsRouting.logisticsRouteOptimize(args);
    case "logistics_track":
      return logisticsRouting.logisticsTrack(args);
    case "logistics_consolidate":
      return logisticsRouting.logisticsConsolidate(args);
    case "logistics_last_mile":
      return logisticsRouting.logisticsLastMile(args);
    case "logistics_dashboard":
      return logisticsRouting.logisticsDashboard(args);

    default:
      throw new Error(`Unknown swarm vertical tool: ${name}`);
  }
}
