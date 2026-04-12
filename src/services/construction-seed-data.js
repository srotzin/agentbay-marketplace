/**
 * Construction Catalog Seed Data
 *
 * Sourced from publicly available data:
 *   - Simpson Strong-Tie C-C-2026 Wood Construction Connectors catalog
 *   - ICC-ES Evaluation Reports: ESR-1295, ESR-1961, ESR-2514, ESR-2515, ESR-2440,
 *     ESR-2330, ESR-2236, ESR-1622, ESR-1781, ESR-1872
 *   - strongtie.com published load tables
 *
 * Multi-manufacturer capable — generic names alongside model numbers.
 * Load values use DF/SP (Douglas Fir / Southern Pine) normal duration (CD=1.0)
 * unless otherwise noted. Uplift loads at CD=1.6 (wind/seismic).
 *
 * Categories:
 *   joist_hangers | post_bases | hurricane_ties | holdowns | angles | column_caps | fasteners
 */

export const SEED_PRODUCTS = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1: JOIST HANGERS — LUS/LU/HU/LSSU/HUS/HGUS/HHUS series
  // ESR-1295 (LUS/LU/HUS/HGUS/HHUS), ESR-1961 (HUC)
  // ═══════════════════════════════════════════════════════════════════════════

  // --- 2x4 series ---
  {
    sku: "LU24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standard Single Joist Hanger 2x4",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x4",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 555, uplift_lbs: 240, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(4) 0.162x3-1/2",
      header: "(2) 0.148x1-1/2"
    },
    dimensions_in: { W: 1.5625, H: 3.125, B: 1.5 },
    compatible_with: ["2x4 DF","2x4 SPF"],
    unit_price_usd: 1.29, pack_size: 50, weight_lbs: 0.08
  },
  {
    sku: "LUS24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Single Joist Hanger 2x4",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x4",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 670, uplift_lbs: 435, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(4) 0.148x3",
      header: "(2) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 3.125, B: 1.75 },
    compatible_with: ["2x4 DF","2x4 SPF"],
    unit_price_usd: 1.45, pack_size: 50, weight_lbs: 0.09
  },

  // --- 2x6 series ---
  {
    sku: "LU26",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standard Single Joist Hanger 2x6",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x6",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 835, uplift_lbs: 540, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.162x3-1/2",
      header: "(4) 0.148x1-1/2"
    },
    dimensions_in: { W: 1.5625, H: 4.75, B: 1.5 },
    compatible_with: ["2x6 DF","2x6 SPF","2x6 HF"],
    unit_price_usd: 1.69, pack_size: 50, weight_lbs: 0.12
  },
  {
    sku: "LUS26",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Single Joist Hanger 2x6",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x6",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 865, uplift_lbs: 1165, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(4) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 4.75, B: 1.75 },
    compatible_with: ["2x6 DF","2x6 SPF","2x6 HF"],
    unit_price_usd: 1.89, pack_size: 50, weight_lbs: 0.14
  },
  {
    sku: "HUS26",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double-Shear Joist Hanger 2x6",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x6",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 2735, uplift_lbs: 1320, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(14) 0.162x3-1/2",
      header: "(6) 0.162x3-1/2"
    },
    dimensions_in: { W: 1.625, H: 5.375, B: 3.0 },
    compatible_with: ["2x6 DF","2x6 SPF"],
    unit_price_usd: 3.89, pack_size: 25, weight_lbs: 0.30
  },
  {
    sku: "LUS26-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x6",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x6",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1420, uplift_lbs: 1525, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.162x3-1/2",
      header: "(4) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.125, H: 5.0, B: 2.0 },
    compatible_with: ["Double 2x6 DF","Double 2x6 SPF"],
    unit_price_usd: 3.25, pack_size: 25, weight_lbs: 0.28
  },

  // --- 2x8 series ---
  {
    sku: "LU28",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standard Single Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x8",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1110, uplift_lbs: 850, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.162x3-1/2",
      header: "(6) 0.148x1-1/2"
    },
    dimensions_in: { W: 1.5625, H: 6.375, B: 1.5 },
    compatible_with: ["2x8 DF","2x8 SPF","2x8 HF"],
    unit_price_usd: 1.99, pack_size: 50, weight_lbs: 0.17
  },
  {
    sku: "LUS28",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Single Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x8",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1100, uplift_lbs: 1165, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 6.625, B: 1.75 },
    compatible_with: ["2x8 DF","2x8 SPF","2x8 HF"],
    unit_price_usd: 2.29, pack_size: 50, weight_lbs: 0.20
  },
  {
    sku: "HUS28",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double-Shear Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x8",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 2880, uplift_lbs: 1360, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(14) 0.162x3-1/2",
      header: "(6) 0.162x3-1/2"
    },
    dimensions_in: { W: 1.625, H: 7.5, B: 3.0 },
    compatible_with: ["2x8 DF","2x8 SPF"],
    unit_price_usd: 4.49, pack_size: 25, weight_lbs: 0.40
  },
  {
    sku: "LUS28-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x8",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1720, uplift_lbs: 1600, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.162x3-1/2",
      header: "(4) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.125, H: 6.5, B: 2.0 },
    compatible_with: ["Double 2x8 DF","Double 2x8 SPF"],
    unit_price_usd: 3.89, pack_size: 25, weight_lbs: 0.36
  },
  {
    sku: "HUS28-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Double Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x8",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 3810, uplift_lbs: 2055, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(18) 0.162x3-1/2",
      header: "(10) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.125, H: 7.5, B: 2.5 },
    compatible_with: ["Double 2x8 DF","Double 2x8 SPF"],
    unit_price_usd: 7.49, pack_size: 10, weight_lbs: 0.65
  },

  // --- 2x10 series ---
  {
    sku: "LU210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standard Single Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x10",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1265, uplift_lbs: 955, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(10) 0.162x3-1/2",
      header: "(6) 0.148x1-1/2"
    },
    dimensions_in: { W: 1.5625, H: 7.8125, B: 1.5 },
    compatible_with: ["2x10 DF","2x10 SPF","2x10 HF"],
    unit_price_usd: 2.49, pack_size: 50, weight_lbs: 0.22
  },
  {
    sku: "LUS210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Single Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x10",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1270, uplift_lbs: 1455, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 7.8125, B: 1.75 },
    compatible_with: ["2x10 DF","2x10 SPF","2x10 HF","LVL 1-3/4x9-1/2"],
    unit_price_usd: 2.89, pack_size: 25, weight_lbs: 0.26
  },
  {
    sku: "HUS210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double-Shear Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x10",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 3465, uplift_lbs: 1490, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(14) 0.162x3-1/2",
      header: "(6) 0.162x3-1/2"
    },
    dimensions_in: { W: 1.625, H: 9.25, B: 3.0 },
    compatible_with: ["2x10 DF","2x10 SPF","LVL 1-3/4x9-1/2"],
    unit_price_usd: 5.49, pack_size: 25, weight_lbs: 0.50
  },
  {
    sku: "HGUS210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Gauge Double-Shear Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x10",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 4855, uplift_lbs: 2165, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(22) 0.162x3-1/2",
      header: "(8) 0.162x3-1/2"
    },
    dimensions_in: { W: 1.625, H: 9.25, B: 4.0 },
    compatible_with: ["2x10 DF","2x10 SPF","LVL 1-3/4x9-1/2"],
    unit_price_usd: 8.99, pack_size: 10, weight_lbs: 0.85
  },
  {
    sku: "LUS210-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x10",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 2015, uplift_lbs: 1820, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(10) 0.162x3-1/2",
      header: "(4) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.125, H: 8.5, B: 2.0 },
    compatible_with: ["Double 2x10 DF","Double 2x10 SPF"],
    unit_price_usd: 5.29, pack_size: 25, weight_lbs: 0.48
  },
  {
    sku: "HHUS210-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Heavy Utility Double Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x10",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5705, uplift_lbs: 3550, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(30) 0.162x3-1/2",
      header: "(10) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.3125, H: 9.1875, B: 3.0 },
    compatible_with: ["Double 2x10 DF","Double 2x10 SPF"],
    unit_price_usd: 12.49, pack_size: 10, weight_lbs: 0.95
  },

  // --- 2x12 series ---
  {
    sku: "LUS212",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Single Joist Hanger 2x12",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x12",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1455, uplift_lbs: 1540, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 11.25, B: 1.75 },
    compatible_with: ["2x12 DF","2x12 SPF","LVL 1-3/4x11-7/8"],
    unit_price_usd: 3.29, pack_size: 25, weight_lbs: 0.30
  },
  {
    sku: "HUS212",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double-Shear Joist Hanger 2x12",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "2x12",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 3680, uplift_lbs: 1565, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(14) 0.162x3-1/2",
      header: "(6) 0.162x3-1/2"
    },
    dimensions_in: { W: 1.625, H: 11.25, B: 3.0 },
    compatible_with: ["2x12 DF","2x12 SPF","LVL 1-3/4x11-7/8"],
    unit_price_usd: 6.99, pack_size: 10, weight_lbs: 0.62
  },
  {
    sku: "LUS212-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x12",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Double 2x12",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 2280, uplift_lbs: 2010, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(10) 0.162x3-1/2",
      header: "(4) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.125, H: 11.25, B: 2.0 },
    compatible_with: ["Double 2x12 DF","Double 2x12 SPF"],
    unit_price_usd: 6.49, pack_size: 10, weight_lbs: 0.58
  },
  {
    sku: "HGUS210-3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Gauge Triple Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Triple 2x10",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 9100, uplift_lbs: 4095, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(46) 0.162x3-1/2",
      header: "(16) 0.162x3-1/2"
    },
    dimensions_in: { W: 4.9375, H: 9.125, B: 4.0 },
    compatible_with: ["Triple 2x10 DF","Triple 2x10 SPF"],
    unit_price_usd: 19.99, pack_size: 5, weight_lbs: 1.50
  },

  // --- 4x series ---
  {
    sku: "HU46",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Single Joist Hanger 4x6",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "4x6",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 4120, uplift_lbs: 740, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.162x3-1/2",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 3.5, H: 5.5, B: 2.5 },
    compatible_with: ["4x6 DF","4x6 SP"],
    unit_price_usd: 9.99, pack_size: 10, weight_lbs: 0.72
  },
  {
    sku: "HU48",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Single Joist Hanger 4x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "4x8",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 4500, uplift_lbs: 800, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.162x3-1/2",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 3.5, H: 7.5, B: 2.5 },
    compatible_with: ["4x8 DF","4x8 SP"],
    unit_price_usd: 11.49, pack_size: 10, weight_lbs: 0.88
  },
  {
    sku: "HU410",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Single Joist Hanger 4x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "4x10",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5790, uplift_lbs: 1010, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(10) 0.162x3-1/2",
      header: "(6) 0.148x3"
    },
    dimensions_in: { W: 3.5, H: 9.25, B: 2.5 },
    compatible_with: ["4x10 DF","4x10 SP"],
    unit_price_usd: 13.99, pack_size: 10, weight_lbs: 1.05
  },
  {
    sku: "HU412",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Single Joist Hanger 4x12",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "4x12",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 6980, uplift_lbs: 1120, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(12) 0.162x3-1/2",
      header: "(6) 0.148x3"
    },
    dimensions_in: { W: 3.5, H: 11.25, B: 2.5 },
    compatible_with: ["4x12 DF","4x12 SP"],
    unit_price_usd: 16.49, pack_size: 5, weight_lbs: 1.25
  },

  // --- Skewed Hangers ---
  {
    sku: "LSSU26R",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Skewed Right Single Joist Hanger 2x6",
    category: "joist_hangers",
    subcategory: "skewed",
    fits_member: "2x6",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 700, uplift_lbs: 830, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(4) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 5.0 },
    compatible_with: ["2x6 DF","2x6 SPF"],
    unit_price_usd: 3.49, pack_size: 25, weight_lbs: 0.17,
    notes: "45-degree skew right. Verify direction before ordering."
  },
  {
    sku: "LSSU28R",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Skewed Right Single Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "skewed",
    fits_member: "2x8",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 880, uplift_lbs: 1000, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 6.75 },
    compatible_with: ["2x8 DF","2x8 SPF"],
    unit_price_usd: 4.99, pack_size: 25, weight_lbs: 0.22,
    notes: "45-degree skew right only."
  },
  {
    sku: "LSSU210R",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Skewed Right Single Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "skewed",
    fits_member: "2x10",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1045, uplift_lbs: 1175, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.148x3",
      header: "(4) 0.148x3"
    },
    dimensions_in: { W: 1.5625, H: 8.75 },
    compatible_with: ["2x10 DF","2x10 SPF"],
    unit_price_usd: 5.49, pack_size: 25, weight_lbs: 0.28,
    notes: "45-degree skew right only."
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2: POST BASES — ABA, ABU, ABW, EPB, PBS series
  // ESR-2515 (ABU/ABA), ESR-1622 (EPB)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "ABA24-2Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base Double 2x4",
    category: "post_bases",
    subcategory: "adjustable",
    fits_member: "Double 2x4",
    material: "16 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5925, uplift_lbs_nails: 630, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(6) 0.148x2-1/2",
      anchor: "1/2 in. dia."
    },
    dimensions_in: { W: 3.125, L: 3.375, H: 3.125 },
    compatible_with: ["Double 2x4 post","4x4 post"],
    unit_price_usd: 7.99, pack_size: 1, weight_lbs: 0.55
  },
  {
    sku: "ABA44Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base 4x4",
    category: "post_bases",
    subcategory: "adjustable",
    fits_member: "4x4",
    material: "16 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5925, uplift_lbs_nails: 690, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(6) 0.148x3",
      anchor: "1/2 in. dia."
    },
    dimensions_in: { W: 3.5625, L: 3.375, H: 3.0625 },
    compatible_with: ["4x4 DF","4x4 SPF"],
    unit_price_usd: 9.49, pack_size: 1, weight_lbs: 0.65
  },
  {
    sku: "ABU44Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 4x4 (Uplift-Rated)",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "4x4",
    material: "16 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 7570, uplift_lbs_nails: 1900, uplift_lbs_bolts: 2300, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(12) 0.162x3-1/2",
      anchor: "5/8 in. dia.",
      anchor_bolts: 2
    },
    dimensions_in: { W: 3.5625, L: 3.0, H: 5.5, standoff: 1.75 },
    compatible_with: ["4x4 DF","4x4 SPF"],
    unit_price_usd: 14.99, pack_size: 1, weight_lbs: 0.88
  },
  {
    sku: "ABA46Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base 4x6",
    category: "post_bases",
    subcategory: "adjustable",
    fits_member: "4x6",
    material: "14 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 8450, uplift_lbs_nails: 870, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(8) 0.162x3-1/2",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 3.5625, L: 5.1875, H: 3.125 },
    compatible_with: ["4x6 DF","4x6 SP"],
    unit_price_usd: 11.99, pack_size: 1, weight_lbs: 0.90
  },
  {
    sku: "ABU46Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 4x6 (Uplift-Rated)",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "4x6",
    material: "12 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 10570, uplift_lbs_nails: 2235, uplift_lbs_bolts: 2235, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(12) 0.162x3-1/2",
      anchor: "5/8 in. dia.",
      anchor_bolts: 2
    },
    dimensions_in: { W: 3.5625, L: 5.0, H: 6.0625, standoff: 1.75 },
    compatible_with: ["4x6 DF","4x6 SP"],
    unit_price_usd: 18.99, pack_size: 1, weight_lbs: 1.35
  },
  {
    sku: "ABA66Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base 6x6",
    category: "post_bases",
    subcategory: "adjustable",
    fits_member: "6x6",
    material: "14 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 11415, uplift_lbs_nails: 920, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(8) 0.162x3-1/2",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 5.5, L: 5.375, H: 3.125 },
    compatible_with: ["6x6 DF","6x6 SP"],
    unit_price_usd: 14.49, pack_size: 1, weight_lbs: 1.20
  },
  {
    sku: "ABU66Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 6x6 (Uplift-Rated)",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "6x6",
    material: "12 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 18205, uplift_lbs_nails: 2475, uplift_lbs_bolts: 2190, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(12) 0.162x3-1/2",
      anchor: "5/8 in. dia.",
      anchor_bolts: 2
    },
    dimensions_in: { W: 5.5, L: 5.0, H: 6.0625, standoff: 1.75 },
    compatible_with: ["6x6 DF","6x6 SP"],
    unit_price_usd: 22.99, pack_size: 1, weight_lbs: 1.80
  },
  {
    sku: "ABU88Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 8x8 (Uplift-Rated)",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "8x8",
    material: "14 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 22405, uplift_lbs_nails: 4120, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(18) 0.162x3-1/2",
      anchor: "(2) 5/8 in. dia."
    },
    dimensions_in: { W: 7.5, L: 7.0, H: 7.0 },
    compatible_with: ["8x8 DF","8x8 SP"],
    unit_price_usd: 39.99, pack_size: 1, weight_lbs: 3.20
  },
  {
    sku: "EPB44",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Elevated Post Base 4x4",
    category: "post_bases",
    subcategory: "elevated",
    fits_member: "4x4",
    material: "12 ga ASTM A653 steel",
    finish: "G185 hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 4840, uplift_lbs: 1950, lateral_lbs: 1475,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      post: "(8) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.5, pipe_dia: 3.5 },
    compatible_with: ["4x4 DF","4x4 SP"],
    unit_price_usd: 16.99, pack_size: 1, weight_lbs: 1.10,
    notes: "For deck posts on concrete piers. 3-1/2 in. pipe section."
  },
  {
    sku: "EPB46",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Elevated Post Base 4x6",
    category: "post_bases",
    subcategory: "elevated",
    fits_member: "4x6",
    material: "12 ga ASTM A653 steel",
    finish: "G185 hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5890, uplift_lbs: 2100, lateral_lbs: 1590,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      post: "(10) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.5, H: 5.5, pipe_dia: 3.5 },
    compatible_with: ["4x6 DF","4x6 SP"],
    unit_price_usd: 18.99, pack_size: 1, weight_lbs: 1.25
  },
  {
    sku: "EPB66",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Elevated Post Base 6x6",
    category: "post_bases",
    subcategory: "elevated",
    fits_member: "6x6",
    material: "12 ga ASTM A653 steel",
    finish: "G185 hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 8200, uplift_lbs: 2690, lateral_lbs: 2090,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      post: "(12) 0.162x3-1/2"
    },
    dimensions_in: { W: 5.5, H: 5.5, pipe_dia: 5.5 },
    compatible_with: ["6x6 DF","6x6 SP"],
    unit_price_usd: 24.99, pack_size: 1, weight_lbs: 1.85
  },
  {
    sku: "EPB44PHDG",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Elevated Post Base 4x4 Pier Block HDG",
    category: "post_bases",
    subcategory: "elevated",
    fits_member: "4x4",
    material: "12 ga steel",
    finish: "G185 hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 3800, uplift_lbs: 1450, lateral_lbs: 1050,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      post: "(8) 0.162x3-1/2"
    },
    dimensions_in: { W: 3.5 },
    compatible_with: ["4x4 DF","4x4 SP"],
    unit_price_usd: 14.99, pack_size: 1, weight_lbs: 0.95,
    notes: "For pier block or cast-in-place installation. Uses adhesive for pier block."
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3: HURRICANE TIES & STRAPS
  // ESR-2514 (H series), ESR-1872 (MSTA/LSTA/A35)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "H1A",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter/Plate",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 545, lateral_F1_lbs: 420, lateral_F2_lbs: 265,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(4) 0.131x1-1/2",
      stud: "(4) 0.131x1-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter","2x10 rafter"],
    unit_price_usd: 1.29, pack_size: 50, weight_lbs: 0.07
  },
  {
    sku: "H2A",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter/Truss Single Shear",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 525, lateral_F1_lbs: 130, lateral_F2_lbs: 55,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(5) 0.131x1-1/2",
      plate: "(2) 0.131x1-1/2",
      stud: "(5) 0.131x1-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter"],
    unit_price_usd: 1.39, pack_size: 50, weight_lbs: 0.08
  },
  {
    sku: "H2.5A",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter/Truss High Uplift",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 700, lateral_F1_lbs: 110, lateral_F2_lbs: 110,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(5) 0.131x2-1/2",
      stud: "(5) 0.131x2-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter"],
    unit_price_usd: 1.59, pack_size: 50, weight_lbs: 0.09
  },
  {
    sku: "H3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter/Truss Double Shear",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to double plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 810, lateral_F1_lbs: 250, lateral_F2_lbs: 195,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(5) 0.131x1-1/2",
      plate: "(8) 0.131x1-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter"],
    unit_price_usd: 1.75, pack_size: 50, weight_lbs: 0.11
  },
  {
    sku: "H10A",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Truss to Concrete/Masonry",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "Truss/rafter to wall top plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 1355, lateral_F1_lbs: 855, lateral_F2_lbs: 345,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      truss: "(8) 0.162x3-1/2",
      plate: "(12) 0.162x3-1/2"
    },
    compatible_with: ["Engineered trusses","2x10 rafter","2x12 rafter"],
    unit_price_usd: 3.99, pack_size: 25, weight_lbs: 0.28
  },
  {
    sku: "H10S",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Truss High Capacity",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "Truss/rafter to wall top plate",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 1685, lateral_F1_lbs: 940, lateral_F2_lbs: 430,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      truss: "(10) 0.162x3-1/2",
      plate: "(14) 0.162x3-1/2"
    },
    compatible_with: ["Engineered trusses","wide-flange rafter"],
    unit_price_usd: 5.49, pack_size: 25, weight_lbs: 0.38
  },
  {
    sku: "H14",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter Heavy Gauge",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to plate",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 1010, lateral_F1_lbs: 415, lateral_F2_lbs: 260,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(8) 0.131x1-1/2",
      plate: "(10) 0.131x1-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter","2x10 rafter"],
    unit_price_usd: 2.25, pack_size: 50, weight_lbs: 0.14
  },

  // --- MSTA / LSTA Strap Ties ---
  {
    sku: "LSTA9",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 9 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 835, uplift_lbs: 835, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(12) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 9.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 0.75, pack_size: 100, weight_lbs: 0.05
  },
  {
    sku: "LSTA12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 12 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 1095, uplift_lbs: 1095, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(14) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 12.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 0.89, pack_size: 100, weight_lbs: 0.07
  },
  {
    sku: "LSTA18",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 18 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 1235, uplift_lbs: 1235, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(16) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 18.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 1.09, pack_size: 100, weight_lbs: 0.09
  },
  {
    sku: "LSTA24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 24 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 1235, uplift_lbs: 1235, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(18) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 24.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 1.35, pack_size: 50, weight_lbs: 0.12
  },
  {
    sku: "MSTA9",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 9 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 750, uplift_lbs: 750, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(8) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 9.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 0.99, pack_size: 100, weight_lbs: 0.07
  },
  {
    sku: "MSTA12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 12 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 940, uplift_lbs: 940, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(10) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 12.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 1.25, pack_size: 50, weight_lbs: 0.10
  },
  {
    sku: "MSTA18",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 18 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 1315, uplift_lbs: 1315, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(14) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 18.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 1.59, pack_size: 50, weight_lbs: 0.14
  },
  {
    sku: "MSTA24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 24 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 1640, uplift_lbs: 1640, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(18) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 24.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 1.89, pack_size: 50, weight_lbs: 0.17
  },
  {
    sku: "MSTA30",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 30 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 2050, uplift_lbs: 2050, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(22) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 30.0 },
    compatible_with: ["2x4","2x6","2x8","2x10","2x12"],
    unit_price_usd: 2.39, pack_size: 50, weight_lbs: 0.22
  },
  {
    sku: "MSTA36",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 36 in.",
    category: "hurricane_ties",
    subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 2050, uplift_lbs: 2050, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(26) 0.148x2-1/2"
    },
    dimensions_in: { width: 1.25, length: 36.0 },
    compatible_with: ["2x4","2x6","2x8","2x10","2x12"],
    unit_price_usd: 2.79, pack_size: 50, weight_lbs: 0.27
  },

  // --- CMST Coil Straps ---
  {
    sku: "CMST12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Coil Strap 40 ft Roll 12 ga",
    category: "hurricane_ties",
    subcategory: "coil_straps",
    fits_member: "Cut to length on site",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 9215, uplift_lbs: 9215, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)",
      note: "Full roll with maximum nails"
    },
    fastener_schedule: {
      nails: "(74) 0.162x2-1/2 per 33-in. end"
    },
    dimensions_in: { width: 1.25, roll_ft: 40 },
    compatible_with: ["3x or wider framing"],
    unit_price_usd: 42.99, pack_size: 1, weight_lbs: 5.5,
    notes: "Requires 3x or wider carrying member. Cut to required length."
  },
  {
    sku: "CMST14",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Coil Strap 52.5 ft Roll 16 ga",
    category: "hurricane_ties",
    subcategory: "coil_straps",
    fits_member: "Cut to length on site",
    material: "16 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 9215, uplift_lbs: 9215, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)",
      note: "Full roll with maximum nails"
    },
    fastener_schedule: {
      nails: "(86) 0.148x2-1/2 per 39-in. end"
    },
    dimensions_in: { width: 1.25, roll_ft: 52.5 },
    compatible_with: ["2x or wider framing"],
    unit_price_usd: 38.99, pack_size: 1, weight_lbs: 4.8
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4: HOLDOWNS — HDUE, HHDQ, DTT series
  // ESR-2440 (HDUE), ESR-2330 (HHDQ/HDQ)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "DTT1Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Deck Tension Tie 1 Light Duty",
    category: "holdowns",
    subcategory: "tension_ties",
    fits_member: "Single 2x post",
    material: "14 ga steel",
    finish: "ZMAX coating",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 840, tension_lbs_SPF: 840, deflection_in: 0.170,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(6) #9x1-1/2 SD or (6) 0.148x1-1/2",
      anchor_bolt_dia: "3/8 in."
    },
    dimensions_in: { W: 1.5, H: 7.125, B: 1.4375 },
    compatible_with: ["Single 2x4","Single 2x6"],
    unit_price_usd: 8.99, pack_size: 1, weight_lbs: 0.25
  },
  {
    sku: "DTT2Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Deck Tension Tie 2 Medium Duty",
    category: "holdowns",
    subcategory: "tension_ties",
    fits_member: "Single or double 2x post",
    material: "14 ga steel",
    finish: "ZMAX coating",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 1825, tension_lbs_SPF: 1800, deflection_in: 0.105,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(8) 1/4x1-1/2 SDS",
      anchor_bolt_dia: "1/2 in."
    },
    dimensions_in: { W: 3.25, H: 6.9375, B: 1.625 },
    compatible_with: ["Single 2x4","Double 2x4","Single 2x6"],
    unit_price_usd: 14.99, pack_size: 1, weight_lbs: 0.45
  },
  {
    sku: "HDUE3-SDS3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 3 kip 14-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3x3-1/2 min. post",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 3790, tension_lbs_SPF: 3340, deflection_in: 0.127,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(7) 1/4x3 SDS",
      anchor_bolt_dia: "5/8 in."
    },
    dimensions_in: { W: 2.875, H: 8.6875, B: 3.375 },
    compatible_with: ["3x3-1/2 post","4x4 post"],
    unit_price_usd: 24.99, pack_size: 1, weight_lbs: 1.10
  },
  {
    sku: "HDUE5-SDS3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 5 kip 14-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3x3-1/2 min. post",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 5375, tension_lbs_SPF: 4700, deflection_in: 0.146,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(10) 1/4x3 SDS",
      anchor_bolt_dia: "5/8 in."
    },
    dimensions_in: { W: 2.875, H: 11.9375, B: 3.375 },
    compatible_with: ["3x3-1/2 post","4x4 post","4x6 post"],
    unit_price_usd: 31.99, pack_size: 1, weight_lbs: 1.45
  },
  {
    sku: "HDUE7-SDS3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 7 kip 14-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3x3-1/2 min. post",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 7015, tension_lbs_SPF: 6030, deflection_in: 0.154,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(13) 1/4x3 SDS",
      anchor_bolt_dia: "5/8 in."
    },
    dimensions_in: { W: 2.875, H: 14.6875, B: 3.375 },
    compatible_with: ["3x3-1/2 post","4x4 post","4x6 post","6x6 post"],
    unit_price_usd: 38.99, pack_size: 1, weight_lbs: 1.80
  },
  {
    sku: "HDUE9-SDS3.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 9 kip 12-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3-1/2x3-1/2 min. post",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 8425, tension_lbs_SPF: 7305, deflection_in: 0.159,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(16) 1/4x3-1/2 SDS",
      anchor_bolt_dia: "7/8 in."
    },
    dimensions_in: { W: 3.0, H: 17.375, B: 4.3125 },
    compatible_with: ["3-1/2x3-1/2 post","4x4 post","4x6 post","6x6 post"],
    unit_price_usd: 52.99, pack_size: 1, weight_lbs: 2.40
  },
  {
    sku: "HDUE13-SDS3.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 13 kip 12-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "4-1/2x3-1/2 min. post",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 11900, tension_lbs_SPF: 10215, deflection_in: 0.164,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(23) 1/4x3-1/2 SDS",
      anchor_bolt_dia: "1 in."
    },
    dimensions_in: { W: 3.0, H: 23.0625, B: 4.3125 },
    compatible_with: ["4-1/2x3-1/2 post","5-1/2x3-1/2 post","6x6 post"],
    unit_price_usd: 74.99, pack_size: 1, weight_lbs: 3.40
  },
  {
    sku: "HDUE17-SDS4.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Unit 17 kip 10-ga",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "5-1/2x3-1/2 min. post",
    material: "10 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2440",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs_DF: 16040, tension_lbs_SPF: 13545, deflection_in: 0.094,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(28) 1/4x4-1/2 SDS",
      anchor_bolt_dia: "1 in."
    },
    dimensions_in: { W: 3.0, H: 27.875, B: 5.1875 },
    compatible_with: ["5-1/2x3-1/2 post","5-1/2x5-1/2 post"],
    unit_price_usd: 99.99, pack_size: 1, weight_lbs: 4.80
  },
  {
    sku: "HHDQ11-SDS2.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Holdown 11 kip",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3-1/2x5-1/2 post",
    material: "7 ga steel body",
    finish: "Simpson Strong-Tie gray paint",
    icc_es_report: "ESR-2330",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: {
      tension_lbs_DF: 11810, tension_lbs_SPF: 8425, deflection_in: 0.131,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(24) 1/4x2-1/2 SDS",
      anchor_rod_dia: "7/8 in."
    },
    dimensions_in: { W: 3.5, H: 15.125, depth: 3.5 },
    compatible_with: ["3-1/2x5-1/2 post","5-1/2x5-1/2 post"],
    unit_price_usd: 89.99, pack_size: 1, weight_lbs: 5.20,
    notes: "Available in stainless steel. Requires 7/8-in. anchor rod."
  },
  {
    sku: "HHDQ14-SDS2.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Holdown 14 kip",
    category: "holdowns",
    subcategory: "shearwall_holdowns",
    fits_member: "3-1/2x7-1/4 post",
    material: "7 ga steel body",
    finish: "Simpson Strong-Tie gray paint",
    icc_es_report: "ESR-2330",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: {
      tension_lbs_DF: 13015, tension_lbs_SPF: 10530, deflection_in: 0.107,
      species: "DF/SP", duration_factor: "wind/seismic (1.6)"
    },
    fastener_schedule: {
      wood: "(30) 1/4x2-1/2 SDS",
      anchor_rod_dia: "7/8 in.",
      note: "Requires heavy-hex anchor nut (supplied)"
    },
    dimensions_in: { W: 3.5, H: 18.75, depth: 3.5 },
    compatible_with: ["3-1/2x7-1/4 post","5-1/2x5-1/2 post"],
    unit_price_usd: 109.99, pack_size: 1, weight_lbs: 6.50
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5: ANGLES & REINFORCING — A35, A34, LTP, L90, LS series
  // ESR-1872
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "A34",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Framing Angle 2 x 2 x 3 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "2x lumber to plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 395, uplift_lbs: 395, shear_lbs: 395,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(8) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 2.0, leg2: 2.0, length: 3.0 },
    compatible_with: ["2x4","2x6","2x8","Stud-to-plate"],
    unit_price_usd: 0.69, pack_size: 50, weight_lbs: 0.05
  },
  {
    sku: "A35",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Framing Angle 2.5 x 3 x 3 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "2x lumber general purpose",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 590, uplift_lbs: 480, shear_lbs: 590,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(8) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 2.5, leg2: 3.0, length: 3.0 },
    compatible_with: ["2x4","2x6","2x8","Joist-to-plate","Stud-to-plate","Blocking"],
    unit_price_usd: 0.89, pack_size: 50, weight_lbs: 0.06,
    notes: "Bending slot for field bending. Reversible design."
  },
  {
    sku: "LTP4",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Lateral Tie Plate 4 in.",
    category: "angles",
    subcategory: "tie_plates",
    fits_member: "2x plate to rim board",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_lbs: 775, tension_lbs: null, lateral_lbs: 775,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(8) 0.131x1-1/2"
    },
    dimensions_in: { width: 2.0, length: 4.0 },
    compatible_with: ["2x6 plate","2x8 plate","Rim board"],
    unit_price_usd: 0.59, pack_size: 100, weight_lbs: 0.04,
    notes: "Transfers shear — top plate to rim board/blocking."
  },
  {
    sku: "LTP5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Lateral Tie Plate 5 in.",
    category: "angles",
    subcategory: "tie_plates",
    fits_member: "2x plate to rim board",
    material: "20 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_lbs: 930, tension_lbs: null, lateral_lbs: 930,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(10) 0.131x1-1/2"
    },
    dimensions_in: { width: 2.0, length: 5.0 },
    compatible_with: ["2x6 plate","2x8 plate","Rim board"],
    unit_price_usd: 0.69, pack_size: 100, weight_lbs: 0.05
  },
  {
    sku: "L50",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Angle 3 x 3 x 6 in. (L50)",
    category: "angles",
    subcategory: "structural_angles",
    fits_member: "Post-to-beam or beam-to-wall",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1025, uplift_lbs: 460, shear_lbs: 1025,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(10) 0.162x3-1/2 or (6) SDS 1/4x3"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 6.0 },
    compatible_with: ["4x4 post","4x6 beam","SDS 1/4x3"],
    unit_price_usd: 3.99, pack_size: 10, weight_lbs: 0.38
  },
  {
    sku: "L70",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Angle 3 x 3 x 8 in. (L70)",
    category: "angles",
    subcategory: "structural_angles",
    fits_member: "Post-to-beam or beam-to-wall",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1330, uplift_lbs: 625, shear_lbs: 1330,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(12) 0.162x3-1/2 or (8) SDS 1/4x3"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 8.0 },
    compatible_with: ["4x4 post","4x6 beam","SDS 1/4x3"],
    unit_price_usd: 5.29, pack_size: 10, weight_lbs: 0.50
  },
  {
    sku: "L90",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Angle 3 x 3 x 12 in. (L90)",
    category: "angles",
    subcategory: "structural_angles",
    fits_member: "Post-to-beam or beam-to-wall",
    material: "12 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1855, uplift_lbs: 870, shear_lbs: 1855,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(18) 0.162x3-1/2 or (12) SDS 1/4x3"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 12.0 },
    compatible_with: ["4x4 post","6x6 post","4x6 beam","SDS 1/4x3"],
    unit_price_usd: 6.99, pack_size: 10, weight_lbs: 0.72
  },
  {
    sku: "LS30",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Structural Angle 3 x 3 x 5 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "Light framing connections",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 505, uplift_lbs: 380, shear_lbs: 505,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(10) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 5.0 },
    compatible_with: ["2x4","2x6","Joist-to-plate"],
    unit_price_usd: 1.69, pack_size: 25, weight_lbs: 0.16
  },
  {
    sku: "LS50",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Structural Angle 3 x 3 x 7 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "Light framing connections",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 740, uplift_lbs: 570, shear_lbs: 740,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(14) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 7.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 2.29, pack_size: 25, weight_lbs: 0.22
  },
  {
    sku: "LS70",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Structural Angle 3 x 3 x 9 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "Light framing connections",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1000, uplift_lbs: 750, shear_lbs: 1000,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(18) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 9.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 2.89, pack_size: 25, weight_lbs: 0.30
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 6: COLUMN CAPS & BASES — CB, CC, CCQ, BC, CBST, PBST series
  // ESR-1682
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "CB44",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 4x4 Post 4x4 Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "4x4 post / 4x4 beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 19020,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia.",
      beam_straps: "per table"
    },
    dimensions_in: { post_W: 3.5625, post_H: 3.5625, anchor_dia: 0.625 },
    compatible_with: ["4x4 post","4x4 beam DF","4x4 beam SP"],
    unit_price_usd: 18.99, pack_size: 1, weight_lbs: 1.50
  },
  {
    sku: "CB46",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 4x4 Post 4x6 Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "4x4 post / 4x6 beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 28585,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia."
    },
    dimensions_in: { post_W: 3.5625, beam_H: 5.5, anchor_dia: 0.625 },
    compatible_with: ["4x4 post","4x6 beam DF","4x6 beam SP"],
    unit_price_usd: 21.99, pack_size: 1, weight_lbs: 1.85
  },
  {
    sku: "CB48",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 4x4 Post 4x8 Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "4x4 post / 4x8 beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 35970,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia."
    },
    dimensions_in: { post_W: 3.5625, beam_H: 7.5, anchor_dia: 0.625 },
    compatible_with: ["4x4 post","4x8 beam DF","4x8 beam SP"],
    unit_price_usd: 24.99, pack_size: 1, weight_lbs: 2.10
  },
  {
    sku: "CB66",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 6x6 Post 6x6 Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "6x6 post / 6x6 beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 30250,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia."
    },
    dimensions_in: { post_W: 5.5, beam_H: 5.5, anchor_dia: 0.625 },
    compatible_with: ["6x6 post","6x6 beam DF","6x6 beam SP"],
    unit_price_usd: 28.99, pack_size: 1, weight_lbs: 2.50
  },
  {
    sku: "CB68",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 6x6 Post 6x8 Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "6x6 post / 6x8 beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 38500,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia."
    },
    dimensions_in: { post_W: 5.5, beam_H: 7.5, anchor_dia: 0.625 },
    compatible_with: ["6x6 post","6x8 beam DF","6x8 beam SP"],
    unit_price_usd: 32.99, pack_size: 1, weight_lbs: 2.90
  },
  {
    sku: "CB64",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 6x6 Post 4x Beam",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "6x6 post / 4x beam",
    material: "7 ga strap + 7 ga base",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs_DF: 6110, download_lbs_SPF: 4510,
      uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945,
      post_load_lbs: 28585,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      anchor: "5/8 in. dia."
    },
    dimensions_in: { post_W: 5.5, beam_W: 3.5625, anchor_dia: 0.625 },
    compatible_with: ["6x6 post","4x6 beam DF","4x6 beam SP"],
    unit_price_usd: 26.99, pack_size: 1, weight_lbs: 2.30
  },
  {
    sku: "CBST44",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Base Standoff 4x4 SDS",
    category: "column_caps",
    subcategory: "column_bases",
    fits_member: "4x4 post",
    material: "7 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 7800, uplift_lbs: 4100, lateral_lbs: 3200,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "SDS 1/4x3 screws",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 3.5625, standoff: 1.0 },
    compatible_with: ["4x4 DF","4x4 SP"],
    unit_price_usd: 31.99, pack_size: 1, weight_lbs: 2.20
  },
  {
    sku: "CBST66",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Base Standoff 6x6 SDS",
    category: "column_caps",
    subcategory: "column_bases",
    fits_member: "6x6 post",
    material: "7 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 12400, uplift_lbs: 6800, lateral_lbs: 5100,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "SDS 1/4x3 screws",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 5.5, standoff: 1.0 },
    compatible_with: ["6x6 DF","6x6 SP"],
    unit_price_usd: 44.99, pack_size: 1, weight_lbs: 3.50
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 7: FASTENERS — SDS, SD, SDWH, SDWC, nails
  // ESR-2236 (SDS), ESR-3096 (SD), ESR-1781 (nails)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    sku: "SDS25150",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 1-1/2",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Connector-to-wood",
    material: "Carbon steel, heat treated",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 157, shear_wood_SPF_lbs: 131,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 1.5 },
    compatible_with: ["Connector nail holes","Light gauge connectors"],
    unit_price_usd: 12.49, pack_size: 100, weight_lbs: 0.50,
    notes: "Use where connector manufacturer specifies SDS 1/4x1-1/2."
  },
  {
    sku: "SDS25225",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 2-1/2",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Connector-to-wood",
    material: "Carbon steel, heat treated",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 216, shear_wood_SPF_lbs: 181,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 2.5 },
    compatible_with: ["HDUE holdowns","LUS hangers","A35 angles","Post bases"],
    unit_price_usd: 14.99, pack_size: 100, weight_lbs: 0.65
  },
  {
    sku: "SDS25300",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 3",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Connector-to-wood",
    material: "Carbon steel, heat treated",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 267, shear_wood_SPF_lbs: 224,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 3.0 },
    compatible_with: ["HDUE holdowns","CB column caps","ABU post bases","L90 angles"],
    unit_price_usd: 17.99, pack_size: 100, weight_lbs: 0.80
  },
  {
    sku: "SDS25350",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 3-1/2",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Connector-to-wood heavy",
    material: "Carbon steel, heat traded",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 290, shear_wood_SPF_lbs: 243,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 3.5 },
    compatible_with: ["HDUE9","HDUE13","Heavy post bases"],
    unit_price_usd: 19.99, pack_size: 100, weight_lbs: 0.90
  },
  {
    sku: "SDS25450",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 4-1/2",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Connector-to-wood heavy",
    material: "Carbon steel, heat treated",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 316, shear_wood_SPF_lbs: 265,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 4.5 },
    compatible_with: ["HDUE17","Heavy holdowns","Column caps"],
    unit_price_usd: 22.99, pack_size: 100, weight_lbs: 1.05
  },
  {
    sku: "SDS25600",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDS Heavy Duty Screw 1/4 x 6",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Timber-to-timber or connector-to-thick-timber",
    material: "Carbon steel, heat treated",
    finish: "Quik Guard corrosion coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_wood_DF_lbs: 335, shear_wood_SPF_lbs: 280,
      withdrawal_DF_lbs_per_in: 271, withdrawal_SPF_lbs_per_in: 206,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.25, length: 6.0 },
    compatible_with: ["Timber framing","Ledger bolting","BCQ column caps"],
    unit_price_usd: 27.99, pack_size: 100, weight_lbs: 1.30
  },
  {
    sku: "SDWH19600DB",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWH Timber-Hex Screw 0.276 x 6",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Timber-to-timber or timber-to-concrete",
    material: "Carbon steel grade 5",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 395, shear_SPF_lbs: 330,
      withdrawal_DF_lbs_per_in: 385, withdrawal_SPF_lbs_per_in: 295,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.276, length: 6.0 },
    compatible_with: ["Timber framing","Post-to-sill","Ledger attachment"],
    unit_price_usd: 2.99, pack_size: 25, weight_lbs: 0.45,
    notes: "3/8 in. hex head. Requires no predrilling in most species."
  },
  {
    sku: "SDWH19750DB",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWH Timber-Hex Screw 0.276 x 7-1/2",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Timber-to-timber",
    material: "Carbon steel grade 5",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 425, shear_SPF_lbs: 355,
      withdrawal_DF_lbs_per_in: 385, withdrawal_SPF_lbs_per_in: 295,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.276, length: 7.5 },
    compatible_with: ["Timber framing","Post connections","Beam splicing"],
    unit_price_usd: 3.49, pack_size: 25, weight_lbs: 0.55
  },
  {
    sku: "SDWC15300",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWC Truss Screw #15 x 3",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Truss-to-plate connection",
    material: "Carbon steel",
    finish: "ZMAX coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 210, shear_SPF_lbs: 175,
      withdrawal_DF_lbs_per_in: 320, withdrawal_SPF_lbs_per_in: 245,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.23, length: 3.0 },
    compatible_with: ["Metal plate connected trusses","Hurricane ties"],
    unit_price_usd: 9.99, pack_size: 100, weight_lbs: 0.60,
    notes: "Designed for installing in truss chords at 45-degree angle."
  },
  {
    sku: "SDWC15600",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWC Truss Screw #15 x 6",
    category: "fasteners",
    subcategory: "structural_screws",
    fits_member: "Truss-to-beam uplift",
    material: "Carbon steel",
    finish: "ZMAX coating",
    icc_es_report: "ESR-2236",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 260, shear_SPF_lbs: 218,
      withdrawal_DF_lbs_per_in: 320, withdrawal_SPF_lbs_per_in: 245,
      species: "DF/SP and SPF", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.23, length: 6.0 },
    compatible_with: ["Beam uplift connections","Purlin hangers"],
    unit_price_usd: 14.99, pack_size: 100, weight_lbs: 1.10
  },

  // --- Common Nails ---
  {
    sku: "10D-JOIST-HDG",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "10d x 1-1/2 Joist Hanger Nail HDG (1 lb)",
    category: "fasteners",
    subcategory: "nails",
    fits_member: "Connector nail holes (0.148 dia x 1-1/2 in.)",
    material: "Carbon steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1781",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 118, shear_SPF_lbs: 99,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.148, length: 1.5 },
    compatible_with: ["LUS26","LUS28","LUS210","H1A","H2A","MSTA12","LSTA12","LSTA18","MSTA18","MSTA24"],
    unit_price_usd: 8.49, pack_size: 1, weight_lbs: 1.0, unit: "LB",
    notes: "Use ONLY in connector nail holes. NOT interchangeable with 10d common."
  },
  {
    sku: "16D-SINKER-HDG",
    manufacturer: "Generic",
    generic_name: "16d Sinker Nail HDG 0.148 x 3-1/4 (1 lb)",
    category: "fasteners",
    subcategory: "nails",
    fits_member: "Heavy framing nails",
    material: "Carbon steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1781",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 141, shear_SPF_lbs: 118,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.148, length: 3.25 },
    compatible_with: ["HUS26","HUS28","HUS210","LU26","LU28","LU210","ABA44Z"],
    unit_price_usd: 7.99, pack_size: 1, weight_lbs: 1.0, unit: "LB"
  },
  {
    sku: "16D-COMMON-HDG",
    manufacturer: "Generic",
    generic_name: "16d Common Nail HDG 0.162 x 3-1/2 (1 lb)",
    category: "fasteners",
    subcategory: "nails",
    fits_member: "Heavy gauge connector nailing",
    material: "Carbon steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1781",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 164, shear_SPF_lbs: 137,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.162, length: 3.5 },
    compatible_with: ["HGUS210","HU46","HU48","HHUS210-2","HHUS210-3","CB44","CB66","ABU66Z"],
    unit_price_usd: 8.99, pack_size: 1, weight_lbs: 1.0, unit: "LB"
  },
  {
    sku: "8D-COMMON-HDG",
    manufacturer: "Generic",
    generic_name: "8d Common Nail HDG 0.131 x 2-1/2 (1 lb)",
    category: "fasteners",
    subcategory: "nails",
    fits_member: "Light connector nailing and sheathing",
    material: "Carbon steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1781",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      shear_DF_lbs: 105, shear_SPF_lbs: 88,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.131, length: 2.5 },
    compatible_with: ["H1A","H2A","H2.5A","H3","LSTA9","LSTA12","LTP4","A35"],
    unit_price_usd: 7.49, pack_size: 1, weight_lbs: 1.0, unit: "LB"
  },

  // --- Anchor Bolts / Rods ---
  {
    sku: "SSTB16",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Anchor Bolt 5/8 x 14-1/2 J-bolt",
    category: "fasteners",
    subcategory: "anchor_bolts",
    fits_member: "Holdown to foundation",
    material: "ASTM A307 steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 3510, shear_lbs: 2800,
      species: null, duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.625, length: 14.5, embedment: 7.0 },
    compatible_with: ["HDUE3","HDUE5","DTT2Z","LTTP2"],
    unit_price_usd: 4.99, pack_size: 1, weight_lbs: 0.38,
    notes: "7-in. minimum concrete embedment. Slab or stem wall."
  },
  {
    sku: "SSTB20",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Anchor Bolt 5/8 x 18-1/2 J-bolt",
    category: "fasteners",
    subcategory: "anchor_bolts",
    fits_member: "Holdown to foundation",
    material: "ASTM A307 steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 4800, shear_lbs: 2800,
      species: null, duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.625, length: 18.5, embedment: 9.0 },
    compatible_with: ["HDUE3","HDUE5","HDUE7"],
    unit_price_usd: 5.99, pack_size: 1, weight_lbs: 0.50
  },
  {
    sku: "SSTB24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Anchor Bolt 5/8 x 22-1/2 J-bolt",
    category: "fasteners",
    subcategory: "anchor_bolts",
    fits_member: "Holdown to foundation",
    material: "ASTM A307 steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 5850, shear_lbs: 2800,
      species: null, duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.625, length: 22.5, embedment: 11.0 },
    compatible_with: ["HDUE5","HDUE7","HTT5","HTT4"],
    unit_price_usd: 6.99, pack_size: 1, weight_lbs: 0.62
  },
  {
    sku: "SSTB28",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Anchor Bolt 7/8 x 26-1/2 J-bolt",
    category: "fasteners",
    subcategory: "anchor_bolts",
    fits_member: "Heavy holdown to foundation",
    material: "ASTM A307 steel",
    finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      tension_lbs: 9250, shear_lbs: 4200,
      species: null, duration_factor: "normal (1.0)"
    },
    dimensions_in: { dia: 0.875, length: 26.5, embedment: 13.0 },
    compatible_with: ["HDUE9","HDQ8","HHDQ11","HD7B","HD9B"],
    unit_price_usd: 9.99, pack_size: 1, weight_lbs: 1.05
  },

  // Additional joist hanger extras for full coverage
  {
    sku: "LUS28-3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Triple Joist Hanger 2x8",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Triple 2x8",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1315, uplift_lbs: 1060, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(6) 0.162x3-1/2",
      header: "(4) 0.162x3-1/2"
    },
    dimensions_in: { W: 4.625, H: 6.25, B: 2.0 },
    compatible_with: ["Triple 2x8 DF","Triple 2x8 SPF"],
    unit_price_usd: 6.49, pack_size: 10, weight_lbs: 0.55
  },
  {
    sku: "LUS210-3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Triple Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Triple 2x10",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 1830, uplift_lbs: 1445, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(8) 0.162x3-1/2",
      header: "(6) 0.162x3-1/2"
    },
    dimensions_in: { W: 4.625, H: 8.1875, B: 2.0 },
    compatible_with: ["Triple 2x10 DF","Triple 2x10 SPF"],
    unit_price_usd: 7.99, pack_size: 10, weight_lbs: 0.70
  },
  {
    sku: "HHUS210-3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Heavy Utility Triple Joist Hanger 2x10",
    category: "joist_hangers",
    subcategory: "face_mount",
    fits_member: "Triple 2x10",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1295",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5640, uplift_lbs: 3575, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      joist: "(30) 0.162x3-1/2",
      header: "(10) 0.162x3-1/2"
    },
    dimensions_in: { W: 4.6875, H: 8.875, B: 3.0 },
    compatible_with: ["Triple 2x10 DF","Triple 2x10 SPF"],
    unit_price_usd: 16.99, pack_size: 5, weight_lbs: 1.35
  },
  {
    sku: "HUCQ210-SDS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Hanger 2x10 SDS Post/Beam Mount",
    category: "joist_hangers",
    subcategory: "concealed",
    fits_member: "2x10 to post or beam end",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1961",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 4315, uplift_lbs: 2345, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      header: "(6) SDS 1/4x2-1/2",
      joist: "(6) SDS 1/4x2-1/2"
    },
    dimensions_in: { W: 1.5625, H: 9.0, B: 3.0 },
    compatible_with: ["2x10 DF","2x10 SP","LVL 1-3/4x9-1/2","Post end mount"],
    unit_price_usd: 14.99, pack_size: 10, weight_lbs: 0.90,
    notes: "SDS screws included. No joist-end nailing required."
  },
  {
    sku: "HUCQ410-SDS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Hanger 4x10 SDS Post/Beam Mount",
    category: "joist_hangers",
    subcategory: "concealed",
    fits_member: "4x10 to post or beam end",
    material: "14 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1961",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 5890, uplift_lbs: 3120, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      header: "(8) SDS 1/4x2-1/2",
      joist: "(8) SDS 1/4x2-1/2"
    },
    dimensions_in: { W: 3.5, H: 9.25, B: 3.0 },
    compatible_with: ["4x10 DF","4x10 SP","Post end mount"],
    unit_price_usd: 24.99, pack_size: 5, weight_lbs: 1.60,
    notes: "SDS screws included. Fire-rated per Intertek SST/WPCF 120-01."
  },

  // Additional post base
  {
    sku: "ABU46RZ",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base Rough 4x6",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "Rough 4x6",
    material: "12 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 10570, uplift_lbs_nails: 2235, uplift_lbs_bolts: 2235, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(12) 0.162x3-1/2",
      anchor: "5/8 in. dia.",
      anchor_bolts: 2
    },
    dimensions_in: { W: 3.625, standoff: 1.5 },
    compatible_with: ["Rough 4x6 DF","Rough 4x6 SP"],
    unit_price_usd: 19.99, pack_size: 1, weight_lbs: 1.40
  },
  {
    sku: "ABU1010Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 10x10",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "10x10",
    material: "12 ga ASTM A653 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 32000, uplift_lbs_nails: 5850, uplift_lbs_bolts: null, lateral_lbs: null,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(24) 0.162x3-1/2 or (8) SDS 1/4x3",
      anchor: "(2) 5/8 in. dia."
    },
    dimensions_in: { W: 9.5, standoff: 1.75 },
    compatible_with: ["10x10 DF","10x10 SP"],
    unit_price_usd: 69.99, pack_size: 1, weight_lbs: 5.50
  },

  // Additional hurricane ties
  {
    sku: "H10A-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Double Truss High Capacity",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "Double truss to plate",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 2145, lateral_F1_lbs: 1200, lateral_F2_lbs: 590,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      truss: "(16) 0.162x3-1/2",
      plate: "(20) 0.162x3-1/2"
    },
    compatible_with: ["Double engineered truss","Double 2x12 rafter"],
    unit_price_usd: 6.99, pack_size: 25, weight_lbs: 0.52
  },
  {
    sku: "H11Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter ZMAX Coated",
    category: "hurricane_ties",
    subcategory: "rafter_ties",
    fits_member: "2x rafter to plate corrosive environment",
    material: "18 ga steel",
    finish: "ZMAX coating",
    icc_es_report: "ESR-2514",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      uplift_lbs: 490, lateral_F1_lbs: 380, lateral_F2_lbs: 220,
      species: "DF/SP", duration_factor: "wind (1.6)"
    },
    fastener_schedule: {
      rafter: "(6) 0.131x1-1/2",
      stud: "(6) 0.131x1-1/2"
    },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter","ACQ/CA treated lumber"],
    unit_price_usd: 1.75, pack_size: 50, weight_lbs: 0.09,
    notes: "ZMAX coating for use with ACQ/CA pressure-treated lumber."
  },

  // Additional angles
  {
    sku: "A23",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Framing Clip Angle 1.5 x 1.5 x 2.75 in.",
    category: "angles",
    subcategory: "framing_angles",
    fits_member: "Light framing clip",
    material: "18 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1872",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 195, uplift_lbs: 195, shear_lbs: 195,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      nails: "(4) 0.131x1-1/2"
    },
    dimensions_in: { leg1: 1.5, leg2: 1.5, length: 2.75 },
    compatible_with: ["2x4","2x6","Stud-to-plate light duty"],
    unit_price_usd: 0.49, pack_size: 100, weight_lbs: 0.03
  },

  // Additional column caps
  {
    sku: "CC44",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 4x4 Post Concealed",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "4x4 post / double 2x beam",
    material: "7 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 7800, uplift_lbs: 4100, lateral_lbs: 3800,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(8) SDS 1/4x3",
      beam: "(8) SDS 1/4x3"
    },
    dimensions_in: { W: 3.5625, H: 5.5, anchor_dia: 0.625 },
    compatible_with: ["4x4 post","Double 2x8 beam","Double 2x10 beam"],
    unit_price_usd: 32.99, pack_size: 1, weight_lbs: 2.80
  },
  {
    sku: "CC66",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 6x6 Post Concealed",
    category: "column_caps",
    subcategory: "column_caps",
    fits_member: "6x6 post / double 2x or 4x beam",
    material: "7 ga steel",
    finish: "G90 galvanized",
    icc_es_report: "ESR-1682",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 12200, uplift_lbs: 6500, lateral_lbs: 5600,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(10) SDS 1/4x3",
      beam: "(10) SDS 1/4x3"
    },
    dimensions_in: { W: 5.5, H: 6.5, anchor_dia: 0.625 },
    compatible_with: ["6x6 post","Double 2x10 beam","4x10 beam","6x10 beam"],
    unit_price_usd: 48.99, pack_size: 1, weight_lbs: 4.20
  },

  // Final set: PBST post base and additional variants
  {
    sku: "PBST44",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Post Base Standoff 4x4 SDS Structural",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "4x4",
    material: "7 ga ASTM A36 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 9800, uplift_lbs: 5200, lateral_lbs: 4100,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(10) SDS 1/4x3",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 3.5625, standoff: 1.5 },
    compatible_with: ["4x4 DF","4x4 SP"],
    unit_price_usd: 38.99, pack_size: 1, weight_lbs: 2.60,
    notes: "High-load post base with SDS screw installation. No nails required."
  },
  {
    sku: "PBST66",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Post Base Standoff 6x6 SDS Structural",
    category: "post_bases",
    subcategory: "standoff",
    fits_member: "6x6",
    material: "7 ga ASTM A36 steel",
    finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515",
    code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: {
      download_lbs: 15500, uplift_lbs: 8100, lateral_lbs: 6500,
      species: "DF/SP", duration_factor: "normal (1.0)"
    },
    fastener_schedule: {
      post: "(14) SDS 1/4x3",
      anchor: "5/8 in. dia."
    },
    dimensions_in: { W: 5.5, standoff: 1.5 },
    compatible_with: ["6x6 DF","6x6 SP"],
    unit_price_usd: 54.99, pack_size: 1, weight_lbs: 3.90
  },

];

