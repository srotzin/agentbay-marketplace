import * as geospatial from "./services/geospatial-intelligence.js";
import * as climateRisk from "./services/climate-risk.js";

// Phase 19: Geospatial + climate risk ops

export const phase19Tools = [
  // ─── Geospatial Intelligence ────────────────────────────────────────────────
  {
    name: "hiveagent_geo_places_search",
    description: "Search places by text (cache + mock geocoder).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Place name or free text" },
        country_code: { type: "string", description: "Optional country code (ISO-3166 alpha-2)" },
        limit: { type: "integer", description: "Max results (default 5, max 20)", default: 5 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_geo_place_upsert",
    description: "Create/update a place record used for routing and risk assets.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: { type: "string", description: "Optional stable place id (omit to create)" },
        name: { type: "string", description: "Place name" },
        country_code: { type: "string", description: "Optional country code" },
        admin1: { type: "string", description: "Optional region/state" },
        admin2: { type: "string", description: "Optional county/district" },
        latitude: { type: "number", description: "Latitude (-90..90)" },
        longitude: { type: "number", description: "Longitude (-180..180)" },
        bbox: { type: "object", description: "Optional bounding box" },
        tags: { type: "array", description: "Optional tags", items: { type: "string" }, default: [] },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_geo_route_plan",
    description: "Plan a simple route estimate between two saved places.",
    inputSchema: {
      type: "object",
      properties: {
        origin_place_id: { type: "string", description: "Origin place_id" },
        dest_place_id: { type: "string", description: "Destination place_id" },
        mode: { type: "string", description: "drive|walk|bike|transit|truck", default: "drive" },
      },
      required: ["origin_place_id", "dest_place_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "hiveagent_geo_datasets_search",
    description: "Search a curated catalog of geospatial datasets.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Optional domain tag (basemap|elevation|satellite_imagery|admin_boundaries)" },
        query: { type: "string", description: "Optional text query" },
        limit: { type: "integer", description: "Max results (default 10, max 50)", default: 10 },
      },
      required: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  // ─── Climate Risk ───────────────────────────────────────────────────────────
  {
    name: "hiveagent_climate_asset_upsert",
    description: "Create/update an asset for climate risk scoring.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", description: "Optional stable asset id (omit to create)" },
        name: { type: "string", description: "Asset name" },
        category: { type: "string", description: "facility|portfolio|supply_node|infrastructure", default: "facility" },
        place_id: { type: "string", description: "Optional place_id from geo service" },
        latitude: { type: "number", description: "Optional latitude" },
        longitude: { type: "number", description: "Optional longitude" },
        metadata: { type: "object", description: "Free-form metadata" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_climate_scenarios_list",
    description: "List climate scenarios supported by the scoring model.",
    inputSchema: { type: "object", properties: {}, required: [] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "hiveagent_climate_asset_exposure_set",
    description: "Attach a baseline hazard exposure score (0..1) to an asset.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", description: "Asset id" },
        hazard: { type: "string", description: "flood_river|flood_coastal|heat|wildfire|drought|storm_wind|storm_hail|landslide|sea_level_rise" },
        baseline_score: { type: "number", description: "0..1 baseline exposure" },
        scenario: { type: "string", description: "Scenario id (default baseline)", default: "baseline" },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["asset_id", "hazard", "baseline_score"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hiveagent_climate_asset_risk_score",
    description: "Score an asset's risk in a given scenario.",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "string", description: "Asset id" },
        scenario: { type: "string", description: "Scenario id", default: "baseline" },
      },
      required: ["asset_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export async function handlePhase19Tool(name, args) {
  switch (name) {
    // Geospatial
    case "hiveagent_geo_places_search":
      return geospatial.searchPlaces(args);
    case "hiveagent_geo_place_upsert":
      return geospatial.upsertPlace(args);
    case "hiveagent_geo_route_plan":
      return geospatial.planRoute(args);
    case "hiveagent_geo_datasets_search":
      return geospatial.searchGeoDatasets(args);

    // Climate risk
    case "hiveagent_climate_asset_upsert":
      return climateRisk.upsertClimateAsset(args);
    case "hiveagent_climate_scenarios_list":
      return climateRisk.listClimateScenarios();
    case "hiveagent_climate_asset_exposure_set":
      return climateRisk.setAssetExposure(args);
    case "hiveagent_climate_asset_risk_score":
      return climateRisk.scoreAssetRisk(args);

    default:
      throw new Error(`Unknown Phase 19 tool: ${name}`);
  }
}
