# WAAS SYSTEM v3.0 — KOMPLETNA SPECYFIKACJA REFAKTORINGU
# Dokument dla Claude Code — GitHub repo LUKOAI/LUKO-WAAS

Data: 2026-03-03
Repo: https://github.com/LUKOAI/LUKO-WAAS
Branch roboczy: claude/wordpress-affiliate-automation-01WEqnEU8vMekyGhehgYWG2U (79 commits)
Branch produktowy: claude/fix-product-price-display-0136f63SUJHjN27trVmE4Mzb (59 commits)

## SPIS TRESCI

1. Architektura systemu
2. FAZA A — Naprawic konflikty duplikatow (4 konflikty)
3. FAZA B — Usunac zbedne pliki
4. FAZA C — Eliminacja waas_product (Amazon Products → WooCommerce only)
5. FAZA D — Nowe moduly GAS (SiteCleanup, SearchEngines, LaunchReport, ContentGenerator v2)
6. FAZA E — Nowe endpointy WordPress (waas-settings rozbudowa)
7. FAZA F — Price Sync via SP-API + PA-API
8. FAZA G — Nowe menu
9. FAZA H — Full Onboarding Pipeline (launchNewSite)
10. Testy i walidacja

---

## 1. ARCHITEKTURA — PLIKI W APPS SCRIPT

appsscript.json
AmazonPA.gs (431 linii) — Amazon PA-API
AuthMigration.gs (267) — DO USUNIECIA (jednorazowa migracja)
Automation.gs (1307) — installFullStack, triggery
ContentGenerator.gs (390) — DO PRZEBUDOWY (generyczne szablony)
Core.gs (570) — FUNDAMENT (nie zmieniac!)
DiviAPI.gs (494) — Divi download/layouts
Menu.gs (902) — Glowne menu UI
Migration.gs (325) — DO USUNIECIA (jednorazowa migracja Divi keys)
ProductManager.gs (272) — CRUD produktow
setup.gs (590) — Tworzenie arkuszy (MA DUPLIKAT onOpen!)
SiteManager.gs (888) — Sites management
TaskManager.gs (325) — Kolejka zadan
WordPressAPI.gs (1524) — WordPress REST API
WordPressAuth.gs (928) — Auth + Application Password
ProductManager-WOOCOMMERCE-EXPORT.gs (1205) — WooCommerce export
ProductImportHelper.gs (196) — Import helper
ProductManager-PRICE-WEBHOOK.gs (309) — Price webhook
SPApiDataCollection-WAAS.gs — SP-API (NIE w GitHub)
SPApiAuth-WAAS.gs — SP-API auth (NIE w GitHub)
SEO.gs (797) — NOWY modul SEO

---

## 2. FAZA A — NAPRAWIC KONFLIKTY

### A1. Usunac onOpen() z setup.gs (linie 536-590)
Powod: Menu.gs ma nowsza wersje. Zostawic reszta setup.gs.

### A2. Usunac updateSiteStatus() z Automation.gs (linie 403-437)
Powod: SiteManager.gs ma poprawna wersje (3 parametry vs 2).
UWAGA: Dostosowac wywolania w Automation.gs do sygnatury (siteId, status, updates).

### A3. Usunac publishContentToWordPress() z ContentGenerator.gs (linie 375-390)
Powod: Automation.gs ma rozbudowana wersje.

### A4. Usunac installWooCommerceOnSite() z Automation.gs (linie 340-401)
Powod: SiteManager.gs ma pelna wersje. Dostosowac installFullStack().

---

## 3. FAZA B — USUNAC ZBEDNE PLIKI

### B1. Usunac Migration.gs (caly plik)
### B2. Usunac AuthMigration.gs (caly plik)
### B3. Usunac z Menu.gs pozycje:
- Migrate to Per-Site Divi Keys (funkcja usunięta)
- Verify Migration (funkcja usunięta)
- Migrate Auth for All Sites (funkcja usunięta)
- View Auth Status (funkcja usunięta)
Zostawic: Setup Auth for Site

---

## 4. FAZA C — ELIMINACJA waas_product

### Problem
Produkty sa PODWOJNIE: waas_product (Amazon Products) + WooCommerce product.
Shortcody JUZ szukaja najpierw w WooCommerce po _waas_asin meta key.

### C1. Zmodyfikowac REST API v2 — import bezposrednio do WC_Product_External
Meta na WC product: _waas_asin, _waas_partner_tag, _waas_affiliate_link,
_waas_source, _waas_last_sync, _waas_features (JSON), _waas_rating,
_waas_reviews_count, _waas_original_price, _waas_currency

### C2. Shortcody — usunac fallback do waas_product, szukac TYLKO w WC product

### C3. Usunac rejestracje custom post type waas_product (class-product-post-type.php)

### C4. Dodac endpoint migracji: POST /waas/v1/products/migrate-to-wc
Migruje istniejace waas_product do WooCommerce products.

### C5. Dostosowac GAS ProductExportToWordPress.gs

### C6. Po migracji: Amazon Products znika z WP sidebar

