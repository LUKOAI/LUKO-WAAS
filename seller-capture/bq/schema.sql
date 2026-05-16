-- Luko Seller Capture & Enrichment — BigQuery schema
-- Run in the BQ console once. Replace `${PROJECT}` / `${DATASET}` (e.g. luko_sellers).

-- Raw captures: append-only event log
CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.sellers_raw` (
  capture_id          STRING NOT NULL,
  seller_id           STRING NOT NULL,
  marketplace         STRING,
  captured_at         TIMESTAMP NOT NULL,
  operator_id         STRING,
  url                 STRING,
  parsed_json         STRING,           -- JSON-encoded parsed fields
  raw_text            STRING,
  gpsr_raw            STRING,
  screenshot_drive_id STRING
)
PARTITION BY DATE(captured_at)
CLUSTER BY seller_id;

-- Current state per seller — upserted by Capture endpoint + enrichment worker
CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.sellers_enriched` (
  seller_id                STRING NOT NULL,
  marketplace              STRING,
  -- Identity (truth from registries when available)
  company_name             STRING,
  legal_form               STRING,
  business_address         STRING,
  country                  STRING,
  vat                      STRING,
  registry_id              STRING,        -- KRS / Companies House / Handelsregister id
  -- Raw from Amazon (kept separately for forensic comparison)
  business_name            STRING,
  phone_raw                STRING,
  email_raw                STRING,
  -- Decision-maker (best contact after enrichment)
  decision_maker_name      STRING,
  decision_maker_role      STRING,
  email                    STRING,
  phone                    STRING,
  -- Web presence
  website                  STRING,
  other_urls               ARRAY<STRING>,
  tech_stack               ARRAY<STRING>,
  other_marketplaces       ARRAY<STRUCT<platform STRING, url STRING, found_at TIMESTAMP>>,
  brands                   ARRAY<STRING>,
  -- Officers / directors (from Companies House, KRS, etc.) — JSON list of {name,role,...}
  officers                 STRING,
  -- Operator-facing notes (mostly from LLM merge) — JSON list of short strings
  notes                    STRING,
  -- Negatives
  agency_flag              STRING,
  generic_contacts         STRING,        -- JSON: support/info contacts kept aside
  -- DE-operating signals (target audience = foreign sellers active on amazon.de)
  weee_number              STRING,        -- 8 digits from "WEEE-Reg.-Nr. DE NNNNNNNN"
  lucid_id                 STRING,        -- "DE\d{13}" Verpackungsregister id
  de_operating_signals     ARRAY<STRING>, -- subset of {'vat_de','weee','lucid','fba_de'}
  -- Jurisdiction / outreach targeting
  jurisdiction_segment     STRING,        -- 'DE' | 'PL' | 'foreign' | 'unknown'
  jurisdiction_reason      STRING,
  outreach_priority        STRING,        -- 'high' | 'medium' | 'inactive' | 'skip' | 'review'
  -- Scoring
  confidence_company       INT64,
  confidence_email         INT64,
  confidence_phone         INT64,
  confidence_overall       INT64,
  sources                  STRING,        -- JSON: per-field source list
  -- Lifecycle
  status                   STRING,        -- captured_pending_enrich | enriched_ok | enriched_low_confidence | enriched_failed | agency_only | skipped_pl | skipped_de | contacted | converted | dead
  last_captured_at         TIMESTAMP,
  last_enriched_at         TIMESTAMP,
  last_action_at           TIMESTAMP,
  -- Bookkeeping
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY seller_id, status;

-- Every action attempted (call/email/funnel push) — basis for "did we already reach them?"
CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.action_log` (
  action_id     STRING NOT NULL,
  seller_id     STRING NOT NULL,
  action_type   STRING,                   -- call_bland | call_vapi | email | kartra_push | manual_note
  operator_id   STRING,
  payload       STRING,                   -- JSON
  result        STRING,                   -- queued | sent | delivered | answered | bounced | failed
  result_at     TIMESTAMP,
  external_id   STRING,                   -- Bland/Vapi call id, message-id, etc.
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY seller_id;

-- Negative-signal blacklist — agencies acting as fronts for sellers (GPSR rep, EPR rep, VAT rep)
CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.agency_blacklist` (
  name          STRING NOT NULL,
  kind          STRING,                   -- vat | gpsr | epr | weee | general
  domain        STRING,
  email         STRING,
  phone         STRING,
  address       STRING,
  country       STRING,
  source        STRING,                   -- seed | auto_learned
  hits          INT64,                    -- how many sellers point to this agency
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at    TIMESTAMP
);

-- Worklist for active outreach — foreign sellers (non-DE, non-PL).
-- DE sellers excluded (UWG / abmahnung risk). PL skipped (data already on file).
CREATE OR REPLACE VIEW `${PROJECT}.${DATASET}.worklist_v` AS
SELECT
  seller_id, marketplace, company_name, country, jurisdiction_segment,
  decision_maker_name, decision_maker_role, email, phone,
  weee_number, lucid_id, de_operating_signals,
  agency_flag, confidence_overall, status, outreach_priority,
  website, last_captured_at, last_enriched_at, last_action_at
FROM `${PROJECT}.${DATASET}.sellers_enriched`
WHERE status IN ('enriched_ok','enriched_low_confidence','captured_pending_enrich')
  AND outreach_priority IN ('high','medium','review')
  AND (agency_flag IS NULL OR agency_flag = '')
ORDER BY
  CASE outreach_priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'review' THEN 3 ELSE 9 END,
  confidence_overall DESC NULLS LAST,
  last_captured_at DESC;

-- DE-resident sellers — kept for search / future outreach, NOT enriched (no VIES, no scrapers).
-- Carries only what the Chrome extension captured from Amazon. Gated by OUTREACH_DE_ENABLED
-- whenever we decide to activate Germany.
CREATE OR REPLACE VIEW `${PROJECT}.${DATASET}.worklist_de_inactive_v` AS
SELECT
  seller_id, marketplace, business_name, business_address, country,
  vat, registry_id, phone_raw, email_raw,
  status, jurisdiction_reason,
  last_captured_at, last_enriched_at
FROM `${PROJECT}.${DATASET}.sellers_enriched`
WHERE jurisdiction_segment = 'DE'
ORDER BY last_captured_at DESC;

-- PL-resident sellers — same posture as DE (warehouse only, no enrichment). View kept symmetric
-- so operators / analysts can browse them.
CREATE OR REPLACE VIEW `${PROJECT}.${DATASET}.warehouse_pl_v` AS
SELECT
  seller_id, marketplace, business_name, business_address, country,
  vat, registry_id, phone_raw, email_raw,
  status, jurisdiction_reason,
  last_captured_at, last_enriched_at
FROM `${PROJECT}.${DATASET}.sellers_enriched`
WHERE jurisdiction_segment = 'PL'
ORDER BY last_captured_at DESC;

-- Migration helper for existing datasets: add columns one-by-one (idempotent via IF NOT EXISTS).
-- Run once after applying this file to a pre-existing dataset.
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS weee_number STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS lucid_id STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS de_operating_signals ARRAY<STRING>;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS jurisdiction_segment STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS jurisdiction_reason STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS outreach_priority STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS officers STRING;
-- ALTER TABLE `${PROJECT}.${DATASET}.sellers_enriched` ADD COLUMN IF NOT EXISTS notes STRING;