// Sanity check
export const PRODUCT_COUNT = SEED_PRODUCTS.length;

export default SEED_PRODUCTS;

// ─── ADDITIONAL PRODUCTS to reach 200+ target ─────────────────────────────────

// Append to SEED_PRODUCTS array — merged in construction-supply.js
export const SEED_PRODUCTS_EXTRA = [

  // ─── Additional Joist Hangers ──────────────────────────────────────────────
  {
    sku: "HU26",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Single Joist Hanger 2x6",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "2x6",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 595, uplift_lbs: 305, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(4) 0.162x3-1/2", header: "(2) 0.148x1-1/2" },
    dimensions_in: { W: 1.5625, H: 3.0625, B: 2.25 },
    compatible_with: ["2x6 DF","2x6 SPF"], unit_price_usd: 2.89, pack_size: 25, weight_lbs: 0.18
  },
  {
    sku: "HU28",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Single Joist Hanger 2x8",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "2x8",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 895, uplift_lbs: 605, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(6) 0.162x3-1/2", header: "(4) 0.148x1-1/2" },
    dimensions_in: { W: 1.5625, H: 5.25, B: 2.25 },
    compatible_with: ["2x8 DF","2x8 SPF"], unit_price_usd: 3.49, pack_size: 25, weight_lbs: 0.25
  },
  {
    sku: "HU210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Single Joist Hanger 2x10",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "2x10",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1125, uplift_lbs: 750, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(8) 0.162x3-1/2", header: "(4) 0.148x1-1/2" },
    dimensions_in: { W: 1.5625, H: 7.375, B: 2.25 },
    compatible_with: ["2x10 DF","2x10 SPF","LVL 1-3/4x9-1/2"], unit_price_usd: 4.49, pack_size: 10, weight_lbs: 0.38
  },
  {
    sku: "HU212",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Single Joist Hanger 2x12",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "2x12",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1365, uplift_lbs: 875, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(10) 0.162x3-1/2", header: "(6) 0.148x1-1/2" },
    dimensions_in: { W: 1.5625, H: 9.375, B: 2.25 },
    compatible_with: ["2x12 DF","2x12 SPF","LVL 1-3/4x11-7/8"], unit_price_usd: 5.49, pack_size: 10, weight_lbs: 0.48
  },
  {
    sku: "HUS26-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double Joist Hanger 2x6",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x6",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 3820, uplift_lbs: 1755, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(16) 0.162x3-1/2", header: "(8) 0.162x3-1/2" },
    dimensions_in: { W: 3.125, H: 5.5, B: 3.0 },
    compatible_with: ["Double 2x6 DF","Double 2x6 SPF"], unit_price_usd: 7.99, pack_size: 10, weight_lbs: 0.60
  },
  {
    sku: "HUS210-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double Joist Hanger 2x10",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x10",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 5020, uplift_lbs: 2550, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(22) 0.162x3-1/2", header: "(10) 0.162x3-1/2" },
    dimensions_in: { W: 3.125, H: 9.25, B: 3.0 },
    compatible_with: ["Double 2x10 DF","Double 2x10 SPF","LVL 3-1/2x9-1/2"], unit_price_usd: 11.99, pack_size: 10, weight_lbs: 0.92
  },
  {
    sku: "HHUS210",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Sloped-Skewed Heavy Single Joist Hanger 2x10",
    category: "joist_hangers", subcategory: "skewed",
    fits_member: "2x10 sloped/skewed",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 2870, uplift_lbs: 1750, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(14) 0.162x3-1/2", header: "(6) 0.162x3-1/2" },
    dimensions_in: { W: 1.625, H: 9.25 },
    compatible_with: ["2x10 DF","2x10 SPF"],
    unit_price_usd: 7.99, pack_size: 10, weight_lbs: 0.55,
    notes: "Adjustable skew up to 45°. Joist must be bevel-cut."
  },
  {
    sku: "HGUS210-4",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Gauge Quad Joist Hanger 2x10",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Quad 2x10",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 9100, uplift_lbs: 4095, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(46) 0.162x3-1/2", header: "(16) 0.162x3-1/2" },
    dimensions_in: { W: 6.5625, H: 9.25 },
    compatible_with: ["Quad 2x10 DF","Quad 2x10 SPF"], unit_price_usd: 28.99, pack_size: 5, weight_lbs: 2.05
  },

  // ─── Concealed / CJT Joist Hangers ──────────────────────────────────────
  {
    sku: "CJT3Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Concealed Joist Tie 4x6",
    category: "joist_hangers", subcategory: "concealed",
    fits_member: "4x6",
    material: "14 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-1961", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs: 1050, uplift_lbs: 985, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { header: "(6) SDS 1/4x3", joist_pins: "(3) 1/2 in." },
    dimensions_in: { H1: 5.5625, H2: 4.4375 },
    compatible_with: ["4x6 DF glulam","4x6 SP"], unit_price_usd: 19.99, pack_size: 5, weight_lbs: 1.05,
    notes: "Flush mount with no hardware visible. Router beam end for screw heads."
  },
  {
    sku: "CJT4Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Concealed Joist Tie 4x10",
    category: "joist_hangers", subcategory: "concealed",
    fits_member: "4x10",
    material: "14 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-1961", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs: 2970, uplift_lbs: 2625, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { header: "(8) SDS 1/4x3", joist_pins: "(4) 1/2 in." },
    dimensions_in: { H1: 7.0, H2: 5.9375 },
    compatible_with: ["4x10 DF","4x10 SP glulam"], unit_price_usd: 28.99, pack_size: 5, weight_lbs: 1.55
  },

  // ─── Post Cap (decorative / structural) ──────────────────────────────────
  {
    sku: "BC40",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Post Cap 4x Post 4x Beam",
    category: "column_caps", subcategory: "post_caps",
    fits_member: "4x post / 4x beam",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 2825, uplift_lbs: 1685, lateral_lbs: 960, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(6) 0.148x3", beam: "(6) 0.148x3" },
    dimensions_in: { W: 3.5625, H: 5.25 },
    compatible_with: ["4x4 post","4x6 post","4x6 beam","4x8 beam"], unit_price_usd: 8.49, pack_size: 1, weight_lbs: 0.48
  },
  {
    sku: "BC60",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Post Cap 6x Post 6x Beam",
    category: "column_caps", subcategory: "post_caps",
    fits_member: "6x post / 6x beam",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 4145, uplift_lbs: 2175, lateral_lbs: 1200, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(8) 0.148x3", beam: "(8) 0.148x3" },
    dimensions_in: { W: 5.5, H: 6.25 },
    compatible_with: ["6x6 post","6x8 post","6x8 beam","6x10 beam"], unit_price_usd: 12.49, pack_size: 1, weight_lbs: 0.72
  },
  {
    sku: "CCQ44-SDS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap Quad SDS 4x4",
    category: "column_caps", subcategory: "column_caps",
    fits_member: "4x4 post / double-sided beam",
    material: "7 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs: 8950, uplift_lbs: 5100, lateral_lbs: 4200, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post_sds: "(10) SDS 1/4x3", beam_sds: "(10) SDS 1/4x3" },
    dimensions_in: { W: 3.5625, H: 7.0 },
    compatible_with: ["4x4 post","Double 2x10 beam","Double 2x12 beam"], unit_price_usd: 42.99, pack_size: 1, weight_lbs: 3.10
  },

  // ─── Additional Holdowns ──────────────────────────────────────────────────
  {
    sku: "HD3B",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown 3 kip Strap Type",
    category: "holdowns", subcategory: "shearwall_holdowns",
    fits_member: "2x4 to 2x6 post",
    material: "7 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs_DF: 2940, tension_lbs_SPF: 2610, deflection_in: 0.145, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(18) 0.162x3-1/2", anchor_bolt_dia: "5/8 in." },
    dimensions_in: { W: 2.5, H: 9.25 },
    compatible_with: ["2x4 post","2x6 post","3x4 post"], unit_price_usd: 18.99, pack_size: 1, weight_lbs: 1.05
  },
  {
    sku: "HD5B",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown 5 kip Strap Type",
    category: "holdowns", subcategory: "shearwall_holdowns",
    fits_member: "2x6 to 4x post",
    material: "7 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs_DF: 4675, tension_lbs_SPF: 4150, deflection_in: 0.155, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(28) 0.162x3-1/2", anchor_bolt_dia: "5/8 in." },
    dimensions_in: { W: 2.5, H: 12.5 },
    compatible_with: ["2x6 post","4x4 post","4x6 post"], unit_price_usd: 28.99, pack_size: 1, weight_lbs: 1.55
  },
  {
    sku: "HD7B",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown 7 kip Strap Type",
    category: "holdowns", subcategory: "shearwall_holdowns",
    fits_member: "3-1/2x3-1/2 to 6x post",
    material: "7 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { tension_lbs_DF: 6870, tension_lbs_SPF: 6090, deflection_in: 0.163, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(38) 0.162x3-1/2", anchor_bolt_dia: "7/8 in." },
    dimensions_in: { W: 2.5, H: 16.0 },
    compatible_with: ["4x4 post","4x6 post","6x6 post"], unit_price_usd: 38.99, pack_size: 1, weight_lbs: 2.10
  },
  {
    sku: "HD9B",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown 9 kip Strap Type",
    category: "holdowns", subcategory: "shearwall_holdowns",
    fits_member: "4x post to 6x post",
    material: "7 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { tension_lbs_DF: 8680, tension_lbs_SPF: 7700, deflection_in: 0.172, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(46) 0.162x3-1/2", anchor_bolt_dia: "7/8 in." },
    dimensions_in: { W: 2.5, H: 19.0 },
    compatible_with: ["4x6 post","6x6 post","6x8 post"], unit_price_usd: 54.99, pack_size: 1, weight_lbs: 2.80
  },
  {
    sku: "HTT4",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Tension Tie 4 kip",
    category: "holdowns", subcategory: "tension_ties",
    fits_member: "2x4 to 2x6 post shear wall",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs_DF: 4295, tension_lbs_SPF: 3785, deflection_in: 0.138, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(22) 0.148x3", anchor_bolt_dia: "5/8 in." },
    dimensions_in: { W: 2.5, H: 10.5 },
    compatible_with: ["2x4 post","2x6 post"], unit_price_usd: 22.99, pack_size: 1, weight_lbs: 1.15
  },
  {
    sku: "HTT5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Tension Tie 5 kip",
    category: "holdowns", subcategory: "tension_ties",
    fits_member: "2x6 to 4x post",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs_DF: 5135, tension_lbs_SPF: 4550, deflection_in: 0.145, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(28) 0.148x3", anchor_bolt_dia: "5/8 in." },
    dimensions_in: { W: 2.5, H: 13.0 },
    compatible_with: ["2x6 post","4x4 post"], unit_price_usd: 29.99, pack_size: 1, weight_lbs: 1.45
  },
  {
    sku: "LTTI31",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Low Deflection Tension Tie 3 kip",
    category: "holdowns", subcategory: "tension_ties",
    fits_member: "Single 2x post",
    material: "14 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs_DF: 3070, tension_lbs_SPF: 2720, deflection_in: 0.110, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(12) SDS 1/4x2-1/2", anchor_bolt_dia: "5/8 in." },
    dimensions_in: { W: 1.75, H: 11.5 },
    compatible_with: ["Single 2x4","Single 2x6"], unit_price_usd: 19.99, pack_size: 1, weight_lbs: 0.85
  },

  // ─── Additional Strap Ties ────────────────────────────────────────────────
  {
    sku: "LSTA36",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 36 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1640, uplift_lbs: 1640, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(24) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 36.0 },
    compatible_with: ["2x4","2x6","2x8","2x10","2x12"], unit_price_usd: 1.59, pack_size: 50, weight_lbs: 0.15
  },
  {
    sku: "MSTA49",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 49 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber long span splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 2020, uplift_lbs: 2020, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(26) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 49.0 },
    compatible_with: ["2x4","2x6","2x8","2x10","2x12"], unit_price_usd: 3.49, pack_size: 25, weight_lbs: 0.35
  },
  {
    sku: "ST9",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strap Tie Heavy 9 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber heavy lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 885, uplift_lbs: 885, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(8) 0.162x2-1/2" },
    dimensions_in: { width: 1.25, length: 9.0 },
    compatible_with: ["2x4","2x6","2x8"], unit_price_usd: 1.09, pack_size: 100, weight_lbs: 0.08
  },
  {
    sku: "ST12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strap Tie Heavy 12 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber heavy lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1105, uplift_lbs: 1105, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(10) 0.162x2-1/2" },
    dimensions_in: { width: 1.25, length: 12.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"], unit_price_usd: 1.29, pack_size: 100, weight_lbs: 0.10
  },
  {
    sku: "ST18",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strap Tie Heavy 18 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber heavy lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1420, uplift_lbs: 1420, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(14) 0.162x2-1/2" },
    dimensions_in: { width: 1.25, length: 17.75 },
    compatible_with: ["2x4","2x6","2x8","2x10"], unit_price_usd: 1.59, pack_size: 50, weight_lbs: 0.14
  },
  {
    sku: "ST22",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strap Tie Heavy 22 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber heavy lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1420, uplift_lbs: 1420, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(18) 0.162x2-1/2" },
    dimensions_in: { width: 1.25, length: 21.625 },
    compatible_with: ["2x4","2x6","2x8","2x10","2x12"], unit_price_usd: 1.89, pack_size: 50, weight_lbs: 0.18
  },
  {
    sku: "HGA10",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Gusset Angle Rafter 10 ga",
    category: "hurricane_ties", subcategory: "gusset_angles",
    fits_member: "Rafter to ridge or hip",
    material: "10 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2514", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { uplift_lbs: 1600, lateral_F1_lbs: 1200, lateral_F2_lbs: 640, species: "DF/SP", duration_factor: "wind (1.6)" },
    fastener_schedule: { rafter: "(10) SDS 1/4x3", ridge: "(10) SDS 1/4x3" },
    dimensions_in: { leg1: 4.5, leg2: 4.5, length: 7.0 },
    compatible_with: ["2x8 rafter","2x10 rafter","2x12 rafter","Ridge beam"],
    unit_price_usd: 14.99, pack_size: 10, weight_lbs: 0.95
  },

  // ─── Additional Angles ────────────────────────────────────────────────────
  {
    sku: "LS90",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Structural Angle 3 x 3 x 12 in.",
    category: "angles", subcategory: "structural_angles",
    fits_member: "Light framing or blocking",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1100, uplift_lbs: 820, shear_lbs: 1100, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(22) 0.131x1-1/2" },
    dimensions_in: { leg1: 3.0, leg2: 3.0, length: 12.0 },
    compatible_with: ["2x6","2x8","2x10","2x12","4x4"], unit_price_usd: 3.49, pack_size: 25, weight_lbs: 0.38
  },
  {
    sku: "A21",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Framing Angle 1.5 x 3 x 3 in.",
    category: "angles", subcategory: "framing_angles",
    fits_member: "Joist-to-beam light connection",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 285, uplift_lbs: 210, shear_lbs: 285, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(6) 0.131x1-1/2" },
    dimensions_in: { leg1: 1.5, leg2: 3.0, length: 3.0 },
    compatible_with: ["2x4","2x6","Light joist"], unit_price_usd: 0.55, pack_size: 50, weight_lbs: 0.04
  },
  {
    sku: "BA9Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Beam Angle 9 in. ZMAX",
    category: "angles", subcategory: "structural_angles",
    fits_member: "Beam-to-post connection",
    material: "7 ga steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 3200, uplift_lbs: 1850, shear_lbs: 3200, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(8) SDS 1/4x3", beam: "(8) SDS 1/4x3" },
    dimensions_in: { leg1: 3.5, leg2: 3.5, length: 9.0 },
    compatible_with: ["4x4 post","4x6 post","6x6 post","4x8 beam","4x10 beam"], unit_price_usd: 8.99, pack_size: 10, weight_lbs: 0.68
  },

  // ─── Additional Post Bases ────────────────────────────────────────────────
  {
    sku: "ABW44Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Wide Base Post Base 4x4",
    category: "post_bases", subcategory: "adjustable",
    fits_member: "4x4",
    material: "16 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 7180, uplift_lbs_nails: 1005, uplift_lbs_bolts: null, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(8) 0.148x3", anchor: "1/2 in. dia." },
    dimensions_in: { W: 3.5625, L: 3.5625, H: 2.25 },
    compatible_with: ["4x4 DF","4x4 SPF"], unit_price_usd: 10.99, pack_size: 1, weight_lbs: 0.75,
    notes: "Wide base provides better stability. Lower profile than ABA."
  },
  {
    sku: "ABW66Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Wide Base Post Base 6x6",
    category: "post_bases", subcategory: "adjustable",
    fits_member: "6x6",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 12935, uplift_lbs_nails: 1190, uplift_lbs_bolts: null, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.148x3", anchor: "1/2 in. dia." },
    dimensions_in: { W: 5.5, L: 5.5625, H: 3.0 },
    compatible_with: ["6x6 DF","6x6 SP"], unit_price_usd: 16.99, pack_size: 1, weight_lbs: 1.40
  },
  {
    sku: "ABU65Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 5.5x5 (5.5 wide x 5 deep)",
    category: "post_bases", subcategory: "standoff",
    fits_member: "5.5x5 beam post",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 10960, uplift_lbs_nails: 2475, uplift_lbs_bolts: null, lateral_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.162x3-1/2", anchor: "5/8 in. dia." },
    dimensions_in: { W: 5.5, L: 5.0, standoff: 1.75 },
    compatible_with: ["5.5x5 glulam post","6x6 post"], unit_price_usd: 23.99, pack_size: 1, weight_lbs: 1.88
  },

  // ─── Additional Fasteners ─────────────────────────────────────────────────
  {
    sku: "SD10112",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SD Connector Screw #10 x 1-1/2",
    category: "fasteners", subcategory: "structural_screws",
    fits_member: "Light connector installation",
    material: "Carbon steel", finish: "Proprietary corrosion coating",
    icc_es_report: "ESR-3096", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_steel_plate_lbs: 194, withdrawal_DF_per_in: 138, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.161, length: 1.5 },
    compatible_with: ["LTP4","A34","A35","H1A","H2A","Light gauge connectors"],
    unit_price_usd: 8.99, pack_size: 100, weight_lbs: 0.40,
    notes: "Only screw approved for Simpson connector nail holes per ESR-3096."
  },
  {
    sku: "SD10212",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SD Connector Screw #10 x 2-1/2",
    category: "fasteners", subcategory: "structural_screws",
    fits_member: "Medium connector installation",
    material: "Carbon steel", finish: "Proprietary corrosion coating",
    icc_es_report: "ESR-3096", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_steel_plate_lbs: 220, withdrawal_DF_per_in: 138, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.161, length: 2.5 },
    compatible_with: ["HDUE holdowns","LUS hangers","ABA post bases","H10A"],
    unit_price_usd: 10.99, pack_size: 100, weight_lbs: 0.55
  },
  {
    sku: "SCNR8200",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Ring-Shank Nail 8d x 2 in. SCNR Stainless",
    category: "fasteners", subcategory: "nails",
    fits_member: "Connector nailing in corrosive environments",
    material: "Type 316 stainless steel", finish: "Bright",
    icc_es_report: "ESR-1781", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_DF_lbs: 110, shear_SPF_lbs: 92, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.131, length: 2.0 },
    compatible_with: ["H2.5ASS","H10ASS","LSSU","All SS connectors","ACQ/CA treated lumber"],
    unit_price_usd: 18.99, pack_size: 1, weight_lbs: 1.0, unit: "LB",
    notes: "Required with stainless steel connectors. Ring shank for improved withdrawal."
  },
  {
    sku: "SCNR10150",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Ring-Shank Nail 10d x 1-1/2 in. SCNR Stainless",
    category: "fasteners", subcategory: "nails",
    fits_member: "Joist hanger nailing in corrosive environments",
    material: "Type 316 stainless steel", finish: "Bright",
    icc_es_report: "ESR-1781", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_DF_lbs: 124, shear_SPF_lbs: 104, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.148, length: 1.5 },
    compatible_with: ["LUS-SS","HUS-SS","H1-SS","MSTA-SS","LSTA-SS","All SS hangers"],
    unit_price_usd: 22.99, pack_size: 1, weight_lbs: 1.0, unit: "LB",
    notes: "Use with SS connectors in coastal or pressure-treated applications."
  },
  {
    sku: "PAB5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Plate Anchor Bolt 5/8 x 24 in.",
    category: "fasteners", subcategory: "anchor_bolts",
    fits_member: "Holdown anchor in slab or stem wall",
    material: "ASTM A307 steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 6500, shear_lbs: 3200, species: null, duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.625, length: 24.0, plate_size: "3x3 in." },
    compatible_with: ["HDUE5","HDUE7","HTT5"],
    unit_price_usd: 7.99, pack_size: 1, weight_lbs: 0.72,
    notes: "Square plate washer welded to bottom for slab applications."
  },
  {
    sku: "PAB7",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Plate Anchor Bolt 7/8 x 28 in.",
    category: "fasteners", subcategory: "anchor_bolts",
    fits_member: "Heavy holdown anchor",
    material: "ASTM A307 steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 10200, shear_lbs: 4800, species: null, duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.875, length: 28.0, plate_size: "4x4 in." },
    compatible_with: ["HDUE9","HDQ8","HHDQ11","HD7B","HD9B"],
    unit_price_usd: 12.99, pack_size: 1, weight_lbs: 1.25
  },
  {
    sku: "PAB8",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Plate Anchor Bolt 1 in. x 30 in.",
    category: "fasteners", subcategory: "anchor_bolts",
    fits_member: "Extra heavy holdown anchor",
    material: "ASTM A307 steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { tension_lbs: 16000, shear_lbs: 7500, species: null, duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 1.0, length: 30.0, plate_size: "4x4 in." },
    compatible_with: ["HDUE13","HDUE17","HHDQ14","HD12"],
    unit_price_usd: 18.99, pack_size: 1, weight_lbs: 2.05
  },

  // ─── Additional Column Cap / Base variants ───────────────────────────────
  {
    sku: "CB86",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 8x Post 6x Beam",
    category: "column_caps", subcategory: "column_caps",
    fits_member: "8x post / 6x beam",
    material: "7 ga strap + 7 ga base", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs_DF: 6110, download_lbs_SPF: 4510, uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945, post_load_lbs: 36000, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { anchor: "5/8 in. dia." },
    dimensions_in: { post_W: 7.5, beam_H: 5.5, anchor_dia: 0.625 },
    compatible_with: ["8x8 post","8x10 post","6x8 beam","6x10 beam"], unit_price_usd: 42.99, pack_size: 1, weight_lbs: 3.80
  },
  {
    sku: "CB88",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 8x Post 8x Beam",
    category: "column_caps", subcategory: "column_caps",
    fits_member: "8x post / 8x beam",
    material: "7 ga strap + 7 ga base", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs_DF: 6110, download_lbs_SPF: 4510, uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945, post_load_lbs: 46000, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { anchor: "5/8 in. dia." },
    dimensions_in: { post_W: 7.5, beam_H: 7.5, anchor_dia: 0.625 },
    compatible_with: ["8x8 post","8x10 post","8x8 beam","8x10 beam"], unit_price_usd: 54.99, pack_size: 1, weight_lbs: 4.50
  },
  {
    sku: "CB610",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Column Cap 6x Post 10x Beam",
    category: "column_caps", subcategory: "column_caps",
    fits_member: "6x6 post / 10x beam",
    material: "7 ga strap + 7 ga base", finish: "G90 galvanized",
    icc_es_report: "ESR-1682", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs_DF: 6110, download_lbs_SPF: 4510, uplift_lbs_DF: 5640, uplift_lbs_SPF: 3945, post_load_lbs: 49000, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { anchor: "5/8 in. dia." },
    dimensions_in: { post_W: 5.5, beam_H: 9.5, anchor_dia: 0.625 },
    compatible_with: ["6x6 post","6x10 beam","6x12 beam"], unit_price_usd: 38.99, pack_size: 1, weight_lbs: 3.40
  },

  // ─── Mudsill Anchors ─────────────────────────────────────────────────────
  {
    sku: "MASA",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Mudsill Anchor 2x sill plate",
    category: "angles", subcategory: "mudsill_anchors",
    fits_member: "2x4 or 2x6 sill plate to concrete",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2524", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { F1_parallel_lbs: 1325, F2_perp_lbs: 495, uplift_lbs: 285, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { sill: "(9) 0.148x1-1/2", embed_in_concrete: "Cast-in-place" },
    dimensions_in: { length: 12.0, width: 1.25 },
    compatible_with: ["2x4 sill","2x6 sill","SDC A-F"],
    unit_price_usd: 2.49, pack_size: 50, weight_lbs: 0.14,
    notes: "Embed in wet concrete during pour. Replaces anchor bolts at prescriptive spacing."
  },
  {
    sku: "MASAP",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Mudsill Anchor Wide 2x6 sill plate",
    category: "angles", subcategory: "mudsill_anchors",
    fits_member: "2x6 wide sill plate to concrete",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2524", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { F1_parallel_lbs: 1325, F2_perp_lbs: 495, uplift_lbs: 285, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { sill: "(11) 0.148x1-1/2" },
    dimensions_in: { length: 14.0, width: 2.0 },
    compatible_with: ["2x6 sill","2x8 sill","SDC A-F"],
    unit_price_usd: 3.19, pack_size: 25, weight_lbs: 0.20
  },

  // ─── Additional Misc ──────────────────────────────────────────────────────
  {
    sku: "LUSS28-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Skewed Double Joist Hanger 2x8",
    category: "joist_hangers", subcategory: "skewed",
    fits_member: "Double 2x8 skewed",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1190, uplift_lbs: 1120, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(8) 0.148x3", header: "(4) 0.148x3" },
    dimensions_in: { W: 3.125, H: 7.0 },
    compatible_with: ["Double 2x8 DF","Double 2x8 SPF"],
    unit_price_usd: 7.49, pack_size: 10, weight_lbs: 0.45,
    notes: "45-degree skew. Verify direction before ordering."
  },
  {
    sku: "LUS26-3",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Triple Joist Hanger 2x6",
    category: "joist_hangers", subcategory: "face_mount",
    fits_member: "Triple 2x6",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1065, uplift_lbs: 945, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(4) 0.162x3-1/2", header: "(4) 0.162x3-1/2" },
    dimensions_in: { W: 4.625, H: 5.0, B: 2.0 },
    compatible_with: ["Triple 2x6 DF","Triple 2x6 SPF"],
    unit_price_usd: 5.49, pack_size: 10, weight_lbs: 0.42
  },
  {
    sku: "LSSU210L",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Skewed Left Single Joist Hanger 2x10",
    category: "joist_hangers", subcategory: "skewed",
    fits_member: "2x10 skewed left",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 1045, uplift_lbs: 1175, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(6) 0.148x3", header: "(4) 0.148x3" },
    dimensions_in: { W: 1.5625, H: 8.75 },
    compatible_with: ["2x10 DF","2x10 SPF"],
    unit_price_usd: 5.49, pack_size: 25, weight_lbs: 0.28,
    notes: "45-degree skew left only."
  },
  {
    sku: "HRS6",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Strap Tie 6 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "Heavy lumber lap splice",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 605, uplift_lbs: 605, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(6) 0.148x2-1/2" },
    dimensions_in: { width: 1.375, length: 6.0 },
    compatible_with: ["2x4","2x6","2x8","4x4"],
    unit_price_usd: 0.89, pack_size: 100, weight_lbs: 0.07
  },
  {
    sku: "HRS8",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Strap Tie 8 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "Heavy lumber lap splice",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1010, uplift_lbs: 1010, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(10) 0.148x2-1/2" },
    dimensions_in: { width: 1.375, length: 8.0 },
    compatible_with: ["2x4","2x6","2x8","4x4"],
    unit_price_usd: 1.09, pack_size: 100, weight_lbs: 0.09
  },
  {
    sku: "HRS12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Strap Tie 12 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "Heavy lumber lap splice",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1415, uplift_lbs: 1415, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(14) 0.148x2-1/2" },
    dimensions_in: { width: 1.375, length: 12.0 },
    compatible_with: ["2x4","2x6","2x8","4x4","4x6"],
    unit_price_usd: 1.35, pack_size: 100, weight_lbs: 0.12
  },

  // LSTA15 (was between LSTA12 and LSTA18)
  {
    sku: "LSTA15",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 15 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1130, uplift_lbs: 1130, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(12) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 15.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 0.99, pack_size: 100, weight_lbs: 0.08
  },
  {
    sku: "LSTA30",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Light Strap Tie 30 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "20 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1640, uplift_lbs: 1640, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(22) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 30.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 1.39, pack_size: 50, weight_lbs: 0.13
  },
  {
    sku: "MSTA15",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 15 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1130, uplift_lbs: 1130, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(12) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 15.0 },
    compatible_with: ["2x4","2x6","2x8"],
    unit_price_usd: 1.39, pack_size: 50, weight_lbs: 0.12
  },
  {
    sku: "MSTA21",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Medium Strap Tie 21 in.",
    category: "hurricane_ties", subcategory: "strap_ties",
    fits_member: "2x lumber lap splice",
    material: "16 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 1505, uplift_lbs: 1505, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(16) 0.148x2-1/2" },
    dimensions_in: { width: 1.25, length: 21.0 },
    compatible_with: ["2x4","2x6","2x8","2x10"],
    unit_price_usd: 1.69, pack_size: 50, weight_lbs: 0.16
  },

];

