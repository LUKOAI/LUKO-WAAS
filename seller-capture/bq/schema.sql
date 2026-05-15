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
  -- Negatives
  agency_flag              STRING,
  generic_contacts         STRING,        -- JSON: support/info contacts kept aside
  -- Scoring
  confidence_company       INT64,
  confidence_email         INT64,
  confidence_phone         INT64,
  confidence_overall       INT64,
  sources                  STRING,        -- JSON: per-field source list
  -- Lifecycle
  status                   STRING,        -- captured_pending_enrich | enriched_ok | enriched_low_confidence | enriched_failed | agency_only | contacted | converted | dead
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

-- Materialized "worklist" — the only view operators see in their Sheet
CREATE OR REPLACE VIEW `${PROJECT}.${DATASET}.worklist_v` AS
SELECT
  seller_id, marketplace, company_name, country,
  decision_maker_name, decision_maker_role, email, phone,
  agency_flag, confidence_overall, status,
  website, last_captured_at, last_enriched_at, last_action_at
FROM `${PROJECT}.${DATASET}.sellers_enriched`
WHERE status IN ('enriched_ok','enriched_low_confidence','captured_pending_enrich')
  AND (agency_flag IS NULL OR agency_flag = '')
ORDER BY confidence_overall DESC NULLS LAST, last_captured_at DESC;
