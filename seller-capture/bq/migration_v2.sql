-- Migration v2 — add structured address + new ID fields to sellers_enriched.
-- Idempotent (IF NOT EXISTS) — safe to re-run.
-- Run via Cloud Shell:
--   bq query --use_legacy_sql=false < migration_v2.sql

ALTER TABLE `luko-sellers.luko_sellers.sellers_enriched`
  ADD COLUMN IF NOT EXISTS asin_example         STRING,
  ADD COLUMN IF NOT EXISTS brand                STRING,
  ADD COLUMN IF NOT EXISTS business_type        STRING,
  ADD COLUMN IF NOT EXISTS representative_name  STRING,
  ADD COLUMN IF NOT EXISTS street               STRING,
  ADD COLUMN IF NOT EXISTS address_line_2       STRING,
  ADD COLUMN IF NOT EXISTS postal_code          STRING,
  ADD COLUMN IF NOT EXISTS city                 STRING,
  ADD COLUMN IF NOT EXISTS region               STRING,
  ADD COLUMN IF NOT EXISTS cs_street            STRING,
  ADD COLUMN IF NOT EXISTS cs_postal_code       STRING,
  ADD COLUMN IF NOT EXISTS cs_city              STRING,
  ADD COLUMN IF NOT EXISTS cs_region            STRING,
  ADD COLUMN IF NOT EXISTS cs_country           STRING,
  ADD COLUMN IF NOT EXISTS cs_differs           BOOL,
  ADD COLUMN IF NOT EXISTS phone_alt            STRING,
  ADD COLUMN IF NOT EXISTS email_alt            STRING,
  ADD COLUMN IF NOT EXISTS epr_id               STRING,
  ADD COLUMN IF NOT EXISTS other_id             STRING;

-- Clear the country column for previously-captured rows: the value was inferred
-- from the marketplace domain (amazon.de => DE) which is wrong for foreign sellers.
-- Next capture will repopulate with the actual value from the page.
UPDATE `luko-sellers.luko_sellers.sellers_enriched`
SET country = NULL
WHERE last_enriched_at IS NULL;