// Merge both arrays into a single unified export
export const ALL_PRODUCTS = [...SEED_PRODUCTS, ...SEED_PRODUCTS_EXTRA];
export const TOTAL_PRODUCT_COUNT = ALL_PRODUCTS.length;

// Final batch to reach 200+ total
export const SEED_PRODUCTS_FINAL = [
  // More joist hangers: LUS214, LUS28-2 already done, add more 4x variants
  {
    sku: "HU24-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Double 2x4 Joist Hanger",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x4",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 595, uplift_lbs: 380, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(4) 0.162x3-1/2", header: "(2) 0.148x3" },
    dimensions_in: { W: 3.125, H: 3.0625, B: 2.5 },
    compatible_with: ["Double 2x4 DF","Double 2x4 SPF"], unit_price_usd: 3.99, pack_size: 25, weight_lbs: 0.28
  },
  {
    sku: "HU28-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Double 2x8 Joist Hanger",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x8",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 2085, uplift_lbs: 1345, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(14) 0.162x3-1/2", header: "(6) 0.148x3" },
    dimensions_in: { W: 3.125, H: 7.5, B: 2.5 },
    compatible_with: ["Double 2x8 DF","Double 2x8 SPF"], unit_price_usd: 6.99, pack_size: 10, weight_lbs: 0.58
  },
  {
    sku: "HU212-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Duty Double 2x12 Joist Hanger",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x12",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 2680, uplift_lbs: 1895, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(18) 0.162x3-1/2", header: "(10) 0.148x3" },
    dimensions_in: { W: 3.125, H: 11.25, B: 2.5 },
    compatible_with: ["Double 2x12 DF","Double 2x12 SPF"], unit_price_usd: 9.49, pack_size: 10, weight_lbs: 0.80
  },
  {
    sku: "LUS214-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x14",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x14",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 2170, uplift_lbs: 1990, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(12) 0.162x3-1/2", header: "(4) 0.162x3-1/2" },
    dimensions_in: { W: 3.125, H: 10.9375, B: 2.0 },
    compatible_with: ["Double 2x14 DF","Double 2x14 SPF","LVL 3-1/2x14"], unit_price_usd: 7.99, pack_size: 10, weight_lbs: 0.65
  },
  {
    sku: "HUS212-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy-Duty Double Joist Hanger 2x12",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x12",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 5355, uplift_lbs: 2700, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(24) 0.162x3-1/2", header: "(10) 0.162x3-1/2" },
    dimensions_in: { W: 3.125, H: 11.5, B: 3.0 },
    compatible_with: ["Double 2x12 DF","Double 2x12 SPF","LVL 3-1/2x11-7/8"], unit_price_usd: 13.99, pack_size: 10, weight_lbs: 1.05
  },
  // More post base variants
  {
    sku: "ABA44RZ",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base Rough 4x4",
    category: "post_bases", subcategory: "adjustable", fits_member: "Rough 4x4",
    material: "16 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 7215, uplift_lbs_nails: 655, uplift_lbs_bolts: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(6) 0.148x3", anchor: "1/2 in. dia." },
    dimensions_in: { W: 4.0625, L: 3.125, H: 2.8125 },
    compatible_with: ["Rough 4x4 DF","Rough 4x4 SPF"], unit_price_usd: 9.99, pack_size: 1, weight_lbs: 0.68
  },
  {
    sku: "ABA66RZ",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Adjustable Post Base Rough 6x6",
    category: "post_bases", subcategory: "adjustable", fits_member: "Rough 6x6",
    material: "14 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 11415, uplift_lbs_nails: 920, uplift_lbs_bolts: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(8) 0.162x3-1/2", anchor: "5/8 in. dia." },
    dimensions_in: { W: 6.0, L: 5.1875, H: 2.875 },
    compatible_with: ["Rough 6x6 DF","Rough 6x6 SP"], unit_price_usd: 15.49, pack_size: 1, weight_lbs: 1.25
  },
  {
    sku: "ABU44RZ",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base Rough 4x4",
    category: "post_bases", subcategory: "standoff", fits_member: "Rough 4x4",
    material: "16 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 7570, uplift_lbs_nails: 1900, uplift_lbs_bolts: 2300, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.162x3-1/2", anchor: "5/8 in. dia.", anchor_bolts: 2 },
    dimensions_in: { W: 4.0625, L: 3.0, H: 5.25, standoff: 1.5 },
    compatible_with: ["Rough 4x4 DF","Rough 4x4 SPF"], unit_price_usd: 15.99, pack_size: 1, weight_lbs: 0.90
  },
  {
    sku: "ABU66RZ",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base Rough 6x6",
    category: "post_bases", subcategory: "standoff", fits_member: "Rough 6x6",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 18205, uplift_lbs_nails: 2475, uplift_lbs_bolts: 2190, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.162x3-1/2", anchor: "5/8 in. dia.", anchor_bolts: 2 },
    dimensions_in: { W: 6.0625, L: 5.0, H: 5.8125, standoff: 1.5 },
    compatible_with: ["Rough 6x6 DF","Rough 6x6 SP"], unit_price_usd: 23.99, pack_size: 1, weight_lbs: 1.85
  },
  {
    sku: "ABU1212Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 12x12",
    category: "post_bases", subcategory: "standoff", fits_member: "12x12",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { download_lbs: 48000, uplift_lbs_nails: 9200, uplift_lbs_bolts: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(36) 0.162x3-1/2 or (8) SDS 1/4x3", anchor: "(2) 3/4 in. dia." },
    dimensions_in: { W: 11.5, standoff: 2.0 },
    compatible_with: ["12x12 DF","12x12 SP"], unit_price_usd: 109.99, pack_size: 1, weight_lbs: 8.50
  },
  // More angles
  {
    sku: "A35Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Framing Angle 2.5 x 3 x 3 in. ZMAX",
    category: "angles", subcategory: "framing_angles", fits_member: "2x lumber general purpose - ACQ",
    material: "18 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 590, uplift_lbs: 480, shear_lbs: 590, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(8) 0.131x1-1/2" },
    dimensions_in: { leg1: 2.5, leg2: 3.0, length: 3.0 },
    compatible_with: ["ACQ treated lumber","2x4","2x6","2x8"], unit_price_usd: 1.09, pack_size: 50, weight_lbs: 0.06,
    notes: "ZMAX for use with ACQ/CA/CCA pressure-treated lumber."
  },
  {
    sku: "H1Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Rafter ZMAX (replaces H1)",
    category: "hurricane_ties", subcategory: "rafter_ties", fits_member: "2x rafter to plate ACQ",
    material: "18 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-2514", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { uplift_lbs: 490, lateral_F1_lbs: 380, lateral_F2_lbs: 220, species: "DF/SP", duration_factor: "wind (1.6)" },
    fastener_schedule: { rafter: "(4) 0.131x1-1/2", stud: "(4) 0.131x1-1/2" },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter","ACQ treated plate"],
    unit_price_usd: 1.55, pack_size: 50, weight_lbs: 0.08,
    notes: "ZMAX for ACQ/CA pressure-treated lumber environments."
  },
  {
    sku: "H2.5ASS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie High Uplift Stainless Steel",
    category: "hurricane_ties", subcategory: "rafter_ties", fits_member: "2x rafter to plate marine",
    material: "18 ga Type 316 stainless steel", finish: "Bright stainless",
    icc_es_report: "ESR-2514", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { uplift_lbs: 440, lateral_F1_lbs: 75, lateral_F2_lbs: 70, species: "DF/SP", duration_factor: "wind (1.6)" },
    fastener_schedule: { rafter: "(5) SCNR8200", stud: "(5) SCNR8200" },
    compatible_with: ["2x4 rafter","2x6 rafter","Marine/coastal exposure"],
    unit_price_usd: 4.99, pack_size: 25, weight_lbs: 0.10,
    notes: "Type 316 SS for marine/coastal environments. Use with SS nails."
  },
  {
    sku: "H3SS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie Double Shear Stainless Steel",
    category: "hurricane_ties", subcategory: "rafter_ties", fits_member: "2x rafter marine",
    material: "18 ga Type 316 stainless steel", finish: "Bright stainless",
    icc_es_report: "ESR-2514", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { uplift_lbs: 700, lateral_F1_lbs: 195, lateral_F2_lbs: 155, species: "DF/SP", duration_factor: "wind (1.6)" },
    fastener_schedule: { rafter: "(5) SCNR8200", plate: "(8) SCNR8200" },
    compatible_with: ["2x4 rafter","2x6 rafter","2x8 rafter","Marine/coastal"],
    unit_price_usd: 5.99, pack_size: 25, weight_lbs: 0.12,
    notes: "Type 316 SS. Highest corrosion resistance for oceanfront exposure."
  },
  {
    sku: "H10ASS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Hurricane Tie High Capacity Stainless Steel",
    category: "hurricane_ties", subcategory: "rafter_ties", fits_member: "Truss to plate marine",
    material: "18 ga Type 316 stainless steel", finish: "Bright stainless",
    icc_es_report: "ESR-2514", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { uplift_lbs: 1160, lateral_F1_lbs: 710, lateral_F2_lbs: 290, species: "DF/SP", duration_factor: "wind (1.6)" },
    fastener_schedule: { truss: "(8) SCNR10150", plate: "(12) SCNR10150" },
    compatible_with: ["Engineered trusses","Marine exposure"],
    unit_price_usd: 9.99, pack_size: 25, weight_lbs: 0.30,
    notes: "Use with Type 316 SS nails only."
  },
  // Additional fasteners
  {
    sku: "SSTB16SS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Anchor Bolt 5/8 x 14-1/2 J-bolt Stainless",
    category: "fasteners", subcategory: "anchor_bolts", fits_member: "Holdown marine environment",
    material: "Type 316 stainless steel", finish: "Bright stainless",
    icc_es_report: "ESR-1622", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 3510, shear_lbs: 2800, species: null, duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.625, length: 14.5, embedment: 7.0 },
    compatible_with: ["HDUE3","HDUE5","Marine exposure"],
    unit_price_usd: 12.99, pack_size: 1, weight_lbs: 0.38,
    notes: "For coastal/marine applications. Type 316 SS."
  },
  {
    sku: "SDWH19300DB",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWH Timber-Hex Screw 0.276 x 3",
    category: "fasteners", subcategory: "structural_screws", fits_member: "Connector or wood-to-wood light",
    material: "Carbon steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-2236", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_DF_lbs: 340, shear_SPF_lbs: 285, withdrawal_DF_lbs_per_in: 385, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.276, length: 3.0 },
    compatible_with: ["Post base installation","Ledger attachment light duty"],
    unit_price_usd: 1.99, pack_size: 25, weight_lbs: 0.22
  },
  {
    sku: "SDWH191000DB",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Strong-Drive SDWH Timber-Hex Screw 0.276 x 10",
    category: "fasteners", subcategory: "structural_screws", fits_member: "Timber-to-timber heavy",
    material: "Carbon steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-2236", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_DF_lbs: 460, shear_SPF_lbs: 385, withdrawal_DF_lbs_per_in: 385, species: "DF/SP", duration_factor: "normal (1.0)" },
    dimensions_in: { dia: 0.276, length: 10.0 },
    compatible_with: ["Heavy timber","Mass timber","Glulam connections"],
    unit_price_usd: 4.49, pack_size: 25, weight_lbs: 0.75
  },
  {
    sku: "SABR58X24",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Retrofit Anchor Bolt 5/8 x 24 SABR",
    category: "fasteners", subcategory: "anchor_bolts", fits_member: "Seismic retrofit anchor",
    material: "ASTM A36 steel", finish: "Hot-dip galvanized",
    icc_es_report: "ESR-1622", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 5850, shear_lbs: 3200, species: null, duration_factor: "seismic (1.6)" },
    dimensions_in: { dia: 0.625, length: 24.0, plate: "3x3 in." },
    compatible_with: ["HDUE5","HDUE7","Seismic retrofit","SDC C-F"],
    unit_price_usd: 9.49, pack_size: 1, weight_lbs: 0.72,
    notes: "Epoxy-set anchor for seismic retrofit. Requires SET-3G or ET-3G epoxy."
  },

  // Additional holdowns for coverage
  {
    sku: "HD12",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown 12 kip High Capacity",
    category: "holdowns", subcategory: "shearwall_holdowns", fits_member: "4x6 to 6x6 post",
    material: "3/16 in. A36 steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { tension_lbs_DF: 11425, tension_lbs_SPF: 10140, deflection_in: 0.188, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(54) 0.162x3-1/2", anchor_bolt_dia: "1 in." },
    dimensions_in: { W: 3.0, H: 24.0 },
    compatible_with: ["4x6 post","6x6 post","6x8 post"], unit_price_usd: 72.99, pack_size: 1, weight_lbs: 3.80
  },
  {
    sku: "HTTHI6.5",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Holdown Tie Heavy 6.5 kip",
    category: "holdowns", subcategory: "tension_ties", fits_member: "3x6 to 4x6 post",
    material: "12 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-2440", code_compliance: ["IBC 2024","IBC 2021","IBC 2018"],
    load_ratings: { tension_lbs_DF: 6555, tension_lbs_SPF: 5815, deflection_in: 0.162, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { wood: "(32) 0.148x3", anchor_bolt_dia: "3/4 in." },
    dimensions_in: { W: 2.75, H: 16.5 },
    compatible_with: ["3x6 post","4x6 post","6x6 post"], unit_price_usd: 42.99, pack_size: 1, weight_lbs: 2.15
  },

];

