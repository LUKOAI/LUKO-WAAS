-- Migration v5 — add `overrides` column tracking which fields were populated/
-- changed by the enrichment worker. Stored as comma-separated list of field names
-- so operators can glance at one cell to see what enrichment contributed.
--
-- Example values after a Niboline enrichment:
--   "company_name,decision_maker_name,decision_maker_role,jurisdiction_segment,outreach_priority"

ALTER TABLE `luko-sellers.luko_sellers.sellers_enriched`
  ADD COLUMN IF NOT EXISTS overrides STRING;
