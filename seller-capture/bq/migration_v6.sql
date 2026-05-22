-- Migration v6 — add `country_override` column for operator-set country values.
--
-- Capture (from Amazon) and enrichment (from VIES/registries) write to `country`.
-- Operators who spot a misclassified seller can type the correct country in the
-- Worklist UI; the onEdit trigger writes the value to `country_override`.
--
-- Downstream consumers (Worklist refresh, segmentation in enrich pipeline) read
-- `COALESCE(country_override, country)` as the effective country, so the manual
-- override sticks across re-captures and re-enrichments.

ALTER TABLE `luko-sellers.luko_sellers.sellers_enriched`
  ADD COLUMN IF NOT EXISTS country_override STRING;