// Re-export combined array including all product batches
export const ALL_PRODUCTS_COMBINED = [...ALL_PRODUCTS, ...SEED_PRODUCTS_FINAL];
export const FINAL_PRODUCT_COUNT = ALL_PRODUCTS_COMBINED.length;

// Last 10 products to cross 200
export const SEED_PRODUCTS_LAST10 = [
  {
    sku: "LUS24-2",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Double-Shear Double Joist Hanger 2x4",
    category: "joist_hangers", subcategory: "face_mount", fits_member: "Double 2x4",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1295", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 800, uplift_lbs: 410, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { joist: "(4) 0.162x3-1/2", header: "(2) 0.162x3-1/2" },
    dimensions_in: { W: 3.125, H: 3.0, B: 2.0 },
    compatible_with: ["Double 2x4 DF","Double 2x4 SPF"], unit_price_usd: 2.89, pack_size: 25, weight_lbs: 0.20
  },
  {
    sku: "CS14",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Coil Strap 100 ft Roll 14 ga",
    category: "hurricane_ties", subcategory: "coil_straps", fits_member: "Cut to length on site",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 6475, uplift_lbs: 6475, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(56) 0.162x2-1/2 per 26-in. end" },
    dimensions_in: { width: 1.25, roll_ft: 100 },
    compatible_with: ["2x or wider framing"], unit_price_usd: 49.99, pack_size: 1, weight_lbs: 6.8
  },
  {
    sku: "ABU5-5Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Standoff Post Base 5.25x5.25",
    category: "post_bases", subcategory: "standoff", fits_member: "5-1/4x5-1/4 post",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 14000, uplift_lbs_nails: 3100, uplift_lbs_bolts: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.162x3-1/2", anchor: "5/8 in. dia.", anchor_bolts: 2 },
    dimensions_in: { W: 5.25, standoff: 1.75 },
    compatible_with: ["5-1/4x5-1/4 glulam","PSL post"], unit_price_usd: 29.99, pack_size: 1, weight_lbs: 2.30
  },
  {
    sku: "ABW7-7Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Wide Base Post Base 7-1/8 x 7-1/8",
    category: "post_bases", subcategory: "adjustable", fits_member: "7-1/8x7-1/8 glulam",
    material: "12 ga ASTM A653 steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-2515", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 16685, uplift_lbs_nails: 840, uplift_lbs_bolts: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(12) 0.148x3", anchor: "1/2 in. dia." },
    dimensions_in: { W: 7.3125, L: 7.3125, H: 3.0 },
    compatible_with: ["7-1/8x7-1/8 glulam"], unit_price_usd: 29.99, pack_size: 1, weight_lbs: 2.65
  },
  {
    sku: "LTP5Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Lateral Tie Plate 5 in. ZMAX",
    category: "angles", subcategory: "tie_plates", fits_member: "2x plate to rim board ACQ",
    material: "20 ga steel", finish: "ZMAX coating",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_lbs: 930, tension_lbs: null, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(10) 0.131x1-1/2" },
    dimensions_in: { width: 2.0, length: 5.0 },
    compatible_with: ["ACQ treated plate","2x6 plate","Rim board"],
    unit_price_usd: 0.89, pack_size: 100, weight_lbs: 0.05
  },
  {
    sku: "HUCQ210-2-SDS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Hanger Double 2x10 SDS Post/Beam",
    category: "joist_hangers", subcategory: "concealed", fits_member: "Double 2x10",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1961", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 4315, uplift_lbs: 2345, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { header: "(12) SDS 1/4x2-1/2", joist: "(6) SDS 1/4x2-1/2" },
    dimensions_in: { W: 3.125, H: 9.0, B: 3.0 },
    compatible_with: ["Double 2x10 DF","Double 2x10 SP","LVL 3-1/2x9-1/2"],
    unit_price_usd: 21.99, pack_size: 5, weight_lbs: 1.45
  },
  {
    sku: "HUCQ210-3-SDS",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Heavy Hanger Triple 2x10 SDS Post/Beam",
    category: "joist_hangers", subcategory: "concealed", fits_member: "Triple 2x10",
    material: "14 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1961", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 4315, uplift_lbs: 2345, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { header: "(12) SDS 1/4x2-1/2", joist: "(6) SDS 1/4x2-1/2" },
    dimensions_in: { W: 4.625, H: 9.0, B: 3.0 },
    compatible_with: ["Triple 2x10 DF","Triple 2x10 SP","LVL 5-1/4x9-1/2"],
    unit_price_usd: 28.99, pack_size: 5, weight_lbs: 2.05
  },
  {
    sku: "BA18Z",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Beam Angle 18 in. ZMAX Heavy",
    category: "angles", subcategory: "structural_angles", fits_member: "Heavy beam-to-post",
    material: "7 ga steel", finish: "ZMAX G185 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { download_lbs: 6200, uplift_lbs: 3500, shear_lbs: 6200, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { post: "(16) SDS 1/4x3", beam: "(16) SDS 1/4x3" },
    dimensions_in: { leg1: 3.5, leg2: 3.5, length: 18.0 },
    compatible_with: ["6x6 post","8x8 post","6x10 beam","6x12 beam"], unit_price_usd: 16.99, pack_size: 10, weight_lbs: 1.35
  },
  {
    sku: "LFTA",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Lateral Force Transfer Angle",
    category: "angles", subcategory: "structural_angles", fits_member: "Lateral force transfer",
    material: "7 ga ASTM A36 steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { shear_lbs: 4500, tension_lbs: 3200, download_lbs: 6800, species: "DF/SP", duration_factor: "wind/seismic (1.6)" },
    fastener_schedule: { nails: "(20) SDS 1/4x3" },
    dimensions_in: { leg1: 5.5, leg2: 5.5, length: 6.0 },
    compatible_with: ["Shear wall","Diaphragm boundary","6x beam"], unit_price_usd: 24.99, pack_size: 5, weight_lbs: 1.88,
    notes: "Transfers lateral forces between diaphragm and shear wall."
  },
  {
    sku: "CS18",
    manufacturer: "Simpson Strong-Tie",
    generic_name: "Coil Strap 150 ft Roll 18 ga",
    category: "hurricane_ties", subcategory: "coil_straps", fits_member: "Cut to length on site light",
    material: "18 ga steel", finish: "G90 galvanized",
    icc_es_report: "ESR-1872", code_compliance: ["IBC 2024","IBC 2021","IBC 2018","IRC 2021"],
    load_ratings: { tension_lbs: 2490, uplift_lbs: 2490, species: "DF/SP", duration_factor: "normal (1.0)" },
    fastener_schedule: { nails: "(26) 0.148x2-1/2 per 15-in. end" },
    dimensions_in: { width: 1.25, roll_ft: 150 },
    compatible_with: ["2x lumber","Overlap splice"], unit_price_usd: 29.99, pack_size: 1, weight_lbs: 4.2,
    notes: "Light gauge. Cut to length as needed. Use full nail schedule per end length."
  },
];

// Final unified export
export const COMPLETE_PRODUCT_CATALOG = [...ALL_PRODUCTS_COMBINED, ...SEED_PRODUCTS_LAST10];
export const CATALOG_COUNT = COMPLETE_PRODUCT_CATALOG.length;
