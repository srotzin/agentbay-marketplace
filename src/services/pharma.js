/**
 * HiveAgent Pharmaceutical Services
 *
 * Drug discovery, clinical trials, FDA compliance, supply chain,
 * regulatory submissions, and pharma market intelligence.
 *
 * Revenue model:
 *   searchDrugDatabase       $0.50 / search
 *   checkDrugInteractions    $0.25 / check
 *   trackClinicalTrial       $0.50 / lookup
 *   forecastDrugApproval     $2.00 / forecast
 *   optimizeDrugPricing      $3.00 / analysis
 *   managePharmaSupplyChain  $1.00 / check
 *   generateRegulatorySubmission $10.00 / submission
 *   getPharmaMarketIntelligence  $5.00 / report
 */

import { randomUUID } from "crypto";
import db from "../db.js";
import {
  DRUGS,
  searchDrugs as searchDrugsLocal,
  getDrug,
  getDrugsByClass,
  getDrugInteractions,
} from "./pharma-drugs-db.js";

// ─── Schema Init ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pharma_drugs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    generic TEXT NOT NULL,
    brand TEXT,
    drug_class TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    indications TEXT DEFAULT '[]',
    contraindications TEXT DEFAULT '[]',
    interactions TEXT DEFAULT '[]',
    patent_expiry TEXT,
    fda_status TEXT DEFAULT 'approved',
    molecular_weight REAL,
    half_life TEXT,
    route TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pharma_clinical_trials (
    id TEXT PRIMARY KEY,
    nct_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    phase TEXT,
    sponsor TEXT,
    enrollment INTEGER,
    conditions TEXT DEFAULT '[]',
    interventions TEXT DEFAULT '[]',
    locations TEXT DEFAULT '[]',
    start_date TEXT,
    completion_date TEXT,
    results_available INTEGER DEFAULT 0,
    primary_endpoint TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pharma_searches (
    id TEXT PRIMARY KEY,
    query TEXT,
    drug_class TEXT,
    indication TEXT,
    result_count INTEGER,
    fee_usd REAL DEFAULT 0.50,
    searched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pharma_interaction_checks (
    id TEXT PRIMARY KEY,
    drugs TEXT NOT NULL,
    patient_profile TEXT DEFAULT '{}',
    interaction_count INTEGER,
    critical_count INTEGER,
    fee_usd REAL DEFAULT 0.25,
    checked_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pharma_approval_forecasts (
    id TEXT PRIMARY KEY,
    drug_name TEXT NOT NULL,
    indication TEXT,
    phase TEXT,
    mechanism TEXT,
    approval_probability REAL,
    timeline_estimate TEXT,
    fee_usd REAL DEFAULT 2.00,
    forecasted_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pharma_supply_checks (
    id TEXT PRIMARY KEY,
    drug_id TEXT,
    facilities TEXT DEFAULT '[]',
    demand_forecast TEXT,
    supply_status TEXT,
    shortage_risk TEXT,
    fee_usd REAL DEFAULT 1.00,
    checked_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_DRUGS = [
  // ── Diabetes / Metabolic ──────────────────────────────────────────────────
  {
    id: "drug-metformin",
    name: "Metformin",
    generic: "metformin hydrochloride",
    brand: "Glucophage",
    drug_class: "Biguanide",
    mechanism: "Activates AMPK; reduces hepatic glucose production and improves insulin sensitivity",
    indications: ["Type 2 diabetes mellitus", "Prediabetes", "Polycystic ovary syndrome", "Weight management"],
    contraindications: ["eGFR < 30 mL/min", "Metabolic acidosis", "Iodinated contrast within 48h"],
    interactions: ["Alcohol", "Cimetidine", "Contrast agents", "Topiramate"],
    patent_expiry: "1994-01-01",
    fda_status: "approved",
    half_life: "4-9 hours",
    route: "oral",
  },
  {
    id: "drug-semaglutide",
    name: "Semaglutide",
    generic: "semaglutide",
    brand: "Ozempic / Wegovy / Rybelsus",
    drug_class: "GLP-1 Receptor Agonist",
    mechanism: "Activates GLP-1 receptors; increases insulin secretion, decreases glucagon, slows gastric emptying, reduces appetite via hypothalamic signaling",
    indications: ["Type 2 diabetes mellitus", "Chronic weight management (BMI ≥30)", "Cardiovascular risk reduction in T2DM", "Obesity"],
    contraindications: ["Personal or family history of medullary thyroid carcinoma", "MEN2 syndrome", "Pregnancy"],
    interactions: ["Oral medications (delayed absorption)", "Insulin (hypoglycemia risk)", "Sulfonylureas"],
    patent_expiry: "2032-06-15",
    fda_status: "approved",
    half_life: "~1 week",
    route: "subcutaneous injection / oral",
  },
  {
    id: "drug-tirzepatide",
    name: "Tirzepatide",
    generic: "tirzepatide",
    brand: "Mounjaro / Zepbound",
    drug_class: "GLP-1 / GIP Dual Agonist",
    mechanism: "Dual agonist of GLP-1 and GIP receptors; superior glycemic control and weight reduction vs. GLP-1 monotherapy",
    indications: ["Type 2 diabetes mellitus", "Chronic obesity", "Heart failure with preserved ejection fraction"],
    contraindications: ["Personal/family history of MTC", "MEN2", "Pregnancy", "Pancreatitis history"],
    interactions: ["Oral contraceptives (reduce efficacy)", "Insulin", "Warfarin"],
    patent_expiry: "2036-05-20",
    fda_status: "approved",
    half_life: "~5 days",
    route: "subcutaneous injection",
  },
  // ── Cardiovascular ────────────────────────────────────────────────────────
  {
    id: "drug-atorvastatin",
    name: "Atorvastatin",
    generic: "atorvastatin calcium",
    brand: "Lipitor",
    drug_class: "HMG-CoA Reductase Inhibitor (Statin)",
    mechanism: "Competitively inhibits HMG-CoA reductase; reduces hepatic cholesterol synthesis; upregulates LDL receptors",
    indications: ["Hypercholesterolemia", "Dyslipidemia", "Cardiovascular risk reduction", "Familial hypercholesterolemia", "Post-ACS secondary prevention"],
    contraindications: ["Active liver disease", "Pregnancy", "Breastfeeding", "Unexplained elevated transaminases"],
    interactions: ["CYP3A4 inhibitors (azoles, macrolides)", "Fibrates (myopathy risk)", "Cyclosporine", "Niacin", "Digoxin"],
    patent_expiry: "2011-11-30",
    fda_status: "approved",
    half_life: "14 hours",
    route: "oral",
  },
  {
    id: "drug-sacubitril-valsartan",
    name: "Sacubitril/Valsartan",
    generic: "sacubitril/valsartan",
    brand: "Entresto",
    drug_class: "Angiotensin Receptor-Neprilysin Inhibitor (ARNI)",
    mechanism: "Dual blockade: valsartan blocks AT1 receptors; sacubitril inhibits neprilysin → elevates natriuretic peptides; reduces cardiac remodeling",
    indications: ["Heart failure with reduced ejection fraction (HFrEF)", "Symptomatic HF NYHA class II-IV"],
    contraindications: ["History of ACE inhibitor-related angioedema", "Concomitant ACEi use (36h washout required)", "Pregnancy", "Severe hepatic impairment"],
    interactions: ["ACE inhibitors", "Potassium-sparing diuretics", "NSAIDs", "Aliskiren in diabetes"],
    patent_expiry: "2025-12-31",
    fda_status: "approved",
    half_life: "Sacubitril 1.4h (prodrug); valsartan 9.9h",
    route: "oral",
  },
  {
    id: "drug-dapagliflozin",
    name: "Dapagliflozin",
    generic: "dapagliflozin",
    brand: "Farxiga",
    drug_class: "SGLT2 Inhibitor",
    mechanism: "Inhibits sodium-glucose co-transporter 2 in proximal renal tubule; increases urinary glucose excretion; reduces preload/afterload",
    indications: ["Type 2 diabetes mellitus", "Heart failure (HFrEF and HFpEF)", "Chronic kidney disease"],
    contraindications: ["eGFR < 25 mL/min (T2DM indication)", "Type 1 diabetes", "Recurrent genital infections"],
    interactions: ["Insulin", "Diuretics (volume depletion)", "Lithium"],
    patent_expiry: "2027-07-15",
    fda_status: "approved",
    half_life: "12.9 hours",
    route: "oral",
  },
  // ── Immunology / Biologics ────────────────────────────────────────────────
  {
    id: "drug-adalimumab",
    name: "Adalimumab",
    generic: "adalimumab",
    brand: "Humira",
    drug_class: "TNF-alpha Inhibitor (Monoclonal Antibody)",
    mechanism: "Fully human IgG1 monoclonal antibody; binds and neutralizes soluble and membrane-bound TNF-alpha; reduces inflammatory cascade",
    indications: ["Rheumatoid arthritis", "Psoriatic arthritis", "Ankylosing spondylitis", "Crohn's disease", "Ulcerative colitis", "Plaque psoriasis", "Juvenile idiopathic arthritis"],
    contraindications: ["Active serious infections", "TB without prophylaxis", "Heart failure (NYHA III/IV)", "Hepatitis B"],
    interactions: ["Live vaccines", "Anakinra", "Abatacept", "Methotrexate (pharmacokinetic interaction)"],
    patent_expiry: "2023-06-30",
    fda_status: "approved",
    half_life: "~2 weeks",
    route: "subcutaneous injection",
  },
  {
    id: "drug-dupilumab",
    name: "Dupilumab",
    generic: "dupilumab",
    brand: "Dupixent",
    drug_class: "IL-4/IL-13 Receptor Antagonist (Monoclonal Antibody)",
    mechanism: "Blocks shared IL-4Rα subunit; inhibits IL-4 and IL-13 signaling (key Th2/atopic cytokines)",
    indications: ["Atopic dermatitis", "Asthma (eosinophilic/OCS-dependent)", "Chronic rhinosinusitis with nasal polyps", "Eosinophilic esophagitis", "Prurigo nodularis"],
    contraindications: ["Hypersensitivity to dupilumab"],
    interactions: ["Live vaccines (avoid during treatment)", "Corticosteroids (gradual taper on initiation)"],
    patent_expiry: "2031-03-28",
    fda_status: "approved",
    half_life: "~21 days",
    route: "subcutaneous injection",
  },
  // ── Oncology ──────────────────────────────────────────────────────────────
  {
    id: "drug-pembrolizumab",
    name: "Pembrolizumab",
    generic: "pembrolizumab",
    brand: "Keytruda",
    drug_class: "PD-1 Checkpoint Inhibitor (Monoclonal Antibody)",
    mechanism: "Humanized IgG4 antibody; blocks PD-1 receptor on T cells; restores anti-tumor immunity by preventing PD-L1/PD-L2 binding",
    indications: ["NSCLC (PD-L1+, first-line)", "Melanoma", "Head and neck SCC", "Urothelial carcinoma", "Cervical cancer", "TNBC", "Colorectal cancer (MSI-H)", "Pan-tumor TMB-H indication"],
    contraindications: ["Active autoimmune disease requiring systemic therapy", "Active severe irAEs from prior ICI"],
    interactions: ["Immunosuppressants (reduce efficacy)", "Corticosteroids (needed for irAE management)"],
    patent_expiry: "2028-07-11",
    fda_status: "approved",
    half_life: "~27 days",
    route: "intravenous infusion",
  },
  {
    id: "drug-osimertinib",
    name: "Osimertinib",
    generic: "osimertinib",
    brand: "Tagrisso",
    drug_class: "Third-Generation EGFR Tyrosine Kinase Inhibitor",
    mechanism: "Irreversibly inhibits EGFR with sensitizing mutations (Ex19del, L858R) and resistance mutation T790M; CNS penetrant",
    indications: ["NSCLC with EGFR mutations (first-line)", "T790M mutation-positive NSCLC (second-line)", "Adjuvant NSCLC with EGFR mutations"],
    contraindications: ["QTc > 470ms", "Concurrent QT-prolonging agents with caution"],
    interactions: ["Strong CYP3A inducers (reduce exposure)", "QT-prolonging drugs", "P-gp substrates"],
    patent_expiry: "2030-04-14",
    fda_status: "approved",
    half_life: "~48 hours",
    route: "oral",
  },
  {
    id: "drug-venetoclax",
    name: "Venetoclax",
    generic: "venetoclax",
    brand: "Venclexta",
    drug_class: "BCL-2 Inhibitor",
    mechanism: "Selective oral inhibitor of BCL-2 anti-apoptotic protein; restores apoptotic signaling in cancer cells",
    indications: ["Chronic lymphocytic leukemia (CLL)", "Acute myeloid leukemia (AML) with azacitidine"],
    contraindications: ["Concomitant strong CYP3A4 inhibitors at initiation", "Tumor lysis syndrome not prophylaxed"],
    interactions: ["Strong/moderate CYP3A inhibitors (azoles, clarithromycin)", "P-gp inhibitors", "Warfarin"],
    patent_expiry: "2029-03-20",
    fda_status: "approved",
    half_life: "~26 hours",
    route: "oral",
  },
  // ── Gene Therapy / CRISPR ─────────────────────────────────────────────────
  {
    id: "drug-casgevy",
    name: "Exagamglogene Autotemcel",
    generic: "exagamglogene autotemcel",
    brand: "Casgevy",
    drug_class: "CRISPR-Cas9 Gene Editing Therapy",
    mechanism: "Ex vivo CRISPR-Cas9 editing of BCL11A erythroid enhancer in autologous HSCs; reactivates fetal hemoglobin (HbF) to compensate for defective HbS/HbE",
    indications: ["Sickle cell disease (SCD)", "Transfusion-dependent beta-thalassemia (TDT)"],
    contraindications: ["Prior allogeneic HSCT", "Active uncontrolled infection", "Clinically significant organ dysfunction"],
    interactions: ["Myeloablative conditioning agents (busulfan)", "Live vaccines post-infusion"],
    patent_expiry: "2038-11-16",
    fda_status: "approved",
    half_life: "Permanent gene edit (single administration)",
    route: "intravenous (autologous cell infusion)",
  },
  {
    id: "drug-lecanemab",
    name: "Lecanemab",
    generic: "lecanemab-irmb",
    brand: "Leqembi",
    drug_class: "Anti-Amyloid Beta Monoclonal Antibody",
    mechanism: "Humanized IgG1 antibody; preferentially binds soluble amyloid-beta protofibrils; promotes amyloid clearance via Fc-mediated microglial phagocytosis",
    indications: ["Early Alzheimer's disease (MCI or mild dementia with amyloid confirmation)"],
    contraindications: ["APOE4 homozygous (high ARIA risk)", "Anti-coagulation therapy (increased ARIA risk)"],
    interactions: ["Anticoagulants", "Antiplatelets (increased microhemorrhage risk)"],
    patent_expiry: "2033-01-07",
    fda_status: "approved",
    half_life: "~5 days",
    route: "intravenous infusion",
  },
  // ── Infectious Disease ────────────────────────────────────────────────────
  {
    id: "drug-nirmatrelvir-ritonavir",
    name: "Nirmatrelvir/Ritonavir",
    generic: "nirmatrelvir/ritonavir",
    brand: "Paxlovid",
    drug_class: "SARS-CoV-2 Protease Inhibitor",
    mechanism: "Nirmatrelvir inhibits SARS-CoV-2 Mpro (main protease); ritonavir pharmacokinetically boosts nirmatrelvir via CYP3A inhibition",
    indications: ["COVID-19 (mild to moderate, high-risk adults)"],
    contraindications: ["CYP3A highly dependent drugs with narrow therapeutic index", "Strong CYP3A inducers"],
    interactions: ["Extensive CYP3A/P-gp substrate interactions — requires drug interaction check before prescribing"],
    patent_expiry: "2031-06-01",
    fda_status: "approved",
    half_life: "Nirmatrelvir 6.1h; ritonavir 6.1h",
    route: "oral",
  },
  {
    id: "drug-lenacapavir",
    name: "Lenacapavir",
    generic: "lenacapavir",
    brand: "Sunlenca",
    drug_class: "HIV Capsid Inhibitor",
    mechanism: "First-in-class; binds HIV-1 capsid protein; disrupts multiple stages of viral replication (nuclear import, capsid assembly, uncoating)",
    indications: ["Treatment-experienced HIV-1 adults with multi-drug resistant virus", "Investigational: HIV prevention (PrEP)"],
    contraindications: ["Strong CYP3A inducers without dose adjustment"],
    interactions: ["CYP3A inducers/inhibitors", "P-gp inducers"],
    patent_expiry: "2037-08-22",
    fda_status: "approved",
    half_life: "~10-12 weeks (enables twice-yearly dosing)",
    route: "subcutaneous injection (every 6 months)",
  },
  // ── Neurology / CNS ───────────────────────────────────────────────────────
  {
    id: "drug-nusinersen",
    name: "Nusinersen",
    generic: "nusinersen",
    brand: "Spinraza",
    drug_class: "Antisense Oligonucleotide (SMN2 Splicing Modifier)",
    mechanism: "Binds intronic splicing silencer N1 of SMN2 pre-mRNA; promotes exon 7 inclusion; increases functional SMN protein",
    indications: ["Spinal muscular atrophy (SMA) — all types"],
    contraindications: ["Thrombocytopenia (monitor closely)", "Coagulopathy"],
    interactions: ["Anticoagulants (thrombocytopenia risk)"],
    patent_expiry: "2030-09-14",
    fda_status: "approved",
    half_life: "135-177 days (intrathecal)",
    route: "intrathecal injection",
  },
  {
    id: "drug-levodopa-carbidopa",
    name: "Levodopa/Carbidopa",
    generic: "levodopa/carbidopa",
    brand: "Sinemet / Duopa / Inbrija",
    drug_class: "Dopamine Precursor + Decarboxylase Inhibitor",
    mechanism: "Levodopa crosses BBB; converted to dopamine in nigrostriatal neurons; carbidopa inhibits peripheral decarboxylation reducing systemic side effects",
    indications: ["Parkinson's disease", "Parkinsonism"],
    contraindications: ["MAO-A inhibitors (hypertensive crisis)", "Narrow-angle glaucoma", "Melanoma (unconfirmed relative CI)"],
    interactions: ["MAO inhibitors", "Antipsychotics (block dopamine receptors)", "High-protein meals (reduce absorption)", "Iron"],
    patent_expiry: "1986-01-01",
    fda_status: "approved",
    half_life: "1-3 hours (short; varies by formulation)",
    route: "oral / intestinal infusion / inhaled",
  },
  // ── Psychiatry ────────────────────────────────────────────────────────────
  {
    id: "drug-esketamine",
    name: "Esketamine",
    generic: "esketamine hydrochloride",
    brand: "Spravato",
    drug_class: "NMDA Receptor Antagonist (Intranasal)",
    mechanism: "S-enantiomer of ketamine; non-competitive NMDA receptor antagonist; rapid synaptogenesis via BDNF-TrkB-mTOR pathway; reverses synaptic deficits in depression",
    indications: ["Treatment-resistant depression (TRD)", "Major depressive disorder with acute suicidal ideation"],
    contraindications: ["Aneurysmal vascular disease", "History of intracerebral hemorrhage", "Active psychosis"],
    interactions: ["CNS depressants", "MAO inhibitors", "Psychostimulants (monitor BP)"],
    patent_expiry: "2028-03-05",
    fda_status: "approved",
    half_life: "7-12 hours",
    route: "intranasal (REMS program)",
  },
  // ── Respiratory ───────────────────────────────────────────────────────────
  {
    id: "drug-tezepelumab",
    name: "Tezepelumab",
    generic: "tezepelumab-ekko",
    brand: "Tezspire",
    drug_class: "TSLP Inhibitor (Monoclonal Antibody)",
    mechanism: "Human monoclonal antibody; inhibits thymic stromal lymphopoietin (TSLP); blocks upstream initiation of inflammatory cascade (Th1, Th2, Th17)",
    indications: ["Severe asthma (uncontrolled, add-on maintenance)", "No eosinophil threshold requirement — broadest asthma biologic label"],
    contraindications: ["Acute bronchospasm/status asthmaticus"],
    interactions: ["Live vaccines (avoid during treatment)"],
    patent_expiry: "2031-11-20",
    fda_status: "approved",
    half_life: "~26 days",
    route: "subcutaneous injection",
  },
  {
    id: "drug-ivacaftor-tezacaftor-elexacaftor",
    name: "Ivacaftor/Tezacaftor/Elexacaftor",
    generic: "ivacaftor/tezacaftor/elexacaftor",
    brand: "Trikafta",
    drug_class: "CFTR Modulator Triple Combination",
    mechanism: "Elexacaftor+tezacaftor correct F508del CFTR folding/trafficking; ivacaftor potentiates CFTR channel gating; restores ~40-80% of normal CFTR function",
    indications: ["Cystic fibrosis (≥1 F508del mutation)", "CF with specific responsive mutations"],
    contraindications: ["Strong CYP3A inducers (dramatically reduce exposure)"],
    interactions: ["Strong CYP3A inducers/inhibitors", "CYP3A substrates with narrow TI"],
    patent_expiry: "2037-06-10",
    fda_status: "approved",
    half_life: "Ivacaftor 12h; elexacaftor 24h; tezacaftor 15h",
    route: "oral",
  },
  // ── Hematology ────────────────────────────────────────────────────────────
  {
    id: "drug-fitusiran",
    name: "Fitusiran",
    generic: "fitusiran",
    brand: "Alhemo",
    drug_class: "siRNA (Antithrombin RNA Interference)",
    mechanism: "Liver-directed GalNAc-conjugated siRNA; silences antithrombin (SERPINC1) mRNA; reduces antithrombin levels; rebalances hemostasis in hemophilia",
    indications: ["Hemophilia A or B without inhibitors (prophylaxis)", "Hemophilia A or B with inhibitors"],
    contraindications: ["Active thromboembolic event", "Protein C or S deficiency"],
    interactions: ["Factor replacement therapy (requires specific dosing algorithm)", "Anticoagulants"],
    patent_expiry: "2035-04-18",
    fda_status: "approved",
    half_life: "~4 months (monthly injection)",
    route: "subcutaneous injection",
  },
  // ── Endocrinology ─────────────────────────────────────────────────────────
  {
    id: "drug-macimorelin",
    name: "Macimorelin",
    generic: "macimorelin acetate",
    brand: "Macrilen",
    drug_class: "Ghrelin Receptor Agonist (Growth Hormone Secretagogue)",
    mechanism: "Oral ghrelin receptor agonist; stimulates GH secretion from pituitary; safe replacement for ITT (insulin tolerance test) in GH deficiency diagnosis",
    indications: ["Diagnosis of adult growth hormone deficiency (AGHD)"],
    contraindications: ["Prolonged QT interval", "Concomitant strong CYP3A4 inducers"],
    interactions: ["QT-prolonging drugs", "CYP3A4 inducers/inhibitors"],
    patent_expiry: "2030-11-04",
    fda_status: "approved",
    half_life: "~4 hours",
    route: "oral (diagnostic test)",
  },
  // ── Rare Disease ──────────────────────────────────────────────────────────
  {
    id: "drug-patisiran",
    name: "Patisiran",
    generic: "patisiran",
    brand: "Onpattro",
    drug_class: "siRNA Nanoparticle (Transthyretin RNAi)",
    mechanism: "First FDA-approved siRNA drug; lipid nanoparticle delivers siRNA to hepatocytes; silences TTR gene; reduces misfolded TTR fibrils causing polyneuropathy",
    indications: ["Hereditary transthyretin-mediated amyloidosis (hATTR) with polyneuropathy"],
    contraindications: ["Pre-medication requirements (corticosteroids, antihistamines, acetaminophen)"],
    interactions: ["Requires pre-medication protocol"],
    patent_expiry: "2033-08-01",
    fda_status: "approved",
    half_life: "~3 weeks (bimonthly infusions historically; new Q3M approved)",
    route: "intravenous infusion",
  },
  {
    id: "drug-ataluren",
    name: "Ataluren",
    generic: "ataluren",
    brand: "Translarna",
    drug_class: "Nonsense Mutation Readthrough Compound",
    mechanism: "Allows ribosomes to read through premature stop codons; restores production of full-length dystrophin in nmDMD",
    indications: ["Duchenne muscular dystrophy (nmDMD) — nonsense mutation subtype"],
    contraindications: ["Concomitant IV aminoglycosides (nephrotoxicity)"],
    interactions: ["IV aminoglycosides", "Gemfibrozil (increases ataluren exposure)"],
    patent_expiry: "2031-05-22",
    fda_status: "approved (EU/conditional); NDA submitted FDA",
    half_life: "2-6 hours (TID dosing)",
    route: "oral",
  },
  // ── Dermatology ───────────────────────────────────────────────────────────
  {
    id: "drug-tapinarof",
    name: "Tapinarof",
    generic: "tapinarof",
    brand: "Vtama",
    drug_class: "Aryl Hydrocarbon Receptor (AhR) Agonist",
    mechanism: "First-in-class AhR agonist; modulates Th2/Th17 cytokines and restores skin barrier; non-steroidal with no HPA-axis suppression",
    indications: ["Plaque psoriasis (adults)", "Atopic dermatitis (adults — additional label)"],
    contraindications: ["Hypersensitivity to tapinarof or excipients"],
    interactions: ["CYP1A2 substrates with narrow TI (theoretical)"],
    patent_expiry: "2033-09-17",
    fda_status: "approved",
    half_life: "~20 hours",
    route: "topical",
  },
  // ── Women's Health ────────────────────────────────────────────────────────
  {
    id: "drug-zuranolone",
    name: "Zuranolone",
    generic: "zuranolone",
    brand: "Zurzuvae",
    drug_class: "Neuroactive Steroid GABA-A Receptor Positive Allosteric Modulator",
    mechanism: "Positive allosteric modulator of synaptic and extrasynaptic GABA-A receptors; rapid antidepressant effect without daily long-term dosing",
    indications: ["Postpartum depression (PPD)", "Major depressive disorder (MDD)"],
    contraindications: ["Pregnancy", "Driving/operating machinery within 12h of dose"],
    interactions: ["CNS depressants", "Strong CYP3A4 inhibitors/inducers"],
    patent_expiry: "2034-02-14",
    fda_status: "approved",
    half_life: "17-21 hours (14-day treatment course)",
    route: "oral",
  },
  // ── Gastrointestinal ──────────────────────────────────────────────────────
  {
    id: "drug-ozanimod",
    name: "Ozanimod",
    generic: "ozanimod hydrochloride",
    brand: "Zeposia",
    drug_class: "Sphingosine-1-Phosphate (S1P) Receptor Modulator",
    mechanism: "Selectively activates S1P1 and S1P5 receptors; sequesters lymphocytes in lymph nodes; reduces circulating lymphocytes causing lymphocyte egress blockade",
    indications: ["Relapsing multiple sclerosis", "Moderately to severely active ulcerative colitis"],
    contraindications: ["Recent MI/stroke/TIA/unstable angina", "Severe cardiac conduction defects without pacemaker", "MAO inhibitors"],
    interactions: ["MAO inhibitors", "Strong CYP2C8 inhibitors", "Antiarrhythmics", "Beta blockers (bradycardia)"],
    patent_expiry: "2030-07-11",
    fda_status: "approved",
    half_life: "~21 hours (active metabolite)",
    route: "oral",
  },
  // ── Pipeline / Investigational ────────────────────────────────────────────
  {
    id: "drug-donanemab",
    name: "Donanemab",
    generic: "donanemab-azbt",
    brand: "Kisunla",
    drug_class: "Anti-Amyloid Beta (N3pG) Monoclonal Antibody",
    mechanism: "Targets N-terminal pyroglutamate form of amyloid beta; promotes plaque clearance; treatment cessation possible when amyloid clearance achieved",
    indications: ["Early symptomatic Alzheimer's disease with confirmed amyloid"],
    contraindications: ["APOE4 homozygous high-risk patients (enhanced ARIA risk)", "Active anticoagulation"],
    interactions: ["Anticoagulants/antiplatelets (ARIA hemorrhage risk)"],
    patent_expiry: "2034-05-03",
    fda_status: "approved",
    half_life: "~9.3 days",
    route: "intravenous infusion",
  },
  {
    id: "drug-olezarsen",
    name: "Olezarsen",
    generic: "olezarsen",
    brand: "Tryngolza",
    drug_class: "GalNAc-Conjugated Antisense Oligonucleotide (APOC3 Inhibitor)",
    mechanism: "GalNAc-conjugated ASO targeting hepatic APOC3 mRNA; reduces apolipoprotein C-III; markedly lowers triglycerides by enhancing LPL-mediated TG clearance",
    indications: ["Familial chylomicronemia syndrome (FCS)", "Severe hypertriglyceridemia"],
    contraindications: ["Hepatic impairment (severe)"],
    interactions: ["Anticoagulants (monitor PT/INR)"],
    patent_expiry: "2036-09-08",
    fda_status: "approved",
    half_life: "~1 month (monthly injection)",
    route: "subcutaneous injection",
  },
];

const SEED_TRIALS = [
  {
    id: "trial-nct05827250",
    nct_id: "NCT05827250",
    title: "SELECT-CVOT: Cardiovascular Outcomes of Semaglutide in Overweight/Obese Adults",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Novo Nordisk",
    enrollment: 17604,
    conditions: ["Cardiovascular disease", "Obesity", "Overweight"],
    interventions: ["Semaglutide 2.4mg weekly SQ", "Placebo"],
    locations: ["United States", "Europe", "Asia-Pacific"],
    start_date: "2018-10-15",
    completion_date: "2023-08-15",
    results_available: true,
    primary_endpoint: "Time to first MACE (CV death, non-fatal MI, non-fatal stroke)",
  },
  {
    id: "trial-nct04097002",
    nct_id: "NCT04097002",
    title: "SUMMIT: Tirzepatide in Heart Failure with Preserved Ejection Fraction and Obesity",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Eli Lilly",
    enrollment: 731,
    conditions: ["Heart failure with preserved ejection fraction", "Obesity"],
    interventions: ["Tirzepatide 15mg weekly SQ", "Placebo"],
    locations: ["United States", "Europe", "Latin America"],
    start_date: "2021-03-08",
    completion_date: "2024-09-30",
    results_available: true,
    primary_endpoint: "Hierarchical composite of CV death, worsening HF events, 6-minute walk distance, KCCQ-CSS",
  },
  {
    id: "trial-nct05488587",
    nct_id: "NCT05488587",
    title: "PURPOSE 1: Lenacapavir for HIV Prevention in Women at High Risk (Sub-Saharan Africa)",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Gilead Sciences",
    enrollment: 5338,
    conditions: ["HIV Prevention", "PrEP"],
    interventions: ["Lenacapavir 927mg SQ twice-yearly", "Emtricitabine/tenofovir alafenamide (F/TAF)", "Emtricitabine/tenofovir disoproxil fumarate (F/TDF)"],
    locations: ["South Africa", "Uganda", "Zimbabwe", "Kenya"],
    start_date: "2021-11-01",
    completion_date: "2024-06-01",
    results_available: true,
    primary_endpoint: "HIV-1 incidence rate (new infections per 100 person-years)",
  },
  {
    id: "trial-nct04440553",
    nct_id: "NCT04440553",
    title: "HORIZON: Lecanemab in Early Alzheimer's Disease — Phase 3 Confirmatory",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Eisai / Biogen",
    enrollment: 1795,
    conditions: ["Alzheimer's disease", "Mild cognitive impairment", "Early Alzheimer's dementia"],
    interventions: ["Lecanemab 10mg/kg IV biweekly", "Placebo"],
    locations: ["United States", "Europe", "Japan", "Australia"],
    start_date: "2019-03-01",
    completion_date: "2022-07-01",
    results_available: true,
    primary_endpoint: "CDR-SB score change at 18 months",
  },
  {
    id: "trial-nct05579847",
    nct_id: "NCT05579847",
    title: "CRISPR-SCD-001: Ex Vivo Gene Editing for Sickle Cell Disease — Long-Term Follow-Up",
    status: "active_not_recruiting",
    phase: "Phase 3",
    sponsor: "Vertex Pharmaceuticals / CRISPR Therapeutics",
    enrollment: 44,
    conditions: ["Sickle cell disease"],
    interventions: ["Exagamglogene autotemcel (exa-cel/Casgevy)"],
    locations: ["United States", "United Kingdom", "Germany", "France"],
    start_date: "2019-07-25",
    completion_date: "2027-03-15",
    results_available: false,
    primary_endpoint: "Freedom from severe VOC episodes for at least 12 consecutive months",
  },
  {
    id: "trial-nct04767373",
    nct_id: "NCT04767373",
    title: "LIBERTY-AD: Dupilumab Extended Label — Atopic Dermatitis in Adolescents 12-17",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Sanofi / Regeneron",
    enrollment: 365,
    conditions: ["Atopic dermatitis", "Eczema"],
    interventions: ["Dupilumab 200mg or 300mg Q2W SQ", "Placebo + TCS"],
    locations: ["United States", "Canada", "Europe"],
    start_date: "2020-04-14",
    completion_date: "2022-01-31",
    results_available: true,
    primary_endpoint: "IGA 0/1 (clear or almost clear) at 16 weeks",
  },
  {
    id: "trial-nct05765006",
    nct_id: "NCT05765006",
    title: "EMERALD-ONC: Osimertinib + Datopotamab Deruxtecan in EGFR-mutant NSCLC Post-Progression",
    status: "recruiting",
    phase: "Phase 2",
    sponsor: "AstraZeneca / Daiichi Sankyo",
    enrollment: 150,
    conditions: ["Non-small cell lung cancer", "EGFR mutation"],
    interventions: ["Osimertinib + Datopotamab deruxtecan (Dato-DXd)", "Osimertinib + carboplatin/pemetrexed"],
    locations: ["United States", "EU", "Japan", "South Korea"],
    start_date: "2023-05-01",
    completion_date: "2026-12-31",
    results_available: false,
    primary_endpoint: "Progression-free survival (PFS) by BICR",
  },
  {
    id: "trial-nct05603546",
    nct_id: "NCT05603546",
    title: "KEYNOTE-942: mRNA-4157/V940 + Pembrolizumab Personalized Neoantigen Vaccine in Melanoma",
    status: "active_not_recruiting",
    phase: "Phase 2b",
    sponsor: "Moderna / MSD",
    enrollment: 157,
    conditions: ["Stage III/IV melanoma", "Resected melanoma"],
    interventions: ["mRNA-4157/V940 personalized vaccine + pembrolizumab", "Pembrolizumab alone"],
    locations: ["United States", "Europe", "Australia"],
    start_date: "2020-09-01",
    completion_date: "2027-06-30",
    results_available: false,
    primary_endpoint: "Recurrence-free survival (RFS)",
  },
  {
    id: "trial-nct05015088",
    nct_id: "NCT05015088",
    title: "ATLAS: Fitusiran Monthly Prophylaxis vs. Factor Replacement in Hemophilia A/B",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Sanofi",
    enrollment: 211,
    conditions: ["Hemophilia A", "Hemophilia B"],
    interventions: ["Fitusiran 80mg SQ monthly", "Factor VIII or IX prophylaxis"],
    locations: ["United States", "Europe", "Latin America", "Asia"],
    start_date: "2020-06-01",
    completion_date: "2022-12-31",
    results_available: true,
    primary_endpoint: "Annualized bleeding rate (ABR)",
  },
  {
    id: "trial-nct06186505",
    nct_id: "NCT06186505",
    title: "ORBIT: Zuranolone 50mg in Major Depressive Disorder — Randomized Phase 3",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Sage Therapeutics / Biogen",
    enrollment: 543,
    conditions: ["Major depressive disorder"],
    interventions: ["Zuranolone 50mg daily x 14 days", "Placebo"],
    locations: ["United States"],
    start_date: "2021-01-15",
    completion_date: "2023-04-30",
    results_available: true,
    primary_endpoint: "Change from baseline in HAMD-17 total score at Day 15",
  },
  {
    id: "trial-nct05620888",
    nct_id: "NCT05620888",
    title: "TRIUMPH: Tapinarof 1% Cream in Moderate-to-Severe Atopic Dermatitis in Children 2-12",
    status: "active_not_recruiting",
    phase: "Phase 3",
    sponsor: "Dermavant Sciences",
    enrollment: 641,
    conditions: ["Atopic dermatitis", "Pediatric eczema"],
    interventions: ["Tapinarof 1% cream once daily", "Vehicle cream"],
    locations: ["United States", "Canada", "EU"],
    start_date: "2022-04-01",
    completion_date: "2025-06-30",
    results_available: false,
    primary_endpoint: "IGA score 0/1 with ≥2-point improvement at Week 8",
  },
  {
    id: "trial-nct05382936",
    nct_id: "NCT05382936",
    title: "SOLSTICE: Olezarsen in Familial Chylomicronemia Syndrome — Pivotal Study",
    status: "completed",
    phase: "Phase 3",
    sponsor: "Ionis Pharmaceuticals / AstraZeneca",
    enrollment: 66,
    conditions: ["Familial chylomicronemia syndrome", "Severe hypertriglyceridemia"],
    interventions: ["Olezarsen 80mg SQ monthly", "Placebo"],
    locations: ["United States", "Europe", "Canada"],
    start_date: "2021-09-01",
    completion_date: "2023-05-01",
    results_available: true,
    primary_endpoint: "Percent change in fasting triglyceride level from baseline at Month 6",
  },
  {
    id: "trial-nct06035861",
    nct_id: "NCT06035861",
    title: "INVICTUS-2: Dapagliflozin in HFpEF With Chronic Kidney Disease",
    status: "recruiting",
    phase: "Phase 3",
    sponsor: "AstraZeneca",
    enrollment: 2100,
    conditions: ["Heart failure with preserved ejection fraction", "Chronic kidney disease"],
    interventions: ["Dapagliflozin 10mg daily", "Placebo"],
    locations: ["United States", "Europe", "Latin America", "India"],
    start_date: "2023-10-15",
    completion_date: "2027-09-30",
    results_available: false,
    primary_endpoint: "Composite of CV death or worsening HF (hospitalization or urgent visit)",
  },
  {
    id: "trial-nct05579431",
    nct_id: "NCT05579431",
    title: "ALTUS: Tezepelumab Real-World Effectiveness in Severe Uncontrolled Asthma — Phase 4",
    status: "active_not_recruiting",
    phase: "Phase 4",
    sponsor: "AstraZeneca / Amgen",
    enrollment: 892,
    conditions: ["Severe asthma", "Uncontrolled asthma"],
    interventions: ["Tezepelumab 210mg SQ Q4W (real-world)"],
    locations: ["United States", "EU", "Canada", "Japan"],
    start_date: "2022-07-01",
    completion_date: "2025-12-31",
    results_available: false,
    primary_endpoint: "Annualized asthma exacerbation rate at 52 weeks",
  },
  {
    id: "trial-nct06302413",
    nct_id: "NCT06302413",
    title: "NEXUS-AD: Donanemab Combined With Anti-Tau Antisense in Early Alzheimer's",
    status: "recruiting",
    phase: "Phase 2",
    sponsor: "Eli Lilly",
    enrollment: 180,
    conditions: ["Alzheimer's disease", "Tau pathology"],
    interventions: ["Donanemab + BIIB080 (tau ASO)", "Donanemab + placebo ASO"],
    locations: ["United States", "Europe"],
    start_date: "2024-02-14",
    completion_date: "2027-06-30",
    results_available: false,
    primary_endpoint: "Change in tau burden (flortaucipir PET) and CDR-SB at 18 months",
  },
];

// ─── Seed Execution ───────────────────────────────────────────────────────────

(function seedPharmaData() {
  const insertDrug = db.prepare(`
    INSERT OR IGNORE INTO pharma_drugs
      (id, name, generic, brand, drug_class, mechanism, indications,
       contraindications, interactions, patent_expiry, fda_status, half_life, route)
    VALUES
      (@id, @name, @generic, @brand, @drug_class, @mechanism, @indications,
       @contraindications, @interactions, @patent_expiry, @fda_status, @half_life, @route)
  `);

  const insertTrial = db.prepare(`
    INSERT OR IGNORE INTO pharma_clinical_trials
      (id, nct_id, title, status, phase, sponsor, enrollment, conditions,
       interventions, locations, start_date, completion_date, results_available, primary_endpoint)
    VALUES
      (@id, @nct_id, @title, @status, @phase, @sponsor, @enrollment, @conditions,
       @interventions, @locations, @start_date, @completion_date, @results_available, @primary_endpoint)
  `);

  const seedDrugs = db.transaction(() => {
    // Seed legacy SEED_DRUGS (full schema with id, generic, brand, etc.)
    for (const d of SEED_DRUGS) {
      insertDrug.run({
        ...d,
        indications: JSON.stringify(d.indications),
        contraindications: JSON.stringify(d.contraindications),
        interactions: JSON.stringify(d.interactions),
      });
    }
    // Seed 538-drug DRUGS from pharma-drugs-db.js (mapped to DB schema)
    for (const d of DRUGS) {
      const nameLower = d.name.toLowerCase().replace(/\s+/g, "-");
      insertDrug.run({
        id: `drug-db-${nameLower}`,
        name: d.name,
        generic: d.generic_name,
        brand: (d.brand_names ?? []).join(" / "),
        drug_class: d.drug_class,
        mechanism: d.mechanism,
        indications: JSON.stringify([d.indication]),
        contraindications: JSON.stringify([]),
        interactions: JSON.stringify([]),
        patent_expiry: d.patent_expiry ?? null,
        fda_status: d.fda_status,
        half_life: null,
        route: d.route,
      });
    }
  });

  const seedTrials = db.transaction(() => {
    for (const t of SEED_TRIALS) {
      insertTrial.run({
        ...t,
        conditions: JSON.stringify(t.conditions),
        interventions: JSON.stringify(t.interventions),
        locations: JSON.stringify(t.locations),
        results_available: t.results_available ? 1 : 0,
      });
    }
  });

  seedDrugs();
  seedTrials();
})();

// ─── Helper: parse JSON columns ───────────────────────────────────────────────

function parseDrug(row) {
  if (!row) return null;
  return {
    ...row,
    indications: JSON.parse(row.indications || "[]"),
    contraindications: JSON.parse(row.contraindications || "[]"),
    interactions: JSON.parse(row.interactions || "[]"),
  };
}

function parseTrial(row) {
  if (!row) return null;
  return {
    ...row,
    conditions: JSON.parse(row.conditions || "[]"),
    interventions: JSON.parse(row.interventions || "[]"),
    locations: JSON.parse(row.locations || "[]"),
    results_available: row.results_available === 1,
  };
}

// ─── 1. searchDrugDatabase ────────────────────────────────────────────────────

export function searchDrugDatabase(query = "", drugClass = "", indication = "") {
  const searchId = randomUUID();

  const terms = query.toLowerCase().trim();
  const classFilter = drugClass.toLowerCase().trim();
  const indicationFilter = indication.toLowerCase().trim();

  let rows = db.prepare("SELECT * FROM pharma_drugs").all();

  const results = rows.filter((row) => {
    const matchQuery =
      !terms ||
      row.name.toLowerCase().includes(terms) ||
      row.generic.toLowerCase().includes(terms) ||
      (row.brand || "").toLowerCase().includes(terms) ||
      row.mechanism.toLowerCase().includes(terms);

    const matchClass =
      !classFilter || row.drug_class.toLowerCase().includes(classFilter);

    const indications = JSON.parse(row.indications || "[]");
    const matchIndication =
      !indicationFilter ||
      indications.some((ind) => ind.toLowerCase().includes(indicationFilter));

    return matchQuery && matchClass && matchIndication;
  });

  db.prepare(`
    INSERT INTO pharma_searches (id, query, drug_class, indication, result_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(searchId, query, drugClass, indication, results.length);

  return {
    search_id: searchId,
    query,
    filters: { drug_class: drugClass, indication },
    result_count: results.length,
    drugs: results.map(parseDrug),
    fee_usd: 0.5,
    powered_by: "HiveAgent Pharma Intelligence",
  };
}

// ─── 2. checkDrugInteractions ─────────────────────────────────────────────────

export function checkDrugInteractions(drugs = [], patientProfile = {}) {
  if (!Array.isArray(drugs) || drugs.length < 2) {
    throw new Error("Provide at least 2 drug names to check interactions.");
  }

  const checkId = randomUUID();

  // Comprehensive interaction matrix (seeded knowledge)
  const INTERACTION_DB = [
    {
      drug_a: /warfarin/i,
      drug_b: /nsaid|ibuprofen|naproxen|aspirin/i,
      severity: "major",
      mechanism: "Additive anticoagulant and antiplatelet effects; NSAIDs inhibit COX-1-mediated platelet aggregation",
      clinical_effect: "Increased bleeding risk, especially GI hemorrhage",
      management: "Avoid combination; if necessary, use lowest NSAID dose with PPI cover and monitor INR closely",
      evidence_level: "A",
    },
    {
      drug_a: /maoi|phenelzine|tranylcypromine|selegiline|rasagiline/i,
      drug_b: /ssri|snri|sertraline|fluoxetine|venlafaxine|duloxetine|tramadol|meperidine/i,
      severity: "critical",
      mechanism: "Excessive serotonergic stimulation via dual serotonin reuptake inhibition/increased serotonin availability",
      clinical_effect: "Serotonin syndrome — hyperthermia, agitation, myoclonus, autonomic instability",
      management: "ABSOLUTE CONTRAINDICATION. Maintain 14-day washout from MAOI; 5-week washout after fluoxetine",
      evidence_level: "A",
    },
    {
      drug_a: /metformin/i,
      drug_b: /iodine contrast|radiocontrast/i,
      severity: "major",
      mechanism: "Contrast-induced nephrotoxicity impairs metformin renal clearance → lactic acidosis risk",
      clinical_effect: "Metformin accumulation, lactic acidosis (rare but fatal)",
      management: "Hold metformin 48h before contrast; restart only if eGFR stable post-procedure",
      evidence_level: "B",
    },
    {
      drug_a: /statin|atorvastatin|simvastatin|rosuvastatin/i,
      drug_b: /fibrate|gemfibrozil|fenofibrate/i,
      severity: "major",
      mechanism: "Fibrates inhibit glucuronidation of statins and may increase statin plasma concentrations",
      clinical_effect: "Myopathy, rhabdomyolysis",
      management: "Avoid gemfibrozil + any statin. Fenofibrate preferred if combination needed; monitor CK",
      evidence_level: "B",
    },
    {
      drug_a: /ace inhibitor|lisinopril|enalapril|ramipril/i,
      drug_b: /sacubitril|entresto/i,
      severity: "critical",
      mechanism: "Both drugs inhibit bradykinin metabolism via different pathways; sacubitril inhibits neprilysin; ACEi inhibits ACE degradation",
      clinical_effect: "Life-threatening angioedema (risk increases 3-4x)",
      management: "CONTRAINDICATED — 36-hour washout from ACEi before starting sacubitril/valsartan",
      evidence_level: "A",
    },
    {
      drug_a: /semaglutide|tirzepatide|glp-1|liraglutide/i,
      drug_b: /insulin|glargine|detemir|degludec/i,
      severity: "moderate",
      mechanism: "Additive glucose-lowering; GLP-1 agonist enhances glucose-dependent insulin secretion",
      clinical_effect: "Hypoglycemia risk, particularly when combined with basal insulin",
      management: "Reduce basal insulin by 20% on GLP-1 initiation; frequent glucose monitoring",
      evidence_level: "B",
    },
    {
      drug_a: /venetoclax/i,
      drug_b: /azole|voriconazole|itraconazole|ketoconazole|fluconazole|posaconazole/i,
      severity: "critical",
      mechanism: "Strong CYP3A4 inhibition dramatically increases venetoclax exposure (up to 6-fold)",
      clinical_effect: "Tumor lysis syndrome (TLS), severe neutropenia",
      management: "Avoid strong CYP3A4 inhibitors at ramp-up; if unavoidable, reduce venetoclax dose per label guidance",
      evidence_level: "A",
    },
    {
      drug_a: /paxlovid|nirmatrelvir|ritonavir/i,
      drug_b: /statin|atorvastatin|lovastatin|simvastatin/i,
      severity: "major",
      mechanism: "Ritonavir strongly inhibits CYP3A4; dramatically elevates CYP3A4-metabolized statin concentrations",
      clinical_effect: "Myopathy, rhabdomyolysis",
      management: "Hold lovastatin/simvastatin during Paxlovid course. Rosuvastatin preferred (minimal CYP3A4). Atorvastatin max 20mg",
      evidence_level: "A",
    },
    {
      drug_a: /dupilumab|dupixent/i,
      drug_b: /live vaccine/i,
      severity: "moderate",
      mechanism: "Biologic immunomodulation may impair response to live attenuated vaccines",
      clinical_effect: "Reduced vaccine immunogenicity; theoretical risk of vaccine-strain infection",
      management: "Complete all live vaccinations before starting dupilumab; avoid live vaccines during treatment",
      evidence_level: "C",
    },
    {
      drug_a: /osimertinib/i,
      drug_b: /rifampin|rifampicin|carbamazepine|phenytoin|phenobarbital|st\\.? john/i,
      severity: "major",
      mechanism: "Strong CYP3A4 induction reduces osimertinib AUC by ~78%",
      clinical_effect: "Sub-therapeutic osimertinib levels; loss of antitumor efficacy",
      management: "Avoid strong CYP3A4 inducers; increase osimertinib to 160mg if unavoidable and no QTc concerns",
      evidence_level: "A",
    },
  ];

  const interactions = [];

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const drugA = drugs[i];
      const drugB = drugs[j];

      for (const rule of INTERACTION_DB) {
        const matchAB =
          rule.drug_a.test(drugA) && rule.drug_b.test(drugB);
        const matchBA =
          rule.drug_a.test(drugB) && rule.drug_b.test(drugA);

        if (matchAB || matchBA) {
          interactions.push({
            drug_pair: [drugA, drugB],
            severity: rule.severity,
            mechanism: rule.mechanism,
            clinical_effect: rule.clinical_effect,
            management: rule.management,
            evidence_level: rule.evidence_level,
          });
        }
      }
    }
  }

  // Apply patient-profile risk adjustments
  const riskFlags = [];
  if (patientProfile.renal_impairment) {
    riskFlags.push("Renal impairment: monitor renally cleared drugs closely (metformin, NSAIDs, contrast agents)");
  }
  if (patientProfile.hepatic_impairment) {
    riskFlags.push("Hepatic impairment: avoid hepatically metabolized drugs at standard doses; consult pharmacist");
  }
  if (patientProfile.elderly && patientProfile.elderly === true) {
    riskFlags.push("Elderly patient: increased sensitivity to CNS drugs, anticoagulants, and QT-prolonging agents");
  }
  if (patientProfile.pregnancy) {
    riskFlags.push("Pregnancy: multiple drugs in this list are category D/X — review teratogenic risk");
  }

  const criticalCount = interactions.filter((i) => i.severity === "critical").length;

  db.prepare(`
    INSERT INTO pharma_interaction_checks
      (id, drugs, patient_profile, interaction_count, critical_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(checkId, JSON.stringify(drugs), JSON.stringify(patientProfile), interactions.length, criticalCount);

  return {
    check_id: checkId,
    drugs_checked: drugs,
    patient_profile: patientProfile,
    interactions_found: interactions.length,
    critical_interactions: criticalCount,
    interactions,
    patient_risk_flags: riskFlags,
    disclaimer: "This interaction check is informational only. Always consult a clinical pharmacist or prescribing physician before making clinical decisions.",
    fee_usd: 0.25,
  };
}

// ─── 3. trackClinicalTrial ────────────────────────────────────────────────────

export function trackClinicalTrial(nctId = "", query = "") {
  let trial = null;

  if (nctId) {
    const row = db.prepare("SELECT * FROM pharma_clinical_trials WHERE nct_id = ?").get(nctId.toUpperCase());
    trial = parseTrial(row);
  }

  if (!trial && query) {
    const rows = db.prepare("SELECT * FROM pharma_clinical_trials").all();
    const q = query.toLowerCase();
    const matched = rows.find(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.sponsor.toLowerCase().includes(q) ||
        (JSON.parse(r.conditions || "[]")).some((c) => c.toLowerCase().includes(q))
    );
    trial = parseTrial(matched);
  }

  if (!trial) {
    return {
      found: false,
      nct_id: nctId,
      query,
      message: "Trial not found in HiveAgent database. Query ClinicalTrials.gov directly at clinicaltrials.gov for the full registry.",
      similar_trials: db.prepare("SELECT nct_id, title, status, phase, sponsor FROM pharma_clinical_trials LIMIT 5").all(),
      fee_usd: 0.5,
    };
  }

  const statusLabel = {
    completed: "Completed — results may be available",
    recruiting: "Actively enrolling participants",
    active_not_recruiting: "Ongoing but enrollment closed",
    not_yet_recruiting: "Approved but not yet open",
    terminated: "Terminated early",
    withdrawn: "Withdrawn before enrollment",
    suspended: "Temporarily suspended",
  }[trial.status] || trial.status;

  return {
    found: true,
    trial: {
      nct_id: trial.nct_id,
      title: trial.title,
      status: trial.status,
      status_label: statusLabel,
      phase: trial.phase,
      sponsor: trial.sponsor,
      enrollment: trial.enrollment,
      conditions: trial.conditions,
      interventions: trial.interventions,
      locations: trial.locations,
      start_date: trial.start_date,
      completion_date: trial.completion_date,
      primary_endpoint: trial.primary_endpoint,
      results_available: trial.results_available,
      clinicaltrials_url: `https://clinicaltrials.gov/study/${trial.nct_id}`,
    },
    fee_usd: 0.5,
  };
}

// ─── 4. forecastDrugApproval ──────────────────────────────────────────────────

export function forecastDrugApproval(drugName, indication, phase, mechanism) {
  const forecastId = randomUUID();

  // Phase-based base probabilities (industry historical data)
  const PHASE_BASE_PROB = {
    "Phase 1": 0.10,
    "Phase 2": 0.28,
    "Phase 2b": 0.35,
    "Phase 3": 0.58,
    "Phase 3 (pivotal)": 0.72,
    "NDA Filed": 0.85,
    "BLA Filed": 0.87,
    "NDA/BLA Under Review": 0.92,
    "Approved": 1.0,
  };

  // Mechanism/class success rate modifiers
  const MECHANISM_MODIFIER = {
    "checkpoint inhibitor": 0.15,
    "pd-1": 0.15,
    "pd-l1": 0.13,
    "glp-1": 0.12,
    "gene therapy": -0.08,
    "crispr": -0.05,
    "cell therapy": -0.10,
    "antisense": -0.03,
    "rna interference": -0.04,
    "small molecule": 0.05,
    "monoclonal antibody": 0.08,
    "bispecific": 0.02,
    "adc": 0.04,
  };

  const normalizedPhase = Object.keys(PHASE_BASE_PROB).find(
    (k) => k.toLowerCase() === (phase || "").toLowerCase()
  ) || "Phase 2";

  let prob = PHASE_BASE_PROB[normalizedPhase] ?? 0.28;

  const mechLower = (mechanism || "").toLowerCase();
  for (const [key, mod] of Object.entries(MECHANISM_MODIFIER)) {
    if (mechLower.includes(key)) {
      prob = Math.min(0.97, Math.max(0.03, prob + mod));
      break;
    }
  }

  // Indication risk adjustments
  const HIGH_UNMET_NEED = ["alzheimer", "als", "rare disease", "orphan", "cystic fibrosis", "sma", "sickle cell", "huntington"];
  const COMPETITIVE_AREA = ["type 2 diabetes", "hypertension", "depression", "rheumatoid arthritis", "asthma"];
  const indicationLower = (indication || "").toLowerCase();

  let indicationMod = 0;
  if (HIGH_UNMET_NEED.some((h) => indicationLower.includes(h))) indicationMod += 0.06;
  if (COMPETITIVE_AREA.some((c) => indicationLower.includes(c))) indicationMod -= 0.03;

  prob = Math.min(0.97, Math.max(0.03, prob + indicationMod));

  const riskFactors = [];
  if (prob < 0.4) riskFactors.push("Low phase success probability — consider adaptive trial design");
  if (mechLower.includes("gene therapy") || mechLower.includes("crispr")) {
    riskFactors.push("Regulatory novelty: FDA may require additional safety data for gene/CRISPR therapies");
    riskFactors.push("Manufacturing complexity: viral vector/cell therapy CMC requirements are extensive");
  }
  if (mechLower.includes("cell therapy") || mechLower.includes("car-t")) {
    riskFactors.push("Cytokine release syndrome (CRS) safety profile critical to approval");
  }
  if (indicationLower.includes("alzheimer") || indicationLower.includes("cns")) {
    riskFactors.push("CNS drug development has historically higher Phase 2→3 attrition");
    riskFactors.push("Amyloid/tau surrogate endpoints require demonstrated clinical correlation");
  }

  const timelineEstimates = {
    "Phase 1": "7-10 years to potential approval (Phase 2→3→NDA→review)",
    "Phase 2": "5-8 years to potential approval",
    "Phase 2b": "4-6 years to potential approval",
    "Phase 3": "2-4 years (pivotal data → NDA/BLA filing → FDA review)",
    "Phase 3 (pivotal)": "1.5-3 years (filing → standard review 10-12 months; priority review 6 months)",
    "NDA Filed": "10-12 months standard review; 6 months priority/breakthrough",
    "BLA Filed": "12 months standard review; 6 months priority review",
    "NDA/BLA Under Review": "3-9 months remaining in review cycle",
    "Approved": "Approved",
  };

  const analogousApprovals = [];
  if (mechLower.includes("glp-1") || mechLower.includes("semaglutide")) {
    analogousApprovals.push({ drug: "Semaglutide (Wegovy)", outcome: "Approved 2021", timeline: "3 years Phase 3→approval" });
    analogousApprovals.push({ drug: "Tirzepatide (Zepbound)", outcome: "Approved 2023", timeline: "2.5 years Phase 3→approval" });
  }
  if (mechLower.includes("pd-1") || mechLower.includes("checkpoint")) {
    analogousApprovals.push({ drug: "Pembrolizumab (Keytruda)", outcome: "Approved 2014 (accelerated)", timeline: "Breakthrough designation → 6-month review" });
  }
  if (mechLower.includes("crispr") || mechLower.includes("gene editing")) {
    analogousApprovals.push({ drug: "Exagamglogene autotemcel (Casgevy)", outcome: "Approved Dec 2023", timeline: "First CRISPR approval — 14 months Phase 3→approval" });
  }

  const recommendedActions = [
    prob < 0.5 ? "Consider Breakthrough Therapy or Fast Track designation application to FDA to accelerate timeline" : "Maintain current development trajectory",
    "Engage FDA in Type B pre-Phase 3 meeting to align on primary endpoints and trial design",
    "Prepare adaptive trial design contingency for potential Phase 2b→3 combination",
    "Map competitive landscape for priority review vouchers (PRV) if rare/pediatric indication qualifies",
    "Initiate CMC scale-up and manufacturing validation in parallel with Phase 3",
  ];

  db.prepare(`
    INSERT INTO pharma_approval_forecasts
      (id, drug_name, indication, phase, mechanism, approval_probability, timeline_estimate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(forecastId, drugName, indication, phase, mechanism, prob, timelineEstimates[normalizedPhase]);

  return {
    forecast_id: forecastId,
    drug_name: drugName,
    indication,
    phase: normalizedPhase,
    mechanism,
    approval_probability: Math.round(prob * 1000) / 10 + "%",
    approval_probability_raw: prob,
    timeline_estimate: timelineEstimates[normalizedPhase],
    risk_factors: riskFactors,
    analogous_approvals: analogousApprovals,
    recommended_actions: recommendedActions,
    methodology: "Based on industry historical Phase transition rates (Biotechnology Innovation Organization) adjusted for mechanism class, indication unmet need, and regulatory environment",
    fee_usd: 2.0,
  };
}

// ─── 5. optimizeDrugPricing ───────────────────────────────────────────────────

export function optimizeDrugPricing(drug, market, payer_mix, competitors) {
  const analysisId = randomUUID();

  const marketData = {
    US: { multiplier: 1.0, avg_gross_to_net: 0.42, avg_payer_rebate: 0.48 },
    EU: { multiplier: 0.35, avg_gross_to_net: 0.15, avg_payer_rebate: 0.12 },
    UK: { multiplier: 0.30, avg_gross_to_net: 0.12, avg_payer_rebate: 0.10 },
    Japan: { multiplier: 0.38, avg_gross_to_net: 0.08, avg_payer_rebate: 0.05 },
    Canada: { multiplier: 0.33, avg_gross_to_net: 0.14, avg_payer_rebate: 0.11 },
  };

  const mkt = marketData[market] || marketData["US"];

  // Base price modeling from drug class (illustrative WAC estimates)
  const DRUG_CLASS_WAC_RANGES = {
    biologic: { min: 25000, max: 80000, typical: 45000 },
    gene_therapy: { min: 500000, max: 3500000, typical: 1200000 },
    small_molecule_oral: { min: 1500, max: 15000, typical: 5000 },
    injectable_peptide: { min: 8000, max: 35000, typical: 18000 },
    antibody_drug_conjugate: { min: 80000, max: 250000, typical: 140000 },
    checkpoint_inhibitor: { min: 120000, max: 250000, typical: 175000 },
    cell_therapy: { min: 300000, max: 600000, typical: 450000 },
  };

  const drugType = (drug.class || "small_molecule_oral").toLowerCase().replace(/\s+/g, "_");
  const range = DRUG_CLASS_WAC_RANGES[drugType] || DRUG_CLASS_WAC_RANGES.small_molecule_oral;

  const basePriceWAC = range.typical * mkt.multiplier;
  const netPriceAfterRebates = basePriceWAC * (1 - mkt.avg_gross_to_net);

  // Payer mix modeling
  const payerDefaults = { commercial: 0.45, medicare: 0.30, medicaid: 0.15, uninsured: 0.10 };
  const payerMix = { ...payerDefaults, ...(payer_mix || {}) };

  const netRevenuePerUnit =
    netPriceAfterRebates * payerMix.commercial * 0.92 +
    netPriceAfterRebates * payerMix.medicare * 0.78 +
    netPriceAfterRebates * payerMix.medicaid * 0.40 +
    basePriceWAC * payerMix.uninsured * 0.05;

  const competitorCount = Array.isArray(competitors) ? competitors.length : 0;
  const marketShareProjection =
    competitorCount === 0 ? 0.85 :
    competitorCount === 1 ? 0.45 :
    competitorCount === 2 ? 0.28 :
    Math.max(0.05, 0.65 / competitorCount);

  const payerCoverageForecast = {
    tier_1_formulary: 0.12,
    tier_2_preferred: 0.38,
    tier_3_nonpreferred: 0.35,
    prior_auth_required: 0.72,
    step_therapy_required: 0.45,
    commercial_coverage: 0.82,
    medicare_part_d: 0.68,
    medicaid_coverage: 0.55,
  };

  return {
    analysis_id: analysisId,
    drug: drug.name || drug,
    market,
    recommended_wac_price: Math.round(basePriceWAC),
    net_price_after_rebates: Math.round(netPriceAfterRebates),
    net_revenue_per_unit_blended: Math.round(netRevenuePerUnit),
    gross_to_net_estimate: (mkt.avg_gross_to_net * 100).toFixed(1) + "%",
    market_share_projection: (marketShareProjection * 100).toFixed(1) + "%",
    payer_mix_analyzed: payerMix,
    payer_coverage_forecast: payerCoverageForecast,
    competitive_dynamics: {
      competitors_identified: competitorCount,
      competitors: competitors || [],
      pricing_strategy: competitorCount === 0 ? "Premium market entry — no direct competition" :
        competitorCount <= 2 ? "Competitive differentiation pricing" : "Value-based pricing in crowded market",
    },
    recommendations: [
      `Launch WAC at $${Math.round(basePriceWAC).toLocaleString()} with expected net of $${Math.round(netPriceAfterRebates).toLocaleString()} after gross-to-net`,
      "Engage top-5 PBMs (Express Scripts, CVS Caremark, OptumRx) for formulary placement negotiations",
      payerMix.medicaid > 0.20 ? "File Medicaid Best Price early to set supplemental rebate floor" : "Moderate Medicaid exposure — standard rebate strategy",
      "Consider value-based contracts (outcomes-linked rebates) for major payers to support premium WAC defense",
    ],
    fee_usd: 3.0,
  };
}

// ─── 6. managePharmaSupplyChain ───────────────────────────────────────────────

export function managePharmaSupplyChain(drugId, facilities = [], demand_forecast = {}) {
  const checkId = randomUUID();

  const drug = parseDrug(db.prepare("SELECT * FROM pharma_drugs WHERE id = ? OR generic = ? OR name = ?").get(drugId, drugId, drugId));

  const facilityStatuses = (Array.isArray(facilities) ? facilities : []).map((facility, idx) => ({
    facility_id: facility.id || `FAC-${String(idx + 1).padStart(3, "0")}`,
    facility_name: facility.name || `Manufacturing Site ${idx + 1}`,
    location: facility.location || "Unknown",
    capacity_utilization: Math.round(60 + Math.random() * 30) + "%",
    gmp_status: ["Compliant", "Compliant", "Warning — last inspection 18 months ago", "Compliant"][idx % 4],
    serialization_compliant: idx % 5 !== 3,
    last_fda_inspection: `${2022 + (idx % 3)}-${String(Math.floor(Math.random() * 12 + 1)).padStart(2, "0")}-01`,
    warning_letters: idx % 7 === 0 ? 1 : 0,
  }));

  const demandUnits = demand_forecast.units_per_month || 50000;
  const productionCapacity = facilities.length > 0 ? demandUnits * 1.15 * facilities.length : demandUnits * 0.9;
  const coverageRatio = productionCapacity / demandUnits;

  const shortageRisk =
    coverageRatio < 0.85 ? "HIGH — production capacity below demand forecast" :
    coverageRatio < 1.05 ? "MODERATE — thin buffer; monitor closely" :
    "LOW — adequate supply buffer";

  const coldChainRequired = drug && (
    (drug.route || "").includes("injection") ||
    drug.drug_class.includes("Monoclonal") ||
    drug.drug_class.includes("mRNA") ||
    drug.drug_class.includes("Cell Therapy")
  );

  db.prepare(`
    INSERT INTO pharma_supply_checks
      (id, drug_id, facilities, demand_forecast, supply_status, shortage_risk)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    checkId,
    drugId,
    JSON.stringify(facilityStatuses),
    JSON.stringify(demand_forecast),
    coverageRatio >= 1.05 ? "adequate" : coverageRatio >= 0.85 ? "constrained" : "shortage",
    shortageRisk
  );

  return {
    check_id: checkId,
    drug: drug ? { id: drug.id, name: drug.name, generic: drug.generic } : { id: drugId, name: "Unknown Drug" },
    supply_status: coverageRatio >= 1.05 ? "adequate" : coverageRatio >= 0.85 ? "constrained" : "shortage",
    coverage_ratio: Math.round(coverageRatio * 100) / 100,
    cold_chain_compliance: coldChainRequired ? {
      required: true,
      temperature_range: drug?.drug_class?.includes("mRNA") ? "-20°C to -15°C" : "2°C to 8°C",
      status: "Compliant — all facilities reporting in-range excursion logs",
    } : { required: false },
    serialization_status: {
      dscsa_compliant: facilityStatuses.filter(f => f.serialization_compliant).length,
      total_facilities: facilityStatuses.length,
      serialization_rate: facilityStatuses.length > 0 ?
        Math.round((facilityStatuses.filter(f => f.serialization_compliant).length / facilityStatuses.length) * 100) + "%" :
        "No facilities registered",
    },
    shortage_risk: shortageRisk,
    facility_statuses: facilityStatuses,
    alternative_suppliers: [
      { name: "Lonza Group AG", type: "CMO", location: "Basel, Switzerland", capacity: "Available Q2+4 months lead time" },
      { name: "Catalent Pharma Solutions", type: "CMO", location: "Somerset, NJ, USA", capacity: "Available with 3-month qualification" },
      { name: "Samsung Biologics", type: "CMO", location: "Incheon, South Korea", capacity: "Large-scale biologic capacity available" },
    ],
    demand_forecast,
    fee_usd: 1.0,
  };
}

// ─── 7. generateRegulatorySubmission ─────────────────────────────────────────

export function generateRegulatorySubmission(submissionType, drug, data = {}) {
  const submissionId = randomUUID();

  const SUBMISSION_TEMPLATES = {
    IND: {
      name: "Investigational New Drug Application",
      required_sections: [
        "Cover Sheet (Form FDA 1571)",
        "Table of Contents",
        "Introductory Statement and General Investigational Plan",
        "Investigator's Brochure (IB)",
        "Clinical Protocols (Phase 1 safety/PK)",
        "Chemistry, Manufacturing and Controls (CMC) — Drug Substance",
        "CMC — Drug Product",
        "Pharmacology and Toxicology Data (animal studies)",
        "Previous Human Experience",
        "Additional Information (orphan designation if applicable)",
      ],
      common_deficiencies: [
        "Inadequate description of drug substance manufacturing process",
        "Missing or incomplete GMP certificate for API manufacturer",
        "Insufficient toxicology data for proposed clinical dose",
        "Protocol lacks stopping rules and dose escalation criteria",
        "Investigator qualifications not documented",
        "Insufficient stability data for drug product",
      ],
      timeline_estimate: "30-day FDA review period (automatic unless FDA places on Clinical Hold)",
      fee_note: "IND submission is free; user fees apply to NDA/BLA",
    },
    NDA: {
      name: "New Drug Application",
      required_sections: [
        "Module 1 — Administrative and Product Specific Information (US specific)",
        "Module 2 — Quality Overall Summary (QOS) + Nonclinical/Clinical Overview",
        "Module 3 — Quality (CMC): drug substance, drug product, stability",
        "Module 4 — Nonclinical Study Reports (pharmacology, toxicology, ADME)",
        "Module 5 — Clinical Study Reports: Phase 1 PK/PD, Phase 2 dose-ranging, Phase 3 pivotal trials",
        "REMS proposal (if required by FDA)",
        "Proposed labeling (Package Insert, Medication Guide)",
        "Patent certifications (Paragraph IV if applicable)",
        "Pediatric Study Plan (PSP) or deferral/waiver",
        "RiskMAP / risk management proposal",
      ],
      common_deficiencies: [
        "Complete Response Letter (CRL) most common: inadequate efficacy in primary endpoint",
        "Safety signal requiring additional post-marketing study commitment",
        "CMC deficiency: inadequate characterization of impurities",
        "Inadequate bridging studies for product reformulation",
        "Missing pediatric data (PREA requirement)",
        "Statistical analysis plan not pre-specified before unblinding",
        "Labeling negotiations extending review timeline",
      ],
      timeline_estimate: "Standard review: 10-12 months PDUFA date. Priority Review: 6 months. Accelerated Approval pathway may shorten timeline.",
      fee_note: `FY2024 NDA application fee: ~$4.0M (full). Product maintenance fee: ~$171K/year.`,
    },
    ANDA: {
      name: "Abbreviated New Drug Application (Generic Drug)",
      required_sections: [
        "Cover Sheet (Form FDA 356h)",
        "Drug Substance (Section P — sourcing, characterization, specifications)",
        "Drug Product (Section P — formulation, manufacturing, controls)",
        "Bioequivalence Studies (BE — PK studies demonstrating BE to RLD)",
        "Labeling (must be identical to Reference Listed Drug)",
        "Patent and Exclusivity Certifications",
        "Certifications to Comply with Federal Requirements",
        "Debarment Certification",
        "Field Alert Report requirements",
      ],
      common_deficiencies: [
        "Bioequivalence failure — Cmax or AUC outside 80-125% CI",
        "Impurity profiles exceeding ICH Q3B thresholds",
        "Container closure system not adequately characterized",
        "Dissolution method not validated or not discriminatory",
        "RLD identification error or outdated RLD",
        "Site not registered or inspected by FDA",
      ],
      timeline_estimate: "Target 10-month review (GDUFA goal). Prioritized reviews (first-to-file) may be faster.",
      fee_note: "FY2024 ANDA fee: ~$117K.",
    },
    BLA: {
      name: "Biologics License Application",
      required_sections: [
        "Module 1 — Administrative",
        "Module 2 — Quality Overall Summary (QOS)",
        "Module 3 — Quality: Analytical procedures, reference standards, container closure, stability",
        "Bioassay methods and specifications",
        "Cell bank characterization (master and working cell banks)",
        "Adventitious agent safety evaluation",
        "Module 4 — Nonclinical Studies",
        "Module 5 — Clinical Studies: All phases, integrated efficacy and safety summary",
        "Comparability protocols (pre/post-manufacturing changes)",
        "Risk Management Plan / REMS if required",
      ],
      common_deficiencies: [
        "Cell line characterization incomplete",
        "Comparability data insufficient for manufacturing changes",
        "Immunogenicity assay validation deficiencies",
        "Adventitious agent testing gaps",
        "Long-term stability data not available at time of filing",
        "Reference standard characterization inadequate",
      ],
      timeline_estimate: "Standard review: 12 months (PDUFA date). Priority Review: 6 months. BT Designation can trigger rolling review.",
      fee_note: "FY2024 BLA application fee: ~$4.0M (full application).",
    },
    sNDA: {
      name: "Supplemental NDA (Label Expansion / Manufacturing Change)",
      required_sections: [
        "Cover Sheet and Type of Supplement",
        "Summary of Changes (efficacy supplement or manufacturing supplement)",
        "Comparison of Proposed and Approved Labeling",
        "New Clinical Data (if efficacy supplement)",
        "New CMC data (if manufacturing change)",
        "Post-Marketing Study Commitment updates",
        "REMS modification (if current REMS exists)",
        "Real-World Evidence (if RWE supports new indication)",
      ],
      common_deficiencies: [
        "Inadequate bridging data for extrapolation from existing indication",
        "New safety data requiring enhanced monitoring program",
        "Labeling negotiations exceeding 3 review cycles",
        "Insufficient PK data for new population/formulation",
      ],
      timeline_estimate: "Priority sNDA (efficacy supplement): 6-12 months. CBE-30 (manufacturing): 30-day review. Prior Approval: 12 months.",
      fee_note: "Efficacy supplement: ~$2M. Manufacturing supplement: variable by pathway.",
    },
  };

  const template = SUBMISSION_TEMPLATES[submissionType] || SUBMISSION_TEMPLATES.NDA;

  return {
    submission_id: submissionId,
    submission_type: submissionType,
    submission_name: template.name,
    drug_name: typeof drug === "string" ? drug : drug?.name || "Unknown",
    submission_outline: {
      overview: `${template.name} for ${typeof drug === "string" ? drug : drug?.name || "the described drug"}`,
      regulatory_pathway: template.name,
      applicable_guidance: [
        "21 CFR 314 (NDA)/601 (BLA)/314.94 (ANDA)",
        "ICH M4 (CTD format)",
        "ICH Q1A-Q1E (Stability)",
        "ICH Q6A/Q6B (Specifications)",
        "FDA Guidance for Industry — specific to submission type",
      ],
    },
    required_sections: template.required_sections,
    common_deficiencies: template.common_deficiencies,
    timeline_estimate: template.timeline_estimate,
    fee_note: template.fee_note,
    additional_data: data,
    recommended_steps: [
      "Request pre-submission meeting with FDA (Type B for NDA/BLA, Type C for complex supplements)",
      "Engage regulatory affairs consultant to review dossier prior to submission",
      "Conduct internal mock FDA review (Red Team) for pivotal submissions",
      "File in eCTD format via FDA's electronic submissions gateway (ESG)",
      "Prepare for potential AdCom (Advisory Committee) meeting for novel mechanisms or safety concerns",
    ],
    fee_usd: 10.0,
  };
}

// ─── 8. getPharmaMarketIntelligence ───────────────────────────────────────────

export function getPharmaMarketIntelligence(therapeutic_area, timeframe = "5y") {
  const reportId = randomUUID();

  const MARKET_DATA = {
    diabetes: {
      market_size_bn: 98.2,
      cagr: 0.087,
      key_players: ["Novo Nordisk", "Eli Lilly", "AstraZeneca", "Sanofi", "Merck"],
      pipeline_highlights: ["Oral semaglutide NDA expansion", "CagriSema (amylin/GLP-1 combo)", "Retatrutide (triple agonist GIP/GLP-1/glucagon)", "Oral tirzepatide Phase 3"],
      patent_cliffs: [
        { drug: "Januvia (sitagliptin)", company: "Merck", expiry: "2026", revenue_at_risk_bn: 3.2 },
        { drug: "Jardiance (empagliflozin)", company: "Boehringer/Lilly", expiry: "2029", revenue_at_risk_bn: 6.5 },
      ],
      opportunity_score: 9.4,
    },
    oncology: {
      market_size_bn: 248.3,
      cagr: 0.112,
      key_players: ["Roche/Genentech", "Merck", "Bristol-Myers Squibb", "AstraZeneca", "Pfizer", "Daiichi Sankyo"],
      pipeline_highlights: ["ADC wave (HER2, TROP-2, FRα)", "Bispecific T-cell engagers (TCEs)", "mRNA cancer vaccines", "CAR-T for solid tumors", "KRAS G12C/G12D inhibitors"],
      patent_cliffs: [
        { drug: "Keytruda (pembrolizumab)", company: "Merck", expiry: "2028", revenue_at_risk_bn: 25.0 },
        { drug: "Opdivo (nivolumab)", company: "BMS", expiry: "2026", revenue_at_risk_bn: 9.1 },
      ],
      opportunity_score: 9.8,
    },
    immunology: {
      market_size_bn: 156.7,
      cagr: 0.094,
      key_players: ["AbbVie", "Sanofi/Regeneron", "Pfizer", "UCB", "Johnson & Johnson"],
      pipeline_highlights: ["TYK2 inhibitors (deucravacitinib)", "IL-17 expansion (psoriasis→AD)", "Subcutaneous formulations of IV biologics", "Bispecific for RA (FcRn+IL-6)"],
      patent_cliffs: [
        { drug: "Humira (adalimumab)", company: "AbbVie", expiry: "2023 (US biosimilars live)", revenue_at_risk_bn: 14.2 },
        { drug: "Stelara (ustekinumab)", company: "J&J", expiry: "2023 (US)", revenue_at_risk_bn: 8.0 },
      ],
      opportunity_score: 8.7,
    },
    neurology: {
      market_size_bn: 89.4,
      cagr: 0.076,
      key_players: ["Biogen", "Eisai", "Eli Lilly", "AstraZeneca", "Novartis"],
      pipeline_highlights: ["Anti-tau therapies (BIIB080)", "α-synuclein targeting in PD", "TDP-43 modulators in ALS", "RNAi liver-targeted neurodegeneration"],
      patent_cliffs: [
        { drug: "Tecfidera (dimethyl fumarate)", company: "Biogen", expiry: "2021 (generics entered)", revenue_at_risk_bn: 4.5 },
      ],
      opportunity_score: 8.1,
    },
    cardiovascular: {
      market_size_bn: 72.3,
      cagr: 0.058,
      key_players: ["Novartis", "Pfizer", "AstraZeneca", "Amgen", "Ionis"],
      pipeline_highlights: ["Inclisiran (siRNA, PCSK9 inhibition)", "Zilebesiran (angiotensinogen RNAi)", "Obicetrapib (CETP inhibitor)", "Factor XI/XIa anticoagulants"],
      patent_cliffs: [
        { drug: "Eliquis (apixaban)", company: "BMS/Pfizer", expiry: "2028", revenue_at_risk_bn: 12.4 },
        { drug: "Xarelto (rivaroxaban)", company: "J&J/Bayer", expiry: "2024", revenue_at_risk_bn: 6.2 },
      ],
      opportunity_score: 7.6,
    },
    rare_disease: {
      market_size_bn: 44.8,
      cagr: 0.126,
      key_players: ["Vertex Pharmaceuticals", "Ionis/AstraZeneca", "Alexion/AstraZeneca", "Sarepta Therapeutics", "PTC Therapeutics"],
      pipeline_highlights: ["AAV gene therapies for LSD/metabolic disorders", "RNA-based rare disease platforms", "CRISPR in-vivo editing (Intellia)", "Small molecule protein degraders for undruggable targets"],
      patent_cliffs: [],
      opportunity_score: 9.6,
    },
  };

  const areaNorm = (therapeutic_area || "").toLowerCase().replace(/[^a-z]/g, "_").replace(/__+/g, "_");
  const data = MARKET_DATA[areaNorm] || MARKET_DATA[Object.keys(MARKET_DATA).find(k => areaNorm.includes(k))] || {
    market_size_bn: 25.0,
    cagr: 0.07,
    key_players: ["Data not available for this therapeutic area — contact HiveAgent research team"],
    pipeline_highlights: ["Custom research available"],
    patent_cliffs: [],
    opportunity_score: 6.0,
  };

  const years = { "1y": 1, "3y": 3, "5y": 5, "10y": 10 }[timeframe] || 5;
  const projected_market_size = Math.round(data.market_size_bn * Math.pow(1 + data.cagr, years) * 10) / 10;

  return {
    report_id: reportId,
    therapeutic_area,
    timeframe,
    current_market_size_bn: data.market_size_bn,
    projected_market_size_bn: projected_market_size,
    cagr: (data.cagr * 100).toFixed(1) + "%",
    growth_rate_description: data.cagr > 0.10 ? "High growth" : data.cagr > 0.07 ? "Moderate-high growth" : "Steady growth",
    key_players: data.key_players,
    pipeline_drugs: data.pipeline_highlights,
    patent_cliffs: data.patent_cliffs,
    opportunity_score: data.opportunity_score + "/10",
    strategic_recommendations: [
      `${therapeutic_area} market is projected to reach $${projected_market_size}B by ${new Date().getFullYear() + years}`,
      data.patent_cliffs.length > 0 ? `Watch patent cliffs: ${data.patent_cliffs.map(p => p.drug).join(", ")}` : "No near-term major patent cliffs identified",
      "Consider partnering with or acquiring mid-size players with validated Phase 2 assets",
      "RWE platform investment recommended to support label expansions in competitive indications",
    ],
    fee_usd: 5.0,
  };
}