---

## 5. FAZA D — NOWE MODULY GAS

### D1. SiteCleanup.gs
cleanupClonedSite(siteId):
- Usun wszystkie WC products
- Usun wszystkie posty (nie strony!)
- Usun waas_products (jesli istnieja)
- Usun nieuzywane kategorie/tagi/atrybuty
- Resetuj ustawienia (partner tag, API keys)
- Zaktualizuj Site Title z Sites sheet
- Flush cache
Wymaga: POST /waas-settings/v1/cleanup

### D2. SearchEngines.gs
Google Search Console API:
- registerInGoogleSearchConsole(site) — dodaje strone
- submitSitemapToGSC(site) — sitemap submission
- verifyGSCOwnership(site) — HTML meta tag method
Wymaga: OAuth2 scope webmasters

Bing Webmaster API:
- registerInBingWebmaster(site)
- submitSitemapToBing(site)
- verifyBingOwnership(site) — XML file method
Wymaga: Bing API key

Nowe kolumny Sites sheet: GSC Verified, GSC Sitemap, Bing Verified, Bing Sitemap

### D3. LaunchReport.gs
generateLaunchReport(siteId) — zbiera dane
generateLaunchReportPDF(siteId) — PDF przez Google Docs template
saveLaunchReportToDrive(siteId) — zapisuje do Drive folder "WAAS Reports"
sendLaunchEmail(siteId) — email na service@netanaliza.com
exportToNotion(siteId) — Notion API page creation

### D4. ContentGenerator.gs v2 — Claude API integration
Nowy arkusz "Content Seeds": ID, Site ID, Keyword, Content Type, Title Idea, Status
Workflow: Seeds → Claude API → Content Queue → Publish → SEO meta
API: POST https://api.anthropic.com/v1/messages (model: claude-sonnet-4-20250514)

---

## 6. FAZA E — NOWE ENDPOINTY WORDPRESS (waas-settings.php)

POST /waas-settings/v1/cleanup — czyszczenie po klonowaniu
POST /waas-settings/v1/gsc-verify — dodaje GSC meta tag
POST /waas-settings/v1/bing-verify — tworzy BingSiteAuth.xml
PUT /waas-settings/v1/branding — aktualizacja Site Title, Tagline
GET /waas-settings/v1/site-info — pelne dane strony (dla raportu)
Dodac: admin_menu page zeby plugin byl widoczny w WP

---

## 7. FAZA F — PRICE SYNC

Codziennie 01:00-05:00:
1. WP cron sprawdza kazdy WC product z _waas_asin
2. Pobiera cene z PA-API lub SP-API (konfiguracja w WP settings)
3. Aktualizuje _regular_price i _waas_last_sync
4. Webhook do Google Sheets (ProductManager-PRICE-WEBHOOK.gs)

Nowe ustawienia WP: Price Sync Source (PA-API/SP-API/Both), Schedule

---

## 8. FAZA G — NOWE MENU

Dodac do Menu.gs onOpen():
- Sites: + Cleanup Cloned Site
- SEO: caly nowy submenu (z SEO.gs)
- Search Engines: nowy submenu (GSC, Bing, Sitemaps)
- Reports: nowy submenu (Launch Report, Email, Notion, Drive)
- Automation: + NEW SITE WIZARD (Full Pipeline)
- Usunac: Migration items, Auth Migration items

---

## 9. FAZA H — FULL ONBOARDING PIPELINE

launchNewSite(siteId):
1. Cleanup cloned site
2. Setup auth (Application Password)
3. Install missing plugins (Rank Math, waas-settings, Complianz)
4. Configure branding (Site Title, Tagline z Sites sheet)
5. Import produktow z Products sheet
6. Full SEO setup (RankMath, meta, schema) — SEO.gs
7. Register in search engines (GSC, Bing) — SearchEngines.gs
8. Generate content from seeds (AI) — ContentGenerator.gs v2
9. Generate launch report PDF → Google Drive
10. Send email na service@netanaliza.com

---

## 10. PRIORYTETY IMPLEMENTACJI

1. FAZA A (konflikty) — NATYCHMIAST
2. FAZA B (czyszczenie) — szybkie
3. FAZA G (menu) — po A+B
4. FAZA C (waas_product eliminacja) — duza zmiana, staranne testy
5. FAZA D+E (nowe moduly) — SiteCleanup najpierw
6. FAZA F (price sync) — rownolegly
7. FAZA H (pipeline) — na koncu, laczy wszystko

## KLUCZOWE ZASADY

NIE ZMIENIAC: Core.gs, WordPressAuth.gs, WordPressAPI.gs
NIE RUSZAC: SPApiAuth-WAAS.gs, SPApiDataCollection-WAAS.gs (nie w GitHub)
ZAWSZE UZYWAC: getSiteById(), getAuthHeader(), logInfo/Error/Success/Warning()
NAMESPACE WP: waas-settings/v1 (oddzielny od waas/v1)
EMAIL RAPORTU: service@netanaliza.com
