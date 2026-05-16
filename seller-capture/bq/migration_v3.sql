-- Migration v3 — rename BQ column `vat` -> `vat_number` for consistency with
-- INBOX_HEADERS / spreadsheet column names. Also clears junk address data that
-- was written by content.js v2 before the legal-block validation fix.
--
-- Idempotent: ALTER TABLE RENAME COLUMN succeeds even if column already renamed
-- (returns error caught by job — but safer to check first).

-- 1. Rename column.
ALTER TABLE `luko-sellers.luko_sellers.sellers_enriched`
RENAME COLUMN vat TO vat_number;

-- 2. Clear junk address values written by buggy scraper. The bug filled street/
--    postal_code/city/region with Amazon site-nav text ("Geld verdienen mit
--    Amazon", "Verkaufen bei Amazon Handmade", etc.) for sellers without a real
--    Gesetzliche Anbieterkennung block. Re-capture (Alt+S) repopulates correctly.
UPDATE `luko-sellers.luko_sellers.sellers_enriched`
SET
  street = NULL,
  address_line_2 = NULL,
  postal_code = NULL,
  city = NULL,
  region = NULL
WHERE
  street IN ('Geld verdienen mit Amazon', 'Verkaufen bei Amazon Handmade',
             'Jetzt verkaufen', 'Verkaufen bei Amazon Business',
             'Geld verdienen mit Amaz')
  OR postal_code IN ('Verkaufen bei Amazon Handmade', 'Verkaufen bei Amazon Business')
  OR city IN ('Jetzt verkaufen', 'Verkaufen bei Amazon Business')
  OR region IN ('Verkaufen bei Amazon Business', 'Verkaufen bei Amazon Handmade');
