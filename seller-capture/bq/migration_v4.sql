-- Migration v4 — add `seller_name` column (h1#seller-name on Amazon storefront).
-- The existing `brand` column was incorrectly populated with seller display name
-- (e.g. "AnkerDirect DE") which is conceptually different from product brand
-- (e.g. "Anker"). We preserve `brand` for future product-level capture.
--
-- Run via Cloud Shell:
--   bq query --use_legacy_sql=false < seller-capture/bq/migration_v4.sql

-- 1. Add seller_name column
ALTER TABLE `luko-sellers.luko_sellers.sellers_enriched`
  ADD COLUMN IF NOT EXISTS seller_name STRING;

-- 2. Backfill: copy existing `brand` values into `seller_name` (they were
--    actually seller display names, not real brands).
UPDATE `luko-sellers.luko_sellers.sellers_enriched`
SET seller_name = brand
WHERE seller_name IS NULL AND brand IS NOT NULL AND brand != '';

-- 3. Clear `brand` column for those rows (will be repopulated by future product
--    page captures with the actual product brand, e.g. "Anker", "Nivea").
UPDATE `luko-sellers.luko_sellers.sellers_enriched`
SET brand = NULL
WHERE seller_name IS NOT NULL AND brand = seller_name;
